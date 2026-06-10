// @ts-nocheck
import { STATE } from '@/core/config';
import { UICompendium } from './compendium';

export const HUDEnchant = {
    // Appelé quand on gagne/enchante un item pour reconstruire la liste
    refresh: function() {
        const container = document.getElementById('passive-container');
        const label = document.querySelector('#passive-hud div[style*="color:var(--gold)"]');
        
        if (!container) return;

        // Récupère tous les fragments enchantés
        const enchantedItems = (STATE.collectedFragments || []).filter(f => f.enchanted);

        if (enchantedItems.length === 0) {
            // Si aucun enchantement, on remet le style par défaut (Passif de classe)
            // Ou on vide juste si vous préférez ne rien afficher
            if(label) label.innerText = "PASSIFS ACTIFS";
            container.innerHTML = '<div style="color:#666; font-size:10px; font-style:italic;">Aucun enchantement</div>';
            return;
        }

        if(label) label.innerText = "ENCHANTEMENTS ACTIFS";
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.gap = '8px';
        container.style.flexWrap = 'wrap';

        enchantedItems.forEach(item => {
            const info = UICompendium.getUniqueEnchantment(item);
            const uid = item.uid; // Identifiant unique de l'instance
            
            const el = document.createElement('div');
            el.className = 'enchant-slot pointer-events-auto'; // Important pour le survol
            el.dataset.id = item.id;
            el.dataset.uid = uid;
            
            // Style de la case
            el.style.position = 'relative';
            el.style.width = '32px';
            el.style.height = '32px';
            el.style.background = 'rgba(0,0,0,0.6)';
            el.style.border = `1px solid ${item.color}`;
            el.style.borderRadius = '4px';
            el.style.display = 'flex';
            el.style.justifyContent = 'center';
            el.style.alignItems = 'center';
            el.style.cursor = 'help';

            // Contenu HTML
            el.innerHTML = `
                <i class="${item.icon}" style="font-size: 1.2rem; color: ${item.color};"></i>
                
                <!-- Badge Niveau/Stack -->
                <div class="stack-badge" id="stack-${uid}" style="position: absolute; bottom: -4px; right: -4px; background: #000; border: 1px solid ${item.color}; color: #fff; font-size: 9px; font-weight:bold; padding: 0 3px; border-radius: 3px; z-index:2;">
                    ${item.enchantLevel}
                </div>

                <!-- Overlay Cooldown -->
                <div id="cd-overlay-${uid}" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.8); height: 0%; transition: height 0.1s linear; z-index:1;"></div>
                
                <!-- Texte CD -->
                <div id="cd-text-${uid}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-weight: bold; font-size: 10px; text-shadow: 0 0 3px #000; display: none; z-index:3;"></div>
            `;

            // Gestion du Tooltip au survol
            el.onmouseenter = () => this.showTooltip(item, info, el);
            el.onmouseleave = () => this.hideTooltip();

            container.appendChild(el);
        });
    },

    showTooltip: function(item, info, targetEl) {
        const tooltip = document.getElementById('passive-tooltip');
        if(!tooltip) return;

        const nameEl = document.getElementById('passive-name');
        const descEl = document.getElementById('passive-desc');
        const footerEl = document.querySelector('#passive-tooltip div[style*="font-style:italic"]');

        if(nameEl) {
            nameEl.innerText = info.title;
            nameEl.style.color = item.color;
        }
        if(descEl) descEl.innerHTML = info.desc;
        if(footerEl) footerEl.innerText = `Niveau ${item.enchantLevel} - ${info.type}`;

        // Positionnement dynamique (Juste au-dessus de l'icône)
        const rect = targetEl.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
        tooltip.style.display = 'block';
        tooltip.style.opacity = '1';
    },

    hideTooltip: function() {
        const tooltip = document.getElementById('passive-tooltip');
        if(tooltip) {
            tooltip.style.display = 'none';
            tooltip.style.opacity = '0';
        }
    },

    // Mise à jour temps réel (CDs & Stacks dynamiques)
    updateLoop: function(dt) {
        const enchantedItems = (STATE.collectedFragments || []).filter(f => f.enchanted);
        
        enchantedItems.forEach(item => {
            const uid = item.uid;
            const id = item.id.toLowerCase();
            
            // --- GESTION COOLDOWNS ---
            let currentCD = 0;
            let maxCD = 1;

            // 1. Phénix
            if (id.includes('regen') || id.includes('immortal')) {
                currentCD = STATE.passives ? (STATE.passives.phoenixCooldown || 0) : 0;
                maxCD = 60;
            }
            // 2. Dash / Vitesse (CD Shift)
            else if (id.includes('spd') || id.includes('flash')) {
                if (window.Globals && window.Globals.player && window.Globals.player.cooldowns) {
                    currentCD = window.Globals.player.cooldowns.shift || 0;
                    maxCD = window.Globals.player.maxCooldowns.shift || 8;
                }
            }
            // 3. Echo Temporel (Juste un flash visuel quand ça proc, pas de CD affiché ici)
            
            // --- MISE À JOUR UI ---
            const overlay = document.getElementById(`cd-overlay-${uid}`);
            const text = document.getElementById(`cd-text-${uid}`);
            
            if(overlay && text) {
                if (currentCD > 0) {
                    const pct = Math.min((currentCD / maxCD) * 100, 100);
                    overlay.style.height = `${pct}%`;
                    text.style.display = 'block';
                    text.innerText = Math.ceil(currentCD);
                } else {
                    overlay.style.height = '0%';
                    text.style.display = 'none';
                }
            }

            // --- GESTION STACKS DYNAMIQUES ---
            const badge = document.getElementById(`stack-${uid}`);
            if(badge) {
                // Par défaut : Niveau de l'objet
                let displayVal = item.enchantLevel;

                // Cas spécial : Berserker (Affiche les stacks de rage actuels)
                if ((id.includes('atk') || id.includes('god')) && STATE.passives && STATE.passives.berserkStacks) {
                    displayVal = STATE.passives.berserkStacks; // Affiche "5" au lieu du niveau
                    badge.style.color = '#e74c3c'; // Rouge pour indiquer rage
                } else {
                    badge.style.color = '#fff';
                }
                
                badge.innerText = displayVal;
            }
        });
    }
};