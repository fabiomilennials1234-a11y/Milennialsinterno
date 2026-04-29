import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useAppCapabilities,
  useUserPermissions,
  useSetUserPermissions,
  type UserActionOverride,
  type UserCapabilityGrant,
} from '@/hooks/useUserPermissions';
import {
  KANBAN_ACTIONS,
  KANBAN_PAGE_SLUGS,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type CapabilityCategory,
} from '@/types/permissions';

interface UserPermissionsEditorProps {
  userId: string;
  /** Páginas que o usuário deveria ter por default (passadas pelo modal pai). */
  defaultPagesByRole?: string[];
  /** Quando o admin clica salvar no modal pai, este callback é chamado para
   *  persistir capabilities + action_overrides via RPC. */
  onSave?: (api: {
    capabilityGrants: UserCapabilityGrant[];
    actionOverrides: UserActionOverride[];
  }) => Promise<void> | void;
  className?: string;
}

/**
 * Editor granular de permissões. Lista todas as capabilities de
 * `app_capabilities` agrupadas por categoria, e a matriz de operações
 * kanban (page_slug × action). Permite marcar/desmarcar tudo que o sistema
 * pode conceder.
 */
export default function UserPermissionsEditor({
  userId,
  className,
}: UserPermissionsEditorProps) {
  const { data: capabilities = [], isLoading: loadingCaps } = useAppCapabilities();
  const { data: state, isLoading: loadingState } = useUserPermissions(userId);
  const save = useSetUserPermissions();

  const [openCategories, setOpenCategories] = useState<Record<CapabilityCategory, boolean>>({
    pages: true,
    kanban_actions: true,
    users: false,
    organization: false,
    clients: false,
    financeiro: false,
    rh: false,
    sensitive: false,
    system: false,
  });

  const [capabilityGrants, setCapabilityGrants] = useState<Map<string, boolean>>(new Map());
  const [actionOverrides, setActionOverrides] = useState<Map<string, boolean>>(new Map());

  // Hidrata estado quando carrega state.
  useEffect(() => {
    if (!state) return;
    const caps = new Map<string, boolean>();
    for (const g of state.capability_grants) caps.set(g.key, g.granted);
    setCapabilityGrants(caps);

    const overrides = new Map<string, boolean>();
    for (const o of state.action_overrides) {
      overrides.set(`${o.page_slug}::${o.action}`, o.granted);
    }
    setActionOverrides(overrides);
  }, [state]);

  const capsByCategory = useMemo(() => {
    const grouped = new Map<CapabilityCategory, typeof capabilities>();
    for (const cap of capabilities) {
      const cat = (cap.category || 'system') as CapabilityCategory;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(cap);
    }
    return grouped;
  }, [capabilities]);

  const toggleCategory = (cat: CapabilityCategory) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const setCapabilityGranted = (key: string, granted: boolean | null) => {
    setCapabilityGrants((prev) => {
      const next = new Map(prev);
      if (granted === null) next.delete(key);
      else next.set(key, granted);
      return next;
    });
  };

  const setOverride = (
    pageSlug: string,
    action: UserActionOverride['action'],
    granted: boolean | null,
  ) => {
    const k = `${pageSlug}::${action}`;
    setActionOverrides((prev) => {
      const next = new Map(prev);
      if (granted === null) next.delete(k);
      else next.set(k, granted);
      return next;
    });
  };

  const handleSave = async () => {
    if (!userId) return;
    try {
      const capArr: UserCapabilityGrant[] = Array.from(capabilityGrants.entries()).map(
        ([key, granted]) => ({ key, granted }),
      );
      const overrideArr: UserActionOverride[] = Array.from(actionOverrides.entries()).map(
        ([k, granted]) => {
          const [pageSlug, action] = k.split('::');
          return {
            page_slug: pageSlug,
            action: action as UserActionOverride['action'],
            granted,
          };
        },
      );
      await save.mutateAsync({
        userId,
        capabilityGrants: capArr,
        actionOverrides: overrideArr,
      });
      toast.success('Permissões atualizadas');
    } catch (err) {
      toast.error('Erro ao salvar permissões', {
        description: err instanceof Error ? err.message : 'Tente novamente',
      });
    }
  };

  if (loadingCaps || loadingState) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 size={14} className="animate-spin" />
        Carregando permissões...
      </div>
    );
  }

  const categoriesPresent = CATEGORY_ORDER.filter(
    (cat) => cat === 'kanban_actions' || (capsByCategory.get(cat)?.length ?? 0) > 0,
  );

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Permissões granulares</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Liste tudo que o sistema permite conceder. Marque para conceder, desmarque para
            negar (sobrepõe o default do cargo).
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={save.isPending}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-display font-semibold uppercase hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {save.isPending && <Loader2 size={12} className="animate-spin" />}
          Salvar permissões
        </button>
      </div>

      {categoriesPresent.map((cat) => {
        const isOpen = openCategories[cat];
        const isKanban = cat === 'kanban_actions';
        const caps = capsByCategory.get(cat) ?? [];
        const sensitiveCount = caps.filter((c) => c.is_sensitive).length;

        return (
          <div
            key={cat}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span className="text-sm font-medium text-foreground">
                  {CATEGORY_LABEL[cat]}
                </span>
                {sensitiveCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-warning">
                    <AlertTriangle size={10} />
                    {sensitiveCount} sensível{sensitiveCount > 1 ? 'eis' : ''}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {isKanban ? `${KANBAN_PAGE_SLUGS.length} kanbans × ${KANBAN_ACTIONS.length} ações` : `${caps.length} ${caps.length === 1 ? 'permissão' : 'permissões'}`}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-border p-3 space-y-2">
                {isKanban ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left p-2 font-medium">Kanban</th>
                          {KANBAN_ACTIONS.map((a) => (
                            <th key={a.key} className="text-center p-2 font-medium">
                              {a.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {KANBAN_PAGE_SLUGS.map((p) => (
                          <tr key={p.slug} className="border-b border-border/50 last:border-0">
                            <td className="p-2 text-foreground font-medium">{p.label}</td>
                            {KANBAN_ACTIONS.map((a) => {
                              const k = `${p.slug}::${a.key}`;
                              const value = actionOverrides.get(k);
                              return (
                                <td key={a.key} className="text-center p-2">
                                  <select
                                    value={value === undefined ? 'default' : value ? 'granted' : 'denied'}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      if (v === 'default') setOverride(p.slug, a.key, null);
                                      else setOverride(p.slug, a.key, v === 'granted');
                                    }}
                                    className="text-[11px] rounded-md bg-muted/50 border border-border px-1 py-0.5"
                                  >
                                    <option value="default">— (default)</option>
                                    <option value="granted">✓ Permitir</option>
                                    <option value="denied">✗ Negar</option>
                                  </select>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      "default" = segue matriz do cargo. "Permitir" / "Negar" = override explícito.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {caps.map((cap) => {
                      const value = capabilityGrants.get(cap.key);
                      return (
                        <div
                          key={cap.key}
                          className={cn(
                            'flex items-start gap-3 p-2.5 rounded-lg border',
                            cap.is_sensitive
                              ? 'bg-warning/5 border-warning/30'
                              : 'bg-muted/30 border-border',
                          )}
                        >
                          <select
                            value={value === undefined ? 'default' : value ? 'granted' : 'denied'}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === 'default') setCapabilityGranted(cap.key, null);
                              else setCapabilityGranted(cap.key, v === 'granted');
                            }}
                            className="text-[11px] rounded-md bg-card border border-border px-1.5 py-1 min-w-[110px]"
                          >
                            <option value="default">— (default)</option>
                            <option value="granted">✓ Permitir</option>
                            <option value="denied">✗ Negar</option>
                          </select>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {cap.label}
                              </span>
                              {cap.is_sensitive && (
                                <AlertTriangle size={11} className="text-warning" />
                              )}
                              <code className="text-[10px] text-muted-foreground/80 font-mono">
                                {cap.key}
                              </code>
                            </div>
                            {cap.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {cap.description}
                              </p>
                            )}
                            {cap.default_roles?.length > 0 && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                Default: {cap.default_roles.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
