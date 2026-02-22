import type { AnalysisResult } from '../types';
import { supabase } from './supabase';

/**
 * Run paper analysis via Supabase Edge Function (Gemini).
 * Use when Supabase is configured so no separate backend is needed.
 */
export async function analyzePaperViaSupabase(
  paperText: string,
  temperature: number = 0.7
): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke<AnalysisResult>('analyze-paper', {
    body: { paperText, temperature },
  });

  if (error) {
    console.error('Edge Function error:', error);
    throw new Error(error.message || 'Analysis failed');
  }
  if (!data) {
    throw new Error('No response from analysis');
  }
  const errMsg = typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : null;
  if (errMsg) {
    throw new Error(errMsg);
  }
  return data as AnalysisResult;
}
