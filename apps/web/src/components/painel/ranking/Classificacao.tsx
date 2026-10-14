import { classeVariacao, numero, textoVariacao } from '../dashboard/util';
import { ORDENS, fmtNps, mix3, type Ordem, type RankingUnitSnapshot } from './tipos';

/** Classificação das unidades (uma linha por unidade, mix promotores/passivos/detratores e variação). */
export function Classificacao(props: {
  linhas: RankingUnitSnapshot[];
  ordem: Ordem;
  variacoes: Map<string, number | null>;
  onAbrir: (row: RankingUnitSnapshot, posicao: number) => void;
}) {
  const ordem = ORDENS[props.ordem];
  return (
    <section className="cartao" aria-labelledby="t-classificacao">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="t-classificacao">
            Classificação
          </h2>
          <p className="cartao__sub">Por {ordem.nome}, do maior para o menor. Clique numa unidade para ver o detalhe.</p>
        </div>
        <ul className="rk-legenda" aria-label="Cores da barra">
          <li>
            <span style={{ background: 'var(--promotor)' }} />
            Promotores (9–10)
          </li>
          <li>
            <span style={{ background: 'var(--passivo)' }} />
            Passivos (7–8)
          </li>
          <li>
            <span style={{ background: 'var(--detrator)' }} />
            Detratores (1–6)
          </li>
        </ul>
      </div>
      {props.linhas.length === 0 ? (
        <p className="vazio">
          <strong>Sem unidades no seu acesso</strong>
        </p>
      ) : (
        <ol className="rk-lista">
          {props.linhas.map((u, i) => {
            const valor = ordem.valor(u);
            const [p, pa, d] = u.total ? mix3(u.promoters, u.passives, u.detractors) : [0, 0, 0];
            const variacao = props.variacoes.get(u.unitId ?? 'none') ?? null;
            const meta = [
              props.ordem !== 'nps' && `NPS ${fmtNps(u.nps)}`,
              props.ordem !== 'respostas' && `${numero(u.total)} respostas`,
              props.ordem !== 'elogios' && u.sentiment.classified > 0 && `${u.sentiment.percents.elogio}% elogios`,
            ].filter(Boolean);
            return (
              <li key={u.unitId ?? 'none'} className="rk-item" data-posicao={i + 1}>
                <button className="rk-item__abrir" type="button" aria-haspopup="dialog" onClick={() => props.onAbrir(u, i + 1)}>
                  <span className="rk-pos">
                    {i + 1}º<span className="visualmente-oculto"> lugar:</span>
                  </span>
                  <span className="rk-item__corpo">
                    <span className="rk-item__linha">
                      <strong className="rk-item__nome">{u.unitName}</strong>
                      <span className="rk-item__meta">{meta.join(' · ')}</span>
                    </span>
                    <span className="rk-mix" aria-hidden="true">
                      <span style={{ width: `${p}%`, background: 'var(--promotor)' }} />
                      <span style={{ width: `${pa}%`, background: 'var(--passivo)' }} />
                      <span style={{ width: `${d}%`, background: 'var(--detrator)' }} />
                    </span>
                    <span className="rk-item__mix">
                      {u.total
                        ? `${p}% promotores · ${pa}% passivos · ${d}% detratores`
                        : 'Sem respostas no período'}
                    </span>
                  </span>
                  <span className="rk-valor">
                    <strong>{valor === null ? '—' : ordem.formato(valor)}</strong>
                    <span className="rk-valor__rotulo">{ordem.rotulo}</span>
                    {props.ordem === 'nps' && variacao !== null && (
                      <span className={`rk-valor__var ${classeVariacao(variacao)}`}>
                        {textoVariacao(variacao)}
                        <span className="visualmente-oculto"> em relação ao período anterior</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
