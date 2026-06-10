// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { getPassiveMeta } from '@/data/passiveCatalog';

const MALUS_BUFF_NAMES = new Set([
  'Malus', 'Malédiction', 'Curse', 'Ralenti', 'Slow', 'Poison', 'Saignée', 'Affaibli', 'Brûlure',
]);

export interface BuffEntry {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  type: string;
  isMalus?: boolean;
  timer?: number;
  maxTimer?: number;
  stacks?: number;
  maxStacks?: number;
  extra?: string;
}

/**
 * Barre de buffs compacte — icônes uniquement, visible seulement si effets actifs.
 */
export const BuffBar = {
  hoveredId: null as string | null,
  pointerX: 0,
  pointerY: 0,
  _eventsBound: false,

  bindEvents(): void {
    if (this._eventsBound) return;
    this._eventsBound = true;

    document.addEventListener('pointermove', (e) => {
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    });

    const strip = document.getElementById('buff-strip');
    if (strip) {
      strip.addEventListener('pointerleave', () => this.hideTooltip());
    }
  },

  collect(): BuffEntry[] {
    const entries: BuffEntry[] = [];
    const player = Globals.player;
    const p = STATE.passives || {};

    if (player?.buffs?.length) {
      for (const b of player.buffs) {
        const isMalus = !!b.negative || MALUS_BUFF_NAMES.has(b.name);
        entries.push({
          id: `temp-${b.name}`,
          name: b.name,
          desc: isMalus ? `Malus actif : ${b.name}` : `Buff temporaire : ${b.name}`,
          icon: 'fa-sparkles',
          color: isMalus ? '#e74c3c' : '#f1c40f',
          type: isMalus ? 'malus' : 'buff',
          isMalus,
          timer: b.timer,
          maxTimer: b.maxTimer || b.timer,
          extra: typeof b.icon === 'string' && b.icon.length <= 2 ? b.icon : undefined,
        });
      }
    }

    if (player?.debuffs?.length) {
      for (const d of player.debuffs) {
        entries.push({
          id: `debuff-${d.name || d.id}`,
          name: d.name || 'Malus',
          desc: d.desc || 'Effet négatif actif.',
          icon: d.icon || 'fa-skull-crossbones',
          color: '#e74c3c',
          type: 'malus',
          isMalus: true,
          timer: d.timer,
          maxTimer: d.maxTimer || d.timer,
          stacks: d.stacks,
        });
      }
    }

    if (player?.isStunned) {
      entries.push({
        id: 'status-stun',
        name: 'Étourdi',
        desc: 'Vous ne pouvez pas agir.',
        icon: 'fa-burst',
        color: '#e74c3c',
        type: 'malus',
        isMalus: true,
        timer: player.stunTimer,
        maxTimer: player.stunTimer,
      });
    }

    if (p.warFervor && (p.warFervorStacks || 0) > 0) {
      const meta = getPassiveMeta('warFervor');
      entries.push({
        id: 'stack-warFervor',
        name: meta?.name || 'Ferveur',
        desc: meta?.desc || 'Stacks de fureur au combat.',
        icon: meta?.icon || 'fa-fire',
        color: meta?.color || '#e74c3c',
        type: 'stack',
        stacks: p.warFervorStacks,
        maxStacks: 5,
      });
    }

    if (p.orbitalWeave && (p.orbitalStacks || 0) > 0) {
      const meta = getPassiveMeta('orbitalWeave');
      entries.push({
        id: 'stack-orbitalWeave',
        name: meta?.name || 'Tissage Orbital',
        desc: meta?.desc || 'Stacks Soleil/Lune.',
        icon: meta?.icon || 'fa-yin-yang',
        color: meta?.color || '#9b59b6',
        type: 'stack',
        stacks: p.orbitalStacks,
        maxStacks: 4,
      });
    }

    if (p.etherSteps?.length) {
      const ready = p.etherSteps.filter((s) => (s.rt_cooldown || 0) <= 0).length;
      if (ready > 0) {
        entries.push({
          id: 'passive-etherSteps-active',
          name: 'Pas Éthérés',
          desc: 'Charges d\'intangibilité prêtes.',
          icon: 'fa-stairs',
          color: '#aaddff',
          type: 'stack',
          stacks: ready,
          maxStacks: p.etherSteps.length,
        });
      }
    }

    if ((p.storedParryDamage || 0) > 0) {
      entries.push({
        id: 'passive-parry-stored',
        name: 'Charge Sismique',
        desc: `${Math.floor(p.storedParryDamage)} dégâts stockés pour la prochaine Frappe.`,
        icon: 'fa-mountain',
        color: '#8e44ad',
        type: 'synergie',
        stacks: Math.min(99, Math.floor(p.storedParryDamage / 10) || 1),
      });
    }

    if (player?.bloodShield > 0) {
      entries.push({
        id: 'shield-blood',
        name: 'Bouclier de Sang',
        desc: `Absorbe ${Math.floor(player.bloodShield)} dégâts.`,
        icon: 'fa-shield-heart',
        color: '#c0392b',
        type: 'bouclier',
        extra: `${Math.floor(player.bloodShield)}`,
      });
    }

    return entries;
  },

  syncTooltipFromPointer(entries: BuffEntry[]): void {
    const container = document.getElementById('buffs-container');
    if (!container?.childElementCount) {
      this.hideTooltip();
      return;
    }

    const target = document.elementFromPoint(this.pointerX, this.pointerY);
    const chip = target?.closest?.('.buff-chip') as HTMLElement | null;
    if (!chip || !container.contains(chip)) {
      this.hideTooltip();
      return;
    }

    const entry = entries.find((e) => e.id === chip.dataset.buffId);
    if (entry) {
      this.showTooltip(entry, chip);
    } else {
      this.hideTooltip();
    }
  },

  render(): void {
    this.bindEvents();

    const strip = document.getElementById('buff-strip');
    const container = document.getElementById('buffs-container');
    if (!strip || !container) return;

    const entries = this.collect();
    container.innerHTML = '';

    if (!entries.length) {
      strip.classList.remove('buff-strip-visible');
      this.hideTooltip();
      return;
    }

    strip.classList.add('buff-strip-visible');

    for (const e of entries) {
      const el = document.createElement('div');
      el.className = `buff-chip${e.isMalus ? ' buff-chip-malusr' : ''}`;
      el.dataset.buffId = e.id;
      el.style.setProperty('--buff-color', e.color);

      const iconContent =
        e.extra && e.extra.length <= 2
          ? `<span class="buff-chip-emoji">${e.extra}</span>`
          : `<i class="fas ${e.icon}"></i>`;

      let stackHtml = '';
      if (e.stacks != null && e.stacks > 0) {
        stackHtml = `<span class="buff-chip-stack">${e.stacks}${e.maxStacks ? '' : ''}</span>`;
      }

      let timerBar = '';
      if (e.timer != null && e.timer > 0 && e.maxTimer) {
        const pct = Math.min(100, (e.timer / e.maxTimer) * 100);
        timerBar = `<div class="buff-chip-timer-bar"><div class="buff-chip-timer-fill" style="width:${pct}%"></div></div>`;
      }

      el.innerHTML = `
        <div class="buff-chip-icon">${iconContent}</div>
        ${stackHtml}
        ${timerBar}
      `;

      el.addEventListener('mouseenter', () => this.showTooltip(e, el));
      el.addEventListener('mouseleave', () => this.syncTooltipFromPointer(entries));
      container.appendChild(el);
    }

    this.syncTooltipFromPointer(entries);
  },

  showTooltip(entry: BuffEntry, anchorEl: HTMLElement): void {
    const tip = document.getElementById('buff-hover-tooltip');
    if (!tip) return;
    this.hoveredId = entry.id;

    const typeLabel = entry.isMalus ? 'Malus' : entry.type;
    tip.classList.toggle('buff-tip-malusr', !!entry.isMalus);

    tip.innerHTML = `
      <div class="buff-tip-header">
        <span class="buff-tip-icon" style="color:${entry.color}"><i class="fas ${entry.icon}"></i></span>
        <div>
          <div class="buff-tip-name">${entry.name}</div>
          <div class="buff-tip-type${entry.isMalus ? ' tip-malusr' : ''}">${typeLabel}</div>
        </div>
      </div>
      <div class="buff-tip-desc">${entry.desc}</div>
      ${entry.stacks != null ? `<div class="buff-tip-stat">Stacks : <strong>${entry.stacks}${entry.maxStacks ? ` / ${entry.maxStacks}` : ''}</strong></div>` : ''}
      ${entry.timer != null && entry.timer > 0 ? `<div class="buff-tip-stat">Durée : <strong>${Math.ceil(entry.timer)}s</strong></div>` : ''}
      ${entry.extra && entry.stacks == null ? `<div class="buff-tip-stat">${entry.extra}</div>` : ''}
    `;

    const rect = anchorEl.getBoundingClientRect();
    tip.style.left = `${rect.left}px`;
    tip.style.top = `${rect.bottom + 6}px`;
    tip.classList.add('visible');
  },

  hideTooltip(): void {
    const tip = document.getElementById('buff-hover-tooltip');
    if (tip) tip.classList.remove('visible');
    this.hoveredId = null;
  },

  tick(): void {
    this.render();
  },
};
