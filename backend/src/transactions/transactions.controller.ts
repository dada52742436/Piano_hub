import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import type { User } from '../../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto.js';
import { TransactionsService } from './transactions.service.js';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('listings/:listingId/transactions')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('listingId', ParseIntPipe) listingId: number,
    @Body() dto: CreateTransactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.transactionsService.create(listingId, req.user.id, dto);
  }

  @Get('transactions/mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req: AuthenticatedRequest) {
    return this.transactionsService.findMine(req.user.id);
  }

  @Get('listings/:listingId/transactions')
  @UseGuards(JwtAuthGuard)
  findByListing(
    @Param('listingId', ParseIntPipe) listingId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.transactionsService.findByListing(listingId, req.user.id);
  }

  @Patch('transactions/:id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.transactionsService.updateStatus(id, dto.status, req.user.id);
  }

  @Patch('transactions/:id/refund')
  @UseGuards(JwtAuthGuard)
  sellerRefund(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.transactionsService.sellerRefund(id, req.user.id);
  }
}
