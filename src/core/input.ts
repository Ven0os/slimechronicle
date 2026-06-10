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
    }
};