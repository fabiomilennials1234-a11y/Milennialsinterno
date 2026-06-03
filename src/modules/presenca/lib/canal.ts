// Módulo `presenca` — INTERNAL. Acesso público só via barrel `index.ts`.
//
// Slice 5 (#81) — convenção do canal de Presença (ADR 0007). Estado VIVO e
// efêmero via Supabase Realtime Presence — NÃO toca o banco (CONTEXT.md →
// Transporte). Um canal por cliente.
//
// SEGURANÇA CRÍTICA (ADR 0007): o canal é `private: true`. Só assim o servidor
// Realtime aplica a RLS de `realtime.messages` (policy `presenca_canal_audiencia`,
// que delega a cliente.pode_ver_cliente). Canal público (default) IGNORA essa RLS
// e qualquer authenticated que adivinhe o topic entraria/leria — vazamento
// cross-cliente. `private:true` é o que trava. Não troque para público.

/** Constrói o topic do canal de presença de um cliente. Fonte única do formato. */
export function topicoPresencaCliente(clientId: string): string {
  return `presenca:client:${clientId}`;
}

/** Extrai o clientId de um topic (espelha o substring da policy de realtime.messages). */
export function clientIdDoTopico(topic: string): string | null {
  const m = /^presenca:client:(.+)$/.exec(topic);
  return m ? m[1] : null;
}
