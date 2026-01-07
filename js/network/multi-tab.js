// Multi-tab Capture Module
import { actions } from '../core/state.js';
import { events, EVENT_NAMES } from '../core/events.js';

export function initMultiTabCapture() {
    const multiTabBtn = document.getElementById('multi-tab-btn');
    let backgroundPort = null;
    let isConnecting = false;

    function updateMultiTabIcon(enabled) {
        if (!multiTabBtn) return;
        if (enabled) {
            multiTabBtn.classList.add('active');
            multiTabBtn.title = "Multi-tab Capture Enabled (Click to disable)";
            multiTabBtn.style.color = 'var(--accent-color)';
        } else {
            multiTabBtn.classList.remove('active');
            multiTabBtn.title = "Enable Multi-tab Capture";
            multiTabBtn.style.color = '';
        }
    }

    function connectToBackground() {
        if (backgroundPort || isConnecting) return;
        isConnecting = true;

        try {
            backgroundPort = browser.runtime.connect({ name: "rep-panel" });
            console.log("Connected to background service worker");
            isConnecting = false;

            backgroundPort.onMessage.addListener((msg) => {
                if (msg.type === 'captured_request') {
                    const req = msg.data;

                    // Skip requests from the current inspected tab (handled by setupNetworkListener)
                    if (browser.devtools && browser.devtools.inspectedWindow && req.tabId === browser.devtools.inspectedWindow.tabId) return;

                    // Filter out non-HTTP requests
                    if (!req.url || !req.url.startsWith('http')) return;

                    // Filter out Firefox extension requests
                    // Extension IDs are 32-character alphanumeric strings
                    const extensionIdPattern = /^[a-z]{32}$/i;
                    try {
                        const urlObj = new URL(req.url);
                        const hostname = urlObj.hostname.toLowerCase();
                        
                        // Check if hostname is an extension ID (32 alphanumeric chars)
                        // or contains moz-extension:// scheme
                        if (extensionIdPattern.test(hostname) || 
                            req.url.startsWith('moz-extension://') ||
                            req.url.startsWith('about:')) {
                            return;
                        }
                    } catch (e) {
                        // If URL parsing fails, continue with other checks
                    }

                    // Convert to HAR-like format
                    const harEntry = {
                        request: {
                            method: req.method,
                            url: req.url,
                            headers: req.requestHeaders || [],
                            postData: req.requestBody ? { text: req.requestBody } : undefined
                        },
                        response: {
                            status: req.statusCode,
                            statusText: req.statusLine || '',
                            headers: req.responseHeaders || [],
                            content: {
                                mimeType: (req.responseHeaders || []).find(h => h.name.toLowerCase() === 'content-type')?.value || '',
                                text: '' // Response body not available for background requests
                            }
                        },
                        capturedAt: req.timeStamp,
                        fromOtherTab: true, // Flag to indicate source
                        pageUrl: req.initiator || req.url // Use initiator as pageUrl for grouping
                    };

                    // Filter static resources
                    const url = req.url.toLowerCase();
                    const staticExtensions = [
                        '.css', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
                        '.woff', '.woff2', '.ttf', '.eot', '.otf',
                        '.mp4', '.webm', '.mp3', '.wav',
                        '.pdf'
                    ];

                    const isStatic = staticExtensions.some(ext => url.endsWith(ext) || url.includes(ext + '?'));
                    if (isStatic) return;

                    // Use action to add request (automatically emits events)
                    const index = actions.request.add(harEntry);
                }
            });

            backgroundPort.onDisconnect.addListener(() => {
                console.log("Disconnected from background");
                backgroundPort = null;
                isConnecting = false;

                // Only retry if permissions are still granted
                if (browser.permissions) {
                    browser.permissions.contains({
                        permissions: ['webRequest'],
                        origins: ['<all_urls>']
                    }, (result) => {
                        if (result) {
                            console.log("Retrying connection in 2s...");
                            setTimeout(connectToBackground, 2000);
                        } else {
                            updateMultiTabIcon(false);
                        }
                    });
                } else {
                    // Permissions API not available, retry anyway
                    console.log("Retrying connection in 2s...");
                    setTimeout(connectToBackground, 2000);
                }
            });

        } catch (e) {
            console.error('Failed to connect to background script:', e);
            backgroundPort = null;
            isConnecting = false;
            setTimeout(connectToBackground, 2000);
        }
    }

    function disconnectBackground() {
        if (backgroundPort) {
            backgroundPort.disconnect();
            backgroundPort = null;
        }
    }

    // Check initial status
    // Note: browser.permissions may not be available in DevTools panel context
    if (browser.permissions) {
        browser.permissions.contains({
            permissions: ['webRequest'],
            origins: ['<all_urls>']
        }, (result) => {
            if (result) {
                updateMultiTabIcon(true);
                connectToBackground();
            } else {
                updateMultiTabIcon(false);
            }
        });
    } else {
        // Permissions API not available, try to connect anyway
        // The background script will handle permission checks
        updateMultiTabIcon(false);
    }

    // Toggle button handler
    if (multiTabBtn) {
        multiTabBtn.addEventListener('click', () => {
            if (!browser.permissions) {
                // Permissions API not available in DevTools panel
                // Try to connect anyway - user will need to grant permissions manually
                if (backgroundPort) {
                    disconnectBackground();
                    updateMultiTabIcon(false);
                } else {
                    connectToBackground();
                    updateMultiTabIcon(true);
                }
                return;
            }
            
            browser.permissions.contains({
                permissions: ['webRequest'],
                origins: ['<all_urls>']
            }, (result) => {
                if (result) {
                    // Disable: Remove permissions
                    browser.permissions.remove({
                        permissions: ['webRequest'],
                        origins: ['<all_urls>']
                    }, (removed) => {
                        if (removed) {
                            updateMultiTabIcon(false);
                            disconnectBackground();
                        }
                    });
                } else {
                    // Enable: Request permissions
                    browser.permissions.request({
                        permissions: ['webRequest'],
                        origins: ['<all_urls>']
                    }, (granted) => {
                        if (granted) {
                            updateMultiTabIcon(true);
                            connectToBackground();
                        }
                    });
                }
            });
        });
    }
}
