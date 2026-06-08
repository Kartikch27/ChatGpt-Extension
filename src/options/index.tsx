import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Volume2,
  Bell,
  Code,
  Settings,
  HelpCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useQueueState } from '../hooks/useQueueState';
import { DEFAULT_PROMPT_TEMPLATE } from '../storage/storageHelper';
import '../style.css';

export default function Options() {
  const {
    settings,
    loading,
    updateSettings,
    testSound,
    testNotification
  } = useQueueState();

  const [concurrentWorkers, setConcurrentWorkers] = useState(5);
  const [notificationSound, setNotificationSound] = useState(true);
  const [autoDownload, setAutoDownload] = useState(true);
  const [retryLimit, setRetryLimit] = useState(3);
  const [closeTabOnComplete, setCloseTabOnComplete] = useState(true);
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT_TEMPLATE);
  
  const [saving, setSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setConcurrentWorkers(settings.concurrentWorkers);
      setNotificationSound(settings.notificationSound);
      setAutoDownload(settings.autoDownload);
      setRetryLimit(settings.retryLimit);
      setCloseTabOnComplete(settings.closeTabOnComplete);
      setPromptTemplate(settings.promptTemplate);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        concurrentWorkers,
        notificationSound,
        autoDownload,
        retryLimit,
        closeTabOnComplete,
        promptTemplate
      });
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplate = () => {
    if (window.confirm('Are you sure you want to reset the prompt template to its default yoga infographic styling?')) {
      setPromptTemplate(DEFAULT_PROMPT_TEMPLATE);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center space-x-2 text-slate-400">
          <RotateCcw className="w-5 h-5 animate-spin" />
          <span>Loading extension configurations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex justify-center py-10 px-4">
      <div className="w-full max-w-2xl flex flex-col space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-900 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Settings className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Extension Settings</h1>
              <p className="text-xs text-slate-400">Configure Gemini Parallel Workers settings and prompt templates</p>
            </div>
          </div>
        </div>

        {/* Saved Status Toast */}
        {showSavedToast && (
          <div className="bg-emerald-600/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-3 rounded-lg flex items-center justify-between animate-fade-in shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <div className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold">Configuration saved successfully!</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section: Queue Behavior */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 space-y-5">
            <h2 className="text-sm font-bold text-slate-200 border-b border-slate-950 pb-2">Queue & Worker Limits</h2>
            
            {/* Concurrency slider */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-350 flex items-center space-x-1">
                  <span>Concurrent Workers (Tabs)</span>
                  <span className="cursor-help" title="Maximum ChatGPT tabs that will be processed concurrently.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                  </span>
                </label>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                  {concurrentWorkers} Workers
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                value={concurrentWorkers}
                onChange={(e) => setConcurrentWorkers(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1 worker</span>
                <span>15 workers (Max)</span>
              </div>
              {concurrentWorkers > 8 && (
                <div className="bg-amber-600/10 border border-amber-500/20 text-amber-300 p-2.5 rounded-lg flex items-start space-x-2 mt-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="text-[10px] leading-relaxed">
                    Running more than 8 concurrent workers requires significant system memory and increases the risk of Gemini rate-limiting your account.
                  </span>
                </div>
              )}
            </div>

            {/* Retry limit slider */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-350 flex items-center space-x-1">
                  <span>Job Retry Threshold</span>
                  <span className="cursor-help" title="Number of automatic generation retries if Gemini fails or encounters network errors.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                  </span>
                </label>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-900">
                  {retryLimit} Retries
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={retryLimit}
                onChange={(e) => setRetryLimit(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1 retry</span>
                <span>5 retries (Max)</span>
              </div>
            </div>
          </div>

          {/* Section: Automation Controls */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200 border-b border-slate-950 pb-2">Automation Preferences</h2>

            {/* Auto download */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-0.5">
                <span className="text-xs font-semibold text-slate-250">Auto Download Images</span>
                <span className="text-[10px] text-slate-500">Automatically save generated PNGs to your default Downloads folder.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoDownload}
                  onChange={(e) => setAutoDownload(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-slate-100" />
              </label>
            </div>

            {/* Notification Sound */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-0.5">
                <span className="text-xs font-semibold text-slate-250">Notification Sound Chime</span>
                <span className="text-[10px] text-slate-500">Play a pleasant bell sound when a Gemini generation completes.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSound}
                  onChange={(e) => setNotificationSound(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-slate-100" />
              </label>
            </div>

            {/* Close tab on complete */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-0.5">
                <span className="text-xs font-semibold text-slate-250">Close Tab Upon Completion</span>
                <span className="text-[10px] text-slate-500">Automatically close Gemini worker tabs once processing completes or fails.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={closeTabOnComplete}
                  onChange={(e) => setCloseTabOnComplete(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-slate-100" />
              </label>
            </div>

            {/* Diagnostics Actions */}
            <div className="pt-3 border-t border-slate-900/60 flex items-center space-x-3">
              <button
                type="button"
                onClick={testSound}
                className="flex-1 py-1.5 bg-slate-800/80 hover:bg-slate-750 border border-slate-800 text-[10px] font-bold text-slate-300 rounded-lg flex items-center justify-center space-x-1.5 transition-all"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Audio Chime</span>
              </button>
              <button
                type="button"
                onClick={testNotification}
                className="flex-1 py-1.5 bg-slate-800/80 hover:bg-slate-750 border border-slate-800 text-[10px] font-bold text-slate-300 rounded-lg flex items-center justify-center space-x-1.5 transition-all"
              >
                <Bell className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Desktop Alert</span>
              </button>
            </div>
          </div>

          {/* Section: Custom Prompt Template */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-950 pb-2">
              <h2 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span>Prompt Template Compiler</span>
              </h2>
              <button
                type="button"
                onClick={handleResetTemplate}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:underline flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Default</span>
              </button>
            </div>

            {/* Template Variables Info */}
            <div className="bg-slate-950 border border-slate-900 p-3 rounded-lg flex items-start space-x-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-slate-300 leading-normal">
                  Support variables compiled into your Gemini prompts:
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[9px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 border border-emerald-950">{"{{ITEM}}"}</span>
                  <span className="text-[9px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 border border-emerald-950">{"{{MOVEMENT_NAME}}"}</span>
                  <span className="text-[9px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 border border-emerald-950">{"{{ENGLISH_NAME}}"}</span>
                  <span className="text-[9px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 border border-emerald-950">{"{{CATEGORY}}"}</span>
                  <span className="text-[9px] font-mono bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 border border-emerald-950">{"{{TARGET_MUSCLES}}"}</span>
                </div>
              </div>
            </div>

            {/* Template text area */}
            <div className="flex flex-col space-y-1.5">
              <textarea
                rows={11}
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 p-3 rounded-lg text-xs font-mono text-slate-300 focus:border-slate-700 outline-none leading-relaxed"
                placeholder="Enter prompt structure..."
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 shrink-0 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-600 text-xs font-bold text-emerald-50 rounded-lg flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving changes...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
