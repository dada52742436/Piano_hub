import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  offeredPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
