/*
# Smart Project Manager AI — Core Schema

## Overview
Creates the full data model for an autonomous multi-agent project management platform.
A Supervisor Agent orchestrates specialized agents (Planning, Task, Knowledge, Risk, Report, Chat)
that read and write to these tables as they autonomously plan, organize, monitor, analyze, and assist.

Single-tenant demo app (no sign-in screen): policies open to anon + authenticated, data intentionally shared.

## New Tables
1. `projects` — top-level project container (name, description, status, priority, dates, budget, tags, progress)
2. `tasks` — work items generated/managed by the Task Agent (title, status, priority, assignee, due_date, hours, dependencies, agent_generated)
3. `documents` — uploaded knowledge artifacts for the Knowledge Agent / RAG source (filename, content_type, summary, content_text)
4. `risks` — risk register entries produced by the Risk Agent (title, severity, likelihood, impact, status, mitigation, owner)
5. `reports` — generated project reports from the Report Agent (type, title, content jsonb, period)
6. `agent_events` — event-driven orchestration trace (agent_name, event_type, message, details, parent_event_id)
7. `chat_messages` — conversation history with the Chat Agent (role, content, agent_source, metadata)

## Security
- RLS enabled on every table.
- All tables open to anon + authenticated (single-tenant, intentionally shared demo data).
- 4 CRUD policies per table (select/insert/update/delete) — no FOR ALL.

## Notes
1. `progress` on projects is maintained by the Task Agent as a rollup of task completion.
2. `agent_events` captures the LangGraph-style orchestration trace.
3. `documents.content_text` stores extracted text for the Knowledge Agent's retrieval step.
*/

-- ===== projects =====
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  start_date date,
  target_end_date date,
  actual_end_date date,
  budget numeric(12,2) DEFAULT 0,
  tags text[] DEFAULT '{}',
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE
  TO anon, authenticated USING (true);

-- ===== tasks =====
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','review','done','blocked')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  assignee text,
  due_date date,
  estimated_hours numeric(6,2) DEFAULT 0,
  actual_hours numeric(6,2) DEFAULT 0,
  dependencies text[] DEFAULT '{}',
  agent_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE
  TO anon, authenticated USING (true);

-- ===== documents =====
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text,
  storage_path text,
  size_bytes bigint DEFAULT 0,
  summary text,
  content_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE
  TO anon, authenticated USING (true);

-- ===== risks =====
CREATE TABLE IF NOT EXISTS risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  likelihood text NOT NULL DEFAULT 'medium'
    CHECK (likelihood IN ('low','medium','high')),
  impact text NOT NULL DEFAULT 'medium'
    CHECK (impact IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'identified'
    CHECK (status IN ('identified','assessed','mitigating','resolved','accepted')),
  mitigation text,
  owner text,
  identified_date date DEFAULT CURRENT_DATE,
  resolved_date date,
  agent_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE risks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_risks" ON risks;
CREATE POLICY "anon_select_risks" ON risks FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_risks" ON risks;
CREATE POLICY "anon_insert_risks" ON risks FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_risks" ON risks;
CREATE POLICY "anon_update_risks" ON risks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_risks" ON risks;
CREATE POLICY "anon_delete_risks" ON risks FOR DELETE
  TO anon, authenticated USING (true);

-- ===== reports =====
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'status'
    CHECK (type IN ('status','risk','executive','milestone','burndown')),
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  period_start date,
  period_end date,
  generated_by_agent boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE
  TO anon, authenticated USING (true);

-- ===== agent_events =====
CREATE TABLE IF NOT EXISTS agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  parent_event_id uuid REFERENCES agent_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_agent_events" ON agent_events;
CREATE POLICY "anon_select_agent_events" ON agent_events FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_agent_events" ON agent_events;
CREATE POLICY "anon_insert_agent_events" ON agent_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_agent_events" ON agent_events;
CREATE POLICY "anon_update_agent_events" ON agent_events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_agent_events" ON agent_events;
CREATE POLICY "anon_delete_agent_events" ON agent_events FOR DELETE
  TO anon, authenticated USING (true);

-- ===== chat_messages =====
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  agent_source text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_chat_messages" ON chat_messages;
CREATE POLICY "anon_select_chat_messages" ON chat_messages FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_chat_messages" ON chat_messages;
CREATE POLICY "anon_insert_chat_messages" ON chat_messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_chat_messages" ON chat_messages;
CREATE POLICY "anon_update_chat_messages" ON chat_messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_chat_messages" ON chat_messages;
CREATE POLICY "anon_delete_chat_messages" ON chat_messages FOR DELETE
  TO anon, authenticated USING (true);

-- ===== indexes =====
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_project_id ON agent_events(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_created_at ON agent_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- ===== updated_at triggers =====
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_touch ON projects;
CREATE TRIGGER projects_touch BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS tasks_touch ON tasks;
CREATE TRIGGER tasks_touch BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS risks_touch ON risks;
CREATE TRIGGER risks_touch BEFORE UPDATE ON risks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ===== helper: recompute project progress from tasks =====
CREATE OR REPLACE FUNCTION recompute_project_progress(p_project_id uuid)
RETURNS integer AS $$
DECLARE
  total int;
  done int;
  pct integer;
BEGIN
  SELECT count(*) INTO total FROM tasks WHERE project_id = p_project_id;
  SELECT count(*) INTO done FROM tasks WHERE project_id = p_project_id AND status = 'done';
  IF total = 0 THEN
    pct := 0;
  ELSE
    pct := round((done::numeric / total) * 100);
  END IF;
  UPDATE projects SET progress = pct WHERE id = p_project_id;
  RETURN pct;
END;
$$ LANGUAGE plpgsql;