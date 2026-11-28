import React, { useState, useMemo, useEffect } from 'react';
import { ContactSubmission, InquiryPaymentStatus, User } from '../types';
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
  fromEmail: 'contact@devinquire.com',
  smtpHost: 'smtp.hostinger.com',
  smtpPort: 465,
  smtpUser: 'contact@devinquire.com',
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

const TIMELINE_LABELS: Record<string, string> = {
  asap: 'ASAP (Immediate)',
  '1-month': 'Within 1 Month',
  '2-3-months': '2–3 Months',
  '3-6-months': '3–6 Months',
  '6-months-plus': '6+ Months',
  flexible: 'Flexible',
};

function formatTimeline(raw?: string): string {
  if (!raw) return '';
  const clean = String(raw).trim();
  return TIMELINE_LABELS[clean.toLowerCase()] || clean;
}

function formatPlanLabel(plan?: string, amount?: number): string {
  if (plan === 'consultation') {
    return `1:1 Technical Consultation (₹${amount || 399}/-)`;
  }
  if (plan === 'service_confirmation') {
    return `Service Confirmation Pass (₹${amount || 99}/-)`;
  }
  if (amount && amount > 0) {
    return `Pre-Booking Payment (₹${amount}/-)`;
  }
  return plan || 'Standard Inquiry';
}

interface ContactSubmissionsProps {
  currentUser?: User | null;
}

const ContactSubmissions: React.FC<ContactSubmissionsProps> = ({ currentUser }) => {
  const isAdmin = currentUser?.role === 'Admin';
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [paymentEdit, setPaymentEdit] = useState<{
    payment_status: InquiryPaymentStatus;
    payment_plan: string;
    payment_amount: number;
    payment_reference: string;
  }>({
    payment_status: 'none',
    payment_plan: 'consultation',
    payment_amount: 0,
    payment_reference: '',
  });
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Log New Inquiry Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newInquiry, setNewInquiry] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    service: '',
    timeline: '',
    subject: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    payment_status: 'none' as InquiryPaymentStatus,
    payment_plan: '',
    payment_amount: 0,
    payment_reference: '',
    message: '',
  });

  // Inquiry Configuration Modal (Admin)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState<InquiryConfig>(DEFAULT_CONFIG);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpTestStatus, setSmtpTestStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [lastSyncedAt, setLastSyncedAt] = useState<string>('Just now');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchSubmissions(false);
    fetchConfig();
    const interval = setInterval(() => fetchSubmissions(true), 12000);
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
    setPaymentEdit({
      payment_status: (sub.payment_status || 'none') as InquiryPaymentStatus,
      payment_plan: sub.payment_plan || 'consultation',
      payment_amount:
        Number(sub.payment_amount) ||
        (sub.payment_plan === 'service_confirmation' ? 99 : sub.payment_plan === 'consultation' ? 399 : 0),
      payment_reference: sub.payment_reference || '',
    });
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchesStatus = filterStatus === 'all' || s.status === filterStatus;

      const paySt = String(s.payment_status || 'none').toLowerCase();
      const matchesPayment =
        filterPayment === 'all' ||
        (filterPayment === 'paid' && paySt === 'paid') ||
        (filterPayment === 'pending' && paySt === 'pending') ||
        (filterPayment === 'free' && (paySt === 'none' || paySt === 'opt_out' || paySt === 'cancelled'));

      const src = String(s.form_source || 'Contact Form').toLowerCase();
      const matchesSource =
        filterSource === 'all' || src.includes(filterSource.toLowerCase());

      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q) ||
        String(s.phone || '').toLowerCase().includes(q) ||
        String(s.company || '').toLowerCase().includes(q) ||
        String(s.service || '').toLowerCase().includes(q) ||
        String(s.subject || '').toLowerCase().includes(q) ||
        String(s.message || '').toLowerCase().includes(q) ||
        String(s.payment_reference || '').toLowerCase().includes(q);
      return matchesStatus && matchesPayment && matchesSource && matchesSearch;
    });
  }, [submissions, filterStatus, filterPayment, filterSource, searchTerm]);

  const counts = useMemo(() => {
    return {
      all: submissions.length,
      new: submissions.filter((s) => s.status === 'new').length,
      replied: submissions.filter((s) => s.status === 'replied').length,
      archived: submissions.filter((s) => s.status === 'archived').length,
    };
  }, [submissions]);

  const paymentStats = useMemo(() => {
    const paidItems = submissions.filter(
      (s) => String(s.payment_status || '').toLowerCase() === 'paid'
    );
    const pendingItems = submissions.filter(
      (s) => String(s.payment_status || '').toLowerCase() === 'pending'
    );
    const totalRevenue = paidItems.reduce(
      (sum, item) => sum + (Number(item.payment_amount) || 0),
      0
    );
    return {
      paidCount: paidItems.length,
      pendingCount: pendingItems.length,
      totalRevenue,
    };
  }, [submissions]);

  const updateStatusOrPriority = async (
    id: string,
    patch: { status?: ContactSubmission['status']; priority?: 'Low' | 'Medium' | 'High' }
  ) => {
    try {
      await api.contacts.update({ id, ...patch });
      await fetchSubmissions(true);
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
      const hasNewReply =
        replyText.trim() && replyText.trim() !== (selectedSubmission.reply_message || '').trim();
      const nextStatus = hasNewReply ? 'replied' : selectedSubmission.status;
      const paidTimestamp =
        paymentEdit.payment_status === 'paid'
          ? selectedSubmission.paid_at || new Date().toISOString()
          : null;

      await api.contacts.update({
        id: selectedSubmission.id,
        status: nextStatus,
        reply_message: replyText.trim(),
        notes: notesText.trim(),
        payment_status: paymentEdit.payment_status,
        payment_plan: paymentEdit.payment_plan,
        payment_amount: Number(paymentEdit.payment_amount) || 0,
        payment_reference: paymentEdit.payment_reference.trim(),
        paid_at: paidTimestamp,
      });
      await fetchSubmissions(true);
      setSelectedSubmission((prev: any) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              reply_message: replyText.trim(),
              notes: notesText.trim(),
              payment_status: paymentEdit.payment_status,
              payment_plan: paymentEdit.payment_plan,
              payment_amount: Number(paymentEdit.payment_amount) || 0,
              payment_reference: paymentEdit.payment_reference.trim(),
              paid_at: paidTimestamp,
              replied_at: hasNewReply ? new Date().toISOString() : prev.replied_at,
            }
          : null
      );
      showToast('Inquiry details, payment confirmation & reply saved.');
    } catch (err) {
      console.error('Reply save error:', err);
    } finally {
      setIsSavingDetail(false);
    }
  };

  const handleQuickConfirmPayment = async () => {
    if (!selectedSubmission) return;
    const plan = paymentEdit.payment_plan || 'consultation';
    const amt =
      Number(paymentEdit.payment_amount) ||
      (plan === 'service_confirmation' ? 99 : 399);
    const nowIso = new Date().toISOString();
    try {
      await api.contacts.update({
        id: selectedSubmission.id,
        priority: 'High',
        payment_status: 'paid',
        payment_plan: plan,
        payment_amount: amt,
        payment_reference: paymentEdit.payment_reference.trim() || `manual-${Date.now()}`,
        paid_at: nowIso,
      });
      setPaymentEdit((prev) => ({
        ...prev,
        payment_status: 'paid',
        payment_plan: plan,
        payment_amount: amt,
        payment_reference: prev.payment_reference.trim() || `manual-${Date.now()}`,
      }));
      setSelectedSubmission((prev: any) =>
        prev
          ? {
              ...prev,
              priority: 'High',
              payment_status: 'paid',
              payment_plan: plan,
              payment_amount: amt,
              payment_reference: paymentEdit.payment_reference.trim() || `manual-${Date.now()}`,
              paid_at: nowIso,
            }
          : null
      );
      await fetchSubmissions(true);
      showToast(`Payment confirmed (₹${amt}/-) on inquiry!`);
    } catch (err) {
      console.error('Quick confirm payment error:', err);
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
        service: '',
        timeline: '',
        subject: '',
        priority: config.defaultPriority || 'Medium',
        payment_status: 'none',
        payment_plan: '',
        payment_amount: 0,
        payment_reference: '',
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
    setSmtpTestStatus(null);
    try {
      const res = await api.contacts.updateConfig(config);
      if (res.status === 'success' && res.data) {
        setConfig({ ...DEFAULT_CONFIG, ...res.data });
      }
      setShowConfigModal(false);
      showToast('Live SMTP & Client Inquiry configuration saved.');
    } catch (err: any) {
      setSmtpTestStatus({
        type: 'error',
        text: err?.message || 'Failed to save configuration.',
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setSmtpTestStatus(null);
    try {
      const res = await api.contacts.testSmtp(config);
      if (res.status === 'success') {
        if (res.data) {
          setConfig({ ...DEFAULT_CONFIG, ...res.data });
        }
        setSmtpTestStatus({
          type: 'success',
          text: res.message || `Live Hostinger SMTP verified! Test email delivered to ${config.recipientEmail}.`,
        });
        showToast(res.message || 'Live Hostinger SMTP verified & saved!');
      } else {
        setSmtpTestStatus({
          type: 'error',
          text: res.message || 'SMTP connection test failed.',
        });
      }
    } catch (err: any) {
      setSmtpTestStatus({
        type: 'error',
        text: err?.message || 'SMTP connection failed. Verify your Hostinger mailbox password.',
      });
    } finally {
      setIsTestingSmtp(false);
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      showToast(`${label} copied to clipboard.`);
    });
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

  const renderPaymentBadge = (sub: any) => {
    const st = String(sub.payment_status || 'none').toLowerCase();
    const amt =
      Number(sub.payment_amount) ||
      (sub.payment_plan === 'service_confirmation' ? 99 : sub.payment_plan === 'consultation' ? 399 : 0);
    const shortPlan =
      sub.payment_plan === 'consultation'
        ? '1:1 Consultation'
        : sub.payment_plan === 'service_confirmation'
        ? 'Service Pass'
        : 'Pre-Booking';

    if (st === 'paid') {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#28CD41]/15 text-[#1E8E3E] dark:text-[#30D158] border border-[#28CD41]/25 whitespace-nowrap">
            <i className="fas fa-circle-check text-[10px]"></i>
            <span>Paid ₹{amt}/-</span>
          </span>
          <p className="text-[10.5px] text-[var(--apple-text-secondary)] font-medium truncate max-w-[150px]">
            {shortPlan}
          </p>
        </div>
      );
    }

    if (st === 'pending') {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FF9500]/15 text-[#D97706] dark:text-[#FF9F0A] border border-[#FF9500]/25 whitespace-nowrap">
            <i className="fas fa-hourglass-half text-[10px]"></i>
            <span>Pending {amt ? `₹${amt}/-` : ''}</span>
          </span>
          <p className="text-[10.5px] text-[var(--apple-text-tertiary)] truncate max-w-[150px]">
            Stripe Checkout Initiated
          </p>
        </div>
      );
    }

    if (st === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FF3B30]/10 text-[#FF3B30] whitespace-nowrap">
          <i className="fas fa-ban text-[10px]"></i>
          <span>Checkout Cancelled</span>
        </span>
      );
    }

    if (st === 'opt_out') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#4e45e1]/10 text-[var(--apple-blue)] whitespace-nowrap">
          <span>Free Query (Opt-Out)</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium apple-subcard text-[var(--apple-text-tertiary)] whitespace-nowrap">
        <span>Standard Form</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)]">
              Website Forms, Payment Confirmations &amp; CRM Ledger
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
              <span>{config.webhookIntakeEnabled ? 'devinquire.com Live Sync' : 'Intake Paused'}</span>
            </span>
            <span className="text-[11px] text-[var(--apple-text-tertiary)]">
              Synced {lastSyncedAt}
            </span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            Client Inquiries
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            View all form submissions from <strong>devinquire.com</strong> (Contact, Services, Product Demos, Newsletter) along with live Stripe pre-booking payment confirmations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center flex-wrap">
          <button
            type="button"
            onClick={() => fetchSubmissions(false)}
            className="h-10 px-3.5 apple-secondary-btn rounded-[12px] text-[12.5px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
            title="Refresh inquiries & payment confirmations"
          >
            <i className={`fas fa-arrows-rotate text-[var(--apple-blue)] text-xs ${isLoading ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="fas fa-sliders text-[var(--apple-blue)] text-xs shrink-0"></i>
              <span>Inquiry Mail Settings</span>
            </button>
          )}
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

      {/* KPI & Payment Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Website Form Submissions
            </p>
            <p className="text-[22px] font-bold text-[var(--apple-text-primary)] mt-0.5">
              {counts.new}{' '}
              <span className="text-[12px] font-normal text-[var(--apple-text-secondary)]">
                new / {counts.all} total
              </span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-[#FF9500]/12 text-[#FF9500] flex items-center justify-center">
            <i className="fas fa-inbox text-sm"></i>
          </div>
        </div>

        <div
          onClick={() => setFilterPayment(filterPayment === 'paid' ? 'all' : 'paid')}
          className="apple-card p-4 flex items-center justify-between cursor-pointer hover:border-[#28CD41]/50 transition-all"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Confirmed Payments
            </p>
            <p className="text-[20px] font-bold text-[#1E8E3E] dark:text-[#30D158] mt-0.5">
              {paymentStats.paidCount} Paid{' '}
              <span className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                • ₹{paymentStats.totalRevenue.toLocaleString('en-IN')}/-
              </span>
            </p>
            {paymentStats.pendingCount > 0 && (
              <p className="text-[11px] text-[#D97706] font-medium">
                {paymentStats.pendingCount} checkout pending
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-[#28CD41]/15 text-[#1E8E3E] dark:text-[#30D158] flex items-center justify-center">
            <i className="fas fa-credit-card text-sm"></i>
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Routing Destination
            </p>
            <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] mt-0.5 truncate">
              {config.recipientEmail}
            </p>
            <p className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
              Contact • Services • Products • Newsletter
            </p>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-[#4e45e1]/10 text-[var(--apple-blue)] flex items-center justify-center shrink-0">
            <i className="fas fa-at text-sm"></i>
          </div>
        </div>

        <div className="apple-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
              Auto-Responder &amp; SLA
            </p>
            <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] mt-0.5">
              {config.autoReplyEnabled ? 'Enabled (Instant)' : 'Disabled'}
            </p>
            <p className="text-[11px] text-[var(--apple-text-secondary)] mt-0.5">
              Response target: {config.slaHours} hours
            </p>
          </div>
          <div className="w-10 h-10 rounded-[12px] bg-[#5856D6]/12 text-[#5856D6] flex items-center justify-center">
            <i className="fas fa-bolt text-sm"></i>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="apple-card p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Tabs */}
          <div className="inline-flex items-center h-10 p-1 rounded-[11px] bg-black/[0.04] dark:bg-white/[0.06] border border-[var(--apple-border)] overflow-x-auto">
            {(['all', 'new', 'replied', 'archived'] as const).map((status) => {
              const active = filterStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={`h-8 px-3 rounded-[8px] text-[12px] font-semibold capitalize inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
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

          {/* Payment Filter */}
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            aria-label="Filter by payment status"
            className="apple-input h-10 px-3 text-[12px] font-semibold rounded-[11px]"
          >
            <option value="all">All Payment States</option>
            <option value="paid">✓ Paid Confirmed ({paymentStats.paidCount})</option>
            <option value="pending">⏳ Checkout Pending ({paymentStats.pendingCount})</option>
            <option value="free">Free / Opt-Out Inquiries</option>
          </select>

          {/* Form Source Filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            aria-label="Filter by website form"
            className="apple-input h-10 px-3 text-[12px] font-semibold rounded-[11px]"
          >
            <option value="all">All Website Forms</option>
            <option value="contact">Contact Form (/contact)</option>
            <option value="service">Services Modal (/services)</option>
            <option value="product">Product Demo (/products)</option>
            <option value="newsletter">Newsletter Subscription</option>
          </select>
        </div>

        <div className="relative w-full lg:w-72">
          <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apple-text-tertiary)] text-xs pointer-events-none"></i>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search client, phone, service, payment ID…"
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
                <th className="px-5 py-4">Client Identity</th>
                <th className="px-5 py-4">Form Data &amp; Scope</th>
                <th className="px-5 py-4">Payment Confirmation</th>
                <th className="px-5 py-4">Priority</th>
                <th className="px-5 py-4">Received</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apple-border)]">
              {isLoading && submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[13px] text-[var(--apple-text-secondary)]">
                    Loading client inquiries &amp; payment confirmations…
                  </td>
                </tr>
              ) : filteredSubmissions.length > 0 ? (
                filteredSubmissions.map((sub) => {
                  const phoneVal = sub.phone || sub.formData?.phone || '';
                  const companyVal = sub.company || sub.formData?.company || '';
                  const serviceVal = sub.service || sub.formData?.service || sub.formData?.product || '';
                  const timelineVal = formatTimeline(sub.timeline || sub.formData?.timeline);
                  const sourceVal = sub.form_source || sub.formData?.form_source || 'Contact Form';

                  return (
                    <tr
                      key={sub.id}
                      onClick={() => openDetail(sub)}
                      className="hover:bg-[var(--apple-surface-subcard-hover)] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-[13px] shrink-0 ${
                              sub.payment_status === 'paid'
                                ? 'bg-[#28CD41]/15 text-[#1E8E3E] dark:text-[#30D158]'
                                : 'bg-[#4e45e1]/12 text-[var(--apple-blue)]'
                            }`}
                          >
                            {(sub.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] truncate">
                              {sub.name}
                            </p>
                            <p className="text-[12px] text-[var(--apple-text-tertiary)] truncate">
                              {sub.email}
                            </p>
                            {(phoneVal || companyVal) && (
                              <p className="text-[11px] text-[var(--apple-text-secondary)] truncate mt-0.5">
                                {phoneVal ? `📞 ${phoneVal}` : ''}
                                {phoneVal && companyVal ? ' • ' : ''}
                                {companyVal ? companyVal : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 max-w-sm">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#4e45e1]/10 text-[var(--apple-blue)]">
                            {sourceVal}
                          </span>
                          {serviceVal && serviceVal !== 'Newsletter' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium apple-subcard text-[var(--apple-text-secondary)] truncate max-w-[160px]">
                              {serviceVal}
                            </span>
                          )}
                          {timelineVal && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#5856D6]/10 text-[#5856D6]">
                              ⏱ {timelineVal}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] font-semibold text-[var(--apple-text-primary)] truncate">
                          {sub.subject}
                        </p>
                        <p className="text-[12px] text-[var(--apple-text-secondary)] truncate mt-0.5">
                          {sub.message}
                        </p>
                      </td>

                      <td className="px-5 py-4">{renderPaymentBadge(sub)}</td>

                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
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

                      <td className="px-5 py-4 text-[12px] font-mono text-[var(--apple-text-secondary)] whitespace-nowrap">
                        {sub.date}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${getStatusBadge(
                            sub.status
                          )}`}
                        >
                          {sub.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openDetail(sub)}
                            className="px-3 py-1.5 rounded-[9px] apple-subcard text-[12px] font-medium text-[var(--apple-text-primary)] hover:text-[var(--apple-blue)] whitespace-nowrap"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => deleteSubmission(sub.id)}
                            className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[#FF3B30] flex items-center justify-center shrink-0"
                            title="Delete Inquiry"
                          >
                            <i className="fas fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-11 h-11 rounded-2xl bg-[#4e45e1]/10 text-[var(--apple-blue)] flex items-center justify-center mx-auto">
                        <i className="fas fa-envelope-open-text"></i>
                      </div>
                      <p className="text-[14px] font-semibold text-[var(--apple-text-primary)]">
                        No matching client inquiries found
                      </p>
                      <p className="text-[12px] text-[var(--apple-text-secondary)]">
                        Form submissions and Stripe payment confirmations from devinquire.com appear here automatically.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Inquiry, Submitted Form Data & Payment Confirmation Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-[15px] shrink-0 ${
                    selectedSubmission.payment_status === 'paid'
                      ? 'bg-[#28CD41]/15 text-[#1E8E3E] dark:text-[#30D158]'
                      : 'bg-[#4e45e1]/12 text-[var(--apple-blue)]'
                  }`}
                >
                  {(selectedSubmission.name || 'C').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)] truncate">
                      {selectedSubmission.subject}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#4e45e1]/12 text-[var(--apple-blue)]">
                      {selectedSubmission.form_source || 'Website Form'}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--apple-text-secondary)] truncate">
                    From {selectedSubmission.name} ({selectedSubmission.email}) • Received {selectedSubmission.date}
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
              {/* SECTION 1: PAYMENT CONFIRMATION CARD */}
              <div
                className={`p-4 rounded-[16px] border space-y-3.5 ${
                  paymentEdit.payment_status === 'paid'
                    ? 'bg-[#28CD41]/[0.06] border-[#28CD41]/30'
                    : paymentEdit.payment_status === 'pending'
                    ? 'bg-[#FF9500]/[0.06] border-[#FF9500]/30'
                    : 'apple-subcard border-[var(--apple-border)]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0 ${
                        paymentEdit.payment_status === 'paid'
                          ? 'bg-[#28CD41]/20 text-[#1E8E3E] dark:text-[#30D158]'
                          : paymentEdit.payment_status === 'pending'
                          ? 'bg-[#FF9500]/20 text-[#D97706]'
                          : 'bg-[#4e45e1]/12 text-[var(--apple-blue)]'
                      }`}
                    >
                      <i
                        className={`fas ${
                          paymentEdit.payment_status === 'paid'
                            ? 'fa-shield-check'
                            : paymentEdit.payment_status === 'pending'
                            ? 'fa-hourglass-half'
                            : 'fa-credit-card'
                        } text-sm`}
                      ></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-bold text-[var(--apple-text-primary)]">
                          Payment Confirmation
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase ${
                            paymentEdit.payment_status === 'paid'
                              ? 'bg-[#28CD41]/20 text-[#1E8E3E] dark:text-[#30D158]'
                              : paymentEdit.payment_status === 'pending'
                              ? 'bg-[#FF9500]/20 text-[#D97706]'
                              : paymentEdit.payment_status === 'cancelled'
                              ? 'bg-[#FF3B30]/15 text-[#FF3B30]'
                              : 'bg-black/[0.06] dark:bg-white/[0.08] text-[var(--apple-text-secondary)]'
                          }`}
                        >
                          {paymentEdit.payment_status === 'paid'
                            ? `✓ Confirmed • ₹${paymentEdit.payment_amount || 399}/-`
                            : paymentEdit.payment_status === 'pending'
                            ? `⏳ Checkout Pending • ₹${paymentEdit.payment_amount || 399}/-`
                            : paymentEdit.payment_status === 'opt_out'
                            ? 'Free Query (Opted Out)'
                            : paymentEdit.payment_status === 'cancelled'
                            ? 'Checkout Cancelled'
                            : 'No Pre-Booking Payment'}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--apple-text-secondary)] mt-0.5">
                        {paymentEdit.payment_status === 'paid'
                          ? `${formatPlanLabel(paymentEdit.payment_plan, paymentEdit.payment_amount)}${
                              selectedSubmission.paid_at
                                ? ` • Paid ${new Date(selectedSubmission.paid_at).toLocaleString()}`
                                : ''
                            }`
                          : 'Pre-booking status from devinquire.com Stripe Checkout (or confirm manually below).'}
                      </p>
                    </div>
                  </div>

                  {paymentEdit.payment_status !== 'paid' && (
                    <button
                      type="button"
                      onClick={handleQuickConfirmPayment}
                      className="px-3.5 py-2 rounded-[10px] bg-[#28CD41] hover:opacity-95 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm"
                    >
                      <i className="fas fa-check text-[11px] badge-white"></i>
                      <span className="badge-white">Mark Payment Confirmed</span>
                    </button>
                  )}
                </div>

                {/* Editable Payment Confirmation Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--apple-border)]/60">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Payment State
                    </label>
                    <select
                      value={paymentEdit.payment_status}
                      onChange={(e) => {
                        const nextSt = e.target.value as InquiryPaymentStatus;
                        setPaymentEdit((prev) => ({
                          ...prev,
                          payment_status: nextSt,
                          payment_amount:
                            nextSt === 'paid' && !prev.payment_amount
                              ? prev.payment_plan === 'service_confirmation'
                                ? 99
                                : 399
                              : prev.payment_amount,
                        }));
                      }}
                      className="w-full apple-input px-2.5 py-1.5 text-[12px]"
                    >
                      <option value="none">None / Standard</option>
                      <option value="opt_out">Free Query (Opt-Out)</option>
                      <option value="pending">Pending Checkout</option>
                      <option value="paid">✓ Paid Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Pre-Booking Tier
                    </label>
                    <select
                      value={paymentEdit.payment_plan || 'consultation'}
                      onChange={(e) => {
                        const nextPlan = e.target.value;
                        setPaymentEdit((prev) => ({
                          ...prev,
                          payment_plan: nextPlan,
                          payment_amount:
                            nextPlan === 'service_confirmation'
                              ? 99
                              : nextPlan === 'consultation'
                              ? 399
                              : prev.payment_amount,
                        }));
                      }}
                      className="w-full apple-input px-2.5 py-1.5 text-[12px]"
                    >
                      <option value="consultation">1:1 Consultation (₹399)</option>
                      <option value="service_confirmation">Service Pass (₹99)</option>
                      <option value="custom">Custom Payment</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Amount (INR ₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={paymentEdit.payment_amount}
                      onChange={(e) =>
                        setPaymentEdit((prev) => ({
                          ...prev,
                          payment_amount: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-full apple-input px-2.5 py-1.5 text-[12px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                        Stripe / Txn Ref ID
                      </label>
                      {paymentEdit.payment_reference && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(paymentEdit.payment_reference, 'Payment Reference')
                          }
                          className="text-[10px] font-semibold text-[var(--apple-blue)] hover:underline"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={paymentEdit.payment_reference}
                      onChange={(e) =>
                        setPaymentEdit((prev) => ({
                          ...prev,
                          payment_reference: e.target.value,
                        }))
                      }
                      placeholder="cs_test_… / pi_… / UPI ref"
                      className="w-full apple-input px-2.5 py-1.5 text-[12px] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: SUBMITTED WEBSITE FORM DATA GRID */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-text-secondary)]">
                    Submitted Form Data (devinquire.com)
                  </label>
                  <div className="flex items-center gap-2">
                    {(selectedSubmission.phone || selectedSubmission.formData?.phone) && (
                      <a
                        href={`https://wa.me/${String(
                          selectedSubmission.phone || selectedSubmission.formData?.phone
                        ).replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11.5px] font-semibold text-[#1E8E3E] dark:text-[#30D158] hover:underline inline-flex items-center gap-1"
                      >
                        <i className="fab fa-whatsapp"></i>
                        <span>WhatsApp Client</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 apple-subcard p-4 rounded-[16px] text-[12.5px]">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                      Full Name
                    </p>
                    <p className="font-semibold text-[var(--apple-text-primary)] mt-0.5">
                      {selectedSubmission.name || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                      Email Address
                    </p>
                    <a
                      href={`mailto:${selectedSubmission.email}`}
                      className="font-semibold text-[var(--apple-blue)] hover:underline break-all mt-0.5 inline-block"
                    >
                      {selectedSubmission.email || '—'}
                    </a>
                  </div>

                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                      Phone / WhatsApp
                    </p>
                    {selectedSubmission.phone || selectedSubmission.formData?.phone ? (
                      <a
                        href={`tel:${selectedSubmission.phone || selectedSubmission.formData?.phone}`}
                        className="font-semibold text-[var(--apple-text-primary)] hover:text-[var(--apple-blue)] mt-0.5 inline-block"
                      >
                        {selectedSubmission.phone || selectedSubmission.formData?.phone}
                      </a>
                    ) : (
                      <p className="text-[var(--apple-text-tertiary)] mt-0.5">Not provided</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                      Company / Organization
                    </p>
                    <p className="font-medium text-[var(--apple-text-primary)] mt-0.5">
                      {selectedSubmission.company || selectedSubmission.formData?.company || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                      Selected Service / Product
                    </p>
                    <p className="font-semibold text-[var(--apple-text-primary)] mt-0.5">
                      {selectedSubmission.service ||
                        selectedSubmission.formData?.product ||
                        selectedSubmission.formData?.service ||
                        'General Engineering Inquiry'}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                      Project Timeline
                    </p>
                    <p className="font-medium text-[var(--apple-text-primary)] mt-0.5">
                      {formatTimeline(
                        selectedSubmission.timeline || selectedSubmission.formData?.timeline
                      ) || 'Flexible / Not specified'}
                    </p>
                  </div>

                  {Array.isArray(selectedSubmission.formData?.categories) &&
                    selectedSubmission.formData.categories.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                          Subscribed Topics
                        </p>
                        <p className="font-medium text-[var(--apple-text-primary)] mt-0.5">
                          {selectedSubmission.formData.categories.join(', ')}
                        </p>
                      </div>
                    )}

                  {selectedSubmission.formData?.page_url && (
                    <div className="sm:col-span-3 pt-2 border-t border-[var(--apple-border)]/50 flex items-center justify-between gap-2 text-[11px] text-[var(--apple-text-tertiary)]">
                      <span className="truncate">
                        Submitted from: <strong className="font-mono">{selectedSubmission.formData.page_url}</strong>
                      </span>
                      {selectedSubmission.formData?.submitted_at && (
                        <span className="shrink-0">
                          {new Date(selectedSubmission.formData.submitted_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Client Message */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Project Brief / Submitted Message
                </label>
                <div className="apple-subcard p-4 rounded-[14px] text-[13px] text-[var(--apple-text-primary)] leading-relaxed whitespace-pre-wrap">
                  {selectedSubmission.message}
                </div>
              </div>

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
                  rows={3}
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
                    {isSavingDetail ? 'Saving…' : 'Save Changes'}
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
            <form onSubmit={handleCreateInquiry} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
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
                    Phone / WhatsApp
                  </label>
                  <input
                    value={newInquiry.phone}
                    onChange={(e) => setNewInquiry({ ...newInquiry, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Service / Product
                  </label>
                  <input
                    value={newInquiry.service}
                    onChange={(e) => setNewInquiry({ ...newInquiry, service: e.target.value })}
                    placeholder="Custom Web Application"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Payment Confirmation
                  </label>
                  <select
                    value={
                      newInquiry.payment_status === 'paid'
                        ? newInquiry.payment_plan || 'consultation'
                        : 'none'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'consultation') {
                        setNewInquiry({
                          ...newInquiry,
                          payment_status: 'paid',
                          payment_plan: 'consultation',
                          payment_amount: 399,
                          priority: 'High',
                        });
                      } else if (val === 'service_confirmation') {
                        setNewInquiry({
                          ...newInquiry,
                          payment_status: 'paid',
                          payment_plan: 'service_confirmation',
                          payment_amount: 99,
                          priority: 'High',
                        });
                      } else {
                        setNewInquiry({
                          ...newInquiry,
                          payment_status: 'none',
                          payment_plan: '',
                          payment_amount: 0,
                        });
                      }
                    }}
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    <option value="none">No Payment / Standard</option>
                    <option value="consultation">✓ Paid ₹399/- (1:1 Consultation)</option>
                    <option value="service_confirmation">✓ Paid ₹99/- (Service Pass)</option>
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
                  rows={3}
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

      {/* Inquiry Configuration Modal (Admin Only — Independent from Access & Users Email Settings) */}
      {isAdmin && showConfigModal && (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  Client Inquiry Mail &amp; Routing Settings
                </h3>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Dedicated mailbox setup for website inquiries (<code>contact@devinquire.com</code>) — separate from Access &amp; Users account emails.
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

              {/* Outbound Mail / Hostinger SMTP & Web3Forms Settings */}
              <div className="apple-subcard p-4 rounded-[14px] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                      Live Hostinger SMTP Configuration
                    </p>
                    <p className="text-[11px] text-[var(--apple-text-secondary)]">
                      {config.smtpUser && config.smtpPass
                        ? `Active: Hostinger/Custom SMTP (${config.smtpHost}:${config.smtpPort})`
                        : 'Enter your contact@devinquire.com mailbox password below to activate live SMTP'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          smtpHost: 'smtp.hostinger.com',
                          smtpPort: 465,
                          smtpUser: config.smtpUser || 'contact@devinquire.com',
                          fromEmail: 'contact@devinquire.com',
                          recipientEmail: config.recipientEmail || 'contact@devinquire.com',
                        })
                      }
                      className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-[#4e45e1]/12 text-[var(--apple-blue)] hover:bg-[#4e45e1]/20 transition-colors"
                    >
                      Apply Hostinger Preset
                    </button>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]">
                      {config.smtpUser && config.smtpPass ? 'SMTP Ready' : 'Password Needed'}
                    </span>
                  </div>
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
                      placeholder="smtp.hostinger.com"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP Port (465 SSL)
                    </label>
                    <input
                      type="number"
                      value={config.smtpPort}
                      onChange={(e) =>
                        setConfig({ ...config, smtpPort: Number(e.target.value) || 465 })
                      }
                      placeholder="465"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Mailbox / SMTP Username
                    </label>
                    <input
                      type="email"
                      value={config.smtpUser}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          smtpUser: e.target.value,
                          fromEmail: e.target.value || config.fromEmail,
                        })
                      }
                      placeholder="contact@devinquire.com"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Hostinger Mailbox Password
                    </label>
                    <input
                      type="password"
                      value={config.smtpPass}
                      onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
                      placeholder="Enter contact@devinquire.com password"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      Sender Name (From Name)
                    </label>
                    <input
                      type="text"
                      value={config.fromName}
                      onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                      placeholder="DevInquire"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      From Email (Must match Hostinger Mailbox)
                    </label>
                    <input
                      type="email"
                      value={config.fromEmail}
                      onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                      placeholder="contact@devinquire.com"
                      className="w-full apple-input px-3 py-1.5 text-[12px]"
                    />
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={isTestingSmtp}
                    className="px-3.5 py-2 rounded-[10px] bg-[#4e45e1] text-white text-[12px] font-semibold hover:opacity-95 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <i className={`fas ${isTestingSmtp ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-[11px]`}></i>
                    <span>{isTestingSmtp ? 'Verifying & Sending Test Email…' : 'Send Live Test Email & Save'}</span>
                  </button>
                  <span className="text-[11px] text-[var(--apple-text-tertiary)]">
                    Saved securely in your live Hostinger MySQL database
                  </span>
                </div>

                {smtpTestStatus && (
                  <div
                    className={`p-3 rounded-[10px] text-[12px] font-medium flex items-start gap-2 ${
                      smtpTestStatus.type === 'success'
                        ? 'bg-[#28CD41]/12 border border-[#28CD41]/25 text-[#248A3D] dark:text-[#30D158]'
                        : 'bg-[#FF3B30]/10 border border-[#FF3B30]/25 text-[#FF3B30]'
                    }`}
                  >
                    <i
                      className={`fas ${
                        smtpTestStatus.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'
                      } mt-0.5`}
                    ></i>
                    <span>{smtpTestStatus.text}</span>
                  </div>
                )}
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
                      Pre-fill &amp; send client acknowledgement
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
