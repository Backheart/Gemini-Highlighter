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
    // We need the same list of containers used in the loader
    const allElements = Array.from(document.querySelectorAll('p, li, div.message-content'));

    document.querySelectorAll('.gemini-highlighted-text').forEach(span => {
        // Find which "House" this span lives in
        const parent = span.closest('p, li, div.message-content');
        const elementIndex = allElements.indexOf(parent);

        highlights.push({
            text: span.textContent,
            color: span.style.backgroundColor,
            elementIndex: elementIndex // This was the missing piece!
        });
    });

    const pageId = window.location.href;
    chrome.storage.local.set({ [pageId]: highlights });
}

// --- LOADING LOGIC ---
function applySavedHighlights() {
    const pageId = window.location.href;
    chrome.storage.local.get([pageId], (result) => {
        const saved = result[pageId];
        if (!saved) return;

        // We use the same specific containers as before for stability
        const allElements = Array.from(document.querySelectorAll('p, li, div.message-content'));

        saved.forEach(item => {
            const targetElement = allElements[item.elementIndex];
            
            // SAFETY LOCK: Only proceed if the "House Number" exists 
            // AND the text inside matches exactly what we saved.
            if (targetElement && targetElement.textContent.includes(item.text)) {
                
                // Avoid double-highlighting the same spot
                if (targetElement.querySelector('.gemini-highlighted-text')) return;

                const span = document.createElement('span');
                span.className = "gemini-highlighted-text";
                span.style.backgroundColor = item.color;
                
                // Use a safer TextNode search instead of innerHTML.replace
                // This prevents the "weird shifting"
                const walker = document.createTreeWalker(targetElement, NodeFilter.SHOW_TEXT);
                let node;
                while (node = walker.nextNode()) {
                    if (node.nodeValue.includes(item.text)) {
                        const index = node.nodeValue.indexOf(item.text);
                        const range = document.createRange();
                        range.setStart(node, index);
                        range.setEnd(node, index + item.text.length);
                        range.surroundContents(span);
                        break; // Stop after the first match in this specific element
                    }
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
        saveHighlightsToStorage(); 
    } else if (request.action === "clearHighlights") {
        const highlights = document.querySelectorAll('.gemini-highlighted-text');
        highlights.forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href); 
    } else if (request.action === "clearSelection") {
        // This now triggers your cleanup function
        removeSelectionHighlight();
        // Crucial: Save the new state so the cleared part stays cleared on refresh!
        saveHighlightsToStorage(); 
    }
});



