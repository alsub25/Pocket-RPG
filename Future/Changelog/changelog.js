// changelog.js
// ES6 module: structured changelog data for Emberwood: The Blackbark Oath

export const CHANGELOG = [
  {
  version: "1.1.6",
  title: "Combat Patch 1.1.6: Intent Telegraphs, Posture Break, and Interrupt Counterplay",
  sections: [
    {
      heading: "New Combat Features",
      items: [
        {
          title: "Enemy Intent Telegraphs",
          bullets: [
            "Certain high-impact enemy abilities now telegraph before firing, giving the player a clear counterplay window.",
            "Telegraphed moves show up on the enemy status line as an Intent with remaining turns.",
            "Currently telegraphed: Heavy Cleave, Void Breath, Seismic Stomp, Tail Swipe, and Inferno."
          ]
        },
        {
          title: "New Player Action: Interrupt",
          bullets: [
            "Added a new combat action button: Interrupt (costs 10 of your current resource).",
            "If the enemy has an Intent, Interrupt cancels it (and staggers non-boss enemies).",
            "If no Intent is present, Interrupt still performs a quick jab to build Posture pressure."
          ]
        },
        {
          title: "Posture + Break System",
          bullets: [
            "Player damage now builds enemy Posture; reaching the enemy's Posture cap causes a Break.",
            "Broken enemies lose their action and take increased damage while Broken.",
            "Break also disrupts any pending Intent (telegraphed attack is canceled).",
            "Enemy status line now displays Posture, Broken state, and relevant debuffs."
          ]
        }
      ]
    },
    {
      heading: "Bug Fixes + Combat Stability",
      items: [
        {
          title: "Enemy stun handling",
          bullets: [
            "Fixed an enemyTurn logic issue where stun could be decremented twice and the tick function's return value was ignored.",
            "Stun/Broken now properly prevent actions and can disrupt pending Intent."
          ]
        },
        {
          title: "Companion crit stat reference",
          bullets: [
            "Fixed a crit check referencing a non-existent `p.stats.crit` field; companions now correctly read `p.stats.critChance`."
          ]
        },
        {
          title: "Enemy attack debuff permanence",
          bullets: [
            "Fixed attack-down effects that permanently reduced enemy attack.",
            "Attack-down now uses timed debuff fields and a computed effective attack value."
          ]
        },
        {
          title: "Enemy runtime + Posture break determinism",
          bullets: [
            "Fixed ensureEnemyRuntime overwriting explicitly provided small enemy ability arrays (including smoke test dummies).",
            "Adjusted posture per-hit capping so very small posture caps used in tests can deterministically trigger Break (normal enemies unchanged)."
          ]
        }
      ]
    },
    {
      heading: "Smoke Tests",
      items: [
        {
          title: "New coverage",
          bullets: [
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
  version: "1.1.52",
  title: "Bug Fix Patch 1.1.52: Merchant Restock, Inventory Safety, and Stability Fixes",
  sections: [
    {
      heading: "Bug Fixes",
      items: [
        {
          title: "Merchant daily restock",
          bullets: [
            "Fixed a variable mix-up that prevented daily merchant restocking from running reliably.",
            "Merchant stock buckets now self-clean invalid or removed item keys to prevent 'ghost stock' persisting across patches."
          ]
        },
        {
          title: "Inventory / equipment edge cases",
          bullets: [
            "Selling or dropping gear now unequips by exact item instance first, preventing the wrong copy from being unequipped when duplicates exist.",
            "Legacy id-based unequip fallback is now only used when the player has a single copy of that item id, preventing accidental unequips when duplicates exist."
          ]
        },
        {
          title: "Save compatibility + invariants",
          bullets: [
            "Added save migration to normalize legacy inventory `qty` fields into `quantity`.",
            "State validator now audits `quantity` (and legacy `qty`) and records mismatches for easier bug reports."
          ]
        },
        {
          title: "UI / stability hardening",
          bullets: [
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
      heading: "Versioning",
      items: [
        {
          title: "Patch labeling",
          bullets: [
            "Updated in-game patch/version labels to 1.1.52 (The Blackbark Oath)."
          ]
        }
      ]
    }
  ]
},
  {
    version: "1.1.5",
    title: "Patch 1.1.5: Expanded Gear Slots + Loot Drops + Bug Fixes",
    sections: [
      {
        heading: "Loot & Equipment",
        items: [
          {
            title: "New gear slots",
            bullets: [
              "Added new equippable slots: Head, Hands, Feet, Belt, Neck, and Ring (in addition to Weapon + Body Armor).",
              "All armor pieces now carry a slot tag so the game can equip/compare them correctly."
            ]
          },
          {
            title: "Loot generator updates",
            bullets: [
              "Armor drops now roll across the full slot set (Body/Head/Hands/Feet/Belt/Neck/Ring).",
              "Neck and Ring items use an accessory-leaning affix pool that can roll small offensive bonuses without overshadowing weapons."
            ]
          }
        ]
      },
      {
        heading: "UI / UX",
        items: [
          {
            title: "Inventory + character sheet improvements",
            bullets: [
              "Character Sheet → Equipment tab now displays all gear slots.",
              "Inventory cards label armor by slot (e.g., Head, Ring) and power comparisons only compare within the same slot."
            ]
          },
          {
            title: "Cheat menu (dev)",
            bullets: [
              "Spawn Max Loot now generates a full max-level gear set across all slots, and can optionally equip the whole set."
            ]
          }
        ]
      },
      {
        heading: "Bug Fixes",
        items: [
          {
            title: "Stat calculation fixes",
            bullets: [
              "Fixed player Magic Resistance being applied twice from skills in some cases.",
              "Fixed a boot-time crash caused by a malformed potion function definition in lootGenerator.js."
            ]
          },
          {
            title: "Equipment edge cases",
            bullets: [
              "Selling/dropping equipped gear now correctly unequips it from whichever slot it occupies (not just body armor)."
            ]
          }
        ]
      },
      {
        heading: "Versioning",
        items: [
          {
            title: "Patch labeling",
            bullets: [
              "Updated in-game patch/version labels to 1.1.5 (The Blackbark Oath)."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.1.42",
    title: "Patch 1.1.42: Cheat Menu UX Pass + Mobile Layout Fixes + Docs Refresh",
    sections: [
      {
        heading: "Cheat Menu",
        items: [
          {
            title: "Faster navigation",
            bullets: [
              "Core Cheats no longer auto-expands when opening the Cheat Menu.",
              "Added quick status pills (Level/HP/etc.) for at-a-glance context while testing.",
              "Improved in-menu ergonomics for rapid multi-step testing (less accidental modal closing)."
            ]
          },
          {
            title: "Mobile layout + spacing",
            bullets: [
              "Fixed misaligned button rows inside cheat panels on small screens (notably multi-control rows like Give Item).",
              "Tightened vertical spacing between cheat buttons/controls while preserving the existing UI aesthetic.",
              "Status pills now clamp to a maximum of two rows and automatically scale to fit (no scrolling)."
            ]
          }
        ]
      },
      {
        heading: "Versioning & Docs",
        items: [
          {
            title: "Patch labeling",
            bullets: [
              "Updated in-game patch/version labels to 1.1.42 (The Blackbark Oath)."
            ]
          },
          {
            title: "README refresh",
            bullets: [
              "Expanded README with deeper system overviews, dev/QA workflows, troubleshooting notes, and project structure."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.1.4",
    title: "QA & Bug-Squash: Determinism + Smoke Tests + Better Reports",
    sections: [
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Acceptance & storage hardening",
            bullets: [
              "Wrapped all localStorage access in safe helpers to avoid crashes when storage is blocked or quota-limited.",
              "Acceptance gating now uses a versioned key and a single shared remove helper.",
              "Feedback / diagnostics flows avoid fatal exceptions when clipboard or storage APIs are unavailable."
            ]
          },
          {
            title: "State integrity auditing",
            bullets: [
              "Added a lightweight invariant validator that detects NaN, negative gold, broken HP/resource bounds, and common corruption patterns.",
              "Automatic audits run before save and after load; failures are recorded into the crash report system for easy reproduction."
            ]
          }
        ]
      },
      {
        heading: "Dev Tools",
        items: [
          {
            title: "Deterministic RNG mode (seeded)",
            bullets: [
              "Optional deterministic randomness for reproducible runs.",
              "RNG logging can be enabled to capture a tagged trail of random draws (useful for replaying ‘rare’ outcomes)."
            ]
          },
          {
            title: "Smoke tests",
            bullets: [
              "Added a small in-game smoke test runner that exercises save/load, daily ticks, combat boot-up, and core invariants.",
              "Outputs a copyable report for quick triage when something breaks."
            ]
          },
          {
            title: "Bug report bundle",
            bullets: [
              "Added a one-click JSON report (version + save meta + last crash + RNG seed/index + input breadcrumbs).",
              "Includes recent invariant failures to reduce ‘can’t reproduce’ issues."
            ]
          },
          {
            title: "Spawn & Teleport helpers",
            bullets: [
              "Teleport to any zone, force a specific enemy encounter, and grant items by id from the Cheat Menu.",
              "Designed to help quickly repro quest locks, economy edge-cases, and combat issues."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.1.3",
    title: "Quest Modularization: Quests extracted from Future.js",
    sections: [
      {
        heading: "Refactor",
        items: [
          {
            title: "Quest system moved into the Quests folder",
            bullets: [
              "Moved main-quest beats, side-quest events, quest UI rendering, and boss-trigger logic out of Future.js.",
              "Added a small binding adapter so older call sites (like the tavern quest board) can keep using the same quest hook signatures.",
              "No save-schema bump: old saves are backfilled with any missing quest flags on load."
            ]
          }
        ]
      }
    ]
  },

  {
    version: "1.1.2",
    title: "Stability & Diagnostics: Save Safety + Tick Hardening",
    sections: [
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Storage-safe saves and settings",
            bullets: [
              "Wrapped localStorage reads/writes in defensive helpers so blocked storage, private browsing, and quota issues don’t crash the game.",
              "Failures now surface as a clear, player-readable warning instead of a silent break."
            ]
          },
          {
            title: "Corrupt save detection and recovery flow",
            bullets: [
              "Hardened migration/loading so malformed saves are detected early.",
              "Added a ‘Save Error’ UI path that offers reset options instead of booting into a broken state."
            ]
          },
          {
            title: "Crash report persistence",
            bullets: [
              "Best-effort persistence of the last crash report so it can be included in Feedback even after reload."
            ]
          },
          {
            title: "Modal ownership + lock enforcement",
            bullets: [
              "Acceptance / blocking modals now claim ownership and lock closing behaviors so other UI code can’t accidentally dismiss them.",
              "Prevents overlay-click / Escape inconsistencies across browsers and mobile."
            ]
          }
        ]
      },
      {
        heading: "Simulation / Balance",
        items: [
          {
            title: "Daily tick normalization",
            bullets: [
              "Day indices are normalized to non-negative integers before running catch-up ticks to prevent double-application or off-by-one edge cases."
            ]
          },
          {
            title: "Economy metric rounding + clamps",
            bullets: [
              "Village economy drift now rounds to integers after applying drift and clamps to expected ranges to avoid float jitter in tier thresholds and UI."
            ]
          }
        ]
      },
      {
        heading: "Dev Tools",
        items: [
          {
            title: "Progression Auditor",
            bullets: [
              "Added a diagnostics report to help find stuck progression: quest steps, unlock flags, boss defeats, and contradictions with copy-to-clipboard output."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.1.1",
    title: "Blackbark Balance: Combat Fixes + Scaling Pass",
    sections: [
      {
        heading: "Fixes",
        items: [
          {
            title: "Enemy magic damage now mitigates correctly",
            bullets: [
              "Fixed enemy spell/elemental attacks being treated as physical mitigation in several AI/ability paths.",
              "Player magical resistance now exists in baseline stat recalculation so casters are resistible without relying on a specific affix."
            ]
          },
          {
            title: "Resist All is now actually applied",
            bullets: [
              "Resist All gear affix now reduces incoming damage as intended."
            ]
          },
          {
            title: "Resource potions respect class resource",
            bullets: [
              "Fury/Mana/Blood/Essence restoratives no longer restore the wrong resource type when used by another class."
            ]
          },
          {
            title: "Element naming normalized",
            bullets: [
              "Ice effects now use the same 'frost' element label as loot affixes."
            ]
          },
          {
            title: "On-hit element pass-through",
            bullets: [
              "On-hit passives that depend on element type (ex: Necromancer tithe) now work on basic attacks."
            ]
          }
        ]
      },
      {
        heading: "Combat & Balance",
        items: [
          {
            title: "Zone scaling tuned down slightly",
            bullets: [
              "Reduced late-zone HP/ATK/DEF growth to prevent drawn-out fights while keeping difficulty meaningful."
            ]
          },
          {
            title: "Crit swinginess reduced",
            bullets: [
              "Lowered baseline crit chances slightly to reduce early-fight volatility."
            ]
          },
          {
            title: "Vulnerable debuff now matters",
            bullets: [
              "Vulnerable increases incoming damage while active, making enemy setup abilities more readable and impactful."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.1.0",
    title: "Oathbound Arsenal: Class Engines, Loadouts, and Upgrades",
    sections: [
      {
        heading: "New / Systems",
        items: [
          {
            title: "Class Engines (Passives + Resource Identity)",
            bullets: [
              "Added lightweight class passives that shape combat rhythm without bloating the UI.",
              "Mage: every 3rd spell is discounted and gains crit; Warrior: Bulwark at high Fury; Blood Knight: Crimson Exchange; Vampire: Hungering Vein."
            ]
          },
          {
            title: "Spell Loadouts",
            bullets: [
              "Equip up to 4 abilities for combat; in-fight casting is restricted to your equipped kit.",
              "Loadouts auto-clean if a spell is removed and auto-fill from known spells when needed."
            ]
          },
          {
            title: "Ability Upgrades",
            bullets: [
              "Earn upgrade tokens on level-up and invest them into abilities (Tier 1–3).",
              "Choose a path per ability: Potency (+effect) or Efficiency (-cost)."
            ]
          },
          {
            title: "Class Spell Progression",
            bullets: [
              "Each class now unlocks new abilities at levels 3 and 6.",
              "Older saves migrate forward and receive any missed unlocks based on current level."
            ]
          }
        ]
      },
      {
        heading: "Combat & Balance",
        items: [
          {
            title: "Chilled is now a real debuff",
            bullets: [
              "Chilled reduces enemy outgoing damage while active and ticks down cleanly."
            ]
          },
          {
            title: "Companion boon is now functional",
            bullets: [
              "Companion ‘empower’ boon now correctly boosts your next action and is consumed/expired properly."
            ]
          },
          {
            title: "Fight-scoped status cleanup",
            bullets: [
              "Temporary shields/buffs/boons reset at combat start/end to prevent between-fight carryover."
            ]
          }
        ]
      },
      {
        heading: "UI / UX",
        items: [
          {
            title: "Spellbook panels",
            bullets: [
              "Reworked the Spells & Abilities screen into a two-panel layout (list + details) for faster browsing and a cleaner look.",
              "Details panel shows cost, upgrade tier/path, and contextual actions (Use / Equip / Upgrade)."
            ]
          }
        ]
      },
      {
        heading: "Fixes",
        items: [
          {
            title: "Twin Arrows now triggers on-hit effects",
            bullets: [
              "Life Steal and other on-hit hooks now apply per arrow."
            ]
          },
          {
            title: "Player buffs no longer stick forever",
            bullets: [
              "Key buff abilities now apply durations, and combat-only buffs are cleared reliably."
            ]
          },
          {
            title: "Save migration hardened",
            bullets: [
              "Schema migration updated to add loadouts, upgrades, and new status fields without breaking older saves."
            ]
          }
        ]
      }
    ]
  },

    {
    version: "1.0.9",
    title: "Bugfix Patch: Settings Defaults, Economy Tick Init, and Log ID Consistency",
    sections: [
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Volume and text speed now respect defaults on a fresh install",
            bullets: [
              "Fixed a localStorage parsing edge case where missing keys were interpreted as 0, muting audio and forcing minimum text speed on first launch."
            ]
          },
          {
            title: "Village economy day tick initialization is consistent",
            bullets: [
              "Economy state now starts with lastDayUpdated = null (like population), preventing accidental day-0 tick skips in catch-up or debug flows."
            ]
          },
          {
            title: "Log entries start at ID 1 in new runs",
            bullets: [
              "Adjusted the initial log sequence counter so the first entry is ID 1 (no gameplay impact, but keeps IDs intuitive and consistent)."
            ]
          }
        ]
      }
    ]
  },

  {
    version: "1.0.8",
    title: "Bugfix Patch: Quest Board Availability, Feedback Modal Hardening, and Bank Interest Logging Safety",
    sections: [
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Completed side quests no longer reappear on the tavern board",
            bullets: [
              "Side quests are now offered only if they have never been started, preventing completed quests from being re-listed."
            ]
          },
          {
            title: "Bank weekly-interest logging is now optional-safe",
            bullets: [
              "Interest application no longer assumes an addLog callback exists, preventing errors if reused from non-UI code paths."
            ]
          },
          {
            title: "Feedback copy handler is more defensive",
            bullets: [
              "Clipboard copy now safely aborts if modal DOM nodes are missing, preventing rare crashes during UI refactors."
            ]
          },
          {
            title: "Version labels are consistent across launcher + docs",
            bullets: [
              "Bootstrap and README patch labels now match the in-game build version."
            ]
          },
          {
            title: "Developer docs reference the correct entry file",
            bullets: [
              "Updated the User Acceptance install snippet to reference bootstrap.js instead of a non-existent Core/game.updated.js."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.0.7",
    title: "Systems Polish: Town Summary, Decree Economy Drift, Bank Rate Breakdown, and Gambling UX",
    sections: [
      {
        heading: "New / Improved",
        items: [
          {
            title: "Town Summary after resting",
            bullets: [
              "Resting at the tavern now opens a Town Summary card showing economy tier, villager mood changes, active decree time remaining, and bank week progress."
            ]
          },
          {
            title: "Town Hall decrees nudge the economy",
            bullets: [
              "Active decrees can add small daily deltas to Prosperity/Trade/Security, making decree choices visible in day-to-day drift.",
              "The economy stores a daily breadcrumb describing decree nudges for summary UI."
            ]
          },
          {
            title: "Bank rate breakdown",
            bullets: [
              "Bank now includes a collapsible breakdown showing base rates, tier adjustments, and active decree multipliers."
            ]
          },
          {
            title: "Tavern games UX",
            bullets: [
              "Added Luck/Heat meters, guidance text, and stronger max-bet enforcement to prevent out-of-range wagers."
            ]
          },
          {
            title: "Dev cheat: fast-forward days",
            bullets: [
              "Cheat Menu now includes +1/+3/+7 day fast-forward buttons with a printed summary of economy, mood, decree, and bank progress changes."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.0.6",
    title: "Bugfix Patch: Quest Panel Chevron, Scroll-Safe Log, Mobile Viewport Height, and Panel A11y",
    sections: [
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Quest panel header chevron is preserved",
            bullets: [
              "Fixed updateQuestBox() so it no longer overwrites the Quest header DOM (which previously deleted the chevron).",
              "Quest header now uses an internal title span so future updates won’t break collapse UX."
            ]
          },
          {
            title: "Quest chevron color matches the quest border",
            bullets: [
              "Quest panel now defines a --quest-border variable used by the border, header text, and chevron for consistent styling."
            ]
          },
          {
            title: "Log panel no longer yanks the scroll position",
            bullets: [
              "renderLog() now only auto-scrolls when the player is already near the bottom, preserving reading position when scrolled up."
            ]
          },
          {
            title: "Mobile-safe viewport sizing",
            bullets: [
              "Replaced critical 100vh sizing with 100dvh where supported to avoid UI cutoffs from mobile browser address bars.",
              "Modal max-height now also uses dvh for better fit on mobile."
            ]
          },
          {
            title: "Collapsible panels are now keyboard friendly",
            bullets: [
              "Quest and Log headers now support Enter/Space to collapse/expand and expose aria-expanded state.",
              "Collapse listeners are wired idempotently to prevent duplicate handlers."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.0.5",
    title: "Bugfix Patch: Settings UI, Log Panel, Safety Helpers, and Packaged Audio",
    sections: [
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Audio assets now ship with the build",
            bullets: [
              "Added Future/Audio with default WAV files so ambient/music/sfx paths no longer 404 in the browser.",
              "Music/SFX toggles now apply mute gains immediately when changed."
            ]
          },
          {
            title: "Settings screen hardening",
            bullets: [
              "Added a Difficulty selector to the Settings screen (easy/normal/hard/dynamic).",
              "Settings event listeners are now wired idempotently, preventing duplicated handlers when opening Settings multiple times.",
              "Text Speed now applies live via slider input changes."
            ]
          },
          {
            title: "Log panel collapse + filter UX",
            bullets: [
              "Added a Log header with chevron and proper collapse behavior.",
              "Log filter chips now hydrate their active highlight on load."
            ]
          },
          {
            title: "Bootstrap version picker highlight",
            bullets: [
              "The currently selected version is now visibly highlighted in the version picker."
            ]
          },
          {
            title: "Numeric safety helpers unified",
            bullets: [
              "Removed duplicate finite/clamp helper implementations and now import them from Systems/safety.js to reduce drift."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.0.4",
    title: "Bugfix Patch: Save Slots, Time Normalization, Bank Interest Guards, and Pause→Changelog Back Button",
    sections: [
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Random Name button reliability",
            bullets: [
              "Fixed Random Name to target the input field via DOM lookup instead of relying on a global ID variable."
            ]
          },
          {
            title: "Manual save slots always capture the latest state",
            bullets: [
              "Slot saves now force-flush the autosave coalescing queue so manual saves never lag behind recent actions."
            ]
          },
          {
            title: "Time system now normalizes stored time values",
            bullets: [
              "state.time.dayIndex and state.time.partIndex are now clamped and written back to state to prevent persistent corruption from NaN/Infinity/out-of-range values."
            ]
          },
          {
            title: "Bank weekly interest hardening",
            bullets: [
              "Bank interest now treats non-finite dayIndex / lastInterestDay as day 0 and safely re-initializes or recalibrates.",
              "Prevents weekly interest from silently breaking when day counters become NaN."
            ]
          },
          {
            title: "Settings initialization cleanup",
            bullets: [
              "Removed a duplicate applyChannelMuteGains() call during settings hydration."
            ]
          },
          {
            title: "Pause menu → Changelog UX",
            bullets: [
              "Changelog opened from the pause menu now shows a Back button that returns to the Game Menu instead of effectively unpausing on close."
            ]
          },
          {
            title: "Town Hall decree cleanup on load",
            bullets: [
              "Expired decrees are cleared once on save-load so stale decree fields don't linger when a player loads and doesn't advance days."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.0.3",
    title: "Final Pre-1.1.0 Cleanup: Save/Modal A11y, Daily Tick Catch-up, and Branding Consistency",
    sections: [
      {
        heading: "Changed",
        items: [
          {
            title: "Daily ticks now catch up safely",
            bullets: [
              "If multiple in-game days are skipped (rest chains, tab suspension, or fast-forward), the daily tick pipeline now replays missed days up to a safe cap.",
              "Daily tick progress is tracked in state.sim.lastDailyTickDay to prevent double-running and to support stable catch-up behavior."
            ]
          },
          {
            title: "Save system is quieter and more stable",
            bullets: [
              "Autosaves are now de-duplicated and coalesced to reduce localStorage churn and mobile stutter.",
              "Merchant restock meta (merchantStockMeta) and simulation meta (sim) are now persisted and migrated in the save schema."
            ]
          },
          {
            title: "Town Hall decree cleanup is pure-read for UIs",
            bullets: [
              "Bank and rest-cost calculations no longer mutate decree state while rendering; decree cleanup happens in the daily tick pipeline."
            ]
          }
        ]
      },
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Modal reliability and accessibility",
            bullets: [
              "Modals now close with Escape and trap focus while open, restoring focus back to the opener on close.",
              "Extra leaked tavern footer actions are removed on both open and close to prevent hidden interactive elements."
            ]
          },
          {
            title: "Merchant stock safety",
            bullets: [
              "Merchant stock generation no longer assumes state.player exists (prevents crashes during early init or corrupted saves)."
            ]
          },
          {
            title: "Time display and branding cleanup",
            bullets: [
              "Added a HUD time label for the existing updateTimeDisplay() hook.",
              "Removed lingering 'Pocket Quest' / 'Project: Mystic' naming in UI strings and stylesheet headers."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.0.2",
    title: "Economy & UI Polish: Decree Cleanup, Merchant Restock, and Tick Guards",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Merchant daily restock",
            bullets: [
              "Village and wandering merchant stock now replenishes slowly each in-game day so shops don't become permanently empty."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Town Hall decree cleanup is centralized",
            bullets: [
              "Other systems no longer delete state.government.townHallEffects; expired decrees are cleared in-place to keep the object shape stable for the Town Hall UI.",
              "Expired decrees are cleared in-place via a shared helper so the object shape remains stable for the Town Hall UI."
            ]
          }
        ]
      },
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Price and tick guardrails",
            bullets: [
              "Wandering-merchant price multiplier is now clamped after its road-risk bump so it can't exceed intended ceilings.",
              "Village population day tick now guards against double-running the same day (prevents mood drift from applying twice).",
              "Town Hall daily tick now guards against double-running the same day (keeps petition timelines consistent)."
            ]
          },
          {
            title: "Banking edge cases",
            bullets: [
              "Weekly interest now clamps negative calendar deltas (save rollback/dev tools) so interest can't get stuck.",
              "A one-time ledger note explains weekly-interest initialization the first time you open the bank after updating."
            ]
          },
          {
            title: "Merchant coverage",
            bullets: [
              "Essence-based heroes now see their correct resource potion in merchant stock.",
              "Alchemists now carry Essence potions."
            ]
          },
          {
            title: "Tavern games footer cleanup",
            bullets: [
              "Pinned tavern-games footer actions are now removed on modal close to prevent UI leakage across modals."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.0.1",
    title: "Stability Pass: Save Schema, Crash Reports & Log Performance",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Save schema + migrations",
            bullets: [
              "Saves now include a meta.schema field so future updates can migrate older saves safely.",
              "Automatic backfills for missing blocks (time, village economy, government, bank, merchant stock/names) when loading older saves."
            ]
          },
          {
            title: "Crash catcher (for better bug reports)",
            bullets: [
              "Unhandled errors and promise rejections are captured and attached to the Feedback / Bug Report payload.",
              "Feedback now includes patch, schema, and the last 30 log lines to make reproduction easier."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Log rendering performance",
            bullets: [
              "Game log rendering is now incremental to reduce DOM churn during long sessions.",
              "Loading a save forces a clean rebuild of the log UI to avoid filter/render mismatches."
            ]
          },
          {
            title: "Version label is now driven by GAME_PATCH",
            bullets: [
              "Main menu version label is set at runtime so it stays consistent across builds."
            ]
          }
        ]
      },
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Numeric guardrails",
            bullets: [
              "Added NaN/Infinity clamps for core values (HP, resource, gold, enemy HP) to prevent state corruption.",
              "Village economy + merchant purchase flows now sanitize gold and multipliers defensively."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "1.0.0",
    title: "Full Release: Core Systems Locked-In",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Full village simulation loop",
            bullets: [
              "Village economy now influences merchant prices, tavern rest costs, and bank rates.",
              "Kingdom Government and Town Hall systems introduce decrees that temporarily nudge the economy."
            ]
          },
          {
            title: "Banking and finance",
            bullets: [
              "Village Bank supports savings, investments, and loans with weekly interest tied to the in-game calendar."
            ]
          },
          {
            title: "Merchants and persistent stock",
            bullets: [
              "Village merchants now have per-run shop names and limited stock that can sell out.",
              "Traveling merchant events support a separate wandering context for pricing flavor."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Save / load reliability",
            bullets: [
              "Expanded save data coverage for time, economy, government, banking, and merchant persistence.",
              "Improved mid-combat resume behavior and log restoration."
            ]
          }
        ]
      },
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "UI and modal consistency",
            bullets: [
              "Improved modal cleanup across different features to prevent layout bleed.",
              "Changelog and Feedback tools are available directly from the main menu."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "0.9.0",
    title: "UI Polish, Combat Tuning & Quality-of-Life",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "More combat clarity",
            bullets: [
              "Improved combat log messaging for critical hits, shields, and lifesteal effects.",
              "New log filter chips let you quickly focus on system, danger, or positive events."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Balance and pacing",
            bullets: [
              "Ability damage and resource costs have been tuned to keep spell/ability use feeling rewarding.",
              "Tavern rest and economy tick integration standardized so day progression is consistent."
            ]
          }
        ]
      },
      {
        heading: "Fixed / Stability",
        items: [
          {
            title: "Mobile and layout fixes",
            bullets: [
              "Improved responsive layout handling for smaller screens and modal-heavy flows.",
              "Assorted UI alignment fixes and minor bug cleanups."
            ]
          }
        ]
      }
    ]
  },

  {
  version: "0.8.0",
  title: "Bootstrap Version Picker & Audio Settings Controls",
  sections: [
    {
      heading: "Added",
      items: [
        {
          title: "Multi-build version picker (bootstrap loader)",
          bullets: [
            "New bootstrap loader dynamically injects the selected game entry module at runtime.",
            "Added a Change Version button on the main menu to swap between Main and a preserved Prior Patch v0.7.0 build.",
            "Supports selecting builds via a ?v= query param and persists the choice to local storage for future launches.",
            "Includes recovery UX: if a build fails to load, the picker re-opens so players/devs can switch builds."
          ]
        },
        {
          title: "Audio settings toggles (Music / SFX) + persistence",
          bullets: [
            "Settings now include Music and SFX enable toggles alongside Master Volume.",
            "Audio preferences are saved to local storage and apply immediately without requiring a reload."
          ]
        }
      ]
    },
    {
      heading: "Changed",
      items: [
        {
          title: "User Acceptance gating is now hard-locked",
          bullets: [
            "Acceptance modal blocks closing via ✕, overlay click, and ESC while the gate is active.",
            "Clicks on New Game / Load Game / Begin Adventure are intercepted until both documents are accepted."
          ]
        },
        {
          title: "Settings now actively drive audio runtime state",
          bullets: [
            "Master volume and channel mute state are applied during settings hydration and on-change.",
            "Music/SFX toggles update live audio behavior immediately."
          ]
        }
      ]
    },
    {
      heading: "Fixed / Stability",
      items: [
        {
          title: "Modal cleanup for cross-feature UI",
          bullets: [
            "Acceptance modal clears stray footer elements from other flows to prevent modal bleed and layout conflicts."
          ]
        },
        {
          title: "Bootstrap fallback on load failure",
          bullets: [
            "If the selected build fails to load, the version picker opens so the user can recover by selecting another build."
          ]
        }
      ]
    },
    {
      heading: "Dev Notes",
      items: [
        {
          title: "Version string consistency sweep",
          bullets: [
            "Align GAME_PATCH, README 'Current patch', and the main menu version label to 0.8.0 for a clean release."
          ]
        }
      ]
    }
  ]
},
	{
  version: "0.7.0",
  title: "Court History, Audio Pass & In-Game Changelog",
  sections: [
    {
      heading: "Added",
      items: [
        {
          title: "Town Hall decree history & council lifecycle",
          bullets: [
            "Town Hall now records a full decree history: each enacted decree is stored with its title, start day, and expiry day.",
            "The Town Hall view includes a collapsible “Prior Decrees” section that lists recent policies and whether they are still active.",
            "Village councils no longer last forever: councillors can die, retire, or be recalled, with temporary recess periods and realm-appointed replacements filling empty seats.",
            "Daily Town Hall ticks now run a dedicated membership step that can reshuffle the council and log notable changes in the court log."
          ]
        },
        {
          title: "Government overview: economy and court recap cards",
          bullets: [
            "The Government / Realm overview panel has a richer village card that explicitly shows the effective Prosperity, Trade, and Security values other systems actually read.",
            "A new “Recent Decrees & Events” card summarizes the last few government history entries, including the day they occurred and a short description of what changed.",
            "If no history exists yet, the government view explains that the royal scribes have not recorded any notable decrees, instead of leaving the card blank."
          ]
        },
        {
          title: "Basic audio & ambience (music + door SFX)",
          bullets: [
            "Introduced a lightweight audio controller with a looping daytime ambience track for Emberwood village.",
            "A new updateAreaMusic helper runs on time advancement, swapping music based on current area and time of day (village mornings currently use the new ambience track).",
            "Visiting the Tavern or Bank now plays a wooden door open sound effect, giving those screens a bit more tactile feedback."
          ]
        },
        {
          title: "In-game Changelog viewer",
          bullets: [
            "New Changelog modal wired off the main menu and in-game menu that renders the CHANGELOG data directly in-game.",
            "Each version appears as a collapsible <details> block, with headings for Added / Changed / Fixed / Dev Notes and nested bullet lists.",
            "The most recent entry opens by default so players immediately see what changed in the latest patch."
          ]
        },
        {
          title: "User Acceptance & Legal gating",
          bullets: [
            "Added a dedicated userAcceptance module that blocks play until the user accepts both a User Acceptance panel and a Legal Notice panel.",
            "Each panel has its own scroll box and its own checkbox; checkboxes remain disabled until that panel has been scrolled to the bottom.",
            "Acceptance is stored in local storage under a versioned key, and ACCEPTANCE_VERSION can be bumped to force re-acceptance after changing the text."
          ]
        },
        {
          title: "Character sheet & companion polish",
          bullets: [
            "The Character Sheet now includes a World Time line alongside Location, showing the current in-world day and time in a compact format.",
            "New companion options such as Falcon, Familiar, and Mimic are available through the companion summon UI, rounding out the roster with more specialized flavors.",
            "The Character Sheet is now formally accessible from combat via a dedicated Character button, making it easier to inspect stats mid-fight."
          ]
        }
      ]
    },
    {
      heading: "Changed",
      items: [
        {
          title: "Save / load aware of government, village & merchants",
          bullets: [
            "Save data has been extended again to include village state, bank state, full time + villageEconomy blocks, kingdom government state, and persistent merchant stock / names.",
            "Load logic restores all of these blocks when present and re-initializes time, economy, and government for older saves that pre-date the newer systems.",
            "Combat, log entries, and the current log filter mode are all restored on load, with an explicit log line calling out which enemy you are currently fighting if you resume mid-battle."
          ]
        },
        {
          title: "Tavern, bank & realm tick integration",
          bullets: [
            "Tavern rest flows now call into the same daily tick pipeline used elsewhere, ensuring economy, government, Town Hall, and population all advance consistently when you sleep.",
            "Bank visits continue to apply any pending weekly interest based on the in-game calendar and the current village economy, with updated rates reflecting active royal decrees.",
            "Random wandering merchants now use a dedicated context when opening the merchant modal, allowing their prices and flavor text to diverge from the core village shop while still sharing the same stock logic."
          ]
        },
        {
          title: "Government & Town Hall UI clarity",
          bullets: [
            "Village entries in the government view now show both the crown’s influence modifiers and the raw economy numbers used by the rest of the simulation.",
            "The Town Hall modal highlights active decrees separately from prior ones, making it easier to see which policies are currently shaping interest rates and rest prices.",
            "Council and decree tooltips have been tuned to better explain how daily ticks, popularity, and ideology influence petition outcomes."
          ]
        }
      ]
    },
    {
      heading: "Fixed / Stability",
      items: [
        {
          title: "Resilience for older saves",
          bullets: [
            "Loading saves created before the Town Hall, government, or merchant systems now safely backfills missing state blocks instead of failing silently.",
            "Guard-turn and combat status fields are normalized on load to prevent edge cases where enemies could resume in a partially initialized state.",
            "Log rendering after load replays the restored entries and filter correctly so the game log view always reflects what was persisted."
          ]
        }
      ]
    },
    {
      heading: "Dev Notes",
      items: [
        {
          title: "Changelog + acceptance plumbing",
          bullets: [
            "The CHANGELOG array is now the single source of truth for both the external changelog file and the in-game Changelog modal; keep 0.7.0 at the top so it renders first.",
            "ACCEPTANCE_VERSION in userAcceptance.js is currently set to 5.0.0; bump this when materially changing the User Acceptance or Legal Notice copy to force players to re-acknowledge."
          ]
        }
      ]
    }
  ]
},
{
  version: "0.6.0",
  title: "Town Hall Petitions, Active Decrees & Population Mood",
  sections: [
    {
      heading: "Added",
      items: [
        {
          title: "Town Hall + Council petition system",
          bullets: [
            "New Town Hall modal (petitions + council voting).",
            "Petitions resolve via popular support + council vote on day ticks.",
            "17 petition types that can trigger short-lived decrees (3-day duration).",
            "Decrees generate townHallEffects (bank-rate multipliers + rest-cost multiplier).",
          ],
        },
		{
          title: "Vampire hero class",
          bullets: [
            "New Vampire class that uses a unique Essence resource instead of traditional Mana.",
            "Three signature abilities: Essence Drain (lifesteal + resource gain), Bat Swarm (damage + bleed), and Shadow Veil (temporary damage reduction).",
            "Essence has its own max pool, regeneration rules, potions, HUD color, and starting loadout."
          ],
        },
        {
          title: "Village population simulation",
          bullets: [
            "New villagePopulation system (population size + mood + daily drift).",
            "Daily tick integration with safeguards against double-updating the same day.",
          ],
        },
        {
          title: "Gambling Hall improvements",
          bullets: [
            "Added Max Bet quick-control ('Max bet pill').",
            "Added gamblingDebug payout multiplier hook for testing/tuning.",
          ],
        },
      ],
    },
    {
      heading: "Changed",
      items: [
        {
          title: "Economy summary now returns government-adjusted values",
          bullets: [
            "Prosperity/security/trade are exposed as adjusted (raw values remain internal).",
          ],
        },
        {
          title: "Rest and Bank now respect active decrees",
          bullets: [
            "Rest cost applies restCostMultiplier from townHallEffects (with expiry cleanup).",
            "Bank deposit/invest/loan rates apply decree multipliers (with expiry cleanup).",
          ],
        },
      ],
    },
    {
      heading: "Fixed / Stability",
      items: [
        {
          title: "Decree cleanup and tick consistency",
          bullets: [
            "Expired townHallEffects are removed to prevent lingering bonuses.",
            "Day-tick pipeline now consistently processes economy/government/town hall/population.",
          ],
        },
      ],
    },
    {
      heading: "Dev Notes",
      items: [
        {
          title: "Version bump",
          bullets: [
            "Update GAME_PATCH in game.js from 0.5.0 to 0.6.0.",
          ],
        },
      ],
    },
  ],
},
{
  version: "0.5.0",
  title: "Pending (Royal Finance Decrees) & Save Manager 2.0",
  sections: [
    {
      heading: "Added",
      items: [
        {
          title: "PENDING: Royal finance decrees that bend interest rates",
          bullets: [
            "The king can now issue short-lived finance decrees that temporarily boost or penalize savings, investments, or loan rates across the realm.",
            "Each active decree exposes a set of modifiers that feed directly into the bank's interest calculations, allowing rates to spike during stimulus or tighten under austerity.",
            "The government view now shows when a finance decree is active and when it will expire, so you can time deposits, investments, and loan payments around royal policy."
          ]
        },
        {
          title: "Grouped save manager",
          bullets: [
            "The Save / Load screen now groups saves by hero ID, so all runs for the same character collapse under a single expandable panel instead of flooding the list.",
            "Each group header shows hero name, class, level, and last played location, along with how many manual and auto saves exist for that hero.",
            "Inside a group, individual rows display patch version, save type (manual vs auto), and a compact timestamp, with load and delete actions on each slot."
          ]
        },
        {
          title: "Cheat menu 2.0",
          bullets: [
            "Rebuilt the developer cheat menu into a structured modal that mirrors the changelog UI, with collapsible sections (Core, Economy, Companions, Debug) instead of a flat wall of buttons.",
            "Each cheat section header uses the same pill-like header style and chevron affordance as the changelog sections, making it obvious that the panel can expand or collapse.",
            "Cheats remain gated behind the Dev Cheats pill on the title screen, but are now much easier to scan and toggle once unlocked."
          ]
        }
      ]
    },
    {
      heading: "Changed",
      items: [
        {
          title: "Bank interest pipeline wired to government & economy",
          bullets: [
            "Bank interest now starts from base rates, then layers in village economy modifiers (prosperity, stability, crime) and finally applies any active royal finance decree multipliers.",
            "Weekly interest summaries can call out when a royal decree has modified your returns or costs, so you can see how much policy helped or hurt your wallet.",
            "Internal helpers like getCurrentRates and getBankRateModifiers centralize the finance math used for savings, investments, and loans."
          ]
        },
        {
          title: "Save slot visual polish",
          bullets: [
            "Save slot rows now use the same rounded card style, muted text, and spacing language as other panels (changelog, logs, etc.).",
            "The Save / Load panel is less cramped, with tighter metadata lines and consistent small-button styling for load and delete actions.",
            "Auto-saves and manual saves are visually distinguished without overwhelming the primary 'continue this run' path."
          ]
        }
      ]
    },
    {
      heading: "Fixed",
      items: [
        {
          title: "Gold display and tavern rest edge cases",
          bullets: [
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
  version: "0.4.6",
  title: "Kingdom Government & Realm Integration",
  sections: [
    {
      heading: "Added",
      items: [
        {
          title: "Autonomous kingdom government system",
          bullets: [
            "Introduced a dedicated government module that creates an overworld realm (Kingdom of Emberfall) with a monarch, optional spouse, and children, plus a 7-member royal council with roles like Chancellor, Marshal, Spymaster, and Archmage.",
            "Government tracks realm-level metrics such as stability, prosperity, royal popularity, and corruption, and evolves them over time using daily policy-driven drift and occasional royal decrees.",
            "Villages now have their own leadership attitude toward the crown (loyalty, fear, unrest) plus prosperity/safety modifiers that can be read by other systems for tuning difficulty, prices, and events."
          ]
        },
        {
          title: "Realm & Council overview panel",
          bullets: [
            "Added a Realm & Council panel that lets you inspect the current monarch, spouse (if any), heirs, and all 7 councilors with their roles, ideology, loyalty, and mood.",
            "The panel also shows the realm’s current stability / prosperity / popularity / corruption scores side-by-side with Emberwood Village’s current prosperity, trade, and security so you can see how the overworld is shaping local conditions.",
            "Realm & Council is now accessed from the main in-game Actions bar instead of the main menu, making political information feel like a core, always-available gameplay system."
          ]
        }
      ]
    },
    {
      heading: "Changed",
      items: [
        {
          title: "Government-driven economy integration",
          bullets: [
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
    version: "0.4.5",
    title: "Merchants 2.0, Weekly Banking & Tavern Games",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Village merchant hub & shop personalities",
            bullets: [
              "Replaced the single village merchant with a full market square hub of four themed shops: blacksmith, arcanist, alchemist, and general provisioner, each with its own icon, tagline, and flavor text.",
              "Each merchant now gets a randomized in-world shop name (e.g., “Brightforge Smithy”, “Starfall Tomes”) chosen from a per-merchant name pool and stored on the save so it stays consistent for that playthrough.",
              "Village merchants stock only category-appropriate items (weapons/armor, magic gear, potions, general supplies) and traveling merchants pull a smaller, resource-aware selection tailored to your class resource (mana, fury, or blood).",
              "Merchant stock is now limited and persisted per playthrough: each item has a finite quantity, can sell out, and stock levels are saved and restored with your game state."
            ]
          },
          {
            title: "Merchant UI clarity & feedback",
            bullets: [
              "Shop screens now include a live “Your gold: Xg” line that updates immediately as you buy items, so you always know what you can afford.",
              "Each item row shows its effective price after economy modifiers plus a dedicated “In stock: N” label that ticks down as you purchase copies.",
              "Buy buttons now clearly show when you can’t purchase an item: they disable and change text to “Need Xg” when you don’t have enough gold, or “Sold out” when the shop has no remaining copies."
            ]
          },
          {
            title: "Weekly banking & ‘since you were away’ summary",
            bullets: [
              "The Emberwood Bank now tracks an absolute in-world calendar day via the time system and stores the last day interest was applied, enabling true weekly banking instead of per-visit interest.",
              "Defined a 7-day banking week: when you visit the bank, it computes how many full weeks have passed since your last interest tick and applies interest that many times with compounding to savings, investments, and outstanding loans.",
              "Added a dedicated “Emberwood Market Snapshot” card at the top of the bank screen that shows current prosperity/trade/security plus the weekly interest rates for savings, investments, and loans.",
              "If any full weeks have passed, a “Since you were away” card summarizes total interest earned on savings and investments and total loan interest added across all missed weeks so you can see what happened while you were off adventuring."
            ]
          },
          {
            title: "Tavern games expansion & presentation",
            bullets: [
              "Rebuilt the Tavern Games flow into its own ES6 module with a bank-style multi-card layout: tavern intro, current game summary, game selector, stake controls, and last-round recap live in one cohesive modal.",
              "Expanded the gambling lineup beyond Dice Duel, High Card, and Coin Toss with three new fantasy games: Dragonbone Dice (swingy 3d6 hoard chasing), Lucky Runes (tiered rune draws with jackpots), and Elemental Wheel (very swingy elemental spins).",
              "Game selection now uses pill-style buttons that fit their text within the pill and highlight the currently chosen game with a clear selected border; switching games automatically de-selects the old pill and updates the table description.",
              "Introduced patron personalities for the tavern tables (e.g., Mira the Cardsharp, Old Bram); the game tracks which patron you’re playing with and how long you’ve been at their table, adding mood-based flavor lines to wins, losses, and pushes."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Banking cadence & economy integration",
            bullets: [
              "Bank interest is now applied weekly based on state.time.dayIndex instead of every time you open the bank, using a configurable 7-day banking week for consistent behavior regardless of how often you visit Emberwood.",
              "Savings, investment, and loan rates remain driven by the village economy (prosperity, trade, security, and tier) but are now explicitly labeled as weekly rates in the UI, with small tags on each section showing X% / week.",
              "Bank account overview has been reshaped into a grid card (On hand, Savings, Invested, Loan balance) that mirrors the stat-grid presentation used elsewhere, making balances easier to scan at a glance."
            ]
          },
          {
            title: "Tavern service layout",
            bullets: [
              "The Emberwood Tavern screen has been refactored into its own ES6 module using the same card/row layout as the bank, with dedicated rows for renting a room, listening for rumors, and launching Tavern Games from the village hub.",
              "Resting now more clearly describes that it jumps time to the next morning, fully heals you, clears most lingering wounds, and feeds back into both the world time system and village economy day tick.",
              "Rumor listening is explicitly framed as a one-click service row with a short flavor description and a concise “Listen” button that logs a randomly chosen tavern rumor then returns you to the main game flow."
            ]
          },
          {
            title: "Gambling flow & controls",
            bullets: [
              "Stake management for tavern games has been pulled into a dedicated Stake & Options card with +/- stake buttons and a contextual coin-call toggle that only shows when playing Coin Toss.",
              "The Tavern Games modal now includes a “Last Round” card that mirrors what’s written to the combat log, so you can read round results without scrolling back through the main log.",
              "Play Round and Leave Table controls have been moved into a tavern-specific footer row that stays pinned at the bottom of the games modal while you scroll the game details above."
            ]
          }
        ]
      },
      {
        heading: "Fixed",
        items: [
          {
            title: "Tavern footer & modal bleed",
            bullets: [
              "Resolved an issue where the Tavern Games “Play Round” / “Leave Table” footer could leak into other modals: the footer is now created and destroyed within the tavern games flow only and is scoped with a tavern-footer-actions class.",
              "Fixed overflow and scrolling quirks where content could appear underneath the gambling footer; the footer now sits outside the scrollable body while the game content scrolls cleanly above it."
            ]
          },
          {
            title: "Merchant affordance feedback",
            bullets: [
              "Buying from merchants now reliably updates the shop’s “Your gold” line and per-item stock counters in real time after each purchase.",
              "Attempting to buy sold-out or unaffordable items now produces clear in-UI feedback (disabled buttons with explanatory text) in addition to log messages, reducing confusion when shopping in low-gold or low-stock situations."
            ]
          }
        ]
      }
    ]
  },
    {
    version: "0.4.1",
    title: "Developer Cheats Toggle & UI Polish",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Per-character Developer Cheats toggle",
            bullets: [
              "Added a Developer Cheats pill to the character creation screen that matches the Difficulty pill styling.",
              "The entire pill is clickable; a single tap toggles the selected state and clearly highlights when cheats are enabled.",
              "When active, a devCheatsEnabled flag is stored on the save and used to decide whether the in-game Cheat menu appears for that hero."
            ]
          }
        ]
      },
      {
        heading: "Fixed",
        items: [
          {
            title: "Developer Cheats pill interaction & layout",
            bullets: [
              "Fixed the Developer Cheats pill so its visual selected state always syncs with the underlying toggle.",
              "Resolved a script parsing issue so the pill now lights up correctly instead of silently failing.",
              "Aligned the Developer Cheats row with the Difficulty row and ensured the subtitle text scales cleanly on smaller screens."
            ]
          },
          {
            title: "Log & quest UI wiring",
            bullets: [
              "Hooked up collapsing behavior on the Quest and Log headers so tapping them properly expands or collapses their panels.",
              "Log filter chips now use a dedicated log-chip-active class so the active filter is clearly highlighted while you play."
            ]
          }
        ]
      }
    ]
  },
  {
    version: "0.4.0",
    title: "Village Economy, Banking & World Time",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "World time & day–night cycle",
            bullets: [
              "Introduced a dedicated time system module that tracks year, day of the week, and part of day (morning / evening / night).",
              "Exploring advances time in discrete steps; the log now calls out when time passes and when a new day begins.",
              "A small HUD time label (via updateTimeDisplay and #timeLabel) shows the current in-world date and time in a short or long format."
            ]
          },
          {
            title: "Village economy simulation",
            bullets: [
              "Added a villageEconomy state block with prosperity, trade, and security values plus an economy tier (Struggling / Stable / Thriving).",
              "Merchant prices and tavern rest costs now come from the economy tier, making goods cheaper in thriving times and pricier when the village struggles.",
              "The economy drifts slightly each new day and responds to your actions: clearing monsters near trade routes and spending gold at merchants nudges prosperity and trade."
            ]
          },
          {
            title: "Emberwood Bank (savings, loans, and investments)",
            bullets: [
              "New Emberwood Bank screen in the village with its own ES6 module (bank.js).",
              "You can deposit and withdraw gold into a safe savings account that accrues modest interest over time.",
              "Investments offer higher returns than savings but are treated as a separate pool of gold tracked by the bank.",
              "You can take out a loan with a balance and rate; interest is applied automatically whenever you visit the bank.",
              "Bank interest rates for savings, investments, and loans are dynamically computed from the village economy (prosperity/trade), and are shown on the bank screen."
            ]
          },
          {
            title: "Tavern menu & in-modal gambling",
            bullets: [
              "The village now has a full Emberwood Tavern modal with options to rest, hear rumors, or join tavern games.",
              "Gambling has been moved into its own ES6 module (tavernGames.js) and is launched from the Tavern menu instead of a separate button.",
              "All gambling games (Dice Duel, High Card, Coin Toss) are played entirely inside a dedicated tavern games modal.",
              "Stake controls, coin call buttons, and detailed round results are displayed directly in the modal, mirroring what appears in the log so you never have to close it to see outcomes."
            ]
          },
          {
            title: "Area selection & free exploration",
            bullets: [
              "Added a Choose Where to Explore modal that lets you pick your current region (village, Emberwood Forest, Ruined Spire, etc.).",
              "Once you choose an area, the Explore button continues exploring that same region until you explicitly use Change Area again.",
              "A new Change Area button in the main actions panel brings the area picker back at any time, enabling free roaming instead of being locked to the main quest path."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Quest travel & goblin hints",
            bullets: [
              "Main quest steps no longer auto-travel you to Emberwood Forest; quests now respect your current chosen area.",
              "Before the Goblin Warlord is defeated, villagers now give a one-time flavor hint about goblins in Emberwood Forest instead of forcing travel.",
              "The hint is gated behind an internal goblinWhisperShown flag so it appears only once and persists across saves."
            ]
          },
          {
            title: "Village hub actions & merchants",
            bullets: [
              "Reworked the village actions panel to include Tavern, Bank, Merchant, Explore, and Change Area in a consistent layout.",
              "Merchant interactions in the village now display a small economy line describing the current tier and how prices feel (e.g., “prices are surprisingly fair”).",
              "Wandering merchants outside the village remain a rarer encounter and are described as charging extra for the risk of traveling alone."
            ]
          },
          {
            title: "Save/load format",
            bullets: [
              "Extended save data to include time, villageEconomy, and bank state blocks.",
              "Load logic initializes time and economy for older saves, ensuring backward compatibility while still enabling the new systems.",
              "After loading, the HUD time label is refreshed so the current date and time are immediately visible."
            ]
          }
        ]
      },
      {
        heading: "Fixed",
        items: [
          {
            title: "Travel & action panel consistency",
            bullets: [
              "Resolved issues where traveling between the village and other regions could leave the wrong action buttons visible.",
              "Ensured that returning to the village reliably shows the Tavern, Bank, Merchant, Explore, and Change Area options.",
              "Improved interaction between exploration, travel, and quest logic so you are not yanked out of your chosen area by quest progression."
            ]
          },
          {
            title: "Goblin whisper flavor spam",
            bullets: [
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
    version: "0.3.1",
    title: "In-Game Changelog Viewer",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "In-game Changelog screen",
            bullets: [
              "Added a Changelog button to the main menu (and optionally the in-game pause menu) that opens a dedicated changelog screen.",
              "Changelog content is rendered inside a modal using collapsible sections for each version.",
              "Latest version is expanded by default so new changes are visible at a glance.",
              "Older versions are grouped under collapsible headers to keep the view compact on phone screens.",
			  "Added the changelog to the in game pause menu."
            ]
          },
          {
            title: "ES6 module–driven changelog data",
            bullets: [
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
    version: "0.3.0",
    title: "Class Expansion, Dynamic Difficulty & Smarter Companions",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "New playable classes",
            bullets: [
              "Introduced multiple new classes with distinct base stats, resources (Mana / Fury), and 3-ability starting kits.",
              "Each class has a fantasy description and tailored combat role (e.g., ranged DPS, tank-healer hybrid, lifedrain caster)."
            ]
          },
          {
            title: "Dynamic Difficulty mode",
            bullets: [
              "New Dynamic option alongside Easy / Normal / Hard.",
              "Tracks an internal difficulty band plus streaks of easy or hard fights.",
              "Automatically adjusts enemy HP, enemy damage, player damage, and AI smartness based on recent performance.",
              "HUD label reflects the current tuning (e.g., Dynamic (Easy), Dynamic (Hard))."
            ]
          },
          {
            title: "Companion roster expansion",
            bullets: [
              "Added several new companions to reach a full lineup of 8.",
              "Includes offensive familiars, support/tank beasts, resource-battery pets, and damage-reflecting shadows.",
              "Cheat Menu updated with summon / dismiss buttons for all companions."
            ]
          },
          {
            title: "Companion Ability System 2.0",
            bullets: [
              "Each companion now has a 4-ability kit.",
              "Abilities include damage, heal, shield, ward, bleed/burn, resource restore, and reflect.",
              "Abilities use cooldowns, apply status effects (stun, bleed, shield, reflect), and have flavor descriptions.",
              "Companion AI scores abilities each turn based on HP, enemy HP, active statuses, and effectiveness history.",
              "Falls back to a basic attack when no ability beats a normal hit."
            ]
          },
          {
            title: "Mid-combat saving and battle resume",
            bullets: [
              "Save data now includes an inCombat flag.",
              "Stores a full snapshot of currentEnemy.",
              "Stores log entries and the current log filter mode.",
              "Loading a save restores the current fight and enemy HUD state.",
              "Load Last Save from the defeat screen plugs into this system."
            ]
          },
          {
            title: "Enemy HUD panel",
            bullets: [
              "Dedicated right-side panel showing enemy name and behavior tags (Boss / Dragon / Warlord / Caster / Aggressive / Cunning).",
              "Displays HP bar with numeric HP.",
              "Shows current statuses such as Bleeding, Chilled, Guarding, Ward, Reflect, and more.",
              "Panel hides automatically when not in combat."
            ]
          },
          {
            title: "Log filters & collapsible panels",
            bullets: [
              "Added log filter chips (All / System / Danger / Good) to quickly focus on relevant messages.",
              "Quest box and log can be collapsed or expanded via their headers to improve mobile readability."
            ]
          },
          {
            title: "Theme system",
            bullets: [
              "New theme selector in Settings with multiple visual themes (arcane, inferno, forest, holy, shadow, etc.).",
              "Active theme stored in localStorage and restored on startup."
            ]
          },
          {
            title: "Feedback / bug report helper",
            bullets: [
              "Feedback modal lets players choose a category (Bug / UI / Balance / Suggestion / Other).",
              "Collects context such as player name, class, level, area, and difficulty.",
              "Copies a structured report to the clipboard for easy pasting into an external tracker."
            ]
          },
          {
            title: "Random name generator",
            bullets: [
              "Random Name button in character creation that picks from a curated list of fantasy names."
            ]
          },
          {
            title: "Character Sheet quick access",
            bullets: [
              "Character button added alongside other bottom actions in exploration and combat.",
              "Tapping the player name in the HUD also opens the Character Sheet."
            ]
          },
          {
            title: "Pause / game menu",
            bullets: [
              "In-game Game Menu modal with Save Game, Settings, and Quit to Main Menu."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Difficulty handling",
            bullets: [
              "Difficulty can now be changed mid-run from Settings as well as at character creation.",
              "Dynamic difficulty mode’s internal band fully replaces older static tuning logic."
            ]
          },
          {
            title: "Companion stat integration",
            bullets: [
              "Companions now apply their HP bonus directly to the hero’s max HP and remove it cleanly when dismissed.",
              "HUD updates immediately when a companion is summoned or dismissed."
            ]
          },
          {
            title: "Cheat Menu",
            bullets: [
              "Shows all 8 companions with clearly labeled summon buttons and a shared Dismiss Companion option.",
              "Footer shows the current difficulty label and the status of God Mode / Always Crit."
            ]
          }
        ]
      },
      {
        heading: "Fixed",
        items: [
          {
            title: "Battle restoration edge cases",
            bullets: [
              "Loading mid-combat now restores the correct enemy and statuses.",
              "Rebuilds the enemy HUD panel and recreates the correct action buttons.",
              "Fixes cases where you could load into combat with no visible enemy."
            ]
          },
          {
            title: "Ward / reflect behavior",
            bullets: [
              "Wards now tick down correctly and log their expiration.",
              "Wards and reflect effects no longer silently vanish or stack incorrectly.",
              "Reflect effects have reliable durations and clear logging when they end."
            ]
          },
          {
            title: "Older save compatibility",
            bullets: [
              "Load logic initializes missing fields (skills, skillPoints, dynamicDifficulty, companion info) for older saves.",
              "recalcPlayerStats() handles partially populated state safely."
            ]
          }
        ]
      }
    ]
  },

  {
    version: "0.2.4",
    title: "Global CSS & Layout Polish",
    sections: [
      {
        heading: "Changed",
        items: [
          {
            title: "UI / UX",
            bullets: [
              "Refined global visual theme while keeping the neon-fantasy look (deep blues, purples, cyan accents).",
              "Standardized card styling (radius, borders, backgrounds) across HUD, modals, log, quest panels, and the actions panel.",
              "Reworked Cheat Menu companion buttons into a dedicated horizontal scroll row to prevent awkward wrapping on small screens."
            ]
          },
          {
            title: "Technical layout clean-up",
            bullets: [
              "Consolidated CSS into sections (Base, Buttons, HUD, Game layout, Actions, Modal, Settings, Character Sheet, Responsive).",
              "Ensured scrollable containers such as #log, #actions, .companion-actions, and .char-tabs behave consistently with smooth mobile scrolling."
            ]
          }
        ]
      }
    ]
  },

  {
    version: "0.2.3",
    title: "Character Sheet 2.0 (Tabs & Visual Hierarchy)",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Tabbed Character Sheet",
            bullets: [
              "Introduced a tab bar at the top of the sheet using horizontally scrollable pill buttons.",
              "Tabs cover key sections such as Overview, Stats, Skills, Equipment, and Companions."
            ]
          },
          {
            title: "Visual stat hierarchy",
            bullets: [
              "Each tab uses char-section and char-section-title for clear spacing and titles.",
              "char-divider-top adds subtle separators between major blocks.",
              "Added small stat icons and color-coded values (Attack, Magic, Armor, Speed, etc.)."
            ]
          },
          {
            title: "Equipment and companion presentation",
            bullets: [
              "equip-row layout for side-by-side label/value entries.",
              "Empty slots use a muted equip-empty style.",
              "Companion tab shows role, attack, HP bonus, and flavor description in a dedicated block."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "CSS organization",
            bullets: [
              "Consolidated Character Sheet CSS into a single dedicated section.",
              "Removed duplicate definitions for char-section, char-tab, stat-grid, and equipment-related classes."
            ]
          }
        ]
      }
    ]
  },

  {
    version: "0.2.2",
    title: "Actions Panel Refactor",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Scrollable actions grid",
            bullets: [
              "Bottom action buttons now live in a fixed-height, vertically scrollable #actions container.",
              "Uses a 2-column grid with consistent gaps and padding."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Button layout & spacing",
            bullets: [
              "Ensured no buttons touch the container edges.",
              "Standardized inner padding around buttons for a balanced grid look.",
              "Prevents the main screen from stretching when more buttons are added by letting the actions container scroll."
            ]
          }
        ]
      },
      {
        heading: "Fixed",
        items: [
          {
            title: "Layout stability",
            bullets: [
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
    version: "0.2.1",
    title: "Post-Main-Quest Exploration & Combat",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Post-quest free play",
            bullets: [
              "After defeating the final boss, you can continue exploring areas (forest, ruins, etc.).",
              "You can keep fighting random encounters and grinding XP/loot or testing builds."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Quest behavior at endgame",
            bullets: [
              "Quest box properly marks the main quest as Completed.",
              "World state no longer locks the player out of normal exploration after the final story beat."
            ]
          }
        ]
      }
    ]
  },

  {
    version: "0.2.x",
    title: "Difficulty & Settings Flow Cleanup",
    sections: [
      {
        heading: "Changed",
        items: [
          {
            title: "Difficulty selection flow",
            bullets: [
              "Difficulty is now chosen during character creation via a pill-style selector (Easy / Normal / Hard).",
              "Selected difficulty is stored in state.difficulty from the moment a new game starts.",
              "Difficulty value is used consistently for enemy HP and damage scaling, player damage modifiers, and enemy AI decision-making.",
              "Difficulty is displayed in the HUD header (Class • Difficulty) and in the Character Sheet overview."
            ]
          },
          {
            title: "Settings screen",
            bullets: [
              "Removed the old difficulty dropdown from Settings to avoid conflicting sources of truth.",
              "Character creation UI uses clickable class cards with name, description, and optional icon slot.",
              "Selected class is highlighted with a stronger border and background."
            ]
          }
        ]
      },
      {
        heading: "Fixed",
        items: [
          {
            title: "Initialization & settings bugs",
            bullets: [
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
    version: "0.2.0",
    title: "Skill System & Character Sheet Update",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Skill system (Strength / Endurance / Willpower)",
            bullets: [
              "Introduced a skill-based progression where each level grants 1 skill point.",
              "Players choose which attribute to increase via a Level-Up Skill Selection modal.",
              "Strength boosts Attack, Endurance boosts Max HP and Armor, Willpower boosts Magic and Max Resource.",
              "Skills fully integrate into stat recalculation and gear scaling."
            ]
          },
          {
            title: "Derived stat bonus display",
            bullets: [
              "Character Sheet shows how each stat is composed.",
              "Attack = class base + skill bonus + weapon bonus.",
              "Magic = class base + skill bonus + weapon bonus.",
              "Max HP = base + Endurance bonus.",
              "Armor = base + skill bonus + armor gear.",
              "Max Resource = base + Willpower bonus + gear bonus."
            ]
          },
          {
            title: "Character Sheet overhaul",
            bullets: [
              "Reorganized into sections: Overview, Core Stats, Skills, Derived Bonuses, Equipment, Companion, Quest Summary.",
              "Added a companion summary block with name, role, attack, HP bonus, and description."
            ]
          },
          {
            title: "Companion system",
            bullets: [
              "Introduced Ember Wolf (DPS), Stone Golem (tank), Moonlit Sprite (healer), and Bound Skeleton (bleed/debuff).",
              "Companions scale automatically with player level.",
              "Companions act after the player in combat (damage, heal, bleed, or shield).",
              "Provide passive bonuses such as increased player HP.",
              "Cheat Menu allows summoning each companion and dismissing the current one.",
              "Companion data is stored in the save file."
            ]
          },
          {
            title: "HUD swipe switching",
            bullets: [
              "Swiping the top HUD toggles between player stats (HP/resource) and companion stats (Companion Attack / HP bonus).",
              "Added mobile-friendly touch handling (touchstart/touchend).",
              "HUD auto-locks to player view if no companion is active."
            ]
          },
          {
            title: "HUD rendering upgrade",
            bullets: [
              "updateHUD() rewritten to support dual display via state.hudView.",
              "Companion stats reuse the existing bar UI for consistency.",
              "Player XP, level, and gold remain always visible."
            ]
          },
          {
            title: "Actions panel & UI improvements",
            bullets: [
              "Bottom action buttons placed in a vertically scrollable box.",
              "Consistent mobile layout with smooth scrolling.",
              "Companion buttons in the Cheat Menu scroll horizontally without shifting the modal."
            ]
          }
        ]
      },
      {
        heading: "Changed",
        items: [
          {
            title: "Combat sequencing",
            bullets: [
              "Companion actions now occur after the player and before the enemy.",
              "Both ability usage and basic attacks trigger companion behavior."
            ]
          },
          {
            title: "Saving / loading",
            bullets: [
              "saveGame() and loadGame() persist and restore companion information.",
              "Character creation ensures skills and skillPoints are initialized even for older saves."
            ]
          }
        ]
      },
      {
        heading: "Fixed",
        items: [
          {
            title: "Character Sheet layout",
            bullets: [
              "Derived bonuses no longer appear inside the equipment block.",
              "Skill and companion sections render correctly even when loading older save data."
            ]
          }
        ]
      }
    ]
  },

  {
    version: "0.1.0",
    title: "Initial Prototype (2025-12-16)",
    sections: [
      {
        heading: "Added",
        items: [
          {
            title: "Core project structure",
            bullets: [
              "Separated the project into index.html, styles.css, and game.js.",
              "Phone-first layout with a centered, max-width container and responsive UI."
            ]
          },
          {
            title: "Main menu",
            bullets: [
              "New Game to start a fresh adventure.",
              "Load Game powered by localStorage.",
              "Settings with difficulty selector, volume slider (visual), and text speed slider (placeholder)."
            ]
          },
          {
            title: "Character creation",
            bullets: [
              "Hero creation with name entry, class selection, initial stats, and starting gear.",
              "Difficulty was originally chosen in Settings (pre-0.2.x behavior)."
            ]
          },
          {
            title: "Exploration & combat loop",
            bullets: [
              "Simple area-based exploration (village hub plus nearby danger zones).",
              "Turn-based combat: player vs single enemy with physical and magical attacks.",
              "HP and resource bars with XP, level, and gold tracking.",
              "Single main quest line guiding the player through early content."
            ]
          },
          {
            title: "Merchant & items",
            bullets: [
              "Basic merchant interaction to buy simple weapons and armor.",
              "Items adjust core stats when equipped."
            ]
          },
          {
            title: "Cheat Menu (debug tools)",
            bullets: [
              "Debug overlay for development/testing: add gold and XP, level up, toggle God Mode, toggle Always Crit."
            ]
          },
          {
            title: "Saving & loading",
            bullets: [
              "Auto-save on key events (battles, exploration, purchases).",
              "Manual save from an in-game menu.",
              "Load Game from main menu and defeat screen (Load Last Save).",
              "Save data stored in localStorage under a versioned key."
            ]
          }
        ]
      },
      {
        heading: "Known limitations / next steps",
        items: [
          {
            title: "Prototype constraints",
            bullets: [
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
