import { describe, it, expect } from "vitest";
import {
  businessDaysBetween,
  getBusinessDayRange,
  parseOracleGroupJSON,
  parseOracleIndividualJSON,
  extractJSON,
} from "./oracle-utils";

// May 2026: Mon=4,11,18,25  Fri=1,8,15,22  Sat=2,9,16,23  Sun=3,10,17,24

describe("businessDaysBetween", () => {
  it("counts only weekdays between two dates", () => {
    // Mon May 18 → Fri May 22 = 4 (Tue,Wed,Thu,Fri)
    expect(businessDaysBetween("2026-05-18", "2026-05-22")).toBe(4);
  });

  it("skips weekends", () => {
    // Fri May 22 → Mon May 25 = 1 (Mon only, Sat+Sun skipped)
    expect(businessDaysBetween("2026-05-22", "2026-05-25")).toBe(1);
  });

  it("returns 0 for same day", () => {
    expect(businessDaysBetween("2026-05-20", "2026-05-20")).toBe(0);
  });

  it("handles full week Mon to next Mon = 5", () => {
    // Mon May 18 → Mon May 25
    expect(businessDaysBetween("2026-05-18", "2026-05-25")).toBe(5);
  });

  it("handles date spanning multiple weekends", () => {
    // Mon May 11 → Fri May 22 = 9
    expect(businessDaysBetween("2026-05-11", "2026-05-22")).toBe(9);
  });

  it("accepts Date objects", () => {
    expect(businessDaysBetween(new Date("2026-05-18"), new Date("2026-05-22"))).toBe(4);
  });
});

describe("getBusinessDayRange", () => {
  it("returns exactly N business day dates going backwards", () => {
    // From Mon May 25: Fri22, Thu21, Wed20, Tue19, Mon18
    const range = getBusinessDayRange(5, "2026-05-25");
    expect(range).toHaveLength(5);
    expect(range[0]).toBe("2026-05-22");
    expect(range[1]).toBe("2026-05-21");
    expect(range[2]).toBe("2026-05-20");
    expect(range[3]).toBe("2026-05-19");
    expect(range[4]).toBe("2026-05-18");
  });

  it("skips weekends going backwards", () => {
    // From Wed May 20: Tue19, Mon18, Fri15, Thu14, Wed13
    const range = getBusinessDayRange(5, "2026-05-20");
    expect(range).toHaveLength(5);
    expect(range[0]).toBe("2026-05-19");
    expect(range[1]).toBe("2026-05-18");
    expect(range[2]).toBe("2026-05-15"); // skipped Sat16 + Sun17
    expect(range[3]).toBe("2026-05-14");
    expect(range[4]).toBe("2026-05-13");
  });

  it("never includes Saturday or Sunday", () => {
    const range = getBusinessDayRange(10, "2026-05-25");
    for (const dateStr of range) {
      const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });

  it("returns empty array for n=0", () => {
    expect(getBusinessDayRange(0, "2026-05-25")).toEqual([]);
  });
});

describe("parseOracleGroupJSON", () => {
  const validGroup = {
    panorama: {
      resumo: "Dia produtivo com 12 tarefas concluídas.",
      metricas_chave: { tarefas_concluidas: 12, tarefas_atrasadas: 3, clientes_documentados: 8, clientes_nao_documentados: 2 },
    },
    por_pessoa: [
      {
        nome: "João",
        cargo: "gestor_crm",
        status: "atencao",
        tarefas_atrasadas: [{ titulo: "Relatório mensal", cliente: "Acme", dias_atraso: 3 }],
        tarefas_concluidas_ontem: 4,
        clientes_sem_documentacao: ["Beta Corp"],
        observacao: "Acumulando atraso no cliente Acme há 3 dias.",
      },
    ],
    correlacoes: [
      {
        tipo: "alerta",
        severidade: "warning",
        descricao: "Cliente Beta sem tracking no CRM e Ads.",
        pessoas_envolvidas: ["João", "Maria"],
        clientes_envolvidos: ["Beta Corp"],
      },
    ],
    recomendacoes: [
      {
        prioridade: 1,
        acao: "Redistribuir clientes do João.",
        razao: "Sobrecarga detectada.",
        impacto: "alto",
      },
    ],
  };

  it("parses valid group JSON string", () => {
    const result = parseOracleGroupJSON(JSON.stringify(validGroup));
    expect(result).not.toBeNull();
    expect(result!.panorama.resumo).toBe("Dia produtivo com 12 tarefas concluídas.");
    expect(result!.por_pessoa).toHaveLength(1);
    expect(result!.por_pessoa[0].nome).toBe("João");
    expect(result!.correlacoes[0].severidade).toBe("warning");
    expect(result!.recomendacoes[0].prioridade).toBe(1);
  });

  it("returns null for invalid JSON string", () => {
    expect(parseOracleGroupJSON("not json")).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    expect(parseOracleGroupJSON(JSON.stringify({ panorama: {} }))).toBeNull();
  });

  it("returns null for plain text (legacy format)", () => {
    expect(parseOracleGroupJSON("VISÃO GERAL\n• 12 tarefas concluídas")).toBeNull();
  });
});

describe("parseOracleIndividualJSON", () => {
  const validIndividual = {
    resumo: { nome: "João", texto: "Dia produtivo com 4 tarefas concluídas." },
    pendencias: [
      { tipo: "tarefa", titulo: "Relatório", cliente: "Acme", dias_atraso: 3, severidade: "critical" },
    ],
    prioridades_hoje: [
      { ordem: 1, acao: "Concluir relatório Acme", cliente: "Acme", razao: "3 dias de atraso" },
    ],
    padroes: [
      { tipo: "alerta", descricao: "Documentação atrasada 3 de 5 dias", dados: "Seg: 0, Ter: 0, Qua: 1, Qui: 0, Sex: 1" },
    ],
    reconhecimento: { texto: "Concluiu 4 tarefas ontem", metrica: "Acima da média do grupo (2.5)" },
  };

  it("parses valid individual JSON string", () => {
    const result = parseOracleIndividualJSON(JSON.stringify(validIndividual));
    expect(result).not.toBeNull();
    expect(result!.resumo.nome).toBe("João");
    expect(result!.pendencias).toHaveLength(1);
    expect(result!.pendencias[0].severidade).toBe("critical");
    expect(result!.prioridades_hoje[0].ordem).toBe(1);
    expect(result!.padroes[0].tipo).toBe("alerta");
    expect(result!.reconhecimento.texto).toBe("Concluiu 4 tarefas ontem");
  });

  it("returns null for invalid JSON", () => {
    expect(parseOracleIndividualJSON("not json")).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    expect(parseOracleIndividualJSON(JSON.stringify({ resumo: {} }))).toBeNull();
  });
});

describe("extractJSON", () => {
  it("returns clean JSON when input is already valid JSON", () => {
    const json = '{"panorama":{"resumo":"test"}}';
    expect(extractJSON(json)).toBe(json);
  });

  it("extracts JSON from markdown code block", () => {
    const wrapped = '```json\n{"panorama":{"resumo":"test"}}\n```';
    expect(extractJSON(wrapped)).toBe('{"panorama":{"resumo":"test"}}');
  });

  it("extracts JSON from code block without language tag", () => {
    const wrapped = '```\n{"panorama":{"resumo":"test"}}\n```';
    expect(extractJSON(wrapped)).toBe('{"panorama":{"resumo":"test"}}');
  });

  it("extracts JSON when LLM adds text before/after", () => {
    const wrapped = 'Aqui está o resumo:\n\n{"panorama":{"resumo":"test"}}\n\nEspero que ajude!';
    expect(extractJSON(wrapped)).toBe('{"panorama":{"resumo":"test"}}');
  });

  it("handles multiline JSON object", () => {
    const multiline = '```json\n{\n  "panorama": {\n    "resumo": "test"\n  }\n}\n```';
    const result = extractJSON(multiline);
    expect(JSON.parse(result!)).toEqual({ panorama: { resumo: "test" } });
  });

  it("returns null when no JSON found", () => {
    expect(extractJSON("This is just plain text with no JSON")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractJSON("")).toBeNull();
  });
});
