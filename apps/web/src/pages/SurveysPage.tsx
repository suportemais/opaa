import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { QrCode } from '../components/QrCode';

type Unit = { id: string; name: string };
type Survey = { id: string; name: string; status: string; units: Array<{ unitId: string; unit: Unit }> };
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

  const [name, setName] = useState('Pesquisa de satisfação');
  const [description, setDescription] = useState('Conte como foi sua experiência.');
  const [collectEmployee, setCollectEmployee] = useState(true);
  const [questions, setQuestions] = useState<
    Array<{ id: string; title: string; type: 'text_short' | 'text_long'; required: boolean; onlyLowScore: boolean }>
  >(() => [{ id: crypto.randomUUID(), title: 'O que poderíamos melhorar?', type: 'text_long', required: false, onlyLowScore: false }]);

  const defaultUnitId = useMemo(() => units.data?.[0]?.id ?? null, [units.data]);
  const [unitId, setUnitId] = useState<string | null>(null);

  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [distributionUnitId, setDistributionUnitId] = useState<string | null>(null);

  const distributions = useQuery({
    queryKey: ['surveyDistributions', activeSurveyId],
    queryFn: () => apiFetch<Distribution[]>(`/surveys/${activeSurveyId}/distributions`),
    enabled: Boolean(activeSurveyId),
  });

  const create = useMutation({
    mutationFn: async () => {
      const u = unitId ?? defaultUnitId;
      if (!u) throw new Error('no_unit');

      const created = await apiFetch<{ id: string }>('/surveys', {
        method: 'POST',
        json: {
          name,
          description,
          collectCustomer: true,
          collectEmployee,
          unitIds: [u],
          questions: [
            { title: 'De 1 a 10, o quanto você nos recomendaria?', type: 'nps', required: true },
            ...questions.map((q) => ({
              title: q.title,
              type: q.type,
              required: q.required,
              config: q.onlyLowScore ? { when: { npsMax: badScoreThreshold } } : undefined,
            })),
          ],
        },
      });

      const published = await apiFetch<{ publicToken: string }>(`/surveys/${created.id}/publish`, {
        method: 'POST',
      });

      return { createdId: created.id, publicToken: published.publicToken };
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['surveys'] }),
        qc.invalidateQueries({ queryKey: ['units'] }),
      ]);
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

  const archiveSurvey = useMutation({
    mutationFn: (surveyId: string) =>
      apiFetch<{ ok: boolean }>(`/surveys/${encodeURIComponent(surveyId)}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      setActiveSurveyId(null);
      await qc.invalidateQueries({ queryKey: ['surveys'] });
      await qc.invalidateQueries({ queryKey: ['surveyDistributions'] });
    },
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Pesquisas</div>
        <div className="text-sm text-slate-600">Versões imutáveis (publicadas) e rascunhos</div>
      </div>

      <Card title="Criar e publicar pesquisa (MVP)">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Descrição</div>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={collectEmployee}
                onChange={(e) => setCollectEmployee(e.target.checked)}
              />
              Perguntar “Atendente” na pesquisa
            </label>
          </div>
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
                        value={q.type}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((x) => (x.id === q.id ? { ...x, type: e.target.value as any } : x)),
                          )
                        }
                      >
                        <option value="text_long">Texto longo</option>
                        <option value="text_short">Texto curto</option>
                      </select>
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
                  </div>
                </div>
              ))}

              <Button
                variant="secondary"
                onClick={() =>
                  setQuestions((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), title: 'Nova pergunta', type: 'text_long', required: false, onlyLowScore: false },
                  ])
                }
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

          {create.data?.publicToken && (
            <div className="md:col-span-2 rounded-md bg-slate-50 p-3 text-sm">
              <div className="text-slate-500">Link público</div>
              <a
                className="font-mono text-sky-700 hover:underline"
                href={`/public/${create.data.publicToken}`}
                target="_blank"
                rel="noreferrer"
              >
                /public/{create.data.publicToken}
              </a>
            </div>
          )}

          <div className="md:col-span-2">
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Publicando...' : 'Criar e publicar'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Lista">
        {surveys.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {surveys.isError && <div className="text-sm text-rose-700">Falha ao carregar pesquisas</div>}
        {surveys.data && surveys.data.length === 0 && <div className="text-sm text-slate-600">Nenhuma pesquisa</div>}
        {surveys.data && surveys.data.length > 0 && (
          <div className="divide-y divide-slate-200">
            {surveys.data.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setActiveSurveyId((cur) => (cur === s.id ? null : s.id));
                      setDistributionUnitId(defaultUnitId);
                    }}
                  >
                    Links
                  </Button>
                  {s.status !== 'archived' && (
                    <Button
                      variant="ghost"
                      disabled={archiveSurvey.isPending}
                      onClick={() => {
                        const ok = window.confirm(`Arquivar a pesquisa "${s.name}"? Os links públicos serão desativados.`);
                        if (!ok) return;
                        archiveSurvey.mutate(s.id);
                      }}
                    >
                      Arquivar
                    </Button>
                  )}
                  <div className="text-xs font-mono text-slate-500">{s.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {activeSurveyId && (
        <Card title="Links e QR Codes" description="Distribuições públicas da pesquisa selecionada">
          <div className="grid gap-4">
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
