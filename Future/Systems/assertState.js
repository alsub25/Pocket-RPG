// Systems/assertState.js
// Lightweight invariant checks to catch NaN/corrupt-state issues early.

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function push(issues, code, detail) {
  issues.push({ code: String(code), detail: String(detail || '') });
}

export function validateState(state) {
  const issues = [];
  if (!state || typeof state !== 'object') {
    push(issues, 'state.missing', 'State is null/undefined or not an object');
    return { ok: false, issues };
  }

  // Player core
  if (!state.player || typeof state.player !== 'object') {
    push(issues, 'player.missing', 'Missing state.player');
  } else {
    const p = state.player;
    if (!isFiniteNumber(p.hp)) push(issues, 'player.hp.nan', 'hp is not finite');
    if (!isFiniteNumber(p.maxHp) || p.maxHp < 1) push(issues, 'player.maxHp.bad', 'maxHp is not finite or < 1');
    if (isFiniteNumber(p.hp) && isFiniteNumber(p.maxHp) && (p.hp < 0 || p.hp > p.maxHp)) {
      push(issues, 'player.hp.range', `hp out of range: ${p.hp}/${p.maxHp}`);
    }
    if (!isFiniteNumber(p.gold) || p.gold < 0) push(issues, 'player.gold.bad', 'gold is not finite or < 0');
    if (!isFiniteNumber(p.level) || p.level < 1) push(issues, 'player.level.bad', 'level is not finite or < 1');

    // Inventory sanity (common corruption vector)
    if (Array.isArray(p.inventory)) {
      for (let i = 0; i < p.inventory.length; i++) {
        const it = p.inventory[i];
        if (!it || typeof it !== 'object') {
          push(issues, 'inv.entry.bad', `inventory[${i}] not an object`);
          continue;
        }
        if (!('qty' in it)) continue;
        const q = Number(it.qty);
        if (!Number.isFinite(q) || q < 0 || Math.floor(q) !== q) {
          push(issues, 'inv.qty.bad', `inventory[${i}].qty=${String(it.qty)}`);
        }
      }
    }
  }

  // Time
  if (state.time && typeof state.time === 'object') {
    const d = state.time.dayIndex;
    if (!isFiniteNumber(d) || d < 0) push(issues, 'time.dayIndex.bad', `dayIndex=${String(d)}`);
  }

  // Combat snapshot
  if (state.inCombat) {
    if (!state.currentEnemy || typeof state.currentEnemy !== 'object') {
      push(issues, 'combat.enemy.missing', 'inCombat is true but currentEnemy is missing');
    } else {
      const e = state.currentEnemy;
      if (!isFiniteNumber(e.hp)) push(issues, 'enemy.hp.nan', 'enemy hp not finite');
      if (!isFiniteNumber(e.maxHp) || e.maxHp < 1) push(issues, 'enemy.maxHp.bad', 'enemy maxHp not finite or < 1');
    }
  }

  // Economy (guard the usual NaN sources)
  if (state.villageEconomy && typeof state.villageEconomy === 'object') {
    const ve = state.villageEconomy;
    const keys = ['prosperity', 'scarcity', 'taxRate', 'dayCounter'];
    keys.forEach((k) => {
      if (k in ve && ve[k] != null && typeof ve[k] === 'number' && !Number.isFinite(ve[k])) {
        push(issues, 'economy.nan', `${k} is NaN/Infinity`);
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

export function formatIssues(issues) {
  if (!Array.isArray(issues) || !issues.length) return '';
  return issues.map((x) => `- ${x.code}${x.detail ? `: ${x.detail}` : ''}`).join('\n');
}
