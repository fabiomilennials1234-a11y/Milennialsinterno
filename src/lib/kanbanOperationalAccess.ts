import { FEATURE_FLAGS } from '@/lib/featureFlags';
import type { UserRole } from '@/types/auth';

export function resolveKanbanPageSlug(boardSlug: string | undefined | null): string | null {
  const normalized = (boardSlug || '').toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('design')) return 'design';
  if (normalized.includes('video') || normalized.includes('editor')) return 'editor-video';
  if (normalized.includes('dev')) return 'devs';
  if (normalized.includes('produtora')) return 'produtora';
  if (normalized.includes('crm')) return 'gestor-crm';
  if (normalized.includes('comercial') || normalized.includes('paddock')) return 'consultor-comercial';
  if (normalized.includes('ads') || normalized.includes('trafego')) return 'gestor-ads';
  if (normalized.includes('sucesso')) return 'sucesso-cliente';
  if (normalized.includes('mktplace')) return 'consultor-mktplace';
  if (normalized.includes('financeiro')) return 'financeiro';
  if (normalized.includes('rh')) return 'rh';
  if (normalized.includes('outbound')) return 'outbound';
  return null;
}

export function canOperateKanban({
  role,
  isAdmin,
  pageSlug,
  pageGrants,
  legacyCan,
}: {
  role: UserRole | null | undefined;
  isAdmin: boolean;
  pageSlug: string | null;
  pageGrants: readonly string[] | undefined;
  legacyCan: (role: UserRole | null) => boolean;
}) {
  if (isAdmin) return true;
  if (legacyCan((role ?? null) as UserRole | null)) return true;
  if (!FEATURE_FLAGS.USE_PAGE_GRANTS) return false;
  return !!pageSlug && !!pageGrants?.includes(pageSlug);
}
