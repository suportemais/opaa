import { ApiError } from '../../../lib/api';

/** Código de erro devolvido pela API (`{ message: 'codigo' }` do Nest) ou '' quando não há. */
export function codigoDoErro(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: unknown; code?: unknown } | string | null;
    if (body && typeof body === 'object') {
      if (typeof body.code === 'string') return body.code;
      if (typeof body.message === 'string') return body.message;
      if (Array.isArray(body.message)) return 'validation';
    }
  }
  return '';
}

/** Texto da mensagem de erro: usa o mapa de códigos conhecidos, senão o texto padrão. */
export function mensagemDoErro(err: unknown, mapa: Record<string, string>, padrao: string) {
  const codigo = codigoDoErro(err);
  if (codigo && mapa[codigo]) return mapa[codigo];
  if (err instanceof ApiError && err.status === 403) return 'Você não tem permissão para fazer isso.';
  return padrao;
}

/** ids para aria-describedby (dica e erro de um campo). */
export const descr = (id: string, dica?: boolean, erro?: boolean) =>
  [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(' ') || undefined;
