import { useMemo, useState } from 'react';
import { nomeMes, numero, zonaNps } from '../dashboard/util';
import { aggregateDemais, chaveSerie, fmtNps, fmtPct, type RankingMonthly, type RankingMonthlySeries } from './tipos';

const CORES = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#EA580C', '#4F46E5'];
const COR_DEMAIS = '#64748B';
const LIMITE_SERIES = 8;

type Medida = 'nps' | 'respostas' | 'resolvidos';
type Vista = 'mapa' | 'graficos';

const MEDIDAS: Record<Medida, string> = { nps: 'NPS', respostas: 'Respostas', resolvidos: 'Detratores resolvidos' };

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Evolução mês a mês: mapa de cores (tabela) ou gráficos com séries ocultáveis. */
export function Evolucao({ dados }: { dados: RankingMonthly }) {
  const [medida, setMedida] = useState<Medida>('nps');
  const [vista, setVista] = useState<Vista>('mapa');

  // Séries ocultas nos gráficos. Com mais de 8 unidades, as excedentes começam ocultas ("Demais").
  const idsSeries = dados.series.map(chaveSerie).join(',');
  const [ocultasEstado, setOcultasEstado] = useState<{ ids: string; set: Set<string> } | null>(null);
  const ocultas = useMemo(() => {
    if (ocultasEstado && ocultasEstado.ids === idsSeries) return ocultasEstado.set;
    const ids = idsSeries ? idsSeries.split(',') : [];
    return new Set(ids.length > LIMITE_SERIES ? ids.slice(LIMITE_SERIES) : []);
  }, [ocultasEstado, idsSeries]);

  function alternarSerie(chave: string) {
    const next = new Set(ocultas);
    if (next.has(chave)) next.delete(chave);
    else next.add(chave);
    setOcultasEstado({ ids: idsSeries, set: next });
  }

  const seriesGrafico = useMemo(() => {
    const todas = dados.series;
    const escondidas = todas.filter((s) => ocultas.has(chaveSerie(s)));
    const visiveis = todas.filter((s) => !ocultas.has(chaveSerie(s)));
    const coloridas: Array<RankingMonthlySeries & { cor: string }> = visiveis.map((s, i) => ({ ...s, cor: CORES[i % CORES.length] }));
    if (escondidas.length) coloridas.push({ ...aggregateDemais(escondidas), cor: COR_DEMAIS });
    return coloridas;
  }, [dados.series, ocultas]);

  const atual = mesAtual();
  const n = dados.months.length;

  return (
    <section className="cartao" aria-labelledby="t-evolucao">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="t-evolucao">
            Evolução mês a mês
          </h2>
          <p className="cartao__sub">
            {n} {n === 1 ? 'mês' : 'meses'} no período. Meses sem movimento aparecem vazios.
            {dados.months.includes(atual) ? ' O mês atual (*) vai até hoje.' : ''}
          </p>
        </div>
        <div className="rk-evolucao__controles">
          <div className="alternar" role="group" aria-label="Mostrar na evolução">
            {(Object.keys(MEDIDAS) as Medida[]).map((m) => (
              <button key={m} type="button" aria-pressed={medida === m} onClick={() => setMedida(m)}>
                {MEDIDAS[m]}
              </button>
            ))}
          </div>
          <div className="alternar" role="group" aria-label="Forma de exibir">
            <button type="button" aria-pressed={vista === 'mapa'} onClick={() => setVista('mapa')}>
              Tabela
            </button>
            <button type="button" aria-pressed={vista === 'graficos'} onClick={() => setVista('graficos')}>
              Gráfico
            </button>
          </div>
        </div>
      </div>

      {!dados.series.length || !n ? (
        <p className="vazio">
          <strong>Sem dados no período</strong>
        </p>
      ) : vista === 'mapa' ? (
        <Mapa dados={dados} medida={medida} atual={atual} />
      ) : (
        <>
          <div className="rk-series" role="group" aria-label="Unidades no gráfico">
            {dados.series.map((s) => {
              const chave = chaveSerie(s);
              const visivel = !ocultas.has(chave);
              const cor = seriesGrafico.find((c) => chaveSerie(c) === chave)?.cor;
              return (
                <button key={chave} type="button" className="rk-serie" aria-pressed={visivel} onClick={() => alternarSerie(chave)}>
                  <span className="rk-serie__cor" style={{ background: visivel ? cor : 'transparent' }} aria-hidden="true" />
                  {s.unitName}
                </button>
              );
            })}
          </div>
          {ocultas.size > 0 && <p className="rk-nota">As unidades desmarcadas aparecem somadas em "Demais".</p>}
          {medida === 'respostas' ? (
            <BarrasMensais
              meses={dados.months}
              series={seriesGrafico.map((s) => ({ chave: chaveSerie(s), nome: s.unitName, cor: s.cor, valores: s.points.map((p) => p.total) }))}
            />
          ) : (
            <LinhasMensais
              meses={dados.months}
              series={seriesGrafico.map((s) => ({
                chave: chaveSerie(s),
                nome: s.unitName,
                cor: s.cor,
                valores: s.points.map((p) => (medida === 'nps' ? p.nps : p.treatment.resolvedOfDetractorsPct)),
              }))}
              min={medida === 'nps' ? -100 : 0}
              max={100}
              formato={medida === 'nps' ? fmtNps : fmtPct}
              titulo={medida === 'nps' ? 'NPS por mês' : '% de detratores resolvidos por mês'}
            />
          )}
        </>
      )}
    </section>
  );
}

function Mapa({ dados, medida, atual }: { dados: RankingMonthly; medida: Medida; atual: string }) {
  const maior = Math.max(1, ...dados.series.flatMap((s) => s.points.map((p) => p.total)));
  return (
    <>
      <div className="tabela-rolagem">
        <table className="tabela rk-mapa">
          <caption className="visualmente-oculto">{MEDIDAS[medida]} por mês e unidade</caption>
          <thead>
            <tr>
              <th scope="col">Unidade</th>
              {dados.months.map((m) => (
                <th key={m} scope="col" className="num">
                  {nomeMes(m)}
                  {m === atual && (
                    <>
                      <span aria-hidden="true">*</span>
                      <span className="visualmente-oculto"> (até hoje)</span>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.series.map((s) => (
              <tr key={chaveSerie(s)}>
                <th scope="row">{s.unitName}</th>
                {s.points.map((p) => {
                  if (medida === 'nps') {
                    return (
                      <td key={p.month} className="num">
                        {typeof p.nps === 'number' ? (
                          <span className={`rk-cel rk-cel--${zonaNps(p.nps)}`} title={`${p.total} respostas`}>
                            {p.nps}
                          </span>
                        ) : (
                          <span className="rk-cel rk-cel--vazia">—</span>
                        )}
                      </td>
                    );
                  }
                  if (medida === 'respostas') {
                    return (
                      <td key={p.month} className="num">
                        <span className="rk-cel" style={{ ['--forca' as string]: `${Math.round((p.total / maior) * 32)}%` }}>
                          {numero(p.total)}
                        </span>
                      </td>
                    );
                  }
                  const v = p.treatment.resolvedOfDetractorsPct;
                  return (
                    <td key={p.month} className="num">
                      {typeof v === 'number' ? (
                        <span
                          className="rk-cel"
                          style={{ ['--forca' as string]: `${Math.round((v / 100) * 32)}%` }}
                          title={`${p.treatment.caseClosed} de ${p.treatment.detractors} detratores`}
                        >
                          {v}%
                        </span>
                      ) : (
                        <span className="rk-cel rk-cel--vazia">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {medida === 'nps' && (
        <ul className="rk-zonas">
          <li>
            <span className="rk-cel--excelencia" />
            75 a 100 · Excelência
          </li>
          <li>
            <span className="rk-cel--qualidade" />
            50 a 74 · Qualidade
          </li>
          <li>
            <span className="rk-cel--aperfeicoamento" />0 a 49 · Aperfeiçoamento
          </li>
          <li>
            <span className="rk-cel--critica" />
            Abaixo de 0 · Crítica
          </li>
        </ul>
      )}
    </>
  );
}

type SerieGrafico = { chave: string; nome: string; cor: string };

function LinhasMensais(props: {
  meses: string[];
  series: Array<SerieGrafico & { valores: Array<number | null> }>;
  min: number;
  max: number;
  formato: (v: number | null) => string;
  titulo: string;
}) {
  const L = 640;
  const A = 240;
  const esq = 40;
  const dir = 16;
  const topo = 16;
  const base = 30;
  const n = props.meses.length;
  const x = (i: number) => (n === 1 ? (esq + L - dir) / 2 : esq + (i * (L - esq - dir)) / (n - 1));
  const y = (v: number) => topo + ((props.max - v) * (A - topo - base)) / (props.max - props.min);
  const grades: number[] = [];
  const passo = props.max - props.min > 100 ? 50 : 25;
  for (let v = props.min; v <= props.max; v += passo) grades.push(v);

  const trechos = props.series.map((s) => {
    const partes: string[][] = [];
    let atual: string[] = [];
    s.valores.forEach((v, i) => {
      if (typeof v !== 'number') {
        if (atual.length) partes.push(atual);
        atual = [];
        return;
      }
      atual.push(`${x(i)},${y(v)}`);
    });
    if (atual.length) partes.push(atual);
    return { ...s, partes };
  });

  const descricao = `${props.titulo}. ${props.series
    .map((s) => `${s.nome}: ${s.valores.map((v) => props.formato(v)).join(', ')}`)
    .join('. ')}`;

  return (
    <div className="rk-grafico">
      <svg className="grafico" viewBox={`0 0 ${L} ${A}`} role="img" aria-label={descricao}>
        {grades.map((v) => (
          <g key={v}>
            <line className="grafico__grade" x1={esq} x2={L - dir} y1={y(v)} y2={y(v)} />
            <text className="grafico__eixo" x={esq - 8} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {props.meses.map((m, i) => (
          <text key={m} className="grafico__eixo" x={x(i)} y={A - 6} textAnchor="middle">
            {nomeMes(m)}
          </text>
        ))}
        {trechos.map((s) =>
          s.partes.map((p, k) =>
            p.length > 1 ? (
              <polyline key={`${s.chave}-${k}`} className="grafico__linha" style={{ stroke: s.cor }} points={p.join(' ')} />
            ) : null,
          ),
        )}
        {props.series.map((s) =>
          s.valores.map((v, i) =>
            typeof v === 'number' ? (
              <circle key={`${s.chave}-${i}`} className="grafico__ponto" style={{ stroke: s.cor }} cx={x(i)} cy={y(v)} r={3.5}>
                <title>{`${s.nome} · ${nomeMes(props.meses[i])}: ${props.formato(v)}`}</title>
              </circle>
            ) : null,
          ),
        )}
      </svg>
      <ul className="rk-legenda">
        {props.series.map((s) => {
          const ultimo = [...s.valores].reverse().find((v) => typeof v === 'number') ?? null;
          return (
            <li key={s.chave}>
              <span style={{ background: s.cor }} />
              {s.nome} <strong>{props.formato(ultimo)}</strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BarrasMensais(props: { meses: string[]; series: Array<SerieGrafico & { valores: number[] }> }) {
  const totais = props.meses.map((_, i) => props.series.reduce((s, x) => s + (x.valores[i] ?? 0), 0));
  const maior = Math.max(1, ...totais);
  return (
    <div className="rk-grafico">
      <div className="rk-colunas" role="img" aria-label={`Respostas por mês: ${props.meses.map((m, i) => `${nomeMes(m)} ${totais[i]}`).join(', ')}`}>
        {props.meses.map((m, i) => (
          <div key={m} className="rk-colunas__mes">
            <span className="rk-colunas__total">{numero(totais[i])}</span>
            <div className="rk-colunas__pilha">
              {props.series.map((s) => {
                const v = s.valores[i] ?? 0;
                if (v <= 0) return null;
                return <span key={s.chave} title={`${s.nome}: ${v}`} style={{ height: `${(v / maior) * 100}%`, background: s.cor }} />;
              })}
            </div>
            <span className="rk-colunas__rotulo">{nomeMes(m)}</span>
          </div>
        ))}
      </div>
      <ul className="rk-legenda">
        {props.series.map((s) => (
          <li key={s.chave}>
            <span style={{ background: s.cor }} />
            {s.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}
