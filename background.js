// PromptExpander Background Script (Service Worker for Manifest V3)

// Default templates and snippets
const DEFAULT_TEMPLATES = {
  'cot': {
    name: 'Chain of Thought',
    pre: 'Think step-by-step:\n',
    post: '\n\nProvide your final answer in a clear, structured format.'
  },
  'creative': {
    name: 'Creative Writing',
    pre: 'You are a Pulitzer Prize-winning author. Write with:\n',
    post: '\n\nInclude vivid metaphors and rich sensory details.'
  },
  'analysis': {
    name: 'Deep Analysis',
    pre: 'Analyze this thoroughly, considering multiple perspectives:\n',
    post: '\n\nSummarize key insights and actionable recommendations.'
  }
};

const DEFAULT_SNIPPETS = {
  'hello': {
    content: 'Hello! How can I assist you today?',
    description: 'Simple greeting'
  },
  'date': {
    content: '{{date}}',
    description: 'Current date'
  },
  'time': {
    content: '{{time}}',
    description: 'Current time'
  },
  'datetime': {
    content: '{{date}} {{time}}',
    description: 'Current date and time'
  }
};

// Extension installation and startup
chrome.runtime.onInstalled.addListener((details) => {
  console.log('PromptExpander installed/updated:', details.reason);
  
  // Initialize default settings
  chrome.storage.sync.set({
    enabled: true,
    snippets: DEFAULT_SNIPPETS,
    templates: DEFAULT_TEMPLATES,
    excludedDomains: [],
    excludedSelectors: ['input[type="password"]', '.code-editor', 'textarea[data-gramm="false"]'],
    triggerPrefix: ':',
    omniboxEnabled: true,
    analyticsEnabled: true,
    sessionStorage: {},
    usage: {}
  });
  
  // Create context menu
  chrome.contextMenus.create({
    id: 'promptexpander-menu',
    title: 'PromptExpander',
    contexts: ['editable']
  });
  
  chrome.contextMenus.create({
    id: 'expand-selection',
    parentId: 'promptexpander-menu',
    title: 'Expand Selected Text',
    contexts: ['editable']
  });
  
  chrome.contextMenus.create({
    id: 'open-snippet-menu',
    parentId: 'promptexpander-menu',
    title: 'Open Snippet Menu',
    contexts: ['editable']
  });
});

// Handle omnibox input
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  if (text.startsWith(':')) {
    // Search for matching snippets
    chrome.storage.sync.get(['snippets'], (result) => {
      const snippets = result.snippets || {};
      const suggestions = [];
      
      Object.keys(snippets).forEach(key => {
        if (key.includes(text.substring(1))) {
          suggestions.push({
            content: key,
            description: `${key} - ${snippets[key].description || 'No description'}`
          });
        }
      });
      
      suggest(suggestions);
    });
  }
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  // Execute snippet expansion in current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'OMNIBOX_EXPANSION',
      trigger: text
    });
  });
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    switch (command) {
      case 'quick-menu':
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SHOW_QUICK_MENU'
        });
        break;
      case 'expansion-undo':
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UNDO_EXPANSION'
        });
        break;
    }
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'expand-selection':
      chrome.tabs.sendMessage(tab.id, {
        type: 'EXPAND_SELECTION',
        selectedText: info.selectionText
      });
      break;
    case 'open-snippet-menu':
      chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_QUICK_MENU'
      });
      break;
  }
});

// Variable resolution system
function resolveVariables(text, context = {}) {
  const now = new Date();
  
  const variables = {
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    datetime: now.toLocaleString(),
    page_title: context.pageTitle || '',
    page_url: context.pageUrl || '',
    selected_text: context.selectedText || '',
    clipboard: context.clipboard || '',
    domain: context.domain || '',
    ...context.formData
  };
  
  // Multi-stage variable resolution
  let resolved = text;
  let iterations = 0;
  const maxIterations = 10;
  
  while (resolved.includes('{{') && iterations < maxIterations) {
    const previousResolved = resolved;
    
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      resolved = resolved.replace(regex, variables[key] || '');
    });
    
    // Break if no changes were made
    if (resolved === previousResolved) break;
    iterations++;
  }
  
  return resolved;
}

// Token counter (rough estimation)
function estimateTokens(text) {
  // Simple token estimation: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

// Analytics tracking
function trackUsage(snippetKey, domain) {
  chrome.storage.sync.get(['usage', 'analyticsEnabled'], (result) => {
    if (!result.analyticsEnabled) return;
    
    const usage = result.usage || {};
    const today = new Date().toDateString();
    
    if (!usage[today]) {
      usage[today] = {};
    }
    
    if (!usage[today][snippetKey]) {
      usage[today][snippetKey] = { count: 0, domains: new Set() };
    }
    
    usage[today][snippetKey].count++;
    usage[today][snippetKey].domains.add(domain);
    
    // Convert Set to Array for storage
    usage[today][snippetKey].domains = Array.from(usage[today][snippetKey].domains);
    
    chrome.storage.sync.set({ usage });
  });
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'RESOLVE_VARIABLES':
      const resolved = resolveVariables(message.text, message.context);
      sendResponse({ resolved, tokens: estimateTokens(resolved) });
      break;
      
    case 'GET_CLIPBOARD':
      // Note: clipboard access requires user interaction in content script
      navigator.clipboard.readText().then(text => {
        sendResponse({ clipboard: text });
      }).catch(() => {
        sendResponse({ clipboard: '' });
      });
      return true;
      
    case 'TRACK_USAGE':
      trackUsage(message.snippetKey, message.domain);
      break;
      
    case 'GET_STORAGE':
      chrome.storage.sync.get(message.keys, sendResponse);
      return true;
      
    case 'SET_STORAGE':
      chrome.storage.sync.set(message.data, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'GET_SESSION_DATA':
      chrome.storage.local.get([`session_${message.domain}`], (result) => {
        sendResponse(result[`session_${message.domain}`] || {});
      });
      return true;
      
    case 'SET_SESSION_DATA':
      chrome.storage.local.set({
        [`session_${message.domain}`]: message.data
      }, () => {
        sendResponse({ success: true });
      });
      return true;
      
    case 'EXPORT_DATA':
      chrome.storage.sync.get(null, (data) => {
        sendResponse({
          data: JSON.stringify(data, null, 2),
          filename: `promptexpander_backup_${new Date().toISOString().split('T')[0]}.json`
        });
      });
      return true;
      
    case 'IMPORT_DATA':
      try {
        const importedData = JSON.parse(message.data);
        chrome.storage.sync.set(importedData, () => {
          sendResponse({ success: true });
        });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return true;
      
    default:
      console.log('Unknown message type:', message.type);
  }
});

// Handle storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Storage changed:', changes, 'in', namespace);
  
  // Notify all tabs about configuration changes
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'STORAGE_CHANGED',
        changes: changes
      }).catch(() => {
        // Ignore errors for tabs without content scripts
      });
    });
  });
});

// Cleanup old session data periodically
chrome.alarms.create('cleanup-sessions', { delayInMinutes: 60, periodInMinutes: 1440 }); // Daily

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup-sessions') {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = [];
      
      Object.keys(items).forEach(key => {
        if (key.startsWith('session_') && items[key].timestamp < oneDayAgo) {
          keysToRemove.push(key);
        }
      });
      
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove);
        console.log('Cleaned up', keysToRemove.length, 'old session entries');
      }
    });
  }
});