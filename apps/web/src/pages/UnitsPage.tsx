import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { formatCnpj } from '../lib/cnpj';
import { ConfigLayout } from '../components/painel/ConfigTabs';
import { Icone } from '../components/painel/Icone';
import { usePode } from '../components/painel/usePainel';
import { Gaveta, Situacao } from '../components/painel/config/ui';
import { useAvisar } from '../components/painel/config/hooks';
import { descr, mensagemDoErro } from '../components/painel/config/erros';
import '../styles/painel-config.css';

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
  document: string | null;
  legalName: string | null;
  address: string | null;
  googleBusinessUrl: string | null;
};

const PLATAFORMAS: Record<ReviewPlatform, { rotulo: string; sigla: string; freqPadrao: SyncFrequency }> = {
  google: { rotulo: 'Google', sigla: 'G', freqPadrao: 'every6h' },
  ifood: { rotulo: 'iFood', sigla: 'iF', freqPadrao: 'hourly' },
  tripadvisor: { rotulo: 'Tripadvisor', sigla: 'TA', freqPadrao: 'daily' },
  reclameaqui: { rotulo: 'Reclame Aqui', sigla: 'RA', freqPadrao: 'every6h' },
};

const FREQUENCIAS: [SyncFrequency, string][] = [
  ['every30m', 'A cada 30 minutos'],
  ['hourly', 'A cada 1 hora'],
  ['every6h', 'A cada 6 horas'],
  ['daily', 'Diariamente'],
];

const SITUACAO_SYNC: Record<ReviewProfile['syncStatus'], [string, 'publicada' | 'rascunho' | 'arquivada' | 'agendada']> = {
  idle: ['Em dia', 'publicada'],
  running: ['Sincronizando', 'agendada'],
  error: ['Erro na sincronização', 'rascunho'],
  paused: ['Pausada', 'arquivada'],
};

const ERROS_UNIDADE: Record<string, string> = {
  invalid_document: 'Confira o CNPJ: o número não é válido.',
  invalid_cnpj: 'Confira o CNPJ: o número não é válido.',
  unit_not_found: 'Unidade não encontrada.',
  validation: 'Confira os campos destacados.',
};

type FormUnidade = {
  name: string;
  internalCode: string;
  document: string;
  legalName: string;
  timeZone: string;
  address: string;
  googleBusinessUrl: string;
};

const FORM_VAZIO: FormUnidade = {
  name: '',
  internalCode: '',
  document: '',
  legalName: '',
  timeZone: 'America/Sao_Paulo',
  address: '',
  googleBusinessUrl: '',
};

export function UnitsPage() {
  const pode = usePode();
  const canManageUnits = pode('unit:manage');
  const canReviewManage = pode('review:manage');
  const canReviewRead = pode('review:read');
  const qc = useQueryClient();
  const [avisar, aviso] = useAvisar();

  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => apiFetch<Unit[]>('/units'),
  });

  // ----- Gaveta de criar/editar -----
  const [gaveta, setGaveta] = useState<{ modo: 'nova' } | { modo: 'editar'; unidade: Unit } | null>(null);
  const [form, setForm] = useState<FormUnidade>(FORM_VAZIO);
  const [tentou, setTentou] = useState(false);
  const [erroGaveta, setErroGaveta] = useState<string | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  function abrirNova() {
    setForm(FORM_VAZIO);
    setTentou(false);
    setErroGaveta(null);
    setGaveta({ modo: 'nova' });
  }
  function abrirEdicao(u: Unit) {
    setForm({
      name: u.name,
      internalCode: u.internalCode ?? '',
      document: u.document ?? '',
      legalName: u.legalName ?? '',
      timeZone: u.timeZone ?? 'America/Sao_Paulo',
      address: u.address ?? '',
      googleBusinessUrl: u.googleBusinessUrl ?? '',
    });
    setTentou(false);
    setErroGaveta(null);
    setGaveta({ modo: 'editar', unidade: u });
  }
  const mudar = (campo: keyof FormUnidade, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const create = useMutation({
    mutationFn: (f: FormUnidade) =>
      apiFetch<Unit>('/units', {
        method: 'POST',
        json: {
          name: f.name.trim(),
          internalCode: f.internalCode.trim() || undefined,
          document: f.document.trim() || undefined,
          legalName: f.legalName.trim() || undefined,
          timeZone: f.timeZone,
          address: f.address.trim() || undefined,
          googleBusinessUrl: f.googleBusinessUrl.trim() || undefined,
        },
      }),
    onSuccess: async (_, f) => {
      setGaveta(null);
      avisar(`Unidade ${f.name.trim()} criada`);
      await qc.invalidateQueries({ queryKey: ['units'] });
    },
    onError: (err) => setErroGaveta(mensagemDoErro(err, ERROS_UNIDADE, 'Não foi possível criar a unidade.')),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; original: Unit; f: FormUnidade }) => {
      const { f, original } = vars;
      const codigo = f.internalCode.trim();
      return apiFetch<Unit>(`/units/${encodeURIComponent(vars.id)}`, {
        method: 'PATCH',
        json: {
          name: f.name.trim() || undefined,
          // Código interno só vai quando muda (não existia na tela antiga)
          internalCode: codigo !== (original.internalCode ?? '') ? codigo : undefined,
          document: f.document.trim(),
          legalName: f.legalName.trim(),
          timeZone: f.timeZone.trim() || undefined,
          address: f.address.trim() || undefined,
          googleBusinessUrl: f.googleBusinessUrl.trim() || undefined,
        },
      });
    },
    onSuccess: async (_, vars) => {
      setGaveta(null);
      avisar(`Unidade ${vars.f.name.trim()} atualizada`);
      await qc.invalidateQueries({ queryKey: ['units'] });
    },
    onError: (err) => setErroGaveta(mensagemDoErro(err, ERROS_UNIDADE, 'Não foi possível salvar a unidade.')),
  });

  const nomeVazio = !form.name.trim();
  const googleInvalido = Boolean(form.googleBusinessUrl.trim()) && !/^https?:\/\/\S+\.\S+/.test(form.googleBusinessUrl.trim());

  function salvarUnidade() {
    setTentou(true);
    setErroGaveta(null);
    if (nomeVazio) return nomeRef.current?.focus();
    if (googleInvalido) return document.getElementById('u-google')?.focus();
    if (gaveta?.modo === 'editar') update.mutate({ id: gaveta.unidade.id, original: gaveta.unidade, f: form });
    else create.mutate(form);
  }

  // ----- Gaveta de avaliações online -----
  const [reviewUnit, setReviewUnit] = useState<Unit | null>(null);
  const [reviewForms, setReviewForms] = useState<Record<string, Partial<ReviewProfile>>>({});
  const [reviewErro, setReviewErro] = useState<string | null>(null);

  const reviewProfiles = useQuery({
    queryKey: ['units', reviewUnit?.id ?? '', 'reviewProfiles'],
    queryFn: () => apiFetch<ReviewProfile[]>(`/units/${encodeURIComponent(reviewUnit!.id)}/review-profiles`),
    enabled: !!reviewUnit && canReviewRead,
  });

  const syncNow = useMutation({
    mutationFn: (vars: { unitId: string; platform: ReviewPlatform }) =>
      apiFetch<void>(`/units/${encodeURIComponent(vars.unitId)}/review-profiles/${vars.platform}/sync-now`, { method: 'POST' }),
    onSuccess: async (_, vars) => {
      avisar(`Sincronização de ${PLATAFORMAS[vars.platform].rotulo} pedida`);
      await qc.invalidateQueries({ queryKey: ['units', vars.unitId, 'reviewProfiles'] });
    },
    onError: () => setReviewErro('Não foi possível sincronizar agora. Tente de novo em instantes.'),
  });

  const upsertProfile = useMutation({
    mutationFn: (vars: {
      unitId: string;
      data: { platform: ReviewPlatform; publicUrl?: string | null; locationId?: string | null; syncFrequency?: SyncFrequency };
    }) =>
      apiFetch<ReviewProfile>(`/units/${encodeURIComponent(vars.unitId)}/review-profiles`, {
        method: 'PUT',
        json: vars.data,
      }),
    onSuccess: async (_, vars) => {
      avisar(`${PLATAFORMAS[vars.data.platform].rotulo} salvo`);
      await qc.invalidateQueries({ queryKey: ['units', vars.unitId, 'reviewProfiles'] });
      setReviewForms((prev) => {
        const next = { ...prev };
        delete next[vars.data.platform];
        return next;
      });
    },
    onError: () => setReviewErro('Não foi possível salvar. Confira o link (ele começa com https://).'),
  });

  const lista = units.data ?? [];

  return (
    <ConfigLayout>
      <section className="cartao cfg__cartao" aria-labelledby="t-unidades">
        <div className="cfg__topo">
          <div>
            <h2 className="cartao__titulo" id="t-unidades">
              Unidades
            </h2>
            <p className="cartao__sub">Cada unidade tem a própria pesquisa, link e QR Code.</p>
          </div>
          {canManageUnits && (
            <button className="btn btn--primario" type="button" onClick={abrirNova}>
              <Icone nome="mais" />
              Nova unidade
            </button>
          )}
        </div>

        {units.isLoading && <p className="mudo">Carregando unidades…</p>}
        {units.isError && (
          <p className="campo__erro" role="alert">
            Não foi possível carregar as unidades.
          </p>
        )}

        {units.data && (
          <div className="tabela-rolagem">
            <table className="tabela cfg-tabela">
              <thead>
                <tr>
                  <th scope="col">Unidade</th>
                  <th scope="col">CNPJ</th>
                  <th scope="col">Endereço</th>
                  <th scope="col">Google</th>
                  <th scope="col">
                    <span className="visualmente-oculto">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={5} className="vazio">
                      <strong>Nenhuma unidade ainda</strong>
                      {canManageUnits && (
                        <>
                          <br />
                          Use “Nova unidade” para cadastrar a primeira.
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {lista.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">
                      <span className="cfg-celula">
                        <span>{u.name}</span>
                        <small className="mudo">
                          {[u.internalCode && `Código ${u.internalCode}`, u.timeZone ?? '—'].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                    </th>
                    <td>
                      {u.document ? (
                        <span className="cfg-celula">
                          <span>{formatCnpj(u.document)}</span>
                          {u.legalName && <small className="mudo">{u.legalName}</small>}
                        </span>
                      ) : (
                        <span className="mudo">Sem CNPJ</span>
                      )}
                    </td>
                    <td>{u.address ? u.address : <span className="mudo">—</span>}</td>
                    <td>
                      {u.googleBusinessUrl ? (
                        <a className="link-texto" href={u.googleBusinessUrl} target="_blank" rel="noreferrer">
                          Avaliações no Google<span className="visualmente-oculto"> de {u.name} (abre em nova aba)</span>
                        </a>
                      ) : (
                        <Situacao tipo="arquivada">Sem link</Situacao>
                      )}
                    </td>
                    <td className="cfg-tabela__acoes">
                      {canReviewRead && (
                        <button
                          className="btn btn--fantasma"
                          type="button"
                          onClick={() => {
                            setReviewForms({});
                            setReviewErro(null);
                            setReviewUnit(u);
                          }}
                        >
                          <Icone nome="estrela" />
                          Avaliações<span className="visualmente-oculto"> de {u.name}</span>
                        </button>
                      )}
                      {canManageUnits && (
                        <button className="btn btn--fantasma" type="button" onClick={() => abrirEdicao(u)}>
                          <Icone nome="editar" />
                          Editar<span className="visualmente-oculto"> {u.name}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManageUnits && (
        <Gaveta
          aberta={!!gaveta}
          titulo={gaveta?.modo === 'editar' ? `Editar ${gaveta.unidade.name}` : 'Nova unidade'}
          botao={gaveta?.modo === 'editar' ? 'Salvar' : 'Criar unidade'}
          ocupado={create.isPending || update.isPending}
          onFechar={() => setGaveta(null)}
          onSalvar={salvarUnidade}
        >
          <div className="campo">
            <label htmlFor="u-nome">
              Nome da unidade <span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input
              ref={nomeRef}
              id="u-nome"
              required
              aria-invalid={tentou && nomeVazio}
              aria-describedby={descr('u-nome', false, true)}
              value={form.name}
              onChange={(e) => mudar('name', e.target.value)}
            />
            <p className="campo__erro" id="u-nome-erro" hidden={!(tentou && nomeVazio)}>
              Escreva o nome da unidade.
            </p>
          </div>
          <div className="campos-2">
            <div className="campo">
              <label htmlFor="u-cnpj">
                CNPJ <span className="opcional">(opcional)</span>
              </label>
              <input
                id="u-cnpj"
                autoComplete="off"
                placeholder="00.000.000/0000-00"
                aria-describedby="u-cnpj-dica"
                value={form.document}
                onChange={(e) => mudar('document', e.target.value)}
              />
              <p className="campo__dica" id="u-cnpj-dica">
                Necessário para gerar vouchers da Muito Mais.
              </p>
            </div>
            <div className="campo">
              <label htmlFor="u-codigo">
                Código interno <span className="opcional">(opcional)</span>
              </label>
              <input id="u-codigo" autoComplete="off" value={form.internalCode} onChange={(e) => mudar('internalCode', e.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="u-razao">
              Razão social <span className="opcional">(opcional)</span>
            </label>
            <input id="u-razao" value={form.legalName} onChange={(e) => mudar('legalName', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="u-endereco">
              Endereço <span className="opcional">(opcional)</span>
            </label>
            <input id="u-endereco" value={form.address} onChange={(e) => mudar('address', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="u-google">
              Link do Google <span className="opcional">(opcional)</span>
            </label>
            <input
              id="u-google"
              type="url"
              placeholder="https://g.page/r/..."
              aria-invalid={tentou && googleInvalido}
              aria-describedby={descr('u-google', true, true)}
              value={form.googleBusinessUrl}
              onChange={(e) => mudar('googleBusinessUrl', e.target.value)}
            />
            <p className="campo__dica" id="u-google-dica">
              Endereço da página da unidade no Google Meu Negócio.
            </p>
            <p className="campo__erro" id="u-google-erro" hidden={!(tentou && googleInvalido)}>
              Confira o link: ele começa com https://
            </p>
          </div>
          <div className="campo">
            <label htmlFor="u-fuso">Fuso horário</label>
            <input
              id="u-fuso"
              placeholder="America/Sao_Paulo"
              aria-describedby="u-fuso-dica"
              value={form.timeZone}
              onChange={(e) => mudar('timeZone', e.target.value)}
            />
            <p className="campo__dica" id="u-fuso-dica">
              No formato do sistema, por exemplo America/Sao_Paulo ou America/Manaus.
            </p>
          </div>
          {gaveta?.modo === 'editar' && (
            <div className="cfg__fixo">
              <span className="cfg__fixo-rotulo">ID da unidade</span>
              <code className="cfg-id">{gaveta.unidade.id}</code>
            </div>
          )}
          {erroGaveta && (
            <p className="campo__erro" role="alert">
              {erroGaveta}
            </p>
          )}
        </Gaveta>
      )}

      {canReviewRead && (
        <Gaveta
          larga
          aberta={!!reviewUnit}
          titulo={`Avaliações online · ${reviewUnit?.name ?? ''}`}
          onFechar={() => {
            setReviewUnit(null);
            setReviewForms({});
          }}
        >
          <p className="cfg-info">
            <Icone nome="relogio" />
            <span>
              Google, iFood, Tripadvisor e Reclame Aqui são sincronizados sozinhos na frequência escolhida. Use “Sincronizar
              agora” para atualizar na hora.
            </span>
          </p>
          {reviewProfiles.isLoading && <p className="mudo">Carregando plataformas…</p>}
          {reviewProfiles.isError && (
            <p className="campo__erro" role="alert">
              Não foi possível carregar as plataformas.
            </p>
          )}
          {reviewErro && (
            <p className="campo__erro" role="alert">
              {reviewErro}
            </p>
          )}
          {reviewUnit &&
            reviewProfiles.data?.map((prof) => {
              const meta = PLATAFORMAS[prof.platform];
              const f = reviewForms[prof.platform] ?? {};
              const editando = Object.keys(f).length > 0 || !!prof.isPlaceholder;
              const publicUrlVal = 'publicUrl' in f ? (f.publicUrl ?? '') : (prof.publicUrl ?? '');
              const locationIdVal = 'locationId' in f ? (f.locationId ?? '') : (prof.locationId ?? '');
              const freqVal = (f.syncFrequency as SyncFrequency | undefined) ?? prof.syncFrequency ?? meta.freqPadrao;
              const nota = typeof prof.lastRating === 'number' ? prof.lastRating.toFixed(1) : prof.isPlaceholder ? '0.0' : '—';
              const total = prof.lastReviewCount ?? 0;
              const sincronizando =
                syncNow.isPending && syncNow.variables?.platform === prof.platform && syncNow.variables?.unitId === reviewUnit.id;
              const [rotuloSync, tipoSync] = SITUACAO_SYNC[prof.syncStatus] ?? ['—', 'arquivada'];
              const idBase = `rv-${prof.platform}`;
              return (
                <div key={prof.platform} className={`cfg-plataforma cfg-plataforma--${prof.platform}`}>
                  <div className="cfg-plataforma__topo">
                    <span className="cfg-plataforma__sigla" aria-hidden="true">
                      {meta.sigla}
                    </span>
                    <div className="cfg-plataforma__texto">
                      <h3 className="cartao__titulo">{meta.rotulo}</h3>
                      <p className="cfg-plataforma__meta">
                        <span>
                          <Icone nome="estrela-cheia" /> {nota}
                        </span>
                        <span>{total} avaliações</span>
                        {!prof.isPlaceholder && <Situacao tipo={tipoSync}>{rotuloSync}</Situacao>}
                      </p>
                      {prof.lastSyncAt && (
                        <p className="campo__dica">Última sincronização: {new Date(prof.lastSyncAt).toLocaleString('pt-BR')}</p>
                      )}
                    </div>
                  </div>

                  {editando && canReviewManage ? (
                    <div className="cfg-plataforma__form">
                      <div className="campo">
                        <label htmlFor={`${idBase}-url`}>Link público da página de avaliações</label>
                        <input
                          id={`${idBase}-url`}
                          type="url"
                          value={publicUrlVal}
                          onChange={(e) =>
                            setReviewForms((prev) => ({
                              ...prev,
                              [prof.platform]: { ...(prev[prof.platform] ?? {}), publicUrl: e.target.value || null },
                            }))
                          }
                          placeholder={
                            prof.platform === 'google'
                              ? 'https://g.page/r/...'
                              : prof.platform === 'ifood'
                                ? 'https://www.ifood.com.br/delivery/...'
                                : `Link público do(a) ${meta.rotulo}`
                          }
                        />
                      </div>
                      <div className="campo">
                        <label htmlFor={`${idBase}-loc`}>
                          ID de localização <span className="opcional">(opcional)</span>
                        </label>
                        <input
                          id={`${idBase}-loc`}
                          value={locationIdVal}
                          onChange={(e) =>
                            setReviewForms((prev) => ({
                              ...prev,
                              [prof.platform]: { ...(prev[prof.platform] ?? {}), locationId: e.target.value || null },
                            }))
                          }
                          placeholder={prof.platform === 'google' ? 'Google Place ID (ex.: ChIJN1t_tDeuEmsR...)' : 'ID externo'}
                        />
                      </div>
                      <div className="campo">
                        <label htmlFor={`${idBase}-freq`}>Frequência de sincronização</label>
                        <select
                          id={`${idBase}-freq`}
                          value={freqVal}
                          onChange={(e) =>
                            setReviewForms((prev) => ({
                              ...prev,
                              [prof.platform]: { ...(prev[prof.platform] ?? {}), syncFrequency: e.target.value as SyncFrequency },
                            }))
                          }
                        >
                          {FREQUENCIAS.map(([v, t]) => (
                            <option key={v} value={v}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="cfg__botoes">
                        <button
                          className="btn btn--primario"
                          type="button"
                          disabled={upsertProfile.isPending}
                          onClick={() => {
                            setReviewErro(null);
                            upsertProfile.mutate({
                              unitId: reviewUnit.id,
                              data: {
                                platform: prof.platform,
                                publicUrl: publicUrlVal || null,
                                locationId: locationIdVal || null,
                                syncFrequency: freqVal,
                              },
                            });
                          }}
                        >
                          {upsertProfile.isPending && upsertProfile.variables?.data.platform === prof.platform
                            ? 'Salvando…'
                            : `Salvar ${meta.rotulo}`}
                        </button>
                        {!prof.isPlaceholder && (
                          <button
                            className="btn btn--fantasma"
                            type="button"
                            onClick={() =>
                              setReviewForms((prev) => {
                                const next = { ...prev };
                                delete next[prof.platform];
                                return next;
                              })
                            }
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="cfg__botoes">
                      {prof.publicUrl && (
                        <a className="btn btn--fantasma" href={prof.publicUrl} target="_blank" rel="noreferrer">
                          <Icone nome="link" />
                          Abrir página<span className="visualmente-oculto"> de avaliações no {meta.rotulo} (abre em nova aba)</span>
                        </a>
                      )}
                      {canReviewManage && (
                        <>
                          <button
                            className="btn btn--secundario"
                            type="button"
                            disabled={syncNow.isPending}
                            aria-busy={sincronizando || undefined}
                            onClick={() => {
                              setReviewErro(null);
                              syncNow.mutate({ unitId: reviewUnit.id, platform: prof.platform });
                            }}
                          >
                            {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
                          </button>
                          <button
                            className="btn btn--fantasma"
                            type="button"
                            onClick={() => setReviewForms((prev) => ({ ...prev, [prof.platform]: { ...prof } }))}
                          >
                            <Icone nome="editar" />
                            Editar<span className="visualmente-oculto"> {meta.rotulo}</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </Gaveta>
      )}
      {aviso}
    </ConfigLayout>
  );
}
