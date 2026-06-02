import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { extractBearer, isServiceRoleCaller } from "../_shared/internalAuth.ts";

// Transcription provider: Deepgram Nova-2 (ADR 0003 — supersedes 0002).
//
// URL-BASED on purpose: we hand Deepgram the public audio URL and it fetches the
// file itself. Zero audio bytes enter this edge worker's memory, so there is no
// OOM ceiling — a full 2h meeting transcribes fine. (The OpenRouter swap loaded
// base64 audio in-memory and OOM-killed the worker on real recordings; reverted.)
// Output carries real diarization: per-speaker `segments` + has_diarization:true
// so the viewer colors by voice.
const DEEPGRAM_LISTEN_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&diarize=true&punctuate=true&utterances=true";

serve(async (req) => {
  const cors = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!DEEPGRAM_API_KEY) {
    return new Response(
      JSON.stringify({ error: "DEEPGRAM_API_KEY not configured" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // --- Auth (gateway verify_jwt is OFF — see config.toml; we validate here).
  //     Accept a valid end-user JWT, OR the trusted internal caller presenting
  //     the service-role key (reconcile-recordings cron). The internal caller's
  //     secret never leaves the server environment, so this is not a
  //     client-exposed path. ---
  const authHeader = req.headers.get("Authorization");
  const token = extractBearer(authHeader);
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const isInternalCall = isServiceRoleCaller(
    token,
    SUPABASE_SERVICE_ROLE_KEY,
    Deno.env.get("SUPABASE_SERVICE_ROLE_JWT_LEGACY"),
  );
  if (!isInternalCall) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
  }

  // --- Parse body ---
  let recording_id: string;
  try {
    const body = await req.json();
    recording_id = body.recording_id;
    if (!recording_id || typeof recording_id !== "string") {
      throw new Error("missing recording_id");
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Body must contain { recording_id: string }" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // --- Service role client for DB mutations ---
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Fetch recording ---
  const { data: recording, error: fetchErr } = await adminClient
    .from("recorded_meetings")
    .select("id, audio_file_url, transcript_status, updated_at")
    .eq("id", recording_id)
    .single();

  if (fetchErr || !recording) {
    return new Response(
      JSON.stringify({ error: "Recording not found" }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  if (!recording.audio_file_url) {
    return new Response(
      JSON.stringify({ error: "Recording has no audio file" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Idempotency guard: if already completed, do nothing.
  if (recording.transcript_status === "completed") {
    return new Response(
      JSON.stringify({ status: "already_completed", recording_id }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // If a previous attempt is still 'processing', only re-run if it has been
  // stuck for >15min (the prior runtime likely died inside waitUntil). This
  // makes the function safe to call repeatedly (reconciler + manual retry).
  const STUCK_PROCESSING_MS = 15 * 60 * 1000;
  if (recording.transcript_status === "processing") {
    const updatedAt = recording.updated_at ? new Date(recording.updated_at).getTime() : 0;
    const stuckFor = Date.now() - updatedAt;
    if (stuckFor < STUCK_PROCESSING_MS) {
      return new Response(
        JSON.stringify({ status: "already_processing", recording_id }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    // else: fall through and reprocess the stuck recording.
  }

  // --- Mark processing (bumps updated_at, which the timeout guard reads) ---
  await adminClient
    .from("recorded_meetings")
    .update({ transcript_status: "processing", transcript_error: null, updated_at: new Date().toISOString() })
    .eq("id", recording_id);

  // Respond immediately — transcription runs in background via waitUntil
  const transcriptionPromise = (async () => {
    try {
      // --- Call Deepgram (URL-based — Deepgram fetches the audio itself) ---
      const deepgramResponse = await fetch(DEEPGRAM_LISTEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: recording.audio_file_url }),
      });

      if (!deepgramResponse.ok) {
        // Truncate the upstream body; never log request headers (they carry the
        // Deepgram API key). Only status + a short body excerpt is surfaced.
        const errText = (await deepgramResponse.text()).slice(0, 300);
        throw new Error(`Deepgram API error ${deepgramResponse.status}: ${errText}`);
      }

      const result = await deepgramResponse.json();
      const utterances = result.results?.utterances;

      let transcript: Record<string, unknown>;

      if (utterances && utterances.length > 0) {
        // Diarized transcript with per-speaker segments.
        const segments = utterances.map(
          (u: { speaker: number; transcript: string; start: number; end: number }) => ({
            speaker: u.speaker,
            text: u.transcript,
            start: u.start,
            end: u.end,
          }),
        );

        transcript = {
          text: utterances
            .map((u: { speaker: number; transcript: string }) => `Voz ${u.speaker + 1}: ${u.transcript}`)
            .join("\n"),
          segments,
          speakers_count: new Set(utterances.map((u: { speaker: number }) => u.speaker)).size,
          model: "deepgram-nova-2",
          transcribed_at: new Date().toISOString(),
          has_diarization: true,
        };
      } else {
        // Fallback: plain transcript without diarization.
        const plainText =
          result.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

        if (!plainText) {
          throw new Error("Deepgram returned empty transcription");
        }

        transcript = {
          text: plainText,
          segments: [],
          speakers_count: 1,
          model: "deepgram-nova-2",
          transcribed_at: new Date().toISOString(),
          has_diarization: false,
        };
      }

      // --- Save success + enqueue ata generation ---
      // Setting ata_status='pending' hands off to the ata pipeline; the
      // reconciler guarantees generate-meeting-ata runs durably.
      await adminClient
        .from("recorded_meetings")
        .update({
          transcript,
          transcript_status: "completed",
          transcript_error: null,
          ata_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", recording_id);

      console.log(`Transcription completed for recording ${recording_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Transcription failed for ${recording_id}:`, message);

      await adminClient
        .from("recorded_meetings")
        .update({
          transcript_status: "failed",
          transcript_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recording_id);
    }
  })();

  // Use EdgeRuntime.waitUntil if available (Supabase Edge Functions support it)
  // This lets us respond immediately while transcription runs in background
  const _edgeRuntime = (globalThis as any).EdgeRuntime;
  if (_edgeRuntime?.waitUntil) {
    _edgeRuntime.waitUntil(transcriptionPromise);
  } else {
    // Fallback: await inline (caller doesn't wait anyway — fire-and-forget)
    await transcriptionPromise;
  }

  return new Response(
    JSON.stringify({ status: "processing", recording_id }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
