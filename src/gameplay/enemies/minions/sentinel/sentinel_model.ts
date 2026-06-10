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

        const matArmor = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.8 });
        const matDetail = new THREE.MeshStandardMaterial({ color: 0x95a5a6, roughness: 0.5, metalness: 0.9 });
        const matCore = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

        this.parts.torso = new THREE.Group();
        this.parts.torso.position.y = 1.0;
        this.enemy.mesh.add(this.parts.torso);
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), matArmor);
        this.parts.torso.add(chest);
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), matCore);
        core.position.z = 0.22;
        this.parts.torso.add(core);

        this.parts.head = new THREE.Group();
        this.parts.head.position.y = 0.4;
        this.parts.torso.add(this.parts.head);
        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.4), matArmor);
        this.parts.head.add(helmet);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.05), matCore);
        visor.position.set(0, 0, 0.2);
        this.parts.head.add(visor);

        const shoulderGeo = new THREE.BoxGeometry(0.4, 0.4, 0.5);
        const shL = new THREE.Mesh(shoulderGeo, matDetail); shL.position.set(-0.55, 0.2, 0);
        const shR = new THREE.Mesh(shoulderGeo, matDetail); shR.position.set( 0.55, 0.2, 0);
        this.parts.torso.add(shL);
        this.parts.torso.add(shR);

        this.parts.armL = new THREE.Group(); this.parts.armL.position.set(-0.55, 0, 0);
        this.parts.armR = new THREE.Group(); this.parts.armR.position.set( 0.55, 0, 0);
        this.parts.torso.add(this.parts.armL);
        this.parts.torso.add(this.parts.armR);
        const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), matArmor);
        armMesh.position.y = -0.3;
        const armLMesh = armMesh.clone();
        const armRMesh = armMesh.clone();
        this.parts.armL.add(armLMesh);
        this.parts.armR.add(armRMesh);

        this.parts.hammer = new THREE.Group();
        this.parts.hammer.position.set(0, -0.5, 0.2);
        this.parts.hammer.rotation.x = Math.PI/2; 
        this.parts.armR.add(this.parts.hammer);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8), matDark);
        this.parts.hammer.add(handle);
        const headGroup = new THREE.Group(); headGroup.position.y = 0.8; this.parts.hammer.add(headGroup);
        const headBlock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.4), matDetail); headGroup.add(headBlock);
        
        this.parts.shield = new THREE.Group();
        this.parts.shield.position.set(0.1, -0.3, 0.3);
        this.parts.shield.rotation.y = Math.PI/2;
        this.parts.armL.add(this.parts.shield);
        const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.1), matDetail);
        this.parts.shield.add(shieldPlate);
        
        const legGeo = new THREE.BoxGeometry(0.35, 0.8, 0.4);
        this.parts.legL = new THREE.Mesh(legGeo, matArmor); this.parts.legL.position.set(-0.25, 0.4, 0); this.enemy.mesh.add(this.parts.legL);
        this.parts.legR = new THREE.Mesh(legGeo, matArmor); this.parts.legR.position.set( 0.25, 0.4, 0); this.enemy.mesh.add(this.parts.legR);

        this.enemy.add(this.enemy.mesh);
        this.setupHealthBar();
        Globals.scene.add(this.enemy);
    }

    setupHealthBar() {
        this.enemy.hudGroup = new THREE.Group();
        this.enemy.hudGroup.position.y = this.enemy.scaleVal * 1.8;
        this.enemy.add(this.enemy.hudGroup);
        const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), new THREE.MeshBasicMaterial({color:0x000000}));
        this.enemy.hudGroup.add(bg);
        this.enemy.hpBar = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.15), new THREE.MeshBasicMaterial({color:0xff0000}));
        this.enemy.hpBar.position.z = 0.01;
        this.enemy.hudGroup.add(this.enemy.hpBar);
    }

    updateAnim(dt) {
        const time = Date.now() * 0.003;
        const isMoving = this.enemy.moveSpeed > 0.5;
        const lerpRot = (obj, axis, targetVal, speed = 8) => {
            if(!obj) return;
            obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], targetVal, dt * speed);
        };
        this.enemy.mesh.position.y = 0; 

        if (!this.enemy.isAttacking) {
            lerpRot(this.parts.torso, 'y', Math.sin(time) * 0.1);
            lerpRot(this.parts.torso, 'z', Math.cos(time * 2) * 0.05);
            lerpRot(this.parts.torso, 'x', 0); 
            lerpRot(this.parts.legL, 'x', isMoving ? Math.sin(time * 8) * 0.6 : 0);
            lerpRot(this.parts.legR, 'x', isMoving ? Math.sin(time * 8 + Math.PI) * 0.6 : 0);
            lerpRot(this.parts.armL, 'x', isMoving ? Math.sin(time * 8 + Math.PI) * 0.3 : 0);
            lerpRot(this.parts.armR, 'x', isMoving ? Math.sin(time * 8) * 0.3 : 0);
        }
        else if (this.enemy.animState === 'windup_smash') {
            lerpRot(this.parts.armR, 'x', -Math.PI + 0.5, 10); 
            lerpRot(this.parts.armR, 'z', 0.5, 10);
            lerpRot(this.parts.torso, 'x', -0.4, 10);
        }
        else if (this.enemy.animState === 'strike_smash') {
            lerpRot(this.parts.armR, 'x', 1.0, 20); 
            lerpRot(this.parts.torso, 'x', 0.5, 20);
        }
        else if (this.enemy.animState === 'windup_charge') {
            lerpRot(this.parts.torso, 'x', 0.6, 15);
            lerpRot(this.parts.armL, 'x', -0.5, 15);
            lerpRot(this.parts.armL, 'y', 1.0, 15);
        }
        else if (this.enemy.animState === 'charge_loop') {
            lerpRot(this.parts.torso, 'x', 0.8, 10);
            lerpRot(this.parts.legL, 'x', Math.sin(time * 20) * 1.0, 20);
            lerpRot(this.parts.legR, 'x', Math.sin(time * 20 + Math.PI) * 1.0, 20);
        }
        else if (this.enemy.animState === 'windup_bash') {
            lerpRot(this.parts.torso, 'y', -0.5, 15);
            lerpRot(this.parts.armL, 'z', -0.5, 15);
            lerpRot(this.parts.armL, 'y', 0, 15);
        }
        else if (this.enemy.animState === 'strike_bash') {
            lerpRot(this.parts.torso, 'y', 0.8, 25);
            lerpRot(this.parts.armL, 'z', 0.8, 25);
            lerpRot(this.parts.armL, 'x', -0.5, 25);
        }
    }
}