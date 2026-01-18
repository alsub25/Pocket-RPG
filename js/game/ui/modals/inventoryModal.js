/**
 * inventoryModal.js
 * 
 * Inventory modal UI for viewing, using, equipping, selling, and dropping items.
 * Extracted from gameOrchestrator.js to reduce file size.
 * 
 * ~492 lines extracted.
 */

/**
 * Creates the inventory modal function with all necessary dependencies injected.
 * @returns {Function} openInventoryModal function
 */
export function createInventoryModal({
    // Core state
    state,
    
    // UI functions
    openModal,
    addLog,
    updateHUD,
    
    // Game system functions
    requestSave,
    dispatchGameCommand,
    usePotionFromInventory,
    equipItemFromInventory,
    sellItemFromInventory,
    unequipItemIfEquipped,
    _recalcPlayerStats,
    
    // Item system
    getItemPowerScore
}) {
    return function openInventoryModal(inCombat) {
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
            search.placeholder = 'Search...'
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
                // Body armor is the legacy/default slot.
                if (item.slot === 'helmet') return 'helmet'
                if (item.slot === 'chest') return 'chest'
                if (item.slot === 'pants') return 'pants'
                if (item.slot === 'boots') return 'boots'
                if (item.slot === 'gloves') return 'gloves'
                if (item.slot === 'ring') return 'ring'
                if (item.slot === 'amulet') return 'amulet'
                return 'chest'
            }

            function isItemEquipped(item) {
                if (item.type === 'weapon') return p.weapon === item
                if (item.type === 'armor') {
                    const slot = armorSlotFor(item)
                    return p.armor[slot] === item
                }
                return false
            }

            function powerDelta(item) {
                if (item.type === 'weapon') {
                    if (!p.weapon) return { delta: 1, better: true }
                    const cur = getItemPowerScore(p.weapon)
                    const cand = getItemPowerScore(item)
                    return { delta: Math.round(cand - cur), better: cand > cur }
                }
                if (item.type === 'armor') {
                    const slot = armorSlotFor(item)
                    const equipped = p.armor[slot]
                    if (!equipped) return { delta: 1, better: true }
                    const cur = getItemPowerScore(equipped)
                    const cand = getItemPowerScore(item)
                    return { delta: Math.round(cand - cur), better: cand > cur }
                }
                return null
            }

            function compareLine(item) {
                const d = powerDelta(item)
                if (!d) return null
                if (Math.abs(d.delta) < 0.1) return '? same power'
                return (d.delta > 0 ? '? ' : '? ') + Math.abs(d.delta) + ' power'
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

                    // Always float equipped gear to the top within its type.
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

                    // default: power
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
                    // Rarity color (text). Defaults to common when missing.
                    name.classList.add('rarity-' + String(item.rarity || 'common').toLowerCase())
                    name.textContent =
                        item.name +
                        (item.type === 'potion' && (item.quantity || 1) > 1
                            ? '  ?' + (item.quantity || 1)
                            : '')
                    left.appendChild(name)

                    const sub = document.createElement('div')
                    sub.className = 'inv-sub'
                    const bits = []
                    if (item.type) bits.push(item.type.charAt(0).toUpperCase() + item.type.slice(1))
                    if (item.itemLevel) bits.push('Lv' + item.itemLevel)
                    if (isEquipped) bits.push('? Equipped')
                    sub.textContent = bits.join(' * ')
                    left.appendChild(sub)

                    summary.appendChild(left)

                    const right = document.createElement('div')
                    right.className = 'inv-right'

                    if (item.type !== 'potion') {
                        const compare = compareLine(item)
                        if (compare && !isEquipped) {
                            const comp = document.createElement('div')
                            comp.className = 'inv-compare'
                            const d = powerDelta(item)
                            if (d) {
                                comp.classList.add(d.better ? 'better' : 'worse')
                            }
                            comp.textContent = compare
                            right.appendChild(comp)
                        }
                    }

                    summary.appendChild(right)

                    const details = document.createElement('div')
                    details.className = 'inv-card-body'

                    if (item.desc) {
                        const desc = document.createElement('p')
                        desc.className = 'inv-desc'
                        desc.textContent = item.desc
                        details.appendChild(desc)
                    }

                    const actions = document.createElement('div')
                    actions.className = 'inv-actions'

                    const tight = document.createElement('div')
                    tight.className = 'inv-actions-tight'

                    if (item.type === 'potion') {
                        const btn = document.createElement('button')
                        btn.className = 'btn small'
                        btn.textContent = inCombat ? 'Use (ends turn)' : 'Use'
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

                            // Command handler doesn't get a callback, so refresh UI here.
                            if (!inCombat) renderList()
                        })
                        tight.appendChild(btn)
                    }

                    if (item.type === 'weapon' || item.type === 'armor') {
                        if (item.questItem || item.noEquip) {
                            const badge = document.createElement('div')
                            badge.className = 'inv-quest-badge'
                            badge.textContent = 'Quest Item'
                            tight.appendChild(badge)
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
                                        _recalcPlayerStats()
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
                    }

                    // Selling (only when not in combat)
                    if (!inCombat) {
                        const inVillage = (state.area || 'village') === 'village'
                        if (inVillage) {
                            // Prevent selling quest items.
                            if (item.questItem || item.noSell) {
                                // no-op
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

                    // Drop button (always available, but warns in combat)
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

                        // If dropping equipped gear, unequip first
                        unequipItemIfEquipped(p, item)

                        if (item.type === 'potion' && (item.quantity || 1) > 1) {
                            item.quantity -= 1
                        } else {
                            p.inventory.splice(idx, 1)
                        }

                        _recalcPlayerStats()
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
}
