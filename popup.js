document.querySelectorAll('.color-btn').forEach(button => {
  button.addEventListener('click', () => {
    const color = window.getComputedStyle(button).backgroundColor;

    // Add this inside the popup.js script
document.getElementById('clearSelection').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "clearSelection"});
  });
});
    
    // Send a message to the content script on the active Gemini tab
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (button.id === 'clear') {
        chrome.tabs.sendMessage(tabs[0].id, {action: "clearHighlights"});
      } else {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyHighlight", color: color});
      }
    });
  });
});