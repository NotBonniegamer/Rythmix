// upload.js
function setupMusicUpload() {
    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.accept = 'audio/mp3, audio/wav';
    uploadInput.id = 'music-upload';
    uploadInput.style.display = 'none';

    // Füge den Button zum Startmenü hinzu
    const container = document.getElementById('song-list-container');
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'song-card';
    uploadBtn.style.borderStyle = 'dashed';
    uploadBtn.innerHTML = `<span>+</span> CUSTOM UPLOAD`;
    
    uploadBtn.onclick = () => uploadInput.click();
    
    uploadInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const objectURL = URL.createObjectURL(file);
            // Wir starten das Spiel direkt mit der Datei
            startGame(objectURL, file.name.replace(/\.[^/.]+$/, ""));
        }
    };

    container.prepend(uploadBtn);
    document.body.appendChild(uploadInput);
}

// Initialisiere den Upload, sobald die Seite lädt
document.addEventListener('DOMContentLoaded', setupMusicUpload);