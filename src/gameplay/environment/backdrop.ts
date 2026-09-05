// @ts-nocheck
import * as THREE from 'three';

// Cache des géométries et des matériaux du décor lointain
const geometryCache = {};
const materialCache = {};

// Budget dur : le décor ne doit jamais coûter plus que ça
const MAX_MESHES = 60;

const SKY_COLOR = 0x87CEEB;   // Couleur du ciel, cible du "délavage" atmosphérique
const SEA_LEVEL = -1.8;       // Hauteur du plan d'eau (cf. core/scene.ts)

function getGeometry(key, creator) {
    if (!geometryCache[key]) {
        const geo = creator();
        geo.userData = geo.userData || {};
        geo.userData.keep = true;
        geometryCache[key] = geo;
    }
    return geometryCache[key];
}

function getBackdropMaterial(colorHex) {
    if (!materialCache[colorHex]) {
        // MeshBasicMaterial : silhouettes plates, aucune lumière à calculer.
        // fog: false est vital, sinon le brouillard exponentiel avale tout l'horizon.
        const mat = new THREE.MeshBasicMaterial({
            color: colorHex,
            fog: false
        });
        mat.userData = mat.userData || {};
        mat.userData.keep = true;
        materialCache[colorHex] = mat;
    }
    return materialCache[colorHex];
}

// Couches de profondeur : plus c'est loin, plus c'est petit et délavé vers le ciel
const MOUNTAIN_LAYERS = [
    { color: 0x4a5a6e, wash: 0.00, rMin: 175, rMax: 205, hMin: 62, hMax: 95, bMin: 38, bMax: 55 },
    { color: 0x6b7c92, wash: 0.18, rMin: 200, rMax: 232, hMin: 50, hMax: 74, bMin: 30, bMax: 44 },
    { color: 0x93a5ba, wash: 0.35, rMin: 228, rMax: 260, hMin: 40, hMax: 58, bMin: 25, bMax: 36 }
];

// Mélange vers la couleur du ciel pour simuler la perspective atmosphérique
function washedColor(colorHex, amount) {
    const c = new THREE.Color(colorHex);
    c.lerp(new THREE.Color(SKY_COLOR), amount);
    return c.getHex();
}

export function createBackdrop(rng: () => number): THREE.Group {
    const group = new THREE.Group();
    group.userData.isBackdrop = true;

    let meshCount = 0;

    // Ajoute un mesh en respectant le budget, renvoie null si le quota est atteint
    function addMesh(geo, mat) {
        if (meshCount >= MAX_MESHES) return null;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.isBackdrop = true;
        // Raycast neutralisé : le système d'occlusion traverse le décor gratuitement
        mesh.raycast = () => {};
        group.add(mesh);
        meshCount++;
        return mesh;
    }

    // === 1. ANNEAU DE MONTAGNES LOINTAINES ===
    const peakGeos = [
        getGeometry('backdrop_peak_5', () => new THREE.ConeGeometry(1, 1, 5)),
        getGeometry('backdrop_peak_6', () => new THREE.ConeGeometry(1, 1, 6)),
        getGeometry('backdrop_peak_7', () => new THREE.ConeGeometry(1, 1, 7))
    ];

    const peakCount = 26 + Math.floor(rng() * 5); // 26 à 30 sommets
    const step = (Math.PI * 2) / peakCount;

    for (let i = 0; i < peakCount; i++) {
        // Espacement angulaire irrégulier pour casser la régularité de l'anneau
        const angle = i * step + (rng() - 0.5) * step * 0.9;

        const pick = rng();
        const layer = pick < 0.38 ? MOUNTAIN_LAYERS[0] : (pick < 0.72 ? MOUNTAIN_LAYERS[1] : MOUNTAIN_LAYERS[2]);

        const mat = getBackdropMaterial(washedColor(layer.color, layer.wash));
        const peak = addMesh(peakGeos[Math.floor(rng() * peakGeos.length)], mat);
        if (!peak) break;

        const radius = layer.rMin + rng() * (layer.rMax - layer.rMin);
        const height = layer.hMin + rng() * (layer.hMax - layer.hMin);
        const base = layer.bMin + rng() * (layer.bMax - layer.bMin);

        // Base enfoncée sous la mer pour ne jamais laisser voir un vide sous le relief
        peak.position.set(Math.cos(angle) * radius, -4 + height / 2, Math.sin(angle) * radius);
        peak.scale.set(base * (0.85 + rng() * 0.3), height, base * (0.85 + rng() * 0.3));
        peak.rotation.y = rng() * Math.PI * 2;
    }

    // === 2. SILHOUETTES DE RUINES LOINTAINES ===
    const ruinMat = getBackdropMaterial(0x5a6a80);
    const towerGeo = getGeometry('backdrop_tower', () => new THREE.CylinderGeometry(0.78, 1, 1, 6));
    const blockGeo = getGeometry('backdrop_block', () => new THREE.BoxGeometry(1, 1, 1));

    const ruinCount = 3 + Math.floor(rng() * 2); // 3 à 4 silhouettes
    for (let i = 0; i < ruinCount; i++) {
        const angle = rng() * Math.PI * 2;
        const radius = 172 + rng() * 44;
        const px = Math.cos(angle) * radius;
        const pz = Math.sin(angle) * radius;

        const towerH = 14 + rng() * 9;
        const towerR = 3 + rng() * 2;

        const tower = addMesh(towerGeo, ruinMat);
        if (!tower) break;
        tower.position.set(px, -3 + towerH / 2, pz);
        tower.scale.set(towerR, towerH, towerR);
        tower.rotation.y = rng() * Math.PI * 2;

        // Sommet brisé posé de travers
        const top = addMesh(blockGeo, ruinMat);
        if (!top) break;
        top.position.set(px + (rng() - 0.5) * towerR, -3 + towerH + towerR * 0.35, pz + (rng() - 0.5) * towerR);
        top.scale.set(towerR * 1.5, towerR * 0.9, towerR * 1.1);
        top.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI, (rng() - 0.5) * 0.5);
    }

    // === 3. ÉCUEILS ET ÎLOTS EN MER ===
    const isletGeo = getGeometry('backdrop_islet', () => new THREE.DodecahedronGeometry(1, 0));
    const isletMat = getBackdropMaterial(0x2f3d4f);

    const isletCount = 8 + Math.floor(rng() * 4); // 8 à 11 îlots
    for (let i = 0; i < isletCount; i++) {
        const angle = rng() * Math.PI * 2;
        const radius = 120 + rng() * 45;
        const cx = Math.cos(angle) * radius;
        const cz = Math.sin(angle) * radius;

        const parts = 1 + Math.floor(rng() * 3); // 1 à 3 blocs par îlot
        let stop = false;
        for (let p = 0; p < parts; p++) {
            const rock = addMesh(isletGeo, isletMat);
            if (!rock) { stop = true; break; }

            const size = 1.4 + rng() * 2.6;
            // Base sous le niveau de la mer : les rochers émergent de l'eau
            rock.position.set(
                cx + (rng() - 0.5) * 6,
                SEA_LEVEL - 0.1 + rng() * 0.5,
                cz + (rng() - 0.5) * 6
            );
            rock.scale.set(size, size * 0.5, size * (0.7 + rng() * 0.6));
            rock.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
        }
        if (stop) break;
    }

    // === STATIQUE ===
    // Aucune animation, aucune collision : on fige les matrices une bonne fois pour toutes
    group.traverse(c => {
        c.matrixAutoUpdate = false;
        c.updateMatrix();
    });
    group.matrixAutoUpdate = true;

    group.userData.meshCount = meshCount;

    return group;
}
