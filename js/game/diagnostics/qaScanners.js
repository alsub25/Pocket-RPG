/**
 * QA Scanners Module
 * Automated diagnostics and integrity checks for game state
 */

export function qaScanNonFiniteNumbers(rootObj, opts = {}) {
    const maxIssues = Number.isFinite(Number(opts.maxIssues)) ? Math.max(1, Number(opts.maxIssues)) : 400
    const issues = []
    const seen = new WeakSet()

    const walk = (obj, path, depth) => {
        if (issues.length >= maxIssues) return
        if (obj === null || obj === undefined) return

        const t = typeof obj
        if (t === 'number') {
            if (!Number.isFinite(obj)) issues.push(path + ' = ' + String(obj))
            return
        }
        if (t !== 'object') return

        if (seen.has(obj)) return
        seen.add(obj)

        // keep this bounded
        if (depth > 24) return

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                walk(obj[i], path + '[' + i + ']', depth + 1)
                if (issues.length >= maxIssues) return
            }
            return
        }

        const keys = Object.keys(obj)
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i]
            walk(obj[k], path ? (path + '.' + k) : k, depth + 1)
            if (issues.length >= maxIssues) return
        }
    }

    try { walk(rootObj, '', 0) } catch (_) {}
    return issues
}

export function qaScanNegativeCounters(s) {
    const issues = []
    try {
        const p = s && s.player
        if (p && typeof p.gold === 'number' && p.gold < 0) issues.push('player.gold < 0 (' + p.gold + ')')
        if (p && typeof p.hp === 'number' && p.hp < 0) issues.push('player.hp < 0 (' + p.hp + ')')
        if (p && typeof p.maxHp === 'number' && p.maxHp < 0) issues.push('player.maxHp < 0 (' + p.maxHp + ')')
        if (p && typeof p.resource === 'number' && p.resource < 0) issues.push('player.resource < 0 (' + p.resource + ')')
        if (p && typeof p.maxResource === 'number' && p.maxResource < 0) issues.push('player.maxResource < 0 (' + p.maxResource + ')')

        if (p && Array.isArray(p.inventory)) {
            p.inventory.forEach((it, i) => {
                if (!it) return
                if (typeof it.quantity === 'number' && it.quantity < 0) issues.push('player.inventory[' + i + '].quantity < 0 (' + it.quantity + ')')
            })
        }

        const bank = s && s.bank
        if (bank && typeof bank.balance === 'number' && bank.balance < 0) issues.push('bank.balance < 0 (' + bank.balance + ')')
        if (bank && typeof bank.investments === 'number' && bank.investments < 0) issues.push('bank.investments < 0 (' + bank.investments + ')')
        if (bank && bank.loan && typeof bank.loan.balance === 'number' && bank.loan.balance < 0) issues.push('bank.loan.balance < 0 (' + bank.loan.balance + ')')

        const stock = s && s.merchantStock
        if (stock && typeof stock === 'object') {
            for (const region in stock) {
                const regionObj = stock[region]
                if (!regionObj || typeof regionObj !== 'object') continue
                for (const merchant in regionObj) {
                    const bucket = regionObj[merchant]
                    if (!bucket || typeof bucket !== 'object') continue
                    for (const key in bucket) {
                        const v = bucket[key]
                        if (typeof v === 'number' && v < 0) issues.push('merchantStock.' + region + '.' + merchant + '.' + key + ' < 0 (' + v + ')')
                    }
                }
            }
        }
    } catch (_) {}
    return issues
}

export function qaCollectBugScannerFindings(s) {
    const nonFinite = qaScanNonFiniteNumbers(s, { maxIssues: 250 })
    const negatives = qaScanNegativeCounters(s)
    const elementKeys = qaScanElementKeyIssues(s)
    const refs = qaScanReferenceIntegrity(s)
    const abilityElements = qaScanAbilityElementCoverage()
    const statSanity = qaScanStatSanity(s)
    const combatRuntime = qaScanCombatRuntimeSanity(s)
    const talentIntegrity = qaScanTalentIntegrity(s)
    const cooldownIntegrity = qaScanCooldownIntegrity(s)

    const hasIssues = !!(
        nonFinite.length ||
        negatives.length ||
        elementKeys.length ||
        refs.length ||
        abilityElements.length ||
        statSanity.length ||
        combatRuntime.length ||
        talentIntegrity.length ||
        cooldownIntegrity.length
    )

    return {
        hasIssues,
        counts: {
            nonFinite: nonFinite.length,
            negatives: negatives.length,
            elementKeys: elementKeys.length,
            refs: refs.length,
            abilityElements: abilityElements.length,
            statSanity: statSanity.length,
            combatRuntime: combatRuntime.length,
            talentIntegrity: talentIntegrity.length,
            cooldownIntegrity: cooldownIntegrity.length
        },
        findings: {
            nonFinite,
            negativeCounters: negatives,
            statSanity,
            combatRuntime,
            elementKeys,
            abilityElements,
            talentIntegrity,
            cooldownIntegrity,
            referenceIntegrity: refs
        }
    }
}

export function qaScanStatSanity(s) {
    const issues = []
    const push = (msg) => { if (issues.length < 140) issues.push(msg) }

    try {
        const p = s && s.player
        if (!p) return issues

        const num = (v) => {
            const n = Number(v)
            return Number.isFinite(n) ? n : null
        }
        const pct = (v, name, min, max) => {
            const n = num(v)
            if (n === null) return push(name + ' is non-finite (' + String(v) + ')')
            if (n < min || n > max) push(name + ' out of range (' + v + ' not in [' + min + ', ' + max + '])')
        }

        if (!p.stats) return issues

        pct(p.stats.critChance, 'player.stats.critChance', 0, 100)
        pct(p.stats.dodgeChance, 'player.stats.dodgeChance', 0, 100)

        const checkNum = (obj, path, name) => {
            if (obj && name in obj) {
                const v = obj[name]
                const n = num(v)
                if (n === null) push(path + '.' + name + ' is non-finite (' + String(v) + ')')
            }
        }

        checkNum(p.stats, 'player.stats', 'attack')
        checkNum(p.stats, 'player.stats', 'magic')
        checkNum(p.stats, 'player.stats', 'armor')
        checkNum(p.stats, 'player.stats', 'magicRes')
        checkNum(p.stats, 'player.stats', 'speed')
        checkNum(p.stats, 'player.stats', 'haste')
        checkNum(p.stats, 'player.stats', 'lifeSteal')
        checkNum(p.stats, 'player.stats', 'armorPen')
    } catch (_) {}
    return issues
}

export function qaScanCombatRuntimeSanity(s) {
    const issues = []
    try {
        if (!s || !s.inCombat) return issues
        if (!s.currentEnemy) issues.push('inCombat but no currentEnemy')
        if (s.currentEnemy && !s.currentEnemy.name) issues.push('currentEnemy has no name')
        if (s.currentEnemy && typeof s.currentEnemy.hp !== 'number') issues.push('currentEnemy.hp is not a number')
        if (s.currentEnemy && typeof s.currentEnemy.maxHp !== 'number') issues.push('currentEnemy.maxHp is not a number')
    } catch (_) {}
    return issues
}

export function qaScanElementKeyIssues(s) {
    const issues = []
    const push = (msg) => { if (issues.length < 200) issues.push(msg) }
    const allowed = { fire: 1, frost: 1, lightning: 1, holy: 1, shadow: 1, arcane: 1, poison: 1, earth: 1, nature: 1 }

    const scanMap = (map, label) => {
        if (!map || typeof map !== 'object') return
        for (const k in map) {
            if (!(k in allowed)) push(label + ' has invalid element key "' + k + '"')
        }
    }

    try {
        const p = s && s.player
        if (p && p.stats) {
            scanMap(p.stats.elementalBonuses, 'player.stats.elementalBonuses')
            scanMap(p.stats.elementalResists, 'player.stats.elementalResists')
        }
        if (p && p.equipment && typeof p.equipment === 'object') {
            Object.keys(p.equipment).forEach((slot) => {
                const it = p.equipment[slot]
                if (!it || typeof it !== 'object') return
                scanMap(it.elementalBonuses, 'equipment.' + slot + '.elementalBonuses')
                scanMap(it.elementalResists, 'equipment.' + slot + '.elementalResists')
            })
        }
        if (p && Array.isArray(p.inventory)) {
            p.inventory.forEach((it, i) => {
                if (!it || typeof it !== 'object') return
                scanMap(it.elementalBonuses, 'inventory[' + i + '].elementalBonuses')
                scanMap(it.elementalResists, 'inventory[' + i + '].elementalResists')
            })
        }
        // Enemies
        if (s && s.inCombat && Array.isArray(s.enemies)) {
            s.enemies.forEach((e, i) => {
                if (!e || typeof e !== 'object') return
                scanMap(e.elementalResists, 'enemies[' + i + '].elementalResists')
            })
        }
    } catch (_) {}
    return issues
}

export function qaScanAbilityElementCoverage() {
    const issues = []
    const push = (msg) => { if (issues.length < 200) issues.push(msg) }

    const allowed = { fire: 1, frost: 1, lightning: 1, holy: 1, shadow: 1, arcane: 1, poison: 1, earth: 1, nature: 1 }
    const scan = (bucket, label) => {
        if (!bucket || typeof bucket !== 'object') return
        for (const k in bucket) {
            const obj = bucket[k]
            if (!obj || typeof obj !== 'object') continue
            if (obj.element && typeof obj.element === 'string' && !(obj.element in allowed)) {
                push(label + '.' + k + '.element = "' + obj.element + '" (not valid)')
            }
        }
    }

    try {
        // Note: ABILITIES, COMPANION_ABILITIES, ENEMY_ABILITIES are expected to be in scope
        // when this runs in gameOrchestrator. When extracted, we'll need to pass them as params.
        // For now, we try to access them from global scope
        if (typeof ABILITIES !== 'undefined') scan(ABILITIES, 'ABILITIES')
        if (typeof COMPANION_ABILITIES !== 'undefined') scan(COMPANION_ABILITIES, 'COMPANION_ABILITIES')
        if (typeof ENEMY_ABILITIES !== 'undefined') scan(ENEMY_ABILITIES, 'ENEMY_ABILITIES')
    } catch (_) {}
    return issues
}

export function qaScanTalentIntegrity(s) {
    const issues = []
    try {
        const p = s && s.player
        if (!p || !Array.isArray(p.talents)) return issues

        if (typeof TALENT_TREE === 'undefined') return issues

        p.talents.forEach((tid) => {
            const found = TALENT_TREE.some((node) => node.id === tid)
            if (!found) issues.push('player.talents includes unknown talent "' + tid + '"')
        })
    } catch (_) {}
    return issues
}

export function qaScanCooldownIntegrity(s) {
    const issues = []
    try {
        const p = s && s.player
        if (!p || !p.abilityCooldowns || typeof p.abilityCooldowns !== 'object') return issues

        if (typeof ABILITIES === 'undefined') return issues

        for (const aid in p.abilityCooldowns) {
            if (!(aid in ABILITIES)) {
                issues.push('player.abilityCooldowns["' + aid + '"] references unknown ability')
            }
        }
    } catch (_) {}
    return issues
}

export function qaScanReferenceIntegrity(s) {
    const issues = []
    try {
        const p = s && s.player
        if (!p) return issues

        if (typeof ITEM_DEFS === 'undefined') return issues

        if (Array.isArray(p.inventory)) {
            p.inventory.forEach((it, i) => {
                if (!it || !it.id) return
                if (!(it.id in ITEM_DEFS)) {
                    issues.push('player.inventory[' + i + '] references unknown item "' + it.id + '"')
                }
            })
        }

        if (p.equipment && typeof p.equipment === 'object') {
            Object.keys(p.equipment).forEach((slot) => {
                const it = p.equipment[slot]
                if (!it || !it.id) return
                if (!(it.id in ITEM_DEFS)) {
                    issues.push('player.equipment.' + slot + ' references unknown item "' + it.id + '"')
                }
            })
        }
    } catch (_) {}
    return issues
}

// Note: classifyIntegritySeverity is NOT exported from this module as it remains
// in gameOrchestrator.js with a different signature. The version there expects  
// invariant objects with specific structure from the integrity audit system.
