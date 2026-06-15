// @ts-nocheck
import { PlayerBase } from '../player_base';
import { CONFIG, STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createSkillVisual, createDamageText, spawnParticles } from '../../visual/effects';
import { Network } from '../../multiplayer/network';
import { canApplyGameplay } from '../../multiplayer/net_authority';
import { Globals } from '../../core/globals';
import { ConstellationEngine } from '../../systems/constellationEngine';
import { PassiveKeystoneHooks } from '../../systems/passiveKeystoneHooks';
import { Projectile } from '../entities';
import { dealDamageToEnemy } from '../combat/damage_helpers';
import {
  calcStellarRayAmplification,
  getStellarChargeMaxSec,
  hasStellarOvercharge,
  hasStellarRangeBonus,
  STELLAR_AMP_MIN,
  STELLAR_AMP_MAX,
  STELLAR_AMP_MID,
  STELLAR_NORMAL_CAST_SEC,
  STELLAR_RANGE_BONUS_MULT,
} from './sentinel/stellarRayCharge';
import {
  hideStellarRayChargeUI,
  updateStellarRayChargeUI,
} from './sentinel/stellarRayUi';

export class Sentinel extends PlayerBase {
    constructor() {
        super('sentinel');
        this.isApexActive = false;
        this.createClassModel();
        this.applyClassStats();
        
        this.wingTime = 0;
        this.isCasting = false;
        this.stellarCharging = false;
        this.stellarOverchargeMode = false;
        this.stellarChargeElapsed = 0;
        this.stellarChargeAmp = STELLAR_AMP_MIN;
        this.stellarChargeDir = null;
        
        this.animState = {
            rightArmOverride: false, 
            spineBend: 0
        };
    }

    createClassModel() {
        const isApex = STATE.unlockedNodes?.includes('sentinel-apex') || false;
        this.isApexActive = isApex;
        
        // Colors & materials
        const armorColor = 0xffffff; // Sleek white armor
        const goldColor = isApex ? 0xffea00 : 0xffd700; // Bright sun-gold vs standard gold
        const energyColor = isApex ? 0xffd700 : 0xffaa00; // Brilliant yellow vs warm yellow-orange
        
        const armorWhite = new THREE.MeshStandardMaterial({ 
            color: armorColor, 
            roughness: isApex ? 0.12 : 0.22, 
            metalness: isApex ? 0.85 : 0.55,
            name: 'bodyPart' 
        });
        const armorGold = new THREE.MeshStandardMaterial({ 
            color: goldColor, 
            roughness: isApex ? 0.08 : 0.18, 
            metalness: 1.0, 
            emissive: isApex ? 0x665200 : 0x332200, 
            emissiveIntensity: isApex ? 1.0 : 0.4,
            name: 'bodyPart' 
        });
        const innerDark = new THREE.MeshStandardMaterial({ 
            color: isApex ? 0x111622 : 0x1f2733, 
            roughness: 0.8, 
            name: 'bodyPart' 
        });
        
        // Base energy material
        const energyMat = new THREE.MeshStandardMaterial({ 
            color: energyColor, 
            roughness: 0.1,
            metalness: 0.1,
            emissive: energyColor,
            emissiveIntensity: isApex ? 2.5 : 1.5,
            transparent: true, 
            opacity: 0.85, 
            side: THREE.DoubleSide, 
            name: 'bodyPart' 
        });

        this.mesh = new THREE.Group();
        this.bodyGroup.add(this.mesh);

        const legHeight = 0.75;
        this.legL = this.createLeg(armorWhite, innerDark, armorGold, -0.16, legHeight);
        this.legR = this.createLeg(armorWhite, innerDark, armorGold, 0.16, legHeight);
        this.mesh.add(this.legL);
        this.mesh.add(this.legR);

        this.body = new THREE.Group();
        this.body.position.y = legHeight; 
        this.mesh.add(this.body);

        // Hips & Belt
        const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.2), innerDark);
        hips.position.y = 0.08; 
        this.body.add(hips);
        
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 16), armorGold);
        belt.rotation.x = Math.PI / 2;
        belt.position.y = 0.14;
        this.body.add(belt);

        // Sleek layered chest armor torso
        const chestGroup = new THREE.Group();
        chestGroup.position.y = 0.48;
        this.body.add(chestGroup);
        
        const mainChest = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.5, 8), armorWhite);
        chestGroup.add(mainChest);
        
        // Pectoral plates (left & right angled plates for detailed look)
        const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.08), armorWhite);
        plateL.position.set(0.08, 0.08, 0.13);
        plateL.rotation.set(0.1, -0.25, 0.05);
        chestGroup.add(plateL);
        
        const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.08), armorWhite);
        plateR.position.set(-0.08, 0.08, 0.13);
        plateR.rotation.set(0.1, 0.25, -0.05);
        chestGroup.add(plateR);
        
        // Chest Gold Trim/Guard
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.2), armorGold);
        collar.position.set(0, 0.22, 0.06);
        collar.rotation.x = 0.15;
        chestGroup.add(collar);
        
        // glowing sun core in chest center
        const coreSize = isApex ? 0.075 : 0.055;
        const coreGeo = new THREE.IcosahedronGeometry(coreSize, 1);
        const coreMat = energyMat.clone();
        if (isApex) {
            coreMat.color.setHex(0xffea00);
            coreMat.emissive.setHex(0xffaa00);
            coreMat.emissiveIntensity = 3.0;
        }
        this.chestCore = new THREE.Mesh(coreGeo, coreMat);
        this.chestCore.position.set(0, 0.08, 0.18);
        chestGroup.add(this.chestCore);
        
        // Floating ring around core
        const coreRing = new THREE.Mesh(new THREE.TorusGeometry(coreSize * 1.6, 0.01, 8, 16), armorGold);
        coreRing.position.set(0, 0.08, 0.17);
        coreRing.rotation.y = 0.1;
        chestGroup.add(coreRing);

        // Skirt/Tassets
        const skirtGroup = new THREE.Group(); skirtGroup.position.y = 0.12; this.body.add(skirtGroup);
        const tassetGeo = new THREE.BoxGeometry(0.14, 0.38, 0.03);
        tassetGeo.translate(0, -0.19, 0); // pivot at top
        
        const numTassets = 6;
        for (let i = 0; i < numTassets; i++) {
            const angle = (i / numTassets) * Math.PI * 2;
            const tasset = new THREE.Group();
            tasset.position.set(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18);
            
            const plate = new THREE.Mesh(tassetGeo, armorWhite);
            plate.rotation.y = -angle + Math.PI / 2;
            plate.rotation.x = 0.18;
            tasset.add(plate);
            
            const trimTip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.04), armorGold);
            trimTip.position.set(0, -0.34, 0.015);
            trimTip.rotation.y = -angle + Math.PI / 2;
            trimTip.rotation.x = 0.18;
            tasset.add(trimTip);
            
            skirtGroup.add(tasset);
        }

        // Helmet & Head
        this.headGroup = new THREE.Group(); this.headGroup.position.y = 1.0; this.body.add(this.headGroup);
        const helmetBase = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), armorWhite);
        helmetBase.scale.set(1, 1.15, 1.1);
        this.headGroup.add(helmetBase);
        
        const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.25), armorGold);
        crest.position.set(0, 0.18, -0.02);
        crest.rotation.x = -0.2;
        this.headGroup.add(crest);
        
        // Visor glowing cross
        const visorCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.04), energyMat);
        visorCrossH.position.set(0, 0.02, 0.14);
        this.headGroup.add(visorCrossH);
        
        const visorCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.04), energyMat);
        visorCrossV.position.set(0, 0.02, 0.14);
        this.headGroup.add(visorCrossV);
        
        const visorBack = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.02), innerDark);
        visorBack.position.set(0, 0.02, 0.13);
        this.headGroup.add(visorBack);
        
        // Floating Halo above head
        this.haloGroup = new THREE.Group();
        this.haloGroup.position.y = 0.38;
        this.headGroup.add(this.haloGroup);
        
        this.halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.016, 8, 32), energyMat);
        this.halo.rotation.x = Math.PI / 2;
        this.haloGroup.add(this.halo);
        
        if (isApex) {
            this.halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.012, 8, 32), energyMat.clone());
            this.halo2.material.color.setHex(0xff5500); // deep red-orange outer ring
            this.halo2.material.emissive.setHex(0xff3300);
            this.halo2.rotation.x = (Math.PI / 2) + 0.2;
            this.halo2.rotation.y = 0.15;
            this.haloGroup.add(this.halo2);
            
            // Ray spikes on main halo
            this.raysGroup = new THREE.Group();
            this.halo.add(this.raysGroup);
            const numRays = 8;
            for (let r = 0; r < numRays; r++) {
                const rayAngle = (r / numRays) * Math.PI * 2;
                const ray = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), armorGold);
                ray.position.set(Math.cos(rayAngle) * 0.24, Math.sin(rayAngle) * 0.24, 0);
                ray.rotation.z = rayAngle - Math.PI / 2;
                ray.rotation.x = Math.PI / 2;
                this.raysGroup.add(ray);
            }
        }

        // Shoulders & Pauldrons
        this.shoulders = new THREE.Group(); this.shoulders.position.y = 0.65; this.body.add(this.shoulders);
        
        const pauldronGroupL = new THREE.Group();
        pauldronGroupL.position.set(0.38, 0.08, 0);
        this.shoulders.add(pauldronGroupL);
        const pauldronL = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), armorWhite);
        pauldronL.scale.set(1.2, 0.9, 1);
        pauldronGroupL.add(pauldronL);
        const trimL = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), armorGold);
        trimL.scale.set(1.25, 0.5, 1.05);
        trimL.position.y = -0.04;
        pauldronGroupL.add(trimL);
        
        const pauldronGroupR = new THREE.Group();
        pauldronGroupR.position.set(-0.38, 0.08, 0);
        this.shoulders.add(pauldronGroupR);
        const pauldronR = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), armorWhite);
        pauldronR.scale.set(1.2, 0.9, 1);
        pauldronGroupR.add(pauldronR);
        const trimR = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), armorGold);
        trimR.scale.set(1.25, 0.5, 1.05);
        trimR.position.y = -0.04;
        pauldronGroupR.add(trimR);
        
        if (isApex) {
            this.floatGemL = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), energyMat.clone());
            this.floatGemL.position.set(0, 0.22, 0);
            pauldronGroupL.add(this.floatGemL);
            
            this.floatGemR = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), energyMat.clone());
            this.floatGemR.position.set(0, 0.22, 0);
            pauldronGroupR.add(this.floatGemR);
        }

        // Arms
        const armGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.4);
        
        this.armL = new THREE.Group(); this.armL.position.set(0.36, 0.65, 0); this.body.add(this.armL);
        const upperArmL = new THREE.Mesh(armGeo, innerDark); upperArmL.position.y = -0.15; this.armL.add(upperArmL);
        const bracerL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.22), armorWhite); bracerL.position.y = -0.32; this.armL.add(bracerL);
        const bracerTrimL = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.01, 8, 12), armorGold); bracerTrimL.rotation.x = Math.PI / 2; bracerTrimL.position.y = -0.26; this.armL.add(bracerTrimL);

        this.armR = new THREE.Group(); this.armR.position.set(-0.36, 0.65, 0); this.body.add(this.armR);
        const upperArmR = new THREE.Mesh(armGeo, innerDark); upperArmR.position.y = -0.15; this.armR.add(upperArmR);
        const bracerR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.22), armorWhite); bracerR.position.y = -0.32; this.armR.add(bracerR);
        const bracerTrimR = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.01, 8, 12), armorGold); bracerTrimR.rotation.x = Math.PI / 2; bracerTrimR.position.y = -0.26; this.armR.add(bracerTrimR);

        // Weapon (Solar Glaive / Divine Spear)
        this.weaponGroup = new THREE.Group(); 
        this.weaponGroup.position.set(0, -0.4, 0.15); 
        this.weaponGroup.rotation.x = Math.PI / 2; 
        this.armR.add(this.weaponGroup);
        
        const shaftLength = isApex ? 2.8 : 2.4;
        const spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, shaftLength), armorWhite); 
        spearShaft.position.y = 0.3; 
        this.weaponGroup.add(spearShaft);
        
        // Gold bands on shaft
        for (let s = -0.8; s <= 1.0; s += 0.6) {
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04), armorGold);
            band.position.y = s;
            this.weaponGroup.add(band);
        }
        
        const guardGroup = new THREE.Group(); guardGroup.position.y = shaftLength / 2 + 0.1; this.weaponGroup.add(guardGroup);
        const guardRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 8, 16), armorGold); guardRing.rotation.x = Math.PI / 2; guardGroup.add(guardRing);
        const wingL = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), armorGold); wingL.position.x = 0.11; wingL.rotation.z = -Math.PI / 3; guardGroup.add(wingL);
        const wingR = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), armorGold); wingR.position.x = -0.11; wingR.rotation.z = Math.PI / 3; guardGroup.add(wingR);
        
        if (isApex) {
            this.weaponGuardCore = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), energyMat.clone());
            this.weaponGuardCore.material.color.setHex(0xffea00);
            this.weaponGuardCore.material.emissive.setHex(0xffaa00);
            this.weaponGuardCore.material.emissiveIntensity = 2.0;
            guardGroup.add(this.weaponGuardCore);
        }

        const bladeLength = isApex ? 0.85 : 0.55;
        const bladeGeo = new THREE.ConeGeometry(0.07, bladeLength, 4);
        bladeGeo.scale(1, 1, 0.3); // Flatten
        const customBladeMat = energyMat.clone();
        if (isApex) {
            customBladeMat.color.setHex(0xffea00);
            customBladeMat.emissive.setHex(0xffaa00);
            customBladeMat.emissiveIntensity = 3.0;
        }
        const spearHead = new THREE.Mesh(bladeGeo, customBladeMat); 
        spearHead.position.y = shaftLength / 2 + bladeLength / 2 + 0.15; 
        this.weaponGroup.add(spearHead);
        
        if (isApex) {
            this.floatBladeL = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.35, 4), energyMat.clone());
            this.floatBladeL.geometry.scale(1, 1, 0.25);
            this.floatBladeL.material.color.setHex(0xff5500); // orange-red side floating blade
            this.floatBladeL.material.emissive.setHex(0xff2200);
            this.floatBladeL.position.set(0.14, shaftLength / 2 + 0.3, 0);
            this.floatBladeL.rotation.z = -0.15;
            this.weaponGroup.add(this.floatBladeL);
            
            this.floatBladeR = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.35, 4), energyMat.clone());
            this.floatBladeR.geometry.scale(1, 1, 0.25);
            this.floatBladeR.material.color.setHex(0xff5500);
            this.floatBladeR.material.emissive.setHex(0xff2200);
            this.floatBladeR.position.set(-0.14, shaftLength / 2 + 0.3, 0);
            this.floatBladeR.rotation.z = 0.15;
            this.weaponGroup.add(this.floatBladeR);
        }

        // Seraphic Crystalline Wings
        this.wings = new THREE.Group(); this.wings.position.set(0, 0.75, -0.22); this.body.add(this.wings);
        const numWings = isApex ? 6 : 3;
        
        for (let i = 0; i < numWings; i++) {
            const wingWidth = 0.075 - (i * 0.005);
            const wingLength = isApex ? (1.5 - (i * 0.14)) : (1.15 - (i * 0.15));
            const wingGeo = new THREE.ConeGeometry(wingWidth, wingLength, 4);
            wingGeo.rotateX(Math.PI); // Point down-outwards
            
            const customEnergyMat = energyMat.clone();
            if (isApex) {
                // Alternating golden-yellow and fiery solar orange
                if (i % 2 === 0) {
                    customEnergyMat.color.setHex(0xffea00);
                    customEnergyMat.emissive.setHex(0xffaa00);
                } else {
                    customEnergyMat.color.setHex(0xff5500);
                    customEnergyMat.emissive.setHex(0xff3300);
                }
            }
            
            // Left Wing
            const wL = new THREE.Mesh(wingGeo, customEnergyMat);
            const angleL = -0.32 - (i * (isApex ? 0.22 : 0.35));
            wL.position.set(0.12 + (i * 0.06), i * 0.05, -0.05);
            wL.rotation.set(0.1, 0, angleL);
            wL.userData = { baseRotZ: angleL, baseRotX: 0.1, index: i, side: 'L' };
            this.wings.add(wL);
            
            // Right Wing
            const wR = new THREE.Mesh(wingGeo, customEnergyMat);
            const angleR = 0.32 + (i * (isApex ? 0.22 : 0.35));
            wR.position.set(-0.12 - (i * 0.06), i * 0.05, -0.05);
            wR.rotation.set(0.1, 0, angleR);
            wR.userData = { baseRotZ: angleR, baseRotX: 0.1, index: i, side: 'R' };
            this.wings.add(wR);
        }

        // Apex Orbiting Waist Crystals
        if (isApex) {
            this.orbitGroup = new THREE.Group();
            this.orbitGroup.position.set(0, 0.5, 0);
            this.body.add(this.orbitGroup);
            
            const numCrystals = 3;
            this.orbitCrystals = [];
            for (let c = 0; c < numCrystals; c++) {
                const crystalMat = energyMat.clone();
                crystalMat.color.setHex(0xffea00);
                crystalMat.emissive.setHex(0xffaa00);
                crystalMat.emissiveIntensity = 2.0;
                
                const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), crystalMat);
                this.orbitGroup.add(crystal);
                this.orbitCrystals.push(crystal);
            }
        }
    }

    createLeg(mat1, mat2, mat3, x, y) {
        const group = new THREE.Group(); group.position.set(x, y, 0);
        
        // Thigh
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.35), mat2); 
        thigh.position.y = -0.18; 
        group.add(thigh);
        
        // Knee Guard (rotated box)
        const knee = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.08), mat3); 
        knee.position.set(0, -0.35, 0.06);
        knee.rotation.set(0.2, 0, Math.PI / 4);
        group.add(knee);
        
        // Shin
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.35, 6), mat1);
        shin.position.set(0, -0.52, 0.02);
        shin.rotation.x = 0.05;
        group.add(shin);
        
        // Gold boot trim lining shin
        const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.3, 0.02), mat3);
        bootTrim.position.set(0, -0.5, 0.07);
        bootTrim.rotation.x = 0.05;
        group.add(bootTrim);
        
        // Foot
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), mat1); 
        foot.position.set(0, -0.7, 0.06);
        group.add(foot);
        
        // Golden toe/heel plate
        const toePlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.05), mat3);
        toePlate.position.set(0, -0.7, 0.13);
        group.add(toePlate);
        
        return group;
    }

    animateCharacter(dt) {
        super.animateCharacter(dt);
        const t = Date.now() * 0.001;
        this.wingTime += dt;
        
        if (this.isStunned) return;

        // 1. Idle Bobbing & Tilting (Hover Pose breathing)
        if (this.body) {
            const bob = Math.sin(t * 1.8) * 0.035;
            this.body.position.y = 0.75 + bob + this.animState.spineBend; 
            
            if (!this.animState.rightArmOverride) {
                this.body.rotation.z = Math.sin(t * 0.9) * 0.015;
                this.body.rotation.y = Math.cos(t * 0.7) * 0.01;
            }
        }
        
        // Head bobbing out of phase
        if (this.headGroup) {
            this.headGroup.rotation.x = Math.sin(t * 1.2) * 0.012;
            this.headGroup.rotation.z = Math.cos(t * 0.9) * 0.01;
        }

        // 2. Halo rotations
        if (this.haloGroup) {
            this.haloGroup.position.y = 0.38 + Math.sin(t * 2.2) * 0.015;
            if (this.halo) {
                this.halo.rotation.z += dt * 1.2;
            }
            if (this.halo2) {
                this.halo2.rotation.z -= dt * 0.8;
            }
        }

        // 3. Chest Core pulse
        if (this.chestCore) {
            const pulse = 1.0 + Math.sin(t * 4.0) * 0.12;
            this.chestCore.scale.setScalar(pulse);
        }

        // 4. Wings flapping & casting flare
        if (this.wings) {
            const isMoving = this.isMoving && !this.isAttacking;
            const flapSpeed = isMoving ? 3.8 : 2.0;
            const flapAmp = isMoving ? 0.22 : 0.12;
            
            if (this.isCasting) {
                this.wings.scale.setScalar(THREE.MathUtils.lerp(this.wings.scale.x, 1.35, dt * 5));
            } else {
                this.wings.scale.setScalar(THREE.MathUtils.lerp(this.wings.scale.x, 1.0, dt * 5));
            }
            
            this.wings.children.forEach((wing) => {
                const i = wing.userData.index;
                const phaseOffset = i * 0.45;
                const flap = Math.sin(this.wingTime * flapSpeed - phaseOffset) * flapAmp;
                
                wing.rotation.z = wing.userData.baseRotZ + (wing.userData.side === 'L' ? -flap : flap);
                wing.rotation.x = wing.userData.baseRotX + Math.cos(this.wingTime * flapSpeed - phaseOffset) * 0.08;
                
                if (wing.material && wing.material.opacity !== undefined) {
                    wing.material.opacity = 0.75 + Math.sin(t * 3.0 + i) * 0.15;
                }
            });
        }

        // 5. Elegant Trailing Legs Hover animation (custom override)
        if (this.legL && this.legR) {
            if (this.isMoving) {
                const trailAngle = 0.38 + Math.sin(t * 4) * 0.05;
                this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, trailAngle, dt * 8);
                this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, trailAngle + 0.12, dt * 8);
                
                this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, 0.18, dt * 6);
                
                if (Math.random() < 0.15) {
                    const trailPos = this.position.clone().add(new THREE.Vector3(
                        (Math.random() - 0.5) * 0.3,
                        0.5 + (Math.random() - 0.5) * 0.5,
                        -0.4
                    ));
                    spawnParticles(trailPos, CONFIG.colors.sentinel, 1);
                }
            } else {
                const dangle = Math.sin(t * 1.5) * 0.06;
                this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, dangle, dt * 5);
                this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, -dangle * 0.4, dt * 5);
                
                this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, 0, dt * 5);
            }
        }

        // 6. Arm / Weapon Bobbing
        if (!this.animState.rightArmOverride && !this.isAttacking) {
            const weaponBob = Math.sin(t * 2.2) * 0.025;
            this.weaponGroup.position.y = -0.4 + weaponBob;
            this.weaponGroup.rotation.x = (Math.PI / 2) + Math.cos(t * 1.5) * 0.03;
        }

        // 7. Apex specific cosmetic animations
        if (this.isApexActive) {
            // Waist crystals orbit
            if (this.orbitGroup && this.orbitCrystals) {
                const orbitSpeed = t * 2.2;
                this.orbitCrystals.forEach((crystal, idx) => {
                    const angle = orbitSpeed + (idx * Math.PI * 2 / 3);
                    crystal.position.set(Math.cos(angle) * 0.44, Math.sin(t * 1.8 + idx) * 0.06, Math.sin(angle) * 0.44);
                    crystal.rotation.set(angle, t, angle * 0.5);
                });
            }
            
            // Shoulder float gems bobbing
            if (this.floatGemL && this.floatGemR) {
                const gemBob = 0.22 + Math.sin(t * 2.5) * 0.03;
                this.floatGemL.position.y = gemBob;
                this.floatGemL.rotation.y += dt * 1.5;
                this.floatGemL.rotation.x += dt * 0.5;
                
                this.floatGemR.position.y = gemBob;
                this.floatGemR.rotation.y -= dt * 1.5;
                this.floatGemR.rotation.x += dt * 0.5;
            }
            
            // Weapon guard core pulsing
            if (this.weaponGuardCore) {
                this.weaponGuardCore.scale.setScalar(1.0 + Math.sin(t * 6.0) * 0.15);
            }
            
            // Weapon float blades vibration
            if (this.floatBladeL && this.floatBladeR) {
                const vibration = Math.sin(t * 8.0) * 0.015;
                this.floatBladeL.position.x = 0.14 + vibration;
                this.floatBladeR.position.x = -0.14 - vibration;
            }
        }
    }

    rebuildClassModel() {
        if (this.mesh) {
            this.bodyGroup.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                }
            });
        }
        
        this.createClassModel();
        
        // Unleash brilliant cosmic awakening effect!
        if (this.isApexActive) {
            createSkillVisual('shockwave', this.position, 6.0, 0xffea00);
            createDamageText("ÉVEIL APEX DIVIN", this.position, '#ffea00');
            spawnParticles(this.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 0xffea00, 35);
            AudioSys.play('war_cry', 1.0); // Majestic sound for transformation
        }
    }

    update(dt) {
        if (this.isCasting) { 
            this.speed = 0; 
            this.isMoving = false;
        } else { 
            this.speed = STATE.stats.speed; 
        }
        
        // Apex unlock observer
        const currentApex = STATE.unlockedNodes?.includes('sentinel-apex') || false;
        if (currentApex !== this.isApexActive) {
            this.isApexActive = currentApex;
            this.rebuildClassModel();
        }
        
        super.update(dt);

        this.tickStellarCharge(dt);

        if (this.isLocalPlayer()) {
            updateStellarRayChargeUI({
                amplification: this.stellarChargeAmp,
                isCharging: this.stellarCharging && this.stellarOverchargeMode,
                hasPassive: hasStellarOvercharge(),
                isLocal: true,
            });
        }
        
        // Force isMoving to false again after super updates to prevent any keypress walk triggers while casting
        if (this.isCasting) {
            this.isMoving = false;
        }
    }

    performAttack() {
        if(this.isAttacking || this.isCasting) return;

        this.faceMouse(); 
        this.attackCooldown = this.attackMaxCooldown * (STATE.stats.attackSpeedMod || 1);
        this.isAttacking = true;
        AudioSys.sfx.sentinel.laser();

        const animDuration = 250;
        const start = Date.now();
        this.animState.rightArmOverride = true;

        const attackAnim = () => {
            const elapsed = Date.now() - start;
            if (elapsed >= animDuration) {
                this.isAttacking = false;
                this.animState.rightArmOverride = false;
                this.armR.rotation.set(0, 0, 0);
                this.weaponGroup.rotation.set(Math.PI / 2, 0, 0);
                this.weaponGroup.position.set(0, -0.4, 0.15);
                return;
            }
            const p = elapsed / animDuration;
            
            // Point Glaive forward to fire a ray
            const armAngle = p < 0.25 ? (-Math.PI / 2) * (p / 0.25) : (p < 0.75 ? -Math.PI / 2 : -Math.PI / 2 * (1 - (p - 0.75) / 0.25));
            const weaponAngle = p < 0.25 ? (Math.PI / 2) - (Math.PI / 2) * (p / 0.25) : (p < 0.75 ? 0 : (Math.PI / 2) * ((p - 0.75) / 0.25));
            
            this.armR.rotation.x = armAngle;
            this.weaponGroup.rotation.x = weaponAngle;
            
            // Recoil kickback on weapon
            if (p >= 0.25 && p < 0.55) {
                const recoil = (0.55 - p) / 0.3 * 0.18;
                this.weaponGroup.position.z = 0.15 - recoil;
            } else {
                this.weaponGroup.position.z = 0.15;
            }
            
            requestAnimationFrame(attackAnim);
        }
        attackAnim();

        // FIX: Use Mesh Quaternion
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0; dir.normalize();
        
        if(STATE.multiplayer.active && this.isLocalPlayer()) {
            Network.send({ type: 'net-action', action: 'attack-range', id: STATE.multiplayer.id, pos: this.position, dir: dir, color: CONFIG.colors.sentinel, class: 'sentinel' });
        }

        // Upgraded projectile to look like a brilliant laser ray
        const projGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.5, 8); 
        projGeo.rotateX(-Math.PI / 2); 
        const projMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0xffea00, 
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 0.95
        });
        
        const startPos = this.position.clone().add(new THREE.Vector3(0, 0.8, 0)); 
        Globals.projectiles.push(new Projectile(projGeo, projMat, startPos, dir, 0.8, STATE.stats.atk, 'player', CONFIG.colors.sentinel));
        spawnParticles(startPos, CONFIG.colors.sentinel, 5);
        
        // Spawn shiny muzzle flash at tip of weapon
        const tipPos = this.position.clone().add(new THREE.Vector3(0, 0.8, 0)).add(dir.clone().multiplyScalar(1.4));
        createSkillVisual('shockwave', tipPos, 1.0, 0xffd700);
    }

    beginStellarCharge() {
        if (!hasStellarOvercharge()) return;
        if (this.cooldowns.space > 0 || this.isCasting || this.stellarCharging || this.dead) return;

        this.faceMouse();
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0;
        dir.normalize();

        this.isCasting = true;
        this.stellarCharging = true;
        this.stellarOverchargeMode = true;
        this.stellarChargeElapsed = 0;
        this.stellarChargeAmp = calcStellarRayAmplification(0, true);
        this.stellarChargeDir = dir.clone();
        this.animState.rightArmOverride = true;
    }

    beginNormalStellarCast() {
        if (hasStellarOvercharge()) return;
        if (this.cooldowns.space > 0 || this.isCasting || this.stellarCharging || this.dead) return;

        this.faceMouse();
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0;
        dir.normalize();

        this.isCasting = true;
        this.stellarCharging = true;
        this.stellarOverchargeMode = false;
        this.stellarChargeElapsed = 0;
        this.stellarChargeDir = dir.clone();
        this.animState.rightArmOverride = true;
        createDamageText('CHARGE STELLAIRE...', this.position, '#ffffaa');
    }

    releaseStellarCharge() {
        if (!hasStellarOvercharge() || !this.stellarCharging || !this.stellarOverchargeMode) return;

        const amp = this.stellarChargeAmp;
        const dir = this.stellarChargeDir || new THREE.Vector3(0, 0, 1);
        this.resetStellarChargeState();
        if (this.isLocalPlayer()) hideStellarRayChargeUI();

        this.cooldowns.space = this.maxCooldowns.space * ConstellationEngine.getSkillCdMult('space');
        ConstellationEngine.onSkillUsed('space');

        this.fireStellarBeam(dir, amp);
    }

    finishNormalStellarCast() {
        if (!this.stellarCharging || this.stellarOverchargeMode) return;

        const dir = this.stellarChargeDir || new THREE.Vector3(0, 0, 1);
        this.resetStellarChargeState();

        this.cooldowns.space = this.maxCooldowns.space * ConstellationEngine.getSkillCdMult('space');
        ConstellationEngine.onSkillUsed('space');

        this.fireStellarBeam(dir, STELLAR_AMP_MID);
    }

    resetStellarChargeState() {
        this.stellarCharging = false;
        this.stellarOverchargeMode = false;
        this.stellarChargeElapsed = 0;
        this.stellarChargeDir = null;
        this.stellarChargeAmp = STELLAR_AMP_MIN;
    }

    tickStellarCharge(dt) {
        if (!this.stellarCharging) return;

        const dir = this.stellarChargeDir;
        if (dir) this.faceMouse();

        if (!this.stellarOverchargeMode) {
            this.stellarChargeElapsed += dt;
            const progress = Math.min(1, this.stellarChargeElapsed / STELLAR_NORMAL_CAST_SEC);
            this.runStellarChargeAnim(progress, dir);

            if (this.stellarChargeElapsed >= STELLAR_NORMAL_CAST_SEC) {
                this.finishNormalStellarCast();
            }
            return;
        }

        const maxSec = getStellarChargeMaxSec(true);
        this.stellarChargeElapsed = Math.min(this.stellarChargeElapsed + dt, maxSec);
        this.stellarChargeAmp = calcStellarRayAmplification(this.stellarChargeElapsed, true);
        this.runStellarChargeAnim(this.stellarChargeAmp / STELLAR_AMP_MAX, dir);
    }

    runStellarChargeAnim(ratio, dir) {
        const visualRatio = Math.min(1, ratio);
        this.armR.rotation.x = -Math.PI / 2 - visualRatio * 0.5;
        this.body.rotation.x = -0.3 * visualRatio;
        this.armL.rotation.x = -1.0 * visualRatio;

        if (Math.random() < visualRatio * 0.85) {
            const tipPos = this.position.clone().add(new THREE.Vector3(0, 1.6, 0)).add((dir || new THREE.Vector3(0, 0, 1)).clone().multiplyScalar(-1.0));
            spawnParticles(tipPos, 0xffffaa, 1);
        }
    }

    useSkill(key) {
        if(this.cooldowns[key] > 0 || this.isCasting) return;
        if (key === 'space') {
            if (hasStellarOvercharge()) {
                this.beginStellarCharge();
            } else {
                this.beginNormalStellarCast();
            }
            return;
        }

        this.faceMouse();
        
        // FIX: Direction universelle
        const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);
        dir.y = 0; dir.normalize();
        
        this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);
        ConstellationEngine.onSkillUsed(key);

        if (key === 'shift') {
            AudioSys.sfx.sentinel.field();
            this.animState.rightArmOverride = true;
            const animDur = 500;
            const startTime = Date.now();
            const slamAnim = () => {
                const elapsed = Date.now() - startTime;
                const p = elapsed / animDur;
                if (p >= 1) { 
                    this.animState.rightArmOverride = false; 
                    this.armR.rotation.x = 0; 
                    this.weaponGroup.rotation.x = Math.PI/2; 
                    this.weaponGroup.position.y = -0.4; // Reset to base
                    return; 
                }
                if (p < 0.4) { 
                    this.armR.rotation.x = -Math.PI; 
                    this.weaponGroup.rotation.x = 0; 
                } 
                else if (p < 0.6) { 
                    this.armR.rotation.x = 0.5; 
                    this.weaponGroup.position.y = -0.6; 
                }
                else {
                    this.armR.rotation.x = THREE.MathUtils.lerp(0.5, 0, (p-0.6)/0.4);
                    this.weaponGroup.position.y = THREE.MathUtils.lerp(-0.6, -0.4, (p-0.6)/0.4);
                    this.weaponGroup.rotation.x = THREE.MathUtils.lerp(0, Math.PI/2, (p-0.6)/0.4);
                }
                requestAnimationFrame(slamAnim);
            };
            slamAnim();
            const fieldRadius = ConstellationEngine.getLightFieldRadius();
            const healTick = ConstellationEngine.getLightFieldHealTick();
            const fieldDuration = ConstellationEngine.getLightFieldDuration();
            ConstellationEngine.registerSolarLightField(this.position.clone(), fieldDuration);
            createSkillVisual('vortex', this.position, fieldRadius, 0xf1c40f);
            const zonePos = this.position.clone();
            const ringInner = Math.max(0.5, fieldRadius - 0.5);
            const zone = new THREE.Mesh(new THREE.RingGeometry(ringInner, fieldRadius, 32), new THREE.MeshBasicMaterial({color:0xf1c40f, side:THREE.DoubleSide, transparent:true, opacity:0.5}));
            zone.rotation.x = -Math.PI/2; zone.position.copy(zonePos).add(new THREE.Vector3(0, 0.1, 0));
            this.addLocalVisual(zone, fieldDuration, (m, t) => { 
                m.rotation.z -= 0.02; m.scale.setScalar(1 + Math.sin(t*5)*0.05);
                if (Math.floor(t * 10) !== Math.floor((t + 0.016) * 10)) { 
                     if (!canApplyGameplay()) return;
                     const fieldDmg = ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 0.1, { skill: true, skillKey: 'shift' });
                     Globals.enemies.forEach(e => { if(e.position.distanceTo(zonePos) < fieldRadius) dealDamageToEnemy(e, fieldDmg, { pos: e.position, skillKey: 'shift' }); });
                     if(this.position.distanceTo(zonePos) < fieldRadius) this.heal(healTick);
                }
            });

        } else if (key === 'e') { 
            AudioSys.sfx.sentinel.shield();
            this.animState.rightArmOverride = true;
            const animDur = 600;
            const startTime = Date.now();
            const spinAnim = () => {
                const elapsed = Date.now() - startTime;
                const p = elapsed / animDur;
                if (p >= 1) { 
                    this.animState.rightArmOverride = false; 
                    this.armR.rotation.x = 0; 
                    this.weaponGroup.rotation.z = 0; 
                    this.weaponGroup.position.y = -0.4;
                    return; 
                }
                this.armR.rotation.x = -Math.PI * 0.8;
                this.weaponGroup.rotation.z = p * Math.PI * 4;
                this.weaponGroup.position.y = -0.4;
                requestAnimationFrame(spinAnim);
            };
            spinAnim();
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), new THREE.MeshBasicMaterial({color:0xffff00, wireframe:true, transparent:true, opacity:0.5}));
            sphere.position.copy(this.position);
            this.addLocalVisual(sphere, 5.0, (m, t) => { m.position.copy(this.position); m.rotation.y += 0.02; m.material.opacity = (t/5.0) * 0.5; });
            this.heal(40);
            this.addBuff('Shield', 5, '<i class="fas fa-shield-alt"></i>');
            createDamageText("BOUCLIER DIVIN", this.position, '#ffff00');
        }
    }

    fireStellarBeam(dir, chargeRatio = 1) {
        AudioSys.sfx.sentinel.laser();
        
        let targetPos;
        if (this.isLocalPlayer() && Globals.camera) {
            STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            STATE.raycaster.ray.intersectPlane(plane, intersection);
            targetPos = intersection;
            this.faceMouse();
        } else {
            targetPos = this.position.clone().add(dir.clone().multiplyScalar(15.0));
        }

        const recoilAnim = () => {
            this.body.rotation.x = 0.5; this.armR.rotation.x = 0.5; 
            setTimeout(() => {
                this.body.rotation.x = 0; this.armR.rotation.x = 0; this.armL.rotation.x = 0; 
                this.isCasting = false; this.animState.rightArmOverride = false;
            }, 200);
        };
        recoilAnim();

        const beamMods = ConstellationEngine.getStellarBeamKeystoneMods();
        let hitRadius = 4.0 * beamMods.sizeMult;
        if (hasStellarRangeBonus(chargeRatio)) {
            hitRadius *= STELLAR_RANGE_BONUS_MULT;
        }
        const beamThickness = 0.6 * beamMods.sizeMult;
        const beamDmg = ConstellationEngine.calcStellarBeamDamage(this, chargeRatio);

        if (STATE.multiplayer.active && this.isLocalPlayer()) {
            Network.send({
                type: 'net-action',
                action: 'skill',
                key: 'space',
                class: 'sentinel',
                id: STATE.multiplayer.id,
                pos: this.position,
                dir,
                chargeRatio,
            });
        }

        const startPos = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        const dist = startPos.distanceTo(targetPos);
        const midPos = startPos.clone().lerp(targetPos, 0.5);

        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(beamThickness, beamThickness, dist, 8), 
            new THREE.MeshBasicMaterial({color:0xffffaa, emissive:0xffffff})
        );
        beam.position.copy(midPos);
        beam.lookAt(targetPos);
        beam.rotateX(Math.PI / 2); 
        
        const beamGrow = beamMods.sizeMult > 1 ? 1.75 : 1.5;
        const beamDuration = beamMods.sizeMult > 1 ? 0.5 : 0.4;
        this.addLocalVisual(beam, beamDuration, (m, t) => { 
            const p = t / beamDuration;
            m.scale.x = m.scale.z = p * beamGrow;
            m.material.opacity = p;
        });

        createSkillVisual('shockwave', targetPos, hitRadius, 0xffffaa); 
        const blastRing = new THREE.Mesh(
            new THREE.RingGeometry(0.5 * beamMods.sizeMult, hitRadius, 32),
            new THREE.MeshBasicMaterial({color: 0xffffaa, transparent: true, opacity: 0.8, side: THREE.DoubleSide})
        );
        blastRing.rotation.x = -Math.PI / 2;
        blastRing.position.copy(targetPos).add(new THREE.Vector3(0, 0.1, 0));
        this.addLocalVisual(blastRing, 0.5, (m, t) => { m.scale.setScalar(1 + (0.5 - t) * 4 * beamMods.sizeMult); m.material.opacity = t * 2; });
        if (beamMods.sizeMult > 1) {
            createDamageText('SUPERNOVA', targetPos, '#ffcc00');
            spawnParticles(targetPos, 0xffaa00, 28);
        }
        
        Globals.enemies.forEach(e => {
            if(e.position.distanceTo(targetPos) < hitRadius) { 
                const dmg = beamDmg * ConstellationEngine.getStellarSingularityBeamDamageMult(e);
                const wasAlive = !e.dead;
                dealDamageToEnemy(e, dmg, { pos: e.position, skillKey: 'space', isRanged: true });
                if (wasAlive && e.dead && ConstellationEngine.hasSolarWellCurse()) {
                    const wellPos = e.position.clone();
                    const created = ConstellationEngine.registerStellarSingularityWell(wellPos);
                    if (created && STATE.multiplayer.active && STATE.multiplayer.isHost) {
                        Network.send({
                            type: 'sentinel-light-well',
                            pos: { x: wellPos.x, y: wellPos.y, z: wellPos.z },
                            duration: ConstellationEngine.getLightFieldDuration(),
                        });
                    }
                }
                spawnParticles(e.position, 0xf1c40f, beamMods.sizeMult > 1 ? 22 : 15);
                e.pushBack(targetPos, 5 * beamMods.sizeMult); 
            }
        });
        if (chargeRatio > STELLAR_AMP_MIN + 0.001) {
            createDamageText(`${(chargeRatio * 100).toFixed(2)}%`, this.position, '#ffcc00');
        }
        PassiveKeystoneHooks.onSentinelBeamFired(this);
    }
}
