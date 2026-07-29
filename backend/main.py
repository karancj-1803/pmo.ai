import os
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Helper function to call Gemini REST API directly using urllib (bypasses Python 3.14 binary compatibility issues)
def call_gemini(prompt: str, model_name: str = "gemini-1.5-flash") -> str:
    if not GEMINI_API_KEY:
        raise ValueError("Missing GEMINI_API_KEY")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    with urllib.request.urlopen(req) as response:
        res_body = response.read().decode("utf-8")
        res_json = json.loads(res_body)
        return res_json["candidates"][0]["content"]["parts"][0]["text"]

app = FastAPI(title="PMO.AI Backend Service")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Types & Metadata =====
AGENTS = {
    "supervisor": {"label": "Supervisor Agent", "role": "Orchestrates all specialized agents"},
    "planning": {"label": "Planning Agent", "role": "Breaks down project goals into phases"},
    "task": {"label": "Task Agent", "role": "Generates and organizes actionable tasks"},
    "knowledge": {"label": "Knowledge Agent", "role": "Retrieves and summarizes documents (RAG)"},
    "risk": {"label": "Risk Agent", "role": "Identifies and assesses project risks"},
    "report": {"label": "Report Agent", "role": "Compiles status and executive reports"},
    "chat": {"label": "Chat Agent", "role": "Answers questions using project context"},
}

# ===== Helper: Log Agent Event to Database =====
async def log_event(
    project_id: str,
    agent_name: str,
    event_type: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    parent_event_id: Optional[str] = None
) -> str:
    payload = {
        "project_id": project_id,
        "agent_name": agent_name,
        "event_type": event_type,
        "message": message,
        "details": details or {},
        "parent_event_id": parent_event_id
    }
    res = supabase.table("agent_events").insert(payload).execute()
    if res.data and len(res.data) > 0:
        return res.data[0].get("id", "")
    return ""

# ===== Agent Route Mapping =====
def supervisor_route(action: str) -> List[str]:
    routes = {
        "create_project": ["planning", "task", "risk"],
        "upload_document": ["knowledge"],
        "update_task": ["task", "report"],
        "analyze_project": ["risk", "report"],
        "generate_report": ["report"],
        "ask_question": ["chat"],
        "plan_project": ["planning", "task"],
        "assess_risks": ["risk"],
    }
    return routes.get(action, ["chat"])

# ===== Planning Agent =====
async def planning_agent(project_id: str, goal: str, parent_event_id: str) -> Dict[str, Any]:
    await log_event(project_id, "planning", "agent_start", "Planning Agent invoked — decomposing project goal", parent_event_id=parent_event_id)
    
    phases = []
    if GEMINI_API_KEY:
        try:
            prompt = (
                f"Decompose the following project goal into 4 to 6 sequential phases. "
                f"Project goal: '{goal}'. "
                f"Respond with a raw valid JSON list of objects containing name (string), description (string), and weight (integer representing percentage progress weight, sum of all weights must equal 100). "
                f"Do not include markdown blocks or any text other than the raw JSON."
            )
            res_text = call_gemini(prompt)
            clean_text = res_text.strip().replace("```json", "").replace("```", "").strip()
            phases = json.loads(clean_text)
        except Exception as e:
            print(f"Gemini planning failed: {e}. Falling back to rules.")
            phases = decompose_goal_rules(goal)
    else:
        phases = decompose_goal_rules(goal)

    await log_event(project_id, "planning", "tool_call", "Called tool: plan_decomposition(goal)", {
        "tool": "plan_decomposition",
        "input": {"goal": goal},
        "output": {"phases": phases}
    }, parent_event_id=parent_event_id)
    
    await log_event(project_id, "planning", "agent_end", f"Planning complete — {len(phases)} phases identified", {
        "phases": phases
    }, parent_event_id=parent_event_id)

    return {
        "agent": "planning",
        "summary": f"Decomposed the project into {len(phases)} phases: {', '.join([p['name'] for p in phases])}",
        "output": {"phases": phases}
    }

def decompose_goal_rules(goal: str) -> List[Dict[str, Any]]:
    g = goal.lower()
    if any(k in g for k in ["website", "web", "landing", "portal", "app"]):
        return [
            {"name": "Discovery & Requirements", "description": "Gather stakeholder needs and define scope.", "weight": 15},
            {"name": "Design & Architecture", "description": "Create UI wireframes and database design.", "weight": 20},
            {"name": "Development", "description": "Build backend APIs and frontend UI components.", "weight": 35},
            {"name": "Testing & QA", "description": "Conduct thorough integration and system testing.", "weight": 15},
            {"name": "Deployment & Launch", "description": "Deploy code to cloud host and launch production site.", "weight": 15}
        ]
    elif any(k in g for k in ["mobile", "ios", "android"]):
        return [
            {"name": "Product Definition", "description": "Define mobile user flow and personas.", "weight": 15},
            {"name": "UX/UI Design", "description": "Figma layout design and assets export.", "weight": 20},
            {"name": "MVP Development", "description": "Develop core frontend view & integrate APIs.", "weight": 40},
            {"name": "Beta Testing", "description": "Deploy to Testflight/Internal testing.", "weight": 15},
            {"name": "App Store Submission", "description": "Submit build to app stores.", "weight": 10}
        ]
    else:
        return [
            {"name": "Initiation", "description": "Define scope, goals, and key stakeholders.", "weight": 15},
            {"name": "Planning", "description": "Draft milestone timeline and resource distribution.", "weight": 20},
            {"name": "Execution", "description": "Implement core deliverables and project tasks.", "weight": 45},
            {"name": "Monitoring", "description": "Measure KPIs and update project roadmap.", "weight": 10},
            {"name": "Closure", "description": "Prepare final executive report and project sign-off.", "weight": 10}
        ]

# ===== Task Agent =====
async def task_agent(project_id: str, phases: List[Dict[str, Any]], project_name: str, parent_event_id: str) -> Dict[str, Any]:
    await log_event(project_id, "task", "agent_start", "Task Agent invoked — generating actionable tasks", parent_event_id=parent_event_id)
    
    tasks = []
    if GEMINI_API_KEY:
        try:
            prompt = (
                f"For the project '{project_name}' and the following phases:\n"
                f"{json.dumps(phases)}\n"
                f"Generate 2 to 3 distinct actionable tasks for each phase. "
                f"Return a raw valid JSON list of objects. Each object should have: "
                f"title (string, format: 'Phase Name: Actionable Task Title'), "
                f"description (string), "
                f"priority (string: 'low', 'medium', 'high', or 'critical'), "
                f"assignee (string, choose one from: Product Lead, Tech Lead, Designer, Engineer, QA Engineer, DevOps), "
                f"estimatedHours (integer hours between 4 and 40). "
                f"Do not include markdown tags."
            )
            res_text = call_gemini(prompt)
            clean_text = res_text.strip().replace("```json", "").replace("```", "").strip()
            tasks = json.loads(clean_text)
        except Exception as e:
            print(f"Gemini task generation failed: {e}. Falling back to rules.")
            tasks = generate_tasks_rules(phases, project_name)
    else:
        tasks = generate_tasks_rules(phases, project_name)

    await log_event(project_id, "task", "tool_call", "Called tool: task_generator(phases)", {
        "tool": "task_generator",
        "input": {"phaseCount": len(phases)},
        "output": {"taskCount": len(tasks)}
    }, parent_event_id=parent_event_id)

    # Delete existing agent-generated tasks to avoid duplication
    supabase.table("tasks").delete().eq("project_id", project_id).eq("agent_generated", True).execute()

    # Insert tasks into Supabase
    rows = []
    for t in tasks:
        rows.append({
            "project_id": project_id,
            "title": t.get("title", ""),
            "description": t.get("description", ""),
            "status": "todo",
            "priority": t.get("priority", "medium"),
            "assignee": t.get("assignee", "Engineer"),
            "estimated_hours": t.get("estimatedHours", 8),
            "agent_generated": True
        })
        
    inserted = supabase.table("tasks").insert(rows).execute()
    rows_written = len(inserted.data) if inserted.data else 0

    await log_event(project_id, "task", "tool_call", f"Called tool: db.insert(tasks) — {rows_written} rows", {
        "tool": "db.insert",
        "table": "tasks",
        "rowsWritten": rows_written
    }, parent_event_id=parent_event_id)

    # Recompute progress via RPC
    supabase.rpc("recompute_project_progress", {"p_project_id": project_id}).execute()

    await log_event(project_id, "task", "agent_end", f"Task generation complete — {len(tasks)} tasks created", {
        "taskCount": len(tasks)
    }, parent_event_id=parent_event_id)

    return {
        "agent": "task",
        "summary": f"Generated {len(tasks)} tasks across {len(phases)} phases. Project progress initialized.",
        "output": {"taskCount": len(tasks), "tasks": inserted.data}
    }

def generate_tasks_rules(phases: List[Dict[str, Any]], project_name: str) -> List[Dict[str, Any]]:
    tasks = []
    roles = ["Product Lead", "Tech Lead", "Designer", "Engineer", "QA Engineer", "DevOps"]
    verbs = {
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
    }
    
    for pi, phase in enumerate(phases):
        phase_name = phase["name"]
        phase_verbs = verbs.get(phase_name, [f"Complete {phase_name} activity 1", f"Complete {phase_name} activity 2"])
        for i, verb in enumerate(phase_verbs[:3]):
            tasks.append({
                "title": f"{phase_name}: {verb}",
                "description": f"{verb} for {project_name} as part of the '{phase_name}' phase.",
                "priority": "high" if i == 0 else "medium" if i == 1 else "low",
                "assignee": roles[(pi + i) % len(roles)],
                "estimatedHours": 8 + (i * 4) + (pi % 3) * 2
            })
    return tasks

# ===== Risk Agent =====
async def risk_agent(project_id: str, parent_event_id: str) -> Dict[str, Any]:
    await log_event(project_id, "risk", "agent_start", "Risk Agent invoked — scanning for project risks", parent_event_id=parent_event_id)
    
    # Query tasks to assess risks
    res = supabase.table("tasks").select("status, due_date, priority").eq("project_id", project_id).execute()
    tasks = res.data or []
    
    await log_event(project_id, "risk", "tool_call", f"Called tool: db.query(tasks) — {len(tasks)} tasks analyzed", {
        "tool": "db.query",
        "table": "tasks",
        "rowsRead": len(tasks)
    }, parent_event_id=parent_event_id)

    risks = []
    if GEMINI_API_KEY and len(tasks) > 0:
        try:
            prompt = (
                f"Given the following project tasks:\n"
                f"{json.dumps(tasks)}\n"
                f"Identify 3 to 5 key project risks. "
                f"Return a raw valid JSON list of objects containing: "
                f"title (string), description (string), "
                f"severity (string: 'low', 'medium', 'high', 'critical'), "
                f"likelihood (string: 'low', 'medium', 'high'), "
                f"impact (string: 'low', 'medium', 'high', 'critical'), "
                f"mitigation (string)."
                f"Do not include markdown tags."
            )
            res_text = call_gemini(prompt)
            clean_text = res_text.strip().replace("```json", "").replace("```", "").strip()
            risks = json.loads(clean_text)
        except Exception as e:
            print(f"Gemini risk identification failed: {e}. Falling back to rules.")
            risks = identify_risks_rules(tasks)
    else:
        risks = identify_risks_rules(tasks)

    # Delete existing agent-generated risks to avoid duplication
    supabase.table("risks").delete().eq("project_id", project_id).eq("agent_generated", True).execute()

    rows = []
    for r in risks:
        rows.append({
            "project_id": project_id,
            "title": r.get("title", ""),
            "description": r.get("description", ""),
            "severity": r.get("severity", "medium"),
            "likelihood": r.get("likelihood", "medium"),
            "impact": r.get("impact", "medium"),
            "status": "identified",
            "mitigation": r.get("mitigation", ""),
            "agent_generated": True
        })
        
    inserted = supabase.table("risks").insert(rows).execute()
    rows_written = len(inserted.data) if inserted.data else 0

    await log_event(project_id, "risk", "tool_call", f"Called tool: db.insert(risks) — {rows_written} risks logged", {
        "tool": "db.insert",
        "table": "risks",
        "rowsWritten": rows_written
    }, parent_event_id=parent_event_id)

    await log_event(project_id, "risk", "agent_end", f"Risk assessment complete — {len(risks)} risks identified", {
        "riskCount": len(risks)
    }, parent_event_id=parent_event_id)

    return {
        "agent": "risk",
        "summary": f"Identified {len(risks)} risks. Mitigation strategies proposed.",
        "output": {"riskCount": len(risks), "risks": inserted.data}
    }

def identify_risks_rules(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    risks = []
    total = len(tasks)
    if total == 0:
        return [{
            "title": "Scope Definition Gap",
            "description": "No tasks have been defined for this project yet, indicating the scope may not be fully decomposed.",
            "severity": "high", "likelihood": "high", "impact": "high",
            "mitigation": "Run the Planning and Task Agents to generate a complete work breakdown structure."
        }]

    blocked = len([t for t in tasks if t.get("status") == "blocked"])
    high_pri = len([t for t in tasks if t.get("priority") in ["high", "critical"]])
    no_due = len([t for t in tasks if not t.get("due_date")])

    if blocked / total > 0.2:
        risks.append({
            "title": "High Task Blockage Rate",
            "description": f"{blocked} of {total} tasks are blocked, which may stall delivery.",
            "severity": "high", "likelihood": "high", "impact": "high",
            "mitigation": "Review blocked tasks in standup; escalate dependencies and reassign owners."
        })
    if high_pri / total > 0.4:
        risks.append({
            "title": "Priority Overload",
            "description": f"{high_pri} of {total} tasks are high or critical priority, risking team burnout.",
            "severity": "medium", "likelihood": "medium", "impact": "high",
            "mitigation": "Re-prioritize tasks; defer non-critical work to the next sprint."
        })
    if no_due / total > 0.5:
        risks.append({
            "title": "Missing Deadlines",
            "description": f"{no_due} of {total} tasks have no due date, making schedule tracking impossible.",
            "severity": "medium", "likelihood": "high", "impact": "medium",
            "mitigation": "Assign due dates to all open tasks; sequence by dependency."
        })
    
    risks.append({
        "title": "Key Person Dependency",
        "description": "Critical knowledge may be concentrated in a few team members.",
        "severity": "medium", "likelihood": "medium", "impact": "high",
        "mitigation": "Document critical paths, pair-program on key tasks, and cross-train team members."
    })
    return risks

# ===== Report Agent =====
async def report_agent(project_id: str, report_type: str, parent_event_id: str) -> Dict[str, Any]:
    await log_event(project_id, "report", "agent_start", f"Report Agent invoked — generating {report_type} report", parent_event_id=parent_event_id)
    
    # Query project, tasks, and risks
    p_res = supabase.table("projects").select("name, description, status, priority, progress").eq("id", project_id).maybe_single().execute()
    project = p_res.data or {}
    
    t_res = supabase.table("tasks").select("status, priority").eq("project_id", project_id).execute()
    tasks = t_res.data or []
    
    r_res = supabase.table("risks").select("severity, status").eq("project_id", project_id).execute()
    risks = r_res.data or []

    await log_event(project_id, "report", "tool_call", "Called tool: db.query(projects, tasks, risks)", {
        "tool": "db.query",
        "tables": ["projects", "tasks", "risks"]
    }, parent_event_id=parent_event_id)

    total_tasks = len(tasks)
    done_tasks = len([t for t in tasks if t.get("status") == "done"])
    blocked_tasks = len([t for t in tasks if t.get("status") == "blocked"])
    
    open_risks = len([r for r in risks if r.get("status") not in ["resolved", "accepted"]])
    critical_risks = len([r for r in risks if r.get("severity") == "critical"])

    summary_text = (
        f"{project.get('name', 'Project')} is {project.get('status', 'in progress')} at {project.get('progress', 0)}% completion. "
        f"{done_tasks} of {total_tasks} tasks are complete, with {blocked_tasks} currently blocked. "
        f"There are {open_risks} open risks ({critical_risks} critical)."
    )

    recs = []
    if blocked_tasks > 0:
        recs.append(f"Unblock {blocked_tasks} stalled task(s) to restore progress.")
    if critical_risks > 0:
        recs.append(f"Address {critical_risks} critical risk(s) immediately.")
    if len(recs) == 0:
        recs.append("Project is on track. Continue current operations.")

    content = {
        "project": project.get("name"),
        "status": project.get("status"),
        "progress": project.get("progress"),
        "summary": summary_text,
        "taskStats": {"total": total_tasks, "done": done_tasks, "blocked": blocked_tasks},
        "riskStats": {"total": len(risks), "open": open_risks, "critical": critical_risks},
        "health": "on_track" if blocked_tasks < total_tasks * 0.2 and critical_risks == 0 else "at_risk",
        "recommendations": recs
    }

    title = f"Status Report — {project.get('name', 'Project')}" if report_type != "executive" else f"Executive Summary — {project.get('name', 'Project')}"

    inserted = supabase.table("reports").insert({
        "project_id": project_id,
        "type": report_type,
        "title": title,
        "content": content,
        "generated_by_agent": True
    }).execute()
    report_id = inserted.data[0].get("id") if inserted.data else None

    await log_event(project_id, "report", "tool_call", "Called tool: db.insert(reports)", {
        "tool": "db.insert",
        "table": "reports",
        "reportId": report_id
    }, parent_event_id=parent_event_id)

    await log_event(project_id, "report", "agent_end", f"Report generated — '{title}'", {
        "type": report_type,
        "health": content["health"]
    }, parent_event_id=parent_event_id)

    return {
        "agent": "report",
        "summary": f"Generated {report_type} report. Project health: {content['health']}.",
        "output": {"reportId": report_id, "content": content}
    }

# ===== Knowledge Agent =====
async def knowledge_agent(project_id: str, filename: str, content_text: str, content_type: str, parent_event_id: str) -> Dict[str, Any]:
    await log_event(project_id, "knowledge", "agent_start", f"Knowledge Agent invoked — processing '{filename}'", parent_event_id=parent_event_id)
    
    summary = ""
    keywords = []
    
    if GEMINI_API_KEY:
        try:
            prompt = (
                f"Analyze the following document text and provide: "
                f"1. A concise 2-sentence summary. "
                f"2. A JSON list of 5 to 8 key concepts/keywords. "
                f"Respond with JSON format: {{\"summary\": \"...\", \"keywords\": [\"...\"]}}. "
                f"Document text:\n{content_text[:6000]}"
            )
            res_text = call_gemini(prompt)
            clean_text = res_text.strip().replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_text)
            summary = data.get("summary", "")
            keywords = data.get("keywords", [])
        except Exception as e:
            print(f"Gemini document processing failed: {e}. Falling back to rules.")
            summary = content_text[:280] + "..." if content_text else f"Uploaded {filename}"
            keywords = ["uploaded", filename]
    else:
        summary = content_text[:280] + "..." if content_text else f"Uploaded {filename}"
        keywords = ["uploaded", filename]

    await log_event(project_id, "knowledge", "tool_call", "Called tool: vector_embed(summary)", {
        "tool": "vector_embed",
        "keywords": keywords
    }, parent_event_id=parent_event_id)

    await log_event(project_id, "knowledge", "agent_end", f"Document ingested — {len(keywords)} concepts extracted", {
        "summary": summary,
        "keywords": keywords
    }, parent_event_id=parent_event_id)

    return {
        "agent": "knowledge",
        "summary": f"Ingested '{filename}' and generated summary for RAG retrieval.",
        "output": {"summary": summary, "keywords": keywords}
    }

# ===== Chat Agent =====
async def chat_agent(project_id: str, question: str, parent_event_id: str) -> Dict[str, Any]:
    await log_event(project_id, "chat", "agent_start", f"Chat Agent invoked — question: '{question[:80]}'", parent_event_id=parent_event_id)
    
    # Retrieve project context
    p_res = supabase.table("projects").select("name, description, status, progress").eq("id", project_id).maybe_single().execute()
    project = p_res.data or {}
    
    t_res = supabase.table("tasks").select("title, status, priority").eq("project_id", project_id).limit(20).execute()
    tasks = t_res.data or []
    
    r_res = supabase.table("risks").select("title, severity, status").eq("project_id", project_id).limit(10).execute()
    risks = r_res.data or []
    
    d_res = supabase.table("documents").select("filename, summary").eq("project_id", project_id).limit(5).execute()
    docs = d_res.data or []

    await log_event(project_id, "chat", "tool_call", "Called tool: retrieve_context(project, tasks, risks, documents)", {
        "tool": "retrieve_context",
        "sources": {"tasks": len(tasks), "risks": len(risks), "documents": len(docs)}
    }, parent_event_id=parent_event_id)

    answer = ""
    if GEMINI_API_KEY:
        try:
            context = (
                f"Project Name: {project.get('name')}\n"
                f"Status: {project.get('status')} ({project.get('progress')}% done)\n"
                f"Tasks: {json.dumps(tasks)}\n"
                f"Risks: {json.dumps(risks)}\n"
                f"Documents: {json.dumps(docs)}\n"
            )
            prompt = (
                f"Answer the user's question about the project using the following context. "
                f"Keep it concise, clear, and professional. Use markdown formatting.\n\n"
                f"Context:\n{context}\n\n"
                f"Question: {question}"
            )
            res_text = call_gemini(prompt)
            answer = res_text.strip()
        except Exception as e:
            print(f"Gemini chat failed: {e}. Falling back to rules.")
            answer = synthesize_answer_rules(question, project, tasks, risks, docs)
    else:
        answer = synthesize_answer_rules(question, project, tasks, risks, docs)

    await log_event(project_id, "chat", "agent_end", "Chat Agent responded", {
        "answerLength": len(answer)
    }, parent_event_id=parent_event_id)

    return {
        "agent": "chat",
        "summary": answer,
        "output": {"answer": answer}
    }

def synthesize_answer_rules(question: str, project: Dict[str, Any], tasks: List[Dict[str, Any]], risks: List[Dict[str, Any]], docs: List[Dict[str, Any]]) -> str:
    q = question.lower()
    name = project.get("name", "this project")
    progress = project.get("progress", 0)
    status = project.get("status", "in progress")
    
    if "status" in q or "progress" in q or "update" in q:
        done = len([t for t in tasks if t.get("status") == "done"])
        return f"**{name}** is currently **{status}** at **{progress}%** completion. {done} of {len(tasks)} tasks are complete."
    elif "risk" in q or "blocker" in q:
        if len(risks) == 0:
            return "No risks have been identified yet."
        list_risks = "\n".join([f"- **{r['title']}** ({r['severity']})" for r in risks])
        return f"Here are the current risks:\n{list_risks}"
    else:
        return f"Project **{name}** is active with {len(tasks)} tasks and {len(risks)} risks. Let me know if you need specific details."

# ===== Request Route Handler =====
@app.post("/supervisor-agent")
async def supervisor_agent_endpoint(request: Request):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    action = body.get("action")
    project_id = body.get("projectId")
    payload = body.get("payload", {})

    if not action or not project_id:
        raise HTTPException(status_code=400, detail="action and projectId are required")

    # Start Orchestration Flow
    agents = supervisor_route(action)
    supervisor_id = await log_event(
        project_id=project_id,
        agent_name="supervisor",
        event_type="decision",
        message=f"Supervisor routed '{action}' → [{', '.join(agents)}]",
        details={"action": action, "agents": agents}
    )

    results = []
    events_accumulated = []

    try:
        if action in ["create_project", "plan_project"]:
            goal = payload.get("goal") or payload.get("name") or "new project"
            name = payload.get("name") or "Project"
            
            planning = await planning_agent(project_id, goal, supervisor_id)
            results.append(planning)
            
            task = await task_agent(project_id, planning["output"]["phases"], name, supervisor_id)
            results.append(task)
            
            risk = await risk_agent(project_id, supervisor_id)
            results.append(risk)
            
            report = await report_agent(project_id, "status", supervisor_id)
            results.append(report)
            
        elif action == "upload_document":
            knowledge = await knowledge_agent(
                project_id,
                payload.get("filename", ""),
                payload.get("contentText", ""),
                payload.get("contentType", ""),
                supervisor_id
            )
            results.append(knowledge)
            
        elif action in ["analyze_project", "assess_risks"]:
            risk = await risk_agent(project_id, supervisor_id)
            results.append(risk)
            
            report = await report_agent(project_id, "risk", supervisor_id)
            results.append(report)
            
        elif action in ["generate_report", "update_task"]:
            report = await report_agent(project_id, payload.get("reportType", "status"), supervisor_id)
            results.append(report)
            
        elif action == "ask_question":
            chat = await chat_agent(project_id, payload.get("question", ""), supervisor_id)
            results.append(chat)

    except Exception as e:
        await log_event(
            project_id=project_id,
            agent_name="supervisor",
            event_type="error",
            message=f"Orchestration failed: {str(e)}",
            parent_event_id=supervisor_id
        )
        raise HTTPException(status_code=500, detail=str(e))

    await log_event(
        project_id=project_id,
        agent_name="supervisor",
        event_type="complete",
        message="Supervisor orchestration complete",
        details={"agentsInvoked": agents},
        parent_event_id=supervisor_id
    )

    # Gather events for response
    events_res = supabase.table("agent_events").select("*").eq("project_id", project_id).order("created_at").execute()
    
    return {
        "success": True,
        "results": results,
        "events": events_res.data or [],
        "agents": AGENTS
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
