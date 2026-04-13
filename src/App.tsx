import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Image as ImageIcon, CheckCircle2, AlertCircle, Clock, Wifi, Settings, X } from 'lucide-react';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false);
  const [isTeamModeEnabled, setIsTeamModeEnabled] = useState(false);

  const isSettingsOpenRef = useRef(isSettingsOpen);
  useEffect(() => {
    isSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
      
      if (!isSettingsOpenRef.current) {
        if (!hostInput) setHostInput(data.comfyUrl);
        setIsTeamModeEnabled(data.isTeamModeEnabled);
      }
    } catch (err) {
      console.error('Failed to fetch status', err);
    } finally {
      setLoading(false);
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

  const updateSettings = async (newSettings: { scale?: number; watching?: boolean; comfyUrl?: string; isTeamModeEnabled?: boolean }) => {
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-zinc-800 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="text-zinc-400 font-medium text-sm">Loading application...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/30 relative overflow-hidden">
      <div className="relative z-10">
        {/* Top Navigation Bar */}
        <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur px-6 py-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-zinc-100">
                Upscale Auto
              </h1>
            </div>
            
            <div className="flex items-center gap-4 relative">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-zinc-400 hover:text-zinc-100 transition-colors p-2 rounded-md hover:bg-zinc-800"
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
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                width: isTeamPanelOpen ? '840px' : '448px'
              }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 flex gap-6 overflow-hidden"
            >
              <div className="w-full">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Settings
                  </h2>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-zinc-100 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400 block">ComfyUI Host</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={hostInput}
                        onChange={(e) => setHostInput(e.target.value)}
                        onBlur={() => updateSettings({ comfyUrl: hostInput })}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg text-sm w-full p-2.5 text-zinc-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        placeholder="ComfyUI Host URL"
                      />
                      <button 
                        onClick={discoverComfyUI}
                        className="text-zinc-400 hover:text-zinc-100 transition-colors p-2.5 border border-zinc-800 rounded-lg bg-zinc-950 hover:bg-zinc-800"
                        title="Scan for ComfyUI"
                      >
                        <Wifi size={16} />
                      </button>
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
                    className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-lg p-6 relative"
                  >
                    <button 
                      onClick={() => setIsTeamPanelOpen(false)}
                      className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300"
                    >
                      <X size={18} />
                    </button>

                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-semibold text-zinc-100">Team Dashboard</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Team Mode</span>
                        <button 
                          onClick={() => {
                            const newValue = !isTeamModeEnabled;
                            setIsTeamModeEnabled(newValue);
                            updateSettings({ isTeamModeEnabled: newValue });
                          }}
                          className={`w-10 h-5 rounded-full transition-colors relative ${isTeamModeEnabled ? 'bg-blue-500' : 'bg-zinc-700'}`}
                        >
                          <motion.div 
                            animate={{ x: isTeamModeEnabled ? 22 : 2 }}
                            className={`absolute top-0.5 left-0 w-4 h-4 rounded-full bg-white shadow-sm`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-zinc-400 font-medium">Incoming Work</span>
                          <span className="text-xs text-zinc-300 font-mono">{status.watchFolder || 'Not Set'}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 w-1/3 rounded-full" />
                        </div>
                      </div>

                      <p className="text-xs text-zinc-500 leading-relaxed mt-4">
                        Optimized for distributed teams and standby editors. Enable Team Mode to synchronize workflows across multiple products.
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-100 mb-6 flex items-center gap-2">
              Parameters
            </h2>

            <div className="space-y-8">
              <div>
                <label className="text-sm font-medium text-zinc-400 mb-3 block">Multiplier</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1.5, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ scale: s })}
                      className={`py-2.5 text-sm font-medium transition-all rounded-lg border ${
                        status.currentScale === s 
                          ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => updateSettings({ watching: !status.isWatching })}
                  className={`w-full py-3 flex items-center justify-center gap-2 font-medium transition-all rounded-lg border ${
                    status.isWatching
                      ? 'bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20'
                      : 'bg-blue-500/10 border-blue-500/50 text-blue-500 hover:bg-blue-500/20'
                  }`}
                >
                  {status.isWatching ? (
                    <>
                      <Square size={18} />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Start Auto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-100 mb-5 flex items-center gap-2">
              Telemetry
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <span className="text-zinc-400">Node State</span>
                {status.isConnected ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Online</span>
                ) : (
                  <div className="flex flex-col items-end">
                    <span className="text-red-400 font-medium flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400"></div> Offline</span>
                    <span className="text-xs text-red-400/70 mt-1">Connection error</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-zinc-400">Active Model</span>
                {status.isConnected ? (
                  <span className="text-zinc-100 font-medium">4x-UltraSharp</span>
                ) : (
                  <span className="text-zinc-600 font-medium">Offline</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Activity Log */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-zinc-900 p-2 border border-zinc-800 rounded-lg">
                <Clock size={16} className="text-zinc-400" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-100">Data Stream</h2>
            </div>
            <div className="text-xs font-medium text-zinc-500">
              {status.logs.length} Events Recorded
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 space-y-3 custom-scrollbar">
            <AnimatePresence initial={false}>
              {status.logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                  <ImageIcon size={48} strokeWidth={1.5} className="mb-4 opacity-50" />
                  <p className="text-sm font-medium">Awaiting data input...</p>
                </div>
              ) : (
                status.logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-900/50 p-4 border border-zinc-800/50 rounded-lg flex items-start gap-4"
                  >
                    <div className={`mt-0.5 ${
                      log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-blue-400'
                    }`}>
                      {log.type === 'error' ? <AlertCircle size={18} /> : 
                       log.type === 'success' ? <CheckCircle2 size={18} /> : 
                       <span className="font-bold text-lg leading-none">›</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${log.type === 'error' ? 'text-red-400' : 'text-zinc-300'} leading-relaxed`}>{log.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-zinc-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`text-xs font-medium ${log.type === 'error' ? 'text-red-400/70' : 'text-zinc-500'}`}>
                          {log.type.toUpperCase()}
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
      </div>
    </div>
  );
}
