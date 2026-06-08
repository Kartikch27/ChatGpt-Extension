import type { PlasmoCSConfig } from 'plasmo';
import { SELECTORS, queryAny, findErrorText, findRateLimitText } from '../gemini/geminiAutomation';

export const config: PlasmoCSConfig = {
  matches: ['https://gemini.google.com/*'],
  all_frames: true,
};

console.log('[Gemini CS] Injected into Gemini page');

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
  console.log('[Gemini CS] Starting generation for prompt:', prompt);
  
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }

  isGenerating = false;
  generationStartedAt = Date.now();

  // 1. Locate prompt input
  const textarea = queryAny(SELECTORS.textarea);
  if (!textarea) {
    console.error('[Gemini CS] Prompt input area not found');
    chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: 'Gemini prompt input area not found' });
    return;
  }

  // 2. Inject prompt text
  injectText(textarea, prompt);

  // 3. Wait a brief moment then click send button
  setTimeout(() => {
    const sendBtn = queryAny(SELECTORS.sendButton);
    if (!sendBtn || sendBtn.hasAttribute('disabled')) {
      // If send button is disabled, wait another second
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
  }, 1200);
}

function injectText(textarea: HTMLElement, text: string) {
  textarea.focus();
  // Clear any existing content safely
  textarea.textContent = '';
  
  // Use execCommand to insert text and trigger internal event listeners of the framework
  try {
    document.execCommand('insertText', false, text);
  } catch (err) {
    console.warn('[Gemini CS] execCommand failed, falling back to textContent:', err);
    textarea.textContent = text;
  }

  // Dispatch standard events as fallback
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

function startMonitoring() {
  console.log('[Gemini CS] Starting DOM monitor loop...');
  let checkedCount = 0;
  
  // Give Gemini 3 seconds to register the prompt and transition to busy state
  setTimeout(() => {
    monitorInterval = setInterval(() => {
      checkedCount++;
      
      // Check for Rate Limit
      if (findRateLimitText()) {
        console.warn('[Gemini CS] Rate limit detected!');
        chrome.runtime.sendMessage({ action: 'JOB_RATE_LIMITED' });
        stopMonitoring();
        return;
      }

      // Check for standard errors
      const errorText = findErrorText();
      if (errorText) {
        // Only trigger failure if we are actively generating and it's not a generic false positive
        if (checkedCount > 5) {
          console.error('[Gemini CS] Page error detected:', errorText);
          chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: errorText });
          stopMonitoring();
          return;
        }
      }

      // Detect generation state via loading/progress indicator or disabled send button
      const progressIndicator = queryAny(SELECTORS.loadingIndicator);
      const sendBtn = queryAny(SELECTORS.sendButton);
      const isBusy = !!progressIndicator || (sendBtn && sendBtn.hasAttribute('disabled'));
      
      if (isBusy) {
        if (!isGenerating) {
          console.log('[Gemini CS] Generation started (busy indicator/disabled send button detected)');
          isGenerating = true;
        }
      }

      // If we were generating, and we are no longer busy, look for the completed image
      if (isGenerating && !isBusy) {
        console.log('[Gemini CS] Generation stopped. Looking for completed image...');
        // Brief 1.5s delay for image rendering in DOM
        setTimeout(checkForCompletedImage, 1500);
        stopMonitoring();
        return;
      }

      // Safe fallback: If it's been 2.5 minutes and we haven't completed, check if image is already there
      if (checkedCount > 150) { 
        console.log('[Gemini CS] Timeout check: looking for image anyway...');
        checkForCompletedImage();
        stopMonitoring();
      }
    }, 1000);
  }, 3000);
}

function checkForCompletedImage() {
  // Find all images matching Gemini image selectors
  const images = document.querySelectorAll(SELECTORS.geminiImage.join(','));
  
  if (images.length > 0) {
    // Traverse backwards to find the last valid generated image (most recent in the conversation)
    for (let i = images.length - 1; i >= 0; i--) {
      const lastImg = images[i] as HTMLImageElement;
      const src = lastImg.src;
      
      // Ensure the image source is valid (not a tiny logo, avatar, spacer, or empty)
      if (
        src && 
        !src.includes('avatar') && 
        !src.includes('profile') &&
        !src.startsWith('data:image/svg+xml') && 
        src.length > 50 &&
        lastImg.naturalWidth > 150
      ) {
        console.log('[Gemini CS] Generated image found:', src);
        chrome.runtime.sendMessage({ action: 'JOB_COMPLETED', imageUrl: src });
        return;
      }
    }
  }

  // If we couldn't find the image but generation stopped, check if we timed out
  const elapsed = Date.now() - generationStartedAt;
  if (elapsed > 180000) { // 3 minutes timeout
    chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: 'Image generation timed out without rendering image' });
  } else {
    // If not timed out, retry check in 3 seconds
    console.log('[Gemini CS] Image not found yet. Retrying in 3s...');
    setTimeout(checkForCompletedImage, 3000);
  }
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  isGenerating = false;
}
