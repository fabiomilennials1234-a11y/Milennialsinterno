// Módulo `cliente` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 2 (#78) — estado de UI sobre o contrato de Envolvido.
// Encapsula react-query (cache/invalidação/erro) por cima dos wrappers puros de
// `envolvidos.ts`. A UI consome ESTE hook; os wrappers continuam testáveis sem
// React. Agrega as linhas planas `(user_id, papel)` em "pessoas com N papéis" —
// é o que a tela mostra (uma linha por pessoa, não por membership).

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listarEnvolvidos,
  adicionarEnvolvido,
  removerEnvolvido,
  type Envolvido,
  type PapelNoCliente,
} from "./envolvidos";

/** Uma pessoa Envolvida + todos os papéis que ela exerce no cliente. */
export interface EnvolvidoAgrupado {
  user_id: string;
  papeis: PapelNoCliente[];
  /** Mais antigo `entrou_em` entre os papéis — "envolvida desde". */
  entrou_em: string;
}

function agrupar(linhas: Envolvido[]): EnvolvidoAgrupado[] {
  const porPessoa = new Map<string, EnvolvidoAgrupado>();
  for (const l of linhas) {
    const atual = porPessoa.get(l.user_id);
    if (atual) {
      atual.papeis.push(l.papel_no_cliente);
      if (l.entrou_em < atual.entrou_em) atual.entrou_em = l.entrou_em;
    } else {
      porPessoa.set(l.user_id, {
        user_id: l.user_id,
        papeis: [l.papel_no_cliente],
        entrou_em: l.entrou_em,
      });
    }
  }
  // Mais recém-envolvidos primeiro — o que mudou por último é o que interessa.
  return [...porPessoa.values()].sort((a, b) => b.entrou_em.localeCompare(a.entrou_em));
}

function chaveLista(clientId: string) {
  return ["cliente", "envolvidos", clientId] as const;
}

/** Lista os Envolvidos de um cliente, já agrupados por pessoa. */
export function useEnvolvidos(clientId: string) {
  return useQuery({
    queryKey: chaveLista(clientId),
    enabled: Boolean(clientId),
    staleTime: 30_000,
    queryFn: () => listarEnvolvidos(clientId),
    select: agrupar,
  });
}

/** Mutations de membership, com invalidação da lista do cliente. */
export function useEnvolvidoMutations(clientId: string) {
  const qc = useQueryClient();
  const invalidar = useCallback(
    () => qc.invalidateQueries({ queryKey: chaveLista(clientId) }),
    [qc, clientId],
  );

  const adicionar = useMutation({
    mutationFn: (v: { userId: string; papel: PapelNoCliente }) =>
      adicionarEnvolvido(clientId, v.userId, v.papel),
    onSuccess: invalidar,
  });

  const remover = useMutation({
    mutationFn: (v: { userId: string; papel: PapelNoCliente }) =>
      removerEnvolvido(clientId, v.userId, v.papel),
    onSuccess: invalidar,
  });

  return { adicionar, remover };
}
