import {
  CONTACT_IMPORT_HEADERS,
  contactImportTemplateCsv,
  parseContactImportRows,
} from './import-contacts';

describe('contact lead import', () => {
  it('keeps the locked template headers', () => {
    expect(CONTACT_IMPORT_HEADERS).toEqual([
      'Nome',
      'E-mail',
      'Telefone',
      'CPF',
      'Observações',
    ]);
    expect(contactImportTemplateCsv()).toContain(
      'Nome,E-mail,Telefone,CPF,Observações',
    );
    expect(contactImportTemplateCsv()).toContain('Maria Silva');
  });

  it('accepts Portuguese headers and requires a contact identifier', () => {
    const parsed = parseContactImportRows([
      {
        Nome: 'Ana',
        'E-mail': 'ana@email.com',
        Telefone: '',
        CPF: '',
        Observações: 'Lead feira',
      },
      { Nome: 'Sem contato', 'E-mail': '', Telefone: '', CPF: '' },
      { Nome: '', 'E-mail': 'x@y.com' },
    ]);
    expect(parsed.rows).toEqual([
      {
        lineNumber: 2,
        name: 'Ana',
        email: 'ana@email.com',
        phone: null,
        document: null,
        notes: 'Lead feira',
      },
    ]);
    expect(parsed.errors).toEqual([
      { row: 3, message: 'Informe e-mail, telefone ou CPF' },
      { row: 4, message: 'Nome é obrigatório' },
    ]);
  });

  it('rejects invalid email and short phone', () => {
    const parsed = parseContactImportRows([
      { Nome: 'João', Email: 'nao-email' },
      { Nome: 'Lia', Telefone: '123' },
    ]);
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors.map((e) => e.message)).toEqual([
      'E-mail inválido',
      'Telefone inválido',
    ]);
  });

  it('rejects invalid CPF and keeps valid digits', () => {
    const parsed = parseContactImportRows([
      { Nome: 'Pedro', CPF: '12345678901' },
      { Nome: 'Carla', CPF: '529.982.247-25' },
    ]);
    expect(parsed.errors).toEqual([{ row: 2, message: 'CPF inválido' }]);
    expect(parsed.rows).toEqual([
      {
        lineNumber: 3,
        name: 'Carla',
        email: null,
        phone: null,
        document: '52998224725',
        notes: null,
      },
    ]);
  });
});
