// questTriggerRegistry.js
// Builds fast lookup tables for data-driven quest objective progression.
//
// This registry is intentionally "dumb": it only knows how to map events
// (enemy defeat / item gain) to objective slots. Higher-level story beats
// (area exploration scenes, boss gating, etc.) remain in questSystem.

/**
 * @typedef {Object} QuestObjectiveTrigger
 * @property {'main'|'side'} questKind
 * @property {string} questId              // 'main' or side quest id
 * @property {number} step                // quest step where this objective is active
 * @property {number} objectiveIndex       // index inside QUEST_DEFS[*].objectives[step]
 * @property {'kill'|'collect'} type
 * @property {string} label
 * @property {number} required
 */

/**
 * @typedef {Object} QuestTriggerRegistry
 * @property {Record<string, QuestObjectiveTrigger[]>} killByEnemyId
 * @property {Record<string, QuestObjectiveTrigger[]>} collectByItemId
 */

function _push(map, key, trigger) {
    if (!key) return
    const k = String(key)
    if (!map[k]) map[k] = []
    map[k].push(trigger)
}

function _safeNum(n, fallback) {
    const v = Number(n)
    return Number.isFinite(v) ? v : fallback
}

/**
 * Compile a registry from QUEST_DEFS.
 *
 * @param {any} questDefs
 * @returns {QuestTriggerRegistry}
 */
export function buildQuestTriggerRegistry(questDefs) {
    const reg = {
        killByEnemyId: Object.create(null),
        collectByItemId: Object.create(null)
    }

    if (!questDefs || typeof questDefs !== 'object') return reg

    const addQuest = (kind, qid, qdef) => {
        if (!qdef || typeof qdef !== 'object') return
        const obj = qdef.objectives
        if (!obj || typeof obj !== 'object') return

        Object.keys(obj).forEach((stepKey) => {
            const step = _safeNum(stepKey, null)
            if (step === null) return

            const list = obj[stepKey]
            if (!Array.isArray(list) || !list.length) return

            list.forEach((o, idx) => {
                if (!o || typeof o !== 'object') return
                const type = String(o.type || '')
                const label = String(o.label || '')
                const required = Math.max(1, Math.floor(_safeNum(o.required, 1)))

                /** @type {QuestObjectiveTrigger} */
                const base = {
                    questKind: kind,
                    questId: String(qid),
                    step,
                    objectiveIndex: idx,
                    type: type === 'kill' ? 'kill' : 'collect',
                    label,
                    required
                }

                if (type === 'kill') {
                    const ids = Array.isArray(o.enemyIds) ? o.enemyIds : []
                    ids.forEach((eid) => {
                        _push(reg.killByEnemyId, eid, base)
                    })
                }

                if (type === 'collect') {
                    const itemId = o.itemId
                    if (itemId) _push(reg.collectByItemId, itemId, base)
                }
            })
        })
    }

    // Main
    if (questDefs.main) addQuest('main', 'main', questDefs.main)

    // Side
    if (questDefs.side && typeof questDefs.side === 'object') {
        Object.keys(questDefs.side).forEach((id) => {
            addQuest('side', id, questDefs.side[id])
        })
    }

    return reg
}
