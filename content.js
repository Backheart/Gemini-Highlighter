// A robust helper function to traverse and wrap only raw text nodes
function highlightSelection(color) {
    const userSelection = window.getSelection();
    if (userSelection.rangeCount === 0) return;

    const range = userSelection.getRangeAt(0);

    // 1. Get all the nodes within the range, including text nodes
    const treeWalker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                if (range.intersectsNode(node)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    const nodeList = [];
    while (treeWalker.nextNode()) {
        nodeList.push(treeWalker.currentNode);
    }

    // 2. Iterate and highlight each specific TextNode
    nodeList.forEach((textNode) => {
        // Find the specific portion of the TextNode that is selected
        let start = (textNode === range.startContainer) ? range.startOffset : 0;
        let end = (textNode === range.endContainer) ? range.endOffset : textNode.nodeValue.length;

        // Skip nodes with no selection or just whitespace (this avoids layout shifts)
        if (start === end || textNode.nodeValue.trim() === '') return;

        // Extract just the selected part of the text
        const selectedText = textNode.nodeValue.substring(start, end);

        // Create the highlighter span
        const span = document.createElement('span');
        span.style.backgroundColor = color;
        span.className = "gemini-highlighted-text";
        span.textContent = selectedText;

        // Prepare the new structure: [TEXT BEFORE] + [SPAN] + [TEXT AFTER]
        const parent = textNode.parentNode;
        
        // Handle potential duplication or weird structural issues
        if (parent.tagName === 'SPAN' && parent.classList.contains('gemini-highlighted-text')) return;

        // 3. Perform the safe swap in the DOM
        const textAfter = textNode.splitText(end);
        parent.insertBefore(span, textAfter);
        textNode.nodeValue = textNode.nodeValue.substring(0, start);
    });

    userSelection.removeAllRanges(); // Clear the blue selection
}

// Keep the message listener the same
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "applyHighlight") {
    highlightSelection(request.color);
  }
});