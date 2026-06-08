import offscreenUrl from 'url:~src/offscreen.html';
import type { Job, ExtensionSettings, QueueState, QueueStats } from '../types';
import { getSettings, saveSettings, getQueueState, saveQueueState, compilePrompt } from '../storage/storageHelper';
import { showNotification } from '../notifications/notificationHelper';
import { downloadImage } from '../downloads/downloadHelper';

// Active job trackers in memory (maps tabId -> jobId)
const activeWorkers = new Map<number, string>();
// Maps jobId -> startTime
const jobStartTime = new Map<string, number>();

// Set up background listeners
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed');
});

// Watch for manual tab closure by the user
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeWorkers.has(tabId)) {
    const jobId = activeWorkers.get(tabId)!;
    console.warn(`[Background] Worker tab ${tabId} for job ${jobId} was closed manually.`);
    handleJobFailure(jobId, 'Tab was closed manually by the user');
  }
});

// Background message orchestrator
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleRuntimeMessage(message, sender, sendResponse);
  return true; // async support
});

// Periodic monitor for timeouts (every 10 seconds)
setInterval(async () => {
  const state = await getQueueState();
  if (!state.isRunning || state.isPaused) return;

  const now = Date.now();
  const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes timeout

  for (const [tabId, jobId] of activeWorkers.entries()) {
    const start = jobStartTime.get(jobId);
    if (start && now - start > TIMEOUT_MS) {
      console.warn(`[Background] Job ${jobId} on tab ${tabId} timed out.`);
      // Close the tab and fail/retry the job
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          // ignore already closed tabs
        }
      });
      handleJobFailure(jobId, 'Image generation timed out after 3 minutes');
    }
  }
}, 10000);

async function handleRuntimeMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (r: any) => void) {
  const settings = await getSettings();
  let state = await getQueueState();

  switch (message.action) {
    case 'START_QUEUE':
      console.log('[Background] Initializing queue with jobs:', message.jobs);
      const newJobs: Job[] = message.jobs.map((j: any, idx: number) => ({
        id: `job_${Date.now()}_${idx}`,
        movementName: j.movementName,
        englishName: j.englishName || '',
        category: j.category || '',
        targetMuscles: j.targetMuscles || '',
        prompt: compilePrompt(settings.promptTemplate, j),
        status: 'pending',
        retryCount: 0,
      }));

      state.jobs = newJobs;
      state.isRunning = true;
      state.isPaused = false;
      await saveQueueState(state);
      broadcastState();
      
      // Begin processing
      processQueue();
      sendResponse({ status: 'started' });
      break;

    case 'PAUSE_QUEUE':
      console.log('[Background] Pausing queue');
      state.isPaused = true;
      await saveQueueState(state);
      broadcastState();
      sendResponse({ status: 'paused' });
      break;

    case 'RESUME_QUEUE':
      console.log('[Background] Resuming queue');
      state.isPaused = false;
      state.isRunning = true;
      await saveQueueState(state);
      broadcastState();
      processQueue();
      sendResponse({ status: 'resumed' });
      break;

    case 'STOP_QUEUE':
      console.log('[Background] Stopping queue');
      // Reset running jobs to pending and close tabs
      state.isRunning = false;
      state.isPaused = false;
      for (const job of state.jobs) {
        if (job.status === 'running') {
          job.status = 'pending';
        }
      }
      await saveQueueState(state);
      
      // Close all worker tabs
      for (const tabId of activeWorkers.keys()) {
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) {}
        });
      }
      activeWorkers.clear();
      jobStartTime.clear();
      
      broadcastState();
      sendResponse({ status: 'stopped' });
      break;

    case 'CLEAR_QUEUE':
      console.log('[Background] Clearing queue');
      // Close any tabs
      for (const tabId of activeWorkers.keys()) {
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) {}
        });
      }
      activeWorkers.clear();
      jobStartTime.clear();

      state.jobs = [];
      state.isRunning = false;
      state.isPaused = false;
      await saveQueueState(state);
      broadcastState();
      sendResponse({ status: 'cleared' });
      break;

    case 'UPDATE_SETTINGS':
      await saveSettings(message.settings);
      broadcastState();
      sendResponse({ status: 'settings_updated' });
      break;

    case 'GET_STATE':
      const stats = calculateStats(state.jobs);
      sendResponse({ state, stats, settings });
      break;

    case 'TEST_SOUND':
      console.log('[Background] Triggering test sound');
      await playNotificationSound();
      sendResponse({ status: 'sound_played' });
      break;

    case 'TEST_NOTIFICATION':
      showNotification('Test Notification', 'Notification working correctly!');
      sendResponse({ status: 'notification_shown' });
      break;

    case 'CONTENT_READY':
      const senderTabId = sender.tab?.id;
      if (senderTabId && activeWorkers.has(senderTabId)) {
        const jobId = activeWorkers.get(senderTabId)!;
        const job = state.jobs.find(j => j.id === jobId);
        if (job && job.status === 'running') {
          console.log(`[Background] Tab ready for job ${jobId}. Injecting prompt...`);
          chrome.tabs.sendMessage(senderTabId, {
            action: 'START_GENERATION',
            prompt: job.prompt
          });
        }
      }
      sendResponse({ status: 'processed' });
      break;

    case 'JOB_COMPLETED':
      const completedTabId = sender.tab?.id;
      if (completedTabId && activeWorkers.has(completedTabId)) {
        const jobId = activeWorkers.get(completedTabId)!;
        console.log(`[Background] Job ${jobId} completed successfully.`);
        
        // Clean up tab tracking first to prevent manual-close trigger
        activeWorkers.delete(completedTabId);
        jobStartTime.delete(jobId);

        // Download and finalize
        await handleJobSuccess(jobId, message.imageUrl);

        // Close tab if configured
        if (settings.closeTabOnComplete) {
          chrome.tabs.remove(completedTabId, () => {
            if (chrome.runtime.lastError) {}
          });
        }
      }
      sendResponse({ status: 'processed' });
      break;

    case 'JOB_FAILED':
      const failedTabId = sender.tab?.id;
      if (failedTabId && activeWorkers.has(failedTabId)) {
        const jobId = activeWorkers.get(failedTabId)!;
        console.error(`[Background] Job ${jobId} failed:`, message.error);
        
        activeWorkers.delete(failedTabId);
        jobStartTime.delete(jobId);

        await handleJobFailure(jobId, message.error);

        if (settings.closeTabOnComplete) {
          chrome.tabs.remove(failedTabId, () => {
            if (chrome.runtime.lastError) {}
          });
        }
      }
      sendResponse({ status: 'processed' });
      break;

    case 'JOB_RATE_LIMITED':
      const limitedTabId = sender.tab?.id;
      if (limitedTabId && activeWorkers.has(limitedTabId)) {
        const jobId = activeWorkers.get(limitedTabId)!;
        console.warn(`[Background] Rate limit triggered on job ${jobId}. Pausing queue.`);
        
        activeWorkers.delete(limitedTabId);
        jobStartTime.delete(jobId);

        // Put job back to pending for retry later
        const state = await getQueueState();
        const job = state.jobs.find(j => j.id === jobId);
        if (job) {
          job.status = 'pending';
        }
        
        // Pause queue
        state.isPaused = true;
        await saveQueueState(state);
        
        // Notify user
        showNotification(
          'Queue Paused (Rate Limit)',
          `Rate limit detected on ChatGPT. The queue has been paused to prevent account flags.`
        );

        if (settings.closeTabOnComplete) {
          chrome.tabs.remove(limitedTabId, () => {
            if (chrome.runtime.lastError) {}
          });
        }

        broadcastState();
      }
      sendResponse({ status: 'processed' });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }
}

async function processQueue() {
  const state = await getQueueState();
  const settings = await getSettings();

  if (!state.isRunning || state.isPaused) {
    console.log('[Background] Queue processing is inactive.');
    return;
  }

  // Count active worker tabs
  const runningJobsCount = activeWorkers.size;
  const availableSlots = settings.concurrentWorkers - runningJobsCount;

  if (availableSlots <= 0) {
    console.log('[Background] Worker pool is full. Waiting...');
    return;
  }

  // Find next pending jobs
  const pendingJobs = state.jobs.filter(j => j.status === 'pending');
  if (pendingJobs.length === 0) {
    // If runningJobsCount is also 0, queue is finished!
    if (runningJobsCount === 0) {
      console.log('[Background] All jobs finished!');
      state.isRunning = false;
      await saveQueueState(state);
      showNotification('Batch Generation Complete', 'All movement images have been generated successfully.');
      broadcastState();
    }
    return;
  }

  // Launch jobs up to available slots
  const jobsToStart = pendingJobs.slice(0, availableSlots);
  for (const job of jobsToStart) {
    job.status = 'running';
    job.startedAt = Date.now();
    
    // Create new ChatGPT tab
    chrome.tabs.create(
      {
        url: 'https://chatgpt.com',
        active: false // Open in background to prevent stealing user focus
      },
      (tab) => {
        if (!tab || tab.id === undefined) {
          console.error('[Background] Failed to create worker tab for job:', job.id);
          job.status = 'failed';
          job.error = 'Failed to create Chrome tab';
          saveQueueState(state).then(broadcastState);
          return;
        }

        activeWorkers.set(tab.id, job.id);
        jobStartTime.set(job.id, Date.now());
        console.log(`[Background] Spawned tab ${tab.id} for job ${job.id}`);
      }
    );
  }

  await saveQueueState(state);
  broadcastState();
}

async function handleJobSuccess(jobId: string, imageUrl: string) {
  const state = await getQueueState();
  const settings = await getSettings();
  const job = state.jobs.find(j => j.id === jobId);

  if (job) {
    job.status = 'completed';
    job.imageUrl = imageUrl;
    job.completedAt = Date.now();
    await saveQueueState(state);

    console.log(`[Background] Finalizing success for ${job.movementName}`);

    // Trigger auto-download if enabled
    if (settings.autoDownload) {
      await downloadImage(imageUrl, job.movementName);
    }

    // Play chime sound
    if (settings.notificationSound) {
      await playNotificationSound();
    }

    // Show desktop notification
    showNotification('Generation Complete', `${job.movementName} completed successfully.`);
  }

  broadcastState();
  
  // Continue queue execution
  processQueue();
}

async function handleJobFailure(jobId: string, error: string) {
  const state = await getQueueState();
  const settings = await getSettings();
  const job = state.jobs.find(j => j.id === jobId);

  if (job) {
    job.retryCount++;
    job.error = error;
    
    if (job.retryCount < settings.retryLimit) {
      console.log(`[Background] Job ${jobId} failed. Retrying (Attempt ${job.retryCount + 1}/${settings.retryLimit})...`);
      job.status = 'pending'; // retry
    } else {
      console.error(`[Background] Job ${jobId} failed completely after ${job.retryCount} retries.`);
      job.status = 'failed';
      
      // Notify user of complete failure
      showNotification('Generation Failed', `Failed to generate image for ${job.movementName}: ${error}`);
    }

    await saveQueueState(state);
  }

  broadcastState();
  processQueue();
}

async function playNotificationSound() {
  try {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (!hasDoc) {
      // Resolve offscreenUrl to pass to createDocument
      await chrome.offscreen.createDocument({
        url: offscreenUrl,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: 'Synthesize notification chime for batch image events',
      });
    }

    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'play-audio',
    });
  } catch (err) {
    console.error('[Background] Audio playback error:', err);
  }
}

function calculateStats(jobs: Job[]): QueueStats {
  const stats: QueueStats = { total: jobs.length, pending: 0, running: 0, completed: 0, failed: 0 };
  for (const j of jobs) {
    if (j.status === 'pending') stats.pending++;
    else if (j.status === 'running') stats.running++;
    else if (j.status === 'completed') stats.completed++;
    else if (j.status === 'failed') stats.failed++;
  }
  return stats;
}

async function broadcastState() {
  const state = await getQueueState();
  const stats = calculateStats(state.jobs);
  const settings = await getSettings();
  
  // Send state update to popup and options
  chrome.runtime.sendMessage({
    action: 'STATE_UPDATED',
    state,
    stats,
    settings,
  }).catch(() => {
    // Ignore error if popup or options page are closed
  });
}
