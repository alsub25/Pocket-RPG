// js/game/services/achievementService.js
// Engine-integrated achievement system service
// 
// This service wraps the achievement system to ensure all state changes
// go through the engine properly with immutable updates and event emissions.

import {
  initAchievements,
  initPlayerAchievementStats,
  checkAchievements,
  unlockAchievement,
  isAchievementUnlocked,
  getAchievementProgress,
  getAndClearNewlyUnlocked,
  getUnlockedAchievements,
  getLockedAchievements,
  trackLocationVisit
} from '../systems/achievementSystem.js';

/**
 * Creates an engine-integrated achievement system service.
 * All achievement state mutations go through engine.setState() with immutable updates.
 * All achievement unlocks emit events for other systems to react.
 */
export function createAchievementService(engine) {
  if (!engine) throw new Error('AchievementService requires engine instance');

  /**
   * Initialize achievement structures in state if missing
   */
  function initService(state) {
    const tempState = JSON.parse(JSON.stringify(state));
    initAchievements(tempState);
    initPlayerAchievementStats(tempState);
    return tempState;
  }

  /**
   * Check all achievements and unlock any that meet criteria
   * Emits 'achievement:unlocked' event for each new achievement
   */
  function checkAndUnlock() {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const newlyUnlocked = checkAchievements(tempState);
    
    if (newlyUnlocked.length > 0) {
      engine.setState(tempState);
      
      // Emit event for each newly unlocked achievement
      for (const achievementId of newlyUnlocked) {
        engine.emit('achievement:unlocked', { achievementId });
        engine.log?.info?.('achievement', `Achievement unlocked: ${achievementId}`);
      }
    }
  }

  /**
   * Manually unlock an achievement (for testing/cheats)
   */
  function unlock(achievementId) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const wasUnlocked = unlockAchievement(tempState, achievementId);
    
    if (wasUnlocked) {
      engine.setState(tempState);
      engine.emit('achievement:unlocked', { achievementId });
      engine.log?.info?.('achievement', `Achievement manually unlocked: ${achievementId}`);
    }
    
    return wasUnlocked;
  }

  /**
   * Check if an achievement is unlocked
   */
  function isUnlocked(achievementId) {
    const state = engine.getState();
    return isAchievementUnlocked(state, achievementId);
  }

  /**
   * Get achievement progress statistics
   */
  function getProgress() {
    const state = engine.getState();
    return getAchievementProgress(state);
  }

  /**
   * Get and clear newly unlocked achievements (for UI notifications)
   */
  function getNewlyUnlocked() {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const newlyUnlocked = getAndClearNewlyUnlocked(tempState);
    
    if (newlyUnlocked.length > 0) {
      engine.setState(tempState);
    }
    
    return newlyUnlocked;
  }

  /**
   * Get all unlocked achievements
   */
  function getUnlocked() {
    const state = engine.getState();
    return getUnlockedAchievements(state);
  }

  /**
   * Get all locked achievements
   */
  function getLocked() {
    const state = engine.getState();
    return getLockedAchievements(state);
  }

  /**
   * Track a location visit for achievement progress
   */
  function visitLocation(location) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    trackLocationVisit(tempState, location);
    engine.setState(tempState);
    
    // Check for location-related achievements
    checkAndUnlock();
  }

  /**
   * Update combat stats for achievements
   */
  function updateCombatStats(stats) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    if (!tempState.player.combatStats) {
      initPlayerAchievementStats(tempState);
    }
    
    Object.assign(tempState.player.combatStats, stats);
    engine.setState(tempState);
    
    // Check for combat-related achievements
    checkAndUnlock();
  }

  /**
   * Update loot stats for achievements
   */
  function updateLootStats(stats) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    if (!tempState.player.lootStats) {
      initPlayerAchievementStats(tempState);
    }
    
    Object.assign(tempState.player.lootStats, stats);
    engine.setState(tempState);
    
    // Check for loot-related achievements
    checkAndUnlock();
  }

  // Public API
  return {
    init: initService,
    check: checkAndUnlock,
    unlock,
    isUnlocked,
    getProgress,
    getNewlyUnlocked,
    getUnlocked,
    getLocked,
    visitLocation,
    updateCombatStats,
    updateLootStats
  };
}
