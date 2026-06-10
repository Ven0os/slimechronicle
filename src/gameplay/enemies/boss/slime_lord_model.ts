// @ts-nocheck
// Ce fichier construit le modèle ultra-détaillé du Seigneur du Vide
// Un mage spectral flottant, composé d'énergie noire et de métal corrompu.

export function buildSlimeLordModel(scaleVal = 1) {
    const mesh = new THREE.Group();
    mesh.castShadow = true;
    mesh.scale.setScalar(scaleVal);

    // --- PALETTE DE MATÉRIAUX HD ---
    const materials = {
        // Noir Absolu (Vantablack style) pour le corps vide
        voidBlack: new THREE.MeshStandardMaterial({ 
            color: 0x000000, 
            roughness: 1.0, 
            metalness: 0.0,
            emissive: 0x000000 
        }),
        // Tissu déchiré spectral
        voidCloth: new THREE.MeshStandardMaterial({ 
            color: 0x2a0033, // Violet très sombre
            roughness: 0.9, 
            side: THREE.DoubleSide,
            emissive: 0x110022,
            emissiveIntensity: 0.2
        }),
        // Armure dorée corrompue
        goldCorrupt: new THREE.MeshStandardMaterial({ 
            color: 0xb8860b, 
            roughness: 0.3, 
            metalness: 0.9,
            emissive: 0x331100, // Lueur rougeâtre
            emissiveIntensity: 0.1
        }),
        // Énergie Pure (Néon)
        neonViolet: new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0x9400d3, 
            emissiveIntensity: 4.0, // Très brillant
            transparent: true,
            opacity: 0.9
        }),
        // Cristal du Vide
        crystalVoid: new THREE.MeshPhysicalMaterial({
            color: 0x4b0082,
            transmission: 0.6,
            opacity: 0.9,
            metalness: 0.5,
            roughness: 0.1,
            emissive: 0x4b0082,
            emissiveIntensity: 0.5
        })
    };

    const parts = {};

    // --- PIVOT D'ORIENTATION ---
    // Le boss regarde vers +Z par défaut. On ajoute un pivot si besoin d'ajustement global.
    parts.pivot = new THREE.Group();
    // Ajustement fin : Si le modèle regarde trop à droite, on le tourne de -90° (Math.PI / -2)
    parts.pivot.rotation.y = -Math.PI / 2; 
    mesh.add(parts.pivot);

    // ==========================================
    // 1. BAS DU CORPS (Fumée et Robes)
    // ==========================================
    parts.lowerBody = new THREE.Group();
    parts.lowerBody.position.y = 1.5;
    parts.pivot.add(parts.lowerBody);

    // Queue spectrale (plusieurs segments pour l'animation)
    parts.tailGroup = new THREE.Group();
    parts.tailGroup.position.y = -0.5;
    parts.lowerBody.add(parts.tailGroup);

    // Création d'une "colonne vertébrale" de fumée
    for(let i=0; i<6; i++) {
        const size = 0.6 - (i * 0.08);
        const geo = new THREE.DodecahedronGeometry(size, 0);
        const seg = new THREE.Mesh(geo, materials.voidBlack);
        seg.position.y = -i * 0.5;
        // Variation aléatoire pour effet organique
        seg.scale.set(1 + Math.random()*0.2, 1, 1 + Math.random()*0.2);
        parts.tailGroup.add(seg);
    }

    // Robes extérieures (Lambeaux flottants)
    parts.robeSegments = [];
    for(let i=0; i<8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const clothGeo = new THREE.BoxGeometry(0.6, 2.5, 0.05);
        // On déplace les vertices du bas pour simuler des déchirures
        const posAttribute = clothGeo.attributes.position;
        for(let v=0; v < posAttribute.count; v++){
            if(posAttribute.getY(v) < 0) { // Si c'est le bas
                posAttribute.setY(v, posAttribute.getY(v) + (Math.random()-0.5)*0.5);
                posAttribute.setX(v, posAttribute.getX(v) * 0.5); // Pointe vers le bas
            }
        }
        clothGeo.computeVertexNormals();

        const strip = new THREE.Mesh(clothGeo, materials.voidCloth);
        strip.position.set(Math.cos(angle)*0.6, -0.8, Math.sin(angle)*0.6);
        strip.rotation.y = -angle; // Face outward
        strip.rotation.x = 0.2; // Évasé
        parts.lowerBody.add(strip);
        parts.robeSegments.push(strip); // Pour animation de vent
    }

    // ==========================================
    // 2. TORSE (Squelette Énergétique)
    // ==========================================
    parts.torsoGroup = new THREE.Group();
    parts.torsoGroup.position.y = 1.0; // Au-dessus du lowerBody
    parts.lowerBody.add(parts.torsoGroup); // Attaché au bas

    // Colonne vertébrale
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 1.2, 8), materials.voidBlack);
    parts.torsoGroup.add(spine);

    // Cotes (Ribcage) lumineuses
    for(let i=0; i<4; i++) {
        const ribY = 0.4 - (i * 0.25);
        const ribScale = 1.0 - (i * 0.15);
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.4 * ribScale, 0.04, 6, 12, Math.PI * 1.5), materials.neonViolet);
        rib.rotation.x = Math.PI / 2;
        rib.rotation.z = -Math.PI * 0.75; // Ouverture devant
        rib.position.y = ribY;
        parts.torsoGroup.add(rib);
    }

    // Plastron Armure (Haut du torse)
    const chestPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.5, 6), materials.goldCorrupt);
    chestPlate.position.y = 0.4;
    chestPlate.position.z = 0.05;
    parts.torsoGroup.add(chestPlate);

    // Cœur du Vide (Au centre de la poitrine)
    parts.heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 2), materials.neonViolet);
    parts.heart.position.set(0, 0.1, 0.2);
    parts.torsoGroup.add(parts.heart);

    // ==========================================
    // 3. TÊTE & COURONNE
    // ==========================================
    parts.headGroup = new THREE.Group();
    parts.headGroup.position.y = 0.85;
    parts.torsoGroup.add(parts.headGroup);

    // Crâne (Vide)
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), materials.voidBlack);
    skull.scale.set(0.8, 1.0, 0.9);
    parts.headGroup.add(skull);

    // Masque / Visage (Plaque dorée flottante)
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.1), materials.goldCorrupt);
    mask.position.set(0, -0.05, 0.3);
    // Forme en V
    mask.geometry = new THREE.ConeGeometry(0.2, 0.5, 4);
    mask.rotation.x = Math.PI;
    mask.rotation.y = Math.PI / 4; // Losange
    parts.headGroup.add(mask);

    // Yeux (Orbes flottants derrière le masque)
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06), materials.neonViolet);
    eyeL.position.set(-0.12, 0.05, 0.35);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06), materials.neonViolet);
    eyeR.position.set( 0.12, 0.05, 0.35);
    parts.headGroup.add(eyeL);
    parts.headGroup.add(eyeR);

    // Couronne Flottante (Halo)
    parts.haloGroup = new THREE.Group();
    parts.haloGroup.position.y = 0.5;
    parts.headGroup.add(parts.haloGroup);

    for(let i=0; i<6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 3), materials.crystalVoid);
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(angle)*0.4, 0, Math.sin(angle)*0.4);
        spike.lookAt(0, -1, 0); // Pointent vers l'extérieur haut
        parts.haloGroup.add(spike);
    }

    // ==========================================
    // 4. BRAS & ÉPAULES
    // ==========================================
    parts.shoulders = new THREE.Group();
    parts.torsoGroup.add(parts.shoulders);

    // Épaulières Massives (Lévitation)
    const pauldronL = createPauldron(materials);
    pauldronL.position.set(-0.6, 0.5, 0);
    parts.shoulders.add(pauldronL);
    parts.shoulderL = pauldronL; // Ref pour anim

    const pauldronR = createPauldron(materials);
    pauldronR.position.set(0.6, 0.5, 0);
    pauldronR.scale.x = -1; // Miroir
    parts.shoulders.add(pauldronR);
    parts.shoulderR = pauldronR;

    // Bras (Segments)
    parts.armL = createArm(materials, -1);
    parts.armL.position.set(-0.6, 0.4, 0);
    parts.torsoGroup.add(parts.armL);

    parts.armR = createArm(materials, 1);
    parts.armR.position.set(0.6, 0.4, 0);
    parts.torsoGroup.add(parts.armR);

    // ==========================================
    // 5. BÂTON COSMIQUE (Arme)
    // ==========================================
    parts.staffGroup = new THREE.Group();
    // Positionné dans la main droite.
    // Structure: ArmGroup -> LowerArmGroup (child 1) -> HandGroup (child 1)
    parts.staffGroup.position.set(0, -0.2, 0.2); 
    parts.staffGroup.rotation.x = Math.PI / 2; // Vertical par rapport à la main
    
    // FIX : Accès correct à la main dans la hiérarchie du bras droit
    // parts.armR.children[1] est le LowerArmGroup
    // parts.armR.children[1].children[1] est le HandGroup (le 0 est le mesh de l'avant bras)
    if (parts.armR.children[1] && parts.armR.children[1].children[1]) {
        parts.armR.children[1].children[1].add(parts.staffGroup);
    } else {
        // Fallback si la structure change (attache au bras entier)
        parts.armR.add(parts.staffGroup);
    }

    // Manche long
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 3.5, 8), materials.voidBlack);
    pole.position.y = 0; // Centré sur la main
    parts.staffGroup.add(pole);

    // Tête du Bâton
    const headStaff = new THREE.Group();
    headStaff.position.y = 1.8;
    parts.staffGroup.add(headStaff);

    // Croissant de lune
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 16, Math.PI * 1.2), materials.goldCorrupt);
    crescent.rotation.z = Math.PI / 1.6;
    headStaff.add(crescent);

    // Orbe central (Singularité)
    parts.staffOrb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), materials.neonViolet);
    headStaff.add(parts.staffOrb);

    // Anneaux Gyroscopiques autour de l'orbe
    parts.staffRings = [];
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.01, 4, 32), materials.neonViolet);
    headStaff.add(r1); parts.staffRings.push(r1);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.01, 4, 32), materials.neonViolet);
    r2.rotation.x = Math.PI / 2;
    headStaff.add(r2); parts.staffRings.push(r2);

    // ==========================================
    // 6. CERCLE RUNIQUE (Sol)
    // ==========================================
    parts.runeCircle = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.2, 64), materials.neonViolet);
    parts.runeCircle.rotation.x = -Math.PI / 2;
    parts.runeCircle.position.y = 0.1;
    // On l'ajoute au pivot pour qu'il soit centré sous le boss
    parts.pivot.add(parts.runeCircle);

    return { mesh, parts, materials };
}

// --- HELPER FUNCTIONS ---

function createPauldron(mats) {
    const g = new THREE.Group();
    // Plaque principale
    const plate = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), mats.goldCorrupt);
    plate.scale.set(1, 1.2, 1.5);
    g.add(plate);
    // Pique d'énergie
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 4), mats.crystalVoid);
    spike.position.y = 0.4;
    g.add(spike);
    return g;
}

function createArm(mats, side) {
    const g = new THREE.Group();
    
    // Bras (Humerus) - Index 0
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.6), mats.voidBlack);
    upperArm.position.y = -0.3;
    upperArm.rotation.z = side * 0.2; // Léger angle naturel
    g.add(upperArm);

    // Avant-bras (Radius/Ulna) - Index 1
    const lowerArmGroup = new THREE.Group();
    lowerArmGroup.position.set(side * 0.1, -0.6, 0);
    g.add(lowerArmGroup);

    // Mesh Avant-bras - Index 0 dans lowerArmGroup
    const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), mats.goldCorrupt); // Gantelet
    lowerArm.position.y = -0.3;
    lowerArmGroup.add(lowerArm);

    // Main - Index 1 dans lowerArmGroup
    const handGroup = new THREE.Group();
    handGroup.position.y = -0.6;
    lowerArmGroup.add(handGroup); // C'est ici qu'on attache l'arme

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.12), mats.voidBlack);
    handGroup.add(hand);

    // Doigts (Griffes)
    for(let i=0; i<3; i++) {
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 3), mats.neonViolet);
        finger.position.set((i-1)*0.05, -0.1, 0.05);
        finger.rotation.x = -0.5;
        handGroup.add(finger);
    }

    return g;
}