/**
 * Enemy Combat AI Module
 * 
 * Handles enemy turn logic, ability selection, learning AI, and turn management.
 * Extracted from gameOrchestrator.js for better modularity.
 */

export function createEnemyCombatAi(dependencies) {
    const {
        // State
        state,
        
        // Constants
        ENEMY_ABILITIES,
        
        // UI functions
        addLog,
        updateEnemyPanel,
        updateHUD,
        openModal,
        closeModal,
        switchScreen,
        screens,
        setScene,
        renderActions,
        
        // Combat functions
        clearEnemyIntent,
        calcEnemyDamage,
        getEffectiveEnemyAttack,
        getEffectiveEnemyMagic,
        applyEnemyAffixesOnEnemyHit,
        
        // Helper functions
        ensureEnemyRuntimeImpl,
        pickEnemyAbilitySet,
        getAliveEnemies,
        getAllEnemies,
        getActiveDifficultyConfig,
        ensureCombatTurnState,
        guardPlayerTurn,
        syncCurrentEnemyToTarget,
        getPlayerHasteMultiplier,
        applyPlayerRegenTick,
        applyEquipmentOnKill,
        applyQuestProgressOnEnemyDefeat,
        tickCompanionCooldowns,
        grantExperience,
        resetPlayerCombatStatus,
        
        // Loot functions
        generateLootDrop,
        addGeneratedItemToInventory,
        
        // RNG functions
        rand,
        randInt,
        
        // Other functions
        endPlayerTurn,
        handleEconomyAfterBattle,
        requestSave,
        loadGame,
        withSaveTxn,
        perfWrap,
        emit,
        _ensureCombatEnginesBound,
        _questEventsEnabled,
        
        // Optional dependencies (can be null)
        getStatusEngine,
        getQuests
    } = dependencies;

    // --- ENEMY TURN (ABILITY + LEARNING AI) --------------------------------------
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
    
    function applyEnemyAbilityToPlayer(enemy, p, aid) {
        const ab = ENEMY_ABILITIES[aid]
        if (!ab) return { damageDealt: 0, healDone: 0, shieldShattered: 0 }
    
        const status = p.status || (p.status = {})
    
        // Apply buffs/guards that don't deal damage.
        if (ab.type === 'guard') {
            const turns = ab.guardTurns || 2
            const bonus = ab.armorBonus || 3
    
            // If already guarding, refresh duration but don't stack armor forever.
            if (enemy.guardTurns <= 0) {
                enemy.guardArmorBonus = bonus
                enemy.armorBuff = (enemy.armorBuff || 0) + bonus
            } else {
                // Refresh only.
                enemy.guardArmorBonus = Math.max(enemy.guardArmorBonus || 0, bonus)
            }
            enemy.guardTurns = Math.max(enemy.guardTurns || 0, turns)
    
            let healDone = 0
            if (ab.healPct) {
                const heal = Math.max(1, Math.round(enemy.maxHp * ab.healPct))
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal)
                healDone = heal
            }
    
            addLog(enemy.name + ' braces behind its guard.', 'danger')
            return { damageDealt: 0, healDone, shieldShattered: 0 }
        }
    
        if (ab.type === 'buff') {
            enemy.enrageTurns = Math.max(
                enemy.enrageTurns || 0,
                ab.enrageTurns || 2
            )
            enemy.enrageAtkPct = Math.max(
                enemy.enrageAtkPct || 0,
                ab.enrageAtkPct || 0.2
            )
            addLog(enemy.name + ' roars with rage!', 'danger')
            return { damageDealt: 0, healDone: 0, shieldShattered: 0 }
        }
    
        if (ab.type === 'debuff') {
            const turns = ab.debuffTurns || 3
    
            if (ab.atkDown) {
                status.atkDown = Math.max(status.atkDown || 0, ab.atkDown)
                status.atkDownTurns = Math.max(status.atkDownTurns || 0, turns)
            }
            if (ab.armorDown) {
                status.armorDown = Math.max(status.armorDown || 0, ab.armorDown)
                status.armorDownTurns = Math.max(status.armorDownTurns || 0, turns)
            }
            addLog(enemy.name + ' lays a vile curse upon you!', 'danger')
            return { damageDealt: 0, healDone: 0, shieldShattered: 0 }
        }
    
        // Damage abilities ----------------------------------------------------------
        const isMagic = ab.damageType === 'magic'
        const baseStat = (isMagic ? getEffectiveEnemyMagic(enemy) : getEffectiveEnemyAttack(enemy)) * (ab.potency || 1)
        const enrageMult = enemy.enrageAtkPct
            ? 1 + enemy.enrageAtkPct * (isMagic ? 0.5 : 1)
            : 1
        const elemHit =
            ab.elementType || (isMagic ? enemy.magicElementType : enemy.attackElementType) || null
        const dmg = calcEnemyDamage(baseStat * enrageMult, { damageType: isMagic ? 'magic' : 'physical', elementType: elemHit })
    
        // Dodge chance (percent). Dodging avoids damage + on-hit debuffs.
        let dodgePct = clampNumber(p && p.stats ? p.stats.dodgeChance || 0 : 0, 0, 60)
    
        // Patch 1.1.0: evasion windows + vampire passive dodge
        const st = p.status || {}
        if (st.evasionTurns && st.evasionTurns > 0) {
            dodgePct += Math.round((st.evasionBonus || 0) * 100)
        }
        if (p.classId === 'vampire' && p.resourceKey === 'essence') {
            const threshold = p.maxResource * 0.55
            if (p.resource > threshold) {
                dodgePct += 8
            }
        }
    
        dodgePct = clampNumber(dodgePct, 0, 75)
        const dodgeChance = dodgePct / 100
        if (!ab.undodgeable && dodgeChance > 0 && rand('combat.dodge') < dodgeChance) {
            addLog('You dodge the attack!', 'good')
            return { damageDealt: 0, healDone: 0, shieldShattered: 0 }
        }
    
        // Extra shield shatter first (so the "shatter" feels distinct from normal absorption)
        let shieldShattered = 0
        if (ab.shatterShieldFlat && status.shield > 0) {
            shieldShattered = Math.min(status.shield, ab.shatterShieldFlat)
            status.shield -= shieldShattered
            if (shieldShattered > 0) {
                addLog(
                    'Your shield fractures for ' + shieldShattered + '!',
                    'system'
                )
            }
        }
    
        // Apply absorption
        let remaining = dmg
        if (status.shield > 0) {
            const absorbed = Math.min(remaining, status.shield)
            status.shield -= absorbed
            remaining -= absorbed
            if (absorbed > 0) {
                addLog('Your shield absorbs ' + absorbed + ' damage.', 'system')
            }
        }
    
        // Track actual HP damage for affixes/rewards.
        const hpDamage = (state.flags && state.flags.godMode) ? 0 : Math.max(0, remaining)
    
            if (remaining > 0) {
                if (state.flags && state.flags.godMode) {
                addLog('God Mode: You ignore ' + remaining + ' damage.', 'system')
            } else {
                p.hp -= remaining
            }
        }
    
    
        // Warrior talent: Bulwark Spikes reflect (one-time) on the next enemy hit.
        if (p && p.status && p.status.bulwarkSpikesCharges && p.status.bulwarkSpikesCharges > 0 && enemy && dmg > 0) {
            const spikeDmg = clampNumber(p.status.bulwarkSpikesDamage || 0, 0, 9999)
            if (spikeDmg > 0) {
                enemy.hp -= spikeDmg
                addLog('Bulwark spikes reflect ' + spikeDmg + ' back to ' + enemy.name + '!', 'good')
            }
            p.status.bulwarkSpikesCharges = 0
            p.status.bulwarkSpikesDamage = 0
            if (enemy.hp <= 0) {
                addLog(enemy.name + ' is impaled by your spikes!', 'good')
            }
        }
    
        // Thorns reflect (flat) after a successful hit (even if shield absorbed it).
        const thorns = clampNumber(p && p.stats ? p.stats.thorns || 0 : 0, 0, 9999)
        if (thorns > 0 && enemy && dmg > 0) {
            enemy.hp -= thorns
            addLog('Your thorns deal ' + thorns + ' back to ' + enemy.name + '!', 'good')
            if (enemy.hp <= 0) {
                enemy.hp = 0
                handleEnemyDefeat(enemy)
                return { damageDealt: dmg, healDone: 0, shieldShattered }
            }
        }
    
        // On-hit debuffs / dots
        const debuffTurns = ab.debuffTurns || 3
    
        if (ab.vulnerableTurns) {
            status.vulnerableTurns = Math.max(
                status.vulnerableTurns || 0,
                ab.vulnerableTurns
            )
        }
        if (ab.armorDown) {
            status.armorDown = Math.max(status.armorDown || 0, ab.armorDown)
            status.armorDownTurns = Math.max(
                status.armorDownTurns || 0,
                debuffTurns
            )
        }
        if (ab.atkDown) {
            status.atkDown = Math.max(status.atkDown || 0, ab.atkDown)
            status.atkDownTurns = Math.max(status.atkDownTurns || 0, debuffTurns)
        }
    
        // Bleed/poison reuse player's status fields (and now it actually ticks!)
        if (ab.bleedTurns && ab.bleedBase) {
            const lvl = Number(
                enemy.level || (state.player ? state.player.level : 1) || 1
            )
            const dot = ab.bleedBase + Math.floor(lvl * 0.7)
    
            status.bleedTurns = Math.max(status.bleedTurns || 0, ab.bleedTurns)
            status.bleedDamage = Math.max(status.bleedDamage || 0, dot)
            addLog('You start bleeding!', 'danger')
        }
    
        // Drain effects
        let healDone = 0
        if (ab.drainHealPct) {
            healDone = Math.max(1, Math.round(dmg * ab.drainHealPct))
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + healDone)
        }
        if (ab.drainResourcePct && state.player) {
            const cut = Math.max(
                0,
                Math.round((state.player.maxResource || 0) * ab.drainResourcePct)
            )
            if (cut > 0) {
                state.player.resource = Math.max(
                    0,
                    (state.player.resource || 0) - cut
                )
                addLog('You feel your power ebb (' + cut + ').', 'danger')
            }
        }
    
        // Text
        if (dmg > 0) {
            addLog(
                enemy.name + ' uses ' + ab.name + ' on you for ' + dmg + ' damage.',
                'danger',
                { domain: 'combat', kind: 'damage', actor: 'enemy', breakdown: state._lastDamageBreakdown || null }
            )
        } else if (healDone > 0) {
            addLog(enemy.name + ' uses ' + ab.name + ' and heals ' + healDone + ' HP.', 'danger')
        } else {
            addLog(enemy.name + ' uses ' + ab.name + '.', 'danger')
        }
    
        // Enemy mini-affixes (vampiric, frozen, hexed, etc.)
        applyEnemyAffixesOnEnemyHit(enemy, p, { hpDamage: hpDamage, damageTotal: dmg, isMagic: isMagic, abilityId: aid })
    
        return { damageDealt: dmg, healDone, shieldShattered }
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
    
    function enemyAct(enemy) {
        const st = state
        try {
            if (st && st.debug && st.debug.capturePerf) {
                const ex = {
                    enemyId: enemy && enemy.id ? String(enemy.id) : null,
                    intent: enemy && enemy.intent && enemy.intent.aid ? String(enemy.intent.aid) : null
                }
                return perfWrap(st, 'combat:enemyAct', ex, () => _enemyActImpl(enemy))
            }
        } catch (_) {}
        return _enemyActImpl(enemy)
    }
    
    function _enemyActImpl(enemy) {
        if (!state.inCombat || !enemy) return
        const p = state.player
        if (!p) return
    
        // Keep currentEnemy pointing at the acting enemy for any helper code that relies on it.
        const prev = state.currentEnemy
        state.currentEnemy = enemy
    
        try {
            ensureEnemyRuntime(enemy)
    
            // DoT on enemy (from player/companion), then early-out if it dies
            applyEndOfTurnEffectsEnemy(enemy)
            if (enemy.hp <= 0) {
                handleEnemyDefeat(enemy)
                return
            }
    
            // Tick enemy timed states (guard/enrage/chill, debuffs, broken/stun)
            const skipped = tickEnemyStartOfTurn(enemy)
            if (skipped) {
                return
            }
    
            // --- Intent (telegraphed attacks) ---
            if (enemy.intent && enemy.intent.aid) {
                enemy.intent.turnsLeft = (enemy.intent.turnsLeft || 0) - 1
                if (enemy.intent.turnsLeft <= 0) {
                    const aid = enemy.intent.aid
                    enemy.intent = null
    
                    const beforeHp = p.hp
                    const beforeEnemyHp = enemy.hp
                    const beforeShield = p.status && p.status.shield ? p.status.shield : 0
    
                    applyEnemyAbilityToPlayer(enemy, p, aid)
    
                    const dmgDealt = Math.max(0, beforeHp - p.hp)
                    const healDone = Math.max(0, enemy.hp - beforeEnemyHp)
                    const shieldDelta = Math.max(
                        0,
                        beforeShield - (p.status && p.status.shield ? p.status.shield : 0)
                    )
    
                    const reward = dmgDealt + healDone * 0.8 + shieldDelta * 0.35
                    updateEnemyLearning(enemy, aid, reward)
    
                    if (p.resourceKey === 'fury') {
                        p.resource = Math.min(p.maxResource, (p.resource || 0) + 10)
                    }
    
                    updateHUD()
    
    				if (p.hp <= 0 && !(state.flags && state.flags.godMode)) {
                        handlePlayerDefeat()
                        return
                    }
    				if (p.hp <= 0 && (state.flags && state.flags.godMode)) {
                        p.hp = 1
                        updateHUD()
                    }
    
                    return
                } else {
                    addLog(enemy.name + ' continues to ready a powerful attack...', 'system')
                    return
                }
            }
    
            // Choose + use an ability
            const aid = chooseEnemyAbility(enemy, p)
            const ab = ENEMY_ABILITIES[aid] || ENEMY_ABILITIES.enemyStrike
    
            // Telegraph certain big moves for counterplay.
            if (ab.telegraphTurns && ab.telegraphTurns > 0) {
                enemy.intent = { aid: aid, turnsLeft: ab.telegraphTurns }
    
                // Commit cooldown on declare
                const cd = ab.cooldown || 0
                if (cd > 0) enemy.abilityCooldowns[aid] = cd
    
                const msg = ab.telegraphText
                    ? enemy.name + ' ' + ab.telegraphText
                    : enemy.name + ' prepares ' + ab.name + '!'
                addLog(msg, 'danger')
                return
            }
    
            const cd = ab.cooldown || 0
            if (cd > 0) enemy.abilityCooldowns[aid] = cd
    
            const beforeHp = p.hp
            const beforeEnemyHp = enemy.hp
            const beforeShield = p.status && p.status.shield ? p.status.shield : 0
    
            applyEnemyAbilityToPlayer(enemy, p, aid)
    
            const dmgDealt = Math.max(0, beforeHp - p.hp)
            const healDone = Math.max(0, enemy.hp - beforeEnemyHp)
            const shieldDelta = Math.max(
                0,
                beforeShield - (p.status && p.status.shield ? p.status.shield : 0)
            )
    
            const reward = dmgDealt + healDone * 0.8 + shieldDelta * 0.35
            updateEnemyLearning(enemy, aid, reward)
    
            if (p.resourceKey === 'fury') {
                p.resource = Math.min(p.maxResource, (p.resource || 0) + 10)
            }
    
            updateHUD()
    
    		if (p.hp <= 0 && !(state.flags && state.flags.godMode)) {
                handlePlayerDefeat()
                return
            }
    		if (p.hp <= 0 && (state.flags && state.flags.godMode)) {
                p.hp = 1
                updateHUD()
            }
        } finally {
            // Restore previous target (UI) after acting.
            state.currentEnemy = prev
        }
    }
    
    function enemyTurn() {
        const st = state
        try {
            if (st && st.debug && st.debug.capturePerf) {
                return perfWrap(st, 'combat:enemyTurn', null, () => _enemyTurnImpl())
            }
        } catch (_) {}
        return _enemyTurnImpl()
    }
    
    function _enemyTurnImpl() {
        if (!state.inCombat || !state.currentEnemy) return
        const acting = state.currentEnemy
        enemyAct(acting)
        if (state.inCombat) {
            postEnemyTurn()
        }
    }
    
    function applyEndOfTurnEffectsEnemy(enemy) {
        if (enemy.bleedTurns && enemy.bleedTurns > 0 && enemy.bleedDamage) {
            enemy.hp -= enemy.bleedDamage
            enemy.bleedTurns -= 1
            addLog(
                enemy.name + ' bleeds for ' + enemy.bleedDamage + ' damage.',
                'good',
                { domain: 'combat', kind: 'status', actor: 'player', effect: 'bleed' }
            )
            if (enemy.bleedTurns <= 0) {
                addLog(enemy.name + "'s bleeding slows.", 'system')
            }
        }
    
    
        if (enemy.burnTurns && enemy.burnTurns > 0 && enemy.burnDamage) {
            enemy.hp -= enemy.burnDamage
            enemy.burnTurns -= 1
            addLog(
                enemy.name + ' burns for ' + enemy.burnDamage + ' damage.',
                'good',
                { domain: 'combat', kind: 'status', actor: 'player', effect: 'burn' }
            )
            if (enemy.burnTurns <= 0) {
                addLog(enemy.name + "'s flames die down.", 'system')
            }
        }
    
    // Elite regen (kept quiet unless it actually heals)
    if (enemy.eliteRegenPct && enemy.eliteRegenPct > 0 && enemy.hp > 0) {
        const before = enemy.hp
        const heal = Math.max(1, Math.round(enemy.maxHp * enemy.eliteRegenPct))
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal)
        const gained = enemy.hp - before
        if (gained > 0) {
            addLog(enemy.name + ' regenerates ' + gained + ' HP.', 'system')
        }
    }
    
    // Mini-affix regen (separate from Elite regen; stacks if both exist)
    if (enemy.affixRegenPct && enemy.affixRegenPct > 0 && enemy.hp > 0) {
        const before = enemy.hp
        const heal = Math.max(1, Math.round(enemy.maxHp * enemy.affixRegenPct))
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal)
        const gained = enemy.hp - before
        if (gained > 0) {
            addLog(enemy.name + ' regenerates ' + gained + ' HP.', 'system')
        }
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
    
    function applyEndOfTurnEffectsPlayer(p) {
        if (!p || !p.status) return
    
        // Reserved for end-of-round effects (non-bleed). In Patch 1.1.9, bleed damage now
        // ticks at the start of the affected actor's turn to match true turn order.
    }
    
    function applyStartOfTurnEffectsPlayer(p) {
        try { _ensureCombatEnginesBound() } catch (_) {}
        const StatusEngine = getStatusEngine ? getStatusEngine() : null
        if (!StatusEngine) return null
        // Smoke tests (and some legacy call sites) pass the player explicitly.
        // If omitted, fall back to the active engine state.
        if (!p) p = (state && state.player) ? state.player : (typeof PLAYER !== 'undefined' ? PLAYER : null)
        return StatusEngine.applyStartOfTurnEffectsPlayer(p)
    }
    
    // Called once when the player's turn begins (Patch 1.1.9 true turn order).
    // This is where player bleed is applied. We guard against double-application
    // by stamping the current combat round.
    function beginPlayerTurn() {
        if (!state || !state.inCombat) return
        const c = ensureCombatTurnState()
        if (!c || c.busy) return
    
        const round = Number.isFinite(c.round) ? c.round : 1
        if (c._lastPlayerTurnRoundApplied === round) return
        c._lastPlayerTurnRoundApplied = round
    
        const p = state.player
        applyStartOfTurnEffectsPlayer(p)
    
        // If bleed kills you, resolve defeat before returning control.
    	if (p && p.hp <= 0 && !(state.flags && state.flags.godMode)) {
            handlePlayerDefeat()
            return
        }
    	if (p && p.hp <= 0 && (state.flags && state.flags.godMode)) {
            p.hp = 1
        }
    
        updateHUD()
        updateEnemyPanel()
    }
    
    function tickPlayerTimedStatuses(p) {
        try { _ensureCombatEnginesBound() } catch (_) {}
        const StatusEngine = getStatusEngine ? getStatusEngine() : null
        if (!StatusEngine) return null
        // Allow call sites to omit the player reference (older engine code + smoke tests).
        if (!p) p = (state && state.player) ? state.player : (typeof PLAYER !== 'undefined' ? PLAYER : null)
        return StatusEngine.tickPlayerTimedStatuses(p)
    }
    
    function postEnemyTurn() {
        const p = state.player
        if (!p) return
    
        const _hasteMult = getPlayerHasteMultiplier(p, 120)
    
        // Passive resource regen at end of round
        if (p.resourceKey === 'mana') {
            p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(6 * _hasteMult)))
        } else if (p.resourceKey === 'essence') {
            p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(5 * _hasteMult)))
        } else if (p.resourceKey === 'blood') {
            p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(4 * _hasteMult)))
        }
    
        // End-of-round effects (resource regen + HP regen + timed statuses).
        applyEndOfTurnEffectsPlayer(p)
        // HP Regen affix ticks on round boundaries.
        applyPlayerRegenTick()
    
        tickPlayerTimedStatuses()
    
        updateHUD()
        updateEnemyPanel()
    
        // tick cooldowns once per full round
        tickCompanionCooldowns()
        tickEnemyCooldowns()
    }
    
    function recordBattleResult(outcome) {
        if (state.difficulty !== 'dynamic') return
    
        if (!state.dynamicDifficulty) {
            state.dynamicDifficulty = {
                band: 0,
                tooEasyStreak: 0,
                struggleStreak: 0
            }
        }
    
        const dd = state.dynamicDifficulty
        const p = state.player || { hp: 0, maxHp: 1 }
    
        if (outcome === 'win') {
            let hpRatio = 0
            if (p.maxHp > 0) {
                hpRatio = p.hp / p.maxHp
            }
    
            if (hpRatio >= 0.8) {
                dd.tooEasyStreak = (dd.tooEasyStreak || 0) + 1
                dd.struggleStreak = 0
            } else if (hpRatio <= 0.3) {
                dd.struggleStreak = (dd.struggleStreak || 0) + 1
                dd.tooEasyStreak = 0
            } else {
                dd.tooEasyStreak = 0
                dd.struggleStreak = 0
            }
        } else if (outcome === 'loss') {
            dd.struggleStreak = (dd.struggleStreak || 0) + 2
            dd.tooEasyStreak = 0
        }
    
        const threshold = 3
        let changed = false
    
        // ramp up when it's too easy
        if (dd.tooEasyStreak >= threshold && dd.band < 2) {
            dd.band += 1
            dd.tooEasyStreak = 0
            changed = true
            addLog(
                'The realm grows more dangerous as you dominate your foes.',
                'system'
            )
        }
        // ramp down when you're struggling
        else if (dd.struggleStreak >= threshold && dd.band > -2) {
            dd.band -= 1
            dd.struggleStreak = 0
            changed = true
            addLog(
                'The realm seems to ease up as your struggles are noticed.',
                'system'
            )
        }
    
        if (changed) {
            updateHUD()
            requestSave('legacy')
        }
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
                                ? ' ×' + (d.quantity || 1)
                                : '')
                    )
                    .join(', ')
    
                addLog('You loot ' + names + '.', 'good')
    
                if (c) c.battleDrops = (c.battleDrops || 0) + 1
            }
        }
    
        // World event (consumed by questEvents + autosave plugins)
        try { emit('world:enemyDefeated', { enemy }) } catch (_) {}
    
        // Legacy quest hook (fallback when questEvents plugin isn't present)
        if (!_questEventsEnabled()) {
            const quests = getQuests ? getQuests() : null
            try { quests && quests.applyQuestProgressOnEnemyDefeat && quests.applyQuestProgressOnEnemyDefeat(enemy) } catch (_) {}
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
            emit('world:battleEnded', { result: 'win', finalEnemy: enemy })
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
            emit('world:battleEnded', { result: 'loss' })
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
                try { if (modalEl) modalEl.dataset.lock = '0' } catch (_) {}
                closeModal()
                loadGame(true)
            })
    
            const btnMenu = document.createElement('button')
            btnMenu.className = 'btn outline'
            btnMenu.textContent = 'Main Menu'
            btnMenu.addEventListener('click', () => {
                try { if (modalEl) modalEl.dataset.lock = '0' } catch (_) {}
                closeModal()
                switchScreen('mainMenu')
            })
    
            row.appendChild(btnLoad)
            row.appendChild(btnMenu)
            body.appendChild(row)
        })
    
        // Make defeat modal non-dismissable by clicking outside / pressing ESC.
        try {
            if (modalEl) {
                modalEl.dataset.lock = '1'
                modalEl.dataset.owner = 'defeat'
            }
            const closeBtn = document.getElementById('modalClose')
            if (closeBtn) closeBtn.style.display = 'none'
        } catch (_) {}
    }
    
    function tryFlee() {
        if (!state.inCombat) return
        if (!guardPlayerTurn()) return
    
        const chance = 0.45
        if (rand('encounter.pick') < chance) {
            addLog('You slip away from the fight.', 'system')
            state.inCombat = false
            state.currentEnemy = null
            state.enemies = []
            resetPlayerCombatStatus(state.player)
            setScene(
                'On the Path',
                'You catch your breath after fleeing. The forest remains dangerous, but you live to fight again.'
            )
            updateHUD()
            updateEnemyPanel()
            renderActions()
            requestSave('legacy')
        } else {
            addLog('You fail to escape!', 'danger')
            endPlayerTurn({ source: 'fleeFail' })
        }
    }
    
    function rollLootForArea() {
        if (state.area === 'forest') {
            const options = [
                'potionSmall',
                'potionSmall',
                'potionSmall',
                'potionMana',
                'potionFury',
                'potionBlood'
            ]
            return options[randInt(0, options.length - 1, 'table.pick')]
        }
        if (state.area === 'ruins') {
            const options = [
                'potionSmall',
                'potionMana',
                'potionFury',
                'potionBlood',
                'potionEssence',
                'potionSmall'
            ]
            return options[randInt(0, options.length - 1, 'table.pick')]
        }
        if (state.area === 'marsh') {
            const options = [
                'potionSmall',
                'potionBlood',
                'potionEssence',
                'potionMana',
                'potionSmall'
            ]
            return options[randInt(0, options.length - 1, 'table.pick')]
        }
        if (state.area === 'frostpeak') {
            const options = [
                'potionSmall',
                'potionMana',
                'potionFury',
                'potionSmall',
                'potionEssence'
            ]
            return options[randInt(0, options.length - 1, 'table.pick')]
        }
        if (state.area === 'catacombs') {
            const options = [
                'potionBlood',
                'potionEssence',
                'potionMana',
                'potionSmall'
            ]
            return options[randInt(0, options.length - 1, 'table.pick')]
        }
        if (state.area === 'keep') {
            const options = [
                'potionEssence',
                'potionMana',
                'potionSmall',
                'potionBlood'
            ]
            return options[randInt(0, options.length - 1, 'table.pick')]
        }
        return null
    }

    // Return public API
    return {
        ensureEnemyRuntime,
        ensureEnemyAbilityStat,
        tickEnemyStartOfTurn,
        canUseEnemyAbility,
        tickEnemyCooldowns,
        scoreEnemyAbility,
        chooseEnemyAbility,
        applyEnemyAbilityToPlayer,
        updateEnemyLearning,
        enemyAct,
        _enemyActImpl,
        enemyTurn,
        _enemyTurnImpl,
        applyEndOfTurnEffectsEnemy,
        decideEnemyAction,
        applyEndOfTurnEffectsPlayer,
        applyStartOfTurnEffectsPlayer,
        beginPlayerTurn,
        tickPlayerTimedStatuses,
        postEnemyTurn,
        recordBattleResult,
        handleEnemyDefeat,
        handlePlayerDefeat,
        tryFlee,
        rollLootForArea
    };
}
