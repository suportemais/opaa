import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Gaveta lateral do painel (<dialog> nativo, classes do protótipo).
 * O conteúdo só é montado enquanto está aberta, então o estado interno começa limpo a cada abertura.
 * Ao fechar, o foco volta para quem abriu.
 */
export function Gaveta(props: {
  aberta: boolean;
  onFechar: () => void;
  rotuloId: string;
  larga?: boolean;
  /** id do elemento que recebe o foco ao abrir (ex.: o título, com tabIndex -1). */
  focoInicial?: string;
  children: ReactNode;
}) {
  const { aberta, onFechar, focoInicial } = props;
  const ref = useRef<HTMLDialogElement | null>(null);
  const focoAntes = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) {
      focoAntes.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      if (focoInicial) document.getElementById(focoInicial)?.focus();
    } else if (!aberta && d.open) {
      d.close();
      focoAntes.current?.focus();
    }
  }, [aberta, focoInicial]);

  return (
    <dialog
      ref={ref}
      className={props.larga ? 'gaveta gaveta--larga' : 'gaveta'}
      aria-labelledby={props.rotuloId}
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onFechar();
      }}
    >
      {aberta ? props.children : null}
    </dialog>
  );
}
