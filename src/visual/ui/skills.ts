// @ts-nocheck
import { STATE, CONFIG } from '@/core/config';
import { Globals } from '@/core/globals';
import { AudioSys } from '@/core/ressources';
import { getConstellationForClass, type ClassId } from '@/data/constellations';
import { formatDestinySkillDetailHtml, formatSkillScalingHtml, getSkillLabel, type SkillKey, getClassStatsConfig } from '@/data/classStatsConfig';
import { getPlayerDefense, formatDefenseReductionPct } from '@/gameplay/combat/defense';
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

    const postUnlockAction = () => {
      SkillTree.render();
      if (window.UI) window.UI.updateHUD();
      if (window.BuffBar) window.BuffBar.render();
      if (window.NewSkillUI) {
        window.NewSkillUI.updatePoints();
        window.NewSkillUI.updateInfoTab();
        window.NewSkillUI.updatePassiveDisplay();
      }
    };

    if (nodeId.endsWith('-10')) {
      ConstellationUI.playBranchEndPassiveUnlockAnimation(nodeId, postUnlockAction);
    } else if (nodeId.endsWith('-apex')) {
      ConstellationUI.playApexUnlockAnimation(nodeId, postUnlockAction);
    } else {
      postUnlockAction();
    }
  },

  maxAllocateBranch: function (classId: ClassId, branchId: string) {
    if (window.isConstellationAnimating) return;

    const data = getConstellationForClass(classId);
    const branch = data.branches.find(b => b.id === branchId);
    if (!branch) return;

    let anyUnlocked = false;
    let unlockedTenth = false;

    for (const node of branch.nodes) {
      if (ConstellationEngine.isNodeUnlocked(node.id)) {
        continue;
      }

      const check = ConstellationEngine.canUnlock(node.id);
      if (check.ok) {
        const ok = ConstellationEngine.unlock(node.id);
        if (ok) {
          anyUnlocked = true;
          if (node.id.endsWith('-10')) {
            unlockedTenth = true;
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (anyUnlocked) {
      if (AudioSys.sfx?.levelup) AudioSys.sfx.levelup();
      else if (AudioSys.sfx?.ui_click) AudioSys.sfx.ui_click();

      const classCount = ConstellationEngine.getUnlockedCountForClass();
      if (classCount > 0 && classCount % 5 === 0) {
        STATE.stats.xpMod = (STATE.stats.xpMod || 1) + 0.25;
        if (window.UI) window.UI.toast('✦ PALIER STELLAIRE : +25% EXP');
      }

      const postUnlockAction = () => {
        SkillTree.render();
        if (window.UI) window.UI.updateHUD();
        if (window.BuffBar) window.BuffBar.render();
        if (window.NewSkillUI) {
          window.NewSkillUI.updatePoints();
          window.NewSkillUI.updateInfoTab();
          window.NewSkillUI.updatePassiveDisplay();
        }
      };

      if (unlockedTenth) {
        ConstellationUI.playBranchEndPassiveUnlockAnimation(`${classId}-${branchId}-10`, postUnlockAction);
      } else {
        postUnlockAction();
      }
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
      const detail = summary.scalingHtml || '';
      descEl.innerHTML = `${detail}<p class="grimoire-passive-desc">${summary.desc}</p>`;
    }
  },

  buildSkillDetailHtml: function (classId: ClassId, skillKey: SkillKey) {
    const cfg = getClassStatsConfig(classId);
    const stats = STATE.stats;
    const chips = formatSkillScalingHtml(classId, skillKey);
    const chipsBlock = chips ? `<div class="grimoire-ratio-chips">${chips}</div>` : '';

    let cooldownInfo = '';
    if (skillKey === 'primary') {
      const baseCd = cfg.base.attackMaxCooldown || 0.5;
      const speedMod = stats.attackSpeedMod || 1;
      const currentCd = baseCd * speedMod;
      const currentRate = 1 / currentCd;
      cooldownInfo = `
        <div class="destiny-skill-meta-row">
          <span class="destiny-skill-meta-label"><i class="fas fa-gauge-high"></i> Cadence</span>
          <span class="destiny-skill-meta-value">${currentRate.toFixed(1)}/s <span class="grimoire-meta-secondary">(${currentCd.toFixed(2)}s)</span></span>
        </div>
      `;
    } else {
      const baseCd = cfg.base.cooldowns[skillKey] || 0;
      const cdMult = ConstellationEngine.getSkillCdMult(skillKey);
      const currentCd = baseCd * cdMult;
      cooldownInfo = `
        <div class="destiny-skill-meta-row">
          <span class="destiny-skill-meta-label"><i class="fas fa-stopwatch"></i> Recharge</span>
          <span class="destiny-skill-meta-value">${currentCd.toFixed(1)}s <span class="grimoire-meta-secondary">(${baseCd}s base)</span></span>
        </div>
      `;
    }

    const estDmg = ConstellationEngine.calcSkillDamage(skillKey);
    let dmgInfo = '';
    if (estDmg > 0) {
      let label = 'Impact de base';
      if (classId === 'sentinel' && (skillKey === 'shift' || skillKey === 'e')) {
        label = 'Dégâts / Soin estimé';
      } else if (classId === 'warrior' && skillKey === 'shift') {
        label = 'Soin estimé';
      } else if (classId === 'mage' && skillKey === 'space') {
        label = 'Dégâts par projectile';
      } else {
        label = 'Dégâts / Effet estimé';
      }
      dmgInfo = `
        <div class="destiny-skill-meta-row">
          <span class="destiny-skill-meta-label"><i class="fas fa-fire"></i> ${label}</span>
          <span class="destiny-skill-meta-value grimoire-meta-damage">${Math.round(estDmg)}</span>
        </div>
      `;
    }

    return `
      <div class="destiny-skill-detail-inner">
        <div class="destiny-skill-meta">
          ${cooldownInfo}
          ${dmgInfo}
        </div>
        ${chipsBlock ? `<div class="destiny-skill-scaling-label">Scaling & Ratios</div>${chipsBlock}` : ''}
        <div class="grimoire-skill-hint">Cliquer pour replier</div>
      </div>
    `;
  },

  updateInfoTab: function () {
    const stats = STATE.stats;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    set('info-hp', Math.floor(stats.maxHp));
    const totalDef = getPlayerDefense();
    const defPct = formatDefenseReductionPct(totalDef);
    set('info-defense', Math.floor(totalDef));
    set('info-damage-reduction', `${defPct}%`);

    const cls = STATE.class || 'warrior';
    if (cls === 'warrior') {
      set('info-atk', '0');
    } else {
      set('info-atk', Math.floor(stats.atk + (stats.titanBonus || 0)));
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
    const unlocked = ConstellationEngine.getUnlockedNonApexCount(classId);
    const total = ConstellationEngine.getNonApexNodeTotal(classId);
    const apexState = ConstellationEngine.getApexProgressState(classId);
    const pct = total > 0 ? Math.min(100, (unlocked / total) * 100) : 0;

    const apexSection = document.getElementById('grimoire-apex-section');
    if (apexSection) {
      apexSection.classList.remove('apex-locked-state', 'apex-ready-state', 'apex-unlocked-state');
      apexSection.classList.add(
        apexState === 'unlocked' ? 'apex-unlocked-state'
          : apexState === 'ready' ? 'apex-ready-state'
            : 'apex-locked-state',
      );
    }

    const apexFill = document.getElementById('grimoire-apex-fill');
    if (apexFill) apexFill.style.width = `${pct}%`;

    const apexCount = document.getElementById('grimoire-apex-count');
    if (apexCount) {
      const keystones = ConstellationEngine.getUnlockedKeystoneCount(classId);
      const keystonesTotal = ConstellationEngine.getKeystoneTotal(classId);
      apexCount.textContent = `${unlocked} / ${total} Nœuds · ${keystones} / ${keystonesTotal} Passifs`;
    }

    const apexStatus = document.getElementById('grimoire-apex-status');
    if (apexStatus) {
      if (apexState === 'unlocked') apexStatus.textContent = 'Débloqué';
      else if (apexState === 'ready') apexStatus.textContent = 'APEX READY';
      else apexStatus.textContent = 'Verrouillé';
    }

    const tooltips = CONFIG.tooltips[cls];
    const primaryLabel = getSkillLabel(classId, 'primary');
    const primaryNameEl = document.getElementById('name-skill-primary');
    const primaryKeyEl = document.getElementById('key-skill-primary');
    const primaryDescEl = document.getElementById('desc-skill-primary');
    if (primaryNameEl) primaryNameEl.innerText = primaryLabel;
    if (primaryKeyEl) {
      primaryKeyEl.innerText = cls === 'chronoregulator' ? 'CLIC' : 'LMB';
    }
    if (primaryDescEl && tooltips?.primary) {
      primaryDescEl.innerText = tooltips.primary.desc || tooltips.primary.name || '';
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
