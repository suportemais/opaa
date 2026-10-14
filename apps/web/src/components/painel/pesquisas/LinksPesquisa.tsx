import * as QRCode from 'qrcode';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { Icone } from '../Icone';
import { ChavesIdentificacao } from './Identificacao';
import {
  CANAIS,
  identidadeDaPesquisa,
  payloadIdentidade,
  type Identidade,
  mensagemErro,
  nomeCanal,
  slug,
  type Distribution,
  type SurveyDetail,
  type SurveyListItem,
  type Unit,
} from './tipos';

type Grupo = { chave: string; unitId: string | null; nome: string; links: Distribution[] };

type Props = {
  pesquisa: SurveyListItem;
  unidadeInicial?: string | null;
  unidades: Unit[];
  podeGerenciar: boolean;
  avisar: (t: string) => void;
  onFechar: () => void;
};

function rotuloLink(d: Distribution) {
  const partes = [nomeCanal(d.channel)];
  if (d.campaign) partes.push(d.campaign);
  if (d.employee?.name) partes.push(d.employee.name);
  if (!d.active) partes.push('desativado');
  return partes.join(' · ');
}

/**
 * Pop-up "Links da pesquisa" (qr-janela do protótipo): um link e um QR Code por unidade,
 * copiar, abrir e baixar PNG. Mantém do app: todas as distribuições (canal/campanha),
 * gerar novo link/QR e editar a identificação depois de publicar.
 */
export function LinksPesquisa({ pesquisa, unidadeInicial, unidades, podeGerenciar, avisar, onFechar }: Props) {
  const qc = useQueryClient();
  const ref = useRef<HTMLDialogElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const distribuicoes = useQuery({
    queryKey: ['surveyDistributions', pesquisa.id],
    queryFn: () => apiFetch<Distribution[]>(`/surveys/${encodeURIComponent(pesquisa.id)}/distributions`),
  });
  const detalhe = useQuery({
    queryKey: ['surveyDetail', pesquisa.id],
    queryFn: () => apiFetch<SurveyDetail>(`/surveys/${encodeURIComponent(pesquisa.id)}`),
  });

  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
  }, []);

  const grupos = useMemo<Grupo[]>(() => {
    const mapa = new Map<string, Grupo>();
    for (const u of pesquisa.units) {
      mapa.set(u.unitId, { chave: u.unitId, unitId: u.unitId, nome: u.unit.name, links: [] });
    }
    for (const d of distribuicoes.data ?? []) {
      const chave = d.unitId ?? '__sem__';
      if (!mapa.has(chave)) {
        mapa.set(chave, { chave, unitId: d.unitId, nome: d.unit?.name ?? 'Sem unidade', links: [] });
      }
      mapa.get(chave)!.links.push(d);
    }
    const lista = [...mapa.values()];
    for (const g of lista) {
      g.links.sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          Number(a.employeeId !== null) - Number(b.employeeId !== null) ||
          Number(a.channel !== 'qrcode') - Number(b.channel !== 'qrcode') ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return lista;
  }, [pesquisa.units, distribuicoes.data]);

  const [grupoChave, setGrupoChave] = useState<string | null>(unidadeInicial ?? null);
  const grupo = grupos.find((g) => g.chave === grupoChave) ?? grupos[0] ?? null;
  const [linkId, setLinkId] = useState<string | null>(null);
  const link = grupo?.links.find((d) => d.id === linkId) ?? grupo?.links[0] ?? null;
  const url = link ? `${origin}/public/${link.publicToken}` : '';

  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let cancelado = false;
    setQr(null);
    if (!url) return;
    QRCode.toDataURL(url, { width: 520, margin: 2, errorCorrectionLevel: 'M' })
      .then((d: string) => {
        if (!cancelado) setQr(d);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [url]);

  async function baixar() {
    if (!url || !grupo) return;
    try {
      const dado = await QRCode.toDataURL(url, { width: 1024, margin: 4, errorCorrectionLevel: 'M' });
      const a = document.createElement('a');
      a.href = dado;
      a.download = `qrcode-${slug(pesquisa.name) || 'pesquisa'}-${slug(grupo.nome) || 'unidade'}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      avisar(`QR Code de ${grupo.nome} baixado`);
    } catch {
      avisar('Não deu para gerar o PNG. Tente de novo.');
    }
  }

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      avisar(grupo ? `Link de ${grupo.nome} copiado` : 'Link copiado');
    } catch {
      linkRef.current?.select();
      avisar('Selecione e copie o link (Ctrl+C)');
    }
  }

  // ----- Identificação (pode mudar mesmo depois de publicada) -----
  const [ident, setIdent] = useState<Identidade | null>(null);
  useEffect(() => {
    if (detalhe.data) setIdent(identidadeDaPesquisa(detalhe.data));
  }, [detalhe.data]);
  const identSalva = detalhe.data ? identidadeDaPesquisa(detalhe.data) : null;
  const identAlterada =
    Boolean(ident && identSalva) &&
    (ident!.collectEmployee !== identSalva!.collectEmployee ||
      ident!.collectCustomer !== identSalva!.collectCustomer ||
      ident!.requireCustomerIdentity !== identSalva!.requireCustomerIdentity);
  const salvarIdent = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; id: string }>(`/surveys/${encodeURIComponent(pesquisa.id)}`, {
        method: 'PATCH',
        json: payloadIdentidade(ident!),
      }),
    onSuccess: async () => {
      avisar('Identificação salva');
      await qc.invalidateQueries({ queryKey: ['surveyDetail', pesquisa.id] });
      await qc.invalidateQueries({ queryKey: ['surveys'] });
    },
  });

  // ----- Novo link / QR (canal e campanha) -----
  const [novoUnidade, setNovoUnidade] = useState<string>('');
  const [novoCanal, setNovoCanal] = useState('qrcode');
  const [novaCampanha, setNovaCampanha] = useState('');
  const unidadeDoNovo = novoUnidade || grupo?.unitId || pesquisa.units[0]?.unitId || unidades[0]?.id || '';
  const criarLink = useMutation({
    mutationFn: () =>
      apiFetch<Distribution>('/surveys/distributions', {
        method: 'POST',
        json: {
          surveyId: pesquisa.id,
          unitId: unidadeDoNovo || undefined,
          channel: novoCanal,
          campaign: novaCampanha.trim() || undefined,
        },
      }),
    onSuccess: async (d) => {
      await qc.invalidateQueries({ queryKey: ['surveyDistributions', pesquisa.id] });
      setGrupoChave(d.unitId ?? '__sem__');
      setLinkId(d.id);
      setNovaCampanha('');
      avisar('Novo link gerado');
    },
  });

  const arquivada = pesquisa.status === 'archived';
  const rascunho = pesquisa.status === 'draft';

  return (
    <dialog
      ref={ref}
      className="confirmar qr-janela pq-links"
      aria-labelledby="pq-qr-titulo"
      onClose={onFechar}
      onClick={(e) => {
        // Clique no fundo (fora da caixa) fecha
        const dlg = ref.current;
        if (!dlg || e.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        const fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (fora) dlg.close();
      }}
    >
      <div className="qr-janela__topo">
        <div>
          <h2 id="pq-qr-titulo">Links da pesquisa</h2>
          <p>
            {pesquisa.name}.{' '}
            {grupos.length > 1
              ? 'Cada unidade tem o próprio link e QR Code.'
              : grupo
                ? `Leva direto à pesquisa de ${grupo.nome}.`
                : ''}
          </p>
        </div>
        <button className="botao-icone" type="button" aria-label="Fechar" onClick={() => ref.current?.close()}>
          <Icone nome="fechar" />
        </button>
      </div>

      {rascunho && (
        <p className="pq-links__aviso">
          <Icone nome="alerta" />
          Pesquisa ainda não publicada: os links só passam a funcionar depois de publicar.
        </p>
      )}
      {arquivada && (
        <p className="pq-links__aviso">
          <Icone nome="alerta" />
          Pesquisa arquivada: os links estão desativados. Desarquive para voltar a receber respostas.
        </p>
      )}

      {grupos.length > 1 && (
        <div className="qr-janela__unidades" role="group" aria-label="Unidade">
          {grupos.map((g) => (
            <button
              key={g.chave}
              type="button"
              className="qr-janela__unidade"
              aria-pressed={g.chave === grupo?.chave}
              onClick={() => {
                setGrupoChave(g.chave);
                setLinkId(null);
              }}
            >
              <Icone nome="loja" />
              {g.nome}
            </button>
          ))}
        </div>
      )}

      {distribuicoes.isLoading && <p className="pq-links__estado">Carregando links…</p>}
      {distribuicoes.isError && <p className="campo__erro">Falha ao carregar links.</p>}

      {grupo && grupo.links.length > 1 && (
        <div className="campo pq-links__qual">
          <label htmlFor="pq-qr-qual">Link de {grupo.nome}</label>
          <select id="pq-qr-qual" value={link?.id ?? ''} onChange={(e) => setLinkId(e.target.value)}>
            {grupo.links.map((d) => (
              <option key={d.id} value={d.id}>
                {rotuloLink(d)}
              </option>
            ))}
          </select>
        </div>
      )}

      {grupo && !grupo.links.length && distribuicoes.isSuccess && (
        <p className="pq-links__estado">
          {grupo.nome} ainda não tem link. {rascunho ? 'Ele é criado ao publicar.' : 'Gere um em “Novo link ou QR Code”.'}
        </p>
      )}

      {link && (
        <>
          <div className="qr-janela__codigo">
            {qr ? (
              <img className="qr" src={qr} alt={`QR Code de ${grupo?.nome ?? 'pesquisa'}`} width={260} height={260} />
            ) : (
              <div className="pq-links__qr-vazio" aria-hidden="true" />
            )}
          </div>
          {grupos.length <= 1 && grupo?.links.length === 1 && link.channel !== 'qrcode' && (
            <p className="pq-links__estado">{rotuloLink(link)}</p>
          )}
          <div className="qr-janela__copiar">
            <label className="visualmente-oculto" htmlFor="pq-qr-link">
              Link
            </label>
            <input id="pq-qr-link" ref={linkRef} type="text" readOnly value={url} />
            <button className="btn btn--primario" type="button" onClick={copiar}>
              <Icone nome="link" />
              Copiar link
            </button>
          </div>
          <p className="qr-janela__dica">
            Teste o QR Code com a câmera do celular antes de imprimir. Para mesas e balcão, imprima com pelo menos 3 cm de lado.
          </p>
          <div className="confirmar__acoes">
            <a className="btn btn--fantasma" href={url} target="_blank" rel="noopener noreferrer">
              Abrir a pesquisa<span className="visualmente-oculto"> (nova aba)</span>
            </a>
            <button className="btn btn--secundario" type="button" onClick={baixar} disabled={!qr}>
              Baixar QR Code (PNG)
            </button>
          </div>
        </>
      )}

      {podeGerenciar && !arquivada && (
        <details className="pq-links__secao">
          <summary>Novo link ou QR Code</summary>
          <p className="campo__dica">
            Gere outro link para a mesma pesquisa, separado por canal ou campanha (ex.: cardápio, nota fiscal, WhatsApp).
          </p>
          <div className="pq-links__form">
            <div className="campo">
              <label htmlFor="pq-novo-unidade">Unidade</label>
              <select id="pq-novo-unidade" value={unidadeDoNovo} onChange={(e) => setNovoUnidade(e.target.value)}>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="pq-novo-canal">Canal</label>
              <select id="pq-novo-canal" value={novoCanal} onChange={(e) => setNovoCanal(e.target.value)}>
                {CANAIS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo pq-links__campanha">
              <label htmlFor="pq-novo-campanha">
                Campanha <span className="opcional">(opcional)</span>
              </label>
              <input
                id="pq-novo-campanha"
                type="text"
                value={novaCampanha}
                onChange={(e) => setNovaCampanha(e.target.value)}
                placeholder="Ex.: cardápio de mesa"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="pq-links__acoes">
            <button
              className="btn btn--secundario"
              type="button"
              disabled={criarLink.isPending || !unidades.length}
              onClick={() => criarLink.mutate()}
            >
              <Icone nome="qr" />
              {criarLink.isPending ? 'Gerando…' : 'Gerar novo link'}
            </button>
            {criarLink.isError && <p className="campo__erro">{mensagemErro(criarLink.error, 'Falha ao gerar o link.')}</p>}
          </div>
        </details>
      )}

      {podeGerenciar && (
        <details className="pq-links__secao">
          <summary>Atendente e contato do cliente</summary>
          <p className="campo__dica">Vale para as próximas respostas em todos os links desta pesquisa.</p>
          {detalhe.isLoading && <p className="pq-links__estado">Carregando configurações…</p>}
          {detalhe.isError && <p className="campo__erro">Falha ao carregar configurações da pesquisa.</p>}
          {ident && (
            <>
              <ChavesIdentificacao
                valor={ident}
                desativado={arquivada || salvarIdent.isPending}
                onChange={(v) => {
                  setIdent(v);
                  salvarIdent.reset();
                }}
              />
              {arquivada ? (
                <p className="campo__dica">Pesquisa arquivada. A identificação não pode ser alterada.</p>
              ) : (
                <div className="pq-links__acoes">
                  <button
                    className="btn btn--primario"
                    type="button"
                    disabled={!identAlterada || salvarIdent.isPending || detalhe.isFetching}
                    onClick={() => salvarIdent.mutate()}
                  >
                    {salvarIdent.isPending ? 'Salvando…' : 'Salvar identificação'}
                  </button>
                  {salvarIdent.isError && (
                    <p className="campo__erro">{mensagemErro(salvarIdent.error, 'Falha ao salvar identificação.')}</p>
                  )}
                </div>
              )}
            </>
          )}
        </details>
      )}
    </dialog>
  );
}
