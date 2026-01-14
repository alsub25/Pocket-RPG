# Locus Engine (js/engine)

**Locus** is Emberwood's proprietary **game-agnostic engine core**: a modular runtime that provides a robust foundation for browser-based games without requiring build tools or bundlers.

## Table of Contents

- [Design Philosophy](#design-philosophy)
- [Core Architecture](#core-architecture)
- [What Locus Provides](#what-locus-provides)
- [Getting Started](#getting-started)
- [Plugin Development](#plugin-development)
- [Service Integration Patterns](#service-integration-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [File Map](#file-map)

## Design Philosophy

Locus separates the **platform concerns** (state management, events, scheduling, persistence) from **game content** (combat rules, quests, items, dialogue). This separation enables:

- **Zero Build Complexity**: Native ES modules, no webpack/rollup/vite required
- **Testability**: Pure functions, dependency injection, headless testing support
- **Modularity**: Plugin architecture with automatic dependency resolution
- **Predictability**: Single state object, deterministic systems, reproducible behavior
- **Maintainability**: Clear boundaries between engine and game code

**Content lives in `js/game/`**, gameplay rules stay out of the engine. Locus is intentionally kept **content-free** so it can be reused across refactors and patches without pulling gameplay dependencies into the engine core.

## Core Architecture

### Layered Design

```
┌─────────────────────────────────────────┐
│         Game Layer (js/game/)           │
│  - Game-specific logic & content        │
│  - Plugins bridge game code to engine   │
│  - Depends on: Engine, Shared           │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│       Engine Layer (js/engine/)         │
│  - Platform-agnostic game engine        │
│  - State, events, plugins, services     │
│  - Depends on: Shared                   │
└─────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────┐
│       Shared Layer (js/shared/)         │
│  - Cross-layer utilities                │
│  - No external dependencies             │
└─────────────────────────────────────────┘
```

### Engine Responsibilities

1. **State Management**: Own the authoritative state reference
2. **Event Bus**: Provide pub/sub for cross-system signaling
3. **Service Registry**: Enable dependency injection without circular imports
4. **Plugin Lifecycle**: Manage plugin initialization, start, stop, disposal
5. **Clock & Scheduler**: Deterministic timing with owner-based cleanup
6. **Persistence**: Snapshot save/load with migrations
7. **Diagnostics**: Structured logging, profiling, error boundaries

## What Locus Provides

### State Store
- `engine.getState()` / `engine.setState(next)` provide a single authoritative state object
- Snapshot helpers in `snapshots.js` for save/load operations
- State mutations flow through controlled update paths

**Example:**
```javascript
// Get current state
const state = engine.getState();

// Update state
const newState = {
  ...state,
  player: {
    ...state.player,
    gold: state.player.gold + 100
  }
};
engine.setState(newState);

// Emit event so systems can react
engine.emit('player:goldChanged', { delta: 100 });
```

### Event Bus
- `engine.on(event, fn)` / `engine.off(event, fn)` / `engine.emit(event, payload)` provide lightweight pub/sub
- Event tracing can be enabled via `eventTrace.js` for diagnostics
- Owner-scoped listeners with automatic cleanup

**Example:**
```javascript
// Subscribe to events
engine.on('combat:victory', (payload) => {
  console.log('Combat won!', payload);
});

// Emit events
engine.emit('combat:victory', { 
  xpGained: 100,
  goldEarned: 50
});

// Owner-scoped listener (auto-cleanup)
engine.ownListener('screen:village', 'merchant:stockChanged', () => {
  updateMerchantUI();
});

// Later, cleanup all listeners for owner
engine.disposeOwner('screen:village');
```

### Plugin Lifecycle and Dependency Graph
- Plugins are registered with `engine.use(plugin)`
- Standard hooks: `init(engine)`, `start(engine)`, `stop(engine)`, `dispose(engine)`
- Plugins can declare `requires` and `optionalRequires`
- Engine computes stable topological start order and detects cycles/missing deps

**Example Plugin:**
```javascript
export function createMyPlugin() {
  return {
    id: 'myPlugin',
    requires: ['ew.uiRuntime'],  // Hard dependency
    optionalRequires: ['ew.audio'],  // Soft dependency
    
    init(engine) {
      // One-time initialization
      engine.registerService('myService', {
        doSomething() { /* ... */ }
      });
    },
    
    start(engine) {
      // Start runtime work (listeners, timers)
      engine.on('game:loaded', this._onGameLoaded);
    },
    
    stop(engine) {
      // Stop runtime work
      engine.off('game:loaded', this._onGameLoaded);
    },
    
    dispose(engine) {
      // Final cleanup
      engine.unregisterService('myService');
    },
    
    _onGameLoaded(payload) {
      // Handle event
    }
  };
}
```

### Service Registry
- Systems can be exposed as services via `engine.registerService(name, api)`
- Access services with `engine.getService(name)` or `engine.get(name)`
- Prevents circular module dependencies
- Enables testing through service mocking

**Example:**
```javascript
// Register a service
engine.registerService('combat', {
  startBattle(enemies) { /* ... */ },
  endBattle() { /* ... */ },
  dealDamage(target, amount) { /* ... */ }
});

// Use the service elsewhere
const combat = engine.getService('combat');
combat.startBattle([enemy1, enemy2]);

// Alternative shorthand
const combat = engine.get('combat');
```

### Clock and Scheduler
- `clock.js` provides a deterministic engine clock
- `scheduler.js` exposes a clock-driven scheduler with owner-based cleanup
- Ownership convention enables safe cleanup when UI/screens change

**Example:**
```javascript
// Schedule one-time delayed action
engine.schedule.after(1000, () => {
  console.log('1 second later');
}, { owner: 'modal:tavern' });

// Schedule repeating action
const id = engine.schedule.every(100, () => {
  updateAnimation();
}, { 
  immediate: true,  // Run immediately, then every 100ms
  owner: 'screen:village' 
});

// Cancel specific task
engine.schedule.cancel(id);

// Cancel all tasks for an owner (e.g., when modal closes)
engine.schedule.cancelOwner('modal:tavern');
```

### UI Router
- `uiRouter.js` tracks a modal stack under the engine
- `engine.ui.open(config)` / `engine.ui.close()` / `engine.ui.list()`
- UI runtime installs a DOM adapter so engine can own the stack

**Example:**
```javascript
// Open a modal
engine.ui.open({
  title: 'Settings',
  owner: 'modal:settings',
  content: '<div>Settings content</div>'
});

// Close top modal
engine.ui.close();

// List all open modals
const modals = engine.ui.list();
```

### Command Bus
- `commands.js` provides `engine.dispatch(type, payload)` with middleware support
- Replayable command log for deterministic testing
- Enables undo/redo, replay, and telemetry

**Example:**
```javascript
// Register command handler
engine.commands.register('ATTACK_ENEMY', (payload, state) => {
  const { targetId } = payload;
  // Execute attack logic
  return {
    ...state,
    combat: updateCombat(state.combat, targetId)
  };
});

// Dispatch command
engine.dispatch('ATTACK_ENEMY', { targetId: 'goblin_01' });

// Record commands for replay
engine.replay.start();
// ... user actions ...
const recording = engine.replay.stop();
engine.replay.play(recording);  // Replay actions
```

### Persistence and Migrations
- `snapshots.js` provides snapshot save/load with checksum validation
- `migrations.js` provides a migration registry for upgrading older saves
- Deterministic migration pipeline ensures old saves work with new versions

**Example:**
```javascript
// Register migration
engine.migrations.register({
  version: 10,
  description: 'Add companion system',
  apply: (state) => {
    if (!state.companions) {
      state.companions = { active: null, unlocked: [] };
    }
    return state;
  }
});

// Save state
const snapshot = engine.save();
localStorage.setItem('save', JSON.stringify(snapshot));

// Load state (migrations auto-applied)
const saved = JSON.parse(localStorage.getItem('save'));
engine.load(saved);
```

### Diagnostics and Performance Tooling
- `logger.js`: Structured logging with levels (debug, info, warn, error)
- `errorBoundary.js`: Unified crash reporting
- `perf.js` and `profiler.js`: Detect slow frames/scopes
- `telemetry.js`: Breadcrumbs + crash bundle persistence

**Example:**
```javascript
// Structured logging
engine.log.info('combat', 'Battle started', { 
  enemies: 3, 
  playerLevel: 10 
});

engine.log.warn('economy', 'Price out of range', { 
  item: 'sword',
  price: -100 
});

// Performance profiling
engine.perf.mark('combat:start');
// ... combat logic ...
engine.perf.mark('combat:end');
const duration = engine.perf.measure('combat:start', 'combat:end');

// Error boundary
engine.errorBoundary.capture(() => {
  // Risky code
  dangerousOperation();
});
```

### RNG Streams
- `rng.js` provides seeded RNG streams for reproducible systems
- Separate streams for different systems (loot, combat, etc.)
- Deterministic mode for testing and bug reproduction

**Example:**
```javascript
// Seeded RNG for reproducibility
engine.rng.seed(12345);

// Roll dice
const damage = engine.rng.roll(10, 20);  // Random int [10, 20]

// Random float
const chance = engine.rng.random();  // Random float [0, 1)

// Pick from array
const enemy = engine.rng.pick(['goblin', 'orc', 'troll']);

// Weighted selection
const rarity = engine.rng.weighted(
  ['common', 'rare', 'legendary'],
  item => item === 'common' ? 70 : item === 'rare' ? 25 : 5
);
```

### Input Routing
- `input.js` provides centralized input normalization and routing
- Context-aware input handling (combat, exploration, menu)
- Keyboard, mouse, touch, and gamepad support

**Example:**
```javascript
// Register input context
engine.input.pushContext('combat', {
  'attack': () => attackEnemy(),
  'defend': () => defendAction(),
  'escape': () => attemptFlee()
});

// Trigger input action
engine.input.trigger('attack');

// Pop context when done
engine.input.popContext('combat');
```

### Asset Registry
- `assets.js` provides asset registry and preload helpers
- Supports manifests (assets + groups) with progress events
- Group-based preloading for screens/modals

**Example:**
```javascript
// Register asset
engine.assets.register('icon:sword', '/assets/icons/sword.png');

// Register asset group
engine.assets.registerGroup('screen:combat', [
  'icon:sword',
  'icon:shield',
  'audio:battle_music'
]);

// Preload group with progress
engine.assets.preloadGroup('screen:combat', (progress) => {
  console.log(`Loading: ${progress}%`);
}).then(() => {
  console.log('Assets ready!');
});

// Get asset
const icon = engine.assets.get('icon:sword');
```

### Settings + Accessibility
- `settings.js` provides persistent preferences registry (dot-path keys)
- `a11y.js` reads OS hints (e.g., prefers-reduced-motion) and combines with settings
- DOM bridge plugin applies computed preferences to live UI

**Example:**
```javascript
// Get setting
const volume = engine.settings.get('audio.volume', 0.5);

// Set setting
engine.settings.set('audio.volume', 0.8);

// Listen to changes
engine.settings.on('audio.volume', (newValue) => {
  updateAudioVolume(newValue);
});

// Accessibility preferences
const a11y = engine.get('a11y');
const reducedMotion = a11y.prefersReducedMotion();
const highContrast = a11y.prefersHighContrast();
```

### Tween/Animation
- `tween.js` provides clock-driven tween service with owner-based cancellation
- Intended for UI effects and transitions
- Time behavior stays under engine clock for determinism

**Example:**
```javascript
// Tween a value
engine.tween.to(
  { value: 0 },
  { value: 100 },
  1000,  // duration in ms
  {
    owner: 'modal:levelup',
    easing: 'easeInOut',
    onUpdate: (obj) => {
      progressBar.style.width = `${obj.value}%`;
    },
    onComplete: () => {
      console.log('Animation done!');
    }
  }
);

// Cancel all tweens for owner
engine.tween.cancelOwner('modal:levelup');
```

### Headless Test Harness
- `harness.js` provides headless runner for scripted steps and smoke tests
- Run engine without browser DOM
- Automated testing and CI/CD integration

**Example:**
```javascript
// Run test sequence
engine.harness.run([
  { type: 'setState', state: initialState },
  { type: 'dispatch', command: 'START_COMBAT' },
  { type: 'wait', ms: 100 },
  { type: 'assert', fn: (state) => state.combat.active === true },
  { type: 'dispatch', command: 'ATTACK_ENEMY', payload: { id: 'goblin' } }
]);
```

## Getting Started

### Creating an Engine Instance

```javascript
import { createEngine } from './js/engine/engine.js';

const engine = createEngine({
  initialState: {
    player: { hp: 100, maxHp: 100 },
    // ... more state
  },
  patch: '1.2.82',
  patchName: 'Engine Enhancement',
  autoTick: true,  // Enable automatic tick loop
  autoTickMode: 'raf'  // Use requestAnimationFrame
});
```

### Registering Plugins

```javascript
import { createMyPlugin } from './plugins/myPlugin.js';
import { createAnotherPlugin } from './plugins/anotherPlugin.js';

// Register plugins (order doesn't matter, engine will resolve dependencies)
engine.use(createMyPlugin());
engine.use(createAnotherPlugin());

// Start engine (initializes and starts all plugins)
engine.start();
```

### Basic Usage Pattern

```javascript
// 1. Create engine
const engine = createEngine({ initialState });

// 2. Register plugins
engine.use(createCombatPlugin());
engine.use(createInventoryPlugin());

// 3. Start engine
engine.start();

// 4. Use engine services
const combat = engine.get('combat');
combat.startBattle([enemy1, enemy2]);

// 5. Stop engine when done
engine.stop();
```

## Plugin Development

### Plugin Structure

A plugin is an object with these optional properties:

```javascript
{
  id: 'pluginId',                    // Required: Unique identifier
  requires: ['otherPlugin'],         // Hard dependencies
  optionalRequires: ['maybeMissing'], // Soft dependencies
  init(engine) { },                  // One-time initialization
  start(engine) { },                 // Start runtime work
  stop(engine) { },                  // Stop runtime work
  dispose(engine) { }                // Final cleanup
}
```

### Plugin Lifecycle

1. **Registration**: `engine.use(plugin)` adds plugin to registry
2. **Dependency Resolution**: Engine computes topological order
3. **Initialization**: `init()` called for each plugin (sorted order)
4. **Start**: `start()` called when `engine.start()` is invoked
5. **Stop**: `stop()` called when `engine.stop()` is invoked
6. **Disposal**: `dispose()` called for final cleanup

### Plugin Template

```javascript
export function createMyGamePlugin() {
  // Plugin-local state
  let initialized = false;
  let intervalId = null;

  return {
    id: 'myGame.myFeature',
    requires: ['ew.uiRuntime'],
    optionalRequires: ['ew.audio'],

    init(engine) {
      // One-time setup: register services, set flags
      engine.registerService('myFeature', {
        doThing() {
          console.log('Thing done!');
        }
      });

      // Subscribe to events
      engine.on('game:ready', () => {
        console.log('Game is ready!');
      });

      initialized = true;
    },

    start(engine) {
      // Start runtime work: timers, listeners, etc.
      if (!initialized) return;

      intervalId = setInterval(() => {
        // Periodic work
      }, 1000);

      console.log('Plugin started');
    },

    stop(engine) {
      // Stop runtime work
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      console.log('Plugin stopped');
    },

    dispose(engine) {
      // Final cleanup
      engine.unregisterService('myFeature');
      initialized = false;
    }
  };
}
```

### Common Plugin Patterns

#### 1. Service Registration

```javascript
init(engine) {
  engine.registerService('myService', {
    method1() { /* ... */ },
    method2() { /* ... */ }
  });
}
```

#### 2. Event Listening

```javascript
start(engine) {
  this._handler = (payload) => {
    // Handle event
  };
  engine.on('my:event', this._handler);
},

stop(engine) {
  engine.off('my:event', this._handler);
}
```

#### 3. Scheduled Tasks

```javascript
start(engine) {
  this._taskId = engine.schedule.every(1000, () => {
    // Periodic task
  }, { owner: 'plugin:myPlugin' });
},

stop(engine) {
  engine.schedule.cancelOwner('plugin:myPlugin');
}
```

#### 4. State Observation

```javascript
init(engine) {
  engine.on('state:changed', () => {
    const state = engine.getState();
    // React to state changes
  });
}
```

## Service Integration Patterns

### Pattern 1: Direct Service Access

**When to use**: Simple, one-way dependencies

```javascript
// In game code
const combat = engine.get('combat');
combat.startBattle(enemies);
```

### Pattern 2: Event-Based Integration

**When to use**: Loose coupling, multiple consumers

```javascript
// Producer
engine.emit('player:levelUp', { level: 5 });

// Consumer
engine.on('player:levelUp', (payload) => {
  showLevelUpModal(payload.level);
});
```

### Pattern 3: Service Injection

**When to use**: Testing, modularity

```javascript
export function createCombatSystem(engine) {
  const rng = engine.get('rng');
  const log = engine.get('log');

  return {
    attack(attacker, target) {
      const damage = rng.roll(10, 20);
      log.info('combat', 'Attack!', { damage });
      return damage;
    }
  };
}
```

### Pattern 4: Command Pattern

**When to use**: Undo/redo, replay, telemetry

```javascript
// Register handler
engine.commands.register('USE_ITEM', (payload, state) => {
  const { itemId } = payload;
  // Use item logic
  return newState;
});

// Dispatch command
engine.dispatch('USE_ITEM', { itemId: 'potion' });
```

### Pattern 5: Owner-Based Cleanup

**When to use**: UI screens, modals, temporary features

```javascript
function openTavernModal() {
  const owner = 'modal:tavern';

  // Schedule tasks
  engine.schedule.after(1000, updateTavern, { owner });

  // Register listeners
  engine.ownListener(owner, 'player:goldChanged', updateGoldDisplay);

  // When modal closes
  engine.disposeOwner(owner);  // Cleans up everything
}
```

## Best Practices

### 1. Use Owner-Based Cleanup

Always specify an `owner` for scheduled tasks, listeners, and tweens to prevent memory leaks.

```javascript
// ✅ Good
engine.schedule.after(1000, fn, { owner: 'modal:shop' });

// ❌ Bad (potential leak)
engine.schedule.after(1000, fn);
```

### 2. Prefer Engine Services Over Direct Imports

Use the service registry to avoid circular dependencies.

```javascript
// ✅ Good
const combat = engine.get('combat');
combat.startBattle(enemies);

// ❌ Bad (may cause circular dependency)
import { startBattle } from './combat.js';
startBattle(enemies);
```

### 3. Emit Events for Side Effects

Emit events after state changes so other systems can react.

```javascript
// ✅ Good
engine.setState(newState);
engine.emit('player:levelUp', { level: newLevel });

// ❌ Bad (tight coupling)
engine.setState(newState);
updateUI();
playSound();
saveGame();
```

### 4. Use Deterministic RNG When Needed

Seed the RNG for reproducible behavior in tests and bug reports.

```javascript
// For testing
engine.rng.seed(12345);
const result = engine.rng.roll(1, 20);  // Always same result

// For production
engine.rng.seed(Date.now());  // Random seed
```

### 5. Keep Plugins Focused

Each plugin should do one thing well. Don't create god plugins.

```javascript
// ✅ Good: Focused plugins
createCombatPlugin()
createInventoryPlugin()
createQuestPlugin()

// ❌ Bad: Monolithic plugin
createGameplayPlugin()  // Does everything
```

### 6. Handle Missing Optional Dependencies

Check for optional dependencies before using them.

```javascript
init(engine) {
  const audio = engine.get('audio');
  if (audio) {
    // Use audio service
    audio.play('music');
  } else {
    // Graceful degradation
    console.log('Audio not available');
  }
}
```

### 7. Validate State on Load

Always validate and repair state when loading saves.

```javascript
engine.load(savedState);

const state = engine.getState();
if (!state.player) {
  state.player = createDefaultPlayer();
}
if (!Number.isFinite(state.player.hp)) {
  state.player.hp = state.player.maxHp;
}
```

### 8. Use Structured Logging

Include context in log messages for easier debugging.

```javascript
// ✅ Good
engine.log.info('combat', 'Attack dealt damage', {
  attacker: 'player',
  target: 'goblin',
  damage: 45
});

// ❌ Bad
console.log('Attack: 45');
```

## Troubleshooting

### Plugin Not Starting

**Symptom**: Plugin's `start()` method not called

**Causes**:
1. Missing required dependency
2. Circular dependency
3. Plugin not registered
4. Engine not started

**Solution**:
```javascript
// Check plugin registration
console.log(engine.listPlugins());

// Check for dependency errors
engine.start();  // Will log dependency issues
```

### Circular Dependency

**Symptom**: "Circular dependency detected" error

**Causes**: Plugin A requires Plugin B, Plugin B requires Plugin A

**Solution**: Use optional dependencies or refactor

```javascript
// ✅ Good: Optional dependency
{
  id: 'pluginA',
  optionalRequires: ['pluginB']
}

// ✅ Good: Break dependency with events
// Instead of direct dependency, use events
engine.emit('pluginA:ready');
engine.on('pluginA:ready', handlePluginA);
```

### Memory Leaks

**Symptom**: Memory usage grows over time

**Causes**:
1. Listeners not removed
2. Scheduled tasks not cancelled
3. Tweens not disposed

**Solution**: Use owner-based cleanup

```javascript
// ✅ Good: Owner-based cleanup
const owner = 'screen:combat';
engine.ownListener(owner, 'combat:damage', handler);
engine.schedule.every(100, update, { owner });
engine.tween.to(obj, target, 1000, { owner });

// Cleanup everything at once
engine.disposeOwner(owner);
```

### State Not Updating

**Symptom**: State changes not reflected in UI

**Causes**:
1. Mutating state directly
2. Not emitting events
3. UI not listening to events

**Solution**: Use proper update pattern

```javascript
// ✅ Good
const state = engine.getState();
const newState = { ...state, player: { ...state.player, gold: 100 } };
engine.setState(newState);
engine.emit('player:goldChanged', { newGold: 100 });

// ❌ Bad
const state = engine.getState();
state.player.gold = 100;  // Direct mutation!
```

### Events Not Firing

**Symptom**: Event listeners not receiving events

**Causes**:
1. Wrong event name
2. Listener registered after event emitted
3. Listener removed prematurely

**Solution**: Enable event tracing

```javascript
// Enable event trace
engine.eventTrace.enable();

// Emit event
engine.emit('my:event', payload);

// Check trace
console.log(engine.eventTrace.list());
```

### Performance Issues

**Symptom**: Low FPS, slow frame times

**Causes**:
1. Too many listeners
2. Expensive computations in event handlers
3. Too many scheduled tasks

**Solution**: Profile and optimize

```javascript
// Profile code
engine.perf.mark('expensive-operation:start');
expensiveOperation();
engine.perf.mark('expensive-operation:end');
const duration = engine.perf.measure('expensive-operation:start', 'expensive-operation:end');
console.log(`Operation took ${duration}ms`);

// Check scheduled tasks
console.log(engine.schedule.listTasks());
```

## Engine Capabilities Overview

This section is the **connection map**: what Locus exposes and which Emberwood plugins/modules currently touch it.

### Core Engine Services

| Service (engine.getService) | Also exposed as | Used for | Current consumers |
|---|---|---|---|
| events | engine.on/off/emit | Pub/sub across systems | Most plugins + gameOrchestrator |
| clock | engine.clock | Deterministic clock + time scale | engine.schedule + tick loop |
| schedule | engine.schedule | after/every + cancelOwner | uiRuntime, autosave, simTick, saveManager |
| commands | engine.commands / engine.dispatch | UI/game command bus | uiCommands, gameCommands, gameOrchestrator |
| uiRouter | engine.ui | Modal stack + adapter hook | uiRuntime, uiCommands |
| input | engine.input | Action routing + contexts | inputContexts, uiCommands, UI bindings |
| snapshots | engine.save/load | Snapshot persistence format | saveManager |
| migrations | engine.migrations | Save migrations | saveManager |
| rng | engine.rng | Seeded RNG streams | game systems/rng.js (deterministic mode) |
| log | engine.log | Structured logging | Available for all systems |
| perf | engine.perf | Profiler/watchdog | diagnosticsOverlay (reports) |
| assets | engine.assets | Asset registry/preload | assetsManifest, screenAssetPreload |
| settings | engine.settings | Persistent user preferences | settings, a11yBridge, settings UI |
| a11y | engine.a11y | Derived accessibility prefs | a11yBridge |
| tween | engine.tween | Clock-driven tweens | uiRuntime (toasts), transitions |
| flags | engine.flags | Persistent feature flags | flags, telemetry, replayBridge |
| i18n | engine.i18n | Localization registry | i18n, diagnosticsOverlay |
| uiCompose | engine.uiCompose | Toast/busy/transition/HUD | uiComposeBridge, diagnosticsOverlay |
| savePolicy | engine.savePolicy | Dirty-state + flush policy | savePolicyBridge, autosave |
| replay | engine.replay | Command-based replay | replayBridge, diagnosticsOverlay |
| telemetry | engine.telemetry | Breadcrumbs + crash bundle | telemetry, diagnosticsOverlay |
| errorBoundary | engine.errorBoundary | Crash capture/report | Boot diagnostics + QA overlay |
| harness | engine.harness | Headless step runner | Smoke tests |

### Game Plugin Services

| Service name | Provided by | Purpose | Consumers |
|---|---|---|---|
| ui, ui.bindings | ew.uiRuntime | UI runtime + DOM bindings | diagnosticsOverlay, game boot |
| diagnostics | ew.diagnosticsOverlay | QA overlay helpers | gameOrchestrator, uiCommands |
| combat, combat.math, combat.status | ew.combatRuntime | Combat engines | gameOrchestrator |
| companionRuntime, combat.companion | ew.companionRuntime | Companion combat runtime | gameOrchestrator |
| world | ew.worldEvents | World event wrapper | questEvents, autosave |
| autosave | ew.autosave | Coalesced autosave | Internal |
| gameRng | ew.rngBridge | Legacy RNG helpers | Legacy game code |
| audio | ew.audioBridge | Audio helpers | UI runtime |

## File Map

Complete list of engine modules:

- **`engine.js`** — Engine creation, plugin lifecycle, core wiring
- **`clock.js`** — Deterministic clock
- **`scheduler.js`** — Clock-driven scheduler (with ownership)
- **`uiRouter.js`** — Modal stack/router
- **`commands.js`** — Command bus + middleware
- **`snapshots.js`** — Snapshot save/load helpers
- **`migrations.js`** — Migration registry
- **`logger.js`** — Structured logging
- **`errorBoundary.js`** — Crash capture/report builder
- **`eventTrace.js`** — Event tracing
- **`perf.js`** / **`profiler.js`** — Performance tools
- **`rng.js`** — Seeded RNG streams
- **`input.js`** — Input normalization/router
- **`assets.js`** — Asset registry/preload helpers
- **`settings.js`** — Persistent settings registry
- **`a11y.js`** — Accessibility preferences (OS + user)
- **`tween.js`** — Clock-driven tween/animation service
- **`flags.js`** — Persistent feature flags/experiments
- **`i18n.js`** — Localization registry
- **`uiCompose.js`** — UI composition surface (toast/busy/transition/HUD)
- **`savePolicy.js`** — Dirty-state + transactional flush policy
- **`replay.js`** — Command replay recorder/player
- **`telemetry.js`** — Breadcrumbs + crash bundle persistence
- **`storageRuntime.js`** — Browser storage helpers
- **`harness.js`** — Headless test harness
- **`qa.js`** — QA utilities and smoke test helpers
- **`README.md`** — This file

## Quick Usage Example

```javascript
import { createEngine } from './js/engine/engine.js';

// Create engine
const engine = createEngine({ 
  initialState: { player: { hp: 100 } },
  patch: '1.2.82',
  patchName: 'Engine Enhancement'
});

// Register plugins
engine.use(myPlugin);

// Start engine
engine.start();

// Use services
const combat = engine.get('combat');
combat.startBattle(enemies);

// Schedule with ownership
engine.schedule.after(250, () => {
  console.log('Delayed action');
}, { owner: 'modal:tavern' });

// Cleanup (when tavern modal closes)
engine.disposeOwner('modal:tavern');
engine.schedule.cancelOwner('modal:tavern');

// Stop engine
engine.stop();
```

## Migration Guide

### Moving from Direct Imports to Engine Services

**Before (tight coupling):**
```javascript
import { startBattle } from '../combat/combat.js';
import { addGold } from '../player/gold.js';

function onVictory() {
  addGold(50);
}
```

**After (loose coupling via engine):**
```javascript
function onVictory(engine) {
  engine.emit('combat:victory', { goldEarned: 50 });
}

// In player plugin
engine.on('combat:victory', (payload) => {
  const state = engine.getState();
  const newState = {
    ...state,
    player: {
      ...state.player,
      gold: state.player.gold + payload.goldEarned
    }
  };
  engine.setState(newState);
});
```

### Moving from setTimeout to Engine Scheduler

**Before (not deterministic):**
```javascript
setTimeout(() => {
  updateUI();
}, 1000);
```

**After (deterministic + cleanup):**
```javascript
engine.schedule.after(1000, () => {
  updateUI();
}, { owner: 'screen:village' });

// Auto-cleanup when screen changes
engine.disposeOwner('screen:village');
```

### Moving from Global State to Engine State

**Before (global mutable state):**
```javascript
let globalState = { player: { hp: 100 } };

function takeDamage(amount) {
  globalState.player.hp -= amount;
}
```

**After (engine-managed state):**
```javascript
function takeDamage(engine, amount) {
  const state = engine.getState();
  const newHp = Math.max(0, state.player.hp - amount);
  
  engine.setState({
    ...state,
    player: {
      ...state.player,
      hp: newHp
    }
  });
  
  engine.emit('player:damaged', { amount, newHp });
}
```

---

## Contributing

When adding new engine features:

1. **Keep it game-agnostic**: No Emberwood-specific logic in engine
2. **Write tests**: Add tests in `qa.js` or separate test file
3. **Document services**: Update this README with examples
4. **Version migrations**: If state structure changes, add migration
5. **Follow patterns**: Use existing patterns (services, events, ownership)

## License

See repository root for license information.

---

**Made with ❤️ for Emberwood: The Blackbark Oath**
