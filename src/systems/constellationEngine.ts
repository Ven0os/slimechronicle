// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import * as THREE from 'three';
import {
  calcSkillBaseDamage,
  createDefaultSkillCdMods,
  createDefaultSkillMods,
  getSkillRatio,
  type AbilityKey,
  type SkillKey,
} from '@/data/classStatsConfig';
import {
  getConstellationForClass,
  getNodeById,
  type ClassId,
  type ConstellationNode,
  type NodeEffects,
} from '@/data/constellations';

export type ApexProgressState = 'locked' | 'ready' | 'unlocked';
import { getPassiveMeta } from '@/data/passiveCatalog';
import {
  formatPassiveDetailHtml,
  formatPassiveScalingText,
  getUnlockedPassiveDetails,
} from '@/data/passiveScalingConfig';
import { getPlayerDefense, applyDefenseReduction } from '@/gameplay/combat/defense';
import { APEX_PASSIVE_BY_CLASS, ConvergenceEffects, getApexPassiveRank, isChronoApexActive } from '@/systems/convergenceEffects';
import { clampFracture } from '@/gameplay/classes/chrono/fractureHelpers';
import { PassiveKeystoneHooks } from '@/systems/passiveKeystoneHooks';
import { createDamageText, createSkillVisual, spawnParticles } from '@/visual/effects';

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
  const defBonus = effects.defense ?? effects.def;
  if (defBonus) s.defense = (s.defense ?? 10) + defBonus;
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
  if (key === 'lastBreath') p.lastBreathCd = 0;
  if (key === 'parryCharge' && p.storedParryDamage == null) {
    p.storedParryDamage = 0;
  }
  if (key === 'paradoxOverload' && rank >= 2 && !p._paradoxKillCount) {
    p._paradoxKillCount = 0;
    p._paradoxRewards = {};
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
      const missing = this.getNonApexNodes(classId).filter((n) => !STATE.unlockedNodes.includes(n.id));
      if (missing.length > 0) {
        return {
          ok: false,
          reason: `Tous les nœuds requis (${missing.length} restant${missing.length > 1 ? 's' : ''})`,
        };
      }
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
    if (nodeId === 'chronoregulator-apex' && Globals.player?.className === 'chronoregulator') {
      Globals.player.overheatTriggered = false;
      const p = ensurePassives();
      p.continuumMastery = 2;
      if (typeof Globals.player.syncChronoApexState === 'function') {
        Globals.player.syncChronoApexState();
      }
    }
    ConvergenceEffects.applyPacifierConvergenceStats();
    ConvergenceEffects.reapplyParadoxRewards();
    if (this.isApexPassiveActive('eternalThirst', 'blade') && Globals.player?.className === 'blade') {
      ConvergenceEffects.syncBladeThirstCrit(Globals.player);
    } else {
      ConvergenceEffects.resetBladeThirstCrit();
    }
    this.clearStaleApexPlayerState();
    this.syncPlayerStats();
    if (typeof window !== 'undefined' && window.BuffBar) window.BuffBar.render();
    return true;
  },

  /** Recalcule stats + passifs depuis les nœuds (après reset de classe). */
  recalculate(): void {
    const classId = this.getActiveClass();
    const prefix = `${classId}-`;
    const nodes = STATE.unlockedNodes.filter((id) => id.startsWith(prefix) || id === `${classId}-apex`);

    const paradoxBackup = {
      _paradoxKillCount: STATE.passives?._paradoxKillCount as number | undefined,
      _paradoxRewards: STATE.passives?._paradoxRewards
        ? { ...(STATE.passives._paradoxRewards as Record<string, number>) }
        : undefined,
    };

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

    this.ensureKeystonePassive('stellarOvercharge', 'sentinel-surcharge-10');
    this.ensureKeystonePassive('ruptureAstrale', 'eclipse-orbite-10');
    this.ensureKeystonePassive('solarFlare', 'eclipse-soleil-10');
    this.ensureKeystonePassive('continuumMastery', 'chronoregulator-apex', 2);

    if (paradoxBackup._paradoxRewards) {
      const p = ensurePassives();
      p._paradoxKillCount = paradoxBackup._paradoxKillCount ?? 0;
      p._paradoxRewards = paradoxBackup._paradoxRewards;
    }

    ConvergenceEffects.applyPacifierConvergenceStats();
    ConvergenceEffects.reapplyParadoxRewards();
    if (this.isApexPassiveActive('eternalThirst', 'blade') && Globals.player?.className === 'blade') {
      ConvergenceEffects.syncBladeThirstCrit(Globals.player);
    } else {
      ConvergenceEffects.resetBladeThirstCrit();
    }
    this.clearStaleApexPlayerState();
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
    return this.getUnlockedNonApexCount(classId);
  },

  getNonApexNodes(classId?: ClassId): ConstellationNode[] {
    const cid = classId || this.getActiveClass();
    return getConstellationForClass(cid).branches.flatMap((b) => b.nodes);
  },

  getNonApexNodeTotal(classId?: ClassId): number {
    return this.getNonApexNodes(classId).length;
  },

  getUnlockedNonApexCount(classId?: ClassId): number {
    const cid = classId || this.getActiveClass();
    const nonApexIds = new Set(this.getNonApexNodes(cid).map((n) => n.id));
    return STATE.unlockedNodes.filter((id) => nonApexIds.has(id)).length;
  },

  getUnlockedKeystoneCount(classId?: ClassId): number {
    return this.getNonApexNodes(classId).filter(
      (n) => n.keystone && STATE.unlockedNodes.includes(n.id),
    ).length;
  },

  getKeystoneTotal(classId?: ClassId): number {
    return this.getNonApexNodes(classId).filter((n) => n.keystone).length;
  },

  getApexProgressState(classId?: ClassId): ApexProgressState {
    const cid = classId || this.getActiveClass();
    const apexId = getConstellationForClass(cid).apex.id;
    if (this.isNodeUnlocked(apexId)) return 'unlocked';
    if (this.getUnlockedNonApexCount(cid) >= this.getNonApexNodeTotal(cid)) return 'ready';
    return 'locked';
  },

  areAllNonApexNodesUnlocked(classId?: ClassId): boolean {
    const state = this.getApexProgressState(classId);
    return state === 'ready' || state === 'unlocked';
  },

  isApexAvailable(): boolean {
    const cid = this.getActiveClass();
    const check = this.canUnlock(`${cid}-apex`);
    return check.ok || check.reason === 'Pas assez de points';
  },

  getPassiveRank(key: string): number {
    const p = STATE.passives as PassiveBag | undefined;
    return (p?.[key] as number) || 0;
  },

  /** Ré-enregistre un passif de keystone si le nœud est débloqué mais STATE.passives a été perdu. */
  ensureKeystonePassive(key: string, nodeId: string, rank = 1): void {
    if (this.getPassiveRank(key) > 0) return;
    if (!this.isNodeUnlocked(nodeId)) return;
    registerPassive({ passive: key, passiveRank: rank });
  },

  isConvergenceUnlocked(classId?: ClassId): boolean {
    const cid = classId || this.getActiveClass();
    return this.isNodeUnlocked(`${cid}-apex`);
  },

  /** Passif Apex actif : nœud apex débloqué + rang ≥ 2 + bonne classe. */
  isApexPassiveActive(passiveKey: string, classId?: ClassId): boolean {
    const cid = classId || this.getActiveClass();
    if (passiveKey === 'continuumMastery' && cid === 'chronoregulator') {
      return isChronoApexActive();
    }
    return getApexPassiveRank(passiveKey, cid) >= 2;
  },

  getApexPassiveKeyForClass(classId?: ClassId): string | null {
    const cid = classId || this.getActiveClass();
    return APEX_PASSIVE_BY_CLASS[cid] || null;
  },

  /** Nettoie état joueur / jauges Apex lorsque le passif n'est plus actif. */
  clearStaleApexPlayerState(): void {
    const player = Globals.player;
    if (!player) return;

    if (!this.isApexPassiveActive('bloodPact', 'pacifier')) {
      player._convergenceShotIndex = 0;
      ConvergenceEffects.clearPacifierHemocycleState(player);
    }
    if (!this.isApexPassiveActive('runicColossus', 'warrior')) {
      ConvergenceEffects.clearRunicJudgmentState(player);
    }
    if (player.className === 'chronoregulator') {
      if (this.isApexPassiveActive('continuumMastery', 'chronoregulator') && typeof player.syncChronoApexState === 'function') {
        player.syncChronoApexState();
      } else if (player.fractureGauge != null) {
        player.fractureGauge = clampFracture(player.fractureGauge);
      }
    }
    if (!this.isApexPassiveActive('eternalThirst', 'blade')) {
      ConvergenceEffects.resetBladeThirstCrit();
    }
  },

  /** @deprecated Utiliser isConvergenceUnlocked */
  isApexUnlocked(classId?: ClassId): boolean {
    return this.isConvergenceUnlocked(classId);
  },

  hasSolarWellCurse(): boolean {
    return this.isApexPassiveActive('solarInspiration', 'sentinel');
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

    this.tickSolarLightField(dt);
    PassiveKeystoneHooks.tickParadoxClones(player);
    if (player.className === 'blade') PassiveKeystoneHooks.tickBloodFrenzy(player);
    PassiveKeystoneHooks.tickGuardianDefBonus(player);

    if (player.className === 'blade' && this.isApexPassiveActive('eternalThirst', 'blade')) {
      ConvergenceEffects.syncBladeThirstCrit(player);
    }

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

    const arcaneRank = (p.arcaneOverload as number) || 0;
    if (arcaneRank > 0 && player.cooldowns) {
      const reduction = 0.6;
      for (const k of ['space', 'shift', 'e'] as const) {
        if (k !== key && player.cooldowns[k] > 0) {
          player.cooldowns[k] = Math.max(0, player.cooldowns[k] - reduction);
        }
      }
    }

    if (player.className === 'blade') PassiveKeystoneHooks.tickBloodFrenzy(player);

    if (p.beamHaste && key === 'space' && player.className === 'sentinel') {
      player.addBuff?.('Hâte solaire', 2, 'fa-sun');
      player.speed *= 1.3;
      setTimeout(() => {
        if (Globals.player) Globals.player.speed = STATE.stats.speed;
      }, 2000);
    }
  },

  modifyDamageTaken(amount: number): number {
    const p = ensurePassives();
    let dmg = applyDefenseReduction(amount, getPlayerDefense());

    if (p.ironWall) dmg *= 0.92;
    if (['warrior', 'blade', 'pacifier', 'eclipse'].includes(Globals.player?.className)) {
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

  getStellarBeamKeystoneMods(): { sizeMult: number; hpRatio: number } {
    const active = this.getPassiveRank('solarBeamHaste');
    return {
      sizeMult: active ? 1.1 : 1,
      hpRatio: active ? 0.05 : 0,
    };
  },

  calcStellarBeamDamage(
    player: { maxHp?: number } = Globals.player,
    chargeRatio = 1,
  ): number {
    const mods = this.getStellarBeamKeystoneMods();
    const hpBonus = (player?.maxHp || 0) * mods.hpRatio;
    const base = STATE.stats.atk * 3.0 + hpBonus;
    return this.modifyDamageDealt(base * chargeRatio, { skill: true, skillKey: 'space' });
  },

  getActiveSolarLightFields(): Array<{ pos: THREE.Vector3; radius: number; until: number; malusAnnounced?: boolean; nextBurnAt?: number }> {
    const p = ensurePassives();
    const now = Date.now();
    const legacy = p._solarLightField as { pos: THREE.Vector3; radius: number; until: number; malusAnnounced?: boolean; nextBurnAt?: number } | undefined;
    const list = Array.isArray(p._solarLightFields)
      ? p._solarLightFields as Array<{ pos: THREE.Vector3; radius: number; until: number; malusAnnounced?: boolean; nextBurnAt?: number }>
      : legacy ? [legacy] : [];
    const active = list.filter((field) => field && field.until > now);
    p._solarLightFields = active;
    p._solarLightField = active[active.length - 1];
    return active;
  },

  isInSolarInspirationZone(forPlayer: { position: THREE.Vector3; dead?: boolean }): boolean {
    if (!forPlayer || forPlayer.dead || !this.hasSolarWellCurse()) return false;
    return this.getActiveSolarLightFields().some((field) => forPlayer.position.distanceTo(field.pos) <= field.radius);
  },

  getSolarInspirationAtkMult(forPlayer = Globals.player): number {
    if (!forPlayer || forPlayer.dead) return 1;
    if (!this.isInSolarInspirationZone(forPlayer)) return 1;
    return forPlayer.className === 'sentinel' ? 1.3 : 1.15;
  },

  getLightFieldRadius(): number {
    let r = 10;
    if (this.getPassiveRank('healAmp')) r += 2;
    return r;
  },

  getLightFieldDuration(): number {
    let d = 5;
    if (this.getPassiveRank('healAmp')) d += 2;
    return d;
  },

  getLightFieldHealTick(anchored = false): number {
    let heal = 1;
    if (this.getPassiveRank('healAmp')) heal *= 1.15;
    if (anchored && this.hasSolarWellCurse()) heal *= 2;
    return heal;
  },

  getLightFieldEnemyDebuffMods(): { speedMult: number; dmgTakenMult: number } | null {
    return null;
  },

  registerSolarLightField(pos: THREE.Vector3, durationSec: number): void {
    const p = ensurePassives();
    const field = {
      pos: pos.clone(),
      radius: this.getLightFieldRadius(),
      until: Date.now() + durationSec * 1000,
    };
    const fields = this.getActiveSolarLightFields();
    fields.push(field);
    p._solarLightFields = fields;
    p._solarLightField = field;
  },

  registerStellarSingularityWell(pos: THREE.Vector3, durationSec = this.getLightFieldDuration(), forceVisual = false): boolean {
    if (!forceVisual && !this.hasSolarWellCurse()) return false;
    this.registerSolarLightField(pos, durationSec);
    this.createStellarLightWellVisual(pos, durationSec);
    createSkillVisual('shockwave', pos, this.getLightFieldRadius() * 0.7, 0xffd166);
    createDamageText('PUITS DE LUMIÈRE', pos, '#fff3a0');
    spawnParticles(pos.clone().add(new THREE.Vector3(0, 0.35, 0)), 0xffd166, 24);
    return true;
  },

  createStellarLightWellVisual(pos: THREE.Vector3, durationSec: number): void {
    if (!Globals.scene) return;
    const radius = this.getLightFieldRadius();
    const group = new THREE.Group();
    group.position.copy(pos).add(new THREE.Vector3(0, 0.08, 0));

    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xfff3a0,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const warmRingMat = new THREE.MeshBasicMaterial({
      color: 0xffc857,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), fillMat);
    fill.rotation.x = -Math.PI / 2;
    group.add(fill);

    const outer = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius, 96), ringMat);
    outer.rotation.x = -Math.PI / 2;
    group.add(outer);

    const inner = new THREE.Mesh(new THREE.RingGeometry(radius * 0.45, radius * 0.49, 96), warmRingMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.01;
    group.add(inner);

    Globals.scene.add(group);
    const startedAt = performance.now();
    const durationMs = Math.max(0.2, durationSec) * 1000;

    const dispose = () => {
      Globals.scene?.remove(group);
      group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    };

    const animate = () => {
      if (!group.parent) return;
      const elapsed = performance.now() - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const fade = progress > 0.82 ? Math.max(0, (1 - progress) / 0.18) : 1;
      const pulse = 1 + Math.sin(elapsed * 0.004) * 0.025;

      group.rotation.y += 0.004;
      outer.rotation.z += 0.006;
      inner.rotation.z -= 0.01;
      fill.scale.setScalar(pulse);
      outer.scale.setScalar(1 + Math.sin(elapsed * 0.003) * 0.018);
      inner.scale.setScalar(1 + Math.cos(elapsed * 0.0045) * 0.035);
      fillMat.opacity = 0.14 * fade;
      ringMat.opacity = 0.62 * fade;
      warmRingMat.opacity = 0.42 * fade;

      if (progress >= 1) {
        dispose();
      } else {
        requestAnimationFrame(animate);
      }
    };
    animate();
  },

  applyLightFieldDebuff(enemy: {
    dead?: boolean;
    isMiniBoss?: boolean;
    position: THREE.Vector3;
    speed?: number;
    _lightFieldBaseSpeed?: number;
    _solarLightDebuffUntil?: number;
    _solarLightDmgTakenMult?: number;
  }, mods: { speedMult: number; dmgTakenMult: number }): void {
    if (!enemy || enemy.dead || enemy.isMiniBoss) return;
    if (enemy._lightFieldBaseSpeed == null && enemy.speed != null) {
      enemy._lightFieldBaseSpeed = enemy.speed;
    }
    if (enemy._lightFieldBaseSpeed != null) {
      enemy.speed = enemy._lightFieldBaseSpeed * mods.speedMult;
    }
    enemy._solarLightDmgTakenMult = mods.dmgTakenMult;
    enemy._solarLightDebuffUntil = Date.now() + 400;
  },

  clearExpiredLightFieldDebuffs(): void {
    const now = Date.now();
    Globals.enemies?.forEach((enemy) => {
      if (!enemy._solarLightDebuffUntil || now < enemy._solarLightDebuffUntil) return;
      if (enemy._lightFieldBaseSpeed != null) {
        enemy.speed = enemy._lightFieldBaseSpeed;
        delete enemy._lightFieldBaseSpeed;
      }
      delete enemy._solarLightDebuffUntil;
      delete enemy._solarLightDmgTakenMult;
    });
  },

  tickSolarLightField(dt: number): void {
    this.clearExpiredLightFieldDebuffs();

    const p = ensurePassives();
    const fields = this.getActiveSolarLightFields();
    if (!fields.length) {
      delete p._solarLightField;
      p._solarWellAnchored = false;
      return;
    }

    const source = Globals.player;
    p._solarWellAnchored = false;
    if (!this.hasSolarWellCurse()) return;

    const now = Date.now();
    fields.forEach((field) => {
      if (!field.nextBurnAt) field.nextBurnAt = 0;
      if (now < field.nextBurnAt) return;
      field.nextBurnAt = now + 1000;

      let touched = false;
      Globals.enemies?.forEach((enemy) => {
        if (enemy.dead || enemy.position.distanceTo(field.pos) > field.radius) return;
        touched = true;
        PassiveKeystoneHooks.applySentinelSolarBurn(enemy, source);
      });

      if (touched && !field.malusAnnounced) {
        field.malusAnnounced = true;
        createDamageText('BRÛLURE SOLAIRE', field.pos, '#ffb703');
      }
    });
  },

  getSolarInspirationSource() {
    const local = Globals.player;
    if (local?.className === 'sentinel' && this.isApexPassiveActive('solarInspiration', 'sentinel')) {
      return local;
    }
    return null;
  },

  tickSolarInspiration(_dt: number): void {
    // Conservé pour compatibilité avec les anciens appels : Singularité Stellaire vit désormais dans tickSolarLightField.
  },

  getStellarSingularityBeamDamageMult(enemy: { _solarBurnUntil?: number } | null | undefined): number {
    if (!this.hasSolarWellCurse()) return 1;
    if (!enemy?._solarBurnUntil || Date.now() >= enemy._solarBurnUntil) return 1;
    return 1.15;
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

    return dmg;
  },

  onBlock(damageBlocked: number): void {
    const p = ensurePassives();
    if (!p.parryCharge) return;
    p.storedParryDamage = ((p.storedParryDamage as number) || 0) + damageBlocked * 0.25;
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

  onWarriorParryBlock(player: { heal?: (n: number) => void; maxHp: number }, blocked: number): void {
    if (this.getPassiveRank('ironWall') && player.heal) {
      player.heal(player.maxHp * 0.01);
    }
  },

  shouldTriggerParrySeismic(): boolean {
    return !!this.getPassiveRank('parryCharge');
  },

  getFreeSeismicRadius(): number {
    return 12;
  },

  /** Fin de Parade (guerrier) : QOL keystones cri + remboursement CD. */
  onWarriorParryEnd(player: {
    className?: string;
    maxHp: number;
    heal?: (n: number) => void;
    addBuff?: (n: string, d: number, i: string) => void;
    isIntangible?: boolean;
    cooldowns?: Record<string, number>;
    maxCooldowns?: Record<string, number>;
    parryBlockedTotal?: number;
  }): void {
    if (!player || player.className !== 'warrior') return;
    const p = ensurePassives();

    if (p.parryRefund && player.cooldowns && player.maxCooldowns) {
      for (const k of ['space', 'shift', 'e'] as const) {
        player.cooldowns[k] = Math.max(0, player.cooldowns[k] - player.maxCooldowns[k] * 0.1);
      }
    }

    if (p.parryRefund) {
      player.isIntangible = true;
      setTimeout(() => {
        if (Globals.player === player) player.isIntangible = false;
      }, 400);
    }

    if (p.titanBlood && player.addBuff) {
      player.addBuff('Élan titan', 3, 'fa-dumbbell');
    }

    if (p.ironWall && (player.parryBlockedTotal || 0) > 0 && player.heal) {
      player.heal(player.maxHp * 0.03);
    }
  },

  /** @deprecated Utiliser onWarriorParryEnd */
  onParryEnd(): void {
    if (Globals.player) this.onWarriorParryEnd(Globals.player);
  },

  calcWarriorSkillDamage(skillKey: SkillKey, extraFlat = 0): number {
    let dmg = this.calcSkillDamage(skillKey);
    if (extraFlat > 0) dmg += extraFlat;
    return dmg;
  },

  calcWarriorParryExplosion(blockedTotal: number): number {
    const base = getPlayerDefense() * 1.6;
    const bonus = blockedTotal * 0.5;
    return this.modifyDamageDealt(base + bonus, { skill: true, skillKey: 'e' });
  },

  tryLastBreath(): boolean {
    const p = ensurePassives();
    if (!p.lastBreath || (p.lastBreathCd as number) > 0) return false;
    p.lastBreathCd = 90;
    if (Globals.player) {
      Globals.player.hp = 1;
      Globals.player.isIntangible = true;
      createDamageText('DERNIER SOUFFLE', Globals.player.position, '#1abc9c');
      setTimeout(() => {
        if (Globals.player) Globals.player.isIntangible = false;
      }, 2000);
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
        scalingHtml: formatPassiveDetailHtml(key, rank, classId),
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
