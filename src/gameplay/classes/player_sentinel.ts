// @ts-nocheck
import { PlayerBase } from '../player_base';
import { CONFIG, STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createSkillVisual, createDamageText, spawnParticles } from '../../visual/effects';
import { Network } from '../../multiplayer/network';
import { Globals } from '../../core/globals';
import { ConstellationEngine } from '../../systems/constellationEngine';
import { Projectile } from '../entities';

export class Sentinel extends PlayerBase {
    // ... (Constructeur et createModel inchangés) ...
    constructor() {
        super('sentinel');
        this.createClassModel();
        this.applyClassStats();
        
        this.wingTime = 0;
        this.isCasting = false; 
        
        this.animState = {
            rightArmOverride: false, 
            spineBend: 0
        };
    }

    createClassModel() {
        // ... (Reprise du modèle pour contexte) ...
        const armorWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.5, name: 'bodyPart' });
        const armorGold = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 1.0, emissive: 0x443300, name: 'bodyPart' });
        const innerDark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, name: 'bodyPart' });
        const energyMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, side: THREE.DoubleSide, name: 'bodyPart' });

        this.mesh = new THREE.Group();
        this.bodyGroup.add(this.mesh);

        const legHeight = 0.75;
        this.legL = this.createLeg(armorWhite, innerDark, armorGold, -0.15, legHeight);
        this.legR = this.createLeg(armorWhite, innerDark, armorGold, 0.15, legHeight);
        this.mesh.add(this.legL);
        this.mesh.add(this.legR);

        this.body = new THREE.Group();
        this.body.position.y = legHeight; 
        this.mesh.add(this.body);

        const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.25), innerDark);
        hips.position.y = 0.1; this.body.add(hips);
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.55, 8), armorWhite);
        torso.position.y = 0.5; this.body.add(torso);
        const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.15), armorGold);
        chestPlate.position.set(0, 0.6, 0.18); this.body.add(chestPlate);
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), energyMat);
        core.position.set(0, 0.6, 0.26); this.body.add(core);

        const skirtGroup = new THREE.Group(); skirtGroup.position.y = 0.15; this.body.add(skirtGroup);
        const skirtGeo = new THREE.BoxGeometry(0.18, 0.45, 0.05);
        [-0.4, 0.4, Math.PI - 0.4, Math.PI + 0.4].forEach(angle => {
            const plate = new THREE.Mesh(skirtGeo, armorWhite);
            plate.position.set(Math.cos(angle) * 0.22, -0.2, Math.sin(angle) * 0.22);
            plate.rotation.set(0.15, -angle + Math.PI/2, 0);
            skirtGroup.add(plate);
        });

        this.headGroup = new THREE.Group(); this.headGroup.position.y = 0.95; this.body.add(this.headGroup);
        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.28), armorWhite); this.headGroup.add(helmet);
        const visorV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.02), energyMat); visorV.position.set(0, 0, 0.15); this.headGroup.add(visorV);
        const visorH = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.02), energyMat); visorH.position.set(0, 0, 0.15); this.headGroup.add(visorH);
        this.halo = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.015, 8, 32), energyMat); this.halo.rotation.x = Math.PI / 2; this.halo.position.y = 0.35; this.headGroup.add(this.halo);

        this.shoulders = new THREE.Group(); this.shoulders.position.y = 0.75; this.body.add(this.shoulders);
        const pauldronGeo = new THREE.DodecahedronGeometry(0.16);
        const sL = new THREE.Mesh(pauldronGeo, armorGold); sL.position.set(0.32, 0.05, 0); this.shoulders.add(sL);
        const sR = new THREE.Mesh(pauldronGeo, armorGold); sR.position.set(-0.32, 0.05, 0); this.shoulders.add(sR);

        const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45);
        this.armL = new THREE.Mesh(armGeo, innerDark); this.armL.position.set(0.35, 0.6, 0); this.body.add(this.armL);
        this.armR = new THREE.Mesh(armGeo, innerDark); this.armR.position.set(-0.35, 0.6, 0); this.body.add(this.armR);

        this.weaponGroup = new THREE.Group(); this.weaponGroup.position.set(0, -0.2, 0.2); this.weaponGroup.rotation.x = Math.PI / 2; this.armR.add(this.weaponGroup);
        const spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.5), armorWhite); spearShaft.position.y = 0.4; this.weaponGroup.add(spearShaft);
        const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 4), energyMat); spearHead.position.y = 1.8; this.weaponGroup.add(spearHead);
        const spearGuard = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 4), armorGold); spearGuard.rotation.x = Math.PI / 2; spearGuard.rotation.z = Math.PI / 4; spearGuard.position.y = 1.4; this.weaponGroup.add(spearGuard);

        this.wings = new THREE.Group(); this.wings.position.set(0, 0.7, -0.25); this.body.add(this.wings);
        const wingBladeGeo = new THREE.BoxGeometry(0.08, 1.0, 0.02);
        for(let i=0; i<3; i++) {
            const wL = new THREE.Mesh(wingBladeGeo, energyMat); wL.position.x = 0.15 + (i*0.08); wL.rotation.z = -0.4 - (i*0.25); wL.userData.baseRot = wL.rotation.z; this.wings.add(wL);
            const wR = new THREE.Mesh(wingBladeGeo, energyMat); wR.position.x = -0.15 - (i*0.08); wR.rotation.z = 0.4 + (i*0.25); wR.userData.baseRot = wR.rotation.z; this.wings.add(wR);
        }
    }

    createLeg(mat1, mat2, mat3, x, y) {
        const group = new THREE.Group(); group.position.set(x, y, 0);
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.4), mat2); thigh.position.y = -0.2; group.add(thigh);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.22), mat1); boot.position.set(0, -0.55, 0.05); group.add(boot);
        const knee = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.1), mat3); knee.position.set(0, -0.35, 0.12); group.add(knee);
        return group;
    }

    animateCharacter(dt) {
        super.animateCharacter(dt);
        const t = Date.now() * 0.001;
        this.wingTime += dt;
        if (this.body) {
            this.body.position.y = 0.75 + Math.sin(t * 1.5) * 0.01 + this.animState.spineBend; 
            if (!this.animState.rightArmOverride) this.body.rotation.z = Math.sin(t) * 0.01;
        }
        if(this.halo) {
            this.halo.rotation.z += dt; this.halo.rotation.x = (Math.PI/2) + Math.sin(t) * 0.1;
        }
        if(this.wings) {
            this.wings.children.forEach((wing, i) => {
                const flap = Math.sin(this.wingTime * 2 + i) * 0.1; wing.rotation.z = wing.userData.baseRot + flap;
                if(wing.material.opacity !== undefined) wing.material.opacity = 0.6 + Math.sin(t * 3 + i) * 0.2;
            });
        }
        if (!this.animState.rightArmOverride && this.isMoving && !this.isAttacking) {
             this.armR.rotation.x = Math.sin(this.animTime + Math.PI) * 0.5;
        } else if (!this.animState.rightArmOverride && !this.isAttacking) {
             this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, 0, dt * 5);
        }
    }

    update(dt) {
        if (this.isCasting) { this.speed = 0; } else { this.speed = STATE.stats.speed; }
        super.update(dt);
    }

    performAttack() {
        if(this.isAttacking || this.isCasting) return;

        this.faceMouse(); 
        this.attackCooldown = this.attackMaxCooldown * (STATE.stats.attackSpeedMod || 1);
        this.isAttacking = true;
        AudioSys.sfx.sentinel.laser();

        const animDuration = 200;
        const start = Date.now();
        this.animState.rightArmOverride = true;

        const attackAnim = () => {
            const elapsed = Date.now() - start;
            if (elapsed >= animDuration) {
                this.isAttacking = false;
                this.animState.rightArmOverride = false;
                this.weaponGroup.position.z = 0.2; 
                this.armR.rotation.x = 0;
                return;
            }
            const p = elapsed / animDuration;
            const z = p < 0.3 ? 0.2 + (p/0.3)*0.5 : 0.7 - ((p-0.3)/0.7)*0.5;
            this.weaponGroup.position.z = z;
            this.armR.rotation.x = -0.3 * Math.sin(p * Math.PI);
            requestAnimationFrame(attackAnim);
        }
        attackAnim();

        // FIX: Use Mesh Quaternion
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0; dir.normalize();
        
        if(STATE.multiplayer.active && this.isLocalPlayer()) {
            Network.send({ type: 'net-action', action: 'attack-range', id: STATE.multiplayer.id, pos: this.position, dir: dir, color: CONFIG.colors.sentinel, class: 'sentinel' });
        }

        const projGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8); projGeo.rotateX(-Math.PI / 2); 
        const projMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        const startPos = this.position.clone().add(new THREE.Vector3(0, 0.8, 0)); 
        Globals.projectiles.push(new Projectile(projGeo, projMat, startPos, dir, 0.8, STATE.stats.atk, 'player', CONFIG.colors.sentinel));
        spawnParticles(startPos, CONFIG.colors.sentinel, 5);
    }

    useSkill(key) {
        if(this.cooldowns[key] > 0 || this.isCasting) return;
        this.faceMouse();
        
        // FIX: Direction universelle
        const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0; dir.normalize();
        
        this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);

        if(key === 'space') { 
            // --- RAYON STELLAIRE ---
            this.isCasting = true; 
            createDamageText("CHARGE...", this.position, '#ffffaa');
            
            const chargeTime = 1000;
            const startTime = Date.now();
            this.animState.rightArmOverride = true;

            const chargeAnim = () => {
                if(!this.isCasting) return;
                const elapsed = Date.now() - startTime;
                const p = Math.min(1, elapsed / chargeTime);

                this.armR.rotation.x = -Math.PI / 2 - (p * 0.5); 
                this.body.rotation.x = -0.3 * p; 
                this.armL.rotation.x = -1.0 * p;

                if(Math.random() < p) {
                    const tipPos = this.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(dir.clone().multiplyScalar(-1));
                    spawnParticles(tipPos, 0xffffaa, 1);
                }

                if(elapsed < chargeTime) {
                    requestAnimationFrame(chargeAnim);
                } else {
                    // FIX: Passer la direction du mesh
                    this.fireStellarBeam(dir);
                }
            };
            chargeAnim();

        } else if (key === 'shift') { 
            // ... (Champ lumière inchangé) ...
            AudioSys.sfx.sentinel.field();
            this.animState.rightArmOverride = true;
            const animDur = 500;
            const startTime = Date.now();
            const slamAnim = () => {
                const elapsed = Date.now() - startTime;
                const p = elapsed / animDur;
                if (p >= 1) { this.animState.rightArmOverride = false; this.armR.rotation.x = 0; this.weaponGroup.rotation.x = Math.PI/2; return; }
                if (p < 0.4) { this.armR.rotation.x = -Math.PI; this.weaponGroup.rotation.x = 0; } 
                else if (p < 0.6) { this.armR.rotation.x = 0.5; this.weaponGroup.position.y = -0.5; }
                else {
                    this.armR.rotation.x = THREE.MathUtils.lerp(0.5, 0, (p-0.6)/0.4);
                    this.weaponGroup.position.y = THREE.MathUtils.lerp(-0.5, -0.2, (p-0.6)/0.4);
                    this.weaponGroup.rotation.x = THREE.MathUtils.lerp(0, Math.PI/2, (p-0.6)/0.4);
                }
                requestAnimationFrame(slamAnim);
            };
            slamAnim();
            createSkillVisual('vortex', this.position, 10, 0xf1c40f);
            const zonePos = this.position.clone();
            const zone = new THREE.Mesh(new THREE.RingGeometry(9.5, 10, 32), new THREE.MeshBasicMaterial({color:0xf1c40f, side:THREE.DoubleSide, transparent:true, opacity:0.5}));
            zone.rotation.x = -Math.PI/2; zone.position.copy(zonePos).add(new THREE.Vector3(0, 0.1, 0));
            this.addLocalVisual(zone, 5.0, (m, t) => { 
                m.rotation.z -= 0.02; m.scale.setScalar(1 + Math.sin(t*5)*0.05);
                if (Math.floor(t * 10) !== Math.floor((t + 0.016) * 10)) { 
                     Globals.enemies.forEach(e => { if(e.position.distanceTo(zonePos) < 10) e.takeDamage(STATE.stats.atk * 0.1); });
                     if(this.position.distanceTo(zonePos) < 10) this.heal(1);
                }
            });

        } else if (key === 'e') { 
            // ... (Egide divine inchangé) ...
            AudioSys.sfx.sentinel.shield();
            this.animState.rightArmOverride = true;
            const animDur = 600;
            const startTime = Date.now();
            const spinAnim = () => {
                const elapsed = Date.now() - startTime;
                const p = elapsed / animDur;
                if (p >= 1) { this.animState.rightArmOverride = false; this.armR.rotation.x = 0; this.weaponGroup.rotation.z = 0; return; }
                this.armR.rotation.x = -Math.PI * 0.8;
                this.weaponGroup.rotation.z = p * Math.PI * 4;
                requestAnimationFrame(spinAnim);
            };
            spinAnim();
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), new THREE.MeshBasicMaterial({color:0xffff00, wireframe:true, transparent:true, opacity:0.5}));
            sphere.position.copy(this.position);
            this.addLocalVisual(sphere, 5.0, (m, t) => { m.position.copy(this.position); m.rotation.y += 0.02; m.material.opacity = (t/5.0) * 0.5; });
            this.heal(40);
            this.addBuff('Shield', 5, '<i class="fas fa-shield-alt"></i>');
            createDamageText("BOUCLIER", this.position, '#ffff00');
        }
    }

    fireStellarBeam(dir) {
        AudioSys.sfx.sentinel.laser();
        
        // FIX: Calcul de la cible basé sur la direction et distance fixe (pour Remote)
        // Ou Raycast pour Local
        let targetPos;
        if (this.isLocalPlayer() && Globals.camera) {
            STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            STATE.raycaster.ray.intersectPlane(plane, intersection);
            targetPos = intersection;
            this.faceMouse();
        } else {
            // Pour Remote, on tire droit devant à une distance fixe (ex: 15m)
            targetPos = this.position.clone().add(dir.clone().multiplyScalar(15.0));
        }

        // Animation
        const recoilAnim = () => {
            this.body.rotation.x = 0.5; this.armR.rotation.x = 0.5; 
            setTimeout(() => {
                this.body.rotation.x = 0; this.armR.rotation.x = 0; this.armL.rotation.x = 0; 
                this.isCasting = false; this.animState.rightArmOverride = false;
            }, 200);
        };
        recoilAnim();

        // Rayon
        const startPos = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const dist = startPos.distanceTo(targetPos);
        const midPos = startPos.clone().lerp(targetPos, 0.5);

        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.6, 0.6, dist, 8), 
            new THREE.MeshBasicMaterial({color:0xffffaa, emissive:0xffffff})
        );
        beam.position.copy(midPos);
        beam.lookAt(targetPos);
        beam.rotateX(Math.PI / 2); 
        
        this.addLocalVisual(beam, 0.4, (m, t) => { 
            const p = t/0.4; m.scale.x = m.scale.z = p * 1.5; m.material.opacity = p;
        });

        createSkillVisual('shockwave', targetPos, 4.0, 0xffffaa); 
        const blastRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 4.0, 32), new THREE.MeshBasicMaterial({color: 0xffffaa, transparent: true, opacity: 0.8, side: THREE.DoubleSide}));
        blastRing.rotation.x = -Math.PI / 2;
        blastRing.position.copy(targetPos).add(new THREE.Vector3(0, 0.1, 0));
        this.addLocalVisual(blastRing, 0.5, (m, t) => { m.scale.setScalar(1 + (0.5 - t) * 4); m.material.opacity = t * 2; });
        
        Globals.enemies.forEach(e => {
            if(e.position.distanceTo(targetPos) < 4.0) { 
                e.takeDamage(STATE.stats.atk * 3.0); 
                spawnParticles(e.position, 0xf1c40f, 15);
                e.pushBack(targetPos, 5); 
            }
        });
    }
}