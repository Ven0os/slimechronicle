// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText, spawnParticles } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';


export const GeodeLogic = {
    spawnGeode: function(manager, pos, netId = null) {
        if(manager.isActive) return;
        manager.isActive = true;

        const isHost = !STATE.multiplayer.active || STATE.multiplayer.isHost;
        const eventId = netId || EventUtils.generateNetId();

        if (isHost && !netId) {
            EventUtils.broadcast({ 
                type: 'event-spawn', 
                eventType: 'geode', 
                pos: {x: pos.x, y: pos.y, z: pos.z}, 
                id: eventId 
            });
        }

        const geode = new THREE.Group();
        geode.position.copy(pos);
        geode.position.y = -10;
        geode.userData.targetY = 0;
        geode.userData.netId = eventId;
        
        geode.userData.state = 'blue';
        geode.userData.timer = 0;
        geode.userData.hits = 0;

        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.8}));
        core.position.y = 1.5;
        geode.add(core);

        const spikes = [];
        for(let i=0; i<12; i++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, 2.5, 4), new THREE.MeshStandardMaterial({color: 0x222}));
            spike.position.y = 1.5;
            spike.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            geode.add(spike);
            spikes.push(spike);
        }

        const light = new THREE.PointLight(0x00ffff, 3, 10);
        light.position.y = 2;
        geode.add(light);

        const label = EventUtils.createLabel("GÉODE INSTABLE", "FRAPPEZ LE BLEU", "#00ffff");
        geode.userData.label = label;

        geode.userData.setVisualState = (state) => {
            geode.userData.state = state;
            const color = (state === 'blue') ? 0x00ffff : 0xff0000;
            core.material.color.setHex(color);
            core.material.emissive.setHex(color);
            light.color.setHex(color);
            const title = label.querySelector('.ev-title');
            if(title) {
                title.style.color = (state === 'blue') ? '#00ffff' : '#ff0000';
                title.innerText = (state === 'blue') ? "GÉODE STABLE" : "GÉODE INSTABLE";
            }
        };

        geode.userData.update = (dt) => {
            EventUtils.handleVerticalAnim(manager, geode, label, dt);
            core.rotation.y += dt * (geode.userData.state === 'blue' ? 1 : 5);
            spikes.forEach(s => s.rotation.z += dt * 0.2);
            EventUtils.updateLabel(geode, label, 25);

            if (isHost) {
                geode.userData.timer += dt;
                const cycle = geode.userData.state === 'blue' ? 2.0 : 1.5;
                if (geode.userData.timer > cycle) {
                    geode.userData.timer = 0;
                    const next = geode.userData.state === 'blue' ? 'red' : 'blue';
                    geode.userData.setVisualState(next);
                    EventUtils.broadcast({ type: 'event-update', id: eventId, state: next });
                }
            }
        };

        geode.userData.interact = () => {
            if (!isHost) {
                Network.send({ type: 'event-interact', id: eventId, action: 'hit' });
                spawnParticles(geode.position, 0xffffff, 10);
                return;
            }
            GeodeLogic.handleGeodeHit(manager, geode, core, label, eventId);
        };

        geode.userData.cleanup = () => {
            EventUtils.disposeGroup(geode);
        };

        Globals.scene.add(geode);
        manager.interactables.push(geode);
        if(isHost) UI.toast("Une Géode Instable est apparue !");
    },

    handleGeodeHit: function(manager, geode, core, label, eventId) {
        if (geode.userData.state === 'blue') {
            geode.userData.hits++;
            AudioSys.sfx.hit();
            spawnParticles(geode.position, 0x00ffff, 20);
            core.scale.setScalar(1.3);
            setTimeout(() => core.scale.setScalar(1), 100);

            const sub = label.querySelector('.ev-sub');
            if(sub) sub.innerText = `${geode.userData.hits}/3 HITS`;

            geode.userData.setVisualState('red');
            geode.userData.timer = 0;
            EventUtils.broadcast({ type: 'event-update', id: eventId, state: 'red' });

            if (geode.userData.hits >= 3) {
                // --- RÉCOMPENSE RARE ---
                const rarity = 'rare';
                if(window.Debug) window.Debug.givePrism(rarity);
                EventUtils.broadcast({ type: 'prismatic-trigger', rarity: rarity });

                spawnParticles(geode.position, 0xffffff, 80);
                manager.dismissEvent(geode, label);
                UI.toast("Géode Purifiée !");
                EventUtils.broadcast({ type: 'event-end', id: eventId });
            }
        } else {
            if(Globals.player) {
                Globals.player.takeDamage(20);
                createDamageText("INSTABLE !", geode.position, '#ff0000');
            }
            geode.userData.hits = 0;
            const sub = label.querySelector('.ev-sub');
            if(sub) sub.innerText = "0/3 (RESET)";
        }
    }
};