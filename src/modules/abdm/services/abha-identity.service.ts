import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { AbdmGatewayClient } from '../gateway/abdm-gateway.client';
import { AbhaSessionService } from './abha-session.service';
import { AbhaEncryptionService } from './abha-encryption.service';
import {
  AbhaFlowStep, AbhaFlowType, AbhaKycType, AbhaLoginHint,
} from '../enums/abha.enums';
import {
  InitiateAadhaarOtpDto, EnrollAbhaDto, SelectAbhaAddressDto,
  InitiateVerifyDto, VerifyLoginOtpDto, InitiateDLOtpDto,
} from '../dto/abha-identity.dto';

@Injectable()
export class AbhaIdentityService {
  private readonly logger = new Logger(AbhaIdentityService.name);

  constructor(
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    private readonly gateway: AbdmGatewayClient,
    private readonly session: AbhaSessionService,
    private readonly encryption: AbhaEncryptionService,
  ) {}

  // ─── M1: ABHA Creation via Aadhaar OTP ───────────────────────────────────

  async initiateAadhaarOtp(
    patientId: string | null,
    clinicId: string,
    initiatedBy: string,
    dto: InitiateAadhaarOtpDto,
  ): Promise<{ sessionToken: string; message: string }> {
    await this.session.checkRateLimit(`${clinicId}:${initiatedBy}:aadhaar-otp`);

    const encryptedAadhaar = await this.encryption.encrypt(dto.aadhaar);

    const res = await this.gateway.abhaPost<{ txnId: string; message: string }>(
      '/v3/enrollment/request/otp',
      {
        txnId: '',
        scope: ['abha-enrol'],
        loginHint: 'aadhaar',
        loginId: encryptedAadhaar,
        otpSystem: 'aadhaar',
      },
    );

    const sessionToken = await this.session.createSession({
      txnId: res.txnId,
      step: AbhaFlowStep.OTP_SENT,
      flowType: AbhaFlowType.AADHAAR_OTP,
      patientId,
      clinicId,
      initiatedBy,
      attempts: 0,
    });

    this.logger.log(`ABHA Aadhaar OTP initiated txnId=${res.txnId} clinic=${clinicId}`);

    return { sessionToken, message: res.message };
  }

  // Combined OTP verify + enroll — ABDM v3 does this in a single /enrol/byAadhaar call
  async enrollAbha(dto: EnrollAbhaDto): Promise<{
    abhaNumber: string;
    abhaAddress: string | null;
    name: string;
    mobile: string | null;
    gender: string;
    isNew: boolean;
    sessionToken: string;
    suggestions?: string[];
  }> {
    const s = await this.session.getSession(dto.sessionToken);
    if (s.step !== AbhaFlowStep.OTP_SENT) throw new BadRequestException('OTP flow not initiated');

    await this.session.incrementAttempts(dto.sessionToken);

    const encryptedOtp = await this.encryption.encrypt(dto.otp);

    const res = await this.gateway.abhaPost<{
      message: string;
      txnId: string;
      tokens: { token: string; expiresIn: number; refreshToken: string; refreshExpiresIn: number };
      ABHAProfile: {
        ABHANumber: string;
        firstName: string;
        lastName: string;
        middleName?: string;
        dob: string;
        mobile: string | null;
        gender: string;
        phrAddress: string[];
        abhaStatus: string;
      };
      isNew: boolean;
    }>(
      '/v3/enrollment/enrol/byAadhaar',
      {
        authData: {
          authMethods: ['otp'],
          otp: {
            txnId: s.txnId,
            otpValue: encryptedOtp,
            ...(dto.mobile ? { mobile: dto.mobile } : {}),
          },
        },
        consent: { code: 'abha-enrollment', version: '1.4' },
      },
    );

    const profile = res.ABHAProfile;
    const abhaAddress = profile.phrAddress?.[0] ?? null;
    const xToken = res.tokens?.token;

    if (s.patientId) {
      await this.patientRepo.update(s.patientId, {
        abhaNumber: profile.ABHANumber,
        abhaAddress: abhaAddress,
        abhaVerified: true,
        abhaKycType: AbhaKycType.AADHAAR,
        abhaLinkedAt: new Date(),
      } as any);
    }

    const newSessionToken = await this.session.updateSession(dto.sessionToken, {
      txnId: res.txnId,
      step: AbhaFlowStep.ENROLLED,
      xToken,
    });

    let suggestions: string[] | undefined;
    if (!abhaAddress && xToken) {
      suggestions = await this.getAbhaAddressSuggestions(res.txnId, xToken);
    }

    this.logger.log(`ABHA enrollment complete ABHANumber=${profile.ABHANumber} patient=${s.patientId}`);

    return {
      abhaNumber: this.maskAbhaNumber(profile.ABHANumber),
      abhaAddress,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      mobile: profile.mobile ?? null,
      gender: profile.gender,
      isNew: res.isNew,
      sessionToken: newSessionToken,
      suggestions,
    };
  }

  // ─── M1: ABHA Address Selection ──────────────────────────────────────────

  async getAbhaAddressSuggestions(txnId: string, xToken: string): Promise<string[]> {
    try {
      const res = await this.gateway.abhaGet<{ abhaAddressList: string[] }>(
        '/v3/enrollment/enrol/suggestion',
        xToken,
        { 'Transaction_Id': txnId },  // official doc: Transaction_Id is a header, not query param
      );
      return res.abhaAddressList ?? [];
    } catch {
      return [];
    }
  }

  async createAbhaAddress(dto: SelectAbhaAddressDto): Promise<{ abhaAddress: string }> {
    const s = await this.session.getSession(dto.sessionToken);
    if (s.step !== AbhaFlowStep.ENROLLED) throw new BadRequestException('Enrollment must be complete first');
    if (!s.xToken) throw new BadRequestException('Patient token missing — re-enroll');

    const res = await this.gateway.abhaPost<{ txnId: string; healthId: string }>(
      '/v3/enrollment/enrol/abha-address',
      { txnId: s.txnId, abhaAddress: dto.abhaAddress },
      s.xToken,
    );

    if (s.patientId) {
      await this.patientRepo.update(s.patientId, { abhaAddress: res.healthId } as any);
    }

    await this.session.deleteSession(dto.sessionToken);
    return { abhaAddress: res.healthId };
  }

  // ─── M1: ABHA Card Download ───────────────────────────────────────────────

  async downloadAbhaCard(patientId: string, clinicId: string): Promise<Buffer> {
    const patient = await this.patientRepo
      .createQueryBuilder('p')
      .addSelect('p.abhaXToken')
      .where('p.id = :id AND p.clinicId = :clinicId', { id: patientId, clinicId })
      .getOne();

    if (!patient) throw new NotFoundException('Patient not found');
    if (!(patient as any).abhaNumber) throw new BadRequestException('Patient does not have an ABHA number');

    const xToken = (patient as any).abhaXToken;
    if (!xToken) throw new BadRequestException('Patient ABHA session expired — please verify ABHA first');

    return this.gateway.abhaGetBinary('/v3/profile/account/abha-card', xToken);
  }

  // ─── M1: ABHA Verification ────────────────────────────────────────────────

  async initiateVerification(
    dto: InitiateVerifyDto,
    clinicId: string,
    initiatedBy: string,
    patientId?: string | null,
  ): Promise<{ sessionToken: string; message: string }> {
    await this.session.checkRateLimit(`${clinicId}:${initiatedBy}:verify`);

    const encryptedLoginId = await this.encryption.encrypt(dto.loginId);

    const { scope, otpSystem } = this.resolveLoginHintConfig(dto.loginHint);

    const res = await this.gateway.abhaPost<{ txnId: string; message: string }>(
      '/v3/profile/login/request/otp',
      {
        scope,
        loginHint: dto.loginHint,
        loginId: encryptedLoginId,
        otpSystem,
      },
    );

    const sessionToken = await this.session.createSession({
      txnId: res.txnId,
      step: AbhaFlowStep.OTP_SENT,
      flowType: AbhaFlowType.VERIFY_OTP,
      patientId: patientId ?? null,
      clinicId,
      initiatedBy,
      attempts: 0,
    });

    return { sessionToken, message: res.message };
  }

  async verifyLoginOtp(dto: VerifyLoginOtpDto): Promise<{
    abhaNumber: string;
    abhaAddress: string | null;
    name: string;
    gender: string;
    mobile: string | null;
    isNewPatient: boolean;
    patientId: string | null;
  }> {
    const s = await this.session.getSession(dto.sessionToken);
    if (s.step !== AbhaFlowStep.OTP_SENT) throw new BadRequestException('Invalid step');

    await this.session.incrementAttempts(dto.sessionToken);

    const encryptedOtp = await this.encryption.encrypt(dto.otp);

    const res = await this.gateway.abhaPost<{
      txnId: string;
      authResult: string;
      message: string;
      token: string;
      expiresIn: number;
      refreshToken: string;
      accounts: Array<{
        ABHANumber: string;
        preferredAbhaAddress: string;
        name: string;
        status: string;
        profilePhoto?: string;
      }>;
    }>(
      '/v3/profile/login/verify',
      {
        scope: ['abha-login', 'aadhaar-verify'],
        authData: {
          authMethods: ['otp'],
          otp: {
            txnId: s.txnId,
            otpValue: encryptedOtp,
          },
        },
      },
    );

    const account = res.accounts?.[0];
    if (!account) throw new BadRequestException('ABHA verification failed — no account found');

    const abhaNumber = account.ABHANumber;
    const abhaAddress = account.preferredAbhaAddress ?? null;

    // Check if this ABHA is already linked to a patient in this clinic
    const existing = await this.patientRepo.findOne({
      where: { abhaNumber, clinicId: s.clinicId } as any,
    });

    if (existing) {
      // Update x-token for card download on returning patient
      await this.patientRepo
        .createQueryBuilder()
        .update(Patient)
        .set({ abhaXToken: res.token } as any)
        .where('id = :id', { id: existing.id })
        .execute();
    } else if (s.patientId) {
      // Link ABHA to the patient who initiated verification from their profile
      await this.patientRepo.update(s.patientId, {
        abhaNumber,
        abhaAddress: account.preferredAbhaAddress ?? null,
        abhaVerified: true,
        abhaKycType: AbhaKycType.AADHAAR,
        abhaLinkedAt: new Date(),
        abhaXToken: res.token,
      } as any);
    }

    await this.session.deleteSession(dto.sessionToken);

    return {
      abhaNumber: this.maskAbhaNumber(abhaNumber),
      abhaAddress,
      name: account.name,
      gender: '',  // not in accounts list; fetch /v3/profile/account if needed
      mobile: null,
      isNewPatient: !existing,
      patientId: existing?.id ?? s.patientId ?? null,
    };
  }

  // ─── M1: Profile / ABHA status on patient ────────────────────────────────

  async getAbhaProfile(patientId: string, clinicId: string) {
    const patient = await this.patientRepo.findOne({ where: { id: patientId, clinicId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const p = patient as any;
    return {
      hasAbha: !!p.abhaNumber,
      abhaNumber: p.abhaNumber ? this.maskAbhaNumber(p.abhaNumber) : null,
      abhaAddress: p.abhaAddress ?? null,
      verified: p.abhaVerified ?? false,
      kycType: p.abhaKycType ?? null,
      linkedAt: p.abhaLinkedAt ?? null,
    };
  }

  async unlinkAbha(patientId: string, clinicId: string): Promise<void> {
    const patient = await this.patientRepo.findOne({ where: { id: patientId, clinicId } });
    if (!patient) throw new NotFoundException('Patient not found');
    if (!(patient as any).abhaNumber) throw new BadRequestException('Patient has no ABHA linked');

    await this.patientRepo.update(patientId, {
      abhaNumber: null,
      abhaAddress: null,
      abhaVerified: false,
      abhaKycType: null,
      abhaLinkedAt: null,
    } as any);
  }

  // ─── Driving License (Optional) ───────────────────────────────────────────

  async initiateDLOtp(
    patientId: string | null,
    clinicId: string,
    initiatedBy: string,
    dto: InitiateDLOtpDto,
  ): Promise<{ sessionToken: string; message: string }> {
    await this.session.checkRateLimit(`${clinicId}:${initiatedBy}:dl-otp`);

    const encryptedDL = await this.encryption.encrypt(dto.dlNumber);

    const res = await this.gateway.abhaPost<{ txnId: string; message: string }>(
      '/v3/enrollment/request/otp',
      {
        txnId: '',
        scope: ['dl-flow'],
        loginHint: 'dl',
        loginId: encryptedDL,
        otpSystem: 'abdm',
      },
    );

    const sessionToken = await this.session.createSession({
      txnId: res.txnId,
      step: AbhaFlowStep.OTP_SENT,
      flowType: AbhaFlowType.DRIVING_LICENSE,
      patientId,
      clinicId,
      initiatedBy,
      attempts: 0,
    });

    return { sessionToken, message: res.message };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private resolveLoginHintConfig(hint: AbhaLoginHint): { scope: string[]; otpSystem: string } {
    switch (hint) {
      case AbhaLoginHint.ABHA_NUMBER:
        return { scope: ['abha-login', 'aadhaar-verify'], otpSystem: 'aadhaar' };
      case AbhaLoginHint.AADHAAR:
        return { scope: ['abha-login', 'aadhaar-verify'], otpSystem: 'aadhaar' };
      case AbhaLoginHint.MOBILE:
        return { scope: ['abha-login', 'mobile-verify'], otpSystem: 'abdm' };
      default:
        return { scope: ['abha-login', 'aadhaar-verify'], otpSystem: 'aadhaar' };
    }
  }

  private maskAbhaNumber(abha: string): string {
    const clean = abha.replace(/-/g, '');
    if (clean.length === 14) return `XX-XXXX-XXXX-${clean.slice(-4)}`;
    return abha;
  }
}
