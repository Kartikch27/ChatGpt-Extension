export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  movementName: string;
  englishName: string;
  category: string;
  targetMuscles: string;
  prompt: string;
  status: JobStatus;
  retryCount: number;
  error?: string;
  tabId?: number;
  imageUrl?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ExtensionSettings {
  concurrentWorkers: number;
  notificationSound: boolean;
  autoDownload: boolean;
  retryLimit: number;
  promptTemplate: string;
  closeTabOnComplete: boolean;
}

export interface QueueState {
  jobs: Job[];
  isRunning: boolean;
  isPaused: boolean;
}

export interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export type ExtensionMessage =
  | { action: 'START_QUEUE'; jobs: Omit<Job, 'id' | 'status' | 'retryCount' | 'prompt'>[] }
  | { action: 'PAUSE_QUEUE' }
  | { action: 'RESUME_QUEUE' }
  | { action: 'STOP_QUEUE' }
  | { action: 'CLEAR_QUEUE' }
  | { action: 'UPDATE_SETTINGS'; settings: Partial<ExtensionSettings> }
  | { action: 'GET_STATE' }
  | { action: 'TEST_SOUND' }
  | { action: 'TEST_NOTIFICATION' }
  | { action: 'CONTENT_READY' }
  | { action: 'JOB_COMPLETED'; imageUrl: string }
  | { action: 'JOB_FAILED'; error: string }
  | { action: 'JOB_RATE_LIMITED' }
  | { action: 'DOWNLOAD_COMPLETE'; success: boolean; error?: string }
  | { action: 'STATE_UPDATED'; state: QueueState; stats: QueueStats; settings: ExtensionSettings }
  | { action: 'START_GENERATION'; prompt: string };
