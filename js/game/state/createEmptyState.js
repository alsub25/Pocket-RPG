// js/game/state/createEmptyState.js
// Game-specific initial save-state factory.
// This is intentionally NOT part of the proprietary engine core.

import { createDefaultQuestState, createDefaultQuestFlags } from '../quests/questDefaults.js'

export function createEmptyState() {
    // Settings are managed by locus_settings (engine settings service).
    // These are just reasonable defaults; settingsPlugin will override them
    // with actual values from locus_settings immediately after engine startup.
    const defaultVolume = 80 // matches the HTML default
    const defaultTextSpeed = 100 // matches the HTML default
    const defaultMusicEnabled = true
    const defaultSfxEnabled = true
    const defaultReduceMotion = false
    const defaultAutoEquipLoot = false

    return {
        player: null,
        area: 'village', // village, forest, ruins
        difficulty: 'normal',

        // Global settings (managed by locus_settings via settingsPlugin)
        settingsVolume: defaultVolume, // 0-100
        settingsTextSpeed: defaultTextSpeed, // 0-200 (100 = normal)

        // Motion / animation accessibility (managed by locus_settings)
        settingsReduceMotion: defaultReduceMotion,

        // Audio toggles (managed by locus_settings)
        musicEnabled: defaultMusicEnabled,
        sfxEnabled: defaultSfxEnabled,

        // Inventory QoL (managed by locus_settings)
        settingsAutoEquipLoot: defaultAutoEquipLoot,

        // dynamic difficulty tracking
        dynamicDifficulty: {
            band: 0,
            tooEasyStreak: 0,
            struggleStreak: 0
        },

        quests: createDefaultQuestState(),
        flags: {
            ...createDefaultQuestFlags(),
            godMode: false,
            alwaysCrit: false,
            neverCrit: false,

            // NEW: gate the Cheat menu behind a dev toggle
            devCheatsEnabled: false,

        },

        // Debug / QA helpers (persisted in the save)
        debug: {
            useDeterministicRng: false,
            rngSeed: (Date.now() >>> 0),
            rngIndex: 0,
            captureRngLog: false,
            rngLog: [],
            lastAction: '',
            inputLog: [],
            lastInvariantIssues: null
        },
        inCombat: false,
        // Multi-enemy combat (Patch 1.1.9): currentEnemy is the player's current target.
        currentEnemy: null,
        enemies: [],
        targetEnemyIndex: 0,
        combat: null,
        log: [],
        logFilter: 'all',
        lastSaveJson: null,

        // NEW: world time and village economy state
        time: null,
        villageEconomy: null,
        government: null,
        bank: null,
        villageMerchantNames: null,
        merchantStock: null,
        merchantStockMeta: null,

        // Simulation meta (used for catch-up ticks & anti-exploit guards)
        sim: {
            lastDailyTickDay: null
        },

        // NEW: container for village-level state (population, etc.)
        village: null,

        // Developer-only gambling tuning
        gamblingDebug: {
            mode: 'normal', // 'normal' | 'playerFavored' | 'houseFavored'
            payoutMultiplier: 1 // 0.5, 1, 2, etc – applied to WIN payouts only
        },

        // One active companion (or null)
        companion: null,

        // Which entity the HUD is currently showing: 'player' or 'companion'
        hudView: 'player',

        // UI-only state (does not affect core combat logic)
        ui: {
            exploreChoiceMade: false
        }
    }
}
