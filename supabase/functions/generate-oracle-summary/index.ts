import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================
// Edge Function: generate-oracle-summary
//
// Gera resumos diários via OpenRouter (Claude Sonnet) para:
//   - type='group'      → visão consolidada de um organization_group
//   - type='individual'  → visão pessoal de um user
//
// Chamada pelo pg_cron diário via pg_net (09:00 UTC / 06:00 BRT).
// Também pode ser chamada manualmente para re-gerar.
// ============================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4-5";
const OPENROUTER_REFERER = "https://sistemamilennials.com.br";

interface OracleRequest {
  type: "group" | "individual";
  group_id?: string;
  user_id?: string;
  force?: boolean;
}

// ---------- Date Utilities (copied from src/lib/oracle-utils.ts) ----------

type DateInput = Date | string;

function toUTCMidnight(d: DateInput): Date {
  if (typeof d === "string") {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function addUTCDays(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

function formatUTCDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function businessDaysBetween(start: DateInput, end: DateInput): number {
  const s = toUTCMidnight(start);
  const e = toUTCMidnight(end);
  let count = 0;
  let cursor = addUTCDays(s, 1);
  while (cursor <= e) {
    if (isWeekday(cursor)) count++;
    cursor = addUTCDays(cursor, 1);
  }
  return count;
}

function getBusinessDayRange(n: number, fromDate: DateInput): string[] {
  if (n <= 0) return [];
  const dates: string[] = [];
  let cursor = addUTCDays(toUTCMidnight(fromDate), -1);
  while (dates.length < n) {
    if (isWeekday(cursor)) {
      dates.push(formatUTCDate(cursor));
    }
    cursor = addUTCDays(cursor, -1);
  }
  return dates;
}

// ---------- Types ----------

interface Member {
  user_id: string;
  name: string;
  role: string;
}

interface OverdueTask {
  title: string;
  userName: string;
  department: string;
  daysOverdue: number;
  clientName: string | null;
}

interface CompletedTask {
  title: string;
  userName: string;
  clientName: string | null;
}

interface DelayedTrackingDetail {
  clientName: string;
  responsibleName: string;
}

interface MemberSummary {
  name: string;
  role: string;
  overdueTasks: { title: string; clientName: string | null; daysOverdue: number }[];
  completedYesterday: { title: string; clientName: string | null }[];
  undocumentedClients: string[];
  delayedTracking: { area: string; clientName: string }[];
}

interface HistoricalDayData {
  date: string;
  tarefas_concluidas: number;
  tarefas_atrasadas: number;
  documentacao_feita: number;
  tracking_atrasado: number;
}

interface GroupData {
  groupName: string;
  members: Member[];
  // Tasks
  overdueTaskCount: number;
  criticalOverdueTasks: OverdueTask[];
  completedYesterdayCount: number;
  completedYesterdayDetails: CompletedTask[];
  topCompleters: { name: string; count: number }[];
  // CRM
  crmDocumentedCount: number;
  crmUndocumentedClients: { clientName: string; gestorName: string }[];
  crmDelayedCount: number;
  crmDelayedDetails: DelayedTrackingDetail[];
  crmContactedCount: number;
  // Ads
  adsDocumentedCount: number;
  adsUndocumentedClients: { clientName: string; managerName: string }[];
  adsDelayedCount: number;
  adsDelayedDetails: DelayedTrackingDetail[];
  // MKTPlace
  mktplaceDocumentedCount: number;
  mktplaceUndocumentedClients: { clientName: string; consultorName: string }[];
  mktplaceDelayedCount: number;
  mktplaceDelayedDetails: DelayedTrackingDetail[];
  // Comercial
  comercialDocumentedCount: number;
  // Clients
  totalClients: number;
  clientsByLabel: Record<string, number>;
  clientsByStatus: Record<string, number>;
  activeTags: { clientName: string; tagName: string }[];
  clientsInDistrato: { name: string; step: string }[];
  // Per-member aggregation
  memberSummaries: MemberSummary[];
  // Historical
  historical: HistoricalDayData[];
}

interface IndividualOverdueTask {
  title: string;
  department: string;
  daysOverdue: number;
  clientName: string | null;
}

interface IndividualData {
  userName: string;
  userRole: string;
  overdueTaskCount: number;
  criticalOverdueTasks: IndividualOverdueTask[];
  pendingTaskCount: number;
  topPendingTasks: { title: string; department: string; dueDate: string | null; clientName: string | null }[];
  completedYesterdayCount: number;
  completedYesterdayTitles: string[];
  completedYesterdayDetails: { title: string; clientName: string | null }[];
  assignedClientCount: number;
  undocumentedClients: { clientName: string }[];
  activeTags: { clientName: string; tagName: string }[];
  // Historical
  historical: HistoricalDayData[];
}

// ---------- Helpers ----------

function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item) || "sem_info";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// ---------- Historical Data Collection ----------

async function collectHistoricalData(
  supabase: ReturnType<typeof createClient>,
  type: "group" | "individual",
  id: string
): Promise<HistoricalDayData[]> {
  const now = new Date();
  const days = getBusinessDayRange(5, now); // most recent first
  if (days.length === 0) return [];

  const rangeStart = days[days.length - 1]; // oldest
  const rangeEnd = days[0]; // most recent
  const rangeEndNextDay = formatUTCDate(addUTCDays(toUTCMidnight(rangeEnd), 1));

  // Resolve person IDs
  let personIds: string[] = [];
  if (type === "group") {
    const { data: members } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("group_id", id);
    personIds = (members || []).map((m: { user_id: string }) => m.user_id);
    if (personIds.length === 0) return days.map((d) => ({ date: d, tarefas_concluidas: 0, tarefas_atrasadas: 0, documentacao_feita: 0, tracking_atrasado: 0 }));
  } else {
    personIds = [id];
  }

  // Parallel queries — single query per table with range filter
  const [
    { data: completedInRange },
    { data: overdueCandidate },
    { data: crmDocs },
    { data: adsDocs },
    { data: mktDocs },
    { data: comercialDocs },
    { data: crmTracking },
    { data: adsTracking },
    { data: mktTracking },
  ] = await Promise.all([
    // Tasks completed in range
    supabase
      .from("department_tasks")
      .select("updated_at")
      .in("user_id", personIds)
      .eq("status", "done")
      .gte("updated_at", `${rangeStart}T00:00:00Z`)
      .lt("updated_at", `${rangeEndNextDay}T00:00:00Z`),

    // Tasks that were/are overdue in the range (due_date < rangeEndNextDay, not done or done after due)
    supabase
      .from("department_tasks")
      .select("due_date, status, updated_at")
      .in("user_id", personIds)
      .lt("due_date", `${rangeEndNextDay}T00:00:00Z`)
      .or("archived.is.null,archived.eq.false"),

    // Documentation — CRM
    supabase
      .from("crm_daily_documentation")
      .select("documentation_date")
      .in("gestor_id", personIds)
      .gte("documentation_date", rangeStart)
      .lte("documentation_date", rangeEnd),

    // Documentation — Ads
    supabase
      .from("ads_daily_documentation")
      .select("documentation_date")
      .in("ads_manager_id", personIds)
      .gte("documentation_date", rangeStart)
      .lte("documentation_date", rangeEnd),

    // Documentation — MKTPlace
    supabase
      .from("mktplace_daily_documentation")
      .select("documentation_date")
      .in("consultor_id", personIds)
      .gte("documentation_date", rangeStart)
      .lte("documentation_date", rangeEnd),

    // Documentation — Comercial
    supabase
      .from("comercial_daily_documentation")
      .select("documentation_date")
      .in("user_id", personIds)
      .gte("documentation_date", rangeStart)
      .lte("documentation_date", rangeEnd),

    // Tracking delayed — CRM (current state, no historical snapshot)
    supabase
      .from("crm_daily_tracking")
      .select("id")
      .in("gestor_id", personIds)
      .eq("is_delayed", true),

    // Tracking delayed — Ads
    supabase
      .from("client_daily_tracking")
      .select("id")
      .in("ads_manager_id", personIds)
      .eq("is_delayed", true),

    // Tracking delayed — MKTPlace
    supabase
      .from("mktplace_daily_tracking")
      .select("id")
      .in("consultor_id", personIds)
      .eq("is_delayed", true),
  ]);

  // Current tracking delayed count (no historical snapshot exists — same value for all days)
  const currentTrackingDelayed =
    (crmTracking || []).length + (adsTracking || []).length + (mktTracking || []).length;

  // Build per-day data
  const result: HistoricalDayData[] = days.map((day) => {
    const dayStart = `${day}T00:00:00Z`;
    const dayEnd = `${formatUTCDate(addUTCDays(toUTCMidnight(day), 1))}T00:00:00Z`;

    // Completed tasks on this day
    const completed = (completedInRange || []).filter((t: { updated_at: string }) => {
      return t.updated_at >= dayStart && t.updated_at < dayEnd;
    }).length;

    // Overdue tasks on this day: due_date < dayEnd AND (status != 'done' OR updated_at >= dayEnd)
    // This heuristic counts tasks that were overdue on that day
    const overdue = (overdueCandidate || []).filter((t: { due_date: string; status: string; updated_at: string }) => {
      const dueBeforeDay = t.due_date < dayEnd;
      const wasStillOverdue = t.status !== "done" || t.updated_at >= dayEnd;
      return dueBeforeDay && wasStillOverdue;
    }).length;

    // Documentation on this day
    const docCount =
      (crmDocs || []).filter((d: { documentation_date: string }) => d.documentation_date === day).length +
      (adsDocs || []).filter((d: { documentation_date: string }) => d.documentation_date === day).length +
      (mktDocs || []).filter((d: { documentation_date: string }) => d.documentation_date === day).length +
      (comercialDocs || []).filter((d: { documentation_date: string }) => d.documentation_date === day).length;

    return {
      date: day,
      tarefas_concluidas: completed,
      tarefas_atrasadas: overdue,
      documentacao_feita: docCount,
      tracking_atrasado: currentTrackingDelayed, // current state — no historical snapshot
    };
  });

  return result;
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
    // Overdue tasks — now includes related_client_id
    supabase
      .from("department_tasks")
      .select("title, department, due_date, user_id, related_client_id")
      .in("user_id", memberIds)
      .neq("status", "done")
      .lt("due_date", now.toISOString())
      .or("archived.is.null,archived.eq.false"),

    // Completed yesterday — now includes related_client_id
    supabase
      .from("department_tasks")
      .select("title, department, user_id, related_client_id")
      .in("user_id", memberIds)
      .eq("status", "done")
      .gte("updated_at", `${yesterdayISO}T00:00:00Z`)
      .lt("updated_at", `${todayISO}T00:00:00Z`),

    // CRM documentation yesterday
    supabase
      .from("crm_daily_documentation")
      .select("client_id, gestor_id, falou_com_cliente")
      .in("gestor_id", memberIds)
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

  // Collect related_client_ids from tasks that are NOT in clientNames (tasks may reference clients outside this group)
  const taskClientIds = new Set<string>();
  (overdueTasks || []).forEach((t: { related_client_id: string | null }) => {
    if (t.related_client_id && !clientNames.has(t.related_client_id)) taskClientIds.add(t.related_client_id);
  });
  (completedTasks || []).forEach((t: { related_client_id: string | null }) => {
    if (t.related_client_id && !clientNames.has(t.related_client_id)) taskClientIds.add(t.related_client_id);
  });

  // Single extra query for missing client names (if any)
  if (taskClientIds.size > 0) {
    const { data: extraClients } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", Array.from(taskClientIds));
    (extraClients || []).forEach((c: { id: string; name: string }) => clientNames.set(c.id, c.name));
  }

  // ---------- Aggregate ----------

  // Tasks: ALL overdue with business days
  const overdueList = overdueTasks || [];
  const allOverdueTasks: OverdueTask[] = overdueList
    .map((t: { title: string; department: string; due_date: string; user_id: string; related_client_id: string | null }) => ({
      title: t.title,
      userName: nameMap.get(t.user_id) || "N/A",
      department: t.department,
      daysOverdue: businessDaysBetween(t.due_date, now),
      clientName: t.related_client_id ? (clientNames.get(t.related_client_id) || null) : null,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Tasks: completed yesterday — enriched details
  const completedList = completedTasks || [];
  const completedDetails: CompletedTask[] = completedList.map(
    (t: { title: string; user_id: string; related_client_id: string | null }) => ({
      title: t.title,
      userName: nameMap.get(t.user_id) || "N/A",
      clientName: t.related_client_id ? (clientNames.get(t.related_client_id) || null) : null,
    })
  );

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

  // CRM delayed — enriched
  const crmDelayedList = crmDelayed || [];
  const crmDelayedDetails: DelayedTrackingDetail[] = crmDelayedList.map(
    (d: { client_id: string; gestor_id: string }) => ({
      clientName: clientNames.get(d.client_id) || "N/A",
      responsibleName: nameMap.get(d.gestor_id) || "N/A",
    })
  );

  // Ads
  const adsDocSet = new Set((adsDocs || []).map((d: { client_id: string }) => d.client_id));
  const adsClients = clientList.filter((c: { assigned_ads_manager: string | null }) => c.assigned_ads_manager && memberIds.includes(c.assigned_ads_manager));
  const adsUndocumented = adsClients
    .filter((c: { id: string }) => !adsDocSet.has(c.id))
    .map((c: { id: string; name: string; assigned_ads_manager: string }) => ({
      clientName: c.name,
      managerName: nameMap.get(c.assigned_ads_manager) || "N/A",
    }));

  // Ads delayed — enriched
  const adsDelayedList = adsDelayed || [];
  const adsDelayedDetails: DelayedTrackingDetail[] = adsDelayedList.map(
    (d: { client_id: string; ads_manager_id: string }) => ({
      clientName: clientNames.get(d.client_id) || "N/A",
      responsibleName: nameMap.get(d.ads_manager_id) || "N/A",
    })
  );

  // MKTPlace
  const mktplaceDocSet = new Set((mktplaceDocs || []).map((d: { client_id: string }) => d.client_id));
  const mktplaceClients = clientList.filter((c: { assigned_mktplace: string | null }) => c.assigned_mktplace && memberIds.includes(c.assigned_mktplace));
  const mktplaceUndocumented = mktplaceClients
    .filter((c: { id: string }) => !mktplaceDocSet.has(c.id))
    .map((c: { id: string; name: string; assigned_mktplace: string }) => ({
      clientName: c.name,
      consultorName: nameMap.get(c.assigned_mktplace) || "N/A",
    }));

  // MKTPlace delayed — enriched
  const mktplaceDelayedList = mktplaceDelayed || [];
  const mktplaceDelayedDetails: DelayedTrackingDetail[] = mktplaceDelayedList.map(
    (d: { client_id: string; consultor_id: string }) => ({
      clientName: clientNames.get(d.client_id) || "N/A",
      responsibleName: nameMap.get(d.consultor_id) || "N/A",
    })
  );

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

  // ---------- Member Summaries (per-person aggregation) ----------

  // Build per-member undocumented sets
  const crmUndocByMember = new Map<string, string[]>();
  crmUndocumented.forEach((u) => {
    // Find the member who owns this client
    const member = crmClients.find((c: { id: string; name: string; assigned_crm: string }) => c.name === u.clientName);
    if (member) {
      const key = (member as { assigned_crm: string }).assigned_crm;
      if (!crmUndocByMember.has(key)) crmUndocByMember.set(key, []);
      crmUndocByMember.get(key)!.push(u.clientName);
    }
  });

  const adsUndocByMember = new Map<string, string[]>();
  adsUndocumented.forEach((u) => {
    const member = adsClients.find((c: { id: string; name: string; assigned_ads_manager: string }) => c.name === u.clientName);
    if (member) {
      const key = (member as { assigned_ads_manager: string }).assigned_ads_manager;
      if (!adsUndocByMember.has(key)) adsUndocByMember.set(key, []);
      adsUndocByMember.get(key)!.push(u.clientName);
    }
  });

  const mktUndocByMember = new Map<string, string[]>();
  mktplaceUndocumented.forEach((u) => {
    const member = mktplaceClients.find((c: { id: string; name: string; assigned_mktplace: string }) => c.name === u.clientName);
    if (member) {
      const key = (member as { assigned_mktplace: string }).assigned_mktplace;
      if (!mktUndocByMember.has(key)) mktUndocByMember.set(key, []);
      mktUndocByMember.get(key)!.push(u.clientName);
    }
  });

  const memberSummaries: MemberSummary[] = membersWithRoles.map((m) => {
    const userId = m.user_id;

    // Overdue tasks for this member
    const memberOverdue = allOverdueTasks
      .filter((t) => t.userName === m.name)
      .map((t) => ({ title: t.title, clientName: t.clientName, daysOverdue: t.daysOverdue }));

    // Completed tasks for this member
    const memberCompleted = completedDetails
      .filter((t) => t.userName === m.name)
      .map((t) => ({ title: t.title, clientName: t.clientName }));

    // Undocumented clients across all areas
    const undoc = [
      ...(crmUndocByMember.get(userId) || []),
      ...(adsUndocByMember.get(userId) || []),
      ...(mktUndocByMember.get(userId) || []),
    ];

    // Delayed tracking across all areas
    const delayed: { area: string; clientName: string }[] = [];
    crmDelayedList
      .filter((d: { gestor_id: string }) => d.gestor_id === userId)
      .forEach((d: { client_id: string }) => delayed.push({ area: "CRM", clientName: clientNames.get(d.client_id) || "N/A" }));
    adsDelayedList
      .filter((d: { ads_manager_id: string }) => d.ads_manager_id === userId)
      .forEach((d: { client_id: string }) => delayed.push({ area: "Ads", clientName: clientNames.get(d.client_id) || "N/A" }));
    mktplaceDelayedList
      .filter((d: { consultor_id: string }) => d.consultor_id === userId)
      .forEach((d: { client_id: string }) => delayed.push({ area: "MKTPlace", clientName: clientNames.get(d.client_id) || "N/A" }));

    return {
      name: m.name,
      role: m.role,
      overdueTasks: memberOverdue,
      completedYesterday: memberCompleted,
      undocumentedClients: [...new Set(undoc)],
      delayedTracking: delayed,
    };
  });

  // Historical data (runs in parallel with nothing — fires after main queries)
  const historical = await collectHistoricalData(supabase, "group", groupId);

  return {
    groupName,
    members: membersWithRoles,
    overdueTaskCount: overdueList.length,
    criticalOverdueTasks: allOverdueTasks,
    completedYesterdayCount: completedList.length,
    completedYesterdayDetails: completedDetails,
    topCompleters,
    crmDocumentedCount: crmDocSet.size,
    crmUndocumentedClients: crmUndocumented,
    crmDelayedCount: crmDelayedList.length,
    crmDelayedDetails,
    crmContactedCount,
    adsDocumentedCount: adsDocSet.size,
    adsUndocumentedClients: adsUndocumented,
    adsDelayedCount: adsDelayedList.length,
    adsDelayedDetails,
    mktplaceDocumentedCount: mktplaceDocSet.size,
    mktplaceUndocumentedClients: mktplaceUndocumented,
    mktplaceDelayedCount: mktplaceDelayedList.length,
    mktplaceDelayedDetails,
    comercialDocumentedCount: comercialDocCount,
    totalClients: clientList.length,
    clientsByLabel,
    clientsByStatus,
    activeTags,
    clientsInDistrato,
    memberSummaries,
    historical,
  };
}

function emptyGroupData(groupName: string): GroupData {
  return {
    groupName,
    members: [],
    overdueTaskCount: 0,
    criticalOverdueTasks: [],
    completedYesterdayCount: 0,
    completedYesterdayDetails: [],
    topCompleters: [],
    crmDocumentedCount: 0,
    crmUndocumentedClients: [],
    crmDelayedCount: 0,
    crmDelayedDetails: [],
    crmContactedCount: 0,
    adsDocumentedCount: 0,
    adsUndocumentedClients: [],
    adsDelayedCount: 0,
    adsDelayedDetails: [],
    mktplaceDocumentedCount: 0,
    mktplaceUndocumentedClients: [],
    mktplaceDelayedCount: 0,
    mktplaceDelayedDetails: [],
    comercialDocumentedCount: 0,
    totalClients: 0,
    clientsByLabel: {},
    clientsByStatus: {},
    activeTags: [],
    clientsInDistrato: [],
    memberSummaries: [],
    historical: [],
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

    // Overdue — includes related_client_id
    supabase
      .from("department_tasks")
      .select("title, department, due_date, related_client_id")
      .eq("user_id", userId)
      .neq("status", "done")
      .lt("due_date", now.toISOString())
      .or("archived.is.null,archived.eq.false"),

    // Pending (not done, not overdue) — includes related_client_id
    supabase
      .from("department_tasks")
      .select("title, department, due_date, related_client_id")
      .eq("user_id", userId)
      .neq("status", "done")
      .or("archived.is.null,archived.eq.false")
      .or(`due_date.gte.${now.toISOString()},due_date.is.null`),

    // Completed yesterday — includes related_client_id
    supabase
      .from("department_tasks")
      .select("title, department, related_client_id")
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

  // Build client name lookup from assigned clients
  const clientNames = new Map<string, string>();
  clientList.forEach((c: { id: string; name: string }) => clientNames.set(c.id, c.name));

  // Collect related_client_ids from tasks NOT in clientNames — single extra query
  const missingClientIds = new Set<string>();
  (overdueTasks || []).forEach((t: { related_client_id: string | null }) => {
    if (t.related_client_id && !clientNames.has(t.related_client_id)) missingClientIds.add(t.related_client_id);
  });
  (pendingTasks || []).forEach((t: { related_client_id: string | null }) => {
    if (t.related_client_id && !clientNames.has(t.related_client_id)) missingClientIds.add(t.related_client_id);
  });
  (completedTasks || []).forEach((t: { related_client_id: string | null }) => {
    if (t.related_client_id && !clientNames.has(t.related_client_id)) missingClientIds.add(t.related_client_id);
  });

  // Step 2: Undocumented clients + tags + missing client names — all in parallel
  let undocClients: { clientName: string }[] = [];
  let tagList: { client_id: string; name: string }[] = [];

  const step2Promises: Promise<void>[] = [];

  // Fetch missing client names (max 1 extra query)
  if (missingClientIds.size > 0) {
    step2Promises.push(
      supabase
        .from("clients")
        .select("id, name")
        .in("id", Array.from(missingClientIds))
        .then(({ data }: { data: { id: string; name: string }[] | null }) => {
          (data || []).forEach((c) => clientNames.set(c.id, c.name));
        })
    );
  }

  if (clientIds.length > 0) {
    step2Promises.push(
      Promise.all([
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
      ]).then(([{ data: crmDocs }, { data: adsDocs }, { data: mktDocs }, { data: tags }]) => {
        const documentedIds = new Set([
          ...(crmDocs || []).map((d: { client_id: string }) => d.client_id),
          ...(adsDocs || []).map((d: { client_id: string }) => d.client_id),
          ...(mktDocs || []).map((d: { client_id: string }) => d.client_id),
        ]);

        undocClients = clientList
          .filter((c: { id: string }) => !documentedIds.has(c.id))
          .map((c: { id: string; name: string }) => ({ clientName: c.name }));

        tagList = tags || [];
      })
    );
  }

  await Promise.all(step2Promises);

  // Aggregate — ALL overdue with business days and client names
  const overdueList = overdueTasks || [];
  const allOverdueTasks: IndividualOverdueTask[] = overdueList
    .map((t: { title: string; department: string; due_date: string; related_client_id: string | null }) => ({
      title: t.title,
      department: t.department,
      daysOverdue: businessDaysBetween(t.due_date, now),
      clientName: t.related_client_id ? (clientNames.get(t.related_client_id) || null) : null,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const pendingList = pendingTasks || [];
  const topPending = pendingList
    .slice(0, 5)
    .map((t: { title: string; department: string; due_date: string | null; related_client_id: string | null }) => ({
      title: t.title,
      department: t.department,
      dueDate: t.due_date,
      clientName: t.related_client_id ? (clientNames.get(t.related_client_id) || null) : null,
    }));

  const completedList = completedTasks || [];
  const completedDetails = completedList.map(
    (t: { title: string; related_client_id: string | null }) => ({
      title: t.title,
      clientName: t.related_client_id ? (clientNames.get(t.related_client_id) || null) : null,
    })
  );

  // Historical data
  const historical = await collectHistoricalData(supabase, "individual", userId);

  return {
    userName: profile?.name || "Usuario",
    userRole: roleData?.role || "sem_cargo",
    overdueTaskCount: overdueList.length,
    criticalOverdueTasks: allOverdueTasks,
    pendingTaskCount: pendingList.length,
    topPendingTasks: topPending,
    completedYesterdayCount: completedList.length,
    completedYesterdayTitles: completedDetails.slice(0, 5).map((t) => t.title),
    completedYesterdayDetails: completedDetails,
    assignedClientCount: clientList.length,
    undocumentedClients: undocClients,
    activeTags: tagList.map((t) => ({
      clientName: clientNames.get(t.client_id) || "N/A",
      tagName: t.name,
    })),
    historical,
  };
}

// ---------- Prompt Building ----------

function buildGroupPrompt(data: GroupData): string {
  const s: string[] = [];

  // Header
  s.push(`GRUPO "${data.groupName}" — ${data.members.length} membros, ${data.totalClients} clientes`);
  s.push(`Cargos: ${[...new Set(data.members.map((m) => m.role))].join(", ")}`);

  // Tasks summary
  s.push(`\nTAREFAS: ${data.completedYesterdayCount} concluidas ontem, ${data.overdueTaskCount} atrasadas`);
  if (data.criticalOverdueTasks.length > 0) {
    s.push("Todas atrasadas (dias uteis):");
    data.criticalOverdueTasks.forEach((t) =>
      s.push(`  * "${t.title}" — ${t.userName} (${t.department}) — ${t.daysOverdue} dias uteis${t.clientName ? ` — cliente: ${t.clientName}` : ""}`)
    );
  }

  // Completed yesterday details
  if (data.completedYesterdayDetails.length > 0) {
    s.push("Concluidas ontem:");
    data.completedYesterdayDetails.slice(0, 15).forEach((t) =>
      s.push(`  * "${t.title}" — ${t.userName}${t.clientName ? ` — cliente: ${t.clientName}` : ""}`)
    );
  }

  // CRM
  s.push(`\nCRM: ${data.crmDocumentedCount} documentados, ${data.crmUndocumentedClients.length} sem doc, ${data.crmDelayedCount} tracking atrasado, ${data.crmContactedCount} contatados`);
  if (data.crmUndocumentedClients.length > 0) {
    s.push("  Sem doc: " + data.crmUndocumentedClients.slice(0, 5).map((c) => `${c.clientName} (${c.gestorName})`).join(", "));
  }
  if (data.crmDelayedDetails.length > 0) {
    s.push("  Tracking atrasado: " + data.crmDelayedDetails.slice(0, 5).map((d) => `${d.clientName} (${d.responsibleName})`).join(", "));
  }

  // Ads
  s.push(`ADS: ${data.adsDocumentedCount} documentados, ${data.adsUndocumentedClients.length} sem doc, ${data.adsDelayedCount} tracking atrasado`);
  if (data.adsUndocumentedClients.length > 0) {
    s.push("  Sem doc: " + data.adsUndocumentedClients.slice(0, 5).map((c) => `${c.clientName} (${c.managerName})`).join(", "));
  }
  if (data.adsDelayedDetails.length > 0) {
    s.push("  Tracking atrasado: " + data.adsDelayedDetails.slice(0, 5).map((d) => `${d.clientName} (${d.responsibleName})`).join(", "));
  }

  // MKTPlace
  s.push(`MKTPLACE: ${data.mktplaceDocumentedCount} documentados, ${data.mktplaceUndocumentedClients.length} sem doc, ${data.mktplaceDelayedCount} tracking atrasado`);
  if (data.mktplaceUndocumentedClients.length > 0) {
    s.push("  Sem doc: " + data.mktplaceUndocumentedClients.slice(0, 5).map((c) => `${c.clientName} (${c.consultorName})`).join(", "));
  }
  if (data.mktplaceDelayedDetails.length > 0) {
    s.push("  Tracking atrasado: " + data.mktplaceDelayedDetails.slice(0, 5).map((d) => `${d.clientName} (${d.responsibleName})`).join(", "));
  }

  // Comercial
  s.push(`COMERCIAL: ${data.comercialDocumentedCount} documentacoes registradas ontem`);

  // Client overview
  const labelStr = Object.entries(data.clientsByLabel).map(([k, v]) => `${k}: ${v}`).join(", ");
  s.push(`\nCLIENTES — Labels: ${labelStr}`);

  if (data.clientsInDistrato.length > 0) {
    s.push(`Em distrato (${data.clientsInDistrato.length}): ${data.clientsInDistrato.map((c) => `${c.name} [${c.step}]`).join(", ")}`);
  }

  if (data.activeTags.length > 0) {
    s.push(`Tags ativas (${data.activeTags.length}):`);
    data.activeTags.slice(0, 10).forEach((t) => s.push(`  * ${t.clientName}: ${t.tagName}`));
  }

  // Per-member summaries
  if (data.memberSummaries.length > 0) {
    s.push(`\nPOR MEMBRO:`);
    data.memberSummaries.forEach((m) => {
      const issues: string[] = [];
      if (m.overdueTasks.length > 0) issues.push(`${m.overdueTasks.length} atrasadas`);
      if (m.undocumentedClients.length > 0) issues.push(`${m.undocumentedClients.length} sem doc`);
      if (m.delayedTracking.length > 0) issues.push(`${m.delayedTracking.length} tracking atrasado`);
      const completed = m.completedYesterday.length > 0 ? `, ${m.completedYesterday.length} concluidas ontem` : "";
      s.push(`  ${m.name} (${m.role}): ${issues.length > 0 ? issues.join(", ") : "OK"}${completed}`);
    });
  }

  // Highlights
  if (data.topCompleters.length > 0) {
    s.push(`\nDESTAQUES: ${data.topCompleters.map((c) => `${c.name} (${c.count} tarefas)`).join(", ")}`);
  }

  // Historical trend
  if (data.historical.length > 0) {
    s.push(`\nHISTORICO (5 dias uteis):`);
    data.historical.forEach((h) =>
      s.push(`  ${h.date}: ${h.tarefas_concluidas} concluidas, ${h.tarefas_atrasadas} atrasadas, ${h.documentacao_feita} docs, ${h.tracking_atrasado} tracking atrasado`)
    );
  }

  return s.join("\n");
}

function buildIndividualPrompt(data: IndividualData): string {
  const s: string[] = [];

  s.push(`PROFISSIONAL: ${data.userName} (${data.userRole})`);
  s.push(`Tarefas: ${data.completedYesterdayCount} concluidas ontem, ${data.overdueTaskCount} atrasadas, ${data.pendingTaskCount} pendentes`);

  if (data.criticalOverdueTasks.length > 0) {
    s.push("Todas atrasadas (dias uteis):");
    data.criticalOverdueTasks.forEach((t) =>
      s.push(`  * "${t.title}" (${t.department}) — ${t.daysOverdue} dias uteis${t.clientName ? ` — cliente: ${t.clientName}` : ""}`)
    );
  }

  if (data.topPendingTasks.length > 0) {
    s.push("Proximas pendentes:");
    data.topPendingTasks.forEach((t) =>
      s.push(`  * "${t.title}" (${t.department})${t.dueDate ? ` — prazo: ${t.dueDate}` : ""}${t.clientName ? ` — cliente: ${t.clientName}` : ""}`)
    );
  }

  if (data.completedYesterdayDetails.length > 0) {
    s.push("Concluidas ontem:");
    data.completedYesterdayDetails.slice(0, 10).forEach((t) =>
      s.push(`  * "${t.title}"${t.clientName ? ` — cliente: ${t.clientName}` : ""}`)
    );
  }

  s.push(`\nClientes atribuidos: ${data.assignedClientCount}`);
  if (data.undocumentedClients.length > 0) {
    s.push(`Sem documentacao ontem (${data.undocumentedClients.length}): ${data.undocumentedClients.slice(0, 5).map((c) => c.clientName).join(", ")}`);
  }

  if (data.activeTags.length > 0) {
    s.push(`Tags ativas: ${data.activeTags.slice(0, 5).map((t) => `${t.clientName}: ${t.tagName}`).join(", ")}`);
  }

  // Historical trend
  if (data.historical.length > 0) {
    s.push(`\nHISTORICO (5 dias uteis):`);
    data.historical.forEach((h) =>
      s.push(`  ${h.date}: ${h.tarefas_concluidas} concluidas, ${h.tarefas_atrasadas} atrasadas, ${h.documentacao_feita} docs`)
    );
  }

  return s.join("\n");
}

// ---------- System Prompts ----------

const GROUP_SYSTEM_PROMPT = `Você é o Oráculo, analista sênior de operações. Sua função é ANALISAR dados operacionais — identificar padrões, correlações entre áreas, e tendências nos últimos 5 dias úteis. Não reporte números — interprete-os.

Regras:
- Responda EXCLUSIVAMENTE com JSON válido. Nenhum texto fora do JSON.
- Cite nomes de pessoas e clientes específicos — nunca generalize.
- Analise correlações: pessoa com muitas tarefas atrasadas E clientes sem documentação = padrão sistêmico, não coincidência.
- Compare dados históricos dos 5 dias para identificar tendências (melhora, piora, estagnação).
- Severidade: critical = impacto direto em cliente ou >5 dias úteis de atraso; warning = 2-5 dias ou risco iminente; info = observação relevante.

Schema JSON obrigatório:
{
  "panorama": {
    "resumo": "string — 2-3 frases de análise contextual, não lista de números",
    "metricas_chave": {
      "tarefas_concluidas": 0,
      "tarefas_atrasadas": 0,
      "clientes_documentados": 0,
      "clientes_nao_documentados": 0
    }
  },
  "por_pessoa": [
    {
      "nome": "string — nome real da pessoa",
      "cargo": "string",
      "status": "ok|atencao|critico",
      "tarefas_atrasadas": [
        {"titulo": "string", "cliente": "string ou null", "dias_atraso": 0}
      ],
      "tarefas_concluidas_ontem": 0,
      "clientes_sem_documentacao": ["string — nome do cliente"],
      "observacao": "string — análise contextual do desempenho desta pessoa considerando histórico e carga"
    }
  ],
  "correlacoes": [
    {
      "tipo": "alerta|padrao|insight",
      "severidade": "critical|warning|info",
      "descricao": "string — correlação específica entre dados",
      "pessoas_envolvidas": ["string"],
      "clientes_envolvidos": ["string"]
    }
  ],
  "recomendacoes": [
    {
      "prioridade": 1,
      "acao": "string — ação concreta e específica",
      "razao": "string — baseada nos dados apresentados",
      "impacto": "alto|medio|baixo"
    }
  ]
}`;

const INDIVIDUAL_SYSTEM_PROMPT = `Você é o Oráculo, analista pessoal de produtividade. Sua função é ANALISAR os dados do profissional — identificar padrões de trabalho, priorizar ações, e reconhecer conquistas concretas. Não reporte — interprete.

Regras:
- Responda EXCLUSIVAMENTE com JSON válido. Nenhum texto fora do JSON.
- Cite nomes de clientes específicos — nunca generalize.
- Analise tendências dos últimos 5 dias úteis no histórico.
- Priorize ações pela combinação de urgência (dias de atraso) e impacto (cliente afetado).
- Severidade: critical = >5 dias úteis de atraso ou cliente em risco; warning = 2-5 dias; info = observação.
- Reconhecimento: apenas conquistas comprováveis pelos dados, com métrica específica.

Schema JSON obrigatório:
{
  "resumo": {
    "nome": "string — nome da pessoa",
    "texto": "string — 1-2 frases de análise do dia anterior"
  },
  "pendencias": [
    {
      "tipo": "tarefa|documentacao|tracking",
      "titulo": "string",
      "cliente": "string ou null",
      "dias_atraso": 0,
      "severidade": "critical|warning|info"
    }
  ],
  "prioridades_hoje": [
    {
      "ordem": 1,
      "acao": "string — ação concreta",
      "cliente": "string ou null",
      "razao": "string — por que esta é prioritária"
    }
  ],
  "padroes": [
    {
      "tipo": "alerta|positivo",
      "descricao": "string — tendência observada nos 5 dias",
      "dados": "string — evidência numérica que comprova"
    }
  ],
  "reconhecimento": {
    "texto": "string — conquista concreta do dia anterior",
    "metrica": "string — dado que comprova (ex: '4 tarefas concluídas, 2 acima da média')"
  }
}`;

// ---------- JSON Extraction & Validation ----------

function extractJSON(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();

  // Attempt 1: raw string is already valid JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { JSON.parse(trimmed); return trimmed; } catch { /* fall through */ }
  }

  // Attempt 2: JSON inside code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim();
    try { JSON.parse(candidate); return candidate; } catch { /* fall through */ }
  }

  // Attempt 3: extract first { ... last }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try { JSON.parse(candidate); return candidate; } catch { /* fall through */ }
  }

  return null;
}

function validateGroupJSON(parsed: Record<string, unknown>): boolean {
  return (
    typeof parsed.panorama === "object" &&
    parsed.panorama !== null &&
    typeof (parsed.panorama as Record<string, unknown>).resumo === "string"
  );
}

function validateIndividualJSON(parsed: Record<string, unknown>): boolean {
  return (
    typeof parsed.resumo === "object" &&
    parsed.resumo !== null &&
    typeof (parsed.resumo as Record<string, unknown>).nome === "string"
  );
}

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
      max_tokens: 3000,
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
    const { type, group_id, user_id, force } = body;

    // Skip weekends unless explicitly forced (manual re-generation)
    if (!force) {
      const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const dayOfWeek = nowBRT.getDay(); // 0=Sun, 6=Sat
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.log(`[Oracle] Skipped — weekend (day=${dayOfWeek})`);
        return new Response(
          JSON.stringify({ skipped: true, reason: "weekend" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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

    if (existing && existing.summary_content && !force) {
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
    const validateFn = type === "group" ? validateGroupJSON : validateIndividualJSON;

    // Call OpenRouter
    let { content: rawContent, tokensUsed } = await callOpenRouter(systemPrompt, dataPrompt, openrouterKey);
    let summaryContent: string = rawContent;

    // JSON extraction + validation with retry
    const extracted = extractJSON(rawContent);
    let jsonValid = false;

    if (extracted) {
      try {
        const parsed = JSON.parse(extracted);
        if (validateFn(parsed)) {
          summaryContent = extracted;
          jsonValid = true;
        }
      } catch { /* validation failed */ }
    }

    if (!jsonValid) {
      console.warn(`[Oracle] First response not valid JSON for ${type}, retrying...`);
      const correctionPrompt = `Sua resposta anterior não é JSON válido conforme o schema solicitado. Responda APENAS com o JSON, sem texto adicional. Resposta anterior:\n${rawContent}`;

      try {
        const retry = await callOpenRouter(systemPrompt, correctionPrompt, openrouterKey);
        tokensUsed += retry.tokensUsed;

        const retryExtracted = extractJSON(retry.content);
        if (retryExtracted) {
          try {
            const retryParsed = JSON.parse(retryExtracted);
            if (validateFn(retryParsed)) {
              summaryContent = retryExtracted;
              jsonValid = true;
            }
          } catch { /* retry validation failed */ }
        }

        if (!jsonValid) {
          console.warn(`[Oracle] Retry also failed JSON validation for ${type}. Storing raw content as fallback.`);
          summaryContent = retry.content;
        }
      } catch (retryError) {
        console.warn(`[Oracle] Retry call failed for ${type}. Storing original raw content as fallback.`, retryError);
      }
    }

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
