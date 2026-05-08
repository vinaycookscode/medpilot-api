import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID, IsString, IsOptional, IsNumber, Min, Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClaimDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiProperty()
  @IsUUID()
  providerId: string;

  @ApiProperty({ example: 'POL-2024-001234' })
  @IsString()
  @Length(1, 100)
  policyNumber: string;

  @ApiProperty({ example: 'Priya Sharma' })
  @IsString()
  @Length(1, 200)
  memberName: string;

  @ApiProperty({ example: 15000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  claimAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
