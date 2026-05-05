async function applyHighlight(color) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  
  // Create the highlight span
  const span = document.createElement("span");
  span.style.backgroundColor = color;
  span.className = "gemini-highlighted-text";

  try {
    // extractContents() is more flexible than surroundContents()
    // It pulls the content out, then we put it inside our span, 
    // then put the span back where the content was.
    span.appendChild(range.extractContents());
    range.insertNode(span);
  } catch (e) {
    console.error("Highlighter Error:", e);
    // If it still fails, it's likely a very complex structural issue
  }
  
  selection.removeAllRanges(); // Clear the blue browser selection
}

// Function to handle key commands (e.g., ALT+H) if we add them later
function handleKeydown(event) {
    // Logic for keyboard shortcuts
}

// Function to reset all highlights (for the popup button)
function clearAllHighlights() {
    const highlights = document.querySelectorAll('.gemini-highlighted-text');
    highlights.forEach(highlight => {
        const parent = highlight.parentNode;
        while(highlight.firstChild) {
            parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
    });
}

// Initialize: Listen for messages from the popup or keyboard shortcuts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "applyHighlight") {
    applyHighlight(request.color);
  } else if (request.action === "clearHighlights") {
    clearAllHighlights();
  }
});