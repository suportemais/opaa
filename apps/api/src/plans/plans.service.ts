import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  fallbackPublicPlans,
  normalizeFeatures,
  normalizePublicPlans,
} from './plan-catalog';
import type { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic() {
    try {
      const rows = await this.prisma.plan.findMany({
        where: { isPublic: true, isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      });
      const plans = normalizePublicPlans(rows);
      return plans.length > 0 ? plans : fallbackPublicPlans();
    } catch {
      return fallbackPublicPlans();
    }
  }

  listAdmin() {
    return this.prisma.plan.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async update(id: string, dto: UpdatePlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('plan_not_found');

    const data: Prisma.PlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.shortDescription !== undefined)
      data.shortDescription = dto.shortDescription;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.badge !== undefined) data.badge = dto.badge;
    if (dto.ctaLabel !== undefined) data.ctaLabel = dto.ctaLabel;
    if (dto.amountCents !== undefined) data.amountCents = dto.amountCents;
    if (dto.annualAmountCents !== undefined)
      data.annualAmountCents = dto.annualAmountCents;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.trialDays !== undefined) data.trialDays = dto.trialDays;
    if (dto.features !== undefined)
      data.features = normalizeFeatures(dto.features);
    if (dto.maxUnits !== undefined) data.maxUnits = dto.maxUnits;
    if (dto.maxUsers !== undefined) data.maxUsers = dto.maxUsers;
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.stripePriceId !== undefined) data.stripePriceId = dto.stripePriceId;

    return this.prisma.plan.update({ where: { id }, data });
  }
}
