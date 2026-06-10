// @ts-nocheck
import { CONFIG } from './config';
import { Globals } from './globals';
import { TextureManager } from './ressources';

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

    // Sol
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({
        map: TextureManager.textures['grass'],
        color: 0xffffff,
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    Globals.scene.add(ground);

    // Exposition globale pour debug si besoin
    window.Globals = Globals;
}