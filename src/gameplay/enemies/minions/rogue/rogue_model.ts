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

        const matCloth = new THREE.MeshStandardMaterial({ color: 0x1e5631, roughness: 0.9, flatShading: true });
        const matArmor = new THREE.MeshStandardMaterial({ color: 0x2d6a32, roughness: 0.55, metalness: 0.35 });
        const matMetal = new THREE.MeshStandardMaterial({ color: 0x7fff00, roughness: 0.25, metalness: 0.85, emissive: 0x1e5631, emissiveIntensity: 0.25 });

        this.parts.torso = new THREE.Group();
        this.parts.torso.position.y = 0.75;
        this.enemy.mesh.add(this.parts.torso);
        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.15, 0.5, 6), matArmor);
        this.parts.torso.add(chest);

        this.parts.cape = new THREE.Group();
        this.parts.cape.position.set(0, 0.2, -0.15);
        this.parts.torso.add(this.parts.cape);
        const capeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.05), matCloth);
        capeMesh.position.y = -0.3;
        capeMesh.rotation.x = 0.2;
        this.parts.cape.add(capeMesh);

        this.parts.head = new THREE.Group();
        this.parts.head.position.y = 0.35;
        this.parts.torso.add(this.parts.head);
        const hood = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), matCloth);
        this.parts.head.add(hood);
        const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.15, 6), matArmor);
        scarf.position.y = -0.1;
        this.parts.head.add(scarf);
        const eyes = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.04), new THREE.MeshBasicMaterial({color: 0x7fff00}));
        eyes.position.set(0, 0, 0.18);
        this.parts.head.add(eyes);

        this.parts.armL = new THREE.Group(); this.parts.armL.position.set(-0.3, 0.15, 0);
        this.parts.armR = new THREE.Group(); this.parts.armR.position.set( 0.3, 0.15, 0);
        this.parts.torso.add(this.parts.armL);
        this.parts.torso.add(this.parts.armR);

        const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.45);
        const meshArmL = new THREE.Mesh(armGeo, matCloth); meshArmL.position.y = -0.2;
        const meshArmR = new THREE.Mesh(armGeo, matCloth); meshArmR.position.y = -0.2;
        this.parts.armL.add(meshArmL);
        this.parts.armR.add(meshArmR);

        const buildDagger = () => {
            const grp = new THREE.Group();
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15), matArmor); handle.rotation.x = Math.PI/2; grp.add(handle);
            const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.02), matMetal); guard.position.z = 0.08; grp.add(guard);
            const blade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.35, 4), matMetal); blade.scale.set(1, 1, 0.2); blade.rotation.x = Math.PI/2; blade.position.z = 0.25; grp.add(blade);
            return grp;
        };
        this.parts.daggerL = buildDagger(); this.parts.daggerL.position.set(0, -0.45, 0.1); this.parts.armL.add(this.parts.daggerL);
        this.parts.daggerR = buildDagger(); this.parts.daggerR.position.set(0, -0.45, 0.1); this.parts.armR.add(this.parts.daggerR);

        this.parts.legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.65), matArmor); this.parts.legL.position.set(-0.12, 0.35, 0); this.enemy.mesh.add(this.parts.legL);
        this.parts.legR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.65), matArmor); this.parts.legR.position.set( 0.12, 0.35, 0); this.enemy.mesh.add(this.parts.legR);

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
        const time = Date.now() * 0.005;
        const isMoving = this.enemy.moveSpeed > 0.5;
        const lerpRot = (obj, axis, targetVal, speed = 15) => {
            if(!obj) return;
            obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], targetVal, dt * speed);
        };
        
        this.enemy.mesh.position.y = 0;
        lerpRot(this.parts.cape, 'x', isMoving ? 0.5 + Math.sin(time * 10)*0.1 : 0.2, 5);

        if (!this.enemy.isAttacking) {
            lerpRot(this.enemy.mesh, 'x', isMoving ? 0.5 : 0);
            lerpRot(this.parts.torso, 'y', 0);
            lerpRot(this.parts.legL, 'x', isMoving ? Math.sin(time * 15) * 1.0 : 0);
            lerpRot(this.parts.legR, 'x', isMoving ? Math.sin(time * 15 + Math.PI) * 1.0 : 0);
            lerpRot(this.parts.armL, 'x', isMoving ? 1.2 : -Math.PI/2 + Math.sin(time)*0.1);
            lerpRot(this.parts.armR, 'x', isMoving ? 1.2 : -Math.PI/2 + Math.cos(time)*0.1);
            lerpRot(this.parts.armL, 'z', -0.3);
            lerpRot(this.parts.armR, 'z', 0.3);
        } 
        else if (this.enemy.animState === 'windup_stab') {
            lerpRot(this.parts.armR, 'x', -0.5, 20); 
            lerpRot(this.parts.armR, 'y', -0.8, 20);
            lerpRot(this.parts.torso, 'y', -0.5, 15);
        } 
        else if (this.enemy.animState === 'strike_stab') {
            lerpRot(this.parts.armR, 'x', -Math.PI/2 - 1.0, 30); 
            lerpRot(this.parts.armR, 'y', 0.2, 30);
            lerpRot(this.parts.torso, 'y', 0.5, 25);
        }
        else if (this.enemy.animState === 'windup_throw') {
            lerpRot(this.parts.armL, 'x', -Math.PI, 15); 
            lerpRot(this.parts.armR, 'x', -Math.PI, 15);
        }
        else if (this.enemy.animState === 'strike_throw') {
            lerpRot(this.parts.armL, 'x', 0, 25);
            lerpRot(this.parts.armR, 'x', 0, 25);
        }
        else if (this.enemy.animState === 'teleport_cast') {
            this.enemy.mesh.scale.setScalar(THREE.MathUtils.lerp(this.enemy.mesh.scale.x, 0.1, dt*20));
        }
        else if (this.enemy.animState === 'teleport_appear') {
            this.enemy.mesh.scale.setScalar(THREE.MathUtils.lerp(this.enemy.mesh.scale.x, 1.0, dt*20));
        }
    }
}