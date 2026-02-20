import React, { useState, useEffect, useCallback } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { Workbench } from './components/Workbench';
import { SettingsModal } from './components/SettingsModal';
import { User, AnalysisSession, AppSettings } from './types';
import toast, { Toaster } from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from './services/supabase';
import {
  fetchSessions,
  createSession,
  deleteSession,
  clearAllSessions,
  fetchMe
} from './services/sessionsApi';

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    temperature: 0.7,
    theme: 'dark',
    modelProvider: 'gemini',
    customModelConfig: {
      baseUrl: '',
      apiKey: '',
      modelName: ''
    }
  });

  // Restore session from Supabase or localStorage
  useEffect(() => {
    const init = async () => {
      const storedSettings = localStorage.getItem('logos_settings');
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          setSettings(prev => ({
            ...prev,
            ...parsed,
            customModelConfig: parsed.customModelConfig ?? prev.customModelConfig,
            modelProvider: parsed.modelProvider ?? prev.modelProvider
          }));
        } catch {
          /* ignore */
        }
      }

      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const me = await fetchMe(session.access_token);
          if (me) {
            setUser({ id: me.id, email: me.email, username: me.username });
            const list = await fetchSessions(session.access_token);
            setSessions(list);
            setAuthReady(true);
            return;
          }
        }
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
      setAuthReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.access_token) {
          const me = await fetchMe(session.access_token);
          if (me) {
            setUser({ id: me.id, email: me.email, username: me.username });
            const list = await fetchSessions(session.access_token);
            setSessions(list);
          }
        } else {
          setUser(null);
          setSessions([]);
          setCurrentSessionId(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = useCallback(async (newUser: User) => {
    setUser(newUser);
    if (newUser.id) {
      const token = await getAccessToken();
      if (token) {
        const list = await fetchSessions(token);
        setSessions(list);
      }
    } else {
      localStorage.setItem('logos_user', JSON.stringify(newUser));
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (user?.id && isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem('logos_user');
    localStorage.removeItem('logos_sessions');
  }, [user?.id]);

  const handleNewSession = useCallback(async (session: AnalysisSession) => {
    const token = await getAccessToken();
    if (token && user?.id) {
      const saved = await createSession(token, session);
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
    const token = await getAccessToken();
    if (token) {
      const ok = await clearAllSessions(token);
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
    const token = await getAccessToken();
    if (token) {
      const ok = await deleteSession(token, id);
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
  if (!user) {
    return <AuthScreen onLogin={handleLogin} theme={settings.theme} />;
  }

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${settings.theme === 'light' ? 'bg-zinc-50 text-zinc-900' : 'bg-zinc-950 text-zinc-200'}`}>
      <Toaster position="bottom-right" toastOptions={{
        style: {
          background: settings.theme === 'light' ? '#fff' : '#27272a',
          color: settings.theme === 'light' ? '#18181b' : '#e4e4e7',
          border: `1px solid ${settings.theme === 'light' ? '#e4e4e7' : '#3f3f46'}`
        }
      }}/>
      
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