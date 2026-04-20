import type { UserRole } from '@/types/auth';

// Catálogo canônico de páginas no frontend.
// Espelha o que foi semeado em app_pages pela migration 20260420170000.
// Single source of truth — o Create/Edit UserModal e o divergence logger
// consomem daqui. Se o catálogo divergir da migration, o dual-read vai gritar.
export const ALL_PAGES = [
  { id: 'gestor-ads', label: 'Gestão de Tráfego PRO+', icon: '📊' },
  { id: 'sucesso-cliente', label: 'Sucesso do Cliente PRO+', icon: '🤝' },
  { id: 'consultor-comercial', label: 'Treinador Comercial PRO+', icon: '💼' },
  { id: 'financeiro', label: 'Financeiro PRO+', icon: '💰' },
  { id: 'gestor-projetos', label: 'Gestão de Projetos PRO+', icon: '📋' },
  { id: 'gestor-crm', label: 'CRM PRO+', icon: '📇' },
  { id: 'design', label: 'Design PRO+', icon: '🎨' },
  { id: 'editor-video', label: 'Editor de Vídeo PRO+', icon: '🎬' },
  { id: 'devs', label: 'Desenvolvedor PRO+', icon: '💻' },
  { id: 'atrizes-gravacao', label: 'Gravação PRO+', icon: '🎭' },
  { id: 'rh', label: 'RH PRO+', icon: '👥' },
  { id: 'produtora', label: 'Produtora', icon: '🎥' },
  { id: 'cliente-list', label: 'Lista de Clientes', icon: '📝' },
  { id: 'cadastro-clientes', label: 'Cadastro de Clientes', icon: '➕' },
  { id: 'upsells', label: 'UP Sells', icon: '📈' },
  { id: 'comissoes', label: 'Comissões', icon: '💵' },
] as const;

export type PageSlug = (typeof ALL_PAGES)[number]['id'];

const ALL_PAGE_IDS = ALL_PAGES.map((p) => p.id);

// Páginas padrão por cargo — replica a lógica histórica usada no admin UI,
// onde a UI pré-selecionava (e não gravava) as páginas "implícitas" do papel.
export const DEFAULT_PAGES_BY_ROLE: Record<UserRole, string[]> = {
  ceo: ALL_PAGE_IDS,
  cto: ALL_PAGE_IDS,
  gestor_projetos: ALL_PAGE_IDS,
  gestor_ads: ['gestor-ads', 'design', 'editor-video', 'devs', 'produtora', 'atrizes-gravacao', 'gestor-crm', 'consultor-comercial'],
  outbound: ['gestor-ads', 'design', 'editor-video', 'devs', 'produtora', 'atrizes-gravacao', 'gestor-crm', 'consultor-comercial'],
  sucesso_cliente: ['sucesso-cliente', 'gestor-ads', 'design', 'editor-video', 'devs', 'produtora', 'atrizes-gravacao', 'gestor-crm', 'consultor-comercial', 'rh', 'cliente-list', 'cadastro-clientes', 'upsells'],
  design: ['design'],
  editor_video: ['editor-video', 'atrizes-gravacao'],
  devs: ['devs', 'design'],
  atrizes_gravacao: ['atrizes-gravacao', 'editor-video'],
  produtora: ['produtora'],
  gestor_crm: ['gestor-crm'],
  consultor_comercial: ['consultor-comercial'],
  consultor_mktplace: ['consultor-comercial'],
  financeiro: ['financeiro', 'cliente-list', 'comissoes'],
  rh: ['rh'],
};
