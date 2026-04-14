const songDatabase = [
    { title: "Cyber Track 1", url: "songs/Song 1.mp3" },
    { title: "Neon Drift", url: "songs/Song 2.mp3" },
    { title: "Bass Line", url: "songs/Song 3.mp3" },
    { title: "Rave Line", url: "songs/Song 4.mp3" },
    { title: "Controlele", url: "songs/Song 5.mp3" },
    { title: "D.M.", url: "songs/Song 6.mp3" },    
];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let audioCtx, analyser, dataArray, source, audio;
let gameRunning = false;
let isPaused = false;
let score = 0, combo = 0, maxCombo = 0;
let notes = [], particles = [];
let laneGlow = [0, 0, 0, 0];

// --- NEU: PATTERNS & HOLD-TRACKING ---
let activeHolds = [null, null, null, null]; 
const patterns = [
    [0, 1, 2, 3], // Treppe rechts
    [3, 2, 1, 0], // Treppe links
    [0, 3, 1, 2], // Von außen nach innen
    [0, 2, 1, 3], // Zick-Zack
    [0, 0, 3, 3]  // Doppel-Schläge
];

// --- SCHWIERIGKEITS-TABELLE ---
const diffSettings = [
    { label: "BABY", threshold: 240, multiChance: 0.0, beatMin: 400, penalty: 10 },
    { label: "BEGINNER", threshold: 220, multiChance: 0.1, beatMin: 300, penalty: 20 },
    { label: "NORMALO", threshold: 200, multiChance: 0.2, beatMin: 200, penalty: 25 },
    { label: "EXPERT", threshold: 180, multiChance: 0.4, beatMin: 150, penalty: 40 },
    { label: "HACKER", threshold: 160, multiChance: 0.6, beatMin: 100, penalty: 60 },
    { label: "ELITE", threshold: 145, multiChance: 0.8, beatMin: 80, penalty: 80 },
    { label: "GOD", threshold: 130, multiChance: 1.0, beatMin: 50, penalty: 100 }
];

// --- DEFAULT SETTINGS ---
let currentDiffIdx = 2; 
let threshold = 210; 
let lastBeatTime = 0;
let secretMode = false;
let secretInput = "";

let scrollDirection = "up"; 
let scrollSpeed = 12;
let noteSize = 40; 
let laneWidth = 110; 

let keys = ['d', 'f', 'j', 'k'];
let laneColors = ["#ff0055", "#00eeff", "#00eeff", "#ff0055"];

// --- LOAD/SAVE DATA ---
function loadData() {
    const saved = JSON.parse(localStorage.getItem('rythMixData'));
    if (saved) {
        if(saved.keys) keys = saved.keys;
        if(saved.colors) laneColors = saved.colors;
        if(saved.speed) scrollSpeed = saved.speed;
        if(saved.direction) scrollDirection = saved.direction;
        if(saved.size) noteSize = saved.size;
    }
}
function saveData() {
    localStorage.setItem('rythMixData', JSON.stringify({
        keys, colors: laneColors, speed: scrollSpeed, direction: scrollDirection, size: noteSize
    }));
}

// --- UI INIT ---
function initUI() {
    loadData();
    const songList = document.getElementById("song-list");
    songDatabase.forEach(song => {
        const btn = document.createElement("button");
        btn.className = "song-card";
        btn.innerHTML = `<span>▶</span> ${song.title}`;
        btn.onclick = () => startGame(encodeURI(song.url));
        songList.appendChild(btn);
    });

    document.getElementById("speed-slider").value = scrollSpeed;
    document.getElementById("speed-val").innerText = scrollSpeed;
    for(let i=0; i<4; i++) {
        document.getElementById(`color-${i}`).value = laneColors[i];
        document.getElementById(`key-${i}`).innerText = keys[i].toUpperCase();
    }
    document.getElementById("btn-scroll").innerText = `SCROLL: ${scrollDirection.toUpperCase()}`;
}
initUI();

function updateLayout() {
    laneWidth = noteSize * 2.8; 
    canvas.width = laneWidth * 4;
}

function toggleSettings(show) {
    document.getElementById("screen-start").classList.toggle("hidden", show);
    document.getElementById("screen-settings").classList.toggle("hidden", !show);
    if(!show) saveData();
}

// --- SETTINGS LOGIC ---
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

function updateColor(lane, color) { laneColors[lane] = color; }

let waitingForKey = -1;
function assignKey(lane) {
    waitingForKey = lane;
    const btn = document.getElementById(`key-${lane}`);
    btn.innerText = "...";
    btn.classList.add("waiting");
}

function toggleScrollDirection() {
    scrollDirection = scrollDirection === "down" ? "up" : "down";
    document.getElementById("btn-scroll").innerText = `SCROLL: ${scrollDirection.toUpperCase()}`;
}

function changeNoteSize() {
    noteSize = noteSize === 40 ? 55 : (noteSize === 55 ? 75 : (noteSize === 75 ? 35 : 55));
    const label = noteSize === 35 ? "MEDIUM" : (noteSize === 75 ? "MONSTER" : "XXL");
    document.getElementById("btn-size").innerText = `SIZE: ${label}`;
    updateLayout();
}

// --- ENGINE ---
async function startGame(url, customTitle = null) {
    saveData();
    updateLayout(); 
    document.getElementById("screen-start").classList.add("hidden");
    document.getElementById("screen-game").classList.remove("hidden");
    setupAudio(url);
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
    
    audio.play().catch(e => alert("Klicke nochmal ins Fenster!"));
    gameRunning = true;
    requestAnimationFrame(gameLoop);
    audio.onended = () => endGame();
}

function togglePause() {
    if(!gameRunning) return;
    isPaused = !isPaused;
    const overlay = document.getElementById("pause-overlay");
    if(isPaused) { audio.pause(); overlay.classList.remove("hidden"); } 
    else { audio.play(); overlay.classList.add("hidden"); requestAnimationFrame(gameLoop); }
}

// --- NEU: PATTERN & HOLD SPAWNING ---
function handleAudioAnalysis() {
    analyser.getByteFrequencyData(dataArray);
    let bass = dataArray[2];
    let mid = dataArray[15];
    let currentTime = Date.now();

    const minInterval = secretMode ? 40 : diffSettings[currentDiffIdx].beatMin;

    if ((bass > threshold || mid > threshold * 0.8) && (currentTime - lastBeatTime > minInterval)) {
        spawnNoteLogic();
        lastBeatTime = currentTime;
    }
}

function spawnNoteLogic() {
    const d = diffSettings[currentDiffIdx];
    const rand = Math.random();

    // 1. Chance auf Pattern (20%)
    if (rand < 0.2) {
        const p = patterns[Math.floor(Math.random() * patterns.length)];
        p.forEach((lane, i) => {
            setTimeout(() => createNote(lane, "tap"), i * 120);
        });
    } 
    // 2. Chance auf Hold-Note (15%)
    else if (rand < 0.35) {
        createNote(Math.floor(Math.random() * 4), "hold");
    }
    // 3. Normales Spawning
    else {
        const lane = Math.floor(Math.random() * 4);
        createNote(lane, "tap");
        if (Math.random() < d.multiChance) {
            createNote((lane + 1) % 4, "tap");
        }
    }
}

function createNote(lane, type) {
    const startY = scrollDirection === "down" ? -100 : canvas.height + 100;
    notes.push({
        lane: lane,
        y: startY,
        type: type,
        holdLength: type === "hold" ? 250 + Math.random() * 300 : 0,
        isBeingHeld: false,
        hitConfirmed: false
    });
}

function gameLoop() {
    if (!gameRunning || isPaused) return;
    canvas.height = window.innerHeight;
    ctx.fillStyle = "rgba(10, 10, 14, 0.8)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawEnvironment();
    handleAudioAnalysis();
    updateNotes();
    updateParticles();
    requestAnimationFrame(gameLoop);
}

function drawEnvironment() {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    for(let i=1; i<4; i++) {
        ctx.beginPath(); ctx.moveTo(i * laneWidth, 0); ctx.lineTo(i * laneWidth, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
        if (laneGlow[i] > 0) {
            let grad = ctx.createLinearGradient(0, hitZoneY, 0, scrollDirection === "down" ? 0 : canvas.height);
            grad.addColorStop(0, laneColors[i]); grad.addColorStop(1, "transparent");
            ctx.fillStyle = grad; ctx.globalAlpha = laneGlow[i] / 15;
            ctx.fillRect(i * laneWidth, 0, laneWidth, canvas.height);
            ctx.globalAlpha = 1; laneGlow[i]--;
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(i * laneWidth + (laneWidth/2), hitZoneY, noteSize + 8, 0, Math.PI * 2); ctx.stroke();
    }
}

function updateNotes() {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;

    for (let i = notes.length - 1; i >= 0; i--) {
        let n = notes[i];
        n.y += scrollDirection === "down" ? scrollSpeed : -scrollSpeed;
        
        // Zeichne Hold-Schweif
        if (n.type === "hold") {
            ctx.fillStyle = laneColors[n.lane];
            ctx.globalAlpha = n.isBeingHeld ? 0.8 : 0.3;
            const tailY = scrollDirection === "down" ? n.y - n.holdLength : n.y + n.holdLength;
            ctx.fillRect(n.lane * laneWidth + (laneWidth/2) - 15, Math.min(n.y, tailY), 30, n.holdLength);
            ctx.globalAlpha = 1;
        }

        // Zeichne Kopf
        ctx.shadowBlur = n.isBeingHeld ? 40 : 25; 
        ctx.shadowColor = laneColors[n.lane];
        ctx.fillStyle = n.type === "hold" ? "#ffffff" : laneColors[n.lane];
        ctx.beginPath(); ctx.arc(n.lane * laneWidth + (laneWidth/2), n.y, noteSize, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Hold-Ende Logik
        if (n.isBeingHeld) {
            const tailEnd = scrollDirection === "down" ? n.y - n.holdLength : n.y + n.holdLength;
            if (Math.abs(tailEnd - hitZoneY) < 25) {
                score += 200; combo++;
                notes.splice(i, 1);
                activeHolds[n.lane] = null;
                updateUI("COMPLETED", laneColors[n.lane]);
                continue;
            }
        }

        // MISS
        if ((scrollDirection === "down" && n.y > canvas.height + 200) || 
            (scrollDirection === "up" && n.y < -200)) {
            notes.splice(i, 1);
            if (!n.hitConfirmed) { score -= 50; resetCombo(); }
        }
    }
}

function createParticles(x, y, color) {
    for (let i = 0; i < 25; i++) {
        particles.push({ x, y, vx: (Math.random()-0.5)*20, vy: (Math.random()-0.5)*20, life: 1.0, color });
    }
}

function updateParticles() {
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.04;
        if (p.life <= 0) particles.splice(i, 1);
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// --- INPUTS ---
window.addEventListener("keydown", (e) => {
    if(!gameRunning) {
        secretInput += e.key.toLowerCase();
        if(secretInput.includes("deine_mudda")) {
            secretMode = true;
            document.getElementById("diff-label").innerText = "MUDDA MODE";
            document.getElementById("diff-label").style.color = "gold";
            threshold = 100; scrollSpeed = 25;
            alert("MUDDA MODE AKTIVIERT!");
            secretInput = "";
        }
        if(secretInput.length > 20) secretInput = secretInput.slice(-11);
    }

    if(waitingForKey !== -1) {
        e.preventDefault();
        const keyChar = e.key.toLowerCase();
        keys[waitingForKey] = keyChar;
        const btn = document.getElementById(`key-${waitingForKey}`);
        btn.innerText = keyChar.toUpperCase();
        btn.classList.remove("waiting");
        waitingForKey = -1;
        return;
    }

    if (e.code === "Space" && gameRunning) { e.preventDefault(); togglePause(); return; }
    if (isPaused || !gameRunning) return;

    const lane = keys.indexOf(e.key.toLowerCase());
    if (lane !== -1) { laneGlow[lane] = 15; checkHit(lane); }
});

window.addEventListener("keyup", (e) => {
    const lane = keys.indexOf(e.key.toLowerCase());
    if (lane !== -1 && activeHolds[lane]) {
        updateUI("RELEASED!", "#ff0000");
        resetCombo();
        activeHolds[lane].isBeingHeld = false;
        activeHolds[lane] = null;
    }
});

function checkHit(lane) {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;
    let hitFound = false;
    const penalty = diffSettings[currentDiffIdx].penalty;

    for (let i = 0; i < notes.length; i++) {
        let n = notes[i];
        if (n.lane === lane && Math.abs(n.y - hitZoneY) < (noteSize + 50)) {
            if (n.type === "hold") {
                n.isBeingHeld = true;
                n.hitConfirmed = true;
                activeHolds[lane] = n;
                updateUI("HOLDING", laneColors[lane]);
            } else {
                notes.splice(i, 1);
                score += 100 + (combo * 15);
                combo++;
                if(combo > maxCombo) maxCombo = combo;
                updateUI("PERFECT", laneColors[lane]);
                createParticles(lane * laneWidth + (laneWidth/2), hitZoneY, laneColors[lane]);
            }
            hitFound = true;
            return;
        }
    }

    if (!hitFound) {
        score -= penalty;
        if (score < 0) score = 0;
        updateUI("MISS", "#ff0000");
        resetCombo();
    }
}

function updateUI(text, color) {
    document.getElementById("score").innerText = score;
    document.getElementById("combo-num").innerText = combo > 0 ? combo : "";
    const j = document.getElementById("judgment");
    j.innerText = text; j.style.color = color;
    j.style.textShadow = `0 0 20px ${color}`;
    setTimeout(() => j.innerText = "", 400);
}

function resetCombo() {
    combo = 0;
    document.getElementById("combo-num").innerText = "";
}

function endGame() {
    gameRunning = false;
    document.getElementById("screen-game").classList.add("hidden");
    document.getElementById("screen-result").classList.remove("hidden");
    document.getElementById("final-score").innerText = score;
    document.getElementById("final-combo").innerText = maxCombo;
}