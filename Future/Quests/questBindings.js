// Future/Quests/questBindings.js
//
// Adapter that binds questSystem functions to the calling convention expected by
// the rest of the game (many older callers expect quest functions with no `state`
// argument, because Future.js historically used a global `state`).

import {
    ensureQuestStructures,
    initMainQuest,
    startSideQuest,
    advanceSideQuest,
    completeSideQuest,
    updateQuestBox,
    maybeTriggerSideQuestEvent,
    handleExploreQuestBeats,
    applyQuestProgressOnEnemyDefeat,
    hasAllOathSplinters,
    buildProgressionAuditReport
} from './questSystem.js'

/**
 * @typedef {{
 *  getState: () => any,
 *  // gameplay/UI hooks
 *  addLog?: (text: string, type?: string) => void,
 *  setScene?: (title: string, text: string) => void,
 *  openModal?: (title: string, builder: (body: HTMLElement) => void) => void,
 *  closeModal?: () => void,
 *  makeActionButton?: (label: string, onClick: Function, extraClass?: string) => HTMLButtonElement,
 *  addItemToInventory?: (itemId: string, qty?: number) => void,
 *  saveGame?: () => void,
 *  updateHUD?: () => void,
 *  recalcPlayerStats?: () => void,
 *  startBattleWith?: (enemyId: string) => void,
 *  // meta
 *  GAME_PATCH?: string,
 *  SAVE_SCHEMA?: number,
 * }} QuestBindingContext
 */

export function createQuestBindings(ctx) {
    const getState = ctx && typeof ctx.getState === 'function' ? ctx.getState : () => null

    // This object is forwarded into questSystem calls.
    const api = {
        addLog: ctx.addLog,
        setScene: ctx.setScene,
        openModal: ctx.openModal,
        closeModal: ctx.closeModal,
        makeActionButton: ctx.makeActionButton,
        addItemToInventory: ctx.addItemToInventory,
        saveGame: ctx.saveGame,
        updateHUD: ctx.updateHUD,
        recalcPlayerStats: ctx.recalcPlayerStats,
        startBattleWith: ctx.startBattleWith
    }

    return {
        // Core
        ensureQuestStructures: () => ensureQuestStructures(getState()),
        initMainQuest: () => initMainQuest(getState()),

        // Side quest lifecycle
        startSideQuest: (id) => startSideQuest(getState(), id, api),
        advanceSideQuest: (id, nextStep) =>
            advanceSideQuest(getState(), id, nextStep, api),
        completeSideQuest: (id, rewardsFn) =>
            completeSideQuest(getState(), id, rewardsFn, api),

        // UI
        updateQuestBox: () => updateQuestBox(getState()),

        // Event runners
        maybeTriggerSideQuestEvent: (areaId) =>
            maybeTriggerSideQuestEvent(getState(), areaId, api),
        handleExploreQuestBeats: (areaId) =>
            handleExploreQuestBeats(getState(), areaId, api),
        applyQuestProgressOnEnemyDefeat: (enemy) =>
            applyQuestProgressOnEnemyDefeat(getState(), enemy, api),

        // Utilities
        hasAllOathSplinters: () => hasAllOathSplinters(getState()),
        buildProgressionAuditReport: () =>
            buildProgressionAuditReport(getState(), {
                GAME_PATCH: ctx.GAME_PATCH,
                SAVE_SCHEMA: ctx.SAVE_SCHEMA
            })
    }
}
