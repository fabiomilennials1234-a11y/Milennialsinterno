import { DEFAULT_PAGES_BY_ROLE } from '@/lib/pageCatalog';
import type { UserRole } from '@/types/auth';

export interface EffectivePageGrantSets {
  roleDefaultPages: string[];
  directPages: string[];
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();
}

export function buildEffectivePageGrantSets({
  role,
  additionalPages = [],
  canAccessMtech = false,
}: {
  role: UserRole;
  additionalPages?: string[];
  canAccessMtech?: boolean;
}): EffectivePageGrantSets {
  return {
    roleDefaultPages: uniqueSorted(DEFAULT_PAGES_BY_ROLE[role] ?? []),
    directPages: uniqueSorted([
      ...additionalPages,
      ...(canAccessMtech ? ['mtech'] : []),
    ]),
  };
}
