import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum StockFilter { ALL = 'all', LOW = 'low', OUT = 'out' }

export class InventoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: StockFilter })
  @IsOptional()
  @IsEnum(StockFilter)
  stock?: StockFilter;
}
