// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText, spawnParticles } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';

export const CrystalDefenseLogic = {
    spawnCrystalDefense: function(manager, pos, netId = null) {
        if(manager.isActive) return;
        manager.isActive = true;

        const isHost = !STATE.multiplayer.active || STATE.multiplayer.isHost;
        const eventId = netId || EventUtils.generateNetId();

        if (isHost && !netId) {
            EventUtils.broadcast({ 
                type: 'event-spawn', 
                eventType: 'crystal_defense', 
                pos: {x: pos.x, y: pos.y, z: pos.z}, 
                id: eventId 
            });
        }

        const defGroup = new THREE.Group();
        defGroup.position.copy(pos);
        defGroup.position.y = -10;
        defGroup.userData.targetY = 0;
        defGroup.userData.netId = eventId;
        defGroup.userData.orbs = [];
        defGroup.userData.beams = []; 

        // --- VISUELS DU CRISTAL ---
        const coreGeo = new THREE.OctahedronGeometry(1.0, 0);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x00ff88, 
            emissive: 0x00ff88, 
            emissiveIntensity: 2,
            roughness: 0, 
            metalness: 0.8
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = 2.5;
        defGroup.add(core);

        const shellGeo = new THREE.IcosahedronGeometry(2.0, 1);
        const shellMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.3 });
        const shell = new THREE.Mesh(shellGeo, shellMat);
        shell.position.y = 2.5;
        defGroup.add(shell);
        
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.05, 16, 100), new THREE.MeshBasicMaterial({color: 0x00ff88}));
        ring1.position.y = 2.5; 
        ring1.rotation.x = Math.PI/2; 
        defGroup.add(ring1);
        
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.05, 16, 100), new THREE.MeshBasicMaterial({color: 0x00ffff}));
        ring2.position.y = 2.5;
        ring2.rotation.x = Math.PI/2;
        ring2.rotation.y = Math.PI/4;
        defGroup.add(ring2);
        
        const light = new THREE.PointLight(0x00ff88, 5, 20);
        light.position.y = 3; 
        defGroup.add(light);
        
        const zone = new THREE.Mesh(new THREE.RingGeometry(8, 8.5, 64), new THREE.MeshBasicMaterial({color:0x00ff88, side:THREE.DoubleSide, transparent:true, opacity:0.5}));
        zone.rotation.x = -Math.PI/2; 
        defGroup.add(zone);

        let hp = 100;
        let timer = 30;
        let waveTimer = 0;
        let started = false;
        let shakeIntensity = 0;
        let isFinished = false;

        // UI
        const label = document.createElement('div');
        label.style.position = 'absolute'; label.style.pointerEvents = 'none'; label.style.zIndex = '1000';
        label.innerHTML = `
            <div style="text-align:center; font-family:'Cinzel'; text-shadow:0 0 5px #000; background:rgba(0,20,10,0.8); padding:10px; border-radius:8px; border:1px solid #00ff88; min-width:200px; box-shadow: 0 0 15px rgba(0,255,136,0.2);">
                <div class="ev-title" style="font-weight:bold; color:#00ff88; font-size:16px; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">Noyau Énergétique</div>
                <div id="def-instr" style="font-size:11px; color:#fff; font-family:sans-serif; animation: pulse 1s infinite;">[F] ACTIVER LE SYSTÈME</div>
                <div id="def-stats" style="display:none;">
                    <div style="display:flex; justify-content:space-between; font-size:10px; color:#ccc; margin-bottom:2px;">
                        <span>INTÉGRITÉ</span>
                        <span id="hp-txt">100%</span>
                    </div>
                    <div style="background:#111; width:100%; height:8px; border-radius:2px; overflow:hidden; border:1px solid #333; margin-bottom:8px;">
                        <div id="def-hp-bar" style="width:100%; height:100%; background:linear-gradient(90deg, #00ff88, #00aa55); box-shadow:0 0 5px #00ff88;"></div>
                    </div>
                    <div style="font-size:20px; font-weight:bold; color:#fff; font-family:'Courier New', monospace;" id="def-timer">30.00</div>
                </div>
            </div>
        `;
        document.body.appendChild(label);
        defGroup.userData.label = label;

        defGroup.userData.startEvent = () => {
            started = true;
            label.querySelector('#def-instr').style.display = 'none';
            label.querySelector('#def-stats').style.display = 'block';
            UI.toast("Protégez le Noyau !");
            AudioSys.play('ui_click');
        };

        defGroup.userData.interact = () => {
            if(!started && defGroup.userData.targetY === 0) {
                if(isHost) {
                    defGroup.userData.startEvent();
                    EventUtils.broadcast({ type: 'event-update', id: eventId, action: 'start' });
                } else {
                    Network.send({ type: 'event-interact', id: eventId, action: 'start' });
                }
            }
        };

        const spawnOrb = (orbId = null, startPos = null) => {
            const angle = Math.random() * Math.PI * 2;
            const dist = 18;
            const orbPos = startPos ? new THREE.Vector3(startPos.x, startPos.y, startPos.z) : new THREE.Vector3(Math.cos(angle)*dist, 1.3, Math.sin(angle)*dist);
            const myOrbId = orbId || EventUtils.generateNetId();

            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 16), new THREE.MeshStandardMaterial({color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3}));
            orb.position.copy(orbPos);
            orb.userData.orbId = myOrbId;
            orb.userData.speed = 4.0 + (30 - timer) * 0.15;

            const aura = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), new THREE.MeshBasicMaterial({color: 0x000000, transparent: true, opacity: 0.5, wireframe:true}));
            aura.rotation.y = Math.random() * Math.PI;
            orb.add(aura);

            const beamGeo = new THREE.BufferGeometry().setFromPoints([orb.position, core.position]);
            const beamMat = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.4 });
            const beam = new THREE.Line(beamGeo, beamMat);

            defGroup.add(beam);
            defGroup.add(orb);
            defGroup.userData.orbs.push(orb);
            defGroup.userData.beams.push({ line: beam, orb: orb });

            if (isHost && !orbId) {
                EventUtils.broadcast({ 
                    type: 'event-orb-spawn', 
                    eventId: eventId, 
                    orbId: myOrbId, 
                    pos: {x: orbPos.x, y: orbPos.y, z: orbPos.z} 
                });
            }
        };

        defGroup.userData.spawnRemoteOrb = (data) => {
            spawnOrb(data.orbId, data.pos);
        };
        
        defGroup.userData.destroyOrb = (orbId) => {
            const orbIndex = defGroup.userData.orbs.findIndex(o => o.userData.orbId === orbId);
            if(orbIndex !== -1) {
                const orb = defGroup.userData.orbs[orbIndex];
                spawnParticles(defGroup.position.clone().add(orb.position), 0x00ffff, 20);
                
                const beamObj = defGroup.userData.beams.find(b => b.orb === orb);
                defGroup.remove(orb);
                if(beamObj) { defGroup.remove(beamObj.line); beamObj.line.geometry.dispose(); }
                defGroup.userData.orbs.splice(orbIndex, 1);
                defGroup.userData.beams = defGroup.userData.beams.filter(b => b.orb !== orb);
            }
        };

        defGroup.userData.update = (dt) => {
            EventUtils.handleVerticalAnim(manager, defGroup, label, dt);
            EventUtils.updateLabel(defGroup, label, 40);

            if(isFinished) return;

            shell.rotation.y -= dt * 0.2;
            shell.rotation.z += dt * 0.1;
            ring1.rotation.z += dt * 0.5;
            ring2.rotation.x += dt * 0.4;
            ring2.rotation.z -= dt * 0.2;

            if(!started) {
                core.scale.setScalar(1 + Math.sin(Date.now()*0.003)*0.1);
                return;
            }

            core.scale.setScalar(1 + Math.sin(Date.now()*0.015)*0.2 + shakeIntensity);
            shakeIntensity *= 0.9;
            if(shakeIntensity < 0.01) shakeIntensity = 0;

            shell.rotation.y -= dt * 2.0;
            light.intensity = 5 + Math.random() * 2;

            if (isHost) {
                timer -= dt;
                waveTimer += dt;
                
                const spawnRate = timer < 10 ? 0.8 : (timer < 20 ? 1.5 : 2.5);
                if (waveTimer > spawnRate) {
                    waveTimer = 0;
                    spawnOrb();
                }

                if (hp <= 0 || timer <= 0) {
                    isFinished = true;
                    const win = hp > 0;
                    CrystalDefenseLogic.endCrystalDefense(manager, defGroup, label, eventId, win, core, shell, light);
                    EventUtils.broadcast({ type: 'event-end', id: eventId, win: win });
                }
            }

            if (!isHost && started) timer -= dt; 

            label.querySelector('#def-timer').innerText = timer > 0 ? timer.toFixed(2) : "0.00";
            label.querySelector('#def-hp-bar').style.width = hp + "%";
            label.querySelector('#hp-txt').innerText = Math.ceil(hp) + "%";
            const barColor = hp < 30 ? '#ff0000' : (hp < 60 ? '#ffff00' : '#00ff88');
            label.querySelector('#def-hp-bar').style.background = barColor;
            label.querySelector('#def-hp-bar').style.boxShadow = `0 0 10px ${barColor}`;

            const targetLocal = new THREE.Vector3(0, 1.3, 0);

            for (let i = defGroup.userData.orbs.length - 1; i >= 0; i--) {
                const orb = defGroup.userData.orbs[i];
                const dir = targetLocal.clone().sub(orb.position).normalize();
                orb.position.add(dir.multiplyScalar(orb.userData.speed * dt));
                orb.children[0].rotation.y += dt * 2; 

                const beamObj = defGroup.userData.beams.find(b => b.orb === orb);
                if(beamObj) {
                    const positions = beamObj.line.geometry.attributes.position.array;
                    positions[0] = orb.position.x; positions[1] = orb.position.y; positions[2] = orb.position.z;
                    beamObj.line.geometry.attributes.position.needsUpdate = true;
                    beamObj.line.material.opacity = 0.3 + Math.random() * 0.4;
                }

                if (isHost) {
                    const worldOrbPos = defGroup.position.clone().add(orb.position);
                    
                    if (orb.position.distanceTo(targetLocal) < 2.0) {
                        hp -= 10;
                        shakeIntensity = 0.3;
                        defGroup.userData.destroyOrb(orb.userData.orbId);
                        EventUtils.broadcast({ type: 'event-orb-destroy', eventId: eventId, orbId: orb.userData.orbId });
                        EventUtils.broadcast({ type: 'event-update', id: eventId, hp: hp });
                        
                        spawnParticles(defGroup.position.clone().add(new THREE.Vector3(0,3,0)), 0xff0000, 30);
                        createDamageText("-10%", defGroup.position.clone().add(new THREE.Vector3(0,5,0)), "#ff0000");
                        
                        coreMat.emissive.setHex(0xff0000);
                        light.color.setHex(0xff0000);
                        setTimeout(() => { 
                            coreMat.emissive.setHex(0x00ff88); 
                            light.color.setHex(0x00ff88); 
                        }, 150);
                        continue;
                    }

                    let hit = false;
                    
                    if (Globals.projectiles) {
                        for (let j = 0; j < Globals.projectiles.length; j++) {
                            const proj = Globals.projectiles[j];
                            if (proj.life > 0 && proj.mesh && proj.mesh.position.distanceTo(worldOrbPos) < 3.0) {
                                hit = true; proj.life = 0; 
                                spawnParticles(proj.mesh.position, 0xffff00, 10);
                                break;
                            }
                        }
                    }
                    if (!hit && Globals.player && Globals.player.isAttacking) {
                         if (Globals.player.position.distanceTo(worldOrbPos) < 4.5) hit = true;
                    }

                    if(hit) {
                        defGroup.userData.destroyOrb(orb.userData.orbId);
                        EventUtils.broadcast({ type: 'event-orb-destroy', eventId: eventId, orbId: orb.userData.orbId });
                        AudioSys.sfx.hit();
                    }
                }
            }
        };

        defGroup.userData.setHP = (val) => { hp = val; };

        Globals.scene.add(defGroup);
        manager.interactables.push(defGroup);
        if(isHost) UI.toast("Alerte : Attaque sur le Noyau !");
    },

    endCrystalDefense: function(manager, group, label, eventId, win, core, shell, light) {
        if(win) {
             spawnParticles(group.position, 0x00ff88, 100);
             createDamageText("SUCCÈS !", group.position.clone().add(new THREE.Vector3(0,4,0)), '#00ff88');
             UI.toast("Noyau Stabilisé !");
             
             // --- RÉCOMPENSE (COMMON -> EPIC) ---
             // Sécurité : On s'assure qu'on est en Solo OU Host multijoueur
             if(!STATE.multiplayer.active || STATE.multiplayer.isHost) {
                 const rarities = ['common', 'uncommon', 'rare', 'epic'];
                 // Poids pour privilégier rare/epic sur cet event difficile
                 const rnd = Math.random();
                 let rarity = 'common';
                 if (rnd > 0.9) rarity = 'epic';
                 else if (rnd > 0.6) rarity = 'rare';
                 else if (rnd > 0.3) rarity = 'uncommon';

                 if(window.Debug) window.Debug.givePrism(rarity);
                 
                 // En multijoueur, on notifie les clients
                 if(STATE.multiplayer.active) {
                     EventUtils.broadcast({ type: 'prismatic-trigger', rarity: rarity });
                 }
             }
        } else {
             createDamageText("ÉCHEC CRITIQUE", group.position, '#ff0000');
             spawnParticles(group.position, 0xff0000, 150);
             UI.toast("Le noyau a explosé !");
             if(core) core.visible = false;
             if(shell) shell.visible = false;
             if(light) light.intensity = 0;
        }
        manager.dismissEvent(group, label);
    }
};