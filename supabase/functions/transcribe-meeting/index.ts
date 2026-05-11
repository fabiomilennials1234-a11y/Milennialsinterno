import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

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

  // --- Validate JWT ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
    );
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
    .select("id, audio_file_url, transcript_status")
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

  if (recording.transcript_status === "processing") {
    return new Response(
      JSON.stringify({ status: "already_processing" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // --- Mark processing ---
  await adminClient
    .from("recorded_meetings")
    .update({ transcript_status: "processing", transcript_error: null })
    .eq("id", recording_id);

  // Respond immediately — transcription runs in background via waitUntil
  const transcriptionPromise = (async () => {
    try {
      // --- Download audio ---
      const audioResponse = await fetch(recording.audio_file_url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      const audioBuffer = await audioResponse.arrayBuffer();

      // --- Call Deepgram Nova-2 ---
      const deepgramUrl =
        "https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&diarize=true&punctuate=true&utterances=true";

      const deepgramResponse = await fetch(deepgramUrl, {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "audio/webm",
        },
        body: audioBuffer,
      });

      if (!deepgramResponse.ok) {
        const errText = await deepgramResponse.text();
        throw new Error(
          `Deepgram API error ${deepgramResponse.status}: ${errText}`,
        );
      }

      const result = await deepgramResponse.json();
      const utterances = result.results?.utterances;

      let transcript: Record<string, unknown>;

      if (utterances && utterances.length > 0) {
        // Diarized transcript with speaker segments
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
        // Fallback: plain transcript without diarization
        const plainText =
          result.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

        if (!plainText) {
          throw new Error("Deepgram returned empty transcription");
        }

        transcript = {
          text: plainText,
          model: "deepgram-nova-2",
          transcribed_at: new Date().toISOString(),
          has_diarization: false,
        };
      }

      // --- Save success ---
      await adminClient
        .from("recorded_meetings")
        .update({
          transcript,
          transcript_status: "completed",
          transcript_error: null,
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
