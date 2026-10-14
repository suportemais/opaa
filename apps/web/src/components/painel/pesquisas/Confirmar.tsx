import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone, type NomeIcone } from '../Icone';

export type ConfirmarOpcoes = {
  titulo: string;
  texto: ReactNode;
  botao: string;
  perigo?: boolean;
  icone?: NomeIcone;
  /** caixa que precisa ser marcada antes de liberar o botão */
  exigir?: string;
  botaoVoltar?: string;
};

type Props = {
  opcoes: ConfirmarOpcoes | null;
  ocupado?: boolean;
  erro?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
};

/** Janela de confirmação do protótipo (<dialog class="confirmar">). */
export function Confirmar({ opcoes, ocupado = false, erro, onConfirmar, onCancelar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const [marcado, setMarcado] = useState(false);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (opcoes && !dlg.open) {
      setMarcado(false);
      dlg.showModal();
      cancelarRef.current?.focus();
    } else if (!opcoes && dlg.open) {
      dlg.close();
    }
  }, [opcoes]);

  const liberado = !opcoes?.exigir || marcado;

  return (
    <dialog
      ref={ref}
      className="confirmar"
      aria-labelledby="pq-c-titulo"
      aria-describedby="pq-c-texto"
      onCancel={(e) => {
        e.preventDefault();
        if (!ocupado) onCancelar();
      }}
    >
      {opcoes && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            if (liberado && !ocupado) onConfirmar();
          }}
        >
          <span className={`confirmar__icone${opcoes.perigo ? ' confirmar__icone--perigo' : ''}`} aria-hidden="true">
            <Icone nome={opcoes.icone ?? 'alerta'} />
          </span>
          <h2 id="pq-c-titulo">{opcoes.titulo}</h2>
          <div id="pq-c-texto" className="pq-confirmar__texto">
            {opcoes.texto}
          </div>
          {opcoes.exigir && (
            <label className="confirmar__exigir">
              <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
              <span>{opcoes.exigir}</span>
            </label>
          )}
          {erro && (
            <p className="campo__erro" role="alert">
              {erro}
            </p>
          )}
          <div className="confirmar__acoes">
            <button
              ref={cancelarRef}
              type="button"
              className="btn btn--secundario"
              disabled={ocupado}
              onClick={onCancelar}
            >
              {opcoes.botaoVoltar ?? 'Cancelar'}
            </button>
            <button
              type="submit"
              className={`btn ${opcoes.perigo ? 'btn--perigo-solido' : 'btn--primario'}`}
              disabled={!liberado || ocupado}
            >
              {ocupado ? 'Aguarde…' : opcoes.botao}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
