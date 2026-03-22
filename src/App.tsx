import React, { useState, useEffect } from 'react';
import { Settings, Folder, Play, Square, Image as ImageIcon, CheckCircle2, AlertCircle, Clock, Globe, Cpu, FolderOpen, Terminal } from 'lucide-react';
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
  logs: LogEntry[];
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostInput, setHostInput] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
      if (!hostInput) setHostInput(data.comfyUrl);
      if (!folderInput) setFolderInput(data.watchFolder);
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

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const updateSettings = async (newSettings: { scale?: number; watching?: boolean; comfyUrl?: string; watchFolder?: string }) => {
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

  if (loading || !status) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-red-900 border-t-red-500 rounded-full animate-spin shadow-[0_0_15px_rgba(255,0,0,0.5)]"></div>
          <div className="text-red-500 font-bold tracking-[0.3em] uppercase text-xs animate-pulse">Initializing Core...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-red-500 font-sans selection:bg-red-900 selection:text-white">
      {/* Top Navigation Bar */}
      <nav className="bg-[#0a0a0a] border-b border-red-900/50 px-6 py-4 sticky top-0 z-50 shadow-[0_4px_20px_rgba(255,0,0,0.1)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-red-950/50 p-2 border border-red-500/30 text-red-500 shadow-[0_0_10px_rgba(255,0,0,0.2)]">
              <Cpu size={24} />
            </div>
            <h1 className="text-2xl font-display font-black tracking-[0.2em] text-red-500 drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]">
              UPSCALE<span className="text-red-800">.AUTO</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={testConnection}
              disabled={testingConnection}
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              {testingConnection ? '> PINGING...' : '> TEST LINK'}
            </button>
            <div className="hidden md:flex items-center bg-[#0a0a0a] px-4 py-2 border border-red-900/50 focus-within:border-red-500/50 transition-colors shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
              <Globe size={14} className="text-red-700 mr-3" />
              <input 
                type="text" 
                value={hostInput}
                onChange={(e) => setHostInput(e.target.value)}
                onBlur={() => updateSettings({ comfyUrl: hostInput })}
                className="bg-transparent border-none focus:ring-0 text-xs font-mono w-56 text-red-400 placeholder-red-900 outline-none"
                placeholder="COMFYUI_HOST_URL"
              />
            </div>
            <div className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] border ${
              status.isWatching 
                ? 'bg-red-950/30 border-red-500 text-red-400 shadow-[0_0_10px_rgba(255,0,0,0.3)] animate-pulse' 
                : 'bg-[#0a0a0a] border-red-900/50 text-red-800'
            }`}>
              {status.isWatching ? 'SYS.ACTIVE' : 'SYS.IDLE'}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel: Configuration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0a0a0a] p-6 border border-red-900/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
            
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-red-600 mb-6 flex items-center gap-3">
              <Settings size={14} /> // PARAMETERS
            </h2>

            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-bold text-red-700 tracking-[0.2em] uppercase mb-3 block">MULTIPLIER</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1.5, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ scale: s })}
                      className={`py-3 font-mono text-sm font-bold transition-all border ${
                        status.currentScale === s 
                          ? 'bg-red-950/50 border-red-500 text-red-400 shadow-[inset_0_0_15px_rgba(255,0,0,0.2)]' 
                          : 'bg-[#050505] border-red-900/30 text-red-800 hover:border-red-700/50'
                      }`}
                    >
                      {s}X
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-[#050505] p-4 border border-red-900/30">
                  <label className="text-[10px] font-bold text-red-700 tracking-[0.2em] uppercase mb-3 block">WATCH_DIR</label>
                  <div className="flex items-center gap-3">
                    <FolderOpen size={16} className="text-red-600 shrink-0" />
                    <input 
                      type="text" 
                      value={folderInput}
                      onChange={(e) => setFolderInput(e.target.value)}
                      onBlur={() => updateSettings({ watchFolder: folderInput })}
                      className="bg-transparent border-none focus:ring-0 text-xs font-mono w-full text-red-400 placeholder-red-900 outline-none"
                      placeholder="./input_images"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => updateSettings({ watching: !status.isWatching })}
                className={`w-full py-4 flex items-center justify-center gap-3 font-bold uppercase tracking-[0.2em] transition-all border ${
                  status.isWatching 
                    ? 'bg-red-950 border-red-500 text-white shadow-[0_0_20px_rgba(255,0,0,0.4)]' 
                    : 'bg-[#0a0a0a] border-red-900 text-red-500 hover:bg-red-950/30 hover:border-red-700'
                }`}
              >
                {status.isWatching ? (
                  <>
                    <Square size={16} fill="currentColor" />
                    HALT_PROCESS
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" />
                    INIT_WATCHER
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-6 border border-red-900/30 relative">
            <div className="absolute top-0 right-0 w-16 h-16 border-t border-r border-red-500/30"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b border-l border-red-500/30"></div>
            
            <div className="relative z-10">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-700 mb-5 flex items-center gap-2">
                <Terminal size={12} /> TELEMETRY
              </h3>
              <div className="space-y-4 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-red-900/30 pb-2">
                  <span className="text-red-800">NODE_STATE</span>
                  <span className="text-red-400 font-bold">ONLINE</span>
                </div>
                <div className="flex justify-between items-center border-b border-red-900/30 pb-2">
                  <span className="text-red-800">ACTIVE_MODEL</span>
                  <span className="text-red-500">4x-UltraSharp</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="text-red-800">UPLINK_PING</span>
                  <span className="text-red-500">24ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Activity Log */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-red-950/30 p-2 border border-red-900/50">
                <Clock size={16} className="text-red-500" />
              </div>
              <h2 className="text-sm font-bold tracking-[0.2em] text-red-500 uppercase">DATA_STREAM</h2>
            </div>
            <div className="text-[10px] font-mono text-red-600 uppercase tracking-[0.2em]">
              [{status.logs.length}] EVENTS_RECORDED
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 space-y-3 custom-scrollbar">
            <AnimatePresence initial={false}>
              {status.logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-red-900/50">
                  <Terminal size={64} strokeWidth={1} className="mb-6 opacity-50" />
                  <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-70">AWAITING_DATA_INPUT...</p>
                </div>
              ) : (
                status.logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-[#0a0a0a] p-4 border border-red-900/30 flex items-start gap-4 group hover:border-red-700/50 transition-colors relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-900/30 group-hover:bg-red-500/50 transition-colors"></div>
                    
                    <div className={`mt-0.5 ${
                      log.type === 'error' ? 'text-red-500' : 
                      log.type === 'success' ? 'text-red-400' : 
                      'text-red-700'
                    }`}>
                      {log.type === 'error' ? <AlertCircle size={16} /> : 
                       log.type === 'success' ? <CheckCircle2 size={16} /> : 
                       <ImageIcon size={16} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-mono text-red-400 leading-relaxed">{log.message}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-[9px] text-red-800 uppercase font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-[9px] text-red-600 uppercase tracking-[0.2em]">
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
          background: #050505;
          border-left: 1px solid rgba(153, 27, 27, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(153, 27, 27, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 68, 68, 0.8);
        }
      `}</style>
    </div>
  );
}
