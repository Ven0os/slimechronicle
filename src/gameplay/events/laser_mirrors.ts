// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText, spawnParticles } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';

// Utilitaires RNG
class RNG {
    constructor(seed) {
        this.m = 0x80000000;
        this.a = 1103515245;
        this.c = 12345;
        this.state = seed || 1234;
    }
    nextFloat() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state / (this.m - 1);
    }
    range(min, max) {
        return Math.floor(this.nextFloat() * (max - min + 1)) + min;
    }
}

// Variables globales au module pour le tracking souris
const mousePos = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plan sol Y=0

if (!window._laserMouseListener) {
    window.addEventListener('mousemove', (e) => {
        mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    window._laserMouseListener = true;
}

export const LaserMirrorsLogic = {
    spawn: function(manager, pos, netId = null) {
        if(manager.isActive) return;
        manager.isActive = true;

        const isHost = !STATE.multiplayer.active || STATE.multiplayer.isHost;
        const eventId = netId || EventUtils.generateNetId();

        if (isHost && !netId) {
            EventUtils.broadcast({ type: 'event-spawn', eventType: 'laser_mirrors', pos: {x: pos.x, y: pos.y, z: pos.z}, id: eventId });
        }

        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = -10;
        group.userData.targetY = 0;
        group.userData.netId = eventId;
        
        // LIMITATION DISTANCE
        const INTERACT_DIST = 25.0;
        group.userData.interactionRadius = INTERACT_DIST; 

        let seedVal = 0;
        for(let i=0; i<eventId.length; i++) seedVal = ((seedVal << 5) - seedVal) + eventId.charCodeAt(i);
        const rng = new RNG(Math.abs(seedVal));

        // --- GÉNÉRATION (GRID 5x5) ---
        const GRID_SIZE = 5;
        const TILE_SIZE = 3.5; 
        const gridOffset = (GRID_SIZE * TILE_SIZE) / 2 - (TILE_SIZE / 2);
        
        const mirrors = []; 
        const blockers = []; 
        let layout = []; 
        let criticalPath = [];

        // BOUCLE DE GÉNÉRATION ROBUSTE
        let attempts = 0;
        let success = false;

        while(attempts < 50 && !success) {
            attempts++;
            layout = [];
            for(let x=0; x<GRID_SIZE; x++) { layout[x] = []; for(let z=0; z<GRID_SIZE; z++) layout[x][z] = null; }
            criticalPath = [];

            let cx = rng.range(0, GRID_SIZE-1);
            let cz = 0; 
            let dir = {x: 0, z: 1};

            layout[cx][cz] = 'source';
            
            const steps = rng.range(8, 14); 
            let stepsCount = 0;

            for(let i=0; i<steps; i++) {
                const nextX = cx + dir.x;
                const nextZ = cz + dir.z;
                
                if(nextX < 0 || nextX >= GRID_SIZE || nextZ < 0 || nextZ >= GRID_SIZE) break;
                if(layout[nextX][nextZ]) break;

                cx = nextX;
                cz = nextZ;
                stepsCount++;

                if (i === steps - 1) {
                    layout[cx][cz] = 'target';
                } else {
                    layout[cx][cz] = 'mirror';
                    criticalPath.push({x: cx, z: cz});
                    
                    if(dir.x === 0) { 
                        dir.x = (rng.nextFloat() > 0.5) ? 1 : -1; dir.z = 0; 
                    } else { 
                        dir.x = 0; dir.z = (rng.nextFloat() > 0.5) ? 1 : -1; 
                    }
                }
            }

            if (stepsCount >= 6 && layout[cx][cz] === 'mirror') {
                layout[cx][cz] = 'target'; 
                success = true;
            } else if (stepsCount >= 6 && layout[cx][cz] === 'target') {
                success = true;
            }
        }

        if (!success) {
            layout[0][0] = 'source'; layout[0][1] = 'mirror'; layout[1][1] = 'target';
        }

        // REMPLISSAGE AGRESSIF (Densité Max)
        for(let x=0; x<GRID_SIZE; x++) {
            for(let z=0; z<GRID_SIZE; z++) {
                if(!layout[x][z]) {
                    const r = rng.nextFloat();
                    // 80% de chance d'être un bloqueur pour couper les lignes de vue directes (était 60%)
                    if(r < 0.80) layout[x][z] = 'blocker'; 
                    else layout[x][z] = 'mirror'; // Leurre
                }
            }
        }

        // --- VISUELS ---
        const goldMat = new THREE.MeshStandardMaterial({color: 0xffd700, metalness: 1.0, roughness: 0.2});
        const stoneMat = new THREE.MeshStandardMaterial({color: 0x222222, roughness: 0.8});
        const blockerMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 1.0, metalness: 0.5}); 
        const crystalMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x0088ff, emissiveIntensity: 1, transparent: true, opacity: 0.8 });
        const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xaaccff, metalness: 1.0, roughness: 0.0, envMapIntensity: 1.0 });

        let sourceObj = null;
        let targetObj = null;
        const BEAM_HEIGHT = 2.0; 

        const tooltip = document.createElement('div');
        tooltip.style.position = 'absolute';
        tooltip.style.background = 'rgba(0, 20, 40, 0.9)';
        tooltip.style.color = '#00ffff';
        tooltip.style.padding = '6px 10px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.border = '1px solid #00ffff';
        tooltip.style.fontFamily = 'monospace';
        tooltip.style.fontWeight = 'bold';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.display = 'none';
        tooltip.style.zIndex = '2000';
        tooltip.innerHTML = "<span style='font-size:18px'>[F]</span> PIVOTER";
        document.body.appendChild(tooltip);

        const selRingGeo = new THREE.RingGeometry(1.8, 2.0, 32);
        const selRingMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const selectionRing = new THREE.Mesh(selRingGeo, selRingMat);
        selectionRing.rotation.x = -Math.PI / 2;
        selectionRing.position.y = 0.2;
        selectionRing.visible = false;
        group.add(selectionRing);

        for(let x=0; x<GRID_SIZE; x++) {
            for(let z=0; z<GRID_SIZE; z++) {
                const type = layout[x][z];
                if(!type) continue;
                const lx = x * TILE_SIZE - gridOffset;
                const lz = z * TILE_SIZE - gridOffset;

                if (type === 'source') {
                    const sGroup = new THREE.Group();
                    sGroup.position.set(lx, 0, lz);
                    sGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 1, 4), stoneMat));
                    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.5, 6), stoneMat);
                    pillar.position.y = 1.0; sGroup.add(pillar);
                    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3 }));
                    crystal.position.y = BEAM_HEIGHT; sGroup.add(crystal);
                    sGroup.userData.crystal = crystal;
                    group.add(sGroup);
                    sourceObj = sGroup;
                } 
                else if (type === 'target') {
                    const tGroup = new THREE.Group();
                    tGroup.position.set(lx, 0, lz);
                    tGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.5, 16), stoneMat));
                    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000 }));
                    core.position.y = BEAM_HEIGHT; tGroup.add(core);
                    const rings = [];
                    for(let r=0; r<3; r++) {
                        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0 + r*0.3, 0.08, 8, 32), goldMat);
                        ring.position.y = BEAM_HEIGHT; tGroup.add(ring); rings.push(ring);
                    }
                    tGroup.userData = { core: core, rings: rings };
                    group.add(tGroup);
                    targetObj = tGroup;
                } 
                else if (type === 'blocker') {
                    const bGroup = new THREE.Group();
                    bGroup.position.set(lx, 0, lz);
                    
                    const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 2.2), stoneMat);
                    bGroup.add(baseBlock);
                    
                    for(let i=0; i<4; i++) {
                        const w = 1.8 - (i*0.1);
                        const h = 1.0;
                        const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), stoneMat);
                        block.position.y = 0.6 + (i * h) + (h/2);
                        block.rotation.y = (rng.nextFloat() - 0.5) * 0.3;
                        bGroup.add(block);
                    }
                    
                    const top = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), stoneMat);
                    top.position.y = 4.8;
                    top.rotation.x = rng.nextFloat();
                    bGroup.add(top);
                    
                    blockers.push(bGroup);
                    group.add(bGroup);
                }
                else if (type === 'mirror') {
                    const mGroup = new THREE.Group();
                    mGroup.position.set(lx, 0, lz);
                    
                    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.2, 8), stoneMat);
                    base1.position.y = 0.1; mGroup.add(base1);
                    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 0.2, 8), stoneMat);
                    base2.position.y = 0.3; mGroup.add(base2);
                    
                    const rotor = new THREE.Group();
                    rotor.position.y = 0.4; mGroup.add(rotor);

                    const pillarGeo = new THREE.BoxGeometry(0.15, 2.0, 0.15);
                    const leftP = new THREE.Mesh(pillarGeo, goldMat); leftP.position.set(-0.9, 1.0, 0); rotor.add(leftP);
                    const rightP = new THREE.Mesh(pillarGeo, goldMat); rightP.position.set(0.9, 1.0, 0); rotor.add(rightP);

                    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.1), goldMat); 
                    frame.position.y = 1.6; 
                    rotor.add(frame);
                    
                    const surface = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), mirrorMat); 
                    surface.position.set(0, 1.6, 0.06); rotor.add(surface);
                    
                    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), stoneMat); 
                    back.rotation.y = Math.PI; back.position.set(0, 1.6, -0.06); rotor.add(back);
                    
                    const topGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), crystalMat); 
                    topGem.position.y = 2.7; rotor.add(topGem);

                    mGroup.userData = { 
                        id: mirrors.length, 
                        rotor: rotor, 
                        gem: topGem,
                        targetRot: rng.nextFloat() * Math.PI * 2,
                        isCritical: false
                    };
                    
                    if (criticalPath.some(p => p.x === x && p.z === z)) mGroup.userData.isCritical = true;

                    rotor.rotation.y = mGroup.userData.targetRot;
                    mirrors.push(mGroup);
                    group.add(mGroup);
                }
            }
        }

        mirrors.forEach(m => {
            if(m.userData.isCritical) {
                m.userData.targetRot = rng.nextFloat() * Math.PI * 2;
                m.userData.rotor.rotation.y = m.userData.targetRot;
            }
        });

        // --- LASER SYSTEM ---
        const laserSegments = [];
        const MAX_SEGMENTS = 60; 
        const segmentMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
        
        for(let i=0; i<MAX_SEGMENTS; i++) {
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 8), segmentMat);
            seg.rotation.x = Math.PI/2; seg.visible = false;
            group.add(seg);
            laserSegments.push(seg);
        }

        const impactLight = new THREE.PointLight(0xff0000, 3, 8);
        group.add(impactLight);
        const impactMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({color: 0xffaaaa}));
        group.add(impactMesh);

        const label = EventUtils.createLabel("RÉFLEXION ARCANIQUE", "MAINTENEZ LE LASER SUR LA CIBLE (3s)", "#00ffff");
        group.userData.label = label;

        const linkGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const linkLine = new THREE.Line(linkGeo, new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 0.5, gapSize: 0.2, scale: 1 }));
        linkLine.computeLineDistances();
        linkLine.visible = false;
        group.add(linkLine);

        let rewardGiven = false;
        let localLockedMirror = null;
        let lastNetSend = 0;
        let winHoldTime = 0; // Timer pour la victoire

        // --- GESTION CLICK UNIFIÉE ---
        const onMouseDown = (e) => {
            if (!Globals.player || group.position.y < -0.5) return;

            if (localLockedMirror) {
                AudioSys.play('ui_back');
                localLockedMirror = null;
                UI.toast("Miroir libéré");
            } else {
                group.updateMatrixWorld();
                let closest = null;
                let minDst = INTERACT_DIST;
                
                mirrors.forEach(m => {
                    const worldP = new THREE.Vector3();
                    m.getWorldPosition(worldP);
                    const dist = Globals.player.position.distanceTo(worldP);
                    if (dist < minDst) { minDst = dist; closest = m; }
                });
                
                if (closest) {
                    AudioSys.play('ui_click');
                    localLockedMirror = closest;
                    UI.toast("Miroir Verrouillé");
                }
            }
        };
        // CLEANUP REF
        window._laserMouseListenerRef = onMouseDown;
        window.addEventListener('mousedown', onMouseDown);

        // --- LOGIQUE PHYSIQUE ---
        const updateLaserPhysics = () => {
            if(!sourceObj) return { points: [], hitTarget: false };

            let points = [];
            let origin = sourceObj.position.clone().add(new THREE.Vector3(0, BEAM_HEIGHT, 0));
            let direction = new THREE.Vector3(0, 0, 1); 

            points.push(origin.clone());

            let bounces = 0;
            let hitTarget = false;
            let currentPos = origin.clone();
            let currentDir = direction.clone();
            let hitPosFinal = null;
            let lastMirrorHit = null; 

            while(bounces < 30) {
                let closestDist = 999;
                let hitMirror = null;
                let hitObjType = null; 

                if(targetObj) {
                    const targetCenter = targetObj.position.clone().add(new THREE.Vector3(0, BEAM_HEIGHT, 0));
                    const vecToTarget = targetCenter.clone().sub(currentPos);
                    const proj = vecToTarget.dot(currentDir);
                    if(proj > 0.1) {
                        const perpDist = vecToTarget.clone().sub(currentDir.clone().multiplyScalar(proj)).length();
                        if(perpDist < 1.0 && proj < closestDist) { closestDist = proj; hitObjType = 'target'; }
                    }
                }

                mirrors.forEach(m => {
                    if (m === lastMirrorHit && closestDist > 2.0) return; 
                    const center = m.position.clone().add(new THREE.Vector3(0, BEAM_HEIGHT, 0));
                    const vec = center.clone().sub(currentPos);
                    const proj = vec.dot(currentDir);
                    if(proj > 0.1) {
                        const perpDist = vec.clone().sub(currentDir.clone().multiplyScalar(proj)).length();
                        if(perpDist < 1.0 && proj < closestDist) { closestDist = proj; hitMirror = m; hitObjType = 'mirror'; }
                    }
                });

                blockers.forEach(b => {
                    const center = b.position.clone().add(new THREE.Vector3(0, 2.0, 0)); 
                    const vec = center.clone().sub(currentPos);
                    const proj = vec.dot(currentDir);
                    if(proj > 0.1) {
                        const perpDist = vec.clone().sub(currentDir.clone().multiplyScalar(proj)).length();
                        if(perpDist < 1.3 && proj < closestDist) { closestDist = proj; hitObjType = 'blocker'; }
                    }
                });

                if(hitObjType) {
                    const hitPoint = currentPos.clone().add(currentDir.clone().multiplyScalar(closestDist));
                    points.push(hitPoint);
                    hitPosFinal = hitPoint;
                    
                    if(hitObjType === 'target') {
                        hitTarget = true; break;
                    } else if (hitObjType === 'blocker') {
                        break;
                    } else if (hitObjType === 'mirror' && hitMirror) {
                        const rotorRot = hitMirror.userData.rotor.rotation.y;
                        const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotorRot);
                        
                        let dot = currentDir.dot(normal);
                        if (dot > 0) { normal.negate(); dot = -dot; }
                        if (Math.abs(dot) < 0.1) break;

                        const reflection = currentDir.clone().sub(normal.clone().multiplyScalar(2 * dot)).normalize();
                        currentPos = hitPoint.clone().add(reflection.clone().multiplyScalar(0.05)); 
                        currentDir = reflection;
                        lastMirrorHit = hitMirror;
                        bounces++;
                    }
                } else {
                    const endPoint = currentPos.clone().add(currentDir.clone().multiplyScalar(40));
                    points.push(endPoint);
                    hitPosFinal = endPoint; break;
                }
            }
            return { points, hitTarget, hitPosFinal };
        };

        // --- UPDATE LOOP ---
        group.userData.update = (dt) => {
            if(!group.parent) { 
                if(tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
                if (window._laserMouseListenerRef) {
                    window.removeEventListener('mousedown', window._laserMouseListenerRef);
                    window._laserMouseListenerRef = null;
                }
                return;
            }

            EventUtils.handleVerticalAnim(manager, group, label, dt);
            EventUtils.updateLabel(group, label, 30);
            const t = Date.now() * 0.001;

            if(sourceObj) {
                sourceObj.userData.crystal.position.y = BEAM_HEIGHT + Math.sin(t * 3) * 0.2;
                sourceObj.userData.crystal.rotation.y += dt;
            }

            // 1. LOCK
            if (localLockedMirror && Globals.player) {
                raycaster.setFromCamera(mousePos, Globals.camera);
                const intersect = new THREE.Vector3();
                raycaster.ray.intersectPlane(plane, intersect);
                
                const mPos = localLockedMirror.position.clone().add(group.position); 
                const dx = intersect.x - mPos.x;
                const dz = intersect.z - mPos.z;
                const angle = Math.atan2(dx, dz); 
                
                localLockedMirror.userData.rotor.rotation.y = angle; 
                localLockedMirror.userData.targetRot = angle;

                linkLine.visible = true;
                const positions = linkLine.geometry.attributes.position.array;
                const pPos = Globals.player.position.clone().sub(group.position).add(new THREE.Vector3(0,1,0));
                const mTop = localLockedMirror.position.clone().add(new THREE.Vector3(0, 3, 0));
                positions[0] = pPos.x; positions[1] = pPos.y; positions[2] = pPos.z;
                positions[3] = mTop.x; positions[4] = mTop.y; positions[5] = mTop.z;
                linkLine.geometry.attributes.position.needsUpdate = true;
                linkLine.computeLineDistances();

                if (Date.now() - lastNetSend > 100) { 
                    lastNetSend = Date.now();
                    if(isHost) EventUtils.broadcast({ type: 'event-update', id: eventId, mid: localLockedMirror.userData.id, rot: angle });
                    else Network.send({ type: 'event-interact', id: eventId, mid: localLockedMirror.userData.id, rot: angle });
                }
            } else {
                linkLine.visible = false;
            }

            // 2. TOOLTIP
            let closestMirror = null;
            let minDistance = INTERACT_DIST; 

            if (Globals.player && group.position.y > -0.5) {
                group.updateMatrixWorld();
                mirrors.forEach(m => {
                    const worldP = new THREE.Vector3();
                    m.getWorldPosition(worldP);
                    const dist = Globals.player.position.distanceTo(worldP);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestMirror = m;
                    }
                });
            }

            if (closestMirror) {
                selectionRing.visible = true;
                selectionRing.position.x = closestMirror.position.x;
                selectionRing.position.z = closestMirror.position.z;
                selectionRing.material.color.setHex(localLockedMirror === closestMirror ? 0x00ff00 : 0x00ffff);
                const s = 1.0 + Math.sin(t * 8) * 0.1;
                selectionRing.scale.set(s, s, s);

                const worldP = new THREE.Vector3();
                closestMirror.getWorldPosition(worldP);
                const screenPos = worldP.clone().add(new THREE.Vector3(0, 3.5, 0)).project(Globals.camera);
                const x = (screenPos.x * .5 + .5) * window.innerWidth;
                const y = (-(screenPos.y * .5) + .5) * window.innerHeight;

                tooltip.style.display = 'block';
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
                tooltip.style.transform = 'translate(-50%, -50%)';
                
                if (localLockedMirror === closestMirror) {
                    tooltip.innerHTML = "<span style='color:#00ff00'>VERROUILLÉ</span> <br><span style='font-size:10px; color:#aaa'>CLIC / F POUR LIBÉRER</span>";
                    tooltip.style.borderColor = "#00ff00";
                    tooltip.style.color = "#00ff00";
                } else if (localLockedMirror) {
                    tooltip.style.display = 'none'; 
                } else {
                    tooltip.innerHTML = "<span style='color:#00ffff'>[F] / CLIC</span> CONTRÔLER";
                    tooltip.style.borderColor = "#00ffff";
                    tooltip.style.color = "#00ffff";
                }
            } else {
                tooltip.style.display = 'none';
                selectionRing.visible = false;
            }

            mirrors.forEach(m => {
                if (m !== localLockedMirror) {
                    const diff = m.userData.targetRot - m.userData.rotor.rotation.y;
                    if(Math.abs(diff) > 0.001) m.userData.rotor.rotation.y += diff * 15 * dt;
                }
                m.userData.gem.position.y = 2.4 + Math.sin(t * 3 + m.userData.id) * 0.1;
            });

            // 4. LASER
            const laserData = updateLaserPhysics();
            laserSegments.forEach(s => s.visible = false);

            if(laserData && laserData.points.length > 1) {
                if(laserData.hitPosFinal) {
                    impactLight.position.copy(laserData.hitPosFinal);
                    impactMesh.position.copy(laserData.hitPosFinal);
                    impactMesh.visible = true;
                    impactLight.intensity = 2 + Math.sin(t*20);
                    impactMesh.scale.setScalar(1 + Math.sin(t*15)*0.3);
                    if(Math.random() < 0.2) spawnParticles(laserData.hitPosFinal.clone().add(group.position), 0xff0000, 1);
                } else {
                    impactLight.intensity = 0; impactMesh.visible = false;
                }

                for(let i=0; i < laserData.points.length - 1; i++) {
                    if(i >= MAX_SEGMENTS) break;
                    const p1 = laserData.points[i];
                    const p2 = laserData.points[i+1];
                    const seg = laserSegments[i];
                    const dist = p1.distanceTo(p2);
                    const center = p1.clone().add(p2).multiplyScalar(0.5);
                    seg.position.copy(center);
                    seg.scale.y = dist; 
                    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
                    seg.visible = true;
                    const thick = 1 + Math.sin(t*10 + i)*0.2;
                    seg.scale.x = thick; seg.scale.z = thick;
                }

                // VALIDATION DE LA VICTOIRE (CHARGE 3s)
                if(laserData.hitTarget && targetObj) {
                    if (!rewardGiven) {
                        winHoldTime += dt;
                        
                        // Feedback visuel de charge
                        const progress = Math.min(winHoldTime / 3.0, 1.0);
                        const core = targetObj.userData.core;
                        
                        // Change de couleur et vibre
                        core.material.emissive.setHSL(0.3, 1.0, 0.5 * progress); // Vert qui s'intensifie
                        core.scale.setScalar(1.0 + Math.sin(Date.now() * 0.05) * 0.2 * progress);
                        
                        // Spin rapide
                        targetObj.userData.rings.forEach((r, i) => { 
                            r.rotation.x += dt * (3 + i + (progress * 5)); 
                            r.material.emissive.setHex(0xffaa00); 
                        });

                        if(isHost && winHoldTime >= 3.0) {
                             rewardGiven = true; 
                             LaserMirrorsLogic.win(manager, group, label, mirrors, tooltip, targetObj);
                             EventUtils.broadcast({ type: 'event-end', id: eventId, win: true });
                        }
                    }
                } else if (targetObj) {
                    // Reset si le laser est perdu
                    winHoldTime = 0;
                    targetObj.userData.core.material.emissive.setHex(0x000000);
                    targetObj.userData.core.scale.setScalar(1);
                    targetObj.userData.rings.forEach(r => r.material.emissive.setHex(0x000000));
                }
            }
        };

        // --- INTERACTION [F] ---
        group.userData.interact = () => {
            onMouseDown();
        };

        group.userData.onNetUpdate = (data) => {
            if(data.mid !== undefined && data.rot !== undefined) {
                const m = mirrors[data.mid];
                if(m && m !== localLockedMirror) {
                    m.userData.targetRot = data.rot;
                }
            }
        };

        group.userData.cleanup = () => {
            if (tooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
            if (window._laserMouseListenerRef) {
                window.removeEventListener('mousedown', window._laserMouseListenerRef);
                window._laserMouseListenerRef = null;
            }
            EventUtils.disposeGroup(group);
        };

        Globals.scene.add(group);
        manager.interactables.push(group);
        if(isHost) UI.toast("Système de Réflexion Activé !");
    },

    win: function(manager, group, label, mirrors, tooltip, targetObj) {
        spawnParticles(group.position, 0x00ffff, 100);
        AudioSys.play('ui_levelup');
        UI.toast("Séquence Complétée !");
        
        if(tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
        if (window._laserMouseListenerRef) {
            window.removeEventListener('mousedown', window._laserMouseListenerRef);
            window._laserMouseListenerRef = null;
        }

        if (targetObj) {
            const prismGeo = new THREE.OctahedronGeometry(1.5, 0);
            const prismMat = new THREE.MeshStandardMaterial({
                color: 0x00ffff, 
                emissive: 0x00ffff, 
                emissiveIntensity: 5,
                wireframe: true
            });
            const prism = new THREE.Mesh(prismGeo, prismMat);
            prism.position.copy(targetObj.position);
            prism.position.y += 4;
            group.add(prism);

            let animTime = 0;
            const animInterval = setInterval(() => {
                if(!group.parent) { clearInterval(animInterval); return; }
                animTime += 0.05;
                prism.rotation.y += 0.1;
                prism.rotation.x += 0.05;
                prism.position.y += 0.05;
                prism.scale.setScalar(1 + Math.sin(animTime * 5) * 0.2);

                if (animTime > 2.0) {
                    clearInterval(animInterval);
                    spawnParticles(prism.position.clone().add(group.position), 0xffffff, 200);
                    group.remove(prism);
                    
                    if(!STATE.multiplayer.active || STATE.multiplayer.isHost) {
                        const rarities = ['uncommon', 'rare', 'epic'];
                        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
                        if(window.Debug) window.Debug.givePrism(rarity);
                        if(STATE.multiplayer.active) EventUtils.broadcast({ type: 'prismatic-trigger', rarity: rarity });
                    }
                    manager.dismissEvent(group, label);
                }
            }, 50);
        } else {
            manager.dismissEvent(group, label);
        }
    }
};

/*
        const createGliderMesh = () => {
            const g = new THREE.Group();
            
            // Matériaux
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9, flatShading: true }); // Bois sombre
            const fabricMat = new THREE.MeshStandardMaterial({ 
                color: 0xdddddd, side: THREE.DoubleSide, roughness: 1.0, emissive: 0x222222 // Toile blanche sale
            });
            const goldMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.8, roughness: 0.3 }); // Or antique

            // 1. Structure centrale (Poutre)
            const beam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 3.5), woodMat);
            beam.position.set(0, 1.8, 0.2);
            g.add(beam);

            // 2. Ailes "Chauve-souris" en bois et toile
            const wingShape = new THREE.Shape();
            wingShape.moveTo(0, 0);
            wingShape.lineTo(-3.0, 0.5); // Pointe avant
            wingShape.quadraticCurveTo(-2.5, -1.0, -1.8, -1.5); // Bord de fuite courbé
            wingShape.quadraticCurveTo(-1.0, -1.0, 0, -1.2); // Retour au centre
            
            const wingLGeo = new THREE.ShapeGeometry(wingShape);
            const wingL = new THREE.Mesh(wingLGeo, fabricMat);
            wingL.rotation.x = -Math.PI / 2;
            wingL.position.set(0, 1.8, 0.5);
            g.add(wingL);

            // Aile Droite (Symétrie manuelle pour éviter problèmes de normales)
            // On clone et on scale -1 sur X
            const wingR = wingL.clone();
            wingR.scale.x = -1;
            // Pour corriger l'éclairage sur un scale négatif, on peut inverser le winding order si besoin, 
            // mais side:DoubleSide sur le material suffit souvent.
            g.add(wingR);

            // Armature des ailes (Bois)
            const sparL = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.08), woodMat);
            sparL.position.set(-1.4, 1.81, 0.6);
            sparL.rotation.z = 0.15; // Légère inclinaison
            g.add(sparL);
            const sparR = sparL.clone();
            sparR.position.set(1.4, 1.81, 0.6);
            sparR.rotation.z = -0.15;
            g.add(sparR);

            // 3. Queue (Empennage)
            const tailGeo = new THREE.BufferGeometry();
            const tailVertices = new Float32Array([
                0, 0, 0,   -0.8, 0, -1.2,   0.8, 0, -1.2
            ]);
            tailGeo.setAttribute('position', new THREE.BufferAttribute(tailVertices, 3));
            const tail = new THREE.Mesh(tailGeo, fabricMat);
            tail.position.set(0, 1.8, -1.2);
            g.add(tail);

            // 4. Détails Dorés (Ornements)
            const ornamentGeo = new THREE.ConeGeometry(0.15, 0.4, 4);
            const ornL = new THREE.Mesh(ornamentGeo, goldMat);
            ornL.rotation.x = -Math.PI/2;
            ornL.position.set(-3.0, 1.8, 0.6); // Bout d'aile
            g.add(ornL);
            const ornR = ornL.clone();
            ornR.position.set(3.0, 1.8, 0.6);
            g.add(ornR);

            // 5. Poignées
            const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0), woodMat);
            handleBar.rotation.z = Math.PI/2;
            handleBar.position.set(0, 1.3, 0.4); 
            g.add(handleBar);

            // Liens verticaux (Cordes/Bois)
            const strutL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5), woodMat);
            strutL.position.set(-0.3, 1.55, 0.4);
            g.add(strutL);
            const strutR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5), woodMat);
            strutR.position.set(0.3, 1.55, 0.4);
            g.add(strutR);

            return g;
        };
*/