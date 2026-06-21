let currentOpacity = "1.0";

// Initial State
let config = {
    color: "#007bff",
    opacity: "1.0",
    autoMode: false
};

// Load saved settings on popup open
chrome.storage.local.get(['lastConfig'], (res) => {
    if (res.lastConfig) {
        config = res.lastConfig;
        document.getElementById('autoModeToggle').checked = config.autoMode;
        updateOpacityUI(config.opacity === "1.0" ? 'defaultOpacity' : 'lowOpacity');
    }
});

// Auto-Mode Toggle Listener
document.getElementById('autoModeToggle').addEventListener('change', (e) => {
    config.autoMode = e.target.checked;
    saveConfig();
});

// Opacity Listeners
document.getElementById('lowOpacity').addEventListener('click', () => {
    config.opacity = "0.4";
    updateOpacityUI('lowOpacity');
    saveConfig();
});

document.getElementById('defaultOpacity').addEventListener('click', () => {
    config.opacity = "1.0";
    updateOpacityUI('defaultOpacity');
    saveConfig();
});

// Color Button Listeners
document.querySelectorAll('.color-btn').forEach(button => {
    button.addEventListener('click', () => {
        config.color = button.getAttribute('data-color');
        saveConfig();
        // Trigger manual highlight
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "applyHighlight",
                color: config.color,
                opacity: config.opacity
            });
        });
    });
});

function saveConfig() {
    chrome.storage.local.set({ lastConfig: config });
}

// Handle Opacity Toggles
// document.getElementById('lowOpacity').addEventListener('click', () => {
//   currentOpacity = "0.4";
//   updateOpacityUI('lowOpacity');
// });

// document.getElementById('defaultOpacity').addEventListener('click', () => {
//   currentOpacity = "1.0";
//   updateOpacityUI('defaultOpacity');
// });

function updateOpacityUI(activeId) {
  document.querySelectorAll('.opacity-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(activeId).classList.add('active');
}

// Handle Color Clicks
document.querySelectorAll('.color-btn').forEach(button => {
  button.addEventListener('click', () => {
    const color = button.getAttribute('data-color');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "applyHighlight",
        color: color,
        opacity: currentOpacity
      });
    });
  });
});

// Action Buttons
document.getElementById('clearSelection').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "clearSelection" });
  });
});

document.getElementById('clear').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "clearHighlights" });
  });
});