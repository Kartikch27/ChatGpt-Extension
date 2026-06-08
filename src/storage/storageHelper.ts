import type { ExtensionSettings, QueueState, Job } from '../types';

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
    .replace(/\{\{POSE_NAME\}\}/g, job.movementName || 'N/A')
    .replace(/\{\{MOVEMENT_NAME\}\}/g, job.movementName || 'N/A')
    .replace(/\{\{ENGLISH_NAME\}\}/g, job.englishName || 'N/A')
    .replace(/\{\{CATEGORY\}\}/g, job.category || 'N/A')
    .replace(/\{\{TARGET_MUSCLES\}\}/g, job.targetMuscles || 'N/A');
}
