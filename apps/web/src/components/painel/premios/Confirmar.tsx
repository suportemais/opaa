import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone } from '../Icone';
import type { NomeIcone } from '../Icone';

type Opcoes = {
  titulo: string;
  texto: ReactNode;
  botao: string;
  perigo?: boolean;
  icone?: NomeIcone;
  botaoVoltar?: string;
};

/**
 * Janela de confirmação do painel (<dialog class="confirmar">). O foco começa no "Cancelar" (padrão seguro).
 * Devolve o elemento a renderizar e confirmar(opções) → Promise<boolean>.
 */
export function useConfirmar() {
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const resolver = useRef<((sim: boolean) => void) | null>(null);
  const ref = useRef<HTMLDialogElement | null>(null);
  const cancelarRef = useRef<HTMLButtonElement | null>(null);
  const focoAntes = useRef<HTMLElement | null>(null);

  const responder = useCallback((sim: boolean) => {
    resolver.current?.(sim);
    resolver.current = null;
    setOpcoes(null);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (opcoes && !d.open) {
      focoAntes.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      cancelarRef.current?.focus();
    } else if (!opcoes && d.open) {
      d.close();
      focoAntes.current?.focus();
    }
  }, [opcoes]);

  const confirmar = useCallback((o: Opcoes) => {
    resolver.current?.(false);
    setOpcoes(o);
    return new Promise<boolean>((r) => {
      resolver.current = r;
    });
  }, []);

  const elemento = (
    <dialog
      ref={ref}
      className="confirmar"
      aria-labelledby="pr-c-titulo"
      aria-describedby="pr-c-texto"
      onCancel={(e) => {
        e.preventDefault();
        responder(false);
      }}
    >
      {opcoes && (
        <div>
          <span className={`confirmar__icone${opcoes.perigo ? ' confirmar__icone--perigo' : ''}`} aria-hidden="true">
            <Icone nome={opcoes.icone ?? 'alerta'} />
          </span>
          <h2 id="pr-c-titulo">{opcoes.titulo}</h2>
          <p id="pr-c-texto">{opcoes.texto}</p>
          <div className="confirmar__acoes">
            <button ref={cancelarRef} className="btn btn--secundario" type="button" onClick={() => responder(false)}>
              {opcoes.botaoVoltar ?? 'Cancelar'}
            </button>
            <button
              className={`btn ${opcoes.perigo ? 'btn--perigo-solido' : 'btn--primario'}`}
              type="button"
              onClick={() => responder(true)}
            >
              {opcoes.botao}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );

  return [elemento, confirmar] as const;
}
