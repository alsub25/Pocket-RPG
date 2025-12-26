import { CHANGELOG } from "./Changelog/changelog.js";
import { openGambleModalImpl } from "./Locations/Village/tavernGames.js";
import {
  initTimeState,
  getTimeInfo,
  formatTimeShort,
  formatTimeLong,
  advanceTime,
  jumpToNextMorning
} from "./Systems/timeSystem.js";

import {
  initVillageEconomyState,
  getVillageEconomySummary,
  getMerchantPrice,
  getRestCost,
  handleEconomyDayTick,
  handleEconomyAfterBattle,
  handleEconomyAfterPurchase
} from "./Locations/Village/villageEconomy.js";
import {
  initGovernmentState,
  handleGovernmentDayTick,
  getGovernmentSummary,
  getVillageGovernmentEffect
} from "./Systems/kingdomGovernment.js";
import { openBankModalImpl } from "./Locations/Village/bank.js";
import { openTavernModalImpl } from "./Locations/Village/tavern.js"; // ⬅️ NEW
import { openMerchantModalImpl } from "./Locations/Village/merchant.js"; // ⬅️ NEW
import { openTownHallModalImpl, handleTownHallDayTick } from "./Locations/Village/townHall.js";
import {
  ensureVillagePopulation,
  handlePopulationDayTick
} from "./Locations/Village/villagePopulation.js";
// --- GAME DATA -----------------------------------------------------------------
const GAME_PATCH = '0.6.0'; // ← put your current patch/version here
  const DIFFICULTY_CONFIG = {
  easy: {
    id: 'easy',
    name: 'Easy',
    enemyHpMod: 0.85,
    enemyDmgMod: 0.8,
    playerDmgMod: 1.1,
    aiSmartness: 0.5
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    enemyHpMod: 1,
    enemyDmgMod: 1,
    playerDmgMod: 1,
    aiSmartness: 0.7
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    enemyHpMod: 1.3,
    enemyDmgMod: 1.25,
    playerDmgMod: 0.95,
    aiSmartness: 0.95
  },
  dynamic: {
    id: 'dynamic',
    name: 'Dynamic',
    enemyHpMod: 1,
    enemyDmgMod: 1,
    playerDmgMod: 1,
    aiSmartness: 0.8
  }
};

function getActiveDifficultyConfig() {
	// Before state exists, just use Normal
	if (typeof state === 'undefined' || !state) {
    return DIFFICULTY_CONFIG.normal;
	}
	
	const normalBase = DIFFICULTY_CONFIG.normal;
	const raw = DIFFICULTY_CONFIG[state.difficulty] || normalBase;
	
	// Non-dynamic difficulties use their static config
	if (state.difficulty !== 'dynamic') {
    return raw;
	}
	
	// Ensure dynamicDifficulty exists
	if (!state.dynamicDifficulty) {
    state.dynamicDifficulty = {
	band: 0,
	tooEasyStreak: 0,
	struggleStreak: 0
    };
	}
	
	const bandRaw = state.dynamicDifficulty.band || 0;
	const band = Math.max(-2, Math.min(2, bandRaw)); // clamp -2..+2
	
	// Each band step nudges difficulty up/down from Normal
	const stepHp = 0.2;         // enemy HP +20% per band up
	const stepEnemyDmg = 0.2;   // enemy damage +20% per band up
	const stepPlayerDmg = -0.1; // player damage -10% per band up
	const stepAi = 0.15;        // smarter AI per band up
	
	const enemyHpMod = normalBase.enemyHpMod * (1 + stepHp * band);
	const enemyDmgMod = normalBase.enemyDmgMod * (1 + stepEnemyDmg * band);
	const playerDmgMod = normalBase.playerDmgMod * (1 + stepPlayerDmg * band);
	const aiSmartness = Math.max(
    0.35,
    Math.min(0.98, normalBase.aiSmartness + stepAi * band)
	);
	
	// --- figure out which fixed difficulty we're closest to ------------------
	const baseIds = ['easy', 'normal', 'hard'];
	let closestId = 'normal';
	let closestScore = Infinity;
	
	for (const id of baseIds) {
    const base = DIFFICULTY_CONFIG[id];
    if (!base) continue;
	
    const dHp = enemyHpMod - base.enemyHpMod;
    const dEnemyDmg = enemyDmgMod - base.enemyDmgMod;
    const dPlayerDmg = playerDmgMod - base.playerDmgMod;
    const dAi = aiSmartness - base.aiSmartness;
	
    // simple squared-distance in modifier space
    const score =
	dHp * dHp +
	dEnemyDmg * dEnemyDmg +
	dPlayerDmg * dPlayerDmg +
	dAi * dAi;
	
    if (score < closestScore) {
	closestScore = score;
	closestId = id;
    }
	}
	
	const closestName = DIFFICULTY_CONFIG[closestId].name;
	const label = `Dynamic (${closestName})`;
	
	return {
    id: 'dynamic',
    name: label,
    enemyHpMod,
    enemyDmgMod,
    playerDmgMod,
    aiSmartness
	};
}
  const PLAYER_CLASSES = {
  mage: {
    id: 'mage',
    name: 'Mage',
    desc: 'Fragile spellcaster with high burst damage. Uses Mana.',
    resourceKey: 'mana',
    resourceName: 'Mana',
    baseStats: { maxHp: 80, attack: 6, magic: 16, armor: 2, speed: 10 },
    startingSpells: ['fireball', 'iceShard', 'arcaneShield']
  },
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    desc: 'Durable frontline fighter. Builds Fury when hit or attacking.',
    resourceKey: 'fury',
    resourceName: 'Fury',
    baseStats: { maxHp: 120, attack: 14, magic: 4, armor: 6, speed: 8 },
    startingSpells: ['powerStrike', 'battleCry', 'shieldWall']
  },
  blood: {
    id: 'blood',
    name: 'Blood Knight',
    desc: 'Risks health for brutal abilities. Uses Blood as resource.',
    resourceKey: 'blood',
    resourceName: 'Blood',
    baseStats: { maxHp: 100, attack: 12, magic: 8, armor: 4, speed: 9 },
    startingSpells: ['bloodSlash', 'leech', 'hemorrhage']
  },

  // 1) RANGER – uses Fury (adrenaline)
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    desc: 'Swift ranged fighter who bleeds and kites foes. Uses Fury.',
    resourceKey: 'fury',
    resourceName: 'Fury',
    baseStats: { maxHp: 95, attack: 13, magic: 5, armor: 4, speed: 12 },
    startingSpells: ['piercingShot', 'twinArrows', 'markedPrey']
  },

  // 2) PALADIN – uses Mana (holy power)
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    desc: 'Holy warrior mixing sturdy defense with healing. Uses Mana.',
    resourceKey: 'mana',
    resourceName: 'Mana',
    baseStats: { maxHp: 130, attack: 11, magic: 9, armor: 8, speed: 7 },
    startingSpells: ['holyStrike', 'blessingLight', 'retributionAura']
  },

  // 3) ROGUE – uses Fury (combo-like resource)
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    desc: 'High-crit skirmisher relying on burst and poisons. Uses Fury.',
    resourceKey: 'fury',
    resourceName: 'Fury',
    baseStats: { maxHp: 85, attack: 15, magic: 3, armor: 3, speed: 13 },
    startingSpells: ['backstab', 'poisonedBlade', 'shadowstep']
  },

  // 4) CLERIC – uses Mana
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    desc: 'Support caster specializing in healing and cleansing. Uses Mana.',
    resourceKey: 'mana',
    resourceName: 'Mana',
    baseStats: { maxHp: 100, attack: 7, magic: 14, armor: 3, speed: 8 },
    startingSpells: ['holyHeal', 'smite', 'purify']
  },

  // 5) NECROMANCER – uses Mana
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    desc: 'Dark mage that drains life and calls skeletal allies. Uses Mana.',
    resourceKey: 'mana',
    resourceName: 'Mana',
    baseStats: { maxHp: 80, attack: 5, magic: 17, armor: 2, speed: 8 },
    startingSpells: ['soulBolt', 'raiseBones', 'decay']
  },

  // 6) SHAMAN – uses Mana
  shaman: {
    id: 'shaman',
    name: 'Shaman',
    desc: 'Hybrid caster channeling storm and earth. Uses Mana.',
    resourceKey: 'mana',
    resourceName: 'Mana',
    baseStats: { maxHp: 105, attack: 10, magic: 10, armor: 5, speed: 9 },
    startingSpells: ['lightningLash', 'earthskin', 'spiritHowl']
  },

  // 7) BERSERKER – uses Fury
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    desc: 'Reckless bruiser who grows stronger as they bleed. Uses Fury.',
    resourceKey: 'fury',
    resourceName: 'Fury',
    baseStats: { maxHp: 130, attack: 17, magic: 2, armor: 5, speed: 9 },
    startingSpells: ['frenziedBlow', 'warCryBerserker', 'bloodlustRage']
  },

  // 8) VAMPIRE – uses Essence (its own special mana type)
  vampire: {
    id: 'vampire',
    name: 'Vampire',
    desc: 'Night-stalking caster that steals Essence from foes.',
    resourceKey: 'essence',
    resourceName: 'Essence',
    baseStats: { maxHp: 95, attack: 9, magic: 14, armor: 3, speed: 11 },
    startingSpells: ['essenceDrain', 'batSwarm', 'shadowVeil']
  }
};
  // Starting skill distribution per class
const CLASS_STARTING_SKILLS = {
  mage: { strength: 0, endurance: 1, willpower: 3 },
  warrior: { strength: 3, endurance: 3, willpower: 0 },
  blood: { strength: 2, endurance: 2, willpower: 1 },
  ranger: { strength: 2, endurance: 1, willpower: 1 },
  paladin: { strength: 2, endurance: 2, willpower: 1 },
  rogue: { strength: 2, endurance: 1, willpower: 1 },
  cleric: { strength: 0, endurance: 2, willpower: 2 },
  necromancer: { strength: 0, endurance: 1, willpower: 3 },
  shaman: { strength: 1, endurance: 2, willpower: 2 },
  berserker: { strength: 3, endurance: 2, willpower: 0 },

  // NEW
  vampire: { strength: 1, endurance: 1, willpower: 2 },

  // fallback
  default: { strength: 1, endurance: 1, willpower: 1 }
};
  const ABILITIES = {
    // MAGE
    fireball: {
      id: 'fireball',
      name: 'Fireball',
      classId: 'mage',
      cost: { mana: 20 },
      note: 'A scorching projectile that deals heavy fire damage.'
    },
    iceShard: {
      id: 'iceShard',
      name: 'Ice Shard',
      classId: 'mage',
      cost: { mana: 15 },
      note: 'Moderate damage with a slight chill. In Hard, AI assumes you slow it.'
    },
    arcaneShield: {
      id: 'arcaneShield',
      name: 'Arcane Shield',
      classId: 'mage',
      cost: { mana: 18 },
      note: 'Summon a barrier that absorbs damage this fight.'
    },

    // WARRIOR
    powerStrike: {
      id: 'powerStrike',
      name: 'Power Strike',
      classId: 'warrior',
      cost: { fury: 25 },
      note: 'Consume Fury for a crushing blow.'
    },
    battleCry: {
      id: 'battleCry',
      name: 'Battle Cry',
      classId: 'warrior',
      cost: { fury: 15 },
      note: 'Boost attack and generate extra Fury.'
    },
    shieldWall: {
      id: 'shieldWall',
      name: 'Shield Wall',
      classId: 'warrior',
      cost: { fury: 20 },
      note: 'Greatly reduce incoming damage for a short time.'
    },

    // BLOOD KNIGHT
    bloodSlash: {
      id: 'bloodSlash',
      name: 'Blood Slash',
      classId: 'blood',
      cost: { hp: 10 },
      note: 'Convert your own blood into a vicious strike.'
    },
    leech: {
      id: 'leech',
      name: 'Leech',
      classId: 'blood',
      cost: { blood: 15 },
      note: 'Drain life from the enemy and heal yourself.'
    },
    hemorrhage: {
      id: 'hemorrhage',
      name: 'Hemorrhage',
      classId: 'blood',
      cost: { blood: 20 },
      note: 'Inflict a lingering wound that bleeds over time.'
    },
	  // RANGER
  piercingShot: {
    id: 'piercingShot',
    name: 'Piercing Shot',
    classId: 'ranger',
    cost: { fury: 20 },
    note: 'A powerful arrow that punches straight through defenses.'
  },
  twinArrows: {
    id: 'twinArrows',
    name: 'Twin Arrows',
    classId: 'ranger',
    cost: { fury: 25 },
    note: 'Loose two rapid shots in succession.'
  },
  markedPrey: {
    id: 'markedPrey',
    name: 'Marked Prey',
    classId: 'ranger',
    cost: { fury: 15 },
    note: 'Harm your foe and leave them bleeding from precise hits.'
  },

  // PALADIN
  holyStrike: {
    id: 'holyStrike',
    name: 'Holy Strike',
    classId: 'paladin',
    cost: { mana: 15 },
    note: 'Smite the target with a sanctified blow, stronger against wounded foes.'
  },
  blessingLight: {
    id: 'blessingLight',
    name: 'Blessing of Light',
    classId: 'paladin',
    cost: { mana: 20 },
    note: 'Mend your wounds and conjure a small protective shield.'
  },
  retributionAura: {
    id: 'retributionAura',
    name: 'Retribution Aura',
    classId: 'paladin',
    cost: { mana: 18 },
    note: 'Empower your strikes and harden your resolve for a short time.'
  },

  // ROGUE
  backstab: {
    id: 'backstab',
    name: 'Backstab',
    classId: 'rogue',
    cost: { fury: 18 },
    note: 'A vicious strike that is deadliest when the fight has just begun.'
  },
  poisonedBlade: {
    id: 'poisonedBlade',
    name: 'Poisoned Blade',
    classId: 'rogue',
    cost: { fury: 20 },
    note: 'Slash your foe and inflict a lingering poison.'
  },
  shadowstep: {
    id: 'shadowstep',
    name: 'Shadowstep',
    classId: 'rogue',
    cost: { fury: 12 },
    note: 'Slip through the shadows, repositioning and sharpening your next attack.'
  },

  // CLERIC
  holyHeal: {
    id: 'holyHeal',
    name: 'Holy Heal',
    classId: 'cleric',
    cost: { mana: 22 },
    note: 'Call down gentle light to restore your vitality.'
  },
  smite: {
    id: 'smite',
    name: 'Smite',
    classId: 'cleric',
    cost: { mana: 14 },
    note: 'A focused bolt of radiant power.'
  },
  purify: {
    id: 'purify',
    name: 'Purify',
    classId: 'cleric',
    cost: { mana: 16 },
    note: 'Cleanse yourself of bleeding and bolster your defenses.'
  },

  // NECROMANCER
  soulBolt: {
    id: 'soulBolt',
    name: 'Soul Bolt',
    classId: 'necromancer',
    cost: { mana: 16 },
    note: 'Fire a shard of stolen essence that harms your foe and feeds you.'
  },
  raiseBones: {
    id: 'raiseBones',
    name: 'Raise Bones',
    classId: 'necromancer',
    cost: { mana: 24 },
    note: 'Summon a skeletal companion to fight at your side.'
  },
  decay: {
    id: 'decay',
    name: 'Decay',
    classId: 'necromancer',
    cost: { mana: 20 },
    note: 'Rot your enemy from within with a stacking, bleeding rot.'
  },

  // SHAMAN
  lightningLash: {
    id: 'lightningLash',
    name: 'Lightning Lash',
    classId: 'shaman',
    cost: { mana: 18 },
    note: 'Crackling lightning scorches your foe with unpredictable force.'
  },
  earthskin: {
    id: 'earthskin',
    name: 'Earthskin',
    classId: 'shaman',
    cost: { mana: 16 },
    note: 'Stone-hard skin dampens incoming blows for a short while.'
  },
  spiritHowl: {
    id: 'spiritHowl',
    name: 'Spirit Howl',
    classId: 'shaman',
    cost: { mana: 20 },
    note: 'Let out a primal call that empowers your companion.'
  },
  // VAMPIRE
  essenceDrain: {
    id: 'essenceDrain',
    name: 'Essence Drain',
    classId: 'vampire',
    cost: { essence: 20 },
    note: 'Rip life from your foe, healing yourself and refilling Essence.'
  },
  batSwarm: {
    id: 'batSwarm',
    name: 'Bat Swarm',
    classId: 'vampire',
    cost: { essence: 25 },
    note: 'Unleash a swarm of spectral bats that ravage and bleed the target.'
  },
  shadowVeil: {
    id: 'shadowVeil',
    name: 'Shadow Veil',
    classId: 'vampire',
    cost: { essence: 18 },
    note: 'Shroud yourself in darkness to reduce damage taken for a short time.'
  },



  // BERSERKER
  frenziedBlow: {
    id: 'frenziedBlow',
    name: 'Frenzied Blow',
    classId: 'berserker',
    cost: { fury: 25 },
    note: 'A reckless swing that grows stronger the more wounded you are.'
  },
  warCryBerserker: {
    id: 'warCryBerserker',
    name: 'War Cry',
    classId: 'berserker',
    cost: { fury: 18 },
    note: 'Roar yourself into a frenzy, restoring some vitality and power.'
  },
  bloodlustRage: {
    id: 'bloodlustRage',
    name: 'Bloodlust',
    classId: 'berserker',
    cost: { fury: 15 },
    note: 'Succumb to rage, surging with Fury and attack strength.'
  }
  };

  const ITEM_DEFS = {
    potionSmall: {
      id: 'potionSmall',
      name: 'Minor Healing Potion',
      type: 'potion',
      hpRestore: 40,
      price: 18,
      desc: 'Restore 40 HP.'
    },
    potionMana: {
      id: 'potionMana',
      name: 'Small Mana Potion',
      type: 'potion',
      resourceKey: 'mana',
      resourceRestore: 35,
      price: 20,
      desc: 'Restore 35 Mana.'
    },
    potionFury: {
      id: 'furyDraft',
      name: 'Draft of Rage',
      type: 'potion',
      resourceKey: 'fury',
      resourceRestore: 40,
      price: 22,
      desc: 'Instantly generate 40 Fury.'
    },
	potionEssence: {
      id: 'essenceVial',
      name: 'Shadowed Essence Vial',
      type: 'potion',
      resourceKey: 'essence',
      resourceRestore: 30,
      price: 24,
      desc: 'Distilled soul energy that restores 30 Essence.'
    },
    potionBlood: {
      id: 'bloodVial',
      name: 'Crimson Vial',
      type: 'potion',
      resourceKey: 'blood',
      resourceRestore: 30,
      price: 22,
      desc: 'Condensed blood to fuel your arts.'
    },
    swordIron: {
      id: 'swordIron',
      name: 'Iron Longsword',
      type: 'weapon',
      attackBonus: 6,
      price: 45,
      desc: '+6 Attack. Favored by warriors.'
    },
    staffOak: {
      id: 'staffOak',
      name: 'Runed Oak Staff',
      type: 'weapon',
      magicBonus: 5,
      price: 45,
      desc: '+5 Magic. Smooth channeling for spellcasters.'
    },
    bladeSanguine: {
      id: 'bladeSanguine',
      name: 'Sanguine Edge',
      type: 'weapon',
      attackBonus: 4,
      magicBonus: 3,
      price: 60,
      desc: '+4 Attack, +3 Magic. Whispers for blood.'
    },
    armorLeather: {
      id: 'armorLeather',
      name: 'Hardened Leather',
      type: 'armor',
      armorBonus: 4,
      price: 40,
      desc: '+4 Armor. Basic but reliable.'
    },
    robeApprentice: {
      id: 'robeApprentice',
      name: 'Apprentice Robe',
      type: 'armor',
      armorBonus: 2,
      maxResourceBonus: 20,
      price: 40,
      desc: '+2 Armor, +20 Mana.'
    }
  };
  const ENEMY_TEMPLATES = {
    wolf: {
      id: 'wolf',
      name: 'Forest Wolf',
      maxHp: 45,
      attack: 8,
      magic: 0,
      armor: 1,
      xp: 16,
      goldMin: 6,
      goldMax: 12,
      isBoss: false,
      behavior: 'aggressive'
    },
    goblin: {
      id: 'goblin',
      name: 'Goblin Raider',
      maxHp: 60,
      attack: 10,
      magic: 0,
      armor: 2,
      xp: 22,
      goldMin: 8,
      goldMax: 18,
      isBoss: false,
      behavior: 'cunning'
    },
    goblinBoss: {
      id: 'goblinBoss',
      name: 'Goblin Warlord',
      maxHp: 130,
      attack: 16,
      magic: 0,
      armor: 4,
      xp: 60,
      goldMin: 40,
      goldMax: 65,
      isBoss: true,
      behavior: 'bossGoblin'
    },
    voidSpawn: {
      id: 'voidSpawn',
      name: 'Voidspawn',
      maxHp: 85,
      attack: 10,
      magic: 8,
      armor: 3,
      xp: 35,
      goldMin: 12,
      goldMax: 25,
      isBoss: false,
      behavior: 'caster'
    },
    dragon: {
      id: 'dragon',
      name: 'Void-Touched Dragon',
      maxHp: 220,
      attack: 22,
      magic: 15,
      armor: 6,
      xp: 120,
      goldMin: 80,
      goldMax: 140,
      isBoss: true,
      behavior: 'bossDragon'
	  
    }
  };

  const RANDOM_ENCOUNTERS = {
    village: [],
    forest: ['wolf', 'goblin'],
    ruins: ['voidSpawn']
  };

// --- COMPANIONS ---------------------------------------------------------------

const COMPANION_DEFS = {
    wolf: {
    id: 'wolf',
    name: 'Ember Wolf',
    role: 'DPS',
    description: 'A loyal hunter that tears into enemies.',
    baseAttack: 10,
    baseHpBonus: 0,
    behavior: 'aggressive',
    abilities:['pounce', 'ripAndTear', 'howlOfFury', 'savageBleed']
	},
	golem: {
    id: 'golem',
    name: 'Stone Golem',
    role: 'Tank',
    description: 'A sturdy construct that shields you from harm.',
    baseAttack: 6,
    baseHpBonus: 20,
    behavior: 'protective',
    abilities: ['guardSmash', 'seismicStomp', 'ironResolve', 'pulverize']
	},
	sprite: {
    id: 'sprite',
    name: 'Moonlit Sprite',
    role: 'Healer',
    description: 'A tiny spirit that mends your wounds.',
    baseAttack: 4,
    baseHpBonus: 0,
    behavior: 'healer',
    abilities: ['gulfHeal', 'soothingBreeze', 'restorativeChorus', 'lullaby']
	},
	skeleton: {
    id: 'skeleton',
    name: 'Bound Skeleton',
    role: 'Bleed',
    description: 'A reanimated warrior that inflicts bleeding wounds.',
    baseAttack: 8,
    baseHpBonus: 0,
    behavior: 'bleeder',
    abilities: ['enfeebleStrike', 'boneCrush', 'marrowDrain', 'plaguedBlade']
	},
	falcon: {
    id: 'falcon',
    name: 'Skyhunter Falcon',
    role: 'Ranged',
    description: 'A swift predator that harasses foes from above, often causing bleeding strikes.',
    baseAttack: 9,
    baseHpBonus: 0,
    behavior: 'ranged',
    abilities: ['talonVolley', 'skyDive', 'pinningStrike', 'scoutingCry']
	},
	treant: {
    id: 'treant',
    name: 'Ancient Treant',
    role: 'support-tank',
    description: 'A walking tree that shields you and slowly restores your vitality.',
    baseAttack: 6,
    baseHpBonus: 25,
    behavior: 'guardian',
    abilities:['rootWard', 'regenerativeBark', 'entanglingRoots', 'oakMight']
	},
	familiar: {
    id: 'familiar',
    name: 'Arcane Familiar',
    role: 'Battery',
    description: 'A floating mote of magic that replenishes your combat resources.',
    baseAttack: 5,
    baseHpBonus: 0,
    behavior: 'battery',
    abilities: ['overcharge', 'manaConduit', 'arcaneBarrage', 'tetheredWard']
	},
	mimic: {
    id: 'mimic',
    name: 'Shadow Mimic',
    role: 'Mimic',
    description: 'A copy of your fighting spirit that mirrors your power in attacks.',
    baseAttack: 8,
    baseHpBonus: 0,
    behavior: 'mimic',
    abilities: ['mirrorBurst', 'echoStrike', 'shadowLatch', 'mimicSurge']
	}
};

// --- COMPANION ABILITIES ---------------------------------------------------
// Abilities are cooldown-driven; companion AI will consult these and use them when sensible.
const COMPANION_ABILITIES = {
  // WOLF
  pounce: {
    id: 'pounce',
    name: 'Pounce',
    desc: 'A heavy leap that deals high physical damage and briefly stuns the target.',
    cooldown: 3,      // turns
    type: 'damage',
    potency: 1.6,
    stunTurns: 1
  },
  // GOLEM
  guardSmash: {
    id: 'guardSmash',
    name: 'Guard Smash',
    desc: 'Smashes the ground, dealing damage and granting a shield to the player.',
    cooldown: 4,
    type: 'shield+damage',
    potency: 1.1,
    shieldBase: 18
  },
  // SPRITE
  gulfHeal: {
    id: 'gulfHeal',
    name: 'Gulf Heal',
    desc: 'Large single-target heal for the player (stronger when player is low).',
    cooldown: 4,
    type: 'heal',
    potency: 0.35
  },
  // SKELETON
  enfeebleStrike: {
    id: 'enfeebleStrike',
    name: 'Enfeeble Strike',
    desc: 'Deal damage and reduce enemy attack for a few turns.',
    cooldown: 3,
    type: 'damage+debuff',
    potency: 1.0,
    atkDown: 3,
    debuffTurns: 2
  },
  // FALCON
  talonVolley: {
    id: 'talonVolley',
    name: 'Talon Volley',
    desc: 'Rapid strafing strike with high crit chance (simulated by extra random spike).',
    cooldown: 3,
    type: 'damage',
    potency: 1.2,
    critSpike: 0.45
  },
  // TREANT
  rootWard: {
    id: 'rootWard',
    name: 'Root Ward',
    desc: 'Place a ward that heals the player a bit each turn and blocks one enemy heavy action when present.',
    cooldown: 6,
    type: 'ward',
    potency: 0.08,
    wardTurns: 3
  },
  // FAMILIAR
  overcharge: {
    id: 'overcharge',
    name: 'Overcharge',
    desc: 'Restore a large chunk of the player resource and empower next player spell (simple buff).',
    cooldown: 5,
    type: 'resource',
    potency: 0.4,
    buffTurns: 1
  },
  // MIMIC
  mirrorBurst: {
    id: 'mirrorBurst',
    name: 'Mirror Burst',
    desc: 'Reflects a portion of next incoming damage back to the attacker for a short time and deals burst damage now.',
    cooldown: 5,
    type: 'damage+reflect',
    potency: 1.0,
    reflectTurns: 2,
    reflectPct: 0.35
  },
    // --- Additional companion abilities (3 per companion) --------------------
  // WOLF extras
  ripAndTear: {
    id: 'ripAndTear',
    name: 'Rip & Tear',
    desc: 'A vicious tearing combo that deals two quick hits (simulated as a single stronger strike).',
    cooldown: 3,
    type: 'damage',
    potency: 1.9
  },
  howlOfFury: {
    id: 'howlOfFury',
    name: 'Howl of Fury',
    desc: 'A rallying howl that temporarily increases companion damage and slightly boosts player attack for 2 turns.',
    cooldown: 5,
    type: 'damage',
    potency: 1.0,
    buffTurns: 2,
    // note: we store buff marker on comp to let AI score it; actual buff application can be a simple p.status flag
  },
  savageBleed: {
    id: 'savageBleed',
    name: 'Savage Bleed',
    desc: 'A brutal strike that deals damage and applies a bleed (DoT) for a few turns.',
    cooldown: 4,
    type: 'damage+debuff',
    potency: 1.05,
    atkDown: 0,
    debuffTurns: 3,
    // reuse enemy.bleedTurns/bleedDamage semantics in useCompanionAbility
  },

  // GOLEM extras
  seismicStomp: {
    id: 'seismicStomp',
    name: 'Seismic Stomp',
    desc: 'Heavy area stomp that deals damage and briefly lowers enemy speed/agility (simulated as reduced crit chance).',
    cooldown: 5,
    type: 'damage',
    potency: 1.4
  },
  ironResolve: {
    id: 'ironResolve',
    name: 'Iron Resolve',
    desc: 'Fortifies the player: large temporary shield plus small armor buff for 3 turns.',
    cooldown: 6,
    type: 'shield+damage',
    potency: 0.7,
    shieldBase: 28
  },
  pulverize: {
    id: 'pulverize',
    name: 'Pulverize',
    desc: 'A devastating smash that deals heavy damage and reduces enemy armor for a few turns.',
    cooldown: 6,
    type: 'damage+debuff',
    potency: 1.6,
    atkDown: 0,
    debuffTurns: 3
  },

  // SPRITE extras
  soothingBreeze: {
    id: 'soothingBreeze',
    name: 'Soothing Breeze',
    desc: 'Small immediate heal plus a mild heal-over-time for 3 turns.',
    cooldown: 3,
    type: 'heal',
    potency: 0.18
  },
  restorativeChorus: {
    id: 'restorativeChorus',
    name: 'Restorative Chorus',
    desc: 'Medium heal and grants a small resource restore to the player.',
    cooldown: 5,
    type: 'heal',
    potency: 0.25
  },
  lullaby: {
    id: 'lullaby',
    name: 'Lullaby',
    desc: 'Soothes the enemy, reducing their damage output for a couple turns (debuff).',
    cooldown: 4,
    type: 'damage+debuff',
    potency: 0.6,
    atkDown: 4,
    debuffTurns: 2
  },

  // SKELETON extras
  boneCrush: {
    id: 'boneCrush',
    name: 'Bone Crush',
    desc: 'Heavy single-target physical blow that has a small chance to stun.',
    cooldown: 4,
    type: 'damage',
    potency: 1.35,
    stunChance: 0.18
  },
  marrowDrain: {
    id: 'marrowDrain',
    name: 'Marrow Drain',
    desc: 'Deals moderate damage and transfers a small heal to the companion (self-sustain).',
    cooldown: 4,
    type: 'damage',
    potency: 0.95
  },
  plaguedBlade: {
    id: 'plaguedBlade',
    name: 'Plagued Blade',
    desc: 'Deals damage and applies a stacking poison/DoT (use enemy.bleed fields to reuse logic).',
    cooldown: 5,
    type: 'damage+debuff',
    potency: 1.05,
    debuffTurns: 3
  },

  // FALCON extras
  skyDive: {
    id: 'skyDive',
    name: 'Sky Dive',
    desc: 'A high-velocity dive that deals big damage; more likely to trigger a critSpike-like bonus.',
    cooldown: 4,
    type: 'damage',
    potency: 1.6,
    critSpike: 0.35
  },
  pinningStrike: {
    id: 'pinningStrike',
    name: 'Pinning Strike',
    desc: 'Deals damage and pins the enemy briefly, lowering their speed or action frequency (use stunTurns as proxy).',
    cooldown: 4,
    type: 'damage+debuff',
    potency: 1.05,
    atkDown: 0,
    debuffTurns: 2,
    stunTurns: 1
  },
  scoutingCry: {
    id: 'scoutingCry',
    name: 'Scouting Cry',
    desc: 'Marks the enemy, increasing damage taken from player and companion for 2 turns (buff on player/enemy flag).',
    cooldown: 6,
    type: 'damage+debuff',
    potency: 0.4,
    debuffTurns: 2
  },

  // TREANT extras
  regenerativeBark: {
    id: 'regenerativeBark',
    name: 'Regenerative Bark',
    desc: 'Small heal to player each turn for 3 turns (ward-like persistent heal).',
    cooldown: 5,
    type: 'ward',
    potency: 0.06,
    wardTurns: 3
  },
  entanglingRoots: {
    id: 'entanglingRoots',
    name: 'Entangling Roots',
    desc: 'Apply a slow root (simulated as repeated small DoT + reduced enemy actions) for a few turns.',
    cooldown: 5,
    type: 'damage+debuff',
    potency: 0.55,
    debuffTurns: 3
  },
  oakMight: {
    id: 'oakMight',
    name: 'Oak Might',
    desc: 'A supportive slam that grants a medium shield and increases player armor for a few turns.',
    cooldown: 6,
    type: 'shield+damage',
    potency: 0.9,
    shieldBase: 22
  },

  // FAMILIAR extras
  manaConduit: {
    id: 'manaConduit',
    name: 'Mana Conduit',
    desc: 'Restores a sizeable portion of player resource and grants a short spell-power buff.',
    cooldown: 5,
    type: 'resource',
    potency: 0.45,
    buffTurns: 1
  },
  arcaneBarrage: {
    id: 'arcaneBarrage',
    name: 'Arcane Barrage',
    desc: 'Rapid arcane bolts that do repeated small magic damage (simulated as one stronger hit).',
    cooldown: 3,
    type: 'damage',
    potency: 1.15
  },
  tetheredWard: {
    id: 'tetheredWard',
    name: 'Tethered Ward',
    desc: 'Places a ward that heals player slightly each turn and absorbs a small amount of damage.',
    cooldown: 6,
    type: 'ward',
    potency: 0.05,
    wardTurns: 3
  },

  // MIMIC extras
  echoStrike: {
    id: 'echoStrike',
    name: 'Echo Strike',
    desc: 'Copies the last player action style and deals damage accordingly.',
    cooldown: 4,
    type: 'damage',
    potency: 1.2
  },
  shadowLatch: {
    id: 'shadowLatch',
    name: 'Shadow Latch',
    desc: 'Binds to the enemy: reduces enemy healing and increases damage taken for a few turns.',
    cooldown: 5,
    type: 'damage+debuff',
    potency: 0.6,
    debuffTurns: 3
  },
  mimicSurge: {
    id: 'mimicSurge',
    name: 'Mimic Surge',
    desc: 'A burst that scales off the player\'s last damage and attempts to secure a kill.',
    cooldown: 6,
    type: 'damage',
    potency: 1.8
  }
};

  // --- STATE ---------------------------------------------------------------------

  function createEmptyState() {
  // Settings are global (not tied to a save slot). Keep them in localStorage so
  // sliders actually affect the game and persist between runs.
  let savedVolume = 80;     // matches the HTML default
  let savedTextSpeed = 100; // matches the HTML default
  let savedMusicEnabled = true;
  let savedSfxEnabled = true;
  try {
    const v = Number(localStorage.getItem('pq-master-volume'));
    if (!isNaN(v)) savedVolume = Math.max(0, Math.min(100, v));

    const t = Number(localStorage.getItem('pq-text-speed'));
    if (!isNaN(t)) savedTextSpeed = Math.max(30, Math.min(200, t));

    const m = localStorage.getItem('pq-music-enabled');
    if (m !== null) savedMusicEnabled = (m === '1' || m === 'true');
    const s = localStorage.getItem('pq-sfx-enabled');
    if (s !== null) savedSfxEnabled = (s === '1' || s === 'true');
  } catch (e) {
    // ignore storage errors (private mode, etc.)
  }

  return {
    player: null,
    area: 'village', // village, forest, ruins
    difficulty: 'normal',

    // Global settings (persisted in localStorage)
    settingsVolume: savedVolume,      // 0-100
    settingsTextSpeed: savedTextSpeed, // 0-200 (100 = normal)


    // Audio toggles (persisted in localStorage)
    musicEnabled: savedMusicEnabled,
    sfxEnabled: savedSfxEnabled,


    // dynamic difficulty tracking
    dynamicDifficulty: {
      band: 0,
      tooEasyStreak: 0,
      struggleStreak: 0
    },

    quests: {},
    flags: {
      metElder: false,
      goblinBossDefeated: false,
      dragonDefeated: false,
      godMode: false,
      alwaysCrit: false,

      // NEW: only show the “villagers whisper about goblins” flavor once
      goblinWhisperShown: false,

      // NEW: gate the Cheat menu behind a dev toggle
      devCheatsEnabled: false
    },
    inCombat: false,
    currentEnemy: null,
    log: [],
    logFilter: 'all',
    lastSaveJson: null,

    // NEW: world time and village economy state
    time: null,
    villageEconomy: null,
    government: null,
    bank: null,
    villageMerchantNames: null,
    merchantStock: null,

    // NEW: container for village-level state (population, etc.)
    village: null,
	
	
	// Developer-only gambling tuning
    gamblingDebug: {
      mode: 'normal',        // 'normal' | 'playerFavored' | 'houseFavored'
      payoutMultiplier: 1    // 0.5, 1, 2, etc – applied to WIN payouts only
    },


    // One active companion (or null)
    companion: null,

    // Which entity the HUD is currently showing: 'player' or 'companion'
    hudView: 'player',

    // UI-only state (does not affect core combat logic)
    ui: {
      exploreChoiceMade: false
    }
  };
}
// ⬇️ ADD THIS
let state = createEmptyState();

// --- AUDIO / MUSIC ---------------------------------------------------------
// Ambient + SFX controller (one track at a time)
//
// NOTE: On some mobile browsers (notably iOS Safari), HTMLAudioElement.volume
// changes can be ignored. To make the master volume slider reliable, we route
// audio through Web Audio (AudioContext + GainNodes) when available, and fall
// back to element.volume otherwise.

const audioState = {
  initialized: false,
  currentTrack: null,

  // Master volume is controlled by state.settingsVolume (0-100)
  masterVolume: 1, // 0..1

  // Channel toggles (persisted in state/localStorage)
  musicEnabled: true,
  sfxEnabled: true,


  // Per-sound "base" levels (ambience quieter than SFX, etc.)
  baseVolumes: new WeakMap(), // HTMLAudioElement -> baseVol (0..1)

  // Web Audio routing (preferred when available)
  ctx: null,
  masterGain: null,
  musicBusGain: null,
  sfxBusGain: null,
  categories: new WeakMap(), // HTMLAudioElement -> 'music' | 'sfx'
  gains: new WeakMap(), // HTMLAudioElement -> GainNode (base gain)

  interiorOpen: false, // true while inside bank/tavern

  tracks: {},
  sfx: {}
};

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function getMasterVolume01() {
  const v =
    state && typeof state.settingsVolume === "number" ? state.settingsVolume : 100;
  return clamp01(Number(v) / 100);
}

function ensureAudioContext() {
  if (audioState.ctx) return;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  try {
    const ctx = new Ctx();
    audioState.ctx = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = audioState.masterVolume;
    masterGain.connect(ctx.destination);
    audioState.masterGain = masterGain;

    // Channel buses so we can mute/unmute music and SFX without restarting tracks.
    const musicBusGain = ctx.createGain();
    musicBusGain.gain.value = audioState.musicEnabled ? 1 : 0;
    musicBusGain.connect(masterGain);
    audioState.musicBusGain = musicBusGain;

    const sfxBusGain = ctx.createGain();
    sfxBusGain.gain.value = audioState.sfxEnabled ? 1 : 0;
    sfxBusGain.connect(masterGain);
    audioState.sfxBusGain = sfxBusGain;

    // Most browsers start the context suspended until a user gesture.
    // We'll attempt to resume on the next interaction.
    const unlock = () => {
      tryResumeAudioContext();
    };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("touchend", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
  } catch (e) {
    console.warn("Web Audio init failed; falling back to HTMLAudioElement.volume:", e);
    audioState.ctx = null;
    audioState.masterGain = null;
    audioState.musicBusGain = null;
    audioState.sfxBusGain = null;
  }
}

function tryResumeAudioContext() {
  const ctx = audioState.ctx;
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function registerAudio(el, baseVol, category = 'music') {
  const base = clamp01(Number(baseVol));
  audioState.baseVolumes.set(el, base);

  const cat = (category === 'sfx') ? 'sfx' : 'music';
  audioState.categories.set(el, cat);

  // Prefer Web Audio routing so the master volume slider works everywhere.
  ensureAudioContext();

  if (audioState.ctx && audioState.masterGain) {
    try {
      // Each <audio> element can only be wrapped once.
      if (!audioState.gains.has(el)) {
        const src = audioState.ctx.createMediaElementSource(el);
        const gain = audioState.ctx.createGain();
        gain.gain.value = base;

        src.connect(gain);
        const bus = (cat === 'sfx' ? (audioState.sfxBusGain || audioState.masterGain) : (audioState.musicBusGain || audioState.masterGain));
        gain.connect(bus);

        audioState.gains.set(el, gain);
      } else {
        // Keep base volume synced if we ever re-register.
        const g = audioState.gains.get(el);
        if (g) g.gain.value = base;
      }

      // Let Web Audio handle loudness.
      el.volume = 1;
    } catch (e) {
      // Fallback: element volume (may be ignored on iOS)
      el.volume = base * audioState.masterVolume * (cat === 'sfx' ? (audioState.sfxEnabled ? 1 : 0) : (audioState.musicEnabled ? 1 : 0));
    }
  } else {
    // Fallback: element volume
    el.volume = base * audioState.masterVolume * (cat === 'sfx' ? (audioState.sfxEnabled ? 1 : 0) : (audioState.musicEnabled ? 1 : 0));
  }

  return el;
}

function applyMasterVolumeTo(el) {
  if (!el) return;

  const base = audioState.baseVolumes.get(el);
  const gain = audioState.gains.get(el);

  const cat = audioState.categories.get(el) || (Object.values(audioState.sfx).includes(el) ? 'sfx' : 'music');
  const chanEnabled = (cat === 'sfx') ? (audioState.sfxEnabled ? 1 : 0) : (audioState.musicEnabled ? 1 : 0);

  // Web Audio path:
  if (gain && typeof base === "number") {
    gain.gain.value = clamp01(base);     // per-sound base
    el.volume = 1;                       // keep media element at unity
    return;
  }

  // Fallback path:
  if (typeof base === "number") {
    el.volume = clamp01(base) * audioState.masterVolume * chanEnabled;
  }
}

function applyMasterVolumeAll() {
  // Web Audio master:
  if (audioState.masterGain) {
    audioState.masterGain.gain.value = audioState.masterVolume;
  }

  // Keep fallback volumes in sync too:
  Object.values(audioState.tracks).forEach(applyMasterVolumeTo);
  Object.values(audioState.sfx).forEach(applyMasterVolumeTo);
}

function setMasterVolumePercent(vPercent) {
  const v = Number(vPercent);
  audioState.masterVolume = clamp01((Number.isFinite(v) ? v : 100) / 100);
  applyMasterVolumeAll();
}



function applyChannelMuteGains() {
  // Web Audio path
  if (audioState.musicBusGain) audioState.musicBusGain.gain.value = audioState.musicEnabled ? 1 : 0;
  if (audioState.sfxBusGain) audioState.sfxBusGain.gain.value = audioState.sfxEnabled ? 1 : 0;

  // Fallback path
  Object.values(audioState.tracks).forEach(applyMasterVolumeTo);
  Object.values(audioState.sfx).forEach(applyMasterVolumeTo);
}

function setMusicEnabled(enabled, { persist = true } = {}) {
  const on = !!enabled;
  if (typeof state !== 'undefined' && state) state.musicEnabled = on;
  audioState.musicEnabled = on;
  if (persist) {
    try { localStorage.setItem('pq-music-enabled', on ? '1' : '0'); } catch (e) {}
  }
  initAudio();
  ensureAudioContext();
  applyChannelMuteGains();
  updateAreaMusic();
}

function setSfxEnabled(enabled, { persist = true } = {}) {
  const on = !!enabled;
  if (typeof state !== 'undefined' && state) state.sfxEnabled = on;
  audioState.sfxEnabled = on;
  if (persist) {
    try { localStorage.setItem('pq-sfx-enabled', on ? '1' : '0'); } catch (e) {}
  }
  initAudio();
  ensureAudioContext();
  applyChannelMuteGains();
}

// Mute/unmute ambient audio while the player is “inside” a building modal
function setInteriorOpen(open) {
  initAudio();
  audioState.interiorOpen = !!open;
  if (audioState.interiorOpen) {
    playMusicTrack(null);
  } else {
    updateAreaMusic();
  }
}

function initAudio() {
  if (audioState.initialized) return;
  audioState.initialized = true;

  // Initialize master volume from settings (if present)
  audioState.masterVolume = getMasterVolume01();

  // Initialize channel toggles from state (preferred) or localStorage
  try {
    if (typeof state !== 'undefined' && state) {
      audioState.musicEnabled = (state.musicEnabled !== false);
      audioState.sfxEnabled = (state.sfxEnabled !== false);
    } else {
      const m = localStorage.getItem('pq-music-enabled');
      if (m !== null) audioState.musicEnabled = (m === '1' || m === 'true');
      const s = localStorage.getItem('pq-sfx-enabled');
      if (s !== null) audioState.sfxEnabled = (s === '1' || s === 'true');
    }
  } catch (e) {}


  // Create audio routing early so volume works consistently
  ensureAudioContext();
  applyMasterVolumeAll();
  applyChannelMuteGains();

  // ---- Ambient tracks ------------------------------------------------------
  // Village daytime ambience
  const villageDay = registerAudio(new Audio("./Audio/village_day.wav"), 0.4, 'music');
  villageDay.loop = true;
  audioState.tracks.villageDay = villageDay;

  // Global night ambience (plays anywhere at night)
  const nightAmbience = registerAudio(new Audio("./Audio/night-ambience.wav"), 0.35, 'music');
  nightAmbience.loop = true;
  audioState.tracks.nightAmbience = nightAmbience;
  
  // Inside initAudio(), after other ambient/sfx tracks:
const tavernAmbience = registerAudio(new Audio("./Audio/Tavern.wav"), 0.45, 'music');
tavernAmbience.loop = true;
audioState.tracks.tavernAmbience = tavernAmbience;

  // ---- SFX ----------------------------------------------------------------
  const doorOpen = registerAudio(new Audio("./Audio/old-wooden-door.wav"), 0.7, 'sfx');
  doorOpen.loop = false;
  audioState.sfx.doorOpen = doorOpen;
}

// Play the tavern/bank door SFX (one-shot)
// - Plays twice, at 2x speed, for a punchier "double latch" effect.
// - Returns a Promise that resolves after the final play ends.
function playDoorOpenSfx() {
  initAudio();
  tryResumeAudioContext();

  const door = audioState.sfx && audioState.sfx.doorOpen;
  if (!door) return Promise.resolve();

  // Respect SFX toggle (don't even start muted playback)
  const sfxOn = (typeof state !== 'undefined' && state) ? (state.sfxEnabled !== false) : audioState.sfxEnabled;
  if (!sfxOn) return Promise.resolve();

  const targetRate = 2;   // 2x speed
  const playsTotal = 2;   // play twice
  const originalRate = typeof door.playbackRate === "number" ? door.playbackRate : 1;

  let playsLeft = playsTotal;

  // Prevent stacking multiple "double-play" sequences if the player spams the door.
  // We cancel any previous sequence and start fresh.
  try {
    if (door.__doublePlayCancel) {
      door.__doublePlayCancel();
      door.__doublePlayCancel = null;
    }
  } catch (_) {}

  return new Promise(resolve => {
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;

      try {
        door.playbackRate = originalRate;
      } catch (_) {}

      door.removeEventListener("ended", onEnded);
      if (safetyTimer) clearTimeout(safetyTimer);
      door.__doublePlayCancel = null;

      resolve();
    };

    const onEnded = () => {
      playsLeft -= 1;

      if (playsLeft > 0) {
        // Rewind and play again immediately
        try {
          door.currentTime = 0;
          applyMasterVolumeTo(door);
          door.play().catch(() => finish());
        } catch (e) {
          finish();
        }
      } else {
        finish();
      }
    };

    // If autoplay is blocked, "ended" may never fire—fallback to finishing.
    const safetyTimer = setTimeout(finish, 1500);

    // Expose cancel so a subsequent door open can restart the sequence cleanly.
    door.__doublePlayCancel = finish;

    try {
      door.removeEventListener("ended", onEnded);
      door.addEventListener("ended", onEnded);

      // Start fresh
      door.currentTime = 0;
      try { door.playbackRate = targetRate; } catch (_) {}
      applyMasterVolumeTo(door);

      door.play().catch(err => {
        console.warn("Door SFX play blocked (likely due to browser autoplay rules):", err);
        finish();
      });
    } catch (err) {
      console.warn("Door SFX error:", err);
      finish();
    }
  });
}

// Play a given HTMLAudioElement, stopping whatever was playing before
function playMusicTrack(track) {
  if (!track) {
    // Stop current
    if (audioState.currentTrack) {
      audioState.currentTrack.pause();
      audioState.currentTrack.currentTime = 0;
      audioState.currentTrack = null;
    }
    return;
  }

  // Already playing this one? no-op
  if (audioState.currentTrack === track) return;

  // Stop the previous track
  if (audioState.currentTrack) {
    audioState.currentTrack.pause();
    audioState.currentTrack.currentTime = 0;
  }

  audioState.currentTrack = track;

  applyMasterVolumeTo(track);
  tryResumeAudioContext();

  // Start new one; catch autoplay blocks quietly
  track.play().catch(err => {
    console.warn("Music play blocked until user interacts with the page:", err);
  });
}

// Convenience: what counts as “daytime”?
function isMorning(info) {
  // timeSystem.js appears to provide { partLabel, partIndex }
  if (typeof info?.partIndex === "number") return info.partIndex === 0; // Morning
  return info?.partLabel === "Morning";
}

// Convenience: what counts as “night”?
function isNight(info) {
  // Prefer explicit name/label when available
  const lbl = String(info?.partName ?? info?.partLabel ?? "").toLowerCase();
  if (lbl && lbl.includes("night")) return true;

  // Fallback by index:
  // timeSystem.js (3-part day) => 0=Morning, 1=Evening, 2=Night
  // older (4-part) conventions => 3=Night
  if (typeof info?.partIndex === "number") {
    return info.partIndex === 2 || info.partIndex >= 3;
  }
  return false;
}

// Call this whenever area/time might have changed
function updateAreaMusic() {
  if (!state) return;

  // Never play ambience when the game screen isn't visible (main menu, settings, etc.)
  const gameScreenEl = document.getElementById("gameScreen");
  const gameVisible = !!(gameScreenEl && !gameScreenEl.classList.contains("hidden"));
  if (!gameVisible) {
    playMusicTrack(null);
    return;
  }

  initAudio();
  setMasterVolumePercent(state.settingsVolume);

  const info = getTimeInfo(state);
  const area = state.area || "village";

  // If we're inside a building modal (bank/tavern), don't let world ambience play.
// BUT: If Tavern.wav is already playing (tavern/gambling), keep it going without restarting.
  if (audioState.interiorOpen) {
    const tavernTrack = audioState.tracks && audioState.tracks.tavernAmbience;

    if (tavernTrack && audioState.currentTrack === tavernTrack) {
      // Keep playing through transitions (Tavern ↔ Gambling) and just keep volume in sync.
      applyMasterVolumeTo(tavernTrack);
      if (tavernTrack.paused && tavernTrack.currentTime > 0) {
        tryResumeAudioContext();
        tavernTrack.play().catch(() => {});
      }
      return;
    }

    playMusicTrack(null);
    return;
  }

  // Night ambience overrides everything, anywhere (unless inside)
  if (isNight(info)) {
    playMusicTrack(audioState.tracks.nightAmbience);
    return;
  }

  if (area === "village" && isMorning(info)) {
    playMusicTrack(audioState.tracks.villageDay);
  } else {
    playMusicTrack(null);
  }
}

// Small helper so we only need to change behavior in one place
function cheatsEnabled() {
  return !!(state && state.flags && state.flags.devCheatsEnabled);
}
  // --- DOM HELPERS --------------------------------------------------------------

  const enemyPanelEls = {
  panel: document.getElementById('enemyPanel'),
  name: document.getElementById('enemyName'),
  tags: document.getElementById('enemyTags'),
  hpFill: document.getElementById('enemyHpFill'),
  hpLabel: document.getElementById('enemyHpLabel'),
  status: document.getElementById('enemyStatusLine')
};
  const screens = {
    mainMenu: document.getElementById('mainMenu'),
    character: document.getElementById('characterScreen'),
    game: document.getElementById('gameScreen'),
    settings: document.getElementById('settingsScreen')
  };

  const modalEl = document.getElementById('modal');
  const modalTitleEl = document.getElementById('modalTitle');
  const modalBodyEl = document.getElementById('modalBody');

  // If we close one interior modal and immediately open another (e.g., Tavern → Gambling),
  // we don't want the interior music to stop/restart between those transitions.
  let pendingInteriorCloseTimer = null;

  function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    if (screens[name]) screens[name].classList.remove('hidden');

    // Ensure ambience never leaks onto non-game screens (main menu, settings, character creation).
    if (name !== 'game') {
      try {
        if (audioState) audioState.interiorOpen = false;
        playMusicTrack(null);
      } catch (e) {}
    }
  }

  function openModal(title, builderFn) {
  // Cancel any deferred "interior close" so interior ambience can carry across modal-to-modal transitions.
  if (pendingInteriorCloseTimer) {
    clearTimeout(pendingInteriorCloseTimer);
    pendingInteriorCloseTimer = null;
  }

  modalTitleEl.textContent = title;

  // 🔹 Clean up any tavern-game footer carried over from a previous modal
  if (modalEl) {
    const strayFooters = modalEl.querySelectorAll('.tavern-footer-actions');
    strayFooters.forEach(el => el.remove());
  }

  // 🔹 Reset any per-modal layout classes (like tavern-games-body)
  modalBodyEl.className = ''; // keep the id="modalBody" but clear classes

  // 🔹 Clear old content and build the new modal
  modalBodyEl.innerHTML = '';
  builderFn(modalBodyEl);
  modalEl.classList.remove('hidden');
}

  function closeModal() {
  modalEl.classList.add('hidden');
  // Ensure close button is restored for non-skill modals
  const closeBtn = document.getElementById('modalClose');
  if (closeBtn) closeBtn.style.display = '';

  // If we were inside the bank/tavern, defer flipping interiorOpen off by one tick.
  // This prevents Tavern.wav from cutting out/restarting when transitioning between
  // interior modals (e.g., Tavern → Gambling) that close & reopen the same modal UI.
  if (audioState && audioState.interiorOpen) {
    if (pendingInteriorCloseTimer) {
      clearTimeout(pendingInteriorCloseTimer);
      pendingInteriorCloseTimer = null;
    }

    pendingInteriorCloseTimer = setTimeout(() => {
      pendingInteriorCloseTimer = null;

      // If the modal got reopened immediately, we're still "inside"—do not stop interior music.
      const stillHidden = modalEl.classList.contains('hidden');
      if (!stillHidden) return;

      audioState.interiorOpen = false;
      updateAreaMusic();
    }, 75);

    return;
  }

  updateAreaMusic();
}
  // --- LOG & UI RENDERING -------------------------------------------------------

  function addLog(text, type) {
    state.log.push({ text, type: type || 'normal' });
    if (state.log.length > 80) state.log.shift();
    renderLog();
  }

  function renderLog() {
  const logEl = document.getElementById('log');
  if (!logEl) return;

  logEl.innerHTML = '';

  const activeFilter = state.logFilter || 'all';

  const toRender = state.log.filter(entry => {
    if (!entry.type || activeFilter === 'all') return true;
    if (activeFilter === 'system') return entry.type === 'system';
    if (activeFilter === 'danger') return entry.type === 'danger';
    if (activeFilter === 'good')   return entry.type === 'good';
    return true;
  });

  toRender.forEach(entry => {
    const p = document.createElement('p');
    p.className = 'log-line';
    if (entry.type && entry.type !== 'normal') {
      p.classList.add(entry.type);
    }
    p.textContent = entry.text;
    logEl.appendChild(p);
  });

  logEl.scrollTop = logEl.scrollHeight;
}

// NEW: optional small time label, if you add <div id="timeLabel"></div> in HTML
function updateTimeDisplay() {
  const label = document.getElementById('timeLabel');
  if (!label || !state) return;
  const info = getTimeInfo(state);
  label.textContent = formatTimeLong(info);
}
  function setScene(title, text) {
    document.getElementById('sceneTitle').textContent = title;
    document.getElementById('sceneText').textContent = text;
  }

  function updateQuestBox() {
    const qTitle = document.getElementById('questTitle');
    const qDesc = document.getElementById('questDesc');
    const mainQuest = state.quests.main;
    if (!mainQuest) {
      qTitle.textContent = 'Quests';
      qDesc.textContent = 'No active quests.';
      return;
    }

    qTitle.textContent = 'Main Quest – ' + mainQuest.name;
    let stepText = '';
    switch (mainQuest.step) {
      case 0:
        stepText = 'Speak with Elder Rowan in Emberwood village.';
        break;
      case 1:
        stepText = 'Hunt down the Goblin Warlord in Emberwood Forest.';
        break;
      case 2:
        stepText = 'Travel to the Ruined Spire and confront the Void-Touched Dragon.';
        break;
      case 3:
        stepText = 'Return to Elder Rowan as the hero of Emberwood.';
        break;
      default:
        stepText = 'Quest complete!';
    }

    if (mainQuest.status === 'completed') {
      qDesc.textContent = 'Completed: ' + mainQuest.name;
    } else {
      qDesc.textContent = stepText;
    }
  }
  
  function updateEnemyPanel() {
  const ep = enemyPanelEls;
  if (!ep.panel) return;

  const enemy = state.currentEnemy;

  // No active enemy or not in combat → hide panel
  if (!state.inCombat || !enemy) {
    ep.panel.classList.add('hidden');
    ep.status.textContent = '';
    return;
  }

  ep.panel.classList.remove('hidden');

  // Name
  ep.name.textContent = enemy.name || 'Enemy';

  // Tags (boss / behavior labels)
  const tags = [];
  if (enemy.isBoss) tags.push('Boss');
  if (enemy.behavior === 'bossDragon') tags.push('Dragon');
  else if (enemy.behavior === 'bossGoblin') tags.push('Warlord');
  else if (enemy.behavior === 'caster') tags.push('Caster');
  else if (enemy.behavior === 'aggressive') tags.push('Aggressive');
  else if (enemy.behavior === 'cunning') tags.push('Cunning');

  ep.tags.textContent = tags.join(' • ');

  // HP bar
  const hpPct = Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100));
  ep.hpFill.style.width = hpPct + '%';

  if (ep.hpLabel) {
    ep.hpLabel.textContent = "HP " + 
      Math.max(0, Math.round(enemy.hp)) + '/' + enemy.maxHp;
  }

  // Status line: bleed / chilled / guard
  const statusParts = [];

  if (enemy.bleedTurns && enemy.bleedTurns > 0 && enemy.bleedDamage) {
    statusParts.push(
      `Bleeding (${enemy.bleedTurns}t, ${enemy.bleedDamage} dmg)`
    );
  }
  if (enemy.chilledTurns && enemy.chilledTurns > 0) {
    statusParts.push(`Chilled (${enemy.chilledTurns}t)`);
  }
  if (enemy.guardTurns && enemy.guardTurns > 0) {
    statusParts.push(`Guarding (${enemy.guardTurns}t)`);
  }

  ep.status.textContent = statusParts.join(' • ');
}

  function updateHUD() {
  if (!state.player) return;

  const p = state.player;
  const comp = state.companion;
  const diff = getActiveDifficultyConfig();
  const classDef = PLAYER_CLASSES[p.classId];

  const nameEl = document.getElementById('hud-name');
  const classDiffEl = document.getElementById('hud-class-diff');
  const hpFill = document.getElementById('hpFill');
  const hpLabel = document.getElementById('hpLabel');
  const resFill = document.getElementById('resFill');
  const resLabel = document.getElementById('resLabel');
  const hudLevel = document.getElementById('hud-level');
  const hudGold = document.getElementById('hud-gold');

  // Decide which entity to show: default to player if no companion
  let mode = state.hudView || 'player';
  if (!comp && mode === 'companion') {
    mode = 'player';
    state.hudView = 'player';
  }

  if (mode === 'player') {
    // --- PLAYER VIEW ---
    nameEl.textContent = p.name || 'Nameless';
    classDiffEl.textContent =
      (classDef ? classDef.name : 'Adventurer') +
      ' • ' +
      (diff ? diff.name : '');

    const hpPercent = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    hpFill.style.width = hpPercent + '%';
    hpLabel.textContent = 'HP ' + Math.round(p.hp) + '/' + p.maxHp;
    hpFill.className = 'bar-fill hp-fill';

    const resPercent = Math.max(
      0,
      Math.min(100, (p.resource / p.maxResource) * 100)
    );
    resFill.style.width = resPercent + '%';
    resFill.className = 'bar-fill resource-fill ' + p.resourceKey;
    resLabel.textContent =
      p.resourceName + ' ' + Math.round(p.resource) + '/' + p.maxResource;
  } else {
    // --- COMPANION VIEW ---
    // We already guaranteed comp exists above.
    nameEl.textContent = comp.name + ' (Companion)';
    classDiffEl.textContent =
      comp.role.charAt(0).toUpperCase() + comp.role.slice(1) + ' • Swipe to switch';

    // Use bars to show companion stats instead of HP/resource
    // HP bar -> Attack
    hpFill.style.width = '100%';
    hpFill.className = 'bar-fill hp-fill';
    hpLabel.textContent = 'Attack ' + comp.attack;

    // Resource bar -> HP bonus
    resFill.style.width = '100%';
    resFill.className = 'bar-fill resource-fill mana';
    resLabel.textContent = 'HP Bonus +' + comp.hpBonus;
  }

  // Bottom: still always show player progression & gold
  hudLevel.textContent =
    'Lv ' + p.level + ' • ' + p.xp + '/' + p.nextLevelXp + ' XP';

  hudGold.innerHTML = '<span class="gold">' + p.gold + '</span> Gold';
}

  function renderActions() {
    const actionsEl = document.getElementById('actions');
    actionsEl.innerHTML = '';

    if (!state.player) return;

    if (state.inCombat && state.currentEnemy) {
      renderCombatActions(actionsEl);
    } else {
      renderExploreActions(actionsEl);
    }
  }

  function makeActionButton(label, onClick, extraClass) {
    const btn = document.createElement('button');
    btn.className = 'btn small ' + (extraClass || '');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

function renderExploreActions(actionsEl) {
  actionsEl.innerHTML = '';
  if (!state.player) return;

  if (!state.ui) state.ui = {};
  const ui = state.ui;
  const inVillage = state.area === 'village';
  const showVillageMenu = inVillage && ui.villageActionsOpen;

  // 🔹 VILLAGE SUBMENU MODE ---------------------------------------------------
  if (showVillageMenu) {
    
    
    actionsEl.appendChild(
      makeActionButton('Tavern', () => {
        openTavernModal();
      })
    );

    actionsEl.appendChild(
      makeActionButton('Bank', () => {
        openBankModal();
      })
    );

    actionsEl.appendChild(
      makeActionButton('Merchant', () => {
        openMerchantModal();
      })
    );

    actionsEl.appendChild(
      makeActionButton('Town Hall', () => {
        openTownHallModal();
      })
    );


    actionsEl.appendChild(
      makeActionButton('Back', () => {
        ui.villageActionsOpen = false;
        renderActions();
      })
    );

    return;
  }

  // 🔹 DEFAULT (NON-VILLAGE or VILLAGE NORMAL BAR) ----------------------------
  // Village-only: button to enter the village submenu
  if (inVillage) {
    actionsEl.appendChild(
      makeActionButton('Village ▸', () => {
        ui.villageActionsOpen = true;
        renderActions();
      })
    );

    // ✅ Only show Realm & Council if you're in the village
    actionsEl.appendChild(
      makeActionButton('Realm & Council', () => {
        openGovernmentModal();
      })
    );
  }

  actionsEl.appendChild(
    makeActionButton('Explore', () => {
      handleExploreClick();
    }, '')
  );

  actionsEl.appendChild(
    makeActionButton('Change Area', () => {
      ui.exploreChoiceMade = false;
      openExploreModal();
    })
  );

  actionsEl.appendChild(
    makeActionButton('Inventory', () => {
      openInventoryModal();
    })
  );

  actionsEl.appendChild(
    makeActionButton('Spells', () => {
      openSpellsModal(false);
    })
  );

  if (cheatsEnabled()) {
    actionsEl.appendChild(
      makeActionButton('Cheats', () => {
        openCheatMenu();
      })
    );
  }
}
  function renderCombatActions(actionsEl) {
  actionsEl.appendChild(makeActionButton('Attack', () => {
    playerBasicAttack();
  }, ''));

  actionsEl.appendChild(makeActionButton('Spells', () => {
    openSpellsModal(true);
  }));

  actionsEl.appendChild(makeActionButton('Inventory', () => {
    openInventoryModal(true);
  }));

  const isBoss = state.currentEnemy && state.currentEnemy.isBoss;
  actionsEl.appendChild(makeActionButton(isBoss ? 'No Escape' : 'Flee', () => {
    if (isBoss) {
      addLog('You cannot flee from this foe!', 'system');
    } else {
      tryFlee();
    }
  }, isBoss ? 'outline' : ''));

    // NEW: Character sheet also accessible in combat
  actionsEl.appendChild(makeActionButton('Character', () => {
    openCharacterSheet();
  }));

  // 🔹 Only show Cheats button in combat if dev toggle is enabled
  if (cheatsEnabled()) {
    actionsEl.appendChild(
      makeActionButton('Cheats', () => {
        openCheatMenu();
      })
    );
  }
}

// HUD swipe tracking
let hudTouchStartX = null;
let hudTouchStartY = null;

function toggleHudEntity() {
  // If no companion, always show player and do nothing
  if (!state.companion) {
    addLog('You have no companion yet.', 'system');
    state.hudView = 'player';
    updateHUD();
    return;
  }

  state.hudView = state.hudView === 'companion' ? 'player' : 'companion';
  updateHUD();
}

  // --- PLAYER CREATION ----------------------------------------------------------

  function buildCharacterCreationOptions() {
  const classRow = document.getElementById('classOptions');
  const diffRow = document.getElementById('difficultyOptions');
  classRow.innerHTML = '';
  diffRow.innerHTML = '';

  // Extended icon map for ALL classes
  const CLASS_ICONS = {
    mage: "🔥",
    warrior: "🛡",
    blood: "🩸",
    ranger: "🎯",
    paladin: "✝",
    rogue: "🗡",
    cleric: "⛨",
    necromancer: "💀",
    shaman: "🌩",
    berserker: "💢",
    vampire: "🦇"
  };

  // Build one card per class in PLAYER_CLASSES
  Object.values(PLAYER_CLASSES).forEach(cls => {
    const div = document.createElement('div');
    div.className = 'class-card';
    div.dataset.classId = cls.id;

    div.innerHTML = `
      <div class="class-card-icon">${CLASS_ICONS[cls.id] || "🎭"}</div>
      <div class="class-card-content">
        <div class="class-card-name">${cls.name}</div>
        <div class="class-card-desc">${cls.desc}</div>
      </div>
    `;

    div.addEventListener('click', () => {
      document
        .querySelectorAll('#classOptions .class-card')
        .forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
    });

    classRow.appendChild(div);
  });

  // Auto-select the first class card
  const first = classRow.querySelector('.class-card');
  if (first) first.classList.add('selected');

  // Difficulty options stay as pill buttons
['easy', 'normal', 'hard', 'dynamic'].forEach(id => {
  const diff = DIFFICULTY_CONFIG[id];
  const div = document.createElement('div');
  div.className = 'pill-option';
  div.dataset.diffId = id;
  div.innerHTML = `
      <strong>${diff.name}</strong>
      <div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">
        ${
          id === 'easy'
            ? ''
            : id === 'normal'
            ? ''
            : id === 'hard'
            ? ''
            : ''
        }
      </div>`;
  div.addEventListener('click', () => {
    document
      .querySelectorAll('#difficultyOptions .pill-option')
      .forEach(el => el.classList.remove('selected'));
    div.classList.add('selected');
  });
  diffRow.appendChild(div);
  if (id === 'normal') div.classList.add('selected');
});
}
// Reset the character-creation dev-cheats UI so it never "sticks"
function resetDevCheatsCreationUI() {
  const pill = document.querySelector('.dev-cheats-pill');
  const cb = document.getElementById('devCheatsToggle');

  if (pill) pill.classList.remove('selected');
  if (cb) cb.checked = false;
}
// --- DEV CHEATS PILL TOGGLE ----------------------------------------------
const devCheatsPill = document.querySelector('.dev-cheats-pill');
const devCheatsCheckbox = document.getElementById('devCheatsToggle');

if (devCheatsPill && devCheatsCheckbox) {
  // Ensure a clean default when the page first loads
  devCheatsPill.classList.remove('selected');
  devCheatsCheckbox.checked = false;

  devCheatsPill.addEventListener('click', (evt) => {
  evt.preventDefault(); // ignore native label/checkbox toggling

  const nowActive = !devCheatsPill.classList.contains('selected');

  // Visual state (like difficulty highlight)
  devCheatsPill.classList.toggle('selected', nowActive);

  // Keep the hidden checkbox in sync so existing logic still works
  devCheatsCheckbox.checked = nowActive;
});
}

function startNewGameFromCreation() {
  const nameInput = document.getElementById('inputName');
  let name = nameInput.value.trim();
  if (!name) name = 'Nameless One';

  // ✅ FIX: use .class-card for class selection
  const classCard = document.querySelector('#classOptions .class-card.selected');
  const diffOption = document.querySelector('#difficultyOptions .pill-option.selected');

  const classId = classCard ? classCard.dataset.classId : 'warrior';
  const diffId = diffOption ? diffOption.dataset.diffId : 'normal';

  state = createEmptyState();
  state.difficulty = diffId;
  // 🔹 NEW: read dev-cheat toggle from character creation screen
  const devToggle = document.getElementById('devCheatsToggle');
  if (devToggle && devToggle.checked) {
    state.flags.devCheatsEnabled = true;
  }

      // NEW: initialize time & village economy
  initTimeState(state);
  initVillageEconomyState(state);
  initGovernmentState(state, 0);
  ensureVillagePopulation(state);   // ← add this line

  const classDef = PLAYER_CLASSES[classId] || PLAYER_CLASSES['warrior'];
  const base = classDef.baseStats;

  const startingSkills =
    CLASS_STARTING_SKILLS[classId] || CLASS_STARTING_SKILLS.default;

  const player = {
    name,
    classId,
    level: 1,
    xp: 0,
    nextLevelXp: 100,

    // core resources (base values; skills will modify via recalcPlayerStats)
    maxHp: base.maxHp,
    hp: base.maxHp,
        resourceKey: classDef.resourceKey,
    resourceName: classDef.resourceName,
    maxResource:
      classDef.resourceKey === 'mana'
        ? 100
        : classDef.resourceKey === 'essence'
        ? 90
        : 60,
    resource:
      classDef.resourceKey === 'mana'
        ? 80
        : classDef.resourceKey === 'essence'
        ? 45
        : 0,
    stats: {
      attack: base.attack,
      magic: base.magic,
      armor: base.armor,
      speed: base.speed
    },

    // NEW: skills and points
    skills: {
      strength: startingSkills.strength,
      endurance: startingSkills.endurance,
      willpower: startingSkills.willpower
    },
    skillPoints: 0,

    equipment: {
      weapon: null,
      armor: null
    },
    inventory: [],
    spells: [...classDef.startingSpells],
    gold: 40,
    status: {
      bleedTurns: 0,
      bleedDamage: 0,
      shield: 0,
      buffAttack: 0,
      dmgReductionTurns: 0
    }
  };

  state.player = player;
  state.quests.main = {
    id: 'main',
    name: 'Shadows over Emberwood',
    step: 0,
    status: 'active'
  };

    // Starter items by resource
  addItemToInventory('potionSmall', 2);
  if (classDef.resourceKey === 'mana') {
    addItemToInventory('potionMana', 1);
    addItemToInventory('staffOak', 1);
  } else if (classDef.resourceKey === 'fury') {
    addItemToInventory('potionFury', 1);
    addItemToInventory('swordIron', 1);
    addItemToInventory('armorLeather', 1);
  } else if (classDef.resourceKey === 'blood') {
    addItemToInventory('potionBlood', 1);
    addItemToInventory('bladeSanguine', 1);
  } else if (classDef.resourceKey === 'essence') {
    addItemToInventory('potionEssence', 1);
    addItemToInventory('bladeSanguine', 1);
  }

  setScene(
    'Emberwood Village',
    'You arrive at Emberwood, a frontier village stalked by shadows. The village elder seeks a champion.'
  );
  addLog('You arrive in Emberwood, carrying only your wits and your gear.', 'system');
  addLog('Find Elder Rowan and learn why the forest has grown restless.');

  updateQuestBox();
  updateHUD();
  updateEnemyPanel();
  renderActions();
  saveGame();
    updateTimeDisplay();

  switchScreen('game');
}

  // --- INVENTORY & ITEMS --------------------------------------------------------

  function cloneItemDef(id) {
    const def = ITEM_DEFS[id];
    if (!def) return null;
    return JSON.parse(JSON.stringify(def));
  }

  function addItemToInventory(itemId, quantity) {
    quantity = quantity || 1;
    const def = cloneItemDef(itemId);
    if (!def) return;

    const inv = state.player.inventory;
    const existingIndex = inv.findIndex(it => it.id === def.id && it.type === 'potion');
    if (existingIndex >= 0 && def.type === 'potion') {
      inv[existingIndex].quantity = (inv[existingIndex].quantity || 1) + quantity;
    } else {
      def.quantity = quantity;
      inv.push(def);
    }
  }

  function openInventoryModal(inCombat) {
    const p = state.player;
    openModal('Inventory', body => {
      if (!p.inventory.length) {
        body.innerHTML = '<p class="modal-subtitle">You are not carrying anything.</p>';
        return;
      }

      p.inventory.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';

        const header = document.createElement('div');
        header.className = 'item-row-header';

        const left = document.createElement('div');
        left.innerHTML = '<span class="item-name">' + item.name + '</span>' +
          (item.quantity > 1 ? ' ×' + item.quantity : '');

        const right = document.createElement('div');
        right.className = 'item-meta';
        if (item.type === 'potion') {
          right.textContent = 'Consumable';
        } else if (item.type === 'weapon' || item.type === 'armor') {
          const equipped = (item.type === 'weapon' && p.equipment.weapon && p.equipment.weapon.id === item.id) ||
            (item.type === 'armor' && p.equipment.armor && p.equipment.armor.id === item.id);
          right.textContent = (equipped ? 'Equipped' : 'Equipment');
        } else {
          right.textContent = 'Item';
        }

        header.appendChild(left);
        header.appendChild(right);

        const desc = document.createElement('div');
        desc.style.fontSize = '0.75rem';
        desc.style.color = 'var(--muted)';
        desc.textContent = item.desc || '';

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        if (item.type === 'potion') {
          const btn = document.createElement('button');
          btn.className = 'btn small';
          btn.textContent = 'Use';
          btn.addEventListener('click', () => {
            usePotionFromInventory(index, inCombat);
          });
          actions.appendChild(btn);
        } else if (item.type === 'weapon' || item.type === 'armor') {
          const btn = document.createElement('button');
          btn.className = 'btn small';
          btn.textContent = 'Equip';
          btn.addEventListener('click', () => {
            equipItemFromInventory(index);
          });
          actions.appendChild(btn);
        }

        div.appendChild(header);
        div.appendChild(desc);
        if (actions.children.length) div.appendChild(actions);

        body.appendChild(div);
      });

      if (inCombat) {
        const hint = document.createElement('p');
        hint.className = 'modal-subtitle';
        hint.textContent = 'Using items consumes your action this turn.';
        body.appendChild(hint);
      }
    });
  }

  function usePotionFromInventory(index, inCombat) {
    const p = state.player;
    const item = p.inventory[index];
    if (!item || item.type !== 'potion') return;

    let used = false;
    if (item.hpRestore) {
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + item.hpRestore);
      if (p.hp > before) {
        addLog('You drink ' + item.name + ' and recover ' + (p.hp - before) + ' HP.', 'good');
        used = true;
      } else {
        addLog('You are already at full health.', 'system');
      }
    } else if (item.resourceRestore && item.resourceKey) {
      if (p.resourceKey !== item.resourceKey) {
        addLog('This does not match your class resource.', 'system');
      } else {
        const before = p.resource;
        p.resource = Math.min(p.maxResource, p.resource + item.resourceRestore);
        if (p.resource > before) {
          addLog('You use ' + item.name + ' and restore ' +
            (p.resource - before) + ' ' + p.resourceName + '.', 'good');
          used = true;
        } else {
          addLog('Your ' + p.resourceName + ' is already full.', 'system');
        }
      }
    }

    if (used) {
      item.quantity -= 1;
      if (item.quantity <= 0) {
        p.inventory.splice(index, 1);
      }
      updateHUD();
      saveGame();
      if (inCombat) {
        closeModal();
        enemyTurn();
      } else {
        closeModal();
      }
    }
  }

  function equipItemFromInventory(index) {
    const p = state.player;
    const item = p.inventory[index];
    if (!item || (item.type !== 'weapon' && item.type !== 'armor')) return;

    if (item.type === 'weapon') {
      p.equipment.weapon = item;
      addLog('You equip ' + item.name + ' as your weapon.', 'good');
    } else {
      p.equipment.armor = item;
      addLog('You equip ' + item.name + ' as your armor.', 'good');
    }

    recalcPlayerStats();
    updateHUD();
    saveGame();
    closeModal();
  }

  function recalcPlayerStats() {
  const p = state.player;
  const cls = PLAYER_CLASSES[p.classId];
  const base = cls.baseStats;

  // If loading an old save, make sure skills exist
  if (!p.skills) {
    const fallback =
      CLASS_STARTING_SKILLS[p.classId] || CLASS_STARTING_SKILLS.default;
    p.skills = {
      strength: fallback.strength,
      endurance: fallback.endurance,
      willpower: fallback.willpower
    };
  }

  const s = p.skills;

  // Base stats from class
  p.maxHp = base.maxHp;
  p.stats.attack = base.attack;
  p.stats.magic = base.magic;
  p.stats.armor = base.armor;
  p.stats.speed = base.speed;

  // Skill contributions
  // Strength: boosts physical offense
  p.stats.attack += s.strength * 2;

  // Endurance: more HP and some armor
  p.maxHp += s.endurance * 6;
  p.stats.armor += Math.floor(s.endurance / 2);

  // Willpower: boosts magic and resource pool
  p.stats.magic += s.willpower * 2;

  let extraMaxRes = 0;
  extraMaxRes += s.willpower * 4;

  // Equipment contributions
  if (p.equipment.weapon) {
    if (p.equipment.weapon.attackBonus) {
      p.stats.attack += p.equipment.weapon.attackBonus;
    }
    if (p.equipment.weapon.magicBonus) {
      p.stats.magic += p.equipment.weapon.magicBonus;
    }
  }
  if (p.equipment.armor) {
    if (p.equipment.armor.armorBonus) {
      p.stats.armor += p.equipment.armor.armorBonus;
    }
    if (p.equipment.armor.maxResourceBonus) {
      extraMaxRes += p.equipment.armor.maxResourceBonus;
    }
  }

  let baseMaxRes = 60;
  if (cls.resourceKey === 'mana') {
    baseMaxRes = 100;
  } else if (cls.resourceKey === 'essence') {
    baseMaxRes = 90;
  }

  p.maxResource = baseMaxRes + extraMaxRes;

  // Clamp current values to new maxima
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  if (p.resource > p.maxResource) p.resource = p.maxResource;
}


  // --- MERCHANT (delegated to module) -------------------------------------------

function openMerchantModal(context = 'village') {
  openMerchantModalImpl({
    context,
    state,
    openModal,
    addLog,
    getVillageEconomySummary,
    getMerchantPrice,
    handleEconomyAfterPurchase,
    cloneItemDef,
    addItemToInventory,
    updateHUD,
    saveGame
  });
}
  
function openTavernModal() {
  initAudio();
  tryResumeAudioContext();

  const tavernTrack = audioState.tracks && audioState.tracks.tavernAmbience;

  // If we're already inside the tavern/gambling flow and Tavern.wav is already running,
  // DO NOT replay the door SFX or restart the track.
  const tavernAlreadyPlaying =
    !!(audioState.interiorOpen &&
       tavernTrack &&
       audioState.currentTrack === tavernTrack &&
       (!tavernTrack.paused || tavernTrack.currentTime > 0));

  if (!tavernAlreadyPlaying) {
    // Entering from outside: stop world ambience, then play door + start Tavern ambience.
    setInteriorOpen(true);

    Promise.resolve(playDoorOpenSfx()).then(() => {
      // If the player exited before the SFX finished, don't start anything.
      if (!audioState.interiorOpen) return;
      if (!tavernTrack) return;

      // If something else started playing in the meantime, don't fight it.
      if (audioState.currentTrack && audioState.currentTrack !== tavernTrack) return;

      applyMasterVolumeTo(tavernTrack);

      // Start (or resume) Tavern.wav without resetting its time if it already had progress.
      audioState.currentTrack = tavernTrack;
      if (tavernTrack.paused) {
        tavernTrack.play().catch(() => {});
      }
    });
  } else {
    // Keep volume synced, and resume if some browser paused it during a transition.
    applyMasterVolumeTo(tavernTrack);
    if (tavernTrack.paused && tavernTrack.currentTime > 0) {
      tavernTrack.play().catch(() => {});
    }
  }

  openTavernModalImpl({
    state,
    openModal,
    addLog,
    getVillageEconomySummary,
    getRestCost,
    handleEconomyAfterPurchase,
    jumpToNextMorning,
    handleEconomyDayTick,
    handleGovernmentDayTick,
    updateHUD,
    updateTimeDisplay,
    saveGame,
    closeModal,
    openGambleModal
  });
}

function openGambleModal() {
  openGambleModalImpl({
    state,
    openModal,
    addLog,
    updateHUD,
    saveGame,
    closeModal,
    openTavernModal
  });
}
function openTownHallModal() {
  openTownHallModalImpl({
    state,
    openModal,
    addLog,
    handleGovernmentDayTick,
    handleEconomyDayTick,
    updateHUD,
    saveGame
  });
}


function openBankModal() {
  playDoorOpenSfx();
  setInteriorOpen(true);
  openBankModalImpl({
    state,
    openModal,
    addLog,
    updateHUD,
    saveGame
  });
}
  // --- CHEAT MENU ---------------------------------------------------------------

function openCheatMenu() {
  openModal('Cheat Menu', body => {
	  body.classList.add('cheat-modal');  // match changelog font sizing/feel
    const p = state.player;

    const info = document.createElement('p');
    info.className = 'modal-subtitle';
    info.textContent =
      'Debug / cheat options for testing. They instantly modify your current save.';
    body.appendChild(info);

    // Collapsible sections to keep the cheat menu compact
    function makeCheatSection(titleText, expandedByDefault) {
      const section = document.createElement('div');
      section.className = 'cheat-section';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'cheat-section-header';
      header.setAttribute('aria-expanded', expandedByDefault ? 'true' : 'false');

      const chevron = document.createElement('span');
      chevron.className = 'cheat-section-chevron';
      chevron.textContent = expandedByDefault ? '▾' : '▸';

      const label = document.createElement('span');
      label.className = 'cheat-section-title';
      label.textContent = titleText;

      header.appendChild(chevron);
      header.appendChild(label);

      const content = document.createElement('div');
      content.className = 'cheat-section-body';
      if (!expandedByDefault) {
        content.style.display = 'none';
      }

      header.addEventListener('click', () => {
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : '';
        header.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        chevron.textContent = isOpen ? '▸' : '▾';
      });

      section.appendChild(header);
      section.appendChild(content);
      body.appendChild(section);

      return content;
    }

    // Core hero / combat cheats
    const coreContent = makeCheatSection('Core Cheats', true);

    // Row 1 – Gold / XP
    const btnRow1 = document.createElement('div');
    btnRow1.className = 'item-actions';

    const btnGold = document.createElement('button');
    btnGold.className = 'btn small';
    btnGold.textContent = '+1000 Gold';
    btnGold.addEventListener('click', () => {
      p.gold += 1000;
      addLog('Cheat: conjured 1000 gold.', 'system');
      updateHUD();
      saveGame();
    });

    const btnXp = document.createElement('button');
    btnXp.className = 'btn small';
    btnXp.textContent = '+100 XP';
    btnXp.addEventListener('click', () => {
      grantExperience(100);
    });

    btnRow1.appendChild(btnGold);
    btnRow1.appendChild(btnXp);
    coreContent.appendChild(btnRow1);

    // Row 2 – Heal / Slay Enemy
    const btnRow2 = document.createElement('div');
    btnRow2.className = 'item-actions';

    const btnHeal = document.createElement('button');
    btnHeal.className = 'btn small';
    btnHeal.textContent = 'Full Heal';
    btnHeal.addEventListener('click', () => {
      p.hp = p.maxHp;
      p.resource = p.maxResource;
      addLog('Cheat: fully restored health and ' + p.resourceName + '.', 'system');
      updateHUD();
      saveGame();
    });

    const btnKill = document.createElement('button');
    btnKill.className = 'btn small';
    btnKill.textContent = 'Slay Enemy';
    btnKill.addEventListener('click', () => {
      if (state.inCombat && state.currentEnemy) {
        state.currentEnemy.hp = 0;
        addLog('Cheat: enemy instantly defeated.', 'danger');
        handleEnemyDefeat();
      } else {
        addLog('No enemy to slay right now.', 'system');
      }
    });

    btnRow2.appendChild(btnHeal);
    btnRow2.appendChild(btnKill);
    coreContent.appendChild(btnRow2);

    // Row 3 – God Mode / Always Crit
    const btnRow3 = document.createElement('div');
    btnRow3.className = 'item-actions';

    const btnGod = document.createElement('button');
    btnGod.className = 'btn small';
    btnGod.textContent = (state.flags.godMode ? 'Disable' : 'Enable') + ' God Mode';
    btnGod.addEventListener('click', () => {
      state.flags.godMode = !state.flags.godMode;
      addLog(
        'God Mode ' + (state.flags.godMode ? 'enabled' : 'disabled') + '.',
        'system'
      );
      closeModal();
    });

    const btnCrit = document.createElement('button');
    btnCrit.className = 'btn small';
    btnCrit.textContent = (state.flags.alwaysCrit ? 'Normal Crits' : 'Always Crit');
    btnCrit.addEventListener('click', () => {
      state.flags.alwaysCrit = !state.flags.alwaysCrit;
      addLog(
        'Always-crit mode ' + (state.flags.alwaysCrit ? 'enabled' : 'disabled') + '.',
        'system'
      );
      closeModal();
    });

    btnRow3.appendChild(btnGod);
    btnRow3.appendChild(btnCrit);
    coreContent.appendChild(btnRow3);

    // --- Gambling debug controls (developer-only) ---------------------------
    const gamblingContent = makeCheatSection('Gambling Debug', false);

    const gambleTitle = document.createElement('div');
    gambleTitle.className = 'char-section-title';
    
    gamblingContent.appendChild(gambleTitle);

    const gambleRow1 = document.createElement('div');
    gambleRow1.className = 'item-actions';

    const gambleRow2 = document.createElement('div');
    gambleRow2.className = 'item-actions';

    const gambleStatus = document.createElement('p');
    gambleStatus.className = 'modal-subtitle';

    function ensureGamblingDebug() {
      if (!state.gamblingDebug) {
        state.gamblingDebug = {
          mode: 'normal',
          payoutMultiplier: 1
        };
      } else {
        if (!state.gamblingDebug.mode) {
          state.gamblingDebug.mode = 'normal';
        }
        if (
          typeof state.gamblingDebug.payoutMultiplier !== 'number' ||
          state.gamblingDebug.payoutMultiplier <= 0
        ) {
          state.gamblingDebug.payoutMultiplier = 1;
        }
      }
      return state.gamblingDebug;
    }

    function updateGambleStatus() {
      const dbg = ensureGamblingDebug();
      const modeLabel =
        dbg.mode === 'playerFavored'
          ? 'Player-Favored'
          : dbg.mode === 'houseFavored'
          ? 'House-Favored'
          : 'Normal';

      const mult =
        typeof dbg.payoutMultiplier === 'number' && dbg.payoutMultiplier > 0
          ? dbg.payoutMultiplier
          : 1;

      gambleStatus.textContent =
        'Mode: ' + modeLabel + ' • Payout Multiplier: x' + mult.toFixed(2);
    }

    // Odds buttons
    const btnOddsFair = document.createElement('button');
    btnOddsFair.className = 'btn small';
    btnOddsFair.textContent = 'Fair Odds';
    btnOddsFair.addEventListener('click', () => {
      const dbg = ensureGamblingDebug();
      dbg.mode = 'normal';
      updateGambleStatus();
      saveGame();
    });

    const btnOddsPlayer = document.createElement('button');
    btnOddsPlayer.className = 'btn small';
    btnOddsPlayer.textContent = 'Favor Player';
    btnOddsPlayer.addEventListener('click', () => {
      const dbg = ensureGamblingDebug();
      dbg.mode = 'playerFavored';
      updateGambleStatus();
      saveGame();
    });

    const btnOddsHouse = document.createElement('button');
    btnOddsHouse.className = 'btn small';
    btnOddsHouse.textContent = 'Favor House';
    btnOddsHouse.addEventListener('click', () => {
      const dbg = ensureGamblingDebug();
      dbg.mode = 'houseFavored';
      updateGambleStatus();
      saveGame();
    });

    gambleRow1.appendChild(btnOddsFair);
    gambleRow1.appendChild(btnOddsPlayer);
    gambleRow1.appendChild(btnOddsHouse);
    gamblingContent.appendChild(gambleRow1);

    // Payout multiplier buttons
    const btnPayHalf = document.createElement('button');
    btnPayHalf.className = 'btn small';
    btnPayHalf.textContent = 'x0.5 Payout';
    btnPayHalf.addEventListener('click', () => {
      const dbg = ensureGamblingDebug();
      dbg.payoutMultiplier = 0.5;
      updateGambleStatus();
      saveGame();
    });

    const btnPayNormal = document.createElement('button');
    btnPayNormal.className = 'btn small';
    btnPayNormal.textContent = 'x1 Payout';
    btnPayNormal.addEventListener('click', () => {
      const dbg = ensureGamblingDebug();
      dbg.payoutMultiplier = 1;
      updateGambleStatus();
      saveGame();
    });

    const btnPayDouble = document.createElement('button');
    btnPayDouble.className = 'btn small';
    btnPayDouble.textContent = 'x2 Payout';
    btnPayDouble.addEventListener('click', () => {
      const dbg = ensureGamblingDebug();
      dbg.payoutMultiplier = 2;
      updateGambleStatus();
      saveGame();
    });

    gambleRow2.appendChild(btnPayHalf);
    gambleRow2.appendChild(btnPayNormal);
    gambleRow2.appendChild(btnPayDouble);
    gamblingContent.appendChild(gambleRow2);

    updateGambleStatus();
    gamblingContent.appendChild(gambleStatus);

    // Companion debug controls
    const companionContent = makeCheatSection('Companions', false);

    const compTitle = document.createElement('div');
    compTitle.className = 'char-section-title';
    compTitle.textContent = 'Companions';
    companionContent.appendChild(compTitle);

    const compRow = document.createElement('div');
    compRow.className = 'item-actions companion-actions';

    const btnWolf = document.createElement('button');
    btnWolf.className = 'btn small';
    btnWolf.textContent = 'Summon Wolf';
    btnWolf.addEventListener('click', () => {
      grantCompanion('wolf');
      closeModal();
    });

    const btnGolem = document.createElement('button');
    btnGolem.className = 'btn small';
    btnGolem.textContent = 'Summon Golem';
    btnGolem.addEventListener('click', () => {
      grantCompanion('golem');
      closeModal();
    });

    const btnSprite = document.createElement('button');
    btnSprite.className = 'btn small';
    btnSprite.textContent = 'Summon Sprite';
    btnSprite.addEventListener('click', () => {
      grantCompanion('sprite');
      closeModal();
    });

    const btnSkeleton = document.createElement('button');
    btnSkeleton.className = 'btn small';
    btnSkeleton.textContent = 'Summon Skeleton';
    btnSkeleton.addEventListener('click', () => {
      grantCompanion('skeleton');
      closeModal();
    });

    // NEW: Falcon
    const btnFalcon = document.createElement('button');
    btnFalcon.className = 'btn small';
    btnFalcon.textContent = 'Summon Falcon';
    btnFalcon.addEventListener('click', () => {
      grantCompanion('falcon');
      closeModal();
    });

    // NEW: Treant
    const btnTreant = document.createElement('button');
    btnTreant.className = 'btn small';
    btnTreant.textContent = 'Summon Treant';
    btnTreant.addEventListener('click', () => {
      grantCompanion('treant');
      closeModal();
    });

    // NEW: Familiar
    const btnFamiliar = document.createElement('button');
    btnFamiliar.className = 'btn small';
    btnFamiliar.textContent = 'Summon Familiar';
    btnFamiliar.addEventListener('click', () => {
      grantCompanion('familiar');
      closeModal();
    });

    // NEW: Mimic
    const btnMimic = document.createElement('button');
    btnMimic.className = 'btn small';
    btnMimic.textContent = 'Summon Mimic';
    btnMimic.addEventListener('click', () => {
      grantCompanion('mimic');
      closeModal();
    });

    const btnDismiss = document.createElement('button');
    btnDismiss.className = 'btn small outline';
    btnDismiss.textContent = 'Dismiss Companion';
    btnDismiss.addEventListener('click', () => {
      dismissCompanion();
      closeModal();
    });

    compRow.appendChild(btnWolf);
    compRow.appendChild(btnGolem);
    compRow.appendChild(btnSprite);
    compRow.appendChild(btnSkeleton);
    compRow.appendChild(btnFalcon);
    compRow.appendChild(btnTreant);
    compRow.appendChild(btnFamiliar);
    compRow.appendChild(btnMimic);
    compRow.appendChild(btnDismiss);
    companionContent.appendChild(compRow);
	
	    // --- Government & Realm Debug -------------------------------------------
    const govContent = makeCheatSection('Government & Realm', false);

    const govIntro = document.createElement('p');
    govIntro.className = 'modal-subtitle';
    govIntro.textContent =
      'Tweak kingdom metrics, policies and Emberwood village attitudes. Useful for testing government-driven systems.';
    govContent.appendChild(govIntro);

    // Local helpers
    function ensureGovAndVillage() {
      const absDay =
        state.time && typeof state.time.absoluteDay === 'number'
          ? state.time.absoluteDay
          : 0;
      // Make sure government exists for older saves
      if (typeof initGovernmentState === 'function') {
        initGovernmentState(state, absDay);
      }
      const g = state.government || null;
      const village =
        g && g.villages && g.villages.village ? g.villages.village : null;
      return { g, village };
    }

    function clampMetricVal(val) {
      const num = Number(val);
      if (isNaN(num)) return 0;
      if (num < 0) return 0;
      if (num > 100) return 100;
      return Math.round(num);
    }

    function clampModifier(val) {
      const num = Number(val);
      if (isNaN(num)) return 0;
      // Government normally keeps these in about -0.3 .. +0.3
      const clamped = Math.max(-0.5, Math.min(0.5, num));
      return Math.round(clamped * 100) / 100;
    }

    // Layout containers
    const metricsBox = document.createElement('div');
    metricsBox.style.display = 'flex';
    metricsBox.style.flexWrap = 'wrap';
    metricsBox.style.gap = '4px 8px';
    metricsBox.style.marginBottom = '4px';
    govContent.appendChild(metricsBox);

    const policiesBox = document.createElement('div');
    policiesBox.className = 'item-actions';
    policiesBox.style.flexWrap = 'wrap';
    govContent.appendChild(policiesBox);

    const villageBox = document.createElement('div');
    villageBox.style.display = 'flex';
    villageBox.style.flexWrap = 'wrap';
    villageBox.style.gap = '4px 8px';
    villageBox.style.marginTop = '4px';
    govContent.appendChild(villageBox);

    const govSummary = document.createElement('p');
    govSummary.className = 'modal-subtitle';
    govSummary.style.marginTop = '4px';
    govContent.appendChild(govSummary);

    // --- Metric fields -------------------------------------------------------
    function makeMetricField(labelText) {
      const wrap = document.createElement('label');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '4px';
      wrap.style.fontSize = '0.75rem';

      const span = document.createElement('span');
      span.textContent = labelText;

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.style.width = '4rem';

      wrap.appendChild(span);
      wrap.appendChild(input);
      return { wrap, input };
    }

    const stabField = makeMetricField('Stability');
    const prospField = makeMetricField('Prosperity');
    const popField = makeMetricField('Popularity');
    const corrField = makeMetricField('Corruption');

    metricsBox.appendChild(stabField.wrap);
    metricsBox.appendChild(prospField.wrap);
    metricsBox.appendChild(popField.wrap);
    metricsBox.appendChild(corrField.wrap);

    // --- Policy selects ------------------------------------------------------
    function makePolicySelect(labelText, options) {
      const wrap = document.createElement('label');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '4px';
      wrap.style.fontSize = '0.75rem';

      const span = document.createElement('span');
      span.textContent = labelText;

      const select = document.createElement('select');
      options.forEach(function(opt) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
        select.appendChild(o);
      });

      wrap.appendChild(span);
      wrap.appendChild(select);
      return { wrap, select };
    }

    const taxField = makePolicySelect('Tax', ['low', 'normal', 'high']);
    const milField = makePolicySelect('Military', ['peace', 'tense', 'war']);
    const jusField = makePolicySelect('Justice', ['lenient', 'balanced', 'harsh']);

    policiesBox.appendChild(taxField.wrap);
    policiesBox.appendChild(milField.wrap);
    policiesBox.appendChild(jusField.wrap);

    // --- Village fields (Emberwood) -----------------------------------------
    function makeVillageField(labelText, min, max, step) {
      const wrap = document.createElement('label');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '4px';
      wrap.style.fontSize = '0.75rem';

      const span = document.createElement('span');
      span.textContent = labelText;

      const input = document.createElement('input');
      input.type = 'number';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.style.width = '4.5rem';

      wrap.appendChild(span);
      wrap.appendChild(input);
      return { wrap, input };
    }

    const vLoyalField = makeVillageField('Loyalty', 0, 100, 1);
    const vFearField = makeVillageField('Fear', 0, 100, 1);
    const vUnrestField = makeVillageField('Unrest', 0, 100, 1);
    const vProsField = makeVillageField('Pros. mod', -0.5, 0.5, 0.05);
    const vSafeField = makeVillageField('Safe. mod', -0.5, 0.5, 0.05);

    villageBox.appendChild(vLoyalField.wrap);
    villageBox.appendChild(vFearField.wrap);
    villageBox.appendChild(vUnrestField.wrap);
    villageBox.appendChild(vProsField.wrap);
    villageBox.appendChild(vSafeField.wrap);

    // Populate from current state
    function populateGovFields() {
      const gv = ensureGovAndVillage();
      const g = gv.g;
      const village = gv.village;

      if (g && g.metrics) {
        stabField.input.value =
          typeof g.metrics.stability === 'number' ? g.metrics.stability : 60;
        prospField.input.value =
          typeof g.metrics.prosperity === 'number' ? g.metrics.prosperity : 55;
        popField.input.value =
          typeof g.metrics.royalPopularity === 'number'
            ? g.metrics.royalPopularity
            : 55;
        corrField.input.value =
          typeof g.metrics.corruption === 'number' ? g.metrics.corruption : 30;
      }

      const policies = g && g.currentPolicies ? g.currentPolicies : {};
      taxField.select.value = policies.taxRate || 'normal';
      milField.select.value = policies.militaryPosture || 'peace';
      jusField.select.value = policies.justiceStyle || 'balanced';

      if (village) {
        vLoyalField.input.value =
          typeof village.loyalty === 'number' ? village.loyalty : 60;
        vFearField.input.value =
          typeof village.fear === 'number' ? village.fear : 20;
        vUnrestField.input.value =
          typeof village.unrest === 'number' ? village.unrest : 10;
        vProsField.input.value =
          typeof village.prosperityModifier === 'number'
            ? village.prosperityModifier
            : 0;
        vSafeField.input.value =
          typeof village.safetyModifier === 'number'
            ? village.safetyModifier
            : 0;
      } else {
        vLoyalField.input.value = '';
        vFearField.input.value = '';
        vUnrestField.input.value = '';
        vProsField.input.value = '';
        vSafeField.input.value = '';
      }

      if (typeof getGovernmentSummary === 'function') {
        const summary = getGovernmentSummary(state);
        if (summary && summary.hasGovernment) {
          const m = summary.metrics || {};
          const st =
            typeof m.stability === 'number' ? m.stability : 0;
          const pr =
            typeof m.prosperity === 'number' ? m.prosperity : 0;
          const rp =
            typeof m.royalPopularity === 'number'
              ? m.royalPopularity
              : 0;
          const co =
            typeof m.corruption === 'number' ? m.corruption : 0;

          govSummary.textContent =
            summary.realmName +
            ' — stability ' + st +
            ', prosperity ' + pr +
            ', royal popularity ' + rp +
            ', corruption ' + co +
            ' • council: ' +
            (summary.councilCount || 0) +
            ' members';
        } else {
          govSummary.textContent =
            'No kingdom government has been initialized yet.';
        }
      } else {
        govSummary.textContent =
          'No kingdom government summary helper is available.';
      }
    }

    populateGovFields();

    // --- Action buttons ------------------------------------------------------
    const govButtons = document.createElement('div');
    govButtons.className = 'item-actions';
    govButtons.style.marginTop = '4px';
    govContent.appendChild(govButtons);

    const btnApplyGov = document.createElement('button');
    btnApplyGov.className = 'btn small';
    btnApplyGov.textContent = 'Apply government changes';

    btnApplyGov.addEventListener('click', function() {
      const gv = ensureGovAndVillage();
      const g = gv.g;
      const village = gv.village;

      if (!g) {
        addLog('Cheat: no government state is available to edit.', 'system');
        return;
      }

      if (!g.metrics) {
        g.metrics = {
          stability: 60,
          prosperity: 55,
          royalPopularity: 55,
          corruption: 30
        };
      }

      g.metrics.stability = clampMetricVal(stabField.input.value);
      g.metrics.prosperity = clampMetricVal(prospField.input.value);
      g.metrics.royalPopularity = clampMetricVal(popField.input.value);
      g.metrics.corruption = clampMetricVal(corrField.input.value);

      if (!g.currentPolicies) {
        g.currentPolicies = {
          taxRate: 'normal',
          militaryPosture: 'peace',
          justiceStyle: 'balanced'
        };
      }
      g.currentPolicies.taxRate = taxField.select.value;
      g.currentPolicies.militaryPosture = milField.select.value;
      g.currentPolicies.justiceStyle = jusField.select.value;

      if (village) {
        village.loyalty = clampMetricVal(vLoyalField.input.value);
        village.fear = clampMetricVal(vFearField.input.value);
        village.unrest = clampMetricVal(vUnrestField.input.value);
        village.prosperityModifier = clampModifier(vProsField.input.value);
        village.safetyModifier = clampModifier(vSafeField.input.value);
      }

      addLog(
        'Cheat: adjusted kingdom government metrics and Emberwood attitudes.',
        'system'
      );
      populateGovFields();
      updateHUD();
      saveGame();
    });

    const btnClearTownHall = document.createElement('button');
    btnClearTownHall.className = 'btn small outline';
    btnClearTownHall.textContent = 'Clear Town Hall decree';

    btnClearTownHall.addEventListener('click', function() {
      if (state.government && state.government.townHallEffects) {
        delete state.government.townHallEffects;
        addLog('Cheat: cleared any active Town Hall economic decree.', 'system');
      } else {
        addLog('Cheat: no Town Hall decree was active.', 'system');
      }
      updateHUD();
      saveGame();
    });

    govButtons.appendChild(btnApplyGov);
    govButtons.appendChild(btnClearTownHall);

    // Status footer (inside Core Cheats)
    const status = document.createElement('p');
    status.className = 'modal-subtitle';
    const activeDiff = getActiveDifficultyConfig();
    status.textContent =
      'Current difficulty: ' + (activeDiff ? activeDiff.name : '') +
      ' • God Mode: ' + (state.flags.godMode ? 'ON' : 'OFF') +
      ' • Always Crit: ' + (state.flags.alwaysCrit ? 'ON' : 'OFF');
    coreContent.appendChild(status);
  });
}


  // --- SPELLS -------------------------------------------------------------------

  function openSpellsModal(inCombat) {
    const p = state.player;
    openModal('Spells & Abilities', body => {
      if (!p.spells || !p.spells.length) {
        body.innerHTML = '<p class="modal-subtitle">You have not learned any special abilities yet.</p>';
        return;
      }
      p.spells.forEach(id => {
        const ab = ABILITIES[id];
        if (!ab) return;
        const row = document.createElement('div');
        row.className = 'item-row';

        const header = document.createElement('div');
        header.className = 'item-row-header';
        const left = document.createElement('div');
        left.innerHTML = '<span class="item-name">' + ab.name + '</span>';
        const right = document.createElement('div');
        right.className = 'item-meta';

                let costText = '';
        if (ab.cost.mana) costText = ab.cost.mana + ' Mana';
        if (ab.cost.fury) costText = ab.cost.fury + ' Fury';
        if (ab.cost.blood) costText = ab.cost.blood + ' Blood';
        if (ab.cost.essence) costText = ab.cost.essence + ' Essence';
        if (ab.cost.hp) costText = ab.cost.hp + ' HP';
        right.textContent = costText || 'Free';

        header.appendChild(left);
        header.appendChild(right);

        const desc = document.createElement('div');
        desc.style.fontSize = '0.75rem';
        desc.style.color = 'var(--muted)';
        desc.textContent = ab.note || '';

        row.appendChild(header);
        row.appendChild(desc);

        if (inCombat) {
          const actions = document.createElement('div');
          actions.className = 'item-actions';
          const btnUse = document.createElement('button');
          btnUse.className = 'btn small';
          btnUse.textContent = 'Use';
          btnUse.addEventListener('click', () => {
            useAbilityInCombat(id);
          });
          actions.appendChild(btnUse);
          row.appendChild(actions);
        }

        body.appendChild(row);
      });

      if (!inCombat) {
        const hint = document.createElement('p');
        hint.className = 'modal-subtitle';
        hint.textContent = 'Abilities are used in combat. Outside battle you can review their costs.';
        body.appendChild(hint);
      }
    });
  }

  function canPayCost(cost) {
    const p = state.player;
      if (cost.mana && p.resourceKey === 'mana' && p.resource < cost.mana) return false;
  if (cost.fury && p.resourceKey === 'fury' && p.resource < cost.fury) return false;
  if (cost.blood && p.resourceKey === 'blood' && p.resource < cost.blood) return false;
  if (cost.essence && p.resourceKey === 'essence' && p.resource < cost.essence) return false;
  if (cost.hp && p.hp <= cost.hp) return false;
    return true;
  }

  function payCost(cost) {
    const p = state.player;
  if (cost.mana && p.resourceKey === 'mana') p.resource -= cost.mana;
  if (cost.fury && p.resourceKey === 'fury') p.resource -= cost.fury;
  if (cost.blood && p.resourceKey === 'blood') p.resource -= cost.blood;
  if (cost.essence && p.resourceKey === 'essence') p.resource -= cost.essence;
  if (cost.hp) p.hp -= cost.hp;
  }

  function useAbilityInCombat(id) {
    if (!state.inCombat || !state.currentEnemy) {
      addLog('No enemy to target.', 'system');
      return;
    }
    const ab = ABILITIES[id];
    if (!ab) return;

    if (!canPayCost(ab.cost)) {
      addLog('Not enough resource to use ' + ab.name + '.', 'system');
      return;
    }

    const p = state.player;
    const enemy = state.currentEnemy;
    payCost(ab.cost);

    let description = '';

    if (id === 'fireball') {
      const dmg = calcMagicDamage(p.stats.magic * 1.5);
      enemy.hp -= dmg;
      description = 'You hurl a blazing Fireball for ' + dmg + ' damage.';
    } else if (id === 'iceShard') {
      const dmg = calcMagicDamage(p.stats.magic * 1.1);
      enemy.hp -= dmg;
      description = 'You launch an Ice Shard for ' + dmg + ' damage, chilling your foe.';
      enemy.chilledTurns = 1;
    } else if (id === 'arcaneShield') {
      p.status.shield += 40;
      description = 'You wrap yourself in arcane energy, gaining a shield.';
    } else if (id === 'powerStrike') {
      const dmg = calcPhysicalDamage(p.stats.attack * 1.7);
      enemy.hp -= dmg;
      description = 'You slam your weapon down in a Power Strike for ' + dmg + ' damage!';
    } else if (id === 'battleCry') {
      p.status.buffAttack += 4;
      p.resource = Math.min(p.maxResource, p.resource + 10);
      description = 'You roar a Battle Cry, bolstering your attack and building Fury.';
    } else if (id === 'shieldWall') {
      p.status.dmgReductionTurns = 2;
      description = 'You raise your guard, forming a Shield Wall that will reduce damage.';
    } else if (id === 'bloodSlash') {
      const dmg = calcPhysicalDamage(p.stats.attack * 2.0);
      enemy.hp -= dmg;
      description = 'You bleed willingly and unleash a Blood Slash for ' + dmg + ' damage!';
    } else if (id === 'leech') {
      const dmg = calcMagicDamage(p.stats.magic * 1.1);
      enemy.hp -= dmg;
      const heal = Math.round(dmg * 0.6);
      const beforeHp = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      description = 'You siphon ' + dmg + ' life and heal ' + (p.hp - beforeHp) + ' HP.';
    } else if (id === 'hemorrhage') {
      const dmg = calcPhysicalDamage(p.stats.attack * 0.8);
      enemy.hp -= dmg;
      enemy.bleedDamage = Math.round(p.stats.attack * 0.6);
      enemy.bleedTurns = 3;
      description = 'You carve a deep wound: ' + dmg + ' damage and the foe starts bleeding.';
	      // --- RANGER -------------------------------------------------------------
    } else if (id === 'piercingShot') {
      const base = p.stats.attack * 1.5;
      const dmg = calcPhysicalDamage(base);
      enemy.hp -= dmg;
      description = 'You line up a Piercing Shot for ' + dmg + ' damage.';
    } else if (id === 'twinArrows') {
      const dmg1 = calcPhysicalDamage(p.stats.attack * 0.9);
      const dmg2 = calcPhysicalDamage(p.stats.attack * 0.9);
      const total = dmg1 + dmg2;
      enemy.hp -= total;
      description =
        'You loose Twin Arrows, striking for ' +
        dmg1 +
        ' and ' +
        dmg2 +
        ' damage (' +
        total +
        ' total).';
    } else if (id === 'markedPrey') {
      const dmg = calcPhysicalDamage(p.stats.attack * 1.1);
      enemy.hp -= dmg;
      enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.attack * 0.4));
      enemy.bleedTurns = (enemy.bleedTurns || 0) + 2;
      description =
        'You mark your prey, dealing ' +
        dmg +
        ' damage and opening a bleeding wound.';

    // --- PALADIN ------------------------------------------------------------
    } else if (id === 'holyStrike') {
      let base = p.stats.attack * 1.3;
      if (enemy.bleedTurns > 0 || enemy.chilledTurns > 0) {
        base *= 1.3; // extra vs wounded/slowed foes
      }
      const dmg = calcPhysicalDamage(base);
      enemy.hp -= dmg;
      description =
        'You deliver a Holy Strike for ' +
        dmg +
        ' radiant damage.';
    } else if (id === 'blessingLight') {
      const heal = Math.round(p.maxHp * 0.25);
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const actual = p.hp - before;
      const shield = 25;
      p.status.shield = (p.status.shield || 0) + shield;
      description =
        'Blessing of Light restores ' +
        actual +
        ' HP and grants a ' +
        shield +
        '-point shield.';
    } else if (id === 'retributionAura') {
      p.status.buffAttack = (p.status.buffAttack || 0) + 3;
      p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3);
      description =
        'You wreathe yourself in Retribution Aura, boosting attack and reducing damage for a few turns.';

    // --- ROGUE --------------------------------------------------------------
    } else if (id === 'backstab') {
      const hpRatio = enemy.hp / enemy.maxHp;
      const mult = hpRatio > 0.7 ? 1.9 : 1.3;
      const dmg = calcPhysicalDamage(p.stats.attack * mult);
      enemy.hp -= dmg;
      description =
        'You slip behind the enemy and Backstab for ' + dmg + ' damage.';
    } else if (id === 'poisonedBlade') {
      const dmg = calcPhysicalDamage(p.stats.attack * 1.1);
      enemy.hp -= dmg;
      enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.attack * 0.5));
      enemy.bleedTurns = (enemy.bleedTurns || 0) + 3;
      description =
        'Your Poisoned Blade cuts for ' +
        dmg +
        ' damage and leaves the foe suffering over time.';
    } else if (id === 'shadowstep') {
      const heal = Math.round(p.maxHp * 0.15);
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const actual = p.hp - before;
      p.status.buffAttack = (p.status.buffAttack || 0) + 2;
      description =
        'You Shadowstep through the fray, recovering ' +
        actual +
        ' HP and sharpening your next strikes.';

    // --- CLERIC -------------------------------------------------------------
    } else if (id === 'holyHeal') {
      const heal = Math.round(p.maxHp * 0.35);
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const actual = p.hp - before;
      description =
        'Radiant warmth floods you as Holy Heal restores ' +
        actual +
        ' HP.';
    } else if (id === 'smite') {
      const dmg = calcMagicDamage(p.stats.magic * 1.3);
      enemy.hp -= dmg;
      description = 'You Smite your enemy for ' + dmg + ' holy damage.';
    } else if (id === 'purify') {
      const oldBleed = p.status.bleedTurns || 0;
      p.status.bleedTurns = 0;
      p.status.bleedDamage = 0;
      const shield = 15;
      p.status.shield = (p.status.shield || 0) + shield;
      description =
        'Purifying light washes over you, cleansing bleeding (' +
        oldBleed +
        ' turn(s) removed) and granting a ' +
        shield +
        '-point shield.';

    // --- NECROMANCER --------------------------------------------------------
    } else if (id === 'soulBolt') {
      const dmg = calcMagicDamage(p.stats.magic * 1.4);
      enemy.hp -= dmg;
      const heal = Math.round(dmg * 0.4);
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const actual = p.hp - before;
      description =
        'You hurl a Soul Bolt for ' +
        dmg +
        ' damage and siphon ' +
        actual +
        ' HP.';
    } else if (id === 'raiseBones') {
      grantCompanion('skeleton');
      description =
        'Bones knit together at your call: a Skeletal companion joins the battle.';
    } else if (id === 'decay') {
      const dmg = calcMagicDamage(p.stats.magic * 0.9);
      enemy.hp -= dmg;
      enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.magic * 0.7));
      enemy.bleedTurns = (enemy.bleedTurns || 0) + 3;
      description =
        'You inflict Decay for ' +
        dmg +
        ' damage; necrotic rot will gnaw at the foe for several turns.';

    // --- SHAMAN --------------------------------------------------------------
    } else if (id === 'lightningLash') {
      const dmg = calcMagicDamage(p.stats.magic * 1.5);
      enemy.hp -= dmg;
      description =
        'Storm power lashes out, dealing ' + dmg + ' lightning damage.';
    } else if (id === 'earthskin') {
      p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3);
      const shield = 20;
      p.status.shield = (p.status.shield || 0) + shield;
      description =
        'Stone-like Earthskin forms around you, reducing damage and adding a ' +
        shield +
        '-point barrier.';
    } else if (id === 'spiritHowl') {
      if (state.companion) {
        state.companion.attack += 4;
        description =
          'Your Spirit Howl emboldens ' +
          state.companion.name +
          ', increasing their attack.';
      } else {
        description =
          'Your howl echoes through the spirit world, but no companion is present to answer.';
      }
	  
	      // --- VAMPIRE -------------------------------------------------------------
    } else if (id === 'essenceDrain') {
      const dmg = calcMagicDamage(p.stats.magic * 1.2);
      enemy.hp -= dmg;

      const heal = Math.round(dmg * 0.5);
      const beforeHp = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);

      const essenceGain = 15;
      const beforeRes = p.resource;
      p.resource = Math.min(p.maxResource, p.resource + essenceGain);

      description =
        'You drain ' +
        dmg +
        ' life, healing ' +
        (p.hp - beforeHp) +
        ' HP and restoring ' +
        (p.resource - beforeRes) +
        ' Essence.';
    } else if (id === 'batSwarm') {
      const dmg = calcMagicDamage(p.stats.magic * 1.3);
      enemy.hp -= dmg;

      enemy.bleedDamage = Math.max(
        enemy.bleedDamage || 0,
        Math.round(p.stats.magic * 0.5)
      );
      enemy.bleedTurns = (enemy.bleedTurns || 0) + 2;

      description =
        'A swarm of spectral bats rends your foe for ' +
        dmg +
        ' damage and leaves them bleeding.';
    } else if (id === 'shadowVeil') {
      const turns = 3;
      p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, turns);
      description =
        'You wrap yourself in a shadowy veil, reducing damage taken for ' +
        turns +
        ' turns.';

    // --- BERSERKER -----------------------------------------------------------
    } else if (id === 'frenziedBlow') {
      const missing = Math.max(0, p.maxHp - p.hp);
      const bonusFactor = 1 + Math.min(0.8, missing / p.maxHp); // up to +80%
      const dmg = calcPhysicalDamage(p.stats.attack * bonusFactor);
      enemy.hp -= dmg;
      description =
        'In a frenzy, you unleash a devastating blow for ' +
        dmg +
        ' damage.';
    } else if (id === 'warCryBerserker') {
      const heal = Math.round(p.maxHp * 0.2);
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const actual = p.hp - before;
      p.status.buffAttack = (p.status.buffAttack || 0) + 3;
      description =
        'Your War Cry restores ' +
        actual +
        ' HP and surges your Attack.';
    } else if (id === 'bloodlustRage') {
      const furyGain = 25;
      p.resource = Math.min(p.maxResource, p.resource + furyGain);
      p.status.buffAttack = (p.status.buffAttack || 0) + 2;
      description =
        'Bloodlust overtakes you, granting ' +
        furyGain +
        ' Fury and sharpening your offense.';
    }

      addLog(description, 'good');
  updateHUD();
  updateEnemyPanel();
  closeModal();

  if (enemy.hp <= 0) {
    handleEnemyDefeat();
  } else {
    // Companion acts after your ability
    companionActIfPresent();

    if (!state.inCombat || !state.currentEnemy) {
      return;
    }
    if (state.currentEnemy.hp <= 0) {
      handleEnemyDefeat();
    } else {
      enemyTurn();
    }
  }
}

  function openCharacterSheet() {
  const p = state.player;
  if (!p) return;

  const cls = PLAYER_CLASSES[p.classId];
  const diff = getActiveDifficultyConfig();
    const timeInfo = getTimeInfo(state);
  const worldTimeLine = formatTimeLong(timeInfo);

  const areaName =
    state.area === 'village'
      ? 'Emberwood Village'
      : state.area === 'forest'
      ? 'Emberwood Forest'
      : state.area === 'ruins'
      ? 'Ruined Spire'
      : state.area;

  const mainQuest = state.quests.main;

  // Quest summary line for Overview tab
  let questLine = 'None';
  if (mainQuest) {
    if (mainQuest.status === 'completed') {
      questLine = `${mainQuest.name} (Completed)`;
    } else {
      questLine = `${mainQuest.name} – Step ${mainQuest.step}`;
    }
  }

  // Base stats reference for derived breakdown
  const baseStats = cls
    ? cls.baseStats
    : {
        maxHp: p.maxHp,
        attack: p.stats.attack,
        magic: p.stats.magic,
        armor: p.stats.armor,
        speed: p.stats.speed
      };

  const sk = p.skills || { strength: 0, endurance: 0, willpower: 0 };

  // Contributions from skills
  const atkFromStr = sk.strength * 2;
  const hpFromEnd = sk.endurance * 6;
  const armorFromEnd = Math.floor(sk.endurance / 2);
  const magicFromWill = sk.willpower * 2;
  const resFromWill = sk.willpower * 4;

  // Equipment bonuses
  const weaponAtkBonus =
    p.equipment.weapon && p.equipment.weapon.attackBonus
      ? p.equipment.weapon.attackBonus
      : 0;

  const weaponMagicBonus =
    p.equipment.weapon && p.equipment.weapon.magicBonus
      ? p.equipment.weapon.magicBonus
      : 0;

  const armorBonus =
    p.equipment.armor && p.equipment.armor.armorBonus
      ? p.equipment.armor.armorBonus
      : 0;

  const armorResBonus =
    p.equipment.armor && p.equipment.armor.maxResourceBonus
      ? p.equipment.armor.maxResourceBonus
      : 0;

  const baseRes = p.resourceKey === 'mana' ? 100 : 60;

  const comp = state.companion;

  openModal('Character Sheet', body => {
    body.innerHTML = '';

    // --- TAB HEADER -----------------------------------------------------------
    const tabs = document.createElement('div');
    tabs.className = 'char-tabs';

    const tabDefs = [
      { id: 'overview', label: 'Overview' },
      { id: 'stats', label: 'Stats' },
      { id: 'skills', label: 'Skills' },
      { id: 'equipment', label: 'Equipment' },
      { id: 'companions', label: 'Companions' }
    ];

    tabDefs.forEach((t, idx) => {
      const btn = document.createElement('button');
      btn.className = 'char-tab' + (idx === 0 ? ' active' : '');
      btn.dataset.tab = t.id;
      btn.textContent = t.label;
      tabs.appendChild(btn);
    });

    body.appendChild(tabs);

    // --- TAB PANELS WRAPPER ---------------------------------------------------
    const panelsWrapper = document.createElement('div');
    panelsWrapper.className = 'char-tabs-wrapper';

    function makePanel(id, innerHTML) {
      const panel = document.createElement('div');
      panel.className =
        'char-tab-panel' + (id === 'overview' ? ' active' : '');
      panel.dataset.tab = id;
      panel.innerHTML = innerHTML;
      panelsWrapper.appendChild(panel);
      return panel;
    }

    // --- OVERVIEW TAB ---------------------------------------------------------
        const overviewHtml = `
      <div class="char-section">
        <div class="char-section-title">Hero</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">🏷</span>Name
          </div>
          <div class="stat-value">${p.name}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🎭</span>Class
          </div>
          <div class="stat-value">${cls ? cls.name : 'Unknown'}</div>

          <div class="stat-label">
            <span class="char-stat-icon">⚖</span>Difficulty
          </div>
          <div class="stat-value">${diff ? diff.name : ''}</div>

          <div class="stat-label">
            <span class="char-stat-icon">⭐</span>Level
          </div>
          <div class="stat-value">${p.level}</div>

          <div class="stat-label">
            <span class="char-stat-icon">📈</span>XP
          </div>
          <div class="stat-value">${p.xp} / ${p.nextLevelXp}</div>

          <div class="stat-label">
            <span class="char-stat-icon">📍</span>Location
          </div>
          <div class="stat-value">${areaName}</div>

          <!-- NEW: world time -->
          <div class="stat-label">
            <span class="char-stat-icon">⏳</span>World Time
          </div>
          <div class="stat-value">${worldTimeLine}</div>
        </div>
      </div>
    `;

    // --- STATS TAB ------------------------------------------------------------
    const statsHtml = `
      <div class="char-section">
        <div class="char-section-title">Core Stats</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">❤️</span>HP
          </div>
          <div class="stat-value">${Math.round(p.hp)} / ${p.maxHp}</div>

          <div class="stat-label">
            <span class="char-stat-icon">💧</span>${p.resourceName}
          </div>
          <div class="stat-value">${Math.round(p.resource)} / ${p.maxResource}</div>

          <div class="stat-label">
            <span class="char-stat-icon">⚔</span>Attack
          </div>
          <div class="stat-value stat-attack">${p.stats.attack}</div>

          <div class="stat-label">
            <span class="char-stat-icon">✨</span>Magic
          </div>
          <div class="stat-value stat-magic">${p.stats.magic}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🛡</span>Armor
          </div>
          <div class="stat-value stat-armor">${p.stats.armor}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🌀</span>Speed
          </div>
          <div class="stat-value stat-speed">${p.stats.speed}</div>

          <div class="stat-label">
            <span class="char-stat-icon">💰</span>Gold
          </div>
          <div class="stat-value">${p.gold}</div>
        </div>
      </div>

      <div class="char-section char-divider-top">
        <div class="char-section-title">Derived Breakdown</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">⚔</span>Attack
          </div>
          <div class="stat-value">
            ${baseStats.attack}
            <span class="stat-note">
              (+${atkFromStr} STR, +${weaponAtkBonus} weapon)
            </span>
          </div>

          <div class="stat-label">
            <span class="char-stat-icon">❤️</span>HP Max
          </div>
          <div class="stat-value">
            ${baseStats.maxHp}
            <span class="stat-note">
              (+${hpFromEnd} END)
            </span>
          </div>

          <div class="stat-label">
            <span class="char-stat-icon">✨</span>Magic
          </div>
          <div class="stat-value">
            ${baseStats.magic}
            <span class="stat-note">
              (+${magicFromWill} WIL, +${weaponMagicBonus} weapon)
            </span>
          </div>

          <div class="stat-label">
            <span class="char-stat-icon">🛡</span>Armor
          </div>
          <div class="stat-value">
            ${baseStats.armor}
            <span class="stat-note">
              (+${armorFromEnd} END, +${armorBonus} armor)
            </span>
          </div>

          <div class="stat-label">
            <span class="char-stat-icon">💧</span>${p.resourceName} Max
          </div>
          <div class="stat-value">
            ${baseRes}
            <span class="stat-note">
              (+${resFromWill} WIL, +${armorResBonus} gear)
            </span>
          </div>
        </div>
      </div>
    `;

    // --- SKILLS TAB -----------------------------------------------------------
    const skillsHtml = `
      <div class="char-section">
        <div class="char-section-title">Skills</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">💪</span>Strength
          </div>
          <div class="stat-value">${sk.strength}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🛡</span>Endurance
          </div>
          <div class="stat-value">${sk.endurance}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🧠</span>Willpower
          </div>
          <div class="stat-value">${sk.willpower}</div>

          <div class="stat-label">
            <span class="char-stat-icon">⭐</span>Skill Points
          </div>
          <div class="stat-value">${p.skillPoints || 0}</div>
        </div>
      </div>

      <div class="char-section char-divider-top">
        <p class="modal-subtitle">
          Tip: Strength boosts physical attacks, Endurance increases max HP & armor,
          and Willpower improves magic power and resource pool.
        </p>
      </div>
    `;

    // --- EQUIPMENT TAB --------------------------------------------------------
    const weaponName = p.equipment.weapon
      ? p.equipment.weapon.name
      : '<span class="equip-empty">None</span>';

    const armorName = p.equipment.armor
      ? p.equipment.armor.name
      : '<span class="equip-empty">None</span>';

    const equipmentHtml = `
      <div class="char-section">
        <div class="char-section-title">Equipment</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">⚔</span>Weapon
          </div>
          <div class="stat-value">${weaponName}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🛡</span>Armor
          </div>
          <div class="stat-value">${armorName}</div>
        </div>
      </div>

      <div class="char-section char-divider-top">
        <p class="modal-subtitle">
          Weapons mostly enhance Attack and Magic; armor increases Armor and sometimes maximum resources.
        </p>
      </div>
    `;

    // --- COMPANIONS TAB -------------------------------------------------------
    let companionsHtml = '';

    if (!comp) {
      companionsHtml = `
        <div class="char-section">
          <div class="char-section-title">Companion</div>
          <p class="equip-empty">You currently travel alone.</p>
        </div>
      `;
    } else {
      companionsHtml = `
        <div class="char-section">
          <div class="char-section-title">Companion</div>
          <div class="stat-grid">
            <div class="stat-label">
              <span class="char-stat-icon">🧍</span>Name
            </div>
            <div class="stat-value">${comp.name}</div>

            <div class="stat-label">
              <span class="char-stat-icon">🎯</span>Role
            </div>
            <div class="stat-value">${comp.role}</div>

            <div class="stat-label">
              <span class="char-stat-icon">⚔</span>Attack
            </div>
            <div class="stat-value stat-attack">${comp.attack}</div>

            <div class="stat-label">
              <span class="char-stat-icon">❤️</span>HP Bonus
            </div>
            <div class="stat-value">${comp.hpBonus}</div>
          </div>
          <p class="modal-subtitle">${comp.description}</p>
        </div>
      `;
    }

    const companionsPanelHtml = companionsHtml + `
      <div class="char-section char-divider-top">
        <p class="modal-subtitle">
          Companions act after your turn. Some focus on damage, others on defense or healing.
        </p>
      </div>
    `;

    // Build panels
    makePanel('overview', overviewHtml);
    makePanel('stats', statsHtml);
    makePanel('skills', skillsHtml);
    makePanel('equipment', equipmentHtml);
    makePanel('companions', companionsPanelHtml);

    body.appendChild(panelsWrapper);

    // --- TAB SWITCH LOGIC -----------------------------------------------------
    tabs.addEventListener('click', e => {
      const btn = e.target.closest('.char-tab');
      if (!btn) return;
      const tabId = btn.dataset.tab;

      tabs.querySelectorAll('.char-tab').forEach(b => {
        b.classList.toggle('active', b === btn);
      });

      panelsWrapper.querySelectorAll('.char-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.tab === tabId);
      });
    });
  });
}


// --- SKILLS -------------------------------------------------------------------
function autoDistributeSkillPoints(p) {
  if (!p || !p.skills) return;
  if (p.skillPoints == null) p.skillPoints = 0;
  if (p.skillPoints <= 0) return;

  const keys = ['strength', 'endurance', 'willpower'];

  // Use your class starting distribution as the long-run "target" ratio.
  const baseWeights =
    CLASS_STARTING_SKILLS[p.classId] || CLASS_STARTING_SKILLS.default;

  // Small smoothing so 0-weight stats can still receive a point occasionally (dynamic builds).
  const weights = {};
  keys.forEach(k => (weights[k] = (baseWeights[k] ?? 0) + 0.25));

  const sumW = keys.reduce((a, k) => a + weights[k], 0);
  const prob = {};
  keys.forEach(k => (prob[k] = weights[k] / sumW));

  const before = { ...p.skills };
  const pointsToSpend = p.skillPoints;

  while (p.skillPoints > 0) {
    const totalNow = keys.reduce((a, k) => a + (p.skills[k] || 0), 0);
    const totalAfter = totalNow + 1;

    let bestKey = keys[0];
    let bestScore = -Infinity;

    keys.forEach(k => {
      const current = p.skills[k] || 0;
      const target = totalAfter * prob[k];
      const deficit = target - current;

      // Tie-break slightly toward the class-weighted stat
      const score = deficit + prob[k] * 0.01;

      if (score > bestScore) {
        bestScore = score;
        bestKey = k;
      }
    });

    p.skills[bestKey] = (p.skills[bestKey] || 0) + 1;
    p.skillPoints -= 1;
  }

  // Recalc + heal like your manual "Increase" path expects
  recalcPlayerStats();
  p.hp = p.maxHp;
  p.resource = p.maxResource;
  updateHUD();

  // Build a nice log message showing what it did
  const deltas = keys
    .map(k => {
      const d = (p.skills[k] || 0) - (before[k] || 0);
      return d > 0 ? `+${d} ${k}` : null;
    })
    .filter(Boolean);

  addLog(
    `Auto-distributed ${pointsToSpend} skill point(s): ${deltas.join(', ')}.`,
    'good'
  );
}


  function openSkillLevelUpModal() {
  const p = state.player;
  if (!p) return;

  // Give exactly 1 point if somehow missing
  if (p.skillPoints == null) p.skillPoints = 0;
  if (p.skillPoints <= 0) p.skillPoints = 1;

  const closeBtn = document.getElementById('modalClose');
  if (closeBtn) closeBtn.style.display = 'none'; // force choice

  openModal('Level Up!', body => {
    const info = document.createElement('p');
    info.className = 'modal-subtitle';
    info.textContent =
      'You feel your power surge. Choose a skill to improve (1 point).';
    body.appendChild(info);

    const pointsEl = document.createElement('p');
    pointsEl.className = 'modal-subtitle';
    pointsEl.textContent = 'Unspent skill points: ' + p.skillPoints;
    body.appendChild(pointsEl);
    
    const autoBtn = document.createElement('button');
autoBtn.className = 'btn outline';
autoBtn.textContent = 'Auto Distribute';
autoBtn.addEventListener('click', () => {
  if (p.skillPoints <= 0) return;

  autoDistributeSkillPoints(p);

  // close out the forced-choice modal once points are spent
  closeModal();
});
body.appendChild(autoBtn);

    const skills = [
      {
        key: 'strength',
        name: 'Strength',
        desc: 'Increase physical power. +Attack.'
      },
      {
        key: 'endurance',
        name: 'Endurance',
        desc: 'Bolster toughness. +Max HP and a bit of Armor.'
      },
      {
        key: 'willpower',
        name: 'Willpower',
        desc: 'Sharpen arcane focus. +Magic and max resource.'
      }
    ];

    skills.forEach(s => {
      const row = document.createElement('div');
      row.className = 'item-row';

      const header = document.createElement('div');
      header.className = 'item-row-header';

      const left = document.createElement('div');
      left.innerHTML =
        '<span class="item-name">' + s.name + '</span>' +
        ' (Rank ' + p.skills[s.key] + ')';

      const right = document.createElement('div');
      right.className = 'item-meta';
      right.textContent = s.desc;

      header.appendChild(left);
      header.appendChild(right);

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = 'Increase';
      btn.addEventListener('click', () => {
        if (p.skillPoints <= 0) return;

        p.skills[s.key] += 1;
        p.skillPoints -= 1;

        recalcPlayerStats();
        p.hp = p.maxHp;          // full heal on level-up
        p.resource = p.maxResource;

        updateHUD();
        pointsEl.textContent = 'Unspent skill points: ' + p.skillPoints;

        addLog(
          'You increase ' + s.name + ' to rank ' + p.skills[s.key] + '.',
          'good'
        );

        if (p.skillPoints <= 0) {
          closeModal();
        } else {
          // update shown rank
          left.innerHTML =
            '<span class="item-name">' + s.name + '</span>' +
            ' (Rank ' + p.skills[s.key] + ')';
        }
      });

      actions.appendChild(btn);
      row.appendChild(header);
      row.appendChild(actions);
      body.appendChild(row);
    });
  });
}


  // --- COMBAT CORE --------------------------------------------------------------

  function calcPhysicalDamage(baseStat) {
    const enemy = state.currentEnemy;
    const diff = getActiveDifficultyConfig();
    const p = state.player;
    let base = baseStat + (p.status.buffAttack || 0);
    const armorFactor = 100 / (100 + (enemy.armor || 0) * 10);
    let dmg = base * armorFactor;
    const rand = 0.85 + Math.random() * 0.3;
    dmg *= rand;
    dmg *= diff.playerDmgMod;

    let crit = false;
    const critChance = state.flags.alwaysCrit ? 1 : 0.12;
    if (Math.random() < critChance) {
      dmg *= 1.8;
      crit = true;
    }
    dmg = Math.max(1, Math.round(dmg));

    if (crit) {
      addLog('Critical hit!', 'good');
    }
    return dmg;
  }

  function calcMagicDamage(baseStat) {
    const enemy = state.currentEnemy;
    const diff = getActiveDifficultyConfig();
    const p = state.player;
    let base = baseStat;
    const resist = 100 / (100 + (enemy.magicRes || 0) * 8);
    let dmg = base * resist;
    const rand = 0.85 + Math.random() * 0.3;
    dmg *= rand;
    dmg *= diff.playerDmgMod;

    let crit = false;
    const critChance = state.flags.alwaysCrit ? 1 : 0.1;
    if (Math.random() < critChance) {
      dmg *= 1.6;
      crit = true;
    }
    dmg = Math.max(1, Math.round(dmg));
    if (crit) {
      addLog('Arcane surge! Spell critically strikes.', 'good');
    }
    return dmg;
  }

  function calcEnemyDamage(baseStat, isMagic) {
    const p = state.player;
    const diff = getActiveDifficultyConfig();
    let base = baseStat;
    const defense = isMagic
      ? 100 / (100 + (p.magicRes || 0) * 8)
      : 100 / (100 + (p.stats.armor || 0) * 10);
    let dmg = base * defense;

    if (p.status.dmgReductionTurns > 0) {
      dmg *= 0.5;
    }

    const rand = 0.85 + Math.random() * 0.3;
    dmg *= rand;
    dmg *= diff.enemyDmgMod;

    const critChance = 0.08 + (diff.id === 'hard' ? 0.06 : 0);
    if (Math.random() < critChance) {
      dmg *= 1.5;
    }

    dmg = Math.max(1, Math.round(dmg));
    return dmg;
  }

  function playerBasicAttack() {
  if (!state.inCombat || !state.currentEnemy) return;
  const p = state.player;
  const enemy = state.currentEnemy;

  const dmg = calcPhysicalDamage(p.stats.attack * 1.0);
  enemy.hp -= dmg;

  addLog('You strike the ' + enemy.name + ' for ' + dmg + ' damage.', 'good');

  if (p.resourceKey === 'fury') {
    p.resource = Math.min(p.maxResource, p.resource + 8);
  } else if (p.resourceKey === 'blood') {
    p.resource = Math.min(p.maxResource, p.resource + 5);
  } else if (p.resourceKey === 'mana') {
    p.resource = Math.min(p.maxResource, p.resource + 4);
  }

  updateHUD();
  updateEnemyPanel();

  if (enemy.hp <= 0) {
    handleEnemyDefeat();
  } else {
    // Companion acts, might kill enemy
    companionActIfPresent();

    if (!state.inCombat || !state.currentEnemy) {
      return;
    }
    if (state.currentEnemy.hp <= 0) {
      handleEnemyDefeat();
    } else {
      enemyTurn();
    }
  }
}

  function enemyTurn() {
    if (!state.inCombat || !state.currentEnemy) return;
    const p = state.player;
    const enemy = state.currentEnemy;

    applyEndOfTurnEffectsEnemy(enemy);

    if (enemy.hp <= 0) {
      handleEnemyDefeat();
      return;
    }

    const action = decideEnemyAction(enemy, p);
    let dmg = 0;
    let isMagic = false;
    let desc = enemy.name + ' attacks!';

    if (action === 'heavy') {
      dmg = calcEnemyDamage(enemy.attack * 1.4, false);
      desc = enemy.name + ' uses a heavy strike for ' + dmg + ' damage!';
    } else if (action === 'guard') {
      enemy.guardTurns = 2;
      enemy.armorBuff = (enemy.armorBuff || 0) + 3;
      addLog(enemy.name + ' raises its guard, bolstering its defenses.', 'danger');
      postEnemyTurn();
      return;
    } else if (action === 'voidBreath') {
      dmg = calcEnemyDamage(enemy.magic * 1.7, true);
      isMagic = true;
      desc = enemy.name + ' exhales a wave of void‑flame for ' + dmg + ' damage!';
    } else if (action === 'skewer') {
      dmg = calcEnemyDamage(enemy.attack * 1.8, false);
      desc = enemy.name + ' lunges in a brutal skewer for ' + dmg + ' damage!';
    } else {
      dmg = calcEnemyDamage(enemy.attack, false);
      desc = enemy.name + ' strikes for ' + dmg + ' damage.';
    }

    let remaining = dmg;

    if (p.status.shield > 0) {
      const absorbed = Math.min(remaining, p.status.shield);
      p.status.shield -= absorbed;
      remaining -= absorbed;
      if (absorbed > 0) {
        addLog('Your shield absorbs ' + absorbed + ' damage.', 'system');
      }
    }

    if (remaining > 0) {
      if (state.flags.godMode) {
        addLog('God Mode: You ignore ' + remaining + ' damage.', 'system');
      } else {
        p.hp -= remaining;
      }
    }

    addLog(desc, 'danger');

    if (p.resourceKey === 'fury') {
      p.resource = Math.min(p.maxResource, p.resource + 10);
    }

    if (p.status.dmgReductionTurns > 0) {
      p.status.dmgReductionTurns -= 1;
      if (p.status.dmgReductionTurns <= 0) {
        addLog('Your Shield Wall fades.', 'system');
      }
    }

    updateHUD();

    if (p.hp <= 0 && !state.flags.godMode) {
      handlePlayerDefeat();
    } else {
      if (p.hp <= 0 && state.flags.godMode) {
        p.hp = 1;
        updateHUD();
      }
      postEnemyTurn();
    }
  }

  function applyEndOfTurnEffectsEnemy(enemy) {
    if (enemy.bleedTurns && enemy.bleedTurns > 0 && enemy.bleedDamage) {
      enemy.hp -= enemy.bleedDamage;
      enemy.bleedTurns -= 1;
      addLog(enemy.name + ' bleeds for ' + enemy.bleedDamage + ' damage.', 'good');
      if (enemy.bleedTurns <= 0) {
        addLog(enemy.name + '\'s bleeding slows.', 'system');
      }
    }
  }

  function decideEnemyAction(enemy, player) {
    const diff = getActiveDifficultyConfig();
    const smart = diff.aiSmartness;
    const available = [];

    available.push('attack');

    if (enemy.isBoss) {
      if (enemy.behavior === 'bossGoblin') {
        available.push('heavy', 'guard');
      } else if (enemy.behavior === 'bossDragon') {
        available.push('heavy', 'voidBreath');
      }
    } else {
      if (enemy.behavior === 'aggressive') {
        available.push('heavy');
      } else if (enemy.behavior === 'cunning') {
        available.push('heavy', 'guard');
      } else if (enemy.behavior === 'caster') {
        available.push('voidBreath');
      }
    }

    if (Math.random() > smart) {
      return available[Math.floor(Math.random() * available.length)];
    }

    let bestAction = 'attack';
    let bestScore = -Infinity;

    available.forEach(act => {
      let score = 0;
      if (act === 'attack') {
        const dmg = calcEnemyDamage(enemy.attack, false);
        score = dmg;
      } else if (act === 'heavy') {
        const dmg = calcEnemyDamage(enemy.attack * 1.4, false);
        score = dmg * 1.1;
      } else if (act === 'voidBreath') {
        const dmg = calcEnemyDamage(enemy.magic * 1.7, true);
        score = dmg * 1.2;
      } else if (act === 'guard') {
        score = 12;
        if (enemy.hp < enemy.maxHp * 0.4) score += 10;
      }

      if (player.hp <= calcEnemyDamage(
        act === 'heavy' ? enemy.attack * 1.4 :
          act === 'voidBreath' ? enemy.magic * 1.7 :
            enemy.attack,
        act === 'voidBreath')) {
        score += 50;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAction = act;
      }
    });

    return bestAction;
  }

  function postEnemyTurn() {
    const p = state.player;
        if (p.resourceKey === 'mana') {
      p.resource = Math.min(p.maxResource, p.resource + 6);
    } else if (p.resourceKey === 'essence') {
      // Essence = dark mana; regenerates a bit slower than pure mana
      p.resource = Math.min(p.maxResource, p.resource + 5);
    } else if (p.resourceKey === 'blood') {
      p.resource = Math.min(p.maxResource, p.resource + 4);
    }
      updateHUD();
  updateEnemyPanel();
  // tick companion cooldowns once per full round
  tickCompanionCooldowns();
  }
  
  function recordBattleResult(outcome) {
  if (state.difficulty !== 'dynamic') return;

  if (!state.dynamicDifficulty) {
    state.dynamicDifficulty = {
      band: 0,
      tooEasyStreak: 0,
      struggleStreak: 0
    };
  }

  const dd = state.dynamicDifficulty;
  const p = state.player || { hp: 0, maxHp: 1 };

  if (outcome === 'win') {
    let hpRatio = 0;
    if (p.maxHp > 0) {
      hpRatio = p.hp / p.maxHp;
    }

    if (hpRatio >= 0.8) {
      dd.tooEasyStreak = (dd.tooEasyStreak || 0) + 1;
      dd.struggleStreak = 0;
    } else if (hpRatio <= 0.3) {
      dd.struggleStreak = (dd.struggleStreak || 0) + 1;
      dd.tooEasyStreak = 0;
    } else {
      dd.tooEasyStreak = 0;
      dd.struggleStreak = 0;
    }
  } else if (outcome === 'loss') {
    dd.struggleStreak = (dd.struggleStreak || 0) + 2;
    dd.tooEasyStreak = 0;
  }

  const threshold = 3;
  let changed = false;

  // ramp up when it's too easy
  if (dd.tooEasyStreak >= threshold && dd.band < 2) {
    dd.band += 1;
    dd.tooEasyStreak = 0;
    changed = true;
    addLog(
      'The realm grows more dangerous as you dominate your foes.',
      'system'
    );
  }
  // ramp down when you're struggling
  else if (dd.struggleStreak >= threshold && dd.band > -2) {
    dd.band -= 1;
    dd.struggleStreak = 0;
    changed = true;
    addLog(
      'The realm seems to ease up as your struggles are noticed.',
      'system'
    );
  }

  if (changed) {
    updateHUD();
    saveGame();
  }
}

  function handleEnemyDefeat() {
    const enemy = state.currentEnemy;
    state.inCombat = false;
    addLog('You defeated the ' + enemy.name + '!', 'good');

    const xp = enemy.xp;
    const gold = enemy.goldMin + Math.floor(Math.random() * (enemy.goldMax - enemy.goldMin + 1));
    addLog('You gain ' + xp + ' XP and ' + gold + ' gold.', 'good');

    state.player.gold += gold;
    grantExperience(xp);

    if (!enemy.isBoss || enemy.id === 'goblinBoss') {
      if (Math.random() < 0.7) {
        const lootId = rollLootForArea();
        if (lootId) {
          addItemToInventory(lootId, 1);
          const lootName = ITEM_DEFS[lootId].name;
          addLog('You loot ' + lootName + ' from the corpse.', 'good');
        }
      }
    }

    if (enemy.id === 'goblinBoss') {
      state.flags.goblinBossDefeated = true;
      state.quests.main.step = Math.max(state.quests.main.step, 2);
      addLog('The Goblin Warlord falls. The forest grows quieter.', 'system');
      setScene('Emberwood Forest – Cleared',
        'You stand over the fallen Goblin Warlord. The path to the Ruined Spire reveals itself in the distance.');
      state.area = 'ruins';
      updateQuestBox();
    } else if (enemy.id === 'dragon') {
      state.flags.dragonDefeated = true;
      state.quests.main.step = 3;
      state.quests.main.status = 'completed';
      addLog('With a final roar, the Void‑Touched Dragon collapses.', 'system');
      setScene('Ruined Spire – Silent',
        'The Dragon is slain. Emberwood will sing of your deeds for generations.');
      updateQuestBox();
    }
	
	// NEW: village economy reacts to monsters you clear near trade routes
    handleEconomyAfterBattle(state, enemy, state.area);

    // tell dynamic difficulty we won a fight
    recordBattleResult('win');

    state.currentEnemy = null;
    updateHUD();
    updateEnemyPanel();
    renderActions();
    saveGame();
  }

  function handlePlayerDefeat() {
	  // inform dynamic difficulty system of the loss
  recordBattleResult('loss');
    addLog('You fall to the ground, defeated.', 'danger');
    state.inCombat = false;
    state.currentEnemy = null;
    updateHUD();
    openModal('Defeat', body => {
      const p = document.createElement('p');
      p.className = 'modal-subtitle';
      p.textContent = 'Your journey ends here... but legends often get second chances.';
      body.appendChild(p);

      const row = document.createElement('div');
      row.className = 'item-actions';

      const btnLoad = document.createElement('button');
      btnLoad.className = 'btn outline';
      btnLoad.textContent = 'Load Last Save';
      btnLoad.addEventListener('click', () => {
        closeModal();
        loadGame(true);
      });

      const btnMenu = document.createElement('button');
      btnMenu.className = 'btn outline';
      btnMenu.textContent = 'Main Menu';
      btnMenu.addEventListener('click', () => {
        closeModal();
        switchScreen('mainMenu');
      });

      row.appendChild(btnLoad);
      row.appendChild(btnMenu);
      body.appendChild(row);
    });
  }

  function tryFlee() {
    if (!state.inCombat || !state.currentEnemy) return;
    const chance = 0.45;
    if (Math.random() < chance) {
      addLog('You slip away from the fight.', 'system');
      state.inCombat = false;
      state.currentEnemy = null;
      setScene('On the Path',
        'You catch your breath after fleeing. The forest remains dangerous, but you live to fight again.');
      updateHUD();
	  updateEnemyPanel();
      renderActions();
      saveGame();
    } else {
      addLog('You fail to escape!', 'danger');
      enemyTurn();
    }
  }

  function rollLootForArea() {
    if (state.area === 'forest') {
      return 'potionSmall';
    }
    if (state.area === 'ruins') {
      const options = ['potionSmall', 'potionSmall', 'potionMana', 'potionFury', 'potionBlood'];
      return options[Math.floor(Math.random() * options.length)];
    }
    return null;
  }
  // --- COMPANION LOGIC ----------------------------------------------------------

function createCompanionInstance(id) {
  const def = COMPANION_DEFS[id];
  if (!def) return null;
  const p = state.player;
  const level = p ? p.level : 1;

  // Scale a bit with player level
  const atk = def.baseAttack + Math.floor(level * 1.5);
  const hpBonus = def.baseHpBonus + Math.floor(level * 4);

    return {
    id: def.id,
    name: def.name,
    role: def.role,
    behavior: def.behavior,
    description: def.description,
    attack: atk,
    hpBonus: hpBonus,
    abilities: def.abilities ? [...def.abilities] : [],
    abilityCooldowns: {},    // runtime
    lastAbilityUsed: null,
    wardActive: false,
    mirrorReflectTurns: 0
  };
}

function grantCompanion(id) {
  const inst = createCompanionInstance(id);
  if (!inst) {
    addLog('Failed to summon companion.', 'system');
    return;
  }
  state.companion = inst;
  addLog(inst.name + ' agrees to join your journey.', 'good');

  // Apply any passive hp bonus
  if (state.player && inst.hpBonus) {
    state.player.maxHp += inst.hpBonus;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + inst.hpBonus);
    updateHUD();
  }
  saveGame();
}

function dismissCompanion() {
  if (!state.companion) return;
  addLog(state.companion.name + ' leaves your side.', 'system');

  // Remove hp bonus if any
  const inst = state.companion;
  if (state.player && inst.hpBonus) {
    state.player.maxHp = Math.max(1, state.player.maxHp - inst.hpBonus);
    if (state.player.hp > state.player.maxHp) {
      state.player.hp = state.player.maxHp;
    }
    updateHUD();
  }

  state.companion = null;
  saveGame();
}

// Companion acts after the player's turn, before the enemy
function companionActIfPresent() {
  const comp = state.companion;
  const enemy = state.currentEnemy;
  const p = state.player;
  if (!comp || !enemy || !state.inCombat || !p) return;

  // --- Ensure learning memory exists ------------------------------------------------
  if (!comp.memory) {
    comp.memory = {
      abilityStats: {},   // abilityId -> { value: number, uses: number, wins: number }
      exploration: 0.2    // epsilon initial exploration prob (decays slowly)
    };
  }

  // helper: ensure an ability stats container
  function ensureAbilityStat(aid) {
    if (!comp.memory.abilityStats[aid]) {
      comp.memory.abilityStats[aid] = { value: 0, uses: 0, wins: 0 };
    }
    return comp.memory.abilityStats[aid];
  }

  // small helper to estimate immediate expected damage for plain attack
  function estimatePlainDamage() {
    // calcCompanionDamage(comp, useMagic) returns a realistic damage number
    try {
      return Math.max(1, calcCompanionDamage(comp, false));
    } catch (e) {
      return comp.attack || 6;
    }
  }

  // enhanced scoring that blends heuristic + learned value
  function scoreAbility(abilityId) {
    const ab = COMPANION_ABILITIES[abilityId];
    if (!ab) return -9999;
	// Don't recast ward if one is already active
if (ab.type === 'ward' && comp.wardActive) {
  return -9999;
}
    if (!canUseCompanionAbility(comp, abilityId)) return -9999;

    // base heuristic (reuse your existing logic with expansions)
    let score = 0;
    const potency = ab.potency || 1;
    score += potency * 12;

    const remainingCd = comp.abilityCooldowns && comp.abilityCooldowns[abilityId] ? comp.abilityCooldowns[abilityId] : 0;
    score -= remainingCd * 2;

    const playerHpPct = p.hp / Math.max(1, p.maxHp);
    const enemyHpPct = enemy.hp / Math.max(1, enemy.maxHp);

    // Heal
        // Heal
    if (ab.type === 'heal') {
      // HARD SAFETY: don't use heal abilities if player is essentially full
      const playerHpPct = p.hp / Math.max(1, p.maxHp);
      if (playerHpPct >= 0.95) {
        // player is basically full — avoid using heal at all
        return -9999;
      }

      score += (1 - playerHpPct) * 80;
      if (enemyHpPct < 0.25) score -= 15;
    }
	// --- Proactive ward logic ---------------------------------------
if (ab.type === 'ward') {
  // Strong preference early in fight (before damage spikes)
  if (enemyHpPct > 0.65 && !comp.wardActive) {
    score += 45;
  }

  // If no ward is active, value rises regardless of HP
  if (!comp.wardActive) {
    score += 20;
  }
  
}

    // Shield / ward
    if (ab.type === 'shield+damage' || ab.type === 'ward') {
      const missing = p.maxHp - p.hp;
      score += Math.min(40, (missing / Math.max(1, p.maxHp)) * 50);
      if (!p.status.shield || p.status.shield < 6) score += 6;
    }

    // Damage / debuff
    if (ab.type === 'damage' || ab.type === 'damage+debuff') {
      score += enemyHpPct * 40;
      const expected = (comp.attack || 6) * potency * 0.9;
      if (expected >= enemy.hp - 6) score += 60;
    }

    // Debuff synergy
    if (ab.type === 'damage+debuff') {
      if (!enemy.debuffTurns || enemy.debuffTurns <= 0) score += 18;
      if (p.status && p.status.buffFromCompanionTurns && p.status.buffFromCompanionTurns > 0) score += 10;
    }

    // Resource need
    if (ab.type === 'resource') {
      const resourcePct = p.resource / Math.max(1, p.maxResource);
      score += (1 - resourcePct) * 60;
    }

    if (ab.critSpike && (p.stats.crit > 12 || enemyHpPct > 0.6)) score += 12;

    score -= (ab.cooldown || 3) * 1.2;

    // difficulty-based noise
    const smart = getActiveDifficultyConfig().aiSmartness || 0.7;
    const noise = (Math.random() - 0.5) * (1 - smart) * 6;
    score += noise;

    // --- incorporate learned value (expected utility) ---
    const stat = ensureAbilityStat(abilityId);
    // scale learned value into same domain as score
    // stat.value is an on-line estimate of reward (higher = better)
    score += stat.value * 10; // weight learned experience

    // small penalty if ability was used heavily (to encourage exploration)
    score -= Math.log(1 + stat.uses) * 0.9;

    return score;
  }

  // --- choose best ability using epsilon-greedy exploration ---
  const readyAbilities = (comp.abilities || []).filter(aid => canUseCompanionAbility(comp, aid));
  let chosenAbility = null;
  let chosenScore = -Infinity;

  if (readyAbilities.length > 0) {
    // compute scores
    const scored = readyAbilities.map(aid => ({ id: aid, score: scoreAbility(aid) }));
    // pick greedy best normally
    scored.forEach(s => {
      if (s.score > chosenScore) {
        chosenScore = s.score;
        chosenAbility = s.id;
      }
    });

    // epsilon-greedy: occasionally explore a random ready ability
    const eps = Math.max(0.03, comp.memory.exploration || 0.15);
    if (Math.random() < eps && readyAbilities.length > 1) {
      // choose a random other ability (not necessarily best)
      const pool = readyAbilities.filter(aid => aid !== chosenAbility);
      const rand = pool[Math.floor(Math.random() * pool.length)];
      if (rand) {
        chosenAbility = rand;
        chosenScore = scoreAbility(rand);
      }
      // decay exploration slightly to favor exploitation over time
      comp.memory.exploration = Math.max(0.03, (comp.memory.exploration || 0.2) * 0.995);
    }
  }

  // --- compute "damage baseline" as the fallback option ---
  const plainDamageEstimate = estimatePlainDamage();
  // represent fallback damage as a comparative score
  const damageFallbackScore = plainDamageEstimate * 8; // scaled into same domain as score

  // If no ability chosen or chosen ability isn't better than a plain attack, do plain damage.
  if (!chosenAbility || chosenScore < damageFallbackScore - 6) {
    // Default to doing damage (most basic behavior)
    const dmg = Math.max(1, calcCompanionDamage(comp, false));
    enemy.hp -= dmg;
    addLog(comp.name + ' strikes for ' + dmg + ' damage.', 'good');

    // small learning update: reward "attack" as a pseudo-ability so AI can learn if plain attacks are often best
    const pseudo = '_plainAttack';
    if (!comp.memory.abilityStats[pseudo]) comp.memory.abilityStats[pseudo] = { value: 0, uses: 0, wins: 0 };
    const stat = comp.memory.abilityStats[pseudo];
    stat.uses += 1;
    // reward scaled by damage and if it killed
    let reward = dmg / Math.max(1, enemy.maxHp) * 1.0;
    if (enemy.hp <= 0) reward += 2.0;
    stat.value = (stat.value * (stat.uses - 1) + reward) / stat.uses;

    // After dealing damage, check defeat
    if (enemy.hp <= 0) {
      handleEnemyDefeat();
      return;
    }
    return;
  }

  // --- Use chosen ability and immediately measure outcome for learning ------------
  // Snapshot pre-use values to compute observed reward
  const preEnemyHp = enemy.hp;
  const prePlayerHp = p.hp;
  const desc = useCompanionAbility(comp, chosenAbility) || '';
  const postEnemyHp = enemy.hp;
  const postPlayerHp = p.hp;

  // Compute immediate numeric reward:
  //   damageReward: fraction of enemy HP removed (normalized)
  //   healReward: fraction of player HP restored
  //   kill bonus if enemy dies
  const dmgDone = Math.max(0, preEnemyHp - postEnemyHp);
  const healDone = Math.max(0, postPlayerHp - prePlayerHp);
  let reward = 0;
  if (dmgDone > 0) reward += (dmgDone / Math.max(1, enemy.maxHp)) * 1.2;
  if (healDone > 0) reward += (healDone / Math.max(1, p.maxHp)) * 1.5;
  if (postEnemyHp <= 0) reward += 2.0; // finishing blow highly rewarded

  // small extra reward if ability applied useful debuff/shield (heuristic based)
  const abUsed = COMPANION_ABILITIES[chosenAbility] || {};
  if (abUsed.type === 'damage+debuff' && (!enemy.debuffTurns || enemy.debuffTurns > 0)) {
    reward += 0.4;
  }
  if (abUsed.type === 'shield+damage' && p.status && p.status.shield && p.status.shield > 0) {
    reward += 0.35;
  }
  if (abUsed.type === 'ward' && comp.wardActive) {
    reward += 0.3;
  }
  // --- FIX 2: Delayed ward value estimation ---------------------------------
if (abUsed.type === 'ward') {
  // Estimate future value of the ward (healing over remaining turns)
  const expectedHeal =
    (comp.wardPotency || 0.05) * p.maxHp * (comp.wardTurns || 2);

  // Convert to normalized reward and boost it
  reward += (expectedHeal / p.maxHp) * 1.4;
}

  // Update ability stats (online averaging)
  const stat = ensureAbilityStat(chosenAbility);
  stat.uses += 1;
  stat.wins += postEnemyHp <= 0 ? 1 : 0;
  // exponential moving average-like update (alpha tuned by uses)
  const alpha = 1 / Math.max(4, Math.min(20, stat.uses)); // more stable over time
  stat.value = (1 - alpha) * stat.value + alpha * reward;

  // Logging & UI updates
  if (desc) addLog(desc, 'good');
  updateHUD();
  updateEnemyPanel();

  // If ability killed the enemy, handle defeat
  if (postEnemyHp <= 0) {
    handleEnemyDefeat();
    return;
  }

  // Done with companion action
  return;
}

function calcCompanionDamage(companion, isMagic) {
  const enemy = state.currentEnemy;
  if (!enemy) return 0;

  const base = companion.attack;
  const defense = isMagic
    ? 100 / (100 + (enemy.magicRes || 0) * 8)
    : 100 / (100 + (enemy.armor || 0) * 7);

  let dmg = base * defense;
  const rand = 0.85 + Math.random() * 0.3;
  dmg *= rand;

  // Companions ignore difficulty scaling (they are "neutral")
  dmg = Math.max(1, Math.round(dmg));
  return dmg;
}

function canUseCompanionAbility(comp, abilityId) {
  if (!comp || !comp.abilities) return false;
  const ab = COMPANION_ABILITIES[abilityId];
  if (!ab) return false;
  const cd = comp.abilityCooldowns && comp.abilityCooldowns[abilityId];
  return !cd || cd <= 0;
}

// Execute ability: returns textual description
function useCompanionAbility(comp, abilityId) {
  const enemy = state.currentEnemy;
  const p = state.player;
  const ab = COMPANION_ABILITIES[abilityId];
  if (!ab || !comp) return '';

  // mark cooldown
  comp.abilityCooldowns[abilityId] = ab.cooldown || 3;
  comp.lastAbilityUsed = abilityId;

  // apply effects by type
  if (ab.type === 'damage') {
    // scale off companion attack and potency
    const baseStat = Math.round((comp.attack + (p.stats.attack || 0) * 0.15) * (ab.potency || 1));
    let dmg = Math.max(1, Math.round(baseStat * (0.9 + Math.random() * 0.3)));
    // extra talon crit spike simulation
    if (ab.critSpike && Math.random() < ab.critSpike) {
      const spike = Math.round(dmg * 0.6);
      dmg += spike;
      addLog(comp.name + ' lands a devastating strike for ' + spike + ' bonus damage!', 'good');
    }
    enemy.hp -= dmg;
    if (ab.stunTurns) enemy.stunTurns = (enemy.stunTurns || 0) + ab.stunTurns;
    return comp.name + ' uses ' + ab.name + ', dealing ' + dmg + ' damage.';
  } else if (ab.type === 'shield+damage') {
    const dmg = Math.round(comp.attack * (ab.potency || 1.0));
    enemy.hp -= dmg;
    const shield = Math.round((ab.shieldBase || 10) + p.level * 1.5);
    p.status.shield = (p.status.shield || 0) + shield;
    return comp.name + ' uses ' + ab.name + ': deals ' + dmg + ' and grants ' + shield + ' shield.';
  } else if (ab.type === 'heal') {
    // heal more if player is low
    const missing = Math.max(0, p.maxHp - p.hp);
    const healAmount = Math.max(5, Math.round(p.maxHp * (ab.potency || 0.25) + missing * 0.12));
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + healAmount);
    return comp.name + ' uses ' + ab.name + ' and restores ' + (p.hp - before) + ' HP.';
  } else if (ab.type === 'damage+debuff') {
    const dmg = Math.round(comp.attack * (ab.potency || 1.0));
    enemy.hp -= dmg;
    enemy.attack = Math.max(0, (enemy.attack || 0) - (ab.atkDown || 2));
    enemy.debuffTurns = (enemy.debuffTurns || 0) + (ab.debuffTurns || 2);
    return comp.name + ' uses ' + ab.name + ', deals ' + dmg + ' and reduces enemy Attack.';
  } else if (ab.type === 'ward') {
    comp.wardActive = true;
    comp.wardTurns = ab.wardTurns || 3;
    // persist potency so tick logic can heal per-turn correctly
    comp.wardPotency = ab.potency || 0.06;
    comp.wardSource = abilityId;

    // immediate small heal (keeps immediate feel), but the ongoing heal will happen each enemy turn
    const heal = Math.round(p.maxHp * comp.wardPotency);
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + heal);
    const actual = p.hp - before;
    return comp.name + ' plants a ward for ' + comp.wardTurns + ' turns and restores ' + actual + ' HP.';
  } else if (ab.type === 'resource') {
    const gain = Math.max(4, Math.round(p.maxResource * (ab.potency || 0.35)));
    const before = p.resource;
    p.resource = Math.min(p.maxResource, p.resource + gain);
    p.status.buffFromCompanion = (p.status.buffFromCompanion || 0) + 1; // simple short buff marker
    p.status.buffFromCompanionTurns = ab.buffTurns || 1;
    return comp.name + ' uses ' + ab.name + ', restoring ' + (p.resource - before) + ' ' + p.resourceName + '.';
  } else if (ab.type === 'damage+reflect') {
    const dmg = Math.round(comp.attack * (ab.potency || 1.0));
    enemy.hp -= dmg;
    comp.mirrorReflectTurns = ab.reflectTurns || 2;
    comp.mirrorReflectPct = ab.reflectPct || 0.35;
    return comp.name + ' uses ' + ab.name + ', deals ' + dmg + ' and will reflect some damage for ' + comp.mirrorReflectTurns + ' turns.';
  }

  return '';
}

function tickCompanionCooldowns() {
  const c = state.companion;
  if (!c) return;

  // cooldowns
  if (c.abilityCooldowns) {
    Object.keys(c.abilityCooldowns).forEach(k => {
      if (!c.abilityCooldowns[k]) return;
      // defensive guard to ensure numeric
      c.abilityCooldowns[k] = Math.max(0, Number(c.abilityCooldowns[k] || 0) - 1);
    });
  }

  // ward ticking + per-turn heal (if present)
  if (c.wardActive) {
    // apply heal at end of enemy turn for the player (if they are hurt)
    const p = state.player;
    if (p && c.wardPotency && p.hp < p.maxHp) {
      const heal = Math.max(1, Math.round(p.maxHp * c.wardPotency));
      const before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const actual = p.hp - before;
      if (actual > 0) {
        addLog(c.name + "'s ward restores " + actual + " HP.", 'good');
      }
      updateHUD();
    }

    c.wardTurns = Math.max(0, (c.wardTurns || 0) - 1);
    if (!c.wardTurns) {
      c.wardActive = false;
      // clear potency/source for cleanliness
      c.wardPotency = 0;
      c.wardSource = null;
      addLog(c.name + "'s ward fades.", 'system');
    }
  }

  // mirror reflect countdown
  if (c.mirrorReflectTurns && c.mirrorReflectTurns > 0) {
    c.mirrorReflectTurns = Math.max(0, c.mirrorReflectTurns - 1);
    if (c.mirrorReflectTurns === 0) {
      addLog(c.name + "'s reflection subsides.", 'system');
    }
  }
}

  function startBattleWith(templateId) {
    const template = ENEMY_TEMPLATES[templateId];
    if (!template) return;

    const diff = getActiveDifficultyConfig();
    const enemy = JSON.parse(JSON.stringify(template));
    enemy.maxHp = Math.round(enemy.maxHp * diff.enemyHpMod);
    enemy.hp = enemy.maxHp;
    enemy.attack = Math.round(enemy.attack * diff.enemyDmgMod);
    enemy.armorBuff = 0;
    enemy.guardTurns = 0;
    enemy.bleedTurns = 0;
    enemy.bleedDamage = 0;

    state.currentEnemy = enemy;
    state.inCombat = true;

    const tags = enemy.isBoss ? ' [Boss]' : '';
    setScene('Battle – ' + enemy.name,
      enemy.name + tags + ' stands in your way.');
    addLog('A ' + enemy.name + ' appears!', enemy.isBoss ? 'danger' : 'system');
    renderActions();
	updateEnemyPanel();   // 👈 NEW
    saveGame();
  }
  // --- AREA / EXPLORATION UI ----------------------------------------------------

function ensureUiState() {
  if (!state.ui) {
    state.ui = { exploreChoiceMade: false };
  } else if (typeof state.ui.exploreChoiceMade === 'undefined') {
    state.ui.exploreChoiceMade = false;
  }
}

function isAreaUnlocked(areaId) {
  const flags = state.flags || {};

  if (areaId === 'village') return true;

  if (areaId === 'forest') {
    // Forest opens after you’ve met the Elder or cleared later stuff
    return !!(flags.metElder || flags.goblinBossDefeated || flags.dragonDefeated);
  }

  if (areaId === 'ruins') {
    // Ruins open after Goblin Warlord is defeated (or later)
    return !!(flags.goblinBossDefeated || flags.dragonDefeated);
  }

  return false;
}

function getAreaDisplayName(areaId) {
  if (areaId === 'village') return 'Emberwood Village';
  if (areaId === 'forest') return 'Emberwood Forest';
  if (areaId === 'ruins') return 'Ruined Spire';
  return areaId;
}
// Main handler for clicking the Explore button
// 🔸 Explore should NEVER open the area picker – it just explores the current area.
function handleExploreClick() {
  exploreArea();
}

// Area selection modal
function openExploreModal() {
  ensureUiState();
  if (!state.player) return;

  openModal('Choose Where to Explore', body => {
    const intro = document.createElement('p');
    intro.className = 'modal-subtitle';
    intro.textContent =
      'Pick a region to travel to. After choosing, the Explore button will keep using that region until you change it.';
    body.appendChild(intro);

    const areas = [
      {
        id: 'village',
        desc: 'Talk to Elder Rowan, visit the merchant, or rest between journeys.'
      },
      {
        id: 'forest',
        desc: 'Hunt wolves and goblins beneath Emberwood’s twisted canopy.'
      },
      {
        id: 'ruins',
        desc: 'Climb the shattered spire and face void-touched horrors.'
      }
    ];

    areas.forEach(info => {
      const unlocked = isAreaUnlocked(info.id);
      const name = getAreaDisplayName(info.id);

      const row = document.createElement('div');
      row.className = 'item-row';

      const header = document.createElement('div');
      header.className = 'item-row-header';

      const left = document.createElement('div');
      left.innerHTML = '<span class="item-name">' + name + '</span>';

      const right = document.createElement('div');
      right.className = 'item-meta';
      if (info.id === state.area) {
        right.textContent = 'Current area';
      } else {
        right.textContent = unlocked ? 'Available' : 'Locked';
      }

      header.appendChild(left);
      header.appendChild(right);

      const desc = document.createElement('div');
      desc.style.fontSize = '0.75rem';
      desc.style.color = 'var(--muted)';
      desc.textContent = info.desc;

      row.appendChild(header);
      row.appendChild(desc);

      const actions = document.createElement('div');
      actions.className = 'item-actions';

      const btn = document.createElement('button');
      btn.className = 'btn small' + (unlocked ? '' : ' outline');
      btn.textContent = unlocked ? 'Travel & Explore' : 'Locked';
      btn.disabled = !unlocked;

      if (unlocked) {
        btn.addEventListener('click', () => {
  // Lock in this choice for repeated exploring
  state.area = info.id;
  state.ui.exploreChoiceMade = true;

  // If we leave the village, make sure village submenu state is closed
  state.ui.villageActionsOpen = false;

  addLog('You travel to ' + name + '.', 'system');

  closeModal();

  // ✅ Rebuild the action bar immediately so Village / Realm buttons disappear
  renderActions();

  exploreArea();
  saveGame();
});
      }

      actions.appendChild(btn);
      row.appendChild(actions);
      body.appendChild(row);
    });

    const hint = document.createElement('p');
    hint.className = 'modal-subtitle';
    hint.textContent =
      'Tip: Use “Change Area” on the main screen any time you want to pick a different region.';
    body.appendChild(hint);
  });
}

  // --- EXPLORATION & QUESTS -----------------------------------------------------

  function exploreArea() {
  const area = state.area;
  const mainQuest = state.quests.main;
    // Advance world time by one part-of-day whenever you explore
  const timeStep = advanceTime(state, 1);
  const timeLabel = formatTimeShort(timeStep.after);

  if (timeStep.dayChanged) {
    addLog('A new day begins in Emberwood. ' + timeLabel + '.', 'system');
  } else {
    addLog('Time passes... ' + timeLabel + '.', 'system');
  }
  updateTimeDisplay();
  // NEW: update ambient music based on area + time
  updateAreaMusic();

  // Let the village economy, kingdom government, town hall & population drift once per new day
  if (timeStep.dayChanged) {
    handleEconomyDayTick(state, timeStep.after.absoluteDay);
    handleGovernmentDayTick(state, timeStep.after.absoluteDay, { addLog });
    handleTownHallDayTick(state, timeStep.after.absoluteDay, { addLog });
    handlePopulationDayTick(state, timeStep.after.absoluteDay, { addLog });  // ← add this
  }

  // --- VILLAGE LOGIC ---------------------------------------------------------
if (area === 'village') {
  // First visit: meet elder
  if (!state.flags.metElder) {
    state.flags.metElder = true;
    mainQuest.step = 1;
    setScene(
      'Elder Rowan',
      'In a lantern-lit hall, Elder Rowan explains: goblins in Emberwood Forest raid caravans. Their Warlord must fall.'
    );
    addLog('You speak with Elder Rowan and accept the task.', 'system');
    updateQuestBox();
    saveGame();
    return;
  }
  // Before Goblin Warlord is dead: reminder only, no auto-travel
  // Before Goblin Warlord is dead: show this ONLY once as a hint
  else if (!state.flags.goblinBossDefeated) {
    if (!state.flags.goblinWhisperShown) {
      addLog(
        'The villagers whisper about goblins in Emberwood Forest. You can travel there any time using "Change Area".',
        'system'
      );
      state.flags.goblinWhisperShown = true;
      updateQuestBox();
      saveGame();
      // No return – you stay in the village and can keep exploring
    }
    // If goblinWhisperShown is already true, we do nothing special here.
  }
  // AFTER final boss is dead: show flavor but DO NOT block exploration
  else if (state.flags.dragonDefeated) {
    setScene(
      'Village Feast',
      'The village celebrates your victory over the Dragon. War-stories and songs greet you – but the world beyond is still dangerous.'
    );
    addLog(
      'You are a legend here, but monsters still lurk outside Emberwood.',
      'system'
    );
    saveGame();
    // Still no return – you remain free to explore.
  }
}

  // --- FOREST LOGIC ----------------------------------------------------------
  if (area === 'forest') {
    if (!state.flags.goblinBossDefeated) {
      // Chance to find Goblin Warlord camp
      if (Math.random() < 0.3) {
        setScene(
          "Goblin Warlord's Camp",
          'After following tracks and ash, you discover the Goblin Warlord\'s fortified camp.'
        );
        addLog('The Goblin Warlord roars a challenge!', 'danger');
        startBattleWith('goblinBoss');
        return;
      }
    }
    // If the boss is dead, the forest just uses normal encounters
  }

  // --- RUINS LOGIC -----------------------------------------------------------
  if (area === 'ruins') {
    if (!state.flags.dragonDefeated) {
      // Chance to trigger the final boss
      if (Math.random() < 0.4) {
        setScene(
          'The Ruined Spire',
          'Atop a crumbling spire, the Void-Touched Dragon coils around shards of crystal, hatred in its eyes.'
        );
        addLog('The Void-Touched Dragon descends from the darkness!', 'danger');
        startBattleWith('dragon');
        return;
      }
    }
    // AFTER dragon is defeated, we NO LONGER early-return here.
    // We let the generic random-encounter system handle exploring
    // (voidspawn, etc.) so the game stays alive.
  }
  
    // --- WANDERING MERCHANT (outside village) ---------------------------------
  if (area !== 'village') {
    // Small chance each explore click to meet a traveling merchant
    if (Math.random() < 0.10) {
      let sceneText =
        'Along the road, a lone cart creaks to a stop. A cloaked figure raises a hand in greeting.';

      if (area === 'forest') {
        sceneText =
          'Deeper in the forest, a lantern glows between the trees – a traveling merchant has set up a tiny camp.';
      } else if (area === 'ruins') {
        sceneText =
          'Among the shattered stones of the Spire, a daring merchant has laid out wares on a cracked pillar.';
      }

            setScene('Wandering Merchant', sceneText);
      addLog('You encounter a wandering merchant on your travels.', 'system');
      openMerchantModal('wandering'); // NEW: different context
      saveGame();
      return;
    }
  }

  // --- GENERIC RANDOM ENCOUNTER LOGIC ---------------------------------------
  const encounterList = RANDOM_ENCOUNTERS[area] || [];
  if (encounterList.length && Math.random() < 0.7) {
    const id = encounterList[Math.floor(Math.random() * encounterList.length)];
    startBattleWith(id);
    return;
  }

  // --- NO ENCOUNTER: FLAVOR TEXT --------------------------------------------
  let title = 'Exploring';
  let text =
    'You search the surroundings but find only rustling leaves and distant cries.';

  if (area === 'village') {
    title = 'Emberwood Village';
    text =
      'You wander the streets of Emberwood. The tavern buzzes, the market clinks with coin, and gossip drifts on the air.';
  } else if (area === 'ruins' && state.flags.dragonDefeated) {
    title = 'Quiet Ruins';
    text =
      'The Spire lies quiet now, yet echoes of past horrors linger. Lesser creatures still prowl the broken halls.';
  } else if (area === 'forest' && state.flags.goblinBossDefeated) {
    title = 'Calmer Forest';
    text =
      'With the Warlord gone, Emberwood Forest feels less hostile – but not entirely safe.';
  }

    setScene(title, text);
  addLog('You explore cautiously. For now, nothing attacks.', 'system');

  // ✅ Make sure the actions bar matches the *current* area
  renderActions();

  saveGame();
}

  // --- EXPERIENCE & LEVELING ----------------------------------------------------

  function grantExperience(amount) {
    const p = state.player;
    let remaining = amount;
    while (remaining > 0) {
      const toNext = p.nextLevelXp - p.xp;
      if (remaining >= toNext) {
        p.xp += toNext;
        remaining -= toNext;
        levelUp();
      } else {
        p.xp += remaining;
        remaining = 0;
      }
    }
    updateHUD();
    saveGame();
  }

  function levelUp() {
  const p = state.player;
  p.level += 1;
  p.nextLevelXp = Math.round(p.nextLevelXp * 1.4);

  // Award 1 skill point per level
  if (p.skillPoints == null) p.skillPoints = 0;
  p.skillPoints += 1;

  // Full heal using current max stats
  p.hp = p.maxHp;
  p.resource = p.maxResource;

  addLog(
    'You reach level ' + p.level + '! Choose a skill to improve.',
    'good'
  );

  // Open skill selection modal
  openSkillLevelUpModal();
}

function openGovernmentModal() {
  // Make sure government state exists (handles old saves too)
  const timeInfo = getTimeInfo(state);
  const absoluteDay = timeInfo ? timeInfo.absoluteDay : 0;
  initGovernmentState(state, absoluteDay);

  const gov = state.government;
  const summary = getGovernmentSummary(state);
  const villageEffect = getVillageGovernmentEffect(state, "village");

  // Government-aware village economy (already adjusted by royal influence)
  const villageEconomy = getVillageEconomySummary(state);
  openModal("Realm & Government", body => {
    // --- CARD 1: REALM OVERVIEW ---------------------------------------------
    const overviewCard = document.createElement("div");
    overviewCard.className = "item-row";

    const header = document.createElement("div");
    header.className = "item-row-header";

    const title = document.createElement("span");
    title.className = "item-name";
    title.textContent = summary.realmName || "The Realm";
    header.appendChild(title);

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = summary.capitalName
      ? `Capital: ${summary.capitalName}`
      : "Overworld Government";
    header.appendChild(tag);

    overviewCard.appendChild(header);

    const when = document.createElement("p");
    when.className = "modal-subtitle";
    if (timeInfo) {
      when.textContent =
        `As of ${timeInfo.weekdayName} ${timeInfo.partName}, Year ${timeInfo.year}.`;
    } else {
      when.textContent = "Current state of the realm.";
    }
    overviewCard.appendChild(when);

    const metrics = summary.metrics || {
      stability: 50,
      prosperity: 50,
      royalPopularity: 50,
      corruption: 50
    };

    const metricsLine = document.createElement("p");
    metricsLine.className = "modal-subtitle";
    metricsLine.textContent =
      `Stability: ${metrics.stability} • ` +
      `Prosperity: ${metrics.prosperity} • ` +
      `Popularity: ${metrics.royalPopularity} • ` +
      `Corruption: ${metrics.corruption}`;
    overviewCard.appendChild(metricsLine);

    if (summary.lastDecreeTitle) {
      const decreeLine = document.createElement("p");
      decreeLine.className = "modal-subtitle";
      decreeLine.textContent =
        `Latest decree: ${summary.lastDecreeTitle}`;
      overviewCard.appendChild(decreeLine);
    }

    body.appendChild(overviewCard);

    // --- CARD 2: ROYAL FAMILY -----------------------------------------------
    const famCard = document.createElement("div");
    famCard.className = "item-row";

    const famHeader = document.createElement("div");
    famHeader.className = "item-row-header";

    const famTitle = document.createElement("span");
    famTitle.className = "item-name";
    famTitle.textContent = "Royal Family";
    famHeader.appendChild(famTitle);

    const famTag = document.createElement("span");
    famTag.className = "tag";
    famTag.textContent = `${summary.monarchTitle || "Ruler"} of the realm`;
    famHeader.appendChild(famTag);

    famCard.appendChild(famHeader);

    const monarchLine = document.createElement("p");
    monarchLine.className = "modal-subtitle";
    monarchLine.textContent =
      `${summary.monarchTitle || "Ruler"} ${summary.monarchName || "Unknown"}`;
    famCard.appendChild(monarchLine);

    if (summary.married && summary.spouseName) {
      const spouseLine = document.createElement("p");
      spouseLine.className = "modal-subtitle";
      spouseLine.textContent = `Spouse: ${summary.spouseName}`;
      famCard.appendChild(spouseLine);
    }

    const kidsLine = document.createElement("p");
    kidsLine.className = "modal-subtitle";
    kidsLine.textContent =
      summary.childrenCount > 0
        ? `Children: ${summary.childrenCount} (eldest is heir to the throne).`
        : "No heirs of age are currently known at court.";
    famCard.appendChild(kidsLine);

    body.appendChild(famCard);

    // --- CARD 3: ROYAL COUNCIL ----------------------------------------------
    const councilCard = document.createElement("div");
    councilCard.className = "item-row";

    const councilHeader = document.createElement("div");
    councilHeader.className = "item-row-header";

    const councilTitle = document.createElement("span");
    councilTitle.className = "item-name";
    councilTitle.textContent = "Royal Council";
    councilHeader.appendChild(councilTitle);

    const councilTag = document.createElement("span");
    councilTag.className = "tag";
    councilTag.textContent = `${summary.councilCount || 0} seats at court`;
    councilHeader.appendChild(councilTag);

    councilCard.appendChild(councilHeader);

    if (gov && Array.isArray(gov.council) && gov.council.length) {
      gov.council.forEach(member => {
        const row = document.createElement("div");
        row.className = "equip-row";

        const left = document.createElement("span");
        left.textContent = `${member.role}: ${member.name}`;
        row.appendChild(left);

        const right = document.createElement("span");
        right.className = "stat-note";
        const loyalty = Math.round(member.loyalty);
        right.textContent =
          `${member.ideology} • Loyalty ${loyalty} • ${member.mood}`;
        row.appendChild(right);

        councilCard.appendChild(row);
      });
    } else {
      const none = document.createElement("p");
      none.className = "modal-subtitle";
      none.textContent =
        "No council members are currently recorded in the royal rolls.";
      councilCard.appendChild(none);
    }

    body.appendChild(councilCard);

        // --- CARD 4: VILLAGE ATTITUDES ------------------------------------------
    const villageCard = document.createElement("div");
    villageCard.className = "item-row";

    const villageHeader = document.createElement("div");
    villageHeader.className = "item-row-header";

    const villageTitle = document.createElement("span");
    villageTitle.className = "item-name";
    villageTitle.textContent = "Emberwood Village";
    villageHeader.appendChild(villageTitle);

    const villageTag = document.createElement("span");
    villageTag.className = "tag";
    villageTag.textContent = "Local leadership & mood";
    villageHeader.appendChild(villageTag);

    villageCard.appendChild(villageHeader);

    const moodLine = document.createElement("p");
    moodLine.className = "modal-subtitle";

    if (villageEffect.hasData) {
      moodLine.textContent =
        `Loyalty: ${Math.round(villageEffect.loyalty)} • ` +
        `Fear: ${Math.round(villageEffect.fear)} • ` +
        `Unrest: ${Math.round(villageEffect.unrest)}`;
      villageCard.appendChild(moodLine);

      const desc = document.createElement("p");
      desc.className = "modal-subtitle";
      desc.textContent = villageEffect.description;
      villageCard.appendChild(desc);

      const mods = document.createElement("p");
      mods.className = "modal-subtitle";
      mods.textContent =
        `Prosperity modifier: ${villageEffect.prosperityModifier.toFixed(2)} • ` +
        `Safety modifier: ${villageEffect.safetyModifier.toFixed(2)}`;
      villageCard.appendChild(mods);
    } else {
      moodLine.textContent =
        "The crown's influence on Emberwood is still being felt out.";
      villageCard.appendChild(moodLine);
    }

    // NEW: show what the rest of the systems actually "see"
    const econLine = document.createElement("p");
    econLine.className = "modal-subtitle";
    econLine.textContent =
      `Village economy — Prosperity ${villageEconomy.prosperity} • ` +
      `Trade ${villageEconomy.trade} • ` +
      `Security ${villageEconomy.security}`;
    villageCard.appendChild(econLine);

    body.appendChild(villageCard);

    // --- CARD 5: RECENT DECREE LOG ------------------------------------------
    const historyCard = document.createElement("div");
    historyCard.className = "item-row";

    const historyHeader = document.createElement("div");
    historyHeader.className = "item-row-header";

    const historyTitle = document.createElement("span");
    historyTitle.className = "item-name";
    historyTitle.textContent = "Recent Decrees & Events";
    historyHeader.appendChild(historyTitle);

    const historyTag = document.createElement("span");
    historyTag.className = "tag";
    historyTag.textContent = "Last few changes at court";
    historyHeader.appendChild(historyTag);

    historyCard.appendChild(historyHeader);

    if (gov && Array.isArray(gov.history) && gov.history.length) {
      const recent = gov.history
        .slice(-6)                // last 6
        .reverse();               // newest first

      recent.forEach(ev => {
        const line = document.createElement("p");
        line.className = "modal-subtitle";
        const dayLabel =
          typeof ev.day === "number" ? `Day ${ev.day}` : "Unknown day";
        line.textContent =
          `${dayLabel}: ${ev.title} — ${ev.description}`;
        historyCard.appendChild(line);
      });
    } else {
      const none = document.createElement("p");
      none.className = "modal-subtitle";
      none.textContent =
        "The royal scribes have not yet recorded any notable decrees.";
      historyCard.appendChild(none);
    }

    body.appendChild(historyCard);
  });
}
  // --- PAUSE / GAME MENU --------------------------------------------------------
function openInGameSettingsModal() {
  openModal('Settings', body => {
    // Safety: if state doesn't exist yet, just show a simple message
    if (typeof state === 'undefined' || !state) {
      const msg = document.createElement('p');
      msg.textContent = 'Settings are unavailable until a game is running.';
      body.appendChild(msg);

      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const btnBack = document.createElement('button');
      btnBack.className = 'btn';
      btnBack.textContent = 'Back';
      btnBack.addEventListener('click', () => {
        closeModal();
      });
      actions.appendChild(btnBack);
      body.appendChild(actions);
      return;
    }

    const intro = document.createElement('p');
    intro.className = 'modal-subtitle';
    intro.textContent = 'Adjust your in-game options. Changes apply immediately.';
    body.appendChild(intro);

    const container = document.createElement('div');
    container.className = 'settings-modal-body';

    // --- Volume ---------------------------------------------------------------
    const volRow = document.createElement('div');
    volRow.className = 'settings-row';

    const volLabel = document.createElement('label');
    volLabel.className = 'settings-label';
    volLabel.textContent = 'Master volume';

    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.min = '0';
    volSlider.max = '100';
    volSlider.step = '5';
    volSlider.value =
      typeof state.settingsVolume === 'number' ? state.settingsVolume : 100;

    const volValue = document.createElement('span');
    volValue.className = 'settings-value';
    volValue.textContent = volSlider.value + '%';

    // Apply saved master volume immediately
    setMasterVolumePercent(volSlider.value);

    volSlider.addEventListener('input', () => {
      const v = Number(volSlider.value) || 0;
      state.settingsVolume = v;
      try { localStorage.setItem('pq-master-volume', String(v)); } catch (e) {}
      volValue.textContent = v + '%';
      setMasterVolumePercent(v);
    });

    volRow.appendChild(volLabel);
    volRow.appendChild(volSlider);
    volRow.appendChild(volValue);
    container.appendChild(volRow);

    // --- Text Speed -----------------------------------------------------------
    const textRow = document.createElement('div');
    textRow.className = 'settings-row';

    const textLabel = document.createElement('label');
    textLabel.className = 'settings-label';
    textLabel.textContent = 'Text speed';

    const textSlider = document.createElement('input');
    textSlider.type = 'range';
    textSlider.min = '30';
    textSlider.max = '200';
    textSlider.step = '10';
    textSlider.value =
      typeof state.settingsTextSpeed === 'number' ? state.settingsTextSpeed : 100;

    const textValue = document.createElement('span');
    textValue.className = 'settings-value';
    textValue.textContent = textSlider.value;

    textSlider.addEventListener('input', () => {
      const v = Number(textSlider.value) || 100;
      state.settingsTextSpeed = v;
      textValue.textContent = v;
    });

    textRow.appendChild(textLabel);
    textRow.appendChild(textSlider);
    textRow.appendChild(textValue);
    container.appendChild(textRow);

    // --- Difficulty (same config as main Settings) ---------------------------
    const diffRow = document.createElement('div');
    diffRow.className = 'settings-row';

    const diffLabel = document.createElement('label');
    diffLabel.className = 'settings-label';
    diffLabel.textContent = 'Difficulty';

    const diffSelect = document.createElement('select');
    diffSelect.className = 'settings-select'; // hook this to your "UI select" styling

    Object.values(DIFFICULTY_CONFIG).forEach(cfg => {
      const opt = document.createElement('option');
      opt.value = cfg.id;
      opt.textContent = cfg.name;
      diffSelect.appendChild(opt);
    });

    diffSelect.value = state.difficulty || 'normal';

    diffSelect.addEventListener('change', () => {
      const newDiff = diffSelect.value;
      if (DIFFICULTY_CONFIG[newDiff]) {
        state.difficulty = newDiff;
        updateHUD();
        saveGame();
      }
    });

    diffRow.appendChild(diffLabel);
    diffRow.appendChild(diffSelect);
    container.appendChild(diffRow);

    // --- UI Theme selector (same behaviour as main Settings) ------------------
    const themeRow = document.createElement('div');
    themeRow.className = 'settings-row';

    const themeLabel = document.createElement('label');
    themeLabel.className = 'settings-label';
    themeLabel.textContent = 'UI theme';

    const themeSelectInline = document.createElement('select');
    themeSelectInline.className = 'settings-select';

    const themeOptions = [
      { value: 'default', label: 'Default' },
      { value: 'arcane', label: 'Arcane' },
      { value: 'inferno', label: 'Inferno' },
      { value: 'forest', label: 'Forest' },
      { value: 'holy', label: 'Holy' },
      { value: 'shadow', label: 'Shadow' }
    ];

    themeOptions.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.value;
      opt.textContent = t.label;
      themeSelectInline.appendChild(opt);
    });

    const savedTheme = localStorage.getItem('pq-theme') || 'default';
    themeSelectInline.value = savedTheme;

    themeSelectInline.addEventListener('change', () => {
      setTheme(themeSelectInline.value);
    });

    themeRow.appendChild(themeLabel);
    themeRow.appendChild(themeSelectInline);
    container.appendChild(themeRow);

    // --- Audio toggles --------------------------------------------------------
    const musicRow = document.createElement('div');
    musicRow.className = 'settings-row';

    const musicLabel = document.createElement('label');
    musicLabel.className = 'settings-label';
    musicLabel.textContent = 'Music';

    const musicControl = document.createElement('div');
    musicControl.className = 'settings-control';

    const musicToggle = document.createElement('input');
    musicToggle.type = 'checkbox';
    musicToggle.checked = (state.musicEnabled !== false);
    musicToggle.addEventListener('change', () => {
      setMusicEnabled(musicToggle.checked);
      saveGame();
    });

    musicControl.appendChild(musicToggle);
    musicRow.appendChild(musicLabel);
    musicRow.appendChild(musicControl);
    container.appendChild(musicRow);

    const sfxRow = document.createElement('div');
    sfxRow.className = 'settings-row';

    const sfxLabel = document.createElement('label');
    sfxLabel.className = 'settings-label';
    sfxLabel.textContent = 'SFX';

    const sfxControl = document.createElement('div');
    sfxControl.className = 'settings-control';

    const sfxToggle = document.createElement('input');
    sfxToggle.type = 'checkbox';
    sfxToggle.checked = (state.sfxEnabled !== false);
    sfxToggle.addEventListener('change', () => {
      setSfxEnabled(sfxToggle.checked);
      saveGame();
    });

    sfxControl.appendChild(sfxToggle);
    sfxRow.appendChild(sfxLabel);
    sfxRow.appendChild(sfxControl);
    container.appendChild(sfxRow);



    body.appendChild(container);

    // --- Footer actions -------------------------------------------------------
    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const btnBack = document.createElement('button');
    btnBack.className = 'btn outline';
    btnBack.textContent = 'Back';
    btnBack.addEventListener('click', () => {
      // Values are already live-updated into state; just save and close.
      saveGame();
      closeModal();
    });

    actions.appendChild(btnBack);
    body.appendChild(actions);
  });
}
  
function openPauseMenu() {
  openModal('Game Menu', body => {
    const p = document.createElement('p');
    p.className = 'modal-subtitle';
    p.textContent =
      'Your progress auto-saves often, but you can force a save or exit safely.';
    body.appendChild(p);

    // Row 1: Save + Settings
    const row1 = document.createElement('div');
    row1.className = 'item-actions';

    const btnSave = document.createElement('button');
    btnSave.className = 'btn outline';
    btnSave.textContent = 'Save / Load';
    btnSave.addEventListener('click', () => {
      closeModal();
      openSaveManager({ mode: 'save' });
    });

    const btnSettings = document.createElement('button');
    btnSettings.className = 'btn outline';
    btnSettings.textContent = 'Settings';
    btnSettings.addEventListener('click', () => {
      // Open in-game settings as a modal so Back just returns to the battle.
      closeModal();
      openInGameSettingsModal();
    });

    row1.appendChild(btnSave);
    row1.appendChild(btnSettings);
    body.appendChild(row1);

    // Row 2: Changelog + Quit
    const row2 = document.createElement('div');
    row2.className = 'item-actions';

    const btnChangelog = document.createElement('button');
    btnChangelog.className = 'btn outline';
    btnChangelog.textContent = 'View Changelog';
    btnChangelog.addEventListener('click', () => {
      openChangelogModal();
    });

    const btnMenu = document.createElement('button');
    btnMenu.className = 'btn outline';
    btnMenu.textContent = 'Quit to Main Menu';
    btnMenu.addEventListener('click', () => {
      closeModal();
      switchScreen('mainMenu');
    });

    row2.appendChild(btnChangelog);
    row2.appendChild(btnMenu);
    body.appendChild(row2);
  });
}

// --- SAVE / LOAD --------------------------------------------------------------

  const SAVE_KEY = 'pocketQuestSave_v1';                 // existing single autosave
  const SAVE_KEY_PREFIX = 'pocketQuestSaveSlot_v1_';     // per-slot manual saves
  const SAVE_INDEX_KEY  = 'pocketQuestSaveIndex_v1';     // metadata for manual saves
function saveGame() {
  try {
    // 🚫 Don't save if there's no player or the hero is dead
    if (!state.player || state.player.hp <= 0) {
      console.warn('Skipped save: no player or player is dead.');
      return;
    }

    const toSave = {
  player: state.player,
  area: state.area,
  difficulty: state.difficulty,
  dynamicDifficulty: state.dynamicDifficulty || {
    band: 0,
    tooEasyStreak: 0,
    struggleStreak: 0
  },
  
  quests: state.quests,
  flags: state.flags,
  companion: state.companion,

  // Time & economy
  time: state.time,
  villageEconomy: state.villageEconomy,
  government: state.government || null,
  village: state.village || null,

  // Bank state
  bank: state.bank || null,

  // 🛒 Merchant state (NEW)
  villageMerchantNames: state.villageMerchantNames || null,
  merchantStock: state.merchantStock || null,

  // Log & filter
  log: state.log || [],
  logFilter: state.logFilter || 'all',

  // Combat snapshot
  inCombat: state.inCombat,
  currentEnemy: state.inCombat && state.currentEnemy ? state.currentEnemy : null
  
  
};

    // Stamp patch + time into the save data
    toSave.meta = toSave.meta || {};
    toSave.meta.patch = GAME_PATCH;
    toSave.meta.savedAt = Date.now();
    const json = JSON.stringify(toSave);
    localStorage.setItem(SAVE_KEY, json);
    state.lastSaveJson = json;
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

  function loadGame(fromDefeat) {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) {
      if (!fromDefeat) alert('No save found on this device.');
      return false;
    }

    const data = JSON.parse(json);
    state = createEmptyState();

    state.player = data.player;
state.area = data.area || 'village';
state.difficulty = data.difficulty || 'normal';
state.dynamicDifficulty =
  data.dynamicDifficulty || {
    band: 0,
    tooEasyStreak: 0,
    struggleStreak: 0
  };
state.quests = data.quests || {};
state.flags = data.flags || state.flags;
state.companion = data.companion || null;
// NEW: restore village container (population, etc.)
    state.village = data.village || null;
// NEW: restore bank state
state.bank = data.bank || null;
// NEW: restore time & economy (fallback if missing)
    state.time = data.time || null;
    state.villageEconomy = data.villageEconomy || null;
    initTimeState(state);
    initVillageEconomyState(state);
	// NEW: restore & initialize kingdom government
    state.government = data.government || null;
    const timeInfo = getTimeInfo(state); // from timeSystem
    initGovernmentState(state, timeInfo.absoluteDay);
    // NEW: restore combat state
    state.inCombat = !!(data.inCombat && data.currentEnemy);
    state.currentEnemy = data.currentEnemy || null;
	
	// 🛒 NEW: restore merchant state (safe if missing on old saves)
state.villageMerchantNames = data.villageMerchantNames || null;
state.merchantStock = data.merchantStock || null;

    // NEW: restore log + filter (instead of wiping it)
    state.log = Array.isArray(data.log) ? data.log : [];
    state.logFilter = data.logFilter || 'all';

    state.currentEnemy && (state.currentEnemy.guardTurns ||= 0); // defensive safety, optional
    state.lastSaveJson = json;

    // Recalc + UI refresh
    recalcPlayerStats();
    updateQuestBox();
    updateHUD();
    updateEnemyPanel();
    renderLog?.(); // if you have renderLog(), this will repaint the restored log

    setScene(
      'Resuming Journey',
      'You pick up your adventure where you last left off.'
    );

    // NEW: explicitly say which enemy you're fighting, if any
    if (state.inCombat && state.currentEnemy) {
      addLog(
        'You are fighting ' + state.currentEnemy.name + '!',
        state.currentEnemy.isBoss ? 'danger' : 'system'
      );
    }

    // And then the usual load message
    addLog('Game loaded.', 'system');

    renderActions();
    switchScreen('game');
	updateTimeDisplay(); // NEW
    return true;
  } catch (e) {
    console.error('Failed to load game:', e);
    if (!fromDefeat) alert('Save data is corrupt or incompatible.');
    return false;
  }
}

// --- MULTI-SLOT SAVE HELPERS --------------------------------------------------

// Extract basic hero info from a saved data blob
function buildHeroMetaFromData(data) {
  const p = data && data.player ? data.player : null;
  const area = (data && data.area) || 'village';

  const heroName = (p && p.name) || 'Unnamed Hero';
  const classId = (p && (p.classId || p.class)) || null;

  let className = (p && p.className) || '';
  try {
    if (!className && typeof PLAYER_CLASSES !== 'undefined' && PLAYER_CLASSES && classId && PLAYER_CLASSES[classId]) {
      className = PLAYER_CLASSES[classId].name || '';
    }
  } catch (e) {
    // if PLAYER_CLASSES not available early, just skip
  }

    const level = (p && typeof p.level === 'number') ? p.level : 1;

  const patch = data && data.meta && data.meta.patch;
  const savedAt = data && data.meta && data.meta.savedAt;

  return { heroName, classId, className, level, area, patch, savedAt };
}

// Read the manual save index
function getSaveIndex() {
  try {
    const raw = localStorage.getItem(SAVE_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to read save index', e);
    return [];
  }
}

// Write the manual save index
function writeSaveIndex(list) {
  try {
    localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to write save index', e);
  }
}

// Save the current run into a specific manual slot
function saveGameToSlot(slotId, label) {
  if (!slotId) {
    console.error('Missing slot id for manual save.');
    return;
  }

  if (!state.player || state.player.hp <= 0) {
    alert('Cannot save: your hero is not alive.');
    return;
  }

  // Use the existing save logic to produce the JSON blob
  saveGame();
  const json = state.lastSaveJson;
  if (!json) {
    alert('Could not save: no game data found.');
    return;
  }

  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    console.error('Failed to parse save JSON for slot save', e);
    alert('Could not save: data is corrupt.');
    return;
  }

  const meta = buildHeroMetaFromData(data);
  const now = Date.now();

  let index = getSaveIndex();
  let existing = index.find(e => e.id === slotId);
  if (!existing) {
    existing = { id: slotId, createdAt: now };
    index.push(existing);
  }

    existing.label = label || existing.label || (meta.heroName + ' Lv ' + meta.level);
  existing.heroName = meta.heroName;
  existing.classId = meta.classId;
  existing.className = meta.className;
  existing.level = meta.level;
  existing.area = meta.area;
  existing.patch = meta.patch || GAME_PATCH || 'Unknown';
  existing.savedAt = meta.savedAt || now;
  existing.lastPlayed = now;
  existing.isAuto = false;

  writeSaveIndex(index);

  try {
    localStorage.setItem(SAVE_KEY_PREFIX + slotId, json);
  } catch (e) {
    console.error('Failed to write manual save slot', e);
    alert('Could not write that save slot.');
  }
}

// Delete a manual save slot
function deleteSaveSlot(slotId) {
  if (!slotId) return;

  let index = getSaveIndex();
  index = index.filter(e => e.id !== slotId);
  writeSaveIndex(index);

  try {
    localStorage.removeItem(SAVE_KEY_PREFIX + slotId);
  } catch (e) {
    console.warn('Failed to remove manual save slot key', e);
  }
}

// Load from a manual slot by copying it into the main SAVE_KEY
function loadGameFromSlot(slotId) {
  if (!slotId) return false;

  try {
    const json = localStorage.getItem(SAVE_KEY_PREFIX + slotId);
    if (!json) {
      alert('That save slot is empty or missing.');
      return false;
    }

    // Overwrite the "current" save and reuse existing loadGame logic
    localStorage.setItem(SAVE_KEY, json);
    return loadGame(false);
  } catch (e) {
    console.error('Failed to load from slot', e);
    alert('Failed to load that save.');
    return false;
  }
}

// Combine synthetic auto-save info + manual index for UI
function getAllSavesWithAuto() {
  const list = getSaveIndex().slice();

  // Synthetic "Auto Save" entry from the existing SAVE_KEY
  try {
    const autoJson = localStorage.getItem(SAVE_KEY);
    if (autoJson) {
            const data = JSON.parse(autoJson);
      const meta = buildHeroMetaFromData(data);
      const savedAt = meta.savedAt || Date.now();

      list.push({
        id: '__auto__',
        label: 'Auto Save',
        isAuto: true,
        heroName: meta.heroName,
        classId: meta.classId,
        className: meta.className,
        level: meta.level,
        area: meta.area,
        patch: meta.patch || GAME_PATCH || 'Unknown',
        savedAt,
        lastPlayed: savedAt
      });
    }
  } catch (e) {
    console.warn('Failed to inspect autosave', e);
  }

  list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
  return list;
}

// Save / Load manager modal
function openSaveManager(options = {}) {
  const mode = options.mode || 'load';

  openModal('Save / Load', body => {
    const info = document.createElement('p');
    info.className = 'modal-subtitle';
    info.textContent =
      'Manage autosave and multiple manual save slots. You can keep several snapshots of the same character or different heroes.';
    body.appendChild(info);

    const slots = getAllSavesWithAuto();

    if (!slots.length) {
      const none = document.createElement('p');
      none.className = 'modal-subtitle';
      none.textContent = 'No saves found yet.';
      body.appendChild(none);
    } else {
      slots.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'save-slot-row';

        const metaLine = document.createElement('div');
        metaLine.className = 'save-slot-meta';

                const hero = entry.heroName || 'Unknown Hero';
        const cls = entry.className || entry.classId || '';
        const lvl = entry.level != null ? 'Lv ' + entry.level : '';
        const area = entry.area || '';
        const typeLabel = entry.isAuto ? '[Auto]' : '[Manual]';

        const patch = entry.patch || '';
        const timeStr = entry.savedAt
          ? new Date(entry.savedAt).toLocaleString()
          : '';

        metaLine.textContent =
          typeLabel + ' ' +
          hero +
          (cls ? ' (' + cls + ')' : '') +
          (lvl ? ' • ' + lvl : '') +
          (area ? ' • ' + area : '') +
          (patch ? ' • Patch ' + patch : '') +
          (timeStr ? ' • Saved ' + timeStr : '');

        row.appendChild(metaLine);

        const buttons = document.createElement('div');
        buttons.className = 'item-actions';

        // Load button
        const btnLoad = document.createElement('button');
        btnLoad.className = 'btn small';
        btnLoad.textContent = 'Load';
        btnLoad.addEventListener('click', () => {
          closeModal();
          if (entry.isAuto) {
            loadGame(false);
          } else {
            loadGameFromSlot(entry.id);
          }
        });
        buttons.appendChild(btnLoad);

        // Overwrite button (manual slots only, and only if we have a live player)
        if (!entry.isAuto && state.player && state.player.hp > 0) {
          const btnOverwrite = document.createElement('button');
          btnOverwrite.className = 'btn small outline';
          btnOverwrite.textContent = 'Overwrite';
          btnOverwrite.addEventListener('click', () => {
            const label = entry.label || entry.heroName || 'Manual Save';
            saveGameToSlot(entry.id, label);
            addLog('Saved game to slot "' + label + '".', 'system');
            closeModal();
            openSaveManager({ mode: 'save' });
          });
          buttons.appendChild(btnOverwrite);
        }

        // Delete button (manual slots only)
        if (!entry.isAuto) {
          const btnDelete = document.createElement('button');
          btnDelete.className = 'btn small outline';
          btnDelete.textContent = 'Delete';
          btnDelete.addEventListener('click', () => {
            if (!confirm('Delete this save slot?')) return;
            deleteSaveSlot(entry.id);
            closeModal();
            openSaveManager({ mode });
          });
          buttons.appendChild(btnDelete);
        }

        row.appendChild(buttons);
        body.appendChild(row);
      });
    }

    // Create new manual save (only if we're in a running game)
    if (state.player && state.player.hp > 0) {
      const newRow = document.createElement('div');
      newRow.className = 'item-actions';

      const btnNew = document.createElement('button');
      btnNew.className = 'btn small outline';
      btnNew.textContent = 'New Manual Save';
      btnNew.addEventListener('click', () => {
        const defaultLabel =
          (state.player.name || 'Hero') +
          ' Lv ' + (state.player.level || 1) +
          ' • ' + (state.area || 'village');

        const label = prompt('Name this save slot:', defaultLabel);
        if (label === null) return;

        const slotId = 'slot_' + Date.now();
        saveGameToSlot(slotId, label);
        addLog('Saved game to slot "' + label + '".', 'system');
        closeModal();
        openSaveManager({ mode: 'save' });
      });

      newRow.appendChild(btnNew);
      body.appendChild(newRow);
    }
  });
}
  // --- SETTINGS -----------------------------------------------------------------

function initSettingsFromState() {
  const volumeSlider = document.getElementById('settingsVolume');
  const textSpeedSlider = document.getElementById('settingsTextSpeed');

  const settingsVolume = document.getElementById('settingsVolume');
  if (settingsVolume) {
    settingsVolume.addEventListener('input', () => {
      applySettingsChanges();
    });
  }

  const settingsMusicToggle = document.getElementById('settingsMusicToggle');
  if (settingsMusicToggle) {
    settingsMusicToggle.addEventListener('change', () => applySettingsChanges());
  }

  const settingsSfxToggle = document.getElementById('settingsSfxToggle');
  if (settingsSfxToggle) {
    settingsSfxToggle.addEventListener('change', () => applySettingsChanges());
  }

  const settingsDifficulty = document.getElementById('settingsDifficulty');

  // If controls aren't present, nothing to do
  if (!volumeSlider && !textSpeedSlider && !settingsDifficulty) return;

  // If state doesn't exist, bail
  if (typeof state === 'undefined' || !state) return;

  // Hydrate from state if present; otherwise leave HTML defaults
  if (volumeSlider && typeof state.settingsVolume === 'number') {
    volumeSlider.value = state.settingsVolume;
  }
  if (textSpeedSlider && typeof state.settingsTextSpeed === 'number') {
    textSpeedSlider.value = state.settingsTextSpeed;
  }

  const musicToggle = document.getElementById('settingsMusicToggle');
  if (musicToggle) musicToggle.checked = (state.musicEnabled !== false);

  const sfxToggle = document.getElementById('settingsSfxToggle');
  if (sfxToggle) sfxToggle.checked = (state.sfxEnabled !== false);
  if (settingsDifficulty && state.difficulty) {
    settingsDifficulty.value = state.difficulty;
  }

  // Ensure audio volume is applied from saved settings
  setMasterVolumePercent(state.settingsVolume);
  updateAreaMusic();
  applyChannelMuteGains();
  applyChannelMuteGains();
}

function applySettingsChanges() {
  const volumeSlider = document.getElementById('settingsVolume');
  const textSpeedSlider = document.getElementById('settingsTextSpeed');
  const settingsDifficulty = document.getElementById('settingsDifficulty');

  if (typeof state === 'undefined' || !state) return;

  // Store values in state (purely cosmetic for now)
  if (volumeSlider) {
    state.settingsVolume = Number(volumeSlider.value) || 0;
    try { localStorage.setItem('pq-master-volume', String(state.settingsVolume)); } catch (e) {}
  }
  if (textSpeedSlider) {
    state.settingsTextSpeed = Number(textSpeedSlider.value) || 100;
    try { localStorage.setItem('pq-text-speed', String(state.settingsTextSpeed)); } catch (e) {}
  }

  const musicToggle = document.getElementById('settingsMusicToggle');
  if (musicToggle) {
    state.musicEnabled = !!musicToggle.checked;
    try { localStorage.setItem('pq-music-enabled', state.musicEnabled ? '1' : '0'); } catch (e) {}
    audioState.musicEnabled = state.musicEnabled;
  }

  const sfxToggle = document.getElementById('settingsSfxToggle');
  if (sfxToggle) {
    state.sfxEnabled = !!sfxToggle.checked;
    try { localStorage.setItem('pq-sfx-enabled', state.sfxEnabled ? '1' : '0'); } catch (e) {}
    audioState.sfxEnabled = state.sfxEnabled;
  }

  // Apply audio settings immediately
  setMasterVolumePercent(state.settingsVolume);
  updateAreaMusic();
  saveGame();


  // Allow changing difficulty mid-run
  if (settingsDifficulty) {
    const newDiff = settingsDifficulty.value;
    if (DIFFICULTY_CONFIG[newDiff]) {
      state.difficulty = newDiff;
      updateHUD();
      saveGame();
    }
  }
}
function setTheme(themeName) {
  document.body.classList.remove(
    "theme-arcane",
    "theme-inferno",
    "theme-forest",
    "theme-holy",
    "theme-shadow"
  );

  if (themeName !== "default") {
    document.body.classList.add("theme-" + themeName);
  }

  localStorage.setItem("pq-theme", themeName);
}

// Load saved theme on startup
(function loadTheme() {
  const saved = localStorage.getItem("pq-theme") || "default";
  setTheme(saved);
})();
// --- FEEDBACK / BUG REPORT -----------------------------------------------------

function openFeedbackModal() {
  const bodyHtml = `
    <div class="modal-subtitle">
      Help improve Pocket Quest by sending structured feedback. 
      Copy this text and paste it wherever you’re tracking issues.
    </div>

    <div class="field">
      <label for="feedbackType">Type</label>
      <select id="feedbackType">
        <option value="ui">UI issue</option>
        <option value="bug">Bug</option>
        <option value="balance">Balance issue</option>
        <option value="suggestion">Suggestion</option>
        <option value="other">Other</option>
      </select>
    </div>

    <div class="field">
      <label for="feedbackText">Details</label>
      <textarea id="feedbackText"
        placeholder="What happened? What did you expect? Steps to reproduce?"
      ></textarea>
    </div>

    <button class="btn primary small" id="btnFeedbackCopy">
      Copy Feedback To Clipboard
    </button>
    <p class="hint" id="feedbackStatus"></p>
  `;

  openModal('Feedback / Bug Report', bodyEl => {
    bodyEl.innerHTML = bodyHtml;

    const btnCopy = document.getElementById('btnFeedbackCopy');
    if (btnCopy) {
      btnCopy.addEventListener('click', handleFeedbackCopy);
    }
  });
}


function handleFeedbackCopy() {
  const type = document.getElementById('feedbackType').value;
  const text = document.getElementById('feedbackText').value.trim();
  const status = document.getElementById('feedbackStatus');

  const payload = buildFeedbackPayload(type, text);

  copyFeedbackToClipboard(payload)
    .then(() => status.textContent = '✅ Copied! Paste this into your tracker.')
    .catch(() => status.textContent = '❌ Could not access clipboard.');
}

function buildFeedbackPayload(type, text) {
  const lines = [];
  lines.push('Pocket Quest RPG Feedback');
  lines.push('-------------------------');
  lines.push(`Type: ${type}`);
  lines.push('');

  if (text) {
    lines.push('Description:');
    lines.push(text);
    lines.push('');
  }

  if (state && state.player) {
    const p = state.player;
    lines.push('Game Context:');
    lines.push(`- Player: ${p.name} (${p.classId})`);
    lines.push(`- Level: ${p.level} (XP: ${p.xp}/${p.nextLevelXp})`);
    lines.push(`- Gold: ${p.gold}`);
    lines.push(`- Area: ${state.area}`);
    lines.push('');
  }

  lines.push('Client Info:');
  lines.push(`- Time: ${new Date().toISOString()}`);
  lines.push(`- User Agent: ${navigator.userAgent}`);
  lines.push('');

  return lines.join('\n');
}

function copyFeedbackToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    try {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      document.body.appendChild(temp);
      temp.select();
      const OK = document.execCommand('copy');
      document.body.removeChild(temp);
      OK ? resolve() : reject();
    } catch (e) {
      reject(e);
    }
  });
}

// --- CHANGELOG MODAL --------------------------------------------------------

function openChangelogModal() {
  openModal("Changelog", body => {
    const wrapper = document.createElement("div");
    wrapper.className = "changelog-modal";

    const intro = document.createElement("p");
    intro.className = "modal-subtitle";
    intro.innerHTML =
      'All notable changes to <strong>Pocket Quest (Prototype)</strong> are listed here.';
    wrapper.appendChild(intro);

    CHANGELOG.forEach((entry, index) => {
      const details = document.createElement("details");
      if (index === 0) details.open = true; // latest open by default

      const summary = document.createElement("summary");
      summary.innerHTML = `<strong>${entry.version} – ${entry.title}</strong>`;
      details.appendChild(summary);

      entry.sections.forEach(section => {
        const h4 = document.createElement("h4");
        h4.textContent = section.heading;
        details.appendChild(h4);

        const ul = document.createElement("ul");

        section.items.forEach(item => {
          const li = document.createElement("li");

          // Support either simple strings OR {title, bullets}
          if (typeof item === "string") {
            li.textContent = item;
          } else {
            const titleSpan = document.createElement("strong");
            titleSpan.textContent = item.title;
            li.appendChild(titleSpan);

            if (item.bullets && item.bullets.length) {
              const innerUl = document.createElement("ul");
              item.bullets.forEach(text => {
                const innerLi = document.createElement("li");
                innerLi.textContent = text;
                innerUl.appendChild(innerLi);
              });
              li.appendChild(innerUl);
            }
          }

          ul.appendChild(li);
        });

        details.appendChild(ul);
      });

      wrapper.appendChild(details);
    });

    body.appendChild(wrapper);
  });
}
function initLogFilterChips() {
  const container = document.getElementById('logFilters');
  if (!container) return;

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-log-filter]');
    if (!btn) return;

    const value = btn.dataset.logFilter || 'all';
    state.logFilter = value;

    // 🔹 Use the log-chip-active class so the highlight persists
    container.querySelectorAll('.log-chip').forEach(chip => {
      chip.classList.toggle('log-chip-active', chip === btn);
    });

    renderLog();
  });
}


  // --- INITIAL SETUP & EVENT LISTENERS ------------------------------------------

function onDocReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

onDocReady(() => {
  // HUD: tap on name to open character sheet
  const hudName = document.getElementById('hud-name');
  if (hudName) {
    hudName.style.cursor = 'pointer';
    hudName.addEventListener('click', () => {
      if (state.player) openCharacterSheet();
    });
  }
  
  function setupCollapsingPanels() {
  const questBox = document.getElementById('questBox');
  const questTitle = document.getElementById('questTitle');
  const log = document.getElementById('log');
  const logHeader = document.getElementById('logHeader');

  if (questTitle && questBox) {
    questTitle.addEventListener('click', () => {
      questBox.classList.toggle('collapsed');
    });
  }

  if (logHeader && log) {
    logHeader.addEventListener('click', () => {
      log.classList.toggle('collapsed');
    });
  }
}
const btnRandomName = document.getElementById('btnRandomName');

// A small pool of fun names – tweak these however you want
const RANDOM_NAMES = [
  "Aria",
  "Thorne",
  "Kael",
  "Lira",
  "Rowan",
  "Nyx",
  "Darius",
  "Mira",
  "Sylas",
  "Eira",
  "Corin",
  "Vale",
  "Seren",
  "Riven",
  "Kaida"
];

function getRandomName() {
  const idx = Math.floor(Math.random() * RANDOM_NAMES.length);
  return RANDOM_NAMES[idx];
}

if (btnRandomName && inputName) {
  btnRandomName.addEventListener('click', () => {
    // If there’s already a name, you can overwrite or only fill when empty.
    // Overwrite every time:
    const newName = getRandomName();
    inputName.value = newName;
     });
}

  
  // --- MAIN MENU BUTTONS ------------------------------------------------------
  const btnNewGame = document.getElementById('btnNewGame');
  if (btnNewGame) {
    btnNewGame.addEventListener('click', () => {
  resetDevCheatsCreationUI();      // ✅ add
  buildCharacterCreationOptions();
  switchScreen('character');
});
  }

    const btnLoadGame = document.getElementById('btnLoadGame');
  if (btnLoadGame) {
    btnLoadGame.addEventListener('click', () => {
      openSaveManager({ mode: 'load' });
    });
  }
  const btnSettingsMain = document.getElementById('btnSettingsMain');
  if (btnSettingsMain) {
    btnSettingsMain.addEventListener('click', () => {
      initSettingsFromState();
      switchScreen('settings');
    });
  } else {
    console.warn('btnSettingsMain not found in DOM');
  }
  
  // NEW: main menu changelog button
const btnChangelog = document.getElementById('btnChangelog');
if (btnChangelog) {
  btnChangelog.addEventListener('click', () => {
    openChangelogModal();
  });
}


const btnFeedback = document.getElementById('btnFeedback');
if (btnFeedback) {
  btnFeedback.addEventListener('click', () => {
    openFeedbackModal();
  });
}
  // --- CHARACTER CREATION BUTTONS --------------------------------------------
  const btnStartGame = document.getElementById('btnStartGame');
  if (btnStartGame) {
    btnStartGame.addEventListener('click', () => {
      startNewGameFromCreation();
    });
  }

  const btnBackToMenu = document.getElementById('btnBackToMenu');
  if (btnBackToMenu) {
    btnBackToMenu.addEventListener('click', () => {
  resetDevCheatsCreationUI();      // ✅ add
  switchScreen('mainMenu');
});
  }

  // --- SETTINGS SCREEN --------------------------------------------------------
  const btnSettingsBack = document.getElementById('btnSettingsBack');
  if (btnSettingsBack) {
    btnSettingsBack.addEventListener('click', () => {
      applySettingsChanges();
      switchScreen('mainMenu');
    });
  }

  const settingsDifficulty = document.getElementById('settingsDifficulty');
  if (settingsDifficulty) {
    settingsDifficulty.addEventListener('change', () => {
      applySettingsChanges();
    });
  }
  
  // --- THEME SELECTOR ---------------------------------------------------------
const themeSelect = document.getElementById('themeSelect');
if (themeSelect) {
  // Set initial value to whatever is stored
  const savedTheme = localStorage.getItem("pq-theme") || "default";
  themeSelect.value = savedTheme;

  // Change theme on selection
  themeSelect.addEventListener('change', () => {
    setTheme(themeSelect.value);
  });
}

  // --- MODAL CLOSE ------------------------------------------------------------
  const modalClose = document.getElementById('modalClose');
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }
  if (modalEl) {
    modalEl.addEventListener('click', e => {
      if (e.target === modalEl) closeModal();
    });
  }

  // --- IN-GAME MENU BUTTON ----------------------------------------------------
  const btnGameMenu = document.getElementById('btnGameMenu');
  if (btnGameMenu) {
    btnGameMenu.addEventListener('click', () => {
      openPauseMenu();
    });
  }

  // --- HUD SWIPE: switch between player and companion view --------------------
  const hudTop = document.getElementById('hud-top');
  if (hudTop) {
    hudTop.addEventListener('touchstart', e => {
      const t = e.touches[0];
      hudTouchStartX = t.clientX;
      hudTouchStartY = t.clientY;
    });

    hudTop.addEventListener('touchend', e => {
      if (hudTouchStartX == null || hudTouchStartY == null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - hudTouchStartX;
      const dy = t.clientY - hudTouchStartY;
      hudTouchStartX = null;
      hudTouchStartY = null;

      // Horizontal swipe threshold
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        toggleHudEntity();
      }
    });
  }

  // --- PRE-LOAD DIFFICULTY FROM SAVE -----------------------------------------
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (json) {
      const data = JSON.parse(json);
      if (data.difficulty) {
        state.difficulty = data.difficulty;
      }
    }
  } catch (e) {
    console.warn('No prior save or failed to read.');
  }

  // Initialize settings UI from state
  initSettingsFromState();
  updateEnemyPanel(); // ensure panel starts hidden/clean
  setupCollapsingPanels();
  initLogFilterChips();

});
