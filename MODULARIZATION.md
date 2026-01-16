# Modularization Guide

## Overview

This document describes the modularization effort to break down the large `gameOrchestrator.js` file (20,789 lines) into smaller, focused, and maintainable modules.

## Goals

- **Maintainability**: Smaller files are easier to understand and modify
- **Testability**: Individual modules can be tested in isolation
- **Reusability**: Extracted modules can be used by multiple systems
- **Collaboration**: Multiple developers can work on different modules without conflicts
- **No Breaking Changes**: All existing functionality preserved

## New Module Structure

### Character Management (`js/game/character/`)

Handles all player character-related operations including stats, talents, and elemental calculations.

#### `talentManager.js`
- **Purpose**: Talent tree management and operations
- **Exports**:
  - `ensurePlayerTalents(p)` - Initialize talent fields
  - `playerHasTalent(p, talentId)` - Check if player has talent
  - `grantTalentPointIfNeeded(p, newLevel)` - Award talent points at level milestones
  - `getTalentsForClass(classId, TALENT_DEFS)` - Get available talents for class
  - `canUnlockTalent(p, tdef)` - Check if talent can be unlocked
  - `unlockTalent(p, talentId, ...)` - Unlock a talent
  - `getTalentSpellElementBonusMap(p)` - Calculate talent-based element bonuses

#### `statsManager.js`
- **Purpose**: Player stats management and utility functions
- **Exports**:
  - `ensurePlayerStatsDefaults(p)` - Initialize all stat fields with defaults
  - `capWord(s)` - Capitalize first letter
  - `round1(x)` - Round to 1 decimal place
  - `roundIntStable(x)` - Stable integer rounding for combat
  - `numPct(x)` - Convert to numeric percentage
  - `elementIcon(k)` - Get emoji icon for element type
  - `orderedElementKeys(keys)` - Sort element keys in standard order
  - `normalizeElemMap(obj)` - Normalize element map values

#### `elementalBreakdown.js`
- **Purpose**: Elemental stat calculations and character sheet breakdowns
- **Exports**:
  - `getElementalBreakdownsForPlayer(p)` - Get elemental bonuses/resists by source
  - `computeElementSummariesForPlayer(p, ...)` - Compute element summaries
  - `renderElementalBreakdownHtml(p, ...)` - Render elemental breakdown HTML

### Inventory Management (`js/game/inventory/`)

Handles inventory operations, item management, and equipment.

#### `inventoryManager.js`
- **Purpose**: Core inventory management operations
- **Exports**:
  - `addItemToInventory(state, itemId, ...)` - Add item by definition ID
  - `addGeneratedItemToInventory(state, item, ...)` - Add dynamically generated item
  - `sellItemFromInventory(state, index, ...)` - Sell item from inventory

#### `equipmentManager.js`
- **Purpose**: Equipment management and equip/unequip operations
- **Exports**:
  - `unequipItemIfEquipped(player, item)` - Unequip item if equipped
  - `tryAutoEquipItem(state, item, ...)` - Auto-equip gear if slot empty
  - `equipItem(player, item, ...)` - Equip an item
  - `unequipSlot(player, slot, ...)` - Unequip from a specific slot
  - `ensureEquipmentSlots(player)` - Initialize all equipment slots

### UI Modals (`js/game/ui/modals/`)

Modularized modal UI components with dependency injection.

#### `inventoryModal.js` ✨ NEW
- **Purpose**: Inventory modal UI with filtering, sorting, and item actions
- **Exports**:
  - `createInventoryModal(deps)` - Factory function that creates inventory modal instance
- **Features**:
  - Search and filter items by name, type, description
  - Sort by power, type, rarity, level, or name
  - Tab-based filtering (All, Potions, Weapons, Armor)
  - Equip/unequip gear with power comparison
  - Use potions with restoration effects
  - Sell items in village
  - Drop items with confirmation
  - Quest item protection
- **Dependencies**: Uses dependency injection for all game state access and operations
- **Pattern**: Follows same architecture as `cheatMenuModal.js`

#### `cheatMenuModal.js`
- **Purpose**: Cheat menu for testing and debugging
- **Exports**:
  - `createCheatMenuModal(deps)` - Factory function for cheat menu
- **Features**: Debug tools, item spawning, teleportation, etc.

### Helper Utilities (`js/game/helpers/`)

Common utility functions used across the codebase.

#### `numberHelpers.js`
- **Purpose**: Number utility functions for safe math operations
- **Exports**:
  - `finiteNumber(n, fallback)` - Ensure number is finite
  - `clampNumber(value, min, max)` - Clamp to range
  - `clampFinite(x, min, max)` - Clamp finite number
  - `safe(fn, fallback)` - Safe function execution
  - `formatPercentage(value, decimals)` - Format as percentage
  - `formatLargeNumber(num)` - Format with k/M/B suffixes

## Usage Examples

### Using Talent Manager

```javascript
import { 
    playerHasTalent, 
    unlockTalent, 
    getTalentsForClass 
} from '../character/talentManager.js'

// Check if player has a talent
if (playerHasTalent(player, 'mage_ember_focus')) {
    // Apply bonus
}

// Unlock a talent
const success = unlockTalent(
    player, 
    'warrior_strength', 
    TALENT_DEFS,
    addLog,
    (p) => {
        recalcPlayerStats()
        updateHUD()
    }
)
```

### Using Inventory Manager

```javascript
import { addItemToInventory, sellItemFromInventory } from '../inventory/inventoryManager.js'

// Add item to inventory
addItemToInventory(
    state,
    'health_potion',
    5, // quantity
    cloneItemDef,
    engine.emit,
    quests,
    questEventsEnabled
)

// Sell item
const sold = sellItemFromInventory(
    state,
    itemIndex,
    'village',
    getSellValue,
    unequipItemIfEquipped,
    addLog,
    recalcPlayerStats,
    updateHUD
)
```

### Using Equipment Manager

```javascript
import { equipItem, unequipSlot, tryAutoEquipItem } from '../inventory/equipmentManager.js'

// Equip an item
equipItem(player, sword, addLog, recalcPlayerStats)

// Unequip a slot
unequipSlot(player, 'weapon', addLog, recalcPlayerStats)

// Auto-equip if slot is empty
tryAutoEquipItem(state, newHelmet, addLog, recalcPlayerStats)
```

### Using Inventory Modal

```javascript
import { createInventoryModal } from '../ui/modals/inventoryModal.js'

// Initialize the modal factory with dependencies
let _inventoryModal = null
function getInventoryModal() {
    if (_inventoryModal) return _inventoryModal
    _inventoryModal = createInventoryModal({
        getState: () => state,
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
    })
    return _inventoryModal
}

// Open inventory modal (in combat or outside)
function openInventoryModal(inCombat) {
    return getInventoryModal().openInventoryModal(inCombat)
}

// Use a potion from inventory
function usePotionFromInventory(index, inCombat, opts = {}) {
    return getInventoryModal().usePotionFromInventory(index, inCombat, opts)
}

// Equip an item from inventory
function equipItemFromInventory(index, opts = {}) {
    return getInventoryModal().equipItemFromInventory(index, opts)
}
```

## Integration with gameOrchestrator.js

The `gameOrchestrator.js` file will be updated to import and use these modules instead of containing all the logic inline. This maintains the same functionality while improving code organization.

### Before (Inline)
```javascript
// In gameOrchestrator.js (20,789 lines)
function unlockTalent(p, talentId) {
    // 50+ lines of talent logic
}
```

### After (Modular)
```javascript
// In gameOrchestrator.js
import { unlockTalent } from '../character/talentManager.js'

// Use the imported function with proper context
const success = unlockTalent(p, talentId, TALENT_DEFS, addLog, onTalentUnlocked)
```

## Benefits

### For Developers
- **Easier Navigation**: Find specific functionality faster
- **Clear Responsibilities**: Each module has a focused purpose
- **Reduced Conflicts**: Less likely to have merge conflicts
- **Better Testing**: Test individual modules in isolation

### For the Codebase
- **Improved Maintainability**: Changes are localized to specific modules
- **Better Reusability**: Modules can be used in multiple places
- **Enhanced Readability**: Smaller files are easier to understand
- **Future-Proof**: Easier to add new features

## Migration Status

### Completed
- ✅ Character management modules (talents, stats, elemental)
- ✅ Inventory management modules (inventory, equipment)
- ✅ Helper utilities (number helpers)
- ✅ **UI modal factories** (inventory modal - **581 lines extracted**)

### In Progress
- 🔄 Combat orchestration modules

### Planned
- ⏳ Combat ability execution
- ⏳ Damage calculation
- ⏳ Character creation workflow
- ⏳ Save/load operations

### Already Modularized (Village Modals)
These modals were already extracted in previous work:
- ✅ `merchant.js` - Merchant modal for buying/selling
- ✅ `tavern.js` - Tavern modal with rest and gambling
- ✅ `bank.js` - Bank modal for deposits and investments
- ✅ `townHall.js` - Town hall modal for governance

## Testing

All modularized code maintains 100% backward compatibility. The existing smoke tests and QA tools continue to work without modification.

To verify modularization:
1. Enable dev cheats in character creation
2. Run full smoke test suite
3. Test all affected features manually
4. Verify no console errors

## Future Improvements

- Add unit tests for each module
- Create integration tests for module interactions
- Add JSDoc comments for better IDE support
- Consider TypeScript type definitions
- Create visual dependency diagrams

## Contributing

When adding new features:
1. Determine which module the feature belongs in
2. If no suitable module exists, create a new focused module
3. Keep modules under 500 lines when possible
4. Export only necessary functions
5. Document exports with JSDoc comments

## Questions?

For questions about the modularization effort, refer to:
- Main README.md for architecture overview
- Individual module files for specific functionality
- gameOrchestrator.js for integration examples
