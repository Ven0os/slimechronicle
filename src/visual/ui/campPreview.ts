// @ts-nocheck
import * as THREE from 'three';
import {
    spawnRogueTent,
    spawnArcanePortal,
    spawnSpikedBarricade,
    spawnCorruptedObelisk,
    spawnTreasureOutpost,
    spawnShamanRitualCircle,
    spawnCursedCrypt,
    spawnDruidShrine,
    spawnVolcanicForge,
    spawnFrozenSpire,
    spawnAncientRuins
} from '../../gameplay/logic';

let renderer = null;
let scene = null;
let camera = null;
let animationFrameId = null;
let currentPreviewGroup = null;
let containerElement = null;
let activeCampType = 'tent'; // Default

export const CampPreview = {
    init: function() {
        // Prevent double init
        this.dispose();

        containerElement = document.getElementById('camp-preview-canvas-container');
        if (!containerElement) return;

        const width = containerElement.clientWidth || 300;
        const height = containerElement.clientHeight || 300;

        // 1. Create Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0e0a07);
        scene.fog = new THREE.FogExp2(0x0e0a07, 0.04);

        // 2. Create Camera
        camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        camera.position.set(0, 3.2, 7.0);
        camera.lookAt(0, 0.8, 0);

        // 3. Create Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Clear container and append canvas
        containerElement.innerHTML = '';
        containerElement.appendChild(renderer.domElement);

        // 4. Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
        dirLight.position.set(5, 8, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 512;
        dirLight.shadow.mapSize.height = 512;
        scene.add(dirLight);

        // Warm spot light from above
        const spotLight = new THREE.SpotLight(0xffaa44, 2.0, 15, Math.PI / 4, 0.5, 1);
        spotLight.position.set(0, 6, 0);
        scene.add(spotLight);

        // 5. Spawn ground plane for preview context
        const groundGeo = new THREE.PlaneGeometry(15, 15);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x1d140f,
            roughness: 0.95
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // 6. Spawn current active camp preview
        this.loadCampMesh(activeCampType);

        // 7. Start Loop
        this.animate();

        // 8. Setup Resize Observer
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(containerElement);

        // Highlight selected camp card in UI
        this.updateCardSelectionUI();
    },

    loadCampMesh: function(type) {
        // Clean previous
        if (currentPreviewGroup) {
            scene.remove(currentPreviewGroup);
            this.disposeObject(currentPreviewGroup);
            currentPreviewGroup = null;
        }

        // Spawn camp in preview mode (isPreview = true)
        const origin = new THREE.Vector3(0, 0, 0);
        let spawned = null;

        if (type === 'tent') {
            spawned = spawnRogueTent(origin, true);
        } else if (type === 'portal') {
            spawned = spawnArcanePortal(origin, true);
        } else if (type === 'barricade') {
            spawned = spawnSpikedBarricade(origin, true);
        } else if (type === 'obelisk') {
            spawned = spawnCorruptedObelisk(origin, true);
        } else if (type === 'treasure') {
            spawned = spawnTreasureOutpost(origin, true);
        } else if (type === 'ritual') {
            spawned = spawnShamanRitualCircle(origin, true);
        } else if (type === 'crypt') {
            spawned = spawnCursedCrypt(origin, true);
        } else if (type === 'shrine') {
            spawned = spawnDruidShrine(origin, true);
        } else if (type === 'forge') {
            spawned = spawnVolcanicForge(origin, true);
        } else if (type === 'frozen') {
            spawned = spawnFrozenSpire(origin, true);
        } else if (type === 'ruins') {
            spawned = spawnAncientRuins(origin, true);
        }

        if (spawned && spawned.group) {
            currentPreviewGroup = spawned.group;
            scene.add(currentPreviewGroup);
            // Center camera target a bit higher depending on camp height
            const heightOffset = type === 'frozen' ? 1.1 : (type === 'obelisk' ? 1.3 : (type === 'portal' || type === 'shrine' || type === 'ruins' ? 0.8 : 0.6));
            camera.lookAt(0, heightOffset, 0);
        }
    },

    selectCamp: function(type) {
        if (activeCampType === type && currentPreviewGroup) return; // Already selected
        activeCampType = type;
        
        this.loadCampMesh(type);
        this.updateCardSelectionUI();

        // Update footer title
        const titles = {
            tent: "Camp de Voleurs",
            portal: "Portail Arcane",
            barricade: "Barricade à Pointes",
            obelisk: "Obélisque Corrompu",
            treasure: "Avant-poste au Trésor",
            ritual: "Rituel Shamanique",
            crypt: "Crypte Maudite",
            shrine: "Sanctuaire Druidique",
            forge: "Fissure Volcanique",
            frozen: "Cristal Gelé",
            ruins: "Ruines du Colosse"
        };
        const footerTitle = document.getElementById('camp-preview-title');
        if (footerTitle) {
            footerTitle.innerText = titles[type] || type;
        }
    },

    updateCardSelectionUI: function() {
        // Remove selected class from all cards
        document.querySelectorAll('.camp-card').forEach(card => {
            card.classList.remove('selected');
        });
        // Add selected to current card
        const currentCard = document.getElementById('camp-card-' + activeCampType);
        if (currentCard) {
            currentCard.classList.add('selected');
        }
    },

    updateCampStatus: function(type) {
        const checkbox = document.getElementById(`opt-camp-${type}-enabled`);
        const card = document.getElementById(`camp-card-${type}`);
        if (checkbox && card) {
            if (checkbox.checked) {
                card.style.opacity = '1.0';
            } else {
                card.style.opacity = '0.55';
            }
        }
    },

    animate: function() {
        if (!renderer || !scene || !camera) return;

        animationFrameId = requestAnimationFrame(() => this.animate());

        // Rotate camera slowly around target to showcase 3D model
        const time = Date.now() * 0.0003;
        const radius = 6.8;
        camera.position.x = Math.sin(time) * radius;
        camera.position.z = Math.cos(time) * radius;
        camera.position.y = 2.4 + Math.sin(time * 0.5) * 0.4;
        
        const typeOffset = activeCampType === 'frozen' ? 1.0 : (activeCampType === 'obelisk' ? 1.2 : (activeCampType === 'portal' || activeCampType === 'shrine' || activeCampType === 'ruins' ? 0.7 : 0.4));
        camera.lookAt(0, typeOffset, 0);

        renderer.render(scene, camera);
    },

    resize: function() {
        if (!containerElement || !renderer || !camera) return;
        const width = containerElement.clientWidth;
        const height = containerElement.clientHeight;
        if (width === 0 || height === 0) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    },

    dispose: function() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (scene) {
            // Remove and dispose preview group
            if (currentPreviewGroup) {
                scene.remove(currentPreviewGroup);
                this.disposeObject(currentPreviewGroup);
                currentPreviewGroup = null;
            }
            scene = null;
        }

        camera = null;

        if (renderer) {
            if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            renderer.dispose();
            renderer = null;
        }
    },

    disposeObject: function(obj) {
        obj.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }
};

// Bind to window for HTML clicks
if (typeof window !== 'undefined') {
    window.CampPreview = CampPreview;
}
