import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabase';

interface SetNewPasswordFormProps {
  theme: 'dark' | 'light';
  onSuccess: () => void;
}

export const SetNewPasswordForm: React.FC<SetNewPasswordFormProps> = ({ theme, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isDark = theme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      toast.error('Please enter and confirm your new password.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated. You can now sign in.');
      onSuccess();
    } catch (err: unknown) {
      console.error('Password update error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex items-center justify-center min-h-screen p-4 ${isDark ? 'bg-zinc-950 text-zinc-200' : 'bg-zinc-50 text-zinc-900'}`}>
      <div className={`w-full max-w-md p-6 sm:p-8 border rounded-xl shadow-2xl ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <div className="text-center mb-6">
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Set new password
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10 ${
                  isDark ? 'bg-zinc-950 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
              Confirm password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                isDark ? 'bg-zinc-950 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'
              }`}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full min-h-[44px] py-3 px-4 rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
};
