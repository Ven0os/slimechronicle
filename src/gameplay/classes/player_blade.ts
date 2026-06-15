// @ts-nocheck
import { PlayerBase } from '../player_base';
import { CONFIG, STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createSkillVisual, createDamageText, spawnParticles } from '../../visual/effects';
import { Network } from '../../multiplayer/network';
import { Globals, GameActions } from '../../core/globals';
import { ConstellationEngine } from '../../systems/constellationEngine';
import { ConvergenceEffects } from '../../systems/convergenceEffects';
import { PassiveKeystoneHooks } from '../../systems/passiveKeystoneHooks';
import { Projectile } from '../entities';
import { dealDamageToEnemy } from '../combat/damage_helpers';
import { canDealDamageDirectly, sendSkillIntent, shouldSendSkillIntent } from '../../multiplayer/net_authority';
import { calcSkillBaseDamage } from '../../data/classStatsConfig';

export class Blade extends PlayerBase {
    constructor() {
        super('blade');
        this.fluxCharge = 0;
        this.bloodShield = 0;
        this.bloodShieldMax = 0; 
        
        // États
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashDir = new THREE.Vector3();
        this.dashHitSet = new Set(); 

        this.isCasting = false; 
        this.originalSpeed = this.speed;

        // Système d'animation fluide
        this.animState = {
            torsoRot: 0,
            armR_Rot: { x: 0, y: 0, z: 0 },
            armL_Rot: { x: 0, y: 0, z: 0 },
            weaponRot: { x: Math.PI/2, y: Math.PI, z: 0 }, 
            override: false,
            heightOffset: 0,
            scale: 1
        };

        this.createClassModel();
        this.applyClassStats();
    }

    createClassModel() {
        // --- PALETTE "OMBRE AZUR" ---
        const colorSkin = 0xffccaa;
        const colorCloth = 0x1abc9c; // Teal vif
        const colorDark = 0x0a0a0a; // Noir profond
        const colorMetal = 0xe0e0e0; // Argent blanc
        const colorGlow = 0x00ffff; // Cyan néon

        const skinMat = new THREE.MeshStandardMaterial({ color: colorSkin, roughness: 0.6, name: 'bodyPart' });
        const clothMat = new THREE.MeshStandardMaterial({ color: colorCloth, roughness: 0.9, side: THREE.DoubleSide, name: 'bodyPart' });
        const darkMat = new THREE.MeshStandardMaterial({ color: colorDark, roughness: 0.7, name: 'bodyPart' });
        const metalMat = new THREE.MeshStandardMaterial({ color: colorMetal, roughness: 0.2, metalness: 0.9, name: 'bodyPart' });
        const glowMat = new THREE.MeshBasicMaterial({ color: colorGlow, name: 'bodyPart' });

        this.mesh = new THREE.Group();
        this.bodyGroup.add(this.mesh);

        // --- JAMBES ---
        const legHeight = 0.8;
        this.legL = new THREE.Group(); this.legL.position.set(-0.15, legHeight, 0);
        const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.45), darkMat); thighL.position.y = -0.22; this.legL.add(thighL);
        const shinL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.4), darkMat); shinL.position.y = -0.6; this.legL.add(shinL);
        const kneeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.05), metalMat); kneeL.position.set(0, -0.4, 0.1); this.legL.add(kneeL);
        this.mesh.add(this.legL);

        this.legR = new THREE.Group(); this.legR.position.set(0.15, legHeight, 0);
        const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.45), darkMat); thighR.position.y = -0.22; this.legR.add(thighR);
        const shinR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.4), darkMat); shinR.position.y = -0.6; this.legR.add(shinR);
        const kneeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.05), metalMat); kneeR.position.set(0, -0.4, 0.1); this.legR.add(kneeR);
        this.mesh.add(this.legR);

        // --- CORPS ---
        this.body = new THREE.Group(); this.body.position.y = legHeight; this.mesh.add(this.body);
        const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.25), darkMat); hips.position.y = 0.1; this.body.add(hips);
        const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.15), clothMat); sash.position.y = 0.15; this.body.add(sash);
        const knot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.1), clothMat); knot.position.set(0, 0.15, -0.2); this.body.add(knot);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 8), darkMat); torso.position.y = 0.5; this.body.add(torso);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.05), metalMat); plate.position.set(0, 0.55, 0.23); plate.rotation.x = -0.1; this.body.add(plate);

        // --- TÊTE ---
        this.headGroup = new THREE.Group(); this.headGroup.position.y = 0.85; this.body.add(this.headGroup);
        const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.22), darkMat); this.headGroup.add(headBase);
        const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.2, 0.2, 8, 1, true, 0, Math.PI), clothMat); mask.rotation.y = -Math.PI/2; mask.position.set(0, -0.05, 0); this.headGroup.add(mask);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), glowMat); visor.position.set(0, 0.05, 0.2); this.headGroup.add(visor);

        // --- ÉCHARPE ---
        this.scarfGroup = new THREE.Group(); this.scarfGroup.position.set(0, 0.75, -0.1); this.body.add(this.scarfGroup);
        for(let i=0; i<5; i++) {
            const seg = new THREE.Mesh(new THREE.BoxGeometry(0.4 - (i*0.06), 0.02, 0.35), clothMat);
            seg.position.set(0, 0, -(0.2 + i*0.3));
            this.scarfGroup.add(seg);
        }

        // --- BRAS ---
        this.shoulders = new THREE.Group(); this.shoulders.position.y = 0.7; this.body.add(this.shoulders);
        const padGeo = new THREE.CylinderGeometry(0.05, 0.15, 0.15, 4);
        const padL = new THREE.Mesh(padGeo, metalMat); padL.position.set(0.35, 0.1, 0); padL.rotation.z = -0.2; this.shoulders.add(padL);
        const padR = new THREE.Mesh(padGeo, metalMat); padR.position.set(-0.35, 0.1, 0); padR.rotation.z = 0.2; this.shoulders.add(padR);

        const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.5);
        this.armL = new THREE.Group(); this.armL.position.set(0.35, 0, 0); this.shoulders.add(this.armL);
        const meshL = new THREE.Mesh(armGeo, darkMat); meshL.position.y = -0.25; this.armL.add(meshL);
        const gauntletL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.25), metalMat); gauntletL.position.y = -0.35; this.armL.add(gauntletL);

        this.armR = new THREE.Group(); this.armR.position.set(-0.35, 0, 0); this.shoulders.add(this.armR);
        const meshR = new THREE.Mesh(armGeo, darkMat); meshR.position.y = -0.25; this.armR.add(meshR);
        const gauntletR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.25), metalMat); gauntletR.position.y = -0.35; this.armR.add(gauntletR);

        // --- ARME : KATANA LÉGENDAIRE ---
        this.weaponGroup = new THREE.Group();
        this.weaponGroup.position.set(0, -0.45, 0); 
        this.armR.add(this.weaponGroup);
        this.weaponGroup.rotation.x = Math.PI/2; 
        this.weaponGroup.rotation.y = Math.PI; 

        const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 6), metalMat); tsuba.rotation.x = Math.PI/2; tsuba.position.y = 0.15; this.weaponGroup.add(tsuba);
        const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4), darkMat); tsuka.rotation.x = Math.PI/2; tsuka.position.y = -0.05; this.weaponGroup.add(tsuka);

        const blade = new THREE.Group(); blade.position.y = 0.15; this.weaponGroup.add(blade);
        const bladeCore = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.015), metalMat); bladeCore.position.y = 0.8; blade.add(bladeCore);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.62, 0.02), glowMat); edge.position.set(0.03, 0.8, 0); blade.add(edge);
    }

    applyClassStats() {
        super.applyClassStats();
        this.bloodShieldMax = this.maxHp * 0.25;
    }

    takeDamage(amount) {
        if (this.bloodShield > 0) {
            if (this.bloodShield >= amount) {
                this.bloodShield -= amount; amount = 0; 
                createDamageText("ABSORBÉ", this.position, '#1abc9c');
            } else {
                amount -= this.bloodShield; this.bloodShield = 0;
            }
        }
        super.takeDamage(amount);
    }

    getPassiveMultiplier() {
        return ConvergenceEffects.getBladeBloodThirstDamageMult(this);
    }

    getBladeDamage(skillKey, passiveMult = 1) {
        const base = calcSkillBaseDamage('blade', skillKey) * passiveMult;
        const flat = PassiveKeystoneHooks.getBloodFrenzyFlatDamage(this);
        return ConstellationEngine.modifyDamageDealt(base + flat, { skill: true, skillKey });
    }

    getBreakpointDamageOptions(skillKey) {
        return ConvergenceEffects.getBladeBreakpointDamageOptions(this, skillKey);
    }

    resolveBreakpointExecution(enemy, skillKey) {
        if (!enemy?.dead) return;
        ConvergenceEffects.onBladeBreakpointExecution(this, skillKey);
    }

    animateCharacter(dt) {
        super.animateCharacter(dt);
        
        this.mesh.position.y = this.animState.heightOffset;
        this.mesh.scale.setScalar(this.animState.scale);

        // Écharpe dynamique
        if(this.scarfGroup) {
            const speed = (this.isMoving || this.isDashing) ? 20 : 3;
            const wind = Math.sin(this.animTime * 0.5) * 0.1;
            this.scarfGroup.children.forEach((seg, i) => {
                const wave = Math.sin(this.animTime * 0.8 - i * 0.5) * 0.3;
                const lift = (this.isMoving || this.isDashing) ? 0.8 : 0.1;
                seg.rotation.x = lift + wave * 0.2 + wind;
                seg.rotation.z = Math.cos(this.animTime + i) * 0.1;
            });
            this.scarfGroup.rotation.y = -this.animState.torsoRot * 0.5;
        }

        const lerpSpeed = dt * 15; 

        if (!this.animState.override) {
            if (this.isMoving) {
                this.animState.torsoRot = Math.sin(this.animTime) * 0.3;
                this.body.rotation.x = 0.4; 
                this.animState.armR_Rot.x = 0.8 + Math.sin(this.animTime) * 0.4;
                this.animState.armL_Rot.x = 0.8 + Math.sin(this.animTime + Math.PI) * 0.4;
                this.animState.armR_Rot.z = -0.2;
                this.animState.armL_Rot.z = 0.2;
            } else {
                this.body.rotation.x = 0;
                this.animState.torsoRot = -0.5; 
                const breath = Math.sin(Date.now() * 0.003) * 0.05;
                this.animState.armR_Rot.x = 0 + breath;
                this.animState.armR_Rot.z = 0.2; 
                this.animState.armL_Rot.x = 0 + breath;
                this.animState.armL_Rot.z = -0.2;
            }
        } else {
            if(this.animState.heightOffset === 0) this.body.rotation.x = 0;
        }

        this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, this.animState.torsoRot, lerpSpeed);
        
        this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, this.animState.armR_Rot.x, lerpSpeed);
        this.armR.rotation.y = THREE.MathUtils.lerp(this.armR.rotation.y, this.animState.armR_Rot.y, lerpSpeed);
        this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, this.animState.armR_Rot.z, lerpSpeed);

        this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, this.animState.armL_Rot.x, lerpSpeed);
        this.armL.rotation.y = THREE.MathUtils.lerp(this.armL.rotation.y, this.animState.armL_Rot.y, lerpSpeed);
        this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, this.animState.armL_Rot.z, lerpSpeed);
        
        if(this.weaponGroup) {
            this.weaponGroup.rotation.x = THREE.MathUtils.lerp(this.weaponGroup.rotation.x, this.animState.weaponRot.x, lerpSpeed);
            this.weaponGroup.rotation.y = THREE.MathUtils.lerp(this.weaponGroup.rotation.y, this.animState.weaponRot.y, lerpSpeed);
            this.weaponGroup.rotation.z = THREE.MathUtils.lerp(this.weaponGroup.rotation.z, this.animState.weaponRot.z, lerpSpeed);
        }
    }

    update(dt) {
        if (this.isCasting) {
             this.speed = 0; 
             this.isMoving = false;
        } else {
             this.speed = STATE.stats.speed; 
        }
        
        // --- LOGIQUE DASH CORRIGÉE ET FLUIDIFIÉE ---
        if (this.isDashing) {
            this.dashTimer -= dt;
            const dashSpeed = 60.0; // Vitesse élevée
            
            // Déplacement
            const moveStep = this.dashDir.clone().multiplyScalar(dashSpeed * dt);
            this.position.add(moveStep);
            
            const targetRot = Math.atan2(this.dashDir.x, this.dashDir.z);
            this.mesh.rotation.y = targetRot;

            this.resolveCollisions(); 

            // Dégâts
            const passiveMult = this.getPassiveMultiplier();
            Globals.enemies.forEach(e => {
                if(this.dashHitSet.has(e) || e.dead) return;
                
                if (e.position.distanceTo(this.position) < 2.5) {
                    this.dashHitSet.add(e);
                    
                    const dmg = this.getBladeDamage('shift', passiveMult);
                    dealDamageToEnemy(e, dmg, { pos: e.position, ...this.getBreakpointDamageOptions('shift') });
                    this.resolveBreakpointExecution(e, 'shift');
                    spawnParticles(e.position, CONFIG.colors.blade, 8);
                    createSkillVisual('slash', e.position, 1.5, 0x1abc9c, this.dashDir);
                }
            });

            if (this.dashTimer % 0.05 < dt) {
                this.spawnGhost();
            }

            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.animState.override = false;
                this.body.rotation.x = 0;
                PassiveKeystoneHooks.onBladeDashEnd(this);
            }
        }

        super.update(dt);
    }

    updateClassPassives(dt) {
        const resourceEl = document.getElementById('class-resource');
        if (resourceEl) {
            if (ConstellationEngine.isApexPassiveActive('eternalThirst', 'blade')) {
                const summary = ConvergenceEffects.getBladeBreakpointSummary(this);
                const thirst = ConvergenceEffects.getBladeBloodThirstSummary(this);
                const critPct = Math.round(summary.critBonus * 100);
                const critDmgPct = Math.round(summary.critDmgBonus * 100);
                const thirstPct = Math.round(thirst.bonus * 100);
                const thirstCapPct = Math.round(thirst.cap * 100);
                const readyText = summary.active ? 'RUPTURE ACTIVE' : summary.ready ? 'RUPTURE PRÊTE' : summary.cdRemaining > 0 ? `${summary.cdRemaining.toFixed(1)}s` : `${Math.ceil(summary.hpPct * 100)}% HP`;
                const pct = Math.min(100, (summary.missingPct / 0.9) * 100);
                const color = summary.ready || summary.active ? '#ff2d55' : '#1abc9c';
                resourceEl.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-family:'Cinzel', serif; font-size:10px; font-weight:700; color:${color};">
                            <span style="display:flex; align-items:center; gap:5px;"><i class="fas fa-skull"></i> POINT DE RUPTURE</span>
                            <span>${readyText}</span>
                        </div>
                        <span style="font-size:9px; color:rgba(255,255,255,0.72);">+${critPct}% Crit · +${critDmgPct}% Dégâts Crit</span>
                        <span style="font-size:9px; color:rgba(255,255,255,0.72);">Soif de Sang +${thirstPct}% DMG · cap ${thirstCapPct}%</span>
                        <div style="width:100%; height:4px; background:rgba(0,0,0,0.5); border-radius:2px; overflow:hidden; border: 1px solid rgba(255,255,255,0.05);">
                            <div style="width:${pct}%; height:100%; background:${color}; box-shadow:0 0 6px ${color}; transition: width 0.2s;"></div>
                        </div>
                    </div>
                `;
                resourceEl.style.display = 'block';
                return;
            }
            const mult = this.getPassiveMultiplier();
            const bonusPct = Math.floor((mult - 1.0) * 100); 
            let color = '#1abc9c';
            if (bonusPct > 50) color = '#e74c3c';
            const pct = Math.min(100, (bonusPct / 100) * 100);
            resourceEl.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-family:'Cinzel', serif; font-size:10px; font-weight:700; color:${color};">
                        <span style="display:flex; align-items:center; gap:5px;"><i class="fas fa-droplet"></i> SOIF DE SANG</span>
                        <span>+${bonusPct}% DMG</span>
                    </div>
                    <div style="width:100%; height:4px; background:rgba(0,0,0,0.5); border-radius:2px; overflow:hidden; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="width:${pct}%; height:100%; background:${color}; box-shadow:0 0 6px ${color}; transition: width 0.2s;"></div>
                    </div>
                </div>
            `;
            resourceEl.style.display = 'block';
        }
    }

    performAttack() {
        if(this.isAttacking) return;
        this.faceMouse(); 
        this.attackCooldown = 0.2 * (STATE.stats.attackSpeedMod || 1) / PassiveKeystoneHooks.getBloodFrenzyAttackSpeedMult(this);
        this.isAttacking = true;
        this.animState.override = true;
        
        AudioSys.sfx.blade.slash();

        const duration = 150; 
        const start = Date.now();
        const side = Math.random() > 0.5 ? 1 : -1;

        const slashAnim = () => {
            const elapsed = Date.now() - start;
            if(elapsed >= duration) {
                this.isAttacking = false;
                this.animState.override = false;
                this.animState.armR_Rot = {x:0, y:0, z:0};
                this.animState.weaponRot = {x:Math.PI/2, y:Math.PI, z:0};
                this.animState.torsoRot = 0;
                return;
            }

            const p = elapsed / duration;
            
            if (p < 0.2) {
                this.animState.armR_Rot.x = -0.5; 
                this.animState.armR_Rot.y = 0.5 * side; 
                this.animState.weaponRot.z = -0.5;
            } else {
                const subP = (p - 0.2) / 0.8;
                this.animState.armR_Rot.x = THREE.MathUtils.lerp(-0.5, 0.5, subP);
                this.animState.armR_Rot.y = THREE.MathUtils.lerp(0.5*side, -0.8*side, subP);
                this.animState.weaponRot.z = THREE.MathUtils.lerp(-0.5, 1.5, subP);
            }

            requestAnimationFrame(slashAnim);
        };
        slashAnim();

        setTimeout(() => {
            const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            dir.y = 0; dir.normalize();

            if (shouldSendSkillIntent()) {
                sendSkillIntent({ intent: 'attack-melee', dir, pos: this.position.clone() });
            } else if (STATE.multiplayer.active && this.isLocalPlayer()) {
                Network.send({ type: 'net-action', action: 'attack-melee', id: STATE.multiplayer.id, pos: this.position, dir: dir, color: CONFIG.colors.blade, class: 'blade' });
            }
            
            const offset = new THREE.Vector3((Math.random()-0.5)*1.5, 0.5 + (Math.random()-0.5), (Math.random()-0.5)*1.5);
            createSkillVisual('slash', this.position.clone().add(offset).add(dir), 2.0, 0xccffff, dir);
            if (!canDealDamageDirectly()) return;
            
            const multiplier = this.getPassiveMultiplier();

            Globals.enemies.forEach(e => {
                if(e.position.distanceTo(this.position) < 3.0) { 
                    const toE = e.position.clone().sub(this.position).normalize();
                    if(dir.dot(toE) > 0.4) { 
                        const dmg = this.getBladeDamage('primary', multiplier);
                        dealDamageToEnemy(e, dmg, {
                            pos: e.position,
                            onCrit: () => PassiveKeystoneHooks.extendBloodFrenzyOnCrit(this),
                        });
                        spawnParticles(e.position, 0x00ffff, 3);
                    }
                }
            });
        }, duration * 0.5);
    }

    useSkill(key) {
        if(this.cooldowns[key] > 0 || this.isCasting) return;
        this.faceMouse();
        const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);
        this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);
        ConstellationEngine.onSkillUsed(key);
        ConvergenceEffects.tryConsumeBladeBreakpoint(this, key);
        const multiplier = this.getPassiveMultiplier();

        if(key === 'space') { 
            // --- TOUPIE LÉTALE ---
            AudioSys.sfx.blade.slash();
            this.animState.override = true;
            const spinDur = PassiveKeystoneHooks.getCycloneDurationMs();
            const start = Date.now();
            let lastPull = 0;
            let lastCycloneDmg = 0;

            const spinAnim = () => {
                const elapsed = Date.now() - start;
                if (elapsed - lastPull > 50) {
                    PassiveKeystoneHooks.applyCyclonePull(this, 0.05);
                    lastPull = elapsed;
                }
                if (ConstellationEngine.getPassiveRank('cyclonePull') && elapsed - lastCycloneDmg > 500) {
                    Globals.enemies.forEach((e) => {
                        if (!e.dead && e.position.distanceTo(this.position) < 5) {
                            dealDamageToEnemy(e, STATE.stats.atk * 0.35, { pos: e.position, ...this.getBreakpointDamageOptions('space') });
                            this.resolveBreakpointExecution(e, 'space');
                        }
                    });
                    lastCycloneDmg = elapsed;
                }
                if(elapsed >= spinDur) {
                    this.animState.override = false;
                    this.animState.torsoRot = 0;
                    this.body.rotation.y = 0; 
                    return;
                }
                const p = elapsed / spinDur;
                this.body.rotation.y = -p * Math.PI * 2; 
                this.animState.armR_Rot.x = 0;
                this.animState.armR_Rot.z = 1.5; 
                requestAnimationFrame(spinAnim);
            };
            spinAnim();

            const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.0, 32), new THREE.MeshBasicMaterial({color:0x1abc9c, side:THREE.DoubleSide, transparent:true}));
            ring.rotation.x = -Math.PI/2; ring.position.copy(this.position).add(new THREE.Vector3(0,1,0));
            this.addLocalVisual(ring, 0.3, (m,t) => { m.material.opacity = t/0.3; m.rotation.z += 0.5; });

            Globals.enemies.forEach(e => {
                if(e.position.distanceTo(this.position) < 5) {
                    dealDamageToEnemy(e, this.getBladeDamage('space', multiplier), { pos: e.position, ...this.getBreakpointDamageOptions('space') });
                    this.resolveBreakpointExecution(e, 'space');
                    spawnParticles(e.position, 0x1abc9c, 5);
                }
            });

        } else if (key === 'shift') { 
            // --- DASH ---
            AudioSys.sfx.blade.dash();
            this.isDashing = true;
            this.animState.override = true;
            this.dashTimer = 0.25; 
            this.dashDir = dir.clone().normalize();
            this.dashHitSet.clear(); 
            
            const dashAnim = () => {
                if(!this.isDashing) {
                    this.animState.override = false;
                    this.body.rotation.x = 0;
                    return;
                }
                this.body.rotation.x = 1.2; 
                this.animState.armR_Rot.x = -1.2; 
                this.animState.armL_Rot.x = -1.2;
                requestAnimationFrame(dashAnim);
            };
            dashAnim();
            
            createSkillVisual('explosion', this.position, 2, 0x1abc9c);
            this.addBuff('Esquive', 2, '<i class="fas fa-wind"></i>');

        } else if (key === 'e') { 
            // --- TSUNAMI ---
            this.isCasting = true; 
            this.animState.override = true;
            const totalDur = 1200; 
            const start = Date.now();
            this.tsunamiTriggered = false; 
            
            const tsunamiAnim = () => {
                const elapsed = Date.now() - start;
                if (elapsed >= totalDur) {
                    this.isCasting = false;
                    this.animState.override = false;
                    this.animState.heightOffset = 0;
                    this.animState.scale = 1;
                    this.body.rotation.x = 0;
                    if (Globals.camera) Globals.camera.position.y = Globals.player.position.y + 14; 
                    return;
                }

                const p = elapsed / totalDur;
                if (p < 0.3) {
                    const subP = p / 0.3;
                    this.body.rotation.x = subP * Math.PI; 
                    this.animState.heightOffset = -subP * 2.0; 
                    this.animState.scale = 1.0 - subP;
                    if(Math.random() < 0.3) spawnParticles(this.position, 0x1abc9c, 2);
                } else if (p < 0.6) {
                    const subP = (p - 0.3) / 0.3;
                    this.animState.scale = 1.0; 
                    this.body.rotation.x = 0; 
                    this.animState.heightOffset = subP * 10.0; 
                    if(Globals.camera) {
                        Globals.camera.position.y = this.position.y + 10 - (subP * 5); 
                        Globals.camera.lookAt(this.position.clone().add(new THREE.Vector3(0, this.animState.heightOffset, 0)));
                    }
                    this.animState.armR_Rot.x = -Math.PI;
                } else if (p < 0.7) {
                    const subP = (p - 0.6) / 0.1;
                    this.animState.heightOffset = 10.0 * (1 - subP);
                    this.animState.armR_Rot.x = THREE.MathUtils.lerp(-Math.PI, 0.5, subP);
                } else {
                    this.animState.heightOffset = 0;
                    if (!this.tsunamiTriggered) {
                        this.tsunamiTriggered = true;
                        this.triggerTsunamiImpact(dir, multiplier);
                    }
                }
                requestAnimationFrame(tsunamiAnim);
            };
            AudioSys.sfx.blade.wave();
            tsunamiAnim();
        }
    }

    spawnGhost() {
        const ghostGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);
        const ghostMesh = new THREE.Mesh(ghostGeo, new THREE.MeshBasicMaterial({color:0x1abc9c, transparent:true, opacity:0.4}));
        ghostMesh.position.copy(this.position);
        ghostMesh.position.y += 0.75;
        ghostMesh.rotation.y = this.mesh.rotation.y;
        this.addLocalVisual(ghostMesh, 0.3, (m, t) => m.material.opacity = t);
    }

    triggerTsunamiImpact(dir, multiplier) {
        AudioSys.sfx.warrior.smash(); 
        const originalY = Globals.camera.position.y;
        Globals.camera.position.y -= 1.5;
        setTimeout(() => Globals.camera.position.y = originalY, 150);

        const wave = new THREE.Mesh(new THREE.CylinderGeometry(2, 15, 5, 32, 1, true), new THREE.MeshBasicMaterial({color:0x1abc9c, transparent:true, opacity:0.8, side:THREE.DoubleSide}));
        wave.position.copy(this.position);
        this.addLocalVisual(wave, 1.0, (m, t, maxT) => {
            const p = 1 - t/maxT;
            m.scale.set(p*1.5 + 1, 1, p*1.5 + 1);
            m.material.opacity = t/maxT;
        });

        for(let i=0; i<30; i++) spawnParticles(this.position.clone().add(new THREE.Vector3((Math.random()-0.5)*12, 0, (Math.random()-0.5)*12)), 0x00ffff, 1);

        createDamageText("TSUNAMI!", this.position, '#00ffff');
        this.bloodShield = Math.min(this.bloodShieldMax, this.bloodShield + 50);
        UI.updateHUD();

        Globals.enemies.forEach(e => { 
            if(e.position.distanceTo(this.position) <= 15) {
                dealDamageToEnemy(e, this.getBladeDamage('e', multiplier), { pos: e.position, ...this.getBreakpointDamageOptions('e') }); 
                this.resolveBreakpointExecution(e, 'e');
                e.pushBack(this.position, 18); 
                e.speed *= 0.5;
                setTimeout(() => { if(!e.dead) e.speed *= 2.0; }, 2500);
            } 
        }); 
    }
}
