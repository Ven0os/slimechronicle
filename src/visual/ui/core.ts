// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { applyShadowQuality } from '@/core/scene';
import { CampPreview } from './campPreview';

export const UICore = {
    // AJOUT DE 'forge' ET 'options' DANS LA LISTE DES ÉCRANS
    screens: ['landing', 'mode', 'host', 'join', 'class', 'compendium', 'forge', 'options'], 
    
    show: function(id) {
        // Cache tous les écrans
        this.screens.forEach(s => {
            const el = document.getElementById(`screen-${s}`);
            if(el) el.classList.remove('active');
        });

        // Dispose 3D Camp Preview if leaving options
        if (id !== 'options' && CampPreview) {
            CampPreview.dispose();
        }

        // Affiche l'écran cible
        const target = document.getElementById(`screen-${id}`);
        if(target) {
            target.classList.add('active');
            
            // Styles spécifiques
            if(id === 'compendium') {
                target.style.justifyContent = 'flex-start';
                target.style.paddingTop = '50px';
            }
        }
        
        // Hooks de mise à jour automatique
        if (id === 'compendium' && this.updateCompendium) this.updateCompendium(); 
        if (id === 'forge' && window.ForgeUI) window.ForgeUI.update();
        if (id === 'options' && STATE.gameOptions) {
            const setVal = (elId, valId, val, suffix = '') => {
                const el = document.getElementById(elId);
                const vel = document.getElementById(valId);
                if (el) el.value = val;
                if (vel) vel.innerText = suffix ? parseInt(val) + suffix : val;
            };

            // Options Graphismes
            setVal('opt-graphics-resolution', 'opt-val-graphics-resolution', STATE.gameOptions.resolutionScale || 100, '%');
            
            const densityLabels = ['Désactivé', 'Faible', 'Moyen', 'Élevé'];
            const densityVal = STATE.gameOptions.decoDensity || 4;
            setVal('opt-graphics-density', 'opt-val-graphics-density', densityVal);
            const densSpan = document.getElementById('opt-val-graphics-density');
            if (densSpan) densSpan.innerText = densityLabels[densityVal - 1];

            const waterLabels = ['Basse (Statique)', 'Moyenne (Simple)', 'Haute (Réaliste)'];
            const waterVal = STATE.gameOptions.waterQuality || 3;
            setVal('opt-graphics-water', 'opt-val-graphics-water', waterVal);
            const waterSpan = document.getElementById('opt-val-graphics-water');
            if (waterSpan) waterSpan.innerText = waterLabels[waterVal - 1];

            const shadowLabels = ['Désactivées', 'Douces (Rapide)', 'Élevées'];
            const shadowVal = STATE.gameOptions.shadowQuality || 3;
            setVal('opt-graphics-shadows', 'opt-val-graphics-shadows', shadowVal);
            const shadowSpan = document.getElementById('opt-val-graphics-shadows');
            if (shadowSpan) shadowSpan.innerText = shadowLabels[shadowVal - 1];

            const partLabels = ['Désactivés', 'Réduits (33%)', 'Complets'];
            const partVal = STATE.gameOptions.particleQuality || 3;
            setVal('opt-graphics-particles', 'opt-val-graphics-particles', partVal);
            const partSpan = document.getElementById('opt-val-graphics-particles');
            if (partSpan) partSpan.innerText = partLabels[partVal - 1];

            const chkFog = document.getElementById('opt-graphics-fog');
            if (chkFog) chkFog.checked = STATE.gameOptions.isFogActive !== false;

            const fpsVal = STATE.gameOptions.fpsLimit || 120;
            setVal('opt-graphics-fps', 'opt-val-graphics-fps', fpsVal);
            const fpsSpan = document.getElementById('opt-val-graphics-fps');
            if (fpsSpan) fpsSpan.innerText = fpsVal === 120 ? 'Illimité' : fpsVal + ' FPS';

            const chkFps = document.getElementById('opt-graphics-showfps');
            if (chkFps) chkFps.checked = !!STATE.gameOptions.showFps;
        }
    },

    toast: function(msg) {
        const t = document.getElementById('toast');
        if(t) {
            t.innerText = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        }
    },

    goToModeSelect: () => { if(window.UI) window.UI.show('mode'); },
    goToLobbyHost: () => { if(window.UI) { window.UI.show('host'); if(window.Network) window.Network.initHost(); } },
    goToLobbyJoin: () => { if(window.UI) window.UI.show('join'); },
    goToCompendium: () => { if(window.UI) window.UI.show('compendium'); }, 
    goToOptions: () => { if(window.UI) window.UI.show('options'); },
    backToLanding: () => { if(window.UI) window.UI.show('landing'); },
    
    saveOptions: function() {
        if (!STATE.gameOptions) STATE.gameOptions = {};
        
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? parseFloat(el.value) : 1.0;
        };
        
        STATE.gameOptions.resolutionScale = getVal('opt-graphics-resolution');
        STATE.gameOptions.decoDensity = getVal('opt-graphics-density');
        STATE.gameOptions.waterQuality = getVal('opt-graphics-water');
        STATE.gameOptions.shadowQuality = getVal('opt-graphics-shadows');
        STATE.gameOptions.particleQuality = getVal('opt-graphics-particles');
        
        const chkFog = document.getElementById('opt-graphics-fog');
        STATE.gameOptions.isFogActive = chkFog ? chkFog.checked : true;
        
        STATE.gameOptions.fpsLimit = getVal('opt-graphics-fps');
        
        const chkFps = document.getElementById('opt-graphics-showfps');
        STATE.gameOptions.showFps = chkFps ? chkFps.checked : false;
        
        // Appliquer immédiatement les réglages graphiques en jeu ou pré-jeu
        this.applyGraphicsSettings();

        // Save to localStorage
        try {
            localStorage.setItem('slime_game_options', JSON.stringify(STATE.gameOptions));
        } catch (e) {
            console.error("Failed to save game options to localStorage", e);
        }
    },

    saveOptionsAndReturn: function() {
        this.saveOptions();
        this.toast("Options sauvegardées !");
        
        if (Globals.player) {
            const pm = document.getElementById('pause-menu');
            this.screens.forEach(s => {
                const el = document.getElementById(`screen-${s}`);
                if(el) el.classList.remove('active');
            });
            if (pm) {
                pm.style.display = 'flex';
            } else {
                if (!STATE.multiplayer.active) STATE.isPaused = false;
            }
        } else {
            this.show('class');
        }
    },

    applyPreset: function(presetName) {
        const presets = {
            exploration: { hp: 0.5, dmg: 0.5, spawn: 0.8, xp: 1.5, php: 1.5, pdmg: 1.5, lvl: 5, maxmobs: 20, luckprism: 1.5, luckmini: 1.0, events: true },
            survivant: { hp: 1.0, dmg: 1.0, spawn: 1.0, xp: 1.0, php: 1.0, pdmg: 1.0, lvl: 1, maxmobs: 30, luckprism: 1.0, luckmini: 1.0, events: true },
            champion: { hp: 2.0, dmg: 2.0, spawn: 1.4, xp: 1.2, php: 1.0, pdmg: 1.0, lvl: 1, maxmobs: 45, luckprism: 1.5, luckmini: 1.5, events: true },
            cauchemar: { hp: 4.5, dmg: 4.0, spawn: 2.0, xp: 2.0, php: 0.8, pdmg: 0.8, lvl: 1, maxmobs: 60, luckprism: 2.0, luckmini: 2.0, events: true }
        };

        const data = presets[presetName];
        if (!data) return;

        const setUI = (id, val, suffix = '') => {
            const input = document.getElementById(id);
            if (input) input.value = val;
            const valSpan = document.getElementById('opt-val-' + id.replace('opt-', ''));
            if (valSpan) valSpan.innerText = suffix ? parseFloat(val).toFixed(1) + suffix : parseInt(val);
        };

        setUI('opt-hp', data.hp, 'x');
        setUI('opt-dmg', data.dmg, 'x');
        setUI('opt-spawn', data.spawn, 'x');
        setUI('opt-xp', data.xp, 'x');
        setUI('opt-php', data.php, 'x');
        setUI('opt-pdmg', data.pdmg, 'x');
        setUI('opt-lvl', data.lvl);
        setUI('opt-maxmobs', data.maxmobs);
        setUI('opt-luck-prism', data.luckprism, 'x');
        setUI('opt-luck-mini', data.luckmini, 'x');

        const chkEvents = document.getElementById('opt-events');
        if (chkEvents) chkEvents.checked = data.events;

        document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('preset-' + presetName);
        if (activeBtn) activeBtn.classList.add('active');
    },

    switchOptionsTab: function(tabName, clickedBtn) {
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const target = document.getElementById('tab-content-' + tabName);
        if (target) target.classList.add('active');

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (clickedBtn) clickedBtn.classList.add('active');

        if (tabName === 'camps') {
            setTimeout(() => {
                if (CampPreview) {
                    CampPreview.init();
                }
            }, 50);
        } else {
            if (CampPreview) {
                CampPreview.dispose();
            }
        }
    },

    onSliderChange: function() {
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.classList.remove('active');
        });
    },
    
    toggleAllCamps: function(enable) {
        const camps = ['tent', 'portal', 'barricade', 'obelisk', 'treasure', 'ritual', 'crypt', 'shrine', 'forge', 'frozen', 'ruins'];
        camps.forEach(type => {
            const chk = document.getElementById(`opt-camp-${type}-enabled`);
            if (chk) {
                chk.checked = enable;
                const card = document.getElementById(`camp-card-${type}`);
                if (card) {
                    card.style.opacity = enable ? '1.0' : '0.55';
                }
            }
        });
        this.onSliderChange();
    },
    
    updateHUD: function() {
        const p = Globals.player;
        if(!p) return;

        // --- BARRE DE VIE ---
        const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
        const bar1 = document.getElementById('hp-bar'); 
        if(bar1) { 
            bar1.style.width = hpPct + '%'; 
            if(!bar1.style.backgroundColor) bar1.style.backgroundColor = '#e74c3c'; 
        }

        const hpText = document.getElementById('hp-text');
        if(hpText) hpText.innerText = `${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;

        // --- BARRE XP ---
        const xpPct = Math.max(0, (STATE.xp / STATE.xpToNext) * 100);
        const xpBar = document.getElementById('xp-bar');
        if(xpBar) { 
            xpBar.style.width = xpPct + '%'; 
            if(!xpBar.style.backgroundColor) xpBar.style.backgroundColor = '#3498db'; 
        }

        const lvlText = document.getElementById('level-text');
        if(lvlText) lvlText.innerText = STATE.level;

        const killCounter = document.getElementById('kill-count-val');
        if(killCounter) killCounter.innerText = STATE.enemiesKilled;

        // --- BOUCLIER ---
        const shieldBar = document.getElementById('shield-bar');
        if(shieldBar) {
            if(p.bloodShield > 0) {
                const sPct = (p.bloodShield / p.maxHp) * 100;
                shieldBar.style.width = sPct + '%';
                shieldBar.style.backgroundColor = '#8e44ad'; 
                shieldBar.style.opacity = 1;
            } else {
                shieldBar.style.width = '0%';
                shieldBar.style.opacity = 0;
            }
        }

        // --- BADGE POINTS DE TALENTS ---
        const badge = document.getElementById('skill-point-badge');
        if (badge) {
            if (STATE.skillPoints > 0) {
                badge.style.display = 'flex';
                badge.innerText = STATE.skillPoints;
            } else {
                badge.style.display = 'none';
            }
        }

        if (window.BuffBar) window.BuffBar.render();
    },

    selectClass: function(cls, el) {
        document.querySelectorAll('.class-card-accordion').forEach(c => c.classList.remove('selected'));
        if (el) el.classList.add('selected');
        STATE.class = cls;
        // AudioSys access via global or import needed if used here, removed for modularity simplicity or pass as dependency
        
        // Gestion des boutons Start/Ready et Options
        const btnStart = document.getElementById('btn-start-game');
        const btnReady = document.getElementById('btn-ready-game');
        const btnOptions = document.getElementById('btn-game-options');
        
        if (STATE.multiplayer.active) {
            if (STATE.multiplayer.isHost) {
                 if(btnStart) { btnStart.style.display = 'block'; btnStart.style.opacity = 1; btnStart.style.cursor = 'pointer'; btnStart.disabled = false; }
                 if(btnReady) btnReady.style.display = 'none';
                 if(btnOptions) btnOptions.style.display = 'flex';
            } else {
                 if(btnReady) { btnReady.style.display = 'block'; btnReady.style.opacity = 1; btnReady.style.cursor = 'pointer'; btnReady.disabled = false; }
                 if(btnStart) btnStart.style.display = 'none';
                 if(btnOptions) btnOptions.style.display = 'none';
            }
        } else {
             if(btnStart) { btnStart.style.display = 'block'; btnStart.style.opacity = 1; btnStart.style.cursor = 'pointer'; btnStart.disabled = false; }
             if(btnOptions) btnOptions.style.display = 'flex';
        }
    },

    togglePauseMenu: function() {
        const pm = document.getElementById('pause-menu');
        if (!pm) return;
        
        const isVisible = pm.style.display === 'flex';
        if (isVisible) {
            pm.style.display = 'none';
            if (!STATE.multiplayer.active) STATE.isPaused = false;
        } else {
            // Cache tous les écrans
            this.screens.forEach(s => {
                const el = document.getElementById(`screen-${s}`);
                if(el) el.classList.remove('active');
            });
            if (CampPreview) CampPreview.dispose();
            pm.style.display = 'flex';
            if (!STATE.multiplayer.active) STATE.isPaused = true;
        }
    },

    openInGameOptions: function() {
        const pm = document.getElementById('pause-menu');
        if (pm) pm.style.display = 'none';
        
        this.show('options');
    },

    closeInGameOptions: function() {
        this.screens.forEach(s => {
            const el = document.getElementById(`screen-${s}`);
            if(el) el.classList.remove('active');
        });
        if (CampPreview) CampPreview.dispose();
        
        const pm = document.getElementById('pause-menu');
        if (pm) {
            pm.style.display = 'flex';
        } else {
            if (!STATE.multiplayer.active) STATE.isPaused = false;
        }
    },

    quitToMainMenu: function() {
        if (confirm("Abandonner l'expédition en cours ? Votre progression non sauvegardée sera perdue.")) {
            location.reload();
        }
    },

    applyGraphicsSettings: function() {
        if (!STATE.gameOptions) return;
        
        // 1. Échelle de résolution
        const resScale = (STATE.gameOptions.resolutionScale || 100) / 100;
        if (Globals.renderer) {
            Globals.renderer.setPixelRatio(window.devicePixelRatio * resScale);
            Globals.renderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        // 2. Végétation & Décors
        const density = STATE.gameOptions.decoDensity !== undefined ? STATE.gameOptions.decoDensity : 4;
        if (Globals.decoGroup) {
            if (density === 1) {
                Globals.decoGroup.visible = false;
            } else {
                Globals.decoGroup.visible = true;
                let index = 0;
                Globals.decoGroup.children.forEach(child => {
                    if (density === 2) {
                        // Faible : 25% visibles (1 sur 4)
                        child.visible = index % 4 === 0;
                    } else if (density === 3) {
                        // Moyen : 50% visibles (1 sur 2)
                        child.visible = index % 2 === 0;
                    } else {
                        // Élevé : 100% visibles
                        child.visible = true;
                    }
                    index++;
                });
            }
        }
        
        // 2b. Ombres portées
        applyShadowQuality(STATE.gameOptions.shadowQuality !== undefined ? STATE.gameOptions.shadowQuality : 3);

        // 3. Qualité de l'Eau
        const waterQ = STATE.gameOptions.waterQuality !== undefined ? STATE.gameOptions.waterQuality : 3;
        if (Globals.water && Globals.water.material) {
            if (waterQ === 1) {
                // Basse : unie opaque et mate
                Globals.water.material.color.setHex(0x0f5e9c);
                Globals.water.material.roughness = 1.0;
                Globals.water.material.metalness = 0.0;
                Globals.water.material.transparent = false;
                Globals.water.material.opacity = 1.0;
            } else if (waterQ === 2) {
                // Moyenne : transparente simple sans métal
                Globals.water.material.color.setHex(0x0f5e9c);
                Globals.water.material.roughness = 0.5;
                Globals.water.material.metalness = 0.1;
                Globals.water.material.transparent = true;
                Globals.water.material.opacity = 0.7;
            } else {
                // Haute : réaliste métallique brillante
                Globals.water.material.color.setHex(0x0f5e9c);
                Globals.water.material.roughness = 0.1;
                Globals.water.material.metalness = 0.8;
                Globals.water.material.transparent = true;
                Globals.water.material.opacity = 0.85;
            }
            Globals.water.material.needsUpdate = true;
        }

        // 4. Brume (Fog)
        const fogActive = STATE.gameOptions.isFogActive !== false;
        if (Globals.scene) {
            if (fogActive) {
                if (!Globals.scene.fog) {
                    Globals.scene.fog = new THREE.FogExp2(0xffffff, 0.005);
                }
            } else {
                Globals.scene.fog = null;
            }
        }

        // 5. Compteur FPS
        const showFps = !!STATE.gameOptions.showFps;
        const fpsCounter = document.getElementById('fps-counter');
        if (fpsCounter) {
            fpsCounter.style.display = showFps ? 'block' : 'none';
        }
    }
};