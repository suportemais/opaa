import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { QrCode } from '../components/QrCode';
import {
  DEFAULT_EXTRA_QUESTION_KIND,
  EXTRA_QUESTION_KIND_LABELS,
  EXTRA_QUESTION_KINDS,
  EXTRA_QUESTION_TYPE_MICROCOPY,
  extraQuestionKindFromType,
  persistedTypeFromExtraKind,
  type ExtraQuestionKind,
} from '../lib/question-types';
import { isActiveSurvey } from '../lib/survey-list';

const DELETE_COPY = {
  action: 'Apagar',
  title: 'Apagar pesquisa?',
  body: (name: string) => `“${name}” some da listagem. Não dá pra desfazer por aqui.`,
  confirm: 'Apagar pesquisa',
  cancel: 'Cancelar',
} as const;

type Unit = { id: string; name: string };
type Survey = { id: string; name: string; status: string; units: Array<{ unitId: string; unit: Unit }> };
type SurveyDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  collectCustomer: boolean;
  anonymousAllowed: boolean;
  collectEmployee: boolean;
  units: Array<{ unitId: string; unit: Unit }>;
  draftVersion: {
    questions: Array<{
      id: string;
      title: string;
      type: string;
      required: boolean;
      config?: { when?: { npsMax?: number; npsMin?: number } } | null;
      options?: Array<{ id?: string; label: string; value: string; negative?: boolean; order?: number }>;
    }>;
  } | null;
};
type Distribution = {
  id: string;
  surveyId: string;
  unitId: string | null;
  employeeId: string | null;
  channel: string;
  campaign: string | null;
  publicToken: string;
  active: boolean;
  createdAt: string;
  unit?: Unit | null;
};

type ChoiceOptionDraft = {
  id: string;
  label: string;
  value: string;
  negative: boolean;
};

type QuestionDraft = {
  id: string;
  title: string;
  kind: ExtraQuestionKind;
  storedType?: string;
  required: boolean;
  onlyLowScore: boolean;
  options: ChoiceOptionDraft[];
};

function emptyChoiceOption(label = ''): ChoiceOptionDraft {
  return { id: crypto.randomUUID(), label, value: crypto.randomUUID(), negative: false };
}

function defaultChoiceOptions(): ChoiceOptionDraft[] {
  return [emptyChoiceOption(), emptyChoiceOption()];
}

function emptyExtraQuestion(title = 'Nova pergunta'): QuestionDraft {
  return {
    id: crypto.randomUUID(),
    title,
    kind: DEFAULT_EXTRA_QUESTION_KIND,
    storedType: 'text_long',
    required: false,
    onlyLowScore: false,
    options: [],
  };
}

function identityStateFromSurvey(s: Pick<SurveyDetail, 'collectCustomer' | 'anonymousAllowed' | 'collectEmployee'>) {
  return {
    collectEmployee: s.collectEmployee,
    collectCustomer: s.collectCustomer,
    requireCustomerIdentity: Boolean(s.collectCustomer) && s.anonymousAllowed === false,
  };
}

function identityPayload(state: {
  collectCustomer: boolean;
  requireCustomerIdentity: boolean;
  collectEmployee: boolean;
}) {
  return {
    collectCustomer: state.collectCustomer,
    anonymousAllowed: state.collectCustomer ? !state.requireCustomerIdentity : true,
    collectEmployee: state.collectEmployee,
  };
}

function isIdentityDirty(
  local: {
    collectEmployee: boolean;
    collectCustomer: boolean;
    requireCustomerIdentity: boolean;
  },
  survey: Pick<SurveyDetail, 'collectCustomer' | 'anonymousAllowed' | 'collectEmployee'>,
) {
  const saved = identityStateFromSurvey(survey);
  return (
    local.collectEmployee !== saved.collectEmployee ||
    local.collectCustomer !== saved.collectCustomer ||
    local.requireCustomerIdentity !== saved.requireCustomerIdentity
  );
}

function SurveyIdentityCheckboxes(props: {
  collectEmployee: boolean;
  collectCustomer: boolean;
  requireCustomerIdentity: boolean;
  disabled?: boolean;
  onCollectEmployee: (checked: boolean) => void;
  onCollectCustomer: (checked: boolean) => void;
  onRequireCustomerIdentity: (checked: boolean) => void;
}) {
  return (
    <div className="md:col-span-2 grid gap-2">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={props.collectEmployee}
          disabled={props.disabled}
          onChange={(e) => props.onCollectEmployee(e.target.checked)}
        />
        Perguntar “Atendente” na pesquisa
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={props.collectCustomer}
          disabled={props.disabled}
          onChange={(e) => props.onCollectCustomer(e.target.checked)}
        />
        Coletar identificação do cliente
      </label>
      <label
        className={[
          'flex items-center gap-2 text-sm text-slate-700',
          props.collectCustomer ? '' : 'opacity-50',
        ].join(' ')}
      >
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={props.requireCustomerIdentity}
          disabled={props.disabled || !props.collectCustomer}
          onChange={(e) => props.onRequireCustomerIdentity(e.target.checked)}
        />
        Obrigar o cliente a se identificar
      </label>
    </div>
  );
}

export function SurveysPage() {
  const qc = useQueryClient();
  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });
  const tenant = useQuery({ queryKey: ['tenantMe'], queryFn: () => apiFetch<{ settings?: { badScoreThreshold?: number } }>('/tenant/me') });
  const surveys = useQuery({
    queryKey: ['surveys'],
    queryFn: () => apiFetch<Survey[]>('/surveys'),
  });

  const badScoreThreshold = useMemo(() => {
    const v = tenant.data?.settings?.badScoreThreshold;
    return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 6;
  }, [tenant.data]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const draftDetail = useQuery({
    queryKey: ['surveyDetail', editingId],
    queryFn: () => apiFetch<SurveyDetail>(`/surveys/${editingId}`),
    enabled: Boolean(editingId),
  });

  const [name, setName] = useState('Pesquisa de satisfação');
  const [description, setDescription] = useState('Conte como foi sua experiência.');
  const [collectEmployee, setCollectEmployee] = useState(true);
  const [collectCustomer, setCollectCustomer] = useState(true);
  const [requireCustomerIdentity, setRequireCustomerIdentity] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => [
    emptyExtraQuestion('O que poderíamos melhorar?'),
  ]);

  const defaultUnitId = useMemo(() => units.data?.[0]?.id ?? null, [units.data]);
  const [unitId, setUnitId] = useState<string | null>(null);

  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [distributionUnitId, setDistributionUnitId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const distributions = useQuery({
    queryKey: ['surveyDistributions', activeSurveyId],
    queryFn: () => apiFetch<Distribution[]>(`/surveys/${activeSurveyId}/distributions`),
    enabled: Boolean(activeSurveyId),
  });

  const activeSurveyDetail = useQuery({
    queryKey: ['surveyDetail', activeSurveyId],
    queryFn: () => apiFetch<SurveyDetail>(`/surveys/${activeSurveyId}`),
    enabled: Boolean(activeSurveyId),
  });

  const [linksCollectEmployee, setLinksCollectEmployee] = useState(true);
  const [linksCollectCustomer, setLinksCollectCustomer] = useState(true);
  const [linksRequireCustomerIdentity, setLinksRequireCustomerIdentity] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    if (!draftDetail.isFetched || !draftDetail.data) return;
    const s = draftDetail.data;
    setName(s.name);
    setDescription(s.description ?? '');
    const identity = identityStateFromSurvey(s);
    setCollectEmployee(identity.collectEmployee);
    setCollectCustomer(identity.collectCustomer);
    setRequireCustomerIdentity(identity.requireCustomerIdentity);
    const firstUnit = s.units[0]?.unitId ?? null;
    if (firstUnit) setUnitId(firstUnit);
    const extras: QuestionDraft[] =
      s.draftVersion?.questions
        .filter((q) => q.type !== 'nps')
        .map((q) => {
          const kind = extraQuestionKindFromType(q.type);
          const options =
            q.options?.map((o) => ({
              id: o.id ?? crypto.randomUUID(),
              label: o.label,
              value: o.value,
              negative: Boolean(o.negative),
            })) ?? [];
          return {
            id: q.id,
            title: q.title,
            kind,
            storedType: q.type,
            required: q.required,
            onlyLowScore: Boolean(q.config?.when?.npsMax),
            options: kind === 'single_choice' && options.length < 2 ? defaultChoiceOptions() : options,
          };
        }) ?? [];
    setQuestions(extras);
  }, [editingId, draftDetail.data, draftDetail.isFetched]);

  useEffect(() => {
    if (!activeSurveyId) return;
    if (!activeSurveyDetail.isFetched || !activeSurveyDetail.data) return;
    const identity = identityStateFromSurvey(activeSurveyDetail.data);
    setLinksCollectEmployee(identity.collectEmployee);
    setLinksCollectCustomer(identity.collectCustomer);
    setLinksRequireCustomerIdentity(identity.requireCustomerIdentity);
  }, [activeSurveyId, activeSurveyDetail.data, activeSurveyDetail.isFetched]);

  const startEditing = (surveyId: string) => {
    setEditingId(surveyId);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setName('Pesquisa de satisfação');
    setDescription('Conte como foi sua experiência.');
    setCollectEmployee(true);
    setCollectCustomer(true);
    setRequireCustomerIdentity(false);
    setQuestions([emptyExtraQuestion('O que poderíamos melhorar?')]);
    setUnitId(null);
    qc.invalidateQueries({ queryKey: ['surveyDetail'] });
  };

  const buildQuestionsPayload = () => [
    { title: 'De 1 a 10, o quanto você nos recomendaria?', type: 'nps' as const, required: true },
    ...questions.map((q) => ({
      title: q.title,
      type: persistedTypeFromExtraKind(q.kind, q.storedType),
      required: q.required,
      config: q.onlyLowScore ? { when: { npsMax: badScoreThreshold } } : undefined,
      options:
        q.kind === 'single_choice'
          ? q.options
              .filter((o) => o.label.trim())
              .map((o) => ({
                label: o.label.trim(),
                value: o.value,
                negative: o.negative,
              }))
          : undefined,
    })),
  ];

  const create = useMutation({
    mutationFn: async () => {
      const u = unitId ?? defaultUnitId;
      if (!u) throw new Error('no_unit');

      const created = await apiFetch<{ id: string }>('/surveys', {
        method: 'POST',
        json: {
          name,
          description,
          ...identityPayload({ collectCustomer, requireCustomerIdentity, collectEmployee }),
          unitIds: [u],
          questions: buildQuestionsPayload(),
        },
      });

      const published = await apiFetch<{ publicToken: string }>(`/surveys/${created.id}/publish`, {
        method: 'POST',
      });

      return { createdId: created.id, publicToken: published.publicToken };
    },
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['surveys'] }), qc.invalidateQueries({ queryKey: ['units'] })]);
    },
  });

  const updateDraft = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('no_editing');
      const u = unitId ?? defaultUnitId;
      if (!u) throw new Error('no_unit');
      return apiFetch<{ ok: boolean; id: string }>(`/surveys/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        json: {
          name,
          description,
          ...identityPayload({ collectCustomer, requireCustomerIdentity, collectEmployee }),
          unitIds: [u],
          questions: buildQuestionsPayload(),
        },
      });
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['surveys'] });
      await qc.invalidateQueries({ queryKey: ['surveyDetail', data?.id] });
    },
  });

  const saveAndPublish = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error('no_editing');
      const u = unitId ?? defaultUnitId;
      if (!u) throw new Error('no_unit');
      await apiFetch<{ ok: boolean }>(`/surveys/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        json: {
          name,
          description,
          ...identityPayload({ collectCustomer, requireCustomerIdentity, collectEmployee }),
          unitIds: [u],
          questions: buildQuestionsPayload(),
        },
      });
      return apiFetch<{ publicToken: string }>(`/surveys/${encodeURIComponent(editingId)}/publish`, {
        method: 'POST',
      });
    },
    onSuccess: async (_, _vars, _ctx) => {
      const id = editingId;
      cancelEditing();
      await Promise.all([qc.invalidateQueries({ queryKey: ['surveys'] }), qc.invalidateQueries({ queryKey: ['surveyDistributions', id] })]);
    },
  });

  const createDistribution = useMutation({
    mutationFn: async () => {
      if (!activeSurveyId) throw new Error('no_survey');
      const u = distributionUnitId ?? defaultUnitId;
      if (!u) throw new Error('no_unit');

      return apiFetch<Distribution>('/surveys/distributions', {
        method: 'POST',
        json: { surveyId: activeSurveyId, unitId: u, channel: 'qrcode' },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['surveyDistributions', activeSurveyId] });
    },
  });

  const updateIdentitySettings = useMutation({
    mutationFn: async () => {
      if (!activeSurveyId) throw new Error('no_survey');
      return apiFetch<{ ok: boolean; id: string }>(`/surveys/${encodeURIComponent(activeSurveyId)}`, {
        method: 'PATCH',
        json: identityPayload({
          collectCustomer: linksCollectCustomer,
          requireCustomerIdentity: linksRequireCustomerIdentity,
          collectEmployee: linksCollectEmployee,
        }),
      });
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['surveyDetail', data?.id] });
      await qc.invalidateQueries({ queryKey: ['surveys'] });
    },
  });

  const archiveSurvey = useMutation({
    mutationFn: (surveyId: string) =>
      apiFetch<{ ok: boolean }>(`/surveys/${encodeURIComponent(surveyId)}`, {
        method: 'DELETE',
      }),
    onSuccess: async (_, surveyId) => {
      setActiveSurveyId((cur) => (cur === surveyId ? null : cur));
      if (editingId === surveyId) cancelEditing();
      await qc.invalidateQueries({ queryKey: ['surveys'] });
      await qc.invalidateQueries({ queryKey: ['surveyDistributions'] });
    },
  });

  const deleteSurvey = useMutation({
    mutationFn: (surveyId: string) =>
      apiFetch<{ ok: boolean }>(`/surveys/${encodeURIComponent(surveyId)}/delete`, {
        method: 'POST',
      }),
    onSuccess: async (_, surveyId) => {
      setPendingDelete(null);
      setActiveSurveyId((cur) => (cur === surveyId ? null : cur));
      if (editingId === surveyId) cancelEditing();
      await qc.invalidateQueries({ queryKey: ['surveys'] });
      await qc.invalidateQueries({ queryKey: ['surveyDistributions'] });
    },
  });

  const listedSurveys = useMemo(
    () => (surveys.data ?? []).filter(isActiveSurvey),
    [surveys.data],
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publishedToken = create.data?.publicToken ?? saveAndPublish.data?.publicToken ?? null;

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Pesquisas</div>
        <div className="text-sm text-slate-600">Versões imutáveis (publicadas) e rascunhos</div>
      </div>

      <Card title={editingId ? 'Editar pesquisa (rascunho)' : 'Criar e publicar pesquisa (MVP)'}>
        {editingId && (
          <div className="mb-3 flex items-center justify-end">
            <Button variant="ghost" onClick={cancelEditing} disabled={updateDraft.isPending || saveAndPublish.isPending}>
              Cancelar edição
            </Button>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Descrição</div>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <SurveyIdentityCheckboxes
            collectEmployee={collectEmployee}
            collectCustomer={collectCustomer}
            requireCustomerIdentity={requireCustomerIdentity}
            onCollectEmployee={setCollectEmployee}
            onCollectCustomer={(checked) => {
              setCollectCustomer(checked);
              if (!checked) setRequireCustomerIdentity(false);
            }}
            onRequireCustomerIdentity={setRequireCustomerIdentity}
          />
          <div className="md:col-span-2">
            <div className="mb-2 text-sm font-medium text-slate-700">Perguntas</div>
            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-sm font-medium text-slate-900">Pergunta base (fixa)</div>
                <div className="text-sm text-slate-700">De 1 a 10, o quanto você nos recomendaria?</div>
              </div>

              {questions.map((q) => (
                <div key={q.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <div className="mb-1 text-sm font-medium text-slate-700">Título</div>
                      <Input
                        value={q.title}
                        onChange={(e) =>
                          setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, title: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-sm font-medium text-slate-700">Tipo</div>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={q.kind}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((x) => {
                              if (x.id !== q.id) return x;
                              const kind = e.target.value as ExtraQuestionKind;
                              return {
                                ...x,
                                kind,
                                options:
                                  kind === 'single_choice' && x.options.length < 2
                                    ? defaultChoiceOptions()
                                    : x.options,
                              };
                            }),
                          )
                        }
                      >
                        {EXTRA_QUESTION_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {EXTRA_QUESTION_KIND_LABELS[kind]}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-xs text-slate-500">{EXTRA_QUESTION_TYPE_MICROCOPY}</div>
                    </div>
                    <div className="md:col-span-3 flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((x) => (x.id === q.id ? { ...x, required: e.target.checked } : x)),
                            )
                          }
                        />
                        Obrigatória
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={q.onlyLowScore}
                          onChange={(e) =>
                            setQuestions((prev) =>
                              prev.map((x) => (x.id === q.id ? { ...x, onlyLowScore: e.target.checked } : x)),
                            )
                          }
                        />
                        Só se nota ≤ {badScoreThreshold}
                      </label>
                      <button
                        type="button"
                        className="text-sm font-medium text-rose-700 hover:text-rose-800"
                        onClick={() => setQuestions((prev) => prev.filter((x) => x.id !== q.id))}
                      >
                        Remover
                      </button>
                    </div>
                    {q.kind === 'single_choice' && (
                      <div className="md:col-span-3 grid gap-2">
                        <div className="text-sm font-medium text-slate-700">Opções</div>
                        {q.options.map((opt) => (
                          <div key={opt.id} className="flex flex-wrap items-center gap-2">
                            <div className="min-w-[12rem] flex-1">
                              <Input
                                value={opt.label}
                                placeholder="Texto da opção"
                                onChange={(e) =>
                                  setQuestions((prev) =>
                                    prev.map((x) =>
                                      x.id === q.id
                                        ? {
                                            ...x,
                                            options: x.options.map((o) =>
                                              o.id === opt.id ? { ...o, label: e.target.value } : o,
                                            ),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={opt.negative}
                                onChange={(e) =>
                                  setQuestions((prev) =>
                                    prev.map((x) =>
                                      x.id === q.id
                                        ? {
                                            ...x,
                                            options: x.options.map((o) =>
                                              o.id === opt.id ? { ...o, negative: e.target.checked } : o,
                                            ),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              />
                              Negativa
                            </label>
                            <button
                              type="button"
                              className="text-sm font-medium text-rose-700 hover:text-rose-800"
                              onClick={() =>
                                setQuestions((prev) =>
                                  prev.map((x) =>
                                    x.id === q.id
                                      ? { ...x, options: x.options.filter((o) => o.id !== opt.id) }
                                      : x,
                                  ),
                                )
                              }
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setQuestions((prev) =>
                                prev.map((x) =>
                                  x.id === q.id ? { ...x, options: [...x.options, emptyChoiceOption()] } : x,
                                ),
                              )
                            }
                          >
                            Adicionar opção
                          </Button>
                          {q.options.filter((o) => o.label.trim()).length < 2 && (
                            <div className="text-xs text-slate-500">Defina pelo menos 2 opções.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <Button
                variant="secondary"
                onClick={() => setQuestions((prev) => [...prev, emptyExtraQuestion()])}
              >
                Adicionar pergunta
              </Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Unidade</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={unitId ?? defaultUnitId ?? ''}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={units.isLoading || !units.data?.length}
            >
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {publishedToken && (
            <div className="md:col-span-2 rounded-md bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Link público</div>
              <a
                className="font-mono text-sky-700 hover:underline"
                href={`/public/${publishedToken}`}
                target="_blank"
                rel="noreferrer"
              >
                /public/{publishedToken}
              </a>
            </div>
          )}

          <div className="md:col-span-2 flex flex-wrap gap-2">
            {!editingId && (
              <Button disabled={create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? 'Publicando...' : 'Criar e publicar'}
              </Button>
            )}
            {editingId && (
              <>
                <Button
                  variant="secondary"
                  disabled={updateDraft.isPending || saveAndPublish.isPending || draftDetail.isFetching}
                  onClick={() => updateDraft.mutate()}
                >
                  {updateDraft.isPending ? 'Salvando...' : 'Salvar rascunho'}
                </Button>
                <Button disabled={saveAndPublish.isPending || updateDraft.isPending || draftDetail.isFetching} onClick={() => saveAndPublish.mutate()}>
                  {saveAndPublish.isPending ? 'Publicando...' : 'Salvar e publicar'}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card title="Lista">
        {surveys.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {surveys.isError && <div className="text-sm text-rose-700">Falha ao carregar pesquisas</div>}
        {surveys.data && listedSurveys.length === 0 && <div className="text-sm text-slate-600">Nenhuma pesquisa</div>}
        {listedSurveys.length > 0 && (
          <div className="divide-y divide-slate-200">
            {listedSurveys.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.status}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.status === 'draft' && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setActiveSurveyId(null);
                        startEditing(s.id);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setActiveSurveyId((cur) => (cur === s.id ? null : s.id));
                      setDistributionUnitId(defaultUnitId);
                      updateIdentitySettings.reset();
                    }}
                  >
                    Links
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={archiveSurvey.isPending || deleteSurvey.isPending}
                    onClick={() => {
                      const ok = window.confirm(`Arquivar a pesquisa "${s.name}"? Os links públicos serão desativados.`);
                      if (!ok) return;
                      archiveSurvey.mutate(s.id);
                    }}
                  >
                    Arquivar
                  </Button>
                  <Button
                    variant="danger"
                    disabled={archiveSurvey.isPending || deleteSurvey.isPending}
                    onClick={() => setPendingDelete({ id: s.id, name: s.name })}
                  >
                    {DELETE_COPY.action}
                  </Button>
                  <div className="text-xs font-mono text-slate-500">{s.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog.Root
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteSurvey.isPending) setPendingDelete(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl focus:outline-none">
            <Dialog.Title className="text-lg font-semibold text-slate-900">{DELETE_COPY.title}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-600">
              {pendingDelete ? DELETE_COPY.body(pendingDelete.name) : null}
            </Dialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                disabled={deleteSurvey.isPending}
                onClick={() => setPendingDelete(null)}
              >
                {DELETE_COPY.cancel}
              </Button>
              <Button
                variant="danger"
                disabled={!pendingDelete || deleteSurvey.isPending}
                onClick={() => {
                  if (!pendingDelete) return;
                  deleteSurvey.mutate(pendingDelete.id);
                }}
              >
                {DELETE_COPY.confirm}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {activeSurveyId && (
        <Card title="Links e QR Codes" description="Distribuições públicas da pesquisa selecionada">
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Identificação</div>
                <div className="text-xs text-slate-600">
                  Mesmas opções da criação. Alterações valem para as próximas respostas nos links abaixo.
                </div>
              </div>
              {activeSurveyDetail.isLoading && <div className="text-sm text-slate-600">Carregando configurações...</div>}
              {activeSurveyDetail.isError && (
                <div className="text-sm text-rose-700">Falha ao carregar configurações da pesquisa</div>
              )}
              {activeSurveyDetail.data && (
                <>
                  <SurveyIdentityCheckboxes
                    collectEmployee={linksCollectEmployee}
                    collectCustomer={linksCollectCustomer}
                    requireCustomerIdentity={linksRequireCustomerIdentity}
                    disabled={activeSurveyDetail.data.status === 'archived'}
                    onCollectEmployee={setLinksCollectEmployee}
                    onCollectCustomer={(checked) => {
                      setLinksCollectCustomer(checked);
                      if (!checked) setLinksRequireCustomerIdentity(false);
                    }}
                    onRequireCustomerIdentity={setLinksRequireCustomerIdentity}
                  />
                  {activeSurveyDetail.data.status === 'archived' ? (
                    <div className="text-sm text-slate-600">Pesquisa arquivada. Identificação não pode ser alterada.</div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        disabled={
                          updateIdentitySettings.isPending ||
                          activeSurveyDetail.isFetching ||
                          !isIdentityDirty(
                            {
                              collectEmployee: linksCollectEmployee,
                              collectCustomer: linksCollectCustomer,
                              requireCustomerIdentity: linksRequireCustomerIdentity,
                            },
                            activeSurveyDetail.data,
                          )
                        }
                        onClick={() => updateIdentitySettings.mutate()}
                      >
                        {updateIdentitySettings.isPending ? 'Salvando...' : 'Salvar identificação'}
                      </Button>
                      {updateIdentitySettings.isError && (
                        <div className="text-sm text-rose-700">Falha ao salvar identificação</div>
                      )}
                      {updateIdentitySettings.isSuccess &&
                        !isIdentityDirty(
                          {
                            collectEmployee: linksCollectEmployee,
                            collectCustomer: linksCollectCustomer,
                            requireCustomerIdentity: linksRequireCustomerIdentity,
                          },
                          activeSurveyDetail.data,
                        ) && <div className="text-sm text-emerald-700">Configurações salvas.</div>}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="mb-1 text-sm font-medium text-slate-700">Unidade</div>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={distributionUnitId ?? defaultUnitId ?? ''}
                  onChange={(e) => setDistributionUnitId(e.target.value)}
                  disabled={units.isLoading || !units.data?.length}
                >
                  {units.data?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button disabled={createDistribution.isPending} onClick={() => createDistribution.mutate()}>
                  {createDistribution.isPending ? 'Gerando...' : 'Gerar novo QR'}
                </Button>
              </div>
            </div>

            {distributions.isLoading && <div className="text-sm text-slate-600">Carregando links...</div>}
            {distributions.isError && <div className="text-sm text-rose-700">Falha ao carregar links</div>}
            {distributions.data && distributions.data.length === 0 && (
              <div className="text-sm text-slate-600">Nenhuma distribuição</div>
            )}
            {distributions.data && distributions.data.length > 0 && (
              <div className="grid gap-4">
                {distributions.data.map((d) => {
                  const path = `/public/${d.publicToken}`;
                  const url = `${origin}${path}`;
                  return (
                    <div key={d.id} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[240px_1fr]">
                      <div className="flex items-start justify-center md:justify-start">
                        <QrCode value={url} />
                      </div>
                      <div className="grid gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900">Canal</div>
                            <div className="text-sm text-slate-700">{d.channel}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-slate-900">Unidade</div>
                            <div className="text-sm text-slate-700">{d.unit?.name ?? '—'}</div>
                          </div>
                        </div>

                        <div className="rounded-md bg-slate-50 p-3 text-sm">
                          <div className="text-slate-500">Link público</div>
                          <a className="font-mono text-sky-700 hover:underline" href={path} target="_blank" rel="noreferrer">
                            {path}
                          </a>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(url);
                              } catch {}
                            }}
                          >
                            Copiar link
                          </Button>
                          <a
                            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
