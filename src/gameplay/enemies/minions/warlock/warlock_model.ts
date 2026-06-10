// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '@/core/globals';

export class WarlockModel {
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

        // --- PALETTE MAGIQUE ---
        const matRobeDark = new THREE.MeshStandardMaterial({ color: 0x2c003e, roughness: 0.9, flatShading: true }); 
        const matRobeLight = new THREE.MeshStandardMaterial({ color: 0x5e2a84, roughness: 0.8 }); 
        const matGold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.3 }); 
        const matGlow = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 }); 
        const matSkinShadow = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });

        // --- 1. BAS (Robe Flottante) ---
        this.parts.skirt = new THREE.Group();
        this.parts.skirt.position.y = 0.6;
        this.enemy.mesh.add(this.parts.skirt);
        const skirtGeo = new THREE.ConeGeometry(0.45, 1.1, 7, 1, true); 
        const skirt = new THREE.Mesh(skirtGeo, matRobeDark);
        skirt.rotation.x = Math.PI; 
        skirt.position.y = -0.1;
        this.parts.skirt.add(skirt);
        const sash = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.05), matRobeLight);
        sash.position.set(0, -0.1, 0.22);
        sash.rotation.x = -0.1;
        this.parts.skirt.add(sash);

        // --- 2. TORSE & ÉPAULES ---
        this.parts.torso = new THREE.Group();
        this.parts.torso.position.y = 1.1;
        this.enemy.mesh.add(this.parts.torso);
        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.6, 7), matRobeDark);
        this.parts.torso.add(chest);
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 4, 6, Math.PI), matGold);
        collar.rotation.z = Math.PI/2;
        collar.position.set(0, 0.25, 0.05);
        this.parts.torso.add(collar);

        // --- 3. TÊTE (Capuche) ---
        this.parts.head = new THREE.Group();
        this.parts.head.position.y = 0.45;
        this.parts.torso.add(this.parts.head);
        const hoodGeo = new THREE.BoxGeometry(0.4, 0.45, 0.45);
        const hood = new THREE.Mesh(hoodGeo, matRobeDark);
        this.parts.head.add(hood);
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.1), matSkinShadow);
        face.position.set(0, -0.05, 0.18);
        this.parts.head.add(face);
        const eyeGeo = new THREE.PlaneGeometry(0.06, 0.04);
        const eyeL = new THREE.Mesh(eyeGeo, matGlow); eyeL.position.set(-0.08, 0, 0.24);
        const eyeR = new THREE.Mesh(eyeGeo, matGlow); eyeR.position.set( 0.08, 0, 0.24);
        this.parts.head.add(eyeL); this.parts.head.add(eyeR);

        // --- 4. BRAS & MANCHES ---
        this.parts.armL = new THREE.Group(); this.parts.armL.position.set(-0.45, 0.15, 0);
        this.parts.armR = new THREE.Group(); this.parts.armR.position.set( 0.45, 0.15, 0);
        this.parts.torso.add(this.parts.armL); this.parts.torso.add(this.parts.armR);
        const padGeo = new THREE.OctahedronGeometry(0.15);
        const padL = new THREE.Mesh(padGeo, matRobeLight); padL.position.set(0, 0.1, 0);
        const padR = new THREE.Mesh(padGeo, matRobeLight); padR.position.set(0, 0.1, 0);
        this.parts.armL.add(padL); this.parts.armR.add(padR);
        const sleeveGeo = new THREE.ConeGeometry(0.12, 0.45, 6, 1, true);
        const sleeveL = new THREE.Mesh(sleeveGeo, matRobeDark); sleeveL.position.y = -0.2; sleeveL.rotation.z = Math.PI;
        const sleeveR = new THREE.Mesh(sleeveGeo, matRobeDark); sleeveR.position.y = -0.2; sleeveR.rotation.z = Math.PI;
        this.parts.armL.add(sleeveL); this.parts.armR.add(sleeveR);
        const handGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const handL = new THREE.Mesh(handGeo, matSkinShadow); handL.position.y = -0.45; this.parts.armL.add(handL);
        const handR = new THREE.Mesh(handGeo, matSkinShadow); handR.position.y = -0.45; this.parts.armR.add(handR);

        // --- 5. BÂTON DU NÉANT (Main Droite) ---
        this.parts.staff = new THREE.Group();
        this.parts.staff.position.set(0, -0.4, 0.1);
        this.parts.staff.rotation.x = Math.PI/2; 
        this.parts.armR.add(this.parts.staff);
        const staffHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.8, 5), new THREE.MeshStandardMaterial({color: 0x3d3d3d}));
        this.parts.staff.add(staffHandle);
        const staffHead = new THREE.Group();
        staffHead.position.y = 0.9;
        this.parts.staff.add(staffHead);
        const moonGeo = new THREE.TorusGeometry(0.15, 0.03, 6, 16, Math.PI * 1.2);
        const moon = new THREE.Mesh(moonGeo, matGold);
        moon.rotation.z = -2.5;
        staffHead.add(moon);
        const staffGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), matGlow);
        this.parts.staffGem = staffGem; 
        staffHead.add(staffGem);

        // --- 6. GRIMOIRE EN LÉVITATION (Main Gauche) ---
        this.parts.book = new THREE.Group();
        this.parts.book.position.set(0, -0.6, 0.3); 
        this.parts.armL.add(this.parts.book);
        const bookCover = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.4), new THREE.MeshStandardMaterial({color: 0x4a3b2a}));
        this.parts.book.add(bookCover);
        const bookPages = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.38), new THREE.MeshStandardMaterial({color: 0xffffff}));
        bookPages.position.y = 0.02;
        this.parts.book.add(bookPages);

        // --- 7. ORBES SATELLITES ---
        this.parts.orbs = new THREE.Group();
        this.parts.orbs.position.set(0, 1.0, 0); 
        this.enemy.mesh.add(this.parts.orbs);
        for(let i=0; i<3; i++) {
            const orbGroup = new THREE.Group();
            orbGroup.userData = { angle: (i/3)*Math.PI*2, speed: 2+i*0.5, radius: 0.8 };
            const orbMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), matGlow);
            orbGroup.add(orbMesh);
            const trail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.3), matGlow);
            trail.position.z = 0.15;
            orbGroup.add(trail);
            this.parts.orbs.add(orbGroup);
        }

        // --- 8. HALO RUNIQUE (Dos) ---
        const haloGeo = new THREE.RingGeometry(0.5, 0.55, 32);
        const halo = new THREE.Mesh(haloGeo, matGlow);
        halo.position.set(0, 1.4, -0.2);
        halo.scale.set(0,0,0);
        this.parts.halo = halo;
        this.enemy.mesh.add(halo);

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
        const lerpPos = (obj, axis, targetVal, speed = 15) => {
            if(!obj) return;
            obj.position[axis] = THREE.MathUtils.lerp(obj.position[axis], targetVal, dt * speed);
        };

        const floatY = 0.3 + Math.sin(time * 0.8) * 0.15;
        lerpPos(this.enemy.mesh, 'y', floatY, 5);

        this.parts.orbs.children.forEach(orbGroup => {
            orbGroup.userData.angle += dt * orbGroup.userData.speed;
            const r = orbGroup.userData.radius + Math.sin(time * 2) * 0.1;
            orbGroup.position.x = Math.cos(orbGroup.userData.angle) * r;
            orbGroup.position.z = Math.sin(orbGroup.userData.angle) * r;
            orbGroup.position.y = Math.sin(orbGroup.userData.angle * 2) * 0.2;
            orbGroup.rotation.y = -orbGroup.userData.angle; 
        });

        if(this.parts.staffGem) {
            this.parts.staffGem.rotation.y += dt * 2;
            this.parts.staffGem.position.y = Math.sin(time * 5) * 0.05;
        }

        if(this.parts.book) {
            this.parts.book.position.y = -0.6 + Math.sin(time * 3) * 0.05;
            this.parts.book.rotation.z = Math.sin(time) * 0.1;
        }

        if (!this.enemy.isAttacking) {
            lerpRot(this.parts.torso, 'x', isMoving ? 0.2 : 0, 8); 
            lerpRot(this.parts.armL, 'z', Math.PI/4 + Math.sin(time)*0.1, 5);
            lerpRot(this.parts.armR, 'z', -Math.PI/4 - Math.sin(time)*0.1, 5);
            lerpRot(this.parts.armR, 'x', 0, 5);
            lerpRot(this.parts.staff, 'x', Math.PI/2 + 0.2, 5); 
            
            if(this.parts.halo) this.parts.halo.scale.setScalar(THREE.MathUtils.lerp(this.parts.halo.scale.x, 0, dt*5));
        }
        else if (this.enemy.animState === 'cast_bolt') {
            lerpRot(this.parts.armR, 'x', -Math.PI/2 - 0.2, 25); 
            lerpRot(this.parts.armR, 'z', -0.2, 25);
            lerpRot(this.parts.staff, 'x', Math.PI, 25); 
            lerpRot(this.parts.torso, 'y', -0.5, 15);
            if(this.parts.halo) this.parts.halo.scale.setScalar(THREE.MathUtils.lerp(this.parts.halo.scale.x, 1.2, dt*10));
        }
        else if (this.enemy.animState === 'cast_zone') {
            lerpRot(this.parts.armR, 'z', -Math.PI + 0.5, 15);
            lerpRot(this.parts.armL, 'z', Math.PI - 0.5, 15);
            lerpRot(this.parts.head, 'x', -0.5, 15); 
            if(this.parts.halo) this.parts.halo.scale.setScalar(THREE.MathUtils.lerp(this.parts.halo.scale.x, 1.5, dt*5));
        }
        else if (this.enemy.animState === 'cast_beam') {
            lerpRot(this.parts.armR, 'x', -Math.PI/2, 10);
            lerpRot(this.parts.armL, 'x', -Math.PI/2, 10);
            lerpRot(this.parts.torso, 'z', Math.sin(time*50)*0.05, 30); 
            if(this.parts.halo) {
                this.parts.halo.rotation.z += dt * 5; 
                this.parts.halo.scale.setScalar(1.0);
            }
        }
        else if (this.enemy.animState === 'teleport') {
            this.enemy.mesh.scale.setScalar(THREE.MathUtils.lerp(this.enemy.mesh.scale.x, 0.1, dt*20));
        }
    }
}