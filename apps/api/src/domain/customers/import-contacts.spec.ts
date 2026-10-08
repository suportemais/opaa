import {
  CONTACT_IMPORT_HEADERS,
  contactImportTemplateCsv,
  matchImportedUnits,
  parseContactImportRows,
} from './import-contacts';

const units = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Unidade Centro',
    internalCode: 'CTR',
    document: '11222333000181',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Unidade Norte',
    internalCode: null,
    document: null,
  },
];

describe('contact lead import', () => {
  it('keeps the locked template headers', () => {
    expect(CONTACT_IMPORT_HEADERS).toEqual([
      'Nome',
      'E-mail',
      'Telefone',
      'CPF',
      'Unidade',
      'Observações',
    ]);
    expect(contactImportTemplateCsv()).toContain(
      'Nome,E-mail,Telefone,CPF,Unidade,Observações',
    );
    expect(contactImportTemplateCsv()).toContain('Unidade Centro');
  });

  it('accepts Portuguese headers and requires unit plus a contact identifier', () => {
    const parsed = parseContactImportRows([
      {
        Nome: 'Ana',
        'E-mail': 'ana@email.com',
        Telefone: '',
        CPF: '',
        Unidade: 'Unidade Centro',
        Observações: 'Lead feira',
      },
      {
        Nome: 'Sem contato',
        'E-mail': '',
        Telefone: '',
        CPF: '',
        Unidade: 'Centro',
      },
      { Nome: '', 'E-mail': 'x@y.com', Unidade: 'Centro' },
      { Nome: 'Bia', 'E-mail': 'bia@email.com' },
    ]);
    expect(parsed.rows).toEqual([
      {
        lineNumber: 2,
        name: 'Ana',
        email: 'ana@email.com',
        phone: null,
        document: null,
        unitLabel: 'Unidade Centro',
        notes: 'Lead feira',
      },
    ]);
    expect(parsed.errors).toEqual([
      { row: 3, message: 'Informe e-mail, telefone ou CPF' },
      { row: 4, message: 'Nome é obrigatório' },
      { row: 5, message: 'Unidade é obrigatória' },
    ]);
  });

  it('rejects invalid email and short phone', () => {
    const parsed = parseContactImportRows([
      { Nome: 'João', Email: 'nao-email', Unidade: 'Centro' },
      { Nome: 'Lia', Telefone: '123', Unidade: 'Centro' },
    ]);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.map((e) => e.message)).toEqual([
      'E-mail inválido',
      'Telefone inválido',
    ]);
  });

  it('rejects invalid CPF and keeps valid digits', () => {
    const parsed = parseContactImportRows([
      { Nome: 'Pedro', CPF: '12345678901', Unidade: 'Centro' },
      { Nome: 'Carla', CPF: '529.982.247-25', Unidade: 'Unidade Norte' },
    ]);
    expect(parsed.errors).toEqual([{ row: 2, message: 'CPF inválido' }]);
    expect(parsed.rows).toEqual([
      {
        lineNumber: 3,
        name: 'Carla',
        email: null,
        phone: null,
        document: '52998224725',
        unitLabel: 'Unidade Norte',
        notes: null,
      },
    ]);
  });

  it('matches unit by name, code, document or id', () => {
    expect(
      matchImportedUnits('unidade centro', units).map((u) => u.id),
    ).toEqual([units[0].id]);
    expect(matchImportedUnits('CTR', units).map((u) => u.id)).toEqual([
      units[0].id,
    ]);
    expect(
      matchImportedUnits('11.222.333/0001-81', units).map((u) => u.id),
    ).toEqual([units[0].id]);
    expect(matchImportedUnits(units[1].id, units).map((u) => u.id)).toEqual([
      units[1].id,
    ]);
    expect(matchImportedUnits('Inexistente', units)).toEqual([]);
  });
});
