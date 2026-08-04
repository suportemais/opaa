import { env } from './env';
import { getAccessToken, setAccessToken } from './auth-store';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(typeof body === 'string' ? body : 'ApiError');
    this.status = status;
    this.body = body;
  }
}

async function readErrorBody(res: Response) {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return await res.text();
    }
  }
  return await res.text();
}

async function tryRefreshToken() {
  const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string | null };
  if (data.accessToken) setAccessToken(data.accessToken);
  return data.accessToken;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      const retry = await fetch(`${env.apiBaseUrl}${path}`, {
        ...init,
        headers,
        credentials: 'include',
        body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      });
      if (retry.ok) return (await retry.json()) as T;
      const body = await readErrorBody(retry);
      throw new ApiError(retry.status, body);
    }
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
