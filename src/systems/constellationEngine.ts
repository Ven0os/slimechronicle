import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import {
  calcSkillBaseDamage,
  createDefaultSkillCdMods,
  createDefaultSkillMods,
  getSkillRatio,
  type AbilityKey,
  type SkillKey,
} from '@/data/classStatsConfig';
import {
  CONSTELLATION_APEX_MIN_NODES,
  getConstellationForClass,
  getNodeById,
  type ClassId,
  type ConstellationNode,
  type NodeEffects,
} from '@/data/constellations';
import { getPassiveMeta } from '@/data/passiveCatalog';
import {
  formatPassiveDetailHtml,
  formatPassiveScalingText,
  getUnlockedPassiveDetails,
} from '@/data/passiveScalingConfig';
import { getWarriorDefPower } from '@/data/classStatsConfig';
import { createDamageText } from '@/visual/effects';

type PassiveBag = Record<string, unknown>;

function ensurePassives(): PassiveBag {
  if (!STATE.passives) STATE.passives = {};
  return STATE.passives as PassiveBag;
}

function applyStatEffects(effects: NodeEffects): void {
  const s = STATE.stats;
  if (effects.atk) s.atk += effects.atk;
  if (effects.maxHpFlat) s.maxHp += effects.maxHpFlat;
  if (effects.maxHpPct) s.maxHp *= 1 + effects.maxHpPct;
  if (effects.speed) s.speed += effects.speed;
  if (effects.speedPct) s.speed *= 1 + effects.speedPct;
  if (effects.crit) s.crit += effects.crit;
  if (effects.critDmg) s.critDmg += effects.critDmg;
  if (effects.skillCdMods) {
    if (!s.skillCdMods) s.skillCdMods = createDefaultSkillCdMods();
    for (const [key, val] of Object.entries(effects.skillCdMods)) {
      if (typeof val === 'number' && val !== 0) {
        const k = key as AbilityKey;
        s.skillCdMods[k] = Math.max(0.35, (s.skillCdMods[k] || 1) + val);
      }
    }
  }
  if (effects.attackSpeedMod) {
    s.attackSpeedMod = Math.max(0.45, (s.attackSpeedMod || 1) + effects.attackSpeedMod);
  }
  if (effects.regen) s.regen = (s.regen || 0) + effects.regen;
  if (effects.lifesteal) s.lifesteal = (s.lifesteal || 0) + effects.lifesteal;
  if (effects.def) s.def = (s.def || 0) + effects.def;
  if (effects.xpMod) s.xpMod = (s.xpMod || 1) + effects.xpMod;
  if (effects.skillMods) {
    if (!s.skillMods) s.skillMods = createDefaultSkillMods();
    for (const [key, val] of Object.entries(effects.skillMods)) {
      if (typeof val === 'number' && val !== 0) {
        const k = key as SkillKey;
        s.skillMods[k] = (s.skillMods[k] || 1) + val;
      }
    }
  }
}

function registerPassive(effects: NodeEffects): void {
  if (!effects.passive) return;
  const p = ensurePassives();
  const rank = effects.passiveRank ?? 1;
  const key = effects.passive;
  const prev = (p[key] as number) || 0;
  p[key] = Math.max(prev, rank);

  if (key === 'etherSteps') {
    const count = rank;
    p.etherSteps = Array.from({ length: count }, () => ({ rt_cooldown: 0 }));
  }
  if (key === 'warFervor' && !p.warFervorStacks) p.warFervorStacks = 0;
  if (key === 'orbitalWeave' && !p.orbitalStacks) p.orbitalStacks = 0;
  if (key === 'lastBreath') p.lastBreathCd = 0;
  if ((key === 'parryCharge' || key === 'runicColossus') && p.storedParryDamage == null) {
    p.storedParryDamage = 0;
  }
}

function applyNode(node: ConstellationNode, silent = false): string {
  applyStatEffects(node.effects);
  registerPassive(node.effects);
  if (!silent && window.UI) window.UI.toast(`${node.name} — activé`);
  return node.name;
}

export const ConstellationEngine = {
  getActiveClass(): ClassId {
    return (STATE.class || 'warrior') as ClassId;
  },

  canUnlock(nodeId: string): { ok: boolean; reason?: string } {
    const node = getNodeById(nodeId);
    if (!node) return { ok: false, reason: 'Nœud inconnu' };
    const classId = this.getActiveClass();
    if (!nodeId.startsWith(classId) && !nodeId.startsWith(`${classId}-`)) {
      return { ok: false, reason: 'Constellation d\'une autre classe' };
    }
    if (STATE.unlockedNodes.includes(nodeId)) return { ok: false, reason: 'Déjà débloqué' };

    if (node.branch === 'apex') {
      const classNodes = STATE.unlockedNodes.filter((id) => id.startsWith(classId) && !id.endsWith('-apex'));
      if (classNodes.length < CONSTELLATION_APEX_MIN_NODES) {
        return { ok: false, reason: `Il faut ${CONSTELLATION_APEX_MIN_NODES} nœuds de classe` };
      }
      const branches = new Set<string>();
      classNodes.forEach((id) => {
        const parts = id.split('-');
        if (parts.length >= 3) branches.add(parts[1]);
      });
      if (branches.size < 3) return { ok: false, reason: 'Investissez dans 3 branches minimum' };
    } else if (node.requires?.length) {
      for (const req of node.requires) {
        if (!STATE.unlockedNodes.includes(req)) {
          return { ok: false, reason: 'Prérequis manquant' };
        }
      }
    }

    if (STATE.skillPoints < node.cost) return { ok: false, reason: 'Pas assez de points' };
    return { ok: true };
  },

  unlock(nodeId: string): boolean {
    const check = this.canUnlock(nodeId);
    if (!check.ok) {
      if (window.UI) window.UI.toast(check.reason || 'Impossible');
      return false;
    }
    const node = getNodeById(nodeId)!;
    STATE.skillPoints -= node.cost;
    STATE.unlockedNodes.push(nodeId);
    applyNode(node);
    this.syncPlayerStats();
    if (typeof window !== 'undefined' && window.BuffBar) window.BuffBar.render();
    return true;
  },

  /** Recalcule stats + passifs depuis les nœuds (après reset de classe). */
  recalculate(): void {
    const classId = this.getActiveClass();
    const prefix = `${classId}-`;
    const nodes = STATE.unlockedNodes.filter((id) => id.startsWith(prefix) || id === `${classId}-apex`);

    STATE.passives = {};
    STATE.stats.skillMods = createDefaultSkillMods();
    STATE.stats.skillCdMods = createDefaultSkillCdMods();
    STATE.stats.titanBonus = 0;
    STATE.stats.titanDefBonus = 0;
    STATE.stats.cdMod = 1;
    STATE.stats.attackSpeedMod = 1;

    if (Globals.player?.applyClassStats) {
      Globals.player.applyClassStats(true);
    }

    for (const id of nodes) {
      const node = getNodeById(id);
      if (node) applyNode(node, true);
    }
    this.syncPlayerStats();
  },

  syncPlayerStats(): void {
    const p = Globals.player;
    if (!p || !p.isLocalPlayer?.()) return;
    p.maxHp = STATE.stats.maxHp;
    p.speed = STATE.stats.speed;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    if (window.UI) window.UI.updateHUD();
  },

  isNodeUnlocked(nodeId: string): boolean {
    return STATE.unlockedNodes.includes(nodeId);
  },

  isNodeAvailable(nodeId: string): boolean {
    if (this.isNodeUnlocked(nodeId)) return false;
    return this.canUnlock(nodeId).ok || this.canUnlock(nodeId).reason === 'Pas assez de points';
  },

  getUnlockedCountForClass(classId?: ClassId): number {
    const cid = classId || this.getActiveClass();
    return STATE.unlockedNodes.filter((id) => id.startsWith(`${cid}-`) && !id.endsWith('-apex')).length;
  },

  isApexAvailable(): boolean {
    return this.canUnlock(`${this.getActiveClass()}-apex`).ok
      || this.canUnlock(`${this.getActiveClass()}-apex`).reason === 'Pas assez de points';
  },

  getPassiveRank(key: string): number {
    const p = STATE.passives as PassiveBag | undefined;
    return (p?.[key] as number) || 0;
  },

  /** Boucle de passifs (regen, titan, fureur, inspiration…). */
  tick(dt: number): void {
    const p = ensurePassives();
    const player = Globals.player;
    if (!player || player.dead) return;

    if (STATE.stats.regen) {
      player.hp = Math.min(player.maxHp, player.hp + STATE.stats.regen * dt);
    }

    if (p.titanBlood) {
      STATE.stats.titanDefBonus = player.maxHp * 0.02 * (p.titanBlood as number);
    } else if (STATE.stats.titanDefBonus) {
      STATE.stats.titanDefBonus = 0;
    }

    this.tickSolarInspiration(dt);

    if (p.lastBreathCd && (p.lastBreathCd as number) > 0) {
      p.lastBreathCd = (p.lastBreathCd as number) - dt;
    }
  },

  onBasicAttack(): void {
    const p = ensurePassives();
    if (!p.warFervor) return;
    p.warFervorStacks = Math.min(5, ((p.warFervorStacks as number) || 0) + 1);
    STATE.stats.atk += 0;
  },

  getWarFervorMult(): number {
    const p = STATE.passives as PassiveBag | undefined;
    if (!p?.warFervor) return 1;
    return 1 + ((p.warFervorStacks as number) || 0) * 0.03;
  },

  onSkillUsed(key: string): void {
    const p = ensurePassives();
    const player = Globals.player;
    if (!player) return;

    const overloadRank = Math.max(
      (p.arcaneOverload as number) || 0,
      (p.paradoxOverload as number) || 0,
    );
    if (overloadRank > 0 && player.cooldowns) {
      const reduction = overloadRank >= 2 ? 1.2 : 0.6;
      for (const k of ['space', 'shift', 'e'] as const) {
        if (k !== key && player.cooldowns[k] > 0) {
          player.cooldowns[k] = Math.max(0, player.cooldowns[k] - reduction);
        }
      }
    }

    if (p.orbitalWeave && player.className === 'eclipse') {
      p.orbitalStacks = Math.min(4, ((p.orbitalStacks as number) || 0) + 1);
      STATE.stats.atk += 0;
    }

    if (p.beamHaste && key === 'space' && player.className === 'sentinel') {
      player.addBuff?.('Hâte solaire', 2, '☀');
      player.speed *= 1.3;
      setTimeout(() => {
        if (Globals.player) Globals.player.speed = STATE.stats.speed;
      }, 2000);
    }
  },

  modifyDamageTaken(amount: number): number {
    const p = ensurePassives();
    let dmg = amount;

    const def = STATE.stats.def || 0;
    if (def > 0) dmg *= Math.max(0.4, 1 - def * 0.008);

    if (p.ironWall) dmg *= 0.92;
    if (p.runicColossus) dmg *= 0.82;
    else if (['warrior', 'blade', 'pacifier', 'eclipse'].includes(Globals.player?.className)) {
      dmg *= 0.88;
    }

    return dmg;
  },

  getSkillDmgMod(skillKey: SkillKey): number {
    return STATE.stats.skillMods?.[skillKey] ?? 1;
  },

  /** Multiplicateur de recharge global (fragments) × bonus constellation du sort. */
  getSkillCdMult(key: AbilityKey): number {
    const global = STATE.stats.cdMod ?? 1;
    const per = STATE.stats.skillCdMods?.[key] ?? 1;
    return Math.max(0.35, global * per);
  },

  calcSkillDamage(
    skillKey: SkillKey,
    atkRatio?: number,
    context: { targetHpPct?: number; marked?: boolean } = {},
  ): number {
    const classId = this.getActiveClass();
    const base = atkRatio != null
      ? STATE.stats.atk * atkRatio
      : calcSkillBaseDamage(classId, skillKey);
    return this.modifyDamageDealt(base, { skill: true, skillKey, ...context });
  },

  getSolarInspirationAtkMult(forPlayer = Globals.player): number {
    const source = this.getSolarInspirationSource();
    if (!source || !forPlayer || forPlayer.dead) return 1;
    if (forPlayer.position.distanceTo(source.position) > 14) return 1;
    return forPlayer === source ? 1.3 : 1.15;
  },

  getSolarInspirationSource() {
    const local = Globals.player;
    if (local?.className === 'sentinel' && this.getPassiveRank('solarInspiration')) {
      return local;
    }
    return null;
  },

  tickSolarInspiration(dt: number): void {
    const source = this.getSolarInspirationSource();
    if (!source || source.dead) return;

    const healRate = 0.01;
    const applyHeal = (target: { hp: number; maxHp: number }) => {
      if (!target || target.maxHp <= 0) return;
      target.hp = Math.min(target.maxHp, target.hp + target.maxHp * healRate * dt);
    };

    applyHeal(source);
    if (STATE.multiplayer?.remotePlayers) {
      for (const id of Object.keys(STATE.multiplayer.remotePlayers)) {
        const ally = STATE.multiplayer.remotePlayers[id];
        if (!ally || ally.dead || ally === source) continue;
        if (ally.position.distanceTo(source.position) <= 14) {
          applyHeal(ally);
        }
      }
    }
  },

  getVampJumpModifiers(): { radius: number; dmgMult: number; stunMs: number; healRatio: number } {
    const rank = this.getPassiveRank('vampJumpAmp');
    if (!rank) {
      return { radius: 5, dmgMult: 1, stunMs: 2000, healRatio: 0.5 };
    }
    return { radius: 6.75, dmgMult: 1.25, stunMs: 2500, healRatio: 0.65 };
  },

  getHealAmpMult(): number {
    return this.getPassiveRank('healAmp') ? 1.15 : 1;
  },

  applyOverhealShield(player: { hp: number; maxHp: number; overhealShield?: number; className?: string }, amount: number): number {
    if (!this.getPassiveRank('overhealShield') || player.className !== 'sentinel') return amount;
    const cap = player.maxHp * 0.25;
    const room = player.maxHp - player.hp;
    if (room >= amount) return amount;
    const overflow = amount - Math.max(0, room);
    player.overhealShield = Math.min(cap, (player.overhealShield || 0) + overflow * 0.5);
    return Math.max(0, room);
  },

  absorbOverhealShield(player: { overhealShield?: number }, amount: number): number {
    const shield = player.overhealShield || 0;
    if (shield <= 0) return amount;
    const absorbed = Math.min(shield, amount);
    player.overhealShield = shield - absorbed;
    return amount - absorbed;
  },

  modifyDamageDealt(
    base: number,
    context: { skill?: boolean; skillKey?: SkillKey; targetHpPct?: number; marked?: boolean } = {},
  ): number {
    let dmg = base;
    const p = ensurePassives();

    dmg *= this.getSolarInspirationAtkMult();
    dmg *= this.getWarFervorMult();

    const key = context.skillKey ?? (context.skill ? undefined : 'primary');
    if (key) dmg *= this.getSkillDmgMod(key);

    if (context.skill) {
      if (p.executioner && context.marked) dmg *= 1.35;
    }

    if (Globals.player?.className === 'blade') {
      const rank = (p.eternalThirst as number) || (p.earlyThirst ? 1 : 0);
      if (rank > 0) {
        const hpPct = Globals.player.hp / Globals.player.maxHp;
        const threshold = p.earlyThirst ? 0.5 : 0.3;
        if (hpPct <= threshold) {
          const maxBonus = rank >= 2 ? 0.6 : 0.4;
          const t = 1 - hpPct / threshold;
          dmg *= 1 + maxBonus * t;
        }
      }
    }

    return dmg;
  },

  onBlock(damageBlocked: number): void {
    const p = ensurePassives();
    if (!p.parryCharge && !p.runicColossus) return;
    const rate = p.runicColossus ? 0.4 : 0.25;
    p.storedParryDamage = ((p.storedParryDamage as number) || 0) + damageBlocked * rate;
  },

  getStoredParryCharge(): number {
    const p = STATE.passives as PassiveBag | undefined;
    return (p?.storedParryDamage as number) || 0;
  },

  consumeParryCharge(): number {
    const p = ensurePassives();
    const stored = (p.storedParryDamage as number) || 0;
    p.storedParryDamage = 0;
    return stored;
  },

  /** Fin de Parade (guerrier) : remboursement de recharge. */
  onParryEnd(): void {
    const p = ensurePassives();
    const player = Globals.player;
    if (!p.parryRefund || !player || player.className !== 'warrior') return;
    for (const k of ['space', 'shift', 'e'] as const) {
      player.cooldowns[k] = Math.max(0, player.cooldowns[k] - player.maxCooldowns[k] * 0.1);
    }
  },

  calcWarriorSkillDamage(skillKey: SkillKey, extraFlat = 0): number {
    let dmg = this.calcSkillDamage(skillKey);
    if (extraFlat > 0) dmg += extraFlat;
    return dmg;
  },

  calcWarriorParryExplosion(blockedTotal: number): number {
    const base = getWarriorDefPower() * 1.6;
    const bonus = blockedTotal * 0.5;
    return this.modifyDamageDealt(base + bonus, { skill: true, skillKey: 'e' });
  },

  tryLastBreath(): boolean {
    const p = ensurePassives();
    if (!p.lastBreath || (p.lastBreathCd as number) > 0) return false;
    p.lastBreathCd = 90;
    if (Globals.player) {
      Globals.player.hp = 1;
      createDamageText('DERNIER SOUFFLE', Globals.player.position, '#1abc9c');
    }
    return true;
  },

  getUnlockedPassives(): Array<{ key: string; rank: number; name: string }> {
    return getUnlockedPassiveDetails(this.getActiveClass(), STATE.unlockedNodes);
  },

  getClassPassiveSummary(): { name: string; desc: string; scalingHtml: string } {
    const classId = this.getActiveClass();
    const c = getConstellationForClass(classId);
    const apexUnlocked = this.isNodeUnlocked(c.apex.id);

    if (apexUnlocked && c.apex.effects.passive) {
      const key = c.apex.effects.passive;
      const rank = c.apex.effects.passiveRank ?? 2;
      const meta = getPassiveMeta(key);
      return {
        name: c.apex.name,
        desc: meta?.desc || c.apex.desc,
        scalingHtml: formatPassiveDetailHtml(key, rank),
      };
    }

    const passives = this.getUnlockedPassives();
    if (passives.length > 0) {
      const desc = passives
        .map((p) => {
          const meta = getPassiveMeta(p.key);
          const label = meta?.name || p.name;
          return `${label} — ${formatPassiveScalingText(p.key, p.rank)}`;
        })
        .join(' · ');
      const scalingHtml = passives.map((p) => formatPassiveDetailHtml(p.key, p.rank)).join('');
      return {
        name: passives.length === 1 ? (getPassiveMeta(passives[0].key)?.name || passives[0].name) : `${passives.length} passifs stellaires`,
        desc,
        scalingHtml,
      };
    }

    const base = (window as unknown as { CONFIG?: { tooltips: Record<string, { passive: { name: string; desc: string } }> } }).CONFIG;
    const t = base?.tooltips?.[classId];
    const fallback = t?.passive || { name: 'Passif de classe', desc: c.subtitle };
    return { ...fallback, scalingHtml: '' };
  },
};
