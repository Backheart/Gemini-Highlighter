// --- 1. SIDEBAR INJECTION ---
function toggleSidebar() {
    let sidebar = document.getElementById('gemini-highlighter-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('iframe');
        sidebar.id = 'gemini-highlighter-sidebar';
        sidebar.src = chrome.runtime.getURL('sidebar.html');
        document.body.appendChild(sidebar);
        
        // Slight delay to allow DOM insertion before adding the open class for animation
        setTimeout(() => sidebar.classList.add('open'), 50);
    } else {
        sidebar.classList.toggle('open');
    }
}

// --- 2. HIGHLIGHTING LOGIC ---
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

    const treeWalker = document.createTreeWalker(
        range.commonAncestorContainer, NodeFilter.SHOW_TEXT,
        { acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );

    const nodes = [];
    while (treeWalker.nextNode()) nodes.push(treeWalker.currentNode);

    nodes.forEach(node => {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;

        if (start < end && node.nodeValue.trim() !== "") {
            const span = document.createElement('span');
            span.className = "gemini-highlighted-text";
            span.style.backgroundColor = rgbaColor;
            
            const partToHighlight = node.splitText(start);
            partToHighlight.splitText(end - start);
            partToHighlight.parentNode.replaceChild(span, partToHighlight);
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
            while (span.firstChild) parent.insertBefore(span.firstChild, span);
            span.remove();
        }
    });
    
    document.body.normalize();
    selection.removeAllRanges();
    saveHighlightsToStorage();
}

// --- 3. AGGRESSIVE MEMORY SYSTEM ---
function saveHighlightsToStorage() {
    const highlights = [];
    document.querySelectorAll('.gemini-highlighted-text').forEach(span => {
        // Save the exact text chunk, avoiding saving massive blank spaces
        if(span.textContent.trim().length > 0) {
            highlights.push({
                text: span.textContent,
                color: span.style.backgroundColor
            });
        }
    });
    chrome.storage.local.set({ [window.location.href]: highlights });
}

function applySavedHighlights() {
    chrome.storage.local.get([window.location.href], (result) => {
        const saved = result[window.location.href];
        if (!saved || saved.length === 0) return;

        // Search through meaningful containers
        const containers = document.querySelectorAll('.message-content, p, li, td');
        
        saved.forEach(item => {
            containers.forEach(container => {
                // If container contains the text and doesn't already have it highlighted
                if (container.textContent.includes(item.text)) {
                    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
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
                }
            });
        });
    });
}

// Watchdog Observer
const observer = new MutationObserver(() => {
    clearTimeout(window.loadTimer);
    window.loadTimer = setTimeout(applySavedHighlights, 800);
});
observer.observe(document.body, { childList: true, subtree: true });

// --- 4. LISTENERS ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleSidebar") toggleSidebar();
    else if (request.action === "applyHighlight") highlightSelection(request.color, request.opacity);
    else if (request.action === "clearHighlights") {
        document.querySelectorAll('.gemini-highlighted-text').forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href);
    } 
    else if (request.action === "clearSelection") removeSelectionHighlight();
    else if (request.action === "exportHighlights") {
        const texts = Array.from(document.querySelectorAll('.gemini-highlighted-text'))
                           .map(span => span.textContent.trim())
                           .filter(text => text.length > 0);
        sendResponse({ data: texts.join('\n\n') });
    }
});

// Auto-Highlight Mouse Listener
document.addEventListener('mouseup', () => setTimeout(handleAutoHighlight, 50));
async function handleAutoHighlight() {
    const data = await chrome.storage.local.get(['lastConfig']);
    const config = data.lastConfig;
    if (!config || !config.autoMode) return;

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 5) {
        const parent = selection.anchorNode.parentElement;
        if (parent && parent.classList.contains('gemini-highlighted-text')) return;
        highlightSelection(config.color, config.opacity);
    }
}