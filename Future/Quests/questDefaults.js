// Future/Quests/questDefaults.js
// Centralized defaults for quest-related state + flags.
//
// NOTE:
// - Use factory functions to avoid shared object references across new games.
// - These defaults are also used by ensureQuestStructures() to backfill old saves.

export function createDefaultQuestState() {
    return {
        main: null,
        side: {}
    }
}

export function createDefaultQuestFlags() {
    return {
        // Main quest progression / unlock flags
        metElder: false,
        goblinBossDefeated: false,
        dragonDefeated: false,

        // Zone unlocks
        marshUnlocked: false,
        frostpeakUnlocked: false,
        catacombsUnlocked: false,
        keepUnlocked: false,

        // Boss completion flags
        marshWitchDefeated: false,
        frostGiantDefeated: false,
        lichDefeated: false,
        obsidianKingDefeated: false,

        // Main quest epilogue
        epilogueShown: false,

        // One-time hint
        goblinWhisperShown: false,

        // Chapter II — The Blackbark Oath
        blackbarkChapterStarted: false,
        barkScribeMet: false,

        // Oath-Splinters (Step 10)
        oathShardSapRun: false,
        oathShardWitchReed: false,
        oathShardBoneChar: false,

        // Quiet Roots Trial / Ash-Warden / Gate / Choice
        quietRootsTrialDone: false,
        ashWardenMet: false,
        blackbarkGateFound: false,
        blackbarkChoiceMade: false,
        blackbarkChoice: null,

        // Ending bookkeeping (introduced in 1.1.2)
        blackbarkEpilogueShown: false,
        blackbarkQuestRewarded: false,

        // Side quest: "The Warden’s Gesture"
        wardenGestureMercy: false,
        wardenGestureRestraint: false,
        wardenGestureProtection: false,
        wardenGesturesCompleted: false
    }
}
