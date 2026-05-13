/**
 * finalize-recording edge function.
 *
 * Called after the browser assembles and uploads the final recording files.
 * Responsibilities:
 * 1. Validate JWT and session ownership
 * 2. Insert recorded_meetings row
 * 3. Update recording_sessions to done
 * 4. Delete chunk objects from storage
 * 5. Trigger transcription (fire-and-forget)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  let body: {
    session_id: string;
    video_url: string;
    audio_url: string;
    video_path: string;
    audio_path: string;
    duration_seconds: number;
    title: string;
    folder_id: string;
    client_id: string | null;
    file_size: number;
  };

  try {
    body = await req.json();
    if (!body.session_id || !body.video_url || !body.folder_id) {
      throw new Error("Missing required fields");
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Fetch session & validate ownership ---
  const { data: session, error: sessionErr } = await adminClient
    .from("recording_sessions")
    .select("*")
    .eq("id", body.session_id)
    .single();

  if (sessionErr || !session) {
    return new Response(
      JSON.stringify({ error: "Session not found" }),
      { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  if (session.created_by !== user.id) {
    return new Response(
      JSON.stringify({ error: "Forbidden: session belongs to another user" }),
      { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Idempotency: if already done, return existing meeting_id
  if (session.status === "done" && session.meeting_id) {
    return new Response(
      JSON.stringify({ meeting_id: session.meeting_id, status: "already_done" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  try {
    // --- Mark assembling ---
    await adminClient
      .from("recording_sessions")
      .update({ status: "assembling" })
      .eq("id", body.session_id);

    // --- Insert recorded_meetings ---
    const { data: meeting, error: meetingErr } = await adminClient
      .from("recorded_meetings")
      .insert({
        folder_id: body.folder_id,
        client_id: body.client_id || null,
        title: body.title || null,
        video_url: body.video_url,
        video_filename: body.video_path.split("/").pop() || null,
        audio_file_url: body.audio_url,
        meeting_date: new Date().toISOString().split("T")[0],
        participants: [],
        is_whole_team: true,
        file_size: body.file_size || null,
        duration_seconds: body.duration_seconds || null,
        recorded_in_browser: true,
        transcript_status: "none",
        created_by: user.id,
        created_by_name: user.user_metadata?.name || null,
      })
      .select("id")
      .single();

    if (meetingErr) throw meetingErr;

    // --- Update session to done ---
    await adminClient
      .from("recording_sessions")
      .update({
        status: "done",
        meeting_id: meeting.id,
        assembled_at: new Date().toISOString(),
        final_video_path: body.video_path,
        final_audio_path: body.audio_path,
      })
      .eq("id", body.session_id);

    // --- Cleanup chunks from storage (fire-and-forget) ---
    const cleanupPromise = (async () => {
      try {
        const storagePrefix = session.storage_prefix;

        // List and delete video chunks
        const { data: videoFiles } = await adminClient.storage
          .from("recorded-meetings")
          .list(storagePrefix + "video");

        if (videoFiles && videoFiles.length > 0) {
          const videoPaths = videoFiles.map(
            (f: { name: string }) => `${storagePrefix}video/${f.name}`,
          );
          await adminClient.storage.from("recorded-meetings").remove(videoPaths);
        }

        // List and delete audio chunks
        const { data: audioFiles } = await adminClient.storage
          .from("recorded-meetings")
          .list(storagePrefix + "audio");

        if (audioFiles && audioFiles.length > 0) {
          const audioPaths = audioFiles.map(
            (f: { name: string }) => `${storagePrefix}audio/${f.name}`,
          );
          await adminClient.storage.from("recorded-meetings").remove(audioPaths);
        }

        console.log(`Cleaned up chunks for session ${body.session_id}`);
      } catch (cleanupErr) {
        // Non-fatal: chunks become orphans, not a data integrity issue
        console.error(`Chunk cleanup failed for session ${body.session_id}:`, cleanupErr);
      }
    })();

    // --- Trigger transcription (fire-and-forget) ---
    const transcribePromise = (async () => {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/transcribe-meeting`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recording_id: meeting.id }),
        });
      } catch (err) {
        console.warn("Transcription trigger failed:", err);
      }
    })();

    // Use EdgeRuntime.waitUntil for background tasks
    const _edgeRuntime = (globalThis as Record<string, unknown>).EdgeRuntime as {
      waitUntil?: (p: Promise<unknown>) => void;
    } | undefined;

    if (_edgeRuntime?.waitUntil) {
      _edgeRuntime.waitUntil(Promise.all([cleanupPromise, transcribePromise]));
    } else {
      await Promise.all([cleanupPromise, transcribePromise]);
    }

    return new Response(
      JSON.stringify({ meeting_id: meeting.id, status: "done" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Finalize failed for session ${body.session_id}:`, message);

    // Mark session as failed
    await adminClient
      .from("recording_sessions")
      .update({ status: "failed", error_message: message })
      .eq("id", body.session_id);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
