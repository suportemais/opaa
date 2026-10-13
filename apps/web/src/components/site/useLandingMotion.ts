import { useEffect, type RefObject } from 'react';
import { animate, inView, scroll } from 'motion';

/**
 * Animações de rolagem da LP (porte do main.js do protótipo).
 * Melhoria progressiva: sem JS ou com movimento reduzido, todo o conteúdo aparece normalmente.
 * Com a Motion: revelação com mola, barra de progresso, Scroll Zoom Hero, título palavra por palavra e parallax.
 */
export function useLandingMotion(raizRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const limpezas: Array<() => void> = [];
    const mola = { type: 'spring', stiffness: 110, damping: 20 } as const;
    raiz.classList.add('com-motion');
    limpezas.push(() => raiz.classList.remove('com-motion'));

    // Só anima de entrada o que está abaixo da tela no carregamento, com a aba visível e sem âncora.
    // Assim nenhum conteúdo fica preso invisível se o observador não disparar.
    const pendentes =
      document.hidden || window.location.hash
        ? []
        : [...raiz.querySelectorAll<HTMLElement>('.revelar')].filter(
            (el) => el.getBoundingClientRect().top >= window.innerHeight,
          );

    // 1. Revelação ao rolar: mola, em cascata pelo --d de cada elemento.
    for (const el of pendentes) {
      el.classList.add('revelar--pendente');
      const delay = parseFloat(el.style.getPropertyValue('--d')) || 0;
      limpezas.push(
        inView(
          el,
          () => {
            if (!el.classList.contains('revelar--pendente')) return;
            el.classList.remove('revelar--pendente');
            animate(el, { opacity: [0, 1], transform: ['translateY(28px)', 'translateY(0px)'] }, { ...mola, delay });
          },
          { amount: 0.15 },
        ),
      );
    }
    const mostrarTudo = () => {
      raiz.querySelectorAll('.revelar--pendente').forEach((el) => el.classList.remove('revelar--pendente'));
    };
    const aoOcultarAba = () => {
      if (document.hidden) mostrarTudo();
    };
    document.addEventListener('visibilitychange', aoOcultarAba);
    limpezas.push(() => {
      document.removeEventListener('visibilitychange', aoOcultarAba);
      mostrarTudo();
    });

    // 2. Barra de progresso da leitura, suavizada com mola.
    const barra = raiz.querySelector<HTMLElement>('[data-progresso]');
    if (barra) {
      let animacaoBarra: ReturnType<typeof animate> | null = null;
      limpezas.push(
        scroll((progresso: number) => {
          animacaoBarra?.stop();
          animacaoBarra = animate(
            barra,
            { transform: `scaleX(${progresso})` },
            { type: 'spring', stiffness: 120, damping: 30, restDelta: 0.001 },
          );
        }),
      );
    }

    // Scroll Zoom Hero: com o hero preso na tela, o fundo cresce, desfoca e esmaece;
    // o texto e a faixa de fatos recuam e somem (CSS: .com-motion .topo).
    const topo = raiz.querySelector<HTMLElement>('[data-topo]');
    const fundo = raiz.querySelector<HTMLElement>('[data-topo-fundo]');
    const heroCopy = raiz.querySelector<HTMLElement>('[data-hero-copy]');
    const fatos = raiz.querySelector<HTMLElement>('.fatos');
    if (topo && fundo && heroCopy && fatos) {
      const faixaDoTopo: Parameters<typeof scroll>[1] = { target: topo, offset: ['start start', 'end start'] };
      limpezas.push(
        scroll(
          animate(
            fundo,
            { transform: ['scale(1)', 'scale(1.8)'], filter: ['blur(0px)', 'blur(28px)'], opacity: [1, 0] },
            { ease: 'linear' },
          ),
          faixaDoTopo,
        ),
      );
      limpezas.push(
        scroll(
          animate(
            heroCopy,
            {
              opacity: [1, 1, 0],
              transform: ['translateY(0px) scale(1)', 'translateY(-40px) scale(.96)', 'translateY(-90px) scale(.92)'],
            },
            { ease: 'linear', times: [0, 0.35, 1] },
          ),
          faixaDoTopo,
        ),
      );
      limpezas.push(
        scroll(
          animate(fatos, { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(24px)'] }, { ease: 'linear' }),
          { target: topo, offset: ['start start', '0.35 start'] },
        ),
      );
    }

    // 3. Palavras acendendo conforme o título atravessa a tela (as palavras já vêm em <span class="palavra">).
    raiz.querySelectorAll<HTMLElement>('[data-palavras]').forEach((titulo) => {
      const palavras = [...titulo.querySelectorAll<HTMLElement>('.palavra')];
      titulo.classList.add('palavras-prontas');
      limpezas.push(
        scroll(
          (progresso: number) => {
            palavras.forEach((palavra, i) => {
              const acesa = Math.min(Math.max(progresso * palavras.length - i, 0), 1);
              palavra.style.opacity = (0.15 + 0.85 * acesa).toFixed(3);
            });
          },
          { target: titulo, offset: ['start 0.9', 'start 0.35'] },
        ),
      );
      limpezas.push(() => {
        titulo.classList.remove('palavras-prontas');
        palavras.forEach((palavra) => palavra.style.removeProperty('opacity'));
      });
    });

    // 4. Parallax nas fotos: a imagem anda mais devagar que a moldura (que corta o excesso).
    raiz.querySelectorAll<HTMLElement>('.demo__foto img, .publico__foto img').forEach((img) => {
      if (!img.parentElement) return;
      limpezas.push(
        scroll(
          animate(img, { transform: ['translateY(-5%) scale(1.12)', 'translateY(5%) scale(1.12)'] }, { ease: 'linear' }),
          { target: img.parentElement, offset: ['start end', 'end start'] },
        ),
      );
    });

    return () => limpezas.reverse().forEach((limpar) => limpar());
  }, [raizRef]);
}
