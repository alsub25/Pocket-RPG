/**
 * explorationManager.js
 * Manages area exploration, encounters, and world time progression.
 */

import { RANDOM_ENCOUNTERS } from '../../data/randomEncounters.js'

export function createExplorationManager(deps) {
    const {
        state,
        rand,
        randInt,
        addLog,
        setScene,
        renderActions,
        requestSave,
        recordInput,
        advanceWorldTime,
        formatTimeShort,
        updateTimeDisplay,
        updateAreaMusic,
        ensureCombatPointers,
        startBattleWith,
        handlePlayerDefeat,
        finiteNumber,
        openMerchantModal,
        quests
    } = deps

    function exploreArea() {
        const p = state.player
        if (p && finiteNumber(p.hp, 0) <= 0) {
            if (state.flags && state.flags.godMode) {
                p.hp = 1
            } else {
                // If the player is defeated, keep them on the defeat screen.
                handlePlayerDefeat()
                return
            }
        }

        // Guard: never run exploration logic while in combat (prevents state corruption).
        if (state && state.inCombat) {
            try { ensureCombatPointers() } catch (_) {}
            addLog('You cannot explore while in combat.', 'danger')
            return
        }

        const area = state.area
        recordInput('explore', { area })

        // Advance world time by one part-of-day whenever you explore
        // (Patch 1.2.52: unified world tick pipeline)
        const timeStep = advanceWorldTime(state, 1, 'explore', { addLog })
        const timeLabel = formatTimeShort(timeStep.after)

        if (timeStep.dayChanged) {
            addLog('A new day begins in Emberwood. ' + timeLabel + '.', 'system')
        } else {
            addLog('Time passes... ' + timeLabel + '.', 'system')
        }

        updateTimeDisplay()
        // NEW: update ambient music based on area + time
        updateAreaMusic(state)

        // Daily ticks are handled inside advanceWorldTime() when the day changes.

        // --- QUESTS (modularized) ------------------------------------------------
        // Handles main-quest story beats, side-quest events, and boss triggers.
        if (quests.handleExploreQuestBeats(area)) return

        // --- WANDERING MERCHANT (outside village) ---------------------------------
        if (area !== 'village') {
            // Small chance each explore click to meet a traveling merchant
            if (rand('encounter.rare') < 0.1) {
                let sceneText =
                    'Along the road, a lone cart creaks to a stop. A cloaked figure raises a hand in greeting.'

                if (area === 'forest') {
                    sceneText =
                        'Deeper in the forest, a lantern glows between the trees - a traveling merchant has set up a tiny camp.'
                } else if (area === 'ruins') {
                    sceneText =
                        'Among the shattered stones of the Spire, a daring merchant has laid out wares on a cracked pillar.'
                }

                setScene('Wandering Merchant', sceneText)
                addLog(
                    'You encounter a wandering merchant on your travels.',
                    'system'
                )
                openMerchantModal('wandering') // NEW: different context
                requestSave('legacy')
                return
            }
        }

        // --- GENERIC RANDOM ENCOUNTER LOGIC ---------------------------------------
        const encounterList = RANDOM_ENCOUNTERS[area] || []
        if (encounterList.length && rand('encounter.listUse') < 0.7) {
            const id =
                encounterList[randInt(0, encounterList.length - 1, 'encounter.listPick')]
            startBattleWith(id)
            return
        }

        // --- NO ENCOUNTER: FLAVOR TEXT --------------------------------------------
        let title = 'Exploring'
        let text =
            'You search the surroundings but find only rustling leaves and distant cries.'

        if (area === 'village') {
            title = 'Emberwood Village'
            text =
                'You wander the streets of Emberwood. The tavern buzzes, the market clinks with coin, and gossip drifts on the air.'
        } else if (area === 'ruins' && state.flags.dragonDefeated) {
            title = 'Quiet Ruins'
            text =
                'The Spire lies quiet now, yet echoes of past horrors linger. Lesser creatures still prowl the broken halls.'
        } else if (area === 'forest' && state.flags.goblinBossDefeated) {
            title = 'Calmer Forest'
            text =
                'With the Warlord gone, Emberwood Forest feels less hostile - but not entirely safe.'
        }

        setScene(title, text)
        addLog('You explore cautiously. For now, nothing attacks.', 'system')

        // [check] Make sure the actions bar matches the *current* area
        renderActions()

        requestSave('legacy')
    }

    return {
        exploreArea
    }
}
