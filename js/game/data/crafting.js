/**
 * Crafting System - Materials and Recipes
 * Defines crafting materials and recipes for creating/upgrading items
 */

/**
 * Crafting Materials
 */
export const craftingMaterials = {
  // Basic Materials
  woodLog: {
    id: 'woodLog',
    name: 'Wood Log',
    description: 'Basic crafting material from trees',
    rarity: 'common',
    icon: '🪵',
    sellValue: 5
  },
  
  ironOre: {
    id: 'ironOre',
    name: 'Iron Ore',
    description: 'Raw iron ore for crafting',
    rarity: 'common',
    icon: '⛰️',
    sellValue: 8
  },
  
  leather: {
    id: 'leather',
    name: 'Leather',
    description: 'Tanned animal hide',
    rarity: 'common',
    icon: '🦴',
    sellValue: 6
  },
  
  cloth: {
    id: 'cloth',
    name: 'Cloth',
    description: 'Woven fabric for armor',
    rarity: 'common',
    icon: '🧵',
    sellValue: 4
  },
  
  // Intermediate Materials
  steelIngot: {
    id: 'steelIngot',
    name: 'Steel Ingot',
    description: 'Refined steel for weapons and armor',
    rarity: 'uncommon',
    icon: '🔩',
    sellValue: 20
  },
  
  hardenedLeather: {
    id: 'hardenedLeather',
    name: 'Hardened Leather',
    description: 'Reinforced leather for armor',
    rarity: 'uncommon',
    icon: '🛡️',
    sellValue: 18
  },
  
  mysticEssence: {
    id: 'mysticEssence',
    name: 'Mystic Essence',
    description: 'Magical essence for enchantments',
    rarity: 'uncommon',
    icon: '✨',
    sellValue: 25
  },
  
  // Rare Materials
  mithrilOre: {
    id: 'mithrilOre',
    name: 'Mithril Ore',
    description: 'Legendary metal ore',
    rarity: 'rare',
    icon: '💎',
    sellValue: 50
  },
  
  dragonScale: {
    id: 'dragonScale',
    name: 'Dragon Scale',
    description: 'Scale from a dragon, extremely rare',
    rarity: 'rare',
    icon: '🐉',
    sellValue: 100
  },
  
  enchantedCrystal: {
    id: 'enchantedCrystal',
    name: 'Enchanted Crystal',
    description: 'Crystal imbued with magic',
    rarity: 'rare',
    icon: '💠',
    sellValue: 75
  },
  
  // Epic Materials
  starFragment: {
    id: 'starFragment',
    name: 'Star Fragment',
    description: 'Fragment of a fallen star',
    rarity: 'epic',
    icon: '⭐',
    sellValue: 200
  },
  
  voidEssence: {
    id: 'voidEssence',
    name: 'Void Essence',
    description: 'Essence from the void realm',
    rarity: 'epic',
    icon: '🌑',
    sellValue: 250
  }
};

/**
 * Crafting Recipes
 */
export const craftingRecipes = {
  // Weapon Recipes
  ironSword: {
    id: 'ironSword',
    name: 'Iron Sword',
    type: 'weapon',
    description: 'A basic iron sword',
    materials: {
      ironOre: 3,
      woodLog: 1
    },
    result: {
      id: 'craftedIronSword',
      name: 'Iron Sword',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'common',
      stats: { attack: 5 }
    },
    requiredLevel: 1
  },
  
  steelSword: {
    id: 'steelSword',
    name: 'Steel Sword',
    type: 'weapon',
    description: 'A sturdy steel sword',
    materials: {
      steelIngot: 2,
      woodLog: 1
    },
    result: {
      id: 'craftedSteelSword',
      name: 'Steel Sword',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'uncommon',
      stats: { attack: 10 }
    },
    requiredLevel: 5
  },
  
  mithrilBlade: {
    id: 'mithrilBlade',
    name: 'Mithril Blade',
    type: 'weapon',
    description: 'A legendary mithril blade',
    materials: {
      mithrilOre: 3,
      mysticEssence: 2,
      steelIngot: 1
    },
    result: {
      id: 'craftedMithrilBlade',
      name: 'Mithril Blade',
      type: 'weapon',
      slot: 'weapon',
      rarity: 'rare',
      stats: { attack: 20, magic: 5 }
    },
    requiredLevel: 10
  },
  
  // Armor Recipes
  leatherArmor: {
    id: 'leatherArmor',
    name: 'Leather Armor',
    type: 'armor',
    description: 'Basic leather armor',
    materials: {
      leather: 4,
      cloth: 2
    },
    result: {
      id: 'craftedLeatherArmor',
      name: 'Leather Armor',
      type: 'armor',
      slot: 'armor',
      rarity: 'common',
      stats: { armor: 3 }
    },
    requiredLevel: 1
  },
  
  reinforcedArmor: {
    id: 'reinforcedArmor',
    name: 'Reinforced Armor',
    type: 'armor',
    description: 'Reinforced leather armor',
    materials: {
      hardenedLeather: 3,
      steelIngot: 1
    },
    result: {
      id: 'craftedReinforcedArmor',
      name: 'Reinforced Armor',
      type: 'armor',
      slot: 'armor',
      rarity: 'uncommon',
      stats: { armor: 8 }
    },
    requiredLevel: 5
  },
  
  dragonscaleArmor: {
    id: 'dragonscaleArmor',
    name: 'Dragonscale Armor',
    type: 'armor',
    description: 'Armor made from dragon scales',
    materials: {
      dragonScale: 3,
      hardenedLeather: 2,
      mysticEssence: 1
    },
    result: {
      id: 'craftedDragonscaleArmor',
      name: 'Dragonscale Armor',
      type: 'armor',
      slot: 'armor',
      rarity: 'rare',
      stats: { armor: 15, fireResist: 20 }
    },
    requiredLevel: 12
  },
  
  // Material Processing Recipes
  steelIngotRecipe: {
    id: 'steelIngotRecipe',
    name: 'Steel Ingot',
    type: 'material',
    description: 'Refine iron ore into steel',
    materials: {
      ironOre: 3
    },
    result: craftingMaterials.steelIngot,
    requiredLevel: 3
  },
  
  hardenedLeatherRecipe: {
    id: 'hardenedLeatherRecipe',
    name: 'Hardened Leather',
    type: 'material',
    description: 'Harden leather for better armor',
    materials: {
      leather: 2,
      ironOre: 1
    },
    result: craftingMaterials.hardenedLeather,
    requiredLevel: 3
  },
  
  // Potion Recipes
  healingPotion: {
    id: 'healingPotion',
    name: 'Healing Potion',
    type: 'consumable',
    description: 'Craft a healing potion',
    materials: {
      mysticEssence: 1,
      cloth: 1
    },
    result: {
      id: 'craftedHealingPotion',
      name: 'Healing Potion',
      type: 'consumable',
      rarity: 'common',
      effect: 'restoreHP',
      value: 50
    },
    requiredLevel: 2
  }
};

/**
 * Enchantment Recipes
 */
export const enchantmentRecipes = {
  fireEnchant: {
    id: 'fireEnchant',
    name: 'Fire Enchantment',
    description: 'Add fire damage to a weapon',
    materials: {
      mysticEssence: 2,
      enchantedCrystal: 1
    },
    bonus: { fireDamage: 10 },
    requiredLevel: 5
  },
  
  armorEnchant: {
    id: 'armorEnchant',
    name: 'Protection Enchantment',
    description: 'Increase armor value',
    materials: {
      mysticEssence: 2,
      steelIngot: 1
    },
    bonus: { armor: 5 },
    requiredLevel: 5
  },
  
  lifeStealEnchant: {
    id: 'lifeStealEnchant',
    name: 'Life Steal Enchantment',
    description: 'Add life steal to a weapon',
    materials: {
      voidEssence: 1,
      mysticEssence: 2
    },
    bonus: { lifesteal: 5 },
    requiredLevel: 8
  }
};

/**
 * Get all crafting recipes
 */
export function getAllRecipes() {
  return Object.values(craftingRecipes);
}

/**
 * Get all crafting materials
 */
export function getAllMaterials() {
  return Object.values(craftingMaterials);
}

/**
 * Get recipes by type
 */
export function getRecipesByType(type) {
  return Object.values(craftingRecipes).filter(r => r.type === type);
}

/**
 * Check if player can craft a recipe
 */
export function canCraft(recipe, playerLevel, playerMaterials) {
  // Check level requirement
  if (playerLevel < recipe.requiredLevel) {
    return { canCraft: false, reason: 'Level too low' };
  }
  
  // Check materials
  for (const [materialId, required] of Object.entries(recipe.materials)) {
    const available = playerMaterials[materialId] || 0;
    if (available < required) {
      return { 
        canCraft: false, 
        reason: `Not enough ${craftingMaterials[materialId]?.name || materialId}` 
      };
    }
  }
  
  return { canCraft: true };
}
