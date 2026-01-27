/**
 * Achievement Definitions
 * Each achievement has an id, name, description, category, and unlock criteria
 */

export const achievements = {
  // Combat Achievements
  firstBlood: {
    id: 'firstBlood',
    name: 'First Blood',
    description: 'Win your first combat encounter',
    category: 'combat',
    icon: '⚔️',
    checkUnlock: (state) => state.player?.combatStats?.victories >= 1
  },
  
  combatVeteran: {
    id: 'combatVeteran',
    name: 'Combat Veteran',
    description: 'Win 50 combat encounters',
    category: 'combat',
    icon: '🛡️',
    checkUnlock: (state) => state.player?.combatStats?.victories >= 50
  },
  
  bossSlayer: {
    id: 'bossSlayer',
    name: 'Boss Slayer',
    description: 'Defeat your first boss enemy',
    category: 'combat',
    icon: '👹',
    checkUnlock: (state) => state.player?.combatStats?.bossesDefeated >= 1
  },
  
  unstoppable: {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Win 10 consecutive combats without resting',
    category: 'combat',
    icon: '💪',
    checkUnlock: (state) => state.player?.combatStats?.winStreak >= 10
  },
  
  perfectVictory: {
    id: 'perfectVictory',
    name: 'Perfect Victory',
    description: 'Win a combat without taking damage',
    category: 'combat',
    icon: '✨',
    checkUnlock: (state) => state.player?.combatStats?.perfectVictories >= 1
  },
  
  // Progression Achievements
  levelUp: {
    id: 'levelUp',
    name: 'Getting Started',
    description: 'Reach level 5',
    category: 'progression',
    icon: '📈',
    checkUnlock: (state) => state.player?.level >= 5
  },
  
  veteran: {
    id: 'veteran',
    name: 'Veteran Adventurer',
    description: 'Reach level 10',
    category: 'progression',
    icon: '🌟',
    checkUnlock: (state) => state.player?.level >= 10
  },
  
  legendary: {
    id: 'legendary',
    name: 'Legendary Hero',
    description: 'Reach level 20',
    category: 'progression',
    icon: '👑',
    checkUnlock: (state) => state.player?.level >= 20
  },
  
  talentMaster: {
    id: 'talentMaster',
    name: 'Talent Master',
    description: 'Unlock all talent tiers for your class',
    category: 'progression',
    icon: '🎯',
    checkUnlock: (state) => {
      const talents = state.player?.talents || {};
      return Object.keys(talents).filter(t => talents[t]).length >= 8;
    }
  },
  
  // Wealth Achievements
  firstGold: {
    id: 'firstGold',
    name: 'Penny Pincher',
    description: 'Accumulate 100 gold',
    category: 'wealth',
    icon: '💰',
    checkUnlock: (state) => state.player?.gold >= 100
  },
  
  wealthy: {
    id: 'wealthy',
    name: 'Wealthy Adventurer',
    description: 'Accumulate 1000 gold',
    category: 'wealth',
    icon: '💎',
    checkUnlock: (state) => state.player?.gold >= 1000
  },
  
  merchant: {
    id: 'merchant',
    name: 'Master Merchant',
    description: 'Sell 100 items to merchants',
    category: 'wealth',
    icon: '🏪',
    checkUnlock: (state) => state.player?.tradeStats?.itemsSold >= 100
  },
  
  banker: {
    id: 'banker',
    name: 'Savvy Investor',
    description: 'Have 500 gold in bank deposits',
    category: 'wealth',
    icon: '🏦',
    checkUnlock: (state) => (state.bank?.deposit || 0) >= 500
  },
  
  // Exploration Achievements
  villageExplorer: {
    id: 'villageExplorer',
    name: 'Village Explorer',
    description: 'Visit all village locations',
    category: 'exploration',
    icon: '🗺️',
    checkUnlock: (state) => {
      const visited = state.player?.locationsVisited || [];
      return visited.includes('merchant') && visited.includes('bank') && 
             visited.includes('tavern') && visited.includes('townHall');
    }
  },
  
  tavernRegular: {
    id: 'tavernRegular',
    name: 'Tavern Regular',
    description: 'Rest at the tavern 20 times',
    category: 'exploration',
    icon: '🍺',
    checkUnlock: (state) => state.player?.tavernStats?.timesRested >= 20
  },
  
  gambler: {
    id: 'gambler',
    name: 'High Roller',
    description: 'Win 1000 gold from tavern games',
    category: 'exploration',
    icon: '🎲',
    checkUnlock: (state) => (state.player?.tavernStats?.totalWinnings || 0) >= 1000
  },
  
  // Quest Achievements
  questBegin: {
    id: 'questBegin',
    name: 'Quest Accepted',
    description: 'Start your first quest',
    category: 'quests',
    icon: '📜',
    checkUnlock: (state) => state.quests?.active?.length > 0 || state.quests?.completed?.length > 0
  },
  
  questComplete: {
    id: 'questComplete',
    name: 'Quest Completed',
    description: 'Complete your first quest',
    category: 'quests',
    icon: '✅',
    checkUnlock: (state) => state.quests?.completed?.length >= 1
  },
  
  questMaster: {
    id: 'questMaster',
    name: 'Quest Master',
    description: 'Complete 10 quests',
    category: 'quests',
    icon: '🏆',
    checkUnlock: (state) => state.quests?.completed?.length >= 10
  },
  
  // Loot Achievements
  lootCollector: {
    id: 'lootCollector',
    name: 'Treasure Hunter',
    description: 'Collect 50 items',
    category: 'loot',
    icon: '📦',
    checkUnlock: (state) => state.player?.lootStats?.itemsFound >= 50
  },
  
  rareFind: {
    id: 'rareFind',
    name: 'Rare Find',
    description: 'Find your first rare or better item',
    category: 'loot',
    icon: '💠',
    checkUnlock: (state) => (state.player?.lootStats?.raresFound || 0) >= 1
  },
  
  legendaryLoot: {
    id: 'legendaryLoot',
    name: 'Legendary Luck',
    description: 'Find a legendary item',
    category: 'loot',
    icon: '⭐',
    checkUnlock: (state) => (state.player?.lootStats?.legendariesFound || 0) >= 1
  },
  
  fullyEquipped: {
    id: 'fullyEquipped',
    name: 'Fully Equipped',
    description: 'Equip items in all equipment slots',
    category: 'loot',
    icon: '⚜️',
    checkUnlock: (state) => {
      const eq = state.player?.equipment || {};
      return eq.weapon && eq.armor;
    }
  },
  
  // Special Achievements
  survivor: {
    id: 'survivor',
    name: 'Survivor',
    description: 'Survive 30 in-game days',
    category: 'special',
    icon: '🌅',
    checkUnlock: (state) => (state.time?.dayIndex || 0) >= 30
  },
  
  politician: {
    id: 'politician',
    name: 'Voice of the People',
    description: 'Vote on 5 village petitions',
    category: 'special',
    icon: '🗳️',
    checkUnlock: (state) => (state.player?.governmentStats?.petitionsVoted || 0) >= 5
  },
  
  companion: {
    id: 'companion',
    name: 'Loyal Companion',
    description: 'Recruit your first companion',
    category: 'special',
    icon: '🐺',
    checkUnlock: (state) => {
      const companions = state.player?.companions || [];
      return companions.length >= 1;
    }
  }
};

/**
 * Get achievement categories for UI organization
 */
export function getAchievementCategories() {
  return {
    combat: { name: 'Combat', icon: '⚔️' },
    progression: { name: 'Progression', icon: '📈' },
    wealth: { name: 'Wealth', icon: '💰' },
    exploration: { name: 'Exploration', icon: '🗺️' },
    quests: { name: 'Quests', icon: '📜' },
    loot: { name: 'Loot', icon: '📦' },
    special: { name: 'Special', icon: '✨' }
  };
}

/**
 * Get all achievements as an array
 */
export function getAllAchievements() {
  return Object.values(achievements);
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(category) {
  return Object.values(achievements).filter(a => a.category === category);
}
