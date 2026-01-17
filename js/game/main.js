// js/game/main.js
// Game entry point - Engine-First Architecture
//
// This module creates the Locus Engine and boots the game orchestrator.
// The engine is fully initialized and started within bootGame(),
// ensuring all systems run through the engine from the beginning.
//
// ARCHITECTURE:
// 1. Create engine with core services (state/events/clock/scheduler/etc.)
// 2. Initialize backend services (authentication, cloud saves) if enabled
// 3. Boot game orchestrator - registers all game-specific plugins
// 4. Engine starts within bootGame - all systems become operational
// 5. Game is ready - engine is the central orchestrator for all systems

import { createEngine } from '../engine/engine.js'
import { createEmptyState } from './state/createEmptyState.js'
import { GAME_PATCH, GAME_PATCH_NAME } from './systems/version.js'
import { bootGame } from './runtime/gameOrchestrator.js'

// Create the Locus Engine with initial state and version info
const engine = createEngine({
  initialState: createEmptyState(),
  patch: GAME_PATCH,
  patchName: GAME_PATCH_NAME
})

// Optional debug handle (devtools / bug reports)
try { window.__emberwoodEngine = engine } catch (_) {}

// Initialize backend services (authentication and cloud saves)
// This is non-blocking and falls back gracefully if not configured
// Use dynamic import to avoid breaking the main game if backend has issues
(async () => {
  try {
    const backendModule = await import('../backend/backendUI.js');
    const { initBackendUI, showLoginScreen, shouldShowLoginScreen } = backendModule;
    
    const result = await initBackendUI();
    if (result.success && !result.offline) {
      console.log('[Main] Backend services initialized');
      
      // Optionally show login screen on startup
      // For now, we default to not showing it to preserve existing UX
      // Users can access login via the main menu
      if (shouldShowLoginScreen()) {
        showLoginScreen();
      }
    } else if (result.offline) {
      console.log('[Main] Backend disabled, using local-only mode');
    } else {
      console.warn('[Main] Backend initialization failed, falling back to local-only mode');
    }
  } catch (error) {
    console.error('[Main] Backend initialization error:', error);
    // Continue with game - backend is optional
  }
})();

// Boot the game orchestrator - this registers all game plugins AND starts the engine
// After this call, the engine is fully operational with all systems running through it
bootGame(engine)
