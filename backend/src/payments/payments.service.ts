import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentStatus } from './payment-status.enum.js';
import { TransactionStatus } from '../transactions/transaction-status.enum.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';
import { StripeService } from './stripe.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
  ) {}

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

  async createCheckoutSession(transactionId: number, buyerId: number) {
    const transaction = await this.prismaService.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        buyer: {
          select: {
            email: true,
          },
        },
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
        'Checkout can only start after the seller accepts the transaction',
      );
    }

    // Stripe requires a minimum charge of $0.50 in any currency.
    // Catch this early with a clear message rather than letting Stripe reject it.
    const STRIPE_MIN_CENTS = 50;
    const amountCents = Math.round(transaction.offeredPrice * 100);
    if (amountCents < STRIPE_MIN_CENTS) {
      throw new BadRequestException(
        `The transaction amount ($${transaction.offeredPrice}) is below Stripe's minimum charge of $0.50. Please cancel this transaction and start a new one with a higher price.`,
      );
    }

    const existingPendingPayment = await this.prismaService.prisma.payment.findFirst({
      where: {
        transactionId,
        buyerId,
        provider: 'stripe',
        status: PaymentStatus.pending,
        providerCheckoutSessionId: { not: null },
        checkoutUrl: { not: null },
      },
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
              },
            },
          },
        },
      },
    });

    if (existingPendingPayment) {
      return existingPendingPayment;
    }

    const payment = await this.prismaService.prisma.payment.create({
      data: {
        transactionId,
        buyerId,
        amount: transaction.offeredPrice,
        provider: 'stripe',
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

    try {
      const session = await this.stripeService.createCheckoutSession({
        amountCents,
        currency: this.getStripeCurrency(),
        successUrl: this.buildStripeReturnUrl('STRIPE_SUCCESS_URL', transactionId),
        cancelUrl: this.buildStripeReturnUrl('STRIPE_CANCEL_URL', transactionId),
        listingTitle: transaction.listing.title,
        paymentId: payment.id,
        transactionId,
        buyerEmail: transaction.buyer.email,
      });

      return this.prismaService.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerCheckoutSessionId: session.id,
          checkoutUrl: session.url ?? null,
          providerPaymentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null,
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
    } catch (error) {
      await this.prismaService.prisma.payment.delete({
        where: { id: payment.id },
      });

      throw error;
    }
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

  async handleStripeWebhook(rawBody: Buffer, signature?: string | string[]) {
    if (!signature || Array.isArray(signature)) {
      throw new BadRequestException('Missing Stripe signature header');
    }

    const event = this.stripeService.constructWebhookEvent(rawBody, signature);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'checkout.session.expired':
        await this.handleCheckoutSessionExpired(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      default:
        break;
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    const paymentId = session.metadata?.paymentId
      ? Number(session.metadata.paymentId)
      : undefined;

    const existingPayment = paymentId
      ? await this.prismaService.prisma.payment.findUnique({
          where: { id: paymentId },
        })
      : await this.prismaService.prisma.payment.findFirst({
          where: { providerCheckoutSessionId: session.id },
        });

    if (!existingPayment) {
      return;
    }

    if (existingPayment.status === PaymentStatus.paid) {
      return;
    }

    await this.prismaService.prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: PaymentStatus.paid,
        paidAt: new Date(),
        providerCheckoutSessionId: session.id,
        providerPaymentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : existingPayment.providerPaymentId,
      },
    });
  }

  private async handleCheckoutSessionExpired(
    session: Stripe.Checkout.Session,
  ) {
    await this.prismaService.prisma.payment.updateMany({
      where: {
        providerCheckoutSessionId: session.id,
        status: PaymentStatus.pending,
      },
      data: {
        status: PaymentStatus.cancelled,
      },
    });
  }

  private async handlePaymentIntentFailed(intent: Stripe.PaymentIntent) {
    const paymentId = intent.metadata?.paymentId
      ? Number(intent.metadata.paymentId)
      : undefined;

    if (paymentId) {
      await this.prismaService.prisma.payment.updateMany({
        where: {
          id: paymentId,
          status: PaymentStatus.pending,
        },
        data: {
          status: PaymentStatus.failed,
          providerPaymentId: intent.id,
        },
      });

      return;
    }

    await this.prismaService.prisma.payment.updateMany({
      where: {
        providerPaymentId: intent.id,
        status: PaymentStatus.pending,
      },
      data: {
        status: PaymentStatus.failed,
      },
    });
  }

  /**
   * If the transaction being cancelled has a paid Stripe payment, issue a refund.
   * Refund failure is logged but does NOT block the cancellation — the transaction
   * is cancelled regardless and the payment stays 'paid' for manual reconciliation.
   */
  async refundPaidStripePayment(transactionId: number): Promise<void> {
    const payment = await this.prismaService.prisma.payment.findFirst({
      where: {
        transactionId,
        provider: 'stripe',
        status: PaymentStatus.paid,
        providerPaymentId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment?.providerPaymentId) {
      return;
    }

    try {
      await this.stripeService.createRefund(payment.providerPaymentId);
      await this.prismaService.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.refunded },
      });
    } catch (error) {
      // Log but do not rethrow — cancellation must still proceed.
      console.error(
        `[PaymentsService] Stripe refund failed for payment #${payment.id} (paymentIntent: ${payment.providerPaymentId}):`,
        error,
      );
    }
  }

  private buildStripeReturnUrl(
    envKey: 'STRIPE_SUCCESS_URL' | 'STRIPE_CANCEL_URL',
    transactionId: number,
  ): string {
    const baseUrl = this.configService.get<string>(envKey);

    if (!baseUrl) {
      throw new InternalServerErrorException(`${envKey} is not configured`);
    }

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}transactionId=${transactionId}&session_id={CHECKOUT_SESSION_ID}`;
  }

  private getStripeCurrency(): string {
    const currency = this.configService.get<string>('STRIPE_CURRENCY')?.trim().toLowerCase();

    return currency || 'aud';
  }
}
