// @ts-nocheck
import { PlayerBase } from '../player_base';
import { CONFIG, STATE } from '../../core/config';
import { AudioSys } from '../../core/ressources';
import { createDamageText, createSkillVisual, createTelegraph, spawnParticles } from '../../visual/effects';
import { disposeObject3D } from '../../visual/meshMaterialUtils';
import { setDisplayIfChanged, getCachedElement } from '../../visual/domUtils';
import { Globals } from '../../core/globals';
import { ConstellationEngine } from '../../systems/constellationEngine';
import { PassiveKeystoneHooks } from '../../systems/passiveKeystoneHooks';
import { ConvergenceEffects } from '../../systems/convergenceEffects';
import { CHRONO_ASCENDANT, CHRONO_BEAM, CHRONO_FRACTURE, CHRONO_SKILLS } from './chrono/constants';
import { dedupeBeamRays, getBeamHitInfo, resolveBeamRoutes, rayHitsLens } from './chrono/beamHelpers';
import {
  clampFracture,
  createFractureDecayState,
  getFractureOverheatAt,
  getMaxFracture,
  isChronoFractureApexActive,
  isFractureDecaying,
  isInOverloadReleaseWindow,
  isOverloadImminenceActive,
  resetFractureDecayState,
  tickFractureDecay,
} from './chrono/fractureHelpers';
import { updateChronoFractureUI } from './chrono/fractureUi';
import { pulseChronoLensUI, updateChronoLensUI } from './chrono/lensUi';
import { applyChronoTemporalBurn, tickChronoTemporalBurns } from './chrono/temporalBurn';
import { dealDamageToEnemy } from '../combat/damage_helpers';
import { ChronoDephasingGrenade } from './chrono/grenadeProjectile';
import { NetChrono } from '../../multiplayer/net_chrono';
import { isServerAuthority, isVisualOnlyMode } from '../../multiplayer/net_combat';

const CHRONO_COLOR = () => CONFIG.colors.chronoregulator;

const beamGeometries = new Map();
function getBeamSharedGeometry(key, creator) {
  let geo = beamGeometries.get(key);
  if (!geo) {
    geo = creator();
    geo.userData = geo.userData || {};
    geo.userData.keep = true;
    beamGeometries.set(key, geo);
  }
  return geo;
}

const beamMaterials = new Map();
function getBeamSharedMaterial(key, creator) {
  let mat = beamMaterials.get(key);
  if (!mat) {
    mat = creator();
    mat.userData = mat.userData || {};
    mat.userData.keep = true;
    beamMaterials.set(key, mat);
  }
  return mat;
}

export class Chronoregulator extends PlayerBase {
  constructor() {
    super('chronoregulator');
    this.createClassModel();
    this.applyClassStats();

    this.fractureGauge = 0;
    this.fractureSilence = 0;
    this.fractureDecayState = createFractureDecayState();
    this.overheatTriggered = false;
    this.isBeaming = false;
    this.beamVisuals = [];
    this.beamTickTimer = 0;
    this.beamFocusId = null;
    this.beamFocusTime = 0;
    this.beamDamageLog = [];
    this.lenses = [];
    this._lensUidCounter = 0;
    this.netAimDir = null;
    this._lensMeshesById = Object.create(null);
    this.isConverging = false;
    this.convergenceTimer = 0;
    this.convergenceHitCount = 0;
    this.animState = { rightArmOverride: false };
    
    // Cast animation timers
    this.castAnimTimer = 0;
    this.castAnimType = null;
  }

  syncChronoApexState() {
    ConstellationEngine.ensureKeystonePassive('continuumMastery', 'chronoregulator-apex', 2);
    this.fractureGauge = clampFracture(this.fractureGauge ?? 0);
    this.overheatTriggered = false;
    if (this.isLocalPlayer()) {
      updateChronoFractureUI(this.fractureGauge, this.fractureSilence ?? 0, true);
      updateChronoLensUI(this.lenses, true);
    }
  }

  createClassModel() {
    const isApex = isChronoFractureApexActive();
    this.isApexActive = isApex;
    
    const teal = CHRONO_COLOR();
    
    // Custom Materials
    const voidMat = new THREE.MeshStandardMaterial({
      color: isApex ? 0x090f1a : 0x0f172a, 
      roughness: 0.12, 
      metalness: 0.9, 
      name: 'bodyPart',
    });
    const robeMat = new THREE.MeshStandardMaterial({
      color: teal, 
      roughness: 0.5, 
      metalness: 0.2, 
      side: THREE.DoubleSide, 
      name: 'bodyPart',
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd93d, 
      roughness: 0.1, 
      metalness: 1.0, 
      emissive: 0x443300, 
      name: 'bodyPart',
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff, 
      emissive: 0x00d2ff, 
      emissiveIntensity: isApex ? 3.0 : 2.0, 
      roughness: 0.05, 
      name: 'bodyPart',
    });
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff, 
      transparent: true, 
      opacity: 0.4,
      name: 'bodyPart',
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x7df9ff, 
      roughness: 0.05, 
      metalness: 0.95, 
      transparent: true, 
      opacity: 0.2, 
      side: THREE.DoubleSide, 
      name: 'bodyPart',
    });
    const whiteArmor = new THREE.MeshStandardMaterial({
      color: 0xf6f6f6,
      roughness: 0.18,
      metalness: 0.8,
      name: 'bodyPart',
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x00aaff, 
      emissive: 0x0088ff, 
      emissiveIntensity: 1.6, 
      transparent: true, 
      opacity: 0.45,
      name: 'bodyPart',
    });
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00aaff,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      name: 'bodyPart'
    });

    this.mesh = new THREE.Group();
    this.bodyGroup.add(this.mesh);
    this.bodyMesh = new THREE.Group();
    this.mesh.add(this.bodyMesh);

    // Legs with Light Geometric Armor & Levitating Boots
    const legHeight = 0.75;
    this.legL = this.createLeg(whiteArmor, voidMat, goldMat, -0.16, legHeight);
    this.legR = this.createLeg(whiteArmor, voidMat, goldMat, 0.16, legHeight);
    this.mesh.add(this.legL);
    this.mesh.add(this.legR);

    // Torso: Mystic Scientific Lab-coat with high collar
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.45, 8), voidMat);
    torso.position.y = 0.45;
    this.bodyMesh.add(torso);
    
    // Collar with high-tech details
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.12, 8), goldMat);
    collar.position.y = 0.69;
    this.bodyMesh.add(collar);
    
    // Chest Plate
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.12), robeMat);
    chestPlate.position.set(0, 0.52, 0.08);
    chestPlate.rotation.x = 0.1;
    this.bodyMesh.add(chestPlate);
    
    // Chest Gear (Clockwork style with teeth)
    this.chestGear = new THREE.Group();
    this.chestGear.position.set(0, 0.52, 0.15);
    this.chestGear.rotation.x = 0.1; // align with chest plate
    this.bodyMesh.add(this.chestGear);
    
    const gearCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), goldMat);
    gearCenter.rotation.x = Math.PI / 2;
    this.chestGear.add(gearCenter);
    
    // Gear teeth
    for (let g = 0; g < 8; g++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.025), goldMat);
        const angle = (g / 8) * Math.PI * 2;
        tooth.position.set(Math.cos(angle) * 0.065, Math.sin(angle) * 0.065, 0);
        tooth.rotation.z = angle;
        this.chestGear.add(tooth);
    }
    
    // Chest Core Emitter
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), coreMat);
    core.position.set(0, 0.52, 0.15);
    this.bodyMesh.add(core);

    // Back Engine Power Pack
    const backPack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 8), voidMat);
    backPack.position.set(0, 0.52, -0.14);
    backPack.rotation.x = Math.PI / 2;
    this.bodyMesh.add(backPack);
    
    const backPackCore = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), coreMat);
    backPackCore.position.set(0, 0.52, -0.16);
    this.bodyMesh.add(backPackCore);

    // Mystic Coat tailcoat panels (Split coat) - hexagon arrangement, double-layered for premium glow!
    this.robePanels = [];
    this.robeLiners = [];
    const robeGroup = new THREE.Group();
    robeGroup.position.y = 0.15;
    this.bodyMesh.add(robeGroup);
    
    // 6 panels for hexagon split coat
    const panelAngles = [0, Math.PI / 3, Math.PI * 2 / 3, Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3];
    panelAngles.forEach((angle) => {
        const panelPivot = new THREE.Group();
        panelPivot.position.set(Math.cos(angle) * 0.22, 0, Math.sin(angle) * 0.22);
        panelPivot.rotation.y = -angle + Math.PI / 2;
        panelPivot.rotation.x = 0.18; // flare out
        
        // Outer panel (Void fabric)
        const outerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.02), voidMat);
        outerPanel.position.y = -0.35;
        panelPivot.add(outerPanel);
        
        // Inner glowing liner
        const innerLiner = new THREE.Mesh(new THREE.BoxGeometry(0.146, 0.71, 0.01), coreMat);
        innerLiner.position.set(0, -0.355, -0.008);
        panelPivot.add(innerLiner);
        
        // Gold trim runic stripes on the coat panels
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.025), goldMat);
        stripe.position.set(0, -0.3, 0.015);
        panelPivot.add(stripe);
        
        // Runic crystal bead
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), coreMat);
        bead.position.set(0, -0.55, 0.02);
        panelPivot.add(bead);
        
        robeGroup.add(panelPivot);
        this.robePanels.push(panelPivot);
    });

    // Épaules: Concentric Prismatic Rings (astrolabe-like dual rings)
    this.shoulderRingL1 = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 24), goldMat);
    this.shoulderRingL1.position.set(0.38, 0.72, 0);
    this.bodyMesh.add(this.shoulderRingL1);
    this.shoulderRingL2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 20), glassMat);
    this.shoulderRingL2.position.set(0.38, 0.72, 0);
    this.bodyMesh.add(this.shoulderRingL2);
    this.shoulderRingL = this.shoulderRingL1; // for backward compatibility
    
    this.shoulderRingR1 = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 24), goldMat);
    this.shoulderRingR1.position.set(-0.38, 0.72, 0);
    this.bodyMesh.add(this.shoulderRingR1);
    this.shoulderRingR2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 20), glassMat);
    this.shoulderRingR2.position.set(-0.38, 0.72, 0);
    this.bodyMesh.add(this.shoulderRingR2);
    this.shoulderRingR = this.shoulderRingR1; // for backward compatibility

    // Bras (Conduits énergétiques) & Mains (Gants optiques)
    const armUpperGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.3);
    
    // Left Arm
    this.armL = new THREE.Group();
    this.armL.position.set(0.36, 0.62, 0);
    this.bodyMesh.add(this.armL);
    const upperArmL = new THREE.Mesh(armUpperGeo, voidMat);
    upperArmL.position.y = -0.12;
    this.armL.add(upperArmL);
    
    const conduitL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.22), glassMat);
    conduitL.position.y = -0.28;
    this.armL.add(conduitL);
    
    // Brass support rails around conduit
    for (let r = 0; r < 3; r++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.22, 0.01), goldMat);
        const angle = (r / 3) * Math.PI * 2;
        rail.position.set(Math.cos(angle) * 0.058, -0.28, Math.sin(angle) * 0.058);
        rail.rotation.y = angle;
        this.armL.add(rail);
    }
    
    // Flowing energy core nodes inside conduit
    this.armLNodes = [];
    for (let n = 0; n < 3; n++) {
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), coreMat);
        node.position.y = -0.28;
        this.armL.add(node);
        this.armLNodes.push(node);
    }
    
    const gauntletL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), whiteArmor);
    gauntletL.position.y = -0.4;
    this.armL.add(gauntletL);
    
    // Finger plate armor segments on hand
    const fingerL1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), voidMat);
    fingerL1.position.set(0.02, -0.44, 0.02);
    this.armL.add(fingerL1);
    const fingerL2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), voidMat);
    fingerL2.position.set(-0.02, -0.44, 0.02);
    this.armL.add(fingerL2);
    
    const gloveLensL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), coreMat);
    gloveLensL.position.set(0, -0.45, 0.04);
    this.armL.add(gloveLensL);

    // Right Arm
    this.armR = new THREE.Group();
    this.armR.position.set(-0.36, 0.62, 0);
    this.bodyMesh.add(this.armR);
    const upperArmR = new THREE.Mesh(armUpperGeo, voidMat);
    upperArmR.position.y = -0.12;
    this.armR.add(upperArmR);
    
    const conduitR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.22), glassMat);
    conduitR.position.y = -0.28;
    this.armR.add(conduitR);
    
    for (let r = 0; r < 3; r++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.22, 0.01), goldMat);
        const angle = (r / 3) * Math.PI * 2;
        rail.position.set(Math.cos(angle) * 0.058, -0.28, Math.sin(angle) * 0.058);
        rail.rotation.y = angle;
        this.armR.add(rail);
    }
    
    this.armRNodes = [];
    for (let n = 0; n < 3; n++) {
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), coreMat);
        node.position.y = -0.28;
        this.armR.add(node);
        this.armRNodes.push(node);
    }
    
    const gauntletR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), whiteArmor);
    gauntletR.position.y = -0.4;
    this.armR.add(gauntletR);
    
    const fingerR1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), voidMat);
    fingerR1.position.set(0.02, -0.44, 0.02);
    this.armR.add(fingerR1);
    const fingerR2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), voidMat);
    fingerR2.position.set(-0.02, -0.44, 0.02);
    this.armR.add(fingerR2);
    
    const gloveLensR = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), coreMat);
    gloveLensR.position.set(0, -0.45, 0.04);
    this.armR.add(gloveLensR);

    // Ceinture with Suspended Magnifying Lenses & Clockwork gears
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 20), goldMat);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.16;
    this.bodyMesh.add(belt);
    
    // Central mechanical gear on belt buckle
    this.beltGear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), goldMat);
    this.beltGear.position.set(0, 0.16, 0.22);
    this.beltGear.rotation.x = Math.PI / 2;
    this.bodyMesh.add(this.beltGear);
    
    const beltGearCore = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), coreMat);
    this.beltGear.add(beltGearCore);
    
    this.lensGroup = new THREE.Group();
    this.lensGroup.position.set(0, 0.16, 0);
    this.bodyMesh.add(this.lensGroup);
    
    this.suspendedLenses = [];
    const lensAngles = [-0.6, 0.6, Math.PI];
    lensAngles.forEach((angle, idx) => {
        const lensHolder = new THREE.Group();
        lensHolder.position.set(Math.cos(angle) * 0.24, 0, Math.sin(angle) * 0.24);
        
        // Mechanical rod bracket
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12), goldMat);
        chain.position.y = -0.06;
        lensHolder.add(chain);
        
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 12), goldMat);
        frame.position.y = -0.16;
        frame.rotation.y = angle;
        lensHolder.add(frame);
        
        const glassPane = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 8), glassMat);
        glassPane.position.y = -0.16;
        glassPane.rotation.x = Math.PI / 2;
        glassPane.rotation.y = angle;
        lensHolder.add(glassPane);
        
        // Internal ticking compass pointer
        const needle = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.04, 0.005), coreMat);
        needle.position.y = -0.16;
        needle.rotation.y = angle;
        lensHolder.add(needle);
        
        lensHolder.userData = { needle };
        
        this.lensGroup.add(lensHolder);
        this.suspendedLenses.push(lensHolder);
    });

    // Helmet & Optical Mask with flowy Bluish Hair
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.88;
    this.bodyMesh.add(this.headGroup);
    
    const helmetBase = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), voidMat);
    helmetBase.scale.set(1, 1.1, 1.15);
    this.headGroup.add(helmetBase);
    
    // Side metallic antenna wings (like chronos-horns)
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), goldMat);
    earL.position.set(0.14, 0.05, -0.02);
    earL.rotation.set(0.2, 0, -0.5);
    this.headGroup.add(earL);
    
    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), goldMat);
    earR.position.set(-0.14, 0.05, -0.02);
    earR.rotation.set(0.2, 0, 0.5);
    this.headGroup.add(earR);
    
    const faceFrame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), goldMat);
    faceFrame.position.set(0, -0.02, 0.1);
    this.headGroup.add(faceFrame);
    
    // Visor: Ticking HUD holographic ring
    this.visorRing = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.004, 4, 16), coreMat);
    this.visorRing.position.set(0, 0.02, 0.13);
    this.headGroup.add(this.visorRing);
    
    const mainLens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.03, 16), coreMat);
    mainLens.rotation.x = Math.PI / 2;
    mainLens.position.set(0, 0.02, 0.125);
    this.headGroup.add(mainLens);
    
    const scopeL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04), goldMat);
    scopeL.rotation.x = Math.PI / 2;
    scopeL.position.set(0.04, -0.05, 0.12);
    this.headGroup.add(scopeL);
    
    const scopeLLens = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.005), coreMat);
    scopeLLens.rotation.x = Math.PI / 2;
    scopeLLens.position.set(0.04, -0.05, 0.14);
    this.headGroup.add(scopeLLens);
    
    const scopeR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04), goldMat);
    scopeR.rotation.x = Math.PI / 2;
    scopeR.position.set(-0.04, -0.05, 0.12);
    this.headGroup.add(scopeR);
    
    const scopeRLens = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.005), coreMat);
    scopeRLens.rotation.x = Math.PI / 2;
    scopeRLens.position.set(-0.04, -0.05, 0.14);
    this.headGroup.add(scopeRLens);
    
    // Layered, flowing spiky bluish hair
    const hairGroup = new THREE.Group();
    hairGroup.position.set(0, 0.05, -0.08);
    this.headGroup.add(hairGroup);
    
    // Build neat geometric hair strands arranged in rows
    const hairSpikes = [
      { size: [0.03, 0.32], pos: [0, 0.12, -0.02], rot: [-0.4, 0, 0] },
      { size: [0.025, 0.28], pos: [0.06, 0.08, -0.04], rot: [-0.3, 0.2, 0.15] },
      { size: [0.025, 0.28], pos: [-0.06, 0.08, -0.04], rot: [-0.3, -0.2, -0.15] },
      { size: [0.02, 0.24], pos: [0.09, 0.02, -0.06], rot: [-0.2, 0.4, 0.3] },
      { size: [0.02, 0.24], pos: [-0.09, 0.02, -0.06], rot: [-0.2, -0.4, -0.3] },
      { size: [0.025, 0.3], pos: [0, -0.02, -0.08], rot: [-0.5, 0, 0] },
      { size: [0.02, 0.26], pos: [0.04, -0.06, -0.1], rot: [-0.6, 0.1, 0.1] },
      { size: [0.02, 0.26], pos: [-0.04, -0.06, -0.1], rot: [-0.6, -0.1, -0.1] }
    ];
    
    hairSpikes.forEach((spike) => {
        const geom = new THREE.ConeGeometry(spike.size[0], spike.size[1], 4);
        geom.rotateX(-Math.PI / 2.5); // Slanted back
        const strand = new THREE.Mesh(geom, hairMat);
        strand.position.set(spike.pos[0], spike.pos[1], spike.pos[2]);
        strand.rotation.set(spike.rot[0], spike.rot[1], spike.rot[2]);
        hairGroup.add(strand);
    });

    // Holographic Prismatic Cape (overlapping glass shard panels)
    this.cape = new THREE.Group();
    this.cape.position.set(0, 0.75, -0.15);
    this.bodyMesh.add(this.cape);
    
    const panelGeoL = new THREE.BoxGeometry(0.12, 0.85, 0.01);
    panelGeoL.translate(0, -0.42, 0);
    
    this.capePanelL = new THREE.Mesh(panelGeoL, capeMat);
    this.capePanelL.position.set(0.12, 0, -0.05);
    this.capePanelL.rotation.set(0.18, 0, -0.1);
    this.cape.add(this.capePanelL);
    
    // Runic stripe on left cape
    const capeStripeL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.7, 0.012), coreMat);
    capeStripeL.position.set(0, -0.4, 0.005);
    this.capePanelL.add(capeStripeL);
    
    this.capePanelR = new THREE.Mesh(panelGeoL, capeMat);
    this.capePanelR.position.set(-0.12, 0, -0.05);
    this.capePanelR.rotation.set(0.18, 0, 0.1);
    this.cape.add(this.capePanelR);
    
    // Runic stripe on right cape
    const capeStripeR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.7, 0.012), coreMat);
    capeStripeR.position.set(0, -0.4, 0.005);
    this.capePanelR.add(capeStripeR);
    
    const panelGeoC = new THREE.BoxGeometry(0.22, 0.95, 0.01);
    panelGeoC.translate(0, -0.47, 0);
    this.capePanelC = new THREE.Mesh(panelGeoC, capeMat);
    this.capePanelC.position.set(0, 0, -0.08);
    this.capePanelC.rotation.set(0.22, 0, 0);
    this.cape.add(this.capePanelC);
    
    // Runic stripe on center cape
    const capeStripeC = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.8, 0.012), coreMat);
    capeStripeC.position.set(0, -0.45, 0.005);
    this.capePanelC.add(capeStripeC);

    // High-Tech Weapon: Cannon-multifocalities with double scopes (carried like a rifle)
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(-0.35, 0.45, 0.15);
    this.bodyMesh.add(this.weaponGroup);
    
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4), goldMat);
    stock.position.set(0, 0, -0.1);
    this.weaponGroup.add(stock);
    
    // Glowing chamber inside weapon
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.15, 8), glassMat);
    chamber.rotation.x = Math.PI / 2;
    chamber.position.set(0, 0.04, 0.1);
    this.weaponGroup.add(chamber);
    
    const chamberCore = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), coreMat);
    chamberCore.position.set(0, 0.04, 0.1);
    this.weaponGroup.add(chamberCore);
    this.weaponChamberCore = chamberCore; // Store to pulse it
    
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1), voidMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, 0.35);
    this.weaponGroup.add(barrel);
    
    // Sliding Focus Rings on Barrel
    this.barrelRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 4, 12), goldMat);
    this.barrelRing1.position.set(0, 0.04, 0.5);
    this.barrelRing1.rotation.x = Math.PI / 2;
    this.weaponGroup.add(this.barrelRing1);
    
    this.barrelRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 4, 12), goldMat);
    this.barrelRing2.position.set(0, 0.04, 0.7);
    this.barrelRing2.rotation.x = Math.PI / 2;
    this.weaponGroup.add(this.barrelRing2);
    
    // Double Scopes with Floating reticles
    const scope1 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22), goldMat);
    scope1.rotation.x = Math.PI / 2;
    scope1.position.set(0.025, 0.12, 0.3);
    this.weaponGroup.add(scope1);
    const scope1Lens = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.005), coreMat);
    scope1Lens.rotation.x = Math.PI / 2;
    scope1Lens.position.set(0.025, 0.12, 0.41);
    this.weaponGroup.add(scope1Lens);
    
    // Floating Reticle 1
    this.reticle1 = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 4, 8), coreMat);
    this.reticle1.position.set(0.025, 0.12, 0.42);
    this.weaponGroup.add(this.reticle1);
    
    const scope2 = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22), goldMat);
    scope2.rotation.x = Math.PI / 2;
    scope2.position.set(-0.025, 0.12, 0.3);
    this.weaponGroup.add(scope2);
    const scope2Lens = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.005), coreMat);
    scope2Lens.rotation.x = Math.PI / 2;
    scope2Lens.position.set(-0.025, 0.12, 0.41);
    this.weaponGroup.add(scope2Lens);
    
    // Floating Reticle 2
    this.reticle2 = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 4, 8), coreMat);
    this.reticle2.position.set(-0.025, 0.12, 0.42);
    this.weaponGroup.add(this.reticle2);
    
    // Flared Muzzle core funnel
    const emitter = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), goldMat);
    emitter.position.set(0, 0.04, 0.9);
    this.weaponGroup.add(emitter);
    
    const emitterCore = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), coreMat);
    emitterCore.position.set(0, 0.04, 0.9);
    this.weaponGroup.add(emitterCore);
    this.chronoOrb = emitterCore; // Barrel tip core functions as Chrono Orb
    
    if (isApex) {
        this.muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.006, 6, 16), coreMat.clone());
        this.muzzleRing.position.set(0, 0.04, 0.92);
        this.weaponGroup.add(this.muzzleRing);
    }

    // Permanent accessories: 3 Refined Prisms orbiting, with double-layered crystal shell & active laser links
    this.orbitPrismsGroup = new THREE.Group();
    this.bodyMesh.add(this.orbitPrismsGroup);
    this.orbitPrisms = [];
    for (let i = 0; i < 3; i++) {
        const prism = new THREE.Group();
        const prismCoreMat = coreMat.clone();
        prismCoreMat.emissiveIntensity = 3.0;
        
        // Inner luminous core
        const coreCone1 = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 3), prismCoreMat);
        coreCone1.position.y = 0.03;
        prism.add(coreCone1);
        const coreCone2 = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 3), prismCoreMat);
        coreCone2.position.y = -0.03;
        coreCone2.rotation.x = Math.PI;
        prism.add(coreCone2);
        
        // Outer glass refraction shell (slightly larger, rotated to offset facets)
        const outerPrism = new THREE.Group();
        outerPrism.rotation.y = Math.PI / 6;
        
        const outerCone1 = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.08, 3), glassMat);
        outerCone1.position.y = 0.04;
        outerPrism.add(outerCone1);
        const outerCone2 = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.08, 3), glassMat);
        outerCone2.position.y = -0.04;
        outerCone2.rotation.x = Math.PI;
        outerPrism.add(outerCone2);
        
        prism.add(outerPrism);
        
        this.orbitPrismsGroup.add(prism);
        this.orbitPrisms.push(prism);
    }
    
    // Laser lines connecting the 3 orbiting prisms into a triangular cage
    this.prismLasers = [];
    for (let i = 0; i < 3; i++) {
        const laser = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 4), coreMat);
        this.orbitPrismsGroup.add(laser);
        this.prismLasers.push(laser);
    }

    // Apex Luminous Aura (Full-body shell & ticking floor clock, back halo, scrolling runic data)
    if (isApex) {
        // Wireframe body shell
        this.apexAuraWire = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.68, 2),
            new THREE.MeshBasicMaterial({
                color: 0x00f3ff,
                wireframe: true,
                transparent: true,
                opacity: 0.05,
                blending: THREE.AdditiveBlending
            })
        );
        this.bodyMesh.add(this.apexAuraWire);
        
        // Solid glow body shell
        this.apexAuraSolid = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.64, 2),
            new THREE.MeshBasicMaterial({
                color: 0x00d2ff,
                transparent: true,
                opacity: 0.025,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        this.bodyMesh.add(this.apexAuraSolid);
        
        // 1. Ticking Floor Clock Circle
        this.floorClockRing = new THREE.Group();
        this.floorClockRing.position.set(0, -0.68, 0); // floor level
        this.bodyMesh.add(this.floorClockRing);
        
        const floorRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.008, 4, 32), coreMat);
        floorRing.rotation.x = Math.PI / 2;
        this.floorClockRing.add(floorRing);
        
        // 12 ticks for clock hours
        for (let t = 0; t < 12; t++) {
            const tick = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.04), goldMat);
            const angle = (t / 12) * Math.PI * 2;
            tick.position.set(Math.cos(angle) * 0.55, 0, Math.sin(angle) * 0.55);
            tick.rotation.y = -angle;
            this.floorClockRing.add(tick);
        }
        
        // 2. Vertical Clock Halo on Back
        this.backHaloRing = new THREE.Group();
        this.backHaloRing.position.set(0, 0.65, -0.2);
        this.bodyMesh.add(this.backHaloRing);
        
        const haloTorus = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 4, 24), coreMat);
        this.backHaloRing.add(haloTorus);
        
        // Inner rotating gear on back halo
        this.haloGear = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.006, 4, 16), goldMat);
        this.backHaloRing.add(this.haloGear);
        
        // Ticking halo hand
        const haloHand = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.14, 0.006), goldMat);
        haloHand.position.y = 0.07;
        this.backHaloRing.add(haloHand);
        
        // 3. Scrolling Runic Data Panels (4 around player)
        this.temporalRunes = [];
        const paneMat = new THREE.MeshBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.06,
            blending: THREE.AdditiveBlending
        });
        for (let r = 0; r < 4; r++) {
            const pane = new THREE.Group();
            
            // A small thin panel
            const panelMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.002), paneMat);
            pane.add(panelMesh);
            
            // Random small nodes on the panel to simulate runic symbols
            for (let s = 0; s < 4; s++) {
                const symbol = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.004), goldMat);
                symbol.position.set((Math.random() - 0.5) * 0.04, -0.15 + s * 0.1, 0.002);
                pane.add(symbol);
            }
            
            const angle = (r / 4) * Math.PI * 2;
            pane.position.set(Math.cos(angle) * 0.5, 0.2 + Math.random() * 0.4, Math.sin(angle) * 0.5);
            pane.rotation.y = -angle + Math.PI / 2;
            
            this.bodyMesh.add(pane);
            this.temporalRunes.push(pane);
        }
    }
  }

  createLeg(mat1, mat2, mat3, x, y) {
      const group = new THREE.Group();
      group.position.set(x, y, 0);
      
      // Slender leg with light geometric armor plate
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.32), mat2);
      thigh.position.y = -0.15;
      group.add(thigh);
      
      // Tapered thigh plate
      const thighPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.06), mat1);
      thighPlate.position.set(0, -0.15, 0.03);
      thighPlate.rotation.x = 0.05;
      group.add(thighPlate);
      
      const knee = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12), mat3);
      knee.position.y = -0.32;
      knee.rotation.y = Math.PI / 2;
      group.add(knee);
      
      // Hydraulic Knee Piston
      const pistonOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12), mat2);
      pistonOuter.position.set(0, -0.32, -0.04);
      group.add(pistonOuter);
      
      const pistonInner = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14), mat3);
      pistonInner.position.set(0, -0.32, -0.04);
      group.add(pistonInner);
      
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.32), mat2);
      shin.position.y = -0.48;
      group.add(shin);
      
      // Tapered shin plate
      const shinPlate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.06), mat1);
      shinPlate.position.set(0, -0.48, 0.02);
      shinPlate.rotation.x = 0.05;
      group.add(shinPlate);
      
      // Levitating Boot
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.14), mat1);
      boot.position.set(0, -0.66, 0.03);
      group.add(boot);
      
      // Repulsor ring under boot sole
      const thruster = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 12), mat3);
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(0, -0.71, 0.03);
      group.add(thruster);
      
      const energyPad = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.006, 8), mat3.clone());
      energyPad.material.color.setHex(0x00f3ff);
      energyPad.material.emissive.setHex(0x00aaff);
      energyPad.material.emissiveIntensity = 2.0;
      energyPad.position.set(0, -0.705, 0.03);
      group.add(energyPad);
      
      // Floating projection clock ring below boot sole
      const bootClockRingMat = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending
      });
      const bootClockRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.004, 4, 12), bootClockRingMat);
      bootClockRing.rotation.x = Math.PI / 2;
      bootClockRing.position.set(0, -0.73, 0.03);
      group.add(bootClockRing);
      
      // Boot thruster wave 1 & 2 (expanding rings)
      const waveMat1 = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
      });
      const thrusterWave1 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 8), waveMat1);
      thrusterWave1.rotation.x = Math.PI / 2;
      thrusterWave1.position.set(0, -0.725, 0.03);
      group.add(thrusterWave1);
      
      const waveMat2 = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
      });
      const thrusterWave2 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 4, 8), waveMat2);
      thrusterWave2.rotation.x = Math.PI / 2;
      thrusterWave2.position.set(0, -0.725, 0.03);
      group.add(thrusterWave2);
      
      group.userData = {
          thruster: thruster,
          energyPad: energyPad,
          bootClockRing: bootClockRing,
          thrusterWave1: thrusterWave1,
          thrusterWave2: thrusterWave2
      };
      
      return group;
  }


  getAimDir() {
    if (!this.isLocalPlayer()) {
      if (this.netAimDir && this.netAimDir.lengthSq() > 0.001) {
        return this.netAimDir.clone().normalize();
      }
      if (this.netRotation !== undefined) {
        return new THREE.Vector3(Math.sin(this.netRotation), 0, Math.cos(this.netRotation)).normalize();
      }
    }
    if (!Globals.camera) return new THREE.Vector3(0, 0, 1);
    STATE.raycaster.setFromCamera(STATE.mouse, Globals.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!STATE.raycaster.ray.intersectPlane(plane, hit)) {
      const d = new THREE.Vector3(0, 0, 1);
      if (this.mesh) d.applyQuaternion(this.mesh.quaternion);
      return d.normalize();
    }
    const dir = hit.clone().sub(this.position);
    dir.y = 0;
    return dir.length() > 0.01 ? dir.normalize() : new THREE.Vector3(0, 0, 1);
  }

  getEnemyId(enemy) {
    return enemy.netId || enemy.uuid || `${enemy.position.x}-${enemy.position.z}`;
  }

  getBeamVisualOrigin(out = new THREE.Vector3()) {
    if (this.chronoOrb) {
      this.chronoOrb.getWorldPosition(out);
      return out;
    }
    if (this.weaponGroup) {
      this.weaponGroup.getWorldPosition(out);
      out.y += 0.45;
      return out;
    }
    return this.getBeamHitOrigin(out);
  }

  getBeamHitOrigin(out = new THREE.Vector3()) {
    return out.copy(this.position).add(new THREE.Vector3(0, 1.05, 0));
  }

  getBeamTickInterval() {
    const atkSpd = STATE.stats.attackSpeedMod || 1;
    const effective = 1 + (atkSpd - 1) * CHRONO_BEAM.atkSpdImpact;
    return CHRONO_BEAM.tickBase * effective;
  }

  getFractureFillRate() {
    return this.getFractureCap() / CHRONO_FRACTURE.fillTime;
  }

  getSkillFractureCost() {
    return STATE.passives?.anachronismeAmp ? 25 : CHRONO_FRACTURE.skillCost;
  }

  getFractureCap() {
    return getMaxFracture();
  }

  getFractureOverheatAt() {
    return getFractureOverheatAt();
  }

  isChronoSilenced() {
    return this.fractureSilence > 0;
  }

  isInOverloadReleaseWindow() {
    return isInOverloadReleaseWindow(this.fractureGauge);
  }

  getAscendantMax() {
    return CHRONO_ASCENDANT.max;
  }

  getBeamTickDmgMult() {
    let mult = STATE.passives?.continuumBurst ? 1.12 : 1;
    if (STATE.passives?.ruptureSurge) mult *= 1.08;
    if (this.isConverging) mult *= 1 + CHRONO_SKILLS.convergence.beamDmgBonus;
    return mult;
  }

  getConvergenceDuration() {
    let dur = CHRONO_SKILLS.convergence.duration;
    if (STATE.passives?.continuumBurst) dur += 0.5;
    return dur;
  }

  getConvergenceResonanceRadius() {
    let r = CHRONO_SKILLS.convergence.resonanceRadius;
    if (STATE.passives?.continuumBurst) r += 0.5;
    return r;
  }

  getConvergenceFinaleRadius() {
    let r = CHRONO_SKILLS.convergence.finaleRadius;
    if (STATE.passives?.continuumBurst) r += 0.5;
    return r;
  }

  getMovementSpeedMult() {
    let mult = 1;
    if (this.isConverging) {
      if (this.castAnimType === 'lens') {
        return 0.4; // 60% movement speed reduction
      }
      mult *= 1 + CHRONO_SKILLS.convergence.moveSpeedBonus;
    }
    if (this.isBeaming) mult *= 0.5;
    return mult;
  }

  getConvergencePullTarget(out = new THREE.Vector3()) {
    const hitOrigin = this.getBeamHitOrigin();
    const dir = this.getAimDir();
    if (this.isBeaming && Globals.enemies) {
      const { length, enemy } = getBeamHitInfo(hitOrigin, dir, Globals.enemies, this.getBeamFractureSizeMult());
      if (enemy) return enemy.position.clone();
      return hitOrigin.clone().add(dir.clone().multiplyScalar(Math.max(2, length * 0.55)));
    }
    return out.copy(hitOrigin).add(dir.clone().multiplyScalar(6));
  }

  getOverheatBacklashMult() {
    return 1;
  }

  isOverloadImminenceActive() {
    return isOverloadImminenceActive(this.fractureGauge);
  }

  isFractureAttacking() {
    return this.isBeaming || this.isConverging;
  }

  resetFractureActivity() {
    if (!this.fractureDecayState) this.fractureDecayState = createFractureDecayState();
    resetFractureDecayState(this.fractureDecayState);
  }

  tickFractureDecay(dt) {
    if (!this.isLocalPlayer() || this.dead) return;
    if (!this.fractureDecayState) this.fractureDecayState = createFractureDecayState();
    this.fractureGauge = tickFractureDecay(
      this.fractureGauge,
      this.fractureDecayState,
      dt,
      this.isFractureAttacking(),
    );
  }

  triggerOverloadImminenceRelease() {
    if (!this.isInOverloadReleaseWindow()) return;

    const pos = this.position.clone();
    const { radius, dmgMult } = CHRONO_FRACTURE.overloadImminenceProc;
    const surge = STATE.passives?.ruptureSurge ? 1.35 : 1;
    const scale = this.fractureGauge / this.getFractureOverheatAt();
    const blastDmg = STATE.stats.atk * dmgMult * scale * surge;

    createSkillVisual('nova', pos, radius, 0xffd93d, null);
    spawnParticles(pos, 0xffd93d, 18);
    createDamageText('DÉSURCHARGE!', pos, '#ffd93d');

    if (Globals.enemies) {
      for (const e of Globals.enemies) {
        if (e.dead) continue;
        if (e.position.distanceTo(pos) <= radius + (e.radius || 0.5)) {
          this.dealMagicDamage(e, blastDmg, { skill: true, skillKey: 'primary' });
        }
      }
    }

    const reduction = getMaxFracture() * CHRONO_FRACTURE.overloadReleaseReductionPct;
    this.fractureGauge = clampFracture(this.fractureGauge - reduction);
    this.resetFractureActivity();
  }

  dealMagicDamage(enemy, baseDmg, { skill = false, skillKey = 'primary', prismDepth = 0, beamRay = false } = {}) {
    if (!enemy || enemy.dead) return 0;
    let dmg = baseDmg * ConvergenceEffects.getPrismBeamDmgMult(prismDepth);
    if (beamRay) {
      dmg *= ConvergenceEffects.getFractureDamageMult(this.fractureGauge || 0);
    }
    dmg = ConstellationEngine.modifyDamageDealt(dmg, { skill, skillKey });
    if (enemy._temporalVuln?.timer > 0) dmg *= enemy._temporalVuln.mult || 1.2;

    const prismCrit = ConvergenceEffects.getPrismCritMods(prismDepth);

    const { dmg: dealt } = dealDamageToEnemy(enemy, dmg, {
      pos: enemy.position,
      forceCrit: prismCrit.forceCrit,
      critDmgMult: prismCrit.critDmgMult,
      skillKey,
      isRanged: true,
      critLabel: prismCrit.forceCrit ? 'PRISME!' : undefined,
      critColor: prismCrit.forceCrit ? '#7df9ff' : undefined,
    });

    if (dealt > 0 && prismDepth > 0) {
      applyChronoTemporalBurn(enemy, dealt);
    }

    if (dealt > 0) this.resetFractureActivity();
    return dealt;
  }

  isEnemyInstabilityMarked(enemy) {
    return enemy && (enemy._chronoInstabilityTimer || 0) > 0;
  }

  hasActiveInstabilityMark() {
    if (!Globals.enemies) return false;
    return Globals.enemies.some((e) => !e.dead && this.isEnemyInstabilityMarked(e));
  }

  applyInstabilityMark(enemy, durationSec) {
    if (!enemy || enemy.dead) return;
    enemy._chronoInstabilityTimer = durationSec;
    createDamageText('INSTABLE', enemy.position, '#f39c12');
  }

  emitResonanceWave(sourceEnemy, tickDmg) {
    const radius = this.getConvergenceResonanceRadius();
    const waveDmg = tickDmg * CHRONO_SKILLS.convergence.resonanceDmgMult;
    createSkillVisual('nova', sourceEnemy.position, radius, 0xffd93d, null);
    spawnParticles(sourceEnemy.position, 0xf39c12, 6);

    if (!Globals.enemies) return;
    for (const other of Globals.enemies) {
      if (other.dead || other === sourceEnemy) continue;
      if (other.position.distanceTo(sourceEnemy.position) <= radius + (other.radius || 0.5)) {
        this.dealMagicDamage(other, waveDmg, { skill: true, skillKey: 'e' });
      }
    }
  }

  updateConvergencePull(dt) {
    if (!this.isConverging || !Globals.enemies) return;
    const target = this.getConvergencePullTarget();
    const pullSpeed = CHRONO_SKILLS.convergence.pullSpeed;

    for (const enemy of Globals.enemies) {
      if (enemy.dead || !this.isEnemyInstabilityMarked(enemy)) continue;
      const pull = target.clone().sub(enemy.position);
      pull.y = 0;
      const dist = pull.length();
      if (dist < 0.35) continue;
      pull.normalize();
      enemy.position.add(pull.multiplyScalar(Math.min(pullSpeed * dt, dist * 0.35)));
    }
  }

  getEnemiesInCone(dir, range, minDot) {
    const hits = [];
    if (!Globals.enemies) return hits;

    for (const enemy of Globals.enemies) {
      if (enemy.dead) continue;
      const toEnemy = enemy.position.clone().sub(this.position);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist > range + (enemy.radius || 0.5)) continue;
      if (dist < 0.05) {
        hits.push(enemy);
        continue;
      }
      if (toEnemy.normalize().dot(dir) >= minDot) hits.push(enemy);
    }
    return hits;
  }

  recordBeamDamage(enemy, dmg) {
    if (!dmg || !enemy) return;
    const id = this.getEnemyId(enemy);
    this.beamDamageLog.push({ id, enemy, dmg, t: performance.now() });
    const cutoff = performance.now() - CHRONO_BEAM.logMs;
    this.beamDamageLog = this.beamDamageLog.filter((e) => e.t >= cutoff);
  }

  getAscendantMult() {
    const cap = this.getAscendantMax();
    return 1 + Math.min(cap, (this.beamFocusTime / CHRONO_ASCENDANT.ramp) * cap);
  }

  getBeamFractureSizeMult() {
    return ConvergenceEffects.getFractureBeamSizeMult(this.fractureGauge || 0);
  }

  getBeamFractureVisualSizeMult() {
    const gameplayScale = this.getBeamFractureSizeMult();
    return 1 + (gameplayScale - 1) * 5;
  }

  getActiveLens(origin, dir) {
    for (const lens of this.lenses) {
      if (lens.timer > 0 && rayHitsLens(origin, dir, lens)) return lens;
    }
    return null;
  }

  createBeamMesh(synced = false) {
    const electric = this.isConverging;
    const group = new THREE.Group();
    group.userData.electric = electric;

    if (electric) {
      const core = new THREE.Mesh(
        getBeamSharedGeometry('elec_core', () => new THREE.CylinderGeometry(0.02, 0.03, 1, 4)),
        getBeamSharedMaterial('elec_core_mat', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })),
      );
      const glow = new THREE.Mesh(
        getBeamSharedGeometry('elec_glow', () => new THREE.CylinderGeometry(0.09, 0.12, 1, 6)),
        getBeamSharedMaterial('elec_glow_mat', () => new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.4 })),
      );
      const corona = new THREE.Mesh(
        getBeamSharedGeometry('elec_corona', () => new THREE.CylinderGeometry(0.2, 0.3, 1, 6)),
        getBeamSharedMaterial('elec_corona_mat', () => new THREE.MeshBasicMaterial({ color: 0x8866ff, transparent: true, opacity: 0.2 })),
      );
      const arcShell = new THREE.Mesh(
        getBeamSharedGeometry('elec_arcShell', () => new THREE.CylinderGeometry(0.28, 0.38, 1, 8)),
        getBeamSharedMaterial('elec_arcShell_mat', () => new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.08 })),
      );
      group.add(arcShell, corona, glow, core);
    } else {
      const color = CHRONO_COLOR();
      const core = new THREE.Mesh(
        getBeamSharedGeometry('norm_core', () => new THREE.CylinderGeometry(0.025, 0.035, 1, 6)),
        getBeamSharedMaterial(`norm_core_mat_${synced}`, () => new THREE.MeshBasicMaterial({ color: synced ? 0xffd93d : 0xffffff, transparent: true, opacity: 0.42 })),
      );
      const glow = new THREE.Mesh(
        getBeamSharedGeometry('norm_glow', () => new THREE.CylinderGeometry(0.07, 0.1, 1, 8)),
        getBeamSharedMaterial('norm_glow_mat', () => new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.35 })),
      );
      const halo = new THREE.Mesh(
        getBeamSharedGeometry('norm_halo', () => new THREE.CylinderGeometry(0.18, 0.26, 1, 8)),
        getBeamSharedMaterial(`norm_halo_mat_${color}`, () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14 })),
      );
      group.add(halo, glow, core);
    }

    Globals.scene.add(group);
    return group;
  }

  placeElectricArcs(start, end) {
    const delta = end.clone().sub(start);
    const len = delta.length();
    if (len < 0.35) return;

    const dir = delta.clone().normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const segments = Math.max(4, Math.floor(len / 0.9));
    const points = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = start.clone().lerp(end, t);
      if (i > 0 && i < segments) {
        p.add(right.clone().multiplyScalar((Math.random() - 0.5) * 0.42));
        p.y += (Math.random() - 0.5) * 0.08;
      }
      points.push(p);
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = Math.random() > 0.5 
      ? getBeamSharedMaterial('arc_mat_1', () => new THREE.LineBasicMaterial({ color: 0xc8f7ff, transparent: true, opacity: 0.4 }))
      : getBeamSharedMaterial('arc_mat_2', () => new THREE.LineBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.4 }));
    const arc = new THREE.Line(geo, mat);
    arc.userData.electric = true;
    Globals.scene.add(arc);
    this.beamVisuals.push(arc);
  }

  updateElectricBeamFx(dt) {
    if (!this.isConverging || !this.isBeaming) return;

    const flicker = 0.65 + Math.random() * 0.35;
    for (const visual of this.beamVisuals) {
      if (visual.userData?.electric && visual.children) {
        visual.children.forEach((child, idx) => {
          if (!child.material) return;
          const base = idx === visual.children.length - 1 ? 1 : 0.15 + idx * 0.22;
          child.material.opacity = base * flicker;
        });
      } else if (visual.isLine && visual.userData?.electric && visual.material) {
        visual.material.opacity = 0.55 + Math.random() * 0.45;
      }
    }

    if (Math.random() < 0.5) {
      const origin = this.getBeamHitOrigin();
      const dir = this.getAimDir();
      const sparkPos = origin.clone().add(dir.clone().multiplyScalar(1.5 + Math.random() * 8));
      spawnParticles(sparkPos, Math.random() > 0.5 ? 0xaee8ff : 0xffffff, 2);
    }
  }

  syncConvergenceElectricSound() {
    if (!this.isLocalPlayer()) return;
    if (this.isConverging && this.isBeaming) {
      AudioSys.sfx.chrono?.electricBeam?.();
    } else {
      AudioSys.sfx.chrono?.electricBeamStop?.();
    }
  }

  destroyBeamVisuals() {
    for (const mesh of this.beamVisuals) {
      Globals.scene.remove(mesh);
      disposeObject3D(mesh);
    }
    this.beamVisuals = [];
  }

  refreshBeamVisuals() {
    if (!this.isBeaming) {
      this.destroyBeamVisuals();
      return;
    }

    this.destroyBeamVisuals();
    const mainDir = this.getAimDir();
    const staffOrigin = this.getBeamVisualOrigin();
    const prismMods = PassiveKeystoneHooks.getExtraPrismLensMods(this);
    const coneAmp = STATE.passives?.continuumBurst ? 1.15 : 1;
    const refined = ConvergenceEffects.hasRefinedPrisms();
    const routes = resolveBeamRoutes(staffOrigin, mainDir, this.lenses, coneAmp, refined, prismMods.splitCount);
    const fractureSizeMult = this.getBeamFractureSizeMult();
    const fractureVisualSizeMult = this.getBeamFractureVisualSizeMult();

    for (const seg of routes.trunk) {
      if (seg.from.distanceTo(seg.to) > 0.15) {
        this.placeBeamSegment(seg.from, seg.to, false, fractureVisualSizeMult);
      }
    }

    for (const ray of routes.rays) {
      const { length } = getBeamHitInfo(ray.origin, ray.dir, Globals.enemies, fractureSizeMult);
      const end = ray.origin.clone().add(ray.dir.clone().multiplyScalar(Math.max(1, length)));
      this.placeBeamSegment(ray.origin, end, ray.split, fractureVisualSizeMult);
    }
  }

  placeBeamSegment(start, end, split, widthScale = 1) {
    const delta = end.clone().sub(start);
    const len = delta.length();
    if (len < 0.2) return;

    const mesh = this.createBeamMesh(split);
    const dir = delta.clone().normalize();
    mesh.position.copy(start).add(end).multiplyScalar(0.5);

    const up = new THREE.Vector3(0, 1, 0);
    if (dir.dot(up) > 0.999) {
      mesh.quaternion.identity();
    } else if (dir.dot(up) < -0.999) {
      mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    } else {
      mesh.quaternion.setFromUnitVectors(up, dir);
    }

    let w = (split ? 0.85 : 1) * widthScale;
    if (this.isConverging) w *= CHRONO_SKILLS.convergence.beamVisualScale;
    mesh.children.forEach((c) => c.scale.set(w, len, w));
    this.beamVisuals.push(mesh);

    if (this.isConverging) {
      this.placeElectricArcs(start, end);
      if (Math.random() < 0.65) this.placeElectricArcs(start, end);
    }
  }

  tickDistortionBeam() {
    if (!this.isBeaming) return;
    if (STATE.multiplayer.active && (!isServerAuthority() || isVisualOnlyMode())) return;

    const hitOrigin = this.getBeamHitOrigin();
    const mainDir = this.getAimDir();
    const refined = ConvergenceEffects.hasRefinedPrisms();
    const prismMods = PassiveKeystoneHooks.getExtraPrismLensMods(this);
    const routes = resolveBeamRoutes(
      hitOrigin,
      mainDir,
      this.lenses,
      STATE.passives?.continuumBurst ? 1.15 : 1,
      refined,
      prismMods.splitCount,
    );
    const rays = dedupeBeamRays(routes.rays);
    const tickDt = this.getBeamTickInterval();
    const ascMult = this.getAscendantMult();
    const baseDmg = STATE.stats.atk * CHRONO_BEAM.tickDmg * ascMult * this.getBeamTickDmgMult();
    const fractureSizeMult = this.getBeamFractureSizeMult();

    let hitAny = false;
    let focusEnemy = null;
    const damagedThisTick = new Set();

    for (const ray of rays) {
      const { enemy } = getBeamHitInfo(ray.origin, ray.dir, Globals.enemies, fractureSizeMult);
      if (!enemy) continue;

      const eid = this.getEnemyId(enemy);
      if (damagedThisTick.has(eid)) continue;
      damagedThisTick.add(eid);

      hitAny = true;
      focusEnemy = enemy;

      let tickDmg = baseDmg;
      if (ray.split) tickDmg *= prismMods.splitDmgMult;
      if (this.isEnemyInstabilityMarked(enemy)) {
        tickDmg *= 1 + CHRONO_SKILLS.dephasing.beamMarkedBonus;
      }

      const dealt = this.dealMagicDamage(enemy, tickDmg, {
        skillKey: 'primary',
        prismDepth: ray.prismDepth || 0,
        beamRay: true,
      });
      this.recordBeamDamage(enemy, dealt);

      if (this.isConverging) {
        this.convergenceHitCount += 1;
        if (this.isEnemyInstabilityMarked(enemy)) {
          this.emitResonanceWave(enemy, tickDmg);
        }
      }
    }

    if (focusEnemy) {
      const fid = this.getEnemyId(focusEnemy);
      if (this.beamFocusId === fid) {
        this.beamFocusTime += tickDt;
      } else {
        this.beamFocusId = fid;
        this.beamFocusTime = tickDt;
      }
      if (this.beamFocusTime >= 1 && this.beamTickTimer <= 0.01) {
        if (Math.floor(this.beamFocusTime * 2) % 3 === 0) {
          createDamageText(`×${(ascMult * 100).toFixed(0)}%`, focusEnemy.position, '#ffd93d');
        }
      }
    } else {
      this.beamFocusId = null;
      this.beamFocusTime = 0;
    }

    if (this.isConverging && Math.random() < 0.6) {
      const sparkPos = hitOrigin.clone().add(mainDir.clone().multiplyScalar(2 + Math.random() * 6));
      spawnParticles(sparkPos, 0xaee8ff, 3);
    } else if (hitAny && Math.random() < 0.35) {
      spawnParticles(hitOrigin.clone().add(mainDir.clone().multiplyScalar(3)), CHRONO_COLOR(), 2);
    }
  }

  addFracture(dt, origin, dir) {
    if (!this.isBeaming || this.overheatTriggered || this.isConverging) return;
    const overheatAt = this.getFractureOverheatAt();
    if (this.fractureGauge >= overheatAt) {
      this.triggerOverheat();
      return;
    }

    let rate = this.getFractureFillRate();
    if (this.getActiveLens(origin, dir)) rate *= 0.5;
    if (this.hasActiveInstabilityMark()) {
      rate /= CHRONO_SKILLS.dephasing.fractureDivisor;
    }

    const next = this.fractureGauge + rate * dt;
    if (next >= overheatAt) {
      this.fractureGauge = overheatAt;
      this.triggerOverheat();
    } else {
      this.fractureGauge = next;
    }
  }

  triggerOverheat() {
    if (!this.isBeaming || this.overheatTriggered || this.isConverging) return;
    this.overheatTriggered = true;

    const pos = this.position.clone();
    const { radius, dmgMult } = CHRONO_SKILLS.overheat;
    createSkillVisual('nova', pos, radius, 0xff4444, null);
    spawnParticles(pos, 0xff4444, 24);
    createDamageText('SURCHAUFFE!', pos, '#ff4444');

    const blastDmg = STATE.stats.atk * dmgMult;
    if (Globals.enemies) {
      for (const e of Globals.enemies) {
        if (e.dead) continue;
        if (e.position.distanceTo(pos) <= radius) {
          this.dealMagicDamage(e, blastDmg, { skill: true, skillKey: 'primary' });
        }
      }
    }

    this.stopDistortionBeam(true);
    this.fractureGauge = 0;
    this.fractureSilence = CHRONO_FRACTURE.silence;

    const backlash = Math.max(8, this.maxHp * CHRONO_SKILLS.overheat.backlashPct * this.getOverheatBacklashMult());
    this.takeDamage(backlash);
    AudioSys.sfx.hit();
  }

  startDistortionBeam() {
    if (this.isBeaming || this.fractureSilence > 0) return;
    this.overheatTriggered = false;
    this.faceMouse();
    this.isBeaming = true;
    this.isAttacking = true;
    this.animState.rightArmOverride = true;
    this.beamTickTimer = 0;

    if (this.isConverging) {
      this.syncConvergenceElectricSound();
    } else if (AudioSys.sfx?.sentinel?.laser) {
      AudioSys.sfx.sentinel.laser();
    } else {
      AudioSys.play('shoot');
    }

    if (STATE.multiplayer.active) {
      NetChrono.sendBeamStartIntent(this.getAimDir());
    }

    this.refreshBeamVisuals();
    if (!STATE.multiplayer.active || !isServerAuthority()) {
      this.beamTickTimer = this.getBeamTickInterval();
    } else {
      this.tickDistortionBeam();
      this.beamTickTimer = this.getBeamTickInterval();
    }
  }

  /** Démarrage faisceau depuis réplication réseau (sans renvoyer d'intent). */
  startDistortionBeamNetwork() {
    if (this.isBeaming || this.fractureSilence > 0) return;
    this.isBeaming = true;
    this.isAttacking = true;
    this.animState.rightArmOverride = true;
    this.beamTickTimer = this.getBeamTickInterval();
    this.refreshBeamVisuals();
  }

  stopDistortionBeam(fromOverheat = false) {
    if (!this.isBeaming && this.beamVisuals.length === 0) return;

    if (!fromOverheat && !this.isConverging && this.isBeaming && this.isInOverloadReleaseWindow()) {
      this.triggerOverloadImminenceRelease();
    }

    this.isBeaming = false;
    this.isAttacking = false;
    this.animState.rightArmOverride = false;
    this.beamFocusId = null;
    this.beamFocusTime = 0;
    if (this.armR) this.armR.rotation.x = 0;
    if (this.chronoOrb?.material) this.chronoOrb.material.emissiveIntensity = 1.8;
    this.destroyBeamVisuals();
    this.syncConvergenceElectricSound();
    this.attackCooldown = 0.15;

    if (STATE.multiplayer.active && this.isLocalPlayer()) {
      NetChrono.sendBeamStopIntent();
    }
  }

  /** Arrêt faisceau depuis réplication réseau. */
  stopDistortionBeamNetwork() {
    if (!this.isBeaming && this.beamVisuals.length === 0) return;
    this.isBeaming = false;
    this.isAttacking = false;
    this.animState.rightArmOverride = false;
    this.beamFocusId = null;
    this.beamFocusTime = 0;
    if (this.armR) this.armR.rotation.x = 0;
    if (this.chronoOrb?.material) this.chronoOrb.material.emissiveIntensity = 1.8;
    this.destroyBeamVisuals();
  }

  updateDistortionBeam(dt) {
    if (!this.isLocalPlayer()) return;

    const canBeam = STATE.mouseDown
      && !this.isStunned
      && !STATE.isPaused
      && !UI.isMenuOpen()
      && this.fractureSilence <= 0
      && this.castAnimTimer <= 0; // Cannot attack during animations

    if (!canBeam) {
      if (this.isBeaming) this.stopDistortionBeam(false);
      return;
    }

    if (!this.isBeaming) {
      if (this.attackCooldown <= 0) this.startDistortionBeam();
      return;
    }

    this.faceMouse();
    if (STATE.multiplayer.active && this.isLocalPlayer() && !isServerAuthority()) {
      // Une intention de visée par frame saturait la liaison P2P (60 à 144 paquets/s).
      // 20 Hz suffit : c'est déjà la cadence des mises à jour de monde.
      const nowMs = performance.now();
      if (nowMs - (this._lastBeamAimSentAt || 0) >= 50) {
        this._lastBeamAimSentAt = nowMs;
        NetChrono.sendBeamAimIntent(this.getAimDir());
      }
    }
    this.addFracture(dt, this.getBeamHitOrigin(), this.getAimDir());
    if (!this.isBeaming) return;

    if (!STATE.multiplayer.active) {
      this.beamTickTimer -= dt;
      if (this.beamTickTimer <= 0) {
        this.tickDistortionBeam();
        this.beamTickTimer = this.getBeamTickInterval();
      }
    }

    if (this.isBeaming) {
      this.refreshBeamVisuals();
      this.updateElectricBeamFx(dt);
    }
    if (this.chronoOrb?.material) {
      if (this.isConverging) {
        this.chronoOrb.material.emissiveIntensity = 4.5 + Math.sin(Date.now() * 0.03) * 0.8;
      } else {
        const heat = this.fractureGauge / this.getFractureCap();
        this.chronoOrb.material.emissiveIntensity = 2 + heat * 3 + Math.sin(Date.now() * 0.02) * 0.4;
      }
    }
  }

  performAttack() {
    if (this.isBeaming || this.fractureSilence > 0 || this.overheatTriggered) return;
    if (!this.isLocalPlayer()) return;
    if (!STATE.mouseDown) return;
    if (this.castAnimTimer > 0) return; // Cannot start attack during animations
    this.startDistortionBeam();
  }

  takeDamage(amount) {
    if (this.dead) return;
    if (this.isIntangible) {
      createDamageText('ESQUIVÉ', this.position, '#aaddff');
      return;
    }

    amount = ConstellationEngine.modifyDamageTaken(amount);
    if (amount > 0) {
      this.hp -= amount;
      createDamageText('-' + Math.floor(amount), this.position, '#ff0000');
      this.flashColor(this.bodyGroup, 0xff0000);
      AudioSys.sfx.hit();
    }
    if (this.hp <= 0) {
      if (ConstellationEngine.tryLastBreath()) return;
      this.hp = 0;
      this.die();
    }
    if (this.isLocalPlayer()) UI.updateHUD();
  }

  spendFractureForSkill() {
    this.fractureGauge = Math.max(0, this.fractureGauge - this.getSkillFractureCost());
  }

  updateConvergenceSkillVisual(active = true) {
    if (!this.isLocalPlayer()) return;
    const btn = document.getElementById('skill-e');
    const cd = document.getElementById('cd-e');
    if (!btn) return;
    if (active && this.isConverging) {
      btn.classList.add('skill-ready-finale');
      if (cd) {
        cd.style.display = 'flex';
        cd.innerText = 'E';
        cd.style.background = 'rgba(255, 217, 61, 0.85)';
        cd.style.color = '#111';
      }
      const overlay = btn.querySelector('.cooldown-overlay');
      if (overlay) overlay.style.height = '0%';
    } else {
      btn.classList.remove('skill-ready-finale');
      if (cd) {
        cd.style.background = '';
        cd.style.color = '';
      }
    }
  }

  useSkill(key) {
    if (key === 'e' && this.isConverging) {
      this.endConvergence(true);
      this.updateConvergenceSkillVisual(false);
      return;
    }

    if (this.isChronoSilenced()) {
      createDamageText('SILENCE', this.position.clone().add({ x: 0, y: 1.2, z: 0 }), '#888888');
      return;
    }

    if (this.cooldowns[key] > 0) return;

    this.faceMouse();
    this.cooldowns[key] = this.maxCooldowns[key] * ConstellationEngine.getSkillCdMult(key);

    if (key === 'shift') {
      this.skillMolecularDephasing();
      this.spendFractureForSkill();
      this.resetFractureActivity();
      return;
    }

    this.spendFractureForSkill();

    if (key === 'space') this.skillFocusLens();
    else if (key === 'e') this.skillTemporalConvergence();
  }

  skillFocusLens() {
    this.castAnimTimer = 0.45;
    this.castAnimType = 'lens';
    if (STATE.multiplayer.active && this.isLocalPlayer() && !isServerAuthority()) {
      NetChrono.sendLensPlaceIntent(this.getAimDir());
      AudioSys.sfx.mage?.cast?.();
      return;
    }
    this.spawnAuthoritativeLens({});
  }

  removeLensEntry(lens) {
    if (!lens) return;
    if (lens.mesh) {
      Globals.scene.remove(lens.mesh);
      disposeObject3D(lens.mesh);
    }
    if (lens.ring) {
      Globals.scene.remove(lens.ring);
      disposeObject3D(lens.ring);
    }
    if (lens.id && this._lensMeshesById[lens.id]) delete this._lensMeshesById[lens.id];
  }

  syncLensesFromNetwork(lensSnaps) {
    const incoming = lensSnaps || [];
    const incomingIds = new Set(incoming.map((l) => l.id));
    const existingById = Object.create(null);
    for (const lens of this.lenses) {
      if (lens.id) existingById[lens.id] = lens;
    }

    for (const snap of incoming) {
      let lens = existingById[snap.id];
      if (lens) {
        lens.timer = snap.timer;
        lens.maxTimer = snap.maxTimer || snap.timer;
        lens.pos.set(snap.x, 1.05, snap.z);
        if (lens.mesh) lens.mesh.position.copy(lens.pos);
        continue;
      }

      const pos = new THREE.Vector3(snap.x, 1.05, snap.z);
      const prism = this.createPremiumLensMesh(pos);
      Globals.scene.add(prism);

      lens = {
        id: snap.id,
        pos: pos.clone(),
        radius: CHRONO_SKILLS.lens.radius,
        timer: snap.timer,
        maxTimer: snap.maxTimer || snap.timer,
        version: snap.version || 1,
        mesh: prism,
        ring: null,
      };
      this.lenses.push(lens);
      this._lensMeshesById[snap.id] = lens;
    }

    // Retire les lentilles absentes du snapshot autoritaire (expirées côté hôte).
    for (let i = this.lenses.length - 1; i >= 0; i--) {
      const lens = this.lenses[i];
      if (lens.id && !incomingIds.has(lens.id)) {
        this.removeLensEntry(lens);
        this.lenses.splice(i, 1);
      }
    }
  }

  createPremiumLensMesh(pos) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd93d, 
      roughness: 0.1, 
      metalness: 1.0, 
      emissive: 0x443300, 
      name: 'bodyPart'
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff, 
      emissive: 0x00d2ff, 
      emissiveIntensity: 2.0, 
      roughness: 0.05, 
      name: 'bodyPart'
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x7df9ff, 
      roughness: 0.05, 
      metalness: 0.95, 
      transparent: true, 
      opacity: 0.2, 
      side: THREE.DoubleSide, 
      name: 'bodyPart'
    });

    // 1. Inner glowing double pyramid core
    const coreCone1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 4), coreMat);
    coreCone1.position.y = 0.16;
    const coreCone2 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 4), coreMat);
    coreCone2.position.y = -0.16;
    coreCone2.rotation.x = Math.PI;
    group.add(coreCone1, coreCone2);

    // 2. Outer glass shield facets (slightly offset rotation for visual style)
    const shellGroup = new THREE.Group();
    shellGroup.rotation.y = Math.PI / 4;
    const shell1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.44, 4), glassMat);
    shell1.position.y = 0.22;
    const shell2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.44, 4), glassMat);
    shell2.position.y = -0.22;
    shell2.rotation.x = Math.PI;
    shellGroup.add(shell1, shell2);
    group.add(shellGroup);

    // 3. Floating gold astrolabe ring bracket (spinning around the crystal)
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.016, 6, 20), goldMat);
    torus.rotation.x = Math.PI / 2;
    group.add(torus);
    group.userData = { torus };

    return group;
  }

  spawnAuthoritativeLens({ serverId, skipAuthorityCheck = false } = {}) {
    if (STATE.multiplayer.active && this.isLocalPlayer() && !isServerAuthority() && !skipAuthorityCheck) {
      return;
    }

    AudioSys.sfx.mage?.cast?.();
    const refined = ConvergenceEffects.hasRefinedPrisms();
    const lensDuration = refined
      ? ConvergenceEffects.getRefinedLensFullDuration()
      : ConvergenceEffects.getLensBaseDuration();

    if (refined) {
      ConvergenceEffects.extendActiveRefinedLenses(this.lenses);
      const maxPrisms = ConvergenceEffects.getMaxRefinedPrisms();
      while (this.lenses.length >= maxPrisms) {
        const old = this.lenses.shift();
        this.removeLensEntry(old);
        pulseChronoLensUI('loss');
      }
    }

    const dir = this.getAimDir();
    const pos = this.position.clone().add(dir.clone().multiplyScalar(CHRONO_SKILLS.lens.placeDist));
    pos.y = 1.05;

    const prism = this.createPremiumLensMesh(pos);
    Globals.scene.add(prism);

    const lensId = serverId || `lens_${++this._lensUidCounter}`;
    const lens = {
      id: lensId,
      pos: pos.clone(),
      radius: CHRONO_SKILLS.lens.radius,
      timer: lensDuration,
      maxTimer: lensDuration,
      version: 1,
      mesh: prism,
      ring: null,
    };
    this.lenses.push(lens);
    this._lensMeshesById[lensId] = lens;
    spawnParticles(pos, CHRONO_COLOR(), 12);
    createDamageText('PRISME', pos, '#7df9ff');
    if (this.isLocalPlayer()) this.addBuff('Prisme', lensDuration, 'fa-gem');
  }

  skillMolecularDephasing() {
    this.castAnimTimer = 0.5;
    this.castAnimType = 'dephasing';
    AudioSys.sfx.mage?.cast?.();
    const startPos = this.getBeamVisualOrigin();
    const dir = this.getAimDir();
    const grenade = new ChronoDephasingGrenade(this, startPos, dir);
    Globals.projectiles.push(grenade);
    createDamageText('LOBE', this.position, '#f39c12');
  }

  onDephasingGrenadeDetonate(pos) {
    const cfg = CHRONO_SKILLS.dephasing;
    let blastRadius = cfg.grenade.blastRadius;
    let markDuration = cfg.markDuration;
    if (STATE.passives?.freezeFieldAmp) {
      blastRadius += 2;
      markDuration += 2;
    }

    const blastDmg = STATE.stats.atk * cfg.grenade.blastDmgMult;
    if (Globals.enemies) {
      for (const enemy of Globals.enemies) {
        if (enemy.dead) continue;
        if (enemy.position.distanceTo(pos) > blastRadius + (enemy.radius || 0.5)) continue;
        this.dealMagicDamage(enemy, blastDmg, { skill: true, skillKey: 'shift' });
        this.applyInstabilityMark(enemy, markDuration);
      }
    }

    createSkillVisual('shockwave', pos, blastRadius, 0xf39c12);
    spawnParticles(pos, 0xf39c12, 16);
    createDamageText('DÉPHASAGE', pos, '#f39c12');
    this.addBuff('Instabilité', markDuration, 'fa-atom');
  }

  skillTemporalConvergence() {
    this.castAnimTimer = 0.6;
    this.castAnimType = 'convergence';
    AudioSys.sfx.mage?.cast?.();
    const burstPos = this.getBeamHitOrigin();
    createSkillVisual('nova', burstPos, 4.5, 0x66ddff, this.getAimDir());
    spawnParticles(burstPos, 0xaee8ff, 22);
    createDamageText('CONVERGENCE', this.position, '#aee8ff');
    AudioSys.sfx.chrono?.convergenceStart?.();
    this.beginConvergence();
    this.updateConvergenceSkillVisual();
  }

  beginConvergence() {
    const duration = this.getConvergenceDuration();

    this.isConverging = true;
    this.convergenceTimer = duration;
    this.convergenceHitCount = 0;
    this.overheatTriggered = false;
    this.addBuff('Convergence', duration, 'fa-rotate');

    if (!this.isBeaming && this.fractureSilence <= 0 && STATE.mouseDown) {
      this.startDistortionBeam();
    } else {
      this.syncConvergenceElectricSound();
    }
  }

  endConvergence(manual = false) {
    if (!this.isConverging) return;

    this.isConverging = false;
    this.convergenceTimer = 0;
    AudioSys.sfx.chrono?.electricBeamStop?.();
    AudioSys.sfx.chrono?.convergenceEnd?.();

    const cfg = CHRONO_SKILLS.convergence;
    const radius = this.getConvergenceFinaleRadius();
    const hitMult = 1 + this.convergenceHitCount * cfg.finalePerHitMult;
    const finaleDmg = STATE.stats.atk * cfg.finaleBaseDmgMult * hitMult;
    const center = this.isBeaming ? this.getConvergencePullTarget() : this.getBeamHitOrigin();

    createSkillVisual('nova', center, radius, 0x66ddff, null);
    spawnParticles(center, 0xaee8ff, manual ? 36 : 28);
    createDamageText(`×${this.convergenceHitCount}`, center, '#ffd93d');

    if (Globals.enemies) {
      for (const e of Globals.enemies) {
        if (e.dead) continue;
        if (e.position.distanceTo(center) > radius + (e.radius || 0.5)) continue;
        this.dealMagicDamage(e, finaleDmg, { skill: true, skillKey: 'e' });
      }
    }

    this.convergenceHitCount = 0;
    AudioSys.sfx.mage?.cast?.();
  }

  updateLenses(dt) {
    if (STATE.multiplayer.active) {
      for (const l of this.lenses) {
        if (l.mesh) {
          l.mesh.rotation.y += dt * 2;
          if (l.mesh.userData?.torus) {
            l.mesh.userData.torus.rotation.y += dt * 3;
          }
        }
      }
      return;
    }
    for (let i = this.lenses.length - 1; i >= 0; i--) {
      const l = this.lenses[i];
      l.timer -= dt;
      if (l.mesh) {
        l.mesh.rotation.y += dt * 2;
        if (l.mesh.userData?.torus) {
          l.mesh.userData.torus.rotation.y += dt * 3;
        }
      }
      if (l.timer <= 0) {
        this.removeLensEntry(l);
        this.lenses.splice(i, 1);
      }
    }
  }

  updateInstabilityMarks(dt) {
    if (!Globals.enemies) return;
    for (const enemy of Globals.enemies) {
      if (!enemy._chronoInstabilityTimer) continue;
      enemy._chronoInstabilityTimer -= dt;
      if (enemy._chronoInstabilityTimer <= 0) {
        enemy._chronoInstabilityTimer = 0;
      }
    }
  }

  updateClassPassives(dt) {
    if (this.fractureSilence > 0) this.fractureSilence -= dt;
    this.tickFractureDecay(dt);
    this.fractureGauge = clampFracture(this.fractureGauge);
    const decaying = this.fractureDecayState
      ? isFractureDecaying(this.fractureGauge, this.fractureDecayState, this.isFractureAttacking())
      : false;
    updateChronoFractureUI(this.fractureGauge, this.fractureSilence, this.isLocalPlayer(), decaying);
    this.updateLenses(dt);
    updateChronoLensUI(this.lenses, this.isLocalPlayer());
    this.updateInstabilityMarks(dt);

    if (this.isConverging) {
      this.updateConvergencePull(dt);
      this.convergenceTimer -= dt;
      if (this.convergenceTimer <= 0) this.endConvergence(false);
      this.updateConvergenceSkillVisual();
    } else {
      this.updateConvergenceSkillVisual(false);
    }

    const resourceEl = getCachedElement('class-resource');
    if (resourceEl && this.isLocalPlayer()) {
      setDisplayIfChanged(resourceEl, 'none');
    }
  }

  applyMovementSpeed() {
    this.speed = STATE.stats.speed * this.getMovementSpeedMult();
  }

  update(dt) {
    if (this.dead) {
      if (this.isBeaming) {
        this.stopDistortionBeam(false);
      }
      return;
    }

    if (this.castAnimTimer > 0) {
      this.castAnimTimer -= dt;
      if (this.castAnimTimer <= 0) {
        this.castAnimType = null;
      }
    }

    if (this.isCasting) {
      this.isMoving = false;
    }

    this.updateDistortionBeam(dt);

    this.applyMovementSpeed();
    if (!this.isBeaming && this.beamVisuals.length > 0) {
      this.destroyBeamVisuals();
    }

    // Apex unlock observer
    const currentApex = isChronoFractureApexActive();
    if (currentApex !== this.isApexActive) {
      this.isApexActive = currentApex;
      this.syncChronoApexState();
      this.rebuildClassModel();
    }

    super.update(dt);

    if (this.isLocalPlayer() && !STATE.multiplayer.active) {
      tickChronoTemporalBurns(dt);
    }

    this.applyMovementSpeed();
    if (!this.isBeaming && !STATE.mouseDown && this.beamVisuals.length > 0) {
      this.destroyBeamVisuals();
    }

    if (this.isCasting) {
      this.isMoving = false;
    }
  }

  animateCharacter(dt) {
    this.animTime = (this.animTime || 0) + dt * 10;
    const t = Date.now() * 0.001;
    this.wingTime = (this.wingTime || 0) + dt;
    
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

    // 1. Hover height above the ground to prevent ground clipping
    if (this.mesh) {
      const hoverBob = Math.sin(t * 1.5) * 0.08;
      this.mesh.position.y = 0.55 + hoverBob;
    }
    
    // Reset any temporary scale changes from animations
    if (this.armL && this.armL.children) {
        const lensMesh = this.armL.children[this.armL.children.length - 1];
        if (lensMesh && lensMesh.scale) {
            lensMesh.scale.setScalar(1.0);
        }
    }
    
    // 2. Torso Height Alignment (0.75 baseline + bobbing + spell effects)
    if (this.bodyMesh) {
      const bob = Math.sin(t * 1.6) * 0.035;
      const baseHeight = 0.75; // sits on top of 0.75 height legs
      const convergenceFloat = (this.castAnimType === 'convergence') ? 0.45 : 0;
      
      this.bodyMesh.position.y = baseHeight + bob + (this.animState.spineBend || 0) + convergenceFloat;
      
      // We control body mesh tilting with our own accumulator to avoid walk oscillations
      // Torso tilts forward during movement except when firing the beam
      this.bodyMeshRotationX = this.bodyMeshRotationX !== undefined ? this.bodyMeshRotationX : 0;
      if (this.isMoving && !this.isBeaming) {
        this.bodyMeshRotationX = THREE.MathUtils.lerp(this.bodyMeshRotationX, 0.32, dt * 6);
      } else {
        this.bodyMeshRotationX = THREE.MathUtils.lerp(this.bodyMeshRotationX, 0, dt * 5);
      }
      this.bodyMesh.rotation.x = this.bodyMeshRotationX;

      if (!this.animState.rightArmOverride && !this.castAnimType && !this.isBeaming) {
        this.bodyMesh.rotation.z = Math.sin(t * 0.8) * 0.012;
        this.bodyMesh.rotation.y = Math.cos(t * 0.6) * 0.01;
      }
    }
    
    // Head bobbing out of phase & Visor HUD rotation
    if (this.headGroup) {
      this.headGroup.rotation.x = Math.sin(t * 1.1) * 0.01;
      this.headGroup.rotation.z = Math.cos(t * 0.8) * 0.008;
    }
    if (this.visorRing) {
      this.visorRing.rotation.z -= dt * 2.0;
    }

    // Chest Gear rotation
    if (this.chestGear) {
      this.chestGear.rotation.z += dt * 1.0;
    }

    // 3. Concentric Astrolabe Shoulder Rings spinning
    if (this.shoulderRingL && this.shoulderRingR) {
        this.shoulderRingL.rotation.x += dt * 1.5;
        this.shoulderRingL.rotation.y += dt * 0.8;
        
        this.shoulderRingR.rotation.x -= dt * 1.5;
        this.shoulderRingR.rotation.y += dt * 0.8;
    }
    if (this.shoulderRingL2 && this.shoulderRingR2) {
        const ringSpd = this.castAnimType === 'convergence' ? 10.0 : 1.2;
        this.shoulderRingL2.rotation.y -= dt * ringSpd;
        this.shoulderRingL2.rotation.z += dt * (ringSpd * 0.5);
        
        this.shoulderRingR2.rotation.y -= dt * ringSpd;
        this.shoulderRingR2.rotation.z += dt * (ringSpd * 0.5);
    }
    
    // Flowing energy spheres inside arm conduits
    if (this.armLNodes) {
      this.armLNodes.forEach((node, idx) => {
        const offset = (t * 0.35 + idx * 0.1) % 0.22;
        node.position.y = -0.17 - offset;
      });
    }
    if (this.armRNodes) {
      this.armRNodes.forEach((node, idx) => {
        const offset = (t * 0.35 + idx * 0.1) % 0.22;
        node.position.y = -0.17 - offset;
      });
    }

    // Central belt gear rotation
    if (this.beltGear) {
      this.beltGear.rotation.z += dt * 1.5;
    }

    // Robe panels swaying in the wind
    if (this.robePanels) {
      const swaySpeed = this.isMoving ? 4.5 : 2.0;
      const swayAmp = this.isMoving ? 0.22 : 0.08;
      this.robePanels.forEach((panel, idx) => {
        panel.rotation.x = 0.18 + Math.sin(t * swaySpeed + idx * 1.5) * swayAmp;
      });
    }
    
    // Cape panels waving & flaring (flaps back more when flying/moving)
    if (this.cape) {
        const waveSpeed = this.isMoving ? 7.5 : 2.5;
        const waveAmp = this.isMoving ? 0.28 : 0.04;
        this.capePanelC.rotation.x = 0.22 + Math.sin(t * waveSpeed) * waveAmp;
        this.capePanelL.rotation.x = 0.18 + Math.sin(t * waveSpeed + 1.0) * waveAmp;
        this.capePanelR.rotation.x = 0.18 + Math.sin(t * waveSpeed + 2.0) * waveAmp;
        
        if (this.isMoving) {
            this.capePanelC.rotation.x += 0.45;
            this.capePanelL.rotation.x += 0.45;
            this.capePanelR.rotation.x += 0.45;
        }
    }
    
    // Suspended belt lenses swaying
    if (this.suspendedLenses) {
        const sway = Math.sin(t * 2.0) * 0.05;
        this.suspendedLenses.forEach((lens, idx) => {
            lens.rotation.z = sway + Math.cos(t * 1.5 + idx) * 0.03;
            if (this.isMoving) {
                lens.rotation.x = 0.22 + Math.sin(t * 4.5 + idx) * 0.12;
            } else {
                lens.rotation.x = Math.sin(t * 1.8 + idx) * 0.03;
            }
            if (lens.userData.needle) {
                lens.userData.needle.rotation.z += dt * 3.0;
            }
        });
    }

    // 4. Chrono Emitter Orb pulsing and scaling
    if (this.chronoOrb) {
      const baseEmissive = this.isApexActive ? 3.0 : 2.0;
      this.chronoOrb.material.emissiveIntensity = baseEmissive + Math.sin(t * 4.0) * 0.4;
      this.chronoOrb.scale.setScalar(1.0 + Math.sin(t * 5.0) * 0.06);
    }

    // 5. Slender geometric legs dangling & trailing hover/flight gait (override parent walk swings)
    if (this.legL && this.legR) {
      this.legLRotationX = this.legLRotationX !== undefined ? this.legLRotationX : 0;
      this.legRRotationX = this.legRRotationX !== undefined ? this.legRRotationX : 0;

      if (this.isMoving) {
        const trailAngle = 0.72 + Math.sin(t * 3.5) * 0.05;
        this.legLRotationX = THREE.MathUtils.lerp(this.legLRotationX, trailAngle, dt * 8);
        this.legRRotationX = THREE.MathUtils.lerp(this.legRRotationX, trailAngle + 0.12, dt * 8);
        
        // Spawn chronal dust particles trailing behind the flying boots!
        if (Math.random() < 0.15) {
          const trailPos = this.position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            0.1,
            -0.3
          ));
          spawnParticles(trailPos, 0x00f3ff, 1);
        }
      } else {
        const dangle = Math.sin(t * 1.2) * 0.05;
        this.legLRotationX = THREE.MathUtils.lerp(this.legLRotationX, dangle, dt * 5);
        this.legRRotationX = THREE.MathUtils.lerp(this.legRRotationX, -dangle * 0.4, dt * 5);
      }
      
      this.legL.rotation.x = this.legLRotationX;
      this.legR.rotation.x = this.legRRotationX;
      
      // Update repulsor rings & boot clock rings & thruster waves
      [this.legL, this.legR].forEach((leg, idx) => {
        const uData = leg.userData;
        if (uData) {
          const osc = idx === 0 ? Math.sin(t * 8.0) : Math.cos(t * 8.0);
          const baseScale = this.isMoving ? (1.3 + osc * 0.2) : (1.0 + osc * 0.15);
          
          if (uData.thruster) uData.thruster.scale.set(baseScale, baseScale, 1.0);
          if (uData.energyPad) uData.energyPad.scale.set(baseScale, baseScale, 1.0);
          
          // Rotate boot clock ring
          if (uData.bootClockRing) {
            uData.bootClockRing.rotation.z += dt * (idx === 0 ? 1.5 : -1.5);
          }
          
          // Animate expanding thruster waves
          if (uData.thrusterWave1 && uData.thrusterWave2) {
            const waveSpeed = 2.5;
            const phase1 = (t * waveSpeed + (idx * 0.5)) % 1.0;
            const phase2 = (t * waveSpeed + (idx * 0.5) + 0.5) % 1.0;
            
            uData.thrusterWave1.scale.setScalar(0.8 + phase1 * 1.2);
            uData.thrusterWave1.material.opacity = (1.0 - phase1) * 0.3;
            
            uData.thrusterWave2.scale.setScalar(0.8 + phase2 * 1.2);
            uData.thrusterWave2.material.opacity = (1.0 - phase2) * 0.3;
          }
        }
      });
    }

    // 6. Smooth weapon and arm target transitions (stops snapping, aligns cannon straight forward)
    let targetWepPos = new THREE.Vector3(-0.35, 0.45, 0.15);
    let targetWepRot = new THREE.Vector3(0, 0, 0);
    let targetArmLRot = new THREE.Vector3(0, 0, 0.05);
    let targetArmRRot = new THREE.Vector3(0, 0, -0.05);
    
    // Default movement/idle targets
    if (this.isMoving && !this.castAnimType && !this.isBeaming) {
        targetArmLRot.set(0.25 + Math.sin(t * 2.0) * 0.05, 0, -0.2);
        targetArmRRot.set(0.25 - Math.sin(t * 2.0) * 0.05, 0, 0.2);
        
        targetWepPos.set(-0.35, 0.45 + Math.sin(t * 2.0) * 0.02, 0.15);
        targetWepRot.set(0, 0, Math.cos(t * 1.5) * 0.02);
    } else if (!this.castAnimType && !this.isBeaming) {
        const sway = Math.sin(t * 1.5) * 0.05;
        targetArmLRot.set(sway, 0, 0.05 + Math.cos(t * 1.5) * 0.02);
        targetArmRRot.set(-sway, 0, -0.05 - Math.cos(t * 1.5) * 0.02);
        
        targetWepPos.set(-0.35, 0.45 + Math.sin(t * 2.0) * 0.02, 0.15);
        targetWepRot.set(0, 0, Math.cos(t * 1.5) * 0.02);
    }
    
    // Left-click basic attack firing pose
    if (this.isBeaming) {
        targetWepPos.set(-0.15, 0.45, 0.25);
        targetWepRot.set(0, 0, 0); // holds cannon straight forward
        
        targetArmLRot.set(-1.0, 0, -0.15);
        targetArmRRot.set(-1.2, 0, 0.3);
    }
    
    // Skill casts
    if (this.castAnimType === 'lens') {
        const progress = Math.max(0, this.castAnimTimer / 0.45);
        const factor = Math.sin(progress * Math.PI);
        
        targetArmLRot.set(-2.0, 0, -0.6 * factor);
        targetArmRRot.set(-2.0, 0, 0.6 * factor);
        
        targetWepPos.set(0, 0.5, -0.2);
        targetWepRot.set(0, 0, Math.PI / 4 * factor);
        
        // Expand orbiting prisms
        if (this.orbitPrisms) {
            const orbitSpeed = t * 4.0;
            this.orbitPrisms.forEach((prism, idx) => {
                const angle = orbitSpeed + (idx * Math.PI * 2 / 3);
                const radius = 0.48 + 0.45 * factor;
                prism.position.set(Math.cos(angle) * radius, 0.65 + Math.sin(t * 2.0 + idx) * 0.05 + 0.3 * factor, Math.sin(angle) * radius);
                prism.rotation.set(t * 5.0, t * 2.0, 0);
            });
        }
    } 
    else if (this.castAnimType === 'dephasing') {
        const progress = Math.max(0, this.castAnimTimer / 0.5);
        const factor = Math.sin(progress * Math.PI);
        
        targetArmLRot.set(-1.6, 0, -0.2);
        targetArmRRot.set(-0.5, 0, 0.2);
        
        targetWepPos.set(-0.35, 0.45, 0.15);
        targetWepRot.set(0.1, 0, 0);
        
        // Scale gauntlet lens
        if (this.armL && this.armL.children) {
            const lensMesh = this.armL.children[this.armL.children.length - 1];
            if (lensMesh && lensMesh.scale) {
                lensMesh.scale.setScalar(1.0 + 1.8 * factor);
            }
        }
    } 
    else if (this.castAnimType === 'convergence') {
        const progress = Math.max(0, this.castAnimTimer / 0.6);
        const factor = Math.sin(progress * Math.PI);
        
        targetArmLRot.set(-0.8, 0, 0.6 * factor);
        targetArmRRot.set(-0.8, 0, -0.6 * factor);
        
        targetWepPos.set(0, 0.6, 0.4);
        targetWepRot.set(Math.PI / 2, 0, Math.PI / 2 * factor);
    }
    
    // Normal prism orbit if not in lens summon state
    if (this.castAnimType !== 'lens' && this.orbitPrisms) {
        const orbitSpeed = t * 1.5;
        this.orbitPrisms.forEach((prism, idx) => {
            const angle = orbitSpeed + (idx * Math.PI * 2 / 3);
            prism.position.set(Math.cos(angle) * 0.48, 0.65 + Math.sin(t * 2.0 + idx) * 0.05, Math.sin(angle) * 0.48);
            prism.rotation.set(t * 2.0, t * 1.0, t * 0.5);
        });
    }

    // Apply lerping transforms to weapon & arms
    const lerpSpeed = dt * 8.5; // Smooth transitions
    if (this.weaponGroup) {
        this.weaponGroup.position.lerp(targetWepPos, lerpSpeed);
        this.weaponGroup.rotation.x = THREE.MathUtils.lerp(this.weaponGroup.rotation.x, targetWepRot.x, lerpSpeed);
        this.weaponGroup.rotation.y = THREE.MathUtils.lerp(this.weaponGroup.rotation.y, targetWepRot.y, lerpSpeed);
        this.weaponGroup.rotation.z = THREE.MathUtils.lerp(this.weaponGroup.rotation.z, targetWepRot.z, lerpSpeed);
    }
    if (this.armL) {
        this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, targetArmLRot.x, lerpSpeed);
        this.armL.rotation.y = THREE.MathUtils.lerp(this.armL.rotation.y, targetArmLRot.y, lerpSpeed);
        this.armL.rotation.z = THREE.MathUtils.lerp(this.armL.rotation.z, targetArmLRot.z, lerpSpeed);
    }
    if (this.armR) {
        this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, targetArmRRot.x, lerpSpeed);
        this.armR.rotation.y = THREE.MathUtils.lerp(this.armR.rotation.y, targetArmRRot.y, lerpSpeed);
        this.armR.rotation.z = THREE.MathUtils.lerp(this.armR.rotation.z, targetArmRRot.z, lerpSpeed);
    }

    if (this.prismLasers && this.orbitPrisms) {
      for (let i = 0; i < 3; i++) {
        const p1 = this.orbitPrisms[i].position;
        const p2 = this.orbitPrisms[(i + 1) % 3].position;
        positionCylinderBetweenPoints(this.prismLasers[i], p1, p2, 0.006);
      }
    }

    if (this.barrelRing1 && this.barrelRing2) {
      const slide = Math.sin(t * 3.0) * 0.06;
      this.barrelRing1.position.z = 0.45 + slide;
      this.barrelRing2.position.z = 0.75 - slide;
    }
    if (this.weaponChamberCore) {
      this.weaponChamberCore.scale.setScalar(1.0 + Math.sin(t * 4.0) * 0.15);
    }
    if (this.reticle1 && this.reticle2) {
      this.reticle1.rotation.z += dt * 2.0;
      this.reticle2.rotation.z -= dt * 2.0;
    }

    // 7. Apex specific animations (Waist runes, body aura, floor clock, back halo, scrolling runic coordinate panels)
    if (this.isApexActive) {
        // Full body luminous aura pulsing & rotating
        if (this.apexAuraWire && this.apexAuraSolid) {
            const auraScale = 1.0 + Math.sin(t * 5.0) * 0.04;
            this.apexAuraWire.scale.setScalar(auraScale);
            this.apexAuraSolid.scale.setScalar(auraScale);
            
            this.apexAuraWire.rotation.y += dt * 0.4;
            this.apexAuraWire.rotation.x += dt * 0.2;
            this.apexAuraSolid.rotation.y -= dt * 0.2;
        }
        
        if (this.muzzleRing) {
            this.muzzleRing.rotation.z += dt * 3.0;
        }
        
        // Rotate Floor Clock Ring
        if (this.floorClockRing) {
            this.floorClockRing.rotation.y += dt * 0.35;
        }
        
        // Rotate Back Halo Rings
        if (this.backHaloRing) {
            this.backHaloRing.rotation.z += dt * 0.2;
        }
        if (this.haloGear) {
            this.haloGear.rotation.z -= dt * 0.4;
        }
        
        // Float & rotate temporal rune data panels
        if (this.temporalRunes) {
            this.temporalRunes.forEach((pane, idx) => {
                pane.position.y += dt * 0.12;
                if (pane.position.y > 1.2) {
                    pane.position.y = 0.1;
                }
                
                // Sway or hover coordinates
                const paneAngle = t * 0.4 + idx * (Math.PI / 2);
                pane.position.x = Math.cos(paneAngle) * 0.52;
                pane.position.z = Math.sin(paneAngle) * 0.52;
                pane.rotation.y = -paneAngle + Math.PI / 2;
            });
        }
    }
  }

  rebuildClassModel() {
    if (this.mesh) {
      this.bodyGroup.remove(this.mesh);
      disposeObject3D(this.mesh);
    }
    
    this.createClassModel();
    
    // Temporal awakening effect!
    if (this.isApexActive) {
      createSkillVisual('shockwave', this.position, 6.0, 0x00ffff);
      createDamageText("ÉVEIL APEX TEMPOREL", this.position, '#00ffff');
      spawnParticles(this.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 0x00ffff, 35);
      AudioSys.play('war_cry', 1.0); // Majestic sound for transformation
    }
  }
}

function positionCylinderBetweenPoints(cylinder, p1, p2, thickness = 0.008) {
  const direction = new THREE.Vector3().subVectors(p2, p1);
  const length = direction.length();
  
  // Midpoint
  const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  cylinder.position.copy(midpoint);
  
  // Scale
  cylinder.scale.set(thickness, length, thickness);
  
  // Align orientation (cylinder is along Y axis by default)
  const up = new THREE.Vector3(0, 1, 0);
  direction.normalize();
  cylinder.quaternion.setFromUnitVectors(up, direction);
}
