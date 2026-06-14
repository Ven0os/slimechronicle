// @ts-nocheck
import { Globals } from '@/core/globals';
import { STATE } from '@/core/config';
import {
  calcLanceChargeRangeBonus,
  formatLanceRangeBonusPct,
  hasEclipseCrown,
  isValidChargedLanceRelease,
  LANCE_CHARGE_MAX_SEC,
  LANCE_CHARGE_MIN_SEC,
} from './eclipseLanceCharge';

export function shouldShowEclipseLanceChargeHud(chargeSec: number, isCharging: boolean): boolean {
  return !!(
    isCharging
    && hasEclipseCrown()
    && isValidChargedLanceRelease(chargeSec)
    && Globals.player?.className === 'eclipse'
    && Globals.player?.isLocalPlayer?.()
    && STATE.mouseDown
  );
}

export function hideEclipseLanceChargeUI(): void {
  const root = document.getElementById('eclipse-lance-charge');
  if (root) root.style.display = 'none';
}

export function updateEclipseLanceChargeUI(chargeSec: number, isCharging: boolean): void {
  const root = document.getElementById('eclipse-lance-charge');
  const fill = document.getElementById('eclipse-lance-charge-fill');
  const valueEl = document.getElementById('eclipse-lance-charge-value');
  const hintEl = document.getElementById('eclipse-lance-charge-hint');
  if (!root || !fill) return;

  if (!shouldShowEclipseLanceChargeHud(chargeSec, isCharging)) {
    root.style.display = 'none';
    return;
  }

  root.style.display = 'flex';

  const rangeBonus = calcLanceChargeRangeBonus(chargeSec);
  const fillSpan = LANCE_CHARGE_MAX_SEC - LANCE_CHARGE_MIN_SEC;
  const fillPct = fillSpan > 0
    ? ((chargeSec - LANCE_CHARGE_MIN_SEC) / fillSpan) * 100
    : 0;
  fill.style.width = `${Math.min(100, Math.max(0, fillPct))}%`;

  if (valueEl) {
    valueEl.textContent = `Portée : +${formatLanceRangeBonusPct(rangeBonus)}`;
  }

  if (hintEl) {
    hintEl.textContent = chargeSec >= LANCE_CHARGE_MAX_SEC
      ? 'Charge maximale — relâchez pour frapper'
      : 'Relâchez pour frapper';
  }
}
