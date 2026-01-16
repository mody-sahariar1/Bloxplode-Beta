// ============================================
// DEFAULT SKIN (VISUALS) - CLEANED
// ============================================

function triggerEternalHaptic(ms) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) { }
    }
}

function resetCellVisuals(idx) {
    const cell = document.querySelectorAll('.cell')[idx];
    if (cell) {
        cell.className = "cell"; 
        cell.style.removeProperty('--block-color');
        cell.style.removeProperty('--preview-color');
    }
}

// --- NEW HELPER: AUDIO PROFILE CALCULATOR ---
function getComboAudioProfile(c) {
    let profile = { basePitch: 1.00, layer: null, layerPitch: 1.00, layerVol: 1.00, layerDelay: 0 };

    // Base Pitch
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
    else if (c >= 16) profile.basePitch = 1.20; 

    // Layers
    if (c === 5 || c === 15) {
        profile.layer = 'winning_swoosh';
        profile.layerPitch = 1.00; profile.layerVol = 0.6; profile.layerDelay = 50; 
    }
    else if (c === 10 || c === 13 || c === 18) {
        profile.layer = 'victory_chime'; // NOTE: This is the COMBO version. Flight version is deleted.
        profile.layerPitch = (c === 18) ? 1.03 : 1.01; 
        profile.layerVol = 0.9; profile.layerDelay = 100; 
    }
    else if (c >= 20 && c % 5 === 0) {
        profile.layer = 'epic_victory';
        profile.layerPitch = 1.01; profile.layerVol = 0.65; profile.layerDelay = 120; 
    }
    return profile;
}

// --- VISUAL PIPE LISTENERS ---

// 1. Piece Placement Visuals
VisualPipe.on("piece_placed", ({ indices, color }) => {
    Boss.run({ priority: "high", duration: 600 }, () => {
        indices.forEach(idx => {
            const cell = document.querySelectorAll('.cell')[idx];
            if(cell) {
                cell.style.setProperty('--block-color', color);
                cell.classList.add('occupied', 'placed-impact');
                setTimeout(() => {
                    cell.classList.remove('placed-impact');
                }, 200);
            }
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
                let lower = 2;
                [2,5,8,10,13,15,18,20].forEach(t => { if(combo >= t) lower = t; });
                activeData = { text: null, color: dataMap[lower].color, audio: null }; 
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

    if (window.SoundSystem && window.SoundSystem.play) {
        const audioProfile = getComboAudioProfile(combo);
        window.SoundSystem.play('instant_win', audioProfile.basePitch, 1.0);
        if (audioProfile.layer) {
            setTimeout(() => {
                window.SoundSystem.play(audioProfile.layer, audioProfile.layerPitch, audioProfile.layerVol);
            }, audioProfile.layerDelay);
        }
    }

    if (activeData && activeData.text) {
        setTimeout(() => {
            if (activeData.audio && window.SoundSystem) {
                window.SoundSystem.play(activeData.audio, 1.0, 1.0);
            }
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

// CLEANUP: Removed "score_float" listener

// 4. Reset Cells
VisualPipe.on("reset_cells", ({ indices }) => {
    indices.forEach(idx => {
        resetCellVisuals(idx);
    });
});

// ============================================
// GEM FLIGHT & PARTICLES (VISUALS ONLY)
// ============================================

function spawnParticle(x, y, gemType) {
    const p = document.createElement('div');
    let colorClass = 'p-gold';
    if (gemType === 3) colorClass = 'p-purple';
    if (gemType === 4) colorClass = 'p-red'; // NEW

    p.className = `flight-particle ${colorClass}`;
    const size = Math.random() * 3 + 2; 
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    const offX = (Math.random() - 0.5) * 10; 
    const offY = (Math.random() - 0.5) * 10; 
    p.style.left = (x + offX) + 'px';
    p.style.top = (y + offY) + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 500); 
}

function spawnBurstParticle(x, y, gemType) {
    const p = document.createElement('div');
    let colorClass = 'p-gold';
    if (gemType === 3) colorClass = 'p-purple';
    if (gemType === 4) colorClass = 'p-red'; // NEW

    p.className = `flight-particle ${colorClass}`;
    const size = Math.random() * 4 + 3; 
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 15 + 5;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;
    p.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
    document.body.appendChild(p);
    requestAnimationFrame(() => {
        p.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
        p.style.opacity = '0';
    });
    setTimeout(() => p.remove(), 300);
}

// Listener for Gem Flight Event
VisualPipe.on("gem_flight", ({ sourceIdx, gemType, newGold, newPurple, newRed }) => {
    // --- 1. START: ONE POP PER GEM ---
    if (window.SoundSystem) window.SoundSystem.play('gem_pop');
    
    const cells = document.querySelectorAll('.cell');
    const sourceCell = cells[sourceIdx];
    
    // 1. Target Selection (UPDATED)
    let targetId = 'gold-count';
    if (gemType === 3) targetId = 'purple-count';
    if (gemType === 4) targetId = 'red-count'; // NEW
    
    const targetEl = document.getElementById(targetId);
    
    if (!sourceCell || !targetEl) return;

    // TARGETING: Aim for the .gem-icon, not the number
    const goalContainer = targetEl.parentElement; 
    const targetIcon = goalContainer.querySelector('.gem-icon') || targetEl; 

    // 1. Calculate Positions
    const startRect = sourceCell.getBoundingClientRect();
    const endRect = targetIcon.getBoundingClientRect(); 

    // 2. Create Flying Element
    let gemClass = 'gem-gold';
    if (gemType === 3) gemClass = 'gem-purple';
    if (gemType === 4) gemClass = 'gem-red'; // NEW

    const flyer = document.createElement('div');
    flyer.className = `flying-gem ${gemClass}`;
    flyer.style.width = startRect.width + 'px';
    flyer.style.height = startRect.height + 'px';
    flyer.style.left = startRect.left + 'px';
    flyer.style.top = startRect.top + 'px';
    document.body.appendChild(flyer);

    // PHASE 2: FLIGHT START
    setTimeout(() => {
        flyer.style.transform = 'scale(1.5)';
        void flyer.offsetWidth;
        flyer.classList.add('in-flight');
        const targetX = endRect.left + (endRect.width / 2) - (startRect.width / 2);
        const targetY = endRect.top + (endRect.height / 2) - (startRect.height / 2);
        flyer.style.left = targetX + 'px';
        flyer.style.top = targetY + 'px';
        flyer.style.transform = 'scale(0.6)'; 
        flyer.style.opacity = '1';

        const trailInterval = setInterval(() => {
            const rect = flyer.getBoundingClientRect();
            spawnParticle(rect.left + rect.width/2, rect.top + rect.height/2, gemType);
        }, 35);
        flyer.dataset.trailId = trailInterval;

    }, 400); 

    // PHASE 3: ARRIVAL & OBJECTIVE CHECK
    setTimeout(() => {
        if (flyer.dataset.trailId) clearInterval(parseInt(flyer.dataset.trailId));
        flyer.remove();
        
        const cx = endRect.left + endRect.width / 2;
        const cy = endRect.top + endRect.height / 2;

        // --- 1. IMPACT GLOW ON ICON ---
        if (targetIcon.classList.contains('gem-icon')) {
            targetIcon.classList.remove('impact-glow');
            void targetIcon.offsetWidth; 
            targetIcon.classList.add('impact-glow');
        }

        // --- 2. PARTICLES ---
        for(let i=0; i<12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 26 + Math.random() * 10;
            const px = cx + Math.cos(angle) * radius;
            const py = cy + Math.sin(angle) * radius;
            spawnParticle(px, py, gemType);
        }
        for(let i=0; i<12; i++) {
            spawnBurstParticle(cx, cy, gemType);
        }

        // --- 3. UI UPDATE (WITH MORPH LOGIC) ---
        let newValue = newGold;
        if (gemType === 3) newValue = newPurple;
        if (gemType === 4) newValue = newRed; // NEW

        if (targetEl) {
            // Check if objective is complete (0)
            if (newValue <= 0) {
                // If not already showing a tick, perform the MORPH
                if (!goalContainer.querySelector('.goal-tick-container')) {
                    
                    // A. Trigger Holy Glow on Icon
                    if (targetIcon) targetIcon.classList.add('holy-glow');

                    // B. Animate Number Out
                    targetEl.classList.add('score-exit');
                    
                    // C. Spawn Tick after number rotates away
                    setTimeout(() => {
                        targetEl.style.display = 'none'; // Hide the number
                        
                        const tickCont = document.createElement('div');
                        tickCont.className = 'goal-tick-container';
                        
                        // Neon Tick SVG
                        tickCont.innerHTML = `
                            <svg class="goal-tick-svg" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                            <div class="tick-ripple"></div>
                        `;
                        
                        goalContainer.appendChild(tickCont);

                        // Trigger animations
                        const svg = tickCont.querySelector('.goal-tick-svg');
                        const ripple = tickCont.querySelector('.tick-ripple');
                        
                        requestAnimationFrame(() => {
                            svg.classList.add('tick-slam');
                            ripple.classList.add('ripple-fire');
                        });
                        
                    }, 300); // Wait for score-exit to half-finish
                }
            } else {
                // Standard update
                targetEl.textContent = newValue;
            }
        }
        
        // Pulse the container
        if (goalContainer) {
            goalContainer.classList.remove('pulse');
            void goalContainer.offsetWidth; 
            goalContainer.classList.add('pulse');
        }

        // --- 4. END: ONE COLLECT SOUND PER GEM ---
        // This plays exactly when the gem hits the scoreboard
        if (window.SoundSystem) window.SoundSystem.play('gem_collect');

    }, 800); 
});

// 5. Clear Animation (NEON SNAP)
VisualPipe.on("clear_anim", ({ rToClear, cToClear, combo }) => {
    Boss.run({ priority: "high", duration: 50 }, () => {
        const gridWrapper = document.getElementById('grid-wrapper');
        const cells = document.querySelectorAll('.cell'); 
        const isMulti = (rToClear.length + cToClear.length) > 1;
        const intersectionIndices = new Set();
        
        if (isMulti) {
            rToClear.forEach(r => {
                cToClear.forEach(c => {
                    intersectionIndices.add(r * 8 + c);
                });
            });
        }

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
        
        if (combo >= 10) {
            gridWrapper.classList.add('flashbang-active');
            setTimeout(() => gridWrapper.classList.remove('flashbang-active'), 200);
        }
    });
});

// 7. LEVEL COMPLETION TEXT
VisualPipe.on("level_complete", () => {
    const layer = document.getElementById("victory-ui-layer");
    const vButtons = document.getElementById("victory-buttons");
    const msgContainer = document.querySelector(".victory-message");
    
    const wLevel = document.querySelector(".word-level-vic");
    const wCleared = document.querySelector(".word-cleared-vic");

    if (!layer) return;

    setTimeout(() => {
        layer.classList.remove("hidden");
        if (wLevel) {
            wLevel.classList.remove("active");
            void wLevel.offsetWidth;
            wLevel.classList.add("active");
        }
        if (wCleared) {
            wCleared.classList.remove("active");
            void wCleared.offsetWidth;
            wCleared.classList.add("active");
        }
    }, 400);
    
    setTimeout(() => {
        if (msgContainer) msgContainer.classList.add("fading");
    }, 2000);

    if (vButtons) {
        vButtons.classList.remove("active");
        void vButtons.offsetWidth;
        vButtons.classList.add("active");
    }
});

// 6. FIREWORKS
VisualPipe.on("level_complete", () => {
    const container = document.getElementById("victory-fireworks");
    if (!container) return;

    setTimeout(() => {
        if (window.SoundSystem) {
             window.SoundSystem.play('gameover_best');
        }

        const FIREWORK_COLORS = ['#FFD700', '#FF4444', '#44FF44', '#00FFFF', '#FF00FF', '#FF8C00', '#FFFFFF'];
        const ROCKET_COUNT = 15;

        for (let i = 0; i < ROCKET_COUNT; i++) {
            setTimeout(() => {
                const rocket = document.createElement("div");
                rocket.className = "firework-rocket";
                
                rocket.style.left = `${Math.random() * 80 + 10}%`;
                const heightVh = -(Math.random() * 25 + 50); 
                rocket.style.setProperty('--target-y', `${heightVh}vh`);

                container.appendChild(rocket);
                const burstColor = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];

                rocket.addEventListener("animationend", () => {
                    const rect = rocket.getBoundingClientRect();
                    for (let p = 0; p < 24; p++) {
                        const particle = document.createElement("div");
                        particle.className = "firework-particle";
                        particle.style.backgroundColor = burstColor;
                        particle.style.boxShadow = `0 0 10px ${burstColor}`;
                        const angle = Math.random() * Math.PI * 2;
                        const distance = Math.random() * 100 + 40; 
                        particle.style.left = rect.left + "px";
                        particle.style.top  = rect.top + "px";
                        particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
                        particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
                        container.appendChild(particle);
                        particle.addEventListener("animationend", () => particle.remove());
                    }
                    rocket.remove();
                });
            }, i * 100); 
        }
    }, 500); 
});

// STEP 2: VICTORY DIM LISTENER
VisualPipe.on("level_complete", () => {
    const dim = document.getElementById("victory-dim");
    if (!dim) return;
    
    dim.classList.remove("hidden");
    void dim.offsetWidth; 
    dim.classList.add("active");
});


// ============================================
// UI CLEANUP HELPER (Manual listeners for Retries)
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const resetUI = () => {
        // Remove all ticks
        document.querySelectorAll('.goal-tick-container').forEach(el => el.remove());
        // Remove Holy Glows
        document.querySelectorAll('.gem-icon.holy-glow').forEach(el => el.classList.remove('holy-glow'));
        // Restore numbers (UPDATED: Added red-count)
        document.querySelectorAll('#gold-count, #purple-count, #red-count').forEach(el => {
            el.style.display = 'block';
            el.classList.remove('score-exit');
        });
    };

    const retryBtn = document.getElementById("btn-retry");
    if (retryBtn) retryBtn.addEventListener('click', resetUI);

    const nextBtn = document.getElementById("vic-btn-next");
    if (nextBtn) nextBtn.addEventListener('click', resetUI);
});