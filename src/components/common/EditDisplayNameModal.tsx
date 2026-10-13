import React, { useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface EditDisplayNameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditDisplayNameModal: React.FC<EditDisplayNameModalProps> = ({ isOpen, onClose }) => {
  const { user, updateDisplayName } = useAuth();
  const currentName = user?.user_metadata?.display_name?.trim() || '';

  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

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
      setError(updateError.message || 'Failed to update display name. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 relative">
        <button
          onClick={onClose}
          disabled={saving}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-slate-900 mb-1">
          Edit Display Name
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Update how your name appears across your dashboard and pipeline.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-xs text-rose-700 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {savedSuccess ? (
          <div className="py-4 text-center space-y-2 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Name updated!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="edit-display-name"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Display Name
              </label>
              <input
                id="edit-display-name"
                type="text"
                required
                autoFocus
                maxLength={50}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                disabled={saving}
                placeholder="Enter display name"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-2 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex-1 py-2 px-3 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
