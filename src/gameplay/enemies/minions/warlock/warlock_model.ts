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

        // --- PALETTE MAGIQUE MODERNE & PREMIUM ---
        const matRobeDark = new THREE.MeshStandardMaterial({ 
            color: 0x1c1236, // Deep rich void purple
            roughness: 0.8, 
            flatShading: true 
        }); 
        const matRobeLight = new THREE.MeshStandardMaterial({ 
            color: 0x7b2cbf, // Mystic purple trim
            roughness: 0.6, 
            emissive: 0x3c096c, 
            emissiveIntensity: 0.45 
        }); 
        const matGold = new THREE.MeshStandardMaterial({ 
            color: 0xffb703, // Shiny metallic brass/gold
            metalness: 0.9, 
            roughness: 0.15, 
            emissive: 0xff8c00, 
            emissiveIntensity: 0.15 
        }); 
        const matGlow = new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, // Void cyan magic
            emissive: 0x00f0ff,
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 0.9,
            roughness: 0.2,
            metalness: 0.1
        });
        const matGlowPink = new THREE.MeshStandardMaterial({ 
            color: 0xe0aaff, // Void magenta/pink magic
            emissive: 0xc77dff,
            emissiveIntensity: 3.5,
            transparent: true,
            opacity: 0.95,
            roughness: 0.15,
            metalness: 0.1
        });
        const matSkinShadow = new THREE.MeshStandardMaterial({ 
            color: 0x0c0714, // Dark shadow flesh/mask
            roughness: 0.95,
            metalness: 0.1
        });

        // --- 1. BAS (Robe Flottante Multicouche) ---
        this.parts.skirt = new THREE.Group();
        this.parts.skirt.position.y = 0.6;
        this.enemy.mesh.add(this.parts.skirt);
        
        // Inner skirt
        const skirtGeo = new THREE.ConeGeometry(0.42, 1.1, 8, 1, true); 
        const skirt = new THREE.Mesh(skirtGeo, matRobeDark);
        skirt.rotation.x = Math.PI; 
        skirt.position.y = -0.1;
        this.parts.skirt.add(skirt);
        
        // Outer decorative robe plates (layered details)
        const outerRobeGeo = new THREE.ConeGeometry(0.46, 0.9, 6, 1, true);
        const outerRobe = new THREE.Mesh(outerRobeGeo, matRobeLight);
        outerRobe.rotation.x = Math.PI;
        outerRobe.position.y = -0.15;
        this.parts.skirt.add(outerRobe);

        // Golden ornate belt buckle
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.03, 4, 8), matGold);
        belt.rotation.x = Math.PI/2;
        belt.position.y = 0.35;
        this.parts.skirt.add(belt);

        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), matGold);
        buckle.position.set(0, 0.35, 0.40);
        this.parts.skirt.add(buckle);

        const buckleGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), matGlowPink);
        buckleGem.position.set(0, 0.35, 0.45);
        this.parts.skirt.add(buckleGem);

        // Ornate sashes
        const sashL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.03), matRobeLight);
        sashL.position.set(-0.08, -0.1, 0.42);
        sashL.rotation.x = -0.12;
        sashL.rotation.y = 0.05;
        this.parts.skirt.add(sashL);

        const sashR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.03), matRobeLight);
        sashR.position.set(0.08, -0.1, 0.42);
        sashR.rotation.x = -0.12;
        sashR.rotation.y = -0.05;
        this.parts.skirt.add(sashR);

        const sashTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.04), matGold);
        sashTrimL.position.set(-0.08, -0.5, 0.47);
        sashTrimL.rotation.x = -0.12;
        this.parts.skirt.add(sashTrimL);

        const sashTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.04), matGold);
        sashTrimR.position.set(0.08, -0.5, 0.47);
        sashTrimR.rotation.x = -0.12;
        this.parts.skirt.add(sashTrimR);

        // --- 2. TORSE & ÉPAULES ---
        this.parts.torso = new THREE.Group();
        this.parts.torso.position.y = 1.1;
        this.enemy.mesh.add(this.parts.torso);

        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.6, 8), matRobeDark);
        this.parts.torso.add(chest);

        // Glowing Core
        const voidCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), matGlowPink);
        voidCore.position.set(0, 0.08, 0.22);
        this.parts.torso.add(voidCore);
        this.parts.voidCore = voidCore;

        // Elegant collar
        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 4, 8, Math.PI), matGold);
        collar.rotation.z = Math.PI/2;
        collar.rotation.y = Math.PI/2;
        collar.position.set(0, 0.26, 0.02);
        this.parts.torso.add(collar);

        // Ornate floating shoulder pauldrons
        const pauldronL = new THREE.Group();
        pauldronL.position.set(-0.52, 0.25, 0);
        this.parts.torso.add(pauldronL);
        const pauldronMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.34), matGold);
        pauldronL.add(pauldronMeshL);
        const pauldronGemL = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), matGlow);
        pauldronGemL.position.set(-0.06, 0.12, 0);
        pauldronL.add(pauldronGemL);
        this.parts.pauldronL = pauldronL;

        const pauldronR = new THREE.Group();
        pauldronR.position.set(0.52, 0.25, 0);
        this.parts.torso.add(pauldronR);
        const pauldronMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.34), matGold);
        pauldronR.add(pauldronMeshR);
        const pauldronGemR = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), matGlow);
        pauldronGemR.position.set(0.06, 0.12, 0);
        pauldronR.add(pauldronGemR);
        this.parts.pauldronR = pauldronR;

        // --- 3. TÊTE (Capuche + Couronne de Cristaux) ---
        this.parts.head = new THREE.Group();
        this.parts.head.position.y = 0.45;
        this.parts.torso.add(this.parts.head);

        // Multi-layered Hood
        const hoodGeo = new THREE.BoxGeometry(0.42, 0.46, 0.46);
        const hood = new THREE.Mesh(hoodGeo, matRobeDark);
        this.parts.head.add(hood);

        const hoodInnerGeo = new THREE.BoxGeometry(0.36, 0.40, 0.40);
        const hoodInner = new THREE.Mesh(hoodInnerGeo, matRobeLight);
        hoodInner.position.set(0, -0.02, 0.04);
        this.parts.head.add(hoodInner);

        // Face mask
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.1), matSkinShadow);
        face.position.set(0, -0.06, 0.18);
        this.parts.head.add(face);

        // Angled glowing slit eyes
        const eyeGeo = new THREE.PlaneGeometry(0.06, 0.03);
        const eyeL = new THREE.Mesh(eyeGeo, matGlow); 
        eyeL.position.set(-0.08, -0.02, 0.24);
        eyeL.rotation.z = 0.22;
        
        const eyeR = new THREE.Mesh(eyeGeo, matGlow); 
        eyeR.position.set( 0.08, -0.02, 0.24);
        eyeR.rotation.z = -0.22;
        
        this.parts.head.add(eyeL); 
        this.parts.head.add(eyeR);

        // Crown of floating runic crystals
        const crown = new THREE.Group();
        crown.position.set(0, 0.38, 0.05);
        this.parts.head.add(crown);
        this.parts.crown = crown;

        for (let i = 0; i < 3; i++) {
            const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), matGlowPink);
            shard.position.set((i - 1) * 0.18, 0.05 - Math.abs(i - 1) * 0.03, 0);
            shard.rotation.x = 0.2;
            shard.rotation.z = -(i - 1) * 0.3;
            crown.add(shard);
        }

        // --- 4. BRAS & MANCHES ---
        this.parts.armL = new THREE.Group(); 
        this.parts.armL.position.set(-0.45, 0.15, 0);
        
        this.parts.armR = new THREE.Group(); 
        this.parts.armR.position.set( 0.45, 0.15, 0);
        
        this.parts.torso.add(this.parts.armL); 
        this.parts.torso.add(this.parts.armR);

        // Ornate sleeves
        const sleeveGeo = new THREE.ConeGeometry(0.14, 0.45, 6, 1, true);
        
        const sleeveL = new THREE.Mesh(sleeveGeo, matRobeDark); 
        sleeveL.position.y = -0.2; 
        sleeveL.rotation.z = Math.PI;
        
        const sleeveR = new THREE.Mesh(sleeveGeo, matRobeDark); 
        sleeveR.position.y = -0.2; 
        sleeveR.rotation.z = Math.PI;
        
        this.parts.armL.add(sleeveL); 
        this.parts.armR.add(sleeveR);

        // Gold cuffs at the sleeve rims
        const cuffL = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 4, 8), matGold);
        cuffL.position.y = -0.38;
        cuffL.rotation.x = Math.PI/2;
        this.parts.armL.add(cuffL);

        const cuffR = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 4, 8), matGold);
        cuffR.position.y = -0.38;
        cuffR.rotation.x = Math.PI/2;
        this.parts.armR.add(cuffR);

        // Dark hands
        const handGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const handL = new THREE.Mesh(handGeo, matSkinShadow); 
        handL.position.y = -0.44; 
        this.parts.armL.add(handL);
        
        const handR = new THREE.Mesh(handGeo, matSkinShadow); 
        handR.position.y = -0.44; 
        this.parts.armR.add(handR);

        // --- 5. BÂTON DU NÉANT DÉTAILLÉ (Main Droite) ---
        this.parts.staff = new THREE.Group();
        this.parts.staff.position.set(0, -0.42, 0.12);
        this.parts.staff.rotation.x = Math.PI/2; 
        this.parts.armR.add(this.parts.staff);
        
        const staffHandle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.035, 1.9, 6), 
            new THREE.MeshStandardMaterial({color: 0x241b35, roughness: 0.7})
        );
        this.parts.staff.add(staffHandle);

        // Gold bands on staff handle
        const band1 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 6), matGold); 
        band1.position.y = -0.4; 
        this.parts.staff.add(band1);
        
        const band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 6), matGold); 
        band2.position.y = 0.2; 
        this.parts.staff.add(band2);

        // Ornate Staff Head
        const staffHead = new THREE.Group();
        staffHead.position.y = 0.95;
        this.parts.staff.add(staffHead);
        this.parts.staffHead = staffHead;

        // Gold crescent ring
        const moonGeo = new THREE.TorusGeometry(0.18, 0.03, 6, 24);
        const moon = new THREE.Mesh(moonGeo, matGold);
        moon.rotation.x = Math.PI/2;
        staffHead.add(moon);

        // Glowing core void gem
        const staffGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), matGlowPink);
        this.parts.staffGem = staffGem; 
        staffHead.add(staffGem);

        // Orbiting rune ring
        const staffInnerRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 4, 16), matGlow);
        staffHead.add(staffInnerRing);
        this.parts.staffInnerRing = staffInnerRing;

        // Staff base tip
        const staffTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 6), matGold);
        staffTip.position.y = -0.95;
        staffTip.rotation.x = Math.PI;
        this.parts.staff.add(staffTip);

        // --- 6. GRIMOIRE EN LÉVITATION (Main Gauche) ---
        this.parts.book = new THREE.Group();
        this.parts.book.position.set(0, -0.6, 0.35); 
        this.parts.armL.add(this.parts.book);

        const bookCenter = new THREE.Group();
        this.parts.book.add(bookCenter);

        // Book Covers (Left/Right separate for organic flapping)
        const coverL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.36), new THREE.MeshStandardMaterial({color: 0x3d1b5c, roughness: 0.6}));
        coverL.position.x = -0.08;
        coverL.rotation.z = -0.24; // Open V-shape
        bookCenter.add(coverL);
        this.parts.bookCoverL = coverL;

        const coverR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.36), new THREE.MeshStandardMaterial({color: 0x3d1b5c, roughness: 0.6}));
        coverR.position.x = 0.08;
        coverR.rotation.z = 0.24; // Open V-shape
        bookCenter.add(coverR);
        this.parts.bookCoverR = coverR;

        // Pages (Left/Right)
        const pagesL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.34), new THREE.MeshStandardMaterial({color: 0xfff3e0, roughness: 0.9}));
        pagesL.position.set(-0.07, 0.02, 0);
        pagesL.rotation.z = -0.20;
        bookCenter.add(pagesL);
        this.parts.bookPagesL = pagesL;

        const pagesR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.34), new THREE.MeshStandardMaterial({color: 0xfff3e0, roughness: 0.9}));
        pagesR.position.set(0.07, 0.02, 0);
        pagesR.rotation.z = 0.20;
        bookCenter.add(pagesR);
        this.parts.bookPagesR = pagesR;

        // Golden bindings
        const binding = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 6), matGold);
        binding.rotation.x = Math.PI/2;
        binding.position.y = -0.02;
        bookCenter.add(binding);

        // Glowing spell rune floating above pages
        const spellRune = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), matGlow);
        spellRune.rotation.x = -Math.PI/2;
        spellRune.position.y = 0.08;
        this.parts.book.add(spellRune);
        this.parts.spellRune = spellRune;

        // --- 7. ORBES SATELLITES DE HAUTE QUALITÉ ---
        this.parts.orbs = new THREE.Group();
        this.parts.orbs.position.set(0, 1.0, 0); 
        this.enemy.mesh.add(this.parts.orbs);
        for(let i=0; i<3; i++) {
            const orbGroup = new THREE.Group();
            orbGroup.userData = { angle: (i/3)*Math.PI*2, speed: 2.5 + i*0.4, radius: 0.85 };
            
            // Octahedral void core
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), matGlow);
            orbGroup.add(crystal);
            
            // Gold orbital ring
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 4, 8), matGold);
            ring.rotation.x = Math.PI / 2;
            orbGroup.add(ring);

            // Energy trail
            const trail = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.25), matGlowPink);
            trail.position.z = 0.12;
            orbGroup.add(trail);

            this.parts.orbs.add(orbGroup);
        }

        // --- 8. HALO RUNIQUE DOUBLE (Dos) ---
        const haloGroup = new THREE.Group();
        haloGroup.position.set(0, 1.4, -0.22);
        haloGroup.scale.set(0,0,0);
        this.parts.haloGroup = haloGroup;
        this.enemy.mesh.add(haloGroup);

        const haloOuter = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.60, 24), matGlowPink);
        haloGroup.add(haloOuter);
        this.parts.haloOuter = haloOuter;

        const haloInner = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.46, 16), matGlow);
        haloInner.position.z = 0.01;
        haloGroup.add(haloInner);
        this.parts.haloInner = haloInner;

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

        // 1. Floating main body animation
        const floatY = 0.3 + Math.sin(time * 0.8) * 0.15;
        lerpPos(this.enemy.mesh, 'y', floatY, 5);

        // 2. Skirt/Robe flow & sway
        lerpRot(this.parts.skirt, 'z', isMoving ? Math.sin(time * 4.5) * 0.08 : Math.sin(time * 0.8) * 0.03, 6);
        lerpRot(this.parts.skirt, 'x', isMoving ? 0.15 + Math.cos(time * 4.5) * 0.06 : 0, 6);

        // 3. Floating pauldrons & crown
        if (this.parts.pauldronL) this.parts.pauldronL.position.y = 0.25 + Math.sin(time * 1.2) * 0.02;
        if (this.parts.pauldronR) this.parts.pauldronR.position.y = 0.25 + Math.sin(time * 1.2 + Math.PI) * 0.02;
        if (this.parts.crown) {
            this.parts.crown.position.y = 0.38 + Math.sin(time * 1.5) * 0.025;
            this.parts.crown.rotation.y = Math.sin(time * 0.5) * 0.1;
        }

        // 4. Void core pulsing
        if (this.parts.voidCore) {
            const pulse = 1.0 + Math.sin(time * 3) * 0.15;
            this.parts.voidCore.scale.setScalar(pulse);
            this.parts.voidCore.rotation.y += dt * 0.5;
        }

        // 5. Satellites rotation
        this.parts.orbs.children.forEach(orbGroup => {
            orbGroup.userData.angle += dt * orbGroup.userData.speed;
            const r = orbGroup.userData.radius + Math.sin(time * 2) * 0.1;
            orbGroup.position.x = Math.cos(orbGroup.userData.angle) * r;
            orbGroup.position.z = Math.sin(orbGroup.userData.angle) * r;
            orbGroup.position.y = Math.sin(orbGroup.userData.angle * 2) * 0.2;
            orbGroup.rotation.y = -orbGroup.userData.angle;
            
            // Spin individual crystals
            if (orbGroup.children[0]) {
                orbGroup.children[0].rotation.x += dt * 2;
                orbGroup.children[0].rotation.y += dt * 1;
            }
        });

        // 6. Staff spinning/floating
        if (this.parts.staffGem) {
            this.parts.staffGem.rotation.y += dt * 2;
            this.parts.staffGem.position.y = Math.sin(time * 5) * 0.04;
        }
        if (this.parts.staffInnerRing) {
            this.parts.staffInnerRing.rotation.y += dt * 3.5;
            this.parts.staffInnerRing.rotation.x = Math.sin(time) * 0.15;
        }

        // 7. Levitating spellbook page fluttering
        if (this.parts.book) {
            this.parts.book.position.y = -0.6 + Math.sin(time * 2.5) * 0.06;
            this.parts.book.rotation.z = Math.sin(time * 0.8) * 0.08;
            this.parts.book.rotation.x = Math.cos(time * 0.5) * 0.05;
        }
        if (this.parts.bookPagesL) this.parts.bookPagesL.rotation.z = -0.20 + Math.sin(time * 12) * 0.03;
        if (this.parts.bookPagesR) this.parts.bookPagesR.rotation.z = 0.20 + Math.sin(time * 12 + 1) * 0.03;
        if (this.parts.spellRune) {
            this.parts.spellRune.rotation.z += dt * 1.5;
            this.parts.spellRune.scale.setScalar(1.0 + Math.sin(time * 6) * 0.06);
        }

        // 8. Halo rotations
        if (this.parts.haloOuter) {
            const speed = this.enemy.isAttacking ? 6.0 : 1.2;
            this.parts.haloOuter.rotation.z += dt * speed;
        }
        if (this.parts.haloInner) {
            const speed = this.enemy.isAttacking ? -9.0 : -2.0;
            this.parts.haloInner.rotation.z += dt * speed;
        }

        // 9. Combat state animations (Amplified Invocation Rites)
        if (!this.enemy.isAttacking) {
            lerpRot(this.parts.torso, 'x', isMoving ? 0.2 : 0, 8); 
            lerpRot(this.parts.torso, 'y', 0, 8);
            lerpRot(this.parts.torso, 'z', 0, 8);
            lerpRot(this.parts.head, 'x', 0, 8);
            lerpRot(this.parts.armL, 'z', Math.PI/4.5 + Math.sin(time)*0.08, 5);
            lerpRot(this.parts.armR, 'z', -Math.PI/4.5 - Math.sin(time)*0.08, 5);
            lerpRot(this.parts.armR, 'x', 0, 5);
            lerpRot(this.parts.armL, 'x', 0, 5);
            lerpRot(this.parts.staff, 'x', Math.PI/2 + 0.2, 5); 
            
            // Reset torso position if it was vibrating
            if (this.parts.torso) {
                this.parts.torso.position.x = THREE.MathUtils.lerp(this.parts.torso.position.x, 0, dt * 10);
                this.parts.torso.position.z = THREE.MathUtils.lerp(this.parts.torso.position.z, 0, dt * 10);
            }

            if(this.parts.haloGroup) this.parts.haloGroup.scale.setScalar(THREE.MathUtils.lerp(this.parts.haloGroup.scale.x, 0, dt*5));
        }
        else if (this.enemy.animState === 'cast_bolt') {
            // Bolt cast: leaning back and then thrusting staff forward dramatically
            lerpRot(this.parts.torso, 'x', -0.25, 12); 
            lerpRot(this.parts.torso, 'y', -0.6, 12); 
            lerpRot(this.parts.armR, 'x', -Math.PI/1.5, 20); 
            lerpRot(this.parts.armR, 'z', -0.4, 20);
            lerpRot(this.parts.staff, 'x', Math.PI, 20); 
            
            // Floating book opens wider and glides back
            lerpRot(this.parts.armL, 'z', Math.PI/3.5, 10);
            
            if(this.parts.haloGroup) this.parts.haloGroup.scale.setScalar(THREE.MathUtils.lerp(this.parts.haloGroup.scale.x, 1.4, dt*10));
        }
        else if (this.enemy.animState === 'cast_zone') {
            // Zone summoning (METEOR/SPIKES!): rising off the ground, tilting back to target the heavens
            lerpPos(this.enemy.mesh, 'y', floatY + 0.9, 8);
            
            // Torso leans far back, head gazes straight up
            lerpRot(this.parts.torso, 'x', -0.5, 12); 
            lerpRot(this.parts.torso, 'y', 0, 12);
            lerpRot(this.parts.head, 'x', -0.7, 12); 
            
            // Throw both arms to the sky in a ritual V-shape
            lerpRot(this.parts.armR, 'z', -Math.PI + 0.2, 12);
            lerpRot(this.parts.armR, 'x', 0, 12);
            lerpRot(this.parts.armL, 'z', Math.PI - 0.2, 12);
            lerpRot(this.parts.armL, 'x', 0, 12);
            
            // Staff and book point straight up
            lerpRot(this.parts.staff, 'x', Math.PI, 12);
            
            // Halo grows to a massive runic array
            if(this.parts.haloGroup) this.parts.haloGroup.scale.setScalar(THREE.MathUtils.lerp(this.parts.haloGroup.scale.x, 2.1, dt*6));
            
            // Make the floating crown crystals rotate and vibrate violently
            if (this.parts.crown) {
                this.parts.crown.position.y += Math.sin(time * 60) * 0.03;
                this.parts.crown.rotation.y += dt * 8;
            }
        }
        else if (this.enemy.animState === 'cast_beam') {
            // Channeling laser: arms thrashing forward, torso trembling from the recoil
            lerpRot(this.parts.torso, 'x', 0.25, 10); // lean into the blast
            
            // Recoil/vibration shake
            if (this.parts.torso) {
                this.parts.torso.position.x = Math.sin(time * 45) * 0.04;
                this.parts.torso.position.z = Math.cos(time * 45) * 0.04;
            }
            
            // Arms pointing straight forward
            lerpRot(this.parts.armR, 'x', -Math.PI/2, 15);
            lerpRot(this.parts.armR, 'z', 0, 15);
            lerpRot(this.parts.armL, 'x', -Math.PI/2, 15);
            lerpRot(this.parts.armL, 'z', 0, 15);
            
            // Staff is horizontal, focusing energy
            lerpRot(this.parts.staff, 'x', Math.PI/2, 15);
            
            // Halos expand and spin at max frequency
            if(this.parts.haloGroup) this.parts.haloGroup.scale.setScalar(THREE.MathUtils.lerp(this.parts.haloGroup.scale.x, 1.3, dt*10));
        }
        else if (this.enemy.animState === 'teleport') {
            this.enemy.mesh.scale.setScalar(THREE.MathUtils.lerp(this.enemy.mesh.scale.x, 0.1, dt*20));
        }
    }
}