// Request Sender Module - Handles actual HTTP request execution
import { executeRequest } from './capture.js';

/**
 * Sends an HTTP request and returns the raw response
 * @param {string} url - The URL to send the request to
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Object>} Response object with status, headers, body, size, duration
 */
export async function sendRequest(url, options) {
    return await executeRequest(url, options);
}

