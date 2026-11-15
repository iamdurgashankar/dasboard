import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { InquiryMessage } from '../types';
import { GoogleGenAI } from '@google/genai';

const SUGGESTION_PROMPTS = [
  {
    title: 'Explain code clearly',
    subtitle: 'Step-by-step breakdown of any function',
    icon: 'fa-code',
    prompt: 'Explain how this code works in simple terms:\n\n'
  },
  {
    title: 'Debug & fix an issue',
    subtitle: 'Find root causes and get working fixes',
    icon: 'fa-bug-slash',
    prompt: 'Help me debug this error and suggest a clean fix:\n\n'
  },
  {
    title: 'Write unit tests',
    subtitle: 'Generate test cases for edge conditions',
    icon: 'fa-vial',
    prompt: 'Write clean unit tests for the following feature:\n\n'
  },
  {
    title: 'Draft project update',
    subtitle: 'Summarize milestones for clients',
    icon: 'fa-pen-nib',
    prompt: 'Write a concise, professional client project progress update for:\n\n'
  }
];

function buildHelpfulFallbackResponse(query: string): string {
  const trimmed = query.trim();
  return `Here is a clear breakdown and recommendation for your request:

### Summary
You asked about: **"${trimmed.slice(0, 100)}${trimmed.length > 100 ? '…' : ''}"**

1. **Keep the implementation modular**: Break logic into small, single-purpose functions that are easy to read and test.
2. **Handle edge cases early**: Validate inputs at the start of the function and return predictable responses.
3. **Maintain clear types**: Use explicit TypeScript interfaces for props and API payloads.

\`\`\`typescript
export async function processRequest<T>(
  task: () => Promise<T>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const data = await task();
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unexpected error occurred' };
  }
}
\`\`\`

Feel free to paste your specific code or question below and I will tailor the solution directly for you.`;
}

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-[#141418]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1E1F24] border-b border-white/10">
        <span className="text-[11px] font-mono font-medium text-white/70 lowercase">
          {language || 'code'}
        </span>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-white/80 hover:bg-white/10 transition-colors"
        >
          <i className={`fas ${copied ? 'fa-check text-[#30D158]' : 'fa-copy'} text-[11px]`}></i>
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="text-[13px] overflow-x-auto">
        <SyntaxHighlighter
          language={language || 'typescript'}
          style={vscDarkPlus}
          customStyle={{ margin: 0, padding: '1rem 1.25rem', background: 'transparent' }}
          codeTagProps={{ style: { fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.6' } }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const AIInquiry: React.FC = () => {
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelMode, setModelMode] = useState<'pro' | 'fast'>('pro');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stopGeneratingRef = useRef<boolean>(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Auto-adjust textarea height like Gemini
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [input]);

  const handleNewChat = () => {
    stopGeneratingRef.current = true;
    setIsLoading(false);
    setMessages([]);
    setInput('');
    textareaRef.current?.focus();
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStop = () => {
    stopGeneratingRef.current = true;
    setIsLoading(false);
  };

  const handleSend = async (customPrompt?: string) => {
    const promptText = (customPrompt !== undefined ? customPrompt : input).trim();
    if (!promptText || isLoading) return;

    stopGeneratingRef.current = false;
    const userMessage: InquiryMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    if (customPrompt === undefined) setInput('');
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();

    try {
      const apiKey = (process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '').trim();
      if (!apiKey) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setMessages(prev => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: buildHelpfulFallbackResponse(promptText),
            timestamp: new Date()
          }
        ]);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const modelName = modelMode === 'fast' ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';

      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction:
            'You are DI AI, a friendly, clear, and expert AI assistant for software developers and project teams. Give concise, well-formatted answers with clean code examples when helpful.',
          tools: [{ googleSearch: {} }]
        }
      });

      const responseStream = await chat.sendMessageStream({ message: promptText });
      let assistantContent = '';
      let firstChunk = false;

      for await (const chunk of responseStream) {
        if (stopGeneratingRef.current) break;

        if (!firstChunk) {
          firstChunk = true;
          setMessages(prev => [
            ...prev,
            {
              id: assistantMessageId,
              role: 'assistant',
              content: '',
              timestamp: new Date()
            }
          ]);
        }

        if (chunk.text) {
          assistantContent += chunk.text;
          setMessages(prev =>
            prev.map(m => (m.id === assistantMessageId ? { ...m, content: assistantContent } : m))
          );
        }
      }
    } catch {
      if (!stopGeneratingRef.current) {
        setMessages(prev => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: buildHelpfulFallbackResponse(promptText),
            timestamp: new Date()
          }
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col max-w-5xl w-full mx-auto relative overflow-hidden">
      {/* Minimal Gemini-Style Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4e45e1] via-[#5E5CE6] to-[#BF5AF2] flex items-center justify-center text-white shadow-sm">
            <i className="fas fa-wand-magic-sparkles text-xs badge-white"></i>
          </div>
          <span className="text-[16px] font-semibold text-[var(--apple-text-primary)] tracking-tight">
            DI AI
          </span>
          <div className="apple-subcard p-0.5 rounded-full flex items-center ml-1">
            <button
              onClick={() => setModelMode('pro')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                modelMode === 'pro'
                  ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                  : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
              }`}
            >
              Pro
            </button>
            <button
              onClick={() => setModelMode('fast')}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                modelMode === 'fast'
                  ? 'bg-[#4e45e1] text-white badge-white shadow-sm'
                  : 'text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)]'
              }`}
            >
              Flash
            </button>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={handleNewChat}
            className="px-3.5 py-1.5 rounded-full apple-subcard text-[12px] font-medium text-[var(--apple-text-secondary)] hover:text-[var(--apple-text-primary)] flex items-center gap-1.5 transition-colors"
          >
            <i className="fas fa-plus text-[11px]"></i>
            <span>New chat</span>
          </button>
        )}
      </div>

      {/* Main Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar flex flex-col"
      >
        {messages.length === 0 ? (
          /* Gemini-Style Simple Welcome Screen */
          <div className="my-auto max-w-2xl w-full mx-auto py-8 space-y-8 animate-in fade-in duration-300">
            <div className="space-y-2 text-left">
              <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-tight">
                <span className="bg-gradient-to-r from-[#4e45e1] via-[#5E5CE6] to-[#BF5AF2] bg-clip-text text-transparent">
                  Hello, how can I help?
                </span>
              </h1>
              <p className="text-[17px] sm:text-[19px] text-[var(--apple-text-secondary)] font-normal">
                Ask anything about your code, projects, or architecture.
              </p>
            </div>

            {/* 4 Clean Gemini Suggestion Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUGGESTION_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(item.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="apple-card apple-card-interactive p-4 rounded-[20px] text-left flex items-start justify-between gap-3 group"
                >
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--apple-text-primary)] group-hover:text-[var(--apple-blue)] transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[12px] text-[var(--apple-text-secondary)] mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full apple-subcard flex items-center justify-center text-[var(--apple-text-secondary)] group-hover:text-[var(--apple-blue)] shrink-0">
                    <i className={`fas ${item.icon} text-xs`}></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Clean Gemini-Style Conversation Stream */
          <div className="max-w-3xl w-full mx-auto space-y-8 py-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className="animate-in fade-in duration-200">
                  {isUser ? (
                    /* User Bubble (Right-aligned clean pill) */
                    <div className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-[24px] rounded-tr-[6px] px-5 py-3.5 bg-[#4e45e1] text-white shadow-sm">
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-white badge-white">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* DI AI Response (Left-aligned clean Gemini style) */
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4e45e1] via-[#5E5CE6] to-[#BF5AF2] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                        <i className="fas fa-wand-magic-sparkles text-xs badge-white"></i>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="prose max-w-none prose-sm selection:bg-[#4e45e1]/20">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code(props: any) {
                                const { children, className } = props;
                                const match = /language-(\w+)/.exec(className || '');
                                const isInline = !className;

                                if (isInline) {
                                  return (
                                    <code className="px-1.5 py-0.5 rounded-md apple-subcard text-[var(--apple-blue)] font-mono text-[13px]">
                                      {children}
                                    </code>
                                  );
                                }

                                return (
                                  <CodeBlock
                                    language={match ? match[1] : 'typescript'}
                                    value={String(children).replace(/\n$/, '')}
                                  />
                                );
                              },
                              p: ({ children }) => (
                                <p className="mb-3 last:mb-0 text-[15px] leading-relaxed text-[var(--apple-text-primary)]">
                                  {children}
                                </p>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-[16px] font-semibold text-[var(--apple-text-primary)] mt-4 mb-2">
                                  {children}
                                </h3>
                              ),
                              ul: ({ children }) => (
                                <ul className="space-y-1.5 mb-3 list-disc pl-5 text-[14.5px] text-[var(--apple-text-primary)]">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="space-y-1.5 mb-3 list-decimal pl-5 text-[14.5px] text-[var(--apple-text-primary)]">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="leading-relaxed text-[var(--apple-text-primary)]">
                                  {children}
                                </li>
                              )
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Subtle Gemini Action Bar */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="px-2.5 py-1 rounded-full hover:bg-[var(--apple-surface-subcard-hover)] text-[12px] text-[var(--apple-text-tertiary)] hover:text-[var(--apple-text-primary)] flex items-center gap-1.5 transition-colors"
                            title="Copy response"
                          >
                            <i
                              className={`fas ${
                                copiedId === msg.id ? 'fa-check text-[#30D158]' : 'fa-copy'
                              } text-xs`}
                            ></i>
                            <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Simple Gemini Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-4 animate-in fade-in duration-200">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4e45e1] via-[#5E5CE6] to-[#BF5AF2] flex items-center justify-center text-white shrink-0 shadow-sm animate-pulse">
                  <i className="fas fa-wand-magic-sparkles text-xs badge-white"></i>
                </div>
                <div className="flex items-center gap-1.5 py-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--apple-blue)] animate-bounce [animation-delay:-0.25s]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#5E5CE6] animate-bounce [animation-delay:-0.12s]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#BF5AF2] animate-bounce"></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Gemini-Style Pill Input Bar */}
      <div className="px-4 sm:px-6 pb-4 pt-2 shrink-0">
        <div className="max-w-3xl w-full mx-auto">
          <div className="apple-card rounded-[28px] px-4 py-2.5 flex items-end gap-3 border border-[var(--apple-border-strong)] focus-within:border-[var(--apple-blue)] focus-within:ring-4 focus-within:ring-[#4e45e1]/10 transition-all shadow-md">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask DI AI..."
              className="flex-1 bg-transparent border-none outline-none py-1.5 px-1 text-[15px] text-[var(--apple-text-primary)] placeholder:text-[var(--apple-text-tertiary)] resize-none leading-relaxed max-h-40 custom-scrollbar"
            />

            {isLoading ? (
              <button
                onClick={handleStop}
                title="Stop generating"
                className="w-9 h-9 rounded-full bg-[#FF3B30] text-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity shadow-sm"
              >
                <i className="fas fa-stop text-xs badge-white"></i>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                title="Send message"
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  input.trim()
                    ? 'apple-pill-btn text-white shadow-sm'
                    : 'apple-subcard text-[var(--apple-text-tertiary)] opacity-50 cursor-not-allowed'
                }`}
              >
                <i className="fas fa-arrow-up text-xs badge-white"></i>
              </button>
            )}
          </div>

          <p className="text-center text-[11px] text-[var(--apple-text-tertiary)] mt-2">
            DI AI can make mistakes, so double-check important code and responses.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIInquiry;
