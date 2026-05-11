import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
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
      const audioBytes = new Uint8Array(audioBuffer);

      // --- Convert to base64 ---
      let base64Audio = "";
      const CHUNK = 32768;
      for (let i = 0; i < audioBytes.length; i += CHUNK) {
        base64Audio += String.fromCharCode(
          ...audioBytes.subarray(i, i + CHUNK),
        );
      }
      base64Audio = btoa(base64Audio);

      // --- Call OpenRouter ---
      const openrouterResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-001",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Transcreva o audio a seguir em portugues brasileiro. Retorne APENAS a transcricao completa, sem comentarios adicionais. Se houver multiplos falantes, identifique como Falante 1, Falante 2, etc.",
                  },
                  {
                    type: "input_audio",
                    input_audio: {
                      data: base64Audio,
                      format: "webm",
                    },
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!openrouterResponse.ok) {
        const errText = await openrouterResponse.text();
        throw new Error(
          `OpenRouter API error ${openrouterResponse.status}: ${errText}`,
        );
      }

      const result = await openrouterResponse.json();
      const transcriptText = result.choices?.[0]?.message?.content;

      if (!transcriptText) {
        throw new Error("OpenRouter returned empty transcription");
      }

      // --- Save success ---
      await adminClient
        .from("recorded_meetings")
        .update({
          transcript: {
            text: transcriptText,
            model: "gemini-2.0-flash-001",
            transcribed_at: new Date().toISOString(),
          },
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
