document.addEventListener('DOMContentLoaded', function() {
    console.log("XCHECK Popup erfolgreich geladen.");

    if (checkButton) {
        checkButton.addEventListener('click', function() {
            // Statt einer lokalen Datei öffnen wir jetzt euren echten, laufenden Server!
            window.open('http://localhost:8000', '_blank');
        });
    }
});
