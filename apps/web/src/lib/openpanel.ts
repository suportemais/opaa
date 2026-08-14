import { OpenPanel } from '@openpanel/web';

export const op = new OpenPanel({
  apiUrl: 'https://dashboard.suportemais.net/api',
  clientId: 'aceb95ac-3ecf-4e17-b82a-4da2cddb1c97',
  trackScreenViews: true,
  trackOutgoingLinks: true,
  trackAttributes: true,
});
