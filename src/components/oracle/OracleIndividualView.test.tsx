import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OracleIndividualView } from "./OracleIndividualView";
import type { OracleIndividualSummary } from "@/lib/oracle-utils";

const mockData: OracleIndividualSummary = {
  resumo: {
    nome: "João Silva",
    texto: "Dia produtivo com 4 tarefas concluídas, mas 2 pendências críticas.",
  },
  pendencias: [
    {
      tipo: "tarefa",
      titulo: "Relatório mensal Acme",
      cliente: "Acme Corp",
      dias_atraso: 5,
      severidade: "critical",
    },
    {
      tipo: "documentacao",
      titulo: "Documentação diária",
      cliente: "Beta Corp",
      dias_atraso: 1,
      severidade: "warning",
    },
  ],
  prioridades_hoje: [
    {
      ordem: 1,
      acao: "Concluir relatório Acme",
      cliente: "Acme Corp",
      razao: "5 dias de atraso, cliente prioritário",
    },
    {
      ordem: 2,
      acao: "Documentar Beta Corp",
      cliente: "Beta Corp",
      razao: "Sem documentação ontem",
    },
  ],
  padroes: [
    {
      tipo: "alerta",
      descricao: "Documentação atrasada 3 de 5 dias úteis",
      dados: "Seg: ✗, Ter: ✗, Qua: ✓, Qui: ✗, Sex: ✓",
    },
    {
      tipo: "positivo",
      descricao: "Tarefas concluídas acima da média do grupo",
      dados: "Média pessoal: 4.2 | Média grupo: 2.8",
    },
  ],
  reconhecimento: {
    texto: "Concluiu 4 tarefas ontem, melhor performance da semana",
    metrica: "4 tarefas (média grupo: 2.8)",
  },
};

describe("OracleIndividualView", () => {
  it("renders person name and summary text", () => {
    render(<OracleIndividualView data={mockData} />);
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText(/Dia produtivo com 4 tarefas/)).toBeInTheDocument();
  });

  it("renders pendencias with severity badges", () => {
    render(<OracleIndividualView data={mockData} />);
    expect(screen.getByText(/Relatório mensal Acme/)).toBeInTheDocument();
    expect(screen.getByText(/Documentação diária/)).toBeInTheDocument();
    expect(screen.getByTestId("severidade-critical")).toBeInTheDocument();
    expect(screen.getByTestId("severidade-warning")).toBeInTheDocument();
  });

  it("renders priorities ordered with client and reason", () => {
    render(<OracleIndividualView data={mockData} />);
    expect(screen.getByText(/Concluir relatório Acme/)).toBeInTheDocument();
    expect(screen.getByText(/Documentar Beta Corp/)).toBeInTheDocument();
    expect(screen.getByText(/5 dias de atraso/)).toBeInTheDocument();
  });

  it("renders patterns with alert and positive types", () => {
    render(<OracleIndividualView data={mockData} />);
    expect(screen.getByText(/Documentação atrasada 3 de 5/)).toBeInTheDocument();
    expect(screen.getByText(/acima da média do grupo/)).toBeInTheDocument();
  });

  it("renders recognition with concrete metric", () => {
    render(<OracleIndividualView data={mockData} />);
    expect(screen.getByText(/melhor performance da semana/)).toBeInTheDocument();
    expect(screen.getByText(/média grupo: 2.8/)).toBeInTheDocument();
  });
});
