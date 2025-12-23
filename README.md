# Pocket Quest

A single‑page, browser-based RPG + village sim where your **daily choices** (resting, shopping, banking, town politics, and even tavern gambling) ripple through a living settlement.

> Current patch: **v0.6.0** (see in-game Changelog modal / `changelog.js`)

---

## Table of Contents

- [What is Pocket Quest?](#what-is-pocket-quest)
- [Features](#features)
- [Quick Start](#quick-start)
- [How to Play](#how-to-play)
- [Core Systems](#core-systems)
  - [Time & Calendar](#time--calendar)
  - [Village Economy](#village-economy)
  - [Population & Mood](#population--mood)
  - [Town Hall: Petitions & Decrees](#town-hall-petitions--decrees)
  - [Emberwood Bank](#emberwood-bank)
  - [Merchants](#merchants)
  - [Tavern & Gambling](#tavern--gambling)
  - [Dynamic Difficulty](#dynamic-difficulty)
- [Project Structure](#project-structure)
- [State Model](#state-model)
- [Saving & Loading](#saving--loading)
- [Development](#development)
- [Roadmap Ideas](#roadmap-ideas)
- [Credits](#credits)
- [License](#license)

---

## What is Pocket Quest?

**Pocket Quest** is a lightweight RPG built in plain JavaScript (ES modules) designed to feel like a “mini campaign” you can pick up and play in short sessions.

It blends:
- **Turn-based battles** (with a classic “boss ladder” feel)
- **Town progression** (economy, population mood, and government policy)
- **Player-driven simulation** (resting and spending can strengthen or destabilize Emberwood)

---

## Features

### Gameplay
- **Exploration loop** spanning Emberwood Village, the Emerald Forest, and deeper ruins.
- **Boss progression** (multiple major encounters that gate story steps).
- **Companion support** (one active companion / HUD view toggle).
- **Class system** including a **Vampire** archetype (Essence Drain, Bat Swarm, Shadow Veil, etc.).

### World Simulation
- **Time system** with day parts and a fantasy calendar.
- **Village economy** that shifts day-to-day (tiers, prosperity/trade/security drift, price descriptors).
- **Population system** tracking settlement size and villager mood.
- **Town Hall** petition system that can enact **temporary multipliers** affecting bank rates and rest costs.

### Town Interaction
- **Emberwood Bank**: deposit, withdraw, loans, investments; rates react to the world.
- **Merchants**: buy/sell pricing tied to economy; purchases can push the economy.
- **Emberwood Tavern**: rest to advance time; gambling mini-games.

### Quality-of-life
- In-game **Changelog** viewer (`CHANGELOG` data + modal).
- UI log system with **filter chips** (combat/system/village/etc).
- Multi-slot saves with a Save Manager UI.

---

## Quick Start

This project uses **native ES modules**, so you’ll want to run it from a local web server (opening HTML from disk may block imports depending on browser).

### Option A: Python
```bash
python -m http.server 8000
```

### Option B: Node
```bash
npx serve .
```

Then open:
- `http://localhost:8000`

> If your repo has an `index.html`, it should load `game.js` as a module.

---

## How to Play

1. **Start in Emberwood Village**: check your stats, the quest box, and the event log.
2. **Prepare**:
   - Buy supplies from the **Merchant**
   - Visit the **Bank** to invest or take a loan
   - Check the **Town Hall** for petitions/decrees that change costs/rates
3. **Explore** into danger zones to trigger battles and progress quests.
4. **Rest at the Tavern** to advance the day — this is when the simulation ticks:
   - economy updates
   - population mood drifts
   - petition/decree timers advance

---

## Core Systems

### Time & Calendar

The world tracks:
- **Day parts** (morning/afternoon/evening style segmentation)
- A fantasy weekday list
- A rolling **year/day index**

Most systems advance on **“jump to next morning”** events (commonly triggered by resting).

---

### Village Economy

The village economy is modeled with three key axes:
- **Prosperity**
- **Trade**
- **Security**

Each day tick applies:
- gentle **drift** toward a baseline
- small random changes (bounded)
- a **tier evaluation** that influences “price descriptor” output used by shops and services

Economy tiers help create a readable player experience like:
- “Struggling / Stable / Thriving”
- “Prices are steep / fair / cheap”
- etc.

---

### Population & Mood

Population sim is intentionally lightweight:
- tracks **population size**
- tracks **villager mood**
- drifts mood daily (with caps) so your actions have *slow-burn* impact

Mood is surfaced in town summaries and can be referenced by future events/quests.

---

### Town Hall: Petitions & Decrees

The Town Hall provides a political layer:
- You can sponsor or vote on **petitions**
- Successful petitions apply short-lived **multipliers** stored in `government.townHallEffects`

Examples of what policy can influence:
- Rest cost multiplier (tavern)
- Deposit / loan / investment rate multipliers (bank)

Policies naturally **expire after N days**, so the system encourages revisiting.

---

### Emberwood Bank

The bank supports common financial actions:
- **Deposit / withdraw**
- **Invest**
- **Loans**
- **Interest and rate calculation** influenced by economy + town policy

A weekly-style interest accrual prevents constant micro-optimizing, while still rewarding planning.

---

### Merchants

Merchants are economy-aware:
- Pricing reflects the current **price descriptor** and economy multipliers.
- Purchases can nudge the economy (supply/demand flavor) to keep the town feeling reactive.

---

### Tavern & Gambling

The Tavern is the primary **day-advance** hub:
- Resting advances time and triggers system ticks.
- Gambling mini-games are available and include a developer tuning mode (`gamblingDebug`) to make house odds normal / player-favored / house-favored.

---

### Dynamic Difficulty

Pocket Quest includes a “rubber band” difficulty system:
- tracks recent battle outcomes
- gradually adjusts encounter tuning to keep progression moving

Difficulty presets are defined in `game.js` (`DIFFICULTY_PRESETS`) and can be expanded with new styles.

---

## Project Structure

Typical repo layout (based on module imports):

```
/
├─ index.html
├─ game.js
├─ Changelog/
│  └─ changelog.js
├─ Systems/
│  └─ timeSystem.js
└─ Locations/
   └─ Village/
      ├─ villageEconomy.js
      ├─ villagePopulation.js
      ├─ townHall.js
      ├─ bank.js
      ├─ merchant.js
      ├─ tavern.js
      └─ tavernGames.js
```

### Key entrypoints
- **`game.js`**: app bootstrap, UI wiring, state model, battle loop, quest progression, save manager
- **Village modules**: encapsulate simulation sub-systems + modal UIs
- **`timeSystem.js`**: canonical time math + “next morning” jump

---

## State Model

The global `state` object acts as a single source of truth. Key top-level buckets include:

- `player`: stats, inventory, equipped gear, class
- `quests`: main quest + side quest objects (step/status)
- `flags`: boolean gates (met elder, bosses defeated, dev cheats, etc.)
- `time`: world clock (day, part, weekday)
- `villageEconomy`: prosperity/trade/security + tier info
- `government`: Town Hall effects + tracking
- `bank`: account balances, last interest day, etc.
- `log`: structured log entries and UI filter state
- `saveSlots`: metadata index for save manager

Because everything is in one tree, adding new systems is usually:  
**(1)** extend state, **(2)** add a day-tick hook, **(3)** surface it in a modal/summary UI.

---

## Saving & Loading

Saves are stored in **localStorage** using versioned keys (v1 prefix), and managed through an in-game Save Manager:

- A **save index** tracks slot metadata.
- Each slot stores serialized state.

This makes the game easy to host as a static site while still supporting persistence.

---

## Development

### Recommended workflow
- Run a local web server (see [Quick Start](#quick-start))
- Use browser dev tools:
  - `console.log(state)` is your best friend
  - toggle `state.flags.devCheatsEnabled` if you want to expose dev-only tools (if wired in UI)

### Extending the game
Some high-leverage extension points:
- Add new **Town Hall petition types** in `townHall.js`
- Add new **economy tiers** and descriptors in `villageEconomy.js`
- Add new **merchant stock** and pricing rules in `merchant.js`
- Add new **tavern games** in `tavernGames.js`
- Add new **time events** (weekly taxes, festivals, etc.) in `timeSystem.js`

---

## Roadmap Ideas

If you want to keep building:
- Seasonal events and weekly “market days”
- Reputation system tied to population mood
- More companions with unique passives
- Crafting + economy-driven item scarcity
- New village locations (blacksmith, temple, barracks)
- Random encounters influenced by security/prosperity

---

## Credits

Built by the repo author(s).  
If you use third‑party assets (icons, fonts, etc.), add them here.

---

## License

Choose a license:
- MIT (simple and permissive)
- GPLv3 (strong copyleft)
- Proprietary (private projects)

Add the appropriate `LICENSE` file to the repo root.
