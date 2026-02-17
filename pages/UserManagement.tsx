import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

const ROLE_DETAILS: Record<UserRole, { icon: string; color: string; desc: string; bg: string }> = {
  Admin: {
    icon: 'fa-shield-halved',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    desc: 'Full administrative control over all platform modules and security.'
  },
  Developer: {
    icon: 'fa-code',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    desc: 'Technical access to analytics, blogs, and AI technical lead.'
  },
  Viewer: {
    icon: 'fa-eye',
    color: 'text-slate-400',
    bg: 'bg-slate-400/10',
    desc: 'Read-only access to system reports and project dashboards.'
  },
};

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  const detail = ROLE_DETAILS[role];
  return (
    <div className={`group relative flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-transparent hover:border-slate-700 transition-all cursor-help ${detail.bg} ${detail.color}`}>
      <i className={`fas ${detail.icon} text-[10px]`}></i>
      <span className="text-[10px] font-black uppercase tracking-[0.1em]">{role}</span>

      {/* Informational Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 transform scale-95 group-hover:scale-100">
        <p className="text-[11px] font-black text-slate-100 mb-2 flex items-center gap-2">
          <i className={`fas ${detail.icon} ${detail.color}`}></i> {role} Privilege
        </p>
        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{detail.desc}</p>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-slate-800 rotate-45"></div>
      </div>
    </div>
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
  const [formData, setFormData] = useState<Partial<User>>({ name: '', email: '', role: 'Developer', avatar: '' });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000); // 30s Real-time Sync
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await api.users.list();
      if (res.status === 'success') {
        const mapped = res.data.map((u: any) => ({
          ...u,
          id: u.id.toString(),
          joinDate: u.joinDate.split(' ')[0]
        }));
        setUsers(mapped);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Failed to reach identity provider.");
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
    const formattedName = (name || 'User').split(' ').join('+');
    return `https://ui-avatars.com/api/?name=${formattedName}&background=6366f1&color=fff&bold=true`;
  };

  const handleApprove = async (id: string) => {
    try {
      await api.users.update({ id, status: 'active' });
      fetchUsers();
    } catch (err) {
      console.error("Approval error:", err);
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
      console.error("Decommission error:", err);
    } finally {
      setIsRemoving(false);
    }
  };

  const openModal = (mode: 'add' | 'edit', user?: User) => {
    setModalMode(mode);
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
    setAvatarPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate Type
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        alert("Invalid file type. Please upload a JPG or PNG image.");
        return;
      }
      // Validate Size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert("File size limit exceeded. Maximum allowed size is 2MB.");
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

  const clearAvatar = () => {
    setAvatarPreview(null);
    setFormData(prev => ({ ...prev, avatar: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    try {
      if (modalMode === 'add') {
        alert("User creation via dashboard is restricted. Use the registration portal for new identities.");
      } else if (modalMode === 'edit' && formData.id) {
        await api.users.update(formData);
        fetchUsers();
      }
      closeModal();
    } catch (err) {
      console.error("Submit error:", err);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center animate-pulse">
          <i className="fas fa-id-card text-3xl text-indigo-400"></i>
        </div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Synching User Directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">User Management</h1>
          <p className="text-slate-400 mt-1">Control platform access, manage identities, and define RBAC levels.</p>
        </div>
        <button
          onClick={() => openModal('add')}
          className="px-7 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center gap-3 group"
        >
          <i className="fas fa-plus group-hover:scale-125 transition-transform"></i> Provision User
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs flex items-center gap-3">
          <i className="fas fa-shield-exclamation text-base"></i>
          {error}
        </div>
      )}

      <div className="flex items-center border-b border-slate-800/60">
        <button
          onClick={() => setActiveView('all')}
          className={`px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all border-b-2 ${activeView === 'all' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Active Personnel
        </button>
        <button
          onClick={() => setActiveView('pending')}
          className={`px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all border-b-2 flex items-center gap-3 ${activeView === 'pending' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
        >
          Verification Queue
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded-lg shadow-lg shadow-rose-600/30">{pendingCount}</span>
          )}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/40 text-slate-600 text-[10px] uppercase tracking-[0.2em] font-black">
                <th className="px-8 py-5">System Identity</th>
                <th className="px-8 py-5">Role Assignment</th>
                <th className="px-8 py-5">Auth Date</th>
                <th className="px-8 py-5">State</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/20 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <img
                          src={user.avatar || getPlaceholder(user.name)}
                          className="w-11 h-11 rounded-2xl border border-slate-800 shadow-md object-cover bg-slate-950"
                          alt={user.name}
                        />
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${user.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{user.name}</p>
                        <p className="text-[11px] text-slate-500 font-medium font-mono lowercase">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-8 py-5 text-xs text-slate-500 font-mono">
                    {user.joinDate}
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] border ${user.status === 'active'
                      ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/5 text-amber-400 border-amber-500/20'
                      }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      {user.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="w-9 h-9 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all border border-transparent hover:border-emerald-500/20"
                            title="Verify Account"
                          >
                            <i className="fas fa-check-double"></i>
                          </button>
                          <button
                            onClick={() => initiateRemove(user)}
                            className="w-9 h-9 flex items-center justify-center text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                            title="Deny Access"
                          >
                            <i className="fas fa-user-xmark"></i>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openModal('edit', user)}
                            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all border border-transparent hover:border-indigo-500/20"
                            title="Edit Permissions"
                          >
                            <i className="fas fa-user-gear"></i>
                          </button>
                          <button
                            onClick={() => initiateRemove(user)}
                            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                            title="Decommission Account"
                          >
                            <i className="fas fa-trash-can text-sm"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-3xl mb-4">
                        <i className="fas fa-user-slash text-slate-600"></i>
                      </div>
                      <p className="text-slate-500 font-black uppercase tracking-widest text-[11px]">No matching records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Decommission Confirmation Modal */}
      {userToRemove && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] sm:rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <div className="p-6 sm:p-10 text-center">
              <div className="w-24 h-24 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl shadow-inner relative group">
                <i className="fas fa-shield-slash animate-pulse"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-100 mb-3 tracking-tight">Security Interlock</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
                You are performing a destructive action on <span className="text-slate-100 font-bold">{userToRemove.name}</span>. This will permanently revoke all access tokens.
              </p>

              <div className="bg-slate-950/40 rounded-2xl p-4 border border-slate-800/60 mb-8 flex items-center gap-4 text-left">
                <img src={userToRemove.avatar || getPlaceholder(userToRemove.name)} className="w-10 h-10 rounded-xl border border-slate-800 shadow-lg" alt="" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-100 truncate">{userToRemove.name}</p>
                  <p className="text-[10px] text-slate-600 font-mono truncate">{userToRemove.email}</p>
                </div>
              </div>

              <div className="space-y-4 mb-10 text-left">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                  Type <span className="text-rose-400">"{userToRemove.name}"</span> to confirm termination
                </label>
                <input
                  type="text"
                  autoFocus
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Enter user name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4.5 text-sm text-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all placeholder:text-slate-800 font-mono"
                />
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={confirmRemove}
                  disabled={isRemoving || deleteConfirmation !== userToRemove.name}
                  className={`w-full py-4.5 rounded-2xl font-black text-[11px] shadow-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] ${isRemoving || deleteConfirmation !== userToRemove.name
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-800'
                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                    }`}
                >
                  {isRemoving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-power-off"></i>}
                  {isRemoving ? 'Processing Termination' : 'Authorize Decommission'}
                </button>
                <button
                  onClick={() => { setUserToRemove(null); setDeleteConfirmation(''); }}
                  disabled={isRemoving}
                  className="w-full py-4.5 bg-slate-950 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-2xl font-black text-[11px] transition-all uppercase tracking-[0.2em]"
                >
                  Dismiss Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Modification Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-[1.5rem] sm:rounded-[2.5rem] w-[95%] sm:w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <div className="p-5 sm:p-8 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <h3 className="text-xl font-black flex items-center gap-3 text-slate-100 tracking-tight uppercase">
                <i className={`fas ${modalMode === 'add' ? 'fa-user-plus' : 'fa-user-pen'} text-indigo-400`}></i>
                {modalMode === 'add' ? 'Register Identity' : 'Account Parameters'}
              </h3>
              <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors">
                <i className="fas fa-xmark text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
              <div className="flex flex-col items-center gap-5">
                <div className="relative group">
                  <div
                    className={`w-28 h-28 rounded-3xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition-all bg-slate-950 shadow-inner ${avatarPreview ? 'border-indigo-500/50' : 'border-slate-700 group-hover:border-indigo-500'
                      }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} className="w-full h-full object-cover" alt="Profile avatar" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-600 group-hover:text-indigo-400 transition-colors">
                        <i className="fas fa-image-portrait text-3xl mb-2"></i>
                        <div className="text-center px-4">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] block">Upload Photo</span>
                          <span className="text-[7px] text-slate-700 uppercase block mt-1">JPG/PNG • Max 2MB</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/png, image/jpeg"
                    onChange={handleFileChange}
                  />

                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearAvatar(); }}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-700 transition-all border-2 border-slate-900"
                      title="Remove Photo"
                    >
                      <i className="fas fa-times text-[10px]"></i>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Full Legal Name</label>
                  <input
                    autoFocus required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:border-indigo-500 ring-offset-0 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-white font-medium"
                    placeholder="Enter name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Email Network</label>
                  <input
                    required type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:border-indigo-500 ring-offset-0 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-white font-medium"
                    placeholder="mail@devinquire.com"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Assigned Privilege Role</label>
                <div className="grid grid-cols-1 gap-3">
                  {(['Admin', 'Developer', 'Viewer'] as UserRole[]).map((role) => {
                    const detail = ROLE_DETAILS[role];
                    const isSelected = formData.role === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData({ ...formData, role })}
                        className={`relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border transition-all text-left ${isSelected
                          ? 'bg-slate-950 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                          }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${detail.bg} ${detail.color}`}>
                          <i className={`fas ${detail.icon} text-base`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-black uppercase tracking-widest ${isSelected ? 'text-indigo-400' : 'text-slate-200'}`}>{role}</p>
                          <p className="text-[10px] text-slate-600 leading-tight font-medium mt-1">{detail.desc}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] shadow-lg shadow-indigo-600/30">
                            <i className="fas fa-check"></i>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-4 border border-slate-800 rounded-2xl text-[11px] font-black text-slate-500 hover:bg-slate-800 transition-all uppercase tracking-[0.2em]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-[11px] font-black shadow-xl shadow-indigo-600/30 transition-all text-white uppercase tracking-[0.2em]"
                >
                  {modalMode === 'add' ? 'Commit User' : 'Update Vault'}
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
