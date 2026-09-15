import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const COPY = {
  SUB_DISCONNECTED: 'Cole a chave gerada no Muito Mais para vincular as duas contas.',
  FIELD_LABEL: 'Chave de API do Muito Mais',
  CTA_CONNECT: 'Conectar',
  SUB_CONNECTED: 'Conta Muito Mais vinculada a este workspace.',
  LABEL_COMPANY: 'Empresa vinculada',
  LABEL_KEY_MASKED: 'Chave de API',
  CONNECTED_NOTE: 'A chave fica só no servidor. Nunca exibida em texto puro.',
  CTA_DISCONNECT: 'Desconectar',
  CONFIRM_DISCONNECT: 'Desconectar remove o vínculo. Prêmios param de emitir.',
} as const;

type MmIntegrationStatus = {
  connected: boolean;
  mmCompanyId: string | null;
  tradeName: string | null;
  connectedAt: string | null;
  apiKeyLast4: string | null;
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

function maskKey(last4: string | null | undefined) {
  const tail = last4?.trim();
  return tail ? `••••${tail}` : '••••';
}

function StatusBadge(props: { connected: boolean }) {
  return props.connected ? (
    <span className="inline-flex items-center rounded-full bg-[#E8F4FF] px-3 py-1 text-xs font-medium text-opiina-cyan">
      Conectado
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      Desconectado
    </span>
  );
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

  return (
    <div className="grid gap-6">
      <div>
        <nav className="text-sm text-opiina-muted">
          <span>Configurações</span>
          <span className="mx-1.5">›</span>
          <span className="font-medium text-opiina-navy">Integrações</span>
        </nav>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-opiina-navy">Integrações</h1>
        <p className="mt-2 text-sm text-opiina-muted">
          {connected ? COPY.SUB_CONNECTED : COPY.SUB_DISCONNECTED}
        </p>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-base font-semibold text-slate-900">Muito Mais</div>
          <StatusBadge connected={connected} />
        </div>

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
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">{COPY.LABEL_COMPANY}</div>
              <div className="text-base font-semibold text-opiina-navy">
                {row?.tradeName?.trim() || 'Empresa Muito Mais'}
              </div>
            </div>
            <label>
              <div className="mb-1 text-sm font-medium text-slate-700">{COPY.LABEL_KEY_MASKED}</div>
              <Input value={maskKey(row?.apiKeyLast4)} disabled readOnly />
              <div className="mt-1.5 text-xs text-opiina-muted">{COPY.CONNECTED_NOTE}</div>
            </label>
            {formError && <div className="text-sm text-rose-700">{formError}</div>}
            <div>
              <Button
                type="button"
                variant="danger"
                disabled={disconnect.isPending}
                onClick={() => {
                  if (!window.confirm(COPY.CONFIRM_DISCONNECT)) return;
                  disconnect.mutate();
                }}
              >
                {disconnect.isPending ? 'Desconectando...' : COPY.CTA_DISCONNECT}
              </Button>
              <div className="mt-2 text-xs text-opiina-muted">{COPY.CONFIRM_DISCONNECT}</div>
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
              <div className="mb-1 text-sm font-medium text-slate-700">{COPY.FIELD_LABEL}</div>
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={COPY.FIELD_LABEL}
              />
              <div className="mt-1.5 text-xs text-opiina-muted">{COPY.CONNECTED_NOTE}</div>
            </label>
            {formError && <div className="text-sm text-rose-700">{formError}</div>}
            <div>
              <Button type="submit" disabled={connect.isPending}>
                {connect.isPending ? 'Validando...' : COPY.CTA_CONNECT}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
