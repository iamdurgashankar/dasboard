
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Project, ProjectComment, ProjectIssue } from '../types';

import { api } from '../services/api';

const PULSE_DATA = [
  { time: '08:00', commits: 2, coverage: 92 },
  { time: '10:00', commits: 5, coverage: 92 },
  { time: '12:00', commits: 3, coverage: 93 },
  { time: '14:00', commits: 8, coverage: 93 },
  { time: '16:00', commits: 4, coverage: 94 },
  { time: '18:00', commits: 6, coverage: 94 },
  { time: '20:00', commits: 1, coverage: 94 },
];

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  const [editFormData, setEditFormData] = useState<Partial<Project>>({});
  const [newComment, setNewComment] = useState('');
  const [newIssueComment, setNewIssueComment] = useState('');

  const [issueFormData, setIssueFormData] = useState<Partial<ProjectIssue>>({
    title: '',
    description: '',
    assignee: 'Lead Architect',
    priority: 'Medium',
    status: 'Open'
  });

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      try {
        setIsLoading(true);
        const result = await api.projects.get(projectId);
        setProject(result.data);
      } catch (err) {
        console.error("Project Sync Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const uniqueAssignees = useMemo(() => {
    const assignees = new Set<string>();
    project?.issues?.forEach(issue => {
      if (issue.assignee) assignees.add(issue.assignee);
    });
    return Array.from(assignees).sort();
  }, [project?.issues]);

  const filteredIssues = useMemo(() => {
    if (filterAssignee === 'all') return project?.issues || [];
    return (project?.issues || []).filter(issue => issue.assignee === filterAssignee);
  }, [project?.issues, filterAssignee]);

  const selectedIssue = useMemo(() =>
    project?.issues?.find(i => i.id === selectedIssueId),
    [project, selectedIssueId]);

  const handleOpenEdit = () => {
    setEditFormData({ ...project });
    setIsEditModalOpen(true);
  };

  const handleUpdateProject = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = { ...project, ...editFormData, lastUpdate: 'Just now' } as Project;
    setProject(updated);
    setIsEditModalOpen(false);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: ProjectComment = {
      id: Date.now().toString(),
      user: 'Alex Dev',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Dev&background=6366f1&color=fff&bold=true',
      text: newComment,
      timestamp: 'Just now'
    };

    setProject(prev => ({
      ...prev,
      comments: [comment, ...(prev.comments || [])]
    }));
    setNewComment('');
  };

  const handleAddIssueComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueComment.trim() || !selectedIssueId) return;

    const comment: ProjectComment = {
      id: Date.now().toString(),
      user: 'Alex Dev',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Dev&background=6366f1&color=fff&bold=true',
      text: newIssueComment,
      timestamp: 'Just now'
    };

    setProject(prev => ({
      ...prev,
      issues: prev.issues?.map(issue =>
        issue.id === selectedIssueId
          ? { ...issue, comments: [comment, ...(issue.comments || [])] }
          : issue
      )
    }));
    setNewIssueComment('');
  };

  const handleUpdateIssueStatus = (status: ProjectIssue['status']) => {
    if (!selectedIssueId) return;
    setProject(prev => ({
      ...prev,
      issues: prev.issues?.map(i => i.id === selectedIssueId ? { ...i, status } : i)
    }));
  };

  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueFormData.title) return;

    const newIssue: ProjectIssue = {
      id: `ISS-${Math.floor(Math.random() * 900) + 100}`,
      title: issueFormData.title,
      description: issueFormData.description || 'No description provided.',
      assignee: issueFormData.assignee || 'Unassigned',
      status: issueFormData.status as any || 'Open',
      priority: issueFormData.priority as any || 'Medium',
      createdDate: new Date().toISOString().split('T')[0],
      comments: []
    };

    setProject(prev => ({
      ...prev,
      issues: [newIssue, ...(prev.issues || [])]
    }));
    setIsIssueModalOpen(false);
    setIssueFormData({ title: '', description: '', assignee: 'Lead Architect', priority: 'Medium', status: 'Open' });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center animate-pulse">
          <i className="fas fa-cubes text-3xl text-indigo-400"></i>
        </div>
        <div className="space-y-2 text-center">
          <div className="h-4 bg-slate-800 w-48 rounded mx-auto animate-pulse"></div>
          <div className="h-3 bg-slate-800/50 w-32 rounded mx-auto animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-center">
          <i className="fas fa-radar text-3xl text-rose-500"></i>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-100">Telemetry Lost</h2>
          <p className="text-sm text-slate-500 mt-2">The requested project index is unreachable or decommissioned.</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all"
        >
          Return to Hub
        </button>
      </div>
    );
  }

  const openRepository = () => {
    if (project.repoUrl && project.repoUrl !== '#') {
      window.open(project.repoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="space-y-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
          >
            <i className="fas fa-arrow-left"></i> Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
              <i className="fas fa-cubes text-2xl text-indigo-400"></i>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-100">{project.name}</h1>
                <span className="px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {project.language}
                </span>
                <button
                  onClick={handleOpenEdit}
                  className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"
                  title="Edit project details"
                >
                  <i className="fas fa-edit"></i>
                </button>
                <button
                  onClick={openRepository}
                  className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-800 transition-all ml-2"
                >
                  <i className="fab fa-github"></i> View Repo
                </button>
              </div>
              <p className="text-slate-400 mt-1 max-w-2xl">{project.description}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Completion Progress Widget */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col min-w-[160px] relative overflow-hidden group">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Milestone Completion</span>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-indigo-400">{project.progress}%</span>
              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${project.progress}%` }}></div>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500/20 group-hover:bg-indigo-500/40 transition-colors"></div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center min-w-[120px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Health Score</span>
            <span className={`text-2xl font-black ${project.health > 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {project.health}%
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center min-w-[120px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</span>
            <span className={`text-sm font-bold uppercase tracking-widest ${project.status === 'active' ? 'text-emerald-400' : 'text-slate-400'
              }`}>
              {project.status}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold">Activity Pulse</h3>
                <p className="text-xs text-slate-500">Commits vs Test Coverage (Last 24h)</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Commits</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Coverage %</span>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={PULSE_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} domain={[90, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="commits" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 8 }} />
                  <Line yAxisId="right" type="monotone" dataKey="coverage" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Issue Tracker Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <h3 className="text-lg font-bold flex items-center gap-3">
                <i className="fas fa-bug text-indigo-400"></i> Issue Tracker
              </h3>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <select
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                    className="appearance-none bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl px-5 py-2.5 pr-10 text-[10px] font-black uppercase tracking-widest text-slate-300 outline-none transition-all cursor-pointer shadow-inner"
                  >
                    <option value="all">All Contributors</option>
                    {uniqueAssignees.map(assignee => (
                      <option key={assignee} value={assignee}>{assignee}</option>
                    ))}
                  </select>
                  <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-indigo-500 pointer-events-none"></i>
                </div>

                <button
                  onClick={() => setIsIssueModalOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-indigo-600/20 whitespace-nowrap"
                >
                  <i className="fas fa-plus mr-2"></i> New Issue
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Assignee</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredIssues.length > 0 ? filteredIssues.map((issue) => (
                    <tr
                      key={issue.id}
                      onClick={() => setSelectedIssueId(issue.id)}
                      className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-4 text-xs font-mono text-indigo-400">{issue.id}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
                        {issue.title}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-indigo-400">
                            <i className="fas fa-user-circle"></i>
                          </div>
                          {issue.assignee}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${issue.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-400' :
                          issue.status === 'In Progress' ? 'bg-indigo-500/10 text-indigo-400' :
                            issue.status === 'Review' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-slate-800 text-slate-500'
                          }`}>
                          {issue.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-xs text-slate-500 font-mono">{issue.createdDate}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-24 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <i className="fas fa-filter-circle-xmark text-4xl mb-4 text-slate-600"></i>
                          <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                            No issues found for this contributor
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discussion & Engineering Logs (Project Level) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-3">
              <i className="fas fa-comments text-indigo-400"></i> Engineering Logs
            </h3>

            <form onSubmit={handleAddComment} className="mb-8">
              <div className="flex gap-4">
                <img
                  src="https://ui-avatars.com/api/?name=Alex+Dev&background=6366f1&color=fff&bold=true"
                  className="w-10 h-10 rounded-full border border-slate-700"
                  alt="Current User"
                />
                <div className="flex-1 space-y-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Log a technical update or leave a comment..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all resize-none min-h-[80px]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-all shadow-lg shadow-indigo-600/20"
                    >
                      Post Update
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className="space-y-6">
              {project.comments && project.comments.length > 0 ? project.comments.map((comment) => (
                <div key={comment.id} className="flex gap-4 group animate-in slide-in-from-bottom-2 duration-300">
                  <img src={comment.avatar} className="w-10 h-10 rounded-full border border-slate-800 object-cover" alt={comment.user} />
                  <div className="flex-1 bg-slate-950/40 border border-slate-800/60 p-4 rounded-2xl group-hover:border-slate-700 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-100">{comment.user}</span>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              )) : (
                <div className="py-12 text-center">
                  <i className="fas fa-comment-slash text-3xl text-slate-800 mb-4 block"></i>
                  <p className="text-slate-500 font-medium">No updates logged yet for this project.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-bold mb-6 uppercase tracking-widest text-slate-500">Top Contributors</h3>
            <div className="space-y-5">
              {[
                { name: 'Sarah Chen', commits: 142, impact: '+18k lines', avatar: 'https://picsum.photos/seed/sarah/100' },
                { name: 'David Kim', commits: 98, impact: '+12k lines', avatar: 'https://picsum.photos/seed/david/100' },
                { name: 'Mike Ross', commits: 45, impact: '+3k lines', avatar: 'https://picsum.photos/seed/mike/100' },
              ].map((c, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <img src={c.avatar} className="w-10 h-10 rounded-full border border-slate-700 shadow-sm" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{c.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{c.commits} Commits</p>
                  </div>
                  <div className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/5 px-2 py-1 rounded-lg">
                    {c.impact}
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-all">
              View All Contributors
            </button>
          </div>

          <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-3xl p-6">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-indigo-400">
              <i className="fas fa-microchip text-xs"></i> Resource Allocation
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                  <span>Build Time</span>
                  <span className="text-slate-300">2.4m avg</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[70%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                  <span>Storage (Artifacts)</span>
                  <span className="text-slate-300">12.4 GB</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[45%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Project Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-100">
                <i className="fas fa-project-diagram text-indigo-400"></i> Mission Parameters
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-2">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleUpdateProject} className="p-6 sm:p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Project Identity</label>
                <input required value={editFormData.name || ''} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</label>
                <textarea required rows={3} value={editFormData.description || ''} onChange={e => setEditFormData({ ...editFormData, description: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Health Score ({editFormData.health}%)</label>
                  <input type="range" min="0" max="100" value={editFormData.health || 0} onChange={e => setEditFormData({ ...editFormData, health: parseInt(e.target.value) })} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Progress ({editFormData.progress}%)</label>
                  <input type="range" min="0" max="100" value={editFormData.progress || 0} onChange={e => setEditFormData({ ...editFormData, progress: parseInt(e.target.value) })} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-all uppercase tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all text-white uppercase tracking-widest">Apply Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Issue Modal */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-100">
                <i className="fas fa-plus-circle text-indigo-400"></i> Log New Issue
              </h3>
              <button onClick={() => setIsIssueModalOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-2">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleCreateIssue} className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Issue Title</label>
                <input required autoFocus value={issueFormData.title} onChange={e => setIssueFormData({ ...issueFormData, title: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" placeholder="Brief summary of the problem" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detailed Context</label>
                <textarea rows={4} value={issueFormData.description} onChange={e => setIssueFormData({ ...issueFormData, description: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all resize-none" placeholder="Provide logs or reproduction steps..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Priority</label>
                  <select value={issueFormData.priority} onChange={e => setIssueFormData({ ...issueFormData, priority: e.target.value as any })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all">
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Initial Status</label>
                  <select value={issueFormData.status} onChange={e => setIssueFormData({ ...issueFormData, status: e.target.value as any })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all">
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Review">Review</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Assignee</label>
                <input value={issueFormData.assignee} onChange={e => setIssueFormData({ ...issueFormData, assignee: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsIssueModalOpen(false)} className="flex-1 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-all uppercase tracking-widest">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all text-white uppercase tracking-widest">Create Issue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Detail View Modal (The "Jira Console") */}
      {selectedIssue && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] sm:rounded-[2rem] w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 my-auto">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono font-bold text-indigo-400 px-3 py-1 bg-indigo-400/10 rounded-lg border border-indigo-400/20">
                  {selectedIssue.id}
                </span>
                <div className="h-4 w-px bg-slate-800"></div>
                <h3 className="text-lg font-bold text-slate-100 truncate max-w-md">{selectedIssue.title}</h3>
              </div>
              <button
                onClick={() => setSelectedIssueId(null)}
                className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
              {/* Left Column: Details & Comments */}
              <div className="flex-1 p-6 sm:p-8 space-y-8 sm:space-y-10 lg:border-r border-slate-800/50">
                <section>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Description</h4>
                  <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800/60 text-sm text-slate-300 leading-relaxed min-h-[120px]">
                    {selectedIssue.description || "No description provided for this issue."}
                  </div>
                </section>

                <section className="space-y-6">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ticket Conversation</h4>

                  {/* Issue Comment Input */}
                  <form onSubmit={handleAddIssueComment} className="flex gap-4 mb-8">
                    <img
                      src="https://ui-avatars.com/api/?name=Alex+Dev&background=6366f1&color=fff&bold=true"
                      className="w-8 h-8 rounded-full border border-slate-800 shadow-md"
                      alt=""
                    />
                    <div className="flex-1 space-y-3">
                      <textarea
                        value={newIssueComment}
                        onChange={(e) => setNewIssueComment(e.target.value)}
                        placeholder="Add a comment to this ticket..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs focus:border-indigo-500 outline-none transition-all resize-none min-h-[60px]"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!newIssueComment.trim()}
                          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white transition-all shadow-md"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Comment Feed */}
                  <div className="space-y-6">
                    {selectedIssue.comments && selectedIssue.comments.length > 0 ? selectedIssue.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-4 animate-in slide-in-from-left-2 duration-300">
                        <img src={comment.avatar} className="w-8 h-8 rounded-full border border-slate-800" alt="" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-200">{comment.user}</span>
                            <span className="text-[9px] font-bold text-slate-600 uppercase">{comment.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{comment.text}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-6 opacity-30">
                        <p className="text-xs font-medium">No comments yet on this ticket.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column: Sidebar Metadata */}
              <div className="w-full lg:w-80 p-6 sm:p-8 bg-slate-950/20 space-y-6 sm:space-y-8 lg:border-l border-slate-800/30">
                <section className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workflow State</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {(['Open', 'In Progress', 'Review', 'Closed'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleUpdateIssueStatus(status)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${selectedIssue.status === status
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-6 pt-6 border-t border-slate-800/50">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Priority</h4>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${selectedIssue.priority === 'Critical' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                      selectedIssue.priority === 'High' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                      <i className="fas fa-flag"></i> {selectedIssue.priority}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Assignee</h4>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 border border-slate-700 shadow-sm">
                        <i className="fas fa-user-circle"></i>
                      </div>
                      <span className="text-xs font-bold text-slate-200">{selectedIssue.assignee}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Created</h4>
                    <p className="text-[10px] font-mono text-slate-500">{selectedIssue.createdDate}</p>
                  </div>
                </section>

                <div className="pt-20">
                  <div className="p-4 bg-indigo-600/5 rounded-2xl border border-indigo-500/10 text-center">
                    <i className="fas fa-shield-halved text-indigo-400 text-lg mb-2"></i>
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Audit Trail Active</p>
                    <p className="text-[8px] text-slate-700 font-medium mt-1">Updates are immutable in the ledger.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
