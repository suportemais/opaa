import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import type { EmployeeRankingResponse } from '../../../lib/api-novos';
import { numero } from '../dashboard/util';
import type { Unit } from './tipos';

/** Com poucas avaliações o NPS oscila demais: abaixo disso o atendente fica fora da classificação. */
const MINIMO_AVALIACOES = 20;

/** Ranking de atendentes (GET /metrics/ranking/employees), pela resposta a "Quem te atendeu?". */
export function Atendentes(props: {
  from: string;
  to: string;
  periodo: string;
  unidades: Unit[];
  unidade: string;
  onUnidade: (id: string) => void;
}) {
  const q = new URLSearchParams({ from: props.from, to: props.to });
  if (props.unidade) q.set('unitId', props.unidade);
  const dados = useQuery({
    queryKey: ['metrics', 'rankingEmployees', props.from, props.to, props.unidade],
    queryFn: () => apiFetch<EmployeeRankingResponse>(`/metrics/ranking/employees?${q.toString()}`),
  });

  const todos = dados.data?.employees ?? [];
  const classificados = todos
    .filter((a) => a.responses >= MINIMO_AVALIACOES && typeof a.nps === 'number')
    .sort((a, b) => (b.nps ?? 0) - (a.nps ?? 0) || b.responses - a.responses || a.name.localeCompare(b.name, 'pt-BR'));
  const poucas = todos.filter((a) => a.responses < MINIMO_AVALIACOES || typeof a.nps !== 'number');

  return (
    <section className="cartao" aria-labelledby="t-atendentes">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="t-atendentes">
            Ranking de atendentes
          </h2>
          <p className="cartao__sub">
            Pelas respostas a "Quem te atendeu?" na pesquisa. Por NPS, do maior para o menor · {props.periodo}.
          </p>
        </div>
        <div className="campo rk-at-filtro">
          <label htmlFor="rk-at-unidade">Unidade</label>
          <select id="rk-at-unidade" value={props.unidade} onChange={(e) => props.onUnidade(e.target.value)}>
            <option value="">Todas</option>
            {props.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {dados.isLoading && <p className="cartao__sub">Carregando…</p>}
      {dados.isError && <p className="campo__erro">Falha ao carregar o ranking de atendentes.</p>}
      {dados.data && (
        <ol className="rk-lista">
          {classificados.length ? (
            classificados.map((a, i) => (
              <li key={a.employeeId} className="rk-item" data-posicao={i + 1}>
                <div className="rk-item__abrir rk-item__abrir--fixo">
                  <span className="rk-pos">
                    {i + 1}º<span className="visualmente-oculto"> lugar:</span>
                  </span>
                  <span className="rk-item__corpo">
                    <span className="rk-item__linha">
                      <strong className="rk-item__nome">{a.name}</strong>
                      <span className="rk-item__meta">
                        {[
                          a.unitName,
                          `${numero(a.responses)} avaliações`,
                          typeof a.elogiosPct === 'number' ? `${a.elogiosPct}% elogios` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="rk-mix" aria-hidden="true">
                      <span style={{ width: `${a.promotersPct ?? 0}%`, background: 'var(--promotor)' }} />
                      <span style={{ width: `${a.passivesPct ?? 0}%`, background: 'var(--passivo)' }} />
                      <span style={{ width: `${a.detractorsPct ?? 0}%`, background: 'var(--detrator)' }} />
                    </span>
                    <span className="rk-item__mix">
                      {a.promotersPct ?? 0}% promotores · {a.passivesPct ?? 0}% passivos · {a.detractorsPct ?? 0}% detratores
                    </span>
                  </span>
                  <span className="rk-valor">
                    <strong>{a.nps}</strong>
                    <span className="rk-valor__rotulo">NPS</span>
                  </span>
                </div>
              </li>
            ))
          ) : (
            <li className="vazio">
              <strong>
                {todos.length ? 'Sem atendentes com avaliações suficientes' : 'Nenhuma resposta com atendente no período'}
              </strong>
              {todos.length
                ? 'Escolha um período maior ou outra unidade.'
                : 'Inclua a pergunta "Quem te atendeu?" na pesquisa para montar este ranking.'}
            </li>
          )}
        </ol>
      )}
      {poucas.length > 0 && (
        <p className="rk-nota">
          Com menos de {MINIMO_AVALIACOES} avaliações no período, fica{poucas.length > 1 ? 'm' : ''} fora da classificação:{' '}
          {poucas.map((a) => `${a.name} (${a.responses})`).join(', ')}.
        </p>
      )}
    </section>
  );
}
