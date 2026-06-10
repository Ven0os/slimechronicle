// @ts-nocheck
import * as THREE from 'three';

export function createTreeModel(scale = 1, type = 'pine') {
    const group = new THREE.Group();
    group.userData.isEnvironment = true; 
    
    // Pour l'animation
    group.userData.initialRotation = 0; // Sera défini après placement
    group.userData.swaySpeed = 0.5 + Math.random() * 0.5;
    group.userData.swayOffset = Math.random() * 100;

    // --- VARIANTES ---
    if (type === 'pine') {
        // === SAPIN (Classique) ===
        const trunkGeo = new THREE.CylinderGeometry(0.2 * scale, 0.4 * scale, 1.5 * scale, 7);
        const trunkMat = new THREE.MeshStandardMaterial({ 
            color: 0x5D4037, roughness: 1.0, flatShading: true, transparent: true, opacity: 1.0 
        });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = (1.5 * scale) / 2;
        trunk.castShadow = true; trunk.receiveShadow = true;
        group.add(trunk);

        const leavesMat = new THREE.MeshStandardMaterial({ 
            color: 0x2E7D32, roughness: 0.8, flatShading: true, transparent: true, opacity: 1.0 
        });

        // 3 Étages de feuilles
        const l1 = new THREE.Mesh(new THREE.ConeGeometry(1.3 * scale, 1.5 * scale, 7), leavesMat);
        l1.position.y = 1.3 * scale; l1.castShadow = true; l1.receiveShadow = true;
        l1.userData.isLeaves = true; // Tag pour animation
        group.add(l1);

        const l2 = new THREE.Mesh(new THREE.ConeGeometry(1.0 * scale, 1.2 * scale, 7), leavesMat);
        l2.position.y = 2.2 * scale; l2.castShadow = true; l2.receiveShadow = true;
        l2.userData.isLeaves = true;
        group.add(l2);

        const l3 = new THREE.Mesh(new THREE.ConeGeometry(0.7 * scale, 1.0 * scale, 7), leavesMat);
        l3.position.y = 3.0 * scale; l3.castShadow = true; l3.receiveShadow = true;
        l3.userData.isLeaves = true;
        group.add(l3);

    } else if (type === 'oak') {
        // === CHÊNE (Tronc court, Copa ronde) ===
        const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 1.2 * scale, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ 
            color: 0x4E342E, roughness: 1.0, flatShading: true, transparent: true, opacity: 1.0 
        });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = (1.2 * scale) / 2;
        trunk.castShadow = true; trunk.receiveShadow = true;
        group.add(trunk);

        // Couleur de feuilles un peu plus claire/jaune
        const leavesMat = new THREE.MeshStandardMaterial({ 
            color: 0x43A047, roughness: 0.9, flatShading: true, transparent: true, opacity: 1.0 
        });
        
        // Un gros icosaèdre principal + quelques petits
        const main = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 * scale, 1), leavesMat);
        main.position.y = 1.8 * scale;
        main.castShadow = true; main.receiveShadow = true;
        main.userData.isLeaves = true;
        group.add(main);
        
        // Petits clusters
        for(let i=0; i<4; i++) {
            const sub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 * scale, 0), leavesMat);
            const ang = (Math.PI/2)*i + Math.random();
            sub.position.set(Math.cos(ang)*0.8*scale, 1.6*scale + Math.random()*0.5*scale, Math.sin(ang)*0.8*scale);
            sub.castShadow = true; sub.receiveShadow = true;
            sub.userData.isLeaves = true;
            group.add(sub);
        }

    } else if (type === 'dead') {
        // === ARBRE MORT (Juste du bois tordu) ===
        const woodMat = new THREE.MeshStandardMaterial({ 
            color: 0x3E2723, roughness: 1.0, flatShading: true, transparent: true, opacity: 1.0 
        });
        
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2*scale, 0.3*scale, 2*scale, 5), woodMat);
        trunk.position.y = 1.0 * scale;
        trunk.rotation.z = (Math.random()-0.5) * 0.2;
        trunk.castShadow = true; trunk.receiveShadow = true;
        group.add(trunk);

        // Branches mortes
        const b1 = new THREE.Mesh(new THREE.ConeGeometry(0.1*scale, 1*scale, 4), woodMat);
        b1.position.set(0, 1.8*scale, 0);
        b1.rotation.z = 0.5; b1.rotation.y = Math.random()*Math.PI;
        group.add(b1);

        const b2 = new THREE.Mesh(new THREE.ConeGeometry(0.1*scale, 0.8*scale, 4), woodMat);
        b2.position.set(0, 1.2*scale, 0);
        b2.rotation.z = -0.6; b2.rotation.y = Math.random()*Math.PI;
        group.add(b2);
    }

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