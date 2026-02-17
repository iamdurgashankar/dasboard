
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardTab, UserRole, ROLE_PERMISSIONS } from '../types';

interface SidebarProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  userRole: UserRole;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, setIsOpen, userRole }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const allowedTabs = ROLE_PERMISSIONS[userRole];

  const allNavItems = [
    { id: DashboardTab.OVERVIEW, label: 'Dashboard', icon: 'fa-chart-pie', path: '/' },
    { id: DashboardTab.INQUIRE, label: 'DevInquire AI', icon: 'fa-robot', path: '/inquire' },
    { id: DashboardTab.TASKS, label: 'Task Management', icon: 'fa-list-check', path: '/tasks' },
    { id: DashboardTab.ANALYTICS, label: 'Analytics', icon: 'fa-microchip', path: '/analytics' },
    { id: DashboardTab.CONTACTS, label: 'Client Leads', icon: 'fa-address-book', path: '/contacts' },
    { id: DashboardTab.BLOGS, label: 'Blog Manager', icon: 'fa-pen-nib', path: '/blogs' },
    { id: DashboardTab.USERS, label: 'User Management', icon: 'fa-user-shield', path: '/users' },
    { id: DashboardTab.TEAM, label: 'Team Velocity', icon: 'fa-users', path: '/team' },
  ];

  // Filter items based on RBAC
  const navItems = allNavItems.filter(item => allowedTabs.includes(item.id));

  const handleNav = (id: DashboardTab, path: string) => {
    setActiveTab(id);
    navigate(path);
  };

  return (
    <aside className={`${isOpen ? 'w-64' : 'w-20'} h-full bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col z-50 overflow-hidden`}>
      <div className="p-6 flex items-center gap-3">
        <div className={`w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0`}>
          <i className="fas fa-terminal text-white"></i>
        </div>
        <span className={`font-bold text-xl tracking-tight text-white whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
          DevInquire
        </span>
      </div>

      <nav className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleNav(item.id, item.path)}
            className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 ease-in-out active:scale-[0.98] ${location.pathname === item.path
              ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-600/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
              }`}
          >
            <i className={`fas ${item.icon} text-lg w-6 shrink-0`}></i>
            <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <div className={`p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 transition-all duration-300 ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
          <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 whitespace-nowrap">Your Access</p>
          <p className="text-xs font-semibold text-indigo-400 whitespace-nowrap">{userRole}</p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-4 p-3 mt-2 rounded-xl text-slate-400 hover:bg-slate-800 transition-all"
        >
          <i className={`fas ${isOpen ? 'fa-angle-left' : 'fa-angle-right'} text-lg w-6 shrink-0`}></i>
          <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
            Collapse
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
