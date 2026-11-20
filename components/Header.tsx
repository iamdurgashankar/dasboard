import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardTab, UserRole, User, ROLE_PERMISSIONS, AppNotification } from '../types';
import { api } from '../services/api';

interface HeaderProps {
  activeTab: DashboardTab;
  toggleSidebar: () => void;
  currentUser: User;
  setCurrentUserRole: (role: UserRole) => void;
  canSwitchRole?: boolean;
  onLogout: () => void;
  onUpdateUser: (data: Partial<User>) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ALL_NAV_ITEMS = [
  { id: DashboardTab.OVERVIEW, label: 'Overview', icon: 'fa-chart-pie', path: '/', keywords: 'home, stats, summary, dashboard' },
  { id: DashboardTab.PROJECTS, label: 'Client Projects', icon: 'fa-diagram-project', path: '/projects', keywords: 'projects, client, progress, milestones, updates, delivery' },
  { id: DashboardTab.INQUIRE, label: 'DI AI', icon: 'fa-wand-magic-sparkles', path: '/inquire', keywords: 'chat, gemini, assistant, help, code, ai, di ai' },
  { id: DashboardTab.CONTACTS, label: 'Client Inquiries', icon: 'fa-envelope-open-text', path: '/contacts', keywords: 'leads, contacts, clients, messages' },
  { id: DashboardTab.BLOGS, label: 'Editorial Studio', icon: 'fa-pen-nib', path: '/blogs', keywords: 'posts, articles, content, writing, blogs' },
  { id: DashboardTab.USERS, label: 'Access & Users', icon: 'fa-user-shield', path: '/users', keywords: 'admin, roles, permissions, accounts, users' },
  { id: DashboardTab.QUOTATIONS, label: 'Quotations', icon: 'fa-file-invoice-dollar', path: '/quotations', keywords: 'quotation, proposal, invoice, pricing, billing' },
];

const Header: React.FC<HeaderProps> = ({
  activeTab,
  toggleSidebar,
  currentUser,
  setCurrentUserRole,
  canSwitchRole,
  onLogout,
  onUpdateUser,
  theme,
  toggleTheme
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

  const allowedTabs = ROLE_PERMISSIONS[currentUser.role] || ROLE_PERMISSIONS.Admin;
  const searchableItems = ALL_NAV_ITEMS.filter(item => allowedTabs.includes(item.id));

  const filteredResults = searchQuery.trim() === ''
    ? []
    : searchableItems.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.keywords.toLowerCase().includes(searchQuery.toLowerCase())
    );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAccountMenuOpen]);

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
    const interval = setInterval(fetchNotifications, 6000);
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
      case 'task': return 'fa-list-check text-[#6B63F2]';
      case 'contact': return 'fa-envelope text-[#FF375F]';
      case 'success': return 'fa-check-circle text-[#30D158]';
      case 'warning': return 'fa-triangle-exclamation text-[#FF9F0A]';
      case 'error': return 'fa-circle-exclamation text-[#FF453A]';
      default: return 'fa-bell text-[var(--apple-text-secondary)]';
    }
  };

  const getAvatarUrl = () => {
    if (currentUser.avatar) return currentUser.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=4e45e1&color=fff&bold=true`;
  };

  const openProfileModal = () => {
    setFormData({ name: currentUser.name, email: currentUser.email, avatar: currentUser.avatar });
    setAvatarPreview(currentUser.avatar || null);
    setIsProfileModalOpen(true);
    setIsAccountMenuOpen(false);
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
    <header className="h-[60px] apple-glass-header px-6 flex items-center justify-between sticky top-0 z-40 select-none">
      <div className="flex items-center gap-3.5">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 hover:bg-[var(--apple-surface-subcard-hover)] rounded-lg lg:hidden flex items-center justify-center transition-colors text-[var(--apple-text-secondary)]"
        >
          <i className="fas fa-bars text-sm"></i>
        </button>
        <div className="flex items-center gap-2.5">
          <h2 className="text-[16px] font-semibold text-[var(--apple-text-primary)] tracking-tight capitalize">{activeTab}</h2>
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--apple-text-secondary)] px-2.5 py-0.5 rounded-full apple-subcard">
            <span className="w-1.5 h-1.5 rounded-full bg-[#28CD41]"></span>
            Live Sync
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Spotlight Search Bar */}
        <div className="relative hidden lg:block">
          <div
            className={`flex items-center rounded-[11px] px-3.5 py-1.5 border transition-all duration-200 ${
              isSearchFocused
                ? 'bg-[var(--apple-input-bg)] border-[var(--apple-blue)] ring-4 ring-[#4e45e1]/15 w-72'
                : 'apple-subcard w-56'
            }`}
          >
            <i
              className={`fas fa-magnifying-glass transition-colors ${
                isSearchFocused ? 'text-[var(--apple-blue)]' : 'text-[var(--apple-text-tertiary)]'
              } mr-2.5 text-xs`}
            ></i>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              placeholder="Spotlight Search"
              className="bg-transparent border-none outline-none text-[13px] w-full text-[var(--apple-text-primary)] placeholder:text-[var(--apple-text-tertiary)]"
            />
            <kbd className="text-[10px] font-medium text-[var(--apple-text-tertiary)] bg-[var(--apple-surface-subcard)] px-1.5 py-0.5 rounded border border-[var(--apple-border)]">
              ⌘K
            </kbd>
          </div>

          {/* Spotlight Results Dropdown */}
          {isSearchFocused && filteredResults.length > 0 && (
            <div className="absolute top-full right-0 mt-2.5 w-80 apple-glass rounded-[18px] overflow-hidden z-50">
              <div className="px-3.5 py-2 border-b border-[var(--apple-border)] flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--apple-text-tertiary)]">Spotlight Suggestions</span>
                <span className="text-[10px] text-[var(--apple-text-tertiary)]">↩ to open</span>
              </div>
              <div className="p-1.5 max-h-[360px] overflow-y-auto custom-scrollbar">
                {filteredResults.map((item, idx) => (
                  <button
                    key={item.id}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition-all text-left ${
                      idx === selectedIndex
                        ? 'bg-[#4e45e1] text-white shadow-sm'
                        : 'text-[var(--apple-text-primary)] hover:bg-[var(--apple-surface-subcard-hover)]'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-[8px] flex items-center justify-center ${
                        idx === selectedIndex ? 'bg-white/20 text-white' : 'apple-subcard text-[var(--apple-text-secondary)]'
                      }`}
                    >
                      <i className={`fas ${item.icon} text-xs ${idx === selectedIndex ? 'badge-white' : ''}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${idx === selectedIndex ? 'text-white badge-white' : ''}`}>
                        {item.label}
                      </p>
                      <p
                        className={`text-[11px] truncate ${
                          idx === selectedIndex ? 'text-white/80 badge-white' : 'text-[var(--apple-text-tertiary)]'
                        }`}
                      >
                        Go to {item.label}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSearchFocused && searchQuery && filteredResults.length === 0 && (
            <div className="absolute top-full right-0 mt-2.5 w-80 apple-glass rounded-[18px] p-6 text-center z-50">
              <i className="fas fa-magnifying-glass text-[var(--apple-text-tertiary)] text-xl mb-2"></i>
              <p className="text-[13px] text-[var(--apple-text-secondary)]">
                No matches for <span className="text-[var(--apple-text-primary)] font-semibold">“{searchQuery}”</span>
              </p>
            </div>
          )}
        </div>

        {/* Role Segmented Switcher (Admin Only) */}
        {(canSwitchRole ?? currentUser.role === 'Admin') && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 apple-subcard rounded-[10px]">
            <span className="text-[11px] font-medium text-[var(--apple-text-tertiary)]">Access:</span>
            <select
              value={currentUser.role}
              onChange={(e) => setCurrentUserRole(e.target.value as UserRole)}
              className="bg-transparent text-[12px] font-semibold text-[var(--apple-blue)] outline-none border-none cursor-pointer"
            >
              <option value="Admin">Admin</option>
              <option value="Developer">Developer</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
        )}

        {/* Apple Appearance (Light / Dark Mode) Toggle Pill */}
        <button
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label="Toggle appearance mode"
          className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] apple-subcard text-[12px] font-medium text-[var(--apple-text-primary)] active:scale-95 transition-all"
        >
          {theme === 'light' ? (
            <>
              <i className="fas fa-moon text-[#5856D6] text-xs"></i>
              <span className="hidden md:inline">Dark Mode</span>
            </>
          ) : (
            <>
              <i className="fas fa-sun text-[#FF9F0A] text-xs"></i>
              <span className="hidden md:inline">Light Mode</span>
            </>
          )}
        </button>

        {/* Notification Center Button */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`relative w-9 h-9 rounded-[11px] flex items-center justify-center transition-all ${
              isNotifOpen
                ? 'bg-[#4e45e1]/15 text-[var(--apple-blue)]'
                : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] hover:bg-[var(--apple-surface-subcard-hover)]'
            }`}
          >
            <i className="fas fa-bell text-[15px]"></i>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#FF3B30] rounded-full ring-2 ring-[var(--apple-bg)]"></span>
            )}
          </button>

          {/* macOS Notification Center Popover */}
          <div
            className={`absolute top-full right-0 mt-2.5 w-80 sm:w-96 apple-glass rounded-[22px] transition-all duration-200 origin-top-right overflow-hidden z-50 ${
              isNotifOpen
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
            }`}
          >
            <div className="px-4 py-3.5 border-b border-[var(--apple-border)] flex items-center justify-between">
              <div>
                <h4 className="text-[14px] font-semibold text-[var(--apple-text-primary)]">Notifications</h4>
                <p className="text-[11px] text-[var(--apple-text-tertiary)]">{unreadCount} unread updates</p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[12px] font-medium text-[var(--apple-blue)] hover:opacity-80 px-2.5 py-1 rounded-full bg-[#4e45e1]/10 transition-opacity"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="max-h-[380px] overflow-y-auto custom-scrollbar divide-y divide-[var(--apple-border)]">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkRead(notif.id)}
                    className={`p-3.5 flex gap-3.5 cursor-pointer transition-colors hover:bg-[var(--apple-surface-subcard-hover)] relative ${
                      !notif.isRead ? 'bg-[#4e45e1]/[0.04]' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-[11px] apple-subcard flex items-center justify-center shrink-0">
                      <i className={`fas ${getNotifIcon(notif.type)} text-xs`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h5 className={`text-[13px] font-medium truncate ${!notif.isRead ? 'text-[var(--apple-text-primary)]' : 'text-[var(--apple-text-secondary)]'}`}>
                          {notif.title}
                        </h5>
                        <span className="text-[11px] text-[var(--apple-text-tertiary)] shrink-0">{getTimeAgo(notif.timestamp)}</span>
                      </div>
                      <p className="text-[12px] text-[var(--apple-text-secondary)] leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[var(--apple-blue)] self-center shrink-0"></span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-10 text-center">
                  <i className="fas fa-bell-slash text-[var(--apple-text-tertiary)] text-2xl mb-2"></i>
                  <p className="text-[13px] font-medium text-[var(--apple-text-secondary)]">No New Notifications</p>
                  <p className="text-[11px] text-[var(--apple-text-tertiary)] mt-0.5">You’re all caught up.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Apple Account Pill */}
        <div
          ref={accountMenuRef}
          className="flex items-center pl-2 border-l border-[var(--apple-border)] relative"
        >
          <button
            onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
            className="flex items-center gap-2.5 py-1 px-2 rounded-full hover:bg-[var(--apple-surface-subcard-hover)] transition-colors"
          >
            <img
              src={getAvatarUrl()}
              alt="Profile"
              className="w-7 h-7 rounded-full object-cover ring-1 ring-[var(--apple-border)]"
            />
            <span className="text-[13px] font-medium text-[var(--apple-text-primary)] hidden sm:inline">{currentUser.name}</span>
            <i
              className={`fas fa-chevron-down text-[10px] text-[var(--apple-text-tertiary)] transition-transform duration-200 ${
                isAccountMenuOpen ? 'rotate-180 text-[var(--apple-text-primary)]' : ''
              }`}
            ></i>
          </button>

          {/* Apple Account Menu */}
          <div
            className={`absolute top-full right-0 mt-2.5 w-60 apple-glass rounded-[18px] p-1.5 transition-all duration-200 origin-top-right z-50 ${
              isAccountMenuOpen
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
            }`}
          >
            <div className="px-3 py-2.5 border-b border-[var(--apple-border)] mb-1">
              <p className="text-[13px] font-semibold text-[var(--apple-text-primary)] truncate">{currentUser.name}</p>
              <p className="text-[11px] text-[var(--apple-text-tertiary)] truncate">{currentUser.email}</p>
            </div>

            <button
              onClick={openProfileModal}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[11px] text-[13px] text-[var(--apple-text-primary)] hover:bg-[#4e45e1] hover:text-white transition-colors"
            >
              <i className="fas fa-circle-user text-xs w-4"></i>
              Account Settings…
            </button>

            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3 py-2 rounded-[11px] text-[13px] text-[var(--apple-text-primary)] hover:bg-[var(--apple-surface-subcard-hover)] transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <i className={`fas ${theme === 'light' ? 'fa-moon text-[#5856D6]' : 'fa-sun text-[#FF9F0A]'} text-xs w-4`}></i>
                Appearance
              </span>
              <span className="text-[11px] font-medium text-[var(--apple-text-tertiary)] capitalize">{theme}</span>
            </button>

            <div className="h-px bg-[var(--apple-border)] my-1 mx-2"></div>

            <button
              onClick={() => {
                setIsAccountMenuOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[11px] text-[13px] text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white transition-colors"
            >
              <i className="fas fa-arrow-right-from-bracket text-xs w-4"></i>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Apple System Settings Profile Sheet */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="apple-glass rounded-[24px] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--apple-border)] flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)]">DevInquire Account Profile</h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="w-7 h-7 rounded-full apple-subcard text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] flex items-center justify-center transition-colors"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-6">
              <div className="flex flex-col items-center gap-2.5">
                <div
                  className="w-20 h-20 rounded-full border border-[var(--apple-border-strong)] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[var(--apple-blue)] transition-all apple-subcard"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} className="w-full h-full object-cover" alt="Avatar preview" />
                  ) : (
                    <div className="flex flex-col items-center text-[var(--apple-text-tertiary)] hover:text-[var(--apple-blue)] transition-colors">
                      <i className="fas fa-camera text-lg mb-1"></i>
                      <span className="text-[10px] font-medium">Edit</span>
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                <p className="text-[12px] text-[var(--apple-text-tertiary)]">Click photo to change avatar</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)] ml-1">Full Name</label>
                  <input
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full apple-input px-4 py-2.5 text-[14px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)] ml-1">Email Address</label>
                  <input
                    required
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full apple-input px-4 py-2.5 text-[14px]"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 py-2.5 apple-secondary-btn rounded-[12px] text-[13px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 apple-pill-btn rounded-[12px] text-[13px] font-medium"
                >
                  Save Changes
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
