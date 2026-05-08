import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { LeaveType } from '../entities/staff-leave.entity';

export class CreateLeaveDto {
  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @ApiProperty({ example: '2026-05-10' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-05-12' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
