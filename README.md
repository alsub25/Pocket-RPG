<div align="center">

# 🌲 Emberwood: The Blackbark Oath ⚔️

### *A Browser-Based Fantasy RPG & Living Village Simulator*

[![Version](https://img.shields.io/badge/version-1.2.90-blue.svg)](https://github.com/alsub25/Emberwood-The-Blackbark-Oath)
[![License](https://img.shields.io/badge/license-See%20License%20Section-green.svg)](#-license)
[![No Build Required](https://img.shields.io/badge/build-none-brightgreen.svg)](#-quick-start)
[![ES Modules](https://img.shields.io/badge/modules-native%20ES-orange.svg)](#-quick-start)

**[🎮 Play Now](#-quick-start) • [📖 Features](#-key-features) • [🚀 Deploy](#-deployment) • [🐛 Report Bug](#-testing--debugging)**

> **Current Patch:** v1.2.90 — *Enhanced Class Complexity & Depth*

</div>

---

## 🎯 About

**Emberwood: The Blackbark Oath** is a rich single-page browser RPG that blends tactical turn-based combat with a living village simulation. Your choices—from tavern rest to merchant trades, bank loans to political influence—ripple through an interconnected world where every system feeds into your settlement's social and economic fabric.

**🌟 What Makes It Special:**
- **Zero Build Setup** — Native ES modules, no bundler or build tools needed
- **Deploy Anywhere** — Works on any static host (GitHub Pages, Netlify, etc.)
- **Offline-First** — Runs entirely in-browser with localStorage persistence
- **Developer-Friendly** — Comprehensive testing suite and deterministic debugging

### ✨ Key Features

| 🎲 Combat | 🏘️ Village | ⚡ Progression | 🛠️ Dev Tools |
|-----------|------------|---------------|---------------|
| Turn-based tactical battles | Dynamic economy | Multiple classes | Smoke test suite |
| Multi-enemy encounters | Merchant trading | Talent trees | Scenario runner |
| Status effects & synergies | Banking & loans | Procedural loot | Bug reporting |
| Elemental interactions | Town hall governance | Skill allocation | Performance profiling |
| Enemy intent system | Population moods | Ability unlocks | Deterministic RNG |

---

## 📑 Quick Navigation

<details>
<summary><b>📚 Click to expand full table of contents</b></summary>

### 🚀 Getting Started
- [Quick Start Guide](#-quick-start) - Run the game locally
- [Deployment](#-deployment) - Host on GitHub Pages, Netlify, etc.
- [Browser Compatibility](#browser-compatibility)

### 🏗️ For Developers
- [Project Structure](#-project-layout) - File organization
- [Architecture](#%EF%B8%8F-architecture-overview) - Engine design & data flow
- [Gameplay Systems](#%EF%B8%8F-gameplay-systems) - Combat, quests, economy
- [Adding Content](#-adding-content) - Enemies, items, quests
- [Testing & Debugging](#-testing--debugging) - QA tools & bug reports
- [Contributing](#-contributing-guidelines) - How to contribute

### 📚 Reference
- [FAQ & Troubleshooting](#-faq--troubleshooting)
- [Roadmap](#%EF%B8%8F-roadmap)
- [License](#-license)
- [Credits](#-credits--acknowledgments)

</details>

---

## 🚀 Quick Start

### Local Development

Emberwood uses **native ES modules** which require a web server (CORS restrictions). Choose your method:

```bash
# Python 3 (simplest)
python -m http.server 8000

# Node.js
npx serve .

# Or any other local server...
```

Then open `http://localhost:8000` in your browser.

<details>
<summary><b>More server options (click to expand)</b></summary>

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

**Node.js alternatives:**
```bash
npx http-server -p 8000
npm install -g serve && serve .
```

**Rust (ultra-fast):**
```bash
cargo install miniserve && miniserve . -p 8000
```

**PHP:**
```bash
php -S localhost:8000
```

**Ruby:**
```bash
ruby -run -e httpd . -p 8000
```

**VS Code:** Install "Live Server" extension
**Chrome:** Use "Web Server for Chrome" extension

</details>

### Browser Compatibility

| Browser | Min Version | Status |
|---------|-------------|--------|
| Chrome/Edge | 87+ | ✅ Full support |
| Firefox | 78+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| iOS Safari | 14+ | ⚠️ Use HTTP server |

**Required:** ES Modules, localStorage, Promises, modern JavaScript (ES6+)

### ⚠️ iOS/Safari Users

**Always use an HTTP server** — The `file://` protocol may cause module loading issues. If you must use `file://`:
- Ensure latest Safari/iOS version
- Disable private browsing (for localStorage)
- Allow local file access in settings

---

## 🌐 Deployment

### GitHub Pages (Recommended)

1. Go to **Settings → Pages** in your repository
2. Set **Source** to "Deploy from a branch"
3. Choose branch: `main`, folder: `/ (root)`
4. Save and your site will be live at `https://[username].github.io/[repo-name]/`

✨ **No configuration needed!** All paths are relative and work anywhere.

<details>
<summary><b>Other hosting platforms (click to expand)</b></summary>

### Netlify
```bash
# Via CLI
npm install -g netlify-cli
netlify deploy --prod --dir .
```
Or connect via GitHub (no build command needed)

### Vercel
```bash
npm install -g vercel
vercel --prod
```

### AWS S3 + CloudFront
```bash
aws s3 sync . s3://your-bucket/ --exclude ".git/*"
aws s3 website s3://your-bucket/ --index-document index.html
```

### Cloudflare Pages
Connect repository, set build command to "None", output directory to `/`

</details>

---

## 📁 Project Layout

```
Emberwood-The-Blackbark-Oath/
├── index.html              # Entry point
├── style.css               # Global styles
├── assets/                 # Static assets
└── js/
    ├── boot/               # Bootstrap & initialization
    ├── shared/             # Cross-layer utilities
    ├── engine/             # Core game engine
    └── game/               # Game-specific code
        ├── main.js         # Game entry point
        ├── runtime/        # Game orchestration
        ├── plugins/        # Engine plugins
        ├── persistence/    # Save system
        ├── ui/             # User interface
        ├── data/           # Game data (abilities, items, etc.)
        ├── combat/         # Combat system
        ├── systems/        # Core systems (time, RNG, loot, etc.)
        ├── locations/      # Village, merchant, bank, tavern
        ├── quests/         # Quest system
        └── qa/             # Quality assurance tools
```

<details>
<summary><b>Full directory tree (click to expand)</b></summary>

```
Emberwood-The-Blackbark-Oath/
│
├── index.html              # Main entry point
├── style.css               # Global styles & theme
├── README.md               # This file
│
├── assets/                 # Static assets
│
└── js/                     # All JavaScript modules
    ├── boot/               # Bootstrap & initialization
    │   ├── bootstrap.js
    │   ├── bootLoader.js
    │   ├── userAcceptance.js
    │   └── lib/safeStorage.js
    │
    ├── shared/             # Cross-layer utilities
    │   └── storage/safeStorage.js
    │
    ├── engine/             # Core game engine
    │   ├── engine.js
    │   ├── perf.js
    │   └── storageRuntime.js
    │
    └── game/               # Game-specific code
        ├── main.js
        ├── runtime/        # Game orchestration
        ├── plugins/        # Engine plugins
        ├── persistence/    # Save system
        ├── ui/             # User interface
        ├── data/           # Game data definitions
        ├── combat/         # Combat system
        ├── systems/        # Core game systems
        ├── locations/      # Game locations (village, etc.)
        ├── quests/         # Quest system
        ├── changelog/      # Patch notes
        ├── state/          # State management
        ├── utils/          # Utility functions
        └── qa/             # Quality assurance
```

</details>

### Import Strategy

```javascript
// ✅ Explicit relative imports with .js extension
import { saveGame } from './persistence/saveManager.js';
import { rollDice } from '../systems/rng/rng.js';

// ❌ Don't use bundler-style imports
import { saveGame } from '@/persistence/saveManager';
```

**Principles:** ES Modules only, always include `.js`, use relative paths, no circular dependencies

---

## 🏗️ Architecture Overview

Emberwood uses an **engine-first architecture** where the Locus Engine orchestrates all game systems through well-defined services.

### Boot Sequence

```
User Opens Page → bootstrap.js → Storage Check → Engine Init → Game Systems Load → Ready!
```

**Timing Targets:** Total to interactive < 1000ms

### Core Services

The Engine provides these core services to all game systems:

| Service | Purpose | Example |
|---------|---------|---------|
| **State** | Single source of truth | `engine.state.player.hp` |
| **Events** | Pub/sub event bus | `engine.emit('combat:start')` |
| **Commands** | Action dispatch | `engine.command('attack')` |
| **Save/Load** | Persistence | `engine.save()` |
| **RNG** | Random numbers | `engine.rng.roll(1, 20)` |
| **Logging** | Structured logs | `engine.log.info('msg')` |

### Data Flow

```
User Input → UI Bindings → Game Systems → State Update → Events → UI Render → DOM
```

<details>
<summary><b>Detailed architecture documentation (click to expand)</b></summary>

### Layer Architecture

```
Boot Layer (js/boot/) → Shared Layer (js/shared/) → Engine Layer (js/engine/) → Game Layer (js/game/)
```

- **Boot**: First code execution, storage checks, loading screen
- **Shared**: Cross-layer utilities, no dependencies
- **Engine**: Generic game engine, state/events/plugins
- **Game**: Emberwood-specific content and systems

### State Structure

```javascript
state = {
  player: { /* character stats, inventory, equipment */ },
  time: { /* day, dayPart */ },
  village: { /* economy, merchant, population */ },
  quests: { /* active, completed */ },
  combat: { /* enemies, turn count (only during battle) */ },
  bank: { /* deposits, loans */ },
  government: { /* decrees, petitions */ },
  ui: { /* current screen, modals */ },
  flags: { /* dev cheats, debug modes */ },
  log: [ /* event history */ ]
}
```

</details>

---

## ⚙️ Gameplay Systems

### Core Mechanics

**Combat** - Turn-based with status effects, elemental interactions, and enemy intents  
**Progression** - Classes, talents, skills, and equipment  
**Village** - Dynamic economy, merchant, bank, tavern, and governance  
**Quests** - Data-driven quest system with triggers and rewards  
**Time** - Day/night cycle with daily tick events  

<details>
<summary><b>Detailed system documentation (click to expand)</b></summary>

### State Model & Save Schema

Game state is a single object with these main buckets:

| Bucket | Contents |
|--------|----------|
| `player` | Stats, level, HP, inventory, equipment, talents |
| `time` | Day index, day part (morning/afternoon/evening/night) |
| `combat` | Enemies, turn count (only during battle) |
| `quests` | Active quests, completed quests |
| `village` | Economy, merchant stock, population |
| `government` | Decrees, petitions, king relationship |
| `bank` | Deposits, loans, interest |
| `ui` | Current screen, modals, filters |
| `flags` | Dev cheats, debug modes |
| `log` | Event history |

**Persistence:** Saved to localStorage with migration system for version compatibility.

### Time System & Daily Ticks

Time advances through day parts (morning → afternoon → evening → night). When a new day starts, these systems run:

1. **Economy** adjustments (prices, supply/demand)
2. **Merchant** restock (new items)
3. **Decrees** processing (expire/apply effects)
4. **Bank** interest (deposits/loans)
5. **Population** mood shifts

### RNG & Determinism

- **Normal RNG**: Standard `Math.random()` for gameplay
- **Deterministic RNG**: Seeded RNG for bug reproduction
- **RNG Logging**: Optional logging of all RNG calls (for debugging)

Enable deterministic mode in dev cheats to reproduce bugs with a specific seed.

### Combat System

Turn-based combat with rich mechanics:

- **Intent System** - Enemies telegraph their next action
- **Interrupts** - Spend resources to cancel enemy moves
- **AoE Attacks** - Hit all enemies at once
- **Status Effects** - Buffs, debuffs, DoTs, HoTs
- **Elements** - Fire, ice, lightning, nature, shadow, holy
- **Critical Hits** - Bonus damage based on stats
- **Resistances** - Armor and elemental resistances reduce damage

**Damage Formula:**
```
Base × Crit × Element × (1 - Resist) × Variance
```

### Abilities, Status Effects & Elements

**Ability Types:** Damage, heal, status, buff, debuff, resource manipulation

**Status Effects:**
- **DoTs**: Burn, Poison, Bleed
- **Control**: Stun, Chill, Fear
- **Buffs**: Regen, Shield, Haste
- **Debuffs**: Vulnerability, Weakness

**Elemental System:**
- Fire (burst damage, causes Burn)
- Ice (slows, causes Chill)
- Lightning (chains, causes Shocked)
- Nature (DoT, causes Poison)
- Shadow (ignores armor)
- Holy (heals allies, damages undead)

**Damage:** `Base × Affinity × (1 - Resist) × (1 + Bonus)`

### Progression & Content

**Classes** - Define playstyle, abilities, and resource type (mana, rage, energy, focus)  
**Talents** - Passive bonuses in talent trees (combat, defense, utility, elemental)  
**Equipment** - Weapons, armor, accessories with stats and procedural traits  
**Items** - Consumables, materials, quest items (stackable vs. unique)

**Loot Generation:**
- **Rarities**: Common (50%), Uncommon (30%), Rare (15%), Epic (4%), Legendary (1%)
- **Stat Multipliers**: Common 1.0x → Legendary 2.5x
- **Traits**: Higher rarity = better/more traits
- **Affixes**: Procedural modifiers on items

**Enemy System:**
- **Rarities**: Normal, Elite (2.5x HP/loot), Boss (5x HP/loot)
- **Affixes**: Thorns, Vampiric, Regenerating, Enraged, etc.
- **Scaling**: Based on player level and difficulty

### Quest System

Data-driven quests with triggers and rewards defined in `quests/` modules.

**Quest Lifecycle:** Defined → Initialized → Started → Steps → Completed → Rewards

**Triggers:** `combat:start`, `combat:victory`, `item:acquired`, `location:visited`, `npc:talked`, `time:day`, custom conditions

### Village Simulation

Living village with interconnected systems:

**Merchant** - Buy/sell items, dynamic stock, price fluctuation  
**Bank** - Deposits (earn interest), loans (pay interest)  
**Tavern** - Rest, mini-games (dice, cards), rumors  
**Town Hall** - Petitions, decrees, governance  
**Economy** - Supply/demand affects prices  
**Population** - Mood tracking affects available options

**Economic Loop:** Player actions → Supply/Demand → Prices → Population Mood → Governance Options

</details>

---

## ➕ Adding Content

### Quick Guides

<details>
<summary><b>Add an Enemy</b></summary>

1. Define enemy template with stats, abilities, and affinities
2. Add custom abilities to `data/enemyAbilities.js` if needed
3. Test with Cheat Menu → Spawn Enemy
4. Iterate on balance

</details>

<details>
<summary><b>Add an Item</b></summary>

1. Add to `js/game/data/items.js` with id, type, slot, rarity, stats, traits
2. Implement new traits in appropriate handler if needed
3. Test with Cheat Menu → Give Item
4. Verify inventory, equip, stats, and sell value

</details>

<details>
<summary><b>Add an Ability</b></summary>

1. Define in `js/game/data/abilities.js` with cost, effects, element
2. Implement logic in `js/game/combat/abilityEffects.js` if custom behavior needed
3. Add to class unlock table in `data/playerClasses.js` if class-specific
4. Smoke Tests will validate classification

</details>

<details>
<summary><b>Add a Talent</b></summary>

1. Define in `js/game/data/talents.js` with tier, requirements, effects
2. Ensure stat recomputation picks up talent effects
3. Run Smoke Tests → Talent Integrity to verify

</details>

<details>
<summary><b>Add a Quest</b></summary>

1. Define in `js/game/quests/questDefs.js` with steps, triggers, rewards
2. Add default state in `questDefaults.js`
3. Bind triggers in `questBindings.js` if special integration needed
4. Verify with Smoke Tests → Quest Lifecycle

</details>

---

## 🧪 Testing & Debugging

### Dev Tools Access

Enable "Developer Cheats" during character creation to access:
- **Cheat Menu** - Instant modifications (spawn items, change stats, skip time)
- **Diagnostics** - Smoke tests, scenario runner, bug reports

### Smoke Tests

Automated test suite (runs in isolated memory, won't corrupt saves):
- State Initialization, Save/Load, Combat Math
- Loot Generation, Enemy Creation, Quest Lifecycle
- Ability Classification, Talent Integrity
- Economy Simulation, Time System

**Mobile:** Quick tests (~30s) | **Desktop:** Full tests (~2-5min)

### Bug Reports

**Quick GitHub Issue:** Click "Feedback / Bug Report" → Fill details → "Create GitHub Issue" (auto-filled with game state)

**Detailed Report:** Enable Dev Cheats → Deterministic RNG → Set seed → Reproduce bug → Diagnostics → Copy JSON

Report includes: patch version, state snapshot, recent inputs/logs, performance data, RNG history

### Performance Profiling

**Access:** Diagnostics → "Perf Snapshot"

**Targets:** Boot < 1s, FPS 60, Memory < 50MB, State < 200KB

---

## 🤝 Contributing Guidelines

### Design Principles

1. **Modularity** - Keep systems small and single-purpose
2. **Testability** - Prefer pure functions
3. **Readability** - Self-documenting code
4. **Performance** - Optimize for browser constraints
5. **Compatibility** - Support modern browsers without build tools

### Code Style

- **JavaScript**: ES6+, semicolons, single quotes, 2-space indent
- **Naming**: camelCase functions/variables, PascalCase classes, UPPERCASE constants
- **Files**: camelCase names, `.js` extension required, relative imports

### iOS/Safari Pitfalls to Avoid

```javascript
// ✅ Good: Function declarations hoist
export function myFunc() { return otherFunc(); }

// ❌ Bad: Temporal dead zone errors
export const myFunc = () => otherFunc();
export const otherFunc = () => { /* ... */ };
```

```javascript
// ✅ Good: Use adapters for state updates
import { updateState } from './state.js';

// ❌ Bad: Cannot reassign imports (read-only)
import { state } from './state.js';
state = newState; // ERROR!
```

### Pull Request Process

1. Fork & create feature branch
2. Make changes following style guide
3. Run smoke tests and verify manually
4. Update changelog (` js/game/changelog/changelog.js`)
5. Commit with clear messages
6. Push and create PR with description
7. Address review feedback
8. Maintainer merges when approved

---

## 📦 Versioning & Releases

**Version Format:** `MAJOR.MINOR.PATCH` (e.g., 1.2.85)
- **MAJOR** - Breaking changes (incompatible saves)
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes

**Version Info:** `js/game/systems/version.js`  
**Changelog:** `js/game/changelog/changelog.js` (shown in-game)

**Save Migrations:** When changing save structure, add migration in `saveManager.js` with version number and transformation function.

---

## 🔒 Security & Performance

### Security Notes

- **Client-side only** - All data in localStorage, no server
- **No encryption** - Single-player game, users can edit saves
- **Input validation** - All user input sanitized
- **XSS prevention** - Text sanitized before DOM insertion
- **No external dependencies** - Self-contained code

### Performance

**Current Profile:** Boot ~850ms, Memory ~45MB, FPS 60, State ~128KB

**Best Practices:**
- Shallow copies for state updates (not deep clones)
- Batch DOM updates with DocumentFragment
- Event delegation instead of individual handlers

---

## ❓ FAQ & Troubleshooting

**Game won't load?** Check browser console. Common causes: old browser, file:// protocol, blocked scripts, private mode.

**Save not persisting?** Disable private/incognito mode, check storage quota, verify localStorage enabled.

**Performance issues?** Close other tabs, disable extensions, clear cache, filter combat logs.

**Combat damage wrong?** Enable dev cheats, check combat breakdown for buff/debuff/resistance details.

**UI not responding?** Press ESC to close modals, check console for errors.

**iOS Safari:** Always use HTTP server (not file://), ensure iOS 14+, clear cache if needed.

---

## 🗺️ Roadmap

### Short Term
- Companion system expansion
- New enemies and bosses
- Additional talent trees
- More quest chains

### Medium Term
- Prestige/New Game+ system
- Achievements
- Crafting & enchanting
- More locations

### Long Term
- Multiplayer trading (async)
- Leaderboards
- Mod support
- Mobile PWA

**Vote on features:** [GitHub Issues](https://github.com/alsub25/Emberwood-The-Blackbark-Oath/issues)

---

## 📜 License

This project currently does not have an explicit license file. **Contact the repository owner** before:
- Using code in your projects
- Distributing modified versions
- Creating derivative works
- Commercial use

**Adding third-party assets?** Ensure proper rights, document sources, include licenses, respect attribution.

---

## 🙏 Credits & Acknowledgments

**Creator:** alsub25  
**Version:** 1.2.85 - Engine Integration Expansion  
**Repository:** [Emberwood-The-Blackbark-Oath](https://github.com/alsub25/Emberwood-The-Blackbark-Oath)

**Inspiration:** Classic roguelikes, incremental games, village sims, turn-based RPGs

**Technologies:** Native ES Modules, localStorage API, Vanilla JavaScript, HTML5/CSS3

---

<div align="center">

### 🌲 Happy Adventuring! ⚔️

**[🐛 Report Bug](https://github.com/alsub25/Emberwood-The-Blackbark-Oath/issues)** • **[💡 Feature Ideas](https://github.com/alsub25/Emberwood-The-Blackbark-Oath/discussions)** • **[🤝 Contribute](#-contributing-guidelines)**

---

*Made with ❤️ and vanilla JavaScript*

</div>
