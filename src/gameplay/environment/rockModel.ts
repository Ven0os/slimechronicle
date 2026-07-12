// @ts-nocheck
import * as THREE from 'three';

// Cache des géométries et des matériels
const geometryCache = {};
const materialCache = {};

function getGeometry(key, creator) {
    if (!geometryCache[key]) {
        const geo = creator();
        geo.userData = geo.userData || {};
        geo.userData.keep = true;
        geometryCache[key] = geo;
    }
    return geometryCache[key];
}

function getRockMaterial(colorHex) {
    if (!materialCache[colorHex]) {
        const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.9,
            flatShading: true,
            transparent: true,
            opacity: 1.0
        });
        mat.userData = mat.userData || {};
        mat.userData.keep = true;
        materialCache[colorHex] = mat;
    }
    return materialCache[colorHex];
}

export function createRockModel(scale = 1, baseColor = 0x808080) {
    const types = ['round', 'sharp', 'flat', 'cluster'];
    const type = types[Math.floor(Math.random() * types.length)];

    // Variation légère autour de la couleur de base de la saison
    const color = new THREE.Color(baseColor);
    // On quantifie les variations à des pas de 0.05 pour limiter les matériaux uniques
    const offset = Math.round((Math.random() - 0.5) * 2) * 0.05;
    color.offsetHSL(0, 0, offset);
    const colorHex = color.getHex();

    const mat = getRockMaterial(colorHex);

    let mesh;

    if (type === 'round') {
        const roundGeo = getGeometry('rock_round', () => new THREE.DodecahedronGeometry(1, 0));
        mesh = new THREE.Mesh(roundGeo, mat);
        mesh.scale.set(scale * (0.8+Math.random()*0.4), scale * (0.6+Math.random()*0.4), scale * (0.8+Math.random()*0.4));
    } else if (type === 'sharp') {
        const sharpGeo = getGeometry('rock_sharp', () => new THREE.ConeGeometry(0.8, 1.5, 4));
        mesh = new THREE.Mesh(sharpGeo, mat);
        mesh.scale.set(scale, scale, scale);
        mesh.rotation.z = (Math.random() - 0.5) * 0.5;
        mesh.rotation.x = (Math.random() - 0.5) * 0.5;
    } else if (type === 'flat') {
        const flatGeo = getGeometry('rock_flat', () => new THREE.CylinderGeometry(1, 1.2, 0.5, 4));
        mesh = new THREE.Mesh(flatGeo, mat);
        mesh.scale.set(scale, scale * 0.5, scale);
    } else { 
        mesh = new THREE.Group();
        const mGeo = getGeometry('rock_dodecahedron_unit', () => new THREE.DodecahedronGeometry(1, 0));
        const m1 = new THREE.Mesh(mGeo, mat); m1.position.set(0, 0, 0); m1.scale.setScalar(0.6);
        
        const m2 = new THREE.Mesh(mGeo, mat); m2.position.set(0.6, -0.2, 0); m2.scale.setScalar(0.4);
        
        const m3 = new THREE.Mesh(mGeo, mat); m3.position.set(-0.5, -0.1, 0.4); m3.scale.setScalar(0.5);
        
        mesh.add(m1, m2, m3);
        mesh.scale.set(scale, scale, scale);
    }

    mesh.userData.isEnvironment = true;
    mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
    mesh.animate = function(t) {}; 

    return mesh;
}