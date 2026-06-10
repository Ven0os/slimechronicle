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
    isMenuOpen: function() {
        // Liste des IDs des interfaces qui doivent bloquer le joueur
        const blockingMenus = [
            'skill-ui-wrapper',  // Arbre de talents
            'screen-forge',      // Forge
            'prismatic-modal',   // Compendium / Choix de récompense
            'inventory-screen',  // Inventaire (si présent)
            'pause-menu'         // Menu Pause
        ];

        for (const id of blockingMenus) {
            const el = document.getElementById(id);
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