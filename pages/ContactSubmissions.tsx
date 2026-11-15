import React, { useState, useMemo, useEffect } from 'react';
import { ContactSubmission } from '../types';
import { api } from '../services/api';

interface InquiryConfig {
  recipientEmail: string;
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  web3FormsEnabled: boolean;
  web3FormsKey: string;
  autoReplyEnabled: boolean;
  autoReplySubject: string;
  autoReplyTemplate: string;
  defaultPriority: 'Low' | 'Medium' | 'High';
  webhookIntakeEnabled: boolean;
  slaHours: number;
}

const DEFAULT_CONFIG: InquiryConfig = {
  recipientEmail: 'contact@devinquire.com',
  fromName: 'DevInquire',
  fromEmail: 'noreply@devinquire.com',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  web3FormsEnabled: true,
  web3FormsKey: '803e30e6-5c54-4cae-9406-8d13bcf3d8e9',
  autoReplyEnabled: true,
  autoReplySubject: 'Thank you for contacting DevInquire',
  autoReplyTemplate:
    'Hello {{name}}, thank you for reaching out to DevInquire. Our engineering team has received your inquiry regarding "{{subject}}" and will respond within 24 hours.',
  defaultPriority: 'Medium',
  webhookIntakeEnabled: true,
  slaHours: 24,
};

const ContactSubmissions: React.FC = () => {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Log New Inquiry Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newInquiry, setNewInquiry] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    subject: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    message: '',
  });

  // Inquiry Configuration Modal (Admin)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState<InquiryConfig>(DEFAULT_CONFIG);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const [lastSyncedAt, setLastSyncedAt] = useState<string>('Just now');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchSubmissions(false);
    fetchConfig();
    const interval = setInterval(() => fetchSubmissions(true), 4000);
    const onFocus = () => fetchSubmissions(true);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchSubmissions(true);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const fetchSubmissions = async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.contacts.list();
      if (res.status === 'success') {
        const nextList = Array.isArray(res.data) ? res.data : [];
        setSubmissions(nextList);
        setLastSyncedAt(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        setError(null);
      } else if (!silent) {
        setError(res.message);
      }
    } catch (err) {
      if (!silent) setError('Failed to synchronize inquiry ledger.');
      console.error(err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await api.contacts.getConfig();
      if (res.status === 'success' && res.data) {
        setConfig({ ...DEFAULT_CONFIG, ...res.data });
      }
    } catch {
      // keep defaults
    }
  };

  const openDetail = (sub: any) => {
    setSelectedSubmission(sub);
    setReplyText(
      sub.reply_message ||
        config.autoReplyTemplate
          .replace(/\{\{name\}\}/g, sub.name || 'Client')
          .replace(/\{\{subject\}\}/g, sub.subject || 'your inquiry')
    );
    setNotesText(sub.notes || '');
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q) ||
        String(s.subject || '').toLowerCase().includes(q) ||
        String(s.company || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [submissions, filterStatus, searchTerm]);

  const counts = useMemo(() => {
    return {
      all: submissions.length,
      new: submissions.filter((s) => s.status === 'new').length,
      replied: submissions.filter((s) => s.status === 'replied').length,
      archived: submissions.filter((s) => s.status === 'archived').length,
    };
  }, [submissions]);

  const updateStatusOrPriority = async (
    id: string,
    patch: { status?: ContactSubmission['status']; priority?: 'Low' | 'Medium' | 'High' }
  ) => {
    try {
      await api.contacts.update({ id, ...patch });
      await fetchSubmissions();
      if (selectedSubmission?.id === id) {
        setSelectedSubmission((prev: any) => (prev ? { ...prev, ...patch } : null));
      }
      showToast('Inquiry updated.');
    } catch (err) {
      console.error('Failed to update inquiry:', err);
    }
  };

  const handleSaveReplyAndNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;
    setIsSavingDetail(true);
    try {
      const nextStatus = replyText.trim() ? 'replied' : selectedSubmission.status;
      await api.contacts.update({
        id: selectedSubmission.id,
        status: nextStatus,
        reply_message: replyText.trim(),
        notes: notesText.trim(),
      });
      await fetchSubmissions();
      setSelectedSubmission((prev: any) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              reply_message: replyText.trim(),
              notes: notesText.trim(),
              replied_at: new Date().toISOString(),
            }
          : null
      );
      showToast('Reply & internal notes saved to inquiry ledger.');
    } catch (err) {
      console.error('Reply save error:', err);
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInquiry.name.trim() || !newInquiry.email.trim() || !newInquiry.message.trim()) return;
    setIsCreating(true);
    try {
      await api.contacts.create(newInquiry);
      await fetchSubmissions();
      setShowCreateModal(false);
      setNewInquiry({
        name: '',
        email: '',
        company: '',
        phone: '',
        subject: '',
        priority: config.defaultPriority || 'Medium',
        message: '',
      });
      showToast('New client inquiry logged.');
    } catch (err) {
      console.error('Create inquiry error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const res = await api.contacts.updateConfig(config);
      if (res.status === 'success' && res.data) {
        setConfig({ ...DEFAULT_CONFIG, ...res.data });
      }
      setShowConfigModal(false);
      showToast('Client Inquiry configuration saved.');
    } catch (err) {
      console.error('Save config error:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!window.confirm('Permanently delete this inquiry from the ledger?')) return;
    try {
      await api.contacts.delete(id);
      await fetchSubmissions();
      setSelectedSubmission(null);
      showToast('Inquiry removed from ledger.');
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const p = (priority || 'Medium').toLowerCase();
    if (p === 'high') {
      return 'bg-[#FF3B30]/12 text-[#FF3B30] border-[#FF3B30]/20';
    }
    if (p === 'medium') {
      return 'bg-[#FF9500]/12 text-[#FF9500] border-[#FF9500]/20';
    }
    return 'bg-[#4e45e1]/12 text-[var(--apple-blue)] border-[#4e45e1]/20';
  };

  const getStatusBadge = (status: string) => {
    const s = (status || 'new').toLowerCase();
    if (s === 'new') {
      return 'bg-[#4e45e1]/12 text-[var(--apple-blue)]';
    }
    if (s === 'replied') {
      return 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]';
    }
    return 'bg-[var(--apple-border)] text-[var(--apple-text-secondary)]';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)]">
              Client Intake & CRM Ledger
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1.5 ${
                config.webhookIntakeEnabled
                  ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                  : 'bg-[#FF9500]/15 text-[#FF9500]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  config.webhookIntakeEnabled ? 'bg-[#28CD41] animate-pulse' : 'bg-[#FF9500]'
                }`}
              ></span>
              <span>{config.webhookIntakeEnabled ? 'Live Auto-Fetch Active' : 'Intake Paused'}</span>
            </span>
            <span className="text-[11px] text-[var(--apple-text-tertiary)]">
              Synced {lastSyncedAt}
            </span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            Client Inquiries
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            Manage inbound client requests, configure intake routing & auto-replies, and track SLA responses.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
          <button
            onClick={() => setShowConfigModal(true)}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-sliders text-[var(--apple-blue)] text-xs shrink-0"></i>
            <span>Inquiry Settings</span>
          </button>
          <button
            onClick={() => {
              setNewInquiry((prev) => ({ ...prev, priority: config.defaultPriority || 'Medium' }));
              setShowCreateModal(true);
            }}
            className="h-10 px-4 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-plus text-xs badge-white shrink-0"></i>
            <span>Log Inquiry</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-3.5 bg-[#28CD41]/12 border border-[#28CD41]/25 text-[#248A3D] dark:text-[#30D158] rounded-[12px] text-[13px] font-medium flex items-center gap-2.5">
          <i className="fas fa-circle-check"></i>
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] rounded-[14px] text-[13px] flex items-center gap-2.5">
          <i className="fas fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Configuration Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Routing Destination
            </p>
            <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] mt-0.5 truncate">
              {config.recipientEmail}
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#4e45e1]/10 text-[var(--apple-blue)] flex items-center justify-center">
            <i className="fas fa-at text-sm"></i>
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              New Inquiries
            </p>
            <p className="text-[20px] font-bold text-[var(--apple-text-primary)] mt-0.5">
              {counts.new} <span className="text-[12px] font-normal text-[var(--apple-text-secondary)]">/ {counts.all} total</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#FF9500]/12 text-[#FF9500] flex items-center justify-center">
            <i className="fas fa-inbox text-sm"></i>
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Auto-Responder
            </p>
            <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] mt-0.5">
              {config.autoReplyEnabled ? 'Enabled (Instant)' : 'Disabled'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158] flex items-center justify-center">
            <i className="fas fa-bolt text-sm"></i>
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Target Response SLA
            </p>
            <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] mt-0.5">
              Within {config.slaHours} Hours ({config.defaultPriority} Default)
            </p>
          </div>
          <div className="w-9 h-9 rounded-[10px] bg-[#5856D6]/12 text-[#5856D6] flex items-center justify-center">
            <i className="fas fa-clock text-sm"></i>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="apple-card p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center h-10 p-1 rounded-[11px] bg-black/[0.04] dark:bg-white/[0.06] border border-[var(--apple-border)] w-fit overflow-x-auto">
          {(['all', 'new', 'replied', 'archived'] as const).map((status) => {
            const active = filterStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`h-8 px-3.5 rounded-[8px] text-[12px] font-semibold capitalize inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  active
                    ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                    : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                }`}
              >
                <span>{status}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    active
                      ? 'bg-white/20 text-white badge-white'
                      : 'bg-black/[0.06] dark:bg-white/[0.08] text-[var(--apple-text-tertiary)]'
                  }`}
                >
                  {counts[status]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apple-text-tertiary)] text-xs pointer-events-none"></i>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search client, email, subject…"
            className="w-full apple-input h-10 pl-9 pr-4 text-[13px] rounded-[11px]"
          />
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--apple-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                <th className="px-6 py-4">Client Identity</th>
                <th className="px-6 py-4">Subject & Preview</th>
                <th className="px-6 py-4">Priority</th>
                <th className="px-6 py-4">Received</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apple-border)]">
              {isLoading && submissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[13px] text-[var(--apple-text-secondary)]">
                    Loading client inquiries…
                  </td>
                </tr>
              ) : filteredSubmissions.length > 0 ? (
                filteredSubmissions.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => openDetail(sub)}
                    className="hover:bg-[var(--apple-surface-subcard-hover)] transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#4e45e1]/12 text-[var(--apple-blue)] flex items-center justify-center font-semibold text-[13px] shrink-0">
                          {(sub.name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] truncate">
                            {sub.name}
                          </p>
                          <p className="text-[12px] text-[var(--apple-text-tertiary)] truncate">
                            {sub.email}
                            {sub.company ? ` • ${sub.company}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <p className="text-[13px] font-semibold text-[var(--apple-text-primary)] truncate">
                        {sub.subject}
                      </p>
                      <p className="text-[12px] text-[var(--apple-text-secondary)] truncate mt-0.5">
                        {sub.message}
                      </p>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={sub.priority || 'Medium'}
                        onChange={(e) =>
                          updateStatusOrPriority(sub.id, {
                            priority: e.target.value as 'Low' | 'Medium' | 'High',
                          })
                        }
                        aria-label={`Priority for ${sub.name}`}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border outline-none cursor-pointer ${getPriorityBadge(
                          sub.priority
                        )}`}
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-[12px] font-mono text-[var(--apple-text-secondary)]">
                      {sub.date}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${getStatusBadge(
                          sub.status
                        )}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openDetail(sub)}
                          className="px-3 py-1.5 rounded-[9px] apple-subcard text-[12px] font-medium text-[var(--apple-text-primary)] hover:text-[var(--apple-blue)]"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => deleteSubmission(sub.id)}
                          className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[#FF3B30] flex items-center justify-center"
                          title="Delete Inquiry"
                        >
                          <i className="fas fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-11 h-11 rounded-2xl bg-[#4e45e1]/10 text-[var(--apple-blue)] flex items-center justify-center mx-auto">
                        <i className="fas fa-envelope-open-text"></i>
                      </div>
                      <p className="text-[14px] font-semibold text-[var(--apple-text-primary)]">
                        No client inquiries found
                      </p>
                      <p className="text-[12px] text-[var(--apple-text-secondary)]">
                        Inquiries submitted from devinquire.com or logged manually will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage / Reply Inquiry Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#4e45e1]/12 text-[var(--apple-blue)] flex items-center justify-center font-semibold text-[15px] shrink-0">
                  {(selectedSubmission.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)] truncate">
                    {selectedSubmission.subject}
                  </h3>
                  <p className="text-[12px] text-[var(--apple-text-secondary)] truncate">
                    From {selectedSubmission.name} ({selectedSubmission.email}) • {selectedSubmission.date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="w-8 h-8 rounded-full apple-subcard text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] flex items-center justify-center shrink-0"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form onSubmit={handleSaveReplyAndNotes} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Status & Priority Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Inquiry Status
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 apple-subcard p-1 rounded-[10px]">
                    {(['new', 'replied', 'archived'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => updateStatusOrPriority(selectedSubmission.id, { status: st })}
                        className={`py-1.5 rounded-[7px] text-[12px] font-semibold capitalize transition-all ${
                          selectedSubmission.status === st
                            ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                            : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Assigned Priority
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 apple-subcard p-1 rounded-[10px]">
                    {(['Low', 'Medium', 'High'] as const).map((pr) => (
                      <button
                        key={pr}
                        type="button"
                        onClick={() => updateStatusOrPriority(selectedSubmission.id, { priority: pr })}
                        className={`py-1.5 rounded-[7px] text-[12px] font-semibold transition-all ${
                          selectedSubmission.priority === pr
                            ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                            : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
                        }`}
                      >
                        {pr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Client Message */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Client Message
                </label>
                <div className="apple-subcard p-4 rounded-[14px] text-[13px] text-[var(--apple-text-primary)] leading-relaxed whitespace-pre-wrap">
                  {selectedSubmission.message}
                </div>
              </div>

              {/* Compose Response */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Response Message to {selectedSubmission.name}
                  </label>
                  <a
                    href={`mailto:${selectedSubmission.email}?subject=${encodeURIComponent(
                      `Re: ${selectedSubmission.subject}`
                    )}&body=${encodeURIComponent(replyText)}`}
                    className="text-[12px] font-semibold text-[var(--apple-blue)] hover:underline flex items-center gap-1.5"
                  >
                    <i className="fas fa-paper-plane text-[10px]"></i>
                    <span>Open in Mail Client</span>
                  </a>
                </div>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write response to client…"
                  className="w-full apple-input p-3.5 text-[13px] leading-relaxed"
                />
              </div>

              {/* Internal Notes */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Internal Admin Notes
                </label>
                <textarea
                  rows={2}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Add internal notes, deal estimate, or assigned engineer…"
                  className="w-full apple-input p-3 text-[13px]"
                />
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--apple-border)]">
                <button
                  type="button"
                  onClick={() => deleteSubmission(selectedSubmission.id)}
                  className="px-4 py-2.5 rounded-[12px] bg-[#FF3B30]/12 text-[#FF3B30] text-[13px] font-semibold hover:bg-[#FF3B30] hover:text-white transition-colors"
                >
                  Delete Inquiry
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSubmission(null)}
                    className="px-4 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDetail}
                    className="px-5 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
                  >
                    {isSavingDetail ? 'Saving…' : 'Save Reply & Mark Replied'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log New Inquiry Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                Log New Client Inquiry
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full apple-subcard text-[var(--apple-text-secondary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            <form onSubmit={handleCreateInquiry} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Client Name *
                  </label>
                  <input
                    required
                    value={newInquiry.name}
                    onChange={(e) => setNewInquiry({ ...newInquiry, name: e.target.value })}
                    placeholder="Jane Doe"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Client Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={newInquiry.email}
                    onChange={(e) => setNewInquiry({ ...newInquiry, email: e.target.value })}
                    placeholder="client@company.com"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Company / Organization
                  </label>
                  <input
                    value={newInquiry.company}
                    onChange={(e) => setNewInquiry({ ...newInquiry, company: e.target.value })}
                    placeholder="Acme Corp"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Priority
                  </label>
                  <select
                    value={newInquiry.priority}
                    onChange={(e) =>
                      setNewInquiry({
                        ...newInquiry,
                        priority: e.target.value as 'Low' | 'Medium' | 'High',
                      })
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Subject / Project Scope *
                </label>
                <input
                  required
                  value={newInquiry.subject}
                  onChange={(e) => setNewInquiry({ ...newInquiry, subject: e.target.value })}
                  placeholder="Enterprise Web Platform & AI Integration"
                  className="w-full apple-input px-3.5 py-2 text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Inquiry Details *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newInquiry.message}
                  onChange={(e) => setNewInquiry({ ...newInquiry, message: e.target.value })}
                  placeholder="Describe the client's requirements, timeline, and budget…"
                  className="w-full apple-input p-3.5 text-[13px]"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
                >
                  {isCreating ? 'Logging…' : 'Log Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inquiry Configuration Modal (Admin) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  Client Inquiry Configuration
                </h3>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Configure intake routing, SLA targets, and automated response templates.
                </p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full apple-subcard text-[var(--apple-text-secondary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Notification Recipient Email
                  </label>
                  <input
                    required
                    type="email"
                    value={config.recipientEmail}
                    onChange={(e) => setConfig({ ...config, recipientEmail: e.target.value })}
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Default Inbound Priority
                  </label>
                  <select
                    value={config.defaultPriority}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        defaultPriority: e.target.value as 'Low' | 'Medium' | 'High',
                      })
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              {/* Outbound Mail / SMTP & Web3Forms Settings */}
              <div className="apple-subcard p-4 rounded-[14px] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                      Mail Delivery Configuration (SMTP & Web3Forms Relay)
                    </p>
                    <p className="text-[11px] text-[var(--apple-text-secondary)]">
                      {config.smtpUser && config.smtpPass
                        ? `Active: Custom SMTP (${config.smtpHost}:${config.smtpPort})`
                        : config.web3FormsEnabled
                        ? 'Active: Web3Forms Relay (Fallback active until SMTP credentials are added)'
                        : 'Ledger Only (Configure SMTP or enable Web3Forms for email alerts)'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]">
                    {config.smtpUser && config.smtpPass ? 'SMTP Ready' : 'Web3Forms Active'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={config.smtpHost}
                      onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={config.smtpPort}
                      onChange={(e) =>
                        setConfig({ ...config, smtpPort: Number(e.target.value) || 587 })
                      }
                      placeholder="587"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP Username (optional)
                    </label>
                    <input
                      type="text"
                      value={config.smtpUser}
                      onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
                      placeholder="contact@devinquire.com"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP App Password (optional)
                    </label>
                    <input
                      type="password"
                      value={config.smtpPass}
                      onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="apple-subcard p-3.5 rounded-[12px] flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                      Website Intake Webhook
                    </p>
                    <p className="text-[11px] text-[var(--apple-text-secondary)]">
                      Store live submissions from devinquire.com
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.webhookIntakeEnabled}
                    onChange={(e) =>
                      setConfig({ ...config, webhookIntakeEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#4e45e1]"
                  />
                </div>

                <div className="apple-subcard p-3.5 rounded-[12px] flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                      Auto-Reply Template
                    </p>
                    <p className="text-[11px] text-[var(--apple-text-secondary)]">
                      Pre-fill & send client acknowledgement
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.autoReplyEnabled}
                    onChange={(e) =>
                      setConfig({ ...config, autoReplyEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#4e45e1]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Default Reply Template (supports {'{{name}}'} and {'{{subject}}'})
                </label>
                <textarea
                  rows={3}
                  value={config.autoReplyTemplate}
                  onChange={(e) => setConfig({ ...config, autoReplyTemplate: e.target.value })}
                  className="w-full apple-input p-3 text-[13px]"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
                >
                  {isSavingConfig ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactSubmissions;
