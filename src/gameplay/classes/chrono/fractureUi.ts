// @ts-nocheck
import { Globals } from '@/core/globals';
import { CHRONO_FRACTURE } from './constants';
import {
  getFractureBarFillPct,
  getFractureDisplayValue,
  getMaxFracture,
  getOverloadImminenceThreshold,
  isChronoFractureApexActive,
  isFractureAtOverheat,
  isOverloadImminenceActive,
} from './fractureHelpers';

export function updateChronoFractureUI(
  gauge: number,
  silence: number,
  isLocal: boolean,
  isDecaying = false,
): void {
  const root = document.getElementById('chrono-fracture');
  const fill = document.getElementById('chrono-fracture-fill');
  const label = document.getElementById('chrono-fracture-label');
  const hint = document.getElementById('chrono-fracture-hint');
  if (!root || !fill) return;

  if (!isLocal || Globals.player?.className !== 'chronoregulator') {
    root.style.display = 'none';
    return;
  }

  root.style.display = 'flex';
  const apexActive = isChronoFractureApexActive();
  const cap = getMaxFracture();
  const fractureValue = getFractureDisplayValue(gauge, cap);
  const barFillPct = getFractureBarFillPct(gauge, cap);
  const imminence = isOverloadImminenceActive(gauge);
  const overheat = isFractureAtOverheat(gauge);

  fill.style.width = `${barFillPct}%`;
  root.classList.toggle('chrono-fracture-apex', apexActive);
  root.classList.toggle('chrono-fracture-danger', imminence || overheat);
  root.classList.toggle('chrono-fracture-critical', overheat);
  root.classList.toggle('chrono-fracture-imminence', imminence && !overheat);
  root.classList.toggle('chrono-fracture-silence', silence > 0);

  if (label) {
    if (silence > 0) {
      label.textContent = `Silence — ${silence.toFixed(1)} s`;
    } else if (overheat) {
      label.textContent = 'Surchauffe';
    } else if (imminence) {
      label.textContent = 'Surcharge imminente';
    } else if (apexActive) {
      label.textContent = `Fracture ${fractureValue}% / ${cap}%`;
    } else {
      label.textContent = `Fracture ${fractureValue}%`;
    }
  }

  if (hint) {
    if (silence > 0) {
      hint.textContent = 'Compétences indisponibles';
    } else if (overheat) {
      hint.textContent = 'Surchauffe critique';
    } else if (imminence) {
      hint.textContent = 'Relâchez pour désurcharger (−10 %)';
    } else if (apexActive && fractureValue >= CHRONO_FRACTURE.max && fractureValue < getOverloadImminenceThreshold(cap)) {
      hint.textContent = `Surcharge Apex — jusqu'à ${cap}% (rayon +0,42 % dmg, +0,05 % taille / %)`;
    } else if (isDecaying) {
      hint.textContent = 'Fracture en décroissance';
    } else {
      hint.textContent = 'Maintenez clic pour canaliser';
    }
  }
}
