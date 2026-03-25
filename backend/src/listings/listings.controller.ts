import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ListingsService } from './listings.service.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { GetListingsQueryDto } from './dto/get-listings-query.dto.js';
import type { User } from '../../generated/prisma/client.js';

// Extend Express Request to type req.user injected by JwtStrategy
interface AuthenticatedRequest extends Request {
  user: User;
}

// All routes are prefixed with /listings (registered in ListingsModule)
@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  // ── GET /listings ────────────────────────────────────────────
  // Public: anyone can browse all listings, no token required.
  // Accepts optional query params: search, condition, brand, minPrice,
  // maxPrice, page, limit — all validated by GetListingsQueryDto.
  @Get()
  @ApiOperation({ summary: 'Browse all listings (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Returns paginated listings' })
  findAll(@Query() query: GetListingsQueryDto) {
    return this.listingsService.findAll(query);
  }

  // ── GET /listings/mine ──────────────────────────────────────────
  // Protected: returns only the listings owned by the current user.
  // IMPORTANT: this route MUST be declared before GET /listings/:id,
  // otherwise NestJS would try to parse "mine" as a numeric :id param.
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get the current user's own listings" })
  @ApiResponse({ status: 200, description: 'Array of listings belonging to the logged-in user' })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  findMine(@Req() req: AuthenticatedRequest) {
    return this.listingsService.findByOwner(req.user.id);
  }

  // ── GET /listings/:id ────────────────────────────────────────────
  // Public: view a single listing's detail page, no token required.
  // ParseIntPipe ensures the :id param is a valid integer (returns 400 otherwise)
  @Get(':id')
  @ApiOperation({ summary: 'Get a single listing by ID' })
  @ApiResponse({ status: 200, description: 'The requested listing' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.listingsService.findOne(id);
  }

  // ── POST /listings ────────────────────────────────────────────
  // Protected: create a new listing.
  // ownerId is taken from req.user (JWT), never from the request body.
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new listing (owner only)' })
  @ApiResponse({ status: 201, description: 'Listing created' })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  create(
    @Body() dto: CreateListingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listingsService.create(dto, req.user.id);
  }

  // ── PATCH /listings/:id ───────────────────────────────────────────
  // Protected: edit an existing listing.
  // Service will throw 403 if req.user is not the owner.
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a listing (owner only)' })
  @ApiResponse({ status: 200, description: 'Updated listing' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the owner' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateListingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listingsService.update(id, dto, req.user.id);
  }

  // ── DELETE /listings/:id ───────────────────────────────────────────
  // Protected: delete a listing.
  // Returns 200 with a message (not 204) so the client gets confirmation text.
  // Service will throw 403 if req.user is not the owner.
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a listing (owner only)' })
  @ApiResponse({ status: 200, description: 'Listing deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden — not the owner' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.listingsService.remove(id, req.user.id);
  }
}
