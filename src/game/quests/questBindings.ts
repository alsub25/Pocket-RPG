// js/game/quests/questBindings.js
//
// Adapter that binds questSystem functions to the calling convention expected by
// the rest of the game (many older callers expect quest functions with no `state`
// argument, because engine.js historically used a global `state`).

import {
    ensureQuestStructures,
    initMainQuest,
    openElderRowanDialog,
    openQuestJournal,
    startSideQuest,
    advanceSideQuest,
    completeSideQuest,
    updateQuestBox,
    maybeTriggerSideQuestEvent,
    handleExploreQuestBeats,
    applyQuestProgressOnItemGain,
    applyQuestProgressOnEnemyDefeat,
    hasAllOathSplinters,
    buildProgressionAuditReport
} from './questSystem.js'

import { buildQuestTriggerRegistry } from './questTriggerRegistry.js'

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

    // Compile the data-driven trigger registry once per binding creation.
    // (Registry is based on QUEST_DEFS, not runtime state.)
    const questRegistry = buildQuestTriggerRegistry(ctx && ctx.QUEST_DEFS)

    // This object is forwarded into questSystem calls.
    const api = {
        addLog: ctx.addLog,
        setScene: ctx.setScene,
        openModal: ctx.openModal,
        closeModal: ctx.closeModal,
        makeActionButton: ctx.makeActionButton,
        getItemDef: ctx.getItemDef,
        addItemToInventory: ctx.addItemToInventory,
        saveGame: ctx.saveGame,
        updateHUD: ctx.updateHUD,
        recalcPlayerStats: ctx.recalcPlayerStats,
        startBattleWith: ctx.startBattleWith,

        // Data-driven trigger registry (fast objective progression lookups)
        questRegistry
    }

    return {
        // Core
        ensureQuestStructures: () => ensureQuestStructures(getState()),
        initMainQuest: () => initMainQuest(getState()),
        openElderRowanDialog: () => openElderRowanDialog(getState(), api),

        // Side quest lifecycle
        startSideQuest: (id) => startSideQuest(getState(), id, api),
        advanceSideQuest: (id, nextStep) =>
            advanceSideQuest(getState(), id, nextStep, api),
        completeSideQuest: (id, rewardsFn) =>
            completeSideQuest(getState(), id, rewardsFn, api),

        // UI
        updateQuestBox: () => updateQuestBox(getState()),
        openQuestJournal: () => openQuestJournal(getState(), api),

        // Event runners
        maybeTriggerSideQuestEvent: (areaId) =>
            maybeTriggerSideQuestEvent(getState(), areaId, api),
        handleExploreQuestBeats: (areaId) =>
            handleExploreQuestBeats(getState(), areaId, api),
        applyQuestProgressOnItemGain: (itemId, qty = 1) =>
            applyQuestProgressOnItemGain(getState(), itemId, qty, api),
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
