// @ts-nocheck
import * as THREE from 'three';
import { Globals, removeEnemy, GameActions } from '../../core/globals';
import { pushOutOfSafeZone, BOSS_ZONE, pushOutOfCircle, getGroundLevelAt, getPlayableRadiusAt } from '../world/worldZones';
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
import { dampFactor } from '@/core/smoothing';

let enemyIdCounter = 0;

// Vecteur de travail partagé : la séparation entre ennemis tourne en O(n²) par frame,
// y allouer un Vector3 par contact saturait le GC pendant les gros combats.
const _separationDir = new THREE.Vector3();

// Cadence maximale de redessin d'une barre de vie (~30 Hz). Au-delà, le repaint canvas
// et le réenvoi de texture se paient sur chaque ennemi touché sans différence visible.
const HP_BAR_REDRAW_INTERVAL_MS = 33;

export const ENEMY_AGGRO_RANGE = 18;

export class BaseEnemy extends THREE.Group {
    constructor(type, position, id = null) {
        super();
        this.type = type;
        this.netId = id || ('net_enemy_' + (enemyIdCounter++) + '_' + Math.random());
        
        const hpMult = (STATE.gameOptions && STATE.gameOptions.enemyHpMult !== undefined) ? STATE.gameOptions.enemyHpMult : 1.0;
        this.hp = Math.round((60 + (STATE.level * 12)) * hpMult);
        this.maxHp = this.hp;
        this.barrierHp = 0;
        this.maxBarrierHp = 0;
        this.overshieldHp = 0;
        this.maxOvershieldHp = 0;
        this.isMiniBoss = false;
        this.miniBossId = null;
        this.miniBossTiers = [];
        this.miniBossStats = null;
        this.defense = 0;
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
        this.gnomeShieldTimer = 0;
        this.gnomeDamageBoostTimer = 0;
        this.gnomeHealTimer = 0;
        
        this.activeTelegraphs = [];
        
        this.position.copy(position);
        this.position.y = getGroundLevelAt(this.position);
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

    initStatusOutlines() {
        if (!this.mesh || this._statusOutlinesInitialized) return;
        this._statusOutlinesInitialized = true;

        this._healOutlineMat = new THREE.MeshBasicMaterial({
            color: 0x2ecc71,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this._boostOutlineMat = new THREE.MeshBasicMaterial({
            color: 0xe74c3c,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this._healOutlines = [];
        this._boostOutlines = [];

        const targetMeshes = [];
        this.mesh.traverse(child => {
            if (child.isMesh) {
                // Skip UI components, healthbars, custom transparent materials, etc.
                if (child.name && (child.name.includes("hpBar") || child.name.includes("telegraph") || child.name.includes("glow") || child.name.includes("magicMat") || child.material?.transparent && child.material?.opacity < 0.9)) {
                    return;
                }
                targetMeshes.push(child);
            }
        });

        targetMeshes.forEach(child => {
            const healOutline = new THREE.Mesh(child.geometry, this._healOutlineMat);
            healOutline.scale.setScalar(1.14);
            healOutline.visible = false;
            child.add(healOutline);
            this._healOutlines.push(healOutline);

            const boostOutline = new THREE.Mesh(child.geometry, this._boostOutlineMat);
            boostOutline.scale.setScalar(1.14);
            boostOutline.visible = false;
            child.add(boostOutline);
            this._boostOutlines.push(boostOutline);
        });
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
        this.position.y = (this.airY || 0) + getGroundLevelAt(this.position);

        // Smooth knockback updates
        this.knockback = this.knockback || new THREE.Vector3();
        if (this.knockback.lengthSq() > 0.001) {
            this.position.add(this.knockback.clone().multiplyScalar(dt));
            this.knockback.multiplyScalar(Math.exp(-8 * dt)); // smooth exponential decay
        }

        // Animate the 3D Eclipse Mark
        // Référence directe + cache des sous-parties : getObjectByName est une
        // traversée récursive, trop coûteuse par ennemi et par frame.
        const mark = this._markVisual;
        if (mark) {
            if (Globals.camera) {
                mark.lookAt(Globals.camera.position);
            }
            
            const elapsed = Date.now() * 0.001;
            
            if (!mark.userData.partsCached) {
                mark.userData.partsCached = true;
                mark.userData.flares = mark.getObjectByName("flares");
                mark.userData.moon = mark.getObjectByName("moonSphere");
                mark.userData.sunCorona = mark.getObjectByName("sunCorona");
            }

            // Spin the solar flares radiating from the corona
            const flares = mark.userData.flares;
            if (flares) {
                flares.rotation.z = elapsed * 1.5;
            }
            
            // Orbit the moon sphere in front of the sun corona to make the eclipse shadow slide dynamically
            const moon = mark.userData.moon;
            if (moon) {
                const orbitRadius = 0.06;
                const speed = 2.5;
                moon.position.x = Math.cos(elapsed * speed) * orbitRadius;
                moon.position.y = Math.sin(elapsed * speed) * orbitRadius;
                moon.rotation.y = elapsed * 0.8;
            }
            
            // Sun corona breathing scale
            const sunCorona = mark.userData.sunCorona;
            if (sunCorona) {
                const scale = 1.0 + Math.sin(elapsed * 4.0) * 0.08;
                sunCorona.scale.set(scale, scale, 1.0);
            }
            
            // Bob up and down above the enemy's head
            const bob = Math.sin(elapsed * 3.0) * 0.12;
            mark.position.y = (this.radius || 1.0) * 2.8 + bob;
        }

        if (!this.isBoss && !this.isPlayer && this.type !== 'royal_seal' && this.type !== 'boss_pillar') {
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
                if (!this.hudGroup && this.type !== 'royal_seal' && this.type !== 'void_altar' && this.type !== 'boss_pillar') {
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
                        const catchUp = dampFactor(7.0, dt);
                        this.displayHp = THREE.MathUtils.lerp(this.displayHp, this.hp, catchUp);
                        if (Math.abs(this.displayHp - this.hp) < 0.2) this.displayHp = this.hp;

                        if (this.maxBarrierHp > 0) {
                            this.displayBarrier = THREE.MathUtils.lerp(this.displayBarrier, this.barrierHp, catchUp);
                            if (Math.abs(this.displayBarrier - this.barrierHp) < 0.2) this.displayBarrier = this.barrierHp;
                        }

                        // La valeur affichée continue d'avancer à chaque frame, mais le repaint
                        // est plafonné. L'état final est toujours dessiné (`settled`).
                        const settled = this.displayHp === this.hp
                            && (this.maxBarrierHp === 0 || this.displayBarrier === this.barrierHp);
                        const nowMs = performance.now();
                        if (this.hpBarNeedsUpdate || settled
                            || nowMs - (this._lastHpBarDraw || 0) >= HP_BAR_REDRAW_INTERVAL_MS) {
                            this._lastHpBarDraw = nowMs;
                            this.drawHealthBar();
                        }
                    }
                    this.hudGroup.lookAt(Globals.camera.position);
                }
            }
        }

        // Tick status timers
        if (this.gnomeShieldTimer && this.gnomeShieldTimer > 0) {
            this.gnomeShieldTimer -= dt;
            if (Math.random() < 0.15 && Globals.scene) {
                spawnParticles(this.position.clone().add(new THREE.Vector3((Math.random()-0.5)*this.radius*2, Math.random()*1.5, (Math.random()-0.5)*this.radius*2)), 0x3498db, 1);
            }
        }
        if (this.gnomeDamageBoostTimer && this.gnomeDamageBoostTimer > 0) {
            this.gnomeDamageBoostTimer -= dt;
            if (Math.random() < 0.15 && Globals.scene) {
                spawnParticles(this.position.clone().add(new THREE.Vector3((Math.random()-0.5)*this.radius*2, Math.random()*1.5, (Math.random()-0.5)*this.radius*2)), 0xe74c3c, 1);
            }
        }
        if (this.gnomeHealTimer && this.gnomeHealTimer > 0) {
            this.gnomeHealTimer -= dt;
        }

        // Manage status visual representations
        if (this.dead || this.isDying) {
            if (this.shieldVisualBubble) this.shieldVisualBubble.visible = false;
            if (this._healOutlines) this._healOutlines.forEach(o => o.visible = false);
            if (this._boostOutlines) this._boostOutlines.forEach(o => o.visible = false);
        } else {
            // 1. Shield Bubble
            if (this.gnomeShieldTimer && this.gnomeShieldTimer > 0) {
                if (!this.shieldVisualBubble) {
                    const bubbleGroup = new THREE.Group();
                    const size = Math.max(1.0, this.radius) * 1.35;
                    const bubbleGeo = new THREE.SphereGeometry(size, 16, 16);
                    const bubbleMat = new THREE.MeshBasicMaterial({
                        color: 0x3498db,
                        transparent: true,
                        opacity: 0.12,
                        depthWrite: false,
                        blending: THREE.AdditiveBlending,
                        side: THREE.DoubleSide
                    });
                    const bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
                    bubbleGroup.add(bubbleMesh);

                    const wireGeo = new THREE.SphereGeometry(size + 0.01, 10, 10);
                    const wireMat = new THREE.MeshBasicMaterial({
                        color: 0x5dade2,
                        transparent: true,
                        opacity: 0.3,
                        wireframe: true,
                        depthWrite: false,
                        blending: THREE.AdditiveBlending
                    });
                    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
                    bubbleGroup.add(wireMesh);

                    bubbleGroup.position.set(0, this.scaleVal * 0.8, 0);
                    this.add(bubbleGroup);
                    this.shieldVisualBubble = bubbleGroup;
                }
                this.shieldVisualBubble.visible = true;
                this.shieldVisualBubble.rotation.y += dt * 0.6;
                this.shieldVisualBubble.rotation.x += dt * 0.3;
            } else {
                if (this.shieldVisualBubble) {
                    this.shieldVisualBubble.visible = false;
                }
            }

            // 2. Heal / Damage Boost Outlines
            if (this.mesh && !this._statusOutlinesInitialized) {
                this.initStatusOutlines();
            }

            if (this._statusOutlinesInitialized) {
                const isHealed = this.gnomeHealTimer && this.gnomeHealTimer > 0;
                const isBoosted = this.gnomeDamageBoostTimer && this.gnomeDamageBoostTimer > 0;

                if (this._healOutlines) {
                    this._healOutlines.forEach(o => {
                        o.visible = !!isHealed;
                    });
                }
                if (this._boostOutlines) {
                    this._boostOutlines.forEach(o => {
                        o.visible = !!isBoosted;
                    });
                }
            }
        }

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            // resolveCollisions termine déjà par le recalage sur le sol.
            this.resolveCollisions();
            if(this.attackCooldown > 0) {
                const atkSpd = this.isMiniBoss && this.miniBossStats ? this.miniBossStats.attackSpeedMult : 1;
                this.attackCooldown -= dt * Math.max(0.5, atkSpd);
            }
        } else {
            // Côté client, la position vient du réseau : on se contente de coller au terrain.
            this.position.y = (this.airY || 0) + getGroundLevelAt(this.position);
        }
    }

    updateAnim(dt) {
        if (this.model && typeof this.model.updateAnim === 'function') {
            this.model.updateAnim(dt);
        }
    }

    resolveCollisions() {
        const dist = Math.hypot(this.position.x, this.position.z);
        const maxR = getPlayableRadiusAt(this.position.x, this.position.z);
        
        // Si l'ennemi est en dehors de la zone de l'île principale
        if (dist > maxR) {
            const distToSpawn = Math.hypot(this.position.x - 90, this.position.z - 90);
            const distToBoss = Math.hypot(this.position.x - BOSS_ZONE.cx, this.position.z - BOSS_ZONE.cz);
            
            // Et qu'il est en dehors de la zone du spawn (rayon 30) ET de la zone du boss (rayon 30)
            if (distToSpawn > 30 && distToBoss > 30) {
                // On pousse l'ennemi vers la zone autorisée la plus proche (spawn, boss ou île)
                const spawnDx = this.position.x - 90;
                const spawnDz = this.position.z - 90;
                const spawnClampX = 90 + (spawnDx / distToSpawn) * 30;
                const spawnClampZ = 90 + (spawnDz / distToSpawn) * 30;
                
                const bossDx = this.position.x - BOSS_ZONE.cx;
                const bossDz = this.position.z - BOSS_ZONE.cz;
                const bossClampX = BOSS_ZONE.cx + (bossDx / distToBoss) * 30;
                const bossClampZ = BOSS_ZONE.cz + (bossDz / distToBoss) * 30;
                
                const islandClampX = (this.position.x / dist) * maxR;
                const islandClampZ = (this.position.z / dist) * maxR;
                
                const distToSpawnClamp = Math.hypot(this.position.x - spawnClampX, this.position.z - spawnClampZ);
                const distToBossClamp = Math.hypot(this.position.x - bossClampX, this.position.z - bossClampZ);
                const distToIslandClamp = Math.hypot(this.position.x - islandClampX, this.position.z - islandClampZ);
                
                const minDist = Math.min(distToSpawnClamp, distToBossClamp, distToIslandClamp);
                if (minDist === distToSpawnClamp) {
                    this.position.x = spawnClampX;
                    this.position.z = spawnClampZ;
                } else if (minDist === distToBossClamp) {
                    this.position.x = bossClampX;
                    this.position.z = bossClampZ;
                } else {
                    this.position.x = islandClampX;
                    this.position.z = islandClampZ;
                }
                // Repositionnement horizontal brutal : on recale tout de suite l'altitude
                // pour que la séparation ci-dessous travaille sur une distance correcte.
                this.position.y = (this.airY || 0) + getGroundLevelAt(this.position);
            }
        }

        if (Globals.enemies) {
            for (const other of Globals.enemies) {
                if (other === this || other.dead) continue;
                const minDist = this.radius + (other.radius || 0.5); 
                // Comparaison au carré : la racine n'est calculée que sur un contact réel.
                const distSq = this.position.distanceToSquared(other.position);
                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq);
                    _separationDir.subVectors(this.position, other.position).normalize();
                    _separationDir.y = 0;
                    if (_separationDir.lengthSq() === 0) _separationDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
                    this.position.addScaledVector(_separationDir, (minDist - dist) * 0.1); 
                }
            }
        }
        // getGroundLevelAt combine plusieurs bruits trigonométriques : un seul appel en fin de
        // résolution au lieu des trois qui étaient faits par ennemi et par frame.
        this.position.y = (this.airY || 0) + getGroundLevelAt(this.position);
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

        if (this.gnomeDamageBoostTimer && this.gnomeDamageBoostTimer > 0) {
            amount *= 1.2;
        }

        if (this.isMiniBoss && this.miniBossStats) {
            const s = this.miniBossStats;
            const resolved = resolveMiniBossOutgoingDamage(this, baseAmount, target, {
                isAbility: !!opts.isAbility,
            });
            amount = resolved.damage;

            let heal = resolved.lifeStealHeal;
            if (heal > 0 && s.healRecvMult > 1) heal *= s.healRecvMult;
            if (heal > 0 && PassiveKeystoneHooks.isEnemyAntiHealed(this)) heal = 0;
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
        if (this.isBoss) {
            return 120.0; // Les boss ont une aggro immense pour rester actifs partout dans l'arène
        }
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
        // Un ennemi déjà mort ou en animation de mort continuait d'encaisser des coups :
        // chiffres de dégâts, sons et passifs se déclenchaient sur un cadavre.
        if (this.dead || this.isDying) return;

        if (this.gnomeShieldTimer && this.gnomeShieldTimer > 0) {
            amount *= 0.5;
        }

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
