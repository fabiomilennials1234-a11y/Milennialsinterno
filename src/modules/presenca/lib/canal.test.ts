// Módulo `presenca` — testes da convenção de canal. Slice 5 (#81). ADR 0007.
// O formato do topic é contrato compartilhado com a policy de realtime.messages
// (que faz substring(realtime.topic() FROM 'presenca:client:(.*)')). Provar o
// round-trip aqui evita divergência silenciosa entre front e a RLS de segurança.

import { describe, it, expect } from "vitest";
import { topicoPresencaCliente, clientIdDoTopico } from "./canal";

const CLIENT = "11111111-1111-1111-1111-111111111111";

describe("topicoPresencaCliente / clientIdDoTopico", () => {
  it("constrói o topic no formato presenca:client:<uuid>", () => {
    expect(topicoPresencaCliente(CLIENT)).toBe(`presenca:client:${CLIENT}`);
  });

  it("round-trip: extrai de volta o clientId (espelha o substring da policy)", () => {
    expect(clientIdDoTopico(topicoPresencaCliente(CLIENT))).toBe(CLIENT);
  });

  it("retorna null para topics que não são de presença (a policy não os atende)", () => {
    expect(clientIdDoTopico("outra:coisa")).toBeNull();
    expect(clientIdDoTopico("realtime:public:tech_tasks")).toBeNull();
  });
});
