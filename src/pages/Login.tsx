import { useState } from 'react';
import { Briefcase, Loader2, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Google's official SVG mark — used in the "Continue with Google" button.
// Inline SVG keeps this self-contained with no extra dependencies.
function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="w-5 h-5 shrink-0"
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
  const { signInWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Google OAuth sign-in / registration ────────────────────────────────────
  // signInWithOAuth navigates the browser to Google, then back to origin.
  // Both new user signup and existing user sign-in are handled in this single flow.
  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError(null);

    const { error: oauthError } = await signInWithGoogle();

    if (oauthError) {
      setError(oauthError.message || 'Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
    // On success the page navigates away to Google — no state update needed.
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* ── Brand Header ────────────────────────────────────────────────────── */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl shadow-sm mb-4">
          <Briefcase className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Welcome to JobTrack
        </h1>
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
          Track your job applications, stay organized, and manage your job search in one place.
        </p>
      </div>

      {/* ── Auth Card ───────────────────────────────────────────────────────── */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10 space-y-6">

          {/* ── Error banner ─────────────────────────────────────────────────── */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-sm text-rose-700 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Card Title & Explanation ────────────────────────────────────── */}
          <div className="text-center space-y-1.5">
            <h2 className="text-base font-semibold text-slate-900">
              Sign in or create your account
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Use your Google account to get started in seconds. New users are registered automatically, and returning users are taken straight to their workspace.
            </p>
          </div>

          {/* ── Continue with Google button ─────────────────────────────────── */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                <span>Redirecting to Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* ── Feature Highlights / Trust Notes ────────────────────────────── */}
          <div className="pt-6 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Free to use with real-time cloud sync</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>One-click access with no password to remember</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Seamless experience across desktop and mobile</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Secure authentication powered by Google</span>
          </div>

        </div>
      </div>
    </div>
  );
}
