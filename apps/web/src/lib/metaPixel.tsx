import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// O index.html já dispara o PageView da carga inicial; aqui cobrimos as
// navegações internas da SPA, que não recarregam a página.
export function MetaPixelPageView() {
  const location = useLocation();
  const lastPath = useRef(location.pathname);

  useEffect(() => {
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;
    window.fbq?.('track', 'PageView');
  }, [location.pathname]);

  return null;
}
