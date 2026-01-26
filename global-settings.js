/* =========================================================
   UNIVERSAL SETTINGS MODULE - AUDIO CORE V2
   Fixes: Background Sleep, Resume delays, Cross-page sync
   PLUS: Global Navigation Fixes
   PLUS: Sound Cut-off Fix & Rapid Fire Support
   PLUS: HAPTIC FEEDBACK (25ms)
   PLUS: HEARTBEAT SLEEP FIX (Breathing Sound Stops on Minimize)
   ========================================================= */

(function() {
    // --- 1. CONFIGURATION ---
    const STORAGE = {
        SFX: 'blox_sfx_enabled',
        BGM: 'blox_bgm_enabled',
        HAPTIC: 'blox_haptic_enabled',
        BGM_TIME: 'blox_bgm_timestamp', 
        BGM_TRACK: 'blox_bgm_track'     
    };

    const state = {
        sfx: localStorage.getItem(STORAGE.SFX) !== 'false',
        bgm: localStorage.getItem(STORAGE.BGM) !== 'false',
        haptic: localStorage.getItem(STORAGE.HAPTIC) !== 'false'
    };

    // --- HELPER: DELAYED NAVIGATION (Prevents Sound Cut-off) ---
    function navigateWithSound(url) {
        UI_CLICK_SOUND.play();
        // Wait 250ms for sound to finish, then go
        setTimeout(() => {
            window.location.href = url;
        }, 250);
    }

    // --- HELPER: CLONE & REPLACE (Fixes Level Buttons) ---
    function replaceButtonWithSound(originalBtn, clickAction) {
        if (!originalBtn) return;
        const newBtn = originalBtn.cloneNode(true);
        originalBtn.parentNode.replaceChild(newBtn, originalBtn);
        newBtn.onclick = (e) => {
            e.preventDefault();
            clickAction();
        };
    }

    // --- 2. INJECT HTML (UI) ---
    function injectSettingsUI() {
        const gearBtn = document.createElement('div');
        gearBtn.id = 'universal-gear-btn';
        gearBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.49l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12-0.61l1.92,3.32c0.12-0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
        document.body.appendChild(gearBtn);

        if (document.getElementById('main-menu')) {
            gearBtn.style.display = 'none';
        }

        const modal = document.createElement('div');
        modal.id = 'us-overlay';
        modal.innerHTML = `
            <div class="us-modal">
                <div class="us-header">
                    <div class="us-title"><span>⚙️</span> SETTINGS</div>
                    <button class="us-close-btn">&times;</button>
                </div>
                <div class="us-body">
                    <div class="us-row">
                        <div class="us-label"><span class="us-icon">🔊</span> SOUND</div>
                        <label class="us-switch"><input type="checkbox" id="us-toggle-sfx" ${state.sfx ? 'checked' : ''}><span class="us-slider"></span></label>
                    </div>
                    <div class="us-row">
                        <div class="us-label"><span class="us-icon">🎵</span> BGM</div>
                        <label class="us-switch"><input type="checkbox" id="us-toggle-bgm" ${state.bgm ? 'checked' : ''}><span class="us-slider"></span></label>
                    </div>
                    <div class="us-row">
                        <div class="us-label"><span class="us-icon">📳</span> HAPTICS</div>
                        <label class="us-switch"><input type="checkbox" id="us-toggle-haptic" ${state.haptic ? 'checked' : ''}><span class="us-slider"></span></label>
                    </div>
                    <div class="us-actions">
                        <button class="us-btn btn-green" id="us-btn-home"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>HOME</button>
                        <button class="us-btn btn-green" id="us-btn-restart"><svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>RESTART</button>
                    </div>
                    <div class="us-footer">V 1.0.0 • BLOXPLODE</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Events
        gearBtn.addEventListener('click', () => modal.classList.add('active'));
        modal.querySelector('.us-close-btn').addEventListener('click', () => modal.classList.remove('active'));
        
        // --- SOUND TOGGLE ---
        document.getElementById('us-toggle-sfx').addEventListener('change', (e) => {
            state.sfx = e.target.checked;
            localStorage.setItem(STORAGE.SFX, state.sfx);
            UI_CLICK_SOUND.play(true); 
        });

        document.getElementById('us-toggle-bgm').addEventListener('change', (e) => {
            state.bgm = e.target.checked;
            localStorage.setItem(STORAGE.BGM, state.bgm);
            applyMusicState(); 
        });
        document.getElementById('us-toggle-haptic').addEventListener('change', (e) => {
            state.haptic = e.target.checked;
            localStorage.setItem(STORAGE.HAPTIC, state.haptic);
        });
        
        // RESTART with Delay
        document.getElementById('us-btn-restart').addEventListener('click', () => {
             UI_CLICK_SOUND.play();
             setTimeout(() => window.location.reload(), 250);
        });
        
        // SETTINGS HOME BUTTON
        document.getElementById('us-btn-home').addEventListener('click', () => {
            const isSubfolder = window.location.pathname.includes('level') || window.location.pathname.includes('classic');
            const targetURL = isSubfolder ? '../index.html' : 'index.html';
            navigateWithSound(targetURL); 
        });
    }

    // --- 3. SYSTEM HOOKS & FIXES ---
    function hookSoundSystem() {
        if (!window.SoundSystem) { setTimeout(hookSoundSystem, 100); return; }

        const originalPlay = window.SoundSystem.play;
        window.SoundSystem.play = function(name, pitch, volume) {
            if (state.sfx) originalPlay.call(window.SoundSystem, name, pitch, volume);
        };

        const originalPlayMusic = window.SoundSystem.playMusic;
        window.SoundSystem.playMusic = function(name) {
            originalPlayMusic.call(window.SoundSystem, name);
            applyMusicState();
            
            const savedTime = parseFloat(sessionStorage.getItem(STORAGE.BGM_TIME));
            if (savedTime && window.SoundSystem.bgmSource && window.SoundSystem.ctx) {
                 // Future Sync Logic
            }
        };

        const unlockAudio = () => {
            if (window.SoundSystem.ctx && window.SoundSystem.ctx.state === 'suspended') {
                window.SoundSystem.ctx.resume().then(() => {
                    console.log("Audio Context Resumed/Unlocked");
                    applyMusicState();
                });
            }
        };
        window.addEventListener('touchstart', unlockAudio, { passive: true });
        window.addEventListener('click', unlockAudio, { passive: true });
        
        applyMusicState();
    }

    // --- 4. VISIBILITY API (FIXED FOR HEARTBEAT SLEEP) ---
    function initVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!window.SoundSystem || !window.SoundSystem.ctx) return;

            if (document.hidden) {
                // 1. Suspend Audio Context (Stops BGM)
                window.SoundSystem.ctx.suspend(); 
                
                // 2. FORCE STOP HEARTBEAT (Stops Breathing Sound immediately)
                if (window.SoundSystem.stopHeartbeat) {
                    window.SoundSystem.stopHeartbeat();
                }
            } else {
                // 3. Resume Audio
                window.SoundSystem.ctx.resume().then(() => {
                    applyMusicState(); 
                    
                    // 4. CHECK IF WE NEED TO RESTART HEARTBEAT
                    // Only restart if the 'combo-active' state is still on the body
                    if (document.body.classList.contains('combo-active')) {
                        if (window.SoundSystem.startHeartbeat) {
                            window.SoundSystem.startHeartbeat();
                        }
                    }
                });
            }
        });
    }

    // --- 5. PAGE EXIT ---
    function initSeamlessHandoff() {
        window.addEventListener('beforeunload', () => {
            if (window.SoundSystem && window.SoundSystem.ctx) {
                // Placeholder
            }
        });
    }

    function applyMusicState() {
        if (!window.SoundSystem || !window.SoundSystem.bgmGain) return;
        
        if (state.bgm) {
            const now = window.SoundSystem.ctx.currentTime;
            window.SoundSystem.bgmGain.gain.cancelScheduledValues(now);
            window.SoundSystem.bgmGain.gain.setValueAtTime(window.SoundSystem.bgmGain.gain.value, now);
            window.SoundSystem.bgmGain.gain.linearRampToValueAtTime(0.18, now + 0.5); 
            
            if (window.SoundSystem.ctx.state === 'suspended') window.SoundSystem.ctx.resume();
        } else {
            window.SoundSystem.bgmGain.gain.value = 0;
        }
    }

    // --- 6. NAVIGATION FIX 2: LEVEL BUTTONS (CLONE STRATEGY) ---
    function hookLevelButtons() {
        const adventureMapURL = '../index.html?returnTo=adventure';
        
        // A. Home Buttons
        const levelHomeButtons = document.querySelectorAll('#btn-home, #vic-btn-home');
        levelHomeButtons.forEach(btn => {
            replaceButtonWithSound(btn, () => {
                navigateWithSound(adventureMapURL);
            });
        });

        // B. Retry Buttons
        const retries = document.querySelectorAll('#btn-retry, #vic-btn-retry');
        retries.forEach(btn => {
            replaceButtonWithSound(btn, () => {
                UI_CLICK_SOUND.play();
                setTimeout(() => window.location.reload(), 250);
            });
        });

        // C. Next Level
        const nextBtn = document.getElementById('vic-btn-next');
        if (nextBtn) {
            replaceButtonWithSound(nextBtn, () => {
                const path = window.location.pathname;
                const match = path.match(/level%20(\d+)|level\s*(\d+)/i);
                
                let target = adventureMapURL;
                if (match) {
                    const currentNum = parseInt(match[1] || match[2]);
                    const nextNum = currentNum + 1;
                    target = `../bloxplode adventure level ${nextNum}/index.html`;
                }
                navigateWithSound(target);
            });
        }
    }

    const originalVibrate = window.navigator.vibrate;
    if (originalVibrate) {
        window.navigator.vibrate = function(pattern) {
            if (state.haptic) return originalVibrate.call(window.navigator, pattern);
            return false;
        };
    }

    // ============================================
    // ROBUST UI CLICK SOUND + HAPTICS
    // ============================================
    const UI_CLICK_SOUND = {
        ctx: null,
        buffer: null,
        
        init: function() {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
                const pathsToTry = ['sounds/button_click.wav', '../sounds/button_click.wav'];
                
                const tryFetch = (index) => {
                    if (index >= pathsToTry.length) return;
                    fetch(pathsToTry[index])
                        .then(r => { if (!r.ok) throw new Error('404'); return r.arrayBuffer(); })
                        .then(b => this.ctx.decodeAudioData(b))
                        .then(d => { this.buffer = d; })
                        .catch(() => tryFetch(index + 1));
                };
                tryFetch(0);
            } catch(e) {}
        },

        play: function(forceSound) {
            // 1. HAPTIC FEEDBACK (25ms)
            if (state.haptic && navigator.vibrate) {
                navigator.vibrate(25);
            }

            // 2. SOUND EFFECT
            if (!forceSound && localStorage.getItem('blox_sfx_enabled') === 'false') return;

            if (!this.ctx || !this.buffer) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const s = this.ctx.createBufferSource();
            s.buffer = this.buffer;
            const g = this.ctx.createGain();
            g.gain.value = 0.6;
            s.connect(g);
            g.connect(this.ctx.destination);
            s.start(0);
        }
    };

    function attachGlobalClickSound() {
        UI_CLICK_SOUND.init();
        
        document.addEventListener('click', (e) => {
            const target = e.target;

            // 1. CHECK IF CLICK IS ON THE SOUND TOGGLE
            const switchEl = target.closest('.us-switch');
            const isSoundToggle = switchEl && switchEl.querySelector('#us-toggle-sfx');

            // 2. MENU LINKS (Pills, Play Button, Level Blocks)
            const isMenuLink = target.closest('.pill-btn, .big-play-btn, .struct-block:not(.locked)');
            
            if (isMenuLink && isMenuLink.tagName === 'A') {
                e.preventDefault();
                const href = isMenuLink.getAttribute('href');
                if (href && href !== '#') {
                    navigateWithSound(href);
                    return;
                }
            }

            // 3. GENERIC SOUND TARGETS
            const soundTargets = [
                '#universal-gear-btn', '.us-close-btn', '.us-btn', '.us-switch',
                '.nav-tab', '.pill-btn' 
            ];
            
            if (target.closest(soundTargets.join(','))) {
                UI_CLICK_SOUND.play(!!isSoundToggle); 
            }
        });
    }

    // --- INIT ---
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    function init() {
        injectSettingsUI();
        hookSoundSystem();
        initVisibilityHandler(); 
        initSeamlessHandoff();   
        hookLevelButtons(); 
        attachGlobalClickSound();
    }
})();