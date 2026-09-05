// @ts-nocheck
import * as THREE from 'three';
import { SAKURA_LAKE } from '../world/worldZones';

const geometryCache = {};
const materialCache = {};

const C = {
    pink: 0xFFB7D5,
    pinkSoft: 0xFFD6E5,
    lightGreen: 0xB8E6A3,
    wood: 0xC68A5A,
    darkWood: 0x6F4532,
    vermillion: 0xC83C3C,
    lacquer: 0xE23A32,
    plank: 0xD9C09A,
    cream: 0xFFF4DC,
    gold: 0xD9A441,
    bamboo: 0x5FAF68,
    bambooLight: 0x8FCF83,
    water: 0x5EAEA8,
    stone: 0x8A8478,
    paper: 0xFFF1C9,
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

function mat(hex, extras = {}) {
    const key = `${hex}_${extras.emissive || 0}_${extras.roughness ?? 0.9}_${extras.opacity ?? 1}_${extras.metalness ?? 0.05}`;
    if (!materialCache[key]) {
        const params = {
            color: hex,
            roughness: extras.roughness ?? 0.9,
            metalness: extras.metalness ?? 0.05,
            flatShading: true,
            emissive: extras.emissive || 0x000000,
            emissiveIntensity: extras.emissiveIntensity || 0,
        };
        if (extras.opacity != null && extras.opacity < 1) {
            params.transparent = true;
            params.opacity = extras.opacity;
        }
        if (extras.side) params.side = extras.side;
        materialCache[key] = new THREE.MeshStandardMaterial(params);
        materialCache[key].userData.keep = true;
    }
    return materialCache[key];
}

function mesh(geo, material, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
}

function box(w, h, d) {
    return getGeometry(`box_${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
}

function cyl(rt, rb, h, seg = 5) {
    return getGeometry(`cyl_${rt}_${rb}_${h}_${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
}

function emptyResult(group) {
    return { group, obstacles: [] };
}

function finish(group, scale, obstacles) {
    group.userData.isEnvironment = true;
    group.scale.setScalar(scale);
    // ox/oz : espace local non scalé (comme landmarkModel). r déjà * scale.
    return {
        group,
        obstacles: obstacles.map((o) => ({ ox: o.ox, oz: o.oz, r: o.r * scale })),
    };
}

export function createToriiModel(scale = 1, size = 'entry') {
    const group = new THREE.Group();
    const isEntry = size === 'entry';
    // Taille monde réelle (le joueur ~2 de haut). Pas de scale 2.8 par-dessus.
    const h = isEntry ? 3.4 : 2.35;
    const span = isEntry ? 3.2 : 2.2;
    const thick = isEntry ? 0.22 : 0.16;
    const verm = mat(C.vermillion, { roughness: 0.75 });
    const dark = mat(C.darkWood, { roughness: 1.0 });

    const px = span * 0.5;
    const pillar = cyl(thick * 0.55, thick * 0.7, h, 6);
    group.add(mesh(pillar, verm, -px, h * 0.5, 0));
    group.add(mesh(pillar, verm, px, h * 0.5, 0));

    group.add(mesh(cyl(thick * 0.9, thick, 0.18, 6), dark, -px, 0.09, 0));
    group.add(mesh(cyl(thick * 0.9, thick, 0.18, 6), dark, px, 0.09, 0));

    // Kasagi (barre du haut) + nuki (barre du milieu) — un seul portique, pas une grille
    group.add(mesh(box(span + thick * 2.4, thick * 0.55, thick * 1.15), verm, 0, h + 0.08, 0));
    group.add(mesh(box(span + thick * 1.1, thick * 0.32, thick * 0.85), verm, 0, h - thick * 0.9, 0));
    group.add(mesh(box(span * 0.92, thick * 0.22, thick * 0.55), dark, 0, h * 0.58, 0));

    const s = Math.min(1.2, Math.max(0.75, scale));
    // Collision uniquement sur les 2 piliers — le passage central reste libre
    return finish(group, s, [
        { ox: -px, oz: 0, r: 0.32 },
        { ox: px, oz: 0, r: 0.32 },
    ]);
}

export function createJapaneseHouse(scale = 1, variant = 'small') {
    const group = new THREE.Group();
    const cream = mat(C.cream, { roughness: 0.95 });
    const wood = mat(C.wood, { roughness: 0.9 });
    const dark = mat(C.darkWood, { roughness: 1.0 });
    const verm = mat(C.vermillion, { roughness: 0.75 });
    const gold = mat(C.gold, { roughness: 0.35, metalness: 0.25 });

    const specs = {
        small: { w: 2.2, d: 2.0, h: 1.55, roof: dark, accent: wood, raised: 0.12, coll: 1.15 },
        main: { w: 3.6, d: 2.85, h: 2.05, roof: dark, accent: verm, raised: 0.18, coll: 1.75 },
        storage: { w: 1.85, d: 1.55, h: 1.35, roof: dark, accent: wood, raised: 0.08, coll: 0.95 },
        shrine: { w: 2.45, d: 2.35, h: 1.9, roof: verm, accent: verm, raised: 0.42, coll: 1.85 },
    };
    const s = specs[variant] || specs.small;
    const isShrine = variant === 'shrine';
    const isStorage = variant === 'storage';
    const floorY = s.raised;
    const bodyH = s.h;
    const bodyY = floorY + bodyH * 0.5;

    group.add(mesh(box(s.w + 0.35, 0.12, s.d + 0.35), dark, 0, floorY * 0.5, 0));
    group.add(mesh(box(s.w, bodyH, s.d), isStorage ? wood : cream, 0, bodyY, 0));

    const post = box(0.12, bodyH + 0.08, 0.12);
    const hw = s.w * 0.5 - 0.04;
    const hd = s.d * 0.5 - 0.04;
    const postMat = isShrine ? verm : wood;
    group.add(mesh(post, postMat, -hw, bodyY, -hd));
    group.add(mesh(post, postMat, hw, bodyY, -hd));
    group.add(mesh(post, postMat, -hw, bodyY, hd));
    group.add(mesh(post, postMat, hw, bodyY, hd));

    const beamY = floorY + bodyH - 0.06;
    group.add(mesh(box(s.w + 0.08, 0.1, 0.1), s.accent, 0, beamY, -hd));
    group.add(mesh(box(s.w + 0.08, 0.1, 0.1), s.accent, 0, beamY, hd));
    group.add(mesh(box(0.1, 0.1, s.d + 0.08), s.accent, -hw, beamY, 0));
    group.add(mesh(box(0.1, 0.1, s.d + 0.08), s.accent, hw, beamY, 0));

    if (!isStorage) {
        group.add(mesh(box(s.w * 0.28, bodyH * 0.42, 0.06), dark, 0, floorY + bodyH * 0.38, s.d * 0.5 + 0.02));
        group.add(mesh(box(0.04, bodyH * 0.42, 0.04), wood, 0, floorY + bodyH * 0.38, s.d * 0.5 + 0.04));
    }

    const roofY = floorY + bodyH + 0.28;
    const roofLen = s.w + 0.85;
    const roofDepth = s.d * 0.78;
    const slope = isShrine ? 0.48 : 0.38;
    // A-frame : le faîte au centre est plus haut. +Rx abaisse le bord +Z.
    // Pan arrière (z < 0) : rx négatif. Pan avant (z > 0) : rx positif.
    group.add(mesh(box(roofLen, 0.11, roofDepth), s.roof, 0, roofY, -roofDepth * 0.32, -slope, 0, 0));
    group.add(mesh(box(roofLen, 0.11, roofDepth), s.roof, 0, roofY, roofDepth * 0.32, slope, 0, 0));
    group.add(mesh(box(roofLen + 0.1, 0.14, 0.22), isShrine ? gold : dark, 0, roofY + Math.sin(slope) * roofDepth * 0.42, 0));

    if (variant === 'main') {
        group.add(mesh(box(s.w * 0.55, 0.08, 0.7), wood, 0, floorY + 0.06, s.d * 0.5 + 0.25));
        group.add(mesh(cyl(0.06, 0.07, 0.55, 5), wood, -s.w * 0.22, floorY + 0.28, s.d * 0.5 + 0.45));
        group.add(mesh(cyl(0.06, 0.07, 0.55, 5), wood, s.w * 0.22, floorY + 0.28, s.d * 0.5 + 0.45));
    }

    if (isShrine) {
        const step = box(1.15, 0.1, 0.45);
        group.add(mesh(step, dark, 0, 0.12, s.d * 0.5 + 0.35));
        group.add(mesh(step, dark, 0, 0.26, s.d * 0.5 + 0.18));
        group.add(mesh(cyl(0.08, 0.1, 1.6, 5), verm, -0.7, floorY + 0.85, s.d * 0.5 + 0.55));
        group.add(mesh(cyl(0.08, 0.1, 1.6, 5), verm, 0.7, floorY + 0.85, s.d * 0.5 + 0.55));
        group.add(mesh(box(1.55, 0.08, 0.12), verm, 0, floorY + 1.62, s.d * 0.5 + 0.55));
        group.add(mesh(cyl(0.12, 0.1, 0.28, 5), gold, 0, roofY + Math.sin(slope) * roofDepth * 0.42 + 0.22, 0));
        group.add(mesh(box(0.22, 0.45, 0.08), gold, 0, bodyY + 0.15, s.d * 0.5 + 0.03));
    }

    return finish(group, scale, [{ ox: 0, oz: 0, r: s.coll }]);
}

export function createJapaneseLantern(scale = 1, style = 'ground') {
    const group = new THREE.Group();
    const dark = mat(C.darkWood, { roughness: 1.0 });
    const stone = mat(C.stone, { roughness: 0.95 });
    const verm = mat(C.vermillion, { roughness: 0.75 });
    const glow = mat(C.paper, { emissive: C.pinkSoft, emissiveIntensity: 1.15, roughness: 0.35 });
    const gold = mat(C.gold, { roughness: 0.4, metalness: 0.2, emissive: C.gold, emissiveIntensity: 0.25 });

    if (style === 'path') {
        group.add(mesh(cyl(0.07, 0.09, 1.15, 5), dark, 0, 0.58, 0));
        group.add(mesh(box(0.38, 0.42, 0.38), glow, 0, 1.32, 0));
        group.add(mesh(box(0.46, 0.06, 0.46), verm, 0, 1.12, 0));
        group.add(mesh(box(0.46, 0.06, 0.46), verm, 0, 1.54, 0));
        group.add(mesh(box(0.52, 0.08, 0.52), dark, 0, 1.64, 0));
        group.add(mesh(cyl(0.04, 0.05, 0.16, 4), gold, 0, 1.76, 0));
    } else {
        group.add(mesh(cyl(0.28, 0.34, 0.16, 6), stone, 0, 0.08, 0));
        group.add(mesh(cyl(0.16, 0.2, 0.45, 6), stone, 0, 0.38, 0));
        group.add(mesh(box(0.42, 0.38, 0.42), glow, 0, 0.78, 0));
        group.add(mesh(box(0.08, 0.38, 0.08), dark, -0.16, 0.78, -0.16));
        group.add(mesh(box(0.08, 0.38, 0.08), dark, 0.16, 0.78, -0.16));
        group.add(mesh(box(0.08, 0.38, 0.08), dark, -0.16, 0.78, 0.16));
        group.add(mesh(box(0.08, 0.38, 0.08), dark, 0.16, 0.78, 0.16));
        group.add(mesh(box(0.55, 0.1, 0.55), dark, 0, 1.02, 0));
        group.add(mesh(getGeometry('lantern_cap', () => new THREE.ConeGeometry(0.32, 0.22, 4)), verm, 0, 1.16, 0));
        group.add(mesh(cyl(0.04, 0.05, 0.14, 4), gold, 0, 1.3, 0));
    }

    return finish(group, scale, []);
}

export function createBambooCluster(scale = 1) {
    const group = new THREE.Group();
    group.userData.isEnvironment = true;
    group.userData.swaySpeed = 0.7 + Math.random() * 0.5;
    group.userData.swayOffset = Math.random() * 100;

    const green = mat(C.bamboo, { roughness: 0.85 });
    const light = mat(C.bambooLight, { roughness: 0.8 });
    const nodeMat = mat(C.darkWood, { roughness: 1.0 });
    const leafMat = mat(C.lightGreen, { roughness: 0.75 });

    const stalkGeo = getGeometry('bamboo_stalk', () => new THREE.CylinderGeometry(0.055, 0.07, 1, 5));
    const nodeGeo = getGeometry('bamboo_node', () => new THREE.CylinderGeometry(0.08, 0.08, 0.04, 5));
    const leafGeo = getGeometry('bamboo_leaf', () => new THREE.ConeGeometry(0.12, 0.55, 4));

    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const rad = 0.18 + Math.random() * 0.45;
        const h = 2.1 + Math.random() * 1.8;
        const leanZ = (Math.random() - 0.5) * 0.18;
        const leanX = (Math.random() - 0.5) * 0.14;
        const stalk = mesh(stalkGeo, i % 2 === 0 ? green : light, Math.cos(ang) * rad, h * 0.5, Math.sin(ang) * rad, leanX, 0, leanZ, 1, h, 1);
        stalk.userData.isStalk = true;
        stalk.userData.baseRotX = leanX;
        stalk.userData.baseRotZ = leanZ;
        group.add(stalk);

        const nodes = 2 + Math.floor(Math.random() * 2);
        for (let n = 1; n <= nodes; n++) {
            group.add(mesh(nodeGeo, nodeMat, Math.cos(ang) * rad, h * (n / (nodes + 1)), Math.sin(ang) * rad));
        }
        const leaf = mesh(leafGeo, leafMat, Math.cos(ang) * rad, h + 0.15, Math.sin(ang) * rad, 0.4, ang, 0.2);
        leaf.userData.isLeaves = true;
        group.add(leaf);
    }

    group.scale.setScalar(scale);
    group.animate = function (t) {
        const sway = Math.sin(t * this.userData.swaySpeed + this.userData.swayOffset) * 0.035;
        this.rotation.z = sway;
        this.rotation.x = sway * 0.4;
        this.children.forEach((child) => {
            if (child.userData.isLeaves) child.rotation.z = sway * 1.6;
        });
    };

    return emptyResult(group);
}

export function createJapaneseBridge(scale = 1) {
    const group = new THREE.Group();
    const plankMat = mat(C.plank, { roughness: 0.88 });
    const verm = mat(C.lacquer, { roughness: 0.32, metalness: 0.12 });
    const vermDeep = mat(C.vermillion, { roughness: 0.4, metalness: 0.08 });
    const stone = mat(C.stone, { roughness: 0.95 });

    const half = SAKURA_LAKE.bridgeHalf;
    const arch = SAKURA_LAKE.bridgeArch;
    const deckY0 = SAKURA_LAKE.deckY;
    const width = 2.35;
    const railH = 0.62;

    const archY = (t) => deckY0 + arch * (1 - t * t);
    const archRx = (t) => Math.atan2(2 * arch * t, half);

    const addArcRun = (x, yOff, w, h, segs) => {
        for (let i = 0; i < segs; i++) {
            const t0 = (i / segs) * 2 - 1;
            const t1 = ((i + 1) / segs) * 2 - 1;
            const z0 = t0 * half;
            const z1 = t1 * half;
            const y0 = archY(t0) + yOff;
            const y1 = archY(t1) + yOff;
            const dz = z1 - z0;
            const dy = y1 - y0;
            const len = Math.hypot(dz, dy);
            const z = (z0 + z1) * 0.5;
            const y = (y0 + y1) * 0.5;
            const rx = -Math.atan2(dy, dz);
            group.add(mesh(box(w, h, len), verm, x, y, z, rx, 0, 0));
        }
    };

    addArcRun(-width * 0.46, -0.1, 0.2, 0.18, 14);
    addArcRun(width * 0.46, -0.1, 0.2, 0.18, 14);

    const planks = 22;
    const plankDepth = (half * 2) / planks * 0.72;
    for (let i = 0; i < planks; i++) {
        const t = (i / (planks - 1)) * 2 - 1;
        const z = t * half;
        const y = archY(t);
        const rx = archRx(t);
        group.add(mesh(box(width, 0.07, plankDepth), plankMat, 0, y, z, rx, 0, 0));
    }

    const posts = 11;
    const postGeo = cyl(0.045, 0.05, 1, 5);
    for (let i = 0; i < posts; i++) {
        const t = (i / (posts - 1)) * 2 - 1;
        const z = t * half;
        const yDeck = archY(t);
        const isEnd = i === 0 || i === posts - 1;
        for (const side of [-width * 0.54, width * 0.54]) {
            const ph = isEnd ? railH + 0.12 : railH;
            group.add(mesh(postGeo, isEnd ? vermDeep : verm, side, yDeck + ph * 0.5, z, 0, 0, 0, isEnd ? 1.35 : 1, ph, isEnd ? 1.35 : 1));
        }
    }
    addArcRun(-width * 0.54, railH, 0.1, 0.09, 14);
    addArcRun(width * 0.54, railH, 0.1, 0.09, 14);
    addArcRun(-width * 0.54, railH * 0.48, 0.07, 0.05, 14);
    addArcRun(width * 0.54, railH * 0.48, 0.07, 0.05, 14);

    for (const tEnd of [-1, 1]) {
        const z = tEnd * half;
        group.add(mesh(box(width + 0.85, 0.28, 0.9), stone, 0, 0.08, z));
        group.add(mesh(box(width + 0.45, 0.16, 0.55), stone, 0, 0.22, z * 0.97));
    }

    group.scale.setScalar(scale);
    return emptyResult(group);
}

export function createCampBanner(scale = 1) {
    const group = new THREE.Group();
    group.userData.isEnvironment = true;
    group.userData.swayOffset = Math.random() * 100;
    group.userData.swaySpeed = 1.6 + Math.random() * 0.6;

    const dark = mat(C.darkWood, { roughness: 1.0 });
    const white = mat(0xF7F2E8, { roughness: 0.85, side: THREE.DoubleSide });
    const verm = mat(C.vermillion, { roughness: 0.8, side: THREE.DoubleSide });
    const pink = mat(C.pink, { roughness: 0.8, side: THREE.DoubleSide });
    const gold = mat(C.gold, { roughness: 0.4, metalness: 0.2 });

    group.add(mesh(cyl(0.05, 0.07, 2.4, 5), dark, 0, 1.2, 0));
    group.add(mesh(cyl(0.08, 0.08, 0.08, 5), gold, 0, 2.42, 0));

    const flag = new THREE.Group();
    flag.add(mesh(box(0.95, 1.15, 0.04), white, 0.52, 0, 0));
    flag.add(mesh(box(0.95, 0.16, 0.045), verm, 0.52, 0.42, 0));
    flag.add(mesh(box(0.95, 0.1, 0.045), pink, 0.52, -0.38, 0));
    flag.add(mesh(box(0.12, 1.15, 0.05), verm, 0.08, 0, 0));
    flag.position.set(0.02, 1.72, 0);
    group.add(flag);
    group.userData.flag = flag;

    group.scale.setScalar(scale);
    group.animate = function (t) {
        const sway = Math.sin(t * this.userData.swaySpeed + this.userData.swayOffset) * 0.14;
        const flagMesh = this.userData.flag;
        if (flagMesh) {
            flagMesh.rotation.y = sway;
            flagMesh.rotation.z = sway * 0.15;
            flagMesh.scale.x = 1 + sway * 0.08;
        }
    };

    return emptyResult(group);
}

export function createSakuraLake() {
    const group = new THREE.Group();
    const water = mat(C.water, { roughness: 0.12, metalness: 0.22, opacity: 0.78, side: THREE.DoubleSide });
    const deep = mat(0x2A6E6A, { roughness: 0.25, metalness: 0.18, opacity: 0.55, side: THREE.DoubleSide });
    const stone = mat(C.stone, { roughness: 0.95 });
    const moss = mat(C.lightGreen, { roughness: 0.9 });
    const pink = mat(C.pink, { roughness: 0.7 });
    const rx = SAKURA_LAKE.rx;
    const rz = SAKURA_LAKE.rz;

    const waterGeo = getGeometry('sakura_lake_water', () => new THREE.CylinderGeometry(1, 1, 0.06, 20));
    group.add(mesh(waterGeo, water, 0, 0, 0, 0, 0, 0, rx, 1, rz));
    group.add(mesh(waterGeo, deep, 0, -0.12, 0, 0, 0, 0, rx * 0.72, 1, rz * 0.72));

    const rockGeo = getGeometry('pond_rock', () => new THREE.DodecahedronGeometry(0.35, 0));
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + 0.18;
        const x = Math.cos(a) * rx * 0.96;
        const z = Math.sin(a) * rz * 0.96;
        if (Math.abs(x) < 2.4) continue;
        const sy = 0.45 + (i % 3) * 0.12;
        group.add(mesh(rockGeo, i % 2 === 0 ? stone : moss, x, 0.42, z, 0.2, i * 0.5, 0.1, 1.1, sy, 0.95));
    }

    const padGeo = getGeometry('pond_pad', () => new THREE.CylinderGeometry(0.28, 0.3, 0.03, 6));
    const bloomGeo = getGeometry('pond_bloom', () => new THREE.SphereGeometry(0.08, 5, 4));
    const pads = [
        [5.2, 0.05, -3.4],
        [-6.1, 0.05, 2.8],
        [7.4, 0.05, 1.6],
        [-4.8, 0.05, -4.1],
        [3.6, 0.05, 4.6],
        [-8.2, 0.05, -1.2],
    ];
    for (let i = 0; i < pads.length; i++) {
        group.add(mesh(padGeo, moss, pads[i][0], pads[i][1], pads[i][2], 0, i, 0));
        if (i % 2 === 0) group.add(mesh(bloomGeo, pink, pads[i][0], pads[i][1] + 0.08, pads[i][2]));
    }

    return emptyResult(group);
}

export function createPondDecor(scale = 1) {
    const group = new THREE.Group();
    const water = mat(C.water, { roughness: 0.18, metalness: 0.15, opacity: 0.72 });
    const stone = mat(C.stone, { roughness: 0.95 });
    const moss = mat(C.lightGreen, { roughness: 0.9 });
    const pink = mat(C.pink, { roughness: 0.7 });

    group.add(mesh(cyl(3.6, 3.75, 0.08, 12), water, 0, 0.04, 0));
    group.add(mesh(cyl(3.9, 4.05, 0.1, 10), stone, 0, -0.02, 0));

    const rockGeo = getGeometry('pond_rock', () => new THREE.DodecahedronGeometry(0.35, 0));
    const spots = [
        [2.6, 0.12, 0.5, 1.3, 0.6, 1.05],
        [-2.4, 0.1, -0.9, 1.1, 0.55, 1.15],
        [0.5, 0.08, 2.8, 0.9, 0.45, 0.95],
        [-1.4, 0.1, 2.2, 0.75, 0.4, 0.85],
        [2.0, 0.09, -2.3, 1.0, 0.5, 1.0],
        [-2.5, 0.1, 1.4, 0.8, 0.4, 0.9],
    ];
    for (let i = 0; i < spots.length; i++) {
        const [x, y, z, sx, sy, sz] = spots[i];
        group.add(mesh(rockGeo, i % 2 === 0 ? stone : moss, x, y, z, 0.2, i * 0.7, 0.1, sx, sy, sz));
    }

    const padGeo = getGeometry('pond_pad', () => new THREE.CylinderGeometry(0.28, 0.3, 0.03, 6));
    const bloomGeo = getGeometry('pond_bloom', () => new THREE.SphereGeometry(0.08, 5, 4));
    const pads = [
        [0.7, 0.1, -0.5],
        [-1.0, 0.1, 0.8],
        [0.25, 0.1, 1.2],
        [1.4, 0.1, 0.4],
        [-0.5, 0.1, -1.3],
    ];
    for (let i = 0; i < pads.length; i++) {
        group.add(mesh(padGeo, moss, pads[i][0], pads[i][1], pads[i][2], 0, i, 0));
        if (i !== 1) group.add(mesh(bloomGeo, pink, pads[i][0], pads[i][1] + 0.08, pads[i][2]));
    }

    return finish(group, scale, []);
}

export function createCampProp(scale = 1, kind = 'crate') {
    const group = new THREE.Group();
    const wood = mat(C.wood, { roughness: 0.9 });
    const dark = mat(C.darkWood, { roughness: 1.0 });
    const verm = mat(C.vermillion, { roughness: 0.8 });

    if (kind === 'barrel') {
        group.add(mesh(cyl(0.38, 0.42, 0.85, 8), wood, 0, 0.43, 0));
        group.add(mesh(cyl(0.4, 0.4, 0.06, 8), dark, 0, 0.18, 0));
        group.add(mesh(cyl(0.4, 0.4, 0.06, 8), dark, 0, 0.68, 0));
        group.add(mesh(cyl(0.32, 0.32, 0.04, 8), dark, 0, 0.86, 0));
    } else if (kind === 'bench') {
        group.add(mesh(box(1.35, 0.1, 0.42), wood, 0, 0.42, 0));
        group.add(mesh(box(0.1, 0.42, 0.38), dark, -0.55, 0.21, 0));
        group.add(mesh(box(0.1, 0.42, 0.38), dark, 0.55, 0.21, 0));
        group.add(mesh(box(1.35, 0.42, 0.08), wood, 0, 0.72, -0.18));
        group.add(mesh(box(1.35, 0.08, 0.08), dark, 0, 0.95, -0.18));
    } else if (kind === 'fence') {
        group.add(mesh(cyl(0.06, 0.07, 1.05, 5), dark, -0.7, 0.52, 0));
        group.add(mesh(cyl(0.06, 0.07, 1.05, 5), dark, 0.7, 0.52, 0));
        group.add(mesh(box(1.5, 0.08, 0.07), wood, 0, 0.42, 0));
        group.add(mesh(box(1.5, 0.08, 0.07), wood, 0, 0.72, 0));
        group.add(mesh(box(0.12, 0.12, 0.12), verm, -0.7, 1.08, 0));
        group.add(mesh(box(0.12, 0.12, 0.12), verm, 0.7, 1.08, 0));
    } else {
        group.add(mesh(box(0.7, 0.62, 0.7), wood, 0, 0.31, 0));
        group.add(mesh(box(0.74, 0.06, 0.74), dark, 0, 0.64, 0));
        group.add(mesh(box(0.74, 0.06, 0.74), dark, 0, 0.08, 0));
        group.add(mesh(box(0.08, 0.62, 0.08), dark, -0.31, 0.31, -0.31));
        group.add(mesh(box(0.08, 0.62, 0.08), dark, 0.31, 0.31, -0.31));
        group.add(mesh(box(0.08, 0.62, 0.08), dark, -0.31, 0.31, 0.31));
        group.add(mesh(box(0.08, 0.62, 0.08), dark, 0.31, 0.31, 0.31));
    }

    return finish(group, scale, []);
}
