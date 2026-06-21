// Initial config structure with the new Pin setting
let config = { color: "#007bff", opacity: "1.0", autoMode: false, pinSidebar: false };

function updateUI() {
    // Toggles
    document.getElementById('autoModeToggle').checked = config.autoMode;
    document.getElementById('pinSidebarToggle').checked = config.pinSidebar;
    
    // Opacity
    document.querySelectorAll('.opacity-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(config.opacity === "1.0" ? 'defaultOpacity' : 'lowOpacity').classList.add('active');
    
    // Active Color Border
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('active-color', btn.getAttribute('data-color') === config.color);
    });
}

// Load saved settings
chrome.storage.local.get(['lastConfig'], (res) => {
    if (res.lastConfig) config = { ...config, ...res.lastConfig };
    updateUI();
});

function saveConfig() {
    chrome.storage.local.set({ lastConfig: config });
    updateUI();
}

// Event Listeners for Toggles
document.getElementById('autoModeToggle').addEventListener('change', (e) => {
    config.autoMode = e.target.checked; saveConfig();
});
document.getElementById('pinSidebarToggle').addEventListener('change', (e) => {
    config.pinSidebar = e.target.checked; saveConfig();
});

// Event Listeners for Opacity
document.getElementById('lowOpacity').addEventListener('click', () => {
    config.opacity = "0.4"; saveConfig();
});
document.getElementById('defaultOpacity').addEventListener('click', () => {
    config.opacity = "1.0"; saveConfig();
});

// Apply Color Click
document.querySelectorAll('.color-btn').forEach(button => {
    button.addEventListener('click', () => {
        config.color = button.getAttribute('data-color');
        saveConfig();
        // Send apply highlight message
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "applyHighlight", color: config.color, opacity: config.opacity });
        });
    });
});

// Clear Actions
document.getElementById('clearSelection').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => chrome.tabs.sendMessage(tabs[0].id, { action: "clearSelection" }));
});
document.getElementById('clear').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => chrome.tabs.sendMessage(tabs[0].id, { action: "clearHighlights" }));
});

// BULLETPROOF EXPORT FUNCTION
document.getElementById('exportBtn').addEventListener('click', () => {
    const btn = document.getElementById('exportBtn');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "exportHighlights" }, (response) => {
            if (response && response.data) {
                // Method 1: Modern Clipboard API
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(response.data).then(showSuccess).catch(() => fallbackCopy(response.data));
                } else {
                    fallbackCopy(response.data);
                }
            } else {
                btn.innerText = "Nothing to export";
                setTimeout(() => btn.innerText = "Export to Clipboard", 2000);
            }
        });
    });

    function showSuccess() {
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = "Export to Clipboard", 2000);
    }

    // Method 2: Old-school textarea hack (bypasses iframe permission issues)
    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showSuccess();
    }
});