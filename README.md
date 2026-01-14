<div align="center">

# 🌲 Emberwood: The Blackbark Oath ⚔️

### A Browser-Based Fantasy RPG & Living Village Simulator

[![Version](https://img.shields.io/badge/version-1.2.85-blue.svg)](https://github.com/alsub25/Emberwood-The-Blackbark-Oath)
[![License](https://img.shields.io/badge/license-See%20License%20Section-green.svg)](#-license)
[![No Build Required](https://img.shields.io/badge/build-none-brightgreen.svg)](#%EF%B8%8F-architecture-overview)
[![ES Modules](https://img.shields.io/badge/modules-native%20ES-orange.svg)](#%EF%B8%8F-architecture-overview)
[![Platform](https://img.shields.io/badge/platform-browser-lightgrey.svg)](#-quick-start)

[**🎮 Play Now**](#-quick-start) • [**📖 Documentation**](#-table-of-contents) • [**🐛 Report Bug**](#-testing--debugging) • [**✨ Request Feature**](#-contributing-guidelines)

</div>

---

## 🎯 Overview

**Emberwood: The Blackbark Oath** is an immersive single-page browser RPG combining deep turn-based combat with a living village simulation. Every decision you make—whether resting at the tavern, negotiating with merchants, managing your bank account, or influencing local politics—creates ripples through an interconnected world where combat, loot, and quests feed back into the social and economic fabric of your settlement.

### ✨ Key Features

<table>
<tr>
<td width="50%">

#### 🎲 **Rich Combat System**
- Turn-based tactical combat
- Multi-enemy encounters with AoE abilities
- Dynamic status effects & synergies
- Elemental affinities & resistances
- Enemy intent system with interrupts
- Posture break mechanics

</td>
<td width="50%">

#### 🏘️ **Living Village**
- Dynamic economy simulation
- Merchant stock management
- Banking system with loans & interest
- Town hall governance & decrees
- Population mood tracking
- Tavern games & gambling

</td>
</tr>
<tr>
<td width="50%">

#### ⚡ **Character Progression**
- Multiple classes with unique abilities
- Talent tree system
- Equipment with procedural traits
- Skill point allocation
- Level-based ability unlocks
- Resource management (mana, stamina, etc.)

</td>
<td width="50%">

#### 🛠️ **Developer Tools**
- Comprehensive smoke test suite
- Scenario runner for simulation
- Bug report bundle export
- Performance profiling
- Deterministic RNG for reproduction
- Live save state auditing

</td>
</tr>
</table>

### 🏆 What Makes It Special

- **Zero Build Complexity**: Native ES modules mean no bundler, no build step, no configuration hell
- **Static-Host Friendly**: Deploy anywhere that serves HTML (GitHub Pages, Netlify, S3, etc.)
- **Offline-First**: Runs entirely in browser with `localStorage` persistence
- **Deterministic Testing**: Seeded RNG and comprehensive QA tools enable reproducible bug reports
- **Forward Compatible**: Migration system ensures old saves work with new versions
- **Developer-Friendly**: Modular architecture with clear separation of concerns

> **Current Patch:** v1.2.85 — *Engine Integration Expansion - Kingdom, Loot & Quest Systems*  
> **In-Game Changelog:** Open the **Changelog** button from the main menu for detailed patch notes

---

## 📑 Table of Contents

<details open>
<summary><b>Click to expand complete table of contents</b></summary>

### Getting Started
- [🚀 Quick Start](#-quick-start)
  - [Local Development](#local-development)
  - [iOS & File Protocol Notes](#ios--file-protocol-notes)
  - [Browser Compatibility](#browser-compatibility)
- [🌐 Deployment](#-deployment)
  - [GitHub Pages](#deploy-to-github-pages)
  - [Other Static Hosts](#other-static-hosting-options)

### Project Structure
- [📁 Project Layout](#-project-layout)
  - [Directory Overview](#directory-overview)
  - [Module Organization](#module-organization)
  - [File Naming Conventions](#file-naming-conventions)

### Architecture & Design
- [🏗️ Architecture Overview](#%EF%B8%8F-architecture-overview)
  - [Boot Sequence](#boot-sequence)
  - [Engine Orchestration](#engine-orchestration)
  - [State Management](#state-management)
  - [Data Flow Diagram](#data-flow-diagram)

### Core Systems
- [⚙️ Gameplay Systems](#%EF%B8%8F-gameplay-systems)
  - [State Model & Save Schema](#state-model--save-schema)
  - [Time System & Daily Ticks](#time-system--daily-ticks)
  - [RNG & Determinism](#rng--determinism)
  - [Combat System](#combat-system)
  - [Abilities & Effects](#abilities--effects)
  - [Status Effects & Synergies](#status-effects--synergies)
  - [Elements, Affinities & Resistances](#elements-affinities--resistances)
  - [Classes, Resources & Progression](#classes-resources--progression)
  - [Talents](#talents)
  - [Items, Inventory & Equipment](#items-inventory--equipment)
  - [Loot Generation](#loot-generation)
  - [Enemies, Rarity & Affixes](#enemies-rarity--affixes)
  - [Quest System](#quest-system)
  - [Village Simulation](#village-simulation)
  - [Logging & UI](#logging--ui)
  - [Diagnostics & QA Tools](#diagnostics--qa-tools)

### Development
- [➕ Adding Content](#-adding-content)
- [🧪 Testing & Debugging](#-testing--debugging)
- [🤝 Contributing Guidelines](#-contributing-guidelines)

### Reference
- [📦 Versioning & Releases](#-versioning--releases)
- [🔒 Security Considerations](#-security-considerations)
- [⚡ Performance Optimization](#-performance-optimization)
- [❓ FAQ & Troubleshooting](#-faq--troubleshooting)
- [🗺️ Roadmap](#%EF%B8%8F-roadmap)
- [📜 License](#-license)
- [🙏 Credits & Acknowledgments](#-credits--acknowledgments)

</details>

---

## 🚀 Quick Start

### Local Development

Emberwood uses native ES modules, which require a web server to function properly due to browser CORS restrictions. Choose your preferred method:

#### 🐍 Python (Built-in)

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then navigate to `http://localhost:8000`

#### 📦 Node.js

```bash
# Using npx (no installation required)
npx serve .

# Or with http-server
npx http-server -p 8000

# Or install serve globally
npm install -g serve
serve .
```

#### 🦀 Rust (Ultra-fast)

```bash
cargo install miniserve
miniserve . -p 8000
```

#### 🔧 Other Options

<details>
<summary>Click to see more server options</summary>

**PHP:**
```bash
php -S localhost:8000
```

**Ruby:**
```bash
ruby -run -e httpd . -p 8000
```

**VS Code Extension:**
Install "Live Server" extension and click "Go Live" in the status bar

**Browser Extension:**
Install "Web Server for Chrome" extension

</details>

### iOS & File Protocol Notes

⚠️ **Important for iOS/Safari Users:**

While the project includes guards for iOS Safari, **serving from HTTP is strongly recommended**. Loading modules from `file://` protocol can result in:

- Inconsistent module loading behavior
- Stricter CORS restrictions
- Temporal dead zone errors
- LocalStorage access issues

If you must use `file://`, ensure:
- All browser security settings allow local file access
- Private browsing is disabled (for localStorage)
- You're using the latest Safari/iOS version

### Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome/Edge | 87+ | ✅ Full support |
| Firefox | 78+ | ✅ Full support |
| Safari | 14+ | ✅ Full support with HTTP |
| iOS Safari | 14+ | ⚠️ Use HTTP server |
| Opera | 73+ | ✅ Full support |

**Required Browser Features:**
- ES Modules (import/export)
- LocalStorage API
- Promises & async/await
- Array methods (map, filter, reduce)
- Object destructuring

---

## 🌐 Deployment

### Deploy to GitHub Pages

Emberwood is a purely static site with no build process, making deployment trivial.

#### Option A: Deploy from Repository Root (Recommended)

1. Navigate to **Settings → Pages** in your GitHub repository
2. Under **Build and deployment → Source**, select **"Deploy from a branch"**
3. Choose branch: `main` (or your default branch)
4. Choose folder: **`/ (root)`**
5. Click **Save**
6. Your site will be live at: `https://[username].github.io/[repo-name]/`

#### Option B: Deploy from `/docs` Folder

If you prefer separating source files from deployment:

1. Create a `/docs` directory
2. Move `index.html`, `style.css`, `assets/`, and `js/` into `/docs`
3. In GitHub: **Settings → Pages → Source**: `main` branch + `/docs` folder
4. Click **Save**

### Path Configuration

All asset paths in Emberwood use **relative references**, ensuring compatibility whether deployed at:
- Root domain: `https://example.com/`
- Subdirectory: `https://example.com/emberwood/`
- GitHub Pages subpath: `https://username.github.io/repository-name/`

No configuration changes needed! 🎉

### Other Static Hosting Options

<details>
<summary><b>Netlify</b></summary>

1. Connect your GitHub repository to Netlify
2. Build command: Leave empty (no build required)
3. Publish directory: `/` or `.`
4. Deploy!

Or use Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir .
```

</details>

<details>
<summary><b>Vercel</b></summary>

```bash
npm install -g vercel
vercel --prod
```

Or connect via GitHub integration - no build command needed.

</details>

<details>
<summary><b>AWS S3 + CloudFront</b></summary>

```bash
# Upload to S3 bucket
aws s3 sync . s3://your-bucket-name/ \
  --exclude ".git/*" \
  --exclude "README.md"

# Configure bucket for static hosting
aws s3 website s3://your-bucket-name/ \
  --index-document index.html
```

</details>

<details>
<summary><b>Cloudflare Pages</b></summary>

1. Connect repository to Cloudflare Pages
2. Build command: None
3. Output directory: `/`
4. Deploy!

</details>

---

## 📁 Project Layout

### Directory Overview

```
Emberwood-The-Blackbark-Oath/
│
├── index.html              # Main entry point
├── style.css               # Global styles & theme
├── README.md               # This file
│
├── assets/                 # Static assets (currently minimal)
│
└── js/                     # All JavaScript modules
    ├── boot/               # Bootstrap & initialization
    │   ├── bootstrap.js        # Main boot sequencer
    │   ├── bootLoader.js       # Loading screen UI
    │   ├── userAcceptance.js   # User consent/gates
    │   └── lib/
    │       └── safeStorage.js  # Boot-safe storage wrapper
    │
    ├── shared/             # Cross-layer utilities
    │   └── storage/
    │       └── safeStorage.js  # Storage utilities
    │
    ├── engine/             # Core game engine
    │   ├── engine.js           # Engine core (state/events/services)
    │   ├── perf.js             # Performance monitoring
    │   └── storageRuntime.js   # Runtime storage diagnostics
    │
    └── game/               # Game-specific code
        ├── main.js             # Game entry point
        │
        ├── runtime/            # Game orchestration
        │   └── gameOrchestrator.js  # Main game coordinator
        │
        ├── plugins/            # Engine plugins
        │   ├── worldEventsPlugin.js # World events
        │   ├── i18nPlugin.js        # Internationalization
        │   └── settingsPlugin.js    # Settings management
        │
        ├── persistence/        # Save system
        │   └── saveManager.js      # Save/load & migrations
        │
        ├── ui/                 # User interface
        │   ├── runtime/
        │   │   ├── uiRuntime.js    # Screen/modal management
        │   │   └── uiBindings.js   # DOM event bindings
        │   ├── devtools/
        │   │   └── diagnosticsUI.js # Dev tools UI
        │   └── spells/
        │       └── spellbookModal.js # Spellbook interface
        │
        ├── data/               # Game data definitions
        │   ├── abilities.js        # Player abilities
        │   ├── enemyAbilities.js   # Enemy abilities
        │   ├── items.js            # Item definitions
        │   ├── talents.js          # Talent tree
        │   ├── playerClasses.js    # Class definitions
        │   ├── companions.js       # Companion data
        │   └── difficulty.js       # Difficulty settings
        │
        ├── combat/             # Combat system
        │   ├── math.js             # Damage/heal calculations
        │   ├── statusEngine.js     # Status effect handling
        │   ├── abilityEffects.js   # Ability implementations
        │   └── postTurnSequence.js # Turn cleanup logic
        │
        ├── systems/            # Core game systems
        │   ├── time/               # Time management
        │   ├── rng/                # RNG system
        │   ├── loot/               # Loot generation
        │   ├── enemy/              # Enemy creation
        │   ├── government/         # Governance system
        │   ├── safety/             # Data validation
        │   └── version.js          # Version info
        │
        ├── locations/          # Game locations
        │   └── village/
        │       ├── merchant.js        # Shop system
        │       ├── bank.js            # Banking system
        │       ├── tavern.js          # Tavern & rest
        │       ├── tavernGames.js     # Mini-games
        │       ├── townHall.js        # Governance
        │       ├── villageEconomy.js  # Economic simulation
        │       └── villagePopulation.js # Population dynamics
        │
        ├── quests/             # Quest system
        │   ├── questDefs.js        # Quest definitions
        │   ├── questDefaults.js    # Default quest state
        │   ├── questSystem.js      # Quest lifecycle
        │   ├── questBindings.js    # World integration
        │   └── questTriggerRegistry.js # Trigger system
        │
        ├── changelog/          # Patch notes
        │   └── changelog.js        # In-game changelog data
        │
        ├── state/              # State management
        │   └── initialState.js     # Default game state
        │
        ├── utils/              # Utility functions
        │   ├── itemCloner.js       # Deep cloning
        │   └── timing.js           # Timing utilities
        │
        └── qa/                 # Quality assurance
            └── perfSnapshot.js     # Performance snapshots
```

### Module Organization

The codebase follows a **layered architecture** to prevent circular dependencies and maintain clear boundaries:

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

**Layer Responsibilities:**

1. **Boot Layer** (`js/boot/`)
   - Executes before game engine loads
   - Handles storage checks and user acceptance
   - Shows loading screen
   - Minimal dependencies for fast startup

2. **Shared Layer** (`js/shared/`)
   - Utilities used across layers
   - No dependencies on other layers
   - Safe for import anywhere

3. **Engine Layer** (`js/engine/`)
   - Generic game engine (not Emberwood-specific)
   - State management, events, services
   - Plugin architecture
   - Could theoretically power other games

4. **Game Layer** (`js/game/`)
   - All Emberwood-specific content
   - Game rules, data, UI
   - Organized by feature domain

### File Naming Conventions

- **camelCase**: All JavaScript files (`gameOrchestrator.js`, `saveManager.js`)
- **Descriptive names**: File purpose clear from name
- **Co-location**: Related files in same directory
- **No index files**: Explicit imports preferred over directory imports

### Import Strategy

```javascript
// ✅ Good: Explicit relative imports
import { saveGame } from './persistence/saveManager.js';
import { rollDice } from '../systems/rng/rng.js';

// ❌ Bad: Would require bundler configuration
import { saveGame } from '@/persistence/saveManager';
import { rollDice } from '~/systems/rng';
```

**Import Principles:**
- ES Modules only (no CommonJS, no AMD)
- Always include `.js` extension
- Use relative paths (`./`, `../`)
- No circular dependencies
- No lazy loading (bundle size manageable)

---

## 🏗️ Architecture Overview

Emberwood uses a **single authoritative state object** combined with modular systems that read and update it. This architecture provides predictability, testability, and easy save/load functionality.

### Boot Sequence

```
User Opens Page
      ↓
┌─────────────────────────────┐
│  index.html loads           │
│  - Displays boot overlay    │
│  - Loads bootstrap.js       │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│  bootstrap.js executes      │
│  - Checks localStorage      │
│  - User acceptance gate     │
│  - Updates boot progress    │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│  game/main.js loads         │
│  - Creates Engine instance  │
│  - Initializes orchestrator │
└─────────────────────────────┘
      ↓
┌─────────────────────────────┐
│  Engine.start() called      │
│  - Loads/creates save       │
│  - Wires UI bindings        │
│  - Shows main menu          │
└─────────────────────────────┘
      ↓
    Game Ready!
```

**Boot Timing Targets:**
- Storage check: < 50ms
- Module loading: < 500ms
- Engine initialization: < 200ms
- Total to interactive: < 1000ms

### Engine Orchestration

The **Engine Core** (`js/engine/engine.js`) provides core services:

| Service | Purpose | Example Usage |
|---------|---------|---------------|
| **State** | Single source of truth | `engine.state.player.hp` |
| **Events** | Pub/sub event bus | `engine.emit('combat:start')` |
| **Clock** | Timing & scheduling | `engine.schedule(fn, delay)` |
| **Commands** | Action dispatch | `engine.command('attack', target)` |
| **Save/Load** | Persistence | `engine.save()` / `engine.load()` |
| **Migrations** | Save schema updates | `engine.registerMigration(fn)` |
| **Logging** | Structured logs | `engine.log.info('msg', meta)` |
| **RNG** | Random number generation | `engine.rng.roll(1, 20)` |
| **Performance** | Monitoring & watchdog | `engine.perf.mark('event')` |
| **UI Router** | Screen management | `engine.ui.switchScreen('village')` |
| **Input** | Input handling | `engine.input.on('click', handler)` |
| **Assets** | Asset management | `engine.assets.get('icon')` |
| **Errors** | Error boundary | `engine.onError(handler)` |

The **Game Orchestrator** (`js/game/runtime/gameOrchestrator.js`) coordinates:
- Building/initializing game state
- Delegating to game systems
- Wiring UI via `uiRuntime` + `uiBindings`
- Managing combat encounters
- Handling save/load through `saveManager`

### State Management

```javascript
// Simplified state structure
const state = {
  // Character data
  player: {
    name: "Aria",
    class: "warrior",
    level: 5,
    hp: 120,
    maxHp: 120,
    resource: 50,
    maxResource: 100,
    stats: { /* str, agi, int, etc. */ },
    inventory: [ /* items */ ],
    equipment: { /* slots */ },
    talents: [ /* talent ids */ ],
    gold: 1500
  },
  
  // World state
  time: {
    day: 15,
    dayPart: "morning" // morning/afternoon/evening/night
  },
  
  // Village economy
  village: {
    economy: { /* multipliers, prices */ },
    merchant: { /* stock, prices */ },
    population: { /* mood, count */ }
  },
  
  // Quest progression
  quests: {
    active: [ /* quest states */ ],
    completed: [ /* quest ids */ ]
  },
  
  // Governance
  government: {
    decrees: [ /* active decrees */ ],
    petitions: [ /* available petitions */ ]
  },
  
  // Banking
  bank: {
    deposits: 0,
    loans: [],
    lastInterestDay: 1
  },
  
  // Combat (only present during battle)
  combat: {
    enemies: [ /* enemy states */ ],
    turnCount: 0,
    playerIntent: null
  },
  
  // UI state
  ui: {
    currentScreen: "mainMenu",
    modals: [],
    filters: { /* log filters */ }
  },
  
  // Feature flags
  flags: {
    devCheatsEnabled: false,
    deterministicRNG: false,
    debugCombat: false
  },
  
  // Event log
  log: [ /* structured log entries */ ]
};
```

**State Principles:**
- **Immutability**: Systems don't mutate state directly; they create new values
- **Normalization**: No duplicate data (single source of truth)
- **Validation**: Data sanitized on load and during gameplay
- **Serialization**: State subset saved to localStorage

### Data Flow Diagram

```
┌──────────┐
│   User   │
│  Input   │
└────┬─────┘
     │
     ↓
┌─────────────────┐
│  UI Bindings    │  ← Click handlers, form submissions
└────┬────────────┘
     │
     ↓
┌─────────────────┐
│  Game Systems   │  ← Combat, village, quests, etc.
│  - Read state   │
│  - Compute      │
│  - Update state │
└────┬────────────┘
     │
     ↓
┌─────────────────┐
│  Engine Events  │  ← Emit events for side effects
└────┬────────────┘
     │
     ↓
┌─────────────────┐
│  UI Runtime     │  ← Re-render affected components
└────┬────────────┘
     │
     ↓
┌──────────┐
│   DOM    │  ← User sees updated interface
└──────────┘
```

**Example Flow (Player Attacks):**

1. User clicks "Attack" button
2. `uiBindings.js` calls `combat.playerAttack(targetId)`
3. `combat/math.js` calculates damage using `state.player.stats`
4. Combat system updates `state.combat.enemies[targetId].hp`
5. Combat system emits `combat:damage` event
6. `uiRuntime.js` listens to event and updates combat UI
7. `uiRuntime.js` adds log entry to `state.log`
8. Log component re-renders to show damage dealt

---

## ⚙️ Gameplay Systems

Emberwood features interconnected systems that create emergent gameplay. Understanding how these systems work together is key to mastering the game.

### State Model & Save Schema

The game uses a single top-level `state` object representing the entire game world. The save payload is a normalized subset of runtime state plus metadata.

**Common State Buckets:**

| Bucket | Purpose | Key Fields |
|--------|---------|------------|
| `player` | Character data | stats, level, HP, inventory, equipment, talents |
| `time` | World time | day index, day part (morning/afternoon/evening/night) |
| `combat` | Battle state | enemies, turn count, intent (only present during combat) |
| `quests` | Quest tracking | active quests, completed quests, progress |
| `village` | Settlement state | economy, merchant stock, population mood |
| `government` | Governance | decrees, petitions, king relationship |
| `bank` | Financial system | deposits, loans, interest timing |
| `flags` | Feature toggles | dev cheats, deterministic RNG, debug modes |
| `log` | Event history | structured log entries, filters |
| `ui` | Interface state | current screen, modals, UI toggles |

**Persistence Strategy:**

```javascript
// Save format
{
  version: "1.2.85",
  timestamp: 1234567890,
  player: { /* player state */ },
  time: { /* time state */ },
  // ... other buckets
  metadata: {
    playtime: 3600,
    lastSaved: 1234567890
  }
}
```

- Stored in `localStorage` using safe wrappers
- Private mode / quota failures gracefully handled
- Multiple save slots supported (index + per-slot blobs)
- Autosave triggers on significant events

**Migration System:**

`saveManager.js` applies ordered migrations when loading older saves:

```javascript
// Example migration
{
  version: 5,
  apply: (state) => {
    // Add new field with default value
    if (!state.bank) {
      state.bank = { deposits: 0, loans: [], lastInterestDay: 1 };
    }
    return state;
  }
}
```

Migrations are:
- **Ordered**: Applied sequentially by version number
- **Tolerant**: Unknown keys preserved for forward compatibility
- **Idempotent**: Safe to run multiple times
- **Logged**: Migration results logged for debugging

### Time System & Daily Ticks

`timeSystem.js` tracks time as **day index** + **day part** (morning, afternoon, evening, night).

**Time Functions:**

```javascript
// Normalize time (clamp to valid ranges)
normalizeTime(time) → { day, dayPart }

// Advance to next day part
advanceTime(state) → newState

// Check if day changed
didDayChange(oldTime, newTime) → boolean
```

**Daily Tick Pipeline:**

When time advances to a new day, a deterministic pipeline runs:

```
New Day Triggered
      ↓
┌─────────────────────────┐
│  Economy Adjustments    │ ← Price fluctuations, supply/demand
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  Merchant Restock       │ ← New items, prune old stock
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  Decree Processing      │ ← Expire decrees, apply effects
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  Bank Interest          │ ← Calculate interest on deposits/loans
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  Population Mood Drift  │ ← Mood shifts based on events
└──────────┬──────────────┘
           ↓
      Tick Complete
```

**Idempotence Guard:**

The system tracks the last processed day to prevent "double tick" bugs:

```javascript
if (state.village.lastProcessedDay === currentDay) {
  return; // Already processed this day
}
state.village.lastProcessedDay = currentDay;
// ... run daily tick
```

### RNG & Determinism

`rng.js` provides both random and deterministic random number generation for reproducible testing.

**Features:**

- **Normal RNG**: `Math.random()` based (non-deterministic)
- **Seeded RNG**: Deterministic RNG for bug reproduction
- **RNG Logging**: Optional logging of all RNG calls (capped to prevent memory issues)
- **Multiple Streams**: Separate RNG streams for different systems

**API:**

```javascript
// Get random integer [min, max] inclusive
roll(min, max)

// Get random float [0, 1)
random()

// Pick random element from array
pick(array)

// Weighted random selection
weighted(items, weightFn)

// Enable deterministic mode
seed(seedValue)
```

**Usage in Testing:**

```javascript
// Enable deterministic RNG for bug reproduction
state.flags.deterministicRNG = true;
state.rngSeed = 12345;

// All subsequent RNG calls are deterministic
const damage = rollDamage(state); // Always same result
```

### Combat System

Turn-based combat supporting single and multi-enemy encounters with rich mechanics.

**Core Components:**

```
Combat Flow
     ↓
┌──────────────────┐
│  Player Turn     │
│  - Choose action │
│  - Select target │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Ability Effects │
│  - Calculate dmg │
│  - Apply status  │
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Enemy Turns     │
│  - Process intents│
│  - Execute actions│
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Post-Turn       │
│  - Tick statuses │
│  - Check victory │
└────────┬─────────┘
         ↓
    Next Turn
```

**Combat Mechanics:**

| Mechanic | Description |
|----------|-------------|
| **Intent System** | Enemies telegraph actions 1-2 turns ahead |
| **Interrupts** | Spend resources to cancel enemy intents |
| **Posture** | Break enemy posture to disrupt powerful moves |
| **AoE** | Area attacks hit all enemies |
| **Status Effects** | Buffs, debuffs, DoTs, and HoTs |
| **Elemental Damage** | Fire, ice, lightning with interactions |
| **Critical Hits** | Bonus damage based on stats |
| **Mitigation** | Armor and resistances reduce damage |

**Combat Math:**

```javascript
// Simplified damage calculation
baseDamage = ability.power * (playerStat / 100);
variance = baseDamage * random(-0.1, 0.1);
critMultiplier = isCrit ? 1.5 : 1.0;
elementalMultiplier = getElementalMultiplier(ability.element, enemy);
resistMultiplier = 1 - (enemy.resistance / 100);

finalDamage = Math.floor(
  (baseDamage + variance) * 
  critMultiplier * 
  elementalMultiplier * 
  resistMultiplier
);
```

**Safety Measures:**

- Damage/heal values clamped to prevent NaN/Infinity
- HP cannot go below 0 or above max
- Status durations validated
- Combat state repaired on load for forward compatibility

### Abilities & Effects

Abilities defined in `js/game/data/abilities.js`, implemented in `combat/abilityEffects.js`.

**Ability Structure:**

```javascript
{
  id: "fireball",
  name: "Fireball",
  description: "Blast enemies with flame",
  cost: 30,                    // Resource cost
  cooldown: 0,                 // Turns until usable again
  targetType: "enemy",         // self, enemy, group
  classification: "elemental", // physical or elemental
  element: "fire",             // Element type
  effects: [
    {
      type: "damage",
      power: 150,
      scaling: "intelligence"
    },
    {
      type: "status",
      status: "burn",
      duration: 3,
      chance: 0.5
    }
  ]
}
```

**Effect Types:**

- `damage`: Deal damage to target(s)
- `heal`: Restore HP
- `status`: Apply status effect
- `buff`: Increase stats temporarily
- `debuff`: Decrease enemy stats
- `resource`: Restore/drain resource (mana, stamina, etc.)

### Status Effects & Synergies

Status effects handled by `statusEngine.js` with rich interactions.

**Common Statuses:**

| Status | Effect | Duration Type |
|--------|--------|---------------|
| **Burn** | Fire damage per turn | Ticking |
| **Poison** | Nature damage per turn | Ticking |
| **Bleed** | Physical damage per turn | Ticking |
| **Chill** | Reduces speed | Buff/Debuff |
| **Stun** | Skip turn | Control |
| **Regen** | Heal per turn | Ticking |
| **Shield** | Absorb damage | Buff |
| **Vuln** | Take increased damage | Debuff |

**Status Synergies:**

```
Bleed + Fire → Burning (enhanced Fire DoT)
Chill + Physical → Shatter (consume Chill for burst damage)
Poison + Nature → Amplified (increase duration)
Wet + Lightning → Shocked (spread to nearby enemies)
```

**Status Engine Features:**

- Stack tracking for effects that stack
- Duration ticking at end of turn
- Expiration cleanup
- Synergy detection and triggering
- Status immunity (some enemies immune to certain effects)

### Elements, Affinities & Resistances

Damage classification and elemental interactions.

**Elemental Types:**

- **Fire**: High burst damage, causes Burn
- **Ice**: Slows enemies, causes Chill
- **Lightning**: Chain damage, causes Shocked
- **Nature**: Damage over time, causes Poison
- **Shadow**: Ignores armor, causes Fear
- **Holy**: Heals allies, damages undead

**Affinity System:**

```javascript
// Enemy affinities
{
  affinities: {
    fire: 1.5,    // Takes 50% more fire damage (weak)
    ice: 0.5,     // Takes 50% less ice damage (resist)
    lightning: 2.0 // Takes 100% more lightning damage (very weak)
  }
}

// Player elemental bonuses from gear/talents
{
  elementalBonuses: {
    fire: 0.25,   // +25% fire damage dealt
    ice: 0.10     // +10% ice damage dealt
  },
  elementalResists: {
    fire: 0.20,   // Take 20% less fire damage
    shadow: 0.15  // Take 15% less shadow damage
  }
}
```

**Damage Calculation:**

```
Final Damage = Base × Affinity × (1 - Resist) × (1 + Bonus)
```

### Classes, Resources & Progression

Classes define playstyle, abilities, and progression path.

**Class Structure:**

```javascript
{
  id: "warrior",
  name: "Warrior",
  description: "Master of melee combat",
  resourceType: "rage",        // mana, rage, energy, etc.
  baseStats: {
    strength: 20,
    agility: 12,
    intelligence: 8,
    vitality: 18
  },
  statGrowth: {                // Per level
    strength: 3,
    agility: 1,
    intelligence: 0.5,
    vitality: 2
  },
  startingAbilities: ["strike", "defend"],
  abilityUnlocks: {
    5: ["cleave"],
    10: ["whirlwind"],
    15: ["execute"]
  }
}
```

**Progression Systems:**

1. **Leveling**: Gain XP from combat, level up increases stats
2. **Skill Points**: Allocated to core stats (str, agi, int, vit)
3. **Talent Points**: Spend in talent trees for passive bonuses
4. **Ability Unlocks**: New abilities at specific levels
5. **Equipment**: Find/craft better gear

**Resource Types:**

- **Mana**: Regenerates slowly, used by mages
- **Rage**: Generates in combat, used by warriors
- **Energy**: Fast regeneration, used by rogues
- **Focus**: Build up mechanic, used by rangers

### Talents

Talents in `js/game/data/talents.js` provide passive bonuses and unlock special mechanics.

**Talent Structure:**

```javascript
{
  id: "critical_mastery",
  name: "Critical Mastery",
  description: "+10% critical strike chance",
  tier: 1,                     // Tier in talent tree
  requires: null,              // Prerequisite talent IDs
  maxRanks: 3,                 // Can be taken multiple times
  effects: {
    critChance: 0.10          // Per rank
  }
}
```

**Talent Categories:**

- **Combat**: Damage, crit, accuracy improvements
- **Defense**: Armor, HP, resistances
- **Resource**: Mana/rage/energy bonuses
- **Utility**: Movement, gold find, XP gain
- **Elemental**: Specific element enhancements
- **Specialized**: Class-specific mechanics

**Talent Application:**

Talents modify derived stats through recomputation pipeline:

```javascript
// Recompute stats when talents change
function recomputeStats(state) {
  let stats = { ...baseStats };
  
  // Apply talent bonuses
  for (const talentId of state.player.talents) {
    const talent = getTalent(talentId);
    stats = applyTalentEffects(stats, talent);
  }
  
  // Apply equipment bonuses
  stats = applyEquipmentBonuses(stats, state.player.equipment);
  
  return stats;
}
```

### Items, Inventory & Equipment

Items defined in `js/game/data/items.js`.

**Item Types:**

| Type | Stackable | Examples |
|------|-----------|----------|
| **Consumable** | Yes | Potions, food, scrolls |
| **Weapon** | No | Swords, staves, bows |
| **Armor** | No | Helmets, chest, boots |
| **Accessory** | No | Rings, amulets, trinkets |
| **Material** | Yes | Ores, herbs, leather |
| **Quest** | Yes | Quest items |

**Item Structure:**

```javascript
{
  id: "iron_sword",
  name: "Iron Sword",
  type: "weapon",
  slot: "mainHand",
  rarity: "common",
  level: 5,
  stats: {
    damage: 25,
    strength: 5
  },
  traits: ["on_hit_bleed"],    // Special effects
  value: 150,                   // Base sell value
  description: "A reliable blade"
}
```

**Inventory Rules:**

- Stackable items consolidate to `quantity` integer
- Equipment doesn't stack (each is unique instance)
- Inventory size currently unlimited (future: bag slots)
- Equip/unequip updates derived stats
- Selling equipped gear clears slot and uses `getSellValue()`

**Equipment Traits:**

- `on_hit_X`: Trigger on dealing damage
- `on_kill_X`: Trigger on defeating enemy
- `on_damaged_X`: Trigger when taking damage
- `passive_X`: Always active
- `set_bonus_X`: Requires multiple set pieces

### Loot Generation

`lootGenerator.js` creates procedural loot with weighted rarities.

**Rarity Tiers:**

```javascript
{
  common: {
    weight: 50,
    colorclass: "text-common",
    statMultiplier: 1.0
  },
  uncommon: {
    weight: 30,
    colorclass: "text-uncommon",
    statMultiplier: 1.3
  },
  rare: {
    weight: 15,
    colorclass: "text-rare",
    statMultiplier: 1.6
  },
  epic: {
    weight: 4,
    colorclass: "text-epic",
    statMultiplier: 2.0
  },
  legendary: {
    weight: 1,
    colorclass: "text-legendary",
    statMultiplier: 2.5
  }
}
```

**Generation Pipeline:**

```
Request Loot
     ↓
┌───────────────────┐
│  Roll Rarity      │ ← Weighted random based on player level/luck
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Select Base Item │ ← Pick from item pool matching level range
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Apply Rarity     │ ← Multiply stats by rarity multiplier
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Add Traits       │ ← Higher rarity = more/better traits
└─────────┬─────────┘
          ↓
┌───────────────────┐
│  Randomize Stats  │ ← Add variance (-10% to +10%)
└─────────┬─────────┘
          ↓
     Return Item
```

**Safety Guarantees:**

- All stats finite (no NaN/Infinity)
- Elements normalized to valid types
- Level-appropriate items only
- Deterministic under seeded RNG

**Loot Stress Tests:**

QA suite generates 1000s of items to verify:
- No invalid stats generated
- Rarity distribution matches weights
- No crashes or exceptions
- Performance acceptable

### Enemies, Rarity & Affixes

Enemy creation pipeline in `systems/enemy/`.

**Enemy Components:**

```
Enemy Template (base stats, moves)
     ↓
┌─────────────────────────┐
│  Rarity Selection       │ ← Normal, elite, boss
│  - systems/enemy/rarity │
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  Affix Application      │ ← Thorns, vampiric, regen, etc.
│  - systems/enemy/affixes│
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  Stat Scaling           │ ← Based on difficulty & player level
│  - systems/enemy/builder│
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│  Display Name           │ ← "Vampiric Elite Goblin"
│  - systems/enemy/display│
└──────────┬──────────────┘
           ↓
      Runtime Enemy
```

**Enemy Rarity:**

| Rarity | HP Mult | Damage Mult | Loot Mult | XP Mult |
|--------|---------|-------------|-----------|---------|
| Normal | 1.0x | 1.0x | 1.0x | 1.0x |
| Elite | 2.5x | 1.5x | 3.0x | 2.5x |
| Boss | 5.0x | 2.0x | 5.0x | 5.0x |

**Common Affixes:**

- **Thorns**: Reflects damage to attacker
- **Vampiric**: Heals when dealing damage
- **Regenerating**: Heals each turn
- **Frozen**: Starts battle with shield
- **Enraged**: Increased damage, reduced accuracy
- **Armored**: High physical resistance
- **Warded**: High elemental resistance
- **Swift**: Acts twice per turn

### Quest System

Data-driven quest system split across multiple modules.

**Quest Modules:**

- `questDefs.js`: Quest definitions (steps, requirements, rewards)
- `questDefaults.js`: Default state and flags for each quest
- `questBindings.js`: World integration (triggers, side effects)
- `questTriggerRegistry.js`: Registry of trigger types
- `questSystem.js`: Lifecycle API (init/start/advance/complete)

**Quest Structure:**

```javascript
{
  id: "tutorial_combat",
  name: "First Blood",
  description: "Defeat your first enemy",
  steps: [
    {
      id: "start",
      text: "Find an enemy to battle",
      trigger: "combat:start",
      next: "victory"
    },
    {
      id: "victory",
      text: "Defeat the enemy",
      trigger: "combat:victory",
      next: "complete"
    }
  ],
  rewards: {
    gold: 50,
    xp: 100,
    items: ["potion"]
  }
}
```

**Quest Triggers:**

- `combat:start`: Combat initiated
- `combat:victory`: Won battle
- `item:acquired`: Got specific item
- `location:visited`: Visited location
- `npc:talked`: Spoke with NPC
- `time:day`: Specific day reached
- `condition:met`: Custom condition

**Quest Lifecycle:**

```
Quest Defined → Initialized → Started → Step 1 → Step 2 → ... → Completed → Rewards
```

### Village Simulation

Living village with interconnected economy, population, and governance.

**Village Modules:**

| Module | Purpose | Key Features |
|--------|---------|--------------|
| **merchant.js** | Shop system | Stock management, buy/sell, restock |
| **villageEconomy.js** | Economy | Price multipliers, inflation, demand |
| **villagePopulation.js** | Demographics | Population count, mood tracking |
| **bank.js** | Banking | Deposits, loans, interest rates |
| **townHall.js** | Governance | Petitions, decrees, elections |
| **tavern.js** | Social hub | Rest, rumors, bounties |
| **tavernGames.js** | Mini-games | Dice, cards, gambling |

**Economic Simulation:**

```
Player Actions
     ↓
┌──────────────────┐
│  Supply/Demand   │ ← Buying/selling affects prices
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Price Changes   │ ← Merchant adjusts prices
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Population Mood │ ← Economy affects happiness
└────────┬─────────┘
         ↓
┌──────────────────┐
│  Governance      │ ← Mood affects available decrees
└────────┬─────────┘
         ↓
   Feedback Loop
```

**Merchant System:**

- Dynamic stock based on player level
- Restock on daily tick
- Price fluctuation based on demand
- Bulk discount mechanics
- Reputation system (future)

**Banking System:**

- Deposit gold for safe keeping (earns interest)
- Take loans (with interest)
- Weekly interest compounding
- Late payment penalties
- Investment opportunities (future)

**Governance:**

- Petition system (request decrees)
- Active decrees (time-limited effects)
- Decree types: Tax cuts, bounties, festivals, restrictions
- Relationship with ruler affects available options

### Logging & UI

Structured logging system with UI runtime.

**UI Runtime** (`uiRuntime.js`):

```javascript
// Screen management
switchScreen(screenId) → void

// Modal system
openModal(modalConfig) → void
closeModal() → void

// Log rendering
addLogEntry(type, message, meta) → void
filterLogs(filters) → LogEntry[]

// Breakdown formatting (combat details)
formatBreakdown(breakdown) → string
```

**UI Bindings** (`uiBindings.js`):

Wires DOM events to game systems:

```javascript
// Menu buttons
document.getElementById('btnNewGame').onclick = handleNewGame;
document.getElementById('btnLoadGame').onclick = handleLoadGame;

// HUD gestures
hudElement.addEventListener('click', handleHudClick);
hudElement.addEventListener('touchstart', handleHudTouch);

// Log filters
logFilterChips.forEach(chip => {
  chip.onclick = () => toggleLogFilter(chip.dataset.filter);
});
```

**Log Entry Structure:**

```javascript
{
  id: unique_id,
  timestamp: Date.now(),
  type: "combat",           // system, combat, good, danger, info
  message: "Dealt 45 damage",
  meta: {
    breakdown: [ /* damage calculation details */ ],
    target: "goblin",
    ability: "strike"
  }
}
```

**Log Types:**

- `system`: World events (day change, merchant restock)
- `combat`: Battle actions and results
- `good`: Positive events (loot, level up, quest complete)
- `danger`: Negative events (damage taken, status applied)
- `info`: General information

### Diagnostics & QA Tools

Comprehensive testing and debugging suite for developers.

**Enable Dev Tools:**

1. During character creation, enable "Developer Cheats"
2. HUD pills appear for accessing tools:
   - **Cheat Menu**: Instant modifications
   - **Diagnostics**: Smoke tests & bug reports

**Smoke Tests:**

In-memory test suite that doesn't modify active save:

```javascript
// Test categories
- State Initialization
- Save/Load Cycle
- Combat Math
- Loot Generation
- Enemy Creation
- Quest Lifecycle
- Ability Classification
- Talent Integrity
- Economy Simulation
- Time System
```

**Scenario Runner:**

Simulates multiple days and loot batches to catch edge cases:

```javascript
// Scenario configuration
{
  days: 30,              // Simulate 30 days
  combatsPerDay: 5,      // 5 battles per day
  lootBatches: 10,       // 10 loot generation batches
  deterministicRNG: true // Use seeded RNG
}
```

**Bug Report Bundle:**

Exports comprehensive debugging information:

```javascript
{
  patch: "1.2.85",
  timestamp: "2026-01-13T22:00:00Z",
  userAgent: "...",
  saveSchema: { /* save structure */ },
  state: { /* current state snapshot */ },
  recentInputs: [ /* last 50 inputs */ ],
  recentLogs: [ /* last 100 log entries */ ],
  perfSnapshot: { /* performance metrics */ },
  rngLog: [ /* RNG call history */ ]
}
```

**Performance Snapshot:**

```javascript
{
  bootTime: 850,         // ms to interactive
  fps: 60,               // Current FPS
  memory: 45.2,          // MB used (if available)
  slowFrames: 3,         // Frames > 33ms
  stateSize: 128,        // KB
  logSize: 45            // KB
}
```

**Implementation Note:**

QA tools use adapters/hooks instead of reassigning ES module bindings (which are read-only), ensuring iOS Safari compatibility.

---

## ➕ Adding Content

Want to expand Emberwood? Here's how to add new content to the game.

### Add an Enemy

1. **Define Template**: Add enemy template to appropriate location (commonly in enemy builder inputs)
   
   ```javascript
   {
     id: "shadow_wolf",
     name: "Shadow Wolf",
     baseHp: 80,
     baseDamage: 15,
     level: 8,
     abilities: ["bite", "howl", "shadow_pounce"],
     affinities: {
       shadow: 0.5,  // Resistant to shadow
       holy: 1.5     // Weak to holy
     }
   }
   ```

2. **Add Abilities**: Define custom enemy abilities if needed in `data/enemyAbilities.js`

3. **Test**: Use Cheat Menu → Spawn Enemy → Enter `shadow_wolf`

4. **Balance**: Iterate on stats until encounter feels right

### Add an Item

1. **Define Item**: Add to `js/game/data/items.js`
   
   ```javascript
   {
     id: "flame_blade",
     name: "Flame Blade",
     type: "weapon",
     slot: "mainHand",
     rarity: "rare",
     level: 12,
     stats: {
       damage: 45,
       strength: 8,
       fireBonus: 0.15  // +15% fire damage
     },
     traits: ["on_hit_burn"],
     value: 800,
     description: "A blade wreathed in flame"
   }
   ```

2. **Add Trait** (if new): Implement trait logic in appropriate handler

3. **Test**: Use Cheat Menu → Give Item → Enter `flame_blade`

4. **Verify**:
   - Inventory display correct
   - Equip functionality works
   - Stats apply correctly
   - Sell value reasonable

### Add an Ability

1. **Define Ability**: Add to `js/game/data/abilities.js`
   
   ```javascript
   {
     id: "meteor_strike",
     name: "Meteor Strike",
     description: "Call down a meteor",
     cost: 50,
     cooldown: 3,
     targetType: "group",
     classification: "elemental",
     element: "fire",
     effects: [
       {
         type: "damage",
         power: 200,
         scaling: "intelligence"
       },
       {
         type: "status",
         status: "burn",
         duration: 4,
         chance: 0.8
       }
     ]
   }
   ```

2. **Implement Logic**: Add implementation in `js/game/combat/abilityEffects.js`
   
   ```javascript
   case 'meteor_strike':
     // Custom logic if needed beyond standard effects
     targets.forEach(target => {
       dealDamage(target, calculatedDamage);
       if (rollChance(0.8)) {
         applyStatus(target, 'burn', 4);
       }
     });
     break;
   ```

3. **Add Unlock**: If class-specific, add to class unlock table in `data/playerClasses.js`
   
   ```javascript
   abilityUnlocks: {
     15: ["meteor_strike"]  // Unlocks at level 15
   }
   ```

4. **Test**: Smoke Tests will validate ability classification automatically

### Add a Talent

1. **Define Talent**: Add to `js/game/data/talents.js`
   
   ```javascript
   {
     id: "elemental_fury",
     name: "Elemental Fury",
     description: "+20% elemental damage",
     tier: 2,
     requires: ["elemental_affinity"],
     maxRanks: 1,
     effects: {
       elementalDamageBonus: 0.20
     }
   }
   ```

2. **Ensure Stat Application**: Verify talent effects are picked up by stat recompute pipeline
   
   ```javascript
   // In stat computation
   if (hasTalent("elemental_fury")) {
     stats.elementalDamageBonus += 0.20;
   }
   ```

3. **Test**: Run Smoke Tests → Talent Integrity checks will verify:
   - Prerequisite chains valid
   - No orphaned talents
   - Effects properly typed
   - Summary displays correctly

### Add a Quest

1. **Define Quest**: Add to `js/game/quests/questDefs.js`
   
   ```javascript
   {
     id: "dragon_slayer",
     name: "Dragon Slayer",
     description: "Defeat the ancient dragon",
     steps: [
       {
         id: "find_lair",
         text: "Locate the dragon's lair",
         trigger: "location:dragon_mountain",
         next: "battle"
       },
       {
         id: "battle",
         text: "Defeat the dragon",
         trigger: "combat:victory",
         condition: (state) => state.combat.defeatedEnemyId === "ancient_dragon",
         next: "complete"
       }
     ],
     rewards: {
       gold: 5000,
       xp: 2000,
       items: ["dragon_scale", "legendary_weapon"]
     }
   }
   ```

2. **Add Default State**: In `questDefaults.js`
   
   ```javascript
   dragon_slayer: {
     started: false,
     completed: false,
     currentStep: null
   }
   ```

3. **Bind Triggers**: In `questBindings.js` if special integration needed
   
   ```javascript
   // Called when dragon is defeated
   onDragonDefeated(state) {
     advanceQuest(state, 'dragon_slayer');
   }
   ```

4. **Test**: Verify with Smoke Tests → Quest Lifecycle checks

---

## 🧪 Testing & Debugging

### Smoke Tests

Comprehensive automated test suite accessible via dev tools.

**Access**: HUD pill → "Smoke Tests & Bug Report" → Click "Run"

**Features:**

- Tests run in isolated memory (won't corrupt your save)
- Mobile mode: Quick tests (30 seconds)
- Desktop mode: Full tests (2-5 minutes)
- Detailed pass/fail reporting

**Test Categories:**

```
✓ State Initialization (5 tests)
✓ Save/Load Cycle (3 tests)
✓ Combat Math (12 tests)
✓ Loot Generation (8 tests)
✓ Enemy Creation (6 tests)
✓ Quest Lifecycle (7 tests)
✓ Ability Classification (10 tests)
✓ Talent Integrity (9 tests)
✓ Economy Simulation (5 tests)
✓ Time System (4 tests)
```

**Interpreting Results:**

- **Green**: All tests passed
- **Yellow**: Warnings (non-critical issues)
- **Red**: Failures (bugs found)

### Scenario Runner

Simulates extended gameplay to catch edge cases.

**Access**: Diagnostics Modal → "Scenario" Tab

**Configuration:**

```javascript
{
  days: 30,              // Simulate 30 days
  combatsPerDay: 5,      // Battles per day
  lootBatches: 10,       // Loot generation runs
  merchantRestocks: 30,  // Merchant restocks
  deterministicRNG: true // Reproducible results
}
```

**Catches:**

- Daily tick idempotence bugs
- Economy drift issues  
- Loot generator edge cases
- Save/load corruption
- Memory leaks
- Performance degradation

### Bug Reports

Export detailed debugging information for issue reports.

**Steps to Create Reproducible Bug Report:**

1. Enable Dev Cheats during character creation
2. Enable "Deterministic RNG" in Cheat Menu
3. Set RNG seed (e.g., 12345)
4. Reproduce the bug
5. Open Diagnostics → Click "Copy JSON"
6. Paste into GitHub issue

**Report Contains:**

```json
{
  "patch": "1.2.85",
  "timestamp": "2026-01-13T22:00:00Z",
  "userAgent": "Mozilla/5.0...",
  "saveSchema": { /* structure */ },
  "state": { /* full state snapshot */ },
  "recentInputs": [ /* last 50 player actions */ ],
  "recentLogs": [ /* last 100 log entries */ ],
  "perfSnapshot": { /* performance data */ },
  "rngLog": [ /* RNG call history */ ]
}
```

### Performance Profiling

Monitor game performance and identify bottlenecks.

**Access**: Diagnostics → "Perf Snapshot" button

**Metrics Tracked:**

- **Boot Time**: Time from page load to interactive
- **FPS**: Current frames per second
- **Memory Usage**: Heap size (if available)
- **Slow Frames**: Count of frames > 33ms
- **State Size**: Size of game state in memory
- **Save Size**: Size of serialized save data

**Performance Targets:**

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Boot Time | < 1s | < 2s | > 2s |
| FPS | 60 | 30-59 | < 30 |
| Memory | < 50MB | < 100MB | > 100MB |
| State Size | < 200KB | < 500KB | > 500KB |

---

## 🤝 Contributing Guidelines

### Design Goals

**Core Principles:**

1. **Modularity**: Keep systems small and single-purpose
2. **Testability**: Prefer pure functions over side effects
3. **Readability**: Code should be self-documenting
4. **Performance**: Optimize for browser constraints
5. **Compatibility**: Support modern browsers without build tools

**Architecture Rules:**

- **Prefer pure logic modules** (no DOM manipulation in game logic)
- **Use UI adapters/hooks** rather than importing gameplay code into UI modules
- **Avoid circular dependencies** (enforced by layer architecture)
- **Keep data separate from logic** (use `data/` directory for definitions)

### iOS / ES Module Pitfalls to Avoid

⚠️ **Common iOS Safari Issues:**

1. **Temporal Dead Zones**
   ```javascript
   // ❌ Bad: Reference before initialization
   export const myFunc = () => otherFunc();
   export const otherFunc = () => { /* ... */ };
   
   // ✅ Good: Function declarations hoist
   export function myFunc() { return otherFunc(); }
   export function otherFunc() { /* ... */ }
   ```

2. **Read-Only Imports**
   ```javascript
   // ❌ Bad: Cannot reassign imported bindings
   import { gameState } from './state.js';
   gameState = newState; // ERROR!
   
   // ✅ Good: Use adapters or return new values
   import { updateGameState } from './state.js';
   const newState = updateGameState(changes);
   ```

3. **Module Evaluation Order**
   ```javascript
   // ❌ Bad: Side effects during module evaluation
   import { startEngine } from './engine.js';
   startEngine(); // Called during import!
   
   // ✅ Good: Export initialization function
   export function initGame() {
     startEngine();
   }
   ```

### Style

**JavaScript Style:**

- **ES6+**: Use modern JavaScript features
- **Semicolons**: Always use semicolons
- **Quotes**: Single quotes for strings
- **Indentation**: 2 spaces (no tabs)
- **Line length**: Soft limit of 100 characters
- **Comments**: Explain "why", not "what"

**Naming Conventions:**

```javascript
// camelCase for variables and functions
const playerHealth = 100;
function calculateDamage() { }

// PascalCase for classes
class EnemyBuilder { }

// UPPERCASE for constants
const MAX_INVENTORY_SIZE = 100;

// Prefix private with underscore
const _internalHelper = () => { };
```

**File Organization:**

```javascript
// 1. Imports
import { system } from './system.js';

// 2. Constants
const DEFAULT_VALUE = 10;

// 3. Helper functions (private)
function _helperFunction() { }

// 4. Public API
export function publicFunction() { }

// 5. Exports
export { DEFAULT_VALUE };
```

### Pull Request Process

1. **Fork & Branch**: Create feature branch from `main`
   ```bash
   git checkout -b feature/new-enemy-type
   ```

2. **Make Changes**: Follow style guide and architecture principles

3. **Test**: Run smoke tests and verify changes work
   - Enable dev cheats
   - Run full smoke test suite
   - Test new feature manually
   - Check for console errors

4. **Update Changelog**: Add entry to `js/game/changelog/changelog.js`
   ```javascript
   {
     version: "1.2.73",
     date: "2026-01-15",
     changes: [
       "Added shadow wolf enemy type",
       "Fixed bug in loot generation"
     ]
   }
   ```

5. **Commit**: Write clear commit messages
   ```bash
   git commit -m "feat: add shadow wolf enemy type

   - Created shadow wolf template with unique abilities
   - Added shadow affinity mechanics
   - Balanced stats for level 8 encounters"
   ```

6. **Push & PR**: Push branch and create pull request
   - Describe what changes were made
   - Explain why changes were needed
   - Note any breaking changes
   - Include screenshots if UI changed

7. **Code Review**: Address feedback and update PR

8. **Merge**: Maintainer will merge when approved

---

## 📦 Versioning & Releases

### Patch Label

Version information lives in `js/game/systems/version.js`:

```javascript
export const GAME_PATCH = "1.2.85";
export const GAME_PATCH_NAME = "Engine Integration Expansion - Kingdom, Loot & Quest Systems";
export const GAME_FULL_LABEL = `v${GAME_PATCH} — ${GAME_PATCH_NAME}`;
```

**Version Format**: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (incompatible saves)
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes and minor tweaks

### In-Game Changelog

Changelog entries in `js/game/changelog/changelog.js`:

```javascript
export const CHANGELOG = [
  {
    version: "1.2.85",
    date: "2026-01-14",
    title: "Engine Integration Expansion - Kingdom, Loot & Quest Systems",
    changes: [
      {
        category: "Features",
        items: [
          "Added autosave on significant events",
          "Improved input handling system"
        ]
      },
      {
        category: "Bug Fixes",
        items: [
          "Fixed combat AoE defeat resolution",
          "Corrected equipment stat application"
        ]
      }
    ]
  }
];
```

**Changelog Best Practices:**

- Use clear, user-friendly language
- Group changes by category (Features, Bug Fixes, Balance, Performance)
- Link to relevant documentation for complex features
- Note any breaking changes prominently

### Save Schema

When changing save structure:

1. **Increment Version**: Update version in `version.js`

2. **Add Migration**: In `saveManager.js`
   ```javascript
   {
     version: 73,
     description: "Add companion system",
     apply: (state) => {
       if (!state.companions) {
         state.companions = {
           active: null,
           unlocked: []
         };
       }
       return state;
     }
   }
   ```

3. **Test Migration**: Verify old saves load correctly
   - Create save with old version
   - Load in new version
   - Verify migration applied
   - Check all systems work

4. **Document Changes**: Note in changelog

**Migration Principles:**

- **Additive**: Add new fields with defaults
- **Tolerant**: Preserve unknown fields
- **Idempotent**: Safe to run multiple times
- **Logged**: Log migration results for debugging

---

## 🔒 Security Considerations

### Client-Side Security

**Data Storage:**

- All data stored in `localStorage` (client-side only)
- No server-side persistence
- No authentication required
- Private/incognito mode affects storage availability

**Save Data:**

- Saves are JSON and easily modifiable by users
- No encryption (single-player game)
- Users can cheat by editing localStorage
- Dev cheats provide legitimate cheat access

**Input Validation:**

```javascript
// All user input validated
function parseGoldAmount(input) {
  const value = parseInt(input, 10);
  if (isNaN(value) || value < 0 || value > MAX_GOLD) {
    return 0; // Safe default
  }
  return value;
}
```

**XSS Prevention:**

```javascript
// Text sanitized before DOM insertion
function addLogMessage(message) {
  const div = document.createElement('div');
  div.textContent = message; // Not innerHTML!
  logContainer.appendChild(div);
}
```

### Content Security

**Third-Party Code:**

- No external JavaScript libraries
- No CDN dependencies
- All code self-contained
- No analytics or tracking

**Asset Loading:**

- All assets served from same origin
- No external image/font loading
- Relative paths only

---

## ⚡ Performance Optimization

### Current Performance Profile

**Measurements (typical gameplay):**

- Boot time: ~850ms
- Memory usage: ~45MB
- State size: ~128KB
- Save size: ~85KB (compressed)
- FPS: 60 (stable)

### Optimization Strategies

**State Management:**

```javascript
// ✅ Good: Shallow copies for small changes
const newState = {
  ...state,
  player: {
    ...state.player,
    hp: newHp
  }
};

// ❌ Avoid: Deep cloning entire state
const newState = JSON.parse(JSON.stringify(state));
```

**DOM Updates:**

```javascript
// ✅ Good: Batch DOM updates
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const div = createItemElement(item);
  fragment.appendChild(div);
});
container.appendChild(fragment);

// ❌ Avoid: Individual DOM updates in loop
items.forEach(item => {
  container.appendChild(createItemElement(item));
});
```

**Event Handlers:**

```javascript
// ✅ Good: Event delegation
container.addEventListener('click', (e) => {
  if (e.target.matches('.btn-attack')) {
    handleAttack(e.target.dataset.enemyId);
  }
});

// ❌ Avoid: Handler per element
buttons.forEach(btn => {
  btn.addEventListener('click', () => handleAttack(btn.dataset.enemyId));
});
```

### Performance Budget

| Resource | Budget | Current | Status |
|----------|--------|---------|--------|
| Boot time | < 1000ms | ~850ms | ✅ Good |
| Memory | < 100MB | ~45MB | ✅ Good |
| Save size | < 500KB | ~85KB | ✅ Good |
| FPS (combat) | 60 FPS | 60 FPS | ✅ Good |

---

## ❓ FAQ & Troubleshooting

### Common Issues

**Q: Game won't load / blank screen**

A: Check browser console for errors. Common causes:
- ES modules not supported (update browser)
- File:// protocol used (use HTTP server instead)
- Browser extensions blocking scripts
- Private/incognito mode (check localStorage access)

**Q: Save not persisting**

A: Possible causes:
- Private/incognito mode enabled
- Browser storage full
- localStorage disabled in settings
- Browser clearing storage automatically

Solution: Check browser settings, disable private mode, clear space

**Q: Performance issues / low FPS**

A: Try:
- Close other browser tabs
- Disable browser extensions
- Clear browser cache
- Reduce combat log size (filter logs)
- Check browser task manager for memory leaks

**Q: Combat damage seems wrong**

A: Enable dev cheats and check combat log breakdown:
- View detailed damage calculation
- Check for buffs/debuffs affecting damage
- Verify enemy resistances/affinities
- Check equipment stat application

**Q: Can't click buttons / UI not responding**

A: Possible causes:
- Modal overlay blocking clicks (press ESC)
- JavaScript error (check console)
- Touch event conflict (iOS specific)
- Z-index issue (some elements covering others)

### Browser-Specific Issues

**iOS Safari:**

- Use HTTP server (not file://)
- Ensure iOS 14+ for ES module support
- Disable "Prevent Cross-Site Tracking" if issues persist
- Clear Safari cache if modules won't load

**Firefox:**

- Enable `dom.moduleScripts.enabled` in about:config (should be default)
- Check localStorage not disabled in privacy settings

**Chrome:**

- Check site settings allow JavaScript
- Verify localStorage not blocked for site
- Disable strict site isolation if module loading fails

### Debug Mode

Enable verbose logging:

```javascript
// In browser console
localStorage.setItem('emberwood_debug', 'true');
location.reload();
```

Disable debug mode:

```javascript
localStorage.removeItem('emberwood_debug');
location.reload();
```

---

## 🗺️ Roadmap

### Planned Features

**Short Term (Next Few Patches):**

- [ ] Companion system expansion
- [ ] New enemy types and boss encounters
- [ ] Additional talent trees
- [ ] More quest chains
- [ ] Expanded village interactions
- [ ] New item types and traits

**Medium Term:**

- [ ] Prestige/New Game+ system
- [ ] Achievements system
- [ ] More locations beyond village
- [ ] Crafting system
- [ ] Enchanting system
- [ ] Guild/faction system

**Long Term:**

- [ ] Multiplayer trading (async)
- [ ] Leaderboards (optional)
- [ ] Mod support
- [ ] Mobile app (PWA)
- [ ] Additional game modes
- [ ] Seasonal events

### Community Requests

Vote on features or request new ones via GitHub Issues!

**Most Requested:**
1. More character classes
2. Pet/summon system
3. Housing/base building
4. More mini-games
5. Story expansion

---

## 📜 License

**License Information:**

This project currently does not have an explicit license file. Please contact the repository owner for licensing details before:

- Using this code in your own projects
- Distributing modified versions
- Creating derivative works
- Commercial use

**Third-Party Assets:**

If you add third-party assets (images, sounds, fonts), please:
1. Ensure you have rights to use them
2. Document sources in this README
3. Include appropriate license files
4. Respect attribution requirements

**Suggested License:**

Consider adding one of these open-source licenses:

- **MIT License**: Permissive, allows commercial use
- **GPL-3.0**: Copyleft, derivative works must be open source
- **Apache 2.0**: Permissive with patent grant
- **Creative Commons**: For content/assets

To add a license, create a `LICENSE` file in the repository root.

---

## 🙏 Credits & Acknowledgments

### Development

- **Creator**: alsub25
- **Version**: 1.2.85 - Engine Integration Expansion - Kingdom, Loot & Quest Systems
- **Repository**: [Emberwood-The-Blackbark-Oath](https://github.com/alsub25/Emberwood-The-Blackbark-Oath)

### Inspiration

This project draws inspiration from:
- Classic roguelikes
- Incremental/idle games
- Village simulation games
- Turn-based RPGs

### Special Thanks

- The browser gamedev community
- ES modules specification authors
- Open source game development resources
- Playtresters and bug reporters

### Tools & Technologies

- **Native ES Modules**: JavaScript standard for modular code
- **LocalStorage API**: Browser persistence
- **Vanilla JavaScript**: No framework dependencies
- **HTML5 & CSS3**: Modern web standards

---

<div align="center">

### 🌲 Happy Adventuring! ⚔️

**Found a bug?** [Open an issue](https://github.com/alsub25/Emberwood-The-Blackbark-Oath/issues)  
**Have a feature idea?** [Start a discussion](https://github.com/alsub25/Emberwood-The-Blackbark-Oath/discussions)  
**Want to contribute?** [Read the contributing guide](#-contributing-guidelines)

---

*Made with ❤️ and vanilla JavaScript*

</div>
