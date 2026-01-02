// ============================================
// DEFAULT SKIN (VISUALS) - FIXED MOBILE SCALING
// ============================================

// --- HELPERS ---

function triggerEternalHaptic(ms) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) { }
    }
}

function triggerFloatingScore(pointValue, sourceCell) {
    const floatingEl = document.createElement('div');
    floatingEl.className = 'floating-score';
    floatingEl.textContent = "+" + pointValue;

    // Floating Score attaches to BODY, so we MUST use Screen Coordinates (getBoundingClientRect)
    const startRect = sourceCell.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;

    const targetEl = document.getElementById('score'); 
    const endRect = targetEl.getBoundingClientRect();
    const endX = endRect.left + endRect.width / 2;
    const endY = endRect.top + endRect.height / 2;

    const tx = endX - startX;
    const ty = endY - startY;

    floatingEl.style.setProperty('--start-x', `${startX}px`);
    floatingEl.style.setProperty('--start-y', `${startY}px`);
    floatingEl.style.setProperty('--tx', `${tx}px`);
    floatingEl.style.setProperty('--ty', `${ty}px`);

    document.body.appendChild(floatingEl);

    requestAnimationFrame(() => {
        floatingEl.classList.add('score-animate');
    });

    setTimeout(() => {
        // Safe check for globals in case script.js changed
        if (typeof confirmedScore !== 'undefined') {
            confirmedScore += pointValue;
            if (typeof bestScore !== 'undefined' && confirmedScore > bestScore) {
                bestScore = confirmedScore;
                localStorage.setItem("grid_game_best", bestScore);
                const bsEl = document.getElementById('best-score');
                if(bsEl) bsEl.textContent = bestScore;
            }
            if (typeof updateUI === 'function') updateUI();
        }
        if (floatingEl.parentNode) floatingEl.remove();
    }, 1000);
}

function applyClearAnim(idx, animClass, dist, bright) {
    const cell = cells[idx];
    cell.classList.remove('occupied', 'placed-impact');
    cell.classList.add('clear-resolve');
}

function resetCellVisuals(idx) {
    const cell = cells[idx];
    cell.className = "cell"; 
    cell.style.removeProperty('--block-color');
    cell.style.removeProperty('--dist');
    cell.style.removeProperty('--bright');
    cell.style.removeProperty('--preview-color');
}

// --- VISUAL PIPE LISTENERS (WRAPPED IN BOSS) ---

// 1. Piece Placement Visuals (HIGH PRIORITY)
VisualPipe.on("piece_placed", ({ indices, color }) => {
    Boss.run({ priority: "high", duration: 600 }, () => {
        indices.forEach(idx => {
            const cell = cells[idx];
            cell.style.setProperty('--block-color', color);
            cell.classList.add('occupied', 'placed-impact');
            
            setTimeout(() => {
                cell.classList.remove('placed-impact');
            }, 200);
        });
    });
});

// 2. Clear Feedback (COMBO SYSTEM & HAPTICS)
VisualPipe.on("clear_feedback", ({ combo }) => {
    // A. Haptics (T=0ms)
    let hapticDuration = 50;
    if (combo >= 2 && combo <= 4) hapticDuration = 65;
    else if (combo >= 5) hapticDuration = 80;
    triggerEternalHaptic(hapticDuration);

    // B. Grid Shake (T=0ms)
    const gridWrapper = document.getElementById('grid-wrapper');
    let shakeClass = 'shake-1';
    let shakeTime = 100;

    if (combo >= 2 && combo <= 4) {
        shakeClass = 'shake-2';
        shakeTime = 120;
    } else if (combo >= 5) {
        shakeClass = 'shake-3';
        shakeTime = 150;
    }

    gridWrapper.classList.remove('shake-1', 'shake-2', 'shake-3');
    void gridWrapper.offsetWidth; // Force reflow
    gridWrapper.classList.add(shakeClass);
    
    setTimeout(() => {
        gridWrapper.classList.remove(shakeClass);
    }, shakeTime);

    // C. Configuration Data
    const thresholds = [2, 5, 8, 10, 13, 15, 18, 20];
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
                thresholds.forEach(t => { if (combo >= t) lower = t; });
                activeData = { text: null, color: dataMap[lower].color }; 
            }
        } else {
            const cycleIndex = (combo - 20) % thresholds.length;
            const cycleKey = thresholds[cycleIndex];
            activeData = dataMap[cycleKey];
        }
    }

    const displayColor = activeData ? activeData.color : "#ffffff";

    // D. Combo Number Display (T=0ms)
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

    setTimeout(() => {
        comboContainer.remove();
    }, 980);

    // E. Reinforcement Banner (T=700ms)
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

            setTimeout(() => {
                banner.remove();
            }, 850); 

        }, 700);
    }
});

// 3. Floating Score (HIGH PRIORITY)
VisualPipe.on("score_float", ({ points, targetIndex }) => {
    Boss.run({ priority: "high", duration: 1000 }, () => {
        const targetCell = cells[targetIndex];
        triggerFloatingScore(points, targetCell);
    });
});

// 4. Clear Animation (NEON SNAP - MOBILE FIXED)
VisualPipe.on("clear_anim", ({ rToClear, cToClear, combo }) => {
    Boss.run({ priority: "high", duration: 50 }, () => {
        
        const gridWrapper = document.getElementById('grid-wrapper');
        // REMOVED: getBoundingClientRect() math that breaks on mobile
        
        // 1. DETECT MULTI-CLEAR
        const isMulti = (rToClear.length + cToClear.length) > 1;
        const intersectionIndices = new Set();
        
        if (isMulti) {
            rToClear.forEach(r => {
                cToClear.forEach(c => {
                    intersectionIndices.add(r * 8 + c);
                });
            });
        }

        // 2. HELPER: Spawn FX using GRID MATH (Scale Independent)
        const spawnFX = (idx, color, delayMs, isIntersect) => {
            // MATH FIX: Calculate position based on Grid Index, not screen pixels
            const r = Math.floor(idx / 8);
            const c = idx % 8;
            
            // 48px is the Grid Cell Size (44px) + Gap (4px)
            // +12px is the Grid Wrapper Padding
            const relLeft = (c * 48) + 12;
            const relTop  = (r * 48) + 12;

            setTimeout(() => {
                // A. SPAWN STUNT DOUBLE
                const stunt = document.createElement('div');
                stunt.className = 'fx-dying-block anim-implode';
                stunt.style.left = relLeft + 'px';
                stunt.style.top = relTop + 'px';
                stunt.style.setProperty('--color', color);
                
                if (isIntersect) {
                    const core = document.createElement('div');
                    core.className = 'fx-core-flash';
                    core.style.left = relLeft + 'px';
                    core.style.top = relTop + 'px';
                    gridWrapper.appendChild(core);
                    setTimeout(() => core.remove(), 350);
                }
                
                gridWrapper.appendChild(stunt);
                setTimeout(() => stunt.remove(), 300);

                // B. SPAWN SPARKS
                let sparkCount = combo > 5 ? 6 : 3;
                if (isMulti) sparkCount *= 1.5;
                if (isIntersect) sparkCount = 12;

                for (let i = 0; i < sparkCount; i++) {
                    const spark = document.createElement('div');
                    spark.className = 'fx-spark';
                    
                    // Center the spark in the cell (+22px is half of 44px)
                    spark.style.left = (relLeft + 22) + 'px';
                    spark.style.top = (relTop + 22) + 'px';
                    spark.style.setProperty('--color', isIntersect ? '#fff' : color);

                    const angle = Math.random() * Math.PI * 2;
                    const velocity = isIntersect ? 60 : 40; 
                    const tx = Math.cos(angle) * velocity;
                    const ty = Math.sin(angle) * velocity;

                    spark.style.setProperty('--tx', `${tx}px`);
                    spark.style.setProperty('--ty', `${ty}px`);

                    gridWrapper.appendChild(spark);
                    setTimeout(() => spark.remove(), 550);
                }

            }, delayMs);
        };

        // 3. EXECUTE ROWS
        rToClear.forEach(r => {
            const beam = document.createElement('div');
            beam.className = 'fx-laser-beam laser-h';
            beam.style.left = '12px'; 
            beam.style.top = (r * 48 + 12 + 22) + 'px'; 
            beam.style.width = '384px'; 
            
            const firstCell = cells[r * 8]; 
            const beamColor = firstCell.style.getPropertyValue('--block-color') || '#fff';
            beam.style.setProperty('--color', beamColor);
            
            gridWrapper.appendChild(beam);
            setTimeout(() => beam.remove(), 350);

            for (let c = 0; c < 8; c++) {
                const idx = r * 8 + c;
                const cell = cells[idx];
                const color = cell.style.getPropertyValue('--block-color');
                const isIntersect = intersectionIndices.has(idx);
                spawnFX(idx, color, c * 30, isIntersect);
            }
        });

        // 4. EXECUTE COLS
        cToClear.forEach(c => {
            const beam = document.createElement('div');
            beam.className = 'fx-laser-beam laser-v';
            beam.style.left = (c * 48 + 12 + 22) + 'px';
            beam.style.top = '12px';
            beam.style.height = '384px';
            
            const firstCell = cells[c]; 
            const beamColor = firstCell.style.getPropertyValue('--block-color') || '#fff';
            beam.style.setProperty('--color', beamColor);
            
            gridWrapper.appendChild(beam);
            setTimeout(() => beam.remove(), 350);

            for (let r = 0; r < 8; r++) {
                const idx = r * 8 + c;
                if (rToClear.length === 0 || !intersectionIndices.has(idx)) {
                   const cell = cells[idx];
                   const color = cell.style.getPropertyValue('--block-color');
                   spawnFX(idx, color, r * 30, false);
                }
            }
        });
        
        // 5. GODLIKE FLASH
        if (combo >= 10) {
            gridWrapper.classList.add('flashbang-active');
            setTimeout(() => gridWrapper.classList.remove('flashbang-active'), 200);
        }

    });
});

// 5. Reset Cells
VisualPipe.on("reset_cells", ({ indices }) => {
    indices.forEach(idx => {
        resetCellVisuals(idx);
    });
});