// Patch 1.2.65: Combat post-turn sequencing extracted from engine.js.
// This module is intentionally dependency-injected to avoid circular imports.

export function createPostTurnSequencer(deps) {
    const getState = deps.getState
    const ensureCombatTurnState = deps.ensureCombatTurnState
    const combatPause = deps.combatPause
    const _combatDelayMs = deps._combatDelayMs
    const anyEnemiesAlive = deps.anyEnemiesAlive
    const getAllEnemies = deps.getAllEnemies
    const finiteNumber = deps.finiteNumber
    const enemyAct = deps.enemyAct
    const postEnemyTurn = deps.postEnemyTurn
    const syncCurrentEnemyToTarget = deps.syncCurrentEnemyToTarget
    const companionActIfPresent = deps.companionActIfPresent
    const updateHUD = deps.updateHUD
    const updateEnemyPanel = deps.updateEnemyPanel
    const perfWrapAsync = deps.perfWrapAsync

    function _safeState() {
        try { return getState() } catch (_) { return null }
    }

    async function runPostPlayerTurnSequence() {
        const st = _safeState()
        try {
            if (st && st.debug && st.debug.capturePerf && typeof perfWrapAsync === 'function') {
                const meta = { waitMs: 0 }
                return await perfWrapAsync(st, 'combat:runPostPlayerTurnSequence', meta, async () => {
                    return await _runPostPlayerTurnSequenceImpl(meta)
                })
            }
        } catch (_) {}
        return await _runPostPlayerTurnSequenceImpl(null)
    }

    async function _runPostPlayerTurnSequenceImpl(meta) {
        const st = _safeState()
        if (!st) return

        const c = ensureCombatTurnState()
        if (!c) return

        // Track deliberate pacing/wait time so QA can report CPU vs wall-clock.
        const _meta = (meta && typeof meta === 'object') ? meta : null
        const _addWait = (base) => {
            if (!_meta) return
            try {
                const cur = Number(_meta.waitMs)
                const add = _combatDelayMs(base)
                _meta.waitMs = (Number.isFinite(cur) ? cur : 0) + (Number.isFinite(add) ? add : 0)
            } catch (_) {}
        }

        // Brief "thinking" pause after the player.
        _addWait(520)
        await combatPause(520)

        const st1 = _safeState()
        if (!st1 || !st1.inCombat) return

        // Companion (if any)
        if (st1.companion && anyEnemiesAlive()) {
            syncCurrentEnemyToTarget()
            companionActIfPresent()
            updateHUD()
            updateEnemyPanel()

            const st2 = _safeState()
            if (!st2 || !st2.inCombat || !anyEnemiesAlive()) return

            _addWait(520)
            await combatPause(520)

            const st3 = _safeState()
            if (!st3 || !st3.inCombat) return
        }

        // Enemies act in order.
        const enemies = getAllEnemies().slice()
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i]
            const st4 = _safeState()
            if (!st4 || !st4.inCombat) return
            if (!enemy || finiteNumber(enemy.hp, 0) <= 0) continue

            // Small pause before each enemy action.
            _addWait(460)
            await combatPause(460)

            const st5 = _safeState()
            if (!st5 || !st5.inCombat) return

            enemyAct(enemy)

            // enemyAct may change currentEnemy; restore UI target.
            syncCurrentEnemyToTarget()
            updateEnemyPanel()

            const st6 = _safeState()
            if (!st6 || !st6.inCombat) return
            if (!anyEnemiesAlive()) return

            if (st6.player && finiteNumber(st6.player.hp, 0) <= 0) return
        }

        // End-of-round ticks happen once after all enemies.
        const st7 = _safeState()
        if (st7 && st7.inCombat) {
            postEnemyTurn()
            if (st7.combat) st7.combat.round = (st7.combat.round || 1) + 1
        }
    }

    return { runPostPlayerTurnSequence }
}
