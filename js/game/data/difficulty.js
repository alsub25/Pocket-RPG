// js/game/data/difficulty.js
// Static difficulty configuration and progression constants.
// Extracted from engine.js in Patch 1.2.72 to keep the engine focused on orchestration.

export const DIFFICULTY_CONFIG = {
    easy: {
        id: 'easy',
        name: 'Easy',
        enemyHpMod: 0.85,
        enemyDmgMod: 0.8,
        playerDmgMod: 1.1,
        aiSmartness: 0.5
    },
    normal: {
        id: 'normal',
        name: 'Normal',
        enemyHpMod: 1,
        enemyDmgMod: 1,
        playerDmgMod: 1,
        aiSmartness: 0.7
    },
    hard: {
        id: 'hard',
        name: 'Hard',
        enemyHpMod: 1.3,
        enemyDmgMod: 1.25,
        playerDmgMod: 0.95,
        aiSmartness: 0.95
    },
    dynamic: {
        id: 'dynamic',
        name: 'Dynamic',
        enemyHpMod: 1,
        enemyDmgMod: 1,
        playerDmgMod: 1,
        aiSmartness: 0.8
    }
}

export const MAX_PLAYER_LEVEL = 50 // used by dev cheats; raise if you want a longer grind
