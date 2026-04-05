import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerPaymentId?: string;
}
