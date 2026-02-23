//
const gridSize = 8;
const grid = document.getElementById("grid");
const tray = document.getElementById("tray");
const overlay = document.getElementById("game-over-overlay");

// --- UI REFERENCES ---
const scoreValEl = document.getElementById("score-val");
const targetValEl = document.getElementById("target-val");
const progressTraceEl = document.getElementById("progress-trace");
const progressTravelerEl = document.getElementById("progress-traveler");

const TARGET_SCORE = 2000; 

// ======================================================
// NEW: JUNK / LEVEL CONFIGURATION
// ======================================================
const JUNK_COLOR = '#FF4444'; // RED

// LEVEL 3: "Diamond & Corners" (Slightly Complicated)
// 0 = Empty, 1 = Junk Block
const START_LEVEL_MAP = [
    1, 1, 0, 0, 0, 0, 1, 1,
    0, 0, 0, 0, 0, 0, 0, 0,
    0, 1, 1, 0, 0, 1, 1, 0,
    1, 0, 0, 1, 1, 0, 0, 1,
    1, 0, 0, 1, 1, 0, 0, 1,
    0, 1, 1, 0, 0, 1, 1, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0, 0, 1, 1
];

let cells = [], gridState = Array(64).fill(0);

// NEW: Track last ghost state to prevent re-rendering same ghost
let lastGhostFingerprint = null; 

// ============================================
// AUDIO SYSTEM (OPTIMIZED & FIXED)
// ============================================
const SoundSystem = {
    ctx: null, buffers: {}, isMuted: false, heartbeatTimer: null, bgmNode: null, bgmGain: null,
    
    // 1. Prepare: Runs immediately to fetch files
    prepare() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.loadSounds();
        }
    },

    // 2. Unlock: Runs on user interaction to start the engine
    unlock() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
                // Ensure BGM is playing if it wasn't
                if (!this.bgmNode) this.playMusic('bgm');
            });
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
        for (const [name, url] of Object.entries(fileNames)) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                this.buffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
            } catch (error) { console.error(`❌ FAILED loading ${url}`); }
        }
        // Queue music immediately (it will start when unlocked)
        if (this.ctx) this.playMusic('bgm');
    },
    play(name, pitch = 1.0, volume = 1.0) {
        if (this.isMuted || !this.ctx || !this.buffers[name]) return;
        
        // CHECK SETTINGS FOR SFX
        const sfxEnabled = localStorage.getItem('blox_sfx_enabled') !== 'false';
        if (!sfxEnabled) return;

        const s = this.ctx.createBufferSource(); s.buffer = this.buffers[name];
        if (pitch !== 1.0) s.playbackRate.value = pitch;
        const g = this.ctx.createGain(); g.gain.value = volume;
        s.connect(g); g.connect(this.ctx.destination); s.start(0);
    },
    playMusic(name) {
        if (this.bgmNode || this.isMuted || !this.ctx || !this.buffers[name]) return;
        
        // --- CRITICAL FIX START ---
        // 1. Check settings explicitly BEFORE starting
        const bgmEnabled = localStorage.getItem('blox_bgm_enabled') !== 'false';
        const startVolume = bgmEnabled ? 0.18 : 0;

        const s = this.ctx.createBufferSource(); 
        s.buffer = this.buffers[name]; 
        s.loop = true;
        
        const g = this.ctx.createGain(); 
        g.gain.value = startVolume; // Apply calculated volume
        
        s.connect(g); 
        g.connect(this.ctx.destination); 
        s.start(0);
        
        this.bgmNode = s;
        this.bgmGain = g; // 2. EXPOSE THE GAIN NODE SO SETTINGS CAN CONTROL IT LATER
        // --- CRITICAL FIX END ---
    },
    startHeartbeat() {
        if (this.heartbeatTimer) return;
        if (this.buffers['heartbeat']) this.play('heartbeat', 0.9, 0.8);
        this.heartbeatTimer = setTimeout(() => { this.heartbeatTimer = null; this.startHeartbeat(); }, 1500);
    },
    stopHeartbeat() {
        if (this.heartbeatTimer) { clearTimeout(this.heartbeatTimer); this.heartbeatTimer = null; }
    }
};
window.SoundSystem = SoundSystem;

// Initialize Audio Context Immediately (Pre-load)
SoundSystem.prepare();

// Unlock Audio on First Interaction
window.addEventListener('pointerdown', () => SoundSystem.unlock(), { once: true });

// Handle Visibility Change (Pause/Resume Audio)
document.addEventListener('visibilitychange', () => {
    if (!SoundSystem.ctx) return;
    
    if (document.hidden) {
        // Stop audio processing when tab is hidden
        SoundSystem.ctx.suspend();
    } else {
        // Resume immediately when tab is visible
        SoundSystem.ctx.resume();
    }
});


// ======================================================
// COMPLETE SCORING SYSTEM (CLEANED)
// ======================================================

// === PIPELINE VARIABLES ===
let confirmedScore = 0;      // Authoritative score
let displayedScore = 0;      // Visual score
let placementScore = 0;      // +5 per placement
let pendingClearScore = 0;   // Clear/Combo points
let levelCompleted = false;  // Global Level State Flag

// Animation Handle
let uiAnimFrame = null;

// Game State
let combo = 0;            
let nonClearCount = 0;    

// --------------------
// CONSTANTS
// --------------------
const PLACEMENT_POINTS = 5;
const COMBO_GRACE_LIMIT = 3;

// --------------------
// STEP F: COMBO INTENSITY SCALING
// --------------------
function updateComboVisualState() {
    if (!progressTravelerEl) return;
    
    // 1. Base Activation (Combo >= 2)
    if (combo >= 2) {
        progressTravelerEl.classList.add('combo-tier-2');
        
        // 2. Remove old tier modifiers to prevent conflict
        progressTravelerEl.classList.remove('tier-2', 'tier-3');
        
        // 3. Apply Scaling Tiers
        if (combo >= 6 && combo < 10) {
            progressTravelerEl.classList.add('tier-2');
        } else if (combo >= 10) {
            progressTravelerEl.classList.add('tier-3');
        }
        
    } else {
        // Deactivate Everything
        progressTravelerEl.classList.remove('combo-tier-2', 'tier-2', 'tier-3');
    }
}

// --------------------
// UI UPDATE FUNCTION (VISUAL COUNT-UP ENGINE)
// --------------------
function updateScoreUI(withImpact = false) {
    if (uiAnimFrame) cancelAnimationFrame(uiAnimFrame);

    // ----------------------------------------------------
    // PRIORITY CHECK: INSTANT WIN (Zero Latency)
    // ----------------------------------------------------
    if (!levelCompleted && confirmedScore >= TARGET_SCORE) {
        // 1. Clamp Logic
        confirmedScore = TARGET_SCORE;
        displayedScore = TARGET_SCORE;
        
        // 2. Force Visuals Immediately (No Animation Loop)
        drawUI(TARGET_SCORE);

        // 3. Trigger State Changes Instantly
        levelCompleted = true;
        const system = document.getElementById('progress-system');
        if (system) system.classList.add('target-reached');

        endLevel(); 
        return; // STOP. Do not animate count-up.
    }

    // ----------------------------------------------------
    // NORMAL BEHAVIOR: ANIMATE SCORE
    // ----------------------------------------------------
    function renderFrame() {
        const diff = confirmedScore - displayedScore;

        if (diff > 0) {
            const step = Math.ceil(diff / 5);
            displayedScore += step;
            
            if (displayedScore > confirmedScore) displayedScore = confirmedScore;

            drawUI(displayedScore);
            uiAnimFrame = requestAnimationFrame(renderFrame);
        } else {
            displayedScore = confirmedScore;
            drawUI(displayedScore);
            uiAnimFrame = null;

            if (withImpact) {
                const el = document.getElementById("progress-traveler");
                if (el) {
                    el.classList.remove("capsule-impact");
                    void el.offsetWidth; 
                    el.classList.add("capsule-impact");

                    setTimeout(() => {
                        el.classList.remove("capsule-impact");
                    }, 440);
                }
            }
        }
    }
    renderFrame();
}

// Helper to draw the actual DOM elements based on a value
function drawUI(val) {
    if (scoreValEl) {
        scoreValEl.innerText = val;
        // STEP H: Adaptive Text Scaling (Traveler)
        scoreValEl.setAttribute('data-len', val.toString().length);
    }

    let pct = (val / TARGET_SCORE) * 100;
    if (pct > 100) pct = 100; 
    if (pct < 0) pct = 0;

    // Visual Updates
    if (progressTraceEl) progressTraceEl.style.width = `${pct}%`;
    if (progressTravelerEl) progressTravelerEl.style.left = `${pct}%`;

    // STEP F: TUNNEL COLOR ZONES
    const tunnel = document.getElementById('progress-tunnel');
    if (tunnel) {
        tunnel.classList.remove('zone-a', 'zone-b', 'zone-c');
        
        // Zone A: 0% - 33.3%
        if (pct < 33.3) {
            tunnel.classList.add('zone-a');
        } 
        // Zone B: 33.3% - 66.6%
        else if (pct < 66.6) {
            tunnel.classList.add('zone-b');
        } 
        // Zone C: 66.6% - 100%
        else {
            tunnel.classList.add('zone-c');
        }
    }
}

// --------------------
// BASE PAYOUT LOOKUP
// --------------------
function getBasePayout(totalLinesCleared) {
    if (totalLinesCleared === 1) return 50;
    if (totalLinesCleared === 2) return 150;
    if (totalLinesCleared === 3) return 350;
    if (totalLinesCleared === 4) return 750;
    if (totalLinesCleared >= 5) return 1200;
    return 0;
}

// --------------------
// PLACEMENT SCORING
// --------------------
function applyPlacementScore() {
    if (levelCompleted) return; // Guard: No scoring after completion

    placementScore += PLACEMENT_POINTS;
    confirmedScore += PLACEMENT_POINTS;
    updateScoreUI(false); 
}

// --------------------
// LINE CLEAR & COMBO SCORING
// --------------------
function applyLineClearScore(totalLinesCleared) {
    if (levelCompleted) return; // Guard: No scoring after completion

    if (totalLinesCleared === 0) {
        nonClearCount++;
        
        // AUDIO: Stop Heartbeat if lost combo
        if (nonClearCount >= COMBO_GRACE_LIMIT) {
            combo = 0;
            nonClearCount = 0;
            updateComboVisualState();
            SoundSystem.stopHeartbeat();
        }
        return;
    }

    combo++;
    nonClearCount = 0;
    
    // AUDIO: Start Heartbeat
    if (combo >= 2) {
        SoundSystem.startHeartbeat();
    }
    
    updateComboVisualState();

    const basePayout = getBasePayout(totalLinesCleared);
    const lineClearScore = basePayout * combo;

    pendingClearScore += lineClearScore;
}

// --------------------
// RESET FUNCTION
// --------------------
function resetScoringSystem() {
    confirmedScore = 0;
    displayedScore = 0; 
    placementScore = 0;
    pendingClearScore = 0;
    combo = 0;
    nonClearCount = 0;
    
    levelCompleted = false; // Reset level state
    window.gameEnded = false; // Reset game lock
    window.endgameActive = false; // <--- NEW: Reset endgame state
    
    // AUDIO: Stop Heartbeat
    SoundSystem.stopHeartbeat();
    
    // RESET VISUAL STATE FOR STEP I
    const system = document.getElementById('progress-system');
    if (system) system.classList.remove('target-reached');

    // --- RESET VICTORY DIM & LAYER ---
    const dim = document.getElementById("victory-dim");
    if (dim) {
        dim.classList.remove("active");
        dim.classList.add("hidden");
    }
    
    // NEW: Reset Victory UI Layer
    const vicLayer = document.getElementById("victory-ui-layer");
    const vicMsg = document.querySelector(".victory-message");
    const vButtons = document.getElementById("victory-buttons");
    
    if (vicLayer) vicLayer.classList.add("hidden");
    if (vicMsg) vicMsg.classList.remove("fading"); // Reset fade
    if (vButtons) vButtons.classList.remove("active");

    // Reset Stamp Words
    const wL = document.querySelector(".word-level-vic");
    const wC = document.querySelector(".word-cleared-vic");
    if(wL) wL.classList.remove("active");
    if(wC) wC.classList.remove("active");

    // --- STEP 3: RESET FIREWORKS ---
    const fireworks = document.getElementById("victory-fireworks");
    if (fireworks) fireworks.innerHTML = "";
    
    // --- RESET NO SPACE MESSAGE & GRID ---
    const msg = document.getElementById("no-space-message");
    if (msg) msg.classList.add("hidden");
    const trayEl = document.getElementById("tray");
    if (trayEl) trayEl.style.opacity = "1";
    const gridWrap = document.getElementById('grid-wrapper');
    if (gridWrap) gridWrap.classList.remove('state-dimmed');

    // --- RESET GAME OVER STAMP ANIMATION ---
    const wLevel = document.querySelector(".word-level");
    const wFailed = document.querySelector(".word-failed");
    if(wLevel) wLevel.classList.remove("active");
    if(wFailed) wFailed.classList.remove("active");

    updateComboVisualState();
    
    if (uiAnimFrame) cancelAnimationFrame(uiAnimFrame);
    
    drawUI(0);
}

// --------------------
// DEBUG HELPER
// --------------------
function getScoreState() {
    return { 
        confirmedScore, 
        displayedScore,
        placementScore, 
        pendingClearScore,
        levelCompleted
    };
}

// --------------------
// LEVEL END HANDLER (Architecture Refactor)
// --------------------
function endLevel() {
    // 1. Idempotency Check: Prevent running this logic more than once
    if (window.endgameActive) return;

    // 2. Stop Score Counting UI
    if (uiAnimFrame) {
        cancelAnimationFrame(uiAnimFrame);
        uiAnimFrame = null;
    }

    // 3. Set State Flags
    window.gameEnded = true;        // Locks board input (Drag & Drop)
    window.endgameActive = true;    // Locks application state (prevents re-triggers)

    // 4. Emit the Cinematic Event
    // Future celebration visuals will listen strictly to this event
    VisualPipe.emit("level_complete");

    console.log("LEVEL COMPLETE: State Locked. Event Emitted.");
}

// --- CONFIGURATION ---
const TOUCH_LIFT_AMOUNT = 100;
window.gameMode = "expanded"; 

const SHAPES = {
    DOT:    { data: [[0,0]],                            color: '#FF4444' }, // RED
    I2:     { data: [[0,0],[1,0]],                      color: '#FF4444' }, // RED
    I3:     { data: [[0,0],[1,0],[2,0]],                color: '#FF4444' }, // RED
    I4:     { data: [[0,0],[1,0],[2,0],[3,0]],          color: '#FF4444' }, // RED
    O2:     { data: [[0,0],[1,0],[0,1],[1,1]],          color: '#FF4444' }, // RED
    T:      { data: [[0,1],[1,0],[1,1],[2,1]],          color: '#FF4444' }, // RED
    PLUS:   { data: [[1,0],[0,1],[1,1],[2,1],[1,2]],    color: '#FF4444' }, // RED
    I2_V:   { data: [[0,0],[0,1]],                      color: '#FF4444' }, // RED
    I3_V:   { data: [[0,0],[0,1],[0,2]],                color: '#FF4444' }, // RED
    CORNER: { data: [[0,0],[1,0],[0,1]],                color: '#FF4444' }, // RED
    L_LEFT: { data: [[0,0],[0,1],[0,2],[1,2]],          color: '#FF4444' }, // RED
    SKEW:   { data: [[1,0],[2,0],[0,1],[1,1]],          color: '#FF4444' }  // RED
};

const SHAPE_TIERS = {
    EASY: ['DOT', 'I2', 'O2'],        
    MEDIUM: ['I3', 'T'],              
    HARD: ['I4', 'PLUS']              
};

const SHAPE_TIERS_EXPANDED = {
    EASY: ['DOT', 'I2', 'O2', 'I2_V', 'CORNER'],        
    MEDIUM: ['I3', 'T', 'I3_V'],              
    HARD: ['I4', 'PLUS', 'L_LEFT', 'SKEW']              
};

// ============================================
// VISUAL INFRASTRUCTURE
// ============================================
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
// MAIN ENGINE
// ============================================
let recentShapes = []; 
window.gameScale = 1;

function resizeGame() {
    // 🛑 HANDLED GLOBALLY NOW
    // We leave this empty so the code doesn't crash, 
    // but we let global-settings.js handle the actual sizing.
    if (!window.gameScale) window.gameScale = 1;
}

// ============================================
// NEW: LOAD JUNK MAP
// ============================================
function loadJunkMap() {
    if (!START_LEVEL_MAP || START_LEVEL_MAP.length !== 64) return;
    
    START_LEVEL_MAP.forEach((state, index) => {
        if (state === 1) {
            // Update Logic
            gridState[index] = 1;
            
            // Update Visuals
            const cell = cells[index];
            if (cell) {
                cell.classList.add('occupied');
                cell.style.setProperty('--block-color', JUNK_COLOR);
            }
        }
    });
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
    
    loadJunkMap();
    
    recentShapes = [];
    spawnTrayPieces();
    
    resetScoringSystem();

    if (targetValEl) {
        targetValEl.setAttribute('data-len', targetValEl.innerText.length);
    }

    // --- UPDATED LEVEL START ANIMATION LOGIC ---
    
    // 1. Set text on the banner
    const startTargetText = document.getElementById("start-target-text");
    if (startTargetText) {
        startTargetText.innerText = TARGET_SCORE; 
    }
    
    // 2. NEW: HIDE the destination text initially (Step 1: Empty Socket Illusion)
    if (targetValEl) {
        targetValEl.style.opacity = '0'; 
    }
    
    // 3. Trigger the Sequence Logic
    // UPDATED TIMING: 1200ms (Option 1.5 - Optimized Hold)
    setTimeout(() => {
        // Emit event to VisualPipe (Separation of Visuals)
        VisualPipe.emit("level_start_anim");
    }, 1200); 

    // -----------------------------------
    
    const slots = document.querySelectorAll('.tray-slot');
    slots.forEach(slot => {
        slot.addEventListener('touchstart', (e) => {
             e.preventDefault(); 
        }, { passive: false });
    });
}

// ============================================
// GAME LOGIC (INSTANT CLEAR)
// ============================================
function clearLines(lastRow, lastCol, placedColor) {
    let rToClear = [], cToClear = [];
    
    // 1. Detect Full Rows
    for (let i = 0; i < 8; i++) {
        if (gridState.slice(i * 8, (i + 1) * 8).every(v => v)) rToClear.push(i);
    }
    // 2. Detect Full Cols
    for (let i = 0; i < 8; i++) {
        let colFull = true;
        for (let r = 0; r < 8; r++) if (!gridState[r * 8 + i]) colFull = false;
        if (colFull) cToClear.push(i);
    }
    
    const totalLines = rToClear.length + cToClear.length;
    
    // Calculates pendingClearScore (Logic Only) & Handles Heartbeat Audio
    applyLineClearScore(totalLines);
    
    if (totalLines > 0) {
        // --- GPU FLASH TRIGGER (TRANSPLANTED 1:1) ---
        if (combo >= 2) triggerStageLights(combo);

        // Calculate point value for VISUALS only
        let basePayout = 0;
        if (totalLines === 1) basePayout = 50;
        else if (totalLines === 2) basePayout = 150;
        else if (totalLines === 3) basePayout = 350;
        else if (totalLines === 4) basePayout = 750;
        else if (totalLines >= 5) basePayout = 1200;
        
        const pointValue = basePayout * combo;

        VisualPipe.emit("clear_feedback", { combo });
        
        // Trigger Floating Score
        const targetIdx = lastRow * 8 + lastCol;
        VisualPipe.emit("score_float", { points: pointValue, targetIndex: targetIdx });
        
        // ---------------------------------------------------------
        // [CRITICAL FIX] EMIT THE ANIMATION EVENT HERE
        // ---------------------------------------------------------
        VisualPipe.emit("clear_anim", { 
            rToClear: rToClear, 
            cToClear: cToClear, 
            combo: combo 
        });
        // ---------------------------------------------------------

        const clearedIndices = [];
        rToClear.forEach(r => { 
            for (let c = 0; c < 8; c++) {
                const idx = r * 8 + c;
                gridState[idx] = 0;
                clearedIndices.push(idx);
            }
        });
        cToClear.forEach(c => { 
            for (let r = 0; r < 8; r++) {
                const idx = r * 8 + c;
                gridState[idx] = 0;
                clearedIndices.push(idx);
            }
        });
        
        VisualPipe.emit("reset_cells", { indices: clearedIndices });
    }
}

// ----------------------------------------------------
// SPAWN & DRAG
// ----------------------------------------------------
function getBoardOccupancy() {
    const filled = gridState.filter(v => v === 1).length;
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
    const currentTiers = (window.gameMode === "expanded") ? SHAPE_TIERS_EXPANDED : SHAPE_TIERS;

    currentTiers.EASY.forEach(key => {
        const repeatPenalty = recentShapes.includes(key) ? 0.5 : 1; 
        const count = Math.floor(weights.EASY * 10 * repeatPenalty);
        for(let i=0; i<count; i++) pool.push(key);
    });
    currentTiers.MEDIUM.forEach(key => {
        const repeatPenalty = recentShapes.includes(key) ? 0.5 : 1;
        const count = Math.floor(weights.MEDIUM * 10 * repeatPenalty);
        for(let i=0; i<count; i++) pool.push(key);
    });
    currentTiers.HARD.forEach(key => {
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
    slots.forEach((slot, index) => {
        slot.innerHTML = ""; 
        const key = newPieces[index];
        const piece = document.createElement("div");
        piece.className = "piece";
        piece.dataset.shape = key;
        renderPiece(piece, SHAPES[key]);
        
        slot.addEventListener('touchstart', (e) => {
             e.preventDefault();
        }, { passive: false });

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

// ----------------------------------------------------
// DRAG & DROP ENGINE
// ----------------------------------------------------
let activeDrag = null;

document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
document.addEventListener('touchstart', function(e) { if(e.target.closest('#tray')) e.preventDefault(); }, { passive: false });

window.addEventListener('pointerdown', e => {
    // =========================================================
    // BUG FIX: FREEZE INPUT ON LEVEL COMPLETE
    // =========================================================
    if (window.gameEnded) return;

    const slot = e.target.closest('.tray-slot');
    if (!slot || activeDrag) return;
    const piece = slot.querySelector('.piece');
    if (!piece) return;
    
    try { slot.setPointerCapture(e.pointerId); } catch(err){}
    
    // AUDIO: Grab
    SoundSystem.play('grab');

    const shapeKey = piece.dataset.shape;
    const shapeData = SHAPES[shapeKey].data;
    const scale = window.gameScale || 1;
    
    const clone = piece.cloneNode(true);
    clone.classList.add("dragging");
    clone.style.transform = `scale(${scale})`;
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
        color: SHAPES[shapeKey].color 
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
    
    // ----------------------------------------------------
    // GHOST SYSTEM - FINGERPRINT CHECK (PREVENT RE-RENDER)
    // ----------------------------------------------------
    const gRect = grid.getBoundingClientRect();
    const col = Math.round((visualLeft - gRect.left) / (48 * window.gameScale));
    const row = Math.round((visualTop - gRect.top) / (48 * window.gameScale));

    let newFingerprint = null;
    let clearingIndices = new Set();
    let shapeIndices = [];
    let isClear = false;

    // 1. Calculate Potential State
    if (canPlace(activeDrag.shape.data, row, col)) {
        // A) SIMULATE PLACEMENT
        let tempState = [...gridState];
        activeDrag.shape.data.forEach(([dx, dy]) => { 
            const idx = (row + dy) * 8 + (col + dx);
            tempState[idx] = 1; 
            shapeIndices.push(idx);
        });

        // B) DETECT CLEARS
        // Check Rows
        for (let r = 0; r < 8; r++) {
            let isRowFull = true;
            for (let c = 0; c < 8; c++) {
                if (tempState[r * 8 + c] === 0) { isRowFull = false; break; }
            }
            if (isRowFull) {
                isClear = true;
                for (let c = 0; c < 8; c++) clearingIndices.add(r * 8 + c);
            }
        }
        // Check Cols
        for (let c = 0; c < 8; c++) {
            let isColFull = true;
            for (let r = 0; r < 8; r++) {
                if (tempState[r * 8 + c] === 0) { isColFull = false; break; }
            }
            if (isColFull) {
                isClear = true;
                for (let r = 0; r < 8; r++) clearingIndices.add(r * 8 + c);
            }
        }

        // C) GENERATE FINGERPRINT
        // Key: "TYPE:INDEX_LIST" e.g., "clear:8,9,10..." or "ghost:5,14,23"
        const typeStr = isClear ? 'clear' : 'ghost';
        const indicesArr = isClear ? Array.from(clearingIndices).sort((a,b)=>a-b) : shapeIndices.sort((a,b)=>a-b);
        newFingerprint = `${typeStr}:${indicesArr.join(',')}`;
    }

    // 2. CHECK AGAINST LAST STATE
    if (newFingerprint === lastGhostFingerprint) {
        return; // STOP! No changes needed. Preserves animations.
    }

    // 3. IF DIFFERENT -> UPDATE DOM
    // Clear old ghosts
    cells.forEach(c => {
        c.classList.remove('ghost', 'ghost-clear');
        if (!c.classList.contains('occupied')) {
            c.style.removeProperty('--block-color');
        }
        c.style.removeProperty('--preview-color'); 
    });

    // Apply new ghosts (if valid)
    if (newFingerprint) {
        if (isClear) {
            clearingIndices.forEach(idx => {
                const targetCell = cells[idx];
                targetCell.classList.add('ghost-clear');
                targetCell.style.setProperty('--preview-color', activeDrag.color);
            });
        } else {
            shapeIndices.forEach(idx => {
                const targetCell = cells[idx];
                targetCell.classList.add('ghost');
                targetCell.style.setProperty('--block-color', activeDrag.color);
            });
        }
    }

    // 4. UPDATE TRACKER
    lastGhostFingerprint = newFingerprint;
});

window.addEventListener('pointerup', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;
    
    // RESET FINGERPRINT
    lastGhostFingerprint = null;

    // CLEANUP GHOSTS
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
        // AUDIO: Place
        SoundSystem.play('place');

        const placedColor = activeDrag.color;
        const placementIndices = [];

        activeDrag.shape.data.forEach(([dx, dy]) => {
            const idx = (row + dy) * 8 + (col + dx);
            gridState[idx] = 1;
            placementIndices.push(idx);
        });

        VisualPipe.emit("piece_placed", { indices: placementIndices, color: placedColor });

        applyPlacementScore();

        activeDrag.source.remove();
        requestAnimationFrame(() => {
            clearLines(row, col, placedColor);
            if (document.querySelectorAll(".tray-slot .piece").length === 0) spawnTrayPieces();
            
            // =========================================================
            // INTEGRATION: CALL NEW GAME OVER SEQUENCE INSTEAD OF OVERLAY
            // =========================================================
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
    
    // RESET FINGERPRINT
    lastGhostFingerprint = null;

    // CLEANUP GHOSTS
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
function fullReset() { 
    resetScoringSystem(); 
    
    // Hide overlay and reset internal animation states
    overlay.classList.add("hidden");
    overlay.classList.remove("overlay-active");
    
    // Remove active classes so they can replay next time
    const wLevel = document.querySelector(".word-level");
    const wFailed = document.querySelector(".word-failed");
    const buttons = document.getElementById("go-buttons");
    
    if(wLevel) wLevel.classList.remove("active");
    if(wFailed) wFailed.classList.remove("active");
    if(buttons) buttons.classList.remove("active");
    
    init(); 
}

// UPDATED RESTART LISTENER
// We bind the click to the new circular retry button
const retryBtn = document.getElementById("btn-retry");
if (retryBtn) {
    retryBtn.onclick = fullReset;
}

// NEW: Next Button Listener
const nextBtn = document.getElementById("vic-btn-next");
if (nextBtn) {
    // WINNER: Go to Level 10
   nextBtn.onclick = () => window.location.href = "../bloxplode%20adventure%20level%2010/index.html";
}

init();

// STEP 2: VICTORY DIM LISTENER
VisualPipe.on("level_complete", () => {
    const dim = document.getElementById("victory-dim");
    if (!dim) return;
    
    dim.classList.remove("hidden");
    // Force reflow to ensure animation triggers fresh
    void dim.offsetWidth; 
    dim.classList.add("active");
});

// ============================================
// GPU FLASH / STAGE LIGHTING SYSTEM (TRANSPLANT)
// ============================================
function triggerStageLights(combo) {
    const gridWrapper = document.getElementById('grid-wrapper');
    if (!gridWrapper) return;

    // 1. Precise Color Map (1:1 from Source File)
    const colorMap = {
        2:  "#00d2d3", // Cyan
        5:  "#ff9ff3", // Pink
        8:  "#54a0ff", // Blue
        10: "#feca57", // Gold
        13: "#5f27cd", // Purple
        15: "#ff6b6b", // Red
        18: "#f1c40f", // Yellow
        20: "#00ffcc"  // Mint
    };

    // 2. Resolve Active Color
    let activeColor = null;
    if (combo >= 2) {
        if (combo <= 20) {
            // Direct match or fallback to lower tier
            if (colorMap[combo]) activeColor = colorMap[combo];
            else {
                let lower = 2;
                [2,5,8,10,13,15,18,20].forEach(t => { if(combo >= t) lower = t; });
                activeColor = colorMap[lower];
            }
        } else {
            // Godlike Loop (>20)
            const loopTiers = [15, 18, 20];
            const loopIndex = (combo - 21) % loopTiers.length;
            activeColor = colorMap[loopTiers[loopIndex]];
        }
    }

    if (!activeColor) return; 

    // 3. Inject Invisible Trigger (The CSS :has() selector watches this)
    const trigger = document.createElement('div');
    trigger.className = 'flash-trigger';
    // We embed the color in the style attribute so CSS can read it
    trigger.setAttribute('style', `display:none; color: ${activeColor};`);
    
    gridWrapper.appendChild(trigger);

    // 4. Auto-Remove after animation (0.6s)
    setTimeout(() => { trigger.remove(); }, 600);
}

// ======================================================
// NEW FUNCTION: NO SPACE SEQUENCE (BRICKING UP)
// ======================================================
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
    // Delay slightly to let the message pop first
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

    // AUDIO: Play Game Over sound
    setTimeout(() => {
        SoundSystem.play('game_over'); 
    }, 550);
    
    // 5. TIMELINE: PAUSE -> OVERLAY TRIGGER
    // Calculation:
    // Start (350ms) + Max Row Delay (420ms) + Anim Duration (150ms) = 920ms (Bricking Done)
    // 920ms + 350ms (Your Requested Pause) = 1270ms
    
    setTimeout(() => {
        const overlay = document.getElementById("game-over-overlay");
        const buttons = document.getElementById("go-buttons"); // REF TO BUTTONS
        
        if (overlay) {
            overlay.classList.remove("hidden");
            // Force Reflow for animation
            void overlay.offsetWidth; 
            overlay.classList.add("overlay-active");

            // OPTION 1: TRIGGER STAMP
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

            // TRIGGER BUTTONS (Animation Delay is handled in CSS: 1.0s)
            if (buttons) {
                buttons.classList.remove("active");
                void buttons.offsetWidth;
                buttons.classList.add("active");
            }
        }
    }, 1270);
}

// ==========================================
// FORCE REDIRECT TO ADVENTURE MAP
// ==========================================

// 1. Select the "Home" buttons from Game Over & Victory screens
const failHomeBtn = document.getElementById("btn-home");
const vicHomeBtn = document.getElementById("vic-btn-home");

// 2. Define the Redirect Function
function goToAdventureMap() {
    // The query param '?returnTo=adventure' triggers the logic 
    // in your main index.html to skip the intro and open the map.
    window.location.href = "../index.html?returnTo=adventure";
}

// 3. Attach the click events
if (failHomeBtn) {
    failHomeBtn.onclick = goToAdventureMap;
}

if (vicHomeBtn) {
    vicHomeBtn.onclick = goToAdventureMap;
}