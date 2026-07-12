// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { AudioSys } from '@/core/ressources';
import { HUDEnchant } from '@/visual/ui/hud_enchant';
import { ConstellationEngine } from '@/systems/constellationEngine';

export const UICompendium = {

    compendiumFilter: 'all', // Filtre Rareté
    bonusFilter: 'all',      // Filtre Type ('all', 'offense', 'defense', 'utility')
    searchQuery: '',         // Filtre Recherche
    allFragmentsList: null,
    totalWeight: 0,

    // Récupération des favoris
    getFavorites: function () {
        try { return JSON.parse(localStorage.getItem('sc_favorites') || '[]'); }
        catch (e) { return []; }
    },

    toggleFavorite: function (id) {
        let favs = this.getFavorites();
        if (favs.includes(id)) {
            favs = favs.filter(f => f !== id);
            if (window.UI) window.UI.toast("Retiré des favoris");
        } else {
            favs.push(id);
            if (window.UI) window.UI.toast("Ajouté aux favoris ❤");
        }
        localStorage.setItem('sc_favorites', JSON.stringify(favs));

        this.updateCompendium();
        this.updateFragmentsTab();
        this.updateCompendiumStats();
    },

    /** Stats fragments : vert (+), rouge (−), blanc (libellé). */
    formatPrismStatHtml: function (statText) {
        if (!statText) return '';

        const plain = statText
            .replace(/<br\s*\/?>/gi, ', ')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        return plain.split(/,\s*/).map((part) => {
            const m = part.trim().match(/^([+-][\d.]+%?)\s+(.+)$/);
            if (!m) return `<span class="prism-stat-label">${part}</span>`;
            const label = m[2];
            const isTimedBuff = /cooldown|recharge/i.test(label);
            const cls = m[1].startsWith('+') || (isTimedBuff && m[1].startsWith('-'))
                ? 'prism-stat-pos'
                : 'prism-stat-neg';
            return `<span class="${cls}">${m[1]}</span> <span class="prism-stat-label">${label}</span>`;
        }).join('<span class="prism-stat-sep">, </span>');
    },

    updateCompendiumStats: function () {
        if (!this.allFragmentsList) this.generatePrismaticOptions();

        const totalEl = document.getElementById('prism-stat-total');
        const favEl = document.getElementById('prism-stat-fav');
        if (!totalEl && !favEl) return;

        const total = this.allFragmentsList.length;

        if (totalEl) totalEl.textContent = String(total);
        if (favEl) favEl.textContent = String(this.getFavorites().length);
    },

    showPrismaticReward: function () {
        const modal = document.getElementById('prismatic-modal');
        const container = document.getElementById('prism-container');
        if (!modal || !container) return;

        const title = modal.querySelector('h1');
        const p = modal.querySelector('p');
        if (title) { title.innerText = "CHOIX PRISMATIQUE"; title.style.display = 'block'; }
        if (p) { p.innerText = "Le temps s'est arrêté. Choisissez votre destin."; p.style.display = 'block'; }

        container.innerHTML = '';
        STATE.isPaused = true;
        modal.style.display = 'flex';
        modal.classList.add('active');

        if (AudioSys.sfx && AudioSys.sfx.prism) AudioSys.sfx.prism();

        const rewards = this.generatePrismaticOptions();
        rewards.forEach((rew, index) => {
            this.renderCard(container, rew, 'select');
            const lastCard = container.lastElementChild;
            if (lastCard) lastCard.style.animationDelay = `${index * 0.12}s`;
        });
    },

    recalculateStats: function () {
        if (!Globals.player) return;

        const hpPct = (Globals.player.maxHp > 0) ? Globals.player.hp / Globals.player.maxHp : 1;

        ConstellationEngine.recalculate();

        if (STATE.collectedFragments) {
            STATE.collectedFragments.forEach(frag => {
                frag.enchanted = false;
                frag.enchantLevel = 0;
                if (frag.apply) frag.apply();
            });
        }

        if (Globals.player) {
            Globals.player.hp = Math.floor(Globals.player.maxHp * hpPct);
            if (Globals.player.dead) Globals.player.hp = 0;
        }

        if (window.UI && window.UI.updateHUD) window.UI.updateHUD();
        if (HUDEnchant && HUDEnchant.refresh) HUDEnchant.refresh();

        this.updateFragmentsTab();

        console.log("[System] Stats & Passives Recalculated");
    },

    renderCard: function (container, item, mode = 'view') {
        if (mode === 'select') {
            this.renderRewardCard(container, item);
            return;
        }
        this.renderIndexCard(container, item, mode);
    },

    renderIndexCard: function (container, item, mode = 'view') {
        const collectedIds = STATE.collectedFragments ? STATE.collectedFragments.map(f => f.id) : [];
        const isOwned = collectedIds.includes(item.id);
        const isFav = this.getFavorites().includes(item.id);
        const lvl = item.enchantLevel || 0;
        const rawStats = item.baseStatText || (item.statText ? item.statText.split('<br>')[0] : '');
        const baseStatsHTML = this.formatPrismStatHtml(rawStats);

        const card = document.createElement('article');
        card.className = `prism-index-card shard-${item.rarity}${isOwned ? ' is-owned' : ''}`;
        if (item.enchanted) card.classList.add('is-enchanted');

        let enchantLine = '';

        const badges = [];
        if (lvl > 0) badges.push(`<span class="prism-badge prism-badge-level">Niv. ${lvl}</span>`);

        card.innerHTML = `
            <div class="prism-card-top">
                <span class="prism-card-rarity">${item.rarity.toUpperCase()}</span>
                <button type="button" class="prism-card-fav${isFav ? ' is-fav' : ''}" aria-label="Favori">
                    <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
                </button>
            </div>
            <div class="prism-card-icon"><i class="${item.icon}"></i></div>
            <h3 class="prism-card-name">${item.name.replace(/★|x\d+\s*/g, '').trim()}</h3>
            <p class="prism-card-desc">${item.desc}</p>
            <div class="prism-card-stats">${baseStatsHTML}${enchantLine}</div>
            ${badges.length ? `<div class="prism-card-badges">${badges.join('')}</div>` : ''}
        `;

        card.querySelector('.prism-card-fav').onclick = (e) => {
            e.stopPropagation();
            this.toggleFavorite(item.id);
        };

        card.onclick = () => this.openEnchantmentDeepDive(item.id);
        card.style.cursor = mode === 'inventory' ? 'zoom-in' : 'pointer';

        container.appendChild(card);
    },

    renderRewardCard: function (container, item) {
        const collectedIds = STATE.collectedFragments ? STATE.collectedFragments.map(f => f.id) : [];
        const isOwned = collectedIds.includes(item.id);
        const isFav = this.getFavorites().includes(item.id);
        const lvl = item.enchantLevel || 0;

        const card = document.createElement('div');

        let rarityClass = `shard-${item.rarity}`;
        let glowClass = item.enchanted ? 'enchanted-glow' : '';
        if (lvl >= 5) glowClass += ' mythic-pulse';

        card.className = `void-shard ${rarityClass} reveal prism-card ${glowClass}`;
        card.style.position = 'relative';
        card.style.overflow = 'hidden';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';

        const rawStats = item.baseStatText || item.statText.split('<br>')[0];
        let baseStatsHTML = this.formatPrismStatHtml(rawStats);
        let enchantStatsHTML = '';

        let badgeAcquis = "";
        if (isOwned) {
            badgeAcquis = '<div style="position:absolute; top:10px; left:10px; color:#2ecc71; font-size:10px; font-weight:bold; border:1px solid #2ecc71; padding:2px 6px; border-radius:4px; background:rgba(0,0,0,0.6); z-index:5;">ACQUIS</div>';
        }

        const heartColor = isFav ? '#e74c3c' : 'rgba(255,255,255,0.2)';
        const heartAction = `event.stopPropagation(); UI.toggleFavorite('${item.id}')`;

        let levelBadge = '';
        if (lvl > 0) {
            levelBadge = `
                <div style="position:absolute; top:0; right:0; background:linear-gradient(45deg, #d4af37, #f1c40f); color:#000; font-weight:bold; font-family:'Cinzel'; padding:5px 10px; border-bottom-left-radius:10px; z-index:10; box-shadow:-2px 2px 10px rgba(0,0,0,0.5);">
                    IVL ${lvl}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="shard-bg-effect"></div>
            ${badgeAcquis}
            ${levelBadge}

            <div style="position:absolute; top:${lvl > 0 ? '35px' : '10px'}; right:10px; color:${heartColor}; font-size:1.2rem; cursor:pointer; z-index:20; transition:0.2s;"
                 onclick="${heartAction}"
                 onmouseover="this.style.transform='scale(1.2)'; this.style.color='#e74c3c'"
                 onmouseout="this.style.transform='scale(1)'; this.style.color='${heartColor}'">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
            </div>

            <div style="margin-top:20px; text-align:center;">
                <div class="shard-type" style="color:${item.color}; font-size:0.7rem; opacity:0.8;">${item.rarity.toUpperCase()}</div>
                <i class="${item.icon}" style="font-size:3.5rem; margin:15px 0; color:${item.color}; filter:drop-shadow(0 0 15px ${item.color}); transition:0.3s;"></i>
            </div>

            <h3 class="shard-name" style="font-size:1rem; margin:0 0 10px 0; color:#fff; text-shadow:0 0 5px ${item.color}; width:100%; text-align:center;">
                ${item.name.replace(/★|x\d+\s*/g, '').trim()}
            </h3>

            <p class="shard-desc" style="font-size:0.75rem; color:#aaa; margin-bottom:10px; flex-grow:1; text-align:center; padding:0 10px;">
                ${item.desc}
            </p>

            <div class="shard-stat-bonus" style="background:rgba(0,0,0,0.3); width:100%; padding:10px; border-top:1px solid rgba(255,255,255,0.1);">
                <div class="prism-card-stats" style="background:transparent;border:none;padding:0;">${baseStatsHTML}</div>
                ${enchantStatsHTML}
            </div>
        `;

        card.onclick = () => window.UI.selectReward(item);
        card.style.cursor = "pointer";
        card.onmouseenter = () => { card.style.transform = "translateY(-5px) scale(1.02)"; card.style.boxShadow = `0 10px 20px ${item.color}44`; };
        card.onmouseleave = () => { card.style.transform = "none"; card.style.boxShadow = "none"; };

        container.appendChild(card);
    },

    openEnchantmentDeepDive: function (fragId) {
        let targetFrag = null;
        if (STATE.collectedFragments) {
            targetFrag = STATE.collectedFragments.find(f => f.id === fragId);
        }
        if (!targetFrag) {
            if (!this.allFragmentsList) this.generatePrismaticOptions();
            targetFrag = this.allFragmentsList.find(f => f.id === fragId);
        }

        if (!targetFrag) return;

        const modal = document.getElementById('prismatic-modal');
        const container = document.getElementById('prism-container');

        if (modal && container) {
            STATE.isPaused = true;
            modal.style.display = 'flex';
            modal.classList.add('active');

            const defaultTitle = modal.querySelector('h1');
            if (defaultTitle) defaultTitle.style.display = 'none';
            const defaultP = modal.querySelector('p');
            if (defaultP) defaultP.style.display = 'none';

            const hexColor = targetFrag.color || '#d4af37';
            const rarityRGB = {
                common: '148, 163, 184',
                rare: '59, 130, 246',
                epic: '168, 85, 247',
                legendary: '234, 179, 8',
                mythic: '244, 63, 94'
            }[targetFrag.rarity] || '212, 175, 55';

            container.innerHTML = `
                <div class="enchant-deep-dive" style="--deep-dive-color: ${hexColor}; --deep-dive-rgb: ${rarityRGB};">
                    <div class="enchant-deep-dive-inner">
                        <div class="enchant-deep-dive-title-label">Fragment Prismatic</div>
                        <i class="${targetFrag.icon} enchant-deep-dive-icon"></i>
                        <h2 class="enchant-deep-dive-name">
                            ${targetFrag.name.replace(/★|x\d+\s*/g, '').trim()}
                        </h2>
                        <p class="enchant-deep-dive-desc">${targetFrag.desc}</p>
                        <div class="prism-card-stats" style="margin-top:24px; font-size:1.05rem; padding:16px 36px;">
                            ${this.formatPrismStatHtml(targetFrag.baseStatText || targetFrag.statText.split('<br>')[0])}
                        </div>
                    </div>
                    <div class="enchant-deep-dive-close" onclick="document.getElementById('prismatic-modal').click()">
                        ×
                    </div>
                </div>
            `;

            modal.onclick = (e) => {
                if (e.target === modal || e.target.innerText === '×') {
                    modal.style.display = 'none';
                    modal.classList.remove('active');
                    STATE.isPaused = false;
                    if (defaultTitle) defaultTitle.style.display = 'block';
                    if (defaultP) defaultP.style.display = 'block';
                    modal.onclick = null;
                }
            };
        }
    },

    updateCompendium: function () {
        this.ensureBonusFilters();
        const container = document.getElementById('compendium-grid');
        if (!container) return;
        if (!this.allFragmentsList) this.generatePrismaticOptions();

        let displayItems = this.allFragmentsList.map(f => ({ ...f, isStatic: true }));

        const filteredList = this.applyFilters(displayItems);

        container.innerHTML = '';

        if (filteredList.length === 0) {
            container.innerHTML = '<div class="prism-index-empty">Aucun prisme ne correspond à cette recherche.</div>';
        } else {
            filteredList.forEach((frag, i) => {
                this.renderCard(container, frag, 'view');
                const last = container.lastElementChild;
                if (last) last.style.animationDelay = `${Math.min(i * 0.03, 0.45)}s`;
            });
        }

        this.updateFilterVisuals();
        this.updateCompendiumStats();
    },

    updateFragmentsTab: function () {
        const list = document.getElementById('fragments-list');
        if (!list) return;

        // On s'assure que les filtres sont présents dans l'inventaire
        this.ensureInventoryFilters(list);

        list.innerHTML = '';
        if (!STATE.collectedFragments || STATE.collectedFragments.length === 0) {
            list.innerHTML = '<div class="prism-index-empty">Aucun fragment absorbé en run...</div>';
            return;
        }

        const filteredList = this.applyFilters(STATE.collectedFragments);

        if (filteredList.length === 0) {
            list.innerHTML = '<div class="prism-index-empty">Aucun prisme ne correspond à cette recherche.</div>';
            return;
        }

        filteredList.forEach((frag, i) => {
            this.renderCard(list, frag, 'inventory');
            const last = list.lastElementChild;
            if (last) last.style.animationDelay = `${Math.min(i * 0.03, 0.45)}s`;
        });

        this.updateFilterVisuals();
    },

    // Logique de filtrage centralisée
    applyFilters: function(list) {
        return list.filter(f => {
            // 1. Rareté
            const rarityMatch = this.compendiumFilter === 'all' || f.rarity === this.compendiumFilter;

            // 2. Type (Bonus)
            let typeMatch = true;
            if (this.bonusFilter !== 'all') {
                const id = f.id.toLowerCase();
                const isOffense = id.includes('atk') || id.includes('crit') || id.includes('dmg') || id.includes('berserk') || id.includes('glass') || id.includes('destroyer') || id.includes('god')
                    || id.includes('chain') || id.includes('execution') || id.includes('singularity') || id.includes('void') || id.includes('overclock') || id.includes('haste') || id.includes('paradox') || id.includes('arcane') || id.includes('soulbind');
                const isDefense = id.includes('hp') || id.includes('def') || id.includes('regen') || id.includes('tank') || id.includes('titan') || id.includes('fortress') || id.includes('immortal')
                    || id.includes('thorns') || id.includes('ward') || id.includes('aegis') || id.includes('phoenix');
                const isUtility = id.includes('spd') || id.includes('cd') || id.includes('xp') || id.includes('lifesteal') || id.includes('vamp') || id.includes('chrono') || id.includes('swift') || id.includes('flash')
                    || id.includes('skillflow') || id.includes('overdrive') || id.includes('prismatic') || id.includes('haste') || id.includes('focus') || id.includes('time');

                if (this.bonusFilter === 'offense' && !isOffense) typeMatch = false;
                if (this.bonusFilter === 'defense' && !isDefense) typeMatch = false;
                if (this.bonusFilter === 'utility' && !isUtility) typeMatch = false;
            }

            // 3. Recherche textuelle
            let searchMatch = true;
            if (this.searchQuery && this.searchQuery.length > 0) {
                const term = this.searchQuery.toLowerCase();
                const textContent = (f.name + " " + f.desc + " " + f.statText).toLowerCase();
                if (!textContent.includes(term)) searchMatch = false;
            }

            return rarityMatch && typeMatch && searchMatch;
        });
    },

    createFilterBar: function(idPrefix) {
        const container = document.createElement('div');
        container.id = `${idPrefix}-controls-row`;
        container.className = 'compendium-controls-panel';

        const rarityRow = document.createElement('div');
        rarityRow.className = 'filter-rarity-row';

        const rarities = [
            { id: 'all', label: 'TOUT' },
            { id: 'common', label: 'COMMUN' },
            { id: 'rare', label: 'RARE' },
            { id: 'epic', label: 'ÉPIQUE' },
            { id: 'legendary', label: 'LÉGENDAIRE' },
            { id: 'mythic', label: 'MYTHIQUE' }
        ];

        rarities.forEach(r => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.rarity = r.id;
            btn.className = 'filter-rarity-btn';
            btn.textContent = r.label;
            btn.onclick = () => this.setCompendiumFilter(r.id);
            rarityRow.appendChild(btn);
        });
        container.appendChild(rarityRow);

        const bottomRow = document.createElement('div');
        bottomRow.className = 'filter-bottom-row';

        const typeContainer = document.createElement('div');
        typeContainer.className = 'bonus-filters-container';

        const types = [
            { id: 'all', label: 'TOUS', icon: 'fa-layer-group' },
            { id: 'offense', label: 'OFFENSIF', icon: 'fa-sword' },
            { id: 'defense', label: 'DÉFENSIF', icon: 'fa-shield-halved' },
            { id: 'utility', label: 'UTILITAIRE', icon: 'fa-feather' }
        ];

        types.forEach(t => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.type = t.id;
            btn.className = 'filter-type-btn';
            btn.innerHTML = `<i class="fas ${t.icon}"></i> ${t.label}`;
            btn.onclick = () => this.setBonusFilter(t.id);
            typeContainer.appendChild(btn);
        });
        bottomRow.appendChild(typeContainer);

        const searchContainer = document.createElement('div');
        searchContainer.className = 'filter-search-wrap';

        const searchIcon = document.createElement('i');
        searchIcon.className = 'fas fa-search';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'filter-search-input';
        searchInput.placeholder = 'Rechercher un fragment...';
        searchInput.value = this.searchQuery;

        searchInput.oninput = (e) => {
            this.searchQuery = e.target.value;
            // Synchro des autres barres de recherche
            document.querySelectorAll('.filter-search-input').forEach(inp => {
                if(inp !== e.target) inp.value = this.searchQuery;
            });
            this.updateCompendium();
            this.updateFragmentsTab();
        };

        searchContainer.appendChild(searchIcon);
        searchContainer.appendChild(searchInput);
        bottomRow.appendChild(searchContainer);

        container.appendChild(bottomRow);

        return container;
    },

    ensureInventoryFilters: function(listContainer) {
        if (!listContainer || document.getElementById('inv-controls-row')) return;

        const controls = this.createFilterBar('inv');
        // Insérer avant la liste
        if (listContainer.parentNode) {
            listContainer.parentNode.insertBefore(controls, listContainer);
        }
    },

    ensureBonusFilters: function () {
        const header = document.getElementById('compendium-toolbar') || document.querySelector('.compendium-header');
        if (!header || document.getElementById('compendium-controls-row')) return;

        const controls = this.createFilterBar('compendium');
        header.appendChild(controls);
    },

    updateFilterVisuals: function() {
        document.querySelectorAll('.filter-type-btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.type === this.bonusFilter);
        });

        document.querySelectorAll('.filter-rarity-btn').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.rarity === this.compendiumFilter);
        });
    },

    setCompendiumFilter: function (filter, el) {
        this.compendiumFilter = filter;
        this.updateCompendium();
        this.updateFragmentsTab();
    },

    setBonusFilter: function (type) {
        this.bonusFilter = type;
        this.updateCompendium();
        this.updateFragmentsTab();
    },

    /** Passifs prismatiques retirés — stats uniquement. */
    getUniqueEnchantment: function () {
        return null;
    },

    generatePrismaticOptions: function () {
        /** Vitesse sprint (déplacement) */
        const applySprint = (pct) => {
            STATE.stats.speed *= (1 + pct);
            if (Globals.player) Globals.player.speed = STATE.stats.speed;
        };
        /** Vitesse d'attaque : pct>0 = attaques plus rapides (convention constellations) */
        const applyAtkSpeed = (pct) => {
            STATE.stats.attackSpeedMod = Math.max(0.45, (STATE.stats.attackSpeedMod || 1) - pct / 100);
        };

        // === COMMON (500 weight) ===
        const commonFragments = [
            { id: 'c_hp', name: "Éclat de Vie", rarity: 'common', icon: "fas fa-heart", color: '#bdc3c7', desc: "Un petit coup de pouce.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> PV Max", apply: () => { STATE.stats.maxHp *= 1.036; if (Globals.player) { Globals.player.maxHp *= 1.036; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'c_atk', name: "Éclat de Force", rarity: 'common', icon: "fas fa-fist-raised", color: '#bdc3c7', desc: "Frappez un peu plus fort.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> Attaque", apply: () => { STATE.stats.atk *= 1.036; } },
            { id: 'c_spd', name: "Éclat de Vent", rarity: 'common', icon: "fas fa-wind", color: '#bdc3c7', desc: "Déplacement plus rapide (sprint).", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> Vitesse sprint", apply: () => { applySprint(0.036); } },
            { id: 'c_crit', name: "Éclat de Chance", rarity: 'common', icon: "fas fa-dice", color: '#bdc3c7', desc: "La chance tourne.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.8%</span> Chance Critique", apply: () => { STATE.stats.crit += 0.018; } },
            { id: 'c_def', name: "Éclat de Bouclier", rarity: 'common', icon: "fas fa-shield", color: '#bdc3c7', desc: "Une légère protection.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.8</span> Défense", apply: () => { STATE.stats.defense = STATE.stats.defense || 0; STATE.stats.defense += 1.8; } },
            { id: 'c_regen', name: "Éclat de Régénération", rarity: 'common', icon: "fas fa-heartbeat", color: '#bdc3c7', desc: "La vie coule doucement.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+0.27</span> Régén/s", apply: () => { STATE.stats.regen = (STATE.stats.regen || 0) + 0.27; } },
            { id: 'c_xp', name: "Éclat d\'Expérience", rarity: 'common', icon: "fas fa-star", color: '#bdc3c7', desc: "Un peu plus d'EXP.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> EXP", apply: () => { STATE.stats.xpMod = (STATE.stats.xpMod || 1.0) * 1.036; } },
            { id: 'c_lifesteal', name: "Éclat de Drain", rarity: 'common', icon: "fas fa-droplet", color: '#bdc3c7', desc: "Un peu de vol de vie.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+0.2%</span> Vol de Vie", apply: () => { STATE.stats.lifesteal = (STATE.stats.lifesteal || 0) + 0.0023; } },
            { id: 'c_critdmg', name: "Éclat de Vengeance", rarity: 'common', icon: "fas fa-fire", color: '#bdc3c7', desc: "Plus de dégâts critiques.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+2.7%</span> Dégâts Critique", apply: () => { STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.027; } },
            { id: 'c_berserk', name: "Éclat Berserk", rarity: 'common', icon: "fas fa-skull", color: '#bdc3c7', desc: "Puissance contre survie.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-2.7%</span> PV Max", apply: () => { STATE.stats.atk *= 1.072; STATE.stats.maxHp *= 0.964; if (Globals.player) { Globals.player.maxHp *= 0.964; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'c_swiftrisk', name: "Éclat de Célérité Instable", rarity: 'common', icon: "fas fa-running", color: '#bdc3c7', desc: "Sprint rapide, armure légère.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Vitesse sprint, <span style='color:#e74c3c; font-weight:bold;'>-3.6%</span> Défense", apply: () => { applySprint(0.072); STATE.stats.defense = (STATE.stats.defense || 0) - 3.6; } },
            { id: 'c_precision', name: "Éclat de Précision", rarity: 'common', icon: "fas fa-crosshairs", color: '#bdc3c7', desc: "Frappez juste, pas fort.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Chance Critique, <span style='color:#e74c3c; font-weight:bold;'>-2.7%</span> Attaque", apply: () => { STATE.stats.crit += 0.054; STATE.stats.atk *= 0.973; } },
            { id: 'c_bloodpact', name: "Éclat du Pacte Sanglant", rarity: 'common', icon: "fas fa-droplet", color: '#bdc3c7', desc: "La vie contre la puissance.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+0.5%</span> Vol de Vie, <span style='color:#e74c3c; font-weight:bold;'>-2.7%</span> PV Max", apply: () => { STATE.stats.lifesteal = (STATE.stats.lifesteal || 0) + 0.0045; STATE.stats.maxHp *= 0.964; if (Globals.player) { Globals.player.maxHp *= 0.964; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'c_focus', name: "Éclat de Concentration", rarity: 'common', icon: "fas fa-brain", color: '#bdc3c7', desc: "Moins mobile, sorts plus rapides.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-3.6%</span> Vitesse sprint, <span style='color:#e74c3c; font-weight:bold;'>-2.7%</span> Cooldowns", apply: () => { applySprint(-0.036); STATE.stats.cdMod = (STATE.stats.cdMod || 1.0) * 0.973; } },
            { id: 'c_thorns', name: "Éclat d'Épines", rarity: 'common', icon: "fas fa-icicles", color: '#bdc3c7', desc: "Des pointes qui mordent en retour.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3.6</span> Défense", apply: () => { STATE.stats.defense = (STATE.stats.defense || 0) + 3.6; } },
            { id: 'c_chain', name: "Éclat de Liaison", rarity: 'common', icon: "fas fa-link", color: '#bdc3c7', desc: "Un coup en entraîne un autre.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+2.7%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+0.9%</span> Chance Critique", apply: () => { STATE.stats.atk *= 1.027; STATE.stats.crit += 0.009; } },
            { id: 'c_haste', name: "Éclat de Frénésie", rarity: 'common', icon: "fas fa-bolt-lightning", color: '#bdc3c7', desc: "Frappez plus souvent.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Vitesse d'attaque", apply: () => { applyAtkSpeed(5.4); } },
            { id: 'c_ward', name: "Éclat de Protection", rarity: 'common', icon: "fas fa-shield-heart", color: '#bdc3c7', desc: "Un bouclier discret mais fiable.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+2.7%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+2.7</span> Défense", apply: () => { STATE.stats.maxHp *= 1.027; STATE.stats.defense = (STATE.stats.defense || 0) + 2.7; if (Globals.player) { Globals.player.maxHp *= 1.027; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } }

        ];

        // === RARE (100 weight) ===
        const rareFragments = [
            { id: 'r_hp', name: "Cristal de Vitalité", rarity: 'rare', icon: "fas fa-shield-alt", color: '#3498db', desc: "Une protection fiable.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> PV Max", apply: () => { STATE.stats.maxHp *= 1.072; if (Globals.player) { Globals.player.maxHp *= 1.072; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'r_atk', name: "Cristal de Guerre", rarity: 'rare', icon: "fas fa-skull-crossbones", color: '#3498db', desc: "Pour les guerriers aguerris.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Attaque", apply: () => { STATE.stats.atk *= 1.072; } },
            { id: 'r_spd', name: "Bottes de Célérité", rarity: 'rare', icon: "fas fa-shoe-prints", color: '#3498db', desc: "Ne regardez pas en arrière.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Vitesse sprint", apply: () => { applySprint(0.072); } },
            { id: 'r_crit', name: "Lentille de Précision", rarity: 'rare', icon: "fas fa-bullseye", color: '#3498db', desc: "Visez juste.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> Chance Critique", apply: () => { STATE.stats.crit += 0.036; } },
            { id: 'r_life', name: "Fiole de Sang", rarity: 'rare', icon: "fas fa-vial", color: '#3498db', desc: "Un goût métallique.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+0.9%</span> Vol de Vie", apply: () => { STATE.stats.lifesteal += 0.009; } },
            { id: 'r_cd', name: "Rouage Ancien", rarity: 'rare', icon: "fas fa-cog", color: '#3498db', desc: "La mécanique est fluide.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-3.6%</span> Cooldowns", apply: () => { STATE.stats.cdMod *= 0.964; } },
            { id: 'r_def', name: "Armure Renforcée", rarity: 'rare', icon: "fas fa-helmet-safety", color: '#3498db', desc: "Meilleure protection.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Défense", apply: () => { STATE.stats.defense = (STATE.stats.defense || 0) + 5.4; } },
            { id: 'r_regen', name: "Potion Éternelle", rarity: 'rare', icon: "fas fa-flask", color: '#3498db', desc: "La régénération accélère.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.1</span> Régén/s", apply: () => { STATE.stats.regen = (STATE.stats.regen || 0) + 1.08; } },
            { id: 'r_xp', name: "Gemme de Savoir", rarity: 'rare', icon: "fas fa-gem", color: '#3498db', desc: "L'apprentissage s'accélère.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> EXP", apply: () => { STATE.stats.xpMod = (STATE.stats.xpMod || 1.0) * 1.072; } },
            { id: 'r_speed_regen', name: "Élan Vital", rarity: 'rare', icon: "fas fa-wind", color: '#3498db', desc: "Sprint et régénération.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+0.72</span> Régén/s", apply: () => { applySprint(0.036); STATE.stats.regen = (STATE.stats.regen || 0) + 0.72; } },
            { id: 'r_crit_dmg', name: "Cristal Étincelant", rarity: 'rare', icon: "fas fa-gem", color: '#3498db', desc: "Critiques plus puissants.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Dégâts Critique", apply: () => { STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.072; } },
            { id: 'r_thorns', name: "Cristal Réflecteur", rarity: 'rare', icon: "fas fa-shield-virus", color: '#3498db', desc: "Renvoie la violence reçue.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> PV Max", apply: () => { STATE.stats.defense = (STATE.stats.defense || 0) + 7.2; STATE.stats.maxHp *= 1.036; if (Globals.player) { Globals.player.maxHp *= 1.036; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'r_chain', name: "Maillon Brisé", rarity: 'rare', icon: "fas fa-link-slash", color: '#3498db', desc: "La douleur se propage.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> Dégâts Critique", apply: () => { STATE.stats.atk *= 1.054; STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.036; } },
            { id: 'r_haste', name: "Rouage Affûté", rarity: 'rare', icon: "fas fa-gears", color: '#3498db', desc: "Mécanique et mouvement fusionnés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> Vitesse sprint", apply: () => { applyAtkSpeed(7.2); applySprint(0.036); } },
            { id: 'r_skillflow', name: "Flux Arcanique", rarity: 'rare', icon: "fas fa-wand-sparkles", color: '#3498db', desc: "Sorts et attaques s'alimentent.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-5.4%</span> Cooldowns, <span style='color:#2ecc71; font-weight:bold;'>+4.5%</span> Attaque", apply: () => { STATE.stats.cdMod *= 0.946; STATE.stats.atk *= 1.045; } },
            { id: 'r_execution', name: "Pointe d'Exécution", rarity: 'rare', icon: "fas fa-skull", color: '#3498db', desc: "Achève les blessés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4.5%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Dégâts Critique", apply: () => { STATE.stats.crit += 0.045; STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.054; } }
        ];

        // === EPIC (15 weight) ===
        const epicFragments = [
            { id: 'e_tank', name: "Forteresse Ambulante", rarity: 'epic', icon: "fas fa-dungeon", color: '#9b59b6', desc: "Devenez inébranlable.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+9%</span> PV Max, <span style='color:#e74c3c; font-weight:bold;'>-2.7%</span> Vitesse sprint", apply: () => { STATE.stats.maxHp *= 1.09; applySprint(-0.027); if (Globals.player) { Globals.player.maxHp *= 1.09; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'e_glass', name: "Canon de Verre", rarity: 'epic', icon: "fas fa-crosshairs", color: '#9b59b6', desc: "Tout dans l'attaque.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+13.5%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-6.3%</span> PV Max", apply: () => { STATE.stats.atk *= 1.135; STATE.stats.maxHp *= 0.937; if (Globals.player) { Globals.player.maxHp *= 0.937; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'e_vamp', name: "Soif Éternelle", rarity: 'epic', icon: "fas fa-tooth", color: '#9b59b6', desc: "Le combat vous nourrit.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.1%</span> Vol de Vie", apply: () => { STATE.stats.lifesteal += 0.0113; } },
            { id: 'e_time', name: "Montre à Gousset", rarity: 'epic', icon: "fas fa-stopwatch", color: '#9b59b6', desc: "Le temps presse.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-4.5%</span> Cooldowns", apply: () => { STATE.stats.cdMod *= 0.955; } },
            { id: 'e_crit', name: "Regard Mortel", rarity: 'epic', icon: "fas fa-eye-slash", color: '#9b59b6', desc: "Chaque coup compte.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4.5%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+6.3%</span> Dégâts Critique", apply: () => { STATE.stats.crit += 0.045; STATE.stats.critDmg += 0.063; } },
            { id: 'e_regen', name: "Cœur Troll", rarity: 'epic', icon: "fas fa-biohazard", color: '#9b59b6', desc: "Ça repousse vite.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.1</span> Régén/s, <span style='color:#2ecc71; font-weight:bold;'>+6.3%</span> PV Max", apply: () => { STATE.stats.regen += 1.08; STATE.stats.maxHp *= 1.063; } },
            { id: 'e_berserker', name: "Furie Primale", rarity: 'epic', icon: "fas fa-explosion", color: '#9b59b6', desc: "Frappes frénétiques.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+9%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+1.8%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+4.5%</span> Vitesse d'attaque", apply: () => { STATE.stats.atk *= 1.09; STATE.stats.crit += 0.018; applyAtkSpeed(4.5); } },
            { id: 'e_swift', name: "Agilité Accrue", rarity: 'epic', icon: "fas fa-feather", color: '#9b59b6', desc: "Sprint et vitesse d'attaque accrus.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+2.7%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-1.8%</span> Cooldowns", apply: () => { applySprint(0.072); applyAtkSpeed(2.7); STATE.stats.cdMod *= 0.982; } },
            { id: 'e_fortress', name: "Bastion de Fer", rarity: 'epic', icon: "fas fa-crown", color: '#9b59b6', desc: "Défense inébranlable.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+9%</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+6.3%</span> PV Max", apply: () => { STATE.stats.defense = (STATE.stats.defense || 0) + 9; STATE.stats.maxHp *= 1.063; } },
            { id: 'e_siphon', name: "Siphon Éternel", rarity: 'epic', icon: "fas fa-wand-magic-sparkles", color: '#9b59b6', desc: "Drainer pour guérir.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.8%</span> Vol de Vie, <span style='color:#2ecc71; font-weight:bold;'>+0.54</span> Régén/s", apply: () => { STATE.stats.lifesteal += 0.018; STATE.stats.regen = (STATE.stats.regen || 0) + 0.54; } },
            { id: 'e_thorns', name: "Carapace Prismatique", rarity: 'epic', icon: "fas fa-shield-cat", color: '#9b59b6', desc: "Une armure qui riposte.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+12.6</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> PV Max, <span style='color:#e74c3c; font-weight:bold;'>-3.6%</span> Vitesse sprint", apply: () => { STATE.stats.defense = (STATE.stats.defense || 0) + 12.6; STATE.stats.maxHp *= 1.072; applySprint(-0.036); if (Globals.player) { Globals.player.maxHp *= 1.072; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'e_chain', name: "Chaîne Lumineuse", rarity: 'epic', icon: "fas fa-bezier-curve", color: '#9b59b6', desc: "La lumière saute d'ennemi en ennemi.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10.8%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+2.7%</span> Chance Critique", apply: () => { STATE.stats.atk *= 1.108; STATE.stats.crit += 0.027; } },
            { id: 'e_overclock', name: "Surcharge Totale", rarity: 'epic', icon: "fas fa-microchip", color: '#9b59b6', desc: "Puissance au prix de la stabilité.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+9%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-5.4%</span> Cooldowns, <span style='color:#e74c3c; font-weight:bold;'>-4.5%</span> PV Max", apply: () => { applyAtkSpeed(9); STATE.stats.cdMod *= 0.946; STATE.stats.maxHp *= 0.955; if (Globals.player) { Globals.player.maxHp *= 0.955; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'e_phoenix', name: "Cendre Renaissante", rarity: 'epic', icon: "fas fa-dove", color: '#9b59b6', desc: "Des cendres naît la vie.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+1.6</span> Régén/s", apply: () => { STATE.stats.maxHp *= 1.072; STATE.stats.regen = (STATE.stats.regen || 0) + 1.62; if (Globals.player) { Globals.player.maxHp *= 1.072; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'e_void', name: "Éclat du Vide", rarity: 'epic', icon: "fas fa-circle-half-stroke", color: '#9b59b6', desc: "Percer toute défense.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+12.6%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-7.2%</span> Défense", apply: () => { STATE.stats.atk *= 1.126; STATE.stats.defense = (STATE.stats.defense || 0) - 7.2; } }
        ];

        // === LEGENDARY (3 weight) ===
        const legendaryFragments = [
            { id: 'l_titan', name: "Cœur de Titan", rarity: 'legendary', icon: "fas fa-mountain", color: '#f1c40f', desc: "Une endurance légendaire.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+20.7%</span> PV Max", apply: () => { STATE.stats.maxHp *= 1.207; if (Globals.player) { Globals.player.maxHp *= 1.207; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'l_god', name: "Force Divine", rarity: 'legendary', icon: "fas fa-hammer", color: '#f1c40f', desc: "Fendez les cieux.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+20.7%</span> Attaque", apply: () => { STATE.stats.atk *= 1.207; } },
            { id: 'l_flash', name: "Vitesse Lumière", rarity: 'legendary', icon: "fas fa-bolt", color: '#f1c40f', desc: "Sprint et vitesse d'attaque fusionnés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-3.6%</span> Cooldowns", apply: () => { applySprint(0.072); applyAtkSpeed(3.6); STATE.stats.cdMod *= 0.964; } },
            { id: 'l_eye', name: "Œil du Faucon", rarity: 'legendary', icon: "fas fa-eye", color: '#f1c40f', desc: "La précision ultime.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+11.7%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+16.2%</span> Dégâts Critique", apply: () => { STATE.stats.crit += 0.117; STATE.stats.critDmg += 0.162; } },
            { id: 'l_chrono', name: "Maître du Temps", rarity: 'legendary', icon: "fas fa-hourglass-half", color: '#f1c40f', desc: "Les sorts s'enchaînent.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-5.4%</span> Cooldowns", apply: () => { STATE.stats.cdMod *= 0.946; } },
            { id: 'l_blood', name: "Seigneur de Sang", rarity: 'legendary', icon: "fas fa-wine-glass", color: '#f1c40f', desc: "Baignez dans le sang.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.6%</span> Vol de Vie, <span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> PV Max", apply: () => { STATE.stats.lifesteal += 0.0158; STATE.stats.maxHp *= 1.072; if (Globals.player) { Globals.player.maxHp *= 1.072; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'l_apex', name: "Apogée du Pouvoir", rarity: 'legendary', icon: "fa-solid fa-scroll", color: '#f1c40f', desc: "Tous les domaines maîtrisés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+9%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+2.7%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+3.6%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-4.5%</span> Cooldowns", apply: () => { STATE.stats.atk *= 1.09; STATE.stats.maxHp *= 1.054; applySprint(0.027); applyAtkSpeed(3.6); STATE.stats.cdMod *= 0.955; if (Globals.player) { Globals.player.maxHp *= 1.054; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'l_fortuna', name: "Bénédiction de Fortuna", rarity: 'legendary', icon: "fas fa-dice-six", color: '#f1c40f', desc: "La chance est du côté du fort.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+11.7%</span> Dégâts Critique, <span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> EXP", apply: () => { STATE.stats.crit += 0.054; STATE.stats.critDmg += 0.117; STATE.stats.xpMod = (STATE.stats.xpMod || 1.0) * 1.054; } },
            { id: 'l_immortal_regen', name: "Essence Éternelle", rarity: 'legendary', icon: "fas fa-ankh", color: '#f1c40f', desc: "La vie sans fin.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+2.5</span> Régén/s, <span style='color:#2ecc71; font-weight:bold;'>+11.7%</span> PV Max", apply: () => { STATE.stats.regen = (STATE.stats.regen || 0) + 2.52; STATE.stats.maxHp *= 1.117; if (Globals.player) { Globals.player.maxHp *= 1.117; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'l_swift_dancer', name: "Danseur des Vents", rarity: 'legendary', icon: "fas fa-person-walking-arrow-loop-left", color: '#f1c40f', desc: "Sprint extrême, vitesse d'attaque fluide.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+14.4%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+4.5%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-1.8%</span> Cooldowns", apply: () => { applySprint(0.144); applyAtkSpeed(4.5); STATE.stats.cdMod *= 0.982; } },
            { id: 'l_thorns', name: "Couronne d'Épines", rarity: 'legendary', icon: "fas fa-crown", color: '#f1c40f', desc: "Une forteresse qui contre-attaque.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+19.8</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+13.5%</span> PV Max", apply: () => { STATE.stats.defense = (STATE.stats.defense || 0) + 19.8; STATE.stats.maxHp *= 1.135; if (Globals.player) { Globals.player.maxHp *= 1.135; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'l_chain', name: "Maître des Maillons", rarity: 'legendary', icon: "fas fa-share-nodes", color: '#f1c40f', desc: "Chaque mort en appelle d'autres.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+16.2%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Dégâts Critique", apply: () => { STATE.stats.atk *= 1.162; STATE.stats.crit += 0.072; STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.09; } },
            { id: 'l_overdrive', name: "Moteur Céleste", rarity: 'legendary', icon: "fas fa-jet-fighter-up", color: '#f1c40f', desc: "Sprint et vitesse d'attaque au maximum.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10.8%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Vitesse sprint, <span style='color:#e74c3c; font-weight:bold;'>-7.2%</span> Cooldowns", apply: () => { applyAtkSpeed(10.8); applySprint(0.09); STATE.stats.cdMod *= 0.928; } },
            { id: 'l_soulbind', name: "Pacte d'Âmes", rarity: 'legendary', icon: "fas fa-hand-holding-heart", color: '#f1c40f', desc: "Leur essence devient votre force.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10.8%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+2.3%</span> Vol de Vie", apply: () => { STATE.stats.atk *= 1.108; STATE.stats.lifesteal += 0.0225; } },
            { id: 'l_arcane', name: "Orbe d'Infusion", rarity: 'legendary', icon: "fas fa-sun", color: '#f1c40f', desc: "Tous les sorts débordent de puissance.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Dégâts sorts, <span style='color:#e74c3c; font-weight:bold;'>-3.6%</span> Cooldowns", apply: () => { if (STATE.stats.skillMods) { Object.keys(STATE.stats.skillMods).forEach((k) => { STATE.stats.skillMods[k] = (STATE.stats.skillMods[k] || 1) * 1.072; }); } STATE.stats.cdMod *= 0.964; } }
        ];

        // === MYTHIC (1 weight) ===
        const mythicFragments = [
            { id: 'm_omni', name: "Omnipotence", rarity: 'mythic', icon: "fas fa-atom", color: '#ff0055', desc: "Le pouvoir absolu.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+9%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Critique, <span style='color:#e74c3c; font-weight:bold;'>-9%</span> Cooldowns", apply: () => { STATE.stats.maxHp *= 1.09; STATE.stats.atk *= 1.09; applySprint(0.09); applyAtkSpeed(7.2); STATE.stats.crit += 0.09; STATE.stats.critDmg += 0.09; STATE.stats.cdMod *= 0.91; if (Globals.player) { Globals.player.maxHp *= 1.09; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'm_immortal', name: "Immortalité", rarity: 'mythic', icon: "fas fa-ankh", color: '#ff0055', desc: "Refusez de tomber.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+45%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+4.5</span> Régén/s", apply: () => { STATE.stats.maxHp *= 1.45; STATE.stats.regen += 4.5; if (Globals.player) { Globals.player.maxHp *= 1.45; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'm_destroyer', name: "Le Destructeur", rarity: 'mythic', icon: "fas fa-meteor", color: '#ff0055', desc: "Tout doit disparaître.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+45%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+18%</span> Critique", apply: () => { STATE.stats.atk *= 1.45; STATE.stats.crit += 0.18; } },
            { id: 'm_warp', name: "Vitesse Distordue", rarity: 'mythic', icon: "fas fa-tachometer-alt", color: '#ff0055', desc: "Sprint distordu, sorts accélérés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+36%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-9%</span> Cooldowns", apply: () => { applySprint(0.36); applyAtkSpeed(5.4); STATE.stats.cdMod *= 0.91; } },
            { id: 'm_vampire_lord', name: "Dracula", rarity: 'mythic', icon: "fas fa-crown", color: '#ff0055', desc: "La vie éternelle.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+9%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Vol de Vie", apply: () => { STATE.stats.lifesteal += 0.09; STATE.stats.atk *= 1.09; } },
            { id: 'm_glass_cannon_plus', name: "Canon de verre accrue", rarity: 'mythic', icon: "fas fa-crosshairs", color: '#ff0055', desc: "Une puissance dévastatrice au prix de la survie.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+72%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-27%</span> PV Max", apply: () => { STATE.stats.atk *= 1.72; STATE.stats.maxHp *= 0.73; if (Globals.player) { Globals.player.maxHp *= 0.73; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'm_chaos', name: "Chaos Primordial", rarity: 'mythic', icon: "fas fa-face-grin-stars", color: '#ff0055', desc: "L'ordre n'existe plus.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+45%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+22.5%</span> Critique, <span style='color:#e74c3c; font-weight:bold;'>-13.5%</span> Défense", apply: () => { STATE.stats.atk *= 1.45; STATE.stats.crit += 0.225; STATE.stats.defense = (STATE.stats.defense || 0) * 0.865; } },
            { id: 'm_twilight', name: "Crépuscule Éternel", rarity: 'mythic', icon: "fa-solid fa-moon", color: '#ff0055', desc: "Entre deux mondes.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+22.5%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+18%</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+2.7</span> Régén/s", apply: () => { STATE.stats.atk *= 1.225; STATE.stats.defense = (STATE.stats.defense || 0) + 18; STATE.stats.regen = (STATE.stats.regen || 0) + 2.7; } },
            { id: 'm_reaper', name: "Faucheuse", rarity: 'mythic', icon: "fa-solid fa-scale-unbalanced", color: '#ff0055', desc: "La mort elle-même.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+36%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+13.5%</span> Critique, <span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Vol de Vie", apply: () => { STATE.stats.atk *= 1.36; STATE.stats.crit += 0.135; STATE.stats.lifesteal += 0.054; } },
            { id: 'm_genesis', name: "Genèse", rarity: 'mythic', icon: "fas fa-burst", color: '#ff0055', desc: "Un nouveau commencement.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+36%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+4.5</span> Régén/s, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Défense", apply: () => { STATE.stats.maxHp *= 1.36; STATE.stats.regen = (STATE.stats.regen || 0) + 4.5; STATE.stats.defense = (STATE.stats.defense || 0) + 9; if (Globals.player) { Globals.player.maxHp *= 1.36; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'm_apex_mythic', name: "Apogée Mythique", rarity: 'mythic', icon: "fa-solid fa-scroll", color: '#ff0055', desc: "La maîtrise ultime.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+18%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+5.4%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Critique, <span style='color:#e74c3c; font-weight:bold;'>-9%</span> Cooldowns", apply: () => { STATE.stats.atk *= 1.18; STATE.stats.maxHp *= 1.09; applySprint(0.09); applyAtkSpeed(5.4); STATE.stats.crit += 0.09; STATE.stats.cdMod *= 0.91; if (Globals.player) { Globals.player.maxHp *= 1.09; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'm_paradox', name: "Paradoxe Infini", rarity: 'mythic', icon: "fas fa-infinity", color: '#ff0055', desc: "Le temps se plie en boucle.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+27%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-13.5%</span> Cooldowns, <span style='color:#e74c3c; font-weight:bold;'>-10.8%</span> PV Max", apply: () => { STATE.stats.atk *= 1.27; STATE.stats.cdMod *= 0.865; STATE.stats.maxHp *= 0.892; if (Globals.player) { Globals.player.maxHp *= 0.892; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'm_singularity', name: "Singularité", rarity: 'mythic', icon: "fas fa-circle-dot", color: '#ff0055', desc: "Tout s'effondre vers votre frappe.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+40.5%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+16.2%</span> Chance Critique, <span style='color:#e74c3c; font-weight:bold;'>-22.5%</span> PV Max", apply: () => { STATE.stats.atk *= 1.405; STATE.stats.crit += 0.162; STATE.stats.maxHp *= 0.775; if (Globals.player) { Globals.player.maxHp *= 0.775; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'm_aegis', name: "Égide du Monde", rarity: 'mythic', icon: "fas fa-shield-halved", color: '#ff0055', desc: "Le monde lui-même vous protège.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+31.5%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+22.5</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+3.6</span> Régén/s", apply: () => { STATE.stats.maxHp *= 1.315; STATE.stats.defense = (STATE.stats.defense || 0) + 22.5; STATE.stats.regen = (STATE.stats.regen || 0) + 3.6; if (Globals.player) { Globals.player.maxHp *= 1.315; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'm_chainlord', name: "Seigneur des Chaînes", rarity: 'mythic', icon: "fas fa-network-wired", color: '#ff0055', desc: "Tous les ennemis sont liés à vous.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+25.2%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+10.8%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+9%</span> Vitesse d'attaque", apply: () => { STATE.stats.atk *= 1.252; STATE.stats.crit += 0.108; applyAtkSpeed(9); } },
            { id: 'm_prismatic', name: "Cœur Prismatique", rarity: 'mythic', icon: "fas fa-gem", color: '#ff0055', desc: "L'essence pure du prisme.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10.8%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+10.8%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+10.8%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+7.2%</span> Critique, <span style='color:#e74c3c; font-weight:bold;'>-10.8%</span> Cooldowns", apply: () => { STATE.stats.atk *= 1.108; STATE.stats.maxHp *= 1.108; applySprint(0.108); applyAtkSpeed(7.2); STATE.stats.crit += 0.072; STATE.stats.cdMod *= 0.892; if (Globals.player) { Globals.player.maxHp *= 1.108; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } }
        ];

        const options = [...commonFragments, ...rareFragments, ...epicFragments, ...legendaryFragments, ...mythicFragments];
        this.allFragmentsList = options;

        const weightedOptions = [];
        const luckPrism = (STATE.gameOptions && STATE.gameOptions.luckMultPrismatic !== undefined) ? STATE.gameOptions.luckMultPrismatic : 1.0;
        options.forEach(opt => {
            let weight = 1;
            if (opt.rarity === 'common') weight = 1000;
            if (opt.rarity === 'rare') weight = Math.round(200 * luckPrism);
            if (opt.rarity === 'epic') weight = Math.round(100 * luckPrism * luckPrism);
            if (opt.rarity === 'legendary') weight = Math.round(50 * luckPrism * luckPrism * luckPrism);
            if (opt.rarity === 'mythic') weight = Math.round(10 * luckPrism * luckPrism * luckPrism * luckPrism);
            opt.weight = weight;
            for (let i = 0; i < weight; i++) weightedOptions.push(opt);
        });

        this.totalWeight = weightedOptions.length;
        const selection = [];
        while (selection.length < 3) {
            const pick = weightedOptions[Math.floor(Math.random() * weightedOptions.length)];
            if (!selection.some(s => s.id === pick.id)) selection.push(pick);
        }
        return selection;
    },

    selectReward: function (reward) {
        const modal = document.getElementById('prismatic-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
        STATE.isPaused = false;
        if (reward.apply) reward.apply();
        STATE.collectedFragments = STATE.collectedFragments || [];
        STATE.collectedFragments.push({
            ...reward,
            uid: Date.now() + Math.random(),
            enchanted: false,
            enchantLevel: 0,
            name: reward.name.replace(/★|x\d+\s*/g, '').trim(),
        });
        this.updateFragmentsTab();
        if (window.UI) {
            window.UI.toast(`Fragment absorbé : ${reward.name}`);
            window.UI.updateHUD();
        }
        const pIcon = document.getElementById('prismatic-icon');
        if (pIcon) { pIcon.style.color = reward.color; pIcon.innerHTML = `<i class="${reward.icon}"></i>`; }
        if (window.NewSkillUI && window.NewSkillUI.updateInfoTab) window.NewSkillUI.updateInfoTab();
        if (window.ForgeUI) window.ForgeUI.update();

        this.recalculateStats();
    },

    getRandomFragmentByRarity: function (rarity) {
        if (!this.allFragmentsList) this.generatePrismaticOptions();
        const pool = this.allFragmentsList.filter(f => f.rarity === rarity);
        if (pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }
};
