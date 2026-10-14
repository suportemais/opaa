import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { Icone } from '../components/painel/Icone';
import {
  dataHora,
  type DenunciaDetalhe,
} from '../components/painel/denuncias/comum';
import { SeloIdent, SeloPrioridade, SeloSituacao } from '../components/painel/denuncias/Selos';
import { useAviso } from '../components/painel/denuncias/useAviso';
import { DadosDenuncia } from '../components/painel/denuncias/DadosDenuncia';
import { GestaoForm, HistoricoDenuncia } from '../components/painel/denuncias/GestaoDenuncia';
import { useInvalidarDenuncias } from '../components/painel/denuncias/hooks';
import '../styles/painel-denuncias.css';

export function DenunciaDetailPage() {
  const params = useParams();
  const id = params.id ?? '';
  const invalidar = useInvalidarDenuncias();
  const { avisar, elemento: aviso } = useAviso();
  const [comentario, setComentario] = useState('');

  const detalhe = useQuery({
    queryKey: ['whistleblower', id],
    queryFn: () => apiFetch<DenunciaDetalhe>(`/whistleblower/${id}`),
    enabled: Boolean(id),
  });

  const comentar = useMutation({
    mutationFn: () =>
      apiFetch(`/whistleblower/${id}/events`, { method: 'POST', json: { notes: comentario.trim() } }),
    onSuccess: async () => {
      setComentario('');
      await invalidar();
      avisar('Comentário adicionado');
    },
  });

  const d = detalhe.data;

  return (
    <>
      <Link className="btn btn--fantasma den-voltar" to="/app/whistleblower">
        <Icone nome="seta" className="den-voltar__icone" />
        Voltar para denúncias
      </Link>

      <div className="cabeca">
        <div>
          <p className="gaveta__id">
            <span className="visualmente-oculto">Protocolo </span>
            {d?.protocol ?? '…'}
          </p>
          <h1 className="cabeca__titulo">{d?.title ?? 'Denúncia'}</h1>
          {d && <p className="cabeca__desc">Recebida em {dataHora(d.createdAt)}</p>}
        </div>
        {d && (
          <div className="den-titulo__selos">
            <SeloPrioridade priority={d.priority} />
            <SeloSituacao status={d.status} />
            <SeloIdent anonima={d.reporterAnonymous} />
          </div>
        )}
      </div>

      <p className="den-sigilo">
        <Icone nome="cadeado" />
        <span>
          <strong>Confidencial.</strong> Não compartilhe este relato fora da equipe responsável.
        </span>
      </p>

      {detalhe.isLoading && <p className="vazio">Carregando…</p>}
      {detalhe.isError && (
        <p className="cli__erro cli__erro--geral" role="alert">
          Falha ao carregar detalhes.
        </p>
      )}

      {d && (
        <div className="den-detalhe">
          <div className="den-detalhe__principal">
            <section className="cartao den-cartao" aria-label="Conteúdo da denúncia">
              <DadosDenuncia d={d} relatoId="dd-relato" />
            </section>

            <section className="cartao den-cartao" aria-labelledby="dd-historico">
              <HistoricoDenuncia eventos={d.events} tituloId="dd-historico" />
              <form
                className="gaveta__form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comentario.trim()) comentar.mutate();
                }}
              >
                <div className="campo">
                  <label htmlFor="dd-comentario">Adicionar comentário</label>
                  <textarea
                    id="dd-comentario"
                    aria-describedby="dd-comentario-dica"
                    placeholder="Observações internas (não é visível ao denunciante)"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                  />
                  <p className="campo__dica" id="dd-comentario-dica">
                    Fica no histórico sem mudar situação nem prioridade.
                  </p>
                </div>
                {comentar.isError && (
                  <p className="cli__erro cli__erro--geral" role="alert">
                    Não foi possível adicionar o comentário.
                  </p>
                )}
                <div className="gaveta__acoes">
                  <button className="btn btn--secundario" type="submit" disabled={!comentario.trim() || comentar.isPending}>
                    {comentar.isPending ? 'Salvando…' : 'Adicionar comentário'}
                  </button>
                </div>
              </form>
            </section>
          </div>

          <div className="den-detalhe__lateral">
            <section className="cartao den-cartao" aria-labelledby="dd-gestao">
              <h2 className="cartao__titulo" id="dd-gestao">
                Gestão do caso
              </h2>
              <GestaoForm denuncia={d} onSalvo={(mudou) => mudou && avisar(`${d.protocol} atualizada`)} />
            </section>

            <section className="cartao den-cartao" aria-labelledby="dd-protocolo">
              <h2 className="cartao__titulo" id="dd-protocolo">
                Protocolo e links
              </h2>
              <dl className="dados den-dados--uma">
                <div>
                  <dt>Protocolo</dt>
                  <dd className="den-mono">{d.protocol}</dd>
                </div>
                <div>
                  <dt>Token público</dt>
                  <dd className="den-mono den-quebra">{d.publicToken}</dd>
                </div>
                <div>
                  <dt>Responsável atual</dt>
                  <dd>{d.assignee?.name ?? 'Sem responsável'}</dd>
                </div>
                <div>
                  <dt>Última atualização</dt>
                  <dd>{dataHora(d.updatedAt)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      )}
      {aviso}
    </>
  );
}
