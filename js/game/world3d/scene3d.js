// js/game/world3d/scene2d-topdown.js
// 2D Top-Down World View - Unified World System
//
// This module creates a 2D top-down view of ONE seamless world that players can explore.

let canvas, ctx;
let player = { x: 0, y: 0, angle: 0, targetX: 0, targetY: 0, isMoving: false };
let moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
const MOVE_SPEED = 0.15;

// Camera offset for panning
let cameraOffset = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let lastTouchDistance = null;

// Responsive zoom - smaller on mobile for better view
const getZoom = () => {
  const isMobile = window.innerWidth < 768;
  return isMobile ? 15 : 30; // Pixels per world unit
};
let ZOOM = getZoom();
const MIN_ZOOM = 5;
const MAX_ZOOM = 60;

// Unified world - 120x120 units (-60 to 60 in each direction)
const WORLD_SIZE = 120;
const WORLD_HALF = WORLD_SIZE / 2;

// World objects (single unified world, no more areas)
let worldObjects = {
  trees: [],
  buildings: [],
  rocks: [],
  paths: [],
  rivers: [],
  npcs: [],
  enemies: []
};

// Pathfinding
let pathToTarget = [];

/**
 * Check if a point collides with a building
 * @param {number} worldX - World X coordinate
 * @param {number} worldY - World Y coordinate
 * @param {Object} building - Building object with x, y, width, height
 * @returns {boolean} True if point is inside building
 */
function isPointInBuilding(worldX, worldY, building) {
  const halfW = building.width / 2;
  const halfH = building.height / 2;
  return worldX >= building.x - halfW && worldX <= building.x + halfW &&
         worldY >= building.y - halfH && worldY <= building.y + halfH;
}

/**
 * Check if a point collides with any building
 * @param {number} worldX - World X coordinate
 * @param {number} worldY - World Y coordinate
 * @returns {Object|null} Building if collision, null otherwise
 */
function checkBuildingCollision(worldX, worldY) {
  for (const building of worldObjects.buildings) {
    if (isPointInBuilding(worldX, worldY, building)) {
      return building;
    }
  }
  return null;
}

/**
 * Check if a point is on a path
 * @param {number} worldX - World X coordinate
 * @param {number} worldY - World Y coordinate
 * @returns {boolean} True if point is on a path
 */
function isPointOnPath(worldX, worldY) {
  for (const path of worldObjects.paths) {
    const distToPath = pointToLineDistance(worldX, worldY, path.x1, path.y1, path.x2, path.y2);
    if (distToPath < path.width / 2) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate distance from point to line segment
 */
function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? dot / lenSq : 0;
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Initialize the 2D top-down world
 * @param {HTMLElement} container - DOM element to render into
 */
export function init3DWorld(container) {
  // Create canvas
  canvas = document.createElement('canvas');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  canvas.style.display = 'block';
  canvas.style.cursor = 'crosshair';
  container.appendChild(canvas);
  
  ctx = canvas.getContext('2d');
  
  // Initialize unified world objects
  initWorldObjects();
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize);
  
  // Set up click/tap to move and building interactions
  canvas.addEventListener('click', handleMapClick);
  canvas.addEventListener('touchend', handleMapTouch);
  
  // Set up camera panning (drag with mouse or two fingers)
  canvas.addEventListener('mousedown', handlePanStart);
  canvas.addEventListener('mousemove', handlePanMove);
  canvas.addEventListener('mouseup', handlePanEnd);
  canvas.addEventListener('mouseleave', handlePanEnd);
  
  // Touch events for panning and pinch-to-zoom
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', handleTouchEnd);
  
  // Mouse wheel for zoom
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  
  // Start render loop
  animate();
  console.log('2D Top-Down Unified World initialized (120x120 units)');
}

/**
 * Initialize unified world objects - ONE seamless world
 */
function initWorldObjects() {
  // Clear all arrays
  worldObjects.trees = [];
  worldObjects.buildings = [];
  worldObjects.rocks = [];
  worldObjects.paths = [];
  worldObjects.rivers = [];
  worldObjects.npcs = [];
  worldObjects.enemies = [];
  
  console.log('Generating unified world...');
  
  // ============================================
  // RIVERS - Two major rivers crossing the map
  // ============================================
  
  // Vertical river (from north to south, slightly curved)
  worldObjects.rivers.push({
    x1: 15, y1: -WORLD_HALF,
    x2: 18, y2: -20,
    x3: 15, y3: 0,
    x4: 12, y4: 20,
    x5: 15, y5: WORLD_HALF,
    width: 4,
    type: 'curved'
  });
  
  // Horizontal river (from west to east, slightly curved)
  worldObjects.rivers.push({
    x1: -WORLD_HALF, y1: -10,
    x2: -20, y2: -12,
    x3: 0, y3: -10,
    x4: 20, y4: -8,
    x5: WORLD_HALF, y5: -10,
    width: 4,
    type: 'curved'
  });
  
  // ============================================
  // PATHS - Extensive network connecting regions
  // ============================================
  
  // Main crossroads in town center
  worldObjects.paths.push({ x1: -25, y1: 0, x2: 25, y2: 0, width: 2.5 });
  worldObjects.paths.push({ x1: 0, y1: -25, x2: 0, y2: 25, width: 2.5 });
  
  // Diagonal paths in town
  worldObjects.paths.push({ x1: -15, y1: -15, x2: 15, y2: 15, width: 2 });
  worldObjects.paths.push({ x1: -15, y1: 15, x2: 15, y2: -15, width: 2 });
  
  // Path to forest region (northeast)
  worldObjects.paths.push({ x1: 20, y1: 10, x2: 35, y2: 25, width: 1.8 });
  worldObjects.paths.push({ x1: 35, y1: 25, x2: 42, y2: 38, width: 1.5 });
  
  // Winding forest paths
  worldObjects.paths.push({ x1: 30, y1: 30, x2: 50, y2: 40, width: 1.2 });
  worldObjects.paths.push({ x1: 40, y1: 30, x2: 45, y2: 50, width: 1.2 });
  worldObjects.paths.push({ x1: 35, y1: 45, x2: 50, y2: 45, width: 1 });
  
  // Path to mountain region (southwest)
  worldObjects.paths.push({ x1: -20, y1: -10, x2: -35, y2: -25, width: 1.8 });
  worldObjects.paths.push({ x1: -35, y1: -25, x2: -42, y2: -38, width: 1.5 });
  
  // Mountain trails
  worldObjects.paths.push({ x1: -30, y1: -30, x2: -50, y2: -40, width: 1 });
  worldObjects.paths.push({ x1: -40, y1: -35, x2: -45, y2: -50, width: 1 });
  
  // Bridge paths over rivers
  worldObjects.paths.push({ x1: 10, y1: -15, x2: 20, y2: -15, width: 2.5 }); // Bridge over horizontal river
  worldObjects.paths.push({ x1: 15, y1: 5, x2: 15, y2: 15, width: 2.5 }); // Bridge over vertical river
  
  // ============================================
  // BUILDINGS - Town center (0,0) with 8 buildings
  // ============================================
  
  worldObjects.buildings.push({ 
    x: 8, y: 6, width: 5, height: 4, 
    name: 'Tavern', color: '#a0826d', 
    clickable: true, type: 'tavern' 
  });
  
  worldObjects.buildings.push({ 
    x: -8, y: 6, width: 5, height: 5, 
    name: 'Bank', color: '#8b7355', 
    clickable: true, type: 'bank' 
  });
  
  worldObjects.buildings.push({ 
    x: 0, y: -12, width: 6, height: 6, 
    name: 'Town Hall', color: '#9a8a7a', 
    clickable: true, type: 'hall' 
  });
  
  worldObjects.buildings.push({ 
    x: 18, y: -8, width: 5, height: 4, 
    name: 'Merchant', color: '#c4a57b', 
    clickable: true, type: 'shop' 
  });
  
  worldObjects.buildings.push({ 
    x: -18, y: -8, width: 4, height: 4, 
    name: 'House', color: '#b89968', 
    clickable: true, type: 'house' 
  });
  
  worldObjects.buildings.push({ 
    x: 8, y: 18, width: 4, height: 3.5, 
    name: 'Cottage', color: '#a58965', 
    clickable: true, type: 'house' 
  });
  
  worldObjects.buildings.push({ 
    x: -8, y: 18, width: 4.5, height: 4, 
    name: 'Smithy', color: '#706050', 
    clickable: true, type: 'smithy' 
  });
  
  worldObjects.buildings.push({ 
    x: 18, y: 18, width: 5, height: 4, 
    name: 'Inn', color: '#9a7d5d', 
    clickable: true, type: 'inn' 
  });
  
  // Forest region building
  worldObjects.buildings.push({ 
    x: 42, y: 42, width: 3.5, height: 3, 
    name: 'Cabin', color: '#6b5d50', 
    clickable: true, type: 'cabin' 
  });
  
  // Mountain region building
  worldObjects.buildings.push({ 
    x: -42, y: -42, width: 5, height: 4, 
    name: 'Mine Entrance', color: '#505050', 
    clickable: true, type: 'mine' 
  });
  
  // ============================================
  // TOWN NPCS - Wandering peaceful characters
  // ============================================
  
  const npcNames = ['Rowan', 'Elara', 'Finn', 'Sage', 'Quinn'];
  const npcColors = ['#4a9d5f', '#6a5acd', '#cd853f', '#20b2aa', '#9370db'];
  
  for (let i = 0; i < 5; i++) {
    worldObjects.npcs.push({
      name: npcNames[i],
      x: (Math.random() - 0.5) * 30,
      y: (Math.random() - 0.5) * 30,
      angle: Math.random() * Math.PI * 2,
      targetX: 0,
      targetY: 0,
      speed: 0.02 + Math.random() * 0.01,
      pauseTime: 0,
      color: npcColors[i],
      radius: 0.4,
      bounds: { minX: -30, maxX: 30, minY: -30, maxY: 30 }
    });
  }
  
  // Set initial targets
  worldObjects.npcs.forEach(npc => {
    npc.targetX = npc.x + (Math.random() - 0.5) * 20;
    npc.targetY = npc.y + (Math.random() - 0.5) * 20;
  });
  
  // ============================================
  // ENEMIES - Forest region creatures
  // ============================================
  
  const enemyTypes = [
    { name: 'Goblin', color: '#8b4513', speed: 0.025 },
    { name: 'Wolf', color: '#696969', speed: 0.03 },
    { name: 'Bandit', color: '#8b0000', speed: 0.02 },
    { name: 'Spider', color: '#4a4a4a', speed: 0.015 }
  ];
  
  // Spawn enemies in forest region (around 40, 40)
  for (let i = 0; i < 8; i++) {
    const type = enemyTypes[i % enemyTypes.length];
    const angle = (i / 8) * Math.PI * 2;
    const radius = 8 + Math.random() * 12;
    
    worldObjects.enemies.push({
      name: `${type.name} ${Math.floor(i / enemyTypes.length) + 1}`,
      x: 40 + Math.cos(angle) * radius,
      y: 40 + Math.sin(angle) * radius,
      angle: Math.random() * Math.PI * 2,
      targetX: 40,
      targetY: 40,
      speed: type.speed,
      pauseTime: 0,
      color: type.color,
      radius: 0.45,
      bounds: { minX: 25, maxX: 55, minY: 25, maxY: 55 },
      hostile: true
    });
  }
  
  // Set initial enemy targets
  worldObjects.enemies.forEach(enemy => {
    enemy.targetX = enemy.x + (Math.random() - 0.5) * 15;
    enemy.targetY = enemy.y + (Math.random() - 0.5) * 15;
  });
  
  // ============================================
  // TREES - Dense in forest, sparse in town/mountains
  // ============================================
  
  // Town trees (sparse, decorative)
  for (let i = 0; i < 25; i++) {
    const x = (Math.random() - 0.5) * 50;
    const y = (Math.random() - 0.5) * 50;
    
    // Don't spawn on paths
    if (!isPointOnPath(x, y)) {
      // Keep away from buildings
      let tooClose = false;
      for (const building of worldObjects.buildings) {
        const dx = x - building.x;
        const dy = y - building.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        worldObjects.trees.push({
          x, y,
          radius: 0.4 + Math.random() * 0.3,
          type: 'oak'
        });
      }
    }
  }
  
  // Forest trees (DENSE - 40, 40 region)
  for (let i = 0; i < 120; i++) {
    const x = 25 + (Math.random() * 35);
    const y = 25 + (Math.random() * 35);
    
    if (!isPointOnPath(x, y)) {
      worldObjects.trees.push({
        x, y,
        radius: 0.5 + Math.random() * 0.5,
        type: Math.random() > 0.3 ? 'pine' : 'oak'
      });
    }
  }
  
  // Mountain trees (sparse, hardy)
  for (let i = 0; i < 30; i++) {
    const x = -50 + (Math.random() * 30);
    const y = -50 + (Math.random() * 30);
    
    if (!isPointOnPath(x, y)) {
      worldObjects.trees.push({
        x, y,
        radius: 0.3 + Math.random() * 0.3,
        type: 'pine'
      });
    }
  }
  
  // ============================================
  // ROCKS - Scattered decorations and boulders
  // ============================================
  
  // Town rocks (small decorative stones)
  for (let i = 0; i < 20; i++) {
    const x = (Math.random() - 0.5) * 50;
    const y = (Math.random() - 0.5) * 50;
    
    if (!isPointOnPath(x, y)) {
      worldObjects.rocks.push({
        x, y,
        radius: 0.15 + Math.random() * 0.2,
        type: 'stone'
      });
    }
  }
  
  // Forest rocks and logs
  for (let i = 0; i < 40; i++) {
    const x = 25 + (Math.random() * 35);
    const y = 25 + (Math.random() * 35);
    
    if (!isPointOnPath(x, y)) {
      worldObjects.rocks.push({
        x, y,
        radius: 0.2 + Math.random() * 0.4,
        type: Math.random() > 0.5 ? 'stone' : 'log'
      });
    }
  }
  
  // Mountain boulders (LARGE)
  for (let i = 0; i < 60; i++) {
    const x = -50 + (Math.random() * 30);
    const y = -50 + (Math.random() * 30);
    
    if (!isPointOnPath(x, y)) {
      worldObjects.rocks.push({
        x, y,
        radius: 0.4 + Math.random() * 1.0,
        type: 'boulder'
      });
    }
  }
  
  console.log(`World generated: ${worldObjects.buildings.length} buildings, ${worldObjects.trees.length} trees, ${worldObjects.rocks.length} rocks, ${worldObjects.paths.length} paths, ${worldObjects.rivers.length} rivers, ${worldObjects.npcs.length} NPCs, ${worldObjects.enemies.length} enemies`);
}

/**
 * Handle window resize
 */
function onWindowResize() {
  const container = canvas.parentElement;
  if (!container) return;
  
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  // Update zoom for mobile/desktop
  ZOOM = getZoom();
}

/**
 * Handle map click - tap to move or interact with building
 */
function handleMapClick(event) {
  // Don't trigger click if we were dragging
  if (isDragging) {
    isDragging = false;
    return;
  }
  
  const rect = canvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;
  
  // Convert screen coordinates to world coordinates (with camera offset)
  const worldX = (clickX - canvas.width / 2) / ZOOM - cameraOffset.x;
  const worldY = -(clickY - canvas.height / 2) / ZOOM - cameraOffset.y;
  
  // Check if clicking on a clickable building
  const building = checkBuildingCollision(worldX, worldY);
  if (building && building.clickable) {
    onBuildingClick(building.name);
    return;
  }
  
  if (!building) {
    // Set target
    player.targetX = worldX;
    player.targetY = worldY;
    player.isMoving = true;
    
    console.log(`Moving to (${worldX.toFixed(2)}, ${worldY.toFixed(2)})`);
  } else {
    console.log(`Cannot move into ${building.name}`);
  }
}

/**
 * Handle touch tap - same as click but handle multi-touch
 */
function handleMapTouch(event) {
  // For single touch, treat as click
  if (event.changedTouches.length === 1 && !isDragging) {
    const touch = event.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const clickX = touch.clientX - rect.left;
    const clickY = touch.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates (with camera offset)
    const worldX = (clickX - canvas.width / 2) / ZOOM - cameraOffset.x;
    const worldY = -(clickY - canvas.height / 2) / ZOOM - cameraOffset.y;
    
    // Check if clicking on a clickable building
    const building = checkBuildingCollision(worldX, worldY);
    if (building && building.clickable) {
      onBuildingClick(building.name);
      return;
    }
    
    if (!building) {
      // Set target
      player.targetX = worldX;
      player.targetY = worldY;
      player.isMoving = true;
    }
  }
  
  isDragging = false;
  lastTouchDistance = null;
}

/**
 * Handle camera panning - mouse down
 */
function handlePanStart(event) {
  isDragging = true;
  dragStart.x = event.clientX;
  dragStart.y = event.clientY;
}

/**
 * Handle camera panning - mouse move
 */
function handlePanMove(event) {
  if (!isDragging) return;
  
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  
  // Update camera offset
  cameraOffset.x += dx / ZOOM;
  cameraOffset.y -= dy / ZOOM; // Invert Y
  
  dragStart.x = event.clientX;
  dragStart.y = event.clientY;
}

/**
 * Handle camera panning - mouse up
 */
function handlePanEnd(event) {
  isDragging = false;
}

/**
 * Handle touch start for panning and pinch-to-zoom
 */
function handleTouchStart(event) {
  if (event.touches.length === 2) {
    // Two fingers - pinch to zoom
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    lastTouchDistance = distance;
    isDragging = true;
  } else if (event.touches.length === 1) {
    // One finger - pan
    isDragging = true;
    dragStart.x = event.touches[0].clientX;
    dragStart.y = event.touches[0].clientY;
  }
}

/**
 * Handle touch move for panning and pinch-to-zoom
 */
function handleTouchMove(event) {
  event.preventDefault();
  
  if (event.touches.length === 2 && lastTouchDistance) {
    // Pinch to zoom
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
    
    const zoomFactor = distance / lastTouchDistance;
    ZOOM = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ZOOM * zoomFactor));
    
    lastTouchDistance = distance;
  } else if (event.touches.length === 1 && isDragging) {
    // Pan
    const dx = event.touches[0].clientX - dragStart.x;
    const dy = event.touches[0].clientY - dragStart.y;
    
    cameraOffset.x += dx / ZOOM;
    cameraOffset.y -= dy / ZOOM;
    
    dragStart.x = event.touches[0].clientX;
    dragStart.y = event.touches[0].clientY;
  }
}

/**
 * Handle touch end
 */
function handleTouchEnd(event) {
  if (event.touches.length < 2) {
    lastTouchDistance = null;
  }
  if (event.touches.length === 0) {
    isDragging = false;
  }
}

/**
 * Handle mouse wheel for zoom
 */
function handleWheel(event) {
  event.preventDefault();
  
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  ZOOM = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ZOOM * zoomFactor));
}

/**
 * Handle building click - walk to building then open modal
 */
let pendingBuildingModal = null;

function onBuildingClick(buildingName) {
  console.log(`Clicked on ${buildingName}`);
  
  // Find the building
  const building = worldObjects.buildings.find(b => b.name === buildingName);
  if (!building) return;
  
  // Calculate entrance position (front of building, bottom center)
  const entranceX = building.x;
  const entranceY = building.y + building.height / 2 + 1.5; // Just outside front door
  
  // Set target to walk to building
  player.targetX = entranceX;
  player.targetY = entranceY;
  player.isMoving = true;
  pendingBuildingModal = buildingName;
  
  console.log(`Walking to ${buildingName}...`);
}

/**
 * Check if player has reached building and open modal - FIX: Properly call window.openGameModal
 */
function checkBuildingArrival() {
  if (pendingBuildingModal && !player.isMoving) {
    const buildingName = pendingBuildingModal;
    pendingBuildingModal = null;
    
    console.log(`Arrived at ${buildingName}, opening modal...`);
    
    // Open the appropriate game modal - THIS IS THE FIX
    if (typeof window.openGameModal === 'function') {
      window.openGameModal(buildingName);
      console.log(`Modal opened for ${buildingName}`);
    } else {
      console.warn(`window.openGameModal not available for ${buildingName}`);
      // Fallback alert
      alert(`Entered ${buildingName}\n\nNote: Modal system not yet connected.`);
    }
  }
}

/**
 * Update player movement - now moves toward target with collision detection
 */
function updateMovement() {
  if (player.isMoving) {
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.1) {
      // Arrived at target
      player.isMoving = false;
      player.x = player.targetX;
      player.y = player.targetY;
      
      // Check if we reached a building
      checkBuildingArrival();
    } else {
      // Move toward target
      const angle = Math.atan2(dx, dy);
      player.angle = angle; // Face movement direction
      
      const newX = player.x + Math.sin(angle) * MOVE_SPEED;
      const newY = player.y + Math.cos(angle) * MOVE_SPEED;
      
      // Check collision with buildings
      const building = checkBuildingCollision(newX, newY);
      if (!building) {
        player.x = newX;
        player.y = newY;
      } else {
        // Stop if we hit a building
        player.isMoving = false;
        checkBuildingArrival();
      }
    }
  }
}

/**
 * Update NPCs and Enemies - wandering behavior with improved AI
 */
let lastFrameTime = performance.now();

function updateNPCs() {
  // Calculate delta time for frame-independent animation
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
  lastFrameTime = currentTime;
  
  // Update friendly NPCs
  for (const npc of worldObjects.npcs) {
    updateCharacter(npc, deltaTime, false);
  }
  
  // Update enemies
  for (const enemy of worldObjects.enemies) {
    updateCharacter(enemy, deltaTime, true);
  }
}

/**
 * Update a character (NPC or enemy)
 */
function updateCharacter(char, deltaTime, isEnemy) {
  // Check if paused
  if (char.pauseTime > 0) {
    char.pauseTime -= deltaTime;
    return;
  }
  
  const dx = char.targetX - char.x;
  const dy = char.targetY - char.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 0.3) {
    // Reached target - pause and pick new target
    char.pauseTime = isEnemy ? (1 + Math.random() * 2) : (2 + Math.random() * 3);
    
    // Pick a new random target within bounds
    if (char.bounds) {
      char.targetX = char.bounds.minX + Math.random() * (char.bounds.maxX - char.bounds.minX);
      char.targetY = char.bounds.minY + Math.random() * (char.bounds.maxY - char.bounds.minY);
    } else {
      char.targetX = char.x + (Math.random() - 0.5) * 15;
      char.targetY = char.y + (Math.random() - 0.5) * 15;
    }
  } else {
    // Move toward target
    const angle = Math.atan2(dx, dy);
    char.angle = angle;
    
    const newX = char.x + Math.sin(angle) * char.speed;
    const newY = char.y + Math.cos(angle) * char.speed;
    
    // Check collision with buildings
    const building = checkBuildingCollision(newX, newY);
    if (!building) {
      char.x = newX;
      char.y = newY;
    } else {
      // Hit a building - pick new target immediately
      char.pauseTime = 0.5;
      if (char.bounds) {
        char.targetX = char.bounds.minX + Math.random() * (char.bounds.maxX - char.bounds.minX);
        char.targetY = char.bounds.minY + Math.random() * (char.bounds.maxY - char.bounds.minY);
      } else {
        char.targetX = char.x + (Math.random() - 0.5) * 10;
        char.targetY = char.y + (Math.random() - 0.5) * 10;
      }
    }
  }
}

/**
 * Convert world coordinates to screen coordinates (with camera offset)
 */
function worldToScreen(wx, wy) {
  // Apply camera offset
  const sx = canvas.width / 2 + (wx + cameraOffset.x) * ZOOM;
  const sy = canvas.height / 2 - (wy + cameraOffset.y) * ZOOM; // Invert Y for screen coordinates
  
  return { x: sx, y: sy };
}

/**
 * Render the world - Unified seamless world with rivers, paths, buildings, NPCs, enemies
 */
function render() {
  // Clear with grass background
  ctx.fillStyle = '#2a5a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add grass texture pattern
  ctx.fillStyle = 'rgba(34, 139, 34, 0.1)';
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
  
  // ============================================
  // RIVERS - Draw flowing blue water
  // ============================================
  worldObjects.rivers.forEach(river => {
    if (river.type === 'curved') {
      // Draw curved river using bezier curves
      const p1 = worldToScreen(river.x1, river.y1);
      const p2 = worldToScreen(river.x2, river.y2);
      const p3 = worldToScreen(river.x3, river.y3);
      const p4 = worldToScreen(river.x4, river.y4);
      const p5 = worldToScreen(river.x5, river.y5);
      
      ctx.strokeStyle = '#4a90d4';
      ctx.lineWidth = river.width * ZOOM;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y);
      ctx.quadraticCurveTo(p4.x, p4.y, p5.x, p5.y);
      ctx.stroke();
      
      // Add lighter water highlights
      ctx.strokeStyle = '#6ab0e8';
      ctx.lineWidth = river.width * ZOOM * 0.6;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y);
      ctx.quadraticCurveTo(p4.x, p4.y, p5.x, p5.y);
      ctx.stroke();
      
      // Add sparkle effect
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = river.width * ZOOM * 0.3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y);
      ctx.quadraticCurveTo(p4.x, p4.y, p5.x, p5.y);
      ctx.stroke();
    }
  });
  
  // ============================================
  // PATHS - Draw dirt/stone paths
  // ============================================
  ctx.strokeStyle = '#c4a57b';
  ctx.lineCap = 'round';
  worldObjects.paths.forEach(path => {
    const p1 = worldToScreen(path.x1, path.y1);
    const p2 = worldToScreen(path.x2, path.y2);
    ctx.lineWidth = path.width * ZOOM;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    
    // Add path edge detail
    ctx.strokeStyle = 'rgba(139, 90, 43, 0.3)';
    ctx.lineWidth = path.width * ZOOM * 0.3;
    ctx.stroke();
    ctx.strokeStyle = '#c4a57b';
  });
  
  // ============================================
  // ROCKS - Various types
  // ============================================
  worldObjects.rocks.forEach(rock => {
    const pos = worldToScreen(rock.x, rock.y);
    
    if (rock.type === 'boulder') {
      ctx.fillStyle = '#5a5a5a';
    } else if (rock.type === 'log') {
      ctx.fillStyle = '#6b4423';
    } else {
      ctx.fillStyle = '#696969';
    }
    
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rock.radius * ZOOM, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Add texture highlight
    if (rock.type !== 'log') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(pos.x - rock.radius * ZOOM * 0.3, pos.y - rock.radius * ZOOM * 0.3, rock.radius * ZOOM * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // ============================================
  // TREES
  // ============================================
  worldObjects.trees.forEach(tree => {
    const pos = worldToScreen(tree.x, tree.y);
    
    if (tree.type === 'pine') {
      // Pine tree (triangle)
      ctx.fillStyle = '#1a4d1a';
      const size = tree.radius * ZOOM;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - size);
      ctx.lineTo(pos.x - size * 0.8, pos.y + size * 0.5);
      ctx.lineTo(pos.x + size * 0.8, pos.y + size * 0.5);
      ctx.closePath();
      ctx.fill();
      
      // Add detail layer
      ctx.fillStyle = '#228b22';
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - size * 0.5);
      ctx.lineTo(pos.x - size * 0.5, pos.y + size * 0.3);
      ctx.lineTo(pos.x + size * 0.5, pos.y + size * 0.3);
      ctx.closePath();
      ctx.fill();
    } else {
      // Oak tree (circle with detail)
      ctx.fillStyle = '#1a7a1a';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, tree.radius * ZOOM, 0, Math.PI * 2);
      ctx.fill();
      
      // Add lighter foliage highlights
      ctx.fillStyle = '#228b22';
      ctx.beginPath();
      ctx.arc(pos.x - tree.radius * ZOOM * 0.3, pos.y - tree.radius * ZOOM * 0.3, tree.radius * ZOOM * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Trunk
    ctx.fillStyle = '#8b4513';
    ctx.strokeStyle = '#6b3713';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, tree.radius * ZOOM * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  
  // ============================================
  // BUILDINGS - Enhanced textures that fit perfectly
  // ============================================
  worldObjects.buildings.forEach(building => {
    const pos = worldToScreen(building.x, building.y);
    const w = building.width * ZOOM;
    const h = building.height * ZOOM;
    
    // Building base
    ctx.fillStyle = building.color;
    ctx.fillRect(pos.x - w/2, pos.y - h/2, w, h);
    
    // IMPROVED: Brick texture that fits building dimensions
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    const brickH = Math.max(h / 10, 3); // Scale bricks to building height
    const brickW = Math.max(w / 8, 4); // Scale bricks to building width
    
    for (let by = 0; by < h; by += brickH) {
      const offset = (Math.floor(by / brickH) % 2) * (brickW / 2);
      for (let bx = 0; bx < w; bx += brickW) {
        ctx.strokeRect(pos.x - w/2 + bx + offset, pos.y - h/2 + by, brickW, brickH);
      }
    }
    
    // Building outline
    ctx.strokeStyle = '#6b5d50';
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x - w/2, pos.y - h/2, w, h);
    
    // Windows - scaled to building size
    ctx.fillStyle = '#8ab4f8';
    const winW = w * 0.15;
    const winH = h * 0.2;
    const win1X = pos.x - w * 0.25;
    const win2X = pos.x + w * 0.1;
    const winY = pos.y - h * 0.25;
    
    // Window 1
    ctx.fillRect(win1X, winY, winW, winH);
    ctx.strokeStyle = '#3a2510';
    ctx.lineWidth = 2;
    ctx.strokeRect(win1X, winY, winW, winH);
    // Cross pattern
    ctx.beginPath();
    ctx.moveTo(win1X + winW/2, winY);
    ctx.lineTo(win1X + winW/2, winY + winH);
    ctx.moveTo(win1X, winY + winH/2);
    ctx.lineTo(win1X + winW, winY + winH/2);
    ctx.stroke();
    
    // Window 2
    ctx.fillStyle = '#8ab4f8';
    ctx.fillRect(win2X, winY, winW, winH);
    ctx.strokeStyle = '#3a2510';
    ctx.strokeRect(win2X, winY, winW, winH);
    // Cross pattern
    ctx.beginPath();
    ctx.moveTo(win2X + winW/2, winY);
    ctx.lineTo(win2X + winW/2, winY + winH);
    ctx.moveTo(win2X, winY + winH/2);
    ctx.lineTo(win2X + winW, winY + winH/2);
    ctx.stroke();
    
    // Roof with tile texture - IMPROVED to fit building
    ctx.fillStyle = '#8b0000';
    const roofHeight = w * 0.25;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - h/2 - roofHeight);
    ctx.lineTo(pos.x - w/2 - w * 0.1, pos.y - h/2);
    ctx.lineTo(pos.x + w/2 + w * 0.1, pos.y - h/2);
    ctx.closePath();
    ctx.fill();
    
    // Roof tiles - scaled to roof size
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    const numTiles = Math.max(Math.floor(roofHeight / (ZOOM * 0.2)), 3);
    for (let i = 0; i < numTiles; i++) {
      const ty = pos.y - h/2 - roofHeight + (i * roofHeight / numTiles);
      const progress = i / numTiles;
      const roofW = (w + w * 0.2) * (1 - progress);
      ctx.beginPath();
      ctx.moveTo(pos.x - roofW/2, ty);
      ctx.lineTo(pos.x + roofW/2, ty);
      ctx.stroke();
    }
    
    // Roof outline
    ctx.strokeStyle = '#6b0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - h/2 - roofHeight);
    ctx.lineTo(pos.x - w/2 - w * 0.1, pos.y - h/2);
    ctx.lineTo(pos.x + w/2 + w * 0.1, pos.y - h/2);
    ctx.closePath();
    ctx.stroke();
    
    // Door - scaled to building
    ctx.fillStyle = '#654321';
    const doorW = w * 0.25;
    const doorH = h * 0.35;
    const doorX = pos.x - doorW/2;
    const doorY = pos.y + h/2 - doorH;
    ctx.fillRect(doorX, doorY, doorW, doorH);
    
    // Wood grain (vertical lines)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    const numPlanks = Math.max(Math.floor(doorW / (ZOOM * 0.15)), 3);
    for (let i = 0; i <= numPlanks; i++) {
      const gx = doorX + (doorW / numPlanks) * i;
      ctx.beginPath();
      ctx.moveTo(gx, doorY);
      ctx.lineTo(gx, doorY + doorH);
      ctx.stroke();
    }
    
    // Door outline
    ctx.strokeStyle = '#3a2510';
    ctx.lineWidth = 2;
    ctx.strokeRect(doorX, doorY, doorW, doorH);
    
    // Door handle
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.arc(doorX + doorW * 0.8, doorY + doorH * 0.5, Math.max(ZOOM * 0.08, 2), 0, Math.PI * 2);
    ctx.fill();
    
    // Building name
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText(building.name, pos.x, pos.y + h/2 + 18);
    ctx.fillText(building.name, pos.x, pos.y + h/2 + 18);
  });
  
  // ============================================
  // PLAYER
  // ============================================
  const playerScreen = worldToScreen(player.x, player.y);
  
  // Player body (circle)
  ctx.fillStyle = '#4a90e2';
  ctx.strokeStyle = '#2a5a8a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(playerScreen.x, playerScreen.y, 0.5 * ZOOM, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Direction indicator
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(playerScreen.x, playerScreen.y);
  ctx.lineTo(
    playerScreen.x + Math.sin(player.angle) * ZOOM * 0.7,
    playerScreen.y - Math.cos(player.angle) * ZOOM * 0.7
  );
  ctx.stroke();
  
  // Movement target indicator (if moving)
  if (player.isMoving) {
    const targetScreen = worldToScreen(player.targetX, player.targetY);
    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetScreen.x, targetScreen.y, 0.3 * ZOOM, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  
  // ============================================
  // NPCS - Friendly wandering characters
  // ============================================
  worldObjects.npcs.forEach(npc => {
    const npcScreen = worldToScreen(npc.x, npc.y);
    
    // NPC body (circle)
    ctx.fillStyle = npc.color;
    ctx.strokeStyle = '#2a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(npcScreen.x, npcScreen.y, npc.radius * ZOOM, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Direction indicator
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(npcScreen.x, npcScreen.y);
    ctx.lineTo(
      npcScreen.x + Math.sin(npc.angle) * ZOOM * 0.5,
      npcScreen.y - Math.cos(npc.angle) * ZOOM * 0.5
    );
    ctx.stroke();
    
    // NPC name
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText(npc.name, npcScreen.x, npcScreen.y - npc.radius * ZOOM - 5);
    ctx.fillText(npc.name, npcScreen.x, npcScreen.y - npc.radius * ZOOM - 5);
  });
  
  // ============================================
  // ENEMIES - Hostile creatures in forest
  // ============================================
  worldObjects.enemies.forEach(enemy => {
    const enemyScreen = worldToScreen(enemy.x, enemy.y);
    
    // Enemy body (circle with red tint)
    ctx.fillStyle = enemy.color;
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(enemyScreen.x, enemyScreen.y, enemy.radius * ZOOM, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Hostile indicator (red eyes)
    ctx.fillStyle = '#ff0000';
    const eyeSize = enemy.radius * ZOOM * 0.2;
    ctx.beginPath();
    ctx.arc(enemyScreen.x - eyeSize * 1.5, enemyScreen.y - eyeSize, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(enemyScreen.x + eyeSize * 1.5, enemyScreen.y - eyeSize, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Direction indicator
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(enemyScreen.x, enemyScreen.y);
    ctx.lineTo(
      enemyScreen.x + Math.sin(enemy.angle) * ZOOM * 0.5,
      enemyScreen.y - Math.cos(enemy.angle) * ZOOM * 0.5
    );
    ctx.stroke();
    
    // Enemy name
    ctx.fillStyle = '#ffcccc';
    ctx.strokeStyle = '#8b0000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText(enemy.name, enemyScreen.x, enemyScreen.y - enemy.radius * ZOOM - 5);
    ctx.fillText(enemy.name, enemyScreen.x, enemyScreen.y - enemy.radius * ZOOM - 5);
  });
  
  // ============================================
  // UI OVERLAY
  // ============================================
  
  // World coordinates display
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, 220, 50);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Unified World (120x120)`, 20, 30);
  ctx.font = '12px Arial';
  ctx.fillText(`Position: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`, 20, 48);
  
  // Instructions
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, canvas.height - 70, 220, 60);
  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.fillText('Click/Tap: Move', 20, canvas.height - 48);
  ctx.fillText('Drag: Pan camera', 20, canvas.height - 32);
  ctx.fillText('Pinch/Wheel: Zoom', 20, canvas.height - 16);
}

/**
 * Animation loop
 */
function animate() {
  updateMovement();
  updateNPCs();
  render();
  requestAnimationFrame(animate);
}

/**
 * Clean up resources
 */
export function dispose3DWorld() {
  if (canvas && canvas.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }
  
  window.removeEventListener('resize', onWindowResize);
  
  moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
  
  console.log('2D Top-Down Unified World disposed');
}

/**
 * Get current player position
 */
export function getPlayerPosition() {
  return {
    x: player.x,
    y: player.y,
    angle: player.angle
  };
}

/**
 * Set player position
 */
export function setPlayerPosition(x, y, angle) {
  player.x = x;
  player.y = y;
  if (angle !== undefined) {
    player.angle = angle;
  }
}

/**
 * Get world bounds
 */
export function getWorldBounds() {
  return {
    minX: -WORLD_HALF,
    maxX: WORLD_HALF,
    minY: -WORLD_HALF,
    maxY: WORLD_HALF,
    size: WORLD_SIZE
  };
}

/**
 * Get all world objects (for debugging or external use)
 */
export function getWorldObjects() {
  return worldObjects;
}
