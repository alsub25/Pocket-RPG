/**
 * World Events System - Data
 * Defines random events that can occur in the game world
 */

/**
 * World Event Definitions
 */
export const worldEvents = {
  // Positive Events
  merchantVisit: {
    id: 'merchantVisit',
    name: 'Traveling Merchant',
    description: 'A traveling merchant has arrived with rare goods!',
    icon: '🎪',
    type: 'positive',
    rarity: 'uncommon',
    duration: 1, // days
    effects: {
      merchantStockBonus: 0.5, // 50% more stock
      rareItemChance: 0.2 // 20% chance for rare items
    },
    message: 'A colorful wagon rolls into the village square. A traveling merchant offers exotic wares!'
  },
  
  festival: {
    id: 'festival',
    name: 'Village Festival',
    description: 'The village is celebrating with a grand festival!',
    icon: '🎉',
    type: 'positive',
    rarity: 'rare',
    duration: 2,
    effects: {
      tavernPriceDiscount: 0.25, // 25% off tavern services
      populationMoodBonus: 10,
      questRewardBonus: 0.1 // 10% bonus quest rewards
    },
    message: 'Colorful banners adorn the streets as the village celebrates! Music and laughter fill the air.'
  },
  
  bountifulHarvest: {
    id: 'bountifulHarvest',
    name: 'Bountiful Harvest',
    description: 'The harvest was exceptional this year!',
    icon: '🌾',
    type: 'positive',
    rarity: 'uncommon',
    duration: 3,
    effects: {
      merchantPriceReduction: 0.15, // 15% cheaper items
      economyBoost: 1,
      materialDropBonus: 0.2 // 20% more materials from enemies
    },
    message: 'The granaries overflow with a record harvest. Prices drop as abundance fills the market.'
  },
  
  wanderingMage: {
    id: 'wanderingMage',
    name: 'Wandering Mage',
    description: 'A mysterious mage offers to teach you secrets',
    icon: '🧙',
    type: 'positive',
    rarity: 'rare',
    duration: 1,
    effects: {
      expBonus: 0.25, // 25% bonus XP
      magicPowerBonus: 5 // Temporary +5 magic
    },
    message: 'A hooded figure approaches, staff glowing with arcane power. "I sense potential in you..."',
    reward: {
      unlockRecipe: 'mysticEssence' // Could unlock special crafting
    }
  },
  
  // Negative Events
  banditRaid: {
    id: 'banditRaid',
    name: 'Bandit Raid',
    description: 'Bandits are terrorizing the area!',
    icon: '💀',
    type: 'negative',
    rarity: 'uncommon',
    duration: 2,
    effects: {
      merchantPriceIncrease: 0.25, // 25% more expensive
      populationMoodPenalty: -10,
      enemySpawnRate: 1.5 // 50% more enemy encounters
    },
    message: 'Warning bells ring out! Bandits have been spotted on the roads. Merchants raise prices as fear spreads.',
    challengeText: 'Defeat 5 bandits to end the raid early'
  },
  
  plague: {
    id: 'plague',
    name: 'Plague',
    description: 'A mysterious illness spreads through the village',
    icon: '🦠',
    type: 'negative',
    rarity: 'rare',
    duration: 3,
    effects: {
      tavernRestCostIncrease: 0.5, // 50% more expensive to rest
      populationMoodPenalty: -15,
      healingReduction: 0.25 // Healing is 25% less effective
    },
    message: 'Coughing echoes through the streets. The village healer works tirelessly but many fall ill.'
  },
  
  drought: {
    id: 'drought',
    name: 'Drought',
    description: 'A severe drought has dried up water sources',
    icon: '☀️',
    type: 'negative',
    rarity: 'uncommon',
    duration: 4,
    effects: {
      fishingDisabled: true, // Cannot fish during drought
      merchantStockReduction: 0.3, // 30% less stock
      economyPenalty: -1
    },
    message: 'The sun beats down mercilessly. Rivers run dry and crops wither in the fields.'
  },
  
  // Neutral/Special Events
  meteorShower: {
    id: 'meteorShower',
    name: 'Meteor Shower',
    description: 'Meteors streak across the night sky',
    icon: '☄️',
    type: 'special',
    rarity: 'rare',
    duration: 1,
    effects: {
      starFragmentDrop: true, // Chance to find star fragments
      magicBonus: 3
    },
    message: 'The night sky lights up with falling stars! Fragments of celestial rock pepper the landscape.',
    reward: {
      material: 'starFragment',
      chance: 0.3 // 30% chance on completing combat
    }
  },
  
  bloodMoon: {
    id: 'bloodMoon',
    name: 'Blood Moon',
    description: 'The moon turns blood red, empowering dark creatures',
    icon: '🌕',
    type: 'challenge',
    rarity: 'rare',
    duration: 1,
    effects: {
      enemyPowerBonus: 0.5, // Enemies 50% stronger
      lootBonus: 0.75, // But 75% more loot!
      shadowDamageBonus: 0.25 // Shadow spells 25% stronger
    },
    message: 'The moon rises crimson over Emberwood. Dark creatures grow bold and powerful under its gaze.',
    challengeText: 'Survive the night for double experience!'
  },
  
  strangeAurora: {
    id: 'strangeAurora',
    name: 'Strange Aurora',
    description: 'Mysterious lights dance in the sky',
    icon: '🌌',
    type: 'special',
    rarity: 'legendary',
    duration: 1,
    effects: {
      allElementsBonus: 0.15, // 15% bonus to all elemental damage
      enchantingBonus: 0.3, // 30% better enchantments
      mysteriousDiscovery: true
    },
    message: 'Ethereal lights weave patterns across the heavens. Reality feels thin, magic pulses in the air.',
    reward: {
      material: 'voidEssence',
      guaranteedDrop: true
    }
  }
};

/**
 * Event Rarity Weights (for random selection)
 */
export const eventRarityWeights = {
  common: 50,
  uncommon: 30,
  rare: 15,
  legendary: 5
};

/**
 * Get all world events
 */
export function getAllEvents() {
  return Object.values(worldEvents);
}

/**
 * Get events by type
 */
export function getEventsByType(type) {
  return Object.values(worldEvents).filter(e => e.type === type);
}

/**
 * Get event by ID
 */
export function getEvent(eventId) {
  return worldEvents[eventId];
}
