// @ts-nocheck
import { STATE, CONFIG } from '../core/config';
import { Globals, GameActions, setPlayer, addEnemy, removeEnemy } from '../core/globals';
import { AudioSys } from '../core/ressources';
import { Network } from '@/multiplayer/network';
import { UI, SkillTree } from '../visual/ui';
import { Player } from './player';
import { Enemy } from './enemy';
import { createDamageText } from '../visual/effects';
import { createAltars } from './environment';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { pickMobSpawnType, randomWildSpawnPos, BOSS_ZONE } from './world/worldZones';

const MINI_BOSS_SPAWN_CHANCE = 0.03;

const MINI_BOSS_MOB_TYPE: Record<string, string> = {
    verdant_stalker: 'rogue',
    iron_warden: 'sentinel',
    arcane_herald: 'warlock',
    corrupt_warden: 'corrupted',
};

import { applyMiniBossVariant } from './enemies/minions/mini_boss';

export const GameLogic = {
    
    setAmbiance: function(type) {
        if (!Globals.scene) return;
        
        // Note: ground devrait être accessible via Globals si on veut le modifier ici, 
        // ou on le cherche dans la scène.
        const ground = Globals.scene.children.find(c => c.geometry && c.geometry.type === 'PlaneGeometry');

        if (type === 'dark') {
            Globals.scene.fog = new THREE.FogExp2(0x050505, 0.04);
            Globals.scene.background = new THREE.Color(0x050505);
            Globals.dirLight.intensity = 0.2;
            Globals.hemiLight.intensity = 0.2;
            if(ground) ground.material.color.setHex(0x555555);
        } else {
            Globals.scene.fog = new THREE.FogExp2(0xffffff, 0.005);
            Globals.scene.background = new THREE.Color(CONFIG.colors.skyNormal);
            Globals.dirLight.intensity = 1.2;
            Globals.hemiLight.intensity = 1.0;
            if(ground) ground.material.color.setHex(0xffffff);
        }
    },

    gainXp: function(amount) {
        const mult = STATE.stats.xpMod || 1.0;
        STATE.xp += amount * mult;

        let leveled = false;
        while (STATE.xp >= STATE.xpToNext) {
            STATE.xp -= STATE.xpToNext;
            STATE.level++;
            STATE.skillPoints++;
            leveled = true;

            const baseMobXp = 35 * (1 + STATE.level * 0.1);
            const killsNeeded = 3 + Math.min(5, STATE.level * 0.25);
            STATE.xpToNext = Math.floor(baseMobXp * killsNeeded);

            if (Globals.player) {
                Globals.player.hp = Globals.player.maxHp;
                STATE.stats.atk += 2;
            }
        }

        if (leveled) {
            if (AudioSys.sfx.levelup) AudioSys.sfx.levelup();

            const btn = document.getElementById('skill-tree-btn');
            if (btn) {
                btn.style.borderColor = '#fff';
                setTimeout(() => btn.style.borderColor = 'var(--gold)', 2000);
            }
        }

        UI.updateHUD();
    },

    spawnEnemy: function() {
        if (STATE.bossSpawned) return;

        const spawnType = pickMobSpawnType(STATE.level);
        const pos = randomWildSpawnPos();

        const type = spawnType.mobs[Math.floor(Math.random() * spawnType.mobs.length)];
        const spawnMini = Math.random() < MINI_BOSS_SPAWN_CHANCE && spawnType.miniBoss;
        const e = new Enemy(type, pos);
        if (spawnMini && spawnType.miniBoss) applyMiniBossVariant(e, spawnType.miniBoss);
        addEnemy(e);
    },

    /** Debug : spawn Mini-Boss. tiers optionnel : 'champion|executeur' ou tableau. */
    spawnMiniBoss: function(miniId = 'random', tiers = null) {
        if (STATE.bossSpawned) {
            console.warn('[Debug] Impossible pendant un combat de boss.');
            return null;
        }
        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) {
            console.warn('[Debug] spawnMiniBoss : hôte uniquement en multijoueur.');
            return null;
        }
        if (!Globals.player) return null;

        const ids = Object.keys(MINI_BOSS_MOB_TYPE);
        let resolvedId = miniId;
        if (!miniId || miniId === 'random') {
            resolvedId = ids[Math.floor(Math.random() * ids.length)];
        }
        const mobType = MINI_BOSS_MOB_TYPE[resolvedId];
        if (!mobType) {
            console.warn(
                `[Debug] Mini-Boss inconnu: "${miniId}". Valides: ${ids.join(', ')}, random`,
            );
            return null;
        }

        const pos = Globals.player.position.clone();
        pos.x += 5;
        pos.z += (Math.random() - 0.5) * 3;
        pos.y = 0;

        const e = new Enemy(mobType, pos);
        applyMiniBossVariant(e, resolvedId, tiers ? { tiers } : {});
        addEnemy(e);
        console.log(
            `[Debug] Mini-Boss: ${resolvedId} | ${(e.miniBossTiers || []).join('|') || 'sans tier'}`,
        );
        return e;
    },

    spawnBoss: function(type = 'king') {
        if (STATE.bossSpawned) return;
        STATE.bossSpawned = true;
        STATE.isBossFight = true;
        STATE.enemiesKilled = 0;
        this.setAmbiance('dark');
        
        if (type === 'slime_lord') AudioSys.playBgm('boss_void');
        else AudioSys.playBgm('boss_king');
        
        if(AudioSys.sfx.bossSpawn) AudioSys.sfx.bossSpawn();

        // Nettoyage Ennemis & Autels
        for (let i = Globals.enemies.length - 1; i >= 0; i--) {
            const e = Globals.enemies[i];
            if (!e.isPlayer) {
                if(e.mesh) Globals.scene.remove(e.mesh);
                if(e instanceof THREE.Object3D) Globals.scene.remove(e);
                if(e.labelSprite) Globals.scene.remove(e.labelSprite);
                removeEnemy(e);
            }
        }
        for(let i = Globals.scene.children.length - 1; i >= 0; i--) {
            const child = Globals.scene.children[i];
            if(child.type === 'royal_seal' || child.type === 'void_altar' || (child.userData && (child.userData.type === 'royal_seal' || child.userData.type === 'void_altar'))) {
                Globals.scene.remove(child);
            }
        }

        if (Globals.player) Globals.player.position.set(BOSS_ZONE.cx, 0, BOSS_ZONE.cz + 14);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'boss-teleport' });
        }

        const pos = new THREE.Vector3(BOSS_ZONE.cx, 0, BOSS_ZONE.cz - 6);
        const e = new Enemy(type, pos);
        addEnemy(e);

        const msg = type === 'king' ? "LE ROI EST LÀ !" : "LE SEIGNEUR SLIME APPROCHE !";
        const color = type === 'king' ? "#ffd700" : "#9b59b6";
        if (Globals.player) createDamageText(msg, Globals.player.position, color);
    },

    triggerWipe: function() {
        const overlay = document.getElementById('wipe-overlay');
        if (overlay) overlay.style.opacity = 1;

        if (STATE.multiplayer.active && STATE.multiplayer.isHost) { Network.send({ type: 'wipe-signal' }); }

        setTimeout(() => {
            if (Globals.player) {
                Globals.player.respawn();
                Globals.player.position.set(0, 0, 0);
                STATE.leftSafeZone = false;
            }

            Globals.enemies.forEach(e => { Globals.scene.remove(e); });
            Globals.enemies.length = 0;

            STATE.bossSpawned = false;
            STATE.isBossFight = false;
            this.setAmbiance('normal');
            AudioSys.playBgm('explore'); 
            
            createAltars();

            document.getElementById('boss-hud').style.display = 'none';
            document.getElementById('btn-respawn').style.display = 'block';
            document.getElementById('spectate-msg').style.display = 'none';

            if (overlay) setTimeout(() => overlay.style.opacity = 0, 500);
        }, 2000);
    },

    checkBossVictory: function() {
        if (STATE.isBossFight && STATE.bossSpawned) {
            const bossAlive = Globals.enemies.some(e => 
                !e.dead && 
                (e.isBoss || (e instanceof Enemy && (e.type === 'king' || e.type === 'slime_lord')))
            );
            
            if (!bossAlive) {
                console.log("BOSS VAINCU - VICTOIRE");
                STATE.bossSpawned = false;
                STATE.isBossFight = false;

                if (!STATE.bossProgress['king']) STATE.bossProgress['king'] = 0;
                STATE.bossProgress['king']++;
                const currentNG = STATE.bossProgress['king'];

                UI.toast(`VICTOIRE ! ROI VAINCU (NG+${currentNG})`);
                
                this.gainXp(500 * (1 + currentNG * 0.2));

                AudioSys.playBgm('explore');
                this.setAmbiance('normal');
                
                setTimeout(() => {
                    UI.toast("Les sceaux se reforment...");
                    createAltars();
                }, 4000);
            }
        }
    },

    startGameLogic: function() {
        document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
        document.getElementById('hud').style.display = 'block';
        document.getElementById('skills-hud').style.display = 'flex';
        document.getElementById('passive-hud').style.display = 'block';

        AudioSys.playBgm('explore'); 

        STATE.leftSafeZone = false;
        const p = new Player(STATE.class);
        setPlayer(p);
        p.position.set(90, 0, 90);
        this.reapplyAllSkillBonuses();

        Globals.camera.position.set(90, 20, 100);
        Globals.camera.lookAt(90, 0, 90);

        setTimeout(() => {
            UI.toast("Choisissez un Fragment de depart !");
            UI.showPrismaticReward();
        }, 200);

        if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
    },

    reapplyAllSkillBonuses: function() {
        ConstellationEngine.recalculate();
        if (window.NewSkillUI?.updatePassiveDisplay) window.NewSkillUI.updatePassiveDisplay();
        if (window.BuffBar) window.BuffBar.render();
        UI.updateHUD();
    },
    
    tryInteractLocal: function() {
        if (!Globals.player || STATE.bossSpawned) return;
        let targetAltar = null;
        for (let m of Globals.menhirs) {
            if (Globals.player.position.distanceTo(m.position) < 6) { targetAltar = m; break; }
        }
        if (targetAltar) {
            const cost = targetAltar.userData.bossType === 'slime_lord' ? 20 : 10;
            if (STATE.enemiesKilled >= cost) {
                if (STATE.multiplayer.active) {
                    if (STATE.multiplayer.isHost) { 
                        this.spawnBoss(targetAltar.userData.bossType); 
                        Network.send({ type: 'boss-spawn', bossType: targetAltar.userData.bossType }); 
                    } else { 
                        Network.send({ type: 'request-boss', bossType: targetAltar.userData.bossType }); 
                    }
                } else { 
                    this.spawnBoss(targetAltar.userData.bossType); 
                }
            } else {
                UI.toast(`Il faut ${cost} kills (Actuel: ${STATE.enemiesKilled})`);
            }
        }
    }
};

// Initialisation des GameActions globaux pour compatibilité
GameActions.spawnBoss = GameLogic.spawnBoss.bind(GameLogic);
GameActions.triggerWipe = GameLogic.triggerWipe.bind(GameLogic);
GameActions.startGameLogic = GameLogic.startGameLogic.bind(GameLogic);
GameActions.setAmbiance = GameLogic.setAmbiance.bind(GameLogic);
GameActions.gainXp = GameLogic.gainXp.bind(GameLogic);

export const GameLauncher = {
    launchHost: function () {
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) Network.send({ type: 'game-start-signal' });
        GameLogic.startGameLogic();
    },
    clientReady: function () {
        if (STATE.class) {
            document.getElementById('btn-ready-game').disabled = true;
            document.getElementById('waiting-host-msg').style.display = 'block';
            document.querySelector('.class-container-accordion').style.opacity = '0.5';
            document.querySelector('.class-container-accordion').style.pointerEvents = 'none';
            Network.send({ type: 'player-ready', class: STATE.class, id: STATE.multiplayer.id });
            UI.toast("Prêt ! En attente de l'hôte...");
        }
    }
};