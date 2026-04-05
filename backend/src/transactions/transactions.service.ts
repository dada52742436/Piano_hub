import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { BookingStatus } from '../bookings/booking-status.enum.js';
import { InquiryStatus } from '../inquiries/inquiry-status.enum.js';
import { ListingStatus } from '../listings/listing-status.enum.js';
import type { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { TransactionStatus } from './transaction-status.enum.js';
import type { Prisma, Transaction } from '../../generated/prisma/client.js';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(listingId: number, buyerId: number, dto: CreateTransactionDto) {
    const listing = await this.prismaService.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Listing #${listingId} not found`);
    }

    if (listing.ownerId === buyerId) {
      throw new BadRequestException('You cannot start a transaction on your own listing');
    }

    if (listing.status !== ListingStatus.active) {
      throw new BadRequestException('Only active listings can receive transactions');
    }

    const existingTransaction = await this.prismaService.prisma.transaction.findFirst({
      where: {
        listingId,
        buyerId,
        status: {
          notIn: [TransactionStatus.completed, TransactionStatus.cancelled],
        },
      },
    });

    if (existingTransaction) {
      throw new ConflictException(
        'You already have an active transaction on this listing',
      );
    }

    return this.prismaService.prisma.transaction.create({
      data: {
        listingId,
        buyerId,
        offeredPrice: dto.offeredPrice,
        message: dto.message,
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            owner: { select: { id: true, username: true } },
          },
        },
        buyer: {
          select: { id: true, username: true },
        },
      },
    });
  }

  findMine(buyerId: number) {
    return this.findMineAfterExpiring(buyerId);
  }

  private async findMineAfterExpiring(buyerId: number) {
    await this.expireStaleTransactions();

    return this.prismaService.prisma.transaction.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            location: true,
            status: true,
            owner: { select: { id: true, username: true } },
          },
        },
      },
    });
  }

  async findByListing(listingId: number, sellerId: number) {
    await this.expireStaleTransactions();

    const listing = await this.prismaService.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Listing #${listingId} not found`);
    }

    if (listing.ownerId !== sellerId) {
      throw new ForbiddenException('You do not own this listing');
    }

    return this.prismaService.prisma.transaction.findMany({
      where: { listingId },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: {
          select: { id: true, username: true },
        },
      },
    });
  }

  async updateStatus(
    id: number,
    status: TransactionStatus,
    requesterId: number,
  ) {
    await this.expireStaleTransactions();

    let transaction = await this.prismaService.prisma.transaction.findUnique({
      where: { id },
      include: { listing: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }

    if (this.isExpired(transaction)) {
      transaction = await this.prismaService.prisma.transaction.update({
        where: { id },
        data: {
          status: TransactionStatus.cancelled,
          expiresAt: null,
        },
        include: { listing: true },
      });

      throw new BadRequestException(
        'This transaction has expired because the buyer did not respond in time',
      );
    }

    const isSeller = transaction.listing.ownerId === requesterId;
    const isBuyer = transaction.buyerId === requesterId;

    if (!isSeller && !isBuyer) {
      throw new ForbiddenException('You are not a party to this transaction');
    }

    if (
      transaction.status === TransactionStatus.completed ||
      transaction.status === TransactionStatus.cancelled
    ) {
      throw new BadRequestException(
        `Transaction is already '${transaction.status}' and cannot be changed`,
      );
    }

    const allowedNextStatuses = this.getAllowedNextStatuses(transaction.status, {
      isSeller,
      isBuyer,
    });

    if (!allowedNextStatuses.includes(status)) {
      throw new BadRequestException(
        `You cannot move a transaction from '${transaction.status}' to '${status}'`,
      );
    }

    if (status === TransactionStatus.completed) {
      const paidPayment = await this.prismaService.prisma.payment.findFirst({
        where: {
          transactionId: id,
          status: 'paid',
        },
      });

      if (!paidPayment) {
        throw new BadRequestException(
          'This transaction cannot be completed until a payment is marked as paid',
        );
      }
    }

    const updatedTransaction = await this.prismaService.prisma.transaction.update({
      where: { id },
      data: this.buildStatusUpdateData(status),
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            location: true,
            owner: { select: { id: true, username: true } },
          },
        },
        buyer: {
          select: { id: true, username: true },
        },
      },
    });

    if (status === TransactionStatus.completed) {
      await this.prismaService.prisma.listing.update({
        where: { id: transaction.listingId },
        data: { status: ListingStatus.sold },
      });

      await this.closeCompetingDealFlows(transaction.listingId, transaction.id, transaction.buyerId);

      updatedTransaction.listing.status = ListingStatus.sold;
    }

    return updatedTransaction;
  }

  private buildStatusUpdateData(status: TransactionStatus): Prisma.TransactionUpdateInput {
    if (status === TransactionStatus.sellerAccepted) {
      return {
        status,
        sellerAcceptedAt: new Date(),
        expiresAt: this.buildAcceptedTransactionExpiry(),
      };
    }

    if (
      status === TransactionStatus.buyerConfirmed ||
      status === TransactionStatus.completed ||
      status === TransactionStatus.cancelled
    ) {
      return {
        status,
        expiresAt: null,
      };
    }

    return { status };
  }

  private buildAcceptedTransactionExpiry(): Date {
    const hours =
      this.configService.get<number>('TRANSACTION_ACCEPTED_TTL_HOURS') ?? 48;
    const ttlHours = Number.isFinite(hours) && hours > 0 ? hours : 48;

    return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  }

  private async expireStaleTransactions() {
    await this.prismaService.prisma.transaction.updateMany({
      where: {
        status: TransactionStatus.sellerAccepted,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: TransactionStatus.cancelled,
        expiresAt: null,
      },
    });
  }

  private async closeCompetingDealFlows(
    listingId: number,
    completedTransactionId: number,
    winningBuyerId: number,
  ) {
    await this.prismaService.prisma.transaction.updateMany({
      where: {
        listingId,
        id: { not: completedTransactionId },
        status: {
          notIn: [TransactionStatus.completed, TransactionStatus.cancelled],
        },
      },
      data: {
        status: TransactionStatus.cancelled,
        expiresAt: null,
      },
    });

    await this.prismaService.prisma.booking.updateMany({
      where: {
        listingId,
        buyerId: { not: winningBuyerId },
        status: {
          in: [BookingStatus.pending, BookingStatus.accepted],
        },
      },
      data: {
        status: BookingStatus.rejected,
      },
    });

    await this.prismaService.prisma.inquiry.updateMany({
      where: {
        listingId,
        status: InquiryStatus.open,
      },
      data: {
        status: InquiryStatus.closed,
      },
    });
  }

  private isExpired(transaction: Transaction): boolean {
    return (
      transaction.status === TransactionStatus.sellerAccepted &&
      transaction.expiresAt != null &&
      transaction.expiresAt.getTime() <= Date.now()
    );
  }

  private getAllowedNextStatuses(
    currentStatus: string,
    actor: { isSeller: boolean; isBuyer: boolean },
  ): TransactionStatus[] {
    const transitions: TransactionStatus[] = [];

    if (actor.isSeller) {
      if (currentStatus === TransactionStatus.initiated) {
        transitions.push(TransactionStatus.sellerAccepted, TransactionStatus.cancelled);
      }

      if (currentStatus === TransactionStatus.sellerAccepted) {
        transitions.push(TransactionStatus.cancelled);
      }

      if (currentStatus === TransactionStatus.buyerConfirmed) {
        transitions.push(TransactionStatus.completed, TransactionStatus.cancelled);
      }
    }

    if (actor.isBuyer) {
      if (currentStatus === TransactionStatus.initiated) {
        transitions.push(TransactionStatus.cancelled);
      }

      if (currentStatus === TransactionStatus.sellerAccepted) {
        transitions.push(TransactionStatus.buyerConfirmed, TransactionStatus.cancelled);
      }

      if (currentStatus === TransactionStatus.buyerConfirmed) {
        transitions.push(TransactionStatus.cancelled);
      }
    }

    return transitions;
  }
}
