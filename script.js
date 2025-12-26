const gridSize = 8;
const grid = document.getElementById("grid");
const tray = document.getElementById("tray");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const overlay = document.getElementById("game-over-overlay");

let cells = [], gridState = Array(64).fill(0), score = 0, displayedScore = 0, combo = 0;
let bestScore = localStorage.getItem("bloxplode_best") || 0;
bestScoreEl.textContent = bestScore;

const REINFORCE_PALETTE = [
    { glow: '#00f2ff', bg: 'rgba(0, 242, 255, 0.3)' },
    { glow: '#ffd700', bg: 'rgba(255, 215, 0, 0.3)' },
    { glow: '#7cfc00', bg: 'rgba(124, 252, 0, 0.3)' },
    { glow: '#ff00ff', bg: 'rgba(255, 0, 255, 0.3)' },
    { glow: '#ffffff', bg: 'rgba(255, 255, 255, 0.4)' }
];
const COMBO_PALETTE = ['#00f2ff', '#ff00ff', '#ffeb3b', '#ff5722', '#e91e63'];

const SHAPES = {
    DOT: { data: [[0,0]], color: '#ff4d6d' },
    I2: { data: [[0,0],[1,0]], color: '#ff9f1c' },
    I3: { data: [[0,0],[1,0],[2,0]], color: '#ffbf00' },
    I4: { data: [[0,0],[1,0],[2,0],[3,0]], color: '#2ec4b6' },
    O2: { data: [[0,0],[1,0],[0,1],[1,1]], color: '#e71d36' },
    T: { data: [[0,1],[1,0],[1,1],[2,1]], color: '#a5a5a5' },
    PLUS: { data: [[1,0],[0,1],[1,1],[2,1],[1,2]], color: '#9d4edd' }
};

function init() {
    grid.innerHTML = ""; cells = []; gridState.fill(0);
    for (let i = 0; i < 64; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        grid.appendChild(cell);
        cells.push(cell);
    }
    spawnTrayPieces();
    score = 0; displayedScore = 0; scoreEl.textContent = "0"; combo = 0;
}

function updateUI() {
    if (displayedScore < score) {
        const diff = score - displayedScore;
        const step = Math.ceil(diff / 5); // Faster catching up
        displayedScore += step;
        if (displayedScore > score) displayedScore = score;
        scoreEl.textContent = displayedScore;
        requestAnimationFrame(updateUI);
    } else if (displayedScore > score) {
        // Handle potential reset or score adjustment
        displayedScore = score;
        scoreEl.textContent = score;
    } else {
        scoreEl.textContent = score;
    }
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("bloxplode_best", bestScore);
        bestScoreEl.textContent = bestScore;
    }
}

function clearLines(lastRow, lastCol) {
    let rToClear = [], cToClear = [];
    for (let i = 0; i < 8; i++) {
        if (gridState.slice(i * 8, (i + 1) * 8).every(v => v)) rToClear.push(i);
        let colFull = true;
        for (let r = 0; r < 8; r++) if (!gridState[r * 8 + i]) colFull = false;
        if (colFull) cToClear.push(i);
    }
    const totalLines = rToClear.length + cToClear.length;
    
    if (totalLines > 0) {
        combo++;
        let basePayout = 50;
        let eventName = "CLEAR";
        let eventColor = "#00f2ff";

        if (totalLines === 2) { basePayout = 150; eventName = "BURST"; eventColor = "#00f2ff"; }
        else if (totalLines === 3) { basePayout = 350; eventName = "BLAST"; eventColor = "#ffd700"; }
        else if (totalLines === 4) { basePayout = 750; eventName = "BLOXPLODE"; eventColor = "#ff00ff"; }
        else if (totalLines >= 5) { basePayout = 1200; eventName = "MEGA-BOOM"; eventColor = "#ff3d00"; }
        
        let finalPoints = basePayout * combo;
        score += finalPoints;

        if (totalLines >= 2) {
            const namePop = document.createElement("div");
            namePop.className = "event-name-pop";
            namePop.textContent = eventName;
            namePop.style.textShadow = `0 0 20px ${eventColor}, 0 0 40px ${eventColor}`;
            document.getElementById("grid-wrapper").appendChild(namePop);
            setTimeout(() => { if(namePop.parentNode) namePop.remove(); }, 800);
        }

        const burst = document.createElement("div");
        burst.className = "combo-burst";
        const comboColor = COMBO_PALETTE[(combo - 1) % COMBO_PALETTE.length];
        burst.style.setProperty('--glow-color', comboColor);
        burst.innerHTML = `COMBO <span class="combo-num">${combo}</span>`;
        document.getElementById("grid-wrapper").appendChild(burst);

        setTimeout(() => {
            const words = ["GOOD!", "GREAT!", "FANTASTIC!", "PERFECT!", "BOOMPLODE!"];
            const wordIdx = Math.min(combo - 1, words.length - 1);
            showReinforcement(words[wordIdx], combo);
            const targetCell = cells[lastRow * 8 + lastCol];
            showFloatingScore(`+${finalPoints} ${eventName}`, targetCell);
            updateUI();
            if (burst && burst.parentNode) burst.remove();
        }, 833); 
        
        rToClear.forEach(r => { for(let c=0; c<8; c++) explode(r * 8 + c); });
        cToClear.forEach(c => { for(let r=0; r<8; r++) explode(r * 8 + c); });
    } else {
        combo = 0;
    }
}

function showReinforcement(text, currentCombo) {
    const rf = document.createElement("div");
    rf.className = "reinforce";
    rf.textContent = text;
    const theme = REINFORCE_PALETTE[Math.min(currentCombo - 1, REINFORCE_PALETTE.length - 1)];
    rf.style.setProperty('--glow-color', theme.glow);
    rf.style.setProperty('--bg-color', theme.bg);
    document.getElementById("grid-wrapper").appendChild(rf);
    setTimeout(() => { if(rf.parentNode) rf.remove(); }, 850);
}

function explode(idx) {
    gridState[idx] = 0;
    const cell = cells[idx];
    cell.classList.remove('occupied');
    cell.classList.add('clearing');
    cell.addEventListener('animationend', () => {
        cell.classList.remove('clearing');
        cell.style.removeProperty('--block-color');
    }, { once: true });
}

function showFloatingScore(text, sourceElement) {
    const float = document.createElement("div");
    float.className = "floating-score";
    float.textContent = text;
    const rect = sourceElement.getBoundingClientRect();
    const bombRect = document.getElementById("bomb-target").getBoundingClientRect();
    float.style.setProperty('--start-x', `${rect.left + rect.width / 2}px`);
    float.style.setProperty('--start-y', `${rect.top}px`);
    float.style.setProperty('--end-x', `${bombRect.left + bombRect.width / 2}px`);
    float.style.setProperty('--end-y', `${bombRect.top + bombRect.height / 2}px`);
    document.body.appendChild(float);
    float.classList.add('score-animate');
    setTimeout(() => { if(float.parentNode) float.remove(); }, 1200);
}

function spawnTrayPieces() {
    const slots = document.querySelectorAll(".tray-slot");
    slots.forEach(slot => {
        slot.innerHTML = ""; 
        const keys = Object.keys(SHAPES);
        const key = keys[Math.floor(Math.random() * keys.length)];
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
    const slot = e.target.closest('.tray-slot');
    if (!slot || activeDrag) return;
    const piece = slot.querySelector('.piece');
    if (!piece) return;
    const shapeKey = piece.dataset.shape;
    const shapeData = SHAPES[shapeKey].data;
    const clone = piece.cloneNode(true);
    clone.classList.add("dragging");
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
    clone.style.left = (e.clientX - w / 2) + "px";
    clone.style.top = (e.clientY - h / 2) + "px";
    document.body.appendChild(clone);
    piece.style.visibility = "hidden";
    slot.setPointerCapture(e.pointerId);
    activeDrag = { id: e.pointerId, source: piece, slot: slot, clone: clone, offX: w / 2, offY: h / 2, shape: SHAPES[shapeKey], color: SHAPES[shapeKey].color };
});

window.addEventListener('pointermove', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;
    activeDrag.clone.style.left = (e.clientX - activeDrag.offX) + "px";
    activeDrag.clone.style.top = (e.clientY - activeDrag.offY) + "px";
    const gRect = grid.getBoundingClientRect();
    const col = Math.round((e.clientX - activeDrag.offX - gRect.left) / 48);
    const row = Math.round((e.clientY - activeDrag.offY - gRect.top) / 48);
    cells.forEach(c => c.classList.remove('ghost', 'ghost-clear'));
    if (canPlace(activeDrag.shape.data, row, col)) {
        let temp = [...gridState];
        activeDrag.shape.data.forEach(([dx, dy]) => { temp[(row + dy) * 8 + (col + dx)] = 1; });
        for (let i = 0; i < 8; i++) {
            if (temp.slice(i * 8, (i + 1) * 8).every(v => v)) {
                for(let c=0; c<8; c++) cells[i * 8 + c].classList.add('ghost-clear');
            }
            let full = true;
            for (let r = 0; r < 8; r++) if (!temp[r * 8 + i]) full = false;
            if (full) {
                for(let r=0; r<8; r++) cells[r * 8 + i].classList.add('ghost-clear');
            }
        }
        activeDrag.shape.data.forEach(([dx, dy]) => {
            const idx = (row + dy) * 8 + (col + dx);
            if (!cells[idx].classList.contains('ghost-clear')) cells[idx].classList.add('ghost');
        });
    }
});

window.addEventListener('pointerup', e => {
    if (!activeDrag || activeDrag.id !== e.pointerId) return;
    cells.forEach(c => c.classList.remove('ghost', 'ghost-clear'));
    activeDrag.slot.releasePointerCapture(e.pointerId);
    const gRect = grid.getBoundingClientRect();
    const col = Math.round((e.clientX - activeDrag.offX - gRect.left) / 48);
    const row = Math.round((e.clientY - activeDrag.offY - gRect.top) / 48);
    if (canPlace(activeDrag.shape.data, row, col)) {
        score += 5; 
        updateUI(); // FIX: Added immediate UI update for placement points
        activeDrag.shape.data.forEach(([dx, dy]) => {
            const idx = (row + dy) * 8 + (col + dx);
            gridState[idx] = 1;
            cells[idx].style.setProperty('--block-color', activeDrag.color);
            cells[idx].classList.add('occupied', 'placed-impact');
            setTimeout(() => cells[idx].classList.remove('placed-impact'), 300);
        });
        activeDrag.source.remove();
        requestAnimationFrame(() => {
            clearLines(row, col);
            if (document.querySelectorAll(".tray-slot .piece").length === 0) spawnTrayPieces();
            if (checkGameOver()) overlay.classList.remove("hidden");
        });
    } else { activeDrag.source.style.visibility = "visible"; }
    activeDrag.clone.remove();
    activeDrag = null;
});

function checkGameOver() {
    const pieces = document.querySelectorAll(".tray-slot .piece");
    if (pieces.length === 0) return false;
    for (const p of pieces) {
        const data = SHAPES[p.dataset.shape].data;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) if (canPlace(data, r, c)) return false;
        }
    }
    return true; 
}

function fullReset() { score = 0; displayedScore = 0; combo = 0; overlay.classList.add("hidden"); init(); }
document.getElementById("restart-overlay-btn").onclick = fullReset;
document.getElementById("restart").onclick = fullReset;
init();