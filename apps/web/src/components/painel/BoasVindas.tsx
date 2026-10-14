import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icone, type NomeIcone } from './Icone';
import { EVENTO_TOUR } from './usePainel';

/**
 * Pop-up "Estamos de cara nova" (contas que já existiam antes do novo visual) e o
 * tour guiado pelo menu (contas novas, ou quem pedir). O "já vi" fica no navegador,
 * por usuário: não grava nada no banco.
 */

// Contas criadas depois disto são "novas" e ganham o tour em vez do aviso de novidades
const LANCAMENTO_NOVO_VISUAL = new Date('2026-10-14T18:30:00Z').getTime();
const CHAVE_NOVIDADES = 'opiina-cara-nova-v1';
const CHAVE_TOUR = 'opiina-tour-v1';

const jaViu = (chave: string, userId: string) => {
  try {
    return localStorage.getItem(`${chave}:${userId}`) === '1';
  } catch {
    return true; // sem armazenamento, não insiste a cada tela
  }
};
const marcarVisto = (chave: string, userId: string) => {
  try {
    localStorage.setItem(`${chave}:${userId}`, '1');
  } catch {
    /* ignora */
  }
};

type Passo = { alvo?: string; icone?: NomeIcone; titulo: string; texto: string };

const PASSOS: Passo[] = [
  {
    icone: 'estrela',
    titulo: 'Boas-vindas ao Opiina',
    texto: 'Em menos de um minuto mostramos onde fica cada coisa. Você pode sair quando quiser.',
  },
  {
    alvo: 'dashboard',
    titulo: 'Dashboard',
    texto: 'O resumo da operação: NPS, quantidade de respostas e a evolução de cada unidade no período escolhido.',
  },
  {
    alvo: 'ranking',
    titulo: 'Ranking',
    texto: 'Compare unidades e colaboradores pelas notas que os clientes deram.',
  },
  {
    alvo: 'feedbacks',
    titulo: 'Feedbacks',
    texto:
      'Todas as respostas chegam aqui. As notas baixas viram ocorrências para tratar, em lista ou no Kanban. O número vermelho mostra as vencidas.',
  },
  {
    alvo: 'denuncias',
    titulo: 'Denúncias',
    texto: 'O canal de denúncias, anônimo ou identificado, com protocolo e acompanhamento de cada caso.',
  },
  {
    alvo: 'pesquisas',
    titulo: 'Pesquisas',
    texto: 'Crie a pesquisa e gere um link e um QR Code para cada unidade. É por aqui que as respostas começam.',
  },
  {
    alvo: 'clientes',
    titulo: 'Clientes',
    texto: 'A base de quem respondeu, com o histórico de notas e quem aceitou receber ofertas.',
  },
  {
    alvo: 'premios',
    titulo: 'Prêmios',
    texto: 'Campanhas de cupom para incentivar o cliente a responder e voltar.',
  },
  {
    alvo: 'config',
    titulo: 'Configurações',
    texto: 'Dados da empresa, unidades, colaboradores e usuários. Para começar, cadastre suas unidades aqui.',
  },
  {
    alvo: 'tema',
    titulo: 'Modo escuro',
    texto: 'Troque o visual quando quiser. A escolha fica salva neste navegador.',
  },
  {
    alvo: 'conta',
    titulo: 'Sua conta',
    texto: 'Seus dados e a troca de senha. Este tour pode ser revisto a qualquer momento por aqui.',
  },
];

const alvoEl = (alvo?: string) =>
  alvo ? document.querySelector<HTMLElement>(`.painel [data-tour="${alvo}"]`) : null;

/** Decide o que mostrar ao entrar: aviso de novidades, tour ou nada. */
export function BoasVindas(props: {
  userId?: string;
  contaCriadaEm?: string | null;
  pronto: boolean;
  abrirMenu: (aberto: boolean) => void;
}) {
  const { userId, contaCriadaEm, pronto, abrirMenu } = props;
  const [mostrar, setMostrar] = useState<'novidades' | 'tour' | null>(null);
  const decidiu = useRef(false);

  useEffect(() => {
    if (!pronto || !userId || decidiu.current) return;
    decidiu.current = true;
    const criada = contaCriadaEm ? new Date(contaCriadaEm).getTime() : NaN;
    const contaNova = Number.isFinite(criada) && criada >= LANCAMENTO_NOVO_VISUAL;
    if (contaNova) {
      if (!jaViu(CHAVE_TOUR, userId)) setMostrar('tour');
    } else if (!jaViu(CHAVE_NOVIDADES, userId)) {
      setMostrar('novidades');
    }
  }, [pronto, userId, contaCriadaEm]);

  useEffect(() => {
    const onTour = () => setMostrar('tour');
    window.addEventListener(EVENTO_TOUR, onTour);
    return () => window.removeEventListener(EVENTO_TOUR, onTour);
  }, []);

  if (!userId || !mostrar) return null;

  if (mostrar === 'novidades') {
    return (
      <Novidades
        onFechar={(tour) => {
          marcarVisto(CHAVE_NOVIDADES, userId);
          marcarVisto(CHAVE_TOUR, userId);
          setMostrar(tour ? 'tour' : null);
        }}
      />
    );
  }
  return (
    <Tour
      abrirMenu={abrirMenu}
      onFechar={() => {
        marcarVisto(CHAVE_TOUR, userId);
        marcarVisto(CHAVE_NOVIDADES, userId);
        setMostrar(null);
      }}
    />
  );
}

function Novidades({ onFechar }: { onFechar: (tour: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirmar novidades"
      aria-labelledby="novidades-titulo"
      onCancel={(e) => {
        e.preventDefault();
        onFechar(false);
      }}
    >
      <div className="confirmar__icone" aria-hidden="true">
        <Icone nome="estrela" />
      </div>
      <h2 id="novidades-titulo">Estamos de cara nova!</h2>
      <p>O painel do Opiina ganhou um novo visual. Seus dados continuam todos aqui, do mesmo jeito.</p>
      <ul className="novidades__lista">
        <li>Menu reorganizado por assunto, mais fácil de achar as coisas</li>
        <li>Ocorrências em lista ou Kanban, tratadas numa gaveta ao lado</li>
        <li>Link e QR Code de cada unidade direto na pesquisa</li>
        <li>Convite de usuários por e-mail e a página Minha conta</li>
        <li>Modo escuro, no rodapé do menu</li>
      </ul>
      <div className="confirmar__acoes">
        <button className="btn btn--secundario" type="button" onClick={() => onFechar(true)}>
          Fazer um tour rápido
        </button>
        <button className="btn btn--primario" type="button" autoFocus onClick={() => onFechar(false)}>
          Começar
        </button>
      </div>
    </dialog>
  );
}

type Caixa = { top: number; left: number; width: number; height: number };

function Tour({ onFechar, abrirMenu }: { onFechar: () => void; abrirMenu: (aberto: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);
  // Só os passos cujo item existe para este perfil (ex.: Denúncias é só do administrador)
  const [passos] = useState(() => PASSOS.filter((p) => !p.alvo || alvoEl(p.alvo)));
  const [i, setI] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [cartaoPos, setCartaoPos] = useState<{ top: number; left: number } | null>(null);
  const passo = passos[i];
  const ultimo = i === passos.length - 1;

  const fechar = useCallback(() => {
    abrirMenu(false);
    onFechar();
  }, [abrirMenu, onFechar]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  // No celular o menu é uma gaveta: abre enquanto o tour mostra os itens dele
  useEffect(() => {
    if (passo?.alvo && window.matchMedia('(max-width: 1023px)').matches) abrirMenu(true);
  }, [passo, abrirMenu]);

  useEffect(() => {
    alvoEl(passo?.alvo)?.scrollIntoView({ block: 'nearest' });
    cartaoRef.current?.focus();
  }, [passo]);

  // Acompanha a posição do item (a gaveta do celular entra animada; a tela pode mudar de tamanho)
  useEffect(() => {
    let quadro = 0;
    let anterior = '';
    const medir = () => {
      const el = alvoEl(passo?.alvo);
      const r = el?.getBoundingClientRect();
      const nova = r && r.width > 0 && r.right > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      const chave = JSON.stringify(nova);
      if (chave !== anterior) {
        anterior = chave;
        setCaixa(nova);
      }
      quadro = requestAnimationFrame(medir);
    };
    medir();
    return () => cancelAnimationFrame(quadro);
  }, [passo]);

  // Posiciona o cartão ao lado do item (desktop) ou acima/abaixo dele (celular)
  useLayoutEffect(() => {
    const c = cartaoRef.current;
    if (!c || !caixa) return setCartaoPos(null);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = c.offsetWidth;
    const ch = c.offsetHeight;
    const m = 16;
    const limita = (v: number, max: number) => Math.max(m, Math.min(v, max - m));
    if (vw >= 1024 && caixa.left + caixa.width + m + cw <= vw - m) {
      setCartaoPos({ left: caixa.left + caixa.width + m, top: limita(caixa.top + caixa.height / 2 - ch / 2, vh - ch) });
      return;
    }
    const cabeAbaixo = caixa.top + caixa.height + m + ch <= vh - m;
    setCartaoPos({
      left: limita(caixa.left, vw - cw),
      top: cabeAbaixo ? caixa.top + caixa.height + 12 : limita(caixa.top - ch - 12, vh - ch),
    });
  }, [caixa, i]);

  if (!passo) return null;

  return (
    <dialog
      ref={ref}
      className="tour"
      aria-labelledby="tour-titulo"
      aria-describedby="tour-texto"
      onCancel={(e) => {
        e.preventDefault();
        fechar();
      }}
    >
      {caixa ? (
        <div
          className="tour__foco"
          aria-hidden="true"
          style={{ top: caixa.top - 4, left: caixa.left - 4, width: caixa.width + 8, height: caixa.height + 8 }}
        />
      ) : (
        <div className="tour__fundo" aria-hidden="true" />
      )}
      <div
        ref={cartaoRef}
        className={caixa ? 'tour__cartao' : 'tour__cartao tour__cartao--centro'}
        style={caixa && cartaoPos ? { top: cartaoPos.top, left: cartaoPos.left } : undefined}
        tabIndex={-1}
      >
        {passo.icone && (
          <div className="confirmar__icone" aria-hidden="true">
            <Icone nome={passo.icone} />
          </div>
        )}
        <p className="tour__passo">
          {i + 1} de {passos.length}
        </p>
        <h2 id="tour-titulo">{passo.titulo}</h2>
        <p id="tour-texto">{passo.texto}</p>
        <div className="tour__acoes">
          <button className="btn btn--fantasma" type="button" onClick={fechar}>
            {i === 0 ? 'Agora não' : 'Pular'}
          </button>
          <span className="tour__nav">
            {i > 0 && (
              <button className="btn btn--secundario" type="button" onClick={() => setI(i - 1)}>
                Voltar
              </button>
            )}
            <button className="btn btn--primario" type="button" onClick={() => (ultimo ? fechar() : setI(i + 1))}>
              {i === 0 ? 'Começar o tour' : ultimo ? 'Concluir' : 'Próximo'}
            </button>
          </span>
        </div>
      </div>
    </dialog>
  );
}
