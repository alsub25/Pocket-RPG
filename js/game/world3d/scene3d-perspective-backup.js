// js/game/world3d/scene3d.js
// 3D World Scene using Canvas 2.5D rendering
//
// This module creates and manages a 3D-like world that players can explore.
// Uses canvas 2D context with perspective rendering for a pseudo-3D effect.

let canvas, ctx;
let player = { x: 0, z: 0, angle: 0, height: 1.7 };
let moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
const MOVE_SPEED = 0.05;
const ROTATE_SPEED = 0.03;

// World objects
const trees = [];
const buildings = [];
const rocks = [];
const paths = [];
const hills = []; // Terrain elevation features
const grassPattern = []; // Pre-generated grass texture positions

// Touch controls state
let touchStartX = 0;
let touchStartY = 0;
let touchMoveX = 0;
let touchMoveY = 0;
let isTouching = false;

/**
 * Get terrain height at a given position
 */
function getTerrainHeight(x, z) {
  let height = 0;
  // Add elevation from hills
  hills.forEach(hill => {
    const dx = x - hill.x;
    const dz = z - hill.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < hill.radius) {
      const factor = 1 - (dist / hill.radius);
      height += hill.height * factor * factor; // Smooth falloff
    }
  });
  return height;
}

/**
 * Initialize the 3D world
 * @param {HTMLElement} container - DOM element to render into
 */
export function init3DWorld(container) {
  // Create canvas
  canvas = document.createElement('canvas');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  canvas.style.display = 'block';
  container.appendChild(canvas);
  
  ctx = canvas.getContext('2d');
  
  // Initialize world objects
  initWorldObjects();
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize);
  
  // Start render loop
  animate();
  
  console.log('3D World initialized');
}

/**
 * Initialize world objects (trees, buildings, rocks, paths, hills)
 */
function initWorldObjects() {
  // Create hills for terrain variation
  hills.push({ x: -20, z: -20, radius: 15, height: 2 });
  hills.push({ x: 25, z: 15, radius: 12, height: 1.5 });
  hills.push({ x: -15, z: 20, radius: 10, height: 1.2 });
  hills.push({ x: 30, z: -25, radius: 14, height: 1.8 });
  
  // Create trees with variety and place them on terrain
  for (let i = 0; i < 50; i++) {
    const x = (Math.random() - 0.5) * 60;
    const z = (Math.random() - 0.5) * 60;
    trees.push({
      x: x,
      z: z,
      groundHeight: getTerrainHeight(x, z),
      height: 3 + Math.random() * 2,
      trunkRadius: 0.15 + Math.random() * 0.1,
      type: Math.random() > 0.5 ? 'pine' : 'oak'
    });
  }
  
  // Create rocks with pre-generated random values for consistent appearance
  for (let i = 0; i < 20; i++) {
    const randomValues = [];
    for (let j = 0; j < 6; j++) {
      randomValues.push(0.8 + Math.random() * 0.4);
    }
    const x = (Math.random() - 0.5) * 60;
    const z = (Math.random() - 0.5) * 60;
    rocks.push({
      x: x,
      z: z,
      groundHeight: getTerrainHeight(x, z),
      size: 0.3 + Math.random() * 0.5,
      randomValues: randomValues
    });
  }
  
  // Create paths
  paths.push({ x1: -20, z1: 0, x2: 20, z2: 0 }); // Horizontal path
  paths.push({ x1: 0, z1: -20, x2: 0, z2: 20 }); // Vertical path
  
  // Create buildings with more variety - place on flat-ish ground
  const buildingData = [
    { x: 10, z: 5, width: 4, depth: 3, height: 4, name: 'Tavern', color: '#a0826d' },
    { x: -10, z: 5, width: 4, depth: 4, height: 3, name: 'Shop', color: '#8b7355' },
    { x: 0, z: -15, width: 5, depth: 5, height: 5, name: 'Town Hall', color: '#9a8a7a' },
    { x: 15, z: -10, width: 3, depth: 3, height: 3.5, name: 'House', color: '#b8a490' },
    { x: -15, z: -8, width: 3.5, depth: 3, height: 3, name: 'Cottage', color: '#a89580' }
  ];
  
  buildingData.forEach(b => {
    buildings.push({
      ...b,
      groundHeight: getTerrainHeight(b.x, b.z)
    });
  });
  
  // Pre-generate grass texture pattern (done once for consistent appearance)
  for (let i = 0; i < 100; i++) {
    grassPattern.push({
      x: Math.random(),
      y: Math.random()
    });
  }
}

/**
 * Handle window resize
 */
function onWindowResize() {
  const container = canvas.parentElement;
  if (!container) return;
  
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}

/**
 * Update player movement
 */
function updateMovement() {
  // Keyboard controls
  if (moveState.forward) {
    player.x += Math.sin(player.angle) * MOVE_SPEED;
    player.z += Math.cos(player.angle) * MOVE_SPEED;
  }
  if (moveState.backward) {
    player.x -= Math.sin(player.angle) * MOVE_SPEED;
    player.z -= Math.cos(player.angle) * MOVE_SPEED;
  }
  if (moveState.left) {
    player.x -= Math.cos(player.angle) * MOVE_SPEED;
    player.z += Math.sin(player.angle) * MOVE_SPEED;
  }
  if (moveState.right) {
    player.x += Math.cos(player.angle) * MOVE_SPEED;
    player.z -= Math.sin(player.angle) * MOVE_SPEED;
  }
  if (moveState.rotateLeft) {
    player.angle -= ROTATE_SPEED;
  }
  if (moveState.rotateRight) {
    player.angle += ROTATE_SPEED;
  }
  
  // Touch controls - improved for mobile
  if (isTouching) {
    const deltaX = touchMoveX - touchStartX;
    const deltaY = touchMoveY - touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Only respond if gesture is significant enough
    if (distance > 10) {
      // Determine primary direction
      const isVertical = Math.abs(deltaY) > Math.abs(deltaX);
      
      if (isVertical) {
        // Vertical swipe - move forward/backward
        const direction = deltaY < 0 ? 1 : -1;
        const intensity = Math.min(Math.abs(deltaY) / 100, 1);
        player.x += Math.sin(player.angle) * MOVE_SPEED * direction * intensity;
        player.z += Math.cos(player.angle) * MOVE_SPEED * direction * intensity;
      } else {
        // Horizontal swipe - rotate
        const rotateAmount = deltaX * 0.0005;
        player.angle += rotateAmount;
      }
    }
  }
}

/**
 * Project 3D point to 2D screen coordinates
 */
function project(x, y, z) {
  // Translate to camera space
  const dx = x - player.x;
  const dz = z - player.z;
  
  // Rotate by camera angle
  const rotatedX = dx * Math.cos(-player.angle) - dz * Math.sin(-player.angle);
  const rotatedZ = dx * Math.sin(-player.angle) + dz * Math.cos(-player.angle);
  
  // Don't render if behind camera
  if (rotatedZ <= 0.1) return null;
  
  // Perspective projection
  const scale = 400 / rotatedZ;
  const screenX = canvas.width / 2 + rotatedX * scale;
  const screenY = canvas.height / 2 - (y - player.height) * scale;
  
  return { x: screenX, y: screenY, scale: scale, distance: rotatedZ };
}

/**
 * Render the scene
 */
function render() {
  // Clear canvas with sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#87ceeb');
  gradient.addColorStop(0.5, '#b0d8f0');
  gradient.addColorStop(1, '#228b22');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw ground with texture pattern
  ctx.fillStyle = '#2a5a2a';
  const groundY = canvas.height / 2;
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  
  // Add grass texture pattern (using pre-generated positions)
  ctx.fillStyle = 'rgba(34, 139, 34, 0.1)';
  grassPattern.forEach(pos => {
    const x = pos.x * canvas.width;
    const y = groundY + pos.y * (canvas.height - groundY);
    ctx.fillRect(x, y, 2, 1);
  });
  
  // Collect all renderable objects with distances
  const renderables = [];
  
  // Add paths
  paths.forEach(path => {
    const p1 = project(path.x1, 0, path.z1);
    const p2 = project(path.x2, 0, path.z2);
    if (p1 && p2) {
      renderables.push({
        type: 'path',
        distance: (p1.distance + p2.distance) / 2,
        p1: p1,
        p2: p2
      });
    }
  });
  
  // Add rocks
  rocks.forEach(rock => {
    const center = project(rock.x, 0, rock.z);
    if (center) {
      renderables.push({
        type: 'rock',
        distance: center.distance,
        center: center,
        rock: rock
      });
    }
  });
  
  // Add trees
  trees.forEach(tree => {
    const groundY = tree.groundHeight || 0;
    const base = project(tree.x, groundY, tree.z);
    const top = project(tree.x, groundY + tree.height, tree.z);
    if (base && top) {
      renderables.push({
        type: 'tree',
        distance: base.distance,
        base: base,
        top: top,
        tree: tree
      });
    }
  });
  
  // Add buildings
  buildings.forEach(building => {
    const groundY = building.groundHeight || 0;
    const corners = [
      project(building.x - building.width/2, groundY, building.z - building.depth/2),
      project(building.x + building.width/2, groundY, building.z - building.depth/2),
      project(building.x + building.width/2, groundY, building.z + building.depth/2),
      project(building.x - building.width/2, groundY, building.z + building.depth/2)
    ];
    
    if (corners.every(c => c !== null)) {
      renderables.push({
        type: 'building',
        distance: corners[0].distance,
        corners: corners,
        building: building
      });
    }
  });
  
  // Sort by distance (far to near)
  renderables.sort((a, b) => b.distance - a.distance);
  
  // Render all objects
  renderables.forEach(obj => {
    if (obj.type === 'path') {
      renderPath(obj);
    } else if (obj.type === 'rock') {
      renderRock(obj);
    } else if (obj.type === 'tree') {
      renderTree(obj);
    } else if (obj.type === 'building') {
      renderBuilding(obj);
    }
  });
  
  // Draw crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();
}

/**
 * Render a path
 */
function renderPath(obj) {
  const { p1, p2 } = obj;
  
  // Draw path as a brown/tan line
  ctx.strokeStyle = '#c4a57b';
  ctx.lineWidth = Math.max(2, 30 * p1.scale / 100);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  
  // Add path edge lines
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = Math.max(1, 2 * p1.scale / 100);
  ctx.stroke();
}

/**
 * Render a rock
 */
function renderRock(obj) {
  const { center, rock } = obj;
  
  const size = Math.max(2, rock.size * 30 * center.scale / 100);
  
  // Draw rock as irregular polygon (using pre-generated random values)
  ctx.fillStyle = '#696969';
  ctx.strokeStyle = '#505050';
  ctx.lineWidth = 1;
  ctx.beginPath();
  
  const points = 6;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = size * rock.randomValues[i];
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius * 0.5;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Render a tree with 3D volume
 */
function renderTree(obj) {
  const { base, top, tree } = obj;
  
  // Calculate trunk dimensions with proper perspective
  const trunkRadius = tree.trunkRadius || 0.2;
  const trunkWidthBottom = Math.max(2, trunkRadius * 60 * base.scale / 100);
  const trunkWidthTop = Math.max(1, trunkRadius * 40 * base.scale / 100);
  
  // Draw trunk as 3D cylinder (two sides visible)
  // Left side of trunk (darker)
  ctx.fillStyle = '#654321';
  ctx.beginPath();
  ctx.moveTo(base.x - trunkWidthBottom / 2, base.y);
  ctx.lineTo(top.x - trunkWidthTop / 2, top.y);
  ctx.lineTo(top.x, top.y - trunkWidthTop / 4);
  ctx.lineTo(base.x, base.y - trunkWidthBottom / 4);
  ctx.closePath();
  ctx.fill();
  
  // Right side of trunk (lighter)
  ctx.fillStyle = '#8b4513';
  ctx.beginPath();
  ctx.moveTo(base.x + trunkWidthBottom / 2, base.y);
  ctx.lineTo(top.x + trunkWidthTop / 2, top.y);
  ctx.lineTo(top.x, top.y - trunkWidthTop / 4);
  ctx.lineTo(base.x, base.y - trunkWidthBottom / 4);
  ctx.closePath();
  ctx.fill();
  
  // Add bark texture lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const ratio = i / 4;
    const y = base.y + (top.y - base.y) * ratio;
    const leftX = base.x - trunkWidthBottom / 2 + (top.x - trunkWidthTop / 2 - (base.x - trunkWidthBottom / 2)) * ratio;
    const rightX = base.x + trunkWidthBottom / 2 + (top.x + trunkWidthTop / 2 - (base.x + trunkWidthBottom / 2)) * ratio;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
  }
  
  // Foliage with 3D layering
  const foliageRadius = Math.max(3, 25 * base.scale / 100);
  const foliageBase = top.y - foliageRadius * 0.3;
  
  if (tree.type === 'pine') {
    // Pine tree with multiple 3D cone layers
    const layers = 3;
    for (let layer = 0; layer < layers; layer++) {
      const layerRatio = layer / layers;
      const layerY = foliageBase - foliageRadius * 1.5 * (1 - layerRatio);
      const layerRadius = foliageRadius * (1 - layerRatio * 0.3);
      
      // Back layer (darker)
      ctx.fillStyle = layer % 2 === 0 ? '#1a4d1a' : '#146b14';
      ctx.beginPath();
      ctx.moveTo(top.x, layerY - layerRadius * 0.8);
      ctx.lineTo(top.x - layerRadius * 1.2, layerY + layerRadius * 0.4);
      ctx.lineTo(top.x + layerRadius * 1.2, layerY + layerRadius * 0.4);
      ctx.closePath();
      ctx.fill();
      
      // Add highlights
      ctx.fillStyle = layer % 2 === 0 ? '#228b22' : '#2a9d2a';
      ctx.beginPath();
      ctx.moveTo(top.x, layerY - layerRadius * 0.8);
      ctx.lineTo(top.x - layerRadius * 0.7, layerY + layerRadius * 0.2);
      ctx.lineTo(top.x + layerRadius * 0.7, layerY + layerRadius * 0.2);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Oak tree with 3D spherical foliage clusters
    const clusters = [
      { x: 0, y: -0.3, scale: 1.0, color: '#1a4d1a' },
      { x: -0.4, y: 0, scale: 0.8, color: '#228b22' },
      { x: 0.4, y: 0, scale: 0.8, color: '#228b22' },
      { x: -0.2, y: 0.3, scale: 0.7, color: '#2a9d2a' },
      { x: 0.2, y: 0.3, scale: 0.7, color: '#2a9d2a' },
      { x: 0, y: 0.1, scale: 0.9, color: '#1e7a1e' }
    ];
    
    clusters.forEach(cluster => {
      const clusterX = top.x + cluster.x * foliageRadius;
      const clusterY = foliageBase + cluster.y * foliageRadius;
      const clusterRadius = foliageRadius * cluster.scale;
      
      // Main cluster
      ctx.fillStyle = cluster.color;
      ctx.beginPath();
      ctx.arc(clusterX, clusterY, clusterRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight for 3D effect
      ctx.fillStyle = 'rgba(34, 139, 34, 0.4)';
      ctx.beginPath();
      ctx.arc(clusterX - clusterRadius * 0.3, clusterY - clusterRadius * 0.3, clusterRadius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

/**
 * Render a building
 */
function renderBuilding(obj) {
  const { corners, building } = obj;
  
  // Project the top corners of the building (accounting for ground height)
  const groundY = building.groundHeight || 0;
  const topCorners = [
    project(building.x - building.width/2, groundY + building.height, building.z - building.depth/2),
    project(building.x + building.width/2, groundY + building.height, building.z - building.depth/2),
    project(building.x + building.width/2, groundY + building.height, building.z + building.depth/2),
    project(building.x - building.width/2, groundY + building.height, building.z + building.depth/2)
  ];
  
  // Check if all corners are visible
  const allVisible = corners.every(c => c !== null) && topCorners.every(c => c !== null);
  if (!allVisible) return;
  
  // Determine which walls are visible based on camera position
  const dx = building.x - player.x;
  const dz = building.z - player.z;
  const angleToBuilding = Math.atan2(dx, dz);
  const relativeAngle = angleToBuilding - player.angle;
  
  // Normalize angle to -PI to PI
  let normAngle = relativeAngle;
  while (normAngle > Math.PI) normAngle -= Math.PI * 2;
  while (normAngle < -Math.PI) normAngle += Math.PI * 2;
  
  // Draw back wall first if visible (furthest from camera)
  if (normAngle > Math.PI * 0.5 || normAngle < -Math.PI * 0.5) {
    ctx.fillStyle = shadeColor(building.color || '#a0826d', -25);
    ctx.strokeStyle = '#6b5d50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.lineTo(topCorners[3].x, topCorners[3].y);
    ctx.lineTo(topCorners[2].x, topCorners[2].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  
  // Draw left wall if visible
  if (normAngle < 0) {
    ctx.fillStyle = shadeColor(building.color || '#a0826d', -20);
    ctx.strokeStyle = '#6b5d50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.lineTo(topCorners[3].x, topCorners[3].y);
    ctx.lineTo(topCorners[0].x, topCorners[0].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  
  // Draw right wall if visible
  if (normAngle > 0) {
    ctx.fillStyle = shadeColor(building.color || '#a0826d', -15);
    ctx.strokeStyle = '#6b5d50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(topCorners[2].x, topCorners[2].y);
    ctx.lineTo(topCorners[1].x, topCorners[1].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  
  // Draw front wall (always visible, facing camera)
  ctx.fillStyle = building.color || '#a0826d';
  ctx.strokeStyle = '#6b5d50';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(topCorners[1].x, topCorners[1].y);
  ctx.lineTo(topCorners[0].x, topCorners[0].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Add brick/plank texture to front wall
  const avgScale = corners[0].scale;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  
  // Horizontal lines on front wall
  for (let i = 1; i < 5; i++) {
    const ratio = i / 5;
    const y1 = corners[0].y + (topCorners[0].y - corners[0].y) * ratio;
    const y2 = corners[1].y + (topCorners[1].y - corners[1].y) * ratio;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, y1);
    ctx.lineTo(corners[1].x, y2);
    ctx.stroke();
  }
  
  // Vertical lines for brick pattern
  for (let i = 1; i < 4; i++) {
    const ratio = i / 4;
    const x = corners[0].x + (corners[1].x - corners[0].x) * ratio;
    const yBottom = corners[0].y + (corners[1].y - corners[0].y) * ratio;
    const yTop = topCorners[0].y + (topCorners[1].y - topCorners[0].y) * ratio;
    ctx.beginPath();
    ctx.moveTo(x, yBottom);
    ctx.lineTo(x, yTop);
    ctx.stroke();
  }
  
  // Draw windows on front wall
  const windowWidth = Math.max(3, 15 * avgScale / 100);
  const windowHeight = Math.max(3, 20 * avgScale / 100);
  const wallCenterX = (corners[0].x + corners[1].x) / 2;
  const wallCenterY = (corners[0].y + topCorners[0].y) / 2;
  
  ctx.fillStyle = '#4a6fa5';
  ctx.strokeStyle = '#2a3f5f';
  ctx.lineWidth = 1;
  
  // Two windows on front wall
  [-1, 1].forEach(offset => {
    const windowX = wallCenterX + offset * windowWidth * 1.5;
    ctx.fillRect(windowX - windowWidth / 2, wallCenterY - windowHeight / 2, windowWidth, windowHeight);
    ctx.strokeRect(windowX - windowWidth / 2, wallCenterY - windowHeight / 2, windowWidth, windowHeight);
    
    // Window cross
    ctx.beginPath();
    ctx.moveTo(windowX, wallCenterY - windowHeight / 2);
    ctx.lineTo(windowX, wallCenterY + windowHeight / 2);
    ctx.moveTo(windowX - windowWidth / 2, wallCenterY);
    ctx.lineTo(windowX + windowWidth / 2, wallCenterY);
    ctx.stroke();
  });
  
  // Draw roof
  ctx.fillStyle = '#8b0000';
  ctx.strokeStyle = '#5a0000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(topCorners[0].x, topCorners[0].y);
  for (let i = 1; i < topCorners.length; i++) {
    ctx.lineTo(topCorners[i].x, topCorners[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Add roof tiles pattern
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  for (let i = 1; i < 4; i++) {
    const ratio = i / 4;
    const y1 = topCorners[0].y + (topCorners[3].y - topCorners[0].y) * ratio;
    const y2 = topCorners[1].y + (topCorners[2].y - topCorners[1].y) * ratio;
    ctx.beginPath();
    ctx.moveTo(topCorners[0].x, y1);
    ctx.lineTo(topCorners[1].x, y2);
    ctx.stroke();
  }
  
  // Draw door on front wall
  const doorWidth = Math.max(2, 12 * avgScale / 100);
  const doorHeight = Math.max(4, 25 * avgScale / 100);
  const doorX = wallCenterX;
  const doorY = corners[0].y;
  
  ctx.fillStyle = '#654321';
  ctx.strokeStyle = '#3a2510';
  ctx.lineWidth = 1;
  ctx.fillRect(doorX - doorWidth / 2, doorY - doorHeight, doorWidth, doorHeight);
  ctx.strokeRect(doorX - doorWidth / 2, doorY - doorHeight, doorWidth, doorHeight);
  
  // Door handle
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(doorX + doorWidth / 3, doorY - doorHeight / 2, Math.max(1, 2 * avgScale / 100), 0, Math.PI * 2);
  ctx.fill();
  
  // Draw building name if close enough
  if (obj.distance < 5) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText(building.name, wallCenterX, topCorners[0].y - 10);
    ctx.fillText(building.name, wallCenterX, topCorners[0].y - 10);
  }
}

/**
 * Helper function to shade a color
 */
function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
}

/**
 * Animation loop
 */
function animate() {
  updateMovement();
  render();
  requestAnimationFrame(animate);
}

/**
 * Set up keyboard controls
 */
export function setupControls() {
  // Keyboard controls
  document.addEventListener('keydown', (event) => {
    switch (event.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        moveState.forward = true;
        break;
      case 's':
      case 'arrowdown':
        moveState.backward = true;
        break;
      case 'a':
        moveState.left = true;
        break;
      case 'd':
        moveState.right = true;
        break;
      case 'arrowleft':
        moveState.rotateLeft = true;
        break;
      case 'arrowright':
        moveState.rotateRight = true;
        break;
    }
  });
  
  document.addEventListener('keyup', (event) => {
    switch (event.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        moveState.forward = false;
        break;
      case 's':
      case 'arrowdown':
        moveState.backward = false;
        break;
      case 'a':
        moveState.left = false;
        break;
      case 'd':
        moveState.right = false;
        break;
      case 'arrowleft':
        moveState.rotateLeft = false;
        break;
      case 'arrowright':
        moveState.rotateRight = false;
        break;
    }
  });
  
  // Touch controls for mobile
  if (canvas) {
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      if (event.touches.length > 0) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchMoveX = touchStartX;
        touchMoveY = touchStartY;
        isTouching = true;
      }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      if (event.touches.length > 0 && isTouching) {
        touchMoveX = event.touches[0].clientX;
        touchMoveY = event.touches[0].clientY;
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      isTouching = false;
      touchStartX = 0;
      touchStartY = 0;
      touchMoveX = 0;
      touchMoveY = 0;
    }, { passive: false });
  }
}

/**
 * Clean up 3D world resources
 */
export function dispose3DWorld() {
  if (canvas && canvas.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }
  
  window.removeEventListener('resize', onWindowResize);
  
  // Reset move state
  moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
  
  console.log('3D World disposed');
}

/**
 * Get current player position (for game state sync)
 */
export function getPlayerPosition() {
  return {
    x: player.x,
    y: 0,
    z: player.z,
    angle: player.angle
  };
}

/**
 * Set player position (for game state sync)
 */
export function setPlayerPosition(x, y, z, angle) {
  player.x = x;
  player.z = z;
  if (angle !== undefined) player.angle = angle;
}
