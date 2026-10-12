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
} from 'lucide-react';
import { Application, ApplicationStatus } from '../types';
import { useJobTrack } from '../context/JobTrackContext';

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

  // Form State for new application
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    location: '',
    status: 'saved' as ApplicationStatus,
    salary: '',
    notes: '',
    contactName: '',
    contactEmail: '',
    url: '',
  });

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

  const handleCreateApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company || !formData.position) return;

    addApplication({
      company: formData.company,
      position: formData.position,
      location: formData.location || 'Remote',
      status: formData.status,
      salary: formData.salary || undefined,
      notes: formData.notes || undefined,
      contactName: formData.contactName || undefined,
      contactEmail: formData.contactEmail || undefined,
      url: formData.url || undefined,
    });

    setIsAddModalOpen(false);
    setFormData({
      company: '',
      position: '',
      location: '',
      status: 'saved',
      salary: '',
      notes: '',
      contactName: '',
      contactEmail: '',
      url: '',
    });
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

                      {app.salary && (
                        <div className="flex items-center gap-1 mt-2.5">
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-slide-up relative">
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
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">{selectedApp.company}</h3>
                <p className="text-sm font-medium text-slate-500">{selectedApp.position}</p>
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>

              <button
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Application */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-slide-up relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">New Job Application</h3>
            <p className="text-xs text-slate-500 mb-4">Add a new company or role to your tracking board.</p>

            <form onSubmit={handleCreateApplication} className="space-y-3.5 text-xs">
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

              <div className="grid grid-cols-2 gap-3">
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
                    placeholder="e.g. Remote / New York"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Estimated Compensation</label>
                <input
                  type="text"
                  placeholder="e.g. $140k - $160k"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Notes / Context</label>
                <textarea
                  rows={2}
                  placeholder="Referral contact, tech stack highlights, next steps..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors shadow-sm"
                >
                  Save Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
