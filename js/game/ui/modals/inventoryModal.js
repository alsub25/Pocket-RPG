// js/game/ui/modals/inventoryModal.js
// Inventory Modal UI extraction from gameOrchestrator.js
//
// This module owns the inventory modal builder + item management functionality.
// It depends on engine-provided helpers via dependency injection to avoid
// circular imports and to keep gameOrchestrator.js focused on orchestration.

/**
 * Creates inventory modal functionality with dependency injection
 * @param {Object} deps - Dependencies object
 * @param {Function} deps.getState - Returns current game state
 * @param {Function} deps.openModal - Opens a modal
 * @param {Function} deps.closeModal - Closes the current modal
 * @param {Function} deps.addLog - Adds a log message
 * @param {Function} deps.updateHUD - Updates the HUD display
 * @param {Function} deps.requestSave - Requests a game save
 * @param {Function} deps.recalcPlayerStats - Recalculates player statistics
 * @param {Function} deps.getItemPowerScore - Gets item power score
 * @param {Function} deps.formatRarityLabel - Formats rarity label
 * @param {Function} deps.dispatchGameCommand - Dispatches game command
 * @param {Function} deps.guardPlayerTurn - Guards player turn in combat
 * @param {Function} deps.endPlayerTurn - Ends player turn in combat
 * @param {Function} deps.unequipItemIfEquipped - Unequips item if equipped
 * @param {Function} deps.sellItemFromInventory - Sells item from inventory
 * @returns {Object} Object with openInventoryModal function
 */
export function createInventoryModal(deps) {
    if (!deps || typeof deps.getState !== 'function') {
        throw new Error('createInventoryModal: missing deps.getState()')
    }

    const {
        getState,
        openModal,
        closeModal,
        addLog,
        updateHUD,
        requestSave,
        recalcPlayerStats,
        getItemPowerScore,
        formatRarityLabel,
        dispatchGameCommand,
        guardPlayerTurn,
        endPlayerTurn,
        unequipItemIfEquipped,
        sellItemFromInventory
    } = deps

    if (typeof openModal !== 'function') {
        throw new Error('createInventoryModal: missing openModal()')
    }

    /**
     * Opens the inventory modal
     * @param {boolean} inCombat - Whether player is in combat
     */
    function openInventoryModal(inCombat) {
        const state = getState()
        const p = state.player
        openModal('Inventory', (body) => {
            body.classList.add('inventory-modal')

            if (!p.inventory.length) {
                body.innerHTML =
                    '<p class="modal-subtitle">You are not carrying anything.</p>'
                return
            }

            const toolbar = document.createElement('div')
            toolbar.className = 'inv-toolbar'

            const searchWrap = document.createElement('div')
            searchWrap.className = 'inv-search-wrap'

            const search = document.createElement('input')
            search.className = 'inv-search'
            search.type = 'text'
            search.placeholder = 'Search…'
            search.autocomplete = 'off'
            searchWrap.appendChild(search)

            const sort = document.createElement('select')
            sort.className = 'inv-sort'
            ;[
                ['power', 'Sort: Power'],
                ['type', 'Sort: Type'],
                ['rarity', 'Sort: Rarity'],
                ['level', 'Sort: Item Lv'],
                ['name', 'Sort: Name']
            ].forEach(([v, label]) => {
                const opt = document.createElement('option')
                opt.value = v
                opt.textContent = label
                sort.appendChild(opt)
            })

            toolbar.appendChild(searchWrap)
            toolbar.appendChild(sort)

            const tabs = document.createElement('div')
            tabs.className = 'inv-tabs'

            const tabDefs = [
                ['all', 'All'],
                ['potion', 'Potions'],
                ['weapon', 'Weapons'],
                ['armor', 'Armor']
            ]

            let activeTab = 'all'
            let query = ''
            let sortMode = 'power'

            function makeTab(id, label) {
                const btn = document.createElement('button')
                btn.className = 'inv-tab'
                btn.textContent = label
                btn.addEventListener('click', () => {
                    activeTab = id
                    tabs.querySelectorAll('.inv-tab').forEach((b) =>
                        b.classList.remove('active')
                    )
                    btn.classList.add('active')
                    renderList()
                })
                if (id === activeTab) btn.classList.add('active')
                return btn
            }

            tabDefs.forEach(([id, label]) => tabs.appendChild(makeTab(id, label)))

            const list = document.createElement('div')
            list.className = 'inv-list'

            const hint = document.createElement('p')
            hint.className = 'modal-subtitle'
            hint.textContent = inCombat
                ? 'Using items consumes your action this turn.'
                : state.area === 'village'
                ? 'Tip: You can sell items in the village from here.'
                : 'Tap an item to expand details.'

            body.appendChild(toolbar)
            body.appendChild(tabs)
            body.appendChild(list)
            body.appendChild(hint)

            const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
            const rarityRank = (r) => {
                const i = rarityOrder.indexOf((r || 'common').toLowerCase())
                return i >= 0 ? i : 0
            }

            function armorSlotFor(item) {
                return item && item.type === 'armor' ? item.slot || 'armor' : null
            }

            function equippedItemFor(item) {
                const eq = p.equipment || {}
                if (!item) return null
                if (item.type === 'weapon') return eq.weapon || null
                if (item.type === 'armor') {
                    const slot = armorSlotFor(item)
                    return slot ? eq[slot] || null : null
                }
                return null
            }

            function isItemEquipped(item) {
                const eqIt = equippedItemFor(item)
                if (!eqIt || !item) return false

                if (eqIt === item) return true

                if (eqIt.instanceId && item.instanceId && eqIt.instanceId === item.instanceId) {
                    return true
                }

                if (eqIt.id && item.id && eqIt.id === item.id) {
                    const inv = Array.isArray(p.inventory) ? p.inventory : []
                    const sameIdCount = inv.reduce((n, it) => (it && it.id === item.id ? n + 1 : n), 0)
                    return sameIdCount <= 1
                }

                return false
            }

            function powerDelta(item) {
                if (!item || (item.type !== 'weapon' && item.type !== 'armor')) return null
                const equipped = equippedItemFor(item)
                if (!equipped) return null

                const cur = getItemPowerScore(equipped)
                const cand = getItemPowerScore(item)
                const delta = Math.round((cand - cur) * 10) / 10
                if (!isFinite(delta)) return null
                return { delta, cur, cand }
            }

            function compareLine(item) {
                const d = powerDelta(item)
                if (!d) return null
                if (Math.abs(d.delta) < 0.1) return '≈ same power'
                return (d.delta > 0 ? '▲ ' : '▼ ') + Math.abs(d.delta) + ' power'
            }

            function renderList() {
                list.innerHTML = ''

                const rows = p.inventory.map((item, idx) => ({ item, idx }))

                const filtered = rows
                    .filter(({ item }) => {
                        if (activeTab === 'all') return true
                        return item.type === activeTab
                    })
                    .filter(({ item }) => {
                        if (!query) return true
                        const q = query.toLowerCase()
                        return (
                            (item.name || '').toLowerCase().includes(q) ||
                            (item.desc || '').toLowerCase().includes(q) ||
                            (item.type || '').toLowerCase().includes(q)
                        )
                    })

                filtered.sort((a, b) => {
                    const ia = a.item
                    const ib = b.item
                    const aEq =
                        isItemEquipped(ia)
                    const bEq =
                        isItemEquipped(ib)

                    if (aEq !== bEq) return aEq ? -1 : 1

                    if (sortMode === 'name') {
                        return (ia.name || '').localeCompare(ib.name || '')
                    }
                    if (sortMode === 'type') {
                        const t = (ia.type || '').localeCompare(ib.type || '')
                        if (t !== 0) return t
                        return (ia.name || '').localeCompare(ib.name || '')
                    }
                    if (sortMode === 'rarity') {
                        const r = rarityRank(ib.rarity) - rarityRank(ia.rarity)
                        if (r !== 0) return r
                        return (ia.name || '').localeCompare(ib.name || '')
                    }
                    if (sortMode === 'level') {
                        const l = (ib.itemLevel || 0) - (ia.itemLevel || 0)
                        if (l !== 0) return l
                        return (ia.name || '').localeCompare(ib.name || '')
                    }

                    const pA = getItemPowerScore(ia) || 0
                    const pB = getItemPowerScore(ib) || 0
                    const d = pB - pA
                    if (Math.abs(d) > 0.001) return d > 0 ? 1 : -1
                    return (ia.name || '').localeCompare(ib.name || '')
                })

                if (!filtered.length) {
                    const empty = document.createElement('p')
                    empty.className = 'modal-subtitle'
                    empty.textContent = 'No items match your filters.'
                    list.appendChild(empty)
                    return
                }

                filtered.forEach(({ item, idx }) => {
                    const isEquipped = isItemEquipped(item)

                    const card = document.createElement('details')
                    card.className = 'inv-card'
                    if (isEquipped) card.open = true

                    const summary = document.createElement('summary')
                    summary.className = 'inv-card-header'

                    const left = document.createElement('div')
                    left.className = 'inv-left'

                    const name = document.createElement('div')
                    name.className = 'inv-name'
                    name.classList.add('rarity-' + String(item.rarity || 'common').toLowerCase())
                    name.textContent =
                        item.name +
                        (item.type === 'potion' && (item.quantity || 1) > 1
                            ? '  ×' + (item.quantity || 1)
                            : '')
                    left.appendChild(name)

                    const sub = document.createElement('div')
                    sub.className = 'inv-sub'
                    const bits = []
                    if (item.itemLevel) bits.push('iLv ' + item.itemLevel)
                    if (item.rarity) bits.push(formatRarityLabel(item.rarity))
                    if (item.type === 'potion') {
                        bits.push('Potion')
                    } else if (item.type === 'weapon') {
                        bits.push('Weapon')
                    } else {
                        const slot = item.slot || 'armor'
                        const pretty =
                            slot === 'armor'
                                ? 'Armor'
                                : slot.charAt(0).toUpperCase() + slot.slice(1)
                        bits.push(pretty)
                    }
                    if (isEquipped) bits.push('Equipped')
                    sub.textContent = bits.filter(Boolean).join(' • ')
                    left.appendChild(sub)

                    const right = document.createElement('div')
                    right.className = 'inv-right'

                    const score = document.createElement('div')
                    score.className = 'inv-score'
                    score.textContent = Math.round((getItemPowerScore(item) || 0) * 10) / 10
                    right.appendChild(score)

                    const d = powerDelta(item)
                    if (d) {
                        const deltaEl = document.createElement('div')
                        deltaEl.className = 'inv-delta'
                        if (Math.abs(d.delta) < 0.1) {
                            deltaEl.textContent = '≈'
                            deltaEl.classList.add('same')
                        } else {
                            deltaEl.textContent = (d.delta > 0 ? '▲' : '▼') + Math.abs(d.delta)
                            deltaEl.classList.add(d.delta > 0 ? 'up' : 'down')
                        }
                        right.appendChild(deltaEl)
                    }

                    summary.appendChild(left)
                    summary.appendChild(right)

                    const details = document.createElement('div')
                    details.className = 'inv-details'

                    const desc = document.createElement('div')
                    desc.className = 'inv-desc'
                    desc.textContent = item.desc || ''
                    details.appendChild(desc)

                    const cmp = compareLine(item)
                    if (cmp) {
                        const cmpEl = document.createElement('div')
                        cmpEl.className = 'inv-compare'
                        cmpEl.textContent = cmp
                        details.appendChild(cmpEl)
                    }

                    const actions = document.createElement('div')
                    actions.className = 'inv-actions'

                    const tight = document.createElement('div')
                    tight.className = 'inv-actions-tight'

                    if (item.type === 'potion') {
                        const isQuestItem = !!(item.questItem || item.noSell || item.noDrop || item.usable === false)
                        if (!isQuestItem) {
                            const btn = document.createElement('button')
                            btn.className = 'btn small'
                            btn.textContent = 'Use'
                            btn.addEventListener('click', (e) => {
                                e.preventDefault()
                                const dispatched = dispatchGameCommand('INVENTORY_USE_POTION', {
                                    index: idx,
                                    inCombat: !!inCombat
                                })

                                if (!dispatched) {
                                    usePotionFromInventory(idx, inCombat, {
                                        stayOpen: !inCombat,
                                        onAfterUse: renderList
                                    })
                                    return
                                }

                                if (!inCombat) renderList()
                            })
                            tight.appendChild(btn)
                        } else {
                            const badge = document.createElement('div')
                            badge.className = 'inv-quest-badge'
                            badge.textContent = 'Quest Item'
                            tight.appendChild(badge)
                        }
                    } else {
                        if (!isEquipped) {
                            const btn = document.createElement('button')
                            btn.className = 'btn small'
                            btn.textContent = 'Equip'
                            btn.addEventListener('click', (e) => {
                                e.preventDefault()
                                const dispatched = dispatchGameCommand('INVENTORY_EQUIP', {
                                    index: idx
                                })

                                if (!dispatched) {
                                    equipItemFromInventory(idx, {
                                        stayOpen: true,
                                        onAfterEquip: renderList
                                    })
                                    return
                                }

                                renderList()
                            })
                            tight.appendChild(btn)
                        } else {
                            const btn = document.createElement('button')
                            btn.className = 'btn small'
                            btn.textContent = 'Unequip'
                            btn.addEventListener('click', (e) => {
                                e.preventDefault()
                                const dispatched = dispatchGameCommand('INVENTORY_UNEQUIP', {
                                    index: idx
                                })

                                if (!dispatched) {
                                    unequipItemIfEquipped(p, item)
                                    recalcPlayerStats()
                                    updateHUD()
                                    requestSave('legacy')
                                    renderList()
                                    return
                                }

                                renderList()
                            })
                            tight.appendChild(btn)
                        }
                    }

                    if (!inCombat) {
                        const inVillage = (state.area || 'village') === 'village'
                        if (inVillage) {
                            if (item.questItem || item.noSell) {
                            } else {
                                const btnSell = document.createElement('button')
                                btnSell.className = 'btn small'
                                btnSell.textContent = 'Sell'
                                btnSell.addEventListener('click', (e) => {
                                    e.preventDefault()
                                    const dispatched = dispatchGameCommand('INVENTORY_SELL', {
                                        index: idx,
                                        context: 'village'
                                    })

                                    if (!dispatched) {
                                        sellItemFromInventory(idx, 'village')
                                        renderList()
                                        return
                                    }

                                    renderList()
                                })
                                actions.appendChild(btnSell)
                            }
                        }
                    }

                    const btnDrop = document.createElement('button')
                    btnDrop.className = 'btn small danger'
                    btnDrop.textContent = 'Drop'
                    btnDrop.addEventListener('click', (e) => {
                        e.preventDefault()

                        if (item.questItem || item.noDrop) {
                            addLog('You cannot drop a quest item.', 'system')
                            return
                        }

                        const ok = inCombat
                            ? confirm('Drop this item during combat? You may regret it.')
                            : confirm('Drop this item?')
                        if (!ok) return

                        const dispatched = dispatchGameCommand('INVENTORY_DROP', {
                            index: idx,
                            inCombat: !!inCombat
                        })

                        if (dispatched) {
                            renderList()
                            return
                        }

                        unequipItemIfEquipped(p, item)

                        if (item.type === 'potion' && (item.quantity || 1) > 1) {
                            item.quantity -= 1
                        } else {
                            p.inventory.splice(idx, 1)
                        }

                        recalcPlayerStats()
                        updateHUD()
                        requestSave('legacy')
                        renderList()
                    })
                    tight.appendChild(btnDrop)

                    if (tight.childNodes.length) actions.appendChild(tight)

                    details.appendChild(actions)

                    card.appendChild(summary)
                    card.appendChild(details)
                    list.appendChild(card)
                })
            }

            search.addEventListener('input', () => {
                query = (search.value || '').trim()
                renderList()
            })

            sort.addEventListener('change', () => {
                sortMode = sort.value || 'power'
                renderList()
            })

            renderList()
        })
    }

    function usePotionFromInventory(index, inCombat, opts = {}) {
        const state = getState()
        const p = state.player
        const item = p.inventory[index]
        if (!item || item.type !== 'potion') return

        if (inCombat) {
            if (!guardPlayerTurn()) return
        }

        const stayOpen = !!opts.stayOpen
        const onAfterUse = typeof opts.onAfterUse === 'function' ? opts.onAfterUse : null

        let used = false
        if (item.hpRestore) {
            const before = p.hp
            p.hp = Math.min(p.maxHp, p.hp + item.hpRestore)
            if (p.hp > before) {
                addLog(
                    'You drink ' + item.name + ' and recover ' + (p.hp - before) + ' HP.',
                    'good'
                )
                used = true
            }
        }
        if (item.resourceRestore) {
            if (item.resourceKey && item.resourceKey !== p.resourceKey) {
                addLog(
                    item.name + " doesn't restore your " + (p.resourceName || 'power') + '.',
                    'system'
                )
            } else {
                const before = p.resource
                p.resource = Math.min(p.maxResource, p.resource + item.resourceRestore)
                if (p.resource > before) {
                    addLog(
                        'You drink ' +
                            item.name +
                            ' and recover ' +
                            (p.resource - before) +
                            ' ' +
                            p.resourceName +
                            '.',
                        'good'
                    )
                    used = true
                }
            }
        }

        if (used) {
            item.quantity = (item.quantity || 1) - 1
            if (item.quantity <= 0) {
                p.inventory.splice(index, 1)
            }
            updateHUD()
            requestSave('legacy')

            if (onAfterUse) onAfterUse()

            if (inCombat) {
                closeModal()
                endPlayerTurn({ source: 'item', item: item.id || item.name })
            } else if (!stayOpen) {
                closeModal()
            }
        } else {
            addLog('Nothing happens.', 'system')
        }
    }

    function equipItemFromInventory(index, opts = {}) {
        const state = getState()
        const p = state.player
        const item = p.inventory[index]
        if (!item || (item.type !== 'weapon' && item.type !== 'armor')) return

        if (!p.equipment) p.equipment = {}
        if (p.equipment.weapon === undefined) p.equipment.weapon = null
        if (p.equipment.armor === undefined) p.equipment.armor = null
        if (p.equipment.head === undefined) p.equipment.head = null
        if (p.equipment.hands === undefined) p.equipment.hands = null
        if (p.equipment.feet === undefined) p.equipment.feet = null
        if (p.equipment.belt === undefined) p.equipment.belt = null
        if (p.equipment.neck === undefined) p.equipment.neck = null
        if (p.equipment.ring === undefined) p.equipment.ring = null

        const stayOpen = !!opts.stayOpen
        const onAfterEquip =
            typeof opts.onAfterEquip === 'function' ? opts.onAfterEquip : null

        const slotLabel = (slot) =>
            slot === 'weapon'
                ? 'weapon'
                : slot === 'armor'
                ? 'armor'
                : slot === 'head'
                ? 'head'
                : slot === 'hands'
                ? 'hands'
                : slot === 'feet'
                ? 'feet'
                : slot === 'belt'
                ? 'belt'
                : slot === 'neck'
                ? 'neck'
                : slot === 'ring'
                ? 'ring'
                : 'gear'

        if (item.type === 'weapon') {
            p.equipment.weapon = item
            addLog('You equip ' + item.name + ' as your weapon.', 'good')
        } else {
            const slot = item.slot || 'armor'
            if (p.equipment[slot] === undefined) p.equipment[slot] = null
            p.equipment[slot] = item
            addLog(
                'You equip ' + item.name + ' as your ' + slotLabel(slot) + '.',
                'good'
            )
        }

        recalcPlayerStats()
        updateHUD()
        requestSave('legacy')

        if (onAfterEquip) onAfterEquip()
        if (!stayOpen) closeModal()
    }

    return {
        openInventoryModal,
        usePotionFromInventory,
        equipItemFromInventory
    }
}
