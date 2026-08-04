import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { normalizeEmail } from '../common/normalize';
import { AuditService } from '../audit/audit.service';
import type { Request } from 'express';
import type { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async createTenant(dto: CreateTenantDto, req?: Request) {
    try {
      const passwordHash = await argon2.hash(dto.adminPassword);
      const adminEmailNormalized = normalizeEmail(dto.adminEmail);

      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            legalName: dto.legalName,
            tradeName: dto.tradeName,
            email: dto.email,
            phone: dto.phone,
            document: dto.document,
            segment: dto.segment,
            primaryColor: dto.primaryColor,
            secondaryColor: dto.secondaryColor,
            status: 'trial',
          },
        });

        await this.rbac.ensureTenantDefaultRoles(tenant.id);

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: dto.adminEmail,
            emailNormalized: adminEmailNormalized,
            name: dto.adminName,
            passwordHash,
            status: 'active',
          },
        });

        const adminRole = await tx.role.findUniqueOrThrow({
          where: { tenantId_code: { tenantId: tenant.id, code: 'tenant_admin' } },
        });

        await tx.userRole.create({
          data: { userId: user.id, roleId: adminRole.id },
        });

        const unit = await tx.unit.create({
          data: {
            tenantId: tenant.id,
            name: dto.unitName,
            timeZone: dto.unitTimeZone,
          },
        });

        await tx.userUnitAccess.create({
          data: { userId: user.id, unitId: unit.id },
        });

        await tx.auditLog.create({
          data: {
            tenantId: tenant.id,
            actorType: 'user',
            actorUserId: user.id,
            action: 'onboarding.tenant_created',
            entity: 'Tenant',
            entityId: tenant.id,
            summary: { tradeName: tenant.tradeName } as any,
            ip: req?.ip,
            userAgent: req?.headers['user-agent'],
            correlationId:
              typeof req?.headers['x-correlation-id'] === 'string'
                ? req.headers['x-correlation-id']
                : 'onboarding',
          },
        });

        return { tenantId: tenant.id, adminUserId: user.id, unitId: unit.id };
      });

      return result;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Já existe um registro com este e-mail.');
      }
      throw e;
    }
  }
}
