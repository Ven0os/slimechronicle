// @ts-nocheck
import { Globals } from '@/core/globals';
import { CHRONO_FRACTURE } from './constants';
import {
  getFractureBarFillPct,
  getFractureDisplayValue,
  getMaxFracture,
  isChronoFractureApexActive,
} from './fractureHelpers';

export function updateChronoFractureUI(
  gauge: number,
  silence: number,
  isLocal: boolean,
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

  fill.style.width = `${barFillPct}%`;
  root.classList.toggle('chrono-fracture-apex', apexActive);
  root.classList.toggle('chrono-fracture-danger', fractureValue >= CHRONO_FRACTURE.ruptureMin);
  root.classList.toggle('chrono-fracture-critical', fractureValue >= 95);

  if (label) {
    if (silence > 0) {
      label.textContent = `Silence ${silence.toFixed(1)}s`;
    } else if (apexActive) {
      label.textContent = `Fracture ${fractureValue}% / ${cap}%`;
    } else {
      label.textContent = `Fracture ${fractureValue}%`;
    }
  }

  if (hint) {
    if (silence > 0) {
      hint.textContent = 'Rayon indisponible';
    } else if (fractureValue >= CHRONO_FRACTURE.ruptureMin && fractureValue <= CHRONO_FRACTURE.ruptureMax) {
      hint.textContent = 'Relâchez : explosion de rupture';
    } else if (apexActive && fractureValue >= CHRONO_FRACTURE.max && fractureValue < cap) {
      hint.textContent = `Surcharge Apex — jusqu'à ${cap}% (+0,33 % dmg / %)`;
    } else if (fractureValue >= 70) {
      hint.textContent = 'Surchauffe imminente';
    } else {
      hint.textContent = 'Maintenez clic pour canaliser';
    }
  }
}
