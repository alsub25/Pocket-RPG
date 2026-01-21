/* Quest definitions live here so you can add/remove quests without touching the core game loop. */

export const QUEST_DEFS = {
    main: {
        id: 'main',
        name: 'Shadows over Emberwood',
        steps: {
            0: 'Speak with Elder Rowan in Emberwood Village.',
            // Chapter I (expanded)
            0.25: 'Meet Captain Elara at the village guard table. Learn what the raiders took — and what they left behind.',
            0.5: 'Visit the Emberwood Tavern and find the Bark‑Scribe. Ask about old trails and goblin marks.',
            0.75: 'Prepare a warding salve for the forest. Gather 2 Bitterleaf in Emberwood Forest.',
            1: 'In Emberwood Forest: break goblin raiding parties and recover their trail‑marks. (The Warlord will not show himself yet.)',
            1.1: 'Follow the snareline. Defeat the Goblin Trapper and recover the Hunter’s Brooch.',
            1.2: 'Track the supply route. Defeat scouts and recover their Supply Tags.',
            1.25: 'Burn the cache. Defeat the Goblin Packmaster and seize the Cache Ledger.',
            1.3: 'Silence the war drums. Defeat the Goblin Drummer and claim the Drumskin Banner.',
            1.4: 'Take the camp sigil. Defeat the Goblin Captain and recover the Warlord Sigil. Then hunt the Goblin Warlord.',
            1.5: 'Return to Elder Rowan and report the Goblin Warlord’s death. Learn why the Ruined Spire matters.',
            2: 'At the Ruined Spire: purge cultists and gather void‑shards to draw out the Void‑Touched Dragon.',
            3: 'In the Ashen Marsh: thin the bog cult and seize the witch’s focus before facing the Marsh Witch.',
            4: 'In Frostpeak Pass: hunt the Frost wolves and retrieve a rune‑stone to force the Frostpeak Giant into the open.',
            5: 'In the Sunken Catacombs: clear bone sentries and recover phylactery fragments before confronting the Sunken Lich.',
            6: 'In the Obsidian Keep: cut down the king’s guard and claim a seal to challenge the Obsidian King.',
            7: 'Return to Elder Rowan with proof the corruption is broken.',

            // Chapter II — The Blackbark Oath
            8: 'Return to Elder Rowan. Ask what your victory awakened.',
            8.25: 'Speak with Captain Elara. Learn why the village is afraid of tallies.',
            9: 'Visit the tavern and speak with the Bark‑Scribe.',
            10: 'Recover three Oath‑Splinters: Sap‑Run (Forest), Witch‑Reed (Marsh), Bone‑Char (Catacombs).',
            10.5: 'Return to the Bark‑Scribe with the splinters. Learn what binds an oath.',
            10.75: 'Travel to the Oathgrove. Harvest Quiet Ink and break the Sapbound Warden.',
            11: 'Bring the splinters back to Emberwood. Undergo the Quiet Roots Trial.',
            12: 'Seek the Ash‑Warden in the depths. Make peace or make war.',
            13: 'Find the Blackbark Gate at dusk in Emberwood Forest.',
            14: 'Swear, break, or rewrite the Blackbark Oath.',

            // Chapter III — The Hollow Crown (Patch 1.2.5 story expansion)
            15: 'Attend the emergency council at Emberwood Town Hall.',
            15.5: 'Investigate the Blackbark Depths. Take charcoal rubbings and silence the stalkers.',
            16: 'At night, return to the Blackbark Gate in Emberwood Forest and claim a Crown‑Echo.',
            17: 'Bring the Crown‑Echo to the Bark‑Scribe in the tavern.',
            17.5: 'Travel to Starfall Ridge. Gather Star‑Iron shards for the Pin.',
            18: 'Return to the Ruined Spire and take the Star‑Iron Pin from the Mirror Warden.',
            19: 'Return to the Sunken Catacombs and recover the Grave‑Latch.',
            20: 'Return to Emberwood and choose who will lead the ritual.',
            21: 'At night, enter the Blackbark Gate and face what wears the crown.',
            22: 'Decide what Emberwood becomes after the Hollow Crown falls.',

            // Chapter IV — The Rootbound Court (Patch 1.2.5 story expansion continuation)
            23: 'Answer the summons: the forest convenes a Rootbound Court to judge your choices.',
            24: 'At the Ruined Spire, defeat the Echo Archivist and claim the Verdant Lens.',
            25: 'In the Ashen Marsh, hunt the Court’s bailiffs and recover the marsh writs they carry.',
            26: 'In Frostpeak Pass, break the Ice Censor and seize the Frozen Writ.',
            27: 'In the Sunken Catacombs, defeat the Bone Notary and claim the Bone Writ.',
            28: 'In the Obsidian Keep, defeat the Oathbinder and take the Seal of Verdict.',
            29: 'At night, return to the Blackbark Gate and face the Rootbound Magistrate.',
            30: 'Return to Emberwood and decide how you answer the Court’s judgement.',
            
            // Chapter V — The Crimson Pact
            31: 'A Voice-Keeper appears at the village gate. Listen to the forest\'s call.',
            32: 'Journey to the Crimson Canopy. Meet Seraph Thornwind and the Canopy Council.',
            32.5: 'CHOICE: Accept or refuse membership in the Canopy Council. Your decision shapes alliances.',
            33: 'Break the Canopy patrols and recover Crimson Seals to prove your worth.',
            34: 'Descend to the Thornheart Grotto. Seek Warden Mycellia and learn of the corruption below.',
            35: 'Thin the Thornheart thralls and collect Corruption Samples for Warden Mycellia.',
            36: 'CHOICE: Face the Thornheart Queen. Purge her corruption or bind her power for your own?',
            37: 'Climb to the Whisperwind Plateau. The storm calls and old powers stir.',
            38: 'At the Wind Shrine, speak with Sage Aeris. Learn of the Storm Sovereign and ancient treaties.',
            39: 'Challenge the Storm Cultists. Defeat them and gather their Storm Totems.',
            40: 'Face the Storm Sovereign in battle. Claim the Sovereign\'s Crown and end the tempest.',
            41: 'CHOICE: Side with Sage Aeris (diplomacy and balance) or Seraph Thornwind (conquest and power)?',
            42: 'Travel to Emberfall Sanctum. The ancient temple guards the secret of the Eternal Flame.',
            43: 'Pass the Trials of Ash. Defeat the Ashguard Sentinels and prove your resolve.',
            44: 'CHOICE: Keeper Pyralis asks what you will do with the Eternal Flame—rekindle it, extinguish it, or reshape it?',
            45: 'Enter the Sanctum\'s heart. Face The Eternitykeeper and claim the Eternal Flame Shard.',
            46: 'FINAL CHOICE: Return to Emberwood. Accept the crown, break all oaths, or forge a new path for the village.',
            47: 'The legend of Emberwood is complete. Your choices have shaped the forest\'s fate forever.'
        },

        // Optional objective metadata used by the quest system to track
        // kill/collect progress and render interactive objectives in the quest box.
        //
        // IMPORTANT: Objectives are designed to be additive and non-destructive.
        // Boss/story step advancement still uses the existing flag-driven beats,
        // but key encounters are gated so you must actually complete the objectives
        // (kill counts + enemy-sourced proof items) before bosses can reliably spawn.
        objectives: {
            0.75: [
                {
                    type: 'collect',
                    label: 'Gather Bitterleaf (for warding salve)',
                    required: 2,
                    itemId: 'bitterleaf'
                }
            ],
            1: [
                {
                    type: 'kill',
                    label: 'Break goblin raiding parties',
                    required: 8,
                    enemyIds: ['goblin', 'goblinScout', 'goblinArcher', 'goblinShaman']
                },
                {
                    type: 'collect',
                    label: 'Recover raider trail‑marks',
                    required: 4,
                    itemId: 'goblinTrailMark',
                    dropsFrom: ['goblin', 'goblinScout', 'goblinArcher', 'goblinShaman'],
                    dropChance: 0.65
                }
            ],
            1.1: [
                {
                    type: 'kill',
                    label: 'Defeat the Goblin Trapper',
                    required: 1,
                    enemyIds: ['goblinTrapper']
                },
                {
                    type: 'collect',
                    label: 'Recover the Hunter’s Brooch',
                    required: 1,
                    itemId: 'huntersBrooch',
                    dropsFrom: ['goblinTrapper'],
                    dropChance: 1
                }
            ],
            1.2: [
                {
                    type: 'kill',
                    label: 'Thin scouts along the supply route',
                    required: 4,
                    enemyIds: ['goblinScout', 'goblinArcher']
                },
                {
                    type: 'collect',
                    label: 'Recover Supply Tags',
                    required: 2,
                    itemId: 'supplyTag',
                    dropsFrom: ['goblinScout', 'goblinArcher'],
                    dropChance: 0.75
                }
            ],
            1.25: [
                {
                    type: 'kill',
                    label: 'Defeat the Goblin Packmaster',
                    required: 1,
                    enemyIds: ['goblinPackmaster']
                },
                {
                    type: 'collect',
                    label: 'Seize the Cache Ledger',
                    required: 1,
                    itemId: 'cacheLedger',
                    dropsFrom: ['goblinPackmaster'],
                    dropChance: 1
                }
            ],
            1.3: [
                {
                    type: 'kill',
                    label: 'Defeat the Goblin Drummer',
                    required: 1,
                    enemyIds: ['goblinDrummer']
                },
                {
                    type: 'collect',
                    label: 'Claim the Drumskin Banner',
                    required: 1,
                    itemId: 'drumskinBanner',
                    dropsFrom: ['goblinDrummer'],
                    dropChance: 1
                }
            ],
            1.4: [
                {
                    type: 'kill',
                    label: 'Defeat the Goblin Captain',
                    required: 1,
                    enemyIds: ['goblinCaptain']
                },
                {
                    type: 'collect',
                    label: 'Recover the Warlord Sigil',
                    required: 1,
                    itemId: 'warlordSigil',
                    dropsFrom: ['goblinCaptain'],
                    dropChance: 1
                }
            ],
            2: [
                {
                    type: 'kill',
                    label: 'Purge Spire cultists',
                    required: 3,
                    enemyIds: ['cultist', 'voidSpawn', 'voidHound']
                },
                {
                    type: 'collect',
                    label: 'Collect void‑shards',
                    required: 2,
                    itemId: 'voidShard',
                    dropsFrom: ['cultist', 'voidSpawn', 'voidHound'],
                    dropChance: 0.5
                }
            ],
            3: [
                {
                    type: 'kill',
                    label: 'Thin the bog cult',
                    required: 3,
                    enemyIds: ['bogCultist', 'mireStalker', 'plagueToad']
                },
                {
                    type: 'collect',
                    label: 'Seize a witch’s focus',
                    required: 1,
                    itemId: 'witchFocusTotem',
                    dropsFrom: ['bogCultist'],
                    dropChance: 0.85
                }
            ],
            4: [
                {
                    type: 'kill',
                    label: 'Hunt Frost wolves',
                    required: 3,
                    enemyIds: ['iceWolf']
                },
                {
                    type: 'collect',
                    label: 'Recover a giant’s rune‑stone',
                    required: 1,
                    itemId: 'giantRuneStone',
                    dropsFrom: ['iceWolf'],
                    dropChance: 0.35
                }
            ],
            5: [
                {
                    type: 'kill',
                    label: 'Clear bone sentries',
                    required: 4,
                    enemyIds: ['skeletonWarrior', 'skeletonArcher', 'boneGolem']
                },
                {
                    type: 'collect',
                    label: 'Recover phylactery fragments',
                    required: 1,
                    itemId: 'phylacteryFragment',
                    dropsFrom: ['necromancer', 'boneGolem'],
                    dropChance: 0.6
                }
            ],
            6: [
                {
                    type: 'kill',
                    label: 'Cut down the king’s guard',
                    required: 4,
                    enemyIds: ['darkKnight', 'shadowAssassin']
                },
                {
                    type: 'collect',
                    label: 'Claim a keep seal',
                    required: 1,
                    itemId: 'keepSeal',
                    dropsFrom: ['darkKnight', 'shadowAssassin'],
                    dropChance: 0.35
                }
            ],
            10: [
                {
                    type: 'collect',
                    label: 'Oath‑Splinter: Sap‑Run (Forest)',
                    required: 1,
                    itemId: 'oathSplinterSapRun',
                    dropsFrom: ['goblinShaman'],
                    dropChance: 1
                },
                {
                    type: 'collect',
                    label: 'Oath‑Splinter: Witch‑Reed (Marsh)',
                    required: 1,
                    itemId: 'oathSplinterWitchReed',
                    dropsFrom: ['bogCultist'],
                    dropChance: 1
                },
                {
                    type: 'collect',
                    label: 'Oath‑Splinter: Bone‑Char (Catacombs)',
                    required: 1,
                    itemId: 'oathSplinterBoneChar',
                    dropsFrom: ['necromancer'],
                    dropChance: 1
                }
            ],
            10.75: [
                {
                    type: 'kill',
                    label: 'Defeat the Sapbound Warden (Oathgrove)',
                    required: 1,
                    enemyIds: ['sapboundWarden']
                },
                {
                    type: 'collect',
                    label: 'Harvest Quiet Ink Resin',
                    required: 2,
                    itemId: 'quietInkResin',
                    dropsFrom: ['rootcrownAcolyte', 'oathgroveStalker'],
                    dropChance: 0.75
                }
            ],
            15.5: [
                {
                    type: 'kill',
                    label: 'Silence the Oathbound Stalkers',
                    required: 6,
                    enemyIds: ['oathboundStalker']
                },
                {
                    type: 'collect',
                    label: 'Take a Charcoal Rubbing',
                    required: 1,
                    itemId: 'charcoalRubbing',
                    dropsFrom: ['blackbarkWraith'],
                    dropChance: 1
                }
            ],
            17.5: [
                {
                    type: 'collect',
                    label: 'Gather Star‑Iron Shards',
                    required: 3,
                    itemId: 'starIronShard',
                    dropsFrom: ['starfallReaver', 'astralWisp'],
                    dropChance: 0.7
                }
            ],
            16: [
                {
                    type: 'kill',
                    label: 'Defeat the Crown‑Shade',
                    required: 1,
                    enemyIds: ['crownShade']
                },
                {
                    type: 'collect',
                    label: 'Claim the Crown‑Echo',
                    required: 1,
                    itemId: 'crownEcho',
                    dropsFrom: ['crownShade'],
                    dropChance: 1
                }
            ],
            18: [
                {
                    type: 'kill',
                    label: 'Defeat the Mirror Warden',
                    required: 1,
                    enemyIds: ['mirrorWarden']
                },
                {
                    type: 'collect',
                    label: 'Take the Star‑Iron Pin',
                    required: 1,
                    itemId: 'starIronPin',
                    dropsFrom: ['mirrorWarden'],
                    dropChance: 1
                }
            ],
            19: [
                {
                    type: 'kill',
                    label: 'Defeat the Grave‑Latch Warden',
                    required: 1,
                    enemyIds: ['graveLatchWarden']
                },
                {
                    type: 'collect',
                    label: 'Recover the Grave‑Latch',
                    required: 1,
                    itemId: 'graveLatch',
                    dropsFrom: ['graveLatchWarden'],
                    dropChance: 1
                }
            ],
            21: [
                {
                    type: 'kill',
                    label: 'Defeat the Hollow Regent',
                    required: 1,
                    enemyIds: ['hollowRegent']
                },
                {
                    type: 'collect',
                    label: 'Hold a crown‑remnant',
                    required: 1,
                    itemId: 'hollowCrownRemnant',
                    dropsFrom: ['hollowRegent'],
                    dropChance: 1
                }
            ],

            // --- Chapter IV: interactive objectives ----------------------
            24: [
                {
                    type: 'kill',
                    label: 'Defeat the Echo Archivist',
                    required: 1,
                    enemyIds: ['echoArchivist']
                },
                {
                    type: 'collect',
                    label: 'Claim the Verdant Lens',
                    required: 1,
                    itemId: 'verdantLens',
                    dropsFrom: ['echoArchivist'],
                    dropChance: 1
                }
            ],
            25: [
                {
                    type: 'kill',
                    label: 'Cut down Rootbound bailiffs',
                    required: 4,
                    enemyIds: ['mireBailiff']
                },
                {
                    type: 'collect',
                    label: 'Recover marsh writs',
                    required: 2,
                    itemId: 'courtWritMarsh',
                    dropsFrom: ['mireBailiff'],
                    dropChance: 0.65
                }
            ],
            26: [
                {
                    type: 'kill',
                    label: 'Defeat the Ice Censor',
                    required: 1,
                    enemyIds: ['iceCensor']
                },
                {
                    type: 'collect',
                    label: 'Seize the Frozen Writ',
                    required: 1,
                    itemId: 'courtWritFrost',
                    dropsFrom: ['iceCensor'],
                    dropChance: 1
                }
            ],
            27: [
                {
                    type: 'kill',
                    label: 'Defeat the Bone Notary',
                    required: 1,
                    enemyIds: ['boneNotary']
                },
                {
                    type: 'collect',
                    label: 'Claim the Bone Writ',
                    required: 1,
                    itemId: 'courtWritBone',
                    dropsFrom: ['boneNotary'],
                    dropChance: 1
                }
            ],
            28: [
                {
                    type: 'kill',
                    label: 'Defeat the Oathbinder',
                    required: 1,
                    enemyIds: ['oathBinder']
                },
                {
                    type: 'collect',
                    label: 'Take the Seal of Verdict',
                    required: 1,
                    itemId: 'sealOfVerdict',
                    dropsFrom: ['oathBinder'],
                    dropChance: 1
                }
            ],
            29: [
                {
                    type: 'kill',
                    label: 'Defeat the Rootbound Magistrate',
                    required: 1,
                    enemyIds: ['rootboundMagistrate']
                },
                {
                    type: 'collect',
                    label: 'Hold the Magistrate’s sigil',
                    required: 1,
                    itemId: 'magistrateSigil',
                    dropsFrom: ['rootboundMagistrate'],
                    dropChance: 1
                }
            ],

            // --- Chapter V: interactive objectives ----------------------
            33: [
                {
                    type: 'kill',
                    label: 'Defeat Thornweaver Mystics',
                    required: 5,
                    enemyIds: ['thornweaver']
                },
                {
                    type: 'collect',
                    label: 'Gather Crimson Thread samples',
                    required: 3,
                    itemId: 'crimsonThread',
                    dropsFrom: ['thornweaver'],
                    dropChance: 0.7
                }
            ],
            35: [
                {
                    type: 'kill',
                    label: 'Clear Blightspawn corruption',
                    required: 6,
                    enemyIds: ['blightspawn', 'corruptedDryad']
                },
                {
                    type: 'collect',
                    label: 'Recover Grotto Heart Shards',
                    required: 2,
                    itemId: 'grottoHeartShard',
                    dropsFrom: ['blightspawn', 'thornhulk'],
                    dropChance: 0.5
                }
            ],
            36: [
                {
                    type: 'kill',
                    label: 'Defeat the Thornheart Queen',
                    required: 1,
                    enemyIds: ['thornheartQueen']
                },
                {
                    type: 'collect',
                    label: 'Claim the Queen\'s Crown Fragment',
                    required: 1,
                    itemId: 'queenCrownFragment',
                    dropsFrom: ['thornheartQueen'],
                    dropChance: 1
                }
            ],
            39: [
                {
                    type: 'kill',
                    label: 'Defeat Stormcaller Shamans',
                    required: 5,
                    enemyIds: ['stormcaller']
                },
                {
                    type: 'collect',
                    label: 'Collect Storm Totems',
                    required: 3,
                    itemId: 'stormTotem',
                    dropsFrom: ['stormcaller'],
                    dropChance: 0.75
                }
            ],
            40: [
                {
                    type: 'kill',
                    label: 'Challenge the Storm Sovereign',
                    required: 1,
                    enemyIds: ['stormSovereign']
                },
                {
                    type: 'collect',
                    label: 'Take the Sovereign\'s Sigil',
                    required: 1,
                    itemId: 'sovereignSigil',
                    dropsFrom: ['stormSovereign'],
                    dropChance: 1
                }
            ],
            43: [
                {
                    type: 'kill',
                    label: 'Defeat Ashguard Sentinels',
                    required: 4,
                    enemyIds: ['ashguard']
                },
                {
                    type: 'collect',
                    label: 'Gather Trials of Ash Tokens',
                    required: 4,
                    itemId: 'ashTrialToken',
                    dropsFrom: ['ashguard'],
                    dropChance: 1
                }
            ],
            45: [
                {
                    type: 'kill',
                    label: 'Defeat the Eternitykeeper',
                    required: 1,
                    enemyIds: ['eternitykeeper']
                },
                {
                    type: 'collect',
                    label: 'Hold the Eternal Flame Shard',
                    required: 1,
                    itemId: 'eternalFlameShard',
                    dropsFrom: ['eternitykeeper'],
                    dropChance: 1
                }
            ]
        }
    },

    side: {
        grainWhispers: {
            name: 'Whispers in the Grain',
            steps: {
                0: 'Investigate the missing stores. Ask around the tavern.',
                1: 'Search the village outskirts for the cause.',
                2: 'Return with proof and settle the matter.'
            },
            // Optional objective metadata used by the quest system to track
            // kill/collect progress and render interactive objectives in the quest box.
            objectives: {
                2: [
                    {
                        type: 'kill',
                        label: 'Drive off goblin thieves',
                        required: 5,
                        enemyIds: ['goblinScout', 'goblinArcher', 'goblinShaman']
                    },
                    {
                        type: 'collect',
                        label: 'Recover stolen grain pouches',
                        required: 3,
                        itemId: 'stolenGrainPouch',
                        dropsFrom: ['goblinScout', 'goblinArcher', 'goblinShaman'],
                        dropChance: 0.55
                    }
                ]
            }
        },
        missingRunner: {
            name: 'The Missing Runner',
            steps: {
                0: 'Take the note-board request in the tavern.',
                1: 'Search the forest roads for a satchel or tracks.',
                2: 'Return to the village with what you find.'
            },
            objectives: {
                2: [
                    {
                        type: 'kill',
                        label: 'Clear the road of bandits',
                        required: 2,
                        enemyIds: ['bandit']
                    },
                    {
                        type: 'collect',
                        label: 'Recover the runner’s satchel',
                        required: 1,
                        itemId: 'runnersSatchel',
                        dropsFrom: ['bandit'],
                        dropChance: 1
                    }
                ]
            }
        },
        barkThatBleeds: {
            name: 'Bark That Bleeds',
            steps: {
                0: 'Accept the Bark‑Scribe’s request.',
                1: 'Cut a sample from a blackened tree in Emberwood Forest.',
                2: 'Bring the sap back to the Bark‑Scribe.'
            }
        },
        debtOfTheHearth: {
            name: 'Debt of the Hearth',
            steps: {
                0: 'A family needs coin. Decide whether to help.',
                1: 'Raise the money and bring it to the village.',
                2: 'Return with your decision.'
            }
        },
        frostpeaksHymn: {
            name: 'Frostpeak’s Lost Hymn',
            steps: {
                0: 'A singer seeks a lost verse.',
                1: 'Travel through Frostpeak and recover the hymn fragment.',
                2: 'Return the verse to the tavern.'
            }
        },
        witchsApology: {
            name: 'The Witch’s Apology',
            steps: {
                0: 'Find out why the Marsh Witch was bound.',
                1: 'Gather three marsh reagents.',
                2: 'Bring the reagents back to be made into an unbinding draught.'
            }
        },
        boneTithe: {
            name: 'Bone‑Tithe',
            steps: {
                0: 'The catacombs demand a “tithe.”',
                1: 'Pay the tithe and survive what answers.',
                2: 'Return—if you can breathe it in.'
            }
        },
        houndOfOldRoads: {
            name: 'The Hound of Old Roads',
            steps: {
                0: 'A spectral hound has been seen at night.',
                1: 'Follow its trail across the roads.',
                2: 'Return with the truth of what you find.'
            }
        },
        crownWithoutKing: {
            name: 'A Crown Without a King',
            steps: {
                0: 'Rumors speak of crown‑shards in circulation.',
                1: 'Recover two shards from dangerous places.',
                2: 'Choose: destroy the shards or sell them.'
            }
        },
        wardensGesture: {
            name: 'The Warden’s Gesture',
            steps: {
                0: 'Perform three gestures: mercy, restraint, protection.',
                1: 'Complete the gestures and return to the Bark‑Scribe.',
                2: 'Bring proof you can rewrite what was broken.'
            }
        }
    }
}
