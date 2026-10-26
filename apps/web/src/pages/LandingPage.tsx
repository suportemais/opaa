import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { env } from '../lib/env';
import { formatPlanPrice, subscribeHref, type PublicPlan } from '../lib/public-plans';
import { Brilho, SpriteBrilho } from '../components/site/SiteBits';
import { LOGO_SRC, atraso, planoEmDestaque, usePublicPlans } from '../components/site/site-utils';
import { useLandingMotion } from '../components/site/useLandingMotion';

function isTenantSubdomain() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  const baseDomain = env.appBaseDomain;
  return Boolean(baseDomain) && hostname !== baseDomain && hostname.endsWith(`.${baseDomain}`);
}

export function LandingPage() {
  if (isTenantSubdomain()) {
    return <Navigate to="/login" replace />;
  }
  return <Landing />;
}

function Landing() {
  const raizRef = useRef<HTMLDivElement>(null);
  useLandingMotion(raizRef);

  return (
    <div className="site" ref={raizRef}>
      <SpriteBrilho />
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div className="progresso" aria-hidden="true" data-progresso />

      <Cabecalho />

      <main id="conteudo">
        <Topo />
        <Demo />
        <Beneficios />
        <ComoFunciona />
        <CanalDenuncias />
        <ParaQuem />
        <Planos />
        <Duvidas />
        <ChamadaFinal />
      </main>

      <footer className="rodape">
        <a className="marca marca--pequena" href="#inicio" aria-label="Opiina — voltar ao início">
          <img className="marca__icone" src={LOGO_SRC} alt="" width={256} height={256} />
          <span>© {new Date().getFullYear()} Opiina</span>
        </a>
        <nav className="rodape__nav" aria-label="Rodapé">
          <a href="#beneficios">Benefícios</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#denuncias">Denúncias</a>
          <a href="#planos">Planos</a>
          <a href="#duvidas">Dúvidas</a>
          <Link to="/login">Entrar</Link>
        </nav>
      </footer>

      <VoltarAoTopo />
    </div>
  );
}

/** Menu em tela cheia no celular: foco preso, Esc fecha, clique no fundo fecha. */
function Cabecalho() {
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const devolverFocoRef = useRef(true);
  const jaAbriuRef = useRef(false);

  useEffect(() => {
    const raiz = navRef.current?.closest('.site');
    raiz?.classList.toggle('menu-aberto', aberto);
    if (!aberto) {
      if (jaAbriuRef.current && devolverFocoRef.current) botaoRef.current?.focus({ preventScroll: true });
      devolverFocoRef.current = true;
      return;
    }
    jaAbriuRef.current = true;
    navRef.current?.querySelector('a')?.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAberto(false);
        return;
      }
      if (evento.key !== 'Tab' || !botaoRef.current || !navRef.current) return;
      const itens = [botaoRef.current, ...navRef.current.querySelectorAll('a')];
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };
    const telaPequena = window.matchMedia('(max-width: 900px)');
    const aoMudarTela = (mq: MediaQueryListEvent) => {
      if (!mq.matches) fecharSemFoco();
    };
    document.addEventListener('keydown', aoTeclar);
    telaPequena.addEventListener('change', aoMudarTela);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      telaPequena.removeEventListener('change', aoMudarTela);
      raiz?.classList.remove('menu-aberto');
    };
  }, [aberto]);

  function fecharSemFoco() {
    devolverFocoRef.current = false;
    setAberto(false);
  }

  return (
    <header className="cabecalho">
      <a className="marca" href="#inicio" aria-label="Opiina — início">
        <img className="marca__icone" src={LOGO_SRC} alt="" width={256} height={256} />
        <span className="marca__nome">Opiina</span>
      </a>

      <nav
        className="nav"
        id="nav"
        aria-label="Seções"
        ref={navRef}
        onClick={(evento) => {
          if (aberto && (evento.target as HTMLElement).closest('a')) fecharSemFoco();
        }}
      >
        <a href="#beneficios">Benefícios</a>
        <a href="#como-funciona">Como funciona</a>
        <a href="#denuncias">Denúncias</a>
        <a href="#planos">Planos</a>
        <a href="#duvidas">Dúvidas</a>
        <Link className="nav__entrar" to="/login">
          Já tenho conta
        </Link>
      </nav>

      <div className="cabecalho__acoes">
        <Link className="btn btn--contorno cabecalho__entrar" to="/login">
          Já tenho conta
        </Link>
      </div>
      <button
        ref={botaoRef}
        className="menu-botao"
        type="button"
        aria-controls="nav"
        aria-expanded={aberto}
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setAberto((v) => !v)}
      >
        <i />
        <i />
        <i />
      </button>
      <div className="menu-fundo" onClick={() => setAberto(false)} />
    </header>
  );
}

function Topo() {
  return (
    <div className="topo" data-topo>
      <div className="topo__fixo">
        <div className="topo__fundo" aria-hidden="true">
          <div className="topo__brilho" data-topo-fundo />
        </div>
        <section className="hero" id="inicio" aria-labelledby="hero-titulo">
          <div className="hero__copy" data-hero-copy>
            <p className="selo surgir s-pop" style={atraso(0.15)}>
              <Brilho />
              Ouça · Entenda · Fidelize
            </p>
            <h1 id="hero-titulo" tabIndex={-1}>
              <span className="linha surgir s-mascara" style={atraso(0.3)}>
                O que o cliente <em>sente.</em>
              </span>
              <span className="linha surgir s-mascara" style={atraso(0.45)}>
                O que a casa precisa fazer.
              </span>
            </h1>
            <p className="lede surgir s-suave" style={atraso(0.6)}>
              Capture o NPS, abra a ocorrência e acompanhe o atendimento num fluxo simples — numa unidade ou na rede
              toda.
            </p>
            <div className="acoes">
              <a className="btn btn--solido btn--grande surgir s-botao" style={atraso(0.72)} href="#planos">
                Ver planos
              </a>
              <Link className="btn btn--contorno btn--grande surgir s-lado" style={atraso(0.82)} to="/login">
                Já tenho conta
              </Link>
            </div>
            <p className="fino surgir s-suave" style={atraso(0.9)}>
              <a href="#como-funciona">Ver como funciona</a>
            </p>
          </div>
        </section>

        <ul className="fatos" aria-label="Destaques dos planos">
          <li className="fato surgir s-fato" style={atraso(0.95)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12.6V4.5A1.5 1.5 0 0 1 4.5 3h8.1a1.5 1.5 0 0 1 1.06.44l7.4 7.4a1.5 1.5 0 0 1 0 2.12l-8.1 8.1a1.5 1.5 0 0 1-2.12 0l-7.4-7.4A1.5 1.5 0 0 1 3 12.6Z" />
              <circle cx="8" cy="8" r="1.6" />
            </svg>
            Planos a partir de R$ 147/mês
          </li>
          <li className="fato surgir s-fato" style={atraso(1.05)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20V9l5-3v14M9 20V6l6 3v11M15 20V9l5 3v8M2.5 20h19" />
            </svg>
            Uma unidade ou a rede toda
          </li>
          <li className="fato surgir s-fato" style={atraso(1.15)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="2.5" />
              <circle cx="5" cy="18" r="2.5" />
              <circle cx="19" cy="18" r="2.5" />
              <path d="M10.8 7.2 6.2 15.8M13.2 7.2l4.6 8.6M7.5 18h9" />
            </svg>
            Unidades ilimitadas no plano Redes
          </li>
        </ul>
      </div>
    </div>
  );
}

function Demo() {
  return (
    <section className="sec" id="demo" aria-labelledby="demo-titulo">
      <div className="sec__in demo">
        <div className="demo__texto">
          <span className="tag revelar">Na prática</span>
          <h2 className="revelar" id="demo-titulo">
            Uma pergunta, <em>uma nota</em>, um comentário
          </h2>
          <p className="sub revelar">
            Envie a pesquisa NPS pelo canal que o cliente já usa. Rápido de montar, fácil de responder — e a resposta
            volta pro painel.
          </p>
        </div>
        <div className="demo__visual revelar">
          <figure className="demo__foto">
            <img
              src="/site/img/hero-cliente-1024.jpg"
              srcSet="/site/img/hero-cliente-640.jpg 640w, /site/img/hero-cliente-1024.jpg 1024w, /site/img/hero-cliente-1448.jpg 1448w"
              sizes="(min-width: 1024px) 620px, 100vw"
              width={1448}
              height={1086}
              loading="lazy"
              alt="Cliente sentada à mesa de um café, respondendo a uma pesquisa no celular depois da refeição."
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

/** Título que acende palavra por palavra: cada palavra já vem num <span class="palavra">. */
function Palavras({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\s+)/).map((parte, i) =>
        /^\s+$/.test(parte) || !parte ? (
          parte
        ) : (
          <span key={i} className="palavra">
            {parte}
          </span>
        ),
      )}
    </>
  );
}

const BENEFICIOS = [
  {
    titulo: 'Pesquisa rápida, em mais de um canal',
    texto: 'Rápido de montar, fácil de responder. A resposta volta direto pro painel.',
  },
  {
    titulo: 'NPS e comentário no mesmo recorte',
    texto: 'A nota e o comentário chegam juntos. Você enxerga onde a casa está ganhando ou perdendo.',
  },
  { titulo: 'Ocorrências no Kanban', texto: 'Cada ocorrência vira um card. A equipe trata, você acompanha.' },
  {
    titulo: 'A IA organiza o que veio nas respostas',
    texto:
      'Comentários abertos viram temas — demora, atendimento, comida, elogio. Você vê o que mais aparece e onde agir primeiro.',
    ia: true,
  },
  {
    titulo: 'Unidades lado a lado, com ranking',
    texto: 'Compare nota, volume de respostas e desempenho entre casas — sem montar planilha no fim do mês.',
  },
  {
    titulo: 'Denúncia em canal próprio',
    texto: 'Cada unidade tem um link só pra isso, fora do NPS. Canal alinhado às obrigações trabalhistas.',
  },
];

function Beneficios() {
  return (
    <section className="sec" id="beneficios" aria-labelledby="beneficios-titulo">
      <span id="recursos" className="ancora-antiga" aria-hidden="true" />
      <span id="alem-do-nps" className="ancora-antiga" aria-hidden="true" />
      <div className="sec__in">
        <span className="tag revelar">Benefícios</span>
        <h2 id="beneficios-titulo" data-palavras>
          <Palavras texto="Mais do que ouvir: entender, comparar e" />{' '}
          <em>
            <Palavras texto="cuidar" />
          </em>
        </h2>
        <p className="sub revelar">Nota, comentário e ocorrência no mesmo lugar — sem planilha, sem conversa perdida.</p>
        <div className="grade">
          {BENEFICIOS.map((item, i) => (
            <article
              key={item.titulo}
              className={item.ia ? 'card card--ia revelar' : 'card revelar'}
              style={i % 3 ? atraso((i % 3) * 0.08) : undefined}
            >
              <i aria-hidden="true">{i + 1}</i>
              {item.ia && (
                <span className="selo-ia">
                  <Brilho />
                  IA
                </span>
              )}
              <h3>{item.titulo}</h3>
              <p>{item.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const PASSOS = [
  {
    titulo: 'Pergunte',
    texto: 'Envie a pesquisa NPS pelo canal que o cliente já usa. Rápido de montar, fácil de responder.',
  },
  {
    titulo: 'Veja o que importa',
    texto: 'A nota e o comentário chegam no mesmo lugar. Você enxerga onde a casa está ganhando ou perdendo.',
  },
  {
    titulo: 'Resolva no Kanban',
    texto: 'Cada ocorrência vira um card. A equipe trata, você acompanha — sem planilha, sem conversa perdida.',
  },
];

function ComoFunciona() {
  return (
    <section className="sec sec--suave" id="como-funciona" aria-labelledby="como-titulo">
      <div className="sec__in">
        <span className="tag revelar">Como funciona</span>
        <h2 className="revelar" id="como-titulo">
          Em três passos, <em>sem complicação</em>
        </h2>
        <ol className="passos">
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo} className="passo revelar">
              <b aria-hidden="true">{String(i + 1).padStart(2, '0')}</b>
              <h3>{passo.titulo}</h3>
              <p>{passo.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Exemplos das 16 categorias de WhistleblowerCategory e das etapas de WhistleblowerStatus.
const CATEGORIAS_DENUNCIA = [
  'Assédio moral',
  'Assédio sexual',
  'Discriminação',
  'Racismo',
  'Fraude',
  'Segurança do trabalho',
  'LGPD e privacidade',
  'Conduta inadequada',
];

const ITENS_DENUNCIA = [
  {
    icone: 'd-anonimo',
    titulo: 'Anônimo ou com nome',
    texto: 'Quem relata escolhe se quer se identificar.',
  },
  {
    icone: 'd-qr',
    titulo: 'Link e QR Code por unidade',
    texto: 'Fácil de divulgar no mural, no vestiário ou no grupo da equipe.',
  },
  {
    icone: 'd-protocolo',
    titulo: 'Protocolo para cada relato',
    texto: 'Cada denúncia ganha um número próprio e fica registrada.',
  },
  {
    icone: 'd-etapas',
    titulo: 'Acompanhamento até a conclusão',
    texto:
      'Situação e prioridade em cada caso: recebida, em análise, em investigação, aguardando informações, concluída.',
  },
];

function CanalDenuncias() {
  return (
    <section className="sec" id="denuncias" aria-labelledby="denuncias-titulo">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <symbol id="d-anonimo" viewBox="0 0 24 24">
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" />
          </symbol>
          <symbol id="d-qr" viewBox="0 0 24 24">
            <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
            <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
            <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
            <path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" />
          </symbol>
          <symbol id="d-protocolo" viewBox="0 0 24 24">
            <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
            <path d="M14 3.5v4h4M9 12h6M9 15.5h4" />
          </symbol>
          <symbol id="d-etapas" viewBox="0 0 24 24">
            <path d="M4 6.5l1.8 1.8L9 5M4 12.5l1.8 1.8L9 11M12.5 7h7.5M12.5 13h7.5M12.5 19h7.5M4.5 18.5h4" />
          </symbol>
        </defs>
      </svg>
      <div className="sec__in denuncia">
        <div className="denuncia__texto">
          <span className="tag revelar">Canal de denúncias</span>
          <h2 className="revelar" id="denuncias-titulo">
            Um canal pra equipe <em>relatar o que vê</em>
          </h2>
          <p className="sub revelar">
            Cada unidade tem um link só pra isso, separado da pesquisa de clientes. A equipe relata o que acontece no
            trabalho, e a gestão acompanha cada caso no painel. Canal alinhado às obrigações trabalhistas.
          </p>
          <p className="denuncia__rotulo revelar">16 categorias, entre elas:</p>
          <ul className="denuncia__categorias revelar" aria-label="Exemplos de categorias">
            {CATEGORIAS_DENUNCIA.map((categoria) => (
              <li key={categoria}>{categoria}</li>
            ))}
          </ul>
        </div>
        <ul className="denuncia__lista">
          {ITENS_DENUNCIA.map((item, i) => (
            <li key={item.icone} className="denuncia__item revelar" style={i ? atraso(i * 0.08) : undefined}>
              <svg aria-hidden="true">
                <use href={`#${item.icone}`} />
              </svg>
              <div>
                <h3>{item.titulo}</h3>
                <p>{item.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ParaQuem() {
  return (
    <section className="sec" id="para-quem" aria-labelledby="para-quem-titulo">
      <div className="sec__in">
        <span className="tag revelar">Para quem</span>
        <h2 className="revelar" id="para-quem-titulo">
          Feito pra quem atende e quer <em>ouvir de verdade</em>
        </h2>
        <div className="publicos">
          <article className="publico revelar">
            <div className="publico__foto">
              <img
                src="/site/img/unidade-equipe-1024.jpg"
                srcSet="/site/img/unidade-equipe-640.jpg 640w, /site/img/unidade-equipe-1024.jpg 1024w, /site/img/unidade-equipe-1255.jpg 1255w"
                sizes="(min-width: 900px) 550px, 100vw"
                width={1255}
                height={941}
                loading="lazy"
                alt="Gestora de restaurante mostrando um tablet a um atendente e a uma cozinheira no salão."
              />
            </div>
            <div className="publico__corpo">
              <h3>Unidade</h3>
              <ul className="lista">
                <li>Quem pergunta o NPS e não sabe o que fazer com a resposta</li>
                <li>Quem mistura reclamação no WhatsApp, caderno e planilha</li>
                <li>Quem opera uma casa só e quer o básico bem feito</li>
              </ul>
              <a className="link-seta" href="#planos">
                Ver planos Start e Pro
              </a>
            </div>
          </article>
          <article className="publico revelar" style={atraso(0.1)}>
            <div className="publico__foto">
              <img
                src="/site/img/rede-gestores-1024.jpg"
                srcSet="/site/img/rede-gestores-640.jpg 640w, /site/img/rede-gestores-1024.jpg 1024w, /site/img/rede-gestores-1448.jpg 1448w"
                sizes="(min-width: 900px) 550px, 100vw"
                width={1448}
                height={1086}
                loading="lazy"
                alt="Dois gestores sentados no salão de um restaurante, analisando juntos as informações num notebook."
              />
            </div>
            <div className="publico__corpo">
              <h3>Rede</h3>
              <ul className="lista">
                <li>Redes e franquias que precisam comparar unidade sem esperar o fechamento</li>
                <li>Gestor que quer ver nota e atendimento no mesmo lugar</li>
              </ul>
              <a className="link-seta" href="#plano-redes">
                Ver plano Redes
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function Planos() {
  const { plans } = usePublicPlans();

  return (
    <section className="sec" id="planos" aria-labelledby="planos-titulo">
      <div className="sec__in">
        <span className="tag revelar">Planos</span>
        <h2 className="revelar" id="planos-titulo">
          Planos pra sua <em>operação</em>
        </h2>
        <p className="sub revelar">Preços claros pra rede e restaurante. Sem surpresa na fatura.</p>
        {plans && plans.length > 0 && (
          <div className="planos">
            {plans.map((plan, i) => (
              <CartaoPlano key={plan.slug} plan={plan} indice={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CartaoPlano({ plan, indice }: { plan: PublicPlan; indice: number }) {
  const destaque = planoEmDestaque(plan);
  const tagClasse = destaque ? 'ptag ptag--pop' : plan.slug === 'redes' ? 'ptag ptag--rede' : 'ptag';
  const nomeId = `plano-${plan.slug}-nome`;

  return (
    <article
      className={destaque ? 'plano plano--destaque' : 'plano'}
      style={indice ? atraso(indice * 0.1) : undefined}
      id={`plano-${plan.slug}`}
      aria-labelledby={nomeId}
    >
      {plan.badge && <span className={tagClasse}>{plan.badge}</span>}
      <h3 id={nomeId}>{plan.name}</h3>
      <p className="plano__desc">{plan.summary}</p>
      <p className="plano__preco">
        {formatPlanPrice(plan.priceCents, plan.currency)}
        <small>/mês</small>
      </p>
      {plan.trialDays > 0 && <p className="plano__teste">Teste grátis por {plan.trialDays} dias</p>}
      <ul>
        {plan.features.map((feature, i) => (
          <li key={`${plan.slug}-${i}`}>{feature}</li>
        ))}
      </ul>
      <Link className="btn btn--plano" to={subscribeHref(plan.slug)}>
        {plan.ctaLabel}
      </Link>
    </article>
  );
}

const DUVIDAS = [
  {
    q: 'O que o Opiina faz?',
    a: 'Captura o NPS, mostra o que o cliente falou e organiza o atendimento num Kanban simples.',
  },
  {
    q: 'Como a pesquisa chega no cliente?',
    a: 'Você monta a pesquisa em poucos passos e envia em mais de um canal. A resposta volta direto pro painel.',
  },
  {
    q: 'Serve pra uma casa só ou pra rede?',
    a: 'Os dois. Start e Pro são para uma unidade. Redes cobre todas as unidades, com métricas por casa.',
  },
  { q: 'Preciso treinar a equipe toda?', a: 'Não. O fluxo é o de sempre: pergunta, vê a nota, trata a ocorrência.' },
];

function Duvidas() {
  return (
    <section className="sec sec--suave" id="duvidas" aria-labelledby="duvidas-titulo">
      <span id="faq" className="ancora-antiga" aria-hidden="true" />
      <div className="sec__in sec__in--estreito">
        <span className="tag revelar">Dúvidas</span>
        <h2 className="revelar" id="duvidas-titulo">
          Perguntas <em>frequentes</em>
        </h2>
        <div className="faq revelar">
          {DUVIDAS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChamadaFinal() {
  return (
    <section className="sec" id="comecar" aria-labelledby="cta-titulo">
      <div className="sec__in">
        <div className="cta revelar">
          <h2 id="cta-titulo">
            Ouça o cliente. <em>Organize o atendimento.</em>
          </h2>
          <p className="sub">Planos a partir de R$ 147,00 por mês — para uma unidade ou para a rede toda.</p>
          <div className="acoes">
            <a className="btn btn--solido btn--grande" href="#planos">
              Ver planos
            </a>
            <Link className="btn btn--contorno btn--grande" to="/login">
              Já tenho conta
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Aparece quando o hero já saiu da maior parte da tela; leva de volta e põe o foco no título. */
function VoltarAoTopo() {
  const [oculto, setOculto] = useState(true);

  useEffect(() => {
    let agendado = false;
    const conferir = () => {
      const topo = document.querySelector('[data-topo]');
      if (topo) setOculto(topo.getBoundingClientRect().bottom >= window.innerHeight * 0.5);
      agendado = false;
    };
    const aoRolar = () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(conferir);
    };
    window.addEventListener('scroll', aoRolar, { passive: true });
    conferir();
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  return (
    <a
      className={oculto ? 'voltar-topo voltar-topo--oculto' : 'voltar-topo'}
      href="#inicio"
      aria-label="Voltar ao início"
      onClick={(evento) => {
        evento.preventDefault();
        const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' });
        history.replaceState(history.state, '', '#inicio');
        document.getElementById('hero-titulo')?.focus({ preventScroll: true });
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
      </svg>
    </a>
  );
}

