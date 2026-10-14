import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Google's official SVG mark — used in the "Continue with Google" button.
// Inline SVG keeps this self-contained with no extra dependencies.
function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="w-4 h-4 shrink-0"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

  // ── Email / password sign-in ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await signIn(email.trim(), password);

    if (signInError) {
      setError(signInError.message || 'Invalid login credentials. Please try again.');
      setLoading(false);
      return;
    }

    navigate(from, { replace: true });
  };

  // ── Google OAuth sign-in ────────────────────────────────────────────────────
  // signInWithOAuth navigates the browser to Google, then back to origin.
  // We set googleLoading to true to prevent double-clicks; the browser leaves
  // this page, so there's no need to reset it on success.
  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return;
    setGoogleLoading(true);
    setError(null);

    const { error: oauthError } = await signInWithGoogle();

    if (oauthError) {
      // Only reached if signInWithOAuth itself fails before redirecting
      // (e.g. provider not enabled, network error). The browser redirect
      // never happens in this case, so we reset the loading state.
      setError(oauthError.message || 'Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
    // On success the page navigates away — no further state update needed.
  };

  const isAnyLoading = loading || googleLoading;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl shadow-sm mb-4">
          <Briefcase className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sign in to JobTrack</h2>
        <p className="mt-2 text-sm text-slate-600">
          Track and organize your job applications across all your devices
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">

          {/* ── Error banner ─────────────────────────────────────────────────── */}
          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-sm text-rose-700 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Section 1: New to JobTrack? (Google Sign up & Sign in) ─────── */}
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                New to JobTrack?
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Create a free account with Google to start tracking your job applications. Existing Google users can also sign in here.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAnyLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  <span>Redirecting to Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>

          {/* ── Divider ──────────────────────────────────────────────────────── */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* ── Section 2: Already have an email/password account? ───────────── */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Already have an email/password account?
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Sign in with your email address and password below.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isAnyLoading}
                    className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isAnyLoading}
                    className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAnyLoading}
                className="w-full mt-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
