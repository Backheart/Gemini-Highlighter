// --- SIDEBAR LOGIC ---
function toggleSidebar() {
    let sidebar = document.getElementById('gemini-highlighter-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('iframe');
        sidebar.id = 'gemini-highlighter-sidebar';
        sidebar.src = chrome.runtime.getURL('sidebar.html');
        document.body.appendChild(sidebar);
        setTimeout(() => sidebar.classList.add('open'), 50);
    } else {
        sidebar.classList.toggle('open');
    }
}

document.addEventListener('mousedown', async (e) => {
    try {
        const sidebar = document.getElementById('gemini-highlighter-sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            const data = await chrome.storage.local.get(['lastConfig']);
            if (data.lastConfig && !data.lastConfig.pinSidebar) {
                sidebar.classList.remove('open');
            }
        }
    } catch (err) {}
});

// --- HIGHLIGHT APPLICATION ---
function hexToRGBA(hex, opacity) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

async function highlightSelection(color, opacity) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const rgbaColor = hexToRGBA(color, opacity);

    const treeWalker = document.createTreeWalker(
        range.commonAncestorContainer, NodeFilter.SHOW_TEXT,
        { acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );

    const nodes = [];
    while (treeWalker.nextNode()) nodes.push(treeWalker.currentNode);

    nodes.forEach(node => {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;

        if (start < end && node.nodeValue.trim() !== "") {
            const span = document.createElement('span');
            span.className = "gemini-highlighted-text";
            span.style.backgroundColor = rgbaColor;
            span.style.display = "inline"; 
            
            const partToHighlight = node.splitText(start);
            partToHighlight.splitText(end - start);
            partToHighlight.parentNode.replaceChild(span, partToHighlight);
            span.appendChild(partToHighlight);
        }
    });
    
    selection.removeAllRanges();
    saveHighlightsToStorage();
    updateHighlightMap();
}

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
    
    document.body.normalize();
    selection.removeAllRanges();
    saveHighlightsToStorage();
    updateHighlightMap();
}

// --- UNIVERSAL COORDINATE MEMORY SYSTEM ---
const UNIVERSAL_CONTAINERS = 'p, li, h1, h2, h3, h4, th, td, article, section, div.message-content, div.prose';

function getHighlightContext(span) {
    let parentBlock = span.closest(UNIVERSAL_CONTAINERS);
    if (!parentBlock) parentBlock = span.parentElement;
    if (!parentBlock) return null;

    const range = document.createRange();
    range.setStart(parentBlock, 0);
    range.setEndBefore(span);
    
    return {
        text: span.textContent,
        color: span.style.backgroundColor,
        parentText: parentBlock.textContent.trim(), 
        textOffset: range.toString().length 
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
                for (let block of blocks) {
                    if (block.textContent.trim() === item.parentText) {
                        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
                        let currentOffset = 0;
                        let node;
                        let applied = false;
                        
                        while (node = walker.nextNode()) {
                            if (node.parentElement.classList.contains('gemini-highlighted-text')) {
                                currentOffset += node.nodeValue.length;
                                continue;
                            }

                            const nodeLength = node.nodeValue.length;
                            
                            if (item.textOffset >= currentOffset && item.textOffset < currentOffset + nodeLength) {
                                const relativeOffset = item.textOffset - currentOffset;
                                
                                if (node.nodeValue.substring(relativeOffset, relativeOffset + item.text.length) === item.text) {
                                    const span = document.createElement('span');
                                    span.className = "gemini-highlighted-text";
                                    span.style.backgroundColor = item.color;
                                    span.style.display = "inline";
                                    
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
                        if (applied) break; 
                    }
                }
            });
        });
    } catch (err) {}
}

let observerTimer = null;
const observer = new MutationObserver(() => {
    if (observerTimer) clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
        applySavedHighlights();
        updateHighlightMap(); 
    }, 1200); 
});
observer.observe(document.body, { childList: true, subtree: true });


// --- NEW BULLETPROOF MINIMAP ENGINE ---

// Climbs the HTML tree to find the EXACT box that is scrolling the text
function getScrollParent(node) {
    if (node == null || node === document.body || node === document.documentElement) {
        return document.documentElement;
    }
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
        mapTrack = document.createElement('div');
        mapTrack.id = 'highlight-minimap-track';
        document.documentElement.appendChild(mapTrack);
    }
    
    mapTrack.innerHTML = ''; 
    const spans = Array.from(document.querySelectorAll('.gemini-highlighted-text'));
    if (spans.length === 0) return;

    // 1. Find exactly what is scrolling based on the first highlight
    const scrollContainer = getScrollParent(spans[0]);
    const isWindowScroll = (scrollContainer === document.documentElement || scrollContainer === document.body);
    
    // 2. Lock the track EXACTLY to the height and position of the scrolling box
    let containerRect;
    if (isWindowScroll) {
        containerRect = { top: 0, height: window.innerHeight };
        mapTrack.style.top = '0px';
        mapTrack.style.height = '100vh';
    } else {
        containerRect = scrollContainer.getBoundingClientRect();
        mapTrack.style.top = `${containerRect.top}px`;
        mapTrack.style.height = `${containerRect.height}px`;
    }

    const totalHeight = scrollContainer.scrollHeight;
    let markersData = [];

    // 3. Map absolute positions precisely within the scrolling box
    spans.forEach(span => {
        const rect = span.getBoundingClientRect();
        if (rect.height === 0 && rect.width === 0) return; 

        let absoluteTop;
        if (isWindowScroll) {
            absoluteTop = rect.top + window.scrollY;
        } else {
            absoluteTop = (rect.top - containerRect.top) + scrollContainer.scrollTop;
        }

        markersData.push({
            top: absoluteTop,
            percentage: (absoluteTop / totalHeight) * 100,
            color: span.style.backgroundColor,
            text: span.textContent.trim(),
            targetTop: absoluteTop
        });
    });

    // 4. Group markers that are close together
    markersData.sort((a, b) => a.top - b.top);
    let groupedMarkers = [];
    
    if (markersData.length > 0) {
        let currentGroup = markersData[0];
        
        for (let i = 1; i < markersData.length; i++) {
            const marker = markersData[i];
            if (Math.abs(marker.top - currentGroup.top) < 40) {
                currentGroup.text += " " + marker.text; 
            } else {
                groupedMarkers.push(currentGroup);
                currentGroup = marker;
            }
        }
        groupedMarkers.push(currentGroup);
    }

    // 5. Draw the Markers and Tooltips
    groupedMarkers.forEach(group => {
        const marker = document.createElement('div');
        marker.className = 'highlight-minimap-marker';
        marker.style.top = `${group.percentage}%`;
        marker.style.backgroundColor = group.color;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'minimap-tooltip';
        const words = group.text.replace(/\s+/g, ' ').split(' ');
        const snippet = words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
        tooltip.textContent = snippet;
        marker.appendChild(tooltip);
        
        marker.addEventListener('click', () => {
            if (isWindowScroll) {
                window.scrollTo({ top: group.targetTop - 80, behavior: 'smooth' });
            } else {
                scrollContainer.scrollTo({ top: group.targetTop - 80, behavior: 'smooth' });
            }
        });
        
        mapTrack.appendChild(marker);
    });
}

window.addEventListener('resize', updateHighlightMap);


// --- LISTENERS ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleSidebar") toggleSidebar();
    else if (request.action === "applyHighlight") highlightSelection(request.color, request.opacity);
    else if (request.action === "clearHighlights") {
        document.querySelectorAll('.gemini-highlighted-text').forEach(h => h.replaceWith(...h.childNodes));
        chrome.storage.local.remove(window.location.href);
        updateHighlightMap();
    } 
    else if (request.action === "clearSelection") removeSelectionHighlight();
    else if (request.action === "exportAndCopy") {
        const spans = Array.from(document.querySelectorAll('.gemini-highlighted-text'));
        let exportBlocks = [];
        let currentBlockText = [];
        let lastBlockElement = null;

        spans.forEach(span => {
            let parentBlock = span.closest(UNIVERSAL_CONTAINERS);
            if (!parentBlock) parentBlock = span.parentElement;
            const cleanText = span.textContent.replace(/\s+/g, ' ').trim();
            if (cleanText.length === 0) return;

            if (parentBlock === lastBlockElement && lastBlockElement !== null) {
                currentBlockText.push(cleanText);
            } else {
                if (currentBlockText.length > 0) exportBlocks.push(currentBlockText.join(' '));
                currentBlockText = [cleanText];
                lastBlockElement = parentBlock;
            }
        });
        
        if (currentBlockText.length > 0) exportBlocks.push(currentBlockText.join(' '));
        const finalString = exportBlocks.join('\n\n'); 
        
        if (finalString.length === 0) { sendResponse({ success: false }); return; }

        const ta = document.createElement('textarea');
        ta.value = finalString;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); sendResponse({ success: true }); } 
        catch (err) { sendResponse({ success: false }); } 
        finally { document.body.removeChild(ta); }
    }
});

document.addEventListener('mouseup', () => setTimeout(handleAutoHighlight, 50));
async function handleAutoHighlight() {
    try {
        const data = await chrome.storage.local.get(['lastConfig']);
        const config = data.lastConfig;
        if (!config || !config.autoMode) return;

        const selection = window.getSelection();
        if (selection.toString().trim().length > 5) {
            const parent = selection.anchorNode.parentElement;
            if (parent && parent.classList.contains('gemini-highlighted-text')) return;
            highlightSelection(config.color, config.opacity);
        }
    } catch (e) {}
}