import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

export type AuthMe = {
  id?: string;
  userId?: string;
  name: string;
  email?: string;
  roleCodes?: string[];
  roleNames?: string[];
  permissionCodes: string[];
};

const NOMES_PERFIL: Record<string, string> = {
  tenant_admin: 'Administrador',
  regional_manager: 'Gestor regional',
  unit_manager: 'Gestor de unidade',
  analyst: 'Marketing',
  collaborator: 'Colaborador',
};

/** Usuário logado (mesma query do AppShell, compartilhada pelo cache). */
export function useAuthMe() {
  return useQuery({ queryKey: ['authMe'], queryFn: () => apiFetch<AuthMe>('/auth/me') });
}

export function usePode() {
  const me = useAuthMe();
  const codes = me.data?.permissionCodes;
  return useCallback((codigo: string) => (codes ?? []).includes(codigo), [codes]);
}

export function nomePerfil(me?: AuthMe) {
  if (!me) return '';
  if (me.roleNames?.length) return me.roleNames[0];
  const code = me.roleCodes?.[0];
  return code ? (NOMES_PERFIL[code] ?? code) : '';
}

export const iniciais = (nome: string) =>
  nome
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const CHAVE_TEMA = 'opiina-tema';

function temaInicial(): boolean {
  try {
    const t = localStorage.getItem(CHAVE_TEMA);
    if (t) return t === 'escuro';
  } catch {
    /* sem armazenamento: segue o sistema */
  }
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Modo escuro do painel: escolha guardada no navegador ou, sem escolha, o tema do sistema. */
export function useTemaPainel() {
  const [escuro, setEscuro] = useState(temaInicial);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      let escolha: string | null = null;
      try {
        escolha = localStorage.getItem(CHAVE_TEMA);
      } catch {
        /* ignora */
      }
      if (!escolha) setEscuro(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const alternar = useCallback(() => {
    setEscuro((v) => {
      try {
        localStorage.setItem(CHAVE_TEMA, v ? 'claro' : 'escuro');
      } catch {
        /* ignora */
      }
      return !v;
    });
  }, []);
  return { escuro, alternar };
}

export const EVENTO_TOUR = 'opiina:tour';

/** Pede o tour do painel de qualquer tela (ex.: Minha conta). */
export const abrirTour = () => window.dispatchEvent(new Event(EVENTO_TOUR));
