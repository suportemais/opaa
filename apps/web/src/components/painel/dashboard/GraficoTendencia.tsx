import { useId } from 'react';
import { dataCurta } from './util';

export type SemanaNps = { fim: string; nps: number | null; total: number };

/** Evolução semanal do NPS (SVG no visual do protótipo). Semanas sem respostas ficam sem ponto. */
export function GraficoTendencia({ semanas }: { semanas: SemanaNps[] }) {
  const idGradiente = useId().replace(/:/g, '');
  const valores = semanas.map((s) => s.nps).filter((v): v is number => typeof v === 'number');
  if (!valores.length) {
    return (
      <p className="vazio">
        <strong>Sem respostas nas últimas 12 semanas</strong>
        Assim que as pesquisas forem respondidas, a evolução aparece aqui.
      </p>
    );
  }

  const L = 640;
  const A = 230;
  const esq = 36;
  const dir = 16;
  const topo = 22;
  const base = 30;
  const min = Math.max(-100, Math.floor((Math.min(...valores) - 6) / 10) * 10);
  const max = Math.min(100, Math.ceil((Math.max(...valores) + 6) / 10) * 10);
  const n = semanas.length;
  const x = (i: number) => esq + (i * (L - esq - dir)) / Math.max(1, n - 1);
  const y = (v: number) => topo + ((max - v) * (A - topo - base)) / Math.max(1, max - min);

  const grades: number[] = [];
  for (let v = Math.ceil(min / 10) * 10; v <= max + 0.01; v += 10) grades.push(v);

  // Trechos contínuos (semanas sem resposta quebram a linha)
  const trechos: Array<Array<[number, number]>> = [];
  let atual: Array<[number, number]> = [];
  semanas.forEach((s, i) => {
    if (typeof s.nps !== 'number') {
      if (atual.length) trechos.push(atual);
      atual = [];
      return;
    }
    atual.push([x(i), y(s.nps)]);
  });
  if (atual.length) trechos.push(atual);

  let ultimoIdx = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (typeof semanas[i].nps === 'number') {
      ultimoIdx = i;
      break;
    }
  }
  const ultimo = semanas[ultimoIdx].nps as number;
  const descricao = `NPS por semana nas últimas ${n} semanas: ${semanas
    .map((s) => (typeof s.nps === 'number' ? s.nps : 'sem respostas'))
    .join(', ')}. Valor mais recente: ${ultimo}.`;

  return (
    <svg className="grafico grafico--entrada" viewBox={`0 0 ${L} ${A}`} role="img" aria-label={descricao}>
      {grades.map((v) => (
        <g key={v}>
          <line className="grafico__grade" x1={esq} x2={L - dir} y1={y(v)} y2={y(v)} />
          <text className="grafico__eixo" x={esq - 8} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {semanas.map((s, i) =>
        i % 2 === 1 || i > n - 3 ? null : (
          <text key={s.fim} className="grafico__eixo" x={x(i)} y={A - 6} textAnchor="middle">
            {dataCurta(s.fim)}
          </text>
        ),
      )}
      <text className="grafico__eixo" x={x(n - 1)} y={A - 6} textAnchor="end">
        Esta semana
      </text>
      <defs>
        <linearGradient id={idGradiente} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2563EB" stopOpacity=".18" />
          <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      {trechos.map((t, k) => {
        const pontos = t.map(([px, py]) => `${px},${py}`).join(' ');
        return (
          <g key={k}>
            {t.length > 1 && (
              <polygon
                className="grafico__area"
                fill={`url(#${idGradiente})`}
                points={`${t[0][0]},${A - base} ${pontos} ${t[t.length - 1][0]},${A - base}`}
              />
            )}
            <polyline className="grafico__linha" pathLength={1} points={pontos} />
          </g>
        );
      })}
      {semanas.map((s, i) =>
        typeof s.nps === 'number' ? (
          <circle
            key={s.fim}
            className={`grafico__ponto${i === ultimoIdx ? ' grafico__ponto--fim' : ''}`}
            style={{ ['--i' as string]: i }}
            cx={x(i)}
            cy={y(s.nps)}
            r={i === ultimoIdx ? 5 : 3.5}
          >
            <title>{`Semana até ${dataCurta(s.fim)}: NPS ${s.nps} (${s.total} respostas)`}</title>
          </circle>
        ) : null,
      )}
      <text className="grafico__valor" x={x(ultimoIdx)} y={y(ultimo) - 12} textAnchor="end">
        NPS {ultimo}
      </text>
    </svg>
  );
}
