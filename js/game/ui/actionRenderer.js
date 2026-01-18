/**
 * actionRenderer.js
 * Manages rendering of action buttons in exploration and combat modes.
 */

export function createActionRenderer(deps) {
    const {
        state,
        handleExploreClick,
        openExploreModal,
        openInventoryModal,
        openSpellsModal,
        openTavernModal,
        openBankModal,
        openMerchantModal,
        openTownHallModal,
        openGovernmentModal,
        playerBasicAttack,
        playerInterrupt,
        tryFlee,
        ensureCombatPointers,
        canPlayerActNow,
        dispatchGameCommand,
        quests,
        addLog
    } = deps

    function makeActionButton(label, onClick, extraClass, opts) {
        // Backwards-compatible: allow makeActionButton(label, onClick, opts)
        let cls = extraClass
        let o = opts
        if (cls && typeof cls === 'object' && !o) {
            o = cls
            cls = ''
        }

        const btn = document.createElement('button')
        btn.className = 'btn small ' + (cls || '')
        btn.textContent = label

        const cfg = o || {}
        if (cfg.title) btn.title = String(cfg.title)
        if (cfg.disabled) {
            btn.disabled = true
            btn.classList.add('disabled')
        }

        btn.addEventListener('click', (e) => {
            if (btn.disabled) return
            onClick(e)
        })
        return btn
    }

    function renderExploreActions(actionsEl) {
        actionsEl.innerHTML = ''
        if (!state.player) return

        if (!state.ui) state.ui = {}
        const ui = state.ui
        const inVillage = state.area === 'village'
        const showVillageMenu = inVillage && ui.villageActionsOpen

        // ? VILLAGE SUBMENU MODE ---------------------------------------------------
        if (showVillageMenu) {
            actionsEl.appendChild(
                makeActionButton('Elder Rowan', () => {
                    if (!dispatchGameCommand('GAME_OPEN_ELDER_ROWAN', {})) {
                        if (quests && quests.openElderRowanDialog) quests.openElderRowanDialog()
                    }
                })
            )

            actionsEl.appendChild(
                makeActionButton('Tavern', () => {
                    if (!dispatchGameCommand('GAME_OPEN_TAVERN', {})) openTavernModal()
                })
            )

            actionsEl.appendChild(
                makeActionButton('Bank', () => {
                    if (!dispatchGameCommand('GAME_OPEN_BANK', {})) openBankModal()
                })
            )

            actionsEl.appendChild(
                makeActionButton('Merchant', () => {
                    if (!dispatchGameCommand('GAME_OPEN_MERCHANT', {})) openMerchantModal()
                })
            )

            actionsEl.appendChild(
                makeActionButton('Town Hall', () => {
                    if (!dispatchGameCommand('GAME_OPEN_TOWN_HALL', {})) openTownHallModal()
                })
            )

            actionsEl.appendChild(
                makeActionButton('Back', () => {
                    ui.villageActionsOpen = false
                    renderActions()
                })
            )

            return
        }

        // ? DEFAULT (NON-VILLAGE or VILLAGE NORMAL BAR) ----------------------------
        // Village-only: button to enter the village submenu
        if (inVillage) {
            actionsEl.appendChild(
                makeActionButton('Village ?', () => {
                    ui.villageActionsOpen = true
                    renderActions()
                })
            )

            // [check] Only show Realm & Council if you're in the village
            actionsEl.appendChild(
                makeActionButton('Realm & Council', () => {
                    if (!dispatchGameCommand('GAME_OPEN_GOVERNMENT', {})) openGovernmentModal()
                })
            )
        }

        actionsEl.appendChild(
            makeActionButton(
                'Explore',
                () => {
                    if (!dispatchGameCommand('GAME_EXPLORE', {})) handleExploreClick()
                },
                ''
            )
        )

        actionsEl.appendChild(
            makeActionButton('Change Area', () => {
                if (!dispatchGameCommand('GAME_CHANGE_AREA', {})) {
                    ui.exploreChoiceMade = false
                    openExploreModal()
                }
            })
        )

        actionsEl.appendChild(
            makeActionButton('Inventory', () => {
                if (!dispatchGameCommand('GAME_OPEN_INVENTORY', { inCombat: false })) openInventoryModal(false)
            })
        )

        actionsEl.appendChild(
            makeActionButton('Spells', () => {
                if (!dispatchGameCommand('GAME_OPEN_SPELLS', { inCombat: false })) openSpellsModal(false)
            })
        )

        // Cheats button removed from the main action bar.
        // In dev-cheat mode, Cheats are accessed via the ?? HUD pill next to ? and the Menu button.
    }

    function renderCombatActions(actionsEl) {
        actionsEl.innerHTML = ''

        const locked = !canPlayerActNow()
        const lockTitle = locked ? 'Resolve the current turn first.' : ''

        actionsEl.appendChild(
            makeActionButton('Attack', () => {
                if (!dispatchGameCommand('COMBAT_ATTACK', {})) playerBasicAttack()
            }, '', { disabled: locked, title: lockTitle })
        )

        actionsEl.appendChild(
            makeActionButton('Interrupt', () => {
                if (!dispatchGameCommand('COMBAT_INTERRUPT', {})) playerInterrupt()
            }, 'outline', { disabled: locked, title: lockTitle })
        )

        actionsEl.appendChild(
            makeActionButton('Spells', () => {
                if (!dispatchGameCommand('GAME_OPEN_SPELLS', { inCombat: true })) openSpellsModal(true)
            }, '', { disabled: locked, title: lockTitle })
        )

        actionsEl.appendChild(
            makeActionButton('Items', () => {
                if (!dispatchGameCommand('GAME_OPEN_INVENTORY', { inCombat: true })) openInventoryModal(true)
            }, '', { disabled: locked, title: lockTitle })
        )

        const isBoss = !!(state.currentEnemy && state.currentEnemy.isBoss)
        actionsEl.appendChild(
            makeActionButton(isBoss ? 'No Escape' : 'Flee', () => {
                if (isBoss) {
                    addLog('This foe blocks your escape!', 'danger')
                } else {
                    if (!dispatchGameCommand('COMBAT_FLEE', {})) tryFlee()
                }
            }, isBoss ? 'outline' : '', { disabled: locked, title: lockTitle })
        )
    }

    function renderActions() {
        const actionsEl = document.getElementById('actions')
        actionsEl.innerHTML = ''

        if (!state.player) return

        if (state.inCombat) {
            // Hardening: never allow Explore actions to render while inCombat.
            // If combat pointers desync, attempt a quick repair.
            try { ensureCombatPointers() } catch (_) {}

            if (state.inCombat && state.currentEnemy) {
                renderCombatActions(actionsEl)
            } else {
                // If we still can't recover, fall back safely.
                state.inCombat = false
                state.currentEnemy = null
                state.enemies = []
                state.targetEnemyIndex = 0
                if (state.combat) {
                    state.combat.busy = false
                    state.combat.phase = 'player'
                }
                renderExploreActions(actionsEl)
            }
        } else {
            renderExploreActions(actionsEl)
        }
    }

    return {
        renderActions,
        renderExploreActions,
        renderCombatActions,
        makeActionButton
    }
}
