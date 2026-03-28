import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Listing, Prisma } from '../../generated/prisma/client.js';
import type { CreateListingDto } from './dto/create-listing.dto.js';
import type { UpdateListingDto } from './dto/update-listing.dto.js';
import type { GetListingsQueryDto } from './dto/get-listings-query.dto.js';
import { Condition } from './condition.enum.js';
import { ListingStatus } from './listing-status.enum.js';

// Shape of a listing returned to the client — includes owner's public info and images
export interface ListingWithOwner extends Listing {
  owner: {
    id: number;
    username: string;
  };
  images: { id: number; url: string; order: number }[];
}

// Paginated response envelope returned by findAll()
export interface PaginatedListings {
  data: ListingWithOwner[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ListingsService {
  constructor(private readonly prismaService: PrismaService) {}

  // ── GET ALL (with search / filter / pagination) ───────────────────────────
  // Public endpoint. Accepts optional query params:
  //   search    — full-text on title + description (case-insensitive OR)
  //   condition — exact enum match
  //   brand     — partial, case-insensitive
  //   minPrice / maxPrice — inclusive price range
  //   page / limit — 1-based pagination (defaults: page=1, limit=12)
  async findAll(query: GetListingsQueryDto): Promise<PaginatedListings> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;

    // Build the where clause dynamically — only include a filter when the
    // corresponding query param was actually provided.
    const where: Prisma.ListingWhereInput = {};

    // Public browse only shows listings that are currently available.
    where.status = ListingStatus.active;

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.condition) {
      where.condition = query.condition;
    }

    if (query.brand) {
      where.brand = { contains: query.brand, mode: 'insensitive' };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }

    const includeOwner = {
      owner: { select: { id: true, username: true } },
      images: { orderBy: { order: 'asc' as const } },
    };

    // Run data query and count in parallel — both use the same where clause
    const [data, total] = await Promise.all([
      this.prismaService.prisma.listing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: includeOwner,
      }),
      this.prismaService.prisma.listing.count({ where }),
    ]);

    return {
      data: data as ListingWithOwner[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── GET MINE ──────────────────────────────────────────────────────────────
  // Returns only the listings belonging to the authenticated user.
  async findByOwner(ownerId: number): Promise<ListingWithOwner[]> {
    return this.prismaService.prisma.listing.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: { id: true, username: true } },
        images: { orderBy: { order: 'asc' } },
      },
    });
  }

  // ── GET ONE ───────────────────────────────────────────────────────────────
  // Returns a single listing by ID.
  // Throws 404 if not found — caller should not have to handle null.
  async findOne(id: number): Promise<ListingWithOwner> {
    const listing = await this.prismaService.prisma.listing.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true } },
        images: { orderBy: { order: 'asc' } },
      },
    });

    if (!listing) {
      throw new NotFoundException(`Listing #${id} not found`);
    }

    return listing;
  }

  // ── CREATE ────────────────────────────────────────────────────────────────
  // Creates a new listing and sets ownerId from the JWT-authenticated user.
  // The ownerId is injected by the controller from req.user — never from the request body.
  async create(dto: CreateListingDto, ownerId: number): Promise<ListingWithOwner> {
    return this.prismaService.prisma.listing.create({
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        brand: dto.brand,
        condition: dto.condition,
        location: dto.location,
        ownerId,
      },
      include: {
        owner: { select: { id: true, username: true } },
        images: { orderBy: { order: 'asc' } },
      },
    });
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  // Updates an existing listing.
  // Ownership check: throws 403 if the authenticated user is not the owner.
  async update(
    id: number,
    dto: UpdateListingDto,
    requesterId: number,
  ): Promise<ListingWithOwner> {
    // First verify the listing exists (throws 404 if not)
    const listing = await this.findOne(id);

    // Authorization check: only the owner may edit their own listing
    if (listing.ownerId !== requesterId) {
      throw new ForbiddenException('You are not allowed to edit this listing');
    }

    return this.prismaService.prisma.listing.update({
      where: { id },
      data: {
        // Only include fields that were actually sent — undefined values are ignored by Prisma
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.brand !== undefined && { brand: dto.brand }),
        ...(dto.condition !== undefined && { condition: dto.condition }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.location !== undefined && { location: dto.location }),
      },
      include: {
        owner: { select: { id: true, username: true } },
        images: { orderBy: { order: 'asc' } },
      },
    });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  // Deletes a listing.
  // Ownership check: throws 403 if the authenticated user is not the owner.
  async remove(id: number, requesterId: number): Promise<{ message: string }> {
    // First verify the listing exists (throws 404 if not)
    const listing = await this.findOne(id);

    // Authorization check: only the owner may delete their own listing
    if (listing.ownerId !== requesterId) {
      throw new ForbiddenException('You are not allowed to delete this listing');
    }

    await this.prismaService.prisma.listing.delete({ where: { id } });

    return { message: `Listing #${id} deleted successfully` };
  }
}
