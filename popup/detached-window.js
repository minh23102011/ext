console.log("[DETACHED] Standalone window initialized");

// Always-on-top state
let isPinned = false;
let currentWindowId = null;

// Get current window ID
chrome.windows.getCurrent((window) => {
  currentWindowId = window.id;
  console.log("[DETACHED] Window ID:", currentWindowId);
});

// Pin button functionality
const pinBtn = document.getElementById('pinBtn');

pinBtn.addEventListener('click', () => {
  isPinned = !isPinned;
  
  if (isPinned) {
    pinBtn.classList.add('pinned');
    pinBtn.title = 'Unpin window';
    
    // Update window to always on top (requires sending message to background)
    chrome.runtime.sendMessage({
      type: 'SET_ALWAYS_ON_TOP',
      windowId: currentWindowId,
      alwaysOnTop: true
    });
    
    // Show notice
    showNotice('Window pinned on top');
  } else {
    pinBtn.classList.remove('pinned');
    pinBtn.title = 'Always on top';
    
    chrome.runtime.sendMessage({
      type: 'SET_ALWAYS_ON_TOP',
      windowId: currentWindowId,
      alwaysOnTop: false
    });
    
    showNotice('Window unpinned');
  }
});

function showNotice(message) {
  const notice = document.createElement('div');
  notice.className = 'always-on-top-notice';
  notice.textContent = message;
  document.body.appendChild(notice);
  
  setTimeout(() => {
    notice.remove();
  }, 2000);
}

// Make header draggable (visual feedback only, actual drag handled by browser)
const dragHandle = document.getElementById('dragHandle');
dragHandle.addEventListener('mousedown', () => {
  dragHandle.style.cursor = 'grabbing';
});

dragHandle.addEventListener('mouseup', () => {
  dragHandle.style.cursor = 'move';
});

console.log("[DETACHED] Always-on-top functionality ready");