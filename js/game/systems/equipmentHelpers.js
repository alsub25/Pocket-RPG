/**
 * @fileoverview Equipment & Inventory Helper Functions
 * Extracted from gameOrchestrator.js for modularity (Patch 1.2.72)
 * 
 * Provides functions for:
 * - Adding items to inventory (static and generated)
 * - Equipping/unequipping items
 * - Using potions
 * - Selling items
 */

export function createEquipmentHelpers(deps) {
    const {
        state,
        cloneItemDef,
        _engine,
        quests,
        addLog,
        updateHUD,
        requestSave,
        withSaveTxn,
        getSellValue,
        closeModal,
        guardPlayerTurn,
        endPlayerTurn,
        _recalcPlayerStats
    } = deps

    function _questEventsEnabled() {
        try {
            const svc = _engine && typeof _engine.getService === 'function' ? _engine.getService('ew.questEvents') : null
            return !!(svc && svc.enabled)
        } catch (_) { return false }
    }

    function addItemToInventory(itemId, quantity) {
        // Defensive: normalize quantity (prevents negative / NaN quantities from corrupting inventory).
        quantity = Math.floor(Number(quantity))
        if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1
        const def = cloneItemDef(itemId)
        if (!def) return

        const inv = state.player.inventory
        const existingIndex = inv.findIndex(
            (it) => it.id === def.id && it.type === 'potion'
        )
        if (existingIndex >= 0 && def.type === 'potion') {
            const prev = Math.floor(Number(inv[existingIndex].quantity))
            inv[existingIndex].quantity = (Number.isFinite(prev) ? prev : 0) + quantity
        } else {
            def.quantity = quantity
            inv.push(def)
        }

        // World event (consumed by questEvents + autosave plugins)
        try { _engine && _engine.emit && _engine.emit('world:itemGained', { itemId: def.id, quantity }) } catch (_) {}

        // Legacy quest hook (kept as a fallback when the questEvents plugin isn't present)
        if (!_questEventsEnabled()) {
            try {
                if (quests && typeof quests.applyQuestProgressOnItemGain === 'function') {
                    quests.applyQuestProgressOnItemGain(def.id, quantity)
                }
            } catch (_) {}
        }
    }

    function addGeneratedItemToInventory(item, quantity = 1) {
        if (!item) return
        quantity = Math.floor(Number(quantity))
        if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1
        const inv = state.player.inventory

        // Deep-clone to avoid accidental shared references.
        const cloned = JSON.parse(JSON.stringify(item))

        // Stack potions by id; equipment stays unique.
        if (cloned.type === 'potion') {
            const existingIndex = inv.findIndex(
                (it) => it.id === cloned.id && it.type === 'potion'
            )
            if (existingIndex >= 0) {
                const prev = Math.floor(Number(inv[existingIndex].quantity))
                inv[existingIndex].quantity = (Number.isFinite(prev) ? prev : 0) + quantity
                try { _engine && _engine.emit && _engine.emit('world:itemGained', { itemId: cloned.id, quantity }) } catch (_) {}

                if (!_questEventsEnabled()) {
                    try {
                        if (quests && typeof quests.applyQuestProgressOnItemGain === 'function') {
                            quests.applyQuestProgressOnItemGain(cloned.id, quantity)
                        }
                    } catch (_) {}
                }
                return
            }
            cloned.quantity = quantity
            inv.push(cloned)

            try { _engine && _engine.emit && _engine.emit('world:itemGained', { itemId: cloned.id, quantity }) } catch (_) {}

            if (!_questEventsEnabled()) {
                try {
                    if (quests && typeof quests.applyQuestProgressOnItemGain === 'function') {
                        quests.applyQuestProgressOnItemGain(cloned.id, quantity)
                    }
                } catch (_) {}
            }
            return
        }

        // Equipment items should not stack
        cloned.quantity = 1
        inv.push(cloned)

        try { _engine && _engine.emit && _engine.emit('world:itemGained', { itemId: cloned.id, quantity: 1 }) } catch (_) {}

        if (!_questEventsEnabled()) {
            try {
                if (quests && typeof quests.applyQuestProgressOnItemGain === 'function') {
                    quests.applyQuestProgressOnItemGain(cloned.id, 1)
                }
            } catch (_) {}
        }

        // Optional QoL: auto-equip newly acquired gear if the slot is currently empty.
        // Kept out of combat to avoid mid-fight equipment changes.
        try {
            const p = state && state.player ? state.player : null
            if (
                p &&
                !state.inCombat &&
                state.settingsAutoEquipLoot &&
                (cloned.type === 'weapon' || cloned.type === 'armor')
            ) {
                if (!p.equipment) p.equipment = {}
                const ensureSlot = (k) => {
                    if (p.equipment[k] === undefined) p.equipment[k] = null
                }
                ;['weapon','armor','head','hands','feet','belt','neck','ring'].forEach(ensureSlot)

                const slot = cloned.slot || (cloned.type === 'weapon' ? 'weapon' : 'armor')
                ensureSlot(slot)

                if (p.equipment[slot] == null) {
                    p.equipment[slot] = cloned
                    addLog('Auto-equipped ' + cloned.name + ' (' + slot + ').', 'system')
                    _recalcPlayerStats()
                }
            }
        } catch (e) {
            // ignore auto-equip failures
        }
    }

    function unequipItemIfEquipped(player, item) {
        if (!player || !player.equipment || !item) return false

        const eq = player.equipment
        let changed = false

        // 1) Exact object match (best for duplicated item ids)
        Object.keys(eq).forEach((k) => {
            if (eq[k] === item) {
                eq[k] = null
                changed = true
            }
        })

        // 2) Fallback: id match (legacy saves or cloned equip refs)
        // IMPORTANT: This is *unsafe* when the player owns multiple copies with the same id.
        // In that scenario we cannot know which copy was meant, so we refuse to unequip by id.
        if (!changed && item.id) {
            const inv = Array.isArray(player.inventory) ? player.inventory : []
            const sameIdCount = inv.reduce((n, it) => (it && it.id === item.id ? n + 1 : n), 0)
            if (sameIdCount <= 1) {
                Object.keys(eq).forEach((k) => {
                    if (eq[k] && eq[k].id === item.id) {
                        eq[k] = null
                        changed = true
                    }
                })
            }
        }

        return changed
    }

    function sellItemFromInventory(index, context = 'village') {
        return withSaveTxn('inventory:sell', () => {
            const p = state.player
            const item = p.inventory[index]
            if (!item) return

        // Prevent selling quest/unique items if we ever add them
        if (item.noSell) {
            addLog('This item cannot be sold.', 'system')
            return
        }

        const sellValue = getSellValue(item, context)
        if (!sellValue || sellValue <= 0) {
            addLog('No merchant will buy this.', 'system')
            return
        }

        // If selling equipped gear, unequip first (supports multi-slot gear).
        unequipItemIfEquipped(p, item)

        // Remove from inventory
        if (item.type === 'potion' && (item.quantity || 1) > 1) {
            item.quantity -= 1
        } else {
            p.inventory.splice(index, 1)
        }

        p.gold = (p.gold || 0) + sellValue
        addLog('Sold ' + item.name + ' for ' + sellValue + ' gold.', 'good')

        _recalcPlayerStats()
        updateHUD()
        requestSave('inventory:sell')
        })
    }

    function usePotionFromInventory(index, inCombat, opts = {}) {
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
        const p = state.player
        const item = p.inventory[index]
        if (!item || (item.type !== 'weapon' && item.type !== 'armor')) return

        // Ensure equipment schema is present (older saves).
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

        _recalcPlayerStats()
        updateHUD()
        requestSave('legacy')

        if (onAfterEquip) onAfterEquip()
        if (!stayOpen) closeModal()
    }

    return {
        addItemToInventory,
        addGeneratedItemToInventory,
        unequipItemIfEquipped,
        sellItemFromInventory,
        usePotionFromInventory,
        equipItemFromInventory
    }
}
