// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { AudioSys } from '@/core/ressources';
import { UI } from '@/visual/ui';
import { createDamageText, spawnParticles } from '@/visual/effects';
import { Network } from '@/multiplayer/network';
import { EventUtils } from './utils';

export function spawnRunePuzzle(manager, pos) {
    if (STATE.multiplayer.active && !STATE.multiplayer.isHost) return;
    if(manager.isActive) return;
    manager.isActive = true;

    const puzzle = new THREE.Group();
    puzzle.position.copy(pos);
    puzzle.position.y = -10;
    puzzle.userData.targetY = 0;
    
    const runes = [];
    const colors = [0xff0000, 0x00ff00, 0x0088ff, 0xffff00];
    const sequence = [];
    let playerStep = 0;
    let isPlayingSequence = false; 

    for(let i=0; i<4; i++) {
        const pad = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), new THREE.MeshStandardMaterial({color: 0x222}));
        const x = (i % 2 === 0) ? -2 : 2;
        const z = (i < 2) ? -2 : 2;
        pad.position.set(x, 0, z);
        
        pad.userData.color = colors[i];
        pad.userData.index = i;
        pad.userData.isPlayerOn = false;

        const pl = new THREE.PointLight(colors[i], 0, 3);
        pl.position.y = 1;
        pad.add(pl);
        pad.userData.light = pl;

        puzzle.add(pad);
        runes.push(pad);
    }

    const label = EventUtils.createLabel("ÉPREUVE RUNIQUE", "SOLO ONLY", "#ffd700");
    puzzle.userData.label = label;

    for(let i=0; i<4; i++) sequence.push(Math.floor(Math.random()*4));

    const playSeq = async () => {
        if(!puzzle.parent || puzzle.userData.targetY < 0) return;
        isPlayingSequence = true;
        playerStep = 0;
        
        runes.forEach(r => { 
            r.material.emissive.setHex(0x000000); 
            r.userData.light.intensity = 0; 
            r.userData.isPlayerOn = false; 
        });

        label.querySelector('.ev-sub').innerText = "MÉMORISEZ...";
        await new Promise(r => setTimeout(r, 1000));

        for(let idx of sequence) {
            if(!puzzle.parent) return;
            const pad = runes[idx];
            pad.material.emissive.setHex(pad.userData.color);
            pad.userData.light.intensity = 5;
            AudioSys.play('ui_hover');
            await new Promise(r => setTimeout(r, 600));
            
            pad.material.emissive.setHex(0x000000);
            pad.userData.light.intensity = 0;
            await new Promise(r => setTimeout(r, 200));
        }
        
        label.querySelector('.ev-sub').innerText = "RÉPÉTEZ !";
        isPlayingSequence = false;
        UI.toast("À vous !");
    };

    puzzle.userData.update = (dt) => {
        EventUtils.handleVerticalAnim(manager, puzzle, label, dt);
        EventUtils.updateLabel(puzzle, label, 20);
        
        if (puzzle.position.y > -0.1 && !puzzle.userData.hasStarted) {
            puzzle.userData.hasStarted = true;
            setTimeout(playSeq, 1000);
        }
        
        if(!isPlayingSequence && Globals.player && puzzle.position.y > -0.5) {
            runes.forEach(pad => {
                const worldPos = pad.position.clone().add(puzzle.position);
                const dist = worldPos.distanceTo(Globals.player.position);
                
                if (dist < 1.2) { 
                    if (!pad.userData.isPlayerOn) { 
                        pad.userData.isPlayerOn = true;
                        pad.material.emissive.setHex(pad.userData.color);
                        pad.userData.light.intensity = 3;
                        AudioSys.play('ui_click');

                        if (pad.userData.index === sequence[playerStep]) {
                            playerStep++;
                            createDamageText("OK", worldPos, "#00ff00");
                            if (playerStep >= sequence.length) {
                                const possible = ['common', 'uncommon', 'rare', 'epic'];
                                const rarity = possible[Math.floor(Math.random() * possible.length)];
                                if(window.Debug) window.Debug.givePrism(rarity);

                                spawnParticles(puzzle.position, 0xffd700, 60);
                                manager.dismissEvent(puzzle, label);
                                UI.toast("Sagesse Reconnue !");
                            }
                        } else {
                            AudioSys.sfx.hit();
                            createDamageText("ERREUR !", worldPos, "#ff0000");
                            Globals.player.takeDamage(10);
                            isPlayingSequence = true; 
                            setTimeout(playSeq, 1500); 
                        }
                    }
                } else {
                    if (pad.userData.isPlayerOn) {
                        pad.userData.isPlayerOn = false;
                        pad.material.emissive.setHex(0x000000);
                        pad.userData.light.intensity = 0;
                    }
                }
            });
        }
    };

    puzzle.userData.cleanup = () => {
        EventUtils.disposeGroup(puzzle);
    };

    Globals.scene.add(puzzle);
    manager.interactables.push(puzzle);
    UI.toast("Des Runes Anciennes s'allument...");
}