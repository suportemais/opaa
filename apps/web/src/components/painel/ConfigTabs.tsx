import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Icone, type NomeIcone } from './Icone';
import { useAuthMe } from './usePainel';

type Aba = { to: string; rotulo: string; icone: NomeIcone; pode: (p: (c: string) => boolean) => boolean };

// Mesmas permissões do antigo menu "Configurações" do AppShell
const ABAS: Aba[] = [
  { to: '/app/company', rotulo: 'Empresa', icone: 'loja', pode: (p) => p('tenant:settings:manage') },
  { to: '/app/units', rotulo: 'Unidades', icone: 'ranking', pode: (p) => p('unit:read') || p('unit:manage') },
  {
    to: '/app/employees',
    rotulo: 'Atendentes',
    icone: 'pessoa',
    pode: (p) => p('employee:read') || p('employee:manage') || p('unit:manage'),
  },
  { to: '/app/users', rotulo: 'Usuários e perfis', icone: 'cadeado', pode: (p) => p('user:manage') },
  { to: '/app/integracoes', rotulo: 'Integrações', icone: 'plug', pode: (p) => p('tenant:settings:manage') },
  { to: '/app/conta', rotulo: 'Minha conta', icone: 'clientes', pode: () => true },
];

const podeCom = (codes: string[]) => (c: string) => codes.includes(c);

/** Primeira aba de Configurações que o usuário pode ver (destino do item do menu). */
export function primeiraTelaDeConfiguracoes(codes: string[]) {
  return ABAS.find((a) => a.pode(podeCom(codes)))?.to ?? '/app/conta';
}

/** Moldura das telas de Configurações: abas à esquerda (no celular, em linha) e o conteúdo. */
export function ConfigLayout({ children }: { children: ReactNode }) {
  const me = useAuthMe();
  const p = podeCom(me.data?.permissionCodes ?? []);
  const abas = ABAS.filter((a) => a.pode(p));
  return (
    <>
      <header className="cabeca">
        <div>
          <h1 className="cabeca__titulo">Configurações</h1>
        </div>
      </header>
      <div className={abas.length > 1 ? 'cfg' : 'cfg cfg--so-conta'}>
        {abas.length > 1 && (
          <nav className="cfg__nav" aria-label="Seções das configurações">
            {abas.map((a) => (
              // NavLink já marca aria-current="page" no link ativo (o CSS do protótipo usa isso)
              <NavLink key={a.to} to={a.to}>
                <Icone nome={a.icone} />
                {a.rotulo}
              </NavLink>
            ))}
          </nav>
        )}
        <div className="cfg__conteudo">{children}</div>
      </div>
    </>
  );
}
