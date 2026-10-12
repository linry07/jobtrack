import React, { createContext, useContext, useState, useEffect } from 'react';
import { Application, Activity, ApplicationStatus } from '../types';
import { sampleApplications, sampleActivities } from '../data/sampleData';

const STORAGE_KEY_APPLICATIONS = 'jobtrack_applications';
const STORAGE_KEY_ACTIVITIES = 'jobtrack_activities';

interface JobTrackContextType {
  applications: Application[];
  activities: Activity[];
  addApplication: (app: Omit<Application, 'id' | 'appliedDate' | 'lastUpdated'> & { appliedDate?: string }) => Application;
  updateApplicationStatus: (id: string, status: ApplicationStatus) => void;
  updateApplication: (id: string, updates: Partial<Application>) => void;
  deleteApplication: (id: string) => void;
}

const JobTrackContext = createContext<JobTrackContextType | undefined>(undefined);

export const JobTrackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialize applications from localStorage or fallback to sampleApplications
  const [applications, setApplications] = useState<Application[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_APPLICATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load applications from localStorage:', e);
    }
    return sampleApplications;
  });

  // 2. Initialize activities from localStorage or fallback to sampleActivities
  const [activities, setActivities] = useState<Activity[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load activities from localStorage:', e);
    }
    return sampleActivities;
  });

  // Persist applications on state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_APPLICATIONS, JSON.stringify(applications));
    } catch (e) {
      console.error('Failed to save applications to localStorage:', e);
    }
  }, [applications]);

  // Persist activities on state change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));
    } catch (e) {
      console.error('Failed to save activities to localStorage:', e);
    }
  }, [activities]);

  // Add application
  const addApplication = (appData: Omit<Application, 'id' | 'appliedDate' | 'lastUpdated'> & { appliedDate?: string }) => {
    const today = new Date().toISOString().split('T')[0];
    const newApp: Application = {
      ...appData,
      id: Date.now().toString(),
      appliedDate: appData.appliedDate || today,
      lastUpdated: today,
    };

    setApplications((prev) => [newApp, ...prev]);

    // Record activity
    const newActivity: Activity = {
      id: 'act_' + Date.now().toString(),
      applicationId: newApp.id,
      company: newApp.company,
      position: newApp.position,
      action: newApp.status === 'applied' ? 'Application submitted' : `Added to ${newApp.status}`,
      date: today,
      type: 'status_change',
    };
    setActivities((prev) => [newActivity, ...prev]);

    return newApp;
  };

  // Update application status
  const updateApplicationStatus = (id: string, newStatus: ApplicationStatus) => {
    const today = new Date().toISOString().split('T')[0];
    let updatedApp: Application | undefined;

    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === id) {
          if (app.status === newStatus) return app;
          updatedApp = { ...app, status: newStatus, lastUpdated: today };
          return updatedApp;
        }
        return app;
      })
    );

    if (updatedApp) {
      const statusLabels: Record<ApplicationStatus, string> = {
        saved: 'Moved to saved',
        applied: 'Submitted application',
        interviewing: 'Moved to interviewing stage',
        offer: 'Offer received!',
        rejected: 'Application status updated to rejected',
      };

      const newActivity: Activity = {
        id: 'act_' + Date.now().toString(),
        applicationId: id,
        company: updatedApp.company,
        position: updatedApp.position,
        action: statusLabels[newStatus],
        date: today,
        type: newStatus === 'interviewing' ? 'interview' : 'status_change',
      };
      setActivities((prev) => [newActivity, ...prev]);
    }
  };

  // Update application fields (notes, salary, etc.)
  const updateApplication = (id: string, updates: Partial<Application>) => {
    const today = new Date().toISOString().split('T')[0];
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === id) {
          return { ...app, ...updates, lastUpdated: today };
        }
        return app;
      })
    );
  };

  // Delete application
  const deleteApplication = (id: string) => {
    setApplications((prev) => prev.filter((app) => app.id !== id));
    setActivities((prev) => prev.filter((act) => act.applicationId !== id));
  };

  return (
    <JobTrackContext.Provider
      value={{
        applications,
        activities,
        addApplication,
        updateApplicationStatus,
        updateApplication,
        deleteApplication,
      }}
    >
      {children}
    </JobTrackContext.Provider>
  );
};

export const useJobTrack = (): JobTrackContextType => {
  const context = useContext(JobTrackContext);
  if (!context) {
    throw new Error('useJobTrack must be used within a JobTrackProvider');
  }
  return context;
};
