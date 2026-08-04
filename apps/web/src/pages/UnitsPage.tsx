import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type Unit = {
  id: string;
  name: string;
  timeZone: string | null;
  internalCode: string | null;
  address: string | null;
  googleBusinessUrl: string | null;
};

export function UnitsPage() {
  const qc = useQueryClient();
  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => apiFetch<Unit[]>('/units'),
  });

  const [name, setName] = useState('');
  const [timeZone, setTimeZone] = useState('America/Sao_Paulo');
  const [address, setAddress] = useState('');
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState('');

  const [editingId, setEditingId] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editTimeZone, setEditTimeZone] = useState('America/Sao_Paulo');
  const [editAddress, setEditAddress] = useState('');
  const [editGoogleBusinessUrl, setEditGoogleBusinessUrl] = useState('');

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Unit>('/units', {
        method: 'POST',
        json: {
          name,
          timeZone,
          address: address.trim() || undefined,
          googleBusinessUrl: googleBusinessUrl.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      setName('');
      setAddress('');
      setGoogleBusinessUrl('');
      await qc.invalidateQueries({ queryKey: ['units'] });
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      return apiFetch<Unit>(`/units/${encodeURIComponent(editingId)}`, {
        method: 'PATCH',
        json: {
          name: editName.trim() || undefined,
          timeZone: editTimeZone.trim() || undefined,
          address: editAddress.trim() || undefined,
          googleBusinessUrl: editGoogleBusinessUrl.trim() || undefined,
        },
      });
    },
    onSuccess: async () => {
      setEditingId('');
      setEditName('');
      setEditTimeZone('America/Sao_Paulo');
      setEditAddress('');
      setEditGoogleBusinessUrl('');
      await qc.invalidateQueries({ queryKey: ['units'] });
    },
  });

  return (
    <div className="grid gap-6">
      <div>
        <div className="text-xl font-semibold">Unidades</div>
        <div className="text-sm text-slate-600">Gestão multiunidade por tenant</div>
      </div>

      {editingId && (
        <Card title="Editar unidade" description="Atualize dados operacionais (endereço, fuso)">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="mb-1 text-sm font-medium text-slate-700">Nome</div>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome da unidade" />
            </div>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Fuso horário</div>
              <Input value={editTimeZone} onChange={(e) => setEditTimeZone(e.target.value)} placeholder="Fuso horário" />
            </div>
            <div className="md:col-span-3">
              <div className="mb-1 text-sm font-medium text-slate-700">Endereço</div>
              <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Endereço (opcional)" />
            </div>
            <div className="md:col-span-3">
              <div className="mb-1 text-sm font-medium text-slate-700">Google Meu Negócio (link)</div>
              <Input
                value={editGoogleBusinessUrl}
                onChange={(e) => setEditGoogleBusinessUrl(e.target.value)}
                placeholder="https://g.page/r/..."
              />
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

      <Card title="Criar unidade">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da unidade" />
          </div>
          <div>
            <Input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="Fuso horário" />
          </div>
          <div className="md:col-span-3">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço (opcional)" />
          </div>
          <div className="md:col-span-3">
            <Input
              value={googleBusinessUrl}
              onChange={(e) => setGoogleBusinessUrl(e.target.value)}
              placeholder="Link do Google Meu Negócio (opcional)"
            />
          </div>
          <div className="md:col-span-3">
            <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Lista">
        {units.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {units.isError && <div className="text-sm text-rose-700">Falha ao carregar unidades</div>}
        {units.data && units.data.length === 0 && <div className="text-sm text-slate-600">Nenhuma unidade</div>}
        {units.data && units.data.length > 0 && (
          <div className="divide-y divide-slate-200">
            {units.data.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.timeZone ?? '—'}</div>
                  <div className="text-xs text-slate-500">{u.address ?? '—'}</div>
                  <div className="text-xs text-slate-500">{u.googleBusinessUrl ?? '—'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(u.id);
                      setEditName(u.name);
                      setEditTimeZone(u.timeZone ?? 'America/Sao_Paulo');
                      setEditAddress(u.address ?? '');
                      setEditGoogleBusinessUrl(u.googleBusinessUrl ?? '');
                    }}
                  >
                    Editar
                  </Button>
                  <div className="text-xs font-mono text-slate-500">{u.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
