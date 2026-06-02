/**
 * reconcile-recordings edge function.
 *
 * Durable safety net for the recording pipeline. Invoked by pg_cron every 5min
 * (via pg_net). Sweeps for work that the happy-path fire-and-forget may have
 * dropped (edge runtime recycled mid-waitUntil, browser closed mid-assembly):
 *
 *   1. transcript_status = 'pending'                      → re-dispatch transcribe
 *      OR ('processing' AND updated_at < now()-15min)
 *   2. ata_status = 'pending'                             → re-dispatch ata
 *      OR ('processing' AND updated_at < now()-15min)
 *   3. recording_sessions in 'assembling' > 30min         → mark 'failed' (clear msg)
 *
 * Re-dispatch uses the service role key as the worker Authorization (trusted
 * internal caller). The workers are idempotent, so double-firing is safe.
 *
 * Auth: accepts the anon key (cron) or service role key. Read/write via service
 * role. No user data is returned in the response — counts only.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { extractBearer, isServiceRoleCaller, timingSafeEqual } from "../_shared/internalAuth.ts";

const STUCK_PROCESSING_MIN = 15;
const STUCK_ASSEMBLING_MIN = 30;
const BATCH = 25;

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const token = extractBearer(req.headers.get("Authorization"));
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Gate (gateway verify_jwt is OFF — see config.toml): accept the service-role
  // key, or the cron's anon key (read from the server-only _internal_config
  // table). Avoids depending on which auth keys the platform injects into env.
  const { data: cfg } = await db
    .from("_internal_config")
    .select("value")
    .eq("key", "supabase_anon_key")
    .maybeSingle();
  const cronToken = cfg?.value ?? null;

  const isAuthorized =
    isServiceRoleCaller(token, SERVICE_ROLE, Deno.env.get("SUPABASE_SERVICE_ROLE_JWT_LEGACY")) ||
    (cronToken !== null && timingSafeEqual(token, cronToken));
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const stuckProcessingIso = new Date(Date.now() - STUCK_PROCESSING_MIN * 60_000).toISOString();
  const stuckAssemblingIso = new Date(Date.now() - STUCK_ASSEMBLING_MIN * 60_000).toISOString();

  const dispatch = (fn: string, recording_id: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recording_id }),
    }).catch((err) => console.error(`dispatch ${fn} ${recording_id} failed:`, err));

  const result = { transcripts_redispatched: 0, atas_redispatched: 0, sessions_failed: 0 };

  // 1. Transcripts: pending OR stuck-processing.
  const { data: txRows } = await db
    .from("recorded_meetings")
    .select("id, transcript_status, updated_at")
    .or(`transcript_status.eq.pending,and(transcript_status.eq.processing,updated_at.lt.${stuckProcessingIso})`)
    .limit(BATCH);

  for (const row of txRows ?? []) {
    await dispatch("transcribe-meeting", row.id);
    result.transcripts_redispatched++;
  }

  // 2. Atas: pending OR stuck-processing (only meaningful once transcript done,
  //    but the ata worker re-validates that, so we can dispatch safely).
  const { data: ataRows } = await db
    .from("recorded_meetings")
    .select("id, ata_status, updated_at")
    .or(`ata_status.eq.pending,and(ata_status.eq.processing,updated_at.lt.${stuckProcessingIso})`)
    .limit(BATCH);

  for (const row of ataRows ?? []) {
    await dispatch("generate-meeting-ata", row.id);
    result.atas_redispatched++;
  }

  // 3. Sessions stuck in 'assembling' beyond the window → terminal 'failed'.
  const { data: stuckSessions } = await db
    .from("recording_sessions")
    .update({
      status: "failed",
      error_message: "Montagem da gravação não concluída (janela de 30min excedida). Tente gravar novamente.",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "assembling")
    .lt("updated_at", stuckAssemblingIso)
    .select("id");

  result.sessions_failed = (stuckSessions ?? []).length;

  console.log("[reconcile-recordings]", JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
