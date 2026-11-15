import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project, User } from '../types';
import { api } from '../services/api';

interface ProjectDetailProps {
  currentUser?: User | null;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ currentUser }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const isViewer = currentUser?.role === 'Viewer';
  const canManage = currentUser?.role === 'Admin' || currentUser?.role === 'Developer';

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [progressInput, setProgressInput] = useState<number>(0);
  const [statusInput, setStatusInput] = useState<Project['status']>('active');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateSummary, setUpdateSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchProject = async () => {
    if (!projectId) return;
    try {
      setIsLoading(true);
      const result = await api.projects.get(projectId);
      const p = result?.data;
      if (p) {
        const normalized: Project = {
          id: String(p.id),
          name: p.name || 'Untitled Project',
          clientName: p.clientName || 'Enterprise Client',
          description: p.description || '',
          language: p.language || 'TypeScript',
          status: p.status || 'active',
          health: Number(p.health ?? 100),
          progress: Number(p.progress ?? 0),
          assignedDeveloper: p.assignedDeveloper || 'System Alpha',
          assignedViewer: p.assignedViewer || 'Viewer',
          dueDate: p.dueDate || '2026-05-30',
          lastUpdate: p.lastUpdate || 'Active',
          updates: Array.isArray(p.updates) ? p.updates : []
        };
        setProject(normalized);
        setProgressInput(normalized.progress);
        setStatusInput(normalized.status);
      }
    } catch (err) {
      console.error('Project Sync Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const handlePublishUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !canManage) return;
    try {
      setIsSaving(true);
      const payload: any = {
        progress: Number(progressInput),
        status: statusInput
      };

      if (updateTitle.trim() || updateSummary.trim()) {
        payload.newUpdate = {
          title: updateTitle.trim() || `Milestone progress updated to ${progressInput}%`,
          summary:
            updateSummary.trim() ||
            `Delivery completion updated to ${progressInput}% by ${currentUser?.name || 'Developer'}.`,
          author: currentUser?.name || 'Developer',
          authorRole: currentUser?.role || 'Developer'
        };
      }

      await api.projects.update(project.id, payload);
      setUpdateTitle('');
      setUpdateSummary('');
      await fetchProject();
    } catch (err) {
      console.error('Failed to update project:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-6 py-8">
        <div className="apple-card p-8 h-44 animate-pulse"></div>
        <div className="apple-card p-8 h-80 animate-pulse"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-lg mx-auto my-16 apple-card p-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#FF3B30]/12 text-[#FF3B30] flex items-center justify-center mx-auto">
          <i className="fas fa-folder-closed text-xl"></i>
        </div>
        <h2 className="text-[20px] font-semibold text-[var(--apple-text-primary)]">
          Client Project Not Found
        </h2>
        <p className="text-[13px] text-[var(--apple-text-secondary)]">
          The requested client project could not be located.
        </p>
        <button
          onClick={() => navigate('/projects')}
          className="px-5 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold"
        >
          Back to Client Projects
        </button>
      </div>
    );
  }

  const updatesList = project.updates || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1360px] w-full mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 transition-opacity"
        >
          <i className="fas fa-chevron-left text-[11px]"></i>
          <span>Back to Client Projects</span>
        </button>

        <span className="text-[11px] font-semibold px-3 py-1 rounded-full apple-subcard text-[var(--apple-text-secondary)]">
          {isViewer ? 'Viewer · Read-Only Tracking' : `${currentUser?.role || 'Developer'} · Full Project Control`}
        </span>
      </div>

      {/* Hero Project Summary Card */}
      <div className="apple-card p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#4e45e1]/12 text-[var(--apple-blue)]">
                Client: {project.clientName || 'Enterprise Client'}
              </span>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full apple-subcard text-[var(--apple-text-secondary)]">
                {project.language}
              </span>
              <span
                className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                  project.status === 'active'
                    ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                    : project.status === 'completed'
                    ? 'bg-[#4e45e1]/12 text-[var(--apple-blue)]'
                    : 'apple-subcard text-[var(--apple-text-tertiary)]'
                }`}
              >
                {project.status}
              </span>
            </div>

            <h1 className="text-[26px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)]">
              {project.name}
            </h1>
            <p className="text-[14px] text-[var(--apple-text-secondary)] leading-relaxed">
              {project.description}
            </p>
          </div>

          {/* Right KPI Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            <div className="apple-subcard p-4 rounded-[16px] min-w-[130px]">
              <p className="text-[11px] font-medium text-[var(--apple-text-tertiary)]">Completion</p>
              <p className="text-[26px] font-bold text-[var(--apple-blue)] mt-0.5">{project.progress}%</p>
            </div>
            <div className="apple-subcard p-4 rounded-[16px] min-w-[130px]">
              <p className="text-[11px] font-medium text-[var(--apple-text-tertiary)]">Health Score</p>
              <p className="text-[26px] font-bold text-[#248A3D] dark:text-[#30D158] mt-0.5">{project.health}%</p>
            </div>
            <div className="apple-subcard p-4 rounded-[16px] min-w-[130px] col-span-2 sm:col-span-1">
              <p className="text-[11px] font-medium text-[var(--apple-text-tertiary)]">Target Delivery</p>
              <p className="text-[15px] font-semibold text-[var(--apple-text-primary)] mt-1.5">
                {project.dueDate || '2026-05-30'}
              </p>
            </div>
          </div>
        </div>

        {/* Full-Width Progress Bar */}
        <div className="mt-6 pt-6 border-t border-[var(--apple-border)]">
          <div className="flex items-center justify-between text-[13px] mb-2">
            <span className="font-semibold text-[var(--apple-text-primary)]">
              Overall Milestone Progress
            </span>
            <span className="font-medium text-[var(--apple-text-secondary)]">
              Lead Developer: <strong className="text-[var(--apple-text-primary)]">{project.assignedDeveloper || 'System Alpha'}</strong> · Last updated {project.lastUpdate}
            </span>
          </div>
          <div className="w-full h-3 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#4e45e1] via-[#5E5CE6] to-[#30D158] transition-all duration-700"
              style={{ width: `${project.progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Updates Timeline + Developer Update Composer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chronological Project Updates Timeline */}
        <div className={canManage ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="apple-card p-6 sm:p-7">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#6B63F2] to-[#4139BF] flex items-center justify-center text-white shadow-sm">
                  <i className="fas fa-timeline text-xs badge-white"></i>
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-[var(--apple-text-primary)]">
                    Project Progress & Milestone Updates
                  </h2>
                  <p className="text-[12px] text-[var(--apple-text-secondary)]">
                    Real-time engineering & delivery log shared between Developers and Client Viewers
                  </p>
                </div>
              </div>
              <span className="text-[12px] font-semibold px-3 py-1 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                {updatesList.length} {updatesList.length === 1 ? 'Update' : 'Updates'}
              </span>
            </div>

            {updatesList.length > 0 ? (
              <div className="space-y-4">
                {updatesList.map((upd, idx) => {
                  const progVal = upd.progressAfter ?? upd.progress;
                  const timeVal = upd.timestamp || upd.date || 'Recent';
                  return (
                    <div
                      key={upd.id || idx}
                      className="apple-subcard p-5 rounded-[18px] border-l-4 border-l-[#4e45e1]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-[var(--apple-text-primary)]">
                            {upd.title}
                          </span>
                          {progVal !== undefined && (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]">
                              {progVal}% Complete
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-[var(--apple-text-tertiary)]">
                          {timeVal}
                        </span>
                      </div>

                      <p className="text-[13px] text-[var(--apple-text-secondary)] leading-relaxed">
                        {upd.summary}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-[var(--apple-border)] flex items-center justify-between text-[11px] text-[var(--apple-text-tertiary)]">
                        <span>
                          Posted by <strong className="text-[var(--apple-text-primary)]">{upd.author}</strong> ({upd.authorRole || 'Developer'})
                        </span>
                        <span className="text-[var(--apple-blue)] font-medium">Verified Milestone</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="apple-subcard p-10 rounded-[18px] text-center">
                <i className="fas fa-clipboard-check text-2xl text-[var(--apple-text-tertiary)] mb-2"></i>
                <p className="text-[14px] font-medium text-[var(--apple-text-secondary)]">
                  No milestone updates logged yet
                </p>
                <p className="text-[12px] text-[var(--apple-text-tertiary)] mt-0.5">
                  Updates posted by the assigned developer will appear here automatically.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Developer / Admin Progress Update Composer */}
        {canManage && (
          <div className="apple-card p-6 self-start">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[9px] bg-gradient-to-b from-[#30D158] to-[#1E8E3E] flex items-center justify-center text-white shadow-sm">
                <i className="fas fa-pen-to-square text-xs badge-white"></i>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  Post Progress Update
                </h3>
                <p className="text-[11px] text-[var(--apple-text-secondary)]">
                  Instantly syncs to the Viewer dashboard
                </p>
              </div>
            </div>

            <form onSubmit={handlePublishUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  <span>Completion Progress</span>
                  <span className="font-bold text-[var(--apple-blue)]">{progressInput}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressInput}
                  onChange={(e) => setProgressInput(Number(e.target.value))}
                  className="w-full accent-[#4e45e1] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Delivery Status
                </label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value as Project['status'])}
                  className="w-full apple-input px-3.5 py-2 text-[13px]"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Milestone Headline
                </label>
                <input
                  value={updateTitle}
                  onChange={(e) => setUpdateTitle(e.target.value)}
                  placeholder="e.g. UAT Sign-off & Production Readiness"
                  className="w-full apple-input px-3.5 py-2 text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Update Details for Client & Team
                </label>
                <textarea
                  rows={4}
                  value={updateSummary}
                  onChange={(e) => setUpdateSummary(e.target.value)}
                  placeholder="Summarize completed deliverables, test results, or next milestones…"
                  className="w-full apple-input px-3.5 py-2 text-[13px] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
              >
                {isSaving ? 'Publishing…' : 'Publish Progress Update'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
