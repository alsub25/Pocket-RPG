// js/game/inventory/inventoryManager.js
// Core inventory management operations
//
// Extracted from gameOrchestrator.js to improve modularity and maintainability.
// This module handles adding/removing items, stacking, and inventory manipulation.

/**
 * Helper function to emit item gained events and handle quest progress
 * Reduces code duplication across add item functions
 * @private
 */
function handleItemGainedEvent(itemId, quantity, emitEventFn, questsObj, questEventsEnabledFn) {
    // World event (consumed by questEvents + autosave plugins)
    try { 
        if (emitEventFn) {
            emitEventFn('world:itemGained', { itemId, quantity }) 
        }
    } catch (_) {}

    // Legacy quest hook (kept as a fallback when the questEvents plugin isn't present)
    const questEventsEnabled = questEventsEnabledFn ? questEventsEnabledFn() : false
    if (!questEventsEnabled) {
        try {
            if (questsObj && typeof questsObj.applyQuestProgressOnItemGain === 'function') {
                questsObj.applyQuestProgressOnItemGain(itemId, quantity)
            }
        } catch (_) {}
    }
}

/**
 * Adds an item to inventory by its definition ID
 * @param {Object} state - Game state
 * @param {string} itemId - Item definition ID
 * @param {number} quantity - Number of items to add
 * @param {Function} cloneItemDefFn - Function to clone item definition
 * @param {Function} emitEventFn - Function to emit world events
 * @param {Object} questsObj - Quest system object (optional, for legacy support)
 * @param {Function} questEventsEnabledFn - Function to check if quest events plugin is active
 */
export function addItemToInventory(state, itemId, quantity, cloneItemDefFn, emitEventFn, questsObj, questEventsEnabledFn) {
    // Defensive: normalize quantity (prevents negative / NaN quantities from corrupting inventory).
    quantity = Math.floor(Number(quantity))
    if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1
    const def = cloneItemDefFn(itemId)
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

    handleItemGainedEvent(def.id, quantity, emitEventFn, questsObj, questEventsEnabledFn)
}

/**
 * Adds a dynamically generated item to inventory (used for loot drops)
 * @param {Object} state - Game state
 * @param {Object} item - Generated item object
 * @param {number} quantity - Number of items to add
 * @param {Function} emitEventFn - Function to emit world events
 * @param {Object} questsObj - Quest system object (optional, for legacy support)
 * @param {Function} questEventsEnabledFn - Function to check if quest events plugin is active
 * @param {Function} autoEquipFn - Optional function to auto-equip newly acquired gear
 */
export function addGeneratedItemToInventory(state, item, quantity, emitEventFn, questsObj, questEventsEnabledFn, autoEquipFn) {
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
            handleItemGainedEvent(cloned.id, quantity, emitEventFn, questsObj, questEventsEnabledFn)
            return
        }
        cloned.quantity = quantity
        inv.push(cloned)
        handleItemGainedEvent(cloned.id, quantity, emitEventFn, questsObj, questEventsEnabledFn)
        return
    }

    // Equipment items should not stack
    cloned.quantity = 1
    inv.push(cloned)
    handleItemGainedEvent(cloned.id, 1, emitEventFn, questsObj, questEventsEnabledFn)

    // Optional QoL: auto-equip newly acquired gear if the slot is currently empty.
    // Kept out of combat to avoid mid-fight equipment changes.
    if (autoEquipFn) {
        try {
            autoEquipFn(state, cloned)
        } catch (_) {
            // ignore auto-equip failures
        }
    }
}

/**
 * Removes an item from inventory and handles selling
 * @param {Object} state - Game state
 * @param {number} index - Inventory index
 * @param {string} context - Context for selling (e.g., 'village')
 * @param {Function} getSellValueFn - Function to calculate sell value
 * @param {Function} unequipItemFn - Function to unequip items
 * @param {Function} addLogFn - Function to add log messages
 * @param {Function} recalcStatsFn - Function to recalculate stats after selling equipment
 * @param {Function} updateHUDFn - Function to update HUD
 * @returns {boolean} True if item was sold successfully
 */
export function sellItemFromInventory(state, index, context, getSellValueFn, unequipItemFn, addLogFn, recalcStatsFn, updateHUDFn) {
    const p = state.player
    const item = p.inventory[index]
    if (!item) return false

    // Prevent selling quest/unique items if we ever add them
    if (item.noSell) {
        if (addLogFn) addLogFn('This item cannot be sold.', 'system')
        return false
    }

    const sellValue = getSellValueFn ? getSellValueFn(item, context) : 0
    if (!sellValue || sellValue <= 0) {
        if (addLogFn) addLogFn('No merchant will buy this.', 'system')
        return false
    }

    // If selling equipped gear, unequip first (supports multi-slot gear).
    if (unequipItemFn) {
        unequipItemFn(p, item)
    }

    // Remove from inventory
    if (item.type === 'potion' && (item.quantity || 1) > 1) {
        item.quantity -= 1
    } else {
        p.inventory.splice(index, 1)
    }

    p.gold = (p.gold || 0) + sellValue
    if (addLogFn) addLogFn('Sold ' + item.name + ' for ' + sellValue + ' gold.', 'good')

    if (recalcStatsFn) recalcStatsFn()
    if (updateHUDFn) updateHUDFn()
    
    return true
}
