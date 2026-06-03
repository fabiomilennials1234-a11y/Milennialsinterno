// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 2 (#78) — adicionar um Envolvido ao cliente.
// Dois campos, um caminho: escolher pessoa (busca) -> escolher papel -> adicionar.
// Deliberadamente NÃO é uma página: é a ação mais curta para a tarefa mais comum
// do painel. Modal pequeno (2 campos), foco automático na busca.

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { PapelNoCliente } from "../lib/envolvidos";
import { PAPEL_LABEL, PAPEL_ORDER, iniciais } from "../lib/papeis";
import { usePessoasSelecionaveis, type Pessoa } from "../lib/diretorio";
import { useEnvolvidoMutations } from "../lib/useEnvolvidos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  /** user_ids já envolvidos — para esmaecer no seletor (evita re-adição inútil). */
  jaEnvolvidos: string[];
}

export function AdicionarEnvolvidoDialog({
  open,
  onOpenChange,
  clientId,
  jaEnvolvidos,
}: Props) {
  const { data: pessoas = [], isLoading } = usePessoasSelecionaveis();
  const { adicionar } = useEnvolvidoMutations(clientId);

  const [pessoaSel, setPessoaSel] = useState<Pessoa | null>(null);
  const [papel, setPapel] = useState<PapelNoCliente | "">("");
  const [buscaAberta, setBuscaAberta] = useState(false);

  const envolvidosSet = useMemo(() => new Set(jaEnvolvidos), [jaEnvolvidos]);
  const saving = adicionar.isPending;
  const podeAdicionar = Boolean(pessoaSel && papel) && !saving;

  function reset() {
    setPessoaSel(null);
    setPapel("");
    setBuscaAberta(false);
  }

  function fechar(proximo: boolean) {
    if (saving) return;
    if (!proximo) reset();
    onOpenChange(proximo);
  }

  async function submeter() {
    if (!pessoaSel || !papel) return;
    try {
      await adicionar.mutateAsync({ userId: pessoaSel.user_id, papel });
      toast.success(`${pessoaSel.nome} adicionado como ${PAPEL_LABEL[papel]}.`);
      reset();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao adicionar.";
      toast.error(
        /denied|permission/i.test(msg)
          ? "Você não tem permissão para adicionar envolvidos neste cliente."
          : "Não foi possível adicionar. Tente novamente.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-md mtech-scope border-mtech-border bg-mtech-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-mtech-text">
            <UserPlus className="h-[18px] w-[18px] text-mtech-accent" />
            Adicionar à equipe
          </DialogTitle>
          <DialogDescription className="text-mtech-text-muted">
            Escolha a pessoa e o papel que ela exerce neste cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Pessoa */}
          <div className="space-y-1.5">
            <Label className="text-caption font-medium text-mtech-text-muted">Pessoa</Label>
            <Popover open={buscaAberta} onOpenChange={setBuscaAberta}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={buscaAberta}
                  aria-label="Selecionar pessoa"
                  disabled={isLoading || saving}
                  className={cn(
                    "w-full justify-between border-mtech-border bg-mtech-input-bg font-normal text-mtech-text hover:bg-mtech-surface-elev",
                    !pessoaSel && "text-mtech-text-subtle",
                  )}
                >
                  {pessoaSel ? (
                    <span className="flex items-center gap-2 truncate">
                      <Avatar className="h-5 w-5">
                        {pessoaSel.avatar && <AvatarImage src={pessoaSel.avatar} alt="" />}
                        <AvatarFallback className="bg-mtech-surface-elev text-[10px] text-mtech-text-muted">
                          {iniciais(pessoaSel.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{pessoaSel.nome}</span>
                    </span>
                  ) : isLoading ? (
                    "Carregando pessoas…"
                  ) : (
                    "Buscar pessoa…"
                  )}
                  {isLoading ? (
                    <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-60" />
                  ) : (
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] min-w-[300px] border-mtech-border bg-mtech-surface p-0"
                align="start"
              >
                <Command
                  filter={(value, search) => {
                    const norm = (s: string) =>
                      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
                    return norm(value).includes(norm(search)) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="Buscar por nome…" />
                  <CommandList>
                    <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
                    <CommandGroup>
                      {pessoas.map((p) => {
                        const jaEsta = envolvidosSet.has(p.user_id);
                        const selecionada = pessoaSel?.user_id === p.user_id;
                        return (
                          <CommandItem
                            key={p.user_id}
                            value={p.nome}
                            onSelect={() => {
                              setPessoaSel(p);
                              setBuscaAberta(false);
                            }}
                            className="flex items-center gap-2.5"
                          >
                            <Avatar className="h-6 w-6">
                              {p.avatar && <AvatarImage src={p.avatar} alt="" />}
                              <AvatarFallback className="bg-mtech-surface-elev text-[10px] text-mtech-text-muted">
                                {iniciais(p.nome)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate">{p.nome}</span>
                            {jaEsta && (
                              <span className="text-[11px] text-mtech-text-subtle">já na equipe</span>
                            )}
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0 text-mtech-accent",
                                selecionada ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Papel */}
          <div className="space-y-1.5">
            <Label className="text-caption font-medium text-mtech-text-muted">Papel no cliente</Label>
            <Select
              value={papel}
              onValueChange={(v) => setPapel(v as PapelNoCliente)}
              disabled={saving}
            >
              <SelectTrigger
                aria-label="Selecionar papel"
                className="border-mtech-border bg-mtech-input-bg text-mtech-text"
              >
                <SelectValue placeholder="Selecionar papel…" />
              </SelectTrigger>
              <SelectContent className="border-mtech-border bg-mtech-surface">
                {PAPEL_ORDER.map((p) => (
                  <SelectItem key={p} value={p} className="text-mtech-text">
                    {PAPEL_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => fechar(false)}
            disabled={saving}
            className="text-mtech-text-muted hover:bg-mtech-surface-elev hover:text-mtech-text"
          >
            Cancelar
          </Button>
          <Button
            onClick={submeter}
            disabled={!podeAdicionar}
            className="gap-2 bg-mtech-accent text-mtech-bg hover:bg-mtech-accent/90"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adicionando…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Adicionar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
