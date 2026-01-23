// js/game/ui/spells/spellbookModal.js
// Spell Book UI extraction from engine.js (Patch 1.2.72)
//
// This module intentionally owns the *modal builder* + Spell Book UX.
// It depends on engine-provided helpers via dependency injection to avoid
// circular imports and to keep engine.js as orchestration glue only.

export function createSpellbookModal(deps) {
    if (!deps || typeof deps.getState !== 'function') {
        throw new Error('createSpellbookModal: missing deps.getState()')
    }

    const {
        getState,
        ABILITIES,
        MAX_EQUIPPED_SPELLS,
        ABILITY_UPGRADE_RULES,
        ensurePlayerSpellSystems,
        normalizeElementType,
        clampNumber,
        buildAbilityContext,
        getAliveEnemies,
        getActiveDifficultyConfig,
        getPlayerElementalBonusPct,
        getEnemyAffinityMultiplier,
        getEnemyElementalResistPct,
        playerHasTalent,
        _getMageRhythmBonus,
        _roundIntStable,
        addLog,
        openModal,
        closeModal,
        saveGame,
        useAbilityInCombat,
        getAbilityUpgrade,
        getEffectiveAbilityCost
    } = deps

    if (!ABILITIES) throw new Error('createSpellbookModal: missing ABILITIES')

    if (typeof buildAbilityContext !== 'function') {
        throw new Error('createSpellbookModal: missing buildAbilityContext(p, abilityId)')
    }
    if (typeof getAliveEnemies !== 'function') {
        throw new Error('createSpellbookModal: missing getAliveEnemies()')
    }

function openSpellsModal(inCombat) {
    const state = getState()
    const p = state.player
    if (!p) return
    ensurePlayerSpellSystems(p)

    const canEditLoadout = !inCombat

    // UI metadata for a clearer Spell Book.
    const SPELL_UI = {
        // AoE / multi-target
        meteorSigil: { badges: ['AoE', 'Damage'] },
        arcaneOverload: { badges: ['AoE', 'Damage'] },
        cleave: { badges: ['AoE', 'Damage'] },
        bloodNova: { badges: ['AoE', 'Damage'] },
        rainOfThorns: { badges: ['AoE', 'Damage'] },
        stoneQuake: { badges: ['AoE', 'Damage'] },
        tempest: { badges: ['Chain', 'Damage'] }
    }

    function _titleCase(s) {
        if (!s) return ''
        const t = String(s)
        return t.charAt(0).toUpperCase() + t.slice(1)
    }

    function inferAbilityElementType(id, ab) {
        if (!ab) return null
        const direct = ab.elementType || ab.element || null
        if (direct) return normalizeElementType(direct)

        // If the ability is explicitly tagged as physical (non-elemental), show it as such.
        try {
            if (Array.isArray(ab.tags) && ab.tags.indexOf('physical') >= 0) return 'physical'
        } catch (_) {}

        // Safe heuristic fallback for legacy abilities (display-only).
        const key = (String(id || '') + ' ' + String(ab.name || '') + ' ' + String(ab.note || '')).toLowerCase()
        if (key.indexOf('fire') >= 0 || key.indexOf('flame') >= 0 || key.indexOf('ember') >= 0) return 'fire'
        if (key.indexOf('frost') >= 0 || key.indexOf('ice') >= 0 || key.indexOf('chill') >= 0) return 'frost'
        if (key.indexOf('arcane') >= 0) return 'arcane'
        if (key.indexOf('shadow') >= 0 || key.indexOf('void') >= 0 || key.indexOf('nec') >= 0) return 'shadow'
        if (key.indexOf('holy') >= 0 || key.indexOf('light') >= 0 || key.indexOf('radi') >= 0) return 'holy'
        if (key.indexOf('poison') >= 0 || key.indexOf('toxin') >= 0 || key.indexOf('venom') >= 0) return 'poison'
        if (key.indexOf('storm') >= 0 || key.indexOf('lightning') >= 0 || key.indexOf('tempest') >= 0 || key.indexOf('thunder') >= 0) return 'lightning'
        if (key.indexOf('earth') >= 0 || key.indexOf('stone') >= 0 || key.indexOf('quake') >= 0) return 'earth'
        if (key.indexOf('nature') >= 0 || key.indexOf('thorn') >= 0 || key.indexOf('vine') >= 0) return 'nature'

        return null
    }

    function getSpellBadges(id) {
        const ab = ABILITIES[id]
        if (!ab) return []
        const meta = SPELL_UI[id]

        // Targeting badge
        let targetBadge = 'Single'
        if (meta && Array.isArray(meta.badges)) {
            if (meta.badges.indexOf('AoE') >= 0) targetBadge = 'AoE'
            else if (meta.badges.indexOf('Chain') >= 0) targetBadge = 'Chain'
        }

        // Element badge (requested: show next to Single/AoE/Support)
        const et = inferAbilityElementType(id, ab)
        const elementBadge = et ? _titleCase(et) : ''

        // Role badge
        let roleBadge = 'Damage'
        if (/heal|ward|shield|guard|barrier|restore|regen|buff/i.test(ab.name) || /heal|shield/i.test(ab.note || '')) {
            roleBadge = 'Support'
        }

        return [targetBadge, elementBadge, roleBadge].filter(Boolean).slice(0, 3)
    }

	// Patch 1.2.0: If the class meter is "full" (or in an active state) and it
	// will affect the next ability cast, show a short preview line in the Spell Book.
	function getMeterCastPreview(abilityId) {
		// Only show cast-impact previews when the player is actually about to cast.
		if (!inCombat) return ''
		try {
			const ab = ABILITIES[abilityId]
			if (!ab) return ''

			// Mage: Rhythm triggers on the next *mana* spell every 3rd cast.
			if (p.classId === 'mage') {
				const r = _getMageRhythmBonus(p, ab, abilityId)
				if (r && r.active) {
					return 'Rhythm Ready: +30% power, +15% crit, refund 4 Mana.'
				}
			}

			// Ranger: show a "full" Marks preview when the target is max-marked.
			// (Marks also help below max, but this callout focuses on the full meter state.)
			if (p.classId === 'ranger' && inCombat) {
				const enemy = state.currentEnemy
				const stacks = enemy ? enemy.markedStacks || 0 : 0
				if (stacks >= 5) {
					return 'Marks Maxed: +15% damage to this target; Headshot will consume Marks for a finisher.'
				}
			}
		} catch (_) {}
		return ''
	}

	function getMeterGlobalBannerText() {
		// Only show meter-readiness messaging in combat.
		if (!inCombat) return ''
		try {
			// Warrior: Bulwark is active at high Fury and empowers the next damaging ability.
			if (
				p.classId === 'warrior' &&
				p.resourceKey === 'fury' &&
				(p.resource || 0) >= 40
			) {
				return 'Bulwark Ready: your next damaging ability deals +25% damage, then Bulwark spends Fury to grant a shield.'
			}

			// Blood Knight: Bloodrush is active at high Blood.
			if (p.classId === 'blood' && p.resourceKey === 'blood') {
				const mx = Math.max(1, Number(p.maxResource || 0))
				const ratio = Number(p.resource || 0) / mx
				if (ratio >= 0.8) {
					return 'Bloodrush Active: your abilities deal +12% damage and gain +12% lifesteal while Blood stays high.'
				}
			}
		} catch (_) {}
		return ''
	}

	// Patch 1.2.0: spell list numeric previews (damage / heal / shield)
	// These previews are deterministic (no RNG/crit) and use the *current* target
	// in combat. Out of combat, they use a neutral "dummy" (no armor/resistance).
	function _previewCalcPhysical(baseStat, elementType, enemy, ctx) {
		const diff = getActiveDifficultyConfig()
		const st = p && p.status ? p.status : {}
		const atkDown = st.atkDownTurns > 0 ? st.atkDown || 0 : 0
		const atkBuff = st.buffAttack || 0
		let base = (baseStat || 0) + atkBuff - atkDown
		base = Math.max(1, base)
		const penPct = clampNumber(p && p.stats ? p.stats.armorPen || 0 : 0, 0, 80)
		let effArmor = (((enemy && enemy.armor) || 0) + ((enemy && enemy.armorBuff) || 0)) * (1 - penPct / 100)
		effArmor = Math.max(0, effArmor)
		const defense = 100 / (100 + effArmor * 10)
		let dmg = base * defense
		dmg *= (diff && Number.isFinite(diff.playerDmgMod) ? diff.playerDmgMod : 1)
		const ctxDmgMult = (ctx && typeof ctx.dmgMult === 'number' && Number.isFinite(ctx.dmgMult))
			? ctx.dmgMult
			: 1
		if (ctxDmgMult !== 1) dmg *= ctxDmgMult
		const et = normalizeElementType(elementType || null)
		const elemBonusPct = clampNumber(getPlayerElementalBonusPct(et), 0, 200)
		if (elemBonusPct > 0) dmg *= 1 + elemBonusPct / 100
		const affMult = getEnemyAffinityMultiplier(enemy, et)
		if (affMult !== 1) dmg *= affMult
		const enemyResPct = clampNumber(getEnemyElementalResistPct(enemy, et), 0, 75)
		if (enemyResPct > 0) dmg *= 1 - enemyResPct / 100
		if (enemy && enemy.brokenTurns && enemy.brokenTurns > 0) dmg *= 1.2
		return Math.max(1, _roundIntStable(dmg))
	}

	function _previewCalcMagic(baseStat, elementType, enemy, ctx) {
		const diff = getActiveDifficultyConfig()
		const st = p && p.status ? p.status : {}
		const magDown = st.magicDownTurns > 0 ? st.magicDown || 0 : 0
		const magBuff = st.buffMagic || 0
		let base = (baseStat || 0) + magBuff - magDown
		base = Math.max(1, base)
		const penPct = clampNumber(p && p.stats ? p.stats.armorPen || 0 : 0, 0, 80)
		let effRes = (((enemy && enemy.magicRes) || 0) + ((enemy && enemy.magicResBuff) || 0)) * (1 - penPct / 100)
		effRes = Math.max(0, effRes)
		const resist = 100 / (100 + effRes * 9)
		let dmg = base * resist
		dmg *= (diff && Number.isFinite(diff.playerDmgMod) ? diff.playerDmgMod : 1)
		const ctxDmgMult = (ctx && typeof ctx.dmgMult === 'number' && Number.isFinite(ctx.dmgMult))
			? ctx.dmgMult
			: 1
		if (ctxDmgMult !== 1) dmg *= ctxDmgMult
		const et = elementType || null
		const etKey = normalizeElementType(et)
		const elemBonusPct = clampNumber(getPlayerElementalBonusPct(etKey), 0, 200)
		if (elemBonusPct > 0) dmg *= 1 + elemBonusPct / 100

		// Talent elemental damage modifiers (keep previews aligned with real combat).
		if (p && p.classId === 'mage' && etKey === 'fire' && playerHasTalent(p, 'mage_ember_focus')) {
			dmg *= 1.10
		}
				if (p && p.classId === 'mage' && etKey === 'frost' && playerHasTalent(p, 'mage_glacial_edge')) {
			dmg *= 1.10
		}
		if (p && p.classId === 'blood' && etKey === 'shadow' && playerHasTalent(p, 'blood_hemomancy')) {
			dmg *= 1.10
		}
if (p && p.classId === 'ranger' && etKey === 'nature' && playerHasTalent(p, 'ranger_nature_attunement')) {
			dmg *= 1.10
		}
		if (p && p.classId === 'paladin' && etKey === 'holy' && playerHasTalent(p, 'paladin_radiant_focus')) dmg *= 1.10
		if (p && p.classId === 'cleric' && etKey === 'holy' && playerHasTalent(p, 'cleric_holy_focus')) dmg *= 1.10
		if (p && p.classId === 'necromancer' && etKey === 'shadow' && playerHasTalent(p, 'necromancer_shadow_mastery')) dmg *= 1.10
		if (p && p.classId === 'necromancer' && etKey === 'poison' && playerHasTalent(p, 'necromancer_plague_touch')) dmg *= 1.10
		if (p && p.classId === 'shaman' && etKey === 'lightning' && playerHasTalent(p, 'shaman_tempest_focus')) dmg *= 1.10
		if (p && p.classId === 'shaman' && etKey === 'nature' && playerHasTalent(p, 'shaman_nature_attunement')) dmg *= 1.10
		if (p && p.classId === 'vampire' && etKey === 'shadow' && playerHasTalent(p, 'vampire_shadow_focus')) dmg *= 1.10
		const affMult = getEnemyAffinityMultiplier(enemy, etKey)
		if (affMult !== 1) dmg *= affMult
		const enemyResPct = clampNumber(getEnemyElementalResistPct(enemy, etKey), 0, 75)
		if (enemyResPct > 0) dmg *= 1 - enemyResPct / 100
		if (enemy && enemy.brokenTurns && enemy.brokenTurns > 0) dmg *= 1.2
		return Math.max(1, _roundIntStable(dmg))
	}

	function _previewHeal(amount, ctx) {
		const mult = (ctx && typeof ctx.healMult === 'number' && Number.isFinite(ctx.healMult))
			? ctx.healMult
			: 1
		const eff = Math.max(0, Math.round((amount || 0) * mult))
		const missing = Math.max(0, (p.maxHp || 0) - (p.hp || 0))
		return Math.max(0, Math.min(missing, eff))
	}

	function _previewShield(amount, ctx) {
		const mult = (ctx && typeof ctx.healMult === 'number' && Number.isFinite(ctx.healMult))
			? ctx.healMult
			: 1
		return Math.max(0, Math.round((amount || 0) * mult))
	}

	function getAbilityNumericPreview(abilityId) {
		try {
			const ab = ABILITIES[abilityId]
			if (!ab) return ''
			const enemy = inCombat
				? state.currentEnemy
				: { name: 'Dummy', armor: 0, magicRes: 0, armorBuff: 0, magicResBuff: 0, brokenTurns: 0 }
			const ctx = buildAbilityContext(p, abilityId)

			// NOTE: These match the intent of ABILITY_EFFECTS, but avoid RNG/side-effects.
			switch (abilityId) {
				// Mage
				case 'fireball':
					return _previewCalcMagic(p.stats.magic * 1.6, 'fire', enemy, ctx) + ' dmg'
				case 'iceShard':
					return _previewCalcMagic(p.stats.magic * 1.25, 'frost', enemy, ctx) + ' dmg'
				case 'arcaneShield':
					return _previewShield(20, ctx) + ' shield'
				case 'arcaneSurge':
					return _previewCalcMagic(p.stats.magic * 1.25, 'arcane', enemy, ctx) + ' dmg'
				case 'meteorSigil': {
					const primary = _previewCalcMagic(p.stats.magic * 2.2, 'fire', enemy, ctx)
					const splash = _previewCalcMagic(p.stats.magic * 2.2 * 0.6, 'fire', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}
				case 'arcaneOverload': {
					// Added in 1.2.0 as mage AoE.
					const primary = _previewCalcMagic(p.stats.magic * 1.55, 'arcane', enemy, ctx)
					const splash = _previewCalcMagic(p.stats.magic * 1.55 * 0.75, 'arcane', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}

				// Warrior
				case 'powerStrike':
					return _previewCalcPhysical(p.stats.attack * 1.4, null, enemy, ctx) + ' dmg'
				case 'cleave': {
					const primary = _previewCalcPhysical(p.stats.attack * 1.25, null, enemy, ctx)
					const splash = _previewCalcPhysical(p.stats.attack * 1.25 * 0.72, null, enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}
				case 'ironFortress':
					return _previewShield(35, ctx) + ' shield'

				// Blood Knight
				case 'bloodSlash':
					return _previewCalcPhysical(p.stats.attack * 1.5, null, enemy, ctx) + ' dmg'
				case 'leech': {
					const dmg = _previewCalcMagic(p.stats.magic * 0.9, 'shadow', enemy, ctx)
					const heal = _previewHeal(Math.round(dmg * 0.6), ctx)
					return dmg + ' dmg / ' + heal + ' heal'
				}
				case 'bloodNova': {
					const primary = _previewCalcMagic(p.stats.magic * 1.45, 'shadow', enemy, ctx)
					const splash = _previewCalcMagic(p.stats.magic * 1.45 * 0.78, 'shadow', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}

				// Ranger
				case 'piercingShot':
					return _previewCalcPhysical(p.stats.attack * 1.3, null, enemy, ctx) + ' dmg'
				case 'twinArrows': {
					const one = _previewCalcPhysical(p.stats.attack * 0.75, null, enemy, ctx)
					return (one * 2) + ' dmg'
				}
				case 'rainOfThorns': {
					// Physical multi-hit volley (no element by default; weapon element can still apply via gear systems)
					const primary = _previewCalcPhysical(p.stats.attack * 0.75, null, enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					// This spell is "hits all once"; show per-target.
					if (alive > 1) return primary + ' ea (AoE)'
					return primary + ' dmg'
				}

				// Paladin
				case 'holyStrike':
					return _previewCalcPhysical(p.stats.attack * 1.2, 'holy', enemy, ctx) + ' dmg'
				case 'blessingLight': {
					const heal = _previewHeal(Math.round(p.maxHp * 0.25), ctx)
					const shield = _previewShield(14, ctx)
					return heal + ' heal / ' + shield + ' shield'
				}

				// Cleric
				case 'holyHeal':
					return _previewHeal(Math.round(p.maxHp * 0.35), ctx) + ' heal'
				case 'smite':
					return _previewCalcMagic(p.stats.magic * 1.3, 'holy', enemy, ctx) + ' dmg'
				case 'purify':
					return _previewShield(15, ctx) + ' shield'

				// Necromancer
				case 'soulBolt': {
					const dmg = _previewCalcMagic(p.stats.magic * 1.4, 'shadow', enemy, ctx)
					const heal = _previewHeal(Math.round(dmg * 0.4), ctx)
					return dmg + ' dmg / ' + heal + ' heal'
				}
				case 'decay':
					return _previewCalcMagic(p.stats.magic * 0.9, 'poison', enemy, ctx) + ' dmg'

				// Shaman
				case 'lightningLash':
					return _previewCalcMagic(p.stats.magic * 1.5, 'lightning', enemy, ctx) + ' dmg'
				case 'earthskin':
					return _previewShield(20, ctx) + ' shield'
				case 'stoneQuake': {
					const primary = _previewCalcMagic(p.stats.magic * 1.2, 'earth', enemy, ctx)
					const splash = _previewCalcMagic(p.stats.magic * 1.2 * 0.82, 'earth', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}
				case 'tempest': {
					const dmg = _previewCalcMagic(p.stats.magic * 1.05, 'lightning', enemy, ctx)
					return dmg + ' dmg'
				}

				// Vampire
				case 'essenceDrain': {
					const dmg = _previewCalcMagic(p.stats.magic * 1.2, 'arcane', enemy, ctx)
					const heal = _previewHeal(Math.round(dmg * 0.5), ctx)
					return dmg + ' dmg / ' + heal + ' heal'
				}
				case 'batSwarm':
					return _previewCalcMagic(p.stats.magic * 1.3, 'shadow', enemy, ctx) + ' dmg'

				// Berserker
				case 'frenziedBlow':
					return _previewCalcPhysical(p.stats.attack * 1.0, null, enemy, ctx) + ' dmg'
				case 'warCryBerserker':
					return _previewHeal(Math.round(p.maxHp * 0.2), ctx) + ' heal'
			}
		} catch (_) {}
		return ''
	}

    function formatCost(cost, abilityId) {
        if (!cost) return 'Cost: —'
        const parts = []
        if (cost.mana) parts.push(cost.mana + ' Mana')
        if (cost.fury) parts.push(cost.fury + ' Fury')
        if (cost.blood) parts.push(cost.blood + ' Blood')
        if (cost.essence) parts.push(cost.essence + ' Essence')
        if (cost.hp) parts.push(cost.hp + ' HP')

		const preview = abilityId ? getAbilityNumericPreview(abilityId) : ''
		if (preview && parts.length === 1) {
			// Put the number right next to the primary resource.
			return 'Cost: ' + parts[0] + ' (' + preview + ')'
		}
		if (preview && parts.length > 1) {
			return 'Cost: ' + parts.join(' • ') + ' • ' + preview
		}
		return parts.length ? 'Cost: ' + parts.join(' • ') : 'Cost: —'
    }

    function getKnown() {
        return Array.isArray(p.spells) ? p.spells.slice() : []
    }

    function getEquipped() {
        return Array.isArray(p.equippedSpells) ? p.equippedSpells.slice() : []
    }

    function isEquipped(id) {
        return (p.equippedSpells || []).includes(id)
    }

    // Patch 1.1.0 UI: Spell modal uses the same “collapsible card” pattern as Inventory.
    // - Out of combat: tap a card to expand/collapse details (equip/unequip/upgrade).
    // - In combat: tapping a card *casts immediately* (no collapsing).

    openModal(inCombat ? 'Abilities' : 'Spells & Abilities', (body) => {
        body.innerHTML = ''
        body.classList.add('spellbook-modal')

        const info = document.createElement('div')
        info.className = 'small'
        info.style.marginBottom = '8px'
        info.textContent =
            (inCombat
                ? 'Tap an ability to cast it. (Only equipped abilities appear.)'
                : 'Tap an ability to expand details. Equip up to ' +
                  MAX_EQUIPPED_SPELLS +
                  ' for combat.') +
            ' Upgrades apply automatically.'
        body.appendChild(info)

        const topRow = document.createElement('div')
        topRow.className = 'item-actions'
        topRow.style.marginBottom = '10px'

        const token = document.createElement('div')
        token.className = 'small'
        token.textContent = 'Upgrade Tokens: ' + (p.abilityUpgradeTokens || 0)
        topRow.appendChild(token)

        if (!inCombat) {
            const eqInfo = document.createElement('div')
            eqInfo.className = 'small'
            eqInfo.style.marginLeft = 'auto'
            eqInfo.textContent =
                'Equipped: ' + getEquipped().length + '/' + MAX_EQUIPPED_SPELLS
            topRow.appendChild(eqInfo)
        }

        body.appendChild(topRow)

        const help = document.createElement('div')
        help.className = 'spells-help'
        help.textContent = inCombat
            ? 'Combat: tap a spell to cast it. Loadout changes are disabled in combat.'
            : 'Outside combat: expand a spell to see details, equip/unequip, and upgrade.'
        body.appendChild(help)

        const legend = document.createElement('div')
        legend.className = 'spells-legend'
        legend.innerHTML = '<span class="badge">AoE</span><span class="badge">Single</span><span class="badge">Support</span>'
        body.appendChild(legend)

		// Patch 1.2.32 UI polish:
		// Instead of verbose meter banner text, the Spell Book highlights any abilities
		// that are currently empowered by the class meter (see card rendering below).

        const list = document.createElement('div')
        list.className = 'inv-list spellbook-cards'
        body.appendChild(list)

        function openAbilityUpgradeModal(id) {
            const ab = ABILITIES[id]
            if (!ab) return
            if ((p.abilityUpgradeTokens || 0) <= 0) {
                addLog('No upgrade tokens available.', 'system')
                return
            }

            const up = getAbilityUpgrade(p, id) || { potencyTier: 0, efficiencyTier: 0 }
            const potTier = up.potencyTier || 0
            const effTier = up.efficiencyTier || 0

            if (potTier >= ABILITY_UPGRADE_RULES.maxTier && effTier >= ABILITY_UPGRADE_RULES.maxTier) {
                addLog('That ability is already max tier.', 'system')
                return
            }

            openModal('Upgrade: ' + ab.name, (b) => {
                b.innerHTML = ''

                const help = document.createElement('div')
                help.className = 'small'
                help.textContent =
                    'Spend 1 token to increase Potency (effect) or Efficiency (cost). These tiers are independent.'
                b.appendChild(help)

                const row = document.createElement('div')
                row.className = 'item-actions'
                row.style.marginTop = '10px'

                const btnPot = document.createElement('button')
                btnPot.className = 'btn'
                btnPot.textContent = 'Potency (+effect)'
                btnPot.disabled = potTier >= ABILITY_UPGRADE_RULES.maxTier
                btnPot.addEventListener('click', () => doUpgrade('potency'))
                row.appendChild(btnPot)

                const btnEff = document.createElement('button')
                btnEff.className = 'btn'
                btnEff.textContent = 'Efficiency (-cost)'
                btnEff.disabled = effTier >= ABILITY_UPGRADE_RULES.maxTier
                btnEff.addEventListener('click', () => doUpgrade('efficiency'))
                row.appendChild(btnEff)

                b.appendChild(row)

                const cur = document.createElement('div')
                cur.className = 'small'
                cur.style.marginTop = '10px'
                cur.textContent =
                    'Current: Potency ' +
                    potTier +
                    '/' +
                    ABILITY_UPGRADE_RULES.maxTier +
                    ' • Efficiency ' +
                    effTier +
                    '/' +
                    ABILITY_UPGRADE_RULES.maxTier
                b.appendChild(cur)

                function doUpgrade(which) {
                    ensurePlayerSpellSystems(p)
                    if ((p.abilityUpgradeTokens || 0) <= 0) return

                    const existing = p.abilityUpgrades[id] || {}
                    // Migrate legacy shape to the new independent tier shape on first upgrade.
                    const legacy = getAbilityUpgrade(p, id) || { potencyTier: 0, efficiencyTier: 0 }

                    let nextPot = legacy.potencyTier || 0
                    let nextEff = legacy.efficiencyTier || 0

                    if (which === 'potency') {
                        if (nextPot >= ABILITY_UPGRADE_RULES.maxTier) return
                        nextPot = Math.min(ABILITY_UPGRADE_RULES.maxTier, nextPot + 1)
                    } else if (which === 'efficiency') {
                        if (nextEff >= ABILITY_UPGRADE_RULES.maxTier) return
                        nextEff = Math.min(ABILITY_UPGRADE_RULES.maxTier, nextEff + 1)
                    } else {
                        return
                    }

                    p.abilityUpgrades[id] = { potencyTier: nextPot, efficiencyTier: nextEff }
                    p.abilityUpgradeTokens = Math.max(0, (p.abilityUpgradeTokens || 0) - 1)

                    addLog(
                        ab.name +
                            ' upgraded: Potency ' +
                            nextPot +
                            '/' +
                            ABILITY_UPGRADE_RULES.maxTier +
                            ', Efficiency ' +
                            nextEff +
                            '/' +
                            ABILITY_UPGRADE_RULES.maxTier +
                            '.',
                        'good'
                    )
                    saveGame()
                    closeModal()
                    openSpellsModal(false)
                }
            })
        }

        // Patch 1.2.32 UI polish:
        // When the combat class meter is in a state that empowers certain abilities,
        // highlight those ability cards with a pulsing outline (tinted to the meter).
        function _isSupportAbilityCard(ab) {
            try {
                const nm = String((ab && ab.name) || '')
                const note = String((ab && ab.note) || '')
                return (
                    /heal|ward|shield|guard|barrier|restore|regen|buff/i.test(nm) ||
                    /heal|shield|barrier|ward|evasion|reduce damage|cleanse/i.test(note)
                )
            } catch (_) {
                return false
            }
        }

        function _isAbilityMeterBuffed(abilityId, ab) {
            if (!inCombat) return false
            try {
                const cid = String(p.classId || '')
                const st = p.status || {}
                const enemy = state.currentEnemy || null

                // Mage: Arcane Rhythm empowers the next mana spell when "Ready".
                if (cid === 'mage') {
                    const r = _getMageRhythmBonus(p, ab, abilityId)
                    if (r && r.active) return true
                }

                // Warrior: Bulwark at 40+ Fury empowers the next damaging ability.
                if (cid === 'warrior' && p.resourceKey === 'fury' && (p.resource || 0) >= 40) {
                    return !_isSupportAbilityCard(ab)
                }

                // Blood Knight: Bloodrush (high Blood) empowers damaging abilities.
                if (cid === 'blood' && p.resourceKey === 'blood') {
                    const mx = Math.max(1, Number(p.maxResource || 0))
                    const ratio = Number(p.resource || 0) / mx
                    if (ratio >= 0.8) return !_isSupportAbilityCard(ab)
                }

                // Ranger: At max Marks, damage is boosted; Headshot is the primary spender.
                if (cid === 'ranger' && enemy) {
                    const stacks = enemy.markedStacks || 0
                    if (stacks >= 5) {
                        if (abilityId === 'headshot') return true
                        return !_isSupportAbilityCard(ab)
                    }
                }

                // Rogue: At max Combo, highlight the finisher.
                if (cid === 'rogue') {
                    const cp = Math.max(0, Math.min(5, st.comboPoints || 0))
                    if (cp >= 5 && abilityId === 'eviscerate') return true
                }

                // Shaman: With an active Totem, Tempest is empowered.
                if (cid === 'shaman') {
                    if ((st.totemTurns || 0) > 0 && abilityId === 'tempest') return true
                }

                // Vampire: Hunger above threshold grants extra lifesteal on damaging hits.
                if (cid === 'vampire' && p.resourceKey === 'essence') {
                    const mx = Math.max(1, Number(p.maxResource || 0))
                    const ratio = Number(p.resource || 0) / mx
                    if (ratio >= 0.55) return !_isSupportAbilityCard(ab)
                }

                // Berserker: At high Frenzy (very low HP), finishers surge.
                if (cid === 'berserker') {
                    const mx = Math.max(1, Number(p.maxHp || 0))
                    const hp = Math.max(0, Number(p.hp || 0))
                    const missingPct = clampNumber((mx - hp) / mx, 0, 1)
                    if (missingPct >= 0.9) {
                        if (abilityId === 'execute' || abilityId === 'bloodFrenzy') return true
                    }
                }
            } catch (_) {}
            return false
        }

        function _applyMeterBuffOutline(card, abilityId, ab) {
            if (!card || !inCombat) return
            if (!_isAbilityMeterBuffed(abilityId, ab)) return
            card.classList.add('meter-buffed')
            card.setAttribute('data-meter-class', String(p.classId || ''))
        }

        function makeAbilityCard(id, { label = '' } = {}) {
            const ab = ABILITIES[id]
            if (!ab) return null

            const isEq = isEquipped(id)
            const up = getAbilityUpgrade(p, id) || { potencyTier: 0, efficiencyTier: 0 }
            const potTier = up.potencyTier || 0
            const effTier = up.efficiencyTier || 0
            const isMaxTier =
                potTier >= ABILITY_UPGRADE_RULES.maxTier &&
                effTier >= ABILITY_UPGRADE_RULES.maxTier
            // IMPORTANT: show the *effective* cost (upgrade reductions + class passives)
            // so when the player chooses Efficiency, the new cost displays immediately.
            const effectiveCost = getEffectiveAbilityCost(p, id)

            const card = document.createElement('details')
            card.className = 'inv-card spell-card' + (inCombat ? ' in-combat' : '')
            // Always start collapsed when opening the Spell Book.
            card.open = false

            // Combat meter cue: pulse the outline when this ability is currently empowered.
            _applyMeterBuffOutline(card, id, ab)

            const summary = document.createElement('summary')
            summary.className = 'inv-card-header'

            // In combat, prevent collapsing and cast on tap.
            if (inCombat) {
                summary.addEventListener('click', (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    useAbilityInCombat(id)
                })
            }

            const left = document.createElement('div')
            left.className = 'inv-left'

            const name = document.createElement('div')
            name.className = 'inv-name'
            name.textContent = ab.name
            left.appendChild(name)

            const badges = document.createElement('div')
            badges.className = 'spell-badges';
            ;(getSpellBadges(id) || []).forEach((b) => {
                const s = document.createElement('span')
                s.className = 'badge'
                s.textContent = b
                badges.appendChild(s)
            })
            left.appendChild(badges)

            const sub = document.createElement('div')
            sub.className = 'inv-sub'
            const bits = []
            bits.push(formatCost(effectiveCost, id).replace('Cost: ', ''))
            if (label) bits.push(label)
            if (isEq && !inCombat) bits.push('Equipped')
            if (potTier > 0 || effTier > 0) bits.push('P' + potTier + '/E' + effTier)
            sub.textContent = bits.filter(Boolean).join(' • ')
            left.appendChild(sub)

            // Patch 1.2.0: In combat, show a short spell description inline
            // because the card can't be expanded (tap casts immediately).
            if (inCombat) {
                const hint = document.createElement('div')
                hint.className = 'small'
                hint.style.opacity = '0.85'
                hint.style.marginTop = '2px'
                hint.textContent = ab.note || ''
                left.appendChild(hint)
            }


            // Patch 1.2.32: meter messaging moved to the pulsing outline cue.

            summary.appendChild(left)
            // No right column in the Spell Book (keeps the header compact and avoids empty space).

            const details = document.createElement('div')
            details.className = 'inv-details'

            const desc = document.createElement('div')
            desc.className = 'inv-desc'
            desc.textContent = ab.note || ''
            details.appendChild(desc)

            const meta = document.createElement('div')
            meta.className = 'small'
            meta.style.marginTop = '8px'
            const upText =
                potTier > 0 || effTier > 0
                    ? 'Upgrades: Potency ' + potTier + '/' + ABILITY_UPGRADE_RULES.maxTier + ', Efficiency ' + effTier + '/' + ABILITY_UPGRADE_RULES.maxTier
                    : 'Upgrades: None'
            meta.textContent =
                'Cost: ' +
                formatCost(effectiveCost, id).replace('Cost: ', '') +
                '  •  ' +
                upText
            details.appendChild(meta)

            const actions = document.createElement('div')
            actions.className = 'inv-actions'

            if (inCombat) {
                // Optional secondary button (for players who prefer explicit Use).
                const btnUse = document.createElement('button')
                btnUse.className = 'btn small'
                btnUse.textContent = 'Use'
                btnUse.addEventListener('click', (e) => {
                    e.preventDefault()
                    useAbilityInCombat(id)
                })
                actions.appendChild(btnUse)

                details.appendChild(actions)
            } else {
                // Out of combat: equip/unequip + upgrade
                    const tight = document.createElement('div')
                    tight.className = 'inv-actions-tight'

                if (!inCombat) {

                if (isEq) {
                    const btnUn = document.createElement('button')
                    btnUn.className = 'btn small'
                    btnUn.textContent = 'Unequip'
                    btnUn.addEventListener('click', (e) => {
                        e.preventDefault()
                        p.equippedSpells = (p.equippedSpells || []).filter(
                            (x) => x !== id
                        )
                        ensurePlayerSpellSystems(p)
                        saveGame()
                        render()
                    })
                        tight.appendChild(btnUn)
                } else {
                    const btnEq = document.createElement('button')
                    btnEq.className = 'btn small'
                    btnEq.textContent = 'Equip'
                    btnEq.disabled =
                        (p.equippedSpells || []).length >= MAX_EQUIPPED_SPELLS
                    btnEq.addEventListener('click', (e) => {
                        e.preventDefault()
                        ensurePlayerSpellSystems(p)
                        if ((p.equippedSpells || []).length >= MAX_EQUIPPED_SPELLS) {
                            addLog(
                                'Loadout is full. Unequip an ability first.',
                                'system'
                            )
                            return
                        }
                        p.equippedSpells.push(id)
                        ensurePlayerSpellSystems(p)
                        saveGame()
                        render()
                    })
                    tight.appendChild(btnEq)
                }

                // Remove the Upgrade button entirely once max tier is reached.
                if (!isMaxTier) {
                    const btnUp = document.createElement('button')
                    btnUp.className = 'btn small'
                    btnUp.textContent = 'Upgrade'
                    btnUp.disabled = (p.abilityUpgradeTokens || 0) <= 0
                    btnUp.addEventListener('click', (e) => {
                        e.preventDefault()
                        openAbilityUpgradeModal(id)
                    })
                    tight.appendChild(btnUp)
                }

                }

                if (tight.childNodes.length) actions.appendChild(tight)

                details.appendChild(actions)
            }

            card.appendChild(summary)
            card.appendChild(details)
            return card
        }

        function addSubhead(text) {
            const h = document.createElement('div')
            h.className = 'spellbook-subhead'
            h.textContent = text
            list.appendChild(h)
        }

        function addEmpty(text) {
            const e = document.createElement('p')
            e.className = 'modal-subtitle'
            e.textContent = text
            list.appendChild(e)
        }

        function render() {
            list.innerHTML = ''

            const equipped = getEquipped()
            const known = getKnown()

            if (inCombat) {
                if (!equipped.length) {
                    addEmpty('No equipped abilities. Equip some outside of combat.')
                    return
                }
                equipped.forEach((id, i) => {
                    const card = makeAbilityCard(id)
                    if (card) list.appendChild(card)
                })
                return
            }

            addSubhead('Equipped')
            if (!equipped.length) {
                addEmpty('No equipped abilities yet.')
            } else {
                equipped.forEach((id, i) => {
                    const card = makeAbilityCard(id, { label: 'Loadout' })
                    if (card) list.appendChild(card)
                })
            }

            addSubhead('Known')
            const rest = known.filter((id) => !equipped.includes(id))
            if (!rest.length) {
                addEmpty('No additional known abilities.')
            } else {
                rest.forEach((id) => {
                    const card = makeAbilityCard(id)
                    if (card) list.appendChild(card)
                })
            }

            // Safety sweep: ensure every card starts collapsed whenever the Spell Book opens.
            // (Prevents any browser quirks from leaving the first <details> expanded.)
            list.querySelectorAll('details').forEach((d) => {
                d.open = false
            })
        }

        render()
    })
}


    return { openSpellsModal }
}
