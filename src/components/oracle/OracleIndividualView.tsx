import type { OracleIndividualSummary } from "@/lib/oracle-utils";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ListOrdered,
  TrendingUp,
  Award,
  FileText,
  Radio,
} from "lucide-react";

const severityConfig = {
  critical: {
    color: "text-red-400",
    bg: "bg-red-400/8",
    border: "border-red-400/20",
    icon: XCircle,
  },
  warning: {
    color: "text-amber-400",
    bg: "bg-amber-400/8",
    border: "border-amber-400/20",
    icon: AlertTriangle,
  },
  info: {
    color: "text-blue-400",
    bg: "bg-blue-400/8",
    border: "border-blue-400/20",
    icon: Info,
  },
} as const;

const tipoIcon = {
  tarefa: FileText,
  documentacao: FileText,
  tracking: Radio,
} as const;

function SectionDivider() {
  return (
    <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
  );
}

export function OracleIndividualView({
  data,
}: {
  data: OracleIndividualSummary;
}) {
  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-foreground tracking-tight">
          {data.resumo.nome}
        </span>
        <p className="text-xs text-muted-foreground/80 leading-relaxed">
          {data.resumo.texto}
        </p>
      </div>

      {/* Pendências */}
      {data.pendencias.length > 0 && (
        <>
          <SectionDivider />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Pendências
              </span>
            </div>
            <div className="space-y-1.5">
              {data.pendencias.map((p, i) => {
                const sev =
                  severityConfig[p.severidade] || severityConfig.info;
                const TipoIcon = tipoIcon[p.tipo] || FileText;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border ${sev.border} ${sev.bg}`}
                  >
                    <TipoIcon
                      className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${sev.color}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-foreground/90 truncate">
                          {p.titulo}
                        </span>
                        <span
                          data-testid={`severidade-${p.severidade}`}
                          className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md shrink-0 ${sev.bg} ${sev.color} tabular-nums`}
                        >
                          {p.dias_atraso}d
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/50">
                        {p.cliente}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Prioridades hoje */}
      {data.prioridades_hoje.length > 0 && (
        <>
          <SectionDivider />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <ListOrdered className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Prioridades hoje
              </span>
            </div>
            <div className="space-y-1.5">
              {data.prioridades_hoje
                .sort((a, b) => a.ordem - b.ordem)
                .map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/5 border border-subtle/30"
                  >
                    <span className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-[10px] font-bold text-primary/80 shrink-0 tabular-nums">
                      {p.ordem}
                    </span>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="text-[11px] text-foreground/90 leading-relaxed">
                        {p.acao}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-primary/50">
                          {p.cliente}
                        </span>
                        <span className="text-[10px] text-muted-foreground/30">
                          ·
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          {p.razao}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {/* Padrões */}
      {data.padroes.length > 0 && (
        <>
          <SectionDivider />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Padrões (5 dias)
              </span>
            </div>
            <div className="space-y-1.5">
              {data.padroes.map((p, i) => {
                const isAlert = p.tipo === "alerta";
                return (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border ${
                      isAlert
                        ? "bg-red-400/5 border-red-400/15"
                        : "bg-emerald-400/5 border-emerald-400/15"
                    }`}
                  >
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isAlert ? "text-red-300/90" : "text-emerald-300/90"
                      }`}
                    >
                      {p.descricao}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1 font-mono tabular-nums">
                      {p.dados}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Reconhecimento */}
      {data.reconhecimento && (
        <>
          <SectionDivider />
          <div className="p-3 rounded-lg bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/15">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Award className="w-3.5 h-3.5 text-primary/70" />
              <span className="text-[10px] font-medium text-primary/60 uppercase tracking-widest">
                Destaque
              </span>
            </div>
            <p className="text-[11px] text-foreground/90 leading-relaxed">
              {data.reconhecimento.texto}
            </p>
            <p className="text-[10px] text-primary/40 mt-1 font-medium">
              {data.reconhecimento.metrica}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
