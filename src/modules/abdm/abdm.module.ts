import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import abdmConfig from './config/abdm.config';
import { AbdmGatewayClient } from './gateway/abdm-gateway.client';
import { AbhaSessionService } from './services/abha-session.service';
import { AbhaEncryptionService } from './services/abha-encryption.service';
import { AbhaIdentityService } from './services/abha-identity.service';
import { AbhaIdentityController } from './controllers/abha-identity.controller';
import { Patient } from '../patients/entities/patient.entity';

@Module({
  imports: [
    ConfigModule.forFeature(abdmConfig),
    HttpModule.register({ timeout: 15000 }),
    TypeOrmModule.forFeature([Patient]),
  ],
  controllers: [AbhaIdentityController],
  providers: [
    AbdmGatewayClient,
    AbhaSessionService,
    AbhaEncryptionService,
    AbhaIdentityService,
  ],
  exports: [AbhaIdentityService],
})
export class AbdmModule {}
