import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import type { AssignableUser } from '../../../lib/api-novos';
import type { FeedbackDetalhe } from './comum';

/** Campos que a gaveta/detalhe podem alterar (só os que mudaram são enviados). */
export type MudancasCaso = {
  status?: string;
  priority?: string;
  dueAt?: string | null;
  assigneeUserId?: string | null;
  rootCause?: string;
  correctiveAction?: string;
  resolution?: string;
};

export function useDetalheFeedback(id: string | null) {
  return useQuery({
    queryKey: ['feedback', id],
    queryFn: () => apiFetch<FeedbackDetalhe>(`/feedbacks/${id}`),
    enabled: Boolean(id),
  });
}

export function useResponsaveis(habilitado: boolean) {
  return useQuery({
    queryKey: ['usersAssignable'],
    queryFn: () => apiFetch<AssignableUser[]>('/users/assignable'),
    enabled: habilitado,
    staleTime: 5 * 60 * 1000,
  });
}

/** Mutações do tratamento de um feedback; invalidam lista, Kanban, detalhe e contadores. */
export function useTratamento(id: string) {
  const qc = useQueryClient();
  const atualizarTudo = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['feedback', id] }),
      qc.invalidateQueries({ queryKey: ['feedbacks'] }),
      qc.invalidateQueries({ queryKey: ['kanban'] }),
      qc.invalidateQueries({ queryKey: ['metrics', 'casesSummary'] }),
      qc.invalidateQueries({ queryKey: ['shellCasesSummary'] }),
    ]);
  };

  const salvar = useMutation({
    mutationFn: async (p: { mudancas: MudancasCaso; anotacao?: string }) => {
      if (Object.keys(p.mudancas).length) {
        await apiFetch(`/feedbacks/${id}/case`, { method: 'PATCH', json: p.mudancas });
      }
      const texto = p.anotacao?.trim();
      if (texto) {
        await apiFetch(`/feedbacks/${id}/case/notes`, { method: 'POST', json: { text: texto.slice(0, 2000) } });
      }
    },
    onSettled: atualizarTudo,
  });

  const atribuirAMim = useMutation({
    mutationFn: () => apiFetch(`/feedbacks/${id}/case/assign-me`, { method: 'POST' }),
    onSettled: atualizarTudo,
  });

  const criarOcorrencia = useMutation({
    mutationFn: () => apiFetch(`/feedbacks/${id}/case`, { method: 'POST' }),
    onSettled: atualizarTudo,
  });

  return { salvar, atribuirAMim, criarOcorrencia };
}
