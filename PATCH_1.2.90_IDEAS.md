# Patch 1.2.90 - Feature Ideas & Proposals

**Current Version:** 1.2.85 - Engine Integration Expansion  
**Next Version:** 1.2.90  
**Focus Areas:** Continue engine integration pattern, expand companion system, enhance combat depth

---

## 🎯 Primary Theme: Combat & Companion System Integration

Following the established pattern from patches 1.2.82 and 1.2.85, this patch would complete the engine integration coverage by bringing the **Combat System** and **Companion System** into the service architecture.

---

## 🏗️ Category 1: Engine Integration (High Priority)

### 1.1 Combat System Service
**Rationale:** Combat is a core system that currently lacks engine integration. Converting it to a service would enable:
- Event-driven combat flow for better debugging and telemetry
- Immutable state updates for combat state
- Easier testing and replay functionality
- Better separation of concerns

**Technical Details:**
```javascript
// js/game/services/combatService.js
- initializeCombat(enemies, location, difficulty)
- executeTurn(action, target)
- applyDamage(target, damage, source)
- applyStatus(target, effect)
- endCombat(victory)
- getCombatState()
```

**Events to Emit:**
- `combat:initialized` - When combat starts
- `combat:turnStart` - Beginning of each turn
- `combat:actionExecuted` - After player/enemy action
- `combat:damageDealt` - Damage calculation complete
- `combat:statusApplied` - Status effect applied
- `combat:enemyDefeated` - Individual enemy defeated
- `combat:victory` - All enemies defeated
- `combat:defeat` - Player defeated
- `combat:ended` - Combat cleanup complete

**Benefits:**
- Other systems can react to combat events (quests, achievements, economy)
- Combat state changes become traceable
- Enables combat replay for bug reproduction
- Supports future undo/redo functionality

---

### 1.2 Companion System Service
**Rationale:** Companions are mentioned in the roadmap for expansion. A service would provide:
- Centralized companion management
- Event emissions for companion actions
- Better AI behavior customization
- Easier addition of new companions

**Technical Details:**
```javascript
// js/game/services/companionService.js
- initializeCompanions(playerCompanions)
- executeCompanionTurn(companion, combatState)
- levelUpCompanion(companionId)
- unlockCompanionAbility(companionId, abilityId)
- healCompanion(companionId, amount)
- getCompanionStats(companionId)
- getAllActiveCompanions()
```

**Events to Emit:**
- `companion:initialized` - Companion system ready
- `companion:actionTaken` - Companion performs action
- `companion:abilityUsed` - Specific ability used
- `companion:healed` - Companion restored HP
- `companion:defeated` - Companion knocked out
- `companion:revived` - Companion brought back
- `companion:levelUp` - Companion gains level
- `companion:abilityUnlocked` - New ability available

**Benefits:**
- Enables companion-triggered quests and events
- Better telemetry on companion effectiveness
- Supports future companion customization features
- Easier to add new companion types

---

### 1.3 Combat Plugin & Companion Plugin
**Technical Details:**
```javascript
// js/game/plugins/combatServicePlugin.js
- Registers combat service with engine
- Subscribes to relevant events (player actions, time events)
- Proper lifecycle management (init/start/stop/dispose)

// js/game/plugins/companionServicePlugin.js
- Registers companion service with engine
- Subscribes to combat events
- Manages companion AI behavior
- Proper lifecycle management
```

---

## 🎮 Category 2: Companion System Expansion (Roadmap Priority)

### 2.1 New Companions
**Ideas:**
1. **Phoenix** (DPS/Support Hybrid)
   - Role: Resurrection specialist
   - Abilities: Flame burst, healing flames, rebirth (self-revive), immolation
   - Unique: Can revive itself once per combat

2. **Elemental (Choose element on unlock)**
   - Role: Elemental specialist (Fire/Ice/Lightning/Nature)
   - Abilities: Element-specific damage and buffs
   - Unique: Changes player's elemental affinity temporarily

3. **Shadow Assassin**
   - Role: Burst DPS with stealth mechanics
   - Abilities: Shadow strike, vanish, backstab, poison dart
   - Unique: Can "vanish" to avoid damage for 1 turn

4. **Necromantic Imp**
   - Role: Summoner/Debuffer
   - Abilities: Summon skeleton, life drain, curse, soul harvest
   - Unique: Gets stronger when enemies die

5. **Celestial Drake**
   - Role: Legendary all-rounder (unlock requirement)
   - Abilities: Celestial beam, star shield, nova burst, cosmic insight
   - Unique: Provides random buffs each turn

### 2.2 Companion Progression System
**New Features:**
- **Companion Loyalty System**: Companions gain loyalty based on combat performance and player choices
- **Companion Equipment**: Allow equipping one accessory per companion
- **Companion Talents**: Small talent tree (3-5 nodes) per companion
- **Companion Bond Abilities**: Special abilities unlocked at max loyalty

**Implementation Notes:**
- Add `companionProgress` to player state
- Store loyalty, level, equipped item, spent talent points
- New UI panel for companion management

### 2.3 Companion Interactions
**New Features:**
- **Synergy Abilities**: Certain companion pairs unlock special combo attacks
- **Companion Dialogues**: Flavor text during combat and in village
- **Companion Quests**: Special quests tied to individual companions
- **Companion Mood**: Affects their performance based on recent events

**Examples:**
- Wolf + Falcon synergy: "Pack Hunt" - Both attack same target for bonus damage
- Golem + Treant synergy: "Unbreakable Wall" - Massive damage reduction
- Sprite + Skeleton synergy: "Life from Death" - Heal based on enemy deaths

---

## ⚔️ Category 3: Combat Enhancements

### 3.1 New Combat Mechanics
**Ideas:**
1. **Combo System**: Chain abilities for bonus effects
   - Track consecutive hits without missing
   - At 3+ combo: bonus crit chance
   - At 5+ combo: bonus damage
   - Combo breaks on miss or when hit

2. **Positioning System**: Enemies have front/back rows
   - Melee abilities only hit front row
   - Ranged abilities can hit any row
   - AoE abilities hit all in one row
   - Some abilities can "pull" enemies forward or "push" back

3. **Reaction System**: Quick-time style mini events
   - Block incoming attack (reduce damage)
   - Perfect dodge (avoid damage + counter)
   - Interrupt casting (stop enemy ability)
   - Requires timing or choice selection

4. **Environmental Effects**: Combat locations have special rules
   - **Forest**: Nature abilities +20% damage
   - **Volcano**: Fire abilities +20%, ice -20%
   - **Frozen Peaks**: Ice abilities +20%, fire -20%
   - **Crypt**: Shadow/undead +20%, holy +30% vs undead
   - **Ruins**: Random arcane surges

### 3.2 New Status Effects
**Additional effects to increase combat variety:**
1. **Exposed**: Next attack deals bonus damage (single-use)
2. **Fortified**: Reduced incoming damage (stacks)
3. **Cursed**: Cannot be healed
4. **Blessed**: Increased healing received
5. **Dazed**: Reduced accuracy
6. **Focused**: Increased crit chance
7. **Bleeding** (Enhanced): Now stacks and deals more per stack
8. **Unstable**: Takes damage when using abilities

### 3.3 Combat Depth Features
**New Systems:**
1. **Overkill Rewards**: Defeating enemy with massive damage gives bonus loot chance
2. **Flawless Victory**: Taking no damage gives bonus rewards
3. **Speed Clear**: Defeating enemies quickly gives XP bonus
4. **Combat Challenges**: Optional objectives during combat (kill order, restrictions)
5. **Enemy Reinforcements**: Some combats spawn additional waves

---

## 👹 Category 4: Enemy & Boss Expansion

### 4.1 New Enemy Types
**Common Enemies:**
1. **Corrupted Dryad** (Nature, Healer)
2. **Ember Imp** (Fire, Swarm)
3. **Frost Giant** (Ice, Tank)
4. **Storm Harpy** (Lightning, Flyer)
5. **Void Spawn** (Shadow, Debuffer)

**Elite Variants:**
1. **War-Scarred Veteran** (Adaptive armor)
2. **Arcane Anomaly** (Random spell caster)
3. **Plague Bearer** (DoT specialist)
4. **Blood Berserker** (Enrages at low HP)

### 4.2 New Boss Mechanics
**Boss-Specific Behaviors:**
1. **Phase Transitions**: Boss changes abilities/behavior at HP thresholds
2. **Summon Minions**: Boss spawns adds during fight
3. **Enrage Timers**: Boss gets stronger over time
4. **Immunity Phases**: Temporary invulnerability (must kill adds or break shield)
5. **Ultimate Abilities**: Powerful once-per-fight moves

**Boss Ideas:**
1. **The Forgotten King** (Undead, Shadow)
   - Phase 1: Summons skeleton warriors
   - Phase 2: Shadow magic attacks
   - Phase 3: Drains life from players

2. **Ancient Wyrm** (Dragon, Fire/Ice)
   - Alternates between fire and ice phases
   - Breath weapon changes based on phase
   - Summons whelps

3. **Corrupted Treant Lord** (Nature, Boss)
   - Roots players in place
   - Regenerates health over time
   - Summons corrupted woodland creatures

---

## 🌳 Category 5: Talent & Progression

### 5.1 New Talent Trees
**Additional Talent Categories:**
1. **Companion Mastery Tree**
   - Companion damage +X%
   - Companion HP +X%
   - Unlock additional companion slot
   - Companion abilities cooldown faster

2. **Crafting Tree** (if crafting system added)
   - Better crafting results
   - Unlock rare recipes
   - Disenchant items for materials

3. **Social Tree**
   - Better merchant prices
   - More bank interest
   - Faster reputation gains
   - Better quest rewards

4. **Survival Tree**
   - More healing from potions
   - Better food effects
   - Resist status effects
   - Last stand (survive fatal blow once)

### 5.2 Prestige System Foundation
**Preparation for New Game+:**
- Add prestige points currency
- Create prestige shop data structure
- Add prestige level tracking
- Foundation for carrying over some progress

---

## 📜 Category 6: Quest System Expansion

### 6.1 New Quest Types
**Quest Variety:**
1. **Timed Quests**: Must complete within X days
2. **Daily Quests**: Reset every day
3. **Weekly Bounties**: Harder quests with better rewards
4. **Chain Quests**: Multi-part story arcs
5. **Secret Quests**: Hidden objectives, triggered by rare events
6. **Companion Quests**: Tied to individual companions

### 6.2 Quest Mechanics
**Enhanced Features:**
1. **Quest Choices**: Branching paths with different rewards
2. **Quest Failure States**: Some quests can be failed (not just incomplete)
3. **Quest Reputation**: Some quests locked behind reputation levels
4. **Dynamic Quest Generation**: Procedural quest objectives
5. **Quest Journal Improvements**: Better tracking, notes, waypoints

### 6.3 New Quest Chains
**Story Content:**
1. **The Blackbark Mystery** (Main story expansion)
2. **Companion Origin Stories** (One per companion)
3. **Village Crisis Chain** (Defend against threats)
4. **Ancient Ruins Exploration** (Dungeon-like progression)
5. **Kingdom Politics** (Tie into government system)

---

## 🏘️ Category 7: Village & Economy

### 7.1 New Village Locations
**Expandable Locations:**
1. **Training Grounds**
   - Practice combat against training dummies
   - Respec talents (for a fee)
   - Learn about combat mechanics

2. **Crafting Workshop** (if crafting added)
   - Craft items from materials
   - Upgrade equipment
   - Disenchant items

3. **Guild Hall**
   - Accept bounties
   - Trade with other adventurers (async)
   - View leaderboards

4. **Temple/Shrine**
   - Receive blessings (temporary buffs)
   - Offer sacrifices for favors
   - Unlock holy/shadow abilities

5. **Arena**
   - Fight waves of enemies
   - Compete for high scores
   - Earn unique rewards

### 7.2 Economy Enhancements
**New Systems:**
1. **Item Crafting Materials**: Enemies drop materials
2. **Merchant Reputation**: Unlock better items/prices through trading
3. **Black Market**: Illegal/expensive items available occasionally
4. **Trade Caravans**: Special events with unique items
5. **Investment System**: Invest in village businesses for passive income

---

## 🎨 Category 8: UI & UX Improvements

### 8.1 Combat UI Enhancements
**Quality of Life:**
1. **Combat Log Filtering**: Filter by damage, healing, status effects
2. **Damage Numbers Animation**: Show floating damage/healing on targets
3. **Status Effect Tooltips**: Hover for detailed effect descriptions
4. **Turn Preview**: See enemy intents more clearly
5. **Quick Action Bar**: Hotkeys for commonly used abilities
6. **Combat Speed Settings**: Slow/Normal/Fast animation speeds

### 8.2 General UI Improvements
**Navigation & Display:**
1. **Quick Travel**: Fast navigation between village locations
2. **Notification System**: Toast notifications for important events
3. **Minimap**: Visual representation of available locations
4. **Character Sheet Overhaul**: Better stat display with tooltips
5. **Inventory Filters**: Filter by type, rarity, usability
6. **Comparison Tooltips**: Easy equipment comparison

### 8.3 Mobile Optimizations
**Touch-Friendly:**
1. **Touch Gesture Support**: Swipe for navigation
2. **Larger Touch Targets**: Easier button pressing
3. **Collapsible Panels**: Save screen space
4. **Portrait Mode Optimization**: Better layout for mobile
5. **Offline Mode Improvements**: Better offline functionality

---

## 🔧 Category 9: Developer Tools & Quality of Life

### 9.1 Enhanced Dev Cheats
**More Testing Tools:**
1. **Spawn Specific Enemy**: Choose exact enemy with affixes
2. **Test Companion**: Instantly unlock and test companions
3. **Simulate Combat**: Run automated combat scenarios
4. **Quest Trigger**: Manually trigger quest events
5. **Time Travel**: Jump to specific day/time
6. **Loot Table Viewer**: See drop rates and test RNG

### 9.2 Debug Features
**Development Support:**
1. **Combat Replay System**: Record and replay combat sequences
2. **State Inspector**: View/edit state in real-time
3. **Event Logger**: Track all engine events
4. **Performance Monitor**: Real-time FPS, memory, state size
5. **Save Editor**: Import/export/edit save files

---

## 🎯 Category 10: Achievement System Foundation

### 10.1 Achievement Framework
**Infrastructure:**
1. **Achievement Definitions**: Data structure for achievements
2. **Achievement Tracking**: Track progress toward achievements
3. **Achievement Events**: Hook into engine events for triggers
4. **Achievement UI**: Display earned achievements and progress
5. **Achievement Rewards**: Unlock cosmetics, titles, or bonuses

### 10.2 Initial Achievement Ideas
**Starter Achievements:**
1. **First Blood**: Defeat your first enemy
2. **Loot Goblin**: Collect 100 items
3. **Wealthy Merchant**: Earn 10,000 gold
4. **Master Warrior**: Reach level 20
5. **Companion Collector**: Unlock all companions
6. **Perfect Victory**: Complete combat without taking damage
7. **Speed Runner**: Complete main quest in under 100 days
8. **Completionist**: Complete all side quests
9. **Town Savior**: Achieve maximum village reputation
10. **Legendary Hero**: Defeat all boss enemies

---

## 📊 Recommended Prioritization

### Phase 1: Engine Integration (Core)
1. Combat System Service + Plugin
2. Companion System Service + Plugin
3. Update relevant systems to use new services

**Effort:** ~5-7 days  
**Impact:** High - Completes engine integration pattern, enables future features

### Phase 2: Companion Expansion (High Value)
1. Add 2-3 new companions
2. Implement companion progression system
3. Add companion synergies
4. Companion-specific quests

**Effort:** ~3-5 days  
**Impact:** High - Directly addresses roadmap priority

### Phase 3: Combat Depth (Medium Priority)
1. Add 3-5 new enemy types
2. Implement 1-2 new combat mechanics (combo or positioning)
3. Add 5-10 new status effects
4. Create 2-3 boss enemies with special mechanics

**Effort:** ~4-6 days  
**Impact:** Medium-High - Increases replayability and challenge

### Phase 4: Content & Polish (Lower Priority)
1. Add new talent tree or expand existing
2. Create 3-5 new quest chains
3. UI/UX improvements
4. Achievement system foundation

**Effort:** ~3-5 days  
**Impact:** Medium - Improves overall experience

---

## 🚀 Recommended Patch 1.2.90 Scope

**Suggested Focus:** Complete engine integration + Begin companion expansion

### Minimum Viable Patch (MVP):
1. ✅ Combat System Service + Plugin
2. ✅ Companion System Service + Plugin
3. ✅ 2 new companions (Phoenix + Shadow Assassin)
4. ✅ Basic companion progression (loyalty system)
5. ✅ 3 new enemy types
6. ✅ 1 boss with special mechanics
7. ✅ 5 new status effects
8. ✅ Combat UI improvements (better tooltips, turn preview)

**Estimated Total Effort:** 7-10 days  
**Value Delivery:** Completes architectural goals + meaningful content

### Extended Scope (if time permits):
- Companion synergy system
- Positioning or combo mechanic
- New talent tree (Companion Mastery)
- Achievement system foundation
- 2-3 companion quest chains

---

## 💡 Alternative Themes

If a different direction is preferred:

### Option A: "Quality of Life & Polish Update"
Focus on UI/UX improvements, bug fixes, performance optimization, mobile support

### Option B: "Content Explosion Update"
Focus purely on content: 10+ new enemies, 5+ new companions, 10+ quests, new location

### Option C: "Prestige System Launch"
Focus on New Game+, prestige shop, achievement system, endgame content

### Option D: "Social & Async Features"
Focus on guild hall, leaderboards, async trading, achievement sharing

---

## 📝 Implementation Notes

### Testing Requirements:
- Smoke tests for new services (following existing patterns)
- Combat simulation tests
- Companion AI behavior tests
- Integration tests for event flows
- Save/load compatibility tests

### Documentation Updates:
- Update README.md with new features
- Update changelog.js with detailed patch notes
- Update ENGINE_INTEGRATION_GUIDE.md with new service examples
- Add companion system documentation

### Breaking Changes:
None expected - all changes should be backward compatible with existing saves

### Migration Strategy:
- Add new state fields with safe defaults
- Existing saves will automatically gain new features
- No manual migration required

---

## ✅ Conclusion

**Recommended Path Forward:**
1. **Confirm direction** with repository owner
2. **Start with MVP scope** (engine integration + companion expansion)
3. **Iterate based on feedback**
4. **Extend scope** if MVP completed ahead of schedule

This patch would:
- ✅ Complete the engine integration architectural vision
- ✅ Address roadmap priority (companion system expansion)
- ✅ Add meaningful combat depth
- ✅ Maintain code quality and testing standards
- ✅ Set foundation for future features (achievements, prestige)

**Estimated Timeline:** 1.5-2 weeks for MVP scope

---

*Document prepared for Emberwood: The Blackbark Oath - Patch 1.2.90*  
*Based on analysis of v1.2.85 and project roadmap*
