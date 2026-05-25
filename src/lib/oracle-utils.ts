// --- Oracle JSON Types ---

export interface OracleGroupSummary {
  panorama: {
    resumo: string;
    metricas_chave: {
      tarefas_concluidas: number;
      tarefas_atrasadas: number;
      clientes_documentados: number;
      clientes_nao_documentados: number;
    };
  };
  por_pessoa: {
    nome: string;
    cargo: string;
    status: "ok" | "atencao" | "critico";
    tarefas_atrasadas: { titulo: string; cliente: string; dias_atraso: number }[];
    tarefas_concluidas_ontem: number;
    clientes_sem_documentacao: string[];
    observacao: string;
  }[];
  correlacoes: {
    tipo: "alerta" | "padrao" | "insight";
    severidade: "critical" | "warning" | "info";
    descricao: string;
    pessoas_envolvidas: string[];
    clientes_envolvidos: string[];
  }[];
  recomendacoes: {
    prioridade: number;
    acao: string;
    razao: string;
    impacto: "alto" | "medio" | "baixo";
  }[];
}

export interface OracleIndividualSummary {
  resumo: { nome: string; texto: string };
  pendencias: {
    tipo: "tarefa" | "documentacao" | "tracking";
    titulo: string;
    cliente: string;
    dias_atraso: number;
    severidade: "critical" | "warning" | "info";
  }[];
  prioridades_hoje: {
    ordem: number;
    acao: string;
    cliente: string;
    razao: string;
  }[];
  padroes: {
    tipo: "alerta" | "positivo";
    descricao: string;
    dados: string;
  }[];
  reconhecimento: { texto: string; metrica: string };
}

// --- Date Utilities ---

type DateInput = Date | string;

function toUTCMidnight(d: DateInput): Date {
  if (typeof d === "string") {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addUTCDays(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

function formatUTCDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function businessDaysBetween(start: DateInput, end: DateInput): number {
  const s = toUTCMidnight(start);
  const e = toUTCMidnight(end);
  let count = 0;
  let cursor = addUTCDays(s, 1);
  while (cursor <= e) {
    if (isWeekday(cursor)) count++;
    cursor = addUTCDays(cursor, 1);
  }
  return count;
}

export function getBusinessDayRange(n: number, fromDate: DateInput): string[] {
  if (n <= 0) return [];
  const dates: string[] = [];
  let cursor = addUTCDays(toUTCMidnight(fromDate), -1);
  while (dates.length < n) {
    if (isWeekday(cursor)) {
      dates.push(formatUTCDate(cursor));
    }
    cursor = addUTCDays(cursor, -1);
  }
  return dates;
}

// --- JSON Extraction ---

export function extractJSON(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  const trimmed = raw.trim();

  // Already valid JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // Not valid as-is, try extraction below
    }
  }

  // Extract from markdown code block: ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Invalid JSON in code block
    }
  }

  // Extract first { ... } block from surrounding text
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Invalid JSON
    }
  }

  return null;
}

// --- JSON Parsers ---

export function parseOracleGroupJSON(raw: string): OracleGroupSummary | null {
  try {
    const data = JSON.parse(raw);
    if (
      !data?.panorama?.resumo ||
      !Array.isArray(data?.por_pessoa) ||
      !Array.isArray(data?.correlacoes) ||
      !Array.isArray(data?.recomendacoes)
    ) {
      return null;
    }
    return data as OracleGroupSummary;
  } catch {
    return null;
  }
}

export function parseOracleIndividualJSON(raw: string): OracleIndividualSummary | null {
  try {
    const data = JSON.parse(raw);
    if (
      !data?.resumo?.nome ||
      !Array.isArray(data?.pendencias) ||
      !Array.isArray(data?.prioridades_hoje) ||
      !Array.isArray(data?.padroes) ||
      !data?.reconhecimento
    ) {
      return null;
    }
    return data as OracleIndividualSummary;
  } catch {
    return null;
  }
}
