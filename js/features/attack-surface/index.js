// Attack Surface Analysis Module
// Categorizes requests by attack surface using LLM

import { streamExplanationWithSystem, getAISettings } from '../ai/index.js';

/**
 * Build analysis prompt for LLM
 * @param {Array} requests - Array of request objects
 * @returns {string} - Formatted prompt
 */
export function buildAnalysisPrompt(requests) {
    const requestSummaries = requests.map((req, idx) => {
        const url = req.request?.url || '';
        const method = req.request?.method || 'GET';

        // Extract query parameters
        let params = [];
        try {
            const urlObj = new URL(url);
            params = Array.from(urlObj.searchParams.keys());
        } catch (e) {
            // Invalid URL
        }

        // Extract header names (not values for privacy)
        const headerNames = req.request?.headers?.map(h => h.name) || [];

        return {
            index: idx,
            method: method,
            path: url.split('?')[0],
            params: params,
            headers: headerNames.filter(h => !['cookie', 'authorization', 'x-api-key'].includes(h.toLowerCase()))
        };
    });

    const prompt = `Analyze these HTTP requests and group them into security-relevant attack surface categories.

IMPORTANT: Create categories dynamically based on what you see in the requests. Don't use a predefined list.
EVERY request MUST have a category. Do not use "Uncategorized" or "Unknown". If unsure, use generic categories like "General Request", "Static Resource", or "API Endpoint".

Common patterns to look for:
- Authentication & session management
- User data & personal information
- File operations & media handling
- Administrative & privileged functions
- Financial & payment operations
- Third-party integrations
- Analytics & tracking
- API endpoints & data operations
- Static resources

For each request, provide:
1. category: A clear, descriptive category name (e.g., "User Authentication", "Payment Processing", "Admin Panel")
2. confidence: "high", "medium", or "low"
3. reasoning: Brief explanation (max 15 words)
4. icon: A single emoji that represents the category (e.g., 🔐 for auth, 💳 for payments)

Create NEW categories as needed based on the actual functionality you observe.

Requests:
${JSON.stringify(requestSummaries, null, 2)}

Output ONLY valid JSON array in this exact format:
[
  {
    "index": 0,
    "category": "User Authentication",
    "confidence": "high",
    "reasoning": "Login endpoint with credentials",
    "icon": "🔐"
  }
]`;

    return prompt;
}

/**
 * Parse LLM response into categories
 * @param {string} response - LLM response text
 * @returns {Array} - Parsed categories
 */
export function parseCategories(response) {
    try {
        // Extract JSON from markdown code blocks if present
        let jsonText = response.trim();

        // Try to find JSON array pattern
        const jsonArrayMatch = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonArrayMatch) {
            jsonText = jsonArrayMatch[0];
        } else {
            // Fallback: try to find code block
            const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonText = jsonMatch[1];
            }
        }

        let categories;
        try {
            categories = JSON.parse(jsonText);
        } catch (e) {
            console.warn('Main JSON parse failed, attempting regex extraction', e);
            // Fallback: Extract individual objects using regex
            categories = [];
            const objectRegex = /\{\s*"index"\s*:\s*(\d+)[^}]*?"category"\s*:\s*"([^"]*)"[^}]*?\}/g;
            let match;

            // We need a more robust regex that captures the full object structure
            // This is a simplified attempt to salvage data
            const robustRegex = /\{\s*"index"[\s\S]*?\}/g;
            const matches = jsonText.match(robustRegex) || [];

            for (const itemStr of matches) {
                try {
                    // Try to parse each item individually
                    // Add missing braces if needed (though regex should catch them)
                    const item = JSON.parse(itemStr);
                    if (item && typeof item.index !== 'undefined') {
                        categories.push(item);
                    }
                } catch (err) {
                    // Try to fix common JSON errors (trailing commas, etc)
                    try {
                        const fixedStr = itemStr.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
                        const item = JSON.parse(fixedStr);
                        if (item && typeof item.index !== 'undefined') {
                            categories.push(item);
                        }
                    } catch (err2) {
                        // Give up on this item
                    }
                }
            }
        }

        // Validate structure
        if (!Array.isArray(categories)) {
            throw new Error('Response is not an array');
        }

        return categories.map(cat => ({
            index: cat.index,
            category: cat.category || 'General Request',
            confidence: cat.confidence || 'low',
            reasoning: cat.reasoning || 'No reasoning provided',
            icon: cat.icon || '❓'
        }));
    } catch (error) {
        console.error('Failed to parse LLM response:', error);
        console.log('Raw response:', response); // Log raw response for debugging
        return [];
    }
}

/**
 * Analyze attack surface using LLM
 * @param {Array} requests - Array of request objects
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Categories mapped by request index
 */
export async function analyzeAttackSurface(requests, onProgress) {
    const { provider, apiKey, model } = getAISettings();

    if (!apiKey) {
        throw new Error('AI API key not configured. Please set it in Settings.');
    }

    // Limit batch size to control costs
    const batchSize = 50;
    const requestBatch = requests.slice(0, batchSize);

    if (onProgress) {
        onProgress({ status: 'building_prompt', count: requestBatch.length });
    }

    const prompt = buildAnalysisPrompt(requestBatch);

    if (onProgress) {
        onProgress({ status: 'analyzing', count: requestBatch.length });
    }

    const systemPrompt = `You are a security expert analyzing web application attack surfaces. 
Categorize HTTP requests based on their functionality and security implications.
Be precise and consistent. Output ONLY valid JSON.`;

    let fullResponse = '';

    await streamExplanationWithSystem(
        apiKey,
        model,
        systemPrompt,
        prompt,
        (text) => {
            fullResponse = text;
            if (onProgress) {
                onProgress({ status: 'streaming', text: text });
            }
        },
        provider
    );

    if (onProgress) {
        onProgress({ status: 'parsing', text: fullResponse });
    }

    const categories = parseCategories(fullResponse);

    // Map to object for easy lookup
    const categoryMap = {};
    categories.forEach(cat => {
        categoryMap[cat.index] = {
            category: cat.category,
            confidence: cat.confidence,
            reasoning: cat.reasoning,
            icon: cat.icon
        };
    });

    if (onProgress) {
        onProgress({ status: 'complete', categories: categoryMap });
    }

    return categoryMap;
}

/**
 * Cache categories to localStorage
 * @param {Object} categories - Categories mapped by request index
 */
export function cacheCategories(categories) {
    try {
        localStorage.setItem('repPlusAttackSurfaceCache', JSON.stringify(categories));
    } catch (error) {
        console.error('Failed to cache categories:', error);
    }
}

/**
 * Load cached categories from localStorage
 * @returns {Object} - Cached categories or empty object
 */
export function loadCachedCategories() {
    try {
        const cached = localStorage.getItem('repPlusAttackSurfaceCache');
        return cached ? JSON.parse(cached) : {};
    } catch (error) {
        console.error('Failed to load cached categories:', error);
        return {};
    }
}

/**
 * Clear category cache
 */
export function clearCategoryCache() {
    localStorage.removeItem('repPlusAttackSurfaceCache');
}
