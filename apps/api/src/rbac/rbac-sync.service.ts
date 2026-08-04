import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from './rbac.service';

@Injectable()
export class RbacSyncService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
  ) {}

  async onApplicationBootstrap() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.rbac.ensureTenantDefaultRoles(t.id);
    }
  }
}

