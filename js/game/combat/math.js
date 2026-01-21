// js/game/combat/math.js
// Combat math module (damage + mitigation + affinity/resist helpers).
//
// This module avoids importing engine internals directly.
// The engine provides helpers + state access via dependency injection.

export function createCombatMath(deps) {
  const {
    getState,

    // numeric + rng
    clampNumber,
    rand,
    _roundIntStable,

    // combat context
    getActiveDifficultyConfig,
    _getPlayerAbilityContext,

    // element helpers
    normalizeElementType,
    getPlayerElementalBonusPct,
    getPlayerElementalResistPct,

    // flags/talents + logging
    playerHasTalent,
    addLog,
  } = deps

  // Patch 1.2.0 legacy normalization helpers (kept byte-for-byte compatible with the
  // pre-modular engine so the smoke tests remain stable).
  function _normalizePctMaybeFraction(n, { allowNegative = false } = {}) {
      const v = Number(n)
      if (!Number.isFinite(v)) return 0

      // Allow negative "resist" style values when explicitly requested.
      if (!allowNegative && v <= 0) return 0
      if (allowNegative && v === 0) return 0

      const abs = Math.abs(v)
      // If the magnitude looks like a fraction-of-1 (0.15 = 15%, 1 = 100%), convert.
      if (abs > 0 && abs <= 1) return v * 100
      return v
  }

  function _normalizeAffinityMult(v, mode = 'any') {
      const n = Number(v)
      if (!Number.isFinite(n)) return 1

      // Accept several authoring styles:
      //  - Multiplier: 1.15 (15% weakness), 0.85 (15% resistance)
      //  - Percent delta: 15 or "15%" (15% weakness)
      //  - Negative percent delta: -13 or "-13%" (13% resistance)
      //  - Delta fractions: 0.12 -> +12% (weakness), -0.13 -> -13% (resistance)
      //
      // Heuristic:
      //  - Large magnitudes (>=3 or <=-1) are treated as percent deltas.
      //  - For RESISTS, values in (0..1) are treated as direct multipliers (e.g., 0.85).
      //  - For WEAKNESSES, values in (0..1) are treated as delta fractions (e.g., 0.12 -> 1.12).
      //  - Otherwise treat as a direct multiplier.
      if (Math.abs(n) >= 3 || n <= -1) return clampNumber(1 + n / 100, 0.05, 3)
      if (mode === 'resist' && n > 0 && n < 1) return clampNumber(n, 0.05, 3)
      if (Math.abs(n) < 1) return clampNumber(1 + n, 0.05, 3)
      return clampNumber(n, 0.05, 3)
  }

  function getEnemyAffinityMultiplier(enemy, elementType) {
      if (!enemy || !elementType) return 1
      const a = enemy.affinities || enemy.affinity || null
      if (!a) return 1

      // Normalize both the incoming element and the affinity keys so authored templates
      // like "Ice" or "Storm" still match the canonical combat keys (frost/lightning).
      const et = normalizeElementType(elementType)
      if (!et) return 1

      const pick = (obj) => {
          if (!obj) return null
          if (Object.prototype.hasOwnProperty.call(obj, et)) return obj[et]

          const raw = String(elementType)
          if (Object.prototype.hasOwnProperty.call(obj, raw)) return obj[raw]

          const low = raw.toLowerCase()
          if (Object.prototype.hasOwnProperty.call(obj, low)) return obj[low]

          // Last-resort: some content may have already stored the normalized key but
          // with different casing.
          const etLow = et.toLowerCase()
          if (Object.prototype.hasOwnProperty.call(obj, etLow)) return obj[etLow]

          // Final fallback: scan keys and normalize them so synonyms (Ice/Storm/etc.) match.
          try {
              for (const k in obj) {
                  if (!Object.prototype.hasOwnProperty.call(obj, k)) continue
                  const nk = normalizeElementType(k)
                  if (nk && nk === et) return obj[k]
              }
          } catch (_) {}

          return null
      }

      const weakV = pick(a.weak)
      if (weakV !== null && weakV !== undefined) return _normalizeAffinityMult(weakV, 'weak')

      const resV = pick(a.resist)
      if (resV !== null && resV !== undefined) return _normalizeAffinityMult(resV, 'resist')

      return 1
  }

  function getEnemyElementalResistPct(enemy, elementType) {
      if (!enemy || !elementType) return 0
      const map = enemy.elementalResists
      if (!map || typeof map !== 'object') return 0

      const et = normalizeElementType(elementType)
      if (!et) return 0

      const getV = (k) => _normalizePctMaybeFraction(map[k], { allowNegative: false })

      // Try canonical first.
      if (Object.prototype.hasOwnProperty.call(map, et)) return getV(et)

      // Then try raw / casing variants.
      const raw = String(elementType)
      if (Object.prototype.hasOwnProperty.call(map, raw)) return getV(raw)

      const low = raw.toLowerCase()
      if (Object.prototype.hasOwnProperty.call(map, low)) return getV(low)

      const etLow = et.toLowerCase()
      if (Object.prototype.hasOwnProperty.call(map, etLow)) return getV(etLow)

      // Final fallback: scan keys and normalize them so synonyms match.
      try {
          for (const k in map) {
              if (!Object.prototype.hasOwnProperty.call(map, k)) continue
              const nk = normalizeElementType(k)
              if (nk && nk === et) return getV(k)
          }
      } catch (_) {}

      return 0
  }

  function calcPhysicalDamage(baseStat, elementType, enemyOverride) {
    const state = getState()
      const enemy = enemyOverride || state.currentEnemy
      const diff = getActiveDifficultyConfig()
      const p = state.player
      const ctx = _getPlayerAbilityContext()

      // Apply temporary player debuffs/buffs without mutating core stats.
      const atkDown =
          p && p.status && p.status.atkDownTurns > 0 ? p.status.atkDown || 0 : 0
      const atkBuff = p && p.status ? p.status.buffAttack || 0 : 0

      let base = (baseStat || 0) + atkBuff - atkDown
      base = Math.max(1, base)

      // Armor penetration (percent) reduces effective armor before mitigation.
      const penPct = clampNumber(p && p.stats ? p.stats.armorPen || 0 : 0, 0, 80)
      let effArmor =
          (((enemy && enemy.armor) || 0) + ((enemy && enemy.armorBuff) || 0)) *
          (1 - penPct / 100)
      effArmor = Math.max(0, effArmor)

      const defense = 100 / (100 + effArmor * 10)

      let dmg = base * defense
      // NOTE: do not shadow the RNG helper `rand()`.
      const variance = 0.90 + rand('player.physVariance') * 0.2
      dmg *= variance
      const diffMod = (diff && Number.isFinite(diff.playerDmgMod) ? diff.playerDmgMod : 1)
      dmg *= diffMod

      // Context multipliers (upgrades, companion boon, etc.)
      // Guard against NaN/Infinity multipliers leaking from stale action context.
      const ctxDmgMult = (ctx && typeof ctx.dmgMult === 'number' && Number.isFinite(ctx.dmgMult))
          ? ctx.dmgMult
          : 1
      if (ctxDmgMult !== 1) {
          dmg *= ctxDmgMult
      }

      // Elemental bonus (if any) – default to weapon element if caller doesn't specify.
      const et = normalizeElementType(
          elementType || (p && p.stats ? p.stats.weaponElementType : null) || null
      )
      state.lastPlayerDamageElementType = et
      const elemBonusPct = clampNumber(getPlayerElementalBonusPct(et), 0, 200)
      if (elemBonusPct > 0) {
          dmg *= 1 + elemBonusPct / 100
      }
      // Critical hits
      // Player chilled: reduced outgoing damage (from enemy affix / frost effects).
      if (p && p.status && p.status.chilledTurns && p.status.chilledTurns > 0) {
          dmg *= 0.9
      }

      let crit = false
      // Enemy affinities (weakness/resistance)
      const affMult = getEnemyAffinityMultiplier(enemy, et)
      if (affMult !== 1) {
          dmg *= affMult
      }

      // Enemy flat elemental resists (% reduction) for the resolved element.
      // This complements affinities and makes difficulty/level resist scaling meaningful.
      const enemyResPct = clampNumber(getEnemyElementalResistPct(enemy, et), 0, 75)
      if (enemyResPct > 0) {
          dmg *= 1 - enemyResPct / 100
      }

      // Slightly lower baseline crit to keep early combat swinginess down.
      const baseCrit = 0.10
      const gearCrit =
          clampNumber(p && p.stats ? p.stats.critChance || 0 : 0, 0, 75) / 100

      // Rogue passive: opportunist
      const oppBonus =
          p &&
          p.classId === 'rogue' &&
          enemy &&
          enemy.bleedTurns &&
          enemy.bleedTurns > 0
              ? 0.08
              : 0

      const ctxCrit = (ctx && typeof ctx.critBonus === 'number' && Number.isFinite(ctx.critBonus))
          ? ctx.critBonus
          : 0
      const critChance = state.flags.alwaysCrit
          ? 1
          : state.flags.neverCrit
          ? 0
          : clampNumber(baseCrit + gearCrit + oppBonus + ctxCrit, 0, 0.75)

      // Preserve legacy RNG consumption: only roll when crit can happen.
      if (critChance >= 1) {
          dmg *= 1.5
          crit = true
      } else if (critChance > 0) {
          if (rand('player.physCrit') < critChance) {
              dmg *= 1.5
              crit = true
          }
      }

      // Enemy Broken: takes increased damage this round.
      if (enemy && enemy.brokenTurns && enemy.brokenTurns > 0) {
          dmg *= 1.2
      }

          // Warrior talent: Executioner (+15% damage vs low-health targets)
      if (p && p.classId === 'warrior' && playerHasTalent(p, 'warrior_executioner') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) {
                  dmg *= 1.15
              }
          }
      }



      // Paladin talent: Avenging Strike (+12% physical vs low-health targets)
      if (p && p.classId === 'paladin' && playerHasTalent(p, 'paladin_avenging_strike') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.12
          }
      }

      // Rogue talents
      if (p && p.classId === 'rogue' && playerHasTalent(p, 'rogue_exploit_wounds') && enemy && enemy.bleedTurns && enemy.bleedTurns > 0) {
          dmg *= 1.10
      }
      if (p && p.classId === 'rogue' && playerHasTalent(p, 'rogue_execution') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.15
          }
      }

      // Berserker talent: Executioner (+15% physical vs low-health targets)
      if (p && p.classId === 'berserker' && playerHasTalent(p, 'berserker_executioner') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.15
          }
      }

      // ===== CLASS PASSIVE ABILITIES (Patch 1.2.90) =====

      // Blood Knight: Crimson Pact - Deal 1% more damage per 10% missing HP
      if (p && p.classId === 'blood' && p.maxHp > 0) {
          const playerHpPct = p.hp / p.maxHp
          const missingHpPct = 1 - playerHpPct
          const crimsonBonus = missingHpPct * 10 // 1% per 10% missing
          if (crimsonBonus > 0) {
              dmg *= 1 + crimsonBonus / 100
          }
      }

      // Ranger: Hunter's Mark - Deal 10% bonus damage to bleeding targets
      if (p && p.classId === 'ranger' && enemy && enemy.bleedTurns && enemy.bleedTurns > 0) {
          dmg *= 1.10
      }

      // Rogue: Assassin's Edge - 15% increased critical strike damage
      if (p && p.classId === 'rogue' && crit) {
          dmg *= 1.15
      }

      // Berserker: Rage - Deal 2% more damage per 10% missing HP (max 20%)
      if (p && p.classId === 'berserker' && p.maxHp > 0) {
          const playerHpPct = p.hp / p.maxHp
          const missingHpPct = 1 - playerHpPct
          const rageBonus = Math.min(missingHpPct * 20, 20) // 2% per 10% missing, cap at 20%
          if (rageBonus > 0) {
              dmg *= 1 + rageBonus / 100
          }
      }

      // Patch 1.2.52: unified damage breakdown for combat log + debugging.
      const breakdown = {
          actor: 'player',
          kind: 'damage',
          damageType: 'physical',
          elementType: et,
          base,
          atkDown,
          atkBuff,
          armorPenPct: penPct,
          enemyArmor: ((enemy && enemy.armor) || 0),
          enemyArmorBuff: ((enemy && enemy.armorBuff) || 0),
          effectiveArmor: effArmor,
          defenseMult: defense,
          variance,
          difficultyMult: diffMod,
          contextMult: ctxDmgMult,
          elemBonusPct,
          chilled: !!(p && p.status && p.status.chilledTurns && p.status.chilledTurns > 0),
          affinityMult: affMult,
          enemyResistPct: enemyResPct,
          critChance,
          crit,
          critMult: crit ? 1.5 : 1,
          broken: !!(enemy && enemy.brokenTurns && enemy.brokenTurns > 0)
      }

      dmg = Math.max(1, _roundIntStable(dmg))
      breakdown.total = dmg
      state._lastDamageBreakdown = breakdown

      if (crit) {
          addLog('Critical hit!', 'good', { domain: 'combat', kind: 'proc', actor: 'player', proc: 'crit' })
      }
      state.lastPlayerHitWasCrit = crit
      return dmg
  }

  function calcMagicDamage(baseStat, elementType, enemyOverride) {
    const state = getState()
      const enemy = enemyOverride || state.currentEnemy
      const diff = getActiveDifficultyConfig()
      const p = state.player
      const ctx = _getPlayerAbilityContext()

      const magDown =
          p && p.status && p.status.magicDownTurns > 0
              ? p.status.magicDown || 0
              : 0
      const magBuff = p && p.status ? p.status.buffMagic || 0 : 0

      let base = (baseStat || 0) + magBuff - magDown
      base = Math.max(1, base)

      // Treat armorPen as general "penetration" for now (applies to magicRes too).
      const penPct = clampNumber(p && p.stats ? p.stats.armorPen || 0 : 0, 0, 80)
      let effRes =
          (((enemy && enemy.magicRes) || 0) +
              ((enemy && enemy.magicResBuff) || 0)) *
          (1 - penPct / 100)
      effRes = Math.max(0, effRes)

      const resist = 100 / (100 + effRes * 9)

      let dmg = base * resist
      const dmgVar = 0.90 + rand('player.magicVar') * 0.2
      dmg *= dmgVar
      const diffMod = (diff && Number.isFinite(diff.playerDmgMod) ? diff.playerDmgMod : 1)
      dmg *= diffMod

      // Context multipliers (upgrades, companion boon, etc.)
      // Guard against NaN/Infinity multipliers leaking from stale action context.
      const ctxDmgMult = (ctx && typeof ctx.dmgMult === 'number' && Number.isFinite(ctx.dmgMult))
          ? ctx.dmgMult
          : 1
      if (ctxDmgMult !== 1) {
          dmg *= ctxDmgMult
      }

      // Elemental bonus – caller should pass the spell element.
      const et = normalizeElementType(elementType || null)
      state.lastPlayerDamageElementType = et
      const elemBonusPct = clampNumber(getPlayerElementalBonusPct(et), 0, 200)
      if (elemBonusPct > 0) {
          dmg *= 1 + elemBonusPct / 100
      }

      // Talents: spell-only elemental amplifiers (kept out of physical damage).
      if (p && p.classId === 'mage' && et === 'fire' && playerHasTalent(p, 'mage_ember_focus')) {
          dmg *= 1.10
      }

      if (p && p.classId === 'mage' && et === 'frost' && playerHasTalent(p, 'mage_glacial_edge')) {
          dmg *= 1.10
      }
      if (p && p.classId === 'blood' && et === 'shadow' && playerHasTalent(p, 'blood_hemomancy')) {
          dmg *= 1.10
      }if (p && p.classId === 'ranger' && et === 'nature' && playerHasTalent(p, 'ranger_nature_attunement')) {
          dmg *= 1.10
      }

      if (p && p.classId === 'paladin' && et === 'holy' && playerHasTalent(p, 'paladin_radiant_focus')) dmg *= 1.10
      if (p && p.classId === 'cleric' && et === 'holy' && playerHasTalent(p, 'cleric_holy_focus')) dmg *= 1.10
      if (p && p.classId === 'necromancer' && et === 'shadow' && playerHasTalent(p, 'necromancer_shadow_mastery')) dmg *= 1.10
      if (p && p.classId === 'necromancer' && et === 'poison' && playerHasTalent(p, 'necromancer_plague_touch')) dmg *= 1.10
      if (p && p.classId === 'shaman' && et === 'lightning' && playerHasTalent(p, 'shaman_tempest_focus')) dmg *= 1.10
      if (p && p.classId === 'shaman' && et === 'nature' && playerHasTalent(p, 'shaman_nature_attunement')) dmg *= 1.10
      if (p && p.classId === 'vampire' && et === 'shadow' && playerHasTalent(p, 'vampire_shadow_focus')) dmg *= 1.10

      // Necromancer Death Mark: amplify the next shadow hit.
      if (
          enemy &&
          et === 'shadow' &&
          enemy.deathMarkTurns &&
          enemy.deathMarkTurns > 0
      ) {
          const mult = enemy.deathMarkMult || 1.3
          dmg *= mult
          enemy.deathMarkTurns = 0
          enemy.deathMarkMult = 0
          addLog('Death Mark detonates!', 'good', { domain: 'combat', kind: 'proc', actor: 'player', proc: 'deathMark' })
      }

      // Enemy affinities (weakness/resistance)
      const affMult = getEnemyAffinityMultiplier(enemy, et)
      if (affMult !== 1) {
          dmg *= affMult
      }

      // Enemy flat elemental resists (% reduction) for the resolved element.
      // This complements affinities and makes difficulty/level resist scaling meaningful.
      const enemyResPct = clampNumber(getEnemyElementalResistPct(enemy, et), 0, 75)
      if (enemyResPct > 0) {
          dmg *= 1 - enemyResPct / 100
      }

      let crit = false

      const baseCrit = 0.08
      const gearCrit =
          clampNumber(p && p.stats ? p.stats.critChance || 0 : 0, 0, 75) / 100
      const ctxCrit = (ctx && typeof ctx.critBonus === 'number' && Number.isFinite(ctx.critBonus))
          ? ctx.critBonus
          : 0
      const critChance = state.flags.alwaysCrit
          ? 1
          : state.flags.neverCrit
          ? 0
          : clampNumber(baseCrit + gearCrit + ctxCrit, 0, 0.75)

      // Preserve legacy RNG consumption: only roll when crit can happen.
      if (critChance >= 1) {
          dmg *= 1.6
          crit = true
      } else if (critChance > 0) {
          if (rand('player.magicCrit') < critChance) {
              dmg *= 1.6
              crit = true
          }
      }

      // Enemy Broken: takes increased damage this round.
      if (enemy && enemy.brokenTurns && enemy.brokenTurns > 0) {
          dmg *= 1.2
      }



      // Paladin talent: Avenging Strike (+12% physical vs low-health targets)
      if (p && p.classId === 'paladin' && playerHasTalent(p, 'paladin_avenging_strike') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.12
          }
      }

      // Rogue talents
      if (p && p.classId === 'rogue' && playerHasTalent(p, 'rogue_exploit_wounds') && enemy && enemy.bleedTurns && enemy.bleedTurns > 0) {
          dmg *= 1.10
      }
      if (p && p.classId === 'rogue' && playerHasTalent(p, 'rogue_execution') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.15
          }
      }

      // Berserker talent: Executioner (+15% physical vs low-health targets)
      if (p && p.classId === 'berserker' && playerHasTalent(p, 'berserker_executioner') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.15
          }
      }

      // ===== CLASS PASSIVE ABILITIES (Patch 1.2.90) =====

      // Mage: Arcane Mastery - Spell damage scales 15% better with Magic stat (applied to base)
      if (p && p.classId === 'mage') {
          dmg *= 1.15
      }

      // Blood Knight: Crimson Pact - Deal 1% more damage per 10% missing HP
      if (p && p.classId === 'blood' && p.maxHp > 0) {
          const playerHpPct = p.hp / p.maxHp
          const missingHpPct = 1 - playerHpPct
          const crimsonBonus = missingHpPct * 10 // 1% per 10% missing
          if (crimsonBonus > 0) {
              dmg *= 1 + crimsonBonus / 100
          }
      }

      // Shaman: Elemental Attunement - Deal 8% more damage with Nature and Lightning
      if (p && p.classId === 'shaman' && (et === 'nature' || et === 'lightning')) {
          dmg *= 1.08
      }

      // Rogue: Assassin's Edge - 15% increased critical strike damage
      if (p && p.classId === 'rogue' && crit) {
          dmg *= 1.15
      }

      // Berserker: Rage - Deal 2% more damage per 10% missing HP (max 20%)
      if (p && p.classId === 'berserker' && p.maxHp > 0) {
          const playerHpPct = p.hp / p.maxHp
          const missingHpPct = 1 - playerHpPct
          const rageBonus = Math.min(missingHpPct * 20, 20) // 2% per 10% missing, cap at 20%
          if (rageBonus > 0) {
              dmg *= 1 + rageBonus / 100
          }
      }

      // Patch 1.2.52: unified damage breakdown for combat log + debugging.
      const breakdown = {
          actor: 'player',
          kind: 'damage',
          damageType: 'magic',
          elementType: et,
          base,
          magDown,
          magBuff,
          penPct,
          enemyMagicRes: ((enemy && enemy.magicRes) || 0),
          enemyMagicResBuff: ((enemy && enemy.magicResBuff) || 0),
          effectiveRes: effRes,
          resistMult: resist,
          variance: dmgVar,
          difficultyMult: diffMod,
          contextMult: ctxDmgMult,
          elemBonusPct,
          affinityMult: affMult,
          enemyResistPct: enemyResPct,
          critChance,
          crit,
          critMult: crit ? 1.6 : 1,
          broken: !!(enemy && enemy.brokenTurns && enemy.brokenTurns > 0)
      }

      dmg = Math.max(1, _roundIntStable(dmg))
      breakdown.total = dmg
      state._lastDamageBreakdown = breakdown

      if (crit) {
          addLog('Arcane surge! Spell critically strikes.', 'good', { domain: 'combat', kind: 'proc', actor: 'player', proc: 'crit' })
      }
      state.lastPlayerHitWasCrit = crit
      return dmg
  }

  function calcEnemyDamage(baseStat, elementType) {
    const state = getState()
      const p = state.player
      const diff = getActiveDifficultyConfig()
      const enemy = state.currentEnemy

      // Apply temporary debuffs to player defenses
      const armorDown =
          p && p.status && p.status.armorDownTurns > 0 ? p.status.armorDown || 0 : 0
      const resDown =
          p && p.status && p.status.magicResDownTurns > 0
              ? p.status.magicResDown || 0
              : 0

      let effArmor = Math.max(0, (p.stats.armor || 0) - armorDown)
      let effRes = Math.max(0, (p.stats.magicRes || 0) - resDown)

      // Warrior passive: Bulwark Fury (+2 armor when Fury is high).
      if (p && p.classId === 'warrior' && p.resourceKey === 'fury' && p.resource >= 40) {
          effArmor += 2
      }

      let mitigation = 1

      // Element / damage-type mitigation
      // Legacy signature support:
      //   calcEnemyDamage(base, true/false | 'magic')  -> treat as magic/physical
      //   calcEnemyDamage(base, 'fire')                -> treated as *magic* (historical behavior)
      // New signature support:
      //   calcEnemyDamage(base, { damageType: 'magic'|'physical', elementType: 'fire'|null })
      const opts =
          elementType && typeof elementType === 'object' && !Array.isArray(elementType)
              ? elementType
              : null

      const damageTypeHint =
          opts && typeof opts.damageType === 'string'
              ? String(opts.damageType).toLowerCase()
              : opts && typeof opts.isMagic === 'boolean'
              ? opts.isMagic
                  ? 'magic'
                  : 'physical'
              : null

      const elemRaw =
          opts && typeof opts.elementType === 'string'
              ? opts.elementType
              : typeof elementType === 'string'
              ? elementType
              : null

      const elem = elemRaw ? normalizeElementType(elemRaw) : null

      const treatAsMagic = damageTypeHint
          ? damageTypeHint === 'magic'
          : elementType === true ||
            elementType === 'magic' ||
            (elem &&
                [
                    'fire',
                    'frost',
                    'ice',
                    'lightning',
                    'holy',
                    'shadow',
                    'arcane',
                    'earth',
                    'poison',
                    'nature'
                ].includes(elem))

      if (treatAsMagic) {
          const resist = 100 / (100 + effRes * 9)
          mitigation *= resist
      } else {
          const defense = 100 / (100 + effArmor * 10)
          mitigation *= defense
      }

      let dmg = (baseStat || 0) * mitigation
      // NOTE: do not shadow the RNG helper `rand()`.
      const variance = 0.90 + rand('enemy.variance') * 0.2
      dmg *= variance
      dmg *= diff.enemyDmgMod

      // Player elemental resist (only applies when an explicit element is provided).
      let playerElemResPct = 0
      if (elem) {
          playerElemResPct = clampNumber(getPlayerElementalResistPct(elem), 0, 75)
          if (playerElemResPct > 0) {
              dmg *= 1 - playerElemResPct / 100
          }
      }

      // Enemy chilled: reduced outgoing damage.
      if (enemy && enemy.chilledTurns && enemy.chilledTurns > 0) {
          dmg *= 0.9
      }

      // Player damage reduction status
      if (p && p.status && p.status.dmgReductionTurns > 0) {
          dmg *= 0.75
      }

      // Paladin passive: sanctuary while shielded.
      if (p && p.classId === 'paladin' && p.status && (p.status.shield || 0) > 0) {
          dmg *= 0.92
      }

      // Global Resist-All (percent) reduces any incoming damage.
      const resistAllPct = clampNumber(
          p && p.stats ? p.stats.resistAll || 0 : 0,
          0,
          80
      )
      if (resistAllPct > 0) {
          dmg *= 1 - resistAllPct / 100
      }

      // Vulnerable: takes increased damage while active.
      if (p && p.status && p.status.vulnerableTurns > 0) {
          dmg *= 1.15
      }



      // Paladin talent: Avenging Strike (+12% physical vs low-health targets)
      if (p && p.classId === 'paladin' && playerHasTalent(p, 'paladin_avenging_strike') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.12
          }
      }

      // Rogue talents
      if (p && p.classId === 'rogue' && playerHasTalent(p, 'rogue_exploit_wounds') && enemy && enemy.bleedTurns && enemy.bleedTurns > 0) {
          dmg *= 1.10
      }
      if (p && p.classId === 'rogue' && playerHasTalent(p, 'rogue_execution') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.15
          }
      }

      // Berserker talent: Executioner (+15% physical vs low-health targets)
      if (p && p.classId === 'berserker' && playerHasTalent(p, 'berserker_executioner') && enemy) {
          const mhp = Number(enemy.maxHp || enemy.hp || 0)
          if (mhp > 0) {
              const hpPct = Number(enemy.hp || 0) / mhp
              if (hpPct > 0 && hpPct <= 0.30) dmg *= 1.15
          }
      }

      // ===== CLASS PASSIVE ABILITIES (Patch 1.2.90) =====

      // Warrior: Battle Hardened - Gain 2% damage reduction per combat turn (max 10%)
      if (p && p.classId === 'warrior') {
          const combatTurn = state.combatTurn || 0
          const battleHardenedReduction = Math.min(combatTurn * 2, 10) // 2% per turn, max 10%
          if (battleHardenedReduction > 0) {
              dmg *= 1 - battleHardenedReduction / 100
          }
      }

      // Patch 1.2.52: unified damage breakdown for combat log + debugging.
      const breakdown = {
          actor: 'enemy',
          kind: 'damage',
          damageType: treatAsMagic ? 'magic' : 'physical',
          elementType: elem,
          base: (baseStat || 0),
          playerArmor: (p && p.stats ? p.stats.armor || 0 : 0),
          playerMagicRes: (p && p.stats ? p.stats.magicRes || 0 : 0),
          armorDown,
          resDown,
          effectiveArmor: effArmor,
          effectiveMagicRes: effRes,
          mitigationMult: mitigation,
          variance,
          difficultyMult: diff && Number.isFinite(diff.enemyDmgMod) ? diff.enemyDmgMod : 1,
          playerElementResistPct: playerElemResPct,
          chilled: !!(enemy && enemy.chilledTurns && enemy.chilledTurns > 0),
          damageReduction: !!(p && p.status && p.status.dmgReductionTurns > 0),
          resistAllPct,
          vulnerable: !!(p && p.status && p.status.vulnerableTurns > 0)
      }

      dmg = Math.max(1, _roundIntStable(dmg))
      breakdown.total = dmg
      state._lastDamageBreakdown = breakdown
      return dmg
  }

  return {
    getEnemyAffinityMultiplier,
    getEnemyElementalResistPct,
    calcPhysicalDamage,
    calcMagicDamage,
    calcEnemyDamage,
  }
}
