import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { MmIntegrationsController } from './mm-integrations.controller';
import { MmIntegrationsService } from './mm-integrations.service';

@Module({
  imports: [RbacModule],
  controllers: [MmIntegrationsController],
  providers: [MmIntegrationsService],
  exports: [MmIntegrationsService],
})
export class IntegrationsModule {}
