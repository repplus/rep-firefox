// Response Parser Module - Formats and processes HTTP responses

/**
 * Formats a response object into a raw HTTP response string
 * @param {Object} result - Response object from fetch
 * @returns {string} Formatted raw HTTP response
 */
export function formatRawResponse(result) {
    // Build raw HTTP response
    const statusLine = `HTTP/1.1 ${result.status || ''} ${result.statusText || ''}`.trim();
    let rawResponse = `${statusLine}\n`;
    
    // Add headers (supports array of objects or iterable entries)
    if (Array.isArray(result.headers)) {
        result.headers.forEach(h => {
            if (h && h.name) rawResponse += `${h.name}: ${h.value ?? ''}\n`;
        });
    } else if (result.headers && typeof result.headers[Symbol.iterator] === 'function') {
        for (const [key, value] of result.headers) {
            rawResponse += `${key}: ${value}\n`;
        }
    }
    rawResponse += '\n';

    // Format body (try to pretty-print JSON)
    const body = result.body ?? '';
    try {
        const json = JSON.parse(body);
        rawResponse += JSON.stringify(json, null, 2);
    } catch (e) {
        rawResponse += body;
    }

    return rawResponse;
}

/**
 * Determines the status badge class based on status code
 * @param {number} status - HTTP status code
 * @returns {string} CSS class name
 */
export function getStatusClass(status) {
    if (status >= 200 && status < 300) {
        return 'status-badge status-2xx';
    } else if (status >= 400 && status < 500) {
        return 'status-badge status-4xx';
    } else if (status >= 500) {
        return 'status-badge status-5xx';
    }
    return 'status-badge';
}

/**
 * Handles redirects (future enhancement)
 * @param {Object} response - Response object
 * @param {Object} options - Original request options
 * @returns {Promise<Object>} Final response after following redirects
 */
export async function followRedirects(response, options) {
    // TODO: Implement redirect following logic
    // For now, just return the response as-is
    return response;
}

