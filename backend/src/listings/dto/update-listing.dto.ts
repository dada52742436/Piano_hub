import {
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  IsEnum,
} from 'class-validator';
import { Condition } from '../condition.enum.js';
import { ListingStatus } from '../listing-status.enum.js';

// All fields are optional for PATCH — caller only sends what they want to change.
// This is the standard partial-update pattern; we avoid PartialType from @nestjs/mapped-types
// to keep the module dependency surface minimal.
export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  brand?: string;

  @IsOptional()
  @IsEnum(Condition, {
    message: `condition must be one of: ${Object.values(Condition).join(', ')}`,
  })
  condition?: Condition;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsEnum(ListingStatus, {
    message: `status must be one of: ${Object.values(ListingStatus).join(', ')}`,
  })
  status?: ListingStatus;
}
