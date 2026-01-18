/**
 * battleManager.js
 * Manages battle initialization, enemy defeat, and player defeat logic.
 */

import { ENEMY_TEMPLATES } from '../../data/enemyTemplates.js'
import { ZONE_DEFS } from '../../data/zoneDefs.js'
import { buildEnemyForBattle, pickEnemyAbilitySet } from '../../data/enemyFactory.js'

export function createBattleManager(deps) {
    const {
        state,
        rand,
        randInt,
        addLog,
        setScene,
        updateHUD,
        updateEnemyPanel,
        renderActions,
        requestSave,
        withSaveTxn,
        getActiveDifficultyConfig,
        recordInput,
        recordBattleResult,
        ensureCombatTurnState,
        ensureCombatPointers,
        syncCurrentEnemyToTarget,
        getAllEnemies,
        getAliveEnemies,
        resetPlayerCombatStatus,
        applyEquipmentOnKill,
        grantExperience,
        generateLootDrop,
        addGeneratedItemToInventory,
        handleEconomyAfterBattle,
        openModal,
        closeModal,
        loadGameFromSlot,
        switchScreen,
        perfWrap,
        _engine,
        _questEventsEnabled
    } = deps

    function startBattleWith(templateId) {
        const template = ENEMY_TEMPLATES[templateId]
        if (!template) return

        // Guard: do not start a new battle if we're already in combat.
        // This prevents re-entrant explore clicks or modal flows from corrupting combat state.
        if (state && state.inCombat) {
            try { ensureCombatPointers() } catch (_) {}
            return
        }

        recordInput('combat.start', {
            templateId,
            area: state && state.area ? state.area : null
        })

        const diff = getActiveDifficultyConfig()

        // Zone-based enemy level scaling
        const areaId = state.area || 'village'
        const zone = ZONE_DEFS[areaId] || { minLevel: 1, maxLevel: 1 }

        // Multi-enemy encounter sizing (Patch 1.1.9)
        // Patch 1.2.0: encounter sizing is now difficulty-weighted.
        //  - Easy:   almost always 1 enemy; rarely 2; never 3.
        //  - Normal: mostly 1 enemy; noticeably higher chance for 2; rare 3.
        //  - Hard:   mostly 2 enemies; sometimes 3; rarely 1.
        let groupSize = 1

        // Cheat override: force the *next* encounter group size (1..3). Auto-clears after use.
        // This is used by the Cheat Menu's quick spawn tools.
        try {
            const forced = state && state.flags ? Number(state.flags.forceNextGroupSize) : NaN
            if (Number.isFinite(forced) && forced >= 1 && forced <= 3) {
                groupSize = Math.floor(forced)
                // one-shot so it doesn't surprise players later
                state.flags.forceNextGroupSize = null
            }
        } catch (_) {}
        if (!template.isBoss) {
            const r = rand('encounter.groupSize')

            // Use closestId so Dynamic difficulty also maps cleanly.
            // NOTE: getActiveDifficultyConfig() returns { id:'dynamic', closestId:'easy'|'normal'|'hard' } for Dynamic.
            // For fixed difficulties, closestId is undefined so we fall back to diff.id.
            let diffId = 'normal'
            if (diff && typeof diff.id === 'string') {
                if (diff.id === 'dynamic') diffId = (diff.closestId || 'normal')
                else diffId = diff.id
            }
            diffId = String(diffId).toLowerCase()

            if (diffId === 'easy') {
                // ~95%:1, ~5%:2, 0%:3
                if (r < 0.05) groupSize = 2
            } else if (diffId === 'hard') {
                // ~10%:1, ~65%:2, ~25%:3
                if (r < 0.25) groupSize = 3
                else if (r < 0.90) groupSize = 2
            } else {
                // Normal (default): ~70%:1, ~28%:2, ~2%:3
                if (r < 0.02) groupSize = 3
                else if (r < 0.30) groupSize = 2
            }
        }

        const enemies = []
        for (let i = 0; i < groupSize; i++) {
            const enemy = buildEnemyForBattle(template, {
                zone,
                diffCfg: diff,
                areaId,
                rand,
                randInt,
                pickEnemyAbilitySet
            })
            if (!enemy) continue

            // Runtime combat state
            enemy.armorBuff = 0
            enemy.guardTurns = 0
            enemy.bleedTurns = 0
            enemy.bleedDamage = 0
            enemy.burnTurns = 0
            enemy.burnDamage = 0

            // Group tuning: slightly squish per-enemy durability.
            if (groupSize === 2) {
                enemy.maxHp = Math.max(1, Math.floor(enemy.maxHp * 0.78))
                enemy.attack = Math.max(1, Math.floor(enemy.attack * 0.92))
                enemy.magic = Math.max(0, Math.floor(enemy.magic * 0.92))
            } else if (groupSize === 3) {
                enemy.maxHp = Math.max(1, Math.floor(enemy.maxHp * 0.66))
                enemy.attack = Math.max(1, Math.floor(enemy.attack * 0.88))
                enemy.magic = Math.max(0, Math.floor(enemy.magic * 0.88))
            }
            enemy.hp = enemy.maxHp

            if (groupSize > 1) {
                enemy.name = enemy.name + ' #' + (i + 1)
            }

            enemies.push(enemy)
        }

        if (!enemies.length) return

        resetPlayerCombatStatus(state.player)

        state.enemies = enemies
        state.targetEnemyIndex = 0
        state.currentEnemy = enemies[0]
        state.inCombat = true

        // Initialize the turn engine.
        ensureCombatTurnState()
        state.combat.phase = 'player'
        state.combat.busy = false
        state.combat.round = 1
        state.combat.battleDrops = 0

        const tags = enemies.some((e) => e.isBoss) ? ' [Boss]' : ''
        const titleName = groupSize === 1 ? enemies[0].name : 'Enemies (' + groupSize + ')'

        setScene('Battle - ' + titleName, titleName + tags + ' stands in your way.')

        if (groupSize === 1) {
            addLog('A ' + enemies[0].name + ' appears!', enemies[0].isBoss ? 'danger' : 'system')
        } else {
            addLog(groupSize + ' enemies appear!', 'danger')
        }

        updateHUD()
        updateEnemyPanel()
        renderActions()
    }

    function handleEnemyDefeat(enemyArg) {
        return withSaveTxn('combat:enemyDefeat', () => {
        const enemy = enemyArg || state.currentEnemy
        if (!enemy) return

        // Patch 1.2.70: prevent duplicate reward processing.
        // Multi-enemy battles can produce several "hp <= 0" enemies in one action.
        // We mark an enemy as handled so we never grant XP/loot twice (including after load).
        if (enemy._defeatHandled) return
        enemy._defeatHandled = true

        // Mark dead
        enemy.hp = 0

        const rarityTag =
            enemy.rarityLabel && Number.isFinite(enemy.rarityTier) && enemy.rarityTier >= 3
                ? ' [' + enemy.rarityLabel + ']'
                : ''

        const all = getAllEnemies()
        const alive = getAliveEnemies()


        // IMPORTANT: grantExperience() triggers a save/invariant scan.
        // If this defeat ends the battle, clear combat state BEFORE granting XP so
        // we never save with inCombat=true and no currentEnemy.
        if (!alive.length) {
            state.inCombat = false
            state.currentEnemy = null
            state.enemies = []
            state.targetEnemyIndex = 0
            if (state.combat) {
                state.combat.busy = false
                state.combat.phase = 'player'
            }
        } else {
            // Mid-battle saves require a valid living target.
            try { syncCurrentEnemyToTarget() } catch (_) {}
        }

        addLog(
            'You defeated ' + enemy.name + (enemy.isElite ? ' [Elite]' : '') + rarityTag + '!',
            'good'
        )

        // Patch 1.2.0: apply on-kill equipment traits / talent triggers
        applyEquipmentOnKill(enemy)

        const xp = enemy.xp
        const gold =
            enemy.goldMin +
            randInt(0, enemy.goldMax - enemy.goldMin, 'loot.gold')

        addLog('You gain ' + xp + ' XP and ' + gold + ' gold.', 'good')

        state.player.gold += gold
        grantExperience(xp)

        // Loot drops (cap drops in multi-enemy battles to reduce spam)
        const c = ensureCombatTurnState()
        const dropsSoFar = c ? (c.battleDrops || 0) : 0

        let dropChance = enemy.isBoss ? 1.0 : enemy.isElite ? 0.9 : 0.7
        if (all.length > 1 && !enemy.isBoss) dropChance *= 0.85

        if (typeof enemy.rarityDropMult === 'number' && Number.isFinite(enemy.rarityDropMult)) {
            dropChance = Math.max(0, Math.min(1.0, dropChance * enemy.rarityDropMult))
        }

        const dropCap = all.length > 1 ? 2 : 99

        if (dropsSoFar < dropCap && rand('loot.drop') < dropChance) {
            const _lootArgs = {
                area: state.area,
                playerLevel: state.player.level,
                enemy,
                playerResourceKey: state.player.resourceKey
            }
            const drops = (() => {
                try {
                    if (state && state.debug && state.debug.capturePerf) {
                        return perfWrap(state, 'loot:generateLootDrop', { area: _lootArgs.area }, () => generateLootDrop(_lootArgs))
                    }
                } catch (_) {}
                return generateLootDrop(_lootArgs)
            })()

            if (drops && drops.length) {
                drops.forEach((d) => addGeneratedItemToInventory(d, d.quantity || 1))

                const names = drops
                    .map(
                        (d) =>
                            d.name +
                            (d.type === 'potion' && (d.quantity || 1) > 1
                                ? ' ?' + (d.quantity || 1)
                                : '')
                    )
                    .join(', ')

                addLog('You loot ' + names + '.', 'good')

                if (c) c.battleDrops = (c.battleDrops || 0) + 1
            }
        }

        // World event (consumed by questEvents + autosave plugins)
        try { _engine && _engine.emit && _engine.emit('world:enemyDefeated', { enemy }) } catch (_) {}

        // Legacy quest hook (fallback when questEvents plugin isn't present)
        if (!_questEventsEnabled()) {
            try { deps.quests && deps.quests.applyQuestProgressOnEnemyDefeat && deps.quests.applyQuestProgressOnEnemyDefeat(enemy) } catch (_) {}
        }

        // If any enemies remain, keep fighting.
        if (alive.length > 0) {
            // Ensure target is valid.
            syncCurrentEnemyToTarget()
            updateHUD()
            updateEnemyPanel()
            renderActions()
            requestSave('legacy')
            return
        }

        // Battle ends.
        state.inCombat = false

        try {
            _engine && _engine.emit && _engine.emit('world:battleEnded', { result: 'win', finalEnemy: enemy })
        } catch (_) {}

        // Economy reacts once per battle
        handleEconomyAfterBattle(state, enemy, state.area)

        // dynamic difficulty: one result per battle
        recordBattleResult('win')

        state.currentEnemy = null
        state.enemies = []

        updateHUD()
        updateEnemyPanel()
        renderActions()
        requestSave('legacy')
        })
    }

    function handlePlayerDefeat() {
        // inform dynamic difficulty system of the loss
        recordBattleResult('loss')

        // Mark as defeated so exploration/actions can't proceed behind the defeat screen.
        if (!state.flags) state.flags = {}
        state.flags.playerDefeated = true

        // Clamp to dead state
        if (state.player && !state.flags.godMode) state.player.hp = 0

        addLog('You fall to the ground, defeated.', 'danger')

        // Clear combat state completely (multi-enemy aware)
        state.inCombat = false

        try {
            _engine && _engine.emit && _engine.emit('world:battleEnded', { result: 'loss' })
        } catch (_) {}
        state.currentEnemy = null
        state.enemies = []
        state.targetEnemyIndex = 0
        if (state.combat) {
            state.combat.busy = false
            state.combat.phase = 'player'
        }

        resetPlayerCombatStatus(state.player)
        updateHUD()

        openModal('Defeat', (body) => {
            const p = document.createElement('p')
            p.className = 'modal-subtitle'
            p.textContent =
                'Your journey ends here... but legends often get second chances.'
            body.appendChild(p)

            const row = document.createElement('div')
            row.className = 'item-actions'

            const btnLoad = document.createElement('button')
            btnLoad.className = 'btn outline'
            btnLoad.textContent = 'Load Last Save'
            btnLoad.addEventListener('click', () => {
                try { if (deps.modalEl) deps.modalEl.dataset.lock = '0' } catch (_) {}
                closeModal()
                loadGameFromSlot()
            })

            const btnMenu = document.createElement('button')
            btnMenu.className = 'btn outline'
            btnMenu.textContent = 'Main Menu'
            btnMenu.addEventListener('click', () => {
                try { if (deps.modalEl) deps.modalEl.dataset.lock = '0' } catch (_) {}
                closeModal()
                switchScreen('mainMenu')
            })

            row.appendChild(btnLoad)
            row.appendChild(btnMenu)
            body.appendChild(row)
        })
    }

    return {
        startBattleWith,
        handleEnemyDefeat,
        handlePlayerDefeat
    }
}
