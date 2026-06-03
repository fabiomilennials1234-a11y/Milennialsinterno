// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 5 (#81) — badge "fulano atuando agora" AO VIVO. Mostra, numa demanda,
// quem está presente e quem está de fato atuando (online ≠ atuando). ADR 0007.
//
// Linguagem visual (mtech, dark-first):
//   - Atuando  → ponto verde sólido (var(--mtech-success)) + halo estático.
//   - Presente mas ocioso (auto-pausado) → ponto vazado/neutro, sem destaque.
// NÃO usa pulse/ping/bounce em loop — o app baniu animação cíclica por saúde
// (commit fb3d566). O "ao vivo" é transição suave de cor/opacidade, não piscar.
//
// Audiência: o componente só recebe estado se o hook conseguiu assinar o canal
// (canal private + RLS de realtime.messages, ADR 0007). Quem não pode ver o
// cliente nunca recebe presença — o badge simplesmente fica vazio para ele.

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePessoasPresenca } from "../lib/diretorioPresenca";
import type { PresencaNaDemanda } from "../lib/atuacao";

interface Props {
  /** presenças desta demanda (já agregadas por usePresencaDoCliente). */
  pessoas: PresencaNaDemanda[];
  /** quantos avatares mostrar antes do "+N". */
  max?: number;
  className?: string;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toUpperCase() || "?";
}

export function BadgeAtuando({ pessoas, max = 4, className }: Props) {
  // Atuando primeiro, depois presentes-ociosos. Estável para o stack.
  const ordenadas = useMemo(
    () => [...pessoas].sort((a, b) => Number(b.atuando) - Number(a.atuando)),
    [pessoas],
  );
  const { data: dir } = usePessoasPresenca(ordenadas.map((p) => p.user_id));

  if (ordenadas.length === 0) return null;

  const atuandoCount = ordenadas.filter((p) => p.atuando).length;
  const visiveis = ordenadas.slice(0, max);
  const resto = ordenadas.length - visiveis.length;

  const rotulo =
    atuandoCount > 0
      ? `${atuandoCount} atuando agora`
      : `${ordenadas.length} ${ordenadas.length === 1 ? "presente" : "presentes"}`;

  return (
    <TooltipProvider delayDuration={120}>
      <div
        className={cn(
          "mtech-scope inline-flex items-center gap-2.5 rounded-full border border-mtech-border bg-mtech-surface-elev/60 py-1 pl-1 pr-3",
          className,
        )}
        role="group"
        aria-label={rotulo}
      >
        <div className="flex items-center -space-x-2">
          {visiveis.map((p) => {
            const pessoa = dir?.[p.user_id];
            const nome = pessoa?.nome ?? "Usuário";
            return (
              <Tooltip key={p.user_id}>
                <TooltipTrigger asChild>
                  {/* animate-in fade/zoom é one-shot na montagem (tailwindcss-animate),
                      não loop — honra a regra de saúde (commit fb3d566). Dá o
                      momento "ao vivo" quando alguém entra, sem piscar. */}
                  <span className="relative inline-flex animate-in fade-in zoom-in-95 duration-200">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-mtech-surface bg-mtech-surface text-[10px] font-semibold text-mtech-text-muted ring-1 ring-mtech-border transition-opacity duration-300",
                        !p.atuando && "opacity-55",
                      )}
                    >
                      {pessoa?.avatar ? (
                        <img
                          src={pessoa.avatar}
                          alt={nome}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        iniciais(nome)
                      )}
                    </span>
                    {/* Indicador de estado — sólido p/ atuando, vazado p/ ocioso. Sem loop. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-mtech-surface",
                        p.atuando ? "shadow-[0_0_0_1px_rgba(48,164,108,0.4)]" : "",
                      )}
                      style={{
                        backgroundColor: p.atuando ? "var(--mtech-success)" : "transparent",
                        boxShadow: p.atuando ? undefined : "inset 0 0 0 1.5px var(--mtech-text-subtle)",
                      }}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="mtech-scope border-mtech-border bg-mtech-surface text-mtech-text">
                  <span className="font-medium">{nome}</span>
                  <span className="ml-1.5 text-mtech-text-subtle">
                    {p.atuando ? "atuando" : "presente"}
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {resto > 0 && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-mtech-surface bg-mtech-surface text-[10px] font-semibold text-mtech-text-subtle ring-1 ring-mtech-border">
              +{resto}
            </span>
          )}
        </div>

        <span className="flex items-center gap-1.5 text-caption font-medium text-mtech-text">
          {atuandoCount > 0 && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "var(--mtech-success)" }}
            />
          )}
          {rotulo}
        </span>
      </div>
    </TooltipProvider>
  );
}
