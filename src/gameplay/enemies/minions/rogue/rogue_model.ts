// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';

export class RogueModel {
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

        // --- MODERN PREMIUM TOXIC SHADOW PALETTE ---
        const matCloth = new THREE.MeshStandardMaterial({ 
            color: 0x111612, // Midnight/charcoal dark cloth
            roughness: 0.85, 
            flatShading: true 
        });
        const matArmor = new THREE.MeshStandardMaterial({ 
            color: 0x143c1c, // Dark jade leather armor
            roughness: 0.5, 
            metalness: 0.4 
        });
        const matMetal = new THREE.MeshStandardMaterial({ 
            color: 0x39ff14, // Acid neon green
            roughness: 0.2, 
            metalness: 0.9, 
            emissive: 0x1ebd1e, 
            emissiveIntensity: 1.8 
        });
        const matGlow = new THREE.MeshBasicMaterial({ 
            color: 0x39ff14, // Eye/dagger core glow
            transparent: true,
            opacity: 0.9
        });
        const matGold = new THREE.MeshStandardMaterial({
            color: 0xcca43b, // Ornate gold accents
            metalness: 0.9,
            roughness: 0.2
        });

        // --- 1. TORSO & HARNESS ---
        this.parts.torso = new THREE.Group();
        this.parts.torso.position.y = 0.75;
        this.enemy.mesh.add(this.parts.torso);

        // Main chest
        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.5, 7), matArmor);
        this.parts.torso.add(chest);

        // Cross harness straps
        const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.03), matCloth);
        strapL.rotation.z = 0.55;
        strapL.position.set(0, 0, 0.13);
        this.parts.torso.add(strapL);

        const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.03), matCloth);
        strapR.rotation.z = -0.55;
        strapR.position.set(0, 0, 0.13);
        this.parts.torso.add(strapR);

        // Pointed shoulder pauldrons
        const pauldronL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.22), matMetal);
        pauldronL.position.set(-0.28, 0.22, 0);
        pauldronL.rotation.z = 0.3;
        this.parts.torso.add(pauldronL);

        const pauldronR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.22), matMetal);
        pauldronR.position.set(0.28, 0.22, 0);
        pauldronR.rotation.z = -0.3;
        this.parts.torso.add(pauldronR);

        // --- 2. CAPE (Double Shadow Wings) ---
        this.parts.cape = new THREE.Group();
        this.parts.cape.position.set(0, 0.2, -0.12);
        this.parts.torso.add(this.parts.cape);

        // Left wing cape
        const capeL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.03), matCloth);
        capeL.position.set(-0.12, -0.35, 0);
        capeL.rotation.x = 0.18;
        capeL.rotation.y = 0.08;
        capeL.rotation.z = -0.12;
        this.parts.cape.add(capeL);
        this.parts.capeL = capeL;

        // Right wing cape
        const capeR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.03), matCloth);
        capeR.position.set(0.12, -0.35, 0);
        capeR.rotation.x = 0.18;
        capeR.rotation.y = -0.08;
        capeR.rotation.z = 0.12;
        this.parts.cape.add(capeR);
        this.parts.capeR = capeR;

        // --- 3. HEAD (Assassin Cowl + Mask) ---
        this.parts.head = new THREE.Group();
        this.parts.head.position.y = 0.36;
        this.parts.torso.add(this.parts.head);

        // Cowl / Hood
        const hood = new THREE.Mesh(new THREE.DodecahedronGeometry(0.23), matCloth);
        this.parts.head.add(hood);

        // Ninja faceplate/wrap
        const faceMask = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.16), matArmor);
        faceMask.position.set(0, -0.04, 0.08);
        this.parts.head.add(faceMask);

        // Scarf/Collar wrap
        const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.14, 7), matCloth);
        scarf.position.y = -0.11;
        this.parts.head.add(scarf);

        // Menacing glowing slit eyes (angled)
        const eyeGeo = new THREE.PlaneGeometry(0.05, 0.02);
        const eyeL = new THREE.Mesh(eyeGeo, matGlow); 
        eyeL.position.set(-0.06, 0.03, 0.19);
        eyeL.rotation.z = 0.25;

        const eyeR = new THREE.Mesh(eyeGeo, matGlow); 
        eyeR.position.set( 0.06, 0.03, 0.19);
        eyeR.rotation.z = -0.25;

        this.parts.head.add(eyeL); 
        this.parts.head.add(eyeR);

        // --- 4. ARMS & SLEEVES ---
        this.parts.armL = new THREE.Group(); 
        this.parts.armL.position.set(-0.32, 0.15, 0);

        this.parts.armR = new THREE.Group(); 
        this.parts.armR.position.set( 0.32, 0.15, 0);

        this.parts.torso.add(this.parts.armL);
        this.parts.torso.add(this.parts.armR);

        const sleeveGeo = new THREE.CylinderGeometry(0.07, 0.05, 0.45, 6);
        const sleeveL = new THREE.Mesh(sleeveGeo, matCloth); 
        sleeveL.position.y = -0.2;
        this.parts.armL.add(sleeveL);

        const sleeveR = new THREE.Mesh(sleeveGeo, matCloth); 
        sleeveR.position.y = -0.2;
        this.parts.armR.add(sleeveR);

        // Leather forearm cuffs
        const cuffL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 6), matArmor);
        cuffL.position.y = -0.32;
        this.parts.armL.add(cuffL);

        const cuffR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 6), matArmor);
        cuffR.position.y = -0.32;
        this.parts.armR.add(cuffR);

        // --- 5. TWIN TOXIC CURVED DAGGERS ---
        const buildToxicDagger = () => {
            const grp = new THREE.Group();
            
            // Leather wrapped hilt
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16), matArmor); 
            handle.rotation.x = Math.PI / 2; 
            grp.add(handle);

            // Gold pommel with small poison bead
            const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), matGold);
            pommel.position.z = -0.09;
            grp.add(pommel);

            // Neon green crossguard
            const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.03), matMetal); 
            guard.position.z = 0.08; 
            grp.add(guard);

            // Curved toxic blade
            const bladeGroup = new THREE.Group();
            bladeGroup.position.z = 0.08;
            grp.add(bladeGroup);

            // Serrated back blade segment
            const bladeBase = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.18), matMetal);
            bladeBase.position.z = 0.09;
            bladeGroup.add(bladeBase);

            // Pointy tip
            const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 4), matMetal);
            bladeTip.rotation.x = Math.PI / 2;
            bladeTip.scale.set(1, 1, 0.25);
            bladeTip.position.z = 0.24;
            bladeGroup.add(bladeTip);

            // Curved slant
            bladeGroup.rotation.y = 0.12;

            return grp;
        };

        this.parts.daggerL = buildToxicDagger(); 
        this.parts.daggerL.position.set(0, -0.42, 0.06); 
        this.parts.daggerL.rotation.y = Math.PI; // Reverse grip pose
        this.parts.armL.add(this.parts.daggerL);

        this.parts.daggerR = buildToxicDagger(); 
        this.parts.daggerR.position.set(0, -0.42, 0.06); 
        this.parts.daggerR.rotation.y = Math.PI; // Reverse grip pose
        this.parts.armR.add(this.parts.daggerR);

        // --- 6. LEGS & TACTICAL STEALTH BOOTS ---
        this.parts.legL = new THREE.Group();
        this.parts.legL.position.set(-0.12, 0.35, 0);
        this.enemy.mesh.add(this.parts.legL);

        const legMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.65), matArmor);
        legMeshL.position.y = -0.325;
        this.parts.legL.add(legMeshL);

        // Knee guards
        const kneeL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.05), matMetal);
        kneeL.position.set(0, -0.22, 0.05);
        this.parts.legL.add(kneeL);

        this.parts.legR = new THREE.Group();
        this.parts.legR.position.set( 0.12, 0.35, 0);
        this.enemy.mesh.add(this.parts.legR);

        const legMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.65), matArmor);
        legMeshR.position.y = -0.325;
        this.parts.legR.add(legMeshR);

        // Knee guards
        const kneeR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.05), matMetal);
        kneeR.position.set(0, -0.22, 0.05);
        this.parts.legR.add(kneeR);

        // Tactical boot cuffs
        const bootCuffL = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.015, 4, 8), matCloth);
        bootCuffL.rotation.x = Math.PI/2;
        bootCuffL.position.y = -0.52;
        this.parts.legL.add(bootCuffL);

        const bootCuffR = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.015, 4, 8), matCloth);
        bootCuffR.rotation.x = Math.PI/2;
        bootCuffR.position.y = -0.52;
        this.parts.legR.add(bootCuffR);

        this.enemy.add(this.enemy.mesh);
        Globals.scene.add(this.enemy);
    }

    updateAnim(dt) {
        const time = Date.now() * 0.005;
        const isMoving = this.enemy.moveSpeed > 0.5;
        
        const lerpRot = (obj, axis, targetVal, speed = 15) => {
            if(!obj) return;
            obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], targetVal, dt * speed);
        };
        const lerpPos = (obj, axis, targetVal, speed = 15) => {
            if(!obj) return;
            obj.position[axis] = THREE.MathUtils.lerp(obj.position[axis], targetVal, dt * speed);
        };

        // 1. Cape fluttering
        if (this.parts.capeL) {
            const capeLRotX = isMoving ? 0.6 + Math.sin(time * 18) * 0.15 : 0.2 + Math.sin(time * 2.0) * 0.03;
            const capeLRotY = isMoving ? 0.2 + Math.sin(time * 9) * 0.05 : 0.08 + Math.sin(time * 1.5) * 0.02;
            lerpRot(this.parts.capeL, 'x', capeLRotX, 8);
            lerpRot(this.parts.capeL, 'y', capeLRotY, 8);
        }
        if (this.parts.capeR) {
            const capeRRotX = isMoving ? 0.6 + Math.sin(time * 18 + 0.5) * 0.15 : 0.2 + Math.sin(time * 2.0 + 0.5) * 0.03;
            const capeRRotY = isMoving ? -0.2 - Math.sin(time * 9 + 0.5) * 0.05 : -0.08 - Math.sin(time * 1.5 + 0.5) * 0.02;
            lerpRot(this.parts.capeR, 'x', capeRRotX, 8);
            lerpRot(this.parts.capeR, 'y', capeRRotY, 8);
        }

        // 2. Main locomotion and combat states
        if (!this.enemy.isAttacking) {
            // Restore default mesh scale and rotation Y
            lerpRot(this.enemy.mesh, 'y', 0, 15);

            if (isMoving) {
                // Low crouched stealth sprint (Ninja run)
                lerpRot(this.enemy.mesh, 'x', 0.65, 8); // lean whole body way forward
                lerpRot(this.parts.torso, 'x', 0.15 + Math.sin(time * 18) * 0.05, 12);
                lerpRot(this.parts.torso, 'y', Math.sin(time * 9) * 0.08, 12);
                lerpPos(this.parts.torso, 'y', 0.70 + Math.sin(time * 18) * 0.04, 12);

                // Look forward (tilt head back to compensate body lean)
                lerpRot(this.parts.head, 'x', -0.4, 12);

                // Arms extended backward holding daggers in reverse-grip (stealth run)
                lerpRot(this.parts.armL, 'x', 1.6 + Math.sin(time * 18) * 0.08, 10);
                lerpRot(this.parts.armL, 'z', -0.4, 10);
                
                lerpRot(this.parts.armR, 'x', 1.6 - Math.sin(time * 18) * 0.08, 10);
                lerpRot(this.parts.armR, 'z', 0.4, 10);

                // Fast leg pump
                lerpRot(this.parts.legL, 'x', Math.sin(time * 18) * 1.1, 15);
                lerpRot(this.parts.legR, 'x', Math.sin(time * 18 + Math.PI) * 1.1, 15);
            } 
            else {
                // Low bobbing stealth stance (Idle)
                lerpRot(this.enemy.mesh, 'x', 0.15, 6);
                lerpRot(this.parts.torso, 'x', 0.1, 8);
                lerpRot(this.parts.torso, 'y', 0, 8);
                lerpPos(this.parts.torso, 'y', 0.72 + Math.sin(time * 2.5) * 0.03, 8);
                
                lerpRot(this.parts.head, 'x', -0.1 + Math.sin(time * 2.5) * 0.03, 8);

                // Arms held ready in front
                lerpRot(this.parts.armL, 'x', -Math.PI / 2.5 + Math.sin(time * 2.5) * 0.06, 6);
                lerpRot(this.parts.armL, 'z', -0.25, 6);
                
                lerpRot(this.parts.armR, 'x', -Math.PI / 2.5 + Math.cos(time * 2.5) * 0.06, 6);
                lerpRot(this.parts.armR, 'z', 0.25, 6);

                // Legs stationary
                lerpRot(this.parts.legL, 'x', 0, 8);
                lerpRot(this.parts.legR, 'x', 0, 8);
            }
        } 
        else if (this.enemy.animState === 'windup_stab') {
            // Lunge wind-up: crouching low, cocking dagger back, twisting torso
            lerpRot(this.enemy.mesh, 'x', 0.25, 12);
            lerpRot(this.parts.torso, 'y', -0.65, 15);
            lerpPos(this.parts.torso, 'y', 0.65, 15);

            // Right arm pulled back, left arm balancing forward
            lerpRot(this.parts.armR, 'x', 0.3, 18); 
            lerpRot(this.parts.armR, 'y', -0.9, 18);
            lerpRot(this.parts.armR, 'z', 0.1, 18);

            lerpRot(this.parts.armL, 'x', -Math.PI / 3, 12);
            lerpRot(this.parts.armL, 'z', -0.5, 12);
        } 
        else if (this.enemy.animState === 'strike_stab') {
            // Snappy pierce: lunging forward violently
            lerpRot(this.enemy.mesh, 'x', 0.45, 20);
            lerpRot(this.parts.torso, 'y', 0.55, 25);
            lerpPos(this.parts.torso, 'y', 0.68, 25);

            // Right arm thrusts straight forward in a flash stab
            lerpRot(this.parts.armR, 'x', -Math.PI / 1.6, 30); 
            lerpRot(this.parts.armR, 'y', 0.3, 30);
            lerpRot(this.parts.armR, 'z', -0.1, 30);

            // Left arm swings back for counter-balance
            lerpRot(this.parts.armL, 'x', 1.0, 20);
        }
        else if (this.enemy.animState === 'windup_throw') {
            // Crouch low, cocking both arms back to prepare for the massive spin throw
            lerpRot(this.enemy.mesh, 'x', 0.35, 12);
            lerpPos(this.parts.torso, 'y', 0.6, 12);
            
            lerpRot(this.parts.armL, 'x', -Math.PI / 1.2, 15); 
            lerpRot(this.parts.armL, 'z', -0.6, 15);
            lerpRot(this.parts.armR, 'x', -Math.PI / 1.2, 15);
            lerpRot(this.parts.armR, 'z', 0.6, 15);
        }
        else if (this.enemy.animState === 'strike_throw') {
            // Whirlwind spin: spin the whole mesh 360 degrees
            this.enemy.mesh.rotation.y += dt * 35; // rapid spin
            
            // Fling arms wide out to throw knives
            lerpRot(this.parts.armL, 'z', -Math.PI / 2.2, 25);
            lerpRot(this.parts.armL, 'x', 0, 25);
            
            lerpRot(this.parts.armR, 'z', Math.PI / 2.2, 25);
            lerpRot(this.parts.armR, 'x', 0, 25);
        }
        else if (this.enemy.animState === 'teleport_cast') {
            this.enemy.mesh.scale.setScalar(THREE.MathUtils.lerp(this.enemy.mesh.scale.x, 0.01, dt*20));
        }
        else if (this.enemy.animState === 'teleport_appear') {
            this.enemy.mesh.scale.setScalar(THREE.MathUtils.lerp(this.enemy.mesh.scale.x, 1.0, dt*20));
        }
    }
}