/* =========================================================
   UNIVERSAL SETTINGS MODULE - AUDIO CORE V2 + ANALYTICS + JANITOR + ADS
   ========================================================= */

(function() {

    // --- 0. JANITOR: AUTO-RENAME PAGES (FIX MESSY TITLES) ---
    function sanitizePageTitle() {
        const path = window.location.pathname.toLowerCase();
        const urlParams = new URLSearchParams(window.location.search);

        const levelMatch = path.match(/level[\s%20_-]*(\d+)/);
        if (levelMatch) {
            document.title = `Level ${levelMatch[1]}`;
            return;
        }
        if (path.includes('classic')) {
            document.title = "Classic Mode";
            return;
        }
        if (!path.includes('level') && !path.includes('classic')) {
            document.title = "Main Menu";
            return;
        }
    }
    sanitizePageTitle();


    // --- 1. FIREBASE ANALYTICS (AUTO-INJECTOR) ---
    function initFirebase() {
        window.GameAnalytics = {
            log: (eventName, params) => { console.log('⚠️ Analytics Offline:', eventName, params); }
        };

        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
            import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";

            const firebaseConfig = {
                apiKey: "AIzaSyDY259wW8A8qAv3yHXYjXdsXQ6hh1t54iA",
                authDomain: "bloxplode.firebaseapp.com",
                projectId: "bloxplode",
                storageBucket: "bloxplode.firebasestorage.app",
                messagingSenderId: "346109165031",
                appId: "1:346109165031:web:28a5563cb6c987eb4f1142",
                measurementId: "G-VC2LN6TDJF"
            };

            try {
                const app = initializeApp(firebaseConfig);
                const analytics = getAnalytics(app);
                
                window.GameAnalytics = {
                    log: (eventName, params) => {
                        console.log('📊 Firebase Sent:', eventName, params);
                        logEvent(analytics, eventName, params);
                    }
                };
                console.log("🔥 Firebase Connected Successfully");
            } catch (e) {
                console.error("Firebase Init Failed:", e);
            }
        `;
        document.head.appendChild(script);
    }
    initFirebase();

    // --- 2. CONFIGURATION ---
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

    // --- HELPER: DELAYED NAVIGATION ---
    function navigateWithSound(url) {
        UI_CLICK_SOUND.play();
        setTimeout(() => {
            window.location.href = url;
        }, 250);
    }

    // --- HELPER: CLONE & REPLACE ---
    function replaceButtonWithSound(originalBtn, clickAction) {
        if (!originalBtn) return;
        const newBtn = originalBtn.cloneNode(true);
        originalBtn.parentNode.replaceChild(newBtn, originalBtn);
        newBtn.onclick = (e) => {
            e.preventDefault();
            clickAction();
        };
    }

    // --- 3. INJECT HTML (UI) ---
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

        gearBtn.addEventListener('click', () => modal.classList.add('active'));
        modal.querySelector('.us-close-btn').addEventListener('click', () => modal.classList.remove('active'));
        
        document.getElementById('us-toggle-sfx').addEventListener('change', (e) => {
            state.sfx = e.target.checked;
            localStorage.setItem(STORAGE.SFX, state.sfx);
            UI_CLICK_SOUND.play(true); 
            if(window.GameAnalytics) window.GameAnalytics.log('settings_change', { type: 'sfx', value: state.sfx });
        });

        document.getElementById('us-toggle-bgm').addEventListener('change', (e) => {
            state.bgm = e.target.checked;
            localStorage.setItem(STORAGE.BGM, state.bgm);
            applyMusicState();
            if(window.GameAnalytics) window.GameAnalytics.log('settings_change', { type: 'bgm', value: state.bgm });
        });
        
        document.getElementById('us-toggle-haptic').addEventListener('change', (e) => {
            state.haptic = e.target.checked;
            localStorage.setItem(STORAGE.HAPTIC, state.haptic);
        });
        
        document.getElementById('us-btn-restart').addEventListener('click', () => {
             UI_CLICK_SOUND.play();
             if(window.GameAnalytics) window.GameAnalytics.log('restart_click', { source: 'settings_menu' });
             setTimeout(() => window.location.reload(), 250);
        });
        
        document.getElementById('us-btn-home').addEventListener('click', () => {
            const isSubfolder = window.location.pathname.includes('level') || window.location.pathname.includes('classic');
            const targetURL = isSubfolder ? '../index.html' : 'index.html';
            if(window.GameAnalytics) window.GameAnalytics.log('home_click', { source: 'settings_menu' });
            navigateWithSound(targetURL); 
        });
    }

    // --- 4. SYSTEM HOOKS ---
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
        };
        const unlockAudio = () => {
            if (window.SoundSystem.ctx && window.SoundSystem.ctx.state === 'suspended') {
                window.SoundSystem.ctx.resume().then(() => { applyMusicState(); });
            }
        };
        window.addEventListener('touchstart', unlockAudio, { passive: true });
        window.addEventListener('click', unlockAudio, { passive: true });
        applyMusicState();
    }

    // --- 5. VISIBILITY ---
    function initVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!window.SoundSystem || !window.SoundSystem.ctx) return;
            if (document.hidden) {
                window.SoundSystem.ctx.suspend(); 
                if (window.SoundSystem.stopHeartbeat) window.SoundSystem.stopHeartbeat();
            } else {
                window.SoundSystem.ctx.resume().then(() => {
                    applyMusicState(); 
                    if (document.body.classList.contains('combo-active')) {
                        if (window.SoundSystem.startHeartbeat) window.SoundSystem.startHeartbeat();
                    }
                });
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

    // --- 6. PAGE EXIT ---
    function initSeamlessHandoff() {
        window.addEventListener('beforeunload', () => {});
    }

    // --- 7. NAVIGATION BUTTONS ---
    function hookLevelButtons() {
        const levelHomeButtons = document.querySelectorAll('#btn-home, #vic-btn-home');
        levelHomeButtons.forEach(btn => {
            replaceButtonWithSound(btn, () => {
                const path = window.location.pathname.toLowerCase();
                const isClassic = path.includes('classic');
                const targetURL = isClassic ? '../index.html' : '../index.html?returnTo=adventure';
                if(window.GameAnalytics) window.GameAnalytics.log('home_click', { mode: isClassic ? 'classic' : 'adventure' });
                navigateWithSound(targetURL);
            });
        });

        const retries = document.querySelectorAll('#btn-retry, #vic-btn-retry');
        retries.forEach(btn => {
            replaceButtonWithSound(btn, () => {
                UI_CLICK_SOUND.play();
                if(window.GameAnalytics) window.GameAnalytics.log('retry_click', { level: document.title });
                setTimeout(() => window.location.reload(), 250);
            });
        });

        const nextBtn = document.getElementById('vic-btn-next');
        if (nextBtn) {
            replaceButtonWithSound(nextBtn, () => {
                const path = window.location.pathname;
                const match = path.match(/level%20(\d+)|level\s*(\d+)/i);
                
                let target = '../index.html?returnTo=adventure';
                if (match) {
                    const currentNum = parseInt(match[1] || match[2]);
                    const nextNum = currentNum + 1;
                    target = `../bloxplode adventure level ${nextNum}/index.html`;
                    if(window.GameAnalytics) window.GameAnalytics.log('level_next_click', { from_level: currentNum });
                }
                navigateWithSound(target);
            });
        }
    }

    // --- 8. ADMOB INTEGRATION & ANALYTICS ---
    async function initAdMob() {
        // Safe Check: Ensure we are in Capacitor
        if (!window.Capacitor) return;
        
        const AdMob = window.Capacitor.Plugins.AdMob;
        if (!AdMob) return;

        // TEST IDs (Google Standard) - Replace with Real IDs before Store Release
        const BANNER_ID = 'ca-app-pub-8433483445772831/6477166323'; 
        const INTERSTITIAL_ID = 'ca-app-pub-8433483445772831/1367535795';

        try {
            await AdMob.initialize({ requestTrackingAuthorization: true });

            // Show Banner (Bottom)
            await AdMob.showBanner({
                adId: BANNER_ID,
                position: 'BOTTOM_CENTER',
                margin: 0,
                isTesting: true
            });
            
            // Adjust CSS so banner doesn't cover buttons
            document.body.style.paddingBottom = '60px'; 
            document.body.style.boxSizing = 'border-box';

            // Pre-load Interstitial
            await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting: true });

        } catch (e) {
            console.error('AdMob Init Failed', e);
        }

        // Global function to trigger interstitial
        window.showInterstitialAd = async () => {
            try {
                await AdMob.showInterstitial();
                // Pre-load the next one immediately
                await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting: true });
            } catch (e) {
                console.log('Ad not ready', e);
            }
        };
    }

    function initAutoTracking() {
        const levelStartTime = Date.now(); 
        let hasLoggedWin = false;
        let hasLoggedLoss = false;

        function getLevelNumber() {
            const title = document.title;
            const levelMatch = title.match(/Level (\d+)/i);
            if (levelMatch) return parseInt(levelMatch[1]);
            if (title.toLowerCase().includes('classic')) return 'Classic';
            return 'Unknown';
        }

        function getScore() {
            const el = document.getElementById('score-val');
            return el ? parseInt(el.innerText) : 0;
        }

        function getTimeSpent() {
            return Math.round((Date.now() - levelStartTime) / 1000); 
        }

        // WATCH FOR VICTORY
        const victoryScreen = document.getElementById('victory-ui-layer');
        if (victoryScreen) {
            const observer = new MutationObserver((mutations) => {
                if (!victoryScreen.classList.contains('hidden') && !hasLoggedWin) {
                    hasLoggedWin = true;
                    // TRIGGER AD
                    if (window.showInterstitialAd) window.showInterstitialAd();
                    
                    if(window.GameAnalytics) {
                        window.GameAnalytics.log('level_complete', { 
                            level_number: getLevelNumber(),
                            final_score: getScore(),
                            duration_seconds: getTimeSpent()
                        });
                    }
                }
            });
            observer.observe(victoryScreen, { attributes: true, attributeFilter: ['class'] });
        }

        // WATCH FOR GAME OVER
        const failScreen = document.getElementById('game-over-overlay');
        if (failScreen) {
            const observer = new MutationObserver((mutations) => {
                const isActive = !failScreen.classList.contains('hidden') || failScreen.classList.contains('overlay-active');
                if (isActive && !hasLoggedLoss) {
                    hasLoggedLoss = true;
                    // TRIGGER AD
                    if (window.showInterstitialAd) window.showInterstitialAd();

                    if(window.GameAnalytics) {
                        window.GameAnalytics.log('level_fail', { 
                            level_number: getLevelNumber(),
                            final_score: getScore(),
                            duration_seconds: getTimeSpent()
                        });
                    }
                }
            });
            observer.observe(failScreen, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // --- 9. SMART SCALING (FIT-TO-WINDOW) ---
    function initSmartScaling() {
        function applySmartScale() {
            const gameCol = document.querySelector('.game-column');
            if (!gameCol) return;

            const availW = window.innerWidth;
            const availH = window.innerHeight; // Banner padding handled by body style

            const IDEAL_WIDTH = 404; 
            const IDEAL_HEIGHT = 700; 

            const scaleW = availW / IDEAL_WIDTH;
            const scaleH = availH / IDEAL_HEIGHT;

            let finalScale;
            if (scaleW < scaleH) {
                finalScale = scaleW * 1.0; 
            } else {
                finalScale = scaleH * 0.90;
            }

            gameCol.style.transform = `scale(${finalScale})`;
            window.gameScale = finalScale;
        }

        applySmartScale();
        window.addEventListener('resize', () => {
            applySmartScale();
            setTimeout(applySmartScale, 10);
        });
        setTimeout(applySmartScale, 50);
        setTimeout(applySmartScale, 100);
    }

    // --- CLICK SOUNDS ---
    const UI_CLICK_SOUND = {
        ctx: null, buffer: null,
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
            if (state.haptic && navigator.vibrate) navigator.vibrate(25);
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
            const switchEl = target.closest('.us-switch');
            const isSoundToggle = switchEl && switchEl.querySelector('#us-toggle-sfx');
            const isMenuLink = target.closest('.pill-btn, .big-play-btn, .struct-block:not(.locked)');
            
            if (isMenuLink && isMenuLink.tagName === 'A') {
                e.preventDefault();
                const href = isMenuLink.getAttribute('href');
                if (href && href !== '#') {
                    navigateWithSound(href);
                    return;
                }
            }
            const soundTargets = ['#universal-gear-btn', '.us-close-btn', '.us-btn', '.us-switch', '.nav-tab', '.pill-btn'];
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
        initAutoTracking(); 
        initSmartScaling(); 
        
        // START ADS
        initAdMob(); 
    }
})();