// @ts-nocheck
import { PlayerBase } from '../player_base';
import { UI } from '../../visual/ui';
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
import { canApplyGameplay, canDealDamageDirectly, sendSkillIntent, shouldSendSkillIntent } from '../../multiplayer/net_authority';
import {
  applyPicDeLuneDisplacement,
  applySolarBurn,
  getEclipseLanceDamageMult,
  hasDualiteCeleste,
  incrementRuptureLanceStack,
  isEclipseCataclysmWindow,
} from './eclipse/eclipseRupture';
import {
  applyLunarTideHeal,
  triggerSolarExplosion,
} from './eclipse/eclipseKeystones';
import {
  calcLanceChargeRangeBonus,
  consumeFulguranceDamageBonus,
  hasEclipseCrown,
  isValidChargedLanceRelease,
  LANCE_CHARGE_MAX_SEC,
  LANCE_CHARGE_MIN_SEC,
  recordFulguranceTargets,
} from './eclipse/eclipseLanceCharge';
import {
  hideEclipseLanceChargeUI,
  updateEclipseLanceChargeUI,
} from './eclipse/eclipseLanceChargeUi';

export class Eclipse extends PlayerBase {
    // ... (Reste du code inchangé) ...
    constructor() {
        super('eclipse');
        this.eclipse = { sun: 0, moon: 0, nextIsSun: true, active: false };
        this.createClassModel();
        this.applyClassStats();
        this.invulnerable = false;
        this.isCasting = false;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashDir = new THREE.Vector3();
        this.dashHitSet = new Set();
        this.eSkillCastTimer = 0;
        this.shiftSkillCastTimer = 0;
        this._ruptureStacks = 0;
        this._cataclysmWindowUntil = 0;
        this._solarSparks = 0;
        this.lastFulguranceTargetsHit = 0;
        this.lanceCharging = false;
        this.lanceChargeElapsed = 0;
        this.lanceChargeDir = null;
        this.attackAnimTime = 0;
        this.dashComboCount = 0;
        this.dashShield = null;
        this.ascensionTime = 0;
        this._ascensionHpLossTriggered = false;
    }

    createArm(sideSign, voidMat, goldMat, silverMat, sunMat, moonMat) {
        const group = new THREE.Group();
        group.position.set(sideSign * 0.42, 0.2, 0); // attached to body

        const isSolar = (sideSign === -1);
        const armorMat = voidMat; // Main plates are black steel
        const trimMat = isSolar ? goldMat : silverMat; // goldMat holds sunTrim, silverMat holds moonTrim
        const gemMat = isSolar ? sunMat : moonMat;

        // Épaulières royales : concentric plates with royal details
        const pauldronGeo = new THREE.SphereGeometry(0.19, 10, 10, 0, Math.PI);
        const pauldron = new THREE.Mesh(pauldronGeo, armorMat);
        pauldron.position.set(0, 0.12, 0);
        pauldron.rotation.z = sideSign * 0.3;
        group.add(pauldron);

        const pauldronTrim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 12, Math.PI), trimMat);
        pauldronTrim.position.set(0, 0.12, 0);
        pauldronTrim.rotation.z = sideSign * 0.3;
        group.add(pauldronTrim);

        // Concentric Shoulder Astrolabe Rings (Spinning rings)
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 4, 16), trimMat);
        ring1.position.set(0, 0.12, 0);
        group.add(ring1);

        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.006, 4, 16), gemMat);
        ring2.position.set(0, 0.12, 0);
        ring2.rotation.x = Math.PI / 2;
        group.add(ring2);

        // Upper arm (Sleeve)
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.25, 8), voidMat);
        upper.position.y = -0.05;
        group.add(upper);

        // Elbow pad
        const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), trimMat);
        elbow.position.y = -0.18;
        group.add(elbow);

        // Forearm with detailed plates (Plaques solaires/lunaires)
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.25, 8), armorMat);
        lower.position.y = -0.32;
        group.add(lower);

        // Solar / Lunar plate on forearm
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.035), trimMat);
        plate.position.set(0, -0.32, sideSign * 0.048);
        plate.rotation.y = sideSign * 0.1;
        group.add(plate);

        const plateDecor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), gemMat);
        plateDecor.position.set(0, -0.32, sideSign * 0.06);
        group.add(plateDecor);

        // Gauntlet hand (Gantelets impériaux)
        const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.085), trimMat);
        gauntlet.position.set(0, -0.46, 0);
        group.add(gauntlet);

        const gauntletCuff = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 4, 12), armorMat);
        gauntletCuff.position.set(0, -0.41, 0);
        gauntletCuff.rotation.x = Math.PI / 2;
        group.add(gauntletCuff);

        // Imperial gauntlet gem
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), gemMat);
        gem.position.set(sideSign * 0.04, -0.46, 0.025);
        group.add(gem);

        group.userData = {
            ring1,
            ring2
        };

        return group;
    }

    createLeg(sideSign, voidMat, goldMat, silverMat, sunMat, moonMat) {
        const group = new THREE.Group();
        group.position.set(sideSign * 0.2, 0.75, 0);

        const isSolar = (sideSign === -1);
        const plateMat = voidMat; // Main plates are black steel
        const trimMat = isSolar ? goldMat : silverMat; // goldMat holds sunTrim, silverMat holds moonTrim
        const gemMat = isSolar ? sunMat : moonMat;

        // Thigh (Heavy armor leg base)
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.35, 8), voidMat);
        thigh.position.y = -0.17;
        group.add(thigh);

        // Heavy thigh plate
        const thighPlate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.3, 0.07), plateMat);
        thighPlate.position.set(0, -0.17, 0.05);
        group.add(thighPlate);

        // Knee joint (detailed gold/silver sphere & guards)
        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), trimMat);
        knee.position.y = -0.35;
        group.add(knee);

        const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.04), plateMat);
        kneeCap.position.set(0, -0.35, 0.06);
        group.add(kneeCap);

        // Shin (Cylinder + heavy plates)
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.35, 8), voidMat);
        shin.position.y = -0.52;
        group.add(shin);

        // Heavy shin plate
        const shinPlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.07), trimMat);
        shinPlate.position.set(0, -0.52, 0.06);
        group.add(shinPlate);

        // Boot (Royal boots)
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.2), plateMat);
        boot.position.set(0, -0.73, 0.04);
        group.add(boot);

        // Royal Boot Trim
        const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.21), trimMat);
        bootTrim.position.set(0, -0.78, 0.04);
        group.add(bootTrim);

        // Glowing boot sole
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.19), gemMat);
        sole.position.set(0, -0.8, 0.04);
        group.add(sole);

        // Floating Repulsor ring under boot sole
        const thruster = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.01, 4, 12), trimMat);
        thruster.rotation.x = Math.PI / 2;
        thruster.position.set(0, -0.84, 0.04);
        group.add(thruster);

        const energyPad = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 8), gemMat);
        energyPad.position.set(0, -0.835, 0.04);
        group.add(energyPad);

        // Floating projection ring (Boot Thruster Waves)
        const waveMat1 = new THREE.MeshBasicMaterial({
            color: isSolar ? 0xffaa00 : 0xaa00ff,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending
        });
        const thrusterWave1 = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.005, 4, 8), waveMat1);
        thrusterWave1.rotation.x = Math.PI / 2;
        thrusterWave1.position.set(0, -0.86, 0.04);
        group.add(thrusterWave1);

        const waveMat2 = new THREE.MeshBasicMaterial({
            color: isSolar ? 0xffaa00 : 0xaa00ff,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending
        });
        const thrusterWave2 = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.005, 4, 8), waveMat2);
        thrusterWave2.rotation.x = Math.PI / 2;
        thrusterWave2.position.set(0, -0.86, 0.04);
        group.add(thrusterWave2);

        group.userData = {
            thruster,
            energyPad,
            thrusterWave1,
            thrusterWave2
        };

        return group;
    }

    createClassModel() {
        // --- COLOUR PALETTE ---
        const voidMat = new THREE.MeshStandardMaterial({ 
            color: 0x07070d, // Deep shiny black steel
            roughness: 0.15, 
            metalness: 0.9,
            name: 'original'
        });
        
        const goldMat = new THREE.MeshStandardMaterial({ 
            color: 0xffa500, // Sun orange-gold
            roughness: 0.18, 
            metalness: 1.0,
            emissive: 0x552200,
            name: 'original'
        });

        const silverMat = new THREE.MeshStandardMaterial({ 
            color: 0x94a3b8, // Moon silver-blue steel
            roughness: 0.18, 
            metalness: 1.0,
            emissive: 0x111133,
            name: 'original'
        });

        const sunEmissive = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0xffaa00,
            emissiveIntensity: 2.5,
            roughness: 0.1,
            name: 'original'
        });
        
        const moonEmissive = new THREE.MeshStandardMaterial({ 
            color: 0xaa88ff, 
            emissive: 0x6600ee,
            emissiveIntensity: 2.7,
            roughness: 0.1,
            name: 'original'
        });

        this.mesh = new THREE.Group();
        this.bodyGroup.add(this.mesh);

        // --- CORPS PRINCIPAL (Torso / Waist / Chest) ---
        this.body = new THREE.Group();
        this.body.position.y = 0.85;
        this.mesh.add(this.body);

        // Torso armor plate base (Black and Gold)
        const torsoBase = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.16, 0.55, 8), voidMat);
        this.body.add(torsoBase);

        // Detailed Chest Plate (Front & Back - Soleil et Lune)
        const chestPlateF_Sun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.08), goldMat);
        chestPlateF_Sun.position.set(-0.06, 0.05, 0.12);
        chestPlateF_Sun.rotation.x = 0.08;
        this.body.add(chestPlateF_Sun);

        const chestPlateF_Moon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.08), silverMat);
        chestPlateF_Moon.position.set(0.06, 0.05, 0.12);
        chestPlateF_Moon.rotation.x = 0.08;
        this.body.add(chestPlateF_Moon);

        const chestPlateB = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.06), voidMat);
        chestPlateB.position.set(0, 0.05, -0.12);
        this.body.add(chestPlateB);

        // Eclipse Chest Core (Soleil & Lune)
        const coreBorderSun = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 12, Math.PI), goldMat);
        coreBorderSun.position.set(0, 0.06, 0.16);
        coreBorderSun.rotation.x = 0.08;
        coreBorderSun.rotation.z = Math.PI;
        this.body.add(coreBorderSun);

        const coreBorderMoon = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 12, Math.PI), silverMat);
        coreBorderMoon.position.set(0, 0.06, 0.16);
        coreBorderMoon.rotation.x = 0.08;
        coreBorderMoon.rotation.z = 0;
        this.body.add(coreBorderMoon);

        this.coreGem = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), sunEmissive);
        this.coreGem.position.set(0, 0.06, 0.16);
        this.body.add(this.coreGem);

        // Col / Gorget (Solar & Lunar Collar)
        const collarSun = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.15, 8, 1, true, 0, Math.PI), goldMat);
        collarSun.position.set(0, 0.3, 0);
        collarSun.rotation.y = Math.PI / 2;
        this.body.add(collarSun);

        const collarMoon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.15, 8, 1, true, Math.PI, Math.PI), silverMat);
        collarMoon.position.set(0, 0.3, 0);
        collarMoon.rotation.y = Math.PI / 2;
        this.body.add(collarMoon);

        // Ceinture (Waist Ornaments: Soleil & Lune)
        const beltSun = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.035, 6, 16, Math.PI), goldMat);
        beltSun.position.set(0, -0.22, 0);
        beltSun.rotation.x = Math.PI / 2;
        beltSun.rotation.z = Math.PI; // left side
        this.body.add(beltSun);

        const beltMoon = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.035, 6, 16, Math.PI), silverMat);
        beltMoon.position.set(0, -0.22, 0);
        beltMoon.rotation.x = Math.PI / 2;
        beltMoon.rotation.z = 0; // right side
        this.body.add(beltMoon);

        // Belt plates hanging (tassets)
        this.tassets = [];
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const isSolar = (Math.cos(angle) < 0); // left side represents Sun
            const tassetTrimMat = isSolar ? goldMat : silverMat;
            
            const tasset = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.02), voidMat);
            const tassetTrim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.025), tassetTrimMat);
            tassetTrim.position.y = -0.08;
            tasset.add(tassetTrim);

            const tassetGem = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), isSolar ? sunEmissive : moonEmissive);
            tassetGem.position.set(0, -0.04, 0.015);
            tasset.add(tassetGem);

            tasset.position.set(Math.cos(angle) * 0.22, -0.32, Math.sin(angle) * 0.22);
            tasset.rotation.y = -angle + Math.PI / 2;
            tasset.rotation.x = 0.12; // Flared out
            this.body.add(tasset);
            this.tassets.push(tasset);
        }

        // --- BRAS (Solar & Lunar) ---
        this.armL = this.createArm(-1, voidMat, goldMat, silverMat, sunEmissive, moonEmissive);
        this.armR = this.createArm(1, voidMat, goldMat, silverMat, sunEmissive, moonEmissive);
        this.body.add(this.armL);
        this.body.add(this.armR);

        // --- JAMBES & Pieds (Heavy Armor & Royal Boots) ---
        this.legL = this.createLeg(-1, voidMat, goldMat, silverMat, sunEmissive, moonEmissive);
        this.legR = this.createLeg(1, voidMat, goldMat, silverMat, sunEmissive, moonEmissive);
        this.mesh.add(this.legL);
        this.mesh.add(this.legR);

        // --- TÊTE (Casque & Couronne d'éclipse) ---
        this.headGroup = new THREE.Group();
        this.headGroup.position.y = 0.45;
        this.body.add(this.headGroup);

        // Casque Dodecahedron (Armure noire et dorée)
        const helmet = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), voidMat);
        this.headGroup.add(helmet);

        const helmetTrimL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.182), goldMat);
        helmetTrimL.scale.set(1.0, 0.15, 1.0);
        this.headGroup.add(helmetTrimL);

        const helmetTrimR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.182), silverMat);
        helmetTrimR.scale.set(0.98, 0.15, 0.98);
        this.headGroup.add(helmetTrimR);
        
        // Visière lumineuse fente (incandescente)
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.2), sunEmissive);
        visor.position.set(0, 0, 0.11);
        this.headGroup.add(visor);

        // Couronne : Halo d'Éclipse (Rotating concentric rings)
        this.haloSun = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.015, 8, 32), goldMat);
        this.haloMoon = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 8, 24, Math.PI * 1.3), moonEmissive);
        this.haloSun.rotation.x = Math.PI/2; this.haloMoon.rotation.x = Math.PI/2;
        this.haloSun.rotation.y = 0.15; this.haloMoon.rotation.y = -0.15;
        this.haloSun.position.y = 0.28; this.haloMoon.position.y = 0.28;
        this.headGroup.add(this.haloSun);
        this.headGroup.add(this.haloMoon);

        // Solar spikes for crown (Left side representing Sun)
        for (let i = 0; i < 4; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), sunEmissive);
            const angle = Math.PI * 0.75 + (i / 4) * Math.PI; // left hemisphere
            spike.position.set(Math.cos(angle) * 0.28, 0.28, Math.sin(angle) * 0.28);
            spike.rotation.x = Math.PI/2;
            spike.rotation.z = angle - Math.PI/2;
            this.headGroup.add(spike);
        }

        // Side Lunar horns for crown/casque (Right side representing Moon)
        for (let side of [1]) {
            const horn = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 4, 12, Math.PI), moonEmissive);
            horn.position.set(side * 0.19, 0.08, 0);
            horn.rotation.z = -side * Math.PI / 4;
            horn.rotation.y = Math.PI / 2;
            this.headGroup.add(horn);
        }

        // --- CAPE: Noire à bord incandescent ---
        this.cape = new THREE.Group();
        this.cape.position.set(0, 0.2, -0.14);
        this.body.add(this.cape);

        const capeFabricMat = new THREE.MeshStandardMaterial({
            color: 0x050508, 
            roughness: 0.6, 
            metalness: 0.1, 
            side: THREE.DoubleSide,
            name: 'original'
        });

        // Segmented Cape - Center Panel
        this.capePanelC = new THREE.Group();
        this.capePanelC.position.set(0, 0, 0);
        this.cape.add(this.capePanelC);

        const capeBaseC = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.01), capeFabricMat);
        capeBaseC.position.set(0, -0.47, 0);
        this.capePanelC.add(capeBaseC);

        const borderBC = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.012), goldMat);
        borderBC.position.set(0, -0.96, 0);
        this.capePanelC.add(borderBC);

        // Segmented Cape - Left Panel
        this.capePanelL = new THREE.Group();
        this.capePanelL.position.set(-0.16, 0, 0);
        this.capePanelL.rotation.y = -0.15;
        this.cape.add(this.capePanelL);

        const capeBaseL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.93, 0.01), capeFabricMat);
        capeBaseL.position.set(0, -0.46, 0);
        this.capePanelL.add(capeBaseL);

        const borderLL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.93, 0.012), sunEmissive);
        borderLL.position.set(-0.08, -0.46, 0);
        this.capePanelL.add(borderLL);

        const borderBL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.012), goldMat);
        borderBL.position.set(-0.01, -0.94, 0);
        this.capePanelL.add(borderBL);

        // Segmented Cape - Right Panel
        this.capePanelR = new THREE.Group();
        this.capePanelR.position.set(0.16, 0, 0);
        this.capePanelR.rotation.y = 0.15;
        this.cape.add(this.capePanelR);

        const capeBaseR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.93, 0.01), capeFabricMat);
        capeBaseR.position.set(0, -0.46, 0);
        this.capePanelR.add(capeBaseR);

        const borderRR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.93, 0.012), moonEmissive);
        borderRR.position.set(0.08, -0.46, 0);
        this.capePanelR.add(borderRR);

        const borderBR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.012), goldMat);
        borderBR.position.set(0.01, -0.94, 0);
        this.capePanelR.add(borderBR);

        // --- ACCESSOIRE APEX: Disque d'éclipse derrière le dos ---
        this.apexDisc = new THREE.Group();
        this.apexDisc.position.set(0, 0.05, -0.32);
        this.body.add(this.apexDisc);

        const discOuter = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.03, 8, 32), goldMat);
        this.apexDisc.add(discOuter);

        const discCenter = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), voidMat);
        this.apexDisc.add(discCenter);

        // Inner glowing moon crescent torus overlay
        const innerCrescent = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 6, 24, Math.PI * 1.3), moonEmissive);
        innerCrescent.rotation.z = Math.PI / 4;
        this.apexDisc.add(innerCrescent);
        this.apexCrescent = innerCrescent;

        // Spikes on Apex disc
        for (let i = 0; i < 8; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 4), sunEmissive);
            const angle = (i / 8) * Math.PI * 2;
            spike.position.set(Math.cos(angle) * 0.42, 0, Math.sin(angle) * 0.42);
            spike.rotation.x = Math.PI / 2;
            spike.rotation.z = angle - Math.PI / 2;
            this.apexDisc.add(spike);
        }

        // --- ARME: Grand bâton Lune et Soleil combinée (Lance) ---
        this.weaponGroup = new THREE.Group();
        this.weaponGroup.position.set(0.55, 0.2, 0.1);
        this.body.add(this.weaponGroup);

        const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.5, 8), voidMat);
        this.weaponGroup.add(staff);

        // Sleeves on handle (Sun and Moon themed)
        for (let y of [-0.6, -0.2]) {
            const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 8), goldMat); // goldMat is sunTrim
            sleeve.position.y = y;
            this.weaponGroup.add(sleeve);
        }
        for (let y of [0.2, 0.6]) {
            const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 8), silverMat); // silverMat is moonTrim
            sleeve.position.y = y;
            this.weaponGroup.add(sleeve);
        }

        // Top end: Sun Crest
        const sunRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 16), goldMat);
        sunRing.position.y = 1.3;
        this.weaponGroup.add(sunRing);

        const sunCenter = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), sunEmissive);
        sunCenter.position.copy(sunRing.position);
        this.weaponGroup.add(sunCenter);

        // Lance sharp tip
        const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 8), silverMat); // silverMat is moonTrim/steel
        spearTip.position.y = 1.6;
        this.weaponGroup.add(spearTip);

        for (let i = 0; i < 4; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 4), sunEmissive);
            const angle = (i / 4) * Math.PI + Math.PI/4;
            spike.position.set(Math.cos(angle) * 0.24, 1.3, Math.sin(angle) * 0.24);
            spike.rotation.x = Math.PI/2;
            spike.rotation.z = angle - Math.PI/2;
            this.weaponGroup.add(spike);
        }

        // Bottom end: Moon Crest
        const moonCrescent = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 16, Math.PI * 1.2), moonEmissive);
        moonCrescent.position.y = -1.3;
        moonCrescent.rotation.z = Math.PI / 2; // sickle shape orientation
        this.weaponGroup.add(moonCrescent);

        const moonCenter = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), moonEmissive);
        moonCenter.position.set(0, -1.3, 0);
        this.weaponGroup.add(moonCenter);

        // Save original material colors/properties for visual state resetting (Apocalypse)
        this.mesh.traverse(c => {
            if(c.isMesh && c.material) {
                c.userData.baseColor = c.material.color.getHex();
                c.userData.baseEmissive = c.material.emissive ? c.material.emissive.getHex() : 0x000000;
                c.userData.baseEmissiveIntensity = c.material.emissiveIntensity || 1.0;
                c.userData.baseRoughness = c.material.roughness;
                c.userData.baseMetalness = c.material.metalness;
            }
        });
    }

    // Gestion du mouvement bloqué lors des animations critiques
    update(dt) {
        if (this.isCasting) {
             this.speed = 0; // Le joueur est enraciné
        } else {
             this.speed = STATE.stats.speed; 
        }

        if (this.eSkillCastTimer > 0) {
            this.eSkillCastTimer -= dt;
            if (this.eSkillCastTimer < 0) this.eSkillCastTimer = 0;
        }
        if (this.shiftSkillCastTimer > 0) {
            this.shiftSkillCastTimer -= dt;
            if (this.shiftSkillCastTimer < 0) this.shiftSkillCastTimer = 0;
        }

        if (!this.isDashing && this.dashShield) {
            this.mesh.remove(this.dashShield);
            this.dashShield = null;
        }

        if (this.isDashing) {
            this.dashTimer -= dt;
            const dashSpeed = 45.0; // Vitesse élevée
            
            // Spin the dash shield if it exists
            if (this.dashShield) {
                this.dashShield.rotation.z += dt * 10.0;
            }

            // Déplacement
            const moveStep = this.dashDir.clone().multiplyScalar(dashSpeed * dt);
            this.position.add(moveStep);
            
            const targetRot = Math.atan2(this.dashDir.x, this.dashDir.z);
            this.mesh.rotation.y = targetRot;

            this.resolveCollisions(); 

            // Damage enemies hit during dash
            const damage = ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 1.5, { skill: true, skillKey: 'space' });
            const solar = PassiveKeystoneHooks.getSolarFlareMods();
            
            Globals.enemies.forEach(e => {
                if (this.dashHitSet.has(e) || e.dead) return;
                
                if (e.position.distanceTo(this.position) < 2.5) {
                    this.dashHitSet.add(e);
                    dealDamageToEnemy(e, damage, { pos: e.position });
                    spawnParticles(e.position, 0xffaa00, 5);
                    
                    // Stun the enemy!
                    if (!e.dead) {
                        const originalSpeed = e.speed;
                        e.speed = 0;
                        createDamageText("STUN", e.position, '#ffa500');
                        
                        // Add stun stars visually
                        const stunVisual = new THREE.Mesh(
                            new THREE.TorusGeometry(0.4, 0.03, 4, 12),
                            new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.8 })
                        );
                        stunVisual.position.set(0, (e.radius || 1.0) * 2.2, 0);
                        stunVisual.rotation.x = Math.PI / 2;
                        e.add(stunVisual);

                        setTimeout(() => {
                            if (!e.dead) {
                                e.speed = originalSpeed;
                            }
                            e.remove(stunVisual);
                            stunVisual.geometry.dispose();
                            stunVisual.material.dispose();
                        }, 1500); // 1.5 seconds stun
                    }

                    // Apply Burn
                    for (let t = 1; t <= solar.dotTicks; t++) {
                        setTimeout(() => {
                            if (!e.dead && canApplyGameplay()) {
                                dealDamageToEnemy(e, damage * solar.dotMult, { pos: e.position, noCrit: true, skillKey: 'space' });
                                createDamageText('BRÛLURE', e.position, '#ffaa00');
                            }
                        }, t * 1000);
                    }
                }
            });

            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.invulnerable = false;
                recordFulguranceTargets(this, this.dashHitSet.size);
                this.explodeDashShield();
            }
        }

        this.tickLanceCharge(dt);

        if (this.isLocalPlayer()) {
            updateEclipseLanceChargeUI(this.lanceChargeElapsed, this.lanceCharging);
        }

        super.update(dt);
    }

    explodeDashShield() {
        if (this.dashShield) {
            this.mesh.remove(this.dashShield);
            this.dashShield = null;
        }

        // Play explosion sound
        AudioSys.sfx.warrior.smash();

        // Visual explosion
        createSkillVisual('explosion', this.position, 4.0, 0xffaa00);
        spawnParticles(this.position, 0xff5500, 25);

        // Explosion damage to surrounding enemies
        if (canDealDamageDirectly()) {
            const explosionDmg = ConstellationEngine.modifyDamageDealt(
                STATE.stats.atk * 2.0, 
                { skill: true, skillKey: 'space' }
            );
            Globals.enemies.forEach(e => {
                if (e.dead) return;
                if (e.position.distanceTo(this.position) <= 4.0) {
                    dealDamageToEnemy(e, explosionDmg, { pos: e.position, skillKey: 'space' });
                    spawnParticles(e.position, 0xffaa00, 8);
                    e.pushBack(this.position, 2.5);
                }
            });
        }
    }

    updateClassPassives(dt) {
        if(!this.eclipse.active && this.eclipse.sun >= 100 && this.eclipse.moon >= 100) {
            this.eclipse.active = true;
            createDamageText("ÉCLIPSE TOTALE", this.position, '#ffffff');
            createSkillVisual('shockwave', this.position, 6, 0xffffff);
        }

        if (this.isLocalPlayer() && this.eclipse.active) {
            if (!hasDualiteCeleste()) {
                this.ascensionTime = (this.ascensionTime || 0) + dt;
                if (this.ascensionTime >= 5.0) {
                    if (!this._ascensionHpLossTriggered) {
                        this._ascensionHpLossTriggered = true;
                        createDamageText("SURCHARGE", this.position, '#ff3300');
                        createSkillVisual('shockwave', this.position, 4.0, 0xff3300);
                        spawnParticles(this.position, 0xff3300, 25);
                    }
                    const hpLoss = 3 * dt;
                    this.hp = Math.max(0, this.hp - hpLoss);
                    if (this.hp <= 0 && !this.dead) {
                        this.hp = 0;
                        this.die();
                    }
                    UI.updateHUD();
                }
            }
        } else if (!this.eclipse.active) {
            this.ascensionTime = 0;
            this._ascensionHpLossTriggered = false;
        }

        const resourceEl = document.getElementById('class-resource');
        if (resourceEl) {
            const sunColor = this.eclipse.sun >= 100 ? '#ffcc00' : '#ffa800'; 
            const moonColor = this.eclipse.moon >= 100 ? '#a3b1cc' : '#5dade2'; 
            const nextText = this.eclipse.nextIsSun ? '<span style="color:#ffcc00; font-weight:700;">SOLAIRE</span>' : '<span style="color:#a3b1cc; font-weight:700;">LUNAIRE</span>';
            
            let html = '';
            if (this.eclipse.active) {
                html = `<div style="color:#ffffff; font-family:'Cinzel', serif; font-size:10px; font-weight:700; text-align:center; animation: pulse 1s infinite ease-in-out; text-shadow: 0 0 12px #ffaa00; width:100%; letter-spacing:2px;"><i class="fas fa-yin-yang"></i> ✦ ASCENSION ✦</div>`;
            } else {
                html = `
                    <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-family:'Cinzel', serif; font-size:9px; font-weight:700; color:rgba(255,255,255,0.6);">
                            <span>ALIGNEMENT</span>
                            <span>${nextText}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; gap:12px; width:100%;">
                            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                                <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:700; color:${sunColor};">
                                    <span>☀ SOLEIL</span>
                                    <span>${Math.floor(this.eclipse.sun)}%</span>
                                </div>
                                <div style="width:100%; height:3px; background:rgba(0,0,0,0.5); border-radius:1.5px; overflow:hidden;">
                                    <div style="width:${Math.min(100, this.eclipse.sun)}%; height:100%; background:${sunColor}; box-shadow:0 0 4px ${sunColor};"></div>
                                </div>
                            </div>
                            <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                                <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:700; color:${moonColor};">
                                    <span>☾ LUNE</span>
                                    <span>${Math.floor(this.eclipse.moon)}%</span>
                                </div>
                                <div style="width:100%; height:3px; background:rgba(0,0,0,0.5); border-radius:1.5px; overflow:hidden;">
                                    <div style="width:${Math.min(100, this.eclipse.moon)}%; height:100%; background:${moonColor}; box-shadow:0 0 4px ${moonColor};"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            resourceEl.innerHTML = html;
            resourceEl.style.display = 'block';
        }
    }

    animateCharacter(dt) {
        this.animTime = (this.animTime || 0) + dt * 10;
        const t = Date.now() * 0.001;

        if (this.isStunned) {
            if (this.bodyGroup) {
                this.bodyGroup.rotation.z = Math.sin(this.animTime * 0.5) * 0.15;
                this.bodyGroup.rotation.x = Math.cos(this.animTime * 0.3) * 0.15;
            }
            if (this.legL) this.legL.rotation.x = 0;
            if (this.legR) this.legR.rotation.x = 0;
            return;
        } else {
            if (this.bodyGroup) {
                this.bodyGroup.rotation.z = 0;
                this.bodyGroup.rotation.x = 0;
            }
        }

        // 1. Marche & Respiration (Non-levitation ground bobbing)
        if (this.isMoving) {
            // Body bobs up and down with walking steps
            const walkBob = Math.abs(Math.sin(this.animTime * 2.0)) * 0.12;
            if (this.mesh) {
                this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, walkBob, dt * 8);
            }
            
            // Audio sound effect for steps
            this.stepTimer = (this.stepTimer || 0) + dt;
            if (this.stepTimer > 0.32) {
                AudioSys.sfx.step();
                this.stepTimer = 0;
            }
        } else {
            // Returns to absolute ground zero
            if (this.mesh) {
                this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, 0, dt * 5);
            }
        }

        // 2. Torso breathing, tilting, and unified action animations
        let targetBodyPosY = 0.85;
        let targetBodyRotX = 0;
        let targetBodyRotY = 0;
        let targetBodyRotZ = 0;

        let targetArmLRotX = 0;
        let targetArmLRotY = 0;
        let targetArmLRotZ = 0;

        let targetArmRRotX = 0;
        let targetArmRRotY = 0;
        let targetArmRRotZ = 0;

        let targetWeaponPosX = 0.55;
        let targetWeaponPosY = 0.2;
        let targetWeaponPosZ = 0.1;
        let targetWeaponRotX = 0;
        let targetWeaponRotY = 0;
        let targetWeaponRotZ = 0;

        // Base/Default values based on movement status (Walk vs Idle)
        if (this.isMoving) {
            targetBodyPosY = 0.85 + Math.sin(t * 3.0) * 0.02;
            targetBodyRotX = 0.15;
            targetBodyRotY = 0;
            targetBodyRotZ = 0;

            const swingL = Math.sin(this.animTime + Math.PI) * 0.45;
            const swingR = Math.sin(this.animTime) * 0.45;
            targetArmLRotX = swingL;
            targetArmLRotZ = -0.15;
            targetArmRRotX = swingR;
            targetArmRRotZ = 0.15;
        } else {
            targetBodyPosY = 0.85 + Math.sin(t * 1.5) * 0.02;
            targetBodyRotX = Math.sin(t * 0.5) * 0.03;
            targetBodyRotY = Math.cos(t * 0.6) * 0.01;
            targetBodyRotZ = Math.sin(t * 0.8) * 0.008;

            targetArmLRotX = Math.cos(t * 1.5) * 0.02;
            targetArmLRotZ = -0.1 + Math.sin(t * 1.5) * 0.02;
            targetArmRRotX = -Math.cos(t * 1.5) * 0.02;
            targetArmRRotZ = 0.1 - Math.sin(t * 1.5) * 0.02;
        }

        // Apply weapon floating bobbing for idle/movement
        targetWeaponPosY = targetWeaponPosY + Math.sin(t * 2.0) * 0.06;
        targetWeaponRotY = Math.sin(t * 1.0) * 0.05;

        // Override targets based on active action states
        if (this.isDashing) {
            // Dash (Space) state override
            targetBodyRotX = 0.55;
            
            targetArmLRotX = 0.8;
            targetArmLRotY = 0;
            targetArmLRotZ = -0.4;

            targetArmRRotX = 0.8;
            targetArmRRotY = 0;
            targetArmRRotZ = 0.4;

            targetWeaponPosX = 0.4;
            targetWeaponPosY = 0.1;
            targetWeaponPosZ = -0.5;
            targetWeaponRotX = Math.PI / 2;
            targetWeaponRotY = 0;
            targetWeaponRotZ = 0;
        } 
        else if (this.eSkillCastTimer > 0) {
            // Cataclysme (E) state override: Raise weapon straight up with both arms
            const elapsed = 0.5 - this.eSkillCastTimer;
            let p = 0;
            if (elapsed < 0.2) {
                p = elapsed / 0.2;
            } else {
                p = Math.max(0.0, 1.0 - (elapsed - 0.2) / 0.3);
            }
            
            targetBodyRotX = THREE.MathUtils.lerp(targetBodyRotX, -0.1, p);
            
            targetArmLRotX = THREE.MathUtils.lerp(targetArmLRotX, -1.8, p);
            targetArmLRotY = THREE.MathUtils.lerp(targetArmLRotY, 0.3, p);
            targetArmLRotZ = THREE.MathUtils.lerp(targetArmLRotZ, 0.2, p);

            targetArmRRotX = THREE.MathUtils.lerp(targetArmRRotX, -1.8, p);
            targetArmRRotY = THREE.MathUtils.lerp(targetArmRRotY, -0.3, p);
            targetArmRRotZ = THREE.MathUtils.lerp(targetArmRRotZ, -0.2, p);

            targetWeaponPosX = THREE.MathUtils.lerp(targetWeaponPosX, 0.1, p);
            targetWeaponPosY = THREE.MathUtils.lerp(targetWeaponPosY, 0.7, p);
            targetWeaponPosZ = THREE.MathUtils.lerp(targetWeaponPosZ, 0.2, p);
            targetWeaponRotX = THREE.MathUtils.lerp(targetWeaponRotX, -0.2, p);
            targetWeaponRotY = THREE.MathUtils.lerp(targetWeaponRotY, 0, p);
            targetWeaponRotZ = THREE.MathUtils.lerp(targetWeaponRotZ, -0.2, p);
        } 
        else if (this.shiftSkillCastTimer > 0) {
            // Pic de Lune (Shift) state override: Raise lance high overhead and smash down
            const elapsed = 0.4 - this.shiftSkillCastTimer;
            if (elapsed < 0.15) {
                const p = elapsed / 0.15;
                targetBodyRotX = THREE.MathUtils.lerp(targetBodyRotX, -0.2, p);
                
                targetArmLRotX = THREE.MathUtils.lerp(targetArmLRotX, -1.2, p);
                targetArmLRotZ = THREE.MathUtils.lerp(targetArmLRotZ, 0.2, p);
                
                targetArmRRotX = THREE.MathUtils.lerp(targetArmRRotX, -1.8, p);
                targetArmRRotZ = THREE.MathUtils.lerp(targetArmRRotZ, -0.2, p);

                targetWeaponPosX = THREE.MathUtils.lerp(targetWeaponPosX, 0.3, p);
                targetWeaponPosY = THREE.MathUtils.lerp(targetWeaponPosY, 0.8, p);
                targetWeaponPosZ = THREE.MathUtils.lerp(targetWeaponPosZ, -0.2, p);
                targetWeaponRotX = THREE.MathUtils.lerp(targetWeaponRotX, -Math.PI / 3, p);
                targetWeaponRotY = THREE.MathUtils.lerp(targetWeaponRotY, 0, p);
                targetWeaponRotZ = THREE.MathUtils.lerp(targetWeaponRotZ, 0, p);
            } else {
                const p = Math.min(1.0, (elapsed - 0.15) / 0.25);
                targetBodyRotX = THREE.MathUtils.lerp(-0.2, 0.35, p);
                
                targetArmLRotX = THREE.MathUtils.lerp(-1.2, 0.6, p);
                targetArmLRotZ = THREE.MathUtils.lerp(0.2, -0.1, p);
                
                targetArmRRotX = THREE.MathUtils.lerp(-1.8, 1.2, p);
                targetArmRRotZ = THREE.MathUtils.lerp(-0.2, 0.1, p);

                targetWeaponPosX = THREE.MathUtils.lerp(0.3, 0.2, p);
                targetWeaponPosY = THREE.MathUtils.lerp(0.8, 0.1, p);
                targetWeaponPosZ = THREE.MathUtils.lerp(-0.2, 0.6, p);
                targetWeaponRotX = THREE.MathUtils.lerp(-Math.PI / 3, Math.PI / 2.5, p);
                targetWeaponRotY = 0;
                targetWeaponRotZ = 0;
            }
        } 
        else if (this.isAttacking) {
            // Primary Attack Lance Stab/Thrust state override
            this.attackAnimTime = (this.attackAnimTime || 0) + dt;
            const progress = this.attackAnimTime;
            if (progress < 0.12) {
                const p = progress / 0.12;
                targetWeaponRotX = THREE.MathUtils.lerp(0, Math.PI / 2, p);
                targetWeaponRotZ = THREE.MathUtils.lerp(0, -Math.PI / 4, p);
                targetWeaponPosX = THREE.MathUtils.lerp(0.55, 0.2, p);
                targetWeaponPosY = THREE.MathUtils.lerp(0.2, 0.35, p);
                targetWeaponPosZ = THREE.MathUtils.lerp(0.1, 0.9, p);

                targetArmLRotX = 0.4;
                targetArmLRotZ = -0.2;
                targetArmRRotX = -1.4;
                targetArmRRotZ = -0.2;
            } else {
                const p = Math.min(1.0, (progress - 0.12) / 0.18);
                targetWeaponRotX = THREE.MathUtils.lerp(Math.PI / 2, 0, p);
                targetWeaponRotZ = THREE.MathUtils.lerp(-Math.PI / 4, 0, p);
                targetWeaponPosX = THREE.MathUtils.lerp(0.2, 0.55, p);
                targetWeaponPosY = THREE.MathUtils.lerp(0.35, 0.2, p);
                targetWeaponPosZ = THREE.MathUtils.lerp(0.9, 0.1, p);

                targetArmLRotX = THREE.MathUtils.lerp(0.4, targetArmLRotX, p);
                targetArmLRotZ = THREE.MathUtils.lerp(-0.2, targetArmLRotZ, p);
                targetArmRRotX = THREE.MathUtils.lerp(-1.4, targetArmRRotX, p);
                targetArmRRotZ = THREE.MathUtils.lerp(-0.2, targetArmRRotZ, p);
            }
        }

        // 3. Head & Crown Halos
        if (this.headGroup) {
            this.headGroup.rotation.x = Math.sin(t * 1.1) * 0.02;
            this.headGroup.rotation.z = Math.cos(t * 0.8) * 0.015;
        }
        if (this.haloSun && this.haloMoon) {
            this.haloSun.rotation.z += dt * 0.8;
            this.haloMoon.rotation.z -= dt * 0.6;
            
            const s = 1.0 + Math.sin(t * 4.0) * 0.05;
            this.haloSun.scale.set(s, s, s);
            this.haloMoon.scale.set(s, s, s);
        }
        if (this.coreGem) {
            this.coreGem.scale.setScalar(1.0 + Math.sin(t * 5.0) * 0.08);
            if (this.coreGem.material && this.coreGem.material.emissiveIntensity !== undefined) {
                this.coreGem.material.emissiveIntensity = 2.5 + Math.sin(t * 4.0) * 0.5;
            }
        }

        // 4. Astrolabe Shoulder Rings spinning
        if (this.armL && this.armL.userData) {
            const uDataL = this.armL.userData;
            if (uDataL.ring1) uDataL.ring1.rotation.x += dt * 2.0;
            if (uDataL.ring2) uDataL.ring2.rotation.y += dt * 1.5;
        }
        if (this.armR && this.armR.userData) {
            const uDataR = this.armR.userData;
            if (uDataR.ring1) uDataR.ring1.rotation.x -= dt * 2.0;
            if (uDataR.ring2) uDataR.ring2.rotation.y += dt * 1.5;
        }

        // 5. Robe/Tassets and Segmented Cape waving
        if (this.tassets) {
            const tassetSwayAmp = this.isMoving ? 0.35 : 0.04;
            const tassetSwaySpeed = this.isMoving ? 6.0 : 1.8;
            this.tassets.forEach((tasset, idx) => {
                tasset.rotation.x = 0.12 + Math.sin(t * tassetSwaySpeed + idx * 1.5) * tassetSwayAmp;
            });
        }
        if (this.cape) {
            const waveSpeed = this.isMoving ? 7.5 : 2.5;
            const waveAmp = this.isMoving ? 0.28 : 0.04;
            const baseRot = this.isMoving ? 0.45 : 0.15;
            
            if (this.capePanelC) this.capePanelC.rotation.x = baseRot + Math.sin(t * waveSpeed) * waveAmp;
            if (this.capePanelL) this.capePanelL.rotation.x = (baseRot - 0.03) + Math.sin(t * waveSpeed + 1.0) * waveAmp;
            if (this.capePanelR) this.capePanelR.rotation.x = (baseRot - 0.03) + Math.sin(t * waveSpeed + 2.0) * waveAmp;
        }

        // 6. Apex Disc rotation and orbital bobbing
        if (this.apexDisc) {
            this.apexDisc.rotation.z += dt * 1.2;
            this.apexDisc.position.z = -0.32 + Math.sin(t * 2.0) * 0.03;
            if (this.apexCrescent) {
                this.apexCrescent.rotation.z = Math.sin(t * 0.5) * 0.2;
            }
        }

        // 7. Leg walk cycle swinging (No repulsor thruster waves while walking)
        if (this.legL && this.legR) {
            if (this.isMoving) {
                const swingL = Math.sin(this.animTime) * 0.6;
                const swingR = Math.sin(this.animTime + Math.PI) * 0.6;
                this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, swingL, dt * 10);
                this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, swingR, dt * 10);
                this.legL.rotation.z = THREE.MathUtils.lerp(this.legL.rotation.z, 0, dt * 8);
                this.legR.rotation.z = THREE.MathUtils.lerp(this.legR.rotation.z, 0, dt * 8);
            } else {
                this.legL.rotation.x = THREE.MathUtils.lerp(this.legL.rotation.x, 0, dt * 5);
                this.legR.rotation.x = THREE.MathUtils.lerp(this.legR.rotation.x, 0, dt * 5);
                this.legL.rotation.z = THREE.MathUtils.lerp(this.legL.rotation.z, -0.05, dt * 5);
                this.legR.rotation.z = THREE.MathUtils.lerp(this.legR.rotation.z, 0.05, dt * 5);
            }

            // Hide the thruster wave lines (no hover thrusters)
            [this.legL, this.legR].forEach(leg => {
                const uData = leg.userData;
                if (uData) {
                    if (uData.thrusterWave1) uData.thrusterWave1.visible = false;
                    if (uData.thrusterWave2) uData.thrusterWave2.visible = false;
                }
            });
        }

        // 8. Apply smooth interpolation (lerping) to all action-target values component-by-component
        const blendRate = 18.0;

        if (this.body) {
            this.body.position.y = THREE.MathUtils.lerp(this.body.position.y, targetBodyPosY, dt * blendRate);
            this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, targetBodyRotX, dt * blendRate);
            this.body.rotation.y = THREE.MathUtils.lerp(this.body.rotation.y, targetBodyRotY, dt * blendRate);
            this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, targetBodyRotZ, dt * blendRate);
        }

        if (this.armL) {
            this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, targetArmLRotX, dt * blendRate);
            this.armL.rotation.y = THREE.MathUtils.lerp(this.armL.rotation.y, targetArmLRotY, dt * blendRate);
            this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, targetArmLRotZ, dt * blendRate);
        }

        if (this.armR) {
            this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, targetArmRRotX, dt * blendRate);
            this.armR.rotation.y = THREE.MathUtils.lerp(this.armR.rotation.y, targetArmRRotY, dt * blendRate);
            this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, targetArmRRotZ, dt * blendRate);
        }

        if (this.weaponGroup) {
            this.weaponGroup.position.x = THREE.MathUtils.lerp(this.weaponGroup.position.x, targetWeaponPosX, dt * blendRate);
            this.weaponGroup.position.y = THREE.MathUtils.lerp(this.weaponGroup.position.y, targetWeaponPosY, dt * blendRate);
            this.weaponGroup.position.z = THREE.MathUtils.lerp(this.weaponGroup.position.z, targetWeaponPosZ, dt * blendRate);
            
            this.weaponGroup.rotation.x = THREE.MathUtils.lerp(this.weaponGroup.rotation.x, targetWeaponRotX, dt * blendRate);
            this.weaponGroup.rotation.y = THREE.MathUtils.lerp(this.weaponGroup.rotation.y, targetWeaponRotY, dt * blendRate);
            this.weaponGroup.rotation.z = THREE.MathUtils.lerp(this.weaponGroup.rotation.z, targetWeaponRotZ, dt * blendRate);
        }
    }

    getTargetDir() {
        if (!Globals.camera) return new THREE.Vector3(0, 0, 1);
        STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        STATE.raycaster.ray.intersectPlane(plane, intersection);
        const dir = intersection.clone().sub(this.position);
        dir.y = 0;
        if (dir.lengthSq() > 0.001) {
            dir.normalize();
        } else {
            dir.set(0, 0, 1);
        }
        return dir;
    }

    spawnGhost() {
        const color = this.eclipse.nextIsSun ? 0xffaa00 : 0xaa00ff;
        const ghostGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 8);
        const ghostMat = new THREE.MeshBasicMaterial({
            color: color, 
            transparent: true, 
            opacity: 0.4, 
            blending: THREE.AdditiveBlending
        });
        const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
        ghostMesh.position.copy(this.position);
        ghostMesh.position.y += 0.9;
        ghostMesh.rotation.y = this.mesh.rotation.y;
        this.addLocalVisual(ghostMesh, 0.3, (m, t) => m.material.opacity = t * 0.4);
    }

    beginLanceCharge() {
        if (this.lanceCharging || this.dead || this.isDashing) return;
        if (this.isCasting && !this.lanceCharging) return;
        if (!hasEclipseCrown()) return;
        if (this.attackCooldown > 0) return;

        this.faceMouse();
        const dir = this.isLocalPlayer()
            ? this.getTargetDir()
            : new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);

        this.lanceCharging = true;
        this.lanceChargeElapsed = 0;
        this.lanceChargeDir = dir.clone();
        this.isCasting = true;
        this.speed = 0;
    }

    tickLanceCharge(dt) {
        if (!this.lanceCharging) return;

        if (!STATE.mouseDown) {
            this.releaseLanceCharge();
            return;
        }

        this.lanceChargeElapsed = Math.min(LANCE_CHARGE_MAX_SEC, this.lanceChargeElapsed + dt);
        this.faceMouse();

        if (isValidChargedLanceRelease(this.lanceChargeElapsed)) {
            const ratio = (this.lanceChargeElapsed - LANCE_CHARGE_MIN_SEC)
                / (LANCE_CHARGE_MAX_SEC - LANCE_CHARGE_MIN_SEC);
            this.armR.rotation.x = -Math.PI / 2 - ratio * 0.45;
            this.body.rotation.x = -0.25 * ratio;
        }
    }

    releaseLanceCharge() {
        if (!this.lanceCharging) return;

        const dir = this.lanceChargeDir || this.getTargetDir();
        const elapsed = this.lanceChargeElapsed;
        const isCharged = isValidChargedLanceRelease(elapsed);

        this.lanceCharging = false;
        this.lanceChargeElapsed = 0;
        this.lanceChargeDir = null;
        this.isCasting = false;
        this.speed = STATE.stats.speed;
        this.armR.rotation.x = 0;
        this.body.rotation.x = 0;

        if (this.isLocalPlayer()) hideEclipseLanceChargeUI();

        if (isCharged) {
            this.executeLanceAttack(dir, elapsed, true);
        } else {
            this.executeLanceAttack(dir, 0, false);
        }
    }

    performAttack() {
        if (this.isCasting && !this.lanceCharging) return;

        if (hasEclipseCrown()) {
            if (!this.lanceCharging) this.beginLanceCharge();
            return;
        }

        const dir = this.isLocalPlayer()
            ? this.getTargetDir()
            : new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
        this.executeLanceAttack(dir, 0, false);
    }

    executeLanceAttack(dir, chargeSec = 0, isCharged = false) {
        if (this.isCasting) return;

        this.faceMouse();
        let haste = 1;
        if (this.eclipse.active) haste *= 1.5;
        this.attackCooldown = (this.attackMaxCooldown * (STATE.stats.attackSpeedMod || 1)) / haste;
        this.isAttacking = true;
        this.attackAnimTime = 0;
        AudioSys.sfx.warrior.swing();

        setTimeout(() => {
            this.isAttacking = false;
            this.armR.rotation.x = 0;
            this.body.rotation.x = 0;
        }, 300);

        const targetAngle = Math.atan2(dir.x, dir.z);

        if (shouldSendSkillIntent()) {
            sendSkillIntent({ intent: 'eclipse-attack', dir, pos: this.position.clone() });
        } else if (STATE.multiplayer.active && this.isLocalPlayer()) {
            Network.send({ type: 'net-action', action: 'attack-melee', id: STATE.multiplayer.id, pos: this.position, dir, color: CONFIG.colors.eclipse, class: 'eclipse' });
        }

        const underCataclysm = isEclipseCataclysmWindow(this);
        const chargedCataclysm = isCharged && underCataclysm;
        const fireSun = chargedCataclysm || this.eclipse.nextIsSun;
        const fireMoon = chargedCataclysm || !this.eclipse.nextIsSun;

        const rangeBonus = isCharged ? calcLanceChargeRangeBonus(chargeSec) : 0;
        const fulguranceMult = isCharged ? consumeFulguranceDamageBonus(this) : 1;

        let hitAnyEnemy = false;

        if (canDealDamageDirectly()) {
            triggerSolarExplosion(this, dir);

            const sunMods = PassiveKeystoneHooks.getDevouringSunMods();
            const range = 3.5 * sunMods.spearRangeMult * (1 + rangeBonus);
            const threshold = 0.4;

            Globals.enemies.forEach(e => {
                if (e.dead) return;
                const toE = e.position.clone().sub(this.position);
                toE.y = 0;
                const dist = toE.length();
                if (dist <= range) {
                    toE.normalize();
                    if (dir.dot(toE) >= threshold) {
                        hitAnyEnemy = true;
                        const fragMult = getEclipseLanceDamageMult(e);
                        if (fireSun) {
                            const damage = STATE.stats.atk * fragMult * fulguranceMult;
                            dealDamageToEnemy(e, damage, { pos: e.position, skillKey: 'primary' });
                            const particleCount = chargedCataclysm ? 12 : 5;
                            spawnParticles(e.position, 0xffaa00, particleCount);

                            const burnDmg = STATE.stats.atk * 0.2 * sunMods.burnDmgMult;
                            applySolarBurn(e);
                            for (let t = 0; t < sunMods.burnTicks; t++) {
                                const delay = sunMods.burnStartMs + t * sunMods.burnIntervalMs;
                                setTimeout(() => {
                                    if (!e.dead && canApplyGameplay()) {
                                        dealDamageToEnemy(e, burnDmg, { pos: e.position, noCrit: true, skillKey: 'primary' });
                                        createDamageText('FEU', e.position, '#ffa500');
                                        PassiveKeystoneHooks.onEclipseBurnTick(this);
                                    }
                                }, delay);
                            }
                        }
                        if (fireMoon) {
                            const damage = STATE.stats.atk * 1.2 * fragMult * fulguranceMult;
                            dealDamageToEnemy(e, damage, { pos: e.position, skillKey: 'primary' });
                            PassiveKeystoneHooks.onEclipseLunarAttackHit(this, e);
                            const particleCount = chargedCataclysm ? 12 : 5;
                            spawnParticles(e.position, 0xaa00ff, particleCount);
                        }
                    }
                }
            });
        }

        if (chargedCataclysm && hitAnyEnemy) {
            createDamageText('FRAPPE ÉCLIPTIQUE', this.position, '#ffcc00');
            createSkillVisual('shockwave', this.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 2.5, 0xffffff);
        }

        const trailLength = 4.0 * (1 + rangeBonus * 0.5);
        const geom = new THREE.ConeGeometry(0.14, trailLength, 12);
        geom.rotateX(Math.PI / 2);
        geom.translate(0, 0, trailLength / 2);

        const mat = new THREE.MeshBasicMaterial({
            color: chargedCataclysm ? 0xffcc00 : 0xffffff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });

        const slashMesh = new THREE.Mesh(geom, mat);
        slashMesh.position.copy(this.position).add(new THREE.Vector3(0, 1.0, 0)).add(dir.clone().multiplyScalar(0.4));
        slashMesh.rotation.y = targetAngle;

        Globals.scene.add(slashMesh);

        this.addLocalVisual(slashMesh, 0.2, (m, t, maxT) => {
            const p = t / maxT;
            m.material.opacity = p * 0.8;
            m.scale.set(1 - (1 - p) * 0.5, 1 - (1 - p) * 0.5, 1 + (1 - p) * 0.6);
        });

        spawnParticles(this.position.clone().add(dir.clone().multiplyScalar(1.5)), fireSun ? 0xffaa00 : 0xaa00ff, isCharged ? 12 : 8);

        if (fireSun) {
            this.eclipse.sun = Math.min(100, this.eclipse.sun + 10);
            if (!chargedCataclysm) this.eclipse.nextIsSun = false;
        }
        if (fireMoon) {
            if (this.isLocalPlayer() && hitAnyEnemy && Math.random() < 0.5) {
                this.heal(STATE.stats.atk * 0.1);
                createDamageText('+HP', this.position, '#00ff00');
            }
            this.eclipse.moon = Math.min(100, this.eclipse.moon + 10);
            if (!chargedCataclysm) this.eclipse.nextIsSun = true;
        }

        incrementRuptureLanceStack(this, dir);
    }

    create3DEclipseMark(e) {
        const group = new THREE.Group();
        group.name = "eclipseMark";

        // 1. Sun Corona: Torus Geometry
        const sunGeo = new THREE.TorusGeometry(0.35, 0.05, 8, 32);
        const sunMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff4500,
            emissiveIntensity: 2.5,
            metalness: 0.1,
            roughness: 0.1,
            transparent: true,
            opacity: 0.95
        });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.name = "sunCorona";
        group.add(sunMesh);

        // 2. Solar Flares: Cones radiating outward
        const flareGeo = new THREE.ConeGeometry(0.05, 0.22, 4);
        flareGeo.translate(0, 0.11, 0); // pivot at base
        const flareMat = new THREE.MeshStandardMaterial({
            color: 0xff3300,
            emissive: 0xff1100,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });
        const flareGroup = new THREE.Group();
        flareGroup.name = "flares";
        for (let i = 0; i < 8; i++) {
            const flare = new THREE.Mesh(flareGeo, flareMat);
            const angle = (i / 8) * Math.PI * 2;
            flare.position.set(Math.cos(angle) * 0.38, Math.sin(angle) * 0.38, 0);
            flare.rotation.z = angle - Math.PI / 2;
            flareGroup.add(flare);
        }
        group.add(flareGroup);

        // 3. Moon Sphere: Dark obsidian sphere overlapping in front
        const moonGeo = new THREE.SphereGeometry(0.24, 16, 16);
        const moonMat = new THREE.MeshStandardMaterial({
            color: 0x05020d, // Dark velvet obsidian
            roughness: 0.1,
            metalness: 0.95,
            emissive: 0x1f0f3d, // glowing purple core edge
            emissiveIntensity: 0.5
        });
        const moonMesh = new THREE.Mesh(moonGeo, moonMat);
        moonMesh.name = "moonSphere";
        moonMesh.position.set(0.04, 0.04, 0.08); // Offset to show Sun crescent sliver behind it!
        group.add(moonMesh);

        // 4. Aura Glow behind the Sun
        const auraGeo = new THREE.RingGeometry(0.1, 0.52, 32);
        const auraMat = new THREE.MeshBasicMaterial({
            color: 0xff4500,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const aura = new THREE.Mesh(auraGeo, auraMat);
        aura.position.z = -0.05;
        aura.name = "aura";
        group.add(aura);

        // Set position relative to the enemy group
        group.position.set(0, (e.radius || 1.0) * 2.8, 0);

        return group;
    }

    createLunarSpikeMesh() {
        const group = new THREE.Group();

        // Dark violet cosmic rock material
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x140d24, // Very dark purple/black rock
            roughness: 0.85,
            metalness: 0.2,
            name: 'original'
        });

        // Glowing amethyst moon crystal material
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0xa855f7, 
            emissive: 0x6d28d9,
            emissiveIntensity: 3.0,
            roughness: 0.1,
            metalness: 0.8,
            name: 'original'
        });

        const glowingTipMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xd8b4fe,
            emissiveIntensity: 4.0,
            roughness: 0.05,
            metalness: 0.9,
            name: 'original'
        });

        // 1. Main Jagged Pillar: Stacking detailed rock parts and crystal veins
        const mainSpike = new THREE.Group();
        group.add(mainSpike);

        const segmentsCount = 7; 
        for (let i = 0; i < segmentsCount; i++) {
            const h = i / segmentsCount;
            const size = 0.9 * (1.0 - h * 0.82);
            
            const rockGeo = new THREE.DodecahedronGeometry(size, 0);
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(
                (Math.random() - 0.5) * 0.2,
                i * 0.7 - 1.5,
                (Math.random() - 0.5) * 0.2
            );
            rock.rotation.set(
                Math.random() * 0.5,
                Math.random() * Math.PI,
                Math.random() * 0.5
            );
            mainSpike.add(rock);

            if (i > 0 && i < segmentsCount - 1) {
                const crystalGeo = new THREE.ConeGeometry(size * 0.4, size * 1.5, 4);
                const crystal = new THREE.Mesh(crystalGeo, crystalMat);
                const angle = Math.random() * Math.PI * 2;
                crystal.position.set(
                    Math.cos(angle) * (size * 0.6),
                    i * 0.7 - 1.5,
                    Math.sin(angle) * (size * 0.6)
                );
                crystal.rotation.x = Math.sin(angle) * 1.0;
                crystal.rotation.z = -Math.cos(angle) * 1.0;
                crystal.rotation.y = Math.random() * Math.PI;
                mainSpike.add(crystal);
            }
        }

        // 2. High-detail Glowing Moon Crescent Peak at the top
        const peakGroup = new THREE.Group();
        peakGroup.position.set(0, 3.2, 0);
        mainSpike.add(peakGroup);

        const crescentTip = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 6, 24, Math.PI * 1.3), glowingTipMat);
        crescentTip.rotation.z = Math.PI / 4;
        peakGroup.add(crescentTip);

        const pierceGeo = new THREE.ConeGeometry(0.12, 0.8, 5);
        const pierce = new THREE.Mesh(pierceGeo, glowingTipMat);
        pierce.position.y = 0.3;
        peakGroup.add(pierce);

        // 3. Satellite rock shards at base
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 0.6 + Math.random() * 0.4;
            const shardHeight = 0.8 + Math.random() * 0.8;
            
            const shardGeo = new THREE.ConeGeometry(0.12, shardHeight, 4);
            const shard = new THREE.Mesh(shardGeo, i % 3 === 0 ? rockMat : crystalMat);
            shard.position.set(Math.cos(angle) * dist, -1.8 + shardHeight/2, Math.sin(angle) * dist);
            shard.rotation.x = Math.sin(angle) * 0.5 + (Math.random() - 0.5) * 0.3;
            shard.rotation.z = -Math.cos(angle) * 0.5 + (Math.random() - 0.5) * 0.3;
            shard.rotation.y = Math.random() * Math.PI;
            group.add(shard);
        }

        // 4. Tiny Floating Orbiting Crystal Shards
        const floatingGroup = new THREE.Group();
        floatingGroup.name = "floatingShards";
        group.add(floatingGroup);

        for (let i = 0; i < 4; i++) {
            const floatShardGeo = new THREE.OctahedronGeometry(0.1 + Math.random() * 0.08, 0);
            const floatShard = new THREE.Mesh(floatShardGeo, crystalMat);
            const radius = 0.9 + Math.random() * 0.3;
            const angle = (i / 4) * Math.PI * 2;
            floatShard.position.set(
                Math.cos(angle) * radius,
                0.5 + (Math.random() - 0.5) * 0.6,
                Math.sin(angle) * radius
            );
            floatShard.userData = {
                angle: angle,
                radius: radius,
                speed: 1.5 + Math.random() * 1.0,
                yOffset: floatShard.position.y,
                bobSpeed: 2.0 + Math.random() * 2.0,
                bobAmp: 0.15
            };
            floatingGroup.add(floatShard);
        }

        return group;
    }

    useSkill(key) {
        if(this.cooldowns[key] > 0 || this.isCasting) return;
        this.faceMouse();
        const dir = this.isLocalPlayer() 
            ? this.getTargetDir()
            : new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);
        this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);
        ConstellationEngine.onSkillUsed(key);
        
        if(key === 'space') { 
            // --- FULGURANCE SOLAIRE (Dash) ---
            AudioSys.sfx.blade.dash(); 
            this.invulnerable = true;
            this.isDashing = true;
            this.dashTimer = 0.25; 
            this.dashDir = dir.clone().normalize();
            this.dashHitSet.clear(); 
            createDamageText("IMMUNE", this.position, '#ffffff');

            // Instantly face the dash direction
            const targetRot = Math.atan2(this.dashDir.x, this.dashDir.z);
            this.mesh.rotation.y = targetRot;
            this.netRotation = targetRot;

            this.eclipse.sun = Math.min(100, this.eclipse.sun + 30);
            
            // Allow 3 dashes in a row if in Ascension
            if (this.eclipse.active) {
                this.dashComboCount = (this.dashComboCount || 0) + 1;
                if (this.dashComboCount >= 3) {
                    this.dashComboCount = 0; // Cooldown is active
                } else {
                    this.cooldowns['space'] = 0; // Reset cooldown for next dash
                    createDamageText(`DASH x${this.dashComboCount + 1}`, this.position, '#ffaa00');
                }
            } else {
                this.dashComboCount = 0;
            }

            // Create Stylized 3D Translucent Sun Shield in front of player
            if (this.dashShield) {
                this.mesh.remove(this.dashShield);
            }
            const shieldGroup = new THREE.Group();
            shieldGroup.name = "dashShield";
            shieldGroup.position.set(0, 0.8, 0.6); // chest height, in front

            // Inner glowing translucent energy barrier
            const barrierGeo = new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
            barrierGeo.rotateX(Math.PI / 2); // point dome forward
            const barrierMat = new THREE.MeshStandardMaterial({
                color: 0xff5500,
                transparent: true,
                opacity: 0.45,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                emissive: 0xffaa00,
                emissiveIntensity: 1.5,
                roughness: 0.1,
                metalness: 0.8
            });
            const barrier = new THREE.Mesh(barrierGeo, barrierMat);
            shieldGroup.add(barrier);

            // Outer metallic sun rim
            const rimGeo = new THREE.TorusGeometry(0.5, 0.04, 10, 32);
            const rimMat = new THREE.MeshStandardMaterial({
                color: 0xffcc00,
                roughness: 0.15,
                metalness: 0.95,
                emissive: 0xaa5500,
                emissiveIntensity: 1.2
            });
            const rim = new THREE.Mesh(rimGeo, rimMat);
            shieldGroup.add(rim);

            // Solar flares radiating from shield
            for (let i = 0; i < 8; i++) {
                const flareGeo = new THREE.ConeGeometry(0.06, 0.3, 4);
                flareGeo.translate(0, 0.15, 0); // pivot offset
                const flareMat = new THREE.MeshStandardMaterial({
                    color: 0xffaa00,
                    emissive: 0xff3300,
                    emissiveIntensity: 2.0,
                    transparent: true,
                    opacity: 0.75,
                    blending: THREE.AdditiveBlending
                });
                const flare = new THREE.Mesh(flareGeo, flareMat);
                flare.rotation.z = (i / 8) * Math.PI * 2;
                shieldGroup.add(flare);
            }
            this.mesh.add(shieldGroup);
            this.dashShield = shieldGroup;
            
            // Effets de particules et shockwave au départ
            spawnParticles(this.position.clone(), 0xffaa00, 15);
            
            // Soft clean cosmic ring sector for space start wave
            const geom = new THREE.RingGeometry(0.5, 3.0, 32);
            geom.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });
            const wave = new THREE.Mesh(geom, mat);
            wave.position.copy(this.position).add(new THREE.Vector3(0, 0.1, 0));
            Globals.scene.add(wave);
            this.addLocalVisual(wave, 0.4, (m, t, maxT) => {
                const p = t / maxT;
                m.scale.setScalar(1 + (1 - p) * 1.5);
                m.material.opacity = p * 0.6;
            });

        } else if (key === 'shift') { 
            // --- PIC DE LUNE ---
            AudioSys.sfx.warrior.smash(); 
            this.shiftSkillCastTimer = 0.4;

            // Determine spawn positions (1 if normal, 3 in a straight line going forward if in Ascension)
            const positionsToSpawn = [];
            const lunar = PassiveKeystoneHooks.getLunarSpikeMods();
            const dmg = ConstellationEngine.modifyDamageDealt(
                STATE.stats.atk * 3.0, 
                { skill: true, skillKey: 'shift' }
            );

            if (this.eclipse.active) {
                // Spawn 3 spikes in a straight line going forward
                const distances = [1.8, 3.2, 4.6];
                distances.forEach(dist => {
                    positionsToSpawn.push(this.position.clone().add(dir.clone().multiplyScalar(dist)));
                });
            } else {
                positionsToSpawn.push(this.position.clone().add(dir.clone().multiplyScalar(2.0)));
            }

            positionsToSpawn.forEach((targetPos, idx) => {
                const delay = this.eclipse.active ? idx * 80 : 0;
                setTimeout(() => {
                    if (this.dead) return;

                    // Spawn realistic spike model
                    const spike = this.createLunarSpikeMesh();
                    spike.position.copy(targetPos);
                    spike.position.y = -4; // spawn underground
                    
                    // Animate appearance (eruption, solid hold, sinking fadeout)
                    const dtLocal = 1.2;
                    this.addLocalVisual(spike, dtLocal, (m, t, maxT) => {
                        const progress = t / maxT;
                        
                        if (!m.userData.debrisTriggered && progress <= 0.76) {
                            m.userData.debrisTriggered = true;
                            spawnParticles(targetPos, 0x3d354a, 18, 1.2); // grey rock debris (slightly larger)
                            spawnParticles(targetPos, 0xa855f7, 12, 1.0); // purple amethyst crystal shards
                            createSkillVisual('shockwave', targetPos, 1.8, 0xa855f7); // base eruption shockwave
                        }
                        
                        if (progress < 0.25) {
                            const ep = progress / 0.25;
                            const easeOut = 1 - Math.pow(1 - ep, 3);
                            m.position.y = THREE.MathUtils.lerp(-4, 0, easeOut);
                            m.scale.set(easeOut, easeOut, easeOut);
                        } else if (progress < 0.75) {
                            m.position.y = 0;
                            m.scale.set(1.0, 1.0, 1.0);
                        } else {
                            const lp = (progress - 0.75) / 0.25;
                            m.position.y = THREE.MathUtils.lerp(0, -4, lp);
                            m.traverse(child => {
                                if (child.isMesh && child.material) {
                                    child.material.transparent = true;
                                    child.material.opacity = Math.max(0, 1 - lp);
                                }
                            });
                        }
                        m.rotation.y += 0.01; // slow rotate

                        // Animate floating crystal shards bobbing and orbiting
                        const floatGroup = m.getObjectByName("floatingShards");
                        if (floatGroup) {
                            const elapsed = maxT - t;
                            floatGroup.rotation.y = elapsed * 1.5;
                            const time = Date.now() * 0.001;
                            floatGroup.children.forEach(child => {
                                if (child.userData && child.userData.bobSpeed) {
                                    child.position.y = child.userData.yOffset + Math.sin(time * child.userData.bobSpeed) * child.userData.bobAmp;
                                }
                            });
                        }

                        if (t <= 0) {
                            m.traverse(child => {
                                if (child.isMesh) {
                                    if (child.geometry) child.geometry.dispose();
                                    if (child.material) {
                                        if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
                                        else child.material.dispose();
                                    }
                                }
                            });
                        }
                    });
                    
                    // Deal damage and push back enemies around this targetPos
                    if (canDealDamageDirectly()) {
                        Globals.enemies.forEach(e => {
                            if (e.dead) return;
                            if (e.position.distanceTo(targetPos) <= lunar.radius) {
                                dealDamageToEnemy(e, dmg, { pos: e.position, skillKey: 'shift' });
                                applyPicDeLuneDisplacement(e, targetPos, this);
                                applyLunarTideHeal(this, dmg);
                                createDamageText("EMPALE!", e.position, '#aa00ff');
                                spawnParticles(e.position, 0xaa00ff, 10);
                            }
                        });
                    }
                }, delay);
            });

            this.eclipse.moon = Math.min(100, this.eclipse.moon + 20);

        } else if (key === 'e') { 
            // --- CATACLYSME / ASCENSION (AOE en marche) ---
            AudioSys.sfx.warrior.smash();
            ConvergenceEffects.onEclipseCataclysm(this);
            let dmgMultiplier = 1.0;
            let applyEffects = false;
            
            this.eSkillCastTimer = 0.5; // triggers a 0.5s weapon-to-sky animation
            
            if (this.eclipse.active) {
                dmgMultiplier = 2.5; 
                applyEffects = true;
                createDamageText("APOCALYPSE", this.position, '#ffffff');
                
                // Active le mode sombre temporairement pour l'impact
                if(GameActions && GameActions.setAmbiance) {
                    GameActions.setAmbiance('dark');
                    setTimeout(() => {
                        if(GameActions && GameActions.setAmbiance) GameActions.setAmbiance('normal');
                    }, 1000);
                }
            } else {
                createDamageText("CATACLYSME", this.position, '#ffffff');
            }

            this.eclipse.active = false;
            this.eclipse.sun = 0;
            this.eclipse.moon = 0;

            // Dégâts et effets visuels de l'explosion (déclenchement rapide en 100ms)
            const targetPos = this.position.clone();
            
            // Secousse de caméra modérée à l'impact
            setTimeout(() => {
                Globals.scene.position.set(
                    (Math.random()-0.5) * 0.4,
                    (Math.random()-0.5) * 0.4,
                    (Math.random()-0.5) * 0.4
                );
                setTimeout(() => Globals.scene.position.set(0, 0, 0), 150);
            }, 100);

            setTimeout(() => {
                createSkillVisual('shockwave', targetPos, 16, 0xffffff);
                PassiveKeystoneHooks.applyVoidPull(targetPos, 15);
                
                // Sphère d'explosion d'éclipse géante (blanc et noir alternant)
                const explosion = new THREE.Mesh(
                    new THREE.SphereGeometry(15, 16, 16), 
                    new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide})
                );
                explosion.position.copy(targetPos);
                Globals.scene.add(explosion);
                this.addLocalVisual(explosion, 0.5, (m, t, maxT) => { 
                    const p = t / maxT;
                    m.scale.setScalar(1 + (1 - p) * 2.2); 
                    m.material.opacity = p * 0.8; 
                    if(Math.floor(p*10)%2 === 0) m.material.color.setHex(0x000000);
                    else m.material.color.setHex(0xffffff);
                });

                // Pilier céleste d'impact
                const pillarGeo = new THREE.CylinderGeometry(3, 3, 60, 16, 1, true);
                const pillarMat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending});
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.copy(targetPos);
                Globals.scene.add(pillar);
                this.addLocalVisual(pillar, 0.6, (m, t, maxT) => {
                    const p = t / maxT;
                    m.material.opacity = p * 0.7;
                    m.scale.set(1 + (1 - p) * 1.5, 1, 1 + (1 - p) * 1.5);
                });

                // Dégâts de zone
                Globals.enemies.forEach(e => {
                    if(e.position.distanceTo(targetPos) < 15) {
                        const baseDmg = ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 0.8 * dmgMultiplier * (1 + PassiveKeystoneHooks.getCataclysmChargeBonus()), { skill: true, skillKey: 'e' });
                        dealDamageToEnemy(e, baseDmg, { pos: e.position });
                        if (!e.isBoss && !e.isMiniBoss) {
                            e.pushBack(targetPos, 8);
                        }
                        
                        // Mark the enemy!
                        e._eclipseMarked = true;
                        createDamageText("MARQUÉ", e.position, '#aa00ff');

                        // Spawn visual marker above their head
                        if (!e._markVisual) {
                            const mark = this.create3DEclipseMark(e);
                            e.add(mark);
                            e._markVisual = mark;
                        }

                        // Remove mark after 10 seconds to avoid leaks
                        setTimeout(() => {
                            if (e && !e.dead && e._eclipseMarked) {
                                e._eclipseMarked = false;
                                if (e._markVisual) {
                                    e.remove(e._markVisual);
                                    e._markVisual.traverse?.(child => {
                                        if (child.isMesh) {
                                            child.geometry?.dispose();
                                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose?.());
                                            else child.material?.dispose?.();
                                        }
                                    });
                                    if (e._markVisual.geometry) e._markVisual.geometry.dispose();
                                    if (e._markVisual.material) e._markVisual.material.dispose();
                                    e._markVisual = null;
                                }
                            }
                        }, 10000);
                        
                        if (applyEffects) {
                            setTimeout(() => { if(!e.dead) { dealDamageToEnemy(e, baseDmg * 0.2, { pos: e.position, noCrit: true }); createDamageText("BRÛLURE", e.position, '#ffa500'); } }, 300);
                            setTimeout(() => { if(!e.dead) { dealDamageToEnemy(e, baseDmg * 0.2, { pos: e.position, noCrit: true }); createDamageText("NÉCROSE", e.position, '#aa00ff'); } }, 800);
                            e.speed *= 0.2;
                            setTimeout(() => { if(e && !e.dead) e.speed *= 5.0; }, 3000);
                        }
                    }
                });
                incrementRuptureLanceStack(this, dir);
            }, 100);
        }
    }
}