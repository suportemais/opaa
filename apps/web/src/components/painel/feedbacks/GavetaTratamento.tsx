import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { sentimentLabel, sentimentThemeLabel } from '../../../lib/labels';
import { Icone } from '../Icone';
import { useAuthMe } from '../usePainel';
import {
  classeNota,
  dataHora,
  deInputData,
  ETAPAS,
  etapaRotulo,
  nomeCliente,
  paraInputData,
  prazoInfo,
  PRIORIDADES,
  prioridadeRotulo,
  quando,
  type FeedbackDetalhe,
} from './comum';
import { HistoricoCaso } from './partes';
import { useDetalheFeedback, useResponsaveis, useTratamento, type MudancasCaso } from './useTratamento';

type Props = {
  /** id da resposta (survey response) aberta; null = gaveta fechada */
  responseId: string | null;
  onFechar: () => void;
  avisar: (texto: string) => void;
};

/** Gaveta de tratamento (etapa, responsável, prioridade, prazo, anotação e histórico). Só para feedback:manage. */
export function GavetaTratamento({ responseId, onFechar, avisar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const gatilho = useRef<HTMLElement | null>(null);
  const detalhe = useDetalheFeedback(responseId);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (responseId && !d.open) {
      gatilho.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!responseId && d.open) {
      d.close();
    }
  }, [responseId]);

  // O leitor de tela começa pelo comentário
  useEffect(() => {
    if (responseId && detalhe.data) ref.current?.querySelector<HTMLElement>('#g-titulo')?.focus();
  }, [responseId, detalhe.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <dialog
      ref={ref}
      className="gaveta"
      aria-labelledby="g-titulo"
      onClose={() => {
        onFechar();
        gatilho.current?.focus?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {responseId && (
        <div className="gaveta__corpo">
          <div className="gaveta__topo">
            <span className="gaveta__id">#{responseId.slice(0, 8)}</span>
            <div className="fbx-topo-acoes">
              <Link className="btn btn--fantasma" to={`/app/feedbacks/${responseId}`}>
                Abrir página completa
                <Icone nome="seta" />
              </Link>
              <button className="botao-icone" type="button" aria-label="Fechar" onClick={() => ref.current?.close()}>
                <Icone nome="fechar" />
              </button>
            </div>
          </div>

          {detalhe.isLoading && <p className="fbx-mudo">Carregando…</p>}
          {detalhe.isError && (
            <p className="fbx-erro" role="alert">
              Não foi possível carregar este feedback.
            </p>
          )}
          {detalhe.data && (
            <ConteudoGaveta
              key={`${detalhe.data.id}-${detalhe.data.feedbackCase?.id ?? 'sem'}`}
              d={detalhe.data}
              fechar={() => ref.current?.close()}
              avisar={avisar}
            />
          )}
        </div>
      )}
    </dialog>
  );
}

function ConteudoGaveta({ d, fechar, avisar }: { d: FeedbackDetalhe; fechar: () => void; avisar: (t: string) => void }) {
  const me = useAuthMe();
  const responsaveis = useResponsaveis(true);
  const { salvar, atribuirAMim, criarOcorrencia } = useTratamento(d.id);
  const caso = d.feedbackCase;

  const [etapa, setEtapa] = useState(caso?.status ?? 'new');
  const [responsavel, setResponsavel] = useState(caso?.assigneeUserId ?? '');
  const [prioridade, setPrioridade] = useState(caso?.priority ?? 'normal');
  const [prazo, setPrazo] = useState(paraInputData(caso?.dueAt));
  const [anotacao, setAnotacao] = useState('');

  // Mantém o formulário em dia quando o caso muda por fora (ex.: "Atribuir a mim")
  useEffect(() => {
    setResponsavel(caso?.assigneeUserId ?? '');
  }, [caso?.assigneeUserId]);

  const opcoes = [...(responsaveis.data ?? [])];
  if (caso?.assignee && !opcoes.some((u) => u.id === caso.assignee!.id)) {
    opcoes.push({ id: caso.assignee.id, name: caso.assignee.name });
  }
  const nomeUsuario = (id: string) => opcoes.find((u) => u.id === id)?.name;
  const p = caso ? prazoInfo(caso.status, caso.dueAt) : null;

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!caso) return;
    const mudancas: MudancasCaso = {};
    if (etapa !== caso.status) mudancas.status = etapa;
    if ((responsavel || null) !== caso.assigneeUserId) mudancas.assigneeUserId = responsavel || null;
    if (prioridade !== caso.priority) mudancas.priority = prioridade;
    if (prazo !== paraInputData(caso.dueAt)) mudancas.dueAt = deInputData(prazo);
    if (!Object.keys(mudancas).length && !anotacao.trim()) {
      fechar();
      return;
    }
    salvar.mutate(
      { mudancas, anotacao },
      {
        onSuccess: () => {
          avisar('Feedback atualizado');
          fechar();
        },
      },
    );
  }

  return (
    <>
      <div className="gaveta__titulo">
        <span className={classeNota(d.npsClass)} aria-label={d.npsScore != null ? `Nota ${d.npsScore} de 1 a 10` : 'Sem nota'}>
          {d.npsScore ?? '—'}
        </span>
        <h2 id="g-titulo" tabIndex={-1}>
          {d.mainComment?.trim() ? `“${d.mainComment.trim()}”` : 'Sem comentário: só a nota.'}
        </h2>
      </div>

      <dl className="dados">
        <div>
          <dt>Cliente</dt>
          <dd>{d.customer ? nomeCliente(d.customer) : 'Não identificado'}</dd>
        </div>
        <div>
          <dt>Unidade</dt>
          <dd>{d.unit?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Tema</dt>
          <dd>
            {d.sentimentTheme ? sentimentThemeLabel(d.sentimentTheme) : '—'}
            {d.sentiment ? ` · ${sentimentLabel(d.sentiment)}` : ''}
          </dd>
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
          <dt>Prazo</dt>
          <dd>{p ? <span className={p.classe}>{p.texto}</span> : '—'}</dd>
        </div>
      </dl>

      {!caso ? (
        <div className="fbx-sem-caso">
          <p>Este feedback ainda não tem ocorrência de tratamento.</p>
          <button
            className="btn btn--primario"
            type="button"
            disabled={criarOcorrencia.isPending}
            onClick={() => criarOcorrencia.mutate(undefined, { onSuccess: () => avisar('Ocorrência criada') })}
          >
            {criarOcorrencia.isPending ? 'Criando…' : 'Criar ocorrência'}
          </button>
          {criarOcorrencia.isError && (
            <p className="fbx-erro" role="alert">
              Falha ao criar ocorrência.
            </p>
          )}
        </div>
      ) : (
        <>
          <form className="gaveta__form" onSubmit={enviar}>
            <div className="campos-2">
              <div className="campo">
                <label htmlFor="g-etapa">Etapa</label>
                <select id="g-etapa" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
                  {ETAPAS.map((s) => (
                    <option key={s} value={s}>
                      {etapaRotulo(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="g-responsavel">Responsável</label>
                <select id="g-responsavel" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
                  <option value="">Sem responsável</option>
                  {opcoes.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id === me.data?.id ? `${u.name} (você)` : u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="g-prioridade">Prioridade</label>
                <select id="g-prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                  {PRIORIDADES.map((s) => (
                    <option key={s} value={s}>
                      {prioridadeRotulo(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="g-prazo">Prazo</label>
                <input id="g-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            </div>
            <div className="campo">
              <label htmlFor="g-anotacao">
                Anotação interna <span className="fbx-opcional">(opcional)</span>
              </label>
              <textarea
                id="g-anotacao"
                maxLength={2000}
                value={anotacao}
                onChange={(e) => setAnotacao(e.target.value)}
                placeholder="Ex.: Liguei para o cliente e ofereci uma cortesia."
              />
            </div>
            {salvar.isError && (
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
              <button className="btn btn--secundario" type="button" onClick={fechar}>
                Cancelar
              </button>
              <button className="btn btn--primario" type="submit" disabled={salvar.isPending}>
                {salvar.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>

          <HistoricoCaso eventos={caso.events} nomeUsuario={nomeUsuario} tituloId="g-historico" />
        </>
      )}
    </>
  );
}
