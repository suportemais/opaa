import '../styles/painel-feedbacks.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { interactionChannelLabel, sentimentLabel, sentimentThemeLabel } from '../lib/labels';
import { formatAnswerDisplay } from '../lib/question-types';
import { Icone } from '../components/painel/Icone';
import { useAuthMe, usePode } from '../components/painel/usePainel';
import {
  classeEtapa,
  classeNota,
  dataCompleta,
  dataHora,
  deInputData,
  ETAPAS,
  etapaRotulo,
  paraInputData,
  prazoInfo,
  PRIORIDADES,
  prioridadeRotulo,
  quando,
  rotuloClasseNps,
  type CaseInteraction,
  type FeedbackDetalhe,
} from '../components/painel/feedbacks/comum';
import { HistoricoCaso, Responsavel } from '../components/painel/feedbacks/partes';
import {
  useDetalheFeedback,
  useResponsaveis,
  useTratamento,
  type MudancasCaso,
} from '../components/painel/feedbacks/useTratamento';

/** /app/feedbacks/:id — página completa do feedback e do seu tratamento (ocorrência). */
export function FeedbackDetailPage() {
  const params = useParams();
  const id = params.id ?? '';
  const pode = usePode();
  const podeTratar = pode('feedback:manage');
  const detalhe = useDetalheFeedback(id || null);
  const { criarOcorrencia } = useTratamento(id);

  const [toast, setToast] = useState('');
  const toastTempo = useRef<number | undefined>(undefined);
  const avisar = useCallback((texto: string) => {
    setToast(texto);
    window.clearTimeout(toastTempo.current);
    toastTempo.current = window.setTimeout(() => setToast(''), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTempo.current), []);

  const d = detalhe.data;

  return (
    <>
      <div className="cabeca">
        <div>
          <Link className="btn btn--fantasma fbx-voltar" to="/app/feedbacks">
            <Icone nome="seta" className="fbx-seta-volta" />
            Feedbacks
          </Link>
          <h1 className="cabeca__titulo">Feedback {id ? `#${id.slice(0, 8)}` : ''}</h1>
          {d && (
            <p className="cabeca__desc">
              Recebido em {dataCompleta(d.completedAt)}
              {d.survey?.name ? ` · ${d.survey.name}` : ''}
            </p>
          )}
        </div>
        {d && !d.feedbackCase && podeTratar && (
          <div className="cabeca__acoes">
            <button
              className="btn btn--primario"
              type="button"
              disabled={criarOcorrencia.isPending}
              onClick={() => criarOcorrencia.mutate(undefined, { onSuccess: () => avisar('Ocorrência criada') })}
            >
              <Icone nome="mais" />
              {criarOcorrencia.isPending ? 'Criando…' : 'Criar ocorrência'}
            </button>
          </div>
        )}
      </div>

      {detalhe.isLoading && <p className="fbx-mudo">Carregando…</p>}
      {detalhe.isError && (
        <div className="cartao vazio" role="alert">
          <strong>Falha ao carregar</strong>O feedback não foi encontrado ou você não tem acesso a ele.
        </div>
      )}
      {criarOcorrencia.isError && (
        <p className="fbx-erro" role="alert">
          Falha ao criar ocorrência.
        </p>
      )}

      {d && (
        <div className="fbx-detalhe">
          <div className="fbx-detalhe__principal">
            <Resumo d={d} />
            {d.feedbackCase ? (
              <Tratamento key={`${d.feedbackCase.id}-${d.feedbackCase.events.length}`} d={d} podeTratar={podeTratar} avisar={avisar} />
            ) : (
              <section className="cartao" aria-labelledby="fd-sem-caso">
                <h2 className="cartao__titulo" id="fd-sem-caso">
                  <Icone nome="ocorrencias" />
                  Tratamento
                </h2>
                <p className="fbx-mudo">
                  Sem ocorrência gerada.
                  {podeTratar ? ' Use "Criar ocorrência" para dar responsável, prazo e acompanhar o tratamento.' : ''}
                </p>
              </section>
            )}
            <Respostas d={d} />
          </div>
          <div className="fbx-detalhe__lateral">
            <Cliente d={d} />
            {d.feedbackCase && <Contatos id={d.id} podeRegistrar={podeTratar && Boolean(d.customerId)} temCliente={Boolean(d.customerId)} avisar={avisar} />}
          </div>
        </div>
      )}

      <p className="toast" role="status" aria-live="polite" data-oculto={toast ? undefined : ''}>
        {toast}
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------

function Resumo({ d }: { d: FeedbackDetalhe }) {
  return (
    <section className="cartao fbx-resumo" aria-labelledby="fd-comentario">
      <div className="gaveta__titulo">
        <span className={classeNota(d.npsClass)} aria-label={d.npsScore != null ? `Nota ${d.npsScore} de 1 a 10` : 'Sem nota'}>
          {d.npsScore ?? '—'}
        </span>
        <h2 id="fd-comentario">{d.mainComment?.trim() ? `“${d.mainComment.trim()}”` : 'Sem comentário: só a nota.'}</h2>
      </div>
      <div className="fb-item__tags">
        {d.npsClass && <span className="fb-tag">{rotuloClasseNps(d.npsClass)}</span>}
        {d.sentiment && <span className={`fb-tag fb-tag--${d.sentiment}`}>{sentimentLabel(d.sentiment)}</span>}
        {d.sentimentTheme && <span className="fb-tag">{sentimentThemeLabel(d.sentimentTheme)}</span>}
      </div>
      {d.sentimentSummary && (
        <p className="fbx-resumo-ia">
          <span className="selo-ia">
            <Icone nome="ia" />
            IA
          </span>{' '}
          {d.sentimentSummary}
        </p>
      )}
      <dl className="dados">
        <div>
          <dt>Unidade</dt>
          <dd>{d.unit?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Atendente</dt>
          <dd>{d.employee?.name ?? 'Não informado'}</dd>
        </div>
        <div>
          <dt>Recebido</dt>
          <dd>
            {dataHora(d.completedAt)} {d.completedAt ? `(${quando(d.completedAt)})` : ''}
          </dd>
        </div>
        <div>
          <dt>Pesquisa</dt>
          <dd>{d.survey?.name ?? '—'}</dd>
        </div>
      </dl>
      <p className="fbx-id">{d.id}</p>
    </section>
  );
}

function Respostas({ d }: { d: FeedbackDetalhe }) {
  return (
    <section className="cartao" aria-labelledby="fd-respostas">
      <h2 className="cartao__titulo" id="fd-respostas">
        <Icone nome="pesquisas" />
        Respostas da pesquisa
      </h2>
      {d.answers.length === 0 ? (
        <p className="fbx-mudo">Sem respostas registradas.</p>
      ) : (
        <dl className="fbx-respostas">
          {d.answers.map((a) => (
            <div key={a.id}>
              <dt>{a.question.title}</dt>
              <dd>{formatAnswerDisplay(a.question.type, a.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Cliente({ d }: { d: FeedbackDetalhe }) {
  const c = d.customer;
  const nome = c?.name?.trim() || 'Cliente';
  const email = c?.email?.trim() ?? '';
  const telefone = c?.phone?.trim() ?? '';
  const digitos = telefone.replace(/\D+/g, '');
  return (
    <section className="cartao" aria-labelledby="fd-cliente">
      <h2 className="cartao__titulo" id="fd-cliente">
        <Icone nome="clientes" />
        Cliente
      </h2>
      {!d.customerId || !c ? (
        <p className="fbx-mudo">Resposta sem identificação.</p>
      ) : (
        <div className="fbx-cliente">
          <p className="fbx-cliente__nome">{nome}</p>
          {c.doNotContact && <span className="fb-tag fb-tag--reclamacao">Não contatar</span>}
          <dl className="fbx-cliente__dados">
            <div>
              <dt>E-mail</dt>
              <dd>{email ? <a href={`mailto:${email}`}>{email}</a> : '—'}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>
                {telefone ? (
                  <>
                    <a href={`tel:${digitos || telefone}`}>{telefone}</a>
                    {digitos && (
                      <>
                        {' · '}
                        <a href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                      </>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
          <Link className="btn btn--fantasma fbx-cliente__link" to={`/app/customers/${c.id}`}>
            Ver cadastro do cliente
            <Icone nome="seta" />
          </Link>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Tratamento({ d, podeTratar, avisar }: { d: FeedbackDetalhe; podeTratar: boolean; avisar: (t: string) => void }) {
  const caso = d.feedbackCase!;
  const me = useAuthMe();
  const responsaveis = useResponsaveis(podeTratar);
  const { salvar, atribuirAMim } = useTratamento(d.id);

  const [etapa, setEtapa] = useState(caso.status);
  const [responsavel, setResponsavel] = useState(caso.assigneeUserId ?? '');
  const [prioridade, setPrioridade] = useState(caso.priority);
  const [prazo, setPrazo] = useState(paraInputData(caso.dueAt));
  const [causa, setCausa] = useState(caso.rootCause ?? '');
  const [acao, setAcao] = useState(caso.correctiveAction ?? '');
  const [resolucao, setResolucao] = useState(caso.resolution ?? '');
  const [anotacao, setAnotacao] = useState('');

  const opcoes = [...(responsaveis.data ?? [])];
  if (caso.assignee && !opcoes.some((u) => u.id === caso.assignee!.id)) {
    opcoes.push({ id: caso.assignee.id, name: caso.assignee.name });
  }
  const nomeUsuario = (uid: string) => opcoes.find((u) => u.id === uid)?.name ?? (uid === me.data?.id ? me.data?.name : undefined);
  const p = prazoInfo(caso.status, caso.dueAt);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const m: MudancasCaso = {};
    if (etapa !== caso.status) m.status = etapa;
    if ((responsavel || null) !== caso.assigneeUserId) m.assigneeUserId = responsavel || null;
    if (prioridade !== caso.priority) m.priority = prioridade;
    if (prazo !== paraInputData(caso.dueAt)) m.dueAt = deInputData(prazo);
    if (causa.trim() !== (caso.rootCause ?? '')) m.rootCause = causa;
    if (acao.trim() !== (caso.correctiveAction ?? '')) m.correctiveAction = acao;
    if (resolucao.trim() !== (caso.resolution ?? '')) m.resolution = resolucao;
    if (!Object.keys(m).length && !anotacao.trim()) {
      avisar('Nada para salvar');
      return;
    }
    salvar.mutate(
      { mudancas: m, anotacao },
      {
        onSuccess: () => {
          setAnotacao('');
          avisar('Tratamento salvo');
        },
      },
    );
  }

  return (
    <section className="cartao fbx-tratamento" aria-labelledby="fd-tratamento">
      <div className="cartao__topo">
        <h2 className="cartao__titulo" id="fd-tratamento">
          <Icone nome="ocorrencias" />
          Tratamento
        </h2>
        <span className={classeEtapa(caso.status)}>{etapaRotulo(caso.status)}</span>
      </div>

      <dl className="dados">
        <div>
          <dt>Responsável</dt>
          <dd>
            <Responsavel nome={caso.assignee?.name} eu={Boolean(me.data?.id) && caso.assigneeUserId === me.data?.id} />
          </dd>
        </div>
        <div>
          <dt>Prazo</dt>
          <dd>
            <span className={p.classe || 'prazo'}>
              <Icone nome="relogio" />
              {p.texto}
            </span>
          </dd>
        </div>
        <div>
          <dt>Prioridade</dt>
          <dd>{prioridadeRotulo(caso.priority)}</dd>
        </div>
        <div>
          <dt>Aberta</dt>
          <dd>{caso.createdAt ? dataHora(caso.createdAt) : '—'}</dd>
        </div>
      </dl>

      {podeTratar ? (
        <form className="gaveta__form" onSubmit={enviar}>
          <div className="campos-2">
            <div className="campo">
              <label htmlFor="fd-etapa">Etapa</label>
              <select id="fd-etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                {ETAPAS.map((s) => (
                  <option key={s} value={s}>
                    {etapaRotulo(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="fd-responsavel">Responsável</label>
              <select id="fd-responsavel" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
                <option value="">Sem responsável</option>
                {opcoes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.id === me.data?.id ? `${u.name} (você)` : u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="fd-prioridade">Prioridade</label>
              <select id="fd-prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                {PRIORIDADES.map((s) => (
                  <option key={s} value={s}>
                    {prioridadeRotulo(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="fd-prazo">Prazo (vencimento)</label>
              <input id="fd-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="fd-causa">Causa raiz</label>
            <textarea id="fd-causa" value={causa} onChange={(e) => setCausa(e.target.value)} placeholder="O que provocou o problema?" />
          </div>
          <div className="campo">
            <label htmlFor="fd-acao">Ação corretiva</label>
            <textarea id="fd-acao" value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="O que foi feito para não acontecer de novo?" />
          </div>
          <div className="campo">
            <label htmlFor="fd-resolucao">Resolução</label>
            <textarea id="fd-resolucao" value={resolucao} onChange={(e) => setResolucao(e.target.value)} placeholder="Como o caso foi resolvido com o cliente?" />
          </div>
          <div className="campo">
            <label htmlFor="fd-anotacao">
              Anotação interna <span className="fbx-opcional">(opcional)</span>
            </label>
            <textarea
              id="fd-anotacao"
              maxLength={2000}
              value={anotacao}
              onChange={(e) => setAnotacao(e.target.value)}
              placeholder="Ex.: Liguei para o cliente e ofereci uma cortesia."
            />
          </div>
          {(salvar.isError || atribuirAMim.isError) && (
            <p className="fbx-erro" role="alert">
              Não foi possível salvar. Tente de novo.
            </p>
          )}
          <div className="gaveta__acoes fbx-gaveta-acoes">
            <button
              className="btn btn--fantasma fbx-atribuir"
              type="button"
              disabled={atribuirAMim.isPending || caso.assigneeUserId === me.data?.id}
              onClick={() => atribuirAMim.mutate(undefined, { onSuccess: () => avisar('Atribuído a você') })}
            >
              <Icone nome="pessoa" />
              {atribuirAMim.isPending ? 'Atribuindo…' : 'Atribuir a mim'}
            </button>
            <button className="btn btn--primario" type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      ) : (
        (caso.rootCause || caso.correctiveAction || caso.resolution) && (
          <dl className="fbx-respostas">
            {caso.rootCause && (
              <div>
                <dt>Causa raiz</dt>
                <dd>{caso.rootCause}</dd>
              </div>
            )}
            {caso.correctiveAction && (
              <div>
                <dt>Ação corretiva</dt>
                <dd>{caso.correctiveAction}</dd>
              </div>
            )}
            {caso.resolution && (
              <div>
                <dt>Resolução</dt>
                <dd>{caso.resolution}</dd>
              </div>
            )}
          </dl>
        )
      )}

      <HistoricoCaso eventos={caso.events} nomeUsuario={nomeUsuario} tituloId="fd-historico" />
    </section>
  );
}

// ---------------------------------------------------------------------------

function Contatos({
  id,
  podeRegistrar,
  temCliente,
  avisar,
}: {
  id: string;
  podeRegistrar: boolean;
  temCliente: boolean;
  avisar: (t: string) => void;
}) {
  const qc = useQueryClient();
  const pode = usePode();
  const interacoes = useQuery({
    queryKey: ['feedback', id, 'caseInteractions'],
    queryFn: () => apiFetch<CaseInteraction[]>(`/feedbacks/${id}/case/interactions`),
  });
  const [canal, setCanal] = useState('whatsapp');
  const [resultado, setResultado] = useState('');
  const [notas, setNotas] = useState('');

  const registrar = useMutation({
    mutationFn: () =>
      apiFetch(`/feedbacks/${id}/case/interactions`, {
        method: 'POST',
        json: { channel: canal, direction: 'outbound', outcome: resultado.trim() || undefined, notes: notas.trim() || undefined },
      }),
    onSuccess: async () => {
      setResultado('');
      setNotas('');
      avisar('Contato registrado');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['feedback', id, 'caseInteractions'] }),
        qc.invalidateQueries({ queryKey: ['feedback', id] }),
      ]);
    },
  });

  return (
    <section className="cartao fbx-contatos" aria-labelledby="fd-contatos">
      <h2 className="cartao__titulo" id="fd-contatos">
        <Icone nome="celular" />
        Contato com o cliente
      </h2>

      {pode('feedback:manage') && (
        <>
          {!temCliente && (
            <p className="fbx-aviso">
              Cliente não identificado. Para registrar contato, é necessário que o cliente se identifique na pesquisa.
            </p>
          )}
          <form
            className="gaveta__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (podeRegistrar) registrar.mutate();
            }}
          >
            <div className="campo">
              <label htmlFor="fd-canal">Canal</label>
              <select id="fd-canal" value={canal} onChange={(e) => setCanal(e.target.value)} disabled={!podeRegistrar}>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Telefone</option>
                <option value="email">E-mail</option>
                <option value="sms">SMS</option>
                <option value="in_person">Presencial</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="fd-resultado">
                Resultado <span className="fbx-opcional">(opcional)</span>
              </label>
              <input id="fd-resultado" value={resultado} onChange={(e) => setResultado(e.target.value)} disabled={!podeRegistrar} />
            </div>
            <div className="campo">
              <label htmlFor="fd-notas">
                Notas do contato <span className="fbx-opcional">(opcional)</span>
              </label>
              <textarea id="fd-notas" value={notas} onChange={(e) => setNotas(e.target.value)} disabled={!podeRegistrar} />
            </div>
            {registrar.isError && (
              <p className="fbx-erro" role="alert">
                Falha ao registrar contato.
              </p>
            )}
            <div className="gaveta__acoes">
              <button className="btn btn--secundario" type="submit" disabled={!podeRegistrar || registrar.isPending}>
                {registrar.isPending ? 'Registrando…' : 'Registrar contato'}
              </button>
            </div>
          </form>
        </>
      )}

      <section className="historico" aria-labelledby="fd-hist-contatos">
        <h3 className="historico__titulo" id="fd-hist-contatos">
          Histórico de contatos
        </h3>
        {interacoes.isLoading && <p className="fbx-mudo">Carregando…</p>}
        {interacoes.isError && <p className="fbx-erro">Falha ao carregar contatos.</p>}
        {interacoes.data && interacoes.data.length === 0 && <p className="fbx-mudo">Nenhum contato registrado.</p>}
        {interacoes.data && interacoes.data.length > 0 && (
          <ul>
            {[...interacoes.data].reverse().map((i) => (
              <li key={i.id}>
                <strong>{interactionChannelLabel(i.channel)}</strong>
                {i.outcome ? ` · ${i.outcome}` : ''}
                {i.notes && <span className="fbx-contato-notas">{i.notes}</span>}
                <span className="historico__quando">
                  <time dateTime={i.createdAt}>{dataCompleta(i.createdAt)}</time>
                  {i.createdByUser?.name ? ` · ${i.createdByUser.name}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
