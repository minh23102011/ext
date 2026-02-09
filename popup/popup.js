// popup.js - Main popup interface logic
(function() {
  'use strict';
  
  console.log('[POPUP] Initializing...');
  
  // DOM elements
  let logContainer, statsMode, statsMoves, statsBackend;
  let autoScrollCheckbox, clearBtn, exportBtn, detachBtn, settingsBtn;
  let settingsPanel, backendUrlInput, maxLogsInput, debugCheckbox, saveSettingsBtn;
  
  // State
  let logs = [];
  let autoScroll = true;
  let settings = {
    backend_url: 'http://127.0.0.1:8765/fen',
    max_logs: 100,
    show_debug: false
  };
  
  /**
   * Initialize DOM references
   */
  function initDom() {
    // Logs
    logContainer = document.getElementById('log-container');
    
    // Stats
    statsMode = document.getElementById('stats-mode');
    statsMoves = document.getElementById('stats-moves');
    statsBackend = document.getElementById('stats-backend');
    
    // Controls
    autoScrollCheckbox = document.getElementById('auto-scroll');
    clearBtn = document.getElementById('clear-logs');
    exportBtn = document.getElementById('export-logs');
    detachBtn = document.getElementById('detach-window');
    settingsBtn = document.getElementById('settings-btn');
    
    // Settings
    settingsPanel = document.getElementById('settings-panel');
    backendUrlInput = document.getElementById('backend-url');
    maxLogsInput = document.getElementById('max-logs');
    debugCheckbox = document.getElementById('debug-mode');
    saveSettingsBtn = document.getElementById('save-settings');
    
    console.log('[POPUP] DOM initialized');
  }
  
  /**
   * Setup event listeners
   */
  function setupListeners() {
    // Auto-scroll toggle
    if (autoScrollCheckbox) {
      autoScrollCheckbox.checked = autoScroll;
      autoScrollCheckbox.addEventListener('change', (e) => {
        autoScroll = e.target.checked;
        if (autoScroll) scrollToBottom();
      });
    }
    
    // Clear logs
    if (clearBtn) {
      clearBtn.addEventListener('click', clearLogs);
    }
    
    // Export logs
    if (exportBtn) {
      exportBtn.addEventListener('click', exportLogs);
    }
    
    // Detach window
    if (detachBtn) {
      detachBtn.addEventListener('click', openDetachedWindow);
    }
    
    // Settings toggle
    if (settingsBtn) {
      settingsBtn.addEventListener('click', toggleSettings);
    }
    
    // Save settings
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    // Listen for new logs from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'NEW_LOG') {
        console.log('[POPUP] New log received:', message.payload);
        addLog(message.payload);
        sendResponse({ success: true });
      }
      return true;
    });
    
    console.log('[POPUP] Listeners setup');
  }
  
  /**
   * Load settings from storage
   */
  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get(['backend_url', 'max_logs', 'show_debug']);
      
      settings.backend_url = result.backend_url || settings.backend_url;
      settings.max_logs = result.max_logs || settings.max_logs;
      settings.show_debug = result.show_debug || settings.show_debug;
      
      // Update UI
      if (backendUrlInput) backendUrlInput.value = settings.backend_url;
      if (maxLogsInput) maxLogsInput.value = settings.max_logs;
      if (debugCheckbox) debugCheckbox.checked = settings.show_debug;
      
      console.log('[POPUP] Settings loaded:', settings);
    } catch (error) {
      console.error('[POPUP] Error loading settings:', error);
    }
  }
  
  /**
   * Load logs from storage
   */
  async function loadLogs() {
    try {
      const result = await chrome.storage.local.get(['chess_fen_logs']);
      logs = result.chess_fen_logs || [];
      
      console.log('[POPUP] Loaded', logs.length, 'logs from storage');
      
      // Render all logs
      renderAllLogs();
      
      // Update stats
      updateStats();
      
    } catch (error) {
      console.error('[POPUP] Error loading logs:', error);
      showMessage('Error loading logs: ' + error.message, 'error');
    }
  }
  
  /**
   * Render all logs
   */
  function renderAllLogs() {
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    
    if (logs.length === 0) {
      showMessage('Waiting for game data...', 'info');
      return;
    }
    
    logs.forEach(log => {
      const logElement = createLogElement(log);
      logContainer.appendChild(logElement);
    });
    
    if (autoScroll) {
      scrollToBottom();
    }
  }
  
  /**
   * Add a new log entry
   */
  function addLog(logData) {
    logs.push(logData);
    
    // Trim to max logs
    if (logs.length > settings.max_logs) {
      logs = logs.slice(-settings.max_logs);
      renderAllLogs(); // Re-render if trimmed
    } else {
      // Just append new log
      const logElement = createLogElement(logData);
      logContainer.appendChild(logElement);
      
      if (autoScroll) {
        scrollToBottom();
      }
    }
    
    updateStats();
  }
  
  /**
   * Create log element
   */
  function createLogElement(log) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    
    // Header
    const header = document.createElement('div');
    header.className = 'log-header';
    
    const moveInfo = `Move #${log.move_count} | ${log.move || 'N/A'}`;
    const turnInfo = `Now: ${log.turn_to_move === 'WHITE' ? '⚪ WHITE' : '⚫ BLACK'}`;
    
    header.innerHTML = `
      <span class="log-move">${moveInfo}</span>
      <span class="log-turn">${turnInfo}</span>
    `;
    
    // Body
    const body = document.createElement('div');
    body.className = 'log-body';
    
    let bodyHtml = `
      <div class="log-row">
        <span class="log-label">FEN Before:</span>
        <span class="log-value">${truncate(log.fen_before, 60)}</span>
      </div>
      <div class="log-row">
        <span class="log-label">FEN After:</span>
        <span class="log-value">${truncate(log.fen_after, 60)}</span>
      </div>
      <div class="log-row">
        <span class="log-label">Move List:</span>
        <span class="log-value">${log.move_list ? log.move_list.join(', ') : 'N/A'}</span>
      </div>
      <div class="log-row">
        <span class="log-label">Time:</span>
        <span class="log-value">⚪ ${formatTime(log.white_time)} | ⚫ ${formatTime(log.black_time)} | ${log.source} | ${getBackendIcon(log.backend_status)}</span>
      </div>
    `;
    
    // Debug info (if enabled)
    if (settings.show_debug) {
      bodyHtml += `
        <div class="log-row log-debug">
          <span class="log-label">Mode:</span>
          <span class="log-value">${log.mode} ${log.your_color ? '(You: ' + log.your_color + ')' : ''}</span>
        </div>
        <div class="log-row log-debug">
          <span class="log-label">Timestamp:</span>
          <span class="log-value">${new Date(log.ts).toLocaleTimeString()}</span>
        </div>
      `;
    }
    
    body.innerHTML = bodyHtml;
    
    div.appendChild(header);
    div.appendChild(body);
    
    return div;
  }
  
  /**
   * Update stats bar
   */
  function updateStats() {
    if (!logs || logs.length === 0) {
      if (statsMode) statsMode.textContent = '-';
      if (statsMoves) statsMoves.textContent = '0';
      if (statsBackend) statsBackend.className = 'status-dot';
      return;
    }
    
    const latest = logs[logs.length - 1];
    
    if (statsMode) {
      statsMode.textContent = latest.mode || 'spectating';
    }
    
    if (statsMoves) {
      statsMoves.textContent = latest.move_count || 0;
    }
    
    if (statsBackend) {
      statsBackend.className = 'status-dot ' + 
        (latest.backend_status === 'success' ? 'status-success' : 
         latest.backend_status === 'error' ? 'status-error' : 
         'status-unknown');
    }
  }
  
  /**
   * Clear all logs
   */
  async function clearLogs() {
    if (!confirm('Clear all logs?')) return;
    
    try {
      // Clear in background
      const response = await chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' });
      
      if (response.success) {
        logs = [];
        renderAllLogs();
        updateStats();
        showMessage('Logs cleared', 'success');
      } else {
        showMessage('Failed to clear logs', 'error');
      }
    } catch (error) {
      console.error('[POPUP] Error clearing logs:', error);
      showMessage('Error: ' + error.message, 'error');
    }
  }
  
  /**
   * Export logs as JSON
   */
  function exportLogs() {
    if (logs.length === 0) {
      showMessage('No logs to export', 'warning');
      return;
    }
    
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess_logs_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('Logs exported', 'success');
  }
  
  /**
   * Open detached window
   */
  async function openDetachedWindow() {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'OPEN_DETACHED_WINDOW' 
      });
      
      if (response.success) {
        console.log('[POPUP] Detached window opened');
      } else {
        showMessage('Failed to open detached window', 'error');
      }
    } catch (error) {
      console.error('[POPUP] Error opening detached window:', error);
      showMessage('Error: ' + error.message, 'error');
    }
  }
  
  /**
   * Toggle settings panel
   */
  function toggleSettings() {
    if (!settingsPanel) return;
    
    if (settingsPanel.style.display === 'none' || !settingsPanel.style.display) {
      settingsPanel.style.display = 'block';
    } else {
      settingsPanel.style.display = 'none';
    }
  }
  
  /**
   * Save settings
   */
  async function saveSettings() {
    try {
      const newSettings = {
        backend_url: backendUrlInput.value.trim(),
        max_logs: parseInt(maxLogsInput.value, 10),
        show_debug: debugCheckbox.checked
      };
      
      // Validate
      if (!newSettings.backend_url) {
        showMessage('Backend URL cannot be empty', 'error');
        return;
      }
      
      if (newSettings.max_logs < 10 || newSettings.max_logs > 1000) {
        showMessage('Max logs must be between 10 and 1000', 'error');
        return;
      }
      
      // Save to storage
      await chrome.storage.local.set(newSettings);
      
      // Update local settings
      settings = newSettings;
      
      // Re-render if debug mode changed
      renderAllLogs();
      
      showMessage('Settings saved', 'success');
      
      // Hide panel
      settingsPanel.style.display = 'none';
      
    } catch (error) {
      console.error('[POPUP] Error saving settings:', error);
      showMessage('Error: ' + error.message, 'error');
    }
  }
  
  /**
   * Show temporary message
   */
  function showMessage(text, type = 'info') {
    if (!logContainer) return;
    
    const msg = document.createElement('div');
    msg.className = `log-message log-message-${type}`;
    msg.textContent = text;
    
    logContainer.innerHTML = '';
    logContainer.appendChild(msg);
  }
  
  /**
   * Scroll to bottom
   */
  function scrollToBottom() {
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }
  
  /**
   * Helper: Truncate string
   */
  function truncate(str, length) {
    if (!str) return 'N/A';
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  }
  
  /**
   * Helper: Format time
   */
  function formatTime(seconds) {
    if (seconds === null || seconds === undefined) return 'N/A';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Helper: Get backend status icon
   */
  function getBackendIcon(status) {
    if (status === 'success') return '✓';
    if (status === 'error') return '✗';
    return '?';
  }
  
  /**
   * Initialize popup
   */
  async function init() {
    try {
      initDom();
      setupListeners();
      await loadSettings();
      await loadLogs();
      
      console.log('[POPUP] Initialized successfully');
      
      // Request latest data from background
      try {
        const response = await chrome.runtime.sendMessage({ 
          action: 'GET_LATEST_DATA' 
        });
        
        if (response.success && response.data) {
          console.log('[POPUP] Got latest data from background');
          // Data is already in storage, just loaded
        }
      } catch (error) {
        console.log('[POPUP] No latest data available (this is normal on first load)');
      }
      
    } catch (error) {
      console.error('[POPUP] Initialization error:', error);
      showMessage('Initialization error: ' + error.message, 'error');
    }
  }
  
  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();