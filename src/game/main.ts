// js/game/main.js
// Game entry point - Engine-First Architecture
//
// This module creates the Locus Engine and boots the game orchestrator.
// The engine is fully initialized and started within bootGame(),
// ensuring all systems run through the engine from the beginning.
//
// ARCHITECTURE:
// 1. Create engine with core services (state/events/clock/scheduler/etc.)
// 2. Boot game orchestrator - registers all game-specific plugins
// 3. Engine starts within bootGame - all systems become operational
// 4. Game is ready - engine is the central orchestrator for all systems

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

// Boot the game orchestrator - this registers all game plugins AND starts the engine
// After this call, the engine is fully operational with all systems running through it
bootGame(engine)
