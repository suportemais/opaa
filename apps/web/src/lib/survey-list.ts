/** Default listing = active surveys only (not archived; deleted never leave the API). */
export function isActiveSurvey(survey: { status: string }) {
  return survey.status !== 'archived';
}
