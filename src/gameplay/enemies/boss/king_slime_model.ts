// @ts-nocheck
import * as THREE from 'three';

// Ce fichier gère la construction graphique ultra-détaillée d'Aethelgard, le Souverain d'Ambre.
// Il est conçu avec le même niveau de détail et la même philosophie modulaire que la classe Chronorégisseur.
export function buildKingSlimeModel(scaleVal = 1, swordOnGround = false) {
    const mesh = new THREE.Group();
    mesh.castShadow = true;
    mesh.scale.setScalar(scaleVal);

    // --- PALETTE DE MATÉRIAUX AVANCÉE (AMBRE, GRÈS & OR) ---
    const materials = {
        // Ambre gélatineux, translucide et très brillant (comme les effets de Chronorégisseur)
        amber: new THREE.MeshPhysicalMaterial({ 
            color: 0xffa500, // Orange ambré
            emissive: 0xff4500, // Lueur orange/rouge
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.85,
            roughness: 0.1,
            metalness: 0.05,
            transmission: 0.75,
            thickness: 1.3
        }),
        // Grès sculpté, mat et fissuré pour l'armure lourde
        sandstone: new THREE.MeshStandardMaterial({ 
            color: 0xc4a47a, 
            roughness: 0.95, 
            metalness: 0.05,
            flatShading: true
        }),
        // Or brillant d'ornement
        gold: new THREE.MeshStandardMaterial({ 
            color: 0xffd700, 
            roughness: 0.2, 
            metalness: 0.95,
            emissive: 0xaa6600,
            emissiveIntensity: 0.25
        }),
        // Pierre sombre volcanique pour les piques et articulations d'armure
        darkStone: new THREE.MeshStandardMaterial({ 
            color: 0x332c23, 
            roughness: 0.8, 
            metalness: 0.2
        }),
        // Lueur néon intense (Visor, yeux et cœur d'énergie)
        energy: new THREE.MeshStandardMaterial({ 
            color: 0xff8800,
            emissive: 0xffaa00,
            emissiveIntensity: 2.5,
            transparent: true,
            opacity: 0.95,
            roughness: 0.1,
            metalness: 0.1
        }),
        // Cape royale rouge déchirée par le sable du désert
        clothRed: new THREE.MeshStandardMaterial({ 
            color: 0x661111, 
            roughness: 0.9, 
            side: THREE.DoubleSide 
        })
    };

    const parts = {};

    // --- 1. JAMBES (Armures lourdes multicouches avec jointures ambre) ---
    const legLData = createLeg(materials, -1);
    const legRData = createLeg(materials, 1);
    parts.legL = legLData.legGroup;
    parts.shinL = legLData.lowerLegGroup;
    parts.legR = legRData.legGroup;
    parts.shinR = legRData.lowerLegGroup;
    parts.legL.position.set(-0.6, 1.18, 0); // Ajusté (+0.38) pour aligner les pieds au sol
    parts.legR.position.set( 0.6, 1.18, 0); // Ajusté (+0.38) pour aligner les pieds au sol
    mesh.add(parts.legL); 
    mesh.add(parts.legR);

    // --- 2. TORSE MASSIVE DE SOUVERAIN (Multi-plaques imbriquées) ---
    parts.body = new THREE.Group();
    parts.body.position.y = 2.03; // Ajusté (+0.38) pour aligner le corps
    mesh.add(parts.body);

    // Noyau gélatineux interne en ambre
    const slimeCoreGeo = new THREE.CylinderGeometry(0.42, 0.35, 0.95, 12);
    slimeCoreGeo.scale(1, 1, 0.85);
    const innerSlime = new THREE.Mesh(slimeCoreGeo, materials.amber);
    parts.body.add(innerSlime);

    // Cuirasse de grès lourd (Devant)
    const chestArmor = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.88, 0.38), materials.sandstone);
    chestArmor.position.set(0, 0.02, 0.24);
    parts.body.add(chestArmor);

    // Protection dorsale lourde en grès
    const backArmor = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.88, 0.3), materials.sandstone);
    backArmor.position.set(0, 0.02, -0.24);
    parts.body.add(backArmor);

    // Bordures dorées sur la poitrine (Gauchers et Droitiers)
    const chestGoldL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.06), materials.gold);
    chestGoldL.position.set(-0.32, 0.02, 0.42);
    chestArmor.add(chestGoldL);

    const chestGoldR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 0.06), materials.gold);
    chestGoldR.position.set(0.32, 0.02, 0.42);
    chestArmor.add(chestGoldR);

    // Collerette d'armure lourde (Cylinder)
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.15, 8), materials.gold);
    collar.position.y = 0.52;
    parts.body.add(collar);

    // Cœur d'énergie (cristal d'ambre au centre de la cuirasse)
    parts.core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), materials.energy);
    parts.core.position.set(0, 0.1, 0.42);
    parts.body.add(parts.core);
    
    // Grille de confinement dorée
    const coreShield = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 4), materials.gold);
    coreShield.position.set(0, 0.1, 0.46);
    parts.body.add(coreShield);

    // Vents d'échappement à l'arrière (comme le réacteur de Chronorégisseur)
    const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6), materials.darkStone);
    exhaustL.position.set(-0.24, 0.2, -0.42);
    exhaustL.rotation.x = -Math.PI / 4;
    parts.body.add(exhaustL);

    const exhaustR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6), materials.darkStone);
    exhaustR.position.set(0.24, 0.2, -0.42);
    exhaustR.rotation.x = -Math.PI / 4;
    parts.body.add(exhaustR);

    // --- 3. TÊTE ULTRA-DÉTAILLÉE (Casque de combat) ---
    parts.head = new THREE.Group();
    parts.head.position.y = 0.72;
    parts.body.add(parts.head);

    // Casque de grès sculpté
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.56, 0.52), materials.sandstone);
    parts.head.add(helmet);

    // Visière de combat (fente lumineuse d'énergie ambrée)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), materials.energy);
    visor.position.set(0, 0.06, 0.24);
    parts.head.add(visor);

    // Mentonnière dorée
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.38, 4), materials.gold);
    jaw.position.set(0, -0.38, 0.2);
    jaw.rotation.x = Math.PI;
    parts.head.add(jaw);

    // Cornes arrières de pierre sombre recourbées vers le bas/côté
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), materials.darkStone);
    hornL.position.set(-0.25, 0.28, -0.16);
    hornL.rotation.set(-0.3, 0.2, -0.4);
    parts.head.add(hornL);

    const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 4), materials.darkStone);
    hornR.position.set(0.25, 0.28, -0.16);
    hornR.rotation.set(-0.3, -0.2, 0.4);
    parts.head.add(hornR);

    // Couronne de grès détaillée mais cassée (couleurs sablées)
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.12, 8), materials.sandstone);
    crownBase.position.y = 0.36;
    parts.head.add(crownBase);
    
    // 5 pics potentiels, mais certains sont cassés/absents pour l'effet ruine
    const spikeIndices = [0, 1, 3, 4]; // Les pics 2 et 5 sont cassés/manquants
    for (let i of spikeIndices) {
        // Hauteurs inégales pour l'effet brisé
        const h = i === 1 ? 0.16 : (i === 3 ? 0.32 : 0.24);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, h, 4), materials.sandstone);
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.32, 0.36 + h / 2, Math.sin(angle) * 0.32);
        // Rotations cassées (légèrement penchées)
        spike.rotation.y = angle;
        spike.rotation.x = 0.15 * (Math.random() - 0.5);
        spike.rotation.z = 0.15 * (Math.random() - 0.5);
        parts.head.add(spike);
    }
    
    // Quelques gemmes d'ambre ternes incrustées sur la base
    for (let i = 0; i < 4; i++) {
        const gem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), materials.amber);
        const angle = (i / 4) * Math.PI * 2;
        gem.position.set(Math.cos(angle) * 0.33, 0.36, Math.sin(angle) * 0.33);
        gem.rotation.y = -angle;
        parts.head.add(gem);
    }

    // --- 4. CAPE DÉCHIRÉE PAR LE SABLE (3 pans tressés tattered) ---
    parts.capeGroup = new THREE.Group();
    parts.capeGroup.position.set(0, 0.52, -0.38);
    parts.body.add(parts.capeGroup);
    
    parts.capeSegments = [];
    const stripOffsets = [-0.26, 0, 0.26];
    
    for (let s = 0; s < 3; s++) {
        const stripRoot = new THREE.Group();
        stripRoot.position.set(stripOffsets[s], 0, 0);
        parts.capeGroup.add(stripRoot);

        let prevSeg = stripRoot;
        for (let i = 0; i < 8; i++) {
            const seg = new THREE.Group();
            seg.position.y = i === 0 ? 0 : -0.24;
            prevSeg.add(seg);
            
            const width = 0.28 - (i * 0.02) + (Math.sin(s * 10 + i) * 0.02);
            const cloth = new THREE.Mesh(new THREE.BoxGeometry(width, 0.28, 0.04), materials.clothRed);
            cloth.position.y = -0.14;
            
            // Fissures/ornements dorés sur certains pans de la cape déchirée
            if (i % 3 === 0) {
                const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.05, 0.05), materials.gold);
                trim.position.y = -0.14;
                seg.add(trim);
            }
            seg.add(cloth);

            parts.capeSegments.push(seg);
            prevSeg = seg;
        }
    }

    // --- 5. BRAS ET ÉPAULIÈRES LOURDES ---
    parts.armL = createArm(materials, -1);
    parts.armR = createArm(materials, 1);
    parts.body.add(parts.armL);
    parts.body.add(parts.armR);

    // --- 6. L'ÉPÉE DE SOUVERAIN (Amber Sovereign Blade) ---
    parts.swordInfo = new THREE.Group();
    parts.swordInfo.position.set(0, -0.22, 0.05); // Collée à la main (entre les griffes du gantelet)
    parts.swordInfo.rotation.x = Math.PI/2;

    // Poignée
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.25), materials.darkStone);
    hilt.position.y = 0.25;
    parts.swordInfo.add(hilt);
    
    const pommel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), materials.gold);
    pommel.position.y = -0.36;
    parts.swordInfo.add(pommel);

    // Garde massive
    const guardGroup = new THREE.Group();
    guardGroup.position.y = 0.65;
    parts.swordInfo.add(guardGroup);
    
    const guardCenter = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.22, 0.32), materials.gold);
    guardGroup.add(guardCenter);
    
    const guardWingL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 4), materials.sandstone);
    guardWingL.position.x = -0.42; guardWingL.rotation.z = Math.PI/2.3;
    guardGroup.add(guardWingL);
    
    const guardWingR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 4), materials.sandstone);
    guardWingR.position.x = 0.42; guardWingR.rotation.z = -Math.PI/2.3;
    guardGroup.add(guardWingR);

    // Lame en ambre translucide géante avec cœur en grès
    const bladeGroup = new THREE.Group();
    bladeGroup.position.y = 0.75;
    parts.swordInfo.add(bladeGroup);
    
    const bladeCore = new THREE.Mesh(new THREE.BoxGeometry(0.42, 2.7, 0.08), materials.sandstone);
    bladeCore.position.y = 1.35;
    bladeGroup.add(bladeCore);
    
    const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.06), materials.amber);
    edgeL.position.set(-0.26, 1.35, 0);
    bladeGroup.add(edgeL);
    
    const edgeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.06), materials.amber);
    edgeR.position.set( 0.26, 1.35, 0);
    bladeGroup.add(edgeR);
    
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.58, 4), materials.amber);
    tip.position.y = 2.85;
    tip.scale.z = 0.22;
    bladeGroup.add(tip);

    if (!swordOnGround) {
        parts.armR.children[2].add(parts.swordInfo);
    }

    return { mesh, parts, materials };
}

function createLeg(mats, side) {
    const legGroup = new THREE.Group();

    // Joint cuisse ambre
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), mats.amber);
    joint.position.y = -0.12;
    legGroup.add(joint);

    // Cuisse sandstone avec bordure or
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.56, 0.42), mats.sandstone);
    thigh.position.y = -0.36;
    const thighTrim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.46), mats.gold);
    thighTrim.position.y = 0.15;
    thigh.add(thighTrim);
    legGroup.add(thigh);

    // Lower leg group (shin/boot) attached at knee height
    const lowerLegGroup = new THREE.Group();
    lowerLegGroup.position.set(0, -0.6, 0);
    legGroup.add(lowerLegGroup);

    // Genouillère gold massive
    const knee = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24), mats.gold);
    knee.position.set(0, -0.06, 0.22);
    lowerLegGroup.add(knee);

    // Bottes lourdes
    const bootGroup = new THREE.Group();
    bootGroup.position.set(0, -0.32, 0.05);
    lowerLegGroup.add(bootGroup);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.52), mats.sandstone);
    bootGroup.add(boot);

    const shinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.12), mats.darkStone);
    shinGuard.position.set(0, 0.05, 0.28);
    bootGroup.add(shinGuard);

    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.32), mats.gold);
    toe.position.set(0, -0.16, 0.35);
    bootGroup.add(toe);

    return { legGroup, lowerLegGroup };
}

function createArm(mats, side) {
    const armGroup = new THREE.Group();
    armGroup.position.set(0.95 * side, 0.3, 0);

    // Épaulières doubles couches massives
    const pauldronGroup = new THREE.Group();
    pauldronGroup.position.y = 0.25;

    const basePaul = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48), mats.sandstone);
    basePaul.scale.set(1, 1.25, 1);
    pauldronGroup.add(basePaul);

    const outerPaul = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.56), mats.gold);
    outerPaul.position.y = 0.1;
    pauldronGroup.add(outerPaul);

    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.36, 4), mats.amber);
    spike.position.set(-0.22 * side, 0.42, 0);
    spike.rotation.z = -0.32 * side;
    pauldronGroup.add(spike);

    armGroup.add(pauldronGroup);

    // Biceps ambre
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.5), mats.amber);
    arm.position.y = -0.28;
    armGroup.add(arm);

    // Gantelet lourd (index 2)
    const gauntletGroup = new THREE.Group();
    gauntletGroup.position.y = -0.72;

    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.48, 0.3), mats.sandstone);
    gauntletGroup.add(gauntlet);

    const gauntletTrim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.34), mats.gold);
    gauntletTrim.position.y = 0.15;
    gauntletGroup.add(gauntletTrim);

    for (let i = 0; i < 3; i++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), mats.amber);
        claw.position.set((i - 1) * 0.08, -0.25, 0.13);
        claw.rotation.x = Math.PI / 4;
        gauntletGroup.add(claw);
    }

    armGroup.add(gauntletGroup);

    return armGroup;
}