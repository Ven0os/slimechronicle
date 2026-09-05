// @ts-nocheck
import * as THREE from 'three';
import { createTreeModel } from './treeModel';
import { createRockModel } from './rockModel';
import { createRuinsModel } from './ruinsModel';
import { createCliffModel } from './cliffModel';
import { createBushModel } from './bushModel';

const matCache = {};

function mat(hex, extras = {}) {
    const key = `${hex}_${extras.emissive || 0}_${extras.roughness ?? 0.9}`;
    if (!matCache[key]) {
        matCache[key] = new THREE.MeshStandardMaterial({
            color: hex,
            roughness: extras.roughness ?? 0.9,
            metalness: extras.metalness ?? 0.05,
            flatShading: true,
            emissive: extras.emissive || 0x000000,
            emissiveIntensity: extras.emissiveIntensity || 0,
        });
        matCache[key].userData.keep = true;
    }
    return matCache[key];
}

function mesh(geo, material, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function createLandmarkModel(subtype, scale = 1, color = null) {
    const group = new THREE.Group();
    group.userData.isLandmark = true;
    group.userData.landmarkType = subtype;
    const obstacles = [];

    if (subtype === 'giant_tree') {
        const tree = createTreeModel(1, 'oak', color || 0x2E7D32);
        group.add(tree);
        obstacles.push({ ox: 0, oz: 0, r: 1.1 * scale });
    } else if (subtype === 'altar') {
        const stone = mat(0x6d6458);
        const dark = mat(0x3a342c);
        const glow = mat(0x7c4dff, { emissive: 0x5e35b1, emissiveIntensity: 1.2, roughness: 0.25 });
        group.add(mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.35, 8), stone, 0, 0.18, 0));
        group.add(mesh(new THREE.BoxGeometry(1.4, 0.7, 1.4), dark, 0, 0.65, 0));
        group.add(mesh(new THREE.ConeGeometry(0.28, 0.9, 5), glow, 0, 1.35, 0));
        const pillar = createRuinsModel(0.7, 'pillar');
        pillar.position.set(-1.8, 0, 1.2);
        group.add(pillar);
        const broken = createRuinsModel(0.55, 'pillar');
        broken.position.set(1.6, 0, -1.1);
        broken.rotation.z = 0.55;
        group.add(broken);
        obstacles.push({ ox: 0, oz: 0, r: 1.6 * scale });
        obstacles.push({ ox: -1.8, oz: 1.2, r: 0.55 * scale });
    } else if (subtype === 'crystal') {
        const shard = mat(color || 0x9c27b0, { emissive: 0x6a1b9a, emissiveIntensity: 1.4, roughness: 0.2 });
        const rock = mat(0x2a1c28);
        group.add(mesh(new THREE.ConeGeometry(0.55, 3.4, 5), shard, 0, 1.7, 0, 0.08, 0.2, -0.06));
        group.add(mesh(new THREE.ConeGeometry(0.32, 2.2, 4), shard, 0.55, 1.1, 0.2, 0.25, 0.6, 0.15));
        group.add(mesh(new THREE.ConeGeometry(0.28, 1.8, 4), shard, -0.5, 0.95, -0.25, -0.2, -0.4, 0.2));
        group.add(mesh(new THREE.DodecahedronGeometry(0.7, 0), rock, 0, 0.2, 0, 0.2, 0.4, 0.1, 1.4, 0.6, 1.2));
        obstacles.push({ ox: 0, oz: 0, r: 1.2 * scale });
    } else if (subtype === 'monument') {
        const stone = mat(0x4a5360);
        group.add(mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), stone, 0, 0.2, 0));
        group.add(mesh(new THREE.BoxGeometry(0.9, 4.6, 0.7), stone, 0, 2.5, 0, 0.04, 0.15, -0.03));
        group.add(mesh(new THREE.BoxGeometry(1.3, 0.35, 0.9), stone, 0, 4.85, 0, 0.1, 0.2, 0));
        const rock = createRockModel(0.9, 0x303841);
        rock.position.set(1.4, 0.15, 0.8);
        group.add(rock);
        obstacles.push({ ox: 0, oz: 0, r: 1.4 * scale });
    } else if (subtype === 'portal') {
        const stone = mat(0x5c5348);
        const glow = mat(0x26c6da, { emissive: 0x00838f, emissiveIntensity: 1.1, roughness: 0.2 });
        group.add(mesh(new THREE.CylinderGeometry(0.38, 0.48, 3.4, 6), stone, -1.5, 1.7, 0));
        group.add(mesh(new THREE.CylinderGeometry(0.38, 0.48, 3.1, 6), stone, 1.5, 1.55, 0, 0.08, 0, 0.12));
        group.add(mesh(new THREE.TorusGeometry(1.55, 0.14, 6, 14, Math.PI), glow, 0, 2.6, 0, 0, 0, 0));
        group.add(mesh(new THREE.BoxGeometry(1.1, 0.35, 0.7), stone, 0, 0.18, 0.2, 0, 0.3, 0.4));
        obstacles.push({ ox: -1.5, oz: 0, r: 0.55 * scale });
        obstacles.push({ ox: 1.5, oz: 0, r: 0.55 * scale });
    } else if (subtype === 'statue') {
        const stone = mat(0x7a7266);
        group.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 1.6), stone, 0, 0.4, 0, 0.15, 0.4, 0.7));
        group.add(mesh(new THREE.BoxGeometry(0.55, 0.5, 1.1), stone, 0.9, 0.35, 0.4, 0.4, 0.2, 1.1));
        group.add(mesh(new THREE.SphereGeometry(0.38, 6, 5), stone, -0.7, 0.55, -0.2));
        const pillar = createRuinsModel(0.8, 'pillar');
        pillar.position.set(-1.6, 0, 1.1);
        pillar.rotation.z = 0.9;
        group.add(pillar);
        obstacles.push({ ox: 0, oz: 0, r: 1.3 * scale });
    } else if (subtype === 'grove') {
        const tree = createTreeModel(0.85, 'oak', color || 0x43A047);
        group.add(tree);
        const bushA = createBushModel(0.9, color || 0x66BB6A);
        bushA.position.set(1.2, 0, 0.6);
        group.add(bushA);
        const bushB = createBushModel(0.7, color || 0x66BB6A);
        bushB.position.set(-1.0, 0, 0.9);
        group.add(bushB);
        const rock = createRockModel(0.55, 0x757575);
        rock.position.set(0.4, 0.1, -1.1);
        group.add(rock);
        obstacles.push({ ox: 0, oz: 0, r: 0.7 * scale });
    } else if (subtype === 'watch') {
        const cliff = createCliffModel(1.1, 0x424242);
        cliff.position.set(0, 1.4, 0);
        group.add(cliff);
        const pillar = createRuinsModel(0.75, 'pillar');
        pillar.position.set(0.2, 2.4, 0.1);
        group.add(pillar);
        const rock = createRockModel(0.8, 0x303841);
        rock.position.set(-1.3, 0.2, 0.8);
        group.add(rock);
        obstacles.push({ ox: 0, oz: 0, r: 1.6 * scale });
    } else if (subtype === 'lantern') {
        const wood = mat(0x4E342E);
        const glow = mat(0xffb74d, { emissive: 0xff8f00, emissiveIntensity: 1.6, roughness: 0.2 });
        group.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 5), wood, 0, 0.7, 0));
        group.add(mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), glow, 0, 1.5, 0));
        group.add(mesh(new THREE.BoxGeometry(0.34, 0.06, 0.34), wood, 0, 1.7, 0));
    } else {
        const fallback = createRuinsModel(1, 'pillar');
        group.add(fallback);
        obstacles.push({ ox: 0, oz: 0, r: 0.8 * scale });
    }

    group.scale.setScalar(scale);
    return { group, obstacles };
}
