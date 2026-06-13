// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';

export const UICore = {
    // AJOUT DE 'forge' ET 'options' DANS LA LISTE DES ÉCRANS
    screens: ['landing', 'mode', 'host', 'join', 'class', 'compendium', 'forge', 'options'], 
    
    show: function(id) {
        // Cache tous les écrans
        this.screens.forEach(s => {
            const el = document.getElementById(`screen-${s}`);
            if(el) el.classList.remove('active');
        });

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
                if (vel) vel.innerText = suffix ? parseFloat(val).toFixed(1) + suffix : parseInt(val);
            };
            setVal('opt-hp', 'opt-val-hp', STATE.gameOptions.enemyHpMult, 'x');
            setVal('opt-dmg', 'opt-val-dmg', STATE.gameOptions.enemyDmgMult, 'x');
            setVal('opt-spawn', 'opt-val-spawn', STATE.gameOptions.enemySpawnRate, 'x');
            setVal('opt-xp', 'opt-val-xp', STATE.gameOptions.xpMult, 'x');
            setVal('opt-php', 'opt-val-php', STATE.gameOptions.playerHpMult, 'x');
            setVal('opt-pdmg', 'opt-val-pdmg', STATE.gameOptions.playerDmgMult, 'x');
            setVal('opt-lvl', 'opt-val-lvl', STATE.gameOptions.startLevel);
            
            const chkEvents = document.getElementById('opt-events');
            if (chkEvents) chkEvents.checked = !!STATE.gameOptions.isEventsActive;
            
            setVal('opt-maxmobs', 'opt-val-maxmobs', STATE.gameOptions.maxMobDisplay);
            setVal('opt-luck-prism', 'opt-val-luck-prism', STATE.gameOptions.luckMultPrismatic, 'x');
            setVal('opt-luck-mini', 'opt-val-luck-mini', STATE.gameOptions.luckMultMiniBoss, 'x');

            // Presets check
            const presets = {
                exploration: { hp: 0.5, dmg: 0.5, spawn: 0.8, xp: 1.5, php: 1.5, pdmg: 1.5, lvl: 5, maxmobs: 20, luckprism: 1.5, luckmini: 1.0, events: true },
                survivant: { hp: 1.0, dmg: 1.0, spawn: 1.0, xp: 1.0, php: 1.0, pdmg: 1.0, lvl: 1, maxmobs: 30, luckprism: 1.0, luckmini: 1.0, events: true },
                champion: { hp: 2.0, dmg: 2.0, spawn: 1.4, xp: 1.2, php: 1.0, pdmg: 1.0, lvl: 1, maxmobs: 45, luckprism: 1.5, luckmini: 1.5, events: true },
                cauchemar: { hp: 4.5, dmg: 4.0, spawn: 2.0, xp: 2.0, php: 0.8, pdmg: 0.8, lvl: 1, maxmobs: 60, luckprism: 2.0, luckmini: 2.0, events: true }
            };

            document.querySelectorAll('.btn-preset').forEach(btn => btn.classList.remove('active'));

            let matchedPreset = null;
            for (const [name, data] of Object.entries(presets)) {
                if (
                    Math.abs(STATE.gameOptions.enemyHpMult - data.hp) < 0.01 &&
                    Math.abs(STATE.gameOptions.enemyDmgMult - data.dmg) < 0.01 &&
                    Math.abs(STATE.gameOptions.enemySpawnRate - data.spawn) < 0.01 &&
                    Math.abs(STATE.gameOptions.xpMult - data.xp) < 0.01 &&
                    Math.abs(STATE.gameOptions.playerHpMult - data.php) < 0.01 &&
                    Math.abs(STATE.gameOptions.playerDmgMult - data.pdmg) < 0.01 &&
                    STATE.gameOptions.startLevel === data.lvl &&
                    STATE.gameOptions.maxMobDisplay === data.maxmobs &&
                    Math.abs(STATE.gameOptions.luckMultPrismatic - data.luckprism) < 0.01 &&
                    Math.abs(STATE.gameOptions.luckMultMiniBoss - data.luckmini) < 0.01 &&
                    !!STATE.gameOptions.isEventsActive === data.events
                ) {
                    matchedPreset = name;
                    break;
                }
            }

            if (matchedPreset) {
                const activeBtn = document.getElementById('preset-' + matchedPreset);
                if (activeBtn) activeBtn.classList.add('active');
            }
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
    
    saveOptionsAndReturn: function() {
        if (!STATE.gameOptions) STATE.gameOptions = {};
        
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? parseFloat(el.value) : 1.0;
        };
        
        STATE.gameOptions.enemyHpMult = getVal('opt-hp');
        STATE.gameOptions.enemyDmgMult = getVal('opt-dmg');
        STATE.gameOptions.enemySpawnRate = getVal('opt-spawn');
        STATE.gameOptions.xpMult = getVal('opt-xp');
        STATE.gameOptions.playerHpMult = getVal('opt-php');
        STATE.gameOptions.playerDmgMult = getVal('opt-pdmg');
        
        const lvlEl = document.getElementById('opt-lvl');
        STATE.gameOptions.startLevel = lvlEl ? parseInt(lvlEl.value) : 1;
        
        const chkEvents = document.getElementById('opt-events');
        STATE.gameOptions.isEventsActive = chkEvents ? chkEvents.checked : true;
        
        const maxMobsEl = document.getElementById('opt-maxmobs');
        STATE.gameOptions.maxMobDisplay = maxMobsEl ? parseInt(maxMobsEl.value) : 30;
        
        STATE.gameOptions.luckMultPrismatic = getVal('opt-luck-prism');
        STATE.gameOptions.luckMultMiniBoss = getVal('opt-luck-mini');
        
        // Save to localStorage
        try {
            localStorage.setItem('slime_game_options', JSON.stringify(STATE.gameOptions));
        } catch (e) {
            console.error("Failed to save game options to localStorage", e);
        }
        
        this.toast("Options sauvegardées !");
        this.show('class');
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
    },

    onSliderChange: function() {
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.classList.remove('active');
        });
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
        el.classList.add('selected');
        STATE.class = cls;
        if (window.SkillTree?.render) window.SkillTree.render();
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
    }
};