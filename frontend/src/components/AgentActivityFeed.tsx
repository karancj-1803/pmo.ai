import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AGENT_META, type AgentEvent } from '@/lib/types';
import { timeAgo } from '@/lib/meta';
import { Spinner } from './ui';
import {
  Workflow, Brain, ListChecks, BookOpen, ShieldAlert, FileText, MessageSquare, ChevronRight,
} from 'lucide-react';

const AGENT_ICON: Record<string, typeof Workflow> = {
  supervisor: Workflow,
  planning: Brain,
  task: ListChecks,
  knowledge: BookOpen,
  risk: ShieldAlert,
  report: FileText,
  chat: MessageSquare,
};

const EVENT_TYPE_STYLE: Record<string, string> = {
  decision: 'text-brand-600 bg-brand-50',
  agent_start: 'text-accent-700 bg-accent-50',
  agent_end: 'text-ink-600 bg-ink-100',
  tool_call: 'text-warn-700 bg-warn-50',
  complete: 'text-brand-700 bg-brand-50',
};

export function AgentActivityFeed({ projectId, limit = 40, live = true }: { projectId: string; limit?: number; live?: boolean }) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    async function load() {
      const { data } = await supabase
        .from('agent_events')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);
      setEvents((data as AgentEvent[]) ?? []);
      setLoading(false);

      if (live) {
        channel = supabase
          .channel(`agent_events_${projectId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_events', filter: `project_id=eq.${projectId}` }, (payload) => {
            setEvents((prev) => [payload.new as AgentEvent, ...prev].slice(0, limit));
          })
          .subscribe();
      }
    }
    load();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [projectId, limit, live]);

  if (loading) {
    return <div className="flex justify-center py-10 text-ink-400"><Spinner className="w-5 h-5" /></div>;
  }
  if (events.length === 0) {
    return <p className="text-sm text-ink-400 text-center py-10">No agent activity yet. Create a project or run an agent to see the orchestration trace.</p>;
  }

  return (
    <div className="space-y-1">
      {events.map((ev, idx) => {
        const meta = AGENT_META[ev.agent_name];
        const Icon = AGENT_ICON[ev.agent_name] ?? Workflow;
        const typeStyle = EVENT_TYPE_STYLE[ev.event_type] ?? 'text-ink-600 bg-ink-100';
        return (
          <div
            key={ev.id}
            className="flex gap-3 px-3 py-2.5 rounded-lg hover:bg-ink-50/70 transition-colors animate-slideIn"
            style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
          >
            <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${typeStyle}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-ink-900">{meta?.label ?? ev.agent_name}</span>
                <span className={`badge ${typeStyle} !py-0.5`}>{ev.event_type.replace('_', ' ')}</span>
                <span className="text-xs text-ink-400">{timeAgo(ev.created_at)}</span>
              </div>
              <p className="text-sm text-ink-600 mt-0.5 leading-snug">{ev.message}</p>
              {ev.details && Object.keys(ev.details).length > 0 && (
                <details className="mt-1 group">
                  <summary className="text-xs text-ink-400 cursor-pointer flex items-center gap-1 list-none hover:text-ink-600">
                    <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" /> details
                  </summary>
                  <pre className="mt-1 text-xs text-ink-500 bg-ink-50 rounded-md p-2 overflow-x-auto font-mono">{JSON.stringify(ev.details, null, 2)}</pre>
                </details>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
