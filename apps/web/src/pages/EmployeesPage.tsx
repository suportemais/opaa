import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type Unit = { id: string; name: string };
type Employee = {
  id: string;
  unitId: string;
  name: string;
  code: string | null;
  roleTitle: string | null;
  status: string;
  createdAt: string;
  unit: Unit;
};

export function EmployeesPage() {
  const qc = useQueryClient();
  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });

  const defaultUnitId = useMemo(() => units.data?.[0]?.id ?? '', [units.data]);
  const [filterUnitId, setFilterUnitId] = useState('');
  const [search, setSearch] = useState('');

  const employees = useQuery({
    queryKey: ['employees', filterUnitId, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterUnitId) params.set('unitId', filterUnitId);
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString();
      return apiFetch<Employee[]>(`/employees${qs ? `?${qs}` : ''}`);
    },
  });

  const [unitId, setUnitId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [roleTitle, setRoleTitle] = useState('');

  const [editingId, setEditingId] = useState('');
  const [editUnitId, setEditUnitId] = useState('');
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editRoleTitle, setEditRoleTitle] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  const create = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/employees', {
        method: 'POST',
        json: {
          unitId: unitId || defaultUnitId,
          name,
          code: code.trim() || undefined,
          roleTitle: roleTitle.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      setName('');
      setCode('');
      setRoleTitle('');
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const update = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>(`/employees/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        json: {
          unitId: editUnitId || undefined,
          name: editName.trim() || undefined,
          code: editCode.trim() || undefined,
          roleTitle: editRoleTitle.trim() || undefined,
          status: editStatus,
        },
      }),
    onSuccess: async () => {
      setEditingId('');
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const disable = useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/employees/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Atendentes</div>
        <div className="text-sm text-slate-600">Cadastro de atendentes por unidade para seleção na pesquisa</div>
      </div>

      {editingId && (
        <Card title="Editar atendente">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Unidade</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={editUnitId}
                onChange={(e) => setEditUnitId(e.target.value)}
              >
                {units.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do atendente" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Código</div>
              <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">Cargo</div>
              <Input value={editRoleTitle} onChange={(e) => setEditRoleTitle(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Status</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div className="md:col-span-3 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingId('')} disabled={update.isPending}>
                Cancelar
              </Button>
              <Button disabled={update.isPending} onClick={() => update.mutate()}>
                {update.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
            {update.isError && (
              <div className="md:col-span-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao salvar</div>
            )}
          </div>
        </Card>
      )}

      <Card title="Criar atendente">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Unidade</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={unitId || defaultUnitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={units.isLoading}
            >
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do atendente" />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Código</div>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-sm font-medium text-slate-700">Cargo</div>
            <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="md:col-span-3">
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </div>
          {create.isError && (
            <div className="md:col-span-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">Falha ao criar</div>
          )}
        </div>
      </Card>

      <Card title="Lista">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Unidade</div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={filterUnitId}
              onChange={(e) => setFilterUnitId(e.target.value)}
              disabled={units.isLoading}
            >
              <option value="">Todas</option>
              {units.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-medium text-slate-600">Buscar</div>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou código" />
          </div>
        </div>

        {employees.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {employees.isError && <div className="text-sm text-rose-700">Falha ao carregar atendentes</div>}
        {employees.data && employees.data.length === 0 && <div className="text-sm text-slate-600">Nenhum atendente</div>}
        {employees.data && employees.data.length > 0 && (
          <div className="divide-y divide-slate-200">
            {employees.data.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {e.name} {e.status !== 'active' && <span className="text-xs text-slate-500">(inativo)</span>}
                  </div>
                  <div className="text-xs text-slate-500">{e.unit?.name ?? '—'}</div>
                  <div className="text-xs text-slate-500">{[e.roleTitle, e.code].filter(Boolean).join(' • ') || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(e.id);
                      setEditUnitId(e.unitId);
                      setEditName(e.name);
                      setEditCode(e.code ?? '');
                      setEditRoleTitle(e.roleTitle ?? '');
                      setEditStatus((e.status as any) ?? 'active');
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={disable.isPending || e.status !== 'active'}
                    onClick={() => disable.mutate(e.id)}
                  >
                    Desativar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

