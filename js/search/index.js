// Search Module
import { elements } from '../ui/main-ui.js';
import { highlightHTTP } from '../core/utils/network.js';

export function initSearch() {
    // In-pane search functionality
    const requestSearchInput = document.getElementById('request-search');
    const responseSearchInput = document.getElementById('response-search');
    const requestSearchCount = document.getElementById('request-search-count');
    const responseSearchCount = document.getElementById('response-search-count');
    const requestPrevBtn = document.getElementById('request-search-prev');
    const requestNextBtn = document.getElementById('request-search-next');
    const responsePrevBtn = document.getElementById('response-search-prev');
    const responseNextBtn = document.getElementById('response-search-next');

    let requestCurrentMatch = 0;
    let responseCurrentMatch = 0;
    let requestMatches = [];
    let responseMatches = [];

    function updateCurrentHighlight(matches, currentIndex) {
        matches.forEach((mark, index) => {
            if (index === currentIndex) {
                mark.classList.add('current');
            } else {
                mark.classList.remove('current');
            }
        });
    }

    function navigateMatch(element, matches, currentIndex, direction, countElement) {
        if (matches.length === 0) return currentIndex;

        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = matches.length - 1;
        if (newIndex >= matches.length) newIndex = 0;

        updateCurrentHighlight(matches, newIndex);
        matches[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (countElement) {
            countElement.textContent = `${newIndex + 1}/${matches.length}`;
        }

        return newIndex;
    }

    function highlightSearchResults(element, searchTerm, countElement, prevBtn, nextBtn) {
        if (!element || !searchTerm) {
            if (countElement) countElement.textContent = '';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return [];
        }

        const content = element.textContent || element.innerText;
        if (!content) {
            if (countElement) countElement.textContent = '';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return [];
        }

        // Case-insensitive search in text content
        const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
        const matches = content.match(regex);

        if (!matches || matches.length === 0) {
            if (countElement) countElement.textContent = 'No matches';
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return [];
        }

        // Update count
        if (countElement) {
            countElement.textContent = `1/${matches.length}`;
        }

        // Enable navigation buttons
        if (prevBtn) prevBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;

        // Highlight matches only in text nodes, not in HTML tags
        const highlightElements = highlightTextNodes(element, regex);

        // Set first match as current
        if (highlightElements.length > 0) {
            highlightElements[0].classList.add('current');
            highlightElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        return highlightElements;
    }

    function highlightTextNodes(element, regex) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodesToReplace = [];
        let node;

        while (node = walker.nextNode()) {
            if (node.nodeValue && regex.test(node.nodeValue)) {
                nodesToReplace.push(node);
            }
        }

        // Reset regex lastIndex
        regex.lastIndex = 0;

        const highlightElements = [];

        nodesToReplace.forEach(node => {
            const text = node.nodeValue;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            // Reset regex for this node
            const nodeRegex = new RegExp(regex.source, regex.flags);

            while ((match = nodeRegex.exec(text)) !== null) {
                // Add text before match
                if (match.index > lastIndex) {
                    fragment.appendChild(
                        document.createTextNode(text.substring(lastIndex, match.index))
                    );
                }

                // Add highlighted match
                const mark = document.createElement('mark');
                mark.className = 'search-highlight';
                mark.textContent = match[0];
                fragment.appendChild(mark);
                highlightElements.push(mark);

                lastIndex = match.index + match[0].length;
            }

            // Add remaining text
            if (lastIndex < text.length) {
                fragment.appendChild(
                    document.createTextNode(text.substring(lastIndex))
                );
            }

            node.parentNode.replaceChild(fragment, node);
        });

        return highlightElements;
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function clearSearchHighlights(element) {
        if (!element) return;
        const marks = element.querySelectorAll('.search-highlight');
        marks.forEach(mark => {
            const text = mark.textContent;
            mark.replaceWith(text);
        });
    }

    if (requestSearchInput) {
        requestSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            const editor = elements.rawRequestInput;

            if (!searchTerm) {
                clearSearchHighlights(editor);
                if (requestSearchCount) requestSearchCount.textContent = '';
                if (requestPrevBtn) requestPrevBtn.disabled = true;
                if (requestNextBtn) requestNextBtn.disabled = true;
                requestMatches = [];
                requestCurrentMatch = 0;
                return;
            }

            // Re-render with highlighting
            const rawText = editor.textContent || editor.innerText;
            editor.innerHTML = highlightHTTP(rawText);
            requestMatches = highlightSearchResults(editor, searchTerm, requestSearchCount, requestPrevBtn, requestNextBtn);
            requestCurrentMatch = 0;
        });

        // Enter key to navigate to next match
        requestSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && requestMatches.length > 0) {
                e.preventDefault();
                requestCurrentMatch = navigateMatch(elements.rawRequestInput, requestMatches, requestCurrentMatch, 1, requestSearchCount);
            }
        });
    }

    if (responseSearchInput) {
        responseSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            const display = elements.rawResponseDisplay;

            if (!searchTerm) {
                clearSearchHighlights(display);
                if (responseSearchCount) responseSearchCount.textContent = '';
                if (responsePrevBtn) responsePrevBtn.disabled = true;
                if (responseNextBtn) responseNextBtn.disabled = true;
                responseMatches = [];
                responseCurrentMatch = 0;
                return;
            }

            // Re-render with highlighting
            const rawText = display.textContent || display.innerText;
            display.innerHTML = highlightHTTP(rawText);
            responseMatches = highlightSearchResults(display, searchTerm, responseSearchCount, responsePrevBtn, responseNextBtn);
            responseCurrentMatch = 0;
        });

        // Enter key to navigate to next match
        responseSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && responseMatches.length > 0) {
                e.preventDefault();
                responseCurrentMatch = navigateMatch(elements.rawResponseDisplay, responseMatches, responseCurrentMatch, 1, responseSearchCount);
            }
        });
    }

    // Navigation button listeners
    if (requestPrevBtn) {
        requestPrevBtn.addEventListener('click', () => {
            requestCurrentMatch = navigateMatch(elements.rawRequestInput, requestMatches, requestCurrentMatch, -1, requestSearchCount);
        });
    }

    if (requestNextBtn) {
        requestNextBtn.addEventListener('click', () => {
            requestCurrentMatch = navigateMatch(elements.rawRequestInput, requestMatches, requestCurrentMatch, 1, requestSearchCount);
        });
    }

    if (responsePrevBtn) {
        responsePrevBtn.addEventListener('click', () => {
            responseCurrentMatch = navigateMatch(elements.rawResponseDisplay, responseMatches, responseCurrentMatch, -1, responseSearchCount);
        });
    }

    if (responseNextBtn) {
        responseNextBtn.addEventListener('click', () => {
            responseCurrentMatch = navigateMatch(elements.rawResponseDisplay, responseMatches, responseCurrentMatch, 1, responseSearchCount);
        });
    }
}
