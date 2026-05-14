import { registerAs } from '@nestjs/config';

export interface AbdmConfig {
  env: 'sandbox' | 'production';
  gatewayUrl: string;
  abhaBaseUrl: string;
  clientId: string;
  clientSecret: string;
  cmId: string;
  callbackBaseUrl: string;
}

export default registerAs('abdm', (): AbdmConfig => ({
  env: (process.env.ABDM_ENV as 'sandbox' | 'production') ?? 'sandbox',
  gatewayUrl: process.env.ABDM_GATEWAY_URL ?? 'https://dev.abdm.gov.in/gateway',
  abhaBaseUrl: process.env.ABDM_ABHA_BASE_URL ?? 'https://abhasbx.abdm.gov.in/abha/api',
  clientId: process.env.ABDM_CLIENT_ID ?? '',
  clientSecret: process.env.ABDM_CLIENT_SECRET ?? '',
  cmId: process.env.ABDM_CM_ID ?? 'sbx',
  callbackBaseUrl: process.env.ABDM_CALLBACK_BASE_URL ?? '',
}));
