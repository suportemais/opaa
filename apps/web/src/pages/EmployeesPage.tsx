import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';
import { ConfigLayout } from '../components/painel/ConfigTabs';
import { Icone } from '../components/painel/Icone';
import { useAuthMe } from '../components/painel/usePainel';
import { Gaveta, Situacao } from '../components/painel/config/ui';
import { useAvisar, useConfirmar } from '../components/painel/config/hooks';
import { descr, mensagemDoErro } from '../components/painel/config/erros';
import '../styles/painel-config.css';

type Unit = { id: string; name: string };
type Employee = {
  id: string;
  unitId: string;
  name: string;
  code: string | null;
  roleTitle: string | null;
  status: string;
  createdAt: string;
  unit: Unit;
};
type ImportResult = { imported: number; total?: number; errors?: Array<{ row: number; message: string }> };

type FormAtendente = { unitId: string; name: string; code: string; roleTitle: string; status: 'active' | 'inactive' };

export function EmployeesPage() {
  const qc = useQueryClient();
  const me = useAuthMe();
  const [avisar, aviso] = useAvisar();
  const [confirmar, janelaConfirmar] = useConfirmar();
  const permissionCodes = me.data?.permissionCodes ?? [];
  const unitIds = (me.data as { unitIds?: string[] } | undefined)?.unitIds;
  const canManageEmployees = permissionCodes.includes('employee:manage') || permissionCodes.includes('unit:manage');
  const canSeeAllUnits = permissionCodes.includes('unit:manage');
  const units = useQuery({ queryKey: ['units'], queryFn: () => apiFetch<Unit[]>('/units') });

  const allowedUnits = useMemo<Unit[]>(() => {
    if (!units.data) return [];
    if (canSeeAllUnits) return units.data;
    const allowed = new Set(unitIds ?? []);
    return units.data.filter((u) => allowed.has(u.id));
  }, [units.data, canSeeAllUnits, unitIds]);

  const defaultUnitId = allowedUnits[0]?.id ?? '';
  const [filterUnitId, setFilterUnitId] = useState('');
  const [search, setSearch] = useState('');

  const employees = useQuery({
    queryKey: ['employees', filterUnitId, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterUnitId) params.set('unitId', filterUnitId);
      if (search.trim()) params.set('q', search.trim());
      const qs = params.toString();
      return apiFetch<Employee[]>(`/employees${qs ? `?${qs}` : ''}`);
    },
  });

  // ----- Gaveta de criar/editar -----
  const [gaveta, setGaveta] = useState<{ modo: 'novo' } | { modo: 'editar'; atendente: Employee } | null>(null);
  const [form, setForm] = useState<FormAtendente>({ unitId: '', name: '', code: '', roleTitle: '', status: 'active' });
  const [tentou, setTentou] = useState(false);
  const [erroGaveta, setErroGaveta] = useState<string | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const mudar = <K extends keyof FormAtendente>(campo: K, valor: FormAtendente[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  function abrirNovo() {
    setForm({ unitId: filterUnitId || defaultUnitId, name: '', code: '', roleTitle: '', status: 'active' });
    setTentou(false);
    setErroGaveta(null);
    setGaveta({ modo: 'novo' });
  }
  function abrirEdicao(e: Employee) {
    setForm({
      unitId: e.unitId,
      name: e.name,
      code: e.code ?? '',
      roleTitle: e.roleTitle ?? '',
      status: e.status === 'inactive' ? 'inactive' : 'active',
    });
    setTentou(false);
    setErroGaveta(null);
    setGaveta({ modo: 'editar', atendente: e });
  }

  const create = useMutation({
    mutationFn: (f: FormAtendente) =>
      apiFetch<{ id: string }>('/employees', {
        method: 'POST',
        json: {
          unitId: f.unitId || defaultUnitId,
          name: f.name.trim(),
          code: f.code.trim() || undefined,
          roleTitle: f.roleTitle.trim() || undefined,
        },
      }),
    onSuccess: async (_, f) => {
      setGaveta(null);
      const unidade = allowedUnits.find((u) => u.id === (f.unitId || defaultUnitId))?.name;
      avisar(unidade ? `${f.name.trim()} adicionado(a) em ${unidade}` : `${f.name.trim()} adicionado(a)`);
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => setErroGaveta(mensagemDoErro(err, {}, 'Não foi possível adicionar o atendente.')),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; f: FormAtendente }) =>
      apiFetch<{ ok: boolean }>(`/employees/${encodeURIComponent(vars.id)}`, {
        method: 'PATCH',
        json: {
          unitId: vars.f.unitId || undefined,
          name: vars.f.name.trim() || undefined,
          code: vars.f.code.trim() || undefined,
          roleTitle: vars.f.roleTitle.trim() || undefined,
          status: vars.f.status,
        },
      }),
    onSuccess: async (_, vars) => {
      setGaveta(null);
      avisar(`${vars.f.name.trim()} atualizado(a)`);
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => setErroGaveta(mensagemDoErro(err, {}, 'Não foi possível salvar o atendente.')),
  });

  // Desativar: mesma chamada da tela anterior
  const disable = useMutation({
    mutationFn: (e: Employee) => apiFetch<{ ok: boolean }>(`/employees/${encodeURIComponent(e.id)}`, { method: 'DELETE' }),
    onSuccess: async (_, e) => {
      avisar(`${e.name} não aparece mais na pesquisa`);
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: () => avisar('Não foi possível desativar o atendente.'),
  });

  // Reativar: PATCH status=active (o mesmo da edição)
  const reativar = useMutation({
    mutationFn: (e: Employee) =>
      apiFetch<{ ok: boolean }>(`/employees/${encodeURIComponent(e.id)}`, { method: 'PATCH', json: { status: 'active' } }),
    onSuccess: async (_, e) => {
      avisar(`${e.name} voltou a aparecer na pesquisa`);
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: () => avisar('Não foi possível reativar o atendente.'),
  });

  function salvarAtendente() {
    setTentou(true);
    setErroGaveta(null);
    if (!form.name.trim()) return nomeRef.current?.focus();
    if (gaveta?.modo === 'editar') update.mutate({ id: gaveta.atendente.id, f: form });
    else create.mutate(form);
  }

  // ----- Importação CSV -----
  const [importAberto, setImportAberto] = useState(false);
  const [importUnitId, setImportUnitId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [importTentou, setImportTentou] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  function limparImportacao() {
    setImportFile(null);
    setImportResult(null);
    setImportError(null);
    setImportErrors([]);
    setImportTentou(false);
    if (arquivoRef.current) arquivoRef.current.value = '';
  }

  const importEmployees = useMutation({
    mutationFn: async () => {
      if (!importFile) throw new Error('missing_file');
      const body = new FormData();
      body.append('unitId', importUnitId || defaultUnitId);
      body.append('file', importFile);
      return apiFetch<ImportResult>('/employees/import', { method: 'POST', body });
    },
    onSuccess: async (data) => {
      setImportResult(data);
      setImportError(null);
      setImportErrors([]);
      setImportFile(null);
      if (arquivoRef.current) arquivoRef.current.value = '';
      avisar(`${data.imported} atendente(s) importado(s)`);
      await qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: unknown) => {
      const body = err instanceof ApiError ? (err.body as { errors?: unknown; message?: unknown } | null) : null;
      const erros = Array.isArray(body?.errors) ? (body!.errors as Array<{ row: number; message: string }>) : [];
      setImportErrors(erros);
      setImportError(
        typeof err === 'string'
          ? err
          : erros.length
            ? 'Verifique os erros abaixo.'
            : typeof body?.message === 'string'
              ? body.message
              : 'Falha ao importar',
      );
      setImportResult(null);
    },
  });

  const lista = employees.data ?? [];
  const nomeUnidadeFiltro = allowedUnits.find((u) => u.id === filterUnitId)?.name;

  return (
    <ConfigLayout>
      <section className="cartao cfg__cartao" aria-labelledby="t-atendentes">
        <div className="cfg__topo">
          <div>
            <h2 className="cartao__titulo" id="t-atendentes">
              Atendentes
            </h2>
            <p className="cartao__sub">Aparecem na pergunta “Quem te atendeu?” da pesquisa da unidade.</p>
            {!canSeeAllUnits && allowedUnits.length > 0 && (
              <p className="cfg-escopo">
                <Icone nome="cadeado" />
                <span>
                  Você vê e edita só os atendentes de <strong>{allowedUnits.map((u) => u.name).join(', ')}</strong>, as
                  unidades do seu acesso.
                </span>
              </p>
            )}
          </div>
          {canManageEmployees && (
            <div className="cfg__botoes">
              <button
                className="btn btn--secundario"
                type="button"
                onClick={() => {
                  limparImportacao();
                  setImportUnitId(filterUnitId || defaultUnitId);
                  setImportAberto(true);
                }}
              >
                Importar planilha
              </button>
              <button className="btn btn--primario" type="button" onClick={abrirNovo} disabled={!allowedUnits.length}>
                <Icone nome="mais" />
                Novo atendente
              </button>
            </div>
          )}
        </div>

        <div className="cfg__filtros">
          <div className="campo campo--busca">
            <label htmlFor="a-busca">Buscar</label>
            <input
              id="a-busca"
              type="search"
              placeholder="Nome ou código"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Icone nome="busca" />
          </div>
          <div className="campo">
            <label htmlFor="a-unidade">Unidade</label>
            <select id="a-unidade" value={filterUnitId} onChange={(e) => setFilterUnitId(e.target.value)} disabled={units.isLoading}>
              <option value="">{canSeeAllUnits ? 'Todas as unidades' : 'Minhas unidades'}</option>
              {allowedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {employees.data && (
          <p className="filtros__contagem" role="status">
            <strong>{lista.length}</strong> {lista.length === 1 ? 'atendente' : 'atendentes'}
            {nomeUnidadeFiltro ? ` em ${nomeUnidadeFiltro}` : ''}
          </p>
        )}
        {employees.isLoading && <p className="mudo">Carregando atendentes…</p>}
        {employees.isError && (
          <p className="campo__erro" role="alert">
            Não foi possível carregar os atendentes.
          </p>
        )}

        {employees.data && (
          <div className="tabela-rolagem">
            <table className="tabela cfg-tabela">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Unidade</th>
                  <th scope="col">Cargo</th>
                  <th scope="col">Situação</th>
                  {canManageEmployees && (
                    <th scope="col">
                      <span className="visualmente-oculto">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={canManageEmployees ? 5 : 4} className="vazio">
                      <strong>Nenhum atendente aqui</strong>
                      <br />
                      {search || filterUnitId ? 'Mude a busca ou a unidade.' : 'Cadastre ou importe os atendentes.'}
                    </td>
                  </tr>
                )}
                {lista.map((e) => {
                  const ativo = e.status === 'active';
                  return (
                    <tr key={e.id} className={ativo ? undefined : 'cfg-tabela__inativo'}>
                      <th scope="row">
                        <span className="cfg-celula">
                          <span>{e.name}</span>
                          {e.code && <small className="mudo">Código {e.code}</small>}
                        </span>
                      </th>
                      <td>{e.unit?.name ?? '—'}</td>
                      <td>{e.roleTitle ? e.roleTitle : <span className="mudo">—</span>}</td>
                      <td>{ativo ? <Situacao tipo="publicada">Ativo</Situacao> : <Situacao tipo="arquivada">Desativado</Situacao>}</td>
                      {canManageEmployees && (
                        <td className="cfg-tabela__acoes">
                          <button className="btn btn--fantasma" type="button" onClick={() => abrirEdicao(e)}>
                            <Icone nome="editar" />
                            Editar<span className="visualmente-oculto"> {e.name}</span>
                          </button>
                          {ativo ? (
                            <button
                              className="btn btn--fantasma"
                              type="button"
                              disabled={disable.isPending}
                              onClick={async () => {
                                const ok = await confirmar({
                                  titulo: `Desativar ${e.name}?`,
                                  texto: 'A pessoa deixa de aparecer na pesquisa. O histórico continua guardado, e dá para reativar depois.',
                                  botao: 'Desativar',
                                  perigo: true,
                                  icone: 'pessoa',
                                });
                                if (ok) disable.mutate(e);
                              }}
                            >
                              Desativar<span className="visualmente-oculto"> {e.name}</span>
                            </button>
                          ) : (
                            <button
                              className="btn btn--fantasma"
                              type="button"
                              disabled={reativar.isPending}
                              onClick={() => reativar.mutate(e)}
                            >
                              Reativar<span className="visualmente-oculto"> {e.name}</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManageEmployees && (
        <Gaveta
          aberta={!!gaveta}
          titulo={gaveta?.modo === 'editar' ? `Editar ${gaveta.atendente.name}` : 'Novo atendente'}
          botao={gaveta?.modo === 'editar' ? 'Salvar' : 'Adicionar'}
          ocupado={create.isPending || update.isPending}
          onFechar={() => setGaveta(null)}
          onSalvar={salvarAtendente}
        >
          <div className="campo">
            <label htmlFor="at-unidade">Unidade</label>
            <select id="at-unidade" value={form.unitId || defaultUnitId} onChange={(e) => mudar('unitId', e.target.value)}>
              {allowedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="at-nome">
              Nome <span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input
              ref={nomeRef}
              id="at-nome"
              required
              aria-invalid={tentou && !form.name.trim()}
              aria-describedby={descr('at-nome', true, true)}
              value={form.name}
              onChange={(e) => mudar('name', e.target.value)}
            />
            <p className="campo__dica" id="at-nome-dica">
              Como o cliente vai ver na pesquisa.
            </p>
            <p className="campo__erro" id="at-nome-erro" hidden={!(tentou && !form.name.trim())}>
              Escreva o nome do atendente.
            </p>
          </div>
          <div className="campo">
            <label htmlFor="at-cargo">
              Cargo <span className="opcional">(opcional)</span>
            </label>
            <input id="at-cargo" placeholder="Ex.: Garçom" value={form.roleTitle} onChange={(e) => mudar('roleTitle', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="at-codigo">
              Código <span className="opcional">(opcional)</span>
            </label>
            <input id="at-codigo" aria-describedby="at-codigo-dica" value={form.code} onChange={(e) => mudar('code', e.target.value)} />
            <p className="campo__dica" id="at-codigo-dica">
              Matrícula ou código interno, se a casa usar.
            </p>
          </div>
          {gaveta?.modo === 'editar' && (
            <div className="campo">
              <label htmlFor="at-situacao">Situação</label>
              <select id="at-situacao" value={form.status} onChange={(e) => mudar('status', e.target.value as FormAtendente['status'])}>
                <option value="active">Ativo (aparece na pesquisa)</option>
                <option value="inactive">Desativado (não aparece)</option>
              </select>
            </div>
          )}
          {erroGaveta && (
            <p className="campo__erro" role="alert">
              {erroGaveta}
            </p>
          )}
        </Gaveta>
      )}

      {canManageEmployees && (
        <Gaveta
          aberta={importAberto}
          titulo="Importar planilha de atendentes"
          botao="Importar"
          ocupado={importEmployees.isPending}
          onFechar={() => setImportAberto(false)}
          onSalvar={() => {
            setImportTentou(true);
            if (!importFile) return arquivoRef.current?.focus();
            importEmployees.mutate();
          }}
        >
          <p className="cfg-info">
            <Icone nome="lista" />
            <span>
              Use uma planilha CSV com as colunas <strong>Nome</strong> (obrigatória), <strong>Código</strong> e{' '}
              <strong>Cargo</strong>. Uma pessoa por linha. Limite de 2 MB. Exemplo de cabeçalho: <code>Nome,Código,Cargo</code>
            </span>
          </p>
          <div className="campo">
            <label htmlFor="im-unidade">Unidade dos atendentes</label>
            <select
              id="im-unidade"
              value={importUnitId || defaultUnitId}
              onChange={(e) => setImportUnitId(e.target.value)}
              disabled={units.isLoading || importEmployees.isPending}
            >
              {allowedUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="im-arquivo">Arquivo CSV</label>
            <input
              ref={arquivoRef}
              id="im-arquivo"
              className="cfg-arquivo"
              type="file"
              accept=".csv,text/csv"
              disabled={importEmployees.isPending}
              aria-invalid={importTentou && !importFile}
              aria-describedby={descr('im-arquivo', false, true)}
              onChange={(e) => {
                setImportFile(e.target.files?.[0] ?? null);
                setImportResult(null);
                setImportError(null);
                setImportErrors([]);
              }}
            />
            <p className="campo__erro" id="im-arquivo-erro" hidden={!(importTentou && !importFile)}>
              Escolha o arquivo da planilha.
            </p>
          </div>
          {importFile && (
            <div>
              <button className="btn btn--fantasma" type="button" disabled={importEmployees.isPending} onClick={limparImportacao}>
                Limpar
              </button>
            </div>
          )}
          {importResult && (
            <div className="cfg-resultado" role="status">
              <p>
                <strong>
                  {importResult.imported} de {importResult.total ?? importResult.imported}
                </strong>{' '}
                atendente(s) importado(s) com sucesso.
              </p>
              {importResult.errors && importResult.errors.length > 0 && (
                <>
                  <p>Observações:</p>
                  <ul>
                    {importResult.errors.map((er, i) => (
                      <li key={i}>
                        Linha {er.row}: {er.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {importError && (
            <div className="cfg-resultado cfg-resultado--erro" role="alert">
              <p>{importError}</p>
              {importErrors.length > 0 && (
                <ul>
                  {importErrors.map((er, i) => (
                    <li key={i}>
                      Linha {er.row}: {er.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Gaveta>
      )}
      {janelaConfirmar}
      {aviso}
    </ConfigLayout>
  );
}
