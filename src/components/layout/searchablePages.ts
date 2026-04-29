import type { UserRole } from "@/types/auth";

/**
 * Entrada do search global do header. `allowedRoles` ausente = pública (todo
 * autenticado vê). `allowedRoles: []` = só admins (ceo/cto/gestor_projetos).
 * Caso contrário = lista explícita de roles permitidos (admins sempre passam).
 */
export type SearchablePage = {
  path: string;
  label: string;
  category: string;
  allowedRoles?: readonly UserRole[];
};

// `/kanban/comercial` é o board legacy do Treinador Comercial. Scope de cards é por
// client.group_id via RLS (decisão Opus B, migration 20260423120000). A UI canônica
// pro role `consultor_comercial` é `/consultor-comercial` — ele NÃO deve ver a entrada
// do kanban no search. Só admins (ceo/cto/gestor_projetos) veem.
const KANBAN_COMERCIAL_ALLOWED: readonly UserRole[] = [];

export const SEARCHABLE_PAGES: readonly SearchablePage[] = [
  { path: '/ceo', label: 'Indicadores', category: 'CEO' },
  { path: '/kanban/ceo', label: 'Kanban CEO', category: 'CEO' },
  { path: '/okrs-millennials', label: 'OKRs Millennials', category: 'CEO' },
  { path: '/tv-dashboard', label: 'TV Dashboard', category: 'CEO' },
  { path: '/millennials-growth', label: 'Dashboard Millennials Growth', category: 'Produtos' },
  { path: '/outbound-dashboard', label: 'Dashboard Outbound', category: 'Produtos' },
  { path: '/kanban/design', label: 'Kanban Design', category: 'Kanbans' },
  { path: '/kanban/editor-video', label: 'Kanban Editor de Vídeo', category: 'Kanbans' },
  { path: '/kanban/devs', label: 'Kanban Desenvolvedores', category: 'Kanbans' },
  { path: '/kanban/produtora', label: 'Kanban Produtora', category: 'Kanbans' },
  { path: '/kanban/crm', label: 'Kanban CRM', category: 'Kanbans' },
  { path: '/kanban/comercial', label: 'Kanban Comercial', category: 'Kanbans', allowedRoles: KANBAN_COMERCIAL_ALLOWED },
  { path: '/kanban/ads', label: 'Kanban Gestor de Ads', category: 'Kanbans' },
  { path: '/kanban/sucesso', label: 'Kanban Sucesso do Cliente', category: 'Kanbans' },
  { path: '/gestor-ads', label: 'Gestão de Tráfego PRO+', category: 'PRO+' },
  { path: '/millennials-outbound', label: 'Outbound PRO+', category: 'PRO+' },
  { path: '/sucesso-cliente', label: 'Sucesso do Cliente PRO+', category: 'PRO+' },
  { path: '/consultor-comercial', label: 'Treinador Comercial PRO+', category: 'PRO+' },
  { path: '/financeiro', label: 'Financeiro PRO+', category: 'PRO+' },
  { path: '/gestor-projetos', label: 'Gestão de Projetos PRO+', category: 'PRO+' },
  { path: '/gestor-crm', label: 'CRM PRO+', category: 'PRO+' },
  { path: '/design', label: 'Design PRO+', category: 'PRO+' },
  { path: '/editor-video', label: 'Editor de Vídeo PRO+', category: 'PRO+' },
  { path: '/devs', label: 'Desenvolvedor PRO+', category: 'PRO+' },
  { path: '/rh', label: 'RH', category: 'PRO+' },
  { path: '/lista-clientes', label: 'Lista de Clientes (Todos)', category: 'Clientes' },
  { path: '/clientes/millennials-growth', label: 'Clientes Millennials Growth', category: 'Clientes' },
  { path: '/clientes/millennials-outbound', label: 'Clientes Outbound', category: 'Clientes' },
  { path: '/clientes/zydon', label: 'Clientes Zydon', category: 'Clientes' },
  { path: '/clientes/torque-crm', label: 'Clientes Torque CRM', category: 'Clientes' },
  { path: '/clientes/kasd', label: 'Clientes KASD', category: 'Clientes' },
  { path: '/clientes/fenix', label: 'Clientes Fenix', category: 'Clientes' },
  { path: '/cadastro-clientes', label: 'Cadastro de Clientes', category: 'Clientes' },
  { path: '/upsells', label: 'UP Sells', category: 'Financeiro' },
  { path: '/comissoes', label: 'Comissões', category: 'Financeiro' },
  { path: '/provas-sociais', label: 'Provas Sociais', category: 'Vendas' },
  { path: '/financeiro-dashboard', label: 'Financeiro Dashboard', category: 'Financeiro' },
  { path: '/treinamentos', label: 'Treinamentos', category: 'Outros' },
  { path: '/admin/usuarios', label: 'Gestão de Usuários', category: 'Admin' },
  { path: '/admin/grupos', label: 'Grupos', category: 'Admin' },
  { path: '/admin/configuracoes', label: 'Configurações', category: 'Admin' },
];
