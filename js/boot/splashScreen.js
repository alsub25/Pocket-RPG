// splashScreen.js
// Displays studio and engine logos before the main boot loader

const SPLASH_ID = 'splashScreen';
const STUDIO_LOGO_ID = 'studioLogo';
const ENGINE_LOGO_ID = 'engineLogo';

// Timing configuration (in milliseconds)
const STUDIO_DISPLAY_TIME = 2000;  // How long to show the studio logo
const ENGINE_DISPLAY_TIME = 2000;  // How long to show the engine logo
const FADE_DURATION = 800;         // Fade transition time

function _el(id) {
  try {
    return document.getElementById(id);
  } catch (_) {
    return null;
  }
}

function _nextFrame() {
  return new Promise((resolve) => {
    try {
      requestAnimationFrame(() => resolve());
    } catch (_) {
      setTimeout(resolve, 0);
    }
  });
}

function _wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Shows the splash screen sequence: Studio logo -> Engine logo -> Hide
 * @returns {Promise<void>} Resolves when the splash sequence is complete or skipped
 */
export async function showSplashSequence() {
  const splash = _el(SPLASH_ID);
  const studioLogo = _el(STUDIO_LOGO_ID);
  const engineLogo = _el(ENGINE_LOGO_ID);

  if (!splash || !studioLogo || !engineLogo) {
    console.warn('[splashScreen] Elements not found, skipping splash');
    return;
  }

  let skipped = false;

  // Set up skip handler (click or tap to skip)
  const skipSplash = () => {
    if (!skipped) {
      skipped = true;
      console.log('[splashScreen] Splash sequence skipped by user');
      hideSplashImmediate();
    }
  };

  // Add event listeners for skip
  splash.addEventListener('click', skipSplash, { once: true });
  splash.addEventListener('touchstart', skipSplash, { once: true, passive: true });

  try {
    // Ensure splash is visible
    splash.classList.remove('hidden', 'fade-out');
    splash.style.cursor = 'pointer'; // Indicate it's clickable
    await _nextFrame();

    // Show studio logo
    studioLogo.classList.add('show');
    studioLogo.classList.remove('hidden', 'fade-out');
    await _waitOrSkip(STUDIO_DISPLAY_TIME, () => skipped);

    if (skipped) return;

    // Fade out studio logo
    studioLogo.classList.add('fade-out');
    studioLogo.classList.remove('show');
    await _waitOrSkip(FADE_DURATION, () => skipped);

    if (skipped) return;

    // Hide studio logo and show engine logo
    studioLogo.classList.add('hidden');
    engineLogo.classList.remove('hidden');
    await _nextFrame();
    
    if (skipped) return;

    engineLogo.classList.add('show');
    engineLogo.classList.remove('fade-out');
    await _waitOrSkip(ENGINE_DISPLAY_TIME, () => skipped);

    if (skipped) return;

    // Fade out engine logo
    engineLogo.classList.add('fade-out');
    engineLogo.classList.remove('show');
    await _waitOrSkip(FADE_DURATION, () => skipped);

    if (skipped) return;

    // Fade out entire splash screen
    splash.classList.add('fade-out');
    await _waitOrSkip(600, () => skipped); // Wait for fade out

    if (skipped) return;

    // Hide splash screen
    splash.classList.add('hidden');
  } catch (e) {
    console.error('[splashScreen] Error during splash sequence:', e);
    // Ensure splash is hidden on error
    if (splash) {
      splash.classList.add('hidden');
    }
  } finally {
    // Clean up event listeners (check for splash existence)
    if (splash) {
      splash.removeEventListener('click', skipSplash);
      splash.removeEventListener('touchstart', skipSplash);
      splash.style.cursor = '';
    }
  }
}

/**
 * Wait for a duration or until a condition is met
 * @param {number} ms - Milliseconds to wait
 * @param {function} shouldSkip - Function that returns true if should skip
 * @returns {Promise<void>}
 */
function _waitOrSkip(ms, shouldSkip) {
  return new Promise((resolve) => {
    let timeoutId = null;
    let rafId = null;
    let resolved = false;
    const startTime = Date.now();
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
    
    const complete = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve();
      }
    };
    
    const check = () => {
      if (shouldSkip()) {
        complete();
      } else if (Date.now() - startTime >= ms) {
        complete();
      } else {
        // Use requestAnimationFrame for efficient checking
        rafId = requestAnimationFrame(check);
      }
    };
    
    // Start checking
    check();
    
    // Also set a timeout as a fallback to guarantee completion
    timeoutId = setTimeout(() => {
      complete();
    }, ms);
  });
}

/**
 * Immediately hides the splash screen (for debugging or skip functionality)
 */
export function hideSplashImmediate() {
  const splash = _el(SPLASH_ID);
  if (splash) {
    splash.classList.add('hidden');
  }
}
