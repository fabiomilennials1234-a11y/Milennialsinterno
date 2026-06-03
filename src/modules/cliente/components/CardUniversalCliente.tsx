// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 1 (#77) — painel "Card Universal de Cliente" (LEITURA).
// Slice 3 (#79) — modo EDIÇÃO in-place (progressive disclosure).
// Visão consolidada read-mostly de fonte única (`public.client_info_bank`) via o
// contrato `cliente.card_universal` (leitura) e `cliente.editar_card_universal`
// (escrita). Audiência/autorização = Envolvidos/exec/page-grant (MESMO predicado
// pode_ver_cliente para ver E editar; gate na RPC + RLS; ADR 0005).
//
// Intenção de design: um DOSSIÊ do cliente, não um formulário. O herói é a
// legibilidade da informação. Irmão visual de EquipeDoCliente (mesma linguagem
// material `mtech`: surface/border/radius, header com ícone + título), mas com
// ritmo próprio — grid de campos em seções rotuladas. Campos vazios são
// suprimidos (remover > adicionar ruído de "N/A"); seção sem nenhum campo some;
// card inteiro vazio → estado vazio elegante. Cores de marca viram swatches
// reais; URLs viram links com afinância de link externo. Sem acesso → nada.
//
// A edição é PROGRESSIVE DISCLOSURE: o painel nasce read-mostly; uma affordance
// discreta no header ("Editar") transforma o MESMO layout em campos editáveis
// in-place (sem modal — modal legado fura o boundary do módulo). Só os campos
// alterados são enviados (patch). Salvar invalida a leitura; 42501 vira aviso de
// permissão. O modo leitura permanece byte-a-byte o de #77.

import { useMemo, useState, useEffect } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Palette,
  Pencil,
  RotateCw,
  Globe,
  Clapperboard,
  Code2,
  StickyNote,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useCardUniversal } from "../lib/useCardUniversal";
import type { CardUniversal } from "../lib/cardUniversal";
import { useEditarCardUniversal } from "../lib/useEditarCardUniversal";
import type { EdicaoCardUniversal } from "../lib/editarCardUniversal";

interface Props {
  clientId: string;
  clientName?: string;
  className?: string;
}

// Chaves de domínio editáveis (espelha EdicaoCardUniversal). Auditoria fica fora.
type CampoEditavel = keyof EdicaoCardUniversal;

// Forma do rascunho: todos os campos editáveis como string ("" = vazio).
type Rascunho = Record<CampoEditavel, string>;

const CAMPOS_EDITAVEIS: CampoEditavel[] = [
  "brand_colors",
  "typography",
  "visual_style",
  "brand_manual_url",
  "logo_url",
  "website_url",
  "instagram_handle",
  "youtube_channel",
  "tiktok_handle",
  "domain",
  "editing_style",
  "video_formats",
  "cms_platform",
  "figma_url",
  "notes",
];

function rascunhoVazio(): Rascunho {
  return Object.fromEntries(CAMPOS_EDITAVEIS.map((k) => [k, ""])) as Rascunho;
}

function rascunhoDeCard(card: CardUniversal | null | undefined): Rascunho {
  const base = rascunhoVazio();
  if (!card) return base;
  for (const k of CAMPOS_EDITAVEIS) {
    base[k] = (card[k] as string | null) ?? "";
  }
  return base;
}

// Patch = só os campos cujo valor mudou em relação ao card atual. "" → null
// (limpar intencionalmente). Evita reenviar o card inteiro (UPSERT mínimo).
function calcularPatch(
  rascunho: Rascunho,
  card: CardUniversal | null | undefined,
): EdicaoCardUniversal {
  const patch: EdicaoCardUniversal = {};
  for (const k of CAMPOS_EDITAVEIS) {
    const atual = ((card?.[k] as string | null) ?? "").trim();
    const novo = rascunho[k].trim();
    if (novo !== atual) {
      patch[k] = novo === "" ? null : novo;
    }
  }
  return patch;
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
  const editar = useEditarCardUniversal(clientId);

  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho>(rascunhoVazio);

  // Ao entrar em edição (ou quando o card recarrega durante a edição), semeia o
  // rascunho a partir do card. Fora da edição, o rascunho fica inerte.
  useEffect(() => {
    if (editando) setRascunho(rascunhoDeCard(card));
  }, [editando, card]);

  // Seções com ao menos um campo preenchido (suprime ruído de vazio).
  const secoesComDados = useMemo(() => {
    if (!card) return [];
    return SECOES.map((s) => ({
      ...s,
      campos: s.campos.filter((c) => temValor(card[c.key])),
    })).filter((s) => s.campos.length > 0);
  }, [card]);

  const vazio = !card || secoesComDados.length === 0;
  // Quem vê o card pode editá-lo (mesmo predicado pode_ver_cliente). Logo, a
  // affordance de edição aparece sempre que o painel carregou sem erro.
  const podeEditar = !isLoading && !isError;

  const patch = useMemo(() => calcularPatch(rascunho, card), [rascunho, card]);
  const temMudanca = Object.keys(patch).length > 0;

  function abrirEdicao() {
    setRascunho(rascunhoDeCard(card));
    setEditando(true);
  }

  function cancelarEdicao() {
    setEditando(false);
    setRascunho(rascunhoVazio());
  }

  async function salvar() {
    if (!temMudanca) {
      setEditando(false);
      return;
    }
    try {
      await editar.mutateAsync(patch);
      toast.success("Card atualizado");
      setEditando(false);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "42501") {
        toast.error("Você não tem permissão para editar este cliente.");
      } else if (code === "P0002") {
        toast.error("Cliente não encontrado.");
      } else {
        toast.error("Não foi possível salvar. Tente novamente.");
      }
    }
  }

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

        {editando ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelarEdicao}
              disabled={editar.isPending}
              className="h-8 gap-1.5 px-2.5 text-caption text-mtech-text-muted hover:bg-mtech-surface-elev hover:text-mtech-text"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvar}
              disabled={editar.isPending || !temMudanca}
              className="h-8 gap-1.5 bg-mtech-accent px-3 text-caption text-mtech-bg hover:bg-mtech-accent/90 disabled:opacity-50"
            >
              {editar.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
              Salvar
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {card?.updated_at && (
              <span
                data-mono
                className="text-caption text-mtech-text-subtle"
                title={`Atualizado em ${new Date(card.updated_at).toLocaleString("pt-BR")}`}
              >
                {formatarQuando(card.updated_at)}
              </span>
            )}
            {podeEditar && !vazio && (
              <Button
                size="sm"
                variant="ghost"
                onClick={abrirEdicao}
                className="h-8 gap-1.5 px-2.5 text-caption text-mtech-text-muted hover:bg-mtech-surface-elev hover:text-mtech-text"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="h-px bg-mtech-border" />

      {/* Corpo — estados */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <EstadoErro onRetry={() => refetch()} carregando={isRefetching} />
      ) : editando ? (
        <FormEdicao rascunho={rascunho} onChange={setRascunho} salvando={editar.isPending} />
      ) : vazio ? (
        <EstadoVazio clientName={clientName} onAdicionar={podeEditar ? abrirEdicao : undefined} />
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

// ── Modo edição ───────────────────────────────────────────────────────────────
// Mesmas seções/rótulos da leitura, agora como campos. Progressive disclosure:
// o herói segue sendo a estrutura do dossiê; o input herda o ritmo do grid.

function FormEdicao({
  rascunho,
  onChange,
  salvando,
}: {
  rascunho: Rascunho;
  onChange: (r: Rascunho) => void;
  salvando: boolean;
}) {
  function setCampo(key: CampoEditavel, valor: string) {
    onChange({ ...rascunho, [key]: valor });
  }

  return (
    <div className="divide-y divide-mtech-border">
      {SECOES.map((secao) => {
        const { Icone } = secao;
        return (
          <div key={secao.id} className="px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <Icone className="h-3.5 w-3.5 text-mtech-text-subtle" aria-hidden />
              <h4 className="text-caption font-medium uppercase tracking-[0.08em] text-mtech-text-subtle">
                {secao.titulo}
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {secao.campos.map((campo) => {
                const key = campo.key as CampoEditavel;
                const full = campo.render === "swatches" || campo.key === "notes";
                return (
                  <div key={String(campo.key)} className={cn("min-w-0", full && "sm:col-span-2")}>
                    <label
                      htmlFor={`cu-${key}`}
                      className="mb-1.5 block text-caption text-mtech-text-subtle"
                    >
                      {campo.label}
                    </label>
                    {campo.key === "notes" ? (
                      <textarea
                        id={`cu-${key}`}
                        value={rascunho[key]}
                        onChange={(e) => setCampo(key, e.target.value)}
                        disabled={salvando}
                        rows={3}
                        className="w-full resize-y rounded-[var(--mtech-radius-md)] border border-mtech-input-border bg-mtech-input-bg px-3 py-2 text-body text-mtech-text placeholder:text-mtech-text-subtle focus:border-mtech-accent focus:outline-none focus:ring-1 focus:ring-mtech-accent/40 disabled:opacity-50"
                      />
                    ) : (
                      <input
                        id={`cu-${key}`}
                        type="text"
                        value={rascunho[key]}
                        onChange={(e) => setCampo(key, e.target.value)}
                        disabled={salvando}
                        placeholder={placeholderDe(campo)}
                        className="h-9 w-full rounded-[var(--mtech-radius-md)] border border-mtech-input-border bg-mtech-input-bg px-3 text-body text-mtech-text placeholder:text-mtech-text-subtle focus:border-mtech-accent focus:outline-none focus:ring-1 focus:ring-mtech-accent/40 disabled:opacity-50"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Placeholder discreto por tipo de campo (afinância, não instrução verbosa).
function placeholderDe(campo: Campo): string {
  if (campo.render === "swatches") return "#0A84FF, #111827";
  if (campo.render === "link") return "https://…";
  return "";
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

function EstadoVazio({
  clientName,
  onAdicionar,
}: {
  clientName?: string;
  onAdicionar?: () => void;
}) {
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
      {onAdicionar && (
        <Button
          size="sm"
          onClick={onAdicionar}
          className="mt-5 gap-1.5 bg-mtech-accent text-mtech-bg hover:bg-mtech-accent/90"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Adicionar informações
        </Button>
      )}
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
