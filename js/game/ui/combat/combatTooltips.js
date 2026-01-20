// js/game/ui/combat/combatTooltips.js
// Combat UI tooltip system for displaying detailed combat information
// Patch 1.2.90

import { STATUS_EFFECTS } from '../../data/statusEffects.js';

/**
 * Generate tooltip content for a status effect
 */
export function generateStatusEffectTooltip(statusEffect) {
  if (!statusEffect || !statusEffect.id) return '';
  
  const effect = STATUS_EFFECTS[statusEffect.id];
  if (!effect) return statusEffect.id;
  
  const stacks = statusEffect.stacks || 1;
  const duration = statusEffect.duration || 0;
  const icon = effect.icon || '';
  
  let tooltip = `<div class="combat-tooltip status-tooltip">`;
  tooltip += `<div class="tooltip-header">`;
  tooltip += `<span class="tooltip-icon">${icon}</span>`;
  tooltip += `<span class="tooltip-name">${effect.name}</span>`;
  tooltip += `</div>`;
  tooltip += `<div class="tooltip-description">${effect.description}</div>`;
  
  if (effect.stackable && stacks > 1) {
    tooltip += `<div class="tooltip-stat">Stacks: ${stacks}</div>`;
  }
  
  if (duration > 0) {
    tooltip += `<div class="tooltip-stat">Duration: ${duration} turns</div>`;
  }
  
  if (effect.tickDamage) {
    const damage = effect.tickDamage * stacks;
    tooltip += `<div class="tooltip-stat damage">Damage per turn: ${damage}</div>`;
  }
  
  if (effect.damageReduction) {
    const reduction = Math.round(effect.damageReduction * 100 * stacks);
    tooltip += `<div class="tooltip-stat defense">Damage reduction: ${reduction}%</div>`;
  }
  
  tooltip += `</div>`;
  return tooltip;
}

/**
 * Generate tooltip content for an ability
 */
export function generateAbilityTooltip(ability) {
  if (!ability) return '';
  
  let tooltip = `<div class="combat-tooltip ability-tooltip">`;
  tooltip += `<div class="tooltip-header">`;
  tooltip += `<span class="tooltip-name">${ability.name || ability.id}</span>`;
  tooltip += `</div>`;
  
  if (ability.desc) {
    tooltip += `<div class="tooltip-description">${ability.desc}</div>`;
  }
  
  tooltip += `<div class="tooltip-stats">`;
  
  if (ability.cooldown) {
    tooltip += `<div class="tooltip-stat">Cooldown: ${ability.cooldown} turns</div>`;
  }
  
  if (ability.type) {
    tooltip += `<div class="tooltip-stat">Type: ${ability.type}</div>`;
  }
  
  if (ability.potency) {
    const damagePercent = Math.round(ability.potency * 100);
    tooltip += `<div class="tooltip-stat damage">Potency: ${damagePercent}%</div>`;
  }
  
  if (ability.element) {
    tooltip += `<div class="tooltip-stat element">Element: ${ability.element}</div>`;
  }
  
  tooltip += `</div></div>`;
  return tooltip;
}

/**
 * Generate turn preview showing expected damage and effects
 */
export function generateTurnPreview(player, enemy, action) {
  if (!player || !enemy || !action) return '';
  
  let preview = `<div class="combat-preview">`;
  preview += `<div class="preview-header">Turn Preview</div>`;
  
  // Estimate damage based on action type
  let estimatedDamage = 0;
  if (action.type === 'attack') {
    estimatedDamage = Math.max(1, Math.round(player.attack * 0.8));
  } else if (action.type === 'spell') {
    estimatedDamage = Math.max(1, Math.round(player.magic * 1.2));
  }
  
  // Apply status effect modifiers
  if (enemy.statusEffects) {
    const exposed = enemy.statusEffects.find(s => s.id === 'exposed');
    if (exposed) {
      estimatedDamage = Math.round(estimatedDamage * 1.5);
    }
    
    const fortified = enemy.statusEffects.filter(s => s.id === 'fortified');
    if (fortified.length > 0) {
      const reduction = 0.25 * Math.min(fortified.length, 3);
      estimatedDamage = Math.round(estimatedDamage * (1 - reduction));
    }
  }
  
  if (player.statusEffects) {
    const dazed = player.statusEffects.find(s => s.id === 'dazed');
    if (dazed) {
      estimatedDamage = Math.round(estimatedDamage * 0.7);
    }
  }
  
  preview += `<div class="preview-damage">`;
  preview += `<span class="preview-label">Est. Damage:</span>`;
  preview += `<span class="preview-value damage">${estimatedDamage}</span>`;
  preview += `</div>`;
  
  // Show enemy HP after hit
  const enemyHpAfter = Math.max(0, enemy.hp - estimatedDamage);
  const enemyHpPercent = Math.round((enemyHpAfter / enemy.maxHp) * 100);
  
  preview += `<div class="preview-hp">`;
  preview += `<span class="preview-label">Enemy HP:</span>`;
  preview += `<span class="preview-value">${enemyHpAfter}/${enemy.maxHp} (${enemyHpPercent}%)</span>`;
  preview += `</div>`;
  
  // Show if enemy will be defeated
  if (enemyHpAfter <= 0) {
    preview += `<div class="preview-result victory">Enemy will be defeated!</div>`;
  }
  
  preview += `</div>`;
  return preview;
}

/**
 * Show tooltip near cursor or element
 */
export function showTooltip(content, element) {
  let tooltip = document.getElementById('combat-tooltip');
  
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'combat-tooltip';
    tooltip.className = 'combat-tooltip-container';
    document.body.appendChild(tooltip);
  }
  
  tooltip.innerHTML = content;
  tooltip.classList.add('visible');
  
  if (element) {
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.bottom + 5) + 'px';
  }
}

/**
 * Hide tooltip
 */
export function hideTooltip() {
  const tooltip = document.getElementById('combat-tooltip');
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

/**
 * Initialize tooltip event listeners on combat elements
 */
export function initializeCombatTooltips() {
  // Add event listeners to status effect icons
  document.addEventListener('mouseover', (e) => {
    const statusIcon = e.target.closest('[data-status-effect]');
    if (statusIcon) {
      const statusId = statusIcon.dataset.statusEffect;
      const statusEffect = { id: statusId, stacks: parseInt(statusIcon.dataset.stacks || '1'), duration: parseInt(statusIcon.dataset.duration || '0') };
      const content = generateStatusEffectTooltip(statusEffect);
      showTooltip(content, statusIcon);
    }
    
    const abilityBtn = e.target.closest('[data-ability]');
    if (abilityBtn && abilityBtn.dataset.abilityTooltip) {
      try {
        const ability = JSON.parse(abilityBtn.dataset.abilityTooltip);
        const content = generateAbilityTooltip(ability);
        showTooltip(content, abilityBtn);
      } catch (err) {
        // Invalid JSON, skip
      }
    }
  });
  
  document.addEventListener('mouseout', (e) => {
    const statusIcon = e.target.closest('[data-status-effect]');
    const abilityBtn = e.target.closest('[data-ability]');
    if (statusIcon || abilityBtn) {
      hideTooltip();
    }
  });
}
