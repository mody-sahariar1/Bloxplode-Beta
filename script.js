const gridSize = 8;
const grid = document.getElementById("grid");
const gridWrapper = document.getElementById("grid-wrapper");
const tray = document.getElementById("tray");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const overlay = document.getElementById("game-over-overlay");
const mainBomb = document.getElementById("main-bomb");
const fxLayer = document.getElementById("fx-layer");
const hudLayer = document.getElementById("hud-layer");
const gameView = document.getElementById("game-view");

let cells = [], gridState = Array(64).fill(0), combo = 0;
let movesLeft = 2; 
let internalScore = 0, confirmedScore = 0, displayedScore = 0;
let bestScore = localStorage.getItem("bloxplode_best") || 0;
bestScoreEl.textContent = bestScore;
let currentPhase = 'sunny'; 
let swarmTimer = null; 

// --- GLOBAL SCALE VARIABLE ---
let gameScale = 1;

// --- FINAL CALIBRATION: DIRECTIONAL NORMALIZATION ---
const TOUCH_OFFSET_MIN = 80;  
const TOUCH_OFFSET_MAX = 120; 
const HYSTERESIS_THRESHOLD = 0.6; 
const VELOCITY_DEADZONE = 1.0; 

// GAME FEEL TUNING
// Bias the logic point Down/Right to compensate for shadow/visual mass.
// This fixes the "Right/Down lags" sensation.
const VISUAL_CENTER_BIAS_X = 6; 
const VISUAL_CENTER_BIAS_Y = 6;
const PROJECTION_WEIGHT = 2.0; // Constant lead, even at low speeds

// --- SCALING FUNCTION ---
function resizeGame() {
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight;
    const baseWidth = 440; 
    const baseHeight = 820;
    const scaleX = availableWidth / baseWidth;
    const scaleY = availableHeight / baseHeight;
    gameScale = Math.min(scaleX, scaleY, 1);
    gameView.style.transform = `scale(${gameScale})`;
}
window.addEventListener('resize', resizeGame);

// --- ZOOM PREVENTION ---
document.addEventListener('dblclick', function(event) {
    event.preventDefault();
}, { passive: false });

function getComboData(c) {
    if (c === 2) return { text: "NICE!", color: "#00d2d3" };       
    if (c === 5) return { text: "SWEET!", color: "#ff9ff3" };      
    if (c === 8) return { text: "GREAT!", color: "#54a0ff" };      
    if (c === 10) return { text: "AMAZING!", color: "#feca57" };   
    if (c === 13) return { text: "UNREAL!", color: "#5f27cd" };    
    if (c === 15) return { text: "INSANE!", color: "#ff6b6b" };    
    if (c === 18) return { text: "LEGENDARY!", color: "#f1c40f" }; 
    if (c === 20) return { text: "GODLIKE!", color: "#00ffcc" };   

    if (c > 20) {
        const loopVal = (c - 21) % 3;
        if (loopVal === 0) return { text: "INSANE!", color: "#ff6b6b" };
        if (loopVal === 1) return { text: "LEGENDARY!", color: "#f1c40f" };
        if (loopVal === 2) return { text: "GODLIKE!", color: "#00ffcc" };
    }
    
    if (c > 18) return { text: "", color: "#f1c40f" };
    if (c > 15) return { text: "", color: "#ff6b6b" };
    if (c > 13) return { text: "", color: "#5f27cd" };
    if (c > 10) return { text: "", color: "#feca57" };
    if (c > 8) return { text: "", color: "#54a0ff" };
    if (c > 5) return { text: "", color: "#ff9ff3" };
    if (c > 2) return { text: "", color: "#00d2d3" };

    return { text: "", color: "#ffffff" };
}

function getDebrisColor(c) {
    if (c <= 4) return "#f1c40f";  
    if (c <= 9) return "#e67e22";  
    if (c <= 14) return "#d35400"; 
    return "#c0392b";              
}

const SHAPES = {
    I4: { data: [[0,0],[1,0],[2,0],[3,0]], color: '#48dbfb' }, 
    DOT: { data: [[0,0]], color: '#ff6b6b' }, 
    I2: { data: [[0,0],[1,0]], color: '#feca57' }, 
    I3: { data: [[0,0],[1,0],[2,0]], color: '#ff9f43' }, 
    O2: { data: [[0,0],[1,0],[0,1],[1,1]], color: '#54a0ff' }, 
    T: { data: [[0,1],[1,0],[1,1],[2,1]], color: '#5f27cd' }, 
    PLUS: { data: [[1,0],[0,1],[1,1],[2,1],[1,2]], color: '#1dd1a1' } 
};

function getDirectorChoice() {
    const keys = Object.keys(SHAPES);
    return keys[Math.floor(Math.random() * keys.length)];
}

function init() {
    document.querySelectorAll('.leaf, .flower, .falling-flora, .debris-petal').forEach(el => el.remove());

    grid.innerHTML = ""; cells = []; gridState.fill(0);
    for (let i = 0; i < 64; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        grid.appendChild(cell);
        cells.push(cell);
    }
    
    spawnTrayPieces();
    
    currentPhase = 'sunny';
    spawnClouds();
    spawnAmbientLife('sunny');
    
    generateVines(gridWrapper, 100, false);
    generateVines(gridWrapper, 40, true);
    document.querySelectorAll('.tray-slot').forEach(slot => generateVines(slot, 12, false));
    generateVines(tray, 30, false); 

    internalScore = 0; confirmedScore = 0; displayedScore = 0; scoreEl.textContent = "0"; 
    combo = 0; movesLeft = 2; 
    updateBombHeat();
    resizeGame(); 
}

function spawnClouds() {
    const layer = document.getElementById('clouds-layer');
    layer.innerHTML = ''; 
    const count = 5; 
    for (let i = 0; i < count; i++) {
        const c = document.createElement('div');
        c.className = Math.random() > 0.7 ? 'cloud dark' : 'cloud'; 
        const scale = Math.random() * 0.8 + 0.5;
        c.style.transform = `scale(${scale})`;
        c.style.top = Math.random() * 40 + '%';
        c.style.width = (100 + Math.random() * 100) + 'px';
        c.style.height = (40 + Math.random() * 40) + 'px';
        const duration = Math.random() * 40 + 60 + 's';
        c.style.animationDuration = duration;
        c.style.animationDelay = (Math.random() * -60) + 's';
        layer.appendChild(c);
    }
}

function generateVines(targetElement, leafCount, isInternal) {
    const w = targetElement.offsetWidth;
    const h = targetElement.offsetHeight;
    for (let i = 0; i < leafCount; i++) {
        const leaf = document.createElement('div');
        if (isInternal) {
            leaf.className = 'leaf internal'; 
            leaf.style.top = Math.random() * h + 'px';
            leaf.style.left = Math.random() * w + 'px';
            leaf.style.setProperty('--base-rot', Math.random() * 360 + 'deg');
        } else {
            leaf.className = Math.random() > 0.5 ? 'leaf' : 'leaf dark';
            let top, left, rotation;
            const side = Math.floor(Math.random() * 4); 
            const offset = Math.random() * 20 - 10;
            if (side === 0) { top = -6 + offset; left = Math.random() * w; rotation = Math.random() * 180 + 90; }
            else if (side === 1) { top = Math.random() * h; left = w - 8 + offset; rotation = Math.random() * 180 + 180; }
            else if (side === 2) { top = h - 8 + offset; left = Math.random() * w; rotation = Math.random() * 180 - 90; }
            else { top = Math.random() * h; left = -6 + offset; rotation = Math.random() * 180; }
            leaf.style.top = top + 'px';
            leaf.style.left = left + 'px';
            leaf.style.setProperty('--base-rot', rotation + 'deg');
        }
        leaf.style.setProperty('--sway-speed', (2 + Math.random() * 2) + 's');
        leaf.style.setProperty('--sway-delay', -(Math.random() * 5) + 's');
        targetElement.appendChild(leaf);
        if (!isInternal && Math.random() > 0.9) {
            const flower = document.createElement('div');
            flower.className = 'flower';
            flower.style.top = leaf.style.top;
            flower.style.left = leaf.style.left;
            flower.style.setProperty('--base-rot', Math.random()*360 + 'deg');
            flower.style.setProperty('--sway-speed', (2 + Math.random() * 2) + 's');
            targetElement.appendChild(flower);
        }
    }
}

function spawnAmbientLife(phase) {
    const fx = document.getElementById('fx-layer');
    fx.innerHTML = ''; 
    if (phase === 'sunny') {
        for(let i=0; i<15; i++) {
            const b = document.createElement('div');
            const type = Math.random();
            if (type < 0.33) b.className = 'butterfly';
            else if (type < 0.66) b.className = 'butterfly blue';
            else b.className = 'butterfly orange';
            b.style.left = Math.random() * 100 + 'vw';
            b.style.top = Math.random() * 80 + 'vh';
            b.style.animationDuration = (Math.random() * 5 + 5) + 's';
            b.style.animationDelay = -Math.random() * 10 + 's';
            fx.appendChild(b);
        }
    }
}

let swarm = []; let swarmId = null; let isSwarmActive = false;
let lastSwarmX = 0, lastSwarmY = 0;
const swarmColors = ['#00e5ff', '#ff4081', '#76ff03', '#ffd700', '#aa00ff'];

function spawnSwarm(x, y) {
    isSwarmActive = true;
    lastSwarmX = x; lastSwarmY = y;
    for(let i=0; i<20; i++) { 
        const b = document.createElement('div');
        b.className = 'swarm-butterfly';
        const color = swarmColors[Math.floor(Math.random() * swarmColors.length)];
        b.style.setProperty('--wing-color', color);
        document.body.appendChild(b);
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 40; 
        swarm.push({
            el: b, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
            angle: angle, wanderSpeed: (Math.random() - 0.5) * 0.02, 
            radius: dist, radiusOffset: Math.random() * 20
        });
    }
    animateSwarm();
}
function animateSwarm() {
    if(!isSwarmActive && swarm.length === 0) return;
    if(activeDrag) {
        const rect = activeDrag.clone.getBoundingClientRect();
        lastSwarmX = rect.left + rect.width / 2;
        lastSwarmY = rect.top + rect.height / 2;
    }
    const cx = lastSwarmX; const cy = lastSwarmY;
    const time = Date.now() * 0.001;
    swarm.forEach((b) => {
        b.angle += b.wanderSpeed; 
        const currentRadius = b.radius + Math.sin(time + b.radiusOffset) * 10;
        const targetX = cx + Math.cos(b.angle) * currentRadius;
        const targetY = cy + Math.sin(b.angle) * currentRadius;
        b.x += (targetX - b.x) * 0.08; 
        b.y += (targetY - b.y) * 0.08;
        b.el.style.left = b.x + 'px'; b.el.style.top = b.y + 'px';
        const dx = targetX - b.x; const dy = targetY - b.y;
        if(Math.abs(dx) > 1 || Math.abs(dy) > 1) { 
                const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
                b.el.style.transform = `rotate(${angle}deg)`;
        }
    });
    swarmId = requestAnimationFrame(animateSwarm);
}
function removeSwarm() {
    cancelAnimationFrame(swarmId);
    swarm.forEach(b => b.el.remove());
    swarm = [];
}

function updateUI() {
    if (displayedScore < confirmedScore) {
        let step = Math.ceil((confirmedScore - displayedScore) / 8); 
        displayedScore += Math.max(1, step);
        scoreEl.textContent = displayedScore;
        requestAnimationFrame(updateUI);
    }
    updateStarEvolution(confirmedScore);
    if (internalScore > bestScore) {
        bestScore = internalScore;
        localStorage.setItem("bloxplode_best", bestScore);
        bestScoreEl.textContent = bestScore;
    }
}

function updateStarEvolution(score) {
    if (currentPhase !== 'sunny') {
        currentPhase = 'sunny';
        document.body.classList.remove('phase-storm', 'phase-golden', 'phase-night');
        spawnAmbientLife('sunny');
    }
}

function updateBombHeat() {
    const classesToRemove = [];
    for(let i=0; i<=10; i++) classesToRemove.push(`bomb-heat-${i}`);
    mainBomb.classList.remove(...classesToRemove);
    let level = Math.min(combo, 10);
    mainBomb.classList.add(`bomb-heat-${level}`);
}

function spawnDebris(x, y, color, axis) {
    const count = 3; 
    const gridRect = gridWrapper.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        
        const isLeaf = Math.random() > 0.5;
        p.style.position = "fixed";
        p.style.left = x + "px";
        p.style.top = y + "px";
        p.style.pointerEvents = "none";
        p.style.zIndex = "9999";
        
        if (isLeaf) {
            p.style.width = "12px"; p.style.height = "12px"; 
            p.style.backgroundColor = "#2ecc71"; 
            p.style.borderRadius = "12px 0px"; 
            p.style.boxShadow = "0 0 10px #2ecc71, 0 0 20px #2ecc71"; 
        } else {
            p.style.width = "10px"; p.style.height = "10px"; 
            p.style.backgroundColor = color; 
            p.style.borderRadius = "50% 0 50% 50%"; 
            p.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`; 
        }
        
        fxLayer.appendChild(p);

        let vx, vy;
        
        if (axis === 'row') {
            vx = (4 + Math.random() * 4) * 0.95; 
            vy = (Math.random() - 0.5) * 0.5; 
        } else {
            vx = (Math.random() - 0.5) * 0.5; 
            vy = (4 + Math.random() * 4) * 0.95; 
        }
        
        let rotation = Math.random() * 360;
        let rotSpeed = (Math.random() - 0.5) * 15;
        let opacity = 1;

        function animate() {
            if (!p.isConnected) return;

            let curX = parseFloat(p.style.left);
            let curY = parseFloat(p.style.top);

            curX += vx;
            curY += vy;

            p.style.left = curX + "px";
            p.style.top = curY + "px";
            
            rotation += rotSpeed;
            p.style.transform = `rotate(${rotation}deg)`;
            
            let outOfBounds = false;
            if (axis === 'row' && curX > gridRect.right) outOfBounds = true;
            if (axis === 'col' && curY > gridRect.bottom) outOfBounds = true;

            if (outOfBounds) {
                p.remove(); 
            } else {
                requestAnimationFrame(animate);
            }
        }
        requestAnimationFrame(animate);
    }
}

function shedVines() {
    const allLeaves = Array.from(gridWrapper.querySelectorAll('.leaf:not(.internal), .flower'));
    if (allLeaves.length === 0) return;

    let availableLeaves = [...allLeaves];
    const amount = Math.min(availableLeaves.length, 10 + Math.floor(Math.random() * 10));

    for(let i=0; i<amount; i++) {
        const index = Math.floor(Math.random() * availableLeaves.length);
        const sourceLeaf = availableLeaves[index];
        availableLeaves.splice(index, 1);
        spawnFallingLeaf(sourceLeaf);
    }
}

function spawnFallingLeaf(sourceEl) {
    const rect = sourceEl.getBoundingClientRect();
    const falling = document.createElement('div');
    
    falling.className = sourceEl.className;
    falling.classList.add('falling-flora'); 
    
    falling.style.position = 'fixed';
    falling.style.left = rect.left + 'px';
    falling.style.top = rect.top + 'px';
    falling.style.width = sourceEl.offsetWidth + 'px'; 
    falling.style.height = sourceEl.offsetHeight + 'px';
    falling.style.pointerEvents = 'none';
    falling.style.zIndex = '9999';
    falling.style.transform = sourceEl.style.transform;
    
    fxLayer.appendChild(falling);

    let vy = 0; 
    let gravity = 0.15; 
    let swayPhase = Math.random() * 10;
    let swaySpeed = 0.05;
    let swayAmp = 1.5;
    let rot = parseFloat(sourceEl.style.getPropertyValue('--base-rot')) || 0;
    let rotSpeed = (Math.random() - 0.5) * 4;

    const gridBottom = gridWrapper.getBoundingClientRect().bottom;

    function fall() {
        if (!falling.isConnected) return;

        let curY = parseFloat(falling.style.top);
        let curX = parseFloat(falling.style.left);

        vy += gravity;
        if(vy > 3) vy = 3; 

        curY += vy;

        swayPhase += swaySpeed;
        curX += Math.sin(swayPhase) * swayAmp;

        rot += rotSpeed;

        falling.style.top = curY + 'px';
        falling.style.left = curX + 'px';
        falling.style.transform = `rotate(${rot}deg)`;

        if (curY > gridBottom) {
            falling.remove();
        } else {
            requestAnimationFrame(fall);
        }
    }
    requestAnimationFrame(fall);
}

function triggerHaptic(type) {
    if (!navigator.vibrate) return;
    
    if (type === 'placement') {
        navigator.vibrate(25);
    }
    else if (type === 'combo-start') {
        navigator.vibrate(50);
    }
    else if (type === 'combo-mid') {
        navigator.vibrate(65);
    }
    else if (type === 'combo-high') {
        navigator.vibrate(80);
    }
}

function clearLines(lastRow, lastCol) {
    let rToClear = [], cToClear = [];
    
    for (let i = 0; i < 8; i++) {
        if (gridState.slice(i * 8, (i + 1) * 8).every(v => v)) rToClear.push(i);
    }
    for (let i = 0; i < 8; i++) {
        let colFull = true;
        for (let r = 0; r < 8; r++) if (!gridState[r * 8 + i]) colFull = false;
        if (colFull) cToClear.push(i);
    }

    const totalLines = rToClear.length + cToClear.length;
    
    if (totalLines > 0) {
        if (swarmTimer) clearTimeout(swarmTimer);
        removeSwarm(); 
        cells.forEach(c => c.classList.remove('impact'));

        shedVines();

        combo++;
        movesLeft = 2; 

        grid.classList.remove('shake-1', 'shake-2', 'shake-3');
        void grid.offsetWidth; // Force Reflow

        if (combo === 1) {
            grid.classList.add('shake-1');
            triggerHaptic('combo-start'); 
        } else if (combo <= 4) {
            grid.classList.add('shake-2');
            triggerHaptic('combo-mid');   
        } else {
            grid.classList.add('shake-3');
            triggerHaptic('combo-high');  
        }

        setTimeout(() => grid.classList.remove('shake-1', 'shake-2', 'shake-3'), 150);

        updateBombHeat();
        
        let basePayout = 50;
        if (totalLines === 2) basePayout = 150;
        else if (totalLines === 3) basePayout = 350;
        else if (totalLines === 4) basePayout = 750;
        else if (totalLines >= 5) basePayout = 1200;
        
        const comboData = getComboData(combo);
        
        if (comboData.text) {
            const banner = document.createElement("div");
            banner.className = "reinforcement-banner";
            banner.style.setProperty('--glow-color', comboData.color);
            banner.innerHTML = `<div class="reinforcement-text">${comboData.text}</div>`;
            gridWrapper.appendChild(banner);
            setTimeout(() => banner.remove(), 1550); 
        }

        const comboContainer = document.createElement("div");
        comboContainer.className = "combo-container";
        comboContainer.style.setProperty('--glow-color', comboData.color);
        comboContainer.innerHTML = `<span class="combo-label">COMBO</span><span class="combo-number">${combo}</span>`;
        gridWrapper.appendChild(comboContainer);
        setTimeout(() => comboContainer.remove(), 980);
        
        const debrisColor = getDebrisColor(combo);

        rToClear.forEach(r => {
            for(let c=0; c<8; c++) {
                const cell = cells[r * 8 + c];
                const rect = cell.getBoundingClientRect();
                spawnDebris(rect.left + 22, rect.top + 22, debrisColor, 'row');
            }
        });

        cToClear.forEach(c => {
            for(let r=0; r<8; r++) {
                const cell = cells[r * 8 + c];
                const rect = cell.getBoundingClientRect();
                spawnDebris(rect.left + 22, rect.top + 22, debrisColor, 'col');
            }
        });

        let finalPoints = basePayout * combo;
        internalScore += finalPoints; 
        setTimeout(() => {
            const targetCell = cells[lastRow * 8 + lastCol];
            showFloatingScore(`+${finalPoints}`, targetCell, finalPoints);
        }, 100); 
        
        rToClear.forEach(r => { for(let c=0; c<8; c++) explode(r * 8 + c); });
        cToClear.forEach(c => { for(let r=0; r<8; r++) explode(r * 8 + c); });
    } else { 
        movesLeft--;
        if (movesLeft < 0) { combo = 0; movesLeft = 2; }
        updateBombHeat();
    }
}

function explode(idx) {
    gridState[idx] = 0;
    const cell = cells[idx];
    cell.classList.remove('occupied', 'impact'); 
    cell.classList.add('clearing');
    cell.addEventListener('animationend', () => {
        cell.classList.remove('clearing');
        cell.style.removeProperty('--block-color');
    }, { once: true });
}

function showFloatingScore(text, sourceElement, pointValue) {
    const float = document.createElement("div");
    float.className = "floating-score";
    float.textContent = text;
    const rect = sourceElement.getBoundingClientRect();
    const bombRect = mainBomb.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const endX = bombRect.left + bombRect.width / 2;
    const endY = bombRect.top + bombRect.height / 2;
    const tx = endX - startX;
    const ty = endY - startY;
    float.style.setProperty('--start-x', `${startX}px`);
    float.style.setProperty('--start-y', `${startY}px`);
    float.style.setProperty('--tx', `${tx}px`);
    float.style.setProperty('--ty', `${ty}px`);
    document.body.appendChild(float); 
    requestAnimationFrame(() => { float.classList.add('score-animate'); });
    setTimeout(() => { confirmedScore += pointValue; updateUI(); if (float.parentNode) float.remove(); }, 1000); 
}

function spawnTrayPieces() {
    document.querySelectorAll(".tray-slot").forEach(slot => {
        slot.innerHTML = ""; 
        const key = getDirectorChoice(); 
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

// --- STATE MANAGEMENT ---
let activeDrag = null;
let lastHoveredCell = { r: -1, c: -1 }; 

window.addEventListener('pointerdown', e => {
    const slot = e.target.closest('.tray-slot');
    if (!slot || activeDrag) return;
    const piece = slot.querySelector('.piece');
    if (!piece) return;

    lastHoveredCell = { r: -1, c: -1 };

    const shapeKey = piece.dataset.shape, shapeData = SHAPES[shapeKey].data;
    const clone = piece.cloneNode(true);
    
    // Calculate Piece Dimensions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapeData.forEach(([x, y]) => {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    });
    
    const blockCount = shapeData.length;
    const isSmallPiece = blockCount <= 2;
    const isFlatPiece = (maxY - minY) === 0 && (maxX - minX) >= 1;

    // --- PHYSICS PARAMETERS ---
    const physicsProfile = {
        offsetMax: isSmallPiece ? 90 : 120, 
        offsetMin: isSmallPiece ? 60 : 80,
        projectionWeight: isSmallPiece ? 1.5 : 2.0 
    };

    if (e.pointerType === 'touch') {
        clone.classList.add("dragging", "dragging-touch");
        clone.style.setProperty('--base-scale', gameScale);
    } else {
        clone.classList.add("dragging");
    }

    clone.style.transform = `scale(${gameScale})`; 
    
    const sz = 44, gap = 4, w = (maxX - minX + 1) * sz + (maxX - minX) * gap, h = (maxY - minY + 1) * sz + (maxY - minY) * gap;
    clone.style.width = w + "px"; clone.style.height = h + "px";
    clone.querySelectorAll('.block').forEach((b, i) => {
        const [x, y] = shapeData[i];
        b.style.left = (x - minX) * (sz + gap) + "px"; b.style.top = (y - minY) * (sz + gap) + "px";
    });

    const startX = e.clientX;
    const startY = e.clientY;
    clone.style.left = (startX - w / 2) + "px"; 
    clone.style.top = (startY - h / 2) + "px";
    
    document.body.appendChild(clone);
    piece.style.visibility = "hidden";
    slot.setPointerCapture(e.pointerId);

    activeDrag = { 
        id: e.pointerId, 
        source: piece, 
        slot: slot, 
        clone: clone, 
        offX: w / 2, 
        offY: h / 2, 
        shape: SHAPES[shapeKey], 
        color: SHAPES[shapeKey].color,
        lastX: startX,
        lastY: startY,
        vx: 0,
        vy: 0,
        smoothedLogicX: startX,
        smoothedLogicY: startY,
        physics: physicsProfile,
        isFlatPiece: isFlatPiece 
    };
    spawnSwarm(startX, startY);
});

window.addEventListener('pointermove', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;

    // 0. Environment Check
    const gRect = grid.getBoundingClientRect();
    const scaledCellSize = gRect.width / 8;

    // 1. Calculate Velocity (Immediate)
    let vx = e.clientX - activeDrag.lastX;
    let vy = e.clientY - activeDrag.lastY;
    
    if (Math.abs(vx) < VELOCITY_DEADZONE) vx = 0;
    if (Math.abs(vy) < VELOCITY_DEADZONE) vy = 0;

    activeDrag.vx = activeDrag.vx * 0.7 + vx * 0.3;
    activeDrag.vy = activeDrag.vy * 0.7 + vy * 0.3;
    
    activeDrag.lastX = e.clientX;
    activeDrag.lastY = e.clientY;

    // 2. VISUAL POSITION 
    let visualX = e.clientX;
    let visualY = e.clientY;
    let dragOffsetY = 0;

    if (e.pointerType === 'touch') {
        const screenT = Math.min(Math.max(e.clientY / window.innerHeight, 0), 1);
        const p = activeDrag.physics;
        dragOffsetY = p.offsetMax - (screenT * (p.offsetMax - p.offsetMin));
        
        const estimatedLogicY = (e.clientY - dragOffsetY) - activeDrag.offY;
        if ((estimatedLogicY - gRect.top) < scaledCellSize * 1.5) {
             dragOffsetY -= 15;
        }
        visualY = e.clientY - dragOffsetY;
    }

    activeDrag.clone.style.left = (visualX - activeDrag.offX) + "px";
    activeDrag.clone.style.top = (visualY - activeDrag.offY) + "px";

    // 3. INTENT POINT
    let intentX = visualX;
    let intentY = visualY;

    if (e.pointerType === 'touch') {
        const p = activeDrag.physics;
        // Directional Lead (Velocity * Weight)
        // PLUS Visual Center Bias to fix directional asymmetry
        intentX = visualX + (activeDrag.vx * PROJECTION_WEIGHT) + VISUAL_CENTER_BIAS_X;
        intentY = visualY + (activeDrag.vy * PROJECTION_WEIGHT) + VISUAL_CENTER_BIAS_Y;
    }

    // 4. Grid Detection
    let rawCol = Math.floor((intentX - activeDrag.offX - gRect.left + (scaledCellSize/2)) / scaledCellSize);
    let rawRow = Math.floor((intentY - activeDrag.offY - gRect.top + (scaledCellSize/2)) / scaledCellSize);

    // 5. Hysteresis
    let finalCol = rawCol;
    let finalRow = rawRow;

    if (lastHoveredCell.r !== -1) {
        const stickyX = gRect.left + (lastHoveredCell.c * scaledCellSize) + (scaledCellSize/2) + activeDrag.offX;
        const stickyY = gRect.top + (lastHoveredCell.r * scaledCellSize) + (scaledCellSize/2) + activeDrag.offY;
        const dist = Math.sqrt(Math.pow(intentX - stickyX, 2) + Math.pow(intentY - stickyY, 2));
        
        if (dist < (scaledCellSize * HYSTERESIS_THRESHOLD)) {
            finalCol = lastHoveredCell.c;
            finalRow = lastHoveredCell.r;
        }
    }

    // Update Ghost Visuals
    cells.forEach(c => {
        c.classList.remove('ghost', 'ghost-clear');
        c.style.removeProperty('--preview-color'); 
        if(!c.classList.contains('occupied') && !c.classList.contains('clearing')) {
            c.style.removeProperty('--block-color');
        }
    });

    if (canPlace(activeDrag.shape.data, finalRow, finalCol)) {
        lastHoveredCell = { r: finalRow, c: finalCol };
        activeDrag.clone.classList.add('aligned');

        let temp = [...gridState];
        activeDrag.shape.data.forEach(([dx, dy]) => { 
            const idx = (finalRow + dy) * 8 + (finalCol + dx);
            if (idx >= 0 && idx < 64) temp[idx] = 1;
        });
        
        let willClear = false;

        for (let i = 0; i < 8; i++) {
            if (temp.slice(i * 8, (i + 1) * 8).every(v => v)) {
                willClear = true;
                for(let c=0; c<8; c++) {
                    let cell = cells[i * 8 + c];
                    cell.classList.add('ghost-clear');
                    cell.style.setProperty('--preview-color', activeDrag.color);
                }
            }
            let full = true;
            for (let r = 0; r < 8; r++) if (!temp[r * 8 + i]) full = false;
            if (full) {
                willClear = true;
                for(let r=0; r<8; r++) {
                    let cell = cells[r * 8 + i];
                    cell.classList.add('ghost-clear');
                    cell.style.setProperty('--preview-color', activeDrag.color);
                }
            }
        }
        
        if (!willClear) {
            activeDrag.shape.data.forEach(([dx, dy]) => {
                const idx = (finalRow + dy) * 8 + (finalCol + dx);
                if (idx >= 0 && idx < 64) {
                    const cell = cells[idx];
                    cell.classList.add('ghost');
                    cell.style.setProperty('--block-color', activeDrag.color);
                }
            });
        }

    } else {
        lastHoveredCell = { r: -1, c: -1 };
        activeDrag.clone.classList.remove('aligned');
    }
});

window.addEventListener('pointercancel', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;
    
    cells.forEach(c => {
        c.classList.remove('ghost', 'ghost-clear');
        c.style.removeProperty('--preview-color');
        if(!c.classList.contains('occupied') && !c.classList.contains('clearing')) {
            c.style.removeProperty('--block-color');
        }
    });

    if (activeDrag.source) activeDrag.source.style.visibility = "visible";
    if (activeDrag.clone) activeDrag.clone.remove();
    
    removeSwarm();
    
    if (activeDrag.slot) activeDrag.slot.releasePointerCapture(e.pointerId);
    activeDrag = null;
    lastHoveredCell = { r: -1, c: -1 };
});

window.addEventListener('pointerup', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;
    cells.forEach(c => {
        c.classList.remove('ghost', 'ghost-clear');
        c.style.removeProperty('--preview-color');
        if(!c.classList.contains('occupied') && !c.classList.contains('clearing')) {
            c.style.removeProperty('--block-color');
        }
    });
    activeDrag.slot.releasePointerCapture(e.pointerId);
    
    let finalCol = lastHoveredCell.c;
    let finalRow = lastHoveredCell.r;

    if (finalCol === -1) {
         const gRect = grid.getBoundingClientRect();
         const scaledCellSize = gRect.width / 8;
         let dropX = e.clientX;
         let dropY = e.clientY;
         
         if (e.pointerType === 'touch') {
            const screenT = Math.min(Math.max(e.clientY / window.innerHeight, 0), 1);
            const p = activeDrag.physics;
            let offset = p.offsetMax - (screenT * (p.offsetMax - p.offsetMin));
            
            const estimatedLogicY = (e.clientY - offset) - activeDrag.offY;
            if ((estimatedLogicY - gRect.top) < scaledCellSize * 1.5) {
                 offset -= 15;
            }
            dropY -= offset;
            
            // Apply Center Bias to Drop as well
            dropX += VISUAL_CENTER_BIAS_X;
            dropY += VISUAL_CENTER_BIAS_Y;
         }
         
         finalCol = Math.floor((dropX - activeDrag.offX - gRect.left + (scaledCellSize/2)) / scaledCellSize);
         finalRow = Math.floor((dropY - activeDrag.offY - gRect.top + (scaledCellSize/2)) / scaledCellSize);
    }
    
    if (canPlace(activeDrag.shape.data, finalRow, finalCol)) {
        internalScore += 5; confirmedScore += 5; updateUI(); 
        
        let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
        activeDrag.shape.data.forEach(([dx, dy]) => {
            const c = finalCol + dx; const r = finalRow + dy;
            minC = Math.min(minC, c); maxC = Math.max(maxC, c);
            minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        });
        const centerC = (minC + maxC) / 2;
        const centerR = (minR + maxR) / 2;
        
        const gRect = grid.getBoundingClientRect();
        const scaledCellSize = gRect.width / 8;
        lastSwarmX = gRect.left + (centerC + 0.5) * scaledCellSize;
        lastSwarmY = gRect.top + (centerR + 0.5) * scaledCellSize;

        let tempGrid = [...gridState];
        activeDrag.shape.data.forEach(([dx, dy]) => {
            const idx = (finalRow + dy) * 8 + (finalCol + dx);
            if(idx >=0 && idx < 64) tempGrid[idx] = 1;
        });

        let willClear = false;
        for (let i = 0; i < 8; i++) {
            if (tempGrid.slice(i * 8, (i + 1) * 8).every(v => v)) willClear = true;
        }
        if (!willClear) {
            for (let i = 0; i < 8; i++) {
                let colFull = true;
                for (let r = 0; r < 8; r++) if (!tempGrid[r * 8 + i]) colFull = false;
                if (colFull) willClear = true;
            }
        }

        const newlyPlacedCells = [];
        activeDrag.shape.data.forEach(([dx, dy]) => {
            const idx = (finalRow + dy) * 8 + (finalCol + dx);
            gridState[idx] = 1;
            const cell = cells[idx];
            cell.style.setProperty('--block-color', activeDrag.color);
            cell.classList.add('occupied');
            cell.classList.add('impact');
            setTimeout(() => cell.classList.remove('impact'), 500);
            
            if (!willClear) {
                cell.classList.add('just-placed');
                newlyPlacedCells.push(cell);
            }
        });

        if (newlyPlacedCells.length > 0) {
            setTimeout(() => {
                newlyPlacedCells.forEach(c => c.classList.remove('just-placed'));
            }, 500);
        }
        else {
                triggerHaptic('placement');
        }

        activeDrag.clone.remove(); 
        swarmTimer = setTimeout(removeSwarm, 500);
        activeDrag.source.remove();
        requestAnimationFrame(() => {
            clearLines(finalRow, finalCol);
            if (document.querySelectorAll(".tray-slot .piece").length === 0) spawnTrayPieces();
            if (checkGameOver()) overlay.classList.remove("hidden");
        });
    } else { 
        activeDrag.source.style.visibility = "visible"; 
        activeDrag.clone.remove(); 
        removeSwarm(); 
    }
    activeDrag = null;
    lastHoveredCell = { r: -1, c: -1 };
});

function checkGameOver() {
    const pieces = document.querySelectorAll(".tray-slot .piece");
    if (pieces.length === 0) return false;
    for (const p of pieces) {
        const data = SHAPES[p.dataset.shape].data;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (canPlace(data, r, c)) return false;
    }
    return true; 
}
function fullReset() { internalScore = 0; confirmedScore = 0; displayedScore = 0; combo = 0; overlay.classList.add("hidden"); init(); }
document.getElementById("restart-overlay-btn").onclick = fullReset;
document.getElementById("restart").onclick = fullReset;
init();