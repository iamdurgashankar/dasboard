import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { api } from '../services/api';
import { User } from '../types';

const SKILL_DATA = [
  { subject: 'Code Quality', A: 120, B: 110, fullMark: 150 },
  { subject: 'Velocity', A: 98, B: 130, fullMark: 150 },
  { subject: 'Review Speed', A: 86, B: 130, fullMark: 150 },
  { subject: 'Documentation', A: 99, B: 100, fullMark: 150 },
  { subject: 'Bug Fix Rate', A: 85, B: 90, fullMark: 150 },
  { subject: 'Deployment', A: 65, B: 85, fullMark: 150 },
];

const Team: React.FC = () => {
  const [team, setTeam] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setIsLoading(true);
    try {
      const res = await api.users.list();
      if (res.status === 'success') {
        const activeOnly = res.data
          .filter((u: any) => u.status === 'active')
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            status: u.active_tasks > 0 ? 'In Flow' : 'Available',
            velocity: Math.floor(Math.random() * (98 - 85 + 1) + 85), // Simulated for now
            avatar: u.avatar || `https://ui-avatars.com/api/?name=${u.name.split(' ').join('+')}&background=6366f1&color=fff&bold=true`,
            tasks: parseInt(u.active_tasks)
          }));
        setTeam(activeOnly);
      }
    } catch (err) {
      console.error("Team fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Team Velocity</h1>
          <p className="text-slate-400">Track engineering output, focus time, and collaboration metrics.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-slate-800 transition-colors">
            <i className="fas fa-sync-alt mr-2"></i> Sync Jira
          </button>
          <button className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
            Sprint Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Performance Radar */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-semibold">Aggregate Squad Intelligence</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Current Sprint</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Prev Average</span>
              </div>
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={SKILL_DATA}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Radar name="Sprint" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                <Radar name="Historical" dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Member List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col min-h-[500px]">
          <h3 className="text-lg font-semibold mb-6">Active Contributors</h3>
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Querying Personnel...</p>
            </div>
          ) : (
            <div className="flex-1 space-y-6">
              {team.map((member) => (
                <div key={member.id} className="flex items-center gap-4 group">
                  <div className="relative">
                    <img src={member.avatar} className="w-11 h-11 rounded-xl border border-slate-700 shadow-sm object-cover bg-slate-950" alt={member.name} />
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${member.status === 'In Flow' ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      }`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-100">{member.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{member.role}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-indigo-400">{member.velocity}%</p>
                    <p className="text-[9px] text-slate-600 font-bold uppercase">{member.tasks} Active</p>
                  </div>
                </div>
              ))}
              {team.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                  <i className="fas fa-users-slash text-4xl mb-4"></i>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center">No active personnel assigned</p>
                </div>
              )}
            </div>
          )}
          <button className="w-full mt-8 py-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all">
            Manage Permissions
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'PR Cycle Time', value: '4.2h', sub: 'Avg per member', trend: '-12%', status: 'optimal' },
          { label: 'Collaboration Rate', value: '82%', sub: 'Cross-functional', trend: '+5%', status: 'optimal' },
          { label: 'Idle Capacity', value: '14%', sub: 'Member availability', trend: '-2%', status: 'warning' },
          { label: 'Review Latency', value: '1.8h', sub: 'Mean time to feedback', trend: '-18%', status: 'optimal' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm hover:border-slate-700 transition-all">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-2">{stat.label}</p>
            <div className="flex items-end justify-between">
              <div>
                <h4 className="text-2xl font-bold text-slate-100">{stat.value}</h4>
                <p className="text-[10px] text-slate-600 mt-1 font-medium">{stat.sub}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stat.trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Team;
