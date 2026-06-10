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

    // 2. FALAISE VISUELLE
    const cliffColor = currentSeasonPalette.cliff;

    const placeCliff = (x, z, rotationY) => {
        // Taille massive
        const s = 6 + Math.random() * 2;
        const cliff = createCliffModel(s, cliffColor);
        
        // Positionnement visuel
        cliff.position.set(x, s * 0.5, z);
        cliff.rotation.y = rotationY + (Math.random() - 0.5) * 0.5;
        cliff.rotation.z = (Math.random() - 0.5) * 0.2;

        Globals.scene.add(cliff);
        
        // --- COLLISION COMPOSITE (MUR) ---
        // Le modèle cliff est large (Scale X ~ 2.5 * s).
        // Au lieu d'un gros rond au milieu qui bloque trop loin ou laisse passer les bords,
        // on place 3 cercles alignés pour faire un "mur".
        
        const width = s * 2.5; // Largeur approximative du modèle
        const r = s * 0.6;     // Rayon de chaque sous-obstacle

        // Cercle Central
        addCompositeObstacle(x, z, cliff.rotation.y, 0, 0, r);
        // Cercle Gauche
        addCompositeObstacle(x, z, cliff.rotation.y, -width * 0.3, 0, r);
        // Cercle Droit
        addCompositeObstacle(x, z, cliff.rotation.y, width * 0.3, 0, r);
    };

    const range = 100;
    const step = 12; // Assez serré pour que les modèles se chevauchent visuellement

    // Placement sur les 4 côtés
    for (let x = -range; x <= range; x += step) placeCliff(x, -range, 0); 
    for (let x = -range; x <= range; x += step) placeCliff(x, range, Math.PI); 
    for (let z = -range; z <= range; z += step) placeCliff(-range, z, -Math.PI/2); 
    for (let z = -range; z <= range; z += step) placeCliff(range, z, Math.PI/2); 

    // Coins Hermétiques
    placeCliff(-range, -range, -Math.PI/4);
    placeCliff(range, -range, Math.PI/4);
    placeCliff(-range, range, -Math.PI*0.75);
    placeCliff(range, range, Math.PI*0.75);
}

export function createAltars() {
    const sealPosition = new THREE.Vector3(0, 0, -15);
    const seal = new RoyalSeal(sealPosition);
    addEnemy(seal);
}

export function updateMenhirVisuals() {
    const hud = document.getElementById('menhir-hud');
    if(hud) hud.style.display = 'none';
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
        Globals.obstacles = Globals.obstacles.filter(o => o.radius >= 2.5); // Garde les autels importants
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
        
        // --- LOGIQUE SPAWN & COLLISION SPÉCIFIQUE ---

        if (type === 'tree') {
            const treeType = subtype || (Math.random() > 0.7 ? (Math.random() > 0.5 ? 'oak' : 'dead') : 'pine');
            const foliageCol = color || currentSeasonPalette.leaves[Math.floor(Math.random() * currentSeasonPalette.leaves.length)];
            
            object3D = createTreeModel(s, treeType, foliageCol);
            object3D.position.set(x, 0, z);
            object3D.rotation.y = ry;
            
            // Collision tronc simple
            addCompositeObstacle(x, z, ry, 0, 0, 0.5 * s); // Rayon réduit pour coller au tronc
            
            if(!subtype) subtype = treeType; 
            if(!color) color = foliageCol; 
        } 
        else if (type === 'rock') {
            const rockCol = color || currentSeasonPalette.rock[Math.floor(Math.random() * currentSeasonPalette.rock.length)];
            object3D = createRockModel(s, rockCol);
            object3D.position.set(x, s * 0.2, z);
            object3D.rotation.set(ry, ry, ry);
            
            // Collision Rocher
            addCompositeObstacle(x, z, ry, 0, 0, 0.7 * s);
            
            if(!color) color = rockCol;
        }
        else if (type === 'bush') {
            const bushCol = color || currentSeasonPalette.leaves[Math.floor(Math.random() * currentSeasonPalette.leaves.length)];
            object3D = createBushModel(s, bushCol);
            object3D.position.set(x, 0, z);
            object3D.rotation.y = ry;
            // PAS DE COLLISION POUR LES BUISSONS (On marche dedans)
            
            if(!color) color = bushCol;
        }
        else if (type === 'ruins') {
            const ruinsType = subtype || (Math.random() > 0.5 ? 'arch' : 'pillar');
            object3D = createRuinsModel(s, ruinsType);
            object3D.position.set(x, 0, z);
            object3D.rotation.y = ry;
            
            // COLLISION COMPLEXE POUR LES RUINES
            if (ruinsType === 'arch') {
                // L'arche a deux piliers espacés
                // P1 env à -1*s, P2 env à +1*s
                addCompositeObstacle(x, z, ry, -1.0 * s, 0, 0.6 * s);
                addCompositeObstacle(x, z, ry,  1.0 * s, 0, 0.6 * s);
                // Le centre est libre !
            } else {
                // Pilier simple
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
        
        // 1. Ruines
        for(let i=0; i<15; i++) {
            const x = (Math.random() - 0.5) * 160;
            const z = (Math.random() - 0.5) * 160;
            if(x*x + z*z < 900) continue; 
            const type = 'ruins'; 
            const s = 2 + Math.random();
            const ry = Math.random() * Math.PI * 2;
            const info = spawnObject(type, x, z, s, ry);
            mapData.push({ type, x, z, s, ry, subtype: info.subtype });
        }

        // 2. Arbres
        for(let i=0; i<60; i++) {
            const x = (Math.random() - 0.5) * 180;
            const z = (Math.random() - 0.5) * 180;
            if(x*x + z*z < 600) continue; 
            const s = 1.0 + Math.random() * 1.0; 
            const ry = Math.random() * Math.PI * 2;
            const info = spawnObject('tree', x, z, s, ry);
            mapData.push({ type: 'tree', x, z, s, ry, subtype: info.subtype, color: info.color });
        }

        // 3. Rochers
        for(let i=0; i<20; i++) {
            const x = (Math.random() - 0.5) * 170;
            const z = (Math.random() - 0.5) * 170;
            if(x*x + z*z < 400) continue;
            const s = 1 + Math.random() * 2; 
            const ry = Math.random() * Math.PI;
            const info = spawnObject('rock', x, z, s, ry);
            mapData.push({ type: 'rock', x, z, s, ry, color: info.color });
        }

        // 4. Buissons
        for(let i=0; i<80; i++) {
            const x = (Math.random() - 0.5) * 180;
            const z = (Math.random() - 0.5) * 180;
            if(x*x + z*z < 300) continue;
            const s = 0.8 + Math.random();
            const ry = Math.random() * Math.PI * 2;
            const info = spawnObject('bush', x, z, s, ry);
            mapData.push({ type: 'bush', x, z, s, ry, color: info.color });
        }
        Globals.mapData = mapData;
    } else {
        importedData.forEach(d => {
            spawnObject(d.type, d.x, d.z, d.s, d.ry, d.subtype, d.color);
        });
    }
}

// --- LOGIQUE D'OCCLUSION ---
const raycaster = new THREE.Raycaster();
const fadedObjects = []; 

export function updateOcclusion(camera, player) {
    // Restauration
    for (const obj of fadedObjects) {
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                const orig = child.material.userData.origOpacity !== undefined ? child.material.userData.origOpacity : 1.0;
                child.material.opacity = orig;
                child.material.needsUpdate = true;
            }
        });
    }
    fadedObjects.length = 0; 

    if (!player || !Globals.decoGroup) return;

    const direction = new THREE.Vector3().subVectors(player.position, camera.position);
    const distance = direction.length();
    direction.normalize();

    raycaster.set(camera.position, direction);
    raycaster.far = distance - 2; 

    const intersects = raycaster.intersectObjects(Globals.decoGroup.children, true);

    for (const hit of intersects) {
        let target = hit.object;
        while (target.parent && target.parent !== Globals.decoGroup) target = target.parent;

        if (!fadedObjects.includes(target)) {
            fadedObjects.push(target);
            target.traverse(child => {
                if (child.isMesh && child.material) {
                    if (child.material.userData.origOpacity === undefined) {
                        child.material.userData.origOpacity = child.material.opacity;
                    }
                    child.material.opacity = 0.25; 
                    child.material.transparent = true; 
                    child.material.needsUpdate = true;
                }
            });
        }
    }
}

export function updateEnvironmentAnimations(dt) {
    const time = Date.now() * 0.001; 
    for (const obj of animatedObjects) {
        if (obj.animate) obj.animate(time);
    }
}