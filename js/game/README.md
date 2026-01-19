# 🎮 Game Layer

The **game** folder contains Emberwood-specific gameplay logic, content, and systems. This is where the fantasy RPG mechanics, village simulation, combat, quests, and all game-specific features live. The game layer is built on top of the Locus Engine and follows an engine-first architecture.

---

## 📋 Overview

The game layer implements all of Emberwood's unique gameplay features:

1. **Turn-based tactical combat** with status effects and elemental interactions
2. **Living village simulation** with dynamic economy and population
3. **Quest system** with data-driven triggers and rewards
4. **Progression systems** including classes, talents, and equipment
5. **Procedural loot generation** with rarities and affixes
6. **Time system** with day/night cycles and daily ticks
7. **Kingdom government** with decrees and petitions
8. **Companion system** for AI-controlled party members

**Architecture Pattern:** Engine-First  
All game systems are implemented as **engine plugins** that register services, listen to events, and use the engine's infrastructure (state, scheduler, events, RNG, etc.).

---

## 🗂️ Directory Structure

```
js/game/
├── main.js               # Game entry point - creates engine and boots game
├── runtime/              # Game orchestration and lifecycle
│   ├── gameOrchestrator.js    # Plugin registration and core game loop
│   ├── dailyTickPipeline.js   # Daily tick events (economy, restocks, etc.)
│   └── debugHelpers.js        # Crash reporting and debug utilities
├── plugins/              # Engine plugins (30+ plugins)
│   ├── uiRuntimePlugin.js     # UI binding and rendering
│   ├── combatRuntimePlugin.js # Combat system integration
│   ├── questSystemPlugin.js   # Quest lifecycle management
│   └── ...                    # Services, commands, asset preloading, etc.
├── state/                # State management
│   └── createEmptyState.js    # Initial game state factory
├── persistence/          # Save/load system
│   └── saveManager.js         # Save management with migrations
├── data/                 # Game content definitions
│   ├── abilities.js           # Player abilities and spells
│   ├── items.js              # Equipment and consumables
│   ├── talents.js            # Talent trees
│   ├── companions.js         # Companion definitions
│   ├── playerClasses.js      # Character classes
│   ├── enemyAbilities.js     # Enemy attacks
│   └── difficulty.js         # Difficulty scaling
├── combat/               # Combat mechanics
│   ├── abilityEffects.js     # Ability implementations
│   ├── math.js               # Damage calculation formulas
│   ├── statusEngine.js       # Status effect processing
│   ├── postTurnSequence.js   # End-of-turn logic
│   └── companionRuntime.js   # Companion AI
├── systems/              # Core game systems
│   ├── lootGenerator.js      # Procedural loot generation
│   ├── timeSystem.js         # Day/night cycle
│   ├── kingdomGovernment.js  # Governance system
│   ├── rng.js                # Random number generation
│   ├── enemy/                # Enemy generation system
│   └── assertState.js        # State validation
├── locations/            # Game locations
│   └── village/              # Village sub-systems
│       ├── merchant.js       # Merchant trading
│       ├── bank.js           # Banking system
│       ├── tavern.js         # Tavern and rest
│       ├── tavernGames.js    # Dice and card games
│       ├── townHall.js       # Governance UI
│       ├── villageEconomy.js # Economic simulation
│       └── villagePopulation.js  # Population mood tracking
├── services/             # Business logic services
│   ├── timeService.js        # Time management
│   ├── merchantService.js    # Merchant operations
│   ├── bankService.js        # Banking operations
│   ├── tavernService.js      # Tavern operations
│   ├── townHallService.js    # Government operations
│   ├── lootGeneratorService.js   # Loot generation API
│   ├── questSystemService.js     # Quest management API
│   ├── villageEconomyService.js  # Economy API
│   └── villagePopulationService.js  # Population API
├── quests/               # Quest system
│   ├── questSystem.js        # Quest engine
│   ├── questDefs.js          # Quest definitions
│   ├── questDefaults.js      # Default quest state
│   ├── questBindings.js      # Quest-specific logic
│   └── questTriggerRegistry.js   # Trigger handlers
├── ui/                   # User interface
│   ├── runtime/              # UI runtime and bindings
│   │   ├── uiRuntime.js      # Core UI functions
│   │   └── uiBindings.js     # Event bindings
│   ├── devtools/             # Developer tools
│   │   └── diagnosticsUI.js  # QA overlay
│   └── spells/               # Spell UI
│       └── spellbookModal.js # Spellbook interface
├── changelog/            # Patch notes
│   └── changelog.js          # Version history
├── qa/                   # Quality assurance
│   └── perfSnapshot.js       # Performance metrics
└── utils/                # Utility functions
    ├── timing.js             # Timing utilities
    └── itemCloner.js         # Item cloning helpers
```

---

## 🚀 Entry Point and Boot Process

### main.js - Game Entry Point

The game boots through a simple three-step process:

```javascript
// 1. Create Locus Engine with initial state
const engine = createEngine({
  initialState: createEmptyState(),
  patch: GAME_PATCH,
  patchName: GAME_PATCH_NAME
});

// 2. Expose engine for debugging
window.__emberwoodEngine = engine;

// 3. Boot game - registers all plugins and starts engine
bootGame(engine);
```

### gameOrchestrator.js - Plugin Registration

The orchestrator registers 30+ plugins in dependency order:

**Core Infrastructure:**
- UI Runtime - DOM bindings and rendering
- Diagnostics - QA overlay and smoke tests
- Settings - User preferences
- Flags - Feature flags and dev cheats

**Game Systems:**
- Combat Runtime - Battle system
- Companion Runtime - AI party members
- Quest System - Quest lifecycle
- Time Service - Day/night cycle
- Village Services - Economy, merchant, bank, tavern, town hall

**Engine Bridges:**
- RNG Bridge - Random number generation
- Replay Bridge - Command recording
- Telemetry - Crash reporting
- Autosave - Periodic saves

The engine automatically resolves dependencies and starts all plugins.

---

## 🎯 Core Gameplay Systems

### Combat System

**Location:** `combat/`, `plugins/combatRuntimePlugin.js`

**Features:**
- Turn-based tactical combat with initiative
- Multi-enemy encounters (target switching)
- Status effects (DoTs, buffs, debuffs, control)
- Elemental system (fire, ice, lightning, nature, shadow, holy)
- Critical hits and resistances
- Damage breakdown with detailed combat log
- Companion AI with tactical decision-making

**Key Files:**
- `abilityEffects.js` - Ability implementations (damage, heal, status)
- `math.js` - Damage formulas and resistance calculations
- `statusEngine.js` - Status effect tick processing
- `companionRuntime.js` - Companion AI behavior

**Services:**
```javascript
const combat = engine.get('combat');
combat.startBattle(enemies);          // Start combat
combat.endBattle();                   // End combat
combat.dealDamage(target, amount);    // Apply damage
```

---

### Quest System

**Location:** `quests/`, `plugins/questSystemPlugin.js`

**Features:**
- Data-driven quest definitions
- Event-based triggers (combat, items, time, custom)
- Multi-step quest chains
- Conditional requirements
- Rewards (gold, XP, items, reputation)

**Quest Lifecycle:**
1. **Defined** - Quest exists in `questDefs.js`
2. **Initialized** - Default state created
3. **Started** - Quest becomes active
4. **In Progress** - Steps completed via triggers
5. **Completed** - Rewards granted

**Key Files:**
- `questDefs.js` - Quest content (objectives, dialogue, rewards)
- `questSystem.js` - Quest engine and state management
- `questTriggerRegistry.js` - Event trigger handlers
- `questBindings.js` - Quest-specific integration logic

**Example Quest:**
```javascript
{
  id: 'tutorial_first_battle',
  name: 'Trial by Fire',
  description: 'Defeat your first enemy',
  steps: [
    { type: 'combat_victory', target: 'any', count: 1 }
  ],
  rewards: {
    gold: 50,
    xp: 100
  }
}
```

---

### Village Simulation

**Location:** `locations/village/`, `services/*Service.js`

The village is a living, interconnected system:

**Merchant System:**
- Dynamic stock based on economy
- Buy/sell with price fluctuation
- Restock on daily tick
- Supply/demand affects prices

**Banking System:**
- Deposits earn interest
- Loans with repayment schedules
- Late payment penalties
- Compound interest calculations

**Tavern:**
- Rest to restore HP/MP
- Mini-games (dice, cards)
- Rumors and lore
- Social interactions

**Town Hall:**
- Petitions to the king
- Decrees affecting village
- Governance mechanics
- Reputation system

**Economy:**
- Supply/demand simulation
- Price fluctuation based on player actions
- Population mood affects available options
- Daily economic events

**Services:**
```javascript
const merchant = engine.get('merchant');
merchant.buyItem(itemId, quantity);
merchant.sellItem(itemId, quantity);

const bank = engine.get('bank');
bank.deposit(amount);
bank.takeLoan(amount, duration);
```

---

### Loot System

**Location:** `systems/lootGenerator.js`, `services/lootGeneratorService.js`

**Features:**
- Procedural item generation
- Rarity tiers: Common (50%), Uncommon (30%), Rare (15%), Epic (4%), Legendary (1%)
- Stat scaling based on rarity (1.0x → 2.5x)
- Affixes and traits (procedural modifiers)
- Equipment slots: weapon, armor, helmet, gloves, boots, accessory
- Item types: equipment, consumable, material, quest

**Loot Formulas:**
- **Base stats** × **Rarity multiplier** × **Affix bonuses**
- Higher rarity = more/better affixes
- Level requirements based on item power

**Service:**
```javascript
const lootGen = engine.get('lootGenerator');
const item = lootGen.generateItem({
  type: 'weapon',
  rarity: 'rare',
  level: 10
});
```

---

### Progression System

**Location:** `data/`, UI bindings

**Character Classes:**
- Warrior, Mage, Rogue, Cleric
- Class-specific abilities and resources
- Resource types: mana, rage, energy, focus

**Talent Trees:**
- Combat, Defense, Utility, Elemental
- Passive bonuses and unlocks
- Prerequisites and tier restrictions
- Respec support

**Equipment:**
- 6 equipment slots
- Stat bonuses (STR, INT, DEX, VIT, etc.)
- Procedural traits and affixes
- Set bonuses (future)

**Experience & Levels:**
- Combat XP based on enemy difficulty
- Quest XP rewards
- Level-up stat increases
- Ability unlocks by level

---

### Time System

**Location:** `systems/timeSystem.js`, `services/timeService.js`, `runtime/dailyTickPipeline.js`

**Day Parts:**
- Morning → Afternoon → Evening → Night
- Visual scene changes per time of day
- Time advances through activities (combat, rest, exploration)

**Daily Tick Pipeline:**
When a new day starts, the following systems run in order:

1. **Economy adjustments** - Supply/demand updates
2. **Merchant restock** - New items available
3. **Decree processing** - Active decrees expire/apply
4. **Bank interest** - Deposits grow, loan interest accrues
5. **Population mood** - Shifts based on events
6. **Quest triggers** - Time-based quest updates

**Service:**
```javascript
const time = engine.get('time');
time.advance('afternoon');      // Advance to afternoon
time.advanceDay();              // Move to next day (triggers daily tick)
```

---

## 🔌 Plugin Architecture

All game systems are implemented as **engine plugins** that follow this pattern:

```javascript
export function createMyGamePlugin() {
  return {
    id: 'ew.myFeature',
    requires: ['ew.uiRuntime'],  // Hard dependencies
    
    init(engine) {
      // Register services
      engine.registerService('myFeature', {
        doSomething() { /* ... */ }
      });
    },
    
    start(engine) {
      // Start runtime work (listeners, timers)
      engine.on('game:loaded', handleGameLoaded);
    },
    
    stop(engine) {
      // Clean up
      engine.off('game:loaded', handleGameLoaded);
    },
    
    dispose(engine) {
      // Final cleanup
      engine.unregisterService('myFeature');
    }
  };
}
```

### Plugin Categories

**UI & Presentation (7 plugins):**
- `uiRuntimePlugin` - Core UI bindings
- `uiCommandsPlugin` - UI action handlers
- `uiComposeBridgePlugin` - Toasts and transitions
- `diagnosticsOverlayPlugin` - QA tools
- `audioBridgePlugin` - Sound effects
- `inputContextsPlugin` - Input routing
- `screenAssetPreloadPlugin` - Asset loading

**Game Systems (8 plugins):**
- `combatRuntimePlugin` - Combat engine
- `companionRuntimePlugin` - Companion AI
- `questSystemPlugin` - Quest lifecycle
- `questEventsPlugin` - Quest triggers
- `worldEventsPlugin` - Global events
- `simTickPlugin` - Simulation ticks
- `timeServicePlugin` - Time management
- `autosavePlugin` - Auto-save system

**Village Services (5 plugins):**
- `villageServicesPlugin` - Economy & population
- `merchantServicePlugin` - Merchant operations
- `bankServicePlugin` - Banking
- `tavernServicePlugin` - Tavern
- `townHallServicePlugin` - Governance

**Content & Data (3 plugins):**
- `lootGeneratorPlugin` - Loot generation
- `kingdomGovernmentPlugin` - Government system
- `rngBridgePlugin` - Legacy RNG helpers

**Infrastructure (7 plugins):**
- `settingsPlugin` - User preferences
- `flagsPlugin` - Feature flags
- `telemetryPlugin` - Crash reporting
- `replayBridgePlugin` - Command replay
- `savePolicyBridgePlugin` - Save policy
- `gameCommandsPlugin` - Game commands
- `qaBridgePlugin` - QA utilities

**Engine Bridges (3 plugins):**
- `assetsManifestPlugin` - Asset registry
- `a11yBridgePlugin` - Accessibility
- `i18nPlugin` - Localization (future)

---

## 💾 State Management

### State Structure

The game state is a single object managed by the engine:

```javascript
{
  player: {
    name: 'Hero',
    class: 'warrior',
    level: 5,
    hp: 100,
    maxHp: 100,
    // ... stats, inventory, equipment, abilities, talents
  },
  
  time: {
    day: 1,
    dayPart: 'morning'  // morning, afternoon, evening, night
  },
  
  combat: {
    active: false,
    enemies: [],
    currentTarget: 0,
    turnCount: 0
  },
  
  quests: {
    active: [...],
    completed: [...],
    flags: {}
  },
  
  village: {
    economy: { ... },
    population: { ... },
    merchant: { ... },
    bank: { ... }
  },
  
  government: {
    decrees: [...],
    petitions: [...],
    kingRelationship: 0
  },
  
  companion: {
    // Active companion data (or null)
  },
  
  flags: {
    devCheatsEnabled: false,
    godMode: false,
    // ... feature flags
  },
  
  debug: {
    useDeterministicRng: false,
    rngSeed: 12345,
    // ... debug data
  },
  
  ui: {
    // UI-only state (not saved)
  },
  
  log: [
    // Combat and event log
  ]
}
```

### State Updates

State updates follow the engine's immutable update pattern:

```javascript
// Get current state
const state = engine.getState();

// Create new state
const newState = {
  ...state,
  player: {
    ...state.player,
    gold: state.player.gold + 100
  }
};

// Update state
engine.setState(newState);

// Emit event for side effects
engine.emit('player:goldChanged', { delta: 100 });
```

---

## 📦 Save System

**Location:** `persistence/saveManager.js`

**Features:**
- LocalStorage persistence
- Save migration system
- Checksum validation
- Auto-save on major events
- Manual save/load
- Multiple save slots

**Save Structure:**
```javascript
{
  version: 10,          // Save format version
  patch: '1.2.85',      // Game patch
  timestamp: 1234567,   // Save time
  state: { ... },       // Game state
  checksum: 'abc123'    // Integrity check
}
```

**Migrations:**
When the save format changes, migrations transform old saves:

```javascript
engine.migrations.register({
  version: 11,
  description: 'Add companion system',
  apply: (state) => {
    if (!state.companion) {
      state.companion = null;
    }
    return state;
  }
});
```

---

## 🎨 UI System

**Location:** `ui/runtime/`

The UI is built with vanilla JavaScript and DOM manipulation:

**Core Functions:**
- `switchScreen(screen)` - Navigate between screens
- `openModal(title, content)` - Show modal dialog
- `addLog(message, type)` - Add combat log entry
- `updateTimeDisplay()` - Update time UI
- `setScene(scene)` - Change background scene

**Screen Management:**
- Main Menu
- Character Creation
- Village Hub
- Combat Screen
- Merchant, Bank, Tavern, Town Hall
- Inventory, Spellbook, Talents
- Settings, Changelog

**UI Bindings:**
Event handlers are registered in `uiBindings.js` for all buttons, inputs, and interactions.

---

## 🧪 QA & Testing

**Location:** `qa/`, `plugins/diagnosticsOverlayPlugin.js`

**Smoke Tests:**
Automated tests for core systems:
- State initialization
- Save/load cycles
- Combat math
- Loot generation
- Enemy creation
- Quest lifecycle
- Ability classification
- Talent integrity
- Economy simulation
- Time system

**Diagnostics Overlay:**
In-game QA tools accessible via dev cheats:
- Performance snapshot
- State inspector
- RNG log viewer
- Event trace
- Command history
- Bug report generator

**Bug Reports:**
Automated bug report generation includes:
- Game state snapshot
- Recent logs and inputs
- Performance data
- RNG history (if deterministic mode)
- Browser/system info

---

## 🔧 Common Tasks

### Adding a New Ability

1. Define ability in `data/abilities.js`:
```javascript
{
  id: 'fireball',
  name: 'Fireball',
  description: 'Hurl a ball of fire',
  type: 'damage',
  element: 'fire',
  cost: 30,
  damage: [40, 60],
  cooldown: 2
}
```

2. Implement effect in `combat/abilityEffects.js` (if custom logic needed)

3. Add to class unlock table in `data/playerClasses.js`

4. Test with Cheat Menu → Spawn Enemy

### Adding a New Quest

1. Define quest in `quests/questDefs.js`:
```javascript
{
  id: 'goblin_invasion',
  name: 'Goblin Invasion',
  steps: [
    { type: 'combat_victory', target: 'goblin', count: 5 }
  ],
  rewards: { gold: 100, xp: 200 }
}
```

2. Add default state in `questDefaults.js`

3. Register triggers in `questTriggerRegistry.js` (if custom trigger)

4. Test with Smoke Tests → Quest Lifecycle

### Adding a New Item

1. Define item in `data/items.js`:
```javascript
{
  id: 'iron_sword',
  name: 'Iron Sword',
  type: 'equipment',
  slot: 'weapon',
  rarity: 'common',
  stats: { strength: 10, attack: 15 },
  level: 5
}
```

2. Test with Cheat Menu → Give Item

3. Verify inventory, equip, stats, and sell value

### Adding a New Village Service

1. Create service in `services/myService.js`

2. Create plugin in `plugins/myServicePlugin.js`

3. Register plugin in `gameOrchestrator.js`

4. Add UI in `locations/village/` or integrate with existing UI

---

## 🐛 Debugging

### Common Debug Commands

```javascript
// Access engine from console
const engine = window.__emberwoodEngine;

// Get current state
const state = engine.getState();

// Modify state (dev only!)
state.player.gold = 9999;

// Trigger event
engine.emit('debug:giveGold', { amount: 1000 });

// Check services
engine.listServices();

// View plugins
engine.listPlugins();
```

### Enable Dev Cheats

1. Create new character
2. Check "Enable Developer Cheats"
3. Access Cheat Menu from top-right HUD
4. Access Diagnostics via Cheat Menu

### Deterministic RNG

For reproducible bugs:

1. Enable Dev Cheats
2. Diagnostics → Enable Deterministic RNG
3. Set seed (e.g., 12345)
4. Reproduce bug
5. Share seed in bug report

---

## 📊 Performance

### Current Targets

| Metric | Target | Notes |
|--------|--------|-------|
| FPS | 60 | During combat animations |
| State size | < 200KB | Compressed save size |
| Memory | < 50MB | Total game memory |
| Load time | < 500ms | Save load to ready |

### Optimization Tips

1. **Batch DOM updates** - Use DocumentFragment
2. **Debounce expensive operations** - Use engine.schedule
3. **Lazy load UI** - Only render visible screens
4. **Optimize state updates** - Shallow copies, not deep clones
5. **Event delegation** - Use few delegated handlers vs. many individual

---

## 📚 Related Documentation

- **Boot Layer:** `/js/boot/README.md` - Bootstrap and initialization
- **Engine Layer:** `/js/engine/README.md` - Locus Engine core
- **Main README:** `/README.md` - Full project overview

---

## 🤝 Contributing

When adding new game features:

1. **Follow plugin pattern** - Implement as engine plugin when possible
2. **Use engine services** - Avoid direct imports between game modules
3. **Emit events** - Use events for cross-system communication
4. **Test thoroughly** - Add smoke tests for new systems
5. **Update data files** - Keep content in `data/` folder
6. **Document public APIs** - Add JSDoc comments for services
7. **Maintain state shape** - Add migrations for state changes

### Code Style

- **Functions:** camelCase
- **Classes:** PascalCase  
- **Constants:** UPPER_SNAKE_CASE
- **Files:** camelCase with .js extension
- **Imports:** Relative paths with .js extension

### Testing Checklist

- [ ] Smoke tests pass
- [ ] Save/load works correctly
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Accessible (keyboard navigation, screen readers)
- [ ] Works on mobile (touch interactions)

---

## 📜 License

See repository root for license information.

---

**Made with ❤️ for Emberwood: The Blackbark Oath**
