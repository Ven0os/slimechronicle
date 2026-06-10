// @ts-nocheck
import * as THREE from 'three';

export function createCliffModel(scale = 1, rockColor = 0x424242) {
    const cliffMat = new THREE.MeshStandardMaterial({ 
        color: rockColor,
        roughness: 1.0, 
        flatShading: true,
        transparent: true,
        opacity: 1.0
    });

    const geo = new THREE.DodecahedronGeometry(1, 0); 
    const mesh = new THREE.Mesh(geo, cliffMat);
    
    mesh.scale.set(scale * 2.5, scale * 3.0, scale * 1.0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.isEnvironment = true;

    return mesh;
}