import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { publicEncrypt, constants } from 'crypto';
import { AbdmGatewayClient } from '../gateway/abdm-gateway.client';

const CERT_KEY = 'abdm:public-cert';

@Injectable()
export class AbhaEncryptionService {
  private readonly logger = new Logger(AbhaEncryptionService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly gateway: AbdmGatewayClient,
  ) {}

  async encrypt(plaintext: string): Promise<string> {
    const base64Key = await this.getPublicKey();
    // ABDM uses PKCS#8 DER public key — wrap in PEM
    const pem = [
      '-----BEGIN PUBLIC KEY-----',
      ...base64Key.match(/.{1,64}/g)!,
      '-----END PUBLIC KEY-----',
    ].join('\n');

    // Algorithm: RSA/ECB/OAEPWithSHA-1AndMGF1Padding
    const encrypted = publicEncrypt(
      {
        key: pem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1',
      },
      Buffer.from(plaintext),
    );
    return encrypted.toString('base64');
  }

  private async getPublicKey(): Promise<string> {
    const cached = await this.redis.get(CERT_KEY);
    if (cached) return cached;

    const res = await this.gateway.abhaGet<{ publicKey: string }>('/v3/profile/public/certificate');
    // Cache for 24 hours
    await this.redis.setex(CERT_KEY, 86400, res.publicKey);
    this.logger.log('Fetched and cached ABDM public certificate');
    return res.publicKey;
  }
}
