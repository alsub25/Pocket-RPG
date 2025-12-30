// Future/Quests/questSystem.js
// Quest state + progression logic.
//
// This module keeps quest code out of Future.js. It is intentionally written as
// pure-ish functions that operate on a provided `state` object and a small set
// of injected UI/gameplay hooks (see questBindings.js).

import { QUEST_DEFS } from './questDefs.js'
import { createDefaultQuestFlags, createDefaultQuestState } from './questDefaults.js'
import { rngFloat } from '../Systems/rng.js'

function applyMissingDefaults(target, defaults) {
    for (const [k, v] of Object.entries(defaults)) {
        if (typeof target[k] === 'undefined') target[k] = v
    }
}

export function ensureQuestStructures(state) {
    if (!state) return

    if (!state.quests) state.quests = createDefaultQuestState()
    if (!state.quests.main) state.quests.main = null
    if (!state.quests.side) state.quests.side = {}

    if (!state.flags) state.flags = {}

    // Backfill quest-related flags for old saves
    applyMissingDefaults(state.flags, createDefaultQuestFlags())
}

export function initMainQuest(state) {
    ensureQuestStructures(state)
    state.quests.main = {
        id: 'main',
        name: 'Shadows over Emberwood',
        step: 0,
        status: 'active'
    }
}

export function getActiveSideQuests(state) {
    ensureQuestStructures(state)
    return Object.values(state.quests.side || {}).filter(
        (q) => q && q.status === 'active'
    )
}

export function getSideQuestStepText(q) {
    const def = q ? QUEST_DEFS.side[q.id] : null
    if (!def) return q && q.status === 'active' ? 'Quest objective unavailable.' : ''
    const stepText = def.steps && def.steps[q.step]
    if (stepText) return stepText
    return q && q.status === 'active' ? 'Quest objective unavailable.' : ''
}

export function hasAllOathSplinters(state) {
    const f = (state && state.flags) || {}
    return !!(f.oathShardSapRun && f.oathShardWitchReed && f.oathShardBoneChar)
}

export function updateQuestBox(state) {
    ensureQuestStructures(state)

    // IMPORTANT: #questTitle contains a chevron span. Writing to .textContent
    // on the header will wipe child nodes (including the chevron). We write
    // into #questTitleText when present, and fall back safely if not.
    const qTitle = document.getElementById('questTitle')
    const qTitleText = document.getElementById('questTitleText')
    const qDesc = document.getElementById('questDesc')
    if (!qTitle || !qDesc) return

    const mainQuest = state.quests.main
    const activeSide = getActiveSideQuests(state)

    if (!mainQuest && activeSide.length === 0) {
        if (qTitleText) qTitleText.textContent = 'Quests'
        else qTitle.textContent = 'Quests'
        qDesc.textContent = 'No active quests.'
        return
    }

    const lines = []

    if (mainQuest) {
        const stepLine =
            (QUEST_DEFS.main.steps && QUEST_DEFS.main.steps[mainQuest.step]) ||
            'Quest objective unavailable.'
        const mainHeader =
            'Main Quest – ' +
            (mainQuest.name || QUEST_DEFS.main.name || 'Main Quest')

        lines.push(mainHeader)
        if (mainQuest.status === 'completed') {
            lines.push('Completed.')
        } else {
            lines.push(stepLine)
        }
    }

    if (activeSide.length > 0) {
        lines.push('')
        lines.push('Side Quests – ' + activeSide.length + ' active')
        activeSide.slice(0, 3).forEach((q) => {
            const stepText = getSideQuestStepText(q)
            lines.push('• ' + q.name + (stepText ? ' — ' + stepText : ''))
        })
        if (activeSide.length > 3) {
            lines.push('• …and ' + (activeSide.length - 3) + ' more')
        }
    }

    if (qTitleText) qTitleText.textContent = 'Quests'
    else qTitle.textContent = 'Quests'
    qDesc.textContent = lines.join('\n')
}

export function startSideQuest(state, id, api = {}) {
    ensureQuestStructures(state)
    const def = QUEST_DEFS.side[id]
    if (!def) return

    if (!state.quests.side[id]) {
        state.quests.side[id] = {
            id,
            name: def.name,
            status: 'active',
            step: 0
        }

        if (typeof api.addLog === 'function') {
            api.addLog('Quest started: ' + def.name, 'system')
        }

        updateQuestBox(state)
        if (typeof api.saveGame === 'function') api.saveGame()
    }
}

export function advanceSideQuest(state, id, nextStep, api = {}) {
    ensureQuestStructures(state)
    const q = state.quests.side[id]
    if (!q || q.status !== 'active') return

    q.step = Math.max(q.step || 0, nextStep)

    if (typeof api.addLog === 'function') {
        api.addLog('Quest updated: ' + q.name, 'system')
    }

    updateQuestBox(state)
    if (typeof api.saveGame === 'function') api.saveGame()
}

export function completeSideQuest(state, id, rewardsFn, api = {}) {
    ensureQuestStructures(state)
    const q = state.quests.side[id]
    if (!q || q.status !== 'active') return

    q.status = 'completed'

    if (typeof api.addLog === 'function') {
        api.addLog('Quest completed: ' + q.name, 'good')
    }

    try {
        if (typeof rewardsFn === 'function') rewardsFn()
    } catch (_) {
        // ignore reward errors
    }

    updateQuestBox(state)
    if (typeof api.saveGame === 'function') api.saveGame()
}

export function buildProgressionAuditReport(state, meta = {}) {
    try {
        ensureQuestStructures(state)
        const lines = []
        const qMain = state?.quests?.main
        const step = qMain && typeof qMain.step === 'number' ? Math.floor(qMain.step) : null
        const status = qMain ? String(qMain.status || 'active') : 'none'
        const flags = state?.flags || {}

        lines.push('=== Progression Audit ===')
        if (meta.GAME_PATCH != null && meta.SAVE_SCHEMA != null) {
            lines.push(`Patch: ${meta.GAME_PATCH} (schema ${meta.SAVE_SCHEMA})`)
        }
        lines.push(`Area: ${state?.area || 'unknown'}`)
        lines.push(`Main Quest: ${qMain ? 'present' : 'missing'} | status=${status}${step != null ? ' | step=' + step : ''}`)
        lines.push('')

        lines.push('Unlocks:')
        const unlocks = [
            ['Ashen Marsh', !!flags.marshUnlocked],
            ['Frostpeak Pass', !!flags.frostpeakUnlocked],
            ['Sunken Catacombs', !!flags.catacombsUnlocked],
            ['Obsidian Keep', !!flags.keepUnlocked]
        ]
        unlocks.forEach(([name, on]) => lines.push(`- ${name}: ${on ? 'UNLOCKED' : 'locked'}`))
        lines.push('')

        lines.push('Boss Flags:')
        const bosses = [
            ['Goblin Warlord', !!flags.goblinBossDefeated],
            ['Void-Touched Dragon', !!flags.dragonDefeated],
            ['Marsh Witch', !!flags.marshWitchDefeated],
            ['Frostpeak Giant', !!flags.frostGiantDefeated],
            ['Sunken Lich', !!flags.lichDefeated],
            ['Obsidian King', !!flags.obsidianKingDefeated]
        ]
        bosses.forEach(([name, on]) => lines.push(`- ${name}: ${on ? 'defeated' : 'not defeated'}`))
        lines.push('')

        const warnings = []

        if (step != null) {
            if (step >= 1 && !flags.metElder) warnings.push('Main step >= 1 but metElder=false (intro may not have fired).')
            if (step >= 2 && !flags.goblinBossDefeated) warnings.push('Main step >= 2 but goblinBossDefeated=false.')
            if (step >= 3 && !flags.dragonDefeated) warnings.push('Main step >= 3 but dragonDefeated=false.')
            if (step >= 4 && !flags.marshUnlocked) warnings.push('Main step >= 4 but marshUnlocked=false (travel gate mismatch).')
            if (step >= 5 && !flags.frostpeakUnlocked) warnings.push('Main step >= 5 but frostpeakUnlocked=false.')
            if (step >= 6 && !flags.catacombsUnlocked) warnings.push('Main step >= 6 but catacombsUnlocked=false.')
            if (step >= 7 && !flags.keepUnlocked) warnings.push('Main step >= 7 but keepUnlocked=false.')

            if (step >= 9 && !flags.barkScribeMet) warnings.push('Blackbark step >= 9 but barkScribeMet=false.')
            if (step >= 11 && !hasAllOathSplinters(state)) warnings.push('Blackbark step >= 11 but not all oath splinters are collected.')
            if (step >= 12 && !flags.quietRootsTrialDone) warnings.push('Blackbark step >= 12 but quietRootsTrialDone=false.')
            if (step >= 13 && !flags.ashWardenMet) warnings.push('Blackbark step >= 13 but ashWardenMet=false.')
            if (step >= 14 && !flags.blackbarkGateFound) warnings.push('Blackbark step >= 14 but blackbarkGateFound=false.')
            if (status === 'completed' && !flags.blackbarkChoiceMade) warnings.push('Main quest completed but blackbarkChoiceMade=false.')
        }

        const side = state?.quests?.side || {}
        Object.values(side).forEach((q) => {
            if (!q || typeof q !== 'object') return
            if (!q.id || !QUEST_DEFS.side[q.id]) warnings.push(`Side quest '${q.id || 'unknown'}' is missing a definition.`)
            if (q.status === 'active' && (q.step == null || !Number.isFinite(Number(q.step)))) warnings.push(`Side quest '${q.id}' has invalid step.`)
        })

        lines.push('Warnings:')
        if (!warnings.length) lines.push('- (none found)')
        else warnings.forEach((w) => lines.push('- ' + w))
        lines.push('')

        try {
            if (step != null && QUEST_DEFS.main?.steps && QUEST_DEFS.main.steps[step]) {
                lines.push('Current Main Objective:')
                lines.push('- ' + QUEST_DEFS.main.steps[step])
            }
        } catch (_) {}

        return lines.join('\n')
    } catch (e) {
        return 'Audit failed: ' + (e && e.message ? e.message : String(e))
    }
}

export function maybeTriggerSideQuestEvent(state, areaId, api = {}) {
    ensureQuestStructures(state)

    const qs = state.quests.side || {}
    const p = state.player || { gold: 0 }

    const addLog = api.addLog
    const setScene = api.setScene
    const openModal = api.openModal
    const makeActionButton = api.makeActionButton
    const closeModal = api.closeModal
    const addItemToInventory = api.addItemToInventory

    // Helper: complete in village (or tavern) with simple rewards
    const rewardGold = (amt) => {
        if (!amt) return
        p.gold += amt
        if (typeof addLog === 'function') {
            addLog('You receive ' + amt + ' gold.', 'good')
        }
    }

    // -----------------------------------------------------------------------
    // Whispers in the Grain
    // -----------------------------------------------------------------------
    const grain = qs.grainWhispers
    if (grain && grain.status === 'active') {
        if (areaId === 'village' && grain.step === 0) {
            setScene(
                'Whispers in the Grain',
                [
                    'The storehouse keeper is pale and sweating.',
                    '"We pulled a good harvest," she insists, "but the sacks keep… emptying."',
                    '',
                    'You find neat pin‑holes in the grain sacks, as if something small and clever has been feeding without leaving footprints.',
                    '',
                    'A tavernhand mentions seeing lantern‑glints beyond the palisade — not wolves, not men… something in between.'
                ].join('\n')
            )
            advanceSideQuest(state, 'grainWhispers', 1, api)
            return true
        }
        if (areaId === 'forest' && grain.step === 1) {
            setScene(
                'Outskirts – Spoiled Tracks',
                [
                    'Near the road, you find a trail of spilled kernels leading into brush.',
                    '',
                    'The ground is alive with tiny scrapes — not claws, not boots.',
                    'Just the nervous scratch of many small mouths.'
                ].join('\n')
            )
            advanceSideQuest(state, 'grainWhispers', 2, api)
            return true
        }
        if (areaId === 'village' && grain.step === 2) {
            setScene(
                'Grain Settled',
                'You return with proof enough to calm the panic. The storehouse keeper presses coins into your hand with shaking gratitude.'
            )
            completeSideQuest(state, 'grainWhispers', () => {
                rewardGold(60)
                addItemToInventory && addItemToInventory('potionMana', 1)
            }, api)
            return true
        }
    }

    // -----------------------------------------------------------------------
    // The Missing Runner
    // -----------------------------------------------------------------------
    const runner = qs.missingRunner
    if (runner && runner.status === 'active') {
        if (areaId === 'forest' && runner.step === 0) {
            setScene(
                'The Missing Runner',
                [
                    'You find a torn strip of cloth snagged on a bramble — village weave.',
                    '',
                    'A few steps later: a satchel half‑buried in mud, its clasp broken.',
                    '',
                    'No body. No blood.',
                    'Just silence that feels arranged.'
                ].join('\n')
            )
            advanceSideQuest(state, 'missingRunner', 1, api)
            return true
        }
        if (areaId === 'village' && runner.step === 1) {
            setScene(
                'Runner’s Satchel',
                'You return with the satchel. The family doesn’t get answers, but they get something to hold — and sometimes that’s what keeps grief from turning into rage.'
            )
            completeSideQuest(state, 'missingRunner', () => rewardGold(80), api)
            // Gesture: mercy (you returned it)
            state.flags.wardenGestureMercy = true
            return true
        }
    }

    // -----------------------------------------------------------------------
    // Bark That Bleeds
    // -----------------------------------------------------------------------
    const bark = qs.barkThatBleeds
    if (bark && bark.status === 'active') {
        if (areaId === 'forest' && bark.step === 0) {
            setScene(
                'Bark That Bleeds',
                [
                    'You find the blackened tree the Bark‑Scribe described.',
                    '',
                    'Its bark flakes like old scabs. When you cut a shallow notch, sap wells up — dark, slow, and warm as if the tree is holding a secret close to its chest.',
                    '',
                    'You bottle the sample.'
                ].join('\n')
            )
            advanceSideQuest(state, 'barkThatBleeds', 2, api)
            return true
        }
    }

    // -----------------------------------------------------------------------
    // Debt of the Hearth
    // -----------------------------------------------------------------------
    const debt = qs.debtOfTheHearth
    if (debt && debt.status === 'active') {
        if (areaId === 'village' && debt.step === 0) {
            openModal &&
                openModal('Debt of the Hearth', (body) => {
                    const t = document.createElement('p')
                    t.className = 'modal-subtitle'
                    t.textContent =
                        'A tired parent asks for help paying a collector. You can pay 150 gold… or refuse.'
                    body.appendChild(t)

                    const wrap = document.createElement('div')
                    wrap.className = 'modal-actions'
                    body.appendChild(wrap)

                    const payBtn = makeActionButton('Pay (150g)', () => {
                        if (p.gold < 150) {
                            addLog && addLog('You do not have enough gold.', 'danger')
                            return
                        }
                        p.gold -= 150
                        addLog && addLog('You pay the debt. A hearth stays lit another season.', 'good')
                        state.flags.wardenGestureProtection = true
                        completeSideQuest(state, 'debtOfTheHearth', () => addItemToInventory && addItemToInventory('potionMana', 1), api)
                        closeModal && closeModal()
                    })

                    const refuseBtn = makeActionButton('Refuse', () => {
                        addLog && addLog('You refuse. The collector smiles like a knife.', 'system')
                        state.flags.wardenGestureRestraint = true // you chose not to take violence
                        completeSideQuest(state, 'debtOfTheHearth', () => rewardGold(20), api)
                        closeModal && closeModal()
                    })

                    wrap.appendChild(payBtn)
                    wrap.appendChild(refuseBtn)
                })
            advanceSideQuest(state, 'debtOfTheHearth', 1, api)
            return true
        }
    }

    // -----------------------------------------------------------------------
    // Frostpeak’s Lost Hymn
    // -----------------------------------------------------------------------
    const hymn = qs.frostpeaksHymn
    if (hymn && hymn.status === 'active') {
        if (areaId === 'frostpeak' && hymn.step === 0) {
            setScene(
                'Frostpeak’s Lost Hymn',
                [
                    'Wind scrapes the stones like a bow across a string.',
                    'In a split boulder you find a scrap of parchment, ink‑bleached but stubborn.',
                    '',
                    'A single verse survives — enough for a singer to rebuild the rest.'
                ].join('\n')
            )
            advanceSideQuest(state, 'frostpeaksHymn', 2, api)
            return true
        }
    }

    // -----------------------------------------------------------------------
    // The Witch’s Apology (simple 3‑reagent counter)
    // -----------------------------------------------------------------------
    const apology = qs.witchsApology
    if (apology && apology.status === 'active') {
        if (areaId === 'marsh') {
            if (typeof apology.progress !== 'number') apology.progress = 0
            if (apology.step === 0) apology.step = 1

            if (apology.step === 1 && apology.progress < 3) {
                apology.progress += 1
                setScene(
                    'Reagent Gathered',
                    [
                        'You gather a foul-smelling reagent from the marsh.',
                        `Reagents collected: ${apology.progress}/3.`
                    ].join('\n')
                )
                addLog && addLog('You gather a reagent for the witch’s apology.', 'system')
                updateQuestBox(state)
                api.saveGame && api.saveGame()

                if (apology.progress >= 3) {
                    apology.step = 2
                    updateQuestBox(state)
                    api.saveGame && api.saveGame()
                }
                return true
            }
        }
        if (areaId === 'village' && apology.step === 2) {
            setScene(
                'Apology Delivered',
                'You deliver the reagents. The witch does not forgive, but she does not curse you either. That is its own kind of mercy.'
            )
            completeSideQuest(state, 'witchsApology', () => rewardGold(120), api)
            return true
        }
    }

    // -----------------------------------------------------------------------
    // Hound of Old Roads
    // -----------------------------------------------------------------------
    const hound = qs.houndOfOldRoads
    if (hound && hound.status === 'active') {
        if (areaId === 'forest' && hound.step === 0) {
            setScene(
                'Hound of Old Roads',
                [
                    'You spot a massive hound — too still, too patient.',
                    '',
                    'It stops, looks back at you once — and you feel an old promise tug like a leash.',
                    '',
                    'Then it vanishes between trees, leaving only the smell of rain on stone.'
                ].join('\n')
            )
            advanceSideQuest(state, 'houndOfOldRoads', 1, api)
            return true
        }
        if (areaId === 'village' && hound.step === 1) {
            setScene('Old Roads', 'You report what you saw. The elders exchange glances that do not belong to ordinary stories.')
            completeSideQuest(state, 'houndOfOldRoads', () => rewardGold(75), api)
            return true
        }
    }

    // -----------------------------------------------------------------------
    // A Crown Without a King (two shards + choice)
    // -----------------------------------------------------------------------
    const crown = qs.crownWithoutKing
    if (crown && crown.status === 'active') {
        if (areaId === 'catacombs' && crown.step === 0) {
            setScene('Crown‑Shard', 'Half‑melted metal glints in the silt. It is shaped like authority — and it feels cold to hold.')
            advanceSideQuest(state, 'crownWithoutKing', 1, api)
            crown.found1 = true
            return true
        }
        if (areaId === 'keep' && crown.step <= 1 && !crown.found2) {
            setScene('Crown‑Shard', 'You pry a second shard from a cracked throne‑step. Power comes apart the way all brittle things do — suddenly.')
            crown.found2 = true
            crown.step = 2
            updateQuestBox(state)
            api.saveGame && api.saveGame()
            return true
        }
        if (areaId === 'village' && crown.step === 2 && crown.found1 && crown.found2 && !crown.choiceMade) {
            openModal &&
                openModal('A Crown Without a King', (body) => {
                    const t = document.createElement('p')
                    t.className = 'modal-subtitle'
                    t.textContent =
                        'Two shards in your hand. One decision in your throat. Destroy them… or sell them.'
                    body.appendChild(t)

                    const wrap = document.createElement('div')
                    wrap.className = 'modal-actions'
                    body.appendChild(wrap)

                    wrap.appendChild(
                        makeActionButton('Destroy', () => {
                            crown.choiceMade = true
                            addLog && addLog('You destroy the shards. Some temptations end quietly.', 'good')
                            completeSideQuest(state, 'crownWithoutKing', () => rewardGold(60), api)
                            closeModal && closeModal()
                        })
                    )

                    wrap.appendChild(
                        makeActionButton('Sell', () => {
                            crown.choiceMade = true
                            addLog && addLog('You sell the shards. Coin is lighter than conscience.', 'system')
                            completeSideQuest(state, 'crownWithoutKing', () => rewardGold(220), api)
                            closeModal && closeModal()
                        })
                    )
                })
            return true
        }
    }

    // -----------------------------------------------------------------------
    // Warden’s Gesture (completion computed from flags)
    // -----------------------------------------------------------------------
    const gesture = qs.wardensGesture
    if (gesture && gesture.status === 'active') {
        const f = state.flags || {}
        const done = !!(f.wardenGestureMercy && f.wardenGestureRestraint && f.wardenGestureProtection)
        if (done && !f.wardenGesturesCompleted) {
            f.wardenGesturesCompleted = true
            gesture.step = 2
            updateQuestBox(state)
            api.saveGame && api.saveGame()
        }
    }

    return false
}

export function handleExploreQuestBeats(state, areaId, api = {}) {
    ensureQuestStructures(state)

    const addLog = api.addLog
    const setScene = api.setScene
    const openModal = api.openModal
    const makeActionButton = api.makeActionButton
    const closeModal = api.closeModal
    const saveGame = api.saveGame
    const startBattleWith = api.startBattleWith
    const recalcPlayerStats = api.recalcPlayerStats
    const updateHUD = api.updateHUD

    const mainQuest = state.quests.main
    const flags = state.flags

    // --- VILLAGE ------------------------------------------------------------
    if (areaId === 'village') {
        // First visit: meet elder
        if (!flags.metElder) {
            flags.metElder = true
            if (mainQuest) mainQuest.step = 1
            setScene(
                'Elder Rowan',
                'In a lantern-lit hall, Elder Rowan explains: goblins in Emberwood Forest raid caravans. Their Warlord must fall.'
            )
            addLog && addLog('You speak with Elder Rowan and accept the task.', 'system')
            updateQuestBox(state)
            saveGame && saveGame()
            return true
        }

        // Side quest events tied to the village
        if (maybeTriggerSideQuestEvent(state, 'village', api)) return true

        // Before Goblin Warlord is dead: show this ONLY once as a hint
        if (!flags.goblinBossDefeated) {
            if (!flags.goblinWhisperShown) {
                addLog &&
                    addLog(
                        'The villagers whisper about goblins in Emberwood Forest. You can travel there any time using "Change Area".',
                        'system'
                    )
                flags.goblinWhisperShown = true
                updateQuestBox(state)
                saveGame && saveGame()
            }
            return false
        }

        // AFTER final boss is dead: kick off Chapter II
        if (flags.obsidianKingDefeated && !flags.blackbarkChapterStarted) {
            flags.epilogueShown = true
            flags.blackbarkChapterStarted = true

            // Step 8 is “return to Rowan”; we immediately point to the next lead.
            if (mainQuest) mainQuest.step = Math.max(mainQuest.step || 0, 9)

            setScene(
                'The Blackbark Oath',
                'Rowan reveals the Blackbark Oath — and sends you to the tavern to find the Bark‑Scribe.'
            )

            // Full Chapter II beat
            openModal &&
                openModal('Chapter II: The Blackbark Oath', (body) => {
                    const intro = document.createElement('p')
                    intro.className = 'modal-subtitle'
                    intro.textContent =
                        'Rowan does not celebrate. He speaks like a man handling a live ember.'
                    body.appendChild(intro)

                    const story = document.createElement('div')
                    story.style.whiteSpace = 'pre-line'
                    story.style.fontSize = '0.86rem'
                    story.style.lineHeight = '1.35'
                    story.textContent = [
                        'Elder Rowan does not celebrate. He studies you like a man reading smoke for weather.',
                        '',
                        '"You think you ended it," he says at last. "Heroes always do. Endings are easier than debts."',
                        '',
                        '"The Obsidian King was not a king. He was a cork — a black nail hammered into rotting wood."',
                        '"When you pulled him free, the realm took a breath… and the wound beneath it took one too."',
                        '',
                        'Rowan opens a cedar box you swear was not in the room a moment ago. Inside: a strip of bark, dark as old blood, etched with a vow.',
                        '',
                        'He speaks the words with the careful fear of a man handling a live ember:',
                        '“Let my life be the hinge. Let my name be the lock. Let the hungers starve behind me.”',
                        '',
                        '"That was the Blackbark Oath," Rowan whispers. "Wardens bound themselves to the heartwood beneath Emberwood — not to rule it, but to keep it sealed."',
                        '',
                        '"But oaths are living things. If no one feeds them, they don’t die."',
                        'His gaze lifts to you.',
                        '"They become hungry."',
                        '',
                        'He pushes the bark-strip toward you.',
                        '"Go to the tavern. Find the Bark‑Scribe. He writes what the forest remembers… and what someone tried to erase."'
                    ].join('\n')
                    body.appendChild(story)

                    const actions = document.createElement('div')
                    actions.className = 'modal-actions'
                    actions.appendChild(makeActionButton('Continue', () => closeModal && closeModal(), ''))
                    body.appendChild(actions)
                })

            addLog && addLog('Elder Rowan reveals the Blackbark Oath — and sends you to the Bark‑Scribe.', 'system')
            updateQuestBox(state)
            saveGame && saveGame()
            return true
        }

        // Quiet Roots Trial gate
        if (
            mainQuest &&
            mainQuest.step === 11 &&
            hasAllOathSplinters(state) &&
            !flags.quietRootsTrialDone
        ) {
            flags.quietRootsTrialDone = true
            mainQuest.step = 12

            setScene(
                'The Trial of Quiet Roots',
                [
                    'You kneel. The three splinters warm in your palm.',
                    'The tavern’s laughter outside becomes distant — like it belongs to someone else.',
                    '',
                    'The floorboards become soil.',
                    'The air becomes rain that never fell.',
                    '',
                    'Roots curl around your wrist — not binding, not harming — judging.',
                    '',
                    'A voice that is not Rowan whispers:',
                    '“Say the part you didn’t know you were saying.”',
                    '',
                    'And your mouth answers anyway:',
                    '“Let my victories be compost. Let my pride become mulch.”',
                    '',
                    'The forest approves.',
                    'That is not comfort.',
                    'That is permission.'
                ].join('\n')
            )

            addLog && addLog('You endure the Quiet Roots Trial. The next lead waits in the depths.', 'system')
            updateQuestBox(state)
            saveGame && saveGame()
            return true
        }

        // The final choice (Chapter II ending)
        if (mainQuest && mainQuest.step === 14 && !flags.blackbarkChoiceMade) {
            openModal &&
                openModal('The Blackbark Gate', (body) => {
                    const p = document.createElement('p')
                    p.className = 'modal-subtitle'
                    p.textContent =
                        'Three voices rise from the wood — Swear, Break, or Rewrite. The forest listens for what kind of person you become when something listens back.'
                    body.appendChild(p)

                    const wrap = document.createElement('div')
                    wrap.className = 'modal-actions'
                    body.appendChild(wrap)

                    const canRewrite = !!flags.wardenGesturesCompleted

                    const choose = (choiceId) => {
                        flags.blackbarkChoiceMade = true
                        flags.blackbarkChoice = choiceId
                        addLog && addLog('You choose: ' + choiceId.toUpperCase() + ' the Blackbark Oath.', 'system')

                        // Small, visible stat shift (applied in recalcPlayerStats)
                        if (typeof recalcPlayerStats === 'function') recalcPlayerStats()
                        if (typeof updateHUD === 'function') updateHUD()

                        setScene(
                            'The Oath Answers',
                            choiceId === 'swear'
                                ? 'You speak the oath aloud. The air stills. The forest does not forgive — but it allows.'
                                : choiceId === 'break'
                                ? 'You refuse the old vow. The gate exhales like a wound. Somewhere, something laughs — and something else takes note.'
                                : 'You rewrite the vow with your own words. The gate shudders… then settles, like a jaw unclenching.'
                        )

                        // Complete main quest + epilogue
                        if (state.quests && state.quests.main) {
                            state.quests.main.status = 'completed'
                        }

                        const showEpilogue = !flags.blackbarkEpilogueShown
                        flags.blackbarkEpilogueShown = true

                        // Immediate reward
                        if (!flags.blackbarkQuestRewarded) {
                            flags.blackbarkQuestRewarded = true
                            const reward = choiceId === 'rewrite' ? 250 : choiceId === 'swear' ? 200 : 180
                            state.player.gold = (state.player.gold || 0) + reward
                            addLog && addLog('Main quest completed: The Blackbark Oath. You receive ' + reward + ' gold.', 'good')
                        } else {
                            addLog && addLog('Main quest completed: The Blackbark Oath.', 'good')
                        }

                        updateQuestBox(state)
                        saveGame && saveGame()
                        closeModal && closeModal()

                        if (showEpilogue) {
                            openModal &&
                                openModal('Epilogue: The Blackbark Oath', (body2) => {
                                    const lead = document.createElement('p')
                                    lead.className = 'modal-subtitle'
                                    lead.textContent =
                                        choiceId === 'swear'
                                            ? 'You bind yourself to an old promise — and the forest marks the bargain.'
                                            : choiceId === 'break'
                                            ? 'You deny the old vow — and the forest learns your name the hard way.'
                                            : 'You rewrite the vow — and the forest adjusts, as if relieved to be understood.'
                                    body2.appendChild(lead)

                                    const story = document.createElement('div')
                                    story.style.whiteSpace = 'pre-line'
                                    story.style.fontSize = '0.86rem'
                                    story.style.lineHeight = '1.35'
                                    story.textContent =
                                        choiceId === 'swear'
                                            ? [
                                                  'The gate drinks your words.',
                                                  '',
                                                  'Sap beads along the seams of the wood like sweat.',
                                                  'Not blood. Not quite.',
                                                  '',
                                                  'Somewhere below, something that has been starving for a long time stops scraping at the inside of its cage.',
                                                  '',
                                                  'Rowan does not smile when you return.',
                                                  'He only nods, like a man who has watched a storm pass without taking the roof.',
                                                  '',
                                                  '“Then we live on borrowed peace,” he says.',
                                                  '“And we learn what it costs.”'
                                              ].join('\n')
                                            : choiceId === 'break'
                                            ? [
                                                  'Your refusal lands like a stone in a deep well.',
                                                  '',
                                                  'The gate’s seam widens. Cold air spills out — not winter-cold, but the absence of seasons.',
                                                  '',
                                                  'In the distance, you hear a laugh that is not made for throats.',
                                                  '',
                                                  'When you return, Rowan’s hands tremble for the first time.',
                                                  '“Then it will come to bargain on its own,” he whispers.',
                                                  '',
                                                  'He looks at you as if measuring whether you are enough weapon for what’s waking up.'
                                              ].join('\n')
                                            : [
                                                  'You speak new words into old wood.',
                                                  '',
                                                  'The splinters in your pocket pulse — sap, reed, bone — and the gate shivers like a jaw unclenching.',
                                                  '',
                                                  'For a heartbeat the forest feels quiet. Not safe. Quiet.',
                                                  '',
                                                  'When you return, Rowan exhales a breath he didn’t know he was holding.',
                                                  '“Wardens bound themselves to keep it asleep,” he says.',
                                                  '“You just taught it how to listen.”',
                                                  '',
                                                  'Somewhere beneath Emberwood, a hunger turns its head.',
                                                  'Not toward the village…',
                                                  'Toward you.'
                                              ].join('\n')

                                    body2.appendChild(story)

                                    const actions = document.createElement('div')
                                    actions.className = 'modal-actions'
                                    actions.appendChild(makeActionButton('Continue', () => closeModal && closeModal(), ''))
                                    body2.appendChild(actions)
                                })
                        }
                    }

                    wrap.appendChild(makeActionButton('Swear', () => choose('swear'), ''))
                    wrap.appendChild(makeActionButton('Break', () => choose('break'), ''))

                    const rewriteBtn = makeActionButton('Rewrite', () => choose('rewrite'), '')
                    if (!canRewrite) {
                        rewriteBtn.disabled = true
                        rewriteBtn.title =
                            'To rewrite the oath, complete “The Warden’s Gesture” side quest.'
                    }
                    wrap.appendChild(rewriteBtn)
                })

            return true
        }

        // Post-dragon flavor (note: original intentionally did not early-return)
        if (flags.dragonDefeated) {
            setScene(
                'Village Feast',
                'The village celebrates your victory over the Dragon. War-stories and songs greet you – but the world beyond is still dangerous.'
            )
            addLog && addLog('You are a legend here, but monsters still lurk outside Emberwood.', 'system')
            saveGame && saveGame()
        }

        return false
    }

    // --- FOREST -------------------------------------------------------------
    if (areaId === 'forest') {
        // Chapter II: splinter — Sap-Run
        if (mainQuest && mainQuest.status !== 'completed') {
            if (
                mainQuest.step >= 10 &&
                mainQuest.step <= 11 &&
                !flags.oathShardSapRun
            ) {
                flags.oathShardSapRun = true
                setScene(
                    'Oath‑Splinter: Sap‑Run',
                    [
                        'A blackened tree stands where it shouldn’t — too old for this grove, too angry for this soil.',
                        '',
                        'When you touch the bark, it flakes away like ash… and a splinter of living heartwood slips into your palm, warm as a held breath.',
                        '',
                        'For a moment you are not yourself:',
                        'Wardens in moss‑green cloaks kneel in a ring. A vow is spoken. A name is swallowed by the roots.',
                        '',
                        'Then the vision snaps.',
                        'The splinter remains.'
                    ].join('\n')
                )
                addLog && addLog('You recover an Oath‑Splinter (Sap‑Run).', 'good')

                if (hasAllOathSplinters(state)) {
                    mainQuest.step = Math.max(mainQuest.step || 0, 11)
                    addLog && addLog('All three splinters resonate. Return to Emberwood for the Quiet Roots Trial.', 'system')
                }
                updateQuestBox(state)
                saveGame && saveGame()
                return true
            }

            // Step 13: The Blackbark Gate
            if (mainQuest.step === 13 && !flags.blackbarkGateFound) {
                flags.blackbarkGateFound = true
                mainQuest.step = 14
                setScene(
                    'The Blackbark Gate',
                    [
                        'At the edge of the familiar path, the forest folds in on itself like a slow blink.',
                        '',
                        'A seam appears between two living trunks — not a door made of wood, but a wound wearing the shape of a gate.',
                        '',
                        'The air smells like rain that never fell.',
                        'The bark beneath your fingers feels… listening.',
                        '',
                        'You are not invited.',
                        'You are expected.'
                    ].join('\n')
                )
                addLog && addLog('You find the Blackbark Gate. The choice must be made in Emberwood.', 'system')
                updateQuestBox(state)
                saveGame && saveGame()
                return true
            }
        }

        if (maybeTriggerSideQuestEvent(state, 'forest', api)) return true

        // Goblin Warlord encounter chance (quest progression)
        if (!flags.goblinBossDefeated) {
            if (rngFloat(null, 'quest.eventRoll') < 0.3) {
                setScene(
                    "Goblin Warlord's Camp",
                    "After following tracks and ash, you discover the Goblin Warlord's fortified camp."
                )
                addLog && addLog('The Goblin Warlord roars a challenge!', 'danger')
                startBattleWith && startBattleWith('goblinBoss')
                return true
            }
        }

        return false
    }

    // --- RUINS --------------------------------------------------------------
    if (areaId === 'ruins') {
        if (!flags.dragonDefeated) {
            if (rngFloat(null, 'quest.eventRoll') < 0.4) {
                setScene(
                    'The Ruined Spire',
                    'Atop a crumbling spire, the Void-Touched Dragon coils around shards of crystal, hatred in its eyes.'
                )
                addLog && addLog('The Void-Touched Dragon descends from the darkness!', 'danger')
                startBattleWith && startBattleWith('dragon')
                return true
            }
        }
        return false
    }

    // --- ASHEN MARSH --------------------------------------------------------
    if (areaId === 'marsh') {
        if (mainQuest && mainQuest.status !== 'completed') {
            if (
                mainQuest.step >= 10 &&
                mainQuest.step <= 11 &&
                !flags.oathShardWitchReed
            ) {
                flags.oathShardWitchReed = true
                setScene(
                    'Oath‑Splinter: Witch‑Reed',
                    [
                        'You part the reeds and find them braided into a deliberate knot — a warding sign, half‑rotted, half‑remembered.',
                        '',
                        'A splinter of heartwood is caught inside the braid like a thorn in a sleeve.',
                        '',
                        'When you pull it free, you taste copper and winter.',
                        'A promise spoken in a language that hates to be spoken.'
                    ].join('\n')
                )
                addLog && addLog('You recover an Oath‑Splinter (Witch‑Reed).', 'good')

                if (hasAllOathSplinters(state)) {
                    mainQuest.step = Math.max(mainQuest.step || 0, 11)
                    addLog && addLog('All three splinters resonate. Return to Emberwood for the Quiet Roots Trial.', 'system')
                }
                updateQuestBox(state)
                saveGame && saveGame()
                return true
            }
        }

        if (maybeTriggerSideQuestEvent(state, 'marsh', api)) return true

        if (!flags.marshWitchDefeated) {
            if (rngFloat(null, 'quest.eventRoll') < 0.35) {
                setScene(
                    'Witchlight Fen',
                    'A pale lantern-fog rolls over the marsh. Cackling laughter echoes as the Marsh Witch steps from the mire.'
                )
                addLog && addLog('The Marsh Witch emerges from the brackish gloom!', 'danger')
                startBattleWith && startBattleWith('marshWitch')
                return true
            }
        }

        return false
    }

    // --- FROSTPEAK PASS -----------------------------------------------------
    if (areaId === 'frostpeak') {
        if (maybeTriggerSideQuestEvent(state, 'frostpeak', api)) return true

        if (!flags.frostGiantDefeated) {
            if (rngFloat(null, 'quest.eventRoll') < 0.35) {
                setScene(
                    'Frostpeak Ridge',
                    'Snow whips like knives. The Frostpeak Giant towers above the pass, blocking your way with a bellow.'
                )
                addLog && addLog('The Frostpeak Giant challenges you!', 'danger')
                startBattleWith && startBattleWith('frostGiant')
                return true
            }
        }
        return false
    }

    // --- SUNKEN CATACOMBS ---------------------------------------------------
    if (areaId === 'catacombs') {
        if (mainQuest && mainQuest.status !== 'completed') {
            // Step 10: Bone‑Char splinter
            if (
                mainQuest.step >= 10 &&
                mainQuest.step <= 11 &&
                !flags.oathShardBoneChar
            ) {
                flags.oathShardBoneChar = true
                setScene(
                    'Oath‑Splinter: Bone‑Char',
                    [
                        'A rib‑cage half buried in silt forms a crude altar.',
                        'Someone arranged the bones with care — not devotion, but apology.',
                        '',
                        'In the hollow of a skull, you find a charred splinter of heartwood.',
                        'It is light as ash and heavy as guilt.'
                    ].join('\n')
                )
                addLog && addLog('You recover an Oath‑Splinter (Bone‑Char).', 'good')

                if (hasAllOathSplinters(state)) {
                    mainQuest.step = Math.max(mainQuest.step || 0, 11)
                    addLog && addLog('All three splinters resonate. Return to Emberwood for the Quiet Roots Trial.', 'system')
                }
                updateQuestBox(state)
                saveGame && saveGame()
                return true
            }

            // Step 12: Ash‑Warden encounter
            if (mainQuest.step === 12 && !flags.ashWardenMet) {
                flags.ashWardenMet = true
                mainQuest.step = 13

                setScene(
                    'The Warden in Ash',
                    [
                        'A figure stands where the tunnel narrows — armor powdered into gray dust, eyes like coals in a hearth that hates to go out.',
                        '',
                        '"You carry the stink of endings," it says.',
                        '"But you don’t carry the weight."',
                        '',
                        '"They told you monsters were invaders. No. They were refugees from the places the oath could no longer seal."',
                        '',
                        '"The oath didn’t fail."',
                        '"It was harvested."',
                        '',
                        'The ash‑warden leans closer, and the air tastes of burnt names:',
                        '"You are either the last honest knife in a dishonest world… or the next hand to hold the theft."'
                    ].join('\n')
                )

                addLog && addLog('You meet the Ash‑Warden. The Blackbark Gate waits in Emberwood Forest.', 'system')
                updateQuestBox(state)
                saveGame && saveGame()
                return true
            }
        }

        if (maybeTriggerSideQuestEvent(state, 'catacombs', api)) return true

        if (!flags.lichDefeated) {
            if (rngFloat(null, 'quest.eventRoll') < 0.35) {
                setScene(
                    'Drowned Sanctum',
                    'Water drips from vaulted stone. A cold voice chants from the dark — the Sunken Lich rises to meet you.'
                )
                addLog && addLog('The Sunken Lich awakens!', 'danger')
                startBattleWith && startBattleWith('lich')
                return true
            }
        }
        return false
    }

    // --- OBSIDIAN KEEP ------------------------------------------------------
    if (areaId === 'keep') {
        if (maybeTriggerSideQuestEvent(state, 'keep', api)) return true

        if (!flags.obsidianKingDefeated) {
            if (rngFloat(null, 'quest.eventRoll') < 0.4) {
                setScene(
                    'The Throne of Glass',
                    'Obsidian walls hum with voidlight. The Obsidian King descends from his throne, blade and sorcery entwined.'
                )
                addLog && addLog('The Obsidian King will not yield his realm!', 'danger')
                startBattleWith && startBattleWith('obsidianKing')
                return true
            }
        }
        return false
    }

    return false
}

export function applyQuestProgressOnEnemyDefeat(state, enemy, api = {}) {
    ensureQuestStructures(state)
    if (!enemy || !enemy.id) return false

    const addLog = api.addLog
    const setScene = api.setScene

    const mainQuest = state.quests.main
    const flags = state.flags

    if (enemy.id === 'goblinBoss') {
        flags.goblinBossDefeated = true
        if (mainQuest) mainQuest.step = Math.max(mainQuest.step || 0, 2)
        addLog && addLog('The Goblin Warlord falls. The forest grows quieter.', 'system')
        setScene &&
            setScene(
                'Emberwood Forest – Cleared',
                'You stand over the fallen Goblin Warlord. The path to the Ruined Spire reveals itself in the distance.'
            )
        state.area = 'ruins'
        updateQuestBox(state)
        return true
    }

    if (enemy.id === 'dragon') {
        flags.dragonDefeated = true
        flags.marshUnlocked = true
        if (mainQuest) mainQuest.step = Math.max(mainQuest.step || 0, 3)
        addLog && addLog('With a final roar, the Void‑Touched Dragon collapses.', 'system')
        setScene &&
            setScene(
                'Ruined Spire – Silent',
                'The Dragon is slain. Yet the void‑sickness in the land does not fade — something deeper still feeds it.'
            )
        updateQuestBox(state)
        return true
    }

    if (enemy.id === 'marshWitch') {
        flags.marshWitchDefeated = true
        flags.frostpeakUnlocked = true
        if (mainQuest) mainQuest.step = Math.max(mainQuest.step || 0, 4)
        addLog && addLog('The Marsh Witch dissolves into ash and stagnant water.', 'system')
        setScene &&
            setScene(
                'Ashen Marsh – Quiet',
                'The fen’s lantern‑fog thins. A cold wind points north — toward the mountains.'
            )
        updateQuestBox(state)
        return true
    }

    if (enemy.id === 'frostGiant') {
        flags.frostGiantDefeated = true
        flags.catacombsUnlocked = true
        if (mainQuest) mainQuest.step = Math.max(mainQuest.step || 0, 5)
        addLog && addLog('The Frostpeak Giant crashes into the snow with a thunderous boom.', 'system')
        setScene &&
            setScene(
                'Frostpeak Pass – Open',
                'The pass is cleared. Beneath the meltwater, old stone steps sink into darkness — the entrance to sunken catacombs.'
            )
        updateQuestBox(state)
        return true
    }

    if (enemy.id === 'lich') {
        flags.lichDefeated = true
        flags.keepUnlocked = true
        if (mainQuest) mainQuest.step = Math.max(mainQuest.step || 0, 6)
        addLog && addLog('The Sunken Lich’s phylactery cracks, and the chanting finally stops.', 'system')
        setScene &&
            setScene(
                'Catacombs – Still',
                'The dead are quiet. Far away, a black keep drinks the horizon — the corruption’s heart.'
            )
        updateQuestBox(state)
        return true
    }

    if (enemy.id === 'obsidianKing') {
        flags.obsidianKingDefeated = true
        if (mainQuest) mainQuest.step = Math.max(mainQuest.step || 0, 7)
        addLog && addLog('The Obsidian King falls, and the keep’s voidlight gutters like a dying candle.', 'system')
        setScene &&
            setScene(
                'Obsidian Keep – Shattered',
                'The throne stands empty. Return to Emberwood and speak with Elder Rowan.'
            )
        updateQuestBox(state)
        return true
    }

    return false
}
