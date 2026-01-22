// ============================================
// AUDIO SYSTEM (OPTIMIZED: PRELOAD + VISIBILITY)
// ============================================
const SoundSystem = {
    ctx: null,
    buffers: {},
    isMuted: false,
    heartbeatTimer: null,
    bgmNode: null,
    bgmGain: null,

    // 1. Initialize Context & Start Loading Immediately
    init() {
        if (!this.ctx) {
            // Create context immediately (it will likely be 'suspended' by browser policy)
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            
            // Start fetching files right away so they are ready when user taps
            this.loadSounds();
        }
    },

    // 2. Unlock Audio on User Interaction (Instant Start)
    unlock() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                this.playMusic('bgm');
            });
        } else if (this.ctx && this.ctx.state === 'running' && !this.bgmNode) {
            // Fallback: If context was already running but music wasn't playing
            this.playMusic('bgm');
        }
    },

    // 3. Handle Tab Switching / Minimizing
    handleVisibility() {
        if (!this.ctx) return;
        
        if (document.hidden) {
            // User left the tab/app -> Mute/Suspend
            this.ctx.suspend(); 
        } else {
            // User returned -> Resume
            this.ctx.resume();
        }
    },

    async loadSounds() {
        const fileNames = {
            // --- CORE UI ---
            'grab': 'sounds/piece_grab.wav',
            'place': 'sounds/piece_place.wav',
            'new_best': 'sounds/best_score.wav',
            'heartbeat': 'sounds/heartbeat.wav',
            'game_over': 'sounds/score_banner.wav', 
            
            // --- BACKGROUND MUSIC ---
            'bgm': 'sounds/background.wav',
            
            // --- NEW: POST-GAME BEST SCORE CELEBRATION ---
            'gameover_best': 'sounds/gameover_bestscore.wav', 
            
            // --- PREMIUM MUSIC SFX ---
            'instant_win': 'sounds/instant_win.wav',       
            'winning_swoosh': 'sounds/winning_swoosh.wav', 
            'victory_chime': 'sounds/victory_chime.wav',   
            'epic_victory': 'sounds/epic_victory.wav',

            // --- COMBO VOICES ---
            'combo_2': 'sounds/nice.wav',
            'combo_5': 'sounds/sweet.wav',
            'combo_8': 'sounds/great.wav',
            'combo_10': 'sounds/amazing.wav',
            'combo_13': 'sounds/unreal.wav',
            'combo_15': 'sounds/insane.wav',
            'combo_18': 'sounds/legendary.wav',
            'combo_20': 'sounds/godlike.wav'
        };

        const promises = Object.entries(fileNames).map(async ([name, url]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers[name] = audioBuffer;
                // console.log(`✅ Loaded: ${name}`); 
            } catch (error) {
                console.error(`❌ FAILED loading ${url}`);
            }
        });

        // Wait for all sounds to load
        await Promise.all(promises);
        console.log("🎵 All Audio Assets Ready");
    },

    // --- SFX PLAYER ---
    play(name, pitch = 1.0, volume = 1.0) {
        if (this.isMuted || !this.ctx || !this.buffers[name]) return;

        // Safety: Ensure context is running (sometimes needed on older devices)
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        
        if (pitch !== 1.0) source.playbackRate.value = pitch;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        source.start(0);
    },

    // --- MUSIC PLAYER ---
    playMusic(name) {
        if (this.bgmNode) return;
        if (this.isMuted || !this.ctx || !this.buffers[name]) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.loop = true; 

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 0.18; // 18% Volume

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        
        source.start(0);

        this.bgmNode = source;
        this.bgmGain = gainNode;
    },

    startHeartbeat() {
        if (this.heartbeatTimer) return;
        if (this.buffers['heartbeat']) {
            this.play('heartbeat', 0.9, 0.8);
        }
        this.heartbeatTimer = setTimeout(() => {
            this.heartbeatTimer = null; 
            this.startHeartbeat(); 
        }, 1500);
    },

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
};

// --- INITIALIZATION LISTENERS ---

// 1. Start loading immediately (don't wait for click)
SoundSystem.init();

// 2. Unlock/Resume on first interaction (Instant Sound)
window.addEventListener('pointerdown', () => SoundSystem.unlock(), { once: true });

// 3. Stop audio when app is backgrounded/closed
document.addEventListener('visibilitychange', () => SoundSystem.handleVisibility());

window.SoundSystem = SoundSystem;


// ============================================
// GAME LOGIC
// ============================================

const gridSize = 8;
const grid = document.getElementById("grid");
const tray = document.getElementById("tray");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");

let cells = [], gridState = Array(64).fill(0), combo = 0;
let score = 0; 
let confirmedScore = 0; 
let displayedScore = 0; 

let isGameLocked = false;
let bestScore = parseInt(localStorage.getItem("bloxplode_best_v2")) || 0;
let initialSessionBest = bestScore; 
let hasBrokenRecord = false; 
let nonClearCount = 0; 

bestScoreEl.textContent = bestScore;
const TOUCH_LIFT_AMOUNT = 100;

const SHAPES = {
    DOT: { data: [[0,0]], color: '#FF7F7F' },
    I2: { data: [[0,0],[1,0]], color: '#FFD700' },
    I3: { data: [[0,0],[1,0],[2,0]], color: '#FFD700' },
    I4: { data: [[0,0],[1,0],[2,0],[3,0]], color: '#66CDAA' },
    O2: { data: [[0,0],[1,0],[0,1],[1,1]], color: '#87CEFA' },
    T: { data: [[0,1],[1,0],[1,1],[2,1]], color: '#BA55D3' },
    PLUS: { data: [[1,0],[0,1],[1,1],[2,1],[1,2]], color: '#FFA07A' },
    I2_V:   { data: [[0,0],[0,1]], color: '#4DD6E8' },
    I3_V:   { data: [[0,0],[0,1],[0,2]], color: '#B388FF' },
    CORNER: { data: [[0,0],[1,0],[0,1]], color: '#FFB347' },
    L_LEFT: { data: [[0,0],[0,1],[0,2],[1,2]], color: '#4FC3A1' },
    SKEW:   { data: [[1,0],[2,0],[0,1],[1,1]], color: '#FF6F61' }
};

const SHAPE_TIERS = { 
    EASY:   ['DOT', 'I2', 'O2', 'I2_V', 'CORNER'], 
    MEDIUM: ['I3', 'T', 'I3_V', 'L_LEFT'], 
    HARD:   ['I4', 'PLUS', 'SKEW'] 
};

const VisualPipe = {
    listeners: {},
    on(event, fn) { (this.listeners[event] ||= []).push(fn); },
    emit(event, payload) { (this.listeners[event] || []).forEach(fn => fn(payload)); }
};

const Boss = {
    active: 0, max: 4,
    run({ priority = "low", duration }, fn) {
        if (this.active >= this.max && priority === "low") return;
        this.active++; fn();
        setTimeout(() => { this.active = Math.max(0, this.active - 1); }, duration);
    }
};

let recentShapes = []; 
window.gameScale = 1;

function resizeGame() {
    const gameCol = document.querySelector('.game-column');
    if (!gameCol) return;
    const viewportWidth = window.innerWidth;
    const scale = Math.min(viewportWidth / 404, 1);
    window.gameScale = scale;
    gameCol.style.transform = `scale(${scale})`;
}

function init() {
    resizeGame();
    window.addEventListener('resize', resizeGame);
    window.addEventListener('orientationchange', resizeGame);
    SoundSystem.stopHeartbeat(); 

    grid.innerHTML = ""; cells = []; gridState.fill(0);
    for (let i = 0; i < 64; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        grid.appendChild(cell);
        cells.push(cell);
    }
    recentShapes = [];
    spawnTrayPieces();
    
    score = 0; confirmedScore = 0; displayedScore = 0;
    scoreEl.textContent = "0"; 
    combo = 0; nonClearCount = 0;
    
    document.body.classList.remove('combo-active');
    document.body.removeAttribute('data-grace');
    
    isGameLocked = false;
    document.getElementById("no-space-message").classList.add("hidden");
    document.getElementById("tray").style.opacity = "1";
    document.getElementById('grid-wrapper').classList.remove('state-dimmed');
    
    hasBrokenRecord = false;
    const nbOverlay = document.getElementById('new-best-overlay');
    nbOverlay.classList.add('hidden');
    nbOverlay.classList.remove('fade-out-best');

    cells.forEach(cell => {
        cell.classList.remove('visual-fill');
        cell.style.removeProperty('--block-color');
    });
}

function updateUI() {
    if (displayedScore < confirmedScore) {
        const step = Math.ceil((confirmedScore - displayedScore) / 8);
        displayedScore += Math.max(1, step);
        scoreEl.textContent = displayedScore;
        
        let currentDisplayBest = parseInt(bestScoreEl.textContent) || 0;
        
        if (displayedScore > currentDisplayBest) {
            bestScoreEl.textContent = displayedScore;
            localStorage.setItem("bloxplode_best_v2", displayedScore);
        }
        
        if (displayedScore > initialSessionBest && !hasBrokenRecord) {
            triggerNewBestAnimation();
        }
        
        requestAnimationFrame(updateUI);
    } else {
        if (displayedScore !== confirmedScore) {
            displayedScore = confirmedScore;
            scoreEl.textContent = displayedScore;
            
            let currentDisplayBest = parseInt(bestScoreEl.textContent) || 0;
            if (displayedScore > currentDisplayBest) {
                bestScoreEl.textContent = displayedScore;
                localStorage.setItem("bloxplode_best_v2", displayedScore);
            }
        }
    }
}

function triggerNewBestAnimation() {
    SoundSystem.play('new_best');
    hasBrokenRecord = true;
    const nbOverlay = document.getElementById('new-best-overlay');
    nbOverlay.classList.remove('hidden'); 
    
    setTimeout(() => {
        nbOverlay.classList.add('fade-out-best'); 
        setTimeout(() => {
            nbOverlay.classList.add('hidden');
            nbOverlay.classList.remove('fade-out-best');
        }, 250); 
    }, 2000); 
}

function clearLines(lastRow, lastCol, placedColor) {
    let rToClear = [], cToClear = [];
    
    for (let i = 0; i < 8; i++) { if (gridState.slice(i * 8, (i + 1) * 8).every(v => v)) rToClear.push(i); }
    for (let i = 0; i < 8; i++) {
        let colFull = true;
        for (let r = 0; r < 8; r++) if (!gridState[r * 8 + i]) colFull = false;
        if (colFull) cToClear.push(i);
    }
    
    const totalLines = rToClear.length + cToClear.length;
    
    if (totalLines > 0) {
        combo++;
        nonClearCount = 0; 
        
        if (combo >= 2) {
            document.body.classList.add('combo-active');
            document.body.setAttribute('data-grace', '0'); 
            SoundSystem.startHeartbeat();
            const scoreBox = document.querySelector('.score-box:first-child');
            if (scoreBox) {
                scoreBox.classList.remove('pulse-trigger');
                void scoreBox.offsetWidth; 
                scoreBox.classList.add('pulse-trigger');
            }
        }
        
        let basePayout = 50;
        if (totalLines === 2) basePayout = 150;
        else if (totalLines === 3) basePayout = 350;
        else if (totalLines === 4) basePayout = 750;
        else if (totalLines >= 5) basePayout = 1200;
        
        let finalPoints = basePayout * combo;
        score += finalPoints; 

        VisualPipe.emit("clear_feedback", { combo });
        const targetCellIndex = lastRow * 8 + lastCol;
        VisualPipe.emit("score_float", { points: finalPoints, targetIndex: targetCellIndex });
        VisualPipe.emit("clear_anim", { rToClear, cToClear, combo });

        const clearedIndices = [];
        rToClear.forEach(r => { for (let c = 0; c < 8; c++) { const idx = r * 8 + c; gridState[idx] = 0; clearedIndices.push(idx); } });
        cToClear.forEach(c => { for (let r = 0; r < 8; r++) { const idx = r * 8 + c; gridState[idx] = 0; clearedIndices.push(idx); } });
        VisualPipe.emit("reset_cells", { indices: clearedIndices });

    } else {
        nonClearCount++;
        if (combo >= 2) { 
            document.body.setAttribute('data-grace', nonClearCount);
        }
        if (nonClearCount >= 3) {
            combo = 0;
            nonClearCount = 0;
            document.body.classList.remove('combo-active');
            document.body.removeAttribute('data-grace');
            SoundSystem.stopHeartbeat();
        }
    }
}

function getBoardOccupancy() { const filled = gridState.filter(v => v === 1).length; return filled / 64; }

function canShapeFitAnywhere(shapeKey) {
    const data = SHAPES[shapeKey].data;
    for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { if (canPlace(data, r, c)) return true; } }
    return false;
}

function getWeightedRandomShape(weights) {
    let pool = [];
    SHAPE_TIERS.EASY.forEach(key => {
        const repeatPenalty = recentShapes.includes(key) ? 0.5 : 1; 
        const count = Math.floor(weights.EASY * 10 * repeatPenalty);
        for(let i=0; i<count; i++) pool.push(key);
    });
    SHAPE_TIERS.MEDIUM.forEach(key => {
        const repeatPenalty = recentShapes.includes(key) ? 0.5 : 1;
        const count = Math.floor(weights.MEDIUM * 10 * repeatPenalty);
        for(let i=0; i<count; i++) pool.push(key);
    });
    SHAPE_TIERS.HARD.forEach(key => {
        const repeatPenalty = recentShapes.includes(key) ? 0.5 : 1;
        const count = Math.floor(weights.HARD * 10 * repeatPenalty);
        for(let i=0; i<count; i++) pool.push(key);
    });
    if (pool.length === 0) return 'DOT'; 
    return pool[Math.floor(Math.random() * pool.length)];
}

function spawnTrayPieces() {
    const slots = document.querySelectorAll(".tray-slot");
    const occupancy = getBoardOccupancy();
    let weights = { EASY: 4, MEDIUM: 4, HARD: 4 };
    if (score < 2000) {
        if (occupancy < 0.3) weights = { EASY: 3, MEDIUM: 4, HARD: 3 }; 
        else if (occupancy < 0.6) weights = { EASY: 5, MEDIUM: 4, HARD: 2 }; 
        else weights = { EASY: 8, MEDIUM: 2, HARD: 0 }; 
    } else {
        if (occupancy >= 0.80) weights = { EASY: 6, MEDIUM: 3, HARD: 1 };
    }
    let newPieces = [], attempts = 0, validSetFound = false;
    while (!validSetFound && attempts < 10) {
        newPieces = [];
        for(let i=0; i<3; i++) newPieces.push(getWeightedRandomShape(weights));
        if (newPieces.some(key => canShapeFitAnywhere(key))) validSetFound = true;
        else attempts++;
    }
    if (!validSetFound) newPieces[0] = 'DOT'; 
    recentShapes = [...newPieces];
    slots.forEach((slot, index) => {
        slot.innerHTML = ""; 
        const key = newPieces[index];
        const piece = document.createElement("div");
        piece.className = "piece";
        piece.dataset.shape = key;
        renderPiece(piece, SHAPES[key]);
        slot.appendChild(piece);
    });
}

function renderPiece(el, shapeObj) {
    el.style.setProperty('--block-color', shapeObj.color);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapeObj.data.forEach(([x, y]) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });
    const trayBlockSize = 26;
    el.style.width = ((maxX - minX + 1) * trayBlockSize) + "px";
    el.style.height = ((maxY - minY + 1) * trayBlockSize) + "px";
    shapeObj.data.forEach(([x, y]) => {
        const block = document.createElement("div");
        block.className = "block";
        block.style.left = ((x - minX) * trayBlockSize) + "px";
        block.style.top = ((y - minY) * trayBlockSize) + "px";
        el.appendChild(block);
    });
}

function canPlace(shapeData, row, col) {
    return shapeData.every(([dx, dy]) => {
        const r = row + dy, c = col + dx;
        return r >= 0 && c >= 0 && r < 8 && c < 8 && !gridState[r * 8 + c];
    });
}

let activeDrag = null;

window.addEventListener('pointerdown', e => {
    if (isGameLocked) return; 
    
    const slot = e.target.closest('.tray-slot');
    if (!slot || activeDrag) return;
    const piece = slot.querySelector('.piece');
    if (!piece) return;

    const shapeKey = piece.dataset.shape;
    const shapeData = SHAPES[shapeKey].data;
    
    const clone = piece.cloneNode(true);
    clone.classList.add("dragging");
    clone.style.transform = `scale(${window.gameScale})`;
    clone.style.transformOrigin = "center"; 
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapeData.forEach(([x, y]) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });
    const sz = 44, gap = 4;
    const w = (maxX - minX + 1) * sz + (maxX - minX) * gap;
    const h = (maxY - minY + 1) * sz + (maxY - minY) * gap;
    
    clone.style.width = w + "px"; 
    clone.style.height = h + "px";
    
    clone.querySelectorAll('.block').forEach((b, i) => {
        const [x, y] = shapeData[i];
        b.style.left = (x - minX) * (sz + gap) + "px";
        b.style.top = (y - minY) * (sz + gap) + "px";
    });

    const isTouch = (e.pointerType === 'touch');
    const lift = isTouch ? TOUCH_LIFT_AMOUNT : 0;
    
    SoundSystem.play('grab');
    
    const startLeft = e.clientX - w / 2;
    const startTop = e.clientY - h / 2 - lift;

    clone.style.left = startLeft + "px";
    clone.style.top = startTop + "px";
    
    document.body.appendChild(clone);
    piece.style.visibility = "hidden";
    slot.setPointerCapture(e.pointerId);
    
    activeDrag = { 
        id: e.pointerId, 
        source: piece, 
        slot: slot, 
        clone: clone,
        isTouch: isTouch,
        startX: e.clientX,
        startY: e.clientY,
        cloneStartX: startLeft,
        cloneStartY: startTop,
        shape: SHAPES[shapeKey], 
        color: SHAPES[shapeKey].color,
        lastRow: null, 
        lastCol: null
    };
});

window.addEventListener('pointermove', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;

    const deltaX = e.clientX - activeDrag.startX;
    const deltaY = e.clientY - activeDrag.startY;

    let factorX = 1;
    let factorY = 1;

    if (activeDrag.isTouch) {
        factorX = 1.2;
        factorY = (deltaY < 0) ? 1.5 : 1.2; 
    }

    const moveX = deltaX * factorX;
    const moveY = deltaY * factorY;

    const visualLeft = activeDrag.cloneStartX + moveX;
    const visualTop = activeDrag.cloneStartY + moveY;

    activeDrag.clone.style.left = visualLeft + "px";
    activeDrag.clone.style.top = visualTop + "px";

    const gRect = grid.getBoundingClientRect();
    const col = Math.round((visualLeft - gRect.left) / (48 * window.gameScale));
    const row = Math.round((visualTop - gRect.top) / (48 * window.gameScale));

    if (activeDrag.lastRow === row && activeDrag.lastCol === col) return;
    activeDrag.lastRow = row;
    activeDrag.lastCol = col;

    cells.forEach(c => {
        c.classList.remove('ghost', 'ghost-clear');
        if (!c.classList.contains('occupied') && !c.classList.contains('clear-resolve')) {
            c.style.removeProperty('--block-color');
        }
        c.style.removeProperty('--preview-color'); 
    });

    if (canPlace(activeDrag.shape.data, row, col)) {
        let temp = [...gridState];
        activeDrag.shape.data.forEach(([dx, dy]) => { temp[(row + dy) * 8 + (col + dx)] = 1; });
        let clearingIndices = new Set();
        
        for (let i = 0; i < 8; i++) { if (temp.slice(i * 8, (i + 1) * 8).every(v => v)) { for(let c=0; c<8; c++) clearingIndices.add(i * 8 + c); } }
        for (let i = 0; i < 8; i++) { let colFull = true; for (let r = 0; r < 8; r++) if (!temp[r * 8 + i]) colFull = false; if (colFull) for(let r=0; r<8; r++) clearingIndices.add(r * 8 + i); }
        
        if (clearingIndices.size > 0) {
            clearingIndices.forEach(idx => {
                cells[idx].classList.add('ghost-clear');
                cells[idx].style.setProperty('--preview-color', activeDrag.color);
            });
        } else {
            activeDrag.shape.data.forEach(([dx, dy]) => {
                const idx = (row + dy) * 8 + (col + dx);
                cells[idx].classList.add('ghost');
                cells[idx].style.setProperty('--block-color', activeDrag.color);
            });
        }
    }
});

window.addEventListener('pointerup', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;

    cells.forEach(c => {
        c.classList.remove('ghost', 'ghost-clear');
        if (!c.classList.contains('occupied')) { c.style.removeProperty('--block-color'); }
        c.style.removeProperty('--preview-color');
    });

    activeDrag.slot.releasePointerCapture(e.pointerId);

    const deltaX = e.clientX - activeDrag.startX;
    const deltaY = e.clientY - activeDrag.startY;
    
    let factorX = 1;
    let factorY = 1;
    if (activeDrag.isTouch) {
        factorX = 1.2;
        factorY = (deltaY < 0) ? 1.5 : 1.2; 
    }

    const visualLeft = activeDrag.cloneStartX + (deltaX * factorX);
    const visualTop = activeDrag.cloneStartY + (deltaY * factorY);

    const gRect = grid.getBoundingClientRect();
    const col = Math.round((visualLeft - gRect.left) / (48 * window.gameScale));
    const row = Math.round((visualTop - gRect.top) / (48 * window.gameScale));

    if (canPlace(activeDrag.shape.data, row, col)) {
        
        SoundSystem.play('place'); 
        
        score += 5; confirmedScore += 5; updateUI();
        const placedColor = activeDrag.color;
        const placementIndices = [];
        activeDrag.shape.data.forEach(([dx, dy]) => {
            const idx = (row + dy) * 8 + (col + dx);
            gridState[idx] = 1;
            placementIndices.push(idx);
        });
        VisualPipe.emit("piece_placed", { indices: placementIndices, color: placedColor });
        activeDrag.source.remove();
        requestAnimationFrame(() => {
            clearLines(row, col, placedColor);
            if (document.querySelectorAll(".tray-slot .piece").length === 0) spawnTrayPieces();
            if (checkGameOver()) {
                runGameOverSequence();
            }
        });
    } else { 
        activeDrag.source.style.visibility = "visible"; 
    }
    
    activeDrag.clone.remove();
    activeDrag = null;
});

function cancelDrag() {
    if (!activeDrag) return; 
    if (activeDrag.source) activeDrag.source.style.visibility = "visible";
    if (activeDrag.clone) activeDrag.clone.remove();
    cells.forEach(c => {
        c.classList.remove('ghost', 'ghost-clear');
        if (!c.classList.contains('occupied')) { c.style.removeProperty('--block-color'); }
        c.style.removeProperty('--preview-color');
    });
    if (activeDrag.slot && activeDrag.id) { try { activeDrag.slot.releasePointerCapture(activeDrag.id); } catch (e) { } }
    activeDrag = null;
}
window.addEventListener('pointercancel', cancelDrag);
window.addEventListener('blur', cancelDrag);

window.addEventListener('contextmenu', e => { e.preventDefault(); });

document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDrag(); });
document.addEventListener('dblclick', function(event) { event.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', function(event) { event.preventDefault(); });

function checkGameOver() {
    const pieces = document.querySelectorAll(".tray-slot .piece");
    if (pieces.length === 0) return false;
    for (const p of pieces) {
        const data = SHAPES[p.dataset.shape].data;
        for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) if (canPlace(data, r, c)) return false; }
    }
    return true; 
}

function fireConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = ''; 
    const colors = ['#FFD700', '#FF007A', '#00E5FF', '#00FF7F', '#FFFFFF'];
    
    for(let i=0; i<50; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti-piece';
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const startX = side === 'left' ? Math.random() * 20 : 80 + Math.random() * 20;
        conf.style.left = startX + '%';
        conf.style.top = '100%';
        const tx = (Math.random() - 0.5) * 200; 
        const ty = -600 - Math.random() * 400;  
        const rot = Math.random() * 720;        
        conf.style.setProperty('--tx', `${tx}px`);
        conf.style.setProperty('--ty', `${ty}px`);
        conf.style.setProperty('--rot', `${rot}deg`);
        conf.style.width = (8 + Math.random() * 6) + 'px';
        conf.style.height = (8 + Math.random() * 6) + 'px';
        conf.style.animation = `confetti-fall ${1.0 + Math.random() * 0.5}s cubic-bezier(0.25, 1, 0.5, 1) forwards`;
        conf.style.animationDelay = (0.6 + Math.random() * 0.3) + 's'; 
        container.appendChild(conf);
    }
}

function runGameOverSequence() {
    isGameLocked = true; 
    const gridWrapper = document.getElementById('grid-wrapper');
    const msgEl = document.getElementById("no-space-message");
    const trayEl = document.getElementById("tray");
    gridWrapper.classList.add('state-dimmed');
    trayEl.style.opacity = "0"; 
    msgEl.classList.remove("hidden");
    
    setTimeout(() => {
        const colorPalette = Object.values(SHAPES).map(s => s.color);
        cells.forEach((cell, index) => {
            if (!gridState[index]) { 
                const row = Math.floor(index / 8);
                const invertedRow = 7 - row; 
                const delay = invertedRow * 60; 
                setTimeout(() => {
                    const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                    cell.style.setProperty('--block-color', randomColor);
                    cell.classList.add('visual-fill'); 
                }, delay);
            }
        });
    }, 350); 
    
    setTimeout(() => {
        document.querySelector('.top-bar').classList.add('fade-out');
        if (score > initialSessionBest) {
            const nrOverlay = document.getElementById("new-record-overlay");
            const nrScoreDisplay = document.getElementById("nr-score-val");
            const nrBtn = document.getElementById("nr-restart-btn");
            
            // --- DELAYED SOUND (Syncs with CSS 0.55s Animation) ---
            setTimeout(() => {
                SoundSystem.play('gameover_best');
            }, 550);

            nrOverlay.classList.remove("hidden"); 
            fireConfetti(); 
            nrScoreDisplay.textContent = "0";
            nrBtn.classList.remove('reveal');
            setTimeout(() => {
                animateValue(nrScoreDisplay, 0, score, 1500, nrBtn);
            }, 1200);
        } else {
            const goOverlay = document.getElementById("game-over-overlay");
            const goScoreDisplay = document.getElementById("go-score-val");
            const goBestDisplay = document.getElementById("go-best-val");
            const goBtn = document.getElementById("restart-overlay-btn");
            
            // --- DELAYED SOUND (Syncs with CSS 0.55s Animation) ---
            setTimeout(() => {
                SoundSystem.play('game_over'); 
            }, 550);

            goOverlay.classList.remove("hidden");
            
            goBestDisplay.textContent = bestScore;
            goScoreDisplay.textContent = "0";
            goBtn.classList.remove('reveal');
            setTimeout(() => {
                animateValue(goScoreDisplay, 0, score, 1200, goBtn);
            }, 300); 
        }
    }, 800);
}

function animateValue(obj, start, end, duration, btnToReveal) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!start) start = 0;
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            if(btnToReveal) btnToReveal.classList.add('reveal');
        }
    };
    window.requestAnimationFrame(step);
}

function fullReset() { 
    score = 0; confirmedScore = 0; displayedScore = 0; combo = 0; 
    SoundSystem.stopHeartbeat();
    
    document.body.classList.remove('combo-active'); 
    document.body.removeAttribute('data-grace');
    
    document.getElementById("game-over-overlay").classList.add("hidden"); 
    document.getElementById("new-record-overlay").classList.add("hidden");
    document.getElementById("confetti-container").innerHTML = ''; 
    
    document.querySelector('.top-bar').classList.remove('fade-out');

    isGameLocked = false;
    document.getElementById("no-space-message").classList.add("hidden");
    document.getElementById("tray").style.opacity = "1";
    document.getElementById('grid-wrapper').classList.remove('state-dimmed');
    
    document.getElementById("restart-overlay-btn").classList.remove('reveal');
    document.getElementById("nr-restart-btn").classList.remove('reveal');
    
    hasBrokenRecord = false;
    const nbOverlay = document.getElementById('new-best-overlay');
    nbOverlay.classList.add('hidden');
    nbOverlay.classList.remove('fade-out-best');

    cells.forEach(cell => {
        cell.classList.remove('visual-fill');
        cell.style.removeProperty('--block-color');
    });

    initialSessionBest = bestScore; 
    init(); 
}

document.getElementById("restart-overlay-btn").onclick = fullReset;
init();
// --- SETTINGS MENU LOGIC ---
function toggleSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}