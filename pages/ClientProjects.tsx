import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, User } from '../types';
import { api } from '../services/api';

interface ClientProjectsProps {
  currentUser?: User | null;
}

export function isProjectAssignedToViewer(project: Project, user?: User | null): boolean {
  if (!user || user.role !== 'Viewer') return true;
  const assigned = (project.assignedViewer || 'Viewer').trim().toLowerCase();
  if (!assigned || assigned === 'viewer' || assigned === 'all') return true;
  const userName = (user.name || '').trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  const clientName = (project.clientName || '').trim().toLowerCase();
  return (
    assigned === userName ||
    assigned === userEmail ||
    (userName.length > 0 && clientName.includes(userName))
  );
}

const ClientProjects: React.FC<ClientProjectsProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const isViewer = currentUser?.role === 'Viewer';
  const isAdmin = currentUser?.role === 'Admin';
  const canManage = isAdmin || currentUser?.role === 'Developer';

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

  // New Client Project Modal (Developer / Admin)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    clientName: '',
    description: '',
    language: 'TypeScript / React',
    assignedDeveloper: currentUser?.name || 'Admin',
    assignedViewer: 'Viewer',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    progress: 0
  });

  // Post Progress Update Modal (Developer / Admin)
  const [updatingProject, setUpdatingProject] = useState<Project | null>(null);
  const [updateForm, setUpdateForm] = useState({
    progress: 0,
    status: 'active' as Project['status'],
    health: 100,
    updateTitle: '',
    updateSummary: ''
  });

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const res = await api.projects.list();
      const raw = Array.isArray(res?.data) ? res.data : [];
      const normalized: Project[] = raw.map((p: any) => ({
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
      }));
      setProjects(normalized);
    } catch (err) {
      console.error('Failed to load client projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const scopedProjects = useMemo(() => {
    return projects.filter(p => isProjectAssignedToViewer(p, currentUser));
  }, [projects, currentUser]);

  const filteredProjects = useMemo(() => {
    return scopedProjects.filter(project => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        project.name.toLowerCase().includes(q) ||
        (project.clientName || '').toLowerCase().includes(q) ||
        project.description.toLowerCase().includes(q) ||
        (project.assignedDeveloper || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [scopedProjects, statusFilter, searchQuery]);

  const averageProgress = useMemo(() => {
    if (scopedProjects.length === 0) return 0;
    const sum = scopedProjects.reduce((acc, p) => acc + (Number(p.progress) || 0), 0);
    return Math.round(sum / scopedProjects.length);
  }, [scopedProjects]);

  const totalUpdatesCount = useMemo(() => {
    return scopedProjects.reduce((acc, p) => acc + (p.updates?.length || 0), 0);
  }, [scopedProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    try {
      await api.projects.create({
        name: createForm.name.trim(),
        clientName: createForm.clientName.trim() || 'Enterprise Client',
        description: createForm.description.trim(),
        language: createForm.language.trim() || 'TypeScript',
        assignedDeveloper: createForm.assignedDeveloper.trim() || currentUser?.name || 'System Alpha',
        assignedViewer: createForm.assignedViewer.trim() || 'Viewer',
        dueDate: createForm.dueDate,
        progress: Number(createForm.progress) || 0,
        status: 'active'
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        clientName: '',
        description: '',
        language: 'TypeScript / React',
        assignedDeveloper: currentUser?.name || 'System Alpha',
        assignedViewer: 'Viewer',
        dueDate: '2026-06-15',
        progress: 10
      });
      fetchProjects();
    } catch (err) {
      console.error('Create client project error:', err);
    }
  };

  const handleDeleteProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.projects.delete(project.id);
      fetchProjects();
    } catch (err) {
      console.error('Delete project error:', err);
    }
  };

  const handleClearAllProjects = async () => {
    if (!window.confirm(`Remove all ${projects.length} client projects? This cannot be undone.`)) return;
    try {
      await api.projects.clear();
      fetchProjects();
    } catch (err) {
      console.error('Clear projects error:', err);
    }
  };

  const openUpdateModal = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingProject(project);
    setUpdateForm({
      progress: project.progress,
      status: project.status,
      health: project.health,
      updateTitle: '',
      updateSummary: ''
    });
  };

  const handlePostProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingProject) return;
    try {
      const payload: any = {
        progress: Number(updateForm.progress),
        status: updateForm.status,
        health: Number(updateForm.health)
      };

      if (updateForm.updateTitle.trim() || updateForm.updateSummary.trim()) {
        payload.newUpdate = {
          title: updateForm.updateTitle.trim() || `Progress updated to ${updateForm.progress}%`,
          summary:
            updateForm.updateSummary.trim() ||
            `Milestone progress advanced to ${updateForm.progress}% completion.`,
          author: currentUser?.name || 'Developer',
          authorRole: currentUser?.role || 'Developer'
        };
      }

      await api.projects.update(updatingProject.id, payload);
      setUpdatingProject(null);
      fetchProjects();
    } catch (err) {
      console.error('Update client project error:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)]">
              {isViewer ? 'Client Portal · Assigned Projects' : 'Client Delivery & Milestone Tracker'}
            </span>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)]">
              {isViewer ? 'Viewer Read-Only Access' : `${currentUser?.role || 'Developer'} Mode`}
            </span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            {isViewer ? 'Assigned Client Projects' : 'Client Projects'}
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            {isViewer
              ? 'Track real-time completion progress, milestone deliverables, and engineering updates for your assigned projects.'
              : 'Manage client engagements, update delivery progress, and publish milestone updates visible to both Developers and Viewers.'}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2.5 self-start md:self-center">
            {isAdmin && projects.length > 0 && (
              <button
                onClick={handleClearAllProjects}
                className="h-10 px-4 rounded-[12px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 transition-colors shrink-0 whitespace-nowrap"
              >
                <i className="fas fa-trash-can text-xs shrink-0"></i>
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-10 px-4 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
            >
              <i className="fas fa-plus text-xs badge-white shrink-0"></i>
              <span>New Client Project</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
              {isViewer ? 'Assigned Projects' : 'Active Client Projects'}
            </p>
            <h3 className="text-[28px] font-semibold tracking-tight text-[var(--apple-text-primary)] mt-0.5">
              {scopedProjects.length}
            </h3>
            <p className="text-[11px] text-[var(--apple-text-tertiary)] mt-0.5">
              {scopedProjects.filter(p => p.status === 'active').length} currently in active delivery
            </p>
          </div>
          <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-[#6B63F2] to-[#4139BF] flex items-center justify-center text-white shadow-sm">
            <i className="fas fa-diagram-project text-sm badge-white"></i>
          </div>
        </div>

        <div className="apple-card p-5 flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="text-[12px] font-medium text-[var(--apple-text-secondary)]">Average Completion</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h3 className="text-[28px] font-semibold tracking-tight text-[var(--apple-text-primary)]">
                {averageProgress}%
              </h3>
              <span className="text-[11px] font-semibold text-[#248A3D] dark:text-[#30D158]">On Track</span>
            </div>
            <div className="w-full h-1.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4e45e1] to-[#30D158] transition-all duration-700"
                style={{ width: `${averageProgress}%` }}
              ></div>
            </div>
          </div>
          <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-[#30D158] to-[#1E8E3E] flex items-center justify-center text-white shadow-sm shrink-0">
            <i className="fas fa-chart-line text-sm badge-white"></i>
          </div>
        </div>

        <div className="apple-card p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-[var(--apple-text-secondary)]">Published Updates</p>
            <h3 className="text-[28px] font-semibold tracking-tight text-[var(--apple-text-primary)] mt-0.5">
              {totalUpdatesCount}
            </h3>
            <p className="text-[11px] text-[var(--apple-text-tertiary)] mt-0.5">
              Shared between Developers & Viewers
            </p>
          </div>
          <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-[#FF9F0A] to-[#D97706] flex items-center justify-center text-white shadow-sm">
            <i className="fas fa-bolt text-sm badge-white"></i>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="apple-card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <i className="fas fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apple-text-tertiary)] text-xs"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name, client, or developer…"
            className="w-full apple-input pl-9 pr-4 py-2 text-[13px]"
          />
        </div>

        <div className="flex items-center gap-1.5 apple-subcard p-1 rounded-[12px] self-start sm:self-auto">
          {(['all', 'active', 'completed', 'archived'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-[9px] text-[12px] font-semibold capitalize transition-all ${
                statusFilter === st
                  ? 'bg-[#4e45e1] text-white shadow-sm badge-white'
                  : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Client Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, idx) => (
            <div key={idx} className="apple-card p-6 h-72 animate-pulse"></div>
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map((project) => {
            const latestUpdate = project.updates && project.updates.length > 0 ? project.updates[0] : null;
            return (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="apple-card apple-card-interactive p-6 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Card Top Metadata */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-[#6B63F2] to-[#4139BF] flex items-center justify-center text-white shadow-sm shrink-0">
                        <i className="fas fa-briefcase text-sm badge-white"></i>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                            {project.clientName || 'Enterprise Client'}
                          </span>
                          <span className="text-[11px] font-medium text-[var(--apple-text-tertiary)]">
                            {project.language}
                          </span>
                        </div>
                        <h3 className="text-[18px] font-semibold text-[var(--apple-text-primary)] group-hover:text-[var(--apple-blue)] transition-colors truncate mt-1">
                          {project.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${
                          project.status === 'active'
                            ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                            : project.status === 'completed'
                            ? 'bg-[#4e45e1]/12 text-[var(--apple-blue)]'
                            : 'apple-subcard text-[var(--apple-text-tertiary)]'
                        }`}
                      >
                        {project.status}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(project, e)}
                          title="Delete Project"
                          className="w-7 h-7 rounded-full apple-subcard text-[var(--apple-text-tertiary)] hover:text-[#FF3B30] flex items-center justify-center transition-colors"
                        >
                          <i className="fas fa-trash-can text-[11px]"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[13px] text-[var(--apple-text-secondary)] leading-relaxed line-clamp-2 mb-5">
                    {project.description}
                  </p>

                  {/* Progress Tracker Section */}
                  <div className="apple-subcard p-4 rounded-[16px] mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-semibold text-[var(--apple-text-primary)]">
                        Delivery Progress
                      </span>
                      <span className="text-[14px] font-bold text-[var(--apple-blue)]">
                        {project.progress}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#4e45e1] to-[#30D158] transition-all duration-700"
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[11px] text-[var(--apple-text-secondary)]">
                      <span>
                        <i className="fas fa-code text-[var(--apple-blue)] mr-1.5"></i>
                        Lead Dev: <strong className="text-[var(--apple-text-primary)]">{project.assignedDeveloper || 'System Alpha'}</strong>
                      </span>
                      <span>
                        <i className="fas fa-calendar-check text-[#30D158] mr-1.5"></i>
                        Target: <strong className="text-[var(--apple-text-primary)]">{project.dueDate || 'TBD'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Latest Project Update Preview */}
                  {latestUpdate ? (
                    <div className="apple-subcard p-4 rounded-[16px] border-l-4 border-l-[#4e45e1]">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-blue)] flex items-center gap-1.5">
                          <i className="fas fa-sparkles text-[10px]"></i>
                          Latest Update · {latestUpdate.timestamp || latestUpdate.date || 'Recent'}
                        </span>
                        <span className="text-[11px] font-medium text-[var(--apple-text-tertiary)]">
                          by {latestUpdate.author}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                        {latestUpdate.title}
                      </p>
                      <p className="text-[12px] text-[var(--apple-text-secondary)] line-clamp-2 mt-0.5">
                        {latestUpdate.summary}
                      </p>
                    </div>
                  ) : (
                    <div className="apple-subcard p-3.5 rounded-[14px] text-center text-[12px] text-[var(--apple-text-tertiary)]">
                      No milestone updates posted yet.
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="mt-5 pt-3.5 border-t border-[var(--apple-border)] flex items-center justify-between gap-3">
                  <span className="text-[12px] font-medium text-[var(--apple-blue)] group-hover:translate-x-0.5 transition-transform flex items-center gap-1.5">
                    <span>View Progress & Updates ({project.updates?.length || 0})</span>
                    <i className="fas fa-arrow-right text-[10px]"></i>
                  </span>

                  {canManage && (
                    <button
                      onClick={(e) => openUpdateModal(project, e)}
                      className="px-3.5 py-1.5 rounded-[10px] apple-secondary-btn text-[12px] font-semibold text-[var(--apple-blue)] hover:bg-[#4e45e1] hover:text-white transition-colors flex items-center gap-1.5"
                    >
                      <i className="fas fa-pen-to-square text-[11px]"></i>
                      <span>Post Update</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="apple-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#4e45e1]/10 text-[var(--apple-blue)] flex items-center justify-center mx-auto">
            <i className="fas fa-diagram-project text-xl"></i>
          </div>
          <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
            {scopedProjects.length === 0 ? 'No client projects yet' : 'No matching client projects'}
          </h3>
          <p className="text-[13px] text-[var(--apple-text-secondary)] max-w-md mx-auto">
            {scopedProjects.length === 0
              ? canManage
                ? 'Create your first client project to track milestones, completion progress, and client updates.'
                : 'No client projects have been assigned to your account yet.'
              : 'Try adjusting your search or status filter.'}
          </p>
          {scopedProjects.length === 0 && canManage && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 px-5 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center gap-2"
            >
              <i className="fas fa-plus text-xs badge-white"></i>
              <span>Create First Client Project</span>
            </button>
          )}
        </div>
      )}

      {/* Modal 1: Create New Client Project (Developer / Admin) */}
      {isCreateModalOpen && canManage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  New Client Project
                </h3>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Visible to Developers and assigned Client Viewers
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-7 h-7 rounded-full apple-subcard text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Project Name *
                  </label>
                  <input
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. Cloud Payments Core"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Client Organization *
                  </label>
                  <input
                    required
                    value={createForm.clientName}
                    onChange={(e) => setCreateForm({ ...createForm, clientName: e.target.value })}
                    placeholder="e.g. Sterling Bank Corp"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Project Scope & Deliverables *
                </label>
                <textarea
                  required
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Describe key client milestones and architecture goals…"
                  className="w-full apple-input px-3.5 py-2 text-[13px] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Tech Stack
                  </label>
                  <input
                    value={createForm.language}
                    onChange={(e) => setCreateForm({ ...createForm, language: e.target.value })}
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Target Due Date
                  </label>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Assigned Developer
                  </label>
                  <input
                    value={createForm.assignedDeveloper}
                    onChange={(e) => setCreateForm({ ...createForm, assignedDeveloper: e.target.value })}
                    placeholder="Developer Name"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Assigned Viewer (Email, Name, or 'Viewer')
                  </label>
                  <input
                    value={createForm.assignedViewer}
                    onChange={(e) => setCreateForm({ ...createForm, assignedViewer: e.target.value })}
                    placeholder="client@company.com or Viewer"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  <span>Initial Completion Progress</span>
                  <span className="font-semibold text-[var(--apple-blue)]">{createForm.progress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={createForm.progress}
                  onChange={(e) => setCreateForm({ ...createForm, progress: Number(e.target.value) })}
                  className="w-full accent-[#4e45e1] cursor-pointer"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold"
                >
                  Create Client Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Post Progress Update (Developer / Admin) */}
      {updatingProject && canManage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  Post Progress Update · {updatingProject.name}
                </h3>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Client: {updatingProject.clientName || 'Enterprise Client'}
                </p>
              </div>
              <button
                onClick={() => setUpdatingProject(null)}
                className="w-7 h-7 rounded-full apple-subcard text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form onSubmit={handlePostProgressUpdate} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  <span>Completion Progress</span>
                  <span className="font-bold text-[var(--apple-blue)]">{updateForm.progress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={updateForm.progress}
                  onChange={(e) => setUpdateForm({ ...updateForm, progress: Number(e.target.value) })}
                  className="w-full accent-[#4e45e1] cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Project Status
                  </label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value as Project['status'] })}
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Health Index ({updateForm.health}%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={updateForm.health}
                    onChange={(e) => setUpdateForm({ ...updateForm, health: Number(e.target.value) })}
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Milestone Headline *
                </label>
                <input
                  required
                  value={updateForm.updateTitle}
                  onChange={(e) => setUpdateForm({ ...updateForm, updateTitle: e.target.value })}
                  placeholder="e.g. Phase 2 API Integration & Load Testing Complete"
                  className="w-full apple-input px-3.5 py-2 text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Client-Facing Progress Summary *
                </label>
                <textarea
                  required
                  rows={3}
                  value={updateForm.updateSummary}
                  onChange={(e) => setUpdateForm({ ...updateForm, updateSummary: e.target.value })}
                  placeholder="Share key accomplishments, metrics, or next steps for the client and team…"
                  className="w-full apple-input px-3.5 py-2 text-[13px] resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setUpdatingProject(null)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold"
                >
                  Publish Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProjects;
