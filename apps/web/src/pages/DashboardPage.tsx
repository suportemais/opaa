import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Icone } from '../components/painel/Icone';
import { useAuthMe, usePode } from '../components/painel/usePainel';
import { GraficoTendencia, type SemanaNps } from '../components/painel/dashboard/GraficoTendencia';
import { AvaliacoesExternas, type ReviewPlatformCard } from '../components/painel/dashboard/AvaliacoesExternas';
import { PrecisaAtencao, type CasesSummary, type CasoUrgente } from '../components/painel/dashboard/PrecisaAtencao';
import { ElogiosReclamacoes, TemasIA, type SentimentSummary } from '../components/painel/dashboard/AnaliseSentimento';
import {
  classeVariacao,
  dataLonga,
  diasEntre,
  npsDe,
  numero,
  percentuaisNps,
  somarDias,
  textoVariacao,
  toIsoDate,
} from '../components/painel/dashboard/util';
import '../styles/painel-dashboard.css';

type Unit = { id: string; name: string };
type NpsSummary = { total: number; promoters: number; passives: number; detractors: number; nps: number | null };
type NpsByDayPoint = NpsSummary & { date: string };
type NpsByDay = { points: NpsByDayPoint[] };
type RankingUnitRow = {
  rank: number;
  unitId: string | null;
  unitName: string;
  total: number;
  nps: number | null;
  promoterPct: number | null;
  detractorPct: number | null;
  cases: { open: number };
};
type RankingSummary = { units: RankingUnitRow[] };

const PERIODOS: Record<number, string> = { 7: 'Últimos 7 dias', 30: 'Últimos 30 dias', 90: 'Últimos 90 dias' };
const SEMANAS = 12;

const FAIXAS = [
  { chave: 'promotores', classe: 'promoter', nome: 'Promotores', faixa: '9–10', cor: 'var(--promotor)', campo: 'promoters' },
  { chave: 'passivos', classe: 'passive', nome: 'Passivos', faixa: '7–8', cor: 'var(--passivo)', campo: 'passives' },
  { chave: 'detratores', classe: 'detractor', nome: 'Detratores', faixa: '1–6', cor: 'var(--detrator)', campo: 'detractors' },
] as const;

function qs(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  return p.toString();
}

/** Agrupa os pontos diários em semanas que terminam hoje (a última é "esta semana"). */
function agruparPorSemana(points: NpsByDayPoint[], hoje: string): SemanaNps[] {
  const semanas = Array.from({ length: SEMANAS }, (_, i) => ({
    fim: somarDias(hoje, -7 * (SEMANAS - 1 - i)),
    total: 0,
    promoters: 0,
    detractors: 0,
  }));
  for (const p of points) {
    const atras = diasEntre(p.date, hoje);
    if (atras < 0) continue;
    const idx = SEMANAS - 1 - Math.floor(atras / 7);
    if (idx < 0) continue;
    semanas[idx].total += p.total;
    semanas[idx].promoters += p.promoters;
    semanas[idx].detractors += p.detractors;
  }
  return semanas.map((s) => ({ fim: s.fim, total: s.total, nps: npsDe(s) }));
}

/** Variação: NPS das últimas 4 semanas contra o das 4 semanas anteriores. */
function variacao4Semanas(points: NpsByDayPoint[], hoje: string) {
  const soma = (de: number, ate: number) =>
    points.reduce(
      (acc, p) => {
        const atras = diasEntre(p.date, hoje);
        if (atras >= de && atras < ate) {
          acc.total += p.total;
          acc.promoters += p.promoters;
          acc.detractors += p.detractors;
        }
        return acc;
      },
      { total: 0, promoters: 0, detractors: 0 },
    );
  const recente = npsDe(soma(0, 28));
  const anterior = npsDe(soma(28, 56));
  if (recente === null || anterior === null) return null;
  return recente - anterior;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const pode = usePode();
  const me = useAuthMe();
  const [rangeDays, setRangeDays] = useState(30);
  const [unitId, setUnitId] = useState('');

  const canReviewRead = pode('review:read');
  const canManage = pode('feedback:manage');
  const podeConectar = pode('tenant:settings:manage');

  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });

  const { from, to } = useMemo(() => {
    const now = new Date();
    const fromDate = new Date(now.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
    return { from: toIsoDate(fromDate), to: toIsoDate(now) };
  }, [rangeDays]);
  const hoje = to;
  const inicio12 = somarDias(hoje, -(SEMANAS * 7 - 1));

  const reviewCards = useQuery({
    queryKey: ['metrics', 'reviews', 'platformCards', from, to, unitId],
    queryFn: () => apiFetch<{ cards: ReviewPlatformCard[] }>(`/metrics/reviews/platform-cards?${qs({ from, to, unitId })}`),
    enabled: canReviewRead,
  });

  const summary = useQuery({
    queryKey: ['metrics', 'npsSummary', from, to, unitId],
    queryFn: () => apiFetch<NpsSummary>(`/metrics/nps/summary?${qs({ from, to, unitId })}`),
  });

  const byDay = useQuery({
    queryKey: ['metrics', 'npsByDay', inicio12, hoje, unitId],
    queryFn: () => apiFetch<NpsByDay>(`/metrics/nps/by-day?${qs({ from: inicio12, to: hoje, unitId })}`),
  });

  const casesSummary = useQuery({
    queryKey: ['metrics', 'casesSummary', from, to, unitId],
    queryFn: () => apiFetch<CasesSummary>(`/metrics/cases/summary?${qs({ from, to, unitId })}`),
    enabled: canManage,
  });

  // Tabela por unidade: sempre todas as unidades do escopo (a selecionada fica destacada)
  const byUnit = useQuery({
    queryKey: ['metrics', 'rankingSummary', from, to, ''],
    queryFn: () => apiFetch<RankingSummary>(`/metrics/ranking/summary?${qs({ from, to })}`),
  });

  const sentiment = useQuery({
    queryKey: ['metrics', 'sentimentSummary', from, to, unitId],
    queryFn: () => apiFetch<SentimentSummary>(`/metrics/sentiment/summary?${qs({ from, to, unitId })}`),
  });

  // "Precisa de atenção": casos abertos vencidos, vencendo hoje ou sem responsável (estado atual)
  const urgentes = useQuery({
    queryKey: ['dashboard', 'urgentes', unitId],
    enabled: canManage,
    queryFn: async () => {
      const base = { case: 'open', take: '6', unitId };
      const [vencidas, hojeL, semResp] = await Promise.all([
        apiFetch<CasoUrgente[]>(`/feedbacks?${qs({ ...base, due: 'overdue' })}`),
        apiFetch<CasoUrgente[]>(`/feedbacks?${qs({ ...base, due: 'today' })}`),
        apiFetch<CasoUrgente[]>(`/feedbacks?${qs({ ...base, assignee: 'unassigned' })}`),
      ]);
      const vistos = new Set<string>();
      const todos = [...vencidas, ...hojeL, ...semResp].filter((it) => {
        if (vistos.has(it.id)) return false;
        vistos.add(it.id);
        return true;
      });
      const prazo = (it: CasoUrgente) => (it.feedbackCase?.dueAt ? Date.parse(it.feedbackCase.dueAt) : Number.POSITIVE_INFINITY);
      return todos.sort((a, b) => prazo(a) - prazo(b)).slice(0, 4);
    },
  });

  // Classificação de sentimento em segundo plano (mantido do dashboard anterior)
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ processed: number }>('/metrics/sentiment/backfill', { method: 'POST', json: { limit: 5 } })
      .then((res) => {
        if (!cancelled && res.processed > 0) {
          void queryClient.invalidateQueries({ queryKey: ['metrics', 'sentimentSummary'] });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [from, to, unitId, queryClient]);

  function linkFeedbacks(extra?: Record<string, string>) {
    return `/app/feedbacks?${qs({ case: 'all', from, to, unitId, ...extra })}`;
  }
  function linkKanban(extra?: Record<string, string>) {
    return `/app/feedbacks/kanban?${qs({ case: 'open', ...extra })}`;
  }

  const semanas = useMemo(() => agruparPorSemana(byDay.data?.points ?? [], hoje), [byDay.data, hoje]);
  const variacao = useMemo(() => (byDay.data ? variacao4Semanas(byDay.data.points, hoje) : null), [byDay.data, hoje]);

  const nomeUnidade = unitId ? (units.data?.find((u) => u.id === unitId)?.name ?? 'Unidade selecionada') : 'Todas as unidades';
  const contexto = `${PERIODOS[rangeDays]} · ${nomeUnidade}`;
  const hora = new Date().getHours();
  const primeiroNome = me.data?.name?.trim() ? me.data.name.trim().split(' ')[0] : null;
  const saudacao = `${hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'}${primeiroNome ? `, ${primeiroNome}` : ''}`;

  const s = summary.data;
  const pct = s ? percentuaisNps(s) : { promotores: 0, passivos: 0, detratores: 0 };
  const cs = casesSummary.data;
  const linhasUnidade = useMemo(
    () =>
      [...(byUnit.data?.units ?? [])].sort((a, b) => {
        if (a.nps === null && b.nps !== null) return 1;
        if (a.nps !== null && b.nps === null) return -1;
        return (b.nps ?? 0) - (a.nps ?? 0) || b.total - a.total;
      }),
    [byUnit.data],
  );

  let ordem = 6;
  const proxima = () => ordem++;

  return (
    <>
      <div className="cabeca anima-entrada" style={{ ['--ordem' as string]: 1 }}>
        <div>
          <h1 className="cabeca__titulo">{saudacao}</h1>
          <p className="cabeca__desc">
            {contexto}
          </p>
        </div>
        <form className="filtros-topo" aria-label="Filtros do dashboard" onSubmit={(e) => e.preventDefault()}>
          <div className="campo">
            <label htmlFor="filtro-periodo">Período</label>
            <select id="filtro-periodo" value={String(rangeDays)} onChange={(e) => setRangeDays(Number(e.target.value))}>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="filtro-unidade">Unidade</label>
            <select id="filtro-unidade" value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={units.isLoading}>
              <option value="">Todas as unidades</option>
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>

      {/* Números principais: cada cartão leva para a tela que explica o número */}
      <section className="kpis" aria-label="Números principais">
        <article className="kpi anima-entrada" style={{ ['--ordem' as string]: 2 }}>
          <Link className="kpi__rotulo kpi__link" to="/app/ranking">
            NPS
          </Link>
          <p className="kpi__valor">{typeof s?.nps === 'number' ? s.nps : '—'}</p>
          <p className="kpi__nota">
            {variacao === null ? (
              'Sem base para comparar as últimas 4 semanas'
            ) : variacao === 0 ? (
              'Estável nas últimas 4 semanas'
            ) : (
              <>
                <strong className={classeVariacao(variacao)}>{textoVariacao(variacao)}</strong> nas últimas 4 semanas
              </>
            )}
          </p>
        </article>
        <article className="kpi anima-entrada" style={{ ['--ordem' as string]: 3 }}>
          <Link className="kpi__rotulo kpi__link" to={linkFeedbacks()}>
            Respostas
          </Link>
          <p className="kpi__valor">{numero(s?.total ?? 0)}</p>
          <p className="kpi__nota">{s?.total ? `${pct.promotores}% deram nota 9 ou 10` : 'Nenhuma resposta no período'}</p>
        </article>
        {canManage && (
          <article className="kpi anima-entrada" style={{ ['--ordem' as string]: 4 }}>
            <Link className="kpi__rotulo kpi__link" to={linkKanban()}>
              Ocorrências abertas
            </Link>
            <p className="kpi__valor">{numero(cs?.totals.open ?? 0)}</p>
            <p className="kpi__nota">{cs ? `${numero(cs.assignees.unassigned)} sem responsável · criadas no período` : ' '}</p>
          </article>
        )}
        {canManage && (
          <article
            className={`kpi anima-entrada${cs && cs.due.overdue > 0 ? ' kpi--alerta' : ''}`}
            style={{ ['--ordem' as string]: 5 }}
          >
            <Link className="kpi__rotulo kpi__link" to={linkKanban({ due: 'overdue' })}>
              Vencidas
            </Link>
            <p className="kpi__valor">{numero(cs?.due.overdue ?? 0)}</p>
            <p className="kpi__nota">
              {cs ? (cs.due.overdue ? 'Passaram do prazo. Resolva primeiro.' : 'Nenhuma fora do prazo') : ' '}
            </p>
          </article>
        )}
        <article className="kpi anima-entrada" style={{ ['--ordem' as string]: 5 }}>
          <p className="kpi__rotulo">Unidades</p>
          <p className="kpi__valor">{numero(units.data?.length ?? 0)}</p>
          <p className="kpi__nota">Acesso por permissão e vínculo</p>
        </article>
      </section>

      <div className="grade-dash">
        <section className="cartao anima-entrada" style={{ ['--ordem' as string]: proxima() }} aria-labelledby="t-tendencia">
          <div className="cartao__topo">
            <div>
              <h2 className="cartao__titulo" id="t-tendencia">
                Evolução do NPS
              </h2>
              <p className="cartao__sub">Por semana, nas últimas 12 semanas</p>
            </div>
            <Link className="cartao__link" to={`/app/feedbacks?${qs({ case: 'all', from: inicio12, to: hoje, unitId })}`}>
              Ver respostas
              <Icone nome="seta" />
            </Link>
          </div>
          {byDay.isLoading && <p className="cartao__sub">Carregando…</p>}
          {byDay.isError && <p className="campo__erro">Falha ao carregar a evolução.</p>}
          {byDay.data && <GraficoTendencia semanas={semanas} />}
        </section>

        <section className="cartao anima-entrada" style={{ ['--ordem' as string]: proxima() }} aria-labelledby="t-distribuicao">
          <div className="cartao__topo">
            <div>
              <h2 className="cartao__titulo" id="t-distribuicao">
                Como os clientes avaliam
              </h2>
              <p className="cartao__sub">Nota de 1 a 10 para "recomendaria?"</p>
            </div>
          </div>
          {summary.isLoading && <p className="cartao__sub">Carregando…</p>}
          {summary.isError && <p className="campo__erro">Falha ao carregar a distribuição.</p>}
          {s && (
            <div className="distribuicao">
              <p className="distribuicao__nps">
                <strong>{typeof s.nps === 'number' ? s.nps : '—'}</strong>
                <span>NPS = % promotores − % detratores</span>
              </p>
              <div className="barra-nps" aria-hidden="true">
                {FAIXAS.map((f) => (
                  <span key={f.chave} style={{ width: `${pct[f.chave]}%`, background: f.cor }} />
                ))}
              </div>
              <ul className="legenda">
                {FAIXAS.map((f) => (
                  <li key={f.chave}>
                    <Link className="dash-legenda" to={linkFeedbacks({ npsClass: f.classe })}>
                      <span className="legenda__cor" style={{ background: f.cor }} aria-hidden="true" />
                      <span>
                        {f.nome} <span className="legenda__faixa">(nota {f.faixa})</span>
                      </span>
                      <span className="legenda__valor">
                        {pct[f.chave]}% · {numero(s[f.campo])}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="temas__nota">Total: {numero(s.total)} respostas</p>
            </div>
          )}
        </section>

        {canManage && (
          <PrecisaAtencao
            itens={urgentes.data ?? []}
            carregando={urgentes.isLoading}
            erro={urgentes.isError}
            resumo={cs}
            linkKanban={linkKanban}
            ordem={proxima()}
          />
        )}

        <TemasIA
          dados={sentiment.data}
          carregando={sentiment.isLoading}
          erro={sentiment.isError}
          linkFeedbacks={linkFeedbacks}
          ordem={proxima()}
        />

        <ElogiosReclamacoes
          dados={sentiment.data}
          carregando={sentiment.isLoading}
          erro={sentiment.isError}
          linkFeedbacks={linkFeedbacks}
          ordem={proxima()}
        />

        <section className="cartao grade-dash__largo anima-entrada" style={{ ['--ordem' as string]: proxima() }} aria-labelledby="t-unidades">
          <div className="cartao__topo">
            <div>
              <h2 className="cartao__titulo" id="t-unidades">
                NPS por unidade
              </h2>
              <p className="cartao__sub">
                Da maior para a menor nota · {dataLonga(from)} a {dataLonga(to)}. Clique numa unidade para filtrar o dashboard.
              </p>
            </div>
            <Link className="cartao__link" to="/app/ranking">
              Ver ranking completo
              <Icone nome="seta" />
            </Link>
          </div>
          {byUnit.isLoading && <p className="cartao__sub">Carregando…</p>}
          {byUnit.isError && <p className="campo__erro">Falha ao carregar as unidades.</p>}
          {byUnit.data && linhasUnidade.length === 0 && (
            <p className="vazio">
              <strong>Sem unidades no seu acesso</strong>
            </p>
          )}
          {linhasUnidade.length > 0 && (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">Unidade</th>
                    <th scope="col" className="num">
                      Respostas
                    </th>
                    <th scope="col" className="num">
                      NPS
                    </th>
                    <th scope="col" className="num">
                      Promotores
                    </th>
                    <th scope="col" className="num">
                      Detratores
                    </th>
                    {canManage && (
                      <th scope="col" className="num">
                        Abertas
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {linhasUnidade.map((u) => (
                    <tr
                      key={u.unitId ?? 'none'}
                      data-destaque={unitId && u.unitId === unitId ? '' : undefined}
                      className={u.unitId ? 'dash-linha-clicavel' : undefined}
                      onClick={() => {
                        if (u.unitId) setUnitId(u.unitId === unitId ? '' : u.unitId);
                      }}
                    >
                      <th scope="row">
                        {u.unitId ? (
                          <button
                            type="button"
                            className="dash-unidade"
                            aria-pressed={u.unitId === unitId}
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnitId(u.unitId === unitId ? '' : (u.unitId ?? ''));
                            }}
                          >
                            {u.unitName}
                            <span className="visualmente-oculto">: filtrar o dashboard por esta unidade</span>
                          </button>
                        ) : (
                          u.unitName
                        )}
                      </th>
                      <td className="num">{numero(u.total)}</td>
                      <td className="num">
                        <strong>{typeof u.nps === 'number' ? u.nps : '—'}</strong>
                        <span className="mini-barra" aria-hidden="true">
                          <span style={{ width: `${Math.max(u.nps ?? 0, 0)}%` }} />
                        </span>
                      </td>
                      <td className="num">{typeof u.promoterPct === 'number' ? `${u.promoterPct}%` : '—'}</td>
                      <td className="num">{typeof u.detractorPct === 'number' ? `${u.detractorPct}%` : '—'}</td>
                      {canManage && (
                        <td className="num">
                          {u.unitId ? (
                            <Link
                              className="cartao__link dash-abertas"
                              to={`/app/feedbacks?${qs({ case: 'open', from, to, unitId: u.unitId })}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {numero(u.cases.open)}
                              <span className="visualmente-oculto"> ocorrências abertas em {u.unitName}</span>
                            </Link>
                          ) : (
                            numero(u.cases.open)
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {canReviewRead && (
          <AvaliacoesExternas
            cards={reviewCards.data?.cards}
            carregando={reviewCards.isLoading}
            erro={reviewCards.isError}
            contexto={contexto}
            podeConectar={podeConectar}
            ordem={proxima()}
          />
        )}
      </div>
    </>
  );
}
