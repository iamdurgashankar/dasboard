import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';
import { api } from '../services/api';

const ROLE_DETAILS: Record<UserRole, { icon: string; color: string; desc: string; bg: string }> = {
  Admin: {
    icon: 'fa-shield-halved',
    color: 'text-[#FF9500]',
    bg: 'bg-[#FF9500]/12',
    desc: 'Full administrative control over all platform modules, users, and client projects.'
  },
  Developer: {
    icon: 'fa-code',
    color: 'text-[var(--apple-blue)]',
    bg: 'bg-[#4e45e1]/12',
    desc: 'Access to Client Projects, DI AI, Editorial Studio, Client Inquiries, and Quotations.'
  },
  Editor: {
    icon: 'fa-pen-nib',
    color: 'text-[#AF52DE]',
    bg: 'bg-[#AF52DE]/12',
    desc: 'Access to Overview, Client Projects, DI AI, and Blog Management.'
  },
  Viewer: {
    icon: 'fa-eye',
    color: 'text-[#248A3D] dark:text-[#30D158]',
    bg: 'bg-[#28CD41]/12',
    desc: 'Client Portal read-only access to assigned Client Projects and live milestone updates.'
  }
};

interface EmailSettingsState {
  adminEmail: string;
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  hasSmtpPass?: boolean;
  smtpConfigured?: boolean;
  web3FormsEnabled: boolean;
  bccAdminOnDecision: boolean;
  recentLogs?: Array<{
    id: string;
    timestamp: string;
    event: string;
    to: string;
    channel: string;
    status: string;
    error?: string;
  }>;
}

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  const detail = ROLE_DETAILS[role] || ROLE_DETAILS.Developer;
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold ${detail.bg} ${detail.color}`}
      title={detail.desc}
    >
      <i className={`fas ${detail.icon} text-[10px]`}></i>
      <span>{role}</span>
    </span>
  );
};

const UserManagement: React.FC = () => {
  const location = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);

  const [activeView, setActiveView] = useState<'all' | 'pending' | 'rejected'>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') === 'pending' ? 'pending' : 'all';
  });

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [userToRemove, setUserToRemove] = useState<User | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Reject Pending Signup Modal
  const [userToReject, setUserToReject] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Email Notifications Settings Modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSavingEmailCfg, setIsSavingEmailCfg] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailModalNotice, setEmailModalNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [emailConfig, setEmailConfig] = useState<EmailSettingsState>({
    adminEmail: 'admin@devinquire.com',
    fromName: 'DevInquire',
    fromEmail: 'admin@devinquire.com',
    smtpHost: 'smtp.hostinger.com',
    smtpPort: 465,
    smtpUser: '',
    smtpPass: '',
    hasSmtpPass: false,
    smtpConfigured: false,
    web3FormsEnabled: true,
    bccAdminOnDecision: true,
    recentLogs: []
  });

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'Developer',
    avatar: ''
  });
  const [userPassword, setUserPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedApprovalRoles, setSelectedApprovalRoles] = useState<Record<string, User['role']>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotice = (text: string, type: 'success' | 'warning' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5500);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'pending') {
      setActiveView('pending');
    }
  }, [location.search]);

  useEffect(() => {
    fetchUsers();
    fetchEmailConfig();
    const interval = setInterval(() => fetchUsers(true), 20000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async (silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.users.list();
      if (res.status === 'success') {
        const mapped = (res.data || []).map((u: any) => {
          const rawSt = String(u.status || 'active').toLowerCase();
          const st: User['status'] =
            rawSt === 'pending' ? 'pending' : rawSt === 'rejected' ? 'rejected' : 'active';
          return {
            ...u,
            id: String(u.id),
            status: st,
            rejectionReason: u.rejectionReason || u.rejection_reason || undefined,
            joinDate: u.joinDate ? String(u.joinDate).split(' ')[0].split('T')[0] : 'Active'
          };
        });
        setUsers(mapped);
        setError(null);
      } else if (!silent) {
        setError(res.message);
      }
    } catch (err) {
      if (!silent) setError('Failed to reach identity provider.');
      console.error(err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const fetchEmailConfig = async () => {
    try {
      const res = await api.users.getEmailConfig();
      if (res.status === 'success' && res.data) {
        setEmailConfig((prev) => ({
          ...prev,
          ...res.data,
          smtpPass: ''
        }));
      }
    } catch {
      // keep defaults
    }
  };

  const activeCount = useMemo(() => users.filter((u) => u.status === 'active').length, [users]);
  const pendingCount = useMemo(() => users.filter((u) => u.status === 'pending').length, [users]);
  const rejectedCount = useMemo(() => users.filter((u) => u.status === 'rejected').length, [users]);

  const filteredUsers = useMemo(() => {
    if (activeView === 'pending') return users.filter((u) => u.status === 'pending');
    if (activeView === 'rejected') return users.filter((u) => u.status === 'rejected');
    return users.filter((u) => u.status === 'active');
  }, [users, activeView]);

  const getPlaceholder = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=4e45e1&color=fff&bold=true`;
  };

  const handleApprove = async (id: string, role?: User['role']) => {
    setApprovingId(id);
    try {
      const assignedRole = role || selectedApprovalRoles[id] || 'Developer';
      const res = await api.users.update({ id, status: 'active', role: assignedRole });
      await Promise.all([fetchUsers(true), fetchEmailConfig()]);
      const sentOk = Boolean(res?.data?.emailSent);
      showNotice(
        res?.message || `User approved as ${assignedRole}.`,
        sentOk ? 'success' : 'warning'
      );
    } catch (err: any) {
      setError(err?.message || 'Approval failed.');
    } finally {
      setApprovingId(null);
    }
  };

  const openRejectModal = (user: User) => {
    setUserToReject(user);
    setRejectReason('');
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReject) return;
    setIsRejecting(true);
    try {
      const res = await api.users.reject({
        id: userToReject.id,
        reason: rejectReason.trim(),
        deleteAccount: false
      });
      await Promise.all([fetchUsers(true), fetchEmailConfig()]);
      setUserToReject(null);
      setRejectReason('');
      const sentOk = Boolean(res?.data?.emailSent);
      showNotice(
        res?.message || `Access request for ${userToReject.email} rejected.`,
        sentOk ? 'success' : 'warning'
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to reject access request.');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSaveEmailSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmailCfg(true);
    setEmailModalNotice(null);
    try {
      const payload: any = {
        adminEmail: emailConfig.adminEmail,
        fromName: emailConfig.fromName,
        fromEmail: emailConfig.fromEmail,
        smtpHost: emailConfig.smtpHost,
        smtpPort: emailConfig.smtpPort,
        smtpUser: emailConfig.smtpUser,
        web3FormsEnabled: emailConfig.web3FormsEnabled,
        bccAdminOnDecision: emailConfig.bccAdminOnDecision
      };
      if (emailConfig.smtpPass.trim()) {
        payload.smtpPass = emailConfig.smtpPass.trim();
      }
      const res = await api.users.saveEmailConfig(payload);
      if (res.status === 'success' && res.data) {
        setEmailConfig((prev) => ({ ...prev, ...res.data, smtpPass: '' }));
        setEmailModalNotice({
          type: 'success',
          text: 'Email notification settings saved.'
        });
        showNotice('Access & signup email notification settings saved.');
      }
    } catch (err: any) {
      setEmailModalNotice({
        type: 'error',
        text: err?.message || 'Failed to save email settings.'
      });
    } finally {
      setIsSavingEmailCfg(false);
    }
  };

  const handleTestSmtpDelivery = async () => {
    setIsTestingEmail(true);
    setEmailModalNotice(null);
    try {
      const payload: any = {
        adminEmail: emailConfig.adminEmail,
        fromName: emailConfig.fromName,
        fromEmail: emailConfig.fromEmail,
        smtpHost: emailConfig.smtpHost,
        smtpPort: emailConfig.smtpPort,
        smtpUser: emailConfig.smtpUser,
        targetEmail: emailConfig.adminEmail || 'admin@devinquire.com'
      };
      if (emailConfig.smtpPass.trim()) {
        payload.smtpPass = emailConfig.smtpPass.trim();
      }
      const res = await api.users.sendTestEmail(payload);
      await fetchEmailConfig();
      setEmailModalNotice({
        type: 'success',
        text: res.message || 'Test email delivered successfully!'
      });
    } catch (err: any) {
      setEmailModalNotice({
        type: 'error',
        text: err?.message || 'SMTP test failed. Verify host, port, and password.'
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const initiateRemove = (user: User) => {
    setUserToRemove(user);
    setDeleteConfirmation('');
  };

  const confirmRemove = async () => {
    if (!userToRemove || deleteConfirmation !== userToRemove.name) return;
    setIsRemoving(true);
    try {
      const res = await api.users.delete(userToRemove.id);
      await fetchUsers(true);
      setUserToRemove(null);
      showNotice(res?.message || 'User removed from directory.');
    } catch (err) {
      console.error('Decommission error:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  const openModal = (mode: 'add' | 'edit', user?: User) => {
    setModalMode(mode);
    setUserPassword('');
    if (mode === 'edit' && user) {
      setFormData(user);
      setAvatarPreview(user.avatar || null);
    } else {
      setFormData({ name: '', email: '', role: 'Developer', avatar: '' });
      setAvatarPreview(null);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setFormData({});
    setUserPassword('');
    setAvatarPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        alert('Invalid file type. Please upload a JPG or PNG image.');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('File size limit exceeded. Maximum allowed size is 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatarPreview(base64String);
        setFormData((prev) => ({ ...prev, avatar: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    try {
      if (modalMode === 'add') {
        const res = await api.users.create({
          name: formData.name,
          email: formData.email,
          role: formData.role || 'Developer',
          password: userPassword || 'DevInquire2026!',
          avatar: formData.avatar || null
        });
        showNotice(res?.message || 'User account provisioned.');
      } else if (modalMode === 'edit' && formData.id) {
        const updatePayload: any = { ...formData };
        if (userPassword.trim()) {
          updatePayload.password = userPassword.trim();
        }
        const res = await api.users.update(updatePayload);
        showNotice(res?.message || 'User account updated.');
      }
      await fetchUsers(true);
      closeModal();
    } catch (err: any) {
      alert(err?.message || 'Failed to save user account.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)]">
              Role-Based Access Control &amp; Email Approvals
            </p>
            <span
              onClick={() => {
                setEmailModalNotice(null);
                setShowEmailModal(true);
              }}
              className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                emailConfig.smtpConfigured
                  ? 'bg-[#28CD41]/12 text-[#1E8E3E] dark:text-[#30D158]'
                  : 'bg-[#FF9500]/15 text-[#D97706]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  emailConfig.smtpConfigured ? 'bg-[#28CD41]' : 'bg-[#FF9500]'
                }`}
              ></span>
              <span>
                {emailConfig.smtpConfigured
                  ? 'SMTP Active (Admin + Applicant Emails)'
                  : 'Admin Relay Active • Set SMTP for Applicant Emails'}
              </span>
            </span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            Access &amp; Users
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            New signups notify <strong>{emailConfig.adminEmail || 'admin@devinquire.com'}</strong>, and approving or rejecting a request sends an email confirmation to the applicant.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center flex-wrap">
          <button
            type="button"
            onClick={() => {
              setEmailModalNotice(null);
              fetchEmailConfig();
              setShowEmailModal(true);
            }}
            className="h-10 px-4 apple-secondary-btn rounded-[12px] text-[13px] font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-envelope-circle-check text-[var(--apple-blue)] text-xs"></i>
            <span>Email Notifications</span>
          </button>

          <button
            onClick={() => openModal('add')}
            className="h-10 px-4 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
          >
            <i className="fas fa-plus text-xs badge-white shrink-0"></i>
            <span>Provision User</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`p-3.5 rounded-[12px] text-[13px] font-medium flex items-center justify-between gap-3 ${
            toast.type === 'success'
              ? 'bg-[#28CD41]/12 border border-[#28CD41]/25 text-[#1E8E3E] dark:text-[#30D158]'
              : 'bg-[#FF9500]/12 border border-[#FF9500]/25 text-[#D97706] dark:text-[#FF9F0A]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <i
              className={`fas ${
                toast.type === 'success' ? 'fa-circle-check' : 'fa-circle-info'
              }`}
            ></i>
            <span>{toast.text}</span>
          </div>
          {toast.type === 'warning' && !emailConfig.smtpConfigured && (
            <button
              type="button"
              onClick={() => {
                setEmailModalNotice(null);
                setShowEmailModal(true);
              }}
              className="px-3 py-1 rounded-[8px] bg-[#FF9500] text-white text-[11.5px] font-semibold shrink-0"
            >
              Configure SMTP
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] rounded-[14px] text-[13px] flex items-center gap-2.5">
          <i className="fas fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Pending Signup Alert Banner */}
      {pendingCount > 0 && activeView !== 'pending' && (
        <div className="apple-card p-4 border border-[#FF9500]/30 bg-[#FF9500]/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#FF9500]/20 text-[#D97706] flex items-center justify-center shrink-0">
              <i className="fas fa-user-clock text-sm"></i>
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-[var(--apple-text-primary)]">
                {pendingCount} New Account Request{pendingCount === 1 ? '' : 's'} Pending Your Review
              </p>
              <p className="text-[12px] text-[var(--apple-text-secondary)]">
                Approve or reject to send an automatic confirmation email to the requested person.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('pending')}
            className="px-4 py-2 apple-pill-btn rounded-[10px] text-[12.5px] font-semibold shrink-0 self-start sm:self-center"
          >
            Review Pending Requests ({pendingCount})
          </button>
        </div>
      )}

      {/* Segmented Filter Tabs */}
      <div className="flex items-center gap-2 apple-subcard p-1 rounded-[12px] w-fit flex-wrap">
        <button
          onClick={() => setActiveView('all')}
          className={`px-4 py-1.5 rounded-[9px] text-[12px] font-semibold transition-all ${
            activeView === 'all'
              ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
              : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
          }`}
        >
          Active Accounts ({activeCount})
        </button>

        <button
          onClick={() => setActiveView('pending')}
          className={`px-4 py-1.5 rounded-[9px] text-[12px] font-semibold transition-all flex items-center gap-2 ${
            activeView === 'pending'
              ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
              : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
          }`}
        >
          <span>Pending Approval</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full badge-white">
              {pendingCount}
            </span>
          )}
        </button>

        {(rejectedCount > 0 || activeView === 'rejected') && (
          <button
            onClick={() => setActiveView('rejected')}
            className={`px-4 py-1.5 rounded-[9px] text-[12px] font-semibold transition-all flex items-center gap-2 ${
              activeView === 'rejected'
                ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
            }`}
          >
            <span>Rejected ({rejectedCount})</span>
          </button>
        )}
      </div>

      {/* Users Table Card */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--apple-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                <th className="px-6 py-4">Account Identity</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4">Requested / Joined</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apple-border)]">
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[13px] text-[var(--apple-text-secondary)]">
                    Loading user directory…
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--apple-surface-subcard-hover)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={user.avatar || getPlaceholder(user.name)}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-[var(--apple-border)]"
                          alt={user.name}
                        />
                        <div>
                          <p className="text-[14px] font-semibold text-[var(--apple-text-primary)]">{user.name}</p>
                          <p className="text-[12px] text-[var(--apple-text-tertiary)]">{user.email}</p>
                          {user.status === 'rejected' && user.rejectionReason && (
                            <p className="text-[11px] text-[#FF3B30] mt-0.5">
                              Note: {user.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-6 py-4 text-[12px] font-mono text-[var(--apple-text-secondary)]">
                      {user.joinDate}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                          user.status === 'active'
                            ? 'bg-[#28CD41]/12 text-[#248A3D] dark:text-[#30D158]'
                            : user.status === 'rejected'
                            ? 'bg-[#FF3B30]/12 text-[#FF3B30]'
                            : 'bg-[#FF9500]/15 text-[#FF9500]'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {user.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={selectedApprovalRoles[user.id] || user.role || 'Developer'}
                              onChange={(e) =>
                                setSelectedApprovalRoles((prev) => ({
                                  ...prev,
                                  [user.id]: e.target.value as User['role']
                                }))
                              }
                              aria-label="Select role for approval"
                              className="apple-input h-8 px-2.5 text-[12px] font-medium rounded-[9px]"
                            >
                              <option value="Developer">Developer</option>
                              <option value="Editor">Editor</option>
                              <option value="Viewer">Viewer</option>
                              <option value="Admin">Admin</option>
                            </select>
                            <button
                              disabled={approvingId === user.id}
                              onClick={() =>
                                handleApprove(
                                  user.id,
                                  selectedApprovalRoles[user.id] || user.role || 'Developer'
                                )
                              }
                              className="px-3.5 py-1.5 rounded-[9px] bg-[#28CD41] text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
                            >
                              <i
                                className={`fas ${
                                  approvingId === user.id ? 'fa-spinner fa-spin' : 'fa-check'
                                } text-[10px] badge-white`}
                              ></i>
                              <span className="badge-white">
                                {approvingId === user.id ? 'Approving…' : 'Approve & Email'}
                              </span>
                            </button>
                            <button
                              onClick={() => openRejectModal(user)}
                              className="px-3.5 py-1.5 rounded-[9px] bg-[#FF3B30]/12 text-[#FF3B30] text-[12px] font-semibold hover:bg-[#FF3B30] hover:text-white transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : user.status === 'rejected' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={approvingId === user.id}
                              onClick={() => handleApprove(user.id, user.role || 'Developer')}
                              className="px-3 py-1.5 rounded-[9px] bg-[#28CD41]/15 text-[#1E8E3E] dark:text-[#30D158] text-[12px] font-semibold hover:bg-[#28CD41] hover:text-white transition-colors"
                            >
                              Approve Instead
                            </button>
                            <button
                              onClick={() => initiateRemove(user)}
                              className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[#FF3B30] flex items-center justify-center"
                              title="Permanently Delete Record"
                            >
                              <i className="fas fa-trash-can text-xs"></i>
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => openModal('edit', user)}
                              className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[var(--apple-blue)] flex items-center justify-center"
                              title="Edit Role & Profile"
                            >
                              <i className="fas fa-pen text-xs"></i>
                            </button>
                            <button
                              onClick={() => initiateRemove(user)}
                              className="w-8 h-8 rounded-[9px] apple-subcard text-[var(--apple-text-secondary)] hover:text-[#FF3B30] flex items-center justify-center"
                              title="Remove User"
                            >
                              <i className="fas fa-trash-can text-xs"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-[13px] text-[var(--apple-text-secondary)]">
                    {activeView === 'pending'
                      ? 'No pending account requests right now.'
                      : 'No users found in this view.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Access Request Modal (Sends Rejection Email to Applicant) */}
      {userToReject && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <form
            onSubmit={handleConfirmReject}
            className="apple-glass rounded-[24px] w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#FF3B30]/12 text-[#FF3B30] flex items-center justify-center mx-auto">
                <i className="fas fa-user-slash text-lg"></i>
              </div>
              <h3 className="text-[18px] font-semibold text-[var(--apple-text-primary)]">
                Reject Access for {userToReject.name}?
              </h3>
              <p className="text-[13px] text-[var(--apple-text-secondary)] leading-relaxed">
                An email update will be sent directly to{' '}
                <strong className="text-[var(--apple-text-primary)]">{userToReject.email}</strong>{' '}
                informing them that their workspace request was declined.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                Optional Note / Reason for Applicant (included in email)
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Workspace access is restricted to verified team members or active client accounts."
                className="w-full apple-input p-3 text-[13px]"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setUserToReject(null);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRejecting}
                className="flex-1 py-2.5 rounded-[12px] bg-[#FF3B30] text-white text-[13px] font-semibold hover:opacity-95 disabled:opacity-50"
              >
                {isRejecting ? 'Rejecting…' : 'Reject & Send Email'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Email Notifications Settings Modal (SMTP + Admin Alert Recipient) */}
      {showEmailModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                  Account Signup &amp; Approval Email Settings
                </h3>
                <p className="text-[12px] text-[var(--apple-text-secondary)]">
                  Configure how admin alerts and applicant approval/rejection emails are delivered.
                </p>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="w-8 h-8 rounded-full apple-subcard text-[var(--apple-text-secondary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form
              onSubmit={handleSaveEmailSettings}
              className="p-6 space-y-4 max-h-[84vh] overflow-y-auto"
            >
              {emailModalNotice && (
                <div
                  className={`p-3 rounded-[12px] text-[12.5px] font-medium flex items-center gap-2 ${
                    emailModalNotice.type === 'success'
                      ? 'bg-[#28CD41]/12 border border-[#28CD41]/25 text-[#1E8E3E] dark:text-[#30D158]'
                      : 'bg-[#FF3B30]/12 border border-[#FF3B30]/25 text-[#FF3B30]'
                  }`}
                >
                  <i
                    className={`fas ${
                      emailModalNotice.type === 'success'
                        ? 'fa-circle-check'
                        : 'fa-circle-exclamation'
                    }`}
                  ></i>
                  <span>{emailModalNotice.text}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Admin Signup Alert Email
                  </label>
                  <input
                    required
                    type="email"
                    value={emailConfig.adminEmail}
                    onChange={(e) =>
                      setEmailConfig({ ...emailConfig, adminEmail: e.target.value })
                    }
                    placeholder="admin@devinquire.com"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Sender Display Name
                  </label>
                  <input
                    type="text"
                    value={emailConfig.fromName}
                    onChange={(e) =>
                      setEmailConfig({ ...emailConfig, fromName: e.target.value })
                    }
                    placeholder="DevInquire"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              {/* 1-Click Provider Presets */}
              <div className="apple-subcard p-4 rounded-[14px] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">
                      Outbound SMTP Credentials (Required to Email External Applicants)
                    </p>
                    <p className="text-[11px] text-[var(--apple-text-secondary)]">
                      Use your Hostinger mailbox (<code>admin@devinquire.com</code>) or Gmail App Password.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setEmailConfig((prev) => ({
                          ...prev,
                          smtpHost: 'smtp.hostinger.com',
                          smtpPort: 465,
                          smtpUser: prev.smtpUser || 'admin@devinquire.com',
                          fromEmail: prev.smtpUser || 'admin@devinquire.com'
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg apple-secondary-btn text-[11px] font-semibold"
                    >
                      Hostinger Preset
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEmailConfig((prev) => ({
                          ...prev,
                          smtpHost: 'smtp.gmail.com',
                          smtpPort: 587
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg apple-secondary-btn text-[11px] font-semibold"
                    >
                      Gmail Preset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={emailConfig.smtpHost}
                      onChange={(e) =>
                        setEmailConfig({ ...emailConfig, smtpHost: e.target.value })
                      }
                      placeholder="smtp.hostinger.com"
                      className="w-full apple-input px-3 py-1.5 text-[12.5px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      value={emailConfig.smtpPort}
                      onChange={(e) =>
                        setEmailConfig({
                          ...emailConfig,
                          smtpPort: Number(e.target.value) || 465
                        })
                      }
                      placeholder="465"
                      className="w-full apple-input px-3 py-1.5 text-[12.5px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP Email / Username
                    </label>
                    <input
                      type="email"
                      value={emailConfig.smtpUser}
                      onChange={(e) =>
                        setEmailConfig({
                          ...emailConfig,
                          smtpUser: e.target.value,
                          fromEmail: e.target.value
                        })
                      }
                      placeholder="admin@devinquire.com"
                      className="w-full apple-input px-3 py-1.5 text-[12.5px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
                      SMTP Password {emailConfig.hasSmtpPass ? '(Saved — enter to update)' : ''}
                    </label>
                    <input
                      type="password"
                      value={emailConfig.smtpPass}
                      onChange={(e) =>
                        setEmailConfig({ ...emailConfig, smtpPass: e.target.value })
                      }
                      placeholder={emailConfig.hasSmtpPass ? '•••••••••••• (saved)' : 'Mailbox or App Password'}
                      className="w-full apple-input px-3 py-1.5 text-[12.5px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 text-[12px] text-[var(--apple-text-secondary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailConfig.bccAdminOnDecision}
                      onChange={(e) =>
                        setEmailConfig({
                          ...emailConfig,
                          bccAdminOnDecision: e.target.checked
                        })
                      }
                      className="w-4 h-4 accent-[#4e45e1]"
                    />
                    <span>BCC admin@devinquire.com on approval/rejection emails</span>
                  </label>

                  <button
                    type="button"
                    disabled={isTestingEmail}
                    onClick={handleTestSmtpDelivery}
                    className="px-3.5 py-1.5 apple-secondary-btn rounded-[9px] text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <i
                      className={`fas ${
                        isTestingEmail ? 'fa-spinner fa-spin' : 'fa-paper-plane'
                      } text-[var(--apple-blue)] text-[11px]`}
                    ></i>
                    <span>{isTestingEmail ? 'Sending Test…' : 'Send Test Email'}</span>
                  </button>
                </div>
              </div>

              {Array.isArray(emailConfig.recentLogs) && emailConfig.recentLogs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                    Recent Email Activity
                  </p>
                  <div className="max-h-32 overflow-y-auto apple-subcard rounded-[12px] divide-y divide-[var(--apple-border)] text-[11.5px]">
                    {emailConfig.recentLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="font-semibold text-[var(--apple-text-primary)]">
                            {log.event.replace(/_/g, ' ')}
                          </span>{' '}
                          <span className="text-[var(--apple-text-secondary)]">→ {log.to}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                            log.status === 'sent'
                              ? 'bg-[#28CD41]/15 text-[#1E8E3E]'
                              : 'bg-[#FF9500]/15 text-[#D97706]'
                          }`}
                        >
                          {log.channel} • {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmailCfg}
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold disabled:opacity-50"
                >
                  {isSavingEmailCfg ? 'Saving…' : 'Save Email Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Active User Modal */}
      {userToRemove && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#FF3B30]/12 text-[#FF3B30] flex items-center justify-center mx-auto">
                <i className="fas fa-user-xmark text-lg"></i>
              </div>
              <h3 className="text-[18px] font-semibold text-[var(--apple-text-primary)]">
                Remove {userToRemove.name}?
              </h3>
              <p className="text-[13px] text-[var(--apple-text-secondary)]">
                Type <strong>{userToRemove.name}</strong> below to confirm permanent removal.
              </p>
            </div>

            <input
              type="text"
              autoFocus
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={userToRemove.name}
              className="w-full apple-input px-4 py-2.5 text-[14px]"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setUserToRemove(null);
                  setDeleteConfirmation('');
                }}
                className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={isRemoving || deleteConfirmation !== userToRemove.name}
                className="flex-1 py-2.5 rounded-[12px] bg-[#FF3B30] text-white text-[13px] font-semibold disabled:opacity-40"
              >
                {isRemoving ? 'Removing…' : 'Remove User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provision / Edit User Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">
                {modalMode === 'add' ? 'Provision New User Account' : 'Edit User Account'}
              </h3>
              <button
                onClick={closeModal}
                className="w-7 h-7 rounded-full apple-subcard text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] flex items-center justify-center"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Full Name *
                  </label>
                  <input
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Full Name"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Email Address *
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    {modalMode === 'add'
                      ? 'Initial Password (defaults to DevInquire2026!)'
                      : 'Reset Password (leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder={modalMode === 'add' ? 'Enter initial password…' : 'Enter new password…'}
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                    Account Status
                  </label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as 'active' | 'pending' | 'rejected'
                      })
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending Approval</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-medium text-[var(--apple-text-secondary)]">
                  Assigned Role
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(['Admin', 'Developer', 'Editor', 'Viewer'] as UserRole[]).map((role) => {
                    const detail = ROLE_DETAILS[role];
                    const isSelected = formData.role === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData({ ...formData, role })}
                        className={`flex items-center gap-3 p-3 rounded-[14px] border text-left transition-all ${
                          isSelected
                            ? 'border-[var(--apple-blue)] bg-[#4e45e1]/[0.06]'
                            : 'border-[var(--apple-border)] apple-subcard'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${detail.bg} ${detail.color}`}>
                          <i className={`fas ${detail.icon} text-sm`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--apple-text-primary)]">{role}</p>
                          <p className="text-[11px] text-[var(--apple-text-secondary)]">{detail.desc}</p>
                        </div>
                        {isSelected && (
                          <i className="fas fa-check-circle text-[var(--apple-blue)] text-sm"></i>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-semibold"
                >
                  {modalMode === 'add' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
