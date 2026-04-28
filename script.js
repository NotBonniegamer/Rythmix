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

// --- LEBENS SYSTEM ---
let lives = 4;
const maxLives = 4;
const regenSpeed = 0.0008; // Langsame Heilung pro Frame

// --- EXTRA MODE & LEADERBOARD ---
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
    if(songList) {
        songList.innerHTML = ""; 
        songDatabase.forEach(song => {
            const btn = document.createElement("button");
            btn.className = "song-card";
            btn.innerHTML = `<span>▶</span> ${song.title}`;
            btn.onclick = () => showPreGamePreview(encodeURI(song.url));
            songList.appendChild(btn);
        });
    }

    if(document.getElementById("speed-slider")) {
        document.getElementById("speed-slider").value = scrollSpeed;
        document.getElementById("speed-val").innerText = scrollSpeed;
    }
    for(let i=0; i<4; i++) {
        if(document.getElementById(`color-${i}`)) document.getElementById(`color-${i}`).value = laneColors[i];
        if(document.getElementById(`key-${i}`)) document.getElementById(`key-${i}`).innerText = keys[i].toUpperCase();
    }
}
initUI();

// --- PRE-GAME PREVIEW ---
function showPreGamePreview(url) {
    saveData();
    updateLayout();
    document.getElementById("screen-start").classList.add("hidden");
    
    // Erstelle ein einfaches Overlay für die Settings-Vorschau
    const preview = document.createElement("div");
    preview.id = "game-preview";
    preview.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; z-index:100; font-family:sans-serif;";
    preview.innerHTML = `
        <h1 style="color:#00eeff">GET READY</h1>
        <div style="background:rgba(255,255,255,0.1); padding:20px; border-radius:15px; text-align:center; min-width:300px">
            <p>Difficulty: <b>${diffSettings[currentDiffIdx].label}</b></p>
            <p>Speed: <b>${scrollSpeed}</b></p>
            <p>Keys: <b>${keys.join(" ").toUpperCase()}</b></p>
            <p>Extra Mode: <b>${isExtraMode ? "ON" : "OFF"}</b></p>
        </div>
        <h2 id="countdown">3</h2>
    `;
    document.body.appendChild(preview);

    let count = 3;
    const interval = setInterval(() => {
        count--;
        document.getElementById("countdown").innerText = count;
        if(count <= 0) {
            clearInterval(interval);
            document.body.removeChild(preview);
            startGame(url);
        }
    }, 1000);
}

function updateLayout() {
    laneWidth = noteSize * 2.8; 
    canvas.width = laneWidth * 4;
}

function updateColor(lane, color) { 
    laneColors[lane] = color; 
    saveData();
}

function toggleScrollDirection() {
    scrollDirection = scrollDirection === "down" ? "up" : "down";
    document.getElementById("btn-scroll").innerText = `SCROLL: ${scrollDirection.toUpperCase()}`;
}

// --- ENGINE ---
async function startGame(url) {
    lives = 4; // Reset Leben
    score = 0; // Reset Score
    combo = 0;
    maxCombo = 0;
    notes = [];
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
    
    audio.play().catch(e => console.log("Audio play failed."));
    gameRunning = true;
    requestAnimationFrame(gameLoop);
    audio.onended = () => endGame();
}

function gameLoop() {
    if (!gameRunning || isPaused) return;
    canvas.height = window.innerHeight;
    
    // Langsame Regeneration
    if(lives < maxLives) lives += regenSpeed;
    if(lives <= 0) { endGame(); return; }

    ctx.fillStyle = "rgba(10, 10, 14, 0.8)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawEnvironment();
    drawLifeBar();
    handleAudioAnalysis();
    updateNotes();
    updateParticles();
    requestAnimationFrame(gameLoop);
}

function drawLifeBar() {
    const barWidth = 200;
    const barHeight = 15;
    const x = canvas.width - barWidth - 20;
    const y = 20;

    // Hintergrund
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x, y, barWidth, barHeight);
    
    // Leben-Füllung
    let color = lives > 1.5 ? "#00eeff" : "#ff0055";
    ctx.fillStyle = color;
    ctx.fillRect(x, y, (lives / maxLives) * barWidth, barHeight);
    
    // Text
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText("ENERGY", x, y - 5);
}

function updateNotes() {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;

    for (let i = notes.length - 1; i >= 0; i--) {
        let n = notes[i];
        n.y += scrollDirection === "down" ? scrollSpeed : -scrollSpeed;
        
        let centerX = n.lane * laneWidth + (laneWidth/2);
        
        // Zeichne Note
        ctx.shadowBlur = 25;
        ctx.shadowColor = n.type === "trap" ? "#ffffff" : laneColors[n.lane];
        ctx.fillStyle = n.type === "trap" ? "#ffffff" : laneColors[n.lane];
        ctx.beginPath(); 
        ctx.arc(centerX, n.y, noteSize, 0, Math.PI * 2); 
        ctx.fill();
        ctx.shadowBlur = 0;

        // "X" auf Traps
        if (n.type === "trap") {
            ctx.strokeStyle = "#111";
            ctx.lineWidth = 5;
            let offset = noteSize * 0.4;
            ctx.beginPath();
            ctx.moveTo(centerX - offset, n.y - offset); ctx.lineTo(centerX + offset, n.y + offset);
            ctx.moveTo(centerX + offset, n.y - offset); ctx.lineTo(centerX - offset, n.y + offset);
            ctx.stroke();
        }

        // MISS Check (Noten fliegen aus dem Bild)
        if ((scrollDirection === "down" && n.y > canvas.height + 50) || 
            (scrollDirection === "up" && n.y < -50)) {
            
            if (n.type === "tap") { 
                score -= 50;  // Minus-Punkte wenn man nicht klickt
                lives -= 1;   // Leben abziehen
                resetCombo(); 
                updateUI("MISS", "#ff0000");
            }
            notes.splice(i, 1);
        }
    }
}

function handleAudioAnalysis() {
    analyser.getByteFrequencyData(dataArray);
    let bass = dataArray[2];
    let currentTime = Date.now();
    const minInterval = diffSettings[currentDiffIdx].beatMin;

    if (bass > threshold && (currentTime - lastBeatTime > minInterval)) {
        spawnNoteLogic();
        lastBeatTime = currentTime;
    }
}

function spawnNoteLogic() {
    const d = diffSettings[currentDiffIdx];
    const lane = Math.floor(Math.random() * 4);
    if (isExtraMode && Math.random() < 0.2) createNote(lane, "trap");
    else {
        createNote(lane, "tap");
        if (Math.random() < d.multiChance) createNote((lane + 1) % 4, "tap");
    }
}

function createNote(lane, type) {
    const startY = scrollDirection === "down" ? -100 : canvas.height + 100;
    notes.push({ lane, y: startY, type, hitConfirmed: false });
}

function checkHit(lane) {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;
    let hitFound = false;
    const penalty = diffSettings[currentDiffIdx].penalty;

    for (let i = 0; i < notes.length; i++) {
        let n = notes[i];
        if (n.lane === lane && Math.abs(n.y - hitZoneY) < (noteSize + 50)) {
            if (n.type === "trap") {
                score -= 100;
                lives -= 1; // Trap kostet ein Leben
                resetCombo();
                updateUI("POISON!", "#ffffff");
                createParticles(n.lane * laneWidth + (laneWidth/2), n.y, "#ffffff");
            } else {
                score += 100 + (combo * 10);
                combo++;
                if(combo > maxCombo) maxCombo = combo;
                updateUI("PERFECT", laneColors[lane]);
                createParticles(lane * laneWidth + (laneWidth/2), hitZoneY, laneColors[lane]);
            }
            notes.splice(i, 1);
            hitFound = true;
            return;
        }
    }
    // Fehlklick ins Leere
    if (!hitFound) { 
        score -= penalty; 
        lives -= 0.2; // Kleiner Abzug für Spamming
        resetCombo(); 
        updateUI("MISS", "#ff0000"); 
    }
}

// --- INPUTS (MIT KORREKTEM KEYBINDING) ---
window.addEventListener("keydown", (e) => {
    if(waitingForKey !== -1) {
        const newKey = e.key.toLowerCase();
        keys[waitingForKey] = newKey;
        document.getElementById(`key-${waitingForKey}`).innerText = newKey.toUpperCase();
        document.getElementById(`key-${waitingForKey}`).classList.remove("waiting");
        waitingForKey = -1; saveData(); return;
    }
    if (e.code === "Space" && gameRunning) { e.preventDefault(); togglePause(); return; }
    if (isPaused || !gameRunning) return;

    const lane = keys.indexOf(e.key.toLowerCase());
    if (lane !== -1) { 
        laneGlow[lane] = 15; 
        checkHit(lane); 
    }
});

function drawEnvironment() {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;
    for(let i=1; i<4; i++) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
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

function updateUI(text, color) {
    document.getElementById("score").innerText = Math.floor(score);
    document.getElementById("combo-num").innerText = combo > 0 ? combo : "";
    const j = document.getElementById("judgment");
    if(j) {
        j.innerText = text; j.style.color = color;
        setTimeout(() => { if(j.innerText === text) j.innerText = ""; }, 500);
    }
}

function resetCombo() { combo = 0; if(document.getElementById("combo-num")) document.getElementById("combo-num").innerText = ""; }

function endGame() {
    if(audio) audio.pause();
    gameRunning = false;
    document.getElementById("screen-game").classList.add("hidden");
    document.getElementById("screen-result").classList.remove("hidden");
    document.getElementById("final-score").innerText = Math.floor(score);
    document.getElementById("final-combo").innerText = maxCombo;
    saveLeaderboard(Math.floor(score));
}

// Restliche Funktionen (updateParticles, createParticles, etc.) bleiben gleich...
function updateParticles() {
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.04;
        if (p.life <= 0) particles.splice(i, 1);
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function createParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({ x, y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1.0, color });
    }
}

function saveLeaderboard(newScore) {
    let leaderboard = JSON.parse(localStorage.getItem('rythMixLeaderboard')) || [];
    leaderboard.push({ score: newScore, date: new Date().toLocaleDateString() });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5);
    localStorage.setItem('rythMixLeaderboard', JSON.stringify(leaderboard));
}
