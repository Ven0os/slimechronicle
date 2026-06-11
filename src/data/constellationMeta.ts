import type { ClassId, ConstellationNode, NodeEffects } from './constellations';
import { formatSkillCdLabel, formatSkillModLabel, type AbilityKey, type SkillKey } from './classStatsConfig';
import { getPassiveMeta } from './passiveCatalog';

export interface BranchMeta {
  desc: string;
  icon: string;
  focus: string;
}

export interface ClassMeta {
  lore: string;
  motto: string;
  branches: Record<string, BranchMeta>;
}

export type NodeRewardKind = 'stat' | 'keystone' | 'apex';

export function getNodeRewardKind(node: ConstellationNode): NodeRewardKind {
  if (node.branch === 'apex') return 'apex';
  if (node.keystone) return 'keystone';
  return 'stat';
}

export function hasStatEffects(effects: NodeEffects): boolean {
  const keys: (keyof NodeEffects)[] = [
    'atk', 'maxHpPct', 'maxHpFlat', 'speed', 'speedPct', 'crit', 'critDmg',
    'attackSpeedMod', 'regen', 'lifesteal', 'def', 'xpMod',
  ];
  const hasScalar = keys.some((k) => {
    const v = effects[k];
    return typeof v === 'number' && v !== 0;
  });
  const hasSkillMods = effects.skillMods
    && Object.values(effects.skillMods).some((v) => typeof v === 'number' && v !== 0);
  const hasSkillCdMods = effects.skillCdMods
    && Object.values(effects.skillCdMods).some((v) => typeof v === 'number' && v !== 0);
  return hasScalar || !!hasSkillMods || !!hasSkillCdMods;
}

export const CONSTELLATION_META: Record<ClassId, ClassMeta> = {
  warrior: {
    lore: 'Paliers 1 à 3 : bonus de stats permanents (PV, ATK, sprint, recharge…). Le nœud final de chaque branche débloque un passif unique.',
    motto: 'Tiens la ligne. Frappe le sol.',
    branches: {
      rempart: { desc: 'PV, défense — keystone : mur impénétrable.', icon: 'fa-shield-halved', focus: 'Défense' },
      fureur: { desc: 'ATK et dégâts — keystone : Sang de Titan (DEF runique).', icon: 'fa-fire', focus: 'Offense' },
      cri: { desc: 'Sprint et recharge — keystone : parade réactive.', icon: 'fa-bullhorn', focus: 'Contrôle' },
      seisme: { desc: 'Critiques et burst — keystone : charge sismique.', icon: 'fa-mountain', focus: 'Burst' },
    },
  },
  mage: {
    lore: 'Les premiers nœuds augmentent vos stats magiques. Chaque branche se conclut par un passif qui transforme un sort.',
    motto: 'Le temps est une ressource.',
    branches: {
      flux: { desc: 'ATK et dégâts sorts — keystone : surcharge arcane.', icon: 'fa-wand-magic-sparkles', focus: 'DPS' },
      givre: { desc: 'PV et défense — keystone : stase profonde.', icon: 'fa-snowflake', focus: 'Contrôle' },
      mirage: { desc: 'Sprint et CD sorts — keystone : transfert maîtrisé.', icon: 'fa-ghost', focus: 'Mobilité' },
      prisme: { desc: 'Critiques et XP — keystone : clones persistants.', icon: 'fa-atom', focus: 'Maîtrise' },
    },
  },
  sentinel: {
    lore: 'Investissez dans les stats pour tenir la ligne. Les keystones activent des mécaniques de soin, rayon ou bouclier.',
    motto: 'Éclaire. Soigne. Protège.',
    branches: {
      rayon: { desc: 'ATK et rayon — keystone : faisceau accéléré.', icon: 'fa-sun', focus: 'Burst' },
      sanctuaire: { desc: 'PV et régénération — keystone : soins amplifiés.', icon: 'fa-church', focus: 'Support' },
      aile: { desc: 'Sprint et CD — keystone : hâte solaire.', icon: 'fa-feather', focus: 'Mobilité' },
      egide: { desc: 'Défense et PV — keystone : martyr.', icon: 'fa-shield', focus: 'Défense' },
    },
  },
  blade: {
    lore: 'Les nœuds intermédiaires forgent votre build (crit, sprint, ATK). Les fins de branche débloquent des passifs létaux.',
    motto: 'Danse dans le sang.',
    branches: {
      hemo: { desc: 'Critiques et vol de vie — keystone : saignée.', icon: 'fa-droplet', focus: 'Offense' },
      ombre: { desc: 'Sprint et cadence — keystone : pas du néant.', icon: 'fa-ghost', focus: 'Assassin' },
      cyclone: { desc: 'Dégâts AoE — keystone : maelström.', icon: 'fa-hurricane', focus: 'AoE' },
      survie: { desc: 'PV et regen — keystone : dernier souffle.', icon: 'fa-heart', focus: 'Survie' },
    },
  },
  pacifier: {
    lore: 'Stats de tir et de survie sur les paliers 1-3. Les keystones renforcent bouclier, exécution ou frénésie.',
    motto: 'Le sang paie les dettes.',
    branches: {
      transfusion: { desc: 'PV et regen — keystone : overflow.', icon: 'fa-heart-pulse', focus: 'Survie' },
      jugement: { desc: 'ATK et verdict — keystone : exécution.', icon: 'fa-gavel', focus: 'Offense' },
      frénésie: { desc: 'Sprint et cadence de tir — keystone : adrénaline.', icon: 'fa-gun', focus: 'DPS' },
      rituel: { desc: 'Critiques et XP — keystone : saut vampirique+.', icon: 'fa-crosshairs', focus: 'Maîtrise' },
    },
  },
  eclipse: {
    lore: 'Soleil et Lune : stats puis passifs en bout de branche. L\'Apex fusionne les deux astres.',
    motto: 'Deux astres, une volonté.',
    branches: {
      soleil: { desc: 'ATK et DoT — keystone : corona.', icon: 'fa-sun', focus: 'DoT' },
      lune: { desc: 'Critiques lunaires — keystone : pleine lune.', icon: 'fa-moon', focus: 'Burst' },
      orbite: { desc: 'Sprint et CD — keystone : tissage orbital.', icon: 'fa-yin-yang', focus: 'Synergie' },
      vide: { desc: 'PV et défense — keystone : trou noir.', icon: 'fa-circle-dot', focus: 'Contrôle' },
    },
  },
  chronoregulator: {
    lore: 'Paliers 1-3 : stats du rayon et de la Fracture. Keystones : lentille, rupture, conduction et déphasage.',
    motto: 'Canalise. Converge. Explose.',
    branches: {
      continuum: { desc: 'ATK et rayon — keystone : prisme affiné.', icon: 'fa-wave-square', focus: 'DPS' },
      echo: { desc: 'Dégâts de rupture — keystone : explosion volontaire amplifiée.', icon: 'fa-burst', focus: 'Burst' },
      distorsion: { desc: 'Sprint et CD — keystone : coût Fracture réduit.', icon: 'fa-hourglass-half', focus: 'Mobilité' },
      paradoxe: { desc: 'Critiques et XP — keystone : déphasage renforcé.', icon: 'fa-atom', focus: 'Synergie' },
    },
  },
};

const EFFECT_PILL_DEFS: Array<{
  key: keyof NodeEffects;
  cls: string;
  label: (v: number) => string;
}> = [
  { key: 'atk', cls: 'pill-atk', label: (v) => `+${v} ATK` },
  { key: 'maxHpPct', cls: 'pill-hp', label: (v) => `+${Math.round(v * 100)}% PV max` },
  { key: 'maxHpFlat', cls: 'pill-hp', label: (v) => `+${v} PV max` },
  { key: 'speed', cls: 'pill-spd', label: (v) => `+${v} Sprint` },
  { key: 'speedPct', cls: 'pill-spd', label: (v) => `+${Math.round(v * 100)}% Sprint` },
  { key: 'crit', cls: 'pill-crit', label: (v) => `+${Math.round(v * 100)}% Critique` },
  { key: 'critDmg', cls: 'pill-crit', label: (v) => `+${Math.round(v * 100)}% Dégâts crit.` },
  { key: 'attackSpeedMod', cls: 'pill-as', label: (v) => `${Math.round(v * 100)}% Vitesse d'attaque` },
  { key: 'regen', cls: 'pill-hp', label: (v) => `+${v} PV/s` },
  { key: 'lifesteal', cls: 'pill-ls', label: (v) => `+${Math.round(v * 100)}% Vol de vie` },
  { key: 'def', cls: 'pill-def', label: (v) => `+${v} Défense` },
  { key: 'xpMod', cls: 'pill-xp', label: (v) => `+${Math.round(v * 100)}% XP` },
];

function formatSkillCdModPills(classId: ClassId, skillCdMods: NodeEffects['skillCdMods'], asHtml = false): string {
  if (!skillCdMods) return '';
  const parts: string[] = [];
  for (const [key, val] of Object.entries(skillCdMods)) {
    if (typeof val !== 'number' || val === 0) continue;
    const label = formatSkillCdLabel(classId, key as AbilityKey, val);
    parts.push(asHtml
      ? `<span class="effect-pill pill-cd">${label}</span>`
      : label);
  }
  return parts.join(asHtml ? '' : ' · ');
}

function formatSkillModPills(classId: ClassId, skillMods: NodeEffects['skillMods'], asHtml = false): string {
  if (!skillMods) return '';
  const parts: string[] = [];
  for (const [key, val] of Object.entries(skillMods)) {
    if (typeof val !== 'number' || val === 0) continue;
    const label = formatSkillModLabel(classId, key as SkillKey, val);
    parts.push(asHtml
      ? `<span class="effect-pill pill-magic">${label}</span>`
      : label);
  }
  return parts.join(asHtml ? '' : ' · ');
}

export function formatEffectSummary(
  effects: Record<string, number | string | undefined>,
  classId?: ClassId,
): string {
  const parts: string[] = [];
  for (const def of EFFECT_PILL_DEFS) {
    const val = effects[def.key];
    if (typeof val === 'number' && val !== 0) parts.push(def.label(val));
  }
  if (classId && effects.skillMods && typeof effects.skillMods === 'object') {
    const sm = formatSkillModPills(classId, effects.skillMods as NodeEffects['skillMods'], false);
    if (sm) parts.push(sm);
  }
  if (classId && effects.skillCdMods && typeof effects.skillCdMods === 'object') {
    const cd = formatSkillCdModPills(classId, effects.skillCdMods as NodeEffects['skillCdMods'], false);
    if (cd) parts.push(cd);
  }
  if (effects.passive) {
    const meta = getPassiveMeta(String(effects.passive));
    parts.push(meta ? `Passif : ${meta.name}` : 'Passif spécial');
  }
  return parts.length ? parts.join(' · ') : 'Effet spécial';
}

export function formatEffectPills(effects: NodeEffects, includePassive = true, classId?: ClassId): string {
  const pills: string[] = [];
  for (const def of EFFECT_PILL_DEFS) {
    const val = effects[def.key];
    if (typeof val === 'number' && val !== 0) {
      pills.push(`<span class="effect-pill ${def.cls}">${def.label(val)}</span>`);
    }
  }
  if (classId) {
    pills.push(formatSkillModPills(classId, effects.skillMods, true));
    pills.push(formatSkillCdModPills(classId, effects.skillCdMods, true));
  }
  if (includePassive && effects.passive) {
    const meta = getPassiveMeta(effects.passive);
    pills.push(`<span class="effect-pill pill-passive">${meta ? meta.name : 'Passif spécial'}</span>`);
  }
  return pills.join('');
}

export function getRewardBadgeHtml(kind: NodeRewardKind): string {
  if (kind === 'stat') {
    return '<span class="detail-reward-badge badge-stat">Bonus de stats</span>';
  }
  if (kind === 'keystone') {
    return '<span class="detail-reward-badge badge-passive">Passif de branche</span>';
  }
  return '<span class="detail-reward-badge badge-apex"><span class="badge-apex-text">Apex</span></span>';
}

export function formatSimpleEffect(node: ConstellationNode, classId?: ClassId): string {
  const kind = getNodeRewardKind(node);
  const e = node.effects;
  const cid = classId ?? (node.id.split('-')[0] as ClassId);

  if (kind === 'stat') {
    const bits: string[] = [];
    if (e.atk) bits.push(`+${e.atk} ATK`);
    if (e.maxHpPct) bits.push(`+${Math.round(e.maxHpPct * 100)}% PV max`);
    if (e.maxHpFlat) bits.push(`+${e.maxHpFlat} PV max`);
    if (e.def) bits.push(`+${e.def} défense`);
    if (e.speed) bits.push(`+${e.speed} vitesse sprint`);
    if (e.speedPct) bits.push(`+${Math.round(e.speedPct * 100)}% sprint`);
    if (e.skillMods) {
      const sm = formatSkillModPills(cid, e.skillMods, false);
      if (sm) bits.push(sm);
    }
    if (e.skillCdMods) {
      const cd = formatSkillCdModPills(cid, e.skillCdMods, false);
      if (cd) bits.push(cd);
    }
    if (e.crit) bits.push(`+${Math.round(e.crit * 100)}% critique`);
    if (e.critDmg) bits.push(`+${Math.round(e.critDmg * 100)}% dégâts critiques`);
    if (e.attackSpeedMod) bits.push(`${Math.round(e.attackSpeedMod * 100)}% vitesse d'attaque`);
    if (e.regen) bits.push(`+${e.regen} PV/s`);
    if (e.lifesteal) bits.push(`+${Math.round(e.lifesteal * 100)}% vol de vie`);
    if (e.xpMod) bits.push(`+${Math.round(e.xpMod * 100)}% XP`);
    return bits.length
      ? `Amélioration permanente cumulable : ${bits.join(', ')}.`
      : 'Renforce vos attributs de façon permanente.';
  }

  const parts: string[] = [];
  if (hasStatEffects(e)) {
    parts.push('Inclut aussi un bonus de stats (voir ci-dessous).');
  }
  if (e.passive) {
    const meta = getPassiveMeta(e.passive);
    if (meta) {
      parts.push(`Débloque le passif « ${meta.name} » : ${meta.desc}`);
    } else {
      parts.push('Débloque un passif spécial actif en permanence.');
    }
  }
  return parts.join(' ');
}

function normalizePassiveText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/passif\s*:/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True si la description du nœud couvre déjà le passif (évite le doublon dans le panneau). */
export function isPassiveDescRedundant(nodeDesc: string, passiveDesc: string): boolean {
  const nd = normalizePassiveText(nodeDesc);
  const pd = normalizePassiveText(passiveDesc);
  if (!pd) return true;
  if (!nd) return false;
  if (nd === pd) return true;
  if (nd.includes(pd) || pd.includes(nd)) return true;

  const pdWords = pd.split(' ').filter((w) => w.length > 3);
  if (pdWords.length >= 2) {
    const matched = pdWords.filter((w) => nd.includes(w)).length;
    if (matched / pdWords.length >= 0.75) return true;
  }
  return false;
}
