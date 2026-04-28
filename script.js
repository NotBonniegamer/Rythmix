/**
 * RYTH-MIX ULTRA ENGINE v3.0 - FULL SOURCE CODE
 * --------------------------------------------
 * Features: 
 * - Dynamische Audio-Analyse (FFT)
 * - Custom Keybinds & Farben (Persistent)
 * - 4-Leben-System mit Regeneration
 * - Trap-Notes mit visueller X-Kennzeichnung
 * - Pre-Game Preview & Countdown
 * - Lokales Leaderboard & Schwierigkeitsgrade
 */

// --- KONSTANTEN & DATENBANK ---
const songDatabase = [
    { title: "Cyber Track 1", url: "songs/Song 1.mp3", bpm: 128 },
    { title: "Neon Drift", url: "songs/Song 2.mp3", bpm: 140 },
    { title: "Bass Line", url: "songs/Song 3.mp3", bpm: 120 },
    { title: "Rave Line", url: "songs/Song 4.mp3", bpm: 155 },
    { title: "Controlele", url: "songs/Song 5.mp3", bpm: 110 },
    { title: "D.M.", url: "songs/Song 6.mp3", bpm: 132 },
    { title: "Synth Wave", url: "songs/Song 7.mp3", bpm: 100 },
    { title: "Hyper Drive", url: "songs/Song 8.mp3", bpm: 180 }
];

// --- GLOBALE VARIABLEN ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Audio State
let audioCtx, analyser, dataArray, source, audio;
let gameRunning = false;
let isPaused = false;

// Score & Stats
let score = 0;
let combo = 0;
let maxCombo = 0;
let notesHit = 0;
let totalNotesSpawned = 0;

// Life System
let lives = 4;
const maxLives = 4;
const regenSpeed = 0.00075; // Ein Leben braucht ca. 45-60 Sek zur vollen Heilung

// Game Objects
let notes = [];
let particles = [];
let stars = []; // Für den Hintergrund-Effekt
let laneGlow = [0, 0, 0, 0];

// Settings & Difficulty
let isExtraMode = false; 
const diffSettings = [
    { label: "BABY", threshold: 240, multiChance: 0.0, beatMin: 400, penalty: 10 },
    { label: "BEGINNER", threshold: 220, multiChance: 0.1, beatMin: 300, penalty: 20 },
    { label: "NORMALO", threshold: 200, multiChance: 0.2, beatMin: 200, penalty: 25 },
    { label: "EXPERT", threshold: 180, multiChance: 0.4, beatMin: 150, penalty: 40 },
    { label: "HACKER", threshold: 160, multiChance: 0.6, beatMin: 100, penalty: 60 },
    { label: "ELITE", threshold: 145, multiChance: 0.8, beatMin: 80, penalty: 80 },
    { label: "GOD", threshold: 130, multiChance: 1.0, beatMin: 50, penalty: 100 },
    { label: "WHY ARE YOU HERE?", threshold: 1000, multiChance: 100.0, beatMin: 25, penalty: 0 }
];

let currentDiffIdx = 2; 
let threshold = 210; 
let lastBeatTime = 0;
let scrollDirection = "up"; 
let scrollSpeed = 12;
let noteSize = 40; 
let laneWidth = 110; 

// Customization
let keys = ['d', 'f', 'j', 'k'];
let laneColors = ["#ff0055", "#00eeff", "#00eeff", "#ff0055"];
let waitingForKey = -1;

// --- INITIALISIERUNG & PERSISTENZ ---

/**
 * Lädt alle gespeicherten Daten aus dem LocalStorage.
 * Verhindert, dass Einstellungen nach einem Refresh verloren gehen.
 */
function loadData() {
    console.log("Loading user data...");
    const saved = JSON.parse(localStorage.getItem('rythMixData'));
    if (saved) {
        if(saved.keys) keys = saved.keys;
        if(saved.colors) laneColors = saved.colors;
        if(saved.speed) scrollSpeed = saved.speed;
        if(saved.direction) scrollDirection = saved.direction;
        if(saved.size) noteSize = saved.size;
        console.log("Data restored successfully.");
    }
}

/**
 * Speichert den aktuellen Status in den LocalStorage.
 */
function saveData() {
    localStorage.setItem('rythMixData', JSON.stringify({
        keys, 
        colors: laneColors, 
        speed: scrollSpeed, 
        direction: scrollDirection, 
        size: noteSize
    }));
}

/**
 * Initialisiert die UI-Elemente beim Start der Anwendung.
 */
function initUI() {
    loadData();
    updateLayout();
    
    const songList = document.getElementById("song-list");
    if(songList) {
        songList.innerHTML = ""; 
        songDatabase.forEach(song => {
            const btn = document.createElement("button");
            btn.className = "song-card";
            btn.innerHTML = `<span>▶</span> ${song.title} <small>${song.bpm} BPM</small>`;
            btn.onclick = () => showPreGamePreview(encodeURI(song.url));
            songList.appendChild(btn);
        });
    }

    // Slider-Werte setzen
    const speedSlider = document.getElementById("speed-slider");
    if(speedSlider) {
        speedSlider.value = scrollSpeed;
        document.getElementById("speed-val").innerText = scrollSpeed;
    }

    // Farben und Keys initialisieren
    for(let i = 0; i < 4; i++) {
        const colPicker = document.getElementById(`color-${i}`);
        const keyDisplay = document.getElementById(`key-${i}`);
        if(colPicker) colPicker.value = laneColors[i];
        if(keyDisplay) keyDisplay.innerText = keys[i].toUpperCase();
    }

    // Scroll-Button Text
    const scrollBtn = document.getElementById("btn-scroll");
    if(scrollBtn) scrollBtn.innerText = `SCROLL: ${scrollDirection.toUpperCase()}`;

    // Hintergrund Sterne generieren
    initStars();
}

/**
 * Erzeugt zufällige Sterne für den Canvas-Hintergrund.
 */
function initStars() {
    stars = [];
    for(let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
}

// --- SETTINGS FUNKTIONEN ---

/**
 * Wechselt zwischen Startbildschirm und Einstellungen.
 */
function toggleSettings(show) {
    document.getElementById("screen-start").classList.toggle("hidden", show);
    document.getElementById("screen-settings").classList.toggle("hidden", !show);
    if(!show) saveData(); // Speichern beim Verlassen
}

/**
 * Ändert den Schwierigkeitsgrad basierend auf dem Slider.
 */
function updateDifficulty(val) {
    currentDiffIdx = parseInt(val);
    const d = diffSettings[currentDiffIdx];
    document.getElementById("diff-label").innerText = d.label;
    threshold = d.threshold;
}

/**
 * Ändert die Scroll-Geschwindigkeit.
 */
function updateCustomSpeed(val) {
    scrollSpeed = parseInt(val);
    document.getElementById("speed-val").innerText = scrollSpeed;
}

/**
 * Verarbeitet Farbaupdates.
 */
function updateColor(lane, color) { 
    laneColors[lane] = color; 
    saveData();
}

/**
 * Aktiviert den Modus zum Neubelegen einer Taste.
 */
function assignKey(lane) {
    waitingForKey = lane;
    const btn = document.getElementById(`key-${lane}`);
    btn.innerText = "...";
    btn.classList.add("waiting");
}

/**
 * Ändert die Richtung, in die die Noten fließen.
 */
function toggleScrollDirection() {
    scrollDirection = scrollDirection === "down" ? "up" : "down";
    document.getElementById("btn-scroll").innerText = `SCROLL: ${scrollDirection.toUpperCase()}`;
}

/**
 * Ändert die visuelle Größe der Noten.
 */
function changeNoteSize() {
    // Zyklus: 35 -> 40 -> 55 -> 75
    if(noteSize === 35) noteSize = 40;
    else if(noteSize === 40) noteSize = 55;
    else if(noteSize === 55) noteSize = 75;
    else noteSize = 35;

    const label = noteSize === 35 ? "SMALL" : (noteSize === 40 ? "MEDIUM" : (noteSize === 55 ? "XXL" : "MONSTER"));
    document.getElementById("btn-size").innerText = `SIZE: ${label}`;
    updateLayout();
}

/**
 * Schaltet den Extra-Modus (Traps) um.
 */
function toggleExtraMode() {
    isExtraMode = !isExtraMode;
    const btn = document.getElementById("btn-extra");
    if(btn) {
        btn.innerText = `EXTRA MODE: ${isExtraMode ? "ON" : "OFF"}`;
        btn.style.borderColor = isExtraMode ? "#ff0055" : "#333";
    }
}

// --- GAMEFLOW & ENGINE ---

/**
 * Zeigt eine kurze Vorschau der Einstellungen vor dem Song-Start.
 */
function showPreGamePreview(url) {
    saveData();
    updateLayout();
    document.getElementById("screen-start").classList.add("hidden");
    
    const preview = document.createElement("div");
    preview.id = "game-preview";
    preview.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.95); display: flex; flex-direction: column; 
        align-items: center; justify-content: center; color: white; 
        z-index: 9999; font-family: 'Segoe UI', sans-serif;
    `;
    
    preview.innerHTML = `
        <h1 style="color:#00eeff; letter-spacing:8px; font-size:3rem; margin-bottom:10px;">READY?</h1>
        <div style="background:rgba(255,255,255,0.05); padding:40px; border: 2px solid #333; border-radius:20px; text-align:left; min-width:350px; box-shadow: 0 0 50px rgba(0,238,255,0.1)">
            <p style="margin:15px 0; font-size:1.2rem;">MODE: <b style="color:#ff0055; float:right;">${diffSettings[currentDiffIdx].label}</b></p>
            <p style="margin:15px 0; font-size:1.2rem;">SPEED: <b style="float:right;">${scrollSpeed}</b></p>
            <p style="margin:15px 0; font-size:1.2rem;">KEYS: <b style="color:#00eeff; float:right;">${keys.join(" ").toUpperCase()}</b></p>
            <p style="margin:15px 0; font-size:1.2rem;">EXTRA: <b style="float:right;">${isExtraMode ? "ENABLED" : "DISABLED"}</b></p>
        </div>
        <h2 id="countdown" style="font-size:120px; color:#ff0055; text-shadow: 0 0 20px #ff0055; margin-top:30px;">3</h2>
    `;
    document.body.appendChild(preview);

    let count = 3;
    const interval = setInterval(() => {
        count--;
        if(count > 0) {
            document.getElementById("countdown").innerText = count;
        } else {
            clearInterval(interval);
            document.body.removeChild(preview);
            startGame(url);
        }
    }, 1000);
}

/**
 * Startet das eigentliche Spiel.
 */
function startGame(url) {
    // State Reset
    lives = 4;
    score = 0;
    combo = 0;
    maxCombo = 0;
    notes = [];
    particles = [];
    gameRunning = true;
    isPaused = false;

    document.getElementById("screen-game").classList.remove("hidden");
    setupAudio(url);
}

/**
 * Initialisiert die Web Audio API für die Echtzeit-Analyse.
 */
function setupAudio(url) {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        
        analyser = audioCtx.createAnalyser();
        source = audioCtx.createMediaElementSource(audio);
        
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        audio.play().catch(e => console.error("Autoplay prevented:", e));
        
        requestAnimationFrame(gameLoop);
        
        audio.onended = () => {
            if(gameRunning) endGame();
        };
    } catch (e) {
        console.error("Audio Setup Error:", e);
        alert("Audio konnte nicht geladen werden. Bitte versuche es erneut.");
    }
}

/**
 * Die Haupt-Rendering-Schleife (Core Element).
 */
function gameLoop() {
    if (!gameRunning || isPaused) return;

    // Canvas Anpassung
    canvas.width = laneWidth * 4;
    canvas.height = window.innerHeight;

    // Lebens-Regeneration & Game Over Check
    if(lives < maxLives) lives += regenSpeed;
    if(lives <= 0) {
        lives = 0;
        endGame();
        return;
    }

    // --- ZEICHNEN ---
    // 1. Hintergrund
    ctx.fillStyle = "#0a0a0e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStars();

    // 2. Lanes & Hit-Zonen
    drawEnvironment();

    // 3. UI Elemente im Spiel
    drawLifeBar();

    // 4. Logik & Analyse
    handleAudioAnalysis();

    // 5. Objekte updaten & zeichnen
    updateNotes();
    updateParticles();

    // Loop fortsetzen
    requestAnimationFrame(gameLoop);
}

/**
 * Zeichnet die animierten Sterne im Hintergrund.
 */
function drawStars() {
    ctx.fillStyle = "white";
    stars.forEach(s => {
        ctx.globalAlpha = Math.random() * 0.5 + 0.3;
        ctx.beginPath();
        ctx.arc(s.x % canvas.width, s.y % canvas.height, s.size, 0, Math.PI * 2);
        ctx.fill();
        s.y += s.speed; // Sterne fallen langsam
    });
    ctx.globalAlpha = 1;
}

/**
 * Zeichnet den Energiebalken.
 */
function drawLifeBar() {
    const w = 220;
    const h = 18;
    const x = canvas.width - w - 40;
    const y = 40;

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);

    // BG
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, y, w, h);

    // Fill
    let pct = lives / maxLives;
    let color = pct > 0.5 ? "#00eeff" : (pct > 0.25 ? "#ffcc00" : "#ff0055");
    
    ctx.fillStyle = color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillRect(x, y, w * pct, h);
    ctx.shadowBlur = 0;

    // Text Label
    ctx.fillStyle = "white";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("CORE SYNC", x, y - 10);
}

/**
 * Analysiert den Audiostream auf Bass-Peaks (Beats).
 */
function handleAudioAnalysis() {
    analyser.getByteFrequencyData(dataArray);
    
    // Wir nehmen die Bass-Frequenzen (Index 2-4)
    let bassValue = 0;
    for(let i = 2; i < 5; i++) bassValue += dataArray[i];
    bassValue /= 3;

    let currentTime = Date.now();
    const minInterval = diffSettings[currentDiffIdx].beatMin;

    if (bassValue > threshold && (currentTime - lastBeatTime > minInterval)) {
        spawnNoteLogic();
        lastBeatTime = currentTime;
    }
}

/**
 * Entscheidet, welche Noten basierend auf Schwierigkeit gespawnt werden.
 */
function spawnNoteLogic() {
    const d = diffSettings[currentDiffIdx];
    const mainLane = Math.floor(Math.random() * 4);
    
    // Extra Mode: Traps erzeugen (Chance 20%)
    if (isExtraMode && Math.random() < 0.2) {
        createNote(mainLane, "trap");
    } else {
        createNote(mainLane, "tap");
        
        // Chance auf Doppel-Noten (Multi-Hits)
        if (Math.random() < d.multiChance) {
            let secondLane = (mainLane + Math.floor(Math.random() * 3) + 1) % 4;
            createNote(secondLane, "tap");
        }
    }
}

/**
 * Erstellt ein Noten-Objekt und fügt es dem Spiel hinzu.
 */
function createNote(lane, type) {
    const startY = scrollDirection === "down" ? -100 : canvas.height + 100;
    notes.push({
        lane: lane,
        y: startY,
        type: type, // "tap" oder "trap"
        hitConfirmed: false
    });
    totalNotesSpawned++;
}

/**
 * Bewegt Noten und prüft auf Verpassen (Miss).
 */
function updateNotes() {
    for (let i = notes.length - 1; i >= 0; i--) {
        let n = notes[i];
        
        // Bewegung
        n.y += (scrollDirection === "down") ? scrollSpeed : -scrollSpeed;
        
        let centerX = n.lane * laneWidth + (laneWidth / 2);
        
        // --- ZEICHNEN DER NOTE ---
        ctx.shadowBlur = 20;
        ctx.shadowColor = (n.type === "trap") ? "#ffffff" : laneColors[n.lane];
        ctx.fillStyle = (n.type === "trap") ? "#ffffff" : laneColors[n.lane];
        
        ctx.beginPath();
        ctx.arc(centerX, n.y, noteSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // X-Markierung für Traps
        if (n.type === "trap") {
            ctx.strokeStyle = "#111";
            ctx.lineWidth = 6;
            let offset = noteSize * 0.4;
            ctx.beginPath();
            ctx.moveTo(centerX - offset, n.y - offset);
            ctx.lineTo(centerX + offset, n.y + offset);
            ctx.moveTo(centerX + offset, n.y - offset);
            ctx.lineTo(centerX - offset, n.y + offset);
            ctx.stroke();
        }

        // --- MISS LOGIK ---
        // Wenn Note das Spielfeld verlässt
        const isOut = (scrollDirection === "down") ? (n.y > canvas.height + 100) : (n.y < -100);
        
        if (isOut) {
            if (n.type === "tap") {
                score = Math.max(0, score - 50);
                lives -= 1.0; // Ein ganzes Leben Abzug bei Miss
                resetCombo();
                updateUI("MISS", "#ff0000");
            }
            notes.splice(i, 1);
        }
    }
}

/**
 * Prüft beim Tastendruck, ob eine Note getroffen wurde.
 */
function checkHit(lane) {
    const hitZoneY = (scrollDirection === "down") ? canvas.height * 0.85 : canvas.height * 0.15;
    let hitFound = false;
    
    // Wir suchen die Note in der Lane, die der HitZone am nächsten ist
    for (let i = 0; i < notes.length; i++) {
        let n = notes[i];
        
        if (n.lane === lane) {
            let dist = Math.abs(n.y - hitZoneY);
            let hitThreshold = noteSize + 50; // Großzügiges Fenster

            if (dist < hitThreshold) {
                if (n.type === "trap") {
                    // TRAP GETROFFEN -> Strafe
                    score = Math.max(0, score - 200);
                    lives -= 1.5;
                    resetCombo();
                    updateUI("POISON!", "#ffffff");
                    createParticles(n.lane * laneWidth + (laneWidth/2), n.y, "#ffffff", 30);
                } else {
                    // TAP GETROFFEN -> Punkte
                    let accuracy = "PERFECT";
                    let points = 100;
                    
                    if(dist > 30) { accuracy = "GREAT"; points = 75; }
                    if(dist > 50) { accuracy = "GOOD"; points = 50; }

                    score += (points + (combo * 10));
                    combo++;
                    notesHit++;
                    if(combo > maxCombo) maxCombo = combo;
                    
                    updateUI(accuracy, laneColors[lane]);
                    createParticles(lane * laneWidth + (laneWidth/2), hitZoneY, laneColors[lane], 20);
                }
                
                notes.splice(i, 1);
                hitFound = true;
                break;
            }
        }
    }

    // Fehlklick (Hit ins Leere)
    if (!hitFound) {
        score = Math.max(0, score - diffSettings[currentDiffIdx].penalty);
        lives -= 0.15; // Kleine Strafe für "Spamming"
        resetCombo();
        updateUI("TOO EARLY", "#ffcc00");
    }
}

// --- VISUELLE EFFEKTE ---

/**
 * Zeichnet die statische Umgebung (Lanes, Hit-Ringe).
 */
function drawEnvironment() {
    const hitZoneY = (scrollDirection === "down") ? canvas.height * 0.85 : canvas.height * 0.15;
    
    // Trennlinien
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for(let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneWidth, 0);
        ctx.lineTo(i * laneWidth, canvas.height);
        ctx.stroke();
    }

    // Lanes Glow & Hit-Targets
    for (let i = 0; i < 4; i++) {
        // Lane Flash bei Tastendruck
        if (laneGlow[i] > 0) {
            let grad = ctx.createLinearGradient(0, hitZoneY, 0, (scrollDirection === "down" ? 0 : canvas.height));
            grad.addColorStop(0, laneColors[i]);
            grad.addColorStop(1, "transparent");
            
            ctx.fillStyle = grad;
            ctx.globalAlpha = laneGlow[i] / 20;
            ctx.fillRect(i * laneWidth, 0, laneWidth, canvas.height);
            ctx.globalAlpha = 1;
            laneGlow[i]--;
        }

        // Ziel-Ringe
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(i * laneWidth + (laneWidth/2), hitZoneY, noteSize + 10, 0, Math.PI * 2);
        ctx.stroke();
        
        // Key Label im Ring
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(keys[i].toUpperCase(), i * laneWidth + (laneWidth/2), hitZoneY + 8);
    }
}

/**
 * Erzeugt Partikel-Explosionen.
 */
function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1.0,
            color: color,
            size: Math.random() * 5 + 2
        });
    }
}

/**
 * Berechnet und zeichnet Partikel.
 */
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// --- INPUT HANDLING ---

/**
 * Globaler Keydown-Listener.
 */
window.addEventListener("keydown", (e) => {
    // Falls wir gerade eine Taste neu belegen (Settings)
    if(waitingForKey !== -1) {
        e.preventDefault();
        const newKey = e.key.toLowerCase();
        
        // Prüfen, ob Taste bereits belegt
        if(keys.includes(newKey)) {
            alert("Diese Taste wird bereits verwendet!");
        } else {
            keys[waitingForKey] = newKey;
            document.getElementById(`key-${waitingForKey}`).innerText = newKey.toUpperCase();
        }
        
        document.getElementById(`key-${waitingForKey}`).classList.remove("waiting");
        waitingForKey = -1;
        saveData();
        return;
    }

    // Pause-Funktion (Space)
    if (e.code === "Space" && gameRunning) {
        e.preventDefault();
        togglePause();
        return;
    }

    // Gameplay Inputs
    if (isPaused || !gameRunning) return;

    const laneIndex = keys.indexOf(e.key.toLowerCase());
    if (laneIndex !== -1) {
        laneGlow[laneIndex] = 15; // Lane aufleuchten lassen
        checkHit(laneIndex);
    }
});

/**
 * Pausiert oder setzt das Spiel fort.
 */
function togglePause() {
    isPaused = !isPaused;
    const overlay = document.getElementById("pause-overlay");
    
    if(isPaused) {
        audio.pause();
        overlay.classList.remove("hidden");
    } else {
        audio.play();
        overlay.classList.add("hidden");
        requestAnimationFrame(gameLoop);
    }
}

// --- UI UPDATES & ENDE ---

/**
 * Aktualisiert die Anzeige für Score und Feedback.
 */
function updateUI(text, color) {
    const scoreEl = document.getElementById("score");
    const comboEl = document.getElementById("combo-num");
    const judgeEl = document.getElementById("judgment");

    if(scoreEl) scoreEl.innerText = Math.floor(score);
    
    if(comboEl) {
        comboEl.innerText = combo > 1 ? combo : "";
        comboEl.style.color = color;
    }

    if(judgeEl) {
        judgeEl.innerText = text;
        judgeEl.style.color = color;
        // Animation zurücksetzen
        judgeEl.style.animation = 'none';
        judgeEl.offsetHeight; // Reflow
        judgeEl.style.animation = 'judgePop 0.4s ease-out';
    }
}

/**
 * Setzt die Combo zurück.
 */
function resetCombo() {
    combo = 0;
    const comboEl = document.getElementById("combo-num");
    if(comboEl) comboEl.innerText = "";
}

/**
 * Berechnet das Layout basierend auf der Notengröße.
 */
function updateLayout() {
    laneWidth = noteSize * 2.8; 
    canvas.width = laneWidth * 4;
}

/**
 * Beendet das Spiel und zeigt Ergebnisse.
 */
function endGame() {
    gameRunning = false;
    if(audio) {
        audio.pause();
        audio.currentTime = 0;
    }

    document.getElementById("screen-game").classList.add("hidden");
    document.getElementById("screen-result").classList.remove("hidden");
    
    // Statistiken anzeigen
    document.getElementById("final-score").innerText = Math.floor(score);
    document.getElementById("final-combo").innerText = maxCombo;
    
    const accuracy = totalNotesSpawned > 0 ? Math.round((notesHit / totalNotesSpawned) * 100) : 0;
    // Falls du ein Accuracy-Feld im HTML hast:
    const accEl = document.getElementById("final-accuracy");
    if(accEl) accEl.innerText = accuracy + "%";

    saveLeaderboard(Math.floor(score));
}

/**
 * Speichert den Highscore lokal.
 */
function saveLeaderboard(newScore) {
    let leaderboard = JSON.parse(localStorage.getItem('rythMixLeaderboard')) || [];
    leaderboard.push({ 
        score: newScore, 
        date: new Date().toLocaleDateString(),
        diff: diffSettings[currentDiffIdx].label 
    });
    
    // Sortieren und Top 5 behalten
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5);
    localStorage.setItem('rythMixLeaderboard', JSON.stringify(leaderboard));
    
    // Liste updaten
    const list = document.getElementById("leaderboard-list");
    if(list) {
        list.innerHTML = leaderboard.map((entry, i) => 
            `<div class="lb-entry">#${i+1} - ${entry.score} pts <small>(${entry.diff})</small></div>`
        ).join("");
    }
}

// --- BOOTSTRAP ---
// Startet die App, wenn das Fenster geladen ist
window.onload = initUI;
