/**
 * Crafting System
 * Handles crafting items, enchanting equipment, and managing crafting materials
 */

import { craftingRecipes, craftingMaterials, enchantmentRecipes, canCraft } from '../data/crafting.js';

/**
 * Configuration constants
 */
const DISMANTLE_RETURN_RATE = 0.5; // 50% material return rate

/**
 * Initialize crafting state
 */
export function initCrafting(state) {
  if (!state.crafting) {
    state.crafting = {
      materials: {}, // Material ID -> quantity
      unlockedRecipes: ['ironSword', 'leatherArmor', 'healingPotion'], // Start with basic recipes
      craftedItemsCount: 0,
      enchantedItemsCount: 0
    };
  }
  
  // Initialize player crafting stats
  if (!state.player.craftingStats) {
    state.player.craftingStats = {
      itemsCrafted: 0,
      itemsEnchanted: 0,
      materialsGathered: 0
    };
  }
  
  return state;
}

/**
 * Add crafting material to player's inventory
 */
export function addMaterial(state, materialId, quantity = 1) {
  if (!state.crafting) {
    initCrafting(state);
  }
  
  const current = state.crafting.materials[materialId] || 0;
  state.crafting.materials[materialId] = current + quantity;
  state.player.craftingStats.materialsGathered += quantity;
  
  return state;
}

/**
 * Remove crafting material from player's inventory
 */
export function removeMaterial(state, materialId, quantity = 1) {
  if (!state.crafting) {
    initCrafting(state);
  }
  
  const current = state.crafting.materials[materialId] || 0;
  const newAmount = Math.max(0, current - quantity);
  state.crafting.materials[materialId] = newAmount;
  
  return state;
}

/**
 * Get material quantity
 */
export function getMaterialQuantity(state, materialId) {
  return state.crafting?.materials?.[materialId] || 0;
}

/**
 * Craft an item from a recipe
 */
export function craftItem(state, recipeId) {
  const recipe = craftingRecipes[recipeId];
  
  if (!recipe) {
    return { success: false, error: 'Recipe not found' };
  }
  
  // Check if recipe is unlocked
  if (!state.crafting.unlockedRecipes.includes(recipeId)) {
    return { success: false, error: 'Recipe not unlocked' };
  }
  
  // Check if player can craft
  const craftCheck = canCraft(recipe, state.player.level, state.crafting.materials);
  if (!craftCheck.canCraft) {
    return { success: false, error: craftCheck.reason };
  }
  
  // Consume materials
  for (const [materialId, required] of Object.entries(recipe.materials)) {
    removeMaterial(state, materialId, required);
  }
  
  // Add crafted item to inventory
  let result;
  if (recipe.type === 'material') {
    // Crafting a material
    addMaterial(state, recipe.result.id, 1);
    result = recipe.result;
  } else {
    // Crafting an item (weapon, armor, consumable)
    const craftedItem = { ...recipe.result };
    
    // Add to inventory
    if (!state.player.inventory) {
      state.player.inventory = [];
    }
    state.player.inventory.push(craftedItem);
    result = craftedItem;
  }
  
  // Update stats
  state.crafting.craftedItemsCount++;
  state.player.craftingStats.itemsCrafted++;
  
  return { success: true, item: result };
}

/**
 * Unlock a crafting recipe
 */
export function unlockRecipe(state, recipeId) {
  if (!state.crafting) {
    initCrafting(state);
  }
  
  if (!state.crafting.unlockedRecipes.includes(recipeId)) {
    state.crafting.unlockedRecipes.push(recipeId);
    return true;
  }
  
  return false;
}

/**
 * Check if a recipe is unlocked
 */
export function isRecipeUnlocked(state, recipeId) {
  return state.crafting?.unlockedRecipes?.includes(recipeId) || false;
}

/**
 * Get all unlocked recipes
 */
export function getUnlockedRecipes(state) {
  const unlockedIds = state.crafting?.unlockedRecipes || [];
  return unlockedIds.map(id => craftingRecipes[id]).filter(r => r);
}

/**
 * Enchant an equipped item
 */
export function enchantItem(state, enchantmentId, itemSlot) {
  const enchantment = enchantmentRecipes[enchantmentId];
  
  if (!enchantment) {
    return { success: false, error: 'Enchantment not found' };
  }
  
  // Check level requirement
  if (state.player.level < enchantment.requiredLevel) {
    return { success: false, error: 'Level too low' };
  }
  
  // Check materials
  for (const [materialId, required] of Object.entries(enchantment.materials)) {
    const available = getMaterialQuantity(state, materialId);
    if (available < required) {
      const material = craftingMaterials[materialId];
      return { 
        success: false, 
        error: `Not enough ${material?.name || materialId}` 
      };
    }
  }
  
  // Get the item to enchant
  const item = state.player.equipment?.[itemSlot];
  if (!item) {
    return { success: false, error: 'No item equipped in that slot' };
  }
  
  // Consume materials
  for (const [materialId, required] of Object.entries(enchantment.materials)) {
    removeMaterial(state, materialId, required);
  }
  
  // Apply enchantment bonus to item
  if (!item.stats) {
    item.stats = {};
  }
  
  for (const [stat, bonus] of Object.entries(enchantment.bonus)) {
    const current = item.stats[stat] || 0;
    item.stats[stat] = current + bonus;
  }
  
  // Mark item as enchanted
  if (!item.enchantments) {
    item.enchantments = [];
  }
  item.enchantments.push(enchantmentId);
  
  // Update stats
  state.crafting.enchantedItemsCount++;
  state.player.craftingStats.itemsEnchanted++;
  
  return { success: true, item };
}

/**
 * Get available recipes based on player level and unlocked recipes
 */
export function getAvailableRecipes(state) {
  const unlocked = state.crafting?.unlockedRecipes || [];
  const playerLevel = state.player?.level || 1;
  
  return unlocked
    .map(id => craftingRecipes[id])
    .filter(recipe => recipe && recipe.requiredLevel <= playerLevel);
}

/**
 * Dismantle an item into materials (50% material return)
 */
export function dismantleItem(state, item) {
  // Find a matching recipe for this item
  const matchingRecipe = Object.values(craftingRecipes).find(
    recipe => recipe.result.id === item.id || recipe.result.name === item.name
  );
  
  if (!matchingRecipe) {
    return { success: false, error: 'Cannot dismantle this item' };
  }
  
  // Return materials based on dismantle return rate
  const materials = {};
  for (const [materialId, quantity] of Object.entries(matchingRecipe.materials)) {
    const returned = Math.floor(quantity * DISMANTLE_RETURN_RATE);
    if (returned > 0) {
      addMaterial(state, materialId, returned);
      materials[materialId] = returned;
    }
  }
  
  return { success: true, materials };
}
