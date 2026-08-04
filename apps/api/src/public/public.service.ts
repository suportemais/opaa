import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NpsClass } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { classifyNps } from '../domain/metrics/nps';
import type { SubmitResponseDto } from './dto/submit-response.dto';
import { normalizeEmail, normalizePhone } from '../common/normalize';

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
  constructor(private readonly prisma: PrismaService) {}

  async getPublishedSurvey(publicToken: string) {
    const distribution = await this.prisma.surveyDistribution.findUnique({
      where: { publicToken },
      include: {
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
      tradeName: undefined,
      survey: {
        name: survey.name,
        description: survey.description,
        introMessage: survey.introMessage,
        outroMessage: survey.outroMessage,
        collectCustomer: survey.collectCustomer,
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

  async submitResponse(dto: SubmitResponseDto) {
    const distribution = await this.prisma.surveyDistribution.findUnique({
      where: { publicToken: dto.publicToken },
      include: {
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
    if (npsQuestion) {
      const score = typeof npsAnswer?.value === 'number' ? npsAnswer.value : NaN;
      if (!Number.isFinite(score) || score < 0 || score > 10) {
        throw new BadRequestException('invalid_nps');
      }
      npsScore = score;
      npsClass = classifyNps(score);
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

    const mainComment = rankedTextQuestions
      .map((q) => dto.answers.find((a) => a.questionId === q.id)?.value)
      .find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined;

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
          employeeId: distribution.employeeId,
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

      if (created.npsClass === NpsClass.detractor) {
        await tx.feedbackCase.create({
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
                  data: { trigger: 'nps_detractor', npsScore: created.npsScore },
                },
              ],
            },
          },
        });
      }

      return tx.surveyResponse.findUniqueOrThrow({
        where: { id: created.id },
        include: { answers: true },
      });
    });

    return {
      responseId: response.id,
      status: response.status,
      npsScore: response.npsScore,
      npsClass: response.npsClass,
    };
  }
}
