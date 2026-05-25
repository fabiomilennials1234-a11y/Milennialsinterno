import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OracleContentRouter } from "./OracleContentRouter";

const validGroupJSON = JSON.stringify({
  panorama: {
    resumo: "Dia produtivo com 12 tarefas.",
    metricas_chave: { tarefas_concluidas: 12, tarefas_atrasadas: 3, clientes_documentados: 8, clientes_nao_documentados: 2 },
  },
  por_pessoa: [{ nome: "João", cargo: "crm", status: "ok", tarefas_atrasadas: [], tarefas_concluidas_ontem: 3, clientes_sem_documentacao: [], observacao: "Tudo em dia." }],
  correlacoes: [],
  recomendacoes: [],
});

const validIndividualJSON = JSON.stringify({
  resumo: { nome: "João", texto: "Bom dia de trabalho." },
  pendencias: [],
  prioridades_hoje: [{ ordem: 1, acao: "Revisar relatório", cliente: "Acme", razao: "Prazo amanhã" }],
  padroes: [],
  reconhecimento: { texto: "100% documentação", metrica: "5/5 clientes" },
});

const legacyText = "VISÃO GERAL\n• 12 tarefas concluídas ontem\n• 3 atrasadas\n\nALERTAS CRÍTICOS\n• João tem 2 tarefas críticas";

describe("OracleContentRouter", () => {
  it("renders OracleGroupView when content is valid group JSON", () => {
    render(<OracleContentRouter content={validGroupJSON} type="group" />);
    expect(screen.getByText(/Dia produtivo com 12 tarefas/)).toBeInTheDocument();
    expect(screen.getByText("Concluídas")).toBeInTheDocument();
  });

  it("renders OracleIndividualView when content is valid individual JSON", () => {
    render(<OracleContentRouter content={validIndividualJSON} type="individual" />);
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText(/Revisar relatório/)).toBeInTheDocument();
  });

  it("falls back to legacy text renderer for plain text", () => {
    render(<OracleContentRouter content={legacyText} type="group" />);
    expect(screen.getByText("VISÃO GERAL")).toBeInTheDocument();
    expect(screen.getByText(/12 tarefas concluídas/)).toBeInTheDocument();
  });

  it("falls back to legacy renderer for invalid JSON", () => {
    render(<OracleContentRouter content="{broken json" type="group" />);
    expect(screen.getByText("{broken json")).toBeInTheDocument();
  });
});
