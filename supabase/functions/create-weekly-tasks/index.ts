import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Calcular segunda-feira da semana atual
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=dom, 1=seg
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));
    const mondayStr = monday.toISOString().split("T")[0];

    // Prazo: terça-feira (segunda + 1 dia)
    const dueDate = new Date(monday);
    dueDate.setUTCDate(dueDate.getUTCDate() + 1);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const weekTag = `auto_weekly:${mondayStr}`;

    // Buscar todos os gestores de ads ativos
    const { data: gestores, error: gestoresError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "gestor_ads");

    if (gestoresError) throw gestoresError;
    if (!gestores || gestores.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum gestor encontrado", created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TASKS = [
      "Enviar relatório para todos os clientes",
      "Enviar lema no grupo dos gestores",
    ];

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const gestor of gestores) {
      for (const title of TASKS) {
        try {
          // Verificar idempotência
          const { data: existing } = await supabase
            .from("ads_tasks")
            .select("id")
            .eq("ads_manager_id", gestor.user_id)
            .eq("title", title)
            .contains("tags", [weekTag])
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          // Criar tarefa
          const { error: insertError } = await supabase.from("ads_tasks").insert({
            ads_manager_id: gestor.user_id,
            title,
            description: `Tarefa automática semanal — criada em ${mondayStr}`,
            task_type: "daily",
            status: "todo",
            priority: "high",
            due_date: dueDateStr,
            tags: [weekTag, "auto_semanal"],
          });

          if (insertError) throw insertError;
          created++;
        } catch (err) {
          errors.push(`Gestor ${gestor.user_id} / "${title}": ${err}`);
        }
      }
    }

    const result = {
      message: "Tarefas semanais processadas",
      gestores: gestores.length,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      weekRef: mondayStr,
    };

    console.log("[WeeklyTasks]", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WeeklyTasks] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
