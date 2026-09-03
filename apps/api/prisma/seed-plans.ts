import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { OPIINA_PLANS } from '../src/plans/plan-catalog';

/**
 * Upserts OPIINA catalog plans by slug (start / pro / redes).
 * Never deletes plan rows. Never touches tenants, subscriptions, or clients.
 */
export async function upsertPlans(client: PrismaClient) {
  const results: Array<{ slug: string; action: 'created' | 'updated' }> = [];

  for (const plan of OPIINA_PLANS) {
    const existing = await client.plan.findUnique({
      where: { slug: plan.slug },
      select: { id: true },
    });

    await client.plan.upsert({
      where: { slug: plan.slug },
      create: {
        name: plan.name,
        slug: plan.slug,
        shortDescription: plan.shortDescription,
        badge: plan.badge,
        ctaLabel: plan.ctaLabel,
        amountCents: plan.amountCents,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        trialDays: plan.trialDays,
        features: plan.features,
        maxUnits: plan.maxUnits,
        maxUsers: plan.maxUsers,
        featured: plan.featured,
        isPublic: plan.isPublic,
        isActive: plan.isActive,
        displayOrder: plan.displayOrder,
        annualAmountCents: plan.annualAmountCents,
      },
      update: {
        name: plan.name,
        shortDescription: plan.shortDescription,
        badge: plan.badge,
        ctaLabel: plan.ctaLabel,
        amountCents: plan.amountCents,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        trialDays: plan.trialDays,
        features: plan.features,
        maxUnits: plan.maxUnits,
        maxUsers: plan.maxUsers,
        featured: plan.featured,
        isPublic: plan.isPublic,
        isActive: plan.isActive,
        displayOrder: plan.displayOrder,
        annualAmountCents: plan.annualAmountCents,
      },
    });

    results.push({ slug: plan.slug, action: existing ? 'updated' : 'created' });
  }

  return results;
}

function isDirectRun() {
  const entry = process.argv[1] ?? '';
  return entry.endsWith('seed-plans.ts') || entry.endsWith('seed-plans.js');
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  try {
    const results = await upsertPlans(prisma);
    console.log({ upserted: results });
  } finally {
    await prisma.$disconnect();
  }
}

if (isDirectRun()) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
