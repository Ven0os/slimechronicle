// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';

export class ShamanModel {
    constructor(enemy) {
        this.enemy = enemy;
        this.parts = {};
        this.init();
    }

    init() {
        if(this.enemy.mesh) this.enemy.remove(this.enemy.mesh);
        this.enemy.mesh = new THREE.Group();
        this.enemy.mesh.castShadow = true;
        this.enemy.mesh.scale.setScalar(this.enemy.scaleVal);

        // --- PALETTE DE COULEURS DU GNOME ---
        const matRobe = new THREE.MeshStandardMaterial({
            color: 0x2d6a4f, // Forest green robe
            roughness: 0.8,
            flatShading: true
        });
        const matSkin = new THREE.MeshStandardMaterial({
            color: 0xffdbac, // Soft peach skin
            roughness: 0.6
        });
        const matNose = new THREE.MeshStandardMaterial({
            color: 0xff9a9e, // Bulbous pink nose
            roughness: 0.5
        });
        const matBeard = new THREE.MeshStandardMaterial({
            color: 0xf8f9fa, // Fluffy white beard
            roughness: 0.9,
            flatShading: true
        });
        const matHat = new THREE.MeshStandardMaterial({
            color: 0xd90429, // Pointed bright red hat
            roughness: 0.7,
            flatShading: true
        });
        const matBoots = new THREE.MeshStandardMaterial({
            color: 0x4a3728, // Brown leather boots
            roughness: 0.8
        });

        // Glowing hand magic materials
        this.magicMatL = new THREE.MeshBasicMaterial({
            color: 0x00ffcc,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        this.magicMatR = new THREE.MeshBasicMaterial({
            color: 0x00ffcc,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        // Glowing runic halo materials
        const matGlowGreen = new THREE.MeshStandardMaterial({
            color: 0x2ecc71,
            emissive: 0x2ecc71,
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 0.9,
            roughness: 0.2,
            metalness: 0.1
        });
        const matGlowCyan = new THREE.MeshStandardMaterial({
            color: 0x00ffcc,
            emissive: 0x00ffcc,
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 0.9,
            roughness: 0.2,
            metalness: 0.1
        });

        // 1. PIEDS (Boots popping out)
        this.parts.bootL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.3), matBoots);
        this.parts.bootL.position.set(-0.15, 0.06, 0.05);
        this.enemy.mesh.add(this.parts.bootL);

        this.parts.bootR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.3), matBoots);
        this.parts.bootR.position.set(0.15, 0.06, 0.05);
        this.enemy.mesh.add(this.parts.bootR);

        // 2. CORPS / ROBE (Short, rounded cylinder)
        this.parts.torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 0.6, 8), matRobe);
        this.parts.torso.position.y = 0.36;
        this.enemy.mesh.add(this.parts.torso);

        // Gold belt buckle
        const beltMat = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.8, roughness: 0.2 });
        const belt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.06), beltMat);
        belt.position.set(0, -0.05, 0.39);
        this.parts.torso.add(belt);

        // 3. TÊTE (Small peach sphere)
        this.parts.head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), matSkin);
        this.parts.head.position.set(0, 0.72, 0.02);
        this.enemy.mesh.add(this.parts.head);

        // 4. NEZ (Bulbous pink nose centered in the face)
        this.parts.nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), matNose);
        this.parts.nose.position.set(0, 0.70, 0.22);
        this.enemy.mesh.add(this.parts.nose);

        // 5. BARBE (Bushy white beard that covers chest and face)
        this.parts.beard = new THREE.Group();
        this.parts.beard.position.set(0, 0.65, 0.12);
        this.enemy.mesh.add(this.parts.beard);

        const beardMain = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 6), matBeard);
        beardMain.rotation.x = 0.1;
        beardMain.position.y = -0.15;
        this.parts.beard.add(beardMain);

        // Extra side fluff for the beard
        const fluffL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), matBeard);
        fluffL.position.set(-0.12, -0.05, -0.04);
        this.parts.beard.add(fluffL);

        const fluffR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), matBeard);
        fluffR.position.set(0.12, -0.05, -0.04);
        this.parts.beard.add(fluffR);

        // 6. CHAPEAU POINTU (Pointy Red Wizard Hat)
        this.parts.hat = new THREE.Group();
        this.parts.hat.position.set(0, 0.82, 0.02);
        this.enemy.mesh.add(this.parts.hat);

        // Hat brim
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 12), matHat);
        brim.rotation.x = 0.08;
        this.parts.hat.add(brim);

        // Hat cone
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 10), matHat);
        cone.position.set(0, 0.28, -0.05);
        cone.rotation.x = -0.15; // Tilted slightly backwards
        this.parts.hat.add(cone);

        // 7. BRAS & GLOWING HANDS (Right & Left)
        this.parts.armL = new THREE.Group();
        this.parts.armL.position.set(-0.35, 0.48, 0.08);
        this.enemy.mesh.add(this.parts.armL);

        const sleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.25, 6), matRobe);
        sleeveL.rotation.z = Math.PI / 4;
        this.parts.armL.add(sleeveL);

        const handL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), matSkin);
        handL.position.set(-0.1, -0.1, 0.05);
        this.parts.armL.add(handL);

        this.parts.glowL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.magicMatL);
        this.parts.glowL.position.copy(handL.position);
        this.parts.armL.add(this.parts.glowL);

        // Right arm
        this.parts.armR = new THREE.Group();
        this.parts.armR.position.set(0.35, 0.48, 0.08);
        this.enemy.mesh.add(this.parts.armR);

        const sleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.25, 6), matRobe);
        sleeveR.rotation.z = -Math.PI / 4;
        this.parts.armR.add(sleeveR);

        const handR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), matSkin);
        handR.position.set(0.1, -0.1, 0.05);
        this.parts.armR.add(handR);

        this.parts.glowR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.magicMatR);
        this.parts.glowR.position.copy(handR.position);
        this.parts.armR.add(this.parts.glowR);

        // --- 8. HALO RUNIQUE DU SHAMAN (Dos) ---
        const haloGroup = new THREE.Group();
        haloGroup.position.set(0, 0.6, -0.2); // Positioned behind the back / head
        haloGroup.scale.setScalar(0.7);
        this.parts.haloGroup = haloGroup;
        this.enemy.mesh.add(haloGroup);

        const haloOuter = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.35, 24), matGlowGreen);
        haloGroup.add(haloOuter);
        this.parts.haloOuter = haloOuter;

        const haloInner = new THREE.Mesh(new THREE.RingGeometry(0.23, 0.26, 16), matGlowCyan);
        haloInner.position.z = 0.01;
        haloGroup.add(haloInner);
        this.parts.haloInner = haloInner;

        this.enemy.add(this.enemy.mesh);
        Globals.scene.add(this.enemy);
    }

    setMagicColor(colorHex) {
        this.magicMatL.color.setHex(colorHex);
        this.magicMatR.color.setHex(colorHex);
    }

    updateAnim(dt) {
        if (!this.enemy.mesh) return;

        const time = Date.now() * 0.001;
        const isMoving = this.enemy.moveSpeed > 0.2;

        const lerpRot = (obj, axis, targetVal, speed) => {
            if(!obj) return;
            obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], targetVal, dt * speed);
        };
        const lerpPos = (obj, axis, targetVal, speed) => {
            if(!obj) return;
            obj.position[axis] = THREE.MathUtils.lerp(obj.position[axis], targetVal, dt * speed);
        };

        // 1. Waddle walk / Idle bounce
        if (isMoving) {
            // Rock left and right while waddling
            const waddleAngle = Math.sin(time * 12) * 0.12;
            lerpRot(this.enemy.mesh, 'z', waddleAngle, 10);
            lerpRot(this.enemy.mesh, 'x', 0.1, 10);

            // Alternate boots up and down
            const leftStep = Math.max(0, Math.sin(time * 12)) * 0.06;
            const rightStep = Math.max(0, Math.sin(time * 12 + Math.PI)) * 0.06;
            lerpPos(this.parts.bootL, 'y', 0.06 + leftStep, 15);
            lerpPos(this.parts.bootR, 'y', 0.06 + rightStep, 15);

            // Sway hat and beard
            lerpRot(this.parts.hat, 'z', -waddleAngle * 0.5, 8);
            lerpRot(this.parts.beard, 'z', waddleAngle * 0.3, 8);
        } else {
            // Idle breathing bounce
            const idleOffset = Math.sin(time * 3.5) * 0.02;
            lerpPos(this.enemy.mesh, 'y', idleOffset, 8);
            lerpRot(this.enemy.mesh, 'z', 0, 8);
            lerpRot(this.enemy.mesh, 'x', 0, 8);
            lerpPos(this.parts.bootL, 'y', 0.06, 8);
            lerpPos(this.parts.bootR, 'y', 0.06, 8);
            lerpRot(this.parts.hat, 'z', Math.sin(time * 2) * 0.03, 5);
            lerpRot(this.parts.beard, 'z', 0, 8);
        }

        // Pulse the hand magic spheres
        const glowScale = 1.0 + Math.sin(time * 15) * 0.25;
        if (this.parts.glowL) this.parts.glowL.scale.setScalar(glowScale);
        if (this.parts.glowR) this.parts.glowR.scale.setScalar(glowScale);

        // 2. Magic Hands casting wiggles
        if (!this.enemy.isAttacking && !this.enemy.isChanneling) {
            // Set base color to cyan/teal when idle
            this.setMagicColor(0x00ffcc);

            // Normal arms resting positions
            lerpRot(this.parts.armL, 'x', Math.sin(time * 2) * 0.05, 5);
            lerpRot(this.parts.armL, 'y', 0, 5);
            lerpRot(this.parts.armL, 'z', 0, 5);

            lerpRot(this.parts.armR, 'x', Math.sin(time * 2) * 0.05, 5);
            lerpRot(this.parts.armR, 'y', 0, 5);
            lerpRot(this.parts.armR, 'z', 0, 5);

            // Return torso to normal
            lerpRot(this.parts.torso, 'x', 0, 8);
            lerpRot(this.parts.torso, 'y', 0, 8);
        } else {
            // Spell colors based on spell state
            if (this.enemy.animState === 'cast_heal') {
                this.setMagicColor(0x2ecc71); // Green heal
            } else if (this.enemy.animState === 'cast_shield') {
                this.setMagicColor(0x3498db); // Cyan / Blue shield
            } else if (this.enemy.animState === 'cast_boost') {
                this.setMagicColor(0xe74c3c); // Red damage boost
            } else if (this.enemy.animState === 'cast_ray') {
                this.setMagicColor(0xf1c40f); // Yellow laser ray
            }

            // Rapid hand casting wiggle / invocation animation
            const wiggleL_Y = -Math.PI / 4 + Math.sin(time * 40) * 0.2;
            const wiggleR_Y = Math.PI / 4 + Math.cos(time * 40) * 0.2;

            lerpRot(this.parts.armL, 'x', -Math.PI / 3, 15);
            lerpRot(this.parts.armL, 'y', wiggleL_Y, 15);
            lerpRot(this.parts.armL, 'z', 0.2, 15);

            lerpRot(this.parts.armR, 'x', -Math.PI / 3, 15);
            lerpRot(this.parts.armR, 'y', wiggleR_Y, 15);
            lerpRot(this.parts.armR, 'z', -0.2, 15);

            // Torso leans slightly forward to invoke power
            lerpRot(this.parts.torso, 'x', 0.15, 12);
        }

        // Animate runic halo
        if (this.parts.haloOuter) {
            this.parts.haloOuter.rotation.z += dt * 1.5;
        }
        if (this.parts.haloInner) {
            this.parts.haloInner.rotation.z -= dt * 2.2;
        }

        if (!this.enemy.isAttacking && !this.enemy.isChanneling) {
            // Idle scale
            if (this.parts.haloGroup) {
                this.parts.haloGroup.scale.setScalar(THREE.MathUtils.lerp(this.parts.haloGroup.scale.x, 0.7, dt * 5));
            }
        } else {
            // Casting scale (larger)
            if (this.parts.haloGroup) {
                this.parts.haloGroup.scale.setScalar(THREE.MathUtils.lerp(this.parts.haloGroup.scale.x, 1.1, dt * 8));
            }
        }
    }
}
