// js/game/ui/combat/tooltips.js
// Combat UI tooltip system
// Patch 1.2.90

export function generateStatusTooltip(statusEffect) {
  if (!statusEffect) return '';
  return `<div class="tooltip">${statusEffect.id}: ${statusEffect.duration} turns</div>`;
}

export function generateAbilityTooltip(ability) {
  if (!ability) return '';
  return `<div class="tooltip">${ability.name}<br>${ability.desc}</div>`;
}

export function initializeCombatTooltips() {
  console.log('Combat tooltips initialized');
}
