/**
 * governmentModal.js
 * 
 * Realm & Government modal UI for displaying kingdom state.
 * Extracted from gameOrchestrator.js to reduce file size.
 * 
 * ~259 lines extracted.
 */

/**
 * Creates the government modal function with all necessary dependencies injected.
 * @returns {Function} openGovernmentModal function
 */
export function createGovernmentModal({
    // Core state
    state,
    
    // UI functions
    openModal,
    
    // Game system functions
    getTimeInfo,
    initGovernmentState,
    getGovernmentSummary,
    getVillageGovernmentEffect,
    getVillageEconomySummary
}) {
    return function openGovernmentModal() {
        // Make sure government state exists (handles old saves too)
        const timeInfo = getTimeInfo(state)
        const absoluteDay = timeInfo ? timeInfo.absoluteDay : 0
        initGovernmentState(state, absoluteDay)

        const gov = state.government
        const summary = getGovernmentSummary(state)
        const villageEffect = getVillageGovernmentEffect(state, 'village')

        // Government-aware village economy (already adjusted by royal influence)
        const villageEconomy = getVillageEconomySummary(state)
        openModal('Realm & Government', (body) => {
            // --- CARD 1: REALM OVERVIEW ---------------------------------------------
            const overviewCard = document.createElement('div')
            overviewCard.className = 'item-row'

            const header = document.createElement('div')
            header.className = 'item-row-header'

            const title = document.createElement('span')
            title.className = 'item-name'
            title.textContent = summary.realmName || 'The Realm'
            header.appendChild(title)

            const tag = document.createElement('span')
            tag.className = 'tag'
            tag.textContent = summary.capitalName
                ? `Capital: ${summary.capitalName}`
                : 'Overworld Government'
            header.appendChild(tag)

            overviewCard.appendChild(header)

            const when = document.createElement('p')
            when.className = 'modal-subtitle'
            if (timeInfo) {
                when.textContent = `As of ${timeInfo.weekdayName} ${timeInfo.partName}, Year ${timeInfo.year}.`
            } else {
                when.textContent = 'Current state of the realm.'
            }
            overviewCard.appendChild(when)

            const metrics = summary.metrics || {
                stability: 50,
                prosperity: 50,
                royalPopularity: 50,
                corruption: 50
            }

            const metricsLine = document.createElement('p')
            metricsLine.className = 'modal-subtitle'
            metricsLine.textContent =
                `Stability: ${metrics.stability} * ` +
                `Prosperity: ${metrics.prosperity} * ` +
                `Popularity: ${metrics.royalPopularity} * ` +
                `Corruption: ${metrics.corruption}`
            overviewCard.appendChild(metricsLine)

            if (summary.lastDecreeTitle) {
                const decreeLine = document.createElement('p')
                decreeLine.className = 'modal-subtitle'
                decreeLine.textContent = `Latest decree: ${summary.lastDecreeTitle}`
                overviewCard.appendChild(decreeLine)
            }

            body.appendChild(overviewCard)

            // --- CARD 2: ROYAL FAMILY -----------------------------------------------
            const famCard = document.createElement('div')
            famCard.className = 'item-row'

            const famHeader = document.createElement('div')
            famHeader.className = 'item-row-header'

            const famTitle = document.createElement('span')
            famTitle.className = 'item-name'
            famTitle.textContent = 'Royal Family'
            famHeader.appendChild(famTitle)

            const famTag = document.createElement('span')
            famTag.className = 'tag'
            famTag.textContent = `${summary.monarchTitle || 'Ruler'} of the realm`
            famHeader.appendChild(famTag)

            famCard.appendChild(famHeader)

            const monarchLine = document.createElement('p')
            monarchLine.className = 'modal-subtitle'
            monarchLine.textContent = `${summary.monarchTitle || 'Ruler'} ${
                summary.monarchName || 'Unknown'
            }`
            famCard.appendChild(monarchLine)

            if (summary.married && summary.spouseName) {
                const spouseLine = document.createElement('p')
                spouseLine.className = 'modal-subtitle'
                spouseLine.textContent = `Spouse: ${summary.spouseName}`
                famCard.appendChild(spouseLine)
            }

            const kidsLine = document.createElement('p')
            kidsLine.className = 'modal-subtitle'
            kidsLine.textContent =
                summary.childrenCount > 0
                    ? `Children: ${summary.childrenCount} (eldest is heir to the throne).`
                    : 'No heirs of age are currently known at court.'
            famCard.appendChild(kidsLine)

            body.appendChild(famCard)

            // --- CARD 3: ROYAL COUNCIL ----------------------------------------------
            const councilCard = document.createElement('div')
            councilCard.className = 'item-row'

            const councilHeader = document.createElement('div')
            councilHeader.className = 'item-row-header'

            const councilTitle = document.createElement('span')
            councilTitle.className = 'item-name'
            councilTitle.textContent = 'Royal Council'
            councilHeader.appendChild(councilTitle)

            const councilTag = document.createElement('span')
            councilTag.className = 'tag'
            councilTag.textContent = `${summary.councilCount || 0} seats at court`
            councilHeader.appendChild(councilTag)

            councilCard.appendChild(councilHeader)

            if (gov && Array.isArray(gov.council) && gov.council.length) {
                gov.council.forEach((member) => {
                    const row = document.createElement('div')
                    row.className = 'equip-row'

                    const left = document.createElement('span')
                    left.textContent = `${member.role}: ${member.name}`
                    row.appendChild(left)

                    const right = document.createElement('span')
                    right.className = 'stat-note'
                    const loyalty = Math.round(member.loyalty)
                    right.textContent = `${member.ideology} * Loyalty ${loyalty} * ${member.mood}`
                    row.appendChild(right)

                    councilCard.appendChild(row)
                })
            } else {
                const none = document.createElement('p')
                none.className = 'modal-subtitle'
                none.textContent =
                    'No council members are currently recorded in the royal rolls.'
                councilCard.appendChild(none)
            }

            body.appendChild(councilCard)

            // --- CARD 4: VILLAGE ATTITUDES ------------------------------------------
            const villageCard = document.createElement('div')
            villageCard.className = 'item-row'

            const villageHeader = document.createElement('div')
            villageHeader.className = 'item-row-header'

            const villageTitle = document.createElement('span')
            villageTitle.className = 'item-name'
            villageTitle.textContent = 'Emberwood Village'
            villageHeader.appendChild(villageTitle)

            const villageTag = document.createElement('span')
            villageTag.className = 'tag'
            villageTag.textContent = 'Local leadership & mood'
            villageHeader.appendChild(villageTag)

            villageCard.appendChild(villageHeader)

            const moodLine = document.createElement('p')
            moodLine.className = 'modal-subtitle'

            if (villageEffect.hasData) {
                moodLine.textContent =
                    `Loyalty: ${Math.round(villageEffect.loyalty)} * ` +
                    `Fear: ${Math.round(villageEffect.fear)} * ` +
                    `Unrest: ${Math.round(villageEffect.unrest)}`
                villageCard.appendChild(moodLine)

                const desc = document.createElement('p')
                desc.className = 'modal-subtitle'
                desc.textContent = villageEffect.description
                villageCard.appendChild(desc)

                const mods = document.createElement('p')
                mods.className = 'modal-subtitle'
                mods.textContent =
                    `Prosperity modifier: ${villageEffect.prosperityModifier.toFixed(
                        2
                    )} * ` +
                    `Safety modifier: ${villageEffect.safetyModifier.toFixed(2)}`
                villageCard.appendChild(mods)
            } else {
                moodLine.textContent =
                    "The crown's influence on Emberwood is still being felt out."
                villageCard.appendChild(moodLine)
            }

            // NEW: show what the rest of the systems actually "see"
            const econLine = document.createElement('p')
            econLine.className = 'modal-subtitle'
            econLine.textContent =
                `Village economy - Prosperity ${villageEconomy.prosperity} * ` +
                `Trade ${villageEconomy.trade} * ` +
                `Security ${villageEconomy.security}`
            villageCard.appendChild(econLine)

            body.appendChild(villageCard)

            // --- CARD 5: RECENT DECREE LOG ------------------------------------------
            const historyCard = document.createElement('div')
            historyCard.className = 'item-row'

            const historyHeader = document.createElement('div')
            historyHeader.className = 'item-row-header'

            const historyTitle = document.createElement('span')
            historyTitle.className = 'item-name'
            historyTitle.textContent = 'Recent Decrees & Events'
            historyHeader.appendChild(historyTitle)

            const historyTag = document.createElement('span')
            historyTag.className = 'tag'
            historyTag.textContent = 'Last few changes at court'
            historyHeader.appendChild(historyTag)

            historyCard.appendChild(historyHeader)

            if (gov && Array.isArray(gov.history) && gov.history.length) {
                const recent = gov.history
                    .slice(-6) // last 6
                    .reverse() // newest first

                recent.forEach((ev) => {
                    const line = document.createElement('p')
                    line.className = 'modal-subtitle'
                    const dayLabel =
                        typeof ev.day === 'number' ? `Day ${ev.day}` : 'Unknown day'
                    line.textContent = `${dayLabel}: ${ev.title} - ${ev.description}`
                    historyCard.appendChild(line)
                })
            } else {
                const none = document.createElement('p')
                none.className = 'modal-subtitle'
                none.textContent =
                    'The royal scribes have not yet recorded any notable decrees.'
                historyCard.appendChild(none)
            }

            body.appendChild(historyCard)
        })
    }
}
