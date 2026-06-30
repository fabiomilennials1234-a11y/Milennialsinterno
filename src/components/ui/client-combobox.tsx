import * as React from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ClientComboboxItem {
  id: string;
  name: string;
  razao_social?: string | null;
}

/**
 * Nome canônico do cliente para exibição. razao_social ("Nome Completo / Razão
 * Social", obrigatório no cadastro) é o identificador; name ("nome fantasia ou
 * apelido") é fallback quando razao_social está vazio.
 */
export function clientDisplayName(item: ClientComboboxItem): string {
  const razao = item.razao_social?.trim();
  return razao || item.name;
}

interface ClientComboboxProps {
  value: string | null;
  onChange: (id: string, name: string) => void;
  clients: ClientComboboxItem[];
  /**
   * Cliente atual vindo de contexto externo (ex: olhinho do cliente).
   * Se não estiver presente em `clients` (arquivado, fora do escopo do consultor),
   * é mostrado num grupo "Selecionado" separado no topo da lista, garantindo que
   * a troca não cancele a referência inicial.
   */
  currentFallback?: ClientComboboxItem | null;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function ClientCombobox({
  value,
  onChange,
  clients,
  currentFallback,
  isLoading = false,
  disabled = false,
  placeholder = 'Selecionar cliente…',
  emptyMessage = 'Nenhum cliente encontrado.',
  className,
}: ClientComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Mescla fallback (cliente atual) caso ele não exista na lista principal — ex: arquivado
  const fallbackOutsideList =
    currentFallback && !clients.some(c => c.id === currentFallback.id)
      ? currentFallback
      : null;

  const selected =
    clients.find(c => c.id === value) ??
    (fallbackOutsideList && fallbackOutsideList.id === value ? fallbackOutsideList : null);

  const triggerLabel = selected
    ? clientDisplayName(selected)
    : isLoading
      ? 'Carregando clientes…'
      : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Selecionar cliente"
          disabled={disabled || isLoading}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-60" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
        align="start"
      >
        <Command
          filter={(value, search) => {
            // Busca case/accent-insensitive; cmdk passa "value" no formato lowercased
            const norm = (s: string) =>
              s
                .toLowerCase()
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '');
            return norm(value).includes(norm(search)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar cliente por nome…" />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>

            {fallbackOutsideList && (
              <>
                <CommandGroup heading="Selecionado">
                  <ClientItem
                    item={fallbackOutsideList}
                    selected={value === fallbackOutsideList.id}
                    onSelect={() => {
                      onChange(fallbackOutsideList.id, clientDisplayName(fallbackOutsideList));
                      setOpen(false);
                    }}
                  />
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading={fallbackOutsideList ? 'Disponíveis' : undefined}>
              {clients.map(c => (
                <ClientItem
                  key={c.id}
                  item={c}
                  selected={value === c.id}
                  onSelect={() => {
                    onChange(c.id, clientDisplayName(c));
                    setOpen(false);
                  }}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ClientItem({
  item,
  selected,
  onSelect,
}: {
  item: ClientComboboxItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const primary = clientDisplayName(item);
  // Secundário = nome fantasia/apelido, só quando difere do principal (razão social).
  const secondary = item.name.trim() && item.name.trim() !== primary ? item.name : null;

  // value combina os campos pesquisáveis pra cmdk filtrar bem (fantasia E empresa)
  const searchValue = `${item.name} ${item.razao_social ?? ''}`.trim();

  return (
    <CommandItem
      value={searchValue}
      onSelect={onSelect}
      className="flex items-center gap-2"
    >
      <Check
        className={cn(
          'h-4 w-4 shrink-0',
          selected ? 'opacity-100 text-primary' : 'opacity-0',
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{primary}</div>
        {secondary && (
          <div className="text-[11px] text-muted-foreground truncate">{secondary}</div>
        )}
      </div>
    </CommandItem>
  );
}
