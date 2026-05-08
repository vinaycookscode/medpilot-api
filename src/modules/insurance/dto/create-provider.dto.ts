import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsBoolean, Length } from 'class-validator';

export class CreateProviderDto {
  @ApiProperty({ example: 'Star Health Insurance' })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiProperty({ example: 'STAR' })
  @IsString()
  @Length(1, 50)
  code: string;

  @ApiPropertyOptional({ example: 'claims@starhealth.in' })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+91 98765 43210' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
