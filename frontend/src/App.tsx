import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { callSupervisor } from '@/lib/agentClient';
import {
  AGENT_META, type AgentName, type Project, type Task, type DocumentRow,
  type Risk, type Report, type ReportType, type ChatMessage,
} from '@/lib/types';
import {
  PROJECT_STATUS_META, TASK_STATUS_META, PRIORITY_META, RISK_SEVERITY_META,
  RISK_STATUS_META, REPORT_TYPE_META, formatDate, formatBytes,
} from '@/lib/meta';
import { Badge, ProgressBar, Spinner, EmptyState, Modal } from '@/components/ui';
import { AgentActivityFeed } from '@/components/AgentActivityFeed';
import { AgentThinking } from '@/components/AgentThinking';
import {
  Plus, FolderKanban, Workflow, Brain, ListChecks, BookOpen, ShieldAlert, FileText,
  MessageSquare, ArrowLeft, Upload, Sparkles, TrendingUp, AlertTriangle, CheckCircle2,
  Clock, Calendar, DollarSign, Tag, Activity, Send, RefreshCw, Trash2, FileUp, Search, Sun, Moon, LogOut
} from 'lucide-react';
import { Auth } from '@/components/Auth';


type View = { name: 'dashboard' } | { name: 'project'; id: string };

const AGENT_ICON: Record<AgentName, typeof Workflow> = {
  supervisor: Workflow, planning: Brain, task: ListChecks, knowledge: BookOpen,
  risk: ShieldAlert, report: FileText, chat: MessageSquare,
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [view, setView] = useState<View>({ name: 'dashboard' });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const loadProjects = useCallback(async () => {
    if (!session) return;
    setLoadingProjects(true);
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    setProjects((data as Project[]) ?? []);
    setLoadingProjects(false);
  }, [session]);

  useEffect(() => {
    if (session) {
      loadProjects();
    }
  }, [loadProjects, session]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-ink-50 dark:bg-ink-950">
        <Spinner className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen flex bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-50 transition-colors duration-200">
      <Sidebar
        view={view}
        setView={setView}
        projectCount={projects.length}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        userEmail={session.user?.email ?? ''}
        onSignOut={async () => {
          setSession(null); // Optimistically clear the local React state instantly!
          await supabase.auth.signOut();
        }}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        {view.name === 'dashboard' && (
          <Dashboard
            projects={projects}
            loading={loadingProjects}
            onOpen={(id) => setView({ name: 'project', id })}
            onCreate={() => setShowCreate(true)}
            onRefresh={loadProjects}
          />
        )}
        {view.name === 'project' && (
          <ProjectDetail
            projectId={view.id}
            onBack={() => { setView({ name: 'dashboard' }); loadProjects(); }}
            onCreate={() => setShowCreate(true)}
          />
        )}
      </main>
      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => { setShowCreate(false); setView({ name: 'project', id }); }}
        userId={session.user.id}
      />
    </div>
  );
}

// ===== Sidebar =====
function Sidebar({
  view, setView, projectCount, darkMode, setDarkMode, userEmail, onSignOut
}: {
  view: View; setView: (v: View) => void; projectCount: number; darkMode: boolean; setDarkMode: (d: boolean) => void; userEmail: string; onSignOut: () => void;
}) {
  return (
    <aside className="w-60 shrink-0 bg-white dark:bg-ink-950 text-ink-700 dark:text-ink-200 border-r border-ink-100 dark:border-white/5 flex flex-col h-screen sticky top-0 transition-colors duration-200">
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-ink-100 dark:border-white/5">
        <img src="/pmo-light.png" alt="PMO.AI Logo" className="w-9 h-9 object-contain block dark:hidden" />
        <img src="/pmo-dark.png" alt="PMO.AI Logo" className="w-9 h-9 object-contain hidden dark:block" />
        <div>
          <p className="text-sm font-bold text-ink-900 dark:text-white leading-tight">PMO.AI</p>
          <p className="text-[10px] text-ink-500 dark:text-ink-400 leading-tight">Agentic Platform</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <button
          onClick={() => setView({ name: 'dashboard' })}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            view.name === 'dashboard' 
              ? 'bg-brand-50 text-brand-700 dark:bg-white/10 dark:text-white' 
              : 'text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/5 hover:text-ink-900 dark:hover:text-white'
          }`}
        >
          <FolderKanban className="w-4 h-4" /> Projects
          <span className={`ml-auto text-xs ${view.name === 'dashboard' ? 'text-brand-600 dark:text-brand-400 font-semibold' : 'text-ink-400 dark:text-ink-500'}`}>
            {projectCount}
          </span>
        </button>
      </nav>

      <div className="px-3 py-4 border-t border-ink-100 dark:border-white/5">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500 mb-2">AI Agents</p>
        <div className="space-y-0.5">
          {(Object.keys(AGENT_META) as AgentName[]).map((name) => {
            const meta = AGENT_META[name];
            const Icon = AGENT_ICON[name];
            return (
              <div key={name} className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs text-ink-600 dark:text-ink-400">
                <Icon className="w-3.5 h-3.5 shrink-0 text-ink-400 dark:text-ink-500" />
                <span className="truncate">{meta.label.replace(' Agent', '')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3.5 border-t border-ink-100 dark:border-white/5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">User</p>
            <p className="text-[11px] text-ink-800 dark:text-ink-200 font-medium truncate" title={userEmail}>
              {userEmail}
            </p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-white/5 hover:text-ink-900 dark:hover:text-white transition-colors shrink-0"
            title="Toggle Light/Dark Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-warning-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-error-600 dark:text-error-400 hover:bg-error-500/5 dark:hover:bg-error-500/10 hover:text-error-700 dark:hover:text-error-300 border border-error-200 dark:border-error-500/20 hover:border-error-300 dark:hover:border-error-500/30 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Log Out
        </button>
      </div>
    </aside>
  );
}

// ===== Dashboard =====
function Dashboard({
  projects, loading, onOpen, onCreate, onRefresh,
}: {
  projects: Project[]; loading: boolean; onOpen: (id: string) => void; onCreate: () => void; onRefresh: () => void;
}) {
  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    avgProgress: projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0,
    atRisk: projects.filter((p) => p.status === 'on_hold' || p.progress < 25).length,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-10 bg-ink-50/85 dark:bg-ink-950/85 backdrop-blur-md border-b border-ink-100 dark:border-ink-800">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900 dark:text-white">Projects</h1>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">Autonomous multi-agent project management</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="btn-ghost" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={onCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<FolderKanban className="w-5 h-5" />} label="Total Projects" value={stats.total} tone="brand" />
          <StatCard icon={<Activity className="w-5 h-5" />} label="Active" value={stats.active} tone="accent" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Avg Progress" value={`${stats.avgProgress}%`} tone="brand" />
          <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Needs Attention" value={stats.atRisk} tone="warn" />
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="w-7 h-7" />}
            title="No projects yet"
            description="Create your first project and the Supervisor Agent will autonomously plan it, generate tasks, assess risks, and compile an initial report."
            action={<button onClick={onCreate} className="btn-primary"><Plus className="w-4 h-4" /> Create your first project</button>}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: 'brand' | 'accent' | 'warn' | 'danger' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400',
    accent: 'bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400',
    warn: 'bg-warn-50 text-warn-600 dark:bg-warn-950/40 dark:text-warn-400',
    danger: 'bg-danger-50 text-danger-600 dark:bg-danger-950/40 dark:text-danger-400',
  };
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-ink-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const sm = PROJECT_STATUS_META[project.status];
  return (
    <button onClick={onOpen} className="card card-hover p-5 text-left group animate-slideUp">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors truncate">{project.name}</h3>
          {project.description && <p className="text-sm text-ink-500 dark:text-ink-400 mt-1 line-clamp-2">{project.description}</p>}
        </div>
        <Badge className={sm.badge}><span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} /> {sm.label}</Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-ink-500 mb-3">
        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(project.start_date)}</span>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDate(project.target_end_date)}</span>
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar value={project.progress} className="flex-1" />
        <span className="text-xs font-semibold text-ink-700 tabular-nums">{project.progress}%</span>
      </div>
    </button>
  );
}

// ===== Create Project Modal =====
function CreateProjectModal({ open, onClose, onCreated, userId }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; userId: string }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [targetEnd, setTargetEnd] = useState('');
  const [budget, setBudget] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) { setError('Project name is required'); return; }
    setBusy(true); setError(''); setStatus(['Creating project...']);
    try {
      const startDate = new Date().toISOString().slice(0, 10);
      const { data: proj, error: pErr } = await supabase.from('projects').insert({
        name: name.trim(),
        description: description.trim() || null,
        status: 'planning',
        priority,
        start_date: startDate,
        target_end_date: targetEnd || null,
        budget: budget ? parseFloat(budget) : 0,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        user_id: userId,
      }).select('id').single();
      if (pErr || !proj) throw new Error(pErr?.message ?? 'Insert failed');
      const projectId = proj.id;

      setStatus(['Project created. Supervisor Agent orchestrating...']);
      await callSupervisor('create_project', projectId, {
        name: name.trim(),
        goal: goal.trim() || description.trim() || name.trim(),
      });

      setStatus(['Orchestration complete!']);
      onCreated(projectId);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setName(''); setDescription(''); setGoal(''); setPriority('medium'); setTargetEnd(''); setBudget(''); setTags(''); setStatus([]); setError('');
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) { onClose(); reset(); } }}
      title="Create New Project"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={() => { onClose(); reset(); }} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Orchestrating...' : 'Create & Plan'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900/30 text-sm text-brand-800 dark:text-brand-300">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
          <p>When you create a project, the <strong>Supervisor Agent</strong> autonomously invokes the Planning, Task, Risk, and Report agents to build a full project plan.</p>
        </div>
        <div>
          <label className="label">Project Name *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer Portal Redesign" disabled={busy} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" disabled={busy} />
        </div>
        <div>
          <label className="label">Project Goal (for the Planning Agent)</label>
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Build a customer-facing web portal with self-service" disabled={busy} />
          <p className="text-xs text-ink-400 mt-1">The Planning Agent uses this to decompose the project into phases.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} disabled={busy}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="label">Target End Date</label>
            <input type="date" className="input" value={targetEnd} onChange={(e) => setTargetEnd(e.target.value)} disabled={busy} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Budget ($)</label>
            <input type="number" className="input" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" disabled={busy} />
          </div>
          <div>
            <label className="label">Tags (comma-separated)</label>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="web, internal" disabled={busy} />
          </div>
        </div>
        {status.length > 0 && (
          <div className="space-y-1.5">
            {status.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-brand-700 animate-slideIn">
                <CheckCircle2 className="w-4 h-4" /> {s}
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Modal>
  );
}

// ===== Project Detail =====
type Tab = 'overview' | 'tasks' | 'documents' | 'risks' | 'reports' | 'agents' | 'chat';

function ProjectDetail({ projectId, onBack, onCreate }: { projectId: string; onBack: () => void; onCreate: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(async () => {
    const { data } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    setProject((data as Project) ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner className="w-6 h-6 text-ink-400" /></div>;
  if (!project) return (
    <div className="flex-1 flex items-center justify-center p-6">
      <EmptyState icon={<FolderKanban className="w-7 h-7" />} title="Project not found" description="This project may have been deleted." action={<button className="btn-secondary" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back to projects</button>} />
    </div>
  );

  const tabs: { id: Tab; label: string; icon: typeof Workflow }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'tasks', label: 'Tasks', icon: ListChecks },
    { id: 'documents', label: 'Documents', icon: BookOpen },
    { id: 'risks', label: 'Risks', icon: ShieldAlert },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'agents', label: 'Agent Activity', icon: Workflow },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="sticky top-0 z-10 bg-ink-50/85 dark:bg-ink-950/85 backdrop-blur-md border-b border-ink-100 dark:border-ink-800">
        <div className="max-w-6xl mx-auto px-6 pt-4 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="btn-ghost !px-2"><ArrowLeft className="w-4 h-4" /></button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-ink-900 dark:text-white truncate">{project.name}</h1>
              {project.description && <p className="text-sm text-ink-500 dark:text-ink-400 truncate">{project.description}</p>}
            </div>
            <button onClick={onCreate} className="btn-primary !py-2"><Plus className="w-4 h-4" /> New</button>
          </div>
          <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-thin">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.id 
                      ? 'border-brand-600 text-brand-700 dark:text-brand-400 dark:border-brand-500' 
                      : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200 hover:bg-ink-100/50 dark:hover:bg-ink-900/50'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {tab === 'overview' && <OverviewTab project={project} onChange={loadProject} />}
          {tab === 'tasks' && <TasksTab projectId={projectId} />}
          {tab === 'documents' && <DocumentsTab projectId={projectId} />}
          {tab === 'risks' && <RisksTab projectId={projectId} />}
          {tab === 'reports' && <ReportsTab projectId={projectId} />}
          {tab === 'agents' && <AgentsTab projectId={projectId} />}
          {tab === 'chat' && <ChatTab projectId={projectId} />}
        </div>
      </div>
    </div>
  );
}

// ===== Overview Tab =====
function OverviewTab({ project, onChange }: { project: Project; onChange: () => void }) {
  const [taskCounts, setTaskCounts] = useState({ total: 0, done: 0, inProgress: 0, todo: 0, blocked: 0 });
  const [riskCounts, setRiskCounts] = useState({ total: 0, open: 0, critical: 0 });
  const [running, setRunning] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: tasks } = await supabase.from('tasks').select('status').eq('project_id', project.id);
      const tc = { total: tasks?.length ?? 0, done: 0, inProgress: 0, todo: 0, blocked: 0 };
      (tasks ?? []).forEach((t) => { if (t.status === 'done') tc.done++; else if (t.status === 'in_progress') tc.inProgress++; else if (t.status === 'todo') tc.todo++; else if (t.status === 'blocked') tc.blocked++; });
      setTaskCounts(tc);
      const { data: risks } = await supabase.from('risks').select('severity, status').eq('project_id', project.id);
      setRiskCounts({ total: risks?.length ?? 0, open: risks?.filter((r) => r.status !== 'resolved' && r.status !== 'accepted').length ?? 0, critical: risks?.filter((r) => r.severity === 'critical').length ?? 0 });
    })();
  }, [project.id]);

  async function runAgent(action: string, label: string) {
    setRunning(true);
    try { await callSupervisor(action, project.id, {}); await onChange(); }
    catch (e) { console.error(label, e); }
    finally { setRunning(false); }
  }

  const sm = PROJECT_STATUS_META[project.status];
  const calculatedProgress = taskCounts.total > 0 ? Math.round((taskCounts.done / taskCounts.total) * 105 / 105 * 100) : 0; // standard round formula
  const displayProgress = Math.min(calculatedProgress, 100);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-ink-500 mb-2">Project Status</p>
          <Badge className={sm.badge}><span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} /> {sm.label}</Badge>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-ink-500 mb-1"><span>Progress</span><span className="font-semibold text-ink-700">{displayProgress}%</span></div>
            <ProgressBar value={displayProgress} />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-500 mb-2">Tasks</p>
          <p className="text-2xl font-bold text-ink-900">{taskCounts.total}</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <MiniStat label="Done" value={taskCounts.done} tone="accent" />
            <MiniStat label="Active" value={taskCounts.inProgress} tone="brand" />
            <MiniStat label="To Do" value={taskCounts.todo} tone="ink" />
            <MiniStat label="Blocked" value={taskCounts.blocked} tone="danger" />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-500 mb-2">Risks</p>
          <p className="text-2xl font-bold text-ink-900">{riskCounts.total}</p>
          <div className="mt-3 flex gap-4 text-xs text-ink-500">
            <span><strong className="text-ink-700">{riskCounts.open}</strong> open</span>
            <span><strong className="text-danger-600">{riskCounts.critical}</strong> critical</span>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2"><Workflow className="w-4 h-4 text-brand-600" /> Agent Actions</h3>
        <p className="text-sm text-ink-500 mb-4">Manually invoke autonomous agents to re-analyze the project.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={running} onClick={() => runAgent('analyze_project', 'analyze')}><ShieldAlert className="w-4 h-4" /> Run Risk Assessment</button>
          <button className="btn-secondary" disabled={running} onClick={() => runAgent('generate_report', 'report')}><FileText className="w-4 h-4" /> Generate Report</button>
          <button className="btn-secondary" disabled={running} onClick={() => runAgent('plan_project', 'plan')}><Brain className="w-4 h-4" /> Re-plan Project</button>
        </div>
        {running && <p className="text-sm text-brand-600 mt-3 flex items-center gap-2"><Spinner className="w-4 h-4" /> Agent is working...</p>}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-3">Project Details</h3>
        <dl className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <DetailRow icon={<Calendar className="w-4 h-4" />} label="Start Date" value={formatDate(project.start_date)} />
          <DetailRow icon={<Clock className="w-4 h-4" />} label="Target End" value={formatDate(project.target_end_date)} />
          <DetailRow icon={<DollarSign className="w-4 h-4" />} label="Budget" value={project.budget ? `$${project.budget.toLocaleString()}` : '—'} />
          <DetailRow icon={<Tag className="w-4 h-4" />} label="Tags" value={project.tags.length ? project.tags.join(', ') : '—'} />
        </dl>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: 'accent' | 'brand' | 'ink' | 'danger' }) {
  const tones = { accent: 'text-accent-700', brand: 'text-brand-700', ink: 'text-ink-600', danger: 'text-danger-700' };
  return <div><p className={`text-lg font-bold ${tones[tone]}`}>{value}</p><p className="text-[10px] text-ink-400">{label}</p></div>;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="text-ink-400">{icon}</span>
      <span className="text-ink-550">{label}</span>
      <span className="ml-auto font-medium text-ink-800 text-right">{value}</span>
    </div>
  );
}

// ===== Tasks Tab =====
function TasksTab({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dueDateFilter, setDueDateFilter] = useState<string>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    // Fetch tasks
    const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
    setTasks((data as Task[]) ?? []);
    if (!silent) setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: Task['status']) {
    // Optimistic local state update for buttery performance!
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    try {
      await supabase.from('tasks').update({ status }).eq('id', id);
      await supabase.rpc('recompute_project_progress', { p_project_id: projectId });
      load(true);
    } catch (e) {
      console.error(e);
      load();
    }
  }

  // Calculate project progress dynamically from tasks
  const projectProgress = tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0;

  // Get unique agents dynamically
  const uniqueAgents = Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean))) as string[];

  // Filtering Logic
  const filteredTasks = tasks.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchDesc) return false;
    }
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (agentFilter !== 'all' && t.assignee !== agentFilter) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === 'todo' && t.status !== 'todo' && t.status !== 'blocked') return false;
      if (statusFilter === 'in_progress' && t.status !== 'in_progress') return false;
      if (statusFilter === 'review' && t.status !== 'review') return false;
      if (statusFilter === 'done' && t.status !== 'done') return false;
    }
    if (dueDateFilter !== 'all') {
      const today = new Date().toISOString().slice(0, 10);
      if (dueDateFilter === 'overdue') {
        if (!t.due_date || t.due_date >= today || t.status === 'done') return false;
      } else if (dueDateFilter === 'today') {
        if (t.due_date !== today) return false;
      } else if (dueDateFilter === 'this_week') {
        if (!t.due_date) return false;
        const taskDate = new Date(t.due_date);
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);
        if (taskDate < now || taskDate > nextWeek) return false;
      } else if (dueDateFilter === 'none') {
        if (t.due_date) return false;
      }
    }
    return true;
  });

  // Rollups
  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const remainingCount = tasks.filter((t) => t.status !== 'done').length;
  const blockedCount = tasks.filter((t) => t.status === 'blocked').length;

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDraggedOverColumn(colId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    let newStatus: Task['status'] = 'todo';
    if (colId === 'in_progress') newStatus = 'in_progress';
    else if (colId === 'review') newStatus = 'review';
    else if (colId === 'done') newStatus = 'done';
    
    // Save to Supabase and update state
    await updateStatus(id, newStatus);
  };

  const columns = [
    { id: 'todo', title: 'To Do', statuses: ['todo', 'blocked'] },
    { id: 'in_progress', title: 'In Progress', statuses: ['in_progress'] },
    { id: 'review', title: 'Review', statuses: ['review'] },
    { id: 'done', title: 'Completed', statuses: ['done'] }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Kanban Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Project Progress */}
        <div className="card p-4 flex flex-col justify-between">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500 dark:text-ink-400">Project Progress</p>
            <p className="text-xl font-bold text-ink-900 dark:text-white mt-1">{projectProgress}%</p>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-[9px] text-ink-400 dark:text-ink-550 mb-0.5">
              <span>Overall Completion</span>
            </div>
            <ProgressBar value={projectProgress} />
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="card p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500 dark:text-ink-400">Completed Tasks</p>
          <p className="text-2xl font-bold text-accent-600 dark:text-accent-400 mt-2">{completedCount}</p>
          <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-1">Ready for production</p>
        </div>

        {/* Remaining Tasks */}
        <div className="card p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500 dark:text-ink-400">Remaining Tasks</p>
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-2">{remainingCount}</p>
          <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-1">In active development</p>
        </div>

        {/* Blocked Tasks */}
        <div className="card p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-ink-500 dark:text-ink-400">Blocked Tasks</p>
          <p className={`text-2xl font-bold mt-2 ${blockedCount > 0 ? 'text-danger-600 dark:text-danger-400 animate-pulse' : 'text-ink-600 dark:text-ink-400'}`}>
            {blockedCount}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-ink-550 mt-1">Requires attention</p>
        </div>
      </div>

      {/* Filtering & Search Header */}
      <div className="card p-4 bg-white/40 dark:bg-ink-900/20 backdrop-blur-md flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-3 w-4 h-4 text-ink-400 dark:text-ink-550" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5 w-full md:w-auto items-center justify-end">
          {/* Priority */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500 mb-1">Priority</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs font-semibold rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-700 dark:text-ink-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Assigned Agent */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500 mb-1">Assigned Agent</span>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="text-xs font-semibold rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-700 dark:text-ink-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 max-w-[130px] truncate"
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map((agent) => (
                <option key={agent} value={agent}>{agent.replace(' Agent', '')}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500 mb-1">Column Filter</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-700 dark:text-ink-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="all">All Columns</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Completed</option>
            </select>
          </div>

          {/* Due Date */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500 mb-1">Due Date</span>
            <select
              value={dueDateFilter}
              onChange={(e) => setDueDateFilter(e.target.value)}
              className="text-xs font-semibold rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-700 dark:text-ink-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value="all">All Dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="this_week">Due This Week</option>
              <option value="none">No Due Date</option>
            </select>
          </div>

          {/* Reset button */}
          {(searchQuery || priorityFilter !== 'all' || agentFilter !== 'all' || statusFilter !== 'all' || dueDateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPriorityFilter('all');
                setAgentFilter('all');
                setStatusFilter('all');
                setDueDateFilter('all');
              }}
              className="btn bg-ink-200 hover:bg-ink-300 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200 !py-2 !px-3 mt-4 text-xs font-bold"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board columns wrapper */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="card p-4 space-y-3 bg-ink-50/50 dark:bg-ink-950/20">
              <div className="skeleton h-6 w-1/3 rounded" />
              <div className="skeleton h-28 rounded-xl" />
              <div className="skeleton h-28 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns
            .filter((c) => statusFilter === 'all' || c.id === statusFilter)
            .map((c) => {
              const colTasks = filteredTasks.filter((t) => c.statuses.includes(t.status));
              const isOver = draggedOverColumn === c.id;

              return (
                <div
                  key={c.id}
                  onDragOver={(e) => handleDragOver(e, c.id)}
                  onDragEnter={(e) => handleDragEnter(e, c.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, c.id)}
                  className={`card p-4 flex flex-col min-h-[500px] transition-all duration-300 ${
                    isOver 
                      ? 'border-brand-500 bg-brand-50/10 dark:bg-brand-950/10 shadow-glow/10 scale-[1.01]' 
                      : 'bg-white/40 dark:bg-ink-900/10 border-ink-100 dark:border-ink-800/40'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-ink-50 dark:border-white/5">
                    <h3 className="font-bold text-ink-900 dark:text-white text-sm flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        c.id === 'todo' 
                          ? 'bg-ink-400' 
                          : c.id === 'in_progress' 
                            ? 'bg-brand-500 animate-pulse' 
                            : c.id === 'review' 
                              ? 'bg-warning-500' 
                              : 'bg-accent-500'
                      }`} />
                      {c.title}
                    </h3>
                    <span className="text-[10px] font-bold text-ink-400 dark:text-ink-500 bg-ink-50 dark:bg-ink-900/60 px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Tasks Container */}
                  <div className="flex-1 space-y-3">
                    {colTasks.length === 0 ? (
                      <div className="text-center py-8 text-xs text-ink-400 dark:text-ink-550 border border-dashed border-ink-100 dark:border-ink-800/40 rounded-xl">
                        No tasks
                      </div>
                    ) : (
                      colTasks.map((t) => (
                        <KanbanCard
                          key={t.id}
                          task={t}
                          onStatusChange={(s) => updateStatus(t.id, s)}
                          onDragStart={(e) => handleDragStart(e, t.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function KanbanCard({ task, onStatusChange, onDragStart }: { task: Task; onStatusChange: (s: Task['status']) => void; onDragStart: (e: React.DragEvent) => void }) {
  const pm = PRIORITY_META[task.priority];
  
  // Parse phase prefix and actual title
  const parts = task.title.split(':');
  const tag = parts.length > 1 ? parts[0].trim() : '';
  const displayTitle = parts.length > 1 ? parts.slice(1).join(':').trim() : task.title;

  // Convert estimated hours to days
  const estDays = Math.ceil(task.estimated_hours / 8);
  const durationText = estDays > 0 ? `${estDays} Day${estDays > 1 ? 's' : ''}` : '';

  // Progress mapping
  const progressMap: Record<Task['status'], number> = {
    todo: 0,
    blocked: 15,
    in_progress: 45,
    review: 80,
    done: 100
  };
  const cardProgress = progressMap[task.status];

  // Overdue check
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'done';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`card p-4 bg-white/70 dark:bg-ink-900/40 backdrop-blur-md border border-ink-100 dark:border-ink-800/80 shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-300 relative group select-none ${
        task.status === 'blocked' ? 'border-danger-300 dark:border-danger-900/60 bg-danger-50/20 dark:bg-danger-950/10' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {tag && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded">
            {tag}
          </span>
        )}
        <select
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value as Task['status'])}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] font-semibold rounded-md border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-700 dark:text-ink-300 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500/30 cursor-pointer"
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Completed</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <h4 className="font-semibold text-ink-900 dark:text-white text-sm leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors mb-2">
        {displayTitle}
      </h4>

      {task.description && (
        <p className="text-xs text-ink-500 dark:text-ink-400 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Progress bar inside card */}
      <div className="mb-3">
        <div className="flex justify-between text-[9px] text-ink-400 dark:text-ink-550 mb-1">
          <span>Progress</span>
          <span>{cardProgress}%</span>
        </div>
        <div className="w-full bg-ink-100 dark:bg-ink-800/80 rounded-full h-1">
          <div 
            className={`h-1 rounded-full transition-all duration-500 ${
              task.status === 'blocked' 
                ? 'bg-danger-500' 
                : task.status === 'done' 
                  ? 'bg-accent-500' 
                  : 'bg-brand-500'
            }`} 
            style={{ width: `${cardProgress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-2 pt-2 border-t border-ink-50 dark:border-white/5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`${pm.badge} text-[10px] px-1.5 py-0.5`}>
            {pm.label}
          </Badge>
          
          {task.assignee && (
            <Badge className="bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400 text-[10px] px-1.5 py-0.5 flex items-center gap-1">
              <Brain className="w-2.5 h-2.5 shrink-0" />
              {task.assignee.replace(' Agent', '')}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-ink-400 dark:text-ink-550">
          {durationText && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {durationText}
            </span>
          )}
          {task.due_date && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-danger-600 dark:text-danger-400 font-medium' : ''}`}>
              <Calendar className="w-3 h-3" /> {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Documents Tab =====
function DocumentsTab({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    setDocs((data as DocumentRow[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleFiles(files: FileList) {
    setUploading(true); setError('');
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        const { error: dErr } = await supabase.from('documents').insert({
          project_id: projectId,
          filename: file.name,
          content_type: file.type,
          size_bytes: file.size,
          content_text: text.slice(0, 50000),
          summary: null,
        });
        if (dErr) throw dErr;
        const { data: doc } = await supabase.from('documents').select('id').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        await callSupervisor('upload_document', projectId, {
          filename: file.name,
          contentText: text.slice(0, 50000),
          contentType: file.type,
          documentId: doc?.id,
        });
        // Update summary from agent result
        const { data: updated } = await supabase.from('documents').select('summary').eq('id', doc?.id).maybeSingle();
        if (updated?.summary === null) {
          // Agent stored summary in event; fetch latest knowledge event
          const { data: ev } = await supabase.from('agent_events').select('details').eq('project_id', projectId).eq('agent_name', 'knowledge').order('created_at', { ascending: false }).limit(1).maybeSingle();
          const summary = (ev?.details as Record<string, unknown>)?.summary as string | undefined;
          if (summary) await supabase.from('documents').update({ summary }).eq('id', doc?.id);
        }
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(id: string) {
    await supabase.from('documents').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        className={`card p-8 border-2 border-dashed text-center transition-colors ${dragOver ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-950/20' : 'border-ink-200 dark:border-ink-800'}`}
      >
        <FileUp className="w-8 h-8 mx-auto text-ink-400 mb-2" />
        <p className="text-sm font-medium text-ink-700">{uploading ? 'Processing...' : 'Drop documents here or'}</p>
        <label className="btn-secondary mt-3 cursor-pointer">
          <Upload className="w-4 h-4" /> Choose Files
          <input type="file" multiple className="hidden" onChange={(e) => e.target.files?.length && handleFiles(e.target.files)} disabled={uploading} />
        </label>
        <p className="text-xs text-ink-400 mt-2">The Knowledge Agent will ingest and summarize each document (RAG).</p>
        {uploading && <p className="text-sm text-brand-600 mt-3 flex items-center justify-center gap-2"><Spinner className="w-4 h-4" /> Knowledge Agent processing...</p>}
        {error && <p className="text-sm text-danger-600 mt-3">{error}</p>}
      </div>

      {loading ? (
        <div className="space-y-2">{[0,1].map((i) => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
      ) : docs.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-7 h-7" />} title="No documents" description="Upload documents and the Knowledge Agent will extract key concepts and generate summaries for retrieval." />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="card p-4 flex items-start gap-3 animate-slideUp">
              <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-ink-900 dark:text-white truncate">{d.filename}</h4>
                <p className="text-xs text-ink-400 dark:text-ink-500">{formatBytes(d.size_bytes)} · {formatDate(d.created_at)}</p>
                {d.summary && <p className="text-sm text-ink-600 dark:text-ink-300 mt-1.5 line-clamp-2">{d.summary}</p>}
              </div>
              <button onClick={() => removeDoc(d.id)} className="btn-ghost !px-2 !py-1.5 text-ink-400 hover:text-danger-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Risks Tab =====
function RisksTab({ projectId }: { projectId: string }) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('risks').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    setRisks((data as Risk[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function runRiskAgent() {
    setRunning(true);
    try { await callSupervisor('assess_risks', projectId, {}); load(); }
    catch (e) { console.error(e); }
    finally { setRunning(false); }
  }

  async function updateStatus(id: string, status: Risk['status']) {
    await supabase.from('risks').update({ status, resolved_date: status === 'resolved' ? new Date().toISOString().slice(0, 10) : null }).eq('id', id);
    load();
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex justify-between items-center">
        <p className="text-sm text-ink-500">{risks.length} risks on the register</p>
        <button className="btn-secondary" onClick={runRiskAgent} disabled={running}>
          {running ? <Spinner /> : <ShieldAlert className="w-4 h-4" />} {running ? 'Assessing...' : 'Run Risk Agent'}
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div>
      ) : risks.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="w-7 h-7" />} title="No risks identified" description="Run the Risk Agent to autonomously scan for project risks and propose mitigation strategies." action={<button className="btn-primary" onClick={runRiskAgent} disabled={running}><ShieldAlert className="w-4 h-4" /> Run Risk Agent</button>} />
      ) : (
        <div className="space-y-2">
          {risks.map((r) => {
            const sm = RISK_SEVERITY_META[r.severity];
            const rsm = RISK_STATUS_META[r.status];
            return (
              <div key={r.id} className="card p-4 animate-slideUp">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${sm.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-ink-900 dark:text-white">{r.title}</h4>
                      {r.agent_generated && <Badge className="bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"><Sparkles className="w-3 h-3" /> AI</Badge>}
                      <Badge className={sm.badge}>{sm.label}</Badge>
                      <Badge className={rsm.badge}>{rsm.label}</Badge>
                    </div>
                    {r.description && <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">{r.description}</p>}
                    {r.mitigation && <p className="text-sm text-ink-600 dark:text-ink-300 mt-2 bg-accent-50/10 dark:bg-accent-900/10 rounded-md p-2 border border-accent-100/20 dark:border-accent-800/30"><strong className="text-accent-700 dark:text-accent-400">Mitigation:</strong> {r.mitigation}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-ink-400 dark:text-ink-500">
                      <span>Likelihood: {r.likelihood}</span><span>Impact: {r.impact}</span>
                      {r.owner && <span>Owner: {r.owner}</span>}
                    </div>
                  </div>
                  <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value as Risk['status'])}
                    className="text-xs font-semibold rounded-md border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500/30 cursor-pointer">
                    <option value="identified">Identified</option>
                    <option value="assessed">Assessed</option>
                    <option value="mitigating">Mitigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="accepted">Accepted</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== Reports Tab =====
function ReportsTab({ projectId }: { projectId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('reports').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    setReports((data as Report[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function generate(type: ReportType) {
    setRunning(true);
    try { await callSupervisor('generate_report', projectId, { reportType: type }); load(); }
    catch (e) { console.error(e); }
    finally { setRunning(false); }
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={running} onClick={() => generate('status')}><FileText className="w-4 h-4" /> Status Report</button>
        <button className="btn-secondary" disabled={running} onClick={() => generate('executive')}><FileText className="w-4 h-4" /> Executive Summary</button>
        <button className="btn-secondary" disabled={running} onClick={() => generate('risk')}><ShieldAlert className="w-4 h-4" /> Risk Report</button>
        {running && <span className="text-sm text-brand-600 flex items-center gap-2"><Spinner className="w-4 h-4" /> Report Agent generating...</span>}
      </div>
      {loading ? (
        <div className="space-y-2">{[0,1].map((i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div>
      ) : reports.length === 0 ? (
        <EmptyState icon={<FileText className="w-7 h-7" />} title="No reports" description="Generate a report and the Report Agent will compile current project status, task stats, and recommendations." />
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const tm = REPORT_TYPE_META[r.type];
            return (
              <button key={r.id} onClick={() => setSelected(r)} className="card card-hover p-4 w-full text-left flex items-center gap-3 animate-slideUp">
                <div className="w-10 h-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-ink-900 dark:text-white truncate">{r.title}</h4>
                  <p className="text-xs text-ink-400 dark:text-ink-500">{tm.label} · {formatDate(r.created_at)}</p>
                </div>
                <Badge className="bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-400"><Sparkles className="w-3 h-3" /> AI</Badge>
              </button>
            );
          })}
        </div>
      )}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ''} size="lg">
        {selected && <ReportContent report={selected} />}
      </Modal>
    </div>
  );
}

function ReportContent({ report }: { report: Report }) {
  const c = report.content as Record<string, unknown>;
  const taskStats = c.taskStats as Record<string, number> | undefined;
  const riskStats = c.riskStats as Record<string, number> | undefined;
  const recs = c.recommendations as string[] | undefined;
  const health = c.health as string | undefined;
  return (
    <div className="space-y-4 text-sm">
      <div className={`p-3 rounded-lg ${health === 'on_track' ? 'bg-accent-50 dark:bg-accent-950/20 text-accent-800 dark:text-accent-400' : 'bg-warn-50 dark:bg-warn-950/20 text-warn-800 dark:text-warn-400'}`}>
        <strong>Project Health: {health === 'on_track' ? 'On Track' : 'At Risk'}</strong>
      </div>
      <p className="text-ink-700 leading-relaxed">{c.summary as string}</p>
      {taskStats && (
        <div>
          <h4 className="font-semibold text-ink-900 mb-2">Task Statistics</h4>
          <div className="grid grid-cols-5 gap-2 text-center">
            <ReportStat label="Total" value={taskStats.total} />
            <ReportStat label="Done" value={taskStats.done} />
            <ReportStat label="In Progress" value={taskStats.inProgress} />
            <ReportStat label="To Do" value={taskStats.todo} />
            <ReportStat label="Blocked" value={taskStats.blocked} />
          </div>
        </div>
      )}
      {riskStats && (
        <div>
          <h4 className="font-semibold text-ink-900 mb-2">Risk Statistics</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            <ReportStat label="Total" value={riskStats.total} />
            <ReportStat label="Open" value={riskStats.open} />
            <ReportStat label="Critical" value={riskStats.critical} />
          </div>
        </div>
      )}
      {recs && recs.length > 0 && (
        <div>
          <h4 className="font-semibold text-ink-900 mb-2">Recommendations</h4>
          <ul className="space-y-1.5">
            {recs.map((r, i) => <li key={i} className="flex gap-2 text-ink-700"><CheckCircle2 className="w-4 h-4 mt-0.5 text-accent-500 shrink-0" /> {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: number }) {
  return <div className="bg-ink-50 rounded-lg p-2"><p className="text-lg font-bold text-ink-900">{value}</p><p className="text-[10px] text-ink-500">{label}</p></div>;
}

// ===== Agents Tab =====
function AgentsTab({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="card p-5 bg-white/60 dark:bg-ink-900/40 backdrop-blur-md border border-white/50 dark:border-ink-800/60 shadow-glow">
        <h3 className="font-semibold text-ink-900 dark:text-white mb-1 flex items-center gap-2">
          <Brain className="w-4.5 h-4.5 text-brand-600 animate-pulse" /> Agent Thinking
        </h3>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
          High-level execution summary showing the business objectives, inputs, actions, and outputs of each agent in execution order.
        </p>
        <AgentThinking projectId={projectId} />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-1 flex items-center gap-2">
          <Activity className="w-4.5 h-4.5 text-brand-600" /> Live Orchestration Trace
        </h3>
        <p className="text-sm text-ink-500 mb-4">Event-driven log of agent decisions, tool calls, and database updates.</p>
        <AgentActivityFeed projectId={projectId} limit={60} />
      </div>
    </div>
  );
}

// ===== Helper: Pure React Markdown Renderer =====
function renderMarkdown(text: string, textColor = 'text-ink-800') {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const parseInline = (str: string): React.ReactNode[] => {
    const parts = str.split('**');
    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        return <strong key={idx} className="font-semibold text-ink-950 dark:text-white">{part}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);

    if (olMatch) {
      if (listType !== 'ol') {
        if (inList) {
          // If previous was list and not ol, it must be ul
          elements.push(<ul key={`ul-${lineIdx}`} className="list-disc pl-5 my-2 space-y-1.5">{listItems}</ul>);
        }
        inList = true;
        listItems = [];
        listType = 'ol';
      }
      listItems.push(<li key={`li-${lineIdx}`} className={`text-sm ${textColor}`}>{parseInline(olMatch[2])}</li>);
    } else if (ulMatch) {
      if (listType !== 'ul') {
        if (inList) {
          // If previous was list and not ul, it must be ol
          elements.push(<ol key={`ol-${lineIdx}`} className="list-decimal pl-5 my-2 space-y-1.5">{listItems}</ol>);
        }
        inList = true;
        listItems = [];
        listType = 'ul';
      }
      listItems.push(<li key={`li-${lineIdx}`} className={`text-sm ${textColor}`}>{parseInline(ulMatch[1])}</li>);
    } else {
      if (inList) {
        elements.push(listType === 'ul' 
          ? <ul key={`ul-${lineIdx}`} className="list-disc pl-5 my-2 space-y-1.5">{listItems}</ul> 
          : <ol key={`ol-${lineIdx}`} className="list-decimal pl-5 my-2 space-y-1.5">{listItems}</ol>
        );
        inList = false;
        listType = null;
        listItems = [];
      }
      if (trimmed.length > 0) {
        elements.push(<p key={lineIdx} className={`mb-2 last:mb-0 text-sm ${textColor} leading-relaxed`}>{parseInline(line)}</p>);
      } else {
        elements.push(<div key={lineIdx} className="h-2" />);
      }
    }
  });

  if (inList) {
    elements.push(listType === 'ul' 
      ? <ul key="ul-end" className="list-disc pl-5 my-2 space-y-1.5">{listItems}</ul> 
      : <ol key="ol-end" className="list-decimal pl-5 my-2 space-y-1.5">{listItems}</ol>
    );
  }

  return <>{elements}</>;
}

// ===== Helper: Typing Animation Component =====
function TypedText({ text, speed = 15, textColor = 'text-ink-800' }: { text: string; speed?: number; textColor?: string }) {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    const words = text.split(' ');
    let index = 0;
    setDisplayedText('');
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + (index === 0 ? '' : ' ') + words[index]);
      index++;
      if (index >= words.length) {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return <div className="space-y-2">{renderMarkdown(displayedText, textColor)}</div>;
}

// ===== Helper: Thinking / Searching Loader Bubble =====
function ThinkingBubble() {
  const [step, setStep] = useState(0);
  const steps = [
    { text: 'Supervisor routing request...', icon: <Workflow className="w-4 h-4 text-brand-600 animate-spin" /> },
    { text: 'Chat Agent searching requirements & knowledge base...', icon: <Search className="w-4 h-4 text-accent-600 animate-pulse" /> },
    { text: 'Fetching document content context...', icon: <BookOpen className="w-4 h-4 text-brand-600" /> },
    { text: 'Gemini reasoning & generating response...', icon: <Sparkles className="w-4 h-4 text-warning-500 animate-bounce" /> }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const current = steps[step];

  return (
    <div className="flex gap-3 animate-slideUp">
      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-brand-50 border border-brand-100 shadow-sm text-brand-600">
        <Sparkles className="w-4 h-4 text-brand-600 animate-pulse" />
      </div>
      <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-brand-50/30 border border-brand-100/50 shadow-sm flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-brand-100 shadow-xs shrink-0">
          {current.icon}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink-700 animate-pulse">{current.text}</p>
          <div className="flex gap-1 items-center pl-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Chat Tab =====
function ChatTab({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
    setMessages((data as ChatMessage[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  async function send() {
    if (!input.trim() || busy) return;
    const question = input.trim();
    setInput('');
    const userMsg: ChatMessage = { id: 'temp-' + Date.now(), project_id: projectId, role: 'user', content: question, agent_source: null, metadata: {}, created_at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      await supabase.from('chat_messages').insert({ project_id: projectId, role: 'user', content: question });
      const res = await callSupervisor('ask_question', projectId, { question });
      const answer = res.results.find((r) => r.agent === 'chat')?.summary ?? 'I could not process that request.';
      await supabase.from('chat_messages').insert({ project_id: projectId, role: 'assistant', content: answer, agent_source: 'chat' });
      setMessages((m) => [...m, { id: 'a-' + Date.now(), project_id: projectId, role: 'assistant', content: answer, agent_source: 'chat', metadata: { isNew: true }, created_at: new Date().toISOString() }]);
    } catch (e) {
      setMessages((m) => [...m, { id: 'e-' + Date.now(), project_id: projectId, role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'unknown'}`, agent_source: 'chat', metadata: {}, created_at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = ['What is the project status?', 'What risks exist?', 'How many tasks are done?', 'Summarize the documents'];

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] animate-fadeIn">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner className="w-5 h-5 text-ink-400" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3"><MessageSquare className="w-7 h-7" /></div>
            <h3 className="font-semibold text-ink-900 mb-1">Chat with the AI</h3>
            <p className="text-sm text-ink-500 mb-4">The Chat Agent answers using your project context (tasks, risks, documents).</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s) => <button key={s} onClick={() => setInput(s)} className="btn-secondary !py-1.5 text-xs">{s}</button>)}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => <ChatBubble key={m.id} message={m} />)}
            {busy && <ThinkingBubble />}
          </>
        )}
      </div>
      <div className="pt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about the project..."
          className="input resize-none min-h-[44px] max-h-32 flex-1"
          disabled={busy}
        />
        <button onClick={send} className="btn-primary !py-2.5" disabled={busy || !input.trim()}>
          {busy ? <Spinner /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isNewAssistant = !isUser && message.metadata?.isNew;
  const textColor = isUser ? 'text-white' : 'text-ink-800';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-slideUp`}>
      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${isUser ? 'bg-ink-200 text-ink-600 border border-ink-300/40 shadow-sm' : 'bg-brand-600 text-white shadow-sm'}`}>
        {isUser ? <span className="text-xs font-bold dark:text-slate-700">You</span> : <MessageSquare className="w-4 h-4" />}
      </div>
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-brand-600 text-white shadow-md' 
          : 'bg-white dark:bg-ink-900/50 border border-ink-100 dark:border-ink-800/80 text-ink-800 dark:text-ink-200 shadow-sm hover:border-ink-200 dark:hover:border-ink-700 transition-all duration-300'
      }`}>
        {isNewAssistant ? (
          <TypedText text={message.content} textColor={textColor} />
        ) : (
          <div className="space-y-2">{renderMarkdown(message.content, textColor)}</div>
        )}
      </div>
    </div>
  );
}
