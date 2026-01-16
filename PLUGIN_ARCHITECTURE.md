# Plugin Architecture Guide

## Overview

Emberwood uses a plugin-based architecture where game systems are registered as modular plugins with the Locus Engine. This pattern enables:

- **Loose coupling**: Systems communicate via events instead of direct dependencies
- **Clean lifecycle management**: Plugins have init/start/stop/dispose hooks
- **Service registry**: Shared services accessible via `engine.get()`
- **Testability**: Plugins can be loaded/unloaded for isolated testing
- **Memory safety**: Owner-based cleanup prevents leaks

## Plugin Lifecycle

Every plugin follows a four-phase lifecycle:

```
┌──────┐    ┌───────┐    ┌──────┐    ┌─────────┐
│ INIT │ -> │ START │ -> │ STOP │ -> │ DISPOSE │
└──────┘    └───────┘    └──────┘    └─────────┘
```

### 1. INIT Phase

Called once when the plugin is first registered. Use this to:
- Register services with the engine
- Set up internal state (don't mutate game state yet)
- Declare dependencies on other plugins

```javascript
init(engine, config) {
  // Register a service
  engine.register('my.service', new MyService());
  
  // Store engine reference for later
  this._engine = engine;
}
```

### 2. START Phase

Called when `engine.start()` is invoked. Use this to:
- Subscribe to engine events
- Initialize services with game state
- Begin active operation

```javascript
start(engine) {
  // Subscribe to events
  this._listener = (data) => this._handleEvent(data);
  engine.on('game:ready', this._listener);
  
  // Initialize service
  const service = engine.get('my.service');
  service.init(engine.getState());
}
```

### 3. STOP Phase

Called when `engine.stop()` is invoked. Use this to:
- Unsubscribe from engine events
- Cancel scheduled tasks
- Clean up resources

```javascript
stop(engine) {
  // Unsubscribe from events
  if (this._listener) {
    engine.off('game:ready', this._listener);
    this._listener = null;
  }
  
  // Cancel scheduled tasks
  engine.schedule.cancelOwner(`plugin:${this.id}`);
}
```

### 4. DISPOSE Phase

Called when the plugin is being permanently removed. Use this to:
- Unregister services
- Release any remaining resources
- Clear all internal state

```javascript
dispose(engine) {
  // Unregister service
  engine.unregister('my.service');
  
  // Clear internal state
  this._engine = null;
}
```

## Plugin Structure

### Minimal Plugin Template

```javascript
// File: js/game/plugins/myPlugin.js

/**
 * My Plugin
 * Brief description of what this plugin does
 */
export const myPlugin = {
  id: 'my.plugin',
  
  // Optional: declare dependencies
  requires: ['other.plugin'],
  optionalRequires: ['optional.plugin'],
  
  init(engine, config) {
    // Register services, set up internal state
  },
  
  start(engine) {
    // Subscribe to events, begin operation
  },
  
  stop(engine) {
    // Clean up event listeners, cancel tasks
  },
  
  dispose(engine) {
    // Unregister services, final cleanup
  }
};
```

### Service Plugin Template

```javascript
// File: js/game/services/myService.js

/**
 * My Service
 * Handles X, Y, and Z for the game
 */
class MyService {
  constructor() {
    this._initialized = false;
  }
  
  init(engine) {
    this._engine = engine;
    this._initialized = true;
  }
  
  // Public API methods
  doSomething(param) {
    if (!this._initialized) {
      throw new Error('MyService not initialized');
    }
    // Implementation
  }
}

// Plugin that registers the service
export const myServicePlugin = {
  id: 'my.service',
  
  init(engine) {
    engine.register('my.service', new MyService());
  },
  
  start(engine) {
    engine.get('my.service').init(engine);
  },
  
  stop(engine) {
    // Service cleanup if needed
  },
  
  dispose(engine) {
    engine.unregister('my.service');
  }
};
```

## Plugin Patterns

### Pattern 1: Event-Driven Plugin

Listens to engine events and reacts accordingly.

```javascript
export const eventDrivenPlugin = {
  id: 'event.driven',
  
  start(engine) {
    // Store listener references for cleanup
    this._listeners = {
      combatStart: (data) => this._onCombatStart(data),
      combatEnd: (data) => this._onCombatEnd(data)
    };
    
    // Subscribe to events
    engine.on('combat:start', this._listeners.combatStart);
    engine.on('combat:end', this._listeners.combatEnd);
  },
  
  stop(engine) {
    // Unsubscribe from all events
    if (this._listeners) {
      engine.off('combat:start', this._listeners.combatStart);
      engine.off('combat:end', this._listeners.combatEnd);
      this._listeners = null;
    }
  },
  
  _onCombatStart(data) {
    // Handle combat start
  },
  
  _onCombatEnd(data) {
    // Handle combat end
  }
};
```

### Pattern 2: State Management Plugin

Manages a slice of game state through immutable updates.

```javascript
export const statePlugin = {
  id: 'state.manager',
  
  start(engine) {
    // Initialize state if missing
    const state = engine.getState();
    if (!state.myFeature) {
      engine.setState({
        ...state,
        myFeature: this._getDefaultState()
      });
    }
  },
  
  _getDefaultState() {
    return {
      counter: 0,
      flags: {}
    };
  },
  
  // Provide public API for state updates
  increment(engine) {
    const state = engine.getState();
    engine.setState({
      ...state,
      myFeature: {
        ...state.myFeature,
        counter: state.myFeature.counter + 1
      }
    });
    
    // Emit event for changes
    engine.emit('myfeature:incremented', { 
      newValue: state.myFeature.counter + 1 
    });
  }
};
```

### Pattern 3: UI Bridge Plugin

Connects engine services to DOM elements.

```javascript
export const uiBridgePlugin = {
  id: 'ui.bridge',
  
  requires: ['ui.compose'], // Depends on UI composition service
  
  start(engine) {
    // Get UI service
    const uiCompose = engine.get('ui.compose');
    
    // Subscribe to game events and update UI
    this._listener = (data) => {
      uiCompose.toast({
        message: `Event occurred: ${data.type}`,
        duration: 2000
      });
    };
    
    engine.on('game:event', this._listener);
  },
  
  stop(engine) {
    if (this._listener) {
      engine.off('game:event', this._listener);
      this._listener = null;
    }
  }
};
```

### Pattern 4: Command Handler Plugin

Handles specific commands from the command bus.

```javascript
export const commandPlugin = {
  id: 'command.handler',
  
  start(engine) {
    // Register command handlers
    this._handlers = {
      'PLAYER_ATTACK': (cmd) => this._handleAttack(cmd),
      'PLAYER_HEAL': (cmd) => this._handleHeal(cmd)
    };
    
    // Subscribe to command dispatch
    this._listener = (cmd) => {
      const handler = this._handlers[cmd.type];
      if (handler) {
        handler(cmd);
      }
    };
    
    engine.on('command:dispatch', this._listener);
  },
  
  stop(engine) {
    if (this._listener) {
      engine.off('command:dispatch', this._listener);
      this._listener = null;
      this._handlers = null;
    }
  },
  
  _handleAttack(cmd) {
    // Handle attack command
  },
  
  _handleHeal(cmd) {
    // Handle heal command
  }
};
```

## Plugin Registration

### Registering a Single Plugin

```javascript
// File: js/game/main.js
import { Engine } from '../engine/engine.js';
import { myPlugin } from './plugins/myPlugin.js';

const engine = new Engine();
engine.registerPlugin(myPlugin);
engine.start();
```

### Registering Multiple Plugins

```javascript
// File: js/game/main.js
import { Engine } from '../engine/engine.js';
import { plugin1 } from './plugins/plugin1.js';
import { plugin2 } from './plugins/plugin2.js';
import { plugin3 } from './plugins/plugin3.js';

const engine = new Engine();

// Register all plugins
[plugin1, plugin2, plugin3].forEach(plugin => {
  engine.registerPlugin(plugin);
});

// Engine resolves dependency order and starts plugins
engine.start();
```

### Plugin Dependencies

The engine automatically resolves plugin start order based on `requires` and `optionalRequires`:

```javascript
export const dependentPlugin = {
  id: 'dependent.plugin',
  
  // This plugin requires 'base.plugin' to be started first
  requires: ['base.plugin'],
  
  // This plugin will use 'optional.plugin' if available
  optionalRequires: ['optional.plugin'],
  
  start(engine) {
    // base.plugin is guaranteed to be started
    const baseService = engine.get('base.service');
    
    // Check if optional plugin is available
    if (engine.hasPlugin('optional.plugin')) {
      const optionalService = engine.get('optional.service');
      // Use optional service
    }
  }
};
```

## Best Practices

### 1. Owner-Based Resource Cleanup

Always tag scheduled tasks with an owner for automatic cleanup:

```javascript
start(engine) {
  const owner = `plugin:${this.id}`;
  
  // Schedule tasks with owner
  engine.schedule.after(1000, () => {
    // Task code
  }, { owner });
  
  engine.schedule.every(5000, () => {
    // Repeating task
  }, { owner });
}

stop(engine) {
  // Cancel all tasks owned by this plugin
  engine.schedule.cancelOwner(`plugin:${this.id}`);
}
```

### 2. Immutable State Updates

Always use spread operators for state updates:

```javascript
// ✅ Good: Immutable update
const state = engine.getState();
engine.setState({
  ...state,
  myFeature: {
    ...state.myFeature,
    value: newValue
  }
});

// ❌ Bad: Direct mutation
const state = engine.getState();
state.myFeature.value = newValue; // DON'T DO THIS!
```

### 3. Event Naming Conventions

Follow consistent event naming:

- Use namespace:action format (e.g., `combat:start`, `quest:completed`)
- Use present tense for ongoing actions (`combat:damaging`)
- Use past tense for completed actions (`combat:damaged`)
- Use nouns for state changes (`quest:completed`, `item:equipped`)

### 4. Error Handling

Always handle errors gracefully:

```javascript
start(engine) {
  try {
    // Plugin initialization
    const service = engine.get('required.service');
    service.init();
  } catch (error) {
    // Log error and provide fallback
    console.error(`Failed to start ${this.id}:`, error);
    
    // Emit error event for monitoring
    engine.emit('plugin:error', {
      plugin: this.id,
      phase: 'start',
      error: error.message
    });
    
    // Optionally provide degraded functionality
    this._useFallback();
  }
}
```

### 5. Service API Design

Design services with clear, focused APIs:

```javascript
class MyService {
  // ✅ Good: Clear, focused methods
  getPlayerStats(playerId) { /* ... */ }
  updatePlayerStat(playerId, stat, value) { /* ... */ }
  
  // ❌ Bad: Vague, do-everything method
  doPlayerThing(action, data) { /* ... */ }
}
```

## Testing Plugins

### Unit Testing a Plugin

```javascript
// File: tests/plugins/myPlugin.test.js
import { Engine } from '../../js/engine/engine.js';
import { myPlugin } from '../../js/game/plugins/myPlugin.js';

describe('myPlugin', () => {
  let engine;
  
  beforeEach(() => {
    engine = new Engine();
    engine.registerPlugin(myPlugin);
  });
  
  afterEach(() => {
    engine.stop();
  });
  
  it('should register service', () => {
    engine.start();
    expect(engine.get('my.service')).toBeDefined();
  });
  
  it('should handle events', () => {
    engine.start();
    
    const spy = jest.fn();
    engine.on('my:event', spy);
    
    // Trigger plugin behavior
    engine.emit('trigger:event');
    
    expect(spy).toHaveBeenCalled();
  });
});
```

## Troubleshooting

### Issue: Plugin not starting

**Symptoms**: Plugin's `start()` method never called

**Solutions**:
1. Check if plugin is registered: `engine.hasPlugin('plugin.id')`
2. Check for dependency errors in console
3. Verify `engine.start()` is called
4. Check for errors in `init()` phase

### Issue: Memory leaks after plugin stop

**Symptoms**: Event listeners still active, timers still running

**Solutions**:
1. Ensure `stop()` unsubscribes from all events
2. Use `engine.schedule.cancelOwner()` to cancel timers
3. Clear all internal references to prevent GC issues

### Issue: Circular dependencies

**Symptoms**: Plugins fail to start due to dependency cycle

**Solutions**:
1. Review `requires` declarations
2. Use events instead of direct service calls
3. Extract shared logic to a third plugin
4. Use `optionalRequires` if dependency is not strict

## Further Reading

- `/js/engine/README.md` - Engine architecture and services
- `/IMPORT_GUIDELINES.md` - Module import best practices
- `/js/game/plugins/` - Existing plugin examples
