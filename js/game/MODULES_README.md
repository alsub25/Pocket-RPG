# Modular Code Structure

This directory contains modularized code extracted from `gameOrchestrator.js` to improve maintainability, testability, and reusability.

## Directory Structure

```
js/game/
├── character/          # Character management modules
│   ├── elementalBreakdown.js  # Elemental stat calculations (184 lines)
│   ├── statsManager.js        # Player stats utilities (178 lines)
│   └── talentManager.js       # Talent tree operations (123 lines)
│
├── inventory/          # Inventory and equipment modules
│   ├── equipmentManager.js    # Equipment operations (172 lines)
│   └── inventoryManager.js    # Inventory operations (163 lines)
│
├── helpers/            # Utility modules
│   └── numberHelpers.js       # Number utilities (79 lines)
│
└── examples/           # Integration examples
    └── moduleIntegrationExample.js  # Integration guide (266 lines)
```

**Total:** 1,165 lines of modular, reusable code

## Quick Reference

### Character Management

```javascript
import { playerHasTalent, unlockTalent } from './character/talentManager.js'
import { ensurePlayerStatsDefaults } from './character/statsManager.js'
import { computeElementSummariesForPlayer } from './character/elementalBreakdown.js'
```

### Inventory Management

```javascript
import { addItemToInventory, sellItemFromInventory } from './inventory/inventoryManager.js'
import { equipItem, unequipSlot, EQUIPMENT_SLOTS } from './inventory/equipmentManager.js'
```

### Helper Utilities

```javascript
import { clampNumber, formatPercentage, safe } from './helpers/numberHelpers.js'
```

## Key Principles

### 1. Dependency Injection
Modules accept dependencies as parameters rather than importing globals:
```javascript
// ✅ Good - explicit dependencies
export function unlockTalent(player, talentId, TALENT_DEFS, addLogFn, onUnlockedFn)

// ❌ Bad - hidden global dependencies
export function unlockTalent(player, talentId) {
    // Uses global TALENT_DEFS, addLog, etc.
}
```

### 2. Pure Functions
Most functions are pure - same inputs always produce same outputs:
```javascript
// Pure function - testable, predictable
export function canUnlockTalent(player, talentDef) {
    return player.level >= talentDef.levelReq && player.talentPoints > 0
}
```

### 3. Single Responsibility
Each module has one clear purpose:
- `talentManager.js` - Only talent operations
- `inventoryManager.js` - Only inventory operations
- `numberHelpers.js` - Only number utilities

### 4. Exported Constants
Shared constants are exported for reuse:
```javascript
export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'head', ...]
export const ELEMENT_ORDER = ['fire', 'frost', 'lightning', ...]
```

## Benefits

### For Developers
- 🔍 **Easy to Find**: Small focused files
- 🧪 **Easy to Test**: Functions accept mock dependencies
- 📝 **Easy to Understand**: Clear, documented exports
- 🤝 **Easy to Collaborate**: Less merge conflicts

### For the Codebase
- 🔄 **Reusable**: Import anywhere
- 🛡️ **Safer**: Explicit dependencies
- 📦 **Organized**: Logical structure
- 🚀 **Future-proof**: Easy to extend

## Integration Status

### ✅ Completed
- Module creation
- Code review
- Documentation
- Integration examples

### 🔄 Next Steps
To actually use these modules in `gameOrchestrator.js`:
1. Read `examples/moduleIntegrationExample.js`
2. Import modules at top of gameOrchestrator.js
3. Create wrapper functions with context
4. Replace inline implementations
5. Test thoroughly

See `MODULARIZATION.md` in project root for detailed guide.

## Examples

### Example 1: Using Talent Manager
```javascript
import { playerHasTalent, unlockTalent } from './character/talentManager.js'

// Check talent
if (playerHasTalent(player, 'warrior_rage')) {
    // Apply rage mechanics
}

// Unlock talent
const success = unlockTalent(
    player,
    'mage_fireball',
    TALENT_DEFS,
    addLog,
    (p) => {
        recalcPlayerStats()
        updateHUD()
    }
)
```

### Example 2: Using Inventory Manager
```javascript
import { addGeneratedItemToInventory } from './inventory/inventoryManager.js'

// Add loot drop
addGeneratedItemToInventory(
    state,
    lootItem,
    1,
    engine.emit,
    questSystem,
    () => questEventsEnabled,
    (state, item) => tryAutoEquip(state, item)
)
```

### Example 3: Using Equipment Manager
```javascript
import { equipItem, unequipSlot, EQUIPMENT_SLOTS } from './inventory/equipmentManager.js'

// Equip item
equipItem(player, newSword, addLog, recalcStats)

// Unequip slot
unequipSlot(player, 'weapon', addLog, recalcStats)

// Iterate all slots
EQUIPMENT_SLOTS.forEach(slot => {
    const item = player.equipment[slot]
    // Process item...
})
```

## Testing

All modules are designed for easy testing:

```javascript
// Example: Testing talent unlock
import { canUnlockTalent } from './character/talentManager.js'

const mockPlayer = {
    level: 5,
    talentPoints: 1,
    talents: {}
}

const mockTalent = {
    id: 'test_talent',
    levelReq: 3
}

const canUnlock = canUnlockTalent(mockPlayer, mockTalent)
// Result: true (level 5 >= 3, has talent points)
```

## Contributing

When adding new features:

1. **Choose the right module**: Place code in appropriate module
2. **Keep modules focused**: Create new module if needed
3. **Use dependency injection**: Pass dependencies as parameters
4. **Export what's needed**: Only export public API
5. **Document exports**: Add JSDoc comments
6. **Update examples**: Show usage in examples/

## Questions?

- See `MODULARIZATION.md` for architecture overview
- See `examples/moduleIntegrationExample.js` for integration patterns
- See individual module files for API documentation
- Refer to existing code for style conventions
