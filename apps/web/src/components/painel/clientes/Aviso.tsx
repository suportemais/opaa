import { useCallback, useEffect, useRef, useState } from 'react';

/** Aviso rápido (toast) do painel. Devolve o elemento a renderizar e a função avisar(texto). */
export function useAviso() {
  const [texto, setTexto] = useState('');
  const [visivel, setVisivel] = useState(false);
  const tempo = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(tempo.current), []);

  const avisar = useCallback((t: string) => {
    setTexto(t);
    setVisivel(true);
    window.clearTimeout(tempo.current);
    tempo.current = window.setTimeout(() => setVisivel(false), 3200);
  }, []);

  const elemento = (
    <p className="toast" role="status" aria-live="polite" data-oculto={visivel ? undefined : ''}>
      {texto}
    </p>
  );
  return [elemento, avisar] as const;
}
