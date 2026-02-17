
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './pages/DashboardHome';
import AIInquiry from './pages/AIInquiry';
import Analytics from './pages/Analytics';
import TaskManagement from './pages/TaskManagement';
import BlogManagement from './pages/BlogManagement';
import UserManagement from './pages/UserManagement';
import Team from './pages/Team';
import ProjectDetail from './pages/ProjectDetail';
import ContactSubmissions from './pages/ContactSubmissions';
import Login from './pages/Login';
import { DashboardTab, UserRole, ROLE_PERMISSIONS, User } from './types';

// Protected Route Component
interface ProtectedRouteProps {
  role: UserRole;
  allowedTabs: DashboardTab[];
  tab: DashboardTab;
  children?: React.ReactNode;
}

const ProtectedRoute = ({
  role,
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Simulated "Current User" with Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Auto-login logic
  useEffect(() => {
    const savedUser = localStorage.getItem('devinquire_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('devinquire_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('devinquire_user');
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

  const handleUpdateOtherUserRole = (email: string, role: UserRole) => {
    // This would typically call an API. For now, just a toast.
    console.log(`AI AGENT: Updated ${email} to ${role}`);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const allowedTabs = ROLE_PERMISSIONS[currentUser.role];

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden text-slate-100">
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
          onLogout={handleLogout}
          onUpdateUser={handleUpdateUser}
        />

        <div className={`flex-1 flex flex-col ${activeTab === DashboardTab.INQUIRE ? 'overflow-hidden h-full p-0 md:p-4' : 'overflow-y-auto p-4 md:p-8 space-y-6'}`}>
          <Routes>
            <Route path="/" element={<DashboardHome currentUser={currentUser} />} />
            <Route path="/project/:projectId" element={<ProjectDetail />} />

            <Route path="/inquire" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.INQUIRE}>
                <AIInquiry />
              </ProtectedRoute>
            } />

            <Route path="/analytics" element={<Analytics />} />

            <Route path="/tasks" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.TASKS}>
                <TaskManagement />
              </ProtectedRoute>
            } />

            <Route path="/blogs" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.BLOGS}>
                <BlogManagement />
              </ProtectedRoute>
            } />

            <Route path="/users" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.USERS}>
                <UserManagement />
              </ProtectedRoute>
            } />

            <Route path="/contacts" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.CONTACTS}>
                <ContactSubmissions />
              </ProtectedRoute>
            } />

            <Route path="/team" element={
              <ProtectedRoute role={currentUser.role} allowedTabs={allowedTabs} tab={DashboardTab.TEAM}>
                <Team />
              </ProtectedRoute>
            } />

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
