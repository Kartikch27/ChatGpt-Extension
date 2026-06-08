import type { PlasmoCSConfig } from 'plasmo';
import { SELECTORS, queryAny, findErrorText, findRateLimitText } from '../chatgpt/chatgptAutomation';

export const config: PlasmoCSConfig = {
  matches: ['https://chatgpt.com/*'],
  all_frames: true,
};

console.log('[ChatGPT Manager CS] Injected into ChatGPT page');

// Notify background that this content script is loaded and ready
chrome.runtime.sendMessage({ action: 'CONTENT_READY' });

let monitorInterval: NodeJS.Timeout | null = null;
let isGenerating = false;
let generationStartedAt = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_GENERATION') {
    startGenerationFlow(message.prompt);
    sendResponse({ status: 'started' });
  }
  return true;
});

function startGenerationFlow(prompt: string) {
  console.log('[ChatGPT Manager CS] Starting generation for prompt:', prompt);
  
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }

  isGenerating = false;
  generationStartedAt = Date.now();

  // 1. Locate prompt input
  const textarea = queryAny(SELECTORS.textarea);
  if (!textarea) {
    console.error('[ChatGPT Manager CS] Textarea input not found');
    chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: 'ChatGPT prompt textarea not found' });
    return;
  }

  // 2. Inject prompt text
  injectText(textarea, prompt);

  // 3. Wait a brief moment then click send
  setTimeout(() => {
    const sendBtn = queryAny(SELECTORS.sendButton);
    if (!sendBtn || sendBtn.hasAttribute('disabled')) {
      // If disabled, wait another second
      setTimeout(() => {
        const retrySendBtn = queryAny(SELECTORS.sendButton);
        if (retrySendBtn) {
          retrySendBtn.click();
          startMonitoring();
        } else {
          chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: 'Send button disabled or not found' });
        }
      }, 1000);
    } else {
      sendBtn.click();
      startMonitoring();
    }
  }, 1000);
}

function injectText(textarea: HTMLElement, text: string) {
  textarea.focus();
  if (textarea.tagName === 'TEXTAREA') {
    (textarea as HTMLTextAreaElement).value = text;
  } else if (textarea.hasAttribute('contenteditable')) {
    textarea.textContent = text;
  }
  // Dispatch input and change events so React registers the insertion
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

function startMonitoring() {
  console.log('[ChatGPT Manager CS] Starting DOM monitor loop...');
  let checkedCount = 0;
  
  monitorInterval = setInterval(() => {
    checkedCount++;
    
    // Check for Rate Limit
    if (findRateLimitText()) {
      console.warn('[ChatGPT Manager CS] Rate limit detected!');
      chrome.runtime.sendMessage({ action: 'JOB_RATE_LIMITED' });
      stopMonitoring();
      return;
    }

    // Check for standard errors
    const errorText = findErrorText();
    if (errorText) {
      console.error('[ChatGPT Manager CS] Page error detected:', errorText);
      chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: errorText });
      stopMonitoring();
      return;
    }

    // Detect generation state via stop button
    const stopBtn = queryAny(SELECTORS.stopButton);
    
    if (stopBtn) {
      if (!isGenerating) {
        console.log('[ChatGPT Manager CS] Generation started (stop button appeared)');
        isGenerating = true;
      }
    }

    // If we were generating, and the stop button is now gone, or we have been checking for a while
    if (isGenerating && !stopBtn) {
      console.log('[ChatGPT Manager CS] Stop button disappeared. Looking for completed image...');
      checkForCompletedImage();
      return;
    }

    // Safe fallback: If it's been 2.5 minutes and we haven't completed, check if image is already there
    if (checkedCount > 150) { 
      console.log('[ChatGPT Manager CS] Timeout check: looking for image anyway...');
      checkForCompletedImage();
    }
  }, 1000);
}

function checkForCompletedImage() {
  // Find all images matching Dall-E selector
  const images = document.querySelectorAll(SELECTORS.dalleImage.join(','));
  
  if (images.length > 0) {
    // Get the last image (most recent in the chat conversation)
    const lastImg = images[images.length - 1] as HTMLImageElement;
    const src = lastImg.src;
    
    // Ensure the image source is valid (not a tiny spacer or empty)
    if (src && !src.startsWith('data:image/svg+xml') && src.length > 50) {
      console.log('[ChatGPT Manager CS] Generated image found:', src);
      chrome.runtime.sendMessage({ action: 'JOB_COMPLETED', imageUrl: src });
      stopMonitoring();
      return;
    }
  }

  // If we couldn't find the image but generation stopped, wait up to 10 seconds for it to render
  const elapsed = Date.now() - generationStartedAt;
  if (elapsed > 180000) { // 3 minutes timeout
    chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: 'Image generation timed out without rendering image' });
    stopMonitoring();
  }
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  isGenerating = false;
}
