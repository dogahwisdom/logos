import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseUrl && serviceRoleKey);

let serverClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseServer(): ReturnType<typeof createClient> | null {
  if (!isSupabaseConfigured()) return null;
  if (!serverClient) {
    serverClient = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false }
    });
  }
  return serverClient;
}

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: { username?: string };
}

export async function getUserFromJwt(token: string): Promise<AuthUser | null> {
  const sup = getSupabaseServer();
  if (!sup) return null;
  const { data: { user }, error } = await sup.auth.getUser(token);
  if (error || !user) return null;
  return {
    id: user.id,
    email: user.email ?? undefined,
    user_metadata: user.user_metadata
  };
}
