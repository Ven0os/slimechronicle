// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { CONFIG } from '@/core/config';

const CORRUPT_HP_BAR = 0xa855f7;

export class CorruptedModel {
    constructor(enemy) {
        this.enemy = enemy;
        this.parts = {};
        this.init();
    }

    init() {
        if (this.enemy.mesh) this.enemy.remove(this.enemy.mesh);
        this.enemy.mesh = new THREE.Group();
        this.enemy.mesh.castShadow = true;
        this.enemy.mesh.scale.setScalar(this.enemy.scaleVal);

        const corruptColor = CONFIG.colors.enemy.corrupt;
        const matBody = new THREE.MeshStandardMaterial({ color: corruptColor, roughness: 0.85, flatShading: true });
        const matCore = new THREE.MeshStandardMaterial({ color: 0x1a1028, roughness: 0.9 });

        this.parts.torso = new THREE.Group();
        this.parts.torso.position.y = 0.8;
        this.enemy.mesh.add(this.parts.torso);

        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.55, 6), matBody);
        this.parts.torso.add(chest);

        this.parts.head = new THREE.Group();
        this.parts.head.position.y = 0.38;
        this.parts.torso.add(this.parts.head);

        const hood = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24), matCore);
        this.parts.head.add(hood);
        const eyes = new THREE.Mesh(
            new THREE.PlaneGeometry(0.16, 0.05),
            new THREE.MeshBasicMaterial({ color: 0xc084fc })
        );
        eyes.position.set(0, 0, 0.2);
        this.parts.head.add(eyes);

        this.parts.armL = new THREE.Group();
        this.parts.armL.position.set(-0.32, 0.12, 0);
        this.parts.armR = new THREE.Group();
        this.parts.armR.position.set(0.32, 0.12, 0);
        this.parts.torso.add(this.parts.armL);
        this.parts.torso.add(this.parts.armR);

        const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.48);
        this.parts.armL.add(new THREE.Mesh(armGeo, matBody));
        this.parts.armR.add(new THREE.Mesh(armGeo, matBody));

        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), matBody);
        claw.rotation.x = Math.PI / 2;
        claw.position.set(0, -0.28, 0.12);
        this.parts.armR.add(claw);

        this.parts.legL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.7), matBody);
        this.parts.legL.position.set(-0.14, 0.38, 0);
        this.parts.legR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.7), matBody);
        this.parts.legR.position.set(0.14, 0.38, 0);
        this.enemy.mesh.add(this.parts.legL);
        this.enemy.mesh.add(this.parts.legR);

        this.enemy.add(this.enemy.mesh);
        this.setupHealthBar();
        Globals.scene.add(this.enemy);
    }

    setupHealthBar() {
        this.enemy.hudGroup = new THREE.Group();
        this.enemy.hudGroup.position.y = this.enemy.scaleVal * 1.8;
        this.enemy.add(this.enemy.hudGroup);

        const bg = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 0.15),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        this.enemy.hudGroup.add(bg);

        this.enemy.hpBar = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 0.15),
            new THREE.MeshBasicMaterial({ color: CORRUPT_HP_BAR })
        );
        this.enemy.hpBar.position.z = 0.01;
        this.enemy.hudGroup.add(this.enemy.hpBar);
    }

    updateAnim(dt) {
        const time = Date.now() * 0.005;
        const isMoving = this.enemy.moveSpeed > 0.5;

        const lerpRot = (obj, axis, targetVal, speed = 12) => {
            if (!obj) return;
            obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], targetVal, dt * speed);
        };

        if (!this.enemy.isAttacking) {
            lerpRot(this.parts.torso, 'y', isMoving ? Math.sin(time * 8) * 0.08 : 0);
            lerpRot(this.parts.legL, 'x', isMoving ? Math.sin(time * 12) * 0.8 : 0);
            lerpRot(this.parts.legR, 'x', isMoving ? Math.sin(time * 12 + Math.PI) * 0.8 : 0);
            lerpRot(this.parts.armL, 'x', -0.4);
            lerpRot(this.parts.armR, 'x', -0.4);
        } else if (this.enemy.animState === 'windup_corrupt') {
            lerpRot(this.parts.armR, 'x', -1.2, 18);
            lerpRot(this.parts.torso, 'y', -0.35, 12);
        } else if (this.enemy.animState === 'strike_corrupt') {
            lerpRot(this.parts.armR, 'x', 0.2, 25);
            lerpRot(this.parts.torso, 'y', 0.45, 20);
        } else if (this.enemy.animState === 'cast_pulse') {
            lerpRot(this.parts.armL, 'x', -2.2, 10);
            lerpRot(this.parts.armR, 'x', -2.2, 10);
        }
    }
}
