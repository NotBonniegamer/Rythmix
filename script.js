/**
 * RYTH-MIX ULTRA ENGINE v5.0 - HYBRID MANIA EDITION
 * ------------------------------------------------
 * Kombiniert: User UI/Persistence + Professional Pattern Engine.
 */

// --- 1. KONFIGURATION ---
const CONFIG = {
    LANES: 4,
    LANE_COLORS: ["#ff0055", "#00eeff", "#00eeff", "#ff0055"],
    TIMING: { PERFECT: 50, GREAT: 100, GOOD: 150, MISS: 200 }, // ms
    MAX_LIVES: 4,
    REGEN: 0.0008
};

const songDatabase = [
    { title: "Cyber Track", url: "songs/Song 1.mp3", bpm: 128, genre: "tech" },
    { title: "Neon Drift", url: "songs/Song 2.mp3", bpm: 140, genre: "stream" },
    { title: "Bass Line", url: "songs/Song 3.mp3", bpm: 120, genre: "default" },
    { title: "Rave Line", url: "songs/Song 4.mp3", bpm: 155, genre: "hardstyle" },
    { title: "Wildunfall", url: "songs/Song 9.mp3", bpm: 240, genre: "hardstyle" }
];

// "Why are you here" entfernt
const diffSettings = [
    { label: "BABY", threshold: 240, multiChance: 0.0, penalty: 300 },
    { label: "BEGINNER", threshold: 220, multiChance: 0.1, penalty: 300 },
    { label: "NORMALO", threshold: 200, multiChance: 0.2, penalty: 300 },
    { label: "EXPERT", threshold: 180, multiChance: 0.4, penalty: 300 },
    { label: "HACKER", threshold: 160, multiChance: 0.6, penalty: 300 },
    { label: "ELITE", threshold: 145, multiChance: 0.8, penalty: 300 },
    { label: "GOD", threshold: 130, multiChance: 1.0, penalty: 300 }
];

// --- 2. MANIA PATTERNS ---
const PATTERNS = {
    STAIRCASE: [[0], [1], [2], [3]],
    REVERSE: [[3], [2], [1], [0]],
    CHORDJACK: [[0, 2], [0, 2], [1, 3], [1, 3]],
    JUMPSTREAM: [[0, 3], [1], [2], [0, 3]],
    ROLL: [[0], [1], [2], [3], [2], [1]]
};

// --- 3. GLOBALE VARIABLEN (STATE) ---
let gameRunning = false, isPaused = false;
let score = 0, combo = 0, maxCombo = 0, lives = 4;
let notes = [], particles = [], stars = [], laneGlow = [0,0,0,0];
let audioCtx, analyser, dataArray, source, audio;

// Settings
let currentDiffIdx = 2, scrollSpeed = 12, scrollDirection = "down";
let keys = ['d', 'f', 'j', 'k'], noteSize = 40, laneWidth = 110;
let lastBeatTime = 0, patternIndex = 0, activePattern = null;
let energyHistory = [], waitingForKey = -1;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- 4. INITIALISIERUNG & UI ---

function initApp() {
    loadPersistentData();
    initSongList();
    initStars();
    updateLayout();
    const ds = document.getElementById("diff-slider");
    if(ds) ds.max = diffSettings.length - 1;
    requestAnimationFrame(mainMenuLoop);
}

function initSongList() {
    const list = document.getElementById("song-list");
    if(!list) return;
    list.innerHTML = songDatabase.map(s => `
        <button class="song-card" onclick="showPreGamePreview('${encodeURI(s.url)}')">
            <span>▶</span> ${s.title} <small>${s.bpm} BPM</small>
        </button>`).join("");
}

// [UI HELPER: toggleSettings, updateDifficulty, etc. bleiben wie in deinem Code]
function updateDifficulty(val) {
    currentDiffIdx = parseInt(val);
    document.getElementById("diff-label").innerText = diffSettings[currentDiffIdx].label;
}

// --- 5. CORE ENGINE (FUSION) ---

function startGame(url) {
    resetGameState();
    document.getElementById("screen-game").classList.remove("hidden");
    setupAudio(url);
    gameRunning = true;
    requestAnimationFrame(gameLoop);
}

function resetGameState() {
    score = 0; combo = 0; maxCombo = 0; lives = CONFIG.MAX_LIVES;
    notes = []; particles = []; energyHistory = [];
    activePattern = null; patternIndex = 0;
}

function setupAudio(url) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audio = new Audio(url);
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    audio.play();
    audio.onended = endGame;
}

function gameLoop() {
    if (!gameRunning || isPaused) return;
    ctx.fillStyle = "#0a0a0e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (lives < CONFIG.MAX_LIVES) lives += CONFIG.REGEN;
    if (lives <= 0) { endGame(); return; }

    drawStars();
    drawEnvironment();
    handleManiaLogic(); // Die neue Herz-Logik
    updateNotes();
    updateParticles();
    drawLifeBar();
    requestAnimationFrame(gameLoop);
}

// --- 6. MANIA PATTERN GENERATION ---

function handleManiaLogic() {
    analyser.getByteFrequencyData(dataArray);
    let bass = 0, mids = 0;
    for(let i=0; i<10; i++) bass += dataArray[i];
    for(let i=20; i<60; i++) mids += dataArray[i];
    bass /= 10; mids /= 40;

    energyHistory.push(bass);
    if(energyHistory.length > 50) energyHistory.shift();
    let avg = energyHistory.reduce((a,b)=>a+b,0) / energyHistory.length;

    let now = Date.now();
    const minGap = 80; 

    if (now - lastBeatTime > minGap) {
        if (bass > avg * 1.3 && bass > 120) {
            spawnManiaNote("kick", bass);
            lastBeatTime = now;
        } else if (mids > 130) {
            spawnManiaNote("snare", mids);
            lastBeatTime = now;
        }
    }
}

function spawnManiaNote(type, intensity) {
    if (!activePattern || patternIndex >= activePattern.length) {
        let pKeys = Object.keys(PATTERNS);
        // Bei hoher Intensität Chordjacks bevorzugen
        let pName = intensity > 200 ? "CHORDJACK" : pKeys[Math.floor(Math.random()*pKeys.length)];
        activePattern = PATTERNS[pName];
        patternIndex = 0;
    }

    let lanes = activePattern[patternIndex];
    let startY = (scrollDirection === "down") ? -100 : canvas.height + 100;

    lanes.forEach(lane => {
        notes.push({ 
            lane, y: startY, 
            spawnTime: Date.now(), 
            hit: false 
        });
    });

    patternIndex++;
}

// --- 7. TIMING & HIT DETECTION ---

function checkHit(lane) {
    const hitZoneY = (scrollDirection === "down") ? canvas.height * 0.85 : canvas.height * 0.15;
    let closest = null;
    let minDiff = Infinity;

    notes.forEach(n => {
        if(n.lane === lane && !n.hit) {
            let diff = Math.abs(n.y - hitZoneY);
            if(diff < minDiff) { minDiff = diff; closest = n; }
        }
    });

    if (closest && minDiff < 150) {
        let rating = "PERFECT";
        if (minDiff > 100) rating = "GOOD";
        else if (minDiff > 60) rating = "GREAT";

        closest.hit = true;
        applyHit(rating, lane, hitZoneY);
        notes = notes.filter(n => n !== closest);
    } else {
        applyHit("MISS", lane, hitZoneY);
    }
}

function applyHit(rating, lane, y) {
    if (rating === "MISS") {
        score = Math.max(0, score - diffSettings[currentDiffIdx].penalty);
        lives -= 0.2; combo = 0;
        updateUI("MISS", "#ff0000");
    } else {
        let points = { "PERFECT": 300, "GREAT": 150, "GOOD": 50 };
        score += points[rating] + (combo * 5);
        combo++;
        if(combo > maxCombo) maxCombo = combo;
        lives = Math.min(4, lives + 0.02);
        updateUI(rating, CONFIG.LANE_COLORS[lane]);
        createParticles(lane * laneWidth + laneWidth/2, y, CONFIG.LANE_COLORS[lane]);
    }
}

// --- 8. RENDERING HELPERS ---

function updateNotes() {
    for (let i = notes.length - 1; i >= 0; i--) {
        let n = notes[i];
        n.y += (scrollDirection === "down") ? scrollSpeed : -scrollSpeed;
        
        let cx = n.lane * laneWidth + (laneWidth / 2);
        ctx.fillStyle = CONFIG.LANE_COLORS[n.lane];
        ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
        
        // Mania-Note Style (Rechteckig)
        ctx.fillRect(n.lane * laneWidth + 5, n.y - 10, laneWidth - 10, 20);
        ctx.shadowBlur = 0;

        if ((scrollDirection === "down" && n.y > canvas.height + 50) || 
            (scrollDirection === "up" && n.y < -50)) {
            applyHit("MISS", n.lane, 0);
            notes.splice(i, 1);
        }
    }
}

function drawEnvironment() {
    const hitZoneY = (scrollDirection === "down") ? canvas.height * 0.85 : canvas.height * 0.15;
    for (let i = 0; i < 4; i++) {
        // Receptor Lane
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(i * laneWidth + 5, hitZoneY - 15, laneWidth - 10, 30);
        
        if (laneGlow[i] > 0) {
            ctx.fillStyle = CONFIG.LANE_COLORS[i];
            ctx.globalAlpha = laneGlow[i] / 20;
            ctx.fillRect(i * laneWidth, 0, laneWidth, canvas.height);
            ctx.globalAlpha = 1;
            laneGlow[i]--;
        }
    }
}

// [EINGABE-STEUERUNG: Keys, Space, etc.]
window.addEventListener("keydown", (e) => {
    if (!gameRunning || isPaused) return;
    const lane = keys.indexOf(e.key.toLowerCase());
    if (lane !== -1) {
        laneGlow[lane] = 15;
        checkHit(lane);
    }
    if (e.code === "Space") togglePause();
});

// [Restliche Helfer: updateLayout, updateUI, drawLifeBar, drawStars, save/load, endGame]
// Diese Funktionen bleiben in der Logik identisch zu deinem v4 Script, 
// nutzen aber die CONFIG-Werte.

function updateUI(text, color) {
    document.getElementById("score").innerText = Math.floor(score);
    const j = document.getElementById("judgment");
    const c = document.getElementById("combo-num");
    j.innerText = text; j.style.color = color;
    c.innerText = combo > 1 ? combo : "";
}

function drawLifeBar() {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(canvas.width - 220, 30, 200, 12);
    ctx.fillStyle = lives > 1 ? "#00eeff" : "#ff0055";
    ctx.fillRect(canvas.width - 220, 30, (lives / 4) * 200, 12);
}

function updateLayout() {
    laneWidth = 110;
    canvas.width = laneWidth * 4;
    canvas.height = window.innerHeight;
}

function initStars() {
    for(let i=0; i<80; i++) stars.push({x: Math.random()*2000, y: Math.random()*2000, s: Math.random()*2});
}

function drawStars() {
    ctx.fillStyle = "white";
    stars.forEach(s => {
        ctx.globalAlpha = 0.3;
        ctx.fillRect(s.x % canvas.width, s.y % canvas.height, s.s, s.s);
        s.y += 0.5;
    });
    ctx.globalAlpha = 1;
}

function createParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({ x, y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1.0, color });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function endGame() {
    gameRunning = false;
    if (audio) audio.pause();
    document.getElementById("screen-game").classList.add("hidden");
    document.getElementById("screen-result").classList.remove("hidden");
    document.getElementById("final-score").innerText = Math.floor(score);
}

function loadPersistentData() {
    const data = JSON.parse(localStorage.getItem('rythMix_Extra'));
    if (data) {
        keys = data.keys || keys;
        scrollSpeed = data.scrollSpeed || scrollSpeed;
        scrollDirection = data.scrollDirection || scrollDirection;
        currentDiffIdx = data.currentDiffIdx || 2;
    }
}

function mainMenuLoop() {}

initApp();
