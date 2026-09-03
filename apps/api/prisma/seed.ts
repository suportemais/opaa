import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { NpsClass, PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import {
  AllPermissionCodes,
  PermissionCodes,
} from '../src/rbac/permission-codes';
import {
  ensurePlatformAdminRole,
  PLATFORM_ADMIN_ROLE_CODE,
} from '../src/rbac/platform-admin';
import { randomToken } from '../src/common/crypto';
import { upsertPlans } from './seed-plans';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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

async function ensureGlobalPermissions() {
  for (const code of AllPermissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, name: code },
      update: {},
    });
  }
}

async function ensureTenantRoles(tenantId: string) {
  await ensureGlobalPermissions();

  const roles = [
    {
      code: 'tenant_admin',
      name: 'Administrador do tenant',
      permissions: [
        PermissionCodes.TenantSettingsManage,
        PermissionCodes.UnitRead,
        PermissionCodes.UnitManage,
        PermissionCodes.UserManage,
        PermissionCodes.SurveyRead,
        PermissionCodes.SurveyManage,
        PermissionCodes.ResponseRead,
        PermissionCodes.FeedbackManage,
        PermissionCodes.CustomerRead,
        PermissionCodes.CustomerManage,
      ],
    },
  ] as const;

  for (const roleDef of roles) {
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId, code: roleDef.code } },
      create: { tenantId, code: roleDef.code, name: roleDef.name },
      update: { name: roleDef.name },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const perms = await prisma.permission.findMany({
      where: { code: { in: [...roleDef.permissions] } },
      select: { id: true },
    });

    if (perms.length) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  }
}

async function createTenant(params: {
  legalName: string;
  tradeName: string;
  email: string;
  adminEmail: string;
  adminName: string;
  password: string;
}) {
  const slug = slugify(params.tradeName);
  const tenant = await prisma.tenant.upsert({
    where: { email: params.email },
    create: {
      slug,
      legalName: params.legalName,
      tradeName: params.tradeName,
      email: params.email,
      status: 'active',
      billingMode: 'stripe',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      primaryColor: '#2563eb',
      secondaryColor: '#0ea5e9',
    },
    update: {},
  });

  await ensureTenantRoles(tenant.id);

  const passwordHash = await argon2.hash(params.password);
  const adminEmailNormalized = params.adminEmail.trim().toLowerCase();

  const admin = await prisma.user.upsert({
    where: {
      tenantId_emailNormalized: {
        tenantId: tenant.id,
        emailNormalized: adminEmailNormalized,
      },
    },
    create: {
      tenantId: tenant.id,
      email: params.adminEmail,
      emailNormalized: adminEmailNormalized,
      name: params.adminName,
      passwordHash,
      status: 'active',
    },
    update: {},
  });

  const role = await prisma.role.findUniqueOrThrow({
    where: { tenantId_code: { tenantId: tenant.id, code: 'tenant_admin' } },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: role.id } },
    create: { userId: admin.id, roleId: role.id },
    update: {},
  });

  const existingUnit = await prisma.unit.findFirst({
    where: { tenantId: tenant.id },
  });
  const unit =
    existingUnit ??
    (await prisma.unit.create({
      data: {
        tenantId: tenant.id,
        name: `${params.tradeName} - Unidade 1`,
        timeZone: 'America/Sao_Paulo',
      },
    }));

  await prisma.userUnitAccess.upsert({
    where: { userId_unitId: { userId: admin.id, unitId: unit.id } },
    create: { userId: admin.id, unitId: unit.id },
    update: {},
  });

  const existingSurvey = await prisma.survey.findFirst({
    where: { tenantId: tenant.id, name: 'Pesquisa de experiência' },
  });
  const survey =
    existingSurvey ??
    (await prisma.survey.create({
      data: {
        tenantId: tenant.id,
        name: 'Pesquisa de experiência',
        description: 'Ajude-nos a melhorar com uma pesquisa rápida.',
        status: 'published',
        units: { createMany: { data: [{ unitId: unit.id }] } },
      },
    }));

  const existingVersion = await prisma.surveyVersion.findFirst({
    where: { tenantId: tenant.id, surveyId: survey.id, version: 1 },
    include: { questions: true },
  });
  const version =
    existingVersion ??
    (await prisma.surveyVersion.create({
      data: {
        tenantId: tenant.id,
        surveyId: survey.id,
        version: 1,
        status: 'published',
        snapshot: { name: survey.name },
        questions: {
          createMany: {
            data: [
              {
                tenantId: tenant.id,
                title: 'De 1 a 10, o quanto você nos recomendaria?',
                type: 'nps',
                required: true,
                order: 1,
              },
              {
                tenantId: tenant.id,
                title: 'Conte mais sobre sua experiência',
                type: 'text_long',
                required: false,
                order: 2,
              },
            ],
          },
        },
      },
      include: { questions: true },
    }));

  await prisma.survey.update({
    where: { id: survey.id },
    data: { publishedVersionId: version.id },
  });

  const existingDistribution = await prisma.surveyDistribution.findFirst({
    where: {
      tenantId: tenant.id,
      surveyId: survey.id,
      unitId: unit.id,
      channel: 'qrcode',
    },
  });
  const distribution =
    existingDistribution ??
    (await prisma.surveyDistribution.create({
      data: {
        tenantId: tenant.id,
        surveyId: survey.id,
        unitId: unit.id,
        channel: 'qrcode',
        publicToken: randomToken(16),
        active: true,
      },
    }));

  await prisma.surveyResponse.create({
    data: {
      tenantId: tenant.id,
      surveyId: survey.id,
      surveyVersionId: version.id,
      distributionId: distribution.id,
      unitId: unit.id,
      channel: 'qrcode',
      status: 'completed',
      completedAt: new Date(),
      npsScore: 10,
      npsClass: NpsClass.promoter,
      idempotencyKey: randomToken(16),
      answers: {
        create: [
          {
            tenantId: tenant.id,
            questionId: version.questions[0]!.id,
            value: 10 as any,
          },
          {
            tenantId: tenant.id,
            questionId: version.questions[1]!.id,
            value: 'Excelente!' as any,
          },
        ],
      },
    },
  });

  return {
    tenantId: tenant.id,
    adminEmail: admin.email,
    password: params.password,
    publicToken: distribution.publicToken,
  };
}

async function ensurePlatformOperator() {
  await ensurePlatformAdminRole(prisma);

  const tenant = await prisma.tenant.upsert({
    where: { email: 'platform@devmais.local' },
    create: {
      slug: 'devmais',
      legalName: 'Dev Mais Tecnologia LTDA',
      tradeName: 'Dev Mais',
      email: 'platform@devmais.local',
      status: 'active',
      billingMode: 'manual',
      isPlatform: true,
      primaryColor: '#06b6d4',
      secondaryColor: '#8b5cf6',
    },
    update: { isPlatform: true, billingMode: 'manual' },
  });

  const passwordHash = await argon2.hash(
    process.env.PLATFORM_ADMIN_PASSWORD ?? 'Admin1234!',
  );
  const emailNormalized = 'ops@devmais.local';

  const user = await prisma.user.upsert({
    where: {
      tenantId_emailNormalized: { tenantId: tenant.id, emailNormalized },
    },
    create: {
      tenantId: tenant.id,
      email: 'ops@devmais.local',
      emailNormalized,
      name: 'Operador Dev Mais',
      passwordHash,
      status: 'active',
    },
    update: {},
  });

  const role = await prisma.role.findFirst({
    where: { tenantId: null, code: PLATFORM_ADMIN_ROLE_CODE },
  });
  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
  }

  return { tenantId: tenant.id, email: user.email };
}

async function main() {
  await ensureGlobalPermissions();
  const plans = await upsertPlans(prisma);
  const platform = await ensurePlatformOperator();

  const t1 = await createTenant({
    legalName: 'Opiina Demo Restaurante LTDA',
    tradeName: 'Demo Bistrô',
    email: 'tenant1@opiina.local',
    adminEmail: 'admin1@opiina.local',
    adminName: 'Admin Demo 1',
    password: 'Admin1234!',
  });

  const t2 = await createTenant({
    legalName: 'Opiina Demo Café LTDA',
    tradeName: 'Café Aurora',
    email: 'tenant2@opiina.local',
    adminEmail: 'admin2@opiina.local',
    adminName: 'Admin Demo 2',
    password: 'Admin1234!',
  });

  console.log({ t1, t2, platform, plans });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
