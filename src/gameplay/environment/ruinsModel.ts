// @ts-nocheck
import * as THREE from 'three';

// Cache des géométries et du matériel
const geometryCache = {};
let cachedStoneMat = null;

function getGeometry(key, creator) {
    if (!geometryCache[key]) {
        geometryCache[key] = creator();
    }
    return geometryCache[key];
}

function getStoneMaterial() {
    if (!cachedStoneMat) {
        cachedStoneMat = new THREE.MeshStandardMaterial({
            color: 0x8D8D8D, // Gris pierre clair
            roughness: 0.9,
            flatShading: true
        });
    }
    return cachedStoneMat;
}

export function createRuinsModel(scale = 1, type = 'pillar') {
    const group = new THREE.Group();
    group.userData.isEnvironment = true;

    const stoneMat = getStoneMaterial();

    if (type === 'arch') {
        // === ARCHE BRISÉE ===
        // Pilier Gauche
        const p1Geo = getGeometry('ruins_arch_p1', () => new THREE.BoxGeometry(0.8, 3.0, 0.8));
        const p1 = new THREE.Mesh(p1Geo, stoneMat);
        p1.position.set(-1.0, 1.5, 0);
        p1.castShadow = true; p1.receiveShadow = true;
        group.add(p1);

        // Pilier Droit (cassé)
        const p2Geo = getGeometry('ruins_arch_p2', () => new THREE.BoxGeometry(0.8, 1.5, 0.8));
        const p2 = new THREE.Mesh(p2Geo, stoneMat);
        p2.position.set(1.0, 0.75, 0);
        p2.castShadow = true; p2.receiveShadow = true;
        group.add(p2);

        // Morceau du haut (en biais au sol)
        const topGeo = getGeometry('ruins_arch_top', () => new THREE.BoxGeometry(2.5, 0.6, 0.8));
        const top = new THREE.Mesh(topGeo, stoneMat);
        top.position.set(0.5, 0.4, 0.5);
        top.rotation.z = Math.PI / 6;
        top.rotation.y = Math.PI / 8;
        top.castShadow = true; top.receiveShadow = true;
        group.add(top);

    } else {
        // === PILIER SOLITAIRE ===
        // Base
        const baseGeo = getGeometry('ruins_pillar_base', () => new THREE.CylinderGeometry(0.6, 0.8, 0.5, 6));
        const base = new THREE.Mesh(baseGeo, stoneMat);
        base.position.y = 0.25;
        base.castShadow = true; base.receiveShadow = true;
        group.add(base);

        // Colonne (plusieurs segments pour faire "usé")
        const colHeight = 2.5;
        const colGeo = getGeometry('ruins_pillar_col', () => new THREE.CylinderGeometry(0.5, 0.5, colHeight, 6));
        const col = new THREE.Mesh(colGeo, stoneMat);
        col.position.y = (colHeight / 2) + 0.5;
        col.castShadow = true; col.receiveShadow = true;
        group.add(col);

        // Chapiteau (tête) décalé ou absent
        if(Math.random() > 0.5) {
            const headGeo = getGeometry('ruins_pillar_head', () => new THREE.CylinderGeometry(0.7, 0.5, 0.4, 6));
            const head = new THREE.Mesh(headGeo, stoneMat);
            head.position.y = colHeight + 0.7;
            // Un peu de travers
            head.rotation.z = 0.2;
            head.castShadow = true; head.receiveShadow = true;
            group.add(head);
        }
    }

    group.scale.set(scale, scale, scale);

    // Pas d'animation, ce sont des pierres
    group.animate = function(t) {};

    return group;
}