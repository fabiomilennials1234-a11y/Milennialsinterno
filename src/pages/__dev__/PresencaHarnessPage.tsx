// DEV-ONLY harness — Slice 5 (#81). NÃO faz parte do produto. A rota que monta
// este componente é guardada por `import.meta.env.DEV` em App.tsx, então nunca
// existe em build de produção.
//
// Existe para a evidência E2E ao vivo da Presença: duas sessões reais
// (`?papel=anuncia` e `?papel=observa`) no MESMO canal private de um cliente
// provam que (a) o canal autoriza quem pode_ver_cliente e (b) o observador vê o
// anunciante atuando em tempo real. Sem isso, validar presença exigiria fiar a
// feature numa página de produto — fora do escopo desta slice (módulo + estado
// vivo). Parâmetros via querystring para o Playwright dirigir dois contextos.

import {
  usePresencaDemanda,
  usePresencaDoCliente,
  BadgeAtuando,
} from "@/modules/presenca";

function qs(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export default function PresencaHarnessPage() {
  const p = qs();
  const papel = (p.get("papel") ?? "observa") as "anuncia" | "observa";
  const clientId = p.get("client");
  const demandaId = p.get("demanda");
  const userId = p.get("user");
  // Limiar de idle curto para o teste exercitar auto-pausa sem esperar 5 min.
  const idleLimiarMs = Number(p.get("idle") ?? "") || undefined;

  // Anunciante: entra no canal e faz track (atuando inferido).
  const { atuando } = usePresencaDemanda({
    clientId: papel === "anuncia" ? clientId : null,
    demandaId,
    userId,
    idleLimiarMs,
  });

  // Observador: assina o canal read-only e agrega para o badge.
  const mapa = usePresencaDoCliente(papel === "observa" ? clientId : null);
  const pessoas = demandaId ? mapa[demandaId] ?? [] : [];

  return (
    <div
      className="mtech-scope min-h-screen p-8"
      data-testid="presenca-harness"
      data-papel={papel}
    >
      <h1 className="mb-6 text-lg font-semibold text-mtech-text">
        Presença — harness (dev) · {papel}
      </h1>

      {papel === "anuncia" && (
        <div data-testid="estado-anuncia" data-atuando={String(atuando)} className="text-mtech-text-muted">
          Anunciando no canal do cliente — atuando: <strong>{String(atuando)}</strong>
        </div>
      )}

      {papel === "observa" && (
        <div className="space-y-4">
          <div data-testid="contagem-presentes" className="text-mtech-text-muted">
            Presentes nesta demanda: <strong>{pessoas.length}</strong>
          </div>
          <div data-testid="badge-host">
            <BadgeAtuando pessoas={pessoas} />
          </div>
        </div>
      )}
    </div>
  );
}
