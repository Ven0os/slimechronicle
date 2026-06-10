// @ts-nocheck
import { Globals } from '../core/globals';
import { STATE } from '../core/config';
import { EventUtils } from './events/utils';
import { spawnBloodAltar } from './events/blood_altar';
import { GeodeLogic } from './events/geode';
import { CrystalDefenseLogic } from './events/crystal_defense';
import { spawnRunePuzzle } from './events/rune_puzzle';
import { isValidEventPos } from './world/worldZones';

import { ElementalPillarsLogic } from './events/elemental_pillars';
import { AncientGongLogic } from './events/ancient_gong';
import { LaserMirrorsLogic } from './events/laser_mirrors';
import { LightRitualLogic } from './events/light_ritual';
import { GliderRunLogic } from './events/glider_run';

const EVENT_LIFETIME = 60;

export const WorldEvents = {
    interactables: [],
    isActive: false,
    pendingTimer: 0,

    findSafeSpawnPos: () => EventUtils.findSafeSpawnPos(),
    broadcast: (data) => EventUtils.broadcast(data),

    spawnBloodAltar: function(pos, netId) { spawnBloodAltar(this, pos, netId); this.pendingTimer = EVENT_LIFETIME; },
    spawnGeode: function(pos, netId) { GeodeLogic.spawnGeode(this, pos, netId); this.pendingTimer = EVENT_LIFETIME; },
    spawnCrystalDefense: function(pos, netId) { CrystalDefenseLogic.spawnCrystalDefense(this, pos, netId); this.pendingTimer = EVENT_LIFETIME; },
    spawnRunePuzzle: function(pos) { spawnRunePuzzle(this, pos); this.pendingTimer = EVENT_LIFETIME; },
    spawnElementalPillars: function(pos, netId) { ElementalPillarsLogic.spawn(this, pos, netId); this.pendingTimer = EVENT_LIFETIME; },
    spawnAncientGong: function(pos, netId) { AncientGongLogic.spawn(this, pos, netId); this.pendingTimer = EVENT_LIFETIME; },
    spawnLaserMirrors: function(pos, netId) { LaserMirrorsLogic.spawn(this, pos, netId); this.pendingTimer = EVENT_LIFETIME; },
    spawnLightRitual: function(pos, netId) { LightRitualLogic.spawn(this, pos, netId); this.pendingTimer = EVENT_LIFETIME; },
    spawnGliderRun: function(pos, netId) { GliderRunLogic.spawn(this, pos, netId); this.pendingTimer = EVENT_LIFETIME; },

    handleGeodeHit: function(geode, core, label, eventId) {
        GeodeLogic.handleGeodeHit(this, geode, core, label, eventId);
    },

    dismissEvent: function(obj, label) {
        obj.userData.targetY = -12;
        if (label) label.style.display = 'none';
        this.isActive = false;
        this.pendingTimer = 0;
    },

    removeEvent: function(obj, label) {
        Globals.scene.remove(obj);
        if (label) label.remove();
        this.interactables = this.interactables.filter(i => i !== obj);
        this.isActive = false;
        this.pendingTimer = 0;
    },

    _spawnRandomEvent() {
        const pos = this.findSafeSpawnPos();
        if (!isValidEventPos(pos)) return;
        const r = Math.random();
        if (r < 0.11) this.spawnBloodAltar(pos);
        else if (r < 0.22) this.spawnGeode(pos);
        else if (r < 0.33) this.spawnCrystalDefense(pos);
        else if (r < 0.44) this.spawnRunePuzzle(pos);
        else if (r < 0.55) this.spawnElementalPillars(pos);
        else if (r < 0.66) this.spawnAncientGong(pos);
        else if (r < 0.77) this.spawnLaserMirrors(pos);
        else if (r < 0.88) this.spawnLightRitual(pos);
        else this.spawnGeode(pos);
    },

    update: function(dt) {
        this.interactables.forEach(obj => {
            if (obj.userData.update) obj.userData.update(dt);
        });

        if (STATE.multiplayer.active && !STATE.multiplayer.isHost) return;
        if (!Globals.player || !STATE.class) return;

        if (this.interactables.length > 0 && !this.isActive) {
            this.isActive = true;
            this.pendingTimer = EVENT_LIFETIME;
        }

        if (this.interactables.length > 0 && this.pendingTimer > 0) {
            this.pendingTimer -= dt;
            if (this.pendingTimer <= 0) {
                const stale = this.interactables[0];
                const label = stale?.userData?.label || null;
                if (stale) this.dismissEvent(stale, label);
            }
        }

        if (this.interactables.length > 0) return;

        if (Math.random() < 0.00035) {
            this._spawnRandomEvent();
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
            this.pendingTimer = 0;
            nearby.userData.interact();
            return true;
        }
        return false;
    }
};
