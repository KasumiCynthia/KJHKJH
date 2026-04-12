import React, { useState, useEffect, useRef } from 'react';
import { Folder, Play, Square, Image as ImageIcon, CheckCircle2, AlertCircle, Clock, Globe, FolderOpen, Wifi, Settings, X, ArrowRight, LayoutGrid, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LogEntry {
  id: number;
  message: string;
  type: 'info' | 'error' | 'success';
  timestamp: string;
}

interface Status {
  isWatching: boolean;
  currentScale: number;
  comfyUrl: string;
  watchFolder: string;
  isTeamModeEnabled: boolean;
  logs: LogEntry[];
  isConnected: boolean;
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostInput, setHostInput] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false);
  const [isTeamModeEnabled, setIsTeamModeEnabled] = useState(false);

  const watchFolderRef = useRef<HTMLInputElement>(null);
  const globalFolderRef = useRef<HTMLInputElement>(null);
  const [pickerState, setPickerState] = useState<{type: 'watch', index?: number} | null>(null);

  const isSettingsOpenRef = useRef(isSettingsOpen);
  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
      
      // Only update inputs if settings are NOT open to prevent overwriting user changes
      if (!isSettingsOpenRef.current) {
        if (!hostInput) setHostInput(data.comfyUrl);
        if (!folderInput) setFolderInput(data.watchFolder);
        setIsTeamModeEnabled(data.isTeamModeEnabled);
      }
    } catch (err) {
      console.error('Failed to fetch status', err);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await fetch('/api/test-connection');
      const data = await res.json();
      if (data.success) {
        alert('CONNECTION ESTABLISHED: COMFYUI ONLINE');
      } else {
        alert(`CONNECTION FAILED: ${data.error}`);
      }
    } catch (err: any) {
      alert(`SYSTEM ERROR: ${err.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const discoverComfyUI = async () => {
    try {
      const res = await fetch('/api/discover');
      const data = await res.json();
      if (data.length > 0) {
        setHostInput(data[0]);
        updateSettings({ comfyUrl: data[0] });
        alert(`FOUND: ${data[0]}`);
      } else {
        alert('NO INSTANCE FOUND');
      }
    } catch (err) {
      console.error('Failed to discover', err);
      alert('DISCOVERY FAILED');
    }
  };

  const fetchStatusRef = useRef(fetchStatus);
  useEffect(() => {
    fetchStatusRef.current = fetchStatus;
  });

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatusRef.current(), 2000);
    return () => clearInterval(interval);
  }, []);

  const updateSettings = async (newSettings: { scale?: number; watching?: boolean; comfyUrl?: string; watchFolder?: string; isTeamModeEnabled?: boolean }) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
      }
    } catch (err) {
      console.error('Failed to update settings', err);
    }
  };

  const handleGlobalFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && pickerState) {
      const path = e.target.files[0].webkitRelativePath.split('/')[0];
      if (pickerState.type === 'watch') {
        setFolderInput(path);
        updateSettings({ watchFolder: path });
      }
    }
    if (globalFolderRef.current) globalFolderRef.current.value = '';
  };

  if (loading || !status) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neutral-800 border-t-[#00ff66] rounded-full animate-spin"></div>
          <div className="text-[#00ff66] font-display font-bold tracking-[0.3em] uppercase text-sm text-glow">INITIALIZING...</div>
        </div>
      </div>
    );
  }

  const isWatching = status?.isWatching || false;
  const themeColor = isWatching ? '#00ff66' : '#ff003c';

  return (
    <div 
      className="min-h-screen bg-black text-white font-sans selection:bg-[var(--theme-color)] selection:text-black relative overflow-hidden"
      style={{ '--theme-color': themeColor } as React.CSSProperties}
    >
      <div className="absolute inset-0 scanlines z-0"></div>
      
      <div className="relative z-10">
        {/* Top Navigation Bar */}
        <nav className="border-b border-[var(--theme-color)]/30 bg-black/80 backdrop-blur px-6 py-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-display font-bold tracking-[0.2em] text-[var(--theme-color)] text-glow uppercase">
                UPSCALE AUTO
              </h1>
            </div>
            
            <div className="flex items-center gap-4 relative">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-[var(--theme-color)] hover:text-white transition-all duration-300 p-2 rounded-md hover:rotate-12"
                title="Settings"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </nav>

      {/* Settings Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                width: isTeamPanelOpen ? '840px' : '448px'
              }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="tech-panel rounded-none p-6 flex gap-6 overflow-hidden"
            >
              <div className="w-full">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-display font-bold text-[var(--theme-color)] text-glow uppercase tracking-widest">
                    SETTINGS
                  </h2>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setIsSettingsOpen(false)} className="text-[var(--theme-color)]/70 hover:text-[var(--theme-color)] transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <input type="file" ref={globalFolderRef} className="hidden" webkitdirectory="" directory="" onChange={handleGlobalFolderSelect} />
                  <div className="bg-black/50 p-4 border border-[var(--theme-color)]/30">
                    <label className="text-xs font-mono text-[var(--theme-color)]/70 uppercase mb-3 block">COMFYUI HOST</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={hostInput}
                        onChange={(e) => setHostInput(e.target.value)}
                        onBlur={() => updateSettings({ comfyUrl: hostInput })}
                        className="input-tech text-sm w-full p-2"
                        placeholder="ComfyUI Host URL"
                      />
                      <button 
                        onClick={discoverComfyUI}
                        className="text-[var(--theme-color)]/70 hover:text-[var(--theme-color)] hover:box-glow transition-all p-2 border border-[var(--theme-color)]/30 bg-black"
                        title="Scan for ComfyUI"
                      >
                        <Wifi size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/50 p-4 border border-[var(--theme-color)]/30">
                    <label className="text-xs font-mono text-[var(--theme-color)]/70 uppercase mb-3 block">WATCH FOLDER</label>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setPickerState({type: 'watch'}); globalFolderRef.current?.click(); }} className="text-[var(--theme-color)]/70 hover:text-[var(--theme-color)] hover:box-glow transition-all p-2 border border-[var(--theme-color)]/30 bg-black">
                        <FolderOpen size={16} />
                      </button>
                      <input 
                        type="text" 
                        value={folderInput}
                        onChange={(e) => setFolderInput(e.target.value)}
                        onBlur={() => updateSettings({ watchFolder: folderInput })}
                        className="input-tech text-sm w-full p-2"
                        placeholder="./input_images"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isTeamPanelOpen && (
                  <motion.div
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    className="flex-1 bg-black/50 border border-[var(--theme-color)]/30 p-6 relative"
                  >
                    <button 
                      onClick={() => setIsTeamPanelOpen(false)}
                      className="absolute top-4 right-4 text-[var(--theme-color)]/70 hover:text-[var(--theme-color)]"
                    >
                      <X size={18} />
                    </button>

                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-display font-bold text-[var(--theme-color)] text-glow uppercase tracking-widest">Team Dashboard</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[var(--theme-color)]/70 uppercase">Team Mode</span>
                        <button 
                          onClick={() => {
                            const newValue = !isTeamModeEnabled;
                            setIsTeamModeEnabled(newValue);
                            updateSettings({ isTeamModeEnabled: newValue });
                          }}
                          className={`w-8 h-4 rounded-none border border-[var(--theme-color)] transition-colors relative ${isTeamModeEnabled ? 'bg-[var(--theme-color)]' : 'bg-black'}`}
                        >
                          <motion.div 
                            animate={{ x: isTeamModeEnabled ? 16 : 2 }}
                            className={`absolute top-0.5 left-0 w-3 h-3 ${isTeamModeEnabled ? 'bg-black' : 'bg-[var(--theme-color)]'}`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3 bg-black/80 border border-[var(--theme-color)]/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-[var(--theme-color)]/70 uppercase font-bold font-mono">Incoming Work</span>
                          <span className="text-[10px] text-[var(--theme-color)] font-mono">{folderInput || 'Not Set'}</span>
                        </div>
                        <div className="h-1 bg-black border border-[var(--theme-color)]/30 overflow-hidden">
                          <div className="h-full bg-[var(--theme-color)] w-1/3 box-glow" />
                        </div>
                      </div>

                      <p className="text-[10px] text-[var(--theme-color)]/50 font-mono italic leading-relaxed mt-4">
                        // Optimized for distributed teams and standby editors. Enable Team Mode to synchronize workflows across multiple products.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Panel: Configuration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="tech-panel p-6">
            <h2 className="text-sm font-display font-bold uppercase tracking-[0.3em] text-[var(--theme-color)] text-glow mb-6 flex items-center gap-3">
              PARAMETERS
            </h2>

            <div className="space-y-8">
              <div>
                <label className="text-xs font-mono text-[var(--theme-color)]/70 uppercase mb-3 block">MULTIPLIER</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1.5, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ scale: s })}
                      className={`py-3 font-mono text-sm font-bold transition-all border-2 ${
                        status.currentScale === s 
                          ? 'bg-[var(--theme-color)]/20 border-[var(--theme-color)] text-[var(--theme-color)]' 
                          : 'bg-black border-[var(--theme-color)]/30 text-[var(--theme-color)]/50 hover:border-[var(--theme-color)]/70 hover:text-[var(--theme-color)]'
                      }`}
                    >
                      {s}X
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => updateSettings({ watching: !status.isWatching })}
                  className={`w-full py-4 flex items-center justify-center gap-3 font-display font-bold uppercase tracking-[0.2em] transition-all border-2 border-[var(--theme-color)] text-[var(--theme-color)] hover:bg-[var(--theme-color)]/10 hover:box-glow text-glow`}
                >
                  {status.isWatching ? (
                    <>
                      <Square size={18} fill="currentColor" />
                      PAUSE
                    </>
                  ) : (
                    <>
                      <Play size={18} fill="currentColor" />
                      START AUTO
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="tech-panel p-6">
            <h3 className="text-sm font-display font-bold uppercase tracking-[0.3em] text-[var(--theme-color)] text-glow mb-5 flex items-center gap-2">
              TELEMETRY
            </h3>
            <div className="space-y-4 font-mono text-sm">
              <div className="flex justify-between items-center border-b border-[var(--theme-color)]/30 pb-3">
                <span className="text-[var(--theme-color)]/70">NODE STATE</span>
                {status.isConnected ? (
                  <span className="text-[var(--theme-color)] text-glow font-bold">ONLINE</span>
                ) : (
                  <div className="flex flex-col items-end">
                    <span className="text-[#ff003c] font-bold">OFFLINE</span>
                    <span className="text-[10px] text-[#ff003c]">Error - connect to comfy UI!</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-[var(--theme-color)]/70">ACTIVE MODEL</span>
                {status.isConnected ? (
                  <span className="text-[var(--theme-color)]">4x-UltraSharp</span>
                ) : (
                  <span className="text-[#ff003c] font-bold">OFFLINE</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Activity Log */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-black p-2 border border-[var(--theme-color)]/50">
                <Clock size={16} className="text-[var(--theme-color)]" />
              </div>
              <h2 className="text-sm font-display font-bold tracking-[0.3em] text-[var(--theme-color)] text-glow uppercase">DATA STREAM</h2>
            </div>
            <div className="text-xs font-mono text-[var(--theme-color)]/70 uppercase tracking-wider">
              {status.logs.length} EVENTS RECORDED
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 space-y-3 custom-scrollbar">
            <AnimatePresence initial={false}>
              {status.logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--theme-color)]/50">
                  <ImageIcon size={48} strokeWidth={1.5} className="mb-4 opacity-50" />
                  <p className="text-sm font-display uppercase tracking-[0.3em] opacity-70">AWAITING DATA INPUT...</p>
                </div>
              ) : (
                status.logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-black/60 p-4 border-l-2 border-[var(--theme-color)] flex items-start gap-4 font-mono"
                  >
                    <div className={`mt-0.5 ${
                      log.type === 'error' ? 'text-[#ff003c]' : 'text-[var(--theme-color)]'
                    }`}>
                      {log.type === 'error' ? <AlertCircle size={18} /> : 
                       log.type === 'success' ? <CheckCircle2 size={18} /> : 
                       <span className="text-[var(--theme-color)] font-bold">{'>'}</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${log.type === 'error' ? 'text-[#ff003c]' : 'text-[var(--theme-color)]/90'} leading-relaxed`}>{log.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-[var(--theme-color)]/50 uppercase">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`text-xs uppercase tracking-wider ${log.type === 'error' ? 'text-[#ff003c]/70' : 'text-[var(--theme-color)]/50'}`}>
                          // {log.type}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.5);
          border-left: 1px solid color-mix(in srgb, var(--theme-color) 20%, transparent);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--theme-color);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: color-mix(in srgb, var(--theme-color) 80%, white);
        }
      `}</style>
      </div>
    </div>
  );
}
