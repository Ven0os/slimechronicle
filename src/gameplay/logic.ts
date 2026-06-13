// @ts-nocheck
import * as THREE from 'three';
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

function spawnRogueTent(pos) {
    if (!Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = 0;

    // Canvas Cover (Cone)
    const coverGeo = new THREE.ConeGeometry(1.6, 2.0, 5);
    const coverMat = new THREE.MeshStandardMaterial({
        color: 0x70523d, // Rustic canvas brown
        roughness: 0.9,
        flatShading: true
    });
    const cover = new THREE.Mesh(coverGeo, coverMat);
    cover.position.y = 1.0;
    cover.rotation.y = Math.PI / 5;
    cover.castShadow = true;
    cover.receiveShadow = true;
    group.add(cover);

    // Support Poles (V-shape at front)
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 });
    
    const poleL = new THREE.Mesh(poleGeo, poleMat);
    poleL.position.set(-0.6, 0.9, 1.1);
    poleL.rotation.z = -0.3;
    poleL.rotation.y = 0.2;
    group.add(poleL);

    const poleR = new THREE.Mesh(poleGeo, poleMat);
    poleR.position.set(0.6, 0.9, 1.1);
    poleR.rotation.z = 0.3;
    poleR.rotation.y = -0.2;
    group.add(poleR);

    // Inner Glowing Campfire (warm orange light) - Mesh only, no pointlight to prevent WebGL compile lag
    const fireGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    fire.position.set(0, 0.1, 0.8);
    group.add(fire);

    Globals.scene.add(group);
    
    // Add collision
    if (!Globals.obstacles) Globals.obstacles = [];
    const obstacle = {
        position: pos.clone(),
        radius: 1.8
    };
    Globals.obstacles.push(obstacle);

    return { group, obstacle };
}

function spawnArcanePortal(pos) {
    if (!Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = 0;

    // Runic Base (Dark stone cylinder)
    const baseGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.15, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x221a2b, roughness: 0.85, flatShading: true });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.receiveShadow = true;
    group.add(base);

    // Glowing void glyph center (Torus)
    const glyphGeo = new THREE.TorusGeometry(1.0, 0.08, 8, 24);
    const glyphMat = new THREE.MeshBasicMaterial({ color: 0x9d4edd });
    const glyph = new THREE.Mesh(glyphGeo, glyphMat);
    glyph.rotation.x = Math.PI / 2;
    glyph.position.y = 0.16;
    group.add(glyph);

    // Floating Crystal (Obelisk)
    const crystalGeo = new THREE.OctahedronGeometry(0.38, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x2b0f54,
        emissive: 0xbd00ff,
        emissiveIntensity: 2.5,
        roughness: 0.1,
        metalness: 0.95
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 1.2;
    crystal.castShadow = true;
    group.add(crystal);

    Globals.scene.add(group);

    // Simple floating rotation animation
    const animatePortal = () => {
        if (!group.parent || group.scale.x < 0.1) return;
        crystal.rotation.y += 0.02;
        crystal.position.y = 1.2 + Math.sin(Date.now() * 0.003) * 0.15;
        requestAnimationFrame(animatePortal);
    };
    animatePortal();

    // Add collision
    if (!Globals.obstacles) Globals.obstacles = [];
    const obstacle = {
        position: pos.clone(),
        radius: 1.4
    };
    Globals.obstacles.push(obstacle);

    return { group, obstacle };
}

function spawnSpikedBarricade(pos) {
    if (!Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = 0;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4a3c, roughness: 0.9 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x423429, roughness: 0.8 });

    // Spiked log 1, 2, 3
    const logHeight = 1.4;
    const logGeo = new THREE.CylinderGeometry(0.12, 0.12, logHeight, 5);
    const tipGeo = new THREE.ConeGeometry(0.12, 0.35, 5);

    const offsetsX = [-0.6, 0, 0.6];
    offsetsX.forEach(ox => {
        const logGroup = new THREE.Group();
        logGroup.position.set(ox, logHeight/2, 0);
        logGroup.rotation.x = -0.3; // Tilt forward

        const log = new THREE.Mesh(logGeo, woodMat);
        log.castShadow = true;
        logGroup.add(log);

        const tip = new THREE.Mesh(tipGeo, spikeMat);
        tip.position.y = logHeight / 2 + 0.15;
        tip.castShadow = true;
        logGroup.add(tip);

        group.add(logGroup);
    });

    // Crossbar log
    const barGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 5);
    const bar = new THREE.Mesh(barGeo, woodMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.5, 0.15);
    group.add(bar);

    Globals.scene.add(group);

    // Add collision
    if (!Globals.obstacles) Globals.obstacles = [];
    const obstacle = {
        position: pos.clone(),
        radius: 1.6
    };
    Globals.obstacles.push(obstacle);

    return { group, obstacle };
}

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
                if (STATE.class === 'warrior') {
                    STATE.stats.defense = (STATE.stats.defense ?? 85) + 2;
                } else {
                    STATE.stats.atk += 2;
                }
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

        // --- 15 VARIANTES DE SPAWN (GANGS / PACKS) ---
        const GANG_VARIANTS = [
            // --- 7 VARIANTES STANDARD ---
            {
                mobs: [
                    { type: 'sentinel' },
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'sentinel' },
                    { type: 'sentinel' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'warlock' },
                    { type: 'warlock' },
                    { type: 'sentinel' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'corrupted' },
                    { type: 'corrupted' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'royal_guard' },
                    { type: 'royal_guard' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'sentinel' },
                    { type: 'warlock' },
                    { type: 'rogue' },
                    { type: 'corrupted' },
                    { type: 'shaman' }
                ]
            },

            // --- 8 VARIANTES AVEC MINI-BOSS ---
            {
                mobs: [
                    { type: 'rogue', miniBoss: 'verdant_stalker' },
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'sentinel', miniBoss: 'iron_warden' },
                    { type: 'sentinel' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'warlock', miniBoss: 'arcane_herald' },
                    { type: 'warlock' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'corrupted', miniBoss: 'corrupt_warden' },
                    { type: 'corrupted' },
                    { type: 'corrupted' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'rogue', miniBoss: 'verdant_stalker' },
                    { type: 'warlock', miniBoss: 'arcane_herald' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'sentinel', miniBoss: 'iron_warden' },
                    { type: 'royal_guard' },
                    { type: 'royal_guard' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'rogue', miniBoss: 'verdant_stalker' },
                    { type: 'corrupted' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                mobs: [
                    { type: 'corrupted', miniBoss: 'corrupt_warden' },
                    { type: 'sentinel', miniBoss: 'iron_warden' },
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            }
        ];

        // 25% chance of spawning a mini-boss pack if player level is at least 2
        const isMiniBossVariant = Math.random() < 0.25 && STATE.level >= 2;
        let variantIndex;
        if (isMiniBossVariant) {
            // Choose from variants index 7 to 14
            variantIndex = 7 + Math.floor(Math.random() * 8);
        } else {
            // Choose from variants index 0 to 6
            variantIndex = Math.floor(Math.random() * 7);
        }

        const variant = GANG_VARIANTS[variantIndex];

        // Non-overlapping / Spaced-out spawn position finder
        let centerPos = null;
        let attempts = 0;
        const minDistanceToPlayer = 22.0;
        const minDistanceToOtherEnemies = 20.0;

        while (attempts < 50) {
            const candidate = randomWildSpawnPos();
            attempts++;

            // Distance to player check
            if (Globals.player) {
                if (candidate.distanceTo(Globals.player.position) < minDistanceToPlayer) {
                    continue;
                }
            }

            // Distance to other active enemies check
            let tooClose = false;
            if (Globals.enemies) {
                for (const e of Globals.enemies) {
                    if (e.dead) continue;
                    if (candidate.distanceTo(e.position) < minDistanceToOtherEnemies) {
                        tooClose = true;
                        break;
                    }
                }
            }

            if (!tooClose) {
                centerPos = candidate;
                break;
            }
        }

        if (!centerPos) {
            centerPos = randomWildSpawnPos(); // Fallback
        }

        // Spawn building structure at the center
        let spawnedBuilding = false;
        let buildingData = null;
        if (variantIndex === 2 || variantIndex === 7 || variantIndex === 13 || variantIndex === 14) {
            buildingData = spawnRogueTent(centerPos);
            spawnedBuilding = true;
        } else if (variantIndex === 3 || variantIndex === 4 || variantIndex === 9 || variantIndex === 10 || variantIndex === 11) {
            buildingData = spawnArcanePortal(centerPos);
            spawnedBuilding = true;
        } else if (variantIndex === 0 || variantIndex === 1 || variantIndex === 5 || variantIndex === 8 || variantIndex === 12) {
            buildingData = spawnSpikedBarricade(centerPos);
            spawnedBuilding = true;
        }

        const campMobs = [];
        // Spawn enemies around the camp center
        variant.mobs.forEach((mobDef, idx) => {
            const angle = (idx / variant.mobs.length) * Math.PI * 2;
            // Radius is slightly larger if a building is spawned at center to avoid overlapping with it
            const r = spawnedBuilding ? (3.2 + Math.random() * 1.5) : (1.5 + Math.random() * 2.0);
            const spawnPos = centerPos.clone().add(new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
            
            const e = new Enemy(mobDef.type, spawnPos);
            if (mobDef.miniBoss) {
                applyMiniBossVariant(e, mobDef.miniBoss);
            }
            campMobs.push(e);
            addEnemy(e);
        });

        if (spawnedBuilding && buildingData) {
            Globals.activeCamps = Globals.activeCamps || [];
            Globals.activeCamps.push({
                building: buildingData.group,
                obstacle: buildingData.obstacle,
                mobs: campMobs
            });
        }
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

    updateActiveCamps: function(dt) {
        if (!Globals.activeCamps) return;
        
        for (let i = Globals.activeCamps.length - 1; i >= 0; i--) {
            const camp = Globals.activeCamps[i];
            
            // Check if all mobs in this camp are dead or removed from Globals.enemies
            const allDead = camp.mobs.every(m => m.dead || !Globals.enemies.includes(m));
            
            if (allDead) {
                // Despawn building with a shrink animation
                if (camp.building) {
                    const b = camp.building;
                    const shrink = () => {
                        if (b.scale.x > 0.05) {
                            b.scale.multiplyScalar(0.85); // Shrink out
                            requestAnimationFrame(shrink);
                        } else {
                            if (b.parent) b.parent.remove(b);
                            // Dispose geometries and materials
                            b.traverse(child => {
                                if (child.geometry) child.geometry.dispose();
                                if (child.material) {
                                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                                    else child.material.dispose();
                                }
                            });
                        }
                    };
                    shrink();
                }
                
                // Remove obstacle collision from Globals.obstacles
                if (camp.obstacle && Globals.obstacles) {
                    const idx = Globals.obstacles.indexOf(camp.obstacle);
                    if (idx > -1) {
                        Globals.obstacles.splice(idx, 1);
                    }
                }
                
                // Remove camp from active list
                Globals.activeCamps.splice(i, 1);
            }
        }
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