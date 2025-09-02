// Inject CSS for hover & focus → brighten the button
const style = document.createElement('style');
style.textContent = `
  .speed-btn { transition: filter 0.2s ease; filter: brightness(1); }
  .speed-btn:hover, .speed-btn:focus { filter: brightness(1.4); outline: none; }
`;
document.head.appendChild(style);

// _____________________________________________________________________________________________

const speeds = [0.5, 1, 1.25, 1.5, 1.75, 2];
let currentIndex = 1;
let speedBtn = null;
let isInjected = false;
let currentUrl = location.href;
let observer = null;
let injectionAttempts = 0;
const MAX_INJECTION_ATTEMPTS = 20;

// Target container selectors in order of preference
const TARGET_SELECTORS = [
  'ytd-reel-player-overlay-renderer #actions',
  'ytd-reel-player-overlay-renderer .ytd-reel-player-overlay-renderer',
  '#shorts-player #actions',
  'ytd-shorts-player-controls #actions',
  '[id="actions"]',
  'ytd-reel-player-overlay-renderer',
  '.ytd-reel-player-overlay-renderer'
];

function isOnShortsPage() {
  return window.location.pathname.includes('/shorts/') || 
         document.querySelector('ytd-shorts') !== null ||
         document.querySelector('ytd-reel-video-renderer') !== null ||
         document.querySelector('ytd-reel-player-overlay-renderer') !== null;
}

function makeButton() {
  const btn = document.createElement('button');
  btn.classList.add('speed-btn');
  btn.style.cssText = `
    margin-left: 8px;
    margin-bottom: 40px;
    width: 60px;
    height: 60px;
    font-size: 18px;
    color: var(--yt-spec-text-primary);
    background: var(--yt-spec-brand-background-solid);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    z-index: 1000;
  `;
  
  btn.addEventListener('click', () => {
    updateSpeed((currentIndex + 1) % speeds.length);
  });
  
  btn.innerText = `${speeds[currentIndex]}x`;
  return btn;
}

function updateSpeed(newIndex) {
  currentIndex = newIndex;
  const vid = document.querySelector('video');
  if (vid) vid.playbackRate = speeds[currentIndex];
  
  if (speedBtn) {
    speedBtn.innerText = `${speeds[currentIndex]}x`;
  }
}

function seekVideo(seconds) {
  const vid = document.querySelector('video');
  if (vid) {
    vid.currentTime = Math.max(0, Math.min(vid.currentTime + seconds, vid.duration));
  }
}

function findTargetContainer() {
  for (const selector of TARGET_SELECTORS) {
    const container = document.querySelector(selector);
    if (container && container.offsetParent !== null) { // Check if element is visible
      return container;
    }
  }
  return null;
}

function tryInjectButton() {
  injectionAttempts++;
  
  // Reset state if not on Shorts page
  if (!isOnShortsPage()) {
    resetState();
    return false;
  }
  
  // Don't inject if already injected and button still exists in DOM
  if (isInjected && speedBtn && document.contains(speedBtn)) {
    return true;
  }
  
  // Reset if button was removed from DOM
  if (isInjected && (!speedBtn || !document.contains(speedBtn))) {
    console.log('🔄 Button was removed from DOM, resetting...');
    isInjected = false;
    speedBtn = null;
  }
  
  const container = findTargetContainer();
  if (container) {
    // Double-check we don't already have a button in this container
    const existingBtn = container.querySelector('.speed-btn');
    if (existingBtn) {
      speedBtn = existingBtn;
      isInjected = true;
      return true;
    }
    
    console.log(`✅ Found container (attempt ${injectionAttempts}) — injecting speed button`);
    speedBtn = makeButton();
    container.appendChild(speedBtn);
    isInjected = true;
    injectionAttempts = 0; // Reset counter on success
    return true;
  }
  
  // If we've tried too many times, log debug info
  if (injectionAttempts >= MAX_INJECTION_ATTEMPTS) {
    console.log('❌ Max injection attempts reached. Debug info:');
    console.log('- Current URL:', location.href);
    console.log('- Is Shorts page:', isOnShortsPage());
    console.log('- Available selectors:');
    TARGET_SELECTORS.forEach(selector => {
      const el = document.querySelector(selector);
      console.log(`  ${selector}:`, el ? 'Found' : 'Not found');
    });
    injectionAttempts = 0; // Reset to allow future attempts
  }
  
  return false;
}

function resetState() {
  isInjected = false;
  speedBtn = null;
  injectionAttempts = 0;
}

function handleNavigation() {
  if (location.href !== currentUrl) {
    console.log('🔄 Navigation detected:', currentUrl, '→', location.href);
    currentUrl = location.href;
    resetState();
    
    // Multiple immediate attempts with different delays
    setTimeout(() => tryInjectButton(), 100);
    setTimeout(() => tryInjectButton(), 300);
    setTimeout(() => tryInjectButton(), 600);
    setTimeout(() => tryInjectButton(), 1000);
  }
}

function createAggressiveObserver() {
  return new MutationObserver((mutations) => {
    // Always try if we're not injected and on Shorts
    if (!isInjected && isOnShortsPage()) {
      let shouldTry = false;
      
      mutations.forEach(mutation => {
        // Check for any new elements
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Very broad detection - any element with YouTube-related classes/tags
              const nodeHTML = node.outerHTML || '';
              if (nodeHTML.includes('ytd-') || 
                  nodeHTML.includes('reel') || 
                  nodeHTML.includes('shorts') ||
                  nodeHTML.includes('actions') ||
                  node.tagName.includes('YTD')) {
                shouldTry = true;
              }
            }
          });
        }
      });
      
      if (shouldTry) {
        // Try immediately and with delay
        tryInjectButton();
        setTimeout(() => tryInjectButton(), 100);
      }
    }
  });
}

function startPeriodicCheck() {
  // Aggressive periodic checking when not injected
  const checkInterval = setInterval(() => {
    if (isOnShortsPage() && !isInjected) {
      tryInjectButton();
    }
    
    // If we've been injected for a while, reduce frequency
    if (isInjected) {
      // Check less frequently if already injected
      setTimeout(() => {
        // Verify button still exists
        if (speedBtn && !document.contains(speedBtn)) {
          console.log('🔄 Button disappeared, retrying...');
          resetState();
        }
      }, 2000);
    }
  }, 500); // Check every 500ms
  
  return checkInterval;
}

function initializeExtension() {
  console.log('🚀 Initializing YouTube Shorts Speed Extension');
  
  // Set up aggressive observer
  observer = createAggressiveObserver();
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true // Also watch for attribute changes
  });
  
  // Set up navigation detection (more frequent)
  setInterval(handleNavigation, 200);
  
  // Start periodic checking
  startPeriodicCheck();
  
  // Listen for YouTube's navigation events
  window.addEventListener('yt-navigate-start', () => {
    console.log('📍 YouTube navigate start');
    resetState();
  });
  
  window.addEventListener('yt-navigate-finish', () => {
    console.log('📍 YouTube navigate finish');
    setTimeout(() => tryInjectButton(), 100);
    setTimeout(() => tryInjectButton(), 400);
    setTimeout(() => tryInjectButton(), 800);
  });
  
  // Immediate injection attempts with staggered timing
  setTimeout(() => tryInjectButton(), 10);
  setTimeout(() => tryInjectButton(), 100);
  setTimeout(() => tryInjectButton(), 300);
  setTimeout(() => tryInjectButton(), 600);
  setTimeout(() => tryInjectButton(), 1200);
  setTimeout(() => tryInjectButton(), 2000);
  
  // Force check periodically for missed cases
  setTimeout(() => {
    if (!isInjected && isOnShortsPage()) {
      console.log('🔄 Force checking for missed injection opportunity...');
      for (let i = 0; i < 5; i++) {
        setTimeout(() => tryInjectButton(), i * 200);
      }
    }
  }, 3000);
}

// Keyboard event handling
document.addEventListener('keydown', (e) => {
  // Only work on Shorts pages
  if (!isOnShortsPage()) return;
  
  // Speed controls: Shift + . / Shift + ,
  if (e.shiftKey && e.code === 'Period') {
    e.preventDefault();
    updateSpeed((currentIndex + 1) % speeds.length);
  }
  else if (e.shiftKey && e.code === 'Comma') {
    e.preventDefault();
    const prev = (currentIndex - 1 + speeds.length) % speeds.length;
    updateSpeed(prev);
  }
  
  // Seek controls: Arrow Left / Arrow Right (only when not in input field)
  else if (e.code === 'ArrowRight' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
    seekVideo(5); // Fast forward 5 seconds
  }
  else if (e.code === 'ArrowLeft' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
    seekVideo(-5); // Seek backward 5 seconds
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}