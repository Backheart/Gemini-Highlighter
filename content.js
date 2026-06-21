// Helper to convert hex to rgba for transparency
function hexToRGBA(hex, opacity) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function highlightSelection(color, opacity) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const rgbaColor = hexToRGBA(color, opacity);

    // Get all text nodes within range
    const treeWalker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        { acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );

    const nodes = [];
    while (treeWalker.nextNode()) nodes.push(treeWalker.currentNode);

    nodes.forEach(node => {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;

        if (start < end) {
            const span = document.createElement('span');
            span.className = "gemini-highlighted-text";
            span.style.backgroundColor = rgbaColor;
            
            const partToHighlight = node.splitText(start);
            partToHighlight.splitText(end - start);
            
            const parent = partToHighlight.parentNode;
            parent.replaceChild(span, partToHighlight);
            span.appendChild(partToHighlight);
        }
    });
    
    selection.removeAllRanges();
    saveHighlightsToStorage();
}

function removeSelectionHighlight() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const highlights = document.querySelectorAll('.gemini-highlighted-text');

    highlights.forEach(span => {
        if (range.intersectsNode(span)) {
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            span.remove();
        }
    });
    
    document.body.normalize();
    selection.removeAllRanges();
    saveHighlightsToStorage();
}

// Storage Logic
const TARGET_CONTAINERS = 'p, li, div.message-content, pre, span';

function saveHighlightsToStorage() {
    const highlights = [];
    const allElements = Array.from(document.querySelectorAll(TARGET_CONTAINERS));

    document.querySelectorAll('.gemini-highlighted-text').forEach(span => {
        const parent = span.closest(TARGET_CONTAINERS);
        const index = allElements.indexOf(parent);
        if (index !== -1) {
            highlights.push({
                text: span.textContent,
                color: span.style.backgroundColor,
                index: index
            });
        }
    });
    chrome.storage.local.set({ [window.location.href]: highlights });
}

function applySavedHighlights() {
    chrome.storage.local.get([window.location.href], (result) => {
        const saved = result[window.location.href];
        if (!saved) return;

        const allElements = Array.from(document.querySelectorAll(TARGET_CONTAINERS));
        saved.forEach(item => {
            const target = allElements[item.index];
            if (!target) return;

            // Search for the text within the target element's text nodes
            const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                const idx = node.nodeValue.indexOf(item.text);
                if (idx !== -1 && !node.parentElement.classList.contains('gemini-highlighted-text')) {
                    const span = document.createElement('span');
                    span.className = "gemini-highlighted-text";
                    span.style.backgroundColor = item.color;
                    
                    const part = node.splitText(idx);
                    part.splitText(item.text.length);
                    part.parentNode.replaceChild(span, part);
                    span.appendChild(part);
                    break;
                }
            }
        });
    });
}

// Watch for Gemini dynamic updates
const observer = new MutationObserver(() => {
    clearTimeout(window.loadTimer);
    window.loadTimer = setTimeout(applySavedHighlights, 800);
});
observer.observe(document.body, { childList: true, subtree: true });

// Update your applyHighlight listener to also update local cache if needed
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "applyHighlight") {
        highlightSelection(request.color, request.opacity);
    } 
    // ... (rest of your listeners)
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "applyHighlight") {
        highlightSelection(request.color, request.opacity);
    } else if (request.action === "clearHighlights") {
        document.querySelectorAll('.gemini-highlighted-text').forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href);
    } else if (request.action === "clearSelection") {
        removeSelectionHighlight();
    }
});


document.addEventListener('mouseup', () => {
    // Small delay to ensure the selection is fully captured by the browser
    setTimeout(handleAutoHighlight, 50);
});

async function handleAutoHighlight() {
    // 1. Get the latest config from storage
    const data = await chrome.storage.local.get(['lastConfig']);
    const config = data.lastConfig;

    if (!config || !config.autoMode) return;

    // 2. Check Selection
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // 3. Minimum Length Check (5 characters)
    if (selectedText.length > 5) {
        // Ensure we aren't clicking inside an existing highlight
        const parent = selection.anchorNode.parentElement;
        if (parent && parent.classList.contains('gemini-highlighted-text')) return;

        // 4. Apply Highlight using the saved last color/opacity
        highlightSelection(config.color, config.opacity);
    }
}