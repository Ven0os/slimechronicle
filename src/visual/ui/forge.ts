// @ts-nocheck
import { STATE } from '@/core/config';
import { UICompendium } from './compendium';
import { AudioSys } from '@/core/ressources';
import { HUDEnchant } from './hud_enchant';

export const ForgeUI = {
    currentTab: 'reforge',
    reforgeSlots: [null, null, null], 
    enchantTarget: null,               
    enchantSacrifices: [null, null, null, null, null], 
    selectingFor: null, 

    toggle: function() {
        const el = document.getElementById('screen-forge');
        if (!el) return;

        const isVisible = el.classList.contains('active');
        
        if (isVisible) {
            el.classList.remove('active');
            setTimeout(() => el.style.display = 'none', 300); 
            if(!STATE.multiplayer.active) STATE.isPaused = false;
        } else {
            el.style.display = 'flex';
            el.offsetHeight; 
            el.classList.add('active');
            
            if(window.NewSkillUI) {
                const skillWrapper = document.getElementById('skill-ui-wrapper');
                if(skillWrapper && skillWrapper.classList.contains('active')) window.NewSkillUI.toggle();
            }
            
            if(!STATE.multiplayer.active) STATE.isPaused = true;
            this.switchTab('reforge'); 
            this.update();
        }
    },

    switchTab: function(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.ui-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`tab-${tabName}`);
        if(activeBtn) activeBtn.classList.add('active');

        const pReforge = document.getElementById('forge-reforge-panel');
        const pEnchant = document.getElementById('forge-enchant-panel');

        if(pReforge && pEnchant) {
            if(tabName === 'reforge') {
                pReforge.style.display = 'flex';
                pEnchant.style.display = 'none';
            } else {
                pReforge.style.display = 'none';
                pEnchant.style.display = 'flex';
            }
        }
    },

    openSelector: function(type, index) {
        this.selectingFor = { type, index };
        const selector = document.getElementById('forge-selector');
        const list = document.getElementById('selector-grid');
        if(!selector || !list) return;

        selector.style.display = 'flex';
        list.innerHTML = '';

        let currentItemInSlot = null;
        if (type === 'reforge') currentItemInSlot = this.reforgeSlots[index];
        else if (type === 'enchant_target') currentItemInSlot = this.enchantTarget;
        else if (type === 'enchant_sac') currentItemInSlot = this.enchantSacrifices[index];

        if (currentItemInSlot) {
            const removeBtn = document.createElement('div');
            removeBtn.style.cssText = "grid-column: 1 / -1; background: rgba(231, 76, 60, 0.2); border: 1px solid #e74c3c; padding: 10px; text-align: center; cursor: pointer; border-radius: 5px; color: #e74c3c; margin-bottom: 10px; font-weight: bold; font-family: Cinzel; pointer-events: auto;";
            removeBtn.innerHTML = '<i class="fas fa-times"></i> RETIRER L\'OBJET';
            removeBtn.onclick = () => { this.selectItem(null); };
            list.appendChild(removeBtn);
        }

        const inventory = STATE.collectedFragments || [];
        let currentUid = currentItemInSlot ? currentItemInSlot.uid : null;

        const usedUids = [
            ...this.reforgeSlots.map(s => s ? s.uid : null),
            this.enchantTarget ? this.enchantTarget.uid : null,
            ...this.enchantSacrifices.map(s => s ? s.uid : null)
        ].filter(uid => uid !== null && uid !== currentUid);

        let availableItems = inventory.filter(item => !usedUids.includes(item.uid));

        if(type === 'reforge') {
            const firstSlot = this.reforgeSlots[0];
            if (index > 0 && firstSlot) {
                availableItems = availableItems.filter(item => item.rarity === firstSlot.rarity);
            }
        } else if (type === 'enchant_target') {
            availableItems = availableItems.filter(item => item.rarity !== 'mythic');
        }

        if(availableItems.length === 0 && !currentItemInSlot) {
            list.innerHTML += '<div style="color:#888; width:100%; text-align:center; grid-column: 1/-1;">Aucun objet disponible.</div>';
        }

        availableItems.forEach(item => {
            const el = document.createElement('div');
            el.className = `selector-item shard-${item.rarity}`;
            el.style.pointerEvents = "auto"; 
            
            if (item.uid === currentUid) {
                el.style.border = "2px solid #fff";
                el.style.boxShadow = "0 0 10px #fff";
            }
            
            let stars = "";
            if (item.enchantLevel > 0) stars = `<span style="color:#ffd700">★${item.enchantLevel}</span> `;

            const statsHtml = UICompendium.formatPrismStatHtml
                ? UICompendium.formatPrismStatHtml(item.statText)
                : item.statText;

            el.innerHTML = `<i class="${item.icon}" style="color:${item.color}"></i>`;
            el.onclick = () => this.selectItem(item);
            
            const tt = document.createElement('div');
            tt.innerHTML = `${stars}${item.name}<div class="prism-card-stats" style="font-size:9px;padding:4px 2px;margin-top:4px;border:none;background:rgba(0,0,0,0.4);">${statsHtml}</div>`;
            tt.style.fontSize = '10px';
            el.appendChild(tt);
            
            list.appendChild(el);
        });
    },

    selectItem: function(item) {
        if(!this.selectingFor) return;
        const { type, index } = this.selectingFor;

        if(type === 'reforge') {
            this.reforgeSlots[index] = item;
            if(index === 0 && item) {
                if(this.reforgeSlots[1] && this.reforgeSlots[1].rarity !== item.rarity) this.reforgeSlots[1] = null;
                if(this.reforgeSlots[2] && this.reforgeSlots[2].rarity !== item.rarity) this.reforgeSlots[2] = null;
            }
        } else if (type === 'enchant_target') {
            this.enchantTarget = item;
        } else if (type === 'enchant_sac') {
            this.enchantSacrifices[index] = item;
        }

        this.closeSelector();
        this.update();
    },

    closeSelector: function() {
        const selector = document.getElementById('forge-selector');
        if(selector) selector.style.display = 'none';
        this.selectingFor = null;
    },

    update: function() {
        this.reforgeSlots.forEach((item, idx) => {
            const el = document.getElementById(`reforge-slot-${idx}`);
            if(el) this.renderSlot(el, item);
        });

        const targetEl = document.getElementById('enchant-target-display');
        if(targetEl) {
            if(this.enchantTarget) {
                targetEl.style.display = 'flex';
                targetEl.innerHTML = `<i class="${this.enchantTarget.icon}" style="font-size: 3rem; color: ${this.enchantTarget.color};"></i>`;
                targetEl.className = `slot-filled shard-${this.enchantTarget.rarity}`;
            } else {
                targetEl.style.display = 'none';
                targetEl.className = '';
            }
        }

        this.enchantSacrifices.forEach((item, idx) => {
            const el = document.getElementById(`enchant-sac-${idx}`);
            if(el) {
                if(item) {
                    el.innerHTML = `<i class="${item.icon}" style="color:${item.color}; font-size:1.5rem;"></i>`;
                    el.style.border = `2px solid ${item.color}`;
                    el.style.background = 'rgba(0,0,0,0.8)';
                } else {
                    el.innerHTML = '<i class="fas fa-plus" style="color:#333; font-size:1rem;"></i>';
                    el.style.border = '2px dashed #444';
                    el.style.background = 'rgba(0,0,0,0.3)';
                }
            }
        });
    },

    renderSlot: function(element, item) {
        if(item) {
            let stars = item.enchantLevel > 0 ? `<span style="color:#ffd700">★${item.enchantLevel}</span>` : "";
            const statsHtml = UICompendium.formatPrismStatHtml
                ? UICompendium.formatPrismStatHtml(item.statText)
                : item.statText;
            element.innerHTML = `
                <div style="font-size:0.8rem; color:${item.color}; margin-bottom:5px;">${item.rarity.toUpperCase()}</div>
                <i class="${item.icon}" style="font-size: 2.5rem; color: ${item.color}; margin-bottom:10px;"></i>
                <div style="font-size:0.9rem; font-weight:bold; margin-bottom:6px;">${stars} ${item.name}</div>
                <div class="prism-card-stats" style="font-size:0.68rem; padding:6px 8px; width:90%;">${statsHtml}</div>
            `;
            element.classList.add('filled');
            element.style.borderColor = item.color;
        } else {
            element.innerHTML = `<i class="fas fa-plus" style="color: #444; font-size: 2rem;"></i><div style="color:#666; margin-top:10px;">VIDE</div>`;
            element.classList.remove('filled');
            element.style.borderColor = '#444';
        }
    }
};

export const ForgeSystem = {
    doReforge: function() {
        const slots = ForgeUI.reforgeSlots;
        if (slots.some(s => s === null)) {
            if(window.UI) window.UI.toast("Remplissez les 3 slots !");
            return;
        }

        const rarityIn = slots[0].rarity;
        if (slots[1].rarity !== rarityIn || slots[2].rarity !== rarityIn) {
             if(window.UI) window.UI.toast("Tous les prismes doivent avoir la même rareté.");
             return;
        }

        let rarityOut = 'common';
        if(rarityIn === 'common') rarityOut = 'rare';
        else if(rarityIn === 'rare') rarityOut = 'epic';
        else if(rarityIn === 'epic') rarityOut = 'legendary';
        else if(rarityIn === 'legendary') rarityOut = 'mythic';
        else {
             if(window.UI) window.UI.toast("Impossible d'améliorer ce niveau.");
             return;
        }

        const uidsToRemove = slots.map(s => s.uid);
        STATE.collectedFragments = STATE.collectedFragments.filter(f => !uidsToRemove.includes(f.uid));

        const newFrag = UICompendium.getRandomFragmentByRarity(rarityOut);
        
        ForgeUI.reforgeSlots = [null, null, null];
        ForgeUI.update();

        // --- RECALCUL CRITIQUE APRÈS SUPPRESSION ---
        if(UICompendium.recalculateStats) UICompendium.recalculateStats();

        if(window.UI) {
            window.UI.toast(`Succès ! +1 ${rarityOut.toUpperCase()}`);
            setTimeout(() => window.UI.selectReward(newFrag), 500);
        }
    },
    
    doEnchant: function() {
        if(window.UI) window.UI.toast("Les enchantements passifs ont été retirés.");
        return;
    }
};