// @ts-nocheck
import { STATE } from '../core/config';
import { UI } from '../visual/ui';
import { Globals, GameActions } from '../core/globals';
import { AudioSys } from '../core/ressources';
import { createTelegraph, createSkillVisual, createDamageText, spawnParticles } from '../visual/effects';
import { Network } from './network';
import { NetSync } from './net_sync';
import { NetSkills } from './net_skills';
import { WorldEvents } from '../gameplay/events';

export function handleNetworkMessage(data) {
    if (data.type === 'world-update') { 
        if (!STATE.multiplayer.isHost) {
            NetSync.syncEnemies(data.enemies);
            NetSync.syncPlayers(data.players);
            STATE.enemiesKilled = data.kills;
            
            if(data.bossSpawned && !STATE.bossSpawned) { 
                STATE.bossSpawned = true; 
                if(GameActions.setAmbiance) GameActions.setAmbiance('dark'); 
                document.getElementById('boss-hud').style.display = 'flex'; 
            } 
            else if (!data.bossSpawned && STATE.bossSpawned) { 
                STATE.bossSpawned = false; 
                if(GameActions.setAmbiance) GameActions.setAmbiance('normal'); 
                document.getElementById('boss-hud').style.display = 'none'; 
            }
        }
    } 
    else if (data.type === 'client-input') {
        if (STATE.multiplayer.isHost) { 
            NetSync.updateRemotePlayer(data.id, data.pos, data.rot, data.class, data.dead); 
        }
    } 
    else if (data.type === 'net-action') { 
        const localId = String(STATE.multiplayer.id);
        const remoteId = String(data.id);
        if (localId === remoteId) return; 

        const pos = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
        const dir = data.dir ? new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z) : new THREE.Vector3(0,0,1);
        const remoteP = STATE.multiplayer.remotePlayers[data.id];

        if (remoteP) {
            if (remoteP.mesh) {
                const attackAngle = Math.atan2(dir.x, dir.z);
                remoteP.mesh.rotation.y = attackAngle;
                if (remoteP.netRotation !== undefined) remoteP.netRotation = attackAngle;
                if (!remoteP.isRemote) remoteP.isRemote = true;
                if (!remoteP.userData) remoteP.userData = {};
                remoteP.userData.isRemote = true;
            }
            NetSkills.triggerRemoteSkillVisual(data, remoteP);
        }

        if (STATE.multiplayer.isHost) {
             NetSkills.applyRemoteSkillLogic(data, pos, dir);
             Network.send(data); 
        }
    }

    // SPAWN EVENTS
    else if (data.type === 'event-spawn') {
        if (STATE.multiplayer.isHost) return; 
        const pos = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
        
        if (data.eventType === 'blood_altar') WorldEvents.spawnBloodAltar(pos, data.id);
        else if (data.eventType === 'geode') WorldEvents.spawnGeode(pos, data.id);
        else if (data.eventType === 'crystal_defense') WorldEvents.spawnCrystalDefense(pos, data.id);
        else if (data.eventType === 'rune_puzzle') WorldEvents.spawnRunePuzzle(pos, data.id);
        else if (data.eventType === 'elemental_pillars') WorldEvents.spawnElementalPillars(pos, data.id);
        else if (data.eventType === 'ancient_gong') WorldEvents.spawnAncientGong(pos, data.id);
        else if (data.eventType === 'laser_mirrors') WorldEvents.spawnLaserMirrors(pos, data.id);
        else if (data.eventType === 'light_ritual') WorldEvents.spawnLightRitual(pos, data.id);
        else if (data.eventType === 'glider_run') WorldEvents.spawnGliderRun(pos, data.id); // NOUVEAU
    }

    // UPDATE GENERAL EVENTS
    else if (data.type === 'event-update') {
        if (STATE.multiplayer.isHost) return;
        const ev = WorldEvents.interactables.find(e => e.userData.netId === data.id);
        if (ev) {
            if (ev.userData.onNetUpdate) ev.userData.onNetUpdate(data);
            if (data.state && ev.userData.setVisualState) ev.userData.setVisualState(data.state);
            if (data.action === 'start' && ev.userData.startEvent) ev.userData.startEvent();
            if (data.hp !== undefined && ev.userData.setHP) ev.userData.setHP(data.hp);
        }
    }

    // END EVENTS
    else if (data.type === 'event-end') {
        if (STATE.multiplayer.isHost) return;
        const ev = WorldEvents.interactables.find(e => e.userData.netId === data.id);
        if (ev) {
            if (ev.name === 'BloodAltar') {
                 WorldEvents.dismissEvent(ev, ev.userData.label);
                 UI.toast("Le pacte est scellé.");
            } else {
                WorldEvents.dismissEvent(ev, ev.userData.label);
            }
        }
    }

    // ORBS (Crystal Defense)
    else if (data.type === 'event-orb-spawn') {
        if (STATE.multiplayer.isHost) return;
        const ev = WorldEvents.interactables.find(e => e.userData.netId === data.eventId);
        if (ev && ev.userData.spawnRemoteOrb) ev.userData.spawnRemoteOrb(data);
    }
    else if (data.type === 'event-orb-destroy') {
        if (STATE.multiplayer.isHost) return;
        const ev = WorldEvents.interactables.find(e => e.userData.netId === data.eventId);
        if (ev && ev.userData.destroyOrb) ev.userData.destroyOrb(data.orbId);
    }

    // INTERACTION CLIENT
    else if (data.type === 'event-interact') {
        if (!STATE.multiplayer.isHost) return;
        const ev = WorldEvents.interactables.find(e => e.userData.netId === data.id);
        if (ev) {
            if (data.action === 'hit' && ev.userData.interact && ev.children[0] && ev.userData.hits !== undefined) {
                WorldEvents.handleGeodeHit(ev, ev.children[0], ev.userData.label, data.id);
            }
            else if (data.action === 'start' && ev.userData.startEvent) {
                ev.userData.startEvent();
                WorldEvents.broadcast({ type: 'event-update', id: data.id, action: 'start' });
            }
            else if (data.action === 'finish') {
                WorldEvents.dismissEvent(ev, ev.userData.label);
                WorldEvents.broadcast({ type: 'event-end', id: data.id });
                if(ev.name !== 'BloodAltar') WorldEvents.broadcast({ type: 'prismatic-trigger', rarity: 'rare' }); 
            }
            else if (data.pid !== undefined && ev.userData.rotatePillar) {
                ev.userData.rotatePillar(data.pid);
                EventUtils.broadcast({ type: 'event-update', id: data.id, pid: data.pid, rot: ev.userData.targetRot }); // Corrigé pour renvoyer aussi la rot si besoin
            }
            else if (data.action === 'hit' && ev.userData.interact) {
                ev.userData.interact(); 
            }
            else if (data.mid !== undefined && ev.userData.rotateMirror) {
                ev.userData.rotateMirror(data.mid);
                WorldEvents.broadcast({ type: 'event-update', id: data.id, mid: data.mid });
            }
            else if (data.action === 'activate_lantern' && data.lid !== undefined && ev.userData.activateLantern) {
                ev.userData.activateLantern(data.lid);
                WorldEvents.broadcast({ type: 'event-update', id: data.id, action: 'activate_lantern', lid: data.lid });
            }
            // Pillars 2.0 (si rotation angle libre)
            else if (data.pillars && ev.userData.onNetUpdate) {
                // On applique et on relaie
                ev.userData.onNetUpdate(data);
                WorldEvents.broadcast(data); // Relais brut
            }
        }
    }
    
    // ... EVENT BOSS, WIPE, ETC ...
    else if (data.type === 'boss-spawn') { 
        if(STATE.multiplayer.isHost && GameActions.spawnBoss) { GameActions.spawnBoss(data.bossType); }
    } 
    else if (data.type === 'boss-teleport') {
        if(Globals.player) Globals.player.position.set(0,0,0); 
        UI.toast("Téléportation au combat de boss !");
    } 
    else if (data.type === 'boss-cleared') {
        STATE.bossSpawned = false; 
        if(GameActions.setAmbiance) GameActions.setAmbiance('normal'); 
        document.getElementById('boss-hud').style.display = 'none';
        if(Globals.player && Globals.player.dead) { 
            document.getElementById('spectate-msg').style.display = 'none'; 
            const btn = document.getElementById('btn-respawn');
            if(btn) { btn.style.display = 'block'; btn.disabled = false; btn.innerText = "RESSUSCITER"; }
        }
    } 
    else if (data.type === 'prismatic-trigger') {
        const rarity = data.rarity || 'common';
        if (window.Debug && typeof window.Debug.givePrism === 'function') {
            window.Debug.givePrism(rarity);
        }
        if (UI.showPrismaticReward) {
            UI.showPrismaticReward(rarity); 
        }
    }
    else if (data.type === 'wipe-signal') {
        if(GameActions.triggerWipe) GameActions.triggerWipe();
    } 
    else if (data.type === 'request-boss') {
        if(STATE.multiplayer.isHost) {
             const cost = data.bossType === 'slime_lord' ? 20 : 10;
             if(STATE.enemiesKilled >= cost && GameActions.spawnBoss) GameActions.spawnBoss(data.bossType); 
        }
    } 
    else if (data.type === 'damage-player') {
        if (data.targetId === STATE.multiplayer.id && Globals.player) { 
            Globals.player.takeDamage(data.amount); 
            if(data.knockback) Globals.player.knockback.add(new THREE.Vector3(data.knockback.x, data.knockback.y, data.knockback.z));
        }
    }
    else if (data.type === 'heal-player') { 
        if (data.targetId === STATE.multiplayer.id && Globals.player && !Globals.player.dead) {
            Globals.player.heal(data.amount);
            createDamageText("+" + Math.floor(data.amount), Globals.player.position, '#00ff00');
            if(AudioSys.sfx.levelup) AudioSys.sfx.levelup(); 
        }
    }
    else if (data.type === 'xp-gain') {
        if (GameActions.gainXp) GameActions.gainXp(data.amount);
    }
    else if (data.type === 'telegraph-spawn') {
        const tPos = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
        const onHit = () => {
            if (Globals.player && !Globals.player.dead) {
                let hit = false;
                if (data.shape === 'circle') {
                    if (Globals.player.position.distanceTo(tPos) < data.size) hit = true;
                } else if (data.shape === 'rect') {
                    const dist = Globals.player.position.distanceTo(tPos);
                    if (dist < Math.max(data.size.x, data.size.y)) hit = true; 
                } else {
                    if (Globals.player.position.distanceTo(tPos) < data.size) hit = true;
                }

                if (hit) {
                    const dmg = 15 + (STATE.level * 2); 
                    Globals.player.takeDamage(dmg); 
                }
            }
        };
        createTelegraph(tPos, data.shape, data.size, data.duration, data.color, onHit, data.rotationY, true);
    } 
    else if (data.type === 'player-ready') {
        if (STATE.multiplayer.isHost) { 
            UI.toast("Un joueur a rejoint (" + data.class + ") !"); 
            NetSync.updateRemotePlayer(data.id, {x:0, y:0, z:0}, 0, data.class, false); 
        }
    } 
}