// @ts-nocheck
import { Globals, removeEnemy, GameActions } from '../../core/globals';
import { pushOutOfSafeZone, BOSS_ZONE, pushOutOfCircle } from '../world/worldZones';
import { STATE, CONFIG } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual } from '../../visual/effects';
import { Network } from '../../multiplayer/network';
import { isServerAuthority } from '../../multiplayer/net_combat';
import { PassiveKeystoneHooks } from '@/systems/passiveKeystoneHooks';
import {
  absorbOvershieldDamage,
  applyAbyssalCorruptionOnHit,
  applyMiniBossIncomingDamage,
  resolveMiniBossOutgoingDamage,
  shouldApplySolarLightAmp,
  tickMiniBossCombat,
} from './minions/mini_boss_combat';
import { updateMiniBossUi } from './minions/mini_boss_ui';
import { damagePlayer } from '../../multiplayer/net_combat';

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
        this.overshieldHp = 0;
        this.maxOvershieldHp = 0;
        this.isMiniBoss = false;
        this.miniBossId = null;
        this.miniBossTiers = [];
        this.miniBossStats = null;
        this.stateVersion = 0;
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
        
        // Vertical physics (gravity and air height)
        this.airVelocityY = this.airVelocityY || 0;
        this.airY = this.airY || 0;
        
        if (this.airVelocityY !== 0 || this.airY > 0) {
            this.airVelocityY -= 35 * dt; // Gravity
            this.airY += this.airVelocityY * dt;
            if (this.airY <= 0) {
                this.airY = 0;
                this.airVelocityY = 0;
            }
        }
        this.position.y = this.airY;

        // Smooth knockback updates
        this.knockback = this.knockback || new THREE.Vector3();
        if (this.knockback.lengthSq() > 0.001) {
            this.position.add(this.knockback.clone().multiplyScalar(dt));
            this.knockback.multiplyScalar(Math.exp(-8 * dt)); // smooth exponential decay
        }

        // Animate the 3D Eclipse Mark
        const mark = this.getObjectByName("eclipseMark");
        if (mark) {
            if (Globals.camera) {
                mark.lookAt(Globals.camera.position);
            }
            
            const elapsed = Date.now() * 0.001;
            
            // Spin the solar flares radiating from the corona
            const flares = mark.getObjectByName("flares");
            if (flares) {
                flares.rotation.z = elapsed * 1.5;
            }
            
            // Orbit the moon sphere in front of the sun corona to make the eclipse shadow slide dynamically
            const moon = mark.getObjectByName("moonSphere");
            if (moon) {
                const orbitRadius = 0.06;
                const speed = 2.5;
                moon.position.x = Math.cos(elapsed * speed) * orbitRadius;
                moon.position.y = Math.sin(elapsed * speed) * orbitRadius;
                moon.rotation.y = elapsed * 0.8;
            }
            
            // Sun corona breathing scale
            const sunCorona = mark.getObjectByName("sunCorona");
            if (sunCorona) {
                const scale = 1.0 + Math.sin(elapsed * 4.0) * 0.08;
                sunCorona.scale.set(scale, scale, 1.0);
            }
            
            // Bob up and down above the enemy's head
            const bob = Math.sin(elapsed * 3.0) * 0.12;
            mark.position.y = (this.radius || 1.0) * 2.8 + bob;
        }

        if (!this.isBoss && !this.isPlayer && this.type !== 'royal_seal') {
            pushOutOfSafeZone(this.position);
            if (!STATE.isBossFight && !STATE.bossSpawned) {
                pushOutOfCircle(this.position, BOSS_ZONE.cx, BOSS_ZONE.cz, BOSS_ZONE.radius);
            }
        }
        
        if (!this.isBoss && Globals.camera) {
            if (this.isMiniBoss) {
                if (!STATE.multiplayer.active || isServerAuthority()) {
                    tickMiniBossCombat(this, dt);
                }
                updateMiniBossUi(this, dt, Globals.camera);
            } else if (this.hudGroup) {
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
        }

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            this.resolveCollisions();
            if(this.attackCooldown > 0) {
                const atkSpd = this.isMiniBoss && this.miniBossStats ? this.miniBossStats.attackSpeedMult : 1;
                this.attackCooldown -= dt * Math.max(0.5, atkSpd);
            }
        }
        
        // Ensure position Y is updated
        this.position.y = this.airY;
    }

    resolveCollisions() {
        const mapSize = 98;
        this.position.x = Math.max(-mapSize, Math.min(mapSize, this.position.x));
        this.position.z = Math.max(-mapSize, Math.min(mapSize, this.position.z));
        this.position.y = this.airY || 0;

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
        this.position.y = this.airY || 0;
    }

    pushBack(forceOrPos, strength) {
        if (!forceOrPos || !(forceOrPos instanceof THREE.Vector3)) return;
        
        let f;
        if (typeof strength === 'number') {
            // It's a position and a strength. Calculate the push direction away from the position.
            const dir = this.position.clone().sub(forceOrPos);
            dir.y = 0;
            if (dir.lengthSq() > 0.0001) {
                dir.normalize();
            } else {
                dir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            }
            f = dir.multiplyScalar(strength * 9.0); // scaled for smooth integration over dt
        } else {
            // It's a force vector directly
            f = forceOrPos.clone();
        }

        // Apply knockback resistance for mini-bosses
        if (this.isMiniBoss && this.miniBossStats?.knockbackResist) {
            f.multiplyScalar(1 - this.miniBossStats.knockbackResist);
        }

        // Add to the knockback velocity vector
        this.knockback = this.knockback || new THREE.Vector3();
        this.knockback.add(f);
    }

    dealPlayerDamage(target, baseAmount, opts = {}) {
        let amount = baseAmount;
        let outOpts = { ...opts };

        if (this.isMiniBoss && this.miniBossStats) {
            const s = this.miniBossStats;
            const resolved = resolveMiniBossOutgoingDamage(this, baseAmount, target, {
                isAbility: !!opts.isAbility,
            });
            amount = resolved.damage;

            let heal = resolved.lifeStealHeal;
            if (heal > 0 && s.healRecvMult > 1) heal *= s.healRecvMult;
            if (heal > 0) this.hp = Math.min(this.maxHp, this.hp + heal);

            if (outOpts.stunDuration && s.stunDurationMult > 1) {
                outOpts.stunDuration *= s.stunDurationMult * (s.effectDurationMult > 1 ? s.effectDurationMult : 1);
            } else if (!outOpts.stunDuration && s.stunDurationMult > 1 && s.effectDurationMult > 1) {
                outOpts.stunDuration = 0.12 * s.stunDurationMult * s.effectDurationMult;
            }

            if (s.corruptionOnHit > 0) {
                applyAbyssalCorruptionOnHit(target, s.effectDurationMult);
            }
        }

        damagePlayer(target, amount, outOpts);
    }

    getAggroRange() {
        let range = ENEMY_AGGRO_RANGE;
        if (this.isMiniBoss && this.miniBossStats?.pursuitMult > 1) {
            range *= this.miniBossStats.pursuitMult;
        }
        return range;
    }

    applyStun(duration) {
        if (this.isMiniBoss && this.miniBossStats?.ccResist > 0) {
            duration *= 1 - this.miniBossStats.ccResist;
            if (duration < 0.05) return;
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

    takeDamage(amount, opts = {}) {
        if (
            shouldApplySolarLightAmp(this)
            && this._solarLightDebuffUntil
            && Date.now() < this._solarLightDebuffUntil
            && this._solarLightDmgTakenMult
        ) {
            amount *= this._solarLightDmgTakenMult;
        }

        // Client multijoueur : HP autoritaire via world-update, feedback visuel uniquement
        if (STATE.multiplayer.active && !isServerAuthority()) {
            this._flashDamageFeedback(amount);
            return;
        }

        amount = applyMiniBossIncomingDamage(this, amount, {
            isRanged: !!(opts.isRanged || opts.ranged),
        });

        const hpDamage = absorbOvershieldDamage(this, amount);
        if (hpDamage <= 0) return;

        this.hp -= hpDamage;
        createDamageText(Math.floor(hpDamage), this.position);
        
        if(Globals.player && STATE.stats.lifesteal > 0 && typeof Globals.player.heal === 'function') {
            Globals.player.heal(hpDamage * STATE.stats.lifesteal);
        }
        
        if(this.hp <= 0 && !this.dead) this.die();
        
        this._flashDamageFeedback(hpDamage);
    }

    _flashDamageFeedback(amount) {
        if (!amount) return;
        if (STATE.multiplayer.active && !isServerAuthority()) {
            createDamageText(Math.floor(amount), this.position);
        }
        if (!this.mesh) return;

        if (this.flashTimeout) { clearTimeout(this.flashTimeout); this.flashTimeout = null; }

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
            if (this.dead) return;
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
        if (!closest || minD > this.getAggroRange()) return null;
        return closest;
    }

    die() {
        this.clearActiveTelegraphs();

        // --- CLIENT : MORT VISUELLE UNIQUEMENT ---
        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) {
            if (!this.dead) { 
                this.dead = true; 
                this.visible = false; 
                if (this._markVisual) {
                    this.remove(this._markVisual);
                    this._markVisual.traverse?.(child => {
                        if (child.isMesh) {
                            child.geometry?.dispose();
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose?.());
                            else child.material?.dispose?.();
                        }
                    });
                    if (this._markVisual.geometry) this._markVisual.geometry.dispose();
                    if (this._markVisual.material) this._markVisual.material.dispose();
                    this._markVisual = null;
                }
                spawnParticles(this.position, 0xffffff, 10);
            }
            return; 
        }

        // --- HOST / SOLO : MORT RÉELLE ---
        this.dead = true; 
        
        // Clean up mark visual if any
        if (this._markVisual) {
            this.remove(this._markVisual);
            this._markVisual.traverse?.(child => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose?.());
                    else child.material?.dispose?.();
                }
            });
            if (this._markVisual.geometry) this._markVisual.geometry.dispose();
            if (this._markVisual.material) this._markVisual.material.dispose();
            this._markVisual = null;
        }

        // Trigger Eclipse Mark explosion
        if (this._eclipseMarked) {
            this._eclipseMarked = false;
            
            // Explosion visual
            createSkillVisual('explosion', this.position, 3.5, 0xaa00ff);
            spawnParticles(this.position, 0xaa00ff, 15);
            if (AudioSys.sfx.warrior && AudioSys.sfx.warrior.smash) {
                AudioSys.sfx.warrior.smash();
            }
            
            // Deal damage to other surrounding enemies
            if (Globals.enemies) {
                Globals.enemies.forEach(other => {
                    if (other === this || other.dead) return;
                    if (other.position.distanceTo(this.position) <= 3.5) {
                        const dmg = STATE.stats.atk * 1.5;
                        other.takeDamage(dmg);
                        spawnParticles(other.position, 0xaa00ff, 5);
                        other.pushBack(this.position, 3.0);
                    }
                });
            }
        }

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