import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsUUID, IsOptional, IsString, IsBoolean, ValidateNested, ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LabResultItemDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAbnormal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateLabResultDto {
  @ApiProperty({ type: [LabResultItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => LabResultItemDto)
  items: LabResultItemDto[];
}
