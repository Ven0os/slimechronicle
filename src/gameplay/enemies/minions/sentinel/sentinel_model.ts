// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';

export class SentinelModel {
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

        // Modernized stylized metallic/emissive materials
        const matArmor = new THREE.MeshStandardMaterial({ 
            color: 0x3b4c5e, // Rich dark blue-steel
            roughness: 0.25, 
            metalness: 0.85 
        });
        const matDetail = new THREE.MeshStandardMaterial({ 
            color: 0xdfb73c, // Ornate bronze/gold trim
            roughness: 0.3, 
            metalness: 0.85 
        });
        const matIron = new THREE.MeshStandardMaterial({ 
            color: 0x1d2228, // Dark base iron joints
            roughness: 0.55, 
            metalness: 0.75 
        });
        const matCore = new THREE.MeshStandardMaterial({ 
            color: 0xff6600, 
            emissive: 0xff3c00, 
            emissiveIntensity: 3.5, 
            roughness: 0.15, 
            metalness: 0.1 
        });

        // 1. TORSO & POWER CORE
        this.parts.torso = new THREE.Group();
        this.parts.torso.position.y = 1.05;
        this.enemy.mesh.add(this.parts.torso);

        // Lower waist joint
        const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.25, 6), matIron);
        waist.position.y = -0.22;
        this.parts.torso.add(waist);

        // Main upper chest
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.54), matArmor);
        chest.position.y = 0.12;
        this.parts.torso.add(chest);

        // Beveled shoulder plates on torso
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.08, 8), matDetail);
        collar.position.y = 0.36;
        this.parts.torso.add(collar);

        // Glowing Core
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), matCore);
        core.position.set(0, 0.12, 0.24);
        this.parts.torso.add(core);
        this.parts.core = core;

        // 2. HEAD & HELMET
        this.parts.head = new THREE.Group();
        this.parts.head.position.y = 0.46;
        this.parts.torso.add(this.parts.head);

        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.36), matArmor);
        this.parts.head.add(helmet);

        // Visor (Glowing Energy)
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.06), matCore);
        visor.position.set(0, 0.04, 0.17);
        this.parts.head.add(visor);

        // Helmet crest / blade
        const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.24), matDetail);
        crest.position.set(0, 0.22, -0.06);
        this.parts.head.add(crest);

        // 3. HEAVY SHOULDERS & ARMS
        // Heavy left shoulder pad
        const shL = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.52), matDetail);
        shL.position.set(-0.58, 0.24, 0);
        this.parts.torso.add(shL);

        // Heavy right shoulder pad
        const shR = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.52), matDetail);
        shR.position.set(0.58, 0.24, 0);
        this.parts.torso.add(shR);

        // Left arm (Shield arm)
        this.parts.armL = new THREE.Group();
        this.parts.armL.position.set(-0.58, 0.05, 0);
        this.parts.torso.add(this.parts.armL);
        const armLUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.3), matIron);
        armLUpper.position.y = -0.15;
        this.parts.armL.add(armLUpper);
        const armLLower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), matArmor);
        armLLower.position.y = -0.42;
        this.parts.armL.add(armLLower);

        // Right arm (Weapon arm)
        this.parts.armR = new THREE.Group();
        this.parts.armR.position.set(0.58, 0.05, 0);
        this.parts.torso.add(this.parts.armR);
        const armRUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.3), matIron);
        armRUpper.position.y = -0.15;
        this.parts.armR.add(armRUpper);
        const armRLower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), matArmor);
        armRLower.position.y = -0.42;
        this.parts.armR.add(armRLower);

        // 4. WEAPON (GIGA BATTLE HAMMER)
        this.parts.hammer = new THREE.Group();
        this.parts.hammer.position.set(0, -0.56, 0.24);
        this.parts.hammer.rotation.x = Math.PI / 2;
        this.parts.hammer.rotation.y = Math.PI / 2; // Rotate 90 degrees to align with swing direction (not sideways)
        this.parts.armR.add(this.parts.hammer);

        // Metal handle
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), matIron);
        this.parts.hammer.add(handle);

        const hamHeadGroup = new THREE.Group();
        hamHeadGroup.position.y = 0.8;
        this.parts.hammer.add(hamHeadGroup);

        // Main central block of the hammer
        const centerBlock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.3), matIron);
        hamHeadGroup.add(centerBlock);

        // Hammer sides
        const sideL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.26, 8), matArmor);
        sideL.rotation.z = Math.PI / 2;
        sideL.position.x = -0.26;
        hamHeadGroup.add(sideL);

        const sideR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.26, 8), matArmor);
        sideR.rotation.z = -Math.PI / 2;
        sideR.position.x = 0.26;
        hamHeadGroup.add(sideR);

        // Hammer crown/spike
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 4), matDetail);
        spike.position.y = 0.32;
        hamHeadGroup.add(spike);

        // Glowing energy core inside the hammer head
        const hamEnergy = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.32), matCore);
        hamHeadGroup.add(hamEnergy);

        // 5. SHIELD (TOWER FORTRESS SHIELD)
        this.parts.shield = new THREE.Group();
        this.parts.shield.position.set(-0.18, -0.52, 0.22); // Shifted down, out, and forward to avoid shoulder clipping
        this.parts.shield.rotation.y = -0.15;
        this.parts.armL.add(this.parts.shield);

        // Main shield body (slightly shorter height to prevent shoulder/ground clipping)
        const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.0, 0.08), matArmor);
        this.parts.shield.add(shieldPlate);

        // Gold runic borders
        const borderT = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.1, 0.12), matDetail); borderT.position.y = 0.48; this.parts.shield.add(borderT);
        const borderB = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.1, 0.12), matDetail); borderB.position.y = -0.48; this.parts.shield.add(borderB);
        const borderL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.12), matDetail); borderL.position.x = -0.38; this.parts.shield.add(borderL);
        const borderR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.12), matDetail); borderR.position.x = 0.38; this.parts.shield.add(borderR);

        // Central glowing core emblem
        const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), matCore);
        emblem.position.z = 0.08;
        this.parts.shield.add(emblem);

        // 6. LEGS & HIP STRUCTURE
        const hipJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.72), matIron);
        hipJoint.rotation.z = Math.PI / 2;
        hipJoint.position.y = 0.55;
        this.enemy.mesh.add(hipJoint);

        const legGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.65);

        // Left leg group
        this.parts.legL = new THREE.Group();
        this.parts.legL.position.set(-0.25, 0.5, 0);
        this.enemy.mesh.add(this.parts.legL);
        const lLegMesh = new THREE.Mesh(legGeo, matArmor);
        lLegMesh.position.y = -0.25;
        this.parts.legL.add(lLegMesh);
        // Shin/Knee Plate
        const lKnee = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), matDetail);
        lKnee.position.set(0, -0.06, 0.12);
        this.parts.legL.add(lKnee);

        // Right leg group
        this.parts.legR = new THREE.Group();
        this.parts.legR.position.set(0.25, 0.5, 0);
        this.enemy.mesh.add(this.parts.legR);
        const rLegMesh = new THREE.Mesh(legGeo, matArmor);
        rLegMesh.position.y = -0.25;
        this.parts.legR.add(rLegMesh);
        // Shin/Knee Plate
        const rKnee = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), matDetail);
        rKnee.position.set(0, -0.06, 0.12);
        this.parts.legR.add(rKnee);

        this.enemy.add(this.enemy.mesh);
        Globals.scene.add(this.enemy);
    }

    updateAnim(dt) {
        const time = Date.now() * 0.003;
        const isMoving = this.enemy.moveSpeed > 0.5;
        const lerpRot = (obj, axis, targetVal, speed = 8) => {
            if(!obj) return;
            obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], targetVal, dt * speed);
        };
        
        // Reset base position
        this.enemy.mesh.position.y = 0; 
        
        // Rotate power core continuously
        if (this.parts.core) {
            this.parts.core.rotation.y += dt * 2.0;
            this.parts.core.rotation.x += dt * 1.0;
        }

        if (!this.enemy.isAttacking) {
            // Smooth idle breathing / bobbing
            const bob = Math.sin(time * 1.5) * 0.04;
            const headBob = Math.sin(time * 1.5 - 0.5) * 0.015;
            
            this.parts.torso.position.y = 1.05 + bob;
            this.parts.head.position.y = 0.46 + headBob;

            // Walk / Run cycle additions
            if (isMoving) {
                // Lean forward and bob actively with steps
                lerpRot(this.parts.torso, 'x', 0.15, 6);
                lerpRot(this.parts.torso, 'y', Math.sin(time * 8) * 0.08, 8);
                lerpRot(this.parts.torso, 'z', Math.cos(time * 16) * 0.04, 8);

                // Bob torso up and down with stride weight
                this.parts.torso.position.y = 1.05 + Math.abs(Math.sin(time * 8)) * 0.08 - 0.04;

                // Leg swing (pivoted cleanly from hip joint)
                lerpRot(this.parts.legL, 'x', Math.sin(time * 8) * 0.65, 12);
                lerpRot(this.parts.legR, 'x', Math.sin(time * 8 + Math.PI) * 0.65, 12);

                // Arm swing
                lerpRot(this.parts.armL, 'x', Math.sin(time * 8 + Math.PI) * 0.35, 10);
                lerpRot(this.parts.armR, 'x', Math.sin(time * 8) * 0.35, 10);
                
                // Shield/Hammer alignment during move
                lerpRot(this.parts.armL, 'z', -0.1, 8);
                lerpRot(this.parts.armR, 'z', 0.1, 8);
            } else {
                // Idle posture
                lerpRot(this.parts.torso, 'x', 0, 5);
                lerpRot(this.parts.torso, 'y', Math.sin(time * 0.5) * 0.05, 5);
                lerpRot(this.parts.torso, 'z', 0, 5);

                lerpRot(this.parts.legL, 'x', 0, 8);
                lerpRot(this.parts.legR, 'x', 0, 8);

                // Idle arm sway
                lerpRot(this.parts.armL, 'x', Math.sin(time * 1.5) * 0.03, 5);
                lerpRot(this.parts.armL, 'z', -0.05 + Math.sin(time * 1.5) * 0.02, 5);
                lerpRot(this.parts.armR, 'x', -Math.sin(time * 1.5) * 0.03, 5);
                lerpRot(this.parts.armR, 'z', 0.05 - Math.sin(time * 1.5) * 0.02, 5);
            }
        }
        else if (this.enemy.animState === 'windup_smash') {
            // Windup: raise hammer high, tilt body back
            lerpRot(this.parts.armR, 'x', -Math.PI - 0.4, 15); 
            lerpRot(this.parts.armR, 'z', -0.3, 15);
            lerpRot(this.parts.torso, 'x', -0.35, 12);
            lerpRot(this.parts.armL, 'x', 0.5, 12); // lower shield
            this.parts.torso.position.y = 1.12; // stretch upwards
        }
        else if (this.enemy.animState === 'strike_smash') {
            // Strike: slam down rapidly, compress body
            lerpRot(this.parts.armR, 'x', 0.95, 26); 
            lerpRot(this.parts.torso, 'x', 0.5, 26);
            lerpRot(this.parts.torso, 'y', 0.2, 26);
            this.parts.torso.position.y = 0.86; // heavy impact squash
        }
        else if (this.enemy.animState === 'windup_charge') {
            // Lean forward, shield in front, hammer back
            lerpRot(this.parts.torso, 'x', 0.52, 16);
            lerpRot(this.parts.armL, 'x', -0.78, 16);
            lerpRot(this.parts.armL, 'y', 0.4, 16);
            lerpRot(this.parts.armR, 'x', 0.55, 16);
        }
        else if (this.enemy.animState === 'charge_loop') {
            // Tilt torso forward heavily
            lerpRot(this.parts.torso, 'x', 0.62, 12);
            // Pump legs fast
            lerpRot(this.parts.legL, 'x', Math.sin(time * 24) * 0.95, 24);
            lerpRot(this.parts.legR, 'x', Math.sin(time * 24 + Math.PI) * 0.95, 24);
            // High frequency vibration/bobbing during charge
            this.parts.torso.position.y = 0.96 + Math.sin(time * 48) * 0.05;
        }
        else if (this.enemy.animState === 'windup_bash') {
            // Windup: pull shield arm back, rotate torso away
            lerpRot(this.parts.torso, 'y', -0.55, 16);
            lerpRot(this.parts.armL, 'z', -0.45, 16);
            lerpRot(this.parts.armL, 'y', 0, 16);
        }
        else if (this.enemy.animState === 'strike_bash') {
            // Strike: snap torso and shield forward
            lerpRot(this.parts.torso, 'y', 0.65, 26);
            lerpRot(this.parts.armL, 'z', 0.75, 26);
            lerpRot(this.parts.armL, 'x', -0.55, 26);
        }
    }
}