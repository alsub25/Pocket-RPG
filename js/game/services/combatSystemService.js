// js/game/services/combatSystemService.js
// Engine-integrated combat system service
//
// This service wraps the combat system to ensure all state changes
// go through the engine properly with immutable updates and event emissions.

/**
 * Creates an engine-integrated combat system service.
 * All combat state mutations go through engine.setState() with immutable updates.
 * All combat actions emit events for other systems to react.
 */
export function createCombatSystemService(engine) {
  if (!engine) throw new Error('CombatSystemService requires engine instance');

  /**
   * Start combat with specified enemies
   */
  function startCombat(enemies) {
    if (!Array.isArray(enemies) || enemies.length === 0) {
      throw new Error('Combat requires at least one enemy');
    }

    const state = engine.getState();
    const newState = {
      ...state,
      inCombat: true,
      enemies: enemies.map(e => ({ ...e, hp: e.maxHp })),
      currentEnemy: { ...enemies[0], hp: enemies[0].maxHp },
      combatTurn: 0
    };

    engine.setState(newState);
    engine.emit('combat:started', {
      enemies: newState.enemies,
      enemyCount: enemies.length
    });

    return newState;
  }

  /**
   * End combat (victory or defeat)
   */
  function endCombat(reason = 'victory') {
    const state = engine.getState();
    
    const newState = {
      ...state,
      inCombat: false,
      enemies: [],
      currentEnemy: null,
      combatTurn: 0
    };

    engine.setState(newState);
    engine.emit('combat:ended', { reason });

    return newState;
  }

  /**
   * Apply damage to an enemy
   */
  function damageEnemy(enemyId, damage) {
    const state = engine.getState();
    const enemies = state.enemies || [];
    const enemyIndex = enemies.findIndex(e => e.id === enemyId);
    
    if (enemyIndex === -1) {
      engine.log?.warn?.('combat', 'Enemy not found', { enemyId });
      return state;
    }

    const newEnemies = [...enemies];
    const enemy = { ...newEnemies[enemyIndex] };
    const actualDamage = Math.min(damage, enemy.hp);
    enemy.hp = Math.max(0, enemy.hp - damage);
    newEnemies[enemyIndex] = enemy;

    const newState = {
      ...state,
      enemies: newEnemies,
      currentEnemy: state.currentEnemy?.id === enemyId ? enemy : state.currentEnemy
    };

    engine.setState(newState);
    engine.emit('combat:enemyDamaged', {
      enemyId,
      damage: actualDamage,
      remainingHp: enemy.hp,
      defeated: enemy.hp <= 0
    });

    if (enemy.hp <= 0) {
      engine.emit('combat:enemyDefeated', { enemy });
    }

    return newState;
  }

  /**
   * Apply damage to player
   */
  function damagePlayer(damage) {
    const state = engine.getState();
    const player = state.player || {};
    
    const actualDamage = Math.min(damage, player.hp || 0);
    const newPlayer = {
      ...player,
      hp: Math.max(0, (player.hp || 0) - damage)
    };

    const newState = {
      ...state,
      player: newPlayer
    };

    engine.setState(newState);
    engine.emit('combat:playerDamaged', {
      damage: actualDamage,
      remainingHp: newPlayer.hp,
      defeated: newPlayer.hp <= 0
    });

    if (newPlayer.hp <= 0) {
      engine.emit('combat:playerDefeated', {});
    }

    return newState;
  }

  /**
   * Apply status effect to enemy
   */
  function applyEnemyStatus(enemyId, statusId, duration, data = {}) {
    const state = engine.getState();
    const enemies = state.enemies || [];
    const enemyIndex = enemies.findIndex(e => e.id === enemyId);
    
    if (enemyIndex === -1) return state;

    const newEnemies = [...enemies];
    const enemy = { ...newEnemies[enemyIndex] };
    const statusEffects = enemy.statusEffects || [];
    
    const newStatus = {
      id: statusId,
      duration,
      appliedTurn: state.combatTurn || 0,
      ...data
    };

    const existingIndex = statusEffects.findIndex(s => s.id === statusId);
    const newStatusEffects = [...statusEffects];
    
    if (existingIndex >= 0) {
      newStatusEffects[existingIndex] = newStatus;
    } else {
      newStatusEffects.push(newStatus);
    }

    enemy.statusEffects = newStatusEffects;
    newEnemies[enemyIndex] = enemy;

    const newState = {
      ...state,
      enemies: newEnemies,
      currentEnemy: state.currentEnemy?.id === enemyId ? enemy : state.currentEnemy
    };

    engine.setState(newState);
    engine.emit('combat:statusApplied', {
      target: 'enemy',
      enemyId,
      statusId,
      duration,
      data
    });

    return newState;
  }

  /**
   * Apply status effect to player
   */
  function applyPlayerStatus(statusId, duration, data = {}) {
    const state = engine.getState();
    const player = state.player || {};
    const statusEffects = player.statusEffects || [];
    
    const newStatus = {
      id: statusId,
      duration,
      appliedTurn: state.combatTurn || 0,
      ...data
    };

    const existingIndex = statusEffects.findIndex(s => s.id === statusId);
    const newStatusEffects = [...statusEffects];
    
    if (existingIndex >= 0) {
      newStatusEffects[existingIndex] = newStatus;
    } else {
      newStatusEffects.push(newStatus);
    }

    const newPlayer = {
      ...player,
      statusEffects: newStatusEffects
    };

    const newState = {
      ...state,
      player: newPlayer
    };

    engine.setState(newState);
    engine.emit('combat:statusApplied', {
      target: 'player',
      statusId,
      duration,
      data
    });

    return newState;
  }

  /**
   * Advance combat turn
   */
  function nextTurn() {
    const state = engine.getState();
    const newState = {
      ...state,
      combatTurn: (state.combatTurn || 0) + 1
    };

    engine.setState(newState);
    engine.emit('combat:turnAdvanced', {
      turn: newState.combatTurn
    });

    return newState;
  }

  /**
   * Get current combat state
   */
  function getCombatState() {
    const state = engine.getState();
    return {
      inCombat: state.inCombat || false,
      enemies: state.enemies || [],
      currentEnemy: state.currentEnemy || null,
      turn: state.combatTurn || 0
    };
  }

  // Public API
  return {
    startCombat,
    endCombat,
    damageEnemy,
    damagePlayer,
    applyEnemyStatus,
    applyPlayerStatus,
    nextTurn,
    getCombatState
  };
}
