// Módulo `painel` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 8 (#84) — o BOARD "Monday" agregado: a vista de pássaro do gestor.
// "Quem faz o quê em qual demanda de qual cliente, e há quanto tempo" — num só
// lugar. Lista TODAS as demandas de TODOS os clientes que o usuário pode ver
// (audiência herdada no banco, ADR 0005), agrupadas por cliente, filtráveis por
// busca / status / domínio / cliente. Cada linha mostra cliente, título, status,
// domínio, Tempo-na-demanda acumulado e — AO VIVO — quem atua agora.
//
// Escala (decisão #84): o estado FRIO (demandas + tempo) vem de UMA query
// (usePainel → demanda.painel_do_usuario). O estado VIVO (presença) é assinado
// LAZY POR VIEWPORT (useEmViewport + usePresencaLazy): só os grupos na tela abrem
// canal Realtime. Custo O(tela), não O(clientes). Ver usePresencaLazy.ts.
//
// Linguagem visual (mtech, dark-first, editorial — Apple/Linear/Stripe): board
// denso mas legível, hierarquia clara (cliente > demanda), tempo como QUANTIDADE
// mono discreta, status/domínio como pills categóricos, presença como o único
// "agora" da linha. Sem animação cíclica (saúde — commit fb3d566).

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  LayoutGrid,
  ListTodo,
  Loader2,
  RotateCw,
  Search,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { BadgeAtuando, formatarTempo } from "@/modules/presenca";

import { usePainel } from "../lib/usePainel";
import { usePresencaLazy } from "../lib/usePresencaLazy";
import { useEmViewport } from "../lib/useEmViewport";
import {
  agruparPorCliente,
  filtrarLinhas,
  opcoesDeFiltro,
  type FiltroPainel,
  type GrupoCliente,
  type LinhaPainel,
} from "../lib/agrupar";

export function PainelDemandas({ className }: { className?: string }) {
  const { data: linhas, isLoading, isError, refetch, isRefetching } = usePainel();
  const [filtro, setFiltro] = useState<FiltroPainel>({});

  const opcoes = useMemo(() => opcoesDeFiltro(linhas ?? []), [linhas]);
  const grupos = useMemo(
    () => agruparPorCliente(filtrarLinhas(linhas ?? [], filtro)),
    [linhas, filtro],
  );

  const totalDemandas = linhas?.length ?? 0;
  const totalClientes = opcoes.clientes.length;
  const algumFiltro = Boolean(filtro.busca || filtro.status || filtro.dominio || filtro.clientId);

  return (
    <section className={cn("mtech-scope min-h-[calc(100vh-4rem)] bg-mtech-bg", className)}>
      {/* pb generoso: o FAB global "Gravar Reunião" flutua no canto inferior
          direito. A última linha precisa rolar ACIMA dele para o badge de
          presença (o payoff "agora") nunca ficar clipado. */}
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 pb-28 sm:px-8 sm:py-8 sm:pb-28">
        {/* Cabeçalho editorial */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[var(--mtech-radius-md)] border border-mtech-border bg-mtech-surface">
              <LayoutGrid className="h-[18px] w-[18px] text-mtech-text-subtle" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight text-mtech-text">
                Painel de Demandas
              </h1>
              <p className="mt-1 max-w-[60ch] text-caption text-mtech-text-muted">
                Quem faz o quê, em qual demanda de qual cliente — e há quanto tempo. Visão viva
                dos clientes que você acompanha.
              </p>
            </div>
          </div>

          {!isLoading && !isError && totalDemandas > 0 && (
            <div className="flex items-center gap-4 text-caption text-mtech-text-subtle">
              <ResumoNumero icon={<Users className="h-3.5 w-3.5" />} valor={totalClientes} rotulo="clientes" />
              <span className="h-4 w-px bg-mtech-border" aria-hidden />
              <ResumoNumero icon={<ListTodo className="h-3.5 w-3.5" />} valor={totalDemandas} rotulo="demandas" />
            </div>
          )}
        </header>

        {/* Barra de filtros — só quando há dado a filtrar. */}
        {!isLoading && !isError && totalDemandas > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mtech-text-subtle" aria-hidden />
              <Input
                value={filtro.busca ?? ""}
                onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
                placeholder="Buscar demanda ou cliente…"
                aria-label="Buscar demanda ou cliente"
                className="h-9 border-mtech-border bg-mtech-surface pl-9 text-body text-mtech-text placeholder:text-mtech-text-subtle focus-visible:ring-mtech-border-strong"
              />
            </div>

            <SelectFiltro
              valor={filtro.clientId ?? ""}
              onChange={(v) => setFiltro((f) => ({ ...f, clientId: v || undefined }))}
              placeholder="Todos os clientes"
              opcoes={opcoes.clientes.map((c) => ({ value: c.clientId, label: c.clientNome }))}
            />
            <SelectFiltro
              valor={filtro.status ?? ""}
              onChange={(v) => setFiltro((f) => ({ ...f, status: v || undefined }))}
              placeholder="Todos os status"
              opcoes={opcoes.status.map((s) => ({ value: s, label: s }))}
            />
            <SelectFiltro
              valor={filtro.dominio ?? ""}
              onChange={(v) => setFiltro((f) => ({ ...f, dominio: v || undefined }))}
              placeholder="Todos os domínios"
              opcoes={opcoes.dominios.map((d) => ({ value: d, label: d }))}
            />

            {algumFiltro && (
              <button
                type="button"
                onClick={() => setFiltro({})}
                className="h-9 rounded-[var(--mtech-radius-md)] px-3 text-caption text-mtech-text-subtle transition-colors hover:bg-mtech-surface hover:text-mtech-text"
              >
                Limpar
              </button>
            )}
          </div>
        )}

        {/* Corpo — estados */}
        <div className="mt-6">
          {isLoading ? (
            <BoardSkeleton />
          ) : isError ? (
            <EstadoErro onRetry={() => refetch()} carregando={isRefetching} />
          ) : totalDemandas === 0 ? (
            <EstadoVazioGlobal />
          ) : grupos.length === 0 ? (
            <EstadoSemResultado onLimpar={() => setFiltro({})} />
          ) : (
            <div className="space-y-5">
              {grupos.map((g) => (
                <GrupoClienteCard key={g.clientId} grupo={g} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ===================== Grupo de cliente (a seção do board) =====================

function GrupoClienteCard({ grupo }: { grupo: GrupoCliente }) {
  // Escala (#84): só assina o canal Realtime deste cliente quando o grupo está
  // no viewport. Fora da tela → mapa vazio (mostra estado frio sem o "agora").
  const [ref, ativo] = useEmViewport<HTMLDivElement>();
  const presencaPorDemanda = usePresencaLazy(grupo.clientId, ativo);

  const atuandoAgora = useMemo(
    () =>
      grupo.demandas.reduce(
        (acc, d) => acc + (presencaPorDemanda[d.demanda_id]?.filter((p) => p.atuando).length ?? 0),
        0,
      ),
    [grupo.demandas, presencaPorDemanda],
  );

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-[var(--mtech-radius-lg)] border border-mtech-border bg-mtech-surface"
    >
      {/* Cabeçalho do grupo */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate text-title font-semibold text-mtech-text">{grupo.clientNome}</h2>
          <span
            data-mono
            className="rounded-full bg-mtech-surface-elev px-2 py-0.5 text-caption text-mtech-text-subtle"
          >
            {grupo.totalDemandas}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {atuandoAgora > 0 && (
            <span className="inline-flex items-center gap-1.5 text-caption font-medium text-mtech-success">
              {/* dot vivo com glow estático (sem pulse — saúde, commit fb3d566);
                  ecoa o tratamento do BadgeAtuando para o "agora" sentir vivo. */}
              <span
                className="h-1.5 w-1.5 rounded-full bg-mtech-success shadow-[0_0_8px_var(--mtech-success)]"
                aria-hidden
              />
              {atuandoAgora} atuando agora
            </span>
          )}
          {grupo.tempoTotalSegundos > 0 && (
            <span
              data-mono
              title={`${formatarTempo(grupo.tempoTotalSegundos)} de atuação acumulada no cliente`}
              className="inline-flex items-center gap-1 text-caption font-medium tabular-nums text-mtech-text-muted"
            >
              <Clock3 className="h-3 w-3 text-mtech-text-subtle" aria-hidden />
              {formatarTempo(grupo.tempoTotalSegundos)}
            </span>
          )}
        </div>
      </header>

      <div className="h-px bg-mtech-border" />

      {/* Linhas de demanda. Um único separador leve (régua /40) — o respiro
          vertical + o hover já carregam a separação; sem competir com a borda
          do card nem a régua do header (craft: um peso de divisória, não três). */}
      <ul className="divide-y divide-mtech-border/40">
        {grupo.demandas.map((d) => (
          <LinhaDemanda
            key={d.demanda_id}
            demanda={d}
            pessoas={presencaPorDemanda[d.demanda_id] ?? []}
          />
        ))}
      </ul>
    </div>
  );
}

function LinhaDemanda({
  demanda,
  pessoas,
}: {
  demanda: LinhaPainel;
  pessoas: { user_id: string; atuando: boolean }[];
}) {
  return (
    <li className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-mtech-surface-elev/60">
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
          <ChipTempo segundos={demanda.tempo_segundos} />
        </div>
      </div>

      {/* Presença AO VIVO: quem atua nesta demanda neste instante. */}
      <div className="mt-0.5 flex shrink-0 items-center">
        {pessoas.length > 0 && <BadgeAtuando pessoas={pessoas} max={3} />}
      </div>
    </li>
  );
}

// ===================== Chips (vocabulário visual reusado) =====================

function ChipTempo({ segundos }: { segundos: number }) {
  if (!Number.isFinite(segundos) || segundos <= 0) return null;
  const rotulo = formatarTempo(segundos);
  return (
    <span
      data-mono
      title={`${rotulo} de atuação acumulada`}
      className="inline-flex items-center gap-1 text-caption font-medium tabular-nums text-mtech-text-muted"
    >
      <Clock3 className="h-3 w-3 text-mtech-text-subtle" aria-hidden />
      {rotulo}
    </span>
  );
}

function ChipStatus({ status }: { status: string }) {
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
        className={cn("h-1.5 w-1.5 rounded-full", concluida ? "bg-mtech-text-subtle" : "bg-mtech-accent")}
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

function ResumoNumero({ icon, valor, rotulo }: { icon: React.ReactNode; valor: number; rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-mtech-text-subtle">{icon}</span>
      <span data-mono className="font-medium tabular-nums text-mtech-text">{valor}</span>
      <span>{rotulo}</span>
    </span>
  );
}

// ===================== Select minimalista (nativo, estilizado) =====================

function SelectFiltro({
  valor,
  onChange,
  placeholder,
  opcoes,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  opcoes: { value: string; label: string }[];
}) {
  if (opcoes.length === 0) return null;
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
      className={cn(
        "h-9 rounded-[var(--mtech-radius-md)] border border-mtech-border bg-mtech-surface px-3 text-caption transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mtech-border-strong",
        valor ? "text-mtech-text" : "text-mtech-text-subtle",
      )}
    >
      <option value="">{placeholder}</option>
      {opcoes.map((o) => (
        <option key={o.value} value={o.value} className="bg-mtech-surface text-mtech-text">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ===================== Estados =====================

function BoardSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      {[0, 1].map((g) => (
        <div key={g} className="overflow-hidden rounded-[var(--mtech-radius-lg)] border border-mtech-border bg-mtech-surface">
          <div className="flex items-center justify-between px-5 py-3.5">
            <Skeleton className="h-4 w-40 bg-mtech-surface-elev" />
            <Skeleton className="h-3 w-16 bg-mtech-surface-elev" />
          </div>
          <div className="h-px bg-mtech-border" />
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex items-start gap-3 px-5 py-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-[var(--mtech-radius-md)] bg-mtech-surface-elev" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-52 bg-mtech-surface-elev" />
                <Skeleton className="h-3 w-28 rounded-full bg-mtech-surface-elev" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EstadoVazioGlobal() {
  return (
    <div className="flex flex-col items-center rounded-[var(--mtech-radius-lg)] border border-mtech-border bg-mtech-surface px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-mtech-border bg-mtech-surface-elev">
        <LayoutGrid className="h-5 w-5 text-mtech-text-subtle" aria-hidden />
      </div>
      <p className="mt-4 text-body font-medium text-mtech-text">Nenhuma demanda à vista</p>
      <p className="mt-1 max-w-[44ch] text-caption text-mtech-text-muted">
        Quando os clientes que você acompanha tiverem demandas, elas aparecem aqui — com quem
        está atuando agora e há quanto tempo.
      </p>
    </div>
  );
}

function EstadoSemResultado({ onLimpar }: { onLimpar: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--mtech-radius-lg)] border border-mtech-border bg-mtech-surface px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-mtech-border bg-mtech-surface-elev">
        <Search className="h-5 w-5 text-mtech-text-subtle" aria-hidden />
      </div>
      <p className="mt-4 text-body font-medium text-mtech-text">Nada bate com esse filtro</p>
      <p className="mt-1 max-w-[40ch] text-caption text-mtech-text-muted">
        Ajuste a busca ou limpe os filtros para ver todas as demandas.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onLimpar}
        className="mt-5 border-mtech-border bg-transparent text-mtech-text hover:bg-mtech-surface-elev"
      >
        Limpar filtros
      </Button>
    </div>
  );
}

function EstadoErro({ onRetry, carregando }: { onRetry: () => void; carregando: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--mtech-radius-lg)] border border-mtech-danger/30 bg-mtech-surface px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-mtech-danger/30 bg-mtech-danger/10">
        <AlertTriangle className="h-5 w-5 text-mtech-danger" aria-hidden />
      </div>
      <p className="mt-4 text-body font-medium text-mtech-text">Não foi possível carregar o painel</p>
      <p className="mt-1 max-w-[40ch] text-caption text-mtech-text-muted">
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
