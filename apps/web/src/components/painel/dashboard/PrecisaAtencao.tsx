import { Link } from 'react-router-dom';
import { Icone } from '../Icone';
import { categoriaNota, numero, prazoInfo } from './util';

export type CasoUrgente = {
  id: string;
  npsScore: number | null;
  mainComment: string | null;
  unit: { id: string; name: string } | null;
  customer?: { id: string; name: string | null } | null;
  feedbackCase: {
    id: string;
    status: string;
    dueAt: string | null;
    assigneeUserId: string | null;
    assignee: { id: string; name: string } | null;
  } | null;
};

export type CasesSummary = {
  totals: { total: number; open: number; closed: number };
  assignees: { unassigned: number; assigned: number };
  due: { overdue: number; today: number; next7: number; noDue: number };
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
};

/** "Precisa de atenção": casos vencidos, vencendo hoje ou sem responsável + a fila operacional. */
export function PrecisaAtencao(props: {
  itens: CasoUrgente[];
  carregando: boolean;
  erro: boolean;
  resumo: CasesSummary | undefined;
  linkKanban: (extra?: Record<string, string>) => string;
  ordem: number;
}) {
  const r = props.resumo;
  return (
    <section className="cartao anima-entrada" style={{ ['--ordem' as string]: props.ordem }} aria-labelledby="t-atencao">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="t-atencao">
            Precisa de atenção
          </h2>
          <p className="cartao__sub">Vencidas, vencendo hoje ou sem responsável</p>
        </div>
        <Link className="cartao__link" to={props.linkKanban()}>
          Ver todas
          <Icone nome="seta" />
        </Link>
      </div>

      <ul className="atencao" data-atencao>
        {props.carregando && <li className="cartao__sub">Carregando…</li>}
        {props.erro && <li className="campo__erro">Falha ao carregar as ocorrências.</li>}
        {!props.carregando && !props.erro && props.itens.length === 0 && (
          <li className="vazio">
            <strong>Tudo em dia</strong>Nenhuma ocorrência vencida ou sem responsável.
          </li>
        )}
        {props.itens.map((it) => {
          const p = prazoInfo(it.feedbackCase?.dueAt);
          const cat = categoriaNota(it.npsScore);
          const texto = it.mainComment?.trim() || (it.customer?.name ? `${it.customer.name} (sem comentário)` : 'Sem comentário');
          return (
            <li key={it.id}>
              <Link className="atencao__item" to={`/app/feedbacks/${it.id}`}>
                {cat ? (
                  <span className={`nota nota--${cat}`} aria-label={`Nota ${it.npsScore}`}>
                    {it.npsScore}
                  </span>
                ) : (
                  <span className="nota" aria-label="Sem nota">
                    –
                  </span>
                )}
                <span className="atencao__texto">{texto}</span>
                <span className="atencao__meta">
                  <span className={`prazo ${p.classe}`}>
                    <Icone nome="relogio" />
                    {p.texto}
                  </span>
                  {it.unit && <span>{it.unit.name}</span>}
                  {it.feedbackCase && !it.feedbackCase.assigneeUserId && <span>Sem responsável</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {r && (
        <dl className="dash-fila" aria-label="Fila operacional">
          <div>
            <dt>Vencem hoje</dt>
            <dd>
              <Link to={props.linkKanban({ due: 'today' })}>{numero(r.due.today)}</Link>
            </dd>
          </div>
          <div>
            <dt>Próx. 7 dias</dt>
            <dd>
              <Link to={props.linkKanban({ due: 'next7' })}>{numero(r.due.next7)}</Link>
            </dd>
          </div>
          <div>
            <dt>Sem responsável</dt>
            <dd>
              <Link to={props.linkKanban({ assignee: 'unassigned' })}>{numero(r.assignees.unassigned)}</Link>
            </dd>
          </div>
          <div>
            <dt>Sem prazo</dt>
            <dd>{numero(r.due.noDue)}</dd>
          </div>
          <div>
            <dt>Atribuídos</dt>
            <dd>{numero(r.assignees.assigned)}</dd>
          </div>
          <div>
            <dt>Encerrados</dt>
            <dd>{numero(r.totals.closed)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
