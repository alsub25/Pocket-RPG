# gameOrchestrator.js Modularization Progress

## Objective
Reduce `gameOrchestrator.js` from 14,972 lines to ~10,000 lines by extracting self-contained modules.

## Current Status

### Progress Summary
- **Initial Size**: 14,972 lines
- **Current Size**: 14,021 lines
- **Lines Extracted**: 951 lines (6.4% reduction)
- **Target Size**: ~10,000 lines
- **Remaining to Extract**: ~4,021 lines (28.7% more reduction needed)

### Completed Extractions ✅

#### 1. Character Sheet Modal (672 lines)
- **File**: `js/game/ui/modals/characterSheetModal.js`
- **Exports**: `createCharacterSheetModal(deps)`
- **Description**: Full player character sheet UI with tabs for Overview, Stats, Skills, Talents, Equipment, and Companions
- **Dependencies**: Uses dependency injection for all required functions
- **Status**: ✅ Extracted, tested, compiling successfully

#### 2. Enemy Sheet Modal (340 lines)
- **File**: `js/game/ui/modals/enemySheetModal.js`
- **Exports**: `createEnemySheetModal(deps)`
- **Description**: Enemy inspection sheet with tabs for Overview, Stats, Abilities, Affixes & Effects, and Rewards
- **Dependencies**: Uses dependency injection pattern
- **Status**: ✅ Extracted, tested, compiling successfully

### Files Created
```
js/game/ui/modals/
├── characterSheetModal.js  (697 lines)
├── enemySheetModal.js      (372 lines)
└── ... (existing modals)
```

## Recommended Next Extractions

To reach the ~10,000 line target, extract approximately 4,021 more lines. Here are the highest-priority, lowest-risk extractions:

### Priority 1: Combat Turn Management Module (~1,500 lines)
**Target**: Lines 5361-7500 approximately

**Functions to Extract:**
- `ensureCombatTurnState()`
- `combatIsPlayerTurn()`
- `combatIsBusy()`
- `combatPause()`
- `getAllEnemies()`, `getAliveEnemies()`, `anyEnemiesAlive()`
- `syncCurrentEnemyToTarget()`
- `ensureCombatPointers()`
- `setTargetEnemyIndex()`, `cycleTargetEnemy()`
- `canPlayerActNow()`, `guardPlayerTurn()`
- `endPlayerTurn()`
- `playerBasicAttack()`, `playerInterrupt()`
- `ensureEnemyRuntime()`, `ensureEnemyAbilityStat()`
- `tickEnemyStartOfTurn()`, `tickEnemyCooldowns()`
- `canUseEnemyAbility()`, `scoreEnemyAbility()`, `chooseEnemyAbility()`
- `applyEnemyAbilityToPlayer()`
- `updateEnemyLearning()`
- `enemyAct()`, `_enemyActImpl()`
- `enemyTurn()`, `_enemyTurnImpl()`
- `applyEndOfTurnEffectsEnemy()`, `applyEndOfTurnEffectsPlayer()`
- `beginPlayerTurn()`, `postEnemyTurn()`

**Suggested File**: `js/game/combat/turnManagement.js`

**Benefits:**
- Large, cohesive block of related functions
- Clear module boundary (combat turn sequencing)
- Would reduce file by ~1,500 lines

**Complexity**: Medium (many interdependencies within the module, but well-isolated from rest of codebase)

### Priority 2: Player Equipment & Stats Helpers (~800 lines)
**Target**: Lines 5800-6200 approximately

**Functions to Extract:**
- `normalizeElementType()`
- `_normalizePctMaybeFraction()`, `_normalizeAffinityMult()`
- `getPlayerElementalBonusPct()`
- `getPlayerElementalResistPct()`
- `applyPlayerRegenTick()`
- `applyPlayerOnHitEffects()`
- `applyStatusSynergyOnPlayerHit()`
- `getEquippedItems()`
- `applyEquipmentOnPlayerHit()`
- `applyEquipmentOnShieldCast()`
- `applyEquipmentOnKill()`

**Suggested File**: `js/game/systems/playerHelpers.js`

**Benefits:**
- Self-contained helper functions
- Clear single responsibility (player stats/equipment calculations)
- Would reduce file by ~800 lines

**Complexity**: Low-Medium (mostly pure functions with minimal side effects)

### Priority 3: Ability Cost & Management (~1,000 lines)
**Target**: Lines 4427-4580 and scattered functions

**Functions to Extract:**
- `canPayCost()`
- `payCost()`
- `useAbilityInCombat()`
- Related ability validation and cost checking functions

**Suggested File**: `js/game/systems/abilityManagement.js`

**Benefits:**
- Clear module boundary (ability usage and costs)
- Would reduce file by ~1,000 lines

**Complexity**: Medium (integrated with combat system but well-defined interface)

### Priority 4: Modal Factory Consolidation (~600 lines)
**Target**: Lines 3883-4420 approximately

**Functions to Extract/Refactor:**
- `_getOpenInventoryModal()`, `openInventoryModal()`
- `openMerchantModal()`
- `openTavernModal()`, `openGambleModal()`
- `openTownHallModal()`, `openBankModal()`
- `_getOpenCheatMenu()`, `openCheatMenu()`
- `_getSpellsModalWrapper()`, `openSpellsModal()`
- `_getSpellbookModal()`, `_getSkillLevelUpModal()`
- `_getExploreModal()`, `_getGovernmentModal()`
- `_getGameSettingsModal()`, `_getChangelogModal()`, `_getFeedbackModal()`

**Suggested Approach**: Create a modal registry system

**Suggested File**: `js/game/ui/modalRegistry.js`

**Benefits:**
- Reduces boilerplate
- Centralizes modal initialization
- Would reduce file by ~600 lines

**Complexity**: Low (mostly factory boilerplate, easy to extract)

### Priority 5: Inventory Management (~400 lines)
**Target**: Lines 3681-3900 approximately

**Functions to Extract:**
- `addItemToInventory()`
- `addGeneratedItemToInventory()`
- `unequipItemIfEquipped()`
- `sellItemFromInventory()`
- `usePotionFromInventory()`
- `equipItemFromInventory()`

**Suggested File**: `js/game/systems/inventoryManager.js`

**Benefits:**
- Clear single responsibility
- Would reduce file by ~400 lines

**Complexity**: Low-Medium (some state mutations but well-contained)

## Implementation Strategy

### Phase 1: Extract Combat Turn Management
1. Create `js/game/combat/turnManagement.js`
2. Extract all turn sequencing functions (lines 5361-7500)
3. Use dependency injection pattern
4. Update imports in gameOrchestrator.js
5. Test compilation: `node -c js/game/combat/turnManagement.js`
6. Verify reduced line count

### Phase 2: Extract Player Helpers
1. Create `js/game/systems/playerHelpers.js`
2. Extract player stat/equipment functions (lines 5800-6200)
3. Use dependency injection pattern
4. Update imports
5. Test compilation
6. Verify reduced line count

### Phase 3: Extract Ability Management
1. Create `js/game/systems/abilityManagement.js`
2. Extract ability cost and management functions
3. Update imports
4. Test compilation

### Phase 4: Consolidate Modal Factories
1. Create `js/game/ui/modalRegistry.js`
2. Build modal registry system
3. Refactor existing modal factories to use registry
4. Update all modal calls
5. Test compilation

### Phase 5: Extract Inventory Management
1. Create `js/game/systems/inventoryManager.js`
2. Extract inventory functions
3. Update imports
4. Test compilation

## Testing Checklist

After each extraction:
- [ ] Run `node -c` on the extracted module
- [ ] Run `node -c` on gameOrchestrator.js
- [ ] Verify line count reduction
- [ ] Check for compilation errors
- [ ] Test in browser if possible
- [ ] Commit changes with descriptive message

## Dependency Injection Pattern

All extracted modules should follow this pattern:

```javascript
/**
 * Module Description
 */

export function createModuleName(deps) {
    const {
        // List all required dependencies
        state,
        someFunction,
        anotherFunction,
        // ... etc
    } = deps

    // Define internal helper functions if needed
    function internalHelper() {
        // ...
    }

    // Return the public API
    return {
        publicFunction1() {
            // Use deps here
        },
        publicFunction2() {
            // ...
        }
    }
}
```

## Import Pattern in gameOrchestrator.js

```javascript
import { createModuleName } from '../path/to/module.js'

// ... later in the file ...

let _moduleName = null
function _getModuleName() {
    if (_moduleName) return _moduleName
    _moduleName = createModuleName({
        state,
        someFunction,
        anotherFunction,
        // ... all required deps
    })
    return _moduleName
}

// Wrapper functions to maintain existing API
function publicFunction1(...args) {
    return _getModuleName().publicFunction1(...args)
}
```

## Notes & Caveats

### Interdependencies
- Many functions in gameOrchestrator.js are highly interdependent
- Some functions access shared mutable state
- Extract cohesive groups together to minimize breakage

### Testing Requirements
- Full integration testing recommended after major extractions
- Combat system especially needs thorough testing
- Save/load testing required after state-related extractions

### Performance Considerations
- Module initialization uses lazy loading pattern
- No performance impact expected from modularization
- May slightly improve load times due to better code splitting

## Success Criteria

- [ ] gameOrchestrator.js reduced to ≤10,000 lines
- [ ] All extracted modules compile without errors
- [ ] All tests pass (if test suite exists)
- [ ] Game functions correctly in browser
- [ ] Code maintainability improved
- [ ] Clear module boundaries established

## Resources

- **Existing Patterns**: See `js/game/ui/modals/inventoryModal.js` for good example of dependency injection
- **Combat Modules**: See `js/game/combat/math.js` and `js/game/combat/abilityEffects.js` for combat-related extraction patterns
- **System Modules**: See `js/game/systems/characterSystem.js` for system-level module patterns

## Timeline Estimate

Based on 951 lines extracted so far (~4 hours), estimated time for remaining work:

- Priority 1 (Combat Turn Management): ~6-8 hours
- Priority 2 (Player Helpers): ~3-4 hours  
- Priority 3 (Ability Management): ~4-5 hours
- Priority 4 (Modal Factories): ~2-3 hours
- Priority 5 (Inventory Management): ~2-3 hours

**Total Estimated Time**: 17-23 hours

**Risk Factors**:
- Unexpected interdependencies may require refactoring
- Testing time not included in estimates
- Bug fixes may be needed after extraction

## Conclusion

The modularization effort has successfully begun with two clear, well-defined extractions (character sheet and enemy sheet modals). The remaining work follows clear patterns and should be straightforward, though time-consuming due to the size and complexity of the codebase.

The recommended approach is to tackle the highest-priority extractions first (combat turn management and player helpers) as these provide the most benefit in terms of line count reduction and code organization.
