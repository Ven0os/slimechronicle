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
            const setVal = (elId, valId, val) => {
                const el = document.getElementById(elId);
                const vel = document.getElementById(valId);
                if (el) el.value = val;
                if (vel) vel.innerText = val;
            };
            setVal('opt-hp', 'opt-val-hp', STATE.gameOptions.enemyHpMult);
            setVal('opt-dmg', 'opt-val-dmg', STATE.gameOptions.enemyDmgMult);
            setVal('opt-spawn', 'opt-val-spawn', STATE.gameOptions.enemySpawnRate);
            setVal('opt-xp', 'opt-val-xp', STATE.gameOptions.xpMult);
            setVal('opt-php', 'opt-val-php', STATE.gameOptions.playerHpMult);
            setVal('opt-pdmg', 'opt-val-pdmg', STATE.gameOptions.playerDmgMult);
            setVal('opt-lvl', 'opt-val-lvl', STATE.gameOptions.startLevel);
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
        
        this.toast("Options sauvegardées !");
        this.show('class');
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