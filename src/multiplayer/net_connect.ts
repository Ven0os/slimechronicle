// @ts-nocheck
import { STATE } from '../core/config';
import { UI } from '../visual/ui';
import { Globals, GameActions } from '../core/globals';
import { Network } from './network'; // Référence circulaire gérée dynamiquement
import { handleNetworkMessage } from './net_handler';
import { clearDecorations, createDecorations } from '../gameplay/environment';

export const NetConnect = {
    peerConfig: { debug: 1, config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } },

    generateCode: () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let res = ''; for(let i=0; i<4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length)); return res;
    },

    initHost: function() {
        STATE.multiplayer.active = true;
        STATE.multiplayer.isHost = true;
        STATE.multiplayer.id = 'host';
        const shortCode = this.generateCode();
        
        Network.peer = new Peer("SC_GAME_" + shortCode, this.peerConfig);
        Network.peer.on('open', (id) => {
            document.getElementById('host-code-display').innerText = shortCode;
            document.getElementById('host-status').innerText = "En attente d'un ami...";
        });
        
        Network.peer.on('connection', (conn) => {
            Network.conn = conn; 
            STATE.multiplayer.remoteId = conn.peer; 
            this.setupConnection(conn);
            document.getElementById('host-status').innerText = "Joueur trouvé !";
            document.getElementById('host-status').style.color = "#0f0";
            setTimeout(() => UI.show('class'), 1000);
        });
        
        this.setupPeerEvents();
    },

    joinGame: function() {
        const input = document.getElementById('join-code-input').value.toUpperCase();
        if(input.length < 4) { UI.toast("Code invalide"); return; }
        STATE.multiplayer.active = true;
        STATE.multiplayer.isHost = false;
        STATE.multiplayer.id = 'client_' + Math.floor(Math.random()*10000);
        
        Network.peer = new Peer(undefined, this.peerConfig);
        Network.peer.on('open', () => {
            Network.conn = Network.peer.connect("SC_GAME_" + input);
            if(Network.conn) {
                Network.conn.on('open', () => { 
                    STATE.multiplayer.remoteId = "host"; 
                    this.setupConnection(Network.conn); 
                    UI.toast("Connecté !"); 
                    UI.show('class'); 
                });
                Network.conn.on('error', (e) => { console.error(e); document.getElementById('join-status').innerText = "Erreur de connexion"; });
            }
        });
        this.setupPeerEvents();
    },

    setupConnection: function(conn) {
        conn.on('data', (data) => {
             handleNetworkMessage(data); 
             if(data.type === 'game-start-signal') {
                 if (data.gameOptions) {
                     STATE.gameOptions = data.gameOptions;
                 }
                 // SYNC MAP
                 if (data.mapData) {
                     console.log("Reçu données de map, reconstruction...");
                     clearDecorations();
                     createDecorations(data.mapData);
                 }
                 if(GameActions.startGameLogic) {
                     GameActions.startGameLogic();
                 }
             }
        });
    },

    setupPeerEvents: function() {
        Network.peer.on('disconnected', () => { if (Network.peer && !Network.peer.destroyed) Network.peer.reconnect(); });
        Network.peer.on('close', () => { Network.conn = null; UI.toast("Serveur fermé."); });
        Network.peer.on('error', (err) => { 
            console.error(err); 
            if(document.getElementById('screen-host').classList.contains('active')) UI.toast("Erreur réseau: " + (err.type || "Inconnue")); 
            if(document.getElementById('screen-join').classList.contains('active')) document.getElementById('join-status').innerText = "Erreur réseau";
        });
    }
};