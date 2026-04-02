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
    const {
      clientName,
      actionsLast30Days,
      achievements,
      trafficResults,
      keyMetrics,
      topCampaign,
      improvementPoints,
      next30Days,
      nextSteps,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um especialista em marketing digital B2B e comunicação executiva da Millennials Growth Marketing B2B.

Seu trabalho é transformar dados brutos de performance em um relatório de resultados PROFISSIONAL e APRESENTÁVEL para clientes.

REGRAS OBRIGATÓRIAS:
1. NUNCA copie o texto do usuário literalmente. Sempre reescreva profissionalmente.
2. Transforme frases simples em linguagem executiva e estratégica.
3. Destaque resultados positivos com entusiasmo profissional.
4. Aborde pontos negativos de forma construtiva e orientada a solução.
5. Crie narrativa coesa entre as seções.
6. Use dados quando disponíveis para reforçar argumentos.
7. Mantenha tom profissional, confiante e orientado a resultados.
8. Responda SEMPRE em português brasileiro.

FORMATO DE SAÍDA:
Responda em JSON válido com esta estrutura exata:
{
  "resumoExecutivo": "Parágrafo de 2-3 frases com visão geral do período e principais destaques",
  "acoesRealizadas": "Texto profissional descrevendo as ações executadas, com contexto estratégico",
  "conquistas": "Texto destacando as conquistas com interpretação de impacto",
  "resultadosTrafego": "Análise profissional dos resultados de tráfego com interpretação dos números",
  "metricas": "Apresentação executiva das métricas com contexto e significado",
  "campanhaDestaque": "Descrição estratégica da campanha top com análise de por que funcionou",
  "pontosDeelhoria": "Abordagem construtiva dos pontos a melhorar com direcionamento",
  "proximos30Dias": "Plano estruturado e profissional para o próximo período",
  "proximosPassos": "Ações claras e objetivas com senso de direção"
}

NUNCA retorne texto fora do JSON. NUNCA adicione markdown ao redor do JSON.`;

    const userPrompt = `Transforme os seguintes dados brutos do cliente "${clientName}" em um relatório executivo profissional:

AÇÕES DOS ÚLTIMOS 30 DIAS:
${actionsLast30Days || 'Não informado'}

CONQUISTAS:
${achievements || 'Não informado'}

RESULTADOS DE TRÁFEGO PAGO:
${trafficResults || 'Não informado'}

MÉTRICAS DE DESEMPENHO:
${keyMetrics || 'Não informado'}

CAMPANHA TOP 1:
${topCampaign || 'Não informado'}

PONTOS A MELHORAR:
${improvementPoints || 'Não informado'}

PRÓXIMOS 30 DIAS:
${next30Days || 'Não informado'}

PRÓXIMOS PASSOS:
${nextSteps || 'Não informado'}

Transforme tudo em narrativa executiva profissional. Retorne APENAS o JSON.`;

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
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error: " + response.status);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content generated");
    }

    // Parse the JSON response (handle potential markdown wrapping)
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("AI returned invalid JSON");
    }

    return new Response(JSON.stringify({ transformed: parsed }), {
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
