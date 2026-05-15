import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { buildCorsHeaders } from "../_shared/cors.ts";

// ============================================================
// Edge Function: summarize-nps-team
//
// Generates an AI summary of all team NPS responses, separating:
//   - "NPS da Equipe" (metrics + sentiment)
//   - "Ideias de melhoria" (grouped ideas from Q5)
//
// Requires authenticated user with admin or sucesso_cliente role.
// Caches summary in nps_team_summaries — returns cached if fresh.
// ============================================================

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check role: admin or sucesso_cliente
    const { data: roleData } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const userRole = roleData?.role || "";
    const isAuthorized =
      userRole === "ceo" ||
      userRole === "cto" ||
      userRole === "sucesso_cliente";

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for cached summary (less than 6 hours old)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabaseAuth
      .from("nps_team_summaries")
      .select("id, summary_content, generated_at")
      .eq("summary_type", "all")
      .gte("generated_at", sixHoursAgo)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return new Response(
        JSON.stringify({ summary: cached.summary_content, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all team responses (no PII — exclude respondent_name)
    const { data: responses, error: fetchError } = await supabaseAuth
      .from("nps_team_responses")
      .select("experience_rating, efficiency_assessment, positive_highlight, improvement_area, ideas_suggestions, submitted_at")
      .order("submitted_at", { ascending: false });

    if (fetchError) {
      throw new Error(`Error fetching responses: ${fetchError.message}`);
    }

    if (!responses || responses.length === 0) {
      return new Response(
        JSON.stringify({ summary: "Nenhuma resposta de equipe disponível para análise.", cached: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build data prompt
    const totalResponses = responses.length;
    const avgExperience = (responses.reduce((s, r) => s + r.experience_rating, 0) / totalResponses).toFixed(1);
    const effSim = responses.filter(r => r.efficiency_assessment === "sim").length;
    const effParcial = responses.filter(r => r.efficiency_assessment === "parcialmente").length;
    const effNao = responses.filter(r => r.efficiency_assessment === "nao").length;

    const positives = responses
      .map(r => r.positive_highlight)
      .filter(Boolean)
      .map((p, i) => `  ${i + 1}. ${p}`)
      .join("\n");

    const improvements = responses
      .map(r => r.improvement_area)
      .filter(Boolean)
      .map((p, i) => `  ${i + 1}. ${p}`)
      .join("\n");

    const ideas = responses
      .map(r => r.ideas_suggestions)
      .filter(Boolean)
      .map((p, i) => `  ${i + 1}. ${p}`)
      .join("\n");

    const dataPrompt = `DADOS DO NPS DA EQUIPE — ${totalResponses} respostas

MÉTRICAS:
- Média de experiência: ${avgExperience}/5
- Eficiência: ${effSim} responderam "Sim", ${effParcial} "Parcialmente", ${effNao} "Não"

PONTOS POSITIVOS MENCIONADOS:
${positives || "  Nenhum informado."}

ÁREAS DE MELHORIA:
${improvements || "  Nenhuma informada."}

IDEIAS E SUGESTÕES (Baú de Ideias):
${ideas || "  Nenhuma informada."}`;

    const systemPrompt = `Você é um analista de People & Culture da Milennials. Analise os dados do NPS da equipe e gere um resumo inteligente.

Responda SEMPRE em português brasileiro.
Seja direto, objetivo e acionável.
Use seções com títulos claros.
Não use markdown pesado — use texto limpo com títulos em MAIÚSCULAS e listas com "•".

Estrutura obrigatória:

1. NPS DA EQUIPE
   - Resumo das métricas (média de experiência, eficiência)
   - Sentimento geral da equipe (positivo, neutro, negativo)
   - Padrões nos pontos positivos e áreas de melhoria

2. BAÚ DE IDEIAS
   - Agrupe as ideias e sugestões por tema
   - Destaque as mais frequentes ou com maior potencial
   - Priorize: o que é quick win vs. o que exige investimento

3. RECOMENDAÇÕES
   - 3-5 ações concretas baseadas nos dados

Seja conciso. Máximo 500 palavras. Não invente dados.`;

    // Call AI via Lovable gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: dataPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const summaryContent = aiData.choices?.[0]?.message?.content;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    if (!summaryContent) {
      throw new Error("AI returned empty content");
    }

    // Save summary
    const { error: insertError } = await supabaseAuth
      .from("nps_team_summaries")
      .insert({
        summary_content: summaryContent,
        summary_type: "all",
        model_used: "google/gemini-3-flash-preview",
        tokens_used: tokensUsed,
        generated_by: user.id,
      });

    if (insertError) {
      console.error("Error saving summary:", insertError);
      // Still return summary even if save fails
    }

    console.log(`[NPS Team Summary] Generated for ${totalResponses} responses — ${tokensUsed} tokens`);

    return new Response(
      JSON.stringify({ summary: summaryContent, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[NPS Team Summary] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
