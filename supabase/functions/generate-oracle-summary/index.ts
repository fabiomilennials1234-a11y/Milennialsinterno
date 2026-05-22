import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================
// Edge Function: generate-oracle-summary
//
// Gera resumos diários via OpenRouter (GPT-4o-mini) para:
//   - type='group'      → visão consolidada de um organization_group
//   - type='individual'  → visão pessoal de um user
//
// Chamada pelo pg_cron diário via pg_net (09:00 UTC / 06:00 BRT).
// Também pode ser chamada manualmente para re-gerar.
// ============================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_REFERER = "https://sistemamilennials.com.br";

interface OracleRequest {
  type: "group" | "individual";
  group_id?: string;
  user_id?: string;
}

// ---------- Types ----------

interface Member {
  user_id: string;
  name: string;
  role: string;
}

interface GroupData {
  groupName: string;
  members: Member[];
  // Tasks
  overdueTaskCount: number;
  criticalOverdueTasks: { title: string; userName: string; department: string; daysOverdue: number }[];
  completedYesterdayCount: number;
  topCompleters: { name: string; count: number }[];
  // CRM
  crmDocumentedCount: number;
  crmUndocumentedClients: { clientName: string; gestorName: string }[];
  crmDelayedCount: number;
  crmContactedCount: number;
  // Ads
  adsDocumentedCount: number;
  adsUndocumentedClients: { clientName: string; managerName: string }[];
  adsDelayedCount: number;
  // MKTPlace
  mktplaceDocumentedCount: number;
  mktplaceUndocumentedClients: { clientName: string; consultorName: string }[];
  mktplaceDelayedCount: number;
  // Comercial
  comercialDocumentedCount: number;
  // Clients
  totalClients: number;
  clientsByLabel: Record<string, number>;
  clientsByStatus: Record<string, number>;
  activeTags: { clientName: string; tagName: string }[];
  clientsInDistrato: { name: string; step: string }[];
}

interface IndividualData {
  userName: string;
  userRole: string;
  overdueTaskCount: number;
  criticalOverdueTasks: { title: string; department: string; daysOverdue: number }[];
  pendingTaskCount: number;
  topPendingTasks: { title: string; department: string; dueDate: string | null }[];
  completedYesterdayCount: number;
  completedYesterdayTitles: string[];
  assignedClientCount: number;
  undocumentedClients: { clientName: string }[];
  activeTags: { clientName: string; tagName: string }[];
}

// ---------- Helpers ----------

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item) || "sem_info";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// ---------- Data Collection: Group ----------

async function collectGroupData(
  supabase: ReturnType<typeof createClient>,
  groupId: string
): Promise<GroupData> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split("T")[0];
  const todayISO = now.toISOString().split("T")[0];

  // Step 1: Group name + members + roles (must run first — everything depends on memberIds)
  const [{ data: group }, { data: members }, { data: allRoles }] = await Promise.all([
    supabase.from("organization_groups").select("name").eq("id", groupId).single(),
    supabase.from("profiles").select("user_id, name").eq("group_id", groupId),
    supabase.from("user_roles").select("user_id, role"),
  ]);

  const memberList = members || [];
  const memberIds = memberList.map((m: { user_id: string }) => m.user_id);
  const groupName = group?.name || "Grupo desconhecido";

  if (memberIds.length === 0) {
    return emptyGroupData(groupName);
  }

  // Build lookup maps
  const roleMap = new Map<string, string>();
  (allRoles || []).forEach((r: { user_id: string; role: string }) => {
    if (memberIds.includes(r.user_id)) roleMap.set(r.user_id, r.role);
  });

  const nameMap = new Map<string, string>();
  memberList.forEach((m: { user_id: string; name: string }) => nameMap.set(m.user_id, m.name));

  const membersWithRoles: Member[] = memberList.map((m: { user_id: string; name: string }) => ({
    user_id: m.user_id,
    name: m.name,
    role: roleMap.get(m.user_id) || "sem_cargo",
  }));

  // Step 2: Fire ALL data queries in parallel
  const [
    { data: overdueTasks },
    { data: completedTasks },
    { data: crmDocs },
    { data: crmDelayed },
    { data: adsDocs },
    { data: adsDelayed },
    { data: mktplaceDocs },
    { data: mktplaceDelayed },
    { data: comercialDocs },
    { data: clients },
  ] = await Promise.all([
    // Overdue tasks
    supabase
      .from("department_tasks")
      .select("title, department, due_date, user_id")
      .in("user_id", memberIds)
      .neq("status", "done")
      .lt("due_date", now.toISOString())
      .or("archived.is.null,archived.eq.false"),

    // Completed yesterday
    supabase
      .from("department_tasks")
      .select("title, department, user_id")
      .in("user_id", memberIds)
      .eq("status", "done")
      .gte("updated_at", `${yesterdayISO}T00:00:00Z`)
      .lt("updated_at", `${todayISO}T00:00:00Z`),

    // CRM documentation yesterday
    supabase
      .from("crm_daily_documentation")
      .select("client_id, gestor_id, falou_com_cliente")
      .in("gestor_id", memberIds) // gestor_id is TEXT, memberIds as strings match
      .eq("documentation_date", yesterdayISO),

    // CRM tracking delays
    supabase
      .from("crm_daily_tracking")
      .select("client_id, gestor_id")
      .in("gestor_id", memberIds)
      .eq("is_delayed", true),

    // Ads documentation yesterday
    supabase
      .from("ads_daily_documentation")
      .select("client_id, ads_manager_id")
      .in("ads_manager_id", memberIds)
      .eq("documentation_date", yesterdayISO),

    // Ads tracking delays
    supabase
      .from("client_daily_tracking")
      .select("client_id, ads_manager_id")
      .in("ads_manager_id", memberIds)
      .eq("is_delayed", true),

    // MKTPlace documentation yesterday
    supabase
      .from("mktplace_daily_documentation")
      .select("client_id, consultor_id")
      .in("consultor_id", memberIds)
      .eq("documentation_date", yesterdayISO),

    // MKTPlace tracking delays
    supabase
      .from("mktplace_daily_tracking")
      .select("client_id, consultor_id")
      .in("consultor_id", memberIds)
      .eq("is_delayed", true),

    // Comercial documentation yesterday
    supabase
      .from("comercial_daily_documentation")
      .select("client_id, user_id")
      .in("user_id", memberIds)
      .eq("documentation_date", yesterdayISO),

    // Clients of the group
    supabase
      .from("clients")
      .select("id, name, status, growth_gp_step, cs_classification, client_label, distrato_step, niche, assigned_mktplace, assigned_ads_manager, assigned_crm, assigned_comercial")
      .eq("group_id", groupId)
      .or("archived.is.null,archived.eq.false"),
  ]);

  const clientList = clients || [];
  const clientIds = clientList.map((c: { id: string }) => c.id);

  // Step 3: Client tags (depends on clientIds)
  let clientTags: { client_id: string; name: string }[] = [];
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("client_tags")
      .select("client_id, name")
      .in("client_id", clientIds)
      .is("dismissed_at", null)
      .or("expired_at.is.null,expired_at.gt." + now.toISOString());
    clientTags = data || [];
  }

  // Build client name lookup
  const clientNames = new Map<string, string>();
  clientList.forEach((c: { id: string; name: string }) => clientNames.set(c.id, c.name));

  // ---------- Aggregate ----------

  // Tasks: overdue
  const overdueList = overdueTasks || [];
  const criticalOverdue = overdueList
    .map((t: { title: string; department: string; due_date: string; user_id: string }) => ({
      title: t.title,
      userName: nameMap.get(t.user_id) || "N/A",
      department: t.department,
      daysOverdue: daysBetween(t.due_date, now),
    }))
    .filter((t) => t.daysOverdue > 3)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 10);

  // Tasks: completed yesterday — count per user for highlights
  const completedList = completedTasks || [];
  const completionCounts = countBy(completedList, (t: { user_id: string }) => nameMap.get(t.user_id) || "N/A");
  const topCompleters = Object.entries(completionCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // CRM
  const crmDocSet = new Set((crmDocs || []).map((d: { client_id: string }) => d.client_id));
  const crmContactedCount = (crmDocs || []).filter((d: { falou_com_cliente: string }) => d.falou_com_cliente === "sim").length;
  const crmClients = clientList.filter((c: { assigned_crm: string | null }) => c.assigned_crm && memberIds.includes(c.assigned_crm));
  const crmUndocumented = crmClients
    .filter((c: { id: string }) => !crmDocSet.has(c.id))
    .map((c: { id: string; name: string; assigned_crm: string }) => ({
      clientName: c.name,
      gestorName: nameMap.get(c.assigned_crm) || "N/A",
    }));

  // Ads
  const adsDocSet = new Set((adsDocs || []).map((d: { client_id: string }) => d.client_id));
  const adsClients = clientList.filter((c: { assigned_ads_manager: string | null }) => c.assigned_ads_manager && memberIds.includes(c.assigned_ads_manager));
  const adsUndocumented = adsClients
    .filter((c: { id: string }) => !adsDocSet.has(c.id))
    .map((c: { id: string; name: string; assigned_ads_manager: string }) => ({
      clientName: c.name,
      managerName: nameMap.get(c.assigned_ads_manager) || "N/A",
    }));

  // MKTPlace
  const mktplaceDocSet = new Set((mktplaceDocs || []).map((d: { client_id: string }) => d.client_id));
  const mktplaceClients = clientList.filter((c: { assigned_mktplace: string | null }) => c.assigned_mktplace && memberIds.includes(c.assigned_mktplace));
  const mktplaceUndocumented = mktplaceClients
    .filter((c: { id: string }) => !mktplaceDocSet.has(c.id))
    .map((c: { id: string; name: string; assigned_mktplace: string }) => ({
      clientName: c.name,
      consultorName: nameMap.get(c.assigned_mktplace) || "N/A",
    }));

  // Comercial
  const comercialDocCount = (comercialDocs || []).length;

  // Client aggregates
  const clientsByLabel = countBy(clientList, (c: { client_label: string | null }) => c.client_label || "sem_label");
  const clientsByStatus = countBy(clientList, (c: { status: string | null }) => c.status || "ativo");
  const clientsInDistrato = clientList
    .filter((c: { distrato_step: string | null }) => c.distrato_step)
    .map((c: { name: string; distrato_step: string }) => ({ name: c.name, step: c.distrato_step }));

  // Tags
  const activeTags = clientTags.map((t) => ({
    clientName: clientNames.get(t.client_id) || "N/A",
    tagName: t.name,
  }));

  return {
    groupName,
    members: membersWithRoles,
    overdueTaskCount: overdueList.length,
    criticalOverdueTasks: criticalOverdue,
    completedYesterdayCount: completedList.length,
    topCompleters,
    crmDocumentedCount: crmDocSet.size,
    crmUndocumentedClients: crmUndocumented,
    crmDelayedCount: (crmDelayed || []).length,
    crmContactedCount,
    adsDocumentedCount: adsDocSet.size,
    adsUndocumentedClients: adsUndocumented,
    adsDelayedCount: (adsDelayed || []).length,
    mktplaceDocumentedCount: mktplaceDocSet.size,
    mktplaceUndocumentedClients: mktplaceUndocumented,
    mktplaceDelayedCount: (mktplaceDelayed || []).length,
    comercialDocumentedCount: comercialDocCount,
    totalClients: clientList.length,
    clientsByLabel,
    clientsByStatus,
    activeTags,
    clientsInDistrato,
  };
}

function emptyGroupData(groupName: string): GroupData {
  return {
    groupName,
    members: [],
    overdueTaskCount: 0,
    criticalOverdueTasks: [],
    completedYesterdayCount: 0,
    topCompleters: [],
    crmDocumentedCount: 0,
    crmUndocumentedClients: [],
    crmDelayedCount: 0,
    crmContactedCount: 0,
    adsDocumentedCount: 0,
    adsUndocumentedClients: [],
    adsDelayedCount: 0,
    mktplaceDocumentedCount: 0,
    mktplaceUndocumentedClients: [],
    mktplaceDelayedCount: 0,
    comercialDocumentedCount: 0,
    totalClients: 0,
    clientsByLabel: {},
    clientsByStatus: {},
    activeTags: [],
    clientsInDistrato: [],
  };
}

// ---------- Data Collection: Individual ----------

async function collectIndividualData(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<IndividualData> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split("T")[0];
  const todayISO = now.toISOString().split("T")[0];

  // Step 1: Profile + role + tasks + clients — all in parallel
  const [
    { data: profile },
    { data: roleData },
    { data: overdueTasks },
    { data: pendingTasks },
    { data: completedTasks },
    { data: assignedClients },
  ] = await Promise.all([
    supabase.from("profiles").select("name").eq("user_id", userId).single(),
    supabase.from("user_roles").select("role").eq("user_id", userId).single(),

    // Overdue
    supabase
      .from("department_tasks")
      .select("title, department, due_date")
      .eq("user_id", userId)
      .neq("status", "done")
      .lt("due_date", now.toISOString())
      .or("archived.is.null,archived.eq.false"),

    // Pending (not done, not overdue)
    supabase
      .from("department_tasks")
      .select("title, department, due_date")
      .eq("user_id", userId)
      .neq("status", "done")
      .or("archived.is.null,archived.eq.false")
      .or(`due_date.gte.${now.toISOString()},due_date.is.null`),

    // Completed yesterday
    supabase
      .from("department_tasks")
      .select("title, department")
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("updated_at", `${yesterdayISO}T00:00:00Z`)
      .lt("updated_at", `${todayISO}T00:00:00Z`),

    // Assigned clients (via any assignment column matching this user)
    supabase
      .from("clients")
      .select("id, name, status, growth_gp_step, assigned_mktplace, assigned_ads_manager, assigned_crm, assigned_comercial")
      .or(`assigned_mktplace.eq.${userId},assigned_ads_manager.eq.${userId},assigned_crm.eq.${userId},assigned_comercial.eq.${userId}`)
      .or("archived.is.null,archived.eq.false"),
  ]);

  const clientList = assignedClients || [];
  const clientIds = clientList.map((c: { id: string }) => c.id);

  // Step 2: Undocumented clients + tags (depends on clientIds)
  let undocClients: { clientName: string }[] = [];
  let tagList: { client_id: string; name: string }[] = [];

  if (clientIds.length > 0) {
    // Check documentation across all areas for this user
    const [{ data: crmDocs }, { data: adsDocs }, { data: mktDocs }, { data: tags }] = await Promise.all([
      supabase
        .from("crm_daily_documentation")
        .select("client_id")
        .in("client_id", clientIds)
        .eq("gestor_id", userId)
        .eq("documentation_date", yesterdayISO),
      supabase
        .from("ads_daily_documentation")
        .select("client_id")
        .in("client_id", clientIds)
        .eq("ads_manager_id", userId)
        .eq("documentation_date", yesterdayISO),
      supabase
        .from("mktplace_daily_documentation")
        .select("client_id")
        .in("client_id", clientIds)
        .eq("consultor_id", userId)
        .eq("documentation_date", yesterdayISO),
      supabase
        .from("client_tags")
        .select("client_id, name")
        .in("client_id", clientIds)
        .is("dismissed_at", null)
        .or("expired_at.is.null,expired_at.gt." + now.toISOString()),
    ]);

    const documentedIds = new Set([
      ...(crmDocs || []).map((d: { client_id: string }) => d.client_id),
      ...(adsDocs || []).map((d: { client_id: string }) => d.client_id),
      ...(mktDocs || []).map((d: { client_id: string }) => d.client_id),
    ]);

    undocClients = clientList
      .filter((c: { id: string }) => !documentedIds.has(c.id))
      .map((c: { id: string; name: string }) => ({ clientName: c.name }));

    tagList = tags || [];
  }

  // Aggregate
  const overdueList = overdueTasks || [];
  const criticalOverdue = overdueList
    .map((t: { title: string; department: string; due_date: string }) => ({
      title: t.title,
      department: t.department,
      daysOverdue: daysBetween(t.due_date, now),
    }))
    .filter((t) => t.daysOverdue > 3)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 10);

  const pendingList = pendingTasks || [];
  const topPending = pendingList
    .slice(0, 5)
    .map((t: { title: string; department: string; due_date: string | null }) => ({
      title: t.title,
      department: t.department,
      dueDate: t.due_date,
    }));

  const completedList = completedTasks || [];

  return {
    userName: profile?.name || "Usuário",
    userRole: roleData?.role || "sem_cargo",
    overdueTaskCount: overdueList.length,
    criticalOverdueTasks: criticalOverdue,
    pendingTaskCount: pendingList.length,
    topPendingTasks: topPending,
    completedYesterdayCount: completedList.length,
    completedYesterdayTitles: completedList.slice(0, 5).map((t: { title: string }) => t.title),
    assignedClientCount: clientList.length,
    undocumentedClients: undocClients,
    activeTags: tagList.map((t) => ({
      clientName: findClientName(clientList, t.client_id),
      tagName: t.name,
    })),
  };
}

function findClientName(clients: { id: string; name: string }[], clientId: string): string {
  return clients.find((c) => c.id === clientId)?.name || "N/A";
}

// ---------- Prompt Building ----------

function buildGroupPrompt(data: GroupData): string {
  const s: string[] = [];

  // Header
  s.push(`GRUPO "${data.groupName}" — ${data.members.length} membros, ${data.totalClients} clientes`);
  s.push(`Cargos: ${[...new Set(data.members.map((m) => m.role))].join(", ")}`);

  // Tasks summary
  s.push(`\nTAREFAS: ${data.completedYesterdayCount} concluídas ontem, ${data.overdueTaskCount} atrasadas`);
  if (data.criticalOverdueTasks.length > 0) {
    s.push("Atrasadas >3 dias:");
    data.criticalOverdueTasks.forEach((t) =>
      s.push(`  • "${t.title}" — ${t.userName} (${t.department}) — ${t.daysOverdue} dias`)
    );
  }

  // CRM
  s.push(`\nCRM: ${data.crmDocumentedCount} documentados, ${data.crmUndocumentedClients.length} sem doc, ${data.crmDelayedCount} tracking atrasado, ${data.crmContactedCount} contatados`);
  if (data.crmUndocumentedClients.length > 0) {
    s.push("  Sem doc: " + data.crmUndocumentedClients.slice(0, 5).map((c) => `${c.clientName} (${c.gestorName})`).join(", "));
  }

  // Ads
  s.push(`ADS: ${data.adsDocumentedCount} documentados, ${data.adsUndocumentedClients.length} sem doc, ${data.adsDelayedCount} tracking atrasado`);
  if (data.adsUndocumentedClients.length > 0) {
    s.push("  Sem doc: " + data.adsUndocumentedClients.slice(0, 5).map((c) => `${c.clientName} (${c.managerName})`).join(", "));
  }

  // MKTPlace
  s.push(`MKTPLACE: ${data.mktplaceDocumentedCount} documentados, ${data.mktplaceUndocumentedClients.length} sem doc, ${data.mktplaceDelayedCount} tracking atrasado`);
  if (data.mktplaceUndocumentedClients.length > 0) {
    s.push("  Sem doc: " + data.mktplaceUndocumentedClients.slice(0, 5).map((c) => `${c.clientName} (${c.consultorName})`).join(", "));
  }

  // Comercial
  s.push(`COMERCIAL: ${data.comercialDocumentedCount} documentações registradas ontem`);

  // Client overview
  const labelStr = Object.entries(data.clientsByLabel).map(([k, v]) => `${k}: ${v}`).join(", ");
  s.push(`\nCLIENTES — Labels: ${labelStr}`);

  if (data.clientsInDistrato.length > 0) {
    s.push(`Em distrato (${data.clientsInDistrato.length}): ${data.clientsInDistrato.map((c) => `${c.name} [${c.step}]`).join(", ")}`);
  }

  if (data.activeTags.length > 0) {
    s.push(`Tags ativas (${data.activeTags.length}):`);
    data.activeTags.slice(0, 10).forEach((t) => s.push(`  • ${t.clientName}: ${t.tagName}`));
  }

  // Highlights
  if (data.topCompleters.length > 0) {
    s.push(`\nDESTAQUES: ${data.topCompleters.map((c) => `${c.name} (${c.count} tarefas)`).join(", ")}`);
  }

  return s.join("\n");
}

function buildIndividualPrompt(data: IndividualData): string {
  const s: string[] = [];

  s.push(`PROFISSIONAL: ${data.userName} (${data.userRole})`);
  s.push(`Tarefas: ${data.completedYesterdayCount} concluídas ontem, ${data.overdueTaskCount} atrasadas, ${data.pendingTaskCount} pendentes`);

  if (data.criticalOverdueTasks.length > 0) {
    s.push("Atrasadas >3 dias:");
    data.criticalOverdueTasks.forEach((t) =>
      s.push(`  • "${t.title}" (${t.department}) — ${t.daysOverdue} dias`)
    );
  }

  if (data.topPendingTasks.length > 0) {
    s.push("Próximas pendentes:");
    data.topPendingTasks.forEach((t) =>
      s.push(`  • "${t.title}" (${t.department})${t.dueDate ? ` — prazo: ${t.dueDate}` : ""}`)
    );
  }

  if (data.completedYesterdayTitles.length > 0) {
    s.push(`Concluídas ontem: ${data.completedYesterdayTitles.join(", ")}`);
  }

  s.push(`\nClientes atribuídos: ${data.assignedClientCount}`);
  if (data.undocumentedClients.length > 0) {
    s.push(`Sem documentação ontem (${data.undocumentedClients.length}): ${data.undocumentedClients.slice(0, 5).map((c) => c.clientName).join(", ")}`);
  }

  if (data.activeTags.length > 0) {
    s.push(`Tags ativas: ${data.activeTags.slice(0, 5).map((t) => `${t.clientName}: ${t.tagName}`).join(", ")}`);
  }

  return s.join("\n");
}

// ---------- System Prompts ----------

const GROUP_SYSTEM_PROMPT = `Você é o Oráculo, um assistente de gestão de equipes. Analise os dados do grupo e gere um resumo executivo diário.

Responda SEMPRE em português brasileiro.
Seja direto, objetivo e acionável.
Não use markdown pesado — use texto limpo com títulos em MAIÚSCULAS e listas com "•".

Estrutura obrigatória (6 seções):

1. VISÃO GERAL
Números-chave: tarefas concluídas, atrasadas, clientes documentados vs não documentados.

2. ALERTAS CRÍTICOS
Tarefas muito atrasadas (>3 dias), clientes sem documentação, tracking parado, tags de bloqueio.

3. POR CARGO
Breakdown por área: CRM, Ads, MKTPlace, Comercial — com números de documentação, contato e atrasos.

4. OBSERVAÇÕES DE LEADS
Leads parados, volume de entrada vs processamento no CRM, preenchimento de info dos clientes.

5. DESTAQUES POSITIVOS
Quem se destacou, tarefas antes do prazo, clientes bem documentados.

6. RECOMENDAÇÕES
2-3 ações concretas e específicas pro gestor baseadas nos dados.

Se não houver dados em alguma seção, diga "Sem dados para esta seção."
Máximo 500 palavras.`;

const INDIVIDUAL_SYSTEM_PROMPT = `Você é o Oráculo, um assistente pessoal de produtividade. Analise os dados do profissional e gere um resumo diário personalizado.

Responda SEMPRE em português brasileiro.
Seja direto, motivador e acionável.
Não use markdown pesado — use texto limpo com títulos em MAIÚSCULAS e listas com "•".

Estrutura obrigatória:
1. RESUMO DO DIA — como foi o dia anterior em 1-2 frases
2. PENDÊNCIAS — tarefas atrasadas, clientes que precisam de atenção
3. PRIORIDADES PARA HOJE — 3-5 itens mais importantes baseados nos dados
4. MOTIVAÇÃO — 1 frase de incentivo contextualizada

Se não houver dados em alguma seção, diga "Sem dados para esta seção."
Máximo 300 palavras.`;

// ---------- OpenRouter Call ----------

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<{ content: string; tokensUsed: number }> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_REFERER,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
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
    console.error(`OpenRouter error ${response.status}:`, errorText);
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const tokensUsed = data.usage?.total_tokens || 0;

  if (!content) {
    throw new Error("OpenRouter returned empty content");
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
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openrouterKey) {
      throw new Error("OPENROUTER_API_KEY not configured. Run: supabase secrets set OPENROUTER_API_KEY=...");
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
    const systemPrompt = type === "group" ? GROUP_SYSTEM_PROMPT : INDIVIDUAL_SYSTEM_PROMPT;

    // Call OpenRouter
    const { content: summaryContent, tokensUsed } = await callOpenRouter(systemPrompt, dataPrompt, openrouterKey);

    // Upsert result
    const upsertPayload: Record<string, unknown> = {
      summary_type: type,
      reference_date: referenceDate,
      summary_content: summaryContent,
      raw_data: rawData,
      model_used: OPENROUTER_MODEL,
      tokens_used: tokensUsed,
    };

    if (type === "group") {
      upsertPayload.group_id = group_id;
    } else {
      upsertPayload.user_id = user_id;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("oracle_summaries")
        .update({
          summary_content: summaryContent,
          raw_data: rawData,
          tokens_used: tokensUsed,
          model_used: OPENROUTER_MODEL,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating oracle_summary:", updateError);
        throw new Error(`DB update error: ${updateError.message}`);
      }
    } else {
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
