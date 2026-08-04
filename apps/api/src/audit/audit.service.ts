import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId?: string;
    actorType: 'user' | 'system' | 'support';
    actorUserId?: string;
    action: string;
    entity: string;
    entityId?: string;
    summary?: unknown;
    req?: Request;
  }) {
    const correlationIdHeader = params.req?.headers['x-correlation-id'];
    const correlationId =
      typeof correlationIdHeader === 'string' ? correlationIdHeader : randomUUID();

    await this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        actorType: params.actorType,
        actorUserId: params.actorUserId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        summary: params.summary as any,
        ip: params.req?.ip,
        userAgent: params.req?.headers['user-agent'],
        correlationId,
      },
    });
  }
}
