import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
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

  return (
    <div className="flex h-full bg-slate-50 text-slate-900">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <Link to="/app" className="mb-6 inline-flex items-center gap-2">
          <img src="/favicon.svg" alt="OPAA" className="h-8 w-8" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">OPAA</div>
            <div className="text-xs text-slate-500">Satisfação & CRM</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm',
                isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')
            }
          >
            Dashboard
          </NavLink>
          {canManageTenant && (
            <NavLink
              to="/app/company"
              className={({ isActive }) =>
                [
                  'rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
                ].join(' ')
              }
            >
              Empresa
            </NavLink>
          )}
          <NavLink
            to="/app/units"
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm',
                isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')
            }
          >
            Unidades
          </NavLink>
          {canManageUnits && (
            <NavLink
              to="/app/employees"
              className={({ isActive }) =>
                [
                  'rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
                ].join(' ')
              }
            >
              Atendentes
            </NavLink>
          )}
          {canManageUsers && (
            <NavLink
              to="/app/users"
              className={({ isActive }) =>
                [
                  'rounded-md px-3 py-2 text-sm',
                  isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
                ].join(' ')
              }
            >
              Usuários
            </NavLink>
          )}
          <NavLink
            to="/app/surveys"
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm',
                isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')
            }
          >
            Pesquisas
          </NavLink>
          <NavLink
            to="/app/customers"
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm',
                isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')
            }
          >
            Clientes
          </NavLink>
          <NavLink
            to="/app/feedbacks"
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm',
                isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')
            }
          >
            Feedbacks
          </NavLink>
          <NavLink
            to="/app/feedbacks/kanban"
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm',
                isActive ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')
            }
          >
            Kanban
          </NavLink>
        </nav>

        <div className="mt-auto pt-6">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setAccessToken(null);
              navigate('/login');
            }}
          >
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="flex w-full flex-col gap-6 p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
