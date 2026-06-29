// Added showMinimap to config (default true)
let config = { color: "#ffc107", opacity: "1.0", autoMode: false, pinSidebar: false, showMinimap: true };

function updateUI() {
    document.getElementById('autoModeToggle').checked = config.autoMode;
    document.getElementById('pinSidebarToggle').checked = config.pinSidebar;
    document.getElementById('minimapToggle').checked = config.showMinimap;
    
    document.querySelectorAll('.opacity-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(config.opacity === "1.0" ? 'defaultOpacity' : 'lowOpacity').classList.add('active');
    
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('active-color', btn.getAttribute('data-color') === config.color);
    });
}

chrome.storage.local.get(['lastConfig'], (res) => {
    if (res.lastConfig) config = { ...config, ...res.lastConfig };
    updateUI();
});

function saveConfig() {
    chrome.storage.local.set({ lastConfig: config });
    updateUI();
}

document.getElementById('autoModeToggle').addEventListener('change', (e) => { config.autoMode = e.target.checked; saveConfig(); });
document.getElementById('pinSidebarToggle').addEventListener('change', (e) => { config.pinSidebar = e.target.checked; saveConfig(); });
document.getElementById('minimapToggle').addEventListener('change', (e) => { config.showMinimap = e.target.checked; saveConfig(); });

document.getElementById('lowOpacity').addEventListener('click', () => { config.opacity = "0.4"; saveConfig(); });
document.getElementById('defaultOpacity').addEventListener('click', () => { config.opacity = "1.0"; saveConfig(); });

document.querySelectorAll('.color-btn').forEach(button => {
    button.addEventListener('click', () => {
        config.color = button.getAttribute('data-color');
        saveConfig();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "applyHighlight", color: config.color, opacity: config.opacity });
        });
    });
});

document.getElementById('clearSelection').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => chrome.tabs.sendMessage(tabs[0].id, { action: "clearSelection" }));
});
document.getElementById('clear').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => chrome.tabs.sendMessage(tabs[0].id, { action: "clearHighlights" }));
});

document.getElementById('exportBtn').addEventListener('click', () => {
    const btn = document.getElementById('exportBtn');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "exportAndCopy" }, (response) => {
            if (response && response.success) {
                btn.innerText = "Copied!"; setTimeout(() => btn.innerText = "Export to Clipboard", 2000);
            } else {
                btn.innerText = "Nothing to export"; setTimeout(() => btn.innerText = "Export to Clipboard", 2000);
            }
        });
    });
});