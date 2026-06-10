// @ts-nocheck
import { STATE, CONFIG } from '@/core/config';
import { Globals } from '@/core/globals';
import { AudioSys } from '@/core/ressources';
import { getConstellationForClass, type ClassId } from '@/data/constellations';
import { formatSkillScalingHtml, getSkillLabel, getWarriorDefPower, type SkillKey } from '@/data/classStatsConfig';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { ConstellationUI } from '@/ui/constellationUI';

function renderConstellation(): void {
  ConstellationUI.render((nodeId) => SkillTree.unlock(nodeId));
}

export const SkillTree = {
  render: renderConstellation,

  unlock: function (nodeId: string) {
    const ok = ConstellationEngine.unlock(nodeId);
    if (!ok) return;

    if (AudioSys.sfx?.levelup) AudioSys.sfx.levelup();
    else if (AudioSys.sfx?.ui_click) AudioSys.sfx.ui_click();

    const classCount = ConstellationEngine.getUnlockedCountForClass();
    if (classCount > 0 && classCount % 5 === 0) {
      STATE.stats.xpMod = (STATE.stats.xpMod || 1) + 0.25;
      if (window.UI) window.UI.toast('✦ PALIER STELLAIRE : +25% EXP');
    }

    ConstellationUI.refreshVisuals();

    if (window.UI) window.UI.updateHUD();
    if (window.BuffBar) window.BuffBar.render();
    if (window.NewSkillUI) {
      window.NewSkillUI.updatePoints();
      window.NewSkillUI.updateInfoTab();
      window.NewSkillUI.updatePassiveDisplay();
    }
  },

  refreshVisuals: function () {
    ConstellationUI.refreshVisuals();
  },
};

export const NewSkillUI = {
  _expandedSkill: null,

  toggle: function () {
    if (!Globals.player) return;

    const wrapper = document.getElementById('skill-ui-wrapper');
    if (!wrapper) return;

    const isActive = wrapper.classList.contains('active');
    if (isActive) {
      wrapper.classList.remove('active');
      document.body.classList.remove('skill-ui-open');
      if (!STATE.multiplayer.active) STATE.isPaused = false;
      this._expandedSkill = null;
    } else {
      SkillTree.render();
      wrapper.classList.add('active');
      document.body.classList.add('skill-ui-open');
      if (!STATE.multiplayer.active && Globals.player) STATE.isPaused = true;

      SkillTree.refreshVisuals();
      this.updatePoints();
      this.updateInfoTab();
      this.updatePassiveDisplay();
      if (window.UI?.updateFragmentsTab) window.UI.updateFragmentsTab();
    }
  },

  switchTab: function (tabName: string) {
    document.querySelectorAll('#skill-ui-wrapper .ui-tab-btn').forEach((b) => b.classList.remove('active'));
    const tabBtn = document.querySelector(`#skill-ui-wrapper .ui-tab-btn[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    document.querySelectorAll('.view-section').forEach((v) => v.classList.remove('active'));
    const target = document.getElementById(`view-${tabName}`);
    if (target) target.classList.add('active');

    if (tabName === 'info') this.updateInfoTab();
    if (tabName === 'fragments' && window.UI?.updateFragmentsTab) window.UI.updateFragmentsTab();
    if (tabName === 'tree') SkillTree.refreshVisuals();
  },

  toggleSkillDetail: function (skillKey: string, cardEl: HTMLElement) {
    if (!cardEl) return;
    const wasExpanded = cardEl.classList.contains('expanded');
    document.querySelectorAll('.grimoire-skill-card.expanded').forEach((c) => c.classList.remove('expanded'));
    if (!wasExpanded) {
      cardEl.classList.add('expanded');
      this._expandedSkill = skillKey;
    } else {
      this._expandedSkill = null;
    }
  },

  updatePoints: function () {
    const el = document.getElementById('ui-skill-points');
    if (!el) return;
    el.innerText = STATE.skillPoints;
    el.style.color = STATE.skillPoints > 0 ? '#ffd700' : '#888';
    el.style.textShadow = STATE.skillPoints > 0 ? '0 0 10px #ffd700' : 'none';
  },

  updatePassiveDisplay: function () {
    const summary = ConstellationEngine.getClassPassiveSummary();
    const nameEl = document.getElementById('passive-name');
    const descEl = document.getElementById('passive-desc');
    if (nameEl) nameEl.innerText = summary.name;
    if (descEl) {
      const chips = summary.scalingHtml
        ? `<div class="grimoire-ratio-chips grimoire-passive-chips">${summary.scalingHtml}</div>`
        : '';
      descEl.innerHTML = `${chips}<p class="grimoire-passive-desc">${summary.desc}</p>`;
    }
  },

  buildSkillDetailHtml: function (classId: ClassId, skillKey: SkillKey) {
    const chips = formatSkillScalingHtml(classId, skillKey);
    return `<div class="grimoire-ratio-chips">${chips}</div><div class="grimoire-skill-hint">Cliquez pour replier</div>`;
  },

  updateInfoTab: function () {
    const stats = STATE.stats;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    set('info-hp', Math.floor(stats.maxHp));
    const cls = STATE.class || 'warrior';
    const atkRowLabel = document.querySelector('#view-info #info-atk')?.closest('.grimoire-stat-row')?.querySelector('.stat-label');
    if (cls === 'warrior') {
      set('info-atk', Math.floor(getWarriorDefPower()));
      if (atkRowLabel) atkRowLabel.innerHTML = '<i class="fas fa-shield-halved" style="color:#5dade2"></i> Défense runique';
    } else {
      set('info-atk', Math.floor(stats.atk + (stats.titanBonus || 0)));
      if (atkRowLabel) atkRowLabel.innerHTML = '<i class="fas fa-gavel" style="color:#f1c40f"></i> Attaque';
    }
    set('info-spd', stats.speed.toFixed(1));
    const atkSpdMod = stats.attackSpeedMod || 1;
    set('info-attack-spd', `${Math.round(100 / atkSpdMod)}%`);
    set('info-crit', Math.floor(stats.crit * 100));
    set('info-crit-dmg', Math.floor(stats.critDmg * 100));
    set('info-cdr', Math.floor(stats.cdMod * 100) + '%');
    set('info-lifesteal', Math.floor((stats.lifesteal || 0) * 100) + '%');
    set('info-regen', (stats.regen || 0) + '/s');
    set('info-xp', Math.floor((stats.xpMod || 1) * 100) + '%');

    const classId = cls as ClassId;
    const unlocked = ConstellationEngine.getUnlockedCountForClass();
    const data = getConstellationForClass(classId);
    const apexOk = ConstellationEngine.isNodeUnlocked(data.apex.id);
    const progressEl = document.getElementById('info-constellation-progress');
    if (progressEl) {
      progressEl.innerHTML = `${unlocked} / 16 · <span class="grimoire-apex-label">Apex</span> <span class="${apexOk ? 'grimoire-apex-ok' : 'grimoire-apex-pending'}">${apexOk ? '✓' : '○'}</span>`;
    }

    const tooltips = CONFIG.tooltips[cls];
    const primaryLabel = getSkillLabel(classId, 'primary');
    const primaryNameEl = document.getElementById('name-skill-primary');
    const primaryKeyEl = document.getElementById('key-skill-primary');
    if (primaryNameEl) primaryNameEl.innerText = primaryLabel;
    if (primaryKeyEl) {
      primaryKeyEl.innerText = cls === 'chronoregulator' ? 'CLIC' : 'LMB';
    }

    const detailPrimary = document.getElementById('detail-skill-primary');
    if (detailPrimary) {
      detailPrimary.innerHTML = this.buildSkillDetailHtml(classId, 'primary');
    }

    if (tooltips) {
      const mapping = [
        { num: 1, key: 'space' as const },
        { num: 2, key: 'shift' as const },
        { num: 3, key: 'e' as const },
      ];
      for (const { num, key } of mapping) {
        this.updateSkillCard(num, key, tooltips, classId);
      }
    }

    if (this._expandedSkill) {
      const card = document.querySelector(`.grimoire-skill-card[data-skill-key="${this._expandedSkill}"]`);
      if (card) card.classList.add('expanded');
    }
  },

  updateSkillCard: function (num, key, tooltips, classId) {
    const nameEl = document.getElementById(`name-skill-${num}`);
    const descEl = document.getElementById(`desc-skill-${num}`);
    const detailEl = document.getElementById(`detail-skill-${num}`);
    if (tooltips?.[key]) {
      if (nameEl) nameEl.innerText = tooltips[key].name;
      if (descEl) descEl.innerText = tooltips[key].desc;
      if (detailEl) detailEl.innerHTML = this.buildSkillDetailHtml(classId, key);
    }
  },
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    const wrapper = document.getElementById('skill-ui-wrapper');
    if (wrapper?.classList.contains('active')) NewSkillUI.toggle();
  }
});
