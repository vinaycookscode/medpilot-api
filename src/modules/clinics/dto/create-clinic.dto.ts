import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, Length } from 'class-validator';

export class CreateClinicDto {
  @ApiProperty({ example: 'City Dental Clinic' })
  @IsString()
  @Length(2, 255)
  name: string;

  @ApiProperty({ example: 'city-dental-clinic' })
  @IsString()
  @Length(2, 100)
  slug: string;

  @ApiProperty({ example: 'dental', enum: ['dental', 'skin', 'physio', 'general', 'diagnostic'] })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gstRegistered?: boolean;
}
