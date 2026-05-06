function highlightSelection(color) {
    const userSelection = window.getSelection();
    if (userSelection.rangeCount === 0) return;

    const range = userSelection.getRangeAt(0);

    // We use the 'surroundContents' logic only for the small pieces 
    // that the TreeWalker finds to ensure we don't break the layout.
    const treeWalker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        }
    );

    const nodesToProcess = [];
    while (treeWalker.nextNode()) {
        nodesToProcess.push(treeWalker.currentNode);
    }

    nodesToProcess.forEach(node => {
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);

        // Determine the intersection of the selection and this specific text node
        let start = (node === range.startContainer) ? range.startOffset : 0;
        let end = (node === range.endContainer) ? range.endOffset : node.nodeValue.length;

        if (start >= end) return;

        const subRange = document.createRange();
        subRange.setStart(node, start);
        subRange.setEnd(node, end);

        const span = document.createElement('span');
        span.style.backgroundColor = color;
        span.className = "gemini-highlighted-text";
        
        try {
            // We wrap the selection. If it's already in a span, 
            // this creates a nested span (Double Highlight).
            subRange.surroundContents(span);
        } catch (e) {
            // If surroundContents fails (e.g. partial selection of a link), 
            // we fall back to the safer insertNode method.
            const content = subRange.extractContents();
            span.appendChild(content);
            subRange.insertNode(span);
        }
    });

    userSelection.removeAllRanges();
}

// Fixing the "grey ghosting" issue by ensuring we remove highlights properly when clearing selection
function removeSelectionHighlight() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const highlights = document.querySelectorAll('.gemini-highlighted-text');

    highlights.forEach(span => {
        // If the span is even slightly touched by your selection
        if (range.intersectsNode(span)) {
            // Take the text out of the span
            const textNode = document.createTextNode(span.textContent);
            // Replace the span tag with that naked text
            span.parentNode.replaceChild(textNode, span);
        }
    });
    // Final housekeeping: merges the new text with surrounding text
    document.body.normalize(); 
    selection.removeAllRanges(); 
}

// --- SAVING LOGIC ---
function saveHighlightsToStorage() {
    const highlights = [];
    document.querySelectorAll('.gemini-highlighted-text').forEach(span => {
        highlights.push({
            text: span.textContent,
            color: span.style.backgroundColor
        });
    });
    // Use the URL as a key so different chats have different highlights
    const pageId = window.location.href;
    chrome.storage.local.set({ [pageId]: highlights });
}

// --- LOADING LOGIC ---
function applySavedHighlights() {
    const pageId = window.location.href;
    chrome.storage.local.get([pageId], (result) => {
        const saved = result[pageId];
        if (!saved || saved.length === 0) return;

        // We search the page for the saved text and wrap it
        // This is a simplified version; complex HTML might need more precision
        saved.forEach(item => {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue.includes(item.text) && !node.parentElement.classList.contains('gemini-highlighted-text')) {
                    const index = node.nodeValue.indexOf(item.text);
                    const range = document.createRange();
                    range.setStart(node, index);
                    range.setEnd(node, index + item.text.length);
                    
                    const span = document.createElement('span');
                    span.className = "gemini-highlighted-text";
                    span.style.backgroundColor = item.color;
                    range.surroundContents(span);
                }
            }
        });
    });
}

// --- THE WATCHDOG (MutationObserver) ---
// This restarts the highlighter whenever Gemini adds new text to the screen
const observer = new MutationObserver((mutations) => {
    // Debounce: wait 500ms after the last change to avoid slowing down the browser
    clearTimeout(window.loadTimer);
    window.loadTimer = setTimeout(applySavedHighlights, 500);
});

observer.observe(document.body, { childList: true, subtree: true });

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "applyHighlight") {
        highlightSelection(request.color);
        saveHighlightsToStorage(); // Save immediately after highlighting
    } else if (request.action === "clearHighlights") {
        const highlights = document.querySelectorAll('.gemini-highlighted-text');
        highlights.forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href); // Wipe the memory for this page
    }
});

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "applyHighlight") {
        highlightSelection(request.color);
        saveHighlightsToStorage(); // Save immediately after highlighting
    } else if (request.action === "clearHighlights") {
        const highlights = document.querySelectorAll('.gemini-highlighted-text');
        highlights.forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href); // Wipe the memory for this page
    }
});


