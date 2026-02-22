import React, { useState, useRef, useEffect } from 'react';
import { User, AnalysisSession } from '../types';

interface SidebarProps {
  user: User;
  sessions: AnalysisSession[];
  currentSessionId: string | null;
  onLogout: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
  onNewAnalysis: () => void;
  theme: 'dark' | 'light';
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  sessions,
  currentSessionId,
  onLogout,
  onSelectSession,
  onDeleteSession,
  onOpenSettings,
  onNewAnalysis,
  theme,
  isOpen,
  onToggle
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
    <aside className={`fixed md:relative inset-y-0 left-0 z-40 border-r flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-out overflow-hidden ${
      isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0 md:w-20'
    } ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
      <div className={`${isOpen ? 'w-64' : 'w-20'} h-full flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className={`p-6 border-b flex items-center ${isOpen ? 'justify-between' : 'justify-center flex-col gap-4'} ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}>
          <div className={`flex items-center gap-3 ${!isOpen && 'flex-col'}`}>
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              L
            </div>
            {isOpen && (
              <span className={`font-bold text-lg tracking-wide ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                LOGOS
              </span>
            )}
          </div>
          
          {isOpen ? (
            <button 
              onClick={onToggle}
              className={`p-2 rounded-md transition-colors ${
                isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Close sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <path d="M15 9l-3 3 3 3" />
              </svg>
            </button>
          ) : (
            <button 
              onClick={onToggle}
              className={`p-2 rounded-md transition-colors mt-2 ${
                isDark ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title="Expand sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <path d="M12 9l3 3-3 3" />
              </svg>
            </button>
          )}
        </div>

      {/* New Analysis Button */}
      <div className="p-4">
        <button
          onClick={onNewAnalysis}
          className={`w-full flex items-center ${isOpen ? 'gap-2 px-4' : 'justify-center px-0'} py-2 rounded-md transition-colors border shadow-sm ${
            isDark 
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' 
              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border-zinc-200'
          }`}
          title="New Analysis"
        >
          <i className="fas fa-plus text-xs"></i>
          {isOpen && <span className="text-sm font-medium">New Analysis</span>}
        </button>
      </div>

      {/* Research History */}
      <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin">
        {isOpen ? (
          <>
            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}>
              Research History
            </h3>
            <div className="space-y-1">
              {sessions.length === 0 ? (
                <p className={`text-xs italic ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>No past analysis.</p>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="group relative flex items-center">
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors pr-8 ${
                        currentSessionId === session.id
                          ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                          : isDark 
                            ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200' 
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                      }`}
                    >
                      <i className="fas fa-file-alt mr-2 text-xs opacity-70"></i>
                      {session.filename}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className={`absolute right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                        isDark ? 'text-zinc-500 hover:text-red-400 hover:bg-zinc-700' : 'text-zinc-400 hover:text-red-600 hover:bg-zinc-200'
                      }`}
                      title="Delete analysis"
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
           <div className="flex flex-col items-center gap-4 pt-4">
             {sessions.map((session) => (
               <button
                 key={session.id}
                 onClick={() => onSelectSession(session.id)}
                 className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-orange-500/10 text-orange-600'
                      : isDark 
                        ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200' 
                        : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'
                 }`}
                 title={session.filename}
               >
                 <i className="fas fa-file-alt text-xs"></i>
               </button>
             ))}
           </div>
        )}
      </div>

      {/* Footer / User Profile Popover */}
      <div className={`p-4 border-t relative ${
        isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
      }`} ref={menuRef}>
        
        {isMenuOpen && (
          <div className={`absolute bottom-full left-4 right-4 mb-2 rounded-xl shadow-xl border overflow-hidden animation-fade-in z-50 ${
            isDark 
              ? 'bg-zinc-900 border-zinc-700' 
              : 'bg-white border-zinc-200'
          } ${!isOpen && 'left-16 w-48'}`}>
             <div className="px-3 py-3 bg-opacity-50">
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                   Signed in as
                </p>
                <p className={`text-xs font-bold truncate ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                   {user.email}
                </p>
             </div>
             
             <div className={`h-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>

             <div className="p-1">
               <button
                 type="button"
                 onClick={() => { setIsMenuOpen(false); onOpenSettings(); }}
                 className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-colors ${
                    isDark 
                      ? 'text-zinc-300 hover:bg-zinc-800' 
                      : 'text-zinc-700 hover:bg-zinc-100'
                 }`}
               >
                 <i className="fas fa-cog w-5 text-center text-xs opacity-70"></i> 
                 Settings
               </button>
             </div>

             <div className={`h-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>

             <div className="p-1">
               <button
                 type="button"
                 onClick={() => {
                   setIsMenuOpen(false);
                   onLogout();
                 }}
                 className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-lg transition-colors group ${
                    isDark 
                      ? 'text-red-400 hover:bg-red-900/20' 
                      : 'text-red-600 hover:bg-red-50'
                 }`}
               >
                 <i className="fas fa-sign-out-alt w-5 text-center text-xs opacity-70 group-hover:opacity-100" aria-hidden />
                 Log out
               </button>
             </div>
          </div>
        )}

        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`w-full flex items-center ${isOpen ? 'gap-3 p-2' : 'justify-center p-0'} rounded-lg transition-all duration-200 ${
            isMenuOpen 
              ? (isDark ? 'bg-zinc-800' : 'bg-zinc-200') 
              : (isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200')
          }`}
        >
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm text-white text-xs font-bold shrink-0">
             {user.username.charAt(0).toUpperCase()}
          </div>
          {isOpen && (
            <>
              <div className="flex-1 text-left overflow-hidden">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                   {user.username}
                </p>
                <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                   Pro Plan
                </p>
              </div>
              <i className={`fas fa-chevron-up text-xs transition-transform duration-200 ${
                 isDark ? 'text-zinc-500' : 'text-zinc-400'
              } ${isMenuOpen ? '' : 'rotate-180'}`}></i>
            </>
          )}
        </button>
      </div>
      </div>
    </aside>
    </>
  );
};