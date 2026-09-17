export type SurveyVisibilityFields = {
  status: string;
  deletedAt?: Date | string | null;
};

export function isSoftDeletedSurvey(survey: SurveyVisibilityFields): boolean {
  return survey.deletedAt != null;
}

export function defaultSurveyListWhere() {
  return {
    status: { not: 'archived' as const },
    deletedAt: null,
  };
}

export function isListedByDefault(survey: SurveyVisibilityFields): boolean {
  return survey.status !== 'archived' && !isSoftDeletedSurvey(survey);
}

export function isPublicSurveyOpen(survey: SurveyVisibilityFields): boolean {
  return survey.status === 'published' && !isSoftDeletedSurvey(survey);
}
