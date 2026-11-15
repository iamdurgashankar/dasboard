import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MetricCard, ContactSubmission, BlogPost, User, Project } from '../types';
import { api } from '../services/api';
import { generateMetricsSummary } from '../services/geminiService';
import { isProjectAssignedToViewer } from './ClientProjects';

interface DashboardHomeProps {
  currentUser?: User | null;
}

const FEATURE_CARDS_META = [
  {
    key: 'projects',
    label: 'Client Projects',
    icon: 'fa-diagram-project',
    tint: 'from-[#6B63F2] to-[#4139BF]',
    path: '/projects',
    subtitle: 'Client delivery & progress'
  },
  {
    key: 'contacts',
    label: 'Client Inquiries',
    icon: 'fa-envelope-open-text',
    tint: 'from-[#30D158] to-[#1E8E3E]',
    path: '/contacts',
    subtitle: 'Inbound leads & messages'
  },
  {
    key: 'blogs',
    label: 'Editorial Studio',
    icon: 'fa-pen-nib',
    tint: 'from-[#FF375F] to-[#D70015]',
    path: '/blogs',
    subtitle: 'Articles & live blog sync'
  },
  {
    key: 'users',
    label: 'Access & Users',
    icon: 'fa-user-shield',
    tint: 'from-[#5E5CE6] to-[#3634A3]',
    path: '/users',
    subtitle: 'Role permissions & accounts'
  },
  {
    key: 'team',
    label: 'Team Velocity',
    icon: 'fa-users',
    tint: 'from-[#BF5AF2] to-[#8944AB]',
    path: '/team',
    subtitle: 'Contributor output & flow'
  }
];

const DashboardHome: React.FC<DashboardHomeProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const isViewer = currentUser?.role === 'Viewer';

  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [aiSummary, setAiSummary] = useState<string>(
    'Synthesizing live signals across Client Projects, Client Inquiries, Editorial Studio, User Access, and Team Velocity...'
  );
  const [isLoading, setIsLoading] = useState(true);

  const loadOverviewData = async (silent: boolean = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [metricsRes, projectsRes, contactsRes, blogsRes, usersRes] = await Promise.all([
        api.dashboard.getMetrics().catch(() => ({ data: [] })),
        api.projects.list().catch(() => ({ data: [] })),
        api.contacts.list().catch(() => ({ data: [] })),
        api.blog.list().catch(() => ({ data: [] })),
        api.users.list().catch(() => ({ data: [] }))
      ]);

      const rawProjects = Array.isArray(projectsRes?.data) ? projectsRes.data : [];
      const rawContacts = Array.isArray(contactsRes?.data) ? contactsRes.data : [];
      const rawBlogs = Array.isArray(blogsRes?.data) ? blogsRes.data : [];
      const rawUsers = Array.isArray(usersRes?.data) ? usersRes.data : [];

      const mappedProjects: Project[] = rawProjects.map((p: any) => ({
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

      const mappedContacts: ContactSubmission[] = rawContacts.map((c: any) => ({
        id: String(c.id),
        name: c.name || 'Client',
        email: c.email || '',
        subject: c.subject || 'General Inquiry',
        message: c.message || '',
        date: c.created_at ? String(c.created_at).split(' ')[0] : 'Today',
        status: c.status || 'new',
        priority: c.priority || 'Medium'
      }));

      const mappedBlogs: BlogPost[] = rawBlogs.map((b: any) => ({
        id: String(b.id),
        slug: b.slug,
        title: b.title || 'Untitled Article',
        excerpt: b.excerpt || '',
        content: b.content || '',
        author: b.author_name || b.author || 'System Alpha',
        date: b.created_at ? String(b.created_at).split(' ')[0] : 'Today',
        status: b.status === 'published' ? 'synced' : (b.status || 'draft'),
        category: b.category || 'Engineering',
        tags: Array.isArray(b.tags) ? b.tags : []
      }));

      const mappedUsers: User[] = rawUsers.map((u: any) => ({
        id: String(u.id),
        name: u.name || 'Member',
        email: u.email || '',
        role: u.role || 'Developer',
        status: u.status || 'active',
        avatar: u.avatar,
        joinDate: u.joinDate ? String(u.joinDate).split(' ')[0] : 'Today'
      }));

      setProjects(mappedProjects);
      setContacts(mappedContacts);
      setBlogs(mappedBlogs);
      setUsers(mappedUsers);

      const avgProgress =
        mappedProjects.length > 0
          ? Math.round(mappedProjects.reduce((acc, p) => acc + (p.progress || 0), 0) / mappedProjects.length)
          : 0;
      const newInquiryCount = mappedContacts.filter(c => c.status === 'new').length;
      const publishedBlogCount = mappedBlogs.filter(b => b.status === 'synced' || b.status === 'published').length;
      const activeUserCount = mappedUsers.filter(u => u.status === 'active').length;
      const pendingUserCount = mappedUsers.filter(u => u.status === 'pending').length;

      const computedMetrics: MetricCard[] = [
        {
          label: 'Client Projects',
          value: mappedProjects.length,
          change: `${avgProgress}% avg`,
          trend: 'up',
          icon: 'fa-diagram-project'
        },
        {
          label: 'Client Inquiries',
          value: mappedContacts.length,
          change: `${newInquiryCount} unread`,
          trend: 'up',
          icon: 'fa-envelope-open-text'
        },
        {
          label: 'Editorial Studio',
          value: mappedBlogs.length,
          change: `${publishedBlogCount} live`,
          trend: 'up',
          icon: 'fa-pen-nib'
        },
        {
          label: 'Access & Users',
          value: mappedUsers.length,
          change: pendingUserCount > 0 ? `${pendingUserCount} pending` : 'Verified',
          trend: 'neutral',
          icon: 'fa-user-shield'
        },
        {
          label: 'Team Velocity',
          value: `${activeUserCount} Active`,
          change: '94% Flow',
          trend: 'up',
          icon: 'fa-users'
        }
      ];

      setMetrics(computedMetrics);

      if (!silent) {
        generateMetricsSummary({
          metrics: metricsRes?.data?.length ? metricsRes.data : computedMetrics,
          projectCount: mappedProjects.length,
          recentActivities: mappedContacts.length
        })
          .then(summary => {
            if (summary) setAiSummary(summary);
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Overview Sync Error:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewData(false);
    const interval = setInterval(() => loadOverviewData(true), 5000);
    const onFocus = () => loadOverviewData(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleQuickApproveUser = async (userId: string) => {
    try {
      await api.users.update({ id: userId, status: 'active' });
      loadOverviewData();
    } catch (err) {
      console.error('Quick approve failed:', err);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = currentUser?.name || 'Admin';
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  // Assigned projects and flattened updates for Viewer (and Developer overview)
  const viewerAssignedProjects = useMemo(() => {
    return projects.filter(p => isProjectAssignedToViewer(p, currentUser));
  }, [projects, currentUser]);

  const viewerFeedUpdates = useMemo(() => {
    const items: Array<{
      projectId: string;
      projectName: string;
      clientName: string;
      id: string;
      title: string;
      summary: string;
      author: string;
      authorRole?: string;
      progressAfter?: number;
      timestamp: string;
    }> = [];
    viewerAssignedProjects.forEach(p => {
      (p.updates || []).forEach(u => {
        items.push({
          projectId: p.id,
          projectName: p.name,
          clientName: p.clientName || 'Enterprise Client',
          id: u.id,
          title: u.title,
          summary: u.summary,
          author: u.author,
          authorRole: u.authorRole || 'Developer',
          progressAfter: u.progressAfter ?? u.progress,
          timestamp: u.timestamp || u.date || 'Recent'
        });
      });
    });
    return items;
  }, [viewerAssignedProjects]);

  const viewerAvgProgress = useMemo(() => {
    if (viewerAssignedProjects.length === 0) return 0;
    return Math.round(
      viewerAssignedProjects.reduce((acc, p) => acc + (Number(p.progress) || 0), 0) /
        viewerAssignedProjects.length
    );
  }, [viewerAssignedProjects]);

  // ============================================================================
  // VIEWER DASHBOARD INTERFACE: Shows ONLY Assigned Projects & Project Updates
  // ============================================================================
  if (isViewer) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-10">
        {/* Viewer Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)]">
                {formattedDate} · Client Project Portal
              </p>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                Viewer Dashboard
              </span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
              {getGreeting()}, {displayName.split(' ')[0]}
            </h1>
            <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5">
              Track your assigned client projects, live completion progress, and milestone updates from your engineering team.
            </p>
          </div>

          <button
            onClick={() => navigate('/projects')}
            className="px-4 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold flex items-center gap-2 self-start md:self-auto"
          >
            <i className="fas fa-diagram-project text-xs badge-white"></i>
            <span>View All Assigned Projects</span>
          </button>
        </div>

        {/* Viewer KPI Summary Cards (Strictly Project & Update Focused) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[var(--apple-text-secondary)]">
                Assigned Projects
              </p>
              <h3 className="text-[30px] font-semibold tracking-tight text-[var(--apple-text-primary)] mt-0.5">
                {viewerAssignedProjects.length}
              </h3>
              <p className="text-[11px] text-[var(--apple-text-tertiary)] mt-0.5">
                {viewerAssignedProjects.filter(p => p.status === 'active').length} active in delivery
              </p>
            </div>
            <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-[#6B63F2] to-[#4139BF] flex items-center justify-center text-white shadow-sm">
              <i className="fas fa-briefcase text-sm badge-white"></i>
            </div>
          </div>

          <div className="apple-card p-5 flex items-center justify-between">
            <div className="flex-1 pr-4">
              <p className="text-[13px] font-medium text-[var(--apple-text-secondary)]">
                Overall Completion
              </p>
              <h3 className="text-[30px] font-semibold tracking-tight text-[var(--apple-text-primary)] mt-0.5">
                {viewerAvgProgress}%
              </h3>
              <div className="w-full h-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#4e45e1] to-[#30D158] transition-all duration-700"
                  style={{ width: `${viewerAvgProgress}%` }}
                ></div>
              </div>
            </div>
            <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-[#30D158] to-[#1E8E3E] flex items-center justify-center text-white shadow-sm shrink-0">
              <i className="fas fa-chart-line text-sm badge-white"></i>
            </div>
          </div>

          <div className="apple-card p-5 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-[var(--apple-text-secondary)]">
                Milestone Updates
              </p>
              <h3 className="text-[30px] font-semibold tracking-tight text-[var(--apple-text-primary)] mt-0.5">
                {viewerFeedUpdates.length}
              </h3>
              <p className="text-[11px] text-[var(--apple-text-tertiary)] mt-0.5">
                Latest engineering progress logs
              </p>
            </div>
            <div className="w-11 h-11 rounded-[13px] bg-gradient-to-b from-[#5E5CE6] to-[#3634A3] flex items-center justify-center text-white shadow-sm">
              <i className="fas fa-bell text-sm badge-white"></i>
            </div>
          </div>
        </div>

        {/* Viewer Main Grid: Assigned Projects List + Chronological Project Updates Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Assigned Projects Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="apple-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#6B63F2] to-[#4139BF] flex items-center justify-center text-white shadow-sm">
                    <i className="fas fa-diagram-project text-xs badge-white"></i>
                  </div>
                  <div>
                    <h2 className="text-[17px] font-semibold text-[var(--apple-text-primary)]">
                      Your Assigned Projects
                    </h2>
                    <p className="text-[12px] text-[var(--apple-text-secondary)]">
                      Click any project to inspect full milestones and progress history
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/projects')}
                  className="text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 flex items-center gap-1"
                >
                  <span>All Projects</span>
                  <i className="fas fa-chevron-right text-[10px]"></i>
                </button>
              </div>

              <div className="space-y-4">
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="apple-subcard p-5 rounded-[16px] h-32 animate-pulse"></div>
                  ))
                ) : viewerAssignedProjects.length > 0 ? (
                  viewerAssignedProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="apple-subcard p-5 rounded-[18px] cursor-pointer group transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                              {project.clientName || 'Enterprise Client'}
                            </span>
                            <span className="text-[11px] text-[var(--apple-text-tertiary)]">
                              Lead Dev: {project.assignedDeveloper || 'System Alpha'}
                            </span>
                          </div>
                          <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)] group-hover:text-[var(--apple-blue)] transition-colors mt-1">
                            {project.name}
                          </h3>
                        </div>

                        <span
                          className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full shrink-0 ${
                            project.status === 'active'
                              ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                              : 'bg-[#4e45e1]/12 text-[var(--apple-blue)]'
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>

                      <p className="text-[13px] text-[var(--apple-text-secondary)] line-clamp-2 mb-4">
                        {project.description}
                      </p>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-medium text-[var(--apple-text-secondary)]">
                            Completion Progress
                          </span>
                          <span className="font-bold text-[var(--apple-blue)]">{project.progress}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#4e45e1] to-[#30D158] transition-all duration-700"
                            style={{ width: `${project.progress}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--apple-text-tertiary)] pt-1">
                          <span>Target Delivery: {project.dueDate || 'TBD'}</span>
                          <span className="text-[var(--apple-blue)] font-medium">
                            {project.updates?.length || 0} milestone updates →
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="apple-subcard p-8 rounded-[16px] text-center">
                    <p className="text-[14px] font-medium text-[var(--apple-text-secondary)]">
                      No projects assigned yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project Updates Stream Column (5 cols) */}
          <div className="lg:col-span-5">
            <div className="apple-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#30D158] to-[#1E8E3E] flex items-center justify-center text-white shadow-sm">
                    <i className="fas fa-bolt text-xs badge-white"></i>
                  </div>
                  <div>
                    <h2 className="text-[17px] font-semibold text-[var(--apple-text-primary)]">
                      Latest Project Updates
                    </h2>
                    <p className="text-[12px] text-[var(--apple-text-secondary)]">
                      Real-time milestone updates from Developers
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                {viewerFeedUpdates.length > 0 ? (
                  viewerFeedUpdates.map((upd) => (
                    <div
                      key={upd.id}
                      onClick={() => navigate(`/project/${upd.projectId}`)}
                      className="apple-subcard p-4 rounded-[16px] border-l-4 border-l-[#4e45e1] cursor-pointer hover:translate-x-0.5 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-semibold text-[var(--apple-blue)] truncate">
                          {upd.projectName}
                        </span>
                        <span className="text-[10px] text-[var(--apple-text-tertiary)] shrink-0">
                          {upd.timestamp}
                        </span>
                      </div>
                      <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                        {upd.title}
                      </p>
                      <p className="text-[12px] text-[var(--apple-text-secondary)] leading-relaxed mt-1">
                        {upd.summary}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-[var(--apple-border)] flex items-center justify-between text-[11px] text-[var(--apple-text-tertiary)]">
                        <span>By {upd.author}</span>
                        {upd.progressAfter !== undefined && (
                          <span className="font-semibold text-[#248A3D] dark:text-[#30D158]">
                            {upd.progressAfter}% Complete
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="apple-subcard p-8 rounded-[16px] text-center">
                    <p className="text-[13px] text-[var(--apple-text-secondary)]">
                      No project updates posted yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ADMIN & DEVELOPER OVERVIEW INTERFACE: Full Command Center + Client Projects
  // ============================================================================
  const newContactsCount = contacts.filter(c => c.status === 'new').length;
  const pendingUsersCount = users.filter(u => u.status === 'pending').length;
  const activeUsers = users.filter(u => u.status === 'active');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-8">
      {/* Top Apple Studio Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)] mb-1">
            {formattedDate} · Studio Overview
          </p>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            {getGreeting()}, {displayName.split(' ')[0]}
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            Unified command center for DI AI, Client Projects, Client Inquiries, Editorial Studio, User Access, and Team Velocity.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
          <button
            onClick={() => navigate('/projects')}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-diagram-project text-[var(--apple-blue)] text-xs shrink-0"></i>
            <span>Client Projects</span>
          </button>
          <button
            onClick={() => navigate('/inquire')}
            className="h-10 px-4 apple-pill-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-wand-magic-sparkles text-xs badge-white shrink-0"></i>
            <span>Launch DI AI</span>
          </button>
        </div>
      </div>

      {/* 5 Feature KPI Bento Widgets (Each linked to its Sidebar Feature) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {FEATURE_CARDS_META.map((feat, idx) => {
          const metric = metrics[idx] || {
            label: feat.label,
            value: '—',
            change: 'Synced',
            trend: 'up',
            icon: feat.icon
          };
          return (
            <div
              key={feat.key}
              onClick={() => navigate(feat.path)}
              className="apple-card apple-card-interactive p-5 cursor-pointer group flex flex-col justify-between h-full"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={`w-10 h-10 rounded-[12px] bg-gradient-to-b ${feat.tint} flex items-center justify-center text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_4px_12px_rgba(0,0,0,0.18)]`}
                  >
                    <i className={`fas ${feat.icon} text-sm badge-white`}></i>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full apple-subcard text-[var(--apple-text-secondary)] group-hover:text-[var(--apple-blue)] transition-colors whitespace-nowrap shrink-0">
                    {metric.change}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-[var(--apple-text-secondary)] text-[13px] font-semibold truncate">
                    {feat.label}
                  </p>
                  <h3 className="text-[28px] font-bold tracking-tight text-[var(--apple-text-primary)] leading-tight mt-1">
                    {metric.value}
                  </h3>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--apple-border)] flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-[var(--apple-text-tertiary)] truncate">
                  {feat.subtitle}
                </p>
                <i className="fas fa-arrow-up-right-from-square text-[10px] text-[var(--apple-text-tertiary)] group-hover:text-[var(--apple-blue)] transition-colors shrink-0"></i>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature 1: DI AI Copilot Banner (/inquire) */}
      <div className="apple-card p-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-60 h-60 bg-gradient-to-br from-[#6B63F2]/15 via-[#5E5CE6]/15 to-[#BF5AF2]/15 blur-3xl rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4 max-w-3xl">
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-[#BF5AF2] via-[#5E5CE6] to-[#6B63F2] flex items-center justify-center shrink-0 text-white shadow-md">
              <i className="fas fa-wand-magic-sparkles text-base badge-white"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  DI AI Copilot
                </h3>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                  Gemini 3 Pro Ready
                </span>
              </div>
              <p className="text-[14px] leading-relaxed text-[var(--apple-text-secondary)]">
                “{aiSummary}”
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { label: 'Explain Code', icon: 'fa-book-open' },
                  { label: 'Security Audit', icon: 'fa-shield-halved' },
                  { label: 'Optimize Logic', icon: 'fa-bolt' },
                  { label: 'Write Unit Tests', icon: 'fa-vial' }
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => navigate('/inquire')}
                    className="px-3 py-1.5 rounded-full apple-subcard text-[12px] font-medium text-[var(--apple-text-secondary)] hover:text-[var(--apple-blue)] flex items-center gap-1.5"
                  >
                    <i className={`fas ${chip.icon} text-[10px] text-[var(--apple-blue)]`}></i>
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/inquire')}
            className="px-5 py-3 apple-pill-btn rounded-[14px] text-[13px] font-semibold shrink-0 self-start lg:self-center inline-flex items-center gap-2"
          >
            <span>Open DI AI</span>
            <i className="fas fa-arrow-right text-xs badge-white"></i>
          </button>
        </div>
      </div>

      {/* Feature 2: Client Projects & Live Progress Tracker (/projects) */}
      <div className="apple-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#6B63F2] to-[#4139BF] flex items-center justify-center text-white shadow-sm">
              <i className="fas fa-diagram-project text-xs badge-white"></i>
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-[var(--apple-text-primary)] tracking-tight">
                Client Projects & Live Progress
              </h3>
              <p className="text-[12px] text-[var(--apple-text-secondary)]">
                Shared milestone tracking between Developers and Client Viewers
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Manage Client Projects</span>
            <i className="fas fa-chevron-right text-[10px]"></i>
          </button>
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.slice(0, 3).map((proj) => {
              const latest = proj.updates && proj.updates.length > 0 ? proj.updates[0] : null;
              return (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/project/${proj.id}`)}
                  className="apple-subcard p-4 rounded-[16px] cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)] truncate">
                        {proj.clientName || 'Enterprise Client'}
                      </span>
                      <span className="text-[12px] font-bold text-[var(--apple-blue)]">
                        {proj.progress}%
                      </span>
                    </div>
                    <h4 className="text-[15px] font-semibold text-[var(--apple-text-primary)] group-hover:text-[var(--apple-blue)] transition-colors truncate">
                      {proj.name}
                    </h4>
                    <div className="w-full h-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden my-2.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#4e45e1] to-[#30D158] transition-all duration-700"
                        style={{ width: `${proj.progress}%` }}
                      ></div>
                    </div>
                    {latest && (
                      <p className="text-[12px] text-[var(--apple-text-secondary)] line-clamp-2 mt-1">
                        <strong className="text-[var(--apple-text-primary)]">Update:</strong> {latest.title}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-[var(--apple-border)] flex items-center justify-between text-[11px] text-[var(--apple-text-tertiary)]">
                    <span>Dev: {proj.assignedDeveloper || 'Admin'}</span>
                    <span>Due {proj.dueDate || 'TBD'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="apple-subcard rounded-[16px] p-8 text-center">
            <i className="fas fa-diagram-project text-2xl text-[var(--apple-text-tertiary)] mb-2"></i>
            <p className="text-[13px] font-medium text-[var(--apple-text-secondary)]">
              No client projects added yet
            </p>
            <p className="text-[12px] text-[var(--apple-text-tertiary)] mt-0.5 mb-4">
              Add a client project to track milestones and share live progress updates with Developers and Viewers.
            </p>
            <button
              onClick={() => navigate('/projects')}
              className="px-4 py-2 apple-pill-btn rounded-[10px] text-[12px] font-semibold inline-flex items-center gap-1.5"
            >
              <i className="fas fa-plus text-[10px] badge-white"></i>
              <span>Add Client Project</span>
            </button>
          </div>
        )}
      </div>

      {/* Feature 3 & Feature 4: Client Inquiries (/contacts) + Editorial Studio (/blogs) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Inquiries Bento Card */}
        <div className="apple-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#30D158] to-[#248A3D] flex items-center justify-center text-white shadow-sm">
                  <i className="fas fa-envelope-open-text text-xs badge-white"></i>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[var(--apple-text-primary)] tracking-tight">
                    Client Inquiries
                  </h3>
                  <p className="text-[12px] text-[var(--apple-text-secondary)]">
                    {newContactsCount} unread · {contacts.length} total inbound leads
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/contacts')}
                className="text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 flex items-center gap-1"
              >
                <span>Open Ledger</span>
                <i className="fas fa-chevron-right text-[10px]"></i>
              </button>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="apple-subcard p-4 rounded-[16px] animate-pulse h-16"></div>
                ))
              ) : contacts.length > 0 ? (
                contacts.slice(0, 4).map((inquiry) => (
                  <div
                    key={inquiry.id}
                    onClick={() => navigate('/contacts')}
                    className="apple-subcard p-4 rounded-[16px] cursor-pointer flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] group-hover:text-[var(--apple-blue)] transition-colors truncate">
                          {inquiry.name}
                        </p>
                        <span className="text-[11px] text-[var(--apple-text-tertiary)] truncate">
                          {inquiry.email}
                        </span>
                      </div>
                      <p className="text-[13px] text-[var(--apple-text-secondary)] truncate mt-0.5">
                        {inquiry.subject}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                          inquiry.status === 'new'
                            ? 'bg-[#4e45e1]/12 text-[var(--apple-blue)]'
                            : inquiry.status === 'replied'
                            ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                            : 'apple-subcard text-[var(--apple-text-tertiary)]'
                        }`}
                      >
                        {inquiry.status}
                      </span>
                      <span className="text-[11px] text-[var(--apple-text-tertiary)]">{inquiry.date}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="apple-subcard rounded-[16px] p-8 text-center">
                  <i className="fas fa-inbox text-2xl text-[var(--apple-text-tertiary)] mb-2"></i>
                  <p className="text-[13px] font-medium text-[var(--apple-text-secondary)]">
                    No client inquiries yet
                  </p>
                  <p className="text-[12px] text-[var(--apple-text-tertiary)] mt-0.5">
                    New leads submitted from devinquire.com will appear here automatically.
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate('/contacts')}
            className="w-full mt-5 pt-3.5 border-t border-[var(--apple-border)] text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 transition-opacity text-center"
          >
            Manage Client Inquiries →
          </button>
        </div>

        {/* Editorial Studio (Blog Manager) Bento Card */}
        <div className="apple-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#FF375F] to-[#D70015] flex items-center justify-center text-white shadow-sm">
                  <i className="fas fa-pen-nib text-xs badge-white"></i>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[var(--apple-text-primary)] tracking-tight">
                    Editorial Studio
                  </h3>
                  <p className="text-[12px] text-[var(--apple-text-secondary)]">
                    {blogs.length} articles · Synced with devinquire.com/blog
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/blogs')}
                className="text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 flex items-center gap-1"
              >
                <span>New Article</span>
                <i className="fas fa-plus text-[10px]"></i>
              </button>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="apple-subcard p-4 rounded-[16px] animate-pulse h-16"></div>
                ))
              ) : blogs.length > 0 ? (
                blogs.slice(0, 4).map((post) => (
                  <div
                    key={post.id}
                    onClick={() => navigate('/blogs')}
                    className="apple-subcard p-4 rounded-[16px] cursor-pointer flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                          {post.category}
                        </span>
                        <span className="text-[11px] text-[var(--apple-text-tertiary)]">
                          by {post.author}
                        </span>
                      </div>
                      <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] group-hover:text-[var(--apple-blue)] transition-colors truncate">
                        {post.title}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                          post.status === 'synced' || post.status === 'published'
                            ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                            : 'bg-[#FF9500]/15 text-[#FF9500]'
                        }`}
                      >
                        {post.status === 'synced' ? 'Published' : post.status}
                      </span>
                      <span className="text-[11px] text-[var(--apple-text-tertiary)]">{post.date}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="apple-subcard rounded-[16px] p-8 text-center">
                  <i className="fas fa-newspaper text-2xl text-[var(--apple-text-tertiary)] mb-2"></i>
                  <p className="text-[13px] font-medium text-[var(--apple-text-secondary)]">
                    No articles published yet
                  </p>
                  <p className="text-[12px] text-[var(--apple-text-tertiary)] mt-0.5">
                    Draft articles with AI assistance and publish directly to devinquire.com.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-[var(--apple-border)] flex items-center justify-between">
            <button
              onClick={() => navigate('/blogs')}
              className="text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 transition-opacity"
            >
              Open Editorial Studio →
            </button>
            <a
              href="https://devinquire.com/blog"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-[var(--apple-text-secondary)] hover:text-[var(--apple-blue)] flex items-center gap-1.5"
            >
              <span>devinquire.com/blog</span>
              <i className="fas fa-arrow-up-right-from-square text-[10px]"></i>
            </a>
          </div>
        </div>
      </div>

      {/* Feature 5 & Feature 6: Access & Users (/users) + Team Velocity (/team) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Access & Users Bento Card */}
        <div className="apple-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#5E5CE6] to-[#3634A3] flex items-center justify-center text-white shadow-sm">
                  <i className="fas fa-user-shield text-xs badge-white"></i>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[var(--apple-text-primary)] tracking-tight">
                    Access & Users
                  </h3>
                  <p className="text-[12px] text-[var(--apple-text-secondary)]">
                    {activeUsers.length} active members · {pendingUsersCount} pending approval
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/users')}
                className="text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 flex items-center gap-1"
              >
                <span>Directory</span>
                <i className="fas fa-chevron-right text-[10px]"></i>
              </button>
            </div>

            <div className="space-y-2.5">
              {users.slice(0, 4).map((u) => {
                const avatarUrl =
                  u.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=4e45e1&color=fff&bold=true`;
                return (
                  <div
                    key={u.id}
                    className="apple-subcard p-3.5 rounded-[15px] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={avatarUrl}
                        alt={u.name}
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-[var(--apple-border)]"
                      />
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] truncate">
                          {u.name}
                        </p>
                        <p className="text-[12px] text-[var(--apple-text-tertiary)] truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {u.status === 'pending' ? (
                        <button
                          onClick={() => handleQuickApproveUser(u.id)}
                          className="px-3 py-1 rounded-full bg-[#28CD41] text-white text-[11px] font-semibold shadow-sm hover:opacity-90"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                          {u.role}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => navigate('/users')}
            className="w-full mt-5 pt-3.5 border-t border-[var(--apple-border)] text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 transition-opacity text-center"
          >
            Manage Roles & Permissions →
          </button>
        </div>

        {/* Team Velocity Bento Card */}
        <div className="apple-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#BF5AF2] to-[#8944AB] flex items-center justify-center text-white shadow-sm">
                  <i className="fas fa-users text-xs badge-white"></i>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold text-[var(--apple-text-primary)] tracking-tight">
                    Team Velocity
                  </h3>
                  <p className="text-[12px] text-[var(--apple-text-secondary)]">
                    Engineering output, code quality, and squad collaboration
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]">
                94% Efficiency
              </span>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Code Quality & Architecture', score: 96, color: '#4e45e1' },
                { label: 'Review & PR Turnaround', score: 91, color: '#5856D6' },
                { label: 'Editorial & Documentation', score: 89, color: '#AF52DE' },
                { label: 'Client Response SLA', score: 98, color: '#28CD41' }
              ].map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-[var(--apple-text-primary)]">{item.label}</span>
                    <span className="font-mono text-[12px] font-semibold text-[var(--apple-text-secondary)]">
                      {item.score}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${item.score}%`, backgroundColor: item.color }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/team')}
            className="w-full mt-5 pt-3.5 border-t border-[var(--apple-border)] text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 transition-opacity text-center"
          >
            Open Team Velocity Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
