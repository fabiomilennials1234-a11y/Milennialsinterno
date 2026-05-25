import type { OracleGroupSummary } from "@/lib/oracle-utils";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  TrendingUp,
  Users,
} from "lucide-react";

const statusConfig = {
  ok: {
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-l-emerald-500/60",
    label: "OK",
  },
  atencao: {
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-l-amber-500/60",
    label: "Atenção",
  },
  critico: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-l-red-500/60",
    label: "Crítico",
  },
} as const;

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
    icon: Lightbulb,
  },
} as const;

const impactConfig = {
  alto: { color: "text-red-400", bg: "bg-red-400/10" },
  medio: { color: "text-amber-400", bg: "bg-amber-400/10" },
  baixo: { color: "text-blue-400", bg: "bg-blue-400/10" },
} as const;

const metricSemantic: Record<string, { color: string; bg: string }> = {
  "Concluídas": { color: "text-emerald-400", bg: "bg-emerald-400/8" },
  Atrasadas: { color: "text-red-400", bg: "bg-red-400/8" },
  Documentados: { color: "text-blue-400", bg: "bg-blue-400/8" },
  "Sem doc": { color: "text-amber-400", bg: "bg-amber-400/8" },
};

function MetricBadge({ value, label }: { value: number; label: string }) {
  const semantic = metricSemantic[label] || {
    color: "text-foreground",
    bg: "bg-muted/30",
  };
  return (
    <div
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg ${semantic.bg} min-w-0 flex-1`}
    >
      <span className={`text-sm font-semibold tabular-nums ${semantic.color}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground/70">{label}</span>
    </div>
  );
}

function PersonCard({
  person,
}: {
  person: OracleGroupSummary["por_pessoa"][number];
}) {
  const status = statusConfig[person.status] || statusConfig.ok;

  return (
    <div
      className={`rounded-lg border border-subtle/40 bg-muted/5 p-2.5 space-y-2 border-l-2 ${status.border} transition-colors`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-foreground truncate">
            {person.nome}
          </span>
          <span className="text-[10px] text-muted-foreground/60 shrink-0">
            {person.cargo}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">
            {person.tarefas_concluidas_ontem}
            <span className="text-muted-foreground/30"> feitas</span>
          </span>
          <span
            data-testid={`status-${person.status}`}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${status.bg} ${status.color}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {person.tarefas_atrasadas.length > 0 && (
        <div className="space-y-0.5">
          {person.tarefas_atrasadas.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[11px] text-muted-foreground pl-2 border-l border-red-400/25"
            >
              <span className="truncate mr-2">
                {t.titulo}
                <span className="text-muted-foreground/50"> · {t.cliente}</span>
              </span>
              <span className="text-red-400 font-medium tabular-nums shrink-0">
                {t.dias_atraso}d
              </span>
            </div>
          ))}
        </div>
      )}

      {person.clientes_sem_documentacao.length > 0 && (
        <div className="text-[10px] text-amber-400/60">
          Sem doc:{" "}
          <span className="text-muted-foreground/60">
            {person.clientes_sem_documentacao.join(", ")}
          </span>
        </div>
      )}

      {person.observacao && (
        <p className="text-[10px] text-muted-foreground/70 italic leading-relaxed">
          {person.observacao}
        </p>
      )}
    </div>
  );
}

function SectionDivider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />;
}

export function OracleGroupView({ data }: { data: OracleGroupSummary }) {
  return (
    <div className="space-y-4">
      {/* Panorama */}
      <div className="space-y-2.5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {data.panorama.resumo}
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          <MetricBadge
            value={data.panorama.metricas_chave.tarefas_concluidas}
            label="Concluídas"
          />
          <MetricBadge
            value={data.panorama.metricas_chave.tarefas_atrasadas}
            label="Atrasadas"
          />
          <MetricBadge
            value={data.panorama.metricas_chave.clientes_documentados}
            label="Documentados"
          />
          <MetricBadge
            value={data.panorama.metricas_chave.clientes_nao_documentados}
            label="Sem doc"
          />
        </div>
      </div>

      {/* Por pessoa */}
      {data.por_pessoa.length > 0 && (
        <>
          <SectionDivider />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Equipe
              </span>
            </div>
            <div className="space-y-1.5">
              {data.por_pessoa.map((person, i) => (
                <PersonCard key={i} person={person} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Correlações */}
      {data.correlacoes.length > 0 && (
        <>
          <SectionDivider />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Correlações
              </span>
            </div>
            <div className="space-y-1.5">
              {data.correlacoes.map((c, i) => {
                const sev = severityConfig[c.severidade] || severityConfig.info;
                const Icon = sev.icon;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border ${sev.border} ${sev.bg}`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${sev.color}`}
                    />
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-[11px] text-foreground/90 leading-relaxed">
                        {c.descricao}
                      </p>
                      <div className="flex gap-1 flex-wrap">
                        {c.pessoas_envolvidas.map((p) => (
                          <span
                            key={p}
                            className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted/30 text-muted-foreground/80 border border-subtle/20"
                          >
                            {p}
                          </span>
                        ))}
                        {c.clientes_envolvidos.map((cl) => (
                          <span
                            key={cl}
                            className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/8 text-primary/70 border border-primary/15"
                          >
                            {cl}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Recomendações */}
      {data.recomendacoes.length > 0 && (
        <>
          <SectionDivider />
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                Recomendações
              </span>
            </div>
            <div className="space-y-1.5">
              {data.recomendacoes
                .sort((a, b) => a.prioridade - b.prioridade)
                .map((r, i) => {
                  const impact =
                    impactConfig[r.impacto] || impactConfig.medio;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/5 border border-subtle/30"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-[10px] font-bold text-primary/80 shrink-0 tabular-nums">
                        {r.prioridade}
                      </span>
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <p className="text-[11px] text-foreground/90 leading-relaxed">
                          {r.acao}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50">
                          {r.razao}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${impact.bg} ${impact.color}`}
                      >
                        {r.impacto}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
