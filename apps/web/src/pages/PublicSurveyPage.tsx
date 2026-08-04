import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { randomId } from '../lib/id';

type PublicOption = { id: string; label: string; value: string; order: number };
type PublicQuestion = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  required: boolean;
  order: number;
  options: PublicOption[];
  config?: unknown;
};
type PublicSurvey = {
  survey: {
    name: string;
    description: string | null;
    introMessage: string | null;
    outroMessage: string | null;
    collectCustomer: boolean;
    questions: PublicQuestion[];
  };
};

type QuestionConfig = {
  when?: { npsMin?: number; npsMax?: number };
  requiredWhenVisible?: boolean;
};

export function PublicSurveyPage() {
  const params = useParams();
  const token = params.token ?? '';

  const survey = useQuery({
    queryKey: ['publicSurvey', token],
    queryFn: () => apiFetch<PublicSurvey>(`/public/surveys/${token}`),
    enabled: Boolean(token),
  });

  const questions = useMemo(() => (survey.data?.survey.questions ?? []).slice().sort((a, b) => a.order - b.order), [survey.data]);
  const npsQuestion = useMemo(() => questions.find((q) => q.type === 'nps') ?? null, [questions]);

  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({}));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [identify, setIdentify] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const effectiveNps = useMemo(() => {
    if (!npsQuestion) return 10;
    const v = answers[npsQuestion.id];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return 10;
  }, [answers, npsQuestion]);

  const visibleQuestions = useMemo(() => {
    return questions.filter((q) => {
      const cfg = q.config as QuestionConfig | null | undefined;
      const when = cfg?.when;
      if (!when) return true;
      if (typeof when.npsMin === 'number' && effectiveNps < when.npsMin) return false;
      if (typeof when.npsMax === 'number' && effectiveNps > when.npsMax) return false;
      return true;
    });
  }, [questions, effectiveNps]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!npsQuestion) throw new Error('missing_nps');
      const idempotencyKey = localStorage.getItem(`opaa_pub_${token}`) ?? randomId(16);
      localStorage.setItem(`opaa_pub_${token}`, idempotencyKey);

      const outAnswers: Array<{ questionId: string; value: unknown }> = [];
      const nextAnswers: Record<string, unknown> = { ...answers };
      nextAnswers[npsQuestion.id] = typeof nextAnswers[npsQuestion.id] === 'number' ? nextAnswers[npsQuestion.id] : effectiveNps;

      for (const q of visibleQuestions) {
        const cfg = q.config as QuestionConfig | null | undefined;
        const required = Boolean(q.required || cfg?.requiredWhenVisible);
        const v = nextAnswers[q.id];

        const isMissing =
          v === undefined || v === null
            ? true
            : typeof v === 'string'
              ? v.trim().length === 0
              : typeof v === 'number'
                ? !Number.isFinite(v)
                : false;

        if (required && isMissing) {
          throw new Error('missing_required');
        }

        if (!isMissing) {
          outAnswers.push({ questionId: q.id, value: typeof v === 'string' ? v.trim() : v });
        }
      }

      const customer =
        survey.data?.survey.collectCustomer && identify
          ? {
              name: customerName.trim() || undefined,
              email: customerEmail.trim() || undefined,
              phone: customerPhone.trim() || undefined,
            }
          : undefined;

      const hasCustomerField = Boolean(customer?.name || customer?.email || customer?.phone);

      return apiFetch<{ responseId: string; npsClass: string }>('/public/responses', {
        method: 'POST',
        json: {
          publicToken: token,
          idempotencyKey,
          answers: outAnswers,
          customer: hasCustomerField ? customer : undefined,
          clientMetadata: { ua: navigator.userAgent },
        },
      });
    },
    onSuccess: () => {
      setFormError(null);
      setSubmitted(true);
    },
  });

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  if (survey.isLoading) {
    return <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">Carregando...</div>;
  }

  if (survey.isError || !survey.data) {
    return <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-sm text-rose-700">Pesquisa não encontrada</div>;
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-sky-600" />
          <div className="text-xl font-semibold text-slate-900">{survey.data.survey.name}</div>
          {survey.data.survey.description && <div className="text-sm text-slate-600">{survey.data.survey.description}</div>}
        </div>

        {submitted ? (
          <Card title="Obrigado!" description="Sua resposta foi registrada.">
            <div className="text-sm text-slate-700">{survey.data.survey.outroMessage ?? 'Você pode fechar esta página.'}</div>
          </Card>
        ) : (
          <Card>
            <div className="grid gap-4">
              {survey.data.survey.introMessage && <div className="text-sm text-slate-700">{survey.data.survey.introMessage}</div>}

              {visibleQuestions.map((q) => {
                const cfg = q.config as QuestionConfig | null | undefined;
                const required = Boolean(q.required || cfg?.requiredWhenVisible);
                const label = required ? `${q.title} *` : q.title;

                if (q.type === 'nps') {
                  return (
                    <div key={q.id}>
                      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
                      <div className="grid grid-cols-6 gap-2 md:grid-cols-11">
                        {Array.from({ length: 11 }).map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            className={[
                              'h-10 rounded-md border text-sm font-medium',
                              effectiveNps === i
                                ? 'border-sky-600 bg-sky-600 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            ].join(' ')}
                            onClick={() => setAnswer(q.id, i)}
                          >
                            {i}
                          </button>
                        ))}
                      </div>
                      {q.description && <div className="mt-2 text-xs text-slate-500">{q.description}</div>}
                    </div>
                  );
                }

                if (q.type === 'text_short') {
                  const v = typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
                  return (
                    <div key={q.id}>
                      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
                      <input
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        value={v}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        placeholder="Digite aqui"
                      />
                      {q.description && <div className="mt-2 text-xs text-slate-500">{q.description}</div>}
                    </div>
                  );
                }

                if (q.type === 'text_long') {
                  const v = typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
                  return (
                    <div key={q.id}>
                      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
                      <textarea
                        className="min-h-28 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        value={v}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        placeholder="Escreva aqui"
                      />
                      {q.description && <div className="mt-2 text-xs text-slate-500">{q.description}</div>}
                    </div>
                  );
                }

                if (q.type === 'multiple_choice' && q.options.length > 0) {
                  const v = typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
                  return (
                    <div key={q.id}>
                      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={v}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {q.options
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((o) => (
                            <option key={o.id} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                      </select>
                      {q.description && <div className="mt-2 text-xs text-slate-500">{q.description}</div>}
                    </div>
                  );
                }

                return (
                  <div key={q.id}>
                    <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
                    <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Tipo de pergunta não suportado: {q.type}</div>
                  </div>
                );
              })}

              {survey.data.survey.collectCustomer && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Identificação (opcional)</div>
                      <div className="text-xs text-slate-500">Se você quiser, pode se identificar para que possamos retornar.</div>
                    </div>
                    <button
                      type="button"
                      className={[
                        'h-10 rounded-md border px-4 text-sm font-medium',
                        identify ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                      onClick={() => setIdentify((v) => !v)}
                    >
                      {identify ? 'Vou me identificar' : 'Quero me identificar'}
                    </button>
                  </div>

                  {identify && (
                    <div className="mt-4 grid gap-3">
                      <div>
                        <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
                        <input
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
                          <input
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            inputMode="email"
                          />
                        </div>
                        <div>
                          <div className="mb-1 text-sm font-medium text-slate-700">Telefone</div>
                          <input
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            inputMode="tel"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                disabled={submit.isPending}
                onClick={() => {
                  setFormError(null);
                  submit.mutate(undefined, {
                    onError: (err) => {
                      const code = err instanceof Error ? err.message : '';
                      if (code === 'missing_required') {
                        setFormError('Preencha os campos obrigatórios para continuar.');
                        return;
                      }
                      setFormError('Falha ao enviar. Tente novamente.');
                    },
                  });
                }}
              >
                {submit.isPending ? 'Enviando...' : 'Enviar'}
              </Button>

              {formError && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
