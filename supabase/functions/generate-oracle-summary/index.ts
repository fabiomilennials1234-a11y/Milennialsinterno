import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================
// Edge Function: generate-oracle-summary
//
// Gera resumos diários via OpenAI para:
//   - type='group'      → visão consolidada de um organization_group
//   - type='individual'  → visão pessoal de um user
//
// Chamada pelo pg_cron diário via pg_net.
// Também pode ser chamada manualmente para re-gerar.
// ============================================================

interface OracleRequest {
  type: "group" | "individual";
  group_id?: string;
  user_id?: string;
}

// ---------- Data Collection ----------

interface GroupData {
  groupName: string;
  members: { name: string; role: string }[];
  overdueTasks: { title: string; department: string; userName: string; dueDate: string }[];
  completedYesterday: { title: string; department: string; userName: string }[];
  clients: { name: string; status: string; onboardingStep: string | null; managerName: string | null }[];
  clientsWithActiveTags: { clientName: string; tagName: string }[];
  undocumentedClients: { clientName: string; consultorName: string }[];
  trackingDelays: { clientName: string; consultorName: string; currentDay: string }[];
}

interface IndividualData {
  userName: string;
  userRole: string;
  overdueTasks: { title: string; department: string; dueDate: string }[];
  pendingTasks: { title: string; department: string; dueDate: string | null }[];
  completedYesterday: { title: string; department: string }[];
  assignedClients: { name: string; status: string; onboardingStep: string | null }[];
  undocumentedClients: { clientName: string }[];
}

async function collectGroupData(
  supabase: ReturnType<typeof createClient>,
  groupId: string
): Promise<GroupData> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split("T")[0];

  // Group name
  const { data: group } = await supabase
    .from("organization_groups")
    .select("name")
    .eq("id", groupId)
    .single();

  // Members of this group
  const { data: members } = await supabase
    .from("profiles")
    .select("user_id, name")
    .eq("group_id", groupId);

  const memberIds = (members || []).map((m: { user_id: string }) => m.user_id);

  if (memberIds.length === 0) {
    return {
      groupName: group?.name || "Grupo desconhecido",
      members: [],
      overdueTasks: [],
      completedYesterday: [],
      clients: [],
      clientsWithActiveTags: [],
      undocumentedClients: [],
      trackingDelays: [],
    };
  }

  // Get roles for members
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", memberIds);

  const roleMap = new Map<string, string>();
  (roles || []).forEach((r: { user_id: string; role: string }) => roleMap.set(r.user_id, r.role));

  const memberList = (members || []).map((m: { user_id: string; name: string }) => ({
    name: m.name,
    role: roleMap.get(m.user_id) || "sem_cargo",
  }));

  const memberNameMap = new Map<string, string>();
  (members || []).forEach((m: { user_id: string; name: string }) => memberNameMap.set(m.user_id, m.name));

  // Overdue tasks for group members
  const { data: overdueTasks } = await supabase
    .from("department_tasks")
    .select("title, department, due_date, user_id")
    .in("user_id", memberIds)
    .neq("status", "done")
    .lt("due_date", new Date().toISOString())
    .or("archived.is.null,archived.eq.false");

  // Tasks completed yesterday
  const { data: completedTasks } = await supabase
    .from("department_tasks")
    .select("title, department, user_id, updated_at")
    .in("user_id", memberIds)
    .eq("status", "done")
    .gte("updated_at", `${yesterdayISO}T00:00:00Z`)
    .lt("updated_at", `${new Date().toISOString().split("T")[0]}T00:00:00Z`);

  // Clients assigned to group members (via assigned_mktplace which is text)
  const memberIdStrings = memberIds.map((id: string) => id);
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, status, growth_onboarding_step, assigned_mktplace")
    .in("assigned_mktplace", memberIdStrings)
    .or("archived.is.null,archived.eq.false");

  // Active client tags (warning signals)
  const clientIds = (clients || []).map((c: { id: string }) => c.id);
  let clientTags: { client_id: string; name: string }[] = [];
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("client_tags")
      .select("client_id, name")
      .in("client_id", clientIds)
      .is("dismissed_at", null)
      .is("expired_at", null);
    clientTags = data || [];
  }

  const clientNameMap = new Map<string, string>();
  (clients || []).forEach((c: { id: string; name: string }) => clientNameMap.set(c.id, c.name));

  // Undocumented clients (no documentation entry yesterday)
  let undocumentedClients: { clientName: string; consultorName: string }[] = [];
  if (clientIds.length > 0) {
    const { data: docs } = await supabase
      .from("mktplace_daily_documentation")
      .select("client_id")
      .in("client_id", clientIds)
      .eq("documentation_date", yesterdayISO);

    const documentedClientIds = new Set((docs || []).map((d: { client_id: string }) => d.client_id));
    undocumentedClients = (clients || [])
      .filter((c: { id: string }) => !documentedClientIds.has(c.id))
      .map((c: { id: string; name: string; assigned_mktplace: string | null }) => ({
        clientName: c.name,
        consultorName: memberNameMap.get(c.assigned_mktplace || "") || "N/A",
      }));
  }

  // Tracking delays
  const { data: delayedTracking } = await supabase
    .from("mktplace_daily_tracking")
    .select("client_id, consultor_id, current_day")
    .in("consultor_id", memberIdStrings)
    .eq("is_delayed", true);

  return {
    groupName: group?.name || "Grupo desconhecido",
    members: memberList,
    overdueTasks: (overdueTasks || []).map((t: { title: string; department: string; due_date: string; user_id: string }) => ({
      title: t.title,
      department: t.department,
      userName: memberNameMap.get(t.user_id) || "N/A",
      dueDate: t.due_date,
    })),
    completedYesterday: (completedTasks || []).map((t: { title: string; department: string; user_id: string }) => ({
      title: t.title,
      department: t.department,
      userName: memberNameMap.get(t.user_id) || "N/A",
    })),
    clients: (clients || []).map((c: { name: string; status: string; growth_onboarding_step: string | null; assigned_mktplace: string | null }) => ({
      name: c.name,
      status: c.status || "ativo",
      onboardingStep: c.growth_onboarding_step,
      managerName: memberNameMap.get(c.assigned_mktplace || "") || null,
    })),
    clientsWithActiveTags: clientTags.map((t) => ({
      clientName: clientNameMap.get(t.client_id) || "N/A",
      tagName: t.name,
    })),
    undocumentedClients,
    trackingDelays: (delayedTracking || []).map((t: { client_id: string; consultor_id: string; current_day: string }) => ({
      clientName: clientNameMap.get(t.client_id) || "N/A",
      consultorName: memberNameMap.get(t.consultor_id) || "N/A",
      currentDay: t.current_day,
    })),
  };
}

async function collectIndividualData(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<IndividualData> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split("T")[0];

  // User profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("user_id", userId)
    .single();

  // User role
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  // Overdue tasks
  const { data: overdueTasks } = await supabase
    .from("department_tasks")
    .select("title, department, due_date")
    .eq("user_id", userId)
    .neq("status", "done")
    .lt("due_date", new Date().toISOString())
    .or("archived.is.null,archived.eq.false");

  // Pending (not done, not overdue) tasks
  const { data: pendingTasks } = await supabase
    .from("department_tasks")
    .select("title, department, due_date")
    .eq("user_id", userId)
    .neq("status", "done")
    .or("archived.is.null,archived.eq.false")
    .or(`due_date.gte.${new Date().toISOString()},due_date.is.null`);

  // Tasks completed yesterday
  const { data: completedTasks } = await supabase
    .from("department_tasks")
    .select("title, department")
    .eq("user_id", userId)
    .eq("status", "done")
    .gte("updated_at", `${yesterdayISO}T00:00:00Z`)
    .lt("updated_at", `${new Date().toISOString().split("T")[0]}T00:00:00Z`);

  // Assigned clients
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, status, growth_onboarding_step")
    .eq("assigned_mktplace", userId)
    .or("archived.is.null,archived.eq.false");

  // Clients without documentation yesterday
  const clientIds = (clients || []).map((c: { id: string }) => c.id);
  let undocumentedClients: { clientName: string }[] = [];
  if (clientIds.length > 0) {
    const { data: docs } = await supabase
      .from("mktplace_daily_documentation")
      .select("client_id")
      .in("client_id", clientIds)
      .eq("documentation_date", yesterdayISO);

    const documentedClientIds = new Set((docs || []).map((d: { client_id: string }) => d.client_id));
    undocumentedClients = (clients || [])
      .filter((c: { id: string }) => !documentedClientIds.has(c.id))
      .map((c: { id: string; name: string }) => ({ clientName: c.name }));
  }

  return {
    userName: profile?.name || "Usuário",
    userRole: roleData?.role || "sem_cargo",
    overdueTasks: (overdueTasks || []).map((t: { title: string; department: string; due_date: string }) => ({
      title: t.title,
      department: t.department,
      dueDate: t.due_date,
    })),
    pendingTasks: (pendingTasks || []).map((t: { title: string; department: string; due_date: string | null }) => ({
      title: t.title,
      department: t.department,
      dueDate: t.due_date,
    })),
    completedYesterday: (completedTasks || []).map((t: { title: string; department: string }) => ({
      title: t.title,
      department: t.department,
    })),
    assignedClients: (clients || []).map((c: { name: string; status: string; growth_onboarding_step: string | null }) => ({
      name: c.name,
      status: c.status || "ativo",
      onboardingStep: c.growth_onboarding_step,
    })),
    undocumentedClients,
  };
}

// ---------- Prompt Building ----------

function buildGroupPrompt(data: GroupData): string {
  const sections: string[] = [];

  sections.push(`EQUIPE DO GRUPO "${data.groupName}" — ${data.members.length} membros:`);
  data.members.forEach((m) => sections.push(`  - ${m.name} (${m.role})`));

  if (data.overdueTasks.length > 0) {
    sections.push(`\nTAREFAS ATRASADAS (${data.overdueTasks.length}):`);
    data.overdueTasks.forEach((t) =>
      sections.push(`  - "${t.title}" — ${t.userName} (${t.department}) — vencida em ${t.dueDate}`)
    );
  } else {
    sections.push("\nSem tarefas atrasadas.");
  }

  if (data.completedYesterday.length > 0) {
    sections.push(`\nTAREFAS CONCLUÍDAS ONTEM (${data.completedYesterday.length}):`);
    data.completedYesterday.forEach((t) =>
      sections.push(`  - "${t.title}" — ${t.userName} (${t.department})`)
    );
  }

  sections.push(`\nCLIENTES (${data.clients.length}):`);
  data.clients.forEach((c) =>
    sections.push(`  - ${c.name} — status: ${c.status}, onboarding: ${c.onboardingStep || "N/A"}, gestor: ${c.managerName || "N/A"}`)
  );

  if (data.clientsWithActiveTags.length > 0) {
    sections.push(`\nALERTAS DE CLIENTES (tags ativas):`);
    data.clientsWithActiveTags.forEach((t) =>
      sections.push(`  - ${t.clientName}: ${t.tagName}`)
    );
  }

  if (data.undocumentedClients.length > 0) {
    sections.push(`\nCLIENTES SEM DOCUMENTAÇÃO ONTEM (${data.undocumentedClients.length}):`);
    data.undocumentedClients.forEach((c) =>
      sections.push(`  - ${c.clientName} (consultor: ${c.consultorName})`)
    );
  }

  if (data.trackingDelays.length > 0) {
    sections.push(`\nATRASOS DE TRACKING (${data.trackingDelays.length}):`);
    data.trackingDelays.forEach((t) =>
      sections.push(`  - ${t.clientName} (${t.consultorName}) — dia ${t.currentDay}`)
    );
  }

  return sections.join("\n");
}

function buildIndividualPrompt(data: IndividualData): string {
  const sections: string[] = [];

  sections.push(`PROFISSIONAL: ${data.userName} (${data.userRole})`);

  if (data.overdueTasks.length > 0) {
    sections.push(`\nTAREFAS ATRASADAS (${data.overdueTasks.length}):`);
    data.overdueTasks.forEach((t) =>
      sections.push(`  - "${t.title}" (${t.department}) — vencida em ${t.dueDate}`)
    );
  } else {
    sections.push("\nSem tarefas atrasadas.");
  }

  if (data.pendingTasks.length > 0) {
    sections.push(`\nTAREFAS PENDENTES (${data.pendingTasks.length}):`);
    data.pendingTasks.slice(0, 10).forEach((t) =>
      sections.push(`  - "${t.title}" (${t.department})${t.dueDate ? ` — prazo: ${t.dueDate}` : ""}`)
    );
    if (data.pendingTasks.length > 10) {
      sections.push(`  ... e mais ${data.pendingTasks.length - 10} tarefas`);
    }
  }

  if (data.completedYesterday.length > 0) {
    sections.push(`\nCONCLUÍDAS ONTEM (${data.completedYesterday.length}):`);
    data.completedYesterday.forEach((t) =>
      sections.push(`  - "${t.title}" (${t.department})`)
    );
  }

  if (data.assignedClients.length > 0) {
    sections.push(`\nCLIENTES ATRIBUÍDOS (${data.assignedClients.length}):`);
    data.assignedClients.forEach((c) =>
      sections.push(`  - ${c.name} — status: ${c.status}, onboarding: ${c.onboardingStep || "N/A"}`)
    );
  }

  if (data.undocumentedClients.length > 0) {
    sections.push(`\nCLIENTES SEM DOCUMENTAÇÃO ONTEM (${data.undocumentedClients.length}):`);
    data.undocumentedClients.forEach((c) =>
      sections.push(`  - ${c.clientName}`)
    );
  }

  return sections.join("\n");
}

// ---------- OpenAI Call ----------

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<{ content: string; tokensUsed: number }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`OpenAI error ${response.status}:`, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const tokensUsed = data.usage?.total_tokens || 0;

  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  return { content, tokensUsed };
}

// ---------- Main Handler ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY not configured. Run: supabase secrets set OPENAI_API_KEY=sk-...");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: OracleRequest = await req.json();
    const { type, group_id, user_id } = body;

    // Validate payload
    if (type === "group" && !group_id) {
      return new Response(
        JSON.stringify({ error: "group_id required for type='group'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (type === "individual" && !user_id) {
      return new Response(
        JSON.stringify({ error: "user_id required for type='individual'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!["group", "individual"].includes(type)) {
      return new Response(
        JSON.stringify({ error: "type must be 'group' or 'individual'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reference date = yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const referenceDate = yesterday.toISOString().split("T")[0];

    // Check idempotency — skip if already generated today
    const { data: existing } = await supabase
      .from("oracle_summaries")
      .select("id, summary_content")
      .eq("summary_type", type)
      .eq("reference_date", referenceDate)
      .eq(type === "group" ? "group_id" : "user_id", type === "group" ? group_id! : user_id!)
      .maybeSingle();

    if (existing && existing.summary_content) {
      return new Response(
        JSON.stringify({ summary: existing.summary_content, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect data
    let rawData: GroupData | IndividualData;
    let dataPrompt: string;

    if (type === "group") {
      rawData = await collectGroupData(supabase, group_id!);
      dataPrompt = buildGroupPrompt(rawData as GroupData);
    } else {
      rawData = await collectIndividualData(supabase, user_id!);
      dataPrompt = buildIndividualPrompt(rawData as IndividualData);
    }

    // System prompt
    const systemPrompt =
      type === "group"
        ? `Você é o Oráculo, um assistente de gestão de equipes. Analise os dados do grupo e gere um resumo executivo diário.

Responda SEMPRE em português brasileiro.
Seja direto, objetivo e acionável.
Use seções com títulos claros.
Não use markdown pesado — use texto limpo com títulos em MAIÚSCULAS e listas com "•".

Estrutura obrigatória:
1. VISÃO GERAL — 2-3 frases sobre o estado do grupo
2. ALERTAS CRÍTICOS — tarefas atrasadas, clientes sem documentação, tracking em atraso
3. DESTAQUES POSITIVOS — o que foi bem (tarefas concluídas, avanços)
4. RECOMENDAÇÕES — 2-3 ações concretas para hoje

Se não houver dados em alguma seção, diga "Sem dados para esta seção."
Seja conciso. Máximo 400 palavras.`
        : `Você é o Oráculo, um assistente pessoal de produtividade. Analise os dados do profissional e gere um resumo diário personalizado.

Responda SEMPRE em português brasileiro.
Seja direto, motivador e acionável.
Use seções com títulos claros.
Não use markdown pesado — use texto limpo com títulos em MAIÚSCULAS e listas com "•".

Estrutura obrigatória:
1. RESUMO DO DIA — como foi o dia anterior em 1-2 frases
2. PENDÊNCIAS — tarefas atrasadas, clientes que precisam de atenção
3. PRIORIDADES PARA HOJE — 3-5 itens mais importantes baseados nos dados
4. MOTIVAÇÃO — 1 frase de incentivo contextualizada

Se não houver dados em alguma seção, diga "Sem dados para esta seção."
Seja conciso. Máximo 300 palavras.`;

    // Call OpenAI
    const { content: summaryContent, tokensUsed } = await callOpenAI(systemPrompt, dataPrompt, openaiKey);

    // Upsert result
    const upsertPayload: Record<string, unknown> = {
      summary_type: type,
      reference_date: referenceDate,
      summary_content: summaryContent,
      raw_data: rawData,
      model_used: "gpt-4o-mini",
      tokens_used: tokensUsed,
    };

    if (type === "group") {
      upsertPayload.group_id = group_id;
    } else {
      upsertPayload.user_id = user_id;
    }

    if (existing) {
      // Update existing row
      const { error: updateError } = await supabase
        .from("oracle_summaries")
        .update({
          summary_content: summaryContent,
          raw_data: rawData,
          tokens_used: tokensUsed,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating oracle_summary:", updateError);
        throw new Error(`DB update error: ${updateError.message}`);
      }
    } else {
      // Insert new row
      const { error: insertError } = await supabase
        .from("oracle_summaries")
        .insert(upsertPayload);

      if (insertError) {
        console.error("Error inserting oracle_summary:", insertError);
        throw new Error(`DB insert error: ${insertError.message}`);
      }
    }

    console.log(`[Oracle] Generated ${type} summary for ${type === "group" ? group_id : user_id} — ${tokensUsed} tokens`);

    return new Response(
      JSON.stringify({ summary: summaryContent, tokens_used: tokensUsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Oracle] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
