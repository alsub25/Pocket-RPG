// changelog.js
// ES6 module: structured changelog data for Emberwood: The Blackbark Oath

export const CHANGELOG = [
  {
    "version": "1.2.80",
    "title": "The Blackbark Oath — Engine Integration: Single-Load Boot, Snapshot Schema Migration, Modal Escape & Motion A11y",
    "sections": [
      {
        "heading": "Engine integration fixes",
        "items": [
          {
            "title": "Asset preloads: screen/area wiring now matches the live UI",
            "bullets": [
              "Fixed a mismatch where the asset manifest defined screen groups for 'village'/'forest', but the UI runtime only ever enters screens: mainMenu, character, game, settings.",
              "Added missing screen groups (screen:character, screen:game, screen:settings) and introduced area groups (area:<id>) for ambience that changes inside the single 'game' screen.",
              "Updated ew.screenAssetPreload to also listen for area:enter events so area ambience can preload the same way screens and modals do."
            ]
          },
          {
            "title": "Area lifecycle events (so plugins can react consistently)",
            "bullets": [
              "Added a setArea() helper in the orchestrator that emits area:leave / area:enter engine events and also forwards a world:areaEntered event when the world event bus is present.",
              "Updated travel + teleport + story-jump placement to use setArea() so the engine can observe area changes for preloads/analytics and ownership cleanup.",
              "Boot now schedules an initial area:enter emission (owner: system:boot) so loaded saves trigger area-aware plugins immediately after engine.start()."
            ]
          },
          {
            "title": "Enemy Sheet modal now participates in engine modal lifecycle",
            "bullets": [
              "Enemy Sheet (enemyModal) now emits modal:open / modal:close with a dedicated owner namespace, so input contexts and preload plugins can treat it like other modals.",
              "Added owner-based schedule/tween cleanup for the Enemy Sheet to prevent UI effects from leaking across Enemy Sheet re-opens.",
              "Registered a modal:enemySheet asset group in the manifest to support future Enemy Sheet-specific assets.",
              "Escape behavior: pressing Esc/Back now closes the Enemy Sheet before opening the Pause menu (consistent with other modals)."
            ]
          },
          {
            "title": "Save robustness: Engine snapshots now migrate by schema (no more patch-version brittleness)",
            "bullets": [
              "Load now validates Engine snapshot checksums before applying state, catching corrupted envelopes early.",
              "Snapshot loads now route snapshot.state through the same SAVE_SCHEMA migration pipeline as legacy saves (engine snapshots no longer skip migrations).",
              "Added engine.validateSave() so future systems can validate snapshots without mutating live state."
            ]
          },
          {
            "title": "Quality-of-life: silent autosave + reduced-motion compliance",
            "bullets": [
              "Autosave is now fully silent by default (no 'Saving…'/'Saved.' popups); it simply saves in the background.",
              "Reduced motion: toast animations and log panel height transitions now respect the no-motion setting (instant state changes, no tweens).",
              "UI runtime music helpers now prefer the engine audio service when present (removes hidden coupling to orchestration wiring)."
            ]
          },
          {
            "title": "SavePolicy adoption: quest + companion systems",
            "bullets": [
              "Quest bindings now call requestSave('quests') instead of calling the raw saveGame() writer, allowing savePolicy to coalesce and respect safe points.",
              "Companion runtime now receives a requestSave-backed save hook so companion grant/dismiss and other companion-driven state changes integrate with savePolicy."
            ]
          },
          {
            "title": "Gameplay actions now route through engine.commands (replay/telemetry-friendly)",
            "bullets": [
              "Expanded command-bus coverage beyond the explore/action bar so core gameplay mutations can be captured deterministically.",
              "Inventory: Use Potion, Equip, Unequip, Sell, and Drop now dispatch commands first (with safe fallbacks when the engine is unavailable).",
              "Spell Book: casting an ability in combat now dispatches COMBAT_CAST_ABILITY so replays can reproduce spell usage.",
              "Merchants: Buy actions now dispatch SHOP_BUY and are executed by a centralized handler that updates gold, stock buckets, and economy effects.",
              "Banking: Deposit, Withdraw, Invest, Cash Out, Borrow, and Repay now dispatch BANK_* commands for consistent logging and replay.",
              "Fixed inventory equip highlighting for duplicate items: only the equipped instance is marked as equipped (no more ‘both copies equipped’ confusion)."
            ]
          },
          {
            "title": "QA tools are now engine-wide (Smoke Tests, Bug Report, Scenario Runner)",
            "bullets": [
              "Introduced a new engine QA service (engine.qa) as the single integration point for Smoke Tests, Bug Report bundling, audits, and scenarios.",
              "Added ew.qaBridge to register Emberwood QA suites into engine.qa so devtools can run without importing orchestrator functions directly.",
              "Diagnostics overlay now pulls QA runners/formatters from engine.qa (callers can still override via deps), making QA features engine-wide.",
              "Bug Report bundles now automatically include engine instrumentation tails (event trace, command log, perf scopes, UI router stack, replay meta/tape, telemetry tail)."
            ]
          },
          {
            "title": "UI polish: main-menu Settings controls no longer clip on mobile",
            "bullets": [
              "Added mobile-safe right padding inside the main-menu Settings scroll container so slider/toggle thumbs (and their shadows) don’t get cut off at the edge.",
              "Hid the visible scrollbar/scroll indicator for the main-menu Settings list while keeping touch scrolling.",
              "Restored the Text size selector on the main-menu Settings screen and wired it to engine settings (a11y.textScale).",
              "In-game Settings modal now also includes Text size and High contrast controls, both wired to the same engine-wide accessibility settings so the two menus stay in sync."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.72",
    "title": "The Blackbark Oath — Locus Wiring: Commands, Screen Preloads & Save Transactions",
    "sections": [
      {
        "heading": "Maintenance",
        "items": [
          {
            "title": "Version label bump",
            "bullets": [
              "Updated GAME_PATCH to 1.2.72 and refreshed the patch name used by HUD labels and bug-report exports.",
              "Updated the engine header banner to match the new patch label."
            ]
          },
          {
            "title": "Architecture: proprietary Engine Core split",
            "bullets": [
              "js/engine/engine.js is now the proprietary Engine Core (state + event bus + service registry), and contains no game rules/content.",
              "Moved the game-specific runtime wiring into js/game/runtime/gameOrchestrator.js.",
              "Added a new entry module js/game/main.js so bootstrap loads a stable game entry while the Engine Core remains reusable.",
              "Boot now loads js/game/main.js (instead of importing the orchestrator directly), keeping the boot contract stable as refactors continue."
            ]
          },
          {
            "title": "Folder structure cleanup",
            "bullets": [
              "Promoted the proprietary Engine Core to js/engine/engine.js (engine-only surface area).",
              "Moved platform helpers to js/engine/* (perf.js, storageRuntime.js) and game persistence to js/game/persistence/saveManager.js.",
              "Moved game UI modules into js/game/ui/* (runtime, devtools, spells) and utility helpers into js/game/utils/.",
              "Renamed the entry module to js/game/main.js and updated boot wiring + import paths throughout."
            ]
          },
          {
            "title": "Engine Core: plugin lifecycle + dependency graph",
            "bullets": [
              "Expanded js/engine/engine.js with a real plugin manager supporting init/start/stop/dispose hooks.",
              "Plugins can declare requires/optionalRequires; the engine resolves a stable topological start order and detects cycles/missing deps.",
              "Added engine.start()/stop() and plugin inspection helpers (getPlugin/listPlugins/getPluginReport).",
              "Game boot now calls engine.start() after bootGame() so registered plugins can start automatically."
            ]
          },
          {
            "title": "Engine plugins: first runtime systems converted",
            "bullets": [
              "Converted UI runtime + DOM bindings into the ew.uiRuntime plugin (configureUI + initUIBindings now run via engine.start()).",
              "Converted the Diagnostics/QA overlay into the ew.diagnosticsOverlay plugin and registered it as the diagnostics service.",
              "Converted combat engines (CombatMath, StatusEngine, post-turn sequencer) into the ew.combatRuntime plugin; the orchestrator now binds these via engine services to avoid module-evaluation instantiation under file://.",
              "Converted the companion combat runtime into the ew.companionRuntime plugin; orchestrator prefers the service with a fallback for tests/older builds."
            ]
          },

          {
            "title": "Locus services: flags, i18n, uiCompose, savePolicy, replay, telemetry, assets, tween, settings & a11y",
            "bullets": [
              "Added a persistent feature-flag service (engine.flags) plus a small ew.flags plugin to define defaults and load stored overrides.",
              "Added engine.i18n for lightweight localization with an ew.i18n seed plugin (currently used for QA toasts/messages).",
              "Added engine.uiCompose (toast/busy/transition/HUD) and wired a DOM adapter via the ew.uiComposeBridge plugin.",
              "Added engine.savePolicy to centralize dirty-state saving (safe points + coalescing + retry) and connected it to saveGame() via ew.savePolicyBridge; autosave now prefers this path.",
              "Added engine.replay (records command dispatches + optional snapshots) with basic Replay controls in the Smoke Tests modal.",
              "Added engine.telemetry for breadcrumb capture and optional crash bundle persistence; bug-report bundles now include telemetry tail/flags/savePolicy/replay metadata.",
              "Added engine.assets manifest support (assets + groups + preload progress), and registered Emberwood's starter audio manifest via ew.assetsManifest.",
              "Added engine.tween, a clock-driven tween/animation service with owner-based cancellation (screen/modal-safe).",
              "Added engine.settings (persistent prefs) and engine.a11y (OS + user accessibility preferences), with ew.settings and ew.a11yBridge applying theme/reduced motion/text scale consistently.",
              "Settings screen: added a High contrast selector (Auto/On/Off) wired to engine.settings (a11y.highContrast)."
            ]
          },

          {
            "title": "Engine modularization: static data extraction",
            "bullets": [
              "Moved DIFFICULTY_CONFIG and MAX_PLAYER_LEVEL into js/game/data/difficulty.js.",
              "Moved PLAYER_CLASSES into js/game/data/playerClasses.js.",
              "Moved COMPANION_DEFS and COMPANION_ABILITIES into js/game/data/companions.js.",
              "Moved ENEMY_ABILITIES and ENEMY_ABILITY_SETS into js/game/data/enemyAbilities.js.",
              "gameOrchestrator.js now imports these authored data modules, shrinking the orchestration surface area and making future balance edits safer."
            ]
          },
          {
            "title": "Engine modularization: Spell Book modal extraction",
            "bullets": [
              "Extracted the Spell Book modal builder out of gameOrchestrator.js into js/game/ui/spells/spellbookModal.js.",
              "gameOrchestrator.js now keeps a thin, hoisted openSpellsModal() wrapper that lazy-initializes the modal via dependency injection (avoids circular imports and TDZ hazards).",
              "No gameplay behavior changes intended; this refactor keeps the orchestrator focused on orchestration."
            ]
          },
          {
            "title": "Engine modularization: Companion runtime extraction",
            "bullets": [
              "Moved companion scaling, ability execution, cooldown ticking, and the companion combat AI out of gameOrchestrator.js into js/game/combat/companionRuntime.js.",
              "gameOrchestrator.js now delegates to a lazily constructed companion runtime (dependency injected) so combat helpers stay testable without circular imports.",
              "Rewired stat recalculation to use the extracted scaling helper, preserving existing maxHP bonus behavior."
            ]
          },
          {
            "title": "Changelog UX: vertical-only scrolling",
            "bullets": [
              "Prevented horizontal panning/scrolling inside the in-game Changelog modal (touch + trackpad), so the panel stays vertically scrollable only.",
              "Hardened changelog text wrapping so long strings (paths/IDs) cannot force sideways overflow."
            ]
          },
          {
            "title": "Boot: file:// module loader compatibility",
            "bullets": [
              "When running from file:// on iOS, bootstrap now loads the game entry module via a <script type=\"module\"> injection fallback instead of dynamic import().",
              "This avoids Safari/WebView edge-cases where dynamic import() fails under file:// even though module scripts work."
            ]
          },
          {
            "title": "Engine modularization: item definition cloning helper",
            "bullets": [
              "Added js/game/utils/itemCloner.js (JSON-safe deep clone helper).",
              "Replaced the inlined cloneItemDef() function with a shared cloneItemDef constant backed by createItemCloner(ITEM_DEFS).",
              "Behavior is unchanged; this is a maintenance refactor to consolidate cloning semantics and reduce orchestrator duplication."
            ]
          },
          {
            "title": "Boot diagnostics patch label hardening",
            "bullets": [
              "Boot Diagnostics overlay now pulls the patch label from js/game/systems/version.js instead of hardcoding it.",
              "This prevents future patch bumps from leaving boot-time bug reports with stale patch numbers."
            ]
          },
          {
            "title": "Docs refresh for 1.2.72",
            "bullets": [
              "Updated README.md current patch line and project tree references to reflect 1.2.72.",
              "Documented the new data modules and extracted engine subsystems as part of the ongoing refactor."
            ]
          }
        
          ,
          {
            "title": "Engine Core: systems-grade services",
            "bullets": [
              "Added deterministic clock + scheduler (engine.tick and engine.schedule.after/every) for centralized timing.",
              "Added a command bus (engine.dispatch) with middleware support and a replayable command log.",
              "Added snapshot save/load helpers with checksum validation and a migration registry (engine.save/load + engine.migrations).",
              "Added structured logging and event tracing, plus a unified error boundary that can build copyable crash reports.",
              "Added seeded RNG streams, perf watchdog (slow scopes/frames), asset registry + preload, input router, UI router modal stack, and a headless test harness (engine.harness.runSteps)."
            ]
          }

,
          {
            "title": "Engine services wired into gameplay loops",
            "bullets": [
              "Fixed ew.uiRuntime plugin adapter installation to correctly capture the Engine instance during init (prevents engine.ui modal routing from becoming a no-op).",
              "Routed all standard modal opens/closes through the Engine UI router (engine.ui) via an adapter installed by the ew.uiRuntime plugin, so the modal stack is tracked for diagnostics.",
              "Save/load now prefers Engine snapshots (engine.save/engine.load), while still supporting legacy saves through the existing migration loader.",
              "Autosave coalescing now schedules via engine.schedule (clock-driven) instead of setTimeout, enabled by the Engine auto tick-loop.",
              "Engine Core now auto-ticks in live runtime (requestAnimationFrame fallback) so clock/scheduler features run without manual tick calls."
            ]
          }

          ,
          {
            "title": "Locus scheduler: timer ownership + teardown cleanup",
            "bullets": [
              "Extended engine.schedule with task ownership (owner strings) and a schedule.cancelOwner(owner) cleanup primitive.",
              "UI modal rendering now tags a per-modal owner and cancels all owned tasks on modal close, preventing deferred UI effects from firing after the modal is gone.",
              "Screen switching now cancels all tasks owned by the previous screen (owner: 'screen:<name>') to prevent timer leaks when leaving a screen.",
              "Migrated remaining UI/deferred timers (interior music debounce, tavern render coalescing, combat pause pacing, door SFX safety fallback) to engine.schedule with safe fallbacks when the engine is unavailable."
            ]
          },

          ,
          {
            "title": "Locus wiring: world events, quest bridge, input contexts & autosave",
            "bullets": [
              "Added a small world event layer (world:*) so systems can react without direct imports (loot gained, enemy defeated, battle start/end).",
              "Quest progress is now event-driven via ew.questEvents, which listens to world:itemGained and world:enemyDefeated.",
              "Added ew.inputContexts + ew.uiCommands: screen/modal-scoped input contexts dispatch engine commands for consistent UI control.",
              "Added ew.autosave: coalesces event-driven save requests and schedules periodic safety saves via engine.schedule (owner: system:autosave).",
              "Added ew.simTick: watches for day/part transitions and ensures the daily tick pipeline runs after loads or time jumps.",
              "Removed the last setTimeout fallback under js/game; non-engine fallbacks now use microtasks/MessageChannel/RAF."
            ]
          }

          ,
          {
            "title": "Engine utilization: command gateway, asset-driven loading & save transactions",
            "bullets": [
              "Routed primary UI actions (explore, combat buttons, and key village modals) through engine.commands via the ew.gameCommands plugin.",
              "Adopted savePolicy more broadly by replacing most direct saveGame() calls with requestSave(), allowing dirty-state coalescing and safe-point-aware flushing.",
              "Wrapped enemy defeat reward processing in a savePolicy transaction to prevent mid-resolution inconsistent saves.",
              "Added ew.screenAssetPreload: screen/modal entry now preloads declared asset groups and reports progress via engine.uiCompose busy overlay (including a progress bar)."
            ]
          }
]
      }
    ]
  },
{
    "version": "1.2.70",
    "title": "The Blackbark Oath — Hardening & Bug Squash",
    "sections": [
      {
        "heading": "Maintenance",
        "items": [
          {
            "title": "Changelog clarity pass",
            "bullets": [
              "Retitled older patch entries to reflect what they actually shipped (without changing the underlying notes).",
              "Standardized a few ambiguous titles so the in-game Changelog reads like a release history instead of a date stamp."
            ]
          },
          {
            "title": "Version label bump",
            "bullets": [
              "Updated GAME_PATCH to 1.2.70 and refreshed the patch name used by HUD labels and bug-report exports.",
              "Aligned README and boot diagnostics headers with the new patch label."
            ]
          },
          {
            "title": "Engine cleanup: save/migration extraction",
            "bullets": [
              "Moved save migrations, save/load, and multi-slot save helpers out of engine.js into js/game/persistence/saveManager.js.",
              "engine.js now delegates persistence to a saveManager instance, keeping orchestration and UI wiring cleaner.",
              "Fixed an iOS Safari ES-module load crash introduced by the extraction by late-binding save hooks (avoids temporal-dead-zone initialization issues under file://).",
              "Restored the internal save-blob builder hook used by Smoke Tests / Scenario Runner after the extraction (_buildSaveBlob is now exposed via saveManager and rebound in engine.js).",
              "No gameplay behavior changes; refactor is intended to make future bugfixes and migrations safer to maintain."
            ]
          },
          {
            "title": "Engine cleanup: UI module extraction",
            "bullets": [
              "Extracted DOM helpers, screen switching, and modal focus-trap logic out of engine.js into js/game/ui/runtime/uiRuntime.js.",
              "Moved DOMContentLoaded wiring (main menu buttons, settings controls, HUD taps/swipes, log filter chips, and modal dismissal handlers) into js/game/ui/runtime/uiBindings.js.",
              "engine.js now configures UI dependencies via configureUI(...) and calls initUIBindings(...) to keep orchestration thinner.",
              "Smoke-test log isolation now relies on the uiRuntime UI-write gate while the suite swaps state (prevents suite runs from mutating the player's visible log).",
              "No simulation/combat logic changes in this step; this is strictly a UI refactor to make future UI regressions easier to locate and fix."
            ]
          },
          {
            "title": "Engine cleanup: Diagnostics/QA UI extraction",
            "bullets": [
              "Moved Smoke Tests modal UI + dev pill visibility out of engine.js into js/game/ui/devtools/diagnosticsUI.js.",
              "engine.js now initializes a diagnostics UI instance and forwards openSmokeTestsModal/syncSmokeTestsPillVisibility calls.",
              "Reduced engine.js surface area for diagnostics work, making future QA UI tweaks less likely to regress gameplay code.",
              "Retuned smoke-test quick-mode iteration counts so iOS file:// runs remain fast while still exercising key invariants (full mode remains available)."
            ]
          },
          {
            "title": "Docs: GitHub-ready README expansion",
            "bullets": [
              "Rewrote README.md to be GitHub-friendly and substantially more detailed (architecture, systems deep-dives, testing/QA, and deployment notes).",
              "Documented the post-1.2.70 module boundaries (saveManager, uiRuntime/uiBindings, diagnosticsUI) to reduce future refactor regressions.",
              "Added GitHub Pages deployment instructions and iOS file:// caveats for ES module loading."
            ]
          }
        ]
      },
      {
        "heading": "Bug Fixes",
        "items": [
          {
            "title": "UI: Main menu button wiring regression",
            "bullets": [
              "Fixed a UI split regression where New Game / Load Game / Settings buttons were not wired due to mismatched DOM IDs.",
              "Character creation random-name and Start Game bindings now target the correct input/button IDs.",
              "Settings now correctly wires the Theme selector (themeSelect) and applies settings on Back as before."
            ]
          },
          {
            "title": "UI: Log filters and log styling regression",
            "bullets": [
              "Restored Log filter chip wiring to use data-log-filter and the log-chip-active class (pills now toggle and filter correctly).",
              "Restored log line element classes (log-line + type) so System/Player/Enemy colors match the intended theme.",
              "Damage-filter view again shows the compact breakdown subline (log-sub) when available.",
              "Fixed a UI runtime merge duplication that defined formatDamageBreakdownForLog twice, which could prevent iOS Safari from loading the game under file://."
            ]
          },
          {
            "title": "QA: Smoke Tests + Scenario Runner reliability (iOS file://)",
            "bullets": [
              "Fixed Smoke Tests failing to start on iOS Safari due to attempting to reassign imported ES-module bindings (read-only under strict module semantics).",
              "Added a uiRuntime modal adapter hook so QA can sandbox modal builders without monkey-patching openModal/closeModal.",
              "Re-exported UI runtime helpers used by the QA suite (screens and formatDamageBreakdownForLog) so refactors can't strand smoke tests with missing globals.",
              "Smoke tests now disable UI DOM work for the bulk of the suite, and auto-run a reduced-count quick mode on mobile for much faster runs (full mode available via runSmokeTests({ full: true })).",
              "Modal adapter execution is now allowed even when UI writes are disabled, keeping sandboxed modal tests working in performance mode.",
              "Scenario Runner now disables UI writes via a uiRuntime switch while state is swapped, instead of patching imported UI helpers.",
              "Scenario Runner severity output is now always defined (ok/issues) so stress tests and reports are consistent.",
              "Smoke test report header now includes a top-line summary of tests run, failures, and runtime (matching pre-refactor formatting).",
              "Stress enemy-builder expectations now scale with quick-mode iteration counts to avoid false failures on mobile.",
              "Restored the Smoke Tests modal summary line to the classic format (passed/failed • ms) and kept the detailed sections collapsed by default unless issues are detected."
              ,
              "Fixed a modal ownership/lock edge case where closing a game-owned modal could leave it locked, preventing subsequent modals from opening until refresh."
            ]
          },
          {
            "title": "UI: HUD / Dev pill interactions regression",
            "bullets": [
              "Restored in-combat HUD interactions: tapping the player name opens the Character Sheet again.",
              "Restored HUD swipe (hud-top) to toggle between player/companion view and correctly report when no companion exists.",
              "Restored the in-game Quest Journal pill and the Menu button wiring after the UI module split.",
              "Reinstated Quest + Log panel collapse/expand behavior (with smooth Log panel height animation and stick-to-bottom preservation).",
              "Cheat/Smoke Test pills now consistently open their modals again after refactoring (no silent no-op clicks).",
              "Fixed a visibility regression where Smoke Tests / Cheat HUD pills stayed hidden even when dev cheats were enabled (now toggles the .hidden class correctly)."
            ]
          },
          {
            "title": "Combat: AoE multi-enemy defeat resolution",
            "bullets": [
              "Fixed an edge case where AoE abilities could reduce non-target enemies to 0 HP without triggering handleEnemyDefeat (missing XP/loot/quest hooks).",
              "Player actions now finalize all enemies that reached 0 HP during the action, not just the current target.",
              "Added a per-enemy guard (_defeatHandled) to prevent duplicate defeat rewards in multi-enemy battles."
            ]
          },
          {
            "title": "Save migration: corner-case hardening",
            "bullets": [
              "Hardened save migration so flags=null (or non-object) cannot crash combat/UI code paths.",
              "Legacy saves that used qty instead of quantity now migrate cleanly (qty is removed after conversion).",
              "When loading older mid-battle saves, dead enemies are now marked as already handled to prevent duplicate XP/loot after updating to 1.2.70."
            ]
          },
          {
            "title": "UI: Settings panel markup regression",
            "bullets": [
              "Removed an extra stray closing <div> that could break layout / click targets in the Settings screen on some browsers."
            ]
          },
          {
            "title": "Combat: God Mode / status ticking safety",
            "bullets": [
              "Guarded several God Mode checks so missing flags objects cannot throw in damage/death flows.",
              "StatusEngine bleed ticking now safely treats missing state.flags as 'God Mode off'."
            ]
          }
        ]
      }
    ]
  },

  {
    "version": "1.2.65",
    "title": "Core Modularization + Boot Reliability",
    "sections": [
      {
        "heading": "Architecture",
        "items": [
          {
            "title": "JavaScript folder reorganization",
            "bullets": [
              "Moved boot scripts into js/boot (bootstrap + userAcceptance) and introduced shared helpers under js/shared.",
              "Moved gameplay code into js/game (engine, systems, quests, locations, changelog) with predictable folder naming.",
              "Moved audio assets to assets/audio and updated engine audio loading to resolve via URL + import.meta.url.",
              "Removed legacy wrapper trees (/Future, /small, and root wrappers). The app is now self-contained under /js and /assets."
            ]
          },
          {
            "title": "Engine modularization",
            "bullets": [
              "Extracted localStorage diagnostics into js/engine/storageRuntime.js.",
              "Extracted perf instrumentation helpers (perfNow/perfRecord/perfWrap) into js/engine/perf.js.",
              "Extracted combat post-turn sequencing into js/game/combat/postTurnSequence.js.",
              "Extracted combat damage/mitigation math into js/game/combat/math.js (keeps engine.js focused on orchestration).",
              "Extracted combat status ticking + on-hit synergies into js/game/combat/statusEngine.js.",
              "Extracted ABILITY_EFFECTS into js/game/combat/abilityEffects.js (keeps engine orchestration smaller and isolates spell logic).",
              "Fixed abilityEffects module initialization order by injecting state via getState() (prevents ES module TDZ boot crash) and ensuring the module only contains ability effect logic (no accidental engine code carryover).",
              "Ability effects that grant resource now compute haste-scaled gain via injected getPlayerHasteMultiplier, keeping behavior consistent after modularization.",
              "Extracted QA perf snapshot/report formatting into js/game/qa/perfSnapshot.js.",
              "Moved core data tables (ABILITIES and TALENT_DEFS) into js/game/data/ (abilities.js, talents.js) for cleaner engine orchestration.",
              "Moved the authored item catalog (ITEM_DEFS) into js/game/data/items.js and reintroduced an explicit import in engine.js (fixes ITEM_DEFS ReferenceError in inventory/merchant flows after refactors).",
              "Restored the full ITEM_DEFS catalog in items.js (previous stubbed table could leave missing item keys and break merchant/inventory paths).",
              "engine.js now focuses more on orchestration while helpers live alongside the engine entry."
            ]
          }
        ]
      },
      {
        "heading": "Bug Fixes",
        "items": [
          {
            "title": "Boot load reliability",
            "bullets": [
              "Fixed a syntax-breaking stray brace in the user acceptance boot module that could prevent ES module loading.",
              "Added a lightweight boot loader overlay (with progress) so the UI can paint before heavy module parsing and asset loads.",
              "Bootstrap now prefetches critical audio assets before engine start to reduce first-interaction stalls.",
              "Preflight module-graph scanning is now opt-in for performance (enabled via ?preflight=1 / ?diag=1, or automatically after a recorded failed boot).",
              "Updated boot entry wiring so index.html loads js/boot/* and bootstrap loads the engine from js/engine/engine.js."
            ]
          },
          {
            "title": "QA diagnostics: performance visibility",
            "bullets": [
              "Smoke Tests & Bug Report modal now includes a Performance Snapshot (boot timings, JS heap when available, and a short FPS sample).",
              "Bug Report export now carries a perfSnapshot block in JSON and renders a readable Performance section in the text report.",
              "Boot now persists a compact timing report (engine import, asset prefetch, total boot) for debugging perceived startup lag.",
              "Perf entries are now tagged by subsystem (combat, HUD, save, loot, village) and summarized per-subsystem in the Performance Snapshot.",
              "Performance Snapshot now highlights a Worst Offenders table using actionable thresholds (>16ms avg frame budget, >50ms hitch).",
              "Combat post-turn profiling now tracks deliberate pacing waits separately, so QA can see CPU time vs wall-clock time (and avoid misreading turn delays as slow code).",
              "Feedback modal now includes a Clear Crash Report action so resolved crashes don't linger in exported bundles."
            ]
          },
          {
            "title": "Combat modularization regression fixes",
            "bullets": [
              "Status engine now receives normalizeElementType as an injected dependency (fixes mobile crashes in combat synergy + affix flows).",
              "Restored legacy percent normalization for enemy affinities and elemental resists (fractional 0..1 inputs, percent-style strings, and negative resistance values behave like the pre-modular engine).",
              "Enemy affinity normalization now treats fractional deltas as percent-style modifiers (e.g., 0.12 => +12% => 1.12).",
              "Enemy affinity normalization now treats 0..1 values inside resist tables as direct multipliers when authored that way (e.g., frost: 0.85 stays 0.85, instead of being interpreted as +85%).",
              "Fixed a compatibility shim: applyStatusSynergyOnPlayerHit now supports the smoke-test signature (enemy, damageDealt, elementType, damageType) and legacy callers.",
              "Engine status shims now correctly forward the player argument into the status engine (fixes bleed turn ticking + clears in smoke tests).",
              "Player DoT/HoT durations (bleed/poison/burning/regen/chilled) now tick down on the player's turn start only (prevents double-ticking on post-enemy hooks and matches smoke-test expectations).",
              "Combat math RNG is now injected via a dynamic wrapper, allowing QA/smoke tests to temporarily override rand() without rebuilding modules (restores deterministic expected damage in unit checks)."
            ]
          },
          {
            "title": "Packaging consistency",
            "bullets": [
              "Updated README patch label and standardized distribution naming to Emberwood_patch_1.2.65_core_systems."
            ]
          }
        ]
      }
    ]
  },
{
    "version": "1.2.62",
    "title": "Maintenance: Version Source of Truth + Boot Shared Helpers",
    "sections": [
      {
        "heading": "Maintenance",
        "items": [
          {
            "title": "Codebase cleanup for easier editing",
            "bullets": [
              "Introduced Future/Systems/version.js as a single source of truth for the current patch label (used by engine.js and the bootstrap version label).",
              "Added small/lib/safeStorage.js and refactored early-boot modules (bootstrap + userAcceptance) to share safe localStorage helpers.",
              "engine.js: converted key lifecycle flows (New Game init, Load Game repair, and Daily Tick order) into inline step lists so adding a new system is a single-entry edit.",
              "Renamed Future/engine.js to Future/engine.js and reorganized major sections with clear, in-file headers (no gameplay behavior changes).",
              "Standardized file headers and reduced duplicated helper blocks in early-boot scripts.",
              "No gameplay changes in this maintenance patch."
            ]
          },
          {
            "title": "Version bump to 1.2.62",
            "bullets": [
              "Updated the displayed patch version across README, in-game HUD version label, and the bootstrap version selector.",
              "Updated the distributed folder/zip naming to Emberwood_patch_1.2.62_core_systems."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.60",
    "title": "Packaging Consistency + Expanded Smoke Tests",
    "sections": [
      {
        "heading": "Bug Fixes",
        "items": [
          {
            "title": "Versioning + packaging consistency",
            "bullets": [
              "Unified the displayed patch version across the in-game version label, bootstrap version selector label, and README so you no longer see mismatched patch numbers.",
              "Standardized the distributed folder/zip naming to Emberwood_patch_1.2.60_core_systems for cleaner installs and fewer path mix-ups."
            ]
          },
          {
            "title": "Smoke Tests: more intensive coverage",
            "bullets": [
              "Stress suite now runs larger loot/enemy generation passes and validates item power/price helpers stay finite.",
              "Added repeated save roundtrip (build → JSON → migrate) cycles plus a longer scenario runner pass to catch rare drift bugs."
            ]
          }
        ]
      }
    ]
  },
{
    "version": "1.2.53",
    "title": "QA Polish + Save Tools",
    "sections": [
      {
        "heading": "Highlights",
        "items": [
          {
            "title": "QA + Scenario Runner polish",
            "bullets": [
              "Smoke Tests modal: pill action buttons keep their original pill styling while scaling text only (font-size) so hitboxes remain consistent on narrow screens.",
              "Smoke Tests modal: action rows are now edge-to-edge; when a row contains only two actions it auto-adapts to a true 2-column layout (prevents trailing gaps).",
              "Scenario Runner no longer leaves the live Quest Box in a stale state (fixes cases where the Quest Box said 'No pinned quest' while the Journal still showed a pinned quest).",
              "After a Scenario Runner run, the live HUD/Quest Box is refreshed to match the restored save state.",
              "Smoke Tests no longer unpin a pinned quest during the suite (pinned selection is restored when returning to the live save).",
              "Smoke Tests no longer wipe the on-screen Quest Box while running; the Quest Box is refreshed after the suite so pinned objectives remain visible.",
              "Damage breakdown lines in the Damage log now show enemy elemental Weak/Resist modifiers (affinities) and no longer print a confusing 'resist 0%' when a target has no flat resist for that element.",
              "Enemy damaging abilities now inherit an offensive element tag when missing (based on enemy elemental traits), so player elemental resistances reliably mitigate enemy hits.",
              "Elemental weakness/resistance math is now hardened against mixed units (multiplier vs percent vs fraction) and synonym element keys; the Enemy Sheet and Damage log both use the same normalized values, with new smoke-test regressions for stacking and formatting.",
              "Damage rounding now uses stable half-step rounding (epsilon) to prevent rare off-by-one results when affinity and flat resist math lands on exact .5 boundaries.",
              "Fixed Smoke Tests definition syntax errors (missing/extra parentheses) that could prevent the game from loading when running under file:// on iOS.",
              "Added Save Tools in Settings: Export current save as a .json file, Import a .json save (for editing), and Export All saves as a single bundle backup.",
              "Save export is now pretty-printed (multi-line JSON) with key sections ordered for easier editing.",
              "Settings: the Saves section now starts collapsed to reduce clutter; tap the section header to expand.",
              "Log panel collapse/expand now matches the Quest Box animation (smooth slide + fade) without imposing an expanded max-height cap.",
              "Log now reliably auto-scrolls to new entries while you\u2019re at the bottom; if you scroll up to read, auto-scroll pauses until you return to the bottom."

            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.52",
    "title": "Core Systems Flush‑Out",
    "sections": [
      {
        "heading": "Highlights",
        "items": [
          {
            "title": "Core system cleanup",
            "bullets": [
              "Added a unified world time advancement entry point (advanceWorldTime) so explore/rest consistently fire day-change hooks and generate a daily report.",
              "Combat log now supports additional filters (Combat / Damage / Procs / Status), and damage events can show a compact per-hit breakdown when filtering Damage.",
              "Damage filter now shows breakdown details for player spell hits (not just enemy attacks / physical strikes).",
              "Rest + debug day-skips now advance time through advanceWorldTime (advanceToNextMorning/advanceWorldDays) so daily ticks can’t drift.",
              "advanceWorldTime now takes an explicit state object (removes hidden global coupling; enables safe cloned simulations).",
              "Quest objective progression now uses a pre-built trigger registry for kill/collect objectives (faster + less error-prone than scanning every quest on every event).",
              "Tavern rest now surfaces an expanded Daily Report including merchant stock replenishment where available.",
              "Added state integrity audits (validateState + deep scanners) with a save guard: critical issues block saving so corrupted state can’t overwrite a good save.",
              "Smoke Tests panel now includes Live Save Audit, a deterministic Scenario Runner, and an opt-in perf capture ring buffer for profiling time-advance/save paths."
            ]
          }
        ]
      },
      {
        "heading": "Technical Notes",
        "items": [
          {
            "title": "Combat telemetry",
            "bullets": [
              "Physical, magic, and enemy damage calculations now populate a unified breakdown object that is attached to combat log entries as metadata.",
              "Crit/trigger lines are now tagged as combat procs to make filtering less noisy.",
              "Damage breakdown formatting now accepts both legacy and newer field names (e.g., effectiveRes vs effectiveMagicRes) for consistent log details."
            ]
          },
          {
            "title": "Quest triggers",
            "bullets": [
              "Introduced Future/Quests/questTriggerRegistry.js to compile event → objective lookups from questDefs.",
              "Quest bindings now pass a shared registry through the quest API so progression handlers can apply updates directly."
            ]
          },
          {
            "title": "QA/Dev reliability",
            "bullets": [
              "Bug Report bundles now include lastAudit / lastScenario summaries and a perfLog tail when perf capture is enabled.",
              "Save integrity audit is recorded for debugging without hard-crashing the session (critical issues block the write; warnings still save but are logged)."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.5",
    "title": "Big Bugfix + Balance Patch",
    "sections": [
      {
        "heading": "Highlights",
        "items": [
          {
            "title": "Reliability + clarity pass",
            "bullets": [
              "Fixes multiple UI and quest-tracking edge cases that could cause missing/incorrect on-screen information.",
              "This is the public rollup patch number; feature additions from prior internal builds remain documented in their original entries below."
            ]
          }
        ]
      },
      {
        "heading": "Bug Fixes",
        "items": [
          {
            "title": "UI markup: Enemy target hint",
            "bullets": [
              "Fixed an invalid/mis-escaped enemy target-hint element id in index markup that could prevent the hint from being found/updated.",
              "Repaired the surrounding div structure to avoid DOM nesting issues in the enemy panel."
            ]
          },
          {
            "title": "Quest box: objective progress counting",
            "bullets": [
              "Fixed objective progress calculation to always count against the quest actually being rendered in the quest box (prevents wrong counts in future refactors / derived quest objects)."
            ]
          }
        ]
      },

      {
        "heading": "Balance",
        "items": [
          {
            "title": "Combat pacing + scaling",
            "bullets": [
              "Reduced damage variance for both player and enemies (less extreme high/low rolls; results are more consistent).",
              "Smoothed Dynamic difficulty band steps so swings between bands are less punishing (especially enemy damage).",
              "Softened enemy level scaling curves (HP, Attack, Magic, Armor, and Magic Resist) so late-zone enemies ramp more fairly."
            ]
	          },
          {
            "title": "Loot balance",
            "bullets": [
              "Adjusted drop mix to reduce potion saturation on regular encounters and slightly increase gear frequency.",
              "Reduced potion scaling per level so sustain doesn't outpace enemy damage as quickly.",
              "Tuned down generated elemental wards and added a hard cap to total player elemental resistance (prevents extreme near-immunity builds).",
              "Added a true loot rarity: Mythic (above Legendary)."
            ]
          }
        ]
      },
      {
        "heading": "Notes",
        "items": [
          {
            "title": "Changelog completeness",
            "bullets": [
              "This patch note intentionally does not duplicate the feature-by-feature notes from prior 1.2.x entries below.",
              "Patch 1.2.5 is being used as the public-facing version number for the current build line.",
              "Some smaller tweaks and micro-fixes may not be listed here yet."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.42",
    "title": "Quest Journal + Pinned Quest Box",
    "sections": [
      {
        "heading": "UI",
        "items": [
          {
            "title": "Quest Journal",
            "bullets": [
              "Added a Journal pill (📓) next to the main Menu button for full quest tracking.",
              "Journal lists active + completed quests with step text and objective progress.",
              "Journal shows required quest items for collect objectives, including current progress.",
              "Journal supports pinning an active quest to focus the quest box on a single objective."
            ]
          },
          {
            "title": "Pinned quest focus",
            "bullets": [
              "You can pin an active quest from the Journal so the quest box shows only that quest until you unpin it.",
              "Pinned quest selection is saved and will automatically clear if the pinned quest is no longer active."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.4",
    "title": "The Hollow Crown (Story Expansion)",
    "sections": [
      {
        "heading": "Story & Quests",
        "items": [
          {
            "title": "Main quest continues past the Blackbark Gate",
            "bullets": [
              "Added Chapter III: The Hollow Crown to the main quest line, extending the story after your oath decision.",
              "Added Chapter IV: The Rootbound Court, continuing the main quest immediately after the Hollow Crown epilogue.",
              "New chapter structure: emergency council, a night return to the gate, two relic hunts (Spire + Catacombs), an ally-selection ritual, and a final confrontation.",
              "Chapter IV structure: a village summons, a Ruined Spire record-keeper boss, a marsh writ hunt (kill/collect), and a chain of writ-boss fights across Frostpeak, Catacombs, and the Keep — ending with a night tribunal at the Gate.",
              "Branching choices now stack: your Blackbark oath + the council stance + the ritual leader/ending jointly shape later story text and reward beats.",
              "New Chapter IV finale choice (Accept / Defy / Rewrite) sets the tone for future story chapters and leaves the main quest active at a 'To be continued' step.",
              "Back-compat: older saves that finished Chapter II will automatically reopen the main quest at Chapter III the next time they load.",
              "Back-compat: saves that previously marked the main quest completed after Chapter III will now reopen it at Chapter IV.",
              "Added new quest flags for Chapter III so progress is tracked cleanly across saves and future content drops.",
              "Added new quest flags for Chapter IV (summons, writ chain, magistrate, and verdict) for clean save tracking.",
              "Quest log now uses 'Chapter II completed' messaging instead of marking the main quest finished immediately after the oath choice.",
              "Bugfix: main quest is no longer marked completed at the end of Chapter III (it now rolls into Chapter IV).",
              "Bugfix: added missing default flag for Chapter IV marsh writ clue messaging (prevents undefined flag reads on first visit).",
              "Bugfix: added missing default flag for Chapter IV marsh writ clue tracking (prevents undefined checks in the marsh beat).",
              "Quests can now declare interactive objectives (kill/collect) with tracked progress displayed in the quest box.",
              "Added enemy-sourced quest item drops (quest items are non-usable/non-sellable/non-droppable) and wired inventory acquisition to advance collect objectives.",
              "Updated side quests 'Whispers in the Grain' and 'The Missing Runner' to require defeating specific enemies and recovering proof items from them (with forest encounter bias to keep testing reliable).",
              "Main quest Step 6 now fully respects interactive objectives: Obsidian Keep encounters bias toward the king’s guard until the keep seal is recovered, and the Obsidian King won’t reliably spawn until the step goals are complete.",
              "New Game: the main quest no longer starts automatically — speak with Elder Rowan (Village menu) to accept it when you're ready.",
              "Emberwood Forest can now be explored before accepting the main quest, without triggering story progression or boss spawns.",
              "Chapter I: added a Rowan debrief beat after defeating the Goblin Warlord, providing story context before the Ruined Spire arc begins.",
              "Chapter I: expanded the pre‑Warlord arc with new story beats (Captain Elara briefing + Bark‑Scribe intel), a Bitterleaf salve preparation step, and a longer forest escalation before the Warlord fight.",
              "Chapter II: expanded pacing with new story beats — Rowan’s Blackbark reveal now points you to Captain Elara (Step 8.25) before the Bark‑Scribe handoff.",
              "Chapter II: added a Bark‑Scribe splinter‑binding beat (Step 10.5) that unlocks a dedicated incursion step (Step 10.75) in a new area: The Oathgrove.",
              "Chapter III: added two new exploration-gated investigation steps and areas: Blackbark Depths (Step 15.5) and Starfall Ridge (Step 17.5), to lengthen the chapter and keep character motivations consistent across council/ritual arcs.",
              "Chapter III: added a Starfall Ridge mini-boss (Starfall Sentinel) that can trigger once you have 2 Star‑Iron shards, guaranteeing at least one shard drop for smoother progression.",
              "Chapter III: the Bark‑Scribe now directs you to gather Star‑Iron shards at Starfall Ridge before returning to the Ruined Spire for the Star‑Iron Pin.",
              "New exploration areas: The Oathgrove (mid‑Chapter II), Blackbark Depths (Chapter III investigation), and Starfall Ridge (Chapter III relic hunt).",
              "Chapter I: added new authored forest fights (Goblin Trapper, Goblin Packmaster, Goblin Drummer, Goblin Captain) and new quest proof items (Bitterleaf, Hunter’s Brooch, Supply Tag, Cache Ledger, Drumskin Banner, Warlord Sigil).",
              "Boss gating: the Goblin Warlord will not reliably spawn until the Warlord Sigil is recovered (prevents early camp spawns and stretches Chapter I pacing).",
              "Cheat Menu: added Chapter I jump presets for each new beat (Step 0.25/0.5/0.75/1.1/1.2/1.25/1.3/1.4) and a Warlord-ready preset.",
              "Boss gating: the Void‑Touched Dragon will not spawn in the Ruined Spire until the main quest reaches the Spire step (prevents out-of-order bosses when traveling early).",
              "Bugfix: added the missing goblinScout enemy template referenced by quest encounters/objectives (prevents a runtime battle-spawn crash).",
              "Bugfix: fixed a stray closing brace in questSystem.js that caused a SyntaxError on game load (seen on iOS file:// runs).",
              "Bugfix: fixed an invalid multi-line single-quoted string in questSystem.js that caused 'Unexpected EOF' on load (iOS file://).",
              "Bugfix: fixed a ReferenceError crash where questSystem explore beats called rngPick without importing it (seen on iOS file://).",
              "Bugfix: fixed a Tavern Bark‑Scribe story card crash caused by referencing an undeclared `questSystem` identifier inside an ES module (iOS/WebKit threw 'Can't find variable: questSystem').",
              "Bugfix: fixed a Town Hall load crash caused by an unescaped apostrophe inside a single‑quoted story log string (iOS/WebKit reported 'Unexpected identifier 's'').",
              "Bugfix: fixed a missing comma in quest item definitions that could cause a SyntaxError in some builds when adding new quest items.",
              "Bugfix: new games now start with full HP after derived stat recalculation (Endurance/gear scaling previously left the hero below max at the moment you enter the village).",
              "Cheat Menu: manual story step setter now supports half-steps for mid-beat testing (ex: 1.5 Rowan debrief), and a new preset was added for that beat."
            ]
          }
        ]
      },
      {
        "heading": "Combat",
        "items": [
          {
            "title": "New story encounters",
            "bullets": [
              "Added four Chapter III enemies: Crown‑Shade, Mirror Warden, Grave‑Latch Warden, and The Hollow Regent (boss kit: bossRegent).",
              "Added Chapter II/III expansion enemies for new areas: Rootcrown Acolyte, Oathgrove Stalker, Sapbound Warden (boss), Oathbound Stalker, Blackbark Wraith, Starfall Reaver, Astral Wisp, and the Starfall Sentinel mini‑boss.",
              "Added Chapter IV enemies: Rootbound Bailiff (objective hunt), Echo Archivist (boss), Ice Censor (boss), Bone Notary (boss), Oathbinder (boss), and Rootbound Magistrate (night tribunal boss).",
              "Finale boss pacing is keyed to night-time at the Blackbark Gate, matching the story's dusk/night framing."
            ]
          }
        ]
      },
      {
        "heading": "UI",
        "items": [
          {
            "title": "Town Hall + Tavern story hooks",
            "bullets": [
              "Town Hall now surfaces an Emergency Council story card during Chapter III Step 15.",
              "Tavern now surfaces a Bark‑Scribe story card to decode the Crown‑Echo during Chapter III Step 17.",
              "Cheat Menu: added a Story / Main Quest section with chapter/beat jump presets (plus manual step setter) for faster story testing.",
              "Reduce Motion: the HUD class meter 'Ready' pulse and Spell Book empowered-outline pulse are now fully disabled (not frozen mid-flash) when Reduce Motion (or OS reduced motion) is enabled; spell select hover movement is also removed."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.32",
    "title": "Combat Systems Audit (Bugfix)",
    "sections": [
      {
        "heading": "Combat",
        "items": [
          {
            "title": "Combat systems audit + UI consistency",
            "bullets": [
              "Fixed a physical-hit pipeline bug that applied on-hit status synergies and equipment traits twice, causing inflated procs and inconsistent logs.",
              "Basic Attack and Interrupt now route through the shared hit-resolution helpers, so posture, synergies, and on-hit traits behave the same as other abilities.",
              "Magic damage now participates in status synergies (ex: Fire spells can Ignite bleeding targets) without triggering physical-only weapon trait procs.",
              "Elemental bonus/resist keys from equipment are normalized during stat recalculation so element matching (Ice/Frost, Storm/Lightning, etc.) is consistent across combat math and UI.",
              "AoE damage now calculates per-target using that enemy's defenses and affinity multipliers (splash no longer borrows the primary target's stats).",
              "Fixed talent damage scaling mismatches: spell-focus talents apply to spells only and no longer double-count via both elemental bonus and an extra damage multiplier.",
              "Enemy affinity lookups now normalize element keys (Ice→Frost, Storm→Lightning, etc.) so weakness/resist templates consistently apply.",
              "Enemy flat elemental resists (enemy.elementalResists) now reduce incoming elemental damage (physical + magic); previously they only displayed on the enemy sheet.",
              "Talent unlocks now trigger immediate stat recalculation + HUD refresh so all classes reflect resist/bonus/dodge changes instantly.",
              "Spell Book (combat): removed class meter explainer text; empowered abilities now pulse with a class-colored outline to show they are currently buffed.",
              "Character Sheet: fixed a Stats-tab crash (missing template variable) and ensured the sheet refreshes immediately after talent unlocks.",
              "Character Sheet: added an Elemental Breakdown panel showing Gear vs Talent contributions for each element (Bonuses + Resists).",
              "Character Sheet: fixed elemental summary rendering by normalizing element keys, parsing % values safely, and filtering bogus keys (prevents duplicate lines like 0frost / 0shadowshadow).",
              "Abilities: all player/enemy/companion abilities now declare an elementType when it meaningfully applies; otherwise they are tagged Physical for consistent UI + debugging.",
              "Dev cheat: Max Level now awards talent points for all skipped levels and opens the skill allocation modal so you can spend gained points immediately.",
              "Cheat Menu: added a Progression & Talents section (grant/refund points, unlock all class talents, force stat recalc) and the cheat status bar now shows Skill/Talent points.",
              "Companion plain-attack damage no longer crashes due to an undeclared player reference in calcCompanionDamage().",
              "Loot: itemLevel/price scoring now accounts for armor elemental wards so shop values better track defensive power.",
              "QA: Smoke tests are now more aggressive (300-step fuzz + stress tests for loot, enemy builder, damage calcs, and talent unlocks) and the Bug Report includes deeper scanners (derived stat sanity, combat runtime sanity, talent wiring integrity) with top findings + longer input/RNG/log tails.",
              "Bug Report: player derived stats are now initialized to finite defaults at character creation so stat-sanity scans don't report undefined crit/dodge/resistAll/armorPen on a fresh save."
            ]
          }
        ]
      },
      {
        "heading": "Talents",
        "items": [
          {
            "title": "Expanded class talent pools",
            "bullets": [
              "All playable classes now have 8 selectable talents (2 options per unlock tier at levels 3/6/9/12)."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.3",
    "title": "Enemy Elemental Scaling",
    "sections": [
      {
        "heading": "Combat",
        "items": [
          {
            "title": "Difficulty + level scaling for enemy elementals",
            "bullets": [
              "Enemy elemental resists/weaknesses now scale modestly with enemy level.",
              "Difficulty now scales the magnitude of enemy elemental resists (Hard a bit stronger; Easy a bit softer).",
              "Higher difficulties (and higher-level/rarer enemies) have an increased chance to roll an additional elemental trait that grants a themed resist + an opposing weakness."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.2",
    "title": "Elemental Systems Pass",
    "sections": [
      {
        "heading": "Combat",
        "items": [
          {
            "title": "Elemental consistency",
            "bullets": [
              "Added a central element key normalizer so bonuses/resists/affinities consistently match (e.g., Ice→Frost, Storm→Lightning).",
              "Enemy elemental attacks now correctly tag their element where intended (Poison Spit→Poison, Inferno→Fire) so player elemental resists can mitigate them.",
              "Poisoned Blade now counts as Poison element for damage bonuses/affinity hooks."
            ]
          }
        ]
      },
      {
        "heading": "Loot",
        "items": [
          {
            "title": "Element pool completeness",
            "bullets": [
              "Generated elemental gear can now roll Holy and Earth in addition to the existing elements."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.1",
    "title": "Character Sheet Cleanup",
    "sections": [
      {
        "heading": "UI",
        "items": [
          {
            "title": "Character sheet",
            "bullets": [
              "Removed the Time line from the character sheet summary.",
              "Added collapsible detail sections (tap section headers) to reduce clutter; secondary sections start collapsed."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.2.0",
    "title": "The Blackbark Oath — Talents, Synergies, Affinities",
    "sections": [
      {
        "heading": "Progression",
        "items": [
          {
            "title": "Talents",
            "bullets": [
              "Added a lightweight Talent system: earn Talent Points every 3 levels (Lv 3/6/9/12/…).",
              "Spend Talent Points to unlock class-specific passive bonuses (Mage/Warrior/Blood Knight/Ranger initial pass).",
              "Talents integrate directly into combat systems (meter cadence, elemental bonuses, cleave tuning, on-kill resource boosts, etc.)."
            ]
          }
        ]
      },
      {
        "heading": "Combat",
        "items": [
          {
            "title": "Status synergies",
            "bullets": [
              "Bleed + Fire: ignites the enemy (Burning DoT).",
              "Chilled + Physical: Shatter triggers bonus burst damage and consumes Chill."
            ]
          },
          {
            "title": "Enemy affinities",
            "bullets": [
              "Enemies can now define elemental weaknesses/resistances (e.g., weak to fire, resist frost).",
              "Affinity multipliers are applied during damage resolution (physical + magic) and are reflected by the Spell Book numeric previews.",
              "New: Enemy panel now displays elemental Weak/Resist tags when present.",
              "Enemy elemental resistance scales with difficulty (Hard resists more; Easy resists less).",
              "Enemy magic abilities now carry explicit elements (e.g., Shadow/Arcane) so player elemental resist can mitigate them.",
              "Spell Book badges now include the spell’s element (shown alongside Single/AoE and Damage/Support)."
            ]
          },
          {
            "title": "Equipment traits",
            "bullets": [
              "Gear can now carry simple authored traits that trigger on-hit, on-shield-cast, or on-kill.",
              "New: All generated equipment now rolls elemental bonuses/resists so elemental builds are always supported (scales with item level + tier).",
              "Initial trait examples: on-hit bleed chance, 'after casting a shield: next damage +X%', and on-kill resource gains."
            ]
          },
          {
            "title": "Multi-enemy encounters + AoE follow-through",
            "bullets": [
              "Difficulty-weighted multi-enemy encounters remain in place (Easy: almost always 1; Normal: higher 2-enemy rate; Hard: mostly 2 with higher 3-enemy chance).",
              "Player AoE/splash abilities continue to damage multiple enemies in multi-enemy fights."
            ]
          }
        ]
      },
      {
        "heading": "UI",
        "items": [
          {
            "title": "Talents panel",
            "bullets": [
              "Added a Talents panel to the Character Sheet with unlock buttons and point display."
            ]
          },
          {
            "title": "Enemy panel resistances",
            "bullets": [
              "Enemy panel now shows elemental Weak/Resist tags based on the enemy's affinities."
            ]
          }
        ]
      },
      {
        "heading": "Testing / QA",
        "items": [
          {
            "title": "New smoke tests (Patch 1.2.0 systems)",
            "bullets": [
              "Talents: verifies Mage Rhythm Mastery lowers the empowerment threshold.",
              "Status synergies: verifies Bleed+Fire Ignite and Chilled+Physical Shatter.",
              "Enemy affinities: verifies weakness/resistance multipliers resolve correctly.",
              "Equipment traits: verifies on-hit bleed, on-shield-cast next-damage buff, and on-kill resource gains (trait + talent).",
              "Elemental gear rolls: verifies generated weapons always have an element bonus and generated armor always has an element resist."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.82",
    "title": "Smoke Test UX + QA Robustness",
    "sections": [
      {
        "heading": "Testing / QA",
        "items": [
          {
            "title": "Smoke Tests modal is now more actionable",
            "bullets": [
              "Added an explicit Run button plus Copy Results / Copy Failures / Copy JSON actions.",
              "Added a lightweight summary line (pass/fail counts + runtime) so you can tell at a glance if the suite is healthy.",
              "The modal now auto-runs once on open to keep quick QA loops fast."
            ]
          },
          {
            "title": "Smoke suite robustness improvements",
            "bullets": [
              "Console noise is now treated as a first-class failure: any console.error or failed console.assert is surfaced and causes the run to fail.",
              "Failure output now includes the first 20 console.error / console.assert messages to make regressions easier to diagnose from a single paste."
            ]
          }
        ]
      },
      {
        "heading": "Bugfixes",
        "items": [
          {
            "title": "Section summaries are accurate",
            "bullets": [
              "Fixed section accounting so the final test section is included in the per-section results list."
            ]
          },
          {
            "title": "Version labels aligned",
            "bullets": [
              "Aligned GAME_PATCH, README, boot diagnostics overlay, and bootstrap version label to 1.1.82."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.8",
    "title": "Enemy Rarity + Mini-Affixes (Difficulty-Linked)",
    "sections": [
      {
        "heading": "Combat",
        "items": [
          {
            "title": "Enemy mini-affixes",
            "bullets": [
              "Added mini-affix rolls on non-boss enemies (outside the village).",
              "Elites reliably roll mini-affixes; higher enemy rarity can increase affix count.",
              "Affixes supported: Vampiric, Thorned, Frozen (Chilled), Hexed, Berserk, Regenerating."
            ]
          },
          {
            "title": "Enemy sheet",
            "bullets": [
              "You can now tap/click the enemy panel in combat to open a full Enemy Sheet modal.",
              "Shows enemy stats, posture, intent, abilities, affixes, current effects, and reward/loot info.",
              "Removed the tap/click focus glow on the enemy panel (keyboard focus still shows an outline)."
            ]
          },
          {
            "title": "Enemy rarity tiers",
            "bullets": [
              "Added enemy rarities: Common, Uncommon, Rare, Epic, Legendary, Mythic — bosses are always Legendary.",
              "Rarity scales enemy max HP and combat stats, plus rewards (XP/gold) and loot odds.",
              "Hard can roll a few Epics, a few Legendaries, and extremely rare Mythics (level-gated)."
            ]
          },
          {
            "title": "Loot ties to enemy rarity",
            "bullets": [
              "Loot quality and drop chances are driven by the enemy's rarity tier.",
              "Higher difficulty improves loot mostly indirectly by spawning higher-rarity enemies."
            ]
          },
          {
            "title": "Enemy systems modularized",
            "bullets": [
              "Enemy creation (zone scaling → elite → rarity → affixes) is now built through Systems/Enemy modules.",
              "This makes enemy logic easier to maintain and reduces engine.js churn while keeping gameplay behavior identical."
            ]
          },
          {
            "title": "Bug fixes",
            "bullets": [
              "Fixed a missing combat helper (applyDirectDamageToPlayer) introduced during enemy modularization that could break combat flows and smoke tests."
            ]
          }
        ]
      },
      {
        "heading": "Difficulty",
        "items": [
          {
            "title": "Difficulty now influences rarity + affixes",
            "bullets": [
              "Easy: enemies roll Common only (straightforward encounters).",
              "Normal: very little Common; mostly Uncommon with a few Rares.",
              "Hard: no Common; very little Uncommon; mostly Rare with a few Epics, a few Legendaries, and extremely rare Mythics.",
              "Tuned Hard non-boss Legendary roll weight slightly upward so Legendary spawns show up reliably (and smoke tests stay stable).",
              "Dynamic: enemy rolls follow the effective difficulty label (Easy/Normal/Hard).",
              "Mini-affix frequency and caps follow the same difficulty intent; Easy disables mini-affixes unless forced."
            ]
          }
        ]
      },
      {
        "heading": "Bugfixes",
        "items": [
          {
            "title": "Spawned enemies now start at full HP after rarity scaling",
            "bullets": [
              "If an enemy spawns at full HP, rarity scaling preserves full HP after max HP increases.",
              "Loaded/mid-combat enemies are not healed by this adjustment."
            ]
          },
          {
            "title": "Scaled stats now affect damage as intended",
            "bullets": [
              "After difficulty/rarity scaling, enemy baseAttack/baseMagic are synced so scaled damage is applied consistently."
            ]
          },
          {
            "title": "Affix hooks apply consistently",
            "bullets": [
              "Thorns/Vampiric/Frozen hooks now trigger on all relevant hit paths (including basic attacks / interrupt paths)."
            ]
          }
        ]
      },
      {
        "heading": "Testing",
        "items": [
          {
            "title": "Expanded smoke tests",
            "bullets": [
              "Added deterministic combat smoke tests for affixes, rarity rules (boss/elite), and difficulty-linked rarity trends.",
              "Strengthened invariants to catch NaN/Infinity and negative counter regressions."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.72",
    "title": "Enemy HUD Styling Pass + Combat UI Bugfixes",
    "sections": [
      {
        "heading": "UI / HUD",
        "items": [
          {
            "title": "Enemy panel now matches the hero HUD",
            "bullets": [
              "Enemy panel layout, padding, and typography were updated to mirror the hero HUD styling for a more cohesive combat UI.",
              "Enemy name/tags now use the same uppercase + letter-spacing treatment as the hero HUD header."
            ]
          },
          {
            "title": "Enemy HP bar label visibility",
            "bullets": [
              "Enemy HP label is now anchored as an overlay (like the hero bars), staying centered and readable even when enemy HP is very low.",
              "Enemy HP bar height now matches the hero HP/resource bars for consistent readability."
            ]
          },
          {
            "title": "Rarity-colored item names",
            "bullets": [
              "Each rarity tier now has its own text color (Common/Uncommon/Rare/Epic/Legendary) so item names immediately read as their tier.",
              "Rarity colors are shown in both the Inventory list and the Equipment tab on the character sheet."
            ]
          },
          {
            "title": "CSS unification + removed click press animation",
            "bullets": [
              "Consolidated repeated focus/selected/hover gradients and rarity colors into shared CSS tokens to make future reskins easier and reduce duplication.",
              "Removed press/click scaling/shift feedback on buttons/tabs, and restricted hover lift effects to pointer devices so taps don’t animate on mobile."
            ]
          },
          {
            "title": "Pill click highlight restored",
            "bullets": [
              "The HUD top-right pills (Menu/Cheats/Smoke Tests) and the modal close (✕) now play a quick glow highlight on tap/click (no movement/scale)."
            ]
          },
          {
            "title": "Combat class meter icons",
            "bullets": [
              "The combat class meter (second ability bar) now uses class-themed icons instead of tick dots for clearer class identity.",
              "Icons are now rendered from an inline SVG sprite (tintable via CSS and crisp at small sizes, including iOS file:// installs).",
              "Icons were refined for clarity at small sizes and now render as outlined circles with crisp outline-only icons; active pips highlight the circle + icon in your class color (no filled pips).",
              "The meter fill color now tints per class (Rogue/Ranger/Necromancer/etc.) instead of using the global accent.",
              "When all ticks are active (or the meter is in a Ready state), the tick area now pulses with a stronger class-tinted glow so it’s obvious you can spend/use the meter."
            ]
          },
          {
            "title": "Live HP/Mana bar animation",
            "bullets": [
              "Hero HP bar defines the live motion treatment (drifting texture + sheen) designed to read smoothly on mobile Safari.",
              "Mana/Fury/Essence/Blood resource bars now use the exact same motion timing/opacity as HP so every bar feels like one unified system.",
              "Enemy HP bar uses the same live motion so both sides of combat match.",
              "Animations respect prefers-reduced-motion for accessibility.",
              "Added a Reduce motion setting in Settings to disable UI motion/animations on demand (in addition to honoring the OS preference)."
            ]
          },
          {
            "title": "Cleaner Settings menus",
            "bullets": [
              "Main-menu Settings screen was reorganized into clear sections (Display/Audio/Gameplay/Accessibility) with a cleaner label/control layout.",
              "Both the main-menu Settings screen and the in-game Settings modal were compacted to use less vertical space (single-line descriptions, tighter row padding) while keeping the same functionality.",
              "In-game Settings modal matches the same sectioned layout, with switch-style toggles and consistent control styling for a cleaner menu during combat."
            ]
          },
          {
            "title": "Loot generator parse error fix (iOS boot)",
            "bullets": [
              "Fixed an unquoted object key ('War Axe') in the weapon implicit-traits table that could cause a JavaScript syntax error and prevent the game from booting on iOS."
            ]
          }
        ]
      },
      {
        "heading": "Loot / Item Generation",
        "items": [
          {
            "title": "Major loot variety expansion",
            "bullets": [
              "Legendary drops can now roll curated 'named' legendaries (area-themed) in addition to procedural names.",
              "Weapons now have small implicit identity traits (e.g., daggers lean crit, spears lean armor pen) to make base types feel more distinct.",
              "Expanded weapon and armor base name pools across styles/slots, increasing overall naming variety.",
              "New multi-stat affixes added for both weapons and armor (e.g., Balanced / Berserking / Bulwark / Quickstep / Sorcerous) to diversify stat profiles.",
              "Rare+ potions can roll hybrid Reprieve Elixirs that restore both HP and your class resource (stackable by tier)."
            ]
          }
        ]
      },
      {
        "heading": "Bug Fixes",
        "items": [
          {
            "title": "Combat HP UI stability",
            "bullets": [
              "Hardened enemy HP percent calculation against divide-by-zero/NaN edge-cases so the fill bar can’t break during corrupted or partially-initialized enemy states."
            ]
          },
          {
            "title": "Inventory power comparison indicator",
            "bullets": [
              "Inventory items that can be compared to equipped gear now show the ▲/▼ power delta in the collapsed header row, not only after expanding the card."
            ]
          },
          {
            "title": "Gear stat effects",
            "bullets": [
              "Speed now contributes to your Dodge chance so Speed bonuses on gear affect combat.",
              "Haste now boosts end-of-round resource regeneration and scales HP Regen ticks.",
              "HP Regen now ticks each round even if you don't attack, making regen gear reliable during defensive play.",
              "Added a Diagnostics → 'Gear Effects Audit' report to compare stats with gear unequipped vs equipped."
            ]
          },
          {
            "title": "HUD & status-line hardening",
            "bullets": [
              "Prevented hero resource bar NaN/Infinity widths when maxResource is 0 (or corrupted), and avoids writing an 'undefined' resource CSS class.",
              "Enemy posture/intent status text now clamps invalid values so the status line can’t display NaN or negative counters.",
              "Enemy panel now hides automatically when an enemy reaches 0 HP, preventing lingering combat UI in rare edge-cases.",
              "Added defensive null-checks around HUD nodes to avoid hard crashes if updateHUD is invoked during partial/early DOM states."
            ]
          },
          {
            "title": "Boot diagnostics now auto-surface early load failures",
            "bullets": [
              "If a script fails to load/parse during startup, the boot diagnostics overlay now pops automatically (instead of silently logging the issue).",
              "bootstrap now marks a successful boot once the game entry module loads, preventing overlays from appearing during normal gameplay."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.7",
    "title": "Class Flush-Out + Combat HUD Meters + Boot Diagnostics",
    "sections": [
      {
        "heading": "Classes & Abilities",
        "items": [
          {
            "title": "New unlock tiers (Lv 9 / Lv 12)",
            "bullets": [
              "Every player class now has additional unlocks at levels 9 and 12 (on top of existing Lv 3 / Lv 6 unlocks).",
              "Unlock table is migration-safe: older saves auto-gain any missing unlocks up to their current level."
            ]
          },
          {
            "title": "Lightweight class mechanics",
            "bullets": [
              "Rogue: Combo Points (Backstab / Poisoned Blade / Shadowstep generate; Eviscerate spends; Vanish boosts).",
              "Meter usability: Rogue Eviscerate now unlocks at Lv 3; Ranger Headshot now unlocks at Lv 3; Shaman Totem Spark now activates the Totem meter.",
              "Ranger: Marks (Twin Arrows / Marked Prey / Hunter's Trap add Marks; Headshot spends; Marks now decay).",
              "Necromancer: Soul Shards + Lich Form sustain hook (shadow hits siphon HP while Lich Form is active).",
              "Shaman: Totem state with timed duration used by Tempest for bonus output."
            ]
          }
        ]
      },
      {
        "heading": "Combat HUD",
        "items": [
          {
            "title": "Class mechanics meter",
            "bullets": [
              "Class meter now appears immediately when an enemy spawns (combat start), before the first player action.",
              "During combat, HUD meta fields (Level/XP, time of day, gold) are hidden to reduce clutter.",
              "All player classes now display a combat meter row in the HUD to visualize their class mechanic or passive state.",
              "Mage: Rhythm (progress toward the next discounted + crit-boosted spell).",
              "Warrior: Bulwark (progress to 40 Fury; shows when the Bulwark bonus is active).",
              "Blood Knight: Blood (5-dot gauge of your Blood resource).",
              "Paladin: Sanctuary (ward/shield state; shows On/Off).",
              "Cleric: Ward (current shield amount).",
              "Necromancer: Shards (Soul Shards gauge).",
              "Rogue: Combo Points (5-dot meter).",
              "Ranger: Marks stacks (dots) and remaining mark turns (shows 0/0t when not applied).",
              "Shaman: Totem type and remaining turns (shows None/0t when inactive so the mechanic is always visible).",
              "Berserker: Frenzy (fills as HP is lost).",
              "Vampire: Hunger (essence threshold indicator for Hungering Vein bonuses).",
              "Character creation: class cards now label each class’s Combat Meter and what it tracks."
            ]
          }
        ]
      },
      {
        "heading": "Removals",
        "items": [
          {
            "title": "Tutorial tips removed",
            "bullets": [
              "Removed the tutorial tip banner system and its Settings toggle per patch feedback.",
              "Removed the remaining merchant modal \"I knew\" tip banner so no tutorial prompts appear anywhere."
            ]
          }
        ]
      },
      {
        "heading": "Diagnostics & Smoke Tests",
        "items": [
          {
            "title": "Boot diagnostics (small/)",
            "bullets": [
              "Added early error capture for window.onerror and unhandledrejection, persisting the last boot failures to localStorage.",
              "Added a screenshot-friendly overlay with Copy Report button to quickly capture why the game failed to start.",
              "Bootstrap now preflights the Future module graph via fetch to flag missing modules before load.",
              "Boot hotfix: entry module paths are resolved relative to index.html (not /small) to avoid broken /small/Future/... paths on boot.",
              "Boot hotfix: preflight is skipped for file:// environments (common on iOS) where fetch(file://...) is frequently blocked."
            ]
          },
          {
            "title": "New smoke tests",
            "bullets": [
              "Added a dedicated smoke test section validating class unlock tables, unlock spell presence, Rogue Combo behavior, Ranger Mark decay, and Combat HUD meter rendering.",
              "Fixed smoke test helpers (createPlayer) so class tests do not depend on DOM-driven new-game flow.",
              "Smoke test runs no longer modify the player's visible log: the live log DOM + renderer bookkeeping are snapshotted and restored after the suite."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.62",
    "title": "Bugfixes + Expanded Smoke Tests",
    "sections": [
      {
        "heading": "Bug Fixes",
        "items": [
          {
            "title": "Version labeling consistency",
            "bullets": [
              "Unified version labeling across in-game UI, bootstrap build label, and README so the displayed patch matches the actual build."
            ]
          },
          {
            "title": "Inventory safety",
            "bullets": [
              "Hardened item add/stack logic by normalizing invalid quantities (NaN/0/negative) to prevent corrupted stacks."
            ]
          },
          {
            "title": "Bank weekly interest edge-case",
            "bullets": [
              "Fixed an initialization edge-case where a negative or invalid lastInterestDay could suppress weekly interest backfill (and fail smoke tests).",
              "Treats null/undefined lastInterestDay as truly uninitialized (avoids Number(null) → 0), and caps excessive catch-up backlogs to prevent runaway compounding on corrupted saves."
            ]
          },
          {
            "title": "Town Hall decree expiry cleanup",
            "bullets": [
              "Expired townHallEffects are removed from state.government so stale modifiers cannot be re-applied by presence checks."
            ]
          }
        ]
      },
      {
        "heading": "Smoke Tests",
        "items": [
          {
            "title": "Bug-catcher coverage",
            "bullets": [
              "Smoke tests now capture console.error / failed console.assert and fail the run if any occur.",
              "Added deep state scans for NaN/Infinity and negative counters after the suite runs.",
              "Added a deterministic fuzz pass (120 randomized actions) that continuously validates invariants and common containers."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.6",
    "title": "Combat Patch 1.1.6: Intent Telegraphs, Posture Break, and Interrupt Counterplay",
    "sections": [
      {
        "heading": "New Combat Features",
        "items": [
          {
            "title": "Enemy Intent Telegraphs",
            "bullets": [
              "Certain high-impact enemy abilities now telegraph before firing, giving the player a clear counterplay window.",
              "Telegraphed moves show up on the enemy status line as an Intent with remaining turns.",
              "Currently telegraphed: Heavy Cleave, Void Breath, Seismic Stomp, Tail Swipe, and Inferno."
            ]
          },
          {
            "title": "New Player Action: Interrupt",
            "bullets": [
              "Added a new combat action button: Interrupt (costs 10 of your current resource).",
              "If the enemy has an Intent, Interrupt cancels it (and staggers non-boss enemies).",
              "If no Intent is present, Interrupt still performs a quick jab to build Posture pressure."
            ]
          },
          {
            "title": "Posture + Break System",
            "bullets": [
              "Player damage now builds enemy Posture; reaching the enemy's Posture cap causes a Break.",
              "Broken enemies lose their action and take increased damage while Broken.",
              "Break also disrupts any pending Intent (telegraphed attack is canceled).",
              "Enemy status line now displays Posture, Broken state, and relevant debuffs."
            ]
          }
        ]
      },
      {
        "heading": "Bug Fixes + Combat Stability",
        "items": [
          {
            "title": "Enemy stun handling",
            "bullets": [
              "Fixed an enemyTurn logic issue where stun could be decremented twice and the tick function's return value was ignored.",
              "Stun/Broken now properly prevent actions and can disrupt pending Intent."
            ]
          },
          {
            "title": "Companion crit stat reference",
            "bullets": [
              "Fixed a crit check referencing a non-existent `p.stats.crit` field; companions now correctly read `p.stats.critChance`."
            ]
          },
          {
            "title": "Enemy attack debuff permanence",
            "bullets": [
              "Fixed attack-down effects that permanently reduced enemy attack.",
              "Attack-down now uses timed debuff fields and a computed effective attack value."
            ]
          },
          {
            "title": "Enemy runtime + Posture break determinism",
            "bullets": [
              "Fixed ensureEnemyRuntime overwriting explicitly provided small enemy ability arrays (including smoke test dummies).",
              "Adjusted posture per-hit capping so very small posture caps used in tests can deterministically trigger Break (normal enemies unchanged)."
            ]
          }
        ]
      },
      {
        "heading": "Smoke Tests",
        "items": [
          {
            "title": "New coverage",
            "bullets": [
              "Added unit smoke tests for telegraph→Intent creation and Interrupt canceling the Intent.",
              "Added a unit smoke test for Posture reaching cap → Break triggering and disrupting Intent.",
              "Expanded combat regression coverage: Intent execution after countdown, Interrupt resource cost/insufficient-resource behavior, Broken damage bonus determinism, forced-guard skip, and enemy atkDown expiry.",
              "Added new smoke tests for cooldown integrity (telegraph commits cooldown even if interrupted) and Interrupt-without-Intent posture pressure.",
              "Added new smoke tests for player status ticking (duration decrements and value clearing), companion empty-ability safety, and enemy death with pending Intent.",
              "Added new smoke tests for equipment non-stacking, safe weapon swaps (no double-apply), and mid-combat save round-trip + forward-compat migration tolerance.",
              "Smoke Tests output now includes a seed line and per-section pass/fail breakdown for faster triage.",
              "Smoke Tests output is now grouped with a pass/fail summary and per-section breakdown, including the deterministic QA seed used.",
              "In dev cheat mode, Smoke Tests are now available via a small \"Tests\" pill next to the Menu button (removed from the Cheat Menu).",
              "In dev cheat mode, Cheats are now accessed via a 🛠️ HUD pill next to 🧪 and the Menu button (removed from the action bar)."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.52",
    "title": "Bug Fix Patch 1.1.52: Merchant Restock, Inventory Safety, and Stability Fixes",
    "sections": [
      {
        "heading": "Bug Fixes",
        "items": [
          {
            "title": "Merchant daily restock",
            "bullets": [
              "Fixed a variable mix-up that prevented daily merchant restocking from running reliably.",
              "Merchant stock buckets now self-clean invalid or removed item keys to prevent 'ghost stock' persisting across patches."
            ]
          },
          {
            "title": "Inventory / equipment edge cases",
            "bullets": [
              "Selling or dropping gear now unequips by exact item instance first, preventing the wrong copy from being unequipped when duplicates exist.",
              "Legacy id-based unequip fallback is now only used when the player has a single copy of that item id, preventing accidental unequips when duplicates exist."
            ]
          },
          {
            "title": "Save compatibility + invariants",
            "bullets": [
              "Added save migration to normalize legacy inventory `qty` fields into `quantity`.",
              "State validator now audits `quantity` (and legacy `qty`) and records mismatches for easier bug reports."
            ]
          },
          {
            "title": "UI / stability hardening",
            "bullets": [
              "Hardened screen switching to avoid crashes if a screen element is missing from the DOM.",
              "Fixed an issue where the Smoke Tests could leave the UI on a blank screen after closing (the screen-guard test now restores prior visibility + audio state).",
              "Loot weighted-picker now safely handles empty/zero-weight tables (returns null instead of throwing or returning undefined).",
              "Expanded the in-game Smoke Tests to cover inventory stacking/consumption, save round-trip + legacy migrations, daily tick idempotence, merchant pruning + purchase flow, loot generation + determinism, and combat sanity (no NaN/HP clamping).",
              "Smoke Tests are now fully sandboxed: they stub UI/combat hooks and restore prior combat state, so tests cannot leave behind dummy enemies, alter real HP, or affect the active save."
            ]
          }
        ]
      },
      {
        "heading": "Versioning",
        "items": [
          {
            "title": "Patch labeling",
            "bullets": [
              "Updated in-game patch/version labels to 1.1.52 (The Blackbark Oath)."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.5",
    "title": "Patch 1.1.5: Expanded Gear Slots + Loot Drops + Bug Fixes",
    "sections": [
      {
        "heading": "Loot & Equipment",
        "items": [
          {
            "title": "New gear slots",
            "bullets": [
              "Added new equippable slots: Head, Hands, Feet, Belt, Neck, and Ring (in addition to Weapon + Body Armor).",
              "All armor pieces now carry a slot tag so the game can equip/compare them correctly."
            ]
          },
          {
            "title": "Loot generator updates",
            "bullets": [
              "Armor drops now roll across the full slot set (Body/Head/Hands/Feet/Belt/Neck/Ring).",
              "Neck and Ring items use an accessory-leaning affix pool that can roll small offensive bonuses without overshadowing weapons."
            ]
          }
        ]
      },
      {
        "heading": "UI / UX",
        "items": [
          {
            "title": "Inventory + character sheet improvements",
            "bullets": [
              "Character Sheet → Equipment tab now displays all gear slots.",
              "Inventory cards label armor by slot (e.g., Head, Ring) and power comparisons only compare within the same slot."
            ]
          },
          {
            "title": "Cheat menu (dev)",
            "bullets": [
              "Spawn Max Loot now generates a full max-level gear set across all slots, and can optionally equip the whole set."
            ]
          }
        ]
      },
      {
        "heading": "Bug Fixes",
        "items": [
          {
            "title": "Stat calculation fixes",
            "bullets": [
              "Fixed player Magic Resistance being applied twice from skills in some cases.",
              "Fixed a boot-time crash caused by a malformed potion function definition in lootGenerator.js."
            ]
          },
          {
            "title": "Equipment edge cases",
            "bullets": [
              "Selling/dropping equipped gear now correctly unequips it from whichever slot it occupies (not just body armor)."
            ]
          }
        ]
      },
      {
        "heading": "Versioning",
        "items": [
          {
            "title": "Patch labeling",
            "bullets": [
              "Updated in-game patch/version labels to 1.1.5 (The Blackbark Oath)."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.42",
    "title": "Patch 1.1.42: Cheat Menu UX Pass + Mobile Layout Fixes + Docs Refresh",
    "sections": [
      {
        "heading": "Cheat Menu",
        "items": [
          {
            "title": "Faster navigation",
            "bullets": [
              "Core Cheats no longer auto-expands when opening the Cheat Menu.",
              "Added quick status pills (Level/HP/etc.) for at-a-glance context while testing.",
              "Improved in-menu ergonomics for rapid multi-step testing (less accidental modal closing)."
            ]
          },
          {
            "title": "Mobile layout + spacing",
            "bullets": [
              "Fixed misaligned button rows inside cheat panels on small screens (notably multi-control rows like Give Item).",
              "Tightened vertical spacing between cheat buttons/controls while preserving the existing UI aesthetic.",
              "Status pills now clamp to a maximum of two rows and automatically scale to fit (no scrolling)."
            ]
          }
        ]
      },
      {
        "heading": "Versioning & Docs",
        "items": [
          {
            "title": "Patch labeling",
            "bullets": [
              "Updated in-game patch/version labels to 1.1.42 (The Blackbark Oath)."
            ]
          },
          {
            "title": "README refresh",
            "bullets": [
              "Expanded README with deeper system overviews, dev/QA workflows, troubleshooting notes, and project structure."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.4",
    "title": "QA & Bug-Squash: Determinism + Smoke Tests + Better Reports",
    "sections": [
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Acceptance & storage hardening",
            "bullets": [
              "Wrapped all localStorage access in safe helpers to avoid crashes when storage is blocked or quota-limited.",
              "Acceptance gating now uses a versioned key and a single shared remove helper.",
              "Feedback / diagnostics flows avoid fatal exceptions when clipboard or storage APIs are unavailable."
            ]
          },
          {
            "title": "State integrity auditing",
            "bullets": [
              "Added a lightweight invariant validator that detects NaN, negative gold, broken HP/resource bounds, and common corruption patterns.",
              "Automatic audits run before save and after load; failures are recorded into the crash report system for easy reproduction."
            ]
          }
        ]
      },
      {
        "heading": "Dev Tools",
        "items": [
          {
            "title": "Deterministic RNG mode (seeded)",
            "bullets": [
              "Optional deterministic randomness for reproducible runs.",
              "RNG logging can be enabled to capture a tagged trail of random draws (useful for replaying ‘rare’ outcomes)."
            ]
          },
          {
            "title": "Smoke tests",
            "bullets": [
              "Added a small in-game smoke test runner that exercises save/load, daily ticks, combat boot-up, and core invariants.",
              "Outputs a copyable report for quick triage when something breaks."
            ]
          },
          {
            "title": "Bug report bundle",
            "bullets": [
              "Added a one-click JSON report (version + save meta + last crash + RNG seed/index + input breadcrumbs).",
              "Includes recent invariant failures to reduce ‘can’t reproduce’ issues."
            ]
          },
          {
            "title": "Spawn & Teleport helpers",
            "bullets": [
              "Teleport to any zone, force a specific enemy encounter, and grant items by id from the Cheat Menu.",
              "Designed to help quickly repro quest locks, economy edge-cases, and combat issues."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.3",
    "title": "Quest Modularization: Quests extracted from engine.js",
    "sections": [
      {
        "heading": "Refactor",
        "items": [
          {
            "title": "Quest system moved into the Quests folder",
            "bullets": [
              "Moved main-quest beats, side-quest events, quest UI rendering, and boss-trigger logic out of engine.js.",
              "Added a small binding adapter so older call sites (like the tavern quest board) can keep using the same quest hook signatures.",
              "No save-schema bump: old saves are backfilled with any missing quest flags on load."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.2",
    "title": "Stability & Diagnostics: Save Safety + Tick Hardening",
    "sections": [
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Storage-safe saves and settings",
            "bullets": [
              "Wrapped localStorage reads/writes in defensive helpers so blocked storage, private browsing, and quota issues don’t crash the game.",
              "Failures now surface as a clear, player-readable warning instead of a silent break."
            ]
          },
          {
            "title": "Corrupt save detection and recovery flow",
            "bullets": [
              "Hardened migration/loading so malformed saves are detected early.",
              "Added a ‘Save Error’ UI path that offers reset options instead of booting into a broken state."
            ]
          },
          {
            "title": "Crash report persistence",
            "bullets": [
              "Best-effort persistence of the last crash report so it can be included in Feedback even after reload."
            ]
          },
          {
            "title": "Modal ownership + lock enforcement",
            "bullets": [
              "Acceptance / blocking modals now claim ownership and lock closing behaviors so other UI code can’t accidentally dismiss them.",
              "Prevents overlay-click / Escape inconsistencies across browsers and mobile."
            ]
          }
        ]
      },
      {
        "heading": "Simulation / Balance",
        "items": [
          {
            "title": "Daily tick normalization",
            "bullets": [
              "Day indices are normalized to non-negative integers before running catch-up ticks to prevent double-application or off-by-one edge cases."
            ]
          },
          {
            "title": "Economy metric rounding + clamps",
            "bullets": [
              "Village economy drift now rounds to integers after applying drift and clamps to expected ranges to avoid float jitter in tier thresholds and UI."
            ]
          }
        ]
      },
      {
        "heading": "Dev Tools",
        "items": [
          {
            "title": "Progression Auditor",
            "bullets": [
              "Added a diagnostics report to help find stuck progression: quest steps, unlock flags, boss defeats, and contradictions with copy-to-clipboard output."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.1",
    "title": "Blackbark Balance: Combat Fixes + Scaling Pass",
    "sections": [
      {
        "heading": "Fixes",
        "items": [
          {
            "title": "Enemy magic damage now mitigates correctly",
            "bullets": [
              "Fixed enemy spell/elemental attacks being treated as physical mitigation in several AI/ability paths.",
              "Player magical resistance now exists in baseline stat recalculation so casters are resistible without relying on a specific affix."
            ]
          },
          {
            "title": "Resist All is now actually applied",
            "bullets": [
              "Resist All gear affix now reduces incoming damage as intended."
            ]
          },
          {
            "title": "Resource potions respect class resource",
            "bullets": [
              "Fury/Mana/Blood/Essence restoratives no longer restore the wrong resource type when used by another class."
            ]
          },
          {
            "title": "Element naming normalized",
            "bullets": [
              "Ice effects now use the same 'frost' element label as loot affixes."
            ]
          },
          {
            "title": "On-hit element pass-through",
            "bullets": [
              "On-hit passives that depend on element type (ex: Necromancer tithe) now work on basic attacks."
            ]
          }
        ]
      },
      {
        "heading": "Combat & Balance",
        "items": [
          {
            "title": "Zone scaling tuned down slightly",
            "bullets": [
              "Reduced late-zone HP/ATK/DEF growth to prevent drawn-out fights while keeping difficulty meaningful."
            ]
          },
          {
            "title": "Crit swinginess reduced",
            "bullets": [
              "Lowered baseline crit chances slightly to reduce early-fight volatility."
            ]
          },
          {
            "title": "Vulnerable debuff now matters",
            "bullets": [
              "Vulnerable increases incoming damage while active, making enemy setup abilities more readable and impactful."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.1.0",
    "title": "Oathbound Arsenal: Class Engines, Loadouts, and Upgrades",
    "sections": [
      {
        "heading": "New / Systems",
        "items": [
          {
            "title": "Class Engines (Passives + Resource Identity)",
            "bullets": [
              "Added lightweight class passives that shape combat rhythm without bloating the UI.",
              "Mage: every 3rd spell is discounted and gains crit; Warrior: Bulwark at high Fury; Blood Knight: Crimson Exchange; Vampire: Hungering Vein."
            ]
          },
          {
            "title": "Spell Loadouts",
            "bullets": [
              "Equip up to 4 abilities for combat; in-fight casting is restricted to your equipped kit.",
              "Loadouts auto-clean if a spell is removed and auto-fill from known spells when needed."
            ]
          },
          {
            "title": "Ability Upgrades",
            "bullets": [
              "Earn upgrade tokens on level-up and invest them into abilities (Tier 1–3).",
              "Choose a path per ability: Potency (+effect) or Efficiency (-cost)."
            ]
          },
          {
            "title": "Class Spell Progression",
            "bullets": [
              "Each class now unlocks new abilities at levels 3 and 6.",
              "Older saves migrate forward and receive any missed unlocks based on current level."
            ]
          }
        ]
      },
      {
        "heading": "Combat & Balance",
        "items": [
          {
            "title": "Chilled is now a real debuff",
            "bullets": [
              "Chilled reduces enemy outgoing damage while active and ticks down cleanly."
            ]
          },
          {
            "title": "Companion boon is now functional",
            "bullets": [
              "Companion ‘empower’ boon now correctly boosts your next action and is consumed/expired properly."
            ]
          },
          {
            "title": "Fight-scoped status cleanup",
            "bullets": [
              "Temporary shields/buffs/boons reset at combat start/end to prevent between-fight carryover."
            ]
          }
        ]
      },
      {
        "heading": "UI / UX",
        "items": [
          {
            "title": "Spellbook panels",
            "bullets": [
              "Reworked the Spells & Abilities screen into a two-panel layout (list + details) for faster browsing and a cleaner look.",
              "Details panel shows cost, upgrade tier/path, and contextual actions (Use / Equip / Upgrade)."
            ]
          }
        ]
      },
      {
        "heading": "Fixes",
        "items": [
          {
            "title": "Twin Arrows now triggers on-hit effects",
            "bullets": [
              "Life Steal and other on-hit hooks now apply per arrow."
            ]
          },
          {
            "title": "Player buffs no longer stick forever",
            "bullets": [
              "Key buff abilities now apply durations, and combat-only buffs are cleared reliably."
            ]
          },
          {
            "title": "Save migration hardened",
            "bullets": [
              "Schema migration updated to add loadouts, upgrades, and new status fields without breaking older saves."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.9",
    "title": "Bugfix Patch: Settings Defaults, Economy Tick Init, and Log ID Consistency",
    "sections": [
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Volume and text speed now respect defaults on a fresh install",
            "bullets": [
              "Fixed a localStorage parsing edge case where missing keys were interpreted as 0, muting audio and forcing minimum text speed on first launch."
            ]
          },
          {
            "title": "Village economy day tick initialization is consistent",
            "bullets": [
              "Economy state now starts with lastDayUpdated = null (like population), preventing accidental day-0 tick skips in catch-up or debug flows."
            ]
          },
          {
            "title": "Log entries start at ID 1 in new runs",
            "bullets": [
              "Adjusted the initial log sequence counter so the first entry is ID 1 (no gameplay impact, but keeps IDs intuitive and consistent)."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.8",
    "title": "Bugfix Patch: Quest Board Availability, Feedback Modal Hardening, and Bank Interest Logging Safety",
    "sections": [
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Completed side quests no longer reappear on the tavern board",
            "bullets": [
              "Side quests are now offered only if they have never been started, preventing completed quests from being re-listed."
            ]
          },
          {
            "title": "Bank weekly-interest logging is now optional-safe",
            "bullets": [
              "Interest application no longer assumes an addLog callback exists, preventing errors if reused from non-UI code paths."
            ]
          },
          {
            "title": "Feedback copy handler is more defensive",
            "bullets": [
              "Clipboard copy now safely aborts if modal DOM nodes are missing, preventing rare crashes during UI refactors."
            ]
          },
          {
            "title": "Version labels are consistent across launcher + docs",
            "bullets": [
              "Bootstrap and README patch labels now match the in-game build version."
            ]
          },
          {
            "title": "Developer docs reference the correct entry file",
            "bullets": [
              "Updated the User Acceptance install snippet to reference bootstrap.js instead of a non-existent Core/game.updated.js."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.7",
    "title": "Systems Polish: Town Summary, Decree Economy Drift, Bank Rate Breakdown, and Gambling UX",
    "sections": [
      {
        "heading": "New / Improved",
        "items": [
          {
            "title": "Town Summary after resting",
            "bullets": [
              "Resting at the tavern now opens a Town Summary card showing economy tier, villager mood changes, active decree time remaining, and bank week progress."
            ]
          },
          {
            "title": "Town Hall decrees nudge the economy",
            "bullets": [
              "Active decrees can add small daily deltas to Prosperity/Trade/Security, making decree choices visible in day-to-day drift.",
              "The economy stores a daily breadcrumb describing decree nudges for summary UI."
            ]
          },
          {
            "title": "Bank rate breakdown",
            "bullets": [
              "Bank now includes a collapsible breakdown showing base rates, tier adjustments, and active decree multipliers."
            ]
          },
          {
            "title": "Tavern games UX",
            "bullets": [
              "Added Luck/Heat meters, guidance text, and stronger max-bet enforcement to prevent out-of-range wagers."
            ]
          },
          {
            "title": "Dev cheat: fast-forward days",
            "bullets": [
              "Cheat Menu now includes +1/+3/+7 day fast-forward buttons with a printed summary of economy, mood, decree, and bank progress changes."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.6",
    "title": "Bugfix Patch: Quest Panel Chevron, Scroll-Safe Log, Mobile Viewport Height, and Panel A11y",
    "sections": [
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Quest panel header chevron is preserved",
            "bullets": [
              "Fixed updateQuestBox() so it no longer overwrites the Quest header DOM (which previously deleted the chevron).",
              "Quest header now uses an internal title span so future updates won’t break collapse UX."
            ]
          },
          {
            "title": "Quest chevron color matches the quest border",
            "bullets": [
              "Quest panel now defines a --quest-border variable used by the border, header text, and chevron for consistent styling."
            ]
          },
          {
            "title": "Log panel no longer yanks the scroll position",
            "bullets": [
              "renderLog() now only auto-scrolls when the player is already near the bottom, preserving reading position when scrolled up."
            ]
          },
          {
            "title": "Mobile-safe viewport sizing",
            "bullets": [
              "Replaced critical 100vh sizing with 100dvh where supported to avoid UI cutoffs from mobile browser address bars.",
              "Modal max-height now also uses dvh for better fit on mobile."
            ]
          },
          {
            "title": "Collapsible panels are now keyboard friendly",
            "bullets": [
              "Quest and Log headers now support Enter/Space to collapse/expand and expose aria-expanded state.",
              "Collapse listeners are wired idempotently to prevent duplicate handlers."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.5",
    "title": "Bugfix Patch: Settings UI, Log Panel, Safety Helpers, and Packaged Audio",
    "sections": [
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Audio assets now ship with the build",
            "bullets": [
              "Added Future/Audio with default WAV files so ambient/music/sfx paths no longer 404 in the browser.",
              "Music/SFX toggles now apply mute gains immediately when changed."
            ]
          },
          {
            "title": "Settings screen hardening",
            "bullets": [
              "Added a Difficulty selector to the Settings screen (easy/normal/hard/dynamic).",
              "Settings event listeners are now wired idempotently, preventing duplicated handlers when opening Settings multiple times.",
              "Text Speed now applies live via slider input changes."
            ]
          },
          {
            "title": "Log panel collapse + filter UX",
            "bullets": [
              "Added a Log header with chevron and proper collapse behavior.",
              "Log filter chips now hydrate their active highlight on load."
            ]
          },
          {
            "title": "Bootstrap version picker highlight",
            "bullets": [
              "The currently selected version is now visibly highlighted in the version picker."
            ]
          },
          {
            "title": "Numeric safety helpers unified",
            "bullets": [
              "Removed duplicate finite/clamp helper implementations and now import them from Systems/safety.js to reduce drift."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.4",
    "title": "Bugfix Patch: Save Slots, Time Normalization, Bank Interest Guards, and Pause→Changelog Back Button",
    "sections": [
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Random Name button reliability",
            "bullets": [
              "Fixed Random Name to target the input field via DOM lookup instead of relying on a global ID variable."
            ]
          },
          {
            "title": "Manual save slots always capture the latest state",
            "bullets": [
              "Slot saves now force-flush the autosave coalescing queue so manual saves never lag behind recent actions."
            ]
          },
          {
            "title": "Time system now normalizes stored time values",
            "bullets": [
              "state.time.dayIndex and state.time.partIndex are now clamped and written back to state to prevent persistent corruption from NaN/Infinity/out-of-range values."
            ]
          },
          {
            "title": "Bank weekly interest hardening",
            "bullets": [
              "Bank interest now treats non-finite dayIndex / lastInterestDay as day 0 and safely re-initializes or recalibrates.",
              "Prevents weekly interest from silently breaking when day counters become NaN."
            ]
          },
          {
            "title": "Settings initialization cleanup",
            "bullets": [
              "Removed a duplicate applyChannelMuteGains() call during settings hydration."
            ]
          },
          {
            "title": "Pause menu → Changelog UX",
            "bullets": [
              "Changelog opened from the pause menu now shows a Back button that returns to the Game Menu instead of effectively unpausing on close."
            ]
          },
          {
            "title": "Town Hall decree cleanup on load",
            "bullets": [
              "Expired decrees are cleared once on save-load so stale decree fields don't linger when a player loads and doesn't advance days."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.3",
    "title": "Final Pre-1.1.0 Cleanup: Save/Modal A11y, Daily Tick Catch-up, and Branding Consistency",
    "sections": [
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Daily ticks now catch up safely",
            "bullets": [
              "If multiple in-game days are skipped (rest chains, tab suspension, or fast-forward), the daily tick pipeline now replays missed days up to a safe cap.",
              "Daily tick progress is tracked in state.sim.lastDailyTickDay to prevent double-running and to support stable catch-up behavior."
            ]
          },
          {
            "title": "Save system is quieter and more stable",
            "bullets": [
              "Autosaves are now de-duplicated and coalesced to reduce localStorage churn and mobile stutter.",
              "Merchant restock meta (merchantStockMeta) and simulation meta (sim) are now persisted and migrated in the save schema."
            ]
          },
          {
            "title": "Town Hall decree cleanup is pure-read for UIs",
            "bullets": [
              "Bank and rest-cost calculations no longer mutate decree state while rendering; decree cleanup happens in the daily tick pipeline."
            ]
          }
        ]
      },
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Modal reliability and accessibility",
            "bullets": [
              "Modals now close with Escape and trap focus while open, restoring focus back to the opener on close.",
              "Extra leaked tavern footer actions are removed on both open and close to prevent hidden interactive elements."
            ]
          },
          {
            "title": "Merchant stock safety",
            "bullets": [
              "Merchant stock generation no longer assumes state.player exists (prevents crashes during early init or corrupted saves)."
            ]
          },
          {
            "title": "Time display and branding cleanup",
            "bullets": [
              "Added a HUD time label for the existing updateTimeDisplay() hook.",
              "Removed lingering 'Pocket Quest' / 'Project: Mystic' naming in UI strings and stylesheet headers."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.2",
    "title": "Economy & UI Polish: Decree Cleanup, Merchant Restock, and Tick Guards",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Merchant daily restock",
            "bullets": [
              "Village and wandering merchant stock now replenishes slowly each in-game day so shops don't become permanently empty."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Town Hall decree cleanup is centralized",
            "bullets": [
              "Other systems no longer delete state.government.townHallEffects; expired decrees are cleared in-place to keep the object shape stable for the Town Hall UI.",
              "Expired decrees are cleared in-place via a shared helper so the object shape remains stable for the Town Hall UI."
            ]
          }
        ]
      },
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Price and tick guardrails",
            "bullets": [
              "Wandering-merchant price multiplier is now clamped after its road-risk bump so it can't exceed intended ceilings.",
              "Village population day tick now guards against double-running the same day (prevents mood drift from applying twice).",
              "Town Hall daily tick now guards against double-running the same day (keeps petition timelines consistent)."
            ]
          },
          {
            "title": "Banking edge cases",
            "bullets": [
              "Weekly interest now clamps negative calendar deltas (save rollback/dev tools) so interest can't get stuck.",
              "A one-time ledger note explains weekly-interest initialization the first time you open the bank after updating."
            ]
          },
          {
            "title": "Merchant coverage",
            "bullets": [
              "Essence-based heroes now see their correct resource potion in merchant stock.",
              "Alchemists now carry Essence potions."
            ]
          },
          {
            "title": "Tavern games footer cleanup",
            "bullets": [
              "Pinned tavern-games footer actions are now removed on modal close to prevent UI leakage across modals."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.1",
    "title": "Stability Pass: Save Schema, Crash Reports & Log Performance",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Save schema + migrations",
            "bullets": [
              "Saves now include a meta.schema field so future updates can migrate older saves safely.",
              "Automatic backfills for missing blocks (time, village economy, government, bank, merchant stock/names) when loading older saves."
            ]
          },
          {
            "title": "Crash catcher (for better bug reports)",
            "bullets": [
              "Unhandled errors and promise rejections are captured and attached to the Feedback / Bug Report payload.",
              "Feedback now includes patch, schema, and the last 30 log lines to make reproduction easier."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Log rendering performance",
            "bullets": [
              "Game log rendering is now incremental to reduce DOM churn during long sessions.",
              "Loading a save forces a clean rebuild of the log UI to avoid filter/render mismatches."
            ]
          },
          {
            "title": "Version label is now driven by GAME_PATCH",
            "bullets": [
              "Main menu version label is set at runtime so it stays consistent across builds."
            ]
          }
        ]
      },
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Numeric guardrails",
            "bullets": [
              "Added NaN/Infinity clamps for core values (HP, resource, gold, enemy HP) to prevent state corruption.",
              "Village economy + merchant purchase flows now sanitize gold and multipliers defensively."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "1.0.0",
    "title": "Full Release: Core Systems Locked-In",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Full village simulation loop",
            "bullets": [
              "Village economy now influences merchant prices, tavern rest costs, and bank rates.",
              "Kingdom Government and Town Hall systems introduce decrees that temporarily nudge the economy."
            ]
          },
          {
            "title": "Banking and finance",
            "bullets": [
              "Village Bank supports savings, investments, and loans with weekly interest tied to the in-game calendar."
            ]
          },
          {
            "title": "Merchants and persistent stock",
            "bullets": [
              "Village merchants now have per-run shop names and limited stock that can sell out.",
              "Traveling merchant events support a separate wandering context for pricing flavor."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Save / load reliability",
            "bullets": [
              "Expanded save data coverage for time, economy, government, banking, and merchant persistence.",
              "Improved mid-combat resume behavior and log restoration."
            ]
          }
        ]
      },
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "UI and modal consistency",
            "bullets": [
              "Improved modal cleanup across different features to prevent layout bleed.",
              "Changelog and Feedback tools are available directly from the main menu."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.9.0",
    "title": "UI Polish, Combat Tuning & Quality-of-Life",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "More combat clarity",
            "bullets": [
              "Improved combat log messaging for critical hits, shields, and lifesteal effects.",
              "New log filter chips let you quickly focus on system, danger, or positive events."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Balance and pacing",
            "bullets": [
              "Ability damage and resource costs have been tuned to keep spell/ability use feeling rewarding.",
              "Tavern rest and economy tick integration standardized so day progression is consistent."
            ]
          }
        ]
      },
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Mobile and layout fixes",
            "bullets": [
              "Improved responsive layout handling for smaller screens and modal-heavy flows.",
              "Assorted UI alignment fixes and minor bug cleanups."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.8.0",
    "title": "Bootstrap Version Picker & Audio Settings Controls",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Multi-build version picker (bootstrap loader)",
            "bullets": [
              "New bootstrap loader dynamically injects the selected game entry module at runtime.",
              "Added a Change Version button on the main menu to swap between Main and a preserved Prior Patch v0.7.0 build.",
              "Supports selecting builds via a ?v= query param and persists the choice to local storage for future launches.",
              "Includes recovery UX: if a build fails to load, the picker re-opens so players/devs can switch builds."
            ]
          },
          {
            "title": "Audio settings toggles (Music / SFX) + persistence",
            "bullets": [
              "Settings now include Music and SFX enable toggles alongside Master Volume.",
              "Audio preferences are saved to local storage and apply immediately without requiring a reload."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "User Acceptance gating is now hard-locked",
            "bullets": [
              "Acceptance modal blocks closing via ✕, overlay click, and ESC while the gate is active.",
              "Clicks on New Game / Load Game / Begin Adventure are intercepted until both documents are accepted."
            ]
          },
          {
            "title": "Settings now actively drive audio runtime state",
            "bullets": [
              "Master volume and channel mute state are applied during settings hydration and on-change.",
              "Music/SFX toggles update live audio behavior immediately."
            ]
          }
        ]
      },
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Modal cleanup for cross-feature UI",
            "bullets": [
              "Acceptance modal clears stray footer elements from other flows to prevent modal bleed and layout conflicts."
            ]
          },
          {
            "title": "Bootstrap fallback on load failure",
            "bullets": [
              "If the selected build fails to load, the version picker opens so the user can recover by selecting another build."
            ]
          }
        ]
      },
      {
        "heading": "Dev Notes",
        "items": [
          {
            "title": "Version string consistency sweep",
            "bullets": [
              "Align GAME_PATCH, README 'Current patch', and the main menu version label to 0.8.0 for a clean release."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.7.0",
    "title": "Court History, Audio Pass & In-Game Changelog",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Town Hall decree history & council lifecycle",
            "bullets": [
              "Town Hall now records a full decree history: each enacted decree is stored with its title, start day, and expiry day.",
              "The Town Hall view includes a collapsible “Prior Decrees” section that lists recent policies and whether they are still active.",
              "Village councils no longer last forever: councillors can die, retire, or be recalled, with temporary recess periods and realm-appointed replacements filling empty seats.",
              "Daily Town Hall ticks now run a dedicated membership step that can reshuffle the council and log notable changes in the court log."
            ]
          },
          {
            "title": "Government overview: economy and court recap cards",
            "bullets": [
              "The Government / Realm overview panel has a richer village card that explicitly shows the effective Prosperity, Trade, and Security values other systems actually read.",
              "A new “Recent Decrees & Events” card summarizes the last few government history entries, including the day they occurred and a short description of what changed.",
              "If no history exists yet, the government view explains that the royal scribes have not recorded any notable decrees, instead of leaving the card blank."
            ]
          },
          {
            "title": "Basic audio & ambience (music + door SFX)",
            "bullets": [
              "Introduced a lightweight audio controller with a looping daytime ambience track for Emberwood village.",
              "A new updateAreaMusic helper runs on time advancement, swapping music based on current area and time of day (village mornings currently use the new ambience track).",
              "Visiting the Tavern or Bank now plays a wooden door open sound effect, giving those screens a bit more tactile feedback."
            ]
          },
          {
            "title": "In-game Changelog viewer",
            "bullets": [
              "New Changelog modal wired off the main menu and in-game menu that renders the CHANGELOG data directly in-game.",
              "Each version appears as a collapsible <details> block, with headings for Added / Changed / Fixed / Dev Notes and nested bullet lists.",
              "The most recent entry opens by default so players immediately see what changed in the latest patch."
            ]
          },
          {
            "title": "User Acceptance & Legal gating",
            "bullets": [
              "Added a dedicated userAcceptance module that blocks play until the user accepts both a User Acceptance panel and a Legal Notice panel.",
              "Each panel has its own scroll box and its own checkbox; checkboxes remain disabled until that panel has been scrolled to the bottom.",
              "Acceptance is stored in local storage under a versioned key, and ACCEPTANCE_VERSION can be bumped to force re-acceptance after changing the text."
            ]
          },
          {
            "title": "Character sheet & companion polish",
            "bullets": [
              "The Character Sheet now includes a World Time line alongside Location, showing the current in-world day and time in a compact format.",
              "New companion options such as Falcon, Familiar, and Mimic are available through the companion summon UI, rounding out the roster with more specialized flavors.",
              "The Character Sheet is now formally accessible from combat via a dedicated Character button, making it easier to inspect stats mid-fight."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Save / load aware of government, village & merchants",
            "bullets": [
              "Save data has been extended again to include village state, bank state, full time + villageEconomy blocks, kingdom government state, and persistent merchant stock / names.",
              "Load logic restores all of these blocks when present and re-initializes time, economy, and government for older saves that pre-date the newer systems.",
              "Combat, log entries, and the current log filter mode are all restored on load, with an explicit log line calling out which enemy you are currently fighting if you resume mid-battle."
            ]
          },
          {
            "title": "Tavern, bank & realm tick integration",
            "bullets": [
              "Tavern rest flows now call into the same daily tick pipeline used elsewhere, ensuring economy, government, Town Hall, and population all advance consistently when you sleep.",
              "Bank visits continue to apply any pending weekly interest based on the in-game calendar and the current village economy, with updated rates reflecting active royal decrees.",
              "Random wandering merchants now use a dedicated context when opening the merchant modal, allowing their prices and flavor text to diverge from the core village shop while still sharing the same stock logic."
            ]
          },
          {
            "title": "Government & Town Hall UI clarity",
            "bullets": [
              "Village entries in the government view now show both the crown’s influence modifiers and the raw economy numbers used by the rest of the simulation.",
              "The Town Hall modal highlights active decrees separately from prior ones, making it easier to see which policies are currently shaping interest rates and rest prices.",
              "Council and decree tooltips have been tuned to better explain how daily ticks, popularity, and ideology influence petition outcomes."
            ]
          }
        ]
      },
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Resilience for older saves",
            "bullets": [
              "Loading saves created before the Town Hall, government, or merchant systems now safely backfills missing state blocks instead of failing silently.",
              "Guard-turn and combat status fields are normalized on load to prevent edge cases where enemies could resume in a partially initialized state.",
              "Log rendering after load replays the restored entries and filter correctly so the game log view always reflects what was persisted."
            ]
          }
        ]
      },
      {
        "heading": "Dev Notes",
        "items": [
          {
            "title": "Changelog + acceptance plumbing",
            "bullets": [
              "The CHANGELOG array is now the single source of truth for both the external changelog file and the in-game Changelog modal; keep 0.7.0 at the top so it renders first.",
              "ACCEPTANCE_VERSION in userAcceptance.js is currently set to 5.0.0; bump this when materially changing the User Acceptance or Legal Notice copy to force players to re-acknowledge."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.6.0",
    "title": "Town Hall Petitions, Active Decrees & Population Mood",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Town Hall + Council petition system",
            "bullets": [
              "New Town Hall modal (petitions + council voting).",
              "Petitions resolve via popular support + council vote on day ticks.",
              "17 petition types that can trigger short-lived decrees (3-day duration).",
              "Decrees generate townHallEffects (bank-rate multipliers + rest-cost multiplier)."
            ]
          },
          {
            "title": "Vampire hero class",
            "bullets": [
              "New Vampire class that uses a unique Essence resource instead of traditional Mana.",
              "Three signature abilities: Essence Drain (lifesteal + resource gain), Bat Swarm (damage + bleed), and Shadow Veil (temporary damage reduction).",
              "Essence has its own max pool, regeneration rules, potions, HUD color, and starting loadout."
            ]
          },
          {
            "title": "Village population simulation",
            "bullets": [
              "New villagePopulation system (population size + mood + daily drift).",
              "Daily tick integration with safeguards against double-updating the same day."
            ]
          },
          {
            "title": "Gambling Hall improvements",
            "bullets": [
              "Added Max Bet quick-control ('Max bet pill').",
              "Added gamblingDebug payout multiplier hook for testing/tuning."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Economy summary now returns government-adjusted values",
            "bullets": [
              "Prosperity/security/trade are exposed as adjusted (raw values remain internal)."
            ]
          },
          {
            "title": "Rest and Bank now respect active decrees",
            "bullets": [
              "Rest cost applies restCostMultiplier from townHallEffects (with expiry cleanup).",
              "Bank deposit/invest/loan rates apply decree multipliers (with expiry cleanup)."
            ]
          }
        ]
      },
      {
        "heading": "Fixed / Stability",
        "items": [
          {
            "title": "Decree cleanup and tick consistency",
            "bullets": [
              "Expired townHallEffects are removed to prevent lingering bonuses.",
              "Day-tick pipeline now consistently processes economy/government/town hall/population."
            ]
          }
        ]
      },
      {
        "heading": "Dev Notes",
        "items": [
          {
            "title": "Version bump",
            "bullets": [
              "Update GAME_PATCH in game.js from 0.5.0 to 0.6.0."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.5.0",
    "title": "Royal Finance Decrees + Save Manager 2.0",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "PENDING: Royal finance decrees that bend interest rates",
            "bullets": [
              "The king can now issue short-lived finance decrees that temporarily boost or penalize savings, investments, or loan rates across the realm.",
              "Each active decree exposes a set of modifiers that feed directly into the bank's interest calculations, allowing rates to spike during stimulus or tighten under austerity.",
              "The government view now shows when a finance decree is active and when it will expire, so you can time deposits, investments, and loan payments around royal policy."
            ]
          },
          {
            "title": "Grouped save manager",
            "bullets": [
              "The Save / Load screen now groups saves by hero ID, so all runs for the same character collapse under a single expandable panel instead of flooding the list.",
              "Each group header shows hero name, class, level, and last played location, along with how many manual and auto saves exist for that hero.",
              "Inside a group, individual rows display patch version, save type (manual vs auto), and a compact timestamp, with load and delete actions on each slot."
            ]
          },
          {
            "title": "Cheat menu 2.0",
            "bullets": [
              "Rebuilt the developer cheat menu into a structured modal that mirrors the changelog UI, with collapsible sections (Core, Economy, Companions, Debug) instead of a flat wall of buttons.",
              "Each cheat section header uses the same pill-like header style and chevron affordance as the changelog sections, making it obvious that the panel can expand or collapse.",
              "Cheats remain gated behind the Dev Cheats pill on the title screen, but are now much easier to scan and toggle once unlocked."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Bank interest pipeline wired to government & economy",
            "bullets": [
              "Bank interest now starts from base rates, then layers in village economy modifiers (prosperity, stability, crime) and finally applies any active royal finance decree multipliers.",
              "Weekly interest summaries can call out when a royal decree has modified your returns or costs, so you can see how much policy helped or hurt your wallet.",
              "Internal helpers like getCurrentRates and getBankRateModifiers centralize the finance math used for savings, investments, and loans."
            ]
          },
          {
            "title": "Save slot visual polish",
            "bullets": [
              "Save slot rows now use the same rounded card style, muted text, and spacing language as other panels (changelog, logs, etc.).",
              "The Save / Load panel is less cramped, with tighter metadata lines and consistent small-button styling for load and delete actions.",
              "Auto-saves and manual saves are visually distinguished without overwhelming the primary 'continue this run' path."
            ]
          }
        ]
      },
      {
        "heading": "Fixed",
        "items": [
          {
            "title": "Gold display and tavern rest edge cases",
            "bullets": [
              "Resolved desync issues where the HUD gold count could drift from your true gold after banking or tavern transactions.",
              "Sleeping at the tavern now reliably deducts the room cost, logs the rest event, advances time, and returns you to the main screen.",
              "Government and economy daily ticks are guaranteed to fire when you end the day via tavern rest, keeping realm metrics and interest rates up to date."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.4.6",
    "title": "Kingdom Government & Realm Integration",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Autonomous kingdom government system",
            "bullets": [
              "Introduced a dedicated government module that creates an overworld realm (Kingdom of Emberfall) with a monarch, optional spouse, and children, plus a 7-member royal council with roles like Chancellor, Marshal, Spymaster, and Archmage.",
              "Government tracks realm-level metrics such as stability, prosperity, royal popularity, and corruption, and evolves them over time using daily policy-driven drift and occasional royal decrees.",
              "Villages now have their own leadership attitude toward the crown (loyalty, fear, unrest) plus prosperity/safety modifiers that can be read by other systems for tuning difficulty, prices, and events."
            ]
          },
          {
            "title": "Realm & Council overview panel",
            "bullets": [
              "Added a Realm & Council panel that lets you inspect the current monarch, spouse (if any), heirs, and all 7 councilors with their roles, ideology, loyalty, and mood.",
              "The panel also shows the realm’s current stability / prosperity / popularity / corruption scores side-by-side with Emberwood Village’s current prosperity, trade, and security so you can see how the overworld is shaping local conditions.",
              "Realm & Council is now accessed from the main in-game Actions bar instead of the main menu, making political information feel like a core, always-available gameplay system."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Government-driven economy integration",
            "bullets": [
              "Village economy summaries now use government-adjusted prosperity / trade / security values so all downstream systems (bank interest, merchant prices, rest costs, and other village logic) see the same “effective” numbers instead of raw underlying stats.",
              "Government influence is applied as gentle prosperity/safety modifiers per village, then clamped to whole-number 0–100 ranges so HUDs and tooltips stay clean and readable.",
              "The government simulation is wired into the existing in-game time system and advances once per in-game day, alongside the village economy tick, keeping political changes and economic shifts in sync."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.4.5",
    "title": "Merchants 2.0, Weekly Banking & Tavern Games",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Village merchant hub & shop personalities",
            "bullets": [
              "Replaced the single village merchant with a full market square hub of four themed shops: blacksmith, arcanist, alchemist, and general provisioner, each with its own icon, tagline, and flavor text.",
              "Each merchant now gets a randomized in-world shop name (e.g., “Brightforge Smithy”, “Starfall Tomes”) chosen from a per-merchant name pool and stored on the save so it stays consistent for that playthrough.",
              "Village merchants stock only category-appropriate items (weapons/armor, magic gear, potions, general supplies) and traveling merchants pull a smaller, resource-aware selection tailored to your class resource (mana, fury, or blood).",
              "Merchant stock is now limited and persisted per playthrough: each item has a finite quantity, can sell out, and stock levels are saved and restored with your game state."
            ]
          },
          {
            "title": "Merchant UI clarity & feedback",
            "bullets": [
              "Shop screens now include a live “Your gold: Xg” line that updates immediately as you buy items, so you always know what you can afford.",
              "Each item row shows its effective price after economy modifiers plus a dedicated “In stock: N” label that ticks down as you purchase copies.",
              "Buy buttons now clearly show when you can’t purchase an item: they disable and change text to “Need Xg” when you don’t have enough gold, or “Sold out” when the shop has no remaining copies."
            ]
          },
          {
            "title": "Weekly banking & ‘since you were away’ summary",
            "bullets": [
              "The Emberwood Bank now tracks an absolute in-world calendar day via the time system and stores the last day interest was applied, enabling true weekly banking instead of per-visit interest.",
              "Defined a 7-day banking week: when you visit the bank, it computes how many full weeks have passed since your last interest tick and applies interest that many times with compounding to savings, investments, and outstanding loans.",
              "Added a dedicated “Emberwood Market Snapshot” card at the top of the bank screen that shows current prosperity/trade/security plus the weekly interest rates for savings, investments, and loans.",
              "If any full weeks have passed, a “Since you were away” card summarizes total interest earned on savings and investments and total loan interest added across all missed weeks so you can see what happened while you were off adventuring."
            ]
          },
          {
            "title": "Tavern games expansion & presentation",
            "bullets": [
              "Rebuilt the Tavern Games flow into its own ES6 module with a bank-style multi-card layout: tavern intro, current game summary, game selector, stake controls, and last-round recap live in one cohesive modal.",
              "Expanded the gambling lineup beyond Dice Duel, High Card, and Coin Toss with three new fantasy games: Dragonbone Dice (swingy 3d6 hoard chasing), Lucky Runes (tiered rune draws with jackpots), and Elemental Wheel (very swingy elemental spins).",
              "Game selection now uses pill-style buttons that fit their text within the pill and highlight the currently chosen game with a clear selected border; switching games automatically de-selects the old pill and updates the table description.",
              "Introduced patron personalities for the tavern tables (e.g., Mira the Cardsharp, Old Bram); the game tracks which patron you’re playing with and how long you’ve been at their table, adding mood-based flavor lines to wins, losses, and pushes."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Banking cadence & economy integration",
            "bullets": [
              "Bank interest is now applied weekly based on state.time.dayIndex instead of every time you open the bank, using a configurable 7-day banking week for consistent behavior regardless of how often you visit Emberwood.",
              "Savings, investment, and loan rates remain driven by the village economy (prosperity, trade, security, and tier) but are now explicitly labeled as weekly rates in the UI, with small tags on each section showing X% / week.",
              "Bank account overview has been reshaped into a grid card (On hand, Savings, Invested, Loan balance) that mirrors the stat-grid presentation used elsewhere, making balances easier to scan at a glance."
            ]
          },
          {
            "title": "Tavern service layout",
            "bullets": [
              "The Emberwood Tavern screen has been refactored into its own ES6 module using the same card/row layout as the bank, with dedicated rows for renting a room, listening for rumors, and launching Tavern Games from the village hub.",
              "Resting now more clearly describes that it jumps time to the next morning, fully heals you, clears most lingering wounds, and feeds back into both the world time system and village economy day tick.",
              "Rumor listening is explicitly framed as a one-click service row with a short flavor description and a concise “Listen” button that logs a randomly chosen tavern rumor then returns you to the main game flow."
            ]
          },
          {
            "title": "Gambling flow & controls",
            "bullets": [
              "Stake management for tavern games has been pulled into a dedicated Stake & Options card with +/- stake buttons and a contextual coin-call toggle that only shows when playing Coin Toss.",
              "The Tavern Games modal now includes a “Last Round” card that mirrors what’s written to the combat log, so you can read round results without scrolling back through the main log.",
              "Play Round and Leave Table controls have been moved into a tavern-specific footer row that stays pinned at the bottom of the games modal while you scroll the game details above."
            ]
          }
        ]
      },
      {
        "heading": "Fixed",
        "items": [
          {
            "title": "Tavern footer & modal bleed",
            "bullets": [
              "Resolved an issue where the Tavern Games “Play Round” / “Leave Table” footer could leak into other modals: the footer is now created and destroyed within the tavern games flow only and is scoped with a tavern-footer-actions class.",
              "Fixed overflow and scrolling quirks where content could appear underneath the gambling footer; the footer now sits outside the scrollable body while the game content scrolls cleanly above it."
            ]
          },
          {
            "title": "Merchant affordance feedback",
            "bullets": [
              "Buying from merchants now reliably updates the shop’s “Your gold” line and per-item stock counters in real time after each purchase.",
              "Attempting to buy sold-out or unaffordable items now produces clear in-UI feedback (disabled buttons with explanatory text) in addition to log messages, reducing confusion when shopping in low-gold or low-stock situations."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.4.1",
    "title": "Developer Cheats Toggle & UI Polish",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Per-character Developer Cheats toggle",
            "bullets": [
              "Added a Developer Cheats pill to the character creation screen that matches the Difficulty pill styling.",
              "The entire pill is clickable; a single tap toggles the selected state and clearly highlights when cheats are enabled.",
              "When active, a devCheatsEnabled flag is stored on the save and used to decide whether the in-game Cheat menu appears for that hero."
            ]
          }
        ]
      },
      {
        "heading": "Fixed",
        "items": [
          {
            "title": "Developer Cheats pill interaction & layout",
            "bullets": [
              "Fixed the Developer Cheats pill so its visual selected state always syncs with the underlying toggle.",
              "Resolved a script parsing issue so the pill now lights up correctly instead of silently failing.",
              "Aligned the Developer Cheats row with the Difficulty row and ensured the subtitle text scales cleanly on smaller screens."
            ]
          },
          {
            "title": "Log & quest UI wiring",
            "bullets": [
              "Hooked up collapsing behavior on the Quest and Log headers so tapping them properly expands or collapses their panels.",
              "Log filter chips now use a dedicated log-chip-active class so the active filter is clearly highlighted while you play."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.4.0",
    "title": "Village Economy, Banking & World Time",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "World time & day–night cycle",
            "bullets": [
              "Introduced a dedicated time system module that tracks year, day of the week, and part of day (morning / evening / night).",
              "Exploring advances time in discrete steps; the log now calls out when time passes and when a new day begins.",
              "A small HUD time label (via updateTimeDisplay and #timeLabel) shows the current in-world date and time in a short or long format."
            ]
          },
          {
            "title": "Village economy simulation",
            "bullets": [
              "Added a villageEconomy state block with prosperity, trade, and security values plus an economy tier (Struggling / Stable / Thriving).",
              "Merchant prices and tavern rest costs now come from the economy tier, making goods cheaper in thriving times and pricier when the village struggles.",
              "The economy drifts slightly each new day and responds to your actions: clearing monsters near trade routes and spending gold at merchants nudges prosperity and trade."
            ]
          },
          {
            "title": "Emberwood Bank (savings, loans, and investments)",
            "bullets": [
              "New Emberwood Bank screen in the village with its own ES6 module (bank.js).",
              "You can deposit and withdraw gold into a safe savings account that accrues modest interest over time.",
              "Investments offer higher returns than savings but are treated as a separate pool of gold tracked by the bank.",
              "You can take out a loan with a balance and rate; interest is applied automatically whenever you visit the bank.",
              "Bank interest rates for savings, investments, and loans are dynamically computed from the village economy (prosperity/trade), and are shown on the bank screen."
            ]
          },
          {
            "title": "Tavern menu & in-modal gambling",
            "bullets": [
              "The village now has a full Emberwood Tavern modal with options to rest, hear rumors, or join tavern games.",
              "Gambling has been moved into its own ES6 module (tavernGames.js) and is launched from the Tavern menu instead of a separate button.",
              "All gambling games (Dice Duel, High Card, Coin Toss) are played entirely inside a dedicated tavern games modal.",
              "Stake controls, coin call buttons, and detailed round results are displayed directly in the modal, mirroring what appears in the log so you never have to close it to see outcomes."
            ]
          },
          {
            "title": "Area selection & free exploration",
            "bullets": [
              "Added a Choose Where to Explore modal that lets you pick your current region (village, Emberwood Forest, Ruined Spire, etc.).",
              "Once you choose an area, the Explore button continues exploring that same region until you explicitly use Change Area again.",
              "A new Change Area button in the main actions panel brings the area picker back at any time, enabling free roaming instead of being locked to the main quest path."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Quest travel & goblin hints",
            "bullets": [
              "Main quest steps no longer auto-travel you to Emberwood Forest; quests now respect your current chosen area.",
              "Before the Goblin Warlord is defeated, villagers now give a one-time flavor hint about goblins in Emberwood Forest instead of forcing travel.",
              "The hint is gated behind an internal goblinWhisperShown flag so it appears only once and persists across saves."
            ]
          },
          {
            "title": "Village hub actions & merchants",
            "bullets": [
              "Reworked the village actions panel to include Tavern, Bank, Merchant, Explore, and Change Area in a consistent layout.",
              "Merchant interactions in the village now display a small economy line describing the current tier and how prices feel (e.g., “prices are surprisingly fair”).",
              "Wandering merchants outside the village remain a rarer encounter and are described as charging extra for the risk of traveling alone."
            ]
          },
          {
            "title": "Save/load format",
            "bullets": [
              "Extended save data to include time, villageEconomy, and bank state blocks.",
              "Load logic initializes time and economy for older saves, ensuring backward compatibility while still enabling the new systems.",
              "After loading, the HUD time label is refreshed so the current date and time are immediately visible."
            ]
          }
        ]
      },
      {
        "heading": "Fixed",
        "items": [
          {
            "title": "Travel & action panel consistency",
            "bullets": [
              "Resolved issues where traveling between the village and other regions could leave the wrong action buttons visible.",
              "Ensured that returning to the village reliably shows the Tavern, Bank, Merchant, Explore, and Change Area options.",
              "Improved interaction between exploration, travel, and quest logic so you are not yanked out of your chosen area by quest progression."
            ]
          },
          {
            "title": "Goblin whisper flavor spam",
            "bullets": [
              "Previously, the goblin rumor line in the village could trigger repeatedly if you kept exploring before advancing the quest.",
              "This line is now strictly one-time per playthrough and is stored in flags so it isn’t repeated on future visits.",
              "You can continue to explore the village freely after seeing the hint; it no longer blocks or loops your exploration."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.3.1",
    "title": "In-Game Changelog Viewer",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "In-game Changelog screen",
            "bullets": [
              "Added a Changelog button to the main menu (and optionally the in-game pause menu) that opens a dedicated changelog screen.",
              "Changelog content is rendered inside a modal using collapsible sections for each version.",
              "Latest version is expanded by default so new changes are visible at a glance.",
              "Older versions are grouped under collapsible headers to keep the view compact on phone screens.",
              "Added the changelog to the in game pause menu."
            ]
          },
          {
            "title": "ES6 module–driven changelog data",
            "bullets": [
              "All changelog entries are now defined in a separate ES6 module (changelog.js).",
              "Each version is stored as structured data (version, title, sections, bullets) instead of hard-coded HTML.",
              "The changelog renderer in game.js reads directly from this data, so new versions can be added by editing a single file.",
              "Keeps the changelog maintainable and avoids touching UI code whenever a new version is released."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.3.0",
    "title": "Class Expansion, Dynamic Difficulty & Smarter Companions",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "New playable classes",
            "bullets": [
              "Introduced multiple new classes with distinct base stats, resources (Mana / Fury), and 3-ability starting kits.",
              "Each class has a fantasy description and tailored combat role (e.g., ranged DPS, tank-healer hybrid, lifedrain caster)."
            ]
          },
          {
            "title": "Dynamic Difficulty mode",
            "bullets": [
              "New Dynamic option alongside Easy / Normal / Hard.",
              "Tracks an internal difficulty band plus streaks of easy or hard fights.",
              "Automatically adjusts enemy HP, enemy damage, player damage, and AI smartness based on recent performance.",
              "HUD label reflects the current tuning (e.g., Dynamic (Easy), Dynamic (Hard))."
            ]
          },
          {
            "title": "Companion roster expansion",
            "bullets": [
              "Added several new companions to reach a full lineup of 8.",
              "Includes offensive familiars, support/tank beasts, resource-battery pets, and damage-reflecting shadows.",
              "Cheat Menu updated with summon / dismiss buttons for all companions."
            ]
          },
          {
            "title": "Companion Ability System 2.0",
            "bullets": [
              "Each companion now has a 4-ability kit.",
              "Abilities include damage, heal, shield, ward, bleed/burn, resource restore, and reflect.",
              "Abilities use cooldowns, apply status effects (stun, bleed, shield, reflect), and have flavor descriptions.",
              "Companion AI scores abilities each turn based on HP, enemy HP, active statuses, and effectiveness history.",
              "Falls back to a basic attack when no ability beats a normal hit."
            ]
          },
          {
            "title": "Mid-combat saving and battle resume",
            "bullets": [
              "Save data now includes an inCombat flag.",
              "Stores a full snapshot of currentEnemy.",
              "Stores log entries and the current log filter mode.",
              "Loading a save restores the current fight and enemy HUD state.",
              "Load Last Save from the defeat screen plugs into this system."
            ]
          },
          {
            "title": "Enemy HUD panel",
            "bullets": [
              "Dedicated right-side panel showing enemy name and behavior tags (Boss / Dragon / Warlord / Caster / Aggressive / Cunning).",
              "Displays HP bar with numeric HP.",
              "Shows current statuses such as Bleeding, Chilled, Guarding, Ward, Reflect, and more.",
              "Panel hides automatically when not in combat."
            ]
          },
          {
            "title": "Log filters & collapsible panels",
            "bullets": [
              "Added log filter chips (All / System / Danger / Good) to quickly focus on relevant messages.",
              "Quest box and log can be collapsed or expanded via their headers to improve mobile readability."
            ]
          },
          {
            "title": "Theme system",
            "bullets": [
              "New theme selector in Settings with multiple visual themes (arcane, inferno, forest, holy, shadow, etc.).",
              "Active theme stored in localStorage and restored on startup."
            ]
          },
          {
            "title": "Feedback / bug report helper",
            "bullets": [
              "Feedback modal lets players choose a category (Bug / UI / Balance / Suggestion / Other).",
              "Collects context such as player name, class, level, area, and difficulty.",
              "Copies a structured report to the clipboard for easy pasting into an external tracker."
            ]
          },
          {
            "title": "Random name generator",
            "bullets": [
              "Random Name button in character creation that picks from a curated list of fantasy names."
            ]
          },
          {
            "title": "Character Sheet quick access",
            "bullets": [
              "Character button added alongside other bottom actions in exploration and combat.",
              "Tapping the player name in the HUD also opens the Character Sheet."
            ]
          },
          {
            "title": "Pause / game menu",
            "bullets": [
              "In-game Game Menu modal with Save Game, Settings, and Quit to Main Menu."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Difficulty handling",
            "bullets": [
              "Difficulty can now be changed mid-run from Settings as well as at character creation.",
              "Dynamic difficulty mode’s internal band fully replaces older static tuning logic."
            ]
          },
          {
            "title": "Companion stat integration",
            "bullets": [
              "Companions now apply their HP bonus directly to the hero’s max HP and remove it cleanly when dismissed.",
              "HUD updates immediately when a companion is summoned or dismissed."
            ]
          },
          {
            "title": "Cheat Menu",
            "bullets": [
              "Shows all 8 companions with clearly labeled summon buttons and a shared Dismiss Companion option.",
              "Footer shows the current difficulty label and the status of God Mode / Always Crit."
            ]
          }
        ]
      },
      {
        "heading": "Fixed",
        "items": [
          {
            "title": "Battle restoration edge cases",
            "bullets": [
              "Loading mid-combat now restores the correct enemy and statuses.",
              "Rebuilds the enemy HUD panel and recreates the correct action buttons.",
              "Fixes cases where you could load into combat with no visible enemy."
            ]
          },
          {
            "title": "Ward / reflect behavior",
            "bullets": [
              "Wards now tick down correctly and log their expiration.",
              "Wards and reflect effects no longer silently vanish or stack incorrectly.",
              "Reflect effects have reliable durations and clear logging when they end."
            ]
          },
          {
            "title": "Older save compatibility",
            "bullets": [
              "Load logic initializes missing fields (skills, skillPoints, dynamicDifficulty, companion info) for older saves.",
              "recalcPlayerStats() handles partially populated state safely."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.2.4",
    "title": "Global CSS & Layout Polish",
    "sections": [
      {
        "heading": "Changed",
        "items": [
          {
            "title": "UI / UX",
            "bullets": [
              "Refined global visual theme while keeping the neon-fantasy look (deep blues, purples, cyan accents).",
              "Standardized card styling (radius, borders, backgrounds) across HUD, modals, log, quest panels, and the actions panel.",
              "Reworked Cheat Menu companion buttons into a dedicated horizontal scroll row to prevent awkward wrapping on small screens."
            ]
          },
          {
            "title": "Technical layout clean-up",
            "bullets": [
              "Consolidated CSS into sections (Base, Buttons, HUD, Game layout, Actions, Modal, Settings, Character Sheet, Responsive).",
              "Ensured scrollable containers such as #log, #actions, .companion-actions, and .char-tabs behave consistently with smooth mobile scrolling."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.2.3",
    "title": "Character Sheet 2.0 (Tabs & Visual Hierarchy)",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Tabbed Character Sheet",
            "bullets": [
              "Introduced a tab bar at the top of the sheet using horizontally scrollable pill buttons.",
              "Tabs cover key sections such as Overview, Stats, Skills, Equipment, and Companions."
            ]
          },
          {
            "title": "Visual stat hierarchy",
            "bullets": [
              "Each tab uses char-section and char-section-title for clear spacing and titles.",
              "char-divider-top adds subtle separators between major blocks.",
              "Added small stat icons and color-coded values (Attack, Magic, Armor, Speed, etc.)."
            ]
          },
          {
            "title": "Equipment and companion presentation",
            "bullets": [
              "equip-row layout for side-by-side label/value entries.",
              "Empty slots use a muted equip-empty style.",
              "Companion tab shows role, attack, HP bonus, and flavor description in a dedicated block."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "CSS organization",
            "bullets": [
              "Consolidated Character Sheet CSS into a single dedicated section.",
              "Removed duplicate definitions for char-section, char-tab, stat-grid, and equipment-related classes."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.2.2",
    "title": "Actions Panel Refactor",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Scrollable actions grid",
            "bullets": [
              "Bottom action buttons now live in a fixed-height, vertically scrollable #actions container.",
              "Uses a 2-column grid with consistent gaps and padding."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Button layout & spacing",
            "bullets": [
              "Ensured no buttons touch the container edges.",
              "Standardized inner padding around buttons for a balanced grid look.",
              "Prevents the main screen from stretching when more buttons are added by letting the actions container scroll."
            ]
          }
        ]
      },
      {
        "heading": "Fixed",
        "items": [
          {
            "title": "Layout stability",
            "bullets": [
              "#actions now keeps a predictable height using flex-shrink.",
              "Enables smooth mobile scrolling with -webkit-overflow-scrolling: touch.",
              "Eliminated layout jitter and overflow issues when many actions are visible."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.2.1",
    "title": "Post-Main-Quest Exploration & Combat",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Post-quest free play",
            "bullets": [
              "After defeating the final boss, you can continue exploring areas (forest, ruins, etc.).",
              "You can keep fighting random encounters and grinding XP/loot or testing builds."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Quest behavior at endgame",
            "bullets": [
              "Quest box properly marks the main quest as Completed.",
              "World state no longer locks the player out of normal exploration after the final story beat."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.2.x",
    "title": "Difficulty & Settings Flow Cleanup",
    "sections": [
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Difficulty selection flow",
            "bullets": [
              "Difficulty is now chosen during character creation via a pill-style selector (Easy / Normal / Hard).",
              "Selected difficulty is stored in state.difficulty from the moment a new game starts.",
              "Difficulty value is used consistently for enemy HP and damage scaling, player damage modifiers, and enemy AI decision-making.",
              "Difficulty is displayed in the HUD header (Class • Difficulty) and in the Character Sheet overview."
            ]
          },
          {
            "title": "Settings screen",
            "bullets": [
              "Removed the old difficulty dropdown from Settings to avoid conflicting sources of truth.",
              "Character creation UI uses clickable class cards with name, description, and optional icon slot.",
              "Selected class is highlighted with a stronger border and background."
            ]
          }
        ]
      },
      {
        "heading": "Fixed",
        "items": [
          {
            "title": "Initialization & settings bugs",
            "bullets": [
              "Removed all references to obsolete settingsDifficulty fields.",
              "initSettingsFromState() now hydrates only existing values (volume, text speed).",
              "Fixed a bug where Main Menu → Settings could fail before starting a game by correctly initializing settings on entry.",
              "applySettingsChanges() no longer references removed controls or invalid state."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.2.0",
    "title": "Skill System & Character Sheet Update",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Skill system (Strength / Endurance / Willpower)",
            "bullets": [
              "Introduced a skill-based progression where each level grants 1 skill point.",
              "Players choose which attribute to increase via a Level-Up Skill Selection modal.",
              "Strength boosts Attack, Endurance boosts Max HP and Armor, Willpower boosts Magic and Max Resource.",
              "Skills fully integrate into stat recalculation and gear scaling."
            ]
          },
          {
            "title": "Derived stat bonus display",
            "bullets": [
              "Character Sheet shows how each stat is composed.",
              "Attack = class base + skill bonus + weapon bonus.",
              "Magic = class base + skill bonus + weapon bonus.",
              "Max HP = base + Endurance bonus.",
              "Armor = base + skill bonus + armor gear.",
              "Max Resource = base + Willpower bonus + gear bonus."
            ]
          },
          {
            "title": "Character Sheet overhaul",
            "bullets": [
              "Reorganized into sections: Overview, Core Stats, Skills, Derived Bonuses, Equipment, Companion, Quest Summary.",
              "Added a companion summary block with name, role, attack, HP bonus, and description."
            ]
          },
          {
            "title": "Companion system",
            "bullets": [
              "Introduced Ember Wolf (DPS), Stone Golem (tank), Moonlit Sprite (healer), and Bound Skeleton (bleed/debuff).",
              "Companions scale automatically with player level.",
              "Companions act after the player in combat (damage, heal, bleed, or shield).",
              "Provide passive bonuses such as increased player HP.",
              "Cheat Menu allows summoning each companion and dismissing the current one.",
              "Companion data is stored in the save file."
            ]
          },
          {
            "title": "HUD swipe switching",
            "bullets": [
              "Swiping the top HUD toggles between player stats (HP/resource) and companion stats (Companion Attack / HP bonus).",
              "Added mobile-friendly touch handling (touchstart/touchend).",
              "HUD auto-locks to player view if no companion is active."
            ]
          },
          {
            "title": "HUD rendering upgrade",
            "bullets": [
              "updateHUD() rewritten to support dual display via state.hudView.",
              "Companion stats reuse the existing bar UI for consistency.",
              "Player XP, level, and gold remain always visible."
            ]
          },
          {
            "title": "Actions panel & UI improvements",
            "bullets": [
              "Bottom action buttons placed in a vertically scrollable box.",
              "Consistent mobile layout with smooth scrolling.",
              "Companion buttons in the Cheat Menu scroll horizontally without shifting the modal."
            ]
          }
        ]
      },
      {
        "heading": "Changed",
        "items": [
          {
            "title": "Combat sequencing",
            "bullets": [
              "Companion actions now occur after the player and before the enemy.",
              "Both ability usage and basic attacks trigger companion behavior."
            ]
          },
          {
            "title": "Saving / loading",
            "bullets": [
              "saveGame() and loadGame() persist and restore companion information.",
              "Character creation ensures skills and skillPoints are initialized even for older saves."
            ]
          }
        ]
      },
      {
        "heading": "Fixed",
        "items": [
          {
            "title": "Character Sheet layout",
            "bullets": [
              "Derived bonuses no longer appear inside the equipment block.",
              "Skill and companion sections render correctly even when loading older save data."
            ]
          }
        ]
      }
    ]
  },
  {
    "version": "0.1.0",
    "title": "Initial Prototype",
    "sections": [
      {
        "heading": "Added",
        "items": [
          {
            "title": "Core project structure",
            "bullets": [
              "Separated the project into index.html, styles.css, and game.js.",
              "Phone-first layout with a centered, max-width container and responsive UI."
            ]
          },
          {
            "title": "Main menu",
            "bullets": [
              "New Game to start a fresh adventure.",
              "Load Game powered by localStorage.",
              "Settings with difficulty selector, volume slider (visual), and text speed slider (placeholder)."
            ]
          },
          {
            "title": "Character creation",
            "bullets": [
              "Hero creation with name entry, class selection, initial stats, and starting gear.",
              "Difficulty was originally chosen in Settings (pre-0.2.x behavior)."
            ]
          },
          {
            "title": "Exploration & combat loop",
            "bullets": [
              "Simple area-based exploration (village hub plus nearby danger zones).",
              "Turn-based combat: player vs single enemy with physical and magical attacks.",
              "HP and resource bars with XP, level, and gold tracking.",
              "Single main quest line guiding the player through early content."
            ]
          },
          {
            "title": "Merchant & items",
            "bullets": [
              "Basic merchant interaction to buy simple weapons and armor.",
              "Items adjust core stats when equipped."
            ]
          },
          {
            "title": "Cheat Menu (debug tools)",
            "bullets": [
              "Debug overlay for development/testing: add gold and XP, level up, toggle God Mode, toggle Always Crit."
            ]
          },
          {
            "title": "Saving & loading",
            "bullets": [
              "Auto-save on key events (battles, exploration, purchases).",
              "Manual save from an in-game menu.",
              "Load Game from main menu and defeat screen (Load Last Save).",
              "Save data stored in localStorage under a versioned key."
            ]
          }
        ]
      },
      {
        "heading": "Known limitations / next steps",
        "items": [
          {
            "title": "Prototype constraints",
            "bullets": [
              "No sound or music implemented; volume slider is a placeholder.",
              "Text speed setting is not yet tied to a typewriter or animation system.",
              "Only a single main quest line (no side quests or branching stories yet).",
              "No sprites or visual combat animations; UI-only prototype.",
              "Codebase still in a single game.js file with no ES6 module split."
            ]
          }
        ]
      }
    ]
  }
];
