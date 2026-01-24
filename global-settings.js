/* =========================================================
   UNIVERSAL SETTINGS MODULE - LOGIC
   Features: Big Green Buttons + Custom SVGs + Music Fix
   Labels: BGM & HAPTICS
   Fixes: Mobile Audio "Unlock" Race Condition
   ========================================================= */

(function() {
    // --- 1. CONFIGURATION ---
    const STORAGE = {
        SFX: 'blox_sfx_enabled',
        BGM: 'blox_bgm_enabled',
        HAPTIC: 'blox_haptic_enabled'
    };

    const state = {
        sfx: localStorage.getItem(STORAGE.SFX) !== 'false',
        bgm: localStorage.getItem(STORAGE.BGM) !== 'false',
        haptic: localStorage.getItem(STORAGE.HAPTIC) !== 'false'
    };

    // --- 2. INJECT HTML ---
    function injectSettingsUI() {
        // A. Gear Icon
        const gearBtn = document.createElement('div');
        gearBtn.id = 'universal-gear-btn';
        gearBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.49l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
        document.body.appendChild(gearBtn);

        // B. The Modal
        const modal = document.createElement('div');
        modal.id = 'us-overlay';
        modal.innerHTML = `
            <div class="us-modal">
                <div class="us-header">
                    <div class="us-title">
                        <span>⚙️</span> SETTINGS
                    </div>
                    <button class="us-close-btn">&times;</button>
                </div>

                <div class="us-body">
                    <div class="us-row">
                        <div class="us-label"><span class="us-icon">🔊</span> SOUND</div>
                        <label class="us-switch">
                            <input type="checkbox" id="us-toggle-sfx" ${state.sfx ? 'checked' : ''}>
                            <span class="us-slider"></span>
                        </label>
                    </div>

                    <div class="us-row">
                        <div class="us-label"><span class="us-icon">🎵</span> BGM</div>
                        <label class="us-switch">
                            <input type="checkbox" id="us-toggle-bgm" ${state.bgm ? 'checked' : ''}>
                            <span class="us-slider"></span>
                        </label>
                    </div>

                    <div class="us-row">
                        <div class="us-label"><span class="us-icon">📳</span> HAPTICS</div>
                        <label class="us-switch">
                            <input type="checkbox" id="us-toggle-haptic" ${state.haptic ? 'checked' : ''}>
                            <span class="us-slider"></span>
                        </label>
                    </div>

                    <div class="us-actions">
                        <button class="us-btn btn-green" id="us-btn-home">
                            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                            HOME
                        </button>
                        
                        <button class="us-btn btn-green" id="us-btn-restart">
                            <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
                            RESTART
                        </button>
                    </div>
                    
                    <div class="us-footer">V 1.0.0 • BLOXPLODE</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // --- Event Listeners ---
        
        gearBtn.addEventListener('click', () => modal.classList.add('active'));
        modal.querySelector('.us-close-btn').addEventListener('click', () => modal.classList.remove('active'));

        document.getElementById('us-toggle-sfx').addEventListener('change', (e) => {
            state.sfx = e.target.checked;
            localStorage.setItem(STORAGE.SFX, state.sfx);
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

        document.getElementById('us-btn-restart').addEventListener('click', () => {
            window.location.reload();
        });

        document.getElementById('us-btn-home').addEventListener('click', () => {
            const path = window.location.pathname;
            if (path.includes('classic') || path.includes('adventure')) {
                window.location.href = '../index.html?returnTo=adventure'; 
            } else {
                modal.classList.remove('active');
            }
        });
    }

    // --- 3. SYSTEM HOOKS (MUSIC FIX INCLUDED) ---
    function hookSoundSystem() {
        if (!window.SoundSystem) { setTimeout(hookSoundSystem, 100); return; }

        const originalPlay = window.SoundSystem.play;
        window.SoundSystem.play = function(name, pitch, volume) {
            if (state.sfx) originalPlay.call(window.SoundSystem, name, pitch, volume);
        };

        // BGM FIX: Intercept playback start to enforce mute instantly
        const originalPlayMusic = window.SoundSystem.playMusic;
        window.SoundSystem.playMusic = function(name) {
            originalPlayMusic.call(window.SoundSystem, name);
            applyMusicState();
        };

        // --- THE MOBILE FIX ---
        // On mobile, the first touch event "Unlocks" audio and might reset volume.
        // We attach a one-time listener to FORCE the mute state again right after that touch.
        const enforceMute = () => setTimeout(applyMusicState, 50);
        window.addEventListener('touchstart', enforceMute, { once: true });
        window.addEventListener('click', enforceMute, { once: true });

        // Initial check
        applyMusicState();
    }

    function applyMusicState() {
        if (!window.SoundSystem || !window.SoundSystem.bgmGain) return;
        
        if (state.bgm) {
            // Unmute: Restore volume to 18%
            window.SoundSystem.bgmGain.gain.value = 0.18; 
            if (window.SoundSystem.ctx.state === 'suspended') window.SoundSystem.ctx.resume();
        } else {
            // Mute: Set volume to 0
            window.SoundSystem.bgmGain.gain.value = 0;
        }
    }

    const originalVibrate = window.navigator.vibrate;
    if (originalVibrate) {
        window.navigator.vibrate = function(pattern) {
            if (state.haptic) return originalVibrate.call(window.navigator, pattern);
            return false;
        };
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    function init() {
        injectSettingsUI();
        hookSoundSystem();
    }
})();