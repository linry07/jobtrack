import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Briefcase, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { OnboardingScreen } from './OnboardingScreen';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isConfigured } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">JobTrack</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span>Loading your workspace...</span>
        </div>
      </div>
    );
  }

  // If Supabase is configured and there's no logged-in user, redirect to login
  if (isConfigured && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is logged in but has not saved a JobTrack display name, show onboarding
  const hasDisplayName = Boolean(user?.user_metadata?.display_name?.trim());
  if (user && !hasDisplayName) {
    return <OnboardingScreen />;
  }

  return <>{children}</>;
};
