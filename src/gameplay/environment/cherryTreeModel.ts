// @ts-nocheck
import * as THREE from 'three';

const geometryCache = {};
const materialCache = {};

const WOOD_DARK = 0x6F4532;
const WOOD_LIGHT = 0xC68A5A;
const PINK = 0xFFB7D5;
const PINK_SOFT = 0xFFD6E5;

const VARIANT = {
    small: {
        trunkH: 1.35, rTop: 0.10, rBot: 0.16,
        canopyY: 1.55, canopyR: 0.72, blobs: 2, flowers: 5,
        branches: 1, spread: 0.85,
    },
    medium: {
        trunkH: 1.95, rTop: 0.16, rBot: 0.26,
        canopyY: 2.25, canopyR: 1.15, blobs: 4, flowers: 8,
        branches: 2, spread: 1.15,
    },
    large: {
        trunkH: 2.7, rTop: 0.22, rBot: 0.36,
        canopyY: 3.05, canopyR: 1.65, blobs: 5, flowers: 12,
        branches: 3, spread: 1.55,
    },
    ancient: {
        trunkH: 3.5, rTop: 0.42, rBot: 0.72,
        canopyY: 3.7, canopyR: 2.55, blobs: 7, flowers: 18,
        branches: 5, spread: 2.35,
    },
};

function getGeometry(key, creator) {
    if (!geometryCache[key]) {
        const geo = creator();
        geo.userData = geo.userData || {};
        geo.userData.keep = true;
        geometryCache[key] = geo;
    }
    return geometryCache[key];
}

function getMaterial(color, roughness = 0.9, isLeaves = false) {
    const key = `${color}_${roughness}_${isLeaves}`;
    if (!materialCache[key]) {
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: roughness,
            flatShading: true,
            transparent: true,
            opacity: 1.0,
        });
        mat.userData = mat.userData || {};
        mat.userData.keep = true;
        materialCache[key] = mat;
    }
    return materialCache[key];
}

function addMesh(group, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, isLeaves = false) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = false;
    m.receiveShadow = false;
    if (isLeaves) m.userData.isLeaves = true;
    group.add(m);
    return m;
}

export function createCherryTreeModel(scale = 1, variant = 'medium', foliageCol = null) {
    const cfg = VARIANT[variant] || VARIANT.medium;
    const group = new THREE.Group();
    group.userData.isEnvironment = true;
    group.userData.swaySpeed = 0.45 + Math.random() * 0.45;
    group.userData.swayOffset = Math.random() * 100;

    const trunkMat = getMaterial(WOOD_DARK, 1.0);
    const branchMat = getMaterial(WOOD_LIGHT, 0.95);
    const canopyMat = getMaterial(foliageCol || PINK, 0.85, true);
    const canopySoftMat = getMaterial(foliageCol ? foliageCol : PINK_SOFT, 0.8, true);
    const flowerMat = getMaterial(PINK_SOFT, 0.7, true);
    const flowerDeepMat = getMaterial(PINK, 0.7, true);

    const trunkGeo = getGeometry(`cherry_trunk_${variant}`, () =>
        new THREE.CylinderGeometry(cfg.rTop, cfg.rBot, cfg.trunkH, 5)
    );
    const trunk = addMesh(group, trunkGeo, trunkMat, 0, cfg.trunkH * 0.5, 0);
    trunk.rotation.y = Math.random() * Math.PI;
    if (variant === 'ancient') trunk.rotation.z = 0.06;

    if (variant === 'ancient') {
        const splitGeo = getGeometry('cherry_split', () => new THREE.CylinderGeometry(0.22, 0.38, 1.6, 5));
        const splitA = addMesh(group, splitGeo, trunkMat, 0.35, cfg.trunkH * 0.72, 0.1, 1, 1, 1);
        splitA.rotation.z = -0.45;
        const splitB = addMesh(group, splitGeo, trunkMat, -0.4, cfg.trunkH * 0.7, -0.15, 0.85, 0.9, 0.85);
        splitB.rotation.z = 0.4;
        splitB.rotation.x = 0.12;

        const rootGeo = getGeometry('cherry_root', () => new THREE.CylinderGeometry(0.18, 0.32, 1.1, 4));
        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2 + 0.2;
            const root = addMesh(group, rootGeo, trunkMat, Math.cos(ang) * 0.7, 0.18, Math.sin(ang) * 0.7, 1.3, 0.45, 1.1);
            root.rotation.z = Math.cos(ang) * 0.85;
            root.rotation.x = Math.sin(ang) * 0.85;
        }
    }

    const branchGeo = getGeometry('cherry_branch', () => new THREE.CylinderGeometry(0.05, 0.11, 1.15, 4));
    for (let i = 0; i < cfg.branches; i++) {
        const ang = (i / Math.max(1, cfg.branches)) * Math.PI * 2 + Math.random() * 0.4;
        const y = cfg.trunkH * (0.45 + (i % 3) * 0.14);
        const br = addMesh(
            group, branchGeo, branchMat,
            Math.cos(ang) * 0.25, y, Math.sin(ang) * 0.25,
            1, 0.7 + cfg.spread * 0.25, 1
        );
        br.rotation.z = Math.cos(ang) * (0.7 + (variant === 'ancient' ? 0.35 : 0.15));
        br.rotation.y = ang;
        br.rotation.x = Math.sin(ang) * 0.25;
    }

    const mainGeo = getGeometry('cherry_canopy_main', () => new THREE.IcosahedronGeometry(1.0, 0));
    const subGeo = getGeometry('cherry_canopy_sub', () => new THREE.IcosahedronGeometry(0.55, 0));
    const main = addMesh(
        group, mainGeo, canopyMat,
        0, cfg.canopyY, 0,
        cfg.canopyR * 1.05, cfg.canopyR * (variant === 'ancient' ? 0.72 : 0.88), cfg.canopyR * 1.05,
        true
    );
    main.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3);

    for (let i = 0; i < cfg.blobs; i++) {
        const ang = (Math.PI * 2 * i) / cfg.blobs + Math.random() * 0.35;
        const rad = cfg.canopyR * (0.55 + Math.random() * 0.35);
        const blob = addMesh(
            group, subGeo, i % 2 === 0 ? canopySoftMat : canopyMat,
            Math.cos(ang) * rad,
            cfg.canopyY - 0.15 + (Math.random() - 0.4) * cfg.canopyR * 0.45,
            Math.sin(ang) * rad,
            0.9 + Math.random() * 0.45,
            0.75 + Math.random() * 0.4,
            0.9 + Math.random() * 0.45,
            true
        );
        blob.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
    }

    const flowerGeo = getGeometry('cherry_flower', () => new THREE.SphereGeometry(0.14, 5, 4));
    for (let i = 0; i < cfg.flowers; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = cfg.canopyR * (0.35 + Math.random() * 0.85);
        const fy = cfg.canopyY + (Math.random() - 0.5) * cfg.canopyR * 0.9;
        addMesh(
            group, flowerGeo, i % 3 === 0 ? flowerDeepMat : flowerMat,
            Math.cos(ang) * rad,
            fy,
            Math.sin(ang) * rad,
            0.7 + Math.random() * 0.6,
            0.7 + Math.random() * 0.6,
            0.7 + Math.random() * 0.6,
            true
        );
    }

    group.scale.set(scale, scale, scale);

    group.animate = function (t) {
        const sway = Math.sin(t * this.userData.swaySpeed + this.userData.swayOffset) * 0.03;
        this.children.forEach((child) => {
            if (child.userData.isLeaves) {
                child.rotation.z = sway;
                child.rotation.x = sway * 0.5;
            }
        });
        this.rotation.z = sway * 0.5;
    };

    return group;
}

export function getCherryCanopyHeight(variant = 'medium', scale = 1) {
    const cfg = VARIANT[variant] || VARIANT.medium;
    return cfg.canopyY * scale;
}

export function getCherryCanopyRadius(variant = 'medium', scale = 1) {
    const cfg = VARIANT[variant] || VARIANT.medium;
    return cfg.canopyR * scale;
}

/** Gros cerisiers toujours, quelques medium, jamais les petits. Déterministe (x,z). */
export function cherryTreeShedsPetals(variant, x, z) {
    if (variant === 'ancient' || variant === 'large') return true;
    if (variant !== 'medium') return false;
    const n = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
    return (n - Math.floor(n)) < 0.42;
}
