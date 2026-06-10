// @ts-nocheck
import { NetConnect } from './net_connect';
import { NetSync } from './net_sync';
import { UI } from '../visual/ui';
import { STATE } from '../core/config';
import { Globals } from '../core/globals';

export const Network = {
    peer: null,
    conn: null,
    lastUpdate: 0,

    initHost: () => NetConnect.initHost(),
    joinGame: () => NetConnect.joinGame(),
    
    startSolo: () => { 
        STATE.multiplayer.active = false; 
        UI.show('class'); 
    },
    
    send: function(data) {
        if (this.conn && this.conn.open) {
            // DEBUG : Tracer les envois de skills
            if(data.type === 'net-action') {
                console.log(`[NET][SEND] Envoi action : ${data.action} (${data.key}) pour ID=${data.id || STATE.multiplayer.id}`);
            }

            if (data.type === 'game-start-signal') {
                if (Globals.mapData) data.mapData = Globals.mapData;
            }
            this.conn.send(data);
        } else {
            console.warn("[NET] Tentative d'envoi sans connexion active");
        }
    },

    update: (dt) => NetSync.update(dt),
    sendWorldState: () => NetSync.sendWorldState()
};