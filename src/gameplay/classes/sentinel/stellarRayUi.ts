// @ts-nocheck
import { Globals } from '@/core/globals';
import { Input } from '@/core/input';
import {
  formatStellarAmplificationPct,
  getStellarChargeBarFillPct,
  getStellarChargeVisualTier,
  hasStellarOvercharge,
  hasStellarRangeBonus,
} from './stellarRayCharge';

export interface StellarRayChargeUiState {
  amplification: number;
  isCharging: boolean;
  hasPassive: boolean;
  isLocal: boolean;
}

export function shouldShowStellarRayChargeHud(state: StellarRayChargeUiState): boolean {
  return !!(
    state.isLocal
    && Globals.player?.className === 'sentinel'
    && state.hasPassive
    && state.isCharging
    && Input.keys['Space']
  );
}

export function hideStellarRayChargeUI(): void {
  const root = document.getElementById('stellar-ray-charge');
  if (root) root.style.display = 'none';
}

export function updateStellarRayChargeUI(state: StellarRayChargeUiState): void {
  const root = document.getElementById('stellar-ray-charge');
  const fill = document.getElementById('stellar-ray-charge-fill');
  const valueEl = document.getElementById('stellar-ray-charge-value');
  const bonusEl = document.getElementById('stellar-ray-charge-bonus');
  const hintEl = document.getElementById('stellar-ray-charge-hint');
  if (!root || !fill) return;

  if (!shouldShowStellarRayChargeHud(state)) {
    root.style.display = 'none';
    return;
  }

  root.style.display = 'flex';

  const amp = state.amplification;
  const tier = getStellarChargeVisualTier(amp);
  const atMax = hasStellarRangeBonus(amp);

  fill.style.width = `${getStellarChargeBarFillPct(amp, true)}%`;

  root.classList.remove(
    'stellar-ray-normal',
    'stellar-ray-enhanced',
    'stellar-ray-high',
    'stellar-ray-maximum',
    'stellar-ray-charging',
  );
  root.classList.add(`stellar-ray-${tier}`, 'stellar-ray-charging');

  if (valueEl) {
    valueEl.textContent = formatStellarAmplificationPct(amp);
  }

  if (bonusEl) {
    if (atMax) {
      bonusEl.textContent = '• +20% Portée';
      bonusEl.style.display = 'inline';
    } else {
      bonusEl.textContent = '';
      bonusEl.style.display = 'none';
    }
  }

  if (hintEl) {
    hintEl.textContent = atMax ? 'Charge maximale — relâchez Espace' : 'Relâchez Espace pour tirer';
  }
}
