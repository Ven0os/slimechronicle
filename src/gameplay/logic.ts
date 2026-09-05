// @ts-nocheck
import * as THREE from 'three';
import { STATE, CONFIG } from '../core/config';
import { Globals, GameActions, setPlayer, addEnemy, removeEnemy, disposeEnemyResources } from '../core/globals';
import { AudioSys } from '../core/ressources';
import { Network } from '@/multiplayer/network';
import { Player } from './player';
import { Enemy } from './enemy';
import { createDamageText } from '../visual/effects';
import { setAtmosphereMode } from '../visual/atmosphere';
import { createAltars } from './environment';
import { removeBossArenaBarrier } from './environment/royal_seal';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { CLASS_STATS_CONFIG } from '@/data/classStatsConfig';
import { pickMobSpawnType, randomWildSpawnPos, BOSS_ZONE, getRegionAt, getGroundLevelAt } from './world/worldZones';

const MINI_BOSS_SPAWN_CHANCE = 0.03;

const MINI_BOSS_MOB_TYPE: Record<string, string> = {
    verdant_stalker: 'rogue',
    iron_warden: 'sentinel',
    arcane_herald: 'warlock',
    corrupt_warden: 'corrupted',
};

import { applyMiniBossVariant } from './enemies/minions/mini_boss';

export function spawnRogueTent(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Canvas Cover (Cone)
    const coverGeo = new THREE.ConeGeometry(1.6, 2.0, 5);
    const coverMat = new THREE.MeshStandardMaterial({
        color: 0x70523d, // Rustic canvas brown
        roughness: 0.9,
        flatShading: true
    });
    const cover = new THREE.Mesh(coverGeo, coverMat);
    cover.position.y = 1.0;
    cover.rotation.y = Math.PI / 5;
    cover.castShadow = true;
    cover.receiveShadow = true;
    group.add(cover);

    // Support Poles (V-shape at front)
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 });
    
    const poleL = new THREE.Mesh(poleGeo, poleMat);
    poleL.position.set(-0.6, 0.9, 1.1);
    poleL.rotation.z = -0.3;
    poleL.rotation.y = 0.2;
    group.add(poleL);

    const poleR = new THREE.Mesh(poleGeo, poleMat);
    poleR.position.set(0.6, 0.9, 1.1);
    poleR.rotation.z = 0.3;
    poleR.rotation.y = -0.2;
    group.add(poleR);

    // Flag Pole & Fabric on top (Improvement)
    const flagPoleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4);
    const flagPole = new THREE.Mesh(flagPoleGeo, poleMat);
    flagPole.position.set(0, 2.2, 0);
    flagPole.castShadow = true;
    group.add(flagPole);

    const flagGeo = new THREE.BoxGeometry(0.4, 0.25, 0.03);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0x922b21, roughness: 0.9 });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.2, 2.4, 0);
    flag.castShadow = true;
    group.add(flag);

    // Sleeping Bedroll (Improvement)
    const bedrollGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6);
    const bedrollMat = new THREE.MeshStandardMaterial({ color: 0x1e3f20, roughness: 0.95 });
    const bedroll = new THREE.Mesh(bedrollGeo, bedrollMat);
    bedroll.position.set(-0.7, 0.06, 0.2);
    bedroll.rotation.x = Math.PI / 2;
    bedroll.rotation.z = 0.5;
    bedroll.castShadow = true;
    group.add(bedroll);

    // Leaning Round Shield (Improvement)
    const shieldGroup = new THREE.Group();
    shieldGroup.position.set(0.9, 0.2, -0.2);
    shieldGroup.rotation.y = -0.5;
    shieldGroup.rotation.z = -0.3;
    
    const shieldPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.03, 8),
        new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.7, roughness: 0.5 })
    );
    shieldPlate.rotation.x = Math.PI / 2;
    shieldPlate.castShadow = true;
    shieldGroup.add(shieldPlate);

    const boss = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 })
    );
    boss.position.z = 0.02;
    shieldGroup.add(boss);

    const trim = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.02, 4, 12),
        new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 })
    );
    trim.position.z = 0.01;
    shieldGroup.add(trim);
    group.add(shieldGroup);

    // Hanging Lantern (Improvement)
    const crossbarGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4);
    const crossbar = new THREE.Mesh(crossbarGeo, poleMat);
    crossbar.position.set(0, 1.6, 1.1);
    crossbar.rotation.z = Math.PI / 2;
    group.add(crossbar);

    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(0, 1.3, 1.1);

    const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 })
    );
    wire.position.y = 0.1;
    lanternGroup.add(wire);

    const capGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 4);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.8, roughness: 0.6 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.02;
    const basePlate = cap.clone();
    basePlate.position.y = -0.14;
    lanternGroup.add(cap, basePlate);

    const glassGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 4);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.y = -0.06;
    lanternGroup.add(glass);
    group.add(lanternGroup);

    // Inner Glowing Campfire (warm orange light)
    const fireGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    fire.position.set(0, 0.1, 0.8);
    group.add(fire);

    // Campfire wood logs base
    const woodLogGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4);
    const woodLogMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(woodLogGeo, woodLogMat);
        log.position.set(0, 0.02, 0.8);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i * Math.PI) / 3;
        group.add(log);
    }

    // Dynamic sparks (Improvement)
    const sparks = [];
    const sparkCount = 3;
    for (let i = 0; i < sparkCount; i++) {
        const sGeo = new THREE.SphereGeometry(0.04, 4, 4);
        const sMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
        const s = new THREE.Mesh(sGeo, sMat);
        s.position.set((Math.random() - 0.5) * 0.2, 0.15, 0.8 + (Math.random() - 0.5) * 0.2);
        group.add(s);
        sparks.push({
            mesh: s,
            speed: 0.3 + Math.random() * 0.3,
            offset: Math.random() * Math.PI
        });
    }

    // Rustic Wood Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.6, 6);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6e503b, roughness: 0.8 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(-1.2, 0.3, -0.6);
    barrel.castShadow = true;
    group.add(barrel);
    
    // Metal rings on barrel
    const ringGeo = new THREE.TorusGeometry(0.26, 0.02, 4, 12);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.8 });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.set(-1.2, 0.45, -0.6);
    const ring2 = ring1.clone();
    ring2.position.y = 0.15;
    group.add(ring1, ring2);

    // Wooden Supply Crate
    const crateGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
    const crate = new THREE.Mesh(crateGeo, crateMat);
    crate.position.set(1.1, 0.2, -0.5);
    crate.rotation.y = 0.4;
    crate.castShadow = true;
    group.add(crate);

    // Start tent animations
    group.userData.updateAnim = (time = Date.now() * 0.003) => {
        if (group.scale.x < 0.1) return;
        
        // Pulse campfire scale
        fire.scale.setScalar(1.0 + Math.sin(time * 2) * 0.1);
        
        // Rise sparks
        sparks.forEach(s => {
            s.mesh.position.y = 0.15 + ((time * s.speed + s.offset) % 0.6);
            const progress = (s.mesh.position.y - 0.15) / 0.6;
            s.mesh.scale.setScalar(Math.max(0.01, 1.0 - progress));
            s.mesh.position.x = Math.sin(time + s.offset) * 0.08;
        });

        // Flag subtle waving
        if (flag) {
            flag.rotation.y = Math.sin(time * 1.5) * 0.15;
        }
    };

    if (!isPreview) {
        Globals.scene.add(group);
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.8
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnArcanePortal(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Glowing Base Runes Circle
    const baseGeo = new THREE.CylinderGeometry(1.5, 1.6, 0.15, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f1934, roughness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Dark Portal Ring Inner Floor
    const ringGeo = new THREE.RingGeometry(0.2, 1.1, 12);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8a2be2 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.16;
    group.add(ring);

    // Floating Central Void Crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.4, 0);
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0xda70d6, wireframe: false });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 1.2, 0);
    crystal.castShadow = true;
    group.add(crystal);

    // Orbiting Portal Runes
    const runesList = [];
    for (let i = 0; i < 3; i++) {
        const runeGeo = new THREE.BoxGeometry(0.15, 0.25, 0.05);
        const runeMat = new THREE.MeshBasicMaterial({ color: 0xba55d3 });
        const rune = new THREE.Mesh(runeGeo, runeMat);
        const angle = (i * Math.PI * 2) / 3;
        const r = 0.8;
        rune.position.set(Math.cos(angle) * r, 0.35, Math.sin(angle) * r);
        group.add(rune);
        runesList.push({ mesh: rune, offset: angle });
    }

    // Surround Pillars (3 stone monoliths)
    for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3 + 0.5;
        const r = 1.3;
        const pilGeo = new THREE.BoxGeometry(0.25, 1.1, 0.25);
        const pilMat = new THREE.MeshStandardMaterial({ color: 0x3d3356, roughness: 0.9 });
        const pil = new THREE.Mesh(pilGeo, pilMat);
        pil.position.set(Math.cos(angle) * r, 0.55, Math.sin(angle) * r);
        pil.rotation.y = angle;
        pil.castShadow = true;
        group.add(pil);

        // Glowing crystal tips on pillars
        const tipGeo = new THREE.OctahedronGeometry(0.12, 0);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xbd00ff });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(Math.cos(angle) * r, 1.3, Math.sin(angle) * r);
        group.add(tip);
    }

    if (!isPreview) Globals.scene.add(group);

    // Floating animations
    group.userData.updateAnim = (time = Date.now() * 0.003) => {
        if (group.scale.x < 0.1) return;
        crystal.rotation.y += 0.02;
        crystal.position.y = 1.2 + Math.sin(time) * 0.15;
        
        runesList.forEach(r => {
            r.mesh.position.y = 0.35 + Math.sin(time * 0.7 + r.offset) * 0.1;
            r.mesh.rotation.y += 0.01;
        });
    };

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.4
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnSpikedBarricade(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4a3c, roughness: 0.9 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x423429, roughness: 0.8 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8, roughness: 0.4 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9 });

    // Spiked log 1, 2, 3
    const logHeight = 1.4;
    const logGeo = new THREE.CylinderGeometry(0.12, 0.12, logHeight, 5);
    const tipGeo = new THREE.ConeGeometry(0.12, 0.35, 5);

    const offsetsX = [-0.6, 0, 0.6];
    offsetsX.forEach(ox => {
        const logGroup = new THREE.Group();
        logGroup.position.set(ox, logHeight/2, 0);
        logGroup.rotation.x = -0.3; // Tilt forward

        const log = new THREE.Mesh(logGeo, woodMat);
        log.castShadow = true;
        logGroup.add(log);

        const tip = new THREE.Mesh(tipGeo, spikeMat);
        tip.position.y = logHeight / 2 + 0.15;
        tip.castShadow = true;
        logGroup.add(tip);

        // Iron reinforcement strap on each log
        const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 6), ironMat);
        strap.position.y = 0.2;
        logGroup.add(strap);

        group.add(logGroup);
    });

    // Crossbar log
    const barGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 5);
    const bar = new THREE.Mesh(barGeo, woodMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.5, 0.15);
    group.add(bar);

    // Rope bindings at crossbar joints
    const ropeGeo = new THREE.TorusGeometry(0.14, 0.03, 4, 8);
    offsetsX.forEach(ox => {
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.position.set(ox, 0.5, 0.15);
        rope.rotation.y = Math.PI / 2;
        group.add(rope);
    });

    // Small rock debris pile at the base
    const rockGeo = new THREE.DodecahedronGeometry(0.15, 0);
    for (let i = 0; i < 5; i++) {
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set((Math.random() - 0.5) * 1.6, 0.08, (Math.random() - 0.5) * 0.4 - 0.2);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        group.add(rock);
    }

    if (!isPreview) Globals.scene.add(group);

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.6
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnCorruptedObelisk(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Corruption Pool (Flat ring)
    const poolGeo = new THREE.RingGeometry(0.01, 1.8, 16);
    const poolMat = new THREE.MeshStandardMaterial({
        color: 0x3d0c5a,
        roughness: 0.9,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.01;
    group.add(pool);

    // Runic Obelisk Pillar
    const obeliskGeo = new THREE.CylinderGeometry(0.15, 0.32, 2.2, 4);
    const obeliskMat = new THREE.MeshStandardMaterial({
        color: 0x1b0826,
        roughness: 0.8,
        flatShading: true
    });
    const obelisk = new THREE.Mesh(obeliskGeo, obeliskMat);
    obelisk.position.y = 1.1;
    obelisk.rotation.y = Math.PI / 4;
    obelisk.castShadow = true;
    obelisk.receiveShadow = true;
    group.add(obelisk);

    // Floating Glowing Eye/Crystal
    const eyeGeo = new THREE.OctahedronGeometry(0.25, 0);
    const eyeMat = new THREE.MeshStandardMaterial({
        color: 0xd946ef,
        emissive: 0xd946ef,
        emissiveIntensity: 3.0,
        roughness: 0.1
    });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.y = 2.6;
    group.add(eye);

    // 3 Small floating crystals circling
    const floaters = [];
    for (let i = 0; i < 3; i++) {
        const crystalGeo = new THREE.OctahedronGeometry(0.1, 0);
        const crystalMat = new THREE.MeshBasicMaterial({ color: 0x9d4edd });
        const f = new THREE.Mesh(crystalGeo, crystalMat);
        group.add(f);
        floaters.push(f);
    }

    if (!isPreview) Globals.scene.add(group);

    // Animations
    group.userData.updateAnim = (time = Date.now() * 0.002) => {
        if (group.scale.x < 0.1) return;
        
        // Main crystal bobbing and spinning
        eye.rotation.y += 0.03;
        eye.position.y = 2.5 + Math.sin(time) * 0.12;

        // Circle floaters
        floaters.forEach((f, idx) => {
            const angle = time * 0.8 + (idx * Math.PI * 2) / 3;
            f.position.set(Math.cos(angle) * 0.8, 1.2 + Math.sin(time * 2 + idx) * 0.25, Math.sin(angle) * 0.8);
            f.rotation.y += 0.05;
        });
    };

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.8
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnTreasureOutpost(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // 1. Treasure Chest
    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, 0.15, 0);
    
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.8 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.9, roughness: 0.2 });
    
    // Chest Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), woodMat);
    base.castShadow = true;
    chestGroup.add(base);
    
    // Chest Lid (tilted open slightly)
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.5), woodMat);
    lid.position.set(0, 0.25, -0.05);
    lid.rotation.x = -0.2; // slightly open
    lid.castShadow = true;
    chestGroup.add(lid);
    
    // Golden Trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.52), goldMat);
    trim.position.y = 0.18;
    chestGroup.add(trim);

    // Gold Coins Spill / Loot Pile inside
    const lootGeo = new THREE.DodecahedronGeometry(0.18, 1);
    const loot = new THREE.Mesh(lootGeo, goldMat);
    loot.position.set(0, 0.12, 0);
    loot.scale.set(1.5, 0.6, 1.0);
    chestGroup.add(loot);

    group.add(chestGroup);

    // 2. Outpost Banner / Pirate Flag
    const bannerGroup = new THREE.Group();
    bannerGroup.position.set(0.9, 0, 0.4);

    const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.1;
    pole.castShadow = true;
    bannerGroup.add(pole);

    // Cloth Flag
    const flagGeo = new THREE.PlaneGeometry(0.6, 0.4);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.9, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.3, 1.8, 0);
    flag.rotation.y = 0.2;
    flag.castShadow = true;
    bannerGroup.add(flag);

    group.add(bannerGroup);

    // Simple wind waving animation
    group.userData.updateAnim = (time = Date.now() * 0.005) => {
        if (group.scale.x < 0.1) return;
        flag.rotation.y = 0.2 + Math.sin(time) * 0.08;
        flag.rotation.z = Math.sin(time * 0.8) * 0.03;
    };

    if (!isPreview) Globals.scene.add(group);

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.6
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnShamanRitualCircle(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Central cauldron
    const cauldronGroup = new THREE.Group();
    cauldronGroup.position.set(0, 0, 0);
    
    const potGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.7, metalness: 0.6 });
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.y = 0.3;
    pot.castShadow = true;
    cauldronGroup.add(pot);

    // Glowing brew inside cauldron
    const brewGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8);
    const brewMat = new THREE.MeshStandardMaterial({
        color: 0x2ecc71,
        emissive: 0x2ecc71,
        emissiveIntensity: 2.0,
        roughness: 0.1
    });
    const brew = new THREE.Mesh(brewGeo, brewMat);
    brew.position.y = 0.58;
    cauldronGroup.add(brew);

    // Bubbling green particles/bubbles rising
    const bubbles = [];
    for (let i = 0; i < 4; i++) {
        const bGeo = new THREE.SphereGeometry(0.06, 5, 5);
        const bMat = new THREE.MeshBasicMaterial({ color: 0x58d68d });
        const b = new THREE.Mesh(bGeo, bMat);
        b.position.set((Math.random() - 0.5) * 0.35, 0.6, (Math.random() - 0.5) * 0.35);
        cauldronGroup.add(b);
        bubbles.push({
            mesh: b,
            speed: 0.25 + Math.random() * 0.3,
            offset: Math.random() * Math.PI
        });
    }
    group.add(cauldronGroup);

    // 3 Surrounding Shaman Totems
    const totemGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.4, 5);
    const totemMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9, flatShading: true });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 }); // painted wings

    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + Math.PI/6;
        const r = 1.35;
        const totemGroup = new THREE.Group();
        totemGroup.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        totemGroup.rotation.y = -angle - Math.PI / 2; // Face the cauldron

        // Totem wood pole
        const pole = new THREE.Mesh(totemGeo, totemMat);
        pole.position.y = 0.7;
        pole.castShadow = true;
        totemGroup.add(pole);

        // Wings crossbar
        const wings = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.08), wingMat);
        wings.position.set(0, 1.1, -0.05);
        wings.castShadow = true;
        totemGroup.add(wings);

        // Glowing eyes (2 small beads)
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), eyeMat);
        eyeL.position.set(-0.05, 1.2, 0.13);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.05;
        totemGroup.add(eyeL, eyeR);

        group.add(totemGroup);
    }

    if (!isPreview) Globals.scene.add(group);

    // Animate brew bubbles
    group.userData.updateAnim = (time = Date.now() * 0.003) => {
        if (group.scale.x < 0.1) return;
        brew.scale.y = 1.0 + Math.sin(time) * 0.08;

        bubbles.forEach(b => {
            b.mesh.position.y = 0.6 + ((time * b.speed + b.offset) % 0.4);
            const scale = Math.max(0.01, 1.0 - ((b.mesh.position.y - 0.6) / 0.4));
            b.mesh.scale.setScalar(scale);
        });
    };

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.7
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnCursedCrypt(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Stone Slab Base
    const baseGeo = new THREE.BoxGeometry(2.0, 0.15, 1.4);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Sarcophagus Body
    const tombGeo = new THREE.BoxGeometry(1.2, 0.4, 0.6);
    const tombMat = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.8 });
    const tomb = new THREE.Mesh(tombGeo, tombMat);
    tomb.position.set(0, 0.35, 0);
    tomb.castShadow = true;
    group.add(tomb);

    // Lid
    const lidGeo = new THREE.BoxGeometry(1.22, 0.08, 0.62);
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x1a252f, roughness: 0.85 });
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.set(0, 0.59, 0);
    lid.castShadow = true;
    group.add(lid);

    // Glowing Magic Center
    const runeGeo = new THREE.BoxGeometry(0.3, 0.02, 0.3);
    const runeMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const rune = new THREE.Mesh(runeGeo, runeMat);
    rune.position.set(0, 0.64, 0);
    group.add(rune);

    // Gravestone
    const graveGeo = new THREE.BoxGeometry(0.15, 0.7, 0.45);
    const graveMat = new THREE.MeshStandardMaterial({ color: 0x566573, roughness: 0.9 });
    const grave = new THREE.Mesh(graveGeo, graveMat);
    grave.position.set(-0.8, 0.5, 0);
    grave.rotation.y = 0.1;
    grave.castShadow = true;
    group.add(grave);

    // Floating skull particles
    const floaters = [];
    for (let i = 0; i < 2; i++) {
        const skullGeo = new THREE.SphereGeometry(0.08, 5, 5);
        const skullMat = new THREE.MeshBasicMaterial({ color: 0xecf0f1 });
        const s = new THREE.Mesh(skullGeo, skullMat);
        group.add(s);
        floaters.push(s);
    }

    if (!isPreview) Globals.scene.add(group);

    // Floating animations
    group.userData.updateAnim = (time = Date.now() * 0.003) => {
        if (group.scale.x < 0.1) return;
        
        floaters.forEach((s, idx) => {
            const angle = time * 0.8 + idx * Math.PI;
            s.position.set(Math.cos(angle) * 0.5, 0.8 + Math.sin(time * 2 + idx) * 0.15, Math.sin(angle) * 0.5);
            s.rotation.y += 0.05;
        });
    };

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.8
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnDruidShrine(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Mossy Stone Slab
    const baseGeo = new THREE.CylinderGeometry(1.5, 1.6, 0.2, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x3d5a1a, roughness: 0.95 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Glowing Green Crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.4, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 2.0,
        roughness: 0.2
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 1.1, 0);
    crystal.castShadow = true;
    group.add(crystal);

    // Roots wrapping base
    const rootGeo = new THREE.TorusGeometry(0.8, 0.08, 6, 12);
    const rootMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.95 });
    const root1 = new THREE.Mesh(rootGeo, rootMat);
    root1.rotation.x = Math.PI / 2;
    root1.position.set(0, 0.15, 0);
    const root2 = root1.clone();
    root2.scale.setScalar(1.2);
    root2.rotation.z = Math.PI / 4;
    group.add(root1, root2);

    // Small floating leaf particles
    const leaves = [];
    for (let i = 0; i < 3; i++) {
        const leafGeo = new THREE.BoxGeometry(0.08, 0.03, 0.12);
        const leafMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
        const l = new THREE.Mesh(leafGeo, leafMat);
        group.add(l);
        leaves.push(l);
    }

    if (!isPreview) Globals.scene.add(group);

    // Animations
    group.userData.updateAnim = (time = Date.now() * 0.002) => {
        if (group.scale.x < 0.1) return;

        crystal.rotation.y += 0.015;
        crystal.position.y = 1.0 + Math.sin(time) * 0.12;

        leaves.forEach((l, idx) => {
            const angle = time * 0.9 + (idx * Math.PI * 2) / 3;
            l.position.set(Math.cos(angle) * 0.7, 0.9 + Math.sin(time * 2.5 + idx) * 0.1, Math.sin(angle) * 0.7);
            l.rotation.x += 0.02;
            l.rotation.y += 0.03;
        });
    };

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.8
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnVolcanicForge(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Dark Basalt base slab
    const baseGeo = new THREE.CylinderGeometry(1.4, 1.5, 0.2, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.1;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Glowing lava fissure
    const lavaGeo = new THREE.RingGeometry(0.1, 0.8, 12);
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const lava = new THREE.Mesh(lavaGeo, lavaMat);
    lava.rotation.x = -Math.PI / 2;
    lava.position.y = 0.21;
    group.add(lava);

    // Anvil Structure
    const anvilGroup = new THREE.Group();
    anvilGroup.position.set(0, 0.2, 0);

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 });
    
    // Anvil Base
    const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), ironMat);
    anvilBase.position.y = 0.125;
    anvilBase.castShadow = true;
    anvilGroup.add(anvilBase);

    // Anvil Waist
    const anvilWaist = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.15, 6), ironMat);
    anvilWaist.position.y = 0.325;
    anvilWaist.castShadow = true;
    anvilGroup.add(anvilWaist);

    // Anvil Horn (cone)
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), ironMat);
    horn.rotation.z = Math.PI / 2;
    horn.position.set(0.25, 0.4, 0);
    horn.castShadow = true;
    anvilGroup.add(horn);

    // Anvil Tail (box)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.18), ironMat);
    tail.position.set(-0.2, 0.4, 0);
    tail.castShadow = true;
    anvilGroup.add(tail);

    group.add(anvilGroup);

    // Floating Ember particles
    const embers = [];
    for (let i = 0; i < 4; i++) {
        const emberGeo = new THREE.SphereGeometry(0.04, 4, 4);
        const emberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const e = new THREE.Mesh(emberGeo, emberMat);
        e.position.set((Math.random() - 0.5) * 1.2, 0.3, (Math.random() - 0.5) * 1.2);
        group.add(e);
        embers.push({
            mesh: e,
            speed: 0.3 + Math.random() * 0.4,
            offset: Math.random() * Math.PI
        });
    }

    if (!isPreview) Globals.scene.add(group);

    // Animations
    group.userData.updateAnim = (time = Date.now() * 0.003) => {
        if (group.scale.x < 0.1) return;

        embers.forEach(e => {
            e.mesh.position.y = 0.3 + ((time * e.speed + e.offset) % 0.8);
            const scale = Math.max(0.01, 1.0 - ((e.mesh.position.y - 0.3) / 0.8));
            e.mesh.scale.setScalar(scale);
        });
    };

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.7
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnFrozenSpire(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Snowy/Ice Base Slab
    const baseGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.15, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Jagged Ice Spire
    const spireGeo = new THREE.ConeGeometry(0.4, 2.2, 5);
    const spireMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.1,
        flatShading: true
    });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = 1.1;
    spire.castShadow = true;
    spire.receiveShadow = true;
    group.add(spire);

    // Floating frost crystals
    const shards = [];
    for (let i = 0; i < 3; i++) {
        const shardGeo = new THREE.OctahedronGeometry(0.12, 0);
        const shardMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const s = new THREE.Mesh(shardGeo, shardMat);
        group.add(s);
        shards.push(s);
    }

    if (!isPreview) Globals.scene.add(group);

    // Animations
    group.userData.updateAnim = (time = Date.now() * 0.002) => {
        if (group.scale.x < 0.1) return;

        spire.rotation.y += 0.005;

        shards.forEach((s, idx) => {
            const angle = time * 0.7 + (idx * Math.PI * 2) / 3;
            s.position.set(Math.cos(angle) * 0.75, 1.1 + Math.sin(time * 2.0 + idx) * 0.2, Math.sin(angle) * 0.75);
            s.rotation.y += 0.02;
            s.rotation.x += 0.01;
        });
    };

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.6
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export function spawnAncientRuins(pos, isPreview = false) {
    if (!isPreview && !Globals.scene) return null;
    const group = new THREE.Group();
    group.position.copy(pos);
    group.position.y = getGroundLevelAt(pos);

    // Weathered Sand/Stone Base
    const baseGeo = new THREE.CylinderGeometry(1.4, 1.5, 0.15, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Broken antique column
    const columnGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 6);
    const columnMat = new THREE.MeshStandardMaterial({ color: 0xa1a1aa, roughness: 0.9, flatShading: true });
    const col = new THREE.Mesh(columnGeo, columnMat);
    col.position.set(0.6, 0.6, -0.4);
    col.rotation.set(0.2, 0.1, -0.1);
    col.castShadow = true;
    group.add(col);

    // Golem stone face
    const faceGeo = new THREE.DodecahedronGeometry(0.38, 0);
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.9 });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(-0.4, 0.38, 0.3);
    face.rotation.set(0.1, 0.5, 0.1);
    face.castShadow = true;
    group.add(face);

    // Glowing eyes (yellow/gold runes)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat);
    eyeL.position.set(-0.25, 0.45, 0.6);
    const eyeR = eyeL.clone();
    eyeR.position.x += 0.15;
    eyeR.position.z -= 0.08;
    group.add(eyeL, eyeR);

    if (!isPreview) Globals.scene.add(group);

    // Animation: Pulsing eyes
    group.userData.updateAnim = (time = Date.now() * 0.005) => {
        if (group.scale.x < 0.1) return;
        
        const intensity = 0.5 + Math.sin(time) * 0.5;
        eyeMat.color.setRGB(intensity * 0.9 + 0.1, intensity * 0.7 + 0.1, 0);
    };

    if (!isPreview) {
        if (!Globals.obstacles) Globals.obstacles = [];
        const obstacle = {
            position: pos.clone(),
            radius: 1.8
        };
        Globals.obstacles.push(obstacle);
        return { group, obstacle };
    }

    return { group, obstacle: null };
}

export const GameLogic = {
    
    setAmbiance: function(type) {
        if (!Globals.scene) return;

        // Ciel, brume et lumières sont pilotés par le module d'atmosphère, qui amène la
        // scène vers l'ambiance demandée au lieu de la faire basculer d'un seul coup.
        setAtmosphereMode(type === 'dark' ? 'dark' : 'normal');

        // Le sol s'assombrit encore directement : sa teinte vient des couleurs par sommet
        // du terrain, que le module d'atmosphère ne touche pas.
        const ground = Globals.ground;
        if (ground?.material) {
            ground.material.color.setHex(type === 'dark' ? 0x555555 : 0xffffff);
        }
    },

    gainXp: function(amount) {
        const mult = STATE.stats.xpMod || 1.0;
        const xpMult = (STATE.gameOptions && STATE.gameOptions.xpMult !== undefined) ? STATE.gameOptions.xpMult : 1.0;
        STATE.xp += amount * mult * xpMult;

        let leveled = false;
        while (STATE.xp >= STATE.xpToNext) {
            STATE.xp -= STATE.xpToNext;
            STATE.level++;
            STATE.skillPoints++;
            leveled = true;

            const baseMobXp = 35 * (1 + STATE.level * 0.1);
            const killsNeeded = 3 + Math.min(5, STATE.level * 0.25);
            STATE.xpToNext = Math.floor(baseMobXp * killsNeeded);

            if (Globals.player) {
                Globals.player.hp = Globals.player.maxHp;
                if (STATE.class === 'warrior') {
                    const baseDef = CLASS_STATS_CONFIG.warrior.base.defense;
                    STATE.stats.defense = (STATE.stats.defense ?? baseDef) + 2;
                } else {
                    STATE.stats.atk += 2;
                }
            }
        }

        if (leveled) {
            if (AudioSys.sfx.levelup) AudioSys.sfx.levelup();

            const btn = document.getElementById('skill-tree-btn');
            if (btn) {
                btn.style.borderColor = '#fff';
                setTimeout(() => btn.style.borderColor = 'var(--gold)', 2000);
            }
        }

        window.UI?.updateHUD();
    },

    spawnEnemy: function() {
        if (STATE.bossSpawned) return;

        // --- 20 VARIANTES DE SPAWN (GANGS / PACKS) ---
        const GANG_VARIANTS = [
            // --- 10 VARIANTES STANDARD ---
            {
                buildingType: 'barricade',
                mobs: [
                    { type: 'sentinel' },
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'barricade',
                mobs: [
                    { type: 'sentinel' },
                    { type: 'sentinel' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'tent',
                mobs: [
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'portal',
                mobs: [
                    { type: 'warlock' },
                    { type: 'warlock' },
                    { type: 'sentinel' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'portal',
                mobs: [
                    { type: 'corrupted' },
                    { type: 'corrupted' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'barricade',
                mobs: [
                    { type: 'royal_guard' },
                    { type: 'royal_guard' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'barricade',
                mobs: [
                    { type: 'sentinel' },
                    { type: 'warlock' },
                    { type: 'rogue' },
                    { type: 'corrupted' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'obelisk', // Corrupted obelisk camp
                mobs: [
                    { type: 'corrupted' },
                    { type: 'corrupted' },
                    { type: 'warlock' },
                    { type: 'shaman' },
                    { type: 'rogue' }
                ]
            },
            {
                buildingType: 'treasure', // Royal guards guarding a chest camp
                mobs: [
                    { type: 'royal_guard' },
                    { type: 'royal_guard' },
                    { type: 'sentinel' },
                    { type: 'rogue' }
                ]
            },
            {
                buildingType: 'crypt',
                mobs: [
                    { type: 'corrupted' },
                    { type: 'corrupted' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'shrine',
                mobs: [
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'shaman' },
                    { type: 'sentinel' }
                ]
            },
            {
                buildingType: 'forge',
                mobs: [
                    { type: 'sentinel' },
                    { type: 'royal_guard' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'frozen',
                mobs: [
                    { type: 'sentinel' },
                    { type: 'sentinel' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'ruins',
                mobs: [
                    { type: 'royal_guard' },
                    { type: 'royal_guard' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'ritual',
                mobs: [
                    { type: 'shaman' },
                    { type: 'shaman' },
                    { type: 'rogue' },
                    { type: 'warlock' }
                ]
            },

            // --- 10 VARIANTES AVEC MINI-BOSS ---
            {
                buildingType: 'tent',
                mobs: [
                    { type: 'rogue', miniBoss: 'verdant_stalker' },
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'barricade',
                mobs: [
                    { type: 'sentinel', miniBoss: 'iron_warden' },
                    { type: 'sentinel' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'portal',
                mobs: [
                    { type: 'warlock', miniBoss: 'arcane_herald' },
                    { type: 'warlock' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'obelisk',
                mobs: [
                    { type: 'corrupted', miniBoss: 'corrupt_warden' },
                    { type: 'corrupted' },
                    { type: 'corrupted' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'ritual',
                mobs: [
                    { type: 'rogue', miniBoss: 'verdant_stalker' },
                    { type: 'warlock', miniBoss: 'arcane_herald' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'treasure',
                mobs: [
                    { type: 'sentinel', miniBoss: 'iron_warden' },
                    { type: 'royal_guard' },
                    { type: 'royal_guard' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'tent',
                mobs: [
                    { type: 'rogue', miniBoss: 'verdant_stalker' },
                    { type: 'corrupted' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'tent',
                mobs: [
                    { type: 'corrupted', miniBoss: 'corrupt_warden' },
                    { type: 'sentinel', miniBoss: 'iron_warden' },
                    { type: 'rogue' },
                    { type: 'rogue' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'obelisk',
                mobs: [
                    { type: 'corrupted', miniBoss: 'corrupt_warden' },
                    { type: 'corrupted' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'crypt',
                mobs: [
                    { type: 'corrupted', miniBoss: 'corrupt_warden' },
                    { type: 'corrupted' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'shrine',
                mobs: [
                    { type: 'rogue', miniBoss: 'verdant_stalker' },
                    { type: 'rogue' },
                    { type: 'shaman' },
                    { type: 'sentinel' }
                ]
            },
            {
                buildingType: 'forge',
                mobs: [
                    { type: 'royal_guard', miniBoss: 'iron_warden' },
                    { type: 'royal_guard' },
                    { type: 'warlock' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'frozen',
                mobs: [
                    { type: 'sentinel', miniBoss: 'iron_warden' },
                    { type: 'warlock', miniBoss: 'arcane_herald' },
                    { type: 'shaman' }
                ]
            },
            {
                buildingType: 'ruins',
                mobs: [
                    { type: 'royal_guard', miniBoss: 'iron_warden' },
                    { type: 'rogue', miniBoss: 'verdant_stalker' },
                    { type: 'shaman' }
                ]
            }
        ];

        // 25% chance of spawning a mini-boss pack if player level is at least 2 (scaled by luck)
        const luckMini = (STATE.gameOptions && STATE.gameOptions.luckMultMiniBoss !== undefined) ? STATE.gameOptions.luckMultMiniBoss : 1.0;
        const miniBossChance = 0.25 * luckMini;
        const isMiniBossVariant = Math.random() < miniBossChance && STATE.level >= 2;
        
        // Filter standard or mini-boss variants by user weight/enable configurations
        const pool = [];
        const startIndex = isMiniBossVariant ? 15 : 0;
        const endIndex = isMiniBossVariant ? 29 : 15;
        
        for (let i = startIndex; i < endIndex; i++) {
            const v = GANG_VARIANTS[i];
            const type = v.buildingType;
            const isEnabled = STATE.gameOptions && STATE.gameOptions[`camp_${type}_enabled`] !== false;
            const weight = isEnabled ? (STATE.gameOptions[`camp_${type}_weight`] ?? 100) : 0;
            if (weight > 0) {
                pool.push({ variant: v, weight });
            }
        }

        // Weighted random selection
        let variant = null;
        if (pool.length > 0) {
            const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
            let r = Math.random() * totalWeight;
            for (const item of pool) {
                r -= item.weight;
                if (r <= 0) {
                    variant = item.variant;
                    break;
                }
            }
        }
        
        // If all are disabled or weight total is 0, abort spawning (respect user preference)
        if (!variant) {
            console.warn("[Spawning] Aucun camp n'est activé ou tous les poids sont à 0. Spawning annulé.");
            return;
        }

        // Non-overlapping / Spaced-out spawn position finder
        let centerPos = null;
        let attempts = 0;
        const minDistanceToPlayer = 22.0;
        const minDistanceToOtherEnemies = 20.0;

        while (attempts < 50) {
            const candidate = randomWildSpawnPos();
            attempts++;

            // Distance to player check
            const biome = getRegionAt(candidate.x, candidate.z);
            let allowed = false;
            const bType = variant.buildingType;
            if (bType === 'frozen') {
                allowed = (biome === 'cold');
            } else if (bType === 'forge') {
                allowed = (biome === 'desert' || biome === 'mountain');
            } else if (bType === 'crypt' || bType === 'obelisk' || bType === 'ritual') {
                allowed = (biome === 'mountain' || biome === 'cold');
            } else {
                allowed = (biome === 'temperate');
            }

            if (!allowed && attempts < 40) {
                continue;
            }

            // Eviter de spawn trop près du boss zone (distance < 55) pour ne pas perturber le combat de boss
            const distToBoss = Math.hypot(candidate.x - BOSS_ZONE.cx, candidate.z - BOSS_ZONE.cz);
            if (distToBoss < 55) {
                continue;
            }

            let blockedByDecor = false;
            if (Globals.obstacles) {
                for (const o of Globals.obstacles) {
                    if (!o || !o.position) continue;
                    const dx = candidate.x - o.position.x;
                    const dz = candidate.z - o.position.z;
                    const keepout = (o.radius || 0) + 3.5;
                    if (dx * dx + dz * dz < keepout * keepout) {
                        blockedByDecor = true;
                        break;
                    }
                }
            }
            if (blockedByDecor) {
                continue;
            }

            if (Globals.player) {
                if (candidate.distanceTo(Globals.player.position) < minDistanceToPlayer) {
                    continue;
                }
            }

            // Distance to other active enemies check
            let tooClose = false;
            if (Globals.enemies) {
                for (const e of Globals.enemies) {
                    if (e.dead) continue;
                    if (candidate.distanceTo(e.position) < minDistanceToOtherEnemies) {
                        tooClose = true;
                        break;
                    }
                }
            }

            if (!tooClose) {
                centerPos = candidate;
                break;
            }
        }

        if (!centerPos) {
            centerPos = randomWildSpawnPos(); // Fallback
        }

        // Spawn building structure at the center
        let spawnedBuilding = false;
        let buildingData = null;
        if (variant.buildingType === 'tent') {
            buildingData = spawnRogueTent(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'portal') {
            buildingData = spawnArcanePortal(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'barricade') {
            buildingData = spawnSpikedBarricade(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'obelisk') {
            buildingData = spawnCorruptedObelisk(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'treasure') {
            buildingData = spawnTreasureOutpost(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'ritual') {
            buildingData = spawnShamanRitualCircle(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'crypt') {
            buildingData = spawnCursedCrypt(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'shrine') {
            buildingData = spawnDruidShrine(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'forge') {
            buildingData = spawnVolcanicForge(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'frozen') {
            buildingData = spawnFrozenSpire(centerPos);
            spawnedBuilding = true;
        } else if (variant.buildingType === 'ruins') {
            buildingData = spawnAncientRuins(centerPos);
            spawnedBuilding = true;
        }

        const campMobs = [];
        // Spawn enemies around the camp center
        variant.mobs.forEach((mobDef, idx) => {
            const angle = (idx / variant.mobs.length) * Math.PI * 2;
            // Radius is slightly larger if a building is spawned at center to avoid overlapping with it
            const r = spawnedBuilding ? (3.2 + Math.random() * 1.5) : (1.5 + Math.random() * 2.0);
            const spawnPos = centerPos.clone().add(new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
            
            const e = new Enemy(mobDef.type, spawnPos);
            if (mobDef.miniBoss) {
                applyMiniBossVariant(e, mobDef.miniBoss);
            }
            campMobs.push(e);
            addEnemy(e);
        });

        if (spawnedBuilding && buildingData) {
            Globals.activeCamps = Globals.activeCamps || [];
            Globals.activeCamps.push({
                building: buildingData.group,
                obstacle: buildingData.obstacle,
                mobs: campMobs
            });
        }
    },

    /** Debug : spawn Mini-Boss. tiers optionnel : 'champion|executeur' ou tableau. */
    spawnMiniBoss: function(miniId = 'random', tiers = null) {
        if (STATE.bossSpawned) {
            console.warn('[Debug] Impossible pendant un combat de boss.');
            return null;
        }
        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) {
            console.warn('[Debug] spawnMiniBoss : hôte uniquement en multijoueur.');
            return null;
        }
        if (!Globals.player) return null;

        const ids = Object.keys(MINI_BOSS_MOB_TYPE);
        let resolvedId = miniId;
        if (!miniId || miniId === 'random') {
            resolvedId = ids[Math.floor(Math.random() * ids.length)];
        }
        const mobType = MINI_BOSS_MOB_TYPE[resolvedId];
        if (!mobType) {
            console.warn(
                `[Debug] Mini-Boss inconnu: "${miniId}". Valides: ${ids.join(', ')}, random`,
            );
            return null;
        }

        const pos = Globals.player.position.clone();
        pos.x += 5;
        pos.z += (Math.random() - 0.5) * 3;
        pos.y = 0;

        const e = new Enemy(mobType, pos);
        applyMiniBossVariant(e, resolvedId, tiers ? { tiers } : {});
        addEnemy(e);
        return e;
    },

    spawnBoss: function(type = 'king') {
        if (STATE.bossSpawned) return;
        STATE.bossSpawned = true;
        STATE.isBossFight = true;
        STATE.enemiesKilled = 0;
        this.setAmbiance('dark');
        
        if (type === 'slime_lord') AudioSys.playBgm('boss_void');
        else AudioSys.playBgm('boss_king');
        
        if(AudioSys.sfx.bossSpawn) AudioSys.sfx.bossSpawn();

        // Nettoyage Ennemis & Autels
        for (let i = Globals.enemies.length - 1; i >= 0; i--) {
            const e = Globals.enemies[i];
            if (!e.isPlayer) {
                if(e.mesh) Globals.scene.remove(e.mesh);
                if(e instanceof THREE.Object3D) Globals.scene.remove(e);
                if(e.labelSprite) Globals.scene.remove(e.labelSprite);
                removeEnemy(e);
            }
        }
        for(let i = Globals.scene.children.length - 1; i >= 0; i--) {
            const child = Globals.scene.children[i];
            if(child.type === 'royal_seal' || child.type === 'void_altar' || (child.userData && (child.userData.type === 'royal_seal' || child.userData.type === 'void_altar'))) {
                Globals.scene.remove(child);
            }
        }

        if (Globals.player) Globals.player.position.set(BOSS_ZONE.cx, 0, BOSS_ZONE.cz + 14);
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'boss-teleport' });
        }

        const pos = new THREE.Vector3(BOSS_ZONE.cx, 0, BOSS_ZONE.cz - 6);
        const e = new Enemy(type, pos);
        addEnemy(e);

        const msg = type === 'king' ? "AETHELGARD EST LÀ !" : "LE SEIGNEUR SLIME APPROCHE !";
        const color = type === 'king' ? "#ffd700" : "#9b59b6";
        if (Globals.player) createDamageText(msg, Globals.player.position, color);
    },

    triggerWipe: function() {
        const overlay = document.getElementById('wipe-overlay');
        if (overlay) overlay.style.opacity = 1;

        if (STATE.multiplayer.active && STATE.multiplayer.isHost) { Network.send({ type: 'wipe-signal' }); }

        setTimeout(() => {
            if (Globals.player) {
                Globals.player.respawn();
                STATE.leftSafeZone = false;
            }

            Globals.enemies.forEach(e => {
                Globals.scene.remove(e);
                disposeEnemyResources(e);
            });
            Globals.enemies.length = 0;

            // Nettoie aussi les projectiles, télégraphes et particules restants du combat.
            for (let i = Globals.projectiles.length - 1; i >= 0; i--) {
                Globals.projectiles[i].destroy();
            }
            if (Globals.telegraphs) {
                for (const t of Globals.telegraphs) {
                    t.userData.onComplete = null; // plus de dégâts post-wipe
                    Globals.scene.remove(t);
                    t.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                    });
                }
                Globals.telegraphs.length = 0;
            }
            for (const p of Globals.particles) Globals.scene.remove(p.mesh);
            Globals.particles.length = 0;

            STATE.bossSpawned = false;
            STATE.isBossFight = false;
            this.setAmbiance('normal');
            AudioSys.playBgm('explore'); 
            
            removeBossArenaBarrier();
            createAltars();

            document.getElementById('boss-hud').style.display = 'none';
            document.getElementById('btn-respawn').style.display = 'block';
            document.getElementById('spectate-msg').style.display = 'none';

            if (overlay) setTimeout(() => overlay.style.opacity = 0, 500);
        }, 2000);
    },

    checkBossVictory: function() {
        if (STATE.isBossFight && STATE.bossSpawned) {
            const bossAlive = Globals.enemies.some(e => 
                !e.dead && 
                (e.isBoss || (e instanceof Enemy && (e.type === 'king' || e.type === 'slime_lord')))
            );
            
            if (!bossAlive) {
                console.log("BOSS VAINCU - VICTOIRE");
                STATE.bossSpawned = false;
                STATE.isBossFight = false;

                removeBossArenaBarrier();

                if (!STATE.bossProgress['king']) STATE.bossProgress['king'] = 0;
                STATE.bossProgress['king']++;
                const currentNG = STATE.bossProgress['king'];

                window.UI?.toast(`VICTOIRE ! ROI VAINCU (NG+${currentNG})`);
                
                this.gainXp(500 * (1 + currentNG * 0.2));

                AudioSys.playBgm('explore');
                this.setAmbiance('normal');
                
                setTimeout(() => {
                    window.UI?.toast("Les sceaux se reforment...");
                    createAltars();
                }, 4000);
            }
        }
    },

    startGameLogic: function() {
        document.querySelectorAll('.menu-screen').forEach(s => s.classList.remove('active'));
        document.getElementById('hud').style.display = 'block';
        document.getElementById('skills-hud').style.display = 'flex';
        document.getElementById('passive-hud').style.display = 'block';

        AudioSys.playBgm('explore'); 

        STATE.leftSafeZone = false;

        // --- APPLIQUER LES CONFIGURATIONS DE JEU SUR LE JOUEUR ---
        const hpMult = (STATE.gameOptions && STATE.gameOptions.playerHpMult !== undefined) ? STATE.gameOptions.playerHpMult : 1.0;
        STATE.stats.maxHp = Math.round(100 * hpMult);
        STATE.stats.hp = STATE.stats.maxHp;

        const startLvl = (STATE.gameOptions && STATE.gameOptions.startLevel !== undefined) ? STATE.gameOptions.startLevel : 1;
        STATE.level = startLvl;
        STATE.xp = 0;
        
        // Calculer l'XP requis pour le niveau
        const baseMobXp = 35 * (1 + STATE.level * 0.1);
        const killsNeeded = 3 + Math.min(5, STATE.level * 0.25);
        STATE.xpToNext = Math.floor(baseMobXp * killsNeeded);
        
        // Donner les points de compétences
        STATE.skillPoints = STATE.level - 1;
        STATE.unlockedNodes = [];
        STATE.fragments = [];
        STATE.enemiesKilled = 0;
        STATE.bossSpawned = false;
        STATE.isBossFight = false;

        // Augmenter l'attaque/défense de départ selon le niveau de départ
        STATE.stats.atk = 10;
        STATE.stats.defense = 10;
        for (let l = 1; l < STATE.level; l++) {
            if (STATE.class === 'warrior') {
                STATE.stats.defense += 2;
            } else {
                STATE.stats.atk += 2;
            }
        }

        const p = new Player(STATE.class);
        setPlayer(p);
        p.position.set(90, 0, 90);
        this.reapplyAllSkillBonuses();

        Globals.camera.position.set(90, 20, 100);
        Globals.camera.lookAt(90, 0, 90);

        setTimeout(() => {
            window.UI?.toast("Choisissez un Fragment de depart !");
            window.UI?.showPrismaticReward();
        }, 200);

        if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
    },

    reapplyAllSkillBonuses: function() {
        ConstellationEngine.recalculate();
        if (window.NewSkillUI?.updatePassiveDisplay) window.NewSkillUI.updatePassiveDisplay();
        if (window.BuffBar) window.BuffBar.render();
        window.UI?.updateHUD();
    },

    updateActiveCamps: function(dt) {
        if (!Globals.activeCamps || !Globals.activeCamps.length) return;

        const time = Date.now() * 0.003;
        // Un seul Set par frame : la version précédente relançait un scan linéaire de
        // Globals.enemies pour chaque mob de chaque camp, à chaque frame.
        const liveEnemies = new Set(Globals.enemies);
        for (let i = Globals.activeCamps.length - 1; i >= 0; i--) {
            const camp = Globals.activeCamps[i];

            // Check if all mobs in this camp are dead or removed from Globals.enemies
            const allDead = camp.mobs.every(m => m.dead || !liveEnemies.has(m));
            
            if (allDead) {
                // Despawn building with a shrink animation
                if (camp.building) {
                    const b = camp.building;
                    let lastShrink = performance.now();
                    const shrink = () => {
                        const nowT = performance.now();
                        const frameDt = Math.min((nowT - lastShrink) / 1000, 0.1);
                        lastShrink = nowT;
                        if (b.scale.x > 0.05) {
                            b.scale.multiplyScalar(Math.pow(0.85, frameDt * 60)); // Shrink out (indépendant du FPS)
                            requestAnimationFrame(shrink);
                        } else {
                            if (b.parent) b.parent.remove(b);
                            // Dispose geometries and materials
                            b.traverse(child => {
                                if (child.geometry) child.geometry.dispose();
                                if (child.material) {
                                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                                    else child.material.dispose();
                                }
                            });
                        }
                    };
                    shrink();
                }
                
                // Remove obstacle collision from Globals.obstacles
                if (camp.obstacle && Globals.obstacles) {
                    const idx = Globals.obstacles.indexOf(camp.obstacle);
                    if (idx > -1) {
                        Globals.obstacles.splice(idx, 1);
                    }
                }
                
                // Remove camp from active list
                Globals.activeCamps.splice(i, 1);
            } else if (camp.building && camp.building.userData.updateAnim) {
                camp.building.userData.updateAnim(time);
            }
        }
    },
    
    tryInteractLocal: function() {
        if (!Globals.player || STATE.bossSpawned) return;
        
        // Intercepter d'abord l'interaction avec un pilier du rituel
        for (let e of Globals.enemies) {
            if (e.type === 'boss_pillar' && Globals.player.position.distanceTo(e.position) < 5) {
                e.activate();
                return;
            }
        }

        let targetAltar = null;
        for (let m of Globals.menhirs) {
            if (Globals.player.position.distanceTo(m.position) < 6) { targetAltar = m; break; }
        }
        if (targetAltar) {
            if (targetAltar.type === 'royal_seal') {
                window.UI?.toast("Résolvez le rituel des 4 piliers pour réveiller le Souverain d'Ambre...");
                return;
            }

            const cost = targetAltar.userData.bossType === 'slime_lord' ? 20 : 10;
            if (STATE.enemiesKilled >= cost) {
                if (STATE.multiplayer.active) {
                    if (STATE.multiplayer.isHost) { 
                        this.spawnBoss(targetAltar.userData.bossType); 
                        Network.send({ type: 'boss-spawn', bossType: targetAltar.userData.bossType }); 
                    } else { 
                        Network.send({ type: 'request-boss', bossType: targetAltar.userData.bossType }); 
                    }
                } else { 
                    this.spawnBoss(targetAltar.userData.bossType); 
                }
            } else {
                window.UI?.toast(`Il faut ${cost} kills (Actuel: ${STATE.enemiesKilled})`);
            }
        }
    }
};

// Initialisation des GameActions globaux pour compatibilité
GameActions.spawnBoss = GameLogic.spawnBoss.bind(GameLogic);
GameActions.triggerWipe = GameLogic.triggerWipe.bind(GameLogic);
GameActions.startGameLogic = GameLogic.startGameLogic.bind(GameLogic);
GameActions.setAmbiance = GameLogic.setAmbiance.bind(GameLogic);
GameActions.gainXp = GameLogic.gainXp.bind(GameLogic);

export const GameLauncher = {
    launchHost: function () {
        if (STATE.multiplayer.active && STATE.multiplayer.isHost) {
            Network.send({ type: 'game-start-signal', gameOptions: STATE.gameOptions });
        }
        GameLogic.startGameLogic();
    },
    clientReady: function () {
        if (STATE.class) {
            document.getElementById('btn-ready-game').disabled = true;
            document.getElementById('waiting-host-msg').style.display = 'block';
            document.querySelector('.class-container-accordion').style.opacity = '0.5';
            document.querySelector('.class-container-accordion').style.pointerEvents = 'none';
            Network.send({ type: 'player-ready', class: STATE.class, id: STATE.multiplayer.id });
            window.UI?.toast("Prêt ! En attente de l'hôte...");
        }
    }
};