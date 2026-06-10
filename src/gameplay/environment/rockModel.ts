// @ts-nocheck
import * as THREE from 'three';

export function createRockModel(scale = 1, baseColor = 0x808080) {
    const types = ['round', 'sharp', 'flat', 'cluster'];
    const type = types[Math.floor(Math.random() * types.length)];

    // Variation légère autour de la couleur de base de la saison
    const color = new THREE.Color(baseColor);
    // On assombrit ou éclaircit un peu aléatoirement
    color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);

    const mat = new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.9, 
        flatShading: true,
        transparent: true,
        opacity: 1.0
    });

    let mesh;

    if (type === 'round') {
        const geo = new THREE.DodecahedronGeometry(1, 0);
        mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(scale * (0.8+Math.random()*0.4), scale * (0.6+Math.random()*0.4), scale * (0.8+Math.random()*0.4));
    } else if (type === 'sharp') {
        const geo = new THREE.ConeGeometry(0.8, 1.5, 5);
        mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(scale, scale, scale);
        mesh.rotation.z = (Math.random() - 0.5) * 0.5;
        mesh.rotation.x = (Math.random() - 0.5) * 0.5;
    } else if (type === 'flat') {
        const geo = new THREE.CylinderGeometry(1, 1.2, 0.5, 6);
        mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(scale, scale * 0.5, scale);
    } else { 
        mesh = new THREE.Group();
        const m1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6,0), mat); m1.position.set(0, 0, 0);
        const m2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4,0), mat); m2.position.set(0.6, -0.2, 0);
        const m3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5,0), mat); m3.position.set(-0.5, -0.1, 0.4);
        mesh.add(m1, m2, m3);
        mesh.scale.set(scale, scale, scale);
    }

    mesh.userData.isEnvironment = true;
    mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
    mesh.animate = function(t) {}; 

    return mesh;
}