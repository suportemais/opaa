import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type ReviewPlatform = 'google' | 'ifood' | 'tripadvisor' | 'reclameaqui';
type SyncFrequency = 'every30m' | 'hourly' | 'every6h' | 'daily';

type ReviewProfile = {
  platform: ReviewPlatform;
  publicUrl: string | null;
  locationId: string | null;
  syncFrequency: SyncFrequency;
  syncStatus: 'idle' | 'running' | 'error' | 'paused';
  lastSyncAt: string | null;
  lastRating: number | null;
  lastReviewCount: number | null;
  lastPositiveCount: number | null;
  lastNeutralCount: number | null;
  lastNegativeCount: number | null;
  isPlaceholder?: boolean;
};

type Unit = {
  id: string;
  name: string;
  timeZone: string | null;
  internalCode: string | null;
  address: string | null;
  googleBusinessUrl: string | null;
};

function usePermissionCodes() {
  const { data } = useQuery({
    queryKey: ['authMe'],
    queryFn: () => apiFetch<{ permissionCodes: string[] }>('/auth/me').catch(() => ({ permissionCodes: [] })),
    staleTime: 60 * 1000,
    retry: false,
  });
  return data?.permissionCodes ?? [];
}

const PLATFORM_META: Record<ReviewPlatform, { label: string; color: string; icon: string; defaultFreq: SyncFrequency }> = {
  google:      { label: 'Google',         color: 'from-sky-500 to-blue-600',   icon: '🔍', defaultFreq: 'every6h' },
  ifood:       { label: 'iFood',          color: 'from-rose-500 to-red-600',   icon: '🍔', defaultFreq: 'hourly' },
  tripadvisor: { label: 'Tripadvisor',    color: 'from-emerald-500 to-teal-600', icon: '✈️', defaultFreq: 'daily' },
  reclameaqui: { label: 'Reclame Aqui',   color: 'from-amber-500 to-orange-600', icon: '📣', defaultFreq: 'every6h' },
};

export function UnitsPage() {
  const permissionCodes = usePermissionCodes();
  const canManageUnits = permissionCodes.includes('unit:manage');
  const canReviewManage = permissionCodes.includes('review:manage');
  const canReviewRead = permissionCodes.includes('review:read');
  const qc = useQueryClient();
  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => apiFetch<Unit[]>('/units'),
  });

  const [name, setName] = useState('');
  const [timeZone, setTimeZone] = useState('America/Sao_Paulo');
  const [address, setAddress] = useState('');
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState('');

  const [editingId, setEditingId] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editTimeZone, setEditTimeZone] = useState('America/Sao_Paulo');
  const [editAddress, setEditAddress] = useState('');
  const [editGoogleBusinessUrl, setEditGoogleBusinessUrl] = useState('');

  const [reviewEditingUnitId, setReviewEditingUnitId] = useState<string>('');
  const [reviewForms, setReviewForms] = useState<Record<string, Partial<ReviewProfile>>>({});

  const reviewProfiles = useQuery({
    queryKey: ['units', reviewEditingUnitId, 'reviewProfiles'],
    queryFn: () => apiFetch<ReviewProfile[]>(`/units/${encodeURIComponent(reviewEditingUnitId)}/review-profiles`),
    enabled: !!reviewEditingUnitId && canReviewRead,
  });

  const syncNow = useMutation({
    mutationFn: (vars: { unitId: string; platform: ReviewPlatform }) =>
      apiFetch<void>(`/units/${encodeURIComponent(vars.unitId)}/review-profiles/${vars.platform}/sync-now`, { method: 'POST' }),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: ['units', vars.unitId, 'reviewProfiles'] });
    },
  });

  const upsertProfile = useMutation({
    mutationFn: (vars: { unitId: string; data: { platform: ReviewPlatform; publicUrl?: string | null; locationId?: string | null; syncFrequency?: SyncFrequency } }) =>
      apiFetch<ReviewProfile>(`/units/${encodeURIComponent(vars.unitId)}/review-profiles`, {
        method: 'PUT',
        json: vars.data,
      }),
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: ['units', vars.unitId, 'reviewProfiles'] });
      setReviewForms((prev) => {
        const next = { ...prev };
        delete next[vars.data.platform];
        return next;
      });
    },
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Unit>('/units', {
        method: 'POST',
        json: {
          name,
          timeZone,
          address: address.trim() || undefined,
          googleBusinessUrl: googleBusinessUrl.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      setName('');
      setAddress('');
      setGoogleBusinessUrl('');
      await qc.invalidateQueries({ queryKey: ['units'] });
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      return apiFetch<Unit>(`/units/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        json: {
          name: editName.trim() || undefined,
          timeZone: editTimeZone.trim() || undefined,
          address: editAddress.trim() || undefined,
          googleBusinessUrl: editGoogleBusinessUrl.trim() || undefined,
        },
      });
    },
    onSuccess: async () => {
      setEditingId('');
      setEditName('');
      setEditTimeZone('America/Sao_Paulo');
      setEditAddress('');
      setEditGoogleBusinessUrl('');
      await qc.invalidateQueries({ queryKey: ['units'] });
    },
  });

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Unidades</div>
        <div className="text-sm text-slate-600">Gestão multiunidade por tenant</div>
      </div>

      {editingId && canManageUnits && (
        <Card title="Editar unidade" description="Atualize dados operacionais (endereço, fuso)">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome da unidade" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Fuso horário</div>
              <Input value={editTimeZone} onChange={(e) => setEditTimeZone(e.target.value)} placeholder="Fuso horário" />
            </div>
            <div className="md:col-span-3">
              <div className="mb-1 text-sm font-medium text-slate-700">Endereço</div>
              <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Endereço (opcional)" />
            </div>
            <div className="md:col-span-3">
              <div className="mb-1 text-sm font-medium text-slate-700">Google Meu Negócio (link)</div>
              <Input
                value={editGoogleBusinessUrl}
                onChange={(e) => setEditGoogleBusinessUrl(e.target.value)}
                placeholder="https://g.page/r/..."
              />
            </div>
            <div className="md:col-span-3 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingId('')} disabled={update.isPending}>
                Cancelar
              </Button>
              <Button disabled={update.isPending} onClick={() => update.mutate()}>
                {update.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
            {update.isError && (
              <div className="md:col-span-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao salvar</div>
            )}
          </div>
        </Card>
      )}

      {reviewEditingUnitId && canReviewRead && (
        <Card
          title={`Plataformas de Avaliação — ${units.data?.find((u) => u.id === reviewEditingUnitId)?.name ?? 'Unidade'}`}
          description="Configure Google, iFood, Tripadvisor e Reclame Aqui para esta unidade"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Os dados são sincronizados automaticamente conforme a frequência selecionada. Clique em Sync agora para atualizar imediatamente.
            </div>
            <Button variant="secondary" onClick={() => { setReviewEditingUnitId(''); setReviewForms({}); }}>
              Fechar
            </Button>
          </div>
          {reviewProfiles.isLoading && <div className="text-sm text-slate-600">Carregando plataformas...</div>}
          {reviewProfiles.isError && <div className="text-sm text-rose-700">Falha ao carregar plataformas</div>}
          {reviewProfiles.data && (
            <div className="grid gap-4 md:grid-cols-2">
              {reviewProfiles.data.map((prof) => {
                const meta = PLATFORM_META[prof.platform];
                const form = reviewForms[prof.platform] ?? {};
                const editing = Object.keys(form).length > 0 || !!prof.isPlaceholder;
                const publicUrlVal = 'publicUrl' in form ? (form.publicUrl ?? '') : (prof.publicUrl ?? '');
                const locationIdVal = 'locationId' in form ? (form.locationId ?? '') : (prof.locationId ?? '');
                const freqVal = (form.syncFrequency as SyncFrequency | undefined) ?? prof.syncFrequency ?? meta.defaultFreq;
                const rating = typeof prof.lastRating === 'number' ? prof.lastRating.toFixed(1) : prof.isPlaceholder ? '0.0' : '—';
                const total = prof.lastReviewCount ?? 0;
                const numRating = Number(rating);
                const colorStar = numRating >= 4.5 ? 'text-amber-500' : numRating >= 4 ? 'text-yellow-500' : numRating >= 3 ? 'text-orange-500' : numRating > 0 ? 'text-rose-500' : 'text-slate-400';
                return (
                  <div key={prof.platform} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={['flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-xl text-white shadow-sm', meta.color].join(' ')}>
                          {meta.icon}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <span className={['font-semibold text-base', colorStar].join(' ')}>★ {rating}</span>
                            <span className="text-slate-400">·</span>
                            <span>{total} avaliações</span>
                            {prof.lastSyncAt && (
                              <>
                                <span className="text-slate-400">·</span>
                                <span>Sync {new Date(prof.lastSyncAt).toLocaleString('pt-BR')}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {canReviewManage && (
                        <div className="flex items-center gap-2">
                          {!editing && (
                            <Button
                              variant="secondary"

                              disabled={syncNow.isPending}
                              onClick={() => syncNow.mutate({ unitId: reviewEditingUnitId, platform: prof.platform })}
                            >
                              {syncNow.isPending && (syncNow.variables as { platform: ReviewPlatform } | undefined)?.platform === prof.platform ? 'Sincronizando...' : 'Sync agora'}
                            </Button>
                          )}
                          {!editing ? (
                            <Button
                              variant="ghost"

                              onClick={() => setReviewForms((prev) => ({ ...prev, [prof.platform]: { ...prof } }))}
                            >
                              Editar
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"

                              onClick={() => {
                                setReviewForms((prev) => {
                                  const next = { ...prev };
                                  delete next[prof.platform];
                                  return next;
                                });
                              }}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {editing && canReviewManage && (
                      <>
                        <div className="grid gap-3">
                          <div>
                            <div className="mb-1 text-xs font-medium text-slate-700">Link público / URL da página de avaliações</div>
                            <Input
                              value={publicUrlVal}
                              onChange={(e) => setReviewForms((prev) => ({ ...prev, [prof.platform]: { ...(prev[prof.platform] ?? {}), publicUrl: e.target.value || null } }))}
                              placeholder={prof.platform === 'google' ? 'https://g.page/r/...' : prof.platform === 'ifood' ? 'https://www.ifood.com.br/delivery/...' : `Link público do(a) ${meta.label}`}
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-xs font-medium text-slate-700">ID de localização (locationId / externalId)</div>
                            <Input
                              value={locationIdVal}
                              onChange={(e) => setReviewForms((prev) => ({ ...prev, [prof.platform]: { ...(prev[prof.platform] ?? {}), locationId: e.target.value || null } }))}
                              placeholder={prof.platform === 'google' ? 'ChIJN1t_tDeuEmsRUsoyG83frY4 (Google Place ID)' : 'ID externo (opcional)'}
                            />
                          </div>
                          <div>
                            <div className="mb-1 text-xs font-medium text-slate-700">Frequência de sincronização</div>
                            <select
                              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                              value={freqVal}
                              onChange={(e) => setReviewForms((prev) => ({ ...prev, [prof.platform]: { ...(prev[prof.platform] ?? {}), syncFrequency: e.target.value as SyncFrequency } }))}
                            >
                              <option value="every30m">A cada 30 minutos</option>
                              <option value="hourly">A cada 1 hora</option>
                              <option value="every6h">A cada 6 horas</option>
                              <option value="daily">Diariamente</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            disabled={upsertProfile.isPending}
                            onClick={() => {
                              const payload = {
                                platform: prof.platform,
                                publicUrl: publicUrlVal || null,
                                locationId: locationIdVal || null,
                                syncFrequency: freqVal,
                              };
                              upsertProfile.mutate({ unitId: reviewEditingUnitId, data: payload });
                            }}
                          >
                            {upsertProfile.isPending ? 'Salvando...' : 'Salvar'}
                          </Button>
                        </div>
                      </>
                    )}

                    {!editing && prof.publicUrl && (
                      <a className="text-xs text-sky-700 hover:underline" href={prof.publicUrl} target="_blank" rel="noreferrer">
                        Abrir página de avaliações ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {canManageUnits && (
        <Card title="Criar unidade">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da unidade" />
            </div>
            <div>
              <Input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="Fuso horário" />
            </div>
            <div className="md:col-span-3">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço (opcional)" />
            </div>
            <div className="md:col-span-3">
              <Input
                value={googleBusinessUrl}
                onChange={(e) => setGoogleBusinessUrl(e.target.value)}
                placeholder="Link do Google Meu Negócio (opcional)"
              />
            </div>
            <div className="md:col-span-3">
              <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Lista">
        {units.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {units.isError && <div className="text-sm text-rose-700">Falha ao carregar unidades</div>}
        {units.data && units.data.length === 0 && <div className="text-sm text-slate-600">Nenhuma unidade</div>}
        {units.data && units.data.length > 0 && (
          <div className="divide-y divide-slate-200">
            {units.data.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.timeZone ?? '—'}</div>
                  <div className="text-xs text-slate-500">{u.address ?? '—'}</div>
                  <div className="text-xs text-slate-500">
                    {u.googleBusinessUrl ? (
                      <a className="text-sky-700 hover:underline" href={u.googleBusinessUrl} target="_blank" rel="noreferrer">
                        Avaliações no Google
                      </a>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canReviewRead && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setReviewEditingUnitId((curr) => (curr === u.id ? '' : u.id));
                        setReviewForms({});
                      }}
                    >
                      {reviewEditingUnitId === u.id ? 'Fechar avaliações' : 'Avaliações'}
                    </Button>
                  )}
                  {canManageUnits && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(u.id);
                        setEditName(u.name);
                        setEditTimeZone(u.timeZone ?? 'America/Sao_Paulo');
                        setEditAddress(u.address ?? '');
                        setEditGoogleBusinessUrl(u.googleBusinessUrl ?? '');
                      }}
                    >
                      Editar
                    </Button>
                  )}
                  <div className="text-xs font-mono text-slate-500">{u.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
