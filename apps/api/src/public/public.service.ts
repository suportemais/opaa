import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NpsClass } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { classifyNps } from '../domain/metrics/nps';
import type { SubmitResponseDto } from './dto/submit-response.dto';
import { normalizeEmail, normalizePhone } from '../common/normalize';
import { baseDomain, tenantSlugFromHost } from '../common/tenant-host';
import { badScoreThresholdFromSettings } from '../common/tenant-settings';
import { googleBusinessUrlFromSettings } from '../common/unit-settings';
import { WebhookOutboxService } from '../webhook-outbox/webhook-outbox.service';
import type { SubmitWhistleblowerDto } from './dto/submit-whistleblower.dto';

type QuestionConfig = {
  when?: { npsMin?: number; npsMax?: number };
  requiredWhenVisible?: boolean;
};

function isQuestionVisible(q: { config: unknown }, ctx: { npsScore?: number }) {
  const config = q.config as QuestionConfig | null | undefined;
  const when = config?.when;
  if (!when) return true;
  if (typeof ctx.npsScore !== 'number') return false;
  if (typeof when.npsMin === 'number' && ctx.npsScore < when.npsMin) return false;
  if (typeof when.npsMax === 'number' && ctx.npsScore > when.npsMax) return false;
  return true;
}

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookOutbox: WebhookOutboxService,
  ) {}

  async isAllowedDomain(domain: string) {
    const base = baseDomain();
    if (!base) return false;

    const normalized = domain.toLowerCase().replace(/:\d+$/, '');
    if (normalized === base) return true;
    const slug = tenantSlugFromHost(normalized, base);
    if (!slug) return false;

    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    return Boolean(tenant);
  }

  async getPublishedSurvey(publicToken: string) {
    const distribution = await this.prisma.surveyDistribution.findUnique({
      where: { publicToken },
      include: {
        tenant: { select: { tradeName: true, settings: true } },
        unit: { select: { id: true, name: true, settings: true } },
        survey: {
          include: {
            publishedVersion: {
              include: {
                questions: { include: { options: true }, orderBy: { order: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!distribution || !distribution.active) {
      throw new NotFoundException();
    }

    const survey = distribution.survey;
    if (!survey.publishedVersion || survey.status !== 'published') {
      throw new NotFoundException();
    }

    const now = new Date();
    if (survey.startsAt && now < survey.startsAt) throw new NotFoundException();
    if (survey.endsAt && now > survey.endsAt) throw new NotFoundException();

    return {
      tenantId: distribution.tenantId,
      surveyId: survey.id,
      surveyVersionId: survey.publishedVersion.id,
      distributionId: distribution.id,
      tradeName: distribution.tenant.tradeName,
      settings: {
        badScoreThreshold: badScoreThresholdFromSettings(distribution.tenant.settings),
      },
      unit: distribution.unit
        ? {
            id: distribution.unit.id,
            name: distribution.unit.name,
            googleBusinessUrl: googleBusinessUrlFromSettings(distribution.unit.settings),
          }
        : null,
      survey: {
        name: survey.name,
        description: survey.description,
        introMessage: survey.introMessage,
        outroMessage: survey.outroMessage,
        collectCustomer: survey.collectCustomer,
        collectEmployee: (survey as any).collectEmployee ?? false,
        questions: survey.publishedVersion.questions.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          type: q.type,
          required: q.required,
          order: q.order,
          config: q.config,
          options: q.options.map((o) => ({ id: o.id, label: o.label, value: o.value, order: o.order })),
        })),
      },
    };
  }

  async listSurveyEmployees(publicToken: string, params: { q?: string }) {
    const distribution = await this.prisma.surveyDistribution.findUnique({
      where: { publicToken },
      include: { survey: true },
    });

    if (!distribution || !distribution.active) throw new NotFoundException();
    if (!distribution.unitId) return [];

    const collectEmployee = Boolean((distribution.survey as any).collectEmployee);
    if (!collectEmployee) return [];

    const q = typeof params.q === 'string' && params.q.trim() ? params.q.trim() : undefined;

    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId: distribution.tenantId,
        unitId: distribution.unitId,
        status: 'active',
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: 20,
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, code: true, roleTitle: true },
    });

    return employees;
  }

  async submitResponse(dto: SubmitResponseDto) {
    const distribution = await this.prisma.surveyDistribution.findUnique({
      where: { publicToken: dto.publicToken },
      include: {
        tenant: { select: { settings: true } },
        survey: {
          include: {
            publishedVersion: {
              include: { questions: true },
            },
          },
        },
      },
    });

    if (!distribution || !distribution.active) throw new NotFoundException();
    const survey = distribution.survey;
    const version = survey.publishedVersion;
    if (!version || survey.status !== 'published') throw new NotFoundException();

    const badScoreThreshold = badScoreThresholdFromSettings(distribution.tenant.settings);
    const collectEmployee = Boolean((survey as any).collectEmployee);

    let finalEmployeeId: string | null = distribution.employeeId ?? null;
    if (dto.employeeId) {
      if (!collectEmployee) throw new BadRequestException('employee_not_allowed');
      if (!distribution.unitId) throw new BadRequestException('employee_not_allowed');

      const employee = await this.prisma.employee.findFirst({
        where: {
          id: dto.employeeId,
          tenantId: distribution.tenantId,
          unitId: distribution.unitId,
          status: 'active',
        },
        select: { id: true },
      });
      if (!employee) throw new BadRequestException('invalid_employee');
      finalEmployeeId = employee.id;
    }

    const questionById = new Map(version.questions.map((q) => [q.id, q]));

    for (const answer of dto.answers) {
      if (!questionById.has(answer.questionId)) {
        throw new BadRequestException('invalid_question');
      }
    }

    const npsQuestion = version.questions.find((q) => q.type === 'nps');
    const npsAnswer = npsQuestion
      ? dto.answers.find((a) => a.questionId === npsQuestion.id)
      : undefined;

    let npsScore: number | undefined;
    let npsClass: NpsClass | undefined;
    let isBadScore = false;
    if (npsQuestion) {
      const score = typeof npsAnswer?.value === 'number' ? npsAnswer.value : NaN;
      if (!Number.isFinite(score) || score < 1 || score > 10) {
        throw new BadRequestException('invalid_nps');
      }
      npsScore = score;
      npsClass = classifyNps(score);
      isBadScore = score <= badScoreThreshold;
    }

    const visibleCtx = { npsScore };
    const requiredQuestions = version.questions.filter((q) => {
      if (!isQuestionVisible(q as any, visibleCtx)) return false;
      const config = q.config as QuestionConfig | null | undefined;
      return Boolean(q.required || config?.requiredWhenVisible);
    });

    for (const q of requiredQuestions) {
      const v = dto.answers.find((a) => a.questionId === q.id)?.value;
      const ok =
        typeof v === 'number'
          ? Number.isFinite(v)
          : typeof v === 'string'
            ? v.trim().length > 0
            : v !== undefined && v !== null;
      if (!ok) throw new BadRequestException('missing_required');
    }

    const textQuestions = version.questions.filter((q) => q.type === 'text_long' || q.type === 'text_short');
    const rankedTextQuestions = textQuestions
      .filter((q) => isQuestionVisible(q as any, visibleCtx))
      .sort((a, b) => {
        const aCfg = a.config as QuestionConfig | null | undefined;
        const bCfg = b.config as QuestionConfig | null | undefined;
        const aIsConditional = Boolean(aCfg?.when);
        const bIsConditional = Boolean(bCfg?.when);
        if (aIsConditional !== bIsConditional) return aIsConditional ? -1 : 1;
        return a.order - b.order;
      });

    const derivedComment = rankedTextQuestions
      .map((q) => dto.answers.find((a) => a.questionId === q.id)?.value)
      .find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined;

    const complaint =
      typeof dto.complaint === 'string' && dto.complaint.trim().length > 0 ? dto.complaint.trim() : undefined;

    const mainComment = complaint && isBadScore ? complaint : derivedComment;

    const response = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.surveyResponse.findUnique({
        where: {
          tenantId_surveyId_idempotencyKey: {
            tenantId: distribution.tenantId,
            surveyId: survey.id,
            idempotencyKey: dto.idempotencyKey,
          },
        },
        include: { answers: true },
      });

      if (existing) return existing;

      let customerId: string | null = null;
      if (dto.customer) {
        const anyField =
          (typeof dto.customer.name === 'string' && dto.customer.name.trim().length > 0) ||
          (typeof dto.customer.email === 'string' && dto.customer.email.trim().length > 0) ||
          (typeof dto.customer.phone === 'string' && dto.customer.phone.trim().length > 0);

        if (anyField) {
          const emailNormalized =
            typeof dto.customer.email === 'string' && dto.customer.email.trim()
              ? normalizeEmail(dto.customer.email)
              : null;
          const phoneNormalized =
            typeof dto.customer.phone === 'string' && dto.customer.phone.trim()
              ? normalizePhone(dto.customer.phone)
              : null;

          const existingCustomer =
            emailNormalized || phoneNormalized
              ? await tx.customer.findFirst({
                  where: {
                    tenantId: distribution.tenantId,
                    ...(emailNormalized ? { emailNormalized } : { phoneNormalized: phoneNormalized! }),
                  },
                })
              : null;

          const customer = existingCustomer
            ? await tx.customer.update({
                where: { id: existingCustomer.id },
                data: {
                  name:
                    typeof dto.customer.name === 'string' && dto.customer.name.trim()
                      ? dto.customer.name.trim()
                      : existingCustomer.name,
                  email:
                    typeof dto.customer.email === 'string' && dto.customer.email.trim()
                      ? dto.customer.email.trim()
                      : existingCustomer.email,
                  emailNormalized: emailNormalized ?? existingCustomer.emailNormalized,
                  phone:
                    typeof dto.customer.phone === 'string' && dto.customer.phone.trim()
                      ? dto.customer.phone.trim()
                      : existingCustomer.phone,
                  phoneNormalized: phoneNormalized ?? existingCustomer.phoneNormalized,
                  firstInteractionAt: existingCustomer.firstInteractionAt ?? new Date(),
                  lastInteractionAt: new Date(),
                  originUnitId: existingCustomer.originUnitId ?? distribution.unitId,
                },
              })
            : await tx.customer.create({
                data: {
                  tenantId: distribution.tenantId,
                  name: typeof dto.customer.name === 'string' ? dto.customer.name.trim() : undefined,
                  email: typeof dto.customer.email === 'string' ? dto.customer.email.trim() : undefined,
                  emailNormalized: emailNormalized ?? undefined,
                  phone: typeof dto.customer.phone === 'string' ? dto.customer.phone.trim() : undefined,
                  phoneNormalized: phoneNormalized ?? undefined,
                  originUnitId: distribution.unitId,
                  firstInteractionAt: new Date(),
                  lastInteractionAt: new Date(),
                },
              });

          customerId = customer.id;
        }
      }

      const created = await tx.surveyResponse.create({
        data: {
          tenantId: distribution.tenantId,
          surveyId: survey.id,
          surveyVersionId: version.id,
          distributionId: distribution.id,
          unitId: distribution.unitId,
          employeeId: finalEmployeeId,
          customerId,
          channel: distribution.channel,
          campaign: distribution.campaign,
          status: 'completed',
          completedAt: new Date(),
          durationMs: null,
          npsScore,
          npsClass,
          mainComment,
          metadata: dto.clientMetadata as any,
          idempotencyKey: dto.idempotencyKey,
        },
      });

      await tx.answer.createMany({
        data: dto.answers.map((a) => ({
          tenantId: distribution.tenantId,
          surveyResponseId: created.id,
          questionId: a.questionId,
          value: a.value as any,
        })),
      });

      const shouldCreateCase = typeof created.npsScore === 'number' && created.npsScore <= badScoreThreshold;
      let createdCaseId: string | null = null;
      if (shouldCreateCase) {
        const fbCase = await tx.feedbackCase.create({
          data: {
            tenantId: distribution.tenantId,
            surveyResponseId: created.id,
            unitId: created.unitId,
            customerId: created.customerId,
            priority: 'high',
            status: 'new',
            description: created.mainComment,
            events: {
              create: [
                {
                  tenantId: distribution.tenantId,
                  type: 'case.created_by_rule',
                  data: { trigger: 'nps_bad_score', npsScore: created.npsScore, badScoreThreshold },
                },
              ],
            },
          },
          select: { id: true },
        });
        createdCaseId = fbCase.id;
      }

      const returned = await tx.surveyResponse.findUniqueOrThrow({
        where: { id: created.id },
        include: { answers: true },
      });

      if (createdCaseId) {
        const unit = distribution.unitId
          ? await tx.unit.findUnique({ where: { id: distribution.unitId }, select: { id: true, name: true } })
          : null;
        const employee = finalEmployeeId
          ? await tx.employee.findUnique({ where: { id: finalEmployeeId }, select: { id: true, name: true, code: true, roleTitle: true } })
          : null;
        const customer = customerId
          ? await tx.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, email: true, phone: true, emailNormalized: true, phoneNormalized: true } })
          : null;
        const surveyRow = await tx.survey.findUnique({ where: { id: survey.id }, select: { id: true, name: true } });
        const outboxPayload = {
          feedbackCaseId: createdCaseId,
          trigger: 'nps_bad_score',
          tenant: { id: distribution.tenantId, slug: (distribution.tenant as any)?.slug ?? null },
          survey: { id: survey.id, name: surveyRow?.name ?? survey.name },
          surveyResponseId: created.id,
          distribution: {
            id: distribution.id,
            publicToken: distribution.publicToken,
            channel: distribution.channel,
            campaign: distribution.campaign,
          },
          nps: {
            score: created.npsScore,
            class: npsClass ?? null,
            badScoreThreshold,
          },
          unit: unit ? { id: unit.id, name: unit.name } : null,
          employee: employee ? { id: employee.id, name: employee.name, code: employee.code, roleTitle: employee.roleTitle } : null,
          customer: customer
            ? {
                id: customer.id,
                name: customer.name ?? null,
                email: customer.email ?? null,
                emailNormalized: customer.emailNormalized ?? null,
                phone: customer.phone ?? null,
                phoneNormalized: customer.phoneNormalized ?? null,
              }
            : null,
          mainComment: created.mainComment ?? null,
          completedAt: created.completedAt ? (created.completedAt as Date).toISOString() : null,
          idempotencyKey: created.idempotencyKey ?? null,
          answers: dto.answers.map((a) => ({ questionId: a.questionId, value: a.value })),
        };

        await tx.webhookOutbox.create({
          data: {
            tenantId: distribution.tenantId,
            eventType: 'feedback_case.created',
            payload: outboxPayload as any,
            status: 'pending',
            attempts: 0,
            maxAttempts: 10,
            nextAttemptAt: new Date(),
          },
        });
      }

      return returned;
    });

    return {
      responseId: response.id,
      status: response.status,
      npsScore: response.npsScore,
      npsClass: response.npsClass,
    };
  }

  async getWhistleblowerForm(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        slug: true,
        tradeName: true,
        legalName: true,
        settings: true,
      },
    });
    if (!tenant) throw new NotFoundException('tenant_not_found');
    const units = await this.prisma.unit.findMany({
      where: { tenantId: tenant.id, status: 'active' },
      select: { id: true, name: true, internalCode: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        tradeName: tenant.tradeName,
        legalName: tenant.legalName,
      },
      units: units.map((u) => ({ id: u.id, name: u.name, internalCode: u.internalCode ?? null })),
    };
  }

  async submitWhistleblower(tenantSlug: string, dto: SubmitWhistleblowerDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, status: true },
    });
    if (!tenant) throw new NotFoundException('tenant_not_found');
    if (tenant.status !== 'active' && tenant.status !== 'trial') {
      throw new BadRequestException('tenant_inactive');
    }

    const reporter = dto.reporter ?? {};
    const hasAnyReporterField =
      Boolean(reporter.name?.trim()) ||
      Boolean(reporter.email?.trim()) ||
      Boolean(reporter.phone?.trim()) ||
      Boolean(reporter.doc?.trim());
    const anonymous = dto.anonymous === false && hasAnyReporterField ? false : true;

    const category = dto.category;
    const customCategory = dto.customCategory?.trim() || null;
    if (category === 'other' && !customCategory) {
      throw new BadRequestException('custom_category_required_when_other');
    }

    if (dto.unitId) {
      const exists = await this.prisma.unit.findFirst({
        where: { id: dto.unitId, tenantId: tenant.id },
        select: { id: true },
      });
      if (!exists) throw new BadRequestException('unit_not_found');
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : null;
    if (occurredAt && Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('invalid_occurred_at');
    }

    const reporterEmailNormalized = reporter.email?.trim() ? normalizeEmail(reporter.email.trim()) : null;
    const reporterPhoneNormalized = reporter.phone?.trim() ? normalizePhone(reporter.phone.trim()).slice(0, 30) || null : null;

    const random = () => {
      const b = crypto.getRandomValues(new Uint8Array(2));
      return (b[0] * 256 + b[1]).toString(36).toUpperCase().padStart(3, '0').slice(0, 3);
    };
    const datePrefix = new Date();
    const prefix =
      'DEN' +
      datePrefix.getUTCFullYear().toString() +
      String(datePrefix.getUTCMonth() + 1).padStart(2, '0') +
      String(datePrefix.getUTCDate()).padStart(2, '0');

    let protocol = `${prefix}-${random()}`;
    for (let i = 0; i < 10; i++) {
      const existing = await this.prisma.whistleblowerReport.findUnique({
        where: { protocol },
        select: { id: true },
      });
      if (!existing) break;
      protocol = `${prefix}-${random()}`;
    }

    let publicToken = '';
    for (let i = 0; i < 10; i++) {
      const bytes = crypto.getRandomValues(new Uint8Array(12));
      const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      const exists = await this.prisma.whistleblowerReport.findUnique({ where: { publicToken: token }, select: { id: true } });
      if (!exists) {
        publicToken = token;
        break;
      }
    }
    if (!publicToken) throw new BadRequestException('token_generate_failed');

    const created = await this.prisma.whistleblowerReport.create({
      data: {
        tenantId: tenant.id,
        unitId: dto.unitId ?? null,
        protocol,
        publicToken,
        category,
        customCategory,
        title: dto.title.trim(),
        description: dto.description.trim(),
        occurredAt,
        locationText: dto.locationText?.trim() || null,
        involvedPeople: dto.involvedPeople?.trim() || null,
        witnesses: dto.witnesses?.trim() || null,
        additionalInfo: dto.additionalInfo?.trim() || null,
        reporterAnonymous: anonymous,
        reporterName: anonymous ? null : reporter.name?.trim() || null,
        reporterEmail: anonymous ? null : reporter.email?.trim() || null,
        reporterPhone: anonymous ? null : reporter.phone?.trim() || null,
        reporterDoc: anonymous ? null : reporter.doc?.trim() || null,
        status: 'received',
        priority: 'medium',
        metadata: {
          idempotencyKey: dto.idempotencyKey?.trim() || null,
          reporterEmailNormalized: anonymous ? null : reporterEmailNormalized,
          reporterPhoneNormalized: anonymous ? null : reporterPhoneNormalized,
          clientMetadata: dto.clientMetadata ?? null,
        },
        events: {
          create: [
            {
              tenantId: tenant.id,
              type: 'report.submitted',
              notes: anonymous ? 'Denúncia enviada de forma anônima.' : 'Denúncia enviada com identificação voluntária.',
            },
          ],
        },
      },
      select: { id: true, protocol: true, publicToken: true, createdAt: true, status: true, priority: true },
    });

    const enqueuePayload = {
      whistleblowerReportId: created.id,
      protocol: created.protocol,
      publicToken: created.publicToken,
      category,
      customCategory,
      title: dto.title.trim(),
      summary: dto.description.trim().slice(0, 500),
      occurredAt: occurredAt ? occurredAt.toISOString() : null,
      unit: dto.unitId ? { id: dto.unitId } : null,
      anonymous,
      reporter: anonymous
        ? null
        : {
            name: reporter.name?.trim() || null,
            email: reporter.email?.trim() || null,
            emailNormalized: reporterEmailNormalized,
            phone: reporter.phone?.trim() || null,
            phoneNormalized: reporterPhoneNormalized,
            doc: reporter.doc?.trim() || null,
          },
      createdAt: created.createdAt ? (created.createdAt as Date).toISOString() : null,
      idempotencyKey: dto.idempotencyKey?.trim() || null,
    };

    try {
      await this.prisma.webhookOutbox.create({
        data: {
          tenantId: tenant.id,
          eventType: 'whistleblower_report.submitted',
          payload: enqueuePayload as any,
          status: 'pending',
          attempts: 0,
          maxAttempts: 10,
          nextAttemptAt: new Date(),
        },
      });
    } catch {
      // ignore; report is already saved
    }

    return {
      id: created.id,
      protocol: created.protocol,
      publicToken: created.publicToken,
      anonymous,
      status: created.status,
      priority: created.priority,
      createdAt: created.createdAt,
      message: 'Denúncia recebida com sucesso. Guarde o número de protocolo para acompanhamento.',
    };
  }
}
