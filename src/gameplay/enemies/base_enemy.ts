// @ts-nocheck
import { Globals, removeEnemy, GameActions } from '../../core/globals';
import { pushOutOfSafeZone, BOSS_ZONE, pushOutOfCircle } from '../world/worldZones';
import { STATE, CONFIG } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createDamageText, spawnParticles } from '../../visual/effects';
import { Network } from '../../multiplayer/network';
import { PassiveKeystoneHooks } from '@/systems/passiveKeystoneHooks';

let enemyIdCounter = 0;

export const ENEMY_AGGRO_RANGE = 18;

export class BaseEnemy extends THREE.Group {
    constructor(type, position, id = null) {
        super();
        this.type = type;
        this.netId = id || ('net_enemy_' + (enemyIdCounter++) + '_' + Math.random());
        
        this.hp = 60 + (STATE.level * 12);
        this.maxHp = this.hp;
        this.barrierHp = 0;
        this.maxBarrierHp = 0;
        this.speed = 4.8;
        this.attackRange = 1.5;
        this.isRanged = false;
        this.isBoss = false;
        this.scaleVal = 1;
        this.radius = 1.0;

        this.knockback = new THREE.Vector3();
        this.bounceSpeed = 5; 
        this.bounceHeight = 0.1;
        this.floatOffset = Math.random() * 100;
        
        this.dead = false;
        this.isAttacking = false;
        this.isChanneling = false;
        this.attackCooldown = 0;
        
        this.activeTelegraphs = [];
        
        this.position.copy(position);
        this.position.y = 0;
        this.mesh = null;
        this.flashTimeout = null;
    }

    setupMesh(geo, mat, scale = 1) {
        this.scaleVal = scale;
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.add(this.mesh);
        Globals.scene.add(this);
    }

    update(dt) {
        if(this.dead) return;
        this.position.y = 0;

        if (!this.isBoss && !this.isPlayer && this.type !== 'royal_seal') {
            pushOutOfSafeZone(this.position);
            if (!STATE.isBossFight && !STATE.bossSpawned) {
                pushOutOfCircle(this.position, BOSS_ZONE.cx, BOSS_ZONE.cz, BOSS_ZONE.radius);
            }
        }
        
        if (!this.isBoss && this.hudGroup && Globals.camera) {
            if (this.barrierBar && this.maxBarrierHp > 0) {
                const showBarrier = this.barrierHp > 0;
                this.barrierBar.visible = showBarrier;
                if (this.barrierBarBg) this.barrierBarBg.visible = showBarrier;
                if (showBarrier) {
                    this.barrierBar.scale.x = Math.max(0, this.barrierHp / this.maxBarrierHp);
                }
            }
            if (this.hpBar) this.hpBar.scale.x = Math.max(0, this.hp / this.maxHp);
            this.hudGroup.lookAt(Globals.camera.position);
        }

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            this.resolveCollisions();
            if(this.attackCooldown > 0) this.attackCooldown -= dt;
        }
    }

    resolveCollisions() {
        const mapSize = 98;
        this.position.x = Math.max(-mapSize, Math.min(mapSize, this.position.x));
        this.position.z = Math.max(-mapSize, Math.min(mapSize, this.position.z));
        this.position.y = 0;

        if (Globals.enemies) {
            for (const other of Globals.enemies) {
                if (other === this || other.dead) continue;
                const dist = this.position.distanceTo(other.position);
                const minDist = this.radius + (other.radius || 0.5); 
                if (dist < minDist) {
                    const pushDir = this.position.clone().sub(other.position).normalize();
                    pushDir.y = 0;
                    if (pushDir.length() === 0) pushDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
                    this.position.add(pushDir.multiplyScalar((minDist - dist) * 0.1)); 
                }
            }
        }
    }

    pushBack(force) {
        if (force && force instanceof THREE.Vector3) {
            this.knockback.add(force);
            this.position.add(force.clone().multiplyScalar(0.1));
        }
    }

    trackTelegraph(mesh) {
        if(mesh) this.activeTelegraphs.push(mesh);
    }

    clearActiveTelegraphs() {
        this.activeTelegraphs.forEach(t => {
            if(Globals.telegraphs) {
                const idx = Globals.telegraphs.indexOf(t);
                if(idx > -1) Globals.telegraphs.splice(idx, 1);
            }
            Globals.scene.remove(t);
            if(t.geometry) t.geometry.dispose();
            if(t.material) t.material.dispose();
        });
        this.activeTelegraphs = [];
    }

    takeDamage(amount) {
        if (this._solarLightDebuffUntil && Date.now() < this._solarLightDebuffUntil && this._solarLightDmgTakenMult) {
            amount *= this._solarLightDmgTakenMult;
        }
        this.hp -= amount; 
        createDamageText(Math.floor(amount), this.position);
        
        if(Globals.player && STATE.stats.lifesteal > 0 && typeof Globals.player.heal === 'function') {
            Globals.player.heal(amount * STATE.stats.lifesteal);
        }
        
        if(this.hp <= 0 && !this.dead) this.die();
        
        if(this.mesh) {
            if(this.flashTimeout) { clearTimeout(this.flashTimeout); this.flashTimeout = null; }

            this.traverse((child) => {
                if (child.isMesh && child.material && child.material.emissive && typeof child.material.emissive.setHex === 'function') {
                    if (child.userData.origEmissive === undefined) {
                        child.userData.origEmissive = child.material.emissive.getHex();
                    }
                    if (child.userData.origEmissive === 0xffffff) {
                        child.userData.origEmissive = 0x000000;
                    }
                    child.material.emissive.setHex(0xffffff); 
                }
            });

            this.flashTimeout = setTimeout(() => { 
                if(this.dead) return;
                this.traverse((child) => {
                    if (child.isMesh && child.material && child.material.emissive && typeof child.material.emissive.setHex === 'function') {
                        if (child.userData.origEmissive !== undefined) {
                            child.material.emissive.setHex(child.userData.origEmissive);
                        } else {
                            child.material.emissive.setHex(0x000000);
                        }
                    }
                });
                this.flashTimeout = null;
            }, 80); 
        }
    }
    
    getClosestTarget() {
        let targets = [];
        if (Globals.player && !Globals.player.dead && Globals.player.visible) targets.push(Globals.player);
        for(let id in STATE.multiplayer.remotePlayers) {
            let p = STATE.multiplayer.remotePlayers[id];
            if (p && p.visible) targets.push(p);
        }
        let closest = null;
        let minD = Infinity;
        targets.forEach((t) => {
            const d = this.position.distanceTo(t.position);
            if (d < minD) {
                minD = d;
                closest = t;
            }
        });
        if (!closest || minD > ENEMY_AGGRO_RANGE) return null;
        return closest;
    }

    die() {
        this.clearActiveTelegraphs();

        // --- CLIENT : MORT VISUELLE UNIQUEMENT ---
        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) {
            if (!this.dead) { 
                this.dead = true; 
                this.visible = false; 
                spawnParticles(this.position, 0xffffff, 10);
            }
            return; 
        }

        // --- HOST / SOLO : MORT RÉELLE ---
        this.dead = true; 
        Globals.scene.remove(this); 
        
        const xpAmount = this._overrideXp ?? 35;
        if(GameActions.gainXp) GameActions.gainXp(xpAmount);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) Network.send({ type: 'xp-gain', amount: xpAmount });
        
        STATE.enemiesKilled++;
        PassiveKeystoneHooks.onEnemyKilledByPlayer();
        removeEnemy(this);
        
        spawnParticles(this.position, 0xffffff, 10);
        if(AudioSys.sfx.hit) AudioSys.sfx.hit();
    }
}