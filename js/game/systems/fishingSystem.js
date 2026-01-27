/**
 * Fishing System
 * Handles fishing mechanics and mini-game
 */

import { fishSpecies, getAvailableFish, isLocationUnlocked } from '../data/fishing.js';
import { addMaterial } from './craftingSystem.js';

/**
 * Initialize fishing state
 */
export function initFishing(state) {
  if (!state.fishing) {
    state.fishing = {
      unlockedLocations: ['villageRiver'], // Start with village river
      fishCaught: {}, // Fish ID -> count
      totalCaught: 0,
      bestCatch: null
    };
  }
  
  // Initialize player fishing stats
  if (!state.player.fishingStats) {
    state.player.fishingStats = {
      totalCaught: 0,
      rareCaught: 0,
      legendariesCaught: 0,
      totalAttempts: 0,
      successRate: 0
    };
  }
  
  return state;
}

/**
 * Configuration constants
 */
const BASE_SUCCESS_RATE = 0.7; // 70% base success rate
const SKILL_BONUS_PER_LEVEL = 0.02; // +2% per level
const MAX_SUCCESS_RATE = 0.95; // 95% maximum

/**
 * Attempt to catch a fish
 * Returns result with caught fish or failure
 */
export function attemptFishing(state, locationId, rngFunction = Math.random) {
  if (!state.fishing) {
    initFishing(state);
  }
  
  // Check if location is unlocked
  if (!state.fishing.unlockedLocations.includes(locationId)) {
    if (isLocationUnlocked(locationId, state.player.level)) {
      state.fishing.unlockedLocations.push(locationId);
    } else {
      return { success: false, error: 'Location not unlocked' };
    }
  }
  
  // Get available fish at this location and time
  const timeOfDay = state.time?.dayPart || 'morning';
  const availableFish = getAvailableFish(locationId, timeOfDay, state.player.level);
  
  if (availableFish.length === 0) {
    return { success: false, error: 'No fish available at this time' };
  }
  
  // Update attempt counter
  state.player.fishingStats.totalAttempts++;
  
  // Calculate catch chance based on player level and fish difficulty
  const playerSkill = state.player.level; // Could be a dedicated fishing skill
  const roll = rngFunction(); // 0-1
  
  const skillBonus = playerSkill * SKILL_BONUS_PER_LEVEL;
  const successRate = Math.min(MAX_SUCCESS_RATE, BASE_SUCCESS_RATE + skillBonus);
  
  if (roll > successRate) {
    return { success: false, error: 'The fish got away!' };
  }
  
  // Successfully caught something - determine which fish
  const caughtFish = selectRandomFish(availableFish, playerSkill, rngFunction);
  
  if (!caughtFish) {
    return { success: false, error: 'The fish got away!' };
  }
  
  // Add to caught count
  const fishId = caughtFish.id;
  state.fishing.fishCaught[fishId] = (state.fishing.fishCaught[fishId] || 0) + 1;
  state.fishing.totalCaught++;
  state.player.fishingStats.totalCaught++;
  
  // Track rarity stats
  if (caughtFish.rarity === 'rare' || caughtFish.rarity === 'epic') {
    state.player.fishingStats.rareCaught++;
  }
  if (caughtFish.rarity === 'legendary') {
    state.player.fishingStats.legendariesCaught++;
  }
  
  // Update success rate
  state.player.fishingStats.successRate = 
    (state.player.fishingStats.totalCaught / state.player.fishingStats.totalAttempts) * 100;
  
  // Check if best catch
  if (!state.fishing.bestCatch || caughtFish.sellValue > state.fishing.bestCatch.sellValue) {
    state.fishing.bestCatch = { ...caughtFish };
  }
  
  // Add fish to inventory or convert to material
  if (caughtFish.craftingMaterial) {
    addMaterial(state, caughtFish.craftingMaterial, 1);
    return { 
      success: true, 
      fish: caughtFish, 
      convertedToMaterial: caughtFish.craftingMaterial 
    };
  } else {
    // Add as consumable item
    const fishItem = {
      id: `fish_${fishId}`,
      name: caughtFish.name,
      type: 'consumable',
      icon: caughtFish.icon,
      description: caughtFish.description,
      rarity: caughtFish.rarity,
      sellValue: caughtFish.sellValue,
      effect: 'restoreHP',
      value: caughtFish.restoreHP,
      bonus: caughtFish.bonus
    };
    
    if (!state.player.inventory) {
      state.player.inventory = [];
    }
    state.player.inventory.push(fishItem);
    
    return { success: true, fish: caughtFish };
  }
}

/**
 * Select a random fish based on rarity and player skill
 */
function selectRandomFish(availableFish, playerSkill, rngFunction) {
  // Calculate weighted probabilities based on rarity and player skill
  const weights = availableFish.map(fish => {
    let weight = 1.0;
    
    // Base rarity weights (inverted - common is more likely)
    switch (fish.rarity) {
      case 'common': weight = 50; break;
      case 'uncommon': weight = 25; break;
      case 'rare': weight = 10; break;
      case 'epic': weight = 3; break;
      case 'legendary': weight = 1; break;
    }
    
    // Player skill increases chance of rare fish slightly
    const skillBonus = playerSkill * 0.1; // 0.1 weight per level
    weight += (weight * skillBonus * (5 - getRarityValue(fish.rarity)) / 5);
    
    return weight;
  });
  
  // Select weighted random
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = rngFunction() * totalWeight;
  
  for (let i = 0; i < availableFish.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return availableFish[i];
    }
  }
  
  return availableFish[0]; // Fallback
}

/**
 * Helper to get numeric value for rarity
 */
function getRarityValue(rarity) {
  switch (rarity) {
    case 'common': return 1;
    case 'uncommon': return 2;
    case 'rare': return 3;
    case 'epic': return 4;
    case 'legendary': return 5;
    default: return 1;
  }
}

/**
 * Get fishing statistics for UI
 */
export function getFishingStats(state) {
  return {
    totalCaught: state.fishing?.totalCaught || 0,
    uniqueSpecies: Object.keys(state.fishing?.fishCaught || {}).length,
    bestCatch: state.fishing?.bestCatch,
    successRate: state.player?.fishingStats?.successRate || 0,
    rareCaught: state.player?.fishingStats?.rareCaught || 0
  };
}

/**
 * Unlock a fishing location
 */
export function unlockLocation(state, locationId) {
  if (!state.fishing) {
    initFishing(state);
  }
  
  if (!state.fishing.unlockedLocations.includes(locationId)) {
    state.fishing.unlockedLocations.push(locationId);
    return true;
  }
  
  return false;
}
