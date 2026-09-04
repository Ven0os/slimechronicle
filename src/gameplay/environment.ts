// @ts-nocheck
import { Globals, addEnemy } from '../core/globals';
import { STATE } from '../core/config';
import { RoyalSeal } from './environment/royal_seal';

import { createTreeModel } from './environment/treeModel';
import { createRockModel } from './environment/rockModel';
import { createBushModel } from './environment/bushModel';
import { createRuinsModel } from './environment/ruinsModel';
import { createCliffModel } from './environment/cliffModel';

import * as THREE from 'three';
import { BOSS_ZONE, getRegionAt, getGroundLevelAt } from './world/worldZones';

const animatedObjects = []; 

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
        radius: radius
    });
}

export function createBoundaries() {
    // 1. Murs Invisibles (Sécurité ultime)
    const wallHeight = 20; 
    const wallGeo = new THREE.BoxGeometry(200, wallHeight, 2);
    const wallMat = new THREE.MeshBasicMaterial({ visible: false }); 
    
    const w1 = new THREE.Mesh(wallGeo, wallMat); w1.position.set(0, wallHeight/2, -100); Globals.scene.add(w1);
    const w2 = new THREE.Mesh(wallGeo, wallMat); w2.position.set(0, wallHeight/2, 100); Globals.scene.add(w2);
    const w3 = new THREE.Mesh(wallGeo, wallMat); w3.rotation.y = Math.PI/2; w3.position.set(100, wallHeight/2, 0); Globals.scene.add(w3);
    const w4 = new THREE.Mesh(wallGeo, wallMat); w4.rotation.y = Math.PI/2; w4.position.set(-100, wallHeight/2, 0); Globals.scene.add(w4);

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
        Globals.decoGroup = null;
    }
    if(Globals.obstacles) {
        Globals.obstacles = Globals.obstacles.filter(o => o.radius >= 2.5 || o.isPersistent); // Garde les autels importants et les roches persistantes du spawn
    }
    animatedObjects.length = 0;
}

export function createDecorations(importedData = null) {
    if (Globals.decoGroup && importedData) {
        clearDecorations();
    }

    const decoGroup = new THREE.Group();
    Globals.decoGroup = decoGroup; 
    Globals.scene.add(decoGroup);

    if (!Globals.obstacles) Globals.obstacles = [];
    
    const isHost = !importedData;
    const mapData = [];

    if (isHost) {
        const seasonKeys = Object.keys(SEASONS);
        const randomKey = seasonKeys[Math.floor(Math.random() * seasonKeys.length)];
        currentSeasonPalette = SEASONS[randomKey];
        console.log(`🍂 SAISON GÉNÉRÉE : ${currentSeasonPalette.name}`);
    }

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
            if (!foliageCol) {
                if (region === 'cold') {
                    foliageCol = Math.random() > 0.3 ? 0xffffff : 0xd6fafc; // Snowy white or icy blue
                } else if (region === 'mountain') {
                    foliageCol = 0x243242; // Dark slate grey-blue
                } else if (region === 'desert') {
                    foliageCol = 0x5D4037; // Dead dry branches
                } else { // temperate
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
            
            // Collision Rocher
            addCompositeObstacle(x, z, ry, 0, 0, 0.7 * s);
            
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

        if (object3D) {
            decoGroup.add(object3D);
            if (typeof object3D.animate === 'function') {
                animatedObjects.push(object3D);
            }
            return { subtype, color }; 
        }
        return null;
    };

    if (isHost) {
        // --- GÉNÉRATION PROCÉDURALE ---
        const isValidDecoPos = (x, z) => {
            // Éviter la zone de spawn (rayon 25 autour de (90, 90))
            const distToSpawn = Math.hypot(x - 90, z - 90);
            if (distToSpawn < 25) return false;
            
            // Éviter la zone du boss (rayon 32 autour de BOSS_ZONE)
            const distToBoss = Math.hypot(x - BOSS_ZONE.cx, z - BOSS_ZONE.cz);
            if (distToBoss < 32) return false;
            
            // Éviter la mer (Y < -1.0)
            const gl = getGroundLevelAt({ x, z });
            if (gl < -1.0) return false;
            
            return true;
        };
        
        // 1. Ruines
        for(let i=0; i<15; i++) {
            const x = (Math.random() - 0.5) * 160;
            const z = (Math.random() - 0.5) * 160;
            if (!isValidDecoPos(x, z)) continue;
            if (x*x + z*z < 900) continue; 
            const type = 'ruins'; 
            const s = 2 + Math.random();
            const ry = Math.random() * Math.PI * 2;
            const info = spawnObject(type, x, z, s, ry);
            if (info) mapData.push({ type, x, z, s, ry, subtype: info.subtype });
        }

        // 2. Arbres
        for(let i=0; i<60; i++) {
            const x = (Math.random() - 0.5) * 180;
            const z = (Math.random() - 0.5) * 180;
            if (!isValidDecoPos(x, z)) continue;
            if (x*x + z*z < 600) continue; 

            // Moins d'arbres dans le désert
            const region = getRegionAt(x, z);
            if (region === 'desert' && Math.random() > 0.35) continue;

            const s = 1.0 + Math.random() * 1.0; 
            const ry = Math.random() * Math.PI * 2;
            const info = spawnObject('tree', x, z, s, ry);
            if (info) mapData.push({ type: 'tree', x, z, s, ry, subtype: info.subtype, color: info.color });
        }

        // 3. Rochers
        for(let i=0; i<20; i++) {
            const x = (Math.random() - 0.5) * 170;
            const z = (Math.random() - 0.5) * 170;
            if (!isValidDecoPos(x, z)) continue;
            if (x*x + z*z < 400) continue;

            const region = getRegionAt(x, z);
            // Rochers beaucoup plus grands dans la région montagneuse
            let s = 1 + Math.random() * 2; 
            if (region === 'mountain') {
                s = 2.5 + Math.random() * 3.5;
            }

            const ry = Math.random() * Math.PI;
            const info = spawnObject('rock', x, z, s, ry);
            if (info) mapData.push({ type: 'rock', x, z, s, ry, color: info.color });
        }

        // 4. Buissons
        for(let i=0; i<80; i++) {
            const x = (Math.random() - 0.5) * 180;
            const z = (Math.random() - 0.5) * 180;
            if (!isValidDecoPos(x, z)) continue;
            if (x*x + z*z < 300) continue;

            // Moins de buissons dans le désert et la zone froide
            const region = getRegionAt(x, z);
            if ((region === 'desert' || region === 'cold') && Math.random() > 0.4) continue;

            const s = 0.8 + Math.random();
            const ry = Math.random() * Math.PI * 2;
            const info = spawnObject('bush', x, z, s, ry);
            if (info) mapData.push({ type: 'bush', x, z, s, ry, color: info.color });
        }
        Globals.mapData = mapData;
    } else {
        importedData.forEach(d => {
            spawnObject(d.type, d.x, d.z, d.s, d.ry, d.subtype, d.color);
        });
    }
}

// --- LOGIQUE D'OCCLUSION ---
// Throttlée à 10 Hz : le raycast récursif sur toutes les décorations est coûteux à 60+ FPS.
// Le matériau de fondu est cloné UNE fois par mesh puis réutilisé (avant : un clone par frame, jamais disposé).
const raycaster = new THREE.Raycaster();
const fadedObjects = [];
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
        if (obj.animate) obj.animate(time);
    }
}