jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';
import { TransactionStatus } from './transaction-status.enum';

const mockPrismaService = {
  prisma: {
    listing: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      updateMany: jest.fn(),
    },
    inquiry: {
      updateMany: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
};

const mockConfigService = {
  get: jest.fn(),
};

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  beforeEach(() => {
    mockConfigService.get.mockReturnValue(48);
    mockPrismaService.prisma.transaction.updateMany.mockResolvedValue({ count: 0 });
    mockPrismaService.prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    mockPrismaService.prisma.inquiry.updateMany.mockResolvedValue({ count: 0 });
    mockPrismaService.prisma.payment.findFirst.mockResolvedValue({ id: 1, status: 'paid' });
    mockPrismaService.prisma.transaction.findFirst.mockResolvedValue(null);
  });

  it('creates a transaction for a valid buyer', async () => {
    mockPrismaService.prisma.listing.findUnique.mockResolvedValue({
      id: 10,
      ownerId: 1,
      status: 'active',
    });
    mockPrismaService.prisma.transaction.findFirst.mockResolvedValue(null);
    mockPrismaService.prisma.transaction.create.mockResolvedValue({
      id: 50,
      listingId: 10,
      buyerId: 2,
      offeredPrice: 3200,
      status: 'initiated',
    });

    const result = await service.create(10, 2, {
      offeredPrice: 3200,
      message: 'Ready to move forward at this price.',
    });

    expect(result).toMatchObject({
      id: 50,
      listingId: 10,
      buyerId: 2,
      offeredPrice: 3200,
      status: 'initiated',
    });
  });

  it('rejects transactions for missing listings', async () => {
    mockPrismaService.prisma.listing.findUnique.mockResolvedValue(null);

    await expect(
      service.create(999, 2, { offeredPrice: 2400 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects transactions on your own listing', async () => {
    mockPrismaService.prisma.listing.findUnique.mockResolvedValue({
      id: 10,
      ownerId: 2,
      status: 'active',
    });

    await expect(
      service.create(10, 2, { offeredPrice: 3000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transactions for non-active listings', async () => {
    mockPrismaService.prisma.listing.findUnique.mockResolvedValue({
      id: 10,
      ownerId: 1,
      status: 'sold',
    });

    await expect(
      service.create(10, 2, { offeredPrice: 3000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate transactions for the same listing', async () => {
    mockPrismaService.prisma.listing.findUnique.mockResolvedValue({
      id: 10,
      ownerId: 1,
      status: 'active',
    });
    mockPrismaService.prisma.transaction.findFirst.mockResolvedValue({
      id: 88,
      listingId: 10,
      buyerId: 2,
      status: 'initiated',
    });

    await expect(
      service.create(10, 2, { offeredPrice: 3100 }),
    ).rejects.toThrow(ConflictException);
  });

  it('allows creating a new transaction after the previous one is terminal', async () => {
    mockPrismaService.prisma.listing.findUnique.mockResolvedValue({
      id: 10,
      ownerId: 1,
      status: 'active',
    });
    mockPrismaService.prisma.transaction.findFirst.mockResolvedValue(null);
    mockPrismaService.prisma.transaction.create.mockResolvedValue({
      id: 89,
      listingId: 10,
      buyerId: 2,
      offeredPrice: 3300,
      status: 'initiated',
    });

    const result = await service.create(10, 2, {
      offeredPrice: 3300,
      message: 'Starting a fresh deal flow after cancellation.',
    });

    expect(result).toMatchObject({
      id: 89,
      listingId: 10,
      buyerId: 2,
      status: 'initiated',
    });
    expect(mockPrismaService.prisma.transaction.findFirst).toHaveBeenCalledWith({
      where: {
        listingId: 10,
        buyerId: 2,
        status: {
          notIn: ['completed', 'cancelled'],
        },
      },
    });
  });

  it('returns transactions started by the current buyer', async () => {
    mockPrismaService.prisma.transaction.findMany.mockResolvedValue([
      { id: 1, buyerId: 2, listingId: 10 },
    ]);

    const result = await service.findMine(2);

    expect(result).toHaveLength(1);
    expect(mockPrismaService.prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { buyerId: 2 },
      }),
    );
    expect(mockPrismaService.prisma.transaction.updateMany).toHaveBeenCalled();
  });

  it('prevents non-owners from viewing listing transactions', async () => {
    mockPrismaService.prisma.listing.findUnique.mockResolvedValue({
      id: 10,
      ownerId: 1,
    });

    await expect(service.findByListing(10, 99)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows the seller to accept an initiated transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 77,
      buyerId: 2,
      status: 'initiated',
      listingId: 10,
      listing: { id: 10, ownerId: 1, status: 'active' },
    });
    mockPrismaService.prisma.transaction.update.mockResolvedValue({
      id: 77,
      status: 'seller_accepted',
      expiresAt: new Date('2026-04-05T10:00:00.000Z'),
      listing: { id: 10, status: 'active' },
      buyer: { id: 2, username: 'buyer' },
    });

    const result = await service.updateStatus(
      77,
      TransactionStatus.sellerAccepted,
      1,
    );

    expect(result).toMatchObject({
      id: 77,
      status: 'seller_accepted',
    });
    expect(mockPrismaService.prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'seller_accepted',
          sellerAcceptedAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it('allows the buyer to confirm a seller-accepted transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 77,
      buyerId: 2,
      status: 'seller_accepted',
      listingId: 10,
      listing: { id: 10, ownerId: 1, status: 'active' },
    });
    mockPrismaService.prisma.transaction.update.mockResolvedValue({
      id: 77,
      status: 'buyer_confirmed',
      listing: { id: 10, status: 'active' },
      buyer: { id: 2, username: 'buyer' },
    });

    const result = await service.updateStatus(
      77,
      TransactionStatus.buyerConfirmed,
      2,
    );

    expect(result).toMatchObject({
      id: 77,
      status: 'buyer_confirmed',
    });
  });

  it('marks the listing as sold when the seller completes the transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 77,
      buyerId: 2,
      status: 'buyer_confirmed',
      listingId: 10,
      listing: { id: 10, ownerId: 1, status: 'active' },
    });
    mockPrismaService.prisma.transaction.update.mockResolvedValue({
      id: 77,
      status: 'completed',
      listing: { id: 10, status: 'active' },
      buyer: { id: 2, username: 'buyer' },
    });
    mockPrismaService.prisma.listing.update.mockResolvedValue({
      id: 10,
      status: 'sold',
    });

    const result = await service.updateStatus(
      77,
      TransactionStatus.completed,
      1,
    );

    expect(mockPrismaService.prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { status: 'sold' },
    });
    expect(mockPrismaService.prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        listingId: 10,
        id: { not: 77 },
        status: {
          notIn: ['completed', 'cancelled'],
        },
      },
      data: {
        status: 'cancelled',
        expiresAt: null,
      },
    });
    expect(mockPrismaService.prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        listingId: 10,
        buyerId: { not: 2 },
        status: {
          in: ['pending', 'accepted'],
        },
      },
      data: {
        status: 'rejected',
      },
    });
    expect(mockPrismaService.prisma.inquiry.updateMany).toHaveBeenCalledWith({
      where: {
        listingId: 10,
        status: 'open',
      },
      data: {
        status: 'closed',
      },
    });
    expect(result).toMatchObject({
      id: 77,
      status: 'completed',
      listing: { status: 'sold' },
    });
  });

  it('rejects completing a transaction before payment is marked as paid', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 77,
      buyerId: 2,
      status: 'buyer_confirmed',
      listingId: 10,
      listing: { id: 10, ownerId: 1, status: 'active' },
    });
    mockPrismaService.prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      service.updateStatus(77, TransactionStatus.completed, 1),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrismaService.prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('allows either party to cancel a non-terminal transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 77,
      buyerId: 2,
      status: 'seller_accepted',
      listingId: 10,
      listing: { id: 10, ownerId: 1, status: 'active' },
    });
    mockPrismaService.prisma.transaction.update.mockResolvedValue({
      id: 77,
      status: 'cancelled',
      listing: { id: 10, status: 'active' },
      buyer: { id: 2, username: 'buyer' },
    });

    const result = await service.updateStatus(
      77,
      TransactionStatus.cancelled,
      2,
    );

    expect(result.status).toBe('cancelled');
  });

  it('rejects transaction status changes from unrelated users', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 77,
      buyerId: 2,
      status: 'initiated',
      listingId: 10,
      listing: { id: 10, ownerId: 1, status: 'active' },
    });

    await expect(
      service.updateStatus(77, TransactionStatus.cancelled, 99),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects invalid transaction status transitions', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 77,
      buyerId: 2,
      status: 'initiated',
      listingId: 10,
      listing: { id: 10, ownerId: 1, status: 'active' },
    });

    await expect(
      service.updateStatus(77, TransactionStatus.buyerConfirmed, 2),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects changing a terminal transaction', async () => {
    mockPrismaService.prisma.transaction.findUnique.mockResolvedValue({
      id: 77,
      buyerId: 2,
      status: 'completed',
      listingId: 10,
      listing: { id: 10, ownerId: 1, status: 'sold' },
    });

    await expect(
      service.updateStatus(77, TransactionStatus.cancelled, 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('expires stale seller-accepted transactions before buyer actions continue', async () => {
    const expiredAt = new Date(Date.now() - 60_000);

    mockPrismaService.prisma.transaction.findUnique
      .mockResolvedValueOnce({
        id: 77,
        buyerId: 2,
        status: 'seller_accepted',
        listingId: 10,
        expiresAt: expiredAt,
        listing: { id: 10, ownerId: 1, status: 'active' },
      })
      .mockResolvedValueOnce({
        id: 77,
        buyerId: 2,
        status: 'cancelled',
        listingId: 10,
        expiresAt: null,
        listing: { id: 10, ownerId: 1, status: 'active' },
      });

    mockPrismaService.prisma.transaction.update.mockResolvedValue({
      id: 77,
      status: 'cancelled',
      expiresAt: null,
      listing: { id: 10, ownerId: 1, status: 'active' },
    });

    await expect(
      service.updateStatus(77, TransactionStatus.buyerConfirmed, 2),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrismaService.prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 77 },
        data: {
          status: 'cancelled',
          expiresAt: null,
        },
      }),
    );
  });
});
