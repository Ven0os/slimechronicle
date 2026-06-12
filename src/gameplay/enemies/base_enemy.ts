// @ts-nocheck
import * as THREE from 'three';
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
        this.displayHp = this.hp;
        this.displayBarrier = 0;
        this.hpBarNeedsUpdate = false;
        this.isDying = false;
        this.deathAnimDone = false;
    }

    setupMesh(geo, mat, scale = 1) {
        this.scaleVal = scale;
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.add(this.mesh);
        Globals.scene.add(this);
    }

    update(dt) {
        if (this.isDying) {
            this.updateDeathAnimation(dt);
            return;
        }
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
            } else {
                if (!this.hudGroup && this.type !== 'royal_seal' && this.type !== 'void_altar') {
                    const customColor = this.type === 'corrupted' ? 0xd946ef : null;
                    this.setupHealthBar(customColor);
                }
                if (this.hudGroup) {
                    // Position dynamically above the head if the model has a head part defined
                    let targetY = this.scaleVal * (this.type === 'corrupted' ? 1.95 : 1.8);
                    if (this.model && this.model.parts && this.model.parts.head) {
                        const headWorldPos = new THREE.Vector3();
                        this.model.parts.head.getWorldPosition(headWorldPos);
                        targetY = (headWorldPos.y - this.position.y) + (0.45 * this.scaleVal);
                    }
                    this.hudGroup.position.y = targetY;

                    if (this.hpBarCanvas && (this.displayHp !== this.hp || (this.maxBarrierHp > 0 && this.displayBarrier !== this.barrierHp) || this.hpBarNeedsUpdate)) {
                        this.displayHp = THREE.MathUtils.lerp(this.displayHp, this.hp, Math.min(1, dt * 7.0));
                        if (Math.abs(this.displayHp - this.hp) < 0.2) this.displayHp = this.hp;

                        if (this.maxBarrierHp > 0) {
                            this.displayBarrier = THREE.MathUtils.lerp(this.displayBarrier, this.barrierHp, Math.min(1, dt * 7.0));
                            if (Math.abs(this.displayBarrier - this.barrierHp) < 0.2) this.displayBarrier = this.barrierHp;
                        }

                        this.drawHealthBar();
                    }
                    this.hudGroup.lookAt(Globals.camera.position);
                }
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
        this.disposeHealthBar();

        // --- CLIENT : MORT VISUELLE UNIQUEMENT ---
        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) {
            if (!this.dead) { 
                this.dead = true; 
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
                if (AudioSys.sfx.hit) AudioSys.sfx.hit();
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
            
            // Give 10 sun and moon to eclipse player
            if (Globals.player && Globals.player.className === 'eclipse' && Globals.player.eclipse) {
                Globals.player.eclipse.sun = Math.min(100, Globals.player.eclipse.sun + 10);
                Globals.player.eclipse.moon = Math.min(100, Globals.player.eclipse.moon + 10);
                createDamageText("+10 SOLEIL/LUNE", this.position, '#aa00ff');
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
        
        const xpAmount = this._overrideXp ?? 35;
        if(GameActions.gainXp) GameActions.gainXp(xpAmount);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) Network.send({ type: 'xp-gain', amount: xpAmount });
        
        STATE.enemiesKilled++;
        PassiveKeystoneHooks.onEnemyKilledByPlayer();
        
        if (AudioSys.sfx.hit) AudioSys.sfx.hit();
    }

    setupHealthBar(color = null) {
        if (this.hudGroup) {
            this.remove(this.hudGroup);
        }

        this.hudGroup = new THREE.Group();
        const heightMult = this.type === 'corrupted' ? 1.95 : 1.8;
        this.hudGroup.position.y = this.scaleVal * heightMult;
        this.add(this.hudGroup);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const geometry = new THREE.PlaneGeometry(1.2, 0.15);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false
        });

        this.hpBarMesh = new THREE.Mesh(geometry, material);
        this.hudGroup.add(this.hpBarMesh);

        this.hpBarCanvas = canvas;
        this.hpBarCtx = ctx;
        this.hpBarTexture = texture;
        this.hpBarColor = color;
        this.displayHp = this.hp;
        this.displayBarrier = this.barrierHp;
        this.hpBarNeedsUpdate = true;
        this.drawHealthBar();
    }

    drawHealthBar() {
        if (!this.hpBarCanvas || !this.hpBarCtx) return;

        const ctx = this.hpBarCtx;
        const w = this.hpBarCanvas.width;
        const h = this.hpBarCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // 1. Draw Background
        const r = 8;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r);
        ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h);
        ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fillStyle = 'rgba(10, 12, 16, 0.85)';
        ctx.fill();

        // Outer border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const pad = 3;
        const innerW = w - pad * 2;
        const innerH = h - pad * 2;
        const innerR = r - 2;

        const hpPct = Math.max(0, Math.min(1, this.hp / this.maxHp));
        const displayHpPct = Math.max(0, Math.min(1, this.displayHp / this.maxHp));

        // 2. Draw Catch-up / Trailing damage bar
        if (displayHpPct > hpPct) {
            const tw = innerW * displayHpPct;
            ctx.beginPath();
            ctx.moveTo(pad + innerR, pad);
            ctx.lineTo(pad + tw - innerR, pad);
            ctx.quadraticCurveTo(pad + tw, pad, pad + tw, pad + innerR);
            ctx.lineTo(pad + tw, pad + innerH - innerR);
            ctx.quadraticCurveTo(pad + tw, pad + innerH, pad + tw - innerR, pad + innerH);
            ctx.lineTo(pad + innerR, pad + innerH);
            ctx.quadraticCurveTo(pad, pad + innerH, pad, pad + innerH - innerR);
            ctx.lineTo(pad, pad + innerR);
            ctx.quadraticCurveTo(pad, pad, pad + innerR, pad);
            ctx.closePath();
            ctx.fillStyle = 'rgba(240, 240, 245, 0.85)';
            ctx.fill();
        }

        // 3. Draw main health bar
        if (hpPct > 0) {
            const hw = innerW * hpPct;
            ctx.beginPath();
            ctx.moveTo(pad + innerR, pad);
            ctx.lineTo(pad + hw - innerR, pad);
            ctx.quadraticCurveTo(pad + hw, pad, pad + hw, pad + innerR);
            ctx.lineTo(pad + hw, pad + innerH - innerR);
            ctx.quadraticCurveTo(pad + hw, pad + innerH, pad + hw - innerR, pad + innerH);
            ctx.lineTo(pad + innerR, pad + innerH);
            ctx.quadraticCurveTo(pad, pad + innerH, pad, pad + innerH - innerR);
            ctx.lineTo(pad, pad + innerR);
            ctx.quadraticCurveTo(pad, pad, pad + innerR, pad);
            ctx.closePath();

            const g = ctx.createLinearGradient(pad, pad, pad + hw, pad);
            if (this.hpBarColor === 0xd946ef || this.hpBarColor === '#d946ef') {
                g.addColorStop(0, '#c084fc');
                g.addColorStop(1, '#a855f7');
            } else {
                g.addColorStop(0, '#ff5e62');
                g.addColorStop(1, '#ff9966');
            }
            ctx.fillStyle = g;
            ctx.fill();

            // Glossy sheen overlay
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(pad, pad, hw, innerH / 2);
        }

        // 4. Draw barrier bar (if any)
        if (this.maxBarrierHp > 0 && this.barrierHp > 0) {
            const barrierPct = Math.max(0, Math.min(1, this.barrierHp / this.maxBarrierHp));
            const bw = innerW * barrierPct;
            ctx.beginPath();
            ctx.moveTo(pad + innerR, pad);
            ctx.lineTo(pad + bw - innerR, pad);
            ctx.quadraticCurveTo(pad + bw, pad, pad + bw, pad + innerR);
            ctx.lineTo(pad + bw, pad + innerH - innerR);
            ctx.quadraticCurveTo(pad + bw, pad + innerH, pad + bw - innerR, pad + innerH);
            ctx.lineTo(pad + innerR, pad + innerH);
            ctx.quadraticCurveTo(pad, pad + innerH, pad, pad + innerH - innerR);
            ctx.lineTo(pad, pad + innerR);
            ctx.quadraticCurveTo(pad, pad, pad + innerR, pad);
            ctx.closePath();

            const g = ctx.createLinearGradient(pad, pad, pad + bw, pad);
            g.addColorStop(0, '#38bdf8');
            g.addColorStop(1, '#0284c7');
            ctx.fillStyle = g;
            ctx.fill();
        }

        this.hpBarTexture.needsUpdate = true;
        this.hpBarNeedsUpdate = false;
    }

    disposeHealthBar() {
        if (this.hudGroup) {
            this.remove(this.hudGroup);
        }
        if (this.hpBarMesh) {
            if (this.hpBarMesh.geometry) this.hpBarMesh.geometry.dispose();
            if (this.hpBarMesh.material) {
                if (this.hpBarMesh.material.map) this.hpBarMesh.material.map.dispose();
                this.hpBarMesh.material.dispose();
            }
            this.hpBarMesh = null;
        }
        this.hpBarCanvas = null;
        this.hpBarCtx = null;
        this.hpBarTexture = null;
        this.hudGroup = null;
    }

    startDeathAnimation() {
        this.isDying = true;
        this.deathTimer = 0;
        this._smokeEmitted = 0;
        
        this.disposeHealthBar();
        this.clearActiveTelegraphs();

        if (this.mesh) {
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    const makeTransparent = (mat) => {
                        mat.transparent = true;
                        mat.needsUpdate = true;
                    };
                    if (Array.isArray(child.material)) {
                        child.material.forEach(makeTransparent);
                    } else {
                        makeTransparent(child.material);
                    }
                }
            });
        }
    }

    updateDeathAnimation(dt) {
        this.deathTimer += dt;
        const duration = 1.0;
        const progress = Math.min(1.0, this.deathTimer / duration);
        const opacity = 1.0 - progress;

        if (this.mesh) {
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    const setOpacity = (mat) => {
                        mat.opacity = opacity;
                    };
                    if (Array.isArray(child.material)) {
                        child.material.forEach(setOpacity);
                    } else {
                        setOpacity(child.material);
                    }
                }
            });

            this.mesh.position.y += dt * 0.8;
            this.mesh.scale.setScalar(this.scaleVal * (1.0 - progress * 0.4));
        }

        const smokeColor = this.type === 'corrupted' ? 0xd946ef 
                         : (this.type === 'warlock' ? 0x8e44ad
                         : (this.type === 'sentinel' ? 0x888888 : 0x444444));
        this._smokeEmitted += dt;
        if (this._smokeEmitted >= 0.08 && progress < 0.95) {
            this._smokeEmitted = 0;
            const particlePos = this.position.clone();
            particlePos.y += 0.5 + Math.random() * 0.8;
            particlePos.x += (Math.random() - 0.5) * 0.5;
            particlePos.z += (Math.random() - 0.5) * 0.5;
            spawnParticles(particlePos, smokeColor, 1);
        }

        if (progress >= 1.0) {
            this.deathAnimDone = true;
        }
    }
}