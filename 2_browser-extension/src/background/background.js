/**
 * BACKGROUND SCRIPT (Service Worker - Manifest V3)
 *
 * Central coordination layer of the extension.
 * Runs independently from any webpage or UI and persists in the background
 * (event-driven lifecycle in Manifest V3).
 *
 * RESPONSIBILITIES:
 * - Handle long-running or global extension logic
 * - Coordinate communication between popup and content scripts
 * - Manage shared state (via chrome.storage or runtime memory)
 * - Perform API calls or external requests (if needed)
 * - Listen for extension-wide events (install, update, messages)
 *
 * DO NOT:
 * - Directly manipulate webpage DOM (use content-script instead)
 * - Handle UI rendering (use popup or content-script)
 * - Store UI-specific logic here
 *
 * NOTES:
 * - This runs as a Service Worker (NOT a persistent background page)
 * - It can be terminated by the browser when idle and restarted on events
 * - Communication is done via chrome.runtime.sendMessage / onMessage
 */


//TODO
