/**
 * @fileoverview Enemy AI & Decision-Making Helpers
 * Extracted from gameOrchestrator.js for modularity (Patch 1.2.72)
 *
 * Provides functions for:
 * - Enemy ability scoring and selection
 * - Enemy turn tick management (buffs, debuffs, broken state)
 * - Enemy learning and decision-making
 * - Enemy stat calculations
 */

export function createEnemyAIHelpers(deps) {
    const {
        state,
        ENEMY_ABILITIES,
        ENEMY_ABILITY_SETS,
        addLog,
        rand,
        randInt,
        calcEnemyDamage,
        getActiveDifficultyConfig,
        computeEnemyPostureMaxImpl,
        clampNumber,
        ensureEnemyRuntimeImpl,
        pickEnemyAbilitySet
    } = deps

    function ensureEnemyRuntime(enemy) {
        return ensureEnemyRuntimeImpl(enemy, { pickEnemyAbilitySet })
    }

    function ensureEnemyAbilityStat(enemy, aid) {
        if (!enemy.memory) return { value: 0, uses: 0 }
        if (!enemy.memory.abilityStats) enemy.memory.abilityStats = {}
        if (!enemy.memory.abilityStats[aid]) {
            enemy.memory.abilityStats[aid] = { value: 0, uses: 0 }
        }
        return enemy.memory.abilityStats[aid]
    }

    function tickEnemyStartOfTurn(enemy) {
        if (!enemy) return false

        // Tick debuffs first so durations are consistent even if the enemy loses their action.
        if (enemy.atkDownTurns && enemy.atkDownTurns > 0) {
            enemy.atkDownTurns -= 1
            if (enemy.atkDownTurns <= 0) {
                enemy.atkDownFlat = 0
                addLog(enemy.name + ' recovers their strength.', 'system')
            }
        }
        if (enemy.magDownTurns && enemy.magDownTurns > 0) {
            enemy.magDownTurns -= 1
            if (enemy.magDownTurns <= 0) {
                enemy.magDownFlat = 0
                addLog(enemy.name + ' regains arcane focus.', 'system')
            }
        }

        // Guard ticks down
        if (enemy.guardTurns && enemy.guardTurns > 0) {
            enemy.guardTurns -= 1
            if (enemy.guardTurns <= 0) {
                enemy.armorBuff = 0
                enemy.magicResBuff = 0
                addLog(enemy.name + "'s guard drops.", 'system')
            }
        }

        // Enrage ticks down
        if (enemy.enrageTurns && enemy.enrageTurns > 0) {
            enemy.enrageTurns -= 1
            if (enemy.enrageTurns <= 0) {
                enemy.attackBuff = 0
                enemy.enrageAtkPct = 0
                addLog(enemy.name + ' calms down.', 'system')
            }
        }

        // Berserk affix: when low, permanently enter an "enraged" state for this fight.
        if (
            enemy.affixBerserkAtkPct &&
            enemy.affixBerserkAtkPct > 0 &&
            enemy.affixBerserkThreshold &&
            enemy.affixBerserkThreshold > 0 &&
            !enemy.affixBerserkActive
        ) {
            const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
            if (ratio <= enemy.affixBerserkThreshold) {
                enemy.affixBerserkActive = true
                enemy.enrageTurns = Math.max(enemy.enrageTurns || 0, 999)
                enemy.enrageAtkPct = Math.max(enemy.enrageAtkPct || 0, enemy.affixBerserkAtkPct)
                addLog(enemy.name + ' enters a berserk frenzy!', 'danger')
            }
        }

        // Chill ticks down
        if (enemy.chilledTurns && enemy.chilledTurns > 0) {
            enemy.chilledTurns -= 1
            if (enemy.chilledTurns <= 0) {
                addLog(enemy.name + ' shakes off the chill.', 'system')
            }
        }

        // Marks (Ranger): ticks down and clears when expired.
        if (enemy.markedTurns && enemy.markedTurns > 0) {
            enemy.markedTurns -= 1
            if (enemy.markedTurns <= 0) {
                enemy.markedStacks = 0
            }
        }

        // Broken: posture break skips the next action and disrupts telegraphs.
        if (enemy.brokenTurns && enemy.brokenTurns > 0) {
            enemy.brokenTurns -= 1
            clearEnemyIntent(enemy, enemy.name + " can't keep their focus!")
            addLog(enemy.name + ' is Broken and cannot act!', 'good')
            return true
        }

        // Stun: skip this enemy turn.
        if (enemy.stunTurns && enemy.stunTurns > 0) {
            enemy.stunTurns -= 1
            clearEnemyIntent(enemy, enemy.name + " loses their intent!")
            addLog(enemy.name + ' is stunned and cannot act!', 'good')
            return true
        }

        // If forced guard (boss phase etc.), end turn early.
        if (enemy.aiForcedGuard) {
            enemy.aiForcedGuard = false
            enemy.guardTurns = Math.max(enemy.guardTurns || 0, 1)
            enemy.armorBuff = (enemy.armorBuff || 0) + 2
            enemy.magicResBuff = (enemy.magicResBuff || 0) + 2
            addLog(enemy.name + ' braces for impact.', 'system')
            return true
        }

        return false
    }

    function canUseEnemyAbility(enemy, aid) {
        const ab = ENEMY_ABILITIES[aid]
        if (!ab) return false
        const cd = enemy.abilityCooldowns ? enemy.abilityCooldowns[aid] || 0 : 0
        return cd <= 0
    }

    function tickEnemyCooldowns() {
        const list = (Array.isArray(state.enemies) && state.enemies.length) ? state.enemies : (state.currentEnemy ? [state.currentEnemy] : [])
        list.forEach((enemy) => {
            if (!enemy || !enemy.abilityCooldowns) return
            Object.keys(enemy.abilityCooldowns).forEach((k) => {
                if (enemy.abilityCooldowns[k] > 0) enemy.abilityCooldowns[k] -= 1
            })
        })
    }

    function scoreEnemyAbility(enemy, p, aid) {
        const ab = ENEMY_ABILITIES[aid]
        if (!ab) return -9999

        // Memory / long-term learned value
        const stat = ensureEnemyAbilityStat(enemy, aid)
        const learned = stat.value || 0

        // Immediate heuristic
        let score = 0

        const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
        const playerHpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 1

        // Guard when low or when player is healthy (stall for better burst windows)
        if (ab.type === 'guard') {
            score += 8
            if (hpRatio < 0.45) score += 18
            if (enemy.guardTurns > 0) score -= 25 // don't spam guard
        }

        // Buff when planning for burst
        if (ab.type === 'buff') {
            score += 6
            if (hpRatio < 0.6) score += 10
            if (enemy.enrageTurns > 0) score -= 30
        }

        // Debuffs become more valuable when player is healthy / shielded
        if (ab.type === 'debuff' || (ab.type && ab.type.indexOf('debuff') >= 0)) {
            score += 10
            if (playerHpRatio > 0.6) score += 8
            if ((p.status && p.status.shield) > 0) score += 6
        }

        // Damage estimate
        if (ab.type && ab.type.indexOf('damage') >= 0) {
            const isMagic = ab.damageType === 'magic'
            const baseStat =
                (isMagic ? enemy.magic : enemy.attack) * (ab.potency || 1)
            const enrageMult = enemy.enrageAtkPct
                ? 1 + enemy.enrageAtkPct * (isMagic ? 0.5 : 1)
                : 1
            const elemHit =
                ab.elementType || (isMagic ? enemy.magicElementType : enemy.attackElementType) || null
            const dmgEst = calcEnemyDamage(baseStat * enrageMult, { damageType: isMagic ? 'magic' : 'physical', elementType: elemHit })

            score += dmgEst

            // kill pressure
            if (dmgEst >= p.hp) score += 65
            if (playerHpRatio < 0.35) score += 15

            // shield tech
            if (ab.shatterShieldFlat && p.status && p.status.shield > 0) {
                score += Math.min(p.status.shield, ab.shatterShieldFlat) * 0.35
            }

            // bleed value
            if (ab.bleedTurns) {
                const alreadyBleeding = p.status && p.status.bleedTurns > 0
                score += alreadyBleeding ? 4 : 10
                if (playerHpRatio < 0.5) score += 6
            }

            // vulnerability is great when setting up a follow-up nuke
            if (ab.vulnerableTurns) {
                score += 12
            }
        }

        // Healing synergy for drain/heal abilities
        if (ab.type === 'damage+heal') {
            if (hpRatio < 0.7) score += 12
            if (hpRatio < 0.4) score += 18
        }

        // Mix in learned value (lightly), scaled by AI smartness.
        const diff = getActiveDifficultyConfig()
        const smart = diff.aiSmartness || 0.6
        score += learned * (0.35 + smart * 0.45)

        return score
    }

    function chooseEnemyAbility(enemy, p) {
        const diff = getActiveDifficultyConfig()
        const smart = diff.aiSmartness || 0.6

        const kit = Array.isArray(enemy.abilities)
            ? enemy.abilities
            : [...pickEnemyAbilitySet(enemy)]
        const usable = kit.filter((aid) => canUseEnemyAbility(enemy, aid))

        // Fallback: if everything is on cooldown, default to Strike.
        if (usable.length === 0) return 'enemyStrike'

        // Exploration (lower when smartness is high)
        const epsBase = enemy.memory ? enemy.memory.exploration || 0.2 : 0.2
        const eps = Math.max(0.05, Math.min(0.35, epsBase * (1.2 - smart)))

        if (rand('ai.epsChoice') < eps) {
            return usable[randInt(0, usable.length - 1, 'ai.randomUsable')]
        }

        let best = usable[0]
        let bestScore = -Infinity

        for (const aid of usable) {
            const s = scoreEnemyAbility(enemy, p, aid)
            if (s > bestScore) {
                bestScore = s
                best = aid
            }
        }

        return best
    }

    function updateEnemyLearning(enemy, aid, reward) {
        if (!enemy || !enemy.memory) return
        const stat = ensureEnemyAbilityStat(enemy, aid)
        stat.uses = (stat.uses || 0) + 1
        const prev = stat.value || 0

        // EMA update; reward can be slightly noisy.
        const alpha = 0.18
        stat.value = prev * (1 - alpha) + reward * alpha

        // Slowly reduce exploration (but never to 0)
        enemy.memory.exploration = Math.max(
            0.06,
            (enemy.memory.exploration || 0.2) * 0.996
        )
    }

    function computeEnemyPostureMax(enemy) {
        return computeEnemyPostureMaxImpl(enemy)
    }

    function getEffectiveEnemyAttack(enemy) {
        if (!enemy) return 0
        const base = Number(
            typeof enemy.baseAttack === 'number' ? enemy.baseAttack : enemy.attack || 0
        )
        const down =
            enemy.atkDownTurns && enemy.atkDownTurns > 0
                ? Number(enemy.atkDownFlat || 0)
                : 0
        return Math.max(0, Math.round(base - down))
    }

    function getEffectiveEnemyMagic(enemy) {
        if (!enemy) return 0
        const base = Number(
            typeof enemy.baseMagic === 'number' ? enemy.baseMagic : enemy.magic || 0
        )
        const down =
            enemy.magDownTurns && enemy.magDownTurns > 0
                ? Number(enemy.magDownFlat || 0)
                : 0
        return Math.max(0, Math.round(base - down))
    }

    function applyEnemyAtkDown(enemy, flatAmount, turns) {
        if (!enemy) return
        ensureEnemyRuntime(enemy)

        const amt = Math.max(0, Number(flatAmount || 0))
        const t = Math.max(0, Math.floor(Number(turns || 0)))
        if (amt <= 0 || t <= 0) return

        const baseAtk = Number(
            typeof enemy.baseAttack === 'number' ? enemy.baseAttack : enemy.attack || 0
        )
        const cap = Math.max(1, Math.round(baseAtk * 0.6))
        enemy.atkDownFlat = Math.min(cap, Number(enemy.atkDownFlat || 0) + amt)
        enemy.atkDownTurns = Math.max(enemy.atkDownTurns || 0, t)
    }

    function clearEnemyIntent(enemy, reasonText) {
        if (!enemy || !enemy.intent) return
        enemy.intent = null
        if (reasonText) addLog(reasonText, 'system')
    }

    function applyEnemyPostureFromPlayerHit(enemy, damageDealt, meta = {}) {
        if (!enemy) return
        const dmg = Math.max(0, Math.round(Number(damageDealt || 0)))
        if (dmg <= 0) return

        ensureEnemyRuntime(enemy)

        if (typeof enemy.postureMax !== 'number' || enemy.postureMax <= 0) {
            enemy.postureMax = computeEnemyPostureMax(enemy)
        }
        if (typeof enemy.posture !== 'number') enemy.posture = 0

        let gain = Math.max(1, Math.round(dmg * 0.25))

        if (meta && meta.isBasic) gain += 1

        if (state.lastPlayerHitWasCrit) gain = Math.round(gain * 1.5)
        if (meta && meta.tag === 'interrupt') gain += 2

        if (enemy.isBoss) gain = Math.max(1, Math.round(gain * 0.75))
        if (enemy.isElite) gain = Math.max(1, Math.round(gain * 0.85))

        const perHitCap =
            enemy.postureMax <= 12
                ? enemy.postureMax
                : Math.max(1, Math.round(enemy.postureMax * 0.35))

        if (enemy.postureMax <= 10) gain = enemy.postureMax

        gain = Math.min(perHitCap, gain)

        enemy.posture += gain

        if (enemy.posture >= enemy.postureMax) {
            enemy.posture = 0
            enemy.brokenTurns = Math.max(enemy.brokenTurns || 0, 1)
            clearEnemyIntent(enemy, enemy.name + "'s focus shatters!")
            addLog(enemy.name + ' is Broken!', 'good')
        }
    }

    function decideEnemyAction(enemy, player) {
        const diff = getActiveDifficultyConfig()
        const smart = diff.aiSmartness
        const available = []

        available.push('attack')

        if (enemy.isBoss) {
            if (enemy.behavior === 'bossGoblin') {
                available.push('heavy', 'guard')
            } else if (enemy.behavior === 'bossDragon') {
                available.push('heavy', 'voidBreath')
            } else if (enemy.behavior === 'bossWitch') {
                available.push('heavy', 'voidBreath', 'guard')
            } else if (enemy.behavior === 'bossGiant') {
                available.push('heavy', 'guard')
            } else if (enemy.behavior === 'bossLich') {
                available.push('heavy', 'voidBreath', 'guard')
            } else if (enemy.behavior === 'bossKing') {
                available.push('heavy', 'guard', 'voidBreath')
            } else {
                available.push('heavy')
            }
        } else {
            if (enemy.behavior === 'aggressive') {
                available.push('heavy')
            } else if (enemy.behavior === 'cunning') {
                available.push('heavy', 'guard')
            } else if (enemy.behavior === 'caster') {
                available.push('voidBreath')
            }
        }

        if (rand('ai.smartRoll') > smart) {
            return available[randInt(0, available.length - 1, 'ai.randomAbility')]
        }

        let bestAction = 'attack'
        let bestScore = -Infinity

        available.forEach((act) => {
            let score = 0
            if (act === 'attack') {
                const dmg = calcEnemyDamage(getEffectiveEnemyAttack(enemy), { damageType: 'physical', elementType: enemy.attackElementType || null })
                score = dmg
            } else if (act === 'heavy') {
                const dmg = calcEnemyDamage(getEffectiveEnemyAttack(enemy) * 1.4, { damageType: 'physical', elementType: enemy.attackElementType || null })
                score = dmg * 1.1
            } else if (act === 'voidBreath') {
                const dmg = calcEnemyDamage(enemy.magic * 1.7, { damageType: 'magic', elementType: enemy.magicElementType || null })
                score = dmg * 1.2
            } else if (act === 'guard') {
                score = 12
                if (enemy.hp < enemy.maxHp * 0.4) score += 10
            }

            if (
                player.hp <=
                calcEnemyDamage(
                    act === 'heavy'
                        ? enemy.attack * 1.4
                        : act === 'voidBreath'
                        ? enemy.magic * 1.7
                        : enemy.attack,
                    {
                        damageType: act === 'voidBreath' ? 'magic' : 'physical',
                        elementType: act === 'voidBreath'
                            ? enemy.magicElementType || null
                            : enemy.attackElementType || null
                    }
                )
            ) {
                score += 50
            }

            if (score > bestScore) {
                bestScore = score
                bestAction = act
            }
        })

        return bestAction
    }

    return {
        ensureEnemyRuntime,
        ensureEnemyAbilityStat,
        tickEnemyStartOfTurn,
        canUseEnemyAbility,
        tickEnemyCooldowns,
        scoreEnemyAbility,
        chooseEnemyAbility,
        updateEnemyLearning,
        computeEnemyPostureMax,
        getEffectiveEnemyAttack,
        getEffectiveEnemyMagic,
        applyEnemyAtkDown,
        clearEnemyIntent,
        applyEnemyPostureFromPlayerHit,
        decideEnemyAction
    }
}
