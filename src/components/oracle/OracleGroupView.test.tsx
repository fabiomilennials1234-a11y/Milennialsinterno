import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OracleGroupView } from "./OracleGroupView";
import type { OracleGroupSummary } from "@/lib/oracle-utils";

const mockData: OracleGroupSummary = {
  panorama: {
    resumo: "Dia produtivo com 12 tarefas concluídas e 3 atrasadas.",
    metricas_chave: {
      tarefas_concluidas: 12,
      tarefas_atrasadas: 3,
      clientes_documentados: 8,
      clientes_nao_documentados: 2,
    },
  },
  por_pessoa: [
    {
      nome: "João Silva",
      cargo: "gestor_crm",
      status: "critico",
      tarefas_atrasadas: [
        { titulo: "Relatório mensal", cliente: "Acme Corp", dias_atraso: 5 },
      ],
      tarefas_concluidas_ontem: 4,
      clientes_sem_documentacao: ["Beta Corp"],
      observacao: "Acumulando atraso no cliente Acme há 3 dias consecutivos.",
    },
    {
      nome: "Maria Santos",
      cargo: "ads_manager",
      status: "ok",
      tarefas_atrasadas: [],
      tarefas_concluidas_ontem: 6,
      clientes_sem_documentacao: [],
      observacao: "Performance excelente, todos clientes documentados.",
    },
  ],
  correlacoes: [
    {
      tipo: "alerta",
      severidade: "warning",
      descricao: "Cliente Beta sem tracking no CRM e Ads simultaneamente.",
      pessoas_envolvidas: ["João Silva", "Maria Santos"],
      clientes_envolvidos: ["Beta Corp"],
    },
  ],
  recomendacoes: [
    {
      prioridade: 1,
      acao: "Redistribuir 2 clientes do João para Maria.",
      razao: "João está sobrecarregado com 5 tarefas atrasadas.",
      impacto: "alto",
    },
  ],
};

describe("OracleGroupView", () => {
  it("renders panorama section with summary text", () => {
    render(<OracleGroupView data={mockData} />);
    expect(screen.getByText(/Dia produtivo com 12 tarefas/)).toBeInTheDocument();
  });

  it("renders key metrics as numbers", () => {
    render(<OracleGroupView data={mockData} />);
    expect(screen.getByText("Concluídas")).toBeInTheDocument();
    expect(screen.getByText("Atrasadas")).toBeInTheDocument();
    expect(screen.getByText("Documentados")).toBeInTheDocument();
    expect(screen.getByText("Sem doc")).toBeInTheDocument();
  });

  it("renders person cards with names", () => {
    render(<OracleGroupView data={mockData} />);
    expect(screen.getAllByText("João Silva").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Maria Santos").length).toBeGreaterThanOrEqual(1);
  });

  it("renders status indicators per person", () => {
    render(<OracleGroupView data={mockData} />);
    expect(screen.getByTestId("status-critico")).toBeInTheDocument();
    expect(screen.getByTestId("status-ok")).toBeInTheDocument();
  });

  it("renders overdue tasks with client name and days", () => {
    render(<OracleGroupView data={mockData} />);
    expect(screen.getByText(/Relatório mensal/)).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText("5d")).toBeInTheDocument();
  });

  it("renders correlations with severity", () => {
    render(<OracleGroupView data={mockData} />);
    expect(screen.getByText(/Beta sem tracking no CRM e Ads/)).toBeInTheDocument();
  });

  it("renders recommendations ordered by priority", () => {
    render(<OracleGroupView data={mockData} />);
    expect(screen.getByText(/Redistribuir 2 clientes/)).toBeInTheDocument();
  });
});
