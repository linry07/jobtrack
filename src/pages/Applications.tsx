import React, { useState } from 'react';
import {
  Search,
  Plus,
  MapPin,
  DollarSign,
  Calendar,
  X,
  Mail,
  User,
  MoreVertical,
  Building2,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { Application, ApplicationStatus } from '../types';
import { useJobTrack } from '../context/JobTrackContext';
import { supabase } from '../lib/supabase';

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const columns: {
  status: ApplicationStatus;
  label: string;
  dotColor: string;
  borderColor: string;
  badgeBg: string;
}[] = [
  { status: 'saved', label: 'Saved', dotColor: 'bg-slate-400', borderColor: 'border-l-slate-400', badgeBg: 'bg-slate-100 text-slate-700' },
  { status: 'applied', label: 'Applied', dotColor: 'bg-blue-500', borderColor: 'border-l-blue-500', badgeBg: 'bg-blue-50 text-blue-700' },
  { status: 'interviewing', label: 'Interviewing', dotColor: 'bg-amber-500', borderColor: 'border-l-amber-500', badgeBg: 'bg-amber-50 text-amber-700' },
  { status: 'offer', label: 'Offer', dotColor: 'bg-emerald-500', borderColor: 'border-l-emerald-500', badgeBg: 'bg-emerald-50 text-emerald-700' },
  { status: 'rejected', label: 'Rejected', dotColor: 'bg-rose-400', borderColor: 'border-l-rose-400', badgeBg: 'bg-rose-50 text-rose-700' },
];

export default function Applications() {
  const {
    applications,
    addApplication,
    updateApplicationStatus,
    deleteApplication,
  } = useJobTrack();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ApplicationStatus | null>(null);

  // Smart Job Import state
  const [jobUrl, setJobUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState(false);
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Form State for new application
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    location: '',
    status: 'saved' as ApplicationStatus, // Requirement 8: default to 'saved'
    salary: '',
    employmentType: '',
    description: '',
    notes: '',
    contactName: '',
    contactEmail: '',
    url: '',
  });

  // Duplicate URL check
  const duplicateApp = formData.url
    ? applications.find(
        (app) => app.url && app.url.trim().toLowerCase() === formData.url.trim().toLowerCase()
      )
    : null;

  const filteredApps = applications.filter((app) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      app.company.toLowerCase().includes(query) ||
      app.position.toLowerCase().includes(query) ||
      app.location.toLowerCase().includes(query)
    );
  });

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedAppId(id);
  };

  const handleDragOver = (e: React.DragEvent, status: ApplicationStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ApplicationStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedAppId;
    if (id) {
      updateApplicationStatus(id, targetStatus);
    }
    setDraggedAppId(null);
    setDragOverColumn(null);
  };

  const handleStatusChange = (appId: string, newStatus: ApplicationStatus) => {
    updateApplicationStatus(appId, newStatus);
    if (selectedApp && selectedApp.id === appId) {
      setSelectedApp({ ...selectedApp, status: newStatus });
    }
  };

  const handleDeleteApplication = (appId: string) => {
    deleteApplication(appId);
    if (selectedApp?.id === appId) {
      setSelectedApp(null);
    }
  };

  // Reset modal state
  const resetFormModal = () => {
    setIsAddModalOpen(false);
    setJobUrl('');
    setIsExtracting(false);
    setExtractError(null);
    setExtractSuccess(false);
    setShowManualPaste(false);
    setPastedText('');
    setFormData({
      company: '',
      position: '',
      location: '',
      status: 'saved',
      salary: '',
      employmentType: '',
      description: '',
      notes: '',
      contactName: '',
      contactEmail: '',
      url: '',
    });
  };

  // Handle Smart Job Import (Autofill)
  const handleAutofill = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!jobUrl.trim()) return;

    setIsExtracting(true);
    setExtractError(null);
    setExtractSuccess(false);

    try {
      // Ensure we have a valid, active Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Please sign in to import job details.');
      }

      const response = await fetch('/api/extract-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ url: jobUrl.trim() }),
      });

      const result = await response.json();

      if (response.status === 401) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      if (response.status === 429) {
        throw new Error(result.error || 'Import rate limit reached. Please wait a moment before trying again.');
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to extract job details (${response.status})`);
      }

      const extracted = result.data || {};

      // Requirement 3 & 4: Automatically populate the form with extracted info
      // Requirement 7: Missing fields remain blank rather than inventing values
      // Requirement 8: Default status remains 'saved'
      setFormData((prev) => ({
        ...prev,
        company: extracted.company || prev.company || '',
        position: extracted.position || prev.position || '',
        location: extracted.location || prev.location || '',
        salary: extracted.salary || prev.salary || '',
        employmentType: extracted.employmentType || prev.employmentType || '',
        description: extracted.description || prev.description || '',
        url: extracted.url || jobUrl.trim(),
        status: prev.status || 'saved',
      }));

      setExtractSuccess(true);
    } catch (err: any) {
      setExtractError(err.message || 'Unable to extract information from this job URL.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle parsing from pasted job description text (Requirement 9 fallback)
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;

    const text = pastedText.trim();
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Heuristics: first line often title, second line company
    let guessedTitle = '';
    let guessedCompany = '';
    if (lines.length > 0) guessedTitle = lines[0];
    if (lines.length > 1 && lines[1].length < 40) guessedCompany = lines[1];

    // Simple salary search in text
    const salaryRegex = /(?:(\$|USD\s*|€|£)\s*(\d{2,3}(?:,\d{3})*(?:\.\d{2})?(?:[kK])?)\s*(?:-|to)\s*(\$|USD\s*|€|£)?\s*(\d{2,3}(?:,\d{3})*(?:\.\d{2})?(?:[kK])?)(?:\s*(?:\/|\s+per\s+)?(yr|year|annum|hr|hour|mo|month))?)/i;
    const salaryMatch = text.match(salaryRegex);

    setFormData((prev) => ({
      ...prev,
      position: prev.position || guessedTitle,
      company: prev.company || guessedCompany,
      description: text,
      salary: prev.salary || (salaryMatch ? salaryMatch[0].trim() : ''),
    }));

    setShowManualPaste(false);
    setPastedText('');
  };

  // Requirement 6: The user must review and explicitly click "Save Application"
  const handleCreateApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company || !formData.position) return;

    addApplication({
      company: formData.company.trim(),
      position: formData.position.trim(),
      location: formData.location.trim() || 'Remote',
      status: formData.status,
      salary: formData.salary.trim() || undefined,
      description: formData.description.trim() || undefined,
      employmentType: formData.employmentType.trim() || undefined,
      notes: formData.notes.trim() || undefined,
      contactName: formData.contactName.trim() || undefined,
      contactEmail: formData.contactEmail.trim() || undefined,
      url: formData.url.trim() || undefined,
    });

    resetFormModal();
  };

  return (
    <div className="animate-fade-in relative">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Drag cards across columns to update pipeline stages or click to inspect details.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search company, role, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all w-60 shadow-sm"
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Application</span>
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start min-h-[calc(100vh-220px)]">
        {columns.map((column) => {
          const columnApps = filteredApps.filter((app) => app.status === column.status);
          const isOver = dragOverColumn === column.status;

          return (
            <div
              key={column.status}
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
              className={`w-[290px] min-w-[290px] flex-shrink-0 flex flex-col rounded-xl p-2.5 transition-colors duration-150 ${
                isOver ? 'bg-indigo-50/70 ring-2 ring-brand-400 ring-dashed' : 'bg-slate-100/70 border border-slate-200/60'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${column.dotColor}`} />
                  <span className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    {column.label}
                  </span>
                </div>
                <span className="text-xs bg-white text-slate-600 rounded-full px-2 py-0.5 font-medium border border-slate-200 shadow-2xs">
                  {columnApps.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex flex-col gap-2.5 min-h-[450px]">
                {columnApps.length === 0 ? (
                  <div className="flex items-center justify-center h-28 border border-dashed border-slate-200 rounded-lg text-xs text-slate-400 italic">
                    Drop items here
                  </div>
                ) : (
                  columnApps.map((app) => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      onClick={() => setSelectedApp(app)}
                      className={`group bg-white rounded-xl border border-slate-200 border-l-[3px] ${column.borderColor} p-3.5 hover:shadow-md hover:border-slate-300 transition-all duration-150 cursor-grab active:cursor-grabbing select-none relative`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                            {app.company}
                          </p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                            {app.position}
                          </p>
                        </div>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      {app.employmentType && (
                        <div className="mt-2">
                          <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {app.employmentType}
                          </span>
                        </div>
                      )}

                      {app.salary && (
                        <div className="flex items-center gap-1 mt-2">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs font-semibold text-emerald-700">{app.salary}</span>
                        </div>
                      )}

                      {app.notes && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100 italic">
                          "{app.notes}"
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-slate-400 text-xs">
                        <div className="flex items-center gap-1 truncate max-w-[140px]">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{app.location}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(app.appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Application Detail View */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-slide-up relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedApp(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight truncate">{selectedApp.company}</h3>
                  {selectedApp.url && (
                    <a
                      href={selectedApp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-brand-600 transition-colors"
                      title="Open job posting"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-500 truncate">{selectedApp.position}</p>
              </div>
            </div>

            <div className="space-y-4 py-2 border-t border-b border-slate-100 text-sm">
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Status</span>
                  <div className="mt-1">
                    <select
                      value={selectedApp.status}
                      onChange={(e) => handleStatusChange(selectedApp.id, e.target.value as ApplicationStatus)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="saved">Saved</option>
                      <option value="applied">Applied</option>
                      <option value="interviewing">Interviewing</option>
                      <option value="offer">Offer</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-medium">Applied Date</span>
                  <p className="mt-1.5 text-xs font-medium text-slate-700">{formatDate(selectedApp.appliedDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Location</span>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedApp.location}</span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-medium">Compensation</span>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{selectedApp.salary || 'Not specified'}</span>
                  </div>
                </div>
              </div>

              {selectedApp.employmentType && (
                <div>
                  <span className="text-xs text-slate-400 font-medium">Employment Type</span>
                  <p className="mt-1 text-xs text-slate-700 font-medium">{selectedApp.employmentType}</p>
                </div>
              )}

              {selectedApp.description && (
                <div>
                  <span className="text-xs text-slate-400 font-medium">Job Description</span>
                  <div className="mt-1 text-xs text-slate-700 bg-slate-50 border border-slate-100 p-3 rounded-lg leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {selectedApp.description}
                  </div>
                </div>
              )}

              {selectedApp.contactName && (
                <div>
                  <span className="text-xs text-slate-400 font-medium">Point of Contact</span>
                  <div className="mt-1.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-medium text-slate-800">{selectedApp.contactName}</span>
                    </div>
                    {selectedApp.contactEmail && (
                      <a
                        href={`mailto:${selectedApp.contactEmail}`}
                        className="flex items-center gap-1 text-brand-600 hover:underline"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>{selectedApp.contactEmail}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {selectedApp.notes && (
                <div>
                  <span className="text-xs text-slate-400 font-medium">Notes & Feedback</span>
                  <p className="mt-1 text-xs text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg leading-relaxed">
                    {selectedApp.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => handleDeleteApplication(selectedApp.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>

              <button
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Application (with Smart Job Import) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-slide-up relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={resetFormModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-bold text-slate-900 leading-tight">New Job Application</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste a job posting link for smart auto-extraction, or enter details manually.
              </p>
            </div>

            {/* Smart Job Import Section (Requirement 1, 2, 3, 9) */}
            <div className="mb-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <span>Smart Job Import</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualPaste(!showManualPaste)}
                  className="text-[11px] text-brand-600 hover:text-brand-700 font-medium transition-colors"
                >
                  {showManualPaste ? 'Hide text paste' : 'Paste text instead'}
                </button>
              </div>

              {!showManualPaste ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Paste posting URL (e.g. LinkedIn, Greenhouse, Lever, etc.)..."
                      value={jobUrl}
                      onChange={(e) => {
                        setJobUrl(e.target.value);
                        setExtractError(null);
                        setExtractSuccess(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAutofill();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                    <button
                      type="button"
                      disabled={isExtracting || !jobUrl.trim()}
                      onClick={handleAutofill}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer flex-shrink-0"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Extracting...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Autofill</span>
                        </>
                      )}
                    </button>
                  </div>

                  {extractSuccess && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200 animate-fade-in">
                      <Sparkles className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      <span>Extracted job details into the form below! Review and adjust any values.</span>
                    </div>
                  )}

                  {extractError && (
                    <div className="flex items-start gap-1.5 text-[11px] text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-md border border-rose-200 animate-fade-in">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span>{extractError}</span>{' '}
                        <button
                          type="button"
                          onClick={() => setShowManualPaste(true)}
                          className="underline font-medium hover:text-rose-900 ml-1"
                        >
                          Paste job description text instead
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback text paste mode (Requirement 9) */
                <div className="space-y-2 animate-fade-in">
                  <textarea
                    rows={3}
                    placeholder="Paste job posting text or description here..."
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManualPaste(false)}
                      className="px-2.5 py-1 rounded text-xs text-slate-500 hover:bg-slate-200/60 font-medium"
                    >
                      Back to URL
                    </button>
                    <button
                      type="button"
                      disabled={!pastedText.trim()}
                      onClick={handleParsePastedText}
                      className="px-3 py-1 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
                    >
                      Fill Form from Text
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Duplicate Warning */}
            {duplicateApp && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Possible duplicate detected:</span> You already have an application for{' '}
                  <span className="font-medium">{duplicateApp.company} ({duplicateApp.position})</span> with this URL.
                </div>
              </div>
            )}

            {/* Main Application Form (Requirement 5: all fields remain editable) */}
            <form onSubmit={handleCreateApplication} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Position / Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Engineer"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Stage</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ApplicationStatus })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  >
                    <option value="saved">Saved</option>
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Remote / San Francisco, CA"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Employment Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Full-time / Contract"
                    value={formData.employmentType}
                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Compensation / Salary</label>
                  <input
                    type="text"
                    placeholder="e.g. $140,000 - $180,000 / yr"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Posting URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Job Description</label>
                <textarea
                  rows={3}
                  placeholder="Responsibilities, requirements, qualifications..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Personal Notes / Next Steps</label>
                <textarea
                  rows={2}
                  placeholder="Referral contact, application strategy, recruiter notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                />
              </div>

              {/* Requirement 6: Explicit Save Application button; Cancel does not save */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetFormModal}
                  className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors shadow-sm cursor-pointer"
                >
                  Add Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
