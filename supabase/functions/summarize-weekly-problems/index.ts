import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challenges, delays, observations, totalProblems } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um especialista em gestão de projetos e análise de performance de equipes. 
Seu trabalho é analisar os problemas semanais de uma equipe de gestores de tráfego e fornecer um resumo executivo.

Responda SEMPRE em português brasileiro.
Seja direto e objetivo.
Use markdown para formatar.`;

    const userPrompt = `Analise os seguintes problemas registrados na semana:

**Total de problemas:** ${totalProblems}

**Desafios principais:**
${challenges.length > 0 ? challenges.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n') : 'Nenhum desafio registrado'}

**Atrasos identificados:**
${delays.length > 0 ? delays.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n') : 'Nenhum atraso registrado'}

**Observações gerais:**
${observations.length > 0 ? observations.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n') : 'Nenhuma observação registrada'}

Por favor, forneça:
1. **Resumo executivo** (2-3 frases sobre a situação geral)
2. **Principais pontos de atenção** (os 3 problemas mais críticos)
3. **Recomendações** (2-3 ações sugeridas para a próxima semana)

Mantenha a resposta concisa e acionável.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error: " + response.status);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content;

    if (!summary) {
      throw new Error("No summary generated");
    }

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
