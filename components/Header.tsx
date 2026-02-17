
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardTab, UserRole, User, ROLE_PERMISSIONS, AppNotification } from '../types';
import { api } from '../services/api';

interface HeaderProps {
  activeTab: DashboardTab;
  toggleSidebar: () => void;
  currentUser: User;
  setCurrentUserRole: (role: UserRole) => void;
  onLogout: () => void;
  onUpdateUser: (data: Partial<User>) => void;
}

const ALL_NAV_ITEMS = [
  { id: DashboardTab.OVERVIEW, label: 'Dashboard Overview', icon: 'fa-chart-pie', path: '/', keywords: 'home, stats, summary, dashboard' },
  { id: DashboardTab.INQUIRE, label: 'DevInquire AI', icon: 'fa-robot', path: '/inquire', keywords: 'chat, gemini, assistant, help, code, ai' },
  { id: DashboardTab.ANALYTICS, label: 'System Analytics', icon: 'fa-microchip', path: '/analytics', keywords: 'charts, metrics, performance, data, analytics' },
  { id: DashboardTab.BLOGS, label: 'Blog Manager', icon: 'fa-pen-nib', path: '/blogs', keywords: 'posts, articles, content, writing, blogs' },
  { id: DashboardTab.USERS, label: 'User Management', icon: 'fa-user-shield', path: '/users', keywords: 'admin, roles, permissions, accounts, users' },
  { id: DashboardTab.TEAM, label: 'Team Velocity', icon: 'fa-users', path: '/team', keywords: 'sprints, members, agile, productivity, team' },
];

const Header: React.FC<HeaderProps> = ({
  activeTab,
  toggleSidebar,
  currentUser,
  setCurrentUserRole,
  onLogout,
  onUpdateUser
}) => {
  const navigate = useNavigate();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Account Menu State
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Filter items based on current user's role and keywords
  const allowedTabs = ROLE_PERMISSIONS[currentUser.role];
  const searchableItems = ALL_NAV_ITEMS.filter(item => allowedTabs.includes(item.id));

  const filteredResults = searchQuery.trim() === ''
    ? []
    : searchableItems.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keywords.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Keyboard Navigation for search results
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }

      if (!isSearchFocused) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredResults[selectedIndex]) {
        e.preventDefault();
        handleNavigate(filteredResults[selectedIndex].path);
      } else if (e.key === 'Escape') {
        setIsSearchFocused(false);
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused, filteredResults, selectedIndex]);

  // Reset index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Click Outside Detection for Account Menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountMenuOpen]);

  // Click Outside Detection for Notifications
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifOpen]);

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      const res = await api.notifications.list();
      if (res.status === 'success') {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error("Signal Sync Error:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s Sync
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("Mark Read Error:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Mark All Read Error:", err);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'task': return 'fa-list-check text-indigo-400';
      case 'contact': return 'fa-envelope text-rose-400';
      case 'success': return 'fa-check-circle text-emerald-400';
      case 'warning': return 'fa-triangle-exclamation text-amber-400';
      case 'error': return 'fa-circle-exclamation text-rose-500';
      default: return 'fa-bell text-slate-400';
    }
  };

  const getAvatarUrl = () => {
    if (currentUser.avatar) return currentUser.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=6366f1&color=fff&bold=true`;
  };

  const openProfileModal = () => {
    setFormData({ name: currentUser.name, email: currentUser.email, avatar: currentUser.avatar });
    setAvatarPreview(currentUser.avatar || null);
    setIsProfileModalOpen(true);
    setIsAccountMenuOpen(false); // Close menu when modal opens
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size exceeds 2MB limit.");
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

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser(formData);
    setIsProfileModalOpen(false);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setSearchQuery('');
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-slate-800 rounded-lg lg:hidden transition-colors">
          <i className="fas fa-bars text-slate-400"></i>
        </button>
        <h2 className="text-lg font-semibold text-slate-100 capitalize">{activeTab}</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Role Quick Switcher */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Level:</span>
          <select
            value={currentUser.role}
            onChange={(e) => setCurrentUserRole(e.target.value as UserRole)}
            className="bg-transparent text-xs font-bold text-indigo-400 outline-none border-none cursor-pointer hover:text-indigo-300 transition-colors"
          >
            <option value="Admin">Admin</option>
            <option value="Developer">Developer</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>

        {/* Global Search / Command Palette */}
        <div className="relative group hidden lg:block">
          <div className={`flex items-center bg-slate-900 rounded-full px-4 py-1.5 border transition-all duration-300 ${isSearchFocused ? 'border-indigo-500 ring-4 ring-indigo-500/10 w-80' : 'border-slate-800 w-56'}`}>
            <i className={`fas fa-search transition-colors ${isSearchFocused ? 'text-indigo-400' : 'text-slate-500'} mr-3 text-sm`}></i>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder="Search sections... (⌘K)"
              className="bg-transparent border-none outline-none text-sm w-full text-slate-200 placeholder:text-slate-600"
            />
          </div>

          {/* Results Dropdown */}
          {isSearchFocused && filteredResults.length > 0 && (
            <div className="absolute top-full left-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Navigation</span>
                <span className="text-[9px] text-slate-600 font-mono">Use ↑↓ or Enter</span>
              </div>
              <div className="p-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                {filteredResults.map((item, idx) => (
                  <button
                    key={item.id}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${idx === selectedIndex ? 'bg-indigo-600/10 ring-1 ring-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'hover:bg-slate-800/50'
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${idx === selectedIndex ? 'bg-indigo-600/20 text-indigo-400' : 'bg-slate-950 text-slate-500'
                      }`}>
                      <i className={`fas ${item.icon} text-sm`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${idx === selectedIndex ? 'text-indigo-300' : 'text-slate-200'}`}>{item.label}</p>
                      <p className="text-[9px] text-slate-500 font-medium truncate">Jump to {item.id}</p>
                    </div>
                    {idx === selectedIndex && (
                      <i className="fas fa-arrow-right-long text-[10px] text-indigo-500 mr-2 animate-pulse"></i>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty Search State */}
          {isSearchFocused && searchQuery && filteredResults.length === 0 && (
            <div className="absolute top-full left-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="w-12 h-12 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-700">
                <i className="fas fa-search-minus text-xl"></i>
              </div>
              <p className="text-xs text-slate-400">No results found for <span className="text-slate-200 font-bold">"{searchQuery}"</span></p>
              <p className="text-[10px] text-slate-600 mt-2 font-medium">Try "AI", "Team" or "Analytics"</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative p-2 transition-all group ${isNotifOpen ? 'text-indigo-400 bg-indigo-500/10 rounded-full' : 'text-slate-400 hover:text-slate-100'}`}
            >
              <i className={`${isNotifOpen ? 'fas' : 'far'} fa-bell text-xl`}></i>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-[9px] font-black text-white rounded-full flex items-center justify-center border-2 border-slate-950 shadow-[0_0_12px_rgba(244,63,94,0.6)] group-hover:scale-110 transition-transform">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Portal */}
            <div className={`absolute top-full right-0 mt-4 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl transition-all transform origin-top-right overflow-hidden z-50 ${isNotifOpen
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
              }`}>
              <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
                <div>
                  <h4 className="text-[11px] font-black text-slate-100 uppercase tracking-widest">Signal Ledger</h4>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">{unreadCount} unread transmissions</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest px-3 py-1.5 bg-indigo-500/10 rounded-full transition-all"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-900/50">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleMarkRead(notif.id)}
                      className={`p-4 border-b border-slate-800/50 flex gap-4 cursor-pointer transition-all hover:bg-slate-800/30 relative group ${!notif.isRead ? 'bg-indigo-500/[0.03]' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-800 transition-colors ${!notif.isRead ? 'bg-slate-950' : 'bg-slate-900 opacity-60'}`}>
                        <i className={`fas ${getNotifIcon(notif.type)} text-sm`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h5 className={`text-xs font-bold truncate ${!notif.isRead ? 'text-slate-100' : 'text-slate-500'}`}>{notif.title}</h5>
                          <span className="text-[9px] font-bold text-slate-600 shrink-0 uppercase">{getTimeAgo(notif.timestamp)}</span>
                        </div>
                        <p className={`text-[11px] leading-relaxed line-clamp-2 ${!notif.isRead ? 'text-slate-400' : 'text-slate-600'}`}>
                          {notif.message}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <div className="absolute right-2 top-11 w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-800 border-2 border-dashed border-slate-800">
                      <i className="fas fa-satellite-dish text-2xl"></i>
                    </div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Digital Silence</p>
                    <p className="text-[10px] text-slate-700 mt-1">Operational signal ledger is currently empty.</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center">
                <button
                  className="text-[9px] font-black text-slate-600 hover:text-slate-400 uppercase tracking-[0.2em] transition-colors"
                  onClick={() => setIsNotifOpen(false)}
                >
                  Close Terminal
                </button>
              </div>
            </div>
          </div>


          <div
            ref={accountMenuRef}
            className="flex items-center gap-3 pl-4 border-l border-slate-800 relative"
          >
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-100 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-tight">{currentUser.role}</p>
              </div>
              <img
                src={getAvatarUrl()}
                alt="Profile"
                className={`w-9 h-9 rounded-full border object-cover shadow-sm transition-all ${isAccountMenuOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 group-hover:border-slate-500'
                  }`}
              />
              <i className={`fas fa-chevron-down text-[10px] text-slate-500 transition-transform duration-200 ${isAccountMenuOpen ? 'rotate-180 text-indigo-400' : ''}`}></i>
            </div>

            {/* User Account Portal */}
            <div className={`absolute top-full right-0 mt-3 w-60 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl transition-all transform origin-top-right p-2 z-50 ${isAccountMenuOpen
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
              }`}>
              <div className="p-3 border-b border-slate-800/50 mb-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Identity Terminal</p>
                <p className="text-xs text-slate-300 truncate font-mono">{currentUser.email}</p>
              </div>

              <button
                onClick={openProfileModal}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-400 hover:bg-indigo-600/10 transition-all uppercase tracking-widest"
              >
                <i className="fas fa-id-badge"></i> Edit Profile
              </button>

              <div className="h-px bg-slate-800/50 my-1 mx-2"></div>

              <button
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all uppercase tracking-widest"
              >
                <i className="fas fa-power-off"></i> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Modification Portal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-100">
                <i className="fas fa-sliders-h text-indigo-400"></i> Account Settings
              </h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-2">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-8 space-y-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div
                    className="w-24 h-24 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer group-hover:border-indigo-500 transition-all bg-slate-950 shadow-inner shadow-black/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} className="w-full h-full object-cover" alt="Avatar preview" />
                    ) : (
                      <div className="flex flex-col items-center text-slate-600 group-hover:text-indigo-400 transition-colors">
                        <i className="fas fa-cloud-arrow-up text-2xl mb-1"></i>
                        <span className="text-[9px] font-bold uppercase tracking-widest">Update</span>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Profile Avatar</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Identity Tag</label>
                  <input
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:border-indigo-500 ring-offset-0 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-white font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Contact Email</label>
                  <input
                    required
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-sm focus:border-indigo-500 ring-offset-0 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-white font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 py-3.5 border border-slate-800 rounded-2xl text-[11px] font-bold text-slate-500 hover:bg-slate-800 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-[11px] font-bold shadow-xl shadow-indigo-600/30 transition-all text-white uppercase tracking-widest"
                >
                  Save Identity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
