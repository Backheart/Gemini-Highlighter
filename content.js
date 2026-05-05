// Function to apply the highlight
async function applyHighlight(color) {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.style.backgroundColor = color;
    span.classList.add("gemini-highlighted-text"); // Use a class for easier identification

    // Wrap the selection content
    try {
      range.surroundContents(span);
      // Optional: Clear selection after highlighting
      // selection.removeAllRanges(); 
    } catch (e) {
      console.warn("Could not highlight mixed content types: ", e);
      alert("Unable to highlight this specific selection.");
    }
  }
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