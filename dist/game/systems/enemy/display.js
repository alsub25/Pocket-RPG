// Systems/Enemy/display.js
// Enemy name + label helpers.
import { getEnemyAffixLabels } from './affixes.js';
export function rebuildEnemyDisplayName(enemy) {
    if (!enemy)
        return;
    // Keep baseName as the unmodified template name (safe for old saves).
    if (!enemy.baseName)
        enemy.baseName = enemy.name || 'Enemy';
    const parts = [];
    if (enemy.isElite && enemy.eliteLabel)
        parts.push(enemy.eliteLabel);
    const affixLabels = getEnemyAffixLabels(enemy);
    if (affixLabels.length > 0)
        parts.push(...affixLabels);
    enemy.name = parts.length > 0 ? parts.join(' ') + ' ' + enemy.baseName : enemy.baseName;
}
//# sourceMappingURL=display.js.map