import { Link, useNavigate } from 'react-router-dom';
import { Icone } from '../Icone';
import { numero } from '../dashboard/util';
import { fmtHoras, fmtPct, mix3, percentOf, type RankingUnitSnapshot, type TreatmentStats } from './tipos';

type LinkFn = (extra?: Record<string, string>, unitId?: string | null) => string;

const ruim = (v: number | null) => (typeof v === 'number' && v < 65 ? 'rk-ruim' : undefined);

/** Tratamento dos detratores: funil, tempos, tabela por unidade e mix de tratamento. */
export function Tratamento(props: {
  totais: TreatmentStats;
  linhas: RankingUnitSnapshot[];
  linkFeedbacks: LinkFn;
  linkKanban: LinkFn;
}) {
  const navigate = useNavigate();
  const t = props.totais;
  const passos = [
    { nome: 'Detratores', n: t.detractors },
    { nome: 'Viraram ocorrência', n: t.withCase },
    { nome: 'Em andamento', n: t.caseOpen },
    { nome: 'Resolvidos', n: t.caseClosed },
  ];
  const ordenadas = [...props.linhas].sort((a, b) => {
    const ar = a.treatment.resolvedOfDetractorsPct;
    const br = b.treatment.resolvedOfDetractorsPct;
    if (ar === null && br !== null) return 1;
    if (ar !== null && br === null) return -1;
    if (ar !== null && br !== null && ar !== br) return br - ar;
    const aw = a.treatment.withCasePct;
    const bw = b.treatment.withCasePct;
    if (aw === null && bw !== null) return 1;
    if (aw !== null && bw === null) return -1;
    if (aw !== null && bw !== null && aw !== bw) return bw - aw;
    return a.unitName.localeCompare(b.unitName, 'pt-BR');
  });

  return (
    <section className="cartao" aria-labelledby="t-tratamento">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="t-tratamento">
            Tratamento dos detratores
          </h2>
          <p className="cartao__sub">
            Quem deu nota de 1 a 6: quantos viraram ocorrência e quantos foram resolvidos. Ocorrências resolvidas, encerradas ou
            descartadas contam como resolvidas.
          </p>
        </div>
        <Link className="cartao__link" to={props.linkKanban()}>
          Ver o que precisa de ação
          <Icone nome="seta" />
        </Link>
      </div>

      <div className="rk-funil">
        <ol className="rk-funil__passos">
          {passos.map((p) => {
            const pct = percentOf(p.n, t.detractors);
            return (
              <li key={p.nome}>
                <span className="rk-funil__nome">{p.nome}</span>
                <span className="rk-funil__trilho" aria-hidden="true">
                  <span className="rk-funil__barra" style={{ width: `${t.detractors ? pct : 0}%` }} />
                </span>
                <span className="rk-funil__num">
                  <strong>{numero(p.n)}</strong>
                  {p.nome !== 'Detratores' && t.detractors > 0 && <span> ({pct}%)</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {t.withoutCase > 0 && (
          <p className="rk-funil__alerta">
            <Icone nome="alerta" />
            <span>
              <strong>{numero(t.withoutCase)} detratores sem tratamento</strong>: deram nota baixa e não viraram ocorrência.{' '}
              <Link className="link-texto" to={props.linkFeedbacks({ npsClass: 'detractor', case: 'none' })}>
                Ver quais
              </Link>
            </span>
          </p>
        )}
        <dl className="rk-tempos">
          <div>
            <dt>1ª ação</dt>
            <dd>
              {fmtHoras(t.avgHoursToFirstAction)} <span>média · mediana {fmtHoras(t.medianHoursToFirstAction)}</span>
            </dd>
          </div>
          <div>
            <dt>Encerramento</dt>
            <dd>
              {fmtHoras(t.avgHoursToClose)} <span>média · mediana {fmtHoras(t.medianHoursToClose)}</span>
            </dd>
          </div>
          <div>
            <dt>Ocorrências resolvidas</dt>
            <dd>{fmtPct(t.resolvedOfCasesPct)}</dd>
          </div>
          <div>
            <dt>Resolvidos no prazo</dt>
            <dd>{fmtPct(t.onTimePct)}</dd>
          </div>
          <div>
            <dt>Vencidas / sem responsável</dt>
            <dd className={t.caseOverdue ? 'rk-ruim' : undefined}>
              {numero(t.caseOverdue)} <span>/ {numero(t.caseUnassigned)}</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="tabela-rolagem">
        <table className="tabela rk-tabela">
          <caption className="visualmente-oculto">Tratamento dos detratores por unidade, ordenado por % de detratores resolvidos</caption>
          <thead>
            <tr>
              <th scope="col">Unidade</th>
              <th scope="col" className="num">
                Detratores
              </th>
              <th scope="col" className="num">
                Viraram ocorrência
              </th>
              <th scope="col" className="num">
                Sem tratamento
              </th>
              <th scope="col" className="num">
                Resolvidos
              </th>
              <th scope="col" className="num">
                % resolvidos
              </th>
              <th scope="col" className="num">
                No prazo
              </th>
              <th scope="col" className="num">
                1ª ação
              </th>
              <th scope="col" className="num">
                Vencidas
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((u) => (
              <tr
                key={u.unitId ?? 'none'}
                className={u.unitId ? 'rk-linha-clicavel' : undefined}
                onClick={() => {
                  if (u.unitId) navigate(props.linkFeedbacks({ npsClass: 'detractor' }, u.unitId));
                }}
              >
                <th scope="row">
                  {u.unitId ? (
                    <Link
                      className="rk-link"
                      to={props.linkFeedbacks({ npsClass: 'detractor' }, u.unitId)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {u.unitName}
                      <span className="visualmente-oculto">: ver detratores</span>
                    </Link>
                  ) : (
                    u.unitName
                  )}
                </th>
                <td className="num">{numero(u.treatment.detractors)}</td>
                <td className="num">
                  {numero(u.treatment.withCase)} <span className="rk-mudo">({fmtPct(u.treatment.withCasePct)})</span>
                </td>
                <td className="num">{numero(u.treatment.withoutCase)}</td>
                <td className="num">{numero(u.treatment.caseClosed)}</td>
                <td className="num">
                  <span className={ruim(u.treatment.resolvedOfDetractorsPct)}>{fmtPct(u.treatment.resolvedOfDetractorsPct)}</span>
                </td>
                <td className="num">
                  <span className={ruim(u.treatment.onTimePct)}>{fmtPct(u.treatment.onTimePct)}</span>
                </td>
                <td className="num">{fmtHoras(u.treatment.avgHoursToFirstAction)}</td>
                <td className="num">
                  {u.cases.overdue > 0 && u.unitId ? (
                    <Link
                      className="prazo prazo--vencido"
                      to={props.linkFeedbacks({ case: 'open', due: 'overdue' }, u.unitId)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {u.cases.overdue}
                      <span className="visualmente-oculto"> vencidas em {u.unitName}: ver</span>
                    </Link>
                  ) : (
                    numero(u.cases.overdue)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rk-bloco">
        <h3 className="rk-bloco__titulo">Mix de tratamento por unidade</h3>
        <ul className="rk-legenda" aria-label="Cores da barra">
          <li>
            <span style={{ background: 'var(--rk-cinza)' }} />
            Sem tratamento
          </li>
          <li>
            <span style={{ background: 'var(--passivo)' }} />
            Em andamento
          </li>
          <li>
            <span style={{ background: 'var(--promotor)' }} />
            Resolvidos
          </li>
        </ul>
        <BarrasPorUnidade
          linhas={props.linhas.map((u) => ({
            chave: u.unitId ?? 'none',
            nome: u.unitName,
            partes: [
              { n: u.treatment.withoutCase, cor: 'var(--rk-cinza)', nome: 'sem tratamento' },
              { n: u.treatment.caseOpen, cor: 'var(--passivo)', nome: 'em andamento' },
              { n: u.treatment.caseClosed, cor: 'var(--promotor)', nome: 'resolvidos' },
            ],
          }))}
          unidade="detratores"
        />
      </div>
    </section>
  );
}

/** Barras de 3 partes por unidade (rk-mix), com o total e a descrição para leitores de tela. */
export function BarrasPorUnidade(props: {
  linhas: Array<{ chave: string; nome: string; partes: Array<{ n: number; cor: string; nome: string }> }>;
  unidade: string;
}) {
  if (!props.linhas.length) return <p className="cartao__sub">Sem dados.</p>;
  return (
    <ul className="rk-barras">
      {props.linhas.map((l) => {
        const [a, b, c] = l.partes;
        const total = a.n + b.n + c.n;
        const pct = mix3(a.n, b.n, c.n);
        return (
          <li key={l.chave}>
            <span className="rk-barras__nome">{l.nome}</span>
            <span className="rk-mix" aria-hidden="true">
              {l.partes.map((p, i) => (
                <span key={p.nome} style={{ width: `${pct[i]}%`, background: p.cor }} title={`${p.nome}: ${p.n}`} />
              ))}
            </span>
            <span className="rk-barras__total">
              {numero(total)}
              <span className="visualmente-oculto">
                {' '}
                {props.unidade}: {l.partes.map((p) => `${p.n} ${p.nome}`).join(', ')}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
