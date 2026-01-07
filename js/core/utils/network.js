// Network-related utilities
import { escapeHtml } from './dom.js';

export function getHostname(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return 'unknown';
    }
}

export function highlightHTTP(text) {
    if (!text) return '';

    const lines = text.split('\n');
    let inBody = false;
    let bodyStartIndex = -1;

    // Check if this is a response (starts with HTTP version)
    const isResponse = lines[0] && lines[0].toUpperCase().startsWith('HTTP/');

    // Find where body starts (first empty line)
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '') {
            inBody = true;
            bodyStartIndex = i;
            break;
        }
    }

    let highlighted = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i === 0) {
            // Request line: METHOD PATH VERSION
            const firstSpace = line.indexOf(' ');
            if (firstSpace > -1) {
                const method = line.substring(0, firstSpace);
                const rest = line.substring(firstSpace + 1);

                highlighted += `<span class="http-method">${escapeHtml(method)}</span> `;

                let path = rest;
                let version = '';

                // Match version at end: (space)? (HTTP/x.x | hx | QUIC)
                // Handles attached HTTP/x.x (e.g. pathHTTP/1.1) and space-separated short versions (e.g. path h3)
                const versionRegex = /(\s*HTTP\/\d+(\.\d+)?|\s+([hH]\d+|QUIC))$/i;
                const match = rest.match(versionRegex);

                if (match) {
                    path = rest.substring(0, match.index);
                    version = rest.substring(match.index);
                }

                const qIndex = path.indexOf('?');
                if (qIndex > -1) {
                    highlighted += `<span class="http-path">${escapeHtml(path.substring(0, qIndex))}</span>?`;
                    highlighted += highlightParams(path.substring(qIndex + 1));
                } else {
                    highlighted += `<span class="http-path">${escapeHtml(path)}</span>`;
                }

                if (version) {
                    highlighted += `<span class="http-version">${escapeHtml(version)}</span>`;
                }
            } else {
                highlighted += escapeHtml(line);
            }
        } else if (!inBody || i < bodyStartIndex) {
            // Header line
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const headerName = line.substring(0, colonIndex);
                const headerValue = line.substring(colonIndex + 1);
                highlighted += `<span class="http-header-name">${escapeHtml(headerName)}</span>`;
                highlighted += '<span class="http-colon">:</span>';

                if (headerName.trim().toLowerCase() === 'cookie') {
                    highlighted += highlightCookies(headerValue);
                } else {
                    highlighted += `<span class="http-header-value">${escapeHtml(headerValue)}</span>`;
                }
            } else {
                highlighted += escapeHtml(line);
            }
        } else if (i === bodyStartIndex) {
            // Empty line between headers and body
            highlighted += '';
        } else {
            // Body - try to detect and highlight JSON or Params
            const bodyContent = lines.slice(bodyStartIndex + 1).join('\n');
            let bodyHighlighted = highlightJSON(bodyContent);

            // Only highlight params if NOT a response (so it's a request) AND not JSON
            if (!isResponse && bodyHighlighted === escapeHtml(bodyContent)) {
                bodyHighlighted = highlightParams(bodyContent);
            }
            highlighted += bodyHighlighted;
            break;
        }

        if (i < lines.length - 1) {
            highlighted += '\n';
        }
    }

    return highlighted;
}

function highlightJSON(text) {
    try {
        // Try to parse as JSON
        JSON.parse(text);

        // If successful, highlight JSON syntax
        return text.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
            (match) => {
                let cls = 'json-number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'json-key';
                    } else {
                        cls = 'json-string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'json-boolean';
                } else if (/null/.test(match)) {
                    cls = 'json-null';
                }
                return `<span class="${cls}">${escapeHtml(match)}</span>`;
            }
        );
    } catch (e) {
        // Not JSON, return as-is
        return escapeHtml(text);
    }
}

function highlightParams(text) {
    // Avoid highlighting HTML/XML as params
    if (text.trim().startsWith('<')) return escapeHtml(text);

    if (text.indexOf('=') === -1) return escapeHtml(text);

    return text.split('&').map(part => {
        const eqIndex = part.indexOf('=');
        if (eqIndex > -1) {
            const key = part.substring(0, eqIndex);
            const value = part.substring(eqIndex + 1);
            return `<span class="param-key">${escapeHtml(key)}</span>=<span class="param-value">${escapeHtml(value)}</span>`;
        } else {
            return escapeHtml(part);
        }
    }).join('&');
}

function highlightCookies(text) {
    return text.split(';').map(part => {
        const eqIndex = part.indexOf('=');
        if (eqIndex > -1) {
            const key = part.substring(0, eqIndex);
            const value = part.substring(eqIndex + 1);
            return `<span class="cookie-key">${escapeHtml(key)}</span>=<span class="cookie-value">${escapeHtml(value)}</span>`;
        } else {
            return escapeHtml(part);
        }
    }).join(';');
}

