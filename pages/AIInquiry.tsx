
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { InquiryMessage } from '../types';
import { GoogleGenAI } from "@google/genai";

const QUICK_ACTIONS = [
  { label: 'Explain Code', icon: 'fa-book-open', prompt: 'Please provide a clear, natural language explanation of what this code does and how it functions: ' },
  { label: 'Optimize Code', icon: 'fa-bolt', prompt: 'Analyze this code for performance bottlenecks and suggest optimizations: ' },
  { label: 'Security Review', icon: 'fa-shield-halved', prompt: 'Audit this code for security vulnerabilities and best practices: ' },
  { label: 'Explain Patterns', icon: 'fa-microscope', prompt: 'Identify the design patterns used here and explain their purpose: ' },
  { label: 'Unit Tests', icon: 'fa-vial', prompt: 'Write comprehensive unit tests for this functionality using a modern framework: ' },
  { label: 'Refactor Logic', icon: 'fa-wand-magic-sparkles', prompt: 'Refactor this logic to be more readable, efficient, and follow DRY principles: ' },
];

const AGENTS = [
  {
    id: 'architect',
    name: 'Senior Architect',
    icon: 'fa-sitemap',
    color: 'text-indigo-400',
    instruction: 'You are a Senior Architect. Focus on system design, scalability, design patterns, and decoupled architecture. Prefer diagrams in mermaid/markdown.'
  },
  {
    id: 'security',
    name: 'Security Lead',
    icon: 'fa-user-shield',
    color: 'text-rose-400',
    instruction: 'You are a Security Lead. Focus on identifying vulnerabilities, OWASP standards, authentication protocols, and data protection.'
  },
  {
    id: 'devops',
    name: 'DevOps Engineer',
    icon: 'fa-infinity',
    color: 'text-emerald-400',
    instruction: 'You are a DevOps Engineer. Focus on CI/CD pipelines, Docker/Kubernetes, cloud infrastructure, and deployment automation.'
  },
  {
    id: 'performance',
    name: 'Performance Critic',
    icon: 'fa-gauge-high',
    color: 'text-amber-400',
    instruction: 'You are a Performance Critic. Focus on algorithm complexity, memory leaks, latency optimization, and resource efficiency.'
  }
];

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once visible, we keep it rendered
        }
      },
      { rootMargin: '200px' } // Load slightly before it comes into view
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      ref={containerRef}
      className="relative my-8 group rounded-2xl overflow-hidden border border-slate-800 bg-[#0d1117] shadow-2xl transition-all hover:border-slate-700 min-h-[100px]"
    >
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900/80 border-b border-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
          </div>
          <div className="h-4 w-px bg-slate-800 mx-2"></div>
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <i className={`fas ${language === 'typescript' || language === 'javascript' ? 'fa-code' : 'fa-terminal'} text-[10px] text-indigo-400`}></i>
            {language || 'code'}
          </span>
        </div>

        <button
          onClick={copyToClipboard}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 
            ${copied
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : 'opacity-0 group-hover:opacity-100 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 border border-slate-700'
            }`}
        >
          <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} text-xs`}></i>
          <span className="text-[10px] font-bold uppercase tracking-widest">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="text-sm selection:bg-indigo-500/30">
        {isVisible ? (
          <SyntaxHighlighter
            language={language || 'text'}
            style={vscDarkPlus}
            customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent' }}
            codeTagProps={{ style: { fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.7' } }}
            showLineNumbers={true}
            lineNumberStyle={{ color: '#334155', minWidth: '2.5em', paddingRight: '1em' }}
          >
            {value}
          </SyntaxHighlighter>
        ) : (
          <div className="p-6 font-mono text-slate-700 animate-pulse">
            {/* Skeleton loader for hidden code */}
            <div className="h-4 bg-slate-800/40 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-800/40 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-slate-800/40 rounded w-5/6 mb-2"></div>
          </div>
        )}
      </div>
    </div>
  );
};

const AIInquiry: React.FC = () => {
  const [messages, setMessages] = useState<InquiryMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "# Technical Core Initialized\nWelcome to **DevInquire AI**. I am your architectural lead and debugging co-pilot. \n\nHow can I help you accelerate your build today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState<string>('');
  const [activeAgent, setActiveAgent] = useState(AGENTS[0]);
  const [repoUrl, setRepoUrl] = useState('');
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stopGeneratingRef = useRef<boolean>(false);
  const isAtBottom = useRef<boolean>(true);

  const scrollToBottom = useCallback((force = false) => {
    if (scrollRef.current && (isAtBottom.current || force)) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: force ? 'auto' : 'smooth'
      });
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      isAtBottom.current = atBottom;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, thinkingStep, scrollToBottom]);

  const handleQuickAction = (actionPrompt: string) => {
    setInput(actionPrompt);
    textareaRef.current?.focus();
  };

  const handleStopGeneration = () => {
    stopGeneratingRef.current = true;
    setIsLoading(false);
    setThinkingStep('');
  };

  const detectThinkingTask = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('code') || lower.includes('{') || lower.includes('function') || lower.includes('class')) {
      return "Analyzing code architecture...";
    }
    if (lower.includes('security') || lower.includes('vulnerability') || lower.includes('auth')) {
      return "Auditing security protocols...";
    }
    if (lower.includes('performance') || lower.includes('optimize') || lower.includes('slow')) {
      return "Profiling resource bottlenecks...";
    }
    if (lower.includes('how') || lower.includes('what') || lower.includes('why')) {
      return "Consulting technical documentation...";
    }
    return "Scanning neural pathways...";
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    stopGeneratingRef.current = false;
    const userMessage: InquiryMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Phase 1: Context Detection
    setThinkingStep(detectThinkingTask(input));
    isAtBottom.current = true;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = isSpeedMode ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';

      const repoContext = repoUrl
        ? `\n\nCONTEXT: You have access to the codebase at "${repoUrl}". Leverage knowledge of its specific file structure and likely patterns.`
        : '';

      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: `${activeAgent.instruction} 
          You are DevInquire AI, currently acting as ${activeAgent.name}. 
          ${repoContext}
          Ensure code blocks follow modern clean code standards. Be precise and professional.`,
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: isSpeedMode ? 1000 : 4000 }
        }
      });

      const responseStream = await chat.sendMessageStream({ message: input });
      const assistantMessageId = (Date.now() + 1).toString();
      let assistantContent = '';
      let firstChunkReceived = false;

      // Phase 2: Reasoning (updates while waiting for first chunk)
      const reasoningTimeout = setTimeout(() => {
        if (!firstChunkReceived) setThinkingStep("Synthesizing technical response...");
      }, 1500);

      for await (const chunk of responseStream) {
        if (stopGeneratingRef.current) break;

        if (!firstChunkReceived) {
          firstChunkReceived = true;
          clearTimeout(reasoningTimeout);
          setThinkingStep(''); // Clear thinking step once output starts

          setMessages(prev => [...prev, {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
          }]);
        }

        const textChunk = chunk.text;
        if (textChunk) {
          assistantContent += textChunk;
          setMessages(prev =>
            prev.map(m => m.id === assistantMessageId ? { ...m, content: assistantContent } : m)
          );
        }

        const chunkMetadata = chunk.candidates?.[0]?.groundingMetadata;
        if (chunkMetadata?.groundingChunks) {
          const sources = chunkMetadata.groundingChunks.map((c: any) => ({
            title: c.web?.title || 'External Reference',
            uri: c.web?.uri || '#'
          }));
          setMessages(prev =>
            prev.map(m => m.id === assistantMessageId ? { ...m, sources: [...(m.sources || []), ...sources] } : m)
          );
        }
      }
    } catch (error) {
      if (!stopGeneratingRef.current) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: "### System Fault\nConnection to the neural link was severed. Check your uplink and try again.",
          timestamp: new Date()
        }]);
      }
    } finally {
      setIsLoading(false);
      setThinkingStep('');
    }
  };

  return (
    <div className="flex-1 min-h-[600px] lg:h-full flex flex-col max-w-7xl mx-auto border border-slate-800 rounded-[1.5rem] lg:rounded-[2.5rem] bg-slate-950 shadow-2xl overflow-hidden relative border-t-indigo-500/20">

      {/* Dev Terminal Header */}
      <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl flex items-center justify-between z-40">
        <div className="flex items-center gap-5">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"></div>
          </div>
          <div className="h-8 w-px bg-slate-800 mx-2"></div>

          {/* Agent Selector */}
          <div className="relative">
            <button
              onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
              className="flex flex-col text-left group"
            >
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-0.5 group-hover:text-indigo-400 transition-colors">Select Specialization</span>
              <span className={`text-xs font-mono ${activeAgent.color} flex items-center gap-2`}>
                <i className={`fas ${activeAgent.icon} text-[10px]`}></i> {activeAgent.name}
                <i className={`fas fa-chevron-down text-[8px] transition-transform ${isAgentMenuOpen ? 'rotate-180' : ''}`}></i>
              </span>
            </button>

            {isAgentMenuOpen && (
              <div className="absolute top-full left-0 mt-4 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-2 space-y-1">
                  {AGENTS.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => { setActiveAgent(agent); setIsAgentMenuOpen(false); }}
                      className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${activeAgent.id === agent.id
                        ? 'bg-slate-800 text-indigo-400'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center ${agent.color}`}>
                        <i className={`fas ${agent.icon}`}></i>
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold">{agent.name}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-tighter">Ready Tasking</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Git Repo Input */}
          <div className="hidden xl:flex items-center gap-3 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl focus-within:border-indigo-500/50 transition-all">
            <i className="fab fa-github text-slate-600"></i>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="git@handshake..."
              className="bg-transparent border-none outline-none text-[10px] font-mono text-indigo-300 w-48 placeholder:text-slate-800"
            />
          </div>

          {/* Speed Toggle */}
          <button
            onClick={() => setIsSpeedMode(!isSpeedMode)}
            className={`flex items-center gap-3 px-4 py-2 border rounded-xl transition-all ${isSpeedMode
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
              : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
          >
            <i className={`fas ${isSpeedMode ? 'fa-bolt' : 'fa-brain'} text-xs`}></i>
            <span className="text-[10px] font-black uppercase tracking-widest">{isSpeedMode ? 'Flash' : 'Pro'}</span>
          </button>

          {isLoading && (
            <button
              onClick={handleStopGeneration}
              className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 hover:bg-rose-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <i className="fas fa-stop"></i>
            </button>
          )}

          <button
            onClick={() => setMessages(messages.slice(0, 1))}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
            title="Clear Context"
          >
            <i className="fas fa-eraser text-sm"></i>
          </button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="px-8 py-3 border-b border-slate-800/40 bg-slate-900/10 flex gap-3 overflow-x-auto no-scrollbar">
        {QUICK_ACTIONS.map((action, i) => (
          <button
            key={i}
            onClick={() => handleQuickAction(action.prompt)}
            disabled={isLoading}
            className="flex items-center gap-2.5 px-5 py-2 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-bold text-slate-400 hover:text-indigo-300 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all whitespace-nowrap uppercase tracking-widest group shadow-sm disabled:opacity-50"
          >
            <i className={`fas ${action.icon} text-slate-600 group-hover:text-indigo-400 transition-colors`}></i>
            {action.label}
          </button>
        ))}
      </div>

      {/* Main Chat Stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12 bg-[radial-gradient(circle_at_50%_0%,rgba(30,41,59,0.3)_0%,rgba(2,6,23,1)_70%)] custom-scrollbar"
      >
        {messages.map((msg, index) => {
          const isLast = index === messages.length - 1;
          const isStreaming = isLast && msg.role === 'assistant' && isLoading;

          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-8 duration-700`}>
              <div className={`flex gap-6 max-w-[95%] md:max-w-[88%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                <div className="shrink-0 pt-2">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${msg.role === 'user'
                    ? 'bg-indigo-600 border-indigo-400/50 text-white shadow-xl shadow-indigo-600/30'
                    : 'bg-slate-900 border-slate-800 text-indigo-400 shadow-lg'
                    }`}>
                    <i className={`fas ${msg.role === 'user' ? 'fa-user-astronaut' : 'fa-bolt-lightning'} text-lg`}></i>
                  </div>
                </div>

                <div className={`relative flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-8 rounded-3xl md:rounded-[2.5rem] shadow-2xl transition-all border ${msg.role === 'user'
                    ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-50 rounded-tr-none'
                    : 'bg-slate-900/50 border-slate-800 text-slate-100 backdrop-blur-3xl rounded-tl-none'
                    }`}>
                    <div className="prose prose-invert max-w-none prose-sm selection:bg-indigo-500/40">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code(props: any) {
                            const { children, className } = props;
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !className;

                            if (isInline) {
                              return <code className="bg-slate-800/80 px-2 py-0.5 rounded-lg text-indigo-300 font-mono text-[0.9em] border border-slate-700/50">{children}</code>;
                            }

                            return <CodeBlock language={match ? match[1] : ''} value={String(children).replace(/\n$/, '')} />;
                          },
                          strong: ({ children }) => <strong className="text-indigo-400 font-bold">{children}</strong>,
                          p: ({ children }) => <p className="mb-6 last:mb-0 leading-relaxed text-slate-300 font-medium inline">{children}</p>,
                          h1: ({ children }) => <h1 className="text-2xl font-black text-white mb-6 flex items-center gap-3"><span className="w-1.5 h-8 bg-indigo-500 rounded-full"></span>{children}</h1>,
                          ul: ({ children }) => <ul className="space-y-3 mb-6 list-none pl-0">{children}</ul>,
                          li: ({ children }) => <li className="flex gap-4 items-start"><i className="fas fa-caret-right text-indigo-500 mt-1"></i><span className="text-slate-300">{children}</span></li>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {isStreaming && (
                        <span className="inline-block w-2 h-5 bg-indigo-500 ml-1 translate-y-1 animate-pulse rounded-sm"></span>
                      )}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-12 pt-8 border-t border-slate-800/60">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600 mb-5 flex items-center gap-3">
                          <i className="fas fa-network-wired text-indigo-500"></i> Referenced Resources
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {msg.sources.map((s, i) => (
                            <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all flex items-center gap-2.5 group shadow-lg">
                              <i className="fas fa-link text-[9px] opacity-40 group-hover:opacity-100 transition-opacity"></i>
                              <span className="truncate max-w-[280px] tracking-wide">{s.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-4 px-4">
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest font-mono">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      {msg.role === 'user' ? 'Client' : 'Agent'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && thinkingStep && (
          <div className="flex justify-start animate-in fade-in slide-in-from-left-6 duration-500">
            <div className="flex gap-6 max-w-[85%]">
              <div className="shrink-0 pt-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border-2 border-indigo-500/20 flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent animate-pulse"></div>
                  <i className="fas fa-microchip animate-bounce text-indigo-400 relative z-10"></i>
                </div>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] rounded-tl-none flex flex-col gap-6 min-w-[320px] backdrop-blur-2xl shadow-2xl relative">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  </div>
                  <span className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.4em]">Processing...</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-gear fa-spin text-slate-600 text-[10px]"></i>
                    <span className="text-[11px] font-bold text-slate-300 tracking-wide">{thinkingStep}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800/50 rounded-full overflow-hidden p-[1px] border border-slate-700/30">
                    <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700 w-2/3 animate-[shimmer_2s_infinite_linear]"></div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/50">
                  <div className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                    Layer_7
                  </div>
                  <div className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                    Memory_Safe
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Workspace */}
      <div className="p-8 bg-slate-950 border-t border-slate-800/40 relative z-30">
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-900/80 border border-slate-800 rounded-[2.5rem] shadow-2xl focus-within:border-indigo-500/60 transition-all focus-within:ring-[12px] focus-within:ring-indigo-500/5 overflow-hidden backdrop-blur-3xl">
            <textarea
              ref={textareaRef}
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Query technical core or inject code for audit..."
              className="w-full bg-transparent border-none outline-none px-8 py-8 text-sm text-slate-100 resize-none min-h-[120px] placeholder:text-slate-700 font-medium tracking-wide leading-relaxed"
            />

            <div className="flex items-center justify-between px-8 py-5 bg-slate-950/60 border-t border-slate-800/40">
              <div className="flex items-center gap-6">
                <button className="text-slate-600 hover:text-indigo-400 transition-all" title="Attach Module">
                  <i className="fas fa-paperclip text-lg"></i>
                </button>
                <div className="h-6 w-px bg-slate-800"></div>
                <div className="hidden sm:flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Context</span>
                  <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[9px] font-black text-indigo-400 uppercase tracking-widest">Active_Project</div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.15em] hidden md:block">Cmd + Enter to Transmit</span>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`flex items-center gap-4 px-10 py-4 rounded-[1.25rem] font-black text-[11px] uppercase tracking-[0.25em] transition-all shadow-2xl ${input.trim() && !isLoading
                    ? 'bg-indigo-600 text-white shadow-indigo-600/40 hover:bg-indigo-500 hover:-translate-y-1'
                    : 'bg-slate-800/50 text-slate-700 cursor-not-allowed border border-slate-800/50'
                    }`}
                >
                  <span>Transmit</span>
                  <i className={`fas ${isLoading ? 'fa-circle-notch fa-spin' : 'fa-paper-plane'} text-xs`}></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIInquiry;
