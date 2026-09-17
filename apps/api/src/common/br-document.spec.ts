import { formatCnpj, normalizeCnpj, normalizeBrDocument } from './br-document';

describe('br-document CNPJ helpers', () => {
  it('normalizes a formatted CNPJ and rejects CPF', () => {
    expect(normalizeCnpj('33.000.167/0001-01')).toBe('33000167000101');
    expect(normalizeCnpj('390.533.447-05')).toBeNull();
    expect(normalizeBrDocument('390.533.447-05')?.type).toBe('cpf');
  });

  it('formats 14-digit CNPJ', () => {
    expect(formatCnpj('33000167000101')).toBe('33.000.167/0001-01');
  });
});
