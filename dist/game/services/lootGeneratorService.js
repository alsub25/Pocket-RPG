// js/game/services/lootGeneratorService.js
// Engine-integrated loot generator service
// 
// This service wraps the loot generation system to ensure proper event emissions
// when loot is generated, allowing other systems to react to loot drops.
import { generateLootDrop, generateArmorForSlot, getSellValue, formatRarityLabel, getItemPowerScore } from '../systems/lootGenerator.js';
/**
 * Creates an engine-integrated loot generator service.
 * Emits events when loot is generated for telemetry and other systems to track.
 */
export function createLootGeneratorService(engine) {
    if (!engine)
        throw new Error('LootGeneratorService requires engine instance');
    /**
     * Generate a loot drop and emit event
     */
    function generateLoot(args) {
        const { area = 'plains', enemyTier = 1, playerLevel = 1, isBoss = false, isElite = false, minRarity = null, preferredTypes = null } = args;
        // Generate the loot
        const lootItem = generateLootDrop({
            area,
            enemyTier,
            playerLevel,
            isBoss,
            isElite,
            minRarity,
            preferredTypes
        });
        // Emit event that loot was generated
        if (lootItem) {
            engine.emit('loot:generated', {
                item: lootItem,
                area,
                enemyTier,
                playerLevel,
                isBoss,
                isElite,
                rarity: lootItem.rarity,
                type: lootItem.type,
                itemLevel: lootItem.itemLevel
            });
        }
        return lootItem;
    }
    /**
     * Generate armor for a specific slot and emit event
     */
    function generateArmor(args) {
        const { slot, area = 'plains', enemyTier = 1, playerLevel = 1, isBoss = false, isElite = false, minRarity = null } = args;
        // Generate the armor
        const armorItem = generateArmorForSlot({
            slot,
            area,
            enemyTier,
            playerLevel,
            isBoss,
            isElite,
            minRarity
        });
        // Emit event that armor was generated
        if (armorItem) {
            engine.emit('loot:armorGenerated', {
                item: armorItem,
                slot,
                area,
                enemyTier,
                playerLevel,
                isBoss,
                isElite,
                rarity: armorItem.rarity,
                itemLevel: armorItem.itemLevel
            });
        }
        return armorItem;
    }
    /**
     * Get sell value for an item
     */
    function getSellPrice(item, context = 'village') {
        return getSellValue(item, context);
    }
    /**
     * Get formatted rarity label
     */
    function getRarityLabel(rarity) {
        return formatRarityLabel(rarity);
    }
    /**
     * Get item power score
     */
    function getPowerScore(item) {
        return getItemPowerScore(item);
    }
    // Public API
    return {
        generateLoot,
        generateArmor,
        getSellPrice,
        getRarityLabel,
        getPowerScore
    };
}
//# sourceMappingURL=lootGeneratorService.js.map