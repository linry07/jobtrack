import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Application, Activity, ApplicationStatus } from '../types';
import { sampleApplications, sampleActivities } from '../data/sampleData';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { MigrationModal } from '../components/common/MigrationModal';

const STORAGE_KEY_APPLICATIONS = 'jobtrack_applications';
const STORAGE_KEY_ACTIVITIES = 'jobtrack_activities';
const STORAGE_KEY_BACKUP = 'jobtrack_applications_backup';
const STORAGE_KEY_MIGRATED = 'jobtrack_migrated_user_ids';

interface JobTrackContextType {
  applications: Application[];
  activities: Activity[];
  loading: boolean;
  addApplication: (app: Omit<Application, 'id' | 'appliedDate' | 'lastUpdated'> & { appliedDate?: string }) => Application;
  updateApplicationStatus: (id: string, status: ApplicationStatus) => void;
  updateApplication: (id: string, updates: Partial<Application>) => void;
  deleteApplication: (id: string) => void;
  refreshData: () => Promise<void>;
}

const JobTrackContext = createContext<JobTrackContextType | undefined>(undefined);

function dbToApplication(row: any): Application {
  return {
    id: row.id,
    company: row.company,
    position: row.position,
    location: row.location || '',
    status: row.status,
    appliedDate: row.applied_date,
    salary: row.salary || undefined,
    notes: row.notes || undefined,
    description: row.description || undefined,
    employmentType: row.employment_type || undefined,
    url: row.url || undefined,
    contactName: row.contact_name || undefined,
    contactEmail: row.contact_email || undefined,
    lastUpdated: row.last_updated,
  };
}

function applicationToDb(app: Partial<Application>, userId: string): any {
  const row: any = { user_id: userId };
  if (app.id) row.id = app.id;
  if (app.company !== undefined) row.company = app.company;
  if (app.position !== undefined) row.position = app.position;
  if (app.location !== undefined) row.location = app.location;
  if (app.status !== undefined) row.status = app.status;
  if (app.appliedDate !== undefined) row.applied_date = app.appliedDate;
  if (app.salary !== undefined) row.salary = app.salary;
  if (app.notes !== undefined) row.notes = app.notes;
  if (app.description !== undefined) row.description = app.description;
  if (app.employmentType !== undefined) row.employment_type = app.employmentType;
  if (app.url !== undefined) row.url = app.url;
  if (app.contactName !== undefined) row.contact_name = app.contactName;
  if (app.contactEmail !== undefined) row.contact_email = app.contactEmail;
  if (app.lastUpdated !== undefined) row.last_updated = app.lastUpdated;
  return row;
}

function dbToActivity(row: any): Activity {
  return {
    id: row.id,
    applicationId: row.application_id,
    company: row.company,
    position: row.position,
    action: row.action,
    date: row.date,
    type: row.type,
  };
}

export const JobTrackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isConfigured } = useAuth();

  const [applications, setApplications] = useState<Application[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Migration modal state
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [localAppsToMigrate, setLocalAppsToMigrate] = useState<Application[]>([]);

  // 1. Fetch applications & activities from Supabase for authenticated user
  const loadCloudData = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const [appsRes, actsRes] = await Promise.all([
        supabase
          .from('applications')
          .select('*')
          .eq('user_id', userId)
          .order('applied_date', { ascending: false }),
        supabase
          .from('activities')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (appsRes.error) {
        console.error('Error fetching cloud applications:', appsRes.error.message);
      } else {
        const cloudApps = (appsRes.data || []).map(dbToApplication);
        setApplications(cloudApps);
      }

      if (actsRes.error) {
        console.error('Error fetching cloud activities:', actsRes.error.message);
      } else {
        const cloudActs = (actsRes.data || []).map(dbToActivity);
        setActivities(cloudActs);
      }
    } catch (err) {
      console.error('Unexpected error loading cloud data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Load LocalStorage Data (when not using Supabase or not signed in)
  const loadLocalData = useCallback(() => {
    try {
      const savedApps = localStorage.getItem(STORAGE_KEY_APPLICATIONS);
      if (savedApps) {
        const parsed = JSON.parse(savedApps);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setApplications(parsed);
          const savedActs = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
          if (savedActs) {
            const parsedActs = JSON.parse(savedActs);
            if (Array.isArray(parsedActs)) setActivities(parsedActs);
          } else {
            setActivities(sampleActivities);
          }
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load local data:', e);
    }
    // Only load sample data if user has never saved any applications
    setApplications(sampleApplications);
    setActivities(sampleActivities);
    setLoading(false);
  }, []);

  // Check for local storage data to offer migration once user logs in
  const checkMigrationOpportunity = useCallback((userId: string) => {
    try {
      const migratedUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_MIGRATED) || '[]');
      if (migratedUsers.includes(userId)) return;

      const savedApps = localStorage.getItem(STORAGE_KEY_APPLICATIONS);
      if (!savedApps) return;

      const parsed = JSON.parse(savedApps);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      // Ensure we don't migrate sample data as real user data
      const isSampleData = parsed.length === sampleApplications.length &&
        parsed[0]?.company === sampleApplications[0]?.company &&
        parsed[1]?.company === sampleApplications[1]?.company;

      if (!isSampleData) {
        setLocalAppsToMigrate(parsed);
        setShowMigrationModal(true);
      }
    } catch (e) {
      console.error('Failed to check migration opportunity:', e);
    }
  }, []);

  // Handle migration execution
  const handleMigrate = async () => {
    if (!user || localAppsToMigrate.length === 0) return;

    // 1. Create a safe backup before attempting migration
    try {
      localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(localAppsToMigrate));
    } catch (e) {
      console.warn('Could not store local backup:', e);
    }

    // 2. Map and insert into Supabase
    const dbPayload = localAppsToMigrate.map((app) => ({
      user_id: user.id,
      company: app.company,
      position: app.position,
      location: app.location || '',
      status: app.status || 'saved',
      applied_date: app.appliedDate || new Date().toISOString().split('T')[0],
      salary: app.salary || null,
      notes: app.notes || null,
      description: app.description || null,
      employment_type: app.employmentType || null,
      url: app.url || null,
      contact_name: app.contactName || null,
      contact_email: app.contactEmail || null,
      last_updated: app.lastUpdated || new Date().toISOString().split('T')[0],
    }));

    const { error } = await supabase.from('applications').insert(dbPayload);
    if (error) {
      throw new Error(`Cloud migration failed: ${error.message}`);
    }

    // 3. Mark user as migrated
    try {
      const migratedUsers = JSON.parse(localStorage.getItem(STORAGE_KEY_MIGRATED) || '[]');
      if (!migratedUsers.includes(user.id)) {
        migratedUsers.push(user.id);
        localStorage.setItem(STORAGE_KEY_MIGRATED, JSON.stringify(migratedUsers));
      }
      // Remove original unmigrated key so it is not offered again
      localStorage.removeItem(STORAGE_KEY_APPLICATIONS);
    } catch (e) {
      console.error('Error saving migration status:', e);
    }

    // 4. Reload cloud applications
    await loadCloudData(user.id);
  };

  // Sync effect when user changes
  useEffect(() => {
    if (isConfigured && user) {
      loadCloudData(user.id);
      checkMigrationOpportunity(user.id);
    } else if (!isConfigured) {
      loadLocalData();
    } else {
      // User logged out: clear memory
      setApplications([]);
      setActivities([]);
      setLoading(false);
    }
  }, [user, isConfigured, loadCloudData, loadLocalData, checkMigrationOpportunity]);

  // Persist locally only when Supabase is not configured
  useEffect(() => {
    if (!isConfigured && applications.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_APPLICATIONS, JSON.stringify(applications));
      } catch (e) {
        console.error('Failed to save applications to localStorage:', e);
      }
    }
  }, [applications, isConfigured]);

  useEffect(() => {
    if (!isConfigured && activities.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(activities));
      } catch (e) {
        console.error('Failed to save activities to localStorage:', e);
      }
    }
  }, [activities, isConfigured]);

  // Add application
  const addApplication = (appData: Omit<Application, 'id' | 'appliedDate' | 'lastUpdated'> & { appliedDate?: string }) => {
    const today = new Date().toISOString().split('T')[0];
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `app_${Date.now()}`;

    const newApp: Application = {
      ...appData,
      id: newId,
      appliedDate: appData.appliedDate || today,
      lastUpdated: today,
    };

    // Optimistic UI update
    setApplications((prev) => [newApp, ...prev]);

    const newActivity: Activity = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `act_${Date.now()}`,
      applicationId: newApp.id,
      company: newApp.company,
      position: newApp.position,
      action: newApp.status === 'applied' ? 'Application submitted' : `Added to ${newApp.status}`,
      date: today,
      type: 'status_change',
    };
    setActivities((prev) => [newActivity, ...prev]);

    // Cloud persistence
    if (isConfigured && user) {
      const dbApp = applicationToDb(newApp, user.id);
      supabase.from('applications').insert(dbApp).then(({ error }) => {
        if (error) {
          console.error('Failed to save application to cloud:', error.message);
          // Revert optimistic update
          setApplications((prev) => prev.filter((a) => a.id !== newId));
        } else {
          // Record activity in DB
          supabase.from('activities').insert({
            id: newActivity.id,
            user_id: user.id,
            application_id: newApp.id,
            company: newActivity.company,
            position: newActivity.position,
            action: newActivity.action,
            date: newActivity.date,
            type: newActivity.type,
          }).then();
        }
      });
    }

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
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `act_${Date.now()}`,
        applicationId: id,
        company: updatedApp.company,
        position: updatedApp.position,
        action: statusLabels[newStatus],
        date: today,
        type: newStatus === 'interviewing' ? 'interview' : 'status_change',
      };
      setActivities((prev) => [newActivity, ...prev]);

      // Cloud persistence
      if (isConfigured && user) {
        supabase
          .from('applications')
          .update({ status: newStatus, last_updated: today })
          .eq('id', id)
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) {
              console.error('Failed to update status in cloud:', error.message);
            } else {
              supabase.from('activities').insert({
                id: newActivity.id,
                user_id: user.id,
                application_id: id,
                company: newActivity.company,
                position: newActivity.position,
                action: newActivity.action,
                date: newActivity.date,
                type: newActivity.type,
              }).then();
            }
          });
      }
    }
  };

  // Update application details
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

    // Cloud persistence
    if (isConfigured && user) {
      const dbUpdates = applicationToDb({ ...updates, lastUpdated: today }, user.id);
      delete dbUpdates.id;
      delete dbUpdates.user_id;

      supabase
        .from('applications')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.error('Failed to update application in cloud:', error.message);
        });
    }
  };

  // Delete application
  const deleteApplication = (id: string) => {
    setApplications((prev) => prev.filter((app) => app.id !== id));
    setActivities((prev) => prev.filter((act) => act.applicationId !== id));

    // Cloud persistence
    if (isConfigured && user) {
      supabase
        .from('applications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
        .then(({ error }) => {
          if (error) console.error('Failed to delete application from cloud:', error.message);
        });
    }
  };

  const refreshData = async () => {
    if (user) {
      await loadCloudData(user.id);
    }
  };

  return (
    <JobTrackContext.Provider
      value={{
        applications,
        activities,
        loading,
        addApplication,
        updateApplicationStatus,
        updateApplication,
        deleteApplication,
        refreshData,
      }}
    >
      {children}
      {showMigrationModal && (
        <MigrationModal
          localAppsCount={localAppsToMigrate.length}
          onMigrate={handleMigrate}
          onDismiss={() => setShowMigrationModal(false)}
        />
      )}
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
