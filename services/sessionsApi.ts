import type { AnalysisSession } from '../types';
import { apiBase } from '../config/env';

async function apiRequest<T>(
  method: string,
  path: string,
  token: string | null,
  body?: unknown
): Promise<{ ok: boolean; data?: T; error?: string }> {
  if (!token) {
    return { ok: false, error: 'No auth token' };
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    return { ok: false, error: 'Unauthorized' };
  }
  if (res.status === 503) {
    return { ok: false, error: 'Supabase not configured' };
  }
  const text = await res.text();
  let data: T | undefined;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      return { ok: false, error: res.statusText };
    }
  }
  if (!res.ok) {
    return { ok: false, error: (data as { error?: string })?.error ?? res.statusText, data };
  }
  return { ok: true, data };
}

function mapRowToSession(row: Record<string, unknown>): AnalysisSession {
  return {
    id: String(row.id),
    filename: String(row.filename),
    timestamp: Number(row.timestamp),
    summary: String(row.summary),
    assumptions: Array.isArray(row.assumptions) ? row.assumptions as string[] : [],
    reasoning: String(row.reasoning ?? ''),
    experimentCode: String(row.experimentCode ?? row.experiment_code ?? ''),
    simulationData: row.simulationData ?? row.simulation_data as AnalysisSession['simulationData'],
    rawText: row.rawText ?? row.raw_text as string | undefined,
    reproducibilityScore: row.reproducibilityScore ?? row.reproducibility_score as number | undefined,
    citationIntegrity: row.citationIntegrity ?? row.citation_integrity as string | undefined
  };
}

export async function fetchSessions(token: string | null): Promise<AnalysisSession[]> {
  const result = await apiRequest<AnalysisSession[]>('GET', '/api/sessions', token);
  if (!result.ok || !result.data) return [];
  const list = Array.isArray(result.data) ? result.data : [];
  return list.map((s: Record<string, unknown>) => mapRowToSession(s));
}

export async function createSession(
  token: string | null,
  session: Omit<AnalysisSession, 'id'> & { id?: string }
): Promise<AnalysisSession | null> {
  const payload = {
    filename: session.filename,
    timestamp: session.timestamp,
    summary: session.summary,
    assumptions: session.assumptions ?? [],
    reasoning: session.reasoning ?? '',
    experimentCode: session.experimentCode ?? '',
    simulationData: session.simulationData ?? undefined,
    rawText: session.rawText ?? undefined,
    reproducibilityScore: session.reproducibilityScore ?? undefined,
    citationIntegrity: session.citationIntegrity ?? undefined
  };
  const result = await apiRequest<AnalysisSession>('POST', '/api/sessions', token, payload);
  if (!result.ok || !result.data) return null;
  return mapRowToSession(result.data as Record<string, unknown>);
}

export async function deleteSession(token: string | null, id: string): Promise<boolean> {
  const result = await apiRequest<unknown>('DELETE', `/api/sessions/${encodeURIComponent(id)}`, token);
  return result.ok;
}

export async function fetchMe(token: string | null): Promise<{ id: string; email?: string; username: string } | null> {
  const result = await apiRequest<{ id: string; email?: string; username: string }>('GET', '/api/me', token);
  if (!result.ok || !result.data) return null;
  return result.data;
}

export async function clearAllSessions(token: string | null): Promise<boolean> {
  const result = await apiRequest<unknown>('DELETE', '/api/sessions?all=1', token);
  return result.ok;
}
