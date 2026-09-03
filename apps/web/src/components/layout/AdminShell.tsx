import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { setAccessToken } from '../../lib/auth-store';
import { Button } from '../ui/Button';

type AuthMe = {
  name: string;
  permissionCodes: string[];
  roleCodes?: string[];
};

const navItems = [
  { to: '/admin', label: 'Visão geral', end: true },
  { to: '/admin/contas', label: 'Contas' },
  { to: '/admin/plans', label: 'Planos' },
  { to: '/admin/assinaturas', label: 'Assinaturas' },
];

export function AdminShell() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['authMe'], queryFn: () => apiFetch<AuthMe>('/auth/me') });

  return (
    <div className="flex h-full min-h-0 bg-slate-100 text-slate-900">
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 text-slate-100 md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link to="/admin" className="flex items-center gap-3">
            <img
              src="/icon-opiina.png"
              alt="OPIINA"
              className="h-9 w-9"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.src.endsWith('/favicon.svg')) return;
                el.src = '/favicon.svg';
              }}
            />
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">OPIINA Admin</div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">Dev Mais</div>
            </div>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-lg px-3 py-2 text-sm transition',
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 font-medium text-white ring-1 ring-cyan-400/30'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4 text-xs text-slate-400">
          Operadores da plataforma. Sem chrome de restaurante.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
            <div className="md:hidden">
              <Link to="/admin" className="text-sm font-semibold text-slate-900">
                OPIINA Admin
              </Link>
            </div>
            <div className="hidden text-sm text-slate-500 md:block">
              Painel de operadores · {me.data?.name ?? '…'}
            </div>
            <div className="flex items-center gap-2">
              <nav className="flex items-center gap-1 md:hidden">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'rounded-md px-2 py-1 text-xs',
                        isActive ? 'bg-cyan-50 font-medium text-cyan-800' : 'text-slate-600',
                      ].join(' ')
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
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
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-8">
            <Outlet />
            <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
              Plataforma OPIINA · Dev Mais
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
