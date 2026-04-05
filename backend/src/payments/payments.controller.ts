import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import type { User } from '../../generated/prisma/client.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { SimulatePaymentDto } from './dto/simulate-payment.dto.js';
import { PaymentsService } from './payments.service.js';

interface AuthenticatedRequest extends Request {
  user: User;
}

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('transactions/:transactionId/payments')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() dto: CreatePaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentsService.create(transactionId, req.user.id, dto);
  }

  @Get('payments/mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req: AuthenticatedRequest) {
    return this.paymentsService.findMine(req.user.id);
  }

  @Get('transactions/:transactionId/payments')
  @UseGuards(JwtAuthGuard)
  findByTransaction(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentsService.findByTransaction(transactionId, req.user.id);
  }

  @Patch('payments/:id/simulate')
  @UseGuards(JwtAuthGuard)
  simulateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SimulatePaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.paymentsService.simulateStatus(id, dto.status, req.user.id);
  }
}
