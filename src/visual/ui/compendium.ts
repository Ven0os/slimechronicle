// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { AudioSys } from '@/core/ressources';
import { HUDEnchant } from '@/visual/ui/hud_enchant';

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
        const ownedEl = document.getElementById('prism-stat-owned');
        const favEl = document.getElementById('prism-stat-fav');
        if (!totalEl && !ownedEl && !favEl) return;

        const total = this.allFragmentsList.length;
        const ownedIds = STATE.collectedFragments
            ? new Set(STATE.collectedFragments.map(f => f.id))
            : new Set();

        if (totalEl) totalEl.textContent = String(total);
        if (ownedEl) ownedEl.textContent = String(ownedIds.size);
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

        if (Globals.player.applyClassStats) Globals.player.applyClassStats(true);

        STATE.passives = { etherSteps: [] };

        if (STATE.collectedFragments) {
            STATE.collectedFragments.forEach(frag => {
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
        if (item.enchanted) {
            const enchantInfo = this.getUniqueEnchantment(item);
            enchantLine = `<span class="prism-stat-enchant">✦ ${enchantInfo.title}</span>`;
        }

        const badges = [];
        if (mode === 'view' && isOwned) badges.push('<span class="prism-badge prism-badge-owned">Acquis</span>');
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

        if (item.enchanted) {
            const enchantInfo = this.getUniqueEnchantment(item);
            enchantStatsHTML = `
                <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); width:100%;">
                    <div style="color:#ffd700; font-size:0.8rem; font-weight:bold; letter-spacing:1px; margin-bottom:4px;">
                        <i class="fas fa-arrow-up"></i> NIVEAU ${lvl}
                    </div>
                    <div style="color:#fff; font-size:0.85rem; text-shadow:0 0 5px ${item.color};">
                        ✦ ${enchantInfo.title}
                    </div>
                </div>
            `;
        }

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

        const enchantInfo = this.getUniqueEnchantment(targetFrag);
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

            const titleText = targetFrag.enchanted ? "ENCHANTEMENT ACTIF" : "POTENTIEL CACHÉ";
            const titleColor = targetFrag.enchanted ? "#ffd700" : "#888";
            const lvl = targetFrag.enchantLevel || 0;
            const levelDisplay = lvl > 0 ? `<span style="background:#d4af37; color:#000; padding:2px 8px; border-radius:4px; font-size:0.6em; vertical-align:middle; margin-left:10px;">NIV.${lvl}</span>` : "";

            container.innerHTML = `
                <div class="enchant-deep-dive" style="display:flex; gap:40px; width:95vw; max-width:1100px; height:75vh; background:rgba(10,10,15,0.98); border:1px solid ${targetFrag.color}; border-radius:15px; overflow:hidden; box-shadow:0 0 50px rgba(0,0,0,0.8); position:relative;">
                    <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle at 30% 50%, ${targetFrag.color}22, transparent 70%); z-index:0;"></div>
                    <div style="flex:1; padding:40px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-right:1px solid rgba(255,255,255,0.1); z-index:1; position:relative;">
                        <div style="font-size:0.9rem; color:${targetFrag.color}; letter-spacing:4px; margin-bottom:20px; text-transform:uppercase;">Forme Originale</div>
                        <i class="${targetFrag.icon}" style="font-size:6rem; color:${targetFrag.color}; filter:drop-shadow(0 0 20px ${targetFrag.color}); margin-bottom:30px;"></i>
                        <h2 style="font-family:'Cinzel'; font-size:2.5rem; color:#fff; text-align:center;">
                            ${targetFrag.name.replace(/★|x\d+\s*/g, '').trim()} ${levelDisplay}
                        </h2>
                        <div class="prism-card-stats" style="margin-top:20px; font-size:1.05rem; padding:20px 40px;">
                            ${this.formatPrismStatHtml(targetFrag.baseStatText || targetFrag.statText.split('<br>')[0])}
                        </div>
                    </div>
                    <div style="flex:1.2; padding:50px; display:flex; flex-direction:column; justify-content:center; position:relative; z-index:1; background:linear-gradient(to right, rgba(0,0,0,0.2), rgba(0,0,0,0.6));">
                        <div style="position:absolute; top:30px; right:30px; font-family:'Cinzel'; color:#ffd700; opacity:0.1; font-size:8rem;"><i class="fas fa-star"></i></div>
                        <div style="color:${titleColor}; font-size:1rem; letter-spacing:3px; font-weight:bold; margin-bottom:15px; text-transform:uppercase;">${titleText}</div>
                        <h1 style="font-family:'Cinzel'; font-size:3rem; color:#fff; text-shadow:0 0 15px ${targetFrag.color}; margin-bottom:15px; line-height:1.1;">
                            ${enchantInfo.title}
                        </h1>
                        <div style="display:inline-block; background:linear-gradient(45deg, #ffd700, #b8860b); color:#000; padding:6px 16px; font-weight:bold; font-size:0.9rem; border-radius:4px; width:fit-content; margin-bottom:40px; box-shadow:0 0 15px rgba(255,215,0,0.3); font-family:'Lato';">
                            ${enchantInfo.type}
                        </div>
                        <div style="font-size:1.3rem; line-height:1.6; color:#fff; border-left:4px solid #ffd700; padding-left:25px; margin-bottom:50px; text-shadow:0 0 5px rgba(0,0,0,0.5);">
                            ${enchantInfo.desc}
                        </div>
                        <div style="font-style:italic; color:#888; font-size:1rem; text-align:right; margin-top:auto;">
                            "${enchantInfo.lore}"
                        </div>
                    </div>
                    <div onclick="document.getElementById('prismatic-modal').click()"
                         style="position:absolute; top:20px; right:20px; color:#fff; font-size:2rem; cursor:pointer; z-index:20; opacity:0.7; transition:0.2s; background:rgba(0,0,0,0.5); width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;"
                         onmouseover="this.style.opacity=1; this.style.background='rgba(200,50,50,0.8)'" onmouseout="this.style.opacity=0.7; this.style.background='rgba(0,0,0,0.5)'">
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
        if (STATE.collectedFragments) {
            const enchantedItems = STATE.collectedFragments.filter(f => f.enchanted);
            displayItems = [...displayItems, ...enchantedItems];
        }

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

    // --- DICTIONNAIRE DES ENCHANTEMENTS (Diversifiés et équilibrés) ---
    getUniqueEnchantment: function (frag) {
        const id = frag.id.toLowerCase();
        const enchantments = {
            // COMMON - Passifs légers mais utiles
            'c_hp': { title: "RÉSILIENCE MINEURE", type: "PASSIF DÉFENSIF", desc: "Chaque point de PV Max vous octroie <strong style='font-weight: bold;'>0.5%</strong> de réduction des dégâts.", lore: "La survie commence par l'acceptation." },
            'c_atk': { title: "MOMENTUM", type: "PASSIF OFFENSIF", desc: "Après 3 attaques consécutives, votre prochaine attaque inflige <strong style='font-weight: bold;'>15%</strong> de dégâts bonus.", lore: "L'élan est tout." },
            'c_spd': { title: "FOULÉE LÉGÈRE", type: "PASSIF DE SPRINT", desc: "À chaque coup, gagnez <strong style='font-weight: bold;'>5%</strong> de vitesse sprint pendant 2s (Cumulable 3x).", lore: "Le vent vous suit." },
            'c_crit': { title: "COUP DE CHANCE", type: "PASSIF ALÉATOIRE", desc: "Les coups critiques augmentent votre prochaine attaque de <strong style='font-weight: bold;'>10%</strong>.", lore: "La fortune favorise les audacieux." },
            'c_def': { title: "ARMURE ANCIENNE", type: "PASSIF DÉFENSIF", desc: "Les premiers <strong style='font-weight: bold;'>10%</strong> des dégâts subis sont ignorés.", lore: "Les écorchures ne vous atteignent plus." },
            'c_regen': { title: "CICATRISATION", type: "PASSIF DE SURVIE", desc: "Vous régénérez <strong style='font-weight: bold;'>0.2%</strong> de vos PV Max par seconde au repos.", lore: "Le corps se soigne avec patience." },
            'c_xp': { title: "ÉTUDIANT", type: "PASSIF INTELLECTUEL", desc: "Gagner de l'XP accélère votre prochaine attaque de <strong style='font-weight: bold;'>8%</strong>.", lore: "L'apprentissage accélère le combat." },
            'c_lifesteal': { title: "SUSTENTATION", type: "PASSIF RÉGÉNÉRATION", desc: "Le vol de vie génère également <strong style='font-weight: bold;'>25%</strong> du soin en Défense temporaire.", lore: "Ce qui nourrit protège aussi." },
            'c_critdmg': { title: "LAME AFFINÉE", type: "PASSIF OFFENSIF", desc: "Vos critiques gagnent <strong style='font-weight: bold;'>5%</strong> de portée supplémentaire en dégâts.", lore: "Chaque coup compte davantage." },
            'c_berserk': { title: "SOIF DE COMBAT", type: "PASSIF AGRESSIF", desc: "Tuer un ennemi restaure <strong style='font-weight: bold;'>5%</strong> de PV Max et <strong style='font-weight: bold;'>+3%</strong> Attaque pendant 4s.", lore: "Le carnage nourrit votre âme." },
            'c_swiftrisk': { title: "DANSE RAPIDE", type: "PASSIF AGILE", desc: "À chaque esquive, gagnez <strong style='font-weight: bold;'>2</strong> PV/s de regen pendant 3s.", lore: "La vitesse sauve, même sans armure." },
            'c_precision': { title: "VISÉE MÉTHODIQUE", type: "PASSIF TACTIQUE", desc: "Chaque attaque manquée augmente la prochaine de <strong style='font-weight: bold;'>8%</strong>.", lore: "Chaque échec est une leçon." },
            'c_bloodpact': { title: "ÉCHANGE VITAL", type: "PASSIF SACRIFICE", desc: "Perdre <strong style='font-weight: bold;'>5%</strong> PV augmente vos dégâts de <strong style='font-weight: bold;'>2%</strong> pendant 5s.", lore: "La douleur forge la force." },
            'c_focus': { title: "CONCENTRATION", type: "PASSIF MENTAL", desc: "À chaque spell lancé, gagnez <strong style='font-weight: bold;'>1%</strong> de critique (Max <strong style='font-weight: bold;'>10%</strong>) pendant 6s.", lore: "L'esprit façonne le combat." },
            'c_thorns': { title: "ÉPINES MINEURES", type: "PASSIF RÉFLECTIF", desc: "Renvoyez <strong style='font-weight: bold;'>8%</strong> des dégâts reçus à l'attaquant.", lore: "Même les éclats peuvent blesser." },
            'c_chain': { title: "ÉTINCELLE ENCHAÎNÉE", type: "PASSIF OFFENSIF", desc: "<strong style='font-weight: bold;'>15%</strong> de chance qu'un coup touche une <strong style='font-weight: bold;'>2e</strong> fois (50% dégâts).", lore: "Un impact en appelle un autre." },
            'c_haste': { title: "FRÉNÉSIE LÉGÈRE", type: "PASSIF OFFENSIF", desc: "Vos attaques de base s'enchaînent <strong style='font-weight: bold;'>6%</strong> plus vite.", lore: "Les mains ne s'arrêtent plus." },
            'c_ward': { title: "GARDE PRISMATIQUE", type: "PASSIF DÉFENSIF", desc: "Sous <strong style='font-weight: bold;'>80%</strong> PV, gagnez <strong style='font-weight: bold;'>+5%</strong> Défense.", lore: "La prudence devient un bouclier." },

            // RARE - Passifs intermédiaires
            'r_hp': { title: "FORTERESSE VIVANTE", type: "PASSIF DÉFENSIF", desc: "Chaque point de PV Max génère <strong style='font-weight: bold;'>0.2%</strong> de blocage des dégâts futurs.", lore: "La masse elle-même est une arme." },
            'r_atk': { title: "COURROUX SAUVAGE", type: "PASSIF OFFENSIF", desc: "Plus vous avez de PV, plus vos dégâts augmentent : <strong style='font-weight: bold;'>+0.5%</strong> par <strong style='font-weight: bold;'>5%</strong> de PV.", lore: "La force vient de la confiance." },
            'r_spd': { title: "SPRINT ÉTERNEL", type: "PASSIF DE SPRINT", desc: "En combat, gagnez <strong style='font-weight: bold;'>1%</strong> de vitesse sprint par 2 secondes (Max <strong style='font-weight: bold;'>20%</strong>).", lore: "Le mouvement est la vie." },
            'r_crit': { title: "ŒUVRE MORTELLE", type: "PASSIF CRITIQUE", desc: "Les séries de critiques consécutifs augmentent vos stats de <strong style='font-weight: bold;'>3%</strong> chacun (Max <strong style='font-weight: bold;'>5</strong> stacks).", lore: "L'art du coup fatal." },
            'r_life': { title: "PRÉDATEUR", type: "PASSIF VAMPIRIQUE", desc: "Chaque <strong style='font-weight: bold;'>10%</strong> de vol de vie se transforme en <strong style='font-weight: bold;'>2%</strong> de dégâts bonus.", lore: "Boire le sang rend plus fort." },
            'r_cd': { title: "TEMPS FRAGMENTÉ", type: "PASSIF TEMPOREL", desc: "Chaque sort utilisé réduit votre CD moyen de <strong style='font-weight: bold;'>0.5</strong> sec (Max <strong style='font-weight: bold;'>3s</strong> réduction).", lore: "Le temps peut être raccourci." },
            'r_def': { title: "BASTION", type: "PASSIF DÉFENSIF", desc: "Les dégâts bloqués régénèrent <strong style='font-weight: bold;'>10%</strong> de votre Défense en soin.", lore: "La défense devient sagesse." },
            'r_regen': { title: "FLUX VITAL", type: "PASSIF RÉGÉNÉRATION", desc: "Pendant <strong style='font-weight: bold;'>8s</strong> après une attaque, votre regen augmente de <strong style='font-weight: bold;'>0.5/s</strong> par hit.", lore: "La vie coule comme une rivière." },
            'r_xp': { title: "ASCENSION", type: "PASSIF CROISSANCE", desc: "Chaque niveau vous donne <strong style='font-weight: bold;'>+1%</strong> de toutes stats de manière permanente.", lore: "La progression n'a pas de limites." },
            'r_speed_regen': { title: "CYCLONE VITAL", type: "PASSIF HYBRIDE", desc: "La vitesse sprint génère de la regen : <strong style='font-weight: bold;'>+0.1</strong> regen par <strong style='font-weight: bold;'>1%</strong> sprint.", lore: "Le mouvement nourrit l'essence." },
            'r_crit_dmg': { title: "EXECUTION", type: "PASSIF CRITIQUE", desc: "Les coups critiques réduisent les CD de <strong style='font-weight: bold;'>0.3</strong> sec.", lore: "Chaque saignement arrête le temps." },
            'r_thorns': { title: "CARAPACE RÉFLECTIVE", type: "PASSIF RÉFLECTIF", desc: "Renvoyez <strong style='font-weight: bold;'>15%</strong> des dégâts. Chaque renvoi soigne <strong style='font-weight: bold;'>1%</strong> PV Max.", lore: "Votre peau devient une arme." },
            'r_chain': { title: "MAILLON BRISÉ", type: "PASSIF OFFENSIF", desc: "Les coups critiques propagent <strong style='font-weight: bold;'>30%</strong> des dégâts à un ennemi proche.", lore: "La douleur voyage en chaîne." },
            'r_haste': { title: "ROUAGE AFFÛTÉ", type: "PASSIF OFFENSIF", desc: "Tuer un ennemi accélère vos attaques de <strong style='font-weight: bold;'>12%</strong> pendant 5s.", lore: "Le sang lubrifie la machine." },
            'r_skillflow': { title: "FLUX ARCANIQUE", type: "PASSIF DE SORTS", desc: "Chaque sort lancé augmente la vitesse d'attaque de <strong style='font-weight: bold;'>3%</strong> (Max <strong style='font-weight: bold;'>5</strong> stacks).", lore: "Magie et acier s'accordent." },
            'r_execution': { title: "POINTE D'EXÉCUTION", type: "PASSIF CRITIQUE", desc: "Les ennemis sous <strong style='font-weight: bold;'>30%</strong> PV subissent <strong style='font-weight: bold;'>+20%</strong> dégâts critiques.", lore: "Achevez sans hésiter." },

            // EPIC - Passifs puissants
            'e_tank': { title: "COLÈRE PROTECTRICE", type: "PASSIF DÉFENSIF", desc: "Chaque dégât bloqué augmente votre Attaque de <strong style='font-weight: bold;'>0.5%</strong> (Max <strong style='font-weight: bold;'>50%</strong>) jusqu'à la fin du combat.", lore: "Bloquer n'est pas fuir, c'est préparer." },
            'e_glass': { title: "FRAGILITÉ LÉTALE", type: "PASSIF AGRESSIF", desc: "Moins vous avez de PV, plus vos critiques font de dégâts : <strong style='font-weight: bold;'>+1%</strong> par <strong style='font-weight: bold;'>5%</strong> PV manquants.", lore: "Un verre brisé peut trancher." },
            'e_vamp': { title: "ESSAIM AFFAMÉ", type: "PASSIF VAMPIRIQUE", desc: "Chaque <strong style='font-weight: bold;'>0.5%</strong> de vol de vie crée une <strong style='font-weight: bold;'>Aura Vampire</strong> : <strong style='font-weight: bold;'>+2%</strong> dégâts aux alliés proches.", lore: "La faim est contagieuse." },
            'e_time': { title: "CHRONO-SYNCHRONE", type: "PASSIF TEMPOREL", desc: "Après <strong style='font-weight: bold;'>5</strong> sorts lancés, votre prochain spell est gratuit en CD.", lore: "Le temps s'écoule différemment." },
            'e_crit': { title: "FAUCHEUR", type: "PASSIF CRITIQUE", desc: "Les critiques appliquent un <strong style='font-weight: bold;'>Saignement</strong> infligeant <strong style='font-weight: bold;'>3%</strong> Attaque/sec pendant <strong style='font-weight: bold;'>4s</strong>.", lore: "Une blessure qui ne ferme jamais." },
            'e_regen': { title: "RENAISSANCE", type: "PASSIF RÉGÉNÉRATION", desc: "Chaque <strong style='font-weight: bold;'>1</strong> PV régénéré augmente votre Défense de <strong style='font-weight: bold;'>0.1%</strong> temporairement.", lore: "La guérison forge la résistance." },
            'e_berserker': { title: "FUREUR ÉCRASANTE", type: "PASSIF AGRESSIF", desc: "Plus vous attaquez vite, plus chaque coup fait de dégâts : <strong style='font-weight: bold;'>+2%</strong> dégâts par <strong style='font-weight: bold;'>5%</strong> vitesse.", lore: "La rage explose avec la vélocité." },
            'e_swift': { title: "FANTÔME", type: "PASSIF DE MOUVEMENT", desc: "La vitesse génère des <strong style='font-weight: bold;'>Échos</strong> : tous les <strong style='font-weight: bold;'>3</strong> coups, frappez une <strong style='font-weight: bold;'>2e</strong> fois.", lore: "Vous êtes partout et nulle part." },
            'e_fortress': { title: "CŒUR DE PIERRE", type: "PASSIF DÉFENSIF", desc: "Chaque dégât reçu renforce votre prochaine défense de <strong style='font-weight: bold;'>5%</strong> (Max <strong style='font-weight: bold;'>50%</strong>).", lore: "La pierre ne peut pas être brisée deux fois." },
            'e_siphon': { title: "DOUBLE ABSORPTION", type: "PASSIF HYBRIDE", desc: "Le vol de vie soigne <strong style='font-weight: bold;'>2x</strong> plus mais redonne aussi <strong style='font-weight: bold;'>+0.5%</strong> réduction CD.", lore: "Tout ce qui vit peut être repris." },
            'e_thorns': { title: "COURONNE D'ÉPINES", type: "PASSIF RÉFLECTIF", desc: "Renvoyez <strong style='font-weight: bold;'>25%</strong> des dégâts en zone autour de vous.", lore: "Approchez, et saignez." },
            'e_chain': { title: "CHAÎNE LUMINEUSE", type: "PASSIF OFFENSIF", desc: "Tous les <strong style='font-weight: bold;'>4</strong> coups, libérez une onde qui frappe jusqu'à <strong style='font-weight: bold;'>3</strong> ennemis.", lore: "La lumière ne frappe qu'une fois — en apparence." },
            'e_overclock': { title: "SURCHARGE TOTALE", type: "PASSIF OFFENSIF", desc: "Vitesse d'attaque et cooldowns améliorés de <strong style='font-weight: bold;'>10%</strong>, mais <strong style='font-weight: bold;'>-1%</strong> PV Max par seconde en combat.", lore: "Brûler pour aller plus vite." },
            'e_phoenix': { title: "CENDRE RENAISSANTE", type: "PASSIF DE RÉSURRECTION", desc: "Une fois par run : à <strong style='font-weight: bold;'>0</strong> PV, revenez à <strong style='font-weight: bold;'>35%</strong> PV Max.", lore: "Les cendres ne sont pas une fin." },
            'e_void': { title: "TOUCHER DU VIDE", type: "PASSIF AGRESSIF", desc: "Vos attaques ignorent <strong style='font-weight: bold;'>12%</strong> de la Défense ennemie.", lore: "Le néant ne rencontre pas de résistance." },

            // LEGENDARY - Passifs très puissants
            'l_titan': { title: "MASSE INÉBRANLABLE", type: "PASSIF GÉANT", desc: "Vos PV Max amplifient tout : <strong style='font-weight: bold;'>+1%</strong> dégâts, <strong style='font-weight: bold;'>+0.5%</strong> Défense par <strong style='font-weight: bold;'>5%</strong> PV.", lore: "Vous êtes un mur vivant qui attaque." },
            'l_god': { title: "DIVINE WRATH", type: "PASSIF DIVIN", desc: "Chaque attaque génère une <strong style='font-weight: bold;'>Auréole Divine</strong> : <strong style='font-weight: bold;'>+3%</strong> dégâts pour <strong style='font-weight: bold;'>3s</strong>, cumulable <strong style='font-weight: bold;'>5x</strong>.", lore: "La puissance des dieux coule en vous." },
            'l_flash': { title: "VORTEX TEMPOREL", type: "PASSIF VÉLOCE", desc: "À chaque hit, gagnez <strong style='font-weight: bold;'>3%</strong> sprint et <strong style='font-weight: bold;'>+2%</strong> vitesse d'attaque (Max <strong style='font-weight: bold;'>30%</strong> sprint).", lore: "Vous traversez le temps comme l'air." },
            'l_eye': { title: "CHASSEUR NÉ", type: "PASSIF CRITIQUE", desc: "Les coups critiques appliquent <strong style='font-weight: bold;'>Marquage</strong> : <strong style='font-weight: bold;'>+25%</strong> dégâts aux ennemis marqués.", lore: "Votre proie ne peut pas s'échapper." },
            'l_chrono': { title: "MAITRE TEMPOREL", type: "PASSIF TEMPOREL", desc: "Les réductions de CD s'amplifient : chaque réduction de <strong style='font-weight: bold;'>1s</strong> donne <strong style='font-weight: bold;'>+1%</strong> dégâts pendant <strong style='font-weight: bold;'>5s</strong>.", lore: "Vous domplez le temps lui-même." },
            'l_blood': { title: "SEIGNEUR VAMPIRE", type: "PASSIF HÉMORRAGIE", desc: "Le vol de vie triple les Saignements créés : <strong style='font-weight: bold;'>Saignements infligent 2x plus</strong> et régénèrent à vous.", lore: "Boire le sang du monde." },
            'l_apex': { title: "APOGÉE GUERRIER", type: "PASSIF UNIVERSEL", desc: "Tous les passifs sont amplifiés de <strong style='font-weight: bold;'>30%</strong> et gagnent <strong style='font-weight: bold;'>+5%</strong> d'efficacité.", lore: "Vous êtes le sommet incontesté." },
            'l_fortuna': { title: "JUGE DU DESTIN", type: "PASSIF CHANCE", desc: "La chance amplifie tout : <strong style='font-weight: bold;'>+0.5%</strong> dégâts, Attaque et sprint par <strong style='font-weight: bold;'>1%</strong> critique.", lore: "Le destin s'écrit avec votre sang." },
            'l_immortal_regen': { title: "IMMORTALITÉ VÉRITABLE", type: "PASSIF ÉTERNEL", desc: "La regen se transforme en <strong style='font-weight: bold;'>Bouclier Éternel</strong> : chaque point régénéré protège <strong style='font-weight: bold;'>5%</strong> bonus.", lore: "La mort oublie votre nom." },
            'l_swift_dancer': { title: "DANSEUR DES MONDES", type: "PASSIF GRACIEUX", desc: "À chaque déplacement, gagnez <strong style='font-weight: bold;'>3%</strong> esquive et <strong style='font-weight: bold;'>-10%</strong> des dégâts suivants (Max <strong style='font-weight: bold;'>5</strong> stacks).", lore: "Vous dansez dans l'espace entre les coups." },
            'l_thorns': { title: "FORÊT D'ÉPINES", type: "PASSIF RÉFLECTIF", desc: "Renvoyez <strong style='font-weight: bold;'>40%</strong> des dégâts. Les renvois appliquent <strong style='font-weight: bold;'>Saignement</strong>.", lore: "Une forteresse qui contre-attaque." },
            'l_chain': { title: "MAÎTRE DES MAILLONS", type: "PASSIF OFFENSIF", desc: "Chaque kill enchaîne un éclair sur <strong style='font-weight: bold;'>2</strong> ennemis (60% Attaque).", lore: "La mort se propage." },
            'l_overdrive': { title: "MOTEUR CÉLESTE", type: "PASSIF OFFENSIF", desc: "En combat, vitesse d'attaque et sprint augmentent de <strong style='font-weight: bold;'>1%/s</strong> (Max <strong style='font-weight: bold;'>25%</strong>).", lore: "Vous devenez une tempête mécanique." },
            'l_soulbind': { title: "PACTE D'ÂMES", type: "PASSIF VAMPIRIQUE", desc: "Le vol de vie convertit <strong style='font-weight: bold;'>50%</strong> du surplus en Attaque pendant 6s.", lore: "Leur essence devient votre lame." },
            'l_arcane': { title: "ORBE D'INFUSION", type: "PASSIF DE SORTS", desc: "Tous vos sorts infligent <strong style='font-weight: bold;'>+15%</strong> dégâts et réduisent les CD de <strong style='font-weight: bold;'>0.5s</strong>.", lore: "La magie coule sans entrave." },

            // MYTHIC - Passifs transcendants
            'm_omni': { title: "OMNISCIENCE", type: "PASSIF TRANSCENDANT", desc: "Tous les passifs sont <strong style='font-weight: bold;'>doublés en puissance</strong>. Les stats se potentialisent mutuellement.", lore: "Vous dépassez les limites de la réalité." },
            'm_immortal': { title: "ÉTERNITÉ", type: "PASSIF ABSOLU", desc: "Vous n'avez pas de limite augmentes vos dégâts d'une valeur équivalente a <strong style='font-weight: bold;'>25%</strong> de vos PV Actuels.", lore: "Ni mort ni vie, juste existence." },
            'm_destroyer': { title: "APOCALYPSE", type: "PASSIF DÉVASTATEUR", desc: "Chaque attaque inflige une <strong style='font-weight: bold;'>Onde de Choc</strong> : dégâts<strong style='font-weight: bold;'>+20%</strong>, zone<strong style='font-weight: bold;'>+100%</strong> rayon.", lore: "Vous êtes la fin de toutes choses." },
            'm_warp': { title: "DISCONTINUITÉ SPATIALE", type: "PASSIF TRANSCENDANT", desc: "Vous existez partout et nulle part : <strong style='font-weight: bold;'>+100%</strong> esquive, <strong style='font-weight: bold;'>-50%</strong> temps de voyage.", lore: "L'espace n'a pas de sens pour vous." },
            'm_vampire_lord': { title: "COMTE ÉTERNEL", type: "PASSIF SANGUINAIRE", desc: "Chaque vol de vie restaure PV, Défense, sprint et réduit les CD à hauteur de <strong style='font-weight: bold;'>10%</strong> du soin.", lore: "Boire le sang du monde et renaître." },
            'm_glass_cannon_plus': { title: "VERRE BRISÉ", type: "PASSIF FRAGILE", desc: "Plus fragile = plus fort : chaque <strong style='font-weight: bold;'>5%</strong> PV manquants = <strong style='font-weight: bold;'>+5%</strong> dégâts, sans limite.", lore: "Vivre au bord du gouffre." },
            'm_chaos': { title: "ENTROPIC STORM", type: "PASSIF CHAOTIQUE", desc: "L'aléa devient certitude : tous les effets aléatoires deviennent garantis à <strong style='font-weight: bold;'>50%</strong> puissance.", lore: "Le chaos a ses propres règles." },
            'm_twilight': { title: "ENTRE-DEUX", type: "PASSIF DUALISTE", desc: "Vous existez dans deux états : <strong style='font-weight: bold;'>+50%</strong> stats offensives ET défensives simultanément.", lore: "Jour et nuit dans un seul corps." },
            'm_reaper': { title: "FAUCHEUSE SUPRÊME", type: "PASSIF MORTEL", desc: "Chaque kill amplifie vos stats : <strong style='font-weight: bold;'>+10%</strong> Attaque, <strong style='font-weight: bold;'>+5%</strong> sprint, <strong style='font-weight: bold;'>+2%</strong> Vol de Vie (permanent).", lore: "La mort vous rend plus forte à chaque fois." },
            'm_genesis': { title: "RECRÉATION", type: "PASSIF PRIMORDIAL", desc: "Vous régénérez entièrement chaque minute : tous les effets négatifs disparaissent.", lore: "Vous êtes l'aube nouvelle." },
            'm_apex_mythic': { title: "PERFECTION ABSOLUE", type: "PASSIF DIVIN", desc: "Tous les passifs atteignent leur potentiel maximal. Vous êtes la perfection incarnée.", lore: "Au-delà de tout, c'est vous." },
            'm_paradox': { title: "BOUCLE PARADOXALE", type: "PASSIF TEMPOREL", desc: "Chaque sort utilisé accélère le suivant de <strong style='font-weight: bold;'>20%</strong> CD (cumulable).", lore: "Cause et effet s'entremêlent." },
            'm_singularity': { title: "EFFONDREMENT", type: "PASSIF GRAVITATIONNEL", desc: "Vos coups attirent les ennemis et infligent <strong style='font-weight: bold;'>+30%</strong> dégâts en zone.", lore: "Tout est aspiré vers votre frappe." },
            'm_aegis': { title: "ÉGIDE DU MONDE", type: "PASSIF ABSOLU", desc: "Les premiers <strong style='font-weight: bold;'>30%</strong> des dégâts d'un coup sont annulés. Régénère <strong style='font-weight: bold;'>2%</strong> PV Max/s.", lore: "Le monde lui-même vous protège." },
            'm_chainlord': { title: "SEIGNEUR DES CHAÎNES", type: "PASSIF DOMINATION", desc: "Chaque ennemi touché augmente vos dégâts de <strong style='font-weight: bold;'>3%</strong> (Max <strong style='font-weight: bold;'>10</strong> stacks) pendant 8s.", lore: "Tous sont liés à votre volonté." },
            'm_prismatic': { title: "CŒUR PRISMATIQUE", type: "PASSIF TRANSCENDANT", desc: "Toutes vos stats de base sont amplifiées de <strong style='font-weight: bold;'>+15%</strong>. Les effets prismatiques durent <strong style='font-weight: bold;'>2x</strong> plus longtemps.", lore: "Vous êtes devenu le prisme lui-même." }
        };

        // Retrouver l'enchantement spécifique ou appliquer un passif générique
        if (enchantments[id]) {
            return enchantments[id];
        }

        // Passif générique par catégorie
        if (id.includes('hp') || id.includes('vie') || id.includes('tank')) {
            return { title: "RÉSILIENCE", type: "PASSIF DÉFENSIF", desc: "Les PV renforcent votre défense et votre survie.", lore: "La vie elle-même est votre protection." };
        }
        if (id.includes('atk') || id.includes('force')) {
            return { title: "OFFENSIVE", type: "PASSIF AGRESSIF", desc: "L'attaque amplifie vos coups suivants.", lore: "La force crée plus de force." };
        }
        if (id.includes('spd') || id.includes('vent')) {
            return { title: "VÉLOCITÉ", type: "PASSIF DE MOUVEMENT", desc: "La vitesse génère d'autres avantages.", lore: "Le mouvement est la solution." };
        }
        if (id.includes('crit')) {
            return { title: "COUP CRITIQUE", type: "PASSIF CRITIQUE", desc: "Les critiques ont des effets spéciaux.", lore: "Chaque coup compte." };
        }
        if (id.includes('regen')) {
            return { title: "RÉGÉNÉRATION", type: "PASSIF DE SURVIE", desc: "La guérison renforce votre essence.", lore: "Le temps soigne toutes les plaies." };
        }
        if (id.includes('cd')) {
            return { title: "TEMPOREL", type: "PASSIF TEMPOREL", desc: "Les cooldowns se raccourcissent naturellement.", lore: "Le temps s'accélère." };
        }
        if (id.includes('lifesteal')) {
            return { title: "VAMPIRIQUE", type: "PASSIF RÉGÉNÉRATION", desc: "Boire le sang vous renforce.", lore: "La vie des autres devient la vôtre." };
        }
        if (id.includes('def')) {
            return { title: "DÉFENSIVE", type: "PASSIF DÉFENSIF", desc: "La protection amplifie vos capacités.", lore: "La défense est la meilleure attaque." };
        }
        if (id.includes('xp')) {
            return { title: "APPRENTISSAGE", type: "PASSIF CROISSANCE", desc: "La connaissance vous rend plus fort.", lore: "L'expérience est le pouvoir." };
        }

        return { title: "ÉVEIL PRISMATIQUE", type: "BOOST GLOBAL", desc: "Une puissance prismatique s'éveille en vous.", lore: "Une énergie brute et instable émane de l'objet." };
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
            { id: 'c_hp', name: "Éclat de Vie", rarity: 'common', icon: "fas fa-heart", color: '#bdc3c7', desc: "Un petit coup de pouce.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4%</span> PV Max", apply: () => { STATE.stats.maxHp *= 1.04; if (Globals.player) { Globals.player.maxHp *= 1.04; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'c_atk', name: "Éclat de Force", rarity: 'common', icon: "fas fa-fist-raised", color: '#bdc3c7', desc: "Frappez un peu plus fort.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4%</span> Attaque", apply: () => { STATE.stats.atk *= 1.04; } },
            { id: 'c_spd', name: "Éclat de Vent", rarity: 'common', icon: "fas fa-wind", color: '#bdc3c7', desc: "Déplacement plus rapide (sprint).", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4%</span> Vitesse sprint", apply: () => { applySprint(0.04); } },
            { id: 'c_crit', name: "Éclat de Chance", rarity: 'common', icon: "fas fa-dice", color: '#bdc3c7', desc: "La chance tourne.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+2%</span> Chance Critique", apply: () => { STATE.stats.crit += 0.02; } },
            { id: 'c_def', name: "Éclat de Bouclier", rarity: 'common', icon: "fas fa-shield", color: '#bdc3c7', desc: "Une légère protection.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+2%</span> Défense", apply: () => { STATE.stats.def = STATE.stats.def || 0; STATE.stats.def += 2; } },
            { id: 'c_regen', name: "Éclat de Régénération", rarity: 'common', icon: "fas fa-heartbeat", color: '#bdc3c7', desc: "La vie coule doucement.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+0.3</span> Régén/s", apply: () => { STATE.stats.regen = (STATE.stats.regen || 0) + 0.3; } },
            { id: 'c_xp', name: "Éclat d\'Expérience", rarity: 'common', icon: "fas fa-star", color: '#bdc3c7', desc: "Un peu plus d'EXP.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4%</span> EXP", apply: () => { STATE.stats.xpMod = (STATE.stats.xpMod || 1.0) * 1.04; } },
            { id: 'c_lifesteal', name: "Éclat de Drain", rarity: 'common', icon: "fas fa-droplet", color: '#bdc3c7', desc: "Un peu de vol de vie.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+0.25%</span> Vol de Vie", apply: () => { STATE.stats.lifesteal = (STATE.stats.lifesteal || 0) + 0.0025; } },
            { id: 'c_critdmg', name: "Éclat de Vengeance", rarity: 'common', icon: "fas fa-fire", color: '#bdc3c7', desc: "Plus de dégâts critiques.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3%</span> Dégâts Critique", apply: () => { STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.03; } },
            { id: 'c_berserk', name: "Éclat Berserk", rarity: 'common', icon: "fas fa-skull", color: '#bdc3c7', desc: "Puissance contre survie.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-3%</span> PV Max", apply: () => { STATE.stats.atk *= 1.08; STATE.stats.maxHp *= 0.96; if (Globals.player) { Globals.player.maxHp *= 0.97; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'c_swiftrisk', name: "Éclat de Célérité Instable", rarity: 'common', icon: "fas fa-running", color: '#bdc3c7', desc: "Sprint rapide, armure légère.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Vitesse sprint, <span style='color:#e74c3c; font-weight:bold;'>-4%</span> Défense", apply: () => { applySprint(0.08); STATE.stats.def = (STATE.stats.def || 0) - 4; } },
            { id: 'c_precision', name: "Éclat de Précision", rarity: 'common', icon: "fas fa-crosshairs", color: '#bdc3c7', desc: "Frappez juste, pas fort.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+6%</span> Chance Critique, <span style='color:#e74c3c; font-weight:bold;'>-3%</span> Attaque", apply: () => { STATE.stats.crit += 0.06; STATE.stats.atk *= 0.97; } },
            { id: 'c_bloodpact', name: "Éclat du Pacte Sanglant", rarity: 'common', icon: "fas fa-tint", color: '#bdc3c7', desc: "La vie contre la puissance.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+0.5%</span> Vol de Vie, <span style='color:#e74c3c; font-weight:bold;'>-3%</span> PV Max", apply: () => { STATE.stats.lifesteal = (STATE.stats.lifesteal || 0) + 0.005; STATE.stats.maxHp *= 0.96; if (Globals.player) { Globals.player.maxHp *= 0.97; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'c_focus', name: "Éclat de Concentration", rarity: 'common', icon: "fas fa-brain", color: '#bdc3c7', desc: "Moins mobile, sorts plus rapides.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-4%</span> Vitesse sprint, <span style='color:#e74c3c; font-weight:bold;'>-3%</span> Cooldowns", apply: () => { applySprint(-0.04); STATE.stats.cdMod = (STATE.stats.cdMod || 1.0) * 0.97; } },
            { id: 'c_thorns', name: "Éclat d'Épines", rarity: 'common', icon: "fas fa-icicles", color: '#bdc3c7', desc: "Des pointes qui mordent en retour.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4</span> Défense", apply: () => { STATE.stats.def = (STATE.stats.def || 0) + 4; } },
            { id: 'c_chain', name: "Éclat de Liaison", rarity: 'common', icon: "fas fa-link", color: '#bdc3c7', desc: "Un coup en entraîne un autre.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+1%</span> Chance Critique", apply: () => { STATE.stats.atk *= 1.03; STATE.stats.crit += 0.01; } },
            { id: 'c_haste', name: "Éclat de Frénésie", rarity: 'common', icon: "fas fa-bolt-lightning", color: '#bdc3c7', desc: "Frappez plus souvent.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+6%</span> Vitesse d'attaque", apply: () => { applyAtkSpeed(6); } },
            { id: 'c_ward', name: "Éclat de Protection", rarity: 'common', icon: "fas fa-shield-heart", color: '#bdc3c7', desc: "Un bouclier discret mais fiable.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+3%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+3</span> Défense", apply: () => { STATE.stats.maxHp *= 1.03; STATE.stats.def = (STATE.stats.def || 0) + 3; if (Globals.player) { Globals.player.maxHp *= 1.03; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } }

        ];

        // === RARE (100 weight) ===
        const rareFragments = [
            { id: 'r_hp', name: "Cristal de Vitalité", rarity: 'rare', icon: "fas fa-shield-alt", color: '#3498db', desc: "Une protection fiable.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> PV Max", apply: () => { STATE.stats.maxHp *= 1.08; if (Globals.player) { Globals.player.maxHp *= 1.08; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'r_atk', name: "Cristal de Guerre", rarity: 'rare', icon: "fas fa-skull-crossbones", color: '#3498db', desc: "Pour les guerriers aguerris.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Attaque", apply: () => { STATE.stats.atk *= 1.08; } },
            { id: 'r_spd', name: "Bottes de Célérité", rarity: 'rare', icon: "fas fa-shoe-prints", color: '#3498db', desc: "Ne regardez pas en arrière.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Vitesse sprint", apply: () => { applySprint(0.08); } },
            { id: 'r_crit', name: "Lentille de Précision", rarity: 'rare', icon: "fas fa-bullseye", color: '#3498db', desc: "Visez juste.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4%</span> Chance Critique", apply: () => { STATE.stats.crit += 0.04; } },
            { id: 'r_life', name: "Fiole de Sang", rarity: 'rare', icon: "fas fa-vial", color: '#3498db', desc: "Un goût métallique.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1%</span> Vol de Vie", apply: () => { STATE.stats.lifesteal += 0.01; } },
            { id: 'r_cd', name: "Rouage Ancien", rarity: 'rare', icon: "fas fa-cog", color: '#3498db', desc: "La mécanique est fluide.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-4%</span> Cooldowns", apply: () => { STATE.stats.cdMod *= 0.96; } },
            { id: 'r_def', name: "Armure Renforcée", rarity: 'rare', icon: "fas fa-helmet-safety", color: '#3498db', desc: "Meilleure protection.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+6%</span> Défense", apply: () => { STATE.stats.def = (STATE.stats.def || 0) + 6; } },
            { id: 'r_regen', name: "Potion Éternelle", rarity: 'rare', icon: "fas fa-flask", color: '#3498db', desc: "La régénération accélère.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.2</span> Régén/s", apply: () => { STATE.stats.regen = (STATE.stats.regen || 0) + 1.2; } },
            { id: 'r_xp', name: "Gemme de Savoir", rarity: 'rare', icon: "fas fa-gem", color: '#3498db', desc: "L'apprentissage s'accélère.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> EXP", apply: () => { STATE.stats.xpMod = (STATE.stats.xpMod || 1.0) * 1.08; } },
            { id: 'r_speed_regen', name: "Élan Vital", rarity: 'rare', icon: "fas fa-wind", color: '#3498db', desc: "Sprint et régénération.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+4%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+0.8</span> Régén/s", apply: () => { applySprint(0.04); STATE.stats.regen = (STATE.stats.regen || 0) + 0.8; } },
            { id: 'r_crit_dmg', name: "Cristal Étincelant", rarity: 'rare', icon: "fas fa-gem", color: '#3498db', desc: "Critiques plus puissants.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Dégâts Critique", apply: () => { STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.08; } },
            { id: 'r_thorns', name: "Cristal Réflecteur", rarity: 'rare', icon: "fas fa-shield-virus", color: '#3498db', desc: "Renvoie la violence reçue.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+4%</span> PV Max", apply: () => { STATE.stats.def = (STATE.stats.def || 0) + 8; STATE.stats.maxHp *= 1.04; if (Globals.player) { Globals.player.maxHp *= 1.04; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'r_chain', name: "Maillon Brisé", rarity: 'rare', icon: "fas fa-link-slash", color: '#3498db', desc: "La douleur se propage.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+6%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+4%</span> Dégâts Critique", apply: () => { STATE.stats.atk *= 1.06; STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.04; } },
            { id: 'r_haste', name: "Rouage Affûté", rarity: 'rare', icon: "fas fa-gears", color: '#3498db', desc: "Mécanique et mouvement fusionnés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+4%</span> Vitesse sprint", apply: () => { applyAtkSpeed(8); applySprint(0.04); } },
            { id: 'r_skillflow', name: "Flux Arcanique", rarity: 'rare', icon: "fas fa-wand-sparkles", color: '#3498db', desc: "Sorts et attaques s'alimentent.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-6%</span> Cooldowns, <span style='color:#2ecc71; font-weight:bold;'>+5%</span> Attaque", apply: () => { STATE.stats.cdMod *= 0.94; STATE.stats.atk *= 1.05; } },
            { id: 'r_execution', name: "Pointe d'Exécution", rarity: 'rare', icon: "fas fa-skull", color: '#3498db', desc: "Achève les blessés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+5%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+6%</span> Dégâts Critique", apply: () => { STATE.stats.crit += 0.05; STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.06; } }
        ];

        // === EPIC (15 weight) ===
        const epicFragments = [
            { id: 'e_tank', name: "Forteresse Ambulante", rarity: 'epic', icon: "fas fa-dungeon", color: '#9b59b6', desc: "Devenez inébranlable.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10%</span> PV Max, <span style='color:#e74c3c; font-weight:bold;'>-3%</span> Vitesse sprint", apply: () => { STATE.stats.maxHp *= 1.10; applySprint(-0.03); if (Globals.player) { Globals.player.maxHp *= 1.10; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'e_glass', name: "Canon de Verre", rarity: 'epic', icon: "fas fa-crosshairs", color: '#9b59b6', desc: "Tout dans l'attaque.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+15%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-7%</span> PV Max", apply: () => { STATE.stats.atk *= 1.15; STATE.stats.maxHp *= 0.93; if (Globals.player) { Globals.player.maxHp *= 0.93; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'e_vamp', name: "Soif Éternelle", rarity: 'epic', icon: "fas fa-tooth", color: '#9b59b6', desc: "Le combat vous nourrit.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.25%</span> Vol de Vie", apply: () => { STATE.stats.lifesteal += 0.0125; } },
            { id: 'e_time', name: "Montre à Gousset", rarity: 'epic', icon: "fas fa-stopwatch", color: '#9b59b6', desc: "Le temps presse.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-5%</span> Cooldowns", apply: () => { STATE.stats.cdMod *= 0.95; } },
            { id: 'e_crit', name: "Regard Mortel", rarity: 'epic', icon: "fas fa-eye-slash", color: '#9b59b6', desc: "Chaque coup compte.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+5%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+7%</span> Dégâts Critique", apply: () => { STATE.stats.crit += 0.05; STATE.stats.critDmg += 0.07; } },
            { id: 'e_regen', name: "Cœur Troll", rarity: 'epic', icon: "fas fa-biohazard", color: '#9b59b6', desc: "Ça repousse vite.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.2</span> Régén/s, <span style='color:#2ecc71; font-weight:bold;'>+7%</span> PV Max", apply: () => { STATE.stats.regen += 1.2; STATE.stats.maxHp *= 1.07; } },
            { id: 'e_berserker', name: "Furie Primale", rarity: 'epic', icon: "fas fa-explosion", color: '#9b59b6', desc: "Frappes frénétiques.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+2%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+5%</span> Vitesse d'attaque", apply: () => { STATE.stats.atk *= 1.10; STATE.stats.crit += 0.02; applyAtkSpeed(5); } },
            { id: 'e_swift', name: "Agilité Accrue", rarity: 'epic', icon: "fas fa-feather", color: '#9b59b6', desc: "Sprint et vitesse d'attaque accrus.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+3%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-2%</span> Cooldowns", apply: () => { applySprint(0.08); applyAtkSpeed(3); STATE.stats.cdMod *= 0.98; } },
            { id: 'e_fortress', name: "Bastion de Fer", rarity: 'epic', icon: "fas fa-crown", color: '#9b59b6', desc: "Défense inébranlable.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10%</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+7%</span> PV Max", apply: () => { STATE.stats.def = (STATE.stats.def || 0) + 10; STATE.stats.maxHp *= 1.07; } },
            { id: 'e_siphon', name: "Siphon Éternel", rarity: 'epic', icon: "fas fa-wand-magic-sparkles", color: '#9b59b6', desc: "Drainer pour guérir.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+2%</span> Vol de Vie, <span style='color:#2ecc71; font-weight:bold;'>+0.6</span> Régén/s", apply: () => { STATE.stats.lifesteal += 0.02; STATE.stats.regen = (STATE.stats.regen || 0) + 0.6; } },
            { id: 'e_thorns', name: "Carapace Prismatique", rarity: 'epic', icon: "fas fa-shield-cat", color: '#9b59b6', desc: "Une armure qui riposte.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+14</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+8%</span> PV Max, <span style='color:#e74c3c; font-weight:bold;'>-4%</span> Vitesse sprint", apply: () => { STATE.stats.def = (STATE.stats.def || 0) + 14; STATE.stats.maxHp *= 1.08; applySprint(-0.04); if (Globals.player) { Globals.player.maxHp *= 1.08; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'e_chain', name: "Chaîne Lumineuse", rarity: 'epic', icon: "fas fa-bezier-curve", color: '#9b59b6', desc: "La lumière saute d'ennemi en ennemi.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+12%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+3%</span> Chance Critique", apply: () => { STATE.stats.atk *= 1.12; STATE.stats.crit += 0.03; } },
            { id: 'e_overclock', name: "Surcharge Totale", rarity: 'epic', icon: "fas fa-microchip", color: '#9b59b6', desc: "Puissance au prix de la stabilité.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-6%</span> Cooldowns, <span style='color:#e74c3c; font-weight:bold;'>-5%</span> PV Max", apply: () => { applyAtkSpeed(10); STATE.stats.cdMod *= 0.94; STATE.stats.maxHp *= 0.95; if (Globals.player) { Globals.player.maxHp *= 0.95; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'e_phoenix', name: "Cendre Renaissante", rarity: 'epic', icon: "fas fa-dove", color: '#9b59b6', desc: "Des cendres naît la vie.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+1.8</span> Régén/s", apply: () => { STATE.stats.maxHp *= 1.08; STATE.stats.regen = (STATE.stats.regen || 0) + 1.8; if (Globals.player) { Globals.player.maxHp *= 1.08; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'e_void', name: "Éclat du Vide", rarity: 'epic', icon: "fas fa-circle-half-stroke", color: '#9b59b6', desc: "Percer toute défense.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+14%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-8%</span> Défense", apply: () => { STATE.stats.atk *= 1.14; STATE.stats.def = (STATE.stats.def || 0) - 8; } }
        ];

        // === LEGENDARY (3 weight) ===
        const legendaryFragments = [
            { id: 'l_titan', name: "Cœur de Titan", rarity: 'legendary', icon: "fas fa-mountain", color: '#f1c40f', desc: "Une endurance légendaire.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+23%</span> PV Max", apply: () => { STATE.stats.maxHp *= 1.23; if (Globals.player) { Globals.player.maxHp *= 1.23; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'l_god', name: "Force Divine", rarity: 'legendary', icon: "fas fa-hammer", color: '#f1c40f', desc: "Fendez les cieux.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+23%</span> Attaque", apply: () => { STATE.stats.atk *= 1.23; } },
            { id: 'l_flash', name: "Vitesse Lumière", rarity: 'legendary', icon: "fas fa-bolt", color: '#f1c40f', desc: "Sprint et vitesse d'attaque fusionnés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+4%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-4%</span> Cooldowns", apply: () => { applySprint(0.08); applyAtkSpeed(4); STATE.stats.cdMod *= 0.96; } },
            { id: 'l_eye', name: "Œil du Faucon", rarity: 'legendary', icon: "fas fa-eye", color: '#f1c40f', desc: "La précision ultime.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+13%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+18%</span> Dégâts Critique", apply: () => { STATE.stats.crit += 0.13; STATE.stats.critDmg += 0.18; } },
            { id: 'l_chrono', name: "Maître du Temps", rarity: 'legendary', icon: "fas fa-hourglass-half", color: '#f1c40f', desc: "Les sorts s'enchaînent.", statText: "<span style='color:#e74c3c; font-weight:bold;'>-6%</span> Cooldowns", apply: () => { STATE.stats.cdMod *= 0.94; } },
            { id: 'l_blood', name: "Seigneur de Sang", rarity: 'legendary', icon: "fas fa-wine-glass", color: '#f1c40f', desc: "Baignez dans le sang.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+1.75%</span> Vol de Vie, <span style='color:#2ecc71; font-weight:bold;'>+8%</span> PV Max", apply: () => { STATE.stats.lifesteal += 0.0175; STATE.stats.maxHp *= 1.08; if (Globals.player) { Globals.player.maxHp *= 1.08; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'l_apex', name: "Apogée du Pouvoir", rarity: 'legendary', icon: "fa-solid fa-scroll", color: '#f1c40f', desc: "Tous les domaines maîtrisés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+6%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+3%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+4%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-5%</span> Cooldowns", apply: () => { STATE.stats.atk *= 1.10; STATE.stats.maxHp *= 1.06; applySprint(0.03); applyAtkSpeed(4); STATE.stats.cdMod *= 0.95; if (Globals.player) { Globals.player.maxHp *= 1.06; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'l_fortuna', name: "Bénédiction de Fortuna", rarity: 'legendary', icon: "fas fa-dice-six", color: '#f1c40f', desc: "La chance est du côté du fort.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+6%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+13%</span> Dégâts Critique, <span style='color:#2ecc71; font-weight:bold;'>+6%</span> EXP", apply: () => { STATE.stats.crit += 0.06; STATE.stats.critDmg += 0.13; STATE.stats.xpMod = (STATE.stats.xpMod || 1.0) * 1.06; } },
            { id: 'l_immortal_regen', name: "Essence Éternelle", rarity: 'legendary', icon: "fas fa-ankh", color: '#f1c40f', desc: "La vie sans fin.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+2.8</span> Régén/s, <span style='color:#2ecc71; font-weight:bold;'>+13%</span> PV Max", apply: () => { STATE.stats.regen = (STATE.stats.regen || 0) + 2.8; STATE.stats.maxHp *= 1.13; if (Globals.player) { Globals.player.maxHp *= 1.13; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'l_swift_dancer', name: "Danseur des Vents", rarity: 'legendary', icon: "fas fa-person-walking-arrow-loop-left", color: '#f1c40f', desc: "Sprint extrême, vitesse d'attaque fluide.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+16%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+5%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-2%</span> Cooldowns", apply: () => { applySprint(0.16); applyAtkSpeed(5); STATE.stats.cdMod *= 0.98; } },
            { id: 'l_thorns', name: "Couronne d'Épines", rarity: 'legendary', icon: "fas fa-crown", color: '#f1c40f', desc: "Une forteresse qui contre-attaque.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+22</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+15%</span> PV Max", apply: () => { STATE.stats.def = (STATE.stats.def || 0) + 22; STATE.stats.maxHp *= 1.15; if (Globals.player) { Globals.player.maxHp *= 1.15; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'l_chain', name: "Maître des Maillons", rarity: 'legendary', icon: "fas fa-share-nodes", color: '#f1c40f', desc: "Chaque mort en appelle d'autres.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+18%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+8%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Dégâts Critique", apply: () => { STATE.stats.atk *= 1.18; STATE.stats.crit += 0.08; STATE.stats.critDmg = (STATE.stats.critDmg || 0) + 0.10; } },
            { id: 'l_overdrive', name: "Moteur Céleste", rarity: 'legendary', icon: "fas fa-jet-fighter-up", color: '#f1c40f', desc: "Sprint et vitesse d'attaque au maximum.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+12%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Vitesse sprint, <span style='color:#e74c3c; font-weight:bold;'>-8%</span> Cooldowns", apply: () => { applyAtkSpeed(12); applySprint(0.10); STATE.stats.cdMod *= 0.92; } },
            { id: 'l_soulbind', name: "Pacte d'Âmes", rarity: 'legendary', icon: "fas fa-hand-holding-heart", color: '#f1c40f', desc: "Leur essence devient votre force.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+12%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+2.5%</span> Vol de Vie", apply: () => { STATE.stats.atk *= 1.12; STATE.stats.lifesteal += 0.025; } },
            { id: 'l_arcane', name: "Orbe d'Infusion", rarity: 'legendary', icon: "fas fa-sun", color: '#f1c40f', desc: "Tous les sorts débordent de puissance.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+8%</span> Dégâts sorts, <span style='color:#e74c3c; font-weight:bold;'>-4%</span> Cooldowns", apply: () => { if (STATE.stats.skillMods) { Object.keys(STATE.stats.skillMods).forEach((k) => { STATE.stats.skillMods[k] = (STATE.stats.skillMods[k] || 1) * 1.08; }); } STATE.stats.cdMod *= 0.96; } }
        ];

        // === MYTHIC (1 weight) ===
        const mythicFragments = [
            { id: 'm_omni', name: "Omnipotence", rarity: 'mythic', icon: "fas fa-atom", color: '#ff0055', desc: "Le pouvoir absolu.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+8%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Critique, <span style='color:#e74c3c; font-weight:bold;'>-10%</span> Cooldowns", apply: () => { STATE.stats.maxHp *= 1.10; STATE.stats.atk *= 1.10; applySprint(0.10); applyAtkSpeed(8); STATE.stats.crit += 0.10; STATE.stats.critDmg += 0.10; STATE.stats.cdMod *= 0.90; if (Globals.player) { Globals.player.maxHp *= 1.15; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'm_immortal', name: "Immortalité", rarity: 'mythic', icon: "fas fa-ankh", color: '#ff0055', desc: "Refusez de tomber.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+50%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+5</span> Régén/s", apply: () => { STATE.stats.maxHp *= 1.50; STATE.stats.regen += 5; if (Globals.player) { Globals.player.maxHp *= 1.50; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'm_destroyer', name: "Le Destructeur", rarity: 'mythic', icon: "fas fa-meteor", color: '#ff0055', desc: "Tout doit disparaître.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+50%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+20%</span> Critique", apply: () => { STATE.stats.atk *= 1.50; STATE.stats.crit += 0.20; } },
            { id: 'm_warp', name: "Vitesse Distordue", rarity: 'mythic', icon: "fas fa-tachometer-alt", color: '#ff0055', desc: "Sprint distordu, sorts accélérés.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+40%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+6%</span> Vitesse d'attaque, <span style='color:#e74c3c; font-weight:bold;'>-10%</span> Cooldowns", apply: () => { applySprint(0.40); applyAtkSpeed(6); STATE.stats.cdMod *= 0.90; } },
            { id: 'm_vampire_lord', name: "Dracula", rarity: 'mythic', icon: "fas fa-crown", color: '#ff0055', desc: "La vie éternelle.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+10%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Vol de Vie", apply: () => { STATE.stats.lifesteal += 0.10; STATE.stats.atk *= 1.10; } },
            { id: 'm_glass_cannon_plus', name: "Canon de verre accrue", rarity: 'mythic', icon: "fas fa-crosshairs", color: '#ff0055', desc: "Une puissance dévastatrice au prix de la survie.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+80%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-30%</span> PV Max", apply: () => { STATE.stats.atk *= 1.80; STATE.stats.maxHp *= 0.70; if (Globals.player) { Globals.player.maxHp *= 0.70; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'm_chaos', name: "Chaos Primordial", rarity: 'mythic', icon: "fas fa-face-grin-stars", color: '#ff0055', desc: "L'ordre n'existe plus.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+50%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+25%</span> Critique, <span style='color:#e74c3c; font-weight:bold;'>-15%</span> Défense", apply: () => { STATE.stats.atk *= 1.5; STATE.stats.crit += 0.25; STATE.stats.def = (STATE.stats.def || 0) * 0.85; } },
            { id: 'm_twilight', name: "Crépuscule Éternel", rarity: 'mythic', icon: "fa-solid fa-moon", color: '#ff0055', desc: "Entre deux mondes.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+25%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+20%</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+3</span> Régén/s", apply: () => { STATE.stats.atk *= 1.25; STATE.stats.def = (STATE.stats.def || 0) + 20; STATE.stats.regen = (STATE.stats.regen || 0) + 3; } },
            { id: 'm_reaper', name: "Faucheuse", rarity: 'mythic', icon: "fa-solid fa-scale-unbalanced", color: '#ff0055', desc: "La mort elle-même.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+40%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+15%</span> Critique, <span style='color:#2ecc71; font-weight:bold;'>+6%</span> Vol de Vie", apply: () => { STATE.stats.atk *= 1.4; STATE.stats.crit += 0.15; STATE.stats.lifesteal += 0.6; } },
            { id: 'm_genesis', name: "Genèse", rarity: 'mythic', icon: "fas fa-burst", color: '#ff0055', desc: "Un nouveau commencement.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+40%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+5</span> Régén/s, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Défense", apply: () => { STATE.stats.maxHp *= 1.40; STATE.stats.regen = (STATE.stats.regen || 0) + 5; STATE.stats.def = (STATE.stats.def || 0) + 10; if (Globals.player) { Globals.player.maxHp *= 1.40; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'm_apex_mythic', name: "Apogée Mythique", rarity: 'mythic', icon: "fa-solid fa-scroll", color: '#ff0055', desc: "La maîtrise ultime.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+20%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+6%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Critique, <span style='color:#e74c3c; font-weight:bold;'>-10%</span> Cooldowns", apply: () => { STATE.stats.atk *= 1.20; STATE.stats.maxHp *= 1.10; applySprint(0.10); applyAtkSpeed(6); STATE.stats.crit += 0.10; STATE.stats.cdMod *= 0.90; if (Globals.player) { Globals.player.maxHp *= 1.15; Globals.player.hp = Globals.player.maxHp; } } },
            { id: 'm_paradox', name: "Paradoxe Infini", rarity: 'mythic', icon: "fas fa-infinity", color: '#ff0055', desc: "Le temps se plie en boucle.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+30%</span> Attaque, <span style='color:#e74c3c; font-weight:bold;'>-15%</span> Cooldowns, <span style='color:#e74c3c; font-weight:bold;'>-12%</span> PV Max", apply: () => { STATE.stats.atk *= 1.30; STATE.stats.cdMod *= 0.85; STATE.stats.maxHp *= 0.88; if (Globals.player) { Globals.player.maxHp *= 0.88; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'm_singularity', name: "Singularité", rarity: 'mythic', icon: "fas fa-circle-dot", color: '#ff0055', desc: "Tout s'effondre vers votre frappe.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+45%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+18%</span> Chance Critique, <span style='color:#e74c3c; font-weight:bold;'>-25%</span> PV Max", apply: () => { STATE.stats.atk *= 1.45; STATE.stats.crit += 0.18; STATE.stats.maxHp *= 0.75; if (Globals.player) { Globals.player.maxHp *= 0.75; Globals.player.hp = Math.min(Globals.player.hp, Globals.player.maxHp); } } },
            { id: 'm_aegis', name: "Égide du Monde", rarity: 'mythic', icon: "fas fa-shield-halved", color: '#ff0055', desc: "Le monde lui-même vous protège.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+35%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+25</span> Défense, <span style='color:#2ecc71; font-weight:bold;'>+4</span> Régén/s", apply: () => { STATE.stats.maxHp *= 1.35; STATE.stats.def = (STATE.stats.def || 0) + 25; STATE.stats.regen = (STATE.stats.regen || 0) + 4; if (Globals.player) { Globals.player.maxHp *= 1.35; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } },
            { id: 'm_chainlord', name: "Seigneur des Chaînes", rarity: 'mythic', icon: "fas fa-network-wired", color: '#ff0055', desc: "Tous les ennemis sont liés à vous.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+28%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+12%</span> Chance Critique, <span style='color:#2ecc71; font-weight:bold;'>+10%</span> Vitesse d'attaque", apply: () => { STATE.stats.atk *= 1.28; STATE.stats.crit += 0.12; applyAtkSpeed(10); } },
            { id: 'm_prismatic', name: "Cœur Prismatique", rarity: 'mythic', icon: "fas fa-gem", color: '#ff0055', desc: "L'essence pure du prisme.", statText: "<span style='color:#2ecc71; font-weight:bold;'>+12%</span> Attaque, <span style='color:#2ecc71; font-weight:bold;'>+12%</span> PV Max, <span style='color:#2ecc71; font-weight:bold;'>+12%</span> Vitesse sprint, <span style='color:#2ecc71; font-weight:bold;'>+8%</span> Vitesse d'attaque, <span style='color:#2ecc71; font-weight:bold;'>+8%</span> Critique, <span style='color:#e74c3c; font-weight:bold;'>-12%</span> Cooldowns", apply: () => { STATE.stats.atk *= 1.12; STATE.stats.maxHp *= 1.12; applySprint(0.12); applyAtkSpeed(8); STATE.stats.crit += 0.08; STATE.stats.cdMod *= 0.88; if (Globals.player) { Globals.player.maxHp *= 1.12; Globals.player.hp = Math.min(Globals.player.maxHp, Globals.player.hp); } } }
        ];

        const options = [...commonFragments, ...rareFragments, ...epicFragments, ...legendaryFragments, ...mythicFragments];
        this.allFragmentsList = options;

        const weightedOptions = [];
        options.forEach(opt => {
            let weight = 1;
            if (opt.rarity === 'common') weight = 1000;
            if (opt.rarity === 'rare') weight = 200;
            if (opt.rarity === 'epic') weight = 100;
            if (opt.rarity === 'legendary') weight = 50;
            if (opt.rarity === 'mythic') weight = 10;
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
        STATE.collectedFragments.push({ ...reward, uid: Date.now() + Math.random() });
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
