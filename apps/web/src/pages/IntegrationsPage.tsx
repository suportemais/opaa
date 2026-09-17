import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../lib/api';

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

const VOUCHER_COPY = {
  TITLE: 'Voucher Muito Mais',
  MICRO: 'Gere um código de 7 dígitos pra o cliente vincular no Muito Mais.',
  CTA_GENERATE: 'Gerar voucher',
  CTA_COPY: 'Copiar',
  CTA_CANCEL: 'Cancelar',
  AFTER_GENERATE: 'Copie agora. Cada voucher vale uma vez.',
  EMPTY: 'Nenhum voucher ativo.',
} as const;

const FIELD_CLASS =
  'h-12 w-full rounded-full border border-opiina-border bg-white px-4 text-sm text-opiina-navy shadow-none outline-none placeholder:text-slate-400 focus:border-opiina-cyan focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500';

type MmIntegrationStatus = {
  connected: boolean;
  mmCompanyId: string | null;
  tradeName: string | null;
  connectedAt: string | null;
  apiKeyLast4: string | null;
};

type AdhesionVoucher = {
  id: string;
  voucher: string;
  status: 'unused' | 'used' | 'cancelled' | 'expired';
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
    case 'issuer_cnpj_required':
      return 'Cadastre um CNPJ válido em Empresa para emitir o voucher.';
    case 'voucher_already_used':
      return 'Este voucher já foi usado e não pode ser cancelado.';
    case 'voucher_expired':
      return 'Este voucher já expirou.';
    default:
      return 'Não foi possível concluir a operação.';
  }
}

function maskKey(last4: string | null | undefined) {
  const tail = last4?.trim();
  return tail ? `••••${tail}` : '••••';
}

function companyLabel(tradeName: string | null | undefined) {
  const name = tradeName?.trim();
  return name ? `${name} — MM` : 'Empresa Muito Mais';
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
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);

  const vouchers = useQuery({
    queryKey: ['mm-vouchers'],
    queryFn: () => apiFetch<AdhesionVoucher[]>('/mm-vouchers'),
  });

  const status = useQuery({
    queryKey: ['integrations-mm'],
    queryFn: () => apiFetch<MmIntegrationStatus>('/integrations/mm'),
  });

  const mint = useMutation({
    mutationFn: () => apiFetch<AdhesionVoucher>('/mm-vouchers', { method: 'POST', json: {} }),
    onSuccess: async () => {
      setVoucherError(null);
      setJustGenerated(true);
      await qc.invalidateQueries({ queryKey: ['mm-vouchers'] });
    },
    onError: (err) => setVoucherError(errorMessage(err)),
  });

  const cancelVoucher = useMutation({
    mutationFn: (id: string) =>
      apiFetch<AdhesionVoucher>(`/mm-vouchers/${id}/cancel`, { method: 'POST' }),
    onSuccess: async () => {
      setVoucherError(null);
      await qc.invalidateQueries({ queryKey: ['mm-vouchers'] });
    },
    onError: (err) => setVoucherError(errorMessage(err)),
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
  const activeVouchers = (vouchers.data ?? []).filter((item) => item.status === 'unused');

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

      <div className="rounded-2xl border border-opiina-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center gap-2.5">
          <div className="text-lg font-semibold text-opiina-navy">Muito Mais</div>
          <StatusBadge connected={connected} />
        </div>

        {status.isLoading && <div className="text-sm text-opiina-muted">Carregando...</div>}
        {status.isError && (
          <div className="text-sm text-rose-700">
            {status.error instanceof ApiError && status.error.status === 403
              ? 'Você não tem permissão para gerenciar integrações.'
              : 'Falha ao carregar o status da integração.'}
          </div>
        )}

        {status.data && connected && (
          <div className="grid gap-5">
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">{COPY.LABEL_COMPANY}</div>
              <div className="text-xl font-semibold tracking-tight text-opiina-navy">
                {companyLabel(row?.tradeName)}
              </div>
            </div>
            <label>
              <div className="mb-1.5 text-sm font-medium text-slate-700">{COPY.LABEL_KEY_MASKED}</div>
              <input
                className={FIELD_CLASS}
                value={maskKey(row?.apiKeyLast4)}
                disabled
                readOnly
              />
              <div className="mt-2 text-xs text-opiina-muted">{COPY.CONNECTED_NOTE}</div>
            </label>
            {formError && <div className="text-sm text-rose-700">{formError}</div>}
            <div>
              <button
                type="button"
                disabled={disconnect.isPending}
                className="inline-flex h-12 w-full items-center justify-center rounded-full border border-rose-500 bg-white text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                onClick={() => {
                  if (!window.confirm(COPY.CONFIRM_DISCONNECT)) return;
                  disconnect.mutate();
                }}
              >
                {disconnect.isPending ? 'Desconectando...' : COPY.CTA_DISCONNECT}
              </button>
              <div className="mt-2 text-xs text-opiina-muted">{COPY.CONFIRM_DISCONNECT}</div>
            </div>
          </div>
        )}

        {status.data && !connected && (
          <form
            className="grid gap-5"
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
              <div className="mb-1.5 text-sm font-medium text-slate-700">{COPY.FIELD_LABEL}</div>
              <input
                type="password"
                autoComplete="off"
                className={FIELD_CLASS}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={COPY.FIELD_LABEL}
              />
              <div className="mt-2 text-xs text-opiina-muted">{COPY.CONNECTED_NOTE}</div>
            </label>
            {formError && <div className="text-sm text-rose-700">{formError}</div>}
            <button
              type="submit"
              disabled={connect.isPending}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-opiina-cta text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {connect.isPending ? 'Validando...' : COPY.CTA_CONNECT}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-opiina-border bg-white p-6 shadow-sm">
        <div className="mb-2 text-lg font-semibold text-opiina-navy">{VOUCHER_COPY.TITLE}</div>
        <p className="mb-5 text-sm text-opiina-muted">{VOUCHER_COPY.MICRO}</p>

        <button
          type="button"
          disabled={mint.isPending}
          className="inline-flex h-12 items-center justify-center rounded-full bg-opiina-cta px-6 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => mint.mutate()}
        >
          {VOUCHER_COPY.CTA_GENERATE}
        </button>
        {justGenerated && (
          <div className="mt-3 text-sm text-opiina-navy">{VOUCHER_COPY.AFTER_GENERATE}</div>
        )}
        {voucherError && <div className="mt-3 text-sm text-rose-700">{voucherError}</div>}

        <div className="mt-6">
          {vouchers.data && activeVouchers.length === 0 && (
            <div className="text-sm text-opiina-muted">{VOUCHER_COPY.EMPTY}</div>
          )}
          {activeVouchers.length > 0 && (
            <ul className="grid gap-3">
              {activeVouchers.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0"
                >
                  <span className="font-mono text-base font-semibold tracking-wider text-opiina-navy">
                    {item.voucher}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-opiina-border px-3 py-1.5 text-xs font-medium text-opiina-navy hover:bg-slate-50"
                      onClick={() => {
                        void navigator.clipboard.writeText(item.voucher);
                      }}
                    >
                      {VOUCHER_COPY.CTA_COPY}
                    </button>
                    <button
                      type="button"
                      disabled={cancelVoucher.isPending}
                      className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      onClick={() => cancelVoucher.mutate(item.id)}
                    >
                      {VOUCHER_COPY.CTA_CANCEL}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
