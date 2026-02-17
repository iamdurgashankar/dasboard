
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { MetricCard, ActivityItem, Project, User } from '../types';
import { api } from '../services/api';
import { generateMetricsSummary } from '../services/geminiService';

interface DashboardHomeProps {
  currentUser?: User | null;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("Analyzing real-time production signals...");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', language: 'TypeScript' });

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        const [metricsRes, projectsRes, activityRes] = await Promise.all([
          api.dashboard.getMetrics(),
          api.projects.list(),
          api.dashboard.getActivity()
        ]);

        setMetrics(metricsRes.data);
        setProjects(projectsRes.data);
        setActivities(activityRes.data);

        // Generate AI Summary based on real data
        const summary = await generateMetricsSummary({
          metrics: metricsRes.data,
          projectCount: projectsRes.data.length,
          recentActivities: activityRes.data.length
        });
        setAiSummary(summary);
      } catch (err) {
        console.error("Dashboard Sync Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Listen for AI Automation Commands (Modified to stay synced with backend patterns later)
  useEffect(() => {
    const handleAICreate = (e: any) => {
      const { name, description, language } = e.detail;
      // In production, this should trigger an API call. For now we update local state and show a toast
      // For immediate feedback
      const project: Project = {
        id: Date.now().toString(),
        name,
        description,
        language,
        status: 'active',
        health: 100,
        progress: 0,
        lastUpdate: 'Just now'
      };
      setProjects(prev => [project, ...prev]);
    };

    window.addEventListener('ai-create-project', handleAICreate);
    return () => window.removeEventListener('ai-create-project', handleAICreate);
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;

    try {
      const res = await api.projects.create(newProject);
      if (res.status === 'success') {
        setIsModalOpen(false);
        setNewProject({ name: '', description: '', language: 'TypeScript' });
        // Re-fetch all dashboard data to stay synced
        const [metricsRes, projectsRes, activityRes] = await Promise.all([
          api.dashboard.getMetrics(),
          api.projects.list(),
          api.dashboard.getActivity()
        ]);
        setMetrics(metricsRes.data);
        setProjects(projectsRes.data);
        setActivities(activityRes.data);
      }
    } catch (err) {
      console.error("Project creation error:", err);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = currentUser?.name || 'Alex';

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{getGreeting()}, {displayName.split(' ')[0]}.</h1>
          <p className="text-slate-400">Here is what's happening across your {projects.length} projects today.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
            <i className="fas fa-download mr-2"></i> Export
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-indigo-600/20"
          >
            <i className="fas fa-plus mr-2"></i> New Project
          </button>
        </div>
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-slate-700 transition-all group shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600/20 group-hover:text-indigo-400 transition-colors">
                <i className={`fas ${metric.icon}`}></i>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${metric.trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                {metric.change}
              </span>
            </div>
            <p className="text-slate-400 text-sm font-medium">{metric.label}</p>
            <h3 className="text-2xl font-bold mt-1">{metric.value}</h3>
          </div>
        ))}
      </div>

      {/* Projects List Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Active Projects</h3>
          <button className="text-xs text-indigo-400 font-bold uppercase tracking-wider hover:text-indigo-300">View All</button>
        </div>
        {/* Project Grid */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Neural Project Index</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 p-5 rounded-xl animate-pulse">
                  <div className="h-4 bg-slate-800 w-1/2 rounded mb-4"></div>
                  <div className="h-3 bg-slate-800 w-3/4 rounded mb-2"></div>
                  <div className="h-3 bg-slate-800 w-1/4 rounded mb-4"></div>
                  <div className="h-6 bg-slate-800 w-full rounded"></div>
                </div>
              ))
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="bg-slate-950/40 border border-slate-800/60 p-5 rounded-xl hover:border-indigo-500/50 hover:bg-slate-900/60 transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${project.health > 95 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      <h4 className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{project.name}</h4>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-md font-mono">{project.language}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 h-8">{project.description}</p>
                  <div className="flex items-center justify-between border-t border-slate-800/50 pt-3">
                    <div className="flex items-center gap-1.5">
                      <i className="fas fa-heart-pulse text-[10px] text-emerald-400"></i>
                      <span className="text-[10px] font-bold text-slate-300">{project.health}% Health</span>
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">{project.lastUpdate}</span>
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="border-2 border-dashed border-slate-800/50 rounded-xl flex flex-col items-center justify-center p-5 text-slate-600 hover:border-indigo-500/50 hover:text-indigo-400 transition-all bg-slate-900/10"
            >
              <i className="fas fa-plus-circle text-2xl mb-2"></i>
              <span className="text-xs font-bold uppercase tracking-widest">New Project</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Velocity Analysis</h3>
                <p className="text-xs text-slate-500">Neural tracking of deployment and review cycles</p>
              </div>
              <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex gap-1">
                <button className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white rounded-lg transition-all">Realtime</button>
                <button className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">7D</button>
              </div>
            </div>

            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { name: 'Mon', count: 4 },
                  { name: 'Tue', count: 7 },
                  { name: 'Wed', count: 5 },
                  { name: 'Thu', count: 12 },
                  { name: 'Fri', count: 9 },
                  { name: 'Sat', count: 3 },
                  { name: 'Sun', count: 1 },
                ]}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <i className="fas fa-brain-circuit text-6xl text-indigo-500"></i>
            </div>
            <div className="relative z-10">
              <h3 className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Neural Insights</h3>
              <p className="text-lg font-medium leading-relaxed italic text-slate-100">
                "{aiSummary}"
              </p>
            </div>
          </div>
        </div>

        {/* Activity Stream */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-100">Activity Pulsar</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar max-h-[500px] pr-2">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-slate-800"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800 w-3/4 rounded"></div>
                    <div className="h-3 bg-slate-800 w-1/4 rounded"></div>
                  </div>
                </div>
              ))
            ) : activities.length > 0 ? (
              activities.map((activity) => (
                <div key={activity.id} className="flex gap-4 group cursor-pointer hover:bg-slate-800/20 p-2 -m-2 rounded-xl transition-all">
                  <div className="relative shrink-0">
                    <img src={activity.avatar} className="w-10 h-10 rounded-xl object-cover ring-2 ring-transparent group-hover:ring-indigo-500/50 transition-all" alt="" />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] ${activity.type === 'pr' ? 'bg-indigo-600' :
                      activity.type === 'issue' ? 'bg-rose-500' :
                        activity.type === 'deploy' ? 'bg-emerald-500' : 'bg-slate-600'
                      }`}>
                      <i className={`fas ${activity.type === 'pr' ? 'fa-code-pull-request' :
                        activity.type === 'issue' ? 'fa-circle-exclamation' :
                          activity.type === 'deploy' ? 'fa-rocket' : 'fa-code-commit'
                        } text-white text-[8px]`}></i>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-300">
                      <span className="text-white font-bold">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-indigo-400/80 font-mono mt-1 group-hover:text-indigo-400 transition-colors uppercase tracking-widest">{activity.target}</p>
                    <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 italic py-10">
                <i className="fas fa-radar text-2xl mb-2 opacity-20"></i>
                <p className="text-xs">No signals detected</p>
              </div>
            )}
          </div>
          <button className="w-full mt-8 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors border-t border-slate-800 pt-4 font-black uppercase tracking-widest text-[9px]">
            Access Full Logs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
        {/* Stack Intelligence */}
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-sm">
          <h3 className="text-lg font-bold text-slate-100 mb-8">Stack Intelligence</h3>
          <div className="space-y-5">
            {[
              { label: 'TypeScript', value: 65, color: '#3178c6' },
              { label: 'Rust', value: 20, color: '#dea584' },
              { label: 'Go', value: 10, color: '#00add8' },
              { label: 'Python', value: 5, color: '#3572a5' },
            ].map((lang, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-400 font-black uppercase tracking-widest">{lang.label}</span>
                  <span className="text-indigo-400 font-mono font-bold">{lang.value}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${lang.value}%`, backgroundColor: lang.color }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 pt-8 border-t border-slate-800 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Efficiency Delta</p>
              <p className="text-xl font-bold text-emerald-400">+18.4%</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Code Quality Alpha</p>
              <p className="text-xl font-bold text-indigo-400">92/100</p>
            </div>
          </div>
        </div>

        {/* Ask AI CTA */}
        <div className="bg-indigo-600 rounded-[2.5rem] p-8 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -bottom-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <i className="fas fa-brain-circuit text-[12rem] text-white"></i>
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-white mb-4">Need technical clarity?</h3>
            <p className="text-indigo-100 text-sm leading-relaxed max-w-xs">
              Ask DevInquire AI to analyze your repository architecture, identify bottlenecks, or suggest security hardeners.
            </p>
          </div>
          <button
            onClick={() => navigate('/inquire')}
            className="relative z-10 w-full mt-8 py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all shadow-xl active:scale-95"
          >
            Engage Neural Agent
          </button>
        </div>
      </div>

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] sm:rounded-[2.5rem] w-[95%] sm:w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-100">
                <i className="fas fa-folder-plus text-indigo-400"></i> New Project
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-2">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 sm:p-8 space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Project Name</label>
                <input
                  autoFocus
                  required
                  value={newProject.name}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all text-slate-100 placeholder:text-slate-700"
                  placeholder="e.g. DataEngine v3"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Short Description</label>
                <textarea
                  required
                  rows={3}
                  value={newProject.description}
                  onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all text-slate-100 placeholder:text-slate-700 resize-none"
                  placeholder="What is this project's primary purpose?"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Stack</label>
                <select
                  value={newProject.language}
                  onChange={e => setNewProject({ ...newProject, language: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all cursor-pointer text-slate-100"
                >
                  <option value="TypeScript">TypeScript</option>
                  <option value="Rust">Rust</option>
                  <option value="Go">Go</option>
                  <option value="Python">Python</option>
                  <option value="C++">C++</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all text-white uppercase tracking-widest"
                >
                  Initialize Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
