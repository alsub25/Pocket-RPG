/**
 * Achievement System
 * Tracks and unlocks achievements based on game state and events
 */

import { achievements, getAllAchievements } from '../data/achievements.js';

/**
 * Initialize achievement state
 */
export function initAchievements(state) {
  if (!state.achievements) {
    state.achievements = {
      unlocked: [], // Array of achievement IDs
      newlyUnlocked: [], // Achievements unlocked this session (for notifications)
      stats: {
        totalUnlocked: 0,
        lastUnlocked: null,
        lastUnlockTime: null
      }
    };
  }
  return state;
}

/**
 * Check all achievements and unlock any that meet criteria
 * Returns array of newly unlocked achievement IDs
 */
export function checkAchievements(state) {
  const unlocked = state.achievements?.unlocked || [];
  const newlyUnlocked = [];
  
  const allAchievements = getAllAchievements();
  
  for (const achievement of allAchievements) {
    // Skip if already unlocked
    if (unlocked.includes(achievement.id)) {
      continue;
    }
    
    // Check unlock criteria
    try {
      if (achievement.checkUnlock(state)) {
        unlockAchievement(state, achievement.id);
        newlyUnlocked.push(achievement.id);
      }
    } catch (error) {
      console.error(`Error checking achievement ${achievement.id}:`, error);
    }
  }
  
  return newlyUnlocked;
}

/**
 * Unlock a specific achievement
 */
export function unlockAchievement(state, achievementId) {
  if (!state.achievements) {
    initAchievements(state);
  }
  
  const achievement = achievements[achievementId];
  if (!achievement) {
    console.warn(`Achievement ${achievementId} not found`);
    return false;
  }
  
  // Check if already unlocked
  if (state.achievements.unlocked.includes(achievementId)) {
    return false;
  }
  
  // Unlock the achievement
  state.achievements.unlocked.push(achievementId);
  state.achievements.newlyUnlocked.push(achievementId);
  state.achievements.stats.totalUnlocked = state.achievements.unlocked.length;
  state.achievements.stats.lastUnlocked = achievementId;
  state.achievements.stats.lastUnlockTime = Date.now();
  
  console.log(`🏆 Achievement Unlocked: ${achievement.name}`);
  
  return true;
}

/**
 * Check if an achievement is unlocked
 */
export function isAchievementUnlocked(state, achievementId) {
  return state.achievements?.unlocked?.includes(achievementId) || false;
}

/**
 * Get achievement progress (percentage of achievements unlocked)
 */
export function getAchievementProgress(state) {
  const total = getAllAchievements().length;
  const unlocked = state.achievements?.unlocked?.length || 0;
  return {
    unlocked,
    total,
    percentage: Math.round((unlocked / total) * 100)
  };
}

/**
 * Get newly unlocked achievements and clear the list
 */
export function getAndClearNewlyUnlocked(state) {
  const newlyUnlocked = state.achievements?.newlyUnlocked || [];
  if (state.achievements) {
    state.achievements.newlyUnlocked = [];
  }
  return newlyUnlocked;
}

/**
 * Get achievement by ID
 */
export function getAchievement(achievementId) {
  return achievements[achievementId];
}

/**
 * Get all unlocked achievements
 */
export function getUnlockedAchievements(state) {
  const unlocked = state.achievements?.unlocked || [];
  return unlocked.map(id => achievements[id]).filter(a => a);
}

/**
 * Get all locked achievements
 */
export function getLockedAchievements(state) {
  const unlocked = state.achievements?.unlocked || [];
  return getAllAchievements().filter(a => !unlocked.includes(a.id));
}

/**
 * Initialize player stats needed for achievements if they don't exist
 */
export function initPlayerAchievementStats(state) {
  if (!state.player) {
    return state;
  }
  
  // Combat stats
  if (!state.player.combatStats) {
    state.player.combatStats = {
      victories: 0,
      defeats: 0,
      bossesDefeated: 0,
      elitesDefeated: 0,
      winStreak: 0,
      perfectVictories: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0
    };
  }
  
  // Trade stats
  if (!state.player.tradeStats) {
    state.player.tradeStats = {
      itemsSold: 0,
      itemsBought: 0,
      totalGoldSpent: 0,
      totalGoldEarned: 0
    };
  }
  
  // Loot stats
  if (!state.player.lootStats) {
    state.player.lootStats = {
      itemsFound: 0,
      raresFound: 0,
      legendariesFound: 0,
      mythicsFound: 0
    };
  }
  
  // Tavern stats
  if (!state.player.tavernStats) {
    state.player.tavernStats = {
      timesRested: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      totalWinnings: 0,
      totalLosses: 0
    };
  }
  
  // Government stats
  if (!state.player.governmentStats) {
    state.player.governmentStats = {
      petitionsVoted: 0,
      petitionsCreated: 0
    };
  }
  
  // Locations visited
  if (!state.player.locationsVisited) {
    state.player.locationsVisited = [];
  }
  
  return state;
}

/**
 * Track a location visit
 */
export function trackLocationVisit(state, location) {
  if (!state.player.locationsVisited) {
    state.player.locationsVisited = [];
  }
  
  if (!state.player.locationsVisited.includes(location)) {
    state.player.locationsVisited.push(location);
  }
}
