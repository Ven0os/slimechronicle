// @ts-nocheck
import * as THREE from 'three';

export function createBushModel(scale = 1, foliageColor = 0x558B2F) {
    const group = new THREE.Group();
    group.userData.isEnvironment = true;

    group.userData.swaySpeed = 1.0 + Math.random();
    group.userData.swayOffset = Math.random() * 100;
    group.userData.baseScale = scale;

    const hasBerries = Math.random() > 0.7;
    const isTall = Math.random() > 0.7;

    const mat = new THREE.MeshStandardMaterial({ 
        color: foliageColor, 
        roughness: 1.0, 
        flatShading: true,
        transparent: true,
        opacity: 1.0
    });

    if (isTall) {
        const main = new THREE.Mesh(new THREE.ConeGeometry(0.5 * scale, 1.5 * scale, 6), mat);
        main.position.y = 0.75 * scale;
        main.castShadow = true; main.receiveShadow = true;
        group.add(main);
    } else {
        const main = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 * scale, 0), mat);
        main.position.y = 0.3 * scale;
        main.castShadow = true; main.receiveShadow = true;
        group.add(main);

        const subCount = 2 + Math.floor(Math.random() * 3);
        for(let i=0; i < subCount; i++) {
            const sub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 * scale, 0), mat);
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.3 * scale;
            sub.position.set(Math.cos(angle) * radius, 0.2 * scale + Math.random() * 0.3 * scale, Math.sin(angle) * radius);
            sub.castShadow = true; sub.receiveShadow = true;
            group.add(sub);
        }
    }

    // Baies (Couleur contrastée ou givrée)
    if (hasBerries && !isTall) {
        // Si Hiver (feuilles blanches), baies bleues glacées, sinon rouges
        const berryColor = (foliageColor === 0xFFFFFF) ? 0x00BFFF : 0xFF5252;
        const berryMat = new THREE.MeshBasicMaterial({ color: berryColor });
        for(let i=0; i<5; i++) {
            const berry = new THREE.Mesh(new THREE.BoxGeometry(0.1*scale, 0.1*scale, 0.1*scale), berryMat);
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const r = 0.6 * scale;
            berry.position.set(
                r * Math.sin(phi) * Math.cos(theta),
                0.3 * scale + r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
            group.add(berry);
        }
    }

    group.animate = function(t) {
        const sway = Math.sin(t * this.userData.swaySpeed + this.userData.swayOffset) * 0.05;
        this.scale.y = this.userData.baseScale + sway * 0.5;
        this.scale.x = this.userData.baseScale - sway * 0.2;
        this.scale.z = this.userData.baseScale - sway * 0.2;
    };

    return group;
}