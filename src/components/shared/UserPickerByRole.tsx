import * as React from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface UserPickerByRoleProps {
  role: string;
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface RoleUser {
  user_id: string;
  name: string;
}

// Pattern espelha ClientCombobox: Popover + cmdk Command. Filtro accent-insensitive.
// Suporta clear via botão X quando há valor selecionado.
export function UserPickerByRole({
  role,
  value,
  onChange,
  placeholder = 'Selecionar responsável…',
  disabled = false,
  className,
}: UserPickerByRoleProps) {
  const [open, setOpen] = React.useState(false);

  const { data: users = [], isLoading } = useQuery<RoleUser[]>({
    queryKey: ['role-users', role],
    queryFn: async () => {
      const { data: roleRows, error: roleErr } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', role as never);
      if (roleErr) throw roleErr;
      const ids = (roleRows || []).map(r => r.user_id);
      if (ids.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', ids);
      if (pErr) throw pErr;
      return ((profiles || []) as { user_id: string; name: string | null }[])
        .filter(p => !!p.name)
        .map(p => ({ user_id: p.user_id, name: p.name as string }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
    staleTime: 5 * 60 * 1000,
  });

  const selected = users.find(u => u.user_id === value) ?? null;
  const triggerLabel = selected
    ? selected.name
    : isLoading
      ? 'Carregando…'
      : placeholder;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <span className="ml-2 flex items-center gap-1 shrink-0">
            {selected && !disabled && (
              <span
                role="button"
                aria-label="Limpar seleção"
                onClick={handleClear}
                className="opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </span>
            )}
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin opacity-60" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 opacity-60" />
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[260px] p-0"
        align="start"
      >
        <Command
          filter={(value, search) => {
            const norm = (s: string) =>
              s
                .toLowerCase()
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '');
            return norm(value).includes(norm(search)) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar por nome…" />
          <CommandList>
            <CommandEmpty>
              Nenhum responsável de {prettyRole(role)} cadastrado
            </CommandEmpty>
            <CommandGroup>
              {users.map(u => (
                <CommandItem
                  key={u.user_id}
                  value={u.name}
                  onSelect={() => {
                    onChange(u.user_id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === u.user_id ? 'opacity-100 text-primary' : 'opacity-0',
                    )}
                  />
                  <span className="text-sm font-medium text-foreground truncate">
                    {u.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function prettyRole(role: string): string {
  const map: Record<string, string> = {
    sucesso_cliente: 'Sucesso do Cliente',
    gestor_crm: 'Gestor de CRM',
    consultor_comercial: 'Treinador Comercial',
    gestor_ads: 'Gestor de Ads',
  };
  return map[role] ?? role;
}
