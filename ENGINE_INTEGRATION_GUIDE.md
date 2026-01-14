# Engine Integration Guide for Emberwood

This guide explains how to ensure all game systems run through the Locus Engine properly using immutable state updates, event emissions, and service registration.

## Table of Contents

- [Overview](#overview)
- [Core Principles](#core-principles)
- [Creating an Engine-Integrated Service](#creating-an-engine-integrated-service)
- [State Management Patterns](#state-management-patterns)
- [Event Emission Best Practices](#event-emission-best-practices)
- [Plugin Development](#plugin-development)
- [Migration Examples](#migration-examples)
- [Testing Engine Integration](#testing-engine-integration)

## Overview

Running systems "through the engine" means:

1. **All state mutations** go through `engine.setState()` with immutable updates
2. **All significant changes** emit events via `engine.emit()`
3. **Services are registered** with the engine for dependency injection
4. **Plugins manage lifecycle** with proper init/start/stop/dispose hooks
5. **No direct state mutations** - always create new objects with spread operators

## Core Principles

### ❌ BAD: Direct State Mutation

```javascript
// DON'T DO THIS
function handleEconomyTick(state, day) {
  state.villageEconomy.prosperity += 5;
  state.villageEconomy.lastDayUpdated = day;
}
```

### ✅ GOOD: Immutable Update Through Engine

```javascript
// DO THIS INSTEAD
function handleEconomyTick(day) {
  const state = engine.getState();
  const econ = state.villageEconomy;
  
  const newState = {
    ...state,
    villageEconomy: {
      ...econ,
      prosperity: econ.prosperity + 5,
      lastDayUpdated: day
    }
  };
  
  engine.setState(newState);
  engine.emit('village:economyTick', { day, prosperity: newState.villageEconomy.prosperity });
}
```

## Creating an Engine-Integrated Service

### Step 1: Create the Service File

Create a file in `js/game/services/` that exports a factory function:

```javascript
// js/game/services/mySystemService.js

export function createMySystemService(engine) {
  if (!engine) throw new Error('MySystemService requires engine instance');

  // Get dependencies from engine
  const rng = engine.get('rng');
  
  function initializeState(state) {
    if (!state.mySystem) {
      return {
        ...state,
        mySystem: {
          value: 0,
          lastUpdated: null
        }
      };
    }
    return state;
  }

  function updateValue(delta) {
    const state = engine.getState();
    const stateWithSystem = initializeState(state);
    const mySystem = stateWithSystem.mySystem;

    const newValue = mySystem.value + delta;

    const newState = {
      ...stateWithSystem,
      mySystem: {
        ...mySystem,
        value: newValue,
        lastUpdated: Date.now()
      }
    };

    engine.setState(newState);
    
    engine.emit('mySystem:valueChanged', {
      oldValue: mySystem.value,
      newValue,
      delta
    });

    return newValue;
  }

  // Public API
  return {
    initializeState: () => {
      const state = engine.getState();
      const newState = initializeState(state);
      if (newState !== state) {
        engine.setState(newState);
      }
    },
    
    getValue: () => {
      const state = engine.getState();
      const stateWithSystem = initializeState(state);
      if (stateWithSystem !== state) {
        engine.setState(stateWithSystem);
      }
      return stateWithSystem.mySystem.value;
    },
    
    updateValue
  };
}
```

### Step 2: Create the Plugin

Create a plugin file in `js/game/plugins/`:

```javascript
// js/game/plugins/mySystemPlugin.js

import { createMySystemService } from '../services/mySystemService.js';

export function createMySystemPlugin() {
  let mySystemService = null;

  return {
    id: 'ew.mySystem',
    requires: ['ew.rngBridge'], // List dependencies

    init(engine) {
      try {
        mySystemService = createMySystemService(engine);
        engine.registerService('mySystem', mySystemService);
        mySystemService.initializeState();

        engine.log?.info?.('mySystem', 'Service registered with engine');
      } catch (e) {
        engine.log?.error?.('mySystem', 'Failed to register service', { error: e.message });
      }
    },

    start(engine) {
      // Subscribe to relevant events
      engine.on('someEvent', (payload) => {
        if (mySystemService) {
          mySystemService.updateValue(payload.delta);
        }
      });

      engine.log?.info?.('mySystem', 'Service started');
    },

    stop(engine) {
      // Cleanup event listeners
      engine.off('someEvent');
      engine.log?.info?.('mySystem', 'Service stopped');
    },

    dispose(engine) {
      try {
        engine.unregisterService('mySystem');
      } catch (_) {}
      mySystemService = null;
    }
  };
}
```

### Step 3: Register the Plugin

In `js/game/runtime/gameOrchestrator.js`:

```javascript
// Add import
import { createMySystemPlugin } from '../plugins/mySystemPlugin.js';

// In the plugin registration section
_engine.use(createMySystemPlugin())
```

## State Management Patterns

### Pattern 1: Nested State Update

```javascript
// Updating deeply nested state
const state = engine.getState();

const newState = {
  ...state,
  village: {
    ...state.village,
    economy: {
      ...state.village.economy,
      prosperity: newProsperityValue
    }
  }
};

engine.setState(newState);
```

### Pattern 2: Array Updates

```javascript
// Adding to an array
const state = engine.getState();

const newState = {
  ...state,
  items: [...state.items, newItem]
};

engine.setState(newState);

// Removing from an array
const newState = {
  ...state,
  items: state.items.filter(item => item.id !== removeId)
};

engine.setState(newState);

// Updating array element
const newState = {
  ...state,
  items: state.items.map(item => 
    item.id === updateId 
      ? { ...item, value: newValue }
      : item
  )
};

engine.setState(newState);
```

### Pattern 3: Conditional Initialization

```javascript
function ensureMyState(state) {
  if (!state.myData) {
    return {
      ...state,
      myData: { /* defaults */ }
    };
  }
  return state;
}

function updateMyData(newValue) {
  const state = engine.getState();
  const stateWithData = ensureMyState(state);
  
  const newState = {
    ...stateWithData,
    myData: {
      ...stateWithData.myData,
      value: newValue
    }
  };
  
  engine.setState(newState);
}
```

## Event Emission Best Practices

### Event Naming Convention

Use the pattern: `<system>:<action>`

Examples:
- `village:economyTick`
- `combat:victory`
- `player:levelUp`
- `time:dayChanged`
- `quest:completed`

### Event Payload Structure

Always include relevant context:

```javascript
engine.emit('village:economyAfterBattle', {
  enemy: enemyData,
  area: 'forest',
  securityDelta: 8,
  prosperityDelta: 4.8,
  newTierId: 'stable'
});
```

### When to Emit Events

Emit events for:
- State changes that other systems might care about
- User actions (after processing)
- Significant milestones (level ups, quest completions)
- Periodic updates (daily ticks, hourly events)

Don't emit for:
- Internal/private state changes
- Intermediate calculation steps
- Too frequent updates (every frame)

## Plugin Development

### Plugin Lifecycle

```javascript
export function createMyPlugin() {
  return {
    id: 'ew.myPlugin',
    requires: ['ew.uiRuntime'],      // Hard dependencies
    optionalRequires: ['ew.audio'],   // Soft dependencies
    
    init(engine) {
      // One-time initialization
      // - Register services
      // - Set up initial state
      // - Register event listeners (that need early setup)
    },
    
    start(engine) {
      // Start runtime work
      // - Subscribe to events
      // - Start timers/intervals
      // - Begin periodic tasks
    },
    
    stop(engine) {
      // Stop runtime work
      // - Unsubscribe from events
      // - Clear timers/intervals
      // - Pause periodic tasks
    },
    
    dispose(engine) {
      // Final cleanup
      // - Unregister services
      // - Release resources
      // - Clear references
    }
  };
}
```

### Owner-Based Cleanup

For UI-related code, use owner-based cleanup:

```javascript
start(engine) {
  const owner = 'plugin:myPlugin';
  
  engine.schedule.every(1000, () => {
    // Periodic task
  }, { owner });
  
  engine.ownListener(owner, 'someEvent', handler);
}

stop(engine) {
  const owner = 'plugin:myPlugin';
  engine.schedule.cancelOwner(owner);
  engine.disposeOwner(owner);
}
```

## Migration Examples

### Example 1: Village Economy

**Before (Direct Mutation):**

```javascript
export function handleEconomyDayTick(state, absoluteDay) {
  const econ = initVillageEconomyState(state);
  
  if (econ.lastDayUpdated === absoluteDay) return;
  econ.lastDayUpdated = absoluteDay;
  
  const drift = (rngFloat(null, 'economy.drift') - 0.45) * 6;
  econ.prosperity = clamp(econ.prosperity + drift, 0, 100);
  
  recomputeTier(econ);
}
```

**After (Engine-Integrated):**

```javascript
export function createVillageEconomyService(engine) {
  const rng = engine.get('rng');
  
  function handleDayTick(absoluteDay) {
    const state = engine.getState();
    const econ = state.villageEconomy;
    
    if (econ.lastDayUpdated === absoluteDay) return;
    
    const drift = (rng.random() - 0.45) * 6;
    const newProsperity = clamp(econ.prosperity + drift, 0, 100);
    
    const updatedEcon = {
      ...econ,
      prosperity: newProsperity,
      lastDayUpdated: absoluteDay
    };
    
    recomputeTier(updatedEcon);
    
    const newState = {
      ...state,
      villageEconomy: updatedEcon
    };
    
    engine.setState(newState);
    engine.emit('village:economyTick', { 
      day: absoluteDay, 
      prosperity: updatedEcon.prosperity 
    });
  }
  
  return { handleDayTick };
}
```

### Example 2: Time System

**Before:**

```javascript
export function advanceTime(state, steps = 1) {
  const time = initTimeState(state);
  const before = getTimeInfo(state);
  
  // Mutate state directly
  while (steps > 0) {
    time.partIndex++;
    if (time.partIndex >= DAY_PARTS.length) {
      time.partIndex = 0;
      time.dayIndex++;
    }
    steps--;
  }
  
  return { before, after: getTimeInfo(state) };
}
```

**After:**

```javascript
export function createTimeService(engine) {
  function advanceTime(steps = 1) {
    const state = engine.getState();
    const time = state.time;
    const before = getTimeInfo(state);
    
    let newDayIndex = time.dayIndex;
    let newPartIndex = time.partIndex;
    
    // Calculate new values immutably
    while (steps > 0) {
      newPartIndex++;
      if (newPartIndex >= DAY_PARTS.length) {
        newPartIndex = 0;
        newDayIndex++;
      }
      steps--;
    }
    
    const newState = {
      ...state,
      time: { dayIndex: newDayIndex, partIndex: newPartIndex }
    };
    
    engine.setState(newState);
    
    const after = getTimeInfo(newState);
    
    engine.emit('time:advanced', { before, after });
    if (after.absoluteDay !== before.absoluteDay) {
      engine.emit('time:dayChanged', { 
        oldDay: before.absoluteDay, 
        newDay: after.absoluteDay 
      });
    }
    
    return { before, after };
  }
  
  return { advanceTime };
}
```

## Testing Engine Integration

### Unit Testing Services

```javascript
// Test immutability
test('service does not mutate state', () => {
  const mockEngine = createMockEngine();
  const service = createMyService(mockEngine);
  
  const originalState = mockEngine.getState();
  service.updateValue(10);
  
  // Original state should be unchanged
  expect(originalState.mySystem.value).toBe(0);
  
  // New state should be different object
  const newState = mockEngine.getState();
  expect(newState).not.toBe(originalState);
  expect(newState.mySystem.value).toBe(10);
});

// Test event emissions
test('service emits events on changes', () => {
  const mockEngine = createMockEngine();
  const service = createMyService(mockEngine);
  
  const events = [];
  mockEngine.on('mySystem:valueChanged', (payload) => {
    events.push(payload);
  });
  
  service.updateValue(5);
  
  expect(events).toHaveLength(1);
  expect(events[0].newValue).toBe(5);
  expect(events[0].delta).toBe(5);
});
```

### Integration Testing

```javascript
// Test plugin lifecycle
test('plugin registers and initializes correctly', () => {
  const engine = createEngine({ initialState: {} });
  const plugin = createMySystemPlugin();
  
  engine.use(plugin);
  engine.start();
  
  // Service should be registered
  const service = engine.get('mySystem');
  expect(service).toBeDefined();
  
  // State should be initialized
  const state = engine.getState();
  expect(state.mySystem).toBeDefined();
  
  engine.stop();
});
```

## Checklist for Engine Integration

When adding a new system or refactoring an existing one:

- [ ] Created service file in `js/game/services/`
- [ ] Service uses `engine.getState()` to read state
- [ ] All state updates use `engine.setState()` with spread operators
- [ ] State updates are immutable (no direct mutations)
- [ ] Service emits events for significant changes
- [ ] Event names follow `<system>:<action>` convention
- [ ] Event payloads include relevant context
- [ ] Created plugin file in `js/game/plugins/`
- [ ] Plugin has proper lifecycle hooks (init/start/stop/dispose)
- [ ] Plugin registers service with `engine.registerService()`
- [ ] Plugin unregisters service in `dispose()`
- [ ] Plugin subscribes to relevant events in `start()`
- [ ] Plugin unsubscribes from events in `stop()`
- [ ] Plugin registered in `gameOrchestrator.js`
- [ ] Added JSDoc comments for public API
- [ ] Updated CHANGELOG with changes
- [ ] Tested with smoke tests
- [ ] Verified no memory leaks (listeners/timers cleaned up)

## Additional Resources

- [Engine README](js/engine/README.md) - Complete engine documentation
- [Plugin Examples](js/game/plugins/) - See existing plugins for reference
- [Service Examples](js/game/services/) - See existing services for patterns

## Questions?

If you're unsure about engine integration:

1. Check existing services (village economy, time, population) as examples
2. Review the engine README for patterns and best practices
3. Look at plugin examples to understand the lifecycle
4. Test your changes with smoke tests
5. Verify events are being emitted correctly with event tracing

Remember: **All state changes should flow through the engine with immutable updates and event emissions!**
