chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') {
    if (message.type === 'play-audio') {
      try {
        playChime();
        sendResponse({ success: true });
      } catch (err: any) {
        console.error('Audio play failed:', err);
        sendResponse({ success: false, error: err.message });
      }
      return true; // async response
    }
  }
});

function playChime() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API not supported');
  }

  const ctx = new AudioContextClass();
  const now = ctx.currentTime;

  // First Note: D5 (587.33 Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(587.33, now);
  gain1.gain.setValueAtTime(0.08, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.5);

  // Second Note: A5 (880.00 Hz) with slight delay
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880.0, now + 0.12);
  gain2.gain.setValueAtTime(0.08, now + 0.12);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.62);
}
