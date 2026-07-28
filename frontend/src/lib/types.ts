export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLikelihood = 'low' | 'medium' | 'high';
export type RiskStatus = 'identified' | 'assessed' | 'mitigating' | 'resolved' | 'accepted';
export type ReportType = 'status' | 'risk' | 'executive' | 'milestone' | 'burndown';
export type AgentName = 'supervisor' | 'planning' | 'task' | 'knowledge' | 'risk' | 'report' | 'chat';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  budget: number;
  tags: string[];
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assignee: string | null;
  due_date: string | null;
  estimated_hours: number;
  actual_hours: number;
  dependencies: string[];
  agent_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  project_id: string;
  filename: string;
  content_type: string | null;
  storage_path: string | null;
  size_bytes: number;
  summary: string | null;
  content_text: string | null;
  created_at: string;
}

export interface Risk {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  impact: RiskSeverity;
  status: RiskStatus;
  mitigation: string | null;
  owner: string | null;
  identified_date: string | null;
  resolved_date: string | null;
  agent_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  project_id: string;
  type: ReportType;
  title: string;
  content: Record<string, unknown>;
  period_start: string | null;
  period_end: string | null;
  generated_by_agent: boolean;
  created_at: string;
}

export interface AgentEvent {
  id: string;
  project_id: string | null;
  agent_name: AgentName;
  event_type: string;
  message: string;
  details: Record<string, unknown>;
  parent_event_id: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  project_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  agent_source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentMeta {
  label: string;
  role: string;
}

export interface OrchestratorResponse {
  success: boolean;
  results: { agent: AgentName; summary: string; output: Record<string, unknown> }[];
  events: { agent_name: AgentName; event_type: string; message: string; details?: Record<string, unknown> }[];
  agents: Record<AgentName, AgentMeta>;
}

export const AGENT_META: Record<AgentName, { label: string; role: string; color: string }> = {
  supervisor: { label: 'Supervisor Agent', role: 'Orchestrates all specialized agents', color: 'brand' },
  planning: { label: 'Planning Agent', role: 'Breaks down project goals into phases', color: 'accent' },
  task: { label: 'Task Agent', role: 'Generates and organizes actionable tasks', color: 'warn' },
  knowledge: { label: 'Knowledge Agent', role: 'Retrieves and summarizes documents (RAG)', color: 'brand' },
  risk: { label: 'Risk Agent', role: 'Identifies and assesses project risks', color: 'danger' },
  report: { label: 'Report Agent', role: 'Compiles status and executive reports', color: 'accent' },
  chat: { label: 'Chat Agent', role: 'Answers questions using project context', color: 'brand' },
};
