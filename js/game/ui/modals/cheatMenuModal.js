// js/game/ui/modals/cheatMenuModal.js
// Cheat Menu UI extraction from gameOrchestrator.js
//
// This module owns the cheat menu modal builder + debug/cheat functionality.
// It depends on engine-provided helpers via dependency injection to avoid
// circular imports and to keep gameOrchestrator.js focused on orchestration.

export function createCheatMenuModal(deps) {
    if (!deps || typeof deps.getState !== 'function') {
        throw new Error('createCheatMenuModal: missing deps.getState()')
    }

    const {
        getState,
        openModal,
        closeModal,
        setModalOnClose,
        addLog,
        updateHUD,
        requestSave,
        grantExperience,
        handleEnemyDefeat,
        cheatMaxLevel,
        getAreaDisplayName,
        recalcPlayerStats,
        generateLootDrop,
        generateArmorForSlot,
        getItemPowerScore,
        addGeneratedItemToInventory,
        createDefaultQuestFlags,
        createDefaultQuestState,
        QUEST_DEFS,
        quests,
        updateEnemyPanel
    } = deps

    if (typeof openModal !== 'function') {
        throw new Error('createCheatMenuModal: missing openModal()')
    }

/* =============================================================================
 * CHEAT MENU
 * Testing actions: spawn battles, teleport, grant items, force events, diagnostics.
 * ============================================================================= */

function openCheatMenu() {
    openModal('Cheat Menu', (body) => {
        const state = getState()
        body.classList.add('cheat-modal') // match changelog font sizing/feel
        const p = state.player

        const info = document.createElement('p')
        info.className = 'modal-subtitle'
        info.textContent =
            'Debug / cheat options for testing. They instantly modify your current save.'
        body.appendChild(info)

        // Quick controls: search + expand/collapse (keeps the same "pill + muted" aesthetic)
        const toolbar = document.createElement('div')
        toolbar.className = 'cheat-toolbar'

        const searchWrap = document.createElement('div')
        searchWrap.className = 'cheat-search-wrap'

        const search = document.createElement('input')
        search.type = 'text'
        search.className = 'inv-search cheat-search'
        search.placeholder = 'Search cheats…'
        search.setAttribute('aria-label', 'Search cheats')
        searchWrap.appendChild(search)

        const btnExpandAll = document.createElement('button')
        btnExpandAll.className = 'btn small outline'
        btnExpandAll.textContent = 'Expand All'

        const btnCollapseAll = document.createElement('button')
        btnCollapseAll.className = 'btn small outline'
        btnCollapseAll.textContent = 'Collapse All'

        toolbar.appendChild(searchWrap)
        toolbar.appendChild(btnExpandAll)
        toolbar.appendChild(btnCollapseAll)
        body.appendChild(toolbar)

        const statusBar = document.createElement('div')
        statusBar.className = 'cheat-statusbar'
        body.appendChild(statusBar)

        // Keep the stat pills readable and constrained: hard cap at ≤2 rows on narrow screens.
        // We never scroll this bar; instead we (1) keep the pill count compact by combining
        // secondary stats, and (2) auto-scale text/padding until it fits.
        function fitCheatStatusbarTwoRows() {
            if (!statusBar) return

            // Reset to defaults each time so it can grow back on rotation / wider screens.
            statusBar.classList.remove('two-row-scroll')
            statusBar.classList.remove('two-row-clamp')
            statusBar.classList.remove('two-row-compact')
            // Restore full labels if we previously compacted them.
            Array.from(statusBar.querySelectorAll('.cheat-stat')).forEach((el) => {
                if (el && el.dataset && el.dataset.full) el.textContent = el.dataset.full
            })
            statusBar.style.setProperty('--cheat-stat-font', '11.5px')
            statusBar.style.setProperty('--cheat-stat-padY', '3px')
            statusBar.style.setProperty('--cheat-stat-padX', '8px')
            statusBar.style.setProperty('--cheat-stat-gap', '4px')

            const pills = () => Array.from(statusBar.querySelectorAll('.cheat-stat'))
            const rowCount = () => {
                const tops = new Set()
                pills().forEach((el) => tops.add(el.offsetTop))
                return tops.size
            }

            let font = 11.5
            let padY = 3
            let padX = 8

            // Small iterative shrink until we get to two rows or hit our floor.
            for (let i = 0; i < 18; i++) {
                if (rowCount() <= 2) return
                if (font <= 8) break
                font = Math.max(8, font - 0.75)
                padY = Math.max(2, padY - 0.25)
                padX = Math.max(5, padX - 0.35)
                statusBar.style.setProperty('--cheat-stat-font', font + 'px')
                statusBar.style.setProperty('--cheat-stat-padY', padY + 'px')
                statusBar.style.setProperty('--cheat-stat-padX', padX + 'px')
            }

            // If we're still above 2 rows at minimum scale, clamp the widest pills.
            if (rowCount() > 2) {
                statusBar.classList.add('two-row-clamp')
                return
            }
        }

        const _cheatResizeHandler = () => {
            requestAnimationFrame(() => fitCheatStatusbarTwoRows())
        }
        window.addEventListener('resize', _cheatResizeHandler)
        setModalOnClose(() => {
            window.removeEventListener('resize', _cheatResizeHandler)
        })

        function renderCheatStatus() {
            statusBar.innerHTML = ''

            function addStat(txt, extraClass, shortTxt) {
                const el = document.createElement('span')
                el.className = extraClass
                    ? 'cheat-stat ' + extraClass
                    : 'cheat-stat'
                el.textContent = txt
                if (shortTxt) el.dataset.full = txt
                statusBar.appendChild(el)
                return el
            }

            addStat('Level ' + p.level)
            addStat(p.gold + 'g')
            addStat(
                (state && state.time && typeof state.time.dayIndex === 'number'
                    ? Math.floor(Number(state.time.dayIndex))
                    : 0) + 'd'
            )
            const part =
                state && state.time && state.time.part
                    ? String(state.time.part)
                    : ''
            const area = state && state.area ? getAreaDisplayName(state.area) : ''
            addStat(part, 'muted', 'Time')
            addStat(area, 'muted', 'Area')
            const critLabel = state.flags.alwaysCrit
                ? 'Always'
                : state.flags.neverCrit
                  ? 'Never'
                  : 'Normal'

            // Responsive pill: on narrow screens we use a compact label that fits on one line.
            const godCritPill = addStat(
                'God ' + (state.flags.godMode ? 'ON' : 'OFF') + ' • Crit ' + critLabel,
                'muted',
                'God ' + (state.flags.godMode ? 'ON' : 'OFF') + ' • C ' + critLabel.slice(0, 1)
            )

            // Now we resize on next frame.
            requestAnimationFrame(() => fitCheatStatusbarTwoRows())
        }

        renderCheatStatus()

        // The main scrollable body for sections.
        const scrollBody = document.createElement('div')
        scrollBody.className = 'cheat-content'
        body.appendChild(scrollBody)

        // Track all collapsible sections
        const cheatSections = []

        function makeCheatSection(titleText, expandedByDefault) {
            const section = document.createElement('div')
            section.className = 'char-section'

            const header = document.createElement('div')
            header.className = 'char-section-title'
            header.style.cursor = 'pointer'
            header.textContent = titleText

            const sectionBody = document.createElement('div')
            sectionBody.style.display = expandedByDefault ? '' : 'none'

            section.appendChild(header)
            section.appendChild(sectionBody)
            scrollBody.appendChild(section)

            function setOpen(open) {
                sectionBody.style.display = open ? '' : 'none'
            }

            header.addEventListener('click', () => {
                const isOpen = sectionBody.style.display !== 'none'
                setOpen(!isOpen)
            })

            const entry = { section, body: sectionBody, defaultOpen: expandedByDefault, setOpen }
            cheatSections.push(entry)

            return entry
        }

        // Expand / Collapse
        btnExpandAll.addEventListener('click', () => {
            cheatSections.forEach((s) => s.setOpen(true))
        })
        btnCollapseAll.addEventListener('click', () => {
            cheatSections.forEach((s) => s.setOpen(false))
        })

        // --- Core Section (top pills + basic cheats) --------------------------
        const coreSec = makeCheatSection('Core Cheats', true)
        const coreContent = coreSec.body

        // Row 1 – Gold / XP / Max Level
        const btnRow1 = document.createElement('div')
        btnRow1.className = 'item-actions'

        const btnGold = document.createElement('button')
        btnGold.className = 'btn small'
        btnGold.textContent = '+1000 Gold'
        btnGold.addEventListener('click', () => {
            p.gold += 1000
            addLog('Cheat: conjured 1000 gold.', 'system')
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        const btnXp = document.createElement('button')
        btnXp.className = 'btn small'
        btnXp.textContent = '+100 XP'
        btnXp.addEventListener('click', () => {
            grantExperience(100)
            renderCheatStatus()
        })

        const btnMax = document.createElement('button')
        btnMax.className = 'btn small'
        btnMax.textContent = 'Max Level'
        btnMax.addEventListener('click', () => {
            cheatMaxLevel({ openModal: true })
        })

        btnRow1.appendChild(btnGold)
        btnRow1.appendChild(btnXp)
        btnRow1.appendChild(btnMax)
        coreContent.appendChild(btnRow1)

        // Row 2 – Heal / Slay Enemy
        const btnRow2 = document.createElement('div')
        btnRow2.className = 'item-actions'

        const btnHeal = document.createElement('button')
        btnHeal.className = 'btn small'
        btnHeal.textContent = 'Full Heal'
        btnHeal.addEventListener('click', () => {
            p.hp = p.maxHp
            p.resource = p.maxResource
            addLog(
                'Cheat: fully restored health and ' + p.resourceName + '.',
                'system'
            )
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        const btnKill = document.createElement('button')
        btnKill.className = 'btn small'
        btnKill.textContent = 'Slay Enemy'
        btnKill.addEventListener('click', () => {
            if (state.inCombat && state.currentEnemy) {
                state.currentEnemy.hp = 0
                addLog('Cheat: enemy instantly defeated.', 'danger')
                handleEnemyDefeat()
            } else {
                addLog('No enemy to slay right now.', 'system')
            }
        })

        btnRow2.appendChild(btnHeal)
        btnRow2.appendChild(btnKill)
        coreContent.appendChild(btnRow2)

        // Row 3 – God Mode / Always Crit
        const btnRow3 = document.createElement('div')
        btnRow3.className = 'item-actions'

        const btnGod = document.createElement('button')
        btnGod.className = 'btn small'
        btnGod.textContent =
            (state.flags.godMode ? 'Disable' : 'Enable') + ' God Mode'
        btnGod.addEventListener('click', () => {
            state.flags.godMode = !state.flags.godMode
            addLog(
                'God Mode ' +
                    (state.flags.godMode ? 'enabled' : 'disabled') +
                    '.',
                'system'
            )
            btnGod.textContent =
                (state.flags.godMode ? 'Disable' : 'Enable') + ' God Mode'
            renderCheatStatus()
            updateHUD()
            requestSave('legacy')
        })

        const btnCrit = document.createElement('button')
        btnCrit.className = 'btn small'
        btnCrit.textContent = state.flags.alwaysCrit
            ? 'Normal Crits'
            : 'Always Crit'

        const btnNeverCrit = document.createElement('button')
        btnNeverCrit.className = 'btn small'
        btnNeverCrit.textContent = state.flags.neverCrit
            ? 'Allow Crits'
            : 'Never Crit'

        btnCrit.addEventListener('click', () => {
            state.flags.alwaysCrit = !state.flags.alwaysCrit
            if (state.flags.alwaysCrit) state.flags.neverCrit = false
            addLog(
                'Always-crit mode ' +
                    (state.flags.alwaysCrit ? 'enabled' : 'disabled') +
                    '.',
                'system'
            )
            btnCrit.textContent = state.flags.alwaysCrit
                ? 'Normal Crits'
                : 'Always Crit'
            btnNeverCrit.textContent = state.flags.neverCrit
                ? 'Allow Crits'
                : 'Never Crit'
            renderCheatStatus()
            requestSave('legacy')
        })

        btnNeverCrit.addEventListener('click', () => {
            state.flags.neverCrit = !state.flags.neverCrit
            if (state.flags.neverCrit) state.flags.alwaysCrit = false
            addLog(
                'Never-crit mode ' +
                    (state.flags.neverCrit ? 'enabled' : 'disabled') +
                    '.',
                'system'
            )
            btnCrit.textContent = state.flags.alwaysCrit
                ? 'Normal Crits'
                : 'Always Crit'
            btnNeverCrit.textContent = state.flags.neverCrit
                ? 'Allow Crits'
                : 'Never Crit'
            renderCheatStatus()
            requestSave('legacy')
        })

        btnRow3.appendChild(btnGod)
        btnRow3.appendChild(btnCrit)
        btnRow3.appendChild(btnNeverCrit)
        coreContent.appendChild(btnRow3)

        // Row 4 – Difficulty Dropdown + Set Difficulty + Primordial mode
        const btnRow4 = document.createElement('div')
        btnRow4.className = 'item-actions'

        const diffSelect = document.createElement('select')
        diffSelect.className = 'input'
        ;['easy', 'normal', 'hard', 'dynamic'].forEach((id) => {
            const opt = document.createElement('option')
            opt.value = id
            opt.textContent = id.charAt(0).toUpperCase() + id.slice(1)
            diffSelect.appendChild(opt)
        })
        diffSelect.value = state && state.difficulty ? state.difficulty : 'normal'

        const btnSetDiff = document.createElement('button')
        btnSetDiff.className = 'btn small'
        btnSetDiff.textContent = 'Set Difficulty'
        btnSetDiff.addEventListener('click', () => {
            state.difficulty = diffSelect.value || 'normal'
            addLog(
                'Cheat: difficulty set to "' + state.difficulty + '."',
                'system'
            )
            requestSave('legacy')
            renderCheatStatus()
        })

        const btnPrime = document.createElement('button')
        btnPrime.className = 'btn small outline'
        btnPrime.textContent = state.flags.primordialMode
            ? 'Prime Mode ON'
            : 'Prime Mode OFF'
        btnPrime.addEventListener('click', () => {
            state.flags.primordialMode = !state.flags.primordialMode
            addLog(
                'Primordial mode ' +
                    (state.flags.primordialMode ? 'enabled' : 'disabled') +
                    '.',
                'system'
            )
            btnPrime.textContent = state.flags.primordialMode
                ? 'Prime Mode ON'
                : 'Prime Mode OFF'
            requestSave('legacy')
            renderCheatStatus()
        })

        btnRow4.appendChild(diffSelect)
        btnRow4.appendChild(btnSetDiff)
        btnRow4.appendChild(btnPrime)
        coreContent.appendChild(btnRow4)

        // --- Story / Main Quest ------------------------------------------
        // Chapter/beat jump helpers so you can quickly test story segments.
        // NOTE: These overwrite quest flags in the current save.
        const storySec = makeCheatSection('Story / Main Quest', false)
        const storyContent = storySec.body

        const storyInfo = document.createElement('p')
        storyInfo.className = 'modal-subtitle'
        storyInfo.textContent =
            'Jump the main story to a chapter/beat for testing. This rewrites quest flags in your current save.'
        storyContent.appendChild(storyInfo)

        function makeCheatCheck(labelText, defaultOn) {
            const wrap = document.createElement('label')
            wrap.style.display = 'flex'
            wrap.style.alignItems = 'center'
            wrap.style.gap = '8px'
            wrap.style.fontSize = '0.85rem'
            wrap.style.opacity = '0.9'

            const cb = document.createElement('input')
            cb.type = 'checkbox'
            cb.checked = !!defaultOn

            const t = document.createElement('span')
            t.textContent = labelText

            wrap.appendChild(cb)
            wrap.appendChild(t)
            return { wrap, input: cb }
        }

        const storyToggles = document.createElement('div')
        storyToggles.className = 'item-actions'

        const chkReset = makeCheatCheck('Reset story flags (clean test)', true)
        const chkFill = makeCheatCheck('Auto-fill required unlocks/flags', true)
        const chkEnv = makeCheatCheck('Auto-set recommended area/time', true)
        storyToggles.appendChild(chkReset.wrap)
        storyToggles.appendChild(chkFill.wrap)
        storyToggles.appendChild(chkEnv.wrap)
        storyContent.appendChild(storyToggles)

        const choiceRow = document.createElement('div')
        choiceRow.className = 'item-actions'

        const choiceLabel = document.createElement('span')
        choiceLabel.className = 'tag'
        choiceLabel.textContent = 'Blackbark choice'

        const choiceSelect = document.createElement('select')
        choiceSelect.className = 'input'
        ;['swear', 'break', 'rewrite'].forEach((id) => {
            const opt = document.createElement('option')
            opt.value = id
            opt.textContent = id.charAt(0).toUpperCase() + id.slice(1)
            choiceSelect.appendChild(opt)
        })
        choiceSelect.value =
            (state && state.flags && state.flags.blackbarkChoice)
                ? String(state.flags.blackbarkChoice)
                : 'rewrite'

        choiceRow.appendChild(choiceLabel)
        choiceRow.appendChild(choiceSelect)
        storyContent.appendChild(choiceRow)

        const STORY_PRESETS = [
            { id: 'ch1_start', label: 'Chapter I — Start (Step 0)', step: 0, area: 'village', partIndex: 0 },
            { id: 'ch1_captain', label: 'Chapter I — Captain Elara Briefing (Step 0.25)', step: 0.25, area: 'village', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, ch1CaptainBriefed: false } },
            { id: 'ch1_scribe', label: 'Chapter I — Bark‑Scribe Intel (Step 0.5)', step: 0.5, area: 'village', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, ch1ScribeTrailsLearned: false } },
            { id: 'ch1_salve', label: 'Chapter I — Bitterleaf Salve (Step 0.75)', step: 0.75, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_raiders', label: 'Chapter I — Raiders (Step 1)', step: 1, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_snareline', label: 'Chapter I — Snareline (Trapper) (Step 1.1)', step: 1.1, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_supply', label: 'Chapter I — Supply Route (Step 1.2)', step: 1.2, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_cache', label: 'Chapter I — Cache Fire (Packmaster) (Step 1.25)', step: 1.25, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_drums', label: 'Chapter I — War Drums (Step 1.3)', step: 1.3, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_captain_fight', label: 'Chapter I — Captain's Trail (Step 1.4)', step: 1.4, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, ch1SigilRecovered: false } },
            { id: 'ch1_warlord_ready', label: 'Chapter I — Warlord Hunt Ready (Sigil Recovered)', step: 1.4, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, ch1SigilRecovered: true, ch1CaptainDefeated: true } },
            { id: 'ch1_rowan_warlord', label: 'Chapter I — Rowan Debrief (After Warlord) (Step 1.5)', step: 1.5, area: 'village', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, goblinBossDefeated: true, goblinRowanDebriefShown: false, goblinRowanDebriefPending: true } },
            { id: 'ch2_intro', label: 'Chapter II — Start (Intro in Village)', step: 7, area: 'village', partIndex: 0, force: { blackbarkChapterStarted: false } },
            { id: 'ch2_bark', label: 'Chapter II — Bark‑Scribe (Step 9)', step: 9, area: 'village', partIndex: 0 },
            { id: 'ch2_rowan_reveal', label: 'Chapter II — Rowan's Revelation (Step 8)', step: 8, area: 'village', partIndex: 0 },
            { id: 'ch2_elara', label: 'Chapter II — Tallies (Elara) (Step 8.25)', step: 8.25, area: 'village', partIndex: 0 },
            { id: 'ch2_splinters', label: 'Chapter II — Oath‑Splinters (Step 10)', step: 10, area: 'forest', partIndex: 0 },
            { id: 'ch2_quietink', label: 'Chapter II — Quiet Ink Lesson (Step 10.5)', step: 10.5, area: 'village', partIndex: 0 },
            { id: 'ch2_oathgrove', label: 'Chapter II — Oathgrove (Step 10.75)', step: 10.75, area: 'oathgrove', partIndex: 0 },

            { id: 'ch2_gate', label: 'Chapter II — Gate Choice (Step 14)', step: 14, area: 'village', partIndex: 0 },

            { id: 'ch3_council', label: 'Chapter III — Emergency Council (Step 15)', step: 15, area: 'village', partIndex: 0, force: { chapter3CouncilDone: false } },
            { id: 'ch3_investigate', label: 'Chapter III — Blackbark Investigation (Step 15.5)', step: 15.5, area: 'blackbarkDepths', partIndex: 0 },

            { id: 'ch3_crownecho', label: 'Chapter III — Crown‑Echo Fight (Step 16)', step: 16, area: 'forest', partIndex: 2 },
            { id: 'ch3_decode', label: 'Chapter III — Decode Crown‑Echo (Step 17)', step: 17, area: 'village', partIndex: 0 },
            { id: 'ch3_starfall', label: 'Chapter III — Starfall Ridge (Step 17.5)', step: 17.5, area: 'starfallRidge', partIndex: 0 },

            { id: 'ch3_spire', label: 'Chapter III — Mirror Warden (Step 18)', step: 18, area: 'ruins', partIndex: 0 },
            { id: 'ch3_latch', label: 'Chapter III — Grave‑Latch Warden (Step 19)', step: 19, area: 'catacombs', partIndex: 0 },
            { id: 'ch3_ritual', label: 'Chapter III — Ritual Leader (Step 20)', step: 20, area: 'village', partIndex: 0 },
            { id: 'ch3_final', label: 'Chapter III — Hollow Regent (Step 21)', step: 21, area: 'forest', partIndex: 2 },
            { id: 'ch3_epilogue', label: 'Chapter III — Epilogue Choice (Step 22)', step: 22, area: 'village', partIndex: 0 },

            { id: 'ch4_summons', label: 'Chapter IV — Court Summons (Step 23)', step: 23, area: 'village', partIndex: 0, force: { chapter4IntroShown: false, chapter4IntroQueued: true } },
            { id: 'ch4_lens', label: 'Chapter IV — Verdant Lens (Step 24)', step: 24, area: 'ruins', partIndex: 0 },
            { id: 'ch4_marsh', label: 'Chapter IV — Marsh Writs (Step 25)', step: 25, area: 'marsh', partIndex: 0, force: { chapter4MarshWritsDone: false } },
            { id: 'ch4_frost', label: 'Chapter IV — Frozen Writ (Step 26)', step: 26, area: 'frostpeak', partIndex: 0 },
            { id: 'ch4_bone', label: 'Chapter IV — Bone Writ (Step 27)', step: 27, area: 'catacombs', partIndex: 0 },
            { id: 'ch4_seal', label: 'Chapter IV — Seal of Verdict (Step 28)', step: 28, area: 'keep', partIndex: 0 },
            { id: 'ch4_magistrate', label: 'Chapter IV — Rootbound Magistrate (Step 29)', step: 29, area: 'forest', partIndex: 2 },
            { id: 'ch4_answer', label: 'Chapter IV — Answer the Court (Step 30)', step: 30, area: 'village', partIndex: 0 },
            { id: 'ch4_tbc', label: 'Chapter IV — To Be Continued (Step 31)', step: 31, area: 'village', partIndex: 0 }
        ]

        function resetQuestStoryFlags() {
            if (!state) return
            if (!state.flags) state.flags = {}
            const def = createDefaultQuestFlags()
            Object.keys(def).forEach((k) => {
                state.flags[k] = def[k]
            })
        }

        function ensureMainQuestPresent() {
            try {
                quests && quests.ensureQuestStructures && quests.ensureQuestStructures()
            } catch (_) {}

            if (!state.quests) state.quests = createDefaultQuestState()
            if (!state.quests.main) {
                try {
                    quests && quests.initMainQuest && quests.initMainQuest()
                } catch (_) {
                    state.quests.main = {
                        id: 'main',
                        name: (QUEST_DEFS && QUEST_DEFS.main && QUEST_DEFS.main.name) ? QUEST_DEFS.main.name : 'Main Quest',
                        step: 0,
                        status: 'active'
                    }
                }
            }
            if (state.quests && state.quests.main) {
                state.quests.main.status = 'active'
                if (!Number.isFinite(Number(state.quests.main.step))) state.quests.main.step = 0
            }
        }

        function applyMainQuestPrereqs(step) {
            if (!state || !state.flags) return
            const f = state.flags
            const n = Number(step)

            // Chapter I progression prerequisites
            if (n >= 0.25) f.metElder = true
            if (n >= 2) f.goblinBossDefeated = true
            if (n >= 3) {
                f.dragonDefeated = true
                f.marshUnlocked = true
            }
            if (n >= 4) {
                f.marshWitchDefeated = true
                f.frostpeakUnlocked = true
            }
            if (n >= 5) {
                f.frostGiantDefeated = true
                f.catacombsUnlocked = true
            }
            if (n >= 6) {
                f.lichDefeated = true
                f.keepUnlocked = true
            }
            if (n >= 7) f.obsidianKingDefeated = true

            // Chapter II prerequisites
            if (n >= 8) {
                f.epilogueShown = true
                f.blackbarkChapterStarted = true
            }
            if (n >= 10) f.barkScribeMet = true
            if (n >= 11) {
                f.oathShardSapRun = true
                f.oathShardWitchReed = true
                f.oathShardBoneChar = true
            }
            if (n >= 12) f.quietRootsTrialDone = true
            if (n >= 13) f.ashWardenMet = true
            if (n >= 14) f.blackbarkGateFound = true

            // Chapter III prerequisites
            if (n >= 15) {
                f.blackbarkChoiceMade = true
                f.blackbarkChoice = String(choiceSelect.value || 'rewrite')
                f.chapter3Started = true
            }
            if (n >= 16) f.crownEchoFaced = true
            if (n >= 17) f.crownEchoDefeated = true
            if (n >= 18) f.mirrorWardenDefeated = true
            if (n >= 19) f.graveLatchWardenDefeated = true
            if (n >= 20) f.ritualLeaderDefeated = true
            if (n >= 21) f.hollowRegentDefeated = true
            if (n >= 22) {
                f.chapter3Completed = true
                f.chapter3EpilogueShown = true
            }

            // Chapter IV prerequisites
            if (n >= 23) {
                f.chapter4Started = true
                f.chapter4IntroShown = true
            }
            if (n >= 24) f.verdantLensObtained = true
            if (n >= 25) f.chapter4MarshWritsDone = true
            if (n >= 26) f.frostWritObtained = true
            if (n >= 27) f.boneWritObtained = true
            if (n >= 28) f.sealOfVerdictObtained = true
            if (n >= 29) f.rootboundMagistrateDefeated = true
            if (n >= 30) f.chapter4Completed = true
            if (n >= 31) f.chapter4EpilogueShown = true
        }

        function setStoryPosition(step, opts = {}) {
            if (chkReset.input.checked) resetQuestStoryFlags()
            if (chkFill.input.checked) applyMainQuestPrereqs(step)
            ensureMainQuestPresent()

            if (state.quests && state.quests.main) state.quests.main.step = Number(step)

            if (opts.force) {
                Object.keys(opts.force).forEach((k) => {
                    state.flags[k] = opts.force[k]
                })
            }

            if (chkEnv.input.checked) {
                if (opts.area) state.area = opts.area
                if (typeof opts.partIndex === 'number' && state.time && state.time.parts) {
                    const idx = Math.max(0, Math.min(opts.partIndex, state.time.parts.length - 1))
                    state.time.part = state.time.parts[idx] || 'morning'
                }
            }

            requestSave('legacy')
            updateHUD()
            if (state.inCombat) updateEnemyPanel()

            addLog(
                'Cheat: jumped to Main Quest step ' + step + '.',
                'system'
            )
        }

        const presetRow = document.createElement('div')
        presetRow.className = 'item-actions'

        const presetSelect = document.createElement('select')
        presetSelect.className = 'input'
        STORY_PRESETS.forEach((p) => {
            const opt = document.createElement('option')
            opt.value = p.id
            opt.textContent = p.label
            presetSelect.appendChild(opt)
        })
        presetSelect.value = 'ch1_start'

        const btnJumpPreset = document.createElement('button')
        btnJumpPreset.className = 'btn small'
        btnJumpPreset.textContent = 'Jump to Preset'
        btnJumpPreset.addEventListener('click', () => {
            const id = presetSelect.value
            const pz = STORY_PRESETS.find((x) => x.id === id) || STORY_PRESETS[0]
            setStoryPosition(pz.step, pz)
            renderCheatStatus()
        })

        presetRow.appendChild(presetSelect)
        presetRow.appendChild(btnJumpPreset)
        storyContent.appendChild(presetRow)

        const manualRow = document.createElement('div')
        manualRow.className = 'item-actions'

        const manualLabel = document.createElement('span')
        manualLabel.className = 'tag'
        manualLabel.textContent = 'Manual step'

        const manualInput = document.createElement('input')
        manualInput.type = 'number'
        manualInput.className = 'input'
        manualInput.style.maxWidth = '80px'
        manualInput.value = '0'
        manualInput.min = '0'
        manualInput.step = '0.25'

        const btnSetStep = document.createElement('button')
        btnSetStep.className = 'btn small'
        btnSetStep.textContent = 'Set Step'
        btnSetStep.addEventListener('click', () => {
            const n = Number(manualInput.value || 0)
            setStoryPosition(n, {})
            renderCheatStatus()
        })

        manualRow.appendChild(manualLabel)
        manualRow.appendChild(manualInput)
        manualRow.appendChild(btnSetStep)
        storyContent.appendChild(manualRow)

        // --- Loot ----------------------------------------------------------
        const lootSec = makeCheatSection('Loot / Equipment', false)
        const lootContent = lootSec.body

        const lootInfo = document.createElement('p')
        lootInfo.className = 'modal-subtitle'
        lootInfo.textContent = 'Spawn high-level loot for testing gear systems.'
        lootContent.appendChild(lootInfo)

        const rarityRank = (r) => {
            switch (r) {
                case 'mythic':
                    return 5
                case 'legendary':
                    return 4
                case 'epic':
                    return 3
                case 'rare':
                    return 2
                case 'uncommon':
                    return 1
                default:
                    return 0
            }
        }

        function cheatLootArea() {
            const a = state.area || 'forest'
            return a === 'village' ? 'forest' : a
        }

        function pickBestGeneratedItemOfType(type, armorSlot = null) {
            let best = null
            let bestKey = -Infinity
            const maxLootLevel = 99
            const fakeBoss = { isBoss: true }

            // For slot-specific armor (head/hands/feet/etc.), generate the exact slot directly.
            // Relying on `generateLootDrop()` is fine for normal play, but it is too RNG-heavy
            // for cheat tooling that must guarantee a full equipped set.
            if (type === 'armor' && armorSlot) {
                for (let i = 0; i < 90; i++) {
                    const it = generateArmorForSlot({
                        area: cheatLootArea(),
                        level: maxLootLevel,
                        rarity: 'mythic',
                        isBoss: true,
                        slot: armorSlot
                    })
                    if (!it) continue
                    const key = rarityRank(it.rarity) * 100000 + getItemPowerScore(it)
                    if (key > bestKey) {
                        bestKey = key
                        best = it
                    }
                    if (it.rarity === 'mythic' && getItemPowerScore(it) > 150) {
                        return it
                    }
                }
                return best
            }

            for (let i = 0; i < 90; i++) {
                const drops = generateLootDrop({
                    area: cheatLootArea(),
                    playerLevel: maxLootLevel,
                    enemy: fakeBoss,
                    playerResourceKey: p.resourceKey,
                    playerClassId: p.classId,
                    forceGearMinRarity: 'mythic'
                })
                if (!drops || !drops.length) continue

                for (const it of drops) {
                    if (!it || it.type !== type) continue

                    // If we are hunting a specific armor slot, filter here.
                    if (type === 'armor' && armorSlot) {
                        const slot = it.slot || 'armor'
                        if (slot !== armorSlot) continue
                    }

                    const key =
                        rarityRank(it.rarity) * 100000 + getItemPowerScore(it)
                    if (key > bestKey) {
                        bestKey = key
                        best = it
                    }

                    // quick early-out if we hit a strong mythic
                    if (
                        it.rarity === 'mythic' &&
                        getItemPowerScore(it) > 160
                    ) {
                        return it
                    }
                }
            }

            return best
        }

        function spawnMaxLootSet(equipNow) {
            const weapon = pickBestGeneratedItemOfType('weapon')

            const armorSlots = [
                'armor',
                'head',
                'hands',
                'feet',
                'belt',
                'neck',
                'ring'
            ]

            const gear = armorSlots
                .map((s) => pickBestGeneratedItemOfType('armor', s))
                .filter(Boolean)

            const spawned = []
            if (weapon) {
                addGeneratedItemToInventory(weapon, 1)
                spawned.push(weapon)
            }
            gear.forEach((it) => {
                addGeneratedItemToInventory(it, 1)
                spawned.push(it)
            })

            if (!spawned.length) {
                addLog('Cheat: failed to roll loot (unexpected).', 'system')
                return
            }

            if (equipNow) {
                if (weapon) p.equipment.weapon = weapon
                gear.forEach((it) => {
                    const slot = it.slot || 'armor'
                    if (!p.equipment) p.equipment = {}
                    p.equipment[slot] = it
                })
                recalcPlayerStats()
            }

            const names = spawned.map((x) => x.name).join(' + ')
            addLog(
                'Cheat: spawned max-level loot: ' +
                    names +
                    (equipNow ? ' (equipped).' : '.'),
                'system'
            )

            updateHUD()
            requestSave('legacy')
        }

        const lootRow = document.createElement('div')
        lootRow.className = 'item-actions'

        const btnSpawnMax = document.createElement('button')
        btnSpawnMax.className = 'btn small'
        btnSpawnMax.textContent = 'Spawn Max Loot'
        btnSpawnMax.addEventListener('click', () => {
            spawnMaxLootSet(false)
        })

        const btnSpawnEquipMax = document.createElement('button')
        btnSpawnEquipMax.className = 'btn small'
        btnSpawnEquipMax.textContent = 'Spawn + Equip Max Loot'
        btnSpawnEquipMax.addEventListener('click', () => {
            spawnMaxLootSet(true)
        })

        lootRow.appendChild(btnSpawnMax)
        lootRow.appendChild(btnSpawnEquipMax)
        lootContent.appendChild(lootRow)


        // --- Gambling debug controls (developer-only) ---------------------------
        const gamblingSec = makeCheatSection('Gambling Debug', false)
        const gamblingContent = gamblingSec.body

        const gambleTitle = document.createElement('div')
        gambleTitle.className = 'char-section-title'

        gamblingContent.appendChild(gambleTitle)

        const gambleRow1 = document.createElement('div')
        gambleRow1.className = 'item-actions'

        const gambleRow2 = document.createElement('div')
        gambleRow2.className = 'item-actions'

        const gambleStatus = document.createElement('p')
        gambleStatus.className = 'modal-subtitle'

        function ensureGamblingDebug() {
            if (!state.gamblingDebug) {
                state.gamblingDebug = {
                    mode: 'normal',
                    payoutMultiplier: 1
                }
            } else {
                if (!state.gamblingDebug.mode) {
                    state.gamblingDebug.mode = 'normal'
                }
                if (
                    typeof state.gamblingDebug.payoutMultiplier !== 'number' ||
                    state.gamblingDebug.payoutMultiplier <= 0
                ) {
                    state.gamblingDebug.payoutMultiplier = 1
                }
            }
        }

        function refreshGambleStatus() {
            ensureGamblingDebug()
            const md = state.gamblingDebug.mode || 'normal'
            const mult = state.gamblingDebug.payoutMultiplier || 1
            gambleStatus.textContent = `Mode: ${md} • Payout: ${mult}x`
        }

        refreshGambleStatus()
        gamblingContent.appendChild(gambleStatus)

        const modeSelect = document.createElement('select')
        modeSelect.className = 'input'
        ;['normal', 'alwaysWin', 'alwaysLose'].forEach((id) => {
            const opt = document.createElement('option')
            opt.value = id
            opt.textContent =
                id === 'normal'
                    ? 'Normal'
                    : id === 'alwaysWin'
                      ? 'Always Win'
                      : 'Always Lose'
            modeSelect.appendChild(opt)
        })
        ensureGamblingDebug()
        modeSelect.value = state.gamblingDebug.mode

        const btnSetMode = document.createElement('button')
        btnSetMode.className = 'btn small'
        btnSetMode.textContent = 'Set Mode'
        btnSetMode.addEventListener('click', () => {
            ensureGamblingDebug()
            state.gamblingDebug.mode = modeSelect.value || 'normal'
            requestSave('legacy')
            refreshGambleStatus()
        })

        gambleRow1.appendChild(modeSelect)
        gambleRow1.appendChild(btnSetMode)
        gamblingContent.appendChild(gambleRow1)

        const multLabel = document.createElement('span')
        multLabel.className = 'tag'
        multLabel.textContent = 'Payout Multiplier'

        const multInput = document.createElement('input')
        multInput.type = 'number'
        multInput.className = 'input'
        multInput.style.maxWidth = '80px'
        multInput.min = '0.1'
        multInput.step = '0.1'
        multInput.value = state.gamblingDebug.payoutMultiplier || 1

        const btnSetMult = document.createElement('button')
        btnSetMult.className = 'btn small'
        btnSetMult.textContent = 'Set Multiplier'
        btnSetMult.addEventListener('click', () => {
            ensureGamblingDebug()
            const val = Math.max(0.1, Number(multInput.value || 1))
            state.gamblingDebug.payoutMultiplier = val
            requestSave('legacy')
            refreshGambleStatus()
        })

        gambleRow2.appendChild(multLabel)
        gambleRow2.appendChild(multInput)
        gambleRow2.appendChild(btnSetMult)
        gamblingContent.appendChild(gambleRow2)

        // --- Search + Expand/Collapse ------------------------------
        // Build an internal search index for each cheat element that can be filtered.
        const allSearchables = []

        function indexSearchables() {
            scrollBody.querySelectorAll('button, label, input, select').forEach((node) => {
                const t = (node.textContent || '').toLowerCase()
                const v = (node.value || '').toLowerCase()
                const merged = (t + ' ' + v)
                    .replace(/\s+/g, ' ')
                    .trim()
                if (!merged) return

                node.dataset.cheatSearch = merged
                allSearchables.push({ node, text: merged })
            })
        }

        function applySearchFilter() {
            const q = String(search.value || '')
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim()

            if (!q) {
                cheatSections.forEach((sec) => {
                    sec.section.style.display = ''
                    sec.body
                        .querySelectorAll('[data-cheat-search]')
                        .forEach((n) => (n.style.display = ''))
                    sec.setOpen(sec.defaultOpen)
                })
                return
            }

            cheatSections.forEach((sec) => {
                let any = false
                sec.body
                    .querySelectorAll('[data-cheat-search]')
                    .forEach((n) => {
                        const hit = (n.dataset.cheatSearch || '').includes(q)
                        n.style.display = hit ? '' : 'none'
                        if (hit) any = true
                    })

                sec.section.style.display = any ? '' : 'none'
                if (any) sec.setOpen(true)
            })
        }

        // Index once after the menu is fully built.
        indexSearchables()

        search.addEventListener('input', applySearchFilter)
        search.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                search.value = ''
                applySearchFilter()
                search.blur()
            }
        })
    })
}

    return {
        openCheatMenu
    }
}
