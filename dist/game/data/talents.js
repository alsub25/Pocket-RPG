/* =============================================================================
 * Talent Definitions (talents.js)
 * Patch: 1.2.65 — The Blackbark Oath
 *
 * Extracted from engine.js as part of the 1.2.65 modularization overhaul.
 * This file is intentionally DATA-ONLY (no side effects).
 * ============================================================================= */
export const TALENT_DEFS = {
    mage: [
        { id: 'mage_rhythm_mastery', tier: 1, levelReq: 3, name: 'Rhythm Mastery', desc: 'Rhythm empowers every 2nd spell instead of every 3rd.' },
        { id: 'mage_mana_weave', tier: 1, levelReq: 3, name: 'Mana Weave', desc: 'Spell mana costs are reduced by 5%.' },
        { id: 'mage_ember_focus', tier: 2, levelReq: 6, name: 'Ember Focus', desc: 'Fire spells deal +10% damage.' },
        { id: 'mage_frostward', tier: 2, levelReq: 6, name: 'Frostward', desc: 'Gain 15% Frost resistance.' },
        { id: 'mage_arcane_conduit', tier: 3, levelReq: 9, name: 'Arcane Conduit', desc: 'Empowered Rhythm casts refund +2 mana.' },
        { id: 'mage_glacial_edge', tier: 3, levelReq: 9, name: 'Glacial Edge', desc: 'Frost spells deal +10% damage.' },
        { id: 'mage_arcane_ward', tier: 4, levelReq: 12, name: 'Arcane Ward', desc: 'Gain 15% Arcane resistance.' },
        { id: 'mage_mystic_reservoir', tier: 4, levelReq: 12, name: 'Mystic Reservoir', desc: 'Increase maximum Mana by 20.' }
    ],
    warrior: [
        { id: 'warrior_deep_cleave', tier: 1, levelReq: 3, name: 'Deep Cleave', desc: 'Cleave splash damage +15%.' },
        { id: 'warrior_frostward', tier: 1, levelReq: 3, name: 'Frostward', desc: 'Gain 15% Frost resistance.' },
        { id: 'warrior_bulwark_spikes', tier: 2, levelReq: 6, name: 'Bulwark Spikes', desc: 'When Bulwark triggers, reflect a small amount of damage on the next enemy hit.' },
        { id: 'warrior_sunder', tier: 2, levelReq: 6, name: 'Sunder', desc: 'Gain +10% Armor Penetration.' },
        { id: 'warrior_relentless', tier: 3, levelReq: 9, name: 'Relentless', desc: 'On kill, gain 10 Fury.' },
        { id: 'warrior_ironhide', tier: 3, levelReq: 9, name: 'Ironhide', desc: 'Gain +6 Armor and +5% Resist All.' },
        { id: 'warrior_executioner', tier: 4, levelReq: 12, name: 'Executioner', desc: 'Deal +15% physical damage to enemies below 30% HP.' },
        { id: 'warrior_battle_trance', tier: 4, levelReq: 12, name: 'Battle Trance', desc: 'Gain +10% Haste.' }
    ],
    blood: [
        { id: 'blood_thicker_than_water', tier: 1, levelReq: 3, name: 'Thicker Than Water', desc: 'Blood Nova applies +1 Bleed turn.' },
        { id: 'blood_shadowward', tier: 1, levelReq: 3, name: 'Shadowward', desc: 'Gain 15% Shadow resistance.' },
        { id: 'blood_bloodrush_hunger', tier: 2, levelReq: 6, name: 'Bloodrush Hunger', desc: 'While Bloodrush is active, lifesteal +5%.' },
        { id: 'blood_hemomancy', tier: 2, levelReq: 6, name: 'Hemomancy', desc: 'Shadow spells deal +10% damage.' },
        { id: 'blood_sanguine_ritual', tier: 3, levelReq: 9, name: 'Sanguine Ritual', desc: 'On kill, gain 6 Blood.' },
        { id: 'blood_blood_armor', tier: 3, levelReq: 9, name: 'Blood Armor', desc: 'Gain +12 Max HP and +2 Armor.' },
        { id: 'blood_crimson_storm', tier: 4, levelReq: 12, name: 'Crimson Storm', desc: 'Blood Nova damage +15%.' },
        { id: 'blood_sanguine_pact', tier: 4, levelReq: 12, name: 'Sanguine Pact', desc: 'Leech heals 15% more.' }
    ],
    ranger: [
        { id: 'ranger_pinpoint', tier: 1, levelReq: 3, name: 'Pinpoint', desc: 'Marks also increase damage vs the marked target by +1% each.' },
        { id: 'ranger_quickdraw', tier: 1, levelReq: 3, name: 'Quickdraw', desc: 'Your first hit bonus each combat is stronger (+6%).' },
        { id: 'ranger_nature_attunement', tier: 2, levelReq: 6, name: 'Nature Attunement', desc: 'Nature spells deal +10% damage.' },
        { id: 'ranger_thorned_arrows', tier: 2, levelReq: 6, name: 'Thorned Arrows', desc: 'Rain of Thorns bleed damage +10%.' },
        { id: 'ranger_hunters_bounty', tier: 3, levelReq: 9, name: "Hunter's Bounty", desc: 'On kill, gain 8 Mana/Fury/Blood depending on class resource.' },
        { id: 'ranger_camouflage', tier: 3, levelReq: 9, name: 'Camouflage', desc: 'Gain +8% Dodge Chance.' },
        { id: 'ranger_called_shot', tier: 4, levelReq: 12, name: 'Called Shot', desc: 'Gain +10% Crit Chance.' },
        { id: 'ranger_long_mark', tier: 4, levelReq: 12, name: 'Long Mark', desc: 'Marks last +1 turn.' }
    ],
    paladin: [
        { id: 'paladin_radiant_focus', tier: 1, levelReq: 3, name: 'Radiant Focus', desc: 'Holy spells deal +10% damage.' },
        { id: 'paladin_aura_of_faith', tier: 1, levelReq: 3, name: 'Aura of Faith', desc: 'Gain +5% Resist All.' },
        { id: 'paladin_sanctified_plate', tier: 2, levelReq: 6, name: 'Sanctified Plate', desc: 'Gain +8 Armor.' },
        { id: 'paladin_holyward', tier: 2, levelReq: 6, name: 'Holyward', desc: 'Gain 15% Holy resistance.' },
        { id: 'paladin_mana_font', tier: 3, levelReq: 9, name: 'Mana Font', desc: 'Increase maximum Mana by 20.' },
        { id: 'paladin_zeal', tier: 3, levelReq: 9, name: 'Zeal', desc: 'Gain +8% Crit Chance.' },
        { id: 'paladin_avenging_strike', tier: 4, levelReq: 12, name: 'Avenging Strike', desc: 'Deal +12% physical damage to enemies below 30% HP.' },
        { id: 'paladin_divine_haste', tier: 4, levelReq: 12, name: 'Divine Haste', desc: 'Gain +10% Haste.' }
    ],
    rogue: [
        { id: 'rogue_deadly_precision', tier: 1, levelReq: 3, name: 'Deadly Precision', desc: 'Gain +10% Crit Chance.' },
        { id: 'rogue_smokefoot', tier: 1, levelReq: 3, name: 'Smokefoot', desc: 'Gain +8% Dodge Chance.' },
        { id: 'rogue_shadowward', tier: 2, levelReq: 6, name: 'Shadowward', desc: 'Gain 15% Shadow resistance.' },
        { id: 'rogue_exploit_wounds', tier: 2, levelReq: 6, name: 'Exploit Wounds', desc: 'Deal +10% physical damage to bleeding targets.' },
        { id: 'rogue_cutpurse', tier: 3, levelReq: 9, name: 'Cutpurse', desc: 'On kill, gain 10 gold.' },
        { id: 'rogue_armor_sunder', tier: 3, levelReq: 9, name: 'Armor Sunder', desc: 'Gain +10% Armor Penetration.' },
        { id: 'rogue_execution', tier: 4, levelReq: 12, name: 'Execution', desc: 'Deal +15% physical damage to enemies below 30% HP.' },
        { id: 'rogue_adrenaline', tier: 4, levelReq: 12, name: 'Adrenaline', desc: 'Gain +10% Haste.' }
    ],
    cleric: [
        { id: 'cleric_holy_focus', tier: 1, levelReq: 3, name: 'Holy Focus', desc: 'Holy spells deal +10% damage.' },
        { id: 'cleric_sanctuary', tier: 1, levelReq: 3, name: 'Sanctuary', desc: 'Start each combat with a 20-point shield.' },
        { id: 'cleric_mending_prayer', tier: 2, levelReq: 6, name: 'Mending Prayer', desc: 'Healing and shields are 15% stronger.' },
        { id: 'cleric_lightward', tier: 2, levelReq: 6, name: 'Lightward', desc: 'Gain 15% Holy resistance.' },
        { id: 'cleric_mana_font', tier: 3, levelReq: 9, name: 'Mana Font', desc: 'Increase maximum Mana by 20.' },
        { id: 'cleric_bastion', tier: 3, levelReq: 9, name: 'Bastion', desc: 'Gain +6 Armor and +5% Resist All.' },
        { id: 'cleric_divine_haste', tier: 4, levelReq: 12, name: 'Divine Haste', desc: 'Gain +10% Haste.' },
        { id: 'cleric_grace', tier: 4, levelReq: 12, name: 'Grace', desc: 'Gain +8% Dodge Chance.' }
    ],
    necromancer: [
        { id: 'necromancer_shadow_mastery', tier: 1, levelReq: 3, name: 'Shadow Mastery', desc: 'Shadow spells deal +10% damage.' },
        { id: 'necromancer_graveward', tier: 1, levelReq: 3, name: 'Graveward', desc: 'Gain 15% Shadow resistance.' },
        { id: 'necromancer_deathmark_ritual', tier: 2, levelReq: 6, name: 'Deathmark Ritual', desc: 'Death Mark lasts +1 turn and amplifies the next shadow hit more.' },
        { id: 'necromancer_soul_battery', tier: 2, levelReq: 6, name: 'Soul Battery', desc: 'Increase maximum Mana by 20.' },
        { id: 'necromancer_bone_plating', tier: 3, levelReq: 9, name: 'Bone Plating', desc: 'Gain +4 Armor and +8% Resist All.' },
        { id: 'necromancer_reaper', tier: 3, levelReq: 9, name: 'Reaper', desc: 'On kill, restore 8 Mana.' },
        { id: 'necromancer_plague_touch', tier: 4, levelReq: 12, name: 'Plague Touch', desc: 'Poison spells deal +10% damage.' },
        { id: 'necromancer_dark_haste', tier: 4, levelReq: 12, name: 'Dark Haste', desc: 'Gain +10% Haste.' }
    ],
    shaman: [
        { id: 'shaman_tempest_focus', tier: 1, levelReq: 3, name: 'Tempest Focus', desc: 'Lightning spells deal +10% damage.' },
        { id: 'shaman_nature_attunement', tier: 1, levelReq: 3, name: 'Nature Attunement', desc: 'Nature spells deal +10% damage.' },
        { id: 'shaman_stormward', tier: 2, levelReq: 6, name: 'Stormward', desc: 'Gain 15% Lightning resistance.' },
        { id: 'shaman_mana_font', tier: 2, levelReq: 6, name: 'Mana Font', desc: 'Increase maximum Mana by 20.' },
        { id: 'shaman_totemic_mastery', tier: 3, levelReq: 9, name: 'Totemic Mastery', desc: 'Totem Spark deals +15% damage.' },
        { id: 'shaman_spirit_guard', tier: 3, levelReq: 9, name: 'Spirit Guard', desc: 'Gain +6 Armor and +5% Resist All.' },
        { id: 'shaman_ancestral_mending', tier: 4, levelReq: 12, name: 'Ancestral Mending', desc: 'Healing and shields are 15% stronger.' },
        { id: 'shaman_swift_steps', tier: 4, levelReq: 12, name: 'Swift Steps', desc: 'Gain +8% Dodge Chance.' }
    ],
    berserker: [
        { id: 'berserker_rage_mastery', tier: 1, levelReq: 3, name: 'Rage Mastery', desc: 'Missing-HP damage scaling is stronger.' },
        { id: 'berserker_bloodthirst', tier: 1, levelReq: 3, name: 'Bloodthirst', desc: 'Gain +8% Lifesteal.' },
        { id: 'berserker_executioner', tier: 2, levelReq: 6, name: 'Executioner', desc: 'Deal +15% physical damage to enemies below 30% HP.' },
        { id: 'berserker_fireward', tier: 2, levelReq: 6, name: 'Fireward', desc: 'Gain 15% Fire resistance.' },
        { id: 'berserker_hardened', tier: 3, levelReq: 9, name: 'Hardened', desc: 'Gain +6 Armor.' },
        { id: 'berserker_ferocity', tier: 3, levelReq: 9, name: 'Ferocity', desc: 'Gain +10% Crit Chance.' },
        { id: 'berserker_battle_trance', tier: 4, levelReq: 12, name: 'Battle Trance', desc: 'Gain +10% Haste.' },
        { id: 'berserker_rampage', tier: 4, levelReq: 12, name: 'Rampage', desc: 'On kill, gain 10 Fury.' }
    ],
    vampire: [
        { id: 'vampire_shadow_focus', tier: 1, levelReq: 3, name: 'Shadow Focus', desc: 'Shadow spells deal +10% damage.' },
        { id: 'vampire_night_hunger', tier: 1, levelReq: 3, name: 'Night Hunger', desc: 'On kill, restore 10 Essence.' },
        { id: 'vampire_essence_reservoir', tier: 2, levelReq: 6, name: 'Essence Reservoir', desc: 'Increase maximum Essence by 20.' },
        { id: 'vampire_dark_agility', tier: 2, levelReq: 6, name: 'Dark Agility', desc: 'Gain +8% Dodge Chance.' },
        { id: 'vampire_bloodletting', tier: 3, levelReq: 9, name: 'Bloodletting', desc: 'Gain +10% Lifesteal.' },
        { id: 'vampire_shadowward', tier: 3, levelReq: 9, name: 'Shadowward', desc: 'Gain 15% Shadow resistance.' },
        { id: 'vampire_crimson_crit', tier: 4, levelReq: 12, name: 'Crimson Crit', desc: 'Gain +10% Crit Chance.' },
        { id: 'vampire_mistward', tier: 4, levelReq: 12, name: 'Mistward', desc: 'Gain 15% Frost resistance.' }
    ]
};
//# sourceMappingURL=talents.js.map