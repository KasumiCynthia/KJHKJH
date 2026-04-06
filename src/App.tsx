import React, { useState, useEffect, useRef } from 'react';
import { Folder, Play, Square, Image as ImageIcon, CheckCircle2, AlertCircle, Clock, Globe, FolderOpen, Wifi, Settings, X, ArrowRight, LayoutGrid } from 'lucide-react';
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
  sendFolders: { path: string, filter: string }[];
  outputFolders: { id: string, path: string, sources: boolean[] }[];
  isTeamModeEnabled: boolean;
  logs: LogEntry[];
  isConnected: boolean;
}

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [hostInput, setHostInput] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [sendFoldersInput, setSendFoldersInput] = useState<{ path: string, filter: string }[]>(Array.from({ length: 10 }, () => ({ path: '', filter: '' })));
  const [outputFoldersInput, setOutputFoldersInput] = useState<{ id: string, path: string, sources: boolean[] }[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsPanelStep, setSettingsPanelStep] = useState(0);
  const [isTeamPanelOpen, setIsTeamPanelOpen] = useState(false);
  const [isTeamModeEnabled, setIsTeamModeEnabled] = useState(false);
  const watchFolderRef = useRef<HTMLInputElement>(null);
  const globalFolderRef = useRef<HTMLInputElement>(null);
  const [pickerState, setPickerState] = useState<{type: 'send'|'output'|'watch', index?: number} | null>(null);

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
        if (data.sendFolders && data.sendFolders.length > 0) {
          const formatted = data.sendFolders.map((f: any) => typeof f === 'string' ? { path: f, filter: '' } : f);
          setSendFoldersInput(formatted);
        }
        if (data.outputFolders) setOutputFoldersInput(data.outputFolders);
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

  const updateSettings = async (newSettings: { scale?: number; watching?: boolean; comfyUrl?: string; watchFolder?: string; sendFolders?: { path: string, filter: string }[]; outputFolders?: any[]; isTeamModeEnabled?: boolean }) => {
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
      } else if (pickerState.type === 'send' && pickerState.index !== undefined) {
        const newFolders = [...sendFoldersInput];
        newFolders[pickerState.index].path = path;
        setSendFoldersInput(newFolders);
      } else if (pickerState.type === 'output' && pickerState.index !== undefined) {
        const newOutputs = [...outputFoldersInput];
        newOutputs[pickerState.index].path = path;
        setOutputFoldersInput(newOutputs);
      }
    }
    if (globalFolderRef.current) globalFolderRef.current.value = '';
  };

  if (loading || !status) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-neutral-800 border-t-red-500 rounded-full animate-spin"></div>
          <div className="text-neutral-400 font-medium tracking-widest uppercase text-xs">Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans selection:bg-red-900/50 selection:text-white">
      {/* Top Navigation Bar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold tracking-wide text-neutral-100">
              UPSCALE AUTO
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="text-neutral-400 hover:text-white transition-colors bg-neutral-900 border border-neutral-800 p-2 rounded-md hover:border-neutral-600"
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
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl flex gap-6 overflow-hidden"
            >
              <div className={isTeamPanelOpen ? 'w-[340px] shrink-0' : 'w-full'}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-neutral-100 uppercase tracking-widest">
                    {settingsPanelStep === 0 ? 'INCOMING WORK' : settingsPanelStep === 1 ? 'WORK TO GRAB' : 'OUTPUT FOLDER'}
                  </h2>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setSettingsPanelStep((prev) => (prev + 1) % 3)} className="text-neutral-400 hover:text-white">
                      <ArrowRight size={20} />
                    </button>
                    <button onClick={() => setIsSettingsOpen(false)} className="text-neutral-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <input type="file" ref={globalFolderRef} className="hidden" webkitdirectory="" directory="" onChange={handleGlobalFolderSelect} />
                  <div className="bg-neutral-950 rounded-lg p-4 border border-neutral-800">
                    <label className="text-xs font-medium text-neutral-500 uppercase mb-3 block">COMFYUI HOST</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" 
                        value={hostInput}
                        onChange={(e) => setHostInput(e.target.value)}
                        onBlur={() => updateSettings({ comfyUrl: hostInput })}
                        className="bg-transparent border-none focus:ring-0 text-sm w-full text-neutral-300 placeholder-neutral-700 outline-none"
                        placeholder="ComfyUI Host URL"
                      />
                      <button 
                        onClick={discoverComfyUI}
                        className="text-neutral-400 hover:text-red-400 transition-colors p-1"
                        title="Scan for ComfyUI"
                      >
                        <Wifi size={16} />
                      </button>
                    </div>
                  </div>

                  {settingsPanelStep === 0 && (
                    <div className="bg-neutral-950 rounded-lg p-4 border border-neutral-800">
                      <label className="text-xs font-medium text-neutral-500 uppercase mb-3 block">WATCH FOLDER</label>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setPickerState({type: 'watch'}); globalFolderRef.current?.click(); }} className="text-neutral-500 hover:text-neutral-300">
                          <FolderOpen size={16} />
                        </button>
                        <input 
                          type="text" 
                          value={folderInput}
                          onChange={(e) => setFolderInput(e.target.value)}
                          onBlur={() => updateSettings({ watchFolder: folderInput })}
                          className="bg-transparent border-none focus:ring-0 text-sm w-full text-neutral-300 placeholder-neutral-700 outline-none"
                          placeholder="./input_images"
                        />
                      </div>
                    </div>
                  )}
                  {settingsPanelStep === 1 && (
                    <div className="bg-neutral-950 rounded-lg p-4 border border-neutral-800 flex flex-col h-full">
                      <label className="text-xs font-medium text-neutral-500 uppercase mb-3 block">WORK TO GRAB (10 SLOTS)</label>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 flex-1">
                        {sendFoldersInput.map((folder, index) => (
                          <div key={index} className="flex flex-col gap-2 bg-neutral-900 p-3 rounded border border-neutral-800">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-neutral-500 w-4 text-center">{index + 1}</span>
                              <button onClick={() => { setPickerState({type: 'send', index}); globalFolderRef.current?.click(); }} className="text-neutral-500 hover:text-neutral-300">
                                <FolderOpen size={14} />
                              </button>
                              <input
                                type="text"
                                value={folder.path}
                                onChange={(e) => {
                                  const newFolders = [...sendFoldersInput];
                                  newFolders[index].path = e.target.value;
                                  setSendFoldersInput(newFolders);
                                }}
                                className="bg-transparent border-none focus:ring-0 text-xs w-full text-neutral-300 placeholder-neutral-700 outline-none"
                                placeholder={`Folder ${index + 1} path`}
                              />
                            </div>
                            <div className="flex items-center gap-3 pl-8">
                              <input
                                type="text"
                                value={folder.filter}
                                onChange={(e) => {
                                  const newFolders = [...sendFoldersInput];
                                  newFolders[index].filter = e.target.value;
                                  setSendFoldersInput(newFolders);
                                }}
                                className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 focus:ring-1 focus:ring-neutral-700 text-xs w-full text-neutral-300 placeholder-neutral-700 outline-none transition-all"
                                placeholder="e.g. Peanut Butter.txt (Optional)"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
                        <button
                          onClick={() => updateSettings({ sendFolders: sendFoldersInput })}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-widest py-2 px-6 rounded transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                  {settingsPanelStep === 2 && (
                    <div className="bg-neutral-950 rounded-lg p-4 border border-neutral-800 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-medium text-neutral-500 uppercase block">OUTPUT FOLDERS</label>
                        <button 
                          onClick={() => setIsTeamPanelOpen(true)}
                          className="text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                          <LayoutGrid size={16} />
                        </button>
                      </div>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 flex-1">
                        {outputFoldersInput.map((output, outIndex) => (
                          <div key={output.id} className="bg-neutral-900 rounded p-3 border border-neutral-800 space-y-3">
                            <div className="flex items-center gap-3">
                              <button onClick={() => { setPickerState({type: 'output', index: outIndex}); globalFolderRef.current?.click(); }} className="text-neutral-500 hover:text-neutral-300">
                                <FolderOpen size={14} />
                              </button>
                              <input
                                type="text"
                                value={output.path}
                                onChange={(e) => {
                                  const newOutputs = [...outputFoldersInput];
                                  newOutputs[outIndex].path = e.target.value;
                                  setOutputFoldersInput(newOutputs);
                                }}
                                className="bg-transparent border-none focus:ring-0 text-xs w-full text-neutral-300 placeholder-neutral-700 outline-none"
                                placeholder="Output folder path"
                              />
                              <button onClick={() => {
                                const newOutputs = outputFoldersInput.filter((_, i) => i !== outIndex);
                                setOutputFoldersInput(newOutputs);
                              }} className="text-neutral-500 hover:text-red-400">
                                <X size={14} />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap bg-neutral-950 p-2 rounded border border-neutral-800">
                              <span className="text-[9px] text-neutral-500 uppercase w-full mb-1">Grab Sources (1-10):</span>
                              {output.sources.map((isChecked, srcIndex) => (
                                <label key={srcIndex} className="flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const newOutputs = [...outputFoldersInput];
                                      newOutputs[outIndex].sources[srcIndex] = e.target.checked;
                                      setOutputFoldersInput(newOutputs);
                                    }}
                                    className="w-3 h-3 rounded-sm border-neutral-700 bg-neutral-900 text-red-500 focus:ring-red-500 focus:ring-offset-neutral-950"
                                  />
                                  <span className="text-[10px] text-neutral-400">{srcIndex + 1}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newOutputs = [...outputFoldersInput, { id: Date.now().toString(), path: '', sources: Array(10).fill(false) }];
                            setOutputFoldersInput(newOutputs);
                          }}
                          className="w-full py-2 rounded border border-dashed border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 transition-colors text-[10px] font-bold uppercase tracking-widest"
                        >
                          + Add Output Slot
                        </button>
                      </div>
                      <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
                        <button
                          onClick={() => updateSettings({ outputFolders: outputFoldersInput })}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-widest py-2 px-6 rounded transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isTeamPanelOpen && (
                  <motion.div
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    className="flex-1 bg-neutral-950 rounded-lg border border-neutral-800 p-6 relative"
                  >
                    <button 
                      onClick={() => setIsTeamPanelOpen(false)}
                      className="absolute top-4 right-4 text-neutral-500 hover:text-white"
                    >
                      <X size={18} />
                    </button>

                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-widest">Team Dashboard</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-neutral-500 uppercase">Team Mode</span>
                        <button 
                          onClick={() => {
                            const newValue = !isTeamModeEnabled;
                            setIsTeamModeEnabled(newValue);
                            updateSettings({ isTeamModeEnabled: newValue });
                          }}
                          className={`w-8 h-4 rounded-full transition-colors relative ${isTeamModeEnabled ? 'bg-red-500' : 'bg-neutral-800'}`}
                        >
                          <motion.div 
                            animate={{ x: isTeamModeEnabled ? 16 : 2 }}
                            className="absolute top-1 left-0 w-2 h-2 bg-white rounded-full"
                          />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3 bg-neutral-900 rounded border border-neutral-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold">Incoming Work</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{folderInput || 'Not Set'}</span>
                        </div>
                        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-neutral-600 w-1/3" />
                        </div>
                      </div>

                      <div className="p-3 bg-neutral-900 rounded border border-neutral-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold">Work To Grab</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{sendFoldersInput.filter(f => f.path.trim() !== '').length} Folders</span>
                        </div>
                        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-neutral-600" style={{ width: `${(sendFoldersInput.filter(f => f.path.trim() !== '').length / 10) * 100}%` }} />
                        </div>
                      </div>

                      <div className="p-3 bg-neutral-900 rounded border border-neutral-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-neutral-500 uppercase font-bold">Output Folders</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{outputFoldersInput.filter(f => f.path.trim() !== '').length} Folders</span>
                        </div>
                        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 w-3/4" />
                        </div>
                      </div>

                      <p className="text-[10px] text-neutral-600 italic leading-relaxed mt-4">
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

      <main className="max-w-7xl mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Panel: Configuration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-3">
              PARAMETERS
            </h2>

            <div className="space-y-8">
              <div>
                <label className="text-xs font-medium text-neutral-500 uppercase mb-3 block">MULTIPLIER</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1.5, 2, 4].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateSettings({ scale: s })}
                      className={`py-3 rounded-lg text-sm font-medium transition-all border ${
                        status.currentScale === s 
                          ? 'bg-red-500/10 border-red-500 text-red-400' 
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {s}X
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => updateSettings({ watching: !status.isWatching })}
                className={`w-full py-4 rounded-lg flex items-center justify-center gap-3 font-medium uppercase tracking-wider transition-all border ${
                  status.isWatching 
                    ? 'bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20' 
                    : 'bg-neutral-100 border-neutral-100 text-neutral-900 hover:bg-white'
                }`}
              >
                {status.isWatching ? (
                  <>
                    <Square size={18} fill="currentColor" />
                    PAUSE
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" />
                    Start Auto
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-5 flex items-center gap-2">
              TELEMETRY
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                <span className="text-neutral-500">NODE STATE</span>
                {status.isConnected ? (
                  <span className="text-emerald-400 font-medium">ONLINE</span>
                ) : (
                  <div className="flex flex-col items-end">
                    <span className="text-red-500 font-medium">OFFLINE</span>
                    <span className="text-[10px] text-red-500">Error - connect to comfy UI!</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-neutral-500">ACTIVE MODEL</span>
                {status.isConnected ? (
                  <span className="text-neutral-300">4x-UltraSharp</span>
                ) : (
                  <span className="text-red-500 font-medium">OFFLINE</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Activity Log */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                <Clock size={16} className="text-neutral-400" />
              </div>
              <h2 className="text-sm font-bold tracking-widest text-neutral-300 uppercase">DATA STREAM</h2>
            </div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider">
              {status.logs.length} EVENTS RECORDED
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 space-y-3 custom-scrollbar">
            <AnimatePresence initial={false}>
              {status.logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-600">
                  <ImageIcon size={48} strokeWidth={1.5} className="mb-4 opacity-50" />
                  <p className="text-sm uppercase tracking-widest opacity-70">AWAITING DATA INPUT...</p>
                </div>
              ) : (
                status.logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 flex items-start gap-4"
                  >
                    <div className={`mt-0.5 ${
                      log.type === 'error' ? 'text-red-400' : 
                      log.type === 'success' ? 'text-emerald-400' : 
                      'text-neutral-400'
                    }`}>
                      {log.type === 'error' ? <AlertCircle size={18} /> : 
                       log.type === 'success' ? <CheckCircle2 size={18} /> : 
                       <ImageIcon size={18} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-neutral-300 leading-relaxed">{log.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-neutral-500 uppercase">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-xs text-neutral-600 uppercase tracking-wider">
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
          background: #262626;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #404040;
        }
      `}</style>
    </div>
  );
}
