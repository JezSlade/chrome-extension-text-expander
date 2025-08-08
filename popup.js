// PromptExpander Popup Script

document.addEventListener('DOMContentLoaded', function() {
  // Initialize popup
  initializePopup();
  loadPopupData();
  setupEventListeners();
});

// Initialize popup elements
function initializePopup() {
  console.log('PromptExpander popup initialized');
  
  // Set initial states
  updateStatusIndicator();
  detectAIPlatform();
}

// Load data for popup
async function loadPopupData() {
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Update domain info
    const domain = new URL(tab.url).hostname;
    document.getElementById('currentDomain').textContent = domain;
    
    // Get page info from content script
    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' }, (response) => {
      if (response) {
        document.getElementById('textFieldCount').textContent = response.textFields || 0;
      }
    });
    
    // Load configuration and stats
    chrome.runtime.sendMessage({
      type: 'GET_STORAGE',
      keys: ['enabled', 'snippets', 'templates', 'usage']
    }, (data) => {
      if (data) {
        updateToggleState(data.enabled !== false);
        updateStats(data);
        updateRecentSnippets(data.snippets);
      }
    });
    
  } catch (error) {
    console.error('Error loading popup data:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Extension toggle
  const toggle = document.getElementById('extensionToggle');
  toggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    
    chrome.runtime.sendMessage({
      type: 'SET_STORAGE',
      data: { enabled: enabled }
    }, () => {
      updateStatusIndicator(enabled);
      showNotification(enabled ? 'PromptExpander enabled' : 'PromptExpander disabled');
    });
  });
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Manage snippets button
  document.getElementById('openSnippetsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
  
  // Templates button
  document.getElementById('templatesBtn').addEventListener('click', () => {
    showTemplateMenu();
  });
  
  // Import button
  document.getElementById('importBtn').addEventListener('click', () => {
    importData();
  });
  
  // Export button
  document.getElementById('exportBtn').addEventListener('click', () => {
    exportData();
  });
  
  // Help button
  document.getElementById('helpBtn').addEventListener('click', () => {
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/promptexpander/wiki' 
    });
  });
}

// Update status indicator
function updateStatusIndicator(enabled = true) {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  if (enabled) {
    statusDot.classList.add('active');
    statusText.textContent = 'Active';
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = 'Disabled';
  }
}

// Update toggle state
function updateToggleState(enabled) {
  const toggle = document.getElementById('extensionToggle');
  toggle.checked = enabled;
  updateStatusIndicator(enabled);
}

// Detect AI platform
function detectAIPlatform() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const url = tab.url;
    const aiPlatformElement = document.getElementById('aiPlatform');
    
    let platform = 'Unknown';
    
    if (url.includes('chat.openai.com')) {
      platform = 'ChatGPT';
    } else if (url.includes('claude.ai') || url.includes('anthropic.com')) {
      platform = 'Claude';
    } else if (url.includes('bard.google.com')) {
      platform = 'Bard';
    } else if (url.includes('bing.com/chat')) {
      platform = 'Bing Chat';
    } else if (url.includes('poe.com')) {
      platform = 'Poe';
    } else if (url.includes('character.ai')) {
      platform = 'Character.AI';
    }
    
    aiPlatformElement.textContent = platform;
    
    // Add platform-specific styling
    if (platform !== 'Unknown') {
      aiPlatformElement.style.color = '#10b981';
      aiPlatformElement.style.fontWeight = '600';
    }
  });
}

// Update statistics
function updateStats(data) {
  const today = new Date().toDateString();
  const usage = data.usage || {};
  const todayUsage = usage[today] || {};
  
  // Calculate today's expansions
  const todayExpansions = Object.values(todayUsage).reduce((sum, item) => {
    return sum + (item.count || 0);
  }, 0);
  
  document.getElementById('todayExpansions').textContent = todayExpansions;
  document.getElementById('totalSnippets').textContent = Object.keys(data.snippets || {}).length;
  document.getElementById('totalTemplates').textContent = Object.keys(data.templates || {}).length;
  
  // Calculate average tokens (placeholder)
  document.getElementById('avgTokens').textContent = todayExpansions > 0 ? '~150' : '-';
}

// Update recent snippets
function updateRecentSnippets(snippets) {
  const container = document.getElementById('recentSnippets');
  
  if (!snippets || Object.keys(snippets).length === 0) {
    container.innerHTML = '<div class="empty-state">No snippets created yet</div>';
    return;
  }
  
  // Get most recent snippets (simplified - in real app would track usage)
  const recentSnippets = Object.entries(snippets).slice(0, 3);
  
  container.innerHTML = recentSnippets.map(([key, snippet]) => `
    <div class="recent-item" data-trigger="${key}">
      <span class="snippet-key">:${key}</span>
      <span class="snippet-desc">${snippet.description || 'No description'}</span>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      const trigger = item.dataset.trigger;
      insertSnippetIntoActiveTab(trigger);
    });
  });
}

// Insert snippet into active tab
function insertSnippetIntoActiveTab(trigger) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'OMNIBOX_EXPANSION',
      trigger: trigger
    });
    window.close();
  });
}

// Show template menu
function showTemplateMenu() {
  chrome.runtime.sendMessage({
    type: 'GET_STORAGE',
    keys: ['templates']
  }, (data) => {
    const templates = data.templates || {};
    
    if (Object.keys(templates).length === 0) {
      showNotification('No templates available');
      return;
    }
    
    // Create template menu
    const menu = document.createElement('div');
    menu.className = 'template-menu';
    menu.innerHTML = `
      <div class="menu-backdrop"></div>
      <div class="menu-content">
        <div class="menu-header">
          <h3>Select Template</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="menu-body">
          ${Object.entries(templates).map(([key, template]) => `
            <div class="template-item" data-template="${key}">
              <div class="template-name">${template.name}</div>
              <div class="template-preview">
                <div class="template-pre">${template.pre}</div>
                <div class="template-post">${template.post}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(menu);
    
    // Add event handlers
    menu.querySelector('.close-btn').addEventListener('click', () => menu.remove());
    menu.querySelector('.menu-backdrop').addEventListener('click', () => menu.remove());
    
    menu.querySelectorAll('.template-item').forEach(item => {
      item.addEventListener('click', () => {
        const templateKey = item.dataset.template;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'INJECT_TEMPLATE',
            template: templateKey
          });
          menu.remove();
          window.close();
        });
      });
    });
  });
}

// Import data
function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        
        chrome.runtime.sendMessage({
          type: 'IMPORT_DATA',
          data: data
        }, (response) => {
          if (response.success) {
            showNotification('Data imported successfully');
            loadPopupData(); // Refresh the popup
          } else {
            showNotification('Import failed: ' + response.error, 'error');
          }
        });
      } catch (error) {
        showNotification('Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

// Export data
function exportData() {
  chrome.runtime.sendMessage({
    type: 'EXPORT_DATA'
  }, (response) => {
    if (response.data) {
      // Create download
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = response.filename;
      a.click();
      
      URL.revokeObjectURL(url);
      showNotification('Data exported successfully');
    }
  });
}

// Show notification
function showNotification(message, type = 'info') {
  // Remove existing notification
  const existing = document.querySelector('.popup-notification');
  if (existing) {
    existing.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `popup-notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 2 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 2000);
}

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.enabled) {
    updateToggleState(changes.enabled.newValue);
  }
  
  // Refresh stats if usage data changed
  if (changes.usage || changes.snippets || changes.templates) {
    chrome.runtime.sendMessage({
      type: 'GET_STORAGE',
      keys: ['snippets', 'templates', 'usage']
    }, (data) => {
      if (data) {
        updateStats(data);
        updateRecentSnippets(data.snippets);
      }
    });
  }
});