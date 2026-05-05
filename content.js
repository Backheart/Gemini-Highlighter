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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "applyHighlight") {
    highlightSelection(request.color);
  } else if (request.action === "clearHighlights") {
      // Improved Clear: Removes the spans but keeps the text
      const highlights = document.querySelectorAll('.gemini-highlighted-text');
      highlights.forEach(h => h.replaceWith(...h.childNodes));
  }
});