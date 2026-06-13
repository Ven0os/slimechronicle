// @ts-nocheck
import { STATE } from '@/core/config';

/** HUD enchantements — passifs prismatiques retirés. */
export const HUDEnchant = {
    refresh: function() {
        const container = document.getElementById('passive-container');
        const label = document.querySelector('#passive-hud div[style*="color:var(--gold)"]');

        if (!container) return;

        if (label) label.innerText = 'PASSIFS ACTIFS';
        container.innerHTML = '<div style="color:#666; font-size:10px; font-style:italic;">Stats prismatiques uniquement</div>';
        container.style.display = 'flex';
        container.style.gap = '8px';
        container.style.flexWrap = 'wrap';
    },

    showTooltip: function() {
        this.hideTooltip();
    },

    hideTooltip: function() {
        const tooltip = document.getElementById('passive-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
            tooltip.style.opacity = '0';
        }
    },

    updateLoop: function(dt?: number) {},
};
