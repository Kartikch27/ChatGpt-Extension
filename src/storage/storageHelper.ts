import type { ExtensionSettings, QueueState, Job } from '../types';

export const DEFAULT_PROMPT_TEMPLATE = `Generate a professional anatomy infographic.

Movement Name: {{ITEM}}

Requirements:
* White background
* Medical illustration
* Front and rear muscle view
* Scientific labels
* High resolution`;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  concurrentWorkers: 15,
  notificationSound: true,
  autoDownload: true,
  retryLimit: 3,
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  closeTabOnComplete: true,
};

export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...result.settings });
    });
  });
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings: updated }, () => {
      resolve(updated);
    });
  });
}

export async function getQueueState(): Promise<QueueState> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['queueState'], (result) => {
      resolve({
        jobs: [],
        isRunning: false,
        isPaused: false,
        ...result.queueState,
      });
    });
  });
}

export async function saveQueueState(state: QueueState): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ queueState: state }, () => {
      resolve();
    });
  });
}

export function compilePrompt(template: string, job: Omit<Job, 'prompt'>): string {
  return template
    .replace(/\{\{ITEM\}\}/g, job.movementName || 'N/A')
    .replace(/\{\{MOVEMENT_NAME\}\}/g, job.movementName || 'N/A')
    .replace(/\{\{ENGLISH_NAME\}\}/g, job.englishName || 'N/A')
    .replace(/\{\{CATEGORY\}\}/g, job.category || 'N/A')
    .replace(/\{\{TARGET_MUSCLES\}\}/g, job.targetMuscles || 'N/A');
}
