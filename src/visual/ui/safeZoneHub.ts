// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { isInSafeZone } from '@/gameplay/world/worldZones';
import { NewSkillUI } from './skills';
import { ForgeUI } from './forge';
import { UI } from '../ui';

export const SafeZoneHub = {
  recallCooldown: 0,
  _bound: false,

  init(): void {
    if (!this._bound) {
      this._bound = true;
      this.bindHubButtons();
    }

    const recall = document.getElementById('recall-btn');
    if (recall && !recall.dataset.bound) {
      recall.dataset.bound = '1';
      recall.addEventListener('click', () => this.recallToSafeZone());
    }
  },

  bindHubButtons(): void {
    const panel = document.getElementById('safe-hub-panel');
    if (!panel) return;

    const actions: Record<string, () => void> = {
      stellar: () => this.openStellarUI(),
      forge: () => this.openForge(),
      close: () => this.closeHub(),
    };

    panel.querySelectorAll('[data-hub-action]').forEach((el) => {
      const key = el.getAttribute('data-hub-action');
      if (!key || !actions[key]) return;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        actions[key]();
      });
    });

    panel.addEventListener('click', (e) => {
      if (e.target === panel) this.closeHub();
    });
  },

  isInHub(): boolean {
    return Globals.player && isInSafeZone(Globals.player.position) && !STATE.leftSafeZone;
  },

  canOpenServices(): boolean {
    return this.isInHub();
  },

  openHub(): void {
    if (!this.canOpenServices()) {
      UI.toast('Retournez à la base (Rappel) pour accéder au menu.');
      return;
    }
    const panel = document.getElementById('safe-hub-panel');
    if (panel) {
      panel.classList.add('active');
      if (!STATE.multiplayer.active) STATE.isPaused = true;
    }
  },

  closeHub(keepPaused = false): void {
    const panel = document.getElementById('safe-hub-panel');
    if (panel) panel.classList.remove('active');
    if (!keepPaused && !STATE.multiplayer.active && !UI.isMenuOpen()) STATE.isPaused = false;
  },

  openSkillTab(tab: string): void {
    this.closeHub(true);
    const wrapper = document.getElementById('skill-ui-wrapper');
    if (!wrapper) {
      UI.toast('Interface indisponible.');
      return;
    }
    if (!wrapper.classList.contains('active')) NewSkillUI.toggle();
    NewSkillUI.switchTab(tab);
  },

  openStellarUI(): void {
    if (!this.canOpenServices()) return;
    this.openSkillTab('tree');
  },

  openForge(): void {
    if (!this.canOpenServices()) return;
    this.closeHub(true);
    ForgeUI.toggle();
  },

  recallToSafeZone(): void {
    if (!Globals.player || Globals.player.dead) return;
    if (this.recallCooldown > 0) {
      UI.toast(`Rappel dans ${Math.ceil(this.recallCooldown)}s`);
      return;
    }
    Globals.player.position.set(0, 0, 0);
    Globals.player.knockback?.set?.(0, 0, 0);
    STATE.leftSafeZone = false;
    this.recallCooldown = 8;
    this.updateRecallButton();
    UI.toast('Rappel — Zone sûre');
  },

  tick(dt: number): void {
    if (this.recallCooldown > 0) this.recallCooldown = Math.max(0, this.recallCooldown - dt);
    this.updateRecallButton();

    if (!Globals.player) return;
    const inSafe = isInSafeZone(Globals.player.position);
    if (!STATE.leftSafeZone && !inSafe) STATE.leftSafeZone = true;

    const hubHint = document.getElementById('safe-hub-hint');
    if (hubHint) hubHint.style.display = !STATE.leftSafeZone && inSafe ? 'block' : 'none';
  },

  updateRecallButton(): void {
    const btn = document.getElementById('recall-btn');
    if (!btn) return;
    const show = STATE.leftSafeZone && Globals.player && !Globals.player.dead;
    btn.style.display = show ? 'flex' : 'none';
    if (show) {
      btn.textContent = this.recallCooldown > 0
        ? `Rappel (${Math.ceil(this.recallCooldown)}s)`
        : 'Rappel — Base';
      btn.classList.toggle('recall-ready', this.recallCooldown <= 0);
    }
  },
};

window.SafeZoneHub = SafeZoneHub;
