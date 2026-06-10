// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';

export function spawnBloodAltar(manager, pos, netId = null) {
    if(manager.isActive) return;
    manager.isActive = true;

    const isHost = !STATE.multiplayer.active || STATE.multiplayer.isHost;
    const eventId = netId || EventUtils.generateNetId();

    if (isHost && !netId) {
        EventUtils.broadcast({ 
            type: 'event-spawn', 
            eventType: 'blood_altar', 
            pos: {x: pos.x, y: pos.y, z: pos.z}, 
            id: eventId 
        });
    }

    const altarGroup = new THREE.Group();
    altarGroup.position.copy(pos);
    altarGroup.position.y = -10; 
    altarGroup.userData.targetY = 0; 
    altarGroup.name = "BloodAltar";
    altarGroup.userData.netId = eventId;
    
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 0.5, 8), new THREE.MeshStandardMaterial({color: 0x222}));
    base.receiveShadow = true;
    altarGroup.add(base);

    for(let i=0; i<4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), new THREE.MeshStandardMaterial({color: 0x111}));
        pillar.position.set(Math.cos(angle)*1.8, 1.5, Math.sin(angle)*1.8);
        
        const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.8), new THREE.MeshBasicMaterial({color:0xff0000, side:THREE.DoubleSide}));
        rune.position.copy(pillar.position);
        rune.position.y = 1.5;
        rune.lookAt(altarGroup.position.x, 1.5, altarGroup.position.z);
        rune.translateZ(0.26);
        altarGroup.add(rune);
        altarGroup.add(pillar);
    }

    const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.8, 0), 
        new THREE.MeshStandardMaterial({color: 0xff0000, emissive: 0xaa0000, emissiveIntensity: 2})
    );
    crystal.position.y = 2;
    altarGroup.add(crystal);

    const light = new THREE.PointLight(0xff0000, 4, 10);
    light.position.y = 2.5;
    altarGroup.add(light);

    const label = EventUtils.createLabel("AUTEL DE SANG", "[F] SACRIFIEZ 50% PV", "#ff0000");
    altarGroup.userData.label = label;

    altarGroup.userData.update = (dt) => {
        EventUtils.handleVerticalAnim(manager, altarGroup, label, dt);
        crystal.rotation.y += dt;
        crystal.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.1);
        EventUtils.updateLabel(altarGroup, label, 20);
    };

    altarGroup.userData.interact = () => {
        if (!Globals.player) return;
        const cost = Math.floor(Globals.player.maxHp * 0.5);
        if (Globals.player.hp <= cost) { UI.toast("PV Trop faibles !"); return; }

        Globals.player.takeDamage(cost);
        createDamageText("-50% PV", Globals.player.position, "#ff0000");
        AudioSys.sfx.hit();
        
        // --- RÉCOMPENSE (COMMON -> EPIC) ---
        // Le sacrifice est coûteux, donc on récompense bien (Rare/Epic probable)
        const rnd = Math.random();
        let rarity = 'uncommon';
        if (rnd > 0.8) rarity = 'epic';
        else if (rnd > 0.4) rarity = 'rare';
        else if (rnd > 0.1) rarity = 'uncommon';
        else rarity = 'common';

        if(window.Debug && typeof window.Debug.givePrism === 'function') {
            window.Debug.givePrism(rarity); 
        }
        
        // Gestion Fin Event
        if (isHost) {
            EventUtils.broadcast({ type: 'event-end', id: eventId });
        } else if (STATE.multiplayer.active) {
            Network.send({ type: 'event-interact', id: eventId, action: 'finish' });
        }
        
        manager.dismissEvent(altarGroup, label);
        UI.toast("Le pacte est scellé.");
    };

    Globals.scene.add(altarGroup);
    manager.interactables.push(altarGroup);
    if(isHost) UI.toast("Un Autel de Sang émerge !");
}