import React, { useState, useEffect } from 'react';
import { Settings, Folder, Play, Square, Image as ImageIcon, CheckCircle2, AlertCircle, Clock, Globe, Cpu, FolderOpen } from 'lucide-react';
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
  outputFolder: string;
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
        alert('Successfully connected to ComfyUI!');
      } else {
        alert(`Failed to connect: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
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
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-indigo-600 font-medium tracking-widest uppercase text-xs">System Initializing</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-indigo-100">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Cpu size={24} />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-indigo-900">UPSCALE.AUTO</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={testConnection}
              disabled={testingConnection}
              className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            <div className="hidden md:flex items-center bg-gray-100 rounded-full px-4 py-2 border border-gray-200">
              <Globe size={14} className="text-gray-400 mr-2" />
              <input 
                type="text" 
                value={hostInput}
                onChange={(e) => setHostInput(e.target.value)}
                onBlur={() => updateSettings({ comfyUrl: hostInput })}
                className="bg-transparent border-none focus:ring-0 text-sm font-mono w-48 text-gray-600"
                placeholder="ComfyUI Host URL"
              />
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              status.isWatching ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {status.isWatching ? 'Active' : 'Idle'}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel: Configuration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Settings size={16} /> Parameters
            </h2>

            <div className="space-y-8">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-3 block">Upscale Factor</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1.5, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ scale: s })}
                      className={`py-3 rounded-xl font-bold transition-all border-2 ${
                        status.currentScale === s 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                          : 'bg-white border-gray-100 text-gray-600 hover:border-indigo-200'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Watch Directory</label>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2">
                    <FolderOpen size={16} className="text-indigo-500 shrink-0" />
                    <input 
                      type="text" 
                      value={folderInput}
                      onChange={(e) => setFolderInput(e.target.value)}
                      onBlur={() => updateSettings({ watchFolder: folderInput })}
                      className="bg-transparent border-none focus:ring-0 text-xs font-mono w-full text-gray-600"
                      placeholder="./input_images"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => updateSettings({ watching: !status.isWatching })}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all ${
                  status.isWatching 
                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-2 border-rose-200' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200'
                }`}
              >
                {status.isWatching ? (
                  <>
                    <Square size={20} fill="currentColor" />
                    Stop Watcher
                  </>
                ) : (
                  <>
                    <Play size={20} fill="currentColor" />
                    Start Watcher
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-indigo-900 rounded-2xl p-6 text-white overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-4">System Telemetry</h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="opacity-60">COMFY_STATUS:</span>
                  <span className="text-emerald-400 font-bold">READY</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">MODEL_LOADED:</span>
                  <span className="text-indigo-300">4x-UltraSharp</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">LATENCY:</span>
                  <span>24ms</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-10">
              <Cpu size={120} />
            </div>
          </div>
        </div>

        {/* Right Panel: Activity Log */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                <Clock size={18} className="text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800">Activity Stream</h2>
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-gray-200">
              {status.logs.length} Operations
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
            <AnimatePresence initial={false}>
              {status.logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300">
                  <ImageIcon size={80} strokeWidth={1} className="opacity-20" />
                  <p className="font-bold text-sm mt-6 uppercase tracking-[0.2em] opacity-40">Awaiting Input</p>
                </div>
              ) : (
                status.logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4 group hover:border-indigo-200 transition-colors"
                  >
                    <div className={`mt-1 p-2 rounded-xl ${
                      log.type === 'error' ? 'bg-rose-50 text-rose-500' : 
                      log.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 
                      'bg-indigo-50 text-indigo-500'
                    }`}>
                      {log.type === 'error' ? <AlertCircle size={18} /> : 
                       log.type === 'success' ? <CheckCircle2 size={18} /> : 
                       <ImageIcon size={18} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-700 leading-relaxed">{log.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="w-1 h-1 bg-gray-200 rounded-full"></div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                          {log.type}
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
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}</style>
    </div>
  );
}
