// @ts-nocheck
import { STATE, CONFIG } from '../core/config';
import { Globals, addEnemy, removeEnemy } from '../core/globals';
import { Network } from './network';
import { NetChrono } from './net_chrono';
import { NetClassState } from './net_class_state';
import { Enemy } from '../gameplay/enemy';
import { BaseEnemy } from '../gameplay/enemies/base_enemy';
import { applyMiniBossVariant } from '../gameplay/enemies/minions/mini_boss';
import { setOvershield } from '../gameplay/enemies/minions/mini_boss_combat';
import {
  applyMiniBossTierState,
  parseMiniBossTiers,
  serializeMiniBossTiers,
} from '../gameplay/enemies/minions/mini_boss_tiers';
import { syncMiniBossUiTiers } from '../gameplay/enemies/minions/mini_boss_ui';
import { Player } from '../gameplay/player';

export const NetSync = {
    
    // --- FONCTION D'ENVOI (HOST) ---
    sendWorldState: function() {
        if(!Network.conn || !Network.conn.open) return;
        const now = Date.now();
        if (now - Network.lastUpdate < 50) return; // ~20 ticks/s
        Network.lastUpdate = now;

        if (!Globals.player) return;

        let myRot = 0;
        if (Globals.player.netRotation !== undefined) {
            myRot = Globals.player.netRotation;
        } else if (Globals.player.mesh) {
            myRot = Globals.player.mesh.rotation.y;
        }

        const myPos = { 
            x: parseFloat(Globals.player.position.x.toFixed(2)), 
            y: parseFloat(Globals.player.position.y.toFixed(2)), 
            z: parseFloat(Globals.player.position.z.toFixed(2)) 
        };

        // HOST : Broadcast aux clients
        if (STATE.multiplayer.isHost) {
            const playersList = [];
            
            // Info Host
            const hostChrono = NetChrono.getPlayerSnapshot(STATE.multiplayer.id, Globals.player);
            const hostClass = NetClassState.getSnapshot(STATE.multiplayer.id, Globals.player);
            playersList.push({ 
                id: STATE.multiplayer.id, 
                class: STATE.class, 
                x: myPos.x, y: myPos.y, z: myPos.z, 
                rot: myRot, 
                dead: Globals.player.dead,
                stun: Globals.player.isStunned ? 1 : 0,
                chrono: hostChrono || undefined,
                classState: hostClass || undefined,
            });

            // Info Clients (Relais)
            for (let id in STATE.multiplayer.remotePlayers) {
                const p = STATE.multiplayer.remotePlayers[id];
                if (p) {
                    const pRot = (p.netRotation !== undefined) ? p.netRotation : (p.mesh ? p.mesh.rotation.y : 0);
                    const remoteChrono = NetChrono.getPlayerSnapshot(id, p);
                    const remoteClass = NetClassState.getSnapshot(id, p);
                    playersList.push({
                        id: id,
                        class: p.className || 'warrior', 
                        x: parseFloat(p.position.x.toFixed(2)),
                        y: parseFloat(p.position.y.toFixed(2)),
                        z: parseFloat(p.position.z.toFixed(2)),
                        rot: pRot, 
                        dead: !p.visible,
                        stun: p.isStunned ? 1 : 0,
                        chrono: remoteChrono || undefined,
                        classState: remoteClass || undefined,
                    });
                }
            }

            const enemiesList = Globals.enemies.map(e => {
                let atkType = 'none';
                const s = e.animState || '';
                // ... (Logique detection attaque inchangée) ...
                if (s.includes('throw')) atkType = 'throw';
                else if (s.includes('stab')) atkType = 'stab';
                else if (s.includes('teleport')) atkType = 'teleport';
                else if (s.includes('smash')) atkType = 'smash';
                else if (s.includes('charge')) atkType = 'charge';
                else if (s.includes('bash')) atkType = 'bash';
                else if (s.includes('cast_bolt')) atkType = 'bolt';
                else if (s.includes('cast_zone')) atkType = 'zone';
                else if (s.includes('cast_beam')) atkType = 'beam';
                else if (s.includes('slash')) atkType = 'slash';
                else if (s.includes('stomp')) atkType = 'stomp';

                return {
                    id: e.netId,
                    type: e.type,
                    x: parseFloat(e.position.x.toFixed(2)),
                    y: parseFloat(e.position.y.toFixed(2)),
                    z: parseFloat(e.position.z.toFixed(2)),
                    rot: parseFloat(e.rotation.y.toFixed(2)),
                    hp: Math.ceil(e.hp),
                    maxHp: Math.ceil(e.maxHp),
                    overshieldHp: Math.ceil(e.overshieldHp ?? e.barrierHp ?? 0),
                    maxOvershieldHp: Math.ceil(e.maxOvershieldHp ?? e.maxBarrierHp ?? 0),
                    barrierHp: Math.ceil(e.barrierHp || 0),
                    maxBarrierHp: Math.ceil(e.maxBarrierHp || 0),
                    isMiniBoss: e.isMiniBoss ? 1 : 0,
                    miniBossId: e.miniBossId || '',
                    miniBossTiers: serializeMiniBossTiers(e.miniBossTiers || []),
                    stateVer: (e.stateVersion = (e.stateVersion || 0) + 1),
                    atk: e.isAttacking ? 1 : 0,
                    anim: e.animState || 'idle',
                    atkType: atkType,
                    gnomeShield: e.gnomeShieldTimer && e.gnomeShieldTimer > 0 ? 1 : 0,
                    gnomeBoost: e.gnomeDamageBoostTimer && e.gnomeDamageBoostTimer > 0 ? 1 : 0
                };
            });

            Network.send({
                type: 'world-update',
                enemies: enemiesList,
                players: playersList,
                bossSpawned: STATE.bossSpawned,
                kills: STATE.enemiesKilled
            });
        } 
        
        // CLIENT : Envoi Input vers Host
        else {
            let chronoPayload = undefined;
            if (Globals.player?.className === 'chronoregulator') {
                const aim = Globals.player.getAimDir();
                chronoPayload = {
                    isBeaming: Globals.player.isBeaming ? 1 : 0,
                    aimX: parseFloat(aim.x.toFixed(3)),
                    aimZ: parseFloat(aim.z.toFixed(3)),
                };
            }
            Network.send({
                type: 'client-input',
                id: STATE.multiplayer.id,
                class: STATE.class,
                pos: myPos,
                rot: myRot,
                dead: Globals.player.dead,
                stun: Globals.player.isStunned ? 1 : 0,
                chrono: chronoPayload,
            });
        }
    },

    // --- RÉCEPTION CLIENT ---
    syncEnemies: function(enemiesData) {
        // ... (Code existant inchangé) ...
        const serverIds = enemiesData.map(e => e.id);
        
        for(let i = Globals.enemies.length - 1; i >= 0; i--) { 
            const localEnemy = Globals.enemies[i];
            if(!serverIds.includes(localEnemy.netId)) { 
                Globals.scene.remove(localEnemy);
                removeEnemy(localEnemy);
            } 
        }
        
        enemiesData.forEach(eData => {
            let enemy = Globals.enemies.find(e => e.netId === eData.id);
            const targetPos = new THREE.Vector3(eData.x, eData.y, eData.z);
            
            if (enemy) { 
                enemy.networkTargetPos = targetPos;
                enemy.networkTargetRot = eData.rot;

                if (eData.stateVer == null || eData.stateVer >= (enemy.stateVersion || 0)) {
                    if (eData.stateVer != null) enemy.stateVersion = eData.stateVer;
                    enemy.hp = eData.hp;
                    if (eData.maxHp) enemy.maxHp = eData.maxHp;
                    const maxShield = eData.maxOvershieldHp ?? eData.maxBarrierHp ?? 0;
                    const curShield = eData.overshieldHp ?? eData.barrierHp ?? 0;
                    if (maxShield > 0) {
                        setOvershield(enemy, curShield, maxShield);
                    }
                }

                if (eData.isMiniBoss && eData.miniBossTiers) {
                    const tiers = parseMiniBossTiers(eData.miniBossTiers);
                    if (tiers.length > 0) {
                        applyMiniBossTierState(enemy, tiers);
                        syncMiniBossUiTiers(enemy);
                    }
                }

                if (eData.anim) enemy.animState = eData.anim;

                if (eData.gnomeShield !== undefined) {
                    enemy.gnomeShieldTimer = eData.gnomeShield ? 5.0 : 0;
                }
                if (eData.gnomeBoost !== undefined) {
                    enemy.gnomeDamageBoostTimer = eData.gnomeBoost ? 5.0 : 0;
                }

                if (eData.atk === 1) {
                    if (!enemy.isAttacking) {
                        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), enemy.rotation.y);
                        const dummyTargetPos = enemy.position.clone().add(forward.multiplyScalar(5));
                        const dummyTarget = { position: dummyTargetPos };

                        if (eData.atkType === 'throw' && enemy.attackFanOfKnives) enemy.attackFanOfKnives(dummyTarget);
                        else if (eData.atkType === 'stab' && enemy.attackStab) enemy.attackStab(dummyTarget);
                        else if (eData.atkType === 'teleport' && enemy.attackShadowStep) enemy.attackShadowStep(dummyTarget);
                        else if (eData.atkType === 'smash' && enemy.attackSmash) enemy.attackSmash(dummyTarget);
                        else if (eData.atkType === 'charge' && enemy.attackCharge) enemy.attackCharge(dummyTarget);
                        else if (eData.atkType === 'bash' && enemy.attackShieldBash) enemy.attackShieldBash(dummyTarget);
                        else if (eData.atkType === 'bolt' && enemy.attackWarlockBolt) enemy.attackWarlockBolt(dummyTarget);
                        else if (eData.atkType === 'zone' && enemy.attackWarlockZone) enemy.attackWarlockZone(dummyTarget);
                        else if (eData.atkType === 'beam' && enemy.attackWarlockBeam) enemy.attackWarlockBeam(dummyTarget);
                        else if (eData.atkType === 'slash' && enemy.attackSlash) enemy.attackSlash(dummyTarget);
                        else if (eData.atkType === 'stomp' && enemy.attackStomp) enemy.attackStomp(dummyTarget);
                        else {
                            enemy.isAttacking = true;
                            enemy.attackTimer = 0; 
                        }
                    }
                } else {
                    if (enemy.isAttacking) {
                        enemy.isAttacking = false;
                        enemy.animState = 'idle';
                        if (enemy.stopCharge) enemy.stopCharge();
                    }
                }

                if (enemy.hp > 0 && !enemy.visible) {
                    enemy.visible = true;
                    enemy.dead = false;
                }

            } else { 
                enemy = new Enemy(eData.type, targetPos, eData.id);
                enemy.hp = eData.hp;
                if (eData.maxHp) enemy.maxHp = eData.maxHp;
                const maxShield = eData.maxOvershieldHp ?? eData.maxBarrierHp ?? 0;
                const curShield = eData.overshieldHp ?? eData.barrierHp ?? 0;
                if (maxShield > 0) {
                    setOvershield(enemy, curShield, maxShield);
                }
                if (eData.isMiniBoss && eData.miniBossId) {
                    applyMiniBossVariant(enemy, eData.miniBossId, {
                        fromNetwork: true,
                        maxHp: eData.maxHp,
                        overshieldHp: curShield,
                        maxOvershieldHp: maxShield,
                        tiers: parseMiniBossTiers(eData.miniBossTiers || ''),
                    });
                }
                if (eData.stateVer != null) enemy.stateVersion = eData.stateVer;
                enemy.ai = null; 
                
                enemy.networkTargetPos = targetPos;
                enemy.networkTargetRot = eData.rot;
                enemy.lastPos = targetPos.clone();

                enemy.update = function(dt) {
                    if(this.dead) return;
                    if(this.networkTargetPos) {
                        const distToTarget = this.position.distanceTo(this.networkTargetPos);
                        if(distToTarget > 5.0) this.position.copy(this.networkTargetPos);
                        else this.position.lerp(this.networkTargetPos, 8 * dt);
                    }
                    if(this.networkTargetRot !== undefined) {
                        let rotDiff = this.networkTargetRot - this.rotation.y;
                        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
                        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
                        this.rotation.y += rotDiff * 8 * dt;
                    }
                    const moveDist = this.position.distanceTo(this.lastPos || this.position);
                    const currentSpeed = moveDist / dt;
                    this.isMoving = currentSpeed > 0.5;
                    this.moveSpeed = THREE.MathUtils.lerp(this.moveSpeed || 0, currentSpeed, dt * 10);
                    this.lastPos = this.position.clone();
                    if(BaseEnemy.prototype.update) BaseEnemy.prototype.update.call(this, dt);
                    if(this.updateAnim) this.updateAnim(dt);
                };
                addEnemy(enemy); 
            }
        });
    },

    syncPlayers: function(playersData) {
        playersData.forEach(pData => {
            if (pData.id === STATE.multiplayer.id) {
                if (pData.chrono && Globals.player?.className === 'chronoregulator') {
                    NetChrono.applySnapshot(Globals.player, pData.chrono, true);
                }
                if (pData.classState && Globals.player) {
                    NetClassState.applySnapshot(Globals.player, pData.classState);
                }
                return;
            }
            this.updateRemotePlayer(pData.id, {x: pData.x, y: pData.y, z: pData.z}, pData.rot, pData.class, pData.dead, pData.stun, this._lastDt);
            const remote = STATE.multiplayer.remotePlayers[pData.id];
            if (pData.chrono && remote) {
                NetChrono.applySnapshot(remote, pData.chrono, false);
            }
            if (pData.classState && remote) {
                NetClassState.applySnapshot(remote, pData.classState);
            }
        });
    },

    updateRemotePlayer: function(id, pos, rot, className, isDead, isStunned, dt) {
        let p = STATE.multiplayer.remotePlayers[id];
        
        if (!p) { 
            p = this.createRemotePlayer(className, id); 
            STATE.multiplayer.remotePlayers[id] = p; 
        }
        
        if (className && p.className !== className) {
            Globals.scene.remove(p);
            p = this.createRemotePlayer(className, id);
            STATE.multiplayer.remotePlayers[id] = p;
        }

        const targetV = new THREE.Vector3(pos.x, pos.y, pos.z);
        const snapDist = 5;
        const lerpFactor = 1 - Math.exp(-12 * (dt || 0.016));
        if (p.position.distanceTo(targetV) > snapDist) p.position.copy(targetV);
        else p.position.lerp(targetV, lerpFactor);

        p.netRotation = rot;

        if(p.mesh) {
            let r = p.mesh.rotation.y;
            let diff = rot - r;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const rotLerp = 1 - Math.exp(-12 * (dt || 0.016));
            if (Math.abs(diff) > 1.0) p.mesh.rotation.y = rot;
            else p.mesh.rotation.y += diff * rotLerp;
        }
        
        const dist = p.position.distanceTo(p.lastPos || p.position);
        p.isMoving = dist > 0.01;
        p.lastPos = p.position.clone();
        
        if(isDead !== undefined) p.visible = !isDead;

        // Mise à jour de l'état stun distant
        if (isStunned === 1) {
            if (!p.isStunned) p.applyStun(100); // Durée infinie tant que le serveur dit 1
        } else {
            p.isStunned = false;
            if (p.stunVisualGroup) p.stunVisualGroup.visible = false;
        }
    },

    createRemotePlayer: function(className, id) {
        Globals.creatingRemotePlayer = true;
        let p;
        try {
            p = new Player(className);
            p.isRemote = true; 
            p.userData.isRemote = true;
            p.userData.id = id;
            p.isMoving = false;
            p.netRotation = 0;
            p.lastPos = new THREE.Vector3(); 
        } catch (e) {
            console.error("[NET] Erreur création joueur distant:", e);
            p = new THREE.Group(); 
        }
        Globals.creatingRemotePlayer = false;
        return p;
    },

    _lastDt: 0.016,

    update: function(dt) {
        this._lastDt = dt;
        if (STATE.multiplayer.isHost) {
            NetChrono.tick(dt);
            NetClassState.tick(dt);
        } else {
            NetChrono.tickRemoteVisuals(dt);
        }
        this.sendWorldState();
        for (let id in STATE.multiplayer.remotePlayers) {
            const p = STATE.multiplayer.remotePlayers[id];
            if (p && typeof p.update === 'function') {
                p.update(dt);
            }
        }
    }
};