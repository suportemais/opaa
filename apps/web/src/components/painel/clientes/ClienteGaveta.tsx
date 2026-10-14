import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { feedbackCasePriorityLabel, feedbackCaseStatusLabel } from '../../../lib/labels';
import { Icone } from '../Icone';
import { iniciais } from '../usePainel';
import { DadosClienteForm } from './DadosClienteForm';
import {
  type Cliente,
  type OcorrenciaCliente,
  type RespostaCliente,
  type Unidade,
  categoriaNota,
  dataCurta,
  quando,
} from './util';

const CLASSE_ETAPA: Record<string, string> = {
  new: 'nova',
  viewed: 'visualizada',
  in_progress: 'em-andamento',
  waiting_customer: 'aguardando-cliente',
  resolved: 'resolvida',
  closed: 'encerrada',
  dismissed: 'descartada',
};

export function EtapaOcorrencia({ status }: { status: string }) {
  return <span className={`etapa etapa--${CLASSE_ETAPA[status] ?? 'visualizada'}`}>{feedbackCaseStatusLabel(status)}</span>;
}

export function NotaSelo({ nota, rotulo = 'Nota ' }: { nota: number; rotulo?: string }) {
  return (
    <span className={`nota nota--${categoriaNota(nota)}`}>
      <span className="visualmente-oculto">{rotulo}</span>
      {nota}
    </span>
  );
}

/** Conteúdo da gaveta "detalhe do cliente" (montado só com a gaveta aberta). */
export function ClienteGavetaConteudo(props: {
  id: string;
  unidades: Unidade[];
  podeEditar: boolean;
  podeVerRespostas: boolean;
  onFechar: () => void;
  onSalvo: (c: Cliente) => void;
}) {
  const { id } = props;
  const cliente = useQuery({ queryKey: ['customer', id], queryFn: () => apiFetch<Cliente>(`/customers/${id}`) });
  const respostas = useQuery({
    queryKey: ['customerResponses', id],
    queryFn: () => apiFetch<RespostaCliente[]>(`/customers/${id}/responses`),
    enabled: props.podeVerRespostas,
  });
  const ocorrencias = useQuery({
    queryKey: ['customerCases', id],
    queryFn: () => apiFetch<OcorrenciaCliente[]>(`/customers/${id}/cases`),
    enabled: props.podeVerRespostas,
  });
  const c = cliente.data;
  const nome = c?.name || 'Cliente sem nome';

  return (
    <div className="gaveta__corpo">
      <div className="gaveta__topo">
        <span className="gaveta__id">{c ? `Cliente desde ${dataCurta(c.createdAt)}` : ''}</span>
        <button className="botao-icone" type="button" aria-label="Fechar" onClick={props.onFechar}>
          <Icone nome="fechar" />
        </button>
      </div>

      <div className="cl-cabeca">
        <span className="avatar" aria-hidden="true">
          {iniciais(nome)}
        </span>
        <div>
          <h2 className="cfg-gaveta__titulo" id="cg-titulo" tabIndex={-1}>
            {cliente.isLoading ? 'Carregando…' : nome}
          </h2>
          {c && (
            <p className="cartao__sub">
              <Link className="link-texto" to={`/app/customers/${c.id}`}>
                Abrir página do cliente
              </Link>{' '}
              (tags, observações, “não contatar” e contatos)
            </p>
          )}
        </div>
      </div>

      {cliente.isError && (
        <p className="cl-lgpd" role="alert">
          <Icone nome="alerta" />
          <span>Não foi possível carregar o cliente.</span>
        </p>
      )}

      {c && (
        <>
          <div className="rk-detalhe__numeros">
            <div>
              <span>Respostas</span>
              <strong>{c.totalResponses ?? 0}</strong>
            </div>
            <div>
              <span>Última nota</span>
              <strong>{typeof c.lastNpsScore === 'number' ? c.lastNpsScore : '—'}</strong>
            </div>
            <div>
              <span>Satisfação média</span>
              <strong>{typeof c.satisfactionAvg === 'number' ? c.satisfactionAvg.toFixed(1).replace('.', ',') : '—'}</strong>
            </div>
          </div>
          {c.doNotContact && (
            <p className="cl-lgpd">
              <Icone nome="cadeado" />
              <span>
                <strong>Não contatar.</strong>
                {c.doNotContactReason ? ` ${c.doNotContactReason}.` : ''}
                {c.doNotContactAt ? ` Desde ${dataCurta(c.doNotContactAt)}.` : ''}
              </span>
            </p>
          )}

          {props.podeVerRespostas && (
            <section className="rk-detalhe__bloco" aria-labelledby="cg-t-respostas">
              <h3 id="cg-t-respostas">
                Respostas às pesquisas <span className="cl-mudo">({respostas.data?.length ?? 0})</span>
              </h3>
              {respostas.isLoading && <p className="cl-mudo">Carregando…</p>}
              {respostas.isError && <p className="cl-mudo">Não foi possível carregar as respostas.</p>}
              {respostas.data && respostas.data.length === 0 && <p className="cl-mudo">Ainda não respondeu nenhuma pesquisa.</p>}
              {respostas.data && respostas.data.length > 0 && (
                <ul className="cl-historico">
                  {respostas.data.map((r) => (
                    <li key={r.id}>
                      {typeof r.npsScore === 'number' ? <NotaSelo nota={r.npsScore} /> : <span className="cl-mudo">—</span>}
                      <span>
                        {r.survey.name}
                        {r.unit ? ` · ${r.unit.name}` : ''}
                        {r.mainComment ? <span className="cl-mudo cl-comentario">“{r.mainComment}”</span> : null}
                      </span>
                      <span className="cl-mudo">
                        {dataCurta(r.completedAt ?? r.startedAt)} · {quando(r.completedAt ?? r.startedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {props.podeVerRespostas && ocorrencias.data && ocorrencias.data.length > 0 && (
            <section className="rk-detalhe__bloco" aria-labelledby="cg-t-ocs">
              <h3 id="cg-t-ocs">Ocorrências</h3>
              <ul className="cl-historico">
                {ocorrencias.data.map((o) => (
                  <li key={o.id}>
                    <Link className="cl-oc" to={`/app/feedbacks/${o.surveyResponse.id}`}>
                      <EtapaOcorrencia status={o.status} />
                      <span>
                        {o.description || `Prioridade ${feedbackCasePriorityLabel(o.priority).toLowerCase()}`}
                        {o.unit ? ` · ${o.unit.name}` : ''} · atualizada {quando(o.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <DadosClienteForm
            key={c.id}
            cliente={c}
            unidades={props.unidades}
            podeEditar={props.podeEditar}
            prefixo="cg"
            onSalvo={props.onSalvo}
            onCancelar={props.onFechar}
            rotuloCancelar={props.podeEditar ? 'Cancelar' : 'Fechar'}
          />
        </>
      )}
    </div>
  );
}
