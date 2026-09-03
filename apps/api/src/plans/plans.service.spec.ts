import { NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { fallbackPublicPlans } from './plan-catalog';

describe('PlansService', () => {
  it('returns only public active plans from the database', async () => {
    const prisma = {
      plan: {
        findMany: jest.fn().mockResolvedValue([
          {
            name: 'Pro',
            slug: 'pro',
            amountCents: 29700,
            currency: 'BRL',
            badge: 'Mais popular',
            shortDescription: 'NPS, dashboard e Kanban para a sua unidade.',
            features: [{ key: 'nps', label: 'Pesquisa NPS', included: true }],
            trialDays: 14,
            ctaLabel: 'Assinar',
            featured: true,
            maxUnits: 1,
            maxUsers: 5,
            annualAmountCents: 297000,
            displayOrder: 2,
            isPublic: true,
            isActive: true,
          },
        ]),
      },
    };

    const service = new PlansService(prisma as any);
    const plans = await service.listPublic();
    expect(plans).toHaveLength(1);
    expect(plans[0].slug).toBe('pro');
    expect(plans[0].ctaLabel).toBe('Assinar');
  });

  it('falls back to the literal catalog when the query fails', async () => {
    const prisma = {
      plan: {
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
    };

    const service = new PlansService(prisma as any);
    await expect(service.listPublic()).resolves.toEqual(fallbackPublicPlans());
  });

  it('updates an existing plan and never deletes', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'plan-1', slug: 'start' });
    const prisma = {
      plan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'plan-1', slug: 'start' }),
        update,
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const service = new PlansService(prisma as any);
    await service.update('plan-1', {
      amountCents: 14700,
      badge: 'Ideal para começar',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { amountCents: 14700, badge: 'Ideal para começar' },
    });
    expect(prisma.plan.delete).not.toHaveBeenCalled();
    expect(prisma.plan.deleteMany).not.toHaveBeenCalled();
  });

  it('throws when updating a missing plan', async () => {
    const prisma = {
      plan: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new PlansService(prisma as any);
    await expect(
      service.update('00000000-0000-4000-8000-000000000000', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.plan.update).not.toHaveBeenCalled();
  });
});
