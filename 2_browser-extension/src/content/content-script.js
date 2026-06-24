/**
 * CONTENT SCRIPT
 *
 * This script runs directly inside the target webpage context.
 *
 * RESPONSIBILITIES: (keep this file lightweight!)
 * - only orchestration and DOM injection
 * - use components from content/components for actual DOM elements
 *
 * DO NOT:
 * - Put business logic or API calls here (use background/pipeline instead)
 * - Assume module imports work (unless bundler is used)
 *
 * NOTES:
 * - Runs in an isolated Chrome extension context (not normal page JS)
 * - Communicates with other parts of the extension via messaging if needed
 */

console.log("content-script.js loaded");

injectFloatingLogo();
