// @ts-nocheck
import { CONFIG } from './config';
import { Globals } from './globals';
import { getRegionColorAt, getGroundLevelAt, BOSS_ZONE } from '../gameplay/world/worldZones';
import { initAtmosphere, snapAtmosphere } from '../visual/atmosphere';

/** Demi-largeur, en unités monde, de la zone couverte par la carte d'ombres. */
const SHADOW_HALF_EXTENT = 45;
/** Direction (normalisée) depuis laquelle le soleil éclaire la scène. */
const SUN_DIR = new THREE.Vector3(50, 100, 50).normalize();
const SUN_DISTANCE = 120;

/**
 * Recentre le soleil sur le joueur pour garder une carte d'ombres nette sur une carte
 * de 300 unités. La cible est alignée sur la grille des texels : sans cela, les ombres
 * grouillent visiblement dès que la caméra se déplace.
 */
export function updateSunShadow(focusX: number, focusZ: number) {
    const light = Globals.dirLight;
    if (!light || !light.castShadow) return;

    const texelSize = (SHADOW_HALF_EXTENT * 2) / light.shadow.mapSize.x;
    const snappedX = Math.round(focusX / texelSize) * texelSize;
    const snappedZ = Math.round(focusZ / texelSize) * texelSize;

    light.target.position.set(snappedX, 0, snappedZ);
    light.target.updateMatrixWorld();
    light.position.set(
        snappedX + SUN_DIR.x * SUN_DISTANCE,
        SUN_DIR.y * SUN_DISTANCE,
        snappedZ + SUN_DIR.z * SUN_DISTANCE
    );
}

/**
 * Applique le niveau d'ombres choisi dans les options.
 * 1 = aucune, 2 = carte réduite (machines modestes), 3 = carte pleine résolution.
 */
export function applyShadowQuality(level: number) {
    const renderer = Globals.renderer;
    const light = Globals.dirLight;
    if (!renderer || !light) return;

    const enabled = level >= 2;
    renderer.shadowMap.enabled = enabled;
    light.castShadow = enabled;

    const size = level >= 3 ? 2048 : 1024;
    if (light.shadow.mapSize.x !== size) {
        light.shadow.mapSize.set(size, size);
        // La carte déjà allouée garde son ancienne taille : il faut la libérer pour que
        // Three.js en recrée une à la nouvelle résolution.
        if (light.shadow.map) {
            light.shadow.map.dispose();
            light.shadow.map = null;
        }
    }

    if (Globals.ground) Globals.ground.receiveShadow = enabled;
    renderer.shadowMap.needsUpdate = true;
}

export function initScene() {
    Globals.scene = new THREE.Scene();
    Globals.scene.background = new THREE.Color(CONFIG.colors.skyNormal);
    Globals.scene.fog = new THREE.FogExp2(0xffffff, 0.005);

    Globals.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    Globals.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    Globals.renderer.setSize(window.innerWidth, window.innerHeight);

    // L'échelle de résolution n'était appliquée qu'au redimensionnement : au lancement le
    // rendu restait en ratio 1, donc flou sur les écrans à forte densité de pixels.
    const initialResScale = ((window.STATE?.gameOptions?.resolutionScale) || 100) / 100;
    Globals.renderer.setPixelRatio(window.devicePixelRatio * initialResScale);

    // Tone mapping « Neutral » (Khronos PBR Neutral) plutôt qu'ACES : il maîtrise les hautes
    // lumières des matériaux émissifs sans délaver les couleurs vives du jeu.
    Globals.renderer.toneMapping = THREE.NeutralToneMapping;
    Globals.renderer.toneMappingExposure = 1.15;

    Globals.renderer.shadowMap.enabled = true;
    Globals.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = document.getElementById('game-container');
    if (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(Globals.renderer.domElement);

    // Lumières
    Globals.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    Globals.hemiLight.position.set(0, 20, 0);
    Globals.scene.add(Globals.hemiLight);

    Globals.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    Globals.dirLight.position.set(50, 100, 50);
    Globals.dirLight.castShadow = true;
    // La carte fait 300 unités de côté : couvrir le tout donnerait des ombres en escalier.
    // Le frustum reste donc serré autour du joueur et suit la caméra (voir updateSunShadow).
    Globals.dirLight.shadow.mapSize.set(2048, 2048);
    Globals.dirLight.shadow.camera.near = 1;
    Globals.dirLight.shadow.camera.far = 260;
    Globals.dirLight.shadow.camera.left = -SHADOW_HALF_EXTENT;
    Globals.dirLight.shadow.camera.right = SHADOW_HALF_EXTENT;
    Globals.dirLight.shadow.camera.top = SHADOW_HALF_EXTENT;
    Globals.dirLight.shadow.camera.bottom = -SHADOW_HALF_EXTENT;
    Globals.dirLight.shadow.bias = -0.0006;
    Globals.dirLight.shadow.normalBias = 0.02;
    Globals.scene.add(Globals.dirLight);
    Globals.scene.add(Globals.dirLight.target);

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
    ground.receiveShadow = true;
    Globals.ground = ground;
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

    // Gestion du redimensionnement de la fenêtre
    window.addEventListener('resize', () => {
        if (!Globals.camera || !Globals.renderer) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        Globals.camera.aspect = width / height;
        Globals.camera.updateProjectionMatrix();
        const resScale = ((window.STATE?.gameOptions?.resolutionScale) || 100) / 100;
        Globals.renderer.setPixelRatio(window.devicePixelRatio * resScale);
        Globals.renderer.setSize(width, height);
    });

    // Dôme céleste dégradé et brume liée aux biomes (remplace le fond de couleur unie).
    initAtmosphere();
    snapAtmosphere();

    // Exposition globale pour debug si besoin
    window.Globals = Globals;
}