/**
 * cheatsMenu.js
 * 
 * Cheat menu modal for debug/testing purposes.
 * Extracted from gameOrchestrator.js to reduce file size.
 * 
 * This is a massive function with ~2300 lines of cheat/debug options.
 */

/**
 * Creates the cheat menu function with all necessary dependencies injected.
 * @returns {Function} openCheatMenu function
 */
export function createCheatsMenu({
    // Core state
    state,
    
    // UI functions
    openModal,
    closeModal,
    setModalOnClose,
    addLog,
    updateHUD,
    updateTimeDisplay,
    updateEnemyPanel,
    updateAreaMusic,
    renderActions,
    
    // Game system functions
    requestSave,
    setArea,
    advanceWorldTime,
    advanceWorldDays,
    addItemToInventory,
    startBattleWith,
    cheatMaxLevel,
    
    // Quest system
    quests,
    QUEST_DEFS,
    
    // Data definitions
    ITEM_DEFS,
    ENEMY_TEMPLATES,
    ZONE_DEFS,
    
    // RNG system
    setRngSeed,
    setDeterministicRngEnabled,
    setRngLoggingEnabled,
    
    // Debug utilities
    copyFeedbackToClipboard,
    copyBugReportBundleToClipboard
}) {
    return function openCheatMenu() {
    openModal('Cheat Menu', (body) => {
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
        search.placeholder = 'Search cheats...'
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

        // Keep the stat pills readable and constrained: hard cap at ?2 rows on narrow screens.
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
            statusBar.classList.add('two-row-clamp')
            if (rowCount() <= 2) return

            // Last resort: switch to compact labels + slightly smaller scale.
            statusBar.classList.add('two-row-compact')
            Array.from(statusBar.querySelectorAll('.cheat-stat')).forEach((el) => {
                if (el && el.dataset && el.dataset.short) el.textContent = el.dataset.short
            })

            font = Math.min(font, 9)
            padY = Math.min(padY, 2.5)
            padX = Math.min(padX, 6)
            for (let i = 0; i < 14; i++) {
                if (rowCount() <= 2) return
                if (font <= 7.25) break
                font = Math.max(7.25, font - 0.5)
                padY = Math.max(2, padY - 0.15)
                padX = Math.max(4.5, padX - 0.2)
                statusBar.style.setProperty('--cheat-stat-font', font + 'px')
                statusBar.style.setProperty('--cheat-stat-padY', padY + 'px')
                statusBar.style.setProperty('--cheat-stat-padX', padX + 'px')
            }
        }

        // Re-fit on resize/orientation changes, but clean up when the modal closes.
        const _cheatResizeHandler = () => {
            // Layout needs a tick to settle on some mobile browsers.
            requestAnimationFrame(() => fitCheatStatusbarTwoRows())
        }
        window.addEventListener('resize', _cheatResizeHandler)
        setModalOnClose(() => {
            try {
            window.removeEventListener('resize', _cheatResizeHandler)
            } catch (_) {}
        })

        function renderCheatStatus() {
            const day =
                state && state.time && typeof state.time.dayIndex === 'number'
                    ? Math.floor(Number(state.time.dayIndex))
                    : 0
            const part =
                state && state.time && state.time.part
                    ? String(state.time.part)
                    : ''
            const area = state && state.area ? getAreaDisplayName(state.area) : ''
            const activeDiff = getActiveDifficultyConfig()

            const critLabel = state.flags.alwaysCrit
                ? 'ALWAYS'
                : state.flags.neverCrit
                  ? 'NEVER'
                  : 'NORMAL'

            statusBar.innerHTML = ''

            function addStat(txt, extraClass, shortTxt) {
                const s = document.createElement('span')
                s.className = 'cheat-stat' + (extraClass ? ' ' + extraClass : '')
                s.textContent = txt
                // Store full/short labels so the fitter can swap when needed.
                s.dataset.full = String(txt)
                s.dataset.short = String(shortTxt || txt)
                statusBar.appendChild(s)
            }

            // Primary, always-visible stats
            const lvTxt = 'Lv ' + (p.level || 1)
            addStat(lvTxt, '', lvTxt)

            const hpTxt = 'HP ' + (p.hp || 0) + '/' + (p.maxHp || 0)
            addStat(hpTxt, '', hpTxt)

            // Resource name can be long on some classes; keep the label compact.
            const resNameRaw = p.resourceName || 'Res'
            const resName =
                String(resNameRaw).length > 10
                    ? String(resNameRaw).slice(0, 10)
                    : String(resNameRaw)
            const resTxt = resName + ' ' + (p.resource || 0) + '/' + (p.maxResource || 0)
            const resShortLabel = String(resNameRaw)
                .trim()
                .slice(0, 4)
                .replace(/\s+/g, '')
            const resShort =
                (resShortLabel ? resShortLabel : 'Res') +
                ' ' +
                (p.resource || 0) +
                '/' +
                (p.maxResource || 0)
            addStat(resTxt, '', resShort)

            const goldTxt = 'Gold ' + (p.gold || 0)
            addStat(goldTxt, '', 'G ' + (p.gold || 0))

            // Build points (keep compact)
            const spTxt = 'Skill ' + (p.skillPoints || 0)
            addStat(spTxt, '', 'SP ' + (p.skillPoints || 0))

            const tpTxt = 'Talents ' + (p.talentPoints || 0)
            addStat(tpTxt, '', 'TP ' + (p.talentPoints || 0))

            // Secondary stats are combined to keep the status bar at ?2 rows without scrolling.
            const partShort = part ? String(part).trim().slice(0, 1).toUpperCase() : ''
            const timeTxt = 'Day ' + day + (part ? ' * ' + part : '')
            const timeShort = 'D' + day + (partShort ? '*' + partShort : '')
            addStat(timeTxt, '', timeShort)

            const locBits = []
            if (area) locBits.push(area)
            if (activeDiff && activeDiff.name) locBits.push(activeDiff.name)
            if (locBits.length) {
                const locTxt = locBits.join(' * ')
                // Short form drops the separator label and relies on truncation when needed.
                const locShort = locBits.join('*')
                addStat(locTxt, 'cheat-stat-wide', locShort)
            }

            const flagsTxt =
                'God ' + (state.flags.godMode ? 'ON' : 'OFF') + ' * Crit ' + critLabel
            const flagsShort =
                'God ' + (state.flags.godMode ? 'ON' : 'OFF') + ' * C ' + critLabel.slice(0, 1)
            addStat(flagsTxt, 'cheat-stat-wide', flagsShort)

            // After DOM updates, ensure we stay within the 2-row constraint.
            requestAnimationFrame(() => fitCheatStatusbarTwoRows())
        }

        renderCheatStatus()

        const cheatSections = []

        // Collapsible sections to keep the cheat menu compact
        function makeCheatSection(titleText, expandedByDefault) {
            const section = document.createElement('div')
            section.className = 'cheat-section'

            const header = document.createElement('button')
            header.type = 'button'
            header.className = 'cheat-section-header'

            const chevron = document.createElement('span')
            chevron.className = 'cheat-section-chevron'

            const label = document.createElement('span')
            label.className = 'cheat-section-title'
            label.textContent = titleText

            header.appendChild(chevron)
            header.appendChild(label)

            const content = document.createElement('div')
            content.className = 'cheat-section-body'

            function setOpen(open) {
                content.style.display = open ? '' : 'none'
                header.setAttribute('aria-expanded', open ? 'true' : 'false')
                chevron.textContent = open ? '?' : '?'
            }

            setOpen(!!expandedByDefault)

            header.addEventListener('click', () => {
                const isOpen = content.style.display !== 'none'
                setOpen(!isOpen)
            })

            section.appendChild(header)
            section.appendChild(content)
            body.appendChild(section)

            const entry = {
                section,
                header,
                body: content,
                titleText,
                defaultOpen: !!expandedByDefault,
                setOpen
            }
            cheatSections.push(entry)
            return entry
        }

        // Core hero / combat cheats
        // Default to collapsed so opening the cheat menu doesn't auto-expose a whole section.
        const coreSec = makeCheatSection('Core Cheats', false)
        const coreContent = coreSec.body

        // Row 1 - Gold / XP
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

        // Row 2 - Heal / Slay Enemy
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

        // Row 3 - God Mode / Always Crit
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

        const btnNeverCrit = document.createElement('button')
        btnNeverCrit.className = 'btn small'
        btnNeverCrit.textContent = state.flags.neverCrit
            ? 'Allow Crits'
            : 'Never Crit'
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

        // Row 4 - Difficulty / Prime Class Meter
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
        diffSelect.value = (state && state.difficulty) ? String(state.difficulty) : 'normal'

        const btnSetDiff = document.createElement('button')
        btnSetDiff.className = 'btn small'
        btnSetDiff.textContent = 'Set Difficulty'
        btnSetDiff.addEventListener('click', () => {
            const next = String(diffSelect.value || 'normal')
            if (!state) return
            state.difficulty = next
            if (next === 'dynamic' && !state.dynamicDifficulty) {
                state.dynamicDifficulty = { band: 0, tooEasyStreak: 0, struggleStreak: 0 }
            }
            addLog('Cheat: difficulty set to ' + next + '.', 'system')
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        const btnPrime = document.createElement('button')
        btnPrime.className = 'btn small'
        btnPrime.textContent = 'Prime Class Meter'
        btnPrime.addEventListener('click', () => {
            const p = state && state.player
            if (!p) return

            const cid = String(p.classId || '').toLowerCase()

            // Mage Rhythm: set spellCastCount so the *next* mana spell is the 3rd.
            if (cid === 'mage') {
                if (!p.status) p.status = {}
                p.status.spellCastCount = 2
                addLog('Cheat: primed Rhythm (next mana spell is empowered).', 'system')
            }
            // Warrior Bulwark: ensure Fury is at/above the threshold.
            else if (cid === 'warrior') {
                p.resource = Math.max(p.resource || 0, 40)
                addLog('Cheat: primed Bulwark (40+ Fury).', 'system')
            }
            // Blood Knight Bloodrush: push Blood high.
            else if (cid === 'bloodknight' || cid === 'blood_knight' || cid === 'blood knight') {
                p.resource = p.maxResource
                addLog('Cheat: primed Bloodrush (high Blood).', 'system')
            }
            // Ranger Marks: max marks on current target if possible.
            else if (cid === 'ranger') {
                if (state.inCombat && state.currentEnemy) {
                    state.currentEnemy.markedStacks = 5
                    state.currentEnemy.markedTurns = 4
                    addLog('Cheat: primed Marks (5 stacks on current target).', 'system')
                } else {
                    addLog('Marks can only be primed while in combat (needs a target).', 'system')
                }
            } else {
                // Generic: fill resource as a reasonable fallback.
                p.resource = p.maxResource
                addLog('Cheat: meter primed (resource filled).', 'system')
            }

            updateHUD()
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
            { id: 'ch1_start', label: 'Chapter I - Start (Step 0)', step: 0, area: 'village', partIndex: 0 },
            { id: 'ch1_captain', label: 'Chapter I - Captain Elara Briefing (Step 0.25)', step: 0.25, area: 'village', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, ch1CaptainBriefed: false } },
            { id: 'ch1_scribe', label: 'Chapter I - Bark-Scribe Intel (Step 0.5)', step: 0.5, area: 'village', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, ch1ScribeTrailsLearned: false } },
            { id: 'ch1_salve', label: 'Chapter I - Bitterleaf Salve (Step 0.75)', step: 0.75, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_raiders', label: 'Chapter I - Raiders (Step 1)', step: 1, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_snareline', label: 'Chapter I - Snareline (Trapper) (Step 1.1)', step: 1.1, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_supply', label: 'Chapter I - Supply Route (Step 1.2)', step: 1.2, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_cache', label: 'Chapter I - Cache Fire (Packmaster) (Step 1.25)', step: 1.25, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_drums', label: 'Chapter I - War Drums (Step 1.3)', step: 1.3, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true } },
            { id: 'ch1_captain_fight', label: 'Chapter I - Captain's Trail (Step 1.4)', step: 1.4, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, ch1SigilRecovered: false } },
            { id: 'ch1_warlord_ready', label: 'Chapter I - Warlord Hunt Ready (Sigil Recovered)', step: 1.4, area: 'forest', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, ch1SigilRecovered: true, ch1CaptainDefeated: true } },
            { id: 'ch1_rowan_warlord', label: 'Chapter I - Rowan Debrief (After Warlord) (Step 1.5)', step: 1.5, area: 'village', partIndex: 0, force: { mainQuestAccepted: true, metElder: true, goblinBossDefeated: true, goblinRowanDebriefShown: false, goblinRowanDebriefPending: true } },
            { id: 'ch2_intro', label: 'Chapter II - Start (Intro in Village)', step: 7, area: 'village', partIndex: 0, force: { blackbarkChapterStarted: false } },
            { id: 'ch2_bark', label: 'Chapter II - Bark-Scribe (Step 9)', step: 9, area: 'village', partIndex: 0 },
            { id: 'ch2_rowan_reveal', label: 'Chapter II - Rowan's Revelation (Step 8)', step: 8, area: 'village', partIndex: 0 },
            { id: 'ch2_elara', label: 'Chapter II - Tallies (Elara) (Step 8.25)', step: 8.25, area: 'village', partIndex: 0 },
            { id: 'ch2_splinters', label: 'Chapter II - Oath-Splinters (Step 10)', step: 10, area: 'forest', partIndex: 0 },
            { id: 'ch2_quietink', label: 'Chapter II - Quiet Ink Lesson (Step 10.5)', step: 10.5, area: 'village', partIndex: 0 },
            { id: 'ch2_oathgrove', label: 'Chapter II - Oathgrove (Step 10.75)', step: 10.75, area: 'oathgrove', partIndex: 0 },

            { id: 'ch2_gate', label: 'Chapter II - Gate Choice (Step 14)', step: 14, area: 'village', partIndex: 0 },

            { id: 'ch3_council', label: 'Chapter III - Emergency Council (Step 15)', step: 15, area: 'village', partIndex: 0, force: { chapter3CouncilDone: false } },
            { id: 'ch3_investigate', label: 'Chapter III - Blackbark Investigation (Step 15.5)', step: 15.5, area: 'blackbarkDepths', partIndex: 0 },

            { id: 'ch3_crownecho', label: 'Chapter III - Crown-Echo Fight (Step 16)', step: 16, area: 'forest', partIndex: 2 },
            { id: 'ch3_decode', label: 'Chapter III - Decode Crown-Echo (Step 17)', step: 17, area: 'village', partIndex: 0 },
            { id: 'ch3_starfall', label: 'Chapter III - Starfall Ridge (Step 17.5)', step: 17.5, area: 'starfallRidge', partIndex: 0 },

            { id: 'ch3_spire', label: 'Chapter III - Mirror Warden (Step 18)', step: 18, area: 'ruins', partIndex: 0 },
            { id: 'ch3_latch', label: 'Chapter III - Grave-Latch Warden (Step 19)', step: 19, area: 'catacombs', partIndex: 0 },
            { id: 'ch3_ritual', label: 'Chapter III - Ritual Leader (Step 20)', step: 20, area: 'village', partIndex: 0 },
            { id: 'ch3_final', label: 'Chapter III - Hollow Regent (Step 21)', step: 21, area: 'forest', partIndex: 2 },
            { id: 'ch3_epilogue', label: 'Chapter III - Epilogue Choice (Step 22)', step: 22, area: 'village', partIndex: 0 },

            { id: 'ch4_summons', label: 'Chapter IV - Court Summons (Step 23)', step: 23, area: 'village', partIndex: 0, force: { chapter4IntroShown: false, chapter4IntroQueued: true } },
            { id: 'ch4_lens', label: 'Chapter IV - Verdant Lens (Step 24)', step: 24, area: 'ruins', partIndex: 0 },
            { id: 'ch4_marsh', label: 'Chapter IV - Marsh Writs (Step 25)', step: 25, area: 'marsh', partIndex: 0, force: { chapter4MarshWritsDone: false } },
            { id: 'ch4_frost', label: 'Chapter IV - Frozen Writ (Step 26)', step: 26, area: 'frostpeak', partIndex: 0 },
            { id: 'ch4_bone', label: 'Chapter IV - Bone Writ (Step 27)', step: 27, area: 'catacombs', partIndex: 0 },
            { id: 'ch4_seal', label: 'Chapter IV - Seal of Verdict (Step 28)', step: 28, area: 'keep', partIndex: 0 },
            { id: 'ch4_magistrate', label: 'Chapter IV - Rootbound Magistrate (Step 29)', step: 29, area: 'forest', partIndex: 2 },
            { id: 'ch4_answer', label: 'Chapter IV - Answer the Court (Step 30)', step: 30, area: 'village', partIndex: 0 },
            { id: 'ch4_tbc', label: 'Chapter IV - To Be Continued (Step 31)', step: 31, area: 'village', partIndex: 0 }
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
                // By default, queue the Chapter III intro card; testers can clear it by jumping further.
                if (n === 15) {
                    f.chapter3IntroQueued = true
                    f.chapter3IntroShown = false
                } else {
                    f.chapter3IntroQueued = false
                    f.chapter3IntroShown = true
                }
            }
            if (n >= 16) {
                // Council usually happens before the night gate return.
                if (!f.chapter3CouncilDone) {
                    f.chapter3CouncilDone = true
                    if (!f.chapter3CouncilStance) f.chapter3CouncilStance = 'investigate'
                }
            }
            if (n >= 17) f.chapter3CrownEchoTaken = true
            if (n >= 18) {
                f.chapter3CrownEchoTaken = true
                f.chapter3CrownEchoDecoded = true
            }
            if (n >= 19) f.chapter3StarIronPin = true
            if (n >= 20) f.chapter3GraveLatch = true
            if (n >= 21) {
                f.chapter3RitualAllyChosen = true
                if (!f.chapter3RitualAlly) f.chapter3RitualAlly = 'rowan'
            }
            if (n >= 22) f.hollowRegentDefeated = true

            // Chapter IV prerequisites
            if (n >= 23) {
                f.chapter3FinalChoiceMade = true
                if (!f.chapter3Ending) f.chapter3Ending = 'seal'
                f.chapter4Started = true
                if (n === 23) {
                    f.chapter4IntroQueued = true
                    f.chapter4IntroShown = false
                } else {
                    f.chapter4IntroQueued = false
                    f.chapter4IntroShown = true
                }
            }
            if (n >= 25) f.chapter4VerdantLens = true
            if (n >= 26) f.chapter4MarshWritsDone = true
            if (n >= 27) f.chapter4FrozenWrit = true
            if (n >= 28) f.chapter4BoneWrit = true
            if (n >= 29) f.chapter4SealOfVerdict = true
            if (n >= 30) f.chapter4MagistrateDefeated = true
            if (n >= 31) {
                f.chapter4FinalChoiceMade = true
                if (!f.chapter4Ending) f.chapter4Ending = 'rewrite'
            }

            // Convenience: ensure base travel unlocks when late-story beats need them.
            if (n >= 19) {
                f.catacombsUnlocked = true
                f.keepUnlocked = true
            }
        }

        function setStoryPosition(step, opts = {}) {
            if (!state) return
            const target = clampFinite(Number(step), 0, 999, 0)

            if (chkReset.input.checked) resetQuestStoryFlags()
            ensureMainQuestPresent()

            if (chkFill.input.checked) applyMainQuestPrereqs(target)

            if (state.quests && state.quests.main) state.quests.main.step = target

            // Auto-place the player where this beat is most testable.
            if (chkEnv.input.checked) {
                if (opts.area) setArea(String(opts.area), { source: 'cheat:storyJump' })
                if (state.time && typeof opts.partIndex !== 'undefined') {
                    state.time.partIndex = clampFinite(Number(opts.partIndex), 0, 2, state.time.partIndex)
                }
            }

            // Allow presets to force/override specific flags after prereq fill.
            if (opts.force && state.flags) {
                Object.keys(opts.force).forEach((k) => {
                    state.flags[k] = opts.force[k]
                })
            }

            try {
                quests && quests.updateQuestBox && quests.updateQuestBox()
            } catch (_) {}
            try {
                renderActions && renderActions()
            } catch (_) {}

            updateHUD()
            requestSave('legacy')
            renderCheatStatus()

            const label = opts.label ? String(opts.label) : 'Step ' + target
            addLog('Cheat: main story jump ? ' + label + '.', 'system')
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
        presetSelect.value = 'ch3_council'

        const btnJumpPreset = document.createElement('button')
        btnJumpPreset.className = 'btn small'
        btnJumpPreset.textContent = 'Jump'
        btnJumpPreset.addEventListener('click', () => {
            const id = String(presetSelect.value || '')
            const pz = STORY_PRESETS.find((x) => x.id === id) || STORY_PRESETS[0]
            if (!pz) return
            setStoryPosition(pz.step, { area: pz.area, partIndex: pz.partIndex, force: pz.force, label: pz.label })
        })

        presetRow.appendChild(presetSelect)
        presetRow.appendChild(btnJumpPreset)
        storyContent.appendChild(presetRow)

        const manualRow = document.createElement('div')
        manualRow.className = 'item-actions'

        const stepInput = document.createElement('input')
        stepInput.className = 'input'
        stepInput.type = 'number'
        stepInput.min = '0'
        stepInput.max = '99'
        stepInput.step = '0.5'
        stepInput.value = String((state && state.quests && state.quests.main && Number.isFinite(Number(state.quests.main.step))) ? state.quests.main.step : 0)

        const btnSetStep = document.createElement('button')
        btnSetStep.className = 'btn small'
        btnSetStep.textContent = 'Set Step'
        btnSetStep.addEventListener('click', () => {
            const n = Number(stepInput.value)
            setStoryPosition(n, { label: 'Step ' + (Number.isFinite(n) ? n : 0) })
        })

        manualRow.appendChild(stepInput)
        manualRow.appendChild(btnSetStep)
        storyContent.appendChild(manualRow)

        // --- Progression & Talents ------------------------------------------
        const progSec = makeCheatSection('Progression & Talents', false)
        const progContent = progSec.body

        const progInfo = document.createElement('p')
        progInfo.className = 'modal-subtitle'
        progInfo.textContent =
            'Fast knobs for builds: grant/refund points, unlock class talents, and force a full stat refresh.'
        progContent.appendChild(progInfo)

        const progRow1 = document.createElement('div')
        progRow1.className = 'item-actions'

        const btnSkill5 = document.createElement('button')
        btnSkill5.className = 'btn small'
        btnSkill5.textContent = '+5 Skill Pts'
        btnSkill5.addEventListener('click', () => {
            p.skillPoints = (p.skillPoints || 0) + 5
            addLog('Cheat: granted +5 skill points.', 'system')
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        const btnTalent1 = document.createElement('button')
        btnTalent1.className = 'btn small'
        btnTalent1.textContent = '+1 Talent Pt'
        btnTalent1.addEventListener('click', () => {
            ensurePlayerTalents(p)
            p.talentPoints = (p.talentPoints || 0) + 1
            addLog('Cheat: granted +1 talent point.', 'system')
            try {
                _recalcPlayerStats()
            } catch (_) {}
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        const btnTalent5 = document.createElement('button')
        btnTalent5.className = 'btn small'
        btnTalent5.textContent = '+5 Talent Pts'
        btnTalent5.addEventListener('click', () => {
            ensurePlayerTalents(p)
            p.talentPoints = (p.talentPoints || 0) + 5
            addLog('Cheat: granted +5 talent points.', 'system')
            try {
                _recalcPlayerStats()
            } catch (_) {}
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        progRow1.appendChild(btnSkill5)
        progRow1.appendChild(btnTalent1)
        progRow1.appendChild(btnTalent5)
        progContent.appendChild(progRow1)

        const progRow2 = document.createElement('div')
        progRow2.className = 'item-actions'

        const btnOpenSkills = document.createElement('button')
        btnOpenSkills.className = 'btn small'
        btnOpenSkills.textContent = 'Open Skill Picker'
        btnOpenSkills.addEventListener('click', () => {
            closeModal()
            openSkillLevelUpModal()
        })

        const btnRefundTalents = document.createElement('button')
        btnRefundTalents.className = 'btn small outline'
        btnRefundTalents.textContent = 'Refund Talents'
        btnRefundTalents.addEventListener('click', () => {
            ensurePlayerTalents(p)
            const owned =
                p.talents && typeof p.talents === 'object'
                    ? Object.keys(p.talents).filter((k) => p.talents[k])
                    : []
            const refunded = owned.length
            p.talents = {}
            p.talentPoints = (p.talentPoints || 0) + refunded
            addLog('Cheat: refunded ' + refunded + ' talent(s).', 'system')
            try {
                _recalcPlayerStats()
            } catch (_) {}
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        const btnUnlockAllTalents = document.createElement('button')
        btnUnlockAllTalents.className = 'btn small'
        btnUnlockAllTalents.textContent = 'Unlock All Class Talents'
        btnUnlockAllTalents.addEventListener('click', () => {
            ensurePlayerTalents(p)
            const list = getTalentsForClass(p.classId) || []
            if (!list.length) {
                addLog('No talent table found for this class.', 'system')
                return
            }
            list.forEach((t) => {
                if (t && t.id) p.talents[t.id] = true
            })
            p.talentPoints = 0
            addLog('Cheat: unlocked all ' + list.length + ' class talents.', 'system')
            try {
                _recalcPlayerStats()
            } catch (_) {}
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        progRow2.appendChild(btnOpenSkills)
        progRow2.appendChild(btnRefundTalents)
        progRow2.appendChild(btnUnlockAllTalents)
        progContent.appendChild(progRow2)

        const progRow3 = document.createElement('div')
        progRow3.className = 'item-actions'

        const btnRecalc = document.createElement('button')
        btnRecalc.className = 'btn small outline'
        btnRecalc.textContent = 'Recalculate Stats'
        btnRecalc.addEventListener('click', () => {
            try {
                _recalcPlayerStats()
                addLog('Cheat: stats recalculated.', 'system')
            } catch (e) {
                addLog(
                    'Cheat: stat recalc failed: ' + (e && e.message ? e.message : e),
                    'system'
                )
            }
            updateHUD()
            requestSave('legacy')
            renderCheatStatus()
        })

        progRow3.appendChild(btnRecalc)
        progContent.appendChild(progRow3)

        // --- QA / Debug ------------------------------------------------------
        const qaSec = makeCheatSection('QA / Debug', false)
        const qaContent = qaSec.body
        const qaInfo = document.createElement('p')
        qaInfo.className = 'modal-subtitle'
        qaInfo.textContent = 'Tools for reproducible debugging (deterministic RNG), quick integrity checks, and bug report export.'
        qaContent.appendChild(qaInfo)

        // Deterministic RNG toggle
        const rngRow1 = document.createElement('div')
        rngRow1.className = 'item-actions'

        const btnDetRng = document.createElement('button')
        btnDetRng.className = 'btn small'
        btnDetRng.textContent = state.debug && state.debug.useDeterministicRng ? 'Deterministic RNG: On' : 'Deterministic RNG: Off'
        btnDetRng.addEventListener('click', () => {
            const next = !(state.debug && state.debug.useDeterministicRng)
            setDeterministicRngEnabled(state, next)
            addLog('Deterministic RNG ' + (next ? 'enabled' : 'disabled') + '.', 'system')
            btnDetRng.textContent = next
                ? 'Deterministic RNG: On'
                : 'Deterministic RNG: Off'
            requestSave('legacy')
        })

        const btnRngLog = document.createElement('button')
        btnRngLog.className = 'btn small'
        btnRngLog.textContent = state.debug && state.debug.captureRngLog ? 'RNG Log: On' : 'RNG Log: Off'
        btnRngLog.addEventListener('click', () => {
            const next = !(state.debug && state.debug.captureRngLog)
            setRngLoggingEnabled(state, next)
            addLog('RNG draw logging ' + (next ? 'enabled' : 'disabled') + '.', 'system')
            btnRngLog.textContent = next ? 'RNG Log: On' : 'RNG Log: Off'
            requestSave('legacy')
        })

        rngRow1.appendChild(btnDetRng)
        rngRow1.appendChild(btnRngLog)
        qaContent.appendChild(rngRow1)

        // Seed controls
        const rngRow2 = document.createElement('div')
        rngRow2.className = 'item-actions'

        const seedInput = document.createElement('input')
        seedInput.type = 'number'
        seedInput.className = 'input'
        seedInput.placeholder = 'Seed'
        seedInput.value = state.debug && Number.isFinite(Number(state.debug.rngSeed)) ? String(state.debug.rngSeed >>> 0) : ''
        seedInput.style.maxWidth = '140px'

        const btnSetSeed = document.createElement('button')
        btnSetSeed.className = 'btn small'
        btnSetSeed.textContent = 'Set Seed'
        btnSetSeed.addEventListener('click', () => {
            const raw = Number(seedInput.value)
            if (!Number.isFinite(raw)) {
                addLog('Seed must be a number.', 'system')
                return
            }
            setRngSeed(state, raw)
            addLog('RNG seed set to ' + (state.debug.rngSeed >>> 0) + ' (index reset).', 'system')
            requestSave('legacy')
        })

        rngRow2.appendChild(seedInput)
        rngRow2.appendChild(btnSetSeed)
        qaContent.appendChild(rngRow2)

        // Smoke tests moved to the HUD "Tests" pill (dev cheats only) so the Cheat Menu stays focused.
        const qaRow3 = document.createElement('div')
        qaRow3.className = 'item-actions'

        const qaHint = document.createElement('div')
        qaHint.className = 'modal-subtitle'
        qaHint.textContent = 'Tip: run Smoke Tests from the "Tests" pill next to the Menu button (dev cheats only).'

        const btnBundle = document.createElement('button')
        btnBundle.className = 'btn small'
        btnBundle.textContent = 'Copy Bug Report (JSON)'
        btnBundle.addEventListener('click', () => {
            copyBugReportBundleToClipboard()
        })

        qaContent.appendChild(qaHint)
        qaRow3.appendChild(btnBundle)
        qaContent.appendChild(qaRow3)

        // --- Spawn & Teleport ----------------------------------------------
        const spawnSec = makeCheatSection('Spawn & Teleport', false)
        const spawnContent = spawnSec.body
        const spawnInfo = document.createElement('p')
        spawnInfo.className = 'modal-subtitle'
        spawnInfo.textContent = 'Quick tools to reproduce issues: teleport, force specific enemies, and grant items by id.'
        spawnContent.appendChild(spawnInfo)

        // Teleport
        const tpRow = document.createElement('div')
        tpRow.className = 'item-actions'

        const tpSelect = document.createElement('select')
        tpSelect.className = 'input'
        try {
            Object.keys(ZONE_DEFS || {}).forEach((z) => {
                const opt = document.createElement('option')
                opt.value = z
                opt.textContent = getAreaDisplayName(z)
                if (z === state.area) opt.selected = true
                tpSelect.appendChild(opt)
            })
        } catch (_) {}

        const btnTp = document.createElement('button')
        btnTp.className = 'btn small'
        btnTp.textContent = 'Teleport'
        btnTp.addEventListener('click', () => {
            const to = tpSelect.value
            if (!to) return
            recordInput('teleport', { to })
            setArea(to, { source: 'cheat:teleport' })
            ensureUiState()
            state.ui.exploreChoiceMade = true
            state.ui.villageActionsOpen = false
            addLog('Cheat: teleported to ' + getAreaDisplayName(to) + '.', 'system')
            closeModal()
            renderActions()
            updateAreaMusic(state)
            requestSave('legacy')
        })

        tpRow.appendChild(tpSelect)
        tpRow.appendChild(btnTp)
        spawnContent.appendChild(tpRow)

        // Force enemy encounter
        const enemyRow = document.createElement('div')
        enemyRow.className = 'item-actions'

        const enemyCount = document.createElement('select')
        enemyCount.className = 'input'
        ;[1, 2, 3].forEach((n) => {
            const opt = document.createElement('option')
            opt.value = String(n)
            opt.textContent = n === 1 ? '1 enemy' : n + ' enemies'
            enemyCount.appendChild(opt)
        })
        enemyCount.value = '1'

        const enemyInput = document.createElement('input')
        enemyInput.className = 'input'
        enemyInput.placeholder = 'Enemy templateId'
        enemyInput.setAttribute('list', 'cheat-enemy-ids')
        const enemyList = document.createElement('datalist')
        enemyList.id = 'cheat-enemy-ids'
        try {
            Object.keys(ENEMY_TEMPLATES || {}).sort().forEach((k) => {
                const opt = document.createElement('option')
                opt.value = k
                enemyList.appendChild(opt)
            })
        } catch (_) {}

        const btnEnemy = document.createElement('button')
        btnEnemy.className = 'btn small'
        btnEnemy.textContent = 'Start Battle'
        btnEnemy.addEventListener('click', () => {
            const id = String(enemyInput.value || '').trim()
            if (!id || !ENEMY_TEMPLATES[id]) {
                addLog('Unknown enemy template id.', 'system')
                return
            }
            // One-shot override: spawn a specific group size (1..3) for the next battle.
            // This keeps the normal difficulty-weighted encounter logic intact.
            const n = Math.max(1, Math.min(3, Math.floor(Number(enemyCount.value || 1))))
            if (!state.flags) state.flags = {}
            state.flags.forceNextGroupSize = n
            recordInput('combat.force', { templateId: id })
            closeModal()
            startBattleWith(id)
            updateHUD()
            updateEnemyPanel()
            renderActions()
            requestSave('legacy')
        })

        enemyRow.appendChild(enemyInput)
        enemyRow.appendChild(enemyCount)
        enemyRow.appendChild(btnEnemy)
        spawnContent.appendChild(enemyList)
        spawnContent.appendChild(enemyRow)

        // Give item by id
        const itemRow = document.createElement('div')
        itemRow.className = 'item-actions'

        const itemInput = document.createElement('input')
        itemInput.className = 'input'
        itemInput.placeholder = 'Item id'
        itemInput.setAttribute('list', 'cheat-item-ids')
        const qtyInput = document.createElement('input')
        qtyInput.className = 'input'
        qtyInput.type = 'number'
        qtyInput.value = '1'
        qtyInput.min = '1'
        const itemList = document.createElement('datalist')
        itemList.id = 'cheat-item-ids'
        try {
            Object.keys(ITEM_DEFS || {}).sort().forEach((k) => {
                const opt = document.createElement('option')
                opt.value = k
                itemList.appendChild(opt)
            })
        } catch (_) {}

        const btnGive = document.createElement('button')
        btnGive.className = 'btn small'
        btnGive.textContent = 'Give Item'
        btnGive.addEventListener('click', () => {
            const id = String(itemInput.value || '').trim()
            const qty = Math.max(1, Math.floor(Number(qtyInput.value || 1)))
            if (!id || !ITEM_DEFS[id]) {
                addLog('Unknown item id.', 'system')
                return
            }
            recordInput('item.give', { id, qty })
            addItemToInventory(id, qty)
            addLog('Cheat: granted ' + qty + '? ' + (ITEM_DEFS[id].name || id) + '.', 'system')
            updateHUD()
            requestSave('legacy')
        })

        // Keep mobile layout aligned: group (item id + qty) as one column, action as the other.
        const itemFields = document.createElement('div')
        itemFields.className = 'cheat-inline'

        itemFields.appendChild(itemInput)
        itemFields.appendChild(qtyInput)

        itemRow.appendChild(itemFields)
        itemRow.appendChild(btnGive)
        spawnContent.appendChild(itemList)
        spawnContent.appendChild(itemRow)

        // ---------------------------------------------------------------------

        // --- Simulation / Time -------------------------------------------------
        // Fast-forwarding is extremely useful for balancing economy, decrees, and
        // weekly bank interest behavior.
        const simSec = makeCheatSection('Simulation / Time', false)
        const simContent = simSec.body
        const simInfo = document.createElement('p')
        simInfo.className = 'modal-subtitle'
        simInfo.textContent = 'Advance in-game days instantly (runs daily ticks) and prints a summary of town changes.'
        simContent.appendChild(simInfo)

        function getBankWeekInfo() {
            const bank = state?.bank
            const todayRaw = state?.time && typeof state.time.dayIndex === 'number' ? Number(state.time.dayIndex) : 0
            const today = Number.isFinite(todayRaw) ? Math.floor(todayRaw) : 0
            const last = bank && Number.isFinite(Number(bank.lastInterestDay)) ? Math.floor(Number(bank.lastInterestDay)) : null
            if (last == null) {
                return { initialized: false, today, daysIntoWeek: null, daysUntilNext: null }
            }
            const daysSince = Math.max(0, today - last)
            const daysIntoWeek = daysSince % 7
            const daysUntilNext = 7 - daysIntoWeek
            return { initialized: true, today, daysIntoWeek, daysUntilNext, lastInterestDay: last }
        }

        function snapshotTown() {
            const econ = getVillageEconomySummary(state)
            const mood = state?.village?.population?.mood
            const day = state?.time && typeof state.time.dayIndex === 'number' ? Math.floor(Number(state.time.dayIndex)) : 0
            const decree = state?.government?.townHallEffects
            const decreeRemaining =
                decree && decree.petitionId && typeof decree.expiresOnDay === 'number'
                    ? Math.max(0, decree.expiresOnDay - day + 1)
                    : 0
            return {
                day,
                econ,
                mood,
                decreeTitle: decree && decree.petitionId ? decree.title || decree.petitionId : null,
                decreeRemaining,
                bankWeek: getBankWeekInfo()
            }
        }

        const simRow = document.createElement('div')
        simRow.className = 'item-actions'

        const simResult = document.createElement('p')
        simResult.className = 'modal-subtitle'
        simResult.style.marginTop = '6px'

        function runFastForward(days) {
            days = Math.max(1, Math.floor(Number(days) || 1))
            const before = snapshotTown()

            // Patch 1.2.52 (hotfix): route cheat day-skips through advanceWorldTime()
            // so the daily tick pipeline is identical to rest/explore.
            advanceWorldDays(state, days, { addLog })

            const after = snapshotTown()

            const bTier = before.econ?.tier?.name || 'Unknown'
            const aTier = after.econ?.tier?.name || 'Unknown'
            const econLine = `Economy: ${bTier} ? ${aTier} (P ${before.econ?.prosperity}?${after.econ?.prosperity}, T ${before.econ?.trade}?${after.econ?.trade}, S ${before.econ?.security}?${after.econ?.security}).`

            const bm = typeof before.mood === 'number' ? before.mood : 0
            const am = typeof after.mood === 'number' ? after.mood : 0
            const moodLine = `Mood: ${bm} ? ${am} (${am - bm >= 0 ? '+' : ''}${am - bm}).`

            const decreeLine = after.decreeTitle
                ? `Decree: ${after.decreeTitle} (${after.decreeRemaining} day${after.decreeRemaining === 1 ? '' : 's'} remaining).`
                : 'Decree: none.'

            const bw = after.bankWeek
            const bankLine = bw.initialized
                ? `Bank: week ${bw.daysIntoWeek}/7, next ledger update in ${bw.daysUntilNext} day${bw.daysUntilNext === 1 ? '' : 's'}.`
                : 'Bank: unopened (weekly cycle starts on first visit).'

            const summary = `Fast-forwarded ${days} day${days === 1 ? '' : 's'}: Day ${before.day} ? ${after.day}. ${econLine} ${moodLine} ${decreeLine} ${bankLine}`

            addLog(`Cheat: ${summary}`, 'system')
            simResult.textContent = summary
            updateHUD()
            updateTimeDisplay()
            requestSave('legacy')
        }

        const btnDay1 = document.createElement('button')
        btnDay1.className = 'btn small'
        btnDay1.textContent = '+1 Day'
        btnDay1.addEventListener('click', () => runFastForward(1))

        const btnDay3 = document.createElement('button')
        btnDay3.className = 'btn small'
        btnDay3.textContent = '+3 Days'
        btnDay3.addEventListener('click', () => runFastForward(3))

        const btnDay7 = document.createElement('button')
        btnDay7.className = 'btn small'
        btnDay7.textContent = '+7 Days'
        btnDay7.addEventListener('click', () => runFastForward(7))

        simRow.appendChild(btnDay1)
        simRow.appendChild(btnDay3)
        simRow.appendChild(btnDay7)
        simContent.appendChild(simRow)
        simContent.appendChild(simResult)


        // --- Diagnostics -------------------------------------------------------
        const diagSec = makeCheatSection('Diagnostics', false)
        const diagContent = diagSec.body
        const diagInfo = document.createElement('p')
        diagInfo.className = 'modal-subtitle'
        diagInfo.textContent = 'Tools to catch "stuck progression" or contradictory flags during testing.'
        diagContent.appendChild(diagInfo)

        const diagRow = document.createElement('div')
        diagRow.className = 'item-actions'

        const btnAudit = document.createElement('button')
        btnAudit.className = 'btn small'
        btnAudit.textContent = 'Progression Audit'
        btnAudit.addEventListener('click', () => {
            const report = quests.buildProgressionAuditReport()
            openModal('Progression Audit', (b) => {
                const pre = document.createElement('pre')
                pre.className = 'code-block'
                pre.textContent = report
                b.appendChild(pre)

                const actions = document.createElement('div')
                actions.className = 'modal-actions'

                const btnCopy = document.createElement('button')
                btnCopy.className = 'btn outline'
                btnCopy.textContent = 'Copy Report'
                btnCopy.addEventListener('click', () => {
                    copyFeedbackToClipboard(report).catch(() => {})
                })

                const btnBack = document.createElement('button')
                btnBack.className = 'btn outline'
                btnBack.textContent = 'Back'
                btnBack.addEventListener('click', () => {
                    closeModal()
                    openCheatMenu()
                })

                actions.appendChild(btnCopy)
                actions.appendChild(btnBack)
                b.appendChild(actions)
            })
        })

        diagRow.appendChild(btnAudit)

        const btnGearAudit = document.createElement('button')
        btnGearAudit.className = 'btn small'
        btnGearAudit.textContent = 'Gear Effects Audit'
        btnGearAudit.addEventListener('click', () => {
            const p = state.player
            if (!p) return

            const snap = (label) => ({
                label,
                maxHp: p.maxHp,
                maxResource: p.maxResource,
                attack: p.stats ? p.stats.attack : 0,
                magic: p.stats ? p.stats.magic : 0,
                armor: p.stats ? p.stats.armor : 0,
                speed: p.stats ? p.stats.speed : 0,
                magicRes: p.stats ? p.stats.magicRes : 0,
                critChance: p.stats ? p.stats.critChance : 0,
                dodgeChance: p.stats ? p.stats.dodgeChance : 0,
                resistAll: p.stats ? p.stats.resistAll : 0,
                lifeSteal: p.stats ? p.stats.lifeSteal : 0,
                armorPen: p.stats ? p.stats.armorPen : 0,
                haste: p.stats ? p.stats.haste : 0,
                thorns: p.stats ? p.stats.thorns : 0,
                hpRegen: p.stats ? p.stats.hpRegen : 0
            })

            const eq = Object.assign({}, p.equipment || {})
            const hp0 = p.hp
            const res0 = p.resource

            // Snapshot without gear
            const slots = ['weapon','armor','head','hands','feet','belt','neck','ring']
            if (!p.equipment) p.equipment = {}
            slots.forEach((k) => { p.equipment[k] = null })
            _recalcPlayerStats()
            const baseStats = snap('No Gear')

            // Restore gear
            p.equipment = Object.assign({}, eq)
            _recalcPlayerStats()
            const gearedStats = snap('With Gear')

            // Restore current HP/resource as close as possible
            p.hp = Math.min(p.maxHp, Math.max(0, hp0))
            p.resource = Math.min(p.maxResource, Math.max(0, res0))

            const keys = ['maxHp','maxResource','attack','magic','armor','speed','magicRes','critChance','dodgeChance','resistAll','lifeSteal','armorPen','haste','thorns','hpRegen']
            const lines = []
            lines.push('GEAR EFFECTS AUDIT')
            lines.push('-----------------')
            lines.push('This report compares derived stats with gear removed vs equipped.')
            lines.push('')

            for (const k of keys) {
                const b = Number(baseStats[k] || 0)
                const g = Number(gearedStats[k] || 0)
                const d = g - b
                const sign = d > 0 ? '+' : ''
                lines.push(k.padEnd(12) + ': ' + String(b).padEnd(8) + ' ? ' + String(g).padEnd(8) + ' (' + sign + d + ')')
            }

            const report = lines.join('\n')
            openModal('Gear Effects Audit', (b) => {
                const pre = document.createElement('pre')
                pre.className = 'code-block'
                pre.textContent = report
                b.appendChild(pre)

                const actions = document.createElement('div')
                actions.className = 'modal-actions'

                const btnCopy = document.createElement('button')
                btnCopy.className = 'btn outline'
                btnCopy.textContent = 'Copy Report'
                btnCopy.addEventListener('click', () => {
                    copyFeedbackToClipboard(report).catch(() => {})
                })

                const btnBack = document.createElement('button')
                btnBack.className = 'btn outline'
                btnBack.textContent = 'Back'
                btnBack.addEventListener('click', () => {
                    closeModal()
                    openCheatMenu()
                })

                actions.appendChild(btnCopy)
                actions.appendChild(btnBack)
                b.appendChild(actions)
            })
        })

        diagRow.appendChild(btnGearAudit)
        diagContent.appendChild(diagRow)

        // --- Loot / gear cheats ------------------------------------------------
        const lootSec = makeCheatSection('Loot & Gear', false)
        const lootContent = lootSec.body

        const lootInfo = document.createElement('p')
        lootInfo.className = 'modal-subtitle'
        lootInfo.textContent =
            'Spawns high-end loot (Lv 99 roll) into your inventory for testing.'
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
                _recalcPlayerStats()
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
            return state.gamblingDebug
        }

        function updateGambleStatus() {
            const dbg = ensureGamblingDebug()
            const modeLabel =
                dbg.mode === 'playerFavored'
                    ? 'Player-Favored'
                    : dbg.mode === 'houseFavored'
                    ? 'House-Favored'
                    : 'Normal'

            const mult =
                typeof dbg.payoutMultiplier === 'number' &&
                dbg.payoutMultiplier > 0
                    ? dbg.payoutMultiplier
                    : 1

            gambleStatus.textContent =
                'Mode: ' +
                modeLabel +
                ' * Payout Multiplier: x' +
                mult.toFixed(2)
        }

        // Odds buttons
        const btnOddsFair = document.createElement('button')
        btnOddsFair.className = 'btn small'
        btnOddsFair.textContent = 'Fair Odds'
        btnOddsFair.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.mode = 'normal'
            updateGambleStatus()
            requestSave('legacy')
        })

        const btnOddsPlayer = document.createElement('button')
        btnOddsPlayer.className = 'btn small'
        btnOddsPlayer.textContent = 'Favor Player'
        btnOddsPlayer.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.mode = 'playerFavored'
            updateGambleStatus()
            requestSave('legacy')
        })

        const btnOddsHouse = document.createElement('button')
        btnOddsHouse.className = 'btn small'
        btnOddsHouse.textContent = 'Favor House'
        btnOddsHouse.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.mode = 'houseFavored'
            updateGambleStatus()
            requestSave('legacy')
        })

        gambleRow1.appendChild(btnOddsFair)
        gambleRow1.appendChild(btnOddsPlayer)
        gambleRow1.appendChild(btnOddsHouse)
        gamblingContent.appendChild(gambleRow1)

        // Payout multiplier buttons
        const btnPayHalf = document.createElement('button')
        btnPayHalf.className = 'btn small'
        btnPayHalf.textContent = 'x0.5 Payout'
        btnPayHalf.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.payoutMultiplier = 0.5
            updateGambleStatus()
            requestSave('legacy')
        })

        const btnPayNormal = document.createElement('button')
        btnPayNormal.className = 'btn small'
        btnPayNormal.textContent = 'x1 Payout'
        btnPayNormal.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.payoutMultiplier = 1
            updateGambleStatus()
            requestSave('legacy')
        })

        const btnPayDouble = document.createElement('button')
        btnPayDouble.className = 'btn small'
        btnPayDouble.textContent = 'x2 Payout'
        btnPayDouble.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.payoutMultiplier = 2
            updateGambleStatus()
            requestSave('legacy')
        })

        gambleRow2.appendChild(btnPayHalf)
        gambleRow2.appendChild(btnPayNormal)
        gambleRow2.appendChild(btnPayDouble)
        gamblingContent.appendChild(gambleRow2)

        updateGambleStatus()
        gamblingContent.appendChild(gambleStatus)

        // Companion debug controls
        const companionSec = makeCheatSection('Companions', false)
        const companionContent = companionSec.body

        const compTitle = document.createElement('div')
        compTitle.className = 'char-section-title'
        compTitle.textContent = 'Companions'
        companionContent.appendChild(compTitle)

        const compRow = document.createElement('div')
        compRow.className = 'item-actions companion-actions'

        const btnWolf = document.createElement('button')
        btnWolf.className = 'btn small'
        btnWolf.textContent = 'Summon Wolf'
        btnWolf.addEventListener('click', () => {
            grantCompanion('wolf')
            renderCheatStatus()
        })

        const btnGolem = document.createElement('button')
        btnGolem.className = 'btn small'
        btnGolem.textContent = 'Summon Golem'
        btnGolem.addEventListener('click', () => {
            grantCompanion('golem')
            renderCheatStatus()
        })

        const btnSprite = document.createElement('button')
        btnSprite.className = 'btn small'
        btnSprite.textContent = 'Summon Sprite'
        btnSprite.addEventListener('click', () => {
            grantCompanion('sprite')
            renderCheatStatus()
        })

        const btnSkeleton = document.createElement('button')
        btnSkeleton.className = 'btn small'
        btnSkeleton.textContent = 'Summon Skeleton'
        btnSkeleton.addEventListener('click', () => {
            grantCompanion('skeleton')
            renderCheatStatus()
        })

        // NEW: Falcon
        const btnFalcon = document.createElement('button')
        btnFalcon.className = 'btn small'
        btnFalcon.textContent = 'Summon Falcon'
        btnFalcon.addEventListener('click', () => {
            grantCompanion('falcon')
            renderCheatStatus()
        })

        // NEW: Treant
        const btnTreant = document.createElement('button')
        btnTreant.className = 'btn small'
        btnTreant.textContent = 'Summon Treant'
        btnTreant.addEventListener('click', () => {
            grantCompanion('treant')
            renderCheatStatus()
        })

        // NEW: Familiar
        const btnFamiliar = document.createElement('button')
        btnFamiliar.className = 'btn small'
        btnFamiliar.textContent = 'Summon Familiar'
        btnFamiliar.addEventListener('click', () => {
            grantCompanion('familiar')
            renderCheatStatus()
        })

        // NEW: Mimic
        const btnMimic = document.createElement('button')
        btnMimic.className = 'btn small'
        btnMimic.textContent = 'Summon Mimic'
        btnMimic.addEventListener('click', () => {
            grantCompanion('mimic')
            renderCheatStatus()
        })

        const btnDismiss = document.createElement('button')
        btnDismiss.className = 'btn small outline'
        btnDismiss.textContent = 'Dismiss Companion'
        btnDismiss.addEventListener('click', () => {
            dismissCompanion()
            renderCheatStatus()
            updateHUD()
            requestSave('legacy')
        })

        compRow.appendChild(btnWolf)
        compRow.appendChild(btnGolem)
        compRow.appendChild(btnSprite)
        compRow.appendChild(btnSkeleton)
        compRow.appendChild(btnFalcon)
        compRow.appendChild(btnTreant)
        compRow.appendChild(btnFamiliar)
        compRow.appendChild(btnMimic)
        compRow.appendChild(btnDismiss)
        companionContent.appendChild(compRow)

        // --- Government & Realm Debug -------------------------------------------
        const govSec = makeCheatSection('Government & Realm', false)
        const govContent = govSec.body

        const govIntro = document.createElement('p')
        govIntro.className = 'modal-subtitle'
        govIntro.textContent =
            'Tweak kingdom metrics, policies and Emberwood village attitudes. Useful for testing government-driven systems.'
        govContent.appendChild(govIntro)

        // Local helpers
        function ensureGovAndVillage() {
            const absDay =
                state.time && typeof state.time.absoluteDay === 'number'
                    ? state.time.absoluteDay
                    : 0
            // Make sure government exists for older saves
            if (typeof initGovernmentState === 'function') {
                initGovernmentState(state, absDay)
            }
            const g = state.government || null
            const village =
                g && g.villages && g.villages.village
                    ? g.villages.village
                    : null
            return { g, village }
        }

        function clampMetricVal(val) {
            const num = Number(val)
            if (isNaN(num)) return 0
            if (num < 0) return 0
            if (num > 100) return 100
            return Math.round(num)
        }

        function clampModifier(val) {
            const num = Number(val)
            if (isNaN(num)) return 0
            // Government normally keeps these in about -0.3 .. +0.3
            const clamped = Math.max(-0.5, Math.min(0.5, num))
            return Math.round(clamped * 100) / 100
        }

        // Layout containers
        const metricsBox = document.createElement('div')
        metricsBox.style.display = 'flex'
        metricsBox.style.flexWrap = 'wrap'
        metricsBox.style.gap = '4px 8px'
        metricsBox.style.marginBottom = '4px'
        govContent.appendChild(metricsBox)

        const policiesBox = document.createElement('div')
        policiesBox.className = 'item-actions'
        policiesBox.style.flexWrap = 'wrap'
        govContent.appendChild(policiesBox)

        const villageBox = document.createElement('div')
        villageBox.style.display = 'flex'
        villageBox.style.flexWrap = 'wrap'
        villageBox.style.gap = '4px 8px'
        villageBox.style.marginTop = '4px'
        govContent.appendChild(villageBox)

        const govSummary = document.createElement('p')
        govSummary.className = 'modal-subtitle'
        govSummary.style.marginTop = '4px'
        govContent.appendChild(govSummary)

        // --- Metric fields -------------------------------------------------------
        function makeMetricField(labelText) {
            const wrap = document.createElement('label')
            wrap.style.display = 'flex'
            wrap.style.alignItems = 'center'
            wrap.style.gap = '4px'
            wrap.style.fontSize = '0.75rem'

            const span = document.createElement('span')
            span.textContent = labelText

            const input = document.createElement('input')
            input.type = 'number'
            input.min = '0'
            input.max = '100'
            input.step = '1'
            input.style.width = '4rem'

            wrap.appendChild(span)
            wrap.appendChild(input)
            return { wrap, input }
        }

        const stabField = makeMetricField('Stability')
        const prospField = makeMetricField('Prosperity')
        const popField = makeMetricField('Popularity')
        const corrField = makeMetricField('Corruption')

        metricsBox.appendChild(stabField.wrap)
        metricsBox.appendChild(prospField.wrap)
        metricsBox.appendChild(popField.wrap)
        metricsBox.appendChild(corrField.wrap)

        // --- Policy selects ------------------------------------------------------
        function makePolicySelect(labelText, options) {
            const wrap = document.createElement('label')
            wrap.style.display = 'flex'
            wrap.style.alignItems = 'center'
            wrap.style.gap = '4px'
            wrap.style.fontSize = '0.75rem'

            const span = document.createElement('span')
            span.textContent = labelText

            const select = document.createElement('select')
            options.forEach(function (opt) {
                const o = document.createElement('option')
                o.value = opt
                o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1)
                select.appendChild(o)
            })

            wrap.appendChild(span)
            wrap.appendChild(select)
            return { wrap, select }
        }

        const taxField = makePolicySelect('Tax', ['low', 'normal', 'high'])
        const milField = makePolicySelect('Military', ['peace', 'tense', 'war'])
        const jusField = makePolicySelect('Justice', [
            'lenient',
            'balanced',
            'harsh'
        ])

        policiesBox.appendChild(taxField.wrap)
        policiesBox.appendChild(milField.wrap)
        policiesBox.appendChild(jusField.wrap)

        // --- Village fields (Emberwood) -----------------------------------------
        function makeVillageField(labelText, min, max, step) {
            const wrap = document.createElement('label')
            wrap.style.display = 'flex'
            wrap.style.alignItems = 'center'
            wrap.style.gap = '4px'
            wrap.style.fontSize = '0.75rem'

            const span = document.createElement('span')
            span.textContent = labelText

            const input = document.createElement('input')
            input.type = 'number'
            input.min = String(min)
            input.max = String(max)
            input.step = String(step)
            input.style.width = '4.5rem'

            wrap.appendChild(span)
            wrap.appendChild(input)
            return { wrap, input }
        }

        const vLoyalField = makeVillageField('Loyalty', 0, 100, 1)
        const vFearField = makeVillageField('Fear', 0, 100, 1)
        const vUnrestField = makeVillageField('Unrest', 0, 100, 1)
        const vProsField = makeVillageField('Pros. mod', -0.5, 0.5, 0.05)
        const vSafeField = makeVillageField('Safe. mod', -0.5, 0.5, 0.05)

        villageBox.appendChild(vLoyalField.wrap)
        villageBox.appendChild(vFearField.wrap)
        villageBox.appendChild(vUnrestField.wrap)
        villageBox.appendChild(vProsField.wrap)
        villageBox.appendChild(vSafeField.wrap)

        // Populate from current state
        function populateGovFields() {
            const gv = ensureGovAndVillage()
            const g = gv.g
            const village = gv.village

            if (g && g.metrics) {
                stabField.input.value =
                    typeof g.metrics.stability === 'number'
                        ? g.metrics.stability
                        : 60
                prospField.input.value =
                    typeof g.metrics.prosperity === 'number'
                        ? g.metrics.prosperity
                        : 55
                popField.input.value =
                    typeof g.metrics.royalPopularity === 'number'
                        ? g.metrics.royalPopularity
                        : 55
                corrField.input.value =
                    typeof g.metrics.corruption === 'number'
                        ? g.metrics.corruption
                        : 30
            }

            const policies = g && g.currentPolicies ? g.currentPolicies : {}
            taxField.select.value = policies.taxRate || 'normal'
            milField.select.value = policies.militaryPosture || 'peace'
            jusField.select.value = policies.justiceStyle || 'balanced'

            if (village) {
                vLoyalField.input.value =
                    typeof village.loyalty === 'number' ? village.loyalty : 60
                vFearField.input.value =
                    typeof village.fear === 'number' ? village.fear : 20
                vUnrestField.input.value =
                    typeof village.unrest === 'number' ? village.unrest : 10
                vProsField.input.value =
                    typeof village.prosperityModifier === 'number'
                        ? village.prosperityModifier
                        : 0
                vSafeField.input.value =
                    typeof village.safetyModifier === 'number'
                        ? village.safetyModifier
                        : 0
            } else {
                vLoyalField.input.value = ''
                vFearField.input.value = ''
                vUnrestField.input.value = ''
                vProsField.input.value = ''
                vSafeField.input.value = ''
            }

            if (typeof getGovernmentSummary === 'function') {
                const summary = getGovernmentSummary(state)
                if (summary && summary.hasGovernment) {
                    const m = summary.metrics || {}
                    const st = typeof m.stability === 'number' ? m.stability : 0
                    const pr =
                        typeof m.prosperity === 'number' ? m.prosperity : 0
                    const rp =
                        typeof m.royalPopularity === 'number'
                            ? m.royalPopularity
                            : 0
                    const co =
                        typeof m.corruption === 'number' ? m.corruption : 0

                    govSummary.textContent =
                        summary.realmName +
                        ' - stability ' +
                        st +
                        ', prosperity ' +
                        pr +
                        ', royal popularity ' +
                        rp +
                        ', corruption ' +
                        co +
                        ' * council: ' +
                        (summary.councilCount || 0) +
                        ' members'
                } else {
                    govSummary.textContent =
                        'No kingdom government has been initialized yet.'
                }
            } else {
                govSummary.textContent =
                    'No kingdom government summary helper is available.'
            }
        }

        populateGovFields()

        // --- Action buttons ------------------------------------------------------
        const govButtons = document.createElement('div')
        govButtons.className = 'item-actions'
        govButtons.style.marginTop = '4px'
        govContent.appendChild(govButtons)

        const btnApplyGov = document.createElement('button')
        btnApplyGov.className = 'btn small'
        btnApplyGov.textContent = 'Apply government changes'

        btnApplyGov.addEventListener('click', function () {
            const gv = ensureGovAndVillage()
            const g = gv.g
            const village = gv.village

            if (!g) {
                addLog(
                    'Cheat: no government state is available to edit.',
                    'system'
                )
                return
            }

            if (!g.metrics) {
                g.metrics = {
                    stability: 60,
                    prosperity: 55,
                    royalPopularity: 55,
                    corruption: 30
                }
            }

            g.metrics.stability = clampMetricVal(stabField.input.value)
            g.metrics.prosperity = clampMetricVal(prospField.input.value)
            g.metrics.royalPopularity = clampMetricVal(popField.input.value)
            g.metrics.corruption = clampMetricVal(corrField.input.value)

            if (!g.currentPolicies) {
                g.currentPolicies = {
                    taxRate: 'normal',
                    militaryPosture: 'peace',
                    justiceStyle: 'balanced'
                }
            }
            g.currentPolicies.taxRate = taxField.select.value
            g.currentPolicies.militaryPosture = milField.select.value
            g.currentPolicies.justiceStyle = jusField.select.value

            if (village) {
                village.loyalty = clampMetricVal(vLoyalField.input.value)
                village.fear = clampMetricVal(vFearField.input.value)
                village.unrest = clampMetricVal(vUnrestField.input.value)
                village.prosperityModifier = clampModifier(
                    vProsField.input.value
                )
                village.safetyModifier = clampModifier(vSafeField.input.value)
            }

            addLog(
                'Cheat: adjusted kingdom government metrics and Emberwood attitudes.',
                'system'
            )
            populateGovFields()
            updateHUD()
            requestSave('legacy')
        })

        const btnClearTownHall = document.createElement('button')
        btnClearTownHall.className = 'btn small outline'
        btnClearTownHall.textContent = 'Clear Town Hall decree'

        btnClearTownHall.addEventListener('click', function () {
            const today =
                state && state.time && typeof state.time.dayIndex === 'number'
                    ? state.time.dayIndex
                    : 0
            if (state.government && state.government.townHallEffects) {
                // Expire the decree; cleanup will remove the payload (Town Hall recreates it on demand).
                state.government.townHallEffects.expiresOnDay = -1
                cleanupTownHallEffects(state, today)
                addLog(
                    'Cheat: cleared any active Town Hall economic decree.',
                    'system'
                )
            } else {
                addLog('Cheat: no Town Hall decree was active.', 'system')
            }
            updateHUD()
            requestSave('legacy')
        })

        govButtons.appendChild(btnApplyGov)
        govButtons.appendChild(btnClearTownHall)

        // ------------------------------------------------------------------
        // Toolbar wiring (search + expand/collapse)
        btnExpandAll.addEventListener('click', () => {
            cheatSections.forEach((s) => s.setOpen(true))
        })

        btnCollapseAll.addEventListener('click', () => {
            cheatSections.forEach((s) => s.setOpen(false))
        })

        function indexSearchables() {
            cheatSections.forEach((sec) => {
                // Only index "action rows" and "field labels" so we don't hide helpful
                // subtitles/section hints while filtering.
                const nodes = sec.body.querySelectorAll('.item-actions, label')
                nodes.forEach((n) => {
                    n.dataset.cheatSearch = String(n.textContent || '')
                        .toLowerCase()
                        .replace(/\s+/g, ' ')
                        .trim()
                })
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
}
