import { normalizeBrDocument } from '../../common/br-document';

export const CONTACT_IMPORT_HEADERS = [
  'Nome',
  'E-mail',
  'Telefone',
  'CPF',
  'Unidade',
  'Observações',
] as const;

export const CONTACT_IMPORT_MAX_ROWS = 2000;

export type ContactImportRow = {
  lineNumber: number;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  unitLabel: string;
  notes: string | null;
};

export type ContactImportRowError = { row: number; message: string };

export type ImportableUnit = {
  id: string;
  name: string;
  internalCode: string | null;
  document: string | null;
};

export function contactImportTemplateCsv() {
  const header = CONTACT_IMPORT_HEADERS.join(',');
  const example = [
    'Maria Silva',
    'maria@email.com',
    '11999999999',
    '',
    'Unidade Centro',
    '',
  ].join(',');
  return `\uFEFF${header}\n${example}\n`;
}

export function cellByAliases(
  raw: Record<string, string>,
  aliases: string[],
): string | null {
  const wanted = aliases.map((a) => a.trim().toLowerCase());
  for (const key of Object.keys(raw)) {
    if (!wanted.includes(key.trim().toLowerCase())) continue;
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function foldLabel(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function digitsOnly(value: string) {
  return value.replace(/\D+/g, '');
}

export function matchImportedUnits(
  label: string,
  units: ImportableUnit[],
): ImportableUnit[] {
  const folded = foldLabel(label);
  if (!folded) return [];
  const digits = digitsOnly(label);
  return units.filter((unit) => {
    if (foldLabel(unit.id) === folded) return true;
    if (foldLabel(unit.name) === folded) return true;
    if (unit.internalCode && foldLabel(unit.internalCode) === folded) {
      return true;
    }
    if (digits.length >= 8 && unit.document) {
      return digitsOnly(unit.document) === digits;
    }
    return false;
  });
}

export function parseContactImportRows(rows: Array<Record<string, string>>): {
  rows: ContactImportRow[];
  errors: ContactImportRowError[];
} {
  if (rows.length > CONTACT_IMPORT_MAX_ROWS) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message: `Limite de ${CONTACT_IMPORT_MAX_ROWS} linhas excedido`,
        },
      ],
    };
  }

  const clean: ContactImportRow[] = [];
  const errors: ContactImportRowError[] = [];

  rows.forEach((raw, idx) => {
    const lineNumber = idx + 2;
    const name = cellByAliases(raw, ['Nome', 'Name', 'name', 'nome']) ?? '';
    const email = cellByAliases(raw, ['E-mail', 'Email', 'e-mail', 'email']);
    const phone = cellByAliases(raw, [
      'Telefone',
      'Phone',
      'Celular',
      'WhatsApp',
      'telefone',
      'phone',
      'celular',
    ]);
    const document = cellByAliases(raw, [
      'CPF',
      'Documento',
      'Document',
      'cpf',
      'documento',
    ]);
    const unitLabel = cellByAliases(raw, [
      'Unidade',
      'Unit',
      'Loja',
      'Filial',
      'unidade',
      'unit',
      'loja',
    ]);
    const notes = cellByAliases(raw, [
      'Observações',
      'Observacoes',
      'Notes',
      'Obs',
      'observações',
      'notes',
    ]);

    if (!name) {
      errors.push({ row: lineNumber, message: 'Nome é obrigatório' });
      return;
    }
    if (name.length > 200) {
      errors.push({ row: lineNumber, message: 'Nome excede 200 caracteres' });
      return;
    }
    if (!unitLabel) {
      errors.push({ row: lineNumber, message: 'Unidade é obrigatória' });
      return;
    }
    if (unitLabel.length > 200) {
      errors.push({
        row: lineNumber,
        message: 'Unidade excede 200 caracteres',
      });
      return;
    }
    if (email && !looksLikeEmail(email)) {
      errors.push({ row: lineNumber, message: 'E-mail inválido' });
      return;
    }
    if (phone && phone.replace(/\D+/g, '').length < 8) {
      errors.push({ row: lineNumber, message: 'Telefone inválido' });
      return;
    }
    if (!email && !phone && !document) {
      errors.push({
        row: lineNumber,
        message: 'Informe e-mail, telefone ou CPF',
      });
      return;
    }
    const parsedDocument = document ? normalizeBrDocument(document) : null;
    if (document && !parsedDocument) {
      errors.push({ row: lineNumber, message: 'CPF inválido' });
      return;
    }
    if (notes && notes.length > 2000) {
      errors.push({
        row: lineNumber,
        message: 'Observações excedem 2000 caracteres',
      });
      return;
    }

    clean.push({
      lineNumber,
      name,
      email: email ?? null,
      phone: phone ?? null,
      document: parsedDocument?.value ?? null,
      unitLabel,
      notes: notes ?? null,
    });
  });

  return { rows: clean, errors };
}
