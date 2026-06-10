// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import { Network } from '@/multiplayer/network';
import { isValidEventPos } from '../world/worldZones';

export const EventUtils = {
    // Génère un ID unique pour le réseau
    generateNetId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Envoi réseau générique si Host
    broadcast: function(data) {
        if (STATE.multiplayer.active && STATE.multiplayer.isHost && Network) {
            Network.send(data);
        }
    },

    // Animation d'apparition/disparition verticale
    handleVerticalAnim: function(manager, obj, label, dt) {
        obj.position.y += (obj.userData.targetY - obj.position.y) * dt * 2.0;
        
        // Si l'objet descend trop bas (disparition), on le supprime
        if(obj.userData.targetY < -5 && obj.position.y < -9) {
            manager.removeEvent(obj, label);
        }
    },

    // Création du label UI flottant
    createLabel: function(titleTxt, subTxt, color) {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.pointerEvents = 'none';
        div.style.zIndex = '1000';
        div.innerHTML = `
            <div style="text-align:center; font-family:'Cinzel'; text-shadow:0 0 5px #000; background:rgba(0,0,0,0.5); padding:5px 10px; border-radius:5px;">
                <div class="ev-title" style="font-weight:bold; color:${color}; font-size:14px;">${titleTxt}</div>
                <div class="ev-sub" style="font-size:11px; color:#fff;">${subTxt}</div>
            </div>
        `;
        document.body.appendChild(div);
        return div;
    },

    // Mise à jour de la position du label à l'écran
    updateLabel: function(obj, label, distMax) {
        if(Globals.camera && label) {
            const vec = obj.position.clone().add(new THREE.Vector3(0, 4, 0));
            vec.project(Globals.camera);
            
            const x = (vec.x * .5 + .5) * window.innerWidth;
            const y = (-(vec.y * .5) + .5) * window.innerHeight;
            
            label.style.left = x + 'px';
            label.style.top = y + 'px';
            label.style.transform = 'translate(-50%, -50%)';
            
            // Afficher seulement si devant la caméra et à distance raisonnable
            const isVisible = (vec.z < 1 && obj.position.distanceTo(Globals.camera.position) < distMax);
            label.style.display = isVisible ? 'block' : 'none';
        }
    },

    // Trouver une position de spawn sûre
    findSafeSpawnPos: function() {
        let attempts = 0;
        while(attempts < 20) {
            attempts++;
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 50; 
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const candPos = new THREE.Vector3(x, 0, z);
            
            // Vérif distance joueur stricte
            if (Globals.player && Globals.player.position.distanceTo(candPos) < 25) continue;
            if (!isValidEventPos(candPos)) continue;

            // Vérif obstacles
            let safe = true;
            if(Globals.obstacles) {
                for(let obs of Globals.obstacles) {
                    if(candPos.distanceTo(obs.position) < (obs.radius + 6)) { safe = false; break; }
                }
            }
            if(safe) return candPos;
        }
        return new THREE.Vector3(30, 0, 30); 
    }
};