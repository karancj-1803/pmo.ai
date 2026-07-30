-- 1. Add user_id column to projects table if it doesn't already exist (referencing the built-in Supabase auth.users table)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

-- 2. Map all existing/legacy projects (which currently have user_id as NULL) to the user 'chandrabosekaran@gmail.com'
-- (Note: auth.users is a built-in Supabase table located in the 'auth' schema)
UPDATE projects
SET user_id = (SELECT id FROM auth.users WHERE email = 'chandrabosekaran@gmail.com')
WHERE user_id IS NULL;

-- 3. Recreate projects RLS policies to be strictly user-scoped
DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE
  TO authenticated USING (user_id = auth.uid());


-- 4. Recreate tasks RLS policies to be strictly user-scoped
DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid()));


-- 5. Recreate documents RLS policies to be strictly user-scoped
DROP POLICY IF EXISTS "anon_select_documents" ON documents;
CREATE POLICY "anon_select_documents" ON documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
CREATE POLICY "anon_insert_documents" ON documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_update_documents" ON documents;
CREATE POLICY "anon_update_documents" ON documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_delete_documents" ON documents;
CREATE POLICY "anon_delete_documents" ON documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND projects.user_id = auth.uid()));


-- 6. Recreate risks RLS policies to be strictly user-scoped
DROP POLICY IF EXISTS "anon_select_risks" ON risks;
CREATE POLICY "anon_select_risks" ON risks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_insert_risks" ON risks;
CREATE POLICY "anon_insert_risks" ON risks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_update_risks" ON risks;
CREATE POLICY "anon_update_risks" ON risks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_delete_risks" ON risks;
CREATE POLICY "anon_delete_risks" ON risks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = risks.project_id AND projects.user_id = auth.uid()));


-- 7. Recreate reports RLS policies to be strictly user-scoped
DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND projects.user_id = auth.uid()));


-- 8. Recreate agent_events RLS policies to be strictly user-scoped
DROP POLICY IF EXISTS "anon_select_agent_events" ON agent_events;
CREATE POLICY "anon_select_agent_events" ON agent_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_insert_agent_events" ON agent_events;
CREATE POLICY "anon_insert_agent_events" ON agent_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_update_agent_events" ON agent_events;
CREATE POLICY "anon_update_agent_events" ON agent_events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_delete_agent_events" ON agent_events;
CREATE POLICY "anon_delete_agent_events" ON agent_events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = agent_events.project_id AND projects.user_id = auth.uid()));


-- 9. Recreate chat_messages RLS policies to be strictly user-scoped
DROP POLICY IF EXISTS "anon_select_chat_messages" ON chat_messages;
CREATE POLICY "anon_select_chat_messages" ON chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_insert_chat_messages" ON chat_messages;
CREATE POLICY "anon_insert_chat_messages" ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_update_chat_messages" ON chat_messages;
CREATE POLICY "anon_update_chat_messages" ON chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "anon_delete_chat_messages" ON chat_messages;
CREATE POLICY "anon_delete_chat_messages" ON chat_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND projects.user_id = auth.uid()));
