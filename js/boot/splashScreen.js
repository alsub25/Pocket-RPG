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
 * @returns {Promise<void>} Resolves when the splash sequence is complete
 */
export async function showSplashSequence() {
  const splash = _el(SPLASH_ID);
  const studioLogo = _el(STUDIO_LOGO_ID);
  const engineLogo = _el(ENGINE_LOGO_ID);

  if (!splash || !studioLogo || !engineLogo) {
    console.warn('[splashScreen] Elements not found, skipping splash');
    return;
  }

  try {
    // Ensure splash is visible
    splash.classList.remove('hidden', 'fade-out');
    await _nextFrame();

    // Show studio logo
    studioLogo.classList.add('show');
    studioLogo.classList.remove('hidden', 'fade-out');
    await _wait(STUDIO_DISPLAY_TIME);

    // Fade out studio logo
    studioLogo.classList.add('fade-out');
    studioLogo.classList.remove('show');
    await _wait(FADE_DURATION);

    // Hide studio logo and show engine logo
    studioLogo.classList.add('hidden');
    engineLogo.classList.remove('hidden');
    await _nextFrame();
    
    engineLogo.classList.add('show');
    engineLogo.classList.remove('fade-out');
    await _wait(ENGINE_DISPLAY_TIME);

    // Fade out engine logo
    engineLogo.classList.add('fade-out');
    engineLogo.classList.remove('show');
    await _wait(FADE_DURATION);

    // Fade out entire splash screen
    splash.classList.add('fade-out');
    await _wait(600); // Wait for fade out

    // Hide splash screen
    splash.classList.add('hidden');
  } catch (e) {
    console.error('[splashScreen] Error during splash sequence:', e);
    // Ensure splash is hidden on error
    if (splash) {
      splash.classList.add('hidden');
    }
  }
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
