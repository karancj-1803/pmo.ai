import { EDGE_FUNCTION_URL, supabase } from './supabase';
import type { OrchestratorResponse } from './types';

export async function callSupervisor(
  action: string,
  projectId: string,
  payload: Record<string, unknown> = {},
): Promise<OrchestratorResponse> {
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session?.session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  };
  if (accessToken) headers['x-user-token'] = accessToken;

  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, projectId, payload }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supervisor request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as OrchestratorResponse;
  if (!json.success) throw new Error('Supervisor returned unsuccessful response');
  return json;
}
