// @ts-nocheck
import { Globals } from '@/core/globals';
import { ConvergenceEffects } from '@/systems/convergenceEffects';

let prevCount = 0;
let pulseUntil = 0;
let pulseKind: 'gain' | 'loss' | 'full' | 'expire' | '' = '';

type LensLike = { timer: number };

export function pulseChronoLensUI(kind: 'gain' | 'loss' | 'full' | 'expire') {
  pulseKind = kind;
  pulseUntil = performance.now() + 450;
}

export function updateChronoLensUI(
  lenses: LensLike[] | null | undefined,
  isLocal: boolean,
): void {
  const root = document.getElementById('chrono-lens-stacks');
  const label = document.getElementById('chrono-lens-label');
  const orbs = document.getElementById('chrono-lens-orbs');
  const hint = document.getElementById('chrono-lens-hint');
  if (!root || !orbs) return;

  if (!isLocal || Globals.player?.className !== 'chronoregulator' || !ConvergenceEffects.hasRefinedPrisms()) {
    root.style.display = 'none';
    prevCount = 0;
    return;
  }

  const list = lenses || [];
  const count = list.length;
  const capped = true;
  const max = ConvergenceEffects.getMaxRefinedPrisms();
  const baseDuration = ConvergenceEffects.getRefinedLensFullDuration();
  const extension = ConvergenceEffects.getLensApexExtension();

  if (count > prevCount) {
    pulseChronoLensUI(capped && count >= (max || 3) ? 'full' : 'gain');
  } else if (count < prevCount && prevCount > 0) {
    pulseChronoLensUI('expire');
  }
  prevCount = count;

  root.style.display = 'flex';
  root.classList.toggle('chrono-lens-capped', capped);
  root.classList.toggle('chrono-lens-full', capped && max != null && count >= max);

  const now = performance.now();
  if (pulseUntil > now && pulseKind) {
    root.classList.add(`chrono-lens-pulse-${pulseKind}`);
  } else {
    root.classList.remove(
      'chrono-lens-pulse-gain',
      'chrono-lens-pulse-loss',
      'chrono-lens-pulse-full',
      'chrono-lens-pulse-expire',
    );
    pulseKind = '';
  }

  if (label) {
    label.textContent = `Prismes ${count}/${max}`;
  }

  if (hint) {
    if (count >= max) {
      hint.textContent = 'Prismes au maximum — le plus ancien est remplacé';
    } else if (count > 0) {
      const minTimer = Math.min(...list.map((l) => l.timer));
      hint.textContent = `5s+${extension}s — expire dans ${minTimer.toFixed(1)}s (+${extension}s par nouveau prisme)`;
    } else {
      hint.textContent = `Jusqu'à ${max} prismes · 5s+${extension}s chacun · +${extension}s aux actifs`;
    }
  }

  orbs.innerHTML = '';

  for (let i = 0; i < max; i++) {
    const orb = document.createElement('div');
    orb.className = 'chrono-lens-orb';
    const lens = list[i];
    if (lens) {
      orb.classList.add('chrono-lens-orb-active');
      const maxT = lens.maxTimer || baseDuration;
      const pct = Math.max(0, Math.min(1, lens.timer / maxT));
      orb.style.setProperty('--lens-fill', `${pct * 100}%`);
      orb.title = `Prisme actif — ${lens.timer.toFixed(1)}s`;
    } else {
      orb.classList.add('chrono-lens-orb-empty');
      orb.title = 'Emplacement libre';
    }
    orbs.appendChild(orb);
  }
}
