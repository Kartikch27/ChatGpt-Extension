export interface ChatGPTSelectors {
  textarea: string[];
  sendButton: string[];
  stopButton: string[];
  dalleImage: string[];
  errorMsg: string[];
  rateLimitMsg: string[];
}

export const SELECTORS: ChatGPTSelectors = {
  textarea: [
    '#prompt-textarea',
    'textarea[id="prompt-textarea"]',
    'textarea',
    '[contenteditable="true"]',
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[title*="Send"]',
    'form button',
  ],
  stopButton: [
    'button[aria-label="Stop generating"]',
    'button[data-testid="stop-button"]',
    'button:has(svg rect)', // SVG stop button has a rectangle
  ],
  dalleImage: [
    'img[src*="files.oaiusercontent.com"]',
    'div.aspect-square img',
    'img[src^="blob:"]',
    '.dall-e-image img',
  ],
  errorMsg: [
    '.text-red-500',
    '.text-red-600',
    'div[class*="error"]',
  ],
  rateLimitMsg: [
    'div[class*="rate-limit"]',
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
    'Unable to load conversation',
    'There was an error generating',
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
    "You've reached your",
    'hourly limit',
    'Please try again in',
    'You have reached the message limit',
  ];
  for (const phrase of limitPhrases) {
    if (pageText.includes(phrase)) {
      return true;
    }
  }
  return false;
}
