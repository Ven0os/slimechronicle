// @ts-nocheck
// Ce fichier gère uniquement la construction graphique du Roi Slime
// pour garder le code de gameplay propre.

export function buildKingSlimeModel(scaleVal = 1) {
    const mesh = new THREE.Group();
    mesh.castShadow = true;
    mesh.scale.setScalar(scaleVal);

    // --- PALETTE DE MATÉRIAUX AVANCÉE ---
    const materials = {
        gold: new THREE.MeshStandardMaterial({ 
            color: 0xffd700, 
            roughness: 0.3, 
            metalness: 1.0, 
            emissive: 0xaa6600, 
            emissiveIntensity: 0.2 
        }),
        darkMetal: new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            roughness: 0.7, 
            metalness: 0.5 
        }),
        clothRed: new THREE.MeshStandardMaterial({ 
            color: 0x8b0000, 
            roughness: 0.9, 
            side: THREE.DoubleSide 
        }),
        energy: new THREE.MeshStandardMaterial({ 
            color: 0x00ff00, 
            emissive: 0x00ff00, 
            emissiveIntensity: 2.0, 
            transparent: true, 
            opacity: 0.9 
        }),
        skin: new THREE.MeshStandardMaterial({
            color: 0x222222, // Peau sombre (void)
            roughness: 0.9
        })
    };

    const parts = {};

    // --- 1. JAMBES (Articulées et Blindées) ---
    parts.legL = createLeg(materials, -1);
    parts.legR = createLeg(materials, 1);
    parts.legL.position.set(-0.5, 0.8, 0);
    parts.legR.position.set( 0.5, 0.8, 0);
    mesh.add(parts.legL); 
    mesh.add(parts.legR);

    // --- 2. TORSE (Massif et Détaillé) ---
    parts.body = new THREE.Group();
    parts.body.position.y = 1.6;
    mesh.add(parts.body);

    // Plastron principal
    const chestGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.9, 8);
    const chest = new THREE.Mesh(chestGeo, materials.gold);
    parts.body.add(chest);

    // Détails armure (Collier)
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 8, 16), materials.darkMetal);
    collar.position.y = 0.45;
    collar.rotation.x = Math.PI / 2;
    parts.body.add(collar);

    // Cœur d'énergie (Réacteur)
    parts.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 1), materials.energy);
    parts.core.position.set(0, 0.1, 0.45);
    parts.body.add(parts.core);
    
    // Protection du cœur (Grille)
    const coreGuard = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 4), materials.gold);
    coreGuard.position.set(0, 0.1, 0.55);
    parts.body.add(coreGuard);

    // --- 3. TÊTE (Couronnée) ---
    parts.head = new THREE.Group();
    parts.head.position.y = 0.65;
    parts.body.add(parts.head);

    // Crâne / Casque
    const headBase = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.5), materials.darkMetal);
    parts.head.add(headBase);

    // Visage (Plaque dorée)
    const facePlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 0.1), materials.gold);
    facePlate.position.set(0, -0.05, 0.21);
    parts.head.add(facePlate);

    // Barbe métallique
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 4), materials.gold);
    beard.position.set(0, -0.4, 0.22);
    beard.rotation.x = Math.PI;
    parts.head.add(beard);

    // Couronne (Complexe)
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.32, 0.15, 8), materials.gold);
    crownBase.position.y = 0.35;
    parts.head.add(crownBase);
    
    for(let i=0; i<6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), materials.gold);
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(angle)*0.3, 0.5, Math.sin(angle)*0.3);
        parts.head.add(spike);
    }

    // Yeux (Luisants)
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.04, 0.05);
    const eyeL = new THREE.Mesh(eyeGeo, materials.energy); eyeL.position.set(-0.12, 0, 0.27);
    const eyeR = new THREE.Mesh(eyeGeo, materials.energy); eyeR.position.set( 0.12, 0, 0.27);
    parts.head.add(eyeL); parts.head.add(eyeR);

    // --- 4. CAPE (Physique simulée par segments) ---
    parts.capeGroup = new THREE.Group();
    parts.capeGroup.position.set(0, 0.5, -0.35);
    parts.body.add(parts.capeGroup);
    
    parts.capeSegments = []; // Sera utilisé pour l'animation
    let prevSeg = parts.capeGroup;
    
    // Attaches de la cape (Épaules)
    const capePinL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1), materials.gold);
    capePinL.rotation.z = Math.PI/2; capePinL.position.set(-0.3, 0, 0); parts.capeGroup.add(capePinL);
    
    const capePinR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1), materials.gold);
    capePinR.rotation.z = Math.PI/2; capePinR.position.set(0.3, 0, 0); parts.capeGroup.add(capePinR);

    // Segments de la cape
    for(let i=0; i<8; i++) {
        const seg = new THREE.Group();
        seg.position.y = i === 0 ? 0 : -0.25; // Espacement
        prevSeg.add(seg);
        
        const width = 1.0 - (i * 0.08); // Se rétrécit vers le bas
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, 0.05), materials.clothRed);
        cloth.position.y = -0.15;
        seg.add(cloth);
        
        // Détail doré sur le bas de la cape (dernier segment)
        if (i === 7) {
            const trim = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.06), materials.gold);
            trim.position.y = -0.28;
            seg.add(trim);
        }

        parts.capeSegments.push(seg);
        prevSeg = seg;
    }

    // --- 5. BRAS & ÉPAULIÈRES ---
    parts.armL = createArm(materials, -1);
    parts.armR = createArm(materials, 1);
    parts.body.add(parts.armL);
    parts.body.add(parts.armR);

    // --- 6. ARME : LA LAME DU NÉANT (Void Cleaver) ---
    parts.swordInfo = new THREE.Group();
    // CORRECTION ICI : Remontée de -0.9 à -0.6 pour mieux tenir en main
    parts.swordInfo.position.set(0, -0.6, 0); 
    parts.swordInfo.rotation.x = Math.PI/2;
    parts.armR.children[2].add(parts.swordInfo); // Attaché à la main (index 2 dans createArm)

    // Poignée longue
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2), materials.darkMetal);
    hilt.position.y = 0.2;
    parts.swordInfo.add(hilt);
    
    // Pommeau
    const pommel = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), materials.gold);
    pommel.position.y = -0.4;
    parts.swordInfo.add(pommel);

    // Garde massive
    const guardGroup = new THREE.Group();
    guardGroup.position.y = 0.6;
    parts.swordInfo.add(guardGroup);
    
    const guardCenter = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.3), materials.gold);
    guardGroup.add(guardCenter);
    
    const guardWingL = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 4), materials.gold);
    guardWingL.position.x = -0.4; guardWingL.rotation.z = Math.PI/2.5;
    guardGroup.add(guardWingL);
    
    const guardWingR = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 4), materials.gold);
    guardWingR.position.x = 0.4; guardWingR.rotation.z = -Math.PI/2.5;
    guardGroup.add(guardWingR);

    // Lame
    const bladeGroup = new THREE.Group();
    bladeGroup.position.y = 0.7;
    parts.swordInfo.add(bladeGroup);
    
    // Corps de la lame
    const bladeCore = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.8, 0.08), materials.darkMetal);
    bladeCore.position.y = 1.4;
    bladeGroup.add(bladeCore);
    
    // Tranchant énergétique
    const edgeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.7, 0.02), materials.energy);
    edgeL.position.set(-0.28, 1.4, 0);
    bladeGroup.add(edgeL);
    
    const edgeR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.7, 0.02), materials.energy);
    edgeR.position.set( 0.28, 1.4, 0);
    bladeGroup.add(edgeR);
    
    // Pointe
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), materials.gold);
    tip.position.y = 2.95;
    tip.scale.z = 0.2;
    bladeGroup.add(tip);

    return { mesh, parts, materials };
}

// --- FONCTIONS UTILITAIRES DE CONSTRUCTION ---

function createLeg(mats, side) { // side: -1 (Left) or 1 (Right)
    const legGroup = new THREE.Group();

    // Cuisse
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.4), mats.darkMetal);
    thigh.position.y = -0.3;
    legGroup.add(thigh);

    // Genouillère
    const knee = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), mats.gold);
    knee.position.set(0, -0.6, 0.2);
    legGroup.add(knee);

    // Tibia / Botte
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.5), mats.gold);
    boot.position.set(0, -0.85, 0.05);
    
    // Orteils de la botte
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), mats.gold);
    toe.position.set(0, -0.15, 0.3);
    boot.add(toe);

    legGroup.add(boot);

    return legGroup;
}

function createArm(mats, side) { // side: -1 (Left) or 1 (Right)
    const armGroup = new THREE.Group();
    armGroup.position.set(0.8 * side, 0.3, 0);

    // Épaulière Massive (Pauldron)
    const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45), mats.gold);
    pauldron.scale.set(1, 1.2, 1);
    pauldron.position.y = 0.2;
    
    // Piques sur l'épaulière
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 4), mats.gold);
    spike.position.y = 0.5;
    pauldron.add(spike);

    armGroup.add(pauldron);

    // Bras (Biceps)
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.5), mats.skin);
    arm.position.y = -0.3;
    armGroup.add(arm);

    // Avant-bras / Gantelet
    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.25), mats.darkMetal);
    gauntlet.position.y = -0.7;
    
    // Détail or sur gantelet
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.28), mats.gold);
    cuff.position.y = 0.15;
    gauntlet.add(cuff);

    armGroup.add(gauntlet);

    return armGroup;
}