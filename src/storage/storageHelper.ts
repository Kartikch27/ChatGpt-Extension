import type { ExtensionSettings, QueueState, Job, LogEntry } from '../types';

export const DEFAULT_PROMPT_TEMPLATE = `# Gemini Anatomy Infographic Master Prompt

Generate a PREMIUM FITNESS ANATOMY INFOGRAPHIC for the yoga pose:

{{POSE_NAME}}

IMPORTANT STYLE REQUIREMENTS:

Use the visual style of a modern sports science anatomy poster, NOT a medical textbook page.

LAYOUT:

* One large central hero figure occupying 60-70% of the canvas
* Front view as the primary image
* Rear view inset panel in the top-right corner
* Side view inset panel in the bottom-right corner
* Large bold title at the top
* Minimal, clean infographic layout
* White/light gray premium background
* Modern blue accent colors
* Professional fitness poster design

ANATOMY STYLE:

* Highly detailed 3D muscular anatomy render
* Athletic male anatomy model
* Realistic muscle fiber detail
* Scientific accuracy
* Clean muscle separation
* Muscles rendered in grayscale

TARGET MUSCLES:

Highlight only the primary muscles engaged in:

{{POSE_NAME}}

Highlighted muscles must:

* Glow bright red
* Have soft red gradients
* Stand out strongly from the grayscale anatomy
* Be clearly visible from all views

LABELING STYLE:

Use callout lines with labels pointing to:

* Primary target muscles
* Secondary stabilizing muscles
* Postural muscles

Labels should be:

* Large
* Easy to read
* Modern infographic style

INFOGRAPHIC PANELS:

Top Left Panel:

Targets:
✓ Primary muscle 1
✓ Primary muscle 2
✓ Primary muscle 3

Bottom Center Panel:

Benefits:
✓ Benefit 1
✓ Benefit 2
✓ Benefit 3
✓ Benefit 4

Bottom Left Legend:

Red = Target Muscles

VISUAL QUALITY:

* Ultra high resolution
* Professional anatomy illustration
* Fitness education poster
* Sports science infographic
* Premium medical visualization
* Commercial infographic quality
* Clean typography
* No clutter
* No textbook layout
* No long paragraphs
* No excessive explanations

NEGATIVE REQUIREMENTS:

DO NOT create:

* Medical textbook pages
* Hospital posters
* Academic anatomy charts
* Female anatomy standing diagrams
* Multi-column educational documents
* Dense text sections
* Large instruction blocks
* Overcrowded layouts

INSTEAD create:

A premium gym-quality anatomy infographic similar to elite fitness education materials with a large hero anatomy render and bright red highlighted muscles.`;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  concurrentWorkers: 1,
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
  const primaryInput = job.movementName || '';
  
  // 1. Replace the specific fields first
  let compiled = template
    .replace(/\{+ENGLISH_NAME\}+/gi, job.englishName || '')
    .replace(/\{+CATEGORY\}+/gi, job.category || '')
    .replace(/\{+TARGET_MUSCLES\}+/gi, job.targetMuscles || '');
    
  // 2. Replace ANY other custom bracketed variable (e.g. {digit}, {{pose}}, {anything}) with the primary input
  compiled = compiled.replace(/\{+([a-zA-Z0-9_\-]+)\}+/g, (match, varName) => {
    const upperVar = varName.toUpperCase();
    if (upperVar === 'ENGLISH_NAME' || upperVar === 'CATEGORY' || upperVar === 'TARGET_MUSCLES') {
      return '';
    }
    return primaryInput;
  });

  return compiled;
}

export async function getLogs(): Promise<LogEntry[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['logs'], (result) => {
        resolve(result.logs || []);
      });
    } catch (e) {
      console.warn('Failed to get logs:', e);
      resolve([]);
    }
  });
}

export async function addLog(type: 'info' | 'warn' | 'error', message: string): Promise<void> {
  try {
    const logs = await getLogs();
    const newLog: LogEntry = { timestamp: Date.now(), type, message };
    logs.unshift(newLog); // Newest first
    if (logs.length > 200) {
      logs.length = 200; // Limit log history size
    }
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ logs }, () => {
          try {
            chrome.runtime.sendMessage({ action: 'LOGS_UPDATED', logs }, () => {
              if (chrome.runtime.lastError) {
                // Ignore "Receiving end does not exist" when popup is closed
              }
            });
          } catch (e) {
            // Ignore synchronous sendMessage errors when channel is closed
          }
          resolve();
        });
      } catch (err) {
        console.warn('Failed to set logs in storage:', err);
        resolve();
      }
    });
  } catch (err) {
    console.error('Error in addLog helper:', err);
  }
}

export async function clearLogs(): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ logs: [] }, () => {
        try {
          chrome.runtime.sendMessage({ action: 'LOGS_UPDATED', logs: [] }, () => {
            if (chrome.runtime.lastError) {
              // Ignore
            }
          });
        } catch (e) {
          // Ignore
        }
        resolve();
      });
    } catch (err) {
      console.warn('Failed to clear logs in storage:', err);
      resolve();
    }
  });
}
