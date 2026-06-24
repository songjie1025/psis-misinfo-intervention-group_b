// Floating Logo Component

function createFloatingLogo() {
    // div-Element für das Logo
    const logoBadge = document.createElement('div');
    logoBadge.id = 'xcheck-floating-logo';

    // XCHECK-Logo unten rechts
    Object.assign(logoBadge.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '45px',
        height: '45px',
        //backgroundColor: '#1d9bf0',
        color: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: 'bold',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: '9999',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.2s ease'
    });

    // Hover-Effekt, wenn man mit der Maus drüberfährt
    logoBadge.onmouseenter = () => logoBadge.style.transform = 'scale(1.1)';
    logoBadge.onmouseleave = () => logoBadge.style.transform = 'scale(1.0)';

    // Logo einsetzen

    // Holt den sicheren internen Chrome-Pfad für das Bild
    const imgUrl = chrome.runtime.getURL('shield.png');

    // Fügt das Bild ein und sorgt dafür, dass es perfekt in den Kreis passt
    logoBadge.innerHTML = `
        <img src="${imgUrl}"
            style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" />
    `;

    return logoBadge;
}

export function injectFloatingLogo() {
    // Prüfen, ob das Logo nicht schon da ist
    if (document.getElementById('xcheck-floating-logo')) {
        return;
    }

    const logo = createFloatingLogo();
    document.body.appendChild(logo);
    console.log("XCHECK Floating Logo erfolgreich geladen!");
}
