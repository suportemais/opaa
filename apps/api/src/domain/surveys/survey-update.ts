export type SurveyUpdateFields = {
  name?: unknown;
  description?: unknown;
  unitIds?: unknown;
  questions?: unknown;
  collectCustomer?: unknown;
  anonymousAllowed?: unknown;
  collectEmployee?: unknown;
};

export function isIdentitySettingsOnlyUpdate(dto: SurveyUpdateFields): boolean {
  const hasIdentity =
    dto.collectCustomer !== undefined ||
    dto.anonymousAllowed !== undefined ||
    dto.collectEmployee !== undefined;
  const hasStructural =
    dto.name !== undefined ||
    dto.description !== undefined ||
    dto.unitIds !== undefined ||
    dto.questions !== undefined;
  return hasIdentity && !hasStructural;
}

export function assertSurveyUpdateAllowed(
  status: string,
  dto: SurveyUpdateFields,
): { ok: true } | { ok: false; code: 'only_draft_editable' } {
  if (status === 'draft') return { ok: true };
  if (status === 'published' && isIdentitySettingsOnlyUpdate(dto)) {
    return { ok: true };
  }
  return { ok: false, code: 'only_draft_editable' };
}
