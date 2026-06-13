// @ts-nocheck
import { Globals, GameActions } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText, spawnParticles } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';

export const LightRitualLogic = {
    spawn: function(manager, pos, netId = null) {
        if(manager.isActive) return;
        manager.isActive = true;

        const isHost = !STATE.multiplayer.active || STATE.multiplayer.isHost;
        const eventId = netId || EventUtils.generateNetId();

        // 1. CHANGEMENT D'AMBIANCE (DARK)
        if(GameActions.setAmbiance) GameActions.setAmbiance('dark');

        if (isHost && !netId) {
            EventUtils.broadcast({ type: 'event-spawn', eventType: 'light_ritual', pos: {x: pos.x, y: pos.y, z: pos.z}, id: eventId });
        }

        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = -10;
        group.userData.targetY = 0;
        group.userData.netId = eventId;

        // --- VISUELS ---
        // 1. La Flamme Sacrée (Super Animée)
        const flameGroup = new THREE.Group();
        flameGroup.position.y = 0.5;
        
        // Coeur blanc/jaune
        const flameCoreGeo = new THREE.ConeGeometry(0.3, 1.2, 8);
        const flameCoreMat = new THREE.MeshBasicMaterial({color: 0xffffaa});
        const flameCore = new THREE.Mesh(flameCoreGeo, flameCoreMat);
        flameCore.position.y = 0.6;
        flameGroup.add(flameCore);

        // Corps orange principal
        const flameMainGeo = new THREE.ConeGeometry(0.6, 2.0, 8);
        const flameMainMat = new THREE.MeshStandardMaterial({
            color: 0xff8800, 
            emissive: 0xff4400, 
            emissiveIntensity: 4, 
            transparent: true, 
            opacity: 0.9
        });
        const flameMain = new THREE.Mesh(flameMainGeo, flameMainMat);
        flameMain.position.y = 0.8;
        flameGroup.add(flameMain);

        // Enveloppe rouge externe
        const flameOuterGeo = new THREE.ConeGeometry(0.9, 2.5, 8);
        const flameOuterMat = new THREE.MeshStandardMaterial({
            color: 0xff0000, 
            emissive: 0xff0000, 
            emissiveIntensity: 2, 
            transparent: true, 
            opacity: 0.4,
            wireframe: false
        });
        const flameOuter = new THREE.Mesh(flameOuterGeo, flameOuterMat);
        flameOuter.position.y = 0.8;
        flameGroup.add(flameOuter);

        // Socle
        const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 0.5, 16), new THREE.MeshStandardMaterial({color: 0x222}));
        base.position.y = 0.25;
        group.add(base);
        group.add(flameGroup);

        const centerLight = new THREE.PointLight(0xffaa00, 5, 15);
        centerLight.position.y = 2;
        group.add(centerLight);

        // Particules de braises pour la flamme
        const embers = [];
        for(let i=0; i<10; i++) {
            const ember = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({color: 0xffff00}));
            ember.position.set((Math.random()-0.5), 1 + Math.random(), (Math.random()-0.5));
            ember.userData = { speedY: 0.5 + Math.random(), offset: Math.random() * 10 };
            flameGroup.add(ember);
            embers.push(ember);
        }

        // 2. Les Lanternes
        const lanterns = [];
        const lanternDist = 4.0;
        const interactRadius = 6.0; 
        
        // Création des tooltips pour chaque lanterne
        const lanternTooltips = [];

        const createLanternTooltip = () => {
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.background = 'rgba(0, 0, 0, 0.8)';
            div.style.color = '#ffff00';
            div.style.padding = '4px 8px';
            div.style.borderRadius = '4px';
            div.style.border = '1px solid #ffff00';
            div.style.fontFamily = 'monospace';
            div.style.fontSize = '12px';
            div.style.fontWeight = 'bold';
            div.style.pointerEvents = 'none';
            div.style.display = 'none'; // Caché par défaut
            div.style.zIndex = '1001';
            div.innerText = "[F] ACTIVER";
            document.body.appendChild(div);
            return div;
        };
        
        for(let i=0; i<3; i++) {
            const baseAngle = (i / 3) * Math.PI * 2;
            const lGroup = new THREE.Group();
            
            lGroup.position.set(Math.cos(baseAngle)*lanternDist, 1.5, Math.sin(baseAngle)*lanternDist);
            lGroup.rotation.y = -baseAngle + Math.PI/2; 

            // Poteau
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2), new THREE.MeshStandardMaterial({color: 0x555}));
            lGroup.add(pole);

            // Lanterne tête
            const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4), new THREE.MeshStandardMaterial({color: 0x888, emissive: 0x000000}));
            head.position.y = 1.0;
            lGroup.add(head);

            // Cône de lumière (Attack visual)
            const coneGeo = new THREE.ConeGeometry(3.5, 9, 32, 1, true, 0, Math.PI * 0.7); 
            const coneMat = new THREE.MeshBasicMaterial({color: 0xffffaa, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false});
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.rotation.x = -Math.PI/2;
            cone.rotation.z = -Math.PI * 0.35;
            cone.position.y = -1.0; 
            lGroup.add(cone);

            lGroup.userData = { 
                id: i, 
                baseAngle: baseAngle, 
                currentAngle: baseAngle,
                activeTimer: 0, 
                cooldown: 0,
                head: head,
                cone: cone,
                coneMat: coneMat,
                tooltip: createLanternTooltip()
            };
            lanterns.push(lGroup);
            group.add(lGroup);
        }

        group.userData.shadows = []; 
        const label = EventUtils.createLabel("RITUEL DE LUMIÈRE", "APPROCHEZ D'UNE LAMPE POUR COMMENCER", "#ffaa00");
        group.userData.label = label;

        // --- LOGIQUE ---
        let hp = 100;
        let timeElapsed = 0;
        let waveTimer = 0;
        let isFinished = false;
        let hasStarted = false; // Le jeu ne commence que quand on s'approche
        const TOTAL_TIME = 30;  // 30 secondes MAX

        group.userData.activateLantern = (id) => {
            const lantern = lanterns[id];
            if(lantern.userData.cooldown > 0) return;

            // Démarrage du jeu au premier trigger
            if (!hasStarted) {
                hasStarted = true;
                label.querySelector('.ev-sub').innerText = "SURVIVEZ 30 SECONDES !";
                if(isHost) EventUtils.broadcast({ type: 'event-update', id: eventId, action: 'start_game' });
            }

            lantern.userData.activeTimer = 1.5; 
            lantern.userData.cooldown = 3.0;  

            // Visuel ON
            lantern.userData.head.material.emissive.setHex(0xffffaa);
            lantern.userData.head.material.emissiveIntensity = 5;
            lantern.userData.coneMat.opacity = 0.7;
            
            spawnParticles(lantern.position.clone().add(group.position), 0xffffaa, 30);
            AudioSys.play('ui_hover'); 
        };

        // Spawn Shadows 3D "Flipantes"
        group.userData.spawnShadow = (netId, startAngle, speedMult) => {
            const dist = 16; 
            const x = Math.cos(startAngle) * dist;
            const z = Math.sin(startAngle) * dist;
            
            // Corps irrégulier noir (Icosahedron flat shading)
            const shadowGeo = new THREE.IcosahedronGeometry(0.6, 0);
            const shadowMat = new THREE.MeshStandardMaterial({
                color: 0x050005, 
                roughness: 0.9, 
                flatShading: true
            });
            const shadow = new THREE.Mesh(shadowGeo, shadowMat);
            shadow.position.set(x, 1.5, z);
            
            // Yeux rouges brillants
            const eyeGeo = new THREE.SphereGeometry(0.1, 4, 4);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
            eye1.position.set(0.2, 0.1, 0.4);
            const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
            eye2.position.set(-0.2, 0.1, 0.4);
            shadow.add(eye1);
            shadow.add(eye2);

            // Aura vibrante
            const aura = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), new THREE.MeshBasicMaterial({color: 0x5500aa, transparent:true, opacity:0.3, wireframe:true}));
            shadow.add(aura);

            // Stats
            const baseSpeed = 3.5; // Plus rapide de base
            shadow.userData = { id: netId, speed: baseSpeed * speedMult, aura: aura }; 
            
            // Orientation vers le centre
            shadow.lookAt(group.position.x, 1.5, group.position.z);

            group.userData.shadows.push(shadow);
            group.add(shadow);
        };

        group.userData.removeShadow = (s) => {
            group.remove(s);
            group.userData.shadows = group.userData.shadows.filter(x => x !== s);
        };

        group.userData.update = (dt) => {
            EventUtils.handleVerticalAnim(manager, group, label, dt);
            EventUtils.updateLabel(group, label, 30);
            
            if(isFinished) {
                // Hide tooltips on finish
                lanterns.forEach(l => l.userData.tooltip.style.display = 'none');
                return;
            }

            // --- ANIMATION FLAMME COMPLEXE ---
            const t = Date.now() * 0.001;
            flameMain.scale.set(
                1 + Math.sin(t * 10) * 0.1, 
                1 + Math.sin(t * 15) * 0.1, 
                1 + Math.cos(t * 12) * 0.1
            );
            flameMain.rotation.y += dt;
            flameOuter.scale.set(
                1.1 + Math.cos(t * 8) * 0.15,
                1.1 + Math.sin(t * 5) * 0.1,
                1.1 + Math.sin(t * 9) * 0.15
            );
            flameOuter.rotation.y -= dt * 0.5;
            flameCore.scale.setScalar(0.8 + Math.random() * 0.2);
            
            centerLight.intensity = 5 + Math.sin(t * 20) * 2;
            
            // Anim Braises
            embers.forEach(e => {
                e.position.y += e.userData.speedY * dt;
                e.position.x += Math.sin(t * 5 + e.userData.offset) * dt * 0.5;
                e.scale.setScalar(1.0 - (e.position.y / 4)); // Rétrécit en montant
                if(e.position.y > 3 || e.scale.x <= 0) {
                    e.position.y = 0.5;
                    e.position.x = (Math.random()-0.5);
                    e.position.z = (Math.random()-0.5);
                    e.scale.setScalar(1);
                }
            });

            // GESTION TOOLTIPS & START PROXIMITY
            if(Globals.player && group.position.y > -0.5) {
                lanterns.forEach(l => {
                    const worldP = group.position.clone().add(l.position);
                    const dist = Globals.player.position.distanceTo(worldP);
                    const tip = l.userData.tooltip;

                    // On affiche le tooltip si on est à portée et que la lampe est PRÊTE
                    if (dist < interactRadius && l.userData.cooldown <= 0) {
                        // Afficher Tooltip au dessus de la lampe
                        const screenPos = worldP.clone().add(new THREE.Vector3(0, 2.5, 0)).project(Globals.camera);
                        const x = (screenPos.x * .5 + .5) * window.innerWidth;
                        const y = (-(screenPos.y * .5) + .5) * window.innerHeight;
                        tip.style.display = 'block';
                        tip.style.left = x + 'px';
                        tip.style.top = y + 'px';
                        tip.style.transform = 'translate(-50%, -50%)';

                        if (!hasStarted && isHost) {
                             hasStarted = true;
                             label.querySelector('.ev-sub').innerText = "SURVIVEZ 30 SECONDES !";
                             EventUtils.broadcast({ type: 'event-update', id: eventId, action: 'start_game' });
                        }

                    } else {
                        tip.style.display = 'none';
                    }
                });
            }

            // Update Lanternes
            lanterns.forEach(l => {
                if(l.userData.activeTimer > 0) {
                    l.userData.activeTimer -= dt;
                    const rotationSpeed = (Math.PI * 2) / 1.5; 
                    l.userData.currentAngle += rotationSpeed * dt;
                    l.position.x = Math.cos(l.userData.currentAngle) * lanternDist;
                    l.position.z = Math.sin(l.userData.currentAngle) * lanternDist;
                    l.rotation.y = -l.userData.currentAngle + Math.PI/2;
                    if(l.userData.activeTimer < 0.3) l.userData.coneMat.opacity = (l.userData.activeTimer / 0.3) * 0.7;
                    
                    if(l.userData.tooltip.style.display === 'block') {
                         l.userData.tooltip.style.display = 'none'; 
                    }

                    if(l.userData.activeTimer <= 0) {
                        l.userData.head.material.emissive.setHex(0x000000);
                        l.userData.coneMat.opacity = 0;
                        l.userData.currentAngle = l.userData.baseAngle;
                        l.position.x = Math.cos(l.userData.baseAngle) * lanternDist;
                        l.position.z = Math.sin(l.userData.baseAngle) * lanternDist;
                        l.rotation.y = -l.userData.baseAngle + Math.PI/2;
                    }
                } else if (l.userData.cooldown > 0) {
                    l.userData.cooldown -= dt;
                    const ratio = l.userData.cooldown / 5.0;
                    l.userData.head.material.emissive.setHex(0xff0000);
                    l.userData.head.material.emissiveIntensity = ratio * 2;
                }
            });

            // LOGIQUE DE JEU (HOST)
            if(isHost && hasStarted) {
                timeElapsed += dt;
                waveTimer += dt;
                
                // Spawn Rate très agressif sur 30s
                let spawnRate = 2 - (timeElapsed / TOTAL_TIME) * 1.2; // De 2s à 0.6s
                if(spawnRate < 1) spawnRate = 1;

                if(waveTimer > spawnRate && timeElapsed < TOTAL_TIME) {
                    waveTimer = 0;
                    
                    let minSpawn = 1 + Math.floor(timeElapsed / 10);
                    let maxSpawn = 2 + Math.floor(timeElapsed / 8);
                    const count = Math.floor(minSpawn + Math.random() * (maxSpawn - minSpawn + 1));

                    // Vitesse augmente avec le temps de 1.0x à 1.5x
                    const speedMult = 1.0 + (timeElapsed / TOTAL_TIME) * 0.5;

                    for(let k=0; k<count; k++) {
                        const angle = Math.random() * Math.PI * 2;
                        const nid = EventUtils.generateNetId();
                        group.userData.spawnShadow(nid, angle, speedMult);
                        EventUtils.broadcast({ type: 'event-update', id: eventId, action: 'spawn_shadow', nid: nid, angle: angle, sm: speedMult });
                    }
                }

                if(timeElapsed > TOTAL_TIME && group.userData.shadows.length === 0) {
                    if(hp > 0) {
                        isFinished = true;
                        LightRitualLogic.win(manager, group, label, lanterns);
                        EventUtils.broadcast({ type: 'event-end', id: eventId, win: true });
                    }
                }
                
                // Shadow Logic
                for (let i = group.userData.shadows.length - 1; i >= 0; i--) {
                    const s = group.userData.shadows[i];
                    
                    // Anim tremblement
                    s.children[0].rotation.z += dt * 5;
                    s.children[0].scale.setScalar(1 + Math.sin(Date.now()*0.02)*0.2); // Aura pulse

                    const dir = new THREE.Vector3(0, 0, 0).sub(s.position).normalize();
                    s.position.add(dir.multiplyScalar(s.userData.speed * dt));
                    s.lookAt(group.position); // Look at center

                    // Check Lantern
                    let burned = false;
                    lanterns.forEach(l => {
                        if(l.userData.activeTimer > 0) {
                            const distToLantern = s.position.distanceTo(l.position);
                            if(distToLantern < 7.0) { 
                                const toShadow = s.position.clone().sub(l.position).normalize();
                                const lanternDir = l.position.clone().normalize(); 
                                const dot = toShadow.dot(lanternDir);
                                if(dot > 0.3) burned = true;
                            }
                        }
                    });

                    if(burned) {
                        spawnParticles(s.position.clone().add(group.position), 0xaa00ff, 15);
                        group.userData.removeShadow(s);
                        EventUtils.broadcast({ type: 'event-update', id: eventId, action: 'kill_shadow', nid: s.userData.id });
                        continue;
                    }

                    if(s.position.length() < 1.5) {
                        hp -= 10;
                        createDamageText("-10%", group.position, "#ff0000");
                        group.userData.removeShadow(s);
                        EventUtils.broadcast({ type: 'event-update', id: eventId, action: 'kill_shadow', nid: s.userData.id });
                        
                        if(hp <= 0 && !isFinished) {
                             isFinished = true;
                             LightRitualLogic.fail(manager, group, label, lanterns);
                             EventUtils.broadcast({ type: 'event-end', id: eventId, win: false });
                        }
                    }
                }
            } else {
                 // Interpolation client
                 group.userData.shadows.forEach(s => {
                    s.children[0].rotation.z += dt * 5; // Aura anim
                    const dir = new THREE.Vector3(0, 0, 0).sub(s.position).normalize();
                    s.position.add(dir.multiplyScalar(s.userData.speed * dt));
                    s.lookAt(group.position);
                 });
            }

            if(hasStarted) {
                label.querySelector('.ev-sub').innerText = `INTÉGRITÉ: ${hp}% | TEMPS: ${(TOTAL_TIME - timeElapsed).toFixed(0)}s`;
            }
        };

        group.userData.onNetUpdate = (data) => {
            if(data.action === 'start_game') {
                hasStarted = true;
                label.querySelector('.ev-sub').innerText = "SURVIVEZ 30 SECONDES !";
            }
            if(data.action === 'activate_lantern') group.userData.activateLantern(data.lid);
            if(data.action === 'spawn_shadow') group.userData.spawnShadow(data.nid, data.angle, data.sm || 1.0);
            if(data.action === 'kill_shadow') {
                const s = group.userData.shadows.find(x => x.userData.id === data.nid);
                if(s) {
                    spawnParticles(s.position.clone().add(group.position), 0xaa00ff, 10);
                    group.userData.removeShadow(s);
                }
            }
        };

        // --- NOUVELLE LOGIQUE D'INTERACTION FIABLE ---
        group.userData.interact = () => {
            if(!Globals.player) return;
            
            // Trouver toutes les lanternes à portée
            const candidates = [];
            lanterns.forEach(l => {
                const worldP = group.position.clone().add(l.position);
                const dist = Globals.player.position.distanceTo(worldP);
                if(dist < interactRadius) {
                    candidates.push({ lantern: l, dist: dist });
                }
            });

            // Trier par distance
            candidates.sort((a, b) => a.dist - b.dist);

            // Chercher la première lanterne DISPONIBLE (pas en cooldown)
            // C'est ça qui manquait : avant on prenait juste la plus proche, même si elle était en CD.
            const readyCandidate = candidates.find(c => c.lantern.userData.cooldown <= 0);

            if(readyCandidate) {
                const targetL = readyCandidate.lantern;
                if(isHost) {
                    group.userData.activateLantern(targetL.userData.id);
                    EventUtils.broadcast({ type: 'event-update', id: eventId, action: 'activate_lantern', lid: targetL.userData.id });
                } else {
                    Network.send({ type: 'event-interact', id: eventId, action: 'activate_lantern', lid: targetL.userData.id });
                }
            } else if (candidates.length > 0) {
                // On est à portée d'une lanterne, mais aucune n'est prête (toutes en CD)
                UI.toast("Lanterne en recharge !");
            } else {
                UI.toast("Approchez-vous d'une lampe !");
            }
        };

        group.userData.cleanup = () => {
            if (GameActions.setAmbiance) {
                GameActions.setAmbiance('normal');
            }
            if (lanterns) {
                lanterns.forEach(l => {
                    if (l.userData && l.userData.tooltip && l.userData.tooltip.parentNode) {
                        l.userData.tooltip.parentNode.removeChild(l.userData.tooltip);
                    }
                });
            }
            EventUtils.disposeGroup(group);
        };

        Globals.scene.add(group);
        manager.interactables.push(group);
        if(isHost) UI.toast("Une présence sombre approche...");
    },

    win: function(manager, group, label, lanterns) {
        spawnParticles(group.position, 0xffaa00, 150);
        UI.toast("Purification Terminée !");
        
        if(GameActions.setAmbiance) GameActions.setAmbiance('normal');
        
        // Nettoyage des tooltips
        if(lanterns) lanterns.forEach(l => { if(l.userData.tooltip) l.userData.tooltip.remove(); });

        if(!STATE.multiplayer.active || STATE.multiplayer.isHost) {
            const rarities = ['rare', 'epic'];
            const rarity = rarities[Math.floor(Math.random() * rarities.length)];
            if(window.Debug) window.Debug.givePrism(rarity);
            if(STATE.multiplayer.active) EventUtils.broadcast({ type: 'prismatic-trigger', rarity: rarity });
        }
        manager.dismissEvent(group, label);
    },

    fail: function(manager, group, label, lanterns) {
        createDamageText("ÉCHEC", group.position, "#ff0000");
        UI.toast("La flamme s'est éteinte...");
        
        if(GameActions.setAmbiance) GameActions.setAmbiance('normal');
        if(lanterns) lanterns.forEach(l => { if(l.userData.tooltip) l.userData.tooltip.remove(); });

        manager.dismissEvent(group, label);
    }
};