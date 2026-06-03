// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 5 (#81) — resolução de identidade para o badge (mesma decisão do
// `cliente/lib/diretorio`): o canal de presença só trafega `user_id`; a camada
// visual precisa de nome/avatar. Concentramos AQUI a tradução em vez de espalhar
// leituras de `public.profiles` pela UI.
//
// `public` é o schema legado coexistente (ADR 0004) — NÃO é um módulo sob
// eslint-boundaries; esta leitura não fura fronteira. Quando existir um módulo
// `pessoas` com contrato próprio, troca-se SÓ este arquivo. Decisão sinalizada
// ao arquiteto (é o 2º ponto de acoplamento ao legado de identidade — candidato
// óbvio a consolidar num módulo `pessoas` futuro).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PessoaPresenca {
  user_id: string;
  nome: string;
  avatar: string | null;
}

/** Resolve `user_id -> {nome, avatar}` para os usuários presentes. */
export function usePessoasPresenca(ids: string[]) {
  const chave = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["presenca", "diretorio", chave],
    enabled: chave.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, PessoaPresenca>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, avatar")
        .in("user_id", chave);
      if (error) throw error;
      const mapa: Record<string, PessoaPresenca> = {};
      for (const p of data ?? []) {
        mapa[p.user_id] = {
          user_id: p.user_id,
          nome: p.name ?? "Usuário",
          avatar: p.avatar ?? null,
        };
      }
      return mapa;
    },
  });
}
