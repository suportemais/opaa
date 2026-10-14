import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../../lib/api';
import { Icone } from '../Icone';
import type { DenunciaDetalhe } from './comum';
import { SeloPrioridade, SeloSituacao } from './Selos';
import { DadosDenuncia } from './DadosDenuncia';
import { GestaoForm, HistoricoDenuncia } from './GestaoDenuncia';

/** Detalhe da denúncia numa gaveta à direita (<dialog> nativo, como no protótipo). */
export function DenunciaGaveta({
  id,
  onFechar,
  avisar,
}: {
  id: string | null;
  onFechar: () => void;
  avisar: (t: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const detalhe = useQuery({
    queryKey: ['whistleblower', id],
    queryFn: () => apiFetch<DenunciaDetalhe>(`/whistleblower/${id}`),
    enabled: Boolean(id),
  });

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (id && !dlg.open) dlg.showModal();
    if (!id && dlg.open) dlg.close();
  }, [id]);

  const d = detalhe.data && detalhe.data.id === id ? detalhe.data : null;

  const carregadaId = d?.id;
  useEffect(() => {
    if (carregadaId) tituloRef.current?.focus();
  }, [carregadaId]);

  const fechar = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="gaveta gaveta--larga"
      aria-labelledby="dg-titulo"
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === e.currentTarget) fechar();
      }}
    >
      <div className="gaveta__corpo">
        <div className="gaveta__topo">
          <span className="gaveta__id">
            <span className="visualmente-oculto">Protocolo </span>
            {d?.protocol ?? ''}
          </span>
          <button className="botao-icone" type="button" aria-label="Fechar" onClick={fechar}>
            <Icone nome="fechar" />
          </button>
        </div>

        {detalhe.isLoading && <p className="campo__dica">Carregando…</p>}
        {detalhe.isError && (
          <p className="cli__erro cli__erro--geral" role="alert">
            Não foi possível carregar a denúncia.
          </p>
        )}

        {d && (
          <>
            <div className="den-titulo">
              <div className="den-titulo__selos">
                <SeloPrioridade priority={d.priority} />
                <SeloSituacao status={d.status} />
              </div>
              <h2 id="dg-titulo" tabIndex={-1} ref={tituloRef}>
                {d.title}
              </h2>
            </div>

            <DadosDenuncia d={d} relatoId="dg-relato" />

            <GestaoForm
              denuncia={d}
              onSalvo={(mudou) => {
                fechar();
                if (mudou) avisar(`${d.protocol} atualizada`);
              }}
              acoesExtras={
                <button className="btn btn--secundario" type="button" onClick={fechar}>
                  Cancelar
                </button>
              }
            />

            <HistoricoDenuncia eventos={d.events} tituloId="dg-historico" />

            <Link className="btn btn--fantasma den-abrir" to={`/app/whistleblower/${d.id}`}>
              <Icone nome="seta" />
              Abrir página completa (comentários, token e protocolo)
            </Link>
          </>
        )}
      </div>
    </dialog>
  );
}
