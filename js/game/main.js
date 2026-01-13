// js/game/main.js
// Game entry point.
// - Creates the proprietary Engine Core (state/event backplane).
// - Boots the game-specific orchestrator.

import { createEngine } from '../engine/engine.js'
import { createEmptyState } from './state/createEmptyState.js'
import { GAME_PATCH, GAME_PATCH_NAME } from './systems/version.js'
import { bootGame } from './runtime/gameOrchestrator.js'

const engine = createEngine({
  initialState: createEmptyState(),
  patch: GAME_PATCH,
  patchName: GAME_PATCH_NAME
})

// Optional debug handle (devtools / bug reports)
try { window.__emberwoodEngine = engine } catch (_) {}

bootGame(engine)


// Start engine plugins (if any were registered during boot).
try { engine.start() } catch (e) {
  try { console.error('[Engine] start failed', e) } catch (_) {}
}
