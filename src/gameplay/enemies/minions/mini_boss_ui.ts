// @ts-nocheck
/** UI Mini-Boss compacte — nom, tous les tiers, overshield, HP. */

import * as THREE from 'three';
import { Globals } from '@/core/globals';
import { getMaxOvershieldHp, getOvershieldHp } from './mini_boss_combat_core';
import {
  dedupeMiniBossTiers,
  formatMiniBossTierDisplay,
  type MiniBossTierId,
} from './mini_boss_tiers';

const PLATE_W = 220;
const PAD = 5;
const GAP = 3;
const NAME_H = 15;
const TIER_LINE_H = 10;
const SHIELD_BAR_H = 5;
const HP_BAR_H = 6;
const INNER_W = PLATE_W - PAD * 2;

const SCALE_MIN = 0.0095;
const SCALE_MAX = 0.017;
const BASE_Y_MULT = 1.72;

export type MiniBossUiConfig = {
  name: string;
  tiers: MiniBossTierId[];
  accentHex: number;
};

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function computePlateHeight(tierLines: number): number {
  return PAD + NAME_H + 1 + tierLines * TIER_LINE_H + GAP + SHIELD_BAR_H + GAP + HP_BAR_H + PAD;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  bg: string,
  colors: [string, string],
  flash = 0,
): void {
  drawRoundedRect(ctx, x, y, w, h, 2);
  ctx.fillStyle = bg;
  ctx.fill();
  const fw = Math.max(0, Math.min(w, w * pct));
  if (fw > 0.5) {
    drawRoundedRect(ctx, x, y, fw, h, 2);
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.fill();
  }
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash * 0.55;
    drawRoundedRect(ctx, x, y, w, h, 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }
}

function getTierDisplay(enemy: { miniBossTiers?: MiniBossTierId[]; miniBossUi?: { tiers?: MiniBossTierId[] } }) {
  const tiers = dedupeMiniBossTiers(enemy.miniBossTiers || enemy.miniBossUi?.tiers || []);
  return formatMiniBossTierDisplay(tiers);
}

function paintPlate(
  ctx: CanvasRenderingContext2D,
  plateH: number,
  cfg: {
    name: string;
    tierLines: string[];
    tierFontSize: number;
    accentHex: number;
    hpPct: number;
    shieldPct: number;
    hasShield: boolean;
    shieldFlash: number;
  },
): void {
  const accent = hexToCss(cfg.accentHex);
  ctx.clearRect(0, 0, PLATE_W, plateH);

  drawRoundedRect(ctx, 1, 1, PLATE_W - 2, plateH - 2, 5);
  ctx.fillStyle = 'rgba(8, 10, 14, 0.92)';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.stroke();

  const x = PAD;
  let y = PAD;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#eef2f8';
  ctx.font = '700 14px Cinzel, Georgia, serif';
  ctx.fillText(cfg.name.toUpperCase(), PLATE_W / 2, y + 12);
  y += NAME_H + 1;

  ctx.fillStyle = accent;
  ctx.font = `600 ${cfg.tierFontSize}px system-ui, sans-serif`;
  for (const line of cfg.tierLines) {
    if (line) ctx.fillText(line, PLATE_W / 2, y + cfg.tierFontSize - 1);
    y += TIER_LINE_H;
  }
  y += GAP;

  if (cfg.hasShield) {
    drawBar(ctx, x, y, INNER_W, SHIELD_BAR_H, cfg.shieldPct, '#0c1624', ['#2bbcff', '#7c3aed'], cfg.shieldFlash);
    y += SHIELD_BAR_H + GAP;
  }

  drawBar(ctx, x, y, INNER_W, HP_BAR_H, cfg.hpPct, '#180808', ['#d64545', '#a93226']);
}

function disposePlate(enemy: { miniBossPlate?: THREE.Sprite }) {
  if (!enemy.miniBossPlate) return;
  enemy.remove(enemy.miniBossPlate);
  const mat = enemy.miniBossPlate.material;
  if (mat?.map) mat.map.dispose();
  mat?.dispose();
  enemy.miniBossPlate = null;
  enemy.miniBossUi = null;
}

function ensureCanvasSize(ui: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture }, height: number) {
  if (ui.canvas.height !== height) {
    ui.canvas.height = height;
    ui.texture.needsUpdate = true;
  }
}

export function setupMiniBossUi(
  enemy: {
    scaleVal?: number;
    hp?: number;
    hudGroup?: THREE.Group;
    nameSprite?: THREE.Sprite;
    miniBossPlate?: THREE.Sprite;
    miniBossUi?: Record<string, unknown>;
    miniBossAccent?: number;
    miniBossName?: string;
    miniBossTiers?: MiniBossTierId[];
  },
  config: MiniBossUiConfig,
): void {
  disposePlate(enemy);

  if (enemy.nameSprite) {
    enemy.remove(enemy.nameSprite);
    enemy.nameSprite.material?.map?.dispose();
    enemy.nameSprite.material?.dispose();
    enemy.nameSprite = null;
  }
  if (enemy.hudGroup) enemy.hudGroup.visible = false;

  const tiers = dedupeMiniBossTiers(config.tiers || enemy.miniBossTiers || []);
  enemy.miniBossTiers = tiers;
  enemy.miniBossAccent = config.accentHex;
  enemy.miniBossName = config.name;

  const tierDisplay = formatMiniBossTierDisplay(tiers);
  const plateH = computePlateHeight(tierDisplay.lines.length);

  const canvas = document.createElement('canvas');
  canvas.width = PLATE_W;
  canvas.height = plateH;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }),
  );
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 20;
  sprite.position.y = (enemy.scaleVal || 1) * BASE_Y_MULT;
  enemy.add(sprite);

  const shield = getOvershieldHp(enemy);
  enemy.miniBossPlate = sprite;
  enemy.miniBossUi = {
    canvas,
    ctx,
    texture,
    name: config.name,
    tiers,
    plateH,
    tierLineCount: tierDisplay.lines.length,
    accentHex: config.accentHex,
    shieldFlash: 0,
    lastShield: shield,
    displayHp: enemy.hp ?? 0,
    displayShield: shield,
  };

  paintPlate(ctx, plateH, {
    name: config.name,
    tierLines: tierDisplay.lines,
    tierFontSize: tierDisplay.fontSize,
    accentHex: config.accentHex,
    hpPct: 1,
    shieldPct: 1,
    hasShield: getMaxOvershieldHp(enemy) > 0,
    shieldFlash: 0,
  });
  texture.needsUpdate = true;
}

export function syncMiniBossUiTiers(enemy: { miniBossTiers?: MiniBossTierId[]; miniBossUi?: Record<string, unknown> }): void {
  if (!enemy.miniBossUi) return;
  const tiers = dedupeMiniBossTiers(enemy.miniBossTiers || []);
  enemy.miniBossUi.tiers = tiers;
}

export function triggerMiniBossShieldFlash(enemy: { miniBossUi?: { shieldFlash: number } }): void {
  if (enemy.miniBossUi) enemy.miniBossUi.shieldFlash = 0.18;
}

function computeScale(enemy: THREE.Object3D, camera: THREE.Camera): number {
  const dist = camera.position.distanceTo(enemy.position);
  const distFactor = THREE.MathUtils.clamp(dist * 0.034, 0.78, 1.15);
  const mobFactor = (enemy as { scaleVal?: number }).scaleVal || 1;
  return THREE.MathUtils.clamp(0.0145 * distFactor * mobFactor, SCALE_MIN, SCALE_MAX);
}

export function updateMiniBossUi(
  enemy: {
    hp?: number;
    maxHp?: number;
    scaleVal?: number;
    miniBossPlate?: THREE.Sprite;
    miniBossTiers?: MiniBossTierId[];
    miniBossUi?: {
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      texture: THREE.CanvasTexture;
      name: string;
      tiers: MiniBossTierId[];
      plateH: number;
      tierLineCount: number;
      accentHex: number;
      shieldFlash: number;
      lastShield: number;
      displayHp: number;
      displayShield: number;
    };
    maxOvershieldHp?: number;
    maxBarrierHp?: number;
  },
  dt: number,
  camera?: THREE.Camera,
): void {
  const ui = enemy.miniBossUi;
  const plate = enemy.miniBossPlate;
  if (!ui || !plate || !enemy.maxHp) return;

  const cam = camera || Globals.camera;
  if (!cam) return;

  const tiers = dedupeMiniBossTiers(enemy.miniBossTiers || ui.tiers || []);
  ui.tiers = tiers;
  enemy.miniBossTiers = tiers;

  const tierDisplay = getTierDisplay(enemy);
  const plateH = computePlateHeight(tierDisplay.lines.length);
  ensureCanvasSize(ui, plateH);
  ui.plateH = plateH;
  ui.tierLineCount = tierDisplay.lines.length;

  if (ui.shieldFlash > 0) ui.shieldFlash -= dt;

  const shield = getOvershieldHp(enemy);
  const maxShield = getMaxOvershieldHp(enemy);
  if (ui.lastShield >= 0 && shield < ui.lastShield) ui.shieldFlash = 0.18;
  ui.lastShield = shield;

  ui.displayHp = THREE.MathUtils.lerp(ui.displayHp, enemy.hp ?? 0, Math.min(1, dt * 10));
  ui.displayShield = THREE.MathUtils.lerp(ui.displayShield, shield, Math.min(1, dt * 12));

  paintPlate(ui.ctx, plateH, {
    name: ui.name,
    tierLines: tierDisplay.lines,
    tierFontSize: tierDisplay.fontSize,
    accentHex: ui.accentHex,
    hpPct: Math.max(0, Math.min(1, ui.displayHp / enemy.maxHp)),
    shieldPct: maxShield > 0 ? Math.max(0, Math.min(1, ui.displayShield / maxShield)) : 0,
    hasShield: maxShield > 0,
    shieldFlash: ui.shieldFlash,
  });
  ui.texture.needsUpdate = true;

  const scale = computeScale(enemy as THREE.Object3D, cam);
  plate.scale.set(PLATE_W * scale, plateH * scale, 1);
  plate.position.y = (enemy.scaleVal || 1) * BASE_Y_MULT;
}
