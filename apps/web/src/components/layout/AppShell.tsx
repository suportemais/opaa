import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { setAccessToken } from '../../lib/auth-store';
import { apiFetch } from '../../lib/api';

type AuthMe = {
  name: string;
  permissionCodes: string[];
};

export function AppShell() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['authMe'], queryFn: () => apiFetch<AuthMe>('/auth/me') });

  const permissionCodes = me.data?.permissionCodes ?? [];
  const canManageTenant = permissionCodes.includes('tenant:settings:manage');
  const canManageUsers = permissionCodes.includes('user:manage');
  const canManageUnits = permissionCodes.includes('unit:manage');
  const canReadUnits = permissionCodes.includes('unit:read') || canManageUnits;

  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-settings-menu]')) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [settingsOpen]);

  const navClass = (isActive: boolean) =>
    [
      'rounded-md px-3 py-2 text-sm',
      isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
    ].join(' ');

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-4">
            <Link to="/app" className="inline-flex items-center gap-2">
              <img src="/logo.svg" alt="Opiina" className="h-9 drop-shadow-sm" />
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <NavLink to="/app" end className={({ isActive }) => navClass(isActive)}>
                Dashboard
              </NavLink>
              <NavLink to="/app/surveys" className={({ isActive }) => navClass(isActive)}>
                Pesquisas
              </NavLink>
              <NavLink to="/app/customers" className={({ isActive }) => navClass(isActive)}>
                Clientes
              </NavLink>
              <NavLink to="/app/feedbacks" className={({ isActive }) => navClass(isActive)}>
                Feedbacks
              </NavLink>
              <NavLink to="/app/feedbacks/kanban" className={({ isActive }) => navClass(isActive)}>
                Kanban
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" data-settings-menu>
              <button
                type="button"
                className={[
                  'inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium',
                  'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                ].join(' ')}
                onClick={() => setSettingsOpen((v) => !v)}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
                  <path d="M19.4 15a7.9 7.9 0 0 0 .1-1 7.9 7.9 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.7 7.7 0 0 0-1.7-1l-.4-2.6H9.1L8.7 7a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 13a7.9 7.9 0 0 0-.1 1c0 .3 0 .7.1 1l-2 1.6 2 3.4 2.4-1a7.7 7.7 0 0 0 1.7 1l.4 2.6h5.8l.4-2.6a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6Z" />
                </svg>
                Configurações
              </button>

              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                  <div className="px-3 py-2 text-xs font-medium text-slate-500">Cadastro</div>
                  {canManageTenant && (
                    <NavLink
                      to="/app/company"
                      className={({ isActive }) => ['block px-3 py-2 text-sm', isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
                      onClick={() => setSettingsOpen(false)}
                    >
                      Empresa
                    </NavLink>
                  )}
                  {canReadUnits && (
                    <NavLink
                      to="/app/units"
                      className={({ isActive }) => ['block px-3 py-2 text-sm', isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
                      onClick={() => setSettingsOpen(false)}
                    >
                      Unidades
                    </NavLink>
                  )}
                  {canManageUnits && (
                    <NavLink
                      to="/app/employees"
                      className={({ isActive }) => ['block px-3 py-2 text-sm', isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
                      onClick={() => setSettingsOpen(false)}
                    >
                      Atendentes
                    </NavLink>
                  )}
                  {canManageUsers && (
                    <NavLink
                      to="/app/users"
                      className={({ isActive }) => ['block px-3 py-2 text-sm', isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'].join(' ')}
                      onClick={() => setSettingsOpen(false)}
                    >
                      Usuários
                    </NavLink>
                  )}
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              onClick={() => {
                setAccessToken(null);
                navigate('/login');
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-8">
          <Outlet />
          <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
            Desenvolvido por{' '}
            <a className="text-sky-700 hover:underline" href="https://devmais.com" target="_blank" rel="noreferrer">
              Dev+
            </a>
          </footer>
        </div>
      </main>
    </div>
  );
}
