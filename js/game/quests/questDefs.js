/* Quest definitions live here so you can add/remove quests without touching the core game loop. */

export const QUEST_DEFS = {
    main: {
        id: 'main',
        name: 'Shadows over Emberwood',
        steps: {
            0: 'Speak with Elder Rowan in Emberwood Village.',
            0.1: 'Investigate the village outskirts. Find traces of the goblin raid and report back.',
            // Chapter I (expanded)
            0.25: 'Meet Captain Elara at the village guard table. Learn what the raiders took — and what they left behind.',
            0.4: 'Search the abandoned farmstead near the forest edge. Recover a clue about goblin movements.',
            0.5: 'Visit the Emberwood Tavern and find the Bark‑Scribe. Ask about old trails and goblin marks.',
            0.6: 'Speak with the village herbalist. Learn the recipe for forest warding salve.',
            0.75: 'Prepare a warding salve for the forest. Gather 2 Bitterleaf in Emberwood Forest.',
            0.9: 'Test the warding salve on a small goblin patrol. Clear 3 goblins near the village border.',
            1: 'In Emberwood Forest: break goblin raiding parties and recover their trail‑marks. (The Warlord will not show himself yet.)',
            1.1: 'Follow the snareline. Defeat the Goblin Trapper and recover the Hunter’s Brooch.',
            1.2: 'Track the supply route. Defeat scouts and recover their Supply Tags.',
            1.25: 'Burn the cache. Defeat the Goblin Packmaster and seize the Cache Ledger.',
            1.3: 'Silence the war drums. Defeat the Goblin Drummer and claim the Drumskin Banner.',
            1.4: 'Take the camp sigil. Defeat the Goblin Captain and recover the Warlord Sigil. Then hunt the Goblin Warlord.',
            1.5: 'Return to Elder Rowan and report the Goblin Warlord’s death. Learn why the Ruined Spire matters.',
            1.6: 'Prepare for the Spire expedition. Gather supplies and consult with village scholars.',
            2: 'At the Ruined Spire: purge cultists and gather void‑shards to draw out the Void‑Touched Dragon.',
            2.5: "Investigate Spire archives. Discover ancient texts about the corruption's origin.",
            3: 'In the Ashen Marsh: thin the bog cult and seize the witch’s focus before facing the Marsh Witch.',
            3.5: "Follow the witch's trail deeper into the marsh. Uncover her connection to the Spire corruption.",
            4: 'In Frostpeak Pass: hunt the Frost wolves and retrieve a rune‑stone to force the Frostpeak Giant into the open.',
            4.5: "Explore ancient frost ruins. Learn about the Giant's imprisonment and the keeper's role.",
            5: 'In the Sunken Catacombs: clear bone sentries and recover phylactery fragments before confronting the Sunken Lich.',
            5.5: "Piece together the Lich's phylactery. Discover the truth about Emberwood's founding.",
            6: 'In the Obsidian Keep: cut down the king’s guard and claim a seal to challenge the Obsidian King.',
            6.5: "Explore the Keep's throne room. Find evidence of the king's transformation and corruption.",
            7: 'Return to Elder Rowan with proof the corruption is broken.',
            7.5: 'Attend the village celebration. Speak with key NPCs about what comes next.',

            // Chapter II — The Blackbark Oath
            8: 'Return to Elder Rowan. Ask what your victory awakened.',
            8.1: 'Notice strange changes in the forest. Investigate unusual plant growth near the village.',
            8.25: 'Speak with Captain Elara. Learn why the village is afraid of tallies.',
            8.5: "Meet with concerned villagers. Hear their fears about the forest's awakening.",
            9: 'Visit the tavern and speak with the Bark‑Scribe.',
            9.5: "Research ancient oaths in the tavern's hidden library. Uncover Blackbark lore.",
            10: 'Recover three Oath‑Splinters: Sap‑Run (Forest), Witch‑Reed (Marsh), Bone‑Char (Catacombs).',
            10.5: 'Return to the Bark‑Scribe with the splinters. Learn what binds an oath.',
            10.75: 'Travel to the Oathgrove. Harvest Quiet Ink and break the Sapbound Warden.',
            11: 'Bring the splinters back to Emberwood. Undergo the Quiet Roots Trial.',
            11.5: "Recover from the trial. Experience visions of the forest's ancient past.",
            12: 'Seek the Ash‑Warden in the depths. Make peace or make war.',
            12.5: "Learn the Warden's true purpose. Understand the balance between village and forest.",
            13: 'Find the Blackbark Gate at dusk in Emberwood Forest.',
            13.5: 'Prepare for the oath ceremony. Gather witnesses or choose to go alone.',
            14: 'Swear, break, or rewrite the Blackbark Oath.',

            // Chapter III — The Hollow Crown (Patch 1.2.5 story expansion)
            15: 'Attend the emergency council at Emberwood Town Hall.',
            15.25: 'Investigate reports of crown sightings. Interview witnesses across the village.',
            15.5: 'Investigate the Blackbark Depths. Take charcoal rubbings and silence the stalkers.',
            15.75: 'Analyze the rubbings with the Bark-Scribe. Decode ancient warnings about false kings.',
            16: 'At night, return to the Blackbark Gate in Emberwood Forest and claim a Crown‑Echo.',
            16.5: "Experience the echo's memories. Witness the fall of the last crown-bearer.",
            17: 'Bring the Crown‑Echo to the Bark‑Scribe in the tavern.',
            17.25: "Learn about Star-Iron's properties. Understand why it can bind crown-echoes.",
            17.5: 'Travel to Starfall Ridge. Gather Star‑Iron shards for the Pin.',
            17.75: "Face the Starfall Sentinel. Prove worthy of the Star-Iron's power.",
            18: 'Return to the Ruined Spire and take the Star‑Iron Pin from the Mirror Warden.',
            18.5: "Unlock the Mirror Warden's memories. See reflections of possible futures.",
            19: 'Return to the Sunken Catacombs and recover the Grave‑Latch.',
            19.5: "Test the assembled artifacts. Ensure they can withstand the Hollow Crown's power.",
            20: 'Return to Emberwood and choose who will lead the ritual.',
            20.5: 'Prepare the ritual site. Consecrate the ground and set protective wards.',
            21: 'At night, enter the Blackbark Gate and face what wears the crown.',
            21.5: "Witness the crown's true nature. Understand what created the Hollow King.",
            22: 'Decide what Emberwood becomes after the Hollow Crown falls.',

            // Chapter IV — The Rootbound Court (Patch 1.2.5 story expansion continuation)
            23: 'Answer the summons: the forest convenes a Rootbound Court to judge your choices.',
            23.5: 'Meet with forest representatives. Understand the charges brought against you.',
            24: 'At the Ruined Spire, defeat the Echo Archivist and claim the Verdant Lens.',
            24.5: 'Use the Verdant Lens to see truth in memories. Prepare evidence for the Court.',
            25: 'In the Ashen Marsh, hunt the Court’s bailiffs and recover the marsh writs they carry.',
            25.5: "Decipher the marsh writs. Learn about the Court's jurisdiction and ancient laws.",
            26: 'In Frostpeak Pass, break the Ice Censor and seize the Frozen Writ.',
            26.5: 'Study the Frozen Writ. Discover precedents that may help your case.',
            27: 'In the Sunken Catacombs, defeat the Bone Notary and claim the Bone Writ.',
            27.5: "Examine the Bone Writ's death records. Find allies who may testify on your behalf.",
            28: 'In the Obsidian Keep, defeat the Oathbinder and take the Seal of Verdict.',
            28.5: "Learn the Seal's power. Understand how verdicts are bound and enforced.",
            29: 'At night, return to the Blackbark Gate and face the Rootbound Magistrate.',
            29.5: 'Present your case to the Court. Let your choices and evidence speak.',
            30: 'Return to Emberwood and decide how you answer the Court’s judgement.',
            30.5: 'Reflect on the journey. Prepare for what the ancient throne may bring.',
            31: 'The road forward is unwritten… (to be continued)',

            // Chapter V — The Ember Throne (v1.2.85 story expansion with branching paths)
            32: 'Seek Elder Rowan in the Town Hall. The realm stirs with news of an ancient throne.',
            32.5: 'Decision: Choose your approach - Diplomatic inquiry or Aggressive investigation.',
            33: 'Journey to the Ashen Peaks, a new region beyond Frostpeak. Survive the volcanic trials.',
            33.5: 'Choose your path through the peaks: Ancient Trail (stealth) or Molten Bridge (combat).',
            34: 'In the Ashen Peaks: hunt Emberkin Guardians and collect 3 Molten Keystones to unlock the throne chamber.',
            35: 'Descend into the Crystal Caverns beneath the peaks. Find the Prism Heart and face the Crystal Sentinel.',
            35.5: 'Crystal Sentinel offers a choice: Accept its pact for power, or Refuse and fight for freedom.',
            36: "Return to the Ruined Spire. Speak with the Echo Archivist's successor about the throne's origins.",
            36.5: 'Archival revelation: Choose to share knowledge with the village, or keep secrets for personal gain.',
            37: 'In Emberwood Forest at dawn: perform the Ritual of Awakening at the Ancient Grove.',
            37.5: 'Ritual crossroads: Invoke light (order), darkness (chaos), or balance (harmony).',
            38: 'Gather allies: Visit the Tavern, Town Hall, and Bank. Each faction offers aid for the final confrontation.',
            38.5: 'Alliance decision: Accept conditions from one faction, reject all for independence, or unite all factions.',
            39: 'Enter the Throne Chamber in the Ashen Peaks. Face the Ember Tyrant and claim or destroy the throne.',
            40: 'Return to Emberwood. Shape the future of the realm with your choice: unite, liberate, or transcend.',
            41: 'Your choices echo through the realm. The age you forged begins… (Chapter V complete)'
        },

        // Branching choices metadata for Chapter V (v1.2.85 enhancement)
        // Tracks player decisions and their consequences throughout the chapter
        branches: {
            32.5: {
                choices: [
                    { id: 'diplomatic', label: 'Diplomatic Inquiry', consequence: 'peacefulPath' },
                    { id: 'aggressive', label: 'Aggressive Investigation', consequence: 'forcefulPath' }
                ],
                affects: ['reputation', 'allyAvailability']
            },
            33.5: {
                choices: [
                    { id: 'ancientTrail', label: 'Ancient Trail (Stealth)', consequence: 'avoidCombat' },
                    { id: 'moltenBridge', label: 'Molten Bridge (Combat)', consequence: 'fightThrough' }
                ],
                affects: ['enemyEncounters', 'lootQuality']
            },
            35.5: {
                choices: [
                    { id: 'acceptPact', label: 'Accept Crystal Pact', consequence: 'crystalBlessing' },
                    { id: 'refuseFight', label: 'Refuse and Fight', consequence: 'earnedVictory' }
                ],
                affects: ['abilities', 'sentinelRelationship']
            },
            36.5: {
                choices: [
                    { id: 'shareKnowledge', label: 'Share with Village', consequence: 'publicWisdom' },
                    { id: 'keepSecrets', label: 'Keep for Yourself', consequence: 'personalPower' }
                ],
                affects: ['villageTrust', 'playerStats']
            },
            37.5: {
                choices: [
                    { id: 'invokeLight', label: 'Invoke Light (Order)', consequence: 'orderAlignment' },
                    { id: 'invokeDarkness', label: 'Invoke Darkness (Chaos)', consequence: 'chaosAlignment' },
                    { id: 'invokeBalance', label: 'Invoke Balance (Harmony)', consequence: 'balanceAlignment' }
                ],
                affects: ['alignment', 'ritualPower', 'finalEnding']
            },
            38.5: {
                choices: [
                    { id: 'acceptConditions', label: 'Accept One Faction', consequence: 'singleAlly' },
                    { id: 'rejectAll', label: 'Reject All (Independence)', consequence: 'soloPath' },
                    { id: 'uniteAll', label: 'Unite All Factions', consequence: 'grandAlliance' }
                ],
                affects: ['finalBattle', 'realmFuture', 'resources']
            }
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

            // --- Chapter V: The Ember Throne objectives ----------------------
            33: [
                {
                    type: 'kill',
                    label: 'Survive the volcanic trials',
                    required: 6,
                    enemyIds: ['lavaSerpent', 'emberElemental', 'ashWraith']
                }
            ],
            34: [
                {
                    type: 'kill',
                    label: 'Hunt Emberkin Guardians',
                    required: 5,
                    enemyIds: ['emberkinGuardian']
                },
                {
                    type: 'collect',
                    label: 'Collect Molten Keystones',
                    required: 3,
                    itemId: 'moltenKeystone',
                    dropsFrom: ['emberkinGuardian'],
                    dropChance: 0.75
                }
            ],
            35: [
                {
                    type: 'kill',
                    label: 'Defeat the Crystal Sentinel',
                    required: 1,
                    enemyIds: ['crystalSentinel']
                },
                {
                    type: 'collect',
                    label: 'Claim the Prism Heart',
                    required: 1,
                    itemId: 'prismHeart',
                    dropsFrom: ['crystalSentinel'],
                    dropChance: 1
                }
            ],
            37: [
                {
                    type: 'kill',
                    label: 'Clear the Ancient Grove',
                    required: 4,
                    enemyIds: ['ancientTreant', 'groveProtector']
                },
                {
                    type: 'collect',
                    label: 'Gather Dawn Essence',
                    required: 3,
                    itemId: 'dawnEssence',
                    dropsFrom: ['ancientTreant', 'groveProtector'],
                    dropChance: 0.65
                }
            ],
            39: [
                {
                    type: 'kill',
                    label: 'Defeat the Ember Tyrant',
                    required: 1,
                    enemyIds: ['emberTyrant']
                },
                {
                    type: 'collect',
                    label: 'Hold the Throne Shard',
                    required: 1,
                    itemId: 'throneShard',
                    dropsFrom: ['emberTyrant'],
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
