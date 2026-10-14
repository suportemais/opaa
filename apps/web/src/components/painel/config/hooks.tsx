import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone, type NomeIcone } from '../Icone';

type OpcoesConfirmar = { titulo: string; texto: ReactNode; botao?: string; perigo?: boolean; icone?: NomeIcone };

/** Janela de confirmação do protótipo. Uso: `const [confirmar, janela] = useConfirmar()`. */
export function useConfirmar() {
  const [opcoes, setOpcoes] = useState<OpcoesConfirmar | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const focoAntes = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (opcoes && !d.open) {
      focoAntes.current = document.activeElement;
      d.showModal();
    }
  }, [opcoes]);

  const responder = useCallback((ok: boolean) => {
    ref.current?.close();
    setOpcoes(null);
    resolver.current?.(ok);
    resolver.current = null;
    (focoAntes.current as HTMLElement | null)?.focus?.();
  }, []);

  const confirmar = useCallback(
    (o: OpcoesConfirmar) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpcoes(o);
      }),
    [],
  );

  const janela = (
    <dialog
      ref={ref}
      className="confirmar"
      aria-labelledby="cfg-confirmar-titulo"
      aria-describedby="cfg-confirmar-texto"
      onCancel={(e) => {
        e.preventDefault();
        responder(false);
      }}
    >
      {opcoes && (
        <div>
          <span className={opcoes.perigo ? 'confirmar__icone confirmar__icone--perigo' : 'confirmar__icone'} aria-hidden="true">
            <Icone nome={opcoes.icone ?? 'alerta'} />
          </span>
          <h2 id="cfg-confirmar-titulo">{opcoes.titulo}</h2>
          <p id="cfg-confirmar-texto">{opcoes.texto}</p>
          <div className="confirmar__acoes">
            <button className="btn btn--secundario" type="button" onClick={() => responder(false)} autoFocus>
              Cancelar
            </button>
            <button
              className={opcoes.perigo ? 'btn btn--perigo-solido' : 'btn btn--primario'}
              type="button"
              onClick={() => responder(true)}
            >
              {opcoes.botao ?? 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );

  return [confirmar, janela] as const;
}

/** Aviso rápido (toast) do protótipo. Uso: `const [avisar, aviso] = useAvisar()`. */
export function useAvisar() {
  const [texto, setTexto] = useState('');
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const avisar = useCallback((t: string) => {
    setTexto(t);
    setVisivel(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisivel(false), 4000);
  }, []);

  const aviso = (
    <p className="toast" role="status" aria-live="polite" data-oculto={visivel ? undefined : ''}>
      {texto}
    </p>
  );
  return [avisar, aviso] as const;
}
