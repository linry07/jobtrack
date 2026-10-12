import React, { useState } from 'react';
import { Database, ArrowRight, Loader2, CheckCircle2, ShieldCheck, X } from 'lucide-react';

interface MigrationModalProps {
  localAppsCount: number;
  onMigrate: () => Promise<void>;
  onDismiss: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  localAppsCount,
  onMigrate,
  onDismiss,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onMigrate();
      setSuccess(true);
      setTimeout(() => {
        onDismiss();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to import local data. Your local data remains safe.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative">
        <button
          onClick={onDismiss}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Import Complete!</h3>
            <p className="text-sm text-slate-600">
              Your {localAppsCount} application{localAppsCount > 1 ? 's are' : ' is'} now securely saved in your cloud account.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Import local applications to your cloud account?
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                We detected <span className="font-semibold text-slate-900">{localAppsCount} application{localAppsCount > 1 ? 's' : ''}</span> saved on this device. Would you like to sync them to your cloud account so they are accessible from anywhere?
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                A secure backup is kept in your browser. None of your local applications will be lost.
              </span>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onDismiss}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors"
              >
                Keep Local
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <span>Import Data</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
