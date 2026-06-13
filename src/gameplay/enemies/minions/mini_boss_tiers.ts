// @ts-nocheck
/** Définitions et agrégation des tiers Mini-Boss. */

export type MiniBossTierId =
  | 'champion'
  | 'chevalier'
  | 'executeur'
  | 'juggernaut'
  | 'predator'
  | 'arcaniste'
  | 'colossus'
  | 'berserker'
  | 'vampire'
  | 'tempest'
  | 'titan'
  | 'sentinelle'
  | 'abyssal'
  | 'gardien'
  | 'gladiateur'
  | 'assassin'
  | 'devastateur'
  | 'occulte'
  | 'ancien'
  | 'eternel'
  | 'maitre_armes';

export type MiniBossTierDef = {
  id: MiniBossTierId;
  label: string;
  hpBonus?: number;
  overshieldBonus?: number;
  speedBonus?: number;
  damageBonus?: number;
  defenseBonus?: number;
  critChance?: number;
  critDmgBonus?: number;
  attackSpeedBonus?: number;
  lifeSteal?: number;
  knockbackResist?: number;
  ccResist?: number;
  sizeBonus?: number;
  regenPerSec?: number;
  overshieldPulse?: number;
  overshieldPulseInterval?: number;
  gardienBuff?: number;
  gardienInterval?: number;
  lowHpDmgScale?: number;
  smallHitThreshold?: number;
  smallHitReduction?: number;
  executeThreshold?: number;
  executeBonus?: number;
  rangedReduction?: number;
  pursuitBonus?: number;
  abilityDamageBonus?: number;
  effectDurationBonus?: number;
  stunDurationBonus?: number;
  healRecvBonus?: number;
  corruptionOnHit?: number;
  accuracyBonus?: number;
};

export type MiniBossAggregatedStats = {
  tierCount: number;
  hpTierMult: number;
  rewardMult: number;
  hpBonus: number;
  overshieldBonus: number;
  speedMult: number;
  damageMult: number;
  defenseReduction: number;
  /** Points de Défense (réduction via formule globale). */
  defense: number;
  critChance: number;
  critDmgMult: number;
  attackSpeedMult: number;
  lifeSteal: number;
  knockbackResist: number;
  ccResist: number;
  sizeMult: number;
  regenPerSec: number;
  overshieldPulse: number;
  overshieldPulseInterval: number;
  gardienBuff: number;
  gardienInterval: number;
  lowHpDmgScale: number;
  smallHitThreshold: number;
  smallHitReduction: number;
  executeThreshold: number;
  executeBonus: number;
  rangedReduction: number;
  pursuitMult: number;
  abilityDamageMult: number;
  effectDurationMult: number;
  stunDurationMult: number;
  healRecvMult: number;
  corruptionOnHit: number;
  accuracyBonus: number;
};

export const TIER_HP_PER_STACK = 0.1;
export const TIER_REWARD_PER_STACK = 0.25;

export const MINI_BOSS_TIER_DEFS: Record<MiniBossTierId, MiniBossTierDef> = {
  champion: { id: 'champion', label: 'Champion', speedBonus: 0.08, lifeSteal: 0.08, hpBonus: 0.05 },
  chevalier: { id: 'chevalier', label: 'Chevalier', defenseBonus: 0.12, overshieldBonus: 0.1, ccResist: 0.25 },
  executeur: { id: 'executeur', label: 'Exécuteur', critChance: 0.12, critDmgBonus: 0.25, damageBonus: 0.15 },
  juggernaut: { id: 'juggernaut', label: 'Juggernaut', hpBonus: 0.25, overshieldBonus: 0.25, knockbackResist: 0.6 },
  predator: { id: 'predator', label: 'Prédateur', attackSpeedBonus: 0.15, speedBonus: 0.12, pursuitBonus: 0.18 },
  arcaniste: { id: 'arcaniste', label: 'Arcaniste', abilityDamageBonus: 0.2, attackSpeedBonus: 0.08, effectDurationBonus: 0.15 },
  colossus: { id: 'colossus', label: 'Colossus', hpBonus: 0.35, defenseBonus: 0.25, smallHitThreshold: 18, smallHitReduction: 0.45 },
  berserker: { id: 'berserker', label: 'Berserker', lowHpDmgScale: 0.5, attackSpeedBonus: 0.1, ccResist: 0.15 },
  vampire: { id: 'vampire', label: 'Vampire', lifeSteal: 0.18, critChance: 0.08, healRecvBonus: 0.2 },
  tempest: { id: 'tempest', label: 'Tempête', speedBonus: 0.22, attackSpeedBonus: 0.18 },
  titan: { id: 'titan', label: 'Titan', sizeBonus: 0.15, hpBonus: 0.15, knockbackResist: 0.35 },
  sentinelle: {
    id: 'sentinelle',
    label: 'Sentinelle',
    overshieldPulse: 0.08,
    overshieldPulseInterval: 8,
    defenseBonus: 0.1,
    rangedReduction: 0.2,
  },
  abyssal: { id: 'abyssal', label: 'Abyssal', damageBonus: 0.18, hpBonus: 0.12, corruptionOnHit: 1 },
  gardien: {
    id: 'gardien',
    label: 'Gardien',
    overshieldBonus: 0.15,
    defenseBonus: 0.15,
    gardienBuff: 0.12,
    gardienInterval: 10,
  },
  gladiateur: { id: 'gladiateur', label: 'Gladiateur', critChance: 0.1, damageBonus: 0.12, attackSpeedBonus: 0.1 },
  assassin: { id: 'assassin', label: 'Assassin', critChance: 0.15, speedBonus: 0.1, executeThreshold: 0.35, executeBonus: 0.25 },
  devastateur: { id: 'devastateur', label: 'Dévastateur', damageBonus: 0.2, attackSpeedBonus: -0.1, stunDurationBonus: 0.35 },
  occulte: { id: 'occulte', label: 'Occulte', abilityDamageBonus: 0.15, attackSpeedBonus: 0.05, effectDurationBonus: 0.2, stunDurationBonus: 0.12 },
  ancien: { id: 'ancien', label: 'Ancien', hpBonus: 0.2, defenseBonus: 0.18, overshieldBonus: 0.12 },
  eternel: { id: 'eternel', label: 'Éternel', regenPerSec: 1.5, hpBonus: 0.15, healRecvBonus: 0.15 },
  maitre_armes: { id: 'maitre_armes', label: "Maître d'armes", critChance: 0.12, attackSpeedBonus: 0.12, damageBonus: 0.08, accuracyBonus: 0.1 },
};

export const ALL_MINI_BOSS_TIER_IDS = Object.keys(MINI_BOSS_TIER_DEFS) as MiniBossTierId[];

export const VARIANT_TIER_POOLS: Record<string, MiniBossTierId[]> = {
  verdant_stalker: ['predator', 'assassin', 'champion', 'tempest'],
  iron_warden: ['chevalier', 'gardien', 'sentinelle', 'titan'],
  arcane_herald: ['arcaniste', 'occulte', 'tempest', 'maitre_armes'],
  corrupt_warden: ['executeur', 'abyssal', 'vampire', 'devastateur'],
};

const TIER_SEP = ' • ';

export function getMiniBossTierLabels(tiers: MiniBossTierId[]): string[] {
  return dedupeMiniBossTiers(tiers).map((id) => MINI_BOSS_TIER_DEFS[id].label);
}

export function normalizeMiniBossTiers(raw: unknown): MiniBossTierId[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[|,;+•\u2022\s]+/);
  const out: MiniBossTierId[] = [];
  for (const item of list) {
    const key = String(item).trim().toLowerCase().replace(/é/g, 'e').replace(/è/g, 'e');
    const map: Record<string, MiniBossTierId> = {
      champion: 'champion',
      chevalier: 'chevalier',
      executeur: 'executeur',
      executer: 'executeur',
      juggernaut: 'juggernaut',
      predator: 'predator',
      predateur: 'predator',
      arcaniste: 'arcaniste',
      colossus: 'colossus',
      berserker: 'berserker',
      vampire: 'vampire',
      tempest: 'tempest',
      tempete: 'tempest',
      titan: 'titan',
      sentinelle: 'sentinelle',
      abyssal: 'abyssal',
      gardien: 'gardien',
      gladiateur: 'gladiateur',
      assassin: 'assassin',
      devastateur: 'devastateur',
      occulte: 'occulte',
      ancien: 'ancien',
      eternel: 'eternel',
      maitre_armes: 'maitre_armes',
      'maitre darmes': 'maitre_armes',
    };
    const id = map[key] || (MINI_BOSS_TIER_DEFS[key as MiniBossTierId] ? (key as MiniBossTierId) : null);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function dedupeMiniBossTiers(tiers: MiniBossTierId[]): MiniBossTierId[] {
  const out: MiniBossTierId[] = [];
  for (const t of tiers) {
    if (MINI_BOSS_TIER_DEFS[t] && !out.includes(t)) out.push(t);
  }
  return out;
}

export function rollMiniBossTiers(miniId: string, forcedCount?: number): MiniBossTierId[] {
  const pool = VARIANT_TIER_POOLS[miniId] || ALL_MINI_BOSS_TIER_IDS;
  const count = forcedCount ?? (Math.random() < 0.38 ? 2 : 1);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return dedupeMiniBossTiers(shuffled.slice(0, Math.max(1, count)));
}

export function aggregateMiniBossTierStats(tiers: MiniBossTierId[]): MiniBossAggregatedStats {
  const unique = dedupeMiniBossTiers(tiers);
  const stats: MiniBossAggregatedStats = {
    tierCount: unique.length,
    hpTierMult: 1 + unique.length * TIER_HP_PER_STACK,
    rewardMult: 1 + unique.length * TIER_REWARD_PER_STACK,
    hpBonus: 0,
    overshieldBonus: 0,
    speedMult: 1,
    damageMult: 1,
    defenseReduction: 0,
    defense: 0,
    critChance: 0,
    critDmgMult: 1,
    attackSpeedMult: 1,
    lifeSteal: 0,
    knockbackResist: 0,
    ccResist: 0,
    sizeMult: 1,
    regenPerSec: 0,
    overshieldPulse: 0,
    overshieldPulseInterval: 0,
    gardienBuff: 0,
    gardienInterval: 0,
    lowHpDmgScale: 0,
    smallHitThreshold: 0,
    smallHitReduction: 0,
    executeThreshold: 0,
    executeBonus: 0,
    rangedReduction: 0,
    pursuitMult: 1,
    abilityDamageMult: 1,
    effectDurationMult: 1,
    stunDurationMult: 1,
    healRecvMult: 1,
    corruptionOnHit: 0,
    accuracyBonus: 0,
  };

  for (const id of unique) {
    const t = MINI_BOSS_TIER_DEFS[id];
    stats.hpBonus += t.hpBonus || 0;
    stats.overshieldBonus += t.overshieldBonus || 0;
    stats.speedMult += t.speedBonus || 0;
    stats.damageMult += t.damageBonus || 0;
    stats.defenseReduction += t.defenseBonus || 0;
    if (t.defenseBonus) stats.defense += Math.round(t.defenseBonus * 100);
    stats.critChance += t.critChance || 0;
    stats.critDmgMult += t.critDmgBonus || 0;
    stats.attackSpeedMult += t.attackSpeedBonus || 0;
    stats.lifeSteal += t.lifeSteal || 0;
    stats.knockbackResist = Math.min(0.9, stats.knockbackResist + (t.knockbackResist || 0));
    stats.ccResist = Math.min(0.85, stats.ccResist + (t.ccResist || 0));
    stats.sizeMult += t.sizeBonus || 0;
    stats.regenPerSec += t.regenPerSec || 0;
    stats.overshieldPulse += t.overshieldPulse || 0;
    stats.overshieldPulseInterval = Math.max(stats.overshieldPulseInterval, t.overshieldPulseInterval || 0);
    stats.gardienBuff = Math.max(stats.gardienBuff, t.gardienBuff || 0);
    stats.gardienInterval = Math.max(stats.gardienInterval, t.gardienInterval || 0);
    stats.lowHpDmgScale = Math.max(stats.lowHpDmgScale, t.lowHpDmgScale || 0);
    if (t.smallHitThreshold) {
      stats.smallHitThreshold = Math.max(stats.smallHitThreshold, t.smallHitThreshold);
      stats.smallHitReduction = Math.max(stats.smallHitReduction, t.smallHitReduction || 0);
    }
    stats.executeThreshold = Math.max(stats.executeThreshold, t.executeThreshold || 0);
    stats.executeBonus = Math.max(stats.executeBonus, t.executeBonus || 0);
    stats.rangedReduction = Math.max(stats.rangedReduction, t.rangedReduction || 0);
    stats.pursuitMult += t.pursuitBonus || 0;
    stats.abilityDamageMult += t.abilityDamageBonus || 0;
    stats.effectDurationMult += t.effectDurationBonus || 0;
    stats.stunDurationMult += t.stunDurationBonus || 0;
    stats.healRecvMult += t.healRecvBonus || 0;
    stats.corruptionOnHit = Math.max(stats.corruptionOnHit, t.corruptionOnHit || 0);
    stats.accuracyBonus += t.accuracyBonus || 0;
  }

  stats.defenseReduction = Math.min(0.65, stats.defenseReduction);
  stats.defense = Math.max(stats.defense, Math.round(stats.defenseReduction * 100));
  stats.critChance = Math.min(0.55, stats.critChance);
  return stats;
}

export function formatMiniBossTierTitles(tiers: MiniBossTierId[]): string {
  return getMiniBossTierLabels(tiers).join(TIER_SEP);
}

type TierMeasureFn = (text: string, fontSize: number) => number;

/** Répartit tous les labels sur 1–2 lignes sans en omettre (ellipsis en dernier recours). */
export function layoutMiniBossTierLines(
  labels: string[],
  maxWidth: number,
  maxLines = 2,
  measure?: TierMeasureFn,
): { lines: string[]; fontSize: number } {
  if (labels.length === 0) return { lines: [''], fontSize: 10 };

  const guessWidth: TierMeasureFn = (text, fs) => text.length * fs * 0.52;
  const m = measure || guessWidth;
  const minFs = 7;
  const maxFs = 10;

  for (let fs = maxFs; fs >= minFs; fs--) {
    const joined = labels.join(TIER_SEP);
    if (m(joined, fs) <= maxWidth) return { lines: [joined], fontSize: fs };

    if (maxLines >= 2) {
      for (let split = 1; split < labels.length; split++) {
        const line1 = labels.slice(0, split).join(TIER_SEP);
        const line2 = labels.slice(split).join(TIER_SEP);
        if (m(line1, fs) <= maxWidth && m(line2, fs) <= maxWidth) {
          return { lines: [line1, line2], fontSize: fs };
        }
      }
    }
  }

  const fs = minFs;
  const mid = Math.ceil(labels.length / 2);
  let line1 = labels.slice(0, mid).join(TIER_SEP);
  let line2 = labels.slice(mid).join(TIER_SEP);
  if (m(line2, fs) > maxWidth) {
    while (line2.length > 4 && m(`${line2}…`, fs) > maxWidth) line2 = line2.slice(0, -1);
    line2 = `${line2.trimEnd()}…`;
  }
  if (m(line1, fs) > maxWidth) {
    while (line1.length > 4 && m(`${line1}…`, fs) > maxWidth) line1 = line1.slice(0, -1);
    line1 = `${line1.trimEnd()}…`;
  }
  return { lines: [line1, line2], fontSize: fs };
}

/** Lignes UI (1–2 max) pour afficher tous les tiers actifs. */
export function formatMiniBossTierDisplay(
  tiers: MiniBossTierId[],
  maxWidth = 210,
  measure?: TierMeasureFn,
): { lines: string[]; fontSize: number } {
  return layoutMiniBossTierLines(getMiniBossTierLabels(tiers), maxWidth, 2, measure);
}

export type MiniBossTierApplySource = 'local' | 'network';

export function applyMiniBossTierState(
  enemy: {
    miniBossTiers?: MiniBossTierId[];
    miniBossStats?: MiniBossAggregatedStats | null;
    miniBossTierTitles?: string;
    miniBossName?: string;
    defense?: number;
  },
  tiers: MiniBossTierId[],
  source: MiniBossTierApplySource = 'local',
): MiniBossTierId[] {
  const incoming = dedupeMiniBossTiers(tiers);
  const current = dedupeMiniBossTiers(enemy.miniBossTiers || []);

  let final = incoming;
  if (incoming.length === 0 && current.length > 0) {
    final = current;
  } else if (source === 'network' && incoming.length > 0) {
    final = incoming;
  } else if (incoming.length > 0) {
    final = incoming;
  } else {
    final = current;
  }

  enemy.miniBossTiers = final;
  enemy.miniBossStats = aggregateMiniBossTierStats(final);
  enemy.miniBossTierTitles = formatMiniBossTierTitles(final);
  enemy.defense = enemy.miniBossStats.defense;
  return final;
}

/** Journalise le pipeline tiers (spawn → sync → UI). */
export function logMiniBossTierPipeline(
  stage: string,
  enemy: {
    isMiniBoss?: boolean;
    miniBossName?: string;
    miniBossId?: string;
    miniBossTiers?: MiniBossTierId[];
    miniBossStats?: { tierCount?: number };
  },
  extra?: Record<string, unknown>,
): void {
  if (!enemy?.isMiniBoss) return;
  const labels = getMiniBossTierLabels(enemy.miniBossTiers || []);
  const rendered = labels.join(TIER_SEP);
  const applied = labels.join(', ');
  console.log(
    `[MiniBoss:${stage}] Spawned: ${enemy.miniBossName || enemy.miniBossId || '?'}\n` +
      `  Tiers: [${labels.join(', ')}]\n` +
      `  Applied modifiers: ${applied || '(aucun)'}\n` +
      (extra?.replicated != null ? `  Replicated tiers: [${extra.replicated}]\n` : '') +
      `  Rendered tiers: ${rendered || '(vide)'}`,
  );
  if (extra) {
    const { replicated, ...rest } = extra;
    if (Object.keys(rest).length) console.log(`  [${stage} extra]`, rest);
  }
}

export function serializeMiniBossTiers(tiers: MiniBossTierId[]): string {
  return dedupeMiniBossTiers(tiers).join('|');
}

export function parseMiniBossTiers(serialized: string): MiniBossTierId[] {
  return normalizeMiniBossTiers(serialized);
}
