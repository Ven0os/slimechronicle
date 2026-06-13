/** Palette unifiée des stats — source de vérité pour pills, chips et badges. */

export const STAT_COLORS = {
  atk: { base: '#e74c3c', text: '#ff8a7a', rgb: '231, 76, 60' },
  hp: { base: '#2ecc71', text: '#7ddea0', rgb: '46, 204, 113' },
  defense: { base: '#070FA6', text: '#6e76ef', rgb: '7, 15, 166' },
  speed: { base: '#3498db', text: '#7ec8f0', rgb: '52, 152, 219' },
  critChance: { base: '#FFD700', text: '#FFE566', rgb: '255, 215, 0' },
  critDamage: { base: '#FF4D4D', text: '#FF8080', rgb: '255, 77, 77' },
  cooldown: { base: '#9b59b6', text: '#c9a0dc', rgb: '155, 89, 182' },
  attackSpeed: { base: '#e67e22', text: '#f0b27a', rgb: '230, 126, 34' },
  lifesteal: { base: '#c0392b', text: '#e88a7a', rgb: '192, 57, 43' },
} as const;

export type StatColorKey = keyof typeof STAT_COLORS;

/** Classe CSS pill constellation / effet nœud. */
export function getEffectPillClass(statKey: string): string {
  const map: Record<string, string> = {
    atk: 'pill-atk',
    maxHpPct: 'pill-hp',
    maxHpFlat: 'pill-hp',
    regen: 'pill-hp',
    def: 'pill-def',
    defense: 'pill-def',
    speed: 'pill-spd',
    speedPct: 'pill-spd',
    crit: 'pill-crit-chance',
    critDmg: 'pill-crit-dmg',
    attackSpeedMod: 'pill-as',
    lifesteal: 'pill-ls',
    xpMod: 'pill-xp',
  };
  return map[statKey] || 'pill-magic';
}

export function formatCritChanceLabel(value: number): string {
  return `+${Math.round(value * 100)}% Crit Chance`;
}

export function formatCritDamageLabel(value: number): string {
  return `+${Math.round(value * 100)}% Crit Damage`;
}

/** Couleur inline pour tooltips / fragments (texte lisible sur fond sombre). */
export function getStatTextColor(statKey: StatColorKey | 'def' | 'crit' | 'critDmg'): string {
  if (statKey === 'def') return STAT_COLORS.defense.text;
  if (statKey === 'crit') return STAT_COLORS.critChance.text;
  if (statKey === 'critDmg') return STAT_COLORS.critDamage.text;
  return STAT_COLORS[statKey]?.text ?? '#ffffff';
}

export function formatInlineStat(value: string, statKey: StatColorKey | 'def' | 'crit' | 'critDmg'): string {
  const color = getStatTextColor(statKey);
  return `<span style="color:${color}; font-weight:bold;">${value}</span>`;
}
