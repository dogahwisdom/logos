import React, { useState, useEffect } from 'react';
import { User } from '../types';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { apiBase } from '../config/env';

interface AuthScreenProps {
  onLogin: (user: User) => void;
  theme?: 'dark' | 'light';
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, theme = 'dark' }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [accountCreatedUser, setAccountCreatedUser] = useState<User | null>(null);
  const [emailConfirmRequired, setEmailConfirmRequired] = useState(false);

  const isDark = theme === 'dark';

  // Custom Google OAuth (server callback) only when Supabase is not configured
  useEffect(() => {
    if (isSupabaseConfigured()) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data.user) {
        const googleUser = event.data.user;
        const user: User = {
          username: googleUser.name,
          email: googleUser.email
        };
        toast.success("Signed in with Google successfully.");
        onLogin(user);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLogin]);

  const handleGoogleLogin = async () => {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
        toast.success("Redirecting to Google…");
      } catch (err: unknown) {
        console.error('Google Auth Error:', err);
        toast.error(err instanceof Error ? err.message : "Failed to sign in with Google");
      }
      return;
    }
    try {
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const response = await fetch(`${apiBase}/api/auth/google/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get auth URL');
      }
      const { url } = await response.json();
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      window.open(url, 'google_oauth_popup', `width=${width},height=${height},left=${left},top=${top}`);
    } catch (error: unknown) {
      console.error('Google Auth Error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to initiate Google Sign-In");
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      toast.success('Check your email for a link to reset your password.');
      setShowForgotPassword(false);
    } catch (err: unknown) {
      console.error('Reset password error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  // Safety net so the UI never stays on "Processing..." (e.g. slow network or Supabase unreachable)
  const AUTH_TIMEOUT_MS = 12_000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !username)) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Sign-in is taking too long. Check your connection and try again.")),
        AUTH_TIMEOUT_MS
      );
    });

    try {
      if (isLogin) {
        const authPromise = supabase.auth.signInWithPassword({ email, password });
        const { data, error } = await Promise.race([authPromise, timeoutPromise]);

        if (error) throw error;

        if (data?.user) {
          const user: User = {
            id: data.user.id,
            username: data.user.user_metadata?.username || email.split('@')[0],
            email: data.user.email || email
          };
          onLogin(user);
        } else {
          // Session might be in client but not in response; try once
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) {
            const u = sessionData.session.user;
            const user: User = {
              id: u.id,
              username: (u.user_metadata?.username as string) || u.email?.split('@')[0] || 'User',
              email: u.email ?? email
            };
            onLogin(user);
          }
        }
      } else {
        const authPromise = supabase.auth.signUp({
          email,
          password,
          options: { data: { username } }
        });
        const { data, error } = await Promise.race([authPromise, timeoutPromise]);

        if (error) throw error;
        if (data?.user) {
          // If session is null, Supabase requires email confirmation – don't log in yet
          if (data.session) {
            const user: User = {
              id: data.user.id,
              username,
              email
            };
            setAccountCreatedUser(user);
          } else {
            setEmailConfirmRequired(true);
            setIsLogin(true);
          }
        }
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error("Authentication failed");
      console.error("Auth Error:", err);

      if (
        err.message === "Failed to fetch" ||
        err.message?.includes("Supabase URL") ||
        err.message?.includes("apikey")
      ) {
        console.warn("Supabase unreachable, using local sign-in.");
        setTimeout(() => {
          const user: User = {
            username: isLogin ? email.split('@')[0] : username,
            email: email
          };
          toast.success(isLogin ? "Welcome back." : "Account created. Connect Supabase to sync your data.");
          onLogin(user);
        }, 800);
      } else {
        // Production-friendly messages for common Supabase errors
        const msg = err.message || "Authentication failed";
        const friendly =
          msg.includes("Invalid login") || msg.includes("invalid_credentials")
            ? "Invalid email or password."
            : msg.includes("Email not confirmed") || msg.includes("email_not_confirmed")
              ? "Please confirm your email (check your inbox and spam), then sign in again."
              : msg;
        toast.error(friendly);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex items-center justify-center min-h-screen p-4 sm:p-6 transition-colors duration-300 ${
      isDark ? 'bg-zinc-950 text-zinc-200' : 'bg-zinc-50 text-zinc-900'
    }`}>
      <div className={`w-full max-w-md p-6 sm:p-8 space-y-6 sm:space-y-8 border rounded-xl shadow-2xl transition-all ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      }`}>
        <div className="text-center">
          <h1 className={`text-4xl font-bold tracking-tight mb-2 ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            LOGOS
          </h1>
          <p className="text-sm text-zinc-500">Scientific Discovery Agent</p>
        </div>

        {accountCreatedUser ? (
          <div className="space-y-6 text-center">
            <div className={`inline-flex h-14 w-14 items-center justify-center rounded-full ${
              isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
            }`}>
              <i className="fas fa-check text-2xl" aria-hidden />
            </div>
            <div>
              <h2 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Account created successfully
              </h2>
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Welcome to LOGOS. You can start analyzing research papers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onLogin(accountCreatedUser);
                setAccountCreatedUser(null);
              }}
              className="w-full min-h-[44px] py-3 px-4 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-transparent transition-colors"
            >
              Continue
            </button>
          </div>
        ) : showForgotPassword && isSupabaseConfigured() ? (
          <>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Enter your email and we’ll send you a link to reset your password.
            </p>
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    isDark ? 'bg-zinc-950 border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-900'
                  }`}
                  placeholder="name@institute.edu"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full min-h-[44px] py-3 px-4 rounded-md text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className={`w-full text-sm font-medium ${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              Back to sign in
            </button>
          </>
        ) : (
        <>
        {emailConfirmRequired && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${
            isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            Check your email to confirm your account, then sign in below.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                  isDark 
                    ? 'bg-zinc-950 border-zinc-700 text-white placeholder-zinc-600' 
                    : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400'
                }`}
                placeholder="Dr. Researcher"
              />
            </div>
          )}
          
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                  isDark 
                    ? 'bg-zinc-950 border-zinc-700 text-white placeholder-zinc-600' 
                    : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400'
                }`}
              placeholder="name@institute.edu"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>Password</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors pr-10 ${
                    isDark 
                      ? 'bg-zinc-950 border-zinc-700 text-white placeholder-zinc-600' 
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400'
                  }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute inset-y-0 right-0 px-3 flex items-center text-sm focus:outline-none ${
                  isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center min-h-[44px] py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
          {isLogin && isSupabaseConfigured() && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm font-medium text-orange-600 hover:text-orange-500"
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className={`w-full border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={`px-2 ${isDark ? 'bg-zinc-900 text-zinc-500' : 'bg-white text-zinc-500'}`}>
              Or continue with
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className={`w-full flex justify-center items-center min-h-[44px] py-3 px-4 border rounded-md shadow-sm text-sm font-medium transition-colors ${
            isDark 
              ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700' 
              : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </button>

        <div className="text-center text-sm">
          <span className="text-zinc-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setEmailConfirmRequired(false);
            }}
            className="font-medium text-orange-600 hover:text-orange-500"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
};