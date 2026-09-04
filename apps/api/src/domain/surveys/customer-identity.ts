export type CustomerIdentityInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export function hasCustomerIdentity(
  customer?: CustomerIdentityInput | null,
): boolean {
  if (!customer) return false;
  return (
    (typeof customer.name === 'string' && customer.name.trim().length > 0) ||
    (typeof customer.email === 'string' && customer.email.trim().length > 0) ||
    (typeof customer.phone === 'string' && customer.phone.trim().length > 0)
  );
}

export function isCustomerIdentityRequired(survey: {
  collectCustomer?: boolean | null;
  anonymousAllowed?: boolean | null;
}): boolean {
  return Boolean(survey.collectCustomer) && survey.anonymousAllowed === false;
}
