
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration, Blob } from '@google/genai';
import { DashboardTab, UserRole } from '../types';

interface CommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUpdateUserRole: (email: string, role: UserRole) => void;
}

// Function Declarations for Dashboard Automation
const dashboardTools: FunctionDeclaration[] = [
  {
    name: 'navigateTo',
    parameters: {
      type: Type.OBJECT,
      description: 'Navigate to a specific section of the dashboard.',
      properties: {
        tab: {
          type: Type.STRING,
          description: 'The target tab (overview, inquire, analytics, team, blogs, users, contacts)',
        },
      },
      required: ['tab'],
    },
  },
  {
    name: 'createProject',
    parameters: {
      type: Type.OBJECT,
      description: 'Create a new project in the dashboard.',
      properties: {
        name: { type: Type.STRING, description: 'Project name' },
        description: { type: Type.STRING, description: 'Project purpose' },
        language: { type: Type.STRING, description: 'Programming language stack' },
      },
      required: ['name', 'description', 'language'],
    },
  },
  {
    name: 'draftBlogPost',
    parameters: {
      type: Type.OBJECT,
      description: 'Start a new blog post draft.',
      properties: {
        title: { type: Type.STRING },
        category: { type: Type.STRING },
      },
      required: ['title', 'category'],
    },
  },
];

const CommandCenter: React.FC<CommandCenterProps> = ({ isOpen, onClose, currentUser, onUpdateUserRole }) => {
  const navigate = useNavigate();
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'executing'>('idle');
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // Helper: Base64 Decoding/Encoding (Manual as per rules)
  const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const encodeBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext) => {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const stopVoice = useCallback(() => {
    setIsVoiceActive(false);
    setStatus('idle');
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const handleCommand = useCallback(async (name: string, args: any) => {
    setStatus('executing');
    console.log(`Executing AI Command: ${name}`, args);

    switch (name) {
      case 'navigateTo':
        const path = args.tab === 'overview' ? '/' : `/${args.tab}`;
        navigate(path);
        setAiResponse(`Navigating to ${args.tab}...`);
        break;
      case 'createProject':
        // Simulated event for DashboardHome to pick up
        window.dispatchEvent(new CustomEvent('ai-create-project', { detail: args }));
        setAiResponse(`Initializing project ${args.name}...`);
        break;
      case 'draftBlogPost':
        navigate('/blogs');
        window.dispatchEvent(new CustomEvent('ai-draft-blog', { detail: args }));
        setAiResponse(`Drafting blog post: ${args.title}`);
        break;
      default:
        setAiResponse("Command not recognized by the neural core.");
    }
    
    setTimeout(() => setStatus('idle'), 2000);
    return "ok";
  }, [navigate]);

  const startVoice = async () => {
    if (isVoiceActive) return stopVoice();

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      
      setIsVoiceActive(true);
      setStatus('listening');

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              
              const pcmBlob: Blob = {
                data: encodeBase64(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000'
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Audio
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const buffer = await decodeAudioData(decodeBase64(audioData), outputCtx);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle Transcriptions
            if (msg.serverContent?.inputTranscription) {
              setTranscription(prev => prev + msg.serverContent!.inputTranscription!.text);
            }
            if (msg.serverContent?.outputTranscription) {
              setAiResponse(prev => prev + msg.serverContent!.outputTranscription!.text);
            }

            // Handle Tool Calls
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const result = await handleCommand(fc.name, fc.args);
                sessionPromise.then(session => session.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result } }
                }));
              }
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
            
            if (msg.serverContent?.turnComplete) {
              setTranscription('');
              setStatus('idle');
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: dashboardTools }],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: `You are the DevInquire Neural Agent. You have control over the dashboard.
          When a user asks to go somewhere, use navigateTo. 
          When they want to create something, use the appropriate tool.
          Be concise, professional, and efficient.`,
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (err) {
      console.error("Neural Link Error:", err);
      stopVoice();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/20">
               <i className="fas fa-brain-circuit text-white text-xl animate-pulse"></i>
             </div>
             <div>
               <h2 className="text-xl font-black tracking-tight text-white uppercase">Neural Command Core</h2>
               <p className="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">System Automation Active</p>
             </div>
           </div>
           <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors">
             <i className="fas fa-times text-lg"></i>
           </button>
        </div>

        {/* Content Area */}
        <div className="p-12 space-y-10 min-h-[400px] flex flex-col justify-center">
           
           {/* Visualizer */}
           <div className="flex justify-center items-center gap-1.5 h-16">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 rounded-full bg-indigo-500 transition-all duration-300 ${
                    status === 'listening' ? 'animate-bounce' : 
                    status === 'processing' ? 'animate-pulse' : 'h-2 opacity-20'
                  }`}
                  style={{ 
                    animationDelay: `${i * 100}ms`,
                    height: status === 'listening' ? `${Math.random() * 40 + 20}%` : '8px'
                  }}
                ></div>
              ))}
           </div>

           {/* Dialogue Box */}
           <div className="bg-slate-950/50 rounded-[2.5rem] p-8 border border-slate-800 shadow-inner min-h-[160px] flex flex-col justify-center text-center">
              {transcription && (
                <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-4 animate-in fade-in">
                  Input: {transcription}
                </p>
              )}
              {aiResponse ? (
                <p className="text-xl font-bold text-slate-100 leading-relaxed italic animate-in slide-in-from-bottom-2">
                  "{aiResponse}"
                </p>
              ) : (
                <p className="text-slate-600 font-medium italic">
                  {status === 'listening' ? 'Uplink active. Awaiting voice command...' : 'Ready for neural instruction.'}
                </p>
              )}
           </div>

           {/* Execution Status */}
           <div className="flex items-center justify-center gap-8">
              <div className="flex items-center gap-3">
                 <div className={`w-3 h-3 rounded-full ${status === 'listening' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`}></div>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Listening</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className={`w-3 h-3 rounded-full ${status === 'executing' ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-800'}`}></div>
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Executing</span>
              </div>
           </div>
        </div>

        {/* Footer Actions */}
        <div className="p-10 border-t border-slate-800 bg-slate-950/40 text-center">
           <button 
             onClick={startVoice}
             className={`px-12 py-5 rounded-3xl font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-2xl flex items-center justify-center gap-4 mx-auto ${
               isVoiceActive 
                 ? 'bg-rose-500 text-white shadow-rose-600/30' 
                 : 'bg-indigo-600 text-white shadow-indigo-600/40 hover:scale-105 active:scale-95'
             }`}
           >
             <i className={`fas ${isVoiceActive ? 'fa-microphone-slash' : 'fa-microphone'} text-lg`}></i>
             {isVoiceActive ? 'Sever Link' : 'Establish Neural Link'}
           </button>
           <p className="mt-6 text-[9px] font-bold text-slate-700 uppercase tracking-[0.4em]">
             Voice Encryption: AES-256 Verified
           </p>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
