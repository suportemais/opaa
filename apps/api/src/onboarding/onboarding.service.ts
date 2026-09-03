import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { normalizeEmail } from '../common/normalize';
import { AuditService } from '../audit/audit.service';
import { normalizeBrDocument } from '../common/br-document';
import type { Request } from 'express';
import type { CreateTenantDto } from './dto/create-tenant.dto';

function slugify(value: string) {
  const raw = (value ?? '').trim();
  const ascii = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalized = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const sliced = normalized.slice(0, 48);
  return sliced || 'tenant';
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async createTenant(dto: CreateTenantDto, req?: Request) {
    const passwordHash = await argon2.hash(dto.adminPassword);
    const adminEmailNormalized = normalizeEmail(dto.adminEmail);
    const normalizedDoc = normalizeBrDocument(dto.document);
    if (dto.document && !normalizedDoc)
      throw new ConflictException('Documento inválido.');

    const baseSlug = slugify(dto.tenantSlug ?? dto.tradeName);

    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix =
        attempt === 0 ? '' : `-${Math.random().toString(36).slice(2, 6)}`;
      const slug = `${baseSlug}${suffix}`;

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
          const tenant = await tx.tenant.create({
            data: {
              slug,
              legalName: dto.legalName,
              tradeName: dto.tradeName,
              email: dto.email,
              phone: dto.phone,
              document: normalizedDoc ? normalizedDoc.value : null,
              segment: dto.segment,
              primaryColor: dto.primaryColor,
              secondaryColor: dto.secondaryColor,
              status: 'trial',
              billingMode: 'stripe',
              trialEndsAt,
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
            where: {
              tenantId_code: { tenantId: tenant.id, code: 'tenant_admin' },
            },
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
              summary: {
                tradeName: tenant.tradeName,
                slug: tenant.slug,
              } as any,
              ip: req?.ip,
              userAgent: req?.headers['user-agent'],
              correlationId:
                typeof req?.headers['x-correlation-id'] === 'string'
                  ? req.headers['x-correlation-id']
                  : 'onboarding',
            },
          });

          return {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            adminUserId: user.id,
            unitId: unit.id,
          };
        });

        return result;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          const target = (e.meta as any)?.target;
          if (Array.isArray(target) && target.includes('slug')) continue;
          throw new ConflictException('Já existe um registro com este e-mail.');
        }
        throw e;
      }
    }

    throw new ConflictException('Subdomínio indisponível.');
  }
}
