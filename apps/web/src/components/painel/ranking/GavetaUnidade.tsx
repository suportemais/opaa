import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { sentimentThemeLabel } from '../../../lib/labels';
import { Icone } from '../Icone';
import type { SentimentSummary } from '../dashboard/AnaliseSentimento';
import { classeVariacao, nomeMes, numero, textoVariacao, toIsoDate } from '../dashboard/util';
import { fmtHoras, fmtNps, fmtPct, mix3, type RankingMonthly, type RankingUnitSnapshot } from './tipos';

type LinkFn = (extra?: Record<string, string>, unitId?: string | null) => string;

/** Detalhe da unidade (gaveta à direita, <dialog> nativo). */
export function GavetaUnidade(props: {
  unidade: RankingUnitSnapshot | null;
  posicao: number;
  totalUnidades: number;
  ordemNome: string;
  periodo: string;
  from: string;
  to: string;
  variacao: number | null;
  linkFeedbacks: LinkFn;
  onFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const u = props.unidade;
  const unitId = u?.unitId ?? null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (u && !d.open) {
      d.showModal();
      tituloRef.current?.focus();
    } else if (!u && d.open) {
      d.close();
    }
  }, [u]);

  const hoje = toIsoDate(new Date());
  const inicio12 = (() => {
    const d = new Date();
    return toIsoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1)));
  })();

  const mensal = useQuery({
    queryKey: ['metrics', 'rankingMonthly', inicio12, hoje, unitId],
    queryFn: () => apiFetch<RankingMonthly>(`/metrics/ranking/monthly?from=${inicio12}&to=${hoje}&unitId=${encodeURIComponent(unitId!)}`),
    enabled: !!unitId,
  });

  const temas = useQuery({
    queryKey: ['metrics', 'sentimentSummary', props.from, props.to, unitId],
    queryFn: () =>
      apiFetch<SentimentSummary>(
        `/metrics/sentiment/summary?from=${props.from}&to=${props.to}&unitId=${encodeURIComponent(unitId!)}`,
      ),
    enabled: !!unitId,
  });

  const [p, pa, d] = u && u.total ? mix3(u.promoters, u.passives, u.detractors) : [0, 0, 0];
  const serie = mensal.data?.series.find((s) => s.unitId === unitId)?.points ?? [];

  return (
    <dialog
      ref={ref}
      className="gaveta gaveta--larga"
      aria-labelledby="ru-titulo"
      onClose={props.onFechar}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {u && (
        <div className="gaveta__corpo">
          <div className="gaveta__topo">
            <span className="gaveta__id">
              {props.posicao}º de {props.totalUnidades} em {props.ordemNome}
            </span>
            <button className="botao-icone" type="button" aria-label="Fechar" onClick={() => ref.current?.close()}>
              <Icone nome="fechar" />
            </button>
          </div>
          <div>
            <h2 className="cfg-gaveta__titulo" id="ru-titulo" tabIndex={-1} ref={tituloRef}>
              {u.unitName}
            </h2>
            <p className="cartao__sub">{props.periodo}</p>
          </div>
          <div className="rk-detalhe">
            <div className="rk-detalhe__numeros">
              <div>
                <span>NPS</span>
                <strong>{fmtNps(u.nps)}</strong>
                {props.variacao !== null && (
                  <small className={classeVariacao(props.variacao)}>
                    {textoVariacao(props.variacao)}
                    <span className="visualmente-oculto"> em relação ao período anterior</span>
                  </small>
                )}
              </div>
              <div>
                <span>Respostas</span>
                <strong>{numero(u.total)}</strong>
              </div>
              <div>
                <span>Elogios</span>
                <strong>{u.sentiment.classified ? `${u.sentiment.percents.elogio}%` : '—'}</strong>
                {u.sentiment.classified > 0 && (
                  <small>
                    {u.sentiment.percents.reclamacao}% reclamações · {u.sentiment.percents.neutro}% neutros
                  </small>
                )}
              </div>
            </div>

            <section className="rk-detalhe__bloco" aria-labelledby="ru-mix">
              <h3 id="ru-mix">Como os clientes avaliam</h3>
              <div className="barra-nps" aria-hidden="true">
                <span style={{ width: `${p}%`, background: 'var(--promotor)' }} />
                <span style={{ width: `${pa}%`, background: 'var(--passivo)' }} />
                <span style={{ width: `${d}%`, background: 'var(--detrator)' }} />
              </div>
              <p className="cartao__sub">
                {u.total
                  ? `${p}% promotores (${u.promoters}) · ${pa}% passivos (${u.passives}) · ${d}% detratores (${u.detractors})`
                  : 'Sem respostas no período'}
              </p>
            </section>

            {unitId && (
              <section className="rk-detalhe__bloco" aria-labelledby="ru-serie">
                <h3 id="ru-serie">NPS nos últimos 12 meses</h3>
                {mensal.isLoading && <p className="cartao__sub">Carregando…</p>}
                {mensal.isError && <p className="campo__erro">Falha ao carregar a evolução.</p>}
                {mensal.data && <SerieMensal pontos={serie.map((pt) => ({ mes: pt.month, nps: pt.nps }))} />}
              </section>
            )}

            {unitId && (
              <section className="rk-detalhe__bloco" aria-labelledby="ru-temas">
                <h3 id="ru-temas">
                  Temas mais citados{' '}
                  <span className="selo-ia">
                    <Icone nome="ia" />
                    IA
                  </span>
                </h3>
                {temas.isLoading && <p className="cartao__sub">Carregando…</p>}
                {temas.data && temas.data.byTheme.length === 0 && <p className="cartao__sub">Nenhum tema extraído no período.</p>}
                {temas.data && temas.data.byTheme.length > 0 && (
                  <ol className="rk-temas">
                    {temas.data.byTheme.slice(0, 3).map((t) => (
                      <li key={t.theme}>
                        <Link className="rk-link" to={props.linkFeedbacks({ theme: t.theme }, unitId)}>
                          {sentimentThemeLabel(t.theme)}
                        </Link>
                        <strong>
                          {numero(t.total)}
                          <span className="visualmente-oculto"> menções</span>
                        </strong>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}

            <section className="rk-detalhe__bloco" aria-labelledby="ru-trat">
              <h3 id="ru-trat">Tratamento dos detratores</h3>
              <dl className="dados">
                <div>
                  <dt>Detratores</dt>
                  <dd>{numero(u.treatment.detractors)}</dd>
                </div>
                <div>
                  <dt>Viraram ocorrência</dt>
                  <dd>{fmtPct(u.treatment.withCasePct)}</dd>
                </div>
                <div>
                  <dt>Resolvidos</dt>
                  <dd>{fmtPct(u.treatment.resolvedOfDetractorsPct)}</dd>
                </div>
                <div>
                  <dt>No prazo</dt>
                  <dd>{fmtPct(u.treatment.onTimePct)}</dd>
                </div>
                <div>
                  <dt>1ª ação</dt>
                  <dd>{fmtHoras(u.treatment.avgHoursToFirstAction)} em média</dd>
                </div>
                <div>
                  <dt>Encerramento</dt>
                  <dd>{fmtHoras(u.treatment.avgHoursToClose)} em média</dd>
                </div>
                <div>
                  <dt>Ocorrências abertas</dt>
                  <dd>{numero(u.cases.open)}</dd>
                </div>
                <div>
                  <dt>Avaliações externas</dt>
                  <dd>
                    {u.reviews.totalReviews > 0
                      ? `${u.reviews.averageRating?.toFixed(1) ?? '—'} (${numero(u.reviews.totalReviews)})`
                      : '—'}
                  </dd>
                </div>
              </dl>
              {unitId && (
                <div className="rk-detalhe__acoes">
                  <Link className="btn btn--secundario" to={props.linkFeedbacks({ case: 'open' }, unitId)}>
                    Ver o que precisa de ação
                    {u.cases.overdue > 0 && (
                      <span className="nav__selo">
                        {u.cases.overdue} vencida{u.cases.overdue > 1 ? 's' : ''}
                      </span>
                    )}
                  </Link>
                  <Link className="btn btn--fantasma" to={props.linkFeedbacks({}, unitId)}>
                    Ver feedbacks
                  </Link>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </dialog>
  );
}

function SerieMensal({ pontos }: { pontos: Array<{ mes: string; nps: number | null }> }) {
  const valores = pontos.map((p) => p.nps).filter((v): v is number => typeof v === 'number');
  if (!valores.length) return <p className="cartao__sub">Sem respostas nos últimos 12 meses.</p>;
  const L = 480;
  const A = 150;
  const esq = 30;
  const dir = 12;
  const topo = 20;
  const base = 26;
  const min = Math.max(-100, Math.floor((Math.min(...valores) - 5) / 10) * 10);
  const max = Math.min(100, Math.ceil((Math.max(...valores) + 5) / 10) * 10);
  const n = pontos.length;
  const x = (i: number) => esq + (i * (L - esq - dir)) / Math.max(1, n - 1);
  const y = (v: number) => topo + ((max - v) * (A - topo - base)) / Math.max(1, max - min);
  const grades: number[] = [];
  for (let v = min; v <= max; v += 10) grades.push(v);
  let ultimo = -1;
  pontos.forEach((p, i) => {
    if (typeof p.nps === 'number') ultimo = i;
  });
  const linhas: string[][] = [];
  let atual: string[] = [];
  pontos.forEach((p, i) => {
    if (typeof p.nps !== 'number') {
      if (atual.length) linhas.push(atual);
      atual = [];
      return;
    }
    atual.push(`${x(i)},${y(p.nps)}`);
  });
  if (atual.length) linhas.push(atual);
  return (
    <svg
      className="grafico"
      viewBox={`0 0 ${L} ${A}`}
      role="img"
      aria-label={`NPS por mês nos últimos 12 meses: ${pontos.map((p) => `${nomeMes(p.mes)} ${fmtNps(p.nps)}`).join(', ')}.`}
    >
      {grades.map((v) => (
        <g key={v}>
          <line className="grafico__grade" x1={esq} x2={L - dir} y1={y(v)} y2={y(v)} />
          <text className="grafico__eixo" x={esq - 6} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <text className="grafico__eixo" x={x(0)} y={A - 4}>
        {nomeMes(pontos[0].mes)}
      </text>
      <text className="grafico__eixo" x={x(n - 1)} y={A - 4} textAnchor="end">
        {nomeMes(pontos[n - 1].mes)}
      </text>
      {linhas.map((l, k) => (l.length > 1 ? <polyline key={k} className="grafico__linha" points={l.join(' ')} /> : null))}
      {pontos.map((p, i) =>
        typeof p.nps === 'number' ? (
          <circle
            key={p.mes}
            className={`grafico__ponto${i === ultimo ? ' grafico__ponto--fim' : ''}`}
            cx={x(i)}
            cy={y(p.nps)}
            r={i === ultimo ? 4.5 : 3}
          />
        ) : null,
      )}
      <text className="grafico__valor" x={x(ultimo)} y={y(pontos[ultimo].nps as number) - 10} textAnchor="end">
        NPS {pontos[ultimo].nps}
      </text>
    </svg>
  );
}
