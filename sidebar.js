// Added language to config
let config = { color: "#FFC107", opacity: "1.0", autoMode: false, pinSidebar: false, showMinimap: true, strikethrough: false, glassTheme: true, lang: "en" };

// --- TRANSLATION ENGINE ---
function applyLanguage() {
    const langData = i18n[config.lang] || i18n["en"]; // Fallback to English
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (langData[key]) {
            el.innerText = langData[key];
        }
    });
    
    // Specifically handle the strikethrough button since its text changes based on state
    const stBtn = document.getElementById('strikethroughToggleBtn');
    stBtn.innerText = config.strikethrough ? langData["strike_on"] : langData["strike_off"];
}

document.getElementById('langSelector').addEventListener('change', (e) => {
    config.lang = e.target.value;
    saveConfig();
});

// --- EXISTING UI ENGINE ---
function updateUI() {
    document.getElementById('langSelector').value = config.lang;
    document.getElementById('autoModeToggle').checked = config.autoMode;
    document.getElementById('pinSidebarToggle').checked = config.pinSidebar;
    document.getElementById('minimapToggle').checked = config.showMinimap;
    document.getElementById('glassToggle').checked = config.glassTheme;
    
    document.querySelectorAll('.intensity-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(config.opacity === "1.0" ? 'defaultOpacity' : 'lowOpacity').classList.add('active');
    
    const stBtn = document.getElementById('strikethroughToggleBtn');
    if (config.strikethrough) {
        stBtn.style.background = '#4D8EFF'; stBtn.style.color = '#00285D'; stBtn.style.borderColor = 'transparent';
        stBtn.style.textDecoration = 'line-through';
    } else {
        stBtn.style.background = 'var(--card)'; stBtn.style.color = 'var(--text-muted)'; stBtn.style.borderColor = 'var(--card-border)';
        stBtn.style.textDecoration = 'none';
    }

    let isCustomColor = true;
    document.querySelectorAll('.preset-color').forEach(btn => {
        const isMatch = btn.getAttribute('data-color').toLowerCase() === config.color.toLowerCase();
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

    applyLanguage(); // Apply translations whenever UI updates
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
        config.color = button.getAttribute('data-color'); saveConfig(); 
        triggerManualHighlight(false); 
    });
});

const customPicker = document.getElementById('customColorPicker');
customPicker.addEventListener('click', (e) => { config.color = e.target.value; triggerManualHighlight(true); });
customPicker.addEventListener('input', (e) => { config.color = e.target.value; triggerManualHighlight(true); });
customPicker.addEventListener('change', (e) => { config.color = e.target.value; saveConfig(); triggerManualHighlight(false); });

function triggerManualHighlight(isPreview) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "applyHighlight", color: config.color, opacity: config.opacity, strikethrough: config.strikethrough, preview: isPreview });
    });
}

document.getElementById('clearSelection').addEventListener('click', () => { chrome.tabs.query({ active: true, currentWindow: true }, tabs => chrome.tabs.sendMessage(tabs[0].id, { action: "clearSelection" })); });
document.getElementById('clear').addEventListener('click', () => { chrome.tabs.query({ active: true, currentWindow: true }, tabs => chrome.tabs.sendMessage(tabs[0].id, { action: "clearHighlights" })); });

document.getElementById('exportBtn').addEventListener('click', () => {
    const btn = document.getElementById('exportBtn');
    const langData = i18n[config.lang] || i18n["en"];
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "exportAndCopy" }, (response) => {
            if (response && response.success) { 
                btn.innerText = langData["msg_copied"]; 
                setTimeout(() => btn.innerText = langData["btn_export"], 2000); 
            } else { 
                btn.innerText = langData["msg_empty"]; 
                setTimeout(() => btn.innerText = langData["btn_export"], 2000); 
            }
        });
    });
});