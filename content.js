// --- 1. CORE HIGHLIGHTING LOGIC ---
function highlightSelection(color) {
    const userSelection = window.getSelection();
    if (userSelection.rangeCount === 0) return;

    const range = userSelection.getRangeAt(0);

    const treeWalker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        }
    );

    const nodesToProcess = [];
    while (treeWalker.nextNode()) nodesToProcess.push(treeWalker.currentNode);

    nodesToProcess.forEach(node => {
        let start = (node === range.startContainer) ? range.startOffset : 0;
        let end = (node === range.endContainer) ? range.endOffset : node.nodeValue.length;

        if (start >= end || node.nodeValue.trim() === "") return;

        const subRange = document.createRange();
        subRange.setStart(node, start);
        subRange.setEnd(node, end);

        const span = document.createElement('span');
        span.className = "gemini-highlighted-text";
        span.style.backgroundColor = color;

        try {
            subRange.surroundContents(span);
        } catch (e) {
            const content = subRange.extractContents();
            span.appendChild(content);
            subRange.insertNode(span);
        }
    });

    userSelection.removeAllRanges();
}

// --- 2. SURGICAL CLEAR (Prevents Grey Ghosting) ---
function removeSelectionHighlight() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const highlights = document.querySelectorAll('.gemini-highlighted-text');

    highlights.forEach(span => {
        if (range.intersectsNode(span)) {
            // Converts the span back into naked, unstyled text
            const textNode = document.createTextNode(span.textContent);
            span.parentNode.replaceChild(textNode, span);
        }
    });
    
    document.body.normalize(); // Cleans up fragmented text nodes
    selection.removeAllRanges();
}

// --- 3. PERSISTENCE LOGIC (The Memory) ---

// Define the "Neighborhood" - these containers must be identical in both functions
const TARGET_CONTAINERS = 'p, li, div.message-content, pre';

function saveHighlightsToStorage() {
    const highlights = [];
    const allElements = Array.from(document.querySelectorAll(TARGET_CONTAINERS));

    document.querySelectorAll('.gemini-highlighted-text').forEach(span => {
        const parent = span.closest(TARGET_CONTAINERS);
        const elementIndex = allElements.indexOf(parent);

        if (elementIndex !== -1) {
            highlights.push({
                text: span.textContent,
                color: span.style.backgroundColor,
                elementIndex: elementIndex
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
            const targetElement = allElements[item.elementIndex];
            
            // Only apply if the "House Number" matches the expected text
            if (targetElement && targetElement.textContent.includes(item.text)) {
                if (targetElement.querySelector('.gemini-highlighted-text')) {
                    // Check if this specific text is already highlighted to avoid duplicates
                    const existingSpans = Array.from(targetElement.querySelectorAll('.gemini-highlighted-text'));
                    if (existingSpans.some(s => s.textContent === item.text)) return;
                }

                const walker = document.createTreeWalker(targetElement, NodeFilter.SHOW_TEXT);
                let node;
                while (node = walker.nextNode()) {
                    if (node.nodeValue.includes(item.text)) {
                        const index = node.nodeValue.indexOf(item.text);
                        const range = document.createRange();
                        range.setStart(node, index);
                        range.setEnd(node, index + item.text.length);
                        
                        const span = document.createElement('span');
                        span.className = "gemini-highlighted-text";
                        span.style.backgroundColor = item.color;
                        
                        try { range.surroundContents(span); } catch(e) {}
                        break; 
                    }
                }
            }
        });
    });
}

// --- 4. THE WATCHDOG & LISTENERS ---

const observer = new MutationObserver(() => {
    clearTimeout(window.loadTimer);
    window.loadTimer = setTimeout(applySavedHighlights, 500);
});
observer.observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "applyHighlight") {
        highlightSelection(request.color);
        saveHighlightsToStorage();
    } else if (request.action === "clearHighlights") {
        document.querySelectorAll('.gemini-highlighted-text').forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href);
    } else if (request.action === "clearSelection") {
        removeSelectionHighlight();
        saveHighlightsToStorage(); // Update memory after clearing a piece
    }
});