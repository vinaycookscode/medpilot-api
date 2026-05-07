import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsString, IsOptional, Length } from 'class-validator';
import { VitalType } from '../entities/patient-vital.entity';

export class AddVitalDto {
  @ApiProperty({ enum: VitalType })
  @IsEnum(VitalType)
  vitalType: VitalType;

  @ApiProperty({ example: 120 })
  @IsNumber()
  value: number;

  @ApiProperty({ example: 'mmHg' })
  @IsString()
  @Length(1, 20)
  unit: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
