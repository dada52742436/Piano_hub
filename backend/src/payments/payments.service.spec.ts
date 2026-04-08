jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './payment-status.enum';
import { StripeService } from './stripe.service';

const mockPrismaService = {
  prisma: {
    transaction: {
      findUnique: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
};

const mockConfigService = {
  get: jest.fn(),
};

const mockStripeService = {
  createCheckoutSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: StripeService, useValue: mockStripeService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    mockConfigService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        STRIPE_SUCCESS_URL: 'http://localhost:3000/payments/success',
        STRIPE_CANCEL_URL: 'http://localhost:3000/payments/cancel',
        STRIPE_CURRENCY: 'aud',
      };

      return values[key];
    });

    mockPrismaService.prisma.payment.findFirst.mockResolvedValue(null);
    mockPrismaService.prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    mockStripeService.createCheckoutSession.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
      payment_intent: 'pi_test_123',
    });
  });

  it('creates a payment for a buyer on a seller-accepted transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      buyerId: 2,
      status: 'seller_accepted',
      listing: {
        id: 9,
        title: 'Deal Listing',
        status: 'active',
        owner: { id: 1, username: 'seller' },
      },
    });
    mockPrismaService.prisma.payment.create.mockResolvedValue({
      id: 30,
      transactionId: 12,
      buyerId: 2,
      amount: 3400,
      status: 'pending',
    });

    const result = await service.create(12, 2, { amount: 3400 });

    expect(result).toMatchObject({
      id: 30,
      transactionId: 12,
      amount: 3400,
      status: 'pending',
    });
  });

  it('creates a Stripe Checkout session for a buyer on a valid transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      buyerId: 2,
      offeredPrice: 3400,
      status: 'seller_accepted',
      buyer: {
        email: 'buyer@example.com',
      },
      listing: {
        id: 9,
        title: 'Stripe Deal Listing',
        status: 'active',
        owner: { id: 1, username: 'seller' },
      },
    });
    mockPrismaService.prisma.payment.create.mockResolvedValue({
      id: 40,
      transactionId: 12,
      buyerId: 2,
      amount: 3400,
      provider: 'stripe',
      status: 'pending',
      transaction: {
        id: 12,
        status: 'seller_accepted',
        listing: {
          id: 9,
          title: 'Stripe Deal Listing',
          status: 'active',
        },
      },
    });
    mockPrismaService.prisma.payment.update.mockResolvedValue({
      id: 40,
      transactionId: 12,
      buyerId: 2,
      amount: 3400,
      provider: 'stripe',
      providerCheckoutSessionId: 'cs_test_123',
      providerPaymentId: 'pi_test_123',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
      status: 'pending',
      transaction: {
        id: 12,
        status: 'seller_accepted',
        listing: {
          id: 9,
          title: 'Stripe Deal Listing',
          status: 'active',
        },
      },
    });

    const result = await service.createCheckoutSession(12, 2);

    expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 40,
        transactionId: 12,
        amountCents: 340000,
        listingTitle: 'Stripe Deal Listing',
      }),
    );
    expect(result).toMatchObject({
      id: 40,
      provider: 'stripe',
      providerCheckoutSessionId: 'cs_test_123',
      providerPaymentId: 'pi_test_123',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
      status: 'pending',
    });
  });

  it('reuses an existing pending Stripe payment session', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      buyerId: 2,
      offeredPrice: 3400,
      status: 'seller_accepted',
      buyer: {
        email: 'buyer@example.com',
      },
      listing: {
        id: 9,
        title: 'Stripe Deal Listing',
        status: 'active',
        owner: { id: 1, username: 'seller' },
      },
    });
    mockPrismaService.prisma.payment.findFirst.mockResolvedValue({
      id: 41,
      transactionId: 12,
      buyerId: 2,
      amount: 3400,
      provider: 'stripe',
      providerCheckoutSessionId: 'cs_existing',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_existing',
      status: 'pending',
      transaction: {
        id: 12,
        status: 'seller_accepted',
        listing: {
          id: 9,
          title: 'Stripe Deal Listing',
          status: 'active',
        },
      },
    });

    const result = await service.createCheckoutSession(12, 2);

    expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();
    expect(mockPrismaService.prisma.payment.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 41,
      providerCheckoutSessionId: 'cs_existing',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_existing',
      status: 'pending',
    });
  });

  it('rejects payment creation for a missing transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue(null);

    await expect(service.create(999, 2, { amount: 3000 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects payment creation from a different buyer', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      buyerId: 5,
      status: 'seller_accepted',
      listing: {
        id: 9,
        title: 'Deal Listing',
        status: 'active',
        owner: { id: 1, username: 'seller' },
      },
    });

    await expect(service.create(12, 2, { amount: 3000 })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects payment creation before the seller accepts the transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      buyerId: 2,
      status: 'initiated',
      listing: {
        id: 9,
        title: 'Deal Listing',
        status: 'active',
        owner: { id: 1, username: 'seller' },
      },
    });

    await expect(service.create(12, 2, { amount: 3000 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns only the current buyer payments', async () => {
    mockPrismaService.prisma.payment.findMany.mockResolvedValue([
      { id: 1, buyerId: 2, amount: 3200 },
    ]);

    const result = await service.findMine(2);

    expect(result).toHaveLength(1);
    expect(mockPrismaService.prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buyerId: 2 },
      }),
    );
  });

  it('allows buyer or seller to view payments for a transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      buyerId: 2,
      listing: { ownerId: 1 },
    });
    mockPrismaService.prisma.payment.findMany.mockResolvedValue([{ id: 20 }]);

    const result = await service.findByTransaction(12, 1);

    expect(result).toHaveLength(1);
  });

  it('rejects unrelated users from viewing payments for a transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      buyerId: 2,
      listing: { ownerId: 1 },
    });

    await expect(service.findByTransaction(12, 99)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('simulates a successful payment for the buyer', async () => {
    mockPrismaService.prisma.payment.findUnique.mockResolvedValue({
      id: 20,
      buyerId: 2,
      status: 'pending',
      transaction: { id: 12 },
    });
    mockPrismaService.prisma.payment.update.mockResolvedValue({
      id: 20,
      status: 'paid',
      paidAt: new Date(),
    });

    const result = await service.simulateStatus(20, PaymentStatus.paid, 2);

    expect(result).toMatchObject({
      id: 20,
      status: 'paid',
    });
  });

  it('rejects resetting a simulated payment back to pending', async () => {
    mockPrismaService.prisma.payment.findUnique.mockResolvedValue({
      id: 20,
      buyerId: 2,
      status: 'pending',
      transaction: { id: 12 },
    });

    await expect(
      service.simulateStatus(20, PaymentStatus.pending, 2),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks a payment as paid from a checkout.session.completed webhook', async () => {
    mockStripeService.constructWebhookEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          metadata: {
            paymentId: '40',
          },
        },
      },
    });
    mockPrismaService.prisma.payment.findUnique.mockResolvedValue({
      id: 40,
      status: 'pending',
      providerPaymentId: null,
    });

    const result = await service.handleStripeWebhook(
      Buffer.from('payload'),
      'sig_test',
    );

    expect(result).toEqual({ received: true });
    expect(mockPrismaService.prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 40 },
      data: {
        status: 'paid',
        paidAt: expect.any(Date),
        providerCheckoutSessionId: 'cs_test_123',
        providerPaymentId: 'pi_test_123',
      },
    });
  });

  it('marks a payment as cancelled from a checkout.session.expired webhook', async () => {
    mockStripeService.constructWebhookEvent.mockReturnValue({
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_test_123',
        },
      },
    });

    await service.handleStripeWebhook(Buffer.from('payload'), 'sig_test');

    expect(mockPrismaService.prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        providerCheckoutSessionId: 'cs_test_123',
        status: 'pending',
      },
      data: {
        status: 'cancelled',
      },
    });
  });

  it('marks a payment as failed from a payment_intent.payment_failed webhook', async () => {
    mockStripeService.constructWebhookEvent.mockReturnValue({
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test_123',
          metadata: {
            paymentId: '40',
          },
        },
      },
    });

    await service.handleStripeWebhook(Buffer.from('payload'), 'sig_test');

    expect(mockPrismaService.prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 40,
        status: 'pending',
      },
      data: {
        status: 'failed',
        providerPaymentId: 'pi_test_123',
      },
    });
  });

  it('rejects creating a Stripe Checkout session when Stripe return URLs are missing', async () => {
    mockConfigService.get.mockReturnValue(undefined);
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 12,
      buyerId: 2,
      offeredPrice: 3400,
      status: 'seller_accepted',
      buyer: {
        email: 'buyer@example.com',
      },
      listing: {
        id: 9,
        title: 'Stripe Deal Listing',
        status: 'active',
        owner: { id: 1, username: 'seller' },
      },
    });
    mockPrismaService.prisma.payment.create.mockResolvedValue({
      id: 40,
      transactionId: 12,
      buyerId: 2,
      amount: 3400,
      provider: 'stripe',
      status: 'pending',
      transaction: {
        id: 12,
        status: 'seller_accepted',
        listing: {
          id: 9,
          title: 'Stripe Deal Listing',
          status: 'active',
        },
      },
    });

    await expect(service.createCheckoutSession(12, 2)).rejects.toThrow(
      InternalServerErrorException,
    );

    expect(mockPrismaService.prisma.payment.delete).toHaveBeenCalledWith({
      where: { id: 40 },
    });
  });
});
