// @ts-nocheck

import { PlayerBase } from '../player_base';

import { CONFIG, STATE } from '../../core/config';

import { AudioSys } from '../../core/ressources';

import { createSkillVisual, createDamageText, spawnParticles } from '../../visual/effects';

import { Network } from '../../multiplayer/network';

import { Globals } from '../../core/globals';

import { ConstellationEngine } from '../../systems/constellationEngine';
import { ConvergenceEffects } from '../../systems/convergenceEffects';

import { dealDamageToEnemy } from '../combat/damage_helpers';

import { isInSafeZone } from '../world/worldZones';

import { UI } from '../../visual/ui';



export class Warrior extends PlayerBase {

    constructor() {

        super('warrior');

        this.parryExplosionCharge = 0;

        this.parryBlockedTotal = 0;

        this._hadParryBuff = false;

        this.createClassModel();

        this.applyClassStats();

        

        this.isCasting = false; 

        this.animState = {

            torsoTwist: 0, armRightRot: 0, armLeftRot: 0, weaponRot: 0, override: false 

        };

    }



    createClassModel() {

        const colorPrimary = 0x6a0dad; const colorDark = 0x1a0b2e; const colorGold = 0xffd700; const colorEnergy = 0x9b59b6; 

        const armorMat = new THREE.MeshStandardMaterial({ color: colorPrimary, roughness: 0.4, metalness: 0.6, name: 'bodyPart' });

        const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7, metalness: 0.8, name: 'bodyPart' });

        const goldMat = new THREE.MeshStandardMaterial({ color: colorGold, roughness: 0.3, metalness: 1.0, emissive: 0x332200, name: 'bodyPart' });

        const runeMat = new THREE.MeshBasicMaterial({ color: colorEnergy, name: 'bodyPart' });

        const capeMat = new THREE.MeshStandardMaterial({ color: colorDark, side: THREE.DoubleSide, roughness: 0.9, name: 'bodyPart' });



        this.mesh = new THREE.Group(); this.bodyGroup.add(this.mesh);

        const legHeight = 0.8;

        this.legL = this.createLeg(armorMat, darkMetalMat, goldMat, -0.2, legHeight);

        this.legR = this.createLeg(armorMat, darkMetalMat, goldMat, 0.2, legHeight);

        this.mesh.add(this.legL); this.mesh.add(this.legR);



        this.body = new THREE.Group(); this.body.position.y = legHeight; this.mesh.add(this.body);

        const abs = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.4, 8), darkMetalMat); abs.position.y = 0.2; this.body.add(abs);

        this.torsoMesh = new THREE.Group(); this.torsoMesh.position.y = 0.65; this.body.add(this.torsoMesh);

        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.45), armorMat); this.torsoMesh.add(chest);

        const chestDetail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.5), goldMat); chestDetail.position.y = 0.1; this.torsoMesh.add(chestDetail);

        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), runeMat); core.position.set(0, 0, 0.25); this.torsoMesh.add(core);

        const capeGeo = new THREE.BoxGeometry(0.7, 1.2, 0.05); this.cape = new THREE.Mesh(capeGeo, capeMat); this.cape.position.set(0, 0.6, -0.28); this.cape.rotation.x = 0.15; this.body.add(this.cape);



        this.headGroup = new THREE.Group(); this.headGroup.position.y = 1.0; this.body.add(this.headGroup);

        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.4), armorMat); this.headGroup.add(helmet);

        const visorV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.42), goldMat); this.headGroup.add(visorV);

        const visorH = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.42), goldMat); visorH.position.y = 0.05; this.headGroup.add(visorH);

        const hornGeo = new THREE.ConeGeometry(0.08, 0.4, 8);

        const hornL = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({color:0xeeeeee})); hornL.position.set(0.2, 0.2, 0); hornL.rotation.z = -0.5; this.headGroup.add(hornL);

        const hornR = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({color:0xeeeeee})); hornR.position.set(-0.2, 0.2, 0); hornR.rotation.z = 0.5; this.headGroup.add(hornR);



        this.shoulders = new THREE.Group(); this.shoulders.position.y = 0.85; this.body.add(this.shoulders);

        const pauldronGeo = new THREE.DodecahedronGeometry(0.25);

        const sL = new THREE.Mesh(pauldronGeo, armorMat); sL.position.set(0.45, 0.1, 0); 

        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3), goldMat); spike.position.y = 0.25; sL.add(spike); this.shoulders.add(sL);

        const sR = new THREE.Mesh(pauldronGeo, armorMat); sR.position.set(-0.45, 0.1, 0); const spike2 = spike.clone(); sR.add(spike2); this.shoulders.add(sR);



        const armGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);

        this.armL = new THREE.Mesh(armGeo, darkMetalMat); this.armL.position.set(0.45, 0.6, 0); this.armL.geometry.translate(0, -0.2, 0); this.body.add(this.armL);

        this.armR = new THREE.Mesh(armGeo, darkMetalMat); this.armR.position.set(-0.45, 0.6, 0); this.armR.geometry.translate(0, -0.2, 0); this.body.add(this.armR);

        const gauntletGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);

        const gL = new THREE.Mesh(gauntletGeo, armorMat); gL.position.y = -0.35; this.armL.add(gL);

        const gR = new THREE.Mesh(gauntletGeo, armorMat); gR.position.y = -0.35; this.armR.add(gR);



        this.weaponGroup = new THREE.Group(); this.weaponGroup.position.set(0, -0.35, 0); this.armR.add(this.weaponGroup);

        this.weaponGroup.rotation.x = Math.PI / 2; this.weaponGroup.rotation.z = -0.2;

        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 2.2, 8), new THREE.MeshStandardMaterial({color: 0x3e2723, name:'bodyPart'})); handle.position.y = 0.8; this.weaponGroup.add(handle);

        const headGroup = new THREE.Group(); headGroup.position.y = 1.8; this.weaponGroup.add(headGroup);

        const hammerMain = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.8), darkMetalMat); headGroup.add(hammerMain);

        const faceF = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.1), goldMat); faceF.position.z = 0.4; headGroup.add(faceF);

        const faceB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.1), goldMat); faceB.position.z = -0.4; headGroup.add(faceB);

        const runeSide = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), runeMat); runeSide.position.x = 0.26; runeSide.rotation.y = Math.PI/2; headGroup.add(runeSide);

        const runeSide2 = runeSide.clone(); runeSide2.position.x = -0.26; runeSide2.rotation.y = -Math.PI/2; headGroup.add(runeSide2);



        this.mesh.traverse(c => {

            if(c.isMesh && c.material) {

                c.userData.baseColor = c.material.color.getHex();

                if(c.material.emissive) c.userData.baseEmissive = c.material.emissive.getHex();

                if(c.material.emissiveIntensity) c.userData.baseEmissiveIntensity = c.material.emissiveIntensity;

            }

        });

    }



    createLeg(matArmor, matDark, matGold, x, y) {

        const group = new THREE.Group(); group.position.set(x, y, 0);

        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.45), matDark); thigh.position.y = -0.2; group.add(thigh);

        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.3), matArmor); boot.position.set(0, -0.6, 0.05); group.add(boot);

        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.32), matGold); trim.position.set(0, -0.4, 0.05); group.add(trim);

        return group;

    }



    animateCharacter(dt) {

        super.animateCharacter(dt);

        if(this.cape) { this.cape.rotation.x = 0.15 + Math.sin(this.animTime) * 0.1; if(this.isMoving) this.cape.rotation.x += 0.4; }

        if (this.animState.override) {

            this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, this.animState.torsoTwist, dt * 15);

            this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, this.animState.armRightRot, dt * 15);

            this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, this.animState.armLeftRot, dt * 15);

            if(this.weaponGroup) {

                const currentRot = this.weaponGroup.rotation.x;

                const targetRot = (Math.PI/2) + this.animState.weaponRot;

                this.weaponGroup.rotation.x = THREE.MathUtils.lerp(currentRot, targetRot, dt * 15);

            }

        } 

        else {

            this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, 0, dt * 10);

            if(this.isMoving) {

                this.armR.rotation.x = Math.sin(this.animTime) * 0.6;

                this.armL.rotation.x = Math.sin(this.animTime + Math.PI) * 0.6;

            } else {

                const breathe = Math.sin(Date.now() * 0.002);

                this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, breathe * 0.05, dt * 5);

                this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, breathe * 0.05, dt * 5);

            }

            if(this.weaponGroup) {

                this.weaponGroup.rotation.x = THREE.MathUtils.lerp(this.weaponGroup.rotation.x, Math.PI/2, dt * 10);

            }

        }

    }



    update(dt) {

        if (this.isCasting) { this.speed = 0; this.isMoving = false; }
        else {
            this.speed = STATE.stats.speed;
            if (this.buffs.find(b => b.name === 'Élan titan')) this.speed *= 1.1;
        }

        super.update(dt);

    }



    updateClassPassives(dt) {

        const resourceEl = document.getElementById('class-resource');

        const charge = ConstellationEngine.getStoredParryCharge();

        if (resourceEl) {

            if (charge > 0) {

                resourceEl.innerHTML = `<div style="color:#9b59b6; font-weight:bold; text-shadow:0 0 5px #4a235a;">🛡 CHARGE SISMIQUE: ${Math.floor(charge)}</div>`;

                resourceEl.style.display = 'block';

            } else { resourceEl.style.display = 'none'; }

        }

    }



    takeDamage(amount) {

        if (this.dead) return;

        if (this.isLocalPlayer() && isInSafeZone(this.position)) return;

        if (this.isIntangible) {

            createDamageText("ESQUIVÉ", this.position, "#aaddff");

            return;

        }



        amount = ConstellationEngine.modifyDamageTaken(amount);

        const isParrying = this.buffs.find(b => b.name === 'Parade');



        if (isParrying) {

            const blocked = amount * 0.75;

            ConstellationEngine.onBlock(blocked);
            ConstellationEngine.onWarriorParryBlock(this, blocked);
            this.parryBlockedTotal = (this.parryBlockedTotal || 0) + blocked;

            const hasChargePassive = ConstellationEngine.getPassiveRank('parryCharge');

            if (!hasChargePassive) {

                this.parryExplosionCharge = (this.parryExplosionCharge || 0) + blocked;

            }



            amount *= 0.25;

            const reflect = ConvergenceEffects.calcParryReflectDamage(blocked);
            if (reflect > 0) {
                let closest = null;
                let minD = 8;
                Globals.enemies.forEach((e) => {
                    if (e.dead) return;
                    const d = e.position.distanceTo(this.position);
                    if (d < minD) { minD = d; closest = e; }
                });
                if (closest) {
                    closest.takeDamage(reflect);
                    createDamageText('RENVOI', closest.position, '#d4af37');
                    spawnParticles(closest.position, 0xd4af37, 8);
                }
            }

            createDamageText("BLOQUÉ", this.position, '#cccccc');

            if (AudioSys.sfx.warrior.block) AudioSys.sfx.warrior.block();

        }



        if (amount > 0) {

            this.hp -= amount;

            createDamageText("-" + Math.floor(amount), this.position, '#ff0000');

            this.flashColor(this.bodyGroup, 0xff0000);

            AudioSys.sfx.hit();



            if (STATE.passives && STATE.passives.ironThorn && Globals.enemies) {

                const reflectDmg = amount * 0.15;

                if (reflectDmg >= 1) {

                    let closest = null;

                    let minD = 999;

                    Globals.enemies.forEach(e => {

                        const d = this.position.distanceTo(e.position);

                        if (d < minD) { minD = d; closest = e; }

                    });

                    if (closest && minD < 5 && closest.takeDamage) {

                        closest.takeDamage(reflectDmg);

                        createDamageText("RETOUR: " + Math.floor(reflectDmg), closest.position, "#aaaaaa");

                    }

                }

            }

        }



        if (this.hp <= 0) {

            if (ConstellationEngine.tryLastBreath()) return;

            this.hp = 0;

            this.die();

        }

        if (this.isLocalPlayer()) UI.updateHUD();

    }



    updateBuffs(dt) {

        const hadParry = this._hadParryBuff;

        super.updateBuffs(dt);

        const parryBuff = this.buffs.find(b => b.name === 'Parade');

        this._hadParryBuff = !!parryBuff;



        if (hadParry && !parryBuff) {
            ConstellationEngine.onWarriorParryEnd(this);

            if (ConstellationEngine.shouldTriggerParrySeismic()) {
                this.triggerFreeSeismicStrike();
            } else {
                const explosion = this.parryExplosionCharge || 0;
                if (explosion > 0) {
                    const explodeDmg = ConstellationEngine.calcWarriorParryExplosion(explosion);
                    createSkillVisual('shockwave', this.position, 8, 0x8e44ad);
                    createDamageText("RETOUR DE FORCE!", this.position, '#8e44ad');
                    Globals.enemies.forEach(e => {
                        if (e.position.distanceTo(this.position) < 8) {
                            e.takeDamage(explodeDmg);
                            e.pushBack(this.position, 12);
                        }
                    });
                    this.parryExplosionCharge = 0;
                }
            }
            this.parryBlockedTotal = 0;
        }

    }



    performAttack() {

        if(this.isAttacking) return;

        this.faceMouse(); 

        this.attackCooldown = this.attackMaxCooldown * (STATE.stats.attackSpeedMod || 1);

        this.isAttacking = true;

        this.animState.override = true; 

        AudioSys.sfx.warrior.swing();

        ConstellationEngine.onBasicAttack();



        const duration = 600; const startTime = Date.now();

        const attackAnim = () => {

            const elapsed = Date.now() - startTime;

            if(elapsed >= duration) { this.isAttacking = false; this.animState.override = false; this.animState.torsoTwist = 0; this.animState.armRightRot = 0; this.animState.armLeftRot = 0; this.animState.weaponRot = 0; return; }

            const p = elapsed / duration;

            let progress = 0;

            if (p < 0.4) {

                progress = p / 0.4;

                this.animState.torsoTwist = -1.0 * progress; 

                this.animState.armRightRot = -Math.PI/2 * progress; 

                this.animState.weaponRot = -0.5 * progress;

            } else if (p < 0.7) {

                progress = (p - 0.4) / 0.3;

                progress = 1 - (1 - progress) * (1 - progress);

                this.animState.torsoTwist = THREE.MathUtils.lerp(-1.0, 1.2, progress);

                this.animState.armRightRot = THREE.MathUtils.lerp(-Math.PI/2, 0, progress);

                this.animState.weaponRot = THREE.MathUtils.lerp(-0.5, 0.8, progress);

            } else {

                progress = (p - 0.7) / 0.3;

                this.animState.torsoTwist = THREE.MathUtils.lerp(1.2, 0, progress);

                this.animState.armRightRot = THREE.MathUtils.lerp(0, 0, progress);

                this.animState.weaponRot = THREE.MathUtils.lerp(0.8, 0, progress);

            }

            requestAnimationFrame(attackAnim);

        };

        attackAnim();



        setTimeout(() => {

            const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);

            if(STATE.multiplayer.active && this.isLocalPlayer()) {

                Network.send({ type: 'net-action', action: 'attack-melee', id: STATE.multiplayer.id, pos: this.position, dir: dir, color: CONFIG.colors.warrior, class: 'warrior' });

            }

            createSkillVisual('melee_slash', this.position, 4.0, 0x9b59b6, dir);

            const dmg = ConstellationEngine.calcWarriorSkillDamage('primary');

            Globals.enemies.forEach(e => {

                if(e.position.distanceTo(this.position) < 4.5) { 

                    const toE = e.position.clone().sub(this.position).normalize();

                    if(dir.dot(toE) > 0.4) { 

                        const { isCrit } = dealDamageToEnemy(e, dmg, { pos: e.position });

                        if (isCrit) AudioSys.sfx.crit();

                        else AudioSys.sfx.hit();

                        spawnParticles(e.position, 0x8e44ad, 8);

                        e.pushBack(this.position, 2); 

                    }

                }

            });

        }, duration * 0.6);

    }



    applySeismicImpact(radius, parryBonus = 0, label = 'CRUSH!') {
        const smashDmg = ConstellationEngine.calcWarriorSkillDamage('space', parryBonus);
        createSkillVisual('shockwave', this.position, radius, 0x8e44ad);
        const bonusText = parryBonus > 0 ? `${label} +${Math.floor(parryBonus)}` : label;
        createDamageText(bonusText, this.position, '#ffffff');
        if (this.isLocalPlayer() && Globals.camera) {
            const originalY = Globals.camera.position.y;
            Globals.camera.position.y -= 0.5;
            setTimeout(() => { if (Globals.camera) Globals.camera.position.y = originalY; }, 100);
        }
        Globals.enemies.forEach(e => {
            if (e.position.distanceTo(this.position) <= radius) {
                e.takeDamage(smashDmg);
                e.pushBack(this.position, radius > 13 ? 20 : 14);
            }
        });
    }

    triggerFreeSeismicStrike() {
        if (this.isCasting) return;
        const parryBonus = ConstellationEngine.consumeParryCharge();
        const radius = ConstellationEngine.getFreeSeismicRadius();
        AudioSys.sfx.warrior.smash();
        this.applySeismicImpact(radius, parryBonus, 'CATACLYSME!');
    }

    useSkill(key) {

        if(this.cooldowns[key] > 0 || this.isCasting) return;

        this.faceMouse();

        this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);

        ConstellationEngine.onSkillUsed(key);

        

        const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);

        dir.y = 0; dir.normalize();



        if(key === 'space') { 

            this.isCasting = true; this.animState.override = true; this.speed = 0; 

            AudioSys.sfx.warrior.smash(); 



            let targetPos;

            if (this.isLocalPlayer() && Globals.camera) {

                STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);

                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

                const intersection = new THREE.Vector3();

                STATE.raycaster.ray.intersectPlane(plane, intersection);

                const dist = Math.min(this.position.distanceTo(intersection), 25);

                const jumpDir = intersection.clone().sub(this.position).normalize();

                targetPos = this.position.clone().add(jumpDir.multiplyScalar(dist));

            } else {

                targetPos = this.position.clone().add(dir.clone().multiplyScalar(20.0));

            }

            

            const startPos = this.position.clone();

            const jumpDur = 1000; const start = Date.now();

            const parryBonus = ConstellationEngine.consumeParryCharge();



            const jumpAnim = () => {

                const elapsed = Date.now() - start;

                if(elapsed >= jumpDur) {

                    this.isCasting = false; this.animState.override = false; this.mesh.position.y = 0; 

                    this.animState.armRightRot = 0; this.animState.torsoTwist = 0; this.animState.weaponRot = 0; this.body.rotation.x = 0;

                    this.applySeismicImpact(15, parryBonus, 'CRUSH!');

                    return;

                }

                this.speed = 0;

                const p = elapsed / jumpDur;

                this.position.lerpVectors(startPos, targetPos, p);

                this.mesh.position.y = (Math.sin(p * Math.PI)) * 6.0; 

                if (p < 0.5) {

                    this.body.rotation.x = -0.2 * p; 

                    this.animState.armRightRot = THREE.MathUtils.lerp(0, -Math.PI, p * 2); 

                    this.animState.armLeftRot = THREE.MathUtils.lerp(0, -Math.PI, p * 2);

                    this.animState.weaponRot = 0;

                } else {

                    const subP = (p - 0.5) * 2;

                    this.body.rotation.x = THREE.MathUtils.lerp(-0.1, 0.5, subP); 

                    this.animState.armRightRot = THREE.MathUtils.lerp(-Math.PI, 0.2, subP);

                    this.animState.armLeftRot = THREE.MathUtils.lerp(-Math.PI, 0.2, subP);

                    this.animState.weaponRot = 0.5;

                }

                requestAnimationFrame(jumpAnim);

            };

            jumpAnim();



        } else if (key === 'shift') { 

            AudioSys.sfx.warrior.shout();

            this.animState.override = true;

            const shoutDur = 600; const start = Date.now();

            const shoutAnim = () => {

                const elapsed = Date.now() - start;

                if(elapsed >= shoutDur) { this.animState.override = false; this.body.rotation.x = 0; this.animState.armRightRot = 0; this.animState.armLeftRot = 0; return; }

                const p = elapsed / shoutDur; const waveP = Math.sin(p * Math.PI);

                this.body.rotation.x = -0.4 * waveP; this.animState.armRightRot = -0.8 * waveP; this.animState.armLeftRot = -0.8 * waveP;

                requestAnimationFrame(shoutAnim);

            };

            shoutAnim();

            const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.2, 32), new THREE.MeshBasicMaterial({color: 0xffd700, side:THREE.DoubleSide, transparent:true}));

            ring.rotation.x = -Math.PI/2; ring.position.copy(this.position).add(new THREE.Vector3(0, 0.1, 0));

            this.addLocalVisual(ring, 0.8, (m, t, maxT) => { const p = 1 - (t/maxT); m.scale.setScalar(1 + p * 15); m.material.opacity = (1-p); });

            createDamageText("RAGE!", this.position, '#fff');

            this.heal(ConstellationEngine.calcWarriorSkillDamage('shift'));



        } else if (key === 'e') { 

            const parryDur = ConstellationEngine.getPassiveRank('ironWall') ? 3.5 : 3;
            this.parryBlockedTotal = 0;
            this.addBuff('Parade', parryDur, '<i class="fas fa-shield-halved"></i>');

            AudioSys.sfx.warrior.block(); 

            createSkillVisual('shockwave', this.position, 5, 0x8e44ad);

            this._hadParryBuff = true;

            this.animState.override = true;

            const blockDur = 500; const start = Date.now();

            const blockAnim = () => {

                const elapsed = Date.now() - start;

                if(elapsed >= blockDur) { this.animState.override = false; this.animState.armRightRot = 0; this.animState.torsoTwist = 0; this.animState.weaponRot = 0; return; }

                const p = elapsed / blockDur; const waveP = Math.sin(p * Math.PI); 

                this.animState.torsoTwist = -0.8 * waveP; this.animState.armRightRot = -1.0 * waveP; this.animState.weaponRot = 1.0 * waveP; 

                requestAnimationFrame(blockAnim);

            };

            blockAnim();

            const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshBasicMaterial({color:0x8e44ad, wireframe:true, transparent:true, opacity:0.5}));

            shield.position.copy(this.position);

            this.addLocalVisual(shield, 3.0, (m, t) => { m.position.copy(this.position).add(new THREE.Vector3(0,1,0)); m.rotation.y += 0.05; m.scale.setScalar(1 + Math.sin(t*10)*0.05); });

        }

    }

}


