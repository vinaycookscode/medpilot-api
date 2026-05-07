import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsDateString, IsEnum, IsOptional,
  IsUUID, Matches,
} from 'class-validator';
import { AppointmentType } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty()
  @IsUUID()
  doctorId: string;

  @ApiProperty({ example: '2024-11-15' })
  @IsDateString()
  appointmentDate: string;

  @ApiProperty({ example: '10:20' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be HH:MM format' })
  startTime: string;

  @ApiPropertyOptional({ enum: AppointmentType, default: AppointmentType.NEW_PATIENT })
  @IsOptional()
  @IsEnum(AppointmentType)
  appointmentType?: AppointmentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
