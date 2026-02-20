import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { analyzePaper } from './services/geminiService';
import {
  getSupabaseServer,
  getUserFromJwt,
  isSupabaseConfigured,
  type AuthUser
} from './services/supabaseServer';

const app = express();
const PORT = process.env.PORT || 3000;

// Body size limit for JSON (e.g. paper text)
app.use(express.json({ limit: '1mb' }));

// Optional auth: set req.authUser if valid Bearer token present
async function optionalAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    (req as express.Request & { authUser?: AuthUser }).authUser = undefined;
    return next();
  }
  const user = await getUserFromJwt(token);
  (req as express.Request & { authUser?: AuthUser }).authUser = user ?? undefined;
  next();
}

// Require auth: 401 if no valid token
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authUser = (req as express.Request & { authUser?: AuthUser }).authUser;
  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Current user from Supabase JWT (optional auth)
app.get('/api/me', optionalAuth, (req, res) => {
  const authUser = (req as express.Request & { authUser?: AuthUser }).authUser;
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }
  if (!authUser) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({
    id: authUser.id,
    email: authUser.email ?? undefined,
    username: authUser.user_metadata?.username ?? authUser.email?.split('@')[0] ?? 'User'
  });
});

// Session list: GET /api/sessions (requires auth, Supabase)
app.get('/api/sessions', optionalAuth, requireAuth, async (req, res) => {
  const authUser = (req as express.Request & { authUser?: AuthUser }).authUser!;
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }
  const sup = getSupabaseServer();
  if (!sup) {
    res.status(503).json({ error: 'Supabase not available' });
    return;
  }
  const { data, error } = await sup
    .from('analysis_sessions')
    .select('*')
    .eq('user_id', authUser.id)
    .order('timestamp', { ascending: false });
  if (error) {
    console.error('Sessions fetch error:', error);
    res.status(500).json({ error: 'Failed to load sessions' });
    return;
  }
  const sessions = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    filename: row.filename,
    timestamp: Number(row.timestamp),
    summary: row.summary,
    assumptions: Array.isArray(row.assumptions) ? row.assumptions : [],
    reasoning: row.reasoning ?? '',
    experimentCode: row.experiment_code ?? '',
    simulationData: row.simulation_data ?? undefined,
    rawText: row.raw_text ?? undefined,
    reproducibilityScore: row.reproducibility_score ?? undefined,
    citationIntegrity: row.citation_integrity ?? undefined
  }));
  res.json(sessions);
});

// Create session: POST /api/sessions (requires auth)
app.post('/api/sessions', optionalAuth, requireAuth, async (req, res) => {
  const authUser = (req as express.Request & { authUser?: AuthUser }).authUser!;
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }
  const sup = getSupabaseServer();
  if (!sup) {
    res.status(503).json({ error: 'Supabase not available' });
    return;
  }
  const body = req.body as {
    id?: string;
    filename: string;
    timestamp: number;
    summary: string;
    assumptions: string[];
    reasoning: string;
    experimentCode: string;
    simulationData?: { x: number; y: number }[];
    rawText?: string;
    reproducibilityScore?: number;
    citationIntegrity?: string;
  };
  if (!body.filename || body.summary === undefined) {
    res.status(400).json({ error: 'Missing filename or summary' });
    return;
  }
  const row = {
    user_id: authUser.id,
    filename: body.filename,
    timestamp: body.timestamp,
    summary: body.summary,
    assumptions: body.assumptions ?? [],
    reasoning: body.reasoning ?? '',
    experiment_code: body.experimentCode ?? '',
    simulation_data: body.simulationData ?? null,
    raw_text: body.rawText ?? null,
    reproducibility_score: body.reproducibilityScore ?? null,
    citation_integrity: body.citationIntegrity ?? null
  };
  const { data, error } = await sup.from('analysis_sessions').insert(row).select('id').single();
  if (error) {
    console.error('Session insert error:', error);
    res.status(500).json({ error: 'Failed to save session' });
    return;
  }
  res.status(201).json({
    id: data.id,
    filename: body.filename,
    timestamp: body.timestamp,
    summary: body.summary,
    assumptions: body.assumptions ?? [],
    reasoning: body.reasoning ?? '',
    experimentCode: body.experimentCode ?? '',
    simulationData: body.simulationData,
    rawText: body.rawText,
    reproducibilityScore: body.reproducibilityScore,
    citationIntegrity: body.citationIntegrity
  });
});

// Delete session: DELETE /api/sessions/:id (requires auth)
app.delete('/api/sessions/:id', optionalAuth, requireAuth, async (req, res) => {
  const authUser = (req as express.Request & { authUser?: AuthUser }).authUser!;
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }
  const sup = getSupabaseServer();
  if (!sup) {
    res.status(503).json({ error: 'Supabase not available' });
    return;
  }
  const { id } = req.params;
  const { error } = await sup
    .from('analysis_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', authUser.id);
  if (error) {
    console.error('Session delete error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
    return;
  }
  res.status(204).send();
});

// Delete all sessions for the user: DELETE /api/sessions?all=1
app.delete('/api/sessions', optionalAuth, requireAuth, async (req, res) => {
  const authUser = (req as express.Request & { authUser?: AuthUser }).authUser!;
  if (req.query.all !== '1') {
    res.status(400).json({ error: 'Use ?all=1 to delete all sessions' });
    return;
  }
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }
  const sup = getSupabaseServer();
  if (!sup) {
    res.status(503).json({ error: 'Supabase not available' });
    return;
  }
  const { error } = await sup.from('analysis_sessions').delete().eq('user_id', authUser.id);
  if (error) {
    console.error('Sessions delete all error:', error);
    res.status(500).json({ error: 'Failed to clear sessions' });
    return;
  }
  res.status(204).send();
});

// Server-side Gemini analysis (keeps API key off the client)
app.post('/api/analyze', async (req, res) => {
  const { paperText, temperature } = req.body;
  if (!paperText || typeof paperText !== 'string') {
    res.status(400).json({ error: 'Missing or invalid paperText' });
    return;
  }
  const temp = typeof temperature === 'number' ? temperature : 0.7;
  try {
    const result = await analyzePaper(paperText, temp);
    res.json(result);
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Analysis failed'
    });
  }
});

// Allowed base URLs for custom AI proxy (prevents SSRF). Comma-separated in env.
const ALLOWED_BASE_URLS = (process.env.ALLOWED_CUSTOM_AI_BASE_URLS || '')
  .split(',')
  .map((u: string) => u.trim().toLowerCase())
  .filter(Boolean);

function isUrlAllowed(url: string): boolean {
  if (!url || ALLOWED_BASE_URLS.length === 0) return false;
  try {
    const base = new URL(url);
    const origin = `${base.protocol}//${base.host}`.toLowerCase();
    return ALLOWED_BASE_URLS.some(allowed => origin === allowed || origin.startsWith(allowed));
  } catch {
    return false;
  }
}

// Proxy for Custom AI (to avoid CORS). targetUrl must be in ALLOWED_CUSTOM_AI_BASE_URLS.
app.post('/api/proxy/chat/completions', async (req, res) => {
  const { targetUrl, apiKey, model, messages, temperature } = req.body;

  if (!targetUrl || !apiKey || !model || !messages) {
    res.status(400).json({ error: 'Missing required parameters' });
    return;
  }
  if (!isUrlAllowed(targetUrl)) {
    res.status(403).json({ error: 'Custom AI base URL is not allowed. Configure ALLOWED_CUSTOM_AI_BASE_URLS on the server.' });
    return;
  }

  try {
    const response = await fetch(`${targetUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ error: `Upstream API Error: ${response.statusText}`, details: errorText });
      return;
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Internal Proxy Error' });
  }
});

// Allowed app origin for OAuth redirect (prevents open redirect). Set APP_ORIGIN or we derive from Host.
function getAllowedOrigin(req: express.Request): string | null {
  const configured = process.env.APP_ORIGIN;
  if (configured) return configured.trim();
  const host = req.get('host');
  const proto = req.get('x-forwarded-proto') || (req.protocol || 'http');
  if (host) return `${proto}://${host}`;
  return null;
}

function isRedirectUriAllowed(redirectUri: string, allowedOrigin: string | null): boolean {
  if (!allowedOrigin || !redirectUri) return false;
  try {
    const origin = new URL(redirectUri).origin;
    return origin === allowedOrigin || redirectUri.startsWith(allowedOrigin + '/');
  } catch {
    return false;
  }
}

// API Routes
app.get('/api/auth/google/url', (req, res) => {
  const redirectUri = req.query.redirect_uri as string;
  if (!redirectUri) {
    res.status(400).json({ error: 'Missing redirect_uri' });
    return;
  }
  const allowedOrigin = getAllowedOrigin(req);
  if (!isRedirectUriAllowed(redirectUri, allowedOrigin)) {
    res.status(400).json({ error: 'redirect_uri not allowed for this server' });
    return;
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.status(503).json({ error: 'Google Auth not configured (Missing Client ID/Secret)' });
    return;
  }

  try {
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
      state: JSON.stringify({ redirectUri }),
      prompt: 'consent'
    });

    res.json({ url });
  } catch (error) {
    console.error("Google Auth URL Generation Error:", error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code || !state) {
    res.status(400).send('Missing code or state');
    return;
  }

  try {
    let parsed: { redirectUri?: string };
    try {
      parsed = JSON.parse(state);
    } catch {
      res.status(400).send('Invalid state');
      return;
    }
    const redirectUri = parsed?.redirectUri;
    if (!redirectUri || typeof redirectUri !== 'string') {
      res.status(400).send('Invalid state');
      return;
    }
    const allowedOrigin = getAllowedOrigin(req);
    if (!isRedirectUriAllowed(redirectUri, allowedOrigin)) {
      res.status(400).send('Redirect URI not allowed');
      return;
    }

    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const userInfoResponse = await client.request({
      url: 'https://www.googleapis.com/oauth2/v3/userinfo'
    });
    
    const user = userInfoResponse.data;
    const targetOrigin = new URL(redirectUri).origin;

    // Send the user data back to the opener; use targetOrigin instead of '*' for security
    const script = `
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', user: ${JSON.stringify(user)} }, ${JSON.stringify(targetOrigin)});
            window.close();
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `;
    res.send(script);

  } catch (error) {
    console.error('Error during Google Auth callback:', error);
    res.status(500).send('Authentication failed');
  }
});

// Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
