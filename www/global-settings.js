/* =========================================================
   UNIVERSAL SETTINGS MODULE - AUDIO CORE V2 + ANALYTICS + JANITOR + ADS + ORIENTATION
   ========================================================= */

(function() {

    // --- GLOBAL VARIABLES (Moved to top to prevent crashes) ---
    const SESSION_START = Date.now();
    let bannerShown = false;
    
    // --- NEW: GAME TRACKING (ROOKIE SHIELD) ---
    // Load existing count or start at 0
    let totalGamesPlayed = parseInt(localStorage.getItem('blox_games_played') || '0');

    // --- 0. JANITOR: AUTO-RENAME PAGES (FIX MESSY TITLES) ---
    function sanitizePageTitle() {
        const path = window.location.pathname.toLowerCase();
        
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

    // =========================================================
    // --- 3. THE NATIVE BRIDGE ENGINE (ANDROID STUDIO OVERRIDE) ---
    // =========================================================
    
    // This engine looks for the Java Interface we created in MainActivity.java
    const HapticEngine = {
        trigger: function(style) {
            if (localStorage.getItem('blox_haptic_enabled') === 'false') return;

            // 1. Determine Duration (UPDATED for 25/80/110)
            let ms = 25; // Default Light
            if (style === 'MEDIUM') ms = 80;
            if (style === 'HEAVY') ms = 110;

            // 2. PRIORITY: USE THE CUSTOM JAVA BRIDGE
            // This calls the code in MainActivity.java directly
            if (window.AndroidNative && window.AndroidNative.rumble) {
                window.AndroidNative.rumble(ms);
                return;
            }

            // 3. Fallback: Capacitor Plugin (If bridge fails)
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
                window.Capacitor.Plugins.Haptics.vibrate({ duration: ms }).catch(e => {});
                return;
            }

            // 4. Last Resort: Web API
            if (navigator.vibrate) navigator.vibrate(ms);
        }
    };
    window.HapticEngine = HapticEngine;

    // --- 4. THE AUTO-PATCHER (FIXES ALL 11 LEVELS) ---
    // This finds the broken "triggerEternalHaptic" in your level files and upgrades it instantly
    function patchHapticsGlobally() {
        setTimeout(() => {
            if (typeof window.triggerEternalHaptic === 'function') {
                console.log("🔧 PATCHING: Upgrading level haptics to Native Engine");
                window.triggerEternalHaptic = function(ms) {
                    // Map old MS logic to new Native Styles
                    let style = 'LIGHT';
                    if (ms >= 40) style = 'MEDIUM';
                    if (ms >= 80) style = 'HEAVY';
                    HapticEngine.trigger(style);
                };
            }
        }, 500); // 500ms delay guarantees local script is loaded
    }

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

    // --- 5. INJECT HTML (UI) ---
    function injectSettingsUI() {
        const gearBtn = document.createElement('div');
        gearBtn.id = 'universal-gear-btn';
        gearBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.49l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12-0.61l1.92,3.32c0.12-0.22,0.37-0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
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

    // --- 6. SYSTEM HOOKS ---
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

    // --- 7. VISIBILITY ---
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

    // --- 8. PAGE EXIT ---
    function initSeamlessHandoff() {
        window.addEventListener('beforeunload', () => {});
    }

    // --- 9. NAVIGATION BUTTONS ---
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

    // --- 10. SMART ADMOB & CRAZYGAMES INTEGRATION ---
    async function initAdMob() {
        
        // B. ADMOB MOBILE INIT
        if (!window.Capacitor) return;
        const AdMob = window.Capacitor.Plugins.AdMob;
        const App = window.Capacitor.Plugins.App; 
        if (!AdMob) return;

        // 🎛️ MASTER SWITCH (Set to TRUE for Live/Production)
        const IS_PRODUCTION = true; 

        // IDs
        const BANNER_ID = IS_PRODUCTION 
            ? 'ca-app-pub-8653076377863928/6268879815'  // 🇦🇪 UAE Main Banner
            : 'ca-app-pub-3940256099942544/6300978111'; // Google Test ID

        const INTERSTITIAL_ID = IS_PRODUCTION 
            ? 'ca-app-pub-8653076377863928/3227783502'  // 🇦🇪 UAE Level End
            : 'ca-app-pub-3940256099942544/1033173712'; // Google Test ID

        // REWARDED AD ID
        const REWARD_ID = IS_PRODUCTION
            ? 'ca-app-pub-8653076377863928/7606012212'  // 🇦🇪 UAE Rescue Reward
            : 'ca-app-pub-3940256099942544/5224354917'; // Google Test ID 

        const grantReward = () => {
            if (window.pendingRescueCallback) {
                console.log("💎 GRANTING REWARD (AdMob)");
                window.pendingRescueCallback();
                window.pendingRescueCallback = null; 
                AdMob.prepareRewardVideoAd({ adId: REWARD_ID, isTesting: !IS_PRODUCTION }).catch(e => console.log(e));
                return;
            }
        };

        AdMob.addListener('onRewardVideoReward', (info) => { grantReward(); });
        AdMob.addListener('onUserEarnedReward', (info) => { grantReward(); });
        AdMob.addListener('onAdDismissedFullScreenContent', () => {
             setTimeout(() => {
                 if (window.pendingRescueCallback) {
                     console.warn("⚠️ Ad closed but reward event didn't fire. Granting reward anyway.");
                     grantReward();
                 }
             }, 500); 
        });

        if (App) {
            App.addListener('resume', () => {
                setTimeout(() => { grantReward(); }, 100); 
            });
        }
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                setTimeout(() => { grantReward(); }, 500);
            }
        });

        try {
            await AdMob.initialize({ requestTrackingAuthorization: true });
            await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting: !IS_PRODUCTION });
            await AdMob.prepareRewardVideoAd({ adId: REWARD_ID, isTesting: !IS_PRODUCTION });

            const bannerPoller = setInterval(async () => {
                if (bannerShown) { clearInterval(bannerPoller); return; }
                const now = Date.now();
                const minsPlayed = (now - SESSION_START) / 60000;
                let currentLevel = 0;
                const levelMatch = document.title.match(/Level\s+(\d+)/i);
                if (levelMatch) currentLevel = parseInt(levelMatch[1]);

                // --- MODIFICATION: DISABLED BANNER (Opt-In Strategy) ---
                // Set to 'false' to prevent banner from showing automatically
                if (false && (minsPlayed > 25 || currentLevel >= 20)) {
                    bannerShown = true;
                    clearInterval(bannerPoller); 
                    await AdMob.showBanner({
                        adId: BANNER_ID,
                        position: 'BOTTOM_CENTER',
                        margin: 0,
                        isTesting: !IS_PRODUCTION 
                    });
                    document.body.style.paddingBottom = '60px'; 
                    document.body.style.boxSizing = 'border-box';
                }
            }, 10000); 

        } catch (e) {
            console.error('AdMob Init Failed', e);
        }

        // SMART INTERSTITIAL TRIGGER
        window.triggerSmartAd = async (context) => {
            // --- MODIFICATION: DISABLED INTERSTITIAL (Opt-In Strategy) ---
            return; 

            /* const now = Date.now();
            const minsTotal = (now - SESSION_START) / 60000;
            if (minsTotal < 10) return;

            try {
                let shouldShow = false;
                if (context.isClassic) {
                    if (context.result === 'loss' && context.duration > 480) shouldShow = true;
                } 
                else if (typeof context.level === 'number') {
                    const lvl = context.level;
                    if (lvl <= 14) { shouldShow = false; }
                    else if (lvl <= 50) { if (lvl % 15 === 0) shouldShow = true; }
                    else if (lvl <= 100) { if (lvl % 10 === 0) shouldShow = true; }
                    else { if (lvl % 5 === 0) shouldShow = true; }
                }

                if (shouldShow) {
                    await AdMob.showInterstitial();
                    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting: !IS_PRODUCTION });
                }
            } catch (e) {}
            */
        };
    }

    // --- EXPOSE FUNCTION TO BUTTONS (SMART SWITCH) ---
    window.showReviveAd = async () => {

        // 2. MOBILE: ADMOB
        if (window.Capacitor) {
            try {
                await window.Capacitor.Plugins.AdMob.showRewardVideoAd();
            } catch (e) {
                console.warn("Ad not ready, trying to load fresh...");
                try {
                    // Re-prepare logic handles inside initAdMob, but just in case:
                    alert("Ad not ready. Please try again in 5 seconds.");
                } catch (err) {}
            }
            return;
        }
        
        // 3. FALLBACK (Local Testing)
        console.log("💻 Local Dev: Simulating Ad Watch...");
        setTimeout(() => {
            if (window.pendingRescueCallback) {
                window.pendingRescueCallback();
                window.pendingRescueCallback = null;
            }
        }, 1000);
    };

    // --- NEW: RESCUE ELIGIBILITY CHECKER ---
    window.isRescueEligible = (currentScore, durationSeconds) => {
        // --- MODIFICATION: ALWAYS ALLOWED (Opt-In Strategy) ---
        return true;

        /*
        // 1. Rookie Shield: Must have played more than 5 games total
        if (totalGamesPlayed <= 5) {
            console.log(`🛡️ Rescue Blocked: Rookie Shield (Games: ${totalGamesPlayed})`);
            return false;
        }

        const path = window.location.pathname.toLowerCase();
        const title = document.title.toLowerCase();
        const isClassic = path.includes('classic') || title.includes('classic');

        // 2. Classic Mode Rule: Score > 300
        if (isClassic) {
            if (currentScore > 300) return true;
            console.log(`🛡️ Rescue Blocked: Score too low (${currentScore})`);
            return false;
        }

        // 3. Adventure Mode Rule: Time > 60s
        if (durationSeconds > 30) return true;
        
        console.log(`🛡️ Rescue Blocked: Duration too short (${durationSeconds}s)`);
        return false;
        */
    };

    function initAutoTracking() {
        const levelStartTime = Date.now(); 
        let hasLoggedWin = false;
        let hasLoggedLoss = false;

        function getLevelNumber() {
            const title = document.title;
            const levelMatch = title.match(/Level (\d+)/i);
            if (levelMatch) return parseInt(levelMatch[1]);
            return null;
        }
        
        function isClassicMode() {
            return document.title.toLowerCase().includes('classic');
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
                    
                    // --- NEW: INCREMENT GAMES PLAYED ---
                    totalGamesPlayed++;
                    localStorage.setItem('blox_games_played', totalGamesPlayed);

                    // Trigger Ad Logic
                    if (window.triggerSmartAd) {
                        window.triggerSmartAd({
                            result: 'win',
                            level: getLevelNumber(),
                            isClassic: isClassicMode(),
                            duration: getTimeSpent()
                        });
                    }
                    
                    if(window.GameAnalytics) {
                        window.GameAnalytics.log('level_complete', { 
                            level_number: getLevelNumber() || 'Classic',
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
                    
                    // --- NEW: INCREMENT GAMES PLAYED ---
                    totalGamesPlayed++;
                    localStorage.setItem('blox_games_played', totalGamesPlayed);

                    // Trigger Ad Logic
                    if (window.triggerSmartAd) {
                        window.triggerSmartAd({
                            result: 'loss',
                            level: getLevelNumber(),
                            isClassic: isClassicMode(),
                            duration: getTimeSpent()
                        });
                    }

                    if(window.GameAnalytics) {
                        window.GameAnalytics.log('level_fail', { 
                            level_number: getLevelNumber() || 'Classic',
                            final_score: getScore(),
                            duration_seconds: getTimeSpent()
                        });
                    }
                }
            });
            observer.observe(failScreen, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // --- 11. SMART SCALING (FIT-TO-WINDOW + VERTICAL CENTERING) ---
    function initSmartScaling() {
        // A. STRUCTURAL GROUPING (The "Ghost Wrapper")
        const goalBar = document.getElementById('goal-bar');
        const gameCol = document.querySelector('.game-column');
        
        // CHECK 1: Do we have a game column?
        // CHECK 2: Have we already wrapped it?
        if (gameCol && !document.getElementById('main-game-container')) {
            
            // 1. Create the Container
            const container = document.createElement('div');
            container.id = 'main-game-container';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'center';
            container.style.transformOrigin = 'center center'; // Scale from center
            container.style.transition = 'transform 0.1s ease-out';
            
            // 2. Insert into DOM
            document.body.appendChild(container);

            // 3. LOGIC FOR ADVENTURE MODE (Has Goal Bar)
            if (goalBar) {
                container.appendChild(goalBar);
                // Override "Absolute" positioning from CSS
                goalBar.style.position = 'relative';
                goalBar.style.top = '0';
                goalBar.style.marginBottom = '10px'; // Space between score and grid
            }

            // 4. LOGIC FOR ALL MODES (Move Game Column Inside)
            container.appendChild(gameCol);
            
            // 5. Force Body Centering
            document.body.style.paddingTop = '0';
            document.body.style.display = 'flex';
            document.body.style.flexDirection = 'column';
            document.body.style.justifyContent = 'center'; // Vertical Center
            document.body.style.alignItems = 'center';     // Horizontal Center
            document.body.style.height = '100vh';
            document.body.style.overflow = 'hidden';
        }

        function applySmartScale() {
            // Target the new container if it exists, otherwise fallback to game-column
            const target = document.getElementById('main-game-container') || document.querySelector('.game-column');
            if (!target) return;

            const availW = window.innerWidth;
            // Reserve 90px at bottom for AdBanner + Native Navigation Bar
            const availH = window.innerHeight - 90; 

            // Dimensions of our content (Goal Bar + Grid + Tray)
            // Grid is 404px wide. Height is approx 750px (Goals 50 + Grid 404 + Tray 120 + Gaps).
            const CONTENT_WIDTH = 420; // 404 + padding
            const CONTENT_HEIGHT = 760; 

            const scaleW = availW / CONTENT_WIDTH;
            const scaleH = availH / CONTENT_HEIGHT;

            // Pick the smaller scale to ensure it fits BOTH width and height
            let finalScale = Math.min(scaleW, scaleH);
            
            // Cap at 1.0 (don't upscale on tablets, looks pixelated)
            if (finalScale > 1.05) finalScale = 1.05;

            target.style.transform = `scale(${finalScale})`;
            window.gameScale = finalScale;
        }

        applySmartScale();
        
        // UPDATE: Listen for Resize AND Orientation Change for faster Pillarbox response
        window.addEventListener('resize', () => {
            applySmartScale();
            setTimeout(applySmartScale, 100); 
        });
        window.addEventListener('orientationchange', () => {
             setTimeout(applySmartScale, 200); // Wait for screen rotation animation
        });
        
        // Initial checks
        setTimeout(applySmartScale, 10);
        setTimeout(applySmartScale, 100);
        setTimeout(applySmartScale, 500); // Safety for slow CSS loads
    }

    // --- 12. ANDROID BACK BUTTON HANDLER (FIXED) ---
    async function initAndroidBackHandler() {
        if (!window.Capacitor || !window.Capacitor.Plugins.App) return;
        
        const App = window.Capacitor.Plugins.App;
        let lastBackPress = 0;

        App.removeAllListeners();

        App.addListener('backButton', () => {
            const settingsOverlay = document.getElementById('us-overlay');
            const adventureMap = document.querySelector('.map-overlay');
            const path = window.location.pathname.toLowerCase();
            const now = Date.now();
            
            if (settingsOverlay && settingsOverlay.classList.contains('active')) {
                settingsOverlay.classList.remove('active');
                return;
            } 
            
            if (adventureMap && adventureMap.classList.contains('active')) {
                adventureMap.classList.remove('active');
                
                const bootLayer = document.getElementById('game-boot-layer');
                const menuLayer = document.getElementById('menu-buttons-layer');
                const logo = document.getElementById('master-logo');
                
                setTimeout(() => {
                    adventureMap.classList.add('hidden');
                    if(bootLayer) bootLayer.style.display = 'flex';
                    if(menuLayer) {
                        menuLayer.classList.remove('hidden');
                        menuLayer.classList.add('animate-entry');
                    }
                    if(logo) {
                        logo.classList.remove('hidden');
                        logo.classList.add('move-to-header');
                    }
                }, 300);
                return;
            }

            if (path.includes('level') || path.includes('classic')) {
                if (now - lastBackPress < 2000) {
                    const target = path.includes('level') ? '../index.html?returnTo=adventure' : '../index.html';
                    navigateWithSound(target);
                } else {
                    lastBackPress = now;
                    if (window.Capacitor.Plugins.Toast) {
                        window.Capacitor.Plugins.Toast.show({
                            text: "Press back again to quit level",
                            duration: 'short'
                        });
                    }
                }
                return;
            }

            if (now - lastBackPress < 2000) {
                App.exitApp();
            } else {
                lastBackPress = now;
                if (window.Capacitor.Plugins.Toast) {
                    window.Capacitor.Plugins.Toast.show({
                        text: "Press back again to exit",
                        duration: 'short'
                    });
                }
            }
        });
    }

    // --- 13. CLICK SOUNDS (UPDATED FOR UNIFORMITY & STABILITY) ---
    const UI_CLICK_SOUND = {
        ctx: null, buffer: null, lastPlayTime: 0,
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
            // 1. DEBOUNCE (Fixes double clicks & weird overlaps)
            const now = Date.now();
            if (now - this.lastPlayTime < 80) return; // 80ms Gate ensures single clean click
            this.lastPlayTime = now;

            // 2. TRIGGER HAPTIC (Keep existing logic)
            if (window.HapticEngine) window.HapticEngine.trigger('LIGHT');
            else if (state.haptic && navigator.vibrate) navigator.vibrate(25); // Fallback

            // 3. SOUND CHECKS
            if (!forceSound && localStorage.getItem('blox_sfx_enabled') === 'false') return;
            if (!this.ctx || !this.buffer) return;

            // 4. CONTEXT KEEP-ALIVE (Fixes audio cutoffs)
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

    // ============================================
    // --- 14. GLOBAL RESCUE MANAGER (INJECTED) ---
    // ============================================

    // A. INJECT UI
    function injectRescueUI() {
        if (document.getElementById('rescue-overlay')) return; // Avoid duplicates

        const overlay = document.createElement('div');
        overlay.id = 'rescue-overlay';
        overlay.className = 'hidden'; 
        overlay.innerHTML = `
            <div class="rescue-glass-panel">
                <div class="rescue-header">CONTINUE?</div>
                
                <div class="rescue-timer-circle">
                    <svg viewBox="0 0 100 100">
                        <circle class="timer-bg" cx="50" cy="50" r="45"></circle>
                        <circle class="timer-progress" cx="50" cy="50" r="45"></circle>
                    </svg>
                    <div class="timer-text">5</div>
                </div>

                <div class="rescue-info">Keep your game alive</div>
                
                <button id="btn-rescue-watch" class="rescue-btn-blue">
                    <svg viewBox="0 0 24 24" fill="currentColor" style="width: 28px; height: 28px; margin-right: 4px;">
                        <path d="M8 5v14l11-7z"/>
                    </svg> 
                    REVIVE
                </button>
                
                <div id="btn-rescue-skip">Skip</div>
            </div>
        `;
        document.body.appendChild(overlay);

        // BIND EVENTS
        document.getElementById('btn-rescue-watch').addEventListener('click', () => {
             // Stop Timer
             if (window.GlobalRescue.interval) clearInterval(window.GlobalRescue.interval);
             
             // Setup Callback
             window.pendingRescueCallback = window.GlobalRescue.executeRescueClear;
             
             // Show Ad
             if (window.showReviveAd) window.showReviveAd();
             else {
                 // Fallback for Web Testing
                 console.log("Web Test Mode: Simulating Ad Watch...");
                 setTimeout(() => {
                     if (window.pendingRescueCallback) window.pendingRescueCallback();
                 }, 1000);
             }
        });

        document.getElementById('btn-rescue-skip').addEventListener('click', () => {
            if (window.GlobalRescue.interval) clearInterval(window.GlobalRescue.interval);
            window.GlobalRescue.failRescue();
        });
    }

    // B. MANAGER OBJECT
    window.GlobalRescue = {
        hasUsedRescue: false,
        interval: null,
        failCallback: null,
        levelStartTime: 0,

        // 1. ENTRY POINT
        tryRescue: function(onFail) {
            this.failCallback = onFail;

            // Gather Data for Eligibility
            // (Assuming game script exposes 'score' variable globally or we find it)
            const scoreEl = document.getElementById('score');
            const scoreVal = scoreEl ? parseInt(scoreEl.textContent) : 0;
            const duration = (Date.now() - (this.levelStartTime || SESSION_START)) / 1000;

            if (!this.hasUsedRescue && window.isRescueEligible && window.isRescueEligible(scoreVal, duration)) {
                this.triggerRescueSequence();
            } else {
                // Not eligible or already used -> Die
                onFail();
            }
        },

        // 2. TRIGGER UI
        triggerRescueSequence: function() {
            // LOCK GAME (If variable exists)
            if (typeof isGameLocked !== 'undefined') window.isGameLocked = true;

            const overlay = document.getElementById('rescue-overlay');
            const timerText = overlay.querySelector('.timer-text');
            const timerCircle = overlay.querySelector('.timer-progress');
            
            overlay.classList.remove('hidden');
            overlay.classList.add('active'); // For CSS transition

            let timeLeft = 5;
            timerText.textContent = timeLeft;

            // Reset Animation
            if(timerCircle) {
                timerCircle.style.transition = 'none';
                timerCircle.style.strokeDashoffset = "0";
                void timerCircle.offsetWidth; // Force Reflow
                timerCircle.style.transition = 'stroke-dashoffset 1s linear';
            }

            if (this.interval) clearInterval(this.interval);

            this.interval = setInterval(() => {
                timeLeft--;
                timerText.textContent = timeLeft;
                
                if(timerCircle) {
                    const offset = 283 - (283 * (timeLeft / 5)); 
                    timerCircle.style.strokeDashoffset = offset;
                }

                if (timeLeft <= 0) {
                    clearInterval(this.interval);
                    this.failRescue();
                }
            }, 1000);
        },

        // 3. FAIL STATE
        failRescue: function() {
            const overlay = document.getElementById('rescue-overlay');
            overlay.classList.remove('active');
            setTimeout(() => overlay.classList.add('hidden'), 300); // Wait for fade
            
            if (this.failCallback) this.failCallback();
        },

        // 4. SUCCESS STATE (CORE DETONATION)
        executeRescueClear: function() {
            console.log("🚀 GLOBAL RESCUE: DETONATION INITIATED");
            
            const overlay = document.getElementById('rescue-overlay');
            overlay.classList.remove('active');
            setTimeout(() => overlay.classList.add('hidden'), 300);

            window.GlobalRescue.hasUsedRescue = true;
            
            // NOTE: This assumes 'gridState' and 'cells' are globally available in the level scope.
            // If the level script wraps them in a closure, we need to expose them or use DOM querying.
            // DOM Querying is safer for a "Global Janitor" approach.
            
            const gridWrapper = document.getElementById('grid-wrapper');
            const allCells = Array.from(document.querySelectorAll('.cell'));
            
            // Center Indices (4x4)
            const centerIndices = [18,19,20,21, 26,27,28,29, 34,35,36,37, 42,43,44,45];

            // PHASE 1: CHARGE (Visuals Only)
            centerIndices.forEach(idx => {
                if (allCells[idx] && allCells[idx].classList.contains('occupied')) {
                    allCells[idx].classList.add('flash-white');
                }
            });

            setTimeout(() => {
                // PHASE 2: DETONATION
                
                // A. Shake
                gridWrapper.classList.add('shake-3');
                setTimeout(() => gridWrapper.classList.remove('shake-3'), 300);

                // B. Shockwave
                const shockwave = document.createElement('div');
                shockwave.className = 'fx-shockwave';
                gridWrapper.appendChild(shockwave);
                setTimeout(() => shockwave.remove(), 600);

                // C. Clear Logic (Direct DOM + Global Array Manipulation)
                centerIndices.forEach(idx => {
                    const cell = allCells[idx];
                    if (cell && cell.classList.contains('occupied')) {
                        // 1. Update Visuals
                        cell.className = "cell"; 
                        cell.style.removeProperty('--block-color');
                        
                        // 2. Update Data (If accessible globally)
                        if (typeof gridState !== 'undefined') gridState[idx] = 0;

                        // 3. Spawn Debris
                        const r = Math.floor(idx / 8);
                        const c = idx % 8;
                        const vecY = r - 3.5;
                        const vecX = c - 3.5;

                        for(let i=0; i<3; i++) {
                            const shard = document.createElement('div');
                            shard.className = 'fx-shard';
                            const startLeft = (c * 48) + 12 + 20 + (Math.random() * 20 - 10);
                            const startTop = (r * 48) + 12 + 20 + (Math.random() * 20 - 10);
                            
                            shard.style.left = startLeft + 'px';
                            shard.style.top = startTop + 'px';
                            
                            const velocity = 100 + Math.random() * 100;
                            const tx = (vecX + (Math.random()-0.5)) * velocity;
                            const ty = (vecY + (Math.random()-0.5)) * velocity;
                            
                            shard.animate([
                                { transform: `translate(0,0) scale(1)`, opacity: 1 },
                                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
                            ], {
                                duration: 500 + Math.random() * 200,
                                easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
                            }).onfinish = () => shard.remove();
                            
                            gridWrapper.appendChild(shard);
                        }
                    }
                });

                // D. Resume Game
                if (typeof isGameLocked !== 'undefined') window.isGameLocked = false;
                if (window.SoundSystem) window.SoundSystem.play('epic_victory'); // SFX
                
                // Spawn new pieces to ensure player isn't stuck
                if (typeof spawnTrayPieces === 'function') spawnTrayPieces();

            }, 300);
        }
    };

    // --- 15. ORIENTATION MANAGER (NEW: HYBRID STRATEGY) ---
    async function initOrientationHandler() {
        if (!window.Capacitor) return; 
        
        // Safety check for the plugin
        const ScreenOrientation = window.Capacitor.Plugins.ScreenOrientation;
        if (!ScreenOrientation) return;

        // LOGIC: If smallest dimension < 600, it's a Phone -> LOCK PORTRAIT.
        // If >= 600, it's a Tablet -> UNLOCK (Allow Landscape).
        const smallestDim = Math.min(window.screen.width, window.screen.height);
        const isTablet = smallestDim >= 600;

        try {
            if (isTablet) {
                console.log(`📱 Tablet Detected (${smallestDim}px): Unlocking Orientation`);
                await ScreenOrientation.unlock();
            } else {
                console.log(`📱 Phone Detected (${smallestDim}px): Locking Portrait`);
                await ScreenOrientation.lock({ orientation: 'portrait' });
            }
        } catch (e) {
            console.warn("Orientation Manager Failed:", e);
        }
    }

    // --- 16. START SEQUENCE (GLOBAL INJECTION + MUTATION OBSERVER) ---
    function initStartSequence() {
        // 1. Target the Grid
        const grid = document.getElementById('grid');
        if (!grid) return;

        // 2. Define the Animation Logic
        const runAnimation = () => {
            console.log("🎬 INITIATING START SEQUENCE (SAFE MODE)");
            
            // Only lock if we have cells
            const cells = document.querySelectorAll('.cell');
            if(cells.length === 0) return;

            if (typeof isGameLocked !== 'undefined') window.isGameLocked = true;
            
            const tray = document.getElementById('tray');
            if (tray) tray.style.opacity = '0';

            // FORCE FILL (INSTANT BRICK UP)
            const palette = ['#FF7F7F', '#FFD700', '#66CDAA', '#87CEFA', '#BA55D3', '#FFA07A', '#4DD6E8', '#B388FF', '#FFB347', '#4FC3A1', '#FF6F61'];

            cells.forEach(cell => {
                // Skip if occupied (Don't hide Gems or Walls!)
                if (!cell.classList.contains('occupied')) {
                    const randomColor = palette[Math.floor(Math.random() * palette.length)];
                    cell.style.setProperty('--block-color', randomColor);
                    cell.classList.add('visual-fill');
                    cell.style.animation = 'none'; // No pop-in
                    cell.classList.add('start-locked'); // Marker
                }
            });

            // UNWRAP SEQUENCE
            setTimeout(() => {
                const totalRows = 8;
                for (let r = 0; r < totalRows; r++) {
                    setTimeout(() => {
                        cells.forEach((cell, idx) => {
                            const row = Math.floor(idx / 8);
                            if (row === r && cell.classList.contains('start-locked')) {
                                cell.classList.remove('visual-fill');
                                cell.style.removeProperty('--block-color');
                                cell.style.animation = ''; 
                                cell.classList.remove('start-locked');
                            }
                        });
                        // SILENCED: Haptic trigger removed
                    }, r * 60);
                }

                // UNLOCK
                setTimeout(() => {
                    if (typeof isGameLocked !== 'undefined') window.isGameLocked = false;
                    if (tray) {
                        tray.style.transition = 'opacity 0.5s ease';
                        tray.style.opacity = '1';
                    }
                    // SILENCED: Victory chime removed
                }, (totalRows * 60) + 200);

            }, 500); 
        };

        // 3. THE "RACE CONDITION" FIX (WATCH FOR GRID POPULATION)
        // If the grid is empty, wait for the level script to build it.
        if (grid.children.length === 0) {
            console.log("⏳ Grid Empty: Waiting for Level Script...");
            const observer = new MutationObserver((mutations) => {
                if (grid.children.length === 64) {
                    observer.disconnect(); // Stop watching
                    // Wait a tiny bit more for level logic to mark 'occupied' cells
                    setTimeout(runAnimation, 50); 
                }
            });
            observer.observe(grid, { childList: true });
        } else {
            // Grid already ready? Run immediately.
            runAnimation();
        }
    }

    // --- INIT ---
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    function init() {
        injectSettingsUI();
        injectRescueUI();
        window.GlobalRescue.levelStartTime = Date.now(); 

        hookSoundSystem();
        initVisibilityHandler(); 
        initSeamlessHandoff();   
        hookLevelButtons(); 
        attachGlobalClickSound();
        initAutoTracking(); 
        initSmartScaling(); 
        initAndroidBackHandler();
        initOrientationHandler();
        initAdMob(); 
        patchHapticsGlobally(); 
        
        // --- 🎬 START ANIMATION (NOW SMART) ---
        initStartSequence();
    }
})();