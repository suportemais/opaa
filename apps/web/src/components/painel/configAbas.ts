import type { NomeIcone } from './Icone';

type Aba = { to: string; rotulo: string; icone: NomeIcone; pode: (p: (c: string) => boolean) => boolean };

// Mesmas permissões do antigo menu "Configurações" do AppShell
export const ABAS: Aba[] = [
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

export const podeCom = (codes: string[]) => (c: string) => codes.includes(c);

/** Primeira aba de Configurações que o usuário pode ver (destino do item do menu). */
export function primeiraTelaDeConfiguracoes(codes: string[]) {
  return ABAS.find((a) => a.pode(podeCom(codes)))?.to ?? '/app/conta';
}
