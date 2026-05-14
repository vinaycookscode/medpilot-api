import {
  Controller, Post, Get, Delete, Body, Param, Res,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../users/enums/user-role.enum';
import { AbhaIdentityService } from '../services/abha-identity.service';
import {
  InitiateAadhaarOtpDto, EnrollAbhaDto, SelectAbhaAddressDto,
  InitiateVerifyDto, VerifyLoginOtpDto, InitiateDLOtpDto,
} from '../dto/abha-identity.dto';

@ApiTags('ABHA — Identity (M1)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('abha')
export class AbhaIdentityController {
  constructor(private readonly abhaService: AbhaIdentityService) {}

  // ─── ABHA Creation — Aadhaar OTP ─────────────────────────────────────────

  @Post('patients/:patientId/create/aadhaar/initiate')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'M1 Step 1: Send OTP to Aadhaar-linked mobile (with patient link)' })
  async initiateAadhaarOtpForPatient(
    @Param('patientId') patientId: string,
    @Body() dto: InitiateAadhaarOtpDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.abhaService.initiateAadhaarOtp(patientId, user.clinicId, user.sub, dto);
  }

  @Post('create/aadhaar/initiate')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'M1 Step 1: Send OTP to Aadhaar-linked mobile (standalone)' })
  async initiateAadhaarOtp(
    @Body() dto: InitiateAadhaarOtpDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.abhaService.initiateAadhaarOtp(null, user.clinicId, user.sub, dto);
  }

  @Post('create/aadhaar/enroll')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M1 Step 2: Submit OTP + enroll ABHA (single call per ABDM v3 spec)' })
  async enrollAbha(@Body() dto: EnrollAbhaDto) {
    return this.abhaService.enrollAbha(dto);
  }

  // ─── ABHA Address ─────────────────────────────────────────────────────────

  @Post('create/address')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'M1: Select and create ABHA address after enrollment' })
  async createAbhaAddress(@Body() dto: SelectAbhaAddressDto) {
    return this.abhaService.createAbhaAddress(dto);
  }

  // ─── ABHA Card Download ───────────────────────────────────────────────────

  @Get('patients/:patientId/card')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'M1: Download ABHA card as PNG' })
  async downloadAbhaCard(
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const buffer = await this.abhaService.downloadAbhaCard(patientId, user.clinicId);
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="abha-card-${patientId}.png"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ─── ABHA Verification ────────────────────────────────────────────────────

  @Post('verify/initiate')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'M1: Initiate ABHA verification — send OTP to patient mobile' })
  async initiateVerification(
    @Body() dto: InitiateVerifyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.abhaService.initiateVerification(dto, user.clinicId, user.sub);
  }

  @Post('verify/confirm')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M1: Verify OTP and fetch ABHA profile — returns new/returning patient status' })
  async verifyLoginOtp(@Body() dto: VerifyLoginOtpDto) {
    return this.abhaService.verifyLoginOtp(dto);
  }

  // ─── Patient ABHA Profile ─────────────────────────────────────────────────

  @Get('patients/:patientId/profile')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'Get ABHA status for a patient' })
  async getAbhaProfile(
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.abhaService.getAbhaProfile(patientId, user.clinicId);
  }

  @Delete('patients/:patientId/unlink')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink ABHA from patient (admin only)' })
  async unlinkAbha(
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.abhaService.unlinkAbha(patientId, user.clinicId);
  }

  // ─── Driving License (Optional) ───────────────────────────────────────────

  @Post('create/dl/initiate')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @ApiOperation({ summary: 'M1 Optional: Initiate ABHA creation via Driving License' })
  async initiateDLOtp(
    @Body() dto: InitiateDLOtpDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.abhaService.initiateDLOtp(null, user.clinicId, user.sub, dto);
  }

  @Post('create/dl/enroll')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'M1 Optional: Submit DL OTP and enroll ABHA' })
  async enrollViaDL(@Body() dto: EnrollAbhaDto) {
    return this.abhaService.enrollAbha(dto);  // same enrollment flow, txnId-driven
  }
}
