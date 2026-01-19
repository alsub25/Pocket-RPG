// js/game/world3d/world3dManager.js
// Manages the 3D world integration with the game

import { init3DWorld, dispose3DWorld, getPlayerPosition, setPlayerPosition, changeArea, getCurrentArea, getAvailableAreas, syncFromGameArea } from './scene3d.js';

let is3DActive = false;
let world3DContainer = null;

/**
 * Initialize 3D world manager
 * @param {Object} engine - Game engine reference
 */
export function initWorld3DManager(engine) {
  console.log('2D Map Manager initialized');
  
  // Create the 3D world container in the DOM
  createWorld3DContainer();
  
  // Set up the toggle button
  setupToggleButton(engine);
  
  // Expose area change function globally for integration
  window.changeMapArea = (areaName) => {
    if (is3DActive) {
      changeArea(areaName);
    }
  };
  
  // Building name to modal function mapping
  const buildingModals = {
    'Tavern': 'openTavern',
    'Bank': 'openBank',
    'Town Hall': 'openTownHall',
    'Merchant': 'openMerchant'
  };
  
  // Expose game modal opening function
  window.openGameModal = (buildingName) => {
    console.log(`Opening modal for ${buildingName}`);
    const modalFunctionName = buildingModals[buildingName];
    
    if (modalFunctionName && window[modalFunctionName]) {
      window[modalFunctionName]();
    } else {
      console.warn(`No modal handler for ${buildingName}`);
    }
  };
  
  // Listen for game area changes to sync the map
  if (engine && engine.on) {
    engine.on('area:enter', (data) => {
      if (is3DActive && data && data.id) {
        syncFromGameArea(data.id);
      }
    });
  }
  
  // Expose setArea from game for map to use
  if (engine && engine.getState) {
    const state = engine.getState();
    if (state && state.area) {
      // Get setArea function from runtime
      window.gameSetArea = (areaId, opts) => {
        if (engine.emit) {
          engine.emit('game:setArea', { area: areaId, ...opts });
        }
      };
    }
  }
}

/**
 * Create the 3D world container element
 */
function createWorld3DContainer() {
  world3DContainer = document.createElement('div');
  world3DContainer.id = 'world3D';
  world3DContainer.className = 'world-3d-container hidden';
  world3DContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    background: #000;
  `;
  
  // Add instructions overlay
  const instructions = document.createElement('div');
  instructions.className = 'world-3d-instructions';
  instructions.innerHTML = `
    <div class="instructions-panel">
      <h3>🗺️ World Map</h3>
      <p><strong>Tap/Click:</strong> Move or enter buildings</p>
      <p><strong>Drag:</strong> Pan camera</p>
      <p><strong>Pinch/Wheel:</strong> Zoom in/out</p>
      <p><strong>Buildings:</strong> Tavern, Bank, Town Hall, Merchant</p>
    </div>
  `;
  instructions.style.cssText = `
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 15px 20px;
    border-radius: 10px;
    font-family: var(--font, Arial, sans-serif);
    z-index: 1001;
    pointer-events: none;
  `;
  
  // Add exit button
  const exitButton = document.createElement('button');
  exitButton.className = 'world-3d-exit-btn';
  exitButton.innerHTML = '✕ Exit Map View';
  
  exitButton.addEventListener('click', () => {
    // Close the 3D world
    world3DContainer.classList.add('hidden');
    is3DActive = false;
    console.log('3D World exited via exit button');
  });
  
  world3DContainer.appendChild(instructions);
  world3DContainer.appendChild(exitButton);
  document.body.appendChild(world3DContainer);
}

/**
 * Set up the toggle button in the game UI
 */
function setupToggleButton(engine) {
  // Find the HUD top buttons area
  const hudTopButtons = document.querySelector('.hud-top-buttons');
  if (!hudTopButtons) {
    console.warn('Could not find HUD top buttons area');
    return;
  }
  
  // Create toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'btn3DWorld';
  toggleButton.className = 'icon-btn';
  toggleButton.title = 'Map View';
  toggleButton.innerHTML = '🗺️';
  
  // Insert before the menu button
  const menuButton = document.getElementById('btnGameMenu');
  if (menuButton) {
    hudTopButtons.insertBefore(toggleButton, menuButton);
  } else {
    hudTopButtons.appendChild(toggleButton);
  }
  
  // Add click handler
  toggleButton.addEventListener('click', () => {
    toggle3DWorld(engine);
  });
}

/**
 * Toggle between 3D world and normal game view
 */
export function toggle3DWorld(engine) {
  is3DActive = !is3DActive;
  
  if (is3DActive) {
    // Show 3D world
    world3DContainer.classList.remove('hidden');
    
    // Initialize the 3D scene if not already done
    if (!world3DContainer.querySelector('canvas')) {
      init3DWorld(world3DContainer);
      
      // Sync player position from game state if available
      const state = engine?.state;
      if (state?.player?.position3D) {
        setPlayerPosition(
          state.player.position3D.x,
          state.player.position3D.y,
          state.player.position3D.z
        );
      }
    }
    
    console.log('3D World activated');
  } else {
    // Hide 3D world
    world3DContainer.classList.add('hidden');
    
    // Save player position to game state
    if (engine?.state?.player) {
      const pos = getPlayerPosition();
      engine.state.player.position3D = pos;
    }
    
    console.log('3D World deactivated');
  }
}

/**
 * Check if 3D world is currently active
 */
export function is3DWorldActive() {
  return is3DActive;
}

/**
 * Clean up 3D world resources
 */
export function cleanup3DWorld() {
  if (is3DActive) {
    dispose3DWorld();
  }
  is3DActive = false;
}
