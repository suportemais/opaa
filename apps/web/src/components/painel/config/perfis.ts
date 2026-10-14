// Perfis reais do app (espelho de TENANT_DEFAULT_ROLES em apps/api/src/rbac/rbac.service.ts).
// Só leitura: o RBAC não é editável pela tela. Se o backend mudar, atualize aqui.

export type CodigoPerfil = 'tenant_admin' | 'regional_manager' | 'unit_manager' | 'analyst' | 'collaborator';

export type Perfil = {
  code: CodigoPerfil;
  nome: string;
  descricao: string;
  /** classe do selo (selo-perfil--x) */
  selo: string;
  permissoes: readonly string[];
};

export const PERFIS: Perfil[] = [
  {
    code: 'tenant_admin',
    nome: 'Administrador',
    descricao: 'Acesso completo: empresa e assinatura, unidades, usuários, integrações e denúncias. Vê todas as unidades.',
    selo: 'admin',
    permissoes: [
      'tenant:settings:manage', 'unit:read', 'unit:manage', 'user:manage', 'survey:read', 'survey:manage',
      'response:read', 'feedback:manage', 'customer:read', 'customer:manage', 'employee:read', 'employee:manage',
      'whistleblower:read', 'whistleblower:manage', 'review:read', 'review:manage',
    ],
  },
  {
    code: 'regional_manager',
    nome: 'Gestor regional',
    descricao: 'Acompanha os resultados das unidades do seu acesso e trata feedbacks e ocorrências.',
    selo: 'gestor',
    permissoes: [
      'unit:read', 'survey:read', 'response:read', 'feedback:manage', 'customer:read', 'employee:read',
      'review:read', 'review:manage',
    ],
  },
  {
    code: 'unit_manager',
    nome: 'Gestor de unidade',
    descricao: 'Trata feedbacks e ocorrências e cuida dos atendentes das unidades do seu acesso.',
    selo: 'gestor',
    permissoes: [
      'unit:read', 'survey:read', 'response:read', 'feedback:manage', 'customer:read', 'employee:read',
      'employee:manage', 'review:read', 'review:manage',
    ],
  },
  {
    code: 'analyst',
    nome: 'Marketing',
    descricao: 'Cria e edita pesquisas, acompanha resultados e clientes e cuida dos atendentes. Não trata ocorrências.',
    selo: 'marketing',
    permissoes: [
      'unit:read', 'survey:read', 'survey:manage', 'response:read', 'customer:read', 'employee:read',
      'employee:manage', 'review:read',
    ],
  },
  {
    code: 'collaborator',
    nome: 'Colaborador',
    descricao: 'Sem acesso aos dados da empresa. Entra no painel e cuida só dos próprios dados (Minha conta).',
    selo: 'colaborador',
    permissoes: [],
  },
];

export const perfilPorCodigo = (code: string | null | undefined) => PERFIS.find((p) => p.code === code);

/** Perfis que precisam de ao menos uma unidade (sem unit:manage). */
export const precisaDeUnidade = (code: string) => !perfilPorCodigo(code)?.permissoes.includes('unit:manage');

/** Linhas da matriz "O que cada perfil vê" (cada uma ligada a uma permissão real). */
export const AREAS: { nome: string; permissao: string | null }[] = [
  { nome: 'Dashboard, ranking e respostas', permissao: 'response:read' },
  { nome: 'Tratar feedbacks e ocorrências', permissao: 'feedback:manage' },
  { nome: 'Denúncias (canal ético)', permissao: 'whistleblower:manage' },
  { nome: 'Ver pesquisas', permissao: 'survey:read' },
  { nome: 'Criar e editar pesquisas', permissao: 'survey:manage' },
  { nome: 'Ver clientes', permissao: 'customer:read' },
  { nome: 'Editar e importar clientes', permissao: 'customer:manage' },
  { nome: 'Ver atendentes', permissao: 'employee:read' },
  { nome: 'Cadastrar atendentes', permissao: 'employee:manage' },
  { nome: 'Ver unidades', permissao: 'unit:read' },
  { nome: 'Criar e editar unidades', permissao: 'unit:manage' },
  { nome: 'Ver avaliações online', permissao: 'review:read' },
  { nome: 'Configurar avaliações online', permissao: 'review:manage' },
  { nome: 'Usuários e perfis', permissao: 'user:manage' },
  { nome: 'Empresa, assinatura e integrações', permissao: 'tenant:settings:manage' },
  { nome: 'Minha conta (nome, telefone e senha)', permissao: null },
];

/** Resumo legível do que o perfil vê (para a gaveta de usuário e Minha conta). */
export function resumoDoPerfil(p: Perfil) {
  const vistos = AREAS.filter((a) => a.permissao && p.permissoes.includes(a.permissao)).map((a) => a.nome);
  return vistos.length ? vistos.join(', ') : 'Só Minha conta';
}
