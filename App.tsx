import React, { useState, useEffect, useCallback } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { SetNewPasswordForm } from './components/SetNewPasswordForm';
import { Sidebar } from './components/Sidebar';
import { Workbench } from './components/Workbench';
import { SettingsModal } from './components/SettingsModal';
import { User, AnalysisSession, AppSettings } from './types';
import toast, { Toaster } from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from './services/supabase';
import {
  fetchSessionsFromSupabase,
  createSessionInSupabase,
  deleteSessionInSupabase,
  clearAllSessionsInSupabase,
  getMeFromSupabase
} from './services/sessionsSupabase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    temperature: 0.7,
    theme: 'dark',
    reasoningProvider: 'gemini',
    providerConfigs: {
      gemini: { apiKey: '', modelName: 'gemini-2.0-flash', baseUrl: '' },
      k2: { apiKey: '', modelName: 'MBZUAI-IFM/K2-Think-v2', baseUrl: 'https://api.k2think.ai/v1' },
      groq: { apiKey: '', modelName: 'llama-3.3-70b-versatile', baseUrl: '' },
      openai: { apiKey: '', modelName: 'gpt-4o', baseUrl: '' },
      anthropic: { apiKey: '', modelName: 'claude-3-5-sonnet-latest', baseUrl: '' },
      together: { apiKey: '', modelName: '', baseUrl: 'https://api.together.xyz/v1' },
      custom: { apiKey: '', modelName: '', baseUrl: '' },
    },
  });

  // Restore session from Supabase or localStorage (with timeout so desktop never hangs)
  useEffect(() => {
    const INIT_TIMEOUT_MS = 10_000;

    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('init_timeout')), INIT_TIMEOUT_MS);
    });

    const initSupabase = async (): Promise<boolean> => {
      if (!isSupabaseConfigured()) return false;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return false;
      const u = session.user;
      setUser({
        id: u.id,
        email: u.email ?? '',
        username: (u.user_metadata?.username as string) ?? u.email?.split('@')[0] ?? 'User',
      });
      const list = await fetchSessionsFromSupabase();
      setSessions(list);
      return true;
    };

    const init = async () => {
      try {
        const storedSettings = localStorage.getItem('logos_settings');
        if (storedSettings) {
          try {
            const parsed = JSON.parse(storedSettings);
            let provider = parsed.reasoningProvider ?? (parsed.modelProvider === 'gemini' ? 'gemini' : 'custom');

            // Default provider configurations
            const defaultConfigs = {
              gemini: { apiKey: '', modelName: 'gemini-2.0-flash', baseUrl: '' },
              k2: { apiKey: '', modelName: 'MBZUAI-IFM/K2-Think-v2', baseUrl: 'https://api.k2think.ai/v1' },
              groq: { apiKey: '', modelName: 'llama-3.3-70b-versatile', baseUrl: '' },
              openai: { apiKey: '', modelName: 'gpt-4o', baseUrl: '' },
              anthropic: { apiKey: '', modelName: 'claude-3-5-sonnet-latest', baseUrl: '' },
              together: { apiKey: '', modelName: '', baseUrl: 'https://api.together.xyz/v1' },
              custom: { apiKey: '', modelName: '', baseUrl: '' },
            };

            let providerConfigs = parsed.providerConfigs;

            // Migration logic: If user hasn't migrated to providerConfigs yet
            if (!providerConfigs) {
              providerConfigs = { ...defaultConfigs };

              // Move legacy config into the appropriate provider
              const legacyConfig = parsed.reasoningConfig ?? (provider === 'gemini'
                ? { baseUrl: '', apiKey: parsed.geminiConfig?.apiKey ?? '', modelName: parsed.geminiConfig?.modelName ?? 'gemini-2.0-flash' }
                : { baseUrl: parsed.customModelConfig?.baseUrl ?? '', apiKey: parsed.customModelConfig?.apiKey ?? '', modelName: parsed.customModelConfig?.modelName ?? '' });

              if (providerConfigs[provider]) {
                providerConfigs[provider] = legacyConfig;
              }
            } else {
              // Ensure all default keys exist in case new ones were added
              providerConfigs = { ...defaultConfigs, ...providerConfigs };
            }

            setSettings(prev => ({
              ...prev,
              ...parsed,
              reasoningProvider: provider,
              providerConfigs,
            }));
          } catch {
            /* ignore */
          }
        }

        const completed = await Promise.race([
          initSupabase(),
          timeoutPromise.then(() => false)
        ]).catch(() => false);

        if (completed) {
          setAuthReady(true);
          return;
        }

        const storedUser = localStorage.getItem('logos_user');
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch {
            /* ignore */
          }
        }
        const storedSessions = localStorage.getItem('logos_sessions');
        if (storedSessions) {
          try {
            setSessions(JSON.parse(storedSessions));
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        console.warn('Init error:', e);
      } finally {
        setAuthReady(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecoveryMode(true);
          return;
        }
        if (!session) {
          setUser(null);
          setSessions([]);
          setCurrentSessionId(null);
          return;
        }
        // Defer async work so this callback returns immediately and releases the auth lock.
        // Otherwise sign-in elsewhere can hit "LockManager lock timed out" (Supabase auth-js #762).
        setTimeout(async () => {
          const me = await getMeFromSupabase();
          if (me) {
            setUser({ id: me.id, email: me.email, username: me.username });
            const list = await fetchSessionsFromSupabase();
            setSessions(list);
          }
        }, 0);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = useCallback(async (newUser: User) => {
    setUser(newUser);
    if (newUser.id && isSupabaseConfigured()) {
      const list = await fetchSessionsFromSupabase();
      setSessions(list);
    } else if (!newUser.id) {
      localStorage.setItem('logos_user', JSON.stringify(newUser));
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Sign out error:', e);
    } finally {
      setUser(null);
      setSessions([]);
      setCurrentSessionId(null);
      localStorage.removeItem('logos_user');
      localStorage.removeItem('logos_sessions');
    }
  }, []);

  const handleNewSession = useCallback(async (session: AnalysisSession) => {
    if (isSupabaseConfigured() && user?.id) {
      const saved = await createSessionInSupabase(session);
      if (saved) {
        setSessions(prev => [saved, ...prev]);
        setCurrentSessionId(saved.id);
        return;
      }
    }
    setSessions(prev => {
      const next = [session, ...prev];
      localStorage.setItem('logos_sessions', JSON.stringify(next));
      return next;
    });
    setCurrentSessionId(session.id);
  }, [user?.id]);

  const handleClearHistory = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const ok = await clearAllSessionsInSupabase();
      if (ok) {
        setSessions([]);
        setCurrentSessionId(null);
        toast.success("Research history cleared successfully.");
        return;
      }
    }
    setSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem('logos_sessions');
    toast.success("Research history cleared successfully.");
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    if (isSupabaseConfigured()) {
      const ok = await deleteSessionInSupabase(id);
      if (ok) {
        setSessions(prev => prev.filter(s => s.id !== id));
        setCurrentSessionId(prev => (prev === id ? null : prev));
        toast.success("Analysis deleted.");
        return;
      }
    }
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem('logos_sessions', JSON.stringify(next));
      return next;
    });
    setCurrentSessionId(prev => (prev === id ? null : prev));
    toast.success("Analysis deleted.");
  }, []);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('logos_settings', JSON.stringify(newSettings));
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }
  if (passwordRecoveryMode && isSupabaseConfigured()) {
    return (
      <SetNewPasswordForm
        theme={settings.theme}
        onSuccess={async () => {
          setPasswordRecoveryMode(false);
          const me = await getMeFromSupabase();
          if (me) {
            setUser({ id: me.id, email: me.email, username: me.username });
            const list = await fetchSessionsFromSupabase();
            setSessions(list);
          }
        }}
      />
    );
  }

  if (!user) {
    return <AuthScreen onLogin={handleLogin} theme={settings.theme} />;
  }

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${settings.theme === 'light' ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-950 text-zinc-200'}`}>
      <Toaster
        position="bottom-right"
        gutter={16}
        toastOptions={{
          duration: 3000,
          style: {
            background: settings.theme === 'light' ? '#fff' : '#27272a',
            color: settings.theme === 'light' ? '#18181b' : '#e4e4e7',
            border: `1px solid ${settings.theme === 'light' ? '#e4e4e7' : '#3f3f46'}`,
            borderRadius: '10px',
            padding: '14px 18px',
            boxShadow: settings.theme === 'light' ? '0 4px 12px rgba(0,0,0,0.08)' : '0 4px 24px rgba(0,0,0,0.4)',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />

      {/* Mobile sidebar backdrop: tap outside to close */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <Sidebar
        user={user}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onLogout={handleLogout}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewAnalysis={() => setCurrentSessionId(null)}
        theme={settings.theme}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      {/* Mobile: open sidebar when it's closed */}
      <button
        type="button"
        className={`fixed z-20 flex items-center justify-center w-11 h-11 rounded-lg border shadow-md md:hidden transition-colors ${isSidebarOpen ? 'invisible' : 'visible ' + (settings.theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50')
          }`}
        style={{ top: 'max(1rem, env(safe-area-inset-top))', left: 'max(1rem, env(safe-area-inset-left))' }}
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Open menu"
      >
        <i className="fas fa-bars text-lg" aria-hidden />
      </button>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClearHistory={handleClearHistory}
        theme={settings.theme}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Workbench
          key={currentSessionId || 'new'} // Force remount on session change
          initialSession={currentSession}
          onAnalysisComplete={handleNewSession}
          settings={settings}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </main>
    </div>
  );
}