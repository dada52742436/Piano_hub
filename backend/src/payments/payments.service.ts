import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentStatus } from './payment-status.enum.js';
import { TransactionStatus } from '../transactions/transaction-status.enum.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(transactionId: number, buyerId: number, dto: CreatePaymentDto) {
    const transaction = await this.prismaService.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            status: true,
            owner: { select: { id: true, username: true } },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction #${transactionId} not found`);
    }

    if (transaction.buyerId !== buyerId) {
      throw new ForbiddenException('You are not the buyer for this transaction');
    }

    if (
      transaction.status !== TransactionStatus.sellerAccepted &&
      transaction.status !== TransactionStatus.buyerConfirmed
    ) {
      throw new BadRequestException(
        'Payments can only be started after the seller accepts the transaction',
      );
    }

    return this.prismaService.prisma.payment.create({
      data: {
        transactionId,
        buyerId,
        amount: dto.amount,
        providerPaymentId: dto.providerPaymentId,
      },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            listing: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  findMine(buyerId: number) {
    return this.prismaService.prisma.payment.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            listing: {
              select: {
                id: true,
                title: true,
                status: true,
                owner: { select: { id: true, username: true } },
              },
            },
          },
        },
      },
    });
  }

  async findByTransaction(transactionId: number, requesterId: number) {
    const transaction = await this.prismaService.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        listing: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction #${transactionId} not found`);
    }

    const isBuyer = transaction.buyerId === requesterId;
    const isSeller = transaction.listing.ownerId === requesterId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('You are not a party to this transaction');
    }

    return this.prismaService.prisma.payment.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async simulateStatus(id: number, status: PaymentStatus, requesterId: number) {
    const payment = await this.prismaService.prisma.payment.findUnique({
      where: { id },
      include: {
        transaction: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment #${id} not found`);
    }

    if (payment.buyerId !== requesterId) {
      throw new ForbiddenException('You are not the buyer for this payment');
    }

    if (payment.status === PaymentStatus.paid) {
      throw new BadRequestException('A paid payment cannot be changed');
    }

    if (status === PaymentStatus.pending) {
      throw new BadRequestException('Simulated payments cannot be reset to pending');
    }

    return this.prismaService.prisma.payment.update({
      where: { id },
      data: {
        status,
        paidAt: status === PaymentStatus.paid ? new Date() : null,
      },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            listing: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }
}
