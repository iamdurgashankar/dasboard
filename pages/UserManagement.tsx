import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'pending'>('all');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [userToRemove, setUserToRemove] = useState<User | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
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

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.users.list();
      if (res.status === 'success') {
        const mapped = (res.data || []).map((u: any) => ({
          ...u,
          id: String(u.id),
          status: String(u.status || 'active').toLowerCase() === 'pending' ? 'pending' : 'active',
          joinDate: u.joinDate ? String(u.joinDate).split(' ')[0].split('T')[0] : 'Active'
        }));
        setUsers(mapped);
        setError(null);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('Failed to reach identity provider.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (activeView === 'pending') return users.filter(u => u.status === 'pending');
    return users.filter(u => u.status === 'active');
  }, [users, activeView]);

  const pendingCount = useMemo(() => users.filter(u => u.status === 'pending').length, [users]);

  const getPlaceholder = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=4e45e1&color=fff&bold=true`;
  };

  const handleApprove = async (id: string, role?: User['role']) => {
    try {
      const assignedRole = role || selectedApprovalRoles[id] || 'Developer';
      await api.users.update({ id, status: 'active', role: assignedRole });
      fetchUsers();
    } catch (err) {
      console.error('Approval error:', err);
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
      await api.users.delete(userToRemove.id);
      fetchUsers();
      setUserToRemove(null);
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
        setFormData(prev => ({ ...prev, avatar: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    try {
      if (modalMode === 'add') {
        await api.users.create({
          name: formData.name,
          email: formData.email,
          role: formData.role || 'Developer',
          password: userPassword || 'DevInquire2026!',
          avatar: formData.avatar || null
        });
      } else if (modalMode === 'edit' && formData.id) {
        const updatePayload: any = { ...formData };
        if (userPassword.trim()) {
          updatePayload.password = userPassword.trim();
        }
        await api.users.update(updatePayload);
      }
      await fetchUsers();
      closeModal();
    } catch (err: any) {
      alert(err?.message || 'Failed to save user account.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1440px] w-full mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--apple-blue)] mb-1">
            Role-Based Access Control
          </p>
          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-[var(--apple-text-primary)] leading-tight">
            Access & Users
          </h1>
          <p className="text-[14px] text-[var(--apple-text-secondary)] mt-0.5 max-w-2xl">
            Provision Admin, Developer, and Client Viewer accounts and manage workspace permissions.
          </p>
        </div>
        <button
          onClick={() => openModal('add')}
          className="h-10 px-4 apple-pill-btn rounded-[12px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap self-start md:self-center"
        >
          <i className="fas fa-plus text-xs badge-white shrink-0"></i>
          <span>Provision User</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30] rounded-[14px] text-[13px] flex items-center gap-2.5">
          <i className="fas fa-circle-exclamation"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Segmented Filter Tabs */}
      <div className="flex items-center gap-2 apple-subcard p-1 rounded-[12px] w-fit">
        <button
          onClick={() => setActiveView('all')}
          className={`px-4 py-1.5 rounded-[9px] text-[12px] font-semibold transition-all ${
            activeView === 'all'
              ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
              : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
          }`}
        >
          Active Accounts ({users.filter(u => u.status === 'active').length})
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
      </div>

      {/* Users Table Card */}
      <div className="apple-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--apple-border)] text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-tertiary)]">
                <th className="px-6 py-4">Account Identity</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4">Joined</th>
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
                                  [user.id]: e.target.value as User['role'],
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
                              onClick={() =>
                                handleApprove(
                                  user.id,
                                  selectedApprovalRoles[user.id] || user.role || 'Developer'
                                )
                              }
                              className="px-3 py-1.5 rounded-[9px] bg-[#28CD41] text-white text-[12px] font-semibold hover:opacity-90"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => initiateRemove(user)}
                              className="px-3 py-1.5 rounded-[9px] bg-[#FF3B30]/12 text-[#FF3B30] text-[12px] font-semibold hover:bg-[#FF3B30] hover:text-white transition-colors"
                            >
                              Reject
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
                    No users found in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remove User Modal */}
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
                        status: e.target.value as 'active' | 'pending',
                      })
                    }
                    className="w-full apple-input px-3.5 py-2 text-[13px]"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending Approval</option>
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
