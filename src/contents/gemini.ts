import type { PlasmoCSConfig } from 'plasmo';
import { SELECTORS, queryAny, queryAllAny, queryAllIncludingShadows, findErrorText, findRateLimitText } from '../gemini/geminiAutomation';
import { addLog } from '../storage/storageHelper';

export const config: PlasmoCSConfig = {
  matches: ['https://gemini.google.com/*'],
  all_frames: false,
};

if (window === window.top) {
  console.log('[Gemini CS] Injected into Gemini top-level page');
  chrome.runtime.sendMessage({ action: 'CONTENT_READY' });
}

let monitorInterval: NodeJS.Timeout | null = null;
let isGenerating = false;
let generationStartedAt = 0;
const preExistingImageUrls = new Set<string>();
let preExistingLastResponse: HTMLElement | null = null;

if (window === window.top) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'START_GENERATION') {
      startGenerationFlow(message.prompt);
      sendResponse({ status: 'started' });
    }
    return true;
  });
}

// Helper to wait for element to exist in DOM
async function waitForElement(selectors: string[], timeoutMs = 15000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const el = queryAny(selectors);
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Gemini prompt input area not found'));
      }
    }, 250);
  });
}

// Helper to wait for send button to become enabled
async function waitForSendButton(timeoutMs = 10000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const el = queryAny(SELECTORS.sendButton);
      if (el && !el.hasAttribute('disabled')) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Send button remained disabled or not found'));
      }
    }, 250);
  });
}

// Listener registered in top-level check above

async function startGenerationFlow(prompt: string) {
  console.log('[Gemini CS] Starting generation for prompt:', prompt);
  await addLog('info', `[Content Script] Received START_GENERATION command. Prompt length: ${prompt.length} chars.`);
  
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }

  isGenerating = false;
  generationStartedAt = Date.now();

  try {
    // 1. Wait for and locate prompt input
    await addLog('info', '[Content Script] Waiting for prompt input area to render...');
    const textarea = await waitForElement(SELECTORS.textarea, 15000);
    await addLog('info', '[Content Script] Prompt input area found. Injecting text...');
    
    // 2. Inject prompt text
    injectText(textarea, prompt);
    await addLog('info', '[Content Script] Prompt text injected. Waiting for send button to enable...');

    // 3. Wait for send button to be enabled
    const sendBtn = await waitForSendButton(10000);
    
    // Capture page text and pre-existing images right before clicking send to avoid old chat history matching
    const initialText = document.body.innerText || '';
    preExistingImageUrls.clear();
    queryAllAny(SELECTORS.geminiImage).forEach((el) => {
      const img = el as HTMLImageElement;
      if (img.src) {
        preExistingImageUrls.add(img.src);
      }
    });

    const modelResponses = queryAllAny(['model-response', 'inline-model-response', 'div.model-response']);
    preExistingLastResponse = modelResponses.length > 0 ? modelResponses[modelResponses.length - 1] : null;
    
    await addLog('info', `[Content Script] Send button enabled. Captured ${preExistingImageUrls.size} pre-existing images. Clicking send...`);
    
    // 4. Click send button
    sendBtn.click();
    await addLog('info', '[Content Script] Send button clicked. Monitoring generation...');
    
    // 5. Start monitoring
    startMonitoring(initialText, prompt);
  } catch (err: any) {
    console.error('[Gemini CS] Generation flow failed:', err.message);
    await addLog('error', `[Content Script] Generation flow failed: ${err.message}`);
    chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: err.message });
  }
}

function injectText(textarea: HTMLElement, text: string) {
  console.log('[Gemini CS] Injecting text to textarea...');
  textarea.focus();

  // Try simulating paste event first (standard for Quill/contenteditable editors)
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    });
    textarea.dispatchEvent(pasteEvent);
  } catch (e) {
    console.warn('[Gemini CS] Clipboard paste simulation failed:', e);
  }

  // Fallback if paste simulation did not populate the editor
  const currentText = textarea.innerText || textarea.textContent || '';
  if (currentText.trim().length < 5) {
    console.log('[Gemini CS] Paste simulation did not populate textarea. Falling back to execCommand...');
    try {
      textarea.innerHTML = '';
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(textarea);
        range.collapse(false);
        selection.addRange(range);
      }
      document.execCommand('insertText', false, text);
    } catch (e) {
      console.warn('[Gemini CS] execCommand fallback failed:', e);
    }
  }

  // Second fallback: set innerText directly
  const finalCheckText = textarea.innerText || textarea.textContent || '';
  if (finalCheckText.trim().length < 5) {
    console.log('[Gemini CS] execCommand failed to populate textarea. Setting innerText directly...');
    textarea.innerText = text;
  }

  // Dispatch standard events for framework change detection
  try {
    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    textarea.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Simulate minor keypress triggers
    textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'a' }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'a' }));
  } catch (e) {
    console.warn('[Gemini CS] event dispatch failed:', e);
  }
}

function findNewImage(): string | null {
  const modelResponses = queryAllAny(['model-response', 'inline-model-response', 'div.model-response']);
  if (modelResponses.length === 0) return null;
  
  const latestResponse = modelResponses[modelResponses.length - 1];
  
  // If the latest response is the pre-existing last response, the new response is not created yet
  if (latestResponse === preExistingLastResponse) {
    return null;
  }
  
  // Search for images inside this latest response only
  const images: HTMLElement[] = [];
  for (const selector of SELECTORS.geminiImage) {
    queryAllIncludingShadows(selector, latestResponse, images);
  }
  
  if (images.length > 0) {
    for (let i = images.length - 1; i >= 0; i--) {
      const lastImg = images[i] as HTMLImageElement;
      const src = lastImg.src;
      if (
        src &&
        !src.includes('avatar') &&
        !src.includes('profile') &&
        !src.startsWith('data:image/svg+xml') &&
        src.length > 50 &&
        (lastImg.naturalWidth > 150 || lastImg.complete) &&
        !preExistingImageUrls.has(src)
      ) {
        return src;
      }
    }
  }
  return null;
}

function startMonitoring(initialText: string, prompt: string) {
  console.log('[Gemini CS] Starting DOM monitor loop...');
  addLog('info', '[Content Script] DOM monitor loop starting in 3 seconds...');
  let checkedCount = 0;
  
  // Give Gemini 3 seconds to register the prompt and transition to busy state
  setTimeout(() => {
    monitorInterval = setInterval(async () => {
      checkedCount++;
      
      // Check for Rate Limit
      if (findRateLimitText(initialText, prompt)) {
        console.warn('[Gemini CS] Rate limit detected!');
        await addLog('warn', '[Content Script] Rate limit detected on page!');
        chrome.runtime.sendMessage({ action: 'JOB_RATE_LIMITED' });
        stopMonitoring();
        return;
      }

      // Check for standard errors
      const errorText = findErrorText(initialText, prompt);
      if (errorText) {
        // Only trigger failure if we are actively generating and it's not a generic false positive
        if (checkedCount > 5) {
          console.error('[Gemini CS] Page error detected:', errorText);
          await addLog('error', `[Content Script] Page error detected: "${errorText}"`);
          chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: errorText });
          stopMonitoring();
          return;
        }
      }

      // 1. Direct check: Has the new image already rendered in DOM?
      const newImgSrc = findNewImage();
      if (newImgSrc) {
        console.log('[Gemini CS] New generated image detected directly in monitor loop:', newImgSrc);
        await addLog('info', `[Content Script] Success: New generated image found in DOM!`);
        chrome.runtime.sendMessage({ action: 'JOB_COMPLETED', imageUrl: newImgSrc });
        stopMonitoring();
        return;
      }

      // 2. Fallback: Detect generation state via loading/progress indicator or disabled send button
      const progressIndicator = queryAny(SELECTORS.loadingIndicator);
      const sendBtn = queryAny(SELECTORS.sendButton);
      const isBusy = !!progressIndicator || (sendBtn && sendBtn.hasAttribute('disabled'));
      
      if (isBusy) {
        if (!isGenerating) {
          console.log('[Gemini CS] Generation started (busy indicator/disabled send button detected)');
          await addLog('info', '[Content Script] Generation started (loading/busy state detected).');
          isGenerating = true;
        }
      }

      // If we were generating, and we are no longer busy, look for the completed image
      if (isGenerating && !isBusy) {
        console.log('[Gemini CS] Generation stopped. Looking for completed image...');
        await addLog('info', '[Content Script] Busy state cleared. Looking for generated image...');
        // Brief 1.5s delay for image rendering in DOM
        setTimeout(checkForCompletedImage, 1500);
        stopMonitoring();
        return;
      }

      // Safe fallback: If it's been 2.5 minutes and we haven't completed, check if image is already there
      if (checkedCount > 150) { 
        console.log('[Gemini CS] Timeout check: looking for image anyway...');
        await addLog('warn', '[Content Script] 2.5 minutes elapsed without busy state clear. Checking for image anyway...');
        checkForCompletedImage();
        stopMonitoring();
      }
    }, 1000);
  }, 3000);
}

async function checkForCompletedImage() {
  const newImgSrc = findNewImage();
  if (newImgSrc) {
    console.log('[Gemini CS] Generated image found:', newImgSrc);
    await addLog('info', `[Content Script] Found new valid generated image! URL length: ${newImgSrc.length} chars.`);
    chrome.runtime.sendMessage({ action: 'JOB_COMPLETED', imageUrl: newImgSrc });
    return;
  }

  // If we couldn't find the image but generation stopped, check if we timed out
  const elapsed = Date.now() - generationStartedAt;
  if (elapsed > 180000) { // 3 minutes timeout
    await addLog('error', '[Content Script] Image generation timed out without rendering image.');
    chrome.runtime.sendMessage({ action: 'JOB_FAILED', error: 'Image generation timed out without rendering image' });
  } else {
    // If not timed out, retry check in 3 seconds
    console.log('[Gemini CS] Image not found yet. Retrying in 3s...');
    await addLog('info', '[Content Script] Image not found yet. Retrying in 3s...');
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
