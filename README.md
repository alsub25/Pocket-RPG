# Emberwood: The Blackbark Oath

A single‑page, browser RPG + village simulation where **daily decisions** (resting, shopping, banking, local politics, and tavern games) ripple through a living settlement — and where combat, loot, and quests feed back into that world loop.

> **Current patch:** v1.2.72 — *The Blackbark Oath — Locus Wiring: Events, Input & Autosave*  
> **In‑game changelog:** open **Changelog** from the main menu.

This repository is intentionally **no-build** and **static-host friendly**:

- Runs entirely in the browser (no backend).
- Uses **native ES modules** (no bundler required).
- Saves persist via `localStorage` (single-player, device-local).
- Includes **Developer Cheats / QA tools** (Smoke Tests, Scenario Runner, Bug Report bundle) intended for testing and balancing.

---

## Table of contents

- [Quick start](#quick-start)
- [Deploy to GitHub Pages](#deploy-to-github-pages)
- [Project layout](#project-layout)
- [Architecture overview](#architecture-overview)
- [Gameplay systems](#gameplay-systems)
  - [State model & save schema](#state-model--save-schema)
  - [Time system & daily ticks](#time-system--daily-ticks)
  - [RNG & determinism](#rng--determinism)
  - [Combat](#combat)
  - [Abilities & effects](#abilities--effects)
  - [Status effects & synergies](#status-effects--synergies)
  - [Elements, affinities & resistances](#elements-affinities--resistances)
  - [Classes, resources & progression](#classes-resources--progression)
  - [Talents](#talents)
  - [Items, inventory & equipment](#items-inventory--equipment)
  - [Loot generation](#loot-generation)
  - [Enemies, rarity & affixes](#enemies-rarity--affixes)
  - [Quests](#quests)
  - [Village simulation](#village-simulation)
  - [Logging & UI](#logging--ui)
  - [Diagnostics & QA tools](#diagnostics--qa-tools)
- [Adding content](#adding-content)
- [Testing & debugging](#testing--debugging)
- [Contributing guidelines](#contributing-guidelines)
- [Versioning & releases](#versioning--releases)
- [License](#license)

---

## Quick start

### Run locally

Because Emberwood uses ES modules, you should run it from a local web server.

#### Python

```bash
python -m http.server 8000
```

#### Node

```bash
npx serve .
```

Open `http://localhost:8000`.

### iOS / `file://` note

The project includes extra guards for iOS Safari, but **serving from HTTP is still recommended**.
Loading modules from `file://` can be inconsistent and can surface stricter module semantics.

---

## Deploy to GitHub Pages

Emberwood is a static site. GitHub Pages works well.

### Option A: Deploy from the repo root

1. In GitHub: **Settings → Pages**
2. **Build and deployment → Source:** “Deploy from a branch”
3. Select branch (e.g. `main`) and folder `/ (root)`
4. Save

### Option B: Deploy from `/docs`

If you prefer keeping source separate from the site output:

1. Move `index.html`, `style.css`, `assets/`, `js/` into `/docs`
2. GitHub: **Settings → Pages → Source:** `main` + `/docs`

### Pathing

All scripts/styles use **relative paths**, so Pages works whether deployed at the root domain or under a repository subpath.

---

## Project layout

Top level:

```
Emberwood_patch_1.2.72_core_systems/
  index.html
  style.css
  assets/
  js/
  README.md
```

JavaScript modules:

- `js/boot/` — early boot scripts
  - `bootstrap.js` — boot sequencing + optional preflight checks
  - `bootLoader.js` — boot overlay + timing
  - `userAcceptance.js` — acceptance gate / user prompt logic
  - `lib/safeStorage.js` — minimal boot-safe storage wrapper

- `js/shared/` — dependency-light utilities shared by boot + game
  - `storage/safeStorage.js`

- `js/engine/` — proprietary engine core + platform helpers
  - `engine.js` — Engine Core (state/events/services + plugin lifecycle)
  - `perf.js` — performance capture helpers
  - `storageRuntime.js` — runtime storage diagnostics / safe wrappers

- `js/game/` — Emberwood game code (content + orchestration)
  - `main.js` — game entry (creates engine + boots orchestrator, then engine.start())
  - `runtime/`
    - `gameOrchestrator.js` — game-specific orchestration (wires UI, saves, systems)
  - `plugins/` — engine plugins (UI runtime, diagnostics overlay, combat runtime, companion runtime)
  - `persistence/`
    - `saveManager.js` — save/load + migrations + save-slot helpers
  - `ui/`
    - `runtime/` — screen switching, modal runtime, log renderer helpers + DOM bindings
    - `devtools/diagnosticsUI.js` — Smoke Tests modal UI + dev pill visibility
    - `spells/spellbookModal.js` — Spell Book modal builder
  - `utils/itemCloner.js` — JSON-safe deep clone helper
  - `data/` — large data tables (`abilities.js`, `items.js`, `talents.js`, etc.)
  - `combat/` — combat math + runtime helpers
  - `systems/` — core systems (time, RNG, loot, government, safety, enemies)
  - `locations/` — location modules (village, etc.)
  - `quests/` — quest system
  - `changelog/` — in-game changelog data
  - `state/` — initial state factory
  - `qa/` — QA helpers

---

## Architecture overview

Emberwood is designed around a single **authoritative game state object** plus a set of systems that read/update it.

### Boot sequence

1. `js/boot/bootstrap.js` runs first.
2. A boot overlay is shown and basic diagnostics are captured.
3. If required, user acceptance is handled (`userAcceptance.js`).
4. The game entry (`js/game/main.js`) is imported.

### Engine orchestration

- `js/engine/engine.js` is the proprietary **Engine Core** (state/events/services + plugins).
  - Built-in engine services: clock + scheduler, command bus, snapshot save/load + migration registry, structured logging + event trace, RNG streams, perf watchdog, input router, UI router, asset registry, error boundary crash reports, and a headless harness.
- `js/game/runtime/gameOrchestrator.js` is the game-specific orchestrator.

`gameOrchestrator.js` coordinates:

- Building/initializing state
- Calling **saveManager** for load/save/migrate
- Wiring UI via `uiRuntime` + `uiBindings`
- Delegating to systems (time, RNG, loot, quests, village)
- Delegating to combat modules during fights

Key refactors (ongoing through 1.2.72):

- **Save/migrations** extracted to `saveManager.js`
- **UI runtime + bindings** extracted to `ui/runtime/uiRuntime.js` / `ui/runtime/uiBindings.js`
- **Diagnostics/QA UI** extracted to `devtools/diagnosticsUI.js`

These extractions reduce circular imports and avoid iOS `file://` pitfalls (temporal dead zones, read‑only imported bindings).

---

## Gameplay systems

### State model & save schema

The game uses one top-level `state` object. The save payload is a normalized subset of runtime state (plus metadata).

Common state buckets:

- `player`: stats, level, HP/resource, inventory, equipment, class config
- `time`: day index + day part
- `combat`: current encounter runtime (only present when in combat)
- `quests`: quest progression data
- `village`: economy + population state
- `government`: decrees/petitions/king state
- `bank`: deposits/loans/interest timing
- `flags`: toggles (dev cheats, deterministic RNG, debug modes)
- `log`: structured log entries + filters
- `ui`: current screen, modal state, UI toggles

Persistence:

- Stored in `localStorage` using safe wrappers (private mode / quota failures are guarded).
- Multiple save slots are supported through an index + per-slot blob keys.

Migration:

- `saveManager.js` applies ordered migrations when loading.
- Migrations normalize missing/older fields and keep forward-compat safety (unknown keys are tolerated).

### Time system & daily ticks

`timeSystem.js` tracks time as **day index** + **day part**.

- `normalizeTime()` clamps time into valid ranges.
- `advanceTime()` advances day-part and wraps to the next day as needed.

Daily ticks:

When time advances in ways that represent a “world tick” (resting, end-of-day), the engine runs a deterministic daily pipeline:

- Economy adjustments
- Merchant restock + pruning
- Decree expiration / effects
- Bank interest timing
- Population mood drift

There is an idempotence guard to prevent “double tick” bugs.

### RNG & determinism

`rng.js` supports:

- Normal RNG (non-deterministic)
- Deterministic RNG for reproducing bugs
- Optional RNG logging (capped)

This is used across loot rolls, enemy generation, and combat variance.

### Combat

Combat is turn-based and supports single-enemy and multi-enemy battles.

Core components:

- `combat/math.js`: damage/heal computations, crit, mitigation
- `combat/statusEngine.js`: status application and ticking
- `combat/abilityEffects.js`: ability implementations (damage, heal, buffs)
- `combat/postTurnSequence.js`: end-of-turn cleanup, status expiry, intent ticking

Key mechanics:

- **Enemy intent**: enemies can “wind up” actions that execute after a countdown.
- **Interrupt**: player can interrupt certain intents (resource cost + posture interaction).
- **Posture**: posture break disrupts enemy intent.
- **AoE**: group abilities apply to all enemies and now correctly resolve multi-enemy defeats.

Safety:

- Damage/heal values are clamped and validated to prevent NaN/Infinity cascades.
- Combat runtime fields are repaired/initialized during load for forward compatibility.

### Abilities & effects

Abilities are defined in `js/game/data/abilities.js` and implemented in `combat/abilityEffects.js`.

Each ability specifies:

- Cost (resource)
- Targeting (self, enemy, group)
- Classification (physical or elemental)
- Effect pipeline (damage/heal + status application)

Effects are kept separate from UI so they can be tested deterministically.

### Status effects & synergies

Status effects are handled by `statusEngine.js`.

Typical status fields:

- `duration` (turns)
- `stacks` or magnitude (where applicable)
- Optional per-turn tick behavior

Synergies (examples):

- Bleed + Fire can ignite (Burning)
- Chilled + Physical can Shatter and consume Chill

### Elements, affinities & resistances

Damage classification:

- Physical or elemental
- Elemental types normalized via helpers to avoid mismatched keys

Enemies:

- Can have affinity multipliers (weakness/resistance)
- Can have flat resist percentages

Players:

- Can gain elemental bonuses/resists from gear and talents
- Elemental resist reduces incoming elemental damage

The combat math stacks affinity and resist effects multiplicatively and avoids printing misleading “0% resist” breakdown lines.

### Classes, resources & progression

Classes define:

- Base stats and growth
- Resource type (e.g., mana)
- Unlock tables (abilities/spells at specific levels)

Progression systems:

- Leveling grants skill points and talent points.
- Cheats can grant max level and auto-distribute skill points (testing).

### Talents

Talents are defined in `js/game/data/talents.js`.

Talents can:

- Modify derived stats immediately
- Add elemental bonuses/resists
- Change combat thresholds (e.g., rhythm mechanics)
- Add conditional passives

Talent changes are applied via stat recomputation to ensure idempotence.

### Items, inventory & equipment

Items are defined in `js/game/data/items.js`.

Inventory rules:

- Stackable items (e.g., potions) normalize to a `quantity` integer.
- Equipment does **not** stack; each piece is an instance.
- Equip/unequip updates derived stats and guards against double-application.
- Selling equipped gear clears the slot and uses centralized `getSellValue`.

Traits:

- Equipment can carry traits that trigger on-hit, on-kill, etc.

### Loot generation

`lootGenerator.js` creates items with:

- Weighted rarity rolls
- Deterministic results under seeded RNG
- Safety guarantees (finite stats, normalized elements)

Loot stress tests ensure the generator remains stable under large batches.

### Enemies, rarity & affixes

Enemy creation is pipeline-driven in `systems/enemy/`:

- `rarity.js`: rarity selection & reward scaling
- `elite.js`: elite/boss rules
- `affixes.js`: affix selection and behavior flags
- `builder.js`: builds a runtime enemy instance from a template
- `display.js`: naming and presentation helpers

Enemies can have:

- Elemental affinities/resists
- Affixes (thorns, vampiric, regenerating, frozen, etc.)
- Difficulty-scaled stats

### Quests

The quest system is split across:

- `questDefs.js`: quest definitions (steps, requirements)
- `questDefaults.js`: default state and flags
- `questBindings.js`: side effects and trigger wiring
- `questTriggerRegistry.js`: registry of trigger types
- `questSystem.js`: lifecycle helpers (init/start/advance/complete)

Design goal: keep quests data-driven, with bindings used only for world integration.

### Village simulation

Village modules live in `js/game/locations/village/`.

Core sub-systems:

- **Merchant (`merchant.js`)**: stock, buy/sell, restock guards, price behavior
- **Economy (`villageEconomy.js`)**: derived multipliers and cost models
- **Population (`villagePopulation.js`)**: mood drift and summaries
- **Bank (`bank.js`)**: deposits/withdrawals, loans, weekly interest timing
- **Town Hall (`townHall.js`)**: petitions and time-limited decrees
- **Tavern (`tavern.js`, `tavernGames.js`)**: resting and gambling mini-games

These are invoked through location UI and through daily tick hooks.

### Logging & UI

UI is separated into runtime vs bindings:

- `uiRuntime.js`:
  - `switchScreen()` with missing-DOM guards
  - modal runtime (open/close, focus trap)
  - log helpers + rendering
  - breakdown formatting helpers used by combat logs

- `uiBindings.js`:
  - Menu buttons (New/Load/Settings)
  - HUD gestures (tap/swipe)
  - Log filter chips (pills)
  - Modal dismissal / close wiring

Log entries are structured with a `type` (system/good/danger) and optional metadata (combat breakdowns, procs, etc.).

### Diagnostics & QA tools

Developer tools are intended for testing and balance work.

- Enable cheats during character creation.
- When enabled, HUD pills appear for:
  - **Cheat Menu**
  - **Smoke Tests & Bug Report**

`devtools/diagnosticsUI.js` owns the Diagnostics modal UI and pill visibility.

Tools included:

- **Smoke Tests**: isolated in-memory QA suite (does not modify the active save)
- **Scenario Runner**: simulates multiple days and loot generation to catch regressions
- **Bug Report Bundle**: exports a JSON bundle (state snapshot + perf + recent log)
- **Perf Snapshot**: boot/FPS summary for profiling
- **Live Save Audit**: checks invariants on the current save

Implementation note (important for iOS Safari):

- QA uses adapters/hooks instead of reassigning imported ES-module bindings, because imported bindings are read-only.

---

## Adding content

### Add an enemy

1. Find the enemy template table (commonly in engine or enemy builder inputs).
2. Add a new template ID and base stats/move list.
3. Use Cheat Menu → spawn/start battle by `templateId`.
4. Iterate until the encounter feels right.

### Add an item

1. Add an entry in `js/game/data/items.js`.
2. Confirm:
   - Inventory display
   - Equip rules (if equipment)
   - Sell value
   - Loot generator behavior
3. Use Cheat Menu to grant by item ID for fast iteration.

### Add an ability

1. Add the ability definition in `js/game/data/abilities.js`.
2. Implement its logic in `js/game/combat/abilityEffects.js`.
3. Add unlock rules for a class if needed.
4. Run Smoke Tests (abilities classification checks will fail fast if misconfigured).

### Add a talent

1. Add the talent in `js/game/data/talents.js`.
2. Ensure it updates derived stats through the stat recompute pipeline.
3. Run Smoke Tests (talent integrity + summary checks will catch many mistakes).

### Add a quest

1. Define in `js/game/quests/questDefs.js`.
2. Add default state in `questDefaults.js`.
3. Bind triggers in `questBindings.js` using the trigger registry.
4. Verify lifecycle with Smoke Tests (quest init/start/advance/complete).

---

## Testing & debugging

### Smoke Tests

Open **Smoke Tests & Bug Report** and click **Run**.

- The suite swaps game state in-memory so it won’t corrupt your save.
- Mobile runs may default to a “quick mode” to keep runtime low.
- Full mode is available for deeper runs.

### Scenario Runner

Use **Scenario** to simulate multiple days and loot batches. This catches:

- Daily tick idempotence bugs
- Economy drift issues
- Loot generator invalid outputs

### Bug reports

Use **Copy JSON** to export a bundle containing:

- Patch label + save schema
- UA/locale
- State snapshot
- Recent input log tail
- Recent game log tail
- Perf snapshot

For reproducible reports:

1. Enable deterministic RNG
2. Set a seed
3. Reproduce
4. Copy JSON and attach to a GitHub issue

---

## Contributing guidelines

### Design goals

- Keep systems small and single-purpose.
- Prefer **pure logic modules** (no DOM) for core mechanics.
- Use UI adapters/hooks rather than importing gameplay code into UI modules.

### iOS / ES module pitfalls to avoid

- **Temporal dead zones**: avoid referencing late-bound functions during module evaluation.
- **Read-only imports**: never assign to an imported binding; use adapters.
- Keep boot + version modules dependency-light.

### Style

- Keep helpers dependency-light.
- Avoid cross-layer imports (systems → UI).
- Add changelog entries for behavior changes and major refactors.

---

## Versioning & releases

### Patch label

The build label lives in `js/game/systems/version.js`:

- `GAME_PATCH`
- `GAME_PATCH_NAME`
- `GAME_FULL_LABEL`

### In-game changelog

Changelog entries live in `js/game/changelog/changelog.js`.

### Save schema

The smoke tests print the current **save schema**. When changing save structure:

- Add/adjust migrations in `saveManager.js`.
- Keep migrations tolerant of unknown keys for forward compatibility.

---

## License

Add a `LICENSE` file that matches your intent (MIT/GPL/Proprietary). If you add third‑party assets, list sources and licenses in this README.
