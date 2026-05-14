import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { createHmac, randomBytes } from 'crypto';
import { AbhaFlowStep, AbhaFlowType } from '../enums/abha.enums';

export interface AbhaOtpSession {
  txnId: string;
  step: AbhaFlowStep;
  flowType: AbhaFlowType;
  patientId: string | null;
  clinicId: string;
  initiatedBy: string;
  attempts: number;
  xToken?: string;  // patient token after successful enrolment
}

const SESSION_TTL = 900; // 15 minutes
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_TTL = 600; // 10 minutes
const RATE_LIMIT_MAX = 3;

@Injectable()
export class AbhaSessionService {
  private readonly hmacSecret: string;

  constructor(
    config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.hmacSecret = config.get<string>('JWT_SECRET')!;
  }

  async createSession(data: AbhaOtpSession): Promise<string> {
    const sessionId = randomBytes(16).toString('hex');
    await this.redis.setex(
      `abha:otp:${sessionId}`,
      SESSION_TTL,
      JSON.stringify(data),
    );
    return this.signSession(sessionId);
  }

  async getSession(sessionToken: string): Promise<AbhaOtpSession> {
    const sessionId = this.verifySession(sessionToken);
    const raw = await this.redis.get(`abha:otp:${sessionId}`);
    if (!raw) throw new UnauthorizedException('OTP session expired — please start over');
    return JSON.parse(raw) as AbhaOtpSession;
  }

  async updateSession(sessionToken: string, update: Partial<AbhaOtpSession>): Promise<string> {
    const sessionId = this.verifySession(sessionToken);
    const raw = await this.redis.get(`abha:otp:${sessionId}`);
    if (!raw) throw new UnauthorizedException('OTP session expired');

    const current = JSON.parse(raw) as AbhaOtpSession;
    const updated = { ...current, ...update };

    // Rotate session ID on step change for replay protection
    const newSessionId = randomBytes(16).toString('hex');
    await this.redis.setex(`abha:otp:${newSessionId}`, SESSION_TTL, JSON.stringify(updated));
    await this.redis.del(`abha:otp:${sessionId}`);
    return this.signSession(newSessionId);
  }

  async deleteSession(sessionToken: string): Promise<void> {
    const sessionId = this.verifySession(sessionToken);
    await this.redis.del(`abha:otp:${sessionId}`);
  }

  async incrementAttempts(sessionToken: string): Promise<number> {
    const sessionId = this.verifySession(sessionToken);
    const raw = await this.redis.get(`abha:otp:${sessionId}`);
    if (!raw) throw new UnauthorizedException('OTP session expired — please start over');

    const session = JSON.parse(raw) as AbhaOtpSession;
    if (session.attempts >= MAX_ATTEMPTS) {
      await this.redis.del(`abha:otp:${sessionId}`);
      throw new BadRequestException('Max OTP attempts exceeded — please restart');
    }
    session.attempts += 1;
    // Update in-place — do NOT rotate session ID here; rotation happens on successful state transitions
    await this.redis.setex(`abha:otp:${sessionId}`, SESSION_TTL, JSON.stringify(session));
    return session.attempts;
  }

  async checkRateLimit(key: string): Promise<void> {
    const rateLimitKey = `abha:ratelimit:${key}`;
    const count = await this.redis.incr(rateLimitKey);
    if (count === 1) await this.redis.expire(rateLimitKey, RATE_LIMIT_TTL);
    if (count > RATE_LIMIT_MAX) {
      throw new BadRequestException('Too many OTP requests — please wait 10 minutes');
    }
  }

  private signSession(sessionId: string): string {
    const sig = createHmac('sha256', this.hmacSecret).update(sessionId).digest('hex');
    return `${sessionId}.${sig}`;
  }

  private verifySession(token: string): string {
    const [sessionId, sig] = token.split('.');
    if (!sessionId || !sig) throw new UnauthorizedException('Invalid session token');
    const expected = createHmac('sha256', this.hmacSecret).update(sessionId).digest('hex');
    if (sig !== expected) throw new UnauthorizedException('Tampered session token');
    return sessionId;
  }
}
