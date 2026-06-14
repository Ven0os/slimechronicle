// @ts-nocheck
import { STATE } from '@/core/config';
import {
  getConstellationForClass,
  getNodeById,
  type ClassId,
  type ConstellationNode,
} from '@/data/constellations';
import {
  CONSTELLATION_META,
  formatEffectPills,
  getNodeRewardKind,
  getRewardBadgeHtml,
  hasStatEffects,
} from '@/data/constellationMeta';
import { getPassiveMeta } from '@/data/passiveCatalog';
import { formatPassiveDetailHtml } from '@/data/passiveScalingConfig';
import { getBranchLayout, getClassLayout } from '@/data/constellationLayouts';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { AudioSys } from '@/core/ressources';

const SLOT_CLASS = { atk: 'branch-atk', hp: 'branch-hp', spd: 'branch-spd', mst: 'branch-mst' };
const PASSIVE_CATEGORY_LABEL = {
  offense: 'Offense',
  defense: 'Défense',
  utility: 'Utilitaire',
  synergy: 'Synergie',
};

/** Canvas large pour constellation éparpillée */
const CANVAS = { size: 720, cx: 360, cy: 360 };

const MIN_NODE_GAP_PX = 4;
const BRANCH_CHAIN_EXTRA_PX = 2;
const BRANCH_TIER_COUNT = 10;
const NODE_SIZE = { normal: 22, keystone: 28 };
/** Zone réservée autour de l'Apex — réduite pour garder les keystones proches. */
const APEX_CLEAR_RADIUS = 38;
const CANVAS_MARGIN = 30;

let selectedNodeId: string | null = null;
let layoutCache: Map<string, { x: number; y: number; size: number }> = new Map();

let zoomScale = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let initialPanX = 0;
let initialPanY = 0;
let hasDragged = false;

function updateViewportTransform(): void {
  const inner = document.getElementById('constellation-inner');
  if (inner) {
    inner.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
  }
}

interface PlacedNode {
  id: string;
  x: number;
  y: number;
  size: number;
  branchId: string;
  tierIndex: number;
  keystone?: boolean;
}

const CLASS_BRANCH_INDICES: Record<string, Record<string, number>> = {
  warrior: { cri: 0, fureur: 1, gardien: 2, rempart: 3, seisme: 4 },
  mage: { flux: 0, mirage: 1, prisme: 2, givre: 3, replique: 4 },
  sentinel: { rayon: 0, aile: 1, sanctuaire: 2, egide: 3, surcharge: 4 },
  blade: { hemo: 0, sanguine: 1, ombre: 2, cyclone: 3, survie: 4 },
  pacifier: { jugement: 0, frénesie: 1, rituel: 2, transfusion: 3, pistol: 4 },
  eclipse: { soleil: 0, orbite: 1, lune: 2, vide: 3, devoration: 4 },
  chronoregulator: { continuum: 0, echo: 1, distorsion: 2, lentille: 3, paradoxe: 4 }
};

const CLASS_LAYOUT_OFFSETS: Record<string, number> = {
  warrior: 0,
  mage: 15,
  sentinel: 30,
  blade: 45,
  pacifier: 60,
  eclipse: 75,
  chronoregulator: 90
};

function hashPair(a: string, b: string): number {
  return (a + b).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function maxOrbitRadius(): number {
  return CANVAS.size / 2 - CANVAS_MARGIN - NODE_SIZE.keystone / 2;
}

/** Placement en arc par classe — palier 10 (keystone) proche de l'Apex. */
function scatterNodePos(
  classId: ClassId,
  branchId: string,
  tierIndex: number,
  keystone = false,
): { x: number; y: number } {
  const cx = CANVAS.cx;
  const cy = CANVAS.cy;

  // Répartition radiale uniforme des 5 branches à 72° d'écart
  const branchIdx = CLASS_BRANCH_INDICES[classId]?.[branchId] ?? 0;
  const offsetDeg = CLASS_LAYOUT_OFFSETS[classId] ?? 0;
  const angleDeg = branchIdx * 72 + offsetDeg - 90;
  const baseRad = (angleDeg * Math.PI) / 180;

  // Progression de rayon : de l'extérieur (310px) vers l'intérieur (85px)
  const R_max = 310;
  const R_min = 85;
  const R = R_max - tierIndex * (R_max - R_min) / 9;

  switch (classId) {
    case 'chronoregulator': {
      // Prism-inspired geometry: rayon droit et net formant une étoile géométrique parfaite
      return {
        x: cx + R * Math.cos(baseRad),
        y: cy + R * Math.sin(baseRad)
      };
    }

    case 'warrior': {
      // Runic Warrior -> Defensive fortress structure: forme concentrique carrée fortifiée
      const cos = Math.cos(baseRad);
      const sin = Math.sin(baseRad);
      const scale = 1 / Math.max(Math.abs(cos), Math.abs(sin));
      return {
        x: cx + R * cos * scale,
        y: cy + R * sin * scale
      };
    }

    case 'pacifier': {
      // Pacifier -> Aggressive forward progression: resserrement exponentiel vers le centre et léger angle chevron
      const k = tierIndex / 9;
      const pac_R = 85 + 235 * Math.pow(1 - k, 1.35);
      const bend = Math.sin(k * Math.PI) * 0.12;
      return {
        x: cx + pac_R * Math.cos(baseRad + bend),
        y: cy + pac_R * Math.sin(baseRad + bend)
      };
    }

    case 'sentinel': {
      // Sentinel -> Symmetrical defensive structure: ailes symétriques courbées
      let wingBend = 0;
      if (branchIdx === 1 || branchIdx === 2) {
        wingBend = Math.sin((tierIndex / 9) * Math.PI) * 0.22;
      } else if (branchIdx === 3 || branchIdx === 4) {
        wingBend = -Math.sin((tierIndex / 9) * Math.PI) * 0.22;
      }
      return {
        x: cx + R * Math.cos(baseRad + wingBend),
        y: cy + R * Math.sin(baseRad + wingBend)
      };
    }

    case 'eclipse': {
      // Eclipse Knight -> Dual-path eclipse inspired pattern: branches solaires courbent à gauche, lunaires à droite
      let eclipseCurve = 0;
      if (branchId === 'soleil' || branchId === 'devoration') {
        eclipseCurve = -0.35 * Math.sin((tierIndex / 9) * Math.PI);
      } else if (branchId === 'lune' || branchId === 'vide') {
        eclipseCurve = 0.35 * Math.sin((tierIndex / 9) * Math.PI);
      }
      return {
        x: cx + R * Math.cos(baseRad + eclipseCurve),
        y: cy + R * Math.sin(baseRad + eclipseCurve)
      };
    }

    case 'mage': {
      // Paradox Mage -> Distorted asymmetrical geometry: spirale asymétrique
      const spiralOffset = 0.42 * Math.sin((tierIndex / 9) * Math.PI * 1.15) * (branchIdx % 2 === 0 ? 1 : -1);
      return {
        x: cx + R * Math.cos(baseRad + spiralOffset),
        y: cy + R * Math.sin(baseRad + spiralOffset)
      };
    }

    case 'blade': {
      // Bladebreaker -> Aggressive offensive branching: dent de scie
      const zigzag = (tierIndex % 2 === 0 ? 0.08 : -0.08);
      return {
        x: cx + R * Math.cos(baseRad + zigzag),
        y: cy + R * Math.sin(baseRad + zigzag)
      };
    }

    default: {
      return {
        x: cx + R * Math.cos(baseRad),
        y: cy + R * Math.sin(baseRad)
      };
    }
  }
}

/** Demi-diagonale du losange (carré pivoté 45°) */
function nodeRadius(size: number): number {
  return (size / 2) * Math.SQRT2;
}

function minCenterDist(a: PlacedNode, b: PlacedNode): number {
  let gap = MIN_NODE_GAP_PX;
  if (a.branchId === b.branchId && Math.abs(a.tierIndex - b.tierIndex) === 1) {
    gap += BRANCH_CHAIN_EXTRA_PX;
  }
  return nodeRadius(a.size) + nodeRadius(b.size) + gap;
}

/** Écarte les nœuds pour garantir MIN_NODE_GAP_PX entre chaque paire */
function enforceMinimumSpacing(nodes: PlacedNode[], iterations = 64): PlacedNode[] {
  const { cx, cy } = CANVAS;
  const orbitLimit = maxOrbitRadius();

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;

    // 1. Enforce boundaries (both inner and outer) inside the loop
    for (const n of nodes) {
      const dx = n.x - cx;
      const dy = n.y - cy;
      const dist = Math.hypot(dx, dy) || 0.001;

      // Inner boundary (APEX)
      const minApex = nodeRadius(n.size) + APEX_CLEAR_RADIUS + MIN_NODE_GAP_PX;
      if (dist < minApex) {
        const push = (minApex - dist) / dist;
        n.x += dx * push;
        n.y += dy * push;
        moved = true;
      }

      // Outer boundary (Orbit Limit)
      if (dist > orbitLimit) {
        n.x = cx + (dx / dist) * orbitLimit;
        n.y = cy + (dy / dist) * orbitLimit;
        moved = true;
      }
    }

    // 2. Pairwise overlaps
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const minD = minCenterDist(a, b);
        if (dist >= minD) continue;

        let ux: number;
        let uy: number;
        if (dist < 0.5) {
          const ang = hashPair(a.id, b.id) * 0.17;
          ux = Math.cos(ang);
          uy = Math.sin(ang);
          dist = 0.001;
        } else {
          ux = dx / dist;
          uy = dy / dist;
        }

        const overlap = (minD - dist) / 2;
        a.x -= ux * overlap;
        a.y -= uy * overlap;
        b.x += ux * overlap;
        b.y += uy * overlap;
        moved = true;
      }
    }

    if (!moved) break;
  }

  // 3. Final clamping to ensure strict boundaries
  for (const n of nodes) {
    const dx = n.x - cx;
    const dy = n.y - cy;
    const dist = Math.hypot(dx, dy) || 0.001;
    const minApex = nodeRadius(n.size) + APEX_CLEAR_RADIUS + MIN_NODE_GAP_PX;

    if (dist < minApex) {
      n.x = cx + (dx / dist) * minApex;
      n.y = cy + (dy / dist) * minApex;
    } else if (dist > orbitLimit) {
      n.x = cx + (dx / dist) * orbitLimit;
      n.y = cy + (dy / dist) * orbitLimit;
    }
  }

  return nodes;
}

function computeLayout(classId: ClassId): Map<string, { x: number; y: number; size: number }> {
  const c = getConstellationForClass(classId);
  const placed: PlacedNode[] = [];

  for (const branch of c.branches) {
    branch.nodes.forEach((node, i) => {
      const pos = scatterNodePos(classId, branch.id, i, !!node.keystone);
      placed.push({
        id: node.id,
        x: pos.x,
        y: pos.y,
        size: node.keystone ? NODE_SIZE.keystone : NODE_SIZE.normal,
        branchId: branch.id,
        tierIndex: i,
        keystone: !!node.keystone,
      });
    });
  }

  enforceMinimumSpacing(placed, 80);

  const map = new Map<string, { x: number; y: number; size: number }>();
  for (const p of placed) map.set(p.id, { x: p.x, y: p.y, size: p.size });
  layoutCache = map;
  return map;
}

function toPercent(x: number, y: number): { left: string; top: string } {
  return {
    left: `${(x / CANVAS.size) * 100}%`,
    top: `${(y / CANVAS.size) * 100}%`,
  };
}

function branchProgress(classId: ClassId, branchId: string): { unlocked: number; total: number } {
  const c = getConstellationForClass(classId);
  const branch = c.branches.find((b) => b.id === branchId);
  if (!branch) return { unlocked: 0, total: 0 };
  const unlocked = branch.nodes.filter((n) => ConstellationEngine.isNodeUnlocked(n.id)).length;
  return { unlocked, total: branch.nodes.length };
}

function apexProgressCardClass(state: string): string {
  if (state === 'unlocked') return 'apex-progress-card apex-unlocked-state';
  if (state === 'ready') return 'apex-progress-card apex-ready-state';
  return 'apex-progress-card apex-locked-state';
}

function apexStatusLabel(state: string): string {
  if (state === 'unlocked') return 'DÉBLOQUÉ';
  if (state === 'ready') return 'APEX READY';
  return 'Verrouillé';
}

function centerStarClass(state: string, apexUnlocked: boolean): string {
  const base = 'center-star';
  if (apexUnlocked) return `${base} apex-multicolor apex-unlocked`;
  if (state === 'ready') return `${base} apex-multicolor apex-ready`;
  return base;
}

function nodeStatus(nodeId: string): 'locked' | 'available' | 'unlocked' {
  if (ConstellationEngine.isNodeUnlocked(nodeId)) return 'unlocked';
  if (ConstellationEngine.canUnlock(nodeId).ok) return 'available';
  return 'locked';
}

interface PassiveEffectLine {
  title?: string;
  body: string;
}

function parsePassiveEffectLines(desc: string): PassiveEffectLine[] {
  const passifMatch = desc.match(/^passif\s*:\s*(.+)$/i);
  const raw = passifMatch ? passifMatch[1].trim() : desc.trim();

  const segments = raw
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const lines: PassiveEffectLine[] = [];

  for (const segment of segments) {
    const text = segment.replace(/\.$/, '');
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 48) {
      lines.push({
        title: text.slice(0, colonIdx).trim(),
        body: text.slice(colonIdx + 1).trim(),
      });
    } else if (passifMatch && lines.length === 0) {
      lines.push({ title: 'Passif', body: text });
    } else {
      lines.push({ body: text });
    }
  }

  return lines.length ? lines : [{ body: desc }];
}

function renderPassiveEffectLines(lines: PassiveEffectLine[]): string {
  return lines
    .map(
      (line) => `
        <div class="detail-passive-effect-line">
          ${line.title ? `<div class="detail-passive-line-title">${line.title}</div>` : ''}
          <p class="detail-passive-line-text">${line.body}</p>
        </div>
      `,
    )
    .join('');
}

function renderDetailPanel(node: ConstellationNode | null, classId: ClassId): void {
  const panel = document.getElementById('constellation-detail');
  if (!panel) return;

  if (!node) {
    const meta = CONSTELLATION_META[classId];
    const c = getConstellationForClass(classId);
    const total = ConstellationEngine.getUnlockedNonApexCount(classId);
    const totalNodes = ConstellationEngine.getNonApexNodeTotal(classId);
    const apexState = ConstellationEngine.getApexProgressState(classId);
    panel.innerHTML = `
      <div class="detail-empty">
        <p class="detail-lore">${meta.lore}</p>
        <p class="detail-motto">« ${meta.motto} »</p>
        <div class="detail-stats-row">
          <span><i class="fas fa-star"></i> ${total} / ${totalNodes} nœuds</span>
          <span><i class="fas fa-crown"></i> Apex ${apexState === 'unlocked' ? 'actif' : apexState === 'ready' ? 'prêt' : 'verrouillé'}</span>
        </div>
        <div class="detail-legend">
          <span><i class="node-legend-dot locked"></i> Verrouillé</span>
          <span><i class="node-legend-dot available"></i> Disponible</span>
          <span><i class="node-legend-dot unlocked"></i> Maîtrisé</span>
        </div>
        <div class="detail-reward-legend">
          <span class="detail-reward-badge badge-stat">Paliers 1-3</span> bonus de stats permanents<br>
          <span class="detail-reward-badge badge-passive">Palier 4</span> spécialisation de branche<br>
          <span class="detail-reward-badge badge-apex"><span class="badge-apex-text">Apex</span></span> aboutissement de la constellation
        </div>
        <p class="detail-hint">Cliquez une étoile pour voir son effet.</p>
      </div>
    `;
    return;
  }

  const status = nodeStatus(node.id);
  const check = ConstellationEngine.canUnlock(node.id);
  const rewardKind = getNodeRewardKind(node);
  const isStatNode = rewardKind === 'stat';
  const isKeystone = rewardKind === 'keystone';
  const effectPills = formatEffectPills(node.effects, !isStatNode, classId);
  const passiveMeta = !isStatNode && node.effects.passive ? getPassiveMeta(node.effects.passive) : null;
  const statPills = isStatNode
    ? effectPills
    : (hasStatEffects(node.effects, isKeystone, classId)
      ? formatEffectPills(node.effects, false, classId, isKeystone)
      : '');

  let reqText = '';
  if (node.requires?.length) {
    reqText = node.requires.map((r) => getNodeById(r)?.name || r).join('  →  ');
  }
  if (node.branch === 'apex') {
    const missing = ConstellationEngine.getNonApexNodeTotal(classId) - ConstellationEngine.getUnlockedNonApexCount(classId);
    reqText = missing > 0
      ? `Tous les nœuds de constellation (${missing} restant${missing > 1 ? 's' : ''})`
      : 'Tous les nœuds débloqués — Apex disponible';
  }

  const reqHtml = reqText
    ? `<div class="detail-req-block">
        <div class="detail-req-label">PRÉREQUIS</div>
        <div class="detail-req-value">${reqText}</div>
      </div>`
    : '';

  const blockedByReq = !check.ok && (check.reason?.includes('Prérequis') || check.reason?.includes('prérequis') || check.reason?.includes('nœuds') || check.reason?.includes('branches') || check.reason?.includes('points'));

  let statusMsg = '';
  if (status === 'unlocked') statusMsg = '<span class="status-ok">✓ Nœud maîtrisé</span>';
  else if (status === 'available' && check.ok) statusMsg = '<span class="status-ready">★ Prêt à débloquer</span>';
  else if (blockedByReq) statusMsg = `<span class="status-blocked">${check.reason}</span>`;
  else statusMsg = `<span class="status-blocked">${check.reason || 'Verrouillé'}</span>`;

  const effectSectionHtml = isStatNode
    ? ''
    : (() => {
        const accent = passiveMeta?.color || '#d4af37';
        let icon = passiveMeta?.icon || node.icon || 'fa-star';
        if (!icon.startsWith('fa-')) icon = `fa-${icon}`;
        const apexClass = rewardKind === 'apex' ? ' detail-section-apex-effect' : '';
        const iconClass = rewardKind === 'apex' ? ' detail-passive-effect-icon apex-card-icon' : ' detail-passive-effect-icon';
        const passiveKey = node.effects.passive;
        const passiveRank = node.effects.passiveRank ?? 1;
        const detailHtml = passiveKey
          ? formatPassiveDetailHtml(passiveKey, passiveRank)
          : `<p class="detail-passive-fallback">${node.desc}</p>`;
        const passiveTitle = passiveMeta?.name || node.name;
        const passiveCategory = passiveMeta ? PASSIVE_CATEGORY_LABEL[passiveMeta.category] : 'Passif';
        return `<div class="detail-section detail-section-passive-effect${apexClass}">
          <div class="detail-passive-effect-card" style="--passive-accent:${accent}">
            <div class="detail-passive-effect-glow"></div>
            <div class="${iconClass.trim()}"><i class="fas ${icon}" aria-hidden="true"></i></div>
            <div class="detail-passive-effect-body">
              <div class="detail-passive-effect-kicker">${rewardKind === 'apex' ? 'Synergie' : `Passif · ${passiveCategory}`}</div>
              <div class="detail-passive-effect-name">${passiveTitle}</div>
              ${detailHtml}
            </div>
          </div>
        </div>`;
      })();

  panel.innerHTML = `
    <div class="detail-card status-${status} reward-${rewardKind}">
      <div class="detail-card-header">
        <span class="detail-node-icon"><i class="fas ${node.icon}"></i></span>
        <div>
          <div class="detail-header-badges">${getRewardBadgeHtml(rewardKind)}${node.keystone && rewardKind === 'keystone' ? '<span class="keystone-tag">FIN DE BRANCHE</span>' : ''}</div>
          <h3 class="detail-node-name">${node.name}</h3>
          <span class="detail-node-tier">Palier ${node.tier} · ${node.cost} point${node.cost > 1 ? 's' : ''} stellaire${node.cost > 1 ? 's' : ''}</span>
        </div>
      </div>

      ${effectSectionHtml}

      ${statPills ? `<div class="detail-section${isStatNode ? '' : ' detail-section-stat-bonus'}"><div class="detail-section-title">${isStatNode ? 'Attributs augmentés' : 'BONUS DE STATS'}</div><div class="effect-pills${isStatNode ? '' : ' effect-pills-animated'}">${statPills}</div></div>` : ''}

      ${reqHtml}
      <div class="detail-status-msg">${statusMsg}</div>
      ${status === 'available' && check.ok ? `<button class="detail-unlock-btn" data-unlock="${node.id}">Débloquer · ${node.cost} ★</button>` : ''}
    </div>
  `;

  const btn = panel.querySelector('.detail-unlock-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      if (window.SkillTree) window.SkillTree.unlock(node.id);
    });
  }
}

function drawOrbits(svg: SVGSVGElement, classId: ClassId, theme: string): void {
  const c = getConstellationForClass(classId);
  const { cx, cy, size } = CANVAS;

  svg.innerHTML = '';
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <radialGradient id="coreGlow"><stop offset="0%" stop-color="${theme}" stop-opacity="0.35"/><stop offset="100%" stop-color="${theme}" stop-opacity="0"/></radialGradient>
    <linearGradient id="apexLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff6b9d"/><stop offset="25%" stop-color="#ffd93d"/>
      <stop offset="50%" stop-color="#6bcb77"/><stop offset="75%" stop-color="#4d96ff"/><stop offset="100%" stop-color="#c77dff"/>
    </linearGradient>
  `;
  svg.appendChild(defs);

  // --- DESSIN DES GRILLES CÉLESTES D'ARRIÈRE-PLAN ---
  if (classId === 'warrior') {
    // Concentriques carrées fortifiées
    [320, 230, 140].forEach(r => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(cx - r));
      rect.setAttribute('y', String(cy - r));
      rect.setAttribute('width', String(r * 2));
      rect.setAttribute('height', String(r * 2));
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', theme);
      rect.setAttribute('stroke-width', '0.8');
      rect.setAttribute('opacity', '0.045');
      rect.setAttribute('stroke-dasharray', '4 8');
      svg.appendChild(rect);
    });
  } else if (classId === 'chronoregulator') {
    // Concentriques pentagonales géométriques
    [320, 230, 140].forEach(r => {
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const pts: string[] = [];
      const offsetDeg = CLASS_LAYOUT_OFFSETS.chronoregulator ?? 90;
      for (let side = 0; side < 5; side++) {
        const angle = (side * 72 + offsetDeg - 90) * Math.PI / 180;
        pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      polygon.setAttribute('points', pts.join(' '));
      polygon.setAttribute('fill', 'none');
      polygon.setAttribute('stroke', theme);
      polygon.setAttribute('stroke-width', '0.8');
      polygon.setAttribute('opacity', '0.06');
      polygon.setAttribute('stroke-dasharray', '4 8');
      svg.appendChild(polygon);
    });
  } else if (classId === 'eclipse') {
    // Cercles d'éclipse croisés (Soleil et Lune)
    [
      { kx: cx - 110, ky: cy, r: 160 },
      { kx: cx + 110, ky: cy, r: 160 }
    ].forEach(cSpec => {
      const cCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      cCircle.setAttribute('cx', String(cSpec.kx));
      cCircle.setAttribute('cy', String(cSpec.ky));
      cCircle.setAttribute('r', String(cSpec.r));
      cCircle.setAttribute('fill', 'none');
      cCircle.setAttribute('stroke', theme);
      cCircle.setAttribute('stroke-width', '0.8');
      cCircle.setAttribute('opacity', '0.04');
      cCircle.setAttribute('stroke-dasharray', '3 9');
      svg.appendChild(cCircle);
    });
  } else {
    // Concentriques circulaires célestes standards
    [320, 230, 140].forEach(r => {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', String(cx));
      ring.setAttribute('cy', String(cy));
      ring.setAttribute('r', String(r));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', theme);
      ring.setAttribute('stroke-width', '0.8');
      ring.setAttribute('opacity', '0.04');
      ring.setAttribute('stroke-dasharray', '3 9');
      svg.appendChild(ring);
    });
  }

  const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  core.setAttribute('cx', String(cx));
  core.setAttribute('cy', String(cy));
  core.setAttribute('r', '28');
  core.setAttribute('fill', 'url(#coreGlow)');
  svg.appendChild(core);

  const apexUnlocked = ConstellationEngine.isNodeUnlocked(c.apex.id);

  const layout = layoutCache.size ? layoutCache : computeLayout(classId);

  for (const branch of c.branches) {
    const prog = branchProgress(classId, branch.id);
    const points: Array<{ x: number; y: number; nodeId: string }> = [];

    branch.nodes.forEach((node) => {
      const pos = layout.get(node.id)!;
      points.push({ x: pos.x, y: pos.y, nodeId: node.id });
    });

    for (let i = 0; i < points.length - 1; i++) {
      const pt = points[i];
      const next = points[i + 1];
      const st = nodeStatus(pt.nodeId);
      const seg = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      seg.setAttribute('x1', String(pt.x));
      seg.setAttribute('y1', String(pt.y));
      seg.setAttribute('x2', String(next.x));
      seg.setAttribute('y2', String(next.y));
      seg.setAttribute('class', `branch-line branch-line-${branch.id} ${st}`);
      seg.setAttribute('stroke', st === 'unlocked' ? theme : '#3a3a48');
      seg.setAttribute('stroke-opacity', st === 'unlocked' ? '0.55' : '0.18');
      seg.setAttribute('stroke-width', st === 'unlocked' ? '1.8' : '1');
      if (st === 'available') seg.setAttribute('stroke-dasharray', '6 5');
      svg.appendChild(seg);
    }

    if (points.length) {
      const keystone = points[points.length - 1];
      const ks = nodeStatus(keystone.nodeId);
      const isPrimary = branch.id === getClassLayout(classId).primaryBranch;
      const toApex = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      toApex.setAttribute('x1', String(keystone.x));
      toApex.setAttribute('y1', String(keystone.y));
      toApex.setAttribute('x2', String(cx));
      toApex.setAttribute('y2', String(cy));
      toApex.setAttribute('class', `culmination-link culmination-link-${branch.id} ${ks}${isPrimary ? ' culmination-link-primary' : ''}`);
      toApex.setAttribute('stroke', ks === 'unlocked' ? (isPrimary ? 'url(#apexLineGrad)' : theme) : '#3a3a48');
      toApex.setAttribute('stroke-opacity', ks === 'unlocked' ? (isPrimary ? '0.75' : '0.5') : '0.14');
      toApex.setAttribute('stroke-width', ks === 'unlocked' ? (isPrimary ? '2.2' : '1.6') : '1');
      if (ks === 'available') toApex.setAttribute('stroke-dasharray', '5 4');
      svg.appendChild(toApex);
    }

    if (prog.unlocked > 0 && points.length) {
      const last = points[Math.min(prog.unlocked, points.length) - 1];
      const spark = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      spark.setAttribute('x1', String(cx));
      spark.setAttribute('y1', String(cy));
      spark.setAttribute('x2', String(last.x));
      spark.setAttribute('y2', String(last.y));
      spark.setAttribute('stroke', theme);
      spark.setAttribute('stroke-opacity', String(0.08 + (prog.unlocked / prog.total) * 0.2));
      spark.setAttribute('stroke-width', '1');
      spark.setAttribute('stroke-dasharray', '2 8');
      svg.insertBefore(spark, svg.firstChild?.nextSibling || null);
    }
  }

  const keystoneRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  keystoneRing.setAttribute('cx', String(cx));
  keystoneRing.setAttribute('cy', String(cy));
  keystoneRing.setAttribute('r', '93');
  keystoneRing.setAttribute('fill', 'none');
  keystoneRing.setAttribute('stroke', apexUnlocked ? 'url(#apexLineGrad)' : theme);
  keystoneRing.setAttribute('stroke-width', apexUnlocked ? '1.5' : '1');
  keystoneRing.setAttribute('opacity', apexUnlocked ? '0.35' : '0.12');
  keystoneRing.setAttribute('stroke-dasharray', apexUnlocked ? 'none' : '4 6');
  svg.insertBefore(keystoneRing, svg.firstChild?.nextSibling || null);
}

function bindNode(el: HTMLElement, node: ConstellationNode, onUnlock: (id: string) => void): void {
  const select = () => {
    if (window.isConstellationAnimating || isPanning) return;
    selectedNodeId = node.id;
    renderDetailPanel(node, (STATE.class || 'warrior') as ClassId);
    document.querySelectorAll('.tree-node, .center-star').forEach((n) => n.classList.remove('selected'));
    el.classList.add('selected');
  };
  el.addEventListener('mouseenter', select);
  el.addEventListener('click', () => {
    if (window.isConstellationAnimating) return;
    if (hasDragged) return;
    select();
    if (nodeStatus(node.id) === 'available') onUnlock(node.id);
  });
}

export const ConstellationUI = {
  render(onUnlock: (id: string) => void): void {
    const mount = document.querySelector('#view-tree .constellation-layout');
    if (!mount) return;

    // Reset pan/zoom on full render
    zoomScale = 1.0;
    panX = 0;
    panY = 0;

    const classId = (STATE.class || 'warrior') as ClassId;
    const data = getConstellationForClass(classId);
    const meta = CONSTELLATION_META[classId];
    const apexProg = ConstellationEngine.getUnlockedNonApexCount(classId);
    const apexTotal = ConstellationEngine.getNonApexNodeTotal(classId);
    const apexState = ConstellationEngine.getApexProgressState(classId);
    const apexUnlocked = apexState === 'unlocked';
    const apexPct = apexTotal > 0 ? Math.min(100, (apexProg / apexTotal) * 100) : 0;
    const keystones = ConstellationEngine.getUnlockedKeystoneCount(classId);
    const keystonesTotal = ConstellationEngine.getKeystoneTotal(classId);

    mount.style.setProperty('--constellation-theme', data.themeColor);
    selectedNodeId = null;

    mount.innerHTML = `
      <aside class="constellation-sidebar">
        <div class="sidebar-class-badge" style="--badge-color:${data.themeColor}">
          <i class="fas ${data.apex.icon}"></i>
          <div>
            <div class="sidebar-title">${data.title}</div>
            <div class="sidebar-sub">${data.subtitle}</div>
          </div>
        </div>
        <div class="${apexProgressCardClass(apexState)}">
          <div class="apex-progress-label"><i class="fas fa-crown"></i> Apex Progress</div>
          <div class="apex-progress-bar"><div class="apex-progress-fill" style="width:${apexPct}%"></div></div>
          <div class="apex-progress-text">${apexProg} / ${apexTotal} Nœuds · ${keystones} / ${keystonesTotal} Passifs</div>
          <div class="apex-progress-status">${apexStatusLabel(apexState)}</div>
        </div>

        <div class="sidebar-section-title"><i class="fas fa-network-wired"></i> Branches de Talent</div>
        <div class="sidebar-branches-list">
          ${data.branches.map(branch => {
            const prog = branchProgress(classId, branch.id);
            const isCompleted = prog.unlocked === prog.total;
            return `
              <div class="sidebar-branch-row" data-branch-id="${branch.id}">
                <div class="branch-row-info">
                  <span class="branch-row-name">${branch.label}</span>
                  <span class="branch-row-prog">${prog.unlocked} / ${prog.total}</span>
                </div>
                <button class="branch-max-btn ${isCompleted ? 'completed' : ''}" data-max-branch="${branch.id}" ${isCompleted ? 'disabled' : ''}>
                  MAX
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <div class="sidebar-node-hint">
          <p><span class="hint-dot hint-stat"></span> Paliers 1–3 : stats</p>
          <p><span class="hint-dot hint-keystone"></span> Palier 4 : spécialisation</p>
          <p><span class="hint-dot hint-apex"></span> Apex : aboutissement</p>
        </div>
      </aside>
      <div class="constellation-canvas">
        <div class="constellation-inner" id="constellation-inner">
          <svg class="constellation-svg" id="constellation-svg"></svg>
          <div class="constellation-nodes-layer" id="constellation-nodes"></div>
          <div class="${centerStarClass(apexState, apexUnlocked)}" id="node-apex" data-node-id="${data.apex.id}">
            <span class="apex-rainbow-ring" aria-hidden="true"></span>
            <span class="apex-rainbow-ring apex-rainbow-delay" aria-hidden="true"></span>
            <span class="apex-sparkle-field" aria-hidden="true"></span>
            <span class="apex-core">
              <i class="fas ${data.apex.icon} center-icon"></i>
              <span class="center-label">APEX</span>
            </span>
          </div>
        </div>
      </div>
      <aside class="constellation-detail-panel" id="constellation-detail"></aside>
    `;

    const layout = computeLayout(classId);
    const svg = mount.querySelector('#constellation-svg');
    drawOrbits(svg, classId, data.themeColor);

    const nodesLayer = mount.querySelector('#constellation-nodes');

    data.branches.forEach((branch, branchIndex) => {
      branch.nodes.forEach((node) => {
        const pos = layout.get(node.id)!;
        const pct = toPercent(pos.x, pos.y);

        const el = document.createElement('div');
        const culmination = node.keystone ? ' node-culmination' : '';
        el.className = `tree-node ${nodeStatus(node.id)} ${node.keystone ? 'keystone node-passive-reward' : 'node-stat-reward'}${culmination}${branch.id === getClassLayout(classId).primaryBranch && node.keystone ? ' node-culmination-primary' : ''}`;
        el.id = `node-${node.id}`;
        el.dataset.nodeId = node.id;
        el.dataset.nodeBranch = branch.id;
        el.style.left = pct.left;
        el.style.top = pct.top;
        el.style.setProperty('--node-delay', `${branchIndex * 70 + node.tier * 22}ms`);
        const keystoneGlow = node.keystone
          ? `<span class="keystone-glow-static" aria-hidden="true"></span>
             <span class="keystone-glow-animated" aria-hidden="true"></span>`
          : '';

        el.innerHTML = `
          ${keystoneGlow}
          <span class="node-icon-wrap"><i class="fas ${node.icon}"></i></span>
          <span class="node-tier-badge">${node.tier}</span>
          <span class="node-hover-name">${node.name}</span>
        `;
        el.title = node.name;
        bindNode(el, node, onUnlock);
        nodesLayer.appendChild(el);
      });
    });

    const apexEl = mount.querySelector('#node-apex');
    bindNode(apexEl, data.apex, onUnlock);


    // Pan & Zoom Listeners setup
    const canvas = mount.querySelector('.constellation-canvas');
    if (canvas) {
      // Set initial transform
      updateViewportTransform();

      // Panning
      canvas.addEventListener('mousedown', (e: MouseEvent) => {
        if (window.isConstellationAnimating) return;
        if (e.button !== 0) return;

        isPanning = true;
        canvas.classList.add('grabbing');
        startPanX = e.clientX;
        startPanY = e.clientY;
        initialPanX = panX;
        initialPanY = panY;
        hasDragged = false;

        const handleMouseMove = (moveEvent: MouseEvent) => {
          if (!isPanning) return;
          const dx = moveEvent.clientX - startPanX;
          const dy = moveEvent.clientY - startPanY;
          if (Math.hypot(dx, dy) > 5) {
            hasDragged = true;
          }
          panX = initialPanX + dx;
          panY = initialPanY + dy;
          updateViewportTransform();
        };

        const handleMouseUp = () => {
          isPanning = false;
          canvas.classList.remove('grabbing');
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      });

      // Zooming
      canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const oldScale = zoomScale;
        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
          zoomScale = Math.min(2.2, zoomScale * zoomFactor);
        } else {
          zoomScale = Math.max(0.4, zoomScale / zoomFactor);
        }

        const ratio = zoomScale / oldScale;
        panX = mouseX - ratio * (mouseX - panX);
        panY = mouseY - ratio * (mouseY - panY);

        updateViewportTransform();
      }, { passive: false });

      // Double click to reset
      canvas.addEventListener('dblclick', () => {
        zoomScale = 1.0;
        panX = 0;
        panY = 0;
        updateViewportTransform();
      });
    }
    // Max branch allocation button bindings
    const maxBtns = mount.querySelectorAll('.branch-max-btn');
    maxBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const branchId = btn.getAttribute('data-max-branch');
        if (branchId && window.SkillTree) {
          window.SkillTree.maxAllocateBranch(classId, branchId);
        }
      });
    });

    const setBranchFocus = (branchId: string | null) => {
      mount.classList.toggle('branch-focus-active', !!branchId);
      mount.querySelectorAll('.branch-focus').forEach((el) => el.classList.remove('branch-focus'));
      mount.querySelectorAll('.sidebar-branch-row.is-focused').forEach((el) => el.classList.remove('is-focused'));
      if (!branchId) return;

      const branchSelector = CSS.escape(branchId);
      mount.querySelector(`.sidebar-branch-row[data-branch-id="${branchSelector}"]`)?.classList.add('is-focused');
      mount.querySelectorAll(`[data-node-branch="${branchId}"], .branch-line-${branchSelector}, .culmination-link-${branchSelector}`)
        .forEach((el) => el.classList.add('branch-focus'));
    };

    mount.querySelectorAll('.sidebar-branch-row').forEach((row) => {
      const branchId = row.getAttribute('data-branch-id');
      if (!branchId) return;
      row.addEventListener('mouseenter', () => setBranchFocus(branchId));
      row.addEventListener('mouseleave', () => setBranchFocus(null));
      row.addEventListener('focusin', () => setBranchFocus(branchId));
      row.addEventListener('focusout', () => setBranchFocus(null));
    });

    renderDetailPanel(null, classId);
    this.refreshVisuals();
  },

  refreshVisuals(): void {
    const classId = (STATE.class || 'warrior') as ClassId;
    const data = getConstellationForClass(classId);
    const allIds = [...data.branches.flatMap((b) => b.nodes.map((n) => n.id)), data.apex.id];

    for (const id of allIds) {
      const el = document.getElementById(`node-${id}`) || document.querySelector(`[data-node-id="${id}"]`);
      if (!el) continue;
      el.classList.remove('locked', 'available', 'unlocked', 'node-learned', 'node-available', 'node-locked', 'apex-unlocked');
      const st = nodeStatus(id);
      el.classList.add(st);
      if (st === 'unlocked') {
        el.classList.add('node-learned');
        if (id.endsWith('-apex') || id.includes('-apex')) el.classList.add('apex-unlocked');
      } else if (st === 'available') el.classList.add('node-available');
      else el.classList.add('node-locked');
    }

    const apexState = ConstellationEngine.getApexProgressState(classId);
    const apexUnlockedNode = ConstellationEngine.isNodeUnlocked(data.apex.id);

    const apexEl = document.getElementById('node-apex');
    if (apexEl) {
      apexEl.className = centerStarClass(apexState, apexUnlockedNode);
      apexEl.classList.toggle('selected', selectedNodeId === data.apex.id);
    }

    const apexCard = document.querySelector('.apex-progress-card');
    if (apexCard) {
      apexCard.className = apexProgressCardClass(apexState);
    }

    const apexFill = document.querySelector('.apex-progress-fill');
    const apexText = document.querySelector('.apex-progress-text');
    const apexStatusEl = document.querySelector('.apex-progress-status');
    const prog = ConstellationEngine.getUnlockedNonApexCount(classId);
    const total = ConstellationEngine.getNonApexNodeTotal(classId);
    const keystones = ConstellationEngine.getUnlockedKeystoneCount(classId);
    const keystonesTotal = ConstellationEngine.getKeystoneTotal(classId);
    if (apexFill) apexFill.style.width = `${total > 0 ? Math.min(100, (prog / total) * 100) : 0}%`;
    if (apexText) {
      apexText.textContent = `${prog} / ${total} Nœuds · ${keystones} / ${keystonesTotal} Passifs`;
    }
    if (apexStatusEl) apexStatusEl.textContent = apexStatusLabel(apexState);

    const svg = document.getElementById('constellation-svg');
    if (svg) drawOrbits(svg, classId, data.themeColor);

    if (selectedNodeId) {
      const node = getNodeById(selectedNodeId);
      if (node) renderDetailPanel(node, classId);
    }
  },

  playBranchEndPassiveUnlockAnimation(nodeId: string, onComplete: () => void): void {
    const node = getNodeById(nodeId);
    if (!node || !node.keystone || node.branch === 'apex') {
      onComplete();
      return;
    }

    const classId = (STATE.class || 'warrior') as ClassId;
    const branchId = node.branch;

    // Bloquer les interactions utilisateur pendant la durée de la séquence d'animation
    window.isConstellationAnimating = true;

    // Sélectionner les éléments du DOM de la branche complète
    const nodeEls = Array.from({ length: 10 }, (_, idx) =>
      document.getElementById(`node-${classId}-${branchId}-${idx + 1}`)
    ).filter(Boolean) as HTMLElement[];

    const lineEls = document.querySelectorAll(`.branch-line-${branchId}`) as NodeListOf<SVGLineElement>;
    const culminationLine = document.querySelector(`.culmination-link-${branchId}`) as SVGLineElement | null;

    // 1. La branche complétée s'illumine.
    nodeEls.forEach((el) => el.classList.add('branch-light-up'));
    lineEls.forEach((el) => el.classList.add('branch-line-highlight'));

    // 2. Une impulsion voyage à travers toute la branche.
    nodeEls.forEach((el, index) => {
      setTimeout(() => {
        el.classList.add('pulse-active');
        setTimeout(() => el.classList.remove('pulse-active'), 500);
      }, index * 80);
    });

    // 3. Le passif de fin de branche émet un fort éclat.
    setTimeout(() => {
      const passiveEl = document.getElementById(`node-${nodeId}`);
      if (passiveEl) {
        passiveEl.classList.add('passive-strong-glow');
      }
    }, 800);

    // 4. La connexion vers l'Apex s'illumine brièvement.
    setTimeout(() => {
      if (culminationLine) {
        culminationLine.classList.add('illuminate-pulse');
      }
    }, 1000);

    // 5. La carte de passif se met en surbrillance automatiquement.
    // 6. Les bonus de stats s'animent en séquence.
    setTimeout(() => {
      selectedNodeId = nodeId;
      renderDetailPanel(node, classId);

      const card = document.querySelector('.detail-passive-effect-card');
      if (card) {
        card.classList.add('card-highlight-active');
      }

      const pills = document.querySelectorAll('.detail-section-stat-bonus .effect-pill') as NodeListOf<HTMLElement>;
      pills.forEach((pill, idx) => {
        pill.classList.add('pill-hidden');
        setTimeout(() => {
          pill.classList.remove('pill-hidden');
          pill.classList.add('pill-pop');
        }, idx * 250);
      });
    }, 1100);

    // 7. Le passif se stabilise dans son état débloqué.
    setTimeout(() => {
      nodeEls.forEach((el) => el.classList.remove('branch-light-up'));
      lineEls.forEach((el) => el.classList.remove('branch-line-highlight'));
      if (culminationLine) {
        culminationLine.classList.remove('illuminate-pulse');
      }
      const passiveEl = document.getElementById(`node-${nodeId}`);
      if (passiveEl) {
        passiveEl.classList.remove('passive-strong-glow');
      }

      window.isConstellationAnimating = false;
      onComplete();
    }, 2500);
  },

  playApexUnlockAnimation(nodeId: string, onComplete: () => void): void {
    const node = getNodeById(nodeId);
    if (!node || node.branch !== 'apex') {
      onComplete();
      return;
    }

    const classId = (STATE.class || 'warrior') as ClassId;

    // 1. Bloquer les interactions utilisateur pendant la durée de la séquence d'animation
    window.isConstellationAnimating = true;

    // Smoothly pan and zoom to the center (0, 0, 1.0) before starting the ignition sequences
    const inner = document.getElementById('constellation-inner');
    if (inner) {
      inner.style.transition = 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
    }
    panX = 0;
    panY = 0;
    zoomScale = 1.0;
    updateViewportTransform();

    setTimeout(() => {
      // Clean up transition so subsequent user manual dragging is not laggy
      if (inner) {
        inner.style.transition = '';
      }

      // 2. Récupérer les éléments
      const apexEl = document.getElementById('node-apex');
      const svg = document.getElementById('constellation-svg');
      const nodes = document.querySelectorAll('.tree-node') as NodeListOf<HTMLElement>;
      const lines = document.querySelectorAll('.branch-line, .culmination-link') as NodeListOf<SVGLineElement>;
      
      // Créer une onde de choc sur le viewport
      const viewport = document.querySelector('.constellation-canvas');
      const shockwave = document.createElement('div');
      shockwave.className = 'apex-shockwave-pulse';
      if (viewport) {
        viewport.appendChild(shockwave);
      }

      // Effet sonore (levelup x2 pour un effet plus lourd)
      if (AudioSys.sfx?.levelup) {
        AudioSys.sfx.levelup();
        setTimeout(() => {
          if (AudioSys.sfx?.levelup) AudioSys.sfx.levelup();
        }, 520);
      }

      // Ajouter l'état d'éveil d'Apex au conteneur principal
      if (viewport) viewport.classList.add('apex-awakening-active');

      // 3. Animation séquentielle:
      // Étape 1 : Le cœur de l'Apex se met à tourner et briller de mille feux (couleurs arc-en-ciel)
      if (apexEl) {
        apexEl.className = 'center-star apex-multicolor apex-unlocked apex-awakening-node-core';
      }

      // Étape 2 : Propagation radiale vers toutes les branches. Toutes les branches s'allument à tour de rôle en vagues depuis le centre vers l'extérieur (ou de l'extérieur vers le centre).
      // Faisons une vague depuis l'extérieur vers le centre (l'Apex absorbe toute l'énergie de la constellation !).
      setTimeout(() => {
        lines.forEach((line, index) => {
          line.style.setProperty('--apex-line-delay', `${Math.min(index * 10, 280)}ms`);
          line.classList.add('apex-awakening-line');
        });
      }, 180);

      for (let tier = 1; tier <= 10; tier++) {
        setTimeout(() => {
          nodes.forEach(el => {
            const badge = el.querySelector('.node-tier-badge');
            if (badge && badge.textContent === String(tier)) {
              el.classList.add('apex-awakening-node');
              el.classList.add('pulse-active');
              setTimeout(() => el.classList.remove('pulse-active'), 920);
            }
          });
        }, (10 - tier) * 115);
      }

      // Étape 3 : Libération d'énergie finale (shockwave s'étend, l'Apex explose de lumière)
      setTimeout(() => {
        shockwave.classList.add('trigger');
        if (apexEl) {
          apexEl.classList.add('apex-unlock-explosion');
        }
        
        // Flash de l'écran en blanc/arc-en-ciel
        const flash = document.createElement('div');
        flash.className = 'apex-screen-flash';
        if (viewport) viewport.appendChild(flash);
        
        setTimeout(() => {
          if (flash) flash.remove();
        }, 1100);
        
      }, 1700);

      // Étape 4 : Mise en avant du panel de détails et stabilisation
      setTimeout(() => {
        selectedNodeId = nodeId;
        renderDetailPanel(node, classId);

        const card = document.querySelector('.detail-section-apex-effect');
        if (card) {
          card.classList.add('apex-card-awoken');
        }
      }, 2300);

      // Étape 5 : Fin de l'animation, nettoyage et onComplete
      setTimeout(() => {
        if (viewport) viewport.classList.remove('apex-awakening-active');
        if (apexEl) {
          apexEl.className = 'center-star apex-multicolor apex-unlocked';
        }
        nodes.forEach(el => el.classList.remove('apex-awakening-node'));
        lines.forEach(el => {
          el.classList.remove('apex-awakening-line');
          el.style.removeProperty('--apex-line-delay');
        });
        if (shockwave) shockwave.remove();

        window.isConstellationAnimating = false;
        onComplete();
      }, 5200);

    }, 800);
  }
};
