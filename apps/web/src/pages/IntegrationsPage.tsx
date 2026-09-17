import { useState } from 'react';
import { Link } from 'react-router-dom';
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

const FIELD_CLASS =
  'h-12 w-full rounded-full border border-opiina-border bg-white px-4 text-sm text-opiina-navy shadow-none outline-none placeholder:text-slate-400 focus:border-opiina-cyan focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500';

type MmIntegrationStatus = {
  connected: boolean;
  mmCompanyId: string | null;
  tradeName: string | null;
  connectedAt: string | null;
  apiKeyLast4: string | null;
};

type TenantMe = {
  document: string | null;
};

type AdhesionVoucher = {
  id: string;
  voucher: string;
  status: 'unused' | 'used' | 'cancelled' | 'expired';
  issuer: { cnpj: string; legalName: string; tradeName: string };
  amountCents: number | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
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

function digitsOnly(value: string | null | undefined) {
  return (value ?? '').replace(/\D+/g, '');
}

function hasIssuerCnpj(document: string | null | undefined) {
  return digitsOnly(document).length === 14;
}

function formatCnpj(digits: string) {
  const raw = digitsOnly(digits);
  if (raw.length !== 14) return digits;
  return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatBRL(cents: number | null | undefined) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return 'Somente vínculo';
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function centsFromReais(raw: string) {
  const trimmed = raw.trim().replace(/[R$\s]/g, '');
  if (!trimmed) return null;
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function statusLabel(status: AdhesionVoucher['status']) {
  switch (status) {
    case 'unused':
      return 'Disponível';
    case 'used':
      return 'Usado';
    case 'expired':
      return 'Expirado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
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
  const [amountReais, setAmountReais] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tenant = useQuery({
    queryKey: ['tenantMe'],
    queryFn: () => apiFetch<TenantMe>('/tenant/me'),
  });

  const vouchers = useQuery({
    queryKey: ['mm-vouchers'],
    queryFn: () => apiFetch<AdhesionVoucher[]>('/mm-vouchers'),
  });

  const status = useQuery({
    queryKey: ['integrations-mm'],
    queryFn: () => apiFetch<MmIntegrationStatus>('/integrations/mm'),
  });

  const mint = useMutation({
    mutationFn: () => {
      const amountCents = centsFromReais(amountReais);
      const days = Number(validityDays);
      return apiFetch<AdhesionVoucher>('/mm-vouchers', {
        method: 'POST',
        json: {
          ...(amountCents !== null ? { amountCents } : {}),
          ...(Number.isFinite(days) && days >= 1
            ? { validityDays: Math.min(365, Math.floor(days)) }
            : {}),
        },
      });
    },
    onSuccess: async () => {
      setVoucherError(null);
      setAmountReais('');
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
  const issuerReady = hasIssuerCnpj(tenant.data?.document);

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
          Voucher de 7 dígitos para o cliente aderir no Muito Mais. A chave de API continua opcional
          para Prêmios.
        </p>
      </div>

      <div className="rounded-2xl border border-opiina-border bg-white p-6 shadow-sm">
        <div className="mb-2 text-lg font-semibold text-opiina-navy">Voucher de adesão</div>
        <p className="mb-5 text-sm text-opiina-muted">
          O cliente digita o código no cadastro ou já logado no Muito Mais. A empresa é resolvida
          pelo CNPJ. Uso único, com validade.
        </p>

        {tenant.data && !issuerReady && (
          <div className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Cadastre o CNPJ da empresa para emitir.{' '}
            <Link className="font-medium text-sky-800 underline" to="/app/company">
              Ir para Empresa
            </Link>
          </div>
        )}

        {issuerReady && tenant.data?.document && (
          <div className="mb-5 text-sm text-opiina-muted">
            CNPJ emissor: <span className="font-medium text-opiina-navy">{formatCnpj(tenant.data.document)}</span>
          </div>
        )}

        <form
          className="grid gap-4 md:grid-cols-[1fr_8rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setVoucherError(null);
            mint.mutate();
          }}
        >
          <label>
            <div className="mb-1.5 text-sm font-medium text-slate-700">Valor (opcional)</div>
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={amountReais}
              onChange={(e) => setAmountReais(e.target.value)}
              placeholder="Ex.: 15,00 — vazio = só vínculo"
              disabled={!issuerReady}
            />
          </label>
          <label>
            <div className="mb-1.5 text-sm font-medium text-slate-700">Validade (dias)</div>
            <input
              className={FIELD_CLASS}
              inputMode="numeric"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              disabled={!issuerReady}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={mint.isPending || !issuerReady}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-opiina-cta px-6 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mint.isPending ? 'Gerando...' : 'Gerar voucher'}
            </button>
          </div>
        </form>
        {voucherError && <div className="mt-3 text-sm text-rose-700">{voucherError}</div>}

        <div className="mt-6 overflow-x-auto">
          {vouchers.isLoading && <div className="text-sm text-opiina-muted">Carregando vouchers...</div>}
          {vouchers.data && vouchers.data.length === 0 && (
            <div className="text-sm text-opiina-muted">Nenhum voucher emitido ainda.</div>
          )}
          {vouchers.data && vouchers.data.length > 0 && (
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Código</th>
                  <th className="pb-2 pr-4 font-medium">Valor</th>
                  <th className="pb-2 pr-4 font-medium">Validade</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {vouchers.data.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-3 pr-4 font-mono text-base font-semibold tracking-wider text-opiina-navy">
                      {item.voucher}
                    </td>
                    <td className="py-3 pr-4 text-opiina-muted">{formatBRL(item.amountCents)}</td>
                    <td className="py-3 pr-4 text-opiina-muted">
                      {new Date(item.expiresAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 pr-4">{statusLabel(item.status)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-opiina-border px-3 py-1.5 text-xs font-medium text-opiina-navy hover:bg-slate-50"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(item.voucher);
                              setCopiedId(item.id);
                            } catch {
                              setVoucherError('Não foi possível copiar o código.');
                            }
                          }}
                        >
                          {copiedId === item.id ? 'Copiado' : 'Copiar'}
                        </button>
                        {item.status === 'unused' && (
                          <button
                            type="button"
                            disabled={cancelVoucher.isPending}
                            className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            onClick={() => cancelVoucher.mutate(item.id)}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-opiina-border bg-white p-6 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <div className="text-lg font-semibold text-opiina-navy">Chave de API (opcional)</div>
          <StatusBadge connected={connected} />
        </div>
        <p className="mb-6 text-sm text-opiina-muted">
          {connected ? COPY.SUB_CONNECTED : COPY.SUB_DISCONNECTED} Necessária só para Prêmios
          automaticamente. O voucher de adesão não usa esta chave.
        </p>

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
    </div>
  );
}
