// PromptExpander Injected Script - Runs in page context for advanced DOM access

(() => {
  'use strict';

  // Avoid multiple injections
  if (window.promptExpanderInjectedScript) {
    return;
  }
  window.promptExpanderInjectedScript = true;

  console.log('PromptExpander injected script loaded');

  // Enhanced clipboard access with fallback
  window.promptExpanderClipboard = {
    async read() {
      try {
        // Modern Clipboard API
        if (navigator.clipboard && navigator.clipboard.readText) {
          return await navigator.clipboard.readText();
        }
      } catch (error) {
        console.warn('Clipboard API failed, trying fallback:', error);
      }

      // Fallback method using a temporary textarea
      return new Promise((resolve) => {
        const textarea = document.createElement('textarea');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        textarea.focus();
        document.execCommand('paste');
        
        const text = textarea.value;
        document.body.removeChild(textarea);
        
        resolve(text);
      });
    },

    async write(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (error) {
        console.warn('Clipboard write failed:', error);
      }

      // Fallback method
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      return true;
    }
  };

  // Advanced text selection utilities
  window.promptExpanderSelection = {
    // Get detailed selection information
    getSelectionInfo() {
      const selection = window.getSelection();
      if (!selection.rangeCount) return null;
      
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      return {
        text: selection.toString(),
        html: range.cloneContents(),
        startContainer: range.startContainer,
        endContainer: range.endContainer,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        isEmpty: selection.isCollapsed
      };
    },

    // Replace current selection with new text
    replaceSelection(newText) {
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;
      
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const textNode = document.createTextNode(newText);
      range.insertNode(textNode);
      
      // Move cursor to end of inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      return true;
    },

    // Expand selection to word boundaries
    expandToWordBoundaries() {
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;
      
      const range = selection.getRangeAt(0);
      
      // Expand start to word boundary
      while (range.startOffset > 0) {
        const char = range.startContainer.textContent[range.startOffset - 1];
        if (/\s/.test(char)) break;
        range.setStart(range.startContainer, range.startOffset - 1);
      }
      
      // Expand end to word boundary
      while (range.endOffset < range.endContainer.textContent.length) {
        const char = range.endContainer.textContent[range.endOffset];
        if (/\s/.test(char)) break;
        range.setEnd(range.endContainer, range.endOffset + 1);
      }
      
      selection.removeAllRanges();
      selection.addRange(range);
      
      return true;
    }
  };

  // Form field detection and manipulation
  window.promptExpanderForms = {
    // Get all form fields on page
    getAllFormFields() {
      const fields = [];
      const selectors = [
        'input[type="text"]',
        'input[type="email"]',
        'input[type="search"]',
        'input[type="url"]',
        'textarea',
        '[contenteditable="true"]',
        '[contenteditable=""]'
      ];
      
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(field => {
          fields.push({
            element: field,
            type: this.getFieldType(field),
            name: field.name || field.id || field.placeholder || 'unnamed',
            value: this.getFieldValue(field),
            rect: field.getBoundingClientRect()
          });
        });
      });
      
      return fields;
    },

    // Get field type
    getFieldType(field) {
      if (field.tagName === 'TEXTAREA') return 'textarea';
      if (field.contentEditable === 'true') return 'contenteditable';
      return field.type || 'text';
    },

    // Get field value
    getFieldValue(field) {
      if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
        return field.value;
      }
      if (field.contentEditable === 'true') {
        return field.textContent || field.innerText;
      }
      return '';
    },

    // Set field value
    setFieldValue(field, value) {
      if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (field.contentEditable === 'true') {
        field.textContent = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },

    // Find active/focused field
    getActiveField() {
      const activeElement = document.activeElement;
      if (this.isEditableField(activeElement)) {
        return activeElement;
      }
      return null;
    },

    // Check if element is an editable field
    isEditableField(element) {
      if (!element) return false;
      
      const editableTypes = ['text', 'textarea', 'email', 'search', 'url'];
      
      if (element.tagName === 'TEXTAREA') return true;
      if (element.tagName === 'INPUT' && editableTypes.includes(element.type)) return true;
      if (element.contentEditable === 'true') return true;
      
      return false;
    }
  };

  // Page content analysis
  window.promptExpanderAnalysis = {
    // Analyze page for AI platform detection
    detectAIPlatform() {
      const url = window.location.href;
      const indicators = {
        'ChatGPT': ['chat.openai.com', 'openai.com/chat'],
        'Claude': ['claude.ai', 'anthropic.com'],
        'Bard': ['bard.google.com'],
        'Bing Chat': ['bing.com/chat', 'bing.com/search'],
        'Poe': ['poe.com'],
        'Character.AI': ['character.ai', 'beta.character.ai'],
        'Hugging Face': ['huggingface.co/chat'],
        'Perplexity': ['perplexity.ai']
      };
      
      for (const [platform, domains] of Object.entries(indicators)) {
        if (domains.some(domain => url.includes(domain))) {
          return platform;
        }
      }
      
      // Check for common AI chat interface patterns
      const chatIndicators = [
        'textarea[placeholder*="message"]',
        'textarea[placeholder*="ask"]',
        'textarea[placeholder*="chat"]',
        'input[placeholder*="message"]',
        'div[contenteditable="true"][role="textbox"]'
      ];
      
      if (chatIndicators.some(selector => document.querySelector(selector))) {
        return 'Generic AI Chat';
      }
      
      return 'Unknown';
    },

    // Get page metadata
    getPageMetadata() {
      return {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname,
        charset: document.characterSet,
        language: document.documentElement.lang || 'unknown',
        viewport: document.querySelector('meta[name="viewport"]')?.content || 'unknown',
        description: document.querySelector('meta[name="description"]')?.content || '',
        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
        author: document.querySelector('meta[name="author"]')?.content || '',
        wordCount: (document.body.textContent || '').split(/\s+/).length,
        linkCount: document.querySelectorAll('a').length,
        imageCount: document.querySelectorAll('img').length,
        formCount: document.querySelectorAll('form').length,
        headingCount: {
          h1: document.querySelectorAll('h1').length,
          h2: document.querySelectorAll('h2').length,
          h3: document.querySelectorAll('h3').length,
          h4: document.querySelectorAll('h4').length,
          h5: document.querySelectorAll('h5').length,
          h6: document.querySelectorAll('h6').length
        }
      };
    },

    // Extract main content from page
    extractMainContent() {
      // Try common content selectors
      const contentSelectors = [
        'main',
        'article',
        '.main-content',
        '.content',
        '#content',
        '.post-content',
        '.entry-content',
        '[role="main"]'
      ];
      
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element.textContent.trim();
        }
      }
      
      // Fallback to body content
      return document.body.textContent.trim();
    }
  };

  // Token estimation utilities
  window.promptExpanderTokens = {
    // Rough token estimation for different models
    estimate(text, model = 'gpt') {
      if (!text) return 0;
      
      // Different models have different tokenization
      const multipliers = {
        'gpt': 4, // ~4 characters per token for GPT models
        'claude': 4.2, // Slightly different tokenization
        'llama': 3.8,
        'generic': 4
      };
      
      const multiplier = multipliers[model] || multipliers.generic;
      return Math.ceil(text.length / multiplier);
    },

    // More accurate estimation considering punctuation and special tokens
    estimateAccurate(text, model = 'gpt') {
      if (!text) return 0;
      
      // Count words, punctuation, and special characters
      const words = text.split(/\s+/).length;
      const punctuation = (text.match(/[.,!?;:'"()\[\]{}<>]/g) || []).length;
      const numbers = (text.match(/\d+/g) || []).length;
      const specialChars = (text.match(/[^\w\s.,!?;:'"()\[\]{}<>]/g) || []).length;
      
      // Base estimation
      let tokens = Math.ceil(words * 0.75); // Most words are less than 1 token
      
      // Add tokens for punctuation and special characters
      tokens += Math.ceil(punctuation * 0.3);
      tokens += Math.ceil(numbers * 0.5);
      tokens += Math.ceil(specialChars * 0.8);
      
      // Model-specific adjustments
      const adjustments = {
        'gpt': 1.0,
        'claude': 1.1,
        'llama': 0.9,
        'generic': 1.0
      };
      
      return Math.ceil(tokens * (adjustments[model] || 1.0));
    },

    // Check if text exceeds token limits
    checkLimits(text, model = 'gpt') {
      const tokens = this.estimateAccurate(text, model);
      
      const limits = {
        'gpt': 4096,
        'gpt-4': 8192,
        'claude': 9000,
        'claude-instant': 9000,
        'generic': 4000
      };
      
      const limit = limits[model] || limits.generic;
      
      return {
        tokens,
        limit,
        percentage: (tokens / limit) * 100,
        withinLimit: tokens <= limit,
        remaining: limit - tokens
      };
    }
  };

  // Performance monitoring
  window.promptExpanderPerf = {
    // Track expansion performance
    trackExpansion(startTime, trigger, contentLength) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`PromptExpander: Expanded "${trigger}" in ${duration.toFixed(2)}ms (${contentLength} chars)`);
      
      // Store performance data (could be sent to analytics)
      if (!window.promptExpanderPerfData) {
        window.promptExpanderPerfData = [];
      }
      
      window.promptExpanderPerfData.push({
        timestamp: Date.now(),
        trigger,
        duration,
        contentLength,
        url: window.location.href
      });
      
      // Keep only last 100 entries
      if (window.promptExpanderPerfData.length > 100) {
        window.promptExpanderPerfData.shift();
      }
    },

    // Get performance statistics
    getStats() {
      if (!window.promptExpanderPerfData || window.promptExpanderPerfData.length === 0) {
        return null;
      }
      
      const data = window.promptExpanderPerfData;
      const durations = data.map(d => d.duration);
      
      return {
        totalExpansions: data.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        last24Hours: data.filter(d => Date.now() - d.timestamp < 24 * 60 * 60 * 1000).length
      };
    }
  };

  // Enhanced DOM manipulation
  window.promptExpanderDOM = {
    // Find the best insertion point for text
    findInsertionPoint() {
      // Check for active/focused element first
      const active = document.activeElement;
      if (window.promptExpanderForms.isEditableField(active)) {
        return active;
      }
      
      // Look for common AI chat input patterns
      const aiInputSelectors = [
        'textarea[placeholder*="message"]',
        'textarea[placeholder*="ask"]',
        'textarea[placeholder*="chat"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea[data-id*="root"]', // ChatGPT specific
        '.ProseMirror', // Some rich text editors
        '[data-slate-editor="true"]' // Slate editors
      ];
      
      for (const selector of aiInputSelectors) {
        const element = document.querySelector(selector);
        if (element && this.isVisible(element)) {
          return element;
        }
      }
      
      // Fallback to any visible text input
      const textInputs = document.querySelectorAll('textarea, input[type="text"]');
      for (const input of textInputs) {
        if (this.isVisible(input)) {
          return input;
        }
      }
      
      return null;
    },

    // Check if element is visible
    isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return rect.width > 0 && 
             rect.height > 0 && 
             style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0';
    },

    // Smart text insertion that handles different element types
    smartInsert(element, text, options = {}) {
      if (!element) return false;
      
      const { 
        replaceSelection = false, 
        cursorPosition = 'end',
        triggerEvents = true 
      } = options;
      
      try {
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
          return this.insertIntoInput(element, text, replaceSelection, cursorPosition, triggerEvents);
        } else if (element.contentEditable === 'true') {
          return this.insertIntoContentEditable(element, text, replaceSelection, triggerEvents);
        }
      } catch (error) {
        console.error('PromptExpander: Smart insert failed:', error);
        return false;
      }
      
      return false;
    },

    // Insert into input/textarea elements
    insertIntoInput(element, text, replaceSelection, cursorPosition, triggerEvents) {
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const currentValue = element.value || '';
      
      let newValue;
      let newCursorPos;
      
      if (replaceSelection && start !== end) {
        // Replace selected text
        newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
        newCursorPos = start + text.length;
      } else {
        // Insert at cursor position
        newValue = currentValue.substring(0, start) + text + currentValue.substring(start);
        newCursorPos = cursorPosition === 'start' ? start : start + text.length;
      }
      
      element.value = newValue;
      element.setSelectionRange(newCursorPos, newCursorPos);
      
      if (triggerEvents) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      return true;
    },

    // Insert into contenteditable elements
    insertIntoContentEditable(element, text, replaceSelection, triggerEvents) {
      element.focus();
      
      const selection = window.getSelection();
      let range;
      
      if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      } else {
        range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
      }
      
      if (replaceSelection && !selection.isCollapsed) {
        range.deleteContents();
      }
      
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      
      // Move cursor after inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      
      if (triggerEvents) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      return true;
    }
  };

  // Communication bridge with content script
  window.promptExpanderBridge = {
    // Send data to content script
    sendToContentScript(data) {
      window.postMessage({
        type: 'PROMPT_EXPANDER_INJECTED',
        data: data
      }, '*');
    },

    // Listen for messages from content script
    onMessage(callback) {
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.data.type === 'PROMPT_EXPANDER_CONTENT') {
          callback(event.data.data);
        }
      });
    }
  };

  // Initialize bridge communication
  window.promptExpanderBridge.onMessage((data) => {
    switch (data.action) {
      case 'getClipboard':
        window.promptExpanderClipboard.read().then(text => {
          window.promptExpanderBridge.sendToContentScript({
            action: 'clipboardResult',
            text: text
          });
        });
        break;
        
      case 'analyzeToken':
        const analysis = window.promptExpanderTokens.checkLimits(data.text, data.model);
        window.promptExpanderBridge.sendToContentScript({
          action: 'tokenAnalysis',
          analysis: analysis
        });
        break;
        
      case 'findInsertionPoint':
        const element = window.promptExpanderDOM.findInsertionPoint();
        window.promptExpanderBridge.sendToContentScript({
          action: 'insertionPoint',
          element: element ? {
            tagName: element.tagName,
            type: element.type || 'unknown',
            id: element.id,
            className: element.className,
            placeholder: element.placeholder
          } : null
        });
        break;
    }
  });

  // Notify content script that injected script is ready
  window.promptExpanderBridge.sendToContentScript({
    action: 'injectedReady',
    timestamp: Date.now()
  });

  console.log('PromptExpander injected script ready');

})();