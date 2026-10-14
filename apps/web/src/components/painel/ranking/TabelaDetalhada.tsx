import { Link } from 'react-router-dom';
import { numero } from '../dashboard/util';
import { fmtNps, fmtPct, type RankingUnitSnapshot } from './tipos';

type LinkFn = (extra?: Record<string, string>, unitId?: string | null) => string;

/** Tabela completa com todas as colunas do ranking (recolhível). */
export function TabelaDetalhada(props: { linhas: RankingUnitSnapshot[]; linkFeedbacks: LinkFn; linkKanban: LinkFn }) {
  return (
    <details className="cartao rk-detalhada">
      <summary className="rk-detalhada__resumo">
        <span>
          <span className="cartao__titulo">Tabela detalhada</span>
          <span className="cartao__sub">Todas as colunas por unidade: NPS, sentimento, tratamento, ocorrências e avaliações externas.</span>
        </span>
      </summary>
      {props.linhas.length === 0 ? (
        <p className="vazio">
          <strong>Sem unidades no seu acesso</strong>
        </p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela rk-tabela-completa">
            <caption className="visualmente-oculto">Ranking de unidades com todas as colunas</caption>
            <thead>
              <tr>
                <th scope="col" className="num">
                  #
                </th>
                <th scope="col">Unidade</th>
                <th scope="col" className="num">NPS</th>
                <th scope="col" className="num">Resp.</th>
                <th scope="col" className="num">% Prom.</th>
                <th scope="col" className="num">% Pass.</th>
                <th scope="col" className="num">% Detr.</th>
                <th scope="col" className="num">Elogio</th>
                <th scope="col" className="num">Reclam.</th>
                <th scope="col" className="num">Neutro</th>
                <th scope="col" className="num">% tratados</th>
                <th scope="col" className="num">% resolv.</th>
                <th scope="col" className="num">Abertos</th>
                <th scope="col" className="num">Fechados</th>
                <th scope="col" className="num">Vencidos</th>
                <th scope="col" className="num">Sem resp.</th>
                <th scope="col" className="num">Reviews</th>
              </tr>
            </thead>
            <tbody>
              {props.linhas.map((row) => (
                <tr key={row.unitId ?? 'none'}>
                  <td className="num rk-mudo">{row.rank}</td>
                  <th scope="row">
                    {row.unitId ? (
                      <Link className="rk-link" to={props.linkFeedbacks({}, row.unitId)}>
                        {row.unitName}
                      </Link>
                    ) : (
                      row.unitName
                    )}
                  </th>
                  <td className="num">
                    <strong>{fmtNps(row.nps)}</strong>
                  </td>
                  <td className="num">{numero(row.total)}</td>
                  <td className="num">{fmtPct(row.promoterPct)}</td>
                  <td className="num">{fmtPct(row.passivePct)}</td>
                  <td className="num">{fmtPct(row.detractorPct)}</td>
                  <td className="num">{numero(row.sentiment.elogio)}</td>
                  <td className="num">{numero(row.sentiment.reclamacao)}</td>
                  <td className="num">{numero(row.sentiment.neutro)}</td>
                  <td className="num">
                    {row.unitId ? (
                      <Link className="rk-link" to={props.linkFeedbacks({ npsClass: 'detractor' }, row.unitId)}>
                        {fmtPct(row.treatment.withCasePct)}
                      </Link>
                    ) : (
                      fmtPct(row.treatment.withCasePct)
                    )}
                  </td>
                  <td className="num">{fmtPct(row.treatment.resolvedOfDetractorsPct)}</td>
                  <td className="num">
                    {row.unitId ? (
                      <Link className="rk-link" to={props.linkKanban({}, row.unitId)}>
                        {numero(row.cases.open)}
                      </Link>
                    ) : (
                      numero(row.cases.open)
                    )}
                  </td>
                  <td className="num">{numero(row.cases.closed)}</td>
                  <td className="num">{numero(row.cases.overdue)}</td>
                  <td className="num">{numero(row.cases.unassigned)}</td>
                  <td className="num">
                    {row.reviews.totalReviews > 0
                      ? `${row.reviews.averageRating?.toFixed(1) ?? '—'} (${numero(row.reviews.totalReviews)})`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
