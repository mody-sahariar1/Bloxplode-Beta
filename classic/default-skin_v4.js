// ============================================
// DEFAULT SKIN (VISUALS) - FIXED MOBILE SCALING
// ============================================

// --- HELPERS ---

function triggerEternalHaptic(ms) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) { }
    }
}

// ... [Existing triggerFloatingScore function remains unchanged] ...
function triggerFloatingScore(pointValue, sourceCell) {
    const floatingEl = document.createElement('div');
    floatingEl.className = 'floating-score';
    floatingEl.textContent = "+" + pointValue;

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

// --- NEW HELPER: AUDIO PROFILE CALCULATOR ---
// Determines the "Base Pitch" and any "Layered Sound" based on strict rules.
function getComboAudioProfile(c) {
    // Default Profile (Standard Hit)
    let profile = {
        basePitch: 1.00,
        layer: null,       // 'winning_swoosh', 'victory_chime', 'epic_victory'
        layerPitch: 1.00,
        layerVol: 1.00,
        layerDelay: 0
    };

    // --- STEP 1: CALCULATE BASE PITCH (instant_win.wav) ---
    // Rule: Never exceed 1.20
    if (c === 1) profile.basePitch = 1.00;
    else if (c === 2) profile.basePitch = 1.04;
    else if (c === 3) profile.basePitch = 1.06;
    else if (c === 4) profile.basePitch = 1.08;
    else if (c === 5) profile.basePitch = 1.10;
    else if (c >= 6 && c <= 7) profile.basePitch = 1.12;
    else if (c === 8) profile.basePitch = 1.14;
    else if (c === 9) profile.basePitch = 1.15;
    else if (c === 10) profile.basePitch = 1.16;
    else if (c >= 11 && c <= 12) profile.basePitch = 1.17;
    else if (c === 13) profile.basePitch = 1.18;
    else if (c === 14) profile.basePitch = 1.19;
    else if (c === 15) profile.basePitch = 1.19;
    else if (c >= 16) profile.basePitch = 1.20; // LOCKED MAX

    // --- STEP 2: DETERMINE LAYERS (The "Premium" Feel) ---
    
    // A. SWOOSHES (Transitions)
    if (c === 5 || c === 15) {
        profile.layer = 'winning_swoosh';
        profile.layerPitch = 1.00;
        profile.layerVol = 0.6; // Quiet accent
        profile.layerDelay = 50; // Slight offset
    }

    // B. CHIMES (Milestones)
    else if (c === 10 || c === 13 || c === 18) {
        profile.layer = 'victory_chime';
        profile.layerPitch = (c === 18) ? 1.03 : 1.01; // Slight variance
        profile.layerVol = 0.9;
        profile.layerDelay = 100; // Let the impact hit first
    }

    // C. GODLIKE STATE (20+) - RARE PRESTIGE
    // Rule: Every 5th combo starting at 20 (20, 25, 30...)
    else if (c >= 20 && c % 5 === 0) {
        profile.layer = 'epic_victory';
        profile.layerPitch = 1.01; // Almost no pitch shift
        profile.layerVol = 0.65;   // Don't overpower the hit
        profile.layerDelay = 120;  // Distinct separation
    }

    return profile;
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

// 2. Clear Feedback (UPDATED FOR NEW AUDIO SYSTEM + VOICES)
VisualPipe.on("clear_feedback", ({ combo }) => {
    
    // A. Haptics & Shake (Standard)
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

    // B. VISUAL DATA MAP (RESTORED AUDIO KEYS)
    const dataMap = {
        2:  { text: "NICE!", color: "#00d2d3", audio: 'combo_2' },
        5:  { text: "SWEET!", color: "#ff9ff3", audio: 'combo_5' },
        8:  { text: "GREAT!", color: "#54a0ff", audio: 'combo_8' },
        10: { text: "AMAZING!", color: "#feca57", audio: 'combo_10' },
        13: { text: "UNREAL!", color: "#5f27cd", audio: 'combo_13' },
        15: { text: "INSANE!", color: "#ff6b6b", audio: 'combo_15' },
        18: { text: "LEGENDARY!", color: "#f1c40f", audio: 'combo_18' },
        20: { text: "GODLIKE!", color: "#00ffcc", audio: 'combo_20' }
    };

    let activeData = null;
    if (combo >= 2) {
        if (combo <= 20) {
            if (dataMap[combo]) activeData = dataMap[combo];
            else {
                // Gap fill color (Keep color, but no text/audio)
                let lower = 2;
                [2,5,8,10,13,15,18,20].forEach(t => { if(combo >= t) lower = t; });
                activeData = { text: null, color: dataMap[lower].color, audio: null }; 
            }
        } else {
            // Loop for > 20
            const loopTiers = [15, 18, 20];
            const loopIndex = (combo - 21) % loopTiers.length;
            activeData = dataMap[loopTiers[loopIndex]];
        }
    }
    const displayColor = activeData ? activeData.color : "#ffffff";

    // C. COMBO POPUP (Visuals)
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

    // D. MUSIC EXECUTION (The Premium Layer - T=0ms)
    if (window.SoundSystem && window.SoundSystem.play) {
        const audioProfile = getComboAudioProfile(combo);
        
        // 1. Play Base (Instant Win)
        window.SoundSystem.play('instant_win', audioProfile.basePitch, 1.0);

        // 2. Play Layer (Swoosh/Chime/Epic)
        if (audioProfile.layer) {
            setTimeout(() => {
                window.SoundSystem.play(
                    audioProfile.layer, 
                    audioProfile.layerPitch, 
                    audioProfile.layerVol
                );
            }, audioProfile.layerDelay);
        }
    }

    // E. TEXT BANNER & VOICE (Visuals + Spoken Word)
    if (activeData && activeData.text) {
        setTimeout(() => {
            // 1. PLAY VOICE (If exists) - "NICE!", "SWEET!"
            if (activeData.audio && window.SoundSystem) {
                // We play the voice at standard pitch so it doesn't sound chipmunky
                window.SoundSystem.play(activeData.audio, 1.0, 1.0);
            }

            // 2. SHOW VISUALS
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

        // 2. HELPER: Spawn FX
        const spawnFX = (idx, color, delayMs, isIntersect) => {
            const r = Math.floor(idx / 8);
            const c = idx % 8;
            
            const relLeft = (c * 48) + 12;
            const relTop  = (r * 48) + 12;

            setTimeout(() => {
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

                let sparkCount = combo > 5 ? 6 : 3;
                if (isMulti) sparkCount *= 1.5;
                if (isIntersect) sparkCount = 12;

                for (let i = 0; i < sparkCount; i++) {
                    const spark = document.createElement('div');
                    spark.className = 'fx-spark';
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