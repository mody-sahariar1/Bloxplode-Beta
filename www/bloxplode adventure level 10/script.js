// ==========================================
// 1. VISUAL PIPE & UTILS
// ==========================================
const VisualPipe = {
    listeners: {},
    on(event, fn) { (this.listeners[event] ||= []).push(fn); },
    emit(event, payload) { (this.listeners[event] || []).forEach(fn => fn(payload)); }
};

const Boss = {
    active: 0,
    max: 4,
    run({ priority = "low", duration }, fn) {
        if (this.active >= this.max && priority === "low") return;
        this.active++;
        fn();
        setTimeout(() => { this.active = Math.max(0, this.active - 1); }, duration);
    }
};

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
            'gem_pop': '../sounds/sharp_pop.wav',       // Added back (Required)
            'gem_collect': '../sounds/gem_collect.wav', // Added back (Required)
            'grab': '../sounds/piece_grab.wav',
            'place': '../sounds/piece_place.wav',
            'new_best': '../sounds/best_score.wav',     // Added back (Required)
            'heartbeat': '../sounds/heartbeat.wav',
            'game_over': '../sounds/score_banner.wav',
            'bgm': '../sounds/background.wav',
            'gameover_best': '../sounds/gameover_bestscore.wav',
            'instant_win': '../sounds/instant_win.wav',
            'winning_swoosh': '../sounds/winning_swoosh.wav',
            'victory_chime': '../sounds/victory_chime.wav',
            'epic_victory': '../sounds/epic_victory.wav',
            'combo_2': '../sounds/nice.wav',
            'combo_5': '../sounds/sweet.wav',
            'combo_8': '../sounds/great.wav',
            'combo_10': '../sounds/amazing.wav',
            'combo_13': '../sounds/unreal.wav',
            'combo_15': '../sounds/insane.wav',
            'combo_18': '../sounds/legendary.wav',
            'combo_20': '../sounds/godlike.wav'
        };

        const promises = Object.entries(fileNames).map(async ([name, url]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers[name] = audioBuffer;
                // console.log(`✅ Loaded: ${name}`); // Comment out to reduce logs
            } catch (error) {
                console.error(`❌ FAILED loading ${url}`);
            }
        });

        // Wait for all sounds to load
        await Promise.all(promises);
        console.log("🎵 All Audio Assets Ready");
    },

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

    playMusic(name) {
        if (this.bgmNode) return; // Already playing
        if (this.isMuted || !this.ctx || !this.buffers[name]) return;

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.loop = true; 
        
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 0.18; 
        
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

// ==========================================
// 2. ADVENTURE MODE CONFIGURATION
// ==========================================
// UPDATED: Now includes ID 4 (Red) in the map layout
const LEVEL_1_MAP = [
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 1, 3, 2, 1, 0, 0,
    0, 1, 2, 1, 1, 3, 1, 0,  
    0, 2, 1, 3, 4, 1, 3, 0, 
    0, 1, 4, 1, 1, 2, 1, 0, 
    0, 0, 1, 2, 3, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0
];

// UPDATED: Added red goal
let levelGoals = { gold: 0, purple: 0, red: 0 };

// ==========================================
// 3. CORE VARIABLES & SHAPES
// ==========================================
const gridSize = 8;
const grid = document.getElementById("grid");
const tray = document.getElementById("tray");
const overlay = document.getElementById("game-over-overlay");

let cells = [], gridState = Array(64).fill(0), combo = 0;
let nonClearCount = 0; 

// --- Move Tracking for Ramp Up ---
let moveCount = 0;

const TOUCH_LIFT_AMOUNT = 100;
window.gameScale = 1;
window.gameEnded = false; 

// UPDATED: Electric Cyan Hex Code (Previous was #FF9F43)
const PINK_COLOR = '#00d2d3';

const SHAPES = {
    DOT:    { data: [[0,0]], color: PINK_COLOR },
    I2:     { data: [[0,0],[1,0]], color: PINK_COLOR },
    I3:     { data: [[0,0],[1,0],[2,0]], color: PINK_COLOR },
    I4:     { data: [[0,0],[1,0],[2,0],[3,0]], color: PINK_COLOR },
    O2:     { data: [[0,0],[1,0],[0,1],[1,1]], color: PINK_COLOR },
    T:      { data: [[0,1],[1,0],[1,1],[2,1]], color: PINK_COLOR },
    PLUS:   { data: [[1,0],[0,1],[1,1],[2,1],[1,2]], color: PINK_COLOR },
    I2_V:   { data: [[0,0],[0,1]], color: PINK_COLOR },
    I3_V:   { data: [[0,0],[0,1],[0,2]], color: PINK_COLOR },
    CORNER: { data: [[0,0],[1,0],[0,1]], color: PINK_COLOR },
    L_LEFT: { data: [[0,0],[0,1],[0,2],[1,2]], color: PINK_COLOR },
    SKEW:   { data: [[1,0],[2,0],[0,1],[1,1]], color: PINK_COLOR }
};

const SHAPE_TIERS_EXPANDED = {
    EASY: ['DOT', 'I2', 'O2', 'I2_V', 'CORNER'],        
    MEDIUM: ['I3', 'T', 'I3_V'],              
    HARD: ['I4', 'PLUS', 'L_LEFT', 'SKEW']              
};

// ==========================================
// 4. INITIALIZATION & LOGIC
// ==========================================
let recentShapes = []; 

function resizeGame() {
    // 🛑 HANDLED GLOBALLY NOW
    // We leave this empty so the code doesn't crash, 
    // but we let global-settings.js handle the actual sizing.
    if (!window.gameScale) window.gameScale = 1;
}

// UPDATED: Handle red count UI
function updateGoalUI() {
    const gEl = document.getElementById('gold-count');
    const pEl = document.getElementById('purple-count');
    const rEl = document.getElementById('red-count'); 
    if(gEl) gEl.textContent = levelGoals.gold;
    if(pEl) pEl.textContent = levelGoals.purple;
    if(rEl) rEl.textContent = levelGoals.red; 
}

function loadLevel() {
    // UPDATED: Goals for 3 gem types
    levelGoals = { gold: 15, purple: 15, red: 15 };
    
    gridState = [...LEVEL_1_MAP]; 

    gridState.forEach((val, idx) => {
        const cell = cells[idx];
        cell.className = "cell"; 
        
        if (val === 1) {
            cell.classList.add('occupied', 'embedded-wall');
        } else if (val === 2) {
            cell.classList.add('occupied', 'embedded-gold');
        } else if (val === 3) {
            cell.classList.add('occupied', 'embedded-purple');
        } else if (val === 4) {
            cell.classList.add('occupied', 'embedded-red'); 
        }
    });
    updateGoalUI();
}

function init() {
    resizeGame();
    window.addEventListener('resize', resizeGame);
    window.addEventListener('orientationchange', resizeGame);
    SoundSystem.stopHeartbeat(); 

    grid.innerHTML = ""; cells = []; 
    for (let i = 0; i < 64; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        grid.appendChild(cell);
        cells.push(cell);
    }
    
    // --- RESET MOVE COUNT ---
    moveCount = 0;

    // --- START SEQUENCE TRIGGER ---
    window.inputLocked = true;
    
    loadLevel(); 
    recentShapes = [];
    spawnTrayPieces();
    
    combo = 0; nonClearCount = 0;
    
    const slots = document.querySelectorAll('.tray-slot');
    slots.forEach(slot => {
        slot.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
    });

    // TRIGGER VISUAL PIPE SEQUENCE (T=0)
    VisualPipe.emit("start_sequence", { 
        gold: levelGoals.gold, 
        purple: levelGoals.purple,
        red: levelGoals.red 
    });
}

function clearLines(lastRow, lastCol, placedColor) {
    let rToClear = [], cToClear = [];
    
    for (let i = 0; i < 8; i++) {
        if (gridState.slice(i * 8, (i + 1) * 8).every(v => v !== 0)) rToClear.push(i);
    }
    for (let i = 0; i < 8; i++) {
        let colFull = true;
        for (let r = 0; r < 8; r++) if (gridState[r * 8 + i] === 0) colFull = false;
        if (colFull) cToClear.push(i);
    }
    
    const totalLines = rToClear.length + cToClear.length;
    
    if (totalLines > 0) {
        combo++;
        nonClearCount = 0; 

        if (combo >= 2) {
            SoundSystem.startHeartbeat();
        }
        
        VisualPipe.emit("clear_feedback", { combo });
        VisualPipe.emit("clear_anim", { rToClear, cToClear, combo });
        
        const clearedIndices = [];
        const lines = [...rToClear.map(r => ({type:'row', idx:r})), ...cToClear.map(c => ({type:'col', idx:c}))];

        lines.forEach(line => {
            for (let k = 0; k < 8; k++) {
                const idx = line.type === 'row' ? (line.idx * 8 + k) : (k * 8 + line.idx);
                
                const cellValue = gridState[idx];
                
                if (gridState[idx] !== 0) {
                    
                    // --- GEM LOGIC (UPDATED WITH RED) ---
                    if (cellValue === 2 || cellValue === 3 || cellValue === 4) {
                        // 1. Update Game State (Logic)
                        if (cellValue === 2) levelGoals.gold = Math.max(0, levelGoals.gold - 1);
                        if (cellValue === 3) levelGoals.purple = Math.max(0, levelGoals.purple - 1);
                        if (cellValue === 4) levelGoals.red = Math.max(0, levelGoals.red - 1); 
                        
                        // 2. Emit Visual Event
                        VisualPipe.emit("gem_flight", { 
                            sourceIdx: idx, 
                            gemType: cellValue,
                            newGold: levelGoals.gold,
                            newPurple: levelGoals.purple,
                            newRed: levelGoals.red 
                        });
                    }
                    
                    gridState[idx] = 0;
                    clearedIndices.push(idx);
                }
            }
        });
        
        VisualPipe.emit("reset_cells", { indices: clearedIndices });

        // --- VICTORY LOGIC (UPDATED WITH RED) ---
        if (levelGoals.gold === 0 && levelGoals.purple === 0 && levelGoals.red === 0 && !window.gameEnded) {
            window.gameEnded = true; 
            // 400ms Hold + 400ms Flight + 50ms buffer = 850ms
            setTimeout(() => {
                VisualPipe.emit("level_complete");
            }, 850);
        }

    } else {
        nonClearCount++;
        if (nonClearCount >= 3) {
            combo = 0;
            nonClearCount = 0;
            SoundSystem.stopHeartbeat();
        }
    }
}

// ==========================================
// 5. HELPER FUNCTIONS
// ==========================================
function getBoardOccupancy() {
    const filled = gridState.filter(v => v !== 0).length;
    return filled / 64; 
}

function canShapeFitAnywhere(shapeKey) {
    const data = SHAPES[shapeKey].data;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (canPlace(data, r, c)) return true;
        }
    }
    return false;
}

function getWeightedRandomShape(weights) {
    let pool = [];
    const currentTiers = SHAPE_TIERS_EXPANDED;

    currentTiers.EASY.forEach(key => {
        const count = Math.floor(weights.EASY * 10 * (recentShapes.includes(key) ? 0.5 : 1));
        for(let i=0; i<count; i++) pool.push(key);
    });
    currentTiers.MEDIUM.forEach(key => {
        const count = Math.floor(weights.MEDIUM * 10 * (recentShapes.includes(key) ? 0.5 : 1));
        for(let i=0; i<count; i++) pool.push(key);
    });
    currentTiers.HARD.forEach(key => {
        const count = Math.floor(weights.HARD * 10 * (recentShapes.includes(key) ? 0.5 : 1));
        for(let i=0; i<count; i++) pool.push(key);
    });
    if (pool.length === 0) return 'DOT'; 
    return pool[Math.floor(Math.random() * pool.length)];
}

function spawnTrayPieces() {
    const slots = document.querySelectorAll(".tray-slot");
    const occupancy = getBoardOccupancy();
    
    let weights = { EASY: 4, MEDIUM: 4, HARD: 4 };
    if (occupancy < 0.3) weights = { EASY: 3, MEDIUM: 4, HARD: 3 }; 
    else if (occupancy < 0.6) weights = { EASY: 5, MEDIUM: 4, HARD: 2 }; 
    else weights = { EASY: 8, MEDIUM: 2, HARD: 0 }; 

    let newPieces = [], attempts = 0, validSetFound = false;
    while (!validSetFound && attempts < 10) {
        newPieces = [];
        for(let i=0; i<3; i++) newPieces.push(getWeightedRandomShape(weights));
        if (newPieces.some(key => canShapeFitAnywhere(key))) validSetFound = true;
        else attempts++;
    }
    if (!validSetFound) newPieces[0] = 'DOT'; 
    recentShapes = [...newPieces];

    // --- RAMP-UP LOGIC: 1.0% per Move ---
    const currentGemChance = Math.min(1, 0.3 + (moveCount * 0.01));
    
    slots.forEach((slot, index) => {
        slot.innerHTML = ""; 
        const key = newPieces[index];
        const piece = document.createElement("div");
        piece.className = "piece";
        piece.dataset.shape = key;

        const baseData = SHAPES[key].data;
        
        // --- UPDATED GEM SPAWN LOGIC: SMART SPAWN + RAMP ---
        const structure = baseData.map(([x, y]) => {
            let type = 1; 
            
            // 1. Identify which gems are still NEEDED (UPDATED WITH RED)
            let neededGems = [];
            if (levelGoals.gold > 0) neededGems.push(2);
            if (levelGoals.purple > 0) neededGems.push(3);
            if (levelGoals.red > 0) neededGems.push(4); 

            // 2. Only spawn a gem if (a) we need one, and (b) Logic hits our Dynamic Chance
            if (neededGems.length > 0 && Math.random() < currentGemChance) {
                // 3. Pick randomly from ONLY the needed types
                const randomIndex = Math.floor(Math.random() * neededGems.length);
                type = neededGems[randomIndex];
            }
            
            return { x, y, type };
        });
        
        piece.myStructure = structure;
        renderPiece(piece, SHAPES[key].color, structure);
        slot.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
        slot.appendChild(piece);
    });
}

function renderPiece(el, color, structureData) {
    el.style.setProperty('--block-color', color);
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    structureData.forEach(({x, y}) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });

    const trayBlockSize = 26;
    el.style.width = ((maxX - minX + 1) * trayBlockSize) + "px";
    el.style.height = ((maxY - minY + 1) * trayBlockSize) + "px";

    structureData.forEach(({x, y, type}) => {
        const block = document.createElement("div");
        block.className = "block";
        if (type === 2) block.classList.add("gem-gold");
        if (type === 3) block.classList.add("gem-purple");
        if (type === 4) block.classList.add("gem-red"); 

        block.style.left = ((x - minX) * trayBlockSize) + "px";
        block.style.top = ((y - minY) * trayBlockSize) + "px";
        el.appendChild(block);
    });
}

function canPlace(shapeData, row, col) {
    return shapeData.every(([dx, dy]) => {
        const r = row + dy, c = col + dx;
        return r >= 0 && c >= 0 && r < 8 && c < 8 && gridState[r * 8 + c] === 0;
    });
}

// ==========================================
// 6. DRAG & DROP ENGINE
// ==========================================
let activeDrag = null;

document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('touchstart', function(e) { if(e.target.closest('#tray')) e.preventDefault(); }, { passive: false });

window.addEventListener('pointerdown', e => {
    // Game Freeze Check
    if (window.gameEnded || window.inputLocked) return;

    const slot = e.target.closest('.tray-slot');
    if (!slot || activeDrag) return;
    const piece = slot.querySelector('.piece');
    if (!piece) return;
    try { slot.setPointerCapture(e.pointerId); } catch(err){}

    const shapeKey = piece.dataset.shape;
    const structure = piece.myStructure; 
    const scale = window.gameScale || 1;
    
    const clone = piece.cloneNode(true);
    clone.classList.add("dragging");
    clone.style.transform = `scale(${scale})`;
    clone.style.transformOrigin = "center"; 

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    structure.forEach(({x, y}) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });

    const sz = 44, gap = 4;
    const w = (maxX - minX + 1) * sz + (maxX - minX) * gap;
    const h = (maxY - minY + 1) * sz + (maxY - minY) * gap;
    
    clone.style.width = w + "px"; clone.style.height = h + "px";
    clone.innerHTML = ""; 
    
    structure.forEach(({x, y, type}) => {
        const block = document.createElement("div");
        block.className = "block";
        if (type === 2) block.classList.add("gem-gold");
        if (type === 3) block.classList.add("gem-purple");
        if (type === 4) block.classList.add("gem-red"); 
        
        block.style.left = (x - minX) * (sz + gap) + "px";
        block.style.top = (y - minY) * (sz + gap) + "px";
        clone.appendChild(block);
    });
    
    const isTouch = (e.pointerType === 'touch');
    const lift = isTouch ? TOUCH_LIFT_AMOUNT : 0;
    
    // --- AUDIO: GRAB ---
    SoundSystem.play('grab');

    const startLeft = e.clientX - w / 2;
    const startTop = e.clientY - h / 2 - lift;

    clone.style.left = startLeft + "px";
    clone.style.top = startTop + "px";
    document.body.appendChild(clone);
    piece.style.visibility = "hidden";
    
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
        offX: w / 2, 
        offY: h / 2, 
        lift: lift,
        shape: SHAPES[shapeKey], 
        structure: structure, 
        color: SHAPES[shapeKey].color,
        lastRow: null,
        lastCol: null
    };
});

window.addEventListener('pointermove', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;

    const deltaX = e.clientX - activeDrag.startX;
    const deltaY = e.clientY - activeDrag.startY;
    let factorX = 1, factorY = 1;
    if (activeDrag.isTouch) { factorX = 1.2; factorY = (deltaY < 0) ? 1.5 : 1.2; }

    const moveX = deltaX * factorX;
    const moveY = deltaY * factorY;
    const visualLeft = activeDrag.cloneStartX + moveX;
    const visualTop = activeDrag.cloneStartY + moveY;

    activeDrag.clone.style.left = visualLeft + "px";
    activeDrag.clone.style.top = visualTop + "px";
    
    const gRect = grid.getBoundingClientRect();
    const col = Math.round((visualLeft - gRect.left) / (48 * window.gameScale));
    const row = Math.round((visualTop - gRect.top) / (48 * window.gameScale));

    if (activeDrag.lastRow !== row || activeDrag.lastCol !== col) {
        activeDrag.lastRow = row;
        activeDrag.lastCol = col;

        cells.forEach(c => {
            c.classList.remove('ghost', 'ghost-clear');
            if (!c.classList.contains('occupied')) {
                c.style.removeProperty('--block-color');
            }
            c.style.removeProperty('--preview-color'); 
        });

        if (canPlace(activeDrag.shape.data, row, col)) {
            let temp = [...gridState];
            activeDrag.shape.data.forEach(([dx, dy]) => { 
                temp[(row + dy) * 8 + (col + dx)] = 1; 
            });

            let clearingIndices = new Set();
            for (let i = 0; i < 8; i++) {
                if (temp.slice(i * 8, (i + 1) * 8).every(v => v !== 0)) {
                    for(let c=0; c<8; c++) clearingIndices.add(i * 8 + c);
                }
            }
            for (let i = 0; i < 8; i++) {
                let colFull = true;
                for (let r = 0; r < 8; r++) if (temp[r * 8 + i] === 0) colFull = false;
                if (colFull) for(let r=0; r<8; r++) clearingIndices.add(r * 8 + i);
            }

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
    }
});

window.addEventListener('pointerup', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;
    
    cells.forEach(c => {
        c.classList.remove('ghost', 'ghost-clear');
        if (!c.classList.contains('occupied')) {
            c.style.removeProperty('--block-color');
        }
        c.style.removeProperty('--preview-color');
    });
    
    try { activeDrag.slot.releasePointerCapture(e.pointerId); } catch(e){}

    const deltaX = e.clientX - activeDrag.startX;
    const deltaY = e.clientY - activeDrag.startY;
    let factorX = 1, factorY = 1;
    if (activeDrag.isTouch) { factorX = 1.2; factorY = (deltaY < 0) ? 1.5 : 1.2; }

    const visualLeft = activeDrag.cloneStartX + (deltaX * factorX);
    const visualTop = activeDrag.cloneStartY + (deltaY * factorY);
    const gRect = grid.getBoundingClientRect();
    const col = Math.round((visualLeft - gRect.left) / (48 * window.gameScale));
    const row = Math.round((visualTop - gRect.top) / (48 * window.gameScale));
    
    if (canPlace(activeDrag.shape.data, row, col)) {
        
        // --- AUDIO: PLACE ---
        SoundSystem.play('place'); 

        const placedColor = activeDrag.color;
        const placementIndices = [];

        activeDrag.structure.forEach(({x, y, type}) => {
            const idx = (row + y) * 8 + (col + x);
            gridState[idx] = type; 
            placementIndices.push(idx);
        });

        // --- NEW: INCREMENT MOVE COUNT ---
        moveCount++;

        VisualPipe.emit("piece_placed", { indices: placementIndices, color: placedColor });

        activeDrag.source.remove();
        requestAnimationFrame(() => {
            clearLines(row, col, placedColor);
            if (document.querySelectorAll(".tray-slot .piece").length === 0) spawnTrayPieces();
            
            // INTEGRATION: Call No Space Sequence
            if (checkGameOver()) {
                if (window.GlobalRescue) {
                    window.GlobalRescue.tryRescue(runGameOverSequence);
                } else {
                    runGameOverSequence(); // Fallback if global system missing
                }
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
        if (!c.classList.contains('occupied')) {
            c.style.removeProperty('--block-color');
        }
        c.style.removeProperty('--preview-color');
    });
    try { activeDrag.slot.releasePointerCapture(activeDrag.id); } catch (e) { }
    activeDrag = null;
}
window.addEventListener('pointercancel', cancelDrag);
window.addEventListener('blur', cancelDrag);
window.addEventListener('contextmenu', e => { e.preventDefault(); cancelDrag(); });
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

// NO SPACE SEQUENCE
function runGameOverSequence() {
    window.gameEnded = true; 
    
    const gridWrapper = document.getElementById('grid-wrapper');
    const msgEl = document.getElementById("no-space-message");
    const trayEl = document.getElementById("tray");
    
    // 1. DIM THE GRID
    if (gridWrapper) gridWrapper.classList.add('state-dimmed');
    
    // 2. FADE OUT TRAY
    if (trayEl) trayEl.style.opacity = "0"; 
    
    // 3. SHOW MESSAGE
    if (msgEl) msgEl.classList.remove("hidden");
    
    // 4. BRICK UP THE GRID (FILL EMPTY CELLS)
    setTimeout(() => {
        const colorPalette = Object.values(SHAPES).map(s => s.color);
        
        cells.forEach((cell, index) => {
            if (!gridState[index]) { 
                const row = Math.floor(index / 8);
                const invertedRow = 7 - row; // Fill from bottom up visual style
                const delay = invertedRow * 60; 
                
                setTimeout(() => {
                    const randomColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
                    cell.style.setProperty('--block-color', randomColor);
                    cell.classList.add('visual-fill'); 
                }, delay);
            }
        });
    }, 350); 
    
    // --- AUDIO: GAME OVER DELAY ---
    setTimeout(() => {
        SoundSystem.play('game_over'); 
    }, 550);

    // 5. TIMELINE: PAUSE -> OVERLAY TRIGGER
    setTimeout(() => {
        const overlay = document.getElementById("game-over-overlay");
        const buttons = document.getElementById("go-buttons"); 
        
        if (overlay) {
            overlay.classList.remove("hidden");
            void overlay.offsetWidth; 
            overlay.classList.add("overlay-active");

            const wLevel = document.querySelector(".word-level");
            const wFailed = document.querySelector(".word-failed");
            if (wLevel) {
                wLevel.classList.remove("active");
                void wLevel.offsetWidth;
                wLevel.classList.add("active");
            }
            if (wFailed) {
                wFailed.classList.remove("active");
                void wFailed.offsetWidth;
                wFailed.classList.add("active");
            }

            if (buttons) {
                buttons.classList.remove("active");
                void buttons.offsetWidth;
                buttons.classList.add("active");
            }
        }
    }, 1270);
}

function fullReset() { 
    combo = 0; 
    window.gameEnded = false; // Reset lock
    
    SoundSystem.stopHeartbeat(); // --- AUDIO RESET ---

    // Reset all UI elements
    const overlay = document.getElementById("game-over-overlay");
    if(overlay) {
        overlay.classList.add("hidden");
        overlay.classList.remove("overlay-active");
    }

    const vicLayer = document.getElementById("victory-ui-layer");
    const dim = document.getElementById("victory-dim");
    const fireworks = document.getElementById("victory-fireworks");
    if (vicLayer) vicLayer.classList.add("hidden");
    if (dim) { dim.classList.remove("active"); dim.classList.add("hidden"); }
    if (fireworks) fireworks.innerHTML = "";

    // Reset Stamp Classes
    document.querySelectorAll(".word-level, .word-failed, .word-level-vic, .word-cleared-vic, .victory-message, .game-over-buttons").forEach(el => {
        el.classList.remove("active", "fading");
    });
    
    // Reset No Space Sequence Elements
    const msg = document.getElementById("no-space-message");
    if (msg) msg.classList.add("hidden");
    const trayEl = document.getElementById("tray");
    if (trayEl) trayEl.style.opacity = "1";
    const gridWrap = document.getElementById('grid-wrapper');
    if (gridWrap) gridWrap.classList.remove('state-dimmed');

    init(); 
}

// 7. LISTENERS
const retryBtn = document.getElementById("btn-retry");
if (retryBtn) retryBtn.onclick = fullReset;

const nextBtn = document.getElementById("vic-btn-next");
if (nextBtn) {
    nextBtn.onclick = () => window.location.href = "../index.html";
}

// 1. Piece Placement Visuals
VisualPipe.on("piece_placed", ({ indices, color }) => {
    Boss.run({ priority: "high", duration: 600 }, () => {
        indices.forEach(idx => {
            const cell = cells[idx];
            const type = gridState[idx];
            
            cell.style.setProperty('--block-color', color);
            cell.classList.add('occupied', 'placed-impact');
            
            if (type === 2) cell.classList.add('embedded-gold');
            if (type === 3) cell.classList.add('embedded-purple');
            if (type === 4) cell.classList.add('embedded-red'); 

            setTimeout(() => { cell.classList.remove('placed-impact'); }, 200);
        });
    });
});

// 2. Clear Feedback
VisualPipe.on("clear_feedback", ({ combo }) => {
    let hapticDuration = 50;
    if (combo >= 5) hapticDuration = 80;
    triggerEternalHaptic(hapticDuration);

    const gridWrapper = document.getElementById('grid-wrapper');
    let shakeClass = 'shake-1';
    if (combo >= 5) shakeClass = 'shake-2';
    if (combo >= 10) shakeClass = 'shake-3';

    gridWrapper.classList.remove('shake-1', 'shake-2', 'shake-3');
    void gridWrapper.offsetWidth; 
    gridWrapper.classList.add(shakeClass);
    setTimeout(() => gridWrapper.classList.remove(shakeClass), 200);

    const dataMap = {
        2:  { text: "NICE!", color: "#00d2d3" },
        5:  { text: "SWEET!", color: "#ff9ff3" },
        8:  { text: "GREAT!", color: "#54a0ff" },
        10: { text: "AMAZING!", color: "#feca57" },
        13: { text: "UNREAL!", color: "#5f27cd" },
        15: { text: "INSANE!", color: "#ff6b6b" },
        18: { text: "LEGENDARY!", color: "#f1c40f" },
        20: { text: "GODLIKE!", color: "#00ffcc" }
    };

    let activeData = null;
    if (combo >= 2) {
        if (combo <= 20) {
            if (dataMap[combo]) activeData = dataMap[combo];
            else {
                let lower = 2;
                [2,5,8,10,13,15,18,20].forEach(t => { if(combo >= t) lower = t; });
                activeData = { text: null, color: dataMap[lower].color }; 
            }
        } else {
            const loopTiers = [15, 18, 20];
            const loopIndex = (combo - 21) % loopTiers.length;
            activeData = dataMap[loopTiers[loopIndex]];
        }
    }
    const displayColor = activeData ? activeData.color : "#ffffff";

    const comboContainer = document.createElement('div');
    comboContainer.className = 'combo-popup';
    comboContainer.style.setProperty('--combo-color', displayColor);
    
    const label = document.createElement('div');
    label.className = 'combo-label';
    label.textContent = "COMBO";
    
    const value = document.createElement('div');
    value.className = 'combo-value';
    value.textContent = "x" + combo;

    comboContainer.appendChild(label);
    comboContainer.appendChild(value);
    gridWrapper.appendChild(comboContainer);
    setTimeout(() => comboContainer.remove(), 980);

    if (activeData && activeData.text) {
        setTimeout(() => {
            const banner = document.createElement('div');
            banner.className = 'reinforcement-banner';
            banner.style.setProperty('--combo-color', activeData.color);
            const bText = document.createElement('div');
            bText.className = 'banner-text';
            bText.textContent = activeData.text;
            banner.appendChild(bText);
            gridWrapper.appendChild(banner);
            setTimeout(() => banner.remove(), 850); 
        }, 700);
    }
});

// 3. Reset Cells
VisualPipe.on("reset_cells", ({ indices }) => {
    indices.forEach(idx => {
        const cell = cells[idx];
        cell.className = "cell"; 
        cell.style.removeProperty('--block-color');
        cell.style.removeProperty('--preview-color');
    });
});

// Wait for DOM
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        init();
    }, 10);
});