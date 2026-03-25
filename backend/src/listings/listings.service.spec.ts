// Prevent ts-jest from loading PrismaService → generated Prisma client
// (which uses import.meta and is incompatible with CJS jest transform).
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockListing = {
  id: 1,
  title: 'Yamaha U1 Upright Piano',
  description: 'Well-maintained, grade 8 condition',
  price: 5500,
  brand: 'Yamaha',
  condition: 'good',
  location: 'Melbourne CBD',
  ownerId: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  owner: { id: 1, username: 'alice' },
  images: [],
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  prisma: {
    listing: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('ListingsService', () => {
  let service: ListingsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  // ── findAll ──────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns a paginated envelope with sensible defaults', async () => {
      mockPrismaService.prisma.listing.findMany.mockResolvedValue([mockListing]);
      mockPrismaService.prisma.listing.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(12);
      expect(result.totalPages).toBe(1);
    });

    it('calculates totalPages correctly for multi-page results', async () => {
      mockPrismaService.prisma.listing.findMany.mockResolvedValue([]);
      mockPrismaService.prisma.listing.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
    });

    it('adds a search OR filter when search param is provided', async () => {
      mockPrismaService.prisma.listing.findMany.mockResolvedValue([]);
      mockPrismaService.prisma.listing.count.mockResolvedValue(0);

      await service.findAll({ search: 'steinway' });

      const findManyCall = mockPrismaService.prisma.listing.findMany.mock
        .calls[0][0] as { where: { OR?: unknown[] } };
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR).toHaveLength(2);
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the listing when it exists', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(mockListing);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Yamaha U1 Upright Piano');
    });

    it('throws NotFoundException when the listing does not exist', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a listing and sets ownerId from the authenticated user', async () => {
      mockPrismaService.prisma.listing.create.mockResolvedValue(mockListing);

      const result = await service.create(
        { title: 'Test Piano', description: 'Desc', price: 5000, condition: 'good' },
        1,
      );

      expect(result.id).toBe(mockListing.id);

      const createCall = mockPrismaService.prisma.listing.create.mock
        .calls[0][0] as { data: { ownerId: number } };
      expect(createCall.data.ownerId).toBe(1);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws ForbiddenException when the requester is not the owner', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(mockListing);

      // ownerIs is 1, but requester is 99
      await expect(service.update(1, { title: 'New Title' }, 99)).rejects.toThrow(
        ForbiddenException,
      );

      expect(mockPrismaService.prisma.listing.update).not.toHaveBeenCalled();
    });

    it('updates the listing when the requester is the owner', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(mockListing);
      const updated = { ...mockListing, title: 'New Title' };
      mockPrismaService.prisma.listing.update.mockResolvedValue(updated);

      const result = await service.update(1, { title: 'New Title' }, 1);

      expect(result.title).toBe('New Title');
      expect(mockPrismaService.prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws ForbiddenException when the requester is not the owner', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(mockListing);

      await expect(service.remove(1, 99)).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.prisma.listing.delete).not.toHaveBeenCalled();
    });

    it('deletes the listing when the requester is the owner', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.prisma.listing.delete.mockResolvedValue(mockListing);

      const result = await service.remove(1, 1);

      expect(result.message).toContain('deleted');
      expect(mockPrismaService.prisma.listing.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
