import {
  hasCustomerIdentity,
  isCustomerIdentityRequired,
} from './customer-identity';

describe('customer identity', () => {
  it('is required only when collecting customer and anonymous is not allowed', () => {
    expect(
      isCustomerIdentityRequired({
        collectCustomer: false,
        anonymousAllowed: false,
      }),
    ).toBe(false);
    expect(
      isCustomerIdentityRequired({
        collectCustomer: true,
        anonymousAllowed: true,
      }),
    ).toBe(false);
    expect(
      isCustomerIdentityRequired({
        collectCustomer: true,
        anonymousAllowed: false,
      }),
    ).toBe(true);
    expect(isCustomerIdentityRequired({ collectCustomer: true })).toBe(false);
  });

  it('accepts any of name, email or phone', () => {
    expect(hasCustomerIdentity(undefined)).toBe(false);
    expect(hasCustomerIdentity({})).toBe(false);
    expect(hasCustomerIdentity({ name: '  ', email: '', phone: null })).toBe(
      false,
    );
    expect(hasCustomerIdentity({ name: 'Ana' })).toBe(true);
    expect(hasCustomerIdentity({ email: 'ana@example.com' })).toBe(true);
    expect(hasCustomerIdentity({ phone: '11999999999' })).toBe(true);
  });
});
