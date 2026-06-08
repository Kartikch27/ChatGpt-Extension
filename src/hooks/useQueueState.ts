import { useState, useEffect, useCallback } from 'react';
import type { QueueState, QueueStats, ExtensionSettings } from '../types';
import { DEFAULT_SETTINGS } from '../storage/storageHelper';

const INITIAL_STATS: QueueStats = {
  total: 0,
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
};

const INITIAL_STATE: QueueState = {
  jobs: [],
  isRunning: false,
  isPaused: false,
};

export function useQueueState() {
  const [state, setState] = useState<QueueState>(INITIAL_STATE);
  const [stats, setStats] = useState<QueueStats>(INITIAL_STATS);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Sync state from background
  const syncState = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Could not connect to background service worker:', chrome.runtime.lastError.message);
        return;
      }
      if (response) {
        if (response.state) setState(response.state);
        if (response.stats) setStats(response.stats);
        if (response.settings) setSettings(response.settings);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    syncState();

    // Listen for broadcasted queue state updates
    const listener = (message: any) => {
      if (message.action === 'STATE_UPDATED') {
        if (message.state) setState(message.state);
        if (message.stats) setStats(message.stats);
        if (message.settings) setSettings(message.settings);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [syncState]);

  const startQueue = useCallback((jobs: any[]) => {
    chrome.runtime.sendMessage({ action: 'START_QUEUE', jobs }, () => {
      syncState();
    });
  }, [syncState]);

  const pauseQueue = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'PAUSE_QUEUE' }, () => {
      syncState();
    });
  }, [syncState]);

  const resumeQueue = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'RESUME_QUEUE' }, () => {
      syncState();
    });
  }, [syncState]);

  const stopQueue = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'STOP_QUEUE' }, () => {
      syncState();
    });
  }, [syncState]);

  const clearQueue = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'CLEAR_QUEUE' }, () => {
      syncState();
    });
  }, [syncState]);

  const updateSettings = useCallback((updatedSettings: Partial<ExtensionSettings>) => {
    chrome.runtime.sendMessage({ action: 'UPDATE_SETTINGS', settings: updatedSettings }, () => {
      syncState();
    });
  }, [syncState]);

  const testSound = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'TEST_SOUND' });
  }, []);

  const testNotification = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'TEST_NOTIFICATION' });
  }, []);

  return {
    state,
    stats,
    settings,
    loading,
    startQueue,
    pauseQueue,
    resumeQueue,
    stopQueue,
    clearQueue,
    updateSettings,
    testSound,
    testNotification,
    refetch: syncState,
  };
}
