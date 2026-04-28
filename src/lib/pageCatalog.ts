import { ROLE_PAGE_MATRIX, type UserRole } from '@/types/auth';

// Catálogo canônico de páginas no frontend.
// Espelha o que foi semeado em app_pages pela migration 20260420170000.
// Single source of truth — o Create/Edit UserModal e o divergence logger
// consomem daqui. Se o catálogo divergir da migration, o dual-read vai gritar.
export const ALL_PAGES = [
  { id: 'gestor-ads', label: 'Gestão de Tráfego PRO+', icon: '📊' },
  { id: 'sucesso-cliente', label: 'Sucesso do Cliente PRO+', icon: '🤝' },
  { id: 'consultor-comercial', label: 'Treinador Comercial PRO+', icon: '💼' },
  { id: 'consultor-mktplace', label: 'Consultor(a) de MKT Place PRO+', icon: '🛒' },
  { id: 'outbound', label: 'Outbound PRO+', icon: '🎯' },
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

// Páginas padrão por cargo — DERIVADO de ROLE_PAGE_MATRIX (single source of truth).
// Garante que o que o admin "anuncia" no modal == o que o runtime entrega.
// Antes desse refactor essas duas listas viviam em 5 arquivos diferentes
// e divergiram em 11 gaps duros (ver task #23).
export const DEFAULT_PAGES_BY_ROLE: Record<UserRole, string[]> = (() => {
  const out = {} as Record<UserRole, string[]>;
  for (const role of Object.keys(ROLE_PAGE_MATRIX) as UserRole[]) {
    if (role === 'ceo' || role === 'cto' || role === 'gestor_projetos') {
      out[role] = ALL_PAGE_IDS;
      continue;
    }
    out[role] = ROLE_PAGE_MATRIX[role].map(e => e.pageSlug);
  }
  return out;
})();
