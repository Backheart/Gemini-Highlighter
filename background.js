// Toggle Sidebar when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" });
});

// Create Right-Click Context Menus
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: "hl-yellow", title: "Highlight Yellow", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "hl-blue", title: "Highlight Blue", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "hl-red", title: "Highlight Red", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "hl-green", title: "Highlight Green", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "hl-strikethrough", title: "Strikethrough (Plain)", contexts: ["selection"] });
    chrome.contextMenus.create({ type: "separator", id: "sep1", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "hl-clear", title: "Clear Selection", contexts: ["selection"] });
});

// Handle Right-Click Actions
chrome.contextMenus.onClicked.addListener((info, tab) => {
    const actionMap = {
        "hl-yellow": { action: "applyHighlight", color: "#ffc107", opacity: "0.4", strikethrough: false },
        "hl-blue": { action: "applyHighlight", color: "#007bff", opacity: "0.4", strikethrough: false },
        "hl-red": { action: "applyHighlight", color: "#dc3545", opacity: "0.4", strikethrough: false },
        "hl-green": { action: "applyHighlight", color: "#28a745", opacity: "0.4", strikethrough: false },
        "hl-strikethrough": { action: "applyHighlight", color: "transparent", opacity: "1.0", strikethrough: true },
        "hl-clear": { action: "clearSelection" }
    };

    if (actionMap[info.menuItemId]) {
        chrome.tabs.sendMessage(tab.id, actionMap[info.menuItemId]);
    }
});