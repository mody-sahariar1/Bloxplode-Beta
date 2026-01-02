const gridSize = 8;
const grid = document.getElementById("grid");
const tray = document.getElementById("tray");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const overlay = document.getElementById("game-over-overlay");

let cells = [], gridState = Array(64).fill(0), combo = 0;
let score = 0; 
let confirmedScore = 0; 
let displayedScore = 0; 

// GAME STATE
let isGameLocked = false;

// --- BEST SCORE LOGIC (RESET APPLIED via New Key) ---
// Key remains "bloxplode_best_v2" to keep your fresh start
let bestScore = parseInt(localStorage.getItem("bloxplode_best_v2")) || 0;
let initialSessionBest = bestScore; 
let hasBrokenRecord = false; 

let nonClearCount = 0; 

bestScoreEl.textContent = bestScore;

// --- CONFIGURATION ---
// UPDATED: Set to 150px as requested
const TOUCH_LIFT_AMOUNT = 150;

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
    
    // VISUAL RESET
    document.body.classList.remove('combo-active');
    document.body.removeAttribute('data-grace');
    
    // GAME OVER RESET
    isGameLocked = false;
    document.getElementById("no-space-message").classList.add("hidden");
    document.getElementById("tray").style.opacity = "1";
    document.getElementById('grid-wrapper').classList.remove('state-dimmed');
    
    // RESET NEW BEST ANIMATION
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
        
        // --- NEW LOGIC: LIVE BEST SCORE "TOWING" ---
        let currentDisplayBest = parseInt(bestScoreEl.textContent) || 0;
        
        if (displayedScore > currentDisplayBest) {
            bestScoreEl.textContent = displayedScore;
            // Also save specifically to the new key
            localStorage.setItem("bloxplode_best_v2", displayedScore);
        }
        
        // --- NEW BEST ANIMATION TRIGGER ---
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

// --- NEW BEST ANIMATION TRIGGER ---
function triggerNewBestAnimation() {
    hasBrokenRecord = true;
    const nbOverlay = document.getElementById('new-best-overlay');
    nbOverlay.classList.remove('hidden'); // SHOW IT
    
    // SYNCED TIMELINE (2.0s to match CSS):
    setTimeout(() => {
        nbOverlay.classList.add('fade-out-best'); // Safety fade
        
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
        if (combo >= 2) { document.body.setAttribute('data-grace', nonClearCount); }
        if (nonClearCount >= 3) {
            combo = 0;
            nonClearCount = 0;
            document.body.classList.remove('combo-active');
            document.body.removeAttribute('data-grace');
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
    clone.style.width = w + "px"; clone.style.height = h + "px";
    clone.querySelectorAll('.block').forEach((b, i) => {
        const [x, y] = shapeData[i];
        b.style.left = (x - minX) * (sz + gap) + "px";
        b.style.top = (y - minY) * (sz + gap) + "px";
    });
    const isTouch = (e.pointerType === 'touch');
    const lift = isTouch ? TOUCH_LIFT_AMOUNT : 0;
    clone.style.left = (e.clientX - w / 2) + "px";
    clone.style.top = (e.clientY - h / 2 - lift) + "px";
    document.body.appendChild(clone);
    piece.style.visibility = "hidden";
    slot.setPointerCapture(e.pointerId);
    activeDrag = { 
        id: e.pointerId, source: piece, slot: slot, clone: clone, 
        offX: w / 2, offY: h / 2, lift: lift, shape: SHAPES[shapeKey], color: SHAPES[shapeKey].color,
        lastRow: null, lastCol: null
    };
});

window.addEventListener('pointermove', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;
    const visualLeft = e.clientX - activeDrag.offX;
    const visualTop = e.clientY - activeDrag.offY - activeDrag.lift;
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
    const visualLeft = e.clientX - activeDrag.offX;
    const visualTop = e.clientY - activeDrag.offY - activeDrag.lift;
    const gRect = grid.getBoundingClientRect();
    const col = Math.round((visualLeft - gRect.left) / (48 * window.gameScale));
    const row = Math.round((visualTop - gRect.top) / (48 * window.gameScale));
    if (canPlace(activeDrag.shape.data, row, col)) {
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
    } else { activeDrag.source.style.visibility = "visible"; }
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

// --- FIXED: LONG PRESS (Context Menu) DOES NOT CANCEL DRAG NOW ---
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

// --- NEW CONFETTI LOGIC (50% FASTER) ---
function fireConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = ''; // Clear previous
    const colors = ['#FFD700', '#FF007A', '#00E5FF', '#00FF7F', '#FFFFFF'];
    
    // Spawn 50 particles
    for(let i=0; i<50; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti-piece';
        
        // Random Color
        conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Random Start Position (Bottom Corners)
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const startX = side === 'left' ? Math.random() * 20 : 80 + Math.random() * 20;
        conf.style.left = startX + '%';
        conf.style.top = '100%';
        
        // Physics Vars
        const tx = (Math.random() - 0.5) * 200; 
        const ty = -600 - Math.random() * 400;  
        const rot = Math.random() * 720;        
        
        conf.style.setProperty('--tx', `${tx}px`);
        conf.style.setProperty('--ty', `${ty}px`);
        conf.style.setProperty('--rot', `${rot}deg`);
        
        conf.style.width = (8 + Math.random() * 6) + 'px';
        conf.style.height = (8 + Math.random() * 6) + 'px';
        
        // SPEED CHANGE: Duration reduced to 1.0 - 1.5s (50% faster)
        conf.style.animation = `confetti-fall ${1.0 + Math.random() * 0.5}s cubic-bezier(0.25, 1, 0.5, 1) forwards`;
        conf.style.animationDelay = (0.6 + Math.random() * 0.3) + 's'; 
        
        container.appendChild(conf);
    }
}

// --- UPDATED GAME OVER SEQUENCE ---
function runGameOverSequence() {
    isGameLocked = true; 
    const gridWrapper = document.getElementById('grid-wrapper');
    const msgEl = document.getElementById("no-space-message");
    const trayEl = document.getElementById("tray");
    gridWrapper.classList.add('state-dimmed');
    trayEl.style.opacity = "0"; 
    msgEl.classList.remove("hidden");
    
    // 1. FILL ANIMATION (Grid Bricking Up)
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
    
    // 2. DETERMINE WHICH OVERLAY TO SHOW (800ms trigger)
    setTimeout(() => {
        // HIDE TOP BAR
        document.querySelector('.top-bar').classList.add('fade-out');
        
        // CHECK RECORD (Current Score > Session Start Best)
        if (score > initialSessionBest) {
            
            // --- NEW RECORD SEQUENCE ---
            const nrOverlay = document.getElementById("new-record-overlay");
            const nrScoreDisplay = document.getElementById("nr-score-val");
            const nrBtn = document.getElementById("nr-restart-btn");
            
            nrOverlay.classList.remove("hidden"); // Triggers CSS Fade In (0.5s delay)
            
            fireConfetti(); // Triggers Confetti
            
            // Count Up Animation
            nrScoreDisplay.textContent = "0";
            nrBtn.classList.remove('reveal');
            
            // Delay counting until text slides in (~1.2s total delay)
            setTimeout(() => {
                animateValue(nrScoreDisplay, 0, score, 1500, nrBtn);
            }, 1200);
            
        } else {
            
            // --- STANDARD GAME OVER SEQUENCE ---
            const goOverlay = document.getElementById("game-over-overlay");
            const goScoreDisplay = document.getElementById("go-score-val");
            const goBestDisplay = document.getElementById("go-best-val");
            const goBtn = document.getElementById("restart-overlay-btn");
            
            goOverlay.classList.remove("hidden");
            
            // Static Best Score
            goBestDisplay.textContent = bestScore;
            
            // Count Up Main Score
            goScoreDisplay.textContent = "0";
            goBtn.classList.remove('reveal');
            
            setTimeout(() => {
                animateValue(goScoreDisplay, 0, score, 1200, goBtn);
            }, 300); // Standard delay
        }
        
    }, 800);
}

// Helper to handle counting for both overlays
function animateValue(obj, start, end, duration, btnToReveal) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!start) start = 0;
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        obj.textContent = Math.floor(progress * (end - start) + start);
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Reveal Button when done
            if(btnToReveal) btnToReveal.classList.add('reveal');
        }
    };
    window.requestAnimationFrame(step);
}

function fullReset() { 
    score = 0; confirmedScore = 0; displayedScore = 0; combo = 0; 
    document.body.classList.remove('combo-active'); 
    document.body.removeAttribute('data-grace');
    
    // HIDE BOTH OVERLAYS
    document.getElementById("game-over-overlay").classList.add("hidden"); 
    document.getElementById("new-record-overlay").classList.add("hidden");
    document.getElementById("confetti-container").innerHTML = ''; // Clean confetti
    
    document.querySelector('.top-bar').classList.remove('fade-out');

    isGameLocked = false;
    document.getElementById("no-space-message").classList.add("hidden");
    document.getElementById("tray").style.opacity = "1";
    document.getElementById('grid-wrapper').classList.remove('state-dimmed');
    
    // Reset buttons
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

    // Update Session Best for next run
    initialSessionBest = bestScore; 

    init(); 
}
document.getElementById("restart-overlay-btn").onclick = fullReset;
init();