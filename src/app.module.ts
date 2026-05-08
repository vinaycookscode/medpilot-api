import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { AuthModule } from './modules/auth/auth.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { BillingModule } from './modules/billing/billing.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InventoryModule } from './modules/inventory/inventory.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3000),
        // Accept either a DATABASE_URL or individual DB_* vars
        DATABASE_URL: Joi.string().optional(),
        DB_HOST: Joi.string().when('DATABASE_URL', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().when('DATABASE_URL', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
        DB_PASSWORD: Joi.string().when('DATABASE_URL', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
        DB_NAME: Joi.string().when('DATABASE_URL', { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): any => {
        const isProd = config.get('NODE_ENV') === 'production';
        const dbUrl = config.get<string>('DATABASE_URL');
        const base = {
          type: 'postgres',
          entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          synchronize: !isProd,
          logging: config.get('DB_LOGGING') === 'true',
          ssl: isProd ? { rejectUnauthorized: false } : false,
        };
        if (dbUrl) {
          return { ...base, url: dbUrl };
        }
        return {
          ...base,
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT'),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_NAME'),
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    AuthModule,
    ClinicsModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    PrescriptionsModule,
    BillingModule,
    DashboardModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
