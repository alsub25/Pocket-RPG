// js/game/locations/village/workshop.js
// Crafting Workshop location
//
// Modal for crafting items, processing materials, and enchanting equipment

import { craftingRecipes, craftingMaterials, enchantmentRecipes, canCraft } from '../../data/crafting.js';

/**
 * Open the crafting workshop modal
 */
export function openWorkshopModalImpl({
  state,
  openModal,
  closeModal,
  engine
}) {
  const _open = () => {
    openModal('🔨 Crafting Workshop', (body) => {
      const player = state.player;
      const crafting = state.crafting || {};
      const materials = crafting.materials || {};
      const unlockedRecipes = crafting.unlockedRecipes || [];
      
      let html = `
      <div class="workshop-modal">
        <h3>🔨 Crafting Workshop</h3>
        <p class="hint">Craft items, process materials, and enchant equipment</p>
        
        <div class="workshop-tabs">
          <button class="workshop-tab active" data-tab="crafting">Crafting</button>
          <button class="workshop-tab" data-tab="materials">Materials</button>
          <button class="workshop-tab" data-tab="enchanting">Enchanting</button>
        </div>
        
        <div class="workshop-content">
          <!-- Crafting Tab -->
          <div class="workshop-panel" data-panel="crafting">
            <h4>Available Recipes</h4>
            <div class="recipes-list">
    `;
    
    // Show available recipes
    const availableRecipes = unlockedRecipes
      .map(id => craftingRecipes[id])
      .filter(r => r && r.requiredLevel <= player.level);
    
    if (availableRecipes.length === 0) {
      html += '<p class="hint">No recipes unlocked yet. Complete quests to unlock recipes!</p>';
    } else {
      for (const recipe of availableRecipes) {
        const craftCheck = canCraft(recipe, player.level, materials);
        const canCraftThis = craftCheck.canCraft;
        const disabledClass = canCraftThis ? '' : 'disabled';
        
        html += `
          <div class="recipe-card ${disabledClass}">
            <div class="recipe-header">
              <strong>${recipe.name}</strong>
              <span class="recipe-type">${recipe.type}</span>
            </div>
            <p class="recipe-desc">${recipe.description}</p>
            <div class="recipe-materials">
              <strong>Materials:</strong>
        `;
        
        for (const [matId, qty] of Object.entries(recipe.materials)) {
          const mat = craftingMaterials[matId];
          const have = materials[matId] || 0;
          const hasEnough = have >= qty;
          const color = hasEnough ? 'green' : 'red';
          html += `<span style="color: ${color}">${mat?.icon || ''} ${mat?.name || matId} (${have}/${qty})</span> `;
        }
        
        html += `
            </div>
            <button class="craft-btn" data-recipe="${recipe.id}" ${canCraftThis ? '' : 'disabled'}>
              ${canCraftThis ? 'Craft' : craftCheck.reason}
            </button>
          </div>
        `;
      }
    }
    
    html += `
            </div>
          </div>
          
          <!-- Materials Tab -->
          <div class="workshop-panel hidden" data-panel="materials">
            <h4>Your Materials</h4>
            <div class="materials-list">
    `;
    
    const hasMaterials = Object.keys(materials).length > 0;
    if (!hasMaterials) {
      html += '<p class="hint">No materials collected yet. Defeat enemies and explore to find materials!</p>';
    } else {
      for (const [matId, qty] of Object.entries(materials)) {
        if (qty > 0) {
          const mat = craftingMaterials[matId];
          if (mat) {
            html += `
              <div class="material-card">
                <span class="material-icon">${mat.icon}</span>
                <div class="material-info">
                  <strong>${mat.name}</strong> x${qty}
                  <p class="hint">${mat.description}</p>
                  <small>Rarity: ${mat.rarity} | Value: ${mat.sellValue}g each</small>
                </div>
              </div>
            `;
          }
        }
      }
    }
    
    html += `
            </div>
          </div>
          
          <!-- Enchanting Tab -->
          <div class="workshop-panel hidden" data-panel="enchanting">
            <h4>Enchant Equipment</h4>
            <p class="hint">Enhance your equipped weapons and armor with magical bonuses</p>
            <div class="enchanting-list">
    `;
    
    const hasWeapon = player.equipment?.weapon;
    const hasArmor = player.equipment?.armor;
    
    if (!hasWeapon && !hasArmor) {
      html += '<p class="hint">Equip a weapon or armor first to enchant it!</p>';
    } else {
      html += '<p><strong>Available Enchantments:</strong></p>';
      
      for (const [enchId, ench] of Object.entries(enchantmentRecipes)) {
        const canAfford = Object.entries(ench.materials).every(([matId, qty]) => {
          return (materials[matId] || 0) >= qty;
        });
        const canLevel = player.level >= ench.requiredLevel;
        const canEnchant = canAfford && canLevel;
        
        html += `
          <div class="enchant-card ${canEnchant ? '' : 'disabled'}">
            <strong>${ench.name}</strong>
            <p>${ench.description}</p>
            <div class="enchant-materials">
              <strong>Materials:</strong>
        `;
        
        for (const [matId, qty] of Object.entries(ench.materials)) {
          const mat = craftingMaterials[matId];
          const have = materials[matId] || 0;
          const hasEnough = have >= qty;
          const color = hasEnough ? 'green' : 'red';
          html += `<span style="color: ${color}">${mat?.icon || ''} ${mat?.name || matId} (${have}/${qty})</span> `;
        }
        
        html += `
            </div>
            <div class="enchant-bonuses">
              <strong>Bonuses:</strong>
        `;
        
        for (const [stat, value] of Object.entries(ench.bonus)) {
          html += `<span>+${value} ${stat}</span> `;
        }
        
        html += `
            </div>
            <div class="enchant-actions">
              ${hasWeapon ? `<button class="enchant-btn" data-enchant="${enchId}" data-slot="weapon" ${canEnchant ? '' : 'disabled'}>Enchant Weapon</button>` : ''}
              ${hasArmor ? `<button class="enchant-btn" data-enchant="${enchId}" data-slot="armor" ${canEnchant ? '' : 'disabled'}>Enchant Armor</button>` : ''}
            </div>
          </div>
        `;
      }
    }
    
    html += `
            </div>
          </div>
        </div>
        
        <button class="close-workshop-btn">Close</button>
      </div>
    `;
      
      // Set the HTML content
      body.innerHTML = html;
      
      // Attach event listeners after modal is opened
      setTimeout(() => {
      // Tab switching
      const tabs = document.querySelectorAll('.workshop-tab');
      const panels = document.querySelectorAll('.workshop-panel');
      
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const targetPanel = tab.dataset.tab;
          
          tabs.forEach(t => t.classList.remove('active'));
          panels.forEach(p => p.classList.add('hidden'));
          
          tab.classList.add('active');
          const panel = document.querySelector(`[data-panel="${targetPanel}"]`);
          if (panel) panel.classList.remove('hidden');
        });
      });
      
      // Craft buttons
      const craftBtns = document.querySelectorAll('.craft-btn');
      craftBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const recipeId = btn.dataset.recipe;
          if (recipeId && engine) {
            try {
              const craftingService = engine.getService('crafting');
              if (craftingService) {
                const result = craftingService.craft(recipeId);
                if (result.success) {
                  closeModal();
                  const ui = engine.get('ui');
                  if (ui && ui.addLog) {
                    ui.addLog(`✅ Crafted: ${result.item.name}`, 'good');
                  }
                } else {
                  alert(result.error || 'Failed to craft');
                }
              }
            } catch (e) {
              console.error('Crafting error:', e);
              alert('Crafting failed');
            }
          }
        });
      });
      
      // Enchant buttons
      const enchantBtns = document.querySelectorAll('.enchant-btn');
      enchantBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const enchantId = btn.dataset.enchant;
          const slot = btn.dataset.slot;
          if (enchantId && slot && engine) {
            try {
              const craftingService = engine.getService('crafting');
              if (craftingService) {
                const result = craftingService.enchant(enchantId, slot);
                if (result.success) {
                  closeModal();
                  const ui = engine.get('ui');
                  if (ui && ui.addLog) {
                    ui.addLog(`✨ Enchanted ${slot}!`, 'good');
                  }
                } else {
                  alert(result.error || 'Failed to enchant');
                }
              }
            } catch (e) {
              console.error('Enchanting error:', e);
              alert('Enchanting failed');
            }
          }
        });
      });
      
      // Close button
      const closeBtn = document.querySelector('.close-workshop-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          closeModal();
        });
        }
      }, 0);
    });
  };
  
  return _open();
}
