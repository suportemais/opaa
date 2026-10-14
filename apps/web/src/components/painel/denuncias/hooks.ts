import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { usePode } from '../usePainel';

/** Pessoas que podem ser responsáveis (GET /users/assignable exige feedback:manage). */
export function useResponsaveis() {
  const pode = usePode();
  return useQuery({
    queryKey: ['usersAssignable'],
    queryFn: () => apiFetch<Array<{ id: string; name: string }>>('/users/assignable'),
    enabled: pode('feedback:manage'),
    staleTime: 60_000,
  });
}

/** Invalida lista, detalhe e resumo de denúncias. */
export function useInvalidarDenuncias() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['whistleblower'] }),
      qc.invalidateQueries({ queryKey: ['whistleblowerSummary'] }),
    ]);
  };
}

