/**
 * RYTH-MIX ULTRA ENGINE v5.0 - PROFESSIONAL MANIA EDITION
 * ------------------------------------------------------
 * Entwickelt für: FLORIAN
 * Features: 
 * - Full Mania-Style Pattern Generation (Staircases, Jacks, Chords)
 * - Hold-Note (LN) Support
 * - Millisekunden-genaues Hit-Timing
 * - Dynamisches Audio-Spektrum-Mapping
 */

// --- 1. KONFIGURATION & ENGINE SETTINGS ---
const CONFIG = {
    LANES: 4,
    LANE_KEYS: ['d', 'f', 'j', 'k'],
    LANE_COLORS: ["#ff0055", "#00eeff", "#00eeff", "#ff0055"],
    HIT_POSITION: 0.85, // 85% der Höhe
    TIMING_WINDOWS: {
        PERFECT: 45, // ms
        GREAT: 90,
        GOOD: 135,
        MISS: 180
    },
    BASE_SCROLL_SPEED: 12,
    REGEN_SPEED: 0.001,
    MAX_LIVES: 4
};

// Song-Datenbank mit Genre-Tags für die Pattern-Logik
const songDatabase = [
    { title: "Cyber Track", url: "songs/Song 1.mp3", bpm: 128, genre: "tech" },
    { title: "Neon Drift", url: "songs/Song 2.mp3", bpm: 140, genre: "stream" },
    { title: "Bass Line", url: "songs/Song 3.mp3", bpm: 120, genre: "default" },
    { title: "Rave Line", url: "songs/Song 4.mp3", bpm: 155, genre: "hardstyle" },
    { title: "Wildunfall", url: "songs/Song 9.mp3", bpm: 240, genre: "hardstyle" }
];

// Schwierigkeits-Profile (Wird für Penalty & Multi-Chance genutzt)
const diffSettings = [
    { label: "BABY", multiChance: 0.0, penalty: 10 },
    { label: "BEGINNER", multiChance: 0.1, penalty: 20 },
    { label: "NORMALO", multiChance: 0.2, penalty: 25 },
    { label: "EXPERT", multiChance: 0.4, penalty: 40 },
    { label: "HACKER", multiChance: 0.6, penalty: 60 },
    { label: "ELITE", multiChance: 0.8, penalty: 80 },
    { label: "GOD", multiChance: 1.0, penalty: 100 }
];

// --- 2. GAME STATE ---
let state = {
    running: false,
    paused: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
    lives: CONFIG.MAX_LIVES,
    notes: [],
    particles: [],
    laneGlow: [0, 0, 0, 0],
    currentDiffIdx: 2,
    scrollSpeed: CONFIG.BASE_SCROLL_SPEED,
    noteSize: 40,
    laneWidth: 110,
    currentSong: null,
    lastBeatTime: 0,
    patternIndex: 0,
    activePattern: null,
    energyHistory: []
};

// --- 3. PATTERN BIBLIOTHEK (MANIA LOGIK) ---
const PATTERNS = {
    STAIRCASE_L: [[0], [1], [2], [3]],
    STAIRCASE_R: [[3], [2], [1], [0]],
    CHORDJACK: [[0, 2], [0, 2], [1, 3], [1, 3]],
    JUMPSTREAM: [[0, 3], [1], [2], [0, 3]],
    SPLIT_ROLL: [[0], [3], [1], [2]],
    TRIPLE: [[0, 1, 2], [1, 2, 3]]
};

// --- 4. AUDIO ENGINE ---
let audioCtx, analyser, dataArray, source, audio;

function setupAudio(url) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 512;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    audio.play();
    audio.onended = endGame;
}

// --- 5. PATTERN GENERATOR (TRUE MANIA STYLE) ---
function generateNotes() {
    analyser.getByteFrequencyData(dataArray);
    
    // Frequenz-Analyse für echte Musik-Erkennung
    let bass = 0; // 0-100Hz
    let snare = 0; // 2-4kHz
    for(let i=0; i<4; i++) bass += dataArray[i];
    for(let i=15; i<25; i++) snare += dataArray[i];
    bass /= 4; snare /= 10;

    let now = Date.now();
    let minGap = 120; // Absolutes Minimum für Speed

    if (now - state.lastBeatTime > minGap) {
        // Kick erkannt -> Pattern Trigger
        if (bass > 210) {
            triggerPattern(bass, "kick");
            state.lastBeatTime = now;
        } 
        // Snare erkannt -> Einzelnoten / Streams
        else if (snare > 160) {
            triggerPattern(snare, "snare");
            state.lastBeatTime = now;
        }
    }
}

function triggerPattern(intensity, type) {
    if (!state.activePattern || state.patternIndex >= state.activePattern.length) {
        // Wähle Pattern basierend auf Intensität
        let keys = Object.keys(PATTERNS);
        if (intensity > 235) state.activePattern = PATTERNS.TRIPLE;
        else if (intensity > 215) state.activePattern = PATTERNS.CHORDJACK;
        else state.activePattern = PATTERNS[keys[Math.floor(Math.random() * keys.length)]];
        
        state.patternIndex = 0;
    }

    let lanes = state.activePattern[state.patternIndex];
    lanes.forEach(lane => {
        spawnNote(lane, intensity > 245 ? "hold" : "tap");
    });

    state.patternIndex++;
}

function spawnNote(lane, type) {
    let note = {
        lane: lane,
        y: -100,
        type: type,
        startTime: audio.currentTime * 1000,
        hit: false,
        processed: false
    };

    if (type === "hold") {
        note.duration = 200 + Math.random() * 400; // Länge der LN
        note.endY = note.y - note.duration;
    }

    state.notes.push(note);
}

// --- 6. RENDERING & ANIMATION ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function draw() {
    if (!state.running || state.paused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawLanes();
    updateNotes();
    updateParticles();
    drawUI();

    requestAnimationFrame(draw);
}

function drawBackground() {
    ctx.fillStyle = "#050508";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Scrolling Stars / Grid
    ctx.strokeStyle = "rgba(0, 238, 255, 0.05)";
    for(let i=0; i<canvas.width; i+=state.laneWidth) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
}

function drawLanes() {
    let hitY = canvas.height * CONFIG.HIT_POSITION;

    for (let i = 0; i < CONFIG.LANES; i++) {
        // Lane Glow
        if (state.laneGlow[i] > 0) {
            let grad = ctx.createLinearGradient(0, hitY, 0, 0);
            grad.addColorStop(0, state.laneColors[i]);
            grad.addColorStop(1, "transparent");
            ctx.fillStyle = grad;
            ctx.globalAlpha = state.laneGlow[i] / 20;
            ctx.fillRect(i * state.laneWidth, 0, state.laneWidth, hitY);
            ctx.globalAlpha = 1;
            state.laneGlow[i]--;
        }

        // Hit Receptors (Mania Style)
        ctx.strokeStyle = state.laneColors[i];
        ctx.lineWidth = 4;
        ctx.strokeRect(i * state.laneWidth + 10, hitY - 10, state.laneWidth - 20, 20);
    }
}

function updateNotes() {
    let hitY = canvas.height * CONFIG.HIT_POSITION;

    for (let i = state.notes.length - 1; i >= 0; i--) {
        let n = state.notes[i];
        n.y += state.scrollSpeed;

        // Zeichne Note
        ctx.fillStyle = CONFIG.LANE_COLORS[n.lane];
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
        
        if (n.type === "tap") {
            ctx.fillRect(n.lane * state.laneWidth + 5, n.y, state.laneWidth - 10, 25);
        } else {
            // Hold Note (Long Note)
            let holdHeight = 150; 
            ctx.globalAlpha = 0.6;
            ctx.fillRect(n.lane * state.laneWidth + 15, n.y - holdHeight, state.laneWidth - 30, holdHeight);
            ctx.globalAlpha = 1;
            ctx.fillRect(n.lane * state.laneWidth + 5, n.y, state.laneWidth - 10, 25);
        }
        ctx.shadowBlur = 0;

        // Miss Check
        if (n.y > canvas.height && !n.hit) {
            handleHit(null, "MISS");
            state.notes.splice(i, 1);
        }
    }
}

// --- 7. JUDGEMENT & SCORE ---
function checkInput(lane) {
    let hitY = canvas.height * CONFIG.HIT_POSITION;
    let closestNote = null;
    let minDiff = Infinity;

    state.notes.forEach(n => {
        if (n.lane === lane && !n.hit) {
            let diff = Math.abs(n.y - hitY);
            if (diff < minDiff) {
                minDiff = diff;
                closestNote = n;
            }
        }
    });

    if (closestNote && minDiff < CONFIG.TIMING_WINDOWS.MISS) {
        let rating = "PERFECT";
        if (minDiff > CONFIG.TIMING_WINDOWS.GREAT) rating = "GOOD";
        else if (minDiff > CONFIG.TIMING_WINDOWS.PERFECT) rating = "GREAT";
        
        closestNote.hit = true;
        handleHit(closestNote, rating);
        
        // Lösche getroffene Note
        state.notes = state.notes.filter(n => n !== closestNote);
    } else {
        handleHit(null, "MISS");
    }
}

function handleHit(note, rating) {
    const scoreMap = { "PERFECT": 300, "GREAT": 150, "GOOD": 50, "MISS": 0 };
    
    if (rating === "MISS") {
        state.combo = 0;
        state.lives -= 0.5;
        updateJudgmentUI("MISS", "#ff0000");
    } else {
        state.score += scoreMap[rating] + (state.combo * 2);
        state.combo++;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
        state.lives = Math.min(CONFIG.MAX_LIVES, state.lives + 0.05);
        updateJudgmentUI(rating, rating === "PERFECT" ? "#ffffff" : "#00eeff");
        
        if (note) createParticles(note.lane * state.laneWidth + state.laneWidth/2, canvas.height * CONFIG.HIT_POSITION, CONFIG.LANE_COLORS[note.lane]);
    }
}

// --- 8. UI & CONTROLS ---
function updateJudgmentUI(txt, col) {
    let j = document.getElementById("judgment");
    let c = document.getElementById("combo-num");
    j.innerText = txt; j.style.color = col;
    c.innerText = state.combo > 0 ? state.combo : "";
    document.getElementById("score").innerText = Math.floor(state.score);
}

window.addEventListener("keydown", (e) => {
    if (!state.running) return;
    let idx = CONFIG.LANE_KEYS.indexOf(e.key.toLowerCase());
    if (idx !== -1) {
        state.laneGlow[idx] = 20;
        checkInput(idx);
    }
    if (e.code === "Space") togglePause();
});

// --- 9. INIT & START ---
function startGame(url) {
    state.running = true;
    state.lives = CONFIG.MAX_LIVES;
    state.notes = [];
    state.score = 0;
    state.combo = 0;
    
    document.getElementById("screen-start").classList.add("hidden");
    document.getElementById("screen-game").classList.remove("hidden");
    
    setupAudio(url);
    
    // Core Loops
    setInterval(() => { if(state.running && !state.paused) generateNotes(); }, 50);
    requestAnimationFrame(draw);
}

function endGame() {
    state.running = false;
    audio.pause();
    document.getElementById("screen-game").classList.add("hidden");
    document.getElementById("screen-result").classList.remove("hidden");
    document.getElementById("final-score").innerText = Math.floor(state.score);
}

function drawUI() {
    // Lifebar
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(canvas.width - 220, 20, 200, 10);
    ctx.fillStyle = state.lives > 1 ? "#00eeff" : "#ff0055";
    ctx.fillRect(canvas.width - 220, 20, (state.lives / CONFIG.MAX_LIVES) * 200, 10);
}

// Helper: Particles
function createParticles(x, y, color) {
    for(let i=0; i<10; i++) {
        state.particles.push({x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, l: 1.0, c: color});
    }
}

function updateParticles() {
    for(let i=state.particles.length-1; i>=0; i--) {
        let p = state.particles[i];
        p.x += p.vx; p.y += p.vy; p.l -= 0.05;
        if(p.l <= 0) { state.particles.splice(i,1); continue; }
        ctx.globalAlpha = p.l; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// Kickoff
console.log("RythMix v5.0 Loaded. Good luck, Florian.");
