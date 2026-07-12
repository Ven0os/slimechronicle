// @ts-nocheck
import { CONFIG } from './config';
import { Globals } from './globals';
import { getRegionColorAt, getGroundLevelAt, BOSS_ZONE } from '../gameplay/world/worldZones';

export function initScene() {
    Globals.scene = new THREE.Scene();
    Globals.scene.background = new THREE.Color(CONFIG.colors.skyNormal);
    Globals.scene.fog = new THREE.FogExp2(0xffffff, 0.005);

    Globals.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    Globals.renderer = new THREE.WebGLRenderer({ antialias: true });
    Globals.renderer.setSize(window.innerWidth, window.innerHeight);

    Globals.renderer.shadowMap.enabled = false;

    const container = document.getElementById('game-container');
    if (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(Globals.renderer.domElement);

    // Lumières
    Globals.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    Globals.hemiLight.position.set(0, 20, 0);
    Globals.scene.add(Globals.hemiLight);

    Globals.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    Globals.dirLight.position.set(50, 100, 50);
    Globals.dirLight.castShadow = false;
    Globals.scene.add(Globals.dirLight);

    // Sol avec régions (couleurs et reliefs)
    const groundGeo = new THREE.PlaneGeometry(300, 300, 100, 100);
    const posAttr = groundGeo.attributes.position;
    const colors = [];

    for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i);
        
        // Relief de l'île (hauteur physique calculée en X, Z = -Y local)
        let height = getGroundLevelAt({ x: vx, z: -vy });
        
        // Emplacement du spawn platform : on le garde plat à y=0 car createThemedWorldMap dessine le mesh Cylinder
        const distToSpawnCenter = Math.hypot(vx - 90, -vy - 90);
        if (distToSpawnCenter < 12.5) {
            height = 0.0;
        }

        // Emplacement du boss platform : on le garde plat à y=0 car worldMap dessine le mesh Cylinder
        const distToBossCenter = Math.hypot(vx - BOSS_ZONE.cx, -vy - BOSS_ZONE.cz);
        if (distToBossCenter < BOSS_ZONE.radius + 1.0) {
            height = 0.0;
        }
        
        posAttr.setZ(i, height);

        // Couleur de la région
        const color = getRegionColorAt(vx, -vy);
        colors.push(color.r, color.g, color.b);
    }

    posAttr.needsUpdate = true;
    groundGeo.computeVertexNormals();
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const groundMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    Globals.scene.add(ground);

    // Mer / Océan
    const waterGeo = new THREE.PlaneGeometry(600, 600);
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x0f5e9c, // Bleu marin profond et éclatant
        roughness: 0.1,
        metalness: 0.8,
        transparent: true,
        opacity: 0.85
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.8;
    Globals.scene.add(water);
    Globals.water = water; // Stocké pour l'animation

    // Exposition globale pour debug si besoin
    window.Globals = Globals;
}