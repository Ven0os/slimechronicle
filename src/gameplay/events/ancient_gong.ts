// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText, spawnParticles } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';

export const AncientGongLogic = {
    spawn: function(manager, pos, netId = null) {
        if(manager.isActive) return;
        manager.isActive = true;

        const isHost = !STATE.multiplayer.active || STATE.multiplayer.isHost;
        const eventId = netId || EventUtils.generateNetId();

        if (isHost && !netId) {
            EventUtils.broadcast({ type: 'event-spawn', eventType: 'ancient_gong', pos: {x: pos.x, y: pos.y, z: pos.z}, id: eventId });
        }

        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = -10;
        group.userData.targetY = 0;
        group.userData.netId = eventId;

        // Gong
        const frame = new THREE.Mesh(new THREE.TorusGeometry(2, 0.2, 16, 32), new THREE.MeshStandardMaterial({color: 0x8B4513}));
        frame.position.y = 2;
        frame.rotation.y = Math.PI/2;
        group.add(frame);

        const center = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.2, 32), new THREE.MeshStandardMaterial({color: 0xffd700, metalness: 1, roughness: 0.2}));
        center.rotation.x = Math.PI/2;
        center.position.y = 2;
        group.add(center);

        // Timing Ring (Visual)
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 32), new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide, transparent:true, opacity: 0.8}));
        ring.position.y = 2;
        ring.rotation.x = Math.PI/2; // Face forward? No, face Z
        // Actually lets rotate to face player usually, but here fixed
        group.add(ring);

        const label = EventUtils.createLabel("GONG ANCESTRAL", "FRAPPEZ AU BON MOMENT", "#ffd700");
        group.userData.label = label;

        let scale = 3.0;
        let speed = 1.5;
        let hitsNeeded = 3;

        group.userData.update = (dt) => {
            EventUtils.handleVerticalAnim(manager, group, label, dt);
            EventUtils.updateLabel(group, label, 25);
            
            if(group.position.y > -0.5) {
                scale -= dt * speed;
                if(scale < 0) scale = 3.0; // Reset loop (missed)
                
                ring.scale.setScalar(scale);
                // Couleur change quand proche
                if(scale < 1.2 && scale > 0.8) ring.material.color.setHex(0x00ff00);
                else ring.material.color.setHex(0xffffff);
            }
        };

        group.userData.interact = () => {
            if(isHost) {
                // Check Timing
                // Perfect timing is scale == 1.0. Tolerance 0.2
                const diff = Math.abs(scale - 1.0);
                if(diff < 0.25) {
                    hitsNeeded--;
                    AudioSys.play('ui_click'); // Should be GONG sound
                    spawnParticles(group.position.clone().add(new THREE.Vector3(0,2,0)), 0xffd700, 30);
                    createDamageText("PARFAIT !", group.position.clone().add(new THREE.Vector3(0,3,0)), "#ffd700");
                    scale = 3.0; // Reset
                    speed += 0.5; // Plus vite !
                    
                    if(hitsNeeded <= 0) {
                        AncientGongLogic.win(manager, group, label);
                        EventUtils.broadcast({ type: 'event-end', id: eventId, win: true });
                    }
                } else {
                    createDamageText("RATÉ", group.position.clone().add(new THREE.Vector3(0,3,0)), "#ff0000");
                    Globals.player.takeDamage(5);
                }
            } else {
                Network.send({ type: 'event-interact', id: eventId, action: 'hit' });
            }
        };

        group.userData.cleanup = () => {
            EventUtils.disposeGroup(group);
        };

        Globals.scene.add(group);
        manager.interactables.push(group);
        if(isHost) UI.toast("Un Gong Ancestral résonne...");
    },

    win: function(manager, group, label) {
        spawnParticles(group.position, 0xffd700, 100);
        UI.toast("Maître du Rythme !");
        const rarities = ['common', 'uncommon', 'rare', 'epic'];
        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        if((!STATE.multiplayer.active || STATE.multiplayer.isHost) && window.Debug) window.Debug.givePrism(rarity);
        if(STATE.multiplayer.active && STATE.multiplayer.isHost) EventUtils.broadcast({ type: 'prismatic-trigger', rarity: rarity });
        manager.dismissEvent(group, label);
    }
};