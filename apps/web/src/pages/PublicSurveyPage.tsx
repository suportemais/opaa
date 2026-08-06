import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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
  settings?: { badScoreThreshold?: number };
  unit?: { id: string; name: string; googleBusinessUrl: string | null } | null;
  survey: {
    name: string;
    description: string | null;
    introMessage: string | null;
    outroMessage: string | null;
    collectCustomer: boolean;
    collectEmployee?: boolean;
    questions: PublicQuestion[];
  };
};

type PublicEmployee = { id: string; name: string; code: string | null; roleTitle: string | null };

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
  const badScoreThreshold = useMemo(() => {
    const v = survey.data?.settings?.badScoreThreshold;
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 6;
  }, [survey.data]);

  const [answers, setAnswers] = useState<Record<string, unknown>>(() => ({}));
  const [complaint, setComplaint] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [identify, setIdentify] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const collectEmployee = Boolean(survey.data?.survey.collectEmployee);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<PublicEmployee | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setEmployeeQuery(employeeSearch), 250);
    return () => clearTimeout(t);
  }, [employeeSearch]);

  useEffect(() => {
    if (!employeeOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-employee-box]')) setEmployeeOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [employeeOpen]);

  const employees = useQuery({
    queryKey: ['publicSurveyEmployees', token, employeeQuery],
    queryFn: () => apiFetch<PublicEmployee[]>(`/public/surveys/${token}/employees?q=${encodeURIComponent(employeeQuery)}`),
    enabled: Boolean(token) && collectEmployee && !submitted,
  });

  const selectedNps = useMemo(() => {
    if (!npsQuestion) return null;
    const v = answers[npsQuestion.id];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return null;
  }, [answers, npsQuestion]);

  const effectiveNpsForVisibility = selectedNps ?? 10;

  const visibleQuestions = useMemo(() => {
    return questions.filter((q) => {
      const cfg = q.config as QuestionConfig | null | undefined;
      const when = cfg?.when;
      if (!when) return true;
      if (typeof when.npsMin === 'number' && effectiveNpsForVisibility < when.npsMin) return false;
      if (typeof when.npsMax === 'number' && effectiveNpsForVisibility > when.npsMax) return false;
      return true;
    });
  }, [questions, effectiveNpsForVisibility]);

  const otherVisibleQuestions = useMemo(() => {
    return visibleQuestions.filter((q) => (npsQuestion ? q.id !== npsQuestion.id : true));
  }, [visibleQuestions, npsQuestion]);

  const steps = useMemo(() => {
    const out: Array<{ key: string; type: 'employee' | 'nps' | 'complaint' | 'question'; question?: PublicQuestion }> = [];
    if (collectEmployee) out.push({ key: 'employee', type: 'employee' });
    if (npsQuestion) out.push({ key: `nps:${npsQuestion.id}`, type: 'nps', question: npsQuestion });
    if (typeof selectedNps === 'number' && selectedNps <= badScoreThreshold) out.push({ key: 'complaint', type: 'complaint' });
    for (const q of otherVisibleQuestions) out.push({ key: `q:${q.id}`, type: 'question', question: q });
    return out;
  }, [collectEmployee, npsQuestion, selectedNps, otherVisibleQuestions, badScoreThreshold]);

  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(Math.max(steps.length - 1, 0));
  }, [stepIndex, steps.length]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!npsQuestion) throw new Error('missing_nps');
      const idempotencyKey = sessionStorage.getItem(`opaa_pub_${token}`) ?? randomId(16);
      sessionStorage.setItem(`opaa_pub_${token}`, idempotencyKey);

      const outAnswers: Array<{ questionId: string; value: unknown }> = [];
      const nextAnswers: Record<string, unknown> = { ...answers };
      const npsValue = nextAnswers[npsQuestion.id];
      if (typeof npsValue !== 'number' || !Number.isFinite(npsValue)) {
        throw new Error('missing_required');
      }
      nextAnswers[npsQuestion.id] = npsValue;

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

      const customer = identify
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
          employeeId: selectedEmployee?.id ?? undefined,
          complaint: complaint.trim() || undefined,
          answers: outAnswers,
          customer: hasCustomerField ? customer : undefined,
          clientMetadata: { ua: navigator.userAgent },
        },
      });
    },
    onSuccess: () => {
      setFormError(null);
      setSubmitted(true);
      sessionStorage.removeItem(`opaa_pub_${token}`);
    },
  });

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function canGoNext() {
    const step = steps[stepIndex];
    if (!step) return false;
    if (step.type === 'employee') return true;
    if (step.type === 'nps') return typeof selectedNps === 'number' && selectedNps >= 1 && selectedNps <= 10;
    if (step.type === 'complaint') return true;
    if (step.type === 'question' && step.question) {
      const q = step.question;
      const cfg = q.config as QuestionConfig | null | undefined;
      const required = Boolean(q.required || cfg?.requiredWhenVisible);
      const v = answers[q.id];
      const missing =
        v === undefined || v === null
          ? true
          : typeof v === 'string'
            ? v.trim().length === 0
            : typeof v === 'number'
              ? !Number.isFinite(v)
              : false;
      return required ? !missing : true;
    }
    return true;
  }

  if (survey.isLoading) {
    return <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-sm text-slate-600">Carregando...</div>;
  }

  if (survey.isError || !survey.data) {
    return <div className="flex min-h-full items-center justify-center bg-slate-50 p-6 text-sm text-rose-700">Pesquisa não encontrada</div>;
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-44">
        <div className="text-center">
          <img src="/logo.svg" alt="Opiina" className="mx-auto mb-3 h-8 drop-shadow-sm" />
          <div className="text-xl font-semibold text-slate-900">{survey.data.survey.name}</div>
          {survey.data.survey.description && <div className="text-sm text-slate-600">{survey.data.survey.description}</div>}
        </div>

        {submitted ? (
          <Card title="Obrigado!" description="Sua resposta foi registrada.">
            <div className="text-sm text-slate-700">{survey.data.survey.outroMessage ?? 'Você pode fechar esta página.'}</div>
            {typeof selectedNps === 'number' &&
              selectedNps > badScoreThreshold &&
              survey.data.unit?.googleBusinessUrl &&
              survey.data.unit.googleBusinessUrl.trim().length > 0 && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-semibold text-emerald-900">Nos ajude com um comentário no Google</div>
                  <div className="mt-1 text-sm text-emerald-800">
                    Se você teve uma boa experiência, deixe um comentário no Google Meu Negócio da unidade.
                  </div>
                  <a
                    className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
                    href={survey.data.unit.googleBusinessUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Avaliar no Google
                  </a>
                </div>
              )}
          </Card>
        ) : (
          <Card>
            <div className="grid gap-4">
              {survey.data.survey.introMessage && stepIndex === 0 && (
                <div className="text-sm text-slate-700">{survey.data.survey.introMessage}</div>
              )}

              {(() => {
                const step = steps[stepIndex];
                if (!step) return null;

                if (step.type === 'employee') {
                  return (
                    <div className="relative" data-employee-box>
                      <div className="mb-2 text-sm font-medium text-slate-800">Atendente (opcional)</div>
                      <input
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        value={employeeSearch}
                        onChange={(e) => {
                          setEmployeeSearch(e.target.value);
                          setEmployeeOpen(true);
                          setSelectedEmployee(null);
                        }}
                        onFocus={() => setEmployeeOpen(true)}
                        placeholder="Digite o nome do atendente"
                      />
                      {selectedEmployee && (
                        <div className="mt-2 text-xs text-slate-600">
                          Selecionado: <span className="font-medium text-slate-900">{selectedEmployee.name}</span>
                        </div>
                      )}
                      {employeeOpen && (
                        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                          {employees.isLoading && <div className="px-3 py-2 text-sm text-slate-600">Carregando...</div>}
                          {employees.isError && (
                            <div className="px-3 py-2 text-sm text-rose-700">Falha ao carregar atendentes</div>
                          )}
                          {employees.data && employees.data.length === 0 && (
                            <div className="px-3 py-2 text-sm text-slate-600">Nenhum atendente encontrado</div>
                          )}
                          {employees.data && employees.data.length > 0 && (
                            <div className="max-h-60 overflow-auto">
                              {employees.data.map((e) => (
                                <button
                                  key={e.id}
                                  type="button"
                                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                                  onClick={() => {
                                    setSelectedEmployee(e);
                                    setEmployeeSearch(e.name);
                                    setEmployeeOpen(false);
                                  }}
                                >
                                  <div>
                                    <div className="font-medium text-slate-900">{e.name}</div>
                                    {(e.roleTitle || e.code) && (
                                      <div className="text-xs text-slate-500">{[e.roleTitle, e.code].filter(Boolean).join(' • ')}</div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="border-t border-slate-100 px-3 py-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-slate-600 hover:underline"
                              onClick={() => {
                                setSelectedEmployee(null);
                                setEmployeeSearch('');
                                setEmployeeOpen(false);
                              }}
                            >
                              Limpar seleção
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                if (step.type === 'nps' && step.question) {
                  const q = step.question;
                  const cfg = q.config as QuestionConfig | null | undefined;
                  const required = Boolean(q.required || cfg?.requiredWhenVisible);
                  const label = required ? `${q.title} *` : q.title;
                  return (
                    <div>
                      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
                      <div className="grid grid-cols-5 gap-2 md:grid-cols-10">
                        {Array.from({ length: 10 }).map((_, i) => {
                          const value = i + 1;
                          return (
                            <button
                              key={value}
                              type="button"
                              className={[
                                'h-10 rounded-md border text-sm font-medium',
                                selectedNps === value
                                  ? 'border-sky-600 bg-sky-600 text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                              ].join(' ')}
                              onClick={() => setAnswer(q.id, value)}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span>1 = muito ruim</span>
                        <span>10 = excelente</span>
                      </div>
                      {q.description && <div className="mt-2 text-xs text-slate-500">{q.description}</div>}
                    </div>
                  );
                }

                if (step.type === 'complaint') {
                  return (
                    <div>
                      <div className="mb-2 text-sm font-medium text-slate-800">Reclamação ou justificativa (opcional)</div>
                      <textarea
                        className="min-h-28 w-full resize-none rounded-md border border-slate-200 bg-white p-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        value={complaint}
                        onChange={(e) => setComplaint(e.target.value)}
                        placeholder="Conte rapidamente o que aconteceu"
                      />
                      <div className="mt-2 text-xs text-slate-500">Se preferir, você pode deixar em branco.</div>
                    </div>
                  );
                }

                if (step.type === 'question' && step.question) {
                  const q = step.question;
                  const cfg = q.config as QuestionConfig | null | undefined;
                  const required = Boolean(q.required || cfg?.requiredWhenVisible);
                  const label = required ? `${q.title} *` : q.title;

                  if (q.type === 'text_short') {
                    const v = typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
                    return (
                      <div>
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
                      <div>
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
                      <div>
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
                    <div>
                      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
                      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        Tipo de pergunta não suportado: {q.type}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="secondary"
                  disabled={stepIndex === 0}
                  onClick={() => {
                    setFormError(null);
                    setStepIndex((i) => Math.max(0, i - 1));
                  }}
                >
                  Voltar
                </Button>

                {stepIndex < steps.length - 1 ? (
                  <Button
                    disabled={!canGoNext()}
                    onClick={() => {
                      if (!canGoNext()) {
                        setFormError('Preencha os campos obrigatórios para continuar.');
                        return;
                      }
                      setFormError(null);
                      setStepIndex((i) => Math.min(steps.length - 1, i + 1));
                    }}
                  >
                    Próximo
                  </Button>
                ) : (
                  <Button
                    disabled={submit.isPending || !canGoNext()}
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
                )}
              </div>

              {formError && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}
            </div>
          </Card>
        )}
        <footer className="pt-6 text-center text-xs text-slate-500">
          Desenvolvido por{' '}
          <a className="text-sky-700 hover:underline" href="https://devmais.com" target="_blank" rel="noreferrer">
            Dev+
          </a>
        </footer>
      </div>

      {!submitted && (
        <div className="fixed bottom-4 left-1/2 w-[min(640px,calc(100%-2rem))] -translate-x-1/2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Identificação (opcional)</div>
                <div className="text-xs text-slate-500">Você pode se identificar em qualquer momento.</div>
              </div>
              <button
                type="button"
                className={[
                  'h-10 rounded-md border px-4 text-sm font-medium',
                  identify ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                ].join(' ')}
                onClick={() => setIdentify((v) => !v)}
              >
                {identify ? 'Não quero me identificar' : 'Quero me identificar'}
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
        </div>
      )}
    </div>
  );
}
