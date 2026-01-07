// Request Handler Module - High-level orchestrator for sending requests
import { state, addToHistory } from '../core/state.js';
import { elements } from '../ui/main-ui.js';
import { events, EVENT_NAMES } from '../core/events.js';
import { parseRequest } from './capture.js';
import { sendRequest } from './request-sender.js';
import { formatRawResponse, getStatusClass } from './response-parser.js';
import { formatBytes } from '../core/utils/format.js';
import { renderDiff } from '../core/utils/misc.js';
import { highlightHTTP } from '../core/utils/network.js';
import { generateHexView } from '../ui/hex-view.js'
import { generateJsonView } from '../ui/json-view.js'
import { saveEditorState } from '../ui/request-editor.js';

export async function handleSendRequest() {
    const rawContent = elements.rawRequestInput.innerText;
    const useHttps = elements.useHttpsCheckbox.checked;

    // Save editor state before sending (preserve modifications)
    if (state.selectedRequest) {
        const requestIndex = state.requests.indexOf(state.selectedRequest);
        if (requestIndex !== -1) {
            saveEditorState(requestIndex);
        }
    }

    // Add to history
    addToHistory(rawContent, useHttps);
    events.emit(EVENT_NAMES.UI_UPDATE_HISTORY_BUTTONS);

    try {
        const { url, options, method, filteredHeaders, bodyText } = parseRequest(rawContent, useHttps);

        elements.resStatus.textContent = 'Sending...';
        elements.resStatus.className = 'status-badge';

        console.log('Sending request to:', url);

        const result = await sendRequest(url, options);

        elements.resTime.textContent = `${result.duration}ms`;
        elements.resSize.textContent = formatBytes(result.size);

        elements.resStatus.textContent = `${result.status} ${result.statusText}`;
        elements.resStatus.className = getStatusClass(result.status);

        // Format raw HTTP response
        const rawResponse = formatRawResponse(result);

        // Store current response
        state.currentResponse = rawResponse;
        
        // Save editor state (including response) after receiving response
        if (state.selectedRequest) {
            const requestIndex = state.requests.indexOf(state.selectedRequest);
            if (requestIndex !== -1) {
                saveEditorState(requestIndex);
            }
        }

        // Handle Diff Baseline
        if (!state.regularRequestBaseline) {
            state.regularRequestBaseline = rawResponse;
            elements.diffToggle.style.display = 'none';
        } else {
            elements.diffToggle.style.display = 'flex';
            if (elements.showDiffCheckbox && elements.showDiffCheckbox.checked) {
                elements.rawResponseDisplay.innerHTML = renderDiff(state.regularRequestBaseline, rawResponse);
            } else {
                elements.rawResponseDisplay.innerHTML = highlightHTTP(rawResponse);
            }
        }

        // If diff not enabled or first response
        if (!elements.showDiffCheckbox || !elements.showDiffCheckbox.checked || !state.regularRequestBaseline || state.regularRequestBaseline === rawResponse) {
            elements.rawResponseDisplay.innerHTML = highlightHTTP(rawResponse);
        }

        elements.rawResponseDisplay.style.display = 'block';
        elements.rawResponseDisplay.style.visibility = 'visible';

        // Update other tabs as well
        elements.rawResponseText.textContent = rawResponse;
        elements.hexResponseDisplay.textContent = generateHexView(rawResponse);
        elements.jsonResponseDisplay.innerHTML = '';
        elements.jsonResponseDisplay.appendChild(generateJsonView(rawResponse));

    } catch (err) {
        console.error('Request Failed:', err);

        // Check for missing permissions if it's a fetch error
        // Note: In Firefox, permissions are granted at install time, not runtime
        if (err.message === 'Failed to fetch' || err.message.includes('NetworkError')) {
            // In Firefox, if permissions aren't available, they need to be granted at install time
            // or manually enabled in about:addons
            showPermissionError();
        } else {
            showError(err);
        }
    }
}

// Show permission error (Firefox uses static permissions granted at install time)
function showPermissionError() {
    elements.resStatus.textContent = 'Permission Required';
    elements.resStatus.className = 'status-badge status-4xx';
    elements.resTime.textContent = '0ms';
    elements.rawResponseDisplay.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <h3 style="margin-top: 0;">Permission Required</h3>
            <p>To replay requests to any domain, Rep+ needs the <code>&lt;all_urls&gt;</code> permission.</p>
            <p><strong>In Firefox, permissions are granted at install time.</strong> If you didn't grant this permission during installation, please:</p>
            <ol style="text-align: left; display: inline-block; margin: 15px auto;">
                <li>Go to <code>about:addons</code></li>
                <li>Find <strong>Rep+</strong> extension</li>
                <li>Click the gear icon (⚙️) next to the extension</li>
                <li>Click "Manage" or "Permissions"</li>
                <li>Enable "Access your data for all web sites"</li>
                <li>Reload the extension</li>
            </ol>
            <p style="margin-top: 15px;">Alternatively, reinstall the extension and grant the permission during installation.</p>
        </div>
    `;
    elements.rawResponseDisplay.style.display = 'block';
}

function showError(err) {
    elements.resStatus.textContent = 'Error';
    elements.resStatus.className = 'status-badge status-5xx';
    elements.resTime.textContent = '0ms';
    elements.rawResponseDisplay.textContent = `Error: ${err.message}\n\nStack: ${err.stack}`;
    elements.rawResponseDisplay.style.display = 'block';
}
