import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail } from '../common/normalize';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeEmail(email: string) {
    return normalizeEmail(email);
  }

  findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        unitAccess: true,
      },
    });
  }

  findByEmailInTenant(tenantId: string, email: string) {
    const emailNormalized = normalizeEmail(email);
    return this.prisma.user.findUnique({
      where: { tenantId_emailNormalized: { tenantId, emailNormalized } },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        unitAccess: true,
      },
    });
  }

  findManyByEmail(email: string) {
    const emailNormalized = normalizeEmail(email);
    return this.prisma.user.findMany({
      where: { emailNormalized },
      include: {
        tenant: { select: { id: true, tradeName: true, legalName: true } },
      },
    });
  }
}
