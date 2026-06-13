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
    '[contenteditable="true"]',
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
    'button[aria-label*="message"]',
    'button[aria-label*="Message"]',
    'button[type="submit"]',
    'button.send-button',
    'button[mattooltip*="Send"]',
    'button[mattooltip*="send"]',
    '.send-button-container button',
    'rich-textarea + button',
    'g-textarea + button',
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

function querySelectorIncludingShadows(selector: string, root: Document | ShadowRoot = document): HTMLElement | null {
  try {
    const el = root.querySelector(selector) as HTMLElement;
    if (el) return el;
  } catch (e) {
    // Ignore invalid selector errors during traversal
  }

  const elements = root.querySelectorAll('*');
  for (let i = 0; i < elements.length; i++) {
    const shadow = elements[i].shadowRoot;
    if (shadow) {
      const found = querySelectorIncludingShadows(selector, shadow);
      if (found) return found;
    }
  }
  return null;
}

export function queryAllIncludingShadows(selector: string, root: Document | ShadowRoot | HTMLElement, results: HTMLElement[]) {
  try {
    const elements = root.querySelectorAll(selector);
    elements.forEach((el) => {
      if (!results.includes(el as HTMLElement)) {
        results.push(el as HTMLElement);
      }
    });
  } catch (e) {
    // Ignore invalid selector errors
  }

  const allElements = root.querySelectorAll('*');
  for (let i = 0; i < allElements.length; i++) {
    const shadow = allElements[i].shadowRoot;
    if (shadow) {
      queryAllIncludingShadows(selector, shadow, results);
    }
  }
}

/**
 * Finds the first element matching any of the selectors in the list, searching deep inside shadow DOMs.
 */
export function queryAny(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const el = querySelectorIncludingShadows(selector);
      if (el) return el;
    } catch (e) {
      console.warn('Selector error:', selector, e);
    }
  }
  return null;
}

/**
 * Finds all elements matching any of the selectors in the list, searching deep inside shadow DOMs.
 */
export function queryAllAny(selectors: string[]): HTMLElement[] {
  const results: HTMLElement[] = [];
  for (const selector of selectors) {
    try {
      queryAllIncludingShadows(selector, document, results);
    } catch (e) {
      console.warn('Selector error:', selector, e);
    }
  }
  return results;
}

/**
 * Checks if the page contains specific error texts as fallback.
 */
export function findErrorText(initialText: string, prompt: string): string | null {
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
    if (pageText.includes(phrase) && !initialText.includes(phrase) && !prompt.includes(phrase)) {
      return phrase;
    }
  }
  return null;
}

/**
 * Checks if the page contains rate limit texts.
 */
export function findRateLimitText(initialText: string, prompt: string): boolean {
  const pageText = document.body.innerText || '';
  const limitPhrases = [
    "You've reached your limit",
    'Quota exceeded',
    'Too many requests',
    'Please wait before sending more messages',
    'Try again in',
  ];
  for (const phrase of limitPhrases) {
    if (pageText.includes(phrase) && !initialText.includes(phrase) && !prompt.includes(phrase)) {
      return true;
    }
  }
  return false;
}
