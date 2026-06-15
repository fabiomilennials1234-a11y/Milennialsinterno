import { useMemo, useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Loader2, Layers, Zap, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MetaAdAccount } from '@/hooks/useMetaAdsAccounts';

const ALL_ACCOUNTS = 'all';

interface MetaAdAccountSelectorProps {
  accounts: MetaAdAccount[];
  /** Currently selected account_id, or 'all'. */
  value: string;
  onChange: (value: string) => void;
  /** account_id currently being synced (on_demand switch), if any. */
  syncingAccountId?: string | null;
  className?: string;
}

/**
 * World-class account selector built for scale (184+ accounts).
 *
 * Why a Combobox over a flat <Select>: at 184 items a plain list is hostile —
 * no search, infinite scroll, the principal account buried mid-list. cmdk gives
 * us type-to-filter for free; grouping (Visão geral / Principal / Clientes)
 * carries the hierarchy the founder needs: the daily-driver account is pinned,
 * client accounts are searchable, "Todas as contas" is a deliberate aggregate.
 *
 * Sync affordance: on_demand accounts are pulled lazily on switch, so we hint
 * "sob demanda" on the item and surface a live spinner while the scoped sync
 * runs — visible but never blocking.
 *
 * Scale note: cmdk renders all items and filters the DOM. 184 is comfortable.
 * Past ~500 accounts this should adopt list virtualization (e.g. @tanstack/
 * react-virtual inside CommandList) — documented limit, not a today problem.
 */
export function MetaAdAccountSelector({
  accounts,
  value,
  onChange,
  syncingAccountId,
  className,
}: MetaAdAccountSelectorProps) {
  const [open, setOpen] = useState(false);

  const { principal, clients } = useMemo(() => {
    const principal = accounts.find(a => a.is_principal) ?? null;
    const clients = accounts.filter(a => !a.is_principal);
    return { principal, clients };
  }, [accounts]);

  const selected = useMemo(
    () => accounts.find(a => a.account_id === value) ?? null,
    [accounts, value],
  );

  const handleSelect = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  // Trigger label + leading mark. 'all' and the principal each read distinct.
  const isAll = value === ALL_ACCOUNTS;
  const triggerLabel = isAll
    ? 'Todas as contas'
    : selected?.account_name ?? 'Selecionar conta';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={`Conta selecionada: ${triggerLabel}. Alterar.`}
          className={cn('glass justify-start gap-2 min-w-[200px] max-w-[260px] font-normal', className)}
        >
          {isAll ? (
            <Layers size={14} className="shrink-0 text-muted-foreground" />
          ) : selected?.is_principal ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-farol glow-farol-sm" />
          ) : (
            <Building2 size={14} className="shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-foreground font-medium">{triggerLabel}</span>
          <ChevronsUpDown size={13} className="ml-auto shrink-0 text-muted-foreground/60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0 overflow-hidden"
        align="end"
      >
        {/* cmdk's default filter matches each item's value + keywords, so passing
            the account name as a keyword lets users search by name or id. */}
        <Command>
          <CommandInput placeholder="Buscar conta..." />
          <CommandList className="max-h-[340px]">
            <CommandEmpty>
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-foreground">Nenhuma conta encontrada</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tente outro nome ou ID de conta.
                </p>
              </div>
            </CommandEmpty>

            <CommandGroup heading="Visão geral">
              <CommandItem
                value={ALL_ACCOUNTS}
                keywords={['todas', 'all', 'agregado']}
                onSelect={() => handleSelect(ALL_ACCOUNTS)}
                className="gap-2.5 py-2"
              >
                <Layers size={15} className="shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-foreground">Todas as contas</span>
                  <span className="text-[11px] text-muted-foreground">
                    Agregado de todas as {accounts.length} contas
                  </span>
                </div>
                {value === ALL_ACCOUNTS && (
                  <Check size={15} className="ml-auto shrink-0 text-farol" />
                )}
              </CommandItem>
            </CommandGroup>

            {principal && (
              <CommandGroup heading="Principal">
                <AccountItem
                  account={principal}
                  selected={value === principal.account_id}
                  syncing={syncingAccountId === principal.account_id}
                  onSelect={handleSelect}
                />
              </CommandGroup>
            )}

            {clients.length > 0 && (
              <CommandGroup heading={`Clientes · ${clients.length}`}>
                {clients.map(acc => (
                  <AccountItem
                    key={acc.account_id}
                    account={acc}
                    selected={value === acc.account_id}
                    syncing={syncingAccountId === acc.account_id}
                    onSelect={handleSelect}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface AccountItemProps {
  account: MetaAdAccount;
  selected: boolean;
  syncing: boolean;
  onSelect: (value: string) => void;
}

function AccountItem({ account, selected, syncing, onSelect }: AccountItemProps) {
  const onDemand = account.sync_policy === 'on_demand';

  return (
    <CommandItem
      value={account.account_id}
      keywords={[account.account_name]}
      onSelect={() => onSelect(account.account_id)}
      className="gap-2.5 py-2"
    >
      {account.is_principal ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          <span className="h-1.5 w-1.5 rounded-full bg-farol glow-farol-sm" />
        </span>
      ) : (
        <Building2 size={15} className="shrink-0 text-muted-foreground/70" />
      )}

      <div className="flex min-w-0 flex-col">
        <span className="truncate text-foreground">{account.account_name}</span>
        {account.is_principal ? (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Zap size={10} className="text-farol" />
            Sincronização automática
          </span>
        ) : onDemand ? (
          <span className="text-[11px] text-muted-foreground/70">
            {syncing ? 'Sincronizando dados...' : 'Sincroniza ao abrir'}
          </span>
        ) : null}
      </div>

      <span className="ml-auto flex shrink-0 items-center">
        {syncing ? (
          <Loader2 size={14} className="animate-spin text-farol" />
        ) : selected ? (
          <Check size={15} className="text-farol" />
        ) : null}
      </span>
    </CommandItem>
  );
}
