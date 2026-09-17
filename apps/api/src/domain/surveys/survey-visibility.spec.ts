import {
  defaultSurveyListWhere,
  isListedByDefault,
  isPublicSurveyOpen,
  isSoftDeletedSurvey,
} from './survey-visibility';

describe('survey visibility', () => {
  it('excludes archived and soft-deleted surveys from the default list filter', () => {
    expect(defaultSurveyListWhere()).toEqual({
      status: { not: 'archived' },
      deletedAt: null,
    });
  });

  it('hides archived and deleted surveys from the default listing', () => {
    expect(isListedByDefault({ status: 'draft' })).toBe(true);
    expect(isListedByDefault({ status: 'published', deletedAt: null })).toBe(
      true,
    );
    expect(isListedByDefault({ status: 'archived' })).toBe(false);
    expect(
      isListedByDefault({ status: 'published', deletedAt: new Date() }),
    ).toBe(false);
  });

  it('treats deletedAt as a soft-delete and closes public access', () => {
    expect(isSoftDeletedSurvey({ status: 'published' })).toBe(false);
    expect(
      isSoftDeletedSurvey({ status: 'published', deletedAt: '2026-09-17' }),
    ).toBe(true);
    expect(isPublicSurveyOpen({ status: 'published', deletedAt: null })).toBe(
      true,
    );
    expect(isPublicSurveyOpen({ status: 'archived' })).toBe(false);
    expect(
      isPublicSurveyOpen({ status: 'published', deletedAt: new Date() }),
    ).toBe(false);
  });
});
