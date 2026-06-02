/**
 * generate-meeting-ata edge function.
 *
 * Generates a structured meeting minutes ("ata") from a completed transcript
 * via OpenRouter (Claude Sonnet), then populates:
 *   - recorded_meetings.ata_json  → canonical structure
 *   - recorded_meetings.ata       → markdown rendered from the structure (UI reads this)
 *   - recorded_meetings.summary   → resumo_executivo
 * If the recording has a client_id, idempotently upserts client_meeting_notes
 * keyed by recording_id.
 *
 * Idempotent + enqueueable: callable repeatedly by the reconciler. Guards on
 * ata_status: skips when already 'completed'; reprocesses 'processing' stuck
 * for >15min (prior runtime died inside waitUntil).
 *
 * Auth: validates JWT (must be authenticated). DB access via service role;
 * recordings are owner-scoped at the RLS layer, and this fn only acts on a
 * single recording_id supplied by an authenticated caller or the cron (which
 * uses the anon key + service-role DB client). Mutations are owner-agnostic by
 * design (system documentation), matching the transcribe-meeting contract.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { extractBearer, isServiceRoleCaller } from "../_shared/internalAuth.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4-5";
const OPENROUTER_REFERER = "https://sistemamilennials.com.br";

const STUCK_PROCESSING_MS = 15 * 60 * 1000;

const SYSTEM_PROMPT = `Você é um secretário executivo que documenta reuniões. Recebe a TRANSCRIÇÃO de uma reunião gravada e produz uma ata estruturada.

REGRAS ABSOLUTAS:
- Extraia informação SOMENTE do que está explícito na transcrição. NUNCA infira, suponha ou invente. Se algo não foi dito, não está na ata.
- Se a transcrição for vazia, ruidosa ou sem conteúdo decisório, retorne arrays vazios — não preencha por preencher.
- Responda EXCLUSIVAMENTE com JSON válido. Nenhum texto fora do JSON.
- Use o idioma da transcrição (português).

Schema JSON obrigatório:
{
  "resumo_executivo": "string — 2-4 frases do que a reunião tratou e concluiu",
  "decisoes": ["string — cada decisão concreta tomada"],
  "proximos_passos": [
    {"acao": "string — ação concreta", "responsavel": "string ou null — só se nomeado na transcrição"}
  ],
  "topicos": [
    {"titulo": "string", "inicio_seg": 0, "pontos": ["string — ponto discutido"]}
  ]
}`;

interface AtaStructure {
  resumo_executivo: string;
  decisoes: string[];
  proximos_passos: { acao: string; responsavel: string | null }[];
  topicos: { titulo: string; inicio_seg: number; pontos: string[] }[];
  modelo: string;
  gerado_em: string;
}

function jsonError(message: string, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function extractJSON(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try { JSON.parse(trimmed); return trimmed; } catch { /* fall through */ }
  }
  const codeBlock = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlock) {
    try { JSON.parse(codeBlock[1].trim()); return codeBlock[1].trim(); } catch { /* fall through */ }
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const cand = trimmed.slice(first, last + 1);
    try { JSON.parse(cand); return cand; } catch { /* fall through */ }
  }
  return null;
}

function renderAtaMarkdown(ata: AtaStructure, title: string | null): string {
  const lines: string[] = [];
  if (title) lines.push(`# ${title}`, "");
  lines.push("## Resumo executivo", "", ata.resumo_executivo || "_Sem resumo._", "");

  lines.push("## Decisões", "");
  if (ata.decisoes.length) ata.decisoes.forEach((d) => lines.push(`- ${d}`));
  else lines.push("_Nenhuma decisão registrada._");
  lines.push("");

  lines.push("## Próximos passos", "");
  if (ata.proximos_passos.length) {
    ata.proximos_passos.forEach((p) =>
      lines.push(`- ${p.acao}${p.responsavel ? ` — **${p.responsavel}**` : ""}`),
    );
  } else lines.push("_Nenhum próximo passo registrado._");
  lines.push("");

  if (ata.topicos.length) {
    lines.push("## Tópicos", "");
    ata.topicos.forEach((t) => {
      lines.push(`### ${t.titulo}`, "");
      t.pontos.forEach((pt) => lines.push(`- ${pt}`));
      lines.push("");
    });
  }
  return lines.join("\n").trim();
}

function transcriptText(transcript: unknown): string {
  if (!transcript || typeof transcript !== "object") return "";
  const t = transcript as Record<string, unknown>;
  return typeof t.text === "string" ? t.text : "";
}

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

  if (!OPENROUTER_API_KEY) return jsonError("OPENROUTER_API_KEY not configured", 500, cors);

  // --- Auth: valid user JWT, OR the service role key (trusted internal caller
  //     = reconcile-recordings cron). ---
  const authHeader = req.headers.get("Authorization");
  const token = extractBearer(authHeader);
  if (!token) return jsonError("Missing Authorization header", 401, cors);

  const isInternalCall = isServiceRoleCaller(
    token,
    SUPABASE_SERVICE_ROLE_KEY,
    Deno.env.get("SUPABASE_SERVICE_ROLE_JWT_LEGACY"),
  );
  let userId: string | null = null;
  if (!isInternalCall) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonError("Invalid or expired token", 401, cors);
    userId = user.id;
  }

  // --- Parse body ---
  let recording_id: string;
  try {
    const body = await req.json();
    recording_id = body.recording_id;
    if (!recording_id || typeof recording_id !== "string") throw new Error("missing recording_id");
  } catch {
    return jsonError("Body must contain { recording_id: string }", 400, cors);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: rec, error: fetchErr } = await adminClient
    .from("recorded_meetings")
    .select("id, title, client_id, created_by, created_by_name, meeting_date, transcript, transcript_status, ata_status, updated_at")
    .eq("id", recording_id)
    .single();

  if (fetchErr || !rec) return jsonError("Recording not found", 404, cors);

  if (rec.transcript_status !== "completed" || !transcriptText(rec.transcript)) {
    return jsonError("Recording has no completed transcript", 400, cors);
  }

  // Idempotency guards.
  if (rec.ata_status === "completed") {
    return new Response(JSON.stringify({ status: "already_completed", recording_id }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (rec.ata_status === "processing") {
    const updatedAt = rec.updated_at ? new Date(rec.updated_at).getTime() : 0;
    if (Date.now() - updatedAt < STUCK_PROCESSING_MS) {
      return new Response(JSON.stringify({ status: "already_processing", recording_id }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  await adminClient
    .from("recorded_meetings")
    .update({ ata_status: "processing", ata_error: null, updated_at: new Date().toISOString() })
    .eq("id", recording_id);

  const runAta = async () => {
    try {
      const text = transcriptText(rec.transcript);

      const llmRes = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": OPENROUTER_REFERER,
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `TRANSCRIÇÃO:\n\n${text}` },
          ],
          max_tokens: 3000,
          temperature: 0.2,
        }),
      });

      if (!llmRes.ok) {
        const body = (await llmRes.text()).slice(0, 300);
        throw new Error(`OpenRouter error ${llmRes.status}: ${body}`);
      }

      const data = await llmRes.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenRouter returned empty content");

      const extracted = extractJSON(content);
      if (!extracted) throw new Error("LLM did not return valid JSON");
      const parsed = JSON.parse(extracted) as Partial<AtaStructure>;

      const ata: AtaStructure = {
        resumo_executivo: typeof parsed.resumo_executivo === "string" ? parsed.resumo_executivo : "",
        decisoes: Array.isArray(parsed.decisoes) ? parsed.decisoes : [],
        proximos_passos: Array.isArray(parsed.proximos_passos) ? parsed.proximos_passos : [],
        topicos: Array.isArray(parsed.topicos) ? parsed.topicos : [],
        modelo: "claude-sonnet-4-5",
        gerado_em: new Date().toISOString(),
      };

      const ataMarkdown = renderAtaMarkdown(ata, rec.title);

      await adminClient
        .from("recorded_meetings")
        .update({
          ata_json: ata,
          ata: ataMarkdown,
          summary: ata.resumo_executivo,
          ata_status: "completed",
          ata_error: null,
          ata_generated_at: ata.gerado_em,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recording_id);

      // Idempotent write into client_meeting_notes keyed by recording_id.
      // The unique index on recording_id is PARTIAL (WHERE recording_id IS NOT
      // NULL) so PostgREST .upsert(onConflict) can't use it — we do an explicit
      // select-then-update/insert. created_by is NOT NULL; skip the note (not
      // the ata) if we have no author.
      const noteAuthor = rec.created_by ?? userId;
      if (rec.client_id && noteAuthor) {
        const { data: existingNote } = await adminClient
          .from("client_meeting_notes")
          .select("id")
          .eq("recording_id", recording_id)
          .maybeSingle();

        const notePayload = {
          recording_id,
          client_id: rec.client_id,
          title: rec.title || "Reunião gravada",
          content: ataMarkdown,
          meeting_date: rec.meeting_date,
          created_by: noteAuthor,
        };

        const { error: noteErr } = existingNote
          ? await adminClient.from("client_meeting_notes").update(notePayload).eq("id", existingNote.id)
          : await adminClient.from("client_meeting_notes").insert(notePayload);

        if (noteErr) console.error(`client_meeting_notes write failed for ${recording_id}:`, noteErr.message);
      }

      console.log(`Ata generated for recording ${recording_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Ata generation failed for ${recording_id}:`, message);
      await adminClient
        .from("recorded_meetings")
        .update({ ata_status: "failed", ata_error: message, updated_at: new Date().toISOString() })
        .eq("id", recording_id);
    }
  };

  const edgeRuntime = (globalThis as Record<string, unknown>).EdgeRuntime as {
    waitUntil?: (p: Promise<unknown>) => void;
  } | undefined;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(runAta());
  } else {
    await runAta();
  }

  return new Response(JSON.stringify({ status: "processing", recording_id }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
