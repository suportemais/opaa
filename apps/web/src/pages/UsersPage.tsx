import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type Unit = { id: string; name: string };
type TenantUser = {
  id: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
  roles: Array<{ code: string; name: string }>;
  unitAccess: Unit[];
};

const roleOptions = [
  { code: 'tenant_admin', name: 'Administrador do tenant' },
  { code: 'regional_manager', name: 'Gestor regional' },
  { code: 'unit_manager', name: 'Gestor de unidade' },
  { code: 'analyst', name: 'Analista' },
  { code: 'collaborator', name: 'Colaborador' },
] as const;

const createRoleOptions = [
  { code: 'tenant_admin', name: 'Administrador' },
  { code: 'analyst', name: 'Marketing' },
  { code: 'unit_manager', name: 'Gestor' },
] as const;

export function UsersPage() {
  const qc = useQueryClient();

  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });
  const users = useQuery({ queryKey: ['users'], queryFn: () => apiFetch<TenantUser[]>('/users') });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [roleCode, setRoleCode] = useState<(typeof createRoleOptions)[number]['code']>('analyst');
  const [unitIds, setUnitIds] = useState<string[]>([]);

  const create = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/users', {
        method: 'POST',
        json: { name, email, password: createPassword, roleCode, unitIds: unitIds.length ? unitIds : undefined },
      }),
    onSuccess: async () => {
      setName('');
      setEmail('');
      setCreatePassword('');
      setRoleCode('analyst');
      setUnitIds([]);
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const [editingId, setEditingId] = useState('');
  const editingUser = useMemo(() => users.data?.find((u) => u.id === editingId) ?? null, [users.data, editingId]);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'disabled'>('active');
  const [editRoleCode, setEditRoleCode] = useState<(typeof roleOptions)[number]['code']>('collaborator');
  const [editUnitIds, setEditUnitIds] = useState<string[]>([]);

  const update = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        json: {
          name: editName.trim() || undefined,
          email: editEmail.trim() || undefined,
          status: editStatus,
          roleCode: editRoleCode,
          unitIds: editUnitIds,
        },
      }),
    onSuccess: async () => {
      setEditingId('');
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const [resetPassword, setResetPassword] = useState('');
  const setUserPassword = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(editingId)}/password`, {
        method: 'POST',
        json: { password: resetPassword },
      }),
    onSuccess: async () => {
      setResetPassword('');
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const disableUser = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ ok: boolean }>(`/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Usuários</div>
        <div className="text-sm text-slate-600">Convide e gerencie usuários da empresa</div>
      </div>

      {editingId && editingUser && (
        <Card title="Editar usuário" description="Ajuste dados, status, perfil e acesso às unidades">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} inputMode="email" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Status</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
              >
                <option value="active">Ativo</option>
                <option value="disabled">Desativado</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Perfil</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={editRoleCode}
                onChange={(e) => setEditRoleCode(e.target.value as any)}
              >
                {roleOptions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="mb-2 text-sm font-medium text-slate-700">Acesso às unidades</div>
              <div className="grid gap-2 md:grid-cols-2">
                {(units.data ?? []).map((u) => {
                  const checked = editUnitIds.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setEditUnitIds((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)));
                        }}
                      />
                      {u.name}
                    </label>
                  );
                })}
                {!units.isLoading && (units.data?.length ?? 0) === 0 && (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Nenhuma unidade cadastrada</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Perfis sem permissão de gerenciar unidades precisam ter pelo menos 1 unidade selecionada.
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                disabled={update.isPending || setUserPassword.isPending}
                onClick={() => {
                  setEditingId('');
                  setResetPassword('');
                }}
              >
                Cancelar
              </Button>
              <Button disabled={update.isPending || setUserPassword.isPending} onClick={() => update.mutate()}>
                {update.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>

            {update.isError && (
              <div className="md:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao salvar</div>
            )}

            <div className="md:col-span-2 border-t border-slate-200 pt-4">
              <div className="mb-2 text-sm font-semibold text-slate-900">Resetar senha</div>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} type="password" placeholder="Nova senha (mín. 8)" />
                <Button
                  variant="secondary"
                  disabled={setUserPassword.isPending || resetPassword.trim().length < 8}
                  onClick={() => setUserPassword.mutate()}
                >
                  {setUserPassword.isPending ? 'Aplicando...' : 'Aplicar'}
                </Button>
              </div>
              {setUserPassword.isError && (
                <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao resetar senha</div>
              )}
              {setUserPassword.isSuccess && (
                <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Senha atualizada</div>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card title="Cadastrar usuário">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">E-mail</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="email@empresa.com" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Senha inicial</div>
            <Input
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              type="password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Perfil</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value as any)}
            >
              {createRoleOptions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="mb-2 text-sm font-medium text-slate-700">Acesso às unidades</div>
            <div className="grid gap-2 md:grid-cols-2">
              {(units.data ?? []).map((u) => {
                const checked = unitIds.includes(u.id);
                return (
                  <label key={u.id} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setUnitIds((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)));
                      }}
                    />
                    {u.name}
                  </label>
                );
              })}
              {!units.isLoading && (units.data?.length ?? 0) === 0 && (
                <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">Nenhuma unidade cadastrada</div>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <Button
              disabled={create.isPending || !name.trim() || !email.trim() || createPassword.trim().length < 8}
              onClick={() => create.mutate()}
            >
              {create.isPending ? 'Criando...' : 'Cadastrar'}
            </Button>
          </div>
          {create.isError && (
            <div className="md:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Falha ao criar usuário. Verifique e-mail, perfil e unidades.
            </div>
          )}
        </div>
      </Card>

      <Card title="Lista">
        {users.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {users.isError && (
          <div className="text-sm text-rose-700">Falha ao carregar usuários (verifique se você tem permissão).</div>
        )}
        {users.data && users.data.length === 0 && <div className="text-sm text-slate-600">Nenhum usuário</div>}
        {users.data && users.data.length > 0 && (
          <div className="divide-y divide-slate-200">
            {users.data.map((u) => {
              const role = u.roles[0];
              return (
                <div key={u.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{u.name}</div>
                    <div className="text-sm text-slate-700">{u.email}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-md bg-slate-100 px-2 py-1">Status: {u.status}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-1">
                        Perfil: {role ? `${role.name} (${role.code})` : '—'}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1">
                        Unidades: {u.unitAccess.length ? u.unitAccess.map((x) => x.name).join(', ') : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingId(u.id);
                        setEditName(u.name);
                        setEditEmail(u.email);
                        setEditStatus((u.status as any) ?? 'active');
                        setEditRoleCode(((role?.code as any) ?? 'collaborator') as any);
                        setEditUnitIds(u.unitAccess.map((x) => x.id));
                        setResetPassword('');
                      }}
                    >
                      Editar
                    </Button>
                    {u.status === 'active' && (
                      <Button
                        variant="ghost"
                        disabled={disableUser.isPending}
                        onClick={() => {
                          const ok = window.confirm(`Desativar o usuário "${u.name}"?`);
                          if (!ok) return;
                          disableUser.mutate(u.id);
                        }}
                      >
                        Desativar
                      </Button>
                    )}
                    <div className="text-xs font-mono text-slate-500">{u.id}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
