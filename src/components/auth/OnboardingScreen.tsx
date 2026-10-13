import React, { useState } from 'react';
import { Briefcase, ArrowRight, Loader2, AlertCircle, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const OnboardingScreen: React.FC = () => {
  const { user, updateDisplayName, signOut } = useAuth();

  // Suggest Google full_name or name if available, otherwise blank
  const suggestedName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    '';

  const [displayName, setDisplayName] = useState(suggestedName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();

    if (!trimmed) {
      setError('Please enter a display name.');
      return;
    }

    if (trimmed.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    if (trimmed.length > 50) {
      setError('Display name cannot exceed 50 characters.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await updateDisplayName(trimmed);

    if (updateError) {
      setError(updateError.message || 'Failed to save your display name. Please try again.');
      setSaving(false);
      return;
    }

    // On success, AuthContext immediately updates the user state with user_metadata.display_name.
    // ProtectedRoute detects the saved display name and renders the Dashboard.
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl shadow-sm mb-4">
          <Briefcase className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Welcome to JobTrack!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Let&rsquo;s personalize your job application workspace
        </p>
      </div>

      {/* ── Form Card ───────────────────────────────────────────────────── */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          <div className="mb-6 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
              <Sparkles className="w-3.5 h-3.5" />
              Quick Setup
            </span>
            <span className="text-xs text-slate-400">Step 1 of 1</span>
          </div>

          <h2 className="text-lg font-bold text-slate-900 mb-1">
            What should we call you?
          </h2>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            Choose a display name for your dashboard greeting, pipeline metrics, and profile.
          </p>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-sm text-rose-700 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="display-name-input"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Display Name
              </label>
              <input
                id="display-name-input"
                type="text"
                required
                autoFocus
                maxLength={50}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Jordan, Alex, Taylor"
                disabled={saving}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:opacity-60"
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                You can change this anytime from your profile settings.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !displayName.trim()}
              className="w-full mt-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving your workspace...</span>
                </>
              ) : (
                <>
                  <span>Continue to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* ── Account identity & Sign-out option ──────────────────────── */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="truncate max-w-[200px]" title={user?.email || ''}>
              {user?.email || 'Logged in'}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 transition-colors font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
