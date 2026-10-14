import { Link } from 'react-router-dom';
import { Icone } from '../Icone';
import { numero } from './util';

export type ReviewPlatform = 'google' | 'ifood' | 'tripadvisor' | 'reclameaqui';
export type ReviewPlatformCard = {
  platform: ReviewPlatform;
  averageRating: number;
  totalReviews: number;
  lastSyncAt: string | null;
  syncStatus: string | null;
  publicUrl: string | null;
};

const NOMES: Record<ReviewPlatform, string> = {
  google: 'Google',
  ifood: 'iFood',
  tripadvisor: 'Tripadvisor',
  reclameaqui: 'Reclame Aqui',
};

function classeNota(n: number) {
  if (n >= 4.5) return 'dash-av__nota--otima';
  if (n >= 4) return 'dash-av__nota--boa';
  if (n >= 3) return 'dash-av__nota--media';
  if (n > 0) return 'dash-av__nota--ruim';
  return '';
}

/**
 * Notas das plataformas externas (GET /metrics/reviews/platform-cards).
 * Sem nenhuma plataforma sincronizada, mostra o aviso único do protótipo ("Conectar plataformas").
 */
export function AvaliacoesExternas(props: {
  cards: ReviewPlatformCard[] | undefined;
  carregando: boolean;
  erro: boolean;
  contexto: string;
  podeConectar: boolean;
  ordem: number;
}) {
  const cards = props.cards ?? [];
  const nenhuma = !props.carregando && !props.erro && cards.every((c) => !c.totalReviews && !c.lastSyncAt);

  if (nenhuma) {
    return (
      <section className="cartao grade-dash__largo anima-entrada" style={{ ['--ordem' as string]: props.ordem }} aria-labelledby="t-conectar">
        <div className="conectar">
          <span className="conectar__icone" aria-hidden="true">
            <Icone nome="plug" />
          </span>
          <p className="conectar__texto">
            <strong id="t-conectar">Veja aqui as notas do Google, iFood, Tripadvisor e Reclame Aqui</strong>
            <span>Conecte as plataformas uma vez e acompanhe tudo junto com o NPS.</span>
          </p>
          {props.podeConectar && (
            <Link className="btn btn--secundario" to="/app/integracoes">
              Conectar plataformas
            </Link>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="cartao grade-dash__largo anima-entrada" style={{ ['--ordem' as string]: props.ordem }} aria-labelledby="t-avaliacoes">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="t-avaliacoes">
            Avaliações externas
          </h2>
          <p className="cartao__sub">{props.contexto}</p>
        </div>
        {props.podeConectar && (
          <Link className="cartao__link" to="/app/integracoes">
            Integrações
            <Icone nome="seta" />
          </Link>
        )}
      </div>
      {props.carregando && <p className="cartao__sub">Carregando…</p>}
      {props.erro && <p className="campo__erro">Falha ao carregar as avaliações.</p>}
      {cards.length > 0 && (
        <ul className="dash-av">
          {cards.map((card) => {
            const nota = typeof card.averageRating === 'number' ? card.averageRating : 0;
            const total = card.totalReviews ?? 0;
            return (
              <li key={card.platform} className="dash-av__item">
                <span className="dash-av__nome">{NOMES[card.platform] ?? card.platform}</span>
                <span className={`dash-av__nota ${classeNota(nota)}`}>
                  <Icone nome="estrela-cheia" />
                  {(nota > 0 || total > 0 ? nota : 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  <small>/ 5,0</small>
                </span>
                <span className="dash-av__meta">
                  {numero(total)} {total === 1 ? 'avaliação' : 'avaliações'}
                </span>
                <span className="dash-av__meta">
                  Último sync: {card.lastSyncAt ? new Date(card.lastSyncAt).toLocaleString('pt-BR') : 'Pendente'}
                </span>
                {card.publicUrl && (
                  <a className="cartao__link dash-av__link" href={card.publicUrl} target="_blank" rel="noreferrer">
                    Ver na plataforma
                    <span className="visualmente-oculto"> {NOMES[card.platform]} (abre em nova aba)</span>
                    <Icone nome="link" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
