// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 1 (#77) — painel "Card Universal de Cliente" (LEITURA).
// Visão consolidada read-mostly de fonte única (`public.client_info_bank`) via o
// contrato `cliente.card_universal`. Audiência = Envolvidos/exec/page-grant
// (gate na RPC + RLS; ADR 0005). A edição é #79 — este painel é read-only.
//
// Intenção de design: um DOSSIÊ do cliente, não um formulário. O herói é a
// legibilidade da informação. Irmão visual de EquipeDoCliente (mesma linguagem
// material `mtech`: surface/border/radius, header com ícone + título), mas com
// ritmo próprio — grid de campos em seções rotuladas. Campos vazios são
// suprimidos (remover > adicionar ruído de "N/A"); seção sem nenhum campo some;
// card inteiro vazio → estado vazio elegante. Cores de marca viram swatches
// reais; URLs viram links com afinância de link externo. Sem acesso → nada.

import { useMemo } from "react";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Loader2,
  Palette,
  RotateCw,
  Globe,
  Clapperboard,
  Code2,
  StickyNote,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useCardUniversal } from "../lib/useCardUniversal";
import type { CardUniversal } from "../lib/cardUniversal";

interface Props {
  clientId: string;
  clientName?: string;
  className?: string;
}

// ── Vocabulário de apresentação ─────────────────────────────────────────────
// Cada campo declara seu rótulo humano e como se renderiza (texto | link | cor).
type Render = "text" | "link" | "swatches";
interface Campo {
  key: keyof CardUniversal;
  label: string;
  render?: Render;
}
interface Secao {
  id: string;
  titulo: string;
  Icone: typeof Palette;
  campos: Campo[];
}

const SECOES: Secao[] = [
  {
    id: "marca",
    titulo: "Marca",
    Icone: Palette,
    campos: [
      { key: "brand_colors", label: "Cores", render: "swatches" },
      { key: "typography", label: "Tipografia" },
      { key: "visual_style", label: "Estilo visual" },
      { key: "brand_manual_url", label: "Manual da marca", render: "link" },
      { key: "logo_url", label: "Logo", render: "link" },
    ],
  },
  {
    id: "presenca",
    titulo: "Presença Digital",
    Icone: Globe,
    campos: [
      { key: "website_url", label: "Website", render: "link" },
      { key: "instagram_handle", label: "Instagram" },
      { key: "youtube_channel", label: "YouTube" },
      { key: "tiktok_handle", label: "TikTok" },
      { key: "domain", label: "Domínio" },
    ],
  },
  {
    id: "video",
    titulo: "Vídeo",
    Icone: Clapperboard,
    campos: [
      { key: "editing_style", label: "Estilo de edição" },
      { key: "video_formats", label: "Formatos" },
    ],
  },
  {
    id: "dev",
    titulo: "Desenvolvimento",
    Icone: Code2,
    campos: [
      { key: "cms_platform", label: "Plataforma / CMS" },
      { key: "figma_url", label: "Figma", render: "link" },
    ],
  },
  {
    id: "geral",
    titulo: "Geral",
    Icone: StickyNote,
    campos: [{ key: "notes", label: "Notas" }],
  },
];

function temValor(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function CardUniversalCliente({ clientId, clientName, className }: Props) {
  const { data: card, isLoading, isError, refetch, isRefetching } =
    useCardUniversal(clientId);

  // Seções com ao menos um campo preenchido (suprime ruído de vazio).
  const secoesComDados = useMemo(() => {
    if (!card) return [];
    return SECOES.map((s) => ({
      ...s,
      campos: s.campos.filter((c) => temValor(card[c.key])),
    })).filter((s) => s.campos.length > 0);
  }, [card]);

  const vazio = !card || secoesComDados.length === 0;

  return (
    <section
      className={cn(
        "mtech-scope rounded-[var(--mtech-radius-lg)] border border-mtech-border bg-mtech-surface",
        className,
      )}
    >
      {/* Header — irmão de EquipeDoCliente */}
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <FileText className="h-[18px] w-[18px] text-mtech-text-subtle" aria-hidden />
          <h3 className="text-title text-mtech-text">Card universal</h3>
        </div>
        {card?.updated_at && !isLoading && !isError && (
          <span
            data-mono
            className="text-caption text-mtech-text-subtle"
            title={`Atualizado em ${new Date(card.updated_at).toLocaleString("pt-BR")}`}
          >
            {formatarQuando(card.updated_at)}
          </span>
        )}
      </header>

      <div className="h-px bg-mtech-border" />

      {/* Corpo — estados */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <EstadoErro onRetry={() => refetch()} carregando={isRefetching} />
      ) : vazio ? (
        <EstadoVazio clientName={clientName} />
      ) : (
        <div className="divide-y divide-mtech-border">
          {secoesComDados.map((secao) => (
            <SecaoCampos key={secao.id} secao={secao} card={card!} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Seção ────────────────────────────────────────────────────────────────────

function SecaoCampos({ secao, card }: { secao: Secao; card: CardUniversal }) {
  const { Icone } = secao;
  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Icone className="h-3.5 w-3.5 text-mtech-text-subtle" aria-hidden />
        <h4 className="text-caption font-medium uppercase tracking-[0.08em] text-mtech-text-subtle">
          {secao.titulo}
        </h4>
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
        {secao.campos.map((campo) => (
          <Campo key={String(campo.key)} campo={campo} valor={card[campo.key] as string} />
        ))}
      </dl>
    </div>
  );
}

function Campo({ campo, valor }: { campo: Campo; valor: string }) {
  const full = campo.render === "swatches" || campo.key === "notes";
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")}>
      <dt className="mb-1 text-caption text-mtech-text-subtle">{campo.label}</dt>
      <dd className="text-body leading-snug text-mtech-text">
        {campo.render === "link" ? (
          <LinkValor href={valor} />
        ) : campo.render === "swatches" ? (
          <Swatches raw={valor} />
        ) : campo.key === "notes" ? (
          <p className="whitespace-pre-wrap text-mtech-text-muted">{valor}</p>
        ) : (
          <span className="break-words">{valor}</span>
        )}
      </dd>
    </div>
  );
}

// ── Renderers de valor ────────────────────────────────────────────────────────

function LinkValor({ href }: { href: string }) {
  const normalizado = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  const rotulo = href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return (
    <a
      href={normalizado}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex max-w-full items-center gap-1.5 text-mtech-text underline-offset-4 transition-colors hover:text-mtech-accent hover:underline focus-visible:text-mtech-accent focus-visible:underline focus-visible:outline-none"
    >
      <span className="truncate">{rotulo}</span>
      <ExternalLink
        className="h-3 w-3 shrink-0 text-mtech-text-subtle transition-colors group-hover:text-mtech-accent"
        aria-hidden
      />
    </a>
  );
}

// Aceita "#FF0055, #111", "#FF0055 / #111" ou texto livre. Extrai hex válidos
// como swatches; o resto do texto (ex.: "azul petróleo") fica como rótulo.
function Swatches({ raw }: { raw: string }) {
  const hexes = raw.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi) ?? [];
  const semHex = raw.replace(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi, "").replace(/[,/|]+/g, " ").trim();
  if (hexes.length === 0) {
    return <span className="break-words text-mtech-text">{raw}</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hexes.map((hex, i) => (
        <span key={`${hex}-${i}`} className="inline-flex items-center gap-1.5">
          <span
            className="h-4 w-4 rounded-[4px] ring-1 ring-inset ring-white/15"
            style={{ backgroundColor: hex }}
            aria-hidden
          />
          <span data-mono className="text-caption uppercase text-mtech-text-muted">
            {hex}
          </span>
        </span>
      ))}
      {semHex && <span className="text-caption text-mtech-text-muted">{semHex}</span>}
    </div>
  );
}

// ── Estados ───────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="space-y-5 p-5" aria-hidden>
      {[0, 1].map((s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-3 w-24 bg-mtech-surface-elev" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-3.5">
            {[0, 1, 2, 3].map((f) => (
              <div key={f} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16 bg-mtech-surface-elev" />
                <Skeleton className="h-3.5 w-32 bg-mtech-surface-elev" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EstadoVazio({ clientName }: { clientName?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-mtech-border bg-mtech-surface-elev">
        <FileText className="h-5 w-5 text-mtech-text-subtle" aria-hidden />
      </div>
      <p className="mt-4 text-body font-medium text-mtech-text">Sem informações ainda</p>
      <p className="mt-1 max-w-[40ch] text-caption text-mtech-text-muted">
        O card de {clientName ?? "deste cliente"} consolida marca, presença digital, vídeo e dev em
        um só lugar. Quando a equipe preencher, aparece aqui.
      </p>
    </div>
  );
}

function EstadoErro({ onRetry, carregando }: { onRetry: () => void; carregando: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-mtech-danger/30 bg-mtech-danger/10">
        <AlertTriangle className="h-5 w-5 text-mtech-danger" aria-hidden />
      </div>
      <p className="mt-4 text-body font-medium text-mtech-text">Não foi possível carregar o card</p>
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
        {carregando ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCw className="h-3.5 w-3.5" />
        )}
        Tentar de novo
      </Button>
    </div>
  );
}

// "há 3 dias" / "hoje" — afinância de recência sutil no header.
function formatarQuando(iso: string): string {
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias <= 0) return "atualizado hoje";
  if (dias === 1) return "atualizado ontem";
  if (dias < 30) return `atualizado há ${dias} dias`;
  return `atualizado em ${d.toLocaleDateString("pt-BR")}`;
}
