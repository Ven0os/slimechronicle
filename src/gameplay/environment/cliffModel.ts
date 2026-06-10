// @ts-nocheck
import * as THREE from 'three';

// Caches partagés pour éviter les instanciations répétées
let cachedGeo = null;
const materialCache = {};

function getCliffMaterial(color) {
    if (!materialCache[color]) {
        materialCache[color] = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 1.0, 
            flatShading: true,
            transparent: true,
            opacity: 1.0
        });
    }
    return materialCache[color];
}

export function createCliffModel(scale = 1, rockColor = 0x424242) {
    if (!cachedGeo) {
        cachedGeo = new THREE.DodecahedronGeometry(1, 0); 
    }

    const cliffMat = getCliffMaterial(rockColor);
    const mesh = new THREE.Mesh(cachedGeo, cliffMat);
    
    mesh.scale.set(scale * 2.5, scale * 3.0, scale * 1.0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.isEnvironment = true;

    return mesh;
}