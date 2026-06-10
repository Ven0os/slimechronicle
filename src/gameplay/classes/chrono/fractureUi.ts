// @ts-nocheck
import { CHRONO_FRACTURE } from './constants';

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

  if (!isLocal) {
    root.style.display = 'none';
    return;
  }

  root.style.display = 'flex';
  const pct = Math.min(100, gauge);
  fill.style.width = `${pct}%`;
  root.classList.toggle('chrono-fracture-danger', pct >= CHRONO_FRACTURE.ruptureMin);
  root.classList.toggle('chrono-fracture-critical', pct >= 95);

  if (label) {
    if (silence > 0) {
      label.textContent = `Silence ${silence.toFixed(1)}s`;
    } else {
      label.textContent = `Fracture ${Math.floor(pct)}%`;
    }
  }

  if (hint) {
    if (silence > 0) {
      hint.textContent = 'Rayon indisponible';
    } else if (pct >= CHRONO_FRACTURE.ruptureMin && pct <= CHRONO_FRACTURE.ruptureMax) {
      hint.textContent = 'Relâchez : explosion de rupture';
    } else if (pct >= 70) {
      hint.textContent = 'Surchauffe imminente';
    } else {
      hint.textContent = 'Maintenez clic pour canaliser';
    }
  }
}
