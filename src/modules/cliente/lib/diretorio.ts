// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 2 (#78) — diretório de pessoas (resolução de identidade para a UI).
//
// PONTO ÚNICO DE ACOPLAMENTO AO LEGADO. O contrato de Envolvido (ADR 0005) só
// trafega `user_id` — não nome nem avatar, e não cataloga "quem é selecionável".
// A camada visual precisa disso. Em vez de espalhar leituras de `public.profiles`
// pela UI, concentramos AQUI a tradução `user_id -> {nome, avatar}` e o catálogo
// de pessoas adicionáveis.
//
// `public` é o schema legado coexistente (ADR 0004) — NÃO é um módulo sob
// `eslint-boundaries`, então esta leitura não fura fronteira de módulo. Quando
// existir um módulo de identidade/pessoas com contrato próprio, troca-se apenas
// este arquivo; a UI (`EquipeDoCliente`) não muda.
//
// Decisão sinalizada ao arquiteto: idealmente este "directory" é contrato de um
// módulo `pessoas`. Não inventamos esse módulo nesta slice de UI.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Pessoa {
  user_id: string;
  nome: string;
  avatar: string | null;
}

/**
 * Resolve `user_id -> Pessoa` para um conjunto de ids (os Envolvidos do cliente).
 * Retorna um mapa estável; ids sem profile caem em fallback "Usuário sem nome"
 * (o backend não garante FK — ADR 0004 —, então a UI tolera o órfão sem quebrar).
 */
export function usePessoasPorId(ids: string[]) {
  const chave = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["cliente", "diretorio", "por-id", chave],
    enabled: chave.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, Pessoa>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, avatar")
        .in("user_id", chave);
      if (error) throw error;
      const mapa: Record<string, Pessoa> = {};
      for (const p of data ?? []) {
        mapa[p.user_id] = {
          user_id: p.user_id,
          nome: p.name ?? "Usuário sem nome",
          avatar: p.avatar ?? null,
        };
      }
      return mapa;
    },
  });
}

/**
 * Catálogo de pessoas que podem virar Envolvidas — todos os profiles internos,
 * ordenados por nome. A UI filtra fora quem já está no cliente. Mantemos amplo
 * de propósito: o contrato de membership autoriza/valida na escrita (ADR 0005);
 * o seletor não deve adivinhar regra de negócio de elegibilidade.
 */
export function usePessoasSelecionaveis() {
  return useQuery({
    queryKey: ["cliente", "diretorio", "selecionaveis"],
    staleTime: 60_000,
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, avatar")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        user_id: p.user_id,
        nome: p.name ?? "Usuário sem nome",
        avatar: p.avatar ?? null,
      }));
    },
  });
}
