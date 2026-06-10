// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { BOSS_ZONE } from './worldZones';
import { WorldEvents } from '@/gameplay/events';
import { EventUtils } from '@/gameplay/events/utils';
import { SafeZoneHub } from '@/visual/ui/safeZoneHub';

export function createThemedWorldMap(): void {
  const y = 0.04;

  // Zone Boss
  const bossPatch = new THREE.Mesh(
    new THREE.CircleGeometry(BOSS_ZONE.radius, 40),
    new THREE.MeshBasicMaterial({ color: BOSS_ZONE.ground, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  bossPatch.rotation.x = -Math.PI / 2;
  bossPatch.position.set(BOSS_ZONE.cx, y, BOSS_ZONE.cz);
  Globals.scene.add(bossPatch);

  const bossRing = new THREE.Mesh(
    new THREE.RingGeometry(BOSS_ZONE.radius - 0.6, BOSS_ZONE.radius, 48),
    new THREE.MeshBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  );
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.set(BOSS_ZONE.cx, y + 0.02, BOSS_ZONE.cz);
  Globals.scene.add(bossRing);

  // --- SPAWN PLATFORM 3D CLIFF (FALAISE) ---
  const caveGroup = new THREE.Group();
  caveGroup.position.set(90, 0, 90);
  Globals.scene.add(caveGroup);
  Globals.spawnPlatformGroup = caveGroup; // Expose pour la gestion de l'opacité

  // Surface supérieure plane de la falaise (rayon 12, hauteur 4.0)
  const platformGeo = new THREE.CylinderGeometry(12, 12, 4.0, 32);
  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x111622,
    roughness: 0.8,
    metalness: 0.2
  });
  const platformMesh = new THREE.Mesh(platformGeo, platformMat);
  platformMesh.position.y = 2.0; // Place la surface plane supérieure à y = 4.0
  platformMesh.castShadow = true;
  platformMesh.receiveShadow = true;
  caveGroup.add(platformMesh);

  // Générer des rochers pour habiller les parois verticales de la falaise
  // Arc visible orienté vers le centre (de 135° à 315°)
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 1.75;
  const steps = 14;
  
  if (!Globals.obstacles) Globals.obstacles = [];

  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (i / steps) * (endAngle - startAngle);
    // Position le long du rebord de la falaise (rayon ~11.8)
    const rx = Math.cos(angle) * 11.8;
    const rz = Math.sin(angle) * 11.8;

    const s = 3.0 + Math.random() * 2.0;
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x242d3c, // Teinte rocheuse sombre
      roughness: 0.9,
      flatShading: true
    });
    const rockGeo = new THREE.DodecahedronGeometry(s, 0);
    const rockMesh = new THREE.Mesh(rockGeo, rockMat);
    // Positionne les rochers verticalement pour masquer la face cylindrique industrielle
    rockMesh.position.set(rx, 1.2, rz);
    rockMesh.scale.set(1.4, 0.8 + Math.random() * 0.4, 1.4);
    rockMesh.rotation.set(Math.random() * 0.4, angle, Math.random() * 0.4);
    caveGroup.add(rockMesh);

    // Ajouter une collision physique active pour la roche du spawn
    Globals.obstacles.push({
      position: new THREE.Vector3(90 + rx, 0, 90 + rz),
      radius: s * 0.75,
      isPersistent: true
    });
  }

  // --- DÉCORATIONS DU SPAWN (LIVELY SANCTUARY) ---
  // 1. Vasque magique au centre du spawn
  const basinGroup = new THREE.Group();
  basinGroup.position.set(0, 4.0, 0); // Position relative au sommet de la falaise (y = 4.0)
  caveGroup.add(basinGroup);

  const basinSupport = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.0, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 })
  );
  basinSupport.position.y = 0.2;
  basinGroup.add(basinSupport);

  const basinMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.3, 10),
    new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.9 })
  );
  basinMesh.position.y = 0.45;
  basinGroup.add(basinMesh);

  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x00d2ff,
    emissive: 0x0088cc,
    emissiveIntensity: 2.5,
    roughness: 0.1
  });
  const liquidMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 10), liquidMat);
  liquidMesh.position.y = 0.56;
  basinGroup.add(liquidMesh);

  const basinLight = new THREE.PointLight(0x00d2ff, 4, 10);
  basinLight.position.set(0, 1.0, 0);
  basinGroup.add(basinLight);

  // 2. Cristaux magiques scintillants
  // Cristal A (Orange/Forge)
  const crystalA = new THREE.Group();
  crystalA.position.set(2, 4.0, -3);
  caveGroup.add(crystalA);
  const cMatA = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 2.0, roughness: 0.1 });
  const cGeo1 = new THREE.ConeGeometry(0.12, 0.8, 4);
  const mesh1 = new THREE.Mesh(cGeo1, cMatA); mesh1.rotation.set(0.2, 0, 0.2); mesh1.position.set(0, 0.4, 0); crystalA.add(mesh1);
  const mesh2 = new THREE.Mesh(cGeo1, cMatA); mesh2.scale.set(0.8, 0.6, 0.8); mesh2.rotation.set(-0.2, 0, -0.1); mesh2.position.set(0.15, 0.24, 0.15); crystalA.add(mesh2);
  const mesh3 = new THREE.Mesh(cGeo1, cMatA); mesh3.scale.set(0.7, 0.5, 0.7); mesh3.rotation.set(0.1, 0, -0.3); mesh3.position.set(-0.15, 0.2, -0.15); crystalA.add(mesh3);

  // Cristal B (Violet céleste)
  const crystalB = new THREE.Group();
  crystalB.position.set(-3, 4.0, 2);
  caveGroup.add(crystalB);
  const cMatB = new THREE.MeshStandardMaterial({ color: 0xa832af, emissive: 0xa832af, emissiveIntensity: 2.0, roughness: 0.1 });
  const c1 = new THREE.Mesh(cGeo1, cMatB); c1.rotation.set(-0.2, 0.2, -0.1); c1.position.set(0, 0.4, 0); crystalB.add(c1);
  const c2 = new THREE.Mesh(cGeo1, cMatB); c2.scale.set(0.85, 0.7, 0.85); c2.rotation.set(0.15, -0.1, 0.2); c2.position.set(-0.2, 0.28, 0.1); crystalB.add(c2);

  // 3. Piliers antiques en ruine
  const pillar1 = new THREE.Group();
  pillar1.position.set(-4, 4.0, -4);
  caveGroup.add(pillar1);
  const pMat = new THREE.MeshStandardMaterial({ color: 0x333b4d, roughness: 0.9 });
  const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), pMat); baseBlock.position.y = 0.1; pillar1.add(baseBlock);
  const bodyBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6), pMat); bodyBlock.position.y = 0.8; pillar1.add(bodyBlock);
  const topBlock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), pMat); topBlock.position.y = 1.45; pillar1.add(topBlock);
  
  const pillar2 = new THREE.Group();
  pillar2.position.set(4, 4.0, 4);
  caveGroup.add(pillar2);
  const baseBlock2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), pMat); baseBlock2.position.y = 0.1; pillar2.add(baseBlock2);
  const bodyBlock2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 6), pMat); bodyBlock2.position.y = 0.6; pillar2.add(bodyBlock2);
  bodyBlock2.rotation.set(0.1, 0, 0.1);

  // 4. Flore / Buissons magiques
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.9, flatShading: true });
  const bushGeo = new THREE.DodecahedronGeometry(0.4, 0);

  const bush1 = new THREE.Mesh(bushGeo, foliageMat);
  bush1.position.set(-2, 4.1, -2);
  caveGroup.add(bush1);

  const bush2 = new THREE.Mesh(bushGeo, foliageMat);
  bush2.position.set(2, 4.1, 2);
  bush2.scale.set(1.2, 0.8, 1.2);
  caveGroup.add(bush2);

  const bush3 = new THREE.Mesh(bushGeo, foliageMat);
  bush3.position.set(0, 4.1, -4);
  bush3.scale.set(0.7, 0.6, 0.7);
  caveGroup.add(bush3);

  // --- ROCHERS DE FOND POUR MASQUER LE VIDE (BACKDROP VOID BLOCKERS) ---
  const backStartAngle = -Math.PI * 0.15;
  const backEndAngle = Math.PI * 0.65;
  const backSteps = 12;
  const rockMat2 = new THREE.MeshStandardMaterial({
    color: 0x181e28, // Roche sombre d'arrière-plan
    roughness: 0.9,
    flatShading: true
  });
  
  for (let i = 0; i <= backSteps; i++) {
    const angle = backStartAngle + (i / backSteps) * (backEndAngle - backStartAngle);
    const rx = Math.cos(angle) * 11.6;
    const rz = Math.sin(angle) * 11.6;
    
    const rockHeight = 5.0 + Math.random() * 4.0;
    const rockGeo = new THREE.DodecahedronGeometry(rockHeight * 0.65, 0);
    const rockMesh = new THREE.Mesh(rockGeo, rockMat2);
    
    // Positionne sur le plateau (hauteur relative + y=4.0)
    rockMesh.position.set(rx, 3.5 + (rockHeight * 0.15), rz);
    rockMesh.scale.set(1.3, 1.7, 1.3);
    rockMesh.rotation.set(Math.random() * 0.25, angle, Math.random() * 0.25);
    caveGroup.add(rockMesh);
    
    // Obstacle physique
    Globals.obstacles.push({
      position: new THREE.Vector3(90 + rx, 4.0, 90 + rz),
      radius: rockHeight * 0.5,
      isPersistent: true
    });
  }

  // Lumière d'ambiance bleutée douce sur le spawn
  const ambientLight = new THREE.PointLight(0x00ffff, 2.5, 15);
  ambientLight.position.set(0, 4.5, 0);
  caveGroup.add(ambientLight);
}

export function spawnSafeZoneNPCs(): void {
  // 1. Sage Stellaire (Mage Céleste)
  const stellarGroup = new THREE.Group();
  stellarGroup.position.set(83, 4.0, 90);
  stellarGroup.rotation.y = Math.PI / 2; // Face the center (90, 90)
  Globals.scene.add(stellarGroup);

  // Pedestal (Zone perso)
  const pedestalGeo = new THREE.CylinderGeometry(1.4, 1.5, 0.15, 16);
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x2e1a47, roughness: 0.8, metalness: 0.1 });
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = 0.075;
  stellarGroup.add(pedestal);

  // Glowing rune ring on the pedestal
  const ringGeo = new THREE.RingGeometry(1.25, 1.35, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const runeRing = new THREE.Mesh(ringGeo, ringMat);
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.position.y = 0.151; // slightly above pedestal top
  stellarGroup.add(runeRing);

  // Matériaux
  const robeMat = new THREE.MeshStandardMaterial({ color: 0x1d0f36, roughness: 0.7 }); // Robe violette foncée
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdcd0ff, roughness: 0.5 }); // Peau mauve clair
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x482b75, roughness: 0.6 });  // Chapeau violet royal
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 }); // Or brillant
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9 }); // Bois sombre
  const crystalMat = new THREE.MeshStandardMaterial({ 
    color: 0x00d2ff, 
    emissive: 0x00a8ff, 
    emissiveIntensity: 2.5,
    roughness: 0.1
  });
  const beardMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.8 }); // Barbe blanche

  // --- PIEDS ---
  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.26), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  footL.position.set(-0.2, 0.04, 0.05);
  stellarGroup.add(footL);
  const footR = footL.clone();
  footR.position.x = 0.2;
  stellarGroup.add(footR);

  // --- BASE ROBE & CEINTURE ---
  const robeMesh = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.1, 10), robeMat);
  robeMesh.position.y = 0.55;
  stellarGroup.add(robeMesh);

  const beltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.08, 10), goldMat);
  beltMesh.position.y = 0.82;
  stellarGroup.add(beltMesh);

  // --- GROUPE CORPS SUPÉRIEUR ANIMÉ ---
  const upperBody = new THREE.Group();
  upperBody.position.y = 0.85;
  stellarGroup.add(upperBody);

  const chestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.5, 8), robeMat);
  chestMesh.position.y = 0.25;
  upperBody.add(chestMesh);

  const capeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.25, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x0f0720, side: THREE.DoubleSide, roughness: 0.8 })
  );
  capeMesh.position.set(0, 0.0, -0.28);
  capeMesh.rotation.x = 0.12;
  upperBody.add(capeMesh);

  // Épaulières
  const shoulderL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15), goldMat);
  shoulderL.position.set(-0.4, 0.4, 0);
  upperBody.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.4;
  upperBody.add(shoulderR);

  // Manche Gauche (avec parchemin)
  const sleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.55, 8), hatMat);
  sleeveL.position.set(-0.42, 0.15, 0.08);
  sleeveL.rotation.set(0.25, 0, 0.2);
  upperBody.add(sleeveL);

  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), skinMat);
  handL.position.set(-0.46, -0.12, 0.15);
  upperBody.add(handL);

  const scrollMesh = new THREE.Group();
  scrollMesh.position.set(-0.46, -0.12, 0.15);
  scrollMesh.rotation.set(0.5, 0.2, 0.4);
  upperBody.add(scrollMesh);
  const scrollPaper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3), new THREE.MeshStandardMaterial({ color: 0xfaf0e6, roughness: 0.9 }));
  scrollPaper.rotation.z = Math.PI / 2;
  scrollMesh.add(scrollPaper);
  const scrollRibbon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xcc0000 }));
  scrollRibbon.rotation.z = Math.PI / 2;
  scrollMesh.add(scrollRibbon);

  // Manche Droite (tient le bâton)
  const sleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.5, 8), hatMat);
  sleeveR.position.set(0.38, 0.22, 0.1);
  sleeveR.rotation.set(0.35, 0, -0.25);
  upperBody.add(sleeveR);

  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), skinMat);
  handR.position.set(0.44, 0.04, 0.2);
  upperBody.add(handR);

  // Tête & Visage
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.58;
  upperBody.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skinMat);
  headGroup.add(headMesh);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.015), crystalMat);
  eyeL.position.set(-0.09, 0.04, 0.21);
  headGroup.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  headGroup.add(eyeR);

  // Barbe
  const beardMain = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 5), beardMat);
  beardMain.position.set(0, -0.18, 0.16);
  beardMain.rotation.x = -0.2;
  headGroup.add(beardMain);

  const beardL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 4), beardMat);
  beardL.position.set(-0.1, -0.12, 0.14);
  beardL.rotation.set(-0.15, 0, 0.2);
  headGroup.add(beardL);
  const beardR = beardL.clone();
  beardR.position.x = 0.1;
  beardR.rotation.z = -0.2;
  headGroup.add(beardR);

  // Chapeau de Sorcier
  const hatGroup = new THREE.Group();
  hatGroup.position.y = 0.18;
  headGroup.add(hatGroup);

  const brimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 12), hatMat);
  hatGroup.add(brimMesh);

  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 10), goldMat);
  hatBand.position.y = 0.03;
  hatGroup.add(hatBand);

  const hatBaseCone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 8), hatMat);
  hatBaseCone.position.y = 0.25;
  hatGroup.add(hatBaseCone);

  const hatTopCone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), hatMat);
  hatTopCone.position.set(0, 0.6, -0.06);
  hatTopCone.rotation.x = -0.28;
  hatGroup.add(hatTopCone);

  // --- BÂTON MAGIQUE AUTONOME ---
  const staffGroup = new THREE.Group();
  staffGroup.position.set(0.52, 0.6, 0.25);
  stellarGroup.add(staffGroup);

  const staffShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.65), woodMat);
  staffShaft.position.y = 0.8;
  staffGroup.add(staffShaft);

  // Ailes enserrant le cristal
  const wings = new THREE.Group();
  wings.position.y = 1.62;
  staffGroup.add(wings);

  const wingL = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 12, Math.PI), goldMat);
  wingL.position.x = -0.05;
  wingL.rotation.z = Math.PI / 2;
  wings.add(wingL);
  const wingR = wingL.clone();
  wingR.position.x = 0.05;
  wingR.rotation.z = -Math.PI / 2;
  wings.add(wingR);

  // Cristal rotatif
  const staffOrb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), crystalMat);
  staffOrb.position.y = 1.62;
  staffGroup.add(staffOrb);

  const staffLight = new THREE.PointLight(0x00d2ff, 2.5, 5);
  staffLight.position.set(0.52, 2.2, 0.25);
  stellarGroup.add(staffLight);

  const stellarLabel = EventUtils.createLabel("SAGE STELLAIRE", "[F] Constellation & Talents", "#9b59b6");
  stellarGroup.userData.label = stellarLabel;
  stellarGroup.userData.interactionRadius = 6.0;

  stellarGroup.userData.update = (dt) => {
    const time = Date.now() * 0.002;
    // Lévitation douce du corps supérieur
    upperBody.position.y = 0.85 + Math.sin(time) * 0.04;
    upperBody.rotation.y = Math.sin(time * 0.5) * 0.05;
    
    // Robe de base s'étire avec le mouvement
    robeMesh.scale.y = 1.0 + Math.sin(time) * 0.02;

    // Animation du bâton magique (flotte et tourne)
    staffGroup.position.y = 0.58 + Math.sin(time * 1.4) * 0.06;
    staffOrb.rotation.y += dt * 1.2;
    
    EventUtils.updateLabel(stellarGroup, stellarLabel, 20);
  };

  stellarGroup.userData.interact = () => {
    SafeZoneHub.openStellarUI();
  };

  WorldEvents.npcs.push(stellarGroup);


  // 2. Forgeron Prismatique (Golem de Fer / Forge)
  const forgeGroup = new THREE.Group();
  forgeGroup.position.set(90, 4.0, 83);
  Globals.scene.add(forgeGroup);

  // Pedestal (Zone perso)
  const forgePedGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.15, 16);
  const forgePedMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.7, metalness: 0.5 });
  const forgePed = new THREE.Mesh(forgePedGeo, forgePedMat);
  forgePed.position.y = 0.075;
  forgeGroup.add(forgePed);

  // Glowing forge ring on the pedestal
  const forgeRingGeo = new THREE.RingGeometry(1.45, 1.55, 32);
  const forgeRingMat = new THREE.MeshBasicMaterial({ color: 0xff4500, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const forgeRing = new THREE.Mesh(forgeRingGeo, forgeRingMat);
  forgeRing.rotation.x = -Math.PI / 2;
  forgeRing.position.y = 0.151; // slightly above pedestal top
  forgeGroup.add(forgeRing);

  // Matériaux
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x3a4856, metalness: 0.8, roughness: 0.35 }); // Métal principal
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xc36720, metalness: 0.75, roughness: 0.4 }); // Cuivre
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff3300, emissiveIntensity: 2.0, roughness: 0.2 }); // Coeur de lave
  const goldMetalMat = new THREE.MeshStandardMaterial({ color: 0xe5a93b, metalness: 0.85, roughness: 0.3 }); // Or
  const anvilMat = new THREE.MeshStandardMaterial({ color: 0x1f2730, metalness: 0.9, roughness: 0.65 });
  const woodLogMat = new THREE.MeshStandardMaterial({ color: 0x422f25, roughness: 0.9 }); // Bois

  // --- JAMBES MASSIFS ---
  const legL = new THREE.Group();
  legL.position.set(-0.32, 0, 0);
  forgeGroup.add(legL);
  const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.36, 6), ironMat);
  thighL.position.y = 0.18;
  legL.add(thighL);
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.35), copperMat);
  bootL.position.set(0, 0.11, 0.04);
  legL.add(bootL);

  const legR = new THREE.Group();
  legR.position.set(0.32, 0, 0);
  forgeGroup.add(legR);
  const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.36, 6), ironMat);
  thighR.position.y = 0.18;
  legR.add(thighR);
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.35), copperMat);
  bootR.position.set(0, 0.11, 0.04);
  legR.add(bootR);

  // --- CORPS DE GOLEM SUPÉRIEUR ---
  const golemBody = new THREE.Group();
  golemBody.position.y = 0.36; // S'attache au dessus des jambes
  forgeGroup.add(golemBody);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.6), ironMat);
  torsoMesh.position.y = 0.325;
  golemBody.add(torsoMesh);

  // Plaque de poitrine rivetée
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.45, 0.07), copperMat);
  chestPlate.position.set(0, 0.325, 0.28);
  golemBody.add(chestPlate);

  const rivetGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 6);
  rivetGeo.rotateX(Math.PI / 2);
  const rivet1 = new THREE.Mesh(rivetGeo, goldMetalMat); rivet1.position.set(-0.25, 0.44, 0.325); golemBody.add(rivet1);
  const rivet2 = rivet1.clone(); rivet2.position.x = 0.25; golemBody.add(rivet2);
  const rivet3 = rivet1.clone(); rivet3.position.y = 0.21; golemBody.add(rivet3);
  const rivet4 = rivet3.clone(); rivet4.position.x = -0.25; golemBody.add(rivet4);

  // Coeur du réacteur de lave
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), coreMat);
  coreMesh.position.set(0, 0.31, 0.33);
  golemBody.add(coreMesh);

  // Cheminées d'échappement dos (inclinées)
  const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.45, 6), copperMat);
  exhaustL.position.set(-0.22, 0.72, -0.22);
  exhaustL.rotation.set(-0.25, 0, -0.2);
  golemBody.add(exhaustL);
  const exhaustR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.45, 6), copperMat);
  exhaustR.position.set(0.22, 0.72, -0.22);
  exhaustR.rotation.set(-0.25, 0, 0.2);
  golemBody.add(exhaustR);

  // Épaules et bras
  const golemShoulderL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24), copperMat);
  golemShoulderL.position.set(-0.54, 0.48, 0);
  golemBody.add(golemShoulderL);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.35, 0.16), ironMat);
  armL.position.set(-0.56, 0.24, 0.04);
  armL.rotation.z = 0.12;
  golemBody.add(armL);
  const golemHandL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), copperMat);
  golemHandL.position.set(-0.58, 0.02, 0.06);
  golemBody.add(golemHandL);

  const golemShoulderR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24), copperMat);
  golemShoulderR.position.set(0.54, 0.48, 0);
  golemBody.add(golemShoulderR);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.16), ironMat);
  armR.position.set(0.54, 0.28, 0.15);
  armR.rotation.x = -0.35;
  golemBody.add(armR);
  const golemHandR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), copperMat);
  golemHandR.position.set(0.54, 0.1, 0.28);
  golemBody.add(golemHandR);

  // Tête du Golem
  const golemHeadGroup = new THREE.Group();
  golemHeadGroup.position.set(0, 0.78, 0.04);
  golemBody.add(golemHeadGroup);

  const forgeHead = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), ironMat);
  golemHeadGroup.add(forgeHead);

  const eyeVisor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.04), coreMat);
  eyeVisor.position.set(0, 0.04, 0.15);
  golemHeadGroup.add(eyeVisor);

  const golemHornGeo = new THREE.ConeGeometry(0.06, 0.22, 5);

  const golemHornL = new THREE.Mesh(golemHornGeo, goldMetalMat);
  golemHornL.position.set(-0.2, 0.08, 0.04);
  golemHornL.rotation.z = -0.7;
  golemHeadGroup.add(golemHornL);
  const golemHornR = golemHornL.clone();
  golemHornR.position.x = 0.2;
  golemHornR.rotation.z = 0.7;
  golemHeadGroup.add(golemHornR);

  // MARTEAU GÉANT DE FORGERON
  const hammerGroup = new THREE.Group();
  hammerGroup.position.set(0.54, 0.1, 0.28);
  hammerGroup.rotation.set(Math.PI / 3, 0, -Math.PI / 6);
  golemBody.add(hammerGroup);

  const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 1.0), woodLogMat);
  hammerHandle.position.y = 0.15;
  hammerGroup.add(hammerHandle);

  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.55), ironMat);
  hammerHead.position.y = 0.58;
  hammerGroup.add(hammerHead);

  const hammerFaceF = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.06), goldMetalMat);
  hammerFaceF.position.set(0, 0.58, 0.29);
  hammerGroup.add(hammerFaceF);
  const hammerFaceB = hammerFaceF.clone();
  hammerFaceB.position.z = -0.29;
  hammerGroup.add(hammerFaceB);

  // --- ENCLUME STATIQUE SUR RONDIN ---
  const anvilPedestal = new THREE.Group();
  anvilPedestal.position.set(90.65, 4.0, 83.6); // Placé de manière absolue à y = 4.0
  anvilPedestal.rotation.y = -Math.PI / 4;
  Globals.scene.add(anvilPedestal);

  const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.4, 8), woodLogMat);
  logMesh.position.y = 0.2;
  anvilPedestal.add(logMesh);

  // Enclume d'acier rivetée
  const anvilMesh = new THREE.Group();
  anvilMesh.position.y = 0.4;
  anvilPedestal.add(anvilMesh);

  const anvilBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.18, 6), anvilMat);
  anvilBase.position.y = 0.09;
  anvilMesh.add(anvilBase);

  const anvilMid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.26), anvilMat);
  anvilMid.position.y = 0.29;
  anvilMesh.add(anvilMid);

  const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.15, 0.6), anvilMat);
  anvilTop.position.y = 0.47;
  anvilMesh.add(anvilTop);

  const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), anvilMat);
  anvilHorn.position.set(0, 0.47, 0.38);
  anvilHorn.rotation.x = Math.PI / 2;
  anvilMesh.add(anvilHorn);

  const ingotMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.25), coreMat);
  ingotMesh.position.set(0, 0.56, -0.05);
  ingotMesh.rotation.y = 0.2;
  anvilMesh.add(ingotMesh);

  // Source lumineuse de forge chaude
  const forgeLight = new THREE.PointLight(0xd35400, 3, 5);
  forgeLight.position.set(90.65, 5.1, 83.6);
  Globals.scene.add(forgeLight);

  // Enregistrer le pedestal dans la liste des NPCs pour qu'il soit aussi translucide !
  WorldEvents.npcs.push(anvilPedestal);

  const forgeLabel = EventUtils.createLabel("FORGERON PRISMATIQUE", "[F] Fusion Prismatique", "#e67e22");
  forgeGroup.userData.label = forgeLabel;
  forgeGroup.userData.interactionRadius = 6.0;

  forgeGroup.userData.update = (dt) => {
    const time = Date.now() * 0.0015;
    // Respiration lourde du Golem (torse et bras bougent)
    golemBody.position.y = 0.36 + Math.sin(time) * 0.02;
    golemBody.rotation.y = Math.cos(time * 0.4) * 0.03;
    
    // Animation du marteau (balancement)
    hammerGroup.rotation.x = (Math.PI / 3) + Math.sin(time * 2.0) * 0.08;

    // Pulsation de lumière du coeur
    coreMesh.scale.setScalar(1.0 + Math.sin(time * 2.5) * 0.08);
    coreMat.emissiveIntensity = 1.6 + Math.sin(time * 2.5) * 0.4;
    
    // De légères vibrations sur la tête
    golemHeadGroup.rotation.z = Math.sin(time * 3.0) * 0.02;

    EventUtils.updateLabel(forgeGroup, forgeLabel, 20);
  };

  forgeGroup.userData.interact = () => {
    SafeZoneHub.openForge();
  };

  WorldEvents.npcs.push(forgeGroup);
}
