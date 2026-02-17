import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { api } from '../services/api';

const COLORS = ['#6366f1', '#2dd4bf', '#f43f5e', '#eab308'];

const Analytics: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await api.analytics.stats();
      if (res.status === 'success') {
        setData(res.data.distribution);
        setPieData(res.data.allocation);
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-indigo-600/10 border border-indigo-500/20 rounded-[2rem] flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent animate-pulse"></div>
          <i className="fas fa-chart-line text-4xl text-indigo-400"></i>
        </div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Computing Intelligence Layers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Project Analytics</h1>
          <p className="text-slate-400 mt-1">Deep dive into engineering metrics and team productivity.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Monthly</button>
          <button className="px-5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Custom Range</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <i className="fas fa-layer-group text-6xl text-indigo-400"></i>
          </div>
          <h3 className="text-lg font-bold mb-8 flex items-center gap-3">
            <i className="fas fa-square-poll-vertical text-indigo-400"></i>
            Work Distribution (Tickets)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 'bold' }} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 'bold' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                <Bar dataKey="features" name="Features" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="bugs" name="Bugs" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar dataKey="refactor" name="Refactor" fill="#2dd4bf" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden group">
          <h3 className="text-lg font-bold mb-8 flex items-center gap-3">
            <i className="fas fa-chart-pie text-emerald-400"></i>
            Engineer Time Allocation
          </h3>
          <div className="h-[300px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={10}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}
                />
                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative group">
        <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
          <i className="fas fa-wave-square text-[120px] text-amber-400"></i>
        </div>
        <h3 className="text-lg font-bold mb-8 flex items-center gap-3">
          <i className="fas fa-clock text-amber-400"></i>
          Code Review Cycle Time (Hours)
        </h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} tick={{ fontWeight: 'bold' }} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} tick={{ fontWeight: 'bold' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px' }}
                itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}
              />
              <Line type="monotone" dataKey="refactor" stroke="#eab308" strokeWidth={4} dot={{ fill: '#eab308', strokeWidth: 2, r: 6 }} activeDot={{ r: 10, stroke: '#eab308', strokeWidth: 4, fill: '#0f172a' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
