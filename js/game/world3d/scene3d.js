// js/game/world3d/scene2d-topdown.js
// 2D Top-Down World View
//
// This module creates a 2D top-down view of the world that players can explore.

let canvas, ctx;
let player = { x: 0, y: 0, angle: 0, targetX: 0, targetY: 0, isMoving: false };
let moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
const MOVE_SPEED = 0.1;

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

// Current area/map
let currentArea = 'town';
const areas = {
  town: { offsetX: 0, offsetY: 0, trees: [], buildings: [], rocks: [], paths: [], npcs: [] },
  forest: { offsetX: 100, offsetY: 0, trees: [], buildings: [], rocks: [], paths: [], npcs: [] },
  mountains: { offsetX: 0, offsetY: 100, trees: [], buildings: [], rocks: [], paths: [], npcs: [] }
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
 * Check if a point collides with any building in current area
 * @param {number} worldX - World X coordinate
 * @param {number} worldY - World Y coordinate
 * @returns {Object|null} Building if collision, null otherwise
 */
function checkBuildingCollision(worldX, worldY) {
  const area = areas[currentArea];
  for (const building of area.buildings) {
    if (isPointInBuilding(worldX, worldY, building)) {
      return building;
    }
  }
  return null;
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
  
  // Initialize world objects for all areas
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
  console.log('2D Top-Down World initialized');
}

/**
 * Initialize world objects for all areas
 */
function initWorldObjects() {
  // Town area - buildings per user spec (Tavern, Bank, Town Hall, Merchant)
  const town = areas.town;
  town.buildings.push({ x: 10, y: 5, width: 4, height: 3, name: 'Tavern', color: '#a0826d', clickable: true });
  town.buildings.push({ x: -10, y: 5, width: 4, height: 4, name: 'Bank', color: '#8b7355', clickable: true });
  town.buildings.push({ x: 0, y: -15, width: 5, height: 5, name: 'Town Hall', color: '#9a8a7a', clickable: true });
  town.buildings.push({ x: 15, y: -10, width: 4, height: 3, name: 'Merchant', color: '#c4a57b', clickable: true });
  
  // Town trees (sparse)
  for (let i = 0; i < 15; i++) {
    town.trees.push({
      x: (Math.random() - 0.5) * 50,
      y: (Math.random() - 0.5) * 50,
      radius: 0.4 + Math.random() * 0.2,
      type: 'oak'
    });
  }
  
  // Town paths
  town.paths.push({ x1: -25, y1: 0, x2: 25, y2: 0, width: 2 });
  town.paths.push({ x1: 0, y1: -25, x2: 0, y2: 25, width: 2 });
  town.paths.push({ x1: -15, y1: -15, x2: 15, y2: 15, width: 1.5 });
  
  // Town rocks/decorations
  for (let i = 0; i < 10; i++) {
    town.rocks.push({
      x: (Math.random() - 0.5) * 50,
      y: (Math.random() - 0.5) * 50,
      radius: 0.15 + Math.random() * 0.2,
      type: 'stone'
    });
  }
  
  // Town NPCs - wandering characters
  town.npcs.push({
    name: 'Rowan',
    x: 5,
    y: 10,
    angle: 0,
    targetX: 5,
    targetY: 10,
    speed: 0.02,
    pauseTime: 0,
    color: '#4a9d5f',
    radius: 0.4
  });
  
  // Forest area - dense trees
  const forest = areas.forest;
  for (let i = 0; i < 80; i++) {
    forest.trees.push({
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 60,
      radius: 0.5 + Math.random() * 0.4,
      type: Math.random() > 0.3 ? 'pine' : 'oak'
    });
  }
  
  // Forest paths (narrow trails)
  forest.paths.push({ x1: -20, y1: -10, x2: 20, y2: 10, width: 1 });
  forest.paths.push({ x1: -15, y1: 15, x2: 15, y2: -15, width: 1 });
  
  // Forest rocks and logs
  for (let i = 0; i < 30; i++) {
    forest.rocks.push({
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 60,
      radius: 0.2 + Math.random() * 0.4,
      type: Math.random() > 0.5 ? 'stone' : 'log'
    });
  }
  
  // Forest buildings (minimal - maybe a cabin)
  forest.buildings.push({ x: -15, y: -15, width: 3, height: 3, name: 'Cabin', color: '#6b5d50' });
  
  // Mountains area - rocky terrain
  const mountains = areas.mountains;
  for (let i = 0; i < 50; i++) {
    mountains.rocks.push({
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 60,
      radius: 0.3 + Math.random() * 0.8,
      type: 'boulder'
    });
  }
  
  // Mountain trees (sparse, hardy trees)
  for (let i = 0; i < 20; i++) {
    mountains.trees.push({
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 60,
      radius: 0.3 + Math.random() * 0.2,
      type: 'pine'
    });
  }
  
  // Mountain paths (steep trails)
  mountains.paths.push({ x1: -20, y1: 20, x2: 20, y2: -20, width: 1 });
  
  // Mountain buildings (cave entrance?)
  mountains.buildings.push({ x: 0, y: -15, width: 4, height: 3, name: 'Mine Entrance', color: '#505050' });
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
  const area = areas[currentArea];
  const building = area.buildings.find(b => b.name === buildingName);
  if (!building) return;
  
  // Calculate entrance position (front of building)
  const entranceX = building.x;
  const entranceY = building.y + building.height / 2 + 1; // Just outside front door
  
  // Set target to walk to building
  player.targetX = entranceX;
  player.targetY = entranceY;
  player.isMoving = true;
  pendingBuildingModal = buildingName;
  
  console.log(`Walking to ${buildingName}...`);
}

/**
 * Check if player has reached building and open modal
 */
function checkBuildingArrival() {
  if (pendingBuildingModal && !player.isMoving) {
    const buildingName = pendingBuildingModal;
    pendingBuildingModal = null;
    
    // Open the appropriate game modal
    if (window.openGameModal) {
      window.openGameModal(buildingName);
    } else {
      console.warn(`Modal system not available for ${buildingName}`);
      alert(`Entered ${buildingName}`);
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
 * Update NPCs - wandering behavior
 */
let lastFrameTime = performance.now();

function updateNPCs() {
  const area = areas[currentArea];
  if (!area.npcs) return;
  
  // Calculate delta time for frame-independent animation
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
  lastFrameTime = currentTime;
  
  for (const npc of area.npcs) {
    // Check if paused
    if (npc.pauseTime > 0) {
      npc.pauseTime -= deltaTime;
      continue;
    }
    
    const dx = npc.targetX - npc.x;
    const dy = npc.targetY - npc.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.2) {
      // Reached target - pause and pick new target
      npc.pauseTime = 2 + Math.random() * 3; // Pause 2-5 seconds
      
      // Pick a new random target within bounds
      npc.targetX = npc.x + (Math.random() - 0.5) * 15;
      npc.targetY = npc.y + (Math.random() - 0.5) * 15;
      
      // Keep within area bounds
      npc.targetX = Math.max(-20, Math.min(20, npc.targetX));
      npc.targetY = Math.max(-20, Math.min(20, npc.targetY));
    } else {
      // Move toward target
      const angle = Math.atan2(dx, dy);
      npc.angle = angle;
      
      const newX = npc.x + Math.sin(angle) * npc.speed;
      const newY = npc.y + Math.cos(angle) * npc.speed;
      
      // Check collision with buildings
      const building = checkBuildingCollision(newX, newY);
      if (!building) {
        npc.x = newX;
        npc.y = newY;
      } else {
        // Hit a building - pick new target
        npc.pauseTime = 0.5;
        npc.targetX = npc.x + (Math.random() - 0.5) * 10;
        npc.targetY = npc.y + (Math.random() - 0.5) * 10;
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
 * Render the world
 */
function render() {
  // Clear with grass background
  ctx.fillStyle = '#2a5a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add grass texture
  ctx.fillStyle = 'rgba(34, 139, 34, 0.1)';
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
  
  // Get current area data
  const area = areas[currentArea];
  
  // Draw paths
  ctx.strokeStyle = '#c4a57b';
  area.paths.forEach(path => {
    const p1 = worldToScreen(path.x1, path.y1);
    const p2 = worldToScreen(path.x2, path.y2);
    ctx.lineWidth = path.width * ZOOM;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });
  
  // Draw rocks with type variations
  area.rocks.forEach(rock => {
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
  });
  
  // Draw trees
  area.trees.forEach(tree => {
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
      
      // Add detail
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
  
  // Draw buildings with enhanced textures
  area.buildings.forEach(building => {
    const pos = worldToScreen(building.x, building.y);
    const w = building.width * ZOOM;
    const h = building.height * ZOOM;
    
    // Building base with stone texture
    ctx.fillStyle = building.color;
    ctx.fillRect(pos.x - w/2, pos.y - h/2, w, h);
    
    // Stone brick texture
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    const brickH = ZOOM * 0.3;
    const brickW = ZOOM * 0.5;
    for (let by = pos.y - h/2; by < pos.y + h/2; by += brickH) {
      const offset = (Math.floor(by / brickH) % 2) * (brickW / 2);
      for (let bx = pos.x - w/2 + offset; bx < pos.x + w/2; bx += brickW) {
        ctx.strokeRect(bx, by, brickW, brickH);
      }
    }
    
    // Building outline
    ctx.strokeStyle = '#6b5d50';
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x - w/2, pos.y - h/2, w, h);
    
    // Windows with detailed frame
    ctx.fillStyle = '#8ab4f8';
    const winW = w * 0.18;
    const winH = h * 0.22;
    const win1X = pos.x - w * 0.25;
    const win2X = pos.x + w * 0.07;
    const winY = pos.y - h * 0.2;
    
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
    
    // Roof with tile texture
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - h/2 - w * 0.2);
    ctx.lineTo(pos.x - w/2 - w * 0.1, pos.y - h/2);
    ctx.lineTo(pos.x + w/2 + w * 0.1, pos.y - h/2);
    ctx.closePath();
    ctx.fill();
    
    // Roof tiles
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    const tileH = ZOOM * 0.15;
    for (let ty = pos.y - h/2 - w * 0.2; ty < pos.y - h/2; ty += tileH) {
      const progress = (ty - (pos.y - h/2 - w * 0.2)) / (w * 0.2);
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
    ctx.moveTo(pos.x, pos.y - h/2 - w * 0.2);
    ctx.lineTo(pos.x - w/2 - w * 0.1, pos.y - h/2);
    ctx.lineTo(pos.x + w/2 + w * 0.1, pos.y - h/2);
    ctx.closePath();
    ctx.stroke();
    
    // Door with wood grain
    ctx.fillStyle = '#654321';
    const doorW = w * 0.3;
    const doorH = h * 0.4;
    const doorX = pos.x - doorW/2;
    const doorY = pos.y + h/2 - doorH;
    ctx.fillRect(doorX, doorY, doorW, doorH);
    
    // Wood grain (vertical lines)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const gx = doorX + (doorW / 4) * i;
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
    ctx.arc(doorX + doorW * 0.8, doorY + doorH * 0.5, ZOOM * 0.08, 0, Math.PI * 2);
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
  
  // Draw player icon (stays in center of moving)
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
  
  // Draw NPCs
  if (area.npcs) {
    area.npcs.forEach(npc => {
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
  }
  
  // Area name display
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, 200, 40);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Area: ${currentArea.charAt(0).toUpperCase() + currentArea.slice(1)}`, 20, 35);
  
  // Instructions
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, canvas.height - 50, 200, 40);
  ctx.fillStyle = '#fff';
  ctx.font = '12px Arial';
  ctx.fillText('Click/Tap to move', 20, canvas.height - 25);
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
  
  console.log('2D Top-Down World disposed');
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
 * Change to a different area/map
 * @param {string} areaName - Name of the area ('town', 'forest', 'mountains')
 */
export function changeArea(areaName) {
  if (areas[areaName]) {
    currentArea = areaName;
    // Reset player to center of new area
    player.x = 0;
    player.y = 0;
    player.isMoving = false;
    // Reset camera offset
    cameraOffset.x = 0;
    cameraOffset.y = 0;
    console.log(`Changed to area: ${areaName}`);
    
    // Map area names to game area IDs
    const areaMap = {
      'town': 'emberwood-village',
      'forest': 'emberwood-forest',
      'mountains': 'emberwood-mountains'
    };
    
    // If game has setArea function, sync the game state
    if (window.gameSetArea && areaMap[areaName]) {
      window.gameSetArea(areaMap[areaName], { source: 'map' });
    }
  } else {
    console.warn(`Area not found: ${areaName}`);
  }
}

/**
 * Get current area name
 */
export function getCurrentArea() {
  return currentArea;
}

/**
 * Get list of available areas
 */
export function getAvailableAreas() {
  return Object.keys(areas);
}

/**
 * Sync map area from game area (called when game changes areas)
 * @param {string} gameArea - Game area ID
 */
export function syncFromGameArea(gameArea) {
  const gameToMap = {
    'emberwood-village': 'town',
    'emberwood-forest': 'forest',
    'emberwood-mountains': 'mountains'
  };
  
  const mapArea = gameToMap[gameArea];
  if (mapArea && mapArea !== currentArea) {
    currentArea = mapArea;
    // Reset player to center of new area
    player.x = 0;
    player.y = 0;
    player.isMoving = false;
    cameraOffset.x = 0;
    cameraOffset.y = 0;
    console.log(`Map synced to game area: ${mapArea}`);
  }
}
