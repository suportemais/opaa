import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Icone } from '../Icone';

/** Selo de situação (Ativo, Desativado, Convite enviado...). */
export function Situacao({ tipo, children }: { tipo: 'publicada' | 'rascunho' | 'arquivada' | 'agendada'; children: ReactNode }) {
  return <span className={`status status--${tipo}`}>{children}</span>;
}

/** Gaveta lateral (<dialog> nativo, igual ao protótipo). Com `onSalvar`, o corpo vira um formulário. */
export function Gaveta(props: {
  aberta: boolean;
  titulo: string;
  onFechar: () => void;
  onSalvar?: () => void;
  botao?: string;
  ocupado?: boolean;
  larga?: boolean;
  children: ReactNode;
}) {
  const { aberta, titulo, onFechar, onSalvar, botao = 'Salvar', ocupado, larga, children } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const focoAntes = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) {
      focoAntes.current = document.activeElement;
      d.showModal();
      const primeiro = d.querySelector<HTMLElement>(
        '.gaveta__form input:not([type=hidden]):not([disabled]):not([readonly]), .gaveta__form select, .gaveta__form textarea',
      );
      (primeiro ?? d.querySelector<HTMLElement>('h2'))?.focus();
    } else if (!aberta && d.open) {
      d.close();
      (focoAntes.current as HTMLElement | null)?.focus?.();
    }
  }, [aberta]);

  const conteudo = (
    <>
      <div className="gaveta__topo">
        <h2 className="cfg-gaveta__titulo" tabIndex={-1}>
          {titulo}
        </h2>
        <button className="botao-icone" type="button" aria-label="Fechar" onClick={onFechar}>
          <Icone nome="fechar" />
        </button>
      </div>
      <div className="gaveta__form">{children}</div>
      <div className="gaveta__acoes">
        <button className="btn btn--secundario" type="button" onClick={onFechar}>
          {onSalvar ? 'Cancelar' : 'Fechar'}
        </button>
        {onSalvar && (
          <button className="btn btn--primario" type="submit" disabled={ocupado} aria-busy={ocupado || undefined}>
            {ocupado ? 'Salvando…' : botao}
          </button>
        )}
      </div>
    </>
  );

  return (
    <dialog
      ref={ref}
      className={larga ? 'gaveta gaveta--larga' : 'gaveta'}
      aria-label={titulo}
      onCancel={(e) => {
        e.preventDefault();
        onFechar();
      }}
      onClick={(e) => {
        // Clique no fundo escurecido (fora da gaveta) fecha
        const d = ref.current;
        if (!d || e.target !== d) return;
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onFechar();
      }}
    >
      {onSalvar ? (
        <form
          className="gaveta__corpo"
          noValidate
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!ocupado) onSalvar();
          }}
        >
          {conteudo}
        </form>
      ) : (
        <div className="gaveta__corpo">{conteudo}</div>
      )}
    </dialog>
  );
}

