import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type MmIntegrationStatus = {
  connected: boolean;
  mmCompanyId: string | null;
  tradeName: string | null;
  connectedAt: string | null;
};

function errorMessage(err: unknown): string {
  const code =
    err instanceof ApiError &&
    typeof err.body === 'object' &&
    err.body &&
    'message' in err.body
      ? String((err.body as { message?: unknown }).message)
      : err instanceof Error
        ? err.message
        : '';

  switch (code) {
    case 'invalid_mm_api_key':
      return 'Chave inválida. Confira a chave gerada no Muito Mais.';
    case 'api_key_required':
      return 'Informe a chave de API do Muito Mais.';
    case 'mm_api_not_configured':
      return 'A integração Muito Mais ainda não está configurada no servidor.';
    case 'integrations_secret_not_configured':
      return 'O servidor não tem chave de criptografia para salvar a integração.';
    case 'mm_validate_unavailable':
    case 'invalid_mm_validate_response':
      return 'Não foi possível validar a chave no Muito Mais. Tente novamente.';
    default:
      return 'Não foi possível concluir a operação.';
  }
}

function formatConnectedAt(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export function IntegrationsPage() {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['integrations-mm'],
    queryFn: () => apiFetch<MmIntegrationStatus>('/integrations/mm'),
  });

  const connect = useMutation({
    mutationFn: () =>
      apiFetch<MmIntegrationStatus>('/integrations/mm/connect', {
        method: 'POST',
        json: { apiKey: apiKey.trim() },
      }),
    onSuccess: async () => {
      setApiKey('');
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ['integrations-mm'] });
      await qc.invalidateQueries({ queryKey: ['mm-companies'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const disconnect = useMutation({
    mutationFn: () =>
      apiFetch<MmIntegrationStatus>('/integrations/mm', { method: 'DELETE' }),
    onSuccess: async () => {
      setFormError(null);
      await qc.invalidateQueries({ queryKey: ['integrations-mm'] });
      await qc.invalidateQueries({ queryKey: ['mm-companies'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const row = status.data;
  const connected = Boolean(row?.connected);
  const connectedAt = formatConnectedAt(row?.connectedAt ?? null);

  return (
    <div className="grid gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-3xl font-semibold tracking-tight text-opiina-navy">Integrações</h1>
          <span className="inline-flex items-center rounded-full bg-[#E8F4FF] px-3 py-1 text-xs font-medium text-opiina-cyan">
            Muito Mais
          </span>
        </div>
        <p className="mt-2 text-sm text-opiina-muted">
          Vincule a empresa Muito Mais desta conta. A chave é validada e guardada criptografada — nunca em
          texto puro.
        </p>
      </div>

      <Card
        title="Muito Mais"
        description="Cole a chave de API gerada no painel do Muito Mais para liberar o seletor de prêmios."
      >
        {status.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
        {status.isError && (
          <div className="text-sm text-rose-700">
            {status.error instanceof ApiError && status.error.status === 403
              ? 'Você não tem permissão para gerenciar integrações.'
              : 'Falha ao carregar o status da integração.'}
          </div>
        )}

        {status.data && connected && (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#E8F4FF] px-3 py-1 text-xs font-medium text-opiina-cyan">
                Conectado
              </span>
              {connectedAt && <span className="text-xs text-opiina-muted">desde {connectedAt}</span>}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700">Empresa</div>
              <div className="mt-1 text-base font-semibold text-opiina-navy">
                {row?.tradeName?.trim() || 'Empresa Muito Mais'}
              </div>
              {row?.mmCompanyId && (
                <div className="mt-1 font-mono text-xs text-opiina-muted">{row.mmCompanyId}</div>
              )}
            </div>
            <p className="text-sm text-slate-600">
              Campanhas em{' '}
              <Link to="/app/premios" className="font-medium text-opiina-cyan hover:underline">
                Prêmios
              </Link>{' '}
              usam somente esta empresa.
            </p>
            {formError && <div className="text-sm text-rose-700">{formError}</div>}
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={disconnect.isPending}
                onClick={() => {
                  if (!window.confirm('Desconectar o Muito Mais desta conta? As campanhas existentes permanecem.')) {
                    return;
                  }
                  disconnect.mutate();
                }}
              >
                {disconnect.isPending ? 'Desconectando...' : 'Desconectar'}
              </Button>
            </div>
          </div>
        )}

        {status.data && !connected && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              if (!apiKey.trim()) {
                setFormError('Informe a chave de API do Muito Mais.');
                return;
              }
              connect.mutate();
            }}
          >
            <label>
              <div className="mb-1 text-sm font-medium text-slate-700">Chave de API</div>
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Cole a chave gerada no Muito Mais"
              />
            </label>
            {formError && <div className="text-sm text-rose-700">{formError}</div>}
            <div>
              <Button type="submit" disabled={connect.isPending}>
                {connect.isPending ? 'Validando...' : 'Conectar'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
