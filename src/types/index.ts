export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';

export interface Application {
  id: string;
  company: string;
  position: string;
  location: string;
  status: ApplicationStatus;
  appliedDate: string;
  salary?: string;
  notes?: string;
  description?: string;
  employmentType?: string;
  url?: string;
  contactName?: string;
  contactEmail?: string;
  lastUpdated: string;
}

export interface Activity {
  id: string;
  applicationId: string;
  company: string;
  position: string;
  action: string;
  date: string;
  type: 'status_change' | 'note' | 'interview' | 'follow_up';
}

export interface MonthlyStats {
  month: string;
  applied: number;
  interviews: number;
  offers: number;
  rejected: number;
}
