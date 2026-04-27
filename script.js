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
let gameRunning = false, isPaused = false;
let score = 0, combo = 0, maxCombo = 0;
let notes = [], particles = [], laneGlow = [0, 0, 0, 0];

// --- MODI & SETTINGS ---
let isExtraMode = false;
const diffSettings = [
    { label: "BABY", threshold: 240, multiChance: 0.0, beatMin: 400, penalty: 10 },
    { label: "BEGINNER", threshold: 220, multiChance: 0.1, beatMin: 300, penalty: 20 },
    { label: "NORMALO", threshold: 200, multiChance: 0.2, beatMin: 200, penalty: 25 },
    { label: "EXPERT", threshold: 180, multiChance: 0.4, beatMin: 150, penalty: 40 },
    { label: "HACKER", threshold: 160, multiChance: 0.6, beatMin: 100, penalty: 60 },
    { label: "ELITE", threshold: 145, multiChance: 0.8, beatMin: 80, penalty: 80 },
    { label: "GOD", threshold: 130, multiChance: 1.0, beatMin: 50, penalty: 100 }
];

let currentDiffIdx = 2, threshold = 210, lastBeatTime = 0;
let scrollDirection = "up", scrollSpeed = 12, noteSize = 40, laneWidth = 110; 
let keys = ['d', 'f', 'j', 'k'];
let laneColors = ["#ff0055", "#00eeff", "#00eeff", "#ff0055"];

// --- INITIALISIERUNG ---
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
}
initUI();

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

function toggleSettings(show) {
    document.getElementById("screen-start").classList.toggle("hidden", show);
    document.getElementById("screen-settings").classList.toggle("hidden", !show);
    if(!show) saveData();
}

function toggleExtraMode() {
    isExtraMode = !isExtraMode;
    const btn = document.getElementById("btn-extra");
    btn.innerText = `EXTRA MODE: ${isExtraMode ? "ON" : "OFF"}`;
    btn.style.boxShadow = isExtraMode ? "0 0 15px #fff" : "none";
}

function updateDifficulty(val) {
    currentDiffIdx = parseInt(val);
    document.getElementById("diff-label").innerText = diffSettings[currentDiffIdx].label;
    threshold = diffSettings[currentDiffIdx].threshold;
}

function updateCustomSpeed(val) {
    scrollSpeed = parseInt(val);
    document.getElementById("speed-val").innerText = scrollSpeed;
}

// --- GAME ENGINE ---
async function startGame(url) {
    saveData();
    laneWidth = noteSize * 2.8; 
    canvas.width = laneWidth * 4;
    document.getElementById("screen-start").classList.add("hidden");
    document.getElementById("screen-game").classList.remove("hidden");
    
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    audio.play().catch(() => alert("Klicke ins Fenster zum Starten!"));
    gameRunning = true;
    requestAnimationFrame(gameLoop);
    audio.onended = () => endGame();
}

function gameLoop() {
    if (!gameRunning || isPaused) return;
    canvas.height = window.innerHeight;
    ctx.fillStyle = "rgba(10, 10, 14, 0.8)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawEnvironment();
    handleAudio();
    updateNotes();
    updateParticles();
    requestAnimationFrame(gameLoop);
}

function handleAudio() {
    analyser.getByteFrequencyData(dataArray);
    let bass = dataArray[2];
    let currentTime = Date.now();
    if (bass > threshold && (currentTime - lastBeatTime > diffSettings[currentDiffIdx].beatMin)) {
        spawnNote();
        lastBeatTime = currentTime;
    }
}

function spawnNote() {
    const lane = Math.floor(Math.random() * 4);
    const startY = scrollDirection === "down" ? -100 : canvas.height + 100;
    
    // Extra Mode: Chance auf eine Gift-Note (Weiß)
    let type = "tap";
    if (isExtraMode && Math.random() < 0.25) type = "trap";

    notes.push({ lane, y: startY, type, hitConfirmed: false });
    
    if (Math.random() < diffSettings[currentDiffIdx].multiChance && type === "tap") {
        notes.push({ lane: (lane + 1) % 4, y: startY, type: "tap", hitConfirmed: false });
    }
}

function updateNotes() {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;
    for (let i = notes.length - 1; i >= 0; i--) {
        let n = notes[i];
        n.y += scrollDirection === "down" ? scrollSpeed : -scrollSpeed;

        // Zeichnen
        ctx.shadowBlur = 15;
        ctx.shadowColor = n.type === "trap" ? "#fff" : laneColors[n.lane];
        ctx.fillStyle = n.type === "trap" ? "#fff" : laneColors[n.lane];
        ctx.beginPath();
        ctx.arc(n.lane * laneWidth + (laneWidth/2), n.y, noteSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Abgrenzung/Miss-Logik
        if ((scrollDirection === "down" && n.y > canvas.height + 100) || 
            (scrollDirection === "up" && n.y < -100)) {
            if (n.type === "tap" && !n.hitConfirmed) resetCombo();
            if (n.type === "trap" && !n.hitConfirmed) {
                score += 50; // Bonus für das Ignorieren der Gift-Note
                updateUI("GOOD DODGE!", "#00ff00");
            }
            notes.splice(i, 1);
        }
    }
}

function checkHit(lane) {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;
    for (let i = 0; i < notes.length; i++) {
        let n = notes[i];
        if (n.lane === lane && Math.abs(n.y - hitZoneY) < (noteSize + 60)) {
            if (n.type === "trap") {
                score -= 150;
                resetCombo();
                updateUI("DONT HIT TRAPS!", "#ffffff");
            } else {
                score += 100 + (combo * 10);
                combo++;
                if(combo > maxCombo) maxCombo = combo;
                updateUI("PERFECT", laneColors[lane]);
                createParticles(n.lane * laneWidth + (laneWidth/2), hitZoneY, laneColors[lane]);
            }
            notes.splice(i, 1);
            return;
        }
    }
    score -= 20; resetCombo();
}

// --- HELPER ---
function drawEnvironment() {
    const hitZoneY = scrollDirection === "down" ? canvas.height * 0.85 : canvas.height * 0.15;
    for(let i=1; i<4; i++) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath(); ctx.moveTo(i * laneWidth, 0); ctx.lineTo(i * laneWidth, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.beginPath(); ctx.arc(i * laneWidth + (laneWidth/2), hitZoneY, noteSize + 5, 0, Math.PI * 2); ctx.stroke();
    }
}

function updateUI(text, color) {
    document.getElementById("score").innerText = score;
    document.getElementById("combo-num").innerText = combo > 0 ? combo : "";
    const j = document.getElementById("judgment");
    j.innerText = text; j.style.color = color;
}

function resetCombo() { combo = 0; document.getElementById("combo-num").innerText = ""; }

function createParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({ x, y, vx: (Math.random()-0.5)*15, vy: (Math.random()-0.5)*15, life: 1.0, color });
    }
}

function updateParticles() {
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.05;
        if (p.life <= 0) particles.splice(i, 1);
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// --- LEADERBOARD & END ---
function endGame() {
    gameRunning = false;
    document.getElementById("screen-game").classList.add("hidden");
    document.getElementById("screen-result").classList.remove("hidden");
    document.getElementById("final-score").innerText = score;
    document.getElementById("final-combo").innerText = maxCombo;
    
    saveHighScore(score);
}

function saveHighScore(newScore) {
    let lb = JSON.parse(localStorage.getItem('rythMixLB')) || [];
    lb.push({ score: newScore, date: new Date().toLocaleDateString() });
    lb.sort((a, b) => b.score - a.score);
    lb = lb.slice(0, 5);
    localStorage.setItem('rythMixLB', JSON.stringify(lb));
    
    document.getElementById("leaderboard-list").innerHTML = lb.map((s, i) => `
        <div style="display:flex; justify-content:space-between; padding: 5px; border-bottom: 1px solid rgba(255,255,255,0.05)">
            <span>#${i+1}</span> <b>${s.score}</b> <small>${s.date}</small>
        </div>
    `).join("");
}

// INPUTS
window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && gameRunning) togglePause();
    const lane = keys.indexOf(e.key.toLowerCase());
    if (lane !== -1 && !isPaused && gameRunning) checkHit(lane);
});
