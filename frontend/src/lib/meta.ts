import type { ProjectStatus, TaskStatus, Priority, RiskSeverity, RiskStatus, ReportType } from './types';

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; badge: string; dot: string }> = {
  planning: { label: 'Planning', badge: 'bg-brand-50 text-brand-700 border border-brand-200', dot: 'bg-brand-500' },
  active: { label: 'Active', badge: 'bg-accent-50 text-accent-700 border border-accent-200', dot: 'bg-accent-500' },
  on_hold: { label: 'On Hold', badge: 'bg-warn-50 text-warn-700 border border-warn-200', dot: 'bg-warn-500' },
  completed: { label: 'Completed', badge: 'bg-ink-100 text-ink-700 border border-ink-200', dot: 'bg-ink-400' },
  cancelled: { label: 'Cancelled', badge: 'bg-danger-50 text-danger-700 border border-danger-200', dot: 'bg-danger-500' },
};

export const TASK_STATUS_META: Record<TaskStatus, { label: string; badge: string; dot: string }> = {
  todo: { label: 'To Do', badge: 'bg-ink-100 text-ink-700', dot: 'bg-ink-400' },
  in_progress: { label: 'In Progress', badge: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  review: { label: 'In Review', badge: 'bg-warn-50 text-warn-700', dot: 'bg-warn-500' },
  done: { label: 'Done', badge: 'bg-accent-50 text-accent-700', dot: 'bg-accent-500' },
  blocked: { label: 'Blocked', badge: 'bg-danger-50 text-danger-700', dot: 'bg-danger-500' },
};

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  low: { label: 'Low', badge: 'bg-ink-100 text-ink-600' },
  medium: { label: 'Medium', badge: 'bg-brand-50 text-brand-700' },
  high: { label: 'High', badge: 'bg-warn-50 text-warn-700' },
  critical: { label: 'Critical', badge: 'bg-danger-50 text-danger-700' },
};

export const RISK_SEVERITY_META: Record<RiskSeverity, { label: string; badge: string; dot: string }> = {
  low: { label: 'Low', badge: 'bg-ink-100 text-ink-600', dot: 'bg-ink-400' },
  medium: { label: 'Medium', badge: 'bg-warn-50 text-warn-700', dot: 'bg-warn-500' },
  high: { label: 'High', badge: 'bg-danger-50 text-danger-700', dot: 'bg-danger-500' },
  critical: { label: 'Critical', badge: 'bg-danger-100 text-danger-800', dot: 'bg-danger-600' },
};

export const RISK_STATUS_META: Record<RiskStatus, { label: string; badge: string }> = {
  identified: { label: 'Identified', badge: 'bg-ink-100 text-ink-700' },
  assessed: { label: 'Assessed', badge: 'bg-brand-50 text-brand-700' },
  mitigating: { label: 'Mitigating', badge: 'bg-warn-50 text-warn-700' },
  resolved: { label: 'Resolved', badge: 'bg-accent-50 text-accent-700' },
  accepted: { label: 'Accepted', badge: 'bg-ink-100 text-ink-600' },
};

export const REPORT_TYPE_META: Record<ReportType, { label: string }> = {
  status: { label: 'Status Report' },
  risk: { label: 'Risk Report' },
  executive: { label: 'Executive Summary' },
  milestone: { label: 'Milestone Report' },
  burndown: { label: 'Burndown Report' },
};

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
