import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { apiFetch } from '../../../lib/api';
import {
  whistleblowerEventLabel,
  whistleblowerPriorityLabel,
  whistleblowerStatusLabel,
} from '../../../lib/labels';
import { PRIORIDADES, SITUACOES, dataHora, quando, type DenunciaDetalhe, type DenunciaEvento } from './comum';
import { useInvalidarDenuncias, useResponsaveis } from './hooks';

/**
 * Situação, prioridade, responsável e anotação interna (PATCH /whistleblower/:id).
 * Usado na gaveta da lista e na página de detalhe.
 */
export function GestaoForm({
  denuncia,
  onSalvo,
  acoesExtras,
}: {
  denuncia: DenunciaDetalhe;
  onSalvo?: (mudou: boolean) => void;
  acoesExtras?: ReactNode;
}) {
  const uid = useId();
  const invalidar = useInvalidarDenuncias();
  const responsaveis = useResponsaveis();

  const [status, setStatus] = useState(denuncia.status);
  const [priority, setPriority] = useState(denuncia.priority);
  const [assignee, setAssignee] = useState(denuncia.assigneeUserId ?? '');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setStatus(denuncia.status);
    setPriority(denuncia.priority);
    setAssignee(denuncia.assigneeUserId ?? '');
  }, [denuncia.id, denuncia.status, denuncia.priority, denuncia.assigneeUserId]);

  const mudouResponsavel = assignee !== (denuncia.assigneeUserId ?? '');
  const mudou = status !== denuncia.status || priority !== denuncia.priority || mudouResponsavel || Boolean(notes.trim());

  const salvar = useMutation({
    mutationFn: () =>
      apiFetch(`/whistleblower/${denuncia.id}`, {
        method: 'PATCH',
        json: {
          status,
          priority,
          ...(mudouResponsavel ? { assigneeUserId: assignee || null } : {}),
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      setNotes('');
      await invalidar();
      onSalvo?.(true);
    },
  });

  const opcoesResponsavel = [...(responsaveis.data ?? [])];
  if (denuncia.assignee && !opcoesResponsavel.some((u) => u.id === denuncia.assignee?.id)) {
    opcoesResponsavel.unshift({ id: denuncia.assignee.id, name: denuncia.assignee.name });
  }

  return (
    <form
      className="gaveta__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!mudou) {
          onSalvo?.(false);
          return;
        }
        salvar.mutate();
      }}
    >
      <div className="campos-2">
        <div className="campo">
          <label htmlFor={`${uid}-situacao`}>Situação</label>
          <select id={`${uid}-situacao`} value={status} onChange={(e) => setStatus(e.target.value)}>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {whistleblowerStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor={`${uid}-prioridade`}>Prioridade</label>
          <select id={`${uid}-prioridade`} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {whistleblowerPriorityLabel(p)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-responsavel`}>Responsável</label>
        {responsaveis.isError || (!responsaveis.data && !responsaveis.isLoading && !denuncia.assignee) ? (
          <input id={`${uid}-responsavel`} type="text" readOnly value={denuncia.assignee?.name ?? 'Sem responsável'} />
        ) : (
          <select
            id={`${uid}-responsavel`}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            disabled={responsaveis.isLoading}
          >
            <option value="">Sem responsável</option>
            {opcoesResponsavel.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="campo">
        <label htmlFor={`${uid}-anotacao`}>
          Anotação interna <span className="opcional">(opcional)</span>
        </label>
        <textarea
          id={`${uid}-anotacao`}
          aria-describedby={`${uid}-anotacao-dica`}
          placeholder="Ex.: Conversei com o RH; vamos ouvir a equipe do turno da noite."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="campo__dica" id={`${uid}-anotacao-dica`}>
          Só quem tem acesso a Denúncias vê. Quem denunciou não vê.
        </p>
      </div>
      {salvar.isError && (
        <p className="cli__erro cli__erro--geral" role="alert">
          Não foi possível salvar. Tente de novo.
        </p>
      )}
      <div className="gaveta__acoes">
        {acoesExtras}
        <button className="btn btn--primario" type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

function textoEvento(e: DenunciaEvento) {
  if (e.type === 'report.submitted') return e.notes ?? 'Recebida pelo canal';
  if (e.type === 'status_changed' && e.toStatus) return `Situação alterada para "${whistleblowerStatusLabel(e.toStatus)}"`;
  if (e.type === 'assignee_changed') return e.assignee ? `Responsável: ${e.assignee.name}` : 'Responsável removido';
  if (e.type === 'notes' || e.type === 'comment') return `${whistleblowerEventLabel(e.type)}: ${e.notes ?? ''}`;
  return whistleblowerEventLabel(e.type);
}

/** Histórico (mais recente primeiro), no estilo .historico do protótipo. */
export function HistoricoDenuncia({ eventos, tituloId }: { eventos: DenunciaEvento[]; tituloId: string }) {
  const lista = [...eventos].reverse();
  return (
    <section className="historico" aria-labelledby={tituloId}>
      <h3 className="historico__titulo" id={tituloId}>
        Histórico
      </h3>
      {lista.length === 0 ? (
        <p className="campo__dica">Sem eventos ainda.</p>
      ) : (
        <ul>
          {lista.map((e) => {
            const extra = e.type !== 'notes' && e.type !== 'comment' && e.type !== 'report.submitted' ? e.notes : null;
            return (
              <li key={e.id}>
                <span className="den-hist__texto">{textoEvento(e)}</span>
                {extra && <span className="den-hist__nota">{extra}</span>}
                <span className="historico__quando">
                  <time dateTime={e.createdAt} title={dataHora(e.createdAt)}>
                    {quando(e.createdAt)} · {dataHora(e.createdAt)}
                  </time>
                  {e.createdBy ? ` · por ${e.createdBy.name}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
