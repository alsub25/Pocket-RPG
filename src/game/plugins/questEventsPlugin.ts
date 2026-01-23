// js/game/plugins/questEventsPlugin.js
// Routes world events (loot, enemy defeats) into the quest system.

export function createQuestEventsPlugin({ quests, getState } = {}) {
    return {
        id: 'ew.questEvents',
        requires: ['ew.worldEvents'],

        init(engine) {
            engine.registerService('ew.questEvents', { enabled: true })
        },

        start(engine) {
            if (!quests) return

            const onItem = (p) => {
                try {
                    const itemId = p && (p.itemId || p.id)
                    const qty = p && (p.quantity ?? p.qty ?? 1)
                    if (!itemId) return
                    if (quests.applyQuestProgressOnItemGain) quests.applyQuestProgressOnItemGain(itemId, qty)
                } catch (_) {}
            }

            const onDefeat = (p) => {
                try {
                    const enemy = p && (p.enemy || p)
                    if (!enemy) return
                    if (quests.applyQuestProgressOnEnemyDefeat) quests.applyQuestProgressOnEnemyDefeat(enemy)
                } catch (_) {}
            }

            // Store handlers so stop() can detach them.
            engine.__ewQuestEventsHandlers = { onItem, onDefeat }

            engine.on('world:itemGained', onItem)
            engine.on('world:enemyDefeated', onDefeat)
        },

        stop(engine) {
            try {
                const h = engine.__ewQuestEventsHandlers
                if (h && h.onItem) engine.off('world:itemGained', h.onItem)
                if (h && h.onDefeat) engine.off('world:enemyDefeated', h.onDefeat)
            } catch (_) {}
            try { delete engine.__ewQuestEventsHandlers } catch (_) {}
        }
    }
}
