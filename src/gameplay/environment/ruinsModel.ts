// @ts-nocheck
import * as THREE from 'three';

export function createRuinsModel(scale = 1, type = 'pillar') {
    const group = new THREE.Group();
    group.userData.isEnvironment = true;

    const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x8D8D8D, // Gris pierre clair
        roughness: 0.9,
        flatShading: true
    });

    if (type === 'arch') {
        // === ARCHE BRISÉE ===
        // Pilier Gauche
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8*scale, 3*scale, 0.8*scale), stoneMat);
        p1.position.set(-1*scale, 1.5*scale, 0);
        p1.castShadow = true; p1.receiveShadow = true;
        group.add(p1);

        // Pilier Droit (cassé)
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.8*scale, 1.5*scale, 0.8*scale), stoneMat);
        p2.position.set(1*scale, 0.75*scale, 0);
        p2.castShadow = true; p2.receiveShadow = true;
        group.add(p2);

        // Morceau du haut (en biais au sol)
        const top = new THREE.Mesh(new THREE.BoxGeometry(2.5*scale, 0.6*scale, 0.8*scale), stoneMat);
        top.position.set(0.5*scale, 0.4*scale, 0.5*scale);
        top.rotation.z = Math.PI / 6;
        top.rotation.y = Math.PI / 8;
        top.castShadow = true; top.receiveShadow = true;
        group.add(top);

    } else {
        // === PILIER SOLITAIRE ===
        // Base
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6*scale, 0.8*scale, 0.5*scale, 6), stoneMat);
        base.position.y = 0.25*scale;
        base.castShadow = true; base.receiveShadow = true;
        group.add(base);

        // Colonne (plusieurs segments pour faire "usé")
        const colHeight = 2.5 * scale;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5*scale, 0.5*scale, colHeight, 6), stoneMat);
        col.position.y = (colHeight/2) + 0.5*scale;
        col.castShadow = true; col.receiveShadow = true;
        group.add(col);

        // Chapiteau (tête) décalé ou absent
        if(Math.random() > 0.5) {
            const head = new THREE.Mesh(new THREE.CylinderGeometry(0.7*scale, 0.5*scale, 0.4*scale, 6), stoneMat);
            head.position.y = colHeight + 0.7*scale;
            // Un peu de travers
            head.rotation.z = 0.2;
            head.castShadow = true; head.receiveShadow = true;
            group.add(head);
        }
    }

    // Pas d'animation, ce sont des pierres
    group.animate = function(t) {};

    return group;
}