import { useCallback, useEffect, useRef, useState } from 'react';

/** Aviso flutuante (classe .toast do protótipo). */
export function useAviso() {
  const [texto, setTexto] = useState('');
  const [visivel, setVisivel] = useState(false);
  const tempo = useRef<number | undefined>(undefined);
  const avisar = useCallback((t: string) => {
    setTexto(t);
    setVisivel(true);
    window.clearTimeout(tempo.current);
    tempo.current = window.setTimeout(() => setVisivel(false), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(tempo.current), []);
  const elemento = (
    <p className="toast" role="status" aria-live="polite" data-oculto={visivel ? undefined : ''}>
      {texto}
    </p>
  );
  return { avisar, elemento };
}
