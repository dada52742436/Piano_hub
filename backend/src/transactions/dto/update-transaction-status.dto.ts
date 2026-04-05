import { IsEnum } from 'class-validator';
import { TransactionStatus } from '../transaction-status.enum.js';

export class UpdateTransactionStatusDto {
  @IsEnum(TransactionStatus)
  status!: TransactionStatus;
}
