import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
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
        const result = await api.auth.login({ email, password });

        // Secure token handling
        if (result.status === 'success') {
          localStorage.setItem('di_csrf_token', result.data.csrf_token);
          onLogin(result.data.user);
        } else {
          setErrorMessage(result.message);
        }
      } else {
        // Registration / Access Request Logic
        // In this implementation, registration creates a 'pending' state
        setPendingUser({
          id: `req-${Date.now()}`,
          name,
          email,
          role: 'Developer',
          status: 'pending',
          joinDate: new Date().toISOString().split('T')[0]
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Neural link failure: Terminal unreachable.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    setErrorMessage(`${provider} authentication is locked in this cluster.`);
  };

  const leftSectionRef = useRef<HTMLDivElement>(null);
  const rightSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      },
      { threshold: 0.1 }
    );

    if (leftSectionRef.current) observer.observe(leftSectionRef.current);
    if (rightSectionRef.current) observer.observe(rightSectionRef.current);

    return () => observer.disconnect();
  }, []);

  if (pendingUser) {
    return (
      <div className="h-screen bg-slate-950 overflow-y-auto text-slate-100 relative">
        <div className="min-h-full flex flex-col py-12 px-6">
          <div className="fixed inset-0 cyber-grid opacity-30 pointer-events-none"></div>
          <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-2xl border border-indigo-500/20 rounded-[2.5rem] p-12 shadow-2xl text-center z-10 animate-in zoom-in-95 duration-500 mx-auto my-auto">
            <div className="w-24 h-24 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-[2rem] flex items-center justify-center mx-auto mb-10 text-4xl shadow-inner shadow-indigo-500/10">
              <i className="fas fa-user-lock animate-pulse"></i>
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tight">Access Restricted</h2>
            <p className="text-slate-400 leading-relaxed mb-10 text-sm font-medium font-mono lowercase">
              Identity for <span className="text-indigo-400 font-bold">@{pendingUser.name.toLowerCase().replace(' ', '_')}</span> has been queued. Await administrative override to initialize session tokens.
            </p>
            <button
              onClick={() => { setPendingUser(null); setIsLogin(true); }}
              className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all"
            >
              Return to Terminal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-slate-100 relative">
      <div className="min-h-full flex flex-col lg:flex-row">
        {/* Background Decor - Fixed to stay in place while content scrolls */}
        <div className="fixed inset-0 cyber-grid opacity-20 pointer-events-none"></div>
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="scanline"></div>
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full"></div>
          <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full"></div>
        </div>

        {/* Left Branding Column */}
        <div ref={leftSectionRef} className="relative w-full lg:w-3/5 flex flex-col items-center justify-center p-8 md:p-12 lg:p-20 z-10 lg:border-r border-slate-800/40 bg-slate-950/20 backdrop-blur-sm section-reveal">
          <div className="max-w-2xl w-full py-12 lg:py-0 my-auto">
            <div className="flex items-center gap-5 mb-12 lg:mb-16">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-indigo-600 rounded-[1.25rem] lg:rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-600/40 ring-8 ring-indigo-600/10">
                <i className="fas fa-terminal text-white text-xl lg:text-2xl"></i>
              </div>
              <div>
                <h1 className="text-2xl lg:text-4xl font-black tracking-tighter">DevInquire <span className="text-indigo-500">PRO</span></h1>
                <p className="text-[9px] lg:text-[10px] font-black text-slate-600 lg:text-slate-500 uppercase tracking-[0.4em] ml-1">Secure Intel v2.0.5</p>
              </div>
            </div>

            <div className="space-y-12 lg:space-y-16">
              <div className="space-y-4">
                <h2 className="text-5xl lg:text-7xl font-black leading-[1] tracking-tighter text-slate-100">
                  Unified <br /><span className="text-indigo-500">Engineering.</span>
                </h2>
                <p className="text-base lg:text-lg text-slate-400 font-medium max-w-lg leading-relaxed border-l-2 border-indigo-500/30 pl-6 py-2">
                  Aggregate distributed infrastructure and team velocity into a high-fidelity neural command interface.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-12">
                <div className="space-y-3">
                  <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400 mb-2">
                    <i className="fas fa-microchip"></i>
                  </div>
                  <p className="text-sm font-bold text-slate-200">AI Core Integration</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Deep Gemini 3 Pro reasoning for architectural reviews and debugging.</p>
                </div>
                <div className="space-y-3">
                  <div className="w-10 h-10 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400 mb-2">
                    <i className="fas fa-shield-halved"></i>
                  </div>
                  <p className="text-sm font-bold text-slate-200">Zero Trust Access</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Identity-first RBAC ensuring partitioned security across all modules.</p>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 lg:p-8 font-mono text-[9px] lg:text-[10px] text-slate-500 flex flex-col gap-2 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-indigo-500/80 font-bold uppercase tracking-widest"># System Telemetry</p>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                  </div>
                </div>
                <p><span className="text-emerald-500">[OK]</span> Connection established to secure-gateway.cluster-alpha</p>
                <p><span className="text-indigo-500">[INFO]</span> Initializing DevInquire Neural Core...</p>
                <p><span className="text-emerald-500">[OK]</span> Model: gemini-3-pro-preview verified.</p>
                <p className="animate-pulse"><span className="text-amber-500">[WAIT]</span> Awaiting terminal handshake credentials...</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Login Column */}
        <div ref={rightSectionRef} className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 lg:p-12 relative z-20 section-reveal">
          <div className="w-full max-w-md space-y-8 py-12 lg:py-8 my-auto">
            <div className="bg-slate-900/60 backdrop-blur-3xl border border-slate-800/80 rounded-[2.5rem] lg:rounded-[3rem] p-8 md:p-10 lg:p-14 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12">
                <i className="fas fa-lock text-[10rem] text-white"></i>
              </div>

              <div className="mb-10 lg:mb-12">
                <h2 className="text-2xl lg:text-3xl font-black text-white mb-2 tracking-tight">{isLogin ? 'Identity Verify' : 'Request Access'}</h2>
                <p className="text-slate-500 text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.2em]">Secure Terminal Login</p>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <i className="fas fa-circle-exclamation text-rose-500"></i>
                  <p className="text-[11px] font-bold text-rose-400 uppercase tracking-tight">{errorMessage}</p>
                </div>
              )}

              <div className="relative mb-8 lg:mb-10">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800/50"></div></div>
                <div className="relative flex justify-center text-[8px] lg:text-[9px] uppercase font-black tracking-[0.3em] text-slate-600"><span className="bg-slate-900/60 px-4">IDENTITY VERIFICATION</span></div>
              </div>

              <form onSubmit={handleAuth} className="space-y-5 lg:space-y-6">
                {!isLogin && (
                  <div className="space-y-2 group">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-indigo-400">Handle / User ID</label>
                    <input
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 lg:py-4.5 text-sm text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-800"
                      placeholder="Engineering Handle"
                    />
                  </div>
                )}
                <div className="space-y-2 group">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-indigo-400">Terminal Address</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 lg:py-4.5 text-sm text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-800 font-mono"
                    placeholder="mail@devinquire.com"
                  />
                </div>
                <div className="space-y-2 group">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1 transition-colors group-focus-within:text-indigo-400">Security Key</label>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 lg:py-4.5 text-sm text-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-800"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-4.5 lg:py-5 rounded-2xl font-black text-[10px] lg:text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-4 relative overflow-hidden group/btn ${isLoading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-[0.98]'
                    }`}
                >
                  {isLoading ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <>
                      <span>Initialize Interface</span>
                      <i className="fas fa-arrow-right text-[10px] group-hover/btn:translate-x-1 transition-transform"></i>
                    </>
                  )}
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                </button>
              </form>

              <div className="mt-8 lg:mt-10 text-center">
                <button onClick={() => setIsLogin(!isLogin)} className="text-[9px] lg:text-[10px] font-bold text-slate-500 hover:text-indigo-400 uppercase tracking-[0.2em] transition-colors">
                  {isLogin ? "No access? Request Override" : 'Personnel? Sign In'}
                </button>
              </div>
            </div>

            <div className="text-center pt-8">
              <p className="text-[7px] lg:text-[8px] font-black text-slate-800 uppercase tracking-[0.5em]">Protected by Neural Encryption | v2.1.0-PRO</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
