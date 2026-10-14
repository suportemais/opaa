import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../../../lib/api';
import type { CustomerExtras, CustomerSource } from '../../../lib/api-novos';
import { useAuthMe } from '../usePainel';

export type Unidade = { id: string; name: string };

/** Cliente como vem de GET /customers e GET /customers/:id. */
export type Cliente = CustomerExtras & {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  originUnitId: string | null;
  originUnit: Unidade | null;
  firstInteractionAt: string | null;
  lastInteractionAt: string | null;
  totalResponses?: number | null;
  satisfactionAvg?: number | null;
  lastNpsScore?: number | null;
  npsClass?: string | null;
  doNotContact?: boolean;
  doNotContactAt?: string | null;
  doNotContactReason?: string | null;
  tags?: unknown;
  notes?: string | null;
  createdAt: string;
};

export type RespostaCliente = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  npsScore: number | null;
  npsClass: string | null;
  mainComment: string | null;
  survey: { id: string; name: string };
  unit: Unidade | null;
};

export type OcorrenciaCliente = {
  id: string;
  status: string;
  priority: string;
  updatedAt: string;
  createdAt: string;
  description: string | null;
  unit: Unidade | null;
  surveyResponse: { id: string; npsScore: number | null; npsClass: string | null };
};

export type ResultadoImportacao = {
  imported: number;
  created?: number;
  updated?: number;
  total?: number;
  errors?: Array<{ row: number; message: string }>;
};

/** Escala NPS do app: 1–10. 1–6 detrator, 7–8 neutro, 9–10 promotor. */
export function categoriaNota(nota: number) {
  if (nota <= 6) return 'detrator';
  if (nota <= 8) return 'passivo';
  return 'promotor';
}

export const ORIGEM_ROTULO: Record<CustomerSource, string> = {
  survey: 'Pela pesquisa',
  import: 'Por planilha',
  manual: 'Cadastro manual',
};

export function origemTexto(source: CustomerSource | null | undefined) {
  if (source === 'survey') return 'Cadastrou-se ao responder uma pesquisa';
  if (source === 'import') return 'Entrou por planilha importada';
  if (source === 'manual') return 'Cadastrado manualmente pela equipe';
  return 'Origem não registrada';
}

export function nomeDoMes(mes1a12: number) {
  return new Date(2000, mes1a12 - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
}

/** birthDate vem como ISO (data à meia-noite UTC). Usa só a parte da data. */
export function dataIso(valor: string | null | undefined) {
  return valor ? valor.slice(0, 10) : '';
}

export function mesNascimento(birthDate: string | null | undefined) {
  const iso = dataIso(birthDate);
  return iso ? Number(iso.slice(5, 7)) : null;
}

export function aniversario(birthDate: string | null | undefined) {
  const iso = dataIso(birthDate);
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : null;
}

export function nascimentoBr(birthDate: string | null | undefined) {
  const iso = dataIso(birthDate);
  return iso ? iso.split('-').reverse().join('/') : '';
}

export function dataHora(valor: string | null | undefined) {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

export function dataCurta(valor: string | null | undefined) {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

/** "hoje", "ontem", "há 3 dias"; acima de 60 dias, a data. */
export function quando(valor: string | null | undefined) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje.getTime() - dia.getTime()) / 864e5);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias <= 60) return `há ${dias} dias`;
  return `em ${d.toLocaleDateString('pt-BR')}`;
}

export function ofertasTexto(v: boolean | null | undefined) {
  if (v === true) return 'sim';
  if (v === false) return 'não';
  return '';
}

export const soDigitos = (t: string) => t.replace(/\D/g, '');

export function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Mensagem amigável para os erros da API de clientes. */
export function erroCliente(err: unknown, padrao = 'Não foi possível salvar.') {
  if (err instanceof ApiError && err.status === 403) return 'Você não tem permissão para isso.';
  const body = err instanceof ApiError ? err.body : null;
  const obj = body && typeof body === 'object' ? (body as { message?: unknown; code?: unknown }) : null;
  const codigo = String(obj?.code ?? (Array.isArray(obj?.message) ? obj?.message[0] : obj?.message) ?? '');
  switch (codigo) {
    case 'invalid_birth_date':
      return 'Data de nascimento inválida.';
    case 'invalid_name':
      return 'Informe o nome.';
    case 'origin_unit_required':
      return 'Escolha a unidade do cliente.';
    case 'unit_not_found':
    case 'invalid_origin_unit':
      return 'Você não tem acesso a essa unidade.';
    case 'customer_exists':
      return 'Já existe um cliente com esse WhatsApp ou e-mail.';
    case 'missing_file':
      return 'Selecione um arquivo CSV.';
    case 'empty_file':
      return 'O arquivo está vazio.';
    case 'invalid_csv':
      return 'Não foi possível ler o arquivo. Confira se é um CSV.';
    default:
      if (codigo.includes('email')) return 'Confira o e-mail.';
      return codigo && !codigo.includes(' ') ? padrao : codigo || padrao;
  }
}

/** Planilha CSV com ";" e BOM: o Excel em português abre com colunas e acentos certos. */
export function baixarCsv(nome: string, linhas: Array<Array<string | number | null | undefined>>) {
  const texto =
    '﻿' + linhas.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escHtml = (v: unknown) =>
  String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** "PDF": abre uma página de impressão (o navegador salva em PDF). */
export function imprimirTabela(
  titulo: string,
  cabecalho: string[],
  linhas: Array<Array<string | number | null | undefined>>,
  /** janela já aberta no clique (evita bloqueio de pop-up quando os dados chegam depois) */
  janela?: Window | null,
) {
  const w = janela === undefined ? window.open('', '_blank') : janela;
  if (!w) return false;
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(titulo)}</title>
  <style>
    body { font-family: Montserrat, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; color: #0a1a33; }
    h1 { font-size: 18px; margin: 0 0 12px; }
    .meta { font-size: 12px; color: #51627f; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px; text-align: left; vertical-align: top; }
    th { color: #51627f; font-weight: 600; }
  </style>
</head>
<body>
  <h1>${escHtml(titulo)}</h1>
  <div class="meta">Exportado em ${escHtml(new Date().toLocaleString('pt-BR'))} · ${linhas.length} registro(s)</div>
  <table>
    <thead><tr>${cabecalho.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map((l) => `<tr>${l.map((v) => `<td>${escHtml(v === '' ? '—' : v)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
</body>
</html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

/** Unidades que o usuário pode escolher (todas com unit:manage; senão, só as dele). */
export function useUnidadesPermitidas() {
  const me = useAuthMe();
  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unidade[]>('/units') });
  const codes = me.data?.permissionCodes ?? [];
  const unitIds = (me.data as { unitIds?: string[] } | undefined)?.unitIds;
  const todas = codes.includes('unit:manage');
  const lista = useMemo<Unidade[]>(() => {
    if (!units.data) return [];
    if (todas) return units.data;
    const ok = new Set(unitIds ?? []);
    return units.data.filter((u) => ok.has(u.id));
  }, [units.data, todas, unitIds]);
  return { unidades: lista, carregando: units.isLoading, todas };
}

/** Colunas aceitas por POST /customers/import (Nascimento e "Aceita ofertas" são opcionais). */
export const COLUNAS_IMPORTACAO = ['Nome', 'E-mail', 'Telefone', 'CPF', 'Unidade', 'Nascimento', 'Aceita ofertas', 'Observações'] as const;

export function baixarModeloImportacao() {
  const exemplo = ['Maria Silva', 'maria@email.com', '11999999999', '', 'Unidade Centro', '25/12/1990', 'sim', ''];
  const csv = `﻿${COLUNAS_IMPORTACAO.join(',')}\n${exemplo.join(',')}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'modelo-clientes.csv' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
