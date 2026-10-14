import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../lib/api';
import { unitCnpjLine } from '../lib/cnpj';
import { Link } from 'react-router-dom';
import { ConfigLayout } from '../components/painel/ConfigTabs';
import { Icone } from '../components/painel/Icone';
import { Situacao } from '../components/painel/config/ui';
import { useAvisar, useConfirmar } from '../components/painel/config/hooks';
import '../styles/painel-config.css';

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
  LABEL_UNIT: 'Unidade',
  MULTI: 'Escolha a unidade antes de gerar',
  MICRO: 'O voucher vincula no Muito Mais pelo CNPJ desta unidade.',
  CTA_GENERATE: 'Gerar voucher',
  CTA_COPY: 'Copiar',
  CTA_CANCEL: 'Cancelar',
  AFTER_GENERATE: 'Copie agora. Cada voucher vale uma vez.',
  EMPTY: 'Nenhum voucher ativo.',
} as const;

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
  unitId?: string | null;
  unitName?: string | null;
  issuer?: { cnpj: string; legalName: string; tradeName: string };
};

type Unit = {
  id: string;
  name: string;
  document: string | null;
  legalName?: string | null;
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
      return 'Cadastre um CNPJ válido nesta unidade para emitir o voucher.';
    case 'unit_required':
      return VOUCHER_COPY.MULTI;
    case 'unit_not_found':
      return 'Unidade não encontrada.';
    case 'invalid_document':
      return 'Informe um CNPJ válido da unidade.';
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

export function IntegrationsPage() {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [avisar, aviso] = useAvisar();
  const [confirmar, janelaConfirmar] = useConfirmar();

  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => apiFetch<Unit[]>('/units'),
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
    mutationFn: (selectedUnitId: string) =>
      apiFetch<AdhesionVoucher>('/mm-vouchers', {
        method: 'POST',
        json: { unitId: selectedUnitId },
      }),
    onSuccess: async () => {
      setVoucherError(null);
      setJustGenerated(true);
      avisar('Voucher gerado');
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
      avisar('Muito Mais conectada');
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
      avisar('Muito Mais desconectada');
      await qc.invalidateQueries({ queryKey: ['integrations-mm'] });
      await qc.invalidateQueries({ queryKey: ['mm-companies'] });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const unitRows = units.data;
  const isMultiUnit = (unitRows?.length ?? 0) > 1;
  const selectedUnit = useMemo(() => {
    const rows = unitRows ?? [];
    return rows.find((item) => item.id === unitId) ?? (rows.length === 1 ? rows[0] : undefined);
  }, [unitRows, unitId]);
  const selectedUnitId = selectedUnit?.id ?? '';
  const selectedHasCnpj = Boolean(selectedUnit?.document?.trim());

  useEffect(() => {
    if (unitRows?.length === 1) setUnitId(unitRows[0].id);
  }, [unitRows]);

  const row = status.data;
  const connected = Boolean(row?.connected);
  const activeVouchers = (vouchers.data ?? []).filter((item) => item.status === 'unused');

  function requestMint() {
    if (isMultiUnit && !selectedUnitId) {
      setVoucherError(VOUCHER_COPY.MULTI);
      return;
    }
    if (!selectedUnitId) {
      setVoucherError(VOUCHER_COPY.MULTI);
      return;
    }
    if (!selectedHasCnpj) {
      setVoucherError('Cadastre um CNPJ válido nesta unidade para emitir o voucher.');
      return;
    }
    mint.mutate(selectedUnitId);
  }

  return (
    <ConfigLayout>
      <div className="cfg__pilha">
        <section className="cartao cfg__cartao" aria-labelledby="t-mm">
          <div className="cfg__topo">
            <div>
              <h2 className="cartao__titulo" id="t-mm">
                Muito Mais{' '}
                {status.data &&
                  (connected ? <Situacao tipo="publicada">Conectado</Situacao> : <Situacao tipo="arquivada">Desconectado</Situacao>)}
              </h2>
              <p className="cartao__sub">{connected ? COPY.SUB_CONNECTED : COPY.SUB_DISCONNECTED}</p>
            </div>
            {status.data && connected && (
              <button
                className="btn btn--perigo"
                type="button"
                disabled={disconnect.isPending}
                onClick={async () => {
                  const ok = await confirmar({
                    titulo: 'Desconectar a Muito Mais?',
                    texto: COPY.CONFIRM_DISCONNECT,
                    botao: 'Desconectar',
                    perigo: true,
                    icone: 'plug',
                  });
                  if (ok) disconnect.mutate();
                }}
              >
                {disconnect.isPending ? 'Desconectando…' : COPY.CTA_DISCONNECT}
              </button>
            )}
          </div>

          {status.isLoading && <p className="mudo">Carregando…</p>}
          {status.isError && (
            <p className="campo__erro" role="alert">
              {status.error instanceof ApiError && status.error.status === 403
                ? 'Você não tem permissão para gerenciar integrações.'
                : 'Falha ao carregar o status da integração.'}
            </p>
          )}

          {status.data && connected && (
            <div className="cfg__grade">
              <div className="cfg__fixo">
                <span className="cfg__fixo-rotulo">{COPY.LABEL_COMPANY}</span>
                <strong>{companyLabel(row?.tradeName)}</strong>
              </div>
              <div className="cfg__fixo">
                <span className="cfg__fixo-rotulo">{COPY.LABEL_KEY_MASKED}</span>
                <strong className="cfg-id">{maskKey(row?.apiKeyLast4)}</strong>
                <span className="campo__dica">{COPY.CONNECTED_NOTE}</span>
              </div>
            </div>
          )}

          {status.data && !connected && (
            <form
              className="cfg__linha"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                setFormError(null);
                if (!apiKey.trim()) {
                  setFormError('Informe a chave de API do Muito Mais.');
                  document.getElementById('mm-chave')?.focus();
                  return;
                }
                connect.mutate();
              }}
            >
              <div className="campo">
                <label htmlFor="mm-chave">{COPY.FIELD_LABEL}</label>
                <input
                  id="mm-chave"
                  type="password"
                  autoComplete="off"
                  aria-invalid={Boolean(formError) || undefined}
                  aria-describedby="mm-chave-dica"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="campo__dica" id="mm-chave-dica">
                  {COPY.CONNECTED_NOTE}
                </p>
              </div>
              <button className="btn btn--primario" type="submit" disabled={connect.isPending}>
                {connect.isPending ? 'Validando…' : COPY.CTA_CONNECT}
              </button>
            </form>
          )}
          {formError && (
            <p className="campo__erro" role="alert">
              {formError}
            </p>
          )}
        </section>

        <section className="cartao cfg__cartao" aria-labelledby="t-voucher">
          <div className="cfg__topo">
            <div>
              <h2 className="cartao__titulo" id="t-voucher">
                {VOUCHER_COPY.TITLE}
              </h2>
              <p className="cartao__sub">{VOUCHER_COPY.MICRO}</p>
            </div>
          </div>

          <div className="cfg__linha">
            {isMultiUnit ? (
              <div className="campo">
                <label htmlFor="mm-unidade">{VOUCHER_COPY.LABEL_UNIT}</label>
                <select
                  id="mm-unidade"
                  value={unitId}
                  onChange={(e) => {
                    setUnitId(e.target.value);
                    setVoucherError(null);
                  }}
                >
                  <option value="">{VOUCHER_COPY.MULTI}</option>
                  {(unitRows ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {unitCnpjLine(item.name, item.document)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="cfg__fixo">
                <span className="cfg__fixo-rotulo">{VOUCHER_COPY.LABEL_UNIT}</span>
                {selectedUnit ? (
                  <strong>{unitCnpjLine(selectedUnit.name, selectedUnit.document)}</strong>
                ) : (
                  <span className="mudo">{units.isLoading ? 'Carregando…' : VOUCHER_COPY.MULTI}</span>
                )}
              </div>
            )}
            <button
              className="btn btn--primario"
              type="button"
              disabled={mint.isPending || units.isLoading || !selectedUnitId || !selectedHasCnpj}
              onClick={() => requestMint()}
            >
              {mint.isPending ? 'Gerando…' : VOUCHER_COPY.CTA_GENERATE}
            </button>
          </div>
          {selectedUnit && !selectedHasCnpj && (
            <p className="campo__dica">
              A unidade {selectedUnit.name} não tem CNPJ. Cadastre em{' '}
              <Link className="link-texto" to="/app/units">
                Unidades
              </Link>{' '}
              e volte aqui.
            </p>
          )}
          {justGenerated && (
            <p className="cfg-info" role="status">
              <Icone nome="alerta" />
              <span>{VOUCHER_COPY.AFTER_GENERATE}</span>
            </p>
          )}
          {voucherError && (
            <p className="campo__erro" role="alert">
              {voucherError}
            </p>
          )}

          {vouchers.data && activeVouchers.length === 0 && <p className="mudo">{VOUCHER_COPY.EMPTY}</p>}
          {activeVouchers.length > 0 && (
            <ul className="cfg-vouchers">
              {activeVouchers.map((item) => (
                <li key={item.id}>
                  <Icone nome="premios" />
                  <span className="cfg-voucher__texto">
                    <strong className="cfg-voucher__codigo">{item.voucher}</strong>
                    {item.issuer && (
                      <small className="mudo">{unitCnpjLine(item.unitName || item.issuer.tradeName, item.issuer.cnpj)}</small>
                    )}
                  </span>
                  <span className="cfg-voucher__acoes">
                    <button
                      className="btn btn--fantasma"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(item.voucher).then(
                          () => avisar('Voucher copiado'),
                          () => avisar('Não foi possível copiar. Selecione o código e copie à mão.'),
                        );
                      }}
                    >
                      {VOUCHER_COPY.CTA_COPY}
                      <span className="visualmente-oculto"> o voucher {item.voucher}</span>
                    </button>
                    <button
                      className="btn btn--perigo"
                      type="button"
                      disabled={cancelVoucher.isPending}
                      onClick={() => cancelVoucher.mutate(item.id)}
                    >
                      {VOUCHER_COPY.CTA_CANCEL}
                      <span className="visualmente-oculto"> o voucher {item.voucher}</span>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {janelaConfirmar}
      {aviso}
    </ConfigLayout>
  );
}
