let config = { color: "#ffc107", opacity: "1.0", autoMode: false, pinSidebar: false, showMinimap: true, strikethrough: false, glassTheme: true };

function updateUI() {
    document.getElementById('autoModeToggle').checked = config.autoMode;
    document.getElementById('pinSidebarToggle').checked = config.pinSidebar;
    document.getElementById('minimapToggle').checked = config.showMinimap;
    document.getElementById('glassToggle').checked = config.glassTheme;
    
    document.querySelectorAll('.opacity-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(config.opacity === "1.0" ? 'defaultOpacity' : 'lowOpacity').classList.add('active');
    
    const stBtn = document.getElementById('strikethroughToggleBtn');
    if (config.strikethrough) {
        stBtn.innerHTML = '<s>Strikethrough Mode: ON</s>';
        stBtn.style.background = '#4a90e2'; stBtn.style.borderColor = '#ffffff';
    } else {
        stBtn.innerHTML = '<s>Strikethrough Mode: OFF</s>';
        stBtn.style.background = 'var(--card)'; stBtn.style.borderColor = '#555';
    }

    let isCustomColor = true;
    document.querySelectorAll('.preset-color').forEach(btn => {
        const isMatch = btn.getAttribute('data-color') === config.color;
        btn.classList.toggle('active-color', isMatch);
        if (isMatch) isCustomColor = false;
    });

    const picker = document.getElementById('customColorPicker');
    if (isCustomColor && config.color !== 'transparent') {
        picker.value = config.color;
        picker.classList.add('active-picker');
    } else {
        picker.classList.remove('active-picker');
    }
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
document.getElementById('glassToggle').addEventListener('change', (e) => { config.glassTheme = e.target.checked; saveConfig(); });

document.getElementById('lowOpacity').addEventListener('click', () => { config.opacity = "0.4"; saveConfig(); });
document.getElementById('defaultOpacity').addEventListener('click', () => { config.opacity = "1.0"; saveConfig(); });
document.getElementById('strikethroughToggleBtn').addEventListener('click', () => { config.strikethrough = !config.strikethrough; saveConfig(); });

document.querySelectorAll('.preset-color').forEach(button => {
    button.addEventListener('click', () => {
        config.color = button.getAttribute('data-color'); saveConfig(); triggerManualHighlight();
    });
});

// Auto-apply custom color when picker window closes
document.getElementById('customColorPicker').addEventListener('change', (e) => {
    config.color = e.target.value;
    saveConfig(); 
    triggerManualHighlight();
});

function triggerManualHighlight() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "applyHighlight", color: config.color, opacity: config.opacity, strikethrough: config.strikethrough });
    });
}

document.getElementById('clearSelection').addEventListener('click', () => { chrome.tabs.query({ active: true, currentWindow: true }, tabs => chrome.tabs.sendMessage(tabs[0].id, { action: "clearSelection" })); });
document.getElementById('clear').addEventListener('click', () => { chrome.tabs.query({ active: true, currentWindow: true }, tabs => chrome.tabs.sendMessage(tabs[0].id, { action: "clearHighlights" })); });

document.getElementById('exportBtn').addEventListener('click', () => {
    const btn = document.getElementById('exportBtn');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "exportAndCopy" }, (response) => {
            if (response && response.success) { btn.innerText = "Copied!"; setTimeout(() => btn.innerText = "Export to Clipboard", 2000); } 
            else { btn.innerText = "Nothing to export"; setTimeout(() => btn.innerText = "Export to Clipboard", 2000); }
        });
    });
});