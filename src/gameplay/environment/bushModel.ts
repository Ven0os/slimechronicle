// @ts-nocheck
import * as THREE from 'three';

// Cache des géométries et des matériels
const geometryCache = {};
const materialCache = {};

function getGeometry(key, creator) {
    if (!geometryCache[key]) {
        geometryCache[key] = creator();
    }
    return geometryCache[key];
}

function getMaterial(color, isBasic = false) {
    const key = `${color}_${isBasic}`;
    if (!materialCache[key]) {
        materialCache[key] = isBasic 
            ? new THREE.MeshBasicMaterial({ color: color })
            : new THREE.MeshStandardMaterial({
                color: color, 
                roughness: 1.0, 
                flatShading: true,
                transparent: true,
                opacity: 1.0
            });
    }
    return materialCache[key];
}

export function createBushModel(scale = 1, foliageColor = 0x558B2F) {
    const group = new THREE.Group();
    group.userData.isEnvironment = true;

    group.userData.swaySpeed = 1.0 + Math.random();
    group.userData.swayOffset = Math.random() * 100;
    group.userData.baseScale = scale;

    const hasBerries = Math.random() > 0.7;
    const isTall = Math.random() > 0.7;

    const mat = getMaterial(foliageColor, false);

    if (isTall) {
        const tallGeo = getGeometry('bush_tall', () => new THREE.ConeGeometry(0.5, 1.5, 6));
        const main = new THREE.Mesh(tallGeo, mat);
        main.position.y = 0.75;
        main.castShadow = true; main.receiveShadow = true;
        group.add(main);
    } else {
        const mainGeo = getGeometry('bush_main', () => new THREE.IcosahedronGeometry(0.6, 0));
        const main = new THREE.Mesh(mainGeo, mat);
        main.position.y = 0.3;
        main.castShadow = true; main.receiveShadow = true;
        group.add(main);

        const subCount = 2 + Math.floor(Math.random() * 3);
        const subGeo = getGeometry('bush_sub', () => new THREE.IcosahedronGeometry(0.4, 0));
        for(let i=0; i < subCount; i++) {
            const sub = new THREE.Mesh(subGeo, mat);
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.3;
            sub.position.set(Math.cos(angle) * radius, 0.2 + Math.random() * 0.3, Math.sin(angle) * radius);
            sub.castShadow = true; sub.receiveShadow = true;
            group.add(sub);
        }
    }

    // Baies (Couleur contrastée ou givrée)
    if (hasBerries && !isTall) {
        // Si Hiver (feuilles blanches), baies bleues glacées, sinon rouges
        const berryColor = (foliageColor === 0xFFFFFF) ? 0x00BFFF : 0xFF5252;
        const berryMat = getMaterial(berryColor, true);
        const berryGeo = getGeometry('bush_berry', () => new THREE.BoxGeometry(0.1, 0.1, 0.1));
        for(let i=0; i<5; i++) {
            const berry = new THREE.Mesh(berryGeo, berryMat);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = 0.6;
            berry.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                0.3 + r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
            group.add(berry);
        }
    }

    group.scale.set(scale, scale, scale);

    group.animate = function(t) {
        const sway = Math.sin(t * this.userData.swaySpeed + this.userData.swayOffset) * 0.05;
        this.scale.y = this.userData.baseScale + sway * 0.5;
        this.scale.x = this.userData.baseScale - sway * 0.2;
        this.scale.z = this.userData.baseScale - sway * 0.2;
    };

    return group;
}