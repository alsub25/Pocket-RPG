// js/game/locations/village/fishingSpot.js
// Fishing Spot location
//
// Modal for fishing mini-game

import { fishSpecies, fishingLocations, getAvailableFish, isLocationUnlocked } from '../../data/fishing.js';

/**
 * Open the fishing spot modal
 */
export function openFishingSpotModalImpl({
  state,
  openModal,
  closeModal,
  engine
}) {
  const _open = () => {
    const player = state.player;
    const fishing = state.fishing || {};
    const unlockedLocations = fishing.unlockedLocations || ['villageRiver'];
    const timeOfDay = state.time?.dayPart || 'morning';
    
    let html = `
      <div class="fishing-modal">
        <h3>🎣 Fishing Spot</h3>
        <p class="hint">Cast your line and catch fish! Different fish appear at different times.</p>
        
        <div class="fishing-time">
          <strong>Current Time:</strong> ${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)}
        </div>
        
        <div class="fishing-locations">
          <h4>Choose a Location</h4>
    `;
    
    // Show available locations
    for (const [locId, loc] of Object.entries(fishingLocations)) {
      const isUnlocked = unlockedLocations.includes(locId) || isLocationUnlocked(locId, player.level);
      const lockedClass = isUnlocked ? '' : 'locked';
      const unlockText = loc.unlockRequirement?.level ? ` (Unlock at level ${loc.unlockRequirement.level})` : '';
      
      if (isUnlocked) {
        html += `
          <div class="location-card ${lockedClass}">
            <div class="location-header">
              <strong>${loc.name}</strong>
            </div>
            <p>${loc.description}</p>
            <button class="fish-btn" data-location="${locId}">🎣 Cast Line</button>
          </div>
        `;
      } else {
        html += `
          <div class="location-card ${lockedClass}">
            <div class="location-header">
              <strong>🔒 ${loc.name}</strong>
            </div>
            <p>${loc.description}</p>
            <p class="hint">${unlockText}</p>
          </div>
        `;
      }
    }
    
    html += `
        </div>
        
        <div class="fishing-stats">
          <h4>📊 Fishing Statistics</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <span>Total Caught:</span>
              <strong>${fishing.totalCaught || 0}</strong>
            </div>
            <div class="stat-item">
              <span>Success Rate:</span>
              <strong>${player.fishingStats?.successRate?.toFixed(1) || 0}%</strong>
            </div>
            <div class="stat-item">
              <span>Unique Species:</span>
              <strong>${Object.keys(fishing.fishCaught || {}).length}</strong>
            </div>
          </div>
          ${fishing.bestCatch ? `
            <div class="best-catch">
              <strong>Best Catch:</strong> ${fishing.bestCatch.icon} ${fishing.bestCatch.name} (${fishing.bestCatch.rarity})
            </div>
          ` : ''}
        </div>
        
        <button class="close-fishing-btn">Close</button>
      </div>
    `;
    
    openModal(html);
    
    // Attach event listeners
    setTimeout(() => {
      const fishBtns = document.querySelectorAll('.fish-btn');
      fishBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const locationId = btn.dataset.location;
          if (locationId && engine) {
            try {
              const fishingService = engine.getService('fishing');
              if (fishingService) {
                const result = fishingService.attemptFishing(locationId);
                
                if (result.success) {
                  const fish = result.fish;
                  let message = `🎣 You caught a ${fish.icon} ${fish.name}!`;
                  
                  if (result.convertedToMaterial) {
                    message += ` It transformed into crafting material!`;
                  }
                  
                  closeModal();
                  const ui = engine.get('ui');
                  if (ui && ui.addLog) {
                    ui.addLog(message, 'good');
                  }
                  
                  // Show result modal
                  showFishCaughtModal(fish, result.convertedToMaterial, openModal, closeModal);
                } else {
                  const ui = engine.get('ui');
                  if (ui && ui.addLog) {
                    ui.addLog(result.error || 'The fish got away!', 'system');
                  }
                }
              }
            } catch (e) {
              console.error('Fishing error:', e);
              alert('Fishing failed');
            }
          }
        });
      });
      
      const closeBtn = document.querySelector('.close-fishing-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          closeModal();
        });
      }
    }, 0);
  };
  
  return _open();
}

/**
 * Show fish caught result modal
 */
function showFishCaughtModal(fish, convertedToMaterial, openModal, closeModal) {
  let html = `
    <div class="fish-caught-modal">
      <h3>🎣 Fish Caught!</h3>
      <div class="fish-display">
        <div class="fish-icon">${fish.icon}</div>
        <h4>${fish.name}</h4>
        <p class="fish-rarity">${fish.rarity.toUpperCase()}</p>
        <p>${fish.description}</p>
      </div>
      
      <div class="fish-stats">
        <div><strong>HP Restore:</strong> ${fish.restoreHP || 0}</div>
        <div><strong>Sell Value:</strong> ${fish.sellValue}g</div>
        ${fish.bonus ? `<div><strong>Bonus:</strong> ${Object.entries(fish.bonus).map(([k, v]) => `+${v} ${k}`).join(', ')}</div>` : ''}
      </div>
      
      ${convertedToMaterial ? `
        <p class="hint">✨ This fish was converted to crafting material!</p>
      ` : `
        <p class="hint">The fish has been added to your inventory.</p>
      `}
      
      <button class="close-result-btn">Continue Fishing</button>
    </div>
  `;
  
  openModal(html);
  
  setTimeout(() => {
    const closeBtn = document.querySelector('.close-result-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closeModal();
      });
    }
  }, 0);
}
