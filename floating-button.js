console.log("[FLOAT] Floating button injected");

// Create floating button
const floatBtn = document.createElement('div');
floatBtn.id = 'chess-monitor-float-btn';
floatBtn.innerHTML = '♟️';
floatBtn.title = 'Open Chess Monitor';

// Add styles
const style = document.createElement('style');
style.textContent = `
  #chess-monitor-float-btn {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 999999;
    transition: all 0.3s ease;
    user-select: none;
  }
  
  #chess-monitor-float-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5);
  }
  
  #chess-monitor-float-btn:active {
    transform: scale(0.95);
  }
  
  #chess-monitor-float-btn.dragging {
    cursor: move;
    opacity: 0.8;
  }
`;

document.head.appendChild(style);
document.body.appendChild(floatBtn);

// Make draggable
let isDragging = false;
let offsetX = 0;
let offsetY = 0;

floatBtn.addEventListener('mousedown', (e) => {
  isDragging = true;
  offsetX = e.clientX - floatBtn.offsetLeft;
  offsetY = e.clientY - floatBtn.offsetTop;
  floatBtn.classList.add('dragging');
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  const x = e.clientX - offsetX;
  const y = e.clientY - offsetY;
  
  floatBtn.style.left = x + 'px';
  floatBtn.style.top = y + 'px';
  floatBtn.style.right = 'auto';
  floatBtn.style.bottom = 'auto';
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    floatBtn.classList.remove('dragging');
  }
});

// Click to open monitor
floatBtn.addEventListener('click', (e) => {
  if (isDragging) return;
  
  chrome.runtime.sendMessage({
    type: 'OPEN_MONITOR_WINDOW'
  });
});

console.log("[FLOAT] Floating button ready");