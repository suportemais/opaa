import { Module } from '@nestjs/common';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { RbacModule } from '../rbac/rbac.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RbacModule, AuditModule],
  controllers: [SurveysController],
  providers: [SurveysService],
})
export class SurveysModule {}
