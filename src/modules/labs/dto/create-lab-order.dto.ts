import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsArray, IsOptional, IsString, ArrayNotEmpty } from 'class-validator';

export class CreateLabOrderDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({ type: [String], description: 'Array of lab test catalog UUIDs' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  testIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
