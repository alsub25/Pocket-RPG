// js/game/quests/questDefaults.js
// Centralized defaults for quest-related state + flags.
//
// NOTE:
// - Use factory functions to avoid shared object references across new games.
// - These defaults are also used by ensureQuestStructures() to backfill old saves.

export function createDefaultQuestState() {
    return {
        main: null,
        side: {},
        pinned: null
    }
}

export function createDefaultQuestFlags() {
    return {
        // Main quest progression / unlock flags
        mainQuestAccepted: false,
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

        // Chapter I: post-Warlord debrief beat (Step 1.5)
        goblinRowanDebriefPending: false,
        goblinRowanDebriefShown: false,

        // Chapter I (expanded): pre-Warlord beats
        ch1CaptainBriefed: false,
        ch1ScribeTrailsLearned: false,
        ch1SalvePrepared: false,
        ch1RaidersPushedBack: false,
        ch1SnarelineFound: false,
        ch1TrapperDefeated: false,
        ch1SupplyRouteFound: false,
        ch1CacheBurned: false,
        ch1DrumsSilenced: false,
        ch1CaptainDefeated: false,
        ch1SigilRecovered: false,

        // Chapter II — The Blackbark Oath
        blackbarkChapterStarted: false,
        barkScribeMet: false,

        // Chapter II (expanded): Captain Elara tallies + Quiet Ink arc
        ch2ElaraTalliesShown: false,
        chapter2SplinterBindingDone: false,
        chapter2OathgroveDone: false,
        allOathSplintersSceneShown: false,
        oathgroveUnlocked: false,
        chapter2QuietInkStarted: false,

        // Chapter II (expanded): Oathgrove boss bookkeeping
        sapboundWardenDefeated: false,


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
        wardenGesturesCompleted: false,

        // Chapter III — The Hollow Crown (Patch 1.2.5 story expansion)
        chapter3Started: false,
        chapter3IntroQueued: false,
        chapter3IntroShown: false,
        chapter3CouncilDone: false,
        chapter3CouncilStance: null, // 'fortify' | 'appease' | 'investigate'

        // Chapter III (expanded): new exploration-gated beats
        blackbarkDepthsUnlocked: false,
        chapter3InvestigationDone: false,
        starfallRidgeUnlocked: false,
        chapter3StarfallShardsDone: false,

        // Chapter III (expanded): Starfall Ridge mini-boss
        starfallSentinelDefeated: false,
        starfallSentinelEncountered: false,

        // Chapter III (expanded): Starfall mini-boss
        starfallMiniBossDefeated: false,
        starfallMiniBossSeen: false,

        chapter3CrownEchoTaken: false,
        chapter3CrownEchoHintShown: false,
        chapter3CrownEchoDecoded: false,

        chapter3StarIronPin: false,
        chapter3GraveLatch: false,

        chapter3RitualAllyChosen: false,
        chapter3RitualAlly: null, // 'rowan' | 'scribe' | 'ash'

        hollowRegentDefeated: false,
        chapter3FinalChoiceMade: false,
        chapter3Ending: null, // 'seal' | 'bargain' | 'burn'

        // Chapter IV — The Rootbound Court (Patch 1.2.5 continuation)
        chapter4Started: false,
        chapter4IntroQueued: false,
        chapter4IntroShown: false,

        chapter4VerdantLens: false,
        chapter4MarshWritsDone: false,
        chapter4MarshWritsClueShown: false,
        chapter4FrozenWrit: false,
        chapter4BoneWrit: false,
        chapter4SealOfVerdict: false,

        chapter4MagistrateDefeated: false,
        chapter4FinalChoiceMade: false,
        chapter4Ending: null // 'accept' | 'defy' | 'rewrite'
    }
}
