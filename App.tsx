import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './pages/DashboardHome';
import ClientProjects from './pages/ClientProjects';
import AIInquiry from './pages/AIInquiry';
import BlogManagement from './pages/BlogManagement';
import UserManagement from './pages/UserManagement';
import Quotations from './pages/Quotations';
import ProjectDetail from './pages/ProjectDetail';
import ContactSubmissions from './pages/ContactSubmissions';
import Login from './pages/Login';
import { api } from './services/api';
import { DashboardTab, UserRole, ROLE_PERMISSIONS, User } from './types';

function normalizeUserRole(role?: string): UserRole {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'developer') return 'Developer';
  if (r === 'editor') return 'Editor';
  if (r === 'viewer' || r === 'user') return 'Viewer';
  return 'Admin';
}

interface ProtectedRouteProps {
  role: UserRole;
  allowedTabs: DashboardTab[];
  tab: DashboardTab;
  children?: React.ReactNode;
}

const ProtectedRoute = ({
  allowedTabs,
  tab,
  children
}: ProtectedRouteProps) => {
  if (!allowedTabs.includes(tab)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AppContent = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.OVERVIEW);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [baseRole, setBaseRole] = useState<UserRole | null>(() => {
    try {
      const saved = localStorage.getItem('devinquire_base_role');
      return saved ? normalizeUserRole(saved) : null;
    } catch {
      return null;
    }
  });

  // Default to Apple Light Mode ('light') unless user explicitly toggled to 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('devinquire_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('devinquire_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('devinquire_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.email) {
          const normalized = normalizeUserRole(parsed.role);
          setCurrentUser({ ...parsed, role: normalized });
          if (!localStorage.getItem('devinquire_base_role')) {
            setBaseRole(normalized);
            localStorage.setItem('devinquire_base_role', normalized);
          }
          api.auth.me().then((meRes: any) => {
            if (meRes?.status === 'success' && meRes.data?.email) {
              const serverRole = normalizeUserRole(meRes.data.role);
              const syncedUser: User = { ...meRes.data, role: serverRole };
              setCurrentUser(syncedUser);
              setBaseRole(serverRole);
              localStorage.setItem('devinquire_user', JSON.stringify(syncedUser));
              localStorage.setItem('devinquire_base_role', serverRole);
            }
          }).catch(() => {});
        }
      } catch {
        localStorage.removeItem('devinquire_user');
      }
    }
  }, []);

  const handleLogin = (user: User) => {
    const normalizedUser: User = { ...user, role: normalizeUserRole(user.role) };
    setCurrentUser(normalizedUser);
    setBaseRole(normalizedUser.role);
    localStorage.setItem('devinquire_user', JSON.stringify(normalizedUser));
    localStorage.setItem('devinquire_base_role', normalizedUser.role);
  };

  const handleLogout = () => {
    api.auth.logout().catch(() => {});
    setCurrentUser(null);
    setBaseRole(null);
    localStorage.removeItem('devinquire_user');
    localStorage.removeItem('devinquire_base_role');
    localStorage.removeItem('di_csrf_token');
  };

  const handleRoleChange = (role: UserRole) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, role };
      setCurrentUser(updatedUser);
      localStorage.setItem('devinquire_user', JSON.stringify(updatedUser));
    }
  };

  const handleUpdateUser = (updatedData: Partial<User>) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updatedData };
      setCurrentUser(updatedUser);
      localStorage.setItem('devinquire_user', JSON.stringify(updatedUser));
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />;
  }

  const allowedTabs = ROLE_PERMISSIONS[currentUser.role] || ROLE_PERMISSIONS.Admin;

  return (
    <div className="flex h-screen w-full bg-transparent overflow-hidden text-[var(--apple-text-primary)]">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        userRole={currentUser.role}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Header
          activeTab={activeTab}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          currentUser={currentUser}
          setCurrentUserRole={handleRoleChange}
          canSwitchRole={baseRole === 'Admin' || currentUser.role === 'Admin'}
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <div className={`flex-1 flex flex-col custom-scrollbar ${activeTab === DashboardTab.INQUIRE ? 'overflow-hidden h-full p-0 md:p-5' : 'overflow-y-auto p-5 md:p-8 space-y-6'}`}>
          <Routes>
            <Route path="/" element={<DashboardHome currentUser={currentUser} />} />
            <Route path="/projects" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.PROJECTS}>
                <ClientProjects currentUser={currentUser} />
              </ProtectedRoute>
            } />
            <Route path="/project/:projectId" element={<ProjectDetail currentUser={currentUser} />} />

            <Route path="/inquire" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.INQUIRE}>
                <AIInquiry />
              </ProtectedRoute>
            } />

            <Route path="/blogs" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.BLOGS}>
                <BlogManagement currentUser={currentUser} />
              </ProtectedRoute>
            } />
            <Route path="/blog" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.BLOGS}>
                <BlogManagement currentUser={currentUser} />
              </ProtectedRoute>
            } />

            <Route path="/users" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.USERS}>
                <UserManagement currentUser={currentUser} />
              </ProtectedRoute>
            } />

            <Route path="/contacts" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.CONTACTS}>
                <ContactSubmissions currentUser={currentUser} />
              </ProtectedRoute>
            } />

            <Route path="/quotations" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.QUOTATIONS}>
                <Quotations />
              </ProtectedRoute>
            } />

            <Route path="/team" element={<Navigate to="/quotations" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
