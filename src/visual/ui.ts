// @ts-nocheck
import { UICore } from './ui/core';
import { UICompendium } from './ui/compendium';
import { SkillTree, NewSkillUI } from './ui/skills';
import { ForgeUI, ForgeSystem } from './ui/forge';
import { STATE } from '@/core/config';

if (typeof THREE !== 'undefined' && !STATE.raycaster) {
    STATE.raycaster = new THREE.Raycaster();
}

export const UI = {
    ...UICore,
    ...UICompendium,
    
    // --- NOUVELLE FONCTION : Vérifie si un menu bloquant est ouvert ---
    // Références DOM mises en cache (les partials sont injectés dynamiquement,
    // on re-cherche donc tant qu'un élément n'a pas été trouvé/reconnecté).
    _blockingMenuEls: {},
    isMenuOpen: function() {
        const blockingMenus = [
            'skill-ui-wrapper',
            'screen-forge',
            'safe-hub-panel',
            'prismatic-modal',
            'inventory-screen',
            'pause-menu'
        ];

        for (const id of blockingMenus) {
            let el = this._blockingMenuEls[id];
            if (!el || !el.isConnected) {
                el = document.getElementById(id);
                this._blockingMenuEls[id] = el;
            }
            // On considère ouvert si : existe ET (classe 'active' OU display visible)
            if (el && (el.classList.contains('active') || el.style.display === 'flex' || el.style.display === 'block')) {
                return true;
            }
        }
        return false;
    }
};

export { SkillTree, NewSkillUI, ForgeUI, ForgeSystem, UICompendium };

window.UI = UI;
window.SkillTree = SkillTree;
window.NewSkillUI = NewSkillUI;
window.ForgeUI = ForgeUI;
window.ForgeSystem = ForgeSystem;

console.log("✅ UI System Loaded (Modular)");