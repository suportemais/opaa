import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { feedbackCasePriorityLabel, interactionChannelLabel } from '../lib/labels';
import { Icone } from '../components/painel/Icone';
import { iniciais, usePode } from '../components/painel/usePainel';
import { useAviso } from '../components/painel/clientes/Aviso';
import { EtapaOcorrencia, NotaSelo } from '../components/painel/clientes/ClienteGaveta';
import { DadosClienteForm } from '../components/painel/clientes/DadosClienteForm';
import {
  type Cliente,
  type OcorrenciaCliente,
  type RespostaCliente,
  dataHora,
  erroCliente,
  origemTexto,
  quando,
  useUnidadesPermitidas,
} from '../components/painel/clientes/util';
import '../styles/painel-clientes.css';

type CustomerInteraction = {
  id: string;
  channel: string;
  direction: string;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  unit: { id: string; name: string } | null;
  createdByUser: { id: string; name: string; email: string } | null;
};

function parseTags(value: string) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);
}

function tagsDe(raw: unknown): string[] {
  return Array.isArray(raw) && raw.every((t) => typeof t === 'string') ? (raw as string[]) : [];
}

/** Tags, observações internas e "Não contatar" (PATCH /customers/:id). */
function AcoesCrm({ cliente, podeEditar, onSalvo }: { cliente: Cliente; podeEditar: boolean; onSalvo: () => void }) {
  const qc = useQueryClient();
  const [doNotContact, setDoNotContact] = useState(Boolean(cliente.doNotContact));
  const [motivo, setMotivo] = useState(cliente.doNotContactReason ?? '');
  const [tagsTexto, setTagsTexto] = useState(tagsDe(cliente.tags).join(', '));
  const [notas, setNotas] = useState(cliente.notes ?? '');

  const salvar = useMutation({
    mutationFn: () =>
      apiFetch<Cliente>(`/customers/${cliente.id}`, {
        method: 'PATCH',
        json: {
          doNotContact,
          doNotContactReason: doNotContact ? motivo : undefined,
          tags: parseTags(tagsTexto),
          notes: notas,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer', cliente.id] });
      await qc.invalidateQueries({ queryKey: ['customers'] });
      onSalvo();
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    salvar.mutate();
  }

  return (
    <form className="cartao" aria-labelledby="cd-t-crm" onSubmit={enviar}>
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="cd-t-crm">
            Controle do CRM
          </h2>
          <p className="cartao__sub">Preferência de contato, tags e observações. Só a equipe vê.</p>
        </div>
      </div>
      <div className="gaveta__form">
        <div className={`cl-consentimento${doNotContact ? '' : ' cl-consentimento--sim'}`}>
          <Icone nome={doNotContact ? 'cadeado' : 'ok'} />
          <div style={{ display: 'grid', gap: 8, flex: 1 }}>
            <label className="cl-chave">
              <input
                type="checkbox"
                checked={doNotContact}
                disabled={!podeEditar}
                onChange={(e) => setDoNotContact(e.target.checked)}
              />
              Não contatar
            </label>
            {cliente.doNotContact && cliente.doNotContactAt && (
              <span className="cl-mudo">Ativado em {dataHora(cliente.doNotContactAt)}</span>
            )}
            {doNotContact && (
              <div className="campo">
                <label htmlFor="cd-motivo">
                  Motivo <span className="cl-mudo">(opcional)</span>
                </label>
                <input id="cd-motivo" value={motivo} disabled={!podeEditar} onChange={(e) => setMotivo(e.target.value)} />
              </div>
            )}
          </div>
        </div>
        <div className="campo">
          <label htmlFor="cd-tags">Tags</label>
          <input
            id="cd-tags"
            value={tagsTexto}
            disabled={!podeEditar}
            placeholder="Ex.: vip, reclamação, retorno"
            aria-describedby="cd-tags-dica"
            onChange={(e) => setTagsTexto(e.target.value)}
          />
          <p className="campo__dica" id="cd-tags-dica">
            Separe por vírgula (até 20).
          </p>
          {parseTags(tagsTexto).length > 0 && (
            <div className="cl-tags" aria-hidden="true">
              {parseTags(tagsTexto).map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="campo">
          <label htmlFor="cd-notas">Observações internas</label>
          <textarea
            id="cd-notas"
            rows={4}
            value={notas}
            disabled={!podeEditar}
            placeholder="Contexto do cliente, acordos, detalhes relevantes…"
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
        {salvar.isError && (
          <p className="cl-lgpd" role="alert">
            <Icone nome="alerta" />
            <span>{erroCliente(salvar.error, 'Falha ao salvar.')}</span>
          </p>
        )}
        {podeEditar && (
          <div className="gaveta__acoes">
            <button className="btn btn--primario" type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

/** Registro de interações (contatos feitos com o cliente) + histórico. */
function Contatos({ id, podeEditar, onRegistrado }: { id: string; podeEditar: boolean; onRegistrado: () => void }) {
  const qc = useQueryClient();
  const [canal, setCanal] = useState('whatsapp');
  const [resultado, setResultado] = useState('');
  const [notas, setNotas] = useState('');
  const interacoes = useQuery({
    queryKey: ['customerInteractions', id],
    queryFn: () => apiFetch<CustomerInteraction[]>(`/customers/${id}/interactions`),
  });
  const registrar = useMutation({
    mutationFn: () =>
      apiFetch<CustomerInteraction>(`/customers/${id}/interactions`, {
        method: 'POST',
        json: { channel: canal, direction: 'outbound', outcome: resultado.trim() || undefined, notes: notas.trim() || undefined },
      }),
    onSuccess: async () => {
      setResultado('');
      setNotas('');
      await qc.invalidateQueries({ queryKey: ['customerInteractions', id] });
      onRegistrado();
    },
  });

  return (
    <section className="cartao cl-largo" aria-labelledby="cd-t-contatos">
      <div className="cartao__topo">
        <div>
          <h2 className="cartao__titulo" id="cd-t-contatos">
            Contatos com o cliente
          </h2>
          <p className="cartao__sub">Registre tentativas e retornos para apoiar a recuperação e o histórico.</p>
        </div>
      </div>
      {podeEditar && (
        <form
          className="gaveta__form"
          onSubmit={(e) => {
            e.preventDefault();
            registrar.mutate();
          }}
        >
          <div className="campos-2">
            <div className="campo">
              <label htmlFor="cd-canal">Canal</label>
              <select id="cd-canal" value={canal} onChange={(e) => setCanal(e.target.value)}>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Telefone</option>
                <option value="email">E-mail</option>
                <option value="sms">SMS</option>
                <option value="in_person">Presencial</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="cd-resultado">Resultado</label>
              <input
                id="cd-resultado"
                value={resultado}
                placeholder="Ex.: respondeu, sem retorno, agendado"
                onChange={(e) => setResultado(e.target.value)}
              />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="cd-contato-notas">
              Notas <span className="cl-mudo">(opcional)</span>
            </label>
            <textarea id="cd-contato-notas" rows={3} value={notas} placeholder="Resumo do contato" onChange={(e) => setNotas(e.target.value)} />
          </div>
          {registrar.isError && (
            <p className="cl-lgpd" role="alert">
              <Icone nome="alerta" />
              <span>Não foi possível registrar o contato.</span>
            </p>
          )}
          <div className="gaveta__acoes">
            <button className="btn btn--primario" type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? 'Registrando…' : 'Registrar contato'}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 18 }}>
        {interacoes.isLoading && <p className="cl-mudo">Carregando…</p>}
        {interacoes.isError && <p className="cl-mudo">Falha ao carregar o histórico.</p>}
        {interacoes.data && interacoes.data.length === 0 && <p className="cl-mudo">Nenhum contato registrado.</p>}
        {interacoes.data && interacoes.data.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela cl-tabela-simples">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Canal</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Notas</th>
                  <th scope="col">Operador</th>
                </tr>
              </thead>
              <tbody>
                {interacoes.data.map((i) => (
                  <tr key={i.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dataHora(i.createdAt)}</td>
                    <td>{interactionChannelLabel(i.channel)}</td>
                    <td className="cl-quebra">{i.outcome ?? '—'}</td>
                    <td className="cl-quebra">{i.notes ?? '—'}</td>
                    <td>{i.createdByUser?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function CustomerDetailPage() {
  const params = useParams();
  const id = params.id ?? '';
  const pode = usePode();
  const podeEditar = pode('customer:manage');
  const podeVerRespostas = pode('response:read');
  const { unidades } = useUnidadesPermitidas();
  const [aviso, avisar] = useAviso();

  const customer = useQuery({
    queryKey: ['customer', id],
    queryFn: () => apiFetch<Cliente>(`/customers/${id}`),
    enabled: Boolean(id),
  });
  const responses = useQuery({
    queryKey: ['customerResponses', id],
    queryFn: () => apiFetch<RespostaCliente[]>(`/customers/${id}/responses`),
    enabled: Boolean(id) && podeVerRespostas,
  });
  const cases = useQuery({
    queryKey: ['customerCases', id],
    queryFn: () => apiFetch<OcorrenciaCliente[]>(`/customers/${id}/cases`),
    enabled: Boolean(id) && podeVerRespostas,
  });

  if (!id) return <p className="vazio">Cliente inválido</p>;
  const c = customer.data;
  const nome = c?.name || 'Cliente sem nome';

  return (
    <>
      <div className="cabeca">
        <div>
          <p className="trilha">
            <Link to="/app/customers">Clientes</Link>
            <span aria-hidden="true">›</span>
            <span>{c ? nome : 'Cliente'}</span>
          </p>
          <div className="cl-cabeca">
            <span className="avatar" aria-hidden="true">
              {iniciais(nome)}
            </span>
            <div>
              <h1 className="cabeca__titulo">{customer.isLoading ? 'Carregando…' : nome}</h1>
              <p className="cabeca__desc">{c ? origemTexto(c.source) : 'Histórico e cadastro vinculados às respostas'}</p>
            </div>
          </div>
        </div>
        <div className="cabeca__acoes">
          <Link className="btn btn--secundario" to="/app/customers">
            Voltar para a lista
          </Link>
        </div>
      </div>

      {customer.isError && (
        <p className="vazio cartao">
          <strong>Não foi possível carregar o cliente</strong>
          Ele pode não existir ou estar em uma unidade que você não acessa.
        </p>
      )}

      {c && (
        <div className="cl-pagina">
          <section className="cartao" aria-labelledby="cd-t-cadastro">
            <div className="cartao__topo">
              <div>
                <h2 className="cartao__titulo" id="cd-t-cadastro">
                  Cadastro
                </h2>
                <p className="cartao__sub">Identificação, contato e aceite de ofertas.</p>
              </div>
            </div>
            <DadosClienteForm
              key={c.id}
              cliente={c}
              unidades={unidades}
              podeEditar={podeEditar}
              prefixo="cd"
              onSalvo={() => avisar('Cadastro salvo')}
            />
            <p className="cl-id" style={{ marginTop: 12 }}>
              {c.id}
            </p>
          </section>

          <div className="cl-coluna">
            <section className="cartao" aria-labelledby="cd-t-resumo">
              <div className="cartao__topo">
                <h2 className="cartao__titulo" id="cd-t-resumo">
                  Resumo
                </h2>
              </div>
              <div className="rk-detalhe">
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
                    <strong>
                      {typeof c.satisfactionAvg === 'number' ? c.satisfactionAvg.toFixed(1).replace('.', ',') : '—'}
                    </strong>
                  </div>
                </div>
                <dl className="cl-linhas">
                  <div>
                    <dt>Primeira interação</dt>
                    <dd>{dataHora(c.firstInteractionAt)}</dd>
                  </div>
                  <div>
                    <dt>Última interação</dt>
                    <dd>{dataHora(c.lastInteractionAt)}</dd>
                  </div>
                  <div>
                    <dt>Cadastrado em</dt>
                    <dd>{dataHora(c.createdAt)}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <AcoesCrm key={c.id} cliente={c} podeEditar={podeEditar} onSalvo={() => avisar('Alterações salvas')} />
          </div>

          <Contatos id={id} podeEditar={podeEditar} onRegistrado={() => avisar('Contato registrado')} />

          {podeVerRespostas && (
            <section className="cartao cl-largo" aria-labelledby="cd-t-respostas">
              <div className="cartao__topo">
                <div>
                  <h2 className="cartao__titulo" id="cd-t-respostas">
                    Respostas
                  </h2>
                  <p className="cartao__sub">Pesquisas respondidas por este cliente.</p>
                </div>
              </div>
              {responses.isLoading && <p className="cl-mudo">Carregando…</p>}
              {responses.isError && <p className="cl-mudo">Falha ao carregar as respostas.</p>}
              {responses.data && responses.data.length === 0 && <p className="cl-mudo">Nenhuma resposta.</p>}
              {responses.data && responses.data.length > 0 && (
                <div className="tabela-rolagem">
                  <table className="tabela cl-tabela-simples">
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Pesquisa</th>
                        <th scope="col">Unidade</th>
                        <th scope="col">Nota</th>
                        <th scope="col">Comentário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {responses.data.map((r) => (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{dataHora(r.completedAt ?? r.startedAt)}</td>
                          <td>{r.survey.name}</td>
                          <td>{r.unit?.name ?? '—'}</td>
                          <td>{typeof r.npsScore === 'number' ? <NotaSelo nota={r.npsScore} /> : '—'}</td>
                          <td className="cl-quebra">{r.mainComment ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {podeVerRespostas && (
            <section className="cartao cl-largo" aria-labelledby="cd-t-ocs">
              <div className="cartao__topo">
                <div>
                  <h2 className="cartao__titulo" id="cd-t-ocs">
                    Ocorrências
                  </h2>
                  <p className="cartao__sub">Casos abertos para detratores ou tratativas.</p>
                </div>
              </div>
              {cases.isLoading && <p className="cl-mudo">Carregando…</p>}
              {cases.isError && <p className="cl-mudo">Falha ao carregar as ocorrências.</p>}
              {cases.data && cases.data.length === 0 && <p className="cl-mudo">Nenhuma ocorrência.</p>}
              {cases.data && cases.data.length > 0 && (
                <div className="tabela-rolagem">
                  <table className="tabela cl-tabela-simples">
                    <thead>
                      <tr>
                        <th scope="col">Etapa</th>
                        <th scope="col">Prioridade</th>
                        <th scope="col">Unidade</th>
                        <th scope="col">Atualizada</th>
                        <th scope="col">
                          <span className="visualmente-oculto">Abrir</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.data.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <EtapaOcorrencia status={o.status} />
                          </td>
                          <td>{feedbackCasePriorityLabel(o.priority)}</td>
                          <td>{o.unit?.name ?? '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }} title={dataHora(o.updatedAt)}>
                            {quando(o.updatedAt)}
                          </td>
                          <td>
                            <Link className="link-texto" to={`/app/feedbacks/${o.surveyResponse.id}`}>
                              Abrir
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {aviso}
    </>
  );
}
