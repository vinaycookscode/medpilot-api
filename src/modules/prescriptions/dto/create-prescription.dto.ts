import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsUUID, IsOptional, IsDateString,
  IsArray, ValidateNested, IsInt, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PrescriptionMedicineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  medicineId?: string;

  @ApiProperty({ example: 'Amoxicillin 500mg' })
  @IsString()
  medicineName: string;

  @ApiProperty({ example: '1 capsule' })
  @IsString()
  dosage: string;

  @ApiProperty({ example: 'Three times daily' })
  @IsString()
  frequency: string;

  @ApiProperty({ example: '5 days' })
  @IsString()
  duration: string;

  @ApiPropertyOptional({ example: 'After meals' })
  @IsOptional()
  @IsString()
  timing?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class PrescriptionTestDto {
  @ApiProperty({ example: 'Complete Blood Count' })
  @IsString()
  testName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreatePrescriptionDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({ example: 'Dental caries, upper right molar' })
  @IsString()
  diagnosis: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  examinationNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  advice?: string;

  @ApiPropertyOptional({ example: '2024-11-22' })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  followUpNotes?: string;

  @ApiPropertyOptional({ type: [PrescriptionMedicineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines?: PrescriptionMedicineDto[];

  @ApiPropertyOptional({ type: [PrescriptionTestDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionTestDto)
  tests?: PrescriptionTestDto[];

  @ApiPropertyOptional()
  @IsOptional()
  vitalsSnapshot?: Record<string, unknown>;
}
