document.querySelectorAll('.color-btn').forEach(button => {
  button.addEventListener('click', () => {
    const color = window.getComputedStyle(button).backgroundColor;
    
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