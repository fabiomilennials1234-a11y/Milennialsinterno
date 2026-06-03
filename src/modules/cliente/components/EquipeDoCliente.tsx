// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 2 (#78) — painel "Equipe do cliente".
// Vive na área/card de um cliente. Mostra quem atende aquele cliente (Envolvidos),
// agrupado por pessoa (uma linha por pessoa, N chips de papel). Permite adicionar
// e remover (por papel — a unidade real do contrato é (user, papel)).
//
// Contexto de uso: gestores abrem a área do cliente para entender "quem está
// nisso" antes de uma reunião/decisão. É leitura na maior parte do tempo; a
// escrita (adicionar/remover) é ocasional. Por isso a lista é o herói e as ações
// são discretas (botão de adicionar no header; remover revelado no hover/foco).

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RotateCw, Users, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { PapelNoCliente } from "../lib/envolvidos";
import { PAPEL_LABEL, PAPEL_ORDER, PAPEL_TONE, iniciais } from "../lib/papeis";
import { usePessoasPorId, type Pessoa } from "../lib/diretorio";
import {
  useEnvolvidos,
  useEnvolvidoMutations,
  type EnvolvidoAgrupado,
} from "../lib/useEnvolvidos";
import { AdicionarEnvolvidoDialog } from "./AdicionarEnvolvidoDialog";

interface Props {
  clientId: string;
  /** Nome do cliente — usado na copy do estado vazio e na confirmação de remoção. */
  clientName?: string;
  className?: string;
}

interface AlvoRemocao {
  userId: string;
  nome: string;
  papel: PapelNoCliente;
}

function ordenarPapeis(papeis: PapelNoCliente[]): PapelNoCliente[] {
  return [...papeis].sort((a, b) => PAPEL_ORDER.indexOf(a) - PAPEL_ORDER.indexOf(b));
}

export function EquipeDoCliente({ clientId, clientName, className }: Props) {
  const { data: envolvidos, isLoading, isError, refetch, isRefetching } =
    useEnvolvidos(clientId);
  const ids = useMemo(() => (envolvidos ?? []).map((e) => e.user_id), [envolvidos]);
  const { data: pessoas = {} } = usePessoasPorId(ids);
  const { remover } = useEnvolvidoMutations(clientId);

  const [adicionarAberto, setAdicionarAberto] = useState(false);
  const [alvo, setAlvo] = useState<AlvoRemocao | null>(null);

  const total = envolvidos?.length ?? 0;

  async function confirmarRemocao() {
    if (!alvo) return;
    try {
      await remover.mutateAsync({ userId: alvo.userId, papel: alvo.papel });
      toast.success(`${alvo.nome} removido de ${PAPEL_LABEL[alvo.papel]}.`);
      setAlvo(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        /denied|permission/i.test(msg)
          ? "Você não tem permissão para remover envolvidos neste cliente."
          : "Não foi possível remover. Tente novamente.",
      );
    }
  }

  return (
    <section
      className={cn(
        "mtech-scope rounded-[var(--mtech-radius-lg)] border border-mtech-border bg-mtech-surface",
        className,
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Users className="h-[18px] w-[18px] text-mtech-text-subtle" aria-hidden />
          <h3 className="text-title text-mtech-text">Equipe do cliente</h3>
          {total > 0 && (
            <span
              data-mono
              className="rounded-full bg-mtech-surface-elev px-2 py-0.5 text-caption text-mtech-text-subtle"
            >
              {total}
            </span>
          )}
        </div>
        {!isLoading && !isError && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdicionarAberto(true)}
            className="h-8 gap-1.5 border-mtech-border bg-transparent text-caption text-mtech-text hover:border-mtech-border-strong hover:bg-mtech-surface-elev"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        )}
      </header>

      <div className="h-px bg-mtech-border" />

      {/* Corpo — estados */}
      <div className="p-2">
        {isLoading ? (
          <ListaSkeleton />
        ) : isError ? (
          <EstadoErro onRetry={() => refetch()} carregando={isRefetching} />
        ) : total === 0 ? (
          <EstadoVazio clientName={clientName} onAdicionar={() => setAdicionarAberto(true)} />
        ) : (
          <ul className="space-y-0.5">
            {envolvidos!.map((env) => (
              <LinhaEnvolvido
                key={env.user_id}
                env={env}
                pessoa={pessoas[env.user_id]}
                onRemover={(papel, nome) => setAlvo({ userId: env.user_id, papel, nome })}
              />
            ))}
          </ul>
        )}
      </div>

      <AdicionarEnvolvidoDialog
        open={adicionarAberto}
        onOpenChange={setAdicionarAberto}
        clientId={clientId}
        jaEnvolvidos={ids}
      />

      <AlertDialog open={alvo !== null} onOpenChange={(o) => !o && setAlvo(null)}>
        <AlertDialogContent className="mtech-scope border-mtech-border bg-mtech-surface">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-mtech-text">Remover da equipe?</AlertDialogTitle>
            <AlertDialogDescription className="text-mtech-text-muted">
              {alvo && (
                <>
                  <span className="text-mtech-text">{alvo.nome}</span> deixará de ser{" "}
                  <span className="text-mtech-text">{PAPEL_LABEL[alvo.papel]}</span>
                  {clientName ? <> de {clientName}</> : null}. Isso pode remover o acesso da
                  pessoa a este cliente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={remover.isPending}
              className="border-mtech-border bg-transparent text-mtech-text hover:bg-mtech-surface-elev"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarRemocao();
              }}
              disabled={remover.isPending}
              className="gap-2 bg-mtech-danger text-white hover:bg-mtech-danger/90"
            >
              {remover.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ============================ Linha de pessoa ============================

function LinhaEnvolvido({
  env,
  pessoa,
  onRemover,
}: {
  env: EnvolvidoAgrupado;
  pessoa: Pessoa | undefined;
  onRemover: (papel: PapelNoCliente, nome: string) => void;
}) {
  const nome = pessoa?.nome ?? "Usuário sem nome";
  const papeis = ordenarPapeis(env.papeis);

  return (
    <li className="group flex items-center gap-3 rounded-[var(--mtech-radius-md)] px-3 py-2.5 transition-colors hover:bg-mtech-surface-elev">
      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-mtech-border">
        {pessoa?.avatar && <AvatarImage src={pessoa.avatar} alt="" />}
        <AvatarFallback className="bg-mtech-surface-elev text-caption font-medium text-mtech-text-muted">
          {iniciais(nome)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium leading-tight text-mtech-text">{nome}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {papeis.map((papel) => (
            <ChipPapel
              key={papel}
              papel={papel}
              onRemover={() => onRemover(papel, nome)}
            />
          ))}
        </div>
      </div>
    </li>
  );
}

function ChipPapel({
  papel,
  onRemover,
}: {
  papel: PapelNoCliente;
  onRemover: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border py-0.5 pl-2 pr-1 text-caption font-medium",
        PAPEL_TONE[papel],
      )}
    >
      {PAPEL_LABEL[papel]}
      <button
        type="button"
        onClick={onRemover}
        aria-label={`Remover papel ${PAPEL_LABEL[papel]}`}
        // Touch (sem hover) — o X fica sempre visível e tocável (default opacity-70).
        // Onde há hover (mouse) o X some e só reaparece no hover/foco da linha:
        // revelação elegante sem deixar a ação inacessível no toque.
        className="rounded-full p-0.5 text-current opacity-70 transition-opacity hover:bg-black/20 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-70 hover:!opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ============================ Estados ============================

function ListaSkeleton() {
  return (
    <ul className="space-y-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full bg-mtech-surface-elev" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32 bg-mtech-surface-elev" />
            <Skeleton className="h-3 w-20 rounded-full bg-mtech-surface-elev" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EstadoVazio({
  clientName,
  onAdicionar,
}: {
  clientName?: string;
  onAdicionar: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-mtech-border bg-mtech-surface-elev">
        <Users className="h-5 w-5 text-mtech-text-subtle" aria-hidden />
      </div>
      <p className="mt-4 text-body font-medium text-mtech-text">Ninguém atende este cliente ainda</p>
      <p className="mt-1 max-w-[36ch] text-caption text-mtech-text-muted">
        Adicione as pessoas que cuidam{clientName ? ` de ${clientName}` : " deste cliente"} para
        dar visibilidade e acesso à equipe certa.
      </p>
      <Button
        size="sm"
        onClick={onAdicionar}
        className="mt-5 gap-1.5 bg-mtech-accent text-mtech-bg hover:bg-mtech-accent/90"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Adicionar primeiro envolvido
      </Button>
    </div>
  );
}

function EstadoErro({ onRetry, carregando }: { onRetry: () => void; carregando: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-mtech-danger/30 bg-mtech-danger/10">
        <AlertTriangle className="h-5 w-5 text-mtech-danger" aria-hidden />
      </div>
      <p className="mt-4 text-body font-medium text-mtech-text">Não foi possível carregar a equipe</p>
      <p className="mt-1 max-w-[36ch] text-caption text-mtech-text-muted">
        Pode ser conexão ou permissão. Tente novamente.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        disabled={carregando}
        className="mt-5 gap-1.5 border-mtech-border bg-transparent text-mtech-text hover:bg-mtech-surface-elev"
      >
        {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
        Tentar de novo
      </Button>
    </div>
  );
}
