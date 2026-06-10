// @ts-nocheck
import { Globals } from '../core/globals';
import { STATE } from '../core/config';
import { EventUtils } from './events/utils';
import { spawnBloodAltar } from './events/blood_altar';
import { GeodeLogic } from './events/geode';
import { CrystalDefenseLogic } from './events/crystal_defense';
import { spawnRunePuzzle } from './events/rune_puzzle';

import { ElementalPillarsLogic } from './events/elemental_pillars';
import { AncientGongLogic } from './events/ancient_gong';
import { LaserMirrorsLogic } from './events/laser_mirrors';
import { LightRitualLogic } from './events/light_ritual'; 
import { GliderRunLogic } from './events/glider_run';

export const WorldEvents = {
    interactables: [],
    isActive: false,

    findSafeSpawnPos: () => EventUtils.findSafeSpawnPos(),
    broadcast: (data) => EventUtils.broadcast(data),
    
    // --- GESTION DES EVENEMENTS ---
    spawnBloodAltar: function(pos, netId) { spawnBloodAltar(this, pos, netId); },
    spawnGeode: function(pos, netId) { GeodeLogic.spawnGeode(this, pos, netId); },
    spawnCrystalDefense: function(pos, netId) { CrystalDefenseLogic.spawnCrystalDefense(this, pos, netId); },
    spawnRunePuzzle: function(pos) { spawnRunePuzzle(this, pos); },
    spawnElementalPillars: function(pos, netId) { ElementalPillarsLogic.spawn(this, pos, netId); },
    spawnAncientGong: function(pos, netId) { AncientGongLogic.spawn(this, pos, netId); },
    spawnLaserMirrors: function(pos, netId) { LaserMirrorsLogic.spawn(this, pos, netId); },
    spawnLightRitual: function(pos, netId) { LightRitualLogic.spawn(this, pos, netId); },
    spawnGliderRun: function(pos, netId) { GliderRunLogic.spawn(this, pos, netId); }, // NOUVEAU

    handleGeodeHit: function(geode, core, label, eventId) {
        GeodeLogic.handleGeodeHit(this, geode, core, label, eventId);
    },
    
    dismissEvent: function(obj, label) {
        obj.userData.targetY = -12; 
        if(label) label.style.display = 'none';
        this.isActive = false; 
    },

    removeEvent: function(obj, label) {
        Globals.scene.remove(obj);
        if(label) label.remove();
        this.interactables = this.interactables.filter(i => i !== obj);
        this.isActive = false;
    },

    update: function(dt) {
        this.interactables.forEach(obj => {
            if(obj.userData.update) obj.userData.update(dt);
        });

        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) return;
        if (!Globals.player || !STATE.class) return;

        if (!this.isActive && Math.random() < 0.0002) { 
            const pos = this.findSafeSpawnPos();
            const r = Math.random();
            
            // Répartition (9 Events)
            if(r < 0.11) this.spawnBloodAltar(pos);
            else if(r < 0.22) this.spawnGeode(pos);
            else if(r < 0.33) this.spawnCrystalDefense(pos);
            else if(r < 0.44) this.spawnRunePuzzle(pos);
            else if(r < 0.55) this.spawnElementalPillars(pos);
            else if(r < 0.66) this.spawnAncientGong(pos);
            else if(r < 0.77) this.spawnLaserMirrors(pos);
            else if(r < 0.88) this.spawnLightRitual(pos);
            else this.spawnGeode(pos);
            //else this.spawnGliderRun(pos);
        }
    },

    tryInteract: function() {
        if (!Globals.player) return false;
        const nearby = this.interactables.find(obj => {
            const dist = obj.position.distanceTo(Globals.player.position);
            const radius = obj.userData.interactionRadius || 4.0;
            return dist < radius;
        });
        
        if (nearby && nearby.userData.interact) {
            nearby.userData.interact();
            return true;
        }
        return false;
    }
};