// --- SIDEBAR LOGIC ---
function toggleSidebar() {
    let sidebar = document.getElementById('gemini-highlighter-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('iframe');
        sidebar.id = 'gemini-highlighter-sidebar';
        sidebar.src = chrome.runtime.getURL('sidebar.html');
        document.body.appendChild(sidebar);
        setTimeout(() => sidebar.classList.add('open'), 50);
    } else {
        sidebar.classList.toggle('open');
    }
}

// Auto-Close Panel Listener
document.addEventListener('mousedown', async (e) => {
    const sidebar = document.getElementById('gemini-highlighter-sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        const data = await chrome.storage.local.get(['lastConfig']);
        // If "Keep Panel Open" is off, slide it back when user clicks the main page
        if (data.lastConfig && !data.lastConfig.pinSidebar) {
            sidebar.classList.remove('open');
        }
    }
});

// --- HIGHLIGHT APPLICATION ---
function hexToRGBA(hex, opacity) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
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

// --- NEW EXACT COORDINATE MEMORY SYSTEM ---
function getHighlightContext(span) {
    // Find the closest paragraph or container block
    const parentBlock = span.closest('p, li, h1, h2, h3, h4, th, td, div.message-content');
    if (!parentBlock) return null;

    // Calculate the exact character index where this highlight starts inside the block
    const range = document.createRange();
    range.setStart(parentBlock, 0);
    range.setEndBefore(span);
    
    return {
        text: span.textContent,
        color: span.style.backgroundColor,
        parentText: parentBlock.textContent.trim(), 
        textOffset: range.toString().length // Exact coordinate
    };
}

function saveHighlightsToStorage() {
    const highlights = [];
    document.querySelectorAll('.gemini-highlighted-text').forEach(span => {
        if (span.textContent.trim().length === 0) return; 
        const ctx = getHighlightContext(span);
        if (ctx) highlights.push(ctx);
    });
    chrome.storage.local.set({ [window.location.href]: highlights });
}

function applySavedHighlights() {
    chrome.storage.local.get([window.location.href], (result) => {
        const saved = result[window.location.href];
        if (!saved || saved.length === 0) return;

        const blocks = document.querySelectorAll('p, li, h1, h2, h3, h4, th, td, div.message-content');
        
        saved.forEach(item => {
            for (let block of blocks) {
                // Step 1: Find the exact paragraph
                if (block.textContent.trim() === item.parentText) {
                    
                    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
                    let currentOffset = 0;
                    let node;
                    let applied = false;
                    
                    while (node = walker.nextNode()) {
                        // Skip text that is already highlighted
                        if (node.parentElement.classList.contains('gemini-highlighted-text')) {
                            currentOffset += node.nodeValue.length;
                            continue;
                        }

                        const nodeLength = node.nodeValue.length;
                        
                        // Step 2: Use the exact coordinate to find the right word
                        if (item.textOffset >= currentOffset && item.textOffset < currentOffset + nodeLength) {
                            const relativeOffset = item.textOffset - currentOffset;
                            
                            // Step 3: Double check we have the exact right text before wrapping
                            if (node.nodeValue.substring(relativeOffset, relativeOffset + item.text.length) === item.text) {
                                const span = document.createElement('span');
                                span.className = "gemini-highlighted-text";
                                span.style.backgroundColor = item.color;
                                
                                const part = node.splitText(relativeOffset);
                                part.splitText(item.text.length);
                                part.parentNode.replaceChild(span, part);
                                span.appendChild(part);
                                applied = true;
                            }
                            break;
                        }
                        currentOffset += nodeLength;
                    }
                    if (applied) break; 
                }
            }
        });
    });
}

const observer = new MutationObserver(() => {
    clearTimeout(window.loadTimer);
    window.loadTimer = setTimeout(applySavedHighlights, 800);
});
observer.observe(document.body, { childList: true, subtree: true });

// --- LISTENERS ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleSidebar") toggleSidebar();
    else if (request.action === "applyHighlight") highlightSelection(request.color, request.opacity);
    else if (request.action === "clearHighlights") {
        document.querySelectorAll('.gemini-highlighted-text').forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href);
    } 
    else if (request.action === "clearSelection") removeSelectionHighlight();
    else if (request.action === "exportAndCopy") {
        // Run copy action directly on the main window DOM
        const texts = Array.from(document.querySelectorAll('.gemini-highlighted-text'))
                           .map(span => span.textContent.trim())
                           .filter(text => text.length > 0);
        
        const finalString = texts.join('\n\n');
        
        if (finalString.length === 0) {
            sendResponse({ success: false });
            return;
        }

        const ta = document.createElement('textarea');
        ta.value = finalString;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            sendResponse({ success: true });
        } catch (err) {
            sendResponse({ success: false });
        } finally {
            document.body.removeChild(ta);
        }
    }
});

// Auto-Highlight
document.addEventListener('mouseup', () => setTimeout(handleAutoHighlight, 50));
async function handleAutoHighlight() {
    const data = await chrome.storage.local.get(['lastConfig']);
    const config = data.lastConfig;
    if (!config || !config.autoMode) return;

    const selection = window.getSelection();
    if (selection.toString().trim().length > 5) {
        const parent = selection.anchorNode.parentElement;
        if (parent && parent.classList.contains('gemini-highlighted-text')) return;
        highlightSelection(config.color, config.opacity);
    }
}