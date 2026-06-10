// @ts-nocheck
import * as THREE from 'three';

// Cache des géométries et des matériels
const geometryCache = {};
const materialCache = {};

function getGeometry(key, creator) {
    if (!geometryCache[key]) {
        geometryCache[key] = creator();
    }
    return geometryCache[key];
}

function getMaterial(color, roughness, isLeaves = false) {
    const key = `${color}_${roughness}_${isLeaves}`;
    if (!materialCache[key]) {
        materialCache[key] = new THREE.MeshStandardMaterial({
            color: color,
            roughness: roughness,
            flatShading: true,
            transparent: true,
            opacity: 1.0
        });
    }
    return materialCache[key];
}

export function createTreeModel(scale = 1, type = 'pine', foliageCol = null) {
    const group = new THREE.Group();
    group.userData.isEnvironment = true; 
    
    // Pour l'animation
    group.userData.initialRotation = 0; // Sera défini après placement
    group.userData.swaySpeed = 0.5 + Math.random() * 0.5;
    group.userData.swayOffset = Math.random() * 100;

    // --- VARIANTES ---
    if (type === 'pine') {
        // === SAPIN (Classique) ===
        const trunkGeo = getGeometry('pine_trunk', () => new THREE.CylinderGeometry(0.2, 0.4, 1.5, 7));
        const trunkMat = getMaterial(0x5D4037, 1.0);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5 / 2;
        trunk.castShadow = true; trunk.receiveShadow = true;
        group.add(trunk);

        const leavesColor = foliageCol || 0x2E7D32;
        const leavesMat = getMaterial(leavesColor, 0.8, true);

        // 3 Étages de feuilles
        const l1Geo = getGeometry('pine_l1', () => new THREE.ConeGeometry(1.3, 1.5, 7));
        const l1 = new THREE.Mesh(l1Geo, leavesMat);
        l1.position.y = 1.3; l1.castShadow = true; l1.receiveShadow = true;
        l1.userData.isLeaves = true; // Tag pour animation
        group.add(l1);

        const l2Geo = getGeometry('pine_l2', () => new THREE.ConeGeometry(1.0, 1.2, 7));
        const l2 = new THREE.Mesh(l2Geo, leavesMat);
        l2.position.y = 2.2; l2.castShadow = true; l2.receiveShadow = true;
        l2.userData.isLeaves = true;
        group.add(l2);

        const l3Geo = getGeometry('pine_l3', () => new THREE.ConeGeometry(0.7, 1.0, 7));
        const l3 = new THREE.Mesh(l3Geo, leavesMat);
        l3.position.y = 3.0; l3.castShadow = true; l3.receiveShadow = true;
        l3.userData.isLeaves = true;
        group.add(l3);

    } else if (type === 'oak') {
        // === CHÊNE (Tronc court, Copa ronde) ===
        const trunkGeo = getGeometry('oak_trunk', () => new THREE.CylinderGeometry(0.3, 0.5, 1.2, 8));
        const trunkMat = getMaterial(0x4E342E, 1.0);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.2 / 2;
        trunk.castShadow = true; trunk.receiveShadow = true;
        group.add(trunk);

        // Couleur de feuilles
        const leavesColor = foliageCol || 0x43A047;
        const leavesMat = getMaterial(leavesColor, 0.9, true);
        
        // Un gros icosaèdre principal + quelques petits
        const mainGeo = getGeometry('oak_main', () => new THREE.IcosahedronGeometry(1.2, 1));
        const main = new THREE.Mesh(mainGeo, leavesMat);
        main.position.y = 1.8;
        main.castShadow = true; main.receiveShadow = true;
        main.userData.isLeaves = true;
        group.add(main);
        
        // Petits clusters
        const subGeo = getGeometry('oak_sub', () => new THREE.IcosahedronGeometry(0.6, 0));
        for(let i=0; i<4; i++) {
            const sub = new THREE.Mesh(subGeo, leavesMat);
            const ang = (Math.PI/2)*i + Math.random();
            sub.position.set(Math.cos(ang)*0.8, 1.6 + Math.random()*0.5, Math.sin(ang)*0.8);
            sub.castShadow = true; sub.receiveShadow = true;
            sub.userData.isLeaves = true;
            group.add(sub);
        }

    } else if (type === 'dead') {
        // === ARBRE MORT (Juste du bois tordu) ===
        const woodMat = getMaterial(0x3E2723, 1.0);
        
        const trunkGeo = getGeometry('dead_trunk', () => new THREE.CylinderGeometry(0.2, 0.3, 2, 5));
        const trunk = new THREE.Mesh(trunkGeo, woodMat);
        trunk.position.y = 1.0;
        trunk.rotation.z = (Math.random()-0.5) * 0.2;
        trunk.castShadow = true; trunk.receiveShadow = true;
        group.add(trunk);

        // Branches mortes
        const b1Geo = getGeometry('dead_b1', () => new THREE.ConeGeometry(0.1, 1, 4));
        const b1 = new THREE.Mesh(b1Geo, woodMat);
        b1.position.set(0, 1.8, 0);
        b1.rotation.z = 0.5; b1.rotation.y = Math.random()*Math.PI;
        group.add(b1);

        const b2Geo = getGeometry('dead_b2', () => new THREE.ConeGeometry(0.1, 0.8, 4));
        const b2 = new THREE.Mesh(b2Geo, woodMat);
        b2.position.set(0, 1.2, 0);
        b2.rotation.z = -0.6; b2.rotation.y = Math.random()*Math.PI;
        group.add(b2);
    }

    group.scale.set(scale, scale, scale);

    // Fonction d'animation attachée à l'objet
    group.animate = function(t) {
        // Balancement doux du feuillage (rotation Z et X)
        // t est le temps en secondes
        const sway = Math.sin(t * this.userData.swaySpeed + this.userData.swayOffset) * 0.03;
        
        this.children.forEach(child => {
            if (child.userData.isLeaves) {
                // On bouge légèrement les feuilles par rapport à leur position locale
                // Pour faire simple, on applique une petite rotation locale
                child.rotation.z = sway;
                child.rotation.x = sway * 0.5;
            }
        });
        
        // Tout l'arbre peut aussi légèrement tanguer
        if (type !== 'rock') { // Sécurité
             this.rotation.z = sway * 0.5;
        }
    };

    return group;
}