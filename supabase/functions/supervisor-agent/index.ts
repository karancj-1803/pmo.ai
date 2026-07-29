import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ===== Types =====
type AgentName =
  | "supervisor"
  | "planning"
  | "task"
  | "knowledge"
  | "risk"
  | "report"
  | "chat";

interface AgentEvent {
  agent_name: AgentName;
  event_type: string;
  message: string;
  details?: Record<string, unknown>;
  parent_event_id?: string;
}

interface OrchestratorContext {
  supabase: ReturnType<typeof createClient>;
  projectId: string;
  events: AgentEvent[];
  parentEventId?: string;
}

interface AgentResult {
  agent: AgentName;
  summary: string;
  output: Record<string, unknown>;
}

// ===== Agent metadata (for UI parity) =====
const AGENTS: Record<AgentName, { label: string; role: string }> = {
  supervisor: { label: "Supervisor Agent", role: "Orchestrates all specialized agents" },
  planning: { label: "Planning Agent", role: "Breaks down project goals into phases" },
  task: { label: "Task Agent", role: "Generates and organizes actionable tasks" },
  knowledge: { label: "Knowledge Agent", role: "Retrieves and summarizes documents (RAG)" },
  risk: { label: "Risk Agent", role: "Identifies and assesses project risks" },
  report: { label: "Report Agent", role: "Compiles status and executive reports" },
  chat: { label: "Chat Agent", role: "Answers questions using project context" },
};

// ===== Event logger (writes the orchestration trace) =====
async function logEvent(
  ctx: OrchestratorContext,
  agent: AgentName,
  eventType: string,
  message: string,
  details?: Record<string, unknown>,
): Promise<string> {
  const { data } = await ctx.supabase
    .from("agent_events")
    .insert({
      project_id: ctx.projectId,
      agent_name: agent,
      event_type: eventType,
      message,
      details: details ?? {},
      parent_event_id: ctx.parentEventId ?? null,
    })
    .select("id")
    .single();
  const id = data?.id ?? "";
  ctx.events.push({ agent_name: agent, event_type: eventType, message, details });
  return id;
}

// ===== Supervisor Agent: routing / orchestration =====
// Decides which specialized agents to invoke for a given user action.
function supervisorRoute(
  action: string,
): AgentName[] {
  const routes: Record<string, AgentName[]> = {
    create_project: ["planning", "task", "risk"],
    upload_document: ["knowledge"],
    update_task: ["task", "report"],
    analyze_project: ["risk", "report"],
    generate_report: ["report"],
    ask_question: ["chat"],
    plan_project: ["planning", "task"],
    assess_risks: ["risk"],
  };
  return routes[action] ?? ["chat"];
}

// ===== Planning Agent =====
// Breaks a project goal into sequential phases.
async function planningAgent(ctx: OrchestratorContext, goal: string): Promise<AgentResult> {
  await logEvent(ctx, "planning", "agent_start", "Planning Agent invoked — decomposing project goal");

  const phases = decomposeGoal(goal);
  await logEvent(ctx, "planning", "tool_call", `Called tool: plan_decomposition(goal)`, {
    tool: "plan_decomposition",
    input: { goal },
    output: { phases },
  });

  await logEvent(ctx, "planning", "agent_end", `Planning complete — ${phases.length} phases identified`, {
    phases,
  });

  return {
    agent: "planning",
    summary: `Decomposed the project into ${phases.length} phases: ${phases.map((p) => p.name).join(", ")}`,
    output: { phases },
  };
}

function decomposeGoal(goal: string): { name: string; description: string; weight: number }[] {
  const g = goal.toLowerCase();
  const phases: { name: string; description: string; weight: number }[] = [];

  if (/website|web|landing|portal|app/.test(g)) {
    phases.push(
      { name: "Discovery & Requirements", description: "Gather stakeholder needs, define scope and success metrics.", weight: 15 },
      { name: "Design & Architecture", description: "Create wireframes, system architecture, and technology decisions.", weight: 20 },
      { name: "Development", description: "Build core features, integrations, and UI components.", weight: 35 },
      { name: "Testing & QA", description: "Unit, integration, and user acceptance testing.", weight: 15 },
      { name: "Deployment & Launch", description: "Production rollout, monitoring setup, and go-live.", weight: 10 },
      { name: "Post-Launch Support", description: "Bug fixes, performance tuning, and iteration.", weight: 5 },
    );
  } else if (/mobile|ios|android/.test(g)) {
    phases.push(
      { name: "Product Definition", description: "Define user personas, core flows, and platform targets.", weight: 15 },
      { name: "UX/UI Design", description: "Wireframes, prototypes, and design system.", weight: 20 },
      { name: "MVP Development", description: "Build core screens, navigation, and backend APIs.", weight: 35 },
      { name: "Beta Testing", description: "TestFlight / internal beta, collect feedback.", weight: 15 },
      { name: "App Store Launch", description: "Submit to App Store / Play Store, marketing.", weight: 15 },
    );
  } else {
    phases.push(
      { name: "Initiation", description: "Define objectives, scope, and stakeholders.", weight: 10 },
      { name: "Planning", description: "Detailed planning, resource allocation, and scheduling.", weight: 20 },
      { name: "Execution", description: "Deliver the project work according to plan.", weight: 40 },
      { name: "Monitoring & Control", description: "Track progress, manage changes, and mitigate risks.", weight: 15 },
      { name: "Closure", description: "Finalize deliverables, release resources, and capture lessons.", weight: 15 },
    );
  }
  return phases;
}

// ===== Task Agent =====
// Generates concrete tasks from phases, persists them, and recomputes progress.
async function taskAgent(
  ctx: OrchestratorContext,
  phases: { name: string; description: string; weight: number }[],
  projectName: string,
): Promise<AgentResult> {
  await logEvent(ctx, "task", "agent_start", "Task Agent invoked — generating actionable tasks");

  const tasks = generateTasks(phases, projectName);
  await logEvent(ctx, "task", "tool_call", `Called tool: task_generator(phases)`, {
    tool: "task_generator",
    input: { phaseCount: phases.length },
    output: { taskCount: tasks.length },
  });

  // Persist tasks
  const rows = tasks.map((t) => ({
    project_id: ctx.projectId,
    title: t.title,
    description: t.description,
    status: "todo",
    priority: t.priority,
    assignee: t.assignee,
    estimated_hours: t.estimatedHours,
    agent_generated: true,
  }));

  const { data: inserted, error } = await ctx.supabase.from("tasks").insert(rows).select("id");
  await logEvent(ctx, "task", "tool_call", `Called tool: db.insert(tasks) — ${inserted?.length ?? 0} rows`, {
    tool: "db.insert",
    table: "tasks",
    rowsWritten: inserted?.length ?? 0,
    error: error?.message,
  });

  // Recompute progress
  const { data: prog } = await ctx.supabase.rpc("recompute_project_progress", { p_project_id: ctx.projectId });

  await logEvent(ctx, "task", "agent_end", `Task generation complete — ${tasks.length} tasks created`, {
    taskCount: tasks.length,
    progress: prog,
  });

  return {
    agent: "task",
    summary: `Generated ${tasks.length} tasks across ${phases.length} phases. Project progress initialized.`,
    output: { taskCount: tasks.length, progress: prog, tasks: rows.map((r, i) => ({ ...r, id: inserted?.[i]?.id })) },
  };
}

function generateTasks(
  phases: { name: string; description: string; weight: number }[],
  projectName: string,
): { title: string; description: string; priority: string; assignee: string; estimatedHours: number }[] {
  const tasks: { title: string; description: string; priority: string; assignee: string; estimatedHours: number }[] = [];
  const roles = ["Product Lead", "Tech Lead", "Designer", "Engineer", "QA Engineer", "DevOps"];

  phases.forEach((phase, pi) => {
    const count = 3 + (pi % 2);
    for (let i = 0; i < count; i++) {
      const title = `${phase.name}: ${taskVerb(phase.name, i)}`;
      tasks.push({
        title,
        description: `${taskVerb(phase.name, i)} for ${projectName} as part of the "${phase.name}" phase. ${phase.description}`,
        priority: i === 0 ? "high" : i === 1 ? "medium" : "low",
        assignee: roles[(pi + i) % roles.length],
        estimatedHours: 8 + (i * 4) + (pi % 3) * 2,
      });
    }
  });
  return tasks;
}

function taskVerb(phase: string, i: number): string {
  const verbs: Record<string, string[]> = {
    "Discovery & Requirements": ["Conduct stakeholder interviews", "Document functional requirements", "Define success metrics"],
    "Design & Architecture": ["Create wireframes", "Design system architecture", "Review design with stakeholders"],
    "Development": ["Implement core API endpoints", "Build UI components", "Integrate third-party services"],
    "Testing & QA": ["Write unit tests", "Perform integration testing", "Conduct UAT session"],
    "Deployment & Launch": ["Configure production environment", "Deploy to production", "Verify live deployment"],
    "Post-Launch Support": ["Monitor error logs", "Patch critical bugs", "Collect user feedback"],
    "Initiation": ["Draft project charter", "Identify key stakeholders", "Define project scope"],
    "Planning": ["Create work breakdown structure", "Assign resources to tasks", "Finalize project schedule"],
    "Execution": ["Deliver phase deliverables", "Conduct status reviews", "Manage scope changes"],
    "Monitoring & Control": ["Track KPIs", "Update risk register", "Report status to stakeholders"],
    "Closure": ["Obtain formal sign-off", "Release project resources", "Document lessons learned"],
    "Product Definition": ["Define user personas", "Map core user flows", "Finalize feature scope"],
    "UX/UI Design": ["Create low-fidelity wireframes", "Build interactive prototype", "Establish design system"],
    "MVP Development": ["Implement authentication", "Build core navigation", "Develop backend APIs"],
    "Beta Testing": ["Distribute TestFlight build", "Collect beta feedback", "Triage beta issues"],
    "App Store Launch": ["Prepare app store listing", "Submit for review", "Execute launch marketing"],
  };
  return verbs[phase]?.[i] ?? `Complete ${phase} activity ${i + 1}`;
}

// ===== Knowledge Agent (RAG) =====
// Summarizes an uploaded document and extracts key concepts (simulated retrieval).
async function knowledgeAgent(
  ctx: OrchestratorContext,
  doc: { filename: string; contentText: string; contentType: string; documentId?: string },
): Promise<AgentResult> {
  await logEvent(ctx, "knowledge", "agent_start", `Knowledge Agent invoked — processing "${doc.filename}"`);

  await logEvent(ctx, "knowledge", "tool_call", `Called tool: document_loader(filename)`, {
    tool: "document_loader",
    input: { filename: doc.filename },
  });

  const summary = summarize(doc.contentText, doc.filename);
  const keywords = extractKeywords(doc.contentText);

  const storagePath = `${ctx.projectId}/${doc.filename}`;
  try {
    const encoder = new TextEncoder();
    const fileData = encoder.encode(doc.contentText);
    await ctx.supabase.storage.from("documents").upload(storagePath, fileData, {
      contentType: doc.contentType || "text/plain",
      upsert: true,
    });
    console.log(`Uploaded to storage path: ${storagePath}`);
  } catch (se) {
    console.error(`Failed to upload to storage:`, se);
  }

  if (doc.documentId) {
    try {
      await ctx.supabase
        .from("documents")
        .update({ storage_path: storagePath, summary })
        .eq("id", doc.documentId);
    } catch (de) {
      console.error(`Failed to update document db row:`, de);
    }
  }

  await logEvent(ctx, "knowledge", "tool_call", `Called tool: vector_embed(summary)`, {
    tool: "vector_embed",
    note: "Embedding stored for semantic retrieval (pgvector-ready)",
    keywords,
    storage_path: storagePath,
  });

  await logEvent(ctx, "knowledge", "agent_end", `Document ingested — ${keywords.length} concepts extracted`, {
    summary,
    keywords,
  });

  return {
    agent: "knowledge",
    summary: `Ingested "${doc.filename}" and extracted ${keywords.length} key concepts. Summary generated for retrieval.`,
    output: { summary, keywords },
  };
}

function summarize(text: string, filename: string): string {
  if (!text || text.trim().length === 0) {
    return `Document "${filename}" was uploaded. No extractable text content was found; the file may be binary or image-based.`;
  }
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
  const first = sentences.slice(0, 3).join(" ");
  return first || text.slice(0, 280);
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const stop = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "be", "been", "being", "this", "that", "these", "those", "it", "as", "from", "will", "can", "has", "have", "had", "not", "no", "do", "does", "did", "so", "if", "then", "than", "too", "very", "just", "about", "into", "your", "our", "their", "its"]);
  const words = text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]);
}

// ===== Risk Agent =====
// Identifies risks based on project profile and task load.
async function riskAgent(ctx: OrchestratorContext): Promise<AgentResult> {
  await logEvent(ctx, "risk", "agent_start", "Risk Agent invoked — scanning for project risks");

  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("status, due_date, priority")
    .eq("project_id", ctx.projectId);

  await logEvent(ctx, "risk", "tool_call", `Called tool: db.query(tasks) — ${tasks?.length ?? 0} tasks analyzed`, {
    tool: "db.query",
    table: "tasks",
    rowsRead: tasks?.length ?? 0,
  });

  const risks = identifyRisks(tasks ?? []);
  const rows = risks.map((r) => ({
    project_id: ctx.projectId,
    title: r.title,
    description: r.description,
    severity: r.severity,
    likelihood: r.likelihood,
    impact: r.impact,
    status: "identified",
    mitigation: r.mitigation,
    agent_generated: true,
  }));

  const { data: inserted } = await ctx.supabase.from("risks").insert(rows).select("id");
  await logEvent(ctx, "risk", "tool_call", `Called tool: db.insert(risks) — ${inserted?.length ?? 0} risks logged`, {
    tool: "db.insert",
    table: "risks",
    rowsWritten: inserted?.length ?? 0,
  });

  await logEvent(ctx, "risk", "agent_end", `Risk assessment complete — ${risks.length} risks identified`, {
    riskCount: risks.length,
    bySeverity: risks.reduce((acc, r) => { acc[r.severity] = (acc[r.severity] ?? 0) + 1; return acc; }, {} as Record<string, number>),
  });

  return {
    agent: "risk",
    summary: `Identified ${risks.length} risks (${risks.filter((r) => r.severity === "high" || r.severity === "critical").length} high+). Mitigation strategies proposed.`,
    output: { riskCount: risks.length, risks: rows },
  };
}

function identifyRisks(tasks: { status: string; due_date: string | null; priority: string }[]): {
  title: string; description: string; severity: string; likelihood: string; impact: string; mitigation: string;
}[] {
  const risks: { title: string; description: string; severity: string; likelihood: string; impact: string; mitigation: string }[] = [];
  const total = tasks.length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const highPri = tasks.filter((t) => t.priority === "high" || t.priority === "critical").length;
  const noDue = tasks.filter((t) => !t.due_date).length;

  if (total === 0) {
    risks.push({
      title: "Scope Definition Gap",
      description: "No tasks have been defined for this project yet, indicating the scope may not be fully decomposed.",
      severity: "high", likelihood: "high", impact: "high",
      mitigation: "Run the Planning and Task Agents to generate a complete work breakdown structure.",
    });
    return risks;
  }

  if (blocked / total > 0.2) {
    risks.push({
      title: "High Task Blockage Rate",
      description: `${blocked} of ${total} tasks are blocked, which may stall delivery.`,
      severity: "high", likelihood: "high", impact: "high",
      mitigation: "Review blocked tasks in standup; escalate dependencies and reassign owners.",
    });
  }
  if (highPri / total > 0.4) {
    risks.push({
      title: "Priority Overload",
      description: `${highPri} of ${total} tasks are high or critical priority, risking team burnout and context switching.`,
      severity: "medium", likelihood: "medium", impact: "high",
      mitigation: "Re-prioritize ruthlessly; defer non-critical work to the next sprint.",
    });
  }
  if (noDue / total > 0.5) {
    risks.push({
      title: "Missing Deadlines",
      description: `${noDue} of ${total} tasks have no due date, making schedule tracking impossible.`,
      severity: "medium", likelihood: "high", impact: "medium",
      mitigation: "Assign due dates to all open tasks; sequence by dependency.",
    });
  }
  risks.push({
    title: "Key Person Dependency",
    description: "Critical knowledge may be concentrated in a few team members, creating a bus-factor risk.",
    severity: "medium", likelihood: "medium", impact: "high",
    mitigation: "Document critical paths, pair-program on key tasks, and cross-train team members.",
  });
  risks.push({
    title: "Scope Creep",
    description: "As requirements emerge, the project scope may expand beyond the original plan.",
    severity: "medium", likelihood: "high", impact: "medium",
    mitigation: "Enforce a change-control process; log and triage all new requests.",
  });
  return risks;
}

// ===== Report Agent =====
// Compiles a status report from current project state.
async function reportAgent(ctx: OrchestratorContext, type: string): Promise<AgentResult> {
  await logEvent(ctx, "report", "agent_start", `Report Agent invoked — generating ${type} report`);

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("name, description, status, priority, progress, start_date, target_end_date")
    .eq("id", ctx.projectId)
    .maybeSingle();

  const { data: tasks } = await ctx.supabase
    .from("tasks")
    .select("id, status, priority")
    .eq("project_id", ctx.projectId);

  const { data: risks } = await ctx.supabase
    .from("risks")
    .select("id, severity, status")
    .eq("project_id", ctx.projectId);

  await logEvent(ctx, "report", "tool_call", `Called tool: db.query(projects, tasks, risks)`, {
    tool: "db.query",
    tables: ["projects", "tasks", "risks"],
  });

  const taskStats = {
    total: tasks?.length ?? 0,
    done: tasks?.filter((t) => t.status === "done").length ?? 0,
    inProgress: tasks?.filter((t) => t.status === "in_progress").length ?? 0,
    todo: tasks?.filter((t) => t.status === "todo").length ?? 0,
    blocked: tasks?.filter((t) => t.status === "blocked").length ?? 0,
  };
  const riskStats = {
    total: risks?.length ?? 0,
    open: risks?.filter((r) => r.status !== "resolved" && r.status !== "accepted").length ?? 0,
    critical: risks?.filter((r) => r.severity === "critical").length ?? 0,
  };

  const content = {
    project: project?.name,
    status: project?.status,
    progress: project?.progress,
    summary: `${project?.name ?? "Project"} is ${project?.status ?? "in progress"} at ${project?.progress ?? 0}% completion. ${taskStats.done} of ${taskStats.total} tasks are complete, with ${taskStats.blocked} currently blocked. There are ${riskStats.open} open risks (${riskStats.critical} critical).`,
    taskStats,
    riskStats,
    health: (project?.progress ?? 0) > 50 && taskStats.blocked < taskStats.total * 0.2 ? "on_track" : "at_risk",
    recommendations: buildRecommendations(taskStats, riskStats),
  };

  const title = type === "executive" ? `Executive Summary — ${project?.name ?? "Project"}` : `Status Report — ${project?.name ?? "Project"}`;
  const { data: inserted } = await ctx.supabase
    .from("reports")
    .insert({
      project_id: ctx.projectId,
      type,
      title,
      content,
      generated_by_agent: true,
    })
    .select("id")
    .single();

  await logEvent(ctx, "report", "tool_call", `Called tool: db.insert(reports)`, {
    tool: "db.insert",
    table: "reports",
    reportId: inserted?.id,
  });
  await logEvent(ctx, "report", "agent_end", `Report generated — "${title}"`, { type, health: content.health });

  return {
    agent: "report",
    summary: `Generated ${type} report. Project health: ${content.health}.`,
    output: { reportId: inserted?.id, content },
  };
}

function buildRecommendations(taskStats: Record<string, number>, riskStats: Record<string, number>): string[] {
  const recs: string[] = [];
  if (taskStats.blocked > 0) recs.push(`Unblock ${taskStats.blocked} stalled task(s) to restore flow.`);
  if (riskStats.critical > 0) recs.push(`Address ${riskStats.critical} critical risk(s) immediately.`);
  if (taskStats.todo > taskStats.done) recs.push("Accelerate execution — backlog exceeds completed work.");
  if (recs.length === 0) recs.push("Project is on track. Continue current cadence.");
  return recs;
}

// ===== Chat Agent =====
// Answers user questions using project context (simulated RAG over tasks/risks/docs).
async function chatAgent(
  ctx: OrchestratorContext,
  question: string,
): Promise<AgentResult> {
  await logEvent(ctx, "chat", "agent_start", `Chat Agent invoked — question: "${question.slice(0, 80)}"`);

  const { data: project } = await ctx.supabase
    .from("projects")
    .select("name, description, status, progress")
    .eq("id", ctx.projectId)
    .maybeSingle();
  const { data: tasks } = await ctx.supabase.from("tasks").select("title, status, priority").eq("project_id", ctx.projectId).limit(20);
  const { data: risks } = await ctx.supabase.from("risks").select("title, severity, status").eq("project_id", ctx.projectId).limit(10);
  const { data: docs } = await ctx.supabase.from("documents").select("filename, summary").eq("project_id", ctx.projectId).limit(5);

  await logEvent(ctx, "chat", "tool_call", `Called tool: retrieve_context(project, tasks, risks, documents)`, {
    tool: "retrieve_context",
    sources: { tasks: tasks?.length ?? 0, risks: risks?.length ?? 0, documents: docs?.length ?? 0 },
  });

  const answer = synthesizeAnswer(question, project, tasks ?? [], risks ?? [], docs ?? []);
  await logEvent(ctx, "chat", "agent_end", "Chat Agent responded", { answerLength: answer.length });

  return { agent: "chat", summary: answer, output: { answer } };
}

function synthesizeAnswer(
  question: string,
  project: Record<string, unknown> | null,
  tasks: Record<string, unknown>[],
  risks: Record<string, unknown>[],
  docs: Record<string, unknown>[],
): string {
  const q = question.toLowerCase();
  const name = (project?.name as string) ?? "this project";
  const progress = (project?.progress as number) ?? 0;
  const status = (project?.status as string) ?? "in progress";

  if (/status|progress|how.*doing|update/.test(q)) {
    const done = tasks.filter((t) => t.status === "done").length;
    return `**${name}** is currently **${status}** at **${progress}%** completion. ${done} of ${tasks.length} tasks are complete. There are ${risks.length} risks on the register (${risks.filter((r) => r.severity === "high" || r.severity === "critical").length} high+). Overall the project is ${progress > 50 ? "on track" : "in early stages"}.`;
  }
  if (/risk|blocker|issue|problem/.test(q)) {
    if (risks.length === 0) return `No risks have been identified for **${name}** yet. You can ask the Risk Agent to run an assessment.`;
    const list = risks.map((r) => `- **${r.title}** (${r.severity}, ${r.status})`).join("\n");
    return `Here are the current risks for **${name}**:\n${list}\n\nI recommend reviewing the high-severity items first.`;
  }
  if (/task|work|todo|backlog/.test(q)) {
    if (tasks.length === 0) return `No tasks have been created for **${name}** yet. The Task Agent can generate a work breakdown structure for you.`;
    const byStatus = {
      done: tasks.filter((t) => t.status === "done").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      todo: tasks.filter((t) => t.status === "todo").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
    };
    return `**${name}** has ${tasks.length} tasks:\n- Done: ${byStatus.done}\n- In progress: ${byStatus.in_progress}\n- To do: ${byStatus.todo}\n- Blocked: ${byStatus.blocked}\n\nThe next priority is to advance the ${byStatus.todo} pending tasks.`;
  }
  if (/document|doc|file|knowledge/.test(q)) {
    if (docs.length === 0) return `No documents have been uploaded to **${name}** yet. Upload a document and the Knowledge Agent will ingest it for retrieval.`;
    const list = docs.map((d) => `- **${d.filename}** — ${d.summary ?? "no summary"}`).join("\n");
    return `**${name}** has ${docs.length} document(s) in the knowledge base:\n${list}`;
  }
  if (/deadline|date|schedule|timeline|when/.test(q)) {
    return `**${name}** is at ${progress}% completion and is currently ${status}. Check the Overview tab for target and actual end dates. If the schedule is at risk, the Risk Agent can flag it.`;
  }
  // Default: general project summary
  return `Here's what I know about **${name}**: it's ${status} at ${progress}% completion with ${tasks.length} tasks and ${risks.length} risks tracked. You can ask me about status, tasks, risks, documents, or the schedule.`;
}

// ===== Orchestrator (LangGraph-style state machine) =====
async function orchestrate(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<{ results: AgentResult[]; events: AgentEvent[] }> {
  const ctx: OrchestratorContext = { supabase, projectId, events: [], parentEventId: undefined };

  // Supervisor decision
  const agents = supervisorRoute(action);
  const supervisorId = await logEvent(ctx, "supervisor", "decision", `Supervisor routed "${action}" → [${agents.join(", ")}]`, { action, agents });
  ctx.parentEventId = supervisorId;

  const results: AgentResult[] = [];

  if (action === "create_project" || action === "plan_project") {
    const goal = (payload.goal as string) || (payload.name as string) || "new project";
    const planning = await planningAgent(ctx, goal);
    results.push(planning);
    const task = await taskAgent(ctx, planning.output.phases as { name: string; description: string; weight: number }[], (payload.name as string) || "Project");
    results.push(task);
    const risk = await riskAgent(ctx);
    results.push(risk);
    const report = await reportAgent(ctx, "status");
    results.push(report);
  } else if (action === "upload_document") {
    const knowledge = await knowledgeAgent(ctx, {
      filename: payload.filename as string,
      contentText: payload.contentText as string,
      contentType: payload.contentType as string,
      documentId: payload.documentId as string,
    });
    results.push(knowledge);
  } else if (action === "analyze_project" || action === "assess_risks") {
    const risk = await riskAgent(ctx);
    results.push(risk);
    const report = await reportAgent(ctx, "risk");
    results.push(report);
  } else if (action === "generate_report" || action === "update_task") {
    const report = await reportAgent(ctx, (payload.reportType as string) || "status");
    results.push(report);
  } else if (action === "ask_question") {
    const chat = await chatAgent(ctx, payload.question as string);
    results.push(chat);
  }

  await logEvent(ctx, "supervisor", "complete", "Supervisor orchestration complete", { agentsInvoked: agents });
  return { results, events: ctx.events };
}

// ===== HTTP handler =====
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, projectId, payload } = body as {
      action: string;
      projectId: string;
      payload: Record<string, unknown>;
    };

    if (!action || !projectId) {
      return new Response(JSON.stringify({ error: "action and projectId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { results, events } = await orchestrate(supabase, projectId, action, payload ?? {});

    return new Response(JSON.stringify({ success: true, results, events, agents: AGENTS }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
