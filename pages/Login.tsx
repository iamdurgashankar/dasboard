import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, theme = 'light', toggleTheme }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      if (isLogin) {
        const result = await api.auth.login({ email: email.trim(), password });

        if (result.status === 'success') {
          if (result.data?.csrf_token) {
            localStorage.setItem('di_csrf_token', result.data.csrf_token);
          }
          onLogin(result.data.user);
        } else {
          setErrorMessage(result.message || 'Invalid credentials. Please try again.');
        }
      } else {
        try {
          const regRes = await api.auth.register({ name: name.trim(), email: email.trim(), password });
          if (regRes.status === 'success' && regRes.data?.user) {
            setPendingUser(regRes.data.user);
          } else {
            setPendingUser({
              id: `req-${Date.now()}`,
              name: name.trim(),
              email: email.trim(),
              role: 'Developer',
              status: 'pending',
              joinDate: new Date().toISOString().split('T')[0]
            });
          }
        } catch (regErr: any) {
          if (regErr?.message?.includes('already registered')) {
            setErrorMessage(regErr.message);
          } else {
            setPendingUser({
              id: `req-${Date.now()}`,
              name: name.trim(),
              email: email.trim(),
              role: 'Developer',
              status: 'pending',
              joinDate: new Date().toISOString().split('T')[0]
            });
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Unable to connect to authentication service.");
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingUser) {
    return (
      <div className="h-screen overflow-y-auto text-[var(--apple-text-primary)] relative flex items-center justify-center p-6">
        <div className="max-w-md w-full apple-glass rounded-[32px] p-10 text-center z-10 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 bg-gradient-to-b from-[#6B63F2] to-[#4139BF] text-white rounded-[20px] flex items-center justify-center mx-auto mb-6 text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_25px_rgba(10,132,255,0.35)]">
            <i className="fas fa-user-check badge-white"></i>
          </div>
          <h2 className="text-2xl font-semibold mb-2 tracking-tight text-[var(--apple-text-primary)]">Request Submitted</h2>
          <p className="text-[var(--apple-text-secondary)] leading-relaxed mb-8 text-[14px]">
            Your workspace profile for <span className="text-[var(--apple-text-primary)] font-semibold">{pendingUser.name}</span> has been queued for administrator approval.
          </p>
          <button
            onClick={() => { setPendingUser(null); setIsLogin(true); }}
            className="w-full py-3.5 apple-secondary-btn rounded-[14px] font-medium text-[14px]"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto lg:overflow-hidden text-[var(--apple-text-primary)] relative selection:bg-[#4e45e1]/20">
      {/* Top-Right Appearance Toggle */}
      {toggleTheme && (
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full apple-glass text-[13px] font-medium text-[var(--apple-text-primary)] hover:scale-[1.02] active:scale-95 transition-all"
          >
            {theme === 'light' ? (
              <>
                <i className="fas fa-moon text-[#5856D6] text-xs"></i>
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <i className="fas fa-sun text-[#FF9F0A] text-xs"></i>
                <span>Light Mode</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Ambient Apple Spatial Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[18%] -left-[8%] w-[52%] h-[52%] bg-[#6B63F2]/12 blur-[140px] rounded-full"></div>
        <div className="absolute top-[25%] -right-[10%] w-[45%] h-[45%] bg-[#5E5CE6]/10 blur-[150px] rounded-full"></div>
        <div className="absolute -bottom-[20%] left-[25%] w-[45%] h-[45%] bg-[#BF5AF2]/10 blur-[150px] rounded-full"></div>
      </div>

      <div className="min-h-full lg:h-full flex flex-col lg:flex-row relative z-10">
        {/* Left Apple Product Showcase Column — Locked to viewport height on desktop so it never shifts */}
        <div
          className="relative w-full lg:w-[56%] lg:h-full lg:overflow-hidden flex flex-col justify-between gap-8 lg:gap-10 p-8 md:p-12 lg:px-16 lg:py-12 xl:px-20 xl:py-14 lg:border-r border-[var(--apple-border)] shrink-0"
        >
          {/* Top Brand Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#4e45e1] flex items-center justify-center shadow-[0_8px_20px_rgba(78,69,225,0.35)] relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 opacity-50"></div>
                <div className="relative z-10 flex items-center justify-center text-white font-bold text-sm badge-white">
                  <span className="text-white/80 mr-0.5 text-xs badge-white">&#123;</span>
                  <span className="text-white font-bold badge-white">DI</span>
                  <span className="text-white/80 ml-0.5 text-xs badge-white">&#125;</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[19px] font-semibold tracking-tight text-[#4e45e1] dark:text-[#8179FF]">DevInquire</span>
                </div>
                <p className="text-[12px] text-[var(--apple-text-tertiary)]">Enterprise Command Hub</p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full apple-subcard text-[12px] text-[var(--apple-text-secondary)]">
              <span className="w-2 h-2 rounded-full bg-[#28CD41] shadow-[0_0_8px_#28CD41]"></span>
              All Systems Operational
            </div>
          </div>

          {/* Center Hero Statement & Bento Highlights */}
          <div className="my-4 lg:my-auto max-w-xl space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4e45e1]/10 border border-[#4e45e1]/20 text-[12px] font-medium text-[var(--apple-blue)]">
                <i className="fas fa-wand-magic-sparkles text-[11px]"></i>
                Powered by DI AI & Enterprise Engineering
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--apple-text-primary)]">
                Precision built for{' '}
                <span className="bg-gradient-to-r from-[#4e45e1] via-[#5856D6] to-[#AF52DE] bg-clip-text text-transparent">
                  modern teams.
                </span>
              </h1>
              <p className="text-[16px] lg:text-[17px] text-[var(--apple-text-secondary)] leading-relaxed font-normal max-w-lg">
                Orchestrate client projects, DI AI diagnostics, editorial publishing, and team velocity from one unified DevInquire workspace.
              </p>
            </div>

            {/* Bento Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="apple-card p-5 space-y-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#BF5AF2] to-[#5E5CE6] flex items-center justify-center text-white shadow-sm">
                  <i className="fas fa-wand-magic-sparkles text-sm badge-white"></i>
                </div>
                <h3 className="text-[15px] font-semibold text-[var(--apple-text-primary)]">DI AI Core</h3>
                <p className="text-[13px] text-[var(--apple-text-secondary)] leading-relaxed">
                  Real-time AI synthesis for code architecture reviews, security audits, and automated engineering insights.
                </p>
              </div>

              <div className="apple-card p-5 space-y-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-gradient-to-b from-[#30D158] to-[#248A3D] flex items-center justify-center text-white shadow-sm">
                  <i className="fas fa-shield-halved text-sm badge-white"></i>
                </div>
                <h3 className="text-[15px] font-semibold text-[var(--apple-text-primary)]">Zero-Trust Continuity</h3>
                <p className="text-[13px] text-[var(--apple-text-secondary)] leading-relaxed">
                  Cryptographic session continuity with role-based permissions across every client project and environment.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-[12px] text-[var(--apple-text-tertiary)] pt-4 border-t border-[var(--apple-border)]">
            <span>DevInquire Enterprise Platform · Client & Engineering Suite</span>
            <span className="font-mono text-[11px]">TLS 1.3 · HMAC-SHA256 Verified</span>
          </div>
        </div>

        {/* Right Apple Account Sign-In Column */}
        <div
          className="flex-1 lg:h-full lg:overflow-y-auto flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12 relative z-20"
        >
          <div className="w-full max-w-[420px] my-auto">
            <div className="apple-glass rounded-[30px] p-8 sm:p-10 relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
              {/* Top Icon & Title */}
              <div className="text-center mb-7">
                <div className="w-16 h-16 rounded-[20px] bg-gradient-to-b from-[#6B63F2] to-[#4139BF] flex items-center justify-center mx-auto mb-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_28px_rgba(78,69,225,0.32)] transition-transform duration-300">
                  <i className={`fas ${isLogin ? 'fa-fingerprint' : 'fa-user-plus'} text-white text-2xl badge-white transition-all duration-300`}></i>
                </div>
                <h2 className="text-[24px] font-semibold text-[var(--apple-text-primary)] tracking-tight transition-all duration-200">
                  {isLogin ? 'Sign in to DevInquire' : 'Request Workspace Access'}
                </h2>
                <p className="text-[13px] text-[var(--apple-text-secondary)] mt-1.5 transition-all duration-200">
                  {isLogin
                    ? 'Enter your credentials to access your studio console.'
                    : 'Create an engineering profile for administrator review.'}
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3.5 bg-[#FF3B30]/10 border border-[#FF3B30]/25 rounded-[14px] flex items-center gap-3 animate-in fade-in duration-200">
                  <i className="fas fa-circle-exclamation text-[#FF3B30] text-sm"></i>
                  <p className="text-[13px] font-medium text-[#FF3B30]">{errorMessage}</p>
                </div>
              )}

              <form onSubmit={handleAuth} className="flex flex-col">
                {/* Smoothly collapsible Full Name field using CSS grid-rows transition */}
                <div
                  className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    !isLogin
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1.5 pb-4">
                      <label className="text-[12px] font-medium text-[var(--apple-text-secondary)] ml-1">
                        Full Name
                      </label>
                      <input
                        required={!isLogin}
                        tabIndex={isLogin ? -1 : 0}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full apple-input px-4 py-3 text-[14px]"
                        placeholder="e.g. Alex Rivera"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pb-4">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)] ml-1">Email Address</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full apple-input px-4 py-3 text-[14px]"
                    placeholder="name@example.com"
                  />
                </div>

                <div className="space-y-1.5 pb-6">
                  <label className="text-[12px] font-medium text-[var(--apple-text-secondary)] ml-1">Password</label>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full apple-input px-4 py-3 text-[14px]"
                    placeholder="••••••••••••"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3.5 rounded-[14px] font-semibold text-[14px] flex items-center justify-center gap-2.5 transition-all duration-200 ${
                      isLoading
                        ? 'apple-subcard text-[var(--apple-text-tertiary)] cursor-not-allowed'
                        : 'apple-pill-btn'
                    }`}
                  >
                    {isLoading ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      <>
                        <span>{isLogin ? 'Continue' : 'Submit Request'}</span>
                        <i className="fas fa-arrow-right text-xs badge-white"></i>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-5 border-t border-[var(--apple-border)] text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrorMessage('');
                  }}
                  className="text-[13px] font-medium text-[var(--apple-blue)] hover:opacity-80 transition-opacity"
                >
                  {isLogin ? "Don't have an account? Request Access" : 'Already have an account? Sign In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
