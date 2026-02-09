import { cn } from '@/lib/utils';

// Mapeamento de slugs para nomes amigáveis e cores
export const PRODUCT_CONFIG: Record<string, { name: string; color: string }> = {
  'millennials-growth': { name: 'Growth', color: 'bg-primary/10 text-primary border-primary/20' },
  'millennials-outbound': { name: 'Outbound', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  'on-demand': { name: 'ON Demand', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  'catalog-terceirizacao': { name: 'Catalog', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  'zydon': { name: 'Zydon', color: 'bg-teal-500/10 text-teal-600 border-teal-500/20' },
  'septem': { name: 'Septem', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
  'vendedor-pastinha-comunidade': { name: 'VP Comunidade', color: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
  'b2b-club': { name: 'B2B Club', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  'forja': { name: 'Forja', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  'millennials-paddock': { name: 'Paddock', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  'vendedor-pastinha-educacional': { name: 'VP Educacional', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  'torque-crm': { name: 'Torque CRM', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  'millennials-hunting': { name: 'Hunting', color: 'bg-lime-500/10 text-lime-600 border-lime-500/20' },
  'organic': { name: 'Organic', color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  'catalog-saas': { name: 'Catalog SAAS', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  'b2b-summit': { name: 'B2B Summit', color: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
};

interface ProductBadgesProps {
  products: string[] | null | undefined;
  size?: 'sm' | 'md';
  maxVisible?: number;
}

export default function ProductBadges({ products, size = 'sm', maxVisible = 3 }: ProductBadgesProps) {
  if (!products || products.length === 0) {
    return null;
  }

  const visibleProducts = products.slice(0, maxVisible);
  const hiddenCount = products.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleProducts.map((slug) => {
        const config = PRODUCT_CONFIG[slug];
        if (!config) return null;

        return (
          <span
            key={slug}
            className={cn(
              'inline-flex items-center rounded-full border font-medium',
              config.color,
              size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
            )}
          >
            {config.name}
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span
          className={cn(
            'inline-flex items-center rounded-full bg-muted text-muted-foreground font-medium',
            size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
          )}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
