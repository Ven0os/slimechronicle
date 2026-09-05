// @ts-nocheck
import { Globals, addEnemy } from '../core/globals';
import { STATE } from '../core/config';
import { RoyalSeal } from './environment/royal_seal';

import { createTreeModel } from './environment/treeModel';
import { createRockModel } from './environment/rockModel';
import { createBushModel } from './environment/bushModel';
import { createRuinsModel } from './environment/ruinsModel';
import { createCliffModel } from './environment/cliffModel';
import { createLandmarkModel } from './environment/landmarkModel';
import { createBackdrop } from './environment/backdrop';
import { buildDetailLayer, disposeDetailLayer } from './environment/detailModel';
import { createCherryTreeModel, getCherryCanopyHeight, getCherryCanopyRadius, cherryTreeShedsPetals } from './environment/cherryTreeModel';
import {
    createToriiModel,
    createJapaneseHouse,
    createJapaneseLantern,
    createBambooCluster,
    createJapaneseBridge,
    createCampBanner,
    createPondDecor,
    createSakuraLake,
    createCampProp,
} from './environment/japaneseProps';
import { createSakuraPetals, updateSakuraPetals, disposeSakuraPetals, registerSakuraPetalSource, clearSakuraPetalSources } from './environment/sakuraPetals';
import {
    SAKURA_CAMP_STRUCTURES,
    SAKURA_CAMP_DECOR,
    SAKURA_GROVE_TREES,
} from './environment/sakuraCampLayout';

import * as THREE from 'three';
import {
    BOSS_ZONE,
    getRegionAt,
    getGroundLevelAt,
    createSeededRng,
    isInArenaCore,
    isInSakuraCamp,
    isInSakuraLake,
    isOnSakuraBridge,
    isNearSakuraCrossing,
    getWorldZoneAt,
    getDecoDensityAt,
    isNearPath,
    LANDMARK_SITES,
    DECO_CLUSTERS,
    ARENA,
    SAKURA_CAMP,
    SAKURA_LAKE,
} from './world/worldZones';
import { disposeObject3D } from '../visual/meshMaterialUtils';

const animatedObjects = [];
const fadedObjects = []; 

// --- DÉFINITION DES SAISONS ---
const SEASONS = {
    SPRING: {
        name: 'Printemps',
        leaves: [0xFFB7C5, 0xFF69B4, 0x8FBC8F, 0x98FB98], 
        rock: [0x808080, 0xA9A9A9], 
        cliff: 0x555555
    },
    SUMMER: {
        name: 'Été',
        leaves: [0x2E7D32, 0x1B5E20, 0x43A047], 
        rock: [0x616161, 0x757575], 
        cliff: 0x424242
    },
    AUTUMN: {
        name: 'Automne',
        leaves: [0xD84315, 0xFF8F00, 0xC62828, 0xF9A825], 
        rock: [0x5D4037, 0x6D4C41], 
        cliff: 0x4E342E
    },
    WINTER: {
        name: 'Hiver',
        leaves: [0xFFFFFF, 0xE0F7FA, 0xB2EBF2], 
        rock: [0xE0E0E0, 0xB0BEC5], 
        cliff: 0x90A4AE
    }
};

let currentSeasonPalette = SEASONS.SUMMER; 

// Helper pour ajouter une collision à une position relative (locale)
function addCompositeObstacle(centerX, centerZ, rotationY, offsetX, offsetZ, radius) {
    // Calcul de la position du sous-obstacle en appliquant la rotation de l'objet
    const offset = new THREE.Vector3(offsetX, 0, offsetZ);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    
    const finalPos = new THREE.Vector3(centerX, 0, centerZ).add(offset);
    
    Globals.obstacles.push({
        position: finalPos,
        radius: radius,
        isDecor: true
    });
}

export function createBoundaries() {
    const wallHeight = 20;
    const span = 320;
    const half = span / 2;
    const wallGeo = new THREE.BoxGeometry(span, wallHeight, 2);
    const wallMat = new THREE.MeshBasicMaterial({ visible: false });

    const w1 = new THREE.Mesh(wallGeo, wallMat); w1.position.set(0, wallHeight/2, -half); Globals.scene.add(w1);
    const w2 = new THREE.Mesh(wallGeo, wallMat); w2.position.set(0, wallHeight/2, half); Globals.scene.add(w2);
    const w3 = new THREE.Mesh(wallGeo, wallMat); w3.rotation.y = Math.PI/2; w3.position.set(half, wallHeight/2, 0); Globals.scene.add(w3);
    const w4 = new THREE.Mesh(wallGeo, wallMat); w4.rotation.y = Math.PI/2; w4.position.set(-half, wallHeight/2, 0); Globals.scene.add(w4);

    if (!Globals.obstacles) Globals.obstacles = [];
}

export function createAltars() {
    const sealPosition = new THREE.Vector3(BOSS_ZONE.cx, 0, BOSS_ZONE.cz + 6);
    const seal = new RoyalSeal(sealPosition);
    seal.userData.bossType = 'king';
    addEnemy(seal);
    Globals.menhirs.push(seal);
}

// Appelée à chaque frame par la game loop : on ne retouche le DOM que si l'état change,
// au lieu de refaire un getElementById et une écriture de style 60 à 144 fois par seconde.
let menhirHudHidden = false;
export function updateMenhirVisuals() {
    if (menhirHudHidden) return;
    const hud = document.getElementById('menhir-hud');
    if (!hud) return;
    hud.style.display = 'none';
    menhirHudHidden = true;
}

let skyParticles;
export function createAnimatedSky() {
    const isWinter = currentSeasonPalette.name === 'Hiver';
    const skyColor = isWinter ? 0xFFFFFF : 0x88CCFF;

    const particleCount = 2000;
    const geom = new THREE.BufferGeometry();
    const pos = [];
    const sizes = [];
    const speeds = [];

    for(let i=0; i<particleCount; i++) {
        const x = (Math.random() - 0.5) * 300;
        const y = Math.random() * 100; 
        const z = (Math.random() - 0.5) * 300;
        pos.push(x, y, z);
        sizes.push(Math.random() * 0.5 + 0.1);
        speeds.push(Math.random() * 0.02 + 0.005);
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    geom.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));

    const mat = new THREE.PointsMaterial({
        color: skyColor, 
        size: 0.5, 
        transparent: true, 
        opacity: 0.4,
        sizeAttenuation: true, 
        blending: THREE.AdditiveBlending
    });

    skyParticles = new THREE.Points(geom, mat);
    Globals.scene.add(skyParticles);
}

export function updateAnimatedSky(dt) {
    if(!skyParticles) return;
    skyParticles.rotation.y += dt * 0.01;
    const positions = skyParticles.geometry.attributes.position.array;
    const speeds = skyParticles.geometry.attributes.speed.array;
    for(let i=0; i < positions.length / 3; i++) {
        positions[i*3 + 1] += speeds[i] * (dt * 60); 
        if (positions[i*3 + 1] > 80) positions[i*3 + 1] = 0;
    }
    skyParticles.geometry.attributes.position.needsUpdate = true;
}

export function clearDecorations() {
    if (Globals.decoGroup) {
        Globals.scene.remove(Globals.decoGroup);
        // Les décors représentent des centaines de meshes : sans libération, chaque
        // reconstruction de carte (rejoindre une partie) laissait tout en mémoire GPU.
        // disposeObject3D épargne les géométries/matériaux mis en cache (userData.keep).
        disposeObject3D(Globals.decoGroup);
        Globals.decoGroup = null;
    }
    if (Globals.backdropGroup) {
        Globals.scene.remove(Globals.backdropGroup);
        Globals.backdropGroup = null;
    }
    if (Globals.detailLayer) {
        disposeDetailLayer(Globals.detailLayer);
        Globals.detailLayer = null;
    }
    disposeSakuraPetals();
    clearSakuraPetalSources();
    if(Globals.obstacles) {
        Globals.obstacles = Globals.obstacles.filter(o => !o.isDecor && (o.isPersistent || o.radius >= 2.5));
    }
    animatedObjects.length = 0;
    fadedObjects.length = 0;
}

export function createDecorations(importedData = null) {
    if (Globals.decoGroup || Globals.backdropGroup || Globals.detailLayer || Globals.sakuraPetals) {
        clearDecorations();
    }

    const decoGroup = new THREE.Group();
    Globals.decoGroup = decoGroup; 
    Globals.scene.add(decoGroup);

    if (!Globals.obstacles) Globals.obstacles = [];
    
    const isHost = !importedData;
    const mapData = [];

    const spawnObject = (type, x, z, s, ry, subtype = null, color = null) => {
        let object3D;
        const region = getRegionAt(x, z);
        
        // --- LOGIQUE SPAWN & COLLISION SPÉCIFIQUE ---

        if (type === 'tree') {
            let treeType = subtype;
            if (!treeType) {
                if (region === 'cold') {
                    treeType = 'pine';
                } else if (region === 'desert') {
                    treeType = 'dead';
                } else if (region === 'mountain') {
                    treeType = Math.random() > 0.4 ? 'dead' : 'pine';
                } else { // temperate
                    treeType = Math.random() > 0.7 ? (Math.random() > 0.5 ? 'oak' : 'dead') : 'pine';
                }
            }
            
            let foliageCol = color;
            if (treeType === 'pine') {
                if (region === 'cold') {
                    foliageCol = Math.random() > 0.3 ? 0xffffff : 0xd6fafc;
                } else if (region === 'mountain') {
                    foliageCol = 0x1F3D2A;
                } else {
                    const pineGreens = [0x1B5E20, 0x2E7D32, 0x33691E, 0x3E6B3A];
                    foliageCol = pineGreens[(Math.random() * pineGreens.length) | 0];
                }
            } else if (!foliageCol) {
                if (region === 'cold') {
                    foliageCol = Math.random() > 0.3 ? 0xffffff : 0xd6fafc;
                } else if (region === 'mountain') {
                    foliageCol = 0x243242;
                } else if (region === 'desert') {
                    foliageCol = 0x5D4037;
                } else {
                    foliageCol = currentSeasonPalette.leaves[Math.floor(Math.random() * currentSeasonPalette.leaves.length)];
                }
            }
            
            object3D = createTreeModel(s, treeType, foliageCol);
            const groundY = getGroundLevelAt({ x, z });
            object3D.position.set(x, groundY, z);
            object3D.rotation.y = ry;
            
            // Collision tronc simple
            addCompositeObstacle(x, z, ry, 0, 0, 0.5 * s); 
            
            if(!subtype) subtype = treeType; 
            if(!color) color = foliageCol; 
        } 
        else if (type === 'rock') {
            let rockCol = color;
            if (!rockCol) {
                if (region === 'cold') {
                    rockCol = 0xb8cbd6; // Snowy/icy rock
                } else if (region === 'mountain') {
                    rockCol = 0x303841; // Dark basalt/granite rock
                } else if (region === 'desert') {
                    rockCol = 0xd38b5d; // Red sandstone
                } else { // temperate
                    rockCol = currentSeasonPalette.rock[Math.floor(Math.random() * currentSeasonPalette.rock.length)];
                }
            }
            object3D = createRockModel(s, rockCol);
            const groundY = getGroundLevelAt({ x, z });
            object3D.position.set(x, groundY + s * 0.2, z);
            object3D.rotation.set(ry, ry, ry);
            
            // Petits cailloux : cosmétique uniquement
            if (s >= 1.0) {
                addCompositeObstacle(x, z, ry, 0, 0, 0.7 * s);
            }
            
            if(!color) color = rockCol;
        }
        else if (type === 'bush') {
            let bushCol = color;
            if (!bushCol) {
                if (region === 'cold') {
                    bushCol = 0xd5eef2; // Frosted bush
                } else if (region === 'mountain') {
                    bushCol = 0x2f3a46; // Dark rocky bush
                } else if (region === 'desert') {
                    bushCol = 0xccb27a; // Tumbleweed/dry shrub yellow
                } else { // temperate
                    bushCol = currentSeasonPalette.leaves[Math.floor(Math.random() * currentSeasonPalette.leaves.length)];
                }
            }
            object3D = createBushModel(s, bushCol);
            const groundY = getGroundLevelAt({ x, z });
            object3D.position.set(x, groundY, z);
            object3D.rotation.y = ry;
            // PAS DE COLLISION POUR LES BUISSONS (On marche dedans)
            
            if(!color) color = bushCol;
        }
        else if (type === 'ruins') {
            const ruinsType = subtype || (Math.random() > 0.5 ? 'arch' : 'pillar');
            object3D = createRuinsModel(s, ruinsType);
            const groundY = getGroundLevelAt({ x, z });
            object3D.position.set(x, groundY, z);
            object3D.rotation.y = ry;
            
            // COLLISION COMPLEXE POUR LES RUINES
            if (ruinsType === 'arch') {
                addCompositeObstacle(x, z, ry, -1.0 * s, 0, 0.6 * s);
                addCompositeObstacle(x, z, ry,  1.0 * s, 0, 0.6 * s);
            } else {
                addCompositeObstacle(x, z, ry, 0, 0, 0.8 * s);
            }

            if(!subtype) subtype = ruinsType;
        }
        else if (type === 'cliff') {
            let cliffCol = color;
            if (!cliffCol) {
                if (region === 'cold') cliffCol = 0x90A4AE;
                else if (region === 'mountain') cliffCol = 0x303841;
                else if (region === 'desert') cliffCol = 0xa67c52;
                else cliffCol = currentSeasonPalette.cliff;
            }
            object3D = createCliffModel(s, cliffCol);
            const groundY = getGroundLevelAt({ x, z });
            object3D.position.set(x, groundY + s * 1.1, z);
            object3D.rotation.y = ry;
            addCompositeObstacle(x, z, ry, 0, 0, 1.35 * s);
            if (!color) color = cliffCol;
        }
        else if (type === 'sakura') {
            const variant = subtype || (s > 2.6 ? 'ancient' : (s > 1.6 ? 'large' : (s > 1.1 ? 'medium' : 'small')));
            object3D = createCherryTreeModel(s, variant, color);
            const groundY = getGroundLevelAt({ x, z });
            object3D.position.set(x, groundY, z);
            object3D.rotation.y = ry;
            if (variant === 'ancient' || variant === 'large') {
                addCompositeObstacle(x, z, ry, 0, 0, 0.55 * s);
            }
            registerTreePetals(x, groundY, z, variant, s);
            if (!subtype) subtype = variant;
        }
        else if (type === 'bamboo') {
            const built = createBambooCluster(s);
            object3D = built.group;
            const groundY = getGroundLevelAt({ x, z });
            object3D.position.set(x, groundY, z);
            object3D.rotation.y = ry;
        }
        else if (type === 'jp') {
            const built = buildJapaneseProp(subtype, s);
            object3D = built.group;
            object3D.userData.isLandmark = object3D.userData.isLandmark || (built.obstacles && built.obstacles.length > 0);
            let groundY = getGroundLevelAt({ x, z });
            if (subtype === 'lake' || subtype === 'pond') groundY = SAKURA_LAKE.waterY;
            else if (subtype === 'bridge') groundY = 0;
            object3D.position.set(x, groundY, z);
            object3D.rotation.y = ry;
            const gs = object3D.scale?.x || 1;
            for (const obs of built.obstacles) {
                addCompositeObstacle(x, z, ry, obs.ox * gs, obs.oz * gs, obs.r);
            }
        }
        else if (type === 'landmark') {
            const landmarkType = subtype || 'giant_tree';
            if (landmarkType === 'ancient_sakura') {
                object3D = createCherryTreeModel(s, 'ancient', color);
                object3D.userData.isLandmark = true;
                const groundY = getGroundLevelAt({ x, z });
                object3D.position.set(x, groundY, z);
                object3D.rotation.y = ry;
                addCompositeObstacle(x, z, ry, 0, 0, 1.15 * s);
                registerTreePetals(x, groundY, z, 'ancient', s);
            } else if (landmarkType === 'torii_entry') {
                const built = createToriiModel(Math.min(1.15, s), 'entry');
                object3D = built.group;
                object3D.userData.isLandmark = true;
                const groundY = getGroundLevelAt({ x, z });
                object3D.position.set(x, groundY, z);
                object3D.rotation.y = ry;
                const gs = object3D.scale?.x || 1;
                for (const obs of built.obstacles) {
                    addCompositeObstacle(x, z, ry, obs.ox * gs, obs.oz * gs, obs.r);
                }
            } else {
                const built = createLandmarkModel(landmarkType, s, color);
                object3D = built.group;
                const groundY = getGroundLevelAt({ x, z });
                object3D.position.set(x, groundY, z);
                object3D.rotation.y = ry;
                for (const obs of built.obstacles) {
                    addCompositeObstacle(x, z, ry, obs.ox * s, obs.oz * s, obs.r);
                }
            }
            if (!subtype) subtype = landmarkType;
        }

        if (object3D) {
            decoGroup.add(object3D);
            if (typeof object3D.animate === 'function') {
                animatedObjects.push(object3D);
            } else {
                object3D.traverse((child) => {
                    if (child !== object3D && typeof child.animate === 'function') {
                        animatedObjects.push(child);
                    }
                });
            }
            return { subtype, color }; 
        }
        return null;
    };

    if (isHost) {
        const worldSeed = (Math.random() * 0x7fffffff) | 0;
        const rng = createSeededRng(worldSeed);
        const seasonKey = Object.keys(SEASONS)[Math.floor(rng() * Object.keys(SEASONS).length)];
        currentSeasonPalette = SEASONS[seasonKey];
        console.log(`🍂 SAISON GÉNÉRÉE : ${currentSeasonPalette.name} (seed ${worldSeed})`);
        mapData.push({ type: '_meta', seed: worldSeed, season: seasonKey });

        generateWorldDecor(spawnObject, mapData, rng);
        finishAtmosphere(worldSeed);
        Globals.mapData = mapData;
    } else {
        let items = importedData;
        let worldSeed = 1;
        if (items && items.length && items[0].type === '_meta') {
            worldSeed = items[0].seed || 1;
            if (items[0].season && SEASONS[items[0].season]) {
                currentSeasonPalette = SEASONS[items[0].season];
            }
            items = items.slice(1);
        }
        items.forEach(d => {
            if (d.type === '_meta') return;
            spawnObject(d.type, d.x, d.z, d.s, d.ry, d.subtype, d.color);
        });
        finishAtmosphere(worldSeed);
    }
}

function registerTreePetals(x, groundY, z, variant, s) {
    if (!cherryTreeShedsPetals(variant, x, z)) return;
    registerSakuraPetalSource({
        x,
        z,
        y: groundY + getCherryCanopyHeight(variant, s),
        r: getCherryCanopyRadius(variant, s),
    });
}

function isValidDecoPos(x, z, allowArenaEdge = false) {
    const distToSpawn = Math.hypot(x - 90, z - 90);
    if (distToSpawn < 25) return false;
    const distToBoss = Math.hypot(x - BOSS_ZONE.cx, z - BOSS_ZONE.cz);
    if (distToBoss < 32) return false;
    if (getGroundLevelAt({ x, z }) < -1.0) return false;
    if (isInSakuraLake(x, z) || isOnSakuraBridge(x, z) || isNearSakuraCrossing(x, z)) return false;
    if (!allowArenaEdge && isInArenaCore(x, z)) return false;
    if (isInSakuraCamp(x, z)) return false;
    return true;
}

function buildJapaneseProp(subtype, s) {
    if (subtype === 'torii_entry') return createToriiModel(s, 'entry');
    if (subtype === 'torii_small') return createToriiModel(s, 'small');
    if (subtype === 'house_main') return createJapaneseHouse(s, 'main');
    if (subtype === 'house_small') return createJapaneseHouse(s, 'small');
    if (subtype === 'house_storage') return createJapaneseHouse(s, 'storage');
    if (subtype === 'house_shrine') return createJapaneseHouse(s, 'shrine');
    if (subtype === 'lantern_path') return createJapaneseLantern(s, 'path');
    if (subtype === 'lantern_ground') return createJapaneseLantern(s, 'ground');
    if (subtype === 'bridge') return createJapaneseBridge(s);
    if (subtype === 'lake') return createSakuraLake();
    if (subtype === 'pond') return createPondDecor(s);
    if (subtype === 'banner') return createCampBanner(s);
    if (subtype === 'crate' || subtype === 'barrel' || subtype === 'bench' || subtype === 'fence') {
        return createCampProp(s, subtype);
    }
    return createJapaneseLantern(s, 'ground');
}

function tooClose(placed, x, z, minDist) {
    const min2 = minDist * minDist;
    for (let i = 0; i < placed.length; i++) {
        const dx = placed[i].x - x;
        const dz = placed[i].z - z;
        if (dx * dx + dz * dz < min2) return true;
    }
    return false;
}

function pushPlaced(spawnObject, mapData, placed, type, x, z, s, ry, extraMin = 2.4, subtype = null) {
    if (tooClose(placed, x, z, extraMin)) return false;
    if (isNearPath(x, z, 0.4) && (type === 'tree' || type === 'rock' || type === 'ruins' || type === 'cliff' || type === 'landmark' || type === 'sakura' || type === 'bamboo')) {
        return false;
    }
    const info = spawnObject(type, x, z, s, ry, subtype);
    if (!info) return false;
    mapData.push({ type, x, z, s, ry, subtype: info.subtype, color: info.color });
    placed.push({ x, z, type, s });
    return true;
}

function generateWorldDecor(spawnObject, mapData, rng) {
    const placed = [];

    // 1. Landmarks — points d'intérêt reconnaissables
    for (const site of LANDMARK_SITES) {
        const x = site.x + (rng() - 0.5) * 8;
        const z = site.z + (rng() - 0.5) * 8;
        if (!isValidDecoPos(x, z)) continue;
        const s = site.s * (0.92 + rng() * 0.16);
        const ry = rng() * Math.PI * 2;
        const info = spawnObject('landmark', x, z, s, ry, site.subtype);
        if (info) {
            mapData.push({ type: 'landmark', x, z, s, ry, subtype: info.subtype, color: info.color });
            placed.push({ x, z, type: 'landmark', s });
        }
    }

    // 2. Clusters naturels (forêt / ruines / rochers / corruption)
    for (const cluster of DECO_CLUSTERS) {
        for (let i = 0; i < cluster.count; i++) {
            const angle = rng() * Math.PI * 2;
            const r = Math.sqrt(rng()) * cluster.radius;
            const x = cluster.x + Math.cos(angle) * r + (rng() - 0.5) * 3;
            const z = cluster.z + Math.sin(angle) * r + (rng() - 0.5) * 3;
            if (!isValidDecoPos(x, z)) continue;

            let type = 'bush';
            let s = 0.8 + rng();
            let minDist = 2.2;
            const roll = rng();
            if (cluster.kind === 'forest') {
                if (roll < 0.55) { type = 'tree'; s = 1.05 + rng() * 1.15; minDist = 3.4; }
                else if (roll < 0.78) { type = 'bush'; s = 0.75 + rng() * 0.9; minDist = 1.6; }
                else { type = 'rock'; s = 0.7 + rng() * 1.1; minDist = 2.4; }
            } else if (cluster.kind === 'ruins') {
                if (roll < 0.42) { type = 'ruins'; s = 1.7 + rng() * 1.1; minDist = 4.2; }
                else if (roll < 0.68) { type = 'rock'; s = 0.9 + rng() * 1.4; minDist = 2.6; }
                else if (roll < 0.84) { type = 'tree'; s = 0.9 + rng() * 0.7; minDist = 3.0; }
                else { type = 'bush'; s = 0.7 + rng(); minDist = 1.6; }
            } else if (cluster.kind === 'rocky') {
                if (roll < 0.5) { type = 'rock'; s = 1.6 + rng() * 2.4; minDist = 3.6; }
                else if (roll < 0.72) { type = 'cliff'; s = 1.1 + rng() * 1.3; minDist = 5.0; }
                else if (roll < 0.86) { type = 'tree'; s = 0.9 + rng() * 0.8; minDist = 3.2; }
                else { type = 'bush'; s = 0.7 + rng(); minDist = 1.8; }
            } else if (cluster.kind === 'sakura') {
                if (roll < 0.62) { type = 'sakura'; s = 0.85 + rng() * 1.1; minDist = 3.2; }
                else if (roll < 0.82) { type = 'bamboo'; s = 0.9 + rng() * 0.7; minDist = 2.4; }
                else { type = 'bush'; s = 0.7 + rng() * 0.7; minDist = 1.6; }
            } else if (cluster.kind === 'bamboo') {
                if (roll < 0.72) { type = 'bamboo'; s = 1.0 + rng() * 0.7; minDist = 2.2; }
                else if (roll < 0.88) { type = 'sakura'; s = 0.8 + rng() * 0.7; minDist = 3.0; }
                else { type = 'bush'; s = 0.65 + rng() * 0.5; minDist = 1.6; }
            } else {
                if (roll < 0.28) { type = 'ruins'; s = 1.6 + rng(); minDist = 4.0; }
                else if (roll < 0.55) { type = 'rock'; s = 1.1 + rng() * 1.6; minDist = 2.8; }
                else if (roll < 0.78) { type = 'tree'; s = 0.85 + rng() * 0.7; minDist = 3.0; }
                else { type = 'bush'; s = 0.7 + rng(); minDist = 1.6; }
            }

            const ry = rng() * Math.PI * 2;
            pushPlaced(spawnObject, mapData, placed, type, x, z, s, ry, minDist);
        }
    }

    // 3. Bordures denses (cadre naturel de l'île)
    for (let i = 0; i < 42; i++) {
        const angle = rng() * Math.PI * 2;
        const radius = 118 + rng() * 22;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (!isValidDecoPos(x, z)) continue;
        const roll = rng();
        let type = 'tree';
        let s = 1.2 + rng() * 1.1;
        let minDist = 3.2;
        if (roll < 0.28) { type = 'cliff'; s = 1.2 + rng() * 1.4; minDist = 5.5; }
        else if (roll < 0.5) { type = 'rock'; s = 1.4 + rng() * 2.0; minDist = 3.4; }
        else if (roll < 0.72) { type = 'tree'; s = 1.1 + rng() * 1.2; minDist = 3.2; }
        else { type = 'bush'; s = 0.9 + rng(); minDist = 1.8; }
        pushPlaced(spawnObject, mapData, placed, type, x, z, s, rng() * Math.PI * 2, minDist);
    }

    // 4. Remplissage sparse selon densité de zone (évite la grille)
    for (let i = 0; i < 240; i++) {
        const x = (rng() - 0.5) * 250;
        const z = (rng() - 0.5) * 250;
        if (!isValidDecoPos(x, z)) continue;
        const density = getDecoDensityAt(x, z);
        if (rng() > density) continue;

        const zone = getWorldZoneAt(x, z);
        const region = getRegionAt(x, z);
        const roll = rng();
        let type = 'bush';
        let s = 0.8 + rng();
        let minDist = 2.0;

        if (zone === 'arena') {
            if (roll < 0.55) { type = 'bush'; s = 0.65 + rng() * 0.6; minDist = 2.8; }
            else { type = 'rock'; s = 0.55 + rng() * 0.55; minDist = 3.4; }
        } else if (zone === 'forest' || (zone === 'wild' && region === 'temperate')) {
            if (roll < 0.5) { type = 'tree'; s = 0.95 + rng(); minDist = 3.6; }
            else if (roll < 0.82) { type = 'bush'; s = 0.7 + rng() * 0.8; minDist = 1.8; }
            else { type = 'rock'; s = 0.7 + rng(); minDist = 2.6; }
        } else if (zone === 'ruins' || region === 'desert') {
            if (region === 'desert' && roll > 0.4 && zone !== 'ruins') continue;
            if (roll < 0.3) { type = 'ruins'; s = 1.6 + rng(); minDist = 5.0; }
            else if (roll < 0.62) { type = 'rock'; s = 0.9 + rng() * 1.3; minDist = 2.8; }
            else { type = 'bush'; s = 0.7 + rng(); minDist = 1.8; }
        } else if (zone === 'rocky' || region === 'mountain') {
            if (roll < 0.45) { type = 'rock'; s = 1.4 + rng() * 2.2; minDist = 3.6; }
            else if (roll < 0.65) { type = 'cliff'; s = 1.0 + rng() * 1.2; minDist = 5.2; }
            else if (roll < 0.82) { type = 'tree'; s = 0.9 + rng() * 0.8; minDist = 3.2; }
            else { type = 'bush'; s = 0.7 + rng(); minDist = 1.8; }
        } else if (zone === 'sakura_grove') {
            if (roll < 0.5) { type = 'sakura'; s = 0.85 + rng() * 1.05; minDist = 3.4; }
            else if (roll < 0.72) { type = 'bamboo'; s = 0.9 + rng() * 0.65; minDist = 2.4; }
            else if (roll < 0.9) { type = 'bush'; s = 0.65 + rng() * 0.6; minDist = 1.7; }
            else { type = 'rock'; s = 0.55 + rng() * 0.5; minDist = 2.6; }
        } else if (zone === 'corrupted') {
            if (roll < 0.28) { type = 'ruins'; s = 1.5 + rng(); minDist = 4.6; }
            else if (roll < 0.58) { type = 'rock'; s = 1.0 + rng() * 1.4; minDist = 2.8; }
            else { type = 'tree'; s = 0.8 + rng() * 0.7; minDist = 3.0; }
        } else {
            if (region === 'cold' && roll > 0.55) {
                type = 'tree'; s = 1.0 + rng() * 0.9; minDist = 3.4;
            } else if (roll < 0.4) {
                type = 'bush'; s = 0.7 + rng(); minDist = 1.8;
            } else if (roll < 0.7) {
                type = 'tree'; s = 0.95 + rng(); minDist = 3.4;
            } else {
                type = 'rock'; s = 0.8 + rng() * 1.2; minDist = 2.6;
            }
        }

        pushPlaced(spawnObject, mapData, placed, type, x, z, s, rng() * Math.PI * 2, minDist);
    }

    // 5. Lanternes le long des chemins (guidage, pas de collision)
    const lanterns = [
        [54, 48], [40, 28], [18, 8],
        [-10, -10], [-22, -14], [-48, -28],
        [10, 18], [14, 32],
        [-55, -50], [38, 28],
        [32, -26], [42, -32], [58, -46],
    ];
    for (const [lx, lz] of lanterns) {
        const x = lx + (rng() - 0.5) * 2.5;
        const z = lz + (rng() - 0.5) * 2.5;
        if (!isValidDecoPos(x, z, true)) continue;
        if (isInArenaCore(x, z)) continue;
        const s = 0.85 + rng() * 0.25;
        const ry = rng() * Math.PI * 2;
        const info = spawnObject('landmark', x, z, s, ry, 'lantern');
        if (info) {
            mapData.push({ type: 'landmark', x, z, s, ry, subtype: 'lantern' });
            placed.push({ x, z, type: 'landmark', s });
        }
    }

    // 6. Petits buissons sur le pourtour de l'arène (cadre, centre libre)
    for (let i = 0; i < 18; i++) {
        const angle = rng() * Math.PI * 2;
        const r = ARENA.coreRadius + 4 + rng() * 8;
        const x = ARENA.cx + Math.cos(angle) * r;
        const z = ARENA.cz + Math.sin(angle) * r;
        if (!isValidDecoPos(x, z, true)) continue;
        if (isInArenaCore(x, z)) continue;
        pushPlaced(spawnObject, mapData, placed, 'bush', x, z, 0.7 + rng() * 0.6, rng() * Math.PI * 2, 2.2);
    }

    generateSakuraCamp(spawnObject, mapData, placed, rng);
}

function generateSakuraCamp(spawnObject, mapData, placed, rng) {
    const cx = SAKURA_CAMP.cx;
    const cz = SAKURA_CAMP.cz;
    const place = (item) => {
        const x = cx + item.x;
        const z = cz + item.z;
        const info = spawnObject(item.type, x, z, item.s, item.ry, item.subtype);
        if (!info) return;
        mapData.push({ type: item.type, x, z, s: item.s, ry: item.ry, subtype: info.subtype, color: info.color });
        placed.push({ x, z, type: item.type, s: item.s });
    };
    for (const item of SAKURA_CAMP_STRUCTURES) place(item);
    for (const item of SAKURA_CAMP_DECOR) place(item);
    for (const item of SAKURA_GROVE_TREES) {
        const x = cx + item.x;
        const z = cz + item.z;
        if (isInSakuraLake(x, z) || isNearSakuraCrossing(x, z)) continue;
        if (getGroundLevelAt({ x, z }) < -1.0) continue;
        if (tooClose(placed, x, z, 2.4)) continue;
        const ry = item.ry + (rng() - 0.5) * 0.4;
        const info = spawnObject(item.type, x, z, item.s, ry, item.subtype);
        if (!info) continue;
        mapData.push({ type: item.type, x, z, s: item.s, ry, subtype: info.subtype, color: info.color });
        placed.push({ x, z, type: item.type, s: item.s });
    }
}

function finishAtmosphere(worldSeed) {
    const backdrop = createBackdrop(createSeededRng(worldSeed ^ 0xA5A5A5));
    Globals.backdropGroup = backdrop;
    Globals.scene.add(backdrop);

    const details = buildWorldDetails(createSeededRng(worldSeed ^ 0x3C3C3C));
    if (details) {
        Globals.detailLayer = details;
        Globals.scene.add(details);
    }

    const density = STATE.gameOptions?.decoDensity ?? 4;
    const petalBudget = density <= 1 ? 0 : (density === 2 ? 28 : (density === 3 ? 50 : 70));
    if (petalBudget > 0) {
        createSakuraPetals(createSeededRng(worldSeed ^ 0x51A5), petalBudget);
    }
}

function buildWorldDetails(rng) {
    const instances = [];
    const maxDetails = 1100;
    for (let i = 0; i < 1600 && instances.length < maxDetails; i++) {
        const x = (rng() - 0.5) * 190;
        const z = (rng() - 0.5) * 190;
        if (Math.hypot(x - 90, z - 90) < 14) continue;
        if (Math.hypot(x - BOSS_ZONE.cx, z - BOSS_ZONE.cz) < 24) continue;
        const y = getGroundLevelAt({ x, z });
        if (y < -1.15) continue;
        if (isInSakuraLake(x, z) || isOnSakuraBridge(x, z)) continue;

        const zone = getWorldZoneAt(x, z);
        const region = getRegionAt(x, z);
        const onPath = isNearPath(x, z, 1.2);
        const roll = rng();
        let type = 'grass';
        let color;
        let s = 0.7 + rng() * 0.7;

        if (onPath) {
            type = roll < 0.7 ? 'pebble' : 'branch';
            s = 0.6 + rng() * 0.5;
            color = 0x8D6E63;
        } else if (zone === 'sakura_grove') {
            if (roll < 0.4) {
                type = 'grass';
                color = 0xB8E6A3;
            } else if (roll < 0.78) {
                type = 'flower';
                color = roll < 0.6 ? 0xFFB7D5 : 0xFFD6E5;
                s = 0.7 + rng() * 0.55;
            } else {
                type = 'pebble';
                color = 0xC8B89A;
            }
        } else if (zone === 'corrupted') {
            type = roll < 0.45 ? 'crystal_shard' : (roll < 0.75 ? 'bone' : 'pebble');
            color = type === 'crystal_shard' ? 0xB388FF : undefined;
            s = 0.7 + rng() * 0.6;
        } else if (zone === 'ruins' || region === 'desert') {
            type = roll < 0.4 ? 'bone' : (roll < 0.75 ? 'pebble' : 'branch');
            s = 0.65 + rng() * 0.5;
        } else if (zone === 'rocky' || region === 'mountain') {
            type = roll < 0.7 ? 'pebble' : 'branch';
            s = 0.6 + rng() * 0.55;
        } else if (y < -0.4) {
            type = 'reed';
            s = 0.8 + rng() * 0.6;
        } else if (zone === 'forest') {
            if (roll < 0.45) type = 'grass';
            else if (roll < 0.65) type = 'flower';
            else if (roll < 0.8) type = 'mushroom';
            else if (roll < 0.92) type = 'branch';
            else type = 'pebble';
        } else if (region === 'cold') {
            type = roll < 0.55 ? 'pebble' : 'grass';
            color = type === 'grass' ? 0xB2EBF2 : 0xCFD8DC;
        } else {
            if (roll < 0.5) type = 'grass';
            else if (roll < 0.68) type = 'flower';
            else if (roll < 0.84) type = 'pebble';
            else type = 'mushroom';
        }

        if (zone === 'arena' && !onPath && rng() > 0.45) continue;

        instances.push({
            type,
            x,
            y,
            z,
            s,
            ry: rng() * Math.PI * 2,
            color,
        });
    }
    return buildDetailLayer(instances);
}

// --- LOGIQUE D'OCCLUSION ---
// Throttlée à 10 Hz : le raycast récursif sur toutes les décorations est coûteux à 60+ FPS.
// Le matériau de fondu est cloné UNE fois par mesh puis réutilisé (avant : un clone par frame, jamais disposé).
const raycaster = new THREE.Raycaster();
const occlusionDir = new THREE.Vector3();
let lastOcclusionCheck = 0;

export function updateOcclusion(camera, player) {
    if (!player || !Globals.decoGroup) return;

    const now = performance.now();
    if (now - lastOcclusionCheck < 100) return;
    lastOcclusionCheck = now;

    occlusionDir.subVectors(player.position, camera.position);
    const distance = occlusionDir.length();
    occlusionDir.normalize();

    raycaster.set(camera.position, occlusionDir);
    raycaster.far = distance - 2;

    // Filter to only check objects within a relevant radius of the player (e.g. 40 units)
    // to avoid recursive raycasting over all distant decorations in the world.
    const playerPos = player.position;
    const nearbyDecos = [];
    const children = Globals.decoGroup.children;
    const len = children.length;
    for (let i = 0; i < len; i++) {
        const child = children[i];
        if (child.userData.isDetailLayer || child.userData.isBackdrop) continue;
        if (child.position.distanceToSquared(playerPos) < 1600) { // 40 * 40 = 1600
            nearbyDecos.push(child);
        }
    }

    const intersects = raycaster.intersectObjects(nearbyDecos, true);

    const hitSet = new Set();
    for (const hit of intersects) {
        let target = hit.object;
        while (target.parent && target.parent !== Globals.decoGroup) target = target.parent;
        hitSet.add(target);
    }

    // Restaure les objets qui ne bloquent plus la vue
    for (let i = fadedObjects.length - 1; i >= 0; i--) {
        const obj = fadedObjects[i];
        if (hitSet.has(obj)) continue;
        obj.traverse(child => {
            if (child.isMesh && child.userData.origMaterial) {
                child.material = child.userData.origMaterial;
            }
        });
        fadedObjects.splice(i, 1);
    }

    // Applique le fondu aux nouveaux objets bloquants
    for (const target of hitSet) {
        if (fadedObjects.includes(target)) continue;
        fadedObjects.push(target);
        target.traverse(child => {
            if (child.isMesh && child.material) {
                if (!child.userData.origMaterial) child.userData.origMaterial = child.material;
                if (!child.userData.fadeMaterial) {
                    const fadeMat = child.userData.origMaterial.clone();
                    fadeMat.opacity = 0.25;
                    fadeMat.transparent = true;
                    child.userData.fadeMaterial = fadeMat;
                }
                child.material = child.userData.fadeMaterial;
            }
        });
    }
}

export function updateEnvironmentAnimations(dt) {
    const time = Date.now() * 0.001;
    for (const obj of animatedObjects) {
        if (obj.visible && obj.animate) obj.animate(time);
    }
}

export function updateBackdropParallax(camera) {
    const group = Globals.backdropGroup;
    if (!group || !camera) return;
    group.position.x = camera.position.x * 0.05;
    group.position.z = camera.position.z * 0.05;
}

export { updateSakuraPetals };