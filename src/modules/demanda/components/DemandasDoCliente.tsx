// Módulo `demanda` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 4 (#80) — painel "Demandas do cliente".
// Vive na área/card de um cliente, ao lado de Equipe e Card Universal. Lista as
// demandas (unidades de trabalho) daquele cliente — atravessando áreas — e permite
// criar uma nova e vincular um card de domínio existente a ela.
//
// Contexto de uso: gestores abrem a área do cliente para enxergar "o que está sendo
// feito" para ele. É leitura na maior parte do tempo; criar/vincular é ocasional —
// por isso a lista é o herói e as ações são discretas. Audiência herdada do cliente
// (quem vê o cliente vê as demandas; gate no contrato + RLS, ADR 0005).

import { useState } from "react";
import {
  AlertTriangle,
  Link2,
  ListTodo,
  Loader2,
  Plus,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useDemandas, useDemandaMutations } from "../lib/useDemandas";
import type { Demanda } from "../lib/demandas";

interface Props {
  clientId: string;
  /** Nome do cliente — usado na copy do estado vazio e do diálogo. */
  clientName?: string;
  className?: string;
}

function permissaoNaMsg(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : "";
  return /denied|permission|42501/i.test(msg);
}

export function DemandasDoCliente({ clientId, clientName, className }: Props) {
  const { data: demandas, isLoading, isError, refetch, isRefetching } =
    useDemandas(clientId);
  const { criar, vincular } = useDemandaMutations(clientId);

  const [criarAberto, setCriarAberto] = useState(false);
  const [vincularAlvo, setVincularAlvo] = useState<Demanda | null>(null);

  const total = demandas?.length ?? 0;

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
          <ListTodo className="h-[18px] w-[18px] text-mtech-text-subtle" aria-hidden />
          <h3 className="text-title text-mtech-text">Demandas do cliente</h3>
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
            onClick={() => setCriarAberto(true)}
            className="h-8 gap-1.5 border-mtech-border bg-transparent text-caption text-mtech-text hover:border-mtech-border-strong hover:bg-mtech-surface-elev"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova demanda
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
          <EstadoVazio clientName={clientName} onCriar={() => setCriarAberto(true)} />
        ) : (
          <ul className="space-y-0.5">
            {demandas!.map((d) => (
              <LinhaDemanda key={d.id} demanda={d} onVincular={() => setVincularAlvo(d)} />
            ))}
          </ul>
        )}
      </div>

      <CriarDemandaDialog
        open={criarAberto}
        onOpenChange={setCriarAberto}
        clientName={clientName}
        salvando={criar.isPending}
        onCriar={async (titulo, dominio) => {
          try {
            await criar.mutateAsync({ titulo, dominio });
            toast.success("Demanda criada.");
            setCriarAberto(false);
          } catch (e) {
            toast.error(
              permissaoNaMsg(e)
                ? "Você não tem permissão para criar demandas neste cliente."
                : "Não foi possível criar a demanda. Tente novamente.",
            );
          }
        }}
      />

      <VincularCardDialog
        demanda={vincularAlvo}
        onOpenChange={(o) => !o && setVincularAlvo(null)}
        salvando={vincular.isPending}
        onVincular={async (cardRef) => {
          if (!vincularAlvo) return;
          try {
            await vincular.mutateAsync({ demandaId: vincularAlvo.id, cardRef });
            toast.success("Card vinculado à demanda.");
            setVincularAlvo(null);
          } catch (e) {
            toast.error(
              permissaoNaMsg(e)
                ? "Você não tem permissão para vincular cards a esta demanda."
                : "Não foi possível vincular. Confira o ID do card e tente de novo.",
            );
          }
        }}
      />
    </section>
  );
}

// ============================ Linha de demanda ============================

function LinhaDemanda({
  demanda,
  onVincular,
}: {
  demanda: Demanda;
  onVincular: () => void;
}) {
  return (
    <li className="group flex items-start gap-3 rounded-[var(--mtech-radius-md)] px-3 py-2.5 transition-colors hover:bg-mtech-surface-elev">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--mtech-radius-md)] border border-mtech-border bg-mtech-surface-elev">
        <ListTodo className="h-4 w-4 text-mtech-text-subtle" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium leading-tight text-mtech-text">
          {demanda.titulo}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ChipStatus status={demanda.status} />
          {demanda.dominio && <ChipDominio dominio={demanda.dominio} />}
          <span className="text-caption text-mtech-text-subtle">{tempoRelativo(demanda.created_at)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onVincular}
        aria-label={`Vincular card à demanda ${demanda.titulo}`}
        className="mt-0.5 inline-flex h-7 items-center gap-1.5 rounded-[var(--mtech-radius-md)] px-2 text-caption text-mtech-text-subtle opacity-70 transition-all hover:bg-mtech-surface hover:text-mtech-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mtech-border-strong [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-70 hover:!opacity-100"
      >
        <Link2 className="h-3.5 w-3.5" />
        Vincular card
      </button>
    </li>
  );
}

function ChipStatus({ status }: { status: string }) {
  // Tom semântico: aberta/em andamento = accent vivo; concluída = neutro calmo.
  const concluida = /conclu|done|fech|encerr/i.test(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-caption font-medium",
        concluida
          ? "border-mtech-border bg-mtech-surface-elev text-mtech-text-subtle"
          : "border-mtech-accent/30 bg-mtech-accent/10 text-mtech-accent",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          concluida ? "bg-mtech-text-subtle" : "bg-mtech-accent",
        )}
        aria-hidden
      />
      {status}
    </span>
  );
}

function ChipDominio({ dominio }: { dominio: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-mtech-border bg-transparent px-2 py-0.5 text-caption font-medium text-mtech-text-muted">
      {dominio}
    </span>
  );
}

// ============================ Diálogos ============================

function CriarDemandaDialog({
  open,
  onOpenChange,
  clientName,
  salvando,
  onCriar,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientName?: string;
  salvando: boolean;
  onCriar: (titulo: string, dominio: string | null) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [dominio, setDominio] = useState("");

  function reset() {
    setTitulo("");
    setDominio("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="mtech-scope border-mtech-border bg-mtech-surface sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-mtech-text">Nova demanda</DialogTitle>
          <DialogDescription className="text-mtech-text-muted">
            A unidade de trabalho{clientName ? ` de ${clientName}` : " do cliente"} — ex.: “Landing
            page”, “Campanha de lançamento”. Pode cruzar áreas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="demanda-titulo" className="text-caption text-mtech-text-muted">
              Título
            </Label>
            <Input
              id="demanda-titulo"
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Landing page do lançamento"
              className="border-mtech-border bg-mtech-surface-elev text-mtech-text placeholder:text-mtech-text-subtle focus-visible:ring-mtech-border-strong"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demanda-dominio" className="text-caption text-mtech-text-muted">
              Domínio <span className="text-mtech-text-subtle">(opcional)</span>
            </Label>
            <Input
              id="demanda-dominio"
              value={dominio}
              onChange={(e) => setDominio(e.target.value)}
              placeholder="design · dev · vídeo · ads…"
              className="border-mtech-border bg-mtech-surface-elev text-mtech-text placeholder:text-mtech-text-subtle focus-visible:ring-mtech-border-strong"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="border-mtech-border bg-transparent text-mtech-text hover:bg-mtech-surface-elev"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onCriar(titulo.trim(), dominio.trim() || null)}
            disabled={salvando || titulo.trim() === ""}
            className="gap-2 bg-mtech-accent text-mtech-bg hover:bg-mtech-accent/90"
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VincularCardDialog({
  demanda,
  onOpenChange,
  salvando,
  onVincular,
}: {
  demanda: Demanda | null;
  onOpenChange: (o: boolean) => void;
  salvando: boolean;
  onVincular: (cardRef: string) => void;
}) {
  const [cardRef, setCardRef] = useState("");

  return (
    <Dialog
      open={demanda !== null}
      onOpenChange={(o) => {
        if (!o) setCardRef("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="mtech-scope border-mtech-border bg-mtech-surface sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-mtech-text">Vincular card</DialogTitle>
          <DialogDescription className="text-mtech-text-muted">
            Ligue um card de execução existente a{" "}
            <span className="text-mtech-text">{demanda?.titulo}</span>. Cole o ID do card do board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-1">
          <Label htmlFor="card-ref" className="text-caption text-mtech-text-muted">
            ID do card
          </Label>
          <Input
            id="card-ref"
            autoFocus
            value={cardRef}
            onChange={(e) => setCardRef(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            data-mono
            className="border-mtech-border bg-mtech-surface-elev font-mono text-mtech-text placeholder:text-mtech-text-subtle focus-visible:ring-mtech-border-strong"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="border-mtech-border bg-transparent text-mtech-text hover:bg-mtech-surface-elev"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onVincular(cardRef.trim())}
            disabled={salvando || cardRef.trim() === ""}
            className="gap-2 bg-mtech-accent text-mtech-bg hover:bg-mtech-accent/90"
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================ Estados ============================

function ListaSkeleton() {
  return (
    <ul className="space-y-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-start gap-3 px-3 py-2.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-[var(--mtech-radius-md)] bg-mtech-surface-elev" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-44 bg-mtech-surface-elev" />
            <Skeleton className="h-3 w-24 rounded-full bg-mtech-surface-elev" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EstadoVazio({
  clientName,
  onCriar,
}: {
  clientName?: string;
  onCriar: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-mtech-border bg-mtech-surface-elev">
        <ListTodo className="h-5 w-5 text-mtech-text-subtle" aria-hidden />
      </div>
      <p className="mt-4 text-body font-medium text-mtech-text">Nenhuma demanda ainda</p>
      <p className="mt-1 max-w-[38ch] text-caption text-mtech-text-muted">
        Dê nome ao que está sendo feito{clientName ? ` para ${clientName}` : " para este cliente"} —
        uma demanda agrupa os cards de execução de uma mesma entrega.
      </p>
      <Button
        size="sm"
        onClick={onCriar}
        className="mt-5 gap-1.5 bg-mtech-accent text-mtech-bg hover:bg-mtech-accent/90"
      >
        <Plus className="h-3.5 w-3.5" />
        Criar primeira demanda
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
      <p className="mt-4 text-body font-medium text-mtech-text">Não foi possível carregar as demandas</p>
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

// ============================ utils ============================

/** Tempo relativo curto e honesto — "agora", "há 3 d", "há 2 sem". */
function tempoRelativo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "agora";
  const min = Math.floor(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  const sem = Math.floor(d / 7);
  if (sem < 5) return `há ${sem} sem`;
  const meses = Math.floor(d / 30);
  if (meses < 12) return `há ${meses} mes${meses > 1 ? "es" : ""}`;
  return `há ${Math.floor(d / 365)} ano${Math.floor(d / 365) > 1 ? "s" : ""}`;
}
