/**
 * RYTH-MIX ULTRA ENGINE v4.0 - FINAL INTEGRATION
 * ----------------------------------------------
 * Vollständig kompatibel mit dem bereitgestellten HTML.
 * Inklusive: Pause-System, Lebens-Regeneration, Minus-Punkte, 
 * Settings-Menü & "Why are you here?" Extreme Mode.
 */

// --- 1. DATEN & KONFIGURATION ---

const songDatabase = [
    { title: "Cyber Track", url: "songs/Song 1.mp3", bpm: 128 },
    { title: "Neon Drift", url: "songs/Song 2.mp3", bpm: 140 },
    { title: "Bass Line", url: "songs/Song 3.mp3", bpm: 120 },
    { title: "Rave Line", url: "songs/Song 4.mp3", bpm: 155 },
    { title: "Controlele", url: "songs/Song 5.mp3", bpm: 110 },
    { title: "D.M.", url: "songs/Song 6.mp3", bpm: 132 },
    { title: "Synth Wave", url: "songs/Song 7.mp3", bpm: 100 },
    { title: "Hyper Drive", url: "songs/Song 8.mp3", bpm: 180 }
];

// Schwierigkeitsgrade (Slider Stufen 0-7)
const diffSettings = [
    { label: "BABY", threshold: 240, multiChance: 0.0, beatMin: 400, penalty: 10 },
    { label: "BEGINNER", threshold: 220, multiChance: 0.1, beatMin: 300, penalty: 20 },
    { label: "NORMALO", threshold: 200, multiChance: 0.2, beatMin: 200, penalty: 25 },
    { label: "EXPERT", threshold: 180, multiChance: 0.4, beatMin: 150, penalty: 40 },
    { label: "HACKER", threshold: 160, multiChance: 0.6, beatMin: 100, penalty: 60 },
    { label: "ELITE", threshold: 145, multiChance: 0.8, beatMin: 80, penalty: 80 },
    { label: "GOD", threshold: 130, multiChance: 1.0, beatMin: 50, penalty: 100 },
    { label: "WHY ARE YOU HERE?", threshold: 110, multiChance: 1.0, beatMin: 20, penalty: 150 }
];

// --- 2. GLOBALE VARIABLEN ---

// Engine State
let gameRunning = false;
let isPaused = false;
let score = 0;
let combo = 0;
let maxCombo = 0;
let notesHit = 0;
let totalNotesSpawned = 0;

// Life System
let lives = 4;
const maxLives = 4;
const regenSpeed = 0.0008; // Regeneration pro Frame

// Audio Kontext
let audioCtx, analyser, dataArray, source, audio;

// Gameplay Objekte
let notes = [];
let particles = [];
let laneGlow = [0, 0, 0, 0];
let stars = [];

// Aktuelle Einstellungen (Default)
let currentDiffIdx = 2; 
let threshold = 200; 
let lastBeatTime = 0;
let scrollDirection = "up"; 
let scrollSpeed = 12;
let noteSize = 40; 
let laneWidth = 110; 
let isExtraMode = false;
let keys = ['d', 'f', 'j', 'k'];
let laneColors = ["#ff0055", "#00eeff", "#00eeff", "#ff0055"];
let waitingForKey = -1;

// Canvas Referenz
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- 3. INITIALISIERUNG & UI ---

/**
 * Startet das System und lädt gespeicherte Nutzerdaten.
 */
function initApp() {
    console.log("Initializing RythMix...");
    loadPersistentData();
    initSongList();
    initStars();
    updateLayout();
    
    // Slider Limits im HTML sicherstellen
    const diffSlider = document.getElementById("diff-slider");
    if(diffSlider) diffSlider.max = diffSettings.length - 1;

    window.requestAnimationFrame(mainMenuLoop);
}

function initSongList() {
    const list = document.getElementById("song-list");
    if(!list) return;
    list.innerHTML = "";
    songDatabase.forEach(song => {
        const btn = document.createElement("button");
        btn.className = "song-card";
        btn.innerHTML = `<span>▶</span> ${song.title} <small>${song.bpm} BPM</small>`;
        btn.onclick = () => showPreGamePreview(encodeURI(song.url));
        list.appendChild(btn);
    });
}

/**
 * Schaltet zwischen den Screens um (Settings Button Integration)
 */
function toggleSettings(show) {
    const startScreen = document.getElementById("screen-start");
    const settingsScreen = document.getElementById("screen-settings");
    
    if (show) {
        startScreen.classList.add("hidden");
        settingsScreen.classList.remove("hidden");
    } else {
        settingsScreen.classList.add("hidden");
        startScreen.classList.remove("hidden");
        savePersistentData();
    }
}

// --- 4. EINSTELLUNGEN LOGIK ---

function updateDifficulty(val) {
    currentDiffIdx = parseInt(val);
    const d = diffSettings[currentDiffIdx];
    document.getElementById("diff-label").innerText = d.label;
    threshold = d.threshold;
}

function updateCustomSpeed(val) {
    scrollSpeed = parseInt(val);
    document.getElementById("speed-val").innerText = scrollSpeed;
}

function toggleExtraMode() {
    isExtraMode = !isExtraMode;
    const btn = document.getElementById("btn-extra");
    btn.innerText = `EXTRA MODE: ${isExtraMode ? "ON" : "OFF"}`;
    btn.style.boxShadow = isExtraMode ? "0 0 15px #ff0055" : "none";
}

function toggleScrollDirection() {
    scrollDirection = (scrollDirection === "up") ? "down" : "up";
    document.getElementById("btn-scroll").innerText = `SCROLL: ${scrollDirection.toUpperCase()}`;
}

function changeNoteSize() {
    const sizes = [35, 40, 55, 75];
    const labels = ["SMALL", "MEDIUM", "XXL", "MONSTER"];
    let idx = sizes.indexOf(noteSize);
    idx = (idx + 1) % sizes.length;
    noteSize = sizes[idx];
    document.getElementById("btn-size").innerText = `SIZE: ${labels[idx]}`;
    updateLayout();
}

function assignKey(lane) {
    waitingForKey = lane;
    const btns = document.querySelectorAll(".key-btn");
    btns.forEach(b => b.classList.remove("waiting"));
    document.getElementById(`key-${lane}`).classList.add("waiting");
    document.getElementById(`key-${lane}`).innerText = "...";
}

// --- 5. PAUSE SYSTEM ---

/**
 * Schaltet die Pause an/aus.
 */
function togglePause() {
    if (!gameRunning) return;

    isPaused = !isPaused;
    const pauseOverlay = document.getElementById("pause-overlay");

    if (isPaused) {
        audio.pause();
        pauseOverlay.classList.remove("hidden");
        console.log("Game Paused");
    } else {
        audio.play();
        pauseOverlay.classList.add("hidden");
        console.log("Game Resumed");
        requestAnimationFrame(gameLoop);
    }
}

// --- 6. CORE GAME ENGINE ---

function showPreGamePreview(url) {
    document.getElementById("screen-start").classList.add("hidden");
    
    const preview = document.createElement("div");
    preview.id = "game-preview-overlay";
    preview.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:Orbitron, sans-serif;";
    preview.innerHTML = `
        <h1 style="font-size:3rem; color:#00eeff; margin-bottom:20px;">GET READY</h1>
        <div style="background:rgba(255,255,255,0.05); padding:30px; border-radius:15px; border:1px solid #333; text-align:center;">
            <p>Difficulty: <b style="color:#ff0055">${diffSettings[currentDiffIdx].label}</b></p>
            <p>Speed: <b>${scrollSpeed}</b></p>
            <p>Keys: <b>${keys.join(" ").toUpperCase()}</b></p>
        </div>
        <h2 id="countdown-text" style="font-size:6rem; margin-top:20px;">3</h2>
    `;
    document.body.appendChild(preview);

    let count = 3;
    const timer = setInterval(() => {
        count--;
        if(count > 0) {
            document.getElementById("countdown-text").innerText = count;
        } else {
            clearInterval(timer);
            document.body.removeChild(preview);
            startGame(url);
        }
    }, 1000);
}

function startGame(url) {
    // Reset Stats
    score = 0; combo = 0; maxCombo = 0; notesHit = 0; totalNotesSpawned = 0;
    lives = 4; notes = []; particles = [];
    
    document.getElementById("screen-game").classList.remove("hidden");
    document.getElementById("score").innerText = "0";
    
    setupAudio(url);
    gameRunning = true;
    isPaused = false;
    requestAnimationFrame(gameLoop);
}

function setupAudio(url) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    audio.play();
    audio.onended = () => endGame();
}

/**
 * Die Hauptschleife des Gameplays.
 */
function gameLoop() {
    if (!gameRunning || isPaused) return;

    // Canvas Reinigung & Background
    ctx.fillStyle = "#0a0a0e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Regeneration & Death Check
    if (lives < maxLives) lives += regenSpeed;
    if (lives <= 0) { endGame(); return; }

    drawStars();
    drawEnvironment();
    drawLifeBar();
    
    handleAudioAnalysis();
    updateNotes();
    updateParticles();

    requestAnimationFrame(gameLoop);
}

function drawLifeBar() {
    const w = 200, h = 12;
    const x = canvas.width - w - 20, y = 30;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = lives > 1 ? "#00eeff" : "#ff0055";
    ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(x, y, (lives / maxLives) * w, h);
    ctx.shadowBlur = 0;
}

function handleAudioAnalysis() {
    analyser.getByteFrequencyData(dataArray);
    let bass = dataArray[2]; // Tiefenbereich
    let now = Date.now();
    const minGap = diffSettings[currentDiffIdx].beatMin;

    if (bass > threshold && (now - lastBeatTime > minGap)) {
        spawnNote();
        lastBeatTime = now;
    }
}

function spawnNote() {
    const lane = Math.floor(Math.random() * 4);
    const startY = (scrollDirection === "down") ? -100 : canvas.height + 100;
    
    let type = "tap";
    if (isExtraMode && Math.random() < 0.2) type = "trap";
    
    notes.push({ lane, y: startY, type });
    totalNotesSpawned++;

    // Chance auf Doppel-Noten bei hoher Difficulty
    if (Math.random() < diffSettings[currentDiffIdx].multiChance) {
        let lane2 = (lane + 1) % 4;
        notes.push({ lane: lane2, y: startY, type: "tap" });
        totalNotesSpawned++;
    }
}

function updateNotes() {
    const hitZoneY = (scrollDirection === "down") ? canvas.height * 0.85 : canvas.height * 0.15;

    for (let i = notes.length - 1; i >= 0; i--) {
        let n = notes[i];
        n.y += (scrollDirection === "down") ? scrollSpeed : -scrollSpeed;
        
        // Zeichnen
        let cx = n.lane * laneWidth + (laneWidth / 2);
        ctx.fillStyle = (n.type === "trap") ? "#ffffff" : laneColors[n.lane];
        ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(cx, n.y, noteSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (n.type === "trap") {
            ctx.strokeStyle = "#000"; ctx.lineWidth = 4;
            let o = noteSize * 0.4;
            ctx.beginPath(); 
            ctx.moveTo(cx-o, n.y-o); ctx.lineTo(cx+o, n.y+o);
            ctx.moveTo(cx+o, n.y-o); ctx.lineTo(cx-o, n.y+o);
            ctx.stroke();
        }

        // Miss Check
        const isOut = (scrollDirection === "down") ? (n.y > canvas.height + 50) : (n.y < -50);
        if (isOut) {
            if (n.type === "tap") {
                score = Math.max(0, score - 50); // MINUS PUNKTE
                lives -= 1; // LEBEN ABZUG
                resetCombo();
                updateUI("MISS", "#ff0000");
            }
            notes.splice(i, 1);
        }
    }
}

function checkHit(lane) {
    const hitZoneY = (scrollDirection === "down") ? canvas.height * 0.85 : canvas.height * 0.15;
    let hitFound = false;

    for (let i = 0; i < notes.length; i++) {
        let n = notes[i];
        if (n.lane === lane && Math.abs(n.y - hitZoneY) < (noteSize + 60)) {
            if (n.type === "trap") {
                score = Math.max(0, score - 150);
                lives -= 1.5;
                resetCombo();
                updateUI("POISON!", "#ffffff");
            } else {
                score += 100 + (combo * 10);
                combo++;
                notesHit++;
                if (combo > maxCombo) maxCombo = combo;
                updateUI("PERFECT", laneColors[lane]);
                createParticles(lane * laneWidth + (laneWidth/2), hitZoneY, laneColors[lane]);
            }
            notes.splice(i, 1);
            hitFound = true;
            break;
        }
    }

    if (!hitFound) {
        score = Math.max(0, score - diffSettings[currentDiffIdx].penalty);
        lives -= 0.1; 
        resetCombo();
        updateUI("MISS", "#f00");
    }
}

// --- 7. HELFER & EFFEKTE ---

function updateLayout() {
    laneWidth = noteSize * 2.8;
    canvas.width = laneWidth * 4;
    canvas.height = window.innerHeight;
}

function drawEnvironment() {
    const hitZoneY = (scrollDirection === "down") ? canvas.height * 0.85 : canvas.height * 0.15;
    
    for (let i = 0; i < 4; i++) {
        // Glow
        if (laneGlow[i] > 0) {
            ctx.fillStyle = laneColors[i];
            ctx.globalAlpha = laneGlow[i] / 20;
            ctx.fillRect(i * laneWidth, 0, laneWidth, canvas.height);
            ctx.globalAlpha = 1;
            laneGlow[i]--;
        }
        // Hit Circle
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(i * laneWidth + (laneWidth / 2), hitZoneY, noteSize + 5, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function updateUI(text, color) {
    document.getElementById("score").innerText = Math.floor(score);
    const j = document.getElementById("judgment");
    const c = document.getElementById("combo-num");
    j.innerText = text; j.style.color = color;
    c.innerText = combo > 1 ? combo : "";
    c.style.color = color;
}

function resetCombo() {
    combo = 0;
    document.getElementById("combo-num").innerText = "";
}

function createParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({ x, y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1.0, color });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.04;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function initStars() {
    for(let i=0; i<80; i++) stars.push({x: Math.random()*2000, y: Math.random()*2000, s: Math.random()*2});
}

function drawStars() {
    ctx.fillStyle = "white";
    stars.forEach(s => {
        ctx.globalAlpha = 0.3;
        ctx.fillRect(s.x % canvas.width, s.y % canvas.height, s.s, s.s);
        s.y += 0.2;
    });
    ctx.globalAlpha = 1;
}

// --- 8. INPUT HANDLING ---

window.addEventListener("keydown", (e) => {
    if (waitingForKey !== -1) {
        keys[waitingForKey] = e.key.toLowerCase();
        document.getElementById(`key-${waitingForKey}`).innerText = e.key.toUpperCase();
        document.getElementById(`key-${waitingForKey}`).classList.remove("waiting");
        waitingForKey = -1;
        savePersistentData();
        return;
    }

    if (e.code === "Space") {
        e.preventDefault();
        togglePause();
        return;
    }

    if (isPaused || !gameRunning) return;

    const lane = keys.indexOf(e.key.toLowerCase());
    if (lane !== -1) {
        laneGlow[lane] = 15;
        checkHit(lane);
    }
});

// --- 9. PERSISTENZ & ENDE ---

function savePersistentData() {
    localStorage.setItem('rythMix_Extra', JSON.stringify({
        keys, colors: laneColors, scrollSpeed, scrollDirection, noteSize, currentDiffIdx
    }));
}

function loadPersistentData() {
    const data = JSON.parse(localStorage.getItem('rythMix_Extra'));
    if (data) {
        keys = data.keys || keys;
        scrollSpeed = data.scrollSpeed || scrollSpeed;
        scrollDirection = data.scrollDirection || scrollDirection;
        noteSize = data.noteSize || noteSize;
        currentDiffIdx = data.currentDiffIdx || 2;
        
        // UI Sync
        updateDifficulty(currentDiffIdx);
        document.getElementById("diff-slider").value = currentDiffIdx;
        document.getElementById("speed-slider").value = scrollSpeed;
        document.getElementById("speed-val").innerText = scrollSpeed;
        document.getElementById("btn-scroll").innerText = `SCROLL: ${scrollDirection.toUpperCase()}`;
    }
}

function endGame() {
    gameRunning = false;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    document.getElementById("screen-game").classList.add("hidden");
    document.getElementById("screen-result").classList.remove("hidden");
    document.getElementById("final-score").innerText = Math.floor(score);
    document.getElementById("final-combo").innerText = maxCombo;
    
    // Leaderboard
    let lb = JSON.parse(localStorage.getItem('rythMix_LB')) || [];
    lb.push({ score: Math.floor(score), date: new Date().toLocaleDateString() });
    lb.sort((a, b) => b.score - a.score);
    lb = lb.slice(0, 5);
    localStorage.setItem('rythMix_LB', JSON.stringify(lb));
    
    document.getElementById("leaderboard-list").innerHTML = lb.map(i => `<div>${i.score} pts <small>${i.date}</small></div>`).join("");
}

function mainMenuLoop() {
    if (!gameRunning) {
        // Hier könnte eine Hintergrundanimation für das Menü laufen
    }
}

// Start
initApp();
