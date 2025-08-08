// PromptExpander Content Script - Advanced text expansion for AI prompts

(() => {
  'use strict';

  // Prevent multiple injections
  if (window.promptExpanderInjected) {
    return;
  }
  window.promptExpanderInjected = true;

  console.log('PromptExpander content script loaded on:', window.location.href);

  // Configuration and state
  let config = {
    enabled: true,
    snippets: {},
    templates: {},
    excludedSelectors: [],
    triggerPrefix: ':',
    sessionStorage: {}
  };

  let expansionHistory = [];
  let currentElement = null;
  let isProcessing = false;
  let debounceTimer = null;

  // Load configuration
  loadConfig();

  // Main initialization
  function initializePromptExpander() {
    if (!config.enabled) return;
    
    setupTextExpansion();
    setupKeyboardShortcuts();
    setupQuickMenu();
    loadSessionData();
    
    console.log('PromptExpander initialized');
  }

  // Load configuration from storage
  function loadConfig() {
    chrome.runtime.sendMessage({
      type: 'GET_STORAGE',
      keys: ['enabled', 'snippets', 'templates', 'excludedSelectors', 'triggerPrefix']
    }, (response) => {
      if (response) {
        config = { ...config, ...response };
        if (config.enabled) {
          initializePromptExpander();
        }
      }
    });
  }

  // Setup text expansion listeners
  function setupTextExpansion() {
    // Debounced input listener
    document.addEventListener('input', (e) => {
      if (!shouldProcessElement(e.target)) return;
      
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleTextInput(e.target);
      }, 100);
    });

    // Key event listeners for trigger detection
    document.addEventListener('keydown', (e) => {
      if (!shouldProcessElement(e.target)) return;
      
      // Check for expansion triggers
      if (e.key === ' ' || e.key === 'Tab' || e.key === 'Enter') {
        handleTriggerKey(e);
      }
    });
  }

  // Check if element should be processed
  function shouldProcessElement(element) {
    if (!element || isProcessing) return false;
    
    // Skip non-editable elements
    if (!isEditableElement(element)) return false;
    
    // Check exclusion rules
    for (const selector of config.excludedSelectors) {
      if (element.matches && element.matches(selector)) {
        return false;
      }
    }
    
    // Skip if parent has exclusion class
    if (element.closest('.prompt-expander-exclude')) {
      return false;
    }
    
    return true;
  }

  // Check if element is editable
  function isEditableElement(element) {
    const editableTypes = ['text', 'textarea', 'email', 'search', 'url'];
    
    if (element.tagName === 'TEXTAREA') return true;
    if (element.tagName === 'INPUT' && editableTypes.includes(element.type)) return true;
    if (element.contentEditable === 'true') return true;
    if (element.isContentEditable) return true;
    
    return false;
  }

  // Handle text input for trigger detection
  function handleTextInput(element) {
    const cursorPos = element.selectionStart;
    const text = element.value || element.textContent || '';
    
    // Look for trigger patterns
    const beforeCursor = text.substring(0, cursorPos);
    const triggerMatch = beforeCursor.match(new RegExp(`${escapeRegex(config.triggerPrefix)}([\\w\\d_-]+)$`));
    
    if (triggerMatch) {
      const trigger = triggerMatch[1];
      
      // Check for form trigger
      if (trigger === 'form') {
        showFormModal(element);
        return;
      }
      
      // Check for snippet trigger
      if (config.snippets[trigger]) {
        // Don't auto-expand, wait for space/tab/enter
        currentElement = element;
      }
    }
  }

  // Handle trigger key presses
  function handleTriggerKey(e) {
    const element = e.target;
    const cursorPos = element.selectionStart;
    const text = element.value || element.textContent || '';
    const beforeCursor = text.substring(0, cursorPos);
    
    // Check for trigger at cursor position
    const triggerMatch = beforeCursor.match(new RegExp(`${escapeRegex(config.triggerPrefix)}([\\w\\d_-]+)$`));
    
    if (triggerMatch) {
      e.preventDefault();
      const trigger = triggerMatch[1];
      const triggerStart = cursorPos - triggerMatch[0].length;
      
      if (trigger === 'form') {
        // Remove trigger and show form modal
        replaceText(element, triggerStart, cursorPos, '');
        showFormModal(element);
      } else if (config.snippets[trigger]) {
        expandSnippet(element, trigger, triggerStart, cursorPos);
      }
    }
  }

  // Expand snippet
  async function expandSnippet(element, trigger, startPos, endPos) {
    isProcessing = true;
    
    const snippet = config.snippets[trigger];
    let content = snippet.content;
    
    // Get context for variable resolution
    const context = await getExpansionContext(element);
    
    // Resolve variables
    const response = await chrome.runtime.sendMessage({
      type: 'RESOLVE_VARIABLES',
      text: content,
      context: context
    });
    
    if (response) {
      content = response.resolved;
      
      // Apply template wrapping if needed
      content = applyTemplateWrapping(content, context);
      
      // Store expansion history
      const originalText = element.value || element.textContent || '';
      expansionHistory.push({
        element: element,
        originalText: originalText,
        trigger: trigger,
        startPos: startPos,
        endPos: endPos,
        expandedContent: content,
        timestamp: Date.now()
      });
      
      // Replace trigger with expanded content
      replaceText(element, startPos, endPos, content);
      
      // Track usage
      chrome.runtime.sendMessage({
        type: 'TRACK_USAGE',
        snippetKey: trigger,
        domain: window.location.hostname
      });
      
      // Show token count if significant
      if (response.tokens > 100) {
        showNotification(`Expanded to ~${response.tokens} tokens`, 'info');
      }
    }
    
    isProcessing = false;
  }

  // Get context for variable resolution
  async function getExpansionContext(element) {
    const context = {
      pageTitle: document.title,
      pageUrl: window.location.href,
      domain: window.location.hostname,
      selectedText: window.getSelection().toString(),
      formData: {}
    };
    
    // Try to get clipboard content
    try {
      const clipboardText = await navigator.clipboard.readText();
      context.clipboard = clipboardText;
    } catch (e) {
      context.clipboard = '';
    }
    
    return context;
  }

  // Apply template wrapping
  function applyTemplateWrapping(content, context) {
    // Check if content references a template
    const templateMatch = content.match(/^\[template:(\w+)\](.*)/s);
    if (templateMatch) {
      const templateName = templateMatch[1];
      const templateContent = templateMatch[2];
      const template = config.templates[templateName];
      
      if (template) {
        return `${template.pre}${templateContent}${template.post}`;
      }
    }
    
    return content;
  }

  // Replace text in element
  function replaceText(element, startPos, endPos, newText) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      const text = element.value;
      element.value = text.substring(0, startPos) + newText + text.substring(endPos);
      element.selectionStart = element.selectionEnd = startPos + newText.length;
      
      // Trigger input event
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (element.contentEditable === 'true' || element.isContentEditable) {
      // Handle contenteditable elements
      const selection = window.getSelection();
      const range = document.createRange();
      
      // Find text node and position
      const textNode = findTextNode(element, startPos);
      if (textNode) {
        range.setStart(textNode, startPos);
        range.setEnd(textNode, endPos);
        selection.removeAllRanges();
        selection.addRange(range);
        
        document.execCommand('insertText', false, newText);
      }
    }
  }

  // Find text node at position
  function findTextNode(element, position) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let currentPos = 0;
    let node;
    
    while (node = walker.nextNode()) {
      const nodeLength = node.textContent.length;
      if (currentPos + nodeLength >= position) {
        return node;
      }
      currentPos += nodeLength;
    }
    
    return null;
  }

  // Show form modal
  function showFormModal(triggerElement) {
    const modal = document.createElement('div');
    modal.className = 'prompt-expander-modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Dynamic Form</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-builder">
            <div class="form-fields" id="formFields">
              <div class="field-group">
                <label>Field Type:</label>
                <select id="fieldType">
                  <option value="text">Text Input</option>
                  <option value="textarea">Multi-line Text</option>
                  <option value="select">Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="date">Date Picker</option>
                </select>
              </div>
              <div class="field-group">
                <label>Field Label:</label>
                <input type="text" id="fieldLabel" placeholder="Enter field label">
              </div>
              <button id="addField" class="btn-primary">Add Field</button>
            </div>
            <div class="form-preview" id="formPreview">
              <h4>Form Preview:</h4>
              <div id="previewFields"></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="cancelForm">Cancel</button>
          <button class="btn-primary" id="generateForm">Generate</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup form builder logic
    setupFormBuilder(modal, triggerElement);
    
    // Focus first input
    modal.querySelector('#fieldLabel').focus();
  }

  // Setup form builder
  function setupFormBuilder(modal, triggerElement) {
    const formFields = [];
    const previewContainer = modal.querySelector('#previewFields');
    
    // Add field button
    modal.querySelector('#addField').addEventListener('click', () => {
      const type = modal.querySelector('#fieldType').value;
      const label = modal.querySelector('#fieldLabel').value.trim();
      
      if (!label) {
        showNotification('Please enter a field label', 'error');
        return;
      }
      
      const field = {
        id: `field_${Date.now()}`,
        type: type,
        label: label,
        required: true
      };
      
      formFields.push(field);
      renderFormPreview();
      
      // Clear inputs
      modal.querySelector('#fieldLabel').value = '';
    });
    
    // Render form preview
    function renderFormPreview() {
      previewContainer.innerHTML = '';
      
      formFields.forEach(field => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'preview-field';
        
        let fieldHTML = `<label>${field.label}:</label>`;
        
        switch (field.type) {
          case 'text':
            fieldHTML += `<input type="text" id="${field.id}" placeholder="Enter ${field.label.toLowerCase()}">`;
            break;
          case 'textarea':
            fieldHTML += `<textarea id="${field.id}" placeholder="Enter ${field.label.toLowerCase()}"></textarea>`;
            break;
          case 'select':
            fieldHTML += `<select id="${field.id}"><option value="">Select ${field.label.toLowerCase()}</option></select>`;
            break;
          case 'checkbox':
            fieldHTML += `<input type="checkbox" id="${field.id}"> <span>Enable ${field.label.toLowerCase()}</span>`;
            break;
          case 'date':
            fieldHTML += `<input type="date" id="${field.id}">`;
            break;
        }
        
        fieldHTML += `<button class="remove-field" data-id="${field.id}">&times;</button>`;
        fieldDiv.innerHTML = fieldHTML;
        previewContainer.appendChild(fieldDiv);
      });
    }
    
    // Remove field buttons
    previewContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-field')) {
        const fieldId = e.target.dataset.id;
        const index = formFields.findIndex(f => f.id === fieldId);
        if (index > -1) {
          formFields.splice(index, 1);
          renderFormPreview();
        }
      }
    });
    
    // Generate form
    modal.querySelector('#generateForm').addEventListener('click', () => {
      if (formFields.length === 0) {
        showNotification('Please add at least one field', 'error');
        return;
      }
      
      // Collect form data
      const formData = {};
      let isValid = true;
      
      formFields.forEach(field => {
        const element = modal.querySelector(`#${field.id}`);
        let value = '';
        
        if (field.type === 'checkbox') {
          value = element.checked ? 'yes' : 'no';
        } else {
          value = element.value.trim();
        }
        
        if (field.required && !value) {
          isValid = false;
          element.classList.add('error');
        } else {
          element.classList.remove('error');
        }
        
        formData[field.label.toLowerCase().replace(/\s+/g, '_')] = value;
      });
      
      if (!isValid) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }
      
      // Generate form output
      let output = '';
      Object.keys(formData).forEach(key => {
        output += `${key.replace(/_/g, ' ')}: ${formData[key]}\n`;
      });
      
      // Insert into original element
      insertTextAtCursor(triggerElement, output);
      
      // Close modal
      modal.remove();
      
      showNotification('Form data inserted successfully', 'success');
    });
    
    // Cancel and close buttons
    modal.querySelector('#cancelForm').addEventListener('click', () => modal.remove());
    modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
  }

  // Setup keyboard shortcuts
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Quick menu shortcut is handled by background script
      // Expansion undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey && !e.altKey) {
        if (shouldProcessElement(e.target)) {
          undoLastExpansion();
          e.preventDefault();
        }
      }
    });
  }

  // Undo last expansion
  function undoLastExpansion() {
    if (expansionHistory.length === 0) {
      showNotification('No expansions to undo', 'info');
      return;
    }
    
    const lastExpansion = expansionHistory.pop();
    const element = lastExpansion.element;
    
    // Restore original text
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = lastExpansion.originalText;
      element.selectionStart = element.selectionEnd = lastExpansion.endPos;
    } else if (element.contentEditable === 'true' || element.isContentEditable) {
      element.textContent = lastExpansion.originalText;
    }
    
    showNotification(`Undid expansion of :${lastExpansion.trigger}`, 'success');
  }