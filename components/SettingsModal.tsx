import React, { useState, useEffect } from 'react';
import { AppSettings, type ReasoningProvider } from '../types';
import { getChatCompletionsUrl } from '../services/customAiService';
import { REASONING_PROVIDERS, PROVIDER_ORDER, getBaseUrlForProvider } from '../config/reasoningProviders';
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const isDark = theme === 'dark';

  // Reset confirmation state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmDelete(false);
      setShowApiKey(false);
      setShowGeminiKey(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className={`w-full max-w-md max-h-[90vh] flex flex-col border rounded-xl shadow-2xl overflow-hidden transition-colors ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        {/* Header */}
        <div className={`px-4 sm:px-6 py-4 border-b flex justify-between items-center flex-shrink-0 ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        }`}>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Global Settings</h2>
          <button 
            type="button"
            onClick={onClose}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center -m-2 transition-colors ${
              isDark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
            }`}
            aria-label="Close settings"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-y-auto flex-1 min-h-0">
          
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

          {/* Reasoning Engine — one section, many providers */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
              Reasoning Engine
            </label>
            <p className={`text-xs mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
              Choose a provider and add your API key. Your endpoint must allow requests from this site (CORS).
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PROVIDER_ORDER.map((p) => {
                const label = p === 'custom' ? 'Custom' : REASONING_PROVIDERS[p].label;
                const isActive = (settings.reasoningProvider ?? (settings.modelProvider === 'gemini' ? 'gemini' : 'custom')) === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onUpdateSettings({
                      ...settings,
                      reasoningProvider: p,
                      reasoningConfig: settings.reasoningConfig ?? { baseUrl: '', apiKey: '', modelName: '' },
                    })}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      isActive ? 'bg-zinc-800 text-white border-orange-500 ring-1 ring-orange-500' : isDark ? 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700' : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {(() => {
              const provider = settings.reasoningProvider ?? (settings.modelProvider === 'gemini' ? 'gemini' : 'custom');
              const config = settings.reasoningConfig ?? { baseUrl: '', apiKey: '', modelName: '' };
              const meta = provider !== 'custom' ? REASONING_PROVIDERS[provider] : null;
              const isGemini = provider === 'gemini';
              const showBaseUrl = provider === 'custom';
              const updateConfig = (partial: Partial<typeof config>) =>
                onUpdateSettings({ ...settings, reasoningConfig: { ...config, ...partial } });
              return (
                <div className={`p-4 rounded-lg border space-y-3 ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  {showBaseUrl && (
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Base URL</label>
                      <input
                        type="text"
                        value={config.baseUrl}
                        onChange={(e) => updateConfig({ baseUrl: e.target.value })}
                        placeholder="https://api.example.com/v1"
                        className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                      />
                    </div>
                  )}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>API Key</label>
                    <div className="relative">
                      <input
                        type={isGemini ? (showGeminiKey ? 'text' : 'password') : (showApiKey ? 'text' : 'password')}
                        value={config.apiKey}
                        onChange={(e) => updateConfig({ apiKey: e.target.value })}
                        placeholder="Your API key"
                        className={`w-full px-3 py-2 pr-10 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                      />
                      <button type="button" onClick={() => (isGemini ? setShowGeminiKey((v) => !v) : setShowApiKey((v) => !v))} className={`absolute inset-y-0 right-0 flex items-center justify-center w-9 text-sm focus:outline-none rounded-r ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'}`} aria-label="Show or hide API key">
                        <i className={`fas ${(isGemini ? showGeminiKey : showApiKey) ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>Model</label>
                    <input
                      type="text"
                      value={config.modelName}
                      onChange={(e) => updateConfig({ modelName: e.target.value })}
                      placeholder={meta?.modelPlaceholder ?? 'e.g. your model id'}
                      className={`w-full px-3 py-2 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'}`}
                    />
                  </div>
                  {!isGemini && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          const toastId = toast.loading("Testing connection...");
                          try {
                            const baseUrl = getBaseUrlForProvider(provider, config.baseUrl);
                            const url = getChatCompletionsUrl(baseUrl);
                            if (!url) { toast.error("Enter a Base URL first (Custom).", { id: toastId }); return; }
                            const res = await fetch(url, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
                              body: JSON.stringify({ model: config.modelName, messages: [{ role: 'user', content: 'Hello' }], temperature: 0.7 }),
                            });
                            if (res.ok) toast.success("Connection verified.", { id: toastId, duration: 2500 });
                            else {
                              const err = await res.json().catch(() => ({}));
                              toast.error(`Connection failed: ${(err as { error?: string })?.error ?? res.statusText}`, { id: toastId, duration: 5000 });
                            }
                          } catch (e) { toast.error(e instanceof Error ? e.message : "Connection failed.", { id: toastId, duration: 5000 }); }
                        }}
                        className={`text-xs px-3 py-1 rounded border ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'}`}
                      >
                        <i className="fas fa-plug mr-1" aria-hidden /> Test Connection
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
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