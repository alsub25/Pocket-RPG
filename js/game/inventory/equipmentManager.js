// js/game/inventory/equipmentManager.js
// Equipment management and equip/unequip operations
//
// Extracted from gameOrchestrator.js to improve modularity and maintainability.
// This module handles equipping/unequipping items and auto-equip logic.

/**
 * Standard equipment slots
 * @constant
 */
export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'head', 'hands', 'feet', 'belt', 'neck', 'ring']

/**
 * Unequips an item if it's currently equipped
 * Prefers reference equality (prevents unequipping the wrong "copy" of an item),
 * but falls back to id matching for older saves that may have cloned equipment objects.
 * @param {Object} player - Player object
 * @param {Object} item - Item to unequip
 * @returns {boolean} True if item was unequipped
 */
export function unequipItemIfEquipped(player, item) {
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

/**
 * Auto-equips newly acquired gear if the slot is currently empty
 * Kept out of combat to avoid mid-fight equipment changes.
 * @param {Object} state - Game state
 * @param {Object} item - Item to potentially auto-equip
 * @param {Function} addLogFn - Function to add log messages
 * @param {Function} recalcStatsFn - Function to recalculate stats after equipping
 */
export function tryAutoEquipItem(state, item, addLogFn, recalcStatsFn) {
    const p = state && state.player ? state.player : null
    if (
        !p ||
        state.inCombat ||
        !state.settingsAutoEquipLoot ||
        (item.type !== 'weapon' && item.type !== 'armor')
    ) {
        return
    }

    if (!p.equipment) p.equipment = {}
    
    const ensureSlot = (k) => {
        if (p.equipment[k] === undefined) p.equipment[k] = null
    }
    EQUIPMENT_SLOTS.forEach(ensureSlot)

    const slot = item.slot || (item.type === 'weapon' ? 'weapon' : 'armor')
    ensureSlot(slot)

    if (p.equipment[slot] == null) {
        p.equipment[slot] = item
        if (addLogFn) {
            addLogFn('Auto-equipped ' + item.name + ' (' + slot + ').', 'system')
        }
        if (recalcStatsFn) {
            recalcStatsFn()
        }
    }
}

/**
 * Equips an item from inventory
 * @param {Object} player - Player object
 * @param {Object} item - Item to equip
 * @param {Function} addLogFn - Function to add log messages
 * @param {Function} recalcStatsFn - Function to recalculate stats after equipping
 * @returns {boolean} True if item was equipped successfully
 */
export function equipItem(player, item, addLogFn, recalcStatsFn) {
    if (!player || !item) return false
    if (item.type !== 'weapon' && item.type !== 'armor') {
        if (addLogFn) addLogFn('Cannot equip this item type.', 'system')
        return false
    }

    if (!player.equipment) player.equipment = {}
    
    const slot = item.slot || (item.type === 'weapon' ? 'weapon' : 'armor')
    
    // Unequip current item in slot if any
    if (player.equipment[slot]) {
        // Item goes back to inventory, but we're already in inventory so just swap
        player.equipment[slot] = item
    } else {
        player.equipment[slot] = item
    }

    if (addLogFn) {
        addLogFn('Equipped ' + item.name + '.', 'system')
    }
    
    if (recalcStatsFn) {
        recalcStatsFn()
    }
    
    return true
}

/**
 * Unequips an item and returns it to inventory
 * @param {Object} player - Player object
 * @param {string} slot - Equipment slot to unequip from
 * @param {Function} addLogFn - Function to add log messages
 * @param {Function} recalcStatsFn - Function to recalculate stats after unequipping
 * @returns {boolean} True if item was unequipped successfully
 */
export function unequipSlot(player, slot, addLogFn, recalcStatsFn) {
    if (!player || !player.equipment || !slot) return false
    
    const item = player.equipment[slot]
    if (!item) return false

    player.equipment[slot] = null
    
    if (addLogFn) {
        addLogFn('Unequipped ' + item.name + '.', 'system')
    }
    
    if (recalcStatsFn) {
        recalcStatsFn()
    }
    
    return true
}

/**
 * Ensures all equipment slots exist with null defaults
 * @param {Object} player - Player object
 */
export function ensureEquipmentSlots(player) {
    if (!player) return
    if (!player.equipment) player.equipment = {}
    
    EQUIPMENT_SLOTS.forEach(slot => {
        if (player.equipment[slot] === undefined) {
            player.equipment[slot] = null
        }
    })
}
