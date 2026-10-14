import { Link } from 'react-router-dom';
import { Icone } from '../Icone';
import { sentimentLabel, sentimentThemeLabel } from '../../../lib/labels';
import { numero } from './util';

export type SentimentCounts = { elogio: number; reclamacao: number; neutro: number };
export type SentimentThemeRow = SentimentCounts & { theme: string; total: number };
export type SentimentSummary = {
  responses: number;
  classified: number;
  unclassified: number;
  counts: SentimentCounts;
  percents: SentimentCounts;
  byTheme: SentimentThemeRow[];
  groqConfigured: boolean;
};

const SENTIMENTOS: Array<{ chave: keyof SentimentCounts; cor: string }> = [
  { chave: 'elogio', cor: 'var(--promotor)' },
  { chave: 'reclamacao', cor: 'var(--detrator)' },
  { chave: 'neutro', cor: 'var(--dash-neutro)' },
];

type LinkFeedbacks = (extra?: Record<string, string>) => string;

/** Temas mais citados (IA), com o mix elogio/reclamação/neutro de cada tema. */
export function TemasIA(props: {
  dados: SentimentSummary | undefined;
  carregando: boolean;
  erro: boolean;
  linkFeedbacks: LinkFeedbacks;
  ordem: number;
}) {
  const temas = props.dados?.byTheme.slice(0, 8) ?? [];
  const maior = temas[0]?.total || 1;
  return (
    <section className="cartao anima-entrada" style={{ ['--ordem' as string]: props.ordem }} aria-labelledby="t-temas">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="t-temas">
            Temas mais citados{' '}
            <span className="selo-ia">
              <Icone nome="ia" />
              IA
            </span>
          </h2>
          <p className="cartao__sub">Assuntos dos comentários, agrupados pela IA</p>
        </div>
      </div>
      {props.carregando && <p className="cartao__sub">Carregando…</p>}
      {props.erro && <p className="campo__erro">Falha ao carregar os temas.</p>}
      {props.dados && temas.length === 0 && (
        <p className="vazio">
          <strong>Nenhum tema extraído ainda</strong>A IA agrupa os comentários assim que eles chegam.
        </p>
      )}
      {temas.length > 0 && (
        <>
          <ul className="temas">
            {temas.map((t) => (
              <li key={t.theme}>
                <Link className="temas__nome dash-link" to={props.linkFeedbacks({ theme: t.theme })}>
                  {sentimentThemeLabel(t.theme)}
                </Link>
                <span className="temas__trilho dash-temas__trilho">
                  <span className="dash-temas__barra" style={{ width: `${Math.max(4, (t.total / maior) * 100)}%` }}>
                    {SENTIMENTOS.map((s) =>
                      t[s.chave] > 0 ? (
                        <Link
                          key={s.chave}
                          to={props.linkFeedbacks({ theme: t.theme, sentiment: s.chave })}
                          style={{ width: `${(t[s.chave] / t.total) * 100}%`, background: s.cor }}
                          title={`${sentimentLabel(s.chave)} · ${sentimentThemeLabel(t.theme)}: ${t[s.chave]}`}
                          aria-label={`${t[s.chave]} ${sentimentLabel(s.chave).toLowerCase()} sobre ${sentimentThemeLabel(t.theme)}`}
                        />
                      ) : null,
                    )}
                  </span>
                </span>
                <span className="temas__total">
                  {numero(t.total)}
                  <span className="visualmente-oculto"> menções</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="temas__nota">Número de comentários que citam cada tema. As cores mostram elogios, reclamações e neutros.</p>
        </>
      )}
    </section>
  );
}

/** Elogios × reclamações × neutros no período (análise de feedback da IA). */
export function ElogiosReclamacoes(props: {
  dados: SentimentSummary | undefined;
  carregando: boolean;
  erro: boolean;
  linkFeedbacks: LinkFeedbacks;
  ordem: number;
}) {
  const d = props.dados;
  return (
    <section className="cartao grade-dash__largo anima-entrada" style={{ ['--ordem' as string]: props.ordem }} aria-labelledby="t-sentimento">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="t-sentimento">
            Elogios e reclamações{' '}
            <span className="selo-ia">
              <Icone nome="ia" />
              IA
            </span>
          </h2>
          <p className="cartao__sub">O que os comentários dizem no período, classificado pela IA</p>
        </div>
      </div>
      {props.carregando && <p className="cartao__sub">Carregando…</p>}
      {props.erro && <p className="campo__erro">Falha ao carregar a análise.</p>}
      {d && (
        <div className="dash-sent">
          <ul className="dash-sent__numeros">
            {SENTIMENTOS.map((s) => (
              <li key={s.chave}>
                <Link className="dash-sent__num" to={props.linkFeedbacks({ sentiment: s.chave })}>
                  <span className="dash-sent__rotulo">
                    <span className="legenda__cor" style={{ background: s.cor }} aria-hidden="true" />
                    {sentimentLabel(s.chave)}
                  </span>
                  <strong>{numero(d.counts[s.chave])}</strong>
                  <span className="dash-sent__pct">{d.percents[s.chave]}%</span>
                </Link>
              </li>
            ))}
          </ul>
          {d.classified > 0 ? (
            <div className="barra-nps" aria-hidden="true">
              {SENTIMENTOS.map((s) => (
                <span key={s.chave} style={{ width: `${(d.counts[s.chave] / d.classified) * 100}%`, background: s.cor }} />
              ))}
            </div>
          ) : (
            <p className="cartao__sub">Sem respostas classificadas no período.</p>
          )}
          <p className="temas__nota dash-sent__rodape">
            <span>
              {numero(d.classified)} classificadas de {numero(d.responses)} respostas
              {d.unclassified > 0 ? ` · ${numero(d.unclassified)} aguardando análise` : ''}
            </span>
            {!d.groqConfigured && <span>GROQ_API_KEY não configurada — notas sem comentário usam o NPS</span>}
          </p>
        </div>
      )}
    </section>
  );
}
