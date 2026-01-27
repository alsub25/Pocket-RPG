// js/game/services/craftingService.js
// Engine-integrated crafting service

import {
  initCrafting,
  craftItem,
  enchantItem,
  addMaterial,
  removeMaterial,
  getMaterialQuantity,
  unlockRecipe,
  isRecipeUnlocked,
  getUnlockedRecipes,
  getAvailableRecipes,
  dismantleItem
} from '../systems/craftingSystem.js';

/**
 * Creates an engine-integrated crafting service
 */
export function createCraftingService(engine) {
  if (!engine) throw new Error('CraftingService requires engine instance');

  /**
   * Initialize crafting structures in state if missing
   */
  function initService(state) {
    const tempState = JSON.parse(JSON.stringify(state));
    initCrafting(tempState);
    return tempState;
  }

  /**
   * Craft an item from a recipe
   */
  function craft(recipeId) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const result = craftItem(tempState, recipeId);
    
    if (result.success) {
      engine.setState(tempState);
      engine.emit('item:crafted', { item: result.item, recipeId });
      engine.log?.info?.('crafting', `Crafted: ${result.item.name || recipeId}`);
    }
    
    return result;
  }

  /**
   * Enchant an equipped item
   */
  function enchant(enchantmentId, itemSlot) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const result = enchantItem(tempState, enchantmentId, itemSlot);
    
    if (result.success) {
      engine.setState(tempState);
      engine.emit('item:enchanted', { item: result.item, enchantmentId, slot: itemSlot });
      engine.log?.info?.('crafting', `Enchanted ${itemSlot}`);
    }
    
    return result;
  }

  /**
   * Add crafting material
   */
  function addMaterial(materialId, quantity = 1) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    addMaterial(tempState, materialId, quantity);
    engine.setState(tempState);
    engine.emit('material:gained', { materialId, quantity });
  }

  /**
   * Get material quantity
   */
  function getMaterial(materialId) {
    const state = engine.getState();
    return getMaterialQuantity(state, materialId);
  }

  /**
   * Unlock a recipe
   */
  function unlock(recipeId) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const wasUnlocked = unlockRecipe(tempState, recipeId);
    
    if (wasUnlocked) {
      engine.setState(tempState);
      engine.emit('recipe:unlocked', { recipeId });
      engine.log?.info?.('crafting', `Recipe unlocked: ${recipeId}`);
    }
    
    return wasUnlocked;
  }

  /**
   * Check if a recipe is unlocked
   */
  function isUnlocked(recipeId) {
    const state = engine.getState();
    return isRecipeUnlocked(state, recipeId);
  }

  /**
   * Get unlocked recipes
   */
  function getUnlocked() {
    const state = engine.getState();
    return getUnlockedRecipes(state);
  }

  /**
   * Get available recipes
   */
  function getAvailable() {
    const state = engine.getState();
    return getAvailableRecipes(state);
  }

  /**
   * Dismantle an item
   */
  function dismantle(item) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const result = dismantleItem(tempState, item);
    
    if (result.success) {
      engine.setState(tempState);
      engine.emit('item:dismantled', { item, materials: result.materials });
      engine.log?.info?.('crafting', `Dismantled item for materials`);
    }
    
    return result;
  }

  // Public API
  return {
    init: initService,
    craft,
    enchant,
    addMaterial,
    getMaterial,
    unlock,
    isUnlocked,
    getUnlocked,
    getAvailable,
    dismantle
  };
}
