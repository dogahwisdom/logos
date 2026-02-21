import type { AnalysisSession } from '../types';
import { supabase } from './supabase';

function rowToSession(row: Record<string, unknown>): AnalysisSession {
  return {
    id: String(row.id),
    filename: String(row.filename),
    timestamp: Number(row.timestamp),
    summary: String(row.summary),
    assumptions: Array.isArray(row.assumptions) ? (row.assumptions as string[]) : [],
    reasoning: String(row.reasoning ?? ''),
    experimentCode: String(row.experiment_code ?? ''),
    simulationData: (row.simulation_data as AnalysisSession['simulationData']) ?? undefined,
    rawText: row.raw_text as string | undefined,
    reproducibilityScore: row.reproducibility_score as number | undefined,
    citationIntegrity: row.citation_integrity as string | undefined,
  };
}

export async function fetchSessionsFromSupabase(): Promise<AnalysisSession[]> {
  const { data, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .order('timestamp', { ascending: false });
  if (error) return [];
  return (data ?? []).map(rowToSession);
}

export async function createSessionInSupabase(
  session: Omit<AnalysisSession, 'id'> & { id?: string }
): Promise<AnalysisSession | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const row = {
    user_id: user.id,
    filename: session.filename,
    timestamp: session.timestamp,
    summary: session.summary,
    assumptions: session.assumptions ?? [],
    reasoning: session.reasoning ?? '',
    experiment_code: session.experimentCode ?? '',
    simulation_data: session.simulationData ?? null,
    raw_text: session.rawText ?? null,
    reproducibility_score: session.reproducibilityScore ?? null,
    citation_integrity: session.citationIntegrity ?? null,
  };
  const { data, error } = await supabase.from('analysis_sessions').insert(row).select('*').single();
  if (error || !data) return null;
  return rowToSession(data as Record<string, unknown>);
}

export async function deleteSessionInSupabase(id: string): Promise<boolean> {
  const { error } = await supabase.from('analysis_sessions').delete().eq('id', id);
  return !error;
}

export async function clearAllSessionsInSupabase(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('analysis_sessions').delete().eq('user_id', user.id);
  return !error;
}

export async function getMeFromSupabase(): Promise<{ id: string; email?: string; username: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? undefined,
    username: (user.user_metadata?.username as string) ?? user.email?.split('@')[0] ?? 'User',
  };
}
