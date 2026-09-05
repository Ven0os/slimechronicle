// @ts-nocheck
import { PlayerBase } from '../player_base';
import { CONFIG, STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createSkillVisual, createDamageText, spawnParticles } from '../../visual/effects';
import { setHtmlIfChanged, setDisplayIfChanged, getCachedElement } from '../../visual/domUtils';
import { Network } from '../../multiplayer/network';
import { Globals, GameActions } from '../../core/globals';
import { ConstellationEngine } from '../../systems/constellationEngine';
import { ConvergenceEffects } from '../../systems/convergenceEffects';
import { PassiveKeystoneHooks } from '../../systems/passiveKeystoneHooks';
import { UI } from '../../visual/ui';
import { dealDamageToEnemy } from '../combat/damage_helpers';
import { canDealDamageDirectly, sendSkillIntent, shouldSendSkillIntent } from '../../multiplayer/net_authority';
import { getGroundLevelAt } from '../world/worldZones';

export class Pacifier extends PlayerBase {
    // ... (Début inchangé) ...
    constructor() {
        super('pacifier');
        this.bloodShield = 0;
        this.bloodShieldMax = 0;
        this.drainActiveTime = 0;
        this.bloodPistolActive = false;
        this.sanguinStacks = 0; 
        this.isCasting = false; 
        this.originalSpeed = this.speed;
        this.animState = {
            torsoRot: 0, torsoBend: 0, headRot: { x: 0, y: 0 },
            armR_Rot: { x: 0, y: 0, z: 0 }, armL_Rot: { x: 0, y: 0, z: 0 },
            gunRecoil: 0, override: false,
        };
        this.createClassModel();
        this.applyClassStats();
    }

    createClassModel() {
        // ... (Code modèle repris tel quel) ...
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, name: 'bodyPart' }); 
        const clothMat = new THREE.MeshStandardMaterial({ color: 0x550000, roughness: 0.8, name: 'bodyPart' }); 
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xececec, roughness: 0.4, name: 'bodyPart' }); 
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, name: 'bodyPart' }); 
        const bloodMat = new THREE.MeshBasicMaterial({ color: 0xff0000, name: 'bodyPart' }); 
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.8, name: 'bodyPart' }); 

        this.mesh = new THREE.Group(); this.bodyGroup.add(this.mesh);
        const scaleMod = 0.9; this.mesh.scale.set(scaleMod, scaleMod, scaleMod);

        const legHeight = 0.75;
        this.legL = new THREE.Group(); this.legL.position.set(-0.15, legHeight, 0);
        const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.45), darkMat); thighL.position.y = -0.22; this.legL.add(thighL);
        const bootL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.35), darkMat); bootL.position.y = -0.6; this.legL.add(bootL);
        this.mesh.add(this.legL);

        this.legR = new THREE.Group(); this.legR.position.set(0.15, legHeight, 0);
        const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.45), darkMat); thighR.position.y = -0.22; this.legR.add(thighR);
        const bootR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.35), darkMat); bootR.position.y = -0.6; this.legR.add(bootR);
        this.mesh.add(this.legR);

        this.body = new THREE.Group(); this.body.position.y = legHeight; this.mesh.add(this.body);
        const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.25), darkMat); hips.position.y = 0.1; this.body.add(hips);
        
        this.torsoMesh = new THREE.Group(); this.torsoMesh.position.y = 0.45; this.body.add(this.torsoMesh);
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.25), clothMat); this.torsoMesh.add(chest);
        const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.05), new THREE.MeshStandardMaterial({color:0xffffff, name:'bodyPart'})); shirt.position.set(0, 0.2, 0.13); this.torsoMesh.add(shirt);
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.06), darkMat); tie.position.set(0, 0.1, 0.14); this.torsoMesh.add(tie);
        
        this.coatTail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.05), darkMat); 
        this.coatTail.position.set(0, 0.25, -0.15); this.coatTail.rotation.x = 0.15; this.body.add(this.coatTail); 
        const highCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8, 1, true, Math.PI, Math.PI), darkMat); 
        highCollar.position.set(0, 0.35, 0); highCollar.scale.set(1, 1, 0.8); this.torsoMesh.add(highCollar);

        this.headGroup = new THREE.Group(); this.headGroup.position.y = 0.85; this.body.add(this.headGroup);
        const headBase = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.28), skinMat); this.headGroup.add(headBase);
        const hair = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.1, 0.32), hairMat); hair.position.y = 0.16; this.headGroup.add(hair);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.3, 0.1), hairMat); hairBack.position.set(0, 0, -0.15); this.headGroup.add(hairBack);
        const eyeL = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), bloodMat); eyeL.position.set(-0.08, 0.05, 0.141); this.headGroup.add(eyeL);
        const eyeR = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), bloodMat); eyeR.position.set(0.08, 0.05, 0.141); this.headGroup.add(eyeR);

        this.shoulders = new THREE.Group(); this.shoulders.position.y = 0.7; this.body.add(this.shoulders);
        this.armR = new THREE.Group(); this.armR.position.set(-0.35, 0, 0); this.shoulders.add(this.armR);
        const meshR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55), darkMat); meshR.position.y = -0.25; this.armR.add(meshR);
        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), skinMat); handR.position.y = -0.55; this.armR.add(handR);

        this.armL = new THREE.Group(); this.armL.position.set(0.35, 0, 0); this.shoulders.add(this.armL);
        const meshL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55), darkMat); meshL.position.y = -0.25; this.armL.add(meshL);
        const handL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), skinMat); handL.position.y = -0.55; this.armL.add(handL);
        const claws = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.02), bloodMat); claws.position.set(0, -0.65, 0); this.armL.add(claws);

        this.weaponGroup = new THREE.Group(); this.weaponGroup.position.set(0, -0.55, 0.1); this.armR.add(this.weaponGroup);
        const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.3), metalMat); this.weaponGroup.add(gunBody);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.6), metalMat); barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.05, 0.4); this.weaponGroup.add(barrel);
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 6), new THREE.MeshStandardMaterial({color: 0x550000})); cylinder.rotation.z = Math.PI/2; this.weaponGroup.add(cylinder);
        this.ammoVial = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), bloodMat); this.ammoVial.rotation.x = Math.PI/2; this.ammoVial.position.set(0, -0.05, 0.25); this.weaponGroup.add(this.ammoVial);

        const wingShape = new THREE.Shape();
        wingShape.moveTo(0,0); wingShape.lineTo(1.5, 0.8); wingShape.lineTo(2.5, 0.2); wingShape.lineTo(1.5, -1.5); wingShape.lineTo(0.5, -0.5); wingShape.lineTo(0, -1.0);
        const wingGeo = new THREE.ShapeGeometry(wingShape);
        const wingMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        
        this.bloodWings = new THREE.Group(); this.bloodWings.visible = false; this.body.add(this.bloodWings); 
        const wL = new THREE.Mesh(wingGeo, wingMat); wL.rotation.y = -0.2; this.bloodWings.add(wL);
        const wR = new THREE.Mesh(wingGeo, wingMat); wR.rotation.y = Math.PI + 0.2; this.bloodWings.add(wR);

        this.mesh.traverse(c => {
            if(c.isMesh && c.material) {
                c.userData.baseColor = c.material.color.getHex();
                if(c.material.emissive) c.userData.baseEmissive = c.material.emissive.getHex();
            }
        });
    }

    applyClassStats() {
        super.applyClassStats();
        this.bloodShieldMax = this.maxHp * 0.25 * PassiveKeystoneHooks.getBloodShieldMaxMult();
        this.maxCooldowns.space = 2;
    }

    animateCharacter(dt) {
        super.animateCharacter(dt); 
        const lerpSpeed = dt * 15;
        if (!this.animState.override) {
            if (this.isMoving) {
                this.animState.torsoRot = Math.sin(this.animTime) * 0.1;
                this.animState.torsoBend = 0.05; 
                this.animState.armR_Rot.x = Math.sin(this.animTime) * 0.5;
                this.animState.armL_Rot.x = Math.sin(this.animTime + Math.PI) * 0.5;
                
                if(this.bloodPistolActive) {
                    this.animState.armR_Rot.x = -0.5 + Math.sin(this.animTime) * 0.2;
                    this.animState.armR_Rot.y = -0.2; 
                }
            } else {
                this.animState.torsoRot = 0; this.animState.torsoBend = 0;
                const breath = Math.sin(Date.now() * 0.003) * 0.03;
                this.animState.armR_Rot.x = breath; this.animState.armL_Rot.x = breath;
                this.animState.armR_Rot.z = 0.1; this.animState.armL_Rot.z = -0.1;
            }
        }
        this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, this.animState.torsoRot, lerpSpeed);
        this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, this.animState.torsoBend, lerpSpeed);
        this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, this.animState.armR_Rot.x, lerpSpeed);
        this.armR.rotation.y = THREE.MathUtils.lerp(this.armR.rotation.y, this.animState.armR_Rot.y, lerpSpeed);
        this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, this.animState.armR_Rot.z, lerpSpeed);
        this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, this.animState.armL_Rot.x, lerpSpeed);
        this.armL.rotation.y = THREE.MathUtils.lerp(this.armL.rotation.y, this.animState.armL_Rot.y, lerpSpeed);
        this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, this.animState.armL_Rot.z, lerpSpeed);
        if(this.weaponGroup) {
            this.weaponGroup.rotation.x = THREE.MathUtils.lerp(this.weaponGroup.rotation.x, this.animState.gunRecoil, lerpSpeed * 2);
        }
    }

    update(dt) {
        if (this.isCasting) { this.speed = 0; this.isMoving = false; } else { this.speed = STATE.stats.speed; }
        super.update(dt);
    }

    updateClassPassives(dt) {
        // PlayerBase.update() appelle déjà updateBuffs(dt) juste avant updateClassPassives :
        // le rappeler ici faisait s'écouler buffs et debuffs deux fois plus vite que pour
        // les autres classes.
        if(this.drainActiveTime > 0) this.drainActiveTime -= dt;
        const resourceEl = getCachedElement('class-resource');
        if (resourceEl) {
            const hemocycleActive = ConstellationEngine.isApexPassiveActive('bloodPact', 'pacifier');
            const hemo = hemocycleActive ? ConvergenceEffects.getHemocycleSummary(this) : null;
            const stacks = hemocycleActive ? hemo.marks : (this.sanguinStacks || 0);
            const maxStacks = hemocycleActive ? hemo.max : 5;
            const pct = (stacks / maxStacks) * 100;
            const isFrenzy = !!this.bloodPistolActive;
            const titleColor = hemocycleActive ? '#ff4d6d' : (isFrenzy ? '#ff0000' : '#e74c3c');
            const titleText = hemocycleActive ? (hemo.ready ? 'HÉMOCYCLE PRÊT' : 'HÉMOCYCLE') : (isFrenzy ? 'FRÉNÉSIE ACTIVE' : 'SOIF DE SANG');
            const icon = hemocycleActive ? 'fa-droplet' : (isFrenzy ? 'fa-gun' : 'fa-droplet');
            const storedText = hemocycleActive && hemo.stored > 0
                ? `<span style="font-size:9px; color:rgba(255,255,255,0.72);">${Math.floor(hemo.stored)} dégâts stockés</span>`
                : '';
            
            setHtmlIfChanged(resourceEl, `
                <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-family:'Cinzel', serif; font-size:10px; font-weight:700; color:${titleColor};">
                        <span style="display:flex; align-items:center; gap:5px;"><i class="fas ${icon}"></i> ${titleText}</span>
                        <span>${stacks}/${maxStacks}</span>
                    </div>
                    ${storedText}
                    <div style="width:100%; height:4px; background:rgba(0,0,0,0.5); border-radius:2px; overflow:hidden; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="width:${pct}%; height:100%; background:${titleColor}; box-shadow:0 0 6px ${titleColor}; transition: width 0.2s;"></div>
                    </div>
                </div>
            `);
            setDisplayIfChanged(resourceEl, 'block');
        }
    }

    takeDamage(amount) {
        if (this.bloodShield > 0) {
            if (this.bloodShield >= amount) { this.bloodShield -= amount; amount = 0; createDamageText("ABSORBÉ", this.position, '#aa0000'); } 
            else { amount -= this.bloodShield; this.bloodShield = 0; }
        }
        super.takeDamage(amount);
    }

    heal(amount) {
        const missingHp = this.maxHp - this.hp;
        if (amount > missingHp) {
            const excess = amount - missingHp;
            this.hp = this.maxHp;
            const overflowRate = PassiveKeystoneHooks.getShieldOverflowRate();
            const bonus = overflowRate > 0 ? excess * overflowRate : excess;
            this.bloodShield = Math.min(this.bloodShieldMax, this.bloodShield + bonus);
        }
        else { this.hp += amount; }
        createDamageText("+" + Math.floor(amount), this.position, '#00ff00');
        UI.updateHUD();
    }

    spawnHitAura(pos) {
        for(let i=0; i<5; i++) { spawnParticles(pos, 0xff0000, 3); }
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 16), new THREE.MeshBasicMaterial({color:0xff0000, side:THREE.DoubleSide, transparent:true, opacity:0.8}));
        ring.rotation.x = -Math.PI/2; ring.position.copy(pos).add(new THREE.Vector3(0,0.1,0));
        this.addLocalVisual(ring, 0.3, (m,t,maxT,dt) => { m.scale.multiplyScalar(Math.pow(0.9, dt*60)); m.material.opacity = t/0.3; });
    }

    releaseHemocycleStoredDamage(enemy, chunks, maxRange = 22) {
        chunks.forEach((chunk, index) => {
            if (!enemy || enemy.dead || chunk <= 0) return;
            const pos = enemy.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.25 + index * 0.04, (Math.random() - 0.5) * 0.25));
            dealDamageToEnemy(enemy, chunk, {
                pos,
                ignoreDefense: true,
                suppressCritText: true,
                skillKey: 'primary',
                maxRange,
                isRanged: true,
            });
        });
    }

    performAttack() {
        if(this.isAttacking || this.isCasting) return;
        this.faceMouse(); 
        
        this.attackCooldown = this.attackMaxCooldown * (STATE.stats.attackSpeedMod || 1);
        if(this.bloodPistolActive) {
            const trans = PassiveKeystoneHooks.getBloodPistolTransfusionMods();
            this.attackCooldown *= 0.6 / trans.atkSpeedMult;
        }
        
        this.isAttacking = true;
        this.animState.override = true;

        // FIX: Use Mesh Direction
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0; dir.normalize();

        if (this.bloodPistolActive) {
            AudioSys.sfx.pacifier.shot();
            const duration = 200;
            const start = Date.now();
            const shootAnim = () => {
                const elapsed = Date.now() - start;
                if(elapsed >= duration) {
                    this.isAttacking = false; this.animState.override = false; this.animState.armR_Rot = {x:0, y:0, z:0}; this.animState.torsoRot = 0; this.animState.gunRecoil = 0; return;
                }
                const p = elapsed / duration;
                if (p < 0.2) { this.animState.armR_Rot.x = -1.5 - (p * 0.3); this.animState.gunRecoil = 0.5; } 
                else { this.animState.armR_Rot.x = THREE.MathUtils.lerp(-1.6, -1.5, p); this.animState.gunRecoil = THREE.MathUtils.lerp(0.5, 0, p); }
                requestAnimationFrame(shootAnim);
            };
            shootAnim();
            // FIX: Passer la direction
            this.firePistol(dir);

        } else {
            // ... (Melee attack - uses 'dir' correctly below) ...
            AudioSys.sfx.warrior.swing(); 
            const duration = 300;
            const start = Date.now();
            const clawAnim = () => {
                const elapsed = Date.now() - start;
                if(elapsed >= duration) { this.isAttacking = false; this.animState.override = false; this.animState.armL_Rot = {x:0, y:0, z:0}; this.animState.torsoRot = 0; this.animState.torsoBend = 0; return; }
                const p = elapsed / duration;
                if (p < 0.3) { this.animState.torsoRot = 0.3; this.animState.armL_Rot.y = 0.8; this.animState.armL_Rot.x = -0.5; } 
                else if (p < 0.7) { this.animState.torsoRot = -0.3; this.animState.armL_Rot.y = -1.0; this.animState.armL_Rot.x = -0.5; } 
                else { this.animState.torsoRot = 0; this.animState.armL_Rot.y = 0; }
                requestAnimationFrame(clawAnim);
            };
            clawAnim();

            setTimeout(() => {
                // Le coup était encore porté si le joueur mourait entre le geste et l'impact.
                if (this.dead) return;

                const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
                dir.y = 0; dir.normalize();
                if (shouldSendSkillIntent()) {
                    sendSkillIntent({ intent: 'attack-melee', dir, pos: this.position.clone() });
                }
                createSkillVisual('melee_slash', this.position, 2.5, CONFIG.colors.pacifier, dir);
                if (!canDealDamageDirectly()) return;

                Globals.enemies.forEach(e => {
                    const dx = e.position.x - this.position.x;
                    const dz = e.position.z - this.position.z;
                    const dist = Math.sqrt(dx*dx + dz*dz);
                    if(dist < 3.5) { 
                        let nx = dx / dist; let nz = dz / dist; if(dist === 0) { nx = 0; nz = 0; }
                        const dot = nx * dir.x + nz * dir.z;
                        if(dot > 0.5) { 
                             let dmg = STATE.stats.atk * 1.5;
                             if (e.sanguineInstability && !e.isMiniBoss) { dmg *= 1.2; this.heal(dmg * 0.1); createDamageText("LEECH!", this.position, '#e74c3c'); }
                             const { isCrit } = dealDamageToEnemy(e, dmg, { pos: e.position });
                             if (isCrit) AudioSys.sfx.crit();
                             this.spawnHitAura(e.position); 
                        }
                    }
                });
            }, duration * 0.4);
        }
    }

    firePistol(dir) {
        if (shouldSendSkillIntent()) {
            sendSkillIntent({ intent: 'attack-range', dir, pos: this.position.clone() });
        } else if (STATE.multiplayer.active && this.isLocalPlayer()) {
            Network.send({ type: 'net-action', action: 'attack-range', id: STATE.multiplayer.id, pos: this.position, dir: dir, color: CONFIG.colors.pacifier, class: 'pacifier' });
        }

        const trans = this.bloodPistolActive ? PassiveKeystoneHooks.getBloodPistolTransfusionMods() : null;
        const cost = this.maxHp * 0.02 * (trans?.selfDmgMult ?? 1);
        this.hp = Math.max(1, this.hp - cost);
        UI.updateHUD();
        
        const maxDist = 20.0;
        const extra = this.bloodPistolActive ? PassiveKeystoneHooks.getFrenzyExtraBullets() : 0;
        const totalShots = 1 + extra;

        for (let s = 0; s < totalShots; s++) {
            const spread = totalShots > 1 ? (s - (totalShots - 1) / 2) * 0.06 : 0;
            const shootVec = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);

            const beamEnd = this.position.clone().add(shootVec.clone().multiplyScalar(maxDist));
            const beamGeo = new THREE.CylinderGeometry(0.03, 0.03, maxDist, 4);
            beamGeo.rotateX(-Math.PI/2);
            const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({color: 0xff0000, transparent:true, opacity:0.8}));
            beam.position.copy(this.position).add(shootVec.clone().multiplyScalar(maxDist/2)).add(new THREE.Vector3(0,0.6,0));
            beam.lookAt(beamEnd.clone().add(new THREE.Vector3(0,0.6,0)));
            this.addLocalVisual(beam, (trans?.projectileSpeedMult ?? 1) > 1 ? 0.08 : 0.1, (m, t) => m.material.opacity = t*10);
        }

        if (!canDealDamageDirectly()) return;

        const hemocycleActive = this.bloodPistolActive && ConvergenceEffects.isPacifierHemocycleActive(this);

        for (let s = 0; s < totalShots; s++) {
            const spread = totalShots > 1 ? (s - (totalShots - 1) / 2) * 0.06 : 0;
            const shootVec = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);

            let closestHit = null;
            let closestDist = maxDist;

            Globals.enemies.forEach(e => {
                const ex = e.position.x - this.position.x;
                const ez = e.position.z - this.position.z;
                const dist = Math.sqrt(ex*ex + ez*ez);

                if (dist < maxDist) {
                    const projectedDist = ex * shootVec.x + ez * shootVec.z;
                    if (projectedDist > 0) {
                        const perpDistSq = Math.max(0, (dist * dist) - (projectedDist * projectedDist));
                        const perpDist = Math.sqrt(perpDistSq);

                        if (perpDist < 1.5 && dist < closestDist) {
                            closestDist = dist;
                            closestHit = e;
                        }
                    }
                }
            });

            if (closestHit) {
                const releaseChunks = hemocycleActive && ConvergenceEffects.isHemocycleReady(closestHit, this)
                    ? ConvergenceEffects.consumeHemocycle(closestHit, this)
                    : [];
                if (releaseChunks.length) {
                    this.releaseHemocycleStoredDamage(closestHit, releaseChunks, maxDist + 2);
                }
                if (closestHit.dead) continue;

                const basePistolDamage = STATE.stats.atk
                    * 1.8
                    * (trans?.dmgMult ?? 1)
                    * ConvergenceEffects.getHemocycleBloodPistolDamageMult(this);
                let pDmg = ConstellationEngine.modifyDamageDealt(basePistolDamage, { skill: false });
                if (PassiveKeystoneHooks.isEnemyMarked(closestHit)) createDamageText('EXECUTE!', closestHit.position, '#e74c3c');
                const { dmg } = dealDamageToEnemy(closestHit, pDmg, {
                    pos: closestHit.position,
                    skillKey: 'primary',
                    maxRange: maxDist + 2,
                    isRanged: true,
                });
                if (hemocycleActive && !releaseChunks.length && dmg > 0) {
                    ConvergenceEffects.applyHemocycleMark(closestHit, dmg, this);
                }
                this.spawnHitAura(closestHit.position);
            }
        }
    }

    useSkill(key) {
        if(this.cooldowns[key] > 0 || this.isCasting) return;
        this.faceMouse();
        
        // FIX: Direction universelle
        const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0; dir.normalize();

        this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);

        if(key === 'space') { 
            // --- SAUT VAMPIRIQUE ---
            AudioSys.sfx.blade.dash(); 
            this.isCasting = true; 
            this.animState.override = true;
            this.speed = 0; 

            // FIX: Calcul Cible
            let targetPos;
            if (this.isLocalPlayer() && Globals.camera) {
                STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const intersection = new THREE.Vector3();
                STATE.raycaster.ray.intersectPlane(plane, intersection);
                const dist = Math.min(this.position.distanceTo(intersection), 20.0);
                const jumpDir = intersection.clone().sub(this.position);
                jumpDir.y = 0;
                jumpDir.normalize();
                targetPos = this.position.clone().add(jumpDir.multiplyScalar(dist));
            } else {
                // Remote: Saut fixe vers l'avant
                targetPos = this.position.clone().add(dir.clone().multiplyScalar(15.0));
                targetPos.y = this.position.y;
            }
            // Mettre à jour Y de la cible selon la zone
            const dx = targetPos.x - 90;
            const dz = targetPos.z - 90;
            const targetDist = Math.hypot(dx, dz);
            targetPos.y = (targetDist < 12 && !STATE.leftSafeZone) ? 4.0 : getGroundLevelAt(targetPos);
            
            const startPos = this.position.clone();
            createSkillVisual('explosion', this.position, 1, 0x000000); 
            if(this.bloodWings) this.bloodWings.visible = true;

            const jumpDur = 900; 
            const start = Date.now();
            const originalCamY = Globals.camera.position.y;

            const diveAnim = () => {
                const elapsed = Date.now() - start;
                if(elapsed >= jumpDur) {
                    this.position.copy(targetPos);
                    this.triggerImpact();
                    this.isCasting = false; this.animState.override = false; this.animState.armR_Rot = {x:0, y:0, z:0}; this.animState.armL_Rot = {x:0, y:0, z:0}; this.body.rotation.x = 0;
                    if(this.bloodWings) this.bloodWings.visible = false;
                    Globals.camera.position.y = originalCamY;
                    this.mesh.position.y = 0;
                    return;
                }
                this.speed = 0;
                const p = elapsed / jumpDur;
                this.position.lerpVectors(startPos, targetPos, p);
                this.mesh.position.y = Math.sin(p * Math.PI) * 8.0; 
                if (p < 0.5) {
                    this.animState.armR_Rot.z = 1.0; this.animState.armL_Rot.z = -1.0; this.body.rotation.x = -0.5; 
                } else {
                    this.animState.armR_Rot.z = 0.2; this.animState.armL_Rot.z = -0.2; this.body.rotation.x = 1.0; 
                }
                if (this.isLocalPlayer()) {
                    // Descente caméra pilotée par la progression p (temps réel) : indépendante du FPS.
                    if (p < 0.5) Globals.camera.position.y = originalCamY + (this.mesh.position.y * 0.5);
                    else Globals.camera.position.y = originalCamY + (this.mesh.position.y * 0.5) * (1 - (p - 0.5) * 2);
                }
                requestAnimationFrame(diveAnim);
            };
            diveAnim();

        } else if (key === 'shift') { 
            // ... (Verdict inchangé) ...
            AudioSys.sfx.pacifier.mark();
            this.animState.override = true;
            const snapDur = 400; const start = Date.now();
            const snapAnim = () => {
                const elapsed = Date.now() - start;
                if(elapsed >= snapDur) { this.animState.override = false; this.animState.armL_Rot = {x:0,y:0,z:0}; return; }
                const p = elapsed / snapDur;
                if (p < 0.6) { this.animState.armL_Rot.x = -2.0; this.animState.armL_Rot.z = 0.5; } else { this.animState.armL_Rot.x = -1.8; }
                requestAnimationFrame(snapAnim);
            };
            snapAnim();
            setTimeout(() => {
                // Le Verdict frappait encore la zone si le joueur mourait pendant l'élan.
                if (this.dead) return;

                createSkillVisual('shockwave', this.position, 10, 0xff0000); createDamageText("VERDICT", this.position, '#f00');
                Globals.enemies.forEach(e => {
                    if(e.position.distanceTo(this.position) <= 10) {
                        dealDamageToEnemy(e, ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 0.5, { skill: true, skillKey: 'shift' }), { pos: e.position });
                        PassiveKeystoneHooks.markEnemyVerdict(e);
                        const mark = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 16), new THREE.MeshBasicMaterial({color:0xff0000}));
                        mark.position.copy(e.position).add(new THREE.Vector3(0, 2.5, 0));
                        this.addLocalVisual(mark, 5.0, (m,t,maxT,dt) => { m.rotation.y += 6 * dt; m.scale.setScalar(1 + Math.sin(Date.now()*0.01)*0.2); });
                    }
                });
            }, snapDur * 0.6);

        } else if (key === 'e') { 
            // ... (Reload inchangé) ...
            AudioSys.sfx.pacifier.reload();
            this.animState.override = true;
            const reloadDur = 600; const start = Date.now();
            const reloadAnim = () => {
                const elapsed = Date.now() - start;
                if(elapsed >= reloadDur) { this.animState.override = false; this.animState.armR_Rot = {x:0,y:0,z:0}; this.animState.headRot = {x:0,y:0}; return; }
                const p = elapsed / reloadDur;
                this.animState.headRot.x = 0.2; this.animState.armR_Rot.x = -1.0; this.animState.armR_Rot.z = 0.5; 
                if(this.weaponGroup) this.weaponGroup.rotation.z = p * Math.PI * 4; 
                requestAnimationFrame(reloadAnim);
            };
            reloadAnim();
            this.addBuff('BloodPistol', 6, '<i class="fas fa-gun"></i>');
            const aura = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshBasicMaterial({color:0xff0000, transparent:true, opacity:0.4}));
            this.addLocalVisual(aura, 6.0, (m) => { m.position.copy(this.position).add(new THREE.Vector3(0,1,0)); m.scale.setScalar(1 + Math.sin(Date.now()*0.01)*0.2); });
            createDamageText("FRENESIE", this.position, '#f00');
            PassiveKeystoneHooks.onFrenzyStart(this);
            this.bloodPistolActive = true; 
            setTimeout(() => this.bloodPistolActive = false, 6000);
        }
    }

    triggerImpact() {
        this.position.y = 0;
        // La game loop réécrit camera.position à chaque frame : agir dessus directement
        // n'avait aucun effet visible. On passe par le shake amorti partagé.
        if (Globals.cameraShake) Globals.cameraShake.y -= 1.0;
        const mods = ConstellationEngine.getVampJumpModifiers();
        createSkillVisual('explosion', this.position, mods.radius, 0xff0000);
        spawnParticles(this.position, 0x8a0b0b, 30);
        createDamageText("FEAST!", this.position, '#ff0000');
        let enemiesHit = 0;
        const impactDmg = ConstellationEngine.modifyDamageDealt(
            STATE.stats.atk * 1.5 * mods.dmgMult,
            { skill: true, skillKey: 'space' },
        );
        Globals.enemies.forEach(e => {
            if (e.position.distanceTo(this.position) <= mods.radius) {
                e.speed = 0;
                setTimeout(() => { if (!e.dead) e.speed = 2.0; }, mods.stunMs);
                createDamageText("STUN", e.position, '#ffffff');
                dealDamageToEnemy(e, impactDmg, { pos: e.position });
                enemiesHit++;
            }
        });
        if (enemiesHit > 0) {
            this.heal(enemiesHit * (STATE.stats.atk * mods.healRatio));
        }
    }
}
