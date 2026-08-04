import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PermissionsGuard } from './permissions.guard';
import { RbacSyncService } from './rbac-sync.service';

@Module({
  providers: [RbacService, PermissionsGuard, RbacSyncService],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
