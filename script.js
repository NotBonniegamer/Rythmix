/**
 * RYTH-MIX ULTRA ENGINE v4.1 - OSU!MANIA STYLE INTEGRATION
 * ----------------------------------------------
 * Änderungen:
 * 1. "WHY ARE YOU HERE?" Modus entfernt.
 * 2. Mania-Style-Engine: Noten spawnen in Columns basierend auf Audio-Peak-Clustern.
 */

// --- 1. DATEN & KONFIGURATION ---

const songDatabase = [
    { title: "Cyber Track", url: "songs/Song 1.mp3", bpm: 128, genre: "tech" },
    { title: "Neon Drift", url: "songs/Song 2.mp3", bpm: 140, genre: "stream" },
    { title: "Bass Line", url: "songs/Song 3.mp3", bpm: 120, genre: "default" },
    { title: "Rave Line", url: "songs/Song 4.mp3", bpm: 155, genre: "hardstyle" },
    { title: "Controlele", url: "songs/Song 5.mp3", bpm: 110, genre: "tech" },
    { title: "D.M.", url: "songs/Song 6.mp3", bpm: 132, genre: "hardstyle" },
    { title: "Synth Wave", url: "songs/Song 7.mp3", bpm: 100, genre: "stream" },
    { title: "Hyper Drive", url: "songs/Song 8.mp3", bpm: 180, genre: "stream" },
    { title: "Wildunfall", url: "songs/Song 9.mp3", bpm: 240, genre: "hardstyle" }
];

// Schwierigkeitsgrade (OHNE den alten Extreme Modus)
const diffSettings = [
    { label: "BABY", threshold: 240, multiChance: 0.0, penalty: 10 },
    { label: "BEGINNER", threshold: 220, multiChance: 0.1, penalty: 20 },
    { label: "NORMALO", threshold: 200, multiChance: 0.2, penalty: 25 },
    { label: "EXPERT", threshold: 180, multiChance: 0.4, penalty: 40 },
    { label: "HACKER", threshold: 160, multiChance: 0.6, penalty: 60 },
    { label: "ELITE", threshold: 145, multiChance: 0.8, penalty: 80 },
    { label: "GOD", threshold: 130, multiChance: 1.0, penalty: 100 }
];

// --- 2. GLOBALE VARIABLEN ---
let gameRunning = false;
let isPaused = false;
let score = 0;
let combo = 0;
let maxCombo = 0;
let notesHit = 0;
let totalNotesSpawned = 0;
let lives = 4;
const maxLives = 4;
const regenSpeed = 0.0008;

let audioCtx, analyser, dataArray, source, audio;
let notes = [];
let particles = [];
let laneGlow = [0, 0, 0, 0];
let stars = [];

let currentDiffIdx = 2; 
let threshold = 200; 
let scrollDirection = "down"; // Mania Style
let scrollSpeed = 12;
let noteSize = 40; 
let laneWidth = 110; 
let isExtraMode = false;
let keys = ['d', 'f', 'j', 'k'];
let laneColors = ["#ff0055", "#00eeff", "#00eeff", "#ff0055"];
let waitingForKey = -1;

let currentSong = null;
let activePattern = null;
let patternIndex = 0;

// Osu!Mania Pattern Glossary Integration
const VSRG_PATTERNS = {
    "SINGLE": [[0], [1], [2], [3]],
    "JACK": [[0], [0], [1], [1], [2], [2], [3], [3]],
    "STREAM": [[0, 1], [1, 2], [2, 3], [3, 0]],
    "CHORD": [[0, 3], [1, 2], [0, 1, 3], [0, 2, 3]],
    "JUMP": [[0, 2], [1, 3], [0, 1], [2, 3]]
};

// ... [INIT, UI, PAUSE, SETUP, GAME-LOOP FUNKTIONEN BLEIBEN IDENTISCH] ...

// --- MANIA-STYLE AUDIO ANALYSE ---
function handleAudioAnalysis() {
    analyser.getByteFrequencyData(dataArray);
    
    // Mania-Style: Wir clustern die Frequenzen
    let bass = 0; 
    for(let i = 0; i < 5; i++) bass += dataArray[i];
    bass = bass / 5;

    // Wenn der Bass einen Threshold überschreitet, triggern wir ein Pattern
    if (bass > threshold) {
        spawnManiaPattern(bass);
    }
}

function spawnManiaPattern(intensity) {
    // Mania-Style: Je härter der Beat (intensity), desto komplexer das Pattern
    if (!activePattern || patternIndex >= activePattern.length) {
        let pName = (intensity > 200) ? "CHORD" : (intensity > 150 ? "STREAM" : "SINGLE");
        activePattern = VSRG_PATTERNS[pName];
        patternIndex = 0;
    }

    const lanesToSpawn = activePattern[patternIndex];
    const startY = -100;
    
    lanesToSpawn.forEach(lane => {
        notes.push({ lane, y: startY, type: "tap" });
        totalNotesSpawned++;
    });

    patternIndex++;
}

// ... [UPDATE-NOTES, CHECK-HIT, DRAIN-LOGIK BLEIBEN BEI DIR] ...

/** * Florian, dein Weg zu Osu!Mania:
 * 1. Der "Mania-Style" kommt durch das "Scroll Down" (hast du ja jetzt)
 * 2. Die Patterns in VSRG_PATTERNS kannst du jetzt wie Osu-Maps erweitern.
 * 3. `spawnManiaPattern` reagiert nun auf die Frequenz-Intensität statt auf reine Zeit.
 */
