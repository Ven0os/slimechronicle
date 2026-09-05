// @ts-nocheck
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Couche de "petits détails" : des milliers de props au sol (herbe, cailloux, fleurs...)
// rendus en une poignée de draw calls via THREE.InstancedMesh.
// Purement cosmétique : pas de collision, pas d'interaction, jamais fadé par l'occlusion.
// Aucun aléatoire ici : toute la variation vient de l'appelant (s, ry, color).

export type DetailType =
    | 'grass'        // touffe d'herbe
    | 'pebble'       // petit caillou
    | 'flower'       // fleur
    | 'mushroom'     // champignon
    | 'branch'       // branche morte au sol
    | 'reed'         // roseau (bords d'eau)
    | 'crystal_shard'// éclat de cristal (zone corrompue)
    | 'bone';        // ossement (zone désertique / corrompue)

export interface DetailInstance {
    type: DetailType;
    x: number;
    y: number;   // hauteur du sol déjà calculée par l'appelant
    z: number;
    s: number;   // échelle
    ry: number;  // rotation autour de Y, en radians
    color?: number; // teinte optionnelle (hex), sinon couleur par défaut du type
}

// Cache des géométries et des matériels (une seule entrée par type)
const geometryCache = {};
const materialCache = {};

// Ordre de construction fixe : garantit un ordre d'enfants déterministe dans le Group
const DETAIL_TYPES = ['grass', 'pebble', 'flower', 'mushroom', 'branch', 'reed', 'crystal_shard', 'bone'];

// Couleurs par défaut, utilisées quand l'appelant ne fournit pas de teinte.
// La géométrie étant fusionnée, un détail = une seule couleur (pas de vertexColors).
const DEFAULT_COLORS = {
    grass: 0x7CB342,
    pebble: 0x8D8D8D,
    flower: 0xF06292,
    mushroom: 0xD84315,
    branch: 0x6D4C41,
    reed: 0x9CCC65,
    crystal_shard: 0xB388FF,
    bone: 0xE8E0CE
};

// Les matériaux fusionnant plusieurs quads plats doivent être visibles des deux côtés
const DOUBLE_SIDED = { grass: true, flower: true, reed: true };

// Objets temporaires réutilisés : zéro allocation dans la boucle d'instanciation
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

// Fusionne des sous-parties en une géométrie unique et libère les temporaires
function mergeParts(parts) {
    const merged = mergeGeometries(parts, false);
    for (let i = 0; i < parts.length; i++) parts[i].dispose();
    return merged;
}

// --- Géométries : chacune sous les 40 triangles, pivot à la base (y = 0) ---

// 2 quads croisés, ~0.5 de haut => 4 triangles
function buildGrassGeometry() {
    const a = new THREE.PlaneGeometry(0.35, 0.5);
    a.translate(0, 0.25, 0);
    const b = new THREE.PlaneGeometry(0.35, 0.5);
    b.translate(0, 0.25, 0);
    b.rotateY(Math.PI / 2);
    return mergeParts([a, b]);
}

// Dodécaèdre aplati sur Y, à moitié enfoncé dans le sol => 36 triangles
function buildPebbleGeometry() {
    const geo = new THREE.DodecahedronGeometry(0.2, 0);
    geo.scale(1, 0.55, 1);
    geo.translate(0, 0.04, 0);
    return geo;
}

// Tige (6 tri) + tête aplatie en losange (12 tri) + coeur conique (8 tri) => 26 triangles
function buildFlowerGeometry() {
    const stem = new THREE.CylinderGeometry(0.012, 0.018, 0.3, 3, 1, true);
    stem.translate(0, 0.15, 0);
    const head = new THREE.BoxGeometry(0.17, 0.025, 0.17);
    head.rotateY(Math.PI / 4);
    head.translate(0, 0.3, 0);
    const heart = new THREE.ConeGeometry(0.035, 0.05, 4);
    heart.translate(0, 0.325, 0);
    return mergeParts([stem, head, heart]);
}

// Pied (10 tri) + chapeau conique (12 tri), ~0.32 de haut => 22 triangles
function buildMushroomGeometry() {
    const stem = new THREE.CylinderGeometry(0.035, 0.05, 0.18, 5, 1, true);
    stem.translate(0, 0.09, 0);
    const cap = new THREE.ConeGeometry(0.11, 0.14, 6);
    cap.translate(0, 0.25, 0);
    return mergeParts([stem, cap]);
}

// Branche couchée (12 tri) + brindille (12 tri) => 24 triangles
function buildBranchGeometry() {
    const main = new THREE.BoxGeometry(0.5, 0.04, 0.05);
    main.translate(0, 0.02, 0);
    const twig = new THREE.BoxGeometry(0.16, 0.03, 0.03);
    twig.rotateY(0.8);
    twig.translate(0.09, 0.02, 0.06);
    return mergeParts([main, twig]);
}

// 3 tiges coniques de hauteurs différentes (8 tri chacune), ~1.2 de haut => 24 triangles
function buildReedGeometry() {
    const heights = [1.2, 0.95, 0.7];
    const tilts = [0.03, -0.12, 0.15];
    const offsets = [0, 0.06, -0.05];
    const offsetsZ = [0, 0.04, 0.05];
    const parts = [];
    for (let i = 0; i < heights.length; i++) {
        const cone = new THREE.ConeGeometry(0.03, heights[i], 4);
        cone.translate(0, heights[i] * 0.5, 0);
        cone.rotateZ(tilts[i]); // rotation autour de la base, pivot déjà en y = 0
        cone.translate(offsets[i], 0, offsetsZ[i]);
        parts.push(cone);
    }
    return mergeParts(parts);
}

// Cône pointu 4 faces, pivot à la base => 8 triangles
function buildCrystalShardGeometry() {
    const geo = new THREE.ConeGeometry(0.12, 0.5, 4);
    geo.translate(0, 0.25, 0);
    return geo;
}

// Diaphyse (12 tri) + 2 épiphyses très low-poly (8 tri chacune) => 28 triangles
function buildBoneGeometry() {
    const shaft = new THREE.BoxGeometry(0.28, 0.05, 0.05);
    shaft.translate(0, 0.03, 0);
    const knobA = new THREE.SphereGeometry(0.055, 4, 2);
    knobA.translate(-0.14, 0.03, 0);
    const knobB = new THREE.SphereGeometry(0.055, 4, 2);
    knobB.translate(0.14, 0.03, 0);
    return mergeParts([shaft, knobA, knobB]);
}

const GEOMETRY_BUILDERS = {
    grass: buildGrassGeometry,
    pebble: buildPebbleGeometry,
    flower: buildFlowerGeometry,
    mushroom: buildMushroomGeometry,
    branch: buildBranchGeometry,
    reed: buildReedGeometry,
    crystal_shard: buildCrystalShardGeometry,
    bone: buildBoneGeometry
};

function getGeometry(type) {
    if (!geometryCache[type]) {
        const builder = GEOMETRY_BUILDERS[type];
        if (!builder) return null;
        const geo = builder();
        if (!geo) return null;
        geo.userData = geo.userData || {};
        geo.userData.keep = true;
        geometryCache[type] = geo;
    }
    return geometryCache[type];
}

function getMaterial(type) {
    if (!materialCache[type]) {
        // color blanc : c'est instanceColor qui porte la teinte de chaque détail
        const params = {
            color: 0xffffff,
            roughness: 1.0,
            flatShading: true
        };
        if (DOUBLE_SIDED[type]) params.side = THREE.DoubleSide;
        if (type === 'crystal_shard') {
            params.emissive = new THREE.Color(DEFAULT_COLORS.crystal_shard);
            params.emissiveIntensity = 0.8;
        }
        const mat = new THREE.MeshStandardMaterial(params);
        mat.userData = mat.userData || {};
        mat.userData.keep = true;
        materialCache[type] = mat;
    }
    return materialCache[type];
}

/**
 * Construit un THREE.Group contenant un THREE.InstancedMesh par type de détail présent.
 * Retourne null si la liste est vide.
 */
export function buildDetailLayer(instances: DetailInstance[]): THREE.Group | null {
    if (!instances || instances.length === 0) return null;

    // Regroupement par type en une passe : on ne crée qu'un tableau par type présent
    const buckets = {};
    for (let i = 0; i < instances.length; i++) {
        const inst = instances[i];
        if (!inst) continue;
        const bucket = buckets[inst.type];
        if (bucket) bucket.push(inst);
        else buckets[inst.type] = [inst];
    }

    const group = new THREE.Group();
    group.name = 'DetailLayer';
    group.userData.isDetailLayer = true;

    for (let t = 0; t < DETAIL_TYPES.length; t++) {
        const type = DETAIL_TYPES[t];
        const bucket = buckets[type];
        if (!bucket || bucket.length === 0) continue;

        const geo = getGeometry(type);
        if (!geo) continue;
        const mat = getMaterial(type);
        const defaultColor = DEFAULT_COLORS[type];

        const mesh = new THREE.InstancedMesh(geo, mat, bucket.length);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        let hasCustomColor = false;
        for (let i = 0; i < bucket.length; i++) {
            const inst = bucket[i];

            dummy.position.set(inst.x, inst.y, inst.z);
            dummy.rotation.y = inst.ry;
            dummy.scale.setScalar(inst.s);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);

            if (inst.color === undefined || inst.color === null) {
                tmpColor.setHex(defaultColor);
            } else {
                tmpColor.setHex(inst.color);
                hasCustomColor = true;
            }
            mesh.setColorAt(i, tmpColor);
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
            mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
            // Le buffer neuf est uploadé au premier rendu ; on force l'upload dès qu'une teinte custom est fournie
            if (hasCustomColor) mesh.instanceColor.needsUpdate = true;
        }

        // Décor pur : ni ombre projetée, ni ombre reçue
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        // Un seul InstancedMesh couvre toute la carte : le culling par objet le supprimerait à tort
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        mesh.name = `detail_${type}`;
        mesh.userData.isDetailLayer = true;

        group.add(mesh);
    }

    return group.children.length > 0 ? group : null;
}

/** Libère les ressources GPU propres à la couche (géométries/matériaux instanciés non partagés). */
export function disposeDetailLayer(group: THREE.Group | null): void {
    if (!group) return;

    for (let i = group.children.length - 1; i >= 0; i--) {
        const child = group.children[i];
        group.remove(child);

        // Libère instanceMatrix / instanceColor, qui sont propres à cette couche
        if (child.isInstancedMesh) child.dispose();

        const geo = child.geometry;
        if (geo && !(geo.userData && geo.userData.keep)) geo.dispose();

        const mat = child.material;
        if (Array.isArray(mat)) {
            for (let m = 0; m < mat.length; m++) {
                const sub = mat[m];
                if (sub && !(sub.userData && sub.userData.keep)) sub.dispose();
            }
        } else if (mat && !(mat.userData && mat.userData.keep)) {
            mat.dispose();
        }
    }

    if (group.parent) group.parent.remove(group);
}
