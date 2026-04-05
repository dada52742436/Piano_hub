jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './payment-status.enum';

const mockPrismaService = {
  prisma: {
    transaction: {
      findUnique: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
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
});
