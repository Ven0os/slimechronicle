// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '../../core/globals';
import { getGroundLevelAt, SAKURA_CAMP } from '../world/worldZones';

const DEFAULT_BUDGET = 70;
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();
const PINK_A = 0xFFB7D5;
const PINK_B = 0xFFD6E5;
const PINK_C = 0xFF8FB8;

/** Cerisiers qui perdent des pétales (rempli au spawn). */
const petalSources = [];

export function clearSakuraPetalSources() {
    petalSources.length = 0;
}

export function registerSakuraPetalSource(source) {
    if (!source) return;
    petalSources.push({
        x: source.x,
        y: source.y,
        z: source.z,
        r: Math.max(0.5, source.r || 1.1),
    });
}

function pickSource(rng) {
    if (!petalSources.length) return null;
    return petalSources[(rng() * petalSources.length) | 0];
}

function recyclePetal(p, rng) {
    const src = pickSource(rng);
    if (!src) {
        p.x = SAKURA_CAMP.cx;
        p.z = SAKURA_CAMP.cz;
        p.y = getGroundLevelAt({ x: p.x, z: p.z }) + 4;
        p.srcX = p.x;
        p.srcZ = p.z;
        p.maxR = 6;
    } else {
        const ang = rng() * Math.PI * 2;
        const rad = Math.sqrt(rng()) * src.r * 0.9;
        p.x = src.x + Math.cos(ang) * rad;
        p.z = src.z + Math.sin(ang) * rad;
        p.y = src.y + (rng() - 0.2) * 0.7;
        p.srcX = src.x;
        p.srcZ = src.z;
        p.maxR = src.r * 3.2 + 2.5;
    }
    p.fall = 0.42 + rng() * 0.7;
    p.driftX = 0.18 + rng() * 0.5;
    p.driftZ = (rng() - 0.5) * 0.4;
    p.spin = (rng() - 0.5) * 2.2;
    p.phase = rng() * Math.PI * 2;
    p.rx = rng() * Math.PI;
    p.ry = rng() * Math.PI;
    p.rz = rng() * Math.PI;
    p.s = 0.85 + rng() * 0.85;
}

function applyInstance(mesh, i, p) {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rx, p.ry, p.rz);
    dummy.scale.set(p.s * 0.28, p.s * 0.16, p.s * 0.045);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
}

export function createSakuraPetals(rng, budget) {
    disposeSakuraPetals();

    const rand = typeof rng === 'function' ? rng : Math.random;
    if (!petalSources.length) return null;

    const perTree = 8;
    const wanted = Math.max(budget || DEFAULT_BUDGET, petalSources.length * perTree);
    const count = Math.max(18, Math.min(140, wanted));

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.62,
        metalness: 0.0,
        flatShading: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
    });
    mat.userData.keep = false;

    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.name = 'sakuraPetals';
    mesh.userData.isEnvironment = true;

    const petals = new Array(count);
    for (let i = 0; i < count; i++) {
        const p = {};
        recyclePetal(p, rand);
        // Étale le départ pour que la chute soit déjà en cours
        p.y -= rand() * 2.4;
        petals[i] = p;
        applyInstance(mesh, i, p);
        tmpColor.setHex(i % 3 === 0 ? PINK_C : (i % 2 === 0 ? PINK_A : PINK_B));
        mesh.setColorAt(i, tmpColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const system = { mesh, petals, count, rng: rand, t: 0 };
    Globals.sakuraPetals = system;
    if (Globals.scene) Globals.scene.add(mesh);
    return mesh;
}

export function updateSakuraPetals(dt) {
    const sys = Globals.sakuraPetals;
    if (!sys || !sys.mesh || !sys.petals) return;

    sys.t = (sys.t || 0) + dt;
    const t = sys.t;
    const wind = 0.4 + Math.sin(t * 0.18) * 0.22;
    const mesh = sys.mesh;
    const rand = sys.rng || Math.random;

    for (let i = 0; i < sys.count; i++) {
        const p = sys.petals[i];
        const flutter = Math.sin(t * 1.6 + p.phase);
        p.x += (wind + flutter * 0.45) * p.driftX * dt;
        p.z += (Math.cos(t * 1.1 + p.phase) * 0.38 + p.driftZ) * dt;
        p.y -= p.fall * (0.85 + flutter * 0.12) * dt;
        p.rx += p.spin * dt;
        p.ry += p.spin * 0.55 * dt;
        p.rz += flutter * 1.4 * dt;

        const ground = getGroundLevelAt({ x: p.x, z: p.z });
        const dx = p.x - p.srcX;
        const dz = p.z - p.srcZ;
        if (p.y < ground + 0.08 || dx * dx + dz * dz > p.maxR * p.maxR) {
            recyclePetal(p, rand);
        }
        applyInstance(mesh, i, p);
    }
    mesh.instanceMatrix.needsUpdate = true;
}

export function disposeSakuraPetals() {
    const sys = Globals.sakuraPetals;
    if (!sys) {
        return;
    }

    const mesh = sys.mesh;
    if (mesh) {
        if (mesh.parent) mesh.parent.remove(mesh);
        else if (Globals.scene) Globals.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (let i = 0; i < mats.length; i++) {
            if (mats[i] && !(mats[i].userData && mats[i].userData.keep)) mats[i].dispose();
        }
        if (mesh.dispose) mesh.dispose();
    }
    Globals.sakuraPetals = null;
}
