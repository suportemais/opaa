import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PlansModule } from '../plans/plans.module';
import { RbacModule } from '../rbac/rbac.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [RbacModule, PlansModule, AuditModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
