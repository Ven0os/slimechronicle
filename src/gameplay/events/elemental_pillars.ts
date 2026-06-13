// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText, spawnParticles } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';

// Variables globales pour le tracking souris
const mousePos = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); 

if (!window._pillarsMouseListener) {
    window.addEventListener('mousemove', (e) => {
        mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
        mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    window._pillarsMouseListener = true;
}

export const ElementalPillarsLogic = {
    spawn: function(manager, pos, netId = null) {
        if(manager.isActive) return;
        manager.isActive = true;

        const isHost = !STATE.multiplayer.active || STATE.multiplayer.isHost;
        const eventId = netId || EventUtils.generateNetId();

        if (isHost && !netId) {
            EventUtils.broadcast({ 
                type: 'event-spawn', 
                eventType: 'elemental_pillars', 
                pos: {x: pos.x, y: pos.y, z: pos.z}, 
                id: eventId 
            });
        }

        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = -10;
        group.userData.targetY = 0;
        group.userData.netId = eventId;
        
        const INTERACT_DIST = 20.0;
        group.userData.interactionRadius = INTERACT_DIST;

        // --- MATÉRIAUX ---
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, metalness: 0.1 });
        // Épée avec une lueur de base pour la visibilité
        const swordMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2, emissive: 0x002244, emissiveIntensity: 1 });
        
        // Tooltip unique
        const tooltip = document.createElement('div');
        tooltip.style.position = 'absolute';
        tooltip.style.background = 'rgba(0, 40, 60, 0.9)';
        tooltip.style.color = '#00aaff';
        tooltip.style.padding = '6px 10px';
        tooltip.style.borderRadius = '6px';
        tooltip.style.border = '1px solid #00aaff';
        tooltip.style.fontFamily = 'monospace';
        tooltip.style.fontWeight = 'bold';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.display = 'none';
        tooltip.style.zIndex = '2000';
        tooltip.innerHTML = "<span style='font-size:18px'>[F]</span> ORIENTER";
        document.body.appendChild(tooltip);

        // Anneau de sélection
        const selRingGeo = new THREE.RingGeometry(2.0, 2.2, 32);
        const selRingMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const selectionRing = new THREE.Mesh(selRingGeo, selRingMat);
        selectionRing.rotation.x = -Math.PI / 2;
        selectionRing.position.y = 0.2;
        selectionRing.visible = false;
        group.add(selectionRing);

        const linkGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const linkLine = new THREE.Line(linkGeo, new THREE.LineDashedMaterial({ color: 0x00aaff, dashSize: 0.5, gapSize: 0.2, scale: 1 }));
        linkLine.computeLineDistances();
        linkLine.visible = false;
        group.add(linkLine);

        // Effets Finaux
        const beamGeo = new THREE.CylinderGeometry(0.2, 0.2, 20, 8);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
        
        // Cône indicateur de direction (Permanent)
        const indicatorGeo = new THREE.ConeGeometry(0.1, 3.0, 8);
        indicatorGeo.rotateX(Math.PI / 2); // Pointer vers l'avant
        indicatorGeo.translate(0, 0, 1.5); // Devant l'épée
        const indicatorMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });

        // --- CONSTRUCTION DES STATUES ---
        const pillars = [];
        const offsets = [
            { x: 0, z: -5 }, // 0: Nord
            { x: 5, z: 0 },  // 1: Est
            { x: 0, z: 5 },  // 2: Sud
            { x: -5, z: 0 }  // 3: Ouest
        ];

        const createStatue = () => {
            const statueGroup = new THREE.Group();
            statueGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), stoneMat).translateY(0.25)); 
            statueGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.5), stoneMat).translateY(1.25)); 
            statueGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.6), stoneMat).translateY(2.6)); 
            statueGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), stoneMat).translateY(3.5)); 
            
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.2, 0.25), stoneMat);
            armL.position.set(-0.55, 2.6, 0); statueGroup.add(armL);
            
            const armRGroup = new THREE.Group();
            armRGroup.position.set(0.55, 3.0, 0); 
            const armR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.4, 0.25), stoneMat);
            armR.position.y = 0.7; armRGroup.add(armR);
            armRGroup.rotation.z = -0.2; armRGroup.rotation.x = 0.2;
            statueGroup.add(armRGroup);
            
            const swordGroup = new THREE.Group();
            swordGroup.position.y = 1.4; 
            swordGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.15), swordMat.clone())); // Matériel cloné pour émissif unique
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 0.05), swordMat.clone()); // Matériel cloné
            blade.position.y = 1.25; swordGroup.add(blade); 
            armRGroup.add(swordGroup);

            // Rayon Final (caché)
            const beam = new THREE.Mesh(beamGeo, beamMat.clone());
            beam.position.y = 10;
            beam.visible = false;
            statueGroup.add(beam);

            // Indicateur Direction (Toujours visible faiblement)
            const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
            indicator.position.y = 1.4; // Hauteur main
            armRGroup.add(indicator);

            return { mesh: statueGroup, sword: blade, beam: beam };
        };

        offsets.forEach((offset, i) => {
            const pGroup = new THREE.Group();
            pGroup.position.set(offset.x, 0, offset.z);

            const statueData = createStatue();
            const statueMesh = statueData.mesh;
            pGroup.add(statueMesh);
            group.add(pGroup);

            const startStep = 0; // Nord
            
            pGroup.userData = {
                id: i,
                visual: statueMesh, 
                step: startStep, 
                sword: statueData.sword,
                beam: statueData.beam,
                bumpAnim: 0 
            };
            
            statueMesh.rotation.y = startStep * (Math.PI / 4);
            pillars.push(pGroup);
        });

        // MÉLANGE DU PUZZLE (SCRAMBLE GARANTI SOLVABLE)
        if (isHost) { 
            const moves = 5 + Math.floor(Math.random() * 5);
            for(let k=0; k<moves; k++) {
                const idx = Math.floor(Math.random() * 4);
                // La règle : tourner i tourne aussi i+1
                pillars[idx].userData.step = (pillars[idx].userData.step + 1) % 8;
                pillars[(idx + 1) % 4].userData.step = (pillars[(idx + 1) % 4].userData.step + 1) % 8;
            }
            pillars.forEach(p => p.userData.visual.rotation.y = p.userData.step * (Math.PI / 4));
        }

        const label = EventUtils.createLabel("GARDIENS ANCESTRAUX", "LIEN MYSTIQUE : TOURNER L'UN TOURNE LE SUIVANT", "#00aaff");
        group.userData.label = label;

        let isFinished = false;
        let localLockedPillar = null;
        let lastNetSend = 0;
        let finishTimer = 0;
        let rewardGiven = false;

        // --- GESTION CLICK UNIFIÉE ---
        const onMouseDown = (e) => {
            if (!Globals.player || group.position.y < -0.5 || isFinished) return;

            if (localLockedPillar) {
                AudioSys.play('ui_back');
                localLockedPillar = null;
                UI.toast("Statue libérée");
            } else {
                group.updateMatrixWorld();
                let closest = null;
                let minDst = INTERACT_DIST;
                
                pillars.forEach(p => {
                    const worldP = new THREE.Vector3();
                    p.getWorldPosition(worldP);
                    const dist = Globals.player.position.distanceTo(worldP);
                    if (dist < minDst) { minDst = dist; closest = p; }
                });
                
                if (closest) {
                    AudioSys.play('ui_click');
                    localLockedPillar = closest;
                    UI.toast("Statue Verrouillée");
                }
            }
        };
        window._pillarsMouseListenerRef = onMouseDown;
        window.addEventListener('mousedown', onMouseDown);

        // --- UPDATE LOOP ---
        group.userData.update = (dt) => {
            if(!group.parent) {
                if(tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
                if (window._pillarsMouseListenerRef) {
                    window.removeEventListener('mousedown', window._pillarsMouseListenerRef);
                    window._pillarsMouseListenerRef = null;
                }
                return;
            }

            EventUtils.handleVerticalAnim(manager, group, label, dt);
            EventUtils.updateLabel(group, label, 30);
            
            // --- FEEDBACK D'ALIGNEMENT EN TEMPS RÉEL ---
            if (!isFinished) {
                pillars.forEach((p, i) => {
                    // Vérifie l'alignement avec le voisin de droite (sens du lien)
                    const neighbor = pillars[(i + 1) % 4];
                    const isAlignedWithNeighbor = p.userData.step === neighbor.userData.step;
                    
                    // Si aligné avec voisin, brille fort (Cyan), sinon faible (Bleu foncé)
                    if (isAlignedWithNeighbor) {
                        p.userData.sword.material.emissive.setHex(0x00ffff);
                        p.userData.sword.material.emissiveIntensity = 2.0 + Math.sin(Date.now()*0.005)*0.5;
                    } else {
                        p.userData.sword.material.emissive.setHex(0x002244);
                        p.userData.sword.material.emissiveIntensity = 0.5;
                    }
                });
            }

            // --- ANIMATION DE FINALE ---
            if(isFinished) {
                finishTimer += dt;
                tooltip.style.display = 'none';
                selectionRing.visible = false;
                linkLine.visible = false;
                
                // Alignement visuel forcé vers la direction commune
                const refStep = pillars[0].userData.step;
                const targetAngle = refStep * (Math.PI / 4);

                pillars.forEach(p => {
                    // Force l'orientation parfaite
                    const visual = p.userData.visual;
                    let current = visual.rotation.y;
                    let diff = targetAngle - current;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    
                    if (Math.abs(diff) > 0.001) visual.rotation.y += diff * 10 * dt;
                    else visual.rotation.y = targetAngle;

                    // Effets
                    p.userData.sword.material.emissive.setHex(0xffffff); // Blanc pur
                    p.userData.sword.material.emissiveIntensity = 3 + Math.sin(finishTimer * 15);
                    
                    p.userData.beam.visible = true;
                    p.userData.beam.material.opacity = Math.min(finishTimer, 1.0) * 0.8;
                    p.userData.beam.scale.x = 1 + Math.sin(finishTimer * 20) * 0.2;
                    p.userData.beam.scale.z = 1 + Math.sin(finishTimer * 20) * 0.2;
                });

                if (Math.random() < 0.3) {
                    const rndP = pillars[Math.floor(Math.random()*4)];
                    spawnParticles(rndP.position.clone().add(group.position).add(new THREE.Vector3(0,4,0)), 0x00aaff, 5);
                }

                if (finishTimer >= 3.0 && !rewardGiven) {
                    rewardGiven = true;
                    ElementalPillarsLogic.end(manager, group, label, eventId);
                }
                return;
            }

            // 1. LOGIQUE DE ROTATION (Basée sur Entiers)
            if (localLockedPillar && Globals.player) {
                raycaster.setFromCamera(mousePos, Globals.camera);
                const intersect = new THREE.Vector3();
                raycaster.ray.intersectPlane(plane, intersect);
                
                const pPos = localLockedPillar.position.clone().add(group.position);
                const dx = intersect.x - pPos.x;
                const dz = intersect.z - pPos.z;
                
                let rawAngle = Math.atan2(dx, dz);
                if(rawAngle < 0) rawAngle += Math.PI * 2;

                let currentStep = Math.round(rawAngle / (Math.PI / 4)) % 8;
                
                if (currentStep !== localLockedPillar.userData.step) {
                    let diff = currentStep - localLockedPillar.userData.step;
                    if (diff > 4) diff -= 8;
                    if (diff < -4) diff += 8;

                    const idx = localLockedPillar.userData.id;
                    const neighbor = pillars[(idx + 1) % 4];

                    localLockedPillar.userData.step = (localLockedPillar.userData.step + diff + 8) % 8;
                    neighbor.userData.step = (neighbor.userData.step + diff + 8) % 8;

                    localLockedPillar.userData.bumpAnim = 1.0;
                    neighbor.userData.bumpAnim = 1.0;

                    AudioSys.play('ui_hover');
                    spawnParticles(localLockedPillar.position.clone().add(group.position).add(new THREE.Vector3(0, 0.5, 0)), 0x888888, 5);
                    spawnParticles(neighbor.position.clone().add(group.position).add(new THREE.Vector3(0, 0.5, 0)), 0x00aaff, 5);
                }

                linkLine.visible = true;
                const positions = linkLine.geometry.attributes.position.array;
                const playPos = Globals.player.position.clone().sub(group.position).add(new THREE.Vector3(0,1,0));
                const pillarTop = localLockedPillar.position.clone().add(new THREE.Vector3(0, 3, 0));
                positions[0] = playPos.x; positions[1] = playPos.y; positions[2] = playPos.z;
                positions[3] = pillarTop.x; positions[4] = pillarTop.y; positions[5] = pillarTop.z;
                linkLine.geometry.attributes.position.needsUpdate = true;
                linkLine.computeLineDistances();

                if (Date.now() - lastNetSend > 100) { 
                    lastNetSend = Date.now();
                    const states = pillars.map(p => ({id: p.userData.id, step: p.userData.step}));
                    if(isHost) EventUtils.broadcast({ type: 'event-update', id: eventId, pillars: states });
                    else Network.send({ type: 'event-interact', id: eventId, pillars: states });
                }
            } else {
                linkLine.visible = false;
            }

            // 2. TOOLTIP & HIGHLIGHT
            let closestPillar = null;
            let minDistance = INTERACT_DIST;

            if (Globals.player && group.position.y > -0.5) {
                group.updateMatrixWorld();
                pillars.forEach(p => {
                    const worldP = new THREE.Vector3();
                    p.getWorldPosition(worldP);
                    const dist = Globals.player.position.distanceTo(worldP);
                    if (dist < minDistance) { minDistance = dist; closestPillar = p; }
                });
            }

            if (closestPillar) {
                selectionRing.visible = true;
                selectionRing.position.x = closestPillar.position.x;
                selectionRing.position.z = closestPillar.position.z;
                selectionRing.material.color.setHex(localLockedPillar === closestPillar ? 0x00ff00 : 0x00aaff);
                const s = 1.0 + Math.sin(Date.now() * 0.005) * 0.1;
                selectionRing.scale.set(s, s, s);

                const worldP = new THREE.Vector3();
                closestPillar.getWorldPosition(worldP);
                const screenPos = worldP.clone().add(new THREE.Vector3(0, 4.0, 0)).project(Globals.camera);
                const x = (screenPos.x * .5 + .5) * window.innerWidth;
                const y = (-(screenPos.y * .5) + .5) * window.innerHeight;

                tooltip.style.display = 'block';
                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
                tooltip.style.transform = 'translate(-50%, -50%)';

                if (localLockedPillar === closestPillar) {
                    tooltip.innerHTML = "<span style='color:#00ff00'>VERROUILLÉ</span> <br><span style='font-size:10px; color:#aaa'>CLIC / F POUR LIBÉRER</span>";
                    tooltip.style.borderColor = "#00ff00";
                    tooltip.style.color = "#00ff00";
                } else if (localLockedPillar) {
                    tooltip.style.display = 'none'; 
                } else {
                    tooltip.innerHTML = "<span style='color:#00aaff'>[F] / CLIC</span> ORIENTER";
                    tooltip.style.borderColor = "#00aaff";
                    tooltip.style.color = "#00aaff";
                }
            } else {
                tooltip.style.display = 'none';
                selectionRing.visible = false;
            }

            // 3. ANIMATION VISUELLE
            pillars.forEach(p => {
                const visual = p.userData.visual;
                
                if (p.userData.bumpAnim > 0) {
                    p.userData.bumpAnim -= dt * 5; 
                    if(p.userData.bumpAnim < 0) p.userData.bumpAnim = 0;
                    visual.position.y = Math.sin(p.userData.bumpAnim * Math.PI) * 0.2; 
                } else {
                    visual.position.y = 0;
                }

                let targetAngle = p.userData.step * (Math.PI / 4);
                let currentAngle = visual.rotation.y;

                let diff = targetAngle - currentAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;

                if(Math.abs(diff) > 0.001) {
                    visual.rotation.y += diff * 15 * dt;
                }
            });

            // 4. CHECK VICTOIRE
            if (isHost && !isFinished) {
                const refStep = pillars[0].userData.step;
                const allAligned = pillars.every(p => p.userData.step === refStep);

                if (allAligned) {
                    isFinished = true;
                    EventUtils.broadcast({ type: 'event-update', id: eventId, action: 'finish_anim' });
                }
            }
        };

        group.userData.interact = () => { onMouseDown(); };

        group.userData.onNetUpdate = (data) => {
            if (data.pillars) {
                data.pillars.forEach(pData => {
                    const p = pillars[pData.id];
                    if (p && (!localLockedPillar || p !== localLockedPillar)) {
                        if (p.userData.step !== pData.step) p.userData.bumpAnim = 1.0;
                        p.userData.step = pData.step;
                    }
                });
            }
            if (data.action === 'finish_anim') {
                isFinished = true;
            }
        };

        group.userData.cleanup = () => {
            if (tooltip && tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
            if (window._pillarsMouseListenerRef) {
                window.removeEventListener('mousedown', window._pillarsMouseListenerRef);
                window._pillarsMouseListenerRef = null;
            }
            EventUtils.disposeGroup(group);
        };

        Globals.scene.add(group);
        manager.interactables.push(group);
        if(isHost) UI.toast("Les Gardiens sont liés...");
    },

    end: function(manager, group, label, eventId) {
        spawnParticles(group.position, 0x00aaff, 300); 
        UI.toast("Alignement Complété !");
        AudioSys.play('ui_levelup');

        if(!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            const rarities = ['common', 'uncommon', 'rare', 'epic'];
            const rarity = rarities[Math.floor(Math.random() * rarities.length)];
            if(window.Debug) window.Debug.givePrism(rarity);
            if(STATE.multiplayer.active) EventUtils.broadcast({ type: 'prismatic-trigger', rarity: rarity });
        }
        
        manager.dismissEvent(group, label);
    }
};