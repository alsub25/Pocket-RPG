# Module Import Guidelines

## Overview

Emberwood uses native ES6 modules with a layered architecture to prevent circular dependencies and maintain clear boundaries between systems.

## Layer Architecture

The codebase follows a strict layered architecture with dependency rules:

```
┌─────────────────────────────────────────┐
│         Game Layer (js/game/)           │
│  - Game-specific logic & content        │
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
                   ↑
┌─────────────────────────────────────────┐
│        Boot Layer (js/boot/)            │
│  - First code to execute                │
│  - Minimal dependencies                 │
│  - Depends on: Shared only              │
└─────────────────────────────────────────┘
```

## Import Rules

### 1. Always Use Explicit Imports

```javascript
// ✅ Good: Explicit imports with .js extension
import { saveGame } from './persistence/saveManager.js';
import { rollDice } from '../systems/rng/rng.js';

// ❌ Bad: Missing file extension
import { saveGame } from './persistence/saveManager';

// ❌ Bad: Absolute imports (require bundler)
import { saveGame } from '@/persistence/saveManager';
```

### 2. Respect Layer Boundaries

```javascript
// ✅ Good: Game layer importing from Engine layer
// File: js/game/runtime/gameOrchestrator.js
import { Engine } from '../../engine/engine.js';

// ✅ Good: Engine layer importing from Shared layer
// File: js/engine/engine.js
import { safeStorage } from '../shared/storage/safeStorage.js';

// ❌ Bad: Engine layer importing from Game layer (violates architecture)
// File: js/engine/engine.js
import { ITEM_DEFS } from '../game/data/items.js'; // DON'T DO THIS!

// ❌ Bad: Shared layer importing from any other layer
// File: js/shared/storage/safeStorage.js
import { Engine } from '../../engine/engine.js'; // DON'T DO THIS!
```

### 3. Avoid Circular Dependencies

```javascript
// ❌ Bad: Circular dependency
// File: moduleA.js
import { funcB } from './moduleB.js';
export function funcA() { return funcB(); }

// File: moduleB.js
import { funcA } from './moduleA.js';
export function funcB() { return funcA(); }

// ✅ Good: Extract shared logic to a third module
// File: moduleC.js (shared utilities)
export function sharedLogic() { /* ... */ }

// File: moduleA.js
import { sharedLogic } from './moduleC.js';
export function funcA() { return sharedLogic(); }

// File: moduleB.js
import { sharedLogic } from './moduleC.js';
export function funcB() { return sharedLogic(); }
```

### 4. Use Dependency Injection for Cross-Layer Communication

```javascript
// ✅ Good: Engine provides services, game consumes them
// File: js/game/runtime/gameOrchestrator.js
export function initGame(engine) {
  // Engine service injected as parameter
  const rng = engine.get('rng');
  const state = engine.getState();
  // Use injected dependencies
}

// ❌ Bad: Direct import creates tight coupling
import { rng } from '../../engine/services/rng.js';
```

### 5. iOS Safari / ES Module Pitfalls

#### Temporal Dead Zone (TDZ) Issues

```javascript
// ❌ Bad: Reference before initialization (TDZ error on iOS)
export const myFunc = () => otherFunc();
export const otherFunc = () => { /* ... */ };

// ✅ Good: Function declarations hoist
export function myFunc() { return otherFunc(); }
export function otherFunc() { /* ... */ }
```

#### Read-Only Imports

```javascript
// ❌ Bad: Cannot reassign imported bindings
import { gameState } from './state.js';
gameState = newState; // ERROR on iOS Safari!

// ✅ Good: Use functions to update state
import { updateGameState } from './state.js';
const newState = updateGameState(changes);
```

#### Module Evaluation Order

```javascript
// ❌ Bad: Side effects during module evaluation
import { startEngine } from './engine.js';
startEngine(); // Called during import! Can fail on iOS

// ✅ Good: Export initialization function
export function initGame() {
  startEngine();
}
```

## Common Patterns

### Pattern 1: Service Registration

```javascript
// Service definition
export class MyService {
  init(engine) {
    this.engine = engine;
  }
  
  doSomething() {
    // Use engine services
    const state = this.engine.getState();
  }
}

// Plugin registration
export const myServicePlugin = {
  id: 'my.service',
  init(engine) {
    engine.register('my.service', new MyService());
  },
  start(engine) {
    engine.get('my.service').init(engine);
  }
};
```

### Pattern 2: Event-Driven Communication

```javascript
// ✅ Good: Use events instead of direct imports
// Producer (doesn't know about consumers)
engine.emit('quest:completed', { questId: 'main_quest' });

// Consumer (doesn't know about producer)
engine.on('quest:completed', (data) => {
  // React to quest completion
  updateUI(data.questId);
});
```

### Pattern 3: State Access

```javascript
// ✅ Good: Single source of truth through engine
const state = engine.getState();
const playerHp = state.player.hp;

// Update state immutably
engine.setState({
  ...state,
  player: {
    ...state.player,
    hp: newHp
  }
});

// ❌ Bad: Direct state mutation
state.player.hp = newHp; // Don't mutate directly!
```

## Troubleshooting

### Issue: "Cannot find module"

**Symptom**: `Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/plain"`

**Solution**: Ensure you're serving from an HTTP server, not file:// protocol. Use Python, Node, or any web server.

### Issue: "Uncaught SyntaxError: The requested module does not provide an export named 'X'"

**Symptom**: Import fails even though export exists

**Solutions**:
1. Check for typos in import/export names
2. Verify the file exports the named export
3. Check for circular dependencies
4. Ensure .js extension is included

### Issue: "Cannot access 'X' before initialization"

**Symptom**: Temporal Dead Zone error on iOS Safari

**Solutions**:
1. Use function declarations instead of arrow functions
2. Avoid referencing imports at module evaluation time
3. Move initialization logic into init() functions

## Best Practices

1. **One Module, One Responsibility**: Each module should have a single, clear purpose
2. **Explicit is Better**: Always use explicit imports, even for types
3. **Minimize Export Surface**: Only export what's needed by other modules
4. **Document Public APIs**: Add JSDoc comments for exported functions
5. **Use Relative Paths**: Keep imports relative for portability
6. **Test on iOS**: Always test imports on iOS Safari (strictest ES module implementation)

## Migration Checklist

When refactoring modules:

- [ ] Verify no circular dependencies (use `madge` or manual review)
- [ ] Check layer boundaries respected
- [ ] Ensure .js extensions on all imports
- [ ] Test on iOS Safari (file:// and HTTP)
- [ ] Add JSDoc comments for public APIs
- [ ] Update any documentation that references old structure
- [ ] Run smoke tests to verify no regressions

## Further Reading

- [MDN: JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [ES Modules: A Cartoon Deep-Dive](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/)
- Project: `/js/engine/README.md` - Engine architecture
- Project: `/README.md` - Overall project structure
