import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { formatCnpj, unitCnpjLine } from '../../../lib/cnpj';
import { Icone } from '../Icone';
import {
  type Campanha,
  type OpcaoEmpresa,
  type Pesquisa,
  type UnidadeCnpj,
  MENSAGEM_PADRAO,
  TOKENS,
  centavosDeReais,
  deDataHoraLocal,
  erroCampanha,
  paraDataHoraLocal,
  reaisDeCentavos,
} from './util';

export type ModoForm = 'nova' | 'editar' | 'modelo';
type Campo = 'nome' | 'pesquisa' | 'empresa' | 'unidade' | 'valor' | 'validade' | 'inicio' | 'fim' | 'mensagem';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Prévia da mensagem com valores de exemplo (os placeholders reais são trocados pelo servidor). */
function previa(texto: string, valor: string) {
  return esc(texto || MENSAGEM_PADRAO)
    .replaceAll('{{amount}}', `<strong>${esc(valor || '0,00')}</strong>`)
    .replaceAll('{{code}}', '<strong>MM-7K2Q9X</strong>')
    .replaceAll('{{link}}', '<span class="zap__link">link de resgate</span>')
    .replaceAll('\n', '<br>');
}

/** Conteúdo da gaveta "Nova campanha" / "Editar campanha". */
export function CampanhaForm(props: {
  modo: ModoForm;
  inicial: Campanha | null;
  pesquisas: Pesquisa[];
  empresas: OpcaoEmpresa[];
  empresasCarregando: boolean;
  empresasErro: boolean;
  unidades: UnidadeCnpj[];
  unidadesCarregando: boolean;
  onFechar: () => void;
  onSalvo: (c: Campanha, modo: ModoForm, agendada: boolean) => void;
}) {
  const { inicial, modo } = props;
  const editando = modo === 'editar' && inicial;
  const qc = useQueryClient();
  const msgRef = useRef<HTMLTextAreaElement | null>(null);

  const [nome, setNome] = useState(modo === 'modelo' && inicial ? `${inicial.name} (cópia)` : (inicial?.name ?? ''));
  const [descricao, setDescricao] = useState(inicial?.description ?? '');
  const [pesquisaId, setPesquisaId] = useState(inicial?.surveyId ?? props.pesquisas[0]?.id ?? '');
  const [empresaId, setEmpresaId] = useState(inicial?.mmCompanyId ?? props.empresas[0]?.id ?? '');
  const [unidadeId, setUnidadeId] = useState(inicial?.unitId ?? (props.unidades.length === 1 ? props.unidades[0].id : ''));
  const [valor, setValor] = useState(reaisDeCentavos(inicial?.rewardAmountCents) || '10,00');
  const [validade, setValidade] = useState(inicial ? (inicial.validityDays ? String(inicial.validityDays) : '') : '30');
  const [inicio, setInicio] = useState(modo === 'editar' ? paraDataHoraLocal(inicial?.startsAt) : '');
  const [fim, setFim] = useState(modo === 'editar' ? paraDataHoraLocal(inicial?.endsAt) : '');
  const [prefixo, setPrefixo] = useState(inicial?.prefix || 'MM');
  const [mensagem, setMensagem] = useState(inicial?.message || MENSAGEM_PADRAO);
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  // Ao editar, a pesquisa atual continua na lista mesmo que não esteja mais ativa.
  const pesquisas = useMemo(() => {
    if (!inicial?.surveyId || props.pesquisas.some((p) => p.id === inicial.surveyId)) return props.pesquisas;
    return [...props.pesquisas, { id: inicial.surveyId, name: inicial.surveyName ?? 'Pesquisa atual', status: '' }];
  }, [props.pesquisas, inicial]);

  // Enquanto as listas carregam, assume a primeira opção (como antes).
  const pesquisaSel = pesquisaId || pesquisas[0]?.id || '';
  const empresaSel = empresaId || props.empresas[0]?.id || '';
  const multi = props.unidades.length > 1;
  const unidade = props.unidades.find((u) => u.id === unidadeId) ?? (props.unidades.length === 1 ? props.unidades[0] : undefined);
  const temCnpj = Boolean(unidade?.document?.trim());
  const agendar = Boolean(inicio && new Date(inicio).getTime() > Date.now());

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = {
        name: nome.trim(),
        description: descricao.trim() || (editando ? '' : undefined),
        surveyId: pesquisaSel,
        mmCompanyId: empresaSel.trim(),
        unitId: unidade?.id ?? '',
        rewardAmountCents: centavosDeReais(valor) ?? 0,
        validityDays: validade.trim() ? Number(validade) : undefined,
        startsAt: deDataHoraLocal(inicio),
        endsAt: deDataHoraLocal(fim),
        message: mensagem.trim() || undefined,
        prefix: prefixo.trim() || 'MM',
      };
      if (editando) return apiFetch<Campanha>(`/coupon-campaigns/${inicial.id}`, { method: 'PATCH', json: corpo });
      return apiFetch<Campanha>('/coupon-campaigns', { method: 'POST', json: { ...corpo, activate: true } });
    },
    onSuccess: async (c) => {
      await qc.invalidateQueries({ queryKey: ['coupon-campaigns'] });
      props.onSalvo(c, modo, agendar);
    },
    onError: (err) => setErroGeral(erroCampanha(err)),
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const novo: Partial<Record<Campo, string>> = {};
    if (!nome.trim()) novo.nome = 'Dê um nome para a campanha.';
    if (!pesquisaSel) novo.pesquisa = 'Escolha a pesquisa.';
    if (!empresaSel.trim()) novo.empresa = 'Selecione a empresa Muito Mais.';
    if (!unidade) novo.unidade = 'Escolha a unidade antes de gerar.';
    else if (!temCnpj) novo.unidade = 'Cadastre um CNPJ válido nesta unidade para emitir o voucher.';
    if (!centavosDeReais(valor)) novo.valor = 'Informe um valor em R$ maior que zero.';
    const dias = validade.trim() ? Number(validade) : null;
    if (dias !== null && (!Number.isInteger(dias) || dias < 1 || dias > 3650)) novo.validade = 'Use um número de dias (a partir de 1).';
    if (inicio && Number.isNaN(new Date(inicio).getTime())) novo.inicio = 'Data inválida.';
    if (fim && inicio && new Date(fim).getTime() <= new Date(inicio).getTime()) novo.fim = 'O fim precisa ser depois do início.';
    if (mensagem.trim() && !mensagem.includes('{{code}}')) novo.mensagem = 'A mensagem precisa ter o código do voucher.';
    setErros(novo);
    setErroGeral(null);
    const primeiro = (['nome', 'pesquisa', 'empresa', 'unidade', 'valor', 'validade', 'inicio', 'fim', 'mensagem'] as const).find(
      (k) => novo[k],
    );
    if (primeiro) {
      document.getElementById(`pr-${primeiro}`)?.focus();
      return;
    }
    salvar.mutate();
  }

  function inserir(token: string) {
    const area = msgRef.current;
    if (!area) {
      setMensagem((m) => `${m.trim()}\n${token}`.trim());
      return;
    }
    const a = area.selectionStart ?? mensagem.length;
    const b = area.selectionEnd ?? mensagem.length;
    const novo = mensagem.slice(0, a) + token + mensagem.slice(b);
    setMensagem(novo);
    limpar('mensagem');
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(a + token.length, a + token.length);
    });
  }

  const limpar = (k: Campo) => erros[k] && setErros((v) => ({ ...v, [k]: undefined }));
  const attrs = (k: Campo, dica = false) => ({
    id: `pr-${k}`,
    'aria-invalid': erros[k] ? true : undefined,
    'aria-describedby': `${dica ? `pr-${k}-dica ` : ''}pr-${k}-erro`,
  });
  const erro = (k: Campo) => (
    <p className="campo__erro" id={`pr-${k}-erro`} hidden={!erros[k]}>
      {erros[k]}
    </p>
  );
  const obrig = (
    <span className="obrigatorio" aria-hidden="true">
      *
    </span>
  );

  const titulo = editando ? `Editar ${inicial.name}` : modo === 'modelo' ? 'Nova campanha (a partir de modelo)' : 'Nova campanha';
  const totalLimit = inicial?.totalLimit;

  return (
    <form className="gaveta__corpo" onSubmit={enviar} noValidate>
      <div className="gaveta__topo">
        <h2 className="cfg-gaveta__titulo" id="pr-titulo" tabIndex={-1}>
          {titulo}
        </h2>
        <button className="botao-icone" type="button" aria-label="Fechar" onClick={props.onFechar}>
          <Icone nome="fechar" />
        </button>
      </div>

      <div className="gaveta__form">
        <div className="campo">
          <label htmlFor="pr-nome">Nome da campanha {obrig}</label>
          <input {...attrs('nome', true)} value={nome} placeholder="Ex.: NPS Novembro — R$ 10" onChange={(e) => { setNome(e.target.value); limpar('nome'); }} />
          <p className="campo__dica" id="pr-nome-dica">
            Só a equipe vê. O cliente recebe a mensagem abaixo.
          </p>
          {erro('nome')}
        </div>

        <div className="campo">
          <label htmlFor="pr-descricao">
            Descrição interna <span className="cl-mudo">(opcional)</span>
          </label>
          <textarea id="pr-descricao" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="pr-pesquisa">Pesquisa {obrig}</label>
          <select {...attrs('pesquisa', true)} value={pesquisaSel} onChange={(e) => { setPesquisaId(e.target.value); limpar('pesquisa'); }}>
            <option value="">Escolha a pesquisa</option>
            {pesquisas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="campo__dica" id="pr-pesquisa-dica">
            Quem responder a esta pesquisa recebe o voucher.
          </p>
          {erro('pesquisa')}
        </div>

        <div className="campo">
          <label htmlFor="pr-empresa">Empresa Muito Mais {obrig}</label>
          <select
            {...attrs('empresa', true)}
            value={empresaSel}
            disabled={props.empresasCarregando}
            onChange={(e) => { setEmpresaId(e.target.value); limpar('empresa'); }}
          >
            <option value="">{props.empresasCarregando ? 'Carregando empresas…' : 'Selecione a empresa'}</option>
            {props.empresas.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="campo__dica" id="pr-empresa-dica">
            {props.empresasErro
              ? 'Não foi possível carregar a empresa Muito Mais.'
              : !props.empresasCarregando && props.empresas.length === 0
                ? 'Nenhuma empresa vinculada. '
                : 'É quem gera os vouchers. Vinculada em Integrações; estabelecimentos não entram nesta lista.'}
            {!props.empresasCarregando && !props.empresasErro && props.empresas.length === 0 && (
              <Link className="link-texto" to="/app/integracoes">
                Conecte o Muito Mais em Integrações
              </Link>
            )}
          </p>
          {erro('empresa')}
        </div>

        <div className="campo">
          <label htmlFor="pr-unidade">Unidade {obrig}</label>
          {multi ? (
            <select {...attrs('unidade')} value={unidadeId} disabled={props.unidadesCarregando} onChange={(e) => { setUnidadeId(e.target.value); limpar('unidade'); }}>
              <option value="">Escolha a unidade antes de gerar</option>
              {props.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {unitCnpjLine(u.name, u.document)}
                </option>
              ))}
            </select>
          ) : (
            <input
              {...attrs('unidade')}
              readOnly
              value={unidade ? unitCnpjLine(unidade.name, unidade.document) : props.unidadesCarregando ? 'Carregando…' : 'Nenhuma unidade cadastrada'}
            />
          )}
          {erro('unidade')}
        </div>
        <p className={`pr-unidade${unidade && !temCnpj ? ' pr-unidade--alerta' : ''}`} aria-live="polite">
          {unidade && temCnpj && (
            <>
              <Icone nome="loja" />
              <span>
                Uma campanha vale para uma unidade: <strong>{unidade.name}</strong> · CNPJ {formatCnpj(unidade.document)}. O voucher
                vincula no Muito Mais pelo CNPJ desta unidade.
              </span>
            </>
          )}
          {unidade && !temCnpj && (
            <>
              <Icone nome="alerta" />
              <span>
                <strong>{unidade.name} não tem CNPJ.</strong> Sem ele, a Muito Mais não gera os vouchers.{' '}
                <Link className="link-texto" to="/app/units">
                  Cadastrar o CNPJ em Unidades
                </Link>
              </span>
            </>
          )}
          {!unidade && !props.unidadesCarregando && props.unidades.length === 0 && (
            <>
              <Icone nome="alerta" />
              <span>
                Nenhuma unidade cadastrada.{' '}
                <Link className="link-texto" to="/app/units">
                  Cadastre a unidade e o CNPJ em Unidades
                </Link>
              </span>
            </>
          )}
        </p>

        <div className="campos-2 pr-campos-2">
          <div className="campo">
            <label htmlFor="pr-valor">Valor do voucher (fixo) {obrig}</label>
            <span className="pr-moeda">
              <span aria-hidden="true">R$</span>
              <input {...attrs('valor')} inputMode="decimal" value={valor} placeholder="10,00" onChange={(e) => { setValor(e.target.value); limpar('valor'); }} />
            </span>
            {erro('valor')}
          </div>
          <div className="campo">
            <label htmlFor="pr-validade">Validade (dias)</label>
            <input {...attrs('validade', true)} type="number" min={1} value={validade} placeholder="30" onChange={(e) => { setValidade(e.target.value); limpar('validade'); }} />
            <p className="campo__dica" id="pr-validade-dica">
              Conta a partir do envio.
            </p>
            {erro('validade')}
          </div>
          <div className="campo">
            <label htmlFor="pr-inicio">Começa em</label>
            <input {...attrs('inicio', true)} type="datetime-local" value={inicio} onChange={(e) => { setInicio(e.target.value); limpar('inicio'); }} />
            <p className="campo__dica" id="pr-inicio-dica">
              Vazio = já começa. Data futura = campanha agendada.
            </p>
            {erro('inicio')}
          </div>
          <div className="campo">
            <label htmlFor="pr-fim">Termina em</label>
            <input {...attrs('fim', true)} type="datetime-local" value={fim} onChange={(e) => { setFim(e.target.value); limpar('fim'); }} />
            <p className="campo__dica" id="pr-fim-dica">
              Vazio = sem data para terminar.
            </p>
            {erro('fim')}
          </div>
        </div>

        <div className="campo">
          <label htmlFor="pr-prefixo">Prefixo do código</label>
          <input id="pr-prefixo" value={prefixo} maxLength={12} aria-describedby="pr-prefixo-dica" onChange={(e) => setPrefixo(e.target.value)} />
          <p className="campo__dica" id="pr-prefixo-dica">
            Começo dos códigos dos vouchers (padrão MM).
          </p>
        </div>

        <div className="campo">
          <label htmlFor="pr-mensagem">Mensagem do WhatsApp</label>
          <div className="pr-inserir" role="group" aria-label="Inserir na mensagem">
            <span>Inserir:</span>
            {TOKENS.map((t) => (
              <button key={t.token} type="button" className="pr-chip" title={t.token} onClick={() => inserir(t.token)}>
                {t.rotulo}
              </button>
            ))}
          </div>
          <textarea
            {...attrs('mensagem', true)}
            ref={msgRef}
            rows={4}
            value={mensagem}
            placeholder={MENSAGEM_PADRAO}
            onChange={(e) => { setMensagem(e.target.value); limpar('mensagem'); }}
          />
          <p className="campo__dica" id="pr-mensagem-dica">
            Os itens {'{{amount}}'}, {'{{code}}'} e {'{{link}}'} viram o valor, o código e o link de cada cliente.
          </p>
          {erro('mensagem')}
        </div>
        <div className="zap" aria-label="Prévia da mensagem no WhatsApp">
          <p className="zap__rotulo">
            <Icone nome="celular" />
            Como o cliente recebe
          </p>
          <p className="zap__balao" dangerouslySetInnerHTML={{ __html: previa(mensagem, valor) }} />
        </div>

        <p className="cfg-info">
          <Icone nome="cadeado" />
          <span>
            <strong>1 voucher por cliente</strong> em cada campanha. Esse limite é fixo.{' '}
            {typeof totalLimit === 'number' ? `Limite total: ${totalLimit} vouchers.` : 'Sem limite total de vouchers.'}
          </span>
        </p>
      </div>

      {erroGeral && (
        <p className="pr-alerta" role="alert">
          <Icone nome="alerta" />
          <span>{erroGeral}</span>
        </p>
      )}

      <div className="gaveta__acoes">
        <button className="btn btn--secundario" type="button" onClick={props.onFechar}>
          Cancelar
        </button>
        <button className="btn btn--primario" type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : editando ? 'Salvar' : agendar ? 'Agendar campanha' : 'Criar e ativar'}
        </button>
      </div>
    </form>
  );
}
