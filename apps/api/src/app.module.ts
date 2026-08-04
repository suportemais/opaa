import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { UnitsModule } from './units/units.module';
import { SurveysModule } from './surveys/surveys.module';
import { PublicModule } from './public/public.module';
import { AuditModule } from './audit/audit.module';
import { PrismaModule } from './prisma/prisma.module';
import { FeedbacksModule } from './feedbacks/feedbacks.module';
import { MetricsModule } from './metrics/metrics.module';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RbacModule,
    OnboardingModule,
    UnitsModule,
    SurveysModule,
    PublicModule,
    AuditModule,
    FeedbacksModule,
    MetricsModule,
    CustomersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
