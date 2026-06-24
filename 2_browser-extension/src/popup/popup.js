/**
 * POPUP SCRIPT
 *
 * Handles the logic for the extension popup UI (opened via the toolbar icon).
 * This is a user-facing interface for displaying and triggering extension actions.
 *
 * NOTES:
 * - Popup is ephemeral (it closes when user clicks outside)
 * - State should be persisted via chrome.storage if needed
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log("XCHECK Popup erfolgreich geladen.");

    if (checkButton) {
        checkButton.addEventListener('click', function() {
            // Statt einer lokalen Datei öffnen wir jetzt euren echten, laufenden Server!
            window.open('http://localhost:8000', '_blank');
        });
    }
});
