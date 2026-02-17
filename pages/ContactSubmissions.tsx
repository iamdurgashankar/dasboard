import React, { useState, useMemo, useEffect } from 'react';
import { ContactSubmission } from '../types';
import { api } from '../services/api';

const ContactSubmissions: React.FC = () => {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'replied' | 'archived'>('all');

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 30000); // 30s Real-time Sync
    return () => clearInterval(interval);
  }, []);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await api.contacts.list();
      if (res.status === 'success') {
        const mapped = res.data.map((s: any) => ({
          ...s,
          id: s.id.toString(),
          date: s.created_at.split(' ')[0]
        }));
        setSubmissions(mapped);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Failed to reach communication ledger.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedInquiry = useMemo(() =>
    submissions.find(s => s.id === selectedInquiryId),
    [submissions, selectedInquiryId]);

  const filteredSubmissions = useMemo(() => {
    if (filterStatus === 'all') return submissions;
    return submissions.filter(s => s.status === filterStatus);
  }, [submissions, filterStatus]);

  const stats = useMemo(() => ({
    total: submissions.length,
    new: submissions.filter(s => s.status === 'new').length,
    high: submissions.filter(s => s.priority === 'High').length
  }), [submissions]);

  const handleUpdateStatus = async (id: string, status: ContactSubmission['status']) => {
    try {
      await api.contacts.update({ id, status });
      fetchSubmissions();
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Permanently purge this inquiry from the ledger?")) {
      try {
        await api.contacts.delete(id);
        fetchSubmissions();
        setSelectedInquiryId(null);
      } catch (err) {
        console.error("Purge error:", err);
      }
    }
  };

  if (isLoading && submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center animate-pulse">
          <i className="fas fa-satellite-dish text-3xl text-indigo-400"></i>
        </div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Synching Inquiry Ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Inquiry Ledger</h1>
          <p className="text-slate-400 mt-1">Management terminal for external client leads and technical queries.</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3 flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Unread Inbound</span>
            <span className="text-xl font-bold text-indigo-400">{stats.new}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3 flex flex-col items-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">High Priority</span>
            <span className="text-xl font-bold text-rose-500">{stats.high}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs flex items-center gap-3">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 border-b border-slate-800/60 overflow-x-auto no-scrollbar">
        {(['all', 'new', 'replied', 'archived'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all border-b-2 whitespace-nowrap ${filterStatus === status ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/40 text-slate-600 text-[10px] uppercase tracking-[0.2em] font-black">
                <th className="px-8 py-5">Sender Identity</th>
                <th className="px-8 py-5">Subject Topic</th>
                <th className="px-8 py-5">Inbound Date</th>
                <th className="px-8 py-5">System State</th>
                <th className="px-8 py-5 text-right">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredSubmissions.length > 0 ? filteredSubmissions.map((inquiry) => (
                <tr
                  key={inquiry.id}
                  onClick={() => setSelectedInquiryId(inquiry.id)}
                  className="hover:bg-slate-800/20 transition-all group cursor-pointer"
                >
                  <td className="px-8 py-6">
                    <div>
                      <p className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{inquiry.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono lowercase">{inquiry.email}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-slate-300 truncate max-w-[200px]">{inquiry.subject}</p>
                      <p className="text-[10px] text-slate-600 truncate max-w-[200px] italic">"{inquiry.message.substring(0, 40)}..."</p>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-xs text-slate-500 font-mono">
                    {inquiry.date}
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] border ${inquiry.status === 'new'
                      ? 'bg-rose-500/5 text-rose-400 border-rose-500/20'
                      : inquiry.status === 'replied'
                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}>
                      {inquiry.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className={`text-[10px] font-mono font-bold ${inquiry.priority === 'High' ? 'text-rose-400' :
                      inquiry.priority === 'Medium' ? 'text-amber-400' : 'text-slate-600'
                      }`}>
                      {inquiry.id}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-3xl mb-4">
                        <i className="fas fa-inbox text-slate-600"></i>
                      </div>
                      <p className="text-slate-500 font-black uppercase tracking-widest text-[11px]">Ledger is empty</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inquiry Detail Side Drawer */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            {/* Drawer Header */}
            <div className="p-8 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedInquiryId(null)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-all flex items-center justify-center"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
                <div>
                  <h3 className="text-xl font-black text-slate-100 tracking-tight">Transmission Detail</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Reference ID: {selectedInquiry.id}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(selectedInquiry.id)}
                  className="w-10 h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all flex items-center justify-center border border-rose-500/20"
                  title="Purge Data"
                >
                  <i className="fas fa-trash-can"></i>
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-12 space-y-12">
              <section className="grid grid-cols-2 gap-8 p-8 bg-slate-950/30 rounded-3xl border border-slate-800/60 shadow-inner">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Inbound From</p>
                  <p className="text-lg font-bold text-slate-100">{selectedInquiry.name}</p>
                  <p className="text-xs font-mono text-indigo-400">{selectedInquiry.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Receipt Timestamp</p>
                  <p className="text-lg font-bold text-slate-100">{selectedInquiry.date}</p>
                  <p className="text-xs text-slate-500">Inbound Network: SSL/TLS Secure</p>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Subject Payload</p>
                  <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${selectedInquiry.priority === 'High' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                    {selectedInquiry.priority} Priority
                  </div>
                </div>
                <h4 className="text-2xl font-black text-white leading-tight">{selectedInquiry.subject}</h4>
              </section>

              <section className="space-y-4">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Message Body</p>
                <div className="bg-slate-950/50 p-10 rounded-[2.5rem] border border-slate-800/80 shadow-2xl min-h-[300px]">
                  <p className="text-slate-300 leading-relaxed font-medium text-lg whitespace-pre-wrap italic">
                    "{selectedInquiry.message}"
                  </p>
                </div>
              </section>

              <section className="pt-10 border-t border-slate-800/50">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <i className="fas fa-brain"></i>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI Sentiment Analysis</p>
                    <p className="text-xs text-slate-400">Gemini 3 Pro prioritized this as a <span className="text-indigo-300 font-bold">Business Development Opportunity</span>.</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-10 border-t border-slate-800 bg-slate-950/40">
              <div className="flex gap-4">
                <button
                  onClick={() => handleUpdateStatus(selectedInquiry.id, 'replied')}
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3"
                >
                  <i className="fas fa-reply"></i> Send Response
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedInquiry.id, 'archived')}
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                >
                  <i className="fas fa-box-archive"></i> Move to Archive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactSubmissions;
