import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const starfieldStyles: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: [
    'radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.6) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 25% 45%, rgba(255,255,255,0.4) 0%, transparent 100%)',
    'radial-gradient(1.5px 1.5px at 40% 15%, rgba(255,255,255,0.8) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 55% 70%, rgba(255,255,255,0.3) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 70% 30%, rgba(255,255,255,0.5) 0%, transparent 100%)',
    'radial-gradient(1.5px 1.5px at 85% 55%, rgba(255,255,255,0.7) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 15% 80%, rgba(255,255,255,0.4) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 60% 10%, rgba(255,255,255,0.5) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 90% 85%, rgba(255,255,255,0.3) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 35% 90%, rgba(255,255,255,0.6) 0%, transparent 100%)',
    'radial-gradient(1.5px 1.5px at 50% 35%, rgba(255,255,255,0.9) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 78% 72%, rgba(255,255,255,0.4) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 5% 55%, rgba(255,255,255,0.5) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 95% 18%, rgba(255,255,255,0.3) 0%, transparent 100%)',
    'radial-gradient(1.5px 1.5px at 20% 5%, rgba(200,180,255,0.7) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 45% 60%, rgba(255,255,255,0.35) 0%, transparent 100%)',
    'radial-gradient(1px 1px at 68% 88%, rgba(255,255,255,0.5) 0%, transparent 100%)',
    'radial-gradient(1.5px 1.5px at 82% 8%, rgba(255,255,255,0.6) 0%, transparent 100%)',
  ].join(', '),
  animation: 'twinkle 8s ease-in-out infinite alternate',
  pointerEvents: 'none',
  zIndex: 0,
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(13, 11, 30, 0.6)',
  border: '1.5px solid #2A2545',
  borderRadius: 14,
  color: '#EEEEF8',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 16,
};

type AuthMode = 'login' | 'signup' | 'forgot';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'An unexpected error occurred';
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    return null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back!');
      } else if (mode === 'signup') {
        const pwdError = validatePassword(password);
        if (pwdError) {
          toast.error(pwdError);
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user?.identities?.length === 0) {
          toast.error('An account with this email already exists');
          setLoading(false);
          return;
        }
        setSignupSuccess(true);
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (error) throw error;
        toast.success('Check your email for a reset link');
        setMode('login');
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(165deg, #0D0B1E 0%, #060618 40%, #030208 100%)', minHeight: '100dvh' }}
    >
      <div style={starfieldStyles} />

      <div
        className="galaxy-card w-full max-w-md p-10 space-y-8 relative"
        style={{ zIndex: 1, animation: 'slide-in-up 500ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both' }}
      >
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            {mode === 'signup' ? (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/30">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
            ) : (
              <img src="/logo.png" alt="Fides" className="w-14 h-14 object-contain drop-shadow-lg" />
            )}
          </div>
          <h1 className="text-xl font-bold text-[#EEEEF8]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Join Fides' : 'Reset password'}
          </h1>
          <p style={{ color: '#8E89B3', fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>
            {mode === 'login' ? 'Sign in to your account.' : mode === 'signup' ? 'Create your account to get started.' : 'Enter your email for a reset link.'}
          </p>
        </div>

        {signupSuccess ? (
          <div className="text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-full bg-[rgba(34,197,94,0.15)] flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[#EEEEF8] font-semibold text-base">Verify your email</p>
              <p className="text-[#8E89B3] text-sm mt-1 leading-relaxed">
                We sent a confirmation link to <span className="text-[#A78BFA] font-medium">{email}</span>.<br />
                Please check your inbox and click the link to activate your account.
              </p>
            </div>
            <button
              onClick={() => { setMode('login'); setSignupSuccess(false); setEmail(''); setPassword(''); }}
              className="text-[#A78BFA] hover:text-[#C4B5FD] text-sm font-semibold transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-1.5">
            <label
              style={{
                display: 'block',
                color: '#8E89B3',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.08em',
                paddingLeft: 4,
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="galaxy-input"
              style={inputStyle}
              placeholder="you@example.com"
              required
            />
          </div>
          {mode !== 'forgot' && (
            <>
            <div className="space-y-1.5">
              <label
                style={{
                  display: 'block',
                  color: '#8E89B3',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  paddingLeft: 4,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="galaxy-input"
                style={inputStyle}
                placeholder="••••••••"
                required
              />
              {mode === 'signup' && (
                <p className="text-[11px] text-[#5C5780] pl-1">At least 8 characters</p>
              )}
            </div>
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label
                  style={{
                    display: 'block',
                    color: '#8E89B3',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    paddingLeft: 4,
                  }}
                >
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="galaxy-input"
                  style={inputStyle}
                  placeholder="••••••••"
                  required
                />
              </div>
            )}
            </>
          )}
          <button
            type="submit"
            disabled={loading}
            className="galaxy-btn w-full"
            style={{
              opacity: loading ? 0.5 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              background: mode === 'signup' ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : undefined,
            }}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>
        )}

        <div className="text-center pt-2 space-y-2">
              {mode === 'login' && (
            <>
              <button
                onClick={() => setMode('forgot')}
                className="galaxy-btn-ghost block w-full"
                style={{ fontSize: 14 }}
              >
                Forgot password?
              </button>
              <button
                onClick={() => { setMode('signup'); setConfirmPassword(''); setSignupSuccess(false); }}
                className="galaxy-btn-ghost block w-full"
                style={{ fontSize: 14 }}
              >
                Don't have an account? Sign up
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button
              onClick={() => { setMode('login'); setSignupSuccess(false); }}
              className="galaxy-btn-ghost block w-full"
              style={{ fontSize: 14 }}
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === 'forgot' && (
            <button
              onClick={() => setMode('login')}
              className="galaxy-btn-ghost block w-full"
              style={{ fontSize: 14 }}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
