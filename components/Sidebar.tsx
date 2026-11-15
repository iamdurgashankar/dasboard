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

const Sidebar: React.FC<SidebarProps> = ({ setActiveTab, isOpen, setIsOpen, userRole }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const allowedTabs = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.Admin;

  const allNavItems = [
    {
      id: DashboardTab.OVERVIEW,
      label: 'Overview',
      icon: 'fa-chart-pie',
      path: '/',
      tint: 'from-[#6B63F2] to-[#4e45e1]',
      group: 'Workspace'
    },
    {
      id: DashboardTab.PROJECTS,
      label: 'Client Projects',
      icon: 'fa-diagram-project',
      path: '/projects',
      tint: 'from-[#6B63F2] to-[#4139BF]',
      group: 'Workspace'
    },
    {
      id: DashboardTab.INQUIRE,
      label: 'DI AI',
      icon: 'fa-wand-magic-sparkles',
      path: '/inquire',
      tint: 'from-[#BF5AF2] via-[#5E5CE6] to-[#6B63F2]',
      group: 'Workspace'
    },
    {
      id: DashboardTab.CONTACTS,
      label: 'Client Inquiries',
      icon: 'fa-envelope-open-text',
      path: '/contacts',
      tint: 'from-[#30D158] to-[#248A3D]',
      group: 'Management'
    },
    {
      id: DashboardTab.BLOGS,
      label: 'Editorial Studio',
      icon: 'fa-pen-nib',
      path: '/blogs',
      tint: 'from-[#FF375F] to-[#D70015]',
      group: 'Management'
    },
    {
      id: DashboardTab.USERS,
      label: 'Access & Users',
      icon: 'fa-user-shield',
      path: '/users',
      tint: 'from-[#5E5CE6] to-[#3634A3]',
      group: 'Management'
    },
    {
      id: DashboardTab.TEAM,
      label: 'Team Velocity',
      icon: 'fa-users',
      path: '/team',
      tint: 'from-[#BF5AF2] to-[#8944AB]',
      group: 'Management'
    },
  ];

  const navItems = allNavItems.filter(item => allowedTabs.includes(item.id));
  const workspaceItems = navItems.filter(item => item.group === 'Workspace');
  const operationsItems = navItems.filter(item => item.group === 'Management');

  const handleNav = (id: DashboardTab, path: string) => {
    setActiveTab(id);
    navigate(path);
  };

  const isRouteActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/projects') return location.pathname.startsWith('/projects') || location.pathname.startsWith('/project/');
    if (path === '/blogs') return location.pathname === '/blogs' || location.pathname === '/blog';
    return location.pathname.startsWith(path);
  };

  const renderTooltip = (label: string, section?: string) => {
    if (isOpen) return null;
    return (
      <div className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[100] whitespace-nowrap">
        <div className="relative px-3 py-1.5 rounded-[10px] bg-[#1C1C1E] dark:bg-[#2C2C2E] text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] border border-white/10 flex flex-col items-start">
          {/* Tooltip Left Arrow */}
          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#1C1C1E] dark:bg-[#2C2C2E] border-l border-b border-white/10"></span>
          {section && (
            <span className="text-[9px] uppercase tracking-wider font-semibold text-white/55 leading-none mb-0.5 badge-white">
              {section}
            </span>
          )}
          <span className="text-[12px] font-semibold text-white leading-tight badge-white">
            {label}
          </span>
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`${
        isOpen ? 'w-[264px]' : 'w-[78px]'
      } h-full apple-glass-sidebar transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col z-50 overflow-visible select-none shrink-0 relative`}
    >
      {/* DevInquire Identity Header + Sidebar Collapse Toggle */}
      <div className={`h-[60px] ${isOpen ? 'px-4 justify-between' : 'px-0 justify-center'} flex items-center border-b border-[var(--apple-border)] shrink-0 relative`}>
        <div
          onClick={() => handleNav(DashboardTab.OVERVIEW, '/')}
          className="flex items-center gap-3 min-w-0 cursor-pointer group relative"
        >
          <div className="w-9 h-9 rounded-xl bg-[#4e45e1] flex items-center justify-center shrink-0 shadow-[0_6px_16px_rgba(78,69,225,0.35)] relative overflow-hidden transition-transform duration-200 group-hover:scale-105">
            <div className="absolute inset-0 bg-white/20 opacity-50"></div>
            <div className="relative z-10 flex items-center justify-center text-white font-bold text-[12px] tracking-tight badge-white">
              <span className="text-white/80 mr-0.5 text-[11px] badge-white">&#123;</span>
              <span className="text-white font-bold badge-white">DI</span>
              <span className="text-white/80 ml-0.5 text-[11px] badge-white">&#125;</span>
            </div>
          </div>
          {isOpen && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[16px] tracking-tight text-[#4e45e1] dark:text-[#8179FF] truncate">
                  DevInquire
                </span>
              </div>
              <span className="text-[11px] text-[var(--apple-text-tertiary)] truncate">
                Enterprise Command Hub
              </span>
            </div>
          )}
          {renderTooltip('DevInquire Studio', 'Home')}
        </div>

        {isOpen && (
          <button
            onClick={() => setIsOpen(false)}
            title="Collapse Sidebar"
            className="w-7 h-7 rounded-lg text-[var(--apple-text-tertiary)] hover:text-[var(--apple-text-primary)] hover:bg-[var(--apple-surface-subcard-hover)] flex items-center justify-center transition-colors shrink-0"
          >
            <i className="fas fa-table-columns text-xs"></i>
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-3 space-y-5 overflow-visible">
        {workspaceItems.length > 0 && (
          <div className="space-y-1.5">
            {isOpen && (
              <p className="text-[11px] font-semibold text-[var(--apple-text-tertiary)] px-3 mb-1.5 tracking-tight">
                Workspace
              </p>
            )}
            {workspaceItems.map((item) => {
              const active = isRouteActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id, item.path)}
                  className={`group relative w-full flex items-center ${
                    isOpen ? 'gap-3 px-2.5 justify-start' : 'justify-center px-0'
                  } py-2 rounded-[11px] text-[13px] transition-all duration-150 active:scale-[0.985] ${
                    active
                      ? 'bg-[#4e45e1]/12 dark:bg-white/[0.13] text-[var(--apple-blue)] dark:text-white font-semibold shadow-sm border border-[#4e45e1]/20 dark:border-white/[0.12]'
                      : 'text-[var(--apple-text-secondary)] hover:bg-[var(--apple-surface-subcard-hover)] hover:text-[var(--apple-text-primary)] font-medium border border-transparent'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-[9px] bg-gradient-to-b ${item.tint} flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_5px_rgba(0,0,0,0.2)] transition-transform duration-150 group-hover:scale-105`}
                  >
                    <i className={`fas ${item.icon} text-[12px] text-white badge-white`}></i>
                  </div>
                  {isOpen && (
                    <span className="truncate whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                  {renderTooltip(item.label, item.group)}
                </button>
              );
            })}
          </div>
        )}

        {operationsItems.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[var(--apple-border)]">
            {isOpen && (
              <p className="text-[11px] font-semibold text-[var(--apple-text-tertiary)] px-3 mb-1.5 tracking-tight">
                Management
              </p>
            )}
            {operationsItems.map((item) => {
              const active = isRouteActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id, item.path)}
                  className={`group relative w-full flex items-center ${
                    isOpen ? 'gap-3 px-2.5 justify-start' : 'justify-center px-0'
                  } py-2 rounded-[11px] text-[13px] transition-all duration-150 active:scale-[0.985] ${
                    active
                      ? 'bg-[#4e45e1]/12 dark:bg-white/[0.13] text-[var(--apple-blue)] dark:text-white font-semibold shadow-sm border border-[#4e45e1]/20 dark:border-white/[0.12]'
                      : 'text-[var(--apple-text-secondary)] hover:bg-[var(--apple-surface-subcard-hover)] hover:text-[var(--apple-text-primary)] font-medium border border-transparent'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-[9px] bg-gradient-to-b ${item.tint} flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_5px_rgba(0,0,0,0.2)] transition-transform duration-150 group-hover:scale-105`}
                  >
                    <i className={`fas ${item.icon} text-[12px] text-white badge-white`}></i>
                  </div>
                  {isOpen && (
                    <span className="truncate whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                  {renderTooltip(item.label, item.group)}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom Status / Expand Card */}
      <div className="p-3 mt-auto border-t border-[var(--apple-border)]">
        {isOpen ? (
          <div className="p-3 rounded-[14px] apple-subcard flex items-center justify-between whitespace-nowrap overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#28CD41] shadow-[0_0_8px_#28CD41] shrink-0"></span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[var(--apple-text-tertiary)] leading-none">Role Privilege</p>
                <p className="text-[13px] font-semibold text-[var(--apple-text-primary)] truncate mt-1">{userRole}</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#4e45e1]/12 text-[var(--apple-blue)] border border-[#4e45e1]/20 shrink-0">
              Verified
            </span>
          </div>
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative w-full py-2.5 rounded-[11px] text-[var(--apple-text-tertiary)] hover:text-[var(--apple-text-primary)] hover:bg-[var(--apple-surface-subcard-hover)] flex items-center justify-center transition-colors"
          >
            <i className="fas fa-chevron-right text-xs"></i>
            {renderTooltip('Expand Sidebar', `${userRole} · Verified`)}
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
