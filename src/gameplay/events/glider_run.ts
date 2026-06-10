// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText, spawnParticles } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';

export const GliderRunLogic = {
    spawn: function(manager, pos, netId = null) {
        if(manager.isActive) return;
        manager.isActive = true;

        const isHost = !STATE.multiplayer.active || STATE.multiplayer.isHost;
        const eventId = netId || EventUtils.generateNetId();

        if (isHost && !netId) {
            EventUtils.broadcast({ 
                type: 'event-spawn', 
                eventType: 'glider_run', 
                pos: {x: pos.x, y: pos.y, z: pos.z}, 
                id: eventId 
            });
        }

        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = -10;
        group.userData.targetY = 0;
        group.userData.netId = eventId;

        // --- STATION MÉDIÉVALE ---
        const platformGroup = new THREE.Group();
        group.add(platformGroup);

        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 1.0 });

        const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 4, 8), stoneMat);
        towerBase.position.y = 2;
        platformGroup.add(towerBase);

        const towerTop = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3, 0.5, 8), stoneMat);
        towerTop.position.y = 4.25;
        platformGroup.add(towerTop);

        const plankGeo = new THREE.BoxGeometry(2, 0.2, 6);
        const plank = new THREE.Mesh(plankGeo, woodMat);
        plank.position.set(0, 4.5, -2); 
        platformGroup.add(plank);

        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3);
        const flagGeo = new THREE.PlaneGeometry(1, 0.6);
        const flagMat = new THREE.MeshBasicMaterial({ color: 0xaa0000, side: THREE.DoubleSide });

        const p1 = new THREE.Mesh(poleGeo, woodMat); p1.position.set(-2, 5.5, 1); platformGroup.add(p1);
        const f1 = new THREE.Mesh(flagGeo, flagMat); f1.position.set(-1.5, 6.5, 1); platformGroup.add(f1);
        const p2 = new THREE.Mesh(poleGeo, woodMat); p2.position.set(2, 5.5, 1); platformGroup.add(p2);
        const f2 = new THREE.Mesh(flagGeo, flagMat); f2.position.set(2.5, 6.5, 1); platformGroup.add(f2);

        // --- TOOLTIP ---
        const tooltip = document.createElement('div');
        tooltip.style.position = 'absolute';
        tooltip.style.background = 'rgba(20, 10, 5, 0.9)';
        tooltip.style.color = '#ffaa00';
        tooltip.style.padding = '10px 15px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.border = '2px solid #8B4513';
        tooltip.style.fontFamily = "'Cinzel', serif";
        tooltip.style.fontWeight = 'bold';
        tooltip.style.fontSize = '16px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.display = 'none';
        tooltip.style.zIndex = '2000';
        tooltip.style.boxShadow = '0 5px 15px rgba(0,0,0,0.5)';
        tooltip.innerHTML = "<i class='fas fa-feather-alt'></i> [F] S'ENVOLER";
        document.body.appendChild(tooltip);

        // --- HUD EXPEDITION 33 STYLE ---
        const hud = document.createElement('div');
        hud.style.position = 'absolute';
        hud.style.left = '30px';
        hud.style.top = '50%';
        hud.style.transform = 'translateY(-50%)';
        hud.style.display = 'none';
        hud.style.fontFamily = "'Cinzel', serif";
        hud.style.color = '#e0e0e0';
        hud.style.pointerEvents = 'none';
        hud.style.zIndex = '1000';
        
        hud.innerHTML = `
            <div style="
                background: linear-gradient(135deg, rgba(15,15,20,0.95) 0%, rgba(25,25,35,0.85) 100%);
                padding: 30px;
                border-left: 5px solid #d4af37;
                border-top: 1px solid rgba(212, 175, 55, 0.3);
                border-bottom: 1px solid rgba(212, 175, 55, 0.3);
                border-radius: 0 15px 15px 0;
                width: 260px;
                box-shadow: 10px 10px 30px rgba(0,0,0,0.6);
                display: flex; flex-direction: column; gap: 20px;
                backdrop-filter: blur(5px);
            ">
                <div style="border-bottom: 1px solid rgba(212, 175, 55, 0.5); padding-bottom: 15px; margin-bottom: 5px; display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 24px; color: #d4af37;"><i class="fas fa-wind"></i></div>
                    <div>
                        <div style="font-size: 10px; color: #aaa; letter-spacing: 2px;">EXPEDITION</div>
                        <div style="font-size: 16px; color: #fff; letter-spacing: 1px; font-weight: bold;">SKYSKIMMER</div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;"><i class="fas fa-mountain"></i> ALTITUDE</div>
                    <div style="font-size: 28px; font-weight: 300; color: #fff;">
                        <span id="hud-alt">0</span> <span style="font-size: 12px; color: #d4af37;">M</span>
                    </div>
                </div>

                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;"><i class="fas fa-tachometer-alt"></i> VÉLOCITÉ</div>
                        <div style="font-size: 28px; color: #00ffff; text-shadow: 0 0 10px rgba(0,255,255,0.5);">
                            <span id="hud-spd">0</span> <span style="font-size: 12px;">KM/H</span>
                        </div>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                        <div id="hud-spd-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #d4af37 0%, #00ffff 100%); transition: width 0.1s linear;"></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-top: 15px; gap: 10px;">
                    <div style="flex: 1; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; text-align: center; border: 1px solid rgba(255,68,68,0.3);">
                        <div style="font-size: 10px; color: #ff6666; margin-bottom: 2px;">TEMPS</div>
                        <div style="font-size: 24px; font-weight: bold; color: #fff;" id="hud-time">00</div>
                    </div>
                    <div style="flex: 1; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; text-align: center; border: 1px solid rgba(212,175,55,0.3);">
                        <div style="font-size: 10px; color: #d4af37; margin-bottom: 2px;">ANNEAUX</div>
                        <div style="font-size: 24px; font-weight: bold; color: #fff;" id="hud-rings">0 / 8</div>
                    </div>
                </div>
                
                <div style="text-align:center; font-size:12px; color:#aaa; margin-top:5px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                    [Q] GAUCHE &nbsp;&nbsp;&bull;&nbsp;&nbsp; [D] DROITE &nbsp;&nbsp;&bull;&nbsp;&nbsp; [ESPACE] PLONGER
                </div>
            </div>
        `;
        document.body.appendChild(hud);

        const label = EventUtils.createLabel("TOUR D'ENVOL", "ÉPREUVE DES CIEUX", "#ffaa00");
        group.userData.label = label;

        // --- VARIABLES ---
        let isGliding = false;
        let isLaunching = false;
        let isLanding = false;
        let isFinishing = false; // Phase finale de retour automatique
        let launchTime = 0;
        let flightTime = 0;
        let finishTimer = 0;
        const MAX_TIME = 45;
        let speed = 0;
        let rings = [];
        let score = 0;
        let gliderMesh = null;
        let playerRef = null;
        
        let yaw = 0; 
        let roll = 0; 

        let originalUpdate = null;
        let originalUseSkill = null;
        let originalFov = 75;

        // Input Clavier
        const keys = { left: false, right: false, drop: false };
        const onKeyDown = (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyQ') keys.left = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
            if (e.code === 'Space') keys.drop = true; 
        };
        const onKeyUp = (e) => {
            if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyQ') keys.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
            if (e.code === 'Space') keys.drop = false;
        };

        // --- VISUEL DU PLANEUR MÉDIÉVAL FANTASY ---
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

        const createMedievalRing = () => {
            const rGroup = new THREE.Group();
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, flatShading: true });
            const runeMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc }); 
            const goldMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.8, roughness: 0.3 });
            const radius = 3.5;
            for(let i=0; i<8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const block = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.0, 0.6), stoneMat);
                block.position.set(Math.cos(angle)*radius, Math.sin(angle)*radius, 0); block.rotation.z = angle;
                const rune = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.1), runeMat); rune.position.set(0, 0, 0.31); block.add(rune); rGroup.add(block);
            }
            const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.15, 8, 64), goldMat); rGroup.add(ring);
            const inner = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.1, side: THREE.DoubleSide })); rGroup.add(inner);
            return rGroup;
        };

        const generateTrack = (startPos) => {
            rings.forEach(r => Globals.scene.remove(r));
            rings = [];

            let currentPos = startPos.clone();
            // DIRECTION NORD (Z-)
            let direction = new THREE.Vector3(0, 0, -1).applyQuaternion(group.quaternion).normalize();
            
            currentPos.add(direction.clone().multiplyScalar(40));

            // SEULEMENT 10 ANNEAUX
            for(let i=0; i<10; i++) {
                const visual = createMedievalRing();
                const ringGroup = new THREE.Group();
                ringGroup.position.copy(currentPos);
                
                const backPoint = currentPos.clone().sub(direction); 
                ringGroup.lookAt(backPoint);
                ringGroup.add(visual);

                ringGroup.userData = { id: i, collected: false, boost: true, visual: visual };
                Globals.scene.add(ringGroup);
                rings.push(ringGroup);

                const distStep = 35; 
                const turn = (Math.random() - 0.5) * 0.2; 
                direction.applyAxisAngle(new THREE.Vector3(0,1,0), turn);
                direction.normalize();
                
                currentPos.add(direction.clone().multiplyScalar(distStep));
                currentPos.y -= 2.0 + Math.random() * 2.0; 
            }
        };

        group.userData.interact = () => {
            if(!Globals.player || isGliding || isLaunching || isLanding || isFinishing) return;
            
            isLaunching = true;
            launchTime = 0;
            playerRef = Globals.player;
            flightTime = MAX_TIME;
            score = 0;
            
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);

            originalUpdate = playerRef.update;
            originalUseSkill = playerRef.useSkill;
            if(Globals.camera) originalFov = Globals.camera.fov;

            playerRef.update = (dt) => {
                if (playerRef.mixer) playerRef.mixer.update(dt);
                playerRef.isMoving = false;
                playerRef.bodyGroup.rotation.x = 0; 
            };
            playerRef.useSkill = () => {};

            // Positionnement Rampe (Z-)
            const rampStart = group.position.clone().add(new THREE.Vector3(0, 4.5, 0));
            // On veut regarder vers l'avant (Z- du monde / Z+ du groupe si non tourné)
            const rampDir = new THREE.Vector3(0, 0, -1).applyQuaternion(group.quaternion).normalize();
            
            playerRef.position.copy(rampStart);
            
            // Rotation du joueur pour faire face à -Z (rampDir)
            // Math.atan2(x, z) : Pour (0, -1), atan2(0, -1) = PI (180deg) ou -PI
            const targetRot = Math.atan2(rampDir.x, rampDir.z);
            playerRef.mesh.rotation.y = targetRot;
            
            speed = 0;
            yaw = targetRot;
            roll = 0;
            
            gliderMesh = createGliderMesh();
            gliderMesh.visible = false; 
            playerRef.mesh.add(gliderMesh);
            
            // Hauteur 40m
            const flightHeight = 40;
            const startFlightPos = group.position.clone().add(new THREE.Vector3(0, flightHeight, 0)).add(rampDir.clone().multiplyScalar(10));
            generateTrack(startFlightPos);

            UI.toast("ASCENSION...");
            label.style.display = 'none';
            tooltip.style.display = 'none';
            hud.style.display = 'block'; 
        };

        group.userData.update = (dt) => {
            EventUtils.handleVerticalAnim(manager, group, label, dt);
            
            if(Globals.player && !isGliding && !isLaunching && !isLanding && !isFinishing && group.position.y > -0.5) {
                const dist = Globals.player.position.distanceTo(group.position);
                if (dist < 8.0) {
                    const screenPos = group.position.clone().add(new THREE.Vector3(0, 6, 0)).project(Globals.camera);
                    const x = (screenPos.x * .5 + .5) * window.innerWidth;
                    const y = (-(screenPos.y * .5) + .5) * window.innerHeight;
                    tooltip.style.display = 'block';
                    tooltip.style.left = x + 'px';
                    tooltip.style.top = y + 'px';
                    tooltip.style.transform = 'translate(-50%, -50%)';
                } else {
                    tooltip.style.display = 'none';
                }
                EventUtils.updateLabel(group, label, 40);
            } else {
                tooltip.style.display = 'none';
            }

            if (!playerRef) return;

            // --- PHASE 1 : ASCENSION ---
            if (isLaunching) {
                launchTime += dt;
                
                const targetH = 45.0; 
                const startH = 4.5;
                const duration = 3.0;
                
                if (launchTime < duration) {
                    const progress = launchTime / duration;
                    const ease = 1 - Math.pow(1 - progress, 3);
                    const currentH = startH + (targetH - startH) * ease;
                    playerRef.position.y = group.position.y + currentH;
                    
                    if (Globals.camera) {
                        // Caméra derrière et un peu en bas pour l'effet "décollage"
                        const backOffset = new THREE.Vector3(0, 2, 6).applyQuaternion(playerRef.mesh.quaternion); 
                        const idealCamPos = playerRef.position.clone().add(backOffset);
                        Globals.camera.position.lerp(idealCamPos, dt * 2.0);
                        const lookTarget = playerRef.position.clone().add(new THREE.Vector3(0, 5, 0));
                        Globals.camera.lookAt(lookTarget);
                    }
                    if (Math.random() < 0.3) spawnParticles(playerRef.position, 0x00ffff, 2);
                } else {
                    isLaunching = false;
                    isGliding = true;
                    speed = 25.0; 
                    gliderMesh.visible = true; 
                    playerRef.bodyGroup.rotation.x = 1.0; 
                    
                    if(Globals.camera) {
                        Globals.camera.fov = 100; 
                        Globals.camera.updateProjectionMatrix();
                    }
                    
                    UI.toast("VOL LIBRE !");
                }
                return;
            }
            
            // --- PHASE 4: RETOUR À L'ORIGINE (SMOOTH) ---
            if (isFinishing) {
                finishTimer += dt;
                
                // Cible: (0,0,0) avec orientation neutre
                const targetPos = new THREE.Vector3(0, 0, 0);
                const currentPos = playerRef.position.clone();
                const distToOrigin = currentPos.distanceTo(targetPos);
                
                // Vitesse de retour (plus on est loin, plus on va vite, mais smooth à la fin)
                const returnSpeed = Math.min(distToOrigin, 50.0) * dt * 0.5;
                
                playerRef.position.lerp(targetPos, dt * 0.5); // Lerp doux
                
                // Orientation vers 0,0,0
                if (distToOrigin > 1.0) {
                     const targetLook = new THREE.Vector3(0, playerRef.position.y, 0);
                     playerRef.mesh.lookAt(targetLook);
                }
                
                // Redresse le corps
                playerRef.bodyGroup.rotation.x = THREE.MathUtils.lerp(playerRef.bodyGroup.rotation.x, 0, dt);
                playerRef.mesh.rotation.z = THREE.MathUtils.lerp(playerRef.mesh.rotation.z, 0, dt);
                
                // Atterrissage final
                if (playerRef.position.y < 0.2 || finishTimer > 10.0) {
                     GliderRunLogic.finish(true, "ATTERRISSAGE RÉUSSI");
                } else if (distToOrigin < 2.0) {
                     // Force descente si proche x/z
                     playerRef.position.y -= dt * 5.0;
                }
                
                // Caméra Suivi
                 if(Globals.camera) {
                    const offset = new THREE.Vector3(0, 5, 10).applyQuaternion(playerRef.mesh.quaternion);
                    const camPos = playerRef.position.clone().add(offset);
                    Globals.camera.position.lerp(camPos, dt * 2.0);
                    Globals.camera.lookAt(playerRef.position);
                    // Reset FOV
                    Globals.camera.fov = THREE.MathUtils.lerp(Globals.camera.fov, originalFov, dt);
                    Globals.camera.updateProjectionMatrix();
                }

                return;
            }

            // --- PHASE 3 : ATTERRISSAGE (CRASH/ECHEC) ---
            if (isLanding) {
                const groundY = 0;
                const descentSpeed = 5.0 * dt;
                
                if (playerRef.position.y > groundY + 0.5) {
                    playerRef.position.y -= descentSpeed;
                    yaw += 1.0 * dt;
                    playerRef.mesh.rotation.y = yaw;
                    
                    const forward = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
                    playerRef.position.add(forward.multiplyScalar(5 * dt));
                    
                    if(Globals.camera) {
                        const camOffset = new THREE.Vector3(0, 8, 8).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
                        const camPos = playerRef.position.clone().add(camOffset);
                        Globals.camera.position.lerp(camPos, dt * 3.0);
                        Globals.camera.lookAt(playerRef.position);
                        Globals.camera.fov = THREE.MathUtils.lerp(Globals.camera.fov, originalFov, dt);
                        Globals.camera.updateProjectionMatrix();
                    }
                } else {
                    GliderRunLogic.finish(score >= 8); // Condition de victoire
                }
                return;
            }

            if (!isGliding) return;

            // --- PHASE 2 : VOL ---
            flightTime -= dt;

            // Contrôle Directionnel
            const TURN_SPEED = 2.5;
            if (keys.left) yaw += TURN_SPEED * dt; 
            if (keys.right) yaw -= TURN_SPEED * dt; 

            const targetRoll = (keys.left ? 0.8 : 0) + (keys.right ? -0.8 : 0);
            roll = THREE.MathUtils.lerp(roll, targetRoll, dt * 3.0);
            
            // Caméra Poursuite (Corrigée pour -Z forward)
            if (Globals.camera) {
                const distBehind = 7.0; 
                const heightAbove = 3.0; 
                
                // Si Yaw = PI (Face au Nord/-Z).
                // On veut être derrière le joueur qui regarde le Nord (-Z), on doit être au Sud (+Z).
                // Donc offset local Z doit être positif.
                const camOffset = new THREE.Vector3(0, heightAbove, distBehind); 
                camOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
                
                const targetPos = playerRef.position.clone().add(camOffset);
                Globals.camera.position.lerp(targetPos, dt * 10.0);
                
                // Regarde devant (Z négatif localement)
                const forwardView = new THREE.Vector3(0, 0, -20).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
                const lookTarget = playerRef.position.clone().add(forwardView);
                Globals.camera.lookAt(lookTarget);
            }

            if (keys.drop) {
                speed += 20.0 * dt; 
                playerRef.position.y -= 15.0 * dt; 
                playerRef.mesh.rotation.x = 0.8; 
            } else {
                if (speed > 25) speed -= dt * 5.0; 
                else speed = 25; 
                playerRef.position.y -= 1.5 * dt; 
                playerRef.mesh.rotation.x = 0.2; 
            }

            // Mouvement : On utilise (0,0,-1) comme base avant
            const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
            playerRef.position.add(forward.multiplyScalar(speed * dt));

            playerRef.mesh.rotation.order = "YXZ";
            playerRef.mesh.rotation.y = yaw;
            playerRef.mesh.rotation.z = roll;

            rings.forEach(r => {
                if(r.userData.collected || !r.userData.boost) return; 
                
                if(r.userData.visual) r.userData.visual.rotation.z += dt * 0.5;

                if(playerRef.position.distanceTo(r.position) < 5.0) {
                    r.userData.collected = true;
                    if(r.userData.visual) {
                         r.userData.visual.children.forEach(c => {
                             if(c.material) c.material.color.setHex(0x00ff00);
                         });
                    }
                    speed = 50.0; 
                    playerRef.position.y += 4.0; 
                    score++;
                    AudioSys.play('ui_hover'); 
                    spawnParticles(r.position, 0x00ff00, 30);
                    createDamageText("BOOST!", playerRef.position, '#00ff00');
                }
            });

            const timerTxt = Math.ceil(flightTime);
            document.getElementById('hud-alt').innerText = Math.floor(playerRef.position.y);
            document.getElementById('hud-spd').innerText = Math.floor(speed * 3.6);
            document.getElementById('hud-time').innerText = timerTxt < 10 ? `0${timerTxt}` : timerTxt;
            document.getElementById('hud-rings').innerText = `${score} / 8`;
            const spdPcent = Math.min((speed / 50) * 100, 100);
            document.getElementById('hud-spd-bar').style.width = `${spdPcent}%`;

            if (playerRef.position.y < 2.0 || flightTime <= 0) {
                isGliding = false;
                isLanding = true;
                UI.toast("RETOUR AU SOL...");
            }
            
            // VICTOIRE ANTICIPÉE SI 8 ANNEAUX
            if (score >= 8) {
                isGliding = false;
                isFinishing = true; // Lance le retour à 0,0,0
                finishTimer = 0;
                UI.toast("OBJECTIF ATTEINT ! RETOUR BASE...");
            }
        };

        GliderRunLogic.finish = (win) => {
            isLanding = false;
            isFinishing = false;
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);

            if (playerRef) {
                if(gliderMesh) playerRef.mesh.remove(gliderMesh);
                if (originalUpdate) playerRef.update = originalUpdate;
                if (originalUseSkill) playerRef.useSkill = originalUseSkill;
                playerRef.bodyGroup.rotation.x = 0;
                playerRef.mesh.rotation.set(0, 0, 0); 
                playerRef.position.y = 0; 
                playerRef.isMoving = false; 
            }
            
            if(Globals.camera) {
                Globals.camera.fov = originalFov;
                Globals.camera.updateProjectionMatrix();
            }
            
            gliderMesh = null;
            originalUpdate = null;
            originalUseSkill = null;

            rings.forEach(r => Globals.scene.remove(r));
            rings = [];

            label.style.display = 'none';
            tooltip.style.display = 'none';
            hud.style.display = 'none'; 

            if(win) {
                UI.toast("COURSE RÉUSSIE !");
                if(playerRef) spawnParticles(playerRef.position, 0x00ffff, 100);
                AudioSys.play('ui_levelup');
                if(window.Debug) window.Debug.givePrism('rare');
                if(isHost) EventUtils.broadcast({ type: 'prismatic-trigger', rarity: 'rare' });
            } else {
                UI.toast("ÉCHEC DE LA COURSE");
            }
            
            playerRef = null;
        };

        Globals.scene.add(group);
        manager.interactables.push(group);
        if(isHost) UI.toast("Tour de Guet repérée !");
    }
};