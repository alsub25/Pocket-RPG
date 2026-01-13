# Locus Engine (js/engine)

Locus is Emberwood’s proprietary **engine core**: a game-agnostic runtime that provides a *state + events backplane* plus a set of reusable services (timing, UI routing, persistence helpers, diagnostics, etc.).

Authored gameplay and content (combat rules, quests, locations, balance, dialogue, item definitions) live under `js/game/`. Locus is intentionally kept **content-free** so it can be reused across refactors and patches without pulling gameplay dependencies into the engine core.

## What Locus provides

### State store
- `engine.getState()` / `engine.setState(next)` provide a single authoritative state object.
- Snapshot helpers live in `snapshots.js` and are used by the higher-level save/load surface.

### Event bus
- `engine.on(event, fn)` / `engine.off(event, fn)` / `engine.emit(event, payload)` provide lightweight pub/sub for cross-system signaling.
- Event tracing can be enabled via `eventTrace.js` for diagnostics.

### Plugin lifecycle and dependency graph
- Plugins are registered with `engine.use(plugin)`.
- Standard hooks: `init(engine)`, `start(engine)`, `stop(engine)`, `dispose(engine)`.
- Plugins can declare `requires` and `optionalRequires`; the engine computes a stable topological start order and detects cycles/missing deps.

### Service registry
- Systems can be exposed as services (e.g., `engine.get('diagnostics')`) without hard imports between gameplay modules.
- This is the main mechanism used to wire game runtime systems into the orchestrator without creating circular module dependencies.

### Clock and scheduler
- `clock.js` provides a deterministic engine clock.
- `scheduler.js` exposes a clock-driven scheduler:
  - `engine.schedule.after(ms, fn, { owner })`
  - `engine.schedule.every(ms, fn, { immediate, owner })`
  - `engine.schedule.cancel(id)`
  - `engine.schedule.cancelOwner(owner)`

Ownership is a tiny convention for safe cleanup when UI/screens change, for example:
- `owner: 'modal:tavern'`
- `owner: 'screen:village'`

### UI router
- `uiRouter.js` tracks a modal stack under the engine (`engine.ui.open/close/list`).
- The UI runtime installs a DOM adapter so the engine can own the stack while the UI still renders in the browser.

### Command bus
- `commands.js` provides `engine.dispatch(type, payload)` with middleware support and a replayable command log.

### Persistence and migrations
- `snapshots.js` provides snapshot save/load helpers with checksum validation.
- `migrations.js` provides a migration registry used to upgrade older saves.

### Diagnostics and performance tooling
- `logger.js` structured logging.
- `errorBoundary.js` unified crash reporting.
- `perf.js` and `profiler.js` for detecting slow frames/scopes.

### RNG streams
- `rng.js` provides seeded RNG streams for reproducible systems.

### Input routing
- `input.js` provides a centralized place to normalize and route user inputs.

### Asset registry
- `assets.js` provides a registry and preload hooks for named assets.
- Supports manifests (assets + groups) and emits progress events during group preloads.

### Settings + accessibility
- `settings.js` provides a persistent preferences registry (dot-path keys).
- `a11y.js` reads OS hints (e.g., prefers-reduced-motion) and combines them with settings.
- A DOM bridge plugin (in `js/game/plugins`) applies the computed preferences to the live UI.

### Tween/animation
- `tween.js` provides a clock-driven tween service with owner-based cancellation.
- Intended for UI effects and transitions so time behavior stays under the engine clock.

### Headless test harness
- `harness.js` provides a small headless runner (`engine.harness`) for scripted steps and smoke tests.

## Engine Capabilities Overview

This section is the **connection map**: what Locus exposes, and which Emberwood plugins/modules currently touch it.

### Core engine services

| Service (engine.getService) | Also exposed as | Used for | Current consumers |
|---|---|---|---|
| events | engine.on/off/emit | Pub/sub across systems | Most plugins + gameOrchestrator |
| clock | engine.clock | Deterministic clock + time scale | engine.schedule + tick loop |
| schedule | engine.schedule | after/every + cancelOwner | ew.uiRuntime, ew.autosave, ew.simTick, saveManager, scheduleAfter(...) helpers |
| commands | engine.commands / engine.dispatch | UI/game command bus | ew.uiCommands (dispatch), ew.gameCommands (handlers), gameOrchestrator (dispatch) |
| uiRouter | engine.ui | Modal stack + adapter hook | ew.uiRuntime (adapter), ew.uiCommands (close) |
| input | engine.input | Action routing + contexts | ew.inputContexts, ew.uiCommands, UI bindings |
| snapshots | engine.save/load | Snapshot persistence format | saveManager |
| migrations | engine.migrations | Save migrations | saveManager |
| rng | engine.rng | Seeded RNG streams | game systems/rng.js (deterministic mode) |
| log | engine.log | Structured logging | (available; not yet required) |
| perf | engine.perf | Profiler/watchdog | ew.diagnosticsOverlay (reports) |
| assets | engine.assets | Asset registry/preload | ew.assetsManifest (manifest + groups), ew.screenAssetPreload (preload orchestration) |
| settings | engine.settings | Persistent user preferences | ew.settings, ew.a11yBridge, settings UI (via state mirror) |
| a11y | engine.a11y | Derived accessibility prefs (OS + user) | ew.a11yBridge |
| tween | engine.tween | Clock-driven tweens with owner cancellation | uiRuntime (toasts), future transitions |
| flags | engine.flags | Persistent feature flags/experiments | ew.flags, ew.telemetry, ew.replayBridge |
| i18n | engine.i18n | Localization registry (t()) | ew.i18n, ew.diagnosticsOverlay (labels/toasts) |
| uiCompose | engine.uiCompose | Toast/busy/transition/HUD composition surface | ew.uiComposeBridge, ew.diagnosticsOverlay |
| savePolicy | engine.savePolicy | Dirty-state + transactional flush policy | ew.savePolicyBridge, ew.autosave |
| replay | engine.replay | Command-based replay recorder/player | ew.replayBridge, ew.diagnosticsOverlay |
| telemetry | engine.telemetry | Breadcrumbs + crash bundle persistence | ew.telemetry, ew.diagnosticsOverlay (bug bundle) |
| errorBoundary | engine.errorBoundary | Crash capture/report | Boot diagnostics + QA overlay |
| harness | engine.harness | Headless step runner | Smoke tests (future wiring) |

### Game plugin services

| Service name | Provided by | Purpose | Consumers |
|---|---|---|---|
| ui, ui.bindings | ew.uiRuntime | UI runtime + DOM bindings | ew.diagnosticsOverlay (depends), game boot |
| diagnostics | ew.diagnosticsOverlay | QA overlay helpers | gameOrchestrator, ew.uiCommands |
| combat, combat.math, combat.status, combat.turnSequencer | ew.combatRuntime | Combat engines | gameOrchestrator |
| companionRuntime, combat.companion | ew.companionRuntime | Companion combat runtime | gameOrchestrator |
| world | ew.worldEvents | Convenience wrapper for world:* events | ew.questEvents, ew.autosave |
| autosave | ew.autosave | Coalesced + periodic autosave | (internal) |
| (none) | ew.gameCommands | Register game-level command handlers (Explore/combat/modals) | engine.commands |
| (none) | ew.flags / ew.i18n | Configure engine flags + localization | other plugins |
| (none) | ew.assetsManifest | Register Emberwood asset manifest + groups | engine.assets |
| (none) | ew.screenAssetPreload | Preload asset groups on screen/modal entry (busy/progress via uiCompose) | engine.assets + engine.uiCompose |
| (none) | ew.settings | Seed/load unified settings | engine.settings |
| (none) | ew.a11yBridge | Apply theme/motion/text scale to DOM + listen to OS changes | engine.a11y + engine.settings |
| (none) | ew.uiComposeBridge | Install uiCompose adapter into live DOM | engine.uiCompose |
| (none) | ew.savePolicyBridge | Connect savePolicy.flush() to saveGame() | engine.savePolicy |
| (none) | ew.telemetry | Start telemetry + provide game context | engine.telemetry |
| (none) | ew.gameCommands | Register command handlers for top-level game actions | engine.commands |
| replay | ew.replayBridge | Dev helper + optional hotkeys | engine.replay |
| gameRng | ew.rngBridge | Legacy RNG helpers exposed as a service | (not yet consumed) |
| audio | ew.audioBridge | Audio helpers exposed as a service | (not yet consumed) |

## File map

- `engine.js` — Engine creation, plugin lifecycle, core wiring
- `clock.js` — Deterministic clock
- `scheduler.js` — Clock-driven scheduler (with ownership)
- `uiRouter.js` — Modal stack/router
- `commands.js` — Command bus + middleware
- `snapshots.js` — Snapshot save/load helpers
- `migrations.js` — Migration registry
- `logger.js` — Structured logging
- `errorBoundary.js` — Crash capture/report builder
- `eventTrace.js` — Event tracing
- `perf.js` / `profiler.js` — Performance tools
- `rng.js` — Seeded RNG streams
- `input.js` — Input normalization/router
- `assets.js` — Asset registry/preload helpers
- `settings.js` — Persistent settings registry
- `a11y.js` — Accessibility preferences (OS + user)
- `tween.js` — Clock-driven tween/animation service
- `flags.js` — Persistent feature flags/experiments
- `i18n.js` — Localization registry
- `uiCompose.js` — UI composition surface (toast/busy/transition/HUD)
- `savePolicy.js` — Dirty-state + transactional flush policy
- `replay.js` — Command replay recorder/player
- `telemetry.js` — Breadcrumbs + crash bundle persistence
- `storageRuntime.js` — Browser storage helpers
- `harness.js` — Headless test harness

## Quick usage (example)

```js
import { createEngine } from './js/engine/engine.js'

const engine = createEngine({ initialState: { ... } })

// Plugins
engine.use(myPlugin)
engine.start()

// Scheduling with ownership
engine.schedule.after(250, () => {
  // do something later
}, { owner: 'modal:tavern' })

// Cleanup (e.g., when the tavern modal closes)
engine.schedule.cancelOwner('modal:tavern')
```
