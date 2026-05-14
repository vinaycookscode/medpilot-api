import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig } from 'axios';
import { v4 as uuid } from 'uuid';

const TOKEN_KEY = 'abdm:access-token';

@Injectable()
export class AbdmGatewayClient {
  private readonly logger = new Logger(AbdmGatewayClient.name);

  private readonly gatewayBaseUrl: string;
  private readonly abhaBaseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly cmId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.gatewayBaseUrl = this.config.get<string>('abdm.gatewayUrl')!;
    this.abhaBaseUrl    = this.config.get<string>('abdm.abhaBaseUrl')!;
    this.clientId       = this.config.get<string>('abdm.clientId')!;
    this.clientSecret   = this.config.get<string>('abdm.clientSecret')!;
    this.cmId           = this.config.get<string>('abdm.cmId')!;
  }

  async getAccessToken(): Promise<string> {
    const cached = await this.redis.get(TOKEN_KEY);
    if (cached) return cached;

    try {
      // V3 session endpoint
      const res = await firstValueFrom(
        this.http.post(
          `${this.gatewayBaseUrl}/api/hiecm/gateway/v3/sessions`,
          {
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            grantType: 'client_credentials',
          },
          {
            headers: {
              'REQUEST-ID': uuid(),
              'TIMESTAMP': new Date().toISOString(),
              'X-CM-ID': this.cmId,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const { accessToken, expiresIn } = res.data;
      await this.redis.setex(TOKEN_KEY, (expiresIn ?? 1800) - 30, accessToken);
      return accessToken;
    } catch (err: any) {
      this.logger.error('ABDM session fetch failed', err?.response?.data);
      throw new ServiceUnavailableException('ABDM gateway unavailable');
    }
  }

  private buildHeaders(token: string, xToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'REQUEST-ID': uuid(),
      'TIMESTAMP': new Date().toISOString(),
    };
    if (xToken) headers['X-Token'] = `Bearer ${xToken}`;
    return headers;
  }

  async abhaPost<T>(path: string, body: unknown, xToken?: string): Promise<T> {
    const token = await this.getAccessToken();
    const headers = this.buildHeaders(token, xToken);

    try {
      const res = await firstValueFrom(
        this.http.post<T>(`${this.abhaBaseUrl}${path}`, body, { headers }),
      );
      return res.data;
    } catch (err: any) {
      this.logger.error(`ABHA POST ${path} failed`, err?.response?.data);
      throw this.mapError(err);
    }
  }

  async abhaGet<T>(path: string, xToken?: string, extraHeaders?: Record<string, string>): Promise<T> {
    const token = await this.getAccessToken();
    const headers = { ...this.buildHeaders(token, xToken), ...extraHeaders };

    const config: AxiosRequestConfig = { headers };

    try {
      const res = await firstValueFrom(
        this.http.get<T>(`${this.abhaBaseUrl}${path}`, config),
      );
      return res.data;
    } catch (err: any) {
      this.logger.error(`ABHA GET ${path} failed`, err?.response?.data);
      throw this.mapError(err);
    }
  }

  async abhaGetBinary(path: string, xToken: string): Promise<Buffer> {
    const token = await this.getAccessToken();
    const res = await firstValueFrom(
      this.http.get(`${this.abhaBaseUrl}${path}`, {
        headers: {
          ...this.buildHeaders(token, xToken),
        },
        responseType: 'arraybuffer',
      }),
    );
    return Buffer.from(res.data);
  }

  private mapError(err: any): never {
    const status = err?.response?.status;
    const data   = err?.response?.data;
    const msg    = data?.error?.message ?? data?.details?.[0]?.message ?? data?.message;

    if (status === 400) throw new BadRequestException(msg ?? 'Invalid request to ABDM');
    if (status === 422) throw new BadRequestException(msg ?? 'ABDM validation error');
    if (status === 429) throw new BadRequestException('ABDM rate limit exceeded — try again shortly');
    if (status === 404) throw new BadRequestException(msg ?? 'ABDM: resource not found');
    throw new ServiceUnavailableException('ABDM gateway error');
  }
}
