-- ===== Add user_id to projects =====
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- ===== Recreate projects policies =====
DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT
  TO anon, authenticated USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT
  TO anon, authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE
  TO anon, authenticated USING (user_id IS NULL OR user_id = auth.uid()) WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE
  TO anon, authenticated USING (user_id IS NULL OR user_id = auth.uid());


-- ===== Recreate tasks policies =====
DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));


-- ===== Recreate documents policies =====
DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));


-- ===== Recreate risks policies =====
DROP POLICY IF EXISTS "anon_select_risks" ON risks;
CREATE POLICY "anon_select_risks" ON risks FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_insert_risks" ON risks;
CREATE POLICY "anon_insert_risks" ON risks FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_update_risks" ON risks;
CREATE POLICY "anon_update_risks" ON risks FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_delete_risks" ON risks;
CREATE POLICY "anon_delete_risks" ON risks FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));


-- ===== Recreate reports policies =====
DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));


-- ===== Recreate agent_events policies =====
DROP POLICY IF EXISTS "anon_select_agent_events" ON agent_events;
CREATE POLICY "anon_select_agent_events" ON agent_events FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_insert_agent_events" ON agent_events;
CREATE POLICY "anon_insert_agent_events" ON agent_events FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_update_agent_events" ON agent_events;
CREATE POLICY "anon_update_agent_events" ON agent_events FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_delete_agent_events" ON agent_events;
CREATE POLICY "anon_delete_agent_events" ON agent_events FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));


-- ===== Recreate chat_messages policies =====
DROP POLICY IF EXISTS "anon_select_chat_messages" ON chat_messages;
CREATE POLICY "anon_select_chat_messages" ON chat_messages FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_insert_chat_messages" ON chat_messages;
CREATE POLICY "anon_insert_chat_messages" ON chat_messages FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_update_chat_messages" ON chat_messages;
CREATE POLICY "anon_update_chat_messages" ON chat_messages FOR UPDATE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));

DROP POLICY IF EXISTS "anon_delete_chat_messages" ON chat_messages;
CREATE POLICY "anon_delete_chat_messages" ON chat_messages FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND (projects.user_id IS NULL OR projects.user_id = auth.uid())));
