import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import toast from 'react-hot-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  onClearHistory: () => void;
  theme: 'dark' | 'light';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
  theme
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDark = theme === 'dark';

  // Reset confirmation state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmDelete(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearClick = () => {
    if (confirmDelete) {
      onClearHistory();
      onClose();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md border rounded-xl shadow-2xl overflow-hidden transition-colors ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex justify-between items-center ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        }`}>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Global Settings</h2>
          <button 
            onClick={onClose}
            className={`transition-colors ${
              isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
            }`}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8">
          
          {/* Theme Control */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                Interface Theme
            </label>
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => onUpdateSettings({ ...settings, theme: 'dark' })}
                    className={`flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium border transition-all ${
                        settings.theme === 'dark'
                            ? 'bg-zinc-800 text-white border-orange-500 ring-1 ring-orange-500'
                            : isDark 
                              ? 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                              : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:border-zinc-300'
                    }`}
                >
                    <i className="fas fa-moon mr-2"></i> Scientific Dark
                </button>
                <button
                    onClick={() => onUpdateSettings({ ...settings, theme: 'light' })}
                    className={`flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium border transition-all ${
                        settings.theme === 'light'
                            ? 'bg-white text-zinc-900 border-orange-500 ring-1 ring-orange-500'
                            : isDark
                              ? 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                              : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:border-zinc-300'
                    }`}
                >
                    <i className="fas fa-sun mr-2"></i> Light
                </button>
            </div>
          </div>

          {/* Model Provider Control */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                Reasoning Engine
            </label>

            <div className={`p-4 rounded-lg border space-y-3 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Use your own OpenAI-compatible API. It must allow CORS from this site.
                </p>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Base URL</label>
                  <input 
                    type="text" 
                    value={settings.customModelConfig?.baseUrl || ''}
                    onChange={(e) => onUpdateSettings({ 
                      ...settings, 
                      customModelConfig: { 
                        ...settings.customModelConfig, 
                        baseUrl: e.target.value,
                        apiKey: settings.customModelConfig?.apiKey || '',
                        modelName: settings.customModelConfig?.modelName || ''
                      } 
                    })}
                    placeholder="https://api.example.com/v1"
                    className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>API Key</label>
                  <input 
                    type="password" 
                    value={settings.customModelConfig?.apiKey || ''}
                    onChange={(e) => onUpdateSettings({ 
                      ...settings, 
                      customModelConfig: { 
                        ...settings.customModelConfig, 
                        baseUrl: settings.customModelConfig?.baseUrl || '',
                        apiKey: e.target.value,
                        modelName: settings.customModelConfig?.modelName || ''
                      } 
                    })}
                    placeholder="sk-..."
                    className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Model Name</label>
                  <input 
                    type="text" 
                    value={settings.customModelConfig?.modelName || ''}
                    onChange={(e) => onUpdateSettings({ 
                      ...settings, 
                      customModelConfig: { 
                        ...settings.customModelConfig, 
                        baseUrl: settings.customModelConfig?.baseUrl || '',
                        apiKey: settings.customModelConfig?.apiKey || '',
                        modelName: e.target.value
                      } 
                    })}
                    placeholder="k2-think-v2"
                    className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'
                    }`}
                  />
                </div>
              </div>
            
            <div className="mt-2 flex justify-end">
                 <button
                   type="button"
                   onClick={async () => {
                     const toastId = toast.loading("Testing connection...");
                     try {
                        const base = settings.customModelConfig?.baseUrl?.replace(/\/$/, '') ?? '';
                        const url = `${base}/chat/completions`;
                        const response = await fetch(url, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${settings.customModelConfig?.apiKey ?? ''}`
                          },
                          body: JSON.stringify({
                            model: settings.customModelConfig?.modelName,
                            messages: [{ role: "user", content: "Hello" }],
                            temperature: 0.7
                          })
                        });
                        if (response.ok) {
                          toast.success("Connection successful. Click Save settings below to keep your changes.", { id: toastId, duration: 4000 });
                        } else {
                          const err = await response.json().catch(() => ({}));
                          toast.error(`Connection failed: ${(err as { error?: string })?.error ?? response.statusText}`, { id: toastId });
                        }
                     } catch (e) {
                       toast.error("Connection failed. Check URL and CORS (API must allow requests from this site).", { id: toastId });
                     }
                   }}
                   className={`text-xs px-3 py-1 rounded border transition-colors ${
                     isDark 
                       ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' 
                       : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'
                   }`}
                 >
                   <i className="fas fa-plug mr-1"></i> Test Connection
                 </button>
               </div>
          </div>

          {/* Temperature Control */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className={`text-sm font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                Scientific Creativity (Temperature)
              </label>
              <span className="text-xs font-mono text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => onUpdateSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-orange-600 ${
                isDark ? 'bg-zinc-800' : 'bg-zinc-200'
              }`}
            />
            <div className="flex justify-between mt-2 text-xs text-zinc-500">
              <span>Deterministic</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Higher values encourage more novel hypothesis generation, while lower values focus on factual extraction.
            </p>
          </div>

          {/* Save */}
          <div className={`pt-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <button
              type="button"
              onClick={() => {
                onUpdateSettings(settings);
                toast.success("Settings saved.");
                onClose();
              }}
              className={`w-full py-3 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                isDark
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              <i className="fas fa-check-circle"></i>
              Save settings
            </button>
          </div>

          {/* Danger Zone */}
          <div className={`pt-6 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
            <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-4">
              Danger Zone
            </h3>
            <button
              type="button"
              onClick={handleClearClick}
              className={`w-full py-2 px-4 border rounded-md transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                confirmDelete 
                  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700 animate-pulse' 
                  : 'border-red-500/30 text-red-500 hover:bg-red-500/10'
              }`}
            >
              <i className={`fas ${confirmDelete ? 'fa-exclamation-triangle' : 'fa-trash-alt'}`}></i>
              {confirmDelete ? "Click again to confirm deletion" : "Clear Research History"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};