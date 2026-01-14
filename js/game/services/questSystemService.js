// js/game/services/questSystemService.js
// Engine-integrated quest system service
// 
// This service wraps the quest system to ensure all state changes
// go through the engine properly with immutable updates and event emissions.

import {
  ensureQuestStructures,
  initMainQuest as initMainQuestImpl,
  getActiveSideQuests,
  startSideQuest as startSideQuestImpl,
  advanceSideQuest as advanceSideQuestImpl,
  completeSideQuest as completeSideQuestImpl,
  applyQuestProgressOnItemGain as applyItemProgressImpl,
  applyQuestProgressOnEnemyDefeat as applyEnemyProgressImpl
} from '../quests/questSystem.js';

/**
 * Creates an engine-integrated quest system service.
 * All quest state mutations go through engine.setState() with immutable updates.
 * All quest changes emit events for other systems to react.
 */
export function createQuestSystemService(engine) {
  if (!engine) throw new Error('QuestSystemService requires engine instance');

  /**
   * Initialize quest structures in state if missing
   */
  function initQuests(state) {
    const tempState = JSON.parse(JSON.stringify(state));
    ensureQuestStructures(tempState);
    
    return {
      ...state,
      quests: tempState.quests,
      flags: tempState.flags
    };
  }

  /**
   * Initialize the main quest
   */
  function initMainQuest() {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    initMainQuestImpl(tempState);
    
    const newState = {
      ...state,
      quests: tempState.quests,
      flags: tempState.flags
    };
    
    engine.setState(newState);
    
    engine.emit('quest:mainQuestStarted', {
      quest: newState.quests.main
    });
  }

  /**
   * Start a side quest
   */
  function startSideQuest(questId) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    // Get UI service for API hooks
    const ui = engine.get('ui');
    const api = {
      addLog: (msg, category) => {
        if (ui && ui.addLog) ui.addLog(msg, category);
      }
    };
    
    startSideQuestImpl(tempState, questId, api);
    
    const newState = {
      ...state,
      quests: tempState.quests,
      flags: tempState.flags
    };
    
    engine.setState(newState);
    
    engine.emit('quest:sideQuestStarted', {
      questId,
      quest: newState.quests.side[questId]
    });
  }

  /**
   * Advance a side quest to the next step
   */
  function advanceSideQuest(questId, nextStep) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const ui = engine.get('ui');
    const api = {
      addLog: (msg, category) => {
        if (ui && ui.addLog) ui.addLog(msg, category);
      }
    };
    
    advanceSideQuestImpl(tempState, questId, nextStep, api);
    
    const newState = {
      ...state,
      quests: tempState.quests,
      flags: tempState.flags
    };
    
    engine.setState(newState);
    
    engine.emit('quest:sideQuestAdvanced', {
      questId,
      nextStep,
      quest: newState.quests.side[questId]
    });
  }

  /**
   * Complete a side quest
   */
  function completeSideQuest(questId, rewardsFn) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const ui = engine.get('ui');
    const api = {
      addLog: (msg, category) => {
        if (ui && ui.addLog) ui.addLog(msg, category);
      }
    };
    
    completeSideQuestImpl(tempState, questId, rewardsFn, api);
    
    const newState = {
      ...state,
      quests: tempState.quests,
      flags: tempState.flags
    };
    
    engine.setState(newState);
    
    engine.emit('quest:sideQuestCompleted', {
      questId,
      quest: newState.quests.side[questId]
    });
  }

  /**
   * Apply quest progress when player gains an item
   */
  function applyItemProgress(itemId, quantity = 1) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const ui = engine.get('ui');
    const api = {
      addLog: (msg, category) => {
        if (ui && ui.addLog) ui.addLog(msg, category);
      }
    };
    
    applyItemProgressImpl(tempState, itemId, quantity, api);
    
    const newState = {
      ...state,
      quests: tempState.quests,
      flags: tempState.flags
    };
    
    engine.setState(newState);
    
    engine.emit('quest:itemProgressApplied', {
      itemId,
      quantity
    });
  }

  /**
   * Apply quest progress when player defeats an enemy
   */
  function applyEnemyProgress(enemy) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const ui = engine.get('ui');
    const api = {
      addLog: (msg, category) => {
        if (ui && ui.addLog) ui.addLog(msg, category);
      }
    };
    
    applyEnemyProgressImpl(tempState, enemy, api);
    
    const newState = {
      ...state,
      quests: tempState.quests,
      flags: tempState.flags
    };
    
    engine.setState(newState);
    
    engine.emit('quest:enemyProgressApplied', {
      enemy: enemy.name || enemy.id
    });
  }

  /**
   * Get active side quests
   */
  function getActiveSideQuestsData() {
    const state = engine.getState();
    return getActiveSideQuests(state);
  }

  /**
   * Initialize quest state in the engine
   */
  function initializeState() {
    const state = engine.getState();
    const newState = initQuests(state);
    if (newState !== state) {
      engine.setState(newState);
      engine.emit('quest:initialized', {
        quests: newState.quests
      });
    }
  }

  // Public API
  return {
    initializeState,
    initMainQuest,
    startSideQuest,
    advanceSideQuest,
    completeSideQuest,
    applyItemProgress,
    applyEnemyProgress,
    getActiveSideQuests: getActiveSideQuestsData
  };
}
