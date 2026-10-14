import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { classeVariacao, dataLonga, diasEntre, numero, somarDias, textoVariacao, toIsoDate } from '../components/painel/dashboard/util';
import {
  ORDENS,
  fmtNps,
  fmtPct,
  ordenarPor,
  type Ordem,
  type RankingMonthly,
  type RankingSummary,
  type RankingUnitSnapshot,
  type Unit,
} from '../components/painel/ranking/tipos';
import { Classificacao } from '../components/painel/ranking/Classificacao';
import { Atendentes } from '../components/painel/ranking/Atendentes';
import { BarrasPorUnidade, Tratamento } from '../components/painel/ranking/Tratamento';
import { Evolucao } from '../components/painel/ranking/Evolucao';
import { GavetaUnidade } from '../components/painel/ranking/GavetaUnidade';
import { TabelaDetalhada } from '../components/painel/ranking/TabelaDetalhada';
import '../styles/painel-ranking.css';

type PeriodPreset = '30d' | '90d' | '6m' | '12m' | 'custom';

const ROTULOS: Record<Exclude<PeriodPreset, 'custom'>, string> = {
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  '6m': 'Últimos 6 meses + atual',
  '12m': 'Últimos 12 meses',
};

function rangeForPreset(preset: Exclude<PeriodPreset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const to = toIsoDate(now);
  if (preset === '30d') return { from: somarDias(to, -29), to };
  if (preset === '90d') return { from: somarDias(to, -89), to };
  const monthsBack = preset === '12m' ? 11 : 6;
  const fromDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return { from: toIsoDate(fromDate), to };
}

function qs(params: Record<string, string | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  return p.toString();
}

export function RankingPage() {
  const initial = rangeForPreset('6m');
  const [preset, setPreset] = useState<PeriodPreset>('6m');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [unitId, setUnitId] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('nps');
  const [atUnidade, setAtUnidade] = useState('');
  const [aberta, setAberta] = useState<{ row: RankingUnitSnapshot; posicao: number } | null>(null);

  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });

  const rangeOk = Boolean(from && to && from <= to);
  const params = qs({ from, to, unitId });

  const summary = useQuery({
    queryKey: ['metrics', 'rankingSummary', from, to, unitId],
    queryFn: () => apiFetch<RankingSummary>(`/metrics/ranking/summary?${params}`),
    enabled: rangeOk,
  });

  // Período anterior de mesmo tamanho, para a variação do NPS
  const anterior = useMemo(() => {
    if (!rangeOk) return null;
    const dias = diasEntre(from, to) + 1;
    const ateAnt = somarDias(from, -1);
    return { from: somarDias(ateAnt, -(dias - 1)), to: ateAnt };
  }, [from, to, rangeOk]);

  const summaryAnterior = useQuery({
    queryKey: ['metrics', 'rankingSummary', anterior?.from, anterior?.to, unitId],
    queryFn: () => apiFetch<RankingSummary>(`/metrics/ranking/summary?${qs({ ...anterior, unitId })}`),
    enabled: !!anterior,
  });

  const monthly = useQuery({
    queryKey: ['metrics', 'rankingMonthly', from, to, unitId],
    queryFn: () => apiFetch<RankingMonthly>(`/metrics/ranking/monthly?${params}`),
    enabled: rangeOk,
  });

  const variacoes = useMemo(() => {
    const mapa = new Map<string, number | null>();
    const prev = new Map((summaryAnterior.data?.units ?? []).map((u) => [u.unitId ?? 'none', u.nps]));
    for (const u of summary.data?.units ?? []) {
      const p = prev.get(u.unitId ?? 'none');
      mapa.set(u.unitId ?? 'none', typeof u.nps === 'number' && typeof p === 'number' ? u.nps - p : null);
    }
    return mapa;
  }, [summary.data, summaryAnterior.data]);

  const variacaoGeral =
    typeof summary.data?.totals.nps === 'number' && typeof summaryAnterior.data?.totals.nps === 'number'
      ? summary.data.totals.nps - summaryAnterior.data.totals.nps
      : null;

  const linhas = useMemo(() => ordenarPor(summary.data?.units ?? [], ordem), [summary.data, ordem]);

  function applyPreset(next: PeriodPreset) {
    setPreset(next);
    if (next === 'custom') return;
    const range = rangeForPreset(next);
    setFrom(range.from);
    setTo(range.to);
  }

  function linkFeedbacks(extra?: Record<string, string>, rowUnitId?: string | null) {
    return `/app/feedbacks?${qs({ case: 'all', from, to, unitId: rowUnitId || unitId, ...extra })}`;
  }
  function linkKanban(extra?: Record<string, string>, rowUnitId?: string | null) {
    return `/app/feedbacks/kanban?${qs({ case: 'open', unitId: rowUnitId || unitId, ...extra })}`;
  }

  const periodoTexto = preset === 'custom' ? `De ${dataLonga(from)} a ${dataLonga(to)}` : ROTULOS[preset];
  const totals = summary.data?.totals;
  const errored = summary.isError || monthly.isError;
  const empty = Boolean(totals && totals.total === 0 && totals.cases.opened === 0);

  return (
    <>
      <div className="cabeca">
        <div>
          <h1 className="cabeca__titulo">Ranking de unidades</h1>
          <p className="cabeca__desc">
            Compare as unidades: a nota dos clientes, o volume de respostas e como cada uma trata quem reclamou.
          </p>
        </div>
        <form className="filtros-topo rk-filtros" aria-label="Período, unidade e ordem" onSubmit={(e) => e.preventDefault()}>
          <div className="campo">
            <label htmlFor="rk-periodo">Período</label>
            <select id="rk-periodo" value={preset} onChange={(e) => applyPreset(e.target.value as PeriodPreset)}>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="6m">Últimos 6 meses + atual</option>
              <option value="12m">Últimos 12 meses</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {preset === 'custom' && (
            <>
              <div className="campo rk-filtros__data">
                <label htmlFor="rk-de">De</label>
                <input
                  id="rk-de"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPreset('custom');
                  }}
                />
              </div>
              <div className="campo rk-filtros__data">
                <label htmlFor="rk-ate">Até</label>
                <input
                  id="rk-ate"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPreset('custom');
                  }}
                />
              </div>
            </>
          )}
          <div className="campo">
            <label htmlFor="rk-unidade">Unidade</label>
            <select
              id="rk-unidade"
              value={unitId}
              disabled={units.isLoading}
              onChange={(e) => {
                setUnitId(e.target.value);
                setAtUnidade(e.target.value);
              }}
            >
              <option value="">Todas as unidades</option>
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="rk-ordem">Ordenar por</label>
            <select id="rk-ordem" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
              <option value="nps">NPS</option>
              <option value="respostas">Respostas</option>
              <option value="resolvidos">Detratores resolvidos</option>
              <option value="elogios">Elogios nos comentários</option>
            </select>
          </div>
        </form>
      </div>

      {!rangeOk && <p className="campo__erro">Escolha um intervalo válido: a data inicial precisa ser anterior à final.</p>}
      {rangeOk && summary.isLoading && <p className="cartao__sub">Carregando ranking…</p>}
      {errored && (
        <p className="campo__erro" role="alert">
          Falha ao carregar o ranking. Intervalos personalizados podem ter no máximo 366 dias.
        </p>
      )}

      {totals && (
        <section className="kpis" aria-label="Resumo do período">
          <article className="kpi">
            <p className="kpi__rotulo">NPS geral</p>
            <p className="kpi__valor">{fmtNps(totals.nps)}</p>
            <p className="kpi__nota">
              {variacaoGeral === null ? (
                periodoTexto
              ) : variacaoGeral === 0 ? (
                'Estável em relação ao período anterior'
              ) : (
                <>
                  <strong className={classeVariacao(variacaoGeral)}>{textoVariacao(variacaoGeral)}</strong> vs. período anterior
                </>
              )}
            </p>
          </article>
          <article className="kpi">
            <Link className="kpi__rotulo kpi__link" to={linkFeedbacks()}>
              Respostas
            </Link>
            <p className="kpi__valor">{numero(totals.total)}</p>
            <p className="kpi__nota">Concluídas no período</p>
          </article>
          <article className="kpi">
            <Link className="kpi__rotulo kpi__link" to={linkFeedbacks({ npsClass: 'detractor' })}>
              Detratores tratados
            </Link>
            <p className="kpi__valor">{fmtPct(totals.treatment.withCasePct)}</p>
            <p className="kpi__nota">
              {numero(totals.treatment.withCase)} de {numero(totals.treatment.detractors)} viraram ocorrência
            </p>
          </article>
          <article className={`kpi${totals.cases.overdue > 0 ? ' kpi--alerta' : ''}`}>
            <Link className="kpi__rotulo kpi__link" to={linkKanban()}>
              Ocorrências abertas
            </Link>
            <p className="kpi__valor">{numero(totals.cases.open)}</p>
            <p className="kpi__nota">Criadas no período e ainda abertas</p>
          </article>
        </section>
      )}

      {empty && (
        <p className="vazio cartao">
          <strong>Sem respostas nem ocorrências no período</strong>
          Escolha um período maior ou outra unidade.
        </p>
      )}

      {summary.data && (
        <Classificacao
          linhas={linhas}
          ordem={ordem}
          variacoes={variacoes}
          onAbrir={(row, posicao) => setAberta({ row, posicao })}
        />
      )}

      {rangeOk && (
        <Atendentes
          from={from}
          to={to}
          periodo={periodoTexto}
          unidades={units.data ?? []}
          unidade={atUnidade}
          onUnidade={setAtUnidade}
        />
      )}

      {summary.data && totals && (
        <Tratamento totais={totals.treatment} linhas={summary.data.units} linkFeedbacks={linkFeedbacks} linkKanban={linkKanban} />
      )}

      {summary.data && (
        <section className="cartao" aria-labelledby="t-sentimento-unidade">
          <div className="cartao__topo">
            <div>
              <h2 className="cartao__titulo" id="t-sentimento-unidade">
                Elogios e reclamações por unidade
              </h2>
              <p className="cartao__sub">Análise de feedback: somente respostas classificadas pela IA.</p>
            </div>
            <ul className="rk-legenda" aria-label="Cores da barra">
              <li>
                <span style={{ background: 'var(--promotor)' }} />
                Elogio
              </li>
              <li>
                <span style={{ background: 'var(--rk-cinza)' }} />
                Neutro
              </li>
              <li>
                <span style={{ background: 'var(--detrator)' }} />
                Reclamação
              </li>
            </ul>
          </div>
          <BarrasPorUnidade
            unidade="respostas classificadas"
            linhas={linhas.map((u) => ({
              chave: u.unitId ?? 'none',
              nome: u.unitName,
              partes: [
                { n: u.sentiment.elogio, cor: 'var(--promotor)', nome: 'elogios' },
                { n: u.sentiment.neutro, cor: 'var(--rk-cinza)', nome: 'neutros' },
                { n: u.sentiment.reclamacao, cor: 'var(--detrator)', nome: 'reclamações' },
              ],
            }))}
          />
        </section>
      )}

      {monthly.data && <Evolucao dados={monthly.data} />}

      {summary.data && <TabelaDetalhada linhas={summary.data.units} linkFeedbacks={linkFeedbacks} linkKanban={linkKanban} />}

      <GavetaUnidade
        unidade={aberta?.row ?? null}
        posicao={aberta?.posicao ?? 0}
        totalUnidades={linhas.length}
        ordemNome={ORDENS[ordem].nome}
        periodo={periodoTexto}
        from={from}
        to={to}
        variacao={aberta ? (variacoes.get(aberta.row.unitId ?? 'none') ?? null) : null}
        linkFeedbacks={linkFeedbacks}
        onFechar={() => setAberta(null)}
      />
    </>
  );
}
