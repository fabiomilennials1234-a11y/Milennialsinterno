-- 20260603160000_presenca_realtime_authorization.sql
-- Slice 5 (#81) — Presença ao vivo. ADR 0004 + ADR 0005 + ADR 0007.
--
-- SEGURANÇA CRÍTICA. O estado "quem atua agora" trafega por um canal de
-- Supabase Realtime Presence efêmero, em memória, por cliente
-- (topic `presenca:client:<clientId>`). Realtime NÃO aplica RLS na entrada de um
-- canal PÚBLICO por padrão — qualquer authenticated que saiba o nome do topic
-- entraria, faria track() e leria todo mundo: VAZAMENTO cross-cliente (mesma
-- classe de risco LGPD do ADR 0005).
--
-- Mitigação (Realtime Authorization): o frontend abre o canal como `private`,
-- e ESTA policy em `realtime.messages` autoriza o join/leitura SOMENTE a quem
-- pode ver o cliente do topic — delegando ao predicado dono único de audiência
-- `cliente.pode_ver_cliente` (A+B+C+D, ADR 0005). Sem nova definição de
-- visibilidade; sem literal de role (guard no_literal_role_in_policy verde).
--
-- Estado atual do projeto (verificado): realtime.messages tem RLS LIGADA e ZERO
-- policies. Default-deny só atinge canais PRIVATE; públicos passam batido — por
-- isso o canal É private no front e ESTA policy é o gate. Aditiva: não toca
-- public, não interfere em Postgres-Changes (publication supabase_realtime),
-- não atende nenhum outro topic além de `presenca:client:%`.
--
-- NÃO há schema/tabela `presenca` no Postgres nesta slice: a presença é VIVA e
-- efêmera (não persistida). O "lado-banco" do módulo presença é só esta policy
-- de autorização do transporte. Persistência de intervalo é #83 — fora.

BEGIN;

-- Predicado de autorização do canal de presença, reusado por LEITURA e ESCRITA.
-- Realtime Authorization (Supabase): SELECT policy = pode RECEBER (join/observar);
-- INSERT policy = pode ENVIAR (track de presença). Sem a INSERT, o track() é
-- silenciosamente descartado (canal sobe, mas ninguém vê ninguém) — por isso as
-- DUAS são necessárias. Ambas escopam por extension in ('presence','broadcast')
-- e pelo prefixo do topic, delegando a audiência a cliente.pode_ver_cliente.

-- Idempotência: recria as policies do zero.
DROP POLICY IF EXISTS presenca_canal_ler   ON realtime.messages;
DROP POLICY IF EXISTS presenca_canal_enviar ON realtime.messages;
-- Nome legado (caso uma versão anterior tenha sido aplicada).
DROP POLICY IF EXISTS presenca_canal_audiencia ON realtime.messages;

-- LER: recebe presença/broadcast do canal (autoriza o JOIN/observação).
CREATE POLICY presenca_canal_ler
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'presenca:client:%'
  AND realtime.messages.extension IN ('presence', 'broadcast')
  AND cliente.pode_ver_cliente(
        substring(realtime.topic() FROM '^presenca:client:(.+)$')::uuid,
        (SELECT auth.uid())
      )
);

-- ENVIAR: faz track() de presença no canal (anúncio "estou atuando").
CREATE POLICY presenca_canal_enviar
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'presenca:client:%'
  AND realtime.messages.extension IN ('presence', 'broadcast')
  AND cliente.pode_ver_cliente(
        substring(realtime.topic() FROM '^presenca:client:(.+)$')::uuid,
        (SELECT auth.uid())
      )
);

COMMENT ON POLICY presenca_canal_ler ON realtime.messages IS
  'ADR 0007 (Slice 5/#81): RECEBER presença do canal `presenca:client:<id>` — '
  'autoriza join/observação a quem pode_ver_cliente (audiência unificada, ADR '
  '0005). Canal é private no front; sem esta policy o public vazaria presença '
  'cross-cliente. Só topics presenca:client:%. Sem literal de role.';
COMMENT ON POLICY presenca_canal_enviar ON realtime.messages IS
  'ADR 0007 (Slice 5/#81): ENVIAR (track) presença no canal `presenca:client:<id>` '
  '— mesmo gate pode_ver_cliente. Sem esta INSERT policy, track() é descartado '
  'silenciosamente e ninguém aparece. Só topics presenca:client:%. Sem literal de role.';

COMMIT;
