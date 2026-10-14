import { useQuery } from '@tanstack/react-query';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { setAccessToken } from '../../lib/auth-store';
import { apiFetch } from '../../lib/api';
import { TenantBillingPrompts } from '../billing/TenantBillingPrompts';
import { BillingBlockedScreen } from '../billing/BillingBlockedScreen';
import { useBillingReturn } from '../../lib/billing';
import type { TenantBilling } from '../../lib/billing-access';
import { Icone, type NomeIcone } from '../painel/Icone';
import { iniciais, nomePerfil, useAuthMe, useTemaPainel } from '../painel/usePainel';
import { primeiraTelaDeConfiguracoes } from '../painel/configAbas';
import { BoasVindas } from '../painel/BoasVindas';

type TenantMe = {
  createdAt?: string | null;
  tradeName?: string | null;
  legalName?: string | null;
  billing?: TenantBilling;
};

type CasesSummary = { due?: { overdue?: number } };

type ItemMenu = { to: string; rotulo: string; icone: NomeIcone; end?: boolean; ativoEm?: string[]; selo?: number };

// Rotas de Configurações (o item do menu fica ativo em todas)
const ROTAS_CONFIG = ['/app/company', '/app/units', '/app/employees', '/app/users', '/app/integracoes', '/app/conta'];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const me = useAuthMe();
  const tenant = useQuery({
    queryKey: ['tenantMe'],
    queryFn: () => apiFetch<TenantMe>('/tenant/me').catch(() => ({ billing: undefined }) as TenantMe),
    staleTime: 60 * 1000,
  });
  const { escuro, alternar } = useTemaPainel();
  const [billingNotice, dismissBillingNotice] = useBillingReturn();

  const permissionCodes = me.data?.permissionCodes ?? [];
  const pode = (c: string) => permissionCodes.includes(c);
  const canManageTenant = pode('tenant:settings:manage');
  const canManageFeedback = pode('feedback:manage');

  // Selo de vencidas no item Feedbacks: só para quem trata ocorrências
  const casos = useQuery({
    queryKey: ['shellCasesSummary'],
    queryFn: () => apiFetch<CasesSummary>('/metrics/cases/summary'),
    enabled: canManageFeedback,
    staleTime: 60 * 1000,
  });
  const vencidas = canManageFeedback ? (casos.data?.due?.overdue ?? 0) : 0;

  const grupos: { titulo?: string; itens: ItemMenu[] }[] = [
    {
      titulo: 'Visão geral',
      itens: [
        { to: '/app', rotulo: 'Dashboard', icone: 'dashboard', end: true },
        { to: '/app/ranking', rotulo: 'Ranking', icone: 'ranking' },
      ],
    },
    {
      titulo: 'Atendimento',
      itens: [
        { to: '/app/feedbacks', rotulo: 'Feedbacks', icone: 'feedbacks', selo: vencidas },
        ...(canManageTenant ? [{ to: '/app/whistleblower', rotulo: 'Denúncias', icone: 'denuncias' as const }] : []),
      ],
    },
    {
      titulo: 'Pesquisa e clientes',
      itens: [
        { to: '/app/surveys', rotulo: 'Pesquisas', icone: 'pesquisas' },
        { to: '/app/customers', rotulo: 'Clientes', icone: 'clientes' },
        { to: '/app/premios', rotulo: 'Prêmios', icone: 'premios' },
      ],
    },
    {
      itens: [
        {
          to: primeiraTelaDeConfiguracoes(permissionCodes),
          rotulo: 'Configurações',
          icone: 'config',
          ativoEm: ROTAS_CONFIG,
        },
      ],
    },
  ];

  const ativo = (item: ItemMenu) => {
    const p = location.pathname;
    if (item.ativoEm) return item.ativoEm.some((r) => p === r || p.startsWith(`${r}/`));
    if (item.end) return p === item.to || p === `${item.to}/`;
    return p === item.to || p.startsWith(`${item.to}/`);
  };

  // Menu lateral no celular
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoAbrir = useRef<HTMLButtonElement>(null);
  useEffect(() => setMenuAberto(false), [location.pathname]);
  useEffect(() => {
    if (!menuAberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAberto(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuAberto]);

  const sair = () => {
    setAccessToken(null);
    navigate('/login');
  };

  const nome = me.data?.name ?? '';
  const empresa = tenant.data?.tradeName || tenant.data?.legalName || '';

  return (
    <div className="painel" data-tema={escuro ? 'escuro' : undefined}>
      <a className="pular" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div className="app">
        <header className="barra-movel" inert={menuAberto || undefined}>
          <button
            ref={botaoAbrir}
            className="botao-icone"
            type="button"
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            aria-controls="menu-lateral"
            onClick={() => setMenuAberto(true)}
          >
            <Icone nome="menu" />
          </button>
          <Link className="marca" to="/app">
            <img src="/site/icons/logo-opiina-256.png" alt="" width={256} height={256} />
            Opiina
          </Link>
        </header>

        <aside
          className="lateral"
          id="menu-lateral"
          aria-label="Menu do painel"
          data-aberto={menuAberto ? '' : undefined}
        >
          <div className="lateral__topo">
            <Link className="marca" to="/app">
              <img src="/site/icons/logo-opiina-256.png" alt="" width={256} height={256} />
              Opiina
            </Link>
            <button
              className="botao-icone lateral__fechar"
              type="button"
              aria-label="Fechar menu"
              onClick={() => {
                setMenuAberto(false);
                botaoAbrir.current?.focus();
              }}
            >
              <Icone nome="fechar" />
            </button>
          </div>
          {empresa && <span className="marca__empresa">{empresa}</span>}

          <nav className="nav" aria-label="Principal">
            {grupos.map((g, i) => (
              <div className="nav__grupo" key={g.titulo ?? i}>
                {g.titulo && <p className="nav__titulo">{g.titulo}</p>}
                {g.itens.map((item) => (
                  <Link
                    key={item.rotulo}
                    to={item.to}
                    className="nav__item"
                    data-tour={item.icone}
                    aria-current={ativo(item) ? 'page' : undefined}
                  >
                    <Icone nome={item.icone} />
                    {item.rotulo}
                    {!!item.selo && (
                      <span className="nav__selo">
                        <span aria-hidden="true">{item.selo}</span>
                        <span className="visualmente-oculto">
                          , {item.selo} {item.selo === 1 ? 'vencida' : 'vencidas'}
                        </span>
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <button className="tema" type="button" data-tour="tema" aria-pressed={escuro} onClick={alternar}>
            <span className="tema__icone" aria-hidden="true">
              <Icone nome={escuro ? 'sol' : 'lua'} />
            </span>
            Modo escuro
            <span className="tema__chave" aria-hidden="true" />
          </button>

          <div className="conta" data-tour="conta">
            <span className="avatar" aria-hidden="true">
              {iniciais(nome)}
            </span>
            <Link className="conta__texto" to="/app/conta" title="Minha conta">
              <span className="conta__nome">{nome}</span>
              <span className="conta__perfil">{nomePerfil(me.data)}</span>
            </Link>
            <button className="conta__sair" type="button" aria-label="Sair" title="Sair" onClick={sair}>
              <Icone nome="sair" />
            </button>
          </div>
          <p className="lateral__credito">
            Desenvolvido por{' '}
            <a href="https://devmais.com" target="_blank" rel="noreferrer">
              Dev+
            </a>
          </p>
        </aside>
        <div className="lateral-fundo" onClick={() => setMenuAberto(false)} />
        <BoasVindas
          userId={me.data?.userId ?? me.data?.id}
          contaCriadaEm={tenant.data?.createdAt}
          pronto={me.isSuccess && tenant.isSuccess && !tenant.data?.billing?.accessBlocked}
          abrirMenu={setMenuAberto}
        />

        <main className="principal" id="conteudo" inert={menuAberto || undefined}>
          <div className="principal__conteudo">
            <TenantBillingPrompts
              billing={tenant.data?.billing}
              canManage={canManageTenant}
              notice={billingNotice}
              onDismissNotice={dismissBillingNotice}
            />
            {tenant.data?.billing?.accessBlocked ? (
              <BillingBlockedScreen billing={tenant.data.billing} canManage={canManageTenant} />
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
