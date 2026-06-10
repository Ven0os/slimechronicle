// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';

export class RoyalGuardModel {
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

        const matGold = new THREE.MeshStandardMaterial({ color: 0xc5a000, roughness: 0.4, metalness: 0.6 });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        const matCloth = new THREE.MeshStandardMaterial({ color: 0x550000, roughness: 0.9, side: THREE.DoubleSide });

        this.parts.torso = new THREE.Group();
        this.parts.torso.position.y = 0.9;
        this.enemy.mesh.add(this.parts.torso);
        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 6), matGold);
        this.parts.torso.add(chest);

        this.parts.head = new THREE.Group();
        this.parts.head.position.y = 0.4;
        this.parts.torso.add(this.parts.head);
        const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.25), matGold);
        this.parts.head.add(helmet);
        const plume = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.2), matCloth);
        plume.position.y = 0.2;
        this.parts.head.add(plume);

        this.parts.cape = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), matCloth);
        this.parts.cape.position.set(0, 0.1, -0.2);
        this.parts.cape.rotation.y = Math.PI;
        this.parts.torso.add(this.parts.cape);

        this.parts.armL = new THREE.Group(); this.parts.armL.position.set(-0.4, 0.1, 0);
        this.parts.armR = new THREE.Group(); this.parts.armR.position.set( 0.4, 0.1, 0);
        this.parts.torso.add(this.parts.armL); this.parts.torso.add(this.parts.armR);
        
        const armGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.45);
        const aL = new THREE.Mesh(armGeo, matGold); aL.position.y = -0.2; this.parts.armL.add(aL);
        const aR = new THREE.Mesh(armGeo, matGold); aR.position.y = -0.2; this.parts.armR.add(aR);

        this.parts.weapon = new THREE.Group();
        this.parts.weapon.position.set(0, -0.45, 0);
        this.parts.weapon.rotation.x = Math.PI/2;
        this.parts.armR.add(this.parts.weapon);
        
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.1), matDark);
        guard.position.y = 0.1;
        this.parts.weapon.add(guard);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.05), new THREE.MeshStandardMaterial({color: 0xdddddd, metalness: 0.8}));
        blade.position.y = 0.6;
        this.parts.weapon.add(blade);

        const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.5);
        this.parts.legL = new THREE.Mesh(legGeo, matGold); this.parts.legL.position.set(-0.15, 0.3, 0); this.enemy.mesh.add(this.parts.legL);
        this.parts.legR = new THREE.Mesh(legGeo, matGold); this.parts.legR.position.set( 0.15, 0.3, 0); this.enemy.mesh.add(this.parts.legR);

        this.enemy.add(this.enemy.mesh);
        Globals.scene.add(this.enemy);
    }

    updateAnim(dt) {
        const time = Date.now() * 0.005;
        const isMoving = this.enemy.moveSpeed > 0.5;
        this.parts.cape.rotation.x = isMoving ? 0.3 + Math.sin(time*10)*0.1 : 0.1;

        if (this.enemy.animState === 'idle') {
            this.parts.legL.rotation.x = isMoving ? Math.sin(time*10)*0.8 : 0;
            this.parts.legR.rotation.x = isMoving ? Math.sin(time*10 + Math.PI)*0.8 : 0;
            this.parts.armL.rotation.x = isMoving ? Math.sin(time*10 + Math.PI)*0.5 : 0;
            this.parts.armR.rotation.x = isMoving ? Math.sin(time*10)*0.5 : 0;
            this.parts.armR.rotation.z = 0;
            this.parts.weapon.rotation.x = Math.PI/2;
        }
        else if (this.enemy.animState === 'windup_slash') {
            this.parts.torso.rotation.y = -0.5;
            this.parts.armR.rotation.x = -2.0; 
            this.parts.armR.rotation.z = 0.5;
        }
        else if (this.enemy.animState === 'strike_slash') {
            this.parts.torso.rotation.y = 0.5;
            this.parts.armR.rotation.x = 1.0; 
            this.parts.armR.rotation.z = -0.5;
        }
        else if (this.enemy.animState === 'windup_stomp') {
            this.enemy.mesh.position.y = -0.2; 
            this.parts.armL.rotation.x = -2.5; 
            this.parts.armR.rotation.x = -2.5;
        }
    }
}