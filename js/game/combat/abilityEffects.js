// abilityEffects.js
// Extracted from engine.js (Patch 1.2.65) to keep engine orchestration smaller.
// NOTE: Ability effect functions intentionally depend on engine helpers passed via `deps`.
//       This avoids circular imports while keeping the original effect logic intact.

export function buildAbilityEffects(deps = {}) {
    const {
        getState,
        _dealPlayerMagic,
        _dealPlayerMagicAoe,
        _dealPlayerPhysical,
        _dealPlayerPhysicalAoe,
        _healPlayer,
        _addShield,
        _applyTimedBuff,
        playerHasTalent,
        applyEnemyAtkDown,
        finiteNumber,
        getAliveEnemies,
        grantCompanion,
        addLog,
        getPlayerHasteMultiplier,
        rand
    } = deps

    // Some effects use a gain multiplier that can change at runtime (difficulty, buffs, etc.).
    // Pass `getGainMult(p)` to keep this dynamic; fallback to deps._gainMult or 1.
    const getGainMult = (p) => {
        // Base behavior: scale “resource gain” by haste.
        // Engine helper lives in engine.js; we inject it here to avoid circular imports.
        if (typeof deps.getGainMult === 'function') return deps.getGainMult(p)
        if (typeof deps.getGainMultFor === 'function') return deps.getGainMultFor(p)
        if (typeof getPlayerHasteMultiplier === 'function') return getPlayerHasteMultiplier(p, 150)
        return typeof deps._gainMult === 'number' ? deps._gainMult : 1
    }

const ABILITY_EFFECTS = {
        // --- MAGE --------------------------------------------------------------
        fireball: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.6, 'fire')
            ctx.didDamage = true
            return 'You launch a Fireball for ' + dmg + ' fire damage.'
        },
        iceShard: (p, enemy, ctx) => {
            // Element label normalized to match loot/affix system (frost, not ice).
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.25, 'frost')
            enemy.chilledTurns = Math.max(enemy.chilledTurns || 0, 2)
            ctx.didDamage = true
            return 'Ice shards pierce for ' + dmg + ' damage and chill the foe.'
        },
        arcaneShield: (p, enemy, ctx) => {
            const shield = Math.round(20 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            // Talent: Bulwark Spikes – prime a one-time reflect.
            if (playerHasTalent(p, 'warrior_bulwark_spikes')) {
                p.status.bulwarkSpikesCharges = 1
                p.status.bulwarkSpikesDamage = Math.max(6, Math.round(shield * 0.6))
            }
            return 'Arcane energies form a shield worth ' + shield + ' points.'
        },

        // --- WARRIOR -----------------------------------------------------------
        powerStrike: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.4)
            ctx.didDamage = true
            return 'You deliver a Power Strike for ' + dmg + ' damage.'
        },
        battleCry: (p, enemy, ctx) => {
            _applyTimedBuff(p.status, 'buffAttack', 4, 2)
            p.resource = Math.min(p.maxResource, p.resource + 10)
            return 'Your Battle Cry boosts Attack and restores Fury.'
        },
        shieldWall: (p, enemy, ctx) => {
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 2)
            return 'You brace behind a Shield Wall, reducing damage for 2 turns.'
        },

        // --- BLOOD KNIGHT ------------------------------------------------------
        bloodSlash: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.5)
            ctx.didDamage = true
            return 'You carve a Blood Slash for ' + dmg + ' damage.'
        },
        leech: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 0.9, 'shadow')
            ctx.didDamage = true
            const healMult = playerHasTalent(p, 'blood_sanguine_pact') ? 0.6 * 1.15 : 0.6
            const healed = _healPlayer(p, Math.round(dmg * healMult), ctx)
            return 'Leech drains ' + dmg + ' HP and restores ' + healed + ' HP to you.'
        },
        hemorrhage: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.9)
            ctx.didDamage = true
            enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.attack * 0.7))
            enemy.bleedTurns = (enemy.bleedTurns || 0) + 3
            return 'Hemorrhage deals ' + dmg + ' and opens a deep wound.'
        },

        // --- RANGER ------------------------------------------------------------
        piercingShot: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.3)
            ctx.didDamage = true
            return 'You fire a Piercing Shot for ' + dmg + ' damage.'
        },
        twinArrows: (p, enemy, ctx) => {
            // FIX: on-hit effects now apply to each arrow.
            const dmg1 = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.75)
            const dmg2 = enemy.hp > 0 ? _dealPlayerPhysical(p, enemy, p.stats.attack * 0.75) : 0
            enemy.markedStacks = Math.min(5, (enemy.markedStacks || 0) + (dmg2 > 0 ? 2 : 1))
            enemy.markedTurns = Math.max(enemy.markedTurns || 0, 3 + (playerHasTalent(p, 'ranger_long_mark') ? 1 : 0))
            ctx.didDamage = true
            return 'Twin Arrows strike twice for ' + (dmg1 + dmg2) + ' total damage.'
        },
        markedPrey: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.8)
            ctx.didDamage = true
            applyEnemyAtkDown(enemy, 2, 2)
            enemy.markedStacks = Math.min(5, (enemy.markedStacks || 0) + 1)
            enemy.markedTurns = Math.max(enemy.markedTurns || 0, 3 + (playerHasTalent(p, 'ranger_long_mark') ? 1 : 0))
            return 'Marked Prey hits for ' + dmg + ' and weakens the foe.'
        },

        // --- PALADIN -----------------------------------------------------------
        holyStrike: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.2, 'holy')
            ctx.didDamage = true
            return 'Holy Strike smashes for ' + dmg + ' damage.'
        },
        blessingLight: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.25), ctx)
            // This spell is described as granting a small protective shield.
            // Patch 1.2.0: ensure the shield component always applies.
            const shield = Math.round(14 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Blessing of Light restores ' + healed + ' HP and grants a ' + shield + '-point shield.'
        },
        retributionAura: (p, enemy, ctx) => {
            _applyTimedBuff(p.status, 'buffAttack', 3, 3) // FIX: set duration
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3) // FIX: ensure intended duration
            return 'A Retribution Aura surrounds you, boosting Attack and hardening you for 3 turns.'
        },

        // --- ROGUE -------------------------------------------------------------
        backstab: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.6)
            ctx.didDamage = true
            p.status.comboPoints = Math.min(5, (p.status.comboPoints || 0) + 1)
            return 'You Backstab for ' + dmg + ' damage!'
        },
        poisonedBlade: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.0, 'poison')
            ctx.didDamage = true
            enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.attack * 0.5))
            enemy.bleedTurns = (enemy.bleedTurns || 0) + 3
            p.status.comboPoints = Math.min(5, (p.status.comboPoints || 0) + 1)
            return 'Poisoned Blade deals ' + dmg + ' and leaves the foe suffering over time.'
        },
        shadowstep: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.15), ctx)
            _applyTimedBuff(p.status, 'buffAttack', 2, 2) // FIX: timed buff instead of permanent
            p.status.comboPoints = Math.min(5, (p.status.comboPoints || 0) + 1)
            return 'Shadowstep restores ' + healed + ' HP and sharpens your next strikes.'
        },

        // --- CLERIC ------------------------------------------------------------
        holyHeal: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.35), ctx)
            return 'Holy Heal restores ' + healed + ' HP.'
        },
        smite: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.3, 'holy')
            ctx.didDamage = true
            return 'You Smite the foe for ' + dmg + ' holy damage.'
        },
        purify: (p, enemy, ctx) => {
            const oldBleed = p.status.bleedTurns || 0
            p.status.bleedTurns = 0
            p.status.bleedDamage = 0
            const shield = Math.round(15 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Purify cleanses bleeding (' + oldBleed + ' turn(s) removed) and grants a ' + shield + '-point shield.'
        },

        // --- NECROMANCER -------------------------------------------------------
        soulBolt: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.4, 'shadow')
            ctx.didDamage = true
            const healed = _healPlayer(p, Math.round(dmg * 0.4), ctx)
            const st = p.status || (p.status = {})
            st.soulShards = Math.min(5, (st.soulShards || 0) + 1)
            return 'Soul Bolt hits for ' + dmg + ' and siphons ' + healed + ' HP.'
        },
        raiseBones: (p, enemy, ctx) => {
            grantCompanion('skeleton')
            return 'Bones knit together: a Skeletal companion joins the battle.'
        },
        decay: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 0.9, 'poison')
            ctx.didDamage = true
            enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.magic * 0.7))
            enemy.bleedTurns = (enemy.bleedTurns || 0) + 3
            return 'Decay deals ' + dmg + ' and necrotic rot gnaws at the foe.'
        },

        // --- SHAMAN ------------------------------------------------------------
        lightningLash: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.5, 'lightning')
            ctx.didDamage = true
            // Small jolt chance (non-boss).
            if (!enemy.isBoss && rand('encounter.eliteRoll') < 0.15) {
                enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
                addLog(enemy.name + ' is jolted!', 'good')
            }
            return 'Lightning Lash deals ' + dmg + ' lightning damage.'
        },
        earthskin: (p, enemy, ctx) => {
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
            const shield = Math.round(20 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Earthskin reduces damage and adds a ' + shield + '-point barrier.'
        },
        spiritHowl: (p, enemy, ctx) => {
            const s = typeof getState === 'function' ? getState() : null
            if (s && s.companion) {
                s.companion.attack += 4
                return 'Spirit Howl emboldens ' + s.companion.name + ', increasing their attack.'
            }
            return 'Your howl echoes, but no companion is present to answer.'
        },

        // --- VAMPIRE -----------------------------------------------------------
        essenceDrain: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.2, 'arcane')
            ctx.didDamage = true
            const healed = _healPlayer(p, Math.round(dmg * 0.5), ctx)
            const essenceGain = 15
            const beforeRes = p.resource
            p.resource = Math.min(p.maxResource, p.resource + essenceGain)
            return 'Essence Drain deals ' + dmg + ', heals ' + healed + ' HP, and restores ' + (p.resource - beforeRes) + ' Essence.'
        },
        batSwarm: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.3, 'shadow')
            ctx.didDamage = true
            enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.magic * 0.5))
            enemy.bleedTurns = (enemy.bleedTurns || 0) + 2
            return 'A bat swarm rends for ' + dmg + ' and leaves the foe bleeding.'
        },
        shadowVeil: (p, enemy, ctx) => {
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
            return 'Shadow Veil reduces damage taken for 3 turns.'
        },

        // --- BERSERKER ---------------------------------------------------------
        frenziedBlow: (p, enemy, ctx) => {
            const missing = Math.max(0, p.maxHp - p.hp)
            const bonusFactor = 1 + Math.min(0.8, missing / p.maxHp)
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * bonusFactor)
            ctx.didDamage = true
            return 'Frenzied Blow crashes for ' + dmg + ' damage.'
        },
        warCryBerserker: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.2), ctx)
            _applyTimedBuff(p.status, 'buffAttack', 3, 2) // FIX: set duration
            return 'War Cry restores ' + healed + ' HP and surges your Attack.'
        },
        bloodlustRage: (p, enemy, ctx) => {
            const furyGain = 25
            p.resource = Math.min(p.maxResource, p.resource + furyGain)
            _applyTimedBuff(p.status, 'buffAttack', 2, 2) // FIX: set duration
            return 'Bloodlust grants ' + furyGain + ' Fury and sharpens your offense.'
        },

        // --- PATCH 1.1.0: NEW UNLOCKS -----------------------------------------
        arcaneSurge: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.25, 'arcane')
            ctx.didDamage = true
            _applyTimedBuff(p.status, 'buffMagic', 3, 2)
            return 'Arcane Surge deals ' + dmg + ' and charges your magic for 2 turns.'
        },
        meteorSigil: (p, enemy, ctx) => {
            const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * 2.2, 'fire', { splashMult: 0.6 })
            ctx.didDamage = true
            const alive = getAliveEnemies()
            if (alive.length > 1) {
                const primary = hit.hits.find((h) => h.enemy === enemy)
                const primaryDmg = primary ? primary.dmg : 0
                const splashTotal = Math.max(0, hit.total - primaryDmg)
                return 'Meteor Sigil slams the battlefield for ' + hit.total + ' total damage (' + primaryDmg + ' to your target, ' + splashTotal + ' to the rest).'
            }
            return 'Meteor Sigil calls down destruction for ' + hit.total + ' damage!'
        },
        cleave: (p, enemy, ctx) => {
            const hit = _dealPlayerPhysicalAoe(p, enemy, p.stats.attack * 1.25, null, { splashMult: 0.72 * (playerHasTalent(p, 'warrior_deep_cleave') ? 1.15 : 1) })
            ctx.didDamage = true
            p.resource = Math.min(p.maxResource, p.resource + 12)
            if (getAliveEnemies().length > 1) {
                return 'Cleave carves through the group for ' + hit.total + ' total damage and stokes your Fury.'
            }
            return 'Cleave hits for ' + hit.total + ' and stokes your Fury.'
        },
        ironFortress: (p, enemy, ctx) => {
            const shield = Math.round(35 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
            return 'Iron Fortress grants a ' + shield + '-point barrier and heavy damage reduction for 3 turns.'
        },
        crimsonPact: (p, enemy, ctx) => {
            const gain = 24
            p.resource = Math.min(p.maxResource, p.resource + gain)
            _applyTimedBuff(p.status, 'buffAttack', 3, 3)
            return 'Crimson Pact grants +' + gain + ' Blood and a fierce Attack buff.'
        },
        bloodNova: (p, enemy, ctx) => {
            const stormMult = playerHasTalent(p, 'blood_crimson_storm') ? 1.15 : 1
            const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * 1.45 * stormMult, 'shadow', { splashMult: 0.78 })
            ctx.didDamage = true
            // Bleed all enemies hit.
            const bleedDmg = Math.round(p.stats.magic * 0.6)
            hit.hits.forEach(({ enemy: e }) => {
                if (!e || finiteNumber(e.hp, 0) <= 0) return
                e.bleedDamage = Math.max(e.bleedDamage || 0, bleedDmg)
                e.bleedTurns = (e.bleedTurns || 0) + 3 + (playerHasTalent(p, 'blood_thicker_than_water') ? 1 : 0)
            })
            if (getAliveEnemies().length > 1) {
                return 'Blood Nova erupts for ' + hit.total + ' total shadow damage and sets the group bleeding.'
            }
            return 'Blood Nova detonates for ' + hit.total + ' and makes the foe bleed.'
        },
        evasionRoll: (p, enemy, ctx) => {
            p.status.evasionBonus = Math.max(p.status.evasionBonus || 0, 0.25)
            p.status.evasionTurns = Math.max(p.status.evasionTurns || 0, 2)
            return 'Evasion Roll makes you harder to hit for 2 turns.'
        },
        rainOfThorns: (p, enemy, ctx) => {
            const enemies = getAliveEnemies()
            let total = 0
            const base = p.stats.attack * 0.75
            // One hit to everyone, plus a second hit to the primary target.
            enemies.forEach((e) => {
                total += _dealPlayerPhysical(p, e, base)
            })
            if (enemy && finiteNumber(enemy.hp, 0) > 0) {
                total += _dealPlayerPhysical(p, enemy, base)
            }
            ctx.didDamage = true
            const bleedMult = playerHasTalent(p, 'ranger_thorned_arrows') ? 1.10 : 1
            const bleedDmg = Math.round(p.stats.attack * 0.55 * bleedMult)
            enemies.forEach((e) => {
                if (!e || finiteNumber(e.hp, 0) <= 0) return
                e.bleedDamage = Math.max(e.bleedDamage || 0, bleedDmg)
                e.bleedTurns = (e.bleedTurns || 0) + 4
            })
            if (enemies.length > 1) {
                return 'Rain of Thorns peppers the group for ' + total + ' total damage and leaves them bleeding.'
            }
            return 'Rain of Thorns deals ' + total + ' and deepens bleeding.'
        },
        judgment: (p, enemy, ctx) => {
            const extra = (enemy.bleedTurns && enemy.bleedTurns > 0) || (enemy.chilledTurns && enemy.chilledTurns > 0)
            const mult = extra ? 1.25 : 1
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.35 * mult, 'holy')
            ctx.didDamage = true
            if (extra) {
                const healed = _healPlayer(p, Math.round(p.maxHp * 0.10), ctx)
                return 'Judgment smites for ' + dmg + ' and restores ' + healed + ' HP.'
            }
            return 'Judgment smites for ' + dmg + ' holy damage.'
        },
        aegisVow: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.18), ctx)
            const shield = Math.round((25 + healed) * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
            return 'Aegis Vow heals ' + healed + ' and raises a ' + shield + '-point aegis.'
        },
        smokeBomb: (p, enemy, ctx) => {
            p.status.evasionBonus = Math.max(p.status.evasionBonus || 0, 0.35)
            p.status.evasionTurns = Math.max(p.status.evasionTurns || 0, 2)
            return 'Smoke Bomb shrouds you, granting high dodge for 2 turns.'
        },
        cripplingFlurry: (p, enemy, ctx) => {
            const a = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.55)
            const b = enemy.hp > 0 ? _dealPlayerPhysical(p, enemy, p.stats.attack * 0.55) : 0
            const c = enemy.hp > 0 ? _dealPlayerPhysical(p, enemy, p.stats.attack * 0.55) : 0
            ctx.didDamage = true
            enemy.bleedTurns = (enemy.bleedTurns || 0) + 4
            return 'Crippling Flurry strikes three times for ' + (a + b + c) + ' total and extends bleeding.'
        },
        divineWard: (p, enemy, ctx) => {
            const oldBleed = p.status.bleedTurns || 0
            p.status.bleedTurns = 0
            p.status.bleedDamage = 0
            const shield = Math.round(40 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Divine Ward cleanses bleeding (' + oldBleed + ' removed) and grants a ' + shield + '-point shield.'
        },
        benediction: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.30), ctx)
            _applyTimedBuff(p.status, 'buffMagic', 4, 3)
            return 'Benediction restores ' + healed + ' HP and strengthens your magic for 3 turns.'
        },
        boneArmor: (p, enemy, ctx) => {
            const shield = Math.round(30 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            applyEnemyAtkDown(enemy, 3, 2)
            return 'Bone Armor grants a ' + shield + '-point shield and weakens the enemy.'
        },
        deathMark: (p, enemy, ctx) => {
            const extra = playerHasTalent(p, 'necromancer_deathmark_ritual') ? 1 : 0
            const mult = playerHasTalent(p, 'necromancer_deathmark_ritual') ? 1.50 : 1.35
            enemy.deathMarkTurns = Math.max(enemy.deathMarkTurns || 0, 3 + extra)
            enemy.deathMarkMult = Math.max(enemy.deathMarkMult || 0, mult)
            return 'A Death Mark brands the foe. Your next shadow hit will be amplified.'
        },
        totemSpark: (p, enemy, ctx) => {
            const st = p.status || (p.status = {})
            st.totemType = 'spark'
            st.totemTurns = Math.max(st.totemTurns || 0, 3)
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.05, 'lightning')
            ctx.didDamage = true
            if (!enemy.isBoss && rand('encounter.eliteRoll') < 0.20) {
                enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
                addLog(enemy.name + ' is stunned by the spark!', 'good')
            }
            return 'Totem Spark zaps for ' + dmg + ' damage.'
        },
        stoneQuake: (p, enemy, ctx) => {
            const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * 1.2, 'earth', { splashMult: 0.82 })
            ctx.didDamage = true
            hit.hits.forEach(({ enemy: e }) => {
                if (!e || finiteNumber(e.hp, 0) <= 0) return
                e.chilledTurns = Math.max(e.chilledTurns || 0, 2)
            })
            if (getAliveEnemies().length > 1) {
                return 'Stone Quake ripples through the battlefield for ' + hit.total + ' total damage and chills the group.'
            }
            return 'Stone Quake deals ' + hit.total + ' and chills the foe.'
        },
        rageRush: (p, enemy, ctx) => {
            const missingPct = Math.max(0, (p.maxHp - p.hp) / Math.max(1, p.maxHp))
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * (1.2 + missingPct * 0.5))
            ctx.didDamage = true
            p.resource = Math.min(p.maxResource, p.resource + 10)
            return 'Rage Rush slams for ' + dmg + ' damage and fuels your Fury.'
        },
        execute: (p, enemy, ctx) => {
            const hpPct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
            const mult = hpPct < 0.35 ? 2.4 : 1.5
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * mult)
            ctx.didDamage = true
            return hpPct < 0.35 ? 'Execute finishes with ' + dmg + ' damage!' : 'Execute strikes for ' + dmg + ' damage.'
        },
        nightFeast: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.5, 'shadow')
            ctx.didDamage = true
            const healed = _healPlayer(p, Math.round(dmg * 0.7), ctx)
            const beforeRes = p.resource
            p.resource = Math.min(p.maxResource, p.resource + 10)
            return 'Night Feast deals ' + dmg + ', heals ' + healed + ', and restores ' + (p.resource - beforeRes) + ' Essence.'
        },
        mistForm: (p, enemy, ctx) => {
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
            p.status.evasionBonus = Math.max(p.status.evasionBonus || 0, 0.20)
            p.status.evasionTurns = Math.max(p.status.evasionTurns || 0, 3)
            const shield = Math.round(20 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Mist Form shrouds you: heavy damage reduction and a ' + shield + '-point veil.'
        }
    ,
        // --- PATCH 1.1.7: NEW UNLOCKS (Lv 9 / Lv 12) -------------------------

        // Mage
        blink: (p, enemy, ctx) => {
            p.status.evasionBonus = Math.max(p.status.evasionBonus || 0, 0.30)
            p.status.evasionTurns = Math.max(p.status.evasionTurns || 0, 2)
            const shield = Math.round(12 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Blink warps you to safety: evasion rises and you gain a ' + shield + '-point ward.'
        },
        arcaneOverload: (p, enemy, ctx) => {
            // If Arcane Rhythm is active (3rd spell), this hits harder.
            const bonus = (ctx && ctx.critBonus && ctx.critBonus > 0) ? 1.15 : 1
            const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * 2.05 * bonus, 'arcane', { splashMult: 0.55 })
            ctx.didDamage = true
            if (getAliveEnemies().length > 1) {
                return 'Arcane Overload bursts across the line for ' + hit.total + ' total arcane damage.'
            }
            return 'Arcane Overload detonates for ' + hit.total + ' arcane damage.'
        },

        // Warrior
        shieldBash: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.05)
            ctx.didDamage = true
            if (!enemy.isBoss) enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
            const shield = Math.round(18 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Shield Bash deals ' + dmg + ' damage, staggers the foe, and grants a ' + shield + '-point shield.'
        },
        unbreakable: (p, enemy, ctx) => {
            const shield = Math.round(60 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 4)
            p.resource = Math.min(p.maxResource, p.resource + 10)
            return 'Unbreakable: a ' + shield + '-point barrier forms and you harden for 4 turns.'
        },

        // Blood Knight
        bloodArmor: (p, enemy, ctx) => {
            const shield = Math.round(55 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Blood Armor crystallizes into a ' + shield + '-point shield.'
        },
        crimsonAvatar: (p, enemy, ctx) => {
            _applyTimedBuff(p.status, 'buffAttack', 5, 3)
            _applyTimedBuff(p.status, 'buffMagic', 3, 3)
            p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(8 * getGainMult(p))))
            return 'Crimson Avatar awakens: your power surges for 3 turns.'
        },

        // Ranger
        huntersTrap: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.95)
            ctx.didDamage = true
            enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.attack * 0.55))
            enemy.bleedTurns = (enemy.bleedTurns || 0) + 2
            enemy.markedStacks = Math.min(5, (enemy.markedStacks || 0) + 2)
            enemy.markedTurns = Math.max(enemy.markedTurns || 0, 3 + (playerHasTalent(p, 'ranger_long_mark') ? 1 : 0))
            if (!enemy.isBoss) enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
            return "Hunter's Trap snaps for " + dmg + ' damage, marks the foe, and hinders them.'
        },
        headshot: (p, enemy, ctx) => {
            const marks = Math.max(0, Math.min(5, enemy.markedStacks || 0))
            const mult = 1.85 + (marks * 0.18)
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * mult)
            ctx.didDamage = true
            if (marks > 0) {
                enemy.markedStacks = 0
                enemy.markedTurns = 0
            }
            return marks > 0
                ? 'Headshot consumes ' + marks + ' Mark(s) for ' + dmg + ' damage!'
                : 'Headshot strikes for ' + dmg + ' damage.'
        },

        // Paladin
        cleanseFlame: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.22), ctx)
            // Cleanse common debuffs
            p.status.bleedTurns = 0
            p.status.bleedDamage = 0
            p.status.armorDownTurns = 0
            p.status.armorDown = 0
            p.status.atkDownTurns = 0
            p.status.atkDown = 0
            p.status.magicDownTurns = 0
            p.status.magicDown = 0
            const shield = Math.round(18 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Cleansing Flame heals ' + healed + ' HP, cleanses afflictions, and grants a ' + shield + '-point shield.'
        },
        divineIntervention: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.42), ctx)
            const shield = Math.round(30 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 2)
            return 'Divine Intervention restores ' + healed + ' HP and grants a ' + shield + '-point holy barrier.'
        },

        // Rogue
        eviscerate: (p, enemy, ctx) => {
            const st = p.status || (p.status = {})
            const cp = Math.max(0, Math.min(5, st.comboPoints || 0))
            const bleedBonus = (enemy.bleedTurns || 0) > 0 ? 1.15 : 1
            const mult = (1.05 + cp * 0.35) * bleedBonus
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * mult)
            ctx.didDamage = true
            st.comboPoints = 0
            return cp > 0
                ? 'Eviscerate spends ' + cp + ' Combo for ' + dmg + ' damage!'
                : 'Eviscerate strikes for ' + dmg + ' damage.'
        },
        vanish: (p, enemy, ctx) => {
            const st = p.status || (p.status = {})
            st.vanishTurns = Math.max(st.vanishTurns || 0, 2)
            st.evasionBonus = Math.max(st.evasionBonus || 0, 0.35)
            st.evasionTurns = Math.max(st.evasionTurns || 0, 2)
            st.comboPoints = Math.min(5, (st.comboPoints || 0) + 2)
            return 'Vanish: you slip into shadows, become elusive for 2 turns, and gain Combo momentum.'
        },

        // Cleric
        sanctify: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.26), ctx)
            const oldBleed = p.status.bleedTurns || 0
            p.status.bleedTurns = 0
            p.status.bleedDamage = 0
            const shield = Math.round(26 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Sanctify heals ' + healed + ' HP, cleanses bleeding (' + oldBleed + ' turn(s)), and adds a ' + shield + '-point shield.'
        },
        massPrayer: (p, enemy, ctx) => {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.38), ctx)
            _applyTimedBuff(p.status, 'buffMagic', 3, 3)
            const shield = Math.round(28 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'Mass Prayer restores ' + healed + ' HP, empowers your magic, and grants a ' + shield + '-point ward.'
        },

        // Necromancer
        harvest: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.35, 'shadow')
            ctx.didDamage = true
            const healed = _healPlayer(p, Math.round(dmg * 0.35), ctx)
            const st = p.status || (p.status = {})
            const gain = enemy.hp <= enemy.maxHp * 0.30 ? 3 : 2
            st.soulShards = Math.min(5, (st.soulShards || 0) + gain)
            return 'Harvest reaps ' + dmg + ' damage, heals ' + healed + ', and gathers ' + gain + ' Soul Shard(s).' 
        },
        lichForm: (p, enemy, ctx) => {
            const st = p.status || (p.status = {})
            st.lichTurns = Math.max(st.lichTurns || 0, 3)
            return 'Lich Form awakens: shadow magic is empowered for 3 turns.'
        },

        // Shaman
        totemEarth: (p, enemy, ctx) => {
            const st = p.status || (p.status = {})
            st.totemType = 'earth'
            st.totemTurns = Math.max(st.totemTurns || 0, 3)
            const shield = Math.round(28 * (ctx.healMult || 1))
            _addShield(p.status, shield)
            ctx.didShield = true
            return 'An Earth Totem rises: you gain a ' + shield + '-point barrier for protection.'
        },
        tempest: (p, enemy, ctx) => {
            const st = p.status || (p.status = {})
            const mult = st.totemTurns > 0 ? 2.05 : 1.75
            const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * mult, 'lightning', { splashMult: 0.65 })
            ctx.didDamage = true

            // Totem synergy: chance to stun each hit enemy (non-boss) while the totem is active.
            let stunned = 0
            if (st.totemTurns > 0) {
                hit.hits.forEach(({ enemy: e }) => {
                    if (!e || e.isBoss || finiteNumber(e.hp, 0) <= 0) return
                    if (rand('encounter.eliteRoll') < 0.22) {
                        e.stunTurns = Math.max(e.stunTurns || 0, 1)
                        stunned += 1
                    }
                })
            }

            if (getAliveEnemies().length > 1) {
                const extra = stunned > 0 ? ' (' + stunned + ' stunned)' : ''
                return 'Tempest chains through the group for ' + hit.total + ' total lightning damage' + extra + '.'
            }
            if (stunned > 0 && enemy && enemy.name) addLog(enemy.name + ' is stunned by the Tempest!', 'good')
            return 'Tempest crashes for ' + hit.total + ' lightning damage.'
        },

        // Berserker
        enrage: (p, enemy, ctx) => {
            _applyTimedBuff(p.status, 'buffAttack', 4, 4)
            p.resource = Math.min(p.maxResource, p.resource + 12)
            return 'Enrage fuels your fury: Attack rises for 4 turns.'
        },
        bloodFrenzy: (p, enemy, ctx) => {
            const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 2.05)
            ctx.didDamage = true
            const healed = _healPlayer(p, Math.round(dmg * 0.22), ctx)
            return 'Blood Frenzy tears for ' + dmg + ' damage and restores ' + healed + ' HP.'
        },

        // Vampire
        mesmerize: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.15, 'shadow')
            ctx.didDamage = true
            if (!enemy.isBoss) enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
            const before = p.resource
            p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(8 * getGainMult(p))))
            return 'Mesmerize deals ' + dmg + ' and staggers the foe, restoring ' + (p.resource - before) + ' Essence.'
        },
        bloodMoon: (p, enemy, ctx) => {
            const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 2.1, 'shadow')
            ctx.didDamage = true
            const healed = _healPlayer(p, Math.round(dmg * 0.55), ctx)
            p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 2)
            return 'Blood Moon eclipses the foe for ' + dmg + ' damage and heals ' + healed + ' HP.'
        }
    }

    return ABILITY_EFFECTS
}
