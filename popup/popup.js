console.log("[POPUP] Chess Monitor Popup initialized");

// State
let logs = [];
let settings = {
  backendUrl: "http://127.0.0.1:8765/fen",
  maxLogs: 50,
  showDebugInfo: false
};

// DOM Elements
const logsContainer = document.getElementById('logsContainer');
const currentMode = document.getElementById('currentMode');
const moveCount = document.getElementById('moveCount');
const backendStatus = document.getElementById('backendStatus');
const autoScrollCheckbox = document.getElementById('autoScrollCheckbox');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const refreshBtn = document.getElementById('refreshBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const backendUrlInput = document.getElementById('backendUrl');
const maxLogsInput = document.getElementById('maxLogs');
const showDebugInfoCheckbox = document.getElementById('showDebugInfo');

// Load settings
function loadSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
      settings = { ...settings, ...result.settings };
      updateSettingsUI();
    }
  });
}

function updateSettingsUI() {
  backendUrlInput.value = settings.backendUrl;
  maxLogsInput.value = settings.maxLogs;
  showDebugInfoCheckbox.checked = settings.showDebugInfo;
}

function saveSettings() {
  settings.backendUrl = backendUrlInput.value;
  settings.maxLogs = parseInt(maxLogsInput.value) || 50;
  settings.showDebugInfo = showDebugInfoCheckbox.checked;
  
  chrome.storage.local.set({ settings }, () => {
    console.log("[POPUP] Settings saved:", settings);
    settingsPanel.classList.add('hidden');
    
    // Notify background script
    chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      settings
    });
  });
}

// Load saved logs
function loadLogs() {
  chrome.storage.local.get(['logs'], (result) => {
    if (result.logs) {
      logs = result.logs;
      renderLogs();
      updateStats();
    }
  });
}

function saveLogs() {
  // Keep only maxLogs entries
  if (settings.maxLogs > 0 && logs.length > settings.maxLogs) {
    logs = logs.slice(-settings.maxLogs);
  }
  
  chrome.storage.local.set({ logs });
}

// Format time
function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';
  
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Render single log entry
function createLogEntry(log, index) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  const moveNum = log.move_count || index + 1;
  const moveNotation = log.move || '?';
  const turnColor = log.turn_to_move === 'WHITE' ? '⚪' : '⚫';
  const turnText = log.turn_to_move || 'UNKNOWN';
  const statusIcon = log.backend_status === 'success' ? '✓' : '✗';
  const statusClass = log.backend_status === 'success' ? 'status-success' : 'status-failed';
  
  entry.innerHTML = `
    <div class="log-header">
      <div class="log-move">
        <span class="move-number">Move #${moveNum}</span>
        <span class="move-notation">${moveNotation}</span>
      </div>
      <div class="turn-indicator">
        <span>Now:</span>
        <span class="turn-color">${turnColor}</span>
        <span>${turnText}'s turn</span>
      </div>
    </div>
    <div class="log-body">
      <div class="log-field">
        <span class="field-label">FEN Before:</span>
        <span class="field-value fen-value">${truncateFen(log.fen_before || 'N/A')}</span>
      </div>
      <div class="log-field">
        <span class="field-label">FEN After:</span>
        <span class="field-value fen-value">${truncateFen(log.fen_after || 'N/A')}</span>
      </div>
      ${log.move_list && log.move_list.length > 0 ? `
        <div class="separator"></div>
        <div class="log-field">
          <span class="field-label">Move List:</span>
          <span class="field-value">${log.move_list.join(', ')}</span>
        </div>
      ` : ''}
      ${log.white_time !== null || log.black_time !== null ? `
        <div class="separator"></div>
        <div class="log-field">
          <span class="field-label">Time:</span>
          <div class="field-value time-value">
            <span class="time-player">⚪ ${formatTime(log.white_time)}</span>
            <span class="time-player">⚫ ${formatTime(log.black_time)}</span>
          </div>
        </div>
      ` : ''}
      ${log.your_color ? `
        <div class="log-field">
          <span class="field-label">Your Color:</span>
          <span class="field-value">${log.your_color === 'WHITE' ? '⚪ WHITE' : '⚫ BLACK'}</span>
        </div>
      ` : ''}
      ${log.mode ? `
        <div class="log-field">
          <span class="field-label">Mode:</span>
          <span class="field-value">${log.mode === 'playing' ? '♟️ Playing' : '👁️ Spectating'}</span>
        </div>
      ` : ''}
      <div class="separator"></div>
      <div class="log-field">
        <span class="field-label">Status:</span>
        <div class="field-value log-status">
          <span class="source-badge">${log.source || 'UNKNOWN'}</span>
          <span class="status-icon ${statusClass}">${statusIcon}</span>
        </div>
      </div>
      ${settings.showDebugInfo && log.ts ? `
        <div class="log-field">
          <span class="field-label">Timestamp:</span>
          <span class="field-value">${new Date(log.ts).toLocaleTimeString()}</span>
        </div>
      ` : ''}
    </div>
  `;
  
  return entry;
}

function truncateFen(fen) {
  if (!fen || fen === 'N/A') return fen;
  // Show first part of FEN (board position)
  const parts = fen.split(' ');
  return parts[0] + ' ' + (parts[1] || '');
}

// Render all logs
function renderLogs() {
  // Remove empty state
  const emptyState = logsContainer.querySelector('.empty-state');
  if (logs.length > 0 && emptyState) {
    emptyState.remove();
  }
  
  // Clear existing logs
  const existingLogs = logsContainer.querySelectorAll('.log-entry');
  existingLogs.forEach(log => log.remove());
  
  // Show empty state if no logs
  if (logs.length === 0) {
    if (!emptyState) {
      logsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">♟️</div>
          <div class="empty-text">No logs yet</div>
          <div class="empty-hint">Play or watch a game on Chess.com</div>
        </div>
      `;
    }
    return;
  }
  
  // Render logs
  logs.forEach((log, index) => {
    const entry = createLogEntry(log, index);
    logsContainer.appendChild(entry);
  });
  
  // Auto-scroll to bottom
  if (autoScrollCheckbox.checked) {
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }
}

// Update stats
function updateStats() {
  moveCount.textContent = logs.length;
  
  if (logs.length > 0) {
    const lastLog = logs[logs.length - 1];
    currentMode.textContent = lastLog.mode === 'playing' ? '♟️ Playing' : 
                              lastLog.mode === 'spectating' ? '👁️ Spectating' : '-';
    
    const statusClass = lastLog.backend_status === 'success' ? 'status-success' : 'status-failed';
    backendStatus.className = `stat-value ${statusClass}`;
    backendStatus.textContent = lastLog.backend_status === 'success' ? '● Online' : '● Offline';
  }
}

// Add new log
function addLog(logData) {
  logs.push(logData);
  saveLogs();
  renderLogs();
  updateStats();
}

// Clear logs
function clearLogs() {
  if (confirm('Clear all logs?')) {
    logs = [];
    chrome.storage.local.set({ logs: [] });
    renderLogs();
    updateStats();
  }
}

// Export logs
function exportLogs() {
  if (logs.length === 0) {
    alert('No logs to export');
    return;
  }
  
  const dataStr = JSON.stringify(logs, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `chess-logs-${timestamp}.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
  console.log("[POPUP] Exported", logs.length, "logs");
}

// Event Listeners
const detachBtn = document.getElementById('detachBtn');

// Open detached window
if (detachBtn) {
  detachBtn.addEventListener('click', () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/detached.html'),
      type: 'popup',
      width: 500,
      height: 700,
      focused: true
    });
  });
}

clearBtn.addEventListener('click', clearLogs);
exportBtn.addEventListener('click', exportLogs);
refreshBtn.addEventListener('click', () => {
  loadLogs();
  loadSettings();
});

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', saveSettings);

// Listen for new logs from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'FEN_LOG') {
    console.log("[POPUP] Received log:", msg.payload);
    addLog(msg.payload);
  }
});

// Initialize
loadSettings();
loadLogs();

// Poll storage for new logs every 500ms
let lastLogCount = 0;
setInterval(() => {
  chrome.storage.local.get(['logs'], (result) => {
    if (result.logs && result.logs.length > lastLogCount) {
      console.log("[POPUP] 💾 New logs in storage:", result.logs.length - lastLogCount);
      
      // Add only new logs
      const newLogs = result.logs.slice(lastLogCount);
      newLogs.forEach(log => {
        // Check if log already exists (by timestamp)
        const exists = logs.find(l => l.ts === log.ts);
        if (!exists) {
          addLog(log);
        }
      });
      
      lastLogCount = result.logs.length;
    }
  });
}, 500);

console.log("[POPUP] Popup ready");
console.log("[POPUP] 💾 Polling storage for logs every 500ms");