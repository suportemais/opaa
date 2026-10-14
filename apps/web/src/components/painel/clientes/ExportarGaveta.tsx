import { useState, type FormEvent } from 'react';
import { apiFetch } from '../../../lib/api';
import type { CustomerListPage } from '../../../lib/api-novos';
import { Icone } from '../Icone';
import { type Cliente, ORIGEM_ROTULO, baixarCsv, dataHora, imprimirTabela, nascimentoBr, ofertasTexto } from './util';

type Quais = 'lista' | 'ofertas' | 'todos';

/** Busca todas as páginas de GET /customers para os filtros dados (máx. 200 por página). */
async function buscarTodos(filtros: URLSearchParams) {
  const itens: Cliente[] = [];
  for (let page = 1; page < 500; page += 1) {
    const p = new URLSearchParams(filtros);
    p.set('page', String(page));
    p.set('pageSize', '200');
    const r = await apiFetch<CustomerListPage<Cliente>>(`/customers?${p}`);
    itens.push(...r.items);
    if (itens.length >= r.total || r.items.length === 0) break;
  }
  return itens;
}

const CABECALHO = [
  'Nome',
  'E-mail',
  'Telefone',
  'Data de nascimento',
  'Unidade',
  'Origem',
  'Aceita ofertas',
  'Respostas',
  'Última nota',
  'Primeira interação',
  'Última interação',
  'Criado em',
];

function linha(c: Cliente) {
  return [
    c.name ?? '',
    c.email ?? '',
    c.phone ?? '',
    nascimentoBr(c.birthDate),
    c.originUnit?.name ?? '',
    c.source ? ORIGEM_ROTULO[c.source] : '',
    ofertasTexto(c.acceptsOffers),
    c.totalResponses ?? '',
    c.lastNpsScore ?? '',
    c.firstInteractionAt ? dataHora(c.firstInteractionAt) : '',
    c.lastInteractionAt ? dataHora(c.lastInteractionAt) : '',
    dataHora(c.createdAt),
  ];
}

/** Conteúdo da gaveta "Exportar clientes" (CSV ou PDF, com dados da API). */
export function ExportarConteudo(props: {
  filtrosLista: URLSearchParams;
  totais: { lista?: number; ofertas?: number; todos?: number };
  onFechar: () => void;
  onExportado: (n: number) => void;
}) {
  const [quais, setQuais] = useState<Quais>('lista');
  const [formato, setFormato] = useState<'csv' | 'pdf'>('csv');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const qtd = props.totais[quais];
  const rotulo = (n?: number) => (typeof n === 'number' ? `${n.toLocaleString('pt-BR')} ${n === 1 ? 'cliente' : 'clientes'}` : '…');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    // A janela de impressão abre já no clique; os dados entram quando chegarem.
    const janela = formato === 'pdf' ? window.open('', '_blank') : null;
    try {
      const filtros =
        quais === 'lista' ? props.filtrosLista : quais === 'ofertas' ? new URLSearchParams({ offers: 'sim' }) : new URLSearchParams();
      const itens = await buscarTodos(filtros);
      if (!itens.length) {
        janela?.close();
        setErro('Nenhum cliente nesta opção.');
        return;
      }
      const linhas = itens.map(linha);
      if (formato === 'csv') baixarCsv('clientes.csv', [CABECALHO, ...linhas]);
      else if (!imprimirTabela('Clientes', CABECALHO, linhas, janela)) {
        setErro('O navegador bloqueou a janela de impressão. Permita pop-ups e tente de novo.');
        return;
      }
      props.onExportado(itens.length);
    } catch {
      janela?.close();
      setErro('Não foi possível exportar. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="gaveta__corpo" onSubmit={enviar}>
      <div className="gaveta__topo">
        <h2 className="cfg-gaveta__titulo" id="ce-titulo" tabIndex={-1}>
          Exportar clientes
        </h2>
        <button className="botao-icone" type="button" aria-label="Fechar" onClick={props.onFechar}>
          <Icone nome="fechar" />
        </button>
      </div>
      <fieldset className="cl-opcoes">
        <legend>Quais clientes</legend>
        <label className="cl-opcao">
          <input type="radio" name="quais" checked={quais === 'lista'} onChange={() => setQuais('lista')} />
          <span>
            <strong>{rotulo(props.totais.lista)}</strong>Os da lista, com os filtros de agora
          </span>
        </label>
        <label className="cl-opcao">
          <input type="radio" name="quais" checked={quais === 'ofertas'} onChange={() => setQuais('ofertas')} />
          <span>
            <strong>{rotulo(props.totais.ofertas)}</strong>Só quem aceita receber ofertas (para campanhas)
          </span>
        </label>
        <label className="cl-opcao">
          <input type="radio" name="quais" checked={quais === 'todos'} onChange={() => setQuais('todos')} />
          <span>
            <strong>{rotulo(props.totais.todos)}</strong>Todos os clientes
          </span>
        </label>
      </fieldset>
      <fieldset className="cl-opcoes">
        <legend>Formato</legend>
        <label className="cl-opcao">
          <input type="radio" name="formato" checked={formato === 'csv'} onChange={() => setFormato('csv')} />
          <span>
            <strong>Planilha (CSV)</strong>Abre no Excel e no Google Planilhas
          </span>
        </label>
        <label className="cl-opcao">
          <input type="radio" name="formato" checked={formato === 'pdf'} onChange={() => setFormato('pdf')} />
          <span>
            <strong>PDF</strong>Para imprimir ou arquivar
          </span>
        </label>
      </fieldset>
      <p className="cl-lgpd" role={erro ? 'alert' : undefined}>
        {erro || qtd === 0 ? (
          <>
            <Icone nome="alerta" />
            <span>
              <strong>{erro ?? 'Nenhum cliente nesta opção.'}</strong> {erro ? '' : 'Escolha outra ou mude os filtros da lista.'}
            </span>
          </>
        ) : (
          <>
            <Icone nome="cadeado" />
            <span>
              <strong>Dados pessoais.</strong> O arquivo terá nome, contato e data de nascimento. Guarde com cuidado e não
              compartilhe fora da empresa.
            </span>
          </>
        )}
      </p>
      <div className="gaveta__acoes">
        <button className="btn btn--secundario" type="button" onClick={props.onFechar}>
          Cancelar
        </button>
        <button className="btn btn--primario" type="submit" disabled={ocupado || qtd === 0}>
          {ocupado ? 'Preparando…' : 'Exportar'}
        </button>
      </div>
    </form>
  );
}
