/**
 * smokeTestsImpl.js
 * Comprehensive smoke test suite for game systems validation.
 * Lazy-loaded to reduce main bundle size.
 */

export function createSmokeTestRunner(deps) {
    const {
        state,
        setState,
        GAME_PATCH,
        GAME_PATCH_NAME,
        SAVE_SCHEMA,
        ABILITIES,
        ENEMY_TEMPLATES,
        ITEM_DEFS,
        TALENT_DEFS,
        PLAYER_CLASSES,
        COMPANION_DEFS,
        DIFFICULTY_CONFIG,
        QUEST_DEFS,
        rand,
        randInt,
        cloneItemDef,
        addItemToInventory,
        advanceWorldTime,
        advanceToNextMorning,
        advanceTime,
        jumpToNextMorning,
        buildEnemyForBattle,
        applyEnemyAffixes,
        applyEnemyRarity,
        applyEliteModifiers,
        pickEnemyAbilitySet,
        generateLootDrop,
        addLog,
        updateHUD,
        updateEnemyPanel,
        buildAbilityContext,
        useAbilityInCombat,
        playerBasicAttack,
        _recalcPlayerStats,
        ensurePlayerSpellSystems,
        tryUnlockClassSpells,
        getAbilityCost,
        getAbilityEffectMultiplier,
        grantExperience,
        canPlayerActNow,
        guardPlayerTurn,
        ensureCombatTurnState,
        beginPlayerTurn,
        _enemyActImpl,
        applyEndOfTurnEffectsEnemy,
        applyPlayerRegenTick,
        applyStartOfTurnEffectsPlayer,
        applyEquipmentOnKill,
        applyEquipmentOnPlayerHit,
        applyEquipmentOnShieldCast,
        applyStatusSynergyOnPlayerHit,
        calcPhysicalDamage,
        calcMagicDamage,
        calcEnemyDamage,
        handleEnemyDefeat,
        playerHasTalent,
        _getMageRhythmBonus,
        _computeElementSummariesForPlayer,
        buildBugReportBundle,
        _buildSaveBlob,
        _setSmokeUiDisabled,
        _liveConsoleAssert,
        _liveConsoleError,
        _setPlayerAbilityContext,
        _normalizePinnedQuestRef,
        advanceSideQuest,
        buildProgressionAuditReport
    } = deps

function runSmokeTests(opts = {}) {
    const returnObject = !!(opts && opts.returnObject)

    const lines = []
    const started = Date.now()
    const QA_SEED = 123456789

    // Patch 1.2.70: keep the default smoke-suite fast on mobile devices.
    // Full / extended runs can be forced via runSmokeTests({ full: true }).
    const _ua = (typeof navigator !== 'undefined' && navigator && navigator.userAgent) ? String(navigator.userAgent) : ''
    const _isMobileUa = /iPhone|iPad|iPod|Android/i.test(_ua)
    const _quickMode = (opts && typeof opts.full === 'boolean') ? !opts.full : _isMobileUa

    const QA_COUNTS = {
        // Quick-mode is tuned for iOS file-protocol runs (fast feedback; no long loops).
        fuzz2Seeds: _quickMode ? 1 : 3,
        fuzz2Actions: _quickMode ? 15 : 90,
        fuzzActions: _quickMode ? 40 : 300,
        stressLootDrops: _quickMode ? 70 : 700,
        stressEnemies: _quickMode ? 40 : 300,
        stressSaveCycles: _quickMode ? 5 : 40,
        stressScenarioDays: _quickMode ? 4 : 14,
        stressScenarioLoot: _quickMode ? 25 : 140,
        stressDamageIters: _quickMode ? 120 : 1000
    }

    lines.push('SMOKE TESTS')
    lines.push('Patch ' + GAME_PATCH + (GAME_PATCH_NAME ? ' — ' + GAME_PATCH_NAME : ''))
    lines.push('Seed ' + QA_SEED + ' • Save schema ' + SAVE_SCHEMA)
    lines.push('Legend: ✔ pass • ✖ fail')

    // Patch 1.2.70: keep a stable top-of-report summary (tests ran + failures), like prior builds.
    const _summaryLineIndex = lines.length
    // Keep duration visible in the report header (parity with pre-refactor smoke output).
    lines.push('Ran … tests in … ms • Failures: …')
    lines.push('')

    const live = state

    // Smoke tests should not repaint the live UI while the suite swaps `state`.
    // We use uiRuntime's flag instead of monkey-patching imported bindings.
    const _liveUiDisabledSnap = (() => {
        try { return typeof isUiDisabled === 'function' ? !!isUiDisabled() : false } catch (_) { return false }
    })()

    // Disable UI writes for the duration of the suite (prevents live DOM churn + speeds up runs).
    try { if (typeof setUiDisabled === 'function') setUiDisabled(true) } catch (_) {}

    // Perf snapshot of the *live session* (helps compare "slow paths" vs test time).
    const _perfSnapLive = (() => {
        try { return qaCollectPerfSnapshotSync(live) } catch (_) { return null }
    })()
    if (_perfSnapLive) {
        lines.push(qaFormatPerfSnapshotText(_perfSnapLive))
        lines.push('')
    }

    // Patch 1.2.53: Smoke tests must never clear the player's pinned quest.
    // Snapshot the pin up-front and restore it after the sandbox run (only if still valid).
    const _normalizePinnedQuestRef = (pinRaw) => {
        try {
            if (!pinRaw) return null
            if (pinRaw && typeof pinRaw === 'object') {
                if (pinRaw.kind === 'main') return { kind: 'main' }
                if (pinRaw.kind === 'side' && pinRaw.id) return { kind: 'side', id: String(pinRaw.id) }
                return null
            }
            if (typeof pinRaw === 'string' && pinRaw.trim()) {
                const t = pinRaw.trim()
                return t.toLowerCase() === 'main' ? { kind: 'main' } : { kind: 'side', id: t }
            }
            return null
        } catch (_) {
            return null
        }
    }
    const _livePinnedQuestSnap = (() => {
        try {
            const pin = _normalizePinnedQuestRef(live && live.quests ? live.quests.pinned : null)
            return pin ? JSON.parse(JSON.stringify(pin)) : null
        } catch (_) {
            return null
        }
    })()

    // Patch 1.2.53: prevent any pending save coalescing timer from firing while state is swapped.
    const _liveSaveTimerWasActive = (() => {
        try { return !!_saveTimer } catch (_) { return false }
    })()
    const _liveSaveQueuedSnap = (() => {
        try { return !!_saveQueued } catch (_) { return false }
    })()
    try {
        if (_saveTimer) {
            clearTimeout(_saveTimer)
            _saveTimer = null
        }
        _saveQueued = false
    } catch (_) {}

    // Capture a live bug-report bundle up-front (before state is swapped into the smoke-test sandbox).
    // This keeps the report tied to the player's real session rather than the suite's temporary state.
    const _bugReportLive = (() => {
        try {
            const bundle = buildBugReportBundle()
            // Ensure it's JSON-safe and stable even if the live state mutates during the suite.
            return JSON.parse(JSON.stringify(bundle))
        } catch (_) {
            try {
                return { summary: { patch: GAME_PATCH, patchName: GAME_PATCH_NAME, saveSchema: SAVE_SCHEMA, timeUtc: new Date().toISOString() }, error: 'buildBugReportBundle failed' }
            } catch (_2) {
                return { error: 'buildBugReportBundle failed' }
            }
        }
    })()

    // Flag used to disable combat timers/async turn resolution during the smoke suite.
    const _prevSmoke = (() => {
        try { return !!(state && state.debug && state.debug.smokeTestRunning) } catch (_) { return false }
    })()
    try {
        if (state) {
            if (!state.debug || typeof state.debug !== 'object') state.debug = {}
            state.debug.smokeTestRunning = true
        }
    } catch (_) {}


    // Capture console errors/asserts during smoke tests so silent issues become failures.
    const _liveConsoleError = typeof console !== 'undefined' ? console.error : null
    const _liveConsoleAssert = typeof console !== 'undefined' ? console.assert : null
    const consoleErrorLog = []
    const consoleAssertLog = []
    const _stringifyConsoleArg = (x) => {
        try {
            if (typeof x === 'string') return x
            return JSON.stringify(x)
        } catch (_) {
            return String(x)
        }
    }
    try {
        if (typeof console !== 'undefined') {
            console.error = (...args) => {
                consoleErrorLog.push(args.map(_stringifyConsoleArg).join(' '))
                try { if (_liveConsoleError) _liveConsoleError(...args) } catch (_) {}
            }
            console.assert = (cond, ...args) => {
                if (!cond) consoleAssertLog.push(args.length ? args.map(_stringifyConsoleArg).join(' ') : 'console.assert failed')
                try { if (_liveConsoleAssert) _liveConsoleAssert(cond, ...args) } catch (_) {}
            }
        }
    } catch (_) {}

    let passCount = 0
    let failCount = 0
    const failed = []

    const sectionStats = []
    let currentSection = null

    const section = (title) => {
        if (currentSection) sectionStats.push(currentSection)
        currentSection = { title: String(title || ''), pass: 0, fail: 0 }
        lines.push('')
        lines.push('— ' + title + ' —')
    }

    // Helper: run a test and record pass/fail without aborting the full suite.
    const test = (label, fn) => {
        try {
            // Keep tests isolated from one another: combat turn state can be left in
            // a resolving/busy phase by earlier tests.
            try {
                if (state) {
                    state.enemies = []
                    state.targetEnemyIndex = 0
                    if (!state.combat || typeof state.combat !== 'object') {
                        state.combat = { phase: 'player', busy: false, round: 1, battleDrops: 0 }
                    } else {
                        state.combat.phase = 'player'
                        state.combat.busy = false
                        if (typeof state.combat.round !== 'number' || !Number.isFinite(state.combat.round)) state.combat.round = 1
                        if (typeof state.combat.battleDrops !== 'number' || !Number.isFinite(state.combat.battleDrops)) state.combat.battleDrops = 0
                    }
                }
            } catch (_) {}

            fn()
            passCount += 1
            if (currentSection) currentSection.pass += 1
            lines.push('  ✔ ' + label)
        } catch (e) {
            const msg = e && e.message ? e.message : String(e)
            failCount += 1
            if (currentSection) currentSection.fail += 1
            failed.push({ label, msg })
            lines.push('  ✖ ' + label + ': ' + msg)
        }
    }
    const assert = (cond, msg) => {
        if (!cond) throw new Error(msg || 'assertion failed')
    }
    const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n)

    // Smoke-test helper: create a minimal player object without relying on DOM.
    // Used by class mechanics tests (unlocks, combo points, marks).
    const createPlayer = (name, classId, diffId) => {
        const cid = String(classId || 'warrior')
        const classDef = PLAYER_CLASSES[cid] || PLAYER_CLASSES['warrior']
        const base = classDef.baseStats
        const startingSkills = CLASS_STARTING_SKILLS[cid] || CLASS_STARTING_SKILLS.default

        const p = {
            name: String(name || 'Tester'),
            classId: cid,
            level: 1,
            xp: 0,
            nextLevelXp: 100,

            maxHp: base.maxHp,
            hp: base.maxHp,

            resourceKey: classDef.resourceKey,
            resourceName: classDef.resourceName,
            maxResource:
                classDef.resourceKey === 'mana'
                    ? 100
                    : classDef.resourceKey === 'essence'
                    ? 90
                    : 60,
            resource:
                classDef.resourceKey === 'mana'
                    ? 80
                    : classDef.resourceKey === 'essence'
                    ? 45
                    : 0,

            stats: {
                attack: base.attack,
                magic: base.magic,
                armor: base.armor,
                speed: base.speed
            },

            skills: {
                strength: startingSkills.strength,
                endurance: startingSkills.endurance,
                willpower: startingSkills.willpower
            },
            skillPoints: 0,

            equipment: {
                weapon: null,
                armor: null,
                head: null,
                hands: null,
                feet: null,
                belt: null,
                neck: null,
                ring: null
            },
            inventory: [],
            spells: [...classDef.startingSpells],
            equippedSpells: [...classDef.startingSpells],
            abilityUpgrades: {},
            abilityUpgradeTokens: 0,
            gold: 0,
            status: {}
        }

        // Ensure all expected subsystems exist.
        ensurePlayerSpellSystems(p)
        resetPlayerCombatStatus(p)
        return p
    }


    const isDomNode = (x) => {
        try {
            return typeof Node !== 'undefined' && x instanceof Node
        } catch (_) {
            return false
        }
    }

    // Bug-catcher: deep scan for NaN/Infinity in the test state.
    const scanForNonFiniteNumbers = (rootObj) => {
        const issues = []
        const seen = new WeakSet()
        const walk = (x, path) => {
            if (typeof x === 'number') {
                if (!Number.isFinite(x)) issues.push(path + ' = ' + String(x))
                return
            }
            if (x === null || typeof x !== 'object') return
            if (isDomNode(x)) return
            if (seen.has(x)) return
            seen.add(x)

            if (Array.isArray(x)) {
                for (let i = 0; i < x.length; i++) walk(x[i], path + '[' + i + ']')
                return
            }

            for (const k in x) {
                if (!Object.prototype.hasOwnProperty.call(x, k)) continue
                if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue
                walk(x[k], path + '.' + k)
            }
        }
        walk(rootObj, 'state')
        return issues
    }

    // Bug-catcher: check for negative quantities / counters in the most common gameplay containers.
    const scanForNegativeCounters = (s) => {
        const issues = []
        try {
            const p = s && s.player
            if (p && typeof p.gold === 'number' && p.gold < 0) issues.push('player.gold < 0 (' + p.gold + ')')
            if (p && typeof p.hp === 'number' && p.hp < 0) issues.push('player.hp < 0 (' + p.hp + ')')
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

    // Stable JSON stringify for save round-trip comparisons.
    const stableStringify = (obj) => {
        const seen = new WeakSet()
        const sortify = (x) => {
            if (x === null || typeof x !== 'object') return x
            if (seen.has(x)) return null
            seen.add(x)
            if (Array.isArray(x)) return x.map(sortify)
            const out = {}
            Object.keys(x)
                .sort()
                .forEach((k) => {
                    out[k] = sortify(x[k])
                })
            return out
        }
        return JSON.stringify(sortify(obj))
    }

    // Stash a few function refs so smoke tests don't mutate the player's save or UI.
    // NOTE: UI helpers imported from ES modules (uiRuntime.js) are *read-only bindings*.
    // On iOS Safari, assigning to them throws "Attempted to assign to readonly property".
    // Instead of monkey-patching, we temporarily disable UI writes via uiRuntime's switch.
    const _liveSaveGame = typeof saveGame === 'function' ? saveGame : null
    const _liveUpdateHUD = typeof updateHUD === 'function' ? updateHUD : null
    const _liveUpdateEnemyPanel = typeof updateEnemyPanel === 'function' ? updateEnemyPanel : null
    const _liveRecordInput = typeof recordInput === 'function' ? recordInput : null

    try {
        const t = createEmptyState()
        initRngState(t)
        setDeterministicRngEnabled(t, true)
        setRngSeed(t, QA_SEED)

        // Minimal new-game boot
        t.difficulty = 'normal'
        initTimeState(t)
        initVillageEconomyState(t)
        initGovernmentState(t, 0)
        ensureVillagePopulation(t)

        // Minimal player (warrior-ish)
        const classDef = PLAYER_CLASSES['warrior']
        const base = classDef.baseStats
        t.player = {
            name: 'SMOKE',
            classId: 'warrior',
            level: 1,
            xp: 0,
            nextLevelXp: 100,
            maxHp: base.maxHp,
            hp: base.maxHp,
            resourceKey: classDef.resourceKey,
            resourceName: classDef.resourceName,
            maxResource: 60,
            resource: 0,
            stats: {
                attack: base.attack,
                magic: base.magic,
                armor: base.armor,
                speed: base.speed
            },
            skills: { strength: 0, endurance: 0, willpower: 0 },
            skillPoints: 0,
            equipment: { weapon: null, armor: null, head: null, hands: null, feet: null, belt: null, neck: null, ring: null },
            inventory: [],
            spells: [...classDef.startingSpells],
            equippedSpells: [...classDef.startingSpells],
            abilityUpgrades: {},
            abilityUpgradeTokens: 0,
            gold: 250,
            status: { bleedTurns: 0, bleedDamage: 0, shield: 0, spellCastCount: 0, spellCastCooldown: 0, evasionTurns: 0 }
        }

        _setState(t)
        syncGlobalStateRef()

        // Mark test state so combat waits/turn sequencing can run synchronously.
        try {
            if (!state.debug || typeof state.debug !== 'object') state.debug = {}
            state.debug.smokeTestRunning = true
        } catch (_) {}

        // Disable persistence + UI side-effects while tests run.
        // Smoke tests intentionally run against a fresh in-memory state and must never
        // mutate the active save OR repaint the live UI with test values.
        if (_liveSaveGame) saveGame = () => {}
        if (_liveUpdateHUD) updateHUD = () => {}
        if (_liveRecordInput) recordInput = () => {}

        // Disable UI writes for the bulk of the suite so gameplay tests don't pay
        // the cost of DOM work (log rendering, screen swaps, etc.). Individual UI
        // tests can temporarily re-enable UI with `withUiEnabled`.
        const _setSmokeUiDisabled = (v) => {
            try {
                if (typeof setUiDisabled === 'function') setUiDisabled(!!v)
            } catch (_) {}
        }
        const withUiEnabled = (fn) => {
            const prev = (() => {
                try { return typeof isUiDisabled === 'function' ? !!isUiDisabled() : false } catch (_) { return false }
            })()
            _setSmokeUiDisabled(false)
            try {
                return fn()
            } finally {
                _setSmokeUiDisabled(prev)
            }
        }

        _setSmokeUiDisabled(true)

        section('Player & Inventory')

        // 1) basic stat recalc
        test('recalcPlayerStats', () => {
            _recalcPlayerStats()
            const p = state.player
            assert(isFiniteNum(p.maxHp) && p.maxHp > 0, 'maxHp invalid')
            assert(isFiniteNum(p.stats.attack), 'attack invalid')
        })

        // 2) inventory stacking correctness (potions)
        test('inventory stacking (potions)', () => {
            const p = state.player
            p.inventory = []
            addItemToInventory('potionSmall', 1)
            addItemToInventory('potionSmall', 1)
            const stacks = p.inventory.filter((it) => it && it.id === 'potionSmall' && it.type === 'potion')
            assert(stacks.length === 1, 'expected 1 stack, got ' + stacks.length)
            assert((stacks[0].quantity || 0) === 2, 'expected quantity 2, got ' + (stacks[0].quantity || 0))
        })

        // 2b) inventory quantity normalization (0/negative/NaN should not corrupt state)
        test('inventory quantity normalization', () => {
            const p = state.player
            p.inventory = []
            addItemToInventory('potionSmall', 0)
            addItemToInventory('potionSmall', -5)
            addItemToInventory('potionSmall', NaN)
            const it = p.inventory.find((x) => x && x.id === 'potionSmall')
            assert(it && it.type === 'potion', 'potionSmall missing after adds')
            assert(it.quantity === 3, 'expected quantity 3 after normalized adds, got ' + String(it.quantity))
        })

        // 3) consume decrements + removes at 0
        test('consume potion decrements and removes at 0', () => {
            const p = state.player
            p.inventory = []
            addItemToInventory('potionSmall', 2)
            const idx = p.inventory.findIndex((it) => it && it.id === 'potionSmall')
            assert(idx >= 0, 'potionSmall missing')
            p.hp = Math.max(1, p.maxHp - 80)

            usePotionFromInventory(idx, false, { stayOpen: true })

            const after1 = p.inventory.find((it) => it && it.id === 'potionSmall')
            assert(after1 && after1.quantity === 1, 'expected quantity 1 after first use')

            // Use the last one (index can change if removed, so refetch)
            const idx2 = p.inventory.findIndex((it) => it && it.id === 'potionSmall')
            assert(idx2 >= 0, 'potionSmall missing before second use')
            p.hp = Math.max(1, p.maxHp - 80)
            usePotionFromInventory(idx2, false, { stayOpen: true })

            const after2 = p.inventory.find((it) => it && it.id === 'potionSmall')
            assert(!after2, 'expected potion stack removed at 0')
        })

        // 4) equip slot validity (non-equipables must not equip)
        test('equip rejects non-equipable items', () => {
            const p = state.player
            p.inventory = []
            p.equipment.weapon = null
            p.equipment.armor = null
            addItemToInventory('potionSmall', 1)
            const idx = p.inventory.findIndex((it) => it && it.id === 'potionSmall')
            equipItemFromInventory(idx, { stayOpen: true })
            assert(p.equipment.weapon === null && p.equipment.armor === null, 'non-equipable item altered equipment')
        })

        // 5) sell equipped item clears slot and gold matches sell value
        test('sell equipped clears slot + gold matches getSellValue', () => {
            const p = state.player
            p.inventory = []
            p.gold = 100
            const sword = cloneItemDef('swordIron')
            assert(sword, 'missing swordIron def')
            p.inventory.push(sword)
            p.equipment.weapon = sword

            const expected = getSellValue(sword, 'village')
            assert(expected > 0, 'sell value not positive')

            const beforeGold = p.gold
            sellItemFromInventory(0, 'village')
            assert(p.equipment.weapon === null, 'weapon slot not cleared')
            assert(p.gold === beforeGold + expected, 'gold mismatch: expected +' + expected + ', got ' + (p.gold - beforeGold))
        })

        // 6) recalc idempotence (no double-apply)
        test('recalcPlayerStats is stable (idempotent)', () => {
            const p = state.player
            p.inventory = []
            const armor = cloneItemDef('armorLeather')
            p.inventory.push(armor)
            p.equipment.armor = armor
            _recalcPlayerStats()
            const snap1 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats, status: p.status })
            _recalcPlayerStats()
            const snap2 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats, status: p.status })
            assert(snap1 === snap2, 'stats changed on second recalc')
        })


        // 6b) inventory safety: equipment does not stack like potions
        test('inventory: equipment does not stack', () => {
            const p = state.player
            p.inventory = []
            addItemToInventory('swordIron', 1)
            addItemToInventory('swordIron', 1)
            assert(p.inventory.length === 2, 'expected two separate weapons in inventory')
        })

        // 6c) equipment swap: stats refresh correctly (no double-apply)
        test('equipment swap refreshes stats (no double apply)', () => {
            const p = state.player
            p.inventory = []
            p.equipment.weapon = null

            const sword = cloneItemDef('swordIron')
            const staff = cloneItemDef('staffOak')
            p.inventory.push(sword)
            p.inventory.push(staff)

            // Equip sword
            equipItemFromInventory(0, { stayOpen: true })
            const atk1 = p.stats.attack
            const mag1 = p.stats.magic

            // Equip staff (same slot), should shift stats
            equipItemFromInventory(1, { stayOpen: true })
            const atk2 = p.stats.attack
            const mag2 = p.stats.magic

            assert(atk2 <= atk1, 'attack did not decrease when swapping to staff')
            assert(mag2 >= mag1, 'magic did not increase when swapping to staff')

            // Recalc is stable after swap
            const snap1 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats })
            _recalcPlayerStats()
            const snap2 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats })
            assert(snap1 === snap2, 'stats changed on extra recalc after swap')
        })

        section('Classes & Abilities (1.1.7)')

        test('class unlock tables include 3/6/9/12', () => {
            const required = [3, 6, 9, 12]
            Object.keys(CLASS_LEVEL_UNLOCKS).forEach((cid) => {
                const levels = (CLASS_LEVEL_UNLOCKS[cid] || []).map((u) => u.level).sort((a,b)=>a-b)
                required.forEach((lvl) => {
                    assert(levels.includes(lvl), cid + ' missing unlock level ' + lvl)
                })
            })
        })

        test('class unlock spells exist in ABILITIES + effects', () => {
            Object.keys(CLASS_LEVEL_UNLOCKS).forEach((cid) => {
                (CLASS_LEVEL_UNLOCKS[cid] || []).forEach((u) => {
                    assert(u && u.spell, 'bad unlock for ' + cid)
                    assert(!!ABILITIES[u.spell], 'ABILITIES missing: ' + u.spell)
                    assert(typeof ABILITY_EFFECTS[u.spell] === 'function', 'ABILITY_EFFECTS missing: ' + u.spell)
                })
            })
        })

        test('abilities/spells have elementType or physical tag', () => {
            const hasPhysicalTag = (ab) => {
                try {
                    return Array.isArray(ab.tags) && ab.tags.indexOf('physical') >= 0
                } catch (_) {
                    return false
                }
            }
            const hasElementType = (ab) => !!(ab && (ab.elementType || ab.element))

            // Player abilities with classId should always be classed.
            Object.keys(ABILITIES).forEach((id) => {
                const ab = ABILITIES[id]
                if (!ab || !ab.classId) return
                assert(hasElementType(ab) || hasPhysicalTag(ab), 'ABILITIES.' + id + ' missing elementType/physical tag')
            })

            // Enemy abilities should be classed (elementType or physical).
            Object.keys(ENEMY_ABILITIES).forEach((id) => {
                const ab = ENEMY_ABILITIES[id]
                if (!ab) return
                const physicalOk = hasPhysicalTag(ab) || ab.damageType === 'physical'
                assert(hasElementType(ab) || physicalOk, 'ENEMY_ABILITIES.' + id + ' missing elementType/physical')
            })

            // Companion abilities should be classed (elementType or physical).
            Object.keys(COMPANION_ABILITIES).forEach((id) => {
                const ab = COMPANION_ABILITIES[id]
                if (!ab) return
                assert(hasElementType(ab) || hasPhysicalTag(ab), 'COMPANION_ABILITIES.' + id + ' missing elementType/physical tag')
            })
        })


        test('level 12 unlock grants all class unlock spells', () => {
            const classes = Object.keys(CLASS_LEVEL_UNLOCKS)
            classes.forEach((cid) => {
                const p = createPlayer('Tester', cid, 'normal')
                p.level = 12
                ensurePlayerSpellSystems(p)
                // grant everything up to level
                const unlocks = CLASS_LEVEL_UNLOCKS[cid] || []
                unlocks.forEach((u) => {
                    if (u.level <= p.level && !p.spells.includes(u.spell)) p.spells.push(u.spell)
                })
                unlocks.forEach((u) => assert(p.spells.includes(u.spell), cid + ' did not receive ' + u.spell))
            })
        })

        test('rogue combo points build and spend (backstab→eviscerate)', () => {
            const p = createPlayer('Rogue', 'rogue', 'normal')
            ensurePlayerSpellSystems(p)
            const enemy = { name: 'Combo Dummy', hp: 500, maxHp: 500, armor: 0, magicRes: 0, level: 1, tier: 1 }
            const ctx1 = buildAbilityContext(p, 'backstab', enemy)
            ABILITY_EFFECTS.backstab(p, enemy, ctx1)
            assert((p.status.comboPoints || 0) === 1, 'expected 1 combo point')
            const ctx2 = buildAbilityContext(p, 'eviscerate', enemy)
            ABILITY_EFFECTS.eviscerate(p, enemy, ctx2)
            assert((p.status.comboPoints || 0) === 0, 'combo points not spent')
        })

        test('ranger marks tick down and clear when expired', () => {
            const p = createPlayer('Ranger', 'ranger', 'normal')
            ensurePlayerSpellSystems(p)
            const enemy = { name: 'Mark Dummy', hp: 500, maxHp: 500, armor: 0, magicRes: 0, level: 1, tier: 1 }
            const ctx = buildAbilityContext(p, 'markedPrey', enemy)
            ABILITY_EFFECTS.markedPrey(p, enemy, ctx)
            assert((enemy.markedStacks || 0) > 0, 'marks not applied')
            assert((enemy.markedTurns || 0) > 0, 'mark turns missing')
            // tick until clear
            for (let i = 0; i < 5; i++) tickEnemyStartOfTurn(enemy)
            assert((enemy.markedTurns || 0) === 0, 'mark turns did not expire')
            assert((enemy.markedStacks || 0) === 0, 'mark stacks did not clear')
        })

        test('combat HUD class meter renders (all classes)', () => {
            return withUiEnabled(() => {
                if (typeof document === 'undefined') return
                let el = document.getElementById('hudClassMeter')
                if (!el) {
                    el = document.createElement('div')
                    el.id = 'hudClassMeter'
                    document.body.appendChild(el)
                }

                state.inCombat = true

                const cases = [
                    { cid: 'mage', label: 'Rhythm', setup: (p, e) => { p.status.spellCastCount = 2 } },
                    { cid: 'warrior', label: 'Bulwark', setup: (p, e) => { p.resource = 40 } },
                    { cid: 'blood', label: 'Blood', setup: (p, e) => { p.resource = Math.floor(p.maxResource * 0.6) } },
                    { cid: 'ranger', label: 'Marks', setup: (p, e) => { e.markedStacks = 2; e.markedTurns = 4 } },
                    { cid: 'paladin', label: 'Sanctuary', setup: (p, e) => { p.status.shield = 25 } },
                    { cid: 'rogue', label: 'Combo', setup: (p, e) => { p.status.comboPoints = 3 } },
                    { cid: 'cleric', label: 'Ward', setup: (p, e) => { p.status.shield = 18 } },
                    { cid: 'necromancer', label: 'Shards', setup: (p, e) => { p.status.soulShards = 4 } },
                    { cid: 'shaman', label: 'Totem', setup: (p, e) => { p.status.totemType = ''; p.status.totemTurns = 0 } },
                    { cid: 'berserker', label: 'Frenzy', setup: (p, e) => { p.hp = Math.max(1, Math.floor(p.maxHp * 0.4)) } },
                    { cid: 'vampire', label: 'Hunger', setup: (p, e) => { p.resource = Math.floor(p.maxResource * 0.6) } }
                ]

                cases.forEach((c) => {
                    state.player = createPlayer('T', c.cid, 'normal')
                    ensurePlayerSpellSystems(state.player)
                    state.currentEnemy = { name: 'Dummy', hp: 50, maxHp: 50 }
                    c.setup(state.player, state.currentEnemy)
                    updateClassMeterHUD()
                    assert(!el.classList.contains('hidden'), 'meter should be visible for ' + c.cid)
                    assert(el.innerHTML.includes(c.label), c.cid + ' meter label missing')
                })

                // Not in combat -> hidden
                state.inCombat = false
                updateClassMeterHUD()
                assert(el.classList.contains('hidden'), 'meter should be hidden out of combat')
            })
        })

        section('Talents (Patch 1.2.x)')

        test('talent unlock immediately updates derived stats (mage_frostward)', () => {
            // Verify wiring: unlocking a resist talent should apply to player stats
            // without requiring an unrelated stat refresh (equip, level-up, etc.).
            state.player = createPlayer('Mage', 'mage', 'normal')
            const p = state.player
            p.level = 6
            p.talentPoints = 1
            ensurePlayerTalents(p)
            _recalcPlayerStats()

            assert(!((p.stats.elementalResists || {}).frost), 'unexpected frost resist before talent')

            const ok = unlockTalent(p, 'mage_frostward')
            assert(ok, 'unlockTalent returned false')

            const frost = (p.stats.elementalResists || {}).frost || 0
            assert(frost === 15, 'expected 15% frost resist from talent, got ' + frost)
        })

        test('talent unlock immediately updates derived stats (vampire_dark_agility)', () => {
            state.player = createPlayer('Vampire', 'vampire', 'normal')
            const p = state.player
            p.level = 6
            p.talentPoints = 1
            ensurePlayerTalents(p)
            _recalcPlayerStats()

            const before = Number(p.stats && p.stats.dodgeChance ? p.stats.dodgeChance : 0)
            const ok = unlockTalent(p, 'vampire_dark_agility')
            assert(ok, 'unlockTalent returned false')

            const after = Number(p.stats && p.stats.dodgeChance ? p.stats.dodgeChance : 0)
            // Talent adds +8% dodge; allow small rounding differences due to speed-derived dodge.
            assert(after >= before + 7.5, 'expected vampire_dark_agility to add dodge immediately, got ' + before + ' -> ' + after)
        })

                test('talent tables: each class has 8 talent options', () => {
            Object.keys(PLAYER_CLASSES).forEach((cid) => {
                const arr = TALENT_DEFS[cid] || []
                assert(arr.length === 8, cid + ' talent count expected 8, got ' + arr.length)
            })
        })

        test('pinpoint increases mark scaling (deterministic)', () => {
            const p = state.player
            p.classId = 'ranger'
            p.resourceKey = 'fury'
            p.status = p.status || {}
            p.status.firstHitBonusAvailable = false // isolate mark math
            p.talents = {}
            p.talentPoints = 1

            _recalcPlayerStats()

            const enemy = {
                name: 'Dummy',
                hp: 200,
                maxHp: 200,
                armor: 0,
                armorBuff: 0,
                affinities: {},
                elementalResists: {},
                markedStacks: 5,
                markedTurns: 3
            }
            state.currentEnemy = enemy

            const ctx0 = buildAbilityContext(p, 'twinArrows')
            _setPlayerAbilityContext(ctx0)
            state.flags.neverCrit = true
            setRngSeed(state, 777)
            const dmg0 = calcPhysicalDamage(300, null, enemy)

            unlockTalent(p, 'ranger_pinpoint')
            const ctx1 = buildAbilityContext(p, 'twinArrows')
            _setPlayerAbilityContext(ctx1)
            setRngSeed(state, 777)
            const dmg1 = calcPhysicalDamage(300, null, enemy)

            assert(dmg1 > dmg0, 'expected pinpoint to increase damage, got ' + dmg0 + ' -> ' + dmg1)

            state.flags.neverCrit = false
            _setPlayerAbilityContext(null)
        })

test('ember focus increases fire spell damage (deterministic)', () => {
            const snapFlags = {
                alwaysCrit: state.flags && state.flags.alwaysCrit,
                neverCrit: state.flags && state.flags.neverCrit
            }
            state.flags = Object.assign({}, state.flags || {}, { neverCrit: true })
            state.player = createPlayer('Mage', 'mage', 'normal')
            const p = state.player
            p.level = 6
            p.talentPoints = 1
            ensurePlayerTalents(p)
            _recalcPlayerStats()

	            const enemy = { name: 'Dummy', hp: 999, maxHp: 999, armor: 0, magicRes: 0, armorBuff: 0, magicResBuff: 0, level: 1, tier: 1 }

            // Reset RNG before each call so variance is identical.
	            setRngSeed(state, 424242)
	            // calcMagicDamage signature: (baseMagicStat, elementType, enemyOverride)
	            const dmgNoTalent = calcMagicDamage(500, 'fire', enemy)

            const ok = unlockTalent(p, 'mage_ember_focus')
            assert(ok, 'unlockTalent returned false')
	            setRngSeed(state, 424242)
	            const dmgWithTalent = calcMagicDamage(500, 'fire', enemy)

            assert(dmgWithTalent > dmgNoTalent, 'expected damage increase, got ' + dmgNoTalent + ' -> ' + dmgWithTalent)

            // Allow 1 point of rounding drift.
            const expected = Math.round(dmgNoTalent * 1.10)
            assert(Math.abs(dmgWithTalent - expected) <= 1, 'expected ~' + expected + ' (10% more), got ' + dmgWithTalent)

            // Restore flags so later tests that validate crit behavior are unaffected.
            try {
                state.flags.alwaysCrit = snapFlags.alwaysCrit
                state.flags.neverCrit = snapFlags.neverCrit
            } catch (_) {}
        })

        test('character sheet elemental bonus summary includes spell-focus talents', () => {
            state.player = createPlayer('Mage', 'mage', 'normal')
            const p = state.player
            p.level = 6
            p.talentPoints = 1
            ensurePlayerTalents(p)
            _recalcPlayerStats()

            const s0 = _computeElementSummariesForPlayer(p)
            assert(!String(s0.elementalBonusSummary || '').includes('Fire'), 'expected no Fire bonus before talent, got ' + s0.elementalBonusSummary)

            const ok = unlockTalent(p, 'mage_ember_focus')
            assert(ok, 'unlockTalent returned false')

            const s1 = _computeElementSummariesForPlayer(p)
            assert(String(s1.elementalBonusSummary || '').includes('Fire +10%'), 'expected Fire +10% after Ember Focus, got ' + s1.elementalBonusSummary)
        })


        test('elemental summaries do not show zero-prefixed entries', () => {
            const p = {
                stats: {
                    elementalBonusBreakdown: { gear: { frost: '5%', shadow: 0 }, talent: { shadow: '10%' } },
                    elementalResistBreakdown: { gear: { frost: '7%' }, talent: { shadow: 15 } },
                    elementalResists: { frost: '7%', shadow: 15 }
                }
            }
            const s = _computeElementSummariesForPlayer(p)
            assert(String(s.elementalBonusSummary || '').includes('Frost +5%'), 'missing Frost +5%, got ' + s.elementalBonusSummary)
            assert(String(s.elementalBonusSummary || '').includes('Shadow +10%'), 'missing Shadow +10%, got ' + s.elementalBonusSummary)
            assert(!/0frost/i.test(String(s.elementalBonusSummary || '')), 'unexpected 0frost in summary: ' + s.elementalBonusSummary)
            assert(!/0shadow/i.test(String(s.elementalBonusSummary || '')), 'unexpected 0shadow in summary: ' + s.elementalBonusSummary)
            assert(String(s.elementalResistSummary || '').includes('Frost 7%'), 'missing Frost resist, got ' + s.elementalResistSummary)
            assert(String(s.elementalResistSummary || '').includes('Shadow 15%'), 'missing Shadow resist, got ' + s.elementalResistSummary)
        })

        test('normalizeElementType strips numeric prefixes and duplicated names', () => {
            assert(normalizeElementType('0frost') === 'frost', 'expected 0frost -> frost')
            assert(normalizeElementType('0shadowshadow') === 'shadow', 'expected 0shadowshadow -> shadow')
            assert(normalizeElementType('shadow_resist') === 'shadow', 'expected shadow_resist -> shadow')
        })

        section('Save & Migration')

        // 7) save roundtrip equality (normalized)
        test('save roundtrip stable (normalized)', () => {
            const blob1 = _buildSaveBlob()
            blob1.meta = Object.assign({}, blob1.meta || {}, { patch: GAME_PATCH, schema: SAVE_SCHEMA, savedAt: 0 })
            const norm = (o) => {
                const c = JSON.parse(JSON.stringify(o))
                if (c && c.meta) {
                    c.meta.savedAt = 0
                    c.meta.patch = GAME_PATCH
                    c.meta.schema = SAVE_SCHEMA
                }
                return stableStringify(c)
            }
            const migrated = migrateSaveData(JSON.parse(JSON.stringify(blob1)))
            assert(migrated && migrated.meta && migrated.meta.schema === SAVE_SCHEMA, 'migration schema mismatch')
            assert(norm(blob1) === norm(migrated), 'roundtrip changed payload (after normalization)')
        })

        // 8) legacy payload migration (qty -> quantity)
        test('legacy save migration: qty→quantity', () => {
            const legacy = {
                meta: { schema: 5, patch: '1.1.51', savedAt: 0 },
                player: {
                    name: 'LEGACY',
                    classId: 'warrior',
                    level: 1,
                    hp: 10,
                    maxHp: 10,
                    resource: 0,
                    maxResource: 0,
                    gold: 0,
                    inventory: [{ id: 'potionSmall', type: 'potion', qty: 3 }]
                },
                time: { dayIndex: 0, partIndex: 0 }
            }
            const migrated = migrateSaveData(JSON.parse(JSON.stringify(legacy)))
            const it = migrated.player.inventory[0]
            assert('quantity' in it, 'quantity missing after migrate')
            assert(!('qty' in it), 'qty still present after migrate')
            assert(it.quantity === 3, 'quantity incorrect after migrate: ' + it.quantity)
        })

        // 9) corrupt-but-recoverable save shape (missing optional containers)
        test('recoverable save: missing optional containers does not corrupt', () => {
            const partial = {
                meta: { schema: SAVE_SCHEMA, patch: GAME_PATCH, savedAt: 0 },
                player: { name: 'OK', classId: 'warrior', level: 1, hp: 5, maxHp: 10, gold: 0, resource: 0, maxResource: 0, inventory: [] },
                // Intentionally omit: villageEconomy, government, bank, village, merchantStock, sim, etc.
                time: null
            }
            const migrated = migrateSaveData(JSON.parse(JSON.stringify(partial)))
            assert(!(migrated && migrated.__corrupt), 'unexpected __corrupt flag')
            assert(migrated && migrated.player && migrated.meta, 'missing core fields after migrate')
        })


        // 9b) save roundtrip (mid-combat state preserved)
        test('save roundtrip: mid-combat preserves intent/posture/cooldowns', () => {
            const p = state.player
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null
            }

            try {
                state.inCombat = true
                state.currentEnemy = {
                    name: 'SaveCombat Dummy',
                    hp: 100,
                    maxHp: 100,
                    level: 5,
                    attack: 10,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    postureMax: 25,
                    posture: 7,
                    brokenTurns: 0,
                    stunTurns: 0,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: { heavyCleave: 2 },
                    intent: { aid: 'heavyCleave', turnsLeft: 1 }
                }
                ensureEnemyRuntime(state.currentEnemy)

                const blob = _buildSaveBlob()
                const migrated = migrateSaveData(JSON.parse(JSON.stringify(blob)))

                assert(migrated.inCombat === true, 'expected inCombat true after migrate')
                assert(migrated.currentEnemy && migrated.currentEnemy.name === 'SaveCombat Dummy', 'missing enemy after migrate')
                const e = migrated.currentEnemy
                assert(e.intent && e.intent.aid === 'heavyCleave', 'intent not preserved')
                assert(e.posture === 7, 'posture not preserved')
                assert(e.abilityCooldowns && e.abilityCooldowns.heavyCleave === 2, 'cooldown not preserved')
            } finally {
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
            }
        })

        // 9c) migration tolerates unknown keys (forward-compat)
        test('migration tolerates unknown keys (forward-compat)', () => {
            const blob = _buildSaveBlob()
            blob.__unknownRoot = { ok: true, nested: { n: 2 } }
            blob.player.__unknownPlayer = ['x', 'y']
            const migrated = migrateSaveData(JSON.parse(JSON.stringify(blob)))
            assert(!(migrated && migrated.__corrupt), 'migrate flagged corrupt due to unknown keys')
        })

        // 9d) forward-compat: combat objects missing newer fields initialize safely
        test('forward-compat: missing combat runtime fields initialize safely', () => {
            const legacy = _buildSaveBlob()
            legacy.inCombat = true
            legacy.currentEnemy = {
                name: 'Legacy Enemy',
                hp: 50,
                maxHp: 50,
                level: 3,
                attack: 9,
                magic: 0,
                armor: 1,
                magicRes: 0
                // Intentionally omit: intent, posture, postureMax, abilityCooldowns, abilities
            }

            const migrated = migrateSaveData(JSON.parse(JSON.stringify(legacy)))
            assert(migrated.currentEnemy && migrated.currentEnemy.name === 'Legacy Enemy', 'enemy missing after migrate')

            // ensureEnemyRuntime should be safe even when fields are missing
            ensureEnemyRuntime(migrated.currentEnemy)
            assert(typeof migrated.currentEnemy.postureMax === 'number', 'postureMax not initialized')
            assert(migrated.currentEnemy.abilityCooldowns && typeof migrated.currentEnemy.abilityCooldowns === 'object', 'abilityCooldowns not initialized')
        })

        section('Time & RNG')

        // 9a) time normalization guards (corrupt saves / dev tools)
        test('time normalization clamps day/part', () => {
            state.time = { dayIndex: -5, partIndex: 999 }
            const info = getTimeInfo(state)
            assert(info.absoluteDay === 0, 'expected dayIndex clamped to 0, got ' + info.absoluteDay)
            assert(info.partIndex === 2, 'expected partIndex clamped to 2, got ' + info.partIndex)
        })

        // 9b) time advance wraps correctly across day boundaries
        test('advanceTime wraps to next day', () => {
            state.time = { dayIndex: 0, partIndex: 0 }
            advanceTime(state, 3)
            assert(state.time.dayIndex === 1, 'expected dayIndex 1, got ' + state.time.dayIndex)
            assert(state.time.partIndex === 0, 'expected partIndex 0, got ' + state.time.partIndex)
        })

        // 9c) deterministic RNG repeatability under fixed seed
        test('deterministic RNG sequence is repeatable', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)

            const roll = () => {
                setRngSeed(state, 424242)
                state.debug.rngIndex = 0
                return [
                    rngFloat(state, 'smoke.rngFloat'),
                    rngInt(state, 1, 10, 'smoke.rngInt'),
                    rngPick(state, ['a', 'b', 'c'], 'smoke.rngPick')
                ]
            }

            const a = roll()
            const b = roll()
            assert(JSON.stringify(a) === JSON.stringify(b), 'expected repeatable sequence, got ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b))
        })

        // 9d) RNG log ring-buffer guard
        test('RNG log caps at 200 entries', () => {
            setDeterministicRngEnabled(state, true)
            setRngSeed(state, 1337)
            state.debug.rngIndex = 0
            setRngLoggingEnabled(state, true)

            for (let i = 0; i < 250; i++) rngFloat(state, 'smoke.cap')
            assert(Array.isArray(state.debug.rngLog), 'rngLog missing')
            assert(state.debug.rngLog.length === 200, 'expected rngLog length 200, got ' + state.debug.rngLog.length)
            const last = state.debug.rngLog[state.debug.rngLog.length - 1]
            assert(last && last.i === 249, 'expected last rngLog index 249, got ' + (last ? last.i : 'null'))

            setRngLoggingEnabled(state, false)
        })


section('Cheats & Leveling')

test('cheat: max level grants skill + talent points', () => {
    state.player = createPlayer('Cheater', 'mage', 'normal')
    const p = state.player
    ensurePlayerTalents(p)
    const startLevel = Number(p.level || 1)
    const startTalent = Number(p.talentPoints || 0)

    // Should not open modals during the suite.
    cheatMaxLevel({ openModal: false })

    assert(p.level === MAX_PLAYER_LEVEL, 'expected level ' + MAX_PLAYER_LEVEL + ', got ' + p.level)
    const expectedSkills = (MAX_PLAYER_LEVEL - startLevel)
    assert(p.skillPoints === expectedSkills, 'expected skillPoints ' + expectedSkills + ', got ' + p.skillPoints)

    let expectedTalents = startTalent
    for (let lv = startLevel + 1; lv <= MAX_PLAYER_LEVEL; lv++) {
        if (lv % 3 === 0) expectedTalents += 1
    }
    assert((p.talentPoints || 0) === expectedTalents, 'expected talentPoints ' + expectedTalents + ', got ' + (p.talentPoints || 0))
})
                section('Economy & Daily Ticks')

        // 10) daily ticks x3 (basic regression)
        test('daily ticks x3', () => {
            for (let i = 0; i < 3; i++) {
                advanceToNextMorning(state, { silent: true })
            }
            assert(typeof state.sim === 'object', 'sim container missing')
        })

        // 11) daily tick idempotence guard (same day does nothing)
        test('daily tick idempotence guard', () => {
            const day = state.time ? Math.floor(Number(state.time.dayIndex)) : 0
            // seed a tiny merchant stock so we can detect accidental extra ticks
            state.merchantStock = { village: { alchemist: { potionSmall: 1 } } }
            state.merchantStockMeta = { lastDayRestocked: day - 1 }
            state.sim = { lastDailyTickDay: day - 1 }

            runDailyTicks(state, day, { silent: true })
            const snap = JSON.stringify({ sim: state.sim, stock: state.merchantStock, meta: state.merchantStockMeta })
            runDailyTicks(state, day, { silent: true })
            const snap2 = JSON.stringify({ sim: state.sim, stock: state.merchantStock, meta: state.merchantStockMeta })
            assert(snap === snap2, 'state changed when ticking the same day twice')
        })

        // 12) day increments triggers exactly once (D -> D+1)
        test('daily tick increments once per day', () => {
            const d0 = state.time ? Math.floor(Number(state.time.dayIndex)) : 0
            state.merchantStock = { village: { alchemist: { potionSmall: 0 } } }
            state.merchantStockMeta = { lastDayRestocked: d0 - 1 }
            state.sim = { lastDailyTickDay: d0 - 1 }

            runDailyTicks(state, d0, { silent: true })
            const afterD0 = state.merchantStock.village.alchemist.potionSmall

            runDailyTicks(state, d0 + 1, { silent: true })
            const afterD1 = state.merchantStock.village.alchemist.potionSmall

            assert(afterD0 === 1, 'expected restock +1 on day D')
            assert(afterD1 === 2, 'expected restock +1 on day D+1')
        })

        section('Bank')

        // 12a) weekly interest applies after 7 days
        test('bank: weekly interest applies after 7 days', () => {
            initVillageEconomyState(state)
            initGovernmentState(state, 0)
            initTimeState(state)

            const today = Math.floor(Number(state.time.dayIndex) || 0)
            state.bank = {
                balance: 1000,
                investments: 1000,
                loan: { balance: 1000, baseRate: 0 },
                visits: 0,
                lastInterestDay: today - 7
            }

            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
            }

            openBankModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                recordInput: () => {},
                updateHUD: () => {},
                saveGame: () => {}
            })

            assert(state.bank.balance > 1000, 'expected savings interest to increase balance')
            assert(state.bank.investments > 1000, 'expected investment returns to increase investments')
            assert(state.bank.loan && state.bank.loan.balance > 1000, 'expected loan interest to increase loan balance')
            assert(state.bank.lastInterestDay === today, 'expected lastInterestDay to advance to today')
        })

        // 12b) guard: calendar rollback / future lastInterestDay should recalibrate without applying interest
        test('bank: future lastInterestDay recalibrates safely', () => {
            initTimeState(state)
            const today = Math.floor(Number(state.time.dayIndex) || 0)
            state.bank = {
                balance: 1000,
                investments: 0,
                loan: null,
                visits: 0,
                lastInterestDay: today + 999
            }

            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
            }

            openBankModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                recordInput: () => {},
                updateHUD: () => {},
                saveGame: () => {}
            })

            assert(state.bank.balance === 1000, 'expected no interest when recalibrating')
            assert(state.bank.lastInterestDay === today, 'expected lastInterestDay reset to today')
        })

        section('Town Hall & Decrees')

        test('town hall: cleanup removes expired effects', () => {
            initTimeState(state)
            initGovernmentState(state, 0)
            const today = Math.floor(Number(state.time.dayIndex) || 0)

            state.government = state.government || {}
            state.government.townHallEffects = {
                petitionId: 'smoke',
                title: 'Smoke Decree',
                expiresOnDay: today - 1,
                depositRateMultiplier: 2
            }

            cleanupTownHallEffects(state)
            assert(!state.government.townHallEffects, 'expected expired townHallEffects to be removed')

            // Active decree should remain
            state.government.townHallEffects = {
                petitionId: 'smoke2',
                title: 'Active Decree',
                expiresOnDay: today,
                depositRateMultiplier: 2
            }
            cleanupTownHallEffects(state)
            assert(!!state.government.townHallEffects, 'expected active townHallEffects to remain')
        })

        test('town hall modal builds (sandboxed)', () => {
            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
                assert(body.textContent && body.textContent.length > 0, 'expected some UI content')
            }

            openTownHallModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                handleGovernmentDayTick,
                handleEconomyDayTick,
                updateHUD: () => {},
                saveGame: () => {}
            })
        })

        section('Tavern & Gambling')

        test('tavern modal builds (sandboxed)', () => {
            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
                assert(body.querySelectorAll('button').length >= 1, 'expected at least one tavern action button')
            }

            openTavernModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                recordInput: () => {},
                getVillageEconomySummary,
                getRestCost,
                handleEconomyAfterPurchase,
                jumpToNextMorning,
                updateHUD: () => {},
                updateTimeDisplay: () => {},
                saveGame: () => {},
                closeModal: () => {},
                openGambleModal: () => {},
                questDefs: QUEST_DEFS,
                ensureQuestStructures: quests.ensureQuestStructures,
                startSideQuest: quests.startSideQuest,
                advanceSideQuest: quests.advanceSideQuest,
                completeSideQuest: quests.completeSideQuest,
                updateQuestBox: quests.updateQuestBox,
                setScene: () => {}
            })
        })

        test('gamble modal builds (sandboxed)', () => {
            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
                assert(body.querySelectorAll('button').length >= 1, 'expected at least one gambling action button')
            }

            openGambleModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                updateHUD: () => {},
                saveGame: () => {},
                closeModal: () => {},
                openTavernModal: () => {}
            })
        })

        section('Quests & Progression')

        test('quest lifecycle: ensure/init/start/advance/complete', () => {
            state.quests = null
            state.flags = null
            quests.ensureQuestStructures()
            assert(state.quests && typeof state.quests === 'object', 'quests missing after ensure')
            assert(state.flags && typeof state.flags === 'object', 'flags missing after ensure')

            quests.initMainQuest()
            assert(state.quests.main && state.quests.main.id === 'main', 'main quest not initialized')

            quests.startSideQuest('grainWhispers')
            assert(state.quests.side.grainWhispers && state.quests.side.grainWhispers.status === 'active', 'side quest not started')

            quests.advanceSideQuest('grainWhispers', 1)
            assert(state.quests.side.grainWhispers.step === 1, 'side quest did not advance to step 1')

            quests.completeSideQuest('grainWhispers', null)
            assert(state.quests.side.grainWhispers.status === 'completed', 'side quest did not complete')
        })

        test('progression audit report includes patch + schema', () => {
            const report = quests.buildProgressionAuditReport()
            assert(typeof report === 'string' && report.length > 20, 'audit report missing')
            assert(report.includes('Patch: ' + GAME_PATCH), 'audit report missing patch')
            assert(report.includes('schema ' + SAVE_SCHEMA), 'audit report missing schema')
        })

        section('Bug Report Bundle')

        test('bug report bundle serializes and includes patch info', () => {
            const bundle = buildBugReportBundle()
            const json = JSON.stringify(bundle)
            assert(typeof json === 'string' && json.length > 0, 'bundle did not serialize')
            assert(bundle && bundle.summary && bundle.summary.patch === GAME_PATCH, 'bundle patch mismatch')
            assert(bundle.summary.saveSchema === SAVE_SCHEMA, 'bundle schema mismatch')
        })

        section('Merchants')

        // 13) merchant prune invalid keys + buy flow (DOM-free via stub openModal)
        test('merchant stock pruning + purchase effects', () => {
            const p = state.player
            p.inventory = []
            p.gold = 999

            // Inject a ghost key into the alchemist bucket (should be pruned).
            state.merchantStock = { village: { alchemist: { potionSmall: 2, __ghostKey__: 9 } } }
            state.merchantStockMeta = state.merchantStockMeta || { lastDayRestocked: null }

            const modalStack = []
            const openModalStub = (title, builder) => {
                const body = document.createElement('div')
                modalStack.push({ title, body })
                builder(body)
            }
            const addLogStub = () => {}
            const recordInputStub = () => {}

            openMerchantModalImpl({
                context: 'village',
                state,
                openModal: openModalStub,
                addLog: addLogStub,
                recordInput: recordInputStub,
                getVillageEconomySummary,
                getMerchantPrice,
                handleEconomyAfterPurchase,
                cloneItemDef,
                addItemToInventory,
                updateHUD: () => {},
                saveGame: () => {}
            })

            assert(modalStack.length >= 1, 'merchant hub did not open')
            const hubBody = modalStack[0].body
            const visitButtons = Array.from(hubBody.querySelectorAll('button')).filter((b) => (b.textContent || '').toLowerCase().includes('visit'))
            assert(visitButtons.length >= 3, 'expected village merchant hub visit buttons')

            // Click the 3rd merchant (alchemist)
            visitButtons[2].click()
            assert(modalStack.length >= 2, 'alchemist shop did not open')

            // After opening the shop, ghost key should be pruned.
            assert(!('__ghostKey__' in state.merchantStock.village.alchemist), 'ghost key not pruned')

            const shopBody = modalStack[1].body
            const buyButtons = Array.from(shopBody.querySelectorAll('button')).filter((b) => (b.textContent || '').toLowerCase() === 'buy')
            assert(buyButtons.length >= 1, 'no buy button found')

            const beforeGold = p.gold
            const beforeQty = (p.inventory.find((it) => it && it.id === 'potionSmall') || {}).quantity || 0
            buyButtons[0].click()

            const afterQty = (p.inventory.find((it) => it && it.id === 'potionSmall') || {}).quantity || 0
            assert(afterQty === beforeQty + 1, 'inventory did not increase after buy')

            // Price is economy-aware; recompute expected for potionSmall.
            const def = cloneItemDef('potionSmall')
            const expectedPrice = Math.max(1, Math.floor(getMerchantPrice(def.price || 0, state, 'village')))
            assert(p.gold === beforeGold - expectedPrice, 'gold did not decrease by expected price')
            assert(state.merchantStock.village.alchemist.potionSmall === 1, 'stock did not decrement after buy')
        })

        // 14) merchant restock caps + day guard (direct tick)
        test('merchant restock caps + day-guard', () => {
            const d0 = state && state.time && typeof state.time.dayIndex === 'number'
                ? Math.floor(Number(state.time.dayIndex))
                : 0

            state.merchantStock = {
                village: {
                    blacksmith: {
                        potionSmall: 0,
                        armorLeather: 0
                    }
                }
            }
            state.merchantStockMeta = { lastDayRestocked: d0 - 1 }

            handleMerchantDayTick(state, d0, cloneItemDef)
            const b0 = state.merchantStock.village.blacksmith
            assert(b0.potionSmall === 1 && b0.armorLeather === 1, 'restock did not increment')

            handleMerchantDayTick(state, d0, cloneItemDef)
            assert(b0.potionSmall === 1 && b0.armorLeather === 1, 'restock ran twice same day')

            handleMerchantDayTick(state, d0 + 1, cloneItemDef)
            assert(b0.potionSmall === 2 && b0.armorLeather === 2, 'next-day increment/cap failed')

            b0.armorLeather = 99
            handleMerchantDayTick(state, d0 + 2, cloneItemDef)
            assert(b0.armorLeather === 2, 'cap enforcement failed')
        })

        // 15) duplicate-item unequip correctness (reference-first, safe fallback)
        test('duplicate unequip (instance-safe)', () => {
            const p = state.player
            p.inventory = []
            const a = cloneItemDef('armorLeather')
            const b = cloneItemDef('armorLeather')
            assert(a && b && a.id === b.id, 'cloneItemDef did not return comparable items')

            p.inventory.push(a)
            p.inventory.push(b)
            p.equipment.armor = a

            const changedWrong = unequipItemIfEquipped(p, b)
            assert(!changedWrong, 'unequipped the wrong duplicate')
            assert(p.equipment.armor === a, 'equipment changed when operating on different copy')

            const changedRight = unequipItemIfEquipped(p, a)
            assert(changedRight, 'did not unequip the correct instance')
            assert(p.equipment.armor === null, 'equipment slot not cleared')
        })

        section('Loot Generation')

        // 16) pickWeighted safety (empty/zero weights)
        test('loot pickWeighted safety', () => {
            const a = pickWeighted([])
            assert(a === null, 'expected null for empty')
            const b = pickWeighted([['x', 0], ['y', 0]])
            assert(b === 'x', 'expected first item when total weight <= 0')
        })

        // 17) loot generator outputs valid items (no NaN/undefined)
        test('loot generator validity (generated items)', () => {
            // Freeze Date.now so generated IDs are deterministic.
            const oldNow = Date.now
            Date.now = () => 1700000000000
            try {
                setRngSeed(state, 424242)
                state.debug.rngIndex = 0
                for (let i = 0; i < 15; i++) {
                    const drops = generateLootDrop({
                        area: 'forest',
                        playerLevel: 5,
                        enemy: null,
                        playerResourceKey: 'mana'
                    })
                    assert(Array.isArray(drops) && drops.length >= 1, 'no drops generated')
                    drops.forEach((it) => {
                        assert(it && typeof it === 'object', 'drop is not an object')
                        assert(typeof it.id === 'string' && it.id.length, 'drop id missing')
                        assert(typeof it.name === 'string' && it.name.length, 'drop name missing')
                        assert(['potion', 'weapon', 'armor'].includes(it.type), 'drop type invalid: ' + it.type)
                        assert(isFiniteNum(it.price || 0), 'drop price invalid')
                        assert(isFiniteNum(it.itemLevel || 1), 'drop itemLevel invalid')
                    })
                }
            } finally {
                Date.now = oldNow
            }
        })

        // 18) deterministic loot (same seed, same results)
        test('loot determinism (same seed)', () => {
            const oldNow = Date.now
            Date.now = () => 1700000000000
            try {
                const roll = () => {
                    setRngSeed(state, 9001)
                    state.debug.rngIndex = 0
                    return generateLootDrop({
                        area: 'forest',
                        playerLevel: 7,
                        enemy: { isElite: true },
                        playerResourceKey: 'mana'
                    })
                }
                const a = roll()
                const b = roll()
                assert(JSON.stringify(a) === JSON.stringify(b), 'loot mismatch under same seed')
            } finally {
                Date.now = oldNow
            }
        })

        section('UI Guards')

        // 19) switchScreen crash guard (missing DOM nodes)
        test('switchScreen ignores missing DOM nodes', () => {
            return withUiEnabled(() => {
            // IMPORTANT: this test should never leave the real UI blank.
            // Snapshot current screen visibility and audio behavior, then restore.
            const screenSnap = Object.keys(screens || {})
                .map((k) => ({ k, el: screens[k] }))
                .filter((x) => x.el && x.el.classList)
                .map((x) => ({ k: x.k, el: x.el, hidden: x.el.classList.contains('hidden') }))

            const oldMain = screens.mainMenu
            const oldSettings = screens.settings

            const oldPlayMusicTrack = typeof playMusicTrack === 'function' ? playMusicTrack : null
            const oldInteriorOpen = audioState ? audioState.interiorOpen : null

            // Prevent this test from stopping/starting music on real devices.
            if (oldPlayMusicTrack) playMusicTrack = () => {}

            screens.mainMenu = null
            screens.settings = null
            try {
                switchScreen('game')
                // This intentionally targets a missing screen node.
                switchScreen('settings')
            } finally {
                screens.mainMenu = oldMain
                screens.settings = oldSettings

                // Restore audio behavior.
                if (oldPlayMusicTrack) playMusicTrack = oldPlayMusicTrack
                if (audioState && oldInteriorOpen !== null) audioState.interiorOpen = oldInteriorOpen

                // Restore original screen hidden states so the UI isn't left blank.
                screenSnap.forEach((s) => {
                    try {
                        if (s.hidden) s.el.classList.add('hidden')
                        else s.el.classList.remove('hidden')
                    } catch (_) {}
                })
            }
            })
        })


        // UI: dev-only HUD pills visibility toggles with cheats flag
        test('UI: dev HUD pills visibility toggles', () => {
            return withUiEnabled(() => {
            const testsBtn = document.getElementById('btnSmokeTestsPill')
            const cheatBtn = document.getElementById('btnCheatPill')
            assert(!!testsBtn, 'btnSmokeTestsPill missing from DOM')
            assert(!!cheatBtn, 'btnCheatPill missing from DOM')

            const prev = !!(state && state.flags && state.flags.devCheatsEnabled)
            state.flags.devCheatsEnabled = false
            syncSmokeTestsPillVisibility()
            assert(testsBtn.classList.contains('hidden'), 'tests pill should hide when cheats disabled')
            assert(cheatBtn.classList.contains('hidden'), 'cheats pill should hide when cheats disabled')

            state.flags.devCheatsEnabled = true
            syncSmokeTestsPillVisibility()
            assert(!testsBtn.classList.contains('hidden'), 'tests pill should show when cheats enabled')
            assert(!cheatBtn.classList.contains('hidden'), 'cheats pill should show when cheats enabled')

            state.flags.devCheatsEnabled = prev
            syncSmokeTestsPillVisibility()
            })
        })

        // UI: cheat menu can build in a sandboxed modal (no DOM lockups)
        test('UI: cheat menu builder is safe (sandboxed modal)', () => {
            const prevAdapter = typeof getModalAdapter === 'function' ? getModalAdapter() : null
            const calls = { opened: 0, closed: 0, title: '', body: null }
            try {
                if (typeof setModalAdapter === 'function') {
                    setModalAdapter({
                        openModal: (title, builder) => {
                            calls.opened += 1
                            calls.title = String(title || '')
                            const body = document.createElement('div')
                            calls.body = body
                            if (typeof builder === 'function') builder(body)
                        },
                        closeModal: () => {
                            calls.closed += 1
                        }
                    })
                }

                // Must not throw
                openCheatMenu()

                assert(calls.opened >= 1, 'expected cheat menu to open a modal')
                assert(calls.title.toLowerCase().includes('cheat'), 'unexpected modal title: ' + calls.title)
                assert(calls.body && calls.body.querySelectorAll('button').length > 0, 'expected cheat modal to render buttons')
            } finally {
                try {
                    if (typeof setModalAdapter === 'function') setModalAdapter(prevAdapter)
                } catch (_) {}
            }
        })

	        // UI: character sheet modal builds (guards against missing template vars)
	        test('UI: character sheet modal builds (sandboxed)', () => {
	            const prevAdapter = typeof getModalAdapter === 'function' ? getModalAdapter() : null
	            const calls = { opened: 0, title: '', body: null }
	            try {
	                if (typeof setModalAdapter === 'function') {
	                    setModalAdapter({
	                        openModal: (title, builder) => {
	                            calls.opened += 1
	                            calls.title = String(title || '')
	                            const body = document.createElement('div')
	                            calls.body = body
	                            if (typeof builder === 'function') builder(body)
	                        }
	                    })
	                }

	                state.player = createPlayer('SheetTester', 'mage', 'normal')
	                _recalcPlayerStats()
	                // Must not throw
	                openCharacterSheet()

	                assert(calls.opened >= 1, 'expected character sheet to open a modal')
	                assert(calls.title.toLowerCase().includes('character'), 'unexpected modal title: ' + calls.title)
	                assert(!!(calls.body && calls.body.querySelector('.sheet-element-bonuses')), 'expected elemental bonus node')
	                assert(!!(calls.body && calls.body.querySelector('.sheet-element-resists')), 'expected elemental resist node')
	            } finally {
	                try {
	                    if (typeof setModalAdapter === 'function') setModalAdapter(prevAdapter)
	                } catch (_) {}
	            }
	        })



        // UI: enemy panel opens an Enemy Sheet modal (sandboxed)
        test('UI: enemy sheet modal builds (enemy panel click)', () => {
            return withUiEnabled(() => {
            const enemyPanel = document.getElementById('enemyPanel')
            const modal = document.getElementById('enemyModal')
            const modalTitle = document.getElementById('enemyModalTitle')

            assert(!!enemyPanel, 'enemyPanel missing from DOM')
            assert(!!modal, 'enemyModal missing from DOM')
            assert(!!modalTitle, 'enemyModalTitle missing from DOM')

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null
            }

            try {
                state.inCombat = true
                state.currentEnemy = {
                    name: 'Sheet Dummy',
                    level: 12,
                    hp: 120,
                    maxHp: 120,
                    attack: 16,
                    magic: 8,
                    armor: 2,
                    magicRes: 2,
                    xp: 12,
                    goldMin: 6,
                    goldMax: 9,
                    abilities: ['enemyStrike']
                }
                ensureEnemyRuntime(state.currentEnemy)
                applyEnemyRarity(state.currentEnemy)
                updateEnemyPanel()

                // Click should open a real modal in the live DOM.
                enemyPanel.click()

                assert(!modal.classList.contains('hidden'), 'expected modal to be visible')
                assert(modalTitle.textContent.includes('Enemy Sheet'), 'unexpected modal title: ' + modalTitle.textContent)

                // Close to avoid leaking UI state into later tests
                closeEnemyModal()
            } finally {
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                updateEnemyPanel()
                try { closeEnemyModal() } catch (_) {}
            }
            })
        })
        section('Combat')

        // 20) combat sanity: damage/heal never NaN and HP clamped
        test('combat sanity (damage/heal finite + clamped)', () => {
            const p = state.player

            // Snapshot combat state so this test can't leak dummy enemies or HP changes.
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp,
                playerMaxHp: p.maxHp,
                playerClassId: p.classId,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName,
                playerResource: p.resource,
                playerMaxResource: p.maxResource,
                spells: Array.isArray(p.spells) ? [...p.spells] : [],
                equippedSpells: Array.isArray(p.equippedSpells) ? [...p.equippedSpells] : []
            }

            // Temporarily switch to a paladin so we have a heal spell available.
            p.classId = 'paladin'
            p.resourceKey = 'mana'
            p.resourceName = 'Mana'
            p.maxResource = 100
            p.resource = 100
            p.spells = ['holyStrike', 'blessingLight', 'retributionAura']
            p.equippedSpells = ['holyStrike', 'blessingLight', 'retributionAura']
            ensurePlayerSpellSystems(p)
            _recalcPlayerStats()

            // Prevent any combat AI from acting (enemyTurn can damage the player and
            // can update live UI if it isn't stubbed).
            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null
            const _handleEnemyDefeat = typeof handleEnemyDefeat === 'function' ? handleEnemyDefeat : null

            if (_enemyTurn) enemyTurn = () => {}
            if (_companionAct) companionActIfPresent = () => {}
            if (_handleEnemyDefeat)
                handleEnemyDefeat = () => {
                    state.inCombat = false
                    state.currentEnemy = null
                }

            try {
                state.inCombat = true
                state.currentEnemy = { name: 'Dummy', hp: 120, maxHp: 120, armor: 0, magicRes: 0, tier: 1 }

                // Basic attack (should not trigger enemy retaliation during smoke tests)
                playerBasicAttack()
                assert(isFiniteNum(state.currentEnemy.hp), 'enemy hp became non-finite')
                assert(state.currentEnemy.hp >= 0 && state.currentEnemy.hp <= 120, 'enemy hp out of bounds')

                // Ability damage
                const ctx = buildAbilityContext(p, 'holyStrike')
                _setPlayerAbilityContext(ctx)
                ABILITY_EFFECTS.holyStrike(p, state.currentEnemy, ctx)
                _setPlayerAbilityContext(null)
                assert(isFiniteNum(state.currentEnemy.hp), 'enemy hp became non-finite after ability')

                // Healing
                p.hp = Math.max(1, p.maxHp - 50)
                const hctx = buildAbilityContext(p, 'blessingLight')
                ABILITY_EFFECTS.blessingLight(p, state.currentEnemy, hctx)
                assert(isFiniteNum(p.hp), 'player hp became non-finite after heal')
                assert(p.hp >= 0 && p.hp <= p.maxHp, 'player hp not clamped')
            } finally {
                // Restore combat hooks
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                if (_handleEnemyDefeat) handleEnemyDefeat = _handleEnemyDefeat

                // Restore the test state to its pre-combat values.
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
                if (p.status) {
                    p.status.shield = snap.playerShield
                    p.status.evasionTurns = snap.playerEvasionTurns
                }
                if (p.stats) p.stats.dodgeChance = snap.playerDodgeChance
                p.maxHp = snap.playerMaxHp
                p.classId = snap.playerClassId
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
                p.spells = [...snap.spells]
                p.equippedSpells = [...snap.equippedSpells]
            }
        })

        // 20a) AoE abilities: multi-enemy damage should affect more than the primary target.
        test('combat: AoE (Cleave) damages multiple enemies', () => {
            const p = state.player

            // Set up a warrior with Cleave.
            p.classId = 'warrior'
            p.resourceKey = 'fury'
            p.resourceName = 'Fury'
            p.maxResource = 60
            p.resource = 60
            p.spells = ['powerStrike', 'battleCry', 'shieldWall', 'cleave']
            p.equippedSpells = ['cleave']
            ensurePlayerSpellSystems(p)
            _recalcPlayerStats()

            // Disable crit variance for deterministic assertions.
            if (p.stats) {
                p.stats.critChance = 0
                p.stats.critDamage = 0
            }

            // Multi-enemy encounter.
            const e1 = { name: 'E1', hp: 120, maxHp: 120, armor: 0, magicRes: 0, tier: 1 }
            const e2 = { name: 'E2', hp: 120, maxHp: 120, armor: 0, magicRes: 0, tier: 1 }
            const e3 = { name: 'E3', hp: 120, maxHp: 120, armor: 0, magicRes: 0, tier: 1 }
            state.inCombat = true
            state.enemies = [e1, e2, e3]
            state.currentEnemy = e1
            state.targetEnemyIndex = 0

            const ctx = buildAbilityContext(p, 'cleave')
            _setPlayerAbilityContext(ctx)
            ABILITY_EFFECTS.cleave(p, e1, ctx)
            _setPlayerAbilityContext(null)

            assert(e1.hp < e1.maxHp, 'primary target did not take damage')
            assert(e2.hp < e2.maxHp && e3.hp < e3.maxHp, 'expected splash damage to hit other enemies')
        })

        test('combat: AoE (Blood Nova) damages and bleeds the group', () => {
            const p = state.player

            p.classId = 'blood'
            p.resourceKey = 'blood'
            p.resourceName = 'Blood'
            p.maxResource = 80
            p.resource = 80
            p.stats.magic = Math.max(10, p.stats.magic)
            p.spells = ['bloodSlash', 'leech', 'hemorrhage', 'bloodNova']
            p.equippedSpells = ['bloodNova']
            ensurePlayerSpellSystems(p)
            _recalcPlayerStats()

            if (p.stats) {
                p.stats.critChance = 0
                p.stats.critDamage = 0
            }

            const e1 = { name: 'E1', hp: 140, maxHp: 140, armor: 0, magicRes: 0, tier: 1 }
            const e2 = { name: 'E2', hp: 140, maxHp: 140, armor: 0, magicRes: 0, tier: 1 }
            state.inCombat = true
            state.enemies = [e1, e2]
            state.currentEnemy = e1
            state.targetEnemyIndex = 0

            const ctx = buildAbilityContext(p, 'bloodNova')
            _setPlayerAbilityContext(ctx)
            ABILITY_EFFECTS.bloodNova(p, e1, ctx)
            _setPlayerAbilityContext(null)

            assert(e1.hp < e1.maxHp && e2.hp < e2.maxHp, 'expected both enemies to take damage')
            assert((e1.bleedTurns || 0) > 0 && (e2.bleedTurns || 0) > 0, 'expected bleed on both enemies')
        })

        test('combat: AoE (Meteor Sigil) splashes when multiple enemies present', () => {
            const p = state.player

            p.classId = 'mage'
            p.resourceKey = 'mana'
            p.resourceName = 'Mana'
            p.maxResource = 100
            p.resource = 100
            p.stats.magic = Math.max(12, p.stats.magic)
            p.spells = ['fireball', 'iceShard', 'arcaneShield', 'meteorSigil']
            p.equippedSpells = ['meteorSigil']
            ensurePlayerSpellSystems(p)
            _recalcPlayerStats()

            if (p.stats) {
                p.stats.critChance = 0
                p.stats.critDamage = 0
            }

            const e1 = { name: 'E1', hp: 160, maxHp: 160, armor: 0, magicRes: 0, tier: 1 }
            const e2 = { name: 'E2', hp: 160, maxHp: 160, armor: 0, magicRes: 0, tier: 1 }
            const e3 = { name: 'E3', hp: 160, maxHp: 160, armor: 0, magicRes: 0, tier: 1 }
            state.inCombat = true
            state.enemies = [e1, e2, e3]
            state.currentEnemy = e2
            state.targetEnemyIndex = 1

            const ctx = buildAbilityContext(p, 'meteorSigil')
            _setPlayerAbilityContext(ctx)
            ABILITY_EFFECTS.meteorSigil(p, e2, ctx)
            _setPlayerAbilityContext(null)

            assert(e2.hp < e2.maxHp, 'target did not take damage')
            assert(e1.hp < e1.maxHp && e3.hp < e3.maxHp, 'expected splash damage to hit non-targets')
        })

        
        
        // Patch 1.2.0 systems: talents, status synergies, enemy affinities, equipment traits
        section('Patch 1.2.0 Systems')

        test('talents: Mage Rhythm Mastery lowers Rhythm threshold to 2', () => {
            const p = state.player
            p.classId = 'mage'
            p.resourceKey = 'mana'
            p.resourceName = 'Mana'
            p.maxResource = 100
            p.resource = 100
            p.level = 3
            ensurePlayerSpellSystems(p)
            ensurePlayerTalents(p)
            p.talentPoints = 1
            p.talents = {}
            p.status = p.status || {}
            p.status.spellCastCount = 0

            // Without the talent: 2nd cast should NOT be active (threshold 3)
            let r0 = _getMageRhythmBonus(p, ABILITIES.fireball, 'fireball')
            assert(!r0.active, 'unexpected Rhythm active at cast 1 without talent')
            p.status.spellCastCount = 1
            let r1 = _getMageRhythmBonus(p, ABILITIES.fireball, 'fireball')
            assert(!r1.active, 'unexpected Rhythm active at cast 2 without talent')

            // Unlock talent: 2nd cast should now be active
            p.status.spellCastCount = 0
            const ok = unlockTalent(p, 'mage_rhythm_mastery')
            assert(ok, 'failed to unlock mage_rhythm_mastery')
            p.status.spellCastCount = 1
            let r2 = _getMageRhythmBonus(p, ABILITIES.fireball, 'fireball')
            assert(r2.active, 'expected Rhythm active at cast 2 with talent')
        })

        test('status synergy: Bleed + Fire ignites the enemy (Burning applied)', () => {
            const enemy = { name: 'Synergy Dummy', hp: 100, maxHp: 100, bleedTurns: 2, bleedDamage: 5 }
            applyStatusSynergyOnPlayerHit(enemy, 50, 'fire', 'magic')
            assert((enemy.burnTurns || 0) > 0, 'expected burning turns > 0')
            assert((enemy.burnDamage || 0) >= 2, 'expected burn damage to be set')
        })

        test('status synergy: Chilled + Physical triggers Shatter and consumes Chill', () => {
            const enemy = { name: 'Chill Dummy', hp: 100, maxHp: 100, chilledTurns: 2 }
            const before = enemy.hp
            applyStatusSynergyOnPlayerHit(enemy, 40, null, 'physical')
            assert(enemy.hp < before, 'expected shatter burst damage to reduce hp')
            assert((enemy.chilledTurns || 0) === 0, 'expected chill to be consumed')
        })

        test('enemy affinities: weakness/resistance multipliers resolve correctly', () => {
            const enemy = { affinities: { weak: { fire: 1.25 }, resist: { frost: 0.85 } } }
            assert(getEnemyAffinityMultiplier(enemy, 'fire') === 1.25, 'fire weakness multiplier mismatch')
            assert(getEnemyAffinityMultiplier(enemy, 'frost') === 0.85, 'frost resist multiplier mismatch')
            assert(getEnemyAffinityMultiplier(enemy, 'shadow') === 1, 'unexpected multiplier for unrelated element')
        })

        test('enemy affinities: percent-style values + synonym keys normalize correctly', () => {
            // Some authored content stores affinity deltas as percents (15/-13) and uses synonym keys (Ice/Storm).
            const e1 = { affinities: { weak: { Fire: 15 }, resist: {} } }
            const e2 = { affinities: { weak: {}, resist: { FROST: -13 } } }
            const e3 = { affinities: { weak: { Ice: 0.12 }, resist: { Storm: -0.10 } } }

            const fire = getEnemyAffinityMultiplier(e1, 'fire')
            const frost = getEnemyAffinityMultiplier(e2, 'frost')
            const ice = getEnemyAffinityMultiplier(e3, 'ice')
            const lightning = getEnemyAffinityMultiplier(e3, 'lightning')

            assert(Math.abs(fire - 1.15) < 0.0001, 'expected fire 15% -> 1.15, got ' + String(fire))
            assert(Math.abs(frost - 0.87) < 0.0001, 'expected frost -13% -> 0.87, got ' + String(frost))
            assert(Math.abs(ice - 1.12) < 0.0001, 'expected Ice 0.12 -> 1.12, got ' + String(ice))
            assert(Math.abs(lightning - 0.90) < 0.0001, 'expected Storm -0.10 -> 0.90, got ' + String(lightning))
        })

        test('element system: affinity + flat resist stack multiplicatively (magic)', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') rand = () => 0.5 // variance = 1.0

            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = {
                name: 'Stack Dummy',
                hp: 999,
                maxHp: 999,
                armor: 0,
                magicRes: 0,
                affinities: { weak: { fire: 1.15 } },
                elementalResists: { fire: 50 }
            }

            // Ensure no player bonuses interfere.
            p.stats = p.stats || {}
            const snapBonuses = p.stats.elementalBonuses
            p.stats.elementalBonuses = {}

            const dmg = calcMagicDamage(100, 'fire')
            // 100 * 1.15 * (1 - 0.50) = 57.5 -> rounds to 58
            assert(dmg === 58, 'expected stacked damage 58, got ' + String(dmg))

            // cleanup
            p.stats.elementalBonuses = snapBonuses
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: affinity + flat resist stack multiplicatively (physical)', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') rand = () => 0.5 // variance = 1.0

            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = {
                name: 'Stack Dummy (Phys)',
                hp: 999,
                maxHp: 999,
                armor: 0,
                magicRes: 0,
                affinities: { weak: { fire: 1.15 } },
                elementalResists: { fire: 50 }
            }

            // Ensure no player bonuses interfere.
            p.stats = p.stats || {}
            const snapBonuses = p.stats.elementalBonuses
            p.stats.elementalBonuses = {}

            const dmg = calcPhysicalDamage(100, 'fire')
            assert(dmg === 58, 'expected stacked physical damage 58, got ' + String(dmg))

            p.stats.elementalBonuses = snapBonuses
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: enemy flat resist accepts fraction values (0.5 = 50%)', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') rand = () => 0.5

            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = { name: 'Frac Dummy', hp: 999, maxHp: 999, armor: 0, magicRes: 0, affinities: {}, elementalResists: { fire: 0.5 } }

            p.stats = p.stats || {}
            const snapBonuses = p.stats.elementalBonuses
            p.stats.elementalBonuses = {}

            const dmg = calcMagicDamage(100, 'fire')
            assert(dmg === 50, 'expected 50% flat resist from 0.5, got ' + String(dmg))

            p.stats.elementalBonuses = snapBonuses
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('damage breakdown formatting includes affinity + flat resist and never prints "resist 0%"', () => {
            const s1 = formatDamageBreakdownForLog({ damageType: 'magic', elementType: 'fire', affinityMult: 1.15, enemyResistPct: 25, effectiveRes: 0, penPct: 0 })
            assert(s1.indexOf('weak +15%') >= 0, 'expected weak tag in breakdown: ' + s1)
            assert(s1.indexOf('flat resist 25%') >= 0, 'expected flat resist tag in breakdown: ' + s1)

            const s2 = formatDamageBreakdownForLog({ damageType: 'magic', elementType: 'frost', affinityMult: 0.87, enemyResistPct: 0 })
            assert(s2.indexOf('resist -13%') >= 0, 'expected resist tag in breakdown: ' + s2)
            assert(s2.indexOf('resist 0%') < 0, 'should not print resist 0%: ' + s2)
        })

        test('element system: magic damage applies enemy affinity multiplier', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null

            // Make deterministic: remove variance + crit
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = { name: 'Affinity Dummy', hp: 999, maxHp: 999, armor: 0, magicRes: 0, affinities: { weak: { fire: 1.25 } } }

            // Ensure no player element bonuses interfere.
            p.stats = p.stats || {}
            p.stats.elementalBonuses = {}

            const base = 40
            const dmgWeak = calcMagicDamage(base, 'fire')
            const dmgNorm = calcMagicDamage(base, 'arcane')
            assert(dmgWeak >= Math.round(dmgNorm * 1.20), 'expected weakness to noticeably increase damage')

            // restore
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: player elemental resist reduces incoming elemental magic', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            p.stats = p.stats || {}
            const snapRes = p.stats.elementalResists
            p.stats.elementalResists = { shadow: 50 }

            const base = 40
            const dmgResisted = calcEnemyDamage(base, 'shadow')
            p.stats.elementalResists = {}
            const dmgUnresisted = calcEnemyDamage(base, 'shadow')
            assert(dmgResisted <= Math.round(dmgUnresisted * 0.55), 'expected ~50% reduction from elemental resist')

            p.stats.elementalResists = snapRes
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: player elemental resist reduces incoming elemental physical', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            p.stats = p.stats || {}
            const snapRes = p.stats.elementalResists
            const snapArmor = p.stats.armor
            const snapMres = p.stats.magicRes

            // Remove other mitigation so the test isolates elemental resist.
            p.stats.armor = 0
            p.stats.magicRes = 0

            p.stats.elementalResists = { shadow: 50 }

            const base = 40
            const dmgResisted = calcEnemyDamage(base, { damageType: 'physical', elementType: 'shadow' })
            p.stats.elementalResists = {}
            const dmgUnresisted = calcEnemyDamage(base, { damageType: 'physical', elementType: 'shadow' })
            assert(dmgResisted <= Math.round(dmgUnresisted * 0.55), 'expected ~50% reduction from elemental resist (physical)')

            p.stats.elementalResists = snapRes
            p.stats.armor = snapArmor
            p.stats.magicRes = snapMres
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('enemy abilities: damage inherits enemy offensive element when missing', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            p.stats = p.stats || {}
            const snapRes = p.stats.elementalResists
            const snapArmor = p.stats.armor
            const snapMres = p.stats.magicRes
            const snapHp = p.hp
            const snapMaxHp = p.maxHp
            const snapStatus = JSON.parse(JSON.stringify(p.status || {}))
            const snapEnemy = state.currentEnemy

            // Remove other mitigation so the test isolates elemental resist.
            p.stats.armor = 0
            p.stats.magicRes = 0

            p.maxHp = Math.max(Number(p.maxHp || 0), 999)
            p.hp = p.maxHp

            const enemy = { id: 'testEnemy', name: 'Test Enemy', attack: 40, magic: 0, hp: 100, maxHp: 100, affixes: [], abilities: ['sunderArmor'] }
            ensureEnemyRuntime(enemy)
            enemy.attackElementType = 'shadow'
            enemy.magicElementType = 'shadow'
            state.currentEnemy = enemy

            // Resisted hit
            p.stats.elementalResists = { shadow: 50 }
            const before1 = p.hp
            applyEnemyAbilityToPlayer(enemy, p, 'sunderArmor')
            const dmgResisted = before1 - p.hp
            const b1 = state._lastDamageBreakdown || null
            assert(b1 && b1.elementType === 'shadow', 'expected inherited element on enemy hit, got ' + String(b1 && b1.elementType))

            // Unresisted hit
            p.hp = before1
            p.stats.elementalResists = {}
            p.status = JSON.parse(JSON.stringify(snapStatus || {}))
            const before2 = p.hp
            applyEnemyAbilityToPlayer(enemy, p, 'sunderArmor')
            const dmgUnresisted = before2 - p.hp

            assert(dmgResisted <= Math.round(dmgUnresisted * 0.55), 'expected ~50% reduction from elemental resist on inherited elemental physical hit')

            // Restore
            state.currentEnemy = snapEnemy
            p.stats.elementalResists = snapRes
            p.stats.armor = snapArmor
            p.stats.magicRes = snapMres
            p.hp = snapHp
            p.maxHp = snapMaxHp
            p.status = snapStatus
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: enemy elemental resist reduces incoming elemental magic', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = { name: 'Resist Dummy', hp: 999, maxHp: 999, armor: 0, magicRes: 0, affinities: {}, elementalResists: {} }

            const snapClass = p.classId
            p.classId = 'warrior'
            p.stats = p.stats || {}
            const snapBonuses = p.stats.elementalBonuses
            p.stats.elementalBonuses = {}

            const base = 40
            state.currentEnemy.elementalResists = {}
            const dmgUnresisted = calcMagicDamage(base, 'fire')
            state.currentEnemy.elementalResists = { fire: 50 }
            const dmgResisted = calcMagicDamage(base, 'fire')
            assert(dmgResisted <= Math.round(dmgUnresisted * 0.55), 'expected ~50% reduction from enemy elemental resist')

            // restore
            p.classId = snapClass
            p.stats.elementalBonuses = snapBonuses
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('equipment traits: on-hit bleed trait applies bleed', () => {
            const p = state.player
            p.equipment = p.equipment || {}
            // Force 100% chance for deterministic test
            p.equipment.weapon = { name: 'Trait Sword', bleedChance: 1, bleedTurns: 3, bleedDmgPct: 0.2 }
            const enemy = { name: 'Bleed Dummy', hp: 100, maxHp: 100 }
            applyEquipmentOnPlayerHit(enemy, 30, null, 'physical')
            assert((enemy.bleedTurns || 0) >= 1, 'expected bleed turns to be applied')
            assert((enemy.bleedDamage || 0) >= 1, 'expected bleed damage to be applied')
        })

        test('elemental stats: gear elemental resists apply to player stats', () => {
            const p = state.player
            const snap = {
                equipment: JSON.parse(JSON.stringify(p.equipment || {})),
                classId: p.classId,
                level: p.level,
                talents: JSON.parse(JSON.stringify(p.talents || {})),
            }

            p.equipment = p.equipment || {}
            p.equipment.armor = Object.assign({}, ITEM_DEFS.robeApprentice)
            _recalcPlayerStats()
            const v = p.stats && p.stats.elementalResists ? (p.stats.elementalResists.arcane || 0) : 0
            if (!(v > 0)) throw new Error('expected arcane resist from robeApprentice')

            p.equipment = snap.equipment
            p.classId = snap.classId
            p.level = snap.level
            p.talents = snap.talents
            _recalcPlayerStats()
        })

        test('elemental stats: talent elemental resist applies to player stats', () => {
            const p = state.player
            const snap = {
                equipment: JSON.parse(JSON.stringify(p.equipment || {})),
                classId: p.classId,
                level: p.level,
                talents: JSON.parse(JSON.stringify(p.talents || {})),
            }

            p.classId = 'warrior'
            p.level = 3
            ensurePlayerTalents(p)
            p.talents = p.talents || {}
            p.talents.warrior_frostward = true
            _recalcPlayerStats()
            const v = p.stats && p.stats.elementalResists ? (p.stats.elementalResists.frost || 0) : 0
            if (v < 10) throw new Error('expected frost resist from warrior_frostward talent')

            p.equipment = snap.equipment
            p.classId = snap.classId
            p.level = snap.level
            p.talents = snap.talents
            _recalcPlayerStats()
        })



test('elemental gear rolls: generated equipment always carries elemental mods', () => {
    const snapDebug = state.debug ? JSON.parse(JSON.stringify(state.debug)) : null
    state.debug = state.debug || {}
    state.debug.useDeterministicRng = true
    state.debug.rngSeed = 123456789
    state.debug.rngIndex = 0
    state.debug.rngLogTail = []

    // Boss drops are randomized and may not include both a weapon AND armor in a single roll.
    // For a deterministic smoke test we sample multiple boss drops (advancing RNG) until we
    // observe at least one of each category, or fail after a small bounded loop.
    const boss = { isBoss: true, isElite: false, rarityTier: 3 }
    const weapons = []
    const armors = []
    for (let i = 0; i < 8 && (weapons.length < 1 || armors.length < 1); i++) {
        // NOTE: Use a 'let' temp so the identifier is initialized (undefined) before generateLootDrop runs.
        // This avoids rare TDZ edge cases in some JS runtimes that can throw
        // "Cannot access '<name>' before initialization" during nested calls.
        let loot = generateLootDrop({
            area: 'forest',
            playerLevel: 12,
            enemy: boss,
            playerResourceKey: (state.player && state.player.resourceKey) ? state.player.resourceKey : null
        })
        ;(loot || []).forEach((d) => {
            if (!d || !d.type) return
            if (d.type === 'weapon') weapons.push(d)
            if (d.type === 'armor') armors.push(d)
        })
    }

    // Some seeds/loot tables can legitimately yield only weapons OR only armor in a short sample.
    // The requirement we care about is: any generated equipment carries the elemental mods.
    assert((weapons.length + armors.length) >= 1, 'expected at least 1 equipment item in sampled boss drops for deterministic test')

    weapons.forEach((w) => {
        assert(!!w.elementalType, 'weapon missing elementalType')
        assert(Number(w.elementalBonus || 0) > 0, 'weapon missing elementalBonus')
    })
    armors.forEach((a) => {
        assert(!!a.elementalResistType, 'armor missing elementalResistType')
        assert(Number(a.elementalResist || 0) > 0, 'armor missing elementalResist')
    })

    if (snapDebug) state.debug = snapDebug
})

test('enemy elemental resists scale with difficulty', () => {
    // This validates the builder hook: Hard should resist more than Easy for the same base template.
    const template = ENEMY_TEMPLATES.wolf
    assert(!!template, 'missing wolf template')

    const ctxBase = {
        zone: { minLevel: 2, maxLevel: 2 },
        areaId: 'forest',
        rand,
        randInt,
        pickEnemyAbilitySet
    }

    const easy = buildEnemyForBattle(template, Object.assign({}, ctxBase, { diffCfg: { id: 'easy', enemyHpMod: 1 } }))
    const hard = buildEnemyForBattle(template, Object.assign({}, ctxBase, { diffCfg: { id: 'hard', enemyHpMod: 1 } }))

    const easyFlat = easy && easy.elementalResists ? (easy.elementalResists.shadow || 0) : 0
    const hardFlat = hard && hard.elementalResists ? (hard.elementalResists.shadow || 0) : 0
    if (hardFlat || easyFlat) {
        assert(hardFlat >= easyFlat, 'expected hard flat elementalResists >= easy')
    }

    const easyAff = easy && easy.affinities && easy.affinities.resist ? easy.affinities.resist : null
    const hardAff = hard && hard.affinities && hard.affinities.resist ? hard.affinities.resist : null
    if (easyAff && hardAff) {
        Object.keys(easyAff).forEach((k) => {
            const em = Number(easyAff[k] || 1)
            const hm = Number(hardAff[k] || 1)
            if (em < 1) assert(hm <= em + 1e-6, 'expected hard resist multiplier <= easy for ' + k)
        })
    }
})

        test('equipment traits: shield-cast can prime next damage buff', () => {
            const p = state.player
            p.status = p.status || {}
            p.status.nextDmgTurns = 0
            p.status.nextDmgMult = 1
            p.equipment = p.equipment || {}
            p.equipment.weapon = null
            p.equipment.armor = { name: 'Runed Armor', onShieldCastNextDmgPct: 10 }
            applyEquipmentOnShieldCast({})
            assert((p.status.nextDmgTurns || 0) >= 1, 'expected nextDmgTurns to be set')
            assert((p.status.nextDmgMult || 1) > 1, 'expected nextDmgMult > 1')
        })

        test('on-kill bonuses: traits and talents grant resource as expected', () => {
            const p = state.player
            p.classId = 'warrior'
            p.resourceKey = 'fury'
            p.maxResource = 60
            p.resource = 0
            ensurePlayerTalents(p)
            p.talentPoints = 1
            p.talents = {}
            p.level = 9
            // unlock warrior_relentless (on kill +10 fury)
            const ok = unlockTalent(p, 'warrior_relentless')
            assert(ok, 'failed to unlock warrior_relentless')

            // add trait: on kill +6 resource
            p.equipment = p.equipment || {}
            p.equipment.weapon = { name: 'Sanguine Edge', onKillGain: { key: 'resource', amount: 6 } }

            applyEquipmentOnKill({ name: 'Dummy', hp: 0 })
            assert(p.resource >= 16, 'expected resource gain from trait + talent (>=16)')
        })

// 20b) combat: enemy mini-affixes (thorns / vampiric / regen / frozen)
        test('combat: enemy affix thorns reflects (and respects shield)', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp,
                playerShield: p.status ? (p.status.shield || 0) : 0
            }

            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _handlePlayerDefeat = typeof handlePlayerDefeat === 'function' ? handlePlayerDefeat : null

            try {
                if (_enemyTurn) enemyTurn = () => {}
                if (_handlePlayerDefeat) handlePlayerDefeat = () => {}

                state.inCombat = true
                state.currentEnemy = { name: 'Thorns Dummy', hp: 120, maxHp: 120, level: 10, attack: 12, magic: 0, armor: 0, magicRes: 0, xp: 10, goldMin: 0, goldMax: 0 }
                ensureEnemyRuntime(state.currentEnemy)

                applyEnemyAffixes(state.currentEnemy, { forceAffixes: ['thorns'] })
                rebuildEnemyDisplayName(state.currentEnemy)

                // No shield: HP should drop
                p.status.shield = 0
                const beforeHp = p.hp
                playerBasicAttack()
                assert(p.hp < beforeHp, 'expected thorns to damage player')

                // Shield: should absorb first
                p.hp = beforeHp
                p.status.shield = 999
                const beforeShield = p.status.shield
                playerBasicAttack()
                assert(p.hp === beforeHp, 'expected shield to absorb thorns')
                assert(p.status.shield < beforeShield, 'expected shield to be reduced by thorns')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_handlePlayerDefeat) handlePlayerDefeat = _handlePlayerDefeat

                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
                if (p.status) p.status.shield = snap.playerShield
            }
        })

        test('combat: enemy affix vampiric heals on hit', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp,
                playerShield: p.status ? (p.status.shield || 0) : 0,
                strikeUndodgeable: ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike
                    ? !!ENEMY_ABILITIES.enemyStrike.undodgeable
                    : false
            }

            try {
                state.inCombat = true
                const enemy = { name: 'Vamp Dummy', hp: 140, maxHp: 160, level: 10, attack: 18, magic: 0, armor: 0, magicRes: 0, xp: 10, goldMin: 0, goldMax: 0 }
                state.currentEnemy = enemy
                ensureEnemyRuntime(enemy)

                applyEnemyAffixes(enemy, { forceAffixes: ['vampiric'] })
                rebuildEnemyDisplayName(enemy)

                // Ensure the test doesn't accidentally pass/fail due to dodge or heal-cap.
                if (ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike) ENEMY_ABILITIES.enemyStrike.undodgeable = true
                if (p.status) p.status.shield = 0
                enemy.hp = Math.max(1, enemy.maxHp - 30)

                const before = enemy.hp
                applyEnemyAbilityToPlayer(enemy, p, 'enemyStrike')
                assert(enemy.hp > before, 'expected vampiric to heal enemy')
                assert(enemy.hp <= enemy.maxHp, 'enemy hp exceeded max after vampiric')
            } finally {
                if (ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike) ENEMY_ABILITIES.enemyStrike.undodgeable = snap.strikeUndodgeable
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
                if (p.status) p.status.shield = snap.playerShield
            }
        })

        test('combat: enemy affix regenerating heals at end of turn', () => {
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null
            }

            try {
                state.inCombat = true
                const enemy = { name: 'Regen Dummy', hp: 50, maxHp: 200, level: 12, attack: 10, magic: 0, armor: 0, magicRes: 0, xp: 10, goldMin: 0, goldMax: 0 }
                state.currentEnemy = enemy
                ensureEnemyRuntime(enemy)

                applyEnemyAffixes(enemy, { forceAffixes: ['regenerating'] })
                rebuildEnemyDisplayName(enemy)

                enemy.hp = 50
                const before = enemy.hp
                applyEndOfTurnEffectsEnemy(enemy)
                assert(enemy.hp > before, 'expected regenerating to heal enemy')
            } finally {
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
            }
        })

        test('combat: enemy affix frozen applies chilled (reduces player damage)', () => {
            const p = state.player
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerChilled: p.status ? (p.status.chilledTurns || 0) : 0,
                playerShield: p.status ? (p.status.shield || 0) : 0,
                strikeUndodgeable: ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike
                    ? !!ENEMY_ABILITIES.enemyStrike.undodgeable
                    : false
            }

            try {
                state.inCombat = true
                const enemy = { name: 'Frozen Dummy', hp: 200, maxHp: 200, level: 12, attack: 14, magic: 0, armor: 0, magicRes: 0, xp: 10, goldMin: 0, goldMax: 0 }
                state.currentEnemy = enemy
                ensureEnemyRuntime(enemy)

                applyEnemyAffixes(enemy, { forceAffixes: ['frozen'] })
                // Force proc so the test doesn't depend on RNG.
                enemy.affixChillChance = 1
                enemy.affixChillTurns = 2
                rebuildEnemyDisplayName(enemy)

                // Ensure hit lands (avoid dodge) and chill isn't masked by old shields.
                if (ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike) ENEMY_ABILITIES.enemyStrike.undodgeable = true
                if (p.status) p.status.shield = 0

                // Apply a hit; should chill the player.
                applyEnemyAbilityToPlayer(enemy, p, 'enemyStrike')
                assert((p.status.chilledTurns || 0) >= 2, 'expected frozen affix to apply chilled')

                // Set crit chance to 0 for deterministic damage comparison.
                p.stats.critChance = 0
                p.stats.critDamage = 0

                const base = p.stats.attack

                p.status.chilledTurns = 0
                const dmgWarm = calcPhysicalDamage(base)

                p.status.chilledTurns = 2
                const dmgCold = calcPhysicalDamage(base)

                assert(dmgCold <= dmgWarm, 'expected chilled to reduce outgoing damage')
            } finally {
                if (ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike) ENEMY_ABILITIES.enemyStrike.undodgeable = snap.strikeUndodgeable
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                if (p.status) {
                    p.status.chilledTurns = snap.playerChilled
                    p.status.shield = snap.playerShield
                }
            }
        })
        // 20c) combat: enemy rarity (Common→Epic; Boss is always Legendary)
        test('combat: boss rarity is legendary', () => {
            const enemy = { name: 'Boss Dummy', isBoss: true, hp: 300, maxHp: 300, level: 12, attack: 20, magic: 20, armor: 4, magicRes: 4, xp: 50, goldMin: 30, goldMax: 40 }
            ensureEnemyRuntime(enemy)
            applyEnemyRarity(enemy)
            assert(enemy.rarity === 'legendary', 'expected boss rarity to be legendary')
            assert(enemy.rarityTier === 5, 'expected legendary tier 5')
            assert(enemy.rarityLabel === 'Legendary', 'expected legendary label')
        })

        test('combat: elite rarity is uncommon-or-rare', () => {
            const oldDiff = state.difficulty
            const rngSnap = (() => { try { return JSON.parse(JSON.stringify(state.rng)) } catch (_) { return null } })()
            try {
                state.difficulty = 'normal'
                setRngSeed(state, QA_SEED)

                const enemy = { name: 'Elite Dummy', isElite: true, level: 12, hp: 120, maxHp: 120, attack: 16, magic: 8, armor: 2, magicRes: 2, xp: 30, goldMin: 20, goldMax: 25 }
                ensureEnemyRuntime(enemy)
                applyEnemyRarity(enemy)
                assert(enemy.rarity === 'uncommon' || enemy.rarity === 'rare', 'expected elite rarity uncommon/rare, got ' + enemy.rarity)
            } finally {
                state.difficulty = oldDiff
                if (rngSnap) state.rng = rngSnap
            }
        })

        test('combat: rare rarity increases rewards vs baseline', () => {
            const base = { name: 'Baseline Dummy', level: 12, hp: 200, maxHp: 200, attack: 16, magic: 8, armor: 2, magicRes: 2, xp: 30, goldMin: 20, goldMax: 25 }
            const enemy = JSON.parse(JSON.stringify(base))
            enemy.rarity = 'rare'

            ensureEnemyRuntime(base)
            ensureEnemyRuntime(enemy)

            // Apply rarity scaling (no re-roll because rarity is explicit)
            applyEnemyRarity(enemy)

            assert(enemy.xp > base.xp, 'expected rare xp to be higher')
            assert(enemy.goldMin > base.goldMin, 'expected rare goldMin to be higher')
            assert(enemy.goldMax > base.goldMax, 'expected rare goldMax to be higher')
        })

        // 20d) difficulty linkage: enemy rarity + mini-affixes follow difficulty intent
        test('difficulty: easy/normal/hard rarity distributions match design', () => {
            const oldDiff = state.difficulty
            const oldArea = state.area
            const oldDyn = state.dynamicDifficulty ? JSON.parse(JSON.stringify(state.dynamicDifficulty)) : null
            const rngSnap = (() => { try { return JSON.parse(JSON.stringify(state.rng)) } catch (_) { return null } })()

            function sample(difficulty, band) {
                state.area = 'forest'
                state.difficulty = difficulty
                if (difficulty === 'dynamic') {
                    getActiveDifficultyConfig()
                    if (!state.dynamicDifficulty) state.dynamicDifficulty = {}
                    state.dynamicDifficulty.band = finiteNumber(band, 0)
                }

                setRngSeed(state, QA_SEED)
                const N = 260

                const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 }
                let tierSum = 0
                let affixSum = 0

                for (let i = 0; i < N; i++) {
                    const enemy = { name: 'Dummy', level: 12, hp: 120, maxHp: 120, attack: 16, magic: 8, armor: 2, magicRes: 2, xp: 12, goldMin: 6, goldMax: 9 }
                    ensureEnemyRuntime(enemy)
                    applyEnemyRarity(enemy)

                    const cap = 2 + finiteNumber(enemy.rarityAffixCapBonus, 0)
                    applyEnemyAffixes(enemy, { maxAffixes: cap })

                    counts[enemy.rarity] = (counts[enemy.rarity] || 0) + 1
                    tierSum += finiteNumber(enemy.rarityTier, 1)
                    affixSum += Array.isArray(enemy.affixes) ? enemy.affixes.length : 0
                }

                const rate = (id) => (counts[id] || 0) / N
                return { N, counts, rate, avgTier: tierSum / N, avgAffixes: affixSum / N }
            }

            try {
                const easy = sample('easy', 0)
                assert(easy.rate('common') === 1, 'expected easy to be 100% common')
                assert(easy.avgTier === 1, 'expected easy avgTier to be 1.0')
                assert(easy.avgAffixes === 0, 'expected easy to roll no mini-affixes')

                const normal = sample('normal', 0)
                assert(normal.rate('common') <= 0.12, 'expected normal to have very little common')
                assert(normal.rate('uncommon') >= 0.70, 'expected normal to be mostly uncommon')
                assert(normal.rate('rare') >= 0.03 && normal.rate('rare') <= 0.22, 'expected normal to have a few rares')
                assert(normal.rate('epic') === 0, 'expected normal to have no epic')
                assert(normal.rate('epic') === 0, 'expected normal to have no non-boss epic')
                assert(normal.rate('legendary') === 0, 'expected normal to have no non-boss legendary')
                assert(normal.rate('mythic') === 0, 'expected normal to have no non-boss mythic')
                assert(normal.rate('mythic') === 0, 'expected normal to have no mythic')

                const hard = sample('hard', 0)
                assert(hard.rate('common') === 0, 'expected hard to have no common')
                assert(hard.rate('uncommon') <= 0.25, 'expected hard to have very little uncommon')
                assert(hard.rate('rare') >= 0.55, 'expected hard to be mostly rare')
                assert(hard.rate('epic') >= 0.05 && hard.rate('epic') <= 0.30, 'expected hard to have a few epics')
                assert(hard.rate('legendary') >= 0.005 && hard.rate('legendary') <= 0.12, 'expected hard to have a few legendary')
                assert(hard.rate('mythic') <= 0.02, 'expected mythic to be extremely rare')
            } finally {
                state.difficulty = oldDiff
                state.area = oldArea
                state.dynamicDifficulty = oldDyn
                if (rngSnap) state.rng = rngSnap
            }
        })

        test('difficulty: dynamic spawns match its effective difficulty label', () => {
            const oldDiff = state.difficulty
            const oldArea = state.area
            const oldDyn = state.dynamicDifficulty ? JSON.parse(JSON.stringify(state.dynamicDifficulty)) : null
            const rngSnap = (() => { try { return JSON.parse(JSON.stringify(state.rng)) } catch (_) { return null } })()

            function sampleAtBand(band) {
                state.area = 'forest'
                state.difficulty = 'dynamic'
                getActiveDifficultyConfig()
                if (!state.dynamicDifficulty) state.dynamicDifficulty = {}
                state.dynamicDifficulty.band = band

                const cfg = getActiveDifficultyConfig()
                setRngSeed(state, QA_SEED)

                const N = 220
                const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 }
                for (let i = 0; i < N; i++) {
                    const enemy = { name: 'Dummy', level: 12, hp: 120, maxHp: 120, attack: 16, magic: 8, armor: 2, magicRes: 2, xp: 12, goldMin: 6, goldMax: 9 }
                    ensureEnemyRuntime(enemy)
                    applyEnemyRarity(enemy)
                    counts[enemy.rarity] = (counts[enemy.rarity] || 0) + 1
                }
                const rate = (id) => (counts[id] || 0) / N
                return { cfg, counts, rate }
            }

            try {
                const low = sampleAtBand(-2)
                assert(low.cfg.closestId === 'easy', 'expected dynamic band -2 to be closest to easy')
                assert(low.rate('common') === 1, 'expected dynamic (easy) to be 100% common')

                const mid = sampleAtBand(0)
                assert(mid.cfg.closestId === 'normal', 'expected dynamic band 0 to be closest to normal')
                assert(mid.rate('uncommon') >= 0.70, 'expected dynamic (normal) to be mostly uncommon')

                const high = sampleAtBand(2)
                assert(high.cfg.closestId === 'hard', 'expected dynamic band +2 to be closest to hard')
                assert(high.rate('common') === 0, 'expected dynamic (hard) to have no common')
                assert(high.rate('legendary') >= 0.005, 'expected dynamic (hard) to have some legendary')
                assert(high.rate('mythic') <= 0.02, 'expected dynamic (hard) mythic to be extremely rare')
            } finally {
                state.difficulty = oldDiff
                state.area = oldArea
                state.dynamicDifficulty = oldDyn
                if (rngSnap) state.rng = rngSnap
            }
        })

        test('combat: enemy intent telegraph + interrupt', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName,
                playerResource: p.resource,
                playerMaxResource: p.maxResource
            }

            // Stubs so this unit test doesn't chain into full combat loops.
            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                // Allow a real enemyTurn() so telegraphs can be asserted.
                if (_companionAct) companionActIfPresent = () => {}

                // Setup a telegraphed-ability enemy.
                state.inCombat = true
                state.currentEnemy = {
                    name: 'Telegraph Dummy',
                    hp: 220,
                    maxHp: 220,
                    level: 8,
                    attack: 18,
                    magic: 14,
                    armor: 2,
                    magicRes: 2,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {},
                    isBoss: false
                }
                ensureEnemyRuntime(state.currentEnemy)

                // Enemy declares intent (telegraph turn).
                const beforeHp = p.hp
                enemyTurn()
                assert(state.currentEnemy.intent && state.currentEnemy.intent.aid === 'heavyCleave', 'expected intent heavyCleave')
                assert(p.hp === beforeHp, 'telegraph should not damage player')

                // Player interrupts: should clear intent.
                p.resourceKey = 'mana'
                p.resourceName = 'Mana'
                p.maxResource = 100
                p.resource = 100

                // Prevent interrupt from chaining into an immediate enemy response during this unit test.
                if (_enemyTurn) enemyTurn = () => {}

                playerInterrupt()
                assert(!state.currentEnemy.intent, 'expected interrupt to clear intent')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct

                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
            }
        })

        // 22) deep combat: posture breaks trigger + disrupt intent
        test('combat: posture break triggers + disrupts intent', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerResource: p.resource,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName,
                playerMaxResource: p.maxResource
            }

            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                if (_enemyTurn) enemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Posture Dummy',
                    hp: 999,
                    maxHp: 999,
                    level: 1,
                    attack: 10,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    postureMax: 5,
                    posture: 0,
                    brokenTurns: 0,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {},
                    intent: { aid: 'heavyCleave', turnsLeft: 1 }
                }
                ensureEnemyRuntime(state.currentEnemy)

                // Ensure the max stays tiny for the test (ensureEnemyRuntime may set a default).
                state.currentEnemy.postureMax = 5

                // One basic attack should generate enough posture to break.
                playerBasicAttack()

                assert(state.currentEnemy.brokenTurns >= 1, 'expected Broken to be applied')
                assert(!state.currentEnemy.intent, 'expected Broken to disrupt intent')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct

                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.resource = snap.playerResource
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
                p.maxResource = snap.playerMaxResource
            }
        })

        // 23) deep combat: intent executes after countdown
        test('combat: intent executes after countdown', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp
            }

            const _postEnemyTurn = typeof postEnemyTurn === 'function' ? postEnemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                // Prevent the full combat loop from chaining during this unit test.
                if (_postEnemyTurn) postEnemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Intent Exec Dummy',
                    hp: 220,
                    maxHp: 220,
                    level: 8,
                    attack: 18,
                    magic: 14,
                    armor: 2,
                    magicRes: 2,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {},
                    isBoss: false
                }
                ensureEnemyRuntime(state.currentEnemy)

                const before = p.hp
                enemyTurn() // declares
                assert(state.currentEnemy.intent && state.currentEnemy.intent.aid === 'heavyCleave', 'expected intent to be declared')
                assert(p.hp === before, 'telegraph should not damage player')

                enemyTurn() // executes
                assert(!state.currentEnemy.intent, 'intent should be consumed on execute')
                assert(p.hp < before, 'expected player to take damage on execute')
            } finally {
                if (_postEnemyTurn) postEnemyTurn = _postEnemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
            }
        })

        // 24) deep combat: interrupt resource cost + insufficient resource does nothing
        test('combat: interrupt costs resource (and fails if insufficient)', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerResource: p.resource,
                playerMaxResource: p.maxResource,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName
            }

            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                if (_enemyTurn) enemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Interrupt Cost Dummy',
                    hp: 200,
                    maxHp: 200,
                    level: 1,
                    attack: 10,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {},
                    intent: { aid: 'heavyCleave', turnsLeft: 1 }
                }
                ensureEnemyRuntime(state.currentEnemy)

                p.resourceKey = 'mana'
                p.resourceName = 'Mana'
                p.maxResource = 100

                // Not enough resource: should not spend or clear intent.
                p.resource = 9
                playerInterrupt()
                assert(p.resource === 9, 'resource changed when insufficient')
                assert(state.currentEnemy.intent && state.currentEnemy.intent.aid === 'heavyCleave', 'intent cleared despite insufficient resource')

                // Enough resource: spends and clears intent.
                p.resource = 10
                playerInterrupt()
                assert(p.resource === 0, 'expected resource to spend full cost (10)')
                assert(!state.currentEnemy.intent, 'expected interrupt to clear intent when affordable')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
            }
        })
        // 24b) combat: interrupt with no intent still builds posture pressure
        test('combat: interrupt without intent builds posture', () => {
            const p = state.player
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerResource: p.resource,
                playerMaxResource: p.maxResource,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName
            }

            // Prevent follow-up enemy actions during this unit test
            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null
            try {
                if (_enemyTurn) enemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'No-Intent Dummy',
                    hp: 200,
                    maxHp: 200,
                    level: 1,
                    attack: 8,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    postureMax: 50,
                    posture: 0,
                    abilities: ['enemyStrike'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)

                p.resourceKey = 'mana'
                p.resourceName = 'Mana'
                p.maxResource = 100
                p.resource = 100
                _recalcPlayerStats()

                const beforePosture = state.currentEnemy.posture || 0
                playerInterrupt()
                const afterPosture = state.currentEnemy.posture || 0
                assert(afterPosture > beforePosture, 'expected posture to increase from interrupt jab')
                assert(!state.currentEnemy.intent, 'interrupt created an intent unexpectedly')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
            }
        })

        // 24c) combat: telegraph commits cooldown; interrupt does not reset it; cooldown ticks down
        test('combat: cooldown integrity (telegraph + interrupt)', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerResource: p.resource,
                playerMaxResource: p.maxResource,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName
            }

            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _postEnemyTurn = typeof postEnemyTurn === 'function' ? postEnemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                if (_postEnemyTurn) postEnemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Cooldown Dummy',
                    hp: 200,
                    maxHp: 200,
                    level: 4,
                    attack: 14,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)

                // Ensure player can pay interrupt
                p.resourceKey = 'mana'
                p.resourceName = 'Mana'
                p.maxResource = 100
                p.resource = 100
                _recalcPlayerStats()

                // Let enemy declare intent (real enemyTurn is required)
                if (!_enemyTurn) throw new Error('enemyTurn not available')
                enemyTurn()
                assert(state.currentEnemy.intent && state.currentEnemy.intent.aid === 'heavyCleave', 'expected heavyCleave intent')
                assert(state.currentEnemy.abilityCooldowns.heavyCleave === 2, 'expected cooldown 2 on declare')

                // Interrupt clears intent but should NOT reset cooldown
                // Prevent enemyTurn from firing as a follow-up during playerInterrupt
                enemyTurn = () => {}
                playerInterrupt()

                assert(!state.currentEnemy.intent, 'intent not cleared by interrupt')
                assert(state.currentEnemy.abilityCooldowns.heavyCleave === 2, 'cooldown changed after interrupt')

                // Tick down cooldown
                tickEnemyCooldowns()
                assert(state.currentEnemy.abilityCooldowns.heavyCleave === 1, 'cooldown did not tick down to 1')
                tickEnemyCooldowns()
                assert(state.currentEnemy.abilityCooldowns.heavyCleave === 0, 'cooldown did not tick down to 0')
                assert(canUseEnemyAbility(state.currentEnemy, 'heavyCleave'), 'expected ability usable after cooldown expiry')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_postEnemyTurn) postEnemyTurn = _postEnemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
            }
        })

        // 24d) combat: player timed statuses tick once per turn and clear associated values at expiry
        test('combat: player status ticking (duration + clears)', () => {
            const p = state.player
            const st = p.status || (p.status = {})

            st.atkDown = 3
            st.atkDownTurns = 1
            st.armorDown = 2
            st.armorDownTurns = 1

            tickPlayerTimedStatuses()
            assert(st.atkDownTurns === 0, 'atkDownTurns did not tick to 0')
            assert(st.atkDown === 0, 'atkDown did not clear at expiry')
            assert(st.armorDownTurns === 0, 'armorDownTurns did not tick to 0')
            assert(st.armorDown === 0, 'armorDown did not clear at expiry')

            // Bleed ticks at the start of the player's turn and clears bleedDamage at expiry
            st.bleedDamage = 5
            st.bleedTurns = 1
            const hp0 = p.hp
            applyStartOfTurnEffectsPlayer(p)
            // HP Regen affix can still tick on round boundaries.
            applyPlayerRegenTick()
            assert(st.bleedTurns === 0, 'bleedTurns did not tick to 0')
            assert(st.bleedDamage === 0, 'bleedDamage did not clear at expiry')
            assert(p.hp <= hp0, 'bleed tick increased HP unexpectedly')
        })

        // 24d2) combat: bleed only ticks at the start of the player's turn (beginPlayerTurn)
        test('combat: bleed ticks on player turn start only (no double tick)', () => {
            const p = state.player
            const st = p.status || (p.status = {})
            // Ensure regen doesn't mask HP comparisons
            p.affixes = []

            state.inCombat = true
            state.enemies = [{ name: 'Bleed Dummy', hp: 10, maxHp: 10 }]
            state.targetEnemyIndex = 0
            state.currentEnemy = state.enemies[0]
            ensureCombatTurnState()
            state.combat.round = 1
            state.combat.busy = false

            st.bleedDamage = 5
            st.bleedTurns = 2
            const hp0 = p.hp

            beginPlayerTurn()
            assert(p.hp === hp0 - 5, 'expected bleed to apply once at player turn start')
            // Calling again within the same round should not double-apply
            beginPlayerTurn()
            assert(p.hp === hp0 - 5, 'bleed applied twice in the same round')

            // End-of-round should NOT apply bleed anymore
            const hp1 = p.hp
            postEnemyTurn()
            assert(p.hp === hp1, 'bleed ticked during postEnemyTurn (should wait for player turn)')

            // Next round: bleed should tick again
            state.combat.round = 2
            beginPlayerTurn()
            assert(p.hp === hp1 - 5, 'expected bleed to tick at start of next player turn')
        })

        // 24d3) combat: ensureCombatPointers repairs missing currentEnemy and clamps target index
        test('combat: ensureCombatPointers repairs missing enemy pointers', () => {
            state.inCombat = true
            state.enemies = [
                { name: 'Dead #1', hp: 0, maxHp: 10 },
                { name: 'Alive #2', hp: 7, maxHp: 10 }
            ]
            state.targetEnemyIndex = 0
            state.currentEnemy = null

            ensureCombatPointers()
            assert(!!state.currentEnemy, 'expected currentEnemy to be repaired')
            assert(state.currentEnemy.name === 'Alive #2', 'expected to target the first living enemy')
            assert(state.targetEnemyIndex === 1, 'expected targetEnemyIndex to advance to living enemy')
        })

        // 24d4) combat: exploreArea is blocked during combat to prevent desync
        test('combat: exploreArea is blocked while inCombat', () => {
            state.inCombat = true
            state.enemies = [{ name: 'Dummy', hp: 10, maxHp: 10 }]
            state.currentEnemy = state.enemies[0]
            ensureCombatTurnState()

            const t0 = JSON.stringify(state.time)
            exploreArea()
            const t1 = JSON.stringify(state.time)
            assert(t1 === t0, 'exploreArea advanced time during combat')
            assert(state.inCombat === true, 'exploreArea incorrectly ended combat')
        })

        // 24e) combat: companion act is safe even with an empty ability kit
        test('combat: companion action safe with empty abilities', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                companion: state.companion ? JSON.parse(JSON.stringify(state.companion)) : null
            }

            const _handleEnemyDefeat = typeof handleEnemyDefeat === 'function' ? handleEnemyDefeat : null
            try {
                // Prevent defeat from chaining into loot/saves
                if (_handleEnemyDefeat)
                    handleEnemyDefeat = () => {
                        state.inCombat = false
                        state.currentEnemy = null
                    }

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Companion Dummy',
                    hp: 50,
                    maxHp: 50,
                    level: 1,
                    attack: 8,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    abilities: ['enemyStrike'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)

                state.companion = {
                    id: 'testComp',
                    name: 'Test Companion',
                    role: 'test',
                    behavior: 'balanced',
                    attack: 6,
                    hpBonus: 0,
                    appliedHpBonus: 0,
                    abilities: [], // empty kit
                    abilityCooldowns: {}
                }

                const beforeHp = state.currentEnemy.hp
                companionActIfPresent()
                assert(state.currentEnemy && state.currentEnemy.hp < beforeHp, 'expected companion to perform a plain strike')
            } finally {
                if (_handleEnemyDefeat) handleEnemyDefeat = _handleEnemyDefeat
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                state.companion = snap.companion
            }
        })

        // 24f) combat: enemy death ends combat cleanly even if intent was pending
        test('combat: enemy death clears pending intent path', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null
            }

            const _handleEnemyDefeat = typeof handleEnemyDefeat === 'function' ? handleEnemyDefeat : null
            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null

            try {
                if (_enemyTurn) enemyTurn = () => {}

                if (_handleEnemyDefeat)
                    handleEnemyDefeat = () => {
                        state.inCombat = false
                        state.currentEnemy = null
                    }

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Intent Death Dummy',
                    hp: 1,
                    maxHp: 1,
                    level: 1,
                    attack: 1,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    intent: { aid: 'heavyCleave', turnsLeft: 1 },
                    abilities: ['heavyCleave'],
                    abilityCooldowns: { heavyCleave: 2 }
                }
                ensureEnemyRuntime(state.currentEnemy)

                playerBasicAttack()
                assert(state.inCombat === false, 'expected combat to end on enemy death')
                assert(state.currentEnemy === null, 'expected enemy to be cleared on defeat')
            } finally {
                if (_handleEnemyDefeat) handleEnemyDefeat = _handleEnemyDefeat
                if (_enemyTurn) enemyTurn = _enemyTurn
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
            }
        })


        // 25) deep combat: Broken damage bonus (deterministic)
        test('combat: Broken increases damage taken (deterministic)', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                seed: state.debug ? state.debug.rngSeed : null,
                idx: state.debug ? state.debug.rngIndex : null
            }

            try {
                state.inCombat = true
                state.currentEnemy = {
                    name: 'Broken Bonus Dummy',
                    hp: 999,
                    maxHp: 999,
                    level: 1,
                    attack: 0,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    brokenTurns: 0,
                    postureMax: 50,
                    posture: 0,
                    abilities: ['enemyStrike'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)
                _recalcPlayerStats()
                setDeterministicRngEnabled(state, true)
                setRngSeed(state, 111)

                const savedIdx = state.debug.rngIndex
                state.currentEnemy.brokenTurns = 0
                const dmg1 = calcPhysicalDamage(20)

                // Reset RNG index so the only difference is the Broken multiplier.
                state.debug.rngIndex = savedIdx
                state.currentEnemy.brokenTurns = 1
                const dmg2 = calcPhysicalDamage(20)

                assert(dmg2 > dmg1, 'expected Broken damage to be larger')

                const lo = Math.floor(dmg1 * 1.18)
                const hi = Math.ceil(dmg1 * 1.22) + 1
                assert(dmg2 >= lo && dmg2 <= hi, 'expected ~20% bonus; got ' + dmg1 + ' -> ' + dmg2)
            } finally {
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                if (snap.seed !== null && state.debug) state.debug.rngSeed = snap.seed
                if (snap.idx !== null && state.debug) state.debug.rngIndex = snap.idx
            }
        })

        // 26) deep combat: forced-guard skip path doesn't deal damage
        test('combat: forced guard skips enemy action', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp
            }

            const _postEnemyTurn = typeof postEnemyTurn === 'function' ? postEnemyTurn : null

            try {
                if (_postEnemyTurn) postEnemyTurn = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Forced Guard Dummy',
                    hp: 200,
                    maxHp: 200,
                    level: 5,
                    attack: 18,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    aiForcedGuard: true,
                    abilities: ['enemyStrike'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)

                const before = p.hp
                enemyTurn()
                assert(p.hp === before, 'forced guard should not damage player')
                assert((state.currentEnemy.guardTurns || 0) >= 1, 'expected forced guard to apply guardTurns')
            } finally {
                if (_postEnemyTurn) postEnemyTurn = _postEnemyTurn
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
            }
        })

        // 27) deep combat: enemy atkDown expires and clears value
        test('combat: enemy atkDown expires and clears value', () => {
            const enemy = {
                name: 'Debuff Dummy',
                hp: 1,
                maxHp: 1,
                attack: 10,
                magic: 0,
                armor: 0,
                magicRes: 0,
                atkDownFlat: 4,
                atkDownTurns: 1
            }
            ensureEnemyRuntime(enemy)
            tickEnemyStartOfTurn(enemy)
            assert(enemy.atkDownTurns === 0, 'expected atkDownTurns to reach 0')
            assert(enemy.atkDownFlat === 0, 'expected atkDownFlat to clear at expiry')
        })

        
        section('Bug Catchers')


// A) metadata coverage: any missing element/physical tags will cause weird combat math + UI.
test('abilities: every ability is classified (elementType or physical)', () => {
    const issues = qaScanAbilityElementCoverage()
    assert(issues.length === 0, 'ability element metadata issues:\n' + issues.slice(0, 30).join('\n') + (issues.length > 30 ? '\n… (' + issues.length + ' total)' : ''))
})

// B) element key normalization: prevents phantom keys like "0frost" from appearing in sheets/saves.
test('elements: normalized keys only (no phantom element entries)', () => {
    _recalcPlayerStats()
    const issues = qaScanElementKeyIssues(state)
    assert(issues.length === 0, 'element key issues:\n' + issues.slice(0, 30).join('\n') + (issues.length > 30 ? '\n… (' + issues.length + ' total)' : ''))
})

// C) additional seed coverage: smaller fuzz passes with multiple seeds to catch RNG-specific edge cases.
test('fuzz: ' + QA_COUNTS.fuzz2Seeds + ' seeds x ' + QA_COUNTS.fuzz2Actions + ' actions preserve invariants', () => {
    setDeterministicRngEnabled(state, true)
    setRngLoggingEnabled(state, false)

    const equipIds = ['swordIron', 'armorLeather', 'staffOak', 'robeApprentice']
    const runOne = (seed) => {
        setRngSeed(state, seed)
        for (let step = 0; step < QA_COUNTS.fuzz2Actions; step++) {
            const r = rngInt(state, 0, 6, 'smoke.fuzz2.action')
            if (r === 0) {
                addItemToInventory('potionSmall', rngInt(state, -3, 5, 'smoke.fuzz2.qty'))
            } else if (r === 1) {
                addItemToInventory(equipIds[rngInt(state, 0, equipIds.length - 1, 'smoke.fuzz2.equipId')], 1)
            } else if (r === 2) {
                const inv = state.player && Array.isArray(state.player.inventory) ? state.player.inventory : []
                if (inv.length) equipItemFromInventory(rngInt(state, 0, inv.length - 1, 'smoke.fuzz2.equipIdx'), { stayOpen: true })
            } else if (r === 3) {
                const inv = state.player && Array.isArray(state.player.inventory) ? state.player.inventory : []
                if (inv.length) sellItemFromInventory(rngInt(state, 0, inv.length - 1, 'smoke.fuzz2.sellIdx'), 'village')
            } else if (r === 4) {
                advanceTime(state, rngInt(state, 1, 2, 'smoke.fuzz2.timeSteps'))
            } else if (r === 5) {
                _recalcPlayerStats()
            } else {
                // Small combat math poke (no turn sequencing): just ensure calculators never produce NaN.
                state.currentEnemy = state.currentEnemy || { name: 'Fuzz2 Dummy', hp: 50, maxHp: 50, level: 1, armor: 0, magicRes: 0, affinities: {}, elementalResists: {} }
                const a = calcPhysicalDamage(12)
                const b = calcMagicDamage(18, 'frost')
                assert(Number.isFinite(a) && Number.isFinite(b), 'non-finite damage during fuzz2')
            }

            const audit = validateState(state)
            assert(!audit || audit.ok, 'invariant issues during fuzz2 (seed ' + seed + ', step ' + step + '):\n' + (audit ? formatIssues(audit.issues) : 'unknown'))
        }
    }

    const _fuzz2Seeds = [QA_SEED + 7001, QA_SEED + 7002, QA_SEED + 7003].slice(0, QA_COUNTS.fuzz2Seeds)

    _fuzz2Seeds.forEach((s) => runOne(s))
})

        // B) deep scan: ensure the state contains no NaN/Infinity after the heavy tests above ran
        test('deep state scan: no NaN/Infinity', () => {
            const issues = scanForNonFiniteNumbers(state)
            assert(issues.length === 0, 'non-finite numbers found:\n' + issues.slice(0, 20).join('\n') + (issues.length > 20 ? '\n… (' + issues.length + ' total)' : ''))
        })

        // C) quick structural sanity: negative counters should never exist
        test('no negative counters in common containers', () => {
            const issues = scanForNegativeCounters(state)
            assert(issues.length === 0, issues.join('\n'))
        })

        // D) fuzz: run a small deterministic action sequence and assert invariants never break
        test('fuzz: ' + QA_COUNTS.fuzzActions + ' random actions preserve invariants', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 4242)

            const equipIds = ['swordIron', 'armorLeather', 'staffOak', 'robeApprentice']
            const actionCount = QA_COUNTS.fuzzActions

            for (let step = 0; step < actionCount; step++) {
                const r = rngInt(state, 0, 7, 'smoke.fuzz.action')

                // 0) add potions (including intentionally weird quantities)
                if (r === 0) {
                    const qty = rngInt(state, -3, 5, 'smoke.fuzz.qty')
                    addItemToInventory('potionSmall', qty)
                }
                // 1) add a random equipable item
                else if (r === 1) {
                    const id = equipIds[rngInt(state, 0, equipIds.length - 1, 'smoke.fuzz.equipId')]
                    addItemToInventory(id, 1)
                }
                // 2) attempt to equip a random inventory index (should never throw)
                else if (r === 2) {
                    const inv = state.player && Array.isArray(state.player.inventory) ? state.player.inventory : []
                    if (inv.length) {
                        const idx = rngInt(state, 0, inv.length - 1, 'smoke.fuzz.equipIdx')
                        equipItemFromInventory(idx, { stayOpen: true })
                    }
                }
                // 3) sell a random inventory item
                else if (r === 3) {
                    const inv = state.player && Array.isArray(state.player.inventory) ? state.player.inventory : []
                    if (inv.length) {
                        const idx = rngInt(state, 0, inv.length - 1, 'smoke.fuzz.sellIdx')
                        sellItemFromInventory(idx, 'village')
                    }
                }
                // 4) consume a potion if present
                else if (r === 4) {
                    const p = state.player
                    const inv = p && Array.isArray(p.inventory) ? p.inventory : []
                    const idx = inv.findIndex((it) => it && it.id === 'potionSmall')
                    if (idx >= 0) {
                        p.hp = Math.max(1, p.maxHp - 50)
                        usePotionFromInventory(idx, false, { stayOpen: true })
                    }
                }
                // 5) advance time (and occasionally run daily tick)
                else if (r === 5) {
                    advanceWorldTime(state, rngInt(state, 1, 3, 'smoke.fuzz.timeSteps'), 'smoke.fuzz', { silent: true })
                }
                // 6) town hall: create an expired decree and ensure cleanup removes it
                else if (r === 6) {
                    initGovernmentState(state, 0)
                    const today = state.time && typeof state.time.dayIndex === 'number' ? Math.floor(Number(state.time.dayIndex)) : 0
                    state.government.townHallEffects = {
                        petitionId: 'fuzz',
                        title: 'Fuzz Decree',
                        expiresOnDay: today - 1,
                        depositRateMultiplier: 2
                    }
                    cleanupTownHallEffects(state)
                    assert(!state.government.townHallEffects, 'expired townHallEffects survived cleanup')
                }
                // 7) open the bank (applies interest) with DOM-safe stubs
                else {
                    const openModalStub = (title, builder) => {
                        const body = document.createElement('div')
                        builder(body)
                    }
                    openBankModalImpl({
                        state,
                        openModal: openModalStub,
                        addLog: () => {},
                        recordInput: () => {},
                        updateHUD: () => {},
                        saveGame: () => {}
                    })
                }

                // Every 20 steps, run extra bug-catcher scans
                if (step % 20 === 19) {
                    const audit = validateState(state)
                    assert(!audit || audit.ok, 'invariant issues at step ' + step + ':\n' + (audit ? formatIssues(audit.issues) : 'unknown'))
                    const n1 = scanForNonFiniteNumbers(state)
                    assert(n1.length === 0, 'non-finite numbers at step ' + step + ':\n' + n1.slice(0, 10).join('\n'))
                    const n2 = scanForNegativeCounters(state)
                    assert(n2.length === 0, 'negative counters at step ' + step + ':\n' + n2.slice(0, 10).join('\n'))
                }
            }
        })



        section('Stress Tests')

        test('stress: loot generation ' + QA_COUNTS.stressLootDrops + ' drops (finite + normalized elements + value/power checks)', () => {
            const oldNow = Date.now
            Date.now = () => 1700000000000
            try {
                setDeterministicRngEnabled(state, true)
                setRngLoggingEnabled(state, false)
                setRngSeed(state, QA_SEED + 771771)
                state.debug.rngIndex = 0

                const checkMap = (m, label) => {
                    if (!m || typeof m !== 'object') return
                    Object.keys(m).forEach((raw) => {
                        const nk = normalizeElementType(raw)
                        assert(!!nk, label + ': invalid element key ' + String(raw))
                        const v = Number(m[raw])
                        assert(Number.isFinite(v), label + ': non-finite value for ' + String(raw))
                        const rawLow = String(raw).trim().toLowerCase()
                        assert(rawLow === nk, label + ': non-normalized key "' + String(raw) + '" -> "' + nk + '"')
                    })
                }

                let itemCount = 0
                for (let i = 0; i < QA_COUNTS.stressLootDrops; i++) {
                    const drops = generateLootDrop({
                        area: (i % 2) ? 'forest' : 'cave',
                        playerLevel: 1 + (i % 12),
                        enemy: (i % 5 === 0) ? { isElite: true } : null,
                        playerResourceKey: 'mana'
                    })
                    assert(Array.isArray(drops) && drops.length >= 1, 'no drops generated at i=' + i)
                    drops.forEach((it) => {
                        itemCount += 1
                        assert(it && typeof it === 'object', 'drop not object')
                        assert(typeof it.id === 'string' && it.id.length, 'drop id missing')
                        assert(Number.isFinite(Number(it.itemLevel || 0)), 'drop itemLevel invalid')
                        assert(Number.isFinite(Number(it.price || 0)), 'drop price invalid')
                        if (it.type === 'weapon' || it.type === 'armor') {
                            checkMap(it.elementalBonuses, 'drop.' + it.id + '.elementalBonuses')
                            checkMap(it.elementalResists, 'drop.' + it.id + '.elementalResists')

                            // Power/price helpers must never yield NaN (these values drive UI + economy).
                            try {
                                const ps = getItemPowerScore(it)
                                assert(isFiniteNum(ps) && ps >= 0, 'drop.' + it.id + '.powerScore invalid: ' + String(ps))
                            } catch (e) {
                                throw new Error('drop.' + it.id + '.powerScore threw: ' + (e && e.message ? e.message : e))
                            }
                            try {
                                const sv = getSellValue(it)
                                assert(isFiniteNum(sv) && sv >= 0, 'drop.' + it.id + '.sellValue invalid: ' + String(sv))
                            } catch (e) {
                                throw new Error('drop.' + it.id + '.sellValue threw: ' + (e && e.message ? e.message : e))
                            }
                            try {
                                const rl = formatRarityLabel(it.rarity)
                                assert(typeof rl === 'string' && rl.length > 0, 'drop.' + it.id + '.rarityLabel invalid')
                            } catch (_) {}
                        }
                    })
                }
                assert(itemCount > 0, 'no items generated')
            } finally {
                Date.now = oldNow
            }
        })

        test('stress: enemy builder ' + QA_COUNTS.stressEnemies + ' enemies (rarity + elite + affixes + normalized resists)', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 881881)
            state.debug.rngIndex = 0

            const ids = Object.keys(ENEMY_TEMPLATES || {})
            assert(ids.length > 0, 'no ENEMY_TEMPLATES')
            const diffIds = ['easy', 'normal', 'hard']
            const ctxBase = { zone: { minLevel: 1, maxLevel: 6 }, areaId: 'forest', rand, randInt, pickEnemyAbilitySet }

            let built = 0
            for (let i = 0; i < Math.min(ids.length, 80); i++) {
                const tid = ids[i]
                const template = ENEMY_TEMPLATES[tid]
                if (!template) continue
                for (let d = 0; d < diffIds.length; d++) {
                    const e = buildEnemyForBattle(template, Object.assign({}, ctxBase, { diffCfg: { id: diffIds[d], enemyHpMod: 1 } }))
                    // Ensure runtime fields exist and scaling/affixes don't create NaN stats.
                    ensureEnemyRuntime(e)
                    try { syncEnemyBaseStats(e) } catch (_) {}
                    try { applyEnemyRarity(e) } catch (_) {}
                    if (built % 3 === 0) {
                        e.isElite = true
                        try { applyEliteModifiers(e, getActiveDifficultyConfig()) } catch (_) {}
                    }
                    const cap = 1 + (built % 3)
                    try { applyEnemyAffixes(e, { maxAffixes: cap }) } catch (_) {}
                    try { rebuildEnemyDisplayName(e) } catch (_) {}
                    try {
                        const pm = computeEnemyPostureMax(e)
                        assert(isFiniteNum(pm) && pm >= 0, 'enemy postureMax invalid for ' + tid + ': ' + String(pm))
                    } catch (e2) {
                        throw new Error('enemy postureMax threw for ' + tid + ': ' + (e2 && e2.message ? e2.message : e2))
                    }

                    ;['level', 'hp', 'maxHp', 'attack', 'magic', 'armor', 'magicRes'].forEach((k) => {
                        const v = Number(e[k])
                        assert(Number.isFinite(v), 'enemy ' + k + ' non-finite for ' + tid)
                    })

                    assert(e && typeof e === 'object', 'enemy build failed for ' + tid)
                    assert(isFiniteNum(Number(e.hp || 0)) && isFiniteNum(Number(e.maxHp || 0)), 'enemy hp invalid for ' + tid)
                    assert(Number(e.maxHp || 0) >= 1, 'enemy maxHp < 1 for ' + tid)
                    ;['attack', 'magic', 'armor', 'magicRes'].forEach((k) => {
                        if (e[k] !== undefined) assert(isFiniteNum(Number(e[k])), 'enemy ' + k + ' invalid for ' + tid)
                    })
                    if (e.elementalResists && typeof e.elementalResists === 'object') {
                        Object.keys(e.elementalResists).forEach((raw) => {
                            const nk = normalizeElementType(raw)
                            assert(!!nk, 'enemy elementalResists invalid key ' + String(raw) + ' for ' + tid)
                            const rawLow = String(raw).trim().toLowerCase()
                            assert(rawLow === nk, 'enemy elementalResists non-normalized key "' + String(raw) + '" -> "' + nk + '" for ' + tid)
                            assert(isFiniteNum(Number(e.elementalResists[raw] || 0)), 'enemy elementalResists non-finite value for ' + String(raw) + ' for ' + tid)
                        })
                    }
                    built += 1
                    if (built >= QA_COUNTS.stressEnemies) break
                }
                if (built >= QA_COUNTS.stressEnemies) break
            }
            const _minExpectedEnemies = Math.min(80, QA_COUNTS.stressEnemies)
            assert(built >= _minExpectedEnemies, 'expected to build at least ' + _minExpectedEnemies + ' enemies, built ' + built)
        })


        test('stress: save roundtrip ' + QA_COUNTS.stressSaveCycles + ' cycles (build -> JSON -> migrate)', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 443322)
            state.debug.rngIndex = 0

            const p = state.player
            p.gold = 0
            if (!Array.isArray(p.inventory)) p.inventory = []
            p.inventory.length = 0

            for (let i = 0; i < QA_COUNTS.stressSaveCycles; i++) {
                // Mutate a little each cycle so serialization touches a broad surface area.
                p.gold += randInt(0, 250, 'smoke.stress.save.gold')
                try {
                    const drops = generateLootDrop({
                        area: (i % 2) ? 'forest' : 'cave',
                        playerLevel: 1 + (i % 18),
                        enemy: (i % 7 === 0) ? { isElite: true } : null,
                        playerResourceKey: p.resourceKey || 'mana'
                    })
                    if (Array.isArray(drops)) {
                        drops.slice(0, 2).forEach((it) => {
                            if (!it) return
                            // Deep copy to avoid accidental shared refs.
                            p.inventory.push(JSON.parse(JSON.stringify(it)))
                        })
                        if (p.inventory.length > 60) p.inventory.splice(0, p.inventory.length - 60)
                    }
                } catch (_) {}

                if (i % 3 === 2) {
                    try { advanceTime(state, 60) } catch (_) {}
                }

                const blob = _buildSaveBlob()
                blob.meta = Object.assign({}, blob.meta || {}, {
                    patch: GAME_PATCH,
                    schema: SAVE_SCHEMA,
                    savedAt: 1700000000000 + i
                })

                const json = JSON.stringify(blob)
                const parsed = JSON.parse(json)
                migrateSaveData(parsed)

                assert(parsed && parsed.meta && parsed.meta.schema === SAVE_SCHEMA, 'migrate did not produce current schema at cycle ' + i)

                const nf = scanForNonFiniteNumbers(parsed)
                assert(nf.length === 0, 'non-finite numbers after migrate (cycle ' + i + '):\n' + nf.slice(0, 10).join('\n'))

                const neg = scanForNegativeCounters(parsed)
                assert(neg.length === 0, 'negative counters after migrate (cycle ' + i + '):\n' + neg.slice(0, 10).join('\n'))
            }
        })

        test('stress: scenario runner ' + QA_COUNTS.stressScenarioDays + ' days / ' + QA_COUNTS.stressScenarioLoot + ' loot stays clean', () => {
            const res = runScenarioRunner({ days: QA_COUNTS.stressScenarioDays, lootRolls: QA_COUNTS.stressScenarioLoot, seed: (QA_SEED ^ 0xBADC0DE) >>> 0 })
            assert(res && res.ok, 'scenario runner flagged issues (severity ' + (res ? res.severity : 'unknown') + ')')
        })

        test('stress: random damage calcs stay finite', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 992992)
            state.debug.rngIndex = 0

            const p = state.player
            p.stats.attack = 50
            p.stats.magic = 50
            p.stats.armorPen = 0
            p.stats.elementalBonuses = { fire: 10, shadow: 10 }
            p.stats.elementalResists = { fire: 0, shadow: 0 }
            ensurePlayerSpellSystems(p)

            const enemy = {
                name: 'Stress Dummy',
                hp: 500,
                maxHp: 500,
                attack: 10,
                magic: 10,
                armor: 50,
                magicRes: 50,
                elementalResists: { fire: 15, shadow: 25 },
                affinities: { resist: { fire: 0.9 }, weak: { shadow: 1.2 } }
            }
            ensureEnemyRuntime(enemy)
            state.currentEnemy = enemy

            const elems = ['fire', 'shadow', 'frost', 'holy', 'arcane', 'poison', 'lightning', null]
            for (let i = 0; i < QA_COUNTS.stressDamageIters; i++) {
                const base = randInt(1, 200, 'smoke.stress.base')
                const et = elems[randInt(0, elems.length - 1, 'smoke.stress.elem')]
                // Vary defenses/resists to catch edge cases (negative resists, high armor, etc.)
                enemy.armor = randInt(0, 220, 'smoke.stress.enemy.armor')
                enemy.magicRes = randInt(0, 220, 'smoke.stress.enemy.mres')
                enemy.elementalResists = {
                    fire: randInt(-25, 90, 'smoke.stress.enemy.er.fire'),
                    shadow: randInt(-25, 90, 'smoke.stress.enemy.er.shadow')
                }
                enemy.affinities = {
                    resist: { fire: randInt(60, 110, 'smoke.stress.enemy.af.r') / 100 },
                    weak: { shadow: randInt(100, 150, 'smoke.stress.enemy.af.w') / 100 }
                }
                const m = calcMagicDamage(base, et, enemy)
                const ph = calcPhysicalDamage(base, et, enemy)
                assert(isFiniteNum(m) && m > 0, 'magic dmg invalid at i=' + i + ': ' + m)
                assert(isFiniteNum(ph) && ph > 0, 'phys dmg invalid at i=' + i + ': ' + ph)
            }
        })

        test('stress: unlock all talents for all classes yields finite derived stats', () => {
            const classIds = Object.keys(PLAYER_CLASSES || {})
            assert(classIds.length > 0, 'no PLAYER_CLASSES')
            classIds.forEach((cid) => {
                const p = createPlayer('T', cid)
                p.level = 50
                p.talentPoints = 999

                const defs = (TALENT_DEFS && TALENT_DEFS[cid]) ? TALENT_DEFS[cid] : []
                defs.forEach((t) => {
                    if (t && t.id) unlockTalent(p, t.id)
                })

                recalcPlayerStats(p)
                const issues = qaScanNonFiniteNumbers(p, { maxIssues: 30 })
                assert(issues.length === 0, cid + ': non-finite in player after unlocks: ' + issues.join(', '))

                const s = p.stats || {}
                ;['critChance', 'dodge', 'resistAll'].forEach((k) => {
                    if (s[k] !== undefined) assert(isFiniteNum(Number(s[k])), cid + ': stat ' + k + ' invalid')
                })
            })
        })

section('State Invariants')

        // 28) invariants
        test('invariants', () => {
            const audit = validateState(state)
            if (audit && !audit.ok) {
                throw new Error('invariant issues:\n' + formatIssues(audit.issues))
            }
        })


        // Final QA: console noise should fail the suite so issues don't hide behind a "green" run.
        section('Console & Assertions')
        test('no console.error during suite', () => {
            assert(consoleErrorLog.length === 0, 'console.error called ' + consoleErrorLog.length + ' time(s)')
        })
        test('no console.assert failures during suite', () => {
            assert(consoleAssertLog.length === 0, 'console.assert failed ' + consoleAssertLog.length + ' time(s)')
        })

        // Ensure the final section is included in the per-section summary.
        if (currentSection) sectionStats.push(currentSection)

        // Update the stable top-of-report summary line now that we know totals.
        // Duration is filled in once `ms` is computed at the end.
        try {
            lines[_summaryLineIndex] = 'Ran ' + (passCount + failCount) + ' tests • Failures: ' + failCount
        } catch (_) {}

        lines.push('')
        if (sectionStats.length) {
            lines.push('Section results:')
            sectionStats.forEach((s) => {
                lines.push('  • ' + s.title + ': ' + s.pass + ' passed, ' + s.fail + ' failed')
            })
        }

        lines.push('')
        lines.push('Summary: ' + passCount + ' passed, ' + failCount + ' failed')
        if (failCount > 0) {
            lines.push('')
            lines.push('Failures:')
            failed.forEach((f, i) => {
                lines.push('  ' + (i + 1) + ') ' + f.label + ': ' + f.msg)
            })

            if (consoleErrorLog.length) {
                lines.push('')
                lines.push('console.error (first 20):')
                consoleErrorLog.slice(0, 20).forEach((x) => lines.push('  - ' + x))
                if (consoleErrorLog.length > 20) lines.push('  … +' + (consoleErrorLog.length - 20) + ' more')
            }
            if (consoleAssertLog.length) {
                lines.push('')
                lines.push('console.assert failures (first 20):')
                consoleAssertLog.slice(0, 20).forEach((x) => lines.push('  - ' + x))
                if (consoleAssertLog.length > 20) lines.push('  … +' + (consoleAssertLog.length - 20) + ' more')
            }
        }

        const ms = Date.now() - started
        // Finalize header summary with duration.
        try {
            lines[_summaryLineIndex] = 'Ran ' + (passCount + failCount) + ' tests in ' + ms + ' ms • Failures: ' + failCount
        } catch (_) {}
        lines.push('Done in ' + ms + ' ms')
        const smokeText = lines.join('\n')

        const bugReportPretty = formatBugReportBundle(_bugReportLive)
        const bugHasIssues = !!(
            (_bugReportLive && _bugReportLive.debug && Array.isArray(_bugReportLive.debug.invariantIssues) && _bugReportLive.debug.invariantIssues.length) ||
            (_bugReportLive && _bugReportLive.diagnostics && (_bugReportLive.diagnostics.lastCrashReport || _bugReportLive.diagnostics.lastSaveError)) ||
            (_bugReportLive && _bugReportLive.diagnostics && _bugReportLive.diagnostics.scanners && _bugReportLive.diagnostics.scanners.hasIssues)
        )
        return returnObject
            ? {
                ok: failCount === 0,
                // Back-compat: keep .text but make it the smoke test output only.
                text: smokeText,
                smokeText,
                passCount,
                failCount,
                totalCount: passCount + failCount,
                quickMode: _quickMode,
                failed,
                sectionStats,
                console: { errors: consoleErrorLog, asserts: consoleAssertLog },
                bugReport: _bugReportLive,
                bugReportPretty,
                bugHasIssues,
                ms
            }
            : smokeText
    } catch (e) {
        lines.push('')
        lines.push('FAILED: ' + (e && e.message ? e.message : String(e)))
        // Update summary line even on hard failure (counts may be partial).
        try { lines[_summaryLineIndex] = 'Ran ' + (passCount + failCount) + ' tests • Failures: ' + failCount } catch (_) {}
        try {
            if (e && e.stack) lines.push(e.stack)
        } catch (_) {}
        const ms = Date.now() - started
        // Finalize header summary with duration.
        try { lines[_summaryLineIndex] = 'Ran ' + (passCount + failCount) + ' tests in ' + ms + ' ms • Failures: ' + failCount } catch (_) {}
        lines.push('Done in ' + ms + ' ms')
        const smokeText = lines.join('\n')

        const bugReportPretty = formatBugReportBundle(_bugReportLive)
        const bugHasIssues = !!(
            (_bugReportLive && _bugReportLive.debug && Array.isArray(_bugReportLive.debug.invariantIssues) && _bugReportLive.debug.invariantIssues.length) ||
            (_bugReportLive && _bugReportLive.diagnostics && (_bugReportLive.diagnostics.lastCrashReport || _bugReportLive.diagnostics.lastSaveError)) ||
            (_bugReportLive && _bugReportLive.diagnostics && _bugReportLive.diagnostics.scanners && _bugReportLive.diagnostics.scanners.hasIssues)
        )
        return returnObject
            ? {
                ok: failCount === 0,
                text: smokeText,
                smokeText,
                passCount,
                failCount,
                totalCount: passCount + failCount,
                quickMode: _quickMode,
                failed,
                sectionStats,
                console: { errors: consoleErrorLog, asserts: consoleAssertLog },
                bugReport: _bugReportLive,
                bugReportPretty,
                bugHasIssues,
                ms
            }
            : smokeText
    } finally {
        // Restore console hooks.
        try {
            if (typeof console !== 'undefined') {
                if (_liveConsoleError) console.error = _liveConsoleError
                if (_liveConsoleAssert) console.assert = _liveConsoleAssert
            }
        } catch (_) {}

        // Restore global functions first.
        if (_liveSaveGame) saveGame = _liveSaveGame
        if (_liveUpdateHUD) updateHUD = _liveUpdateHUD
        if (_liveRecordInput) recordInput = _liveRecordInput

        // Restore the live save and repaint.
        _setState(live)
        syncGlobalStateRef()

        // Restore the UI write flag to whatever the live session was using.
        // Smoke tests intentionally toggle this to avoid expensive DOM work.
        try {
            if (typeof setUiDisabled === 'function') setUiDisabled(_liveUiDisabledSnap)
        } catch (_) {}

        // Restore smoke-test flag (used to disable async combat pacing during the suite)
        // BEFORE any UI refreshes. Some UI renderers (e.g., Quest Box) skip work while
        // smokeTestRunning is true.
        try {
            if (state) {
                if (!state.debug || typeof state.debug !== 'object') state.debug = {}
                state.debug.smokeTestRunning = _prevSmoke
            }
        } catch (_) {}

        // Restore pinned quest selection if smoke tests cleared it.
        try {
            if (state) {
                if (!state.quests || typeof state.quests !== 'object') state.quests = createDefaultQuestState()
                const pin = _livePinnedQuestSnap
                if (pin && pin.kind === 'main') {
                    const q = state.quests.main
                    if (q && String(q.status) === 'active') state.quests.pinned = JSON.parse(JSON.stringify(pin))
                } else if (pin && pin.kind === 'side') {
                    const side = state.quests.side && typeof state.quests.side === 'object' ? state.quests.side : {}
                    const q = side[pin.id]
                    if (q && String(q.status) === 'active') state.quests.pinned = JSON.parse(JSON.stringify(pin))
                }
            }
        } catch (_) {}

        // If a save was pending before the suite started, flush it now on the live state.
        try {
            if ((_liveSaveTimerWasActive || _liveSaveQueuedSnap) && typeof saveGame === 'function') {
                saveGame({ force: true })
            }
        } catch (_) {}

        // Ensure the live UI is refreshed back to the real save after smoke tests.
        try {
            // Quest Box can be impacted by quest-system UI writes during the suite.
            // Refresh it explicitly so the pinned quest display always matches the
            // restored live state.
            try {
                if (typeof quests !== 'undefined' && quests && typeof quests.updateQuestBox === 'function') {
                    quests.updateQuestBox()
                }
            } catch (_) {}
            if (_liveUpdateHUD) _liveUpdateHUD()
            if (_liveUpdateEnemyPanel) _liveUpdateEnemyPanel()
        } catch (_) {}

    }
}

// --- CHANGELOG MODAL --------------------------------------------------------


    return {
        runSmokeTests
    }
}
