export interface GeminiSelectors {
  textarea: string[];
  sendButton: string[];
  loadingIndicator: string[];
  geminiImage: string[];
  errorMsg: string[];
  rateLimitMsg: string[];
}

export const SELECTORS: GeminiSelectors = {
  textarea: [
    'rich-textarea [contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="prompt"]',
    'div[contenteditable="true"][aria-label*="Prompt"]',
    '.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"]',
    'textarea',
  ],
  sendButton: [
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button.send-button',
    'button[mattooltip*="Send"]',
    'button[mattooltip*="send"]',
    '.send-button-container button',
  ],
  loadingIndicator: [
    'gemini-progress-bar',
    'mat-progress-bar',
    'loading-spinner',
    '.loading-spinner',
    '.progress-bar',
    '.generating',
    'div[class*="progress"]',
    'div[class*="loading"]',
    'div.analysing',
  ],
  geminiImage: [
    'img[src*="googleusercontent.com"]',
    'img[src*="lh3.googleusercontent.com"]',
    '.model-response img',
    'div.image-container img',
    'img[src^="blob:"]',
  ],
  errorMsg: [
    '.error-message',
    'div[class*="error"]',
  ],
  rateLimitMsg: [
    'div[class*="rate-limit"]',
    'div[class*="quota"]',
    'div[class*="limit"]',
  ]
};

/**
 * Finds the first element matching any of the selectors in the list.
 */
export function queryAny(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector) as HTMLElement;
      if (el) return el;
    } catch (e) {
      console.warn('Selector error:', selector, e);
    }
  }
  return null;
}

/**
 * Checks if the page contains specific error texts as fallback.
 */
export function findErrorText(): string | null {
  const pageText = document.body.innerText || '';
  const errorPhrases = [
    'An error occurred',
    'Something went wrong',
    'Please try again later',
    'Unable to load conversation',
    'I cannot generate',
    'Sorry, I cannot',
  ];
  for (const phrase of errorPhrases) {
    if (pageText.includes(phrase)) {
      return phrase;
    }
  }
  return null;
}

/**
 * Checks if the page contains rate limit texts.
 */
export function findRateLimitText(): boolean {
  const pageText = document.body.innerText || '';
  const limitPhrases = [
    "You've reached your limit",
    'Quota exceeded',
    'Too many requests',
    'Please wait before sending more messages',
    'Try again in',
  ];
  for (const phrase of limitPhrases) {
    if (pageText.includes(phrase)) {
      return true;
    }
  }
  return false;
}
