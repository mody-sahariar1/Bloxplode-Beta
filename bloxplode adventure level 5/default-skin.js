// ============================================
// DEFAULT SKIN (VISUALS) - COMPLETE MERGED
// ============================================

// --- STATE SAFETY FLAGS ---
let isClearConfirmationInProgress = false; // Prevents overlapping confirmations

function triggerEternalHaptic(ms) {
    if (navigator.vibrate) {
        try { navigator.vibrate(ms); } catch (e) { }
    }
}

// --- NEW HELPER: AUDIO PROFILE CALCULATOR ---
function getComboAudioProfile(c) {
    let p = { basePitch: 1.00, layer: null, layerPitch: 1.00, layerVol: 1.00, layerDelay: 0 };
    // Pitch Logic
    if (c===2) p.basePitch=1.04; else if (c===3) p.basePitch=1.06; else if (c===4) p.basePitch=1.08;
    else if (c===5) p.basePitch=1.10; else if (c>=6 && c<=7) p.basePitch=1.12; else if (c===8) p.basePitch=1.14;
    else if (c===9) p.basePitch=1.15; else if (c===10) p.basePitch=1.16; else if (c>=11) p.basePitch=1.17;
    
    // Layer Logic
    if (c===5 || c===15) { p.layer='winning_swoosh'; p.layerVol=0.6; p.layerDelay=50; }
    else if (c===10 || c===13 || c===18) { p.layer='victory_chime'; p.layerPitch=(c===18?1.03:1.01); p.layerVol=0.9; p.layerDelay=100; }
    else if (c>=20 && c%5===0) { p.layer='epic_victory'; p.layerPitch=1.01; p.layerVol=0.65; p.layerDelay=120; }
    return p;
}

function triggerFloatingScore(pointValue, sourceCell) {
    // --------------------------------------------------
    // STEP 4: CONFIRMATION LOCK
    // --------------------------------------------------
    if (isClearConfirmationInProgress) {
        return; 
    }
    
    // Lock the pipeline
    isClearConfirmationInProgress = true;

    const floatingEl = document.createElement('div');
    floatingEl.className = 'floating-score';
    floatingEl.textContent = "+" + pointValue;

    // 1. Get Start Position (Grid Cell)
    const startRect = sourceCell.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;

    // 2. TARGET THE CAPSULE (Left Capsule = Scoreboard)
    const targetEl = document.getElementById('progress-traveler');
    
    if (!targetEl) {
        console.warn("Floating Score Error: Target #progress-traveler not found.");
        isClearConfirmationInProgress = false; 
        return; 
    }

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

    // 3. COMPLETION LOGIC (LOCKED & BATCHED)
    setTimeout(() => {
        // A) FLUSH PENDING SCORE
        if (typeof pendingClearScore !== 'undefined' && pendingClearScore > 0) {
            // Transfer TOTAL pending to confirmed
            confirmedScore += pendingClearScore;
            // Reset pending immediately
            pendingClearScore = 0; 

            // B) UPDATE UI (Left Capsule Only)
            if (typeof updateScoreUI === 'function') {
                updateScoreUI(true); // PASS 'TRUE' TO TRIGGER IMPACT
            }
        }
        // C) CLEANUP
        if (floatingEl.parentNode) floatingEl.remove();
        // D) RELEASE LOCK
        isClearConfirmationInProgress = false;
    }, 1000); // Sync with CSS animation duration
}

function resetCellVisuals(idx) {
    const cell = cells[idx];
    cell.className = "cell"; 
    cell.style.removeProperty('--block-color');
    // GHOST REMOVAL: Removed --preview-color reset
}

// --- VISUAL PIPE LISTENERS ---

// 1. PIECE PLACED (THE FLASH)
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

// 2. CLEAR FEEDBACK (HAPTICS + V4 STYLE POPUP)
VisualPipe.on("clear_feedback", ({ combo }) => {
    
    // A. Haptics & Shake (Standard)
    let hapticDuration = 50;
    if (combo >= 5) hapticDuration = 80;
    triggerEternalHaptic(hapticDuration);

    // B. Strict Cleanup of Old Popups
    document.querySelectorAll('.combo-popup, .reinforcement-banner').forEach(node => node.remove());

    // C. Define Tiers (Same Logic, New V4 Visuals)
    // AUDIO MAPPING ADDED TO TIERS
    const tiers = {
        2:  { text: "NICE",      color: "#00d2d3", audio: 'combo_2' },
        5:  { text: "SWEET",     color: "#ff9ff3", audio: 'combo_5' },
        8:  { text: "GREAT",     color: "#54a0ff", audio: 'combo_8' },
        10: { text: "AMAZING",   color: "#feca57", audio: 'combo_10' },
        13: { text: "UNREAL",    color: "#5f27cd", audio: 'combo_13' },
        15: { text: "INSANE",    color: "#ff6b6b", audio: 'combo_15' },
        18: { text: "LEGENDARY", color: "#f1c40f", audio: 'combo_18' },
        20: { text: "GODLIKE",   color: "#00ffcc", audio: 'combo_20' }
    };

    let targetKey = null;
    let audioKey = null;
    
    if (combo <= 20) {
        if (tiers[combo]) targetKey = combo;
    } else {
        const loopTiers = [15, 18, 20];
        const loopIndex = (combo - 21) % loopTiers.length;
        targetKey = loopTiers[loopIndex];
    }

    // Default white if no match (e.g. combo 3, 4, 6)
    let text = "";
    let color = "#FFFFFF";
    
    if (targetKey !== null) {
        text = tiers[targetKey].text;
        color = tiers[targetKey].color;
        audioKey = tiers[targetKey].audio;
    } else {
        // Fallback for non-tier combos to keep color continuity
        // Find closest lower tier color
        let lower = 2;
        [2,5,8,10,13,15,18,20].forEach(t => { if(combo >= t) lower = t; });
        if(tiers[lower]) color = tiers[lower].color;
    }

    const gridWrapper = document.getElementById('grid-wrapper');

    // D. COMBO POPUP (Visuals)
    const popup = document.createElement('div');
    popup.className = 'combo-popup';
    popup.style.setProperty('--combo-color', color);
    
    // Apply Shake Classes based on combo
    if (combo >= 15) popup.classList.add('shake-3');
    else if (combo >= 10) popup.classList.add('shake-2');
    else if (combo >= 5) popup.classList.add('shake-1');
    
    const label = document.createElement('div');
    label.className = 'combo-label';
    label.textContent = "COMBO";
    
    const value = document.createElement('div');
    value.className = 'combo-value';
    value.textContent = "x" + combo;

    popup.appendChild(label);
    popup.appendChild(value);
    gridWrapper.appendChild(popup);
    
    // Cleanup Popup
    setTimeout(() => { if(popup.parentNode) popup.remove(); }, 980);

    // --- AUDIO TRIGGER: CLEAR ---
    if (window.SoundSystem && window.SoundSystem.play) {
        const audioProfile = getComboAudioProfile(combo);
        window.SoundSystem.play('instant_win', audioProfile.basePitch, 1.0);
        if (audioProfile.layer) {
            setTimeout(() => {
                window.SoundSystem.play(audioProfile.layer, audioProfile.layerPitch, audioProfile.layerVol);
            }, audioProfile.layerDelay);
        }
    }

    // E. TEXT BANNER (Visuals) & VOICE AUDIO
    if (text) {
        // Delay 700ms to match the rhythm
        setTimeout(() => {
            // AUDIO VOICE TRIGGER
            if (audioKey && window.SoundSystem) {
                window.SoundSystem.play(audioKey, 1.0, 1.0);
            }

            const banner = document.createElement('div');
            banner.className = 'reinforcement-banner';
            banner.style.setProperty('--combo-color', color);
            
            const bannerText = document.createElement('div');
            bannerText.className = 'banner-text';
            bannerText.textContent = text;
            
            banner.appendChild(bannerText);
            gridWrapper.appendChild(banner);
            
            // Cleanup Banner
            setTimeout(() => { if(banner.parentNode) banner.remove(); }, 850); 
        }, 700);
    }
});

// 3. SCORE FLOAT (NUMBERS)
VisualPipe.on("score_float", ({ points, targetIndex }) => {
    Boss.run({ priority: "high", duration: 1000 }, () => {
        const targetCell = cells[targetIndex];
        triggerFloatingScore(points, targetCell);
    });
});

// 4. Clear Animation (NEON SNAP - MOBILE FIXED) [REPLACED 1:1]
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

// 6. FIREWORKS (ROCKETS) - DELAYED
VisualPipe.on("level_complete", () => {
    const container = document.getElementById("victory-fireworks");
    if (!container) return;

    // AUDIO: Play Best Score / Victory Sound
    if (window.SoundSystem) {
         window.SoundSystem.play('gameover_best');
    }

    // DELAY: 500ms (Wait for text impact)
    setTimeout(() => {
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
    }, 500); // <--- 500ms Delay applied here
});

// 7. LEVEL COMPLETION TEXT (UPDATED SEQUENCE)
VisualPipe.on("level_complete", () => {
    const layer = document.getElementById("victory-ui-layer");
    const vButtons = document.getElementById("victory-buttons");
    const msgContainer = document.querySelector(".victory-message");
    
    const wLevel = document.querySelector(".word-level-vic");
    const wCleared = document.querySelector(".word-cleared-vic");

    if (!layer) return;

    // 1. Reveal Layer (Wait 400ms for dim)
    setTimeout(() => {
        layer.classList.remove("hidden");
        
        // 2. Trigger Stamps (LEVEL ... CLEARED!)
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
    
    // 3. Trigger Fade Out of Text (At 2.0s)
    setTimeout(() => {
        if (msgContainer) msgContainer.classList.add("fading");
    }, 2000);

    // 4. Trigger Buttons (Managed via CSS delay of 2.5s)
    if (vButtons) {
        vButtons.classList.remove("active");
        void vButtons.offsetWidth;
        vButtons.classList.add("active");
    }
});

// 8. Reset Cells
VisualPipe.on("reset_cells", ({ indices }) => {
    indices.forEach(idx => {
        resetCellVisuals(idx);
    });
});

// 9. LEVEL START ANIMATION (FINAL: Zero-Latency + High Impact VFX)
VisualPipe.on("level_start_anim", () => {
    const startIcon = document.getElementById('start-target-icon');
    const startText = document.getElementById('start-target-text'); 
    const targetSlot = document.getElementById('progress-target');
    const targetVal = document.getElementById('target-val'); 
    const overlay = document.getElementById('level-start-overlay');
    const banner = document.getElementById('start-banner');  

    if (!startIcon || !targetSlot) {
        if (overlay) overlay.classList.add('hidden');
        if (targetVal) targetVal.style.opacity = '1'; 
        return;
    }

    // STEP 1: CAPTURE COORDINATES
    const startRect = startIcon.getBoundingClientRect();
    const targetRect = targetSlot.getBoundingClientRect();
    
    const targetStyle = window.getComputedStyle(targetSlot);
    const targetTextStyle = window.getComputedStyle(targetVal);

    // STEP 2: THE GHOST SWAP
    const ghost = startIcon.cloneNode(true);
    ghost.id = 'flying-ghost-pill';
    ghost.classList.add('flying-pill-ghost');
    
    ghost.style.left = `${startRect.left}px`;
    ghost.style.top = `${startRect.top}px`;
    ghost.style.width = `${startRect.width}px`;
    ghost.style.height = `${startRect.height}px`;
    ghost.style.padding = window.getComputedStyle(startIcon).padding;

    const computedStyle = window.getComputedStyle(startIcon);
    ghost.style.backgroundColor = computedStyle.backgroundColor;
    ghost.style.borderRadius = computedStyle.borderRadius;
    ghost.style.display = 'flex';
    ghost.style.alignItems = 'center';
    ghost.style.justifyContent = 'center';
    
    const ghostText = ghost.querySelector('span');
    if (ghostText) {
        ghostText.style.fontSize = window.getComputedStyle(startText).fontSize;
        ghostText.style.transition = "font-size 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)"; 
    }

    document.body.appendChild(ghost);
    startIcon.style.opacity = '0';
    
    // STORE DATA
    ghost.dataset.destW = targetRect.width;
    ghost.dataset.destH = targetRect.height;
    ghost.dataset.destX = targetRect.left; 
    ghost.dataset.destY = targetRect.top;
    
    ghost.dataset.destP = targetStyle.padding;
    ghost.dataset.destR = targetStyle.borderRadius;
    ghost.dataset.destFS = targetTextStyle.fontSize;

    // STEP 3: THE FLIGHT (0.8s)
    setTimeout(() => {
        const destLeft = parseFloat(ghost.dataset.destX);
        const destTop = parseFloat(ghost.dataset.destY);
        const destW = parseFloat(ghost.dataset.destW);
        const destH = parseFloat(ghost.dataset.destH);
        
        const currentLeft = startRect.left;
        const currentTop = startRect.top;
        
        const tx = destLeft - currentLeft;
        const ty = destTop - currentTop;

        ghost.style.transition = `
            transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), 
            width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), 
            height 0.8s cubic-bezier(0.2, 0.8, 0.2, 1),
            border-radius 0.8s ease,
            padding 0.8s ease
        `;
        
        ghost.style.transform = `translate(${tx}px, ${ty}px)`;
        ghost.style.width = `${destW}px`;
        ghost.style.height = `${destH}px`;
        ghost.style.padding = ghost.dataset.destP;
        ghost.style.borderRadius = ghost.dataset.destR;
        
        if (ghostText) {
            ghostText.style.fontSize = ghost.dataset.destFS;
        }

        // CURTAIN SPLIT
        if (banner) {
            banner.style.animation = 'none'; 
            banner.style.clipPath = 'polygon(0% 0%, 0% 100%, 50% 100%, 50% 0%, 50% 0%, 50% 100%, 100% 100%, 100% 0%)';
            banner.style.webkitClipPath = 'polygon(0% 0%, 0% 100%, 50% 100%, 50% 0%, 50% 0%, 50% 100%, 100% 100%, 100% 0%)';
            void banner.offsetWidth; 
            banner.style.transition = "clip-path 0.5s cubic-bezier(0.4, 0.0, 0.2, 1), -webkit-clip-path 0.5s cubic-bezier(0.4, 0.0, 0.2, 1)";
            const splitState = 'polygon(0% 0%, 0% 100%, 0% 100%, 0% 0%, 100% 0%, 100% 100%, 100% 100%, 100% 0%)';
            banner.style.clipPath = splitState;
            banner.style.webkitClipPath = splitState;
        }

    }, 50);

    // STEP 4: IMPACT LANDING
    setTimeout(() => {
        ghost.remove();

        // Reveal Text
        if (targetVal) {
            targetVal.style.transition = "opacity 0.1s ease-out";
            targetVal.style.opacity = '1';
        }

        // Target Flash/Pop
        if (targetSlot) {
            targetSlot.style.transition = "transform 0.1s ease-out, filter 0.1s ease-out";
            targetSlot.style.transform = "scale(1.2)"; 
            targetSlot.style.filter = "brightness(2.0)"; // SUPER BRIGHT FLASH
            setTimeout(() => {
                targetSlot.style.transform = "scale(1)";
                targetSlot.style.filter = "brightness(1)";
            }, 200);
        }

        // --- NEW IMPACT VISUALS ---
        const container = document.body;
        const centerX = targetRect.left + (targetRect.width / 2);
        const centerY = targetRect.top + (targetRect.height / 2);

        // A. SHOCKWAVE RING (The "Concussion")
        const ring = document.createElement('div');
        ring.style.position = 'fixed';
        ring.style.left = `${centerX}px`;
        ring.style.top = `${centerY}px`;
        ring.style.width = '0px';
        ring.style.height = '0px';
        ring.style.border = '3px solid rgba(255, 255, 255, 0.8)';
        ring.style.borderRadius = '50%';
        ring.style.transform = 'translate(-50%, -50%)';
        ring.style.zIndex = '27000'; // Above ghost/overlay
        ring.style.pointerEvents = 'none';
        ring.style.transition = 'all 0.4s cubic-bezier(0.1, 0.9, 0.2, 1)';
        container.appendChild(ring);

        // Expand Ring
        requestAnimationFrame(() => {
            ring.style.width = '120px';
            ring.style.height = '120px';
            ring.style.borderWidth = '0px';
            ring.style.opacity = '0';
        });
        setTimeout(() => ring.remove(), 400);

        // B. HIGH VELOCITY SPARKS (The "Shatter")
        const sparkColors = ['#FFFFFF', '#9BFF6A', '#00FFFF']; 
        
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement("div");
            particle.className = "firework-particle"; 
            
            // Random styling for chaos
            const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
            particle.style.backgroundColor = color;
            particle.style.boxShadow = `0 0 4px ${color}`;
            particle.style.width = Math.random() < 0.5 ? '4px' : '2px';
            particle.style.height = particle.style.width;
            particle.style.zIndex = '27000';
            
            particle.style.left = `${centerX}px`;
            particle.style.top = `${centerY}px`;
            
            // Explosive Physics
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 60 + 30; // Much faster
            const dx = Math.cos(angle) * velocity;
            const dy = Math.sin(angle) * velocity;
            
            particle.style.setProperty("--dx", `${dx}px`);
            particle.style.setProperty("--dy", `${dy}px`);
            
            // CRITICAL: Force fast duration (300-500ms) for impact feel
            particle.style.animationDuration = `${Math.random() * 200 + 300}ms`;
            
            container.appendChild(particle);
            particle.addEventListener("animationend", () => particle.remove());
        }

        // Hide Overlay
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.classList.add('hidden');
                if (window.SoundSystem) window.SoundSystem.play('victory_chime', 2.0, 0.5); 
            }, 300);
        }
        
    }, 850); 
});