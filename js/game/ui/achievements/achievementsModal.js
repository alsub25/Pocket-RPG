// js/game/ui/achievements/achievementsModal.js
// Achievements UI modal
//
// This module creates a modal to display unlocked and locked achievements

import { getAllAchievements, getAchievementCategories } from '../../data/achievements.js';

export function createAchievementsModal(deps) {
  if (!deps || typeof deps.getState !== 'function') {
    throw new Error('createAchievementsModal: missing deps.getState()');
  }

  const {
    getState,
    openModal,
    closeModal
  } = deps;

  /**
   * Open the achievements modal
   */
  function openAchievementsModal() {
    const state = getState();
    const unlockedIds = state.achievements?.unlocked || [];
    const allAchievements = getAllAchievements();
    const categories = getAchievementCategories();
    
    // Calculate progress
    const totalAchievements = allAchievements.length;
    const unlockedCount = unlockedIds.length;
    const progress = Math.round((unlockedCount / totalAchievements) * 100);
    
    // Build modal content
    let html = `
      <div class="achievements-modal">
        <div class="achievements-header">
          <h2>🏆 Achievements</h2>
          <div class="achievements-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-text">${unlockedCount} / ${totalAchievements} (${progress}%)</div>
          </div>
        </div>
    `;
    
    // Group achievements by category
    const achievementsByCategory = {};
    for (const achievement of allAchievements) {
      if (!achievementsByCategory[achievement.category]) {
        achievementsByCategory[achievement.category] = [];
      }
      achievementsByCategory[achievement.category].push(achievement);
    }
    
    // Render each category
    for (const [categoryId, categoryInfo] of Object.entries(categories)) {
      const categoryAchievements = achievementsByCategory[categoryId] || [];
      
      if (categoryAchievements.length === 0) continue;
      
      const categoryUnlocked = categoryAchievements.filter(a => unlockedIds.includes(a.id)).length;
      
      html += `
        <div class="achievement-category">
          <h3>${categoryInfo.icon} ${categoryInfo.name} (${categoryUnlocked}/${categoryAchievements.length})</h3>
          <div class="achievement-list">
      `;
      
      // Render achievements in this category
      for (const achievement of categoryAchievements) {
        const isUnlocked = unlockedIds.includes(achievement.id);
        const lockedClass = isUnlocked ? '' : 'locked';
        const icon = isUnlocked ? achievement.icon : '🔒';
        const name = isUnlocked ? achievement.name : '???';
        const description = isUnlocked ? achievement.description : 'Achievement locked';
        
        html += `
          <div class="achievement-item ${lockedClass}">
            <div class="achievement-icon">${icon}</div>
            <div class="achievement-info">
              <div class="achievement-name">${name}</div>
              <div class="achievement-description">${description}</div>
            </div>
          </div>
        `;
      }
      
      html += `
          </div>
        </div>
      `;
    }
    
    html += `
        <button class="close-achievements-btn">Close</button>
      </div>
    `;
    
    // Inject styles if not already present
    if (!document.getElementById('achievements-styles')) {
      const style = document.createElement('style');
      style.id = 'achievements-styles';
      style.textContent = `
        .achievements-modal {
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
          padding: 20px;
        }
        
        .achievements-header {
          margin-bottom: 20px;
          text-align: center;
        }
        
        .achievements-header h2 {
          margin: 0 0 10px 0;
        }
        
        .achievements-progress {
          margin: 10px 0;
        }
        
        .progress-bar {
          width: 100%;
          height: 20px;
          background: #333;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 5px;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #8BC34A);
          transition: width 0.3s ease;
        }
        
        .progress-text {
          font-size: 14px;
          color: #ccc;
        }
        
        .achievement-category {
          margin-bottom: 30px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }
        
        .achievement-category h3 {
          margin: 0 0 15px 0;
          color: #fff;
          font-size: 18px;
        }
        
        .achievement-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 10px;
        }
        
        .achievement-item {
          display: flex;
          align-items: center;
          padding: 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          transition: all 0.2s ease;
        }
        
        .achievement-item:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
        }
        
        .achievement-item.locked {
          opacity: 0.5;
          filter: grayscale(1);
        }
        
        .achievement-icon {
          font-size: 32px;
          margin-right: 12px;
          flex-shrink: 0;
        }
        
        .achievement-info {
          flex: 1;
        }
        
        .achievement-name {
          font-weight: bold;
          color: #fff;
          margin-bottom: 4px;
        }
        
        .achievement-description {
          font-size: 13px;
          color: #ccc;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Open modal with builder function
    openModal('🏆 Achievements', (body) => {
      body.innerHTML = html;
      
      // Attach close button event listener after modal is opened
      setTimeout(() => {
        const closeBtn = body.querySelector('.close-achievements-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            closeModal();
          });
        }
      }, 0);
    });
  }

  // Public API
  return {
    openAchievementsModal
  };
}
