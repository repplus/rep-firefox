// Miscellaneous utilities
import { escapeHtml } from './dom.js';
import { highlightHTTP } from './network.js';

export function testRegex(pattern, text) {
    try {
        const regex = new RegExp(pattern);
        return regex.test(text);
    } catch (e) {
        // Invalid regex pattern - don't match anything
        return false;
    }
}

export function decodeJWT(jwt) {
    try {
        // Remove whitespace
        jwt = jwt.trim();

        // Split JWT into parts (header.payload.signature)
        const parts = jwt.split('.');

        if (parts.length !== 3) {
            throw new Error('Invalid JWT format. Expected format: header.payload.signature');
        }

        // Base64URL decode helper
        function base64UrlDecode(str) {
            // Replace base64url characters with base64 characters
            str = str.replace(/-/g, '+').replace(/_/g, '/');

            // Add padding if needed
            while (str.length % 4) {
                str += '=';
            }

            // Decode base64
            try {
                const decoded = atob(str);
                // Convert to JSON string
                return decodeURIComponent(
                    decoded.split('').map(function (c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join('')
                );
            } catch (e) {
                throw new Error('Failed to decode base64: ' + e.message);
            }
        }

        // Decode header
        let header;
        try {
            const headerJson = base64UrlDecode(parts[0]);
            header = JSON.parse(headerJson);
        } catch (e) {
            throw new Error('Failed to decode JWT header: ' + e.message);
        }

        // Decode payload
        let payload;
        try {
            const payloadJson = base64UrlDecode(parts[1]);
            payload = JSON.parse(payloadJson);
        } catch (e) {
            throw new Error('Failed to decode JWT payload: ' + e.message);
        }

        // Format output
        let output = 'JWT Decoded:\n\n';
        output += '=== HEADER ===\n';
        output += JSON.stringify(header, null, 2);
        output += '\n\n=== PAYLOAD ===\n';
        output += JSON.stringify(payload, null, 2);
        output += '\n\n=== SIGNATURE ===\n';
        output += parts[2] + '\n';
        output += '(Signature verification not performed)';

        // Add helpful info if exp claim exists
        if (payload.exp) {
            const expDate = new Date(payload.exp * 1000);
            const now = new Date();
            const isExpired = expDate < now;
            output += '\n\n=== TOKEN INFO ===\n';
            output += `Expiration: ${expDate.toISOString()}\n`;
            output += `Status: ${isExpired ? 'EXPIRED' : 'VALID'}\n`;
            if (isExpired) {
                output += `Expired ${Math.floor((now - expDate) / 1000 / 60)} minutes ago`;
            } else {
                output += `Expires in ${Math.floor((expDate - now) / 1000 / 60)} minutes`;
            }
        }

        return output;

    } catch (error) {
        throw new Error('JWT decode failed: ' + error.message);
    }
}

export function renderDiff(baseline, current) {
    if (typeof Diff === 'undefined') {
        // Fallback to highlighting if Diff library not available
        return highlightHTTP(current);
    }

    const diff = Diff.diffLines(baseline, current);
    let html = '<pre style="margin: 0; padding: 10px; font-family: monospace; font-size: 12px; line-height: 1.5;">';

    diff.forEach(part => {
        const lines = part.value.split('\n');
        lines.forEach((line, idx) => {
            if (idx === lines.length - 1 && line === '') return; // Skip trailing empty line

            if (part.added) {
                html += `<div class="diff-add">+ ${escapeHtml(line)}</div>`;
            } else if (part.removed) {
                html += `<div class="diff-remove">- ${escapeHtml(line)}</div>`;
            } else {
                html += `<div>  ${escapeHtml(line)}</div>`;
            }
        });
    });

    html += '</pre>';
    return html;
}

