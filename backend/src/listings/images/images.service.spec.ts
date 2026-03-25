// Prevent ts-jest from loading PrismaService → generated Prisma client
jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class MockPrismaService {},
}));

// Mock node:fs/promises so file system calls don't touch disk during tests
jest.mock('node:fs/promises', () => ({
  unlink: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as fsPromises from 'node:fs/promises';
import { ImagesService } from './images.service';
import { PrismaService } from '../../prisma/prisma.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockListing = {
  id: 1,
  ownerId: 1,
  images: [] as unknown[],
};

const mockImage = {
  id: 10,
  listingId: 1,
  url: '/uploads/listing-1-1234567890.jpg',
  order: 0,
  createdAt: new Date('2026-01-01'),
  listing: { id: 1, ownerId: 1 },
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  prisma: {
    listing: {
      findUnique: jest.fn(),
    },
    listingImage: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('ImagesService', () => {
  let service: ImagesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ImagesService>(ImagesService);
  });

  // ── addImage ─────────────────────────────────────────────────────────────────

  describe('addImage', () => {
    it('throws NotFoundException when the listing does not exist', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.addImage(999, 1, 'photo.jpg')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.prisma.listingImage.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the requester is not the owner', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(mockListing);

      // ownerId is 1, requester is 99
      await expect(service.addImage(1, 99, 'photo.jpg')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the 5-image limit is already reached', async () => {
      const fullListing = { ...mockListing, images: Array(5).fill({}) };
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(fullListing);

      await expect(service.addImage(1, 1, 'photo.jpg')).rejects.toThrow(BadRequestException);
    });

    it('creates a DB record with the correct URL on success', async () => {
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(mockListing);
      mockPrismaService.prisma.listingImage.create.mockResolvedValue(mockImage);

      await service.addImage(1, 1, 'listing-1-abc.jpg');

      expect(mockPrismaService.prisma.listingImage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          listingId: 1,
          url: '/uploads/listing-1-abc.jpg',
          order: 0, // first image → order 0 (images array was empty)
        }),
      });
    });

    it('sets order equal to the current image count', async () => {
      const listingWithTwoImages = { ...mockListing, images: [{}, {}] };
      mockPrismaService.prisma.listing.findUnique.mockResolvedValue(listingWithTwoImages);
      mockPrismaService.prisma.listingImage.create.mockResolvedValue(mockImage);

      await service.addImage(1, 1, 'photo.jpg');

      const createCall = mockPrismaService.prisma.listingImage.create.mock
        .calls[0][0] as { data: { order: number } };
      expect(createCall.data.order).toBe(2);
    });
  });

  // ── removeImage ───────────────────────────────────────────────────────────────

  describe('removeImage', () => {
    it('throws NotFoundException when the image does not exist', async () => {
      mockPrismaService.prisma.listingImage.findUnique.mockResolvedValue(null);

      await expect(service.removeImage(1, 999, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the image belongs to a different listing', async () => {
      const wrongListingImage = { ...mockImage, listingId: 2 };
      mockPrismaService.prisma.listingImage.findUnique.mockResolvedValue(wrongListingImage);

      await expect(service.removeImage(1, 10, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not the listing owner', async () => {
      mockPrismaService.prisma.listingImage.findUnique.mockResolvedValue(mockImage);

      await expect(service.removeImage(1, 10, 99)).rejects.toThrow(ForbiddenException);
    });

    it('deletes the DB record and the file on success', async () => {
      mockPrismaService.prisma.listingImage.findUnique.mockResolvedValue(mockImage);
      mockPrismaService.prisma.listingImage.delete.mockResolvedValue(mockImage);
      (fsPromises.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.removeImage(1, 10, 1);

      expect(mockPrismaService.prisma.listingImage.delete).toHaveBeenCalledWith({
        where: { id: 10 },
      });
      expect(fsPromises.unlink).toHaveBeenCalled();
      expect(result.message).toContain('10');
    });

    it('silently ignores ENOENT when the file is already missing from disk', async () => {
      mockPrismaService.prisma.listingImage.findUnique.mockResolvedValue(mockImage);
      mockPrismaService.prisma.listingImage.delete.mockResolvedValue(mockImage);

      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      (fsPromises.unlink as jest.Mock).mockRejectedValue(enoentError);

      // Should NOT throw even though unlink failed with ENOENT
      await expect(service.removeImage(1, 10, 1)).resolves.toBeDefined();
    });
  });
});
