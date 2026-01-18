/**
 * characterSystem.js
 * 
 * Character stats calculation and elemental system.
 * Extracted from gameOrchestrator.js (Patch 1.2.72)
 */

import { escapeHtml } from '../ui/runtime/uiRuntime.js'
import { PLAYER_CLASSES } from '../data/playerClasses.js'
import { COMPANION_DEFS } from '../data/companions.js'
import { finiteNumber } from './safety.js'

// ============================================================================
// Helper Functions
// ============================================================================

function _capWord(s) {
    return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : ''
}

function _round1(x) {
    return Math.round((Number(x) || 0) * 10) / 10
}

function _numPct(x) {
    const n = typeof x === "number" ? x : parseFloat(x)
    return Number.isFinite(n) ? n : 0
}

function _elementIcon(k) {
    switch (k) {
        case 'fire':
            return '[fire]'
        case 'frost':
            return '?'
        case 'lightning':
            return '?'
        case 'holy':
            return '?'
        case 'shadow':
            return '??'
        case 'arcane':
            return '?'
        case 'poison':
            return '??'
        case 'earth':
            return '?'
        case 'nature':
            return '?'
        default:
            return '*'
    }
}

function _orderedElementKeys(keys) {
    const order = ['fire', 'frost', 'lightning', 'holy', 'shadow', 'arcane', 'poison', 'earth', 'nature']
    const uniq = {}
    ;(keys || []).forEach((k) => {
        const nk = normalizeElementType(k) || (k !== null && k !== undefined ? String(k).trim() : null)
        if (nk) uniq[nk] = 1
    })
    return Object.keys(uniq).sort((a, b) => {
        const ia = order.indexOf(a)
        const ib = order.indexOf(b)
        if (ia < 0 && ib < 0) return String(a).localeCompare(String(b))
        if (ia < 0) return 1
        if (ib < 0) return -1
        return ia - ib
    })
}

function _normalizeElemMap(obj) {
    const out = {}
    if (!obj || typeof obj !== 'object') return out
    Object.keys(obj).forEach((k) => {
        const nk = normalizeElementType(k) || String(k).trim()
        if (!nk) return
        const v = _numPct(obj[k])
        if (!v) return
        out[nk] = (out[nk] || 0) + v
    })
    return out
}

function clampNumber(v, min, max) {
    const n = finiteNumber(v, 0)
    return Math.max(min, Math.min(max, n))
}

function normalizeElementType(elementType) {
    if (elementType === null || elementType === undefined) return null
    const s = String(elementType).trim()
    if (!s) return null

    let k = s.toLowerCase()
    k = k.replace(/[^a-z]/g, '')
    if (!k) return null

    if (k === 'piercing' || k === 'slashing' || k === 'blunt' || k === 'physical') return null

    const dup = k.match(/^(fire|frost|lightning|holy|shadow|arcane|poison|earth|nature)\1$/)
    if (dup) k = dup[1]

    const lead = k.match(/^(fire|frost|lightning|holy|shadow|arcane|poison|earth|nature)/)
    if (lead) return lead[1]

    return k
}

// ============================================================================
// Constants
// ============================================================================

const PLAYER_RESIST_CAP = 75
const CLASS_STARTING_SKILLS = {
    mage: { strength: 0, endurance: 1, willpower: 3 },
    warrior: { strength: 3, endurance: 3, willpower: 0 },
    blood: { strength: 2, endurance: 2, willpower: 1 },
    ranger: { strength: 2, endurance: 1, willpower: 1 },
    paladin: { strength: 2, endurance: 2, willpower: 1 },
    rogue: { strength: 2, endurance: 1, willpower: 1 },
    cleric: { strength: 0, endurance: 2, willpower: 2 },
    necromancer: { strength: 0, endurance: 1, willpower: 3 },
    shaman: { strength: 1, endurance: 2, willpower: 2 },
    berserker: { strength: 3, endurance: 2, willpower: 0 },
    vampire: { strength: 1, endurance: 1, willpower: 2 },
    default: { strength: 1, endurance: 1, willpower: 1 }
}

const GEAR_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

// ============================================================================
// Elemental System Functions
// ============================================================================

export function _getTalentSpellElementBonusMap(p, playerHasTalent) {
    const out = {}
    if (!p) return out
    try {
        if (playerHasTalent(p, 'mage_ember_focus')) out.fire = (out.fire || 0) + 10
        if (playerHasTalent(p, 'mage_glacial_edge')) out.frost = (out.frost || 0) + 10
        if (playerHasTalent(p, 'blood_hemomancy')) out.shadow = (out.shadow || 0) + 10
        if (playerHasTalent(p, 'ranger_nature_attunement')) out.nature = (out.nature || 0) + 10
        if (playerHasTalent(p, 'paladin_radiant_focus')) out.holy = (out.holy || 0) + 10
        if (playerHasTalent(p, 'cleric_holy_focus')) out.holy = (out.holy || 0) + 10
        if (playerHasTalent(p, 'necromancer_shadow_mastery')) out.shadow = (out.shadow || 0) + 10
        if (playerHasTalent(p, 'necromancer_plague_touch')) out.poison = (out.poison || 0) + 10
        if (playerHasTalent(p, 'shaman_tempest_focus')) out.lightning = (out.lightning || 0) + 10
        if (playerHasTalent(p, 'shaman_nature_attunement')) out.nature = (out.nature || 0) + 10
        if (playerHasTalent(p, 'vampire_shadow_focus')) out.shadow = (out.shadow || 0) + 10
    } catch (_) {}
    return out
}

export function _getElementalBreakdownsForPlayer(p, playerHasTalent) {
    const gearBonus =
        (p && p.stats && p.stats.elementalBonusBreakdown && p.stats.elementalBonusBreakdown.gear) ||
        (p && p.stats && p.stats.elementalBonuses) ||
        {}

    let talentBonus =
        (p && p.stats && p.stats.elementalBonusBreakdown && p.stats.elementalBonusBreakdown.talent) ||
        {}

    if (!talentBonus || typeof talentBonus !== 'object') talentBonus = {}
    if (!Object.keys(talentBonus).length) {
        talentBonus = _getTalentSpellElementBonusMap(p, playerHasTalent)
    }

    const gearResist =
        (p && p.stats && p.stats.elementalResistBreakdown && p.stats.elementalResistBreakdown.gear) ||
        {}
    const talentResist =
        (p && p.stats && p.stats.elementalResistBreakdown && p.stats.elementalResistBreakdown.talent) ||
        {}
    const totalResist = (p && p.stats && p.stats.elementalResists) || {}

    return {
        gearBonus: _normalizeElemMap(gearBonus),
        talentBonus: _normalizeElemMap(talentBonus),
        gearResist: _normalizeElemMap(gearResist),
        talentResist: _normalizeElemMap(talentResist),
        totalResist: _normalizeElemMap(totalResist)
    }
}

export function computeElementSummariesForPlayer(p, playerHasTalent) {
    const bd = _getElementalBreakdownsForPlayer(p, playerHasTalent)

    const bonusKeys = _orderedElementKeys(
        Object.keys(bd.gearBonus || {}).concat(Object.keys(bd.talentBonus || {}))
    )
    const bonusParts = []
    bonusKeys.forEach((k) => {
        const g = _round1(_numPct((bd.gearBonus || {})[k]))
        const t = _round1(_numPct((bd.talentBonus || {})[k]))
        if (!g && !t) return
        const total = _round1(((1 + g / 100) * (1 + t / 100) - 1) * 100)
        if (!total) return
        bonusParts.push(_capWord(k) + ' +' + total + '%')
    })
    const elementalBonusSummary = bonusParts.length ? bonusParts.join(', ') : 'None'

    const resistKeys = _orderedElementKeys(Object.keys(bd.totalResist || {}))
    const resistParts = []
    const cap = Number(PLAYER_RESIST_CAP) || 75

    resistKeys.forEach((k) => {
        const raw = _round1(_numPct((bd.totalResist || {})[k]))
        const eff = _round1(clampNumber(raw, 0, cap))
        if (!eff) return

        if (raw > eff + 0.5) {
            resistParts.push(_capWord(k) + ' ' + eff + '% (raw ' + raw + '%)')
        } else {
            resistParts.push(_capWord(k) + ' ' + eff + '%')
        }
    })
    const elementalResistSummary = resistParts.length ? resistParts.join(', ') : 'None'

    const weaponElement =
        p && p.stats && p.stats.weaponElementType ? _capWord(p.stats.weaponElementType) : 'None'

    return { weaponElement, elementalBonusSummary, elementalResistSummary }
}

function _gearRarityRank(r) {
    const order = Array.isArray(GEAR_RARITY_ORDER)
        ? GEAR_RARITY_ORDER
        : ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    const idx = order.indexOf(String(r || 'common'))
    return idx >= 0 ? idx : 0
}

function _getPlayerGearRarityScore(p) {
    try {
        const eq = (p && p.equipment) || null
        if (!eq) return 0
        let sum = 0
        let n = 0
        Object.keys(eq).forEach((k) => {
            const it = eq[k]
            if (it && it.rarity) {
                sum += _gearRarityRank(it.rarity)
                n += 1
            }
        })
        if (!n) return 0
        const order = Array.isArray(GEAR_RARITY_ORDER)
            ? GEAR_RARITY_ORDER
            : ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
        const max = Math.max(1, order.length - 1)
        return clampNumber(sum / n / max, 0, 1)
    } catch (e) {
        return 0
    }
}

export function renderElementalBreakdownHtml(p, playerHasTalent) {
    const bd = _getElementalBreakdownsForPlayer(p, playerHasTalent)
    const rarityScore = _getPlayerGearRarityScore(p)

    const keys = _orderedElementKeys(
        Object.keys(bd.gearBonus || {})
            .concat(Object.keys(bd.talentBonus || {}))
            .concat(Object.keys(bd.gearResist || {}))
            .concat(Object.keys(bd.talentResist || {}))
            .concat(Object.keys(bd.totalResist || {}))
    )

    if (!keys.length) {
        return '<div class="muted">None</div>'
    }

    let html = '<div class="stat-grid elem-breakdown-grid">'

    keys.forEach((k) => {
        const name = _capWord(k)
        const icon = _elementIcon(k)

        const gB = _round1(_numPct((bd.gearBonus || {})[k]))
        const tB = _round1(_numPct((bd.talentBonus || {})[k]))
        const gR = _round1(_numPct((bd.gearResist || {})[k]))
        const tR = _round1(_numPct((bd.talentResist || {})[k]))

        if ((gB > 0) || (tB > 0)) {
            const totalB = _round1(((1 + gB / 100) * (1 + tB / 100) - 1) * 100)
            html +=
                '<div class="stat-label"><span class="char-stat-icon">' +
                escapeHtml(icon) +
                '</span>' +
                escapeHtml(name) +
                ' Bonus</div>' +
                '<div class="stat-value">+' +
                escapeHtml(String(totalB)) +
                '% <span class="muted">(Gear +' +
                escapeHtml(String(gB)) +
                '%, Talent +' +
                escapeHtml(String(tB)) +
                '%)</span></div>'
        }

        const rawTotalRes = _numPct((bd.totalResist || {})[k]) || (gR + tR)
        const cap = Number(PLAYER_RESIST_CAP) || 75
        const effR = _round1(clampNumber(rawTotalRes, 0, cap))
        const rawR = _round1(rawTotalRes)
        if ((gR > 0) || (tR > 0) || (rawR > 0)) {
            html +=
                '<div class="stat-label"><span class="char-stat-icon">?</span>' +
                escapeHtml(name) +
                ' Resist</div>' +
                '<div class="stat-value">' +
                escapeHtml(String(effR)) +
                '% <span class="muted">(raw ' +
                escapeHtml(String(rawR)) +
                '%, Gear ' +
                escapeHtml(String(gR)) +
                '%, Talent ' +
                escapeHtml(String(tR)) +
                '%)</span></div>'
        }
    })

    html += '</div><div class="muted" style="margin-top:6px;">Resists are capped at 75%. Higher rarity gear reaches the cap more easily via stronger rolls.</div>'
    return html
}

export function refreshCharacterSheetLiveValues(p, root, playerHasTalent) {
    if (!p || !root) return

    try {
        const sums = computeElementSummariesForPlayer(p, playerHasTalent)
        const we = root.querySelector('.sheet-weapon-element')
        const eb = root.querySelector('.sheet-element-bonuses')
        const er = root.querySelector('.sheet-element-resists')
        const we2 = root.querySelector('.sheet-stat-weapon-element')
        const eb2 = root.querySelector('.sheet-stat-element-bonus')
        const er2 = root.querySelector('.sheet-stat-element-resists')
        if (we) we.textContent = sums.weaponElement
        if (eb) eb.textContent = sums.elementalBonusSummary
        if (er) er.textContent = sums.elementalResistSummary
        if (we2) we2.textContent = sums.weaponElement
        if (eb2) eb2.textContent = sums.elementalBonusSummary
        if (er2) er2.textContent = sums.elementalResistSummary
    } catch (_) {}

    try {
        const html = renderElementalBreakdownHtml(p, playerHasTalent)
        root.querySelectorAll('.sheet-element-breakdown').forEach((el) => {
            el.innerHTML = html
        })
    } catch (_) {}

    try {
        const round1 = (x) => Math.round((Number(x) || 0) * 10) / 10
        const hpLine =
            Math.round(finiteNumber(p.hp, 0)) + ' / ' + Math.round(finiteNumber(p.maxHp, 0))
        const resLine =
            Math.round(finiteNumber(p.resource, 0)) +
            ' / ' +
            Math.round(finiteNumber(p.maxResource, 0))

        root.querySelectorAll('.sheet-badge-hp').forEach((el) => (el.textContent = hpLine))
        root.querySelectorAll('.sheet-badge-resource').forEach((el) => (el.textContent = resLine))
        root
            .querySelectorAll('.sheet-badge-gold')
            .forEach((el) => (el.textContent = String(Math.round(finiteNumber(p.gold, 0)))))

        root.querySelectorAll('.sheet-core-hp').forEach((el) => (el.textContent = hpLine))
        root.querySelectorAll('.sheet-core-resource').forEach((el) => (el.textContent = resLine))
        root
            .querySelectorAll('.sheet-core-gold')
            .forEach((el) => (el.textContent = String(Math.round(finiteNumber(p.gold, 0)))))

        root
            .querySelectorAll('.stat-attack')
            .forEach((el) => (el.textContent = String(finiteNumber(p.stats && p.stats.attack, 0))))
        root
            .querySelectorAll('.stat-magic')
            .forEach((el) => (el.textContent = String(finiteNumber(p.stats && p.stats.magic, 0))))
        root
            .querySelectorAll('.stat-armor')
            .forEach((el) => (el.textContent = String(finiteNumber(p.stats && p.stats.armor, 0))))
        root
            .querySelectorAll('.stat-speed')
            .forEach((el) => (el.textContent = String(finiteNumber(p.stats && p.stats.speed, 0))))

        root
            .querySelectorAll('.sheet-stat-crit')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.critChance) + '%'))
        root
            .querySelectorAll('.sheet-stat-dodge')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.dodgeChance) + '%'))
        root
            .querySelectorAll('.sheet-stat-resistall')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.resistAll) + '%'))
        root
            .querySelectorAll('.sheet-stat-lifesteal')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.lifeSteal) + '%'))
        root
            .querySelectorAll('.sheet-stat-armorpen')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.armorPen) + '%'))
        root
            .querySelectorAll('.sheet-stat-haste')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.haste) + '%'))
        root
            .querySelectorAll('.sheet-stat-thorns')
            .forEach((el) => (el.textContent = String(round1(p.stats && p.stats.thorns))))
        root
            .querySelectorAll('.sheet-stat-hpregen')
            .forEach((el) => (el.textContent = String(round1(p.stats && p.stats.hpRegen))))
    } catch (_) {}
}

export function refreshCharacterSheetIfOpen(state, playerHasTalent) {
    if (typeof document === 'undefined') return
    try {
        const titleEl = document.getElementById('modalTitle')
        const bodyEl = document.getElementById('modalBody')
        if (!titleEl || !bodyEl) return
        if ((titleEl.textContent || '').trim() !== 'Character Sheet') return
        const p = state && state.player ? state.player : null
        if (!p) return
        refreshCharacterSheetLiveValues(p, bodyEl, playerHasTalent)
    } catch (_) {}
}

export function renderTalentsPanelHtml(p, ensurePlayerTalents, getTalentsForClass, playerHasTalent, canUnlockTalent) {
    ensurePlayerTalents(p)
    const list = getTalentsForClass(p.classId)
    const pts = p.talentPoints || 0
    if (!list.length) {
        return `<div class="char-section"><div class="char-section-title">Talents</div><div class="muted">No talents available for this class yet.</div></div>`
    }
    const rows = list
        .map((t) => {
            const owned = playerHasTalent(p, t.id)
            const lockedByLevel = (p.level || 1) < (t.levelReq || 1)
            const can = canUnlockTalent(p, t)
            const status = owned ? 'Unlocked' : lockedByLevel ? ('Requires Lv ' + t.levelReq) : 'Locked'
            const btn = can
                ? `<button class="btn small talent-unlock" data-talent="${t.id}">Unlock</button>`
                : owned
                ? `<button class="btn small outline" disabled>Owned</button>`
                : `<button class="btn small outline" disabled>-</button>`
            return `
            <div class="talent-row">
              <div class="talent-main">
                <div class="talent-name">${t.name} <span class="muted">(${status})</span></div>
                <div class="talent-desc muted">${t.desc}</div>
              </div>
              <div class="talent-act">${btn}</div>
            </div>`
        })
        .join('')
    return `
      <div class="char-section">
        <div class="char-section-title">Talents</div>
        <div class="muted" style="margin-bottom:8px;">Talent Points: <b>${pts}</b> * Gain 1 point every 3 levels.</div>
        <div class="talent-list">${rows}</div>
      </div>`
}

// ============================================================================
// Character Stats Calculation
// ============================================================================

export function recalcPlayerStats(state, playerHasTalent, getCompanionRuntime) {
    const p = state.player
    const cls = PLAYER_CLASSES[p.classId]
    const base = cls.baseStats

    if (!p.skills) {
        const fallback =
            CLASS_STARTING_SKILLS[p.classId] || CLASS_STARTING_SKILLS.default
        p.skills = {
            strength: fallback.strength,
            endurance: fallback.endurance,
            willpower: fallback.willpower
        }
    }

    if (!p.stats) {
        p.stats = { attack: 0, magic: 0, armor: 0, speed: 0, magicRes: 0 }
    }

    if (!p.equipment) p.equipment = {}
    if (p.equipment.weapon === undefined) p.equipment.weapon = null
    if (p.equipment.armor === undefined) p.equipment.armor = null
    if (p.equipment.head === undefined) p.equipment.head = null
    if (p.equipment.hands === undefined) p.equipment.hands = null
    if (p.equipment.feet === undefined) p.equipment.feet = null
    if (p.equipment.belt === undefined) p.equipment.belt = null
    if (p.equipment.neck === undefined) p.equipment.neck = null
    if (p.equipment.ring === undefined) p.equipment.ring = null

    const s = p.skills

    p.maxHp = base.maxHp
    p.stats.attack = base.attack
    p.stats.magic = base.magic
    p.stats.armor = base.armor
    p.stats.speed = base.speed

    p.stats.magicRes =
        typeof base.magicRes === 'number'
            ? base.magicRes
            : Math.max(0, Math.round(base.magic * 0.35 + base.armor * 0.45 + 1))

    p.stats.critChance = 0
    p.stats.dodgeChance = 0
    p.stats.resistAll = 0
    p.stats.lifeSteal = 0
    p.stats.armorPen = 0
    p.stats.haste = 0
    p.stats.thorns = 0
    p.stats.hpRegen = 0
    p.stats.elementalBonuses = {}
    p.stats.elementalResists = {}

    const _elemBonusGear = {}
    const _elemBonusTalent = {}
    const _elemResistGear = {}
    const _elemResistTalent = {}
    p.stats.elementalBonusBreakdown = { gear: _elemBonusGear, talent: _elemBonusTalent }
    p.stats.elementalResistBreakdown = { gear: _elemResistGear, talent: _elemResistTalent }

    p.stats.weaponElementType = null

    p.stats.attack += s.strength * 2
    p.maxHp += s.endurance * 6
    p.stats.armor += Math.floor(s.endurance / 2)
    p.stats.magic += s.willpower * 2
    p.stats.magicRes += Math.floor((s.willpower || 0) / 2)
    p.stats.magicRes += Math.floor((s.endurance || 0) / 4)

    let extraMaxRes = 0
    extraMaxRes += s.willpower * 4

    const addGearElementBonus = (elem, pct) => {
        const k = normalizeElementType(elem)
        const v = _numPct(pct)
        if (!k || !v) return
        p.stats.elementalBonuses[k] = (p.stats.elementalBonuses[k] || 0) + v
        _elemBonusGear[k] = (_elemBonusGear[k] || 0) + v
    }

    const addGearElementResist = (elem, pct) => {
        const k = normalizeElementType(elem)
        const v = _numPct(pct)
        if (!k || !v) return
        p.stats.elementalResists[k] = (p.stats.elementalResists[k] || 0) + v
        _elemResistGear[k] = (_elemResistGear[k] || 0) + v
    }

    const addTalentElementResist = (elem, pct) => {
        const k = normalizeElementType(elem)
        const v = _numPct(pct)
        if (!k || !v) return
        p.stats.elementalResists[k] = (p.stats.elementalResists[k] || 0) + v
        _elemResistTalent[k] = (_elemResistTalent[k] || 0) + v
    }

    const addTalentElementBonus = (elem, pct) => {
        const k = normalizeElementType(elem)
        const v = _numPct(pct)
        if (!k || !v) return
        _elemBonusTalent[k] = (_elemBonusTalent[k] || 0) + v
    }

    const applyItemBonuses = (it, slot) => {
        if (!it) return

        if (it.attackBonus) p.stats.attack += it.attackBonus
        if (it.magicBonus) p.stats.magic += it.magicBonus
        if (it.armorBonus) p.stats.armor += it.armorBonus
        if (it.speedBonus) p.stats.speed += it.speedBonus

        if (it.magicResBonus) p.stats.magicRes += it.magicResBonus
        if (it.magicRes) p.stats.magicRes += it.magicRes

        if (it.maxHPBonus) p.maxHp += it.maxHPBonus
        if (it.maxHpBonus) p.maxHp += it.maxHpBonus
        if (it.maxResourceBonus) extraMaxRes += it.maxResourceBonus

        if (it.critChance) p.stats.critChance += it.critChance
        if (it.dodgeChance) p.stats.dodgeChance += it.dodgeChance
        if (it.resistAll) p.stats.resistAll += it.resistAll
        if (it.lifeSteal) p.stats.lifeSteal += it.lifeSteal
        if (it.armorPen) p.stats.armorPen += it.armorPen
        if (it.haste) p.stats.haste += it.haste

        if (it.thorns) p.stats.thorns += it.thorns
        if (it.hpRegen) p.stats.hpRegen += it.hpRegen

        if (it.elementalType && it.elementalBonus) {
            addGearElementBonus(it.elementalType, it.elementalBonus)
            if (slot === 'weapon' && !p.stats.weaponElementType) {
                p.stats.weaponElementType = normalizeElementType(it.elementalType)
            }
        }

        if (it.elementalBonuses && typeof it.elementalBonuses === 'object') {
            Object.keys(it.elementalBonuses).forEach((k) =>
                addGearElementBonus(k, it.elementalBonuses[k])
            )
        }

        if (it.elementalResists && typeof it.elementalResists === 'object') {
            Object.keys(it.elementalResists).forEach((k) =>
                addGearElementResist(k, it.elementalResists[k])
            )
        }

        if (it.elementalResistType && it.elementalResist) {
            addGearElementResist(it.elementalResistType, it.elementalResist)
        }
    }

    applyItemBonuses(p.equipment.weapon, 'weapon')
    applyItemBonuses(p.equipment.armor, 'armor')
    applyItemBonuses(p.equipment.head, 'head')
    applyItemBonuses(p.equipment.hands, 'hands')
    applyItemBonuses(p.equipment.feet, 'feet')
    applyItemBonuses(p.equipment.belt, 'belt')
    applyItemBonuses(p.equipment.neck, 'neck')
    applyItemBonuses(p.equipment.ring, 'ring')

    if (playerHasTalent(p, 'mage_frostward')) addTalentElementResist('frost', 15)
    if (playerHasTalent(p, 'mage_arcane_ward')) addTalentElementResist('arcane', 15)
    if (playerHasTalent(p, 'warrior_frostward')) addTalentElementResist('frost', 15)
    if (playerHasTalent(p, 'blood_shadowward')) addTalentElementResist('shadow', 15)
    if (playerHasTalent(p, 'paladin_holyward')) addTalentElementResist('holy', 15)
    if (playerHasTalent(p, 'rogue_shadowward')) addTalentElementResist('shadow', 15)
    if (playerHasTalent(p, 'cleric_lightward')) addTalentElementResist('holy', 15)
    if (playerHasTalent(p, 'necromancer_graveward')) addTalentElementResist('shadow', 15)
    if (playerHasTalent(p, 'shaman_stormward')) addTalentElementResist('lightning', 15)
    if (playerHasTalent(p, 'berserker_fireward')) addTalentElementResist('fire', 15)
    if (playerHasTalent(p, 'vampire_shadowward')) addTalentElementResist('shadow', 15)
    if (playerHasTalent(p, 'vampire_mistward')) addTalentElementResist('frost', 15)

    if (playerHasTalent(p, 'mage_ember_focus')) addTalentElementBonus('fire', 10)
    if (playerHasTalent(p, 'mage_glacial_edge')) addTalentElementBonus('frost', 10)
    if (playerHasTalent(p, 'blood_hemomancy')) addTalentElementBonus('shadow', 10)
    if (playerHasTalent(p, 'ranger_nature_attunement')) addTalentElementBonus('nature', 10)
    if (playerHasTalent(p, 'paladin_radiant_focus')) addTalentElementBonus('holy', 10)
    if (playerHasTalent(p, 'cleric_holy_focus')) addTalentElementBonus('holy', 10)
    if (playerHasTalent(p, 'necromancer_shadow_mastery')) addTalentElementBonus('shadow', 10)
    if (playerHasTalent(p, 'necromancer_plague_touch')) addTalentElementBonus('poison', 10)
    if (playerHasTalent(p, 'shaman_tempest_focus')) addTalentElementBonus('lightning', 10)
    if (playerHasTalent(p, 'shaman_nature_attunement')) addTalentElementBonus('nature', 10)
    if (playerHasTalent(p, 'vampire_shadow_focus')) addTalentElementBonus('shadow', 10)

    if (playerHasTalent(p, 'mage_mystic_reservoir') && p.resourceKey === 'mana') extraMaxRes += 20

    if (playerHasTalent(p, 'warrior_sunder')) p.stats.armorPen += 10
    if (playerHasTalent(p, 'warrior_ironhide')) {
        p.stats.armor += 6
        p.stats.resistAll += 5
    }
    if (playerHasTalent(p, 'warrior_battle_trance')) p.stats.haste += 10

    if (playerHasTalent(p, 'blood_blood_armor')) {
        p.maxHp += 12
        p.stats.armor += 2
    }

    if (playerHasTalent(p, 'ranger_camouflage')) p.stats.dodgeChance += 8
    if (playerHasTalent(p, 'ranger_called_shot')) p.stats.critChance += 10

    if (playerHasTalent(p, 'paladin_aura_of_faith')) p.stats.resistAll += 5
    if (playerHasTalent(p, 'paladin_sanctified_plate')) p.stats.armor += 8
    if (playerHasTalent(p, 'paladin_zeal')) p.stats.critChance += 8
    if (playerHasTalent(p, 'paladin_divine_haste')) p.stats.haste += 10
    if (playerHasTalent(p, 'paladin_mana_font') && p.resourceKey === 'mana') extraMaxRes += 20

    if (playerHasTalent(p, 'rogue_deadly_precision')) p.stats.critChance += 10
    if (playerHasTalent(p, 'rogue_smokefoot')) p.stats.dodgeChance += 8
    if (playerHasTalent(p, 'rogue_armor_sunder')) p.stats.armorPen += 10
    if (playerHasTalent(p, 'rogue_adrenaline')) p.stats.haste += 10

    if (playerHasTalent(p, 'cleric_mana_font') && p.resourceKey === 'mana') extraMaxRes += 20
    if (playerHasTalent(p, 'cleric_bastion')) { p.stats.armor += 6; p.stats.resistAll += 5 }
    if (playerHasTalent(p, 'cleric_grace')) p.stats.dodgeChance += 8
    if (playerHasTalent(p, 'cleric_divine_haste')) p.stats.haste += 10

    if (playerHasTalent(p, 'necromancer_soul_battery') && p.resourceKey === 'mana') extraMaxRes += 20
    if (playerHasTalent(p, 'necromancer_bone_plating')) { p.stats.armor += 4; p.stats.resistAll += 8 }
    if (playerHasTalent(p, 'necromancer_dark_haste')) p.stats.haste += 10

    if (playerHasTalent(p, 'shaman_mana_font') && p.resourceKey === 'mana') extraMaxRes += 20
    if (playerHasTalent(p, 'shaman_spirit_guard')) { p.stats.armor += 6; p.stats.resistAll += 5 }
    if (playerHasTalent(p, 'shaman_swift_steps')) p.stats.dodgeChance += 8

    if (playerHasTalent(p, 'berserker_bloodthirst')) p.stats.lifeSteal += 8
    if (playerHasTalent(p, 'berserker_hardened')) p.stats.armor += 6
    if (playerHasTalent(p, 'berserker_ferocity')) p.stats.critChance += 10
    if (playerHasTalent(p, 'berserker_battle_trance')) p.stats.haste += 10

    if (playerHasTalent(p, 'vampire_essence_reservoir') && p.resourceKey === 'essence') extraMaxRes += 20
    if (playerHasTalent(p, 'vampire_dark_agility')) p.stats.dodgeChance += 8
    if (playerHasTalent(p, 'vampire_bloodletting')) p.stats.lifeSteal += 10
    if (playerHasTalent(p, 'vampire_crimson_crit')) p.stats.critChance += 10

    const _spd = Number.isFinite(Number(p.stats.speed)) ? Number(p.stats.speed) : 0
    const _dodgeFromSpeed = Math.max(0, Math.min(12, _spd * 0.6))
    p.stats.dodgeChance = (p.stats.dodgeChance || 0) + _dodgeFromSpeed

    p.stats.critChance = Math.max(0, Math.min(75, p.stats.critChance || 0))
    p.stats.dodgeChance = Math.max(0, Math.min(60, p.stats.dodgeChance || 0))
    p.stats.resistAll = Math.max(0, Math.min(80, p.stats.resistAll || 0))
    p.stats.lifeSteal = Math.max(0, Math.min(60, p.stats.lifeSteal || 0))
    p.stats.armorPen = Math.max(0, Math.min(80, p.stats.armorPen || 0))
    p.stats.haste = Math.max(0, Math.min(80, p.stats.haste || 0))

    let baseMaxRes = 60
    if (cls.resourceKey === 'mana') {
        baseMaxRes = 100
    } else if (cls.resourceKey === 'essence') {
        baseMaxRes = 90
    }

    p.maxResource = baseMaxRes + extraMaxRes

    if (state.companion) {
        const comp = state.companion
        const def = COMPANION_DEFS[comp.id]
        if (def) {
            const scaled = getCompanionRuntime().computeCompanionScaledStats(def, p.level)
            comp.attack = scaled.atk
            comp.hpBonus = scaled.hpBonus
            comp.appliedHpBonus = scaled.hpBonus
            p.maxHp += scaled.hpBonus
        }
    }

    const choice = (state.flags && state.flags.blackbarkChoice) || null
    if (choice === 'swear') {
        p.stats.armor += 5
        p.stats.resistAll += 8
    } else if (choice === 'break') {
        p.stats.attack += 4
        p.stats.critChance += 4
    } else if (choice === 'rewrite') {
        p.stats.attack += 2
        p.stats.magic += 2
        p.stats.armor += 2
        p.stats.resistAll += 4
    }

    const ritualAlly = (state.flags && state.flags.chapter3RitualAlly) || null
    if (ritualAlly === 'rowan') {
        p.stats.armor += 2
        p.stats.resistAll += 4
    } else if (ritualAlly === 'scribe') {
        p.stats.magic += 4
        p.maxResource = (p.maxResource || 0) + 15
    } else if (ritualAlly === 'ashWarden') {
        p.stats.attack += 4
        p.stats.critChance += 4
        p.stats.armorPen += 5
    }

    p.stats.critChance = Math.max(0, Math.min(75, p.stats.critChance || 0))
    p.stats.dodgeChance = Math.max(0, Math.min(60, p.stats.dodgeChance || 0))
    p.stats.resistAll = Math.max(0, Math.min(80, p.stats.resistAll || 0))
    p.stats.lifeSteal = Math.max(0, Math.min(60, p.stats.lifeSteal || 0))
    p.stats.armorPen = Math.max(0, Math.min(80, p.stats.armorPen || 0))
    p.stats.haste = Math.max(0, Math.min(80, p.stats.haste || 0))

    p.stats.dodge = Number.isFinite(Number(p.stats.dodgeChance)) ? Number(p.stats.dodgeChance) : 0

    if (p.hp > p.maxHp) p.hp = p.maxHp
    if (p.resource > p.maxResource) p.resource = p.maxResource
}
