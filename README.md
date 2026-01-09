# Emberwood: The Blackbark Oath

A single‑page, browser RPG + village simulation where **daily decisions** (resting, shopping, banking, local politics, and tavern games) ripple through a living settlement — and where combat, loot, and quests feed back into that world loop.

> Current patch: **v1.2.70 — The Blackbark Oath — Hardening & Bug Squash**  
> Changelog: open the in‑game **Changelog** modal.

---

## What this project is

Emberwood is built like a **self‑contained game “appliance”**:
- Runs entirely in the browser (no backend required).
- Uses **native ES modules** for code organization.
- Saves persist to the local browser via `localStorage`.
- Includes an optional **Developer Cheats / QA** menu for testing and reproducibility.

It’s designed to be easy to iterate on: most systems are isolated into small modules (economy, bank, town hall, RNG, time, loot, quests) with a single coordinating “game” module.

---

## Quick start

### Run locally (recommended)

Because the project uses ES modules, it should be served via a local web server. Opening `index.html` via `file://` can block imports on many browsers (and is especially unreliable on mobile Safari).

#### Python
```bash
python -m http.server 8000
```

#### Node
```bash
npx serve .
```

Open:
- `http://localhost:8000`

### Host it (static hosting)

Any static host works (GitHub Pages, Netlify, etc.). The project does not require server-side logic.

---

## Project layout (Patch 1.2.70)

The codebase is now organized around *purpose* (boot vs engine vs systems vs locations) to make large refactors safer.

- `js/boot/` — early boot scripts (version selection, acceptance gate, boot loader overlay, optional module preflight)
- `js/shared/` — dependency-light utilities shared by boot + game
- `js/game/engine/` — engine entry + engine-only helpers (perf, storage diagnostics)
- `js/game/combat/` — combat runtime helpers (post-turn sequencing, ability effects)
- `js/game/data/` — large data tables (abilities, talents, etc.) separated from engine orchestration
- `js/game/systems/` — core gameplay systems (time, RNG, loot, safety, validation, etc.)
- `js/game/systems/enemy/` — enemy builder/rarity/affix pipeline
- `js/game/locations/village/` — village modules (bank, merchant, tavern, town hall, economy, population)
- `js/game/quests/` — quest definitions + progression pipeline
- `js/game/changelog/` — in-game changelog data
- `assets/audio/` — audio assets

## How to play (game loop)

1. **Create a hero** (name, class, difficulty).
2. Start in **Emberwood Village**. Typical day:
   - **Merchant**: buy/sell, prices respond to the economy
   - **Bank**: deposit/withdraw, loans, investment behavior and periodic interest rules
   - **Town Hall**: petitions & decrees that temporarily affect rates/costs
   - **Tavern**: rest (advances time) + gambling mini‑games
3. **Explore** into nearby zones to trigger encounters, earn loot, and progress quests.
4. **Resting** is the main “world tick”:
   - advances the in‑game day / day‑part
   - runs daily simulation hooks (economy, government, population, merchant)
   - expires decrees and updates timing-dependent systems

Progress is saved locally on this device/browser.

---

## Core systems overview

### Combat
- Turn‑based battles (player vs enemy AI).
- Enemies can have **templates** that define stats, moves, and behaviors.
- Critical hit behavior includes:
  - normal crit flow
  - QA toggles (always crit / never crit) for balance testing
- “God Mode” and other dev toggles exist strictly for testing.

### Classes, resources, and spell systems
- Classes define a hero’s identity and (where applicable) resource system.
- Spellcasting support is class-aware (only eligible classes should see spell UI).
- The engine includes safety guards to prevent NaN/Infinity cascades from corrupting runs.

### Loot and economy pressure
- Loot generation produces items with varying power/rarity.
- Merchant prices can react to economy drift and events.
- Sell value/spread logic is centralized so changes propagate consistently.

### Time and daily ticks
Time is tracked with:
- `dayIndex` (integer day count)
- `partIndex` / `part` (day-part state)

A centralized daily tick runner keeps **rest, explore, and other day advances** consistent and prevents “double tick” or “missed tick” bugs.

### Village simulation
The village loop is modeled as several stateful subsystems:
- **Economy** (tiers/summaries, derived costs like rest price and merchant price multipliers)
- **Population** (mood drift and summary)
- **Government / Town Hall** (petitions and time-limited decrees)
- **Merchant** (stock/restock hooks)

---

## Developer Cheats / QA menu

Developer cheats are intended for **testing only**.

### Enabling
Enable on the **Create Hero** screen via **“Enable developer cheats”**. When enabled, a **Cheat Menu** button becomes available in‑game for that character.

### What it’s for
- Reproducing issues quickly (teleport, force an enemy, grant items).
- Creating deterministic bug reports (seeded RNG, RNG logging).
- Sanity checks (smoke tests, state audit).
- Capturing **bug report JSON** bundles suitable for sharing.

### QA tools you’ll see
- Deterministic RNG toggle + seed set
- RNG logging toggle
- Smoke tests runner
- “Copy Bug Report (JSON)” bundle builder
- Spawn & Teleport utilities
- Simulation/time fast-forward (runs daily ticks)

> Cheats modify the **active save immediately**.

---

## Saving, schema, and persistence

### Storage
- Saves are stored in `localStorage` under versioned keys.
- Storage is wrapped with “safe” helpers so private mode / quota failures don’t crash the game.

### State shape (high level)
The game uses a single top‑level `state` object. Common buckets include:
- `player`: stats, level, hp/resource, inventory, gear, class configuration
- `time`: day index + day part
- `flags`: debug/progression toggles (dev cheats, god mode, crit mode, etc.)
- `quests`: quest state + flags/bindings
- `village`: economy + population state
- `government`: town hall / decree state
- `bank`: deposits/loans/investment timers
- `log`: structured log entries and filters
- `ui`: modal state and UI routing helpers

### Troubleshooting saves
If saves don’t persist:
- Browser storage may be blocked (private mode / iOS limitations).
- Quota may be exceeded.
- The game will attempt to log a warning and preserve a breadcrumb for debugging.

---

## Project structure

```
/
├─ index.html
├─ bootstrap.js
├─ userAcceptance.js
├─ style.css


### Key entry points
- **`index.html`**: UI shell + modal host.
- **`bootstrap.js`**: version selector/label + module bootstrapping.
- **`js/game/engine/engine.js`**: main game orchestration (state, UI wiring, combat, saves, cheat menu).
- **Systems modules**: pure-ish logic for time, RNG, validation, loot, government.
- **Village modules**: simulation + modal UI implementations.

---

## Adding content (practical guide)

### Enemies
Enemy behavior is driven by templates (commonly exposed as `ENEMY_TEMPLATES`).
Typical workflow:
1. Add/modify a template definition.
2. Use the Cheat Menu → **Spawn & Teleport** → **Start Battle** with the `templateId`.
3. Iterate on stats/behavior until it feels right.

### Items
Items are driven by item definitions (commonly exposed as `ITEM_DEFS`).
Typical workflow:
1. Add a new item id + properties.
2. Use Cheat Menu → **Give Item** to grant the item by id.
3. Confirm:
   - inventory display
   - equip/sell behavior
   - loot generator interaction (if applicable)

### Quests
Quests are defined in `js/game/quests/`:
- definitions (`questDefs.js`)
- default state/flags (`questDefaults.js`)
- bindings/side effects (`questBindings.js`)

Add a quest by:
1. Defining it in `questDefs.js`
2. Providing default state and flags
3. Binding triggers to world actions (explore, battles, visiting locations, etc.)

---

## Debugging and diagnostics

### Reproducible bug reports (best practice)
1. Enable **Deterministic RNG**
2. Set a known **Seed**
3. Reproduce the issue
4. Use **Copy Bug Report (JSON)** and attach the result to an issue report

### State validation
The project includes a state validation/assertion system used by smoke tests and diagnostics. It’s intended to catch:
- missing fields in old saves
- invalid ranges (negative HP, NaN resource)
- inventory inconsistencies

---

## UI notes (PC vs mobile)

- The UI is designed to work on both desktop and mobile.
- On mobile Safari, ES module loading and `localStorage` reliability can vary if running from `file://`.
  If you’re testing on iPhone/iPad, serving via a local server (or hosting) is strongly recommended.

---

## Roadmap ideas
- More village locations (blacksmith, temple, barracks)
- Seasonal events / festivals
- Crafting + scarcity pressure on merchant stock
- Deeper companion progression (unique passives, affinity)
- More enemy factions tied to town security/prosperity
- Expanded diagnostics and automated regression checks

---

## Credits
Built by the repository author(s).

If you add third‑party assets (fonts, icons, music, SFX), list sources and licenses here.

---

## License
Add a `LICENSE` file that matches your intent:
- MIT (permissive)
- GPLv3 (copyleft)
- Proprietary (private projects)
