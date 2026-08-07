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

function usePermissionCodes() {
  const { data } = useQuery({
    queryKey: ['authMe'],
    queryFn: () => apiFetch<{ permissionCodes: string[]; unitIds: string[] }>('/auth/me').catch(() => ({ permissionCodes: [], unitIds: [] })),
    staleTime: 60 * 1000,
    retry: false,
  });
  return {
    permissionCodes: data?.permissionCodes ?? [],
    unitIds: data?.unitIds ?? [],
  };
}

export function EmployeesPage() {
  const qc = useQueryClient();
  const { permissionCodes, unitIds } = usePermissionCodes();
  const canManageEmployees =
    permissionCodes.includes('employee:manage') || permissionCodes.includes('unit:manage');
  const canSeeAllUnits = permissionCodes.includes('unit:manage');
  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });

  const allowedUnits = useMemo<Unit[]>(() => {
    if (!units.data) return [];
    if (canSeeAllUnits) return units.data;
    const allowed = new Set(unitIds);
    return units.data.filter((u) => allowed.has(u.id));
  }, [units.data, canSeeAllUnits, unitIds]);

  const defaultUnitId = useMemo(() => allowedUnits[0]?.id ?? '', [allowedUnits]);
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

  const [importUnitId, setImportUnitId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; total?: number; errors?: Array<{ row: number; message: string }> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const importEmployees = useMutation({
    mutationFn: async () => {
      if (!importFile) throw new Error('missing_file');
      const form = new FormData();
      form.append('unitId', importUnitId || defaultUnitId);
      form.append('file', importFile);
      return apiFetch<{ imported: number; total?: number; errors?: Array<{ row: number; message: string }> }>('/employees/import', {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: async (data) => {
      setImportResult(data);
      setImportError(null);
      setImportFile(null);
      const input = document.getElementById('employee-import-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => {
      const body = (err as any)?.responseJson as any;
      const message =
        typeof err === 'string'
          ? err
          : Array.isArray(body?.errors)
            ? 'Verifique os erros abaixo.'
            : (body?.message ?? 'Falha ao importar');
      setImportError(message);
      setImportResult(null);
    },
  });

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Atendentes</div>
        <div className="text-sm text-slate-600">Cadastro de atendentes por unidade para seleção na pesquisa</div>
      </div>

      {editingId && canManageEmployees && (
        <Card title="Editar atendente">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Unidade</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={editUnitId}
                onChange={(e) => setEditUnitId(e.target.value)}
              >
                {allowedUnits.map((u) => (
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

      <div className="grid gap-4 lg:grid-cols-2">
        {canManageEmployees && (
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
                {allowedUnits.map((u) => (
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
        )}

        {canManageEmployees && (
        <Card
          title="Importar CSV"
          description="Colunas: Nome (obrigatório), Código (opcional), Cargo (opcional). Limite 2MB."
        >
          <div className="grid gap-3">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Unidade</div>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={importUnitId || defaultUnitId}
                onChange={(e) => setImportUnitId(e.target.value)}
                disabled={units.isLoading || importEmployees.isPending}
              >
                {allowedUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Arquivo CSV</div>
              <input
                id="employee-import-file"
                type="file"
                accept=".csv,text/csv"
                disabled={importEmployees.isPending}
                className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-sky-700"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setImportFile(f);
                  setImportResult(null);
                  setImportError(null);
                }}
              />
              <div className="mt-1 text-xs text-slate-500">
                Exemplo de cabeçalho: <span className="font-mono text-slate-700">Nome,Código,Cargo</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                disabled={importEmployees.isPending || !importFile}
                onClick={() => {
                  setImportFile(null);
                  setImportResult(null);
                  setImportError(null);
                  const input = document.getElementById('employee-import-file') as HTMLInputElement | null;
                  if (input) input.value = '';
                }}
              >
                Limpar
              </Button>
              <Button disabled={!importFile || importEmployees.isPending} onClick={() => importEmployees.mutate()}>
                {importEmployees.isPending ? 'Importando...' : 'Importar'}
              </Button>
            </div>
            {importResult && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {importResult.imported} de {importResult.total ?? importResult.imported} atendente(s) importado(s) com sucesso.
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2 text-emerald-900">
                    <div className="mb-1 font-medium">Observações:</div>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {importResult.errors.map((e, i) => (
                        <li key={i}>
                          Linha {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {importError && (
              <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {importError}
                {Array.isArray((importEmployees.error as any)?.responseJson?.errors) && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5">
                    {((importEmployees.error as any)?.responseJson?.errors ?? []).map((e: any, i: number) => (
                      <li key={i}>
                        Linha {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Card>
        )}
      </div>

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
              {allowedUnits.map((u) => (
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
                  {canManageEmployees && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

