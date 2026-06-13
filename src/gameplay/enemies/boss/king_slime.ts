// @ts-nocheck
import { BaseEnemy } from '../base_enemy';
import { Globals, addEnemy, removeEnemy, GameActions } from '../../../core/globals';
import { STATE, CONFIG } from '../../../core/config';
import { ENEMY_ATTACKS } from '../../../core/enemy_attacks_config';
import { AudioSys } from '../../../core/ressources';
import { createDamageText, spawnParticles, createSkillVisual, createTelegraph } from '../../../visual/effects';
import { flashMeshDamage, restoreMeshDamageFlash, safeMaterialSetHex } from '../../../visual/meshMaterialUtils';
import { Network } from '../../../multiplayer/network';
import { damagePlayer, getAllLivingPlayers } from '../../../multiplayer/net_combat';
import { Projectile } from '../../entities';
import { UI } from '../../../visual/ui';
import { RoyalGuard } from '../minions/royal_guard/royal_guard';
import { BOSS_ZONE } from '../../world/worldZones';

// --- IMPORTS MODULAIRES ---
import { buildKingSlimeModel } from './king_slime_model';
import { KingSlimeAnimator } from './king_slime_animations';

export class KingSlime extends BaseEnemy {
    constructor(position, id = null) {
        super('king', position, id);

        // --- STATS SCALING ---
        const baseHp = 7000;
        // On utilise bossProgress s'il existe, sinon fallback sur ngLevel
        const ng = (STATE.bossProgress && STATE.bossProgress['king']) || STATE.ngLevel || 0;
        
        this.hp = baseHp * Math.pow(1.12, STATE.level - 1) * (1 + ng * 0.4);
        this.maxHp = this.hp;

        this.speed = 3.5;
        this.isBoss = true;
        this.bossPhase = 1;
        this.actionTimer = 2.0;
        this.radius = 3.0;
        this.scaleVal = 3.2;

        // --- VISUALS ---
        this.parts = {};
        this.materials = {};
        this.activeMeteors = [];
        this.activeSpikes = [];
        this.effectsGroup = null;

        // --- ANIMATION MANAGER ---
        this.animState = 'idle';
        this.animator = null;

        // --- AI BRAIN ---
        this.comboQueue = [];
        this.lastTargetDist = 0;
        this.enrageMode = false;
        this.isAttacking = false;
        this.isCinematic = false;
        this.isInvulnerable = false;
        this.sandShieldActivated = false;
        this.shieldMesh = null;

        // --- CONFIG ---
        this.config = ENEMY_ATTACKS.king_slime;

        this.buildModel();
        this.setupHealthBar();

        if (this.config.spawn && this.config.spawn.sound) {
            setTimeout(() => { if (AudioSys.play) AudioSys.play(this.config.spawn.sound, 1.2); }, 500);
        }
    }

    buildModel() {
        if (this.mesh) this.remove(this.mesh);

        const modelData = buildKingSlimeModel(this.scaleVal);

        this.mesh = modelData.mesh;
        this.parts = modelData.parts;
        this.materials = modelData.materials;

        this.applyPhaseMaterials(this.bossPhase);

        this.add(this.mesh);
        Globals.scene.add(this);

        this.animator = new KingSlimeAnimator(this);
    }

    setupHealthBar() {
        let bossHud = document.getElementById('boss-hud');
        if (!bossHud) {
            bossHud = document.createElement('div');
            bossHud.id = 'boss-hud';
            bossHud.style.cssText = `
                position: absolute; top: 80px; left: 50%; transform: translateX(-50%);
                width: 600px; display: none; flex-direction: column; alignItems: center; z-index: 1000;
            `;
            document.body.appendChild(bossHud);
        }

        if (!document.getElementById('boss-hp-fill')) {
            bossHud.innerHTML = `
                <div id="boss-name" style="color:#ffd700; font-family:'Cinzel', serif; font-size:24px; text-shadow:0 0 10px #000; margin-bottom:5px; font-weight:bold;">AETHELGARD, SOUVERAIN D'AMBRE</div>
                <div style="width:100%; height:24px; background:#330000; border:2px solid #ffd700; border-radius:4px; overflow:hidden; box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);">
                    <div id="boss-hp-fill" style="width:100%; height:100%; background:linear-gradient(90deg, #ff0000, #ff8800); transition: width 0.2s;"></div>
                </div>
            `;
        } else {
            const nameEl = document.getElementById('boss-name');
            if (nameEl) {
                nameEl.innerText = "AETHELGARD, SOUVERAIN D'AMBRE";
                nameEl.style.color = "#ffd700";
            }
        }

        bossHud.style.display = 'flex';
        this.updateBossUI();
    }

    updateBossUI() {
        const bar = document.getElementById('boss-hp-fill');
        if (bar) {
            const safeMax = this.maxHp > 0 ? this.maxHp : 1;
            const pct = Math.max(0, Math.min(100, (this.hp / safeMax) * 100));
            bar.style.width = pct + '%';

            if (this.bossPhase === 3) bar.style.background = 'linear-gradient(90deg, #4b0082, #8a2be2)';
            else if (this.bossPhase === 2) bar.style.background = 'linear-gradient(90deg, #ff4400, #aa0000)';
            else bar.style.background = 'linear-gradient(90deg, #ff0000, #ff8800)';
        }
    }

    update(dt) {
        super.update(dt);
        if (this.dead && this.animState !== 'dying') return;

        this.updateBossUI();

        if (this.animState === 'dying') {
            this.deathTimer += dt;
            const parts = this.parts;
            const start = this.deathStart;

            if (start) {
                // --- PHASE 1 : AGONIE ET SURCHARGE D'ÉNERGIE (0.0s - 1.5s) ---
                if (this.deathTimer < 1.5) {
                    const prog = this.deathTimer / 1.5;

                    // Sons de la phase 1
                    if (!this.deathScreamPlayed) {
                        this.deathScreamPlayed = true;
                        if (AudioSys.play) {
                            AudioSys.play('boss_death_scream', 1.2, 0.0);
                            AudioSys.play('boss_energy_buildup', 0.9, 0.0);
                        }
                    }

                    // Tête rejetée en arrière, torse qui se cambre
                    if (parts.body) parts.body.rotation.x = THREE.MathUtils.lerp(start.bodyX, -0.25, prog);
                    if (parts.head) parts.head.rotation.x = THREE.MathUtils.lerp(start.headX, -0.35, prog);

                    // Bras levés à la tête en signe d'agonie / douleur
                    if (parts.armR) {
                        parts.armR.rotation.x = THREE.MathUtils.lerp(start.armRX, -Math.PI / 1.3, prog);
                        parts.armR.rotation.z = THREE.MathUtils.lerp(start.armRZ, -0.4, prog);
                    }
                    if (parts.armL) {
                        parts.armL.rotation.x = THREE.MathUtils.lerp(start.armLX, -Math.PI / 1.3, prog);
                        parts.armL.rotation.z = THREE.MathUtils.lerp(start.armLZ, 0.4, prog);
                    }

                    // L'épée commence à glisser de la main
                    if (parts.swordInfo) {
                        parts.swordInfo.position.y = THREE.MathUtils.lerp(start.swordY, -0.6, prog);
                        parts.swordInfo.rotation.x = THREE.MathUtils.lerp(start.swordX, Math.PI / 2.5, prog);
                    }

                    // Surcharge du cœur d'énergie (pulsations violentes et lueur extrême)
                    if (parts.core) {
                        const pulse = 1.0 + Math.sin(this.deathTimer * 38) * 0.45;
                        parts.core.scale.setScalar(pulse);
                    }
                    if (this.materials && this.materials.energy) {
                        this.materials.energy.emissiveIntensity = 2.0 + Math.sin(this.deathTimer * 38) * 2.5;
                    }

                    // Tremblement continu de la caméra (buildup instable)
                    if (Globals.cameraShake) {
                        Globals.cameraShake.x += (Math.random() - 0.5) * 0.06;
                        Globals.cameraShake.y += (Math.random() - 0.5) * 0.06;
                        Globals.cameraShake.z += (Math.random() - 0.5) * 0.06;
                    }

                    // Particules d'énergie d'ambre projetées périodiquement
                    if (Math.random() < 0.25) {
                        const corePos = this.position.clone().add(new THREE.Vector3(0, 2.0, 0.3));
                        spawnParticles(corePos, 0xffaa00, 3);
                    }
                }

                // --- PHASE 2 : L'EFFONDREMENT (1.5s - 3.2s) ---
                else if (this.deathTimer < 3.2) {
                    const prog = (this.deathTimer - 1.5) / 1.7;

                    // Sons de début d'effondrement
                    if (!this.deathCollapsePlayed) {
                        this.deathCollapsePlayed = true;
                        if (AudioSys.play) {
                            AudioSys.play('boss_armor_collapse', 1.0, 0.0);
                        }
                    }

                    // Chute du mesh vers le sol et inclinaison vers l'avant
                    this.mesh.position.y = THREE.MathUtils.lerp(0, -1.8, prog);
                    this.mesh.rotation.x = THREE.MathUtils.lerp(-0.08, -Math.PI / 2.2, prog);

                    // Les jambes se dérobent et plient
                    if (parts.legL) parts.legL.rotation.x = THREE.MathUtils.lerp(start.legLX, 0.8, prog);
                    if (parts.legR) parts.legR.rotation.x = THREE.MathUtils.lerp(start.legRX, 0.8, prog);

                    // Le torse et la tête s'affaissent vers l'avant/le sol
                    if (parts.body) parts.body.rotation.x = THREE.MathUtils.lerp(-0.25, 0.5, prog);
                    if (parts.head) parts.head.rotation.x = THREE.MathUtils.lerp(-0.35, 0.8, prog);

                    // Les bras tombent mollement
                    if (parts.armR) {
                        parts.armR.rotation.x = THREE.MathUtils.lerp(-Math.PI / 1.3, 0.8, prog);
                        parts.armR.rotation.z = THREE.MathUtils.lerp(-0.4, 0.3, prog);
                    }
                    if (parts.armL) {
                        parts.armL.rotation.x = THREE.MathUtils.lerp(-Math.PI / 1.3, 0.8, prog);
                        parts.armL.rotation.z = THREE.MathUtils.lerp(0.4, -0.3, prog);
                    }

                    // L'épée est lâchée complètement et tombe à plat sur le sol
                    if (parts.swordInfo) {
                        parts.swordInfo.position.y = THREE.MathUtils.lerp(-0.6, -1.3, prog);
                        parts.swordInfo.rotation.x = THREE.MathUtils.lerp(Math.PI / 2.5, Math.PI / 2.0, prog);
                        parts.swordInfo.rotation.y = THREE.MathUtils.lerp(start.swordYRot, Math.PI / 6, prog);
                    }

                    // Le cœur s'éteint doucement
                    if (parts.core) {
                        parts.core.scale.setScalar(THREE.MathUtils.lerp(1.2, 0.1, prog));
                    }
                    if (this.materials && this.materials.energy) {
                        this.materials.energy.emissiveIntensity = THREE.MathUtils.lerp(2.0, 0.0, prog);
                    }
                }

                // --- PHASE 3 : IMPACT SOL ET DISSOLUTION EN SABLE (3.2s - 5.0s) ---
                else {
                    const prog = (this.deathTimer - 3.2) / 1.8;

                    // Sons et effets de l'impact lourd au sol à t = 3.2s
                    if (!this.deathImpactPlayed) {
                        this.deathImpactPlayed = true;
                        if (AudioSys.play) {
                            AudioSys.play('boss_heavy_impact', 1.3, 0.0);
                            AudioSys.play('earth_smash', 1.6, 0.0);
                            AudioSys.play('boss_sand_dissolve', 1.0, 0.0);
                        }
                        if (Globals.cameraShake) {
                            Globals.cameraShake.y += 1.3;
                            Globals.cameraShake.x += (Math.random() - 0.5) * 0.6;
                            Globals.cameraShake.z += (Math.random() - 0.5) * 0.6;
                        }
                        // Gigantesque explosion de particules de sable à l'impact
                        spawnParticles(this.position, 0xc4a47a, 150);
                    }

                    // Le modèle s'enfonce légèrement et rétrécit comme s'il s'effondrait en poussière
                    const scaleFactor = Math.max(0.0, 1.0 - prog);
                    this.mesh.scale.setScalar(this.scaleVal * scaleFactor);
                    this.mesh.position.y = -1.8 - prog * 0.5;

                    // Les matériaux deviennent transparents et s'estompent à 0
                    if (this.materials) {
                        Object.values(this.materials).forEach(mat => {
                            if (mat) mat.opacity = scaleFactor;
                        });
                    }

                    // Colonne de sable s'élevant du boss qui se dissout
                    if (Math.random() < 0.35) {
                        const offset = new THREE.Vector3(
                            (Math.random() - 0.5) * 3.0,
                            0.2,
                            (Math.random() - 0.5) * 3.0
                        );
                        const sandPos = this.position.clone().add(offset);
                        spawnParticles(sandPos, 0xc4a47a, 3);
                    }
                }
            }

            // Fin de la mort à t = 5.0s
            if (this.deathTimer >= 5.0) {
                this.finishDie();
            }
            return;
        }

        if (this.animator) {
            if (!this.isCinematic) this.animator.update(dt);
            else this.updateCinematicAnim(dt);
        }

        this.updateMeteors(dt);
        this.updateSpikes(dt);
        this.handlePhaseLogic(dt);

        if (!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            if (this.isAttacking || this.isCinematic) {
                return;
            }
            this.updateAI(dt);
        }
    }

    updateAI(dt) {
        const target = this.getClosestTarget();
        if (!target) return;

        this.actionTimer -= dt;
        const dist = this.position.distanceTo(target.position);

        if (!this.isAttacking && !this.isCinematic) {
            const targetPos = target.position.clone();
            targetPos.y = this.position.y;
            this.lookAt(targetPos);
        }

        if (this.actionTimer > 0.5 && dist > 6.0) {
            const dir = target.position.clone().sub(this.position).normalize();
            this.position.add(dir.multiplyScalar(this.speed * dt));
        }

        if (this.actionTimer <= 0) {
            this.decideNextAction(target, dist);
            const baseCd = this.bossPhase === 3 ? 1.0 : 2.0;
            this.actionTimer = baseCd + Math.random() * 0.5;
        }
    }

    decideNextAction(target, dist) {
        if (this.shieldMesh) return; // Ne fait rien pendant la protection sablière

        if (this.comboQueue.length > 0) {
            const action = this.comboQueue.shift();
            this.executeAction(action, target);
            return;
        }

        // Si la cible est trop éloignée (> 18.0 unités), on la force à bouger avec l'attaque anti-distance unique
        if (dist > 18.0) {
            this.executeAction('sand_geysers', target);
            return;
        }

        const rand = Math.random();

        // Mode combat : Phase 1
        if (this.bossPhase === 1) {
            if (dist < 8.0) {
                if (rand < 0.6) this.executeAction('slice', target);
                else this.executeAction('sand_call', target);
            } else {
                if (rand < 0.5) this.executeAction('dash_stomp', target);
                else this.executeAction('sand_meteors', target);
            }
        } 
        // Mode combat : Phase 2 & 3
        else {
            if (dist < 8.0) {
                if (rand < 0.4) this.executeAction('double_slice', target);
                else if (rand < 0.7) this.executeAction('slice', target);
                else this.executeAction('sand_call', target);
            } else {
                if (rand < 0.4) this.executeAction('dash_stomp', target);
                else if (rand < 0.8) this.executeAction('sand_meteors', target);
                else this.executeAction('sand_call', target);
            }
        }
    }

    executeAction(type, target) {
        if (type !== 'sand_shield' && !target) return;
        this.isAttacking = true;
        switch (type) {
            case 'slice': this.startSlice(target); break;
            case 'sand_call': this.startSandCall(target); break;
            case 'dash_stomp': this.startDashStomp(target); break;
            case 'sand_meteors': this.startSandMeteors(target); break;
            case 'double_slice': this.startDoubleSlice(target); break;
            case 'sand_shield': this.startSandShield(target); break;
            case 'sand_geysers': this.startSandGeysers(target); break;
        }
    }

    startSlice(target) {
        this.currentAttack = 'slice';
        this.animState = 'windup_cleave';
        
        const lookTarget = target.position.clone();
        lookTarget.y = this.position.y;
        this.lookAt(lookTarget);

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
        const telegraphPos = this.position.clone().addScaledVector(forward, 2.5);
        const angle = Math.atan2(forward.x, forward.z);

        this.spawnTelegraph(telegraphPos, 'cone', 15.0, 0.8, 0xc4a47a, () => {
            this.animState = 'strike_cleave';
            if (AudioSys.play) AudioSys.play('sword_swing', 1.1);

            const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
            createSkillVisual('slash', this.position.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(fwd, 3.5), 14.0, 0xc4a47a, fwd);
            this.applyDamageCone(fwd, 15.0, 0.5, 45);

            setTimeout(() => {
                if (this.dead) return;
                this.isAttacking = false;
                this.animState = 'idle';
            }, 500);
        }, angle);
    }

    startSandGeysers(target) {
        this.currentAttack = 'sand_geysers';
        this.animState = 'cast_spell';

        createDamageText("ÉRUPTIONS CIBLÉES !", this.position, '#c4a47a', 2.0);
        if (AudioSys.play) AudioSys.play('boss_roar', 1.0);

        // On lance 4 geysers successifs sous les pieds de la cible
        const count = 4;
        const interval = 600; // Un geyser toutes les 600ms
        const geyserRadius = 3.5;
        const geyserDmg = 45;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (this.dead || !target || target.dead) return;
                
                // Position actuelle de la cible à cet instant précis
                const targetPos = target.position.clone();
                targetPos.y = 0.1; // Au niveau du sol

                // Télégraphe d'avertissement de 0.8s
                this.spawnTelegraph(targetPos, 'circle', geyserRadius, 0.8, 0xffaa00, () => {
                    if (this.dead) return;
                    
                    // Effets visuels et sonores
                    createSkillVisual('explosion', targetPos, geyserRadius, 0xc4a47a);
                    if (AudioSys.play) AudioSys.play('earth_smash', 0.9);
                    spawnParticles(targetPos, 0xc4a47a, 20);

                    // Calcul des dégâts
                    getAllLivingPlayers().forEach((p) => {
                        const distToGeyser = p.position.distanceTo(targetPos);
                        if (distToGeyser < geyserRadius) {
                            const kb = p.position.clone().sub(targetPos).normalize().multiplyScalar(15);
                            if (kb.length() === 0) kb.set(1, 0, 0);
                            damagePlayer(p, geyserDmg * (1 + this.bossPhase * 0.2), { knockback: kb });
                            createDamageText(Math.floor(geyserDmg * (1 + this.bossPhase * 0.2)), p.position, '#ffaa00');
                        }
                    });
                });
            }, i * interval);
        }

        // Fin de l'attaque après le dernier geyser (1800ms de spawn + 800ms de télégraphe + 200ms de délai)
        setTimeout(() => {
            if (this.dead) return;
            this.isAttacking = false;
            this.animState = 'idle';
        }, 2800);
    }

    startSandCall(target) {
        this.currentAttack = 'sand_call';
        this.animState = 'cast_spell';
        this.isInvulnerable = true;

        createDamageText("APPEL DU SABLE !", this.position, '#c4a47a', 2.0);
        if (AudioSys.play) AudioSys.play('boss_roar', 1.0);

        // Vagues de sable concentriques avec télégraphes individuels pour être évitables/dodgables
        const waveRadii = [4.0, 8.0, 12.0, 16.0];
        waveRadii.forEach((r, idx) => {
            const delay = idx * 500; // Espacement de 500ms pour donner le temps de réagir
            const duration = 1.6; // Durée de chargement du télégraphe circulaire (1.6s de temps de réaction)

            setTimeout(() => {
                if (this.dead) return;
                const pos = this.position.clone();
                this.spawnTelegraph(pos, 'circle', r, duration, 0xc4a47a, () => {
                    if (this.dead) return;
                    createSkillVisual('shockwave', this.position, r, 0xc4a47a);
                    if (AudioSys.play) AudioSys.play('hit', 0.8, 0.5);
                    spawnParticles(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xc4a47a, 15);

                    getAllLivingPlayers().forEach((p) => {
                        const dist = p.position.distanceTo(this.position);
                        // Dégâts appliqués uniquement aux joueurs se trouvant sur la circonférence de la vague (épaisseur de 2.0)
                        if (Math.abs(dist - r) < 2.0) {
                            const kb = p.position.clone().sub(this.position).normalize().multiplyScalar(12);
                            const damageVal = 20; // Dégâts de base réduits de moitié (40 -> 20)
                            damagePlayer(p, damageVal * (1 + this.bossPhase * 0.2), { knockback: kb });
                            createDamageText(Math.floor(damageVal * (1 + this.bossPhase * 0.2)), p.position, '#c4a47a');
                        }
                    });
                });
            }, delay);
        });

        // Durée totale de canalisation rallongée (1500ms de spawn + 1600ms de télégraphe + 400ms de battement)
        setTimeout(() => {
            if (this.dead) return;
            this.isInvulnerable = false;
            this.isAttacking = false;
            this.animState = 'idle';
        }, 3500);
    }

    startDashStomp(target) {
        this.currentAttack = 'dash_stomp';
        this.animState = 'dash_prep';

        const dir = target.position.clone().sub(this.position);
        dir.y = 0;
        const dist = dir.length();
        const dashDist = Math.min(dist, 16.0);
        const dashDir = dir.normalize();
        const dashTarget = this.position.clone().add(dashDir.clone().multiplyScalar(dashDist));
        const angle = Math.atan2(dashDir.x, dashDir.z);

        // 1. Télégraphe rectangulaire représentant la trajectoire du dash (carré)
        const rectCenter = this.position.clone().addScaledVector(dashDir, dashDist / 2);
        this.spawnTelegraph(rectCenter, 'rect', new THREE.Vector2(4.0, dashDist), 0.8, 0xff5500, () => {}, angle);

        // 2. Télégraphe circulaire représentant la zone d'écrasement du pied (stomp)
        this.spawnTelegraph(dashTarget, 'circle', 6.0, 0.8, 0xff5500, () => {
            this.animState = 'dash_stomp';
            
            // Mouvement de glissade rapide (Dash)
            let elapsed = 0;
            const startPos = this.position.clone();
            const dashInterval = setInterval(() => {
                if (this.dead) { clearInterval(dashInterval); return; }
                elapsed += 0.05;
                const pct = Math.min(1.0, elapsed / 0.2);
                this.position.lerpVectors(startPos, dashTarget, pct);
                
                if (pct >= 1.0) {
                    clearInterval(dashInterval);
                    // Écrasement au sol (stomp)
                    createSkillVisual('shockwave', this.position, 6.0, 0xc4a47a);
                    spawnParticles(this.position, 0xc4a47a, 45);
                    if (AudioSys.play) AudioSys.play('earth_smash', 1.4);

                    // Tremblement de caméra
                    getAllLivingPlayers().forEach((p) => {
                        const d = p.position.distanceTo(this.position);
                        if (d < 25 && Globals.cameraShake) {
                            const intensity = (1.0 - d / 25) * 0.6;
                            Globals.cameraShake.y += intensity;
                        }
                    });

                    // Dégâts appliqués dans la zone circulaire du stomp ET le long de la ligne de dash (carré)
                    const damage = 50;
                    const scaledDmg = damage * (1 + this.bossPhase * 0.2);
                    
                    getAllLivingPlayers().forEach((p) => {
                        const distToStomp = p.position.distanceTo(this.position);
                        let hit = false;
                        let kb = null;

                        if (distToStomp < 6.0) {
                            hit = true;
                            kb = p.position.clone().sub(this.position).normalize().multiplyScalar(18);
                        } else {
                            // Check de collision avec la trajectoire rectangulaire (largeur 4.0 soit distance latérale < 2.0)
                            const toPlayer = p.position.clone().sub(startPos);
                            const fwdDist = toPlayer.dot(dashDir);
                            const rightDist = Math.abs(toPlayer.dot(new THREE.Vector3(-dashDir.z, 0, dashDir.x)));

                            if (fwdDist >= 0 && fwdDist <= dashDist && rightDist < 2.0) {
                                hit = true;
                                kb = dashDir.clone().multiplyScalar(15);
                            }
                        }

                        if (hit) {
                            if (kb && kb.length() === 0) kb.set(1, 0, 0);
                            damagePlayer(p, scaledDmg, { knockback: kb });
                            createDamageText(Math.floor(scaledDmg), p.position, '#ff5500');
                        }
                    });
                    
                    setTimeout(() => {
                        if (this.dead) return;
                        this.isAttacking = false;
                        this.animState = 'idle';
                    }, 400);
                }
            }, 30);
        });
    }

    startSandMeteors(target) {
        this.currentAttack = 'sand_meteors';
        this.animState = 'cast_spell';

        const lookTarget = target.position.clone();
        lookTarget.y = this.position.y;
        this.lookAt(lookTarget);

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
        const telegraphPos = this.position.clone().addScaledVector(forward, 7.5);
        const angle = Math.atan2(forward.x, forward.z);

        createDamageText("MÉTÉORITES DE SABLE !", this.position, '#c4a47a', 2.0);

        // Telegraph rectangulaire vers l'avant
        this.spawnTelegraph(telegraphPos, 'rect', new THREE.Vector2(5.0, 15.0), 0.8, 0xc4a47a, () => {
            // Dégâts de la vague de sable rectangulaire vers l'avant
            getAllLivingPlayers().forEach((p) => {
                const toPlayer = p.position.clone().sub(this.position);
                const fwdDist = toPlayer.dot(forward);
                const rightDist = Math.abs(toPlayer.dot(new THREE.Vector3(-forward.z, 0, forward.x)));
                if (fwdDist > 0 && fwdDist < 15.0 && rightDist < 2.5) {
                    damagePlayer(p, 35 * (1 + this.bossPhase * 0.2), { knockback: forward.clone().multiplyScalar(10) });
                    createDamageText(Math.floor(35 * (1 + this.bossPhase * 0.2)), p.position, '#c4a47a');
                }
            });

            // Lancement des 4 météorites
            for (let i = 0; i < 4; i++) {
                const offset = new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12);
                const impactPos = target.position.clone().add(offset);
                impactPos.y = 0.3;
                this.spawnTelegraph(impactPos, 'circle', 4.0, 1.2, 0xc4a47a, () => {});
                setTimeout(() => {
                    if (this.dead) return;
                    this.spawnSandMeteorMesh(impactPos);
                }, 800 + i * 250);
            }

            setTimeout(() => {
                if (this.dead) return;
                this.isAttacking = false;
                this.animState = 'idle';
            }, 1200);
        }, angle);
    }

    spawnSandMeteorMesh(targetPos) {
        const geo = new THREE.DodecahedronGeometry(1.4);
        const mat = new THREE.MeshStandardMaterial({ color: 0xc4a47a, roughness: 0.9, flatShading: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(targetPos.x, 35, targetPos.z);
        mesh.velocity = new THREE.Vector3(0, -35, 0);
        mesh.userData = { isSandMeteor: true };
        Globals.scene.add(mesh);
        this.activeMeteors.push(mesh);
    }

    startDoubleSlice(target) {
        this.currentAttack = 'double_slice';
        this.animState = 'windup_cleave';

        const lookTarget = target.position.clone();
        lookTarget.y = this.position.y;
        this.lookAt(lookTarget);

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
        const telegraphPos = this.position.clone().addScaledVector(forward, 2.5);
        const angle = Math.atan2(forward.x, forward.z);

        // Premier slice
        this.spawnTelegraph(telegraphPos, 'cone', 13.0, 0.5, 0xc4a47a, () => {
            this.animState = 'strike_cleave';
            if (AudioSys.play) AudioSys.play('sword_swing', 1.2);
            
            const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
            createSkillVisual('slash', this.position.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(fwd, 3.0), 12.0, 0xc4a47a, fwd);
            this.applyDamageCone(fwd, 13.0, 0.5, 30);

            // Deuxième slice rapide
            setTimeout(() => {
                if (this.dead) return;
                this.animState = 'windup_cleave_2';
                
                const fwd2 = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
                const telegraphPos2 = this.position.clone().addScaledVector(fwd2, 2.5);
                const angle2 = Math.atan2(fwd2.x, fwd2.z);

                this.spawnTelegraph(telegraphPos2, 'cone', 13.0, 0.4, 0xc4a47a, () => {
                    this.animState = 'strike_cleave_2';
                    if (AudioSys.play) AudioSys.play('sword_swing', 1.3);
                    
                    const fwd3 = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion).normalize();
                    createSkillVisual('slash', this.position.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(fwd3, 3.0), 12.0, 0xc4a47a, fwd3);
                    this.applyDamageCone(fwd3, 13.0, 0.5, 35);

                    setTimeout(() => {
                        if (this.dead) return;
                        this.isAttacking = false;
                        this.animState = 'idle';
                    }, 400);
                }, angle2);

            }, 400);
        }, angle);
    }

    startSandShield(target) {
        this.currentAttack = 'sand_shield';
        this.animState = 'cast_spell';
        this.isInvulnerable = true;

        // Téléportation au centre de l'arène et élévation dans le ciel
        this.position.set(BOSS_ZONE.cx, 4.5, BOSS_ZONE.cz);
        createSkillVisual('explosion', this.position, 8.0, 0xc4a47a);
        spawnParticles(this.position, 0xc4a47a, 50);
        if (AudioSys.play) AudioSys.play('boss_roar', 1.3);

        createDamageText("PROTECTION SABLIÈRE !", this.position, '#c4a47a', 3.0);

        // Ajout du bouclier visuel (sphère translucide)
        this.shieldMesh = new THREE.Mesh(
            new THREE.SphereGeometry(4.2, 32, 32),
            new THREE.MeshStandardMaterial({
                color: 0xc4a47a,
                transparent: true,
                opacity: 0.35,
                emissive: 0xc4a47a,
                emissiveIntensity: 1.0,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        this.add(this.shieldMesh);

        // Spawn du pilier protecteur décalé du centre (pour ne pas être collé sous le boss)
        const angle = Math.random() * Math.PI * 2;
        const dist = 12.0; // 12 unités du centre de l'arène
        const pillarPos = new THREE.Vector3(
            BOSS_ZONE.cx + Math.cos(angle) * dist,
            0,
            BOSS_ZONE.cz + Math.sin(angle) * dist
        );
        const shieldPillar = new SandShieldPillar(pillarPos, this);
        addEnemy(shieldPillar);
        spawnParticles(pillarPos, 0xc4a47a, 30);
    }

    breakSandShield() {
        if (this.shieldMesh) {
            this.remove(this.shieldMesh);
            this.shieldMesh = null;
        }

        this.animState = 'stunned';
        this.isInvulnerable = false;
        createDamageText("BOUCLIER BRISÉ !", this.position, '#ff5500', 3.0);

        // Chute rapide au sol
        let elapsed = 0;
        const startY = this.position.y;
        const fallInterval = setInterval(() => {
            if (this.dead) { clearInterval(fallInterval); return; }
            elapsed += 0.05;
            const pct = Math.min(1.0, elapsed / 0.4);
            this.position.y = THREE.MathUtils.lerp(startY, 0.0, pct);
            
            if (pct >= 1.0) {
                clearInterval(fallInterval);
                // Impact au sol
                createSkillVisual('shockwave', this.position, 8.0, 0xc4a47a);
                spawnParticles(this.position, 0xc4a47a, 60);
                if (AudioSys.play) {
                    AudioSys.play('king_land', 1.8);
                    AudioSys.play('hit', 1.3);
                }

                // Tremblement caméra lourd
                if (Globals.cameraShake) {
                    Globals.cameraShake.y += 0.7;
                }

                // Reste étourdi (stunned) pendant 3.0s
                setTimeout(() => {
                    if (this.dead) return;
                    this.isAttacking = false;
                    this.animState = 'idle';
                }, 3000);
            }
        }, 50);
    }

    updateCinematicAnim(dt) {
        const lerpRot = (obj, axis, val) => { if (obj) obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], val, dt * 5); };
        lerpRot(this.parts.armL, 'z', Math.PI / 3);
        lerpRot(this.parts.armR, 'z', -Math.PI / 3);
        lerpRot(this.parts.armL, 'x', 0);
        lerpRot(this.parts.armR, 'x', 0);
        lerpRot(this.parts.head, 'x', -0.8);
        lerpRot(this.parts.body, 'x', -0.2);
    }

    endEpicPhase3() {
        this.isCinematic = false;
        this.mesh.position.set(0, 0, 0);
        createSkillVisual('shockwave', this.position, 25.0, 0xff0000);
        if (AudioSys.play) AudioSys.play('earth_smash', 2.0);
        this.speed *= 1.5;
        this.actionTimer = 0.5;
        createDamageText("ANNIHILATION", this.position, '#ff0000');
    }

    triggerEpicPhase3() {
        this.isCinematic = true;
        this.animState = 'idle';
        createDamageText("FORME FINALE !!!", this.position, '#ff0000', 4.0);
        if (AudioSys.play) AudioSys.play('boss_roar', 1.0);

        this.effectsGroup = new THREE.Group();
        this.mesh.add(this.effectsGroup);

        const ringGeo = new THREE.TorusGeometry(3.5, 0.1, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        const ring2 = new THREE.Mesh(ringGeo, ringMat); ring2.rotation.x = Math.PI / 3;
        const ring3 = new THREE.Mesh(ringGeo, ringMat); ring3.rotation.x = -Math.PI / 3;
        this.effectsGroup.add(ring1); this.effectsGroup.add(ring2); this.effectsGroup.add(ring3);

        let timer = 0;
        const duration = 3.0;
        const cinematicInt = setInterval(() => {
            if (this.dead) { clearInterval(cinematicInt); return; }
            timer += 0.05;
            this.mesh.position.y = Math.sin(timer * 2) * 0.5 + 2.0;
            ring1.rotation.y += 0.1;
            ring2.rotation.y += 0.1;
            ring3.rotation.y += 0.1;
            this.effectsGroup.rotation.z += 0.02;
            this.mesh.position.x = (Math.random() - 0.5) * 0.3;
            this.mesh.position.z = (Math.random() - 0.5) * 0.3;
            if (timer >= duration) {
                clearInterval(cinematicInt);
                if (this.mesh && this.effectsGroup) {
                    this.mesh.remove(this.effectsGroup);
                }
                this.effectsGroup = null;
                this.endEpicPhase3();
            }
        }, 50);
    }

    applyDamageCone(dir, range, angleThreshold, damage) {
        const scaled = damage * (1 + this.bossPhase * 0.2);
        getAllLivingPlayers().forEach((t) => {
            const dist = t.position.distanceTo(this.position);
            const toPlayer = t.position.clone().sub(this.position).normalize();
            if (dist < range && toPlayer.dot(dir) > angleThreshold) {
                damagePlayer(t, scaled, { knockback: dir.clone().multiplyScalar(20), stunDuration: 0.8 });
                createDamageText("SLASH!", t.position, '#ff0000');
            }
        });
    }

    applyAreaDamage(center, radius, damage, pushForce) {
        const scaled = damage * (1 + this.bossPhase * 0.2);
        getAllLivingPlayers().forEach((t) => {
            if (t.position.distanceTo(center) < radius) {
                const kbDir = t.position.clone().sub(center).normalize();
                if (kbDir.length() === 0) kbDir.set(1, 0, 0);
                damagePlayer(t, scaled, { knockback: kbDir.multiplyScalar(pushForce) });
            }
        });
    }

    spawnTelegraph(pos, shape, size, duration, color, onComplete, rotY = 0) {
        const t = createTelegraph(pos, shape, size, duration, color, onComplete, rotY);
        this.trackTelegraph(t);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'telegraph-spawn', pos: { x: pos.x, y: pos.y, z: pos.z }, shape, size, duration, color, rotationY: rotY });
        }
    }

    updateMeteors(dt) {
        for (let i = this.activeMeteors.length - 1; i >= 0; i--) {
            const m = this.activeMeteors[i];
            if (!m.velocity) { Globals.scene.remove(m); this.activeMeteors.splice(i, 1); continue; }
            m.position.add(m.velocity.clone().multiplyScalar(dt));
            m.rotation.x += dt * 8; m.rotation.z += dt * 8;
            const isVoid = m.userData && m.userData.isVoidBall;
            const isSand = m.userData && m.userData.isSandMeteor;
            const trailColor = isSand ? 0xc4a47a : (isVoid ? 0x8a2be2 : 0xff5500);
            if (Math.random() < 0.8) spawnParticles(m.position, trailColor, 3);
            if (m.position.y <= 0.5) {
                const impactColor = isSand ? 0xc4a47a : (isVoid ? 0x8a2be2 : 0xff5500);
                const particleColor = isSand ? 0xc4a47a : (isVoid ? 0x4b0082 : 0xffaa00);
                const radius = isSand ? 4.0 : (isVoid ? 8.0 : 5.0);
                const dmg = isSand ? 35 : (isVoid ? 60 : 35);
                const knockback = isSand ? 10 : (isVoid ? 15 : 10);
                createSkillVisual('explosion', m.position, radius, impactColor);
                spawnParticles(m.position, particleColor, 20);
                if (AudioSys.play) AudioSys.play('earth_smash', isVoid ? 1.0 : 0.8);
                getAllLivingPlayers().forEach((t) => {
                    if (t.position.distanceTo(m.position) < radius) {
                        const kb = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(knockback);
                        damagePlayer(t, dmg * (1 + this.bossPhase * 0.2), { knockback: kb });
                        createDamageText(Math.floor(dmg * (1 + this.bossPhase * 0.2)), t.position, impactColor);
                    }
                });
                Globals.scene.remove(m); if (m.geometry) m.geometry.dispose(); this.activeMeteors.splice(i, 1);
            }
        }
    }

    updateSpikes(dt) {
        for (let i = this.activeSpikes.length - 1; i >= 0; i--) {
            const s = this.activeSpikes[i];
            if (s.userData.state === 'up') {
                s.position.y = THREE.MathUtils.lerp(s.position.y, s.userData.targetY, dt * s.userData.speed);
                s.userData.life -= dt;
                if (s.userData.life <= 0) s.userData.state = 'down';
            } else {
                s.position.y = THREE.MathUtils.lerp(s.position.y, -5, dt * 5.0);
                if (s.position.y < -3) { Globals.scene.remove(s); if (s.geometry) s.geometry.dispose(); this.activeSpikes.splice(i, 1); }
            }
        }
    }

    updateJumpPhysics(dt) {
        this.jumpTime += dt;
        const t = this.jumpTime / this.jumpDuration;
        if (t < 0.2) this.animState = 'windup_jump';
        else if (t < 1.0) {
            this.animState = 'air_jump';
            const flightT = (t - 0.2) / 0.8;
            const h = Math.sin(flightT * Math.PI) * 18.0;
            this.position.lerpVectors(this.jumpStartPos, this.jumpTargetPos, flightT);
            this.position.y = h;
        } else {
            this.position.copy(this.jumpTargetPos); this.position.y = 0;
            this.mesh.position.y = 0; this.mesh.rotation.x = 0; this.mesh.rotation.z = 0;
            if (this.parts && this.parts.body) this.parts.body.rotation.set(0, 0, 0);
            this.applyAreaDamage(this.position, 8.0, 50, 20);
            createSkillVisual('shockwave', this.position, 9.0, 0xffaa00);
            if (AudioSys.play) AudioSys.play('king_land', 1.5);
            spawnParticles(this.position, 0x8B4513, 40);
            this.isAttacking = false; this.animState = 'idle';
        }
    }

    handlePhaseLogic(dt) {
        const hpPct = this.hp / this.maxHp;
        let newPhase = this.bossPhase;
        if (this.bossPhase === 1 && hpPct <= 0.6) newPhase = 2;
        if (this.bossPhase === 2 && hpPct <= 0.2) newPhase = 3;
        if (newPhase !== this.bossPhase) this.changePhase(newPhase);

        // Protection sablière active une fois max en phase 2
        if (this.bossPhase === 2 && !this.sandShieldActivated && !this.isAttacking && !this.isCinematic) {
            this.sandShieldActivated = true;
            this.executeAction('sand_shield', null);
        }
    }

    applyPhaseMaterials(phase) {
        if (!this.materials) return;
        const mats = this.materials;
        if (phase === 1) {
            if (mats.amber) {
                mats.amber.color.setHex(0x6e4e2b);
                mats.amber.emissive.setHex(0x2b1c0a);
                mats.amber.emissiveIntensity = 0.2;
            }
            if (mats.gold) {
                mats.gold.color.setHex(0x7a6348);
                mats.gold.emissive.setHex(0x1a0f00);
                mats.gold.emissiveIntensity = 0.05;
            }
            if (mats.energy) {
                mats.energy.color.setHex(0x5e3c1a);
                mats.energy.emissive.setHex(0x2d1705);
                mats.energy.emissiveIntensity = 0.3;
            }
            if (mats.clothRed) {
                mats.clothRed.color.setHex(0x3d2323);
            }
        } else if (phase === 2) {
            if (mats.amber) {
                mats.amber.color.setHex(0xffa500);
                mats.amber.emissive.setHex(0xff4500);
                mats.amber.emissiveIntensity = 1.0;
            }
            if (mats.gold) {
                mats.gold.color.setHex(0xffd700);
                mats.gold.emissive.setHex(0xaa6600);
                mats.gold.emissiveIntensity = 0.25;
            }
            if (mats.energy) {
                mats.energy.color.setHex(0xff8800);
                mats.energy.emissive.setHex(0xffaa00);
                mats.energy.emissiveIntensity = 2.5;
            }
            if (mats.clothRed) {
                mats.clothRed.color.setHex(0x661111);
            }
        } else if (phase === 3) {
            if (mats.amber) {
                mats.amber.color.setHex(0xdd2200);
                mats.amber.emissive.setHex(0xff0000);
                mats.amber.emissiveIntensity = 2.0;
            }
            if (mats.gold) {
                mats.gold.color.setHex(0x331a00);
                mats.gold.emissive.setHex(0x110000);
                mats.gold.emissiveIntensity = 0.0;
            }
            if (mats.energy) {
                mats.energy.color.setHex(0xff0000);
                mats.energy.emissive.setHex(0xff0000);
                mats.energy.emissiveIntensity = 3.5;
            }
            if (mats.clothRed) {
                mats.clothRed.color.setHex(0x220505);
            }
        }
    }

    changePhase(phase) {
        this.bossPhase = phase;
        this.applyPhaseMaterials(phase);
        if (phase === 2) {
            spawnParticles(this.position, 0xff8800, 50);
            if (AudioSys.play) AudioSys.play('boss_roar', 1.2);
            createDamageText("MODE OFFENSIF", this.position, '#ff8800', 3.0);
        }
        else if (phase === 3) {
            this.triggerEpicPhase3();
        }
    }

    takeDamage(amount) {
        if (this.isCinematic || this.isInvulnerable) { createDamageText("INVULNÉRABLE", this.position, '#888888'); return; }
        this.hp -= amount;
        createDamageText(Math.floor(amount), this.position);
        if (this.hp <= 0 && !this.dead) this.die();
        if (this.mesh) {
            if (this.flashTimeout) clearTimeout(this.flashTimeout);
            flashMeshDamage(this.mesh);
            this.flashTimeout = setTimeout(() => {
                this.flashTimeout = null;
                if (this.dead || !this.mesh) return;
                restoreMeshDamageFlash(this.mesh);
                this.applyPhaseMaterials(this.bossPhase);
            }, 80);
        }
    }
    pushBack(force) { return; }
    applyStun(duration) { return; }

    die() {
        if (this.flashTimeout) { clearTimeout(this.flashTimeout); this.flashTimeout = null; }
        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) { super.die(); return; }

        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.style.display = 'none';

        this.activeMeteors.forEach(m => Globals.scene.remove(m));
        this.activeMeteors = [];
        this.activeSpikes.forEach(s => Globals.scene.remove(s));
        this.activeSpikes = [];
        if (this.effectsGroup) this.mesh.remove(this.effectsGroup);
        if (this.shieldMesh) { this.remove(this.shieldMesh); this.shieldMesh = null; }

        // Début de la cinématique lente de mort (5 secondes)
        this.dead = true;
        this.animState = 'dying';
        this.deathTimer = 0.0;
        this.deathScreamPlayed = false;
        this.deathCollapsePlayed = false;
        this.deathImpactPlayed = false;
        this.deathDissolvePlayed = false;
        this.isCinematic = true;

        const parts = this.parts || {};
        this.deathStart = {
            bodyX: parts.body ? parts.body.rotation.x : 0,
            headX: parts.head ? parts.head.rotation.x : 0,
            armRX: parts.armR ? parts.armR.rotation.x : 0.2,
            armRZ: parts.armR ? parts.armR.rotation.z : 0.2,
            armLX: parts.armL ? parts.armL.rotation.x : 0.1,
            armLZ: parts.armL ? parts.armL.rotation.z : -0.15,
            swordY: parts.swordInfo ? parts.swordInfo.position.y : -0.22,
            swordX: parts.swordInfo ? parts.swordInfo.rotation.x : Math.PI / 3.5,
            swordYRot: parts.swordInfo ? parts.swordInfo.rotation.y : 0,
            legLX: parts.legL ? parts.legL.rotation.x : 0,
            legRX: parts.legR ? parts.legR.rotation.x : 0
        };

        if (this.materials) {
            Object.values(this.materials).forEach(mat => {
                if (mat) mat.transparent = true;
            });
        }
    }

    finishDie() {
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'prismatic-trigger' });
            Network.send({ type: 'boss-cleared' });
        }
        if (UI.showPrismaticReward) UI.showPrismaticReward();

        if (Globals.player && Globals.player.dead) {
            const specMsg = document.getElementById('spectate-msg');
            if (specMsg) specMsg.style.display = 'none';
            const btn = document.getElementById('btn-respawn');
            if (btn) { btn.style.display = 'block'; btn.disabled = false; btn.innerText = "RESSUSCITER"; }
        }

        super.die();
    }
}

// --- CLASSE PILIER DE PROTECTION SABLIÈRE ---
class SandShieldPillar extends BaseEnemy {
    constructor(position, master) {
        super('shield_pillar', position);
        this.master = master;
        this.hp = 1200;
        this.maxHp = this.hp;
        this.speed = 0;
        this.isBoss = false;
        this.pushable = false;
        this.radius = 1.8;
        
        this.buildModel();
        this.setupHealthBar('#ffaa00'); // Barre de vie orange sablonneuse
        if (Globals.scene) Globals.scene.add(this);
    }

    buildModel() {
        this.mesh = new THREE.Group();

        // Palette de matériaux assortie à Aethelgard
        const mats = {
            sandstone: new THREE.MeshStandardMaterial({ color: 0xc4a47a, roughness: 0.9, flatShading: true }),
            gold: new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 0.9 }),
            darkStone: new THREE.MeshStandardMaterial({ color: 0x221c15, roughness: 0.8 }),
            energy: new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff7700, emissiveIntensity: 2.0 }),
            amber: new THREE.MeshPhysicalMaterial({
                color: 0xff8800,
                emissive: 0xff4400,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.9,
                roughness: 0.1,
                metalness: 0.1,
                transmission: 0.6,
                thickness: 0.8
            })
        };

        // 1. Socle lourd en pierre sombre
        const baseGeo = new THREE.CylinderGeometry(1.3, 1.6, 0.8, 8);
        const baseMesh = new THREE.Mesh(baseGeo, mats.darkStone);
        baseMesh.position.y = 0.4;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        this.mesh.add(baseMesh);

        // 2. Fût principal en grès sculpté (segments empilés)
        const segmentCount = 3;
        const h = 1.0;
        for (let i = 0; i < segmentCount; i++) {
            const r = 0.9 - i * 0.08;
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.08, h, 8), mats.sandstone);
            seg.position.y = 0.8 + i * h + h / 2;
            seg.rotation.y = i * (Math.PI / 4); // Effet torsadé
            seg.castShadow = true;
            seg.receiveShadow = true;
            this.mesh.add(seg);

            // Anneaux d'énergie jaune entre chaque segment
            if (i < segmentCount - 1) {
                const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.06, 6, 24), mats.energy);
                ring.position.y = 0.8 + (i + 1) * h;
                ring.rotation.x = Math.PI / 2;
                this.mesh.add(ring);
            }
        }

        // 3. Chapiteau en ornement doré
        const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 0.4, 8), mats.gold);
        topCap.position.y = 3.9;
        topCap.castShadow = true;
        this.mesh.add(topCap);

        // 4. Cristal d'ambre central flottant au-dessus
        this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 1), mats.amber);
        this.crystal.position.y = 4.6;
        this.mesh.add(this.crystal);

        // 5. Anneau d'énergie orbital qui tourne autour du cristal
        this.orbitalRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 32), mats.energy);
        this.orbitalRing.position.y = 4.6;
        this.orbitalRing.rotation.x = Math.PI / 2 + 0.2; // Légèrement penché
        this.mesh.add(this.orbitalRing);

        // 6. Éclats de pierre flottants orbitant autour du corps
        this.floatingShards = new THREE.Group();
        this.floatingShards.position.y = 2.3;
        this.mesh.add(this.floatingShards);

        for (let j = 0; j < 4; j++) {
            const angle = (j / 4) * Math.PI * 2;
            const shard = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), mats.darkStone);
            shard.position.set(Math.cos(angle) * 1.4, (Math.random() - 0.5) * 0.8, Math.sin(angle) * 1.4);
            shard.userData = { angle: angle, speed: 1.0 + Math.random() * 0.5, radius: 1.4 };
            this.floatingShards.add(shard);
        }

        this.add(this.mesh);
    }

    update(dt) {
        super.update(dt);

        // Positionne la barre de vie proprement au-dessus du modèle
        if (this.hudGroup) {
            this.hudGroup.position.y = 5.4; // Bien au-dessus du cristal flottant (y=4.6)
        }

        if (this.dead) return;

        // Rotation lente du cristal et ondulation haut/bas
        if (this.crystal) {
            this.crystal.rotation.y += dt * 1.2;
            this.crystal.position.y = 4.6 + Math.sin(Date.now() * 0.003) * 0.08;
        }

        // Rotation rapide de l'anneau orbital
        if (this.orbitalRing) {
            this.orbitalRing.rotation.z -= dt * 2.0;
        }

        // Orbite des éclats de pierre flottants
        if (this.floatingShards) {
            this.floatingShards.children.forEach(shard => {
                shard.userData.angle += dt * shard.userData.speed;
                shard.position.x = Math.cos(shard.userData.angle) * shard.userData.radius;
                shard.position.z = Math.sin(shard.userData.angle) * shard.userData.radius;
                shard.rotation.x += dt;
                shard.rotation.y += dt * 0.5;
            });
        }
        
        // Spawn occasionnel de particules d'ambre vers le haut
        if (Math.random() < 0.1 && Globals.scene) {
            const partPos = this.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 4.6, (Math.random() - 0.5) * 1.5));
            spawnParticles(partPos, 0xffaa00, 1);
        }
    }

    takeDamage(amount, source) {
        this.hp -= amount;
        createDamageText(Math.floor(amount), this.position, '#ffffff');
        
        if (this.mesh) {
            if (this.flashTimeout) clearTimeout(this.flashTimeout);
            flashMeshDamage(this.mesh);
            this.flashTimeout = setTimeout(() => {
                this.flashTimeout = null;
                if (this.dead || !this.mesh) return;
                restoreMeshDamageFlash(this.mesh);
            }, 80);
        }
        
        const impactPos = this.position.clone().add(new THREE.Vector3(0, 2, 0));
        spawnParticles(impactPos, 0xc4a47a, 8);

        if (this.hp <= 0 && !this.dead) {
            if (this.flashTimeout) { clearTimeout(this.flashTimeout); this.flashTimeout = null; }
            this.die();
        }
    }

    die() {
        super.die();
        createSkillVisual('explosion', this.position, 6.0, 0xc4a47a);
        spawnParticles(this.position, 0xc4a47a, 50);
        if (AudioSys.play) AudioSys.play('earth_smash', 1.2);

        removeEnemy(this);
        Globals.scene.remove(this);

        // Bris du bouclier du boss
        if (this.master && !this.master.dead) {
            this.master.breakSandShield();
        }
    }

    pushBack() {}
    applyStun() {}
}