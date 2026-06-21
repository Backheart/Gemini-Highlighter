let config = { color: "#007bff", opacity: "1.0", autoMode: false };

// Load saved settings
chrome.storage.local.get(['lastConfig'], (res) => {
    if (res.lastConfig) {
        config = res.lastConfig;
        document.getElementById('autoModeToggle').checked = config.autoMode;
        updateOpacityUI(config.opacity === "1.0" ? 'defaultOpacity' : 'lowOpacity');
    }
});

// Auto-Mode Toggle
document.getElementById('autoModeToggle').addEventListener('change', (e) => {
    config.autoMode = e.target.checked;
    chrome.storage.local.set({ lastConfig: config });
});

// Opacity
document.getElementById('lowOpacity').addEventListener('click', () => {
    config.opacity = "0.4"; updateOpacityUI('lowOpacity'); chrome.storage.local.set({ lastConfig: config });
});
document.getElementById('defaultOpacity').addEventListener('click', () => {
    config.opacity = "1.0"; updateOpacityUI('defaultOpacity'); chrome.storage.local.set({ lastConfig: config });
});

function updateOpacityUI(activeId) {
    document.querySelectorAll('.opacity-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

// Apply Color Click
document.querySelectorAll('.color-btn').forEach(button => {
    button.addEventListener('click', () => {
        config.color = button.getAttribute('data-color');
        chrome.storage.local.set({ lastConfig: config });
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "applyHighlight", color: config.color, opacity: config.opacity });
        });
    });
});

// Clear Actions
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

// PRO FEATURE: Export Highlights to Clipboard
document.getElementById('exportBtn').addEventListener('click', () => {
    const btn = document.getElementById('exportBtn');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "exportHighlights" }, (response) => {
            if (response && response.data) {
                navigator.clipboard.writeText(response.data).then(() => {
                    btn.innerText = "✅ Copied!";
                    setTimeout(() => btn.innerText = "📋 Export Highlights", 2000);
                });
            } else {
                btn.innerText = "❌ Nothing to export";
                setTimeout(() => btn.innerText = "📋 Export Highlights", 2000);
            }
        });
    });
});