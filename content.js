let localConfig = { autoMode: false, pinSidebar: false, showMinimap: true, color: "#ffc107", opacity: "1.0", strikethrough: false };

chrome.storage.local.get(['lastConfig'], (res) => {
    if (res.lastConfig) localConfig = { ...localConfig, ...res.lastConfig };
    updateHighlightMap(); 
});
chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastConfig) {
        localConfig = changes.lastConfig.newValue;
        updateHighlightMap(); 
    }
});

// --- SELECTION MEMORY ENGINE ---
// This guarantees we don't lose the selection when clicking inside the sidebar!
let lastSelectionRange = null;
document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        lastSelectionRange = sel.getRangeAt(0).cloneRange();
    }
});

function toggleSidebar() {
    let sidebar = document.getElementById('gemini-highlighter-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('iframe'); sidebar.id = 'gemini-highlighter-sidebar';
        sidebar.src = chrome.runtime.getURL('sidebar.html'); document.body.appendChild(sidebar);
        setTimeout(() => sidebar.classList.add('open'), 50);
    } else {
        sidebar.classList.toggle('open');
    }
}

document.addEventListener('mousedown', (e) => {
    try {
        const sidebar = document.getElementById('gemini-highlighter-sidebar');
        if (sidebar && sidebar.classList.contains('open') && !localConfig.pinSidebar) {
            sidebar.classList.remove('open');
        }
    } catch (err) {}
});

function getTextColorForBackground(hexColor, opacity) {
    if (hexColor === 'transparent') return 'inherit';
    if (parseFloat(opacity) < 0.6) return 'inherit'; 
    let r = parseInt(hexColor.slice(1, 3), 16), g = parseInt(hexColor.slice(3, 5), 16), b = parseInt(hexColor.slice(5, 7), 16);
    let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff'; 
}

function hexToRGBA(hex, opacity) {
    if (hex === 'transparent') return 'transparent';
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function highlightSelection(color, opacity, isStrikethrough = localConfig.strikethrough) {
    let range;
    const sel = window.getSelection();
    
    // Check if we have an active selection, otherwise use our Memory Selection!
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        range = sel.getRangeAt(0);
    } else if (lastSelectionRange) {
        range = lastSelectionRange;
    } else {
        return;
    }

    const rgbaColor = hexToRGBA(color, opacity);
    const dynamicTextColor = getTextColorForBackground(color, opacity);
    
    // Generate a unique ID to group this block of highlights together
    const highlightId = Date.now().toString() + Math.random().toString(36).substr(2, 5);

    const nodes = [];
    if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
        nodes.push(range.commonAncestorContainer);
    } else {
        const treeWalker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT,
            { acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
        );
        while (treeWalker.nextNode()) nodes.push(treeWalker.currentNode);
    }

    nodes.forEach(node => {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;

        if (start < end && node.nodeValue.trim() !== "") {
            const span = document.createElement('span');
            span.className = "gemini-highlighted-text";
            span.setAttribute('data-highlight-id', highlightId); // Stamp the ID
            span.style.backgroundColor = rgbaColor;
            span.style.color = dynamicTextColor; 
            span.style.display = "inline"; 
            if (isStrikethrough) span.style.textDecoration = "line-through";
            
            const partToHighlight = node.splitText(start);
            partToHighlight.splitText(end - start);
            partToHighlight.parentNode.replaceChild(span, partToHighlight);
            span.appendChild(partToHighlight);
        }
    });
    
    if(sel) sel.removeAllRanges();
    lastSelectionRange = null; // Clear memory
    saveHighlightsToStorage();
    updateHighlightMap();
}

// --- FLOATING HOVER DELETE ('X') BUTTON ---
let activeHoverSpan = null;
const hoverDeleteBtn = document.createElement('div');
hoverDeleteBtn.id = 'highlight-hover-delete';
hoverDeleteBtn.innerHTML = '✕';
document.documentElement.appendChild(hoverDeleteBtn);

document.addEventListener('mouseover', (e) => {
    if (e.target.classList.contains('gemini-highlighted-text')) {
        activeHoverSpan = e.target;
        const rect = activeHoverSpan.getBoundingClientRect();
        hoverDeleteBtn.style.display = 'flex';
        hoverDeleteBtn.style.top = `${rect.top + window.scrollY - 8}px`;
        hoverDeleteBtn.style.left = `${rect.right + window.scrollX - 8}px`;
    } else if (e.target !== hoverDeleteBtn) {
        hoverDeleteBtn.style.display = 'none';
        activeHoverSpan = null;
    }
});

// Group Deletion Logic
hoverDeleteBtn.addEventListener('click', () => {
    if (activeHoverSpan) {
        const id = activeHoverSpan.getAttribute('data-highlight-id');
        
        // Find ALL spans that were created in that exact same highlight action
        if (id) {
            const groupSpans = document.querySelectorAll(`.gemini-highlighted-text[data-highlight-id="${id}"]`);
            groupSpans.forEach(s => {
                const parent = s.parentNode;
                while (s.firstChild) parent.insertBefore(s.firstChild, s);
                s.remove();
                parent.normalize();
            });
        } else {
            // Fallback for old saved highlights without IDs
            const parent = activeHoverSpan.parentNode;
            while (activeHoverSpan.firstChild) parent.insertBefore(activeHoverSpan.firstChild, activeHoverSpan);
            activeHoverSpan.remove();
            parent.normalize();
        }

        saveHighlightsToStorage();
        updateHighlightMap();
        hoverDeleteBtn.style.display = 'none';
    }
});

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
    document.body.normalize(); selection.removeAllRanges();
    saveHighlightsToStorage(); updateHighlightMap();
}

const UNIVERSAL_CONTAINERS = 'p, li, h1, h2, h3, h4, th, td, article, section, div.message-content, div.prose';
function getHighlightContext(span) {
    let parentBlock = span.closest(UNIVERSAL_CONTAINERS);
    if (!parentBlock) parentBlock = span.parentElement;
    if (!parentBlock) return null;

    // THE FIX: Save the exact Index of the block so Identical text (Lorem Ipsum) doesn't get confused
    const blocks = Array.from(document.querySelectorAll(UNIVERSAL_CONTAINERS));
    const blockIndex = blocks.indexOf(parentBlock);

    const range = document.createRange();
    range.setStart(parentBlock, 0); range.setEndBefore(span);
    
    return {
        text: span.textContent,
        color: span.style.backgroundColor,
        textColor: span.style.color, 
        isStrikethrough: span.style.textDecoration.includes('line-through'), 
        highlightId: span.getAttribute('data-highlight-id') || Date.now().toString(), // Save the ID Group
        parentText: parentBlock.textContent.trim(), 
        textOffset: range.toString().length,
        blockIndex: blockIndex
    };
}

function saveHighlightsToStorage() {
    try {
        const highlights = [];
        document.querySelectorAll('.gemini-highlighted-text').forEach(span => {
            if (span.textContent.trim().length === 0) return; 
            const ctx = getHighlightContext(span);
            if (ctx) highlights.push(ctx);
        });
        chrome.storage.local.set({ [window.location.href]: highlights });
    } catch (err) {}
}

function applySavedHighlights() {
    try {
        chrome.storage.local.get([window.location.href], (result) => {
            const saved = result[window.location.href];
            if (!saved || saved.length === 0) return;

            const blocks = document.querySelectorAll(UNIVERSAL_CONTAINERS);
            
            saved.forEach(item => {
                let targetBlock = null;

                // Priority 1: Exact Block Index match (Fixes Lorem Ipsum bug)
                if (item.blockIndex !== undefined && blocks[item.blockIndex]) {
                    if (blocks[item.blockIndex].textContent.trim() === item.parentText) {
                        targetBlock = blocks[item.blockIndex];
                    }
                }
                
                // Priority 2: Fallback search if the webpage shifted dynamically
                if (!targetBlock) {
                    for (let block of blocks) {
                        if (block.textContent.trim() === item.parentText) {
                            targetBlock = block; break;
                        }
                    }
                }

                if (targetBlock) {
                    const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT);
                    let currentOffset = 0; let node; let applied = false;
                    
                    while (node = walker.nextNode()) {
                        if (node.parentElement.classList.contains('gemini-highlighted-text')) {
                            currentOffset += node.nodeValue.length; continue;
                        }
                        const nodeLength = node.nodeValue.length;
                        if (item.textOffset >= currentOffset && item.textOffset < currentOffset + nodeLength) {
                            const relativeOffset = item.textOffset - currentOffset;
                            if (node.nodeValue.substring(relativeOffset, relativeOffset + item.text.length) === item.text) {
                                const span = document.createElement('span');
                                span.className = "gemini-highlighted-text";
                                span.style.backgroundColor = item.color;
                                span.style.display = "inline";
                                
                                // Restore all properties
                                span.setAttribute('data-highlight-id', item.highlightId);
                                if (item.textColor) span.style.color = item.textColor;
                                if (item.isStrikethrough) span.style.textDecoration = 'line-through';
                                
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
                }
            });
        });
    } catch (err) {}
}

let observerTimer = null;
const observer = new MutationObserver(() => {
    if (observerTimer) clearTimeout(observerTimer);
    observerTimer = setTimeout(() => { applySavedHighlights(); updateHighlightMap(); }, 1200); 
});
observer.observe(document.body, { childList: true, subtree: true });

function getScrollParent(node) {
    if (node == null || node === document.body || node === document.documentElement) return document.documentElement;
    const style = window.getComputedStyle(node);
    if (node.scrollHeight > node.clientHeight && 
        (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflowY === 'overlay')) {
        return node;
    }
    return getScrollParent(node.parentNode);
}

function updateHighlightMap() {
    let mapTrack = document.getElementById('highlight-minimap-track');
    if (!mapTrack) {
        mapTrack = document.createElement('div'); mapTrack.id = 'highlight-minimap-track';
        document.documentElement.appendChild(mapTrack);
    }
    mapTrack.innerHTML = ''; 

    if (!localConfig.showMinimap) { mapTrack.style.display = 'none'; return; } 
    else { mapTrack.style.display = 'block'; }

    const spans = Array.from(document.querySelectorAll('.gemini-highlighted-text'));
    if (spans.length === 0) return;

    const scrollContainer = getScrollParent(spans[0]);
    const isWindowScroll = (scrollContainer === document.documentElement || scrollContainer === document.body);
    
    let containerRect;
    if (isWindowScroll) {
        containerRect = { top: 0, height: window.innerHeight }; mapTrack.style.top = '0px'; mapTrack.style.height = '100vh';
    } else {
        containerRect = scrollContainer.getBoundingClientRect(); mapTrack.style.top = `${containerRect.top}px`; mapTrack.style.height = `${containerRect.height}px`;
    }

    const totalHeight = scrollContainer.scrollHeight;
    let markersData = [];

    spans.forEach(span => {
        const rect = span.getBoundingClientRect();
        if (rect.height === 0 && rect.width === 0) return; 

        let absoluteTop = isWindowScroll ? (rect.top + window.scrollY) : ((rect.top - containerRect.top) + scrollContainer.scrollTop);

        markersData.push({
            top: absoluteTop, percentage: (absoluteTop / totalHeight) * 100,
            color: span.style.backgroundColor, text: span.textContent.trim(), targetTop: absoluteTop
        });
    });

    markersData.sort((a, b) => a.top - b.top);
    let groupedMarkers = [];
    if (markersData.length > 0) {
        let currentGroup = markersData[0];
        for (let i = 1; i < markersData.length; i++) {
            const marker = markersData[i];
            if (Math.abs(marker.top - currentGroup.top) < 40) { currentGroup.text += " " + marker.text; } 
            else { groupedMarkers.push(currentGroup); currentGroup = marker; }
        }
        groupedMarkers.push(currentGroup);
    }

    groupedMarkers.forEach(group => {
        const marker = document.createElement('div'); marker.className = 'highlight-minimap-marker';
        marker.style.top = `${group.percentage}%`; marker.style.backgroundColor = group.color;
        
        const tooltip = document.createElement('div'); tooltip.className = 'minimap-tooltip';
        const words = group.text.replace(/\s+/g, ' ').split(' ');
        const snippet = words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
        tooltip.textContent = snippet; marker.appendChild(tooltip);
        
        // THE FIX: Increased offset to -150 to leave breathing room at top of page!
        marker.addEventListener('click', () => {
            if (isWindowScroll) window.scrollTo({ top: group.targetTop - 150, behavior: 'smooth' });
            else scrollContainer.scrollTo({ top: group.targetTop - 150, behavior: 'smooth' });
        });
        mapTrack.appendChild(marker);
    });
}
window.addEventListener('resize', updateHighlightMap);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleSidebar") toggleSidebar();
    else if (request.action === "applyHighlight") {
        // ALWAYS obey the user's intensity/opacity toggle, override right-click values!
        const opacityToUse = localConfig.opacity;
        const colorToUse = request.color || localConfig.color;
        const isStrike = request.strikethrough !== undefined ? request.strikethrough : localConfig.strikethrough;
        
        highlightSelection(colorToUse, opacityToUse, isStrike);
    }
    else if (request.action === "clearHighlights") {
        document.querySelectorAll('.gemini-highlighted-text').forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href);
        updateHighlightMap();
    } 
    else if (request.action === "clearSelection") removeSelectionHighlight();
    else if (request.action === "exportAndCopy") {
        const spans = Array.from(document.querySelectorAll('.gemini-highlighted-text'));
        let exportBlocks = []; let currentBlockText = []; let lastBlockElement = null;

        spans.forEach(span => {
            let parentBlock = span.closest(UNIVERSAL_CONTAINERS);
            if (!parentBlock) parentBlock = span.parentElement;
            const cleanText = span.textContent.replace(/\s+/g, ' ').trim();
            if (cleanText.length === 0) return;

            if (parentBlock === lastBlockElement && lastBlockElement !== null) currentBlockText.push(cleanText);
            else {
                if (currentBlockText.length > 0) exportBlocks.push(currentBlockText.join(' '));
                currentBlockText = [cleanText]; lastBlockElement = parentBlock;
            }
        });
        
        if (currentBlockText.length > 0) exportBlocks.push(currentBlockText.join(' '));
        const finalString = exportBlocks.join('\n\n'); 
        if (finalString.length === 0) { sendResponse({ success: false }); return; }

        const ta = document.createElement('textarea'); ta.value = finalString; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); sendResponse({ success: true }); } 
        catch (err) { sendResponse({ success: false }); } 
        finally { document.body.removeChild(ta); }
    }
});

document.addEventListener('mouseup', () => setTimeout(handleAutoHighlight, 50));
function handleAutoHighlight() {
    try {
        if (!localConfig.autoMode) return;
        const selection = window.getSelection();
        if (selection.toString().trim().length > 5) {
            const parent = selection.anchorNode.parentElement;
            if (parent && parent.classList.contains('gemini-highlighted-text')) return;
            highlightSelection(localConfig.color, localConfig.opacity, localConfig.strikethrough);
        }
    } catch (e) {}
}