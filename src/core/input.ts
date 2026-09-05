// @ts-nocheck
import { STATE, CONFIG } from './config';

export const Input = {
    keys: {},
    init: function() {
        window.addEventListener('keydown', e => { this.keys[e.code] = true; });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });
        
        window.addEventListener('mousemove', e => { 
            STATE.mouse.x = (e.clientX / window.innerWidth) * 2 - 1; 
            STATE.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; 
        });
        
        window.addEventListener('mousedown', () => { if(!STATE.isPaused) STATE.mouseDown = true; });
        window.addEventListener('mouseup', () => { STATE.mouseDown = false; });

        // Évite les touches "collées" (personnage qui continue de courir) après un alt-tab.
        window.addEventListener('blur', () => this.releaseAll());

        // Le blur ne se déclenche pas dans tous les cas de changement d'onglet ni lors d'une
        // mise en veille : sans ça, le personnage repart en courant au retour dans le jeu.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.releaseAll();
        });
    },

    releaseAll: function() {
        // On vide l'objet existant au lieu de le remplacer : d'éventuels appelants ayant
        // gardé une référence à Input.keys continuent de voir le même état.
        for (const code in this.keys) this.keys[code] = false;
        STATE.mouseDown = false;
    }
};