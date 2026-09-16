import {
  assertSurveyUpdateAllowed,
  isIdentitySettingsOnlyUpdate,
} from './survey-update';

describe('survey update rules', () => {
  it('treats collect/anonymous/employee flags as identity-only when no structural fields are present', () => {
    expect(
      isIdentitySettingsOnlyUpdate({
        collectCustomer: true,
        anonymousAllowed: false,
        collectEmployee: true,
      }),
    ).toBe(true);
    expect(isIdentitySettingsOnlyUpdate({ collectCustomer: false })).toBe(true);
    expect(
      isIdentitySettingsOnlyUpdate({ name: 'X', collectCustomer: true }),
    ).toBe(false);
    expect(
      isIdentitySettingsOnlyUpdate({
        questions: [{ type: 'nps' }],
        collectCustomer: true,
      }),
    ).toBe(false);
    expect(isIdentitySettingsOnlyUpdate({ name: 'X' })).toBe(false);
    expect(isIdentitySettingsOnlyUpdate({})).toBe(false);
  });

  it('allows full edits on drafts and identity-only edits on published surveys', () => {
    expect(
      assertSurveyUpdateAllowed('draft', {
        name: 'Pesquisa',
        questions: [{ type: 'nps' }],
      }),
    ).toEqual({ ok: true });
    expect(
      assertSurveyUpdateAllowed('published', {
        collectCustomer: true,
        anonymousAllowed: false,
        collectEmployee: false,
      }),
    ).toEqual({ ok: true });
    expect(
      assertSurveyUpdateAllowed('published', {
        name: 'Novo nome',
      }),
    ).toEqual({ ok: false, code: 'only_draft_editable' });
    expect(
      assertSurveyUpdateAllowed('published', {
        collectCustomer: true,
        questions: [{ type: 'nps' }],
      }),
    ).toEqual({ ok: false, code: 'only_draft_editable' });
    expect(
      assertSurveyUpdateAllowed('archived', {
        collectCustomer: true,
      }),
    ).toEqual({ ok: false, code: 'only_draft_editable' });
  });
});
