import { IsEnum } from 'class-validator';
import { PaymentStatus } from '../payment-status.enum.js';

export class SimulatePaymentDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
