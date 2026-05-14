import { IsString, IsNotEmpty, IsOptional, IsEnum, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbhaLoginHint } from '../enums/abha.enums';

export class InitiateAadhaarOtpDto {
  @ApiProperty({ description: '12-digit Aadhaar number — encrypted before sending to ABDM, never stored' })
  @IsString()
  @Length(12, 12)
  @Matches(/^\d{12}$/)
  aadhaar: string;
}

export class InitiateDLOtpDto {
  @ApiProperty({ description: 'Driving License number' })
  @IsString()
  @IsNotEmpty()
  dlNumber: string;

  @ApiProperty({ description: 'Date of birth on DL (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dob: string;
}

// Combined OTP verify + enroll — official ABDM v3 does this in a single call
export class EnrollAbhaDto {
  @ApiProperty({ description: 'Session token returned from initiate step' })
  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @ApiProperty({ description: '6-digit OTP received on Aadhaar-linked mobile' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;

  @ApiPropertyOptional({ description: '10-digit mobile to link (if different from Aadhaar-linked mobile)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/)
  mobile?: string;
}

export class SelectAbhaAddressDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @ApiProperty({ description: 'Chosen ABHA address (from suggestions or custom)' })
  @IsString()
  @IsNotEmpty()
  abhaAddress: string;
}

export class InitiateVerifyDto {
  @ApiProperty({ enum: AbhaLoginHint, description: 'abha-number, mobile, or aadhaar' })
  @IsEnum(AbhaLoginHint)
  loginHint: AbhaLoginHint;

  @ApiProperty({ description: 'ABHA number, Aadhaar number, or mobile — encrypted before sending to ABDM' })
  @IsString()
  @IsNotEmpty()
  loginId: string;
}

export class VerifyLoginOtpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;
}
