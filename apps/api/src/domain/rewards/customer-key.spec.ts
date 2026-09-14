import {
  normalizeRewardCpf,
  normalizeRewardPhone,
  resolveCustomerKey,
} from './customer-key';

describe('customerKey normalization', () => {
  it('prefers phone over CPF and prefixes BR country code', () => {
    const resolved = resolveCustomerKey({
      phone: '(11) 98888-7777',
      document: '390.533.447-05',
    });
    expect(resolved).toEqual({
      kind: 'phone',
      value: '5511988887777',
      key: 'phone:5511988887777',
    });
  });

  it('uses CPF when phone is missing or unusable', () => {
    expect(resolveCustomerKey({ document: '390.533.447-05' })).toEqual({
      kind: 'cpf',
      value: '39053344705',
      key: 'cpf:39053344705',
    });
    expect(
      resolveCustomerKey({ phone: 'abc', document: '39053344705' })?.kind,
    ).toBe('cpf');
  });

  it('rejects invalid identifiers', () => {
    expect(normalizeRewardPhone('123')).toBeNull();
    expect(normalizeRewardCpf('111.111.111-11')).toBeNull();
    expect(resolveCustomerKey({ phone: null, document: '12' })).toBeNull();
  });

  it('keeps an already internationalized phone', () => {
    expect(normalizeRewardPhone('+55 11 98888-7777')).toBe('5511988887777');
  });
});
