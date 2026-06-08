import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  Settings,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  Trash2,
  Edit2,
  Save,
  Plus,
  Search,
  FileText,
  AlertCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useQueueState } from '../hooks/useQueueState';
import { extractMovementsFromPDF, type ParsedMovement } from '../pdf/pdfParser';
import '../style.css'; // Load CSS

export default function Popup() {
  const {
    state,
    stats,
    settings,
    loading,
    startQueue,
    pauseQueue,
    resumeQueue,
    stopQueue,
    clearQueue,
    updateSettings
  } = useQueueState();

  // PDF and direct text loader state
  const [inputTab, setInputTab] = useState<'text' | 'pdf'>('text');
  const [pastedText, setPastedText] = useState('');
  const [localWorkers, setLocalWorkers] = useState(15);
  const [localTemplate, setLocalTemplate] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setLocalWorkers(settings.concurrentWorkers);
      setLocalTemplate(settings.promptTemplate);
    }
  }, [settings]);

  const handleLoadPastedJobs = () => {
    const lines = pastedText.split('\n');
    const parsed = lines
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(name => ({
        movementName: name,
        englishName: '',
        category: '',
        targetMuscles: ''
      }));
    
    if (parsed.length === 0) {
      alert('Please enter at least one job name.');
      return;
    }
    setPreviewMovements(parsed);
    setPastedText('');
  };
  const [previewMovements, setPreviewMovements] = useState<ParsedMovement[]>([]);
  const [selectedMovements, setSelectedMovements] = useState<Record<number, boolean>>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<ParsedMovement>({
    movementName: '',
    englishName: '',
    category: '',
    targetMuscles: ''
  });

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');
  
  // New manual entry inputs
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMovement, setNewMovement] = useState<ParsedMovement>({
    movementName: '',
    englishName: '',
    category: '',
    targetMuscles: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill selections when preview is populated
  useEffect(() => {
    const initialSelect: Record<number, boolean> = {};
    previewMovements.forEach((_, idx) => {
      initialSelect[idx] = true;
    });
    setSelectedMovements(initialSelect);
  }, [previewMovements]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    await parsePDF(file);
  };

  const parsePDF = async (file: File) => {
    setParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const extracted = await extractMovementsFromPDF(arrayBuffer);
      setPreviewMovements(extracted);
    } catch (err) {
      console.error('Error parsing PDF:', err);
      alert('Failed to parse PDF. Please verify it is a valid text-based PDF file.');
    } finally {
      setParsing(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Toggle selection
  const toggleSelect = (index: number) => {
    setSelectedMovements(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleAll = () => {
    const allSelected = previewMovements.every((_, idx) => selectedMovements[idx]);
    const nextSelect: Record<number, boolean> = {};
    previewMovements.forEach((_, idx) => {
      nextSelect[idx] = !allSelected;
    });
    setSelectedMovements(nextSelect);
  };

  // Edit movement entry
  const startEditing = (idx: number) => {
    setEditingIndex(idx);
    setEditValues({ ...previewMovements[idx] });
  };

  const saveEdit = (idx: number) => {
    const updated = [...previewMovements];
    updated[idx] = { ...editValues };
    setPreviewMovements(updated);
    setEditingIndex(null);
  };

  const deleteMovement = (idx: number) => {
    const updated = previewMovements.filter((_, i) => i !== idx);
    setPreviewMovements(updated);
  };

  // Add new movement
  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMovement.movementName.trim()) return;
    
    setPreviewMovements(prev => [newMovement, ...prev]);
    setNewMovement({
      movementName: '',
      englishName: '',
      category: '',
      targetMuscles: ''
    });
    setShowAddForm(false);
  };

  // Launch queue
  const handleLaunchQueue = () => {
    const jobsToStart = previewMovements.filter((_, idx) => selectedMovements[idx]);
    if (jobsToStart.length === 0) {
      alert('Please select at least one movement to generate images.');
      return;
    }

    startQueue(jobsToStart);
    // Clear preview state
    setPreviewMovements([]);
    setPdfFile(null);
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  // Compute progress percent
  const progressPercent = stats.total > 0
    ? Math.round(((stats.completed + stats.failed) / stats.total) * 100)
    : 0;

  // Filter movements in preview
  const filteredPreview = previewMovements.filter(m =>
    m.movementName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.targetMuscles.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-[780px] h-[600px] bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between backdrop-blur-md shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
            <FileText className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              Gemini Parallel Workers
            </h1>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${
                state.isRunning && !state.isPaused ? 'bg-emerald-500 animate-pulse' :
                state.isPaused ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'
              }`} />
              <span className="text-xs text-slate-400 font-medium">
                {state.isRunning && !state.isPaused ? 'Active Processing' :
                 state.isPaused ? 'Paused' : 'Queue Idle'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={openOptions}
          className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg transition-all text-slate-300 hover:text-slate-100 flex items-center space-x-1.5"
          title="Open Settings"
        >
          <Settings className="w-4 h-4" />
          <span className="text-xs font-semibold">Settings</span>
        </button>
      </header>

      {/* Main Body Layout */}
      <main className="flex-1 p-6 overflow-y-auto flex flex-col space-y-6">
        
        {/* Active execution status or PDF uploader */}
        {state.isRunning || state.jobs.length > 0 ? (
          /* Execution Panel */
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 backdrop-blur-sm flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Active Queue Progress</span>
              </h2>
              <span className="text-xs font-bold text-slate-400">{progressPercent}% ({stats.completed + stats.failed}/{stats.total})</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-3 pt-2">
              {!state.isPaused && state.isRunning ? (
                <button
                  onClick={pauseQueue}
                  className="flex-1 py-2 bg-amber-600/20 hover:bg-amber-600/30 active:bg-amber-600/20 border border-amber-500/40 hover:border-amber-500/60 rounded-lg text-amber-300 font-semibold text-xs flex items-center justify-center space-x-2 transition-all"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause Processing</span>
                </button>
              ) : state.isPaused && state.isRunning ? (
                <button
                  onClick={resumeQueue}
                  className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 active:bg-emerald-600/20 border border-emerald-500/40 hover:border-emerald-500/60 rounded-lg text-emerald-300 font-semibold text-xs flex items-center justify-center space-x-2 transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume Queue</span>
                </button>
              ) : null}

              {state.isRunning && (
                <button
                  onClick={stopQueue}
                  className="flex-1 py-2 bg-rose-600/20 hover:bg-rose-600/30 active:bg-rose-600/20 border border-rose-500/40 hover:border-rose-500/60 rounded-lg text-rose-300 font-semibold text-xs flex items-center justify-center space-x-2 transition-all"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Workers</span>
                </button>
              )}

              {!state.isRunning && state.jobs.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-750 rounded-lg text-slate-300 font-semibold text-xs flex items-center justify-center space-x-2 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset / Clear Queue</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Split Configuration & Job Loader Panel when idle */
          <div className="grid grid-cols-2 gap-4 shrink-0 min-h-[300px]">
            {/* Left Column: Settings & Prompt Template */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-850 pb-2">
                Configuration Fields
              </h3>
              
              {/* Worker count slider */}
              <div className="flex flex-col space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-350">Worker Count:</span>
                  <span className="font-mono font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                    {localWorkers} Workers
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  value={localWorkers}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setLocalWorkers(val);
                    updateSettings({ concurrentWorkers: val });
                  }}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                />
              </div>

              {/* Prompt Template editor */}
              <div className="flex flex-col space-y-1.5 flex-1">
                <span className="text-xs font-semibold text-slate-350">Prompt Template:</span>
                <textarea
                  value={localTemplate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalTemplate(val);
                    updateSettings({ promptTemplate: val });
                  }}
                  placeholder="Prompt Template (use {{ITEM}} for job name)"
                  className="w-full flex-1 bg-slate-950 border border-slate-850 p-2.5 text-xs rounded-lg font-mono text-slate-300 focus:border-slate-700 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Right Column: Job List Loader */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col space-y-4">
              {/* Tabs header */}
              <div className="flex border-b border-slate-850 pb-2 items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Job List Input
                </h3>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-900">
                  <button
                    type="button"
                    onClick={() => setInputTab('text')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      inputTab === 'text' ? 'bg-emerald-600 text-emerald-50 shadow-inner' : 'text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    Paste Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputTab('pdf')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      inputTab === 'pdf' ? 'bg-emerald-600 text-emerald-50 shadow-inner' : 'text-slate-450 hover:text-slate-200'
                    }`}
                  >
                    Upload PDF
                  </button>
                </div>
              </div>

              {/* Tab Panel: Paste Text */}
              {inputTab === 'text' && (
                <div className="flex flex-col space-y-3 flex-1">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={`Enter job list (one per line). Example:\nSwastikasana\nPadmasana\nVajrasana\nTadasana`}
                    className="w-full flex-1 bg-slate-950 border border-slate-850 p-2.5 text-xs rounded-lg font-mono text-slate-300 focus:border-slate-700 outline-none resize-none leading-relaxed"
                  />
                  <button
                    onClick={handleLoadPastedJobs}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-600 text-emerald-50 font-bold rounded-lg text-xs transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                  >
                    Load Job List
                  </button>
                </div>
              )}

              {/* Tab Panel: Upload PDF */}
              {inputTab === 'pdf' && (
                <div
                  onClick={triggerFileSelect}
                  className="flex-1 border-2 border-dashed border-slate-850 hover:border-emerald-500/40 bg-slate-950/20 hover:bg-emerald-500/[0.01] rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 group"
                >
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-900 flex items-center justify-center group-hover:border-emerald-500/30 transition-all">
                    {parsing ? (
                      <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-all" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      {pdfFile ? pdfFile.name : 'Upload Yoga Movement PDF'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      {parsing ? 'Extracting text and identifying movements...' : 'Click to browse or drag & drop compendium PDF'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-5 gap-3 shrink-0">
          <div className="bg-slate-900/35 border border-slate-850 p-3 rounded-lg flex flex-col shadow-inner">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Jobs</span>
            <span className="text-xl font-black text-slate-300 mt-1">{stats.total}</span>
          </div>
          <div className="bg-slate-900/35 border border-slate-850 p-3 rounded-lg flex flex-col border-l-blue-500/30">
            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-500">Pending</span>
            <span className="text-xl font-black text-blue-400 mt-1">{stats.pending}</span>
          </div>
          <div className="bg-slate-900/35 border border-slate-850 p-3 rounded-lg flex flex-col border-l-amber-500/30">
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500">Running</span>
            <span className="text-xl font-black text-amber-400 mt-1">{stats.running}</span>
          </div>
          <div className="bg-slate-900/35 border border-slate-850 p-3 rounded-lg flex flex-col border-l-emerald-500/30 animate-glow-pulse">
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">Completed</span>
            <span className="text-xl font-black text-emerald-400 mt-1">{stats.completed}</span>
          </div>
          <div className="bg-slate-900/35 border border-slate-850 p-3 rounded-lg flex flex-col border-l-rose-500/30">
            <span className="text-[10px] uppercase tracking-wider font-bold text-rose-500">Failed</span>
            <span className="text-xl font-black text-rose-400 mt-1">{stats.failed}</span>
          </div>
        </div>

        {/* Currently running jobs overview (Visible only when generating) */}
        {state.isRunning && state.jobs.some(j => j.status === 'running') && (
          <div className="flex flex-col space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Workers (Open Tabs)</h3>
            <div className="grid grid-cols-2 gap-3">
              {state.jobs.filter(j => j.status === 'running').map((job) => {
                const elapsed = job.startedAt ? Math.round((Date.now() - job.startedAt) / 1000) : 0;
                return (
                  <div key={job.id} className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-200 truncate">{job.movementName}</p>
                        <p className="text-[10px] text-slate-500 truncate">{job.targetMuscles || 'No muscles defined'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-mono text-slate-300">{elapsed}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview Extracted Table (Available when PDF is uploaded but queue hasn't started) */}
        {previewMovements.length > 0 && !state.isRunning && (
          <div className="flex flex-col space-y-3 flex-1 overflow-hidden min-h-[200px]">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Extracted Preview List ({previewMovements.length})
                </h3>
                <span className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-full font-mono">
                  {previewMovements.filter((_, i) => selectedMovements[i]).length} Selected
                </span>
              </div>

              {/* Search Box */}
              <div className="flex items-center space-x-2 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movement..."
                    className="w-44 pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 focus:border-slate-700 rounded-lg text-xs outline-none text-slate-200"
                  />
                </div>
                
                <button
                  onClick={() => setShowAddForm(p => !p)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-750 text-xs font-semibold text-slate-350 rounded-lg flex items-center space-x-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Manual entry form */}
            {showAddForm && (
              <form onSubmit={handleAddMovement} className="bg-slate-900/50 border border-slate-850 p-4 rounded-xl space-y-3 shrink-0">
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Movement Name *"
                    value={newMovement.movementName}
                    onChange={e => setNewMovement(p => ({ ...p, movementName: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 p-2 text-xs rounded-lg text-slate-200 outline-none focus:border-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="English Name"
                    value={newMovement.englishName}
                    onChange={e => setNewMovement(p => ({ ...p, englishName: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 p-2 text-xs rounded-lg text-slate-200 outline-none focus:border-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={newMovement.category}
                    onChange={e => setNewMovement(p => ({ ...p, category: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 p-2 text-xs rounded-lg text-slate-200 outline-none focus:border-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="Target Muscles"
                    value={newMovement.targetMuscles}
                    onChange={e => setNewMovement(p => ({ ...p, targetMuscles: e.target.value }))}
                    className="bg-slate-950 border border-slate-800 p-2 text-xs rounded-lg text-slate-200 outline-none focus:border-slate-700"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1 bg-slate-800 text-xs text-slate-400 hover:bg-slate-750 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs text-emerald-100 font-semibold rounded-lg"
                  >
                    Add Row
                  </button>
                </div>
              </form>
            )}

            {/* List Table container */}
            <div className="flex-1 border border-slate-900 rounded-xl overflow-hidden flex flex-col bg-slate-900/10 min-h-0">
              <table className="w-full text-left border-collapse flex flex-col min-h-0 h-full">
                {/* Table Head */}
                <thead className="bg-slate-900/60 border-b border-slate-850 shrink-0 flex w-full">
                  <tr className="flex w-full py-2.5 px-4 items-center">
                    <th className="w-10 flex items-center">
                      <input
                        type="checkbox"
                        checked={previewMovements.length > 0 && previewMovements.every((_, idx) => selectedMovements[idx])}
                        onChange={toggleAll}
                        className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="w-40 text-xs font-bold text-slate-400">Movement Name</th>
                    <th className="w-36 text-xs font-bold text-slate-400">English Name</th>
                    <th className="w-28 text-xs font-bold text-slate-400">Category</th>
                    <th className="w-40 text-xs font-bold text-slate-400">Target Muscles</th>
                    <th className="w-16 text-right text-xs font-bold text-slate-400 pr-2">Action</th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="overflow-y-auto divide-y divide-slate-850 flex-1 flex flex-col w-full min-h-0">
                  {filteredPreview.map((movement, idx) => {
                    const previewIdx = previewMovements.indexOf(movement);
                    const isEditing = editingIndex === previewIdx;

                    return (
                      <tr
                        key={previewIdx}
                        className={`flex w-full py-2.5 px-4 items-center transition-all ${
                          selectedMovements[previewIdx] ? 'bg-slate-900/10' : 'opacity-40 hover:opacity-75'
                        }`}
                      >
                        <td className="w-10 flex items-center">
                          <input
                            type="checkbox"
                            checked={!!selectedMovements[previewIdx]}
                            onChange={() => toggleSelect(previewIdx)}
                            className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="w-40 overflow-hidden text-ellipsis pr-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValues.movementName}
                              onChange={e => setEditValues(p => ({ ...p, movementName: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-xs text-slate-200 outline-none"
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-200">{movement.movementName}</span>
                          )}
                        </td>
                        <td className="w-36 overflow-hidden text-ellipsis pr-3 text-slate-350">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValues.englishName}
                              onChange={e => setEditValues(p => ({ ...p, englishName: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-xs text-slate-200 outline-none"
                            />
                          ) : (
                            <span className="text-xs">{movement.englishName || '-'}</span>
                          )}
                        </td>
                        <td className="w-28 overflow-hidden text-ellipsis pr-3 text-slate-400">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValues.category}
                              onChange={e => setEditValues(p => ({ ...p, category: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-xs text-slate-200 outline-none"
                            />
                          ) : (
                            <span className="text-xs">{movement.category || '-'}</span>
                          )}
                        </td>
                        <td className="w-40 overflow-hidden text-ellipsis pr-3 text-emerald-400">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValues.targetMuscles}
                              onChange={e => setEditValues(p => ({ ...p, targetMuscles: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-xs text-slate-200 outline-none"
                            />
                          ) : (
                            <span className="text-xs font-mono">{movement.targetMuscles || '-'}</span>
                          )}
                        </td>
                        <td className="w-16 flex justify-end space-x-1.5 pr-2 shrink-0">
                          {isEditing ? (
                            <button
                              onClick={() => saveEdit(previewIdx)}
                              className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 rounded"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => startEditing(previewIdx)}
                              className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteMovement(previewIdx)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPreview.length === 0 && (
                    <tr className="flex w-full p-8 justify-center items-center text-slate-500 text-xs">
                      <span>No matches found. Clear search or upload file.</span>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Launch queue button */}
            <button
              onClick={handleLaunchQueue}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-600 text-emerald-50 font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] text-xs flex items-center justify-center space-x-2 shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Generation Queue</span>
            </button>
          </div>
        )}

        {/* Existing Jobs List in background (Shown when active queue or completed is active) */}
        {(state.isRunning || state.jobs.length > 0) && previewMovements.length === 0 && (
          <div className="flex flex-col space-y-3 flex-1 overflow-hidden min-h-[200px]">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Queue List ({state.jobs.length})</h3>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-500">Auto Scroll Enabled</span>
              </div>
            </div>

            <div className="flex-1 border border-slate-900 rounded-xl overflow-hidden flex flex-col bg-slate-900/10 min-h-0">
              <div className="overflow-y-auto flex-1 divide-y divide-slate-850 min-h-0">
                {state.jobs.map((job) => (
                  <div key={job.id} className="p-3.5 flex items-center justify-between hover:bg-slate-900/20 transition-all">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        job.status === 'completed' ? 'bg-emerald-500' :
                        job.status === 'failed' ? 'bg-rose-500 animate-pulse' :
                        job.status === 'running' ? 'bg-amber-500 animate-pulse' : 'bg-slate-700'
                      }`} />
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-200 truncate">{job.movementName}</p>
                        <p className="text-[10px] text-slate-500 truncate">{job.targetMuscles || 'No target muscles specified'}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0 pr-1">
                      {job.status === 'completed' && job.imageUrl && (
                        <a
                          href={job.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 text-[10px] font-bold flex items-center space-x-1 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Image</span>
                        </a>
                      )}
                      
                      {job.status === 'failed' && (
                        <div className="flex items-center space-x-1 text-rose-400 text-[10px] font-bold max-w-[150px] truncate" title={job.error}>
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{job.error || 'Failed'}</span>
                        </div>
                      )}

                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        job.status === 'completed' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' :
                        job.status === 'failed' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/40' :
                        job.status === 'running' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/40' :
                        'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}>
                        {job.status === 'running' ? `Running (Retry ${job.retryCount})` : job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State when queue is empty and no file is loaded */}
        {previewMovements.length === 0 && state.jobs.length === 0 && !parsing && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 bg-slate-900/10 border border-slate-900/60 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-350">No Active Jobs</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Please paste a custom job list or upload a PDF document above to start.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
