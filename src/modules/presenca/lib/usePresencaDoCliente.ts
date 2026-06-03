// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 5 (#81) — hook READ-ONLY: assina o canal de presença de um cliente e
// devolve o mapa agregado { demandaId -> [{user_id, atuando}] } para o badge ao
// vivo. Não faz track (não anuncia o próprio usuário) — quem anuncia é
// usePresencaDemanda. Aqui só se observa. ADR 0007.
//
// Canal `private: true` (segurança — ver canal.ts). A RLS de realtime.messages
// barra quem não pode_ver_cliente; não-autorizado simplesmente não recebe estado.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { topicoPresencaCliente } from "./canal";
import { agregarPorDemanda, type MapaPresenca, type PresencaCrua } from "./atuacao";

/**
 * Observa a presença viva de um cliente. Retorna o mapa por demanda, pronto
 * para o badge. Recolhe e reagrega a cada sync/join/leave do canal.
 */
export function usePresencaDoCliente(clientId: string | null | undefined): MapaPresenca {
  const [mapa, setMapa] = useState<MapaPresenca>({});

  useEffect(() => {
    if (!clientId) {
      setMapa({});
      return;
    }
    const canal = supabase.channel(topicoPresencaCliente(clientId), {
      config: { private: true },
    });

    const reagregar = () => {
      const state = canal.presenceState<PresencaCrua>();
      const cruas: PresencaCrua[] = Object.values(state)
        .flat()
        .map((m) => ({
          user_id: m.user_id,
          demanda_id: m.demanda_id ?? null,
          atuando: Boolean(m.atuando),
        }));
      setMapa(agregarPorDemanda(cruas));
    };

    canal
      .on("presence", { event: "sync" }, reagregar)
      .on("presence", { event: "join" }, reagregar)
      .on("presence", { event: "leave" }, reagregar)
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [clientId]);

  return mapa;
}
