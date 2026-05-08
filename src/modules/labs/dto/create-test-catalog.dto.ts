import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsEnum, IsOptional, IsNumber, IsBoolean, Length, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LabTestCategory } from '../entities/lab-test-catalog.entity';

export class CreateTestCatalogDto {
  @ApiProperty({ example: 'Complete Blood Count' })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiProperty({ enum: LabTestCategory })
  @IsEnum(LabTestCategory)
  category: LabTestCategory;

  @ApiPropertyOptional({ example: 'mg/dL' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  unit?: string;

  @ApiPropertyOptional({ example: '4.5–5.5 million/µL' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  normalRange?: string;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
