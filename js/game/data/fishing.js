/**
 * Fishing System - Data
 * Defines fish species and fishing mechanics
 */

/**
 * Fish species available to catch
 */
export const fishSpecies = {
  // Common Fish
  carp: {
    id: 'carp',
    name: 'Carp',
    description: 'A common freshwater fish',
    rarity: 'common',
    icon: '🐟',
    sellValue: 5,
    restoreHP: 10,
    catchDifficulty: 1, // 1-10 scale
    timeOfDay: ['morning', 'evening', 'night'], // When it can be caught
    minLevel: 1
  },
  
  trout: {
    id: 'trout',
    name: 'Trout',
    description: 'A swift river fish',
    rarity: 'common',
    icon: '🐠',
    sellValue: 8,
    restoreHP: 15,
    catchDifficulty: 2,
    timeOfDay: ['morning', 'evening'],
    minLevel: 1
  },
  
  bass: {
    id: 'bass',
    name: 'Bass',
    description: 'A popular sport fish',
    rarity: 'uncommon',
    icon: '🐟',
    sellValue: 12,
    restoreHP: 20,
    catchDifficulty: 3,
    timeOfDay: ['morning', 'evening', 'night'],
    minLevel: 2
  },
  
  // Uncommon Fish
  salmon: {
    id: 'salmon',
    name: 'Salmon',
    description: 'A prized river fish',
    rarity: 'uncommon',
    icon: '🐟',
    sellValue: 20,
    restoreHP: 30,
    catchDifficulty: 4,
    timeOfDay: ['morning', 'evening'],
    minLevel: 3
  },
  
  pike: {
    id: 'pike',
    name: 'Pike',
    description: 'An aggressive predator fish',
    rarity: 'uncommon',
    icon: '🐠',
    sellValue: 18,
    restoreHP: 25,
    catchDifficulty: 5,
    timeOfDay: ['evening', 'night'],
    minLevel: 3
  },
  
  // Rare Fish
  goldfish: {
    id: 'goldfish',
    name: 'Golden Carp',
    description: 'A rare golden fish, brings luck',
    rarity: 'rare',
    icon: '🐡',
    sellValue: 50,
    restoreHP: 50,
    catchDifficulty: 6,
    timeOfDay: ['morning'],
    minLevel: 5,
    bonus: { luck: 5 } // Temporary bonus when consumed
  },
  
  catfish: {
    id: 'catfish',
    name: 'Giant Catfish',
    description: 'An enormous bottom-feeder',
    rarity: 'rare',
    icon: '🐟',
    sellValue: 45,
    restoreHP: 40,
    catchDifficulty: 7,
    timeOfDay: ['night'],
    minLevel: 5
  },
  
  // Epic Fish
  moonfish: {
    id: 'moonfish',
    name: 'Moonfish',
    description: 'A mystical fish that glows in moonlight',
    rarity: 'epic',
    icon: '🌙',
    sellValue: 100,
    restoreHP: 75,
    catchDifficulty: 8,
    timeOfDay: ['night'],
    minLevel: 8,
    bonus: { magic: 5, mana: 20 }
  },
  
  dragonfish: {
    id: 'dragonfish',
    name: 'Dragonfish',
    description: 'A legendary scaled fish with dragon heritage',
    rarity: 'legendary',
    icon: '🐲',
    sellValue: 200,
    restoreHP: 100,
    catchDifficulty: 10,
    timeOfDay: ['evening', 'night'],
    minLevel: 10,
    bonus: { attack: 5, fireResist: 10 }
  },
  
  // Special Fish (materials)
  crystalfish: {
    id: 'crystalfish',
    name: 'Crystal Fish',
    description: 'A fish with crystalline scales, useful for crafting',
    rarity: 'rare',
    icon: '💎',
    sellValue: 75,
    catchDifficulty: 7,
    timeOfDay: ['morning', 'evening'],
    minLevel: 6,
    craftingMaterial: 'enchantedCrystal' // Converts to crafting material when caught
  }
};

/**
 * Fishing locations
 */
export const fishingLocations = {
  villageRiver: {
    id: 'villageRiver',
    name: 'Village River',
    description: 'A calm river flowing through the village',
    availableFish: ['carp', 'trout', 'bass', 'pike'],
    unlocked: true // Always available
  },
  
  forestStream: {
    id: 'forestStream',
    name: 'Forest Stream',
    description: 'A hidden stream in the deep forest',
    availableFish: ['trout', 'salmon', 'goldfish', 'crystalfish'],
    unlockRequirement: { level: 5 }
  },
  
  moonlitLake: {
    id: 'moonlitLake',
    name: 'Moonlit Lake',
    description: 'A mysterious lake that glows at night',
    availableFish: ['salmon', 'pike', 'catfish', 'moonfish', 'dragonfish'],
    unlockRequirement: { level: 8 }
  }
};

/**
 * Get fish species available at a location and time
 */
export function getAvailableFish(locationId, timeOfDay, playerLevel) {
  const location = fishingLocations[locationId];
  if (!location) return [];
  
  return location.availableFish
    .map(id => fishSpecies[id])
    .filter(fish => {
      // Check time of day
      if (!fish.timeOfDay.includes(timeOfDay)) return false;
      
      // Check player level
      if (fish.minLevel > playerLevel) return false;
      
      return true;
    });
}

/**
 * Get all fish species
 */
export function getAllFish() {
  return Object.values(fishSpecies);
}

/**
 * Get all fishing locations
 */
export function getAllLocations() {
  return Object.values(fishingLocations);
}

/**
 * Check if location is unlocked
 */
export function isLocationUnlocked(locationId, playerLevel) {
  const location = fishingLocations[locationId];
  if (!location) return false;
  
  if (location.unlocked) return true;
  
  if (location.unlockRequirement?.level) {
    return playerLevel >= location.unlockRequirement.level;
  }
  
  return false;
}
