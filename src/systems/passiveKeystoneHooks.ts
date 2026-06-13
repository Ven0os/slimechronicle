// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { ConvergenceEffects } from '@/systems/convergenceEffects';
import { createDamageText, createSkillVisual, spawnParticles } from '@/visual/effects';
import { NetClassState } from '@/multiplayer/net_class_state';
import { isServerAuthority } from '@/multiplayer/net_combat';
import { getPlayerDefense } from '@/gameplay/combat/defense';
import { ConstellationEngine } from '@/systems/constellationEngine';
import { dealDamageToEnemy } from '@/gameplay/combat/damage_helpers';
import { canApplyGameplay, canDealDamageDirectly } from '@/multiplayer/net_authority';
import { Projectile } from '@/gameplay/entities';
import { LENS_SPLIT_COUNT_DEFAULT, LENS_SPLIT_COUNT_EXTRA_PRISM } from '@/gameplay/classes/chrono/beamHelpers';

function rank(key: string): number {
  const p = STATE.passives as Record<string, number> | undefined;
  return (p?.[key] as number) || 0;
}

function passiveRankForPlayer(player: { _netExtraPrismLens?: number; isLocalPlayer?: () => boolean } | null | undefined, key: string): number {
  if (!player) return rank(key);
  if (key === 'extraPrismLens' && player._netExtraPrismLens != null) {
    return player._netExtraPrismLens ? 1 : 0;
  }
  if (player.isLocalPlayer?.()) return rank(key);
  return 0;
}

function passives() {
  if (!STATE.passives) STATE.passives = {};
  return STATE.passives as Record<string, unknown>;
}

export const PassiveKeystoneHooks = {
  getGuardianWarCryMods() {
    if (!rank('guardianWarCry')) return { healMult: 1, radius: 0, allyDefRatio: 0, allyDefDuration: 0 };
    return { healMult: 0.65, radius: 12, allyDefRatio: 0.1, allyDefDuration: 6 };
  },

  applyGuardianWarCryAllies(warrior: { position: THREE.Vector3; dead?: boolean }) {
    const mods = this.getGuardianWarCryMods();
    if (!mods.radius || !warrior || warrior.dead) return;
    const defBonus = Math.floor(getPlayerDefense() * mods.allyDefRatio);
    const applyTo = (ally: { position: THREE.Vector3; dead?: boolean; addBuff?: (n: string, d: number, i: string) => void; _guardianDefBonus?: number }) => {
      if (!ally || ally.dead || ally === warrior) return;
      if (ally.position.distanceTo(warrior.position) > mods.radius) return;
      ally._guardianDefBonus = defBonus;
      ally.addBuff?.('Cri du Gardien', mods.allyDefDuration, 'fa-shield-heart');
      createDamageText(`+${defBonus} DEF`, ally.position, '#ffd700');
    };
    if (STATE.multiplayer?.remotePlayers) {
      for (const id of Object.keys(STATE.multiplayer.remotePlayers)) {
        applyTo(STATE.multiplayer.remotePlayers[id]);
      }
    }
  },

  tickGuardianDefBonus(player: { _guardianDefBonus?: number; buffs?: Array<{ name: string }> }) {
    if (!player?._guardianDefBonus) return;
    const hasBuff = player.buffs?.some((b) => b.name === 'Cri du Gardien');
    if (!hasBuff) player._guardianDefBonus = 0;
  },

  getBloodPistolTransfusionMods() {
    if (!rank('acceleratedTransfusion')) {
      return { atkSpeedMult: 1, selfDmgMult: 1, dmgMult: 1, projectileSpeedMult: 1 };
    }
    return { atkSpeedMult: 1.4, selfDmgMult: 0.7, dmgMult: 0.85, projectileSpeedMult: 1.25 };
  },

  registerParadoxClone(player: { paradoxClones?: Array<{ pos: THREE.Vector3; until: number }> }, pos: THREE.Vector3) {
    if (!rank('paradoxReplicated') || !player) return;
    if (!player.paradoxClones) player.paradoxClones = [];
    const now = Date.now();
    player.paradoxClones = player.paradoxClones.filter((c) => c.until > now);
    if (player.paradoxClones.length >= 2) player.paradoxClones.shift();
    player.paradoxClones.push({ pos: pos.clone(), until: now + 8000 });
  },

  tickParadoxClones(player: { paradoxClones?: Array<{ pos: THREE.Vector3; until: number }> }) {
    if (!player?.paradoxClones?.length) return;
    const now = Date.now();
    player.paradoxClones = player.paradoxClones.filter((c) => c.until > now);
  },

  replicateMageSkill(
    player: {
      paradoxClones?: Array<{ pos: THREE.Vector3; until: number }>;
      _cloneReplicating?: boolean;
      position?: THREE.Vector3;
    },
    key: string,
    ctx: { targetDir?: THREE.Vector3; skillDmg?: number } = {},
  ) {
    if (!rank('paradoxReplicated') || !player || player._cloneReplicating || key === 'e') return;
    const clones = (player.paradoxClones || []).filter((c) => c.until > Date.now());
    if (!clones.length || !canDealDamageDirectly()) return;
    const eff = 0.25;
    player._cloneReplicating = true;
    const dir = ctx.targetDir?.clone() || new THREE.Vector3(0, 0, 1);
    dir.y = 0;
    if (dir.lengthSq() > 0.001) dir.normalize();

    if (player.cooldowns && player.maxCooldowns && player.cooldowns[key] > 0) {
      player.cooldowns[key] = Math.max(0, player.cooldowns[key] - player.maxCooldowns[key] * 0.1);
    }

    for (const clone of clones) {
      if (key === 'space') {
        const dmg = (ctx.skillDmg || STATE.stats.atk * 0.75) * eff;
        const spread = 0.15;
        for (const i of [-1, 0, 1]) {
          const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * spread);
          const pGeo = new THREE.DodecahedronGeometry(0.25);
          const pMat = new THREE.MeshStandardMaterial({ color: 0x3498db, emissive: 0x00ffff, emissiveIntensity: 0.8 });
          const p = new Projectile(
            pGeo,
            pMat,
            clone.pos.clone().add(new THREE.Vector3(0, 1.8, 0)),
            d,
            0.9,
            dmg,
            'player',
            0x3498db,
          );
          Globals.projectiles.push(p);
        }
        spawnParticles(clone.pos, 0x3498db, 4);
      } else if (key === 'shift') {
        const stasis = this.getDeepStasisMods();
        const radius = stasis.radius * 0.85;
        createSkillVisual('shockwave', clone.pos, radius, 0x00ffff);
        Globals.enemies?.forEach((e) => {
          if (e.dead || e.position.distanceTo(clone.pos) > radius) return;
          const dmg = ConstellationEngine.modifyDamageDealt(STATE.stats.atk * 1.8 * eff, { skill: true, skillKey: 'shift' });
          dealDamageToEnemy(e, dmg, { pos: e.position });
        });
      }
    }
    player._cloneReplicating = false;
  },

  getDeepStasisMods() {
    if (!rank('deepStasis')) return { radius: 15, slowFactor: 0.05, duration: 2500 };
    return { radius: 16, slowFactor: 0.15, duration: 3000 };
  },

  getBlinkMasteryMods() {
    if (!rank('blinkMastery')) return { radius: 5, dmgMult: 1, healRatio: 0.4 };
    return { radius: 6.5, dmgMult: 1.2, healRatio: 0.5 };
  },

  onBlinkExplosionKill(player: { cooldowns?: Record<string, number>; maxCooldowns?: Record<string, number> }) {
    if (!rank('blinkMastery') || !player.cooldowns || !player.maxCooldowns) return;
    player.cooldowns.e = Math.max(0, player.maxCooldowns.e * 0.5);
    createDamageText('RESET E', player.position || Globals.player?.position, '#48c9b0');
  },

  getArcaneBarrageSpread(): number {
    return rank('cloneExtend') ? 2 : 1;
  },

  getArcaneBarrageExtraProjectiles(): number {
    return rank('cloneExtend') ? 1 : 0;
  },

  isBloodFrenzyActive(player: { _bloodFrenzyUntil?: number }) {
    return !!(rank('bloodFrenzy') && player?._bloodFrenzyUntil && Date.now() < player._bloodFrenzyUntil);
  },

  tickBloodFrenzy(player: {
    hp: number;
    maxHp: number;
    dead?: boolean;
    _bloodFrenzyUntil?: number;
    _bloodFrenzyStart?: number;
    addBuff?: (n: string, d: number, i: string) => void;
    position?: THREE.Vector3;
  }) {
    if (!rank('bloodFrenzy') || !player || player.dead || player.maxHp <= 0) return;
    const now = Date.now();
    if (player.hp / player.maxHp < 0.5) {
      if (!player._bloodFrenzyUntil || now >= player._bloodFrenzyUntil) {
        player._bloodFrenzyStart = now;
        player._bloodFrenzyUntil = now + 6000;
        player.addBuff?.('Frénésie', 6, 'fa-fire-flame-curved');
        createDamageText('FRÉNÉSIE', player.position, '#e74c3c');
      }
    }
    if (player._bloodFrenzyUntil && now >= player._bloodFrenzyUntil) {
      player._bloodFrenzyUntil = 0;
      player._bloodFrenzyStart = 0;
    }
  },

  extendBloodFrenzyOnCrit(player: { _bloodFrenzyUntil?: number; _bloodFrenzyStart?: number; addBuff?: (n: string, d: number, i: string) => void }) {
    if (!this.isBloodFrenzyActive(player) || !player?._bloodFrenzyStart) return;
    const cap = player._bloodFrenzyStart + 10000;
    player._bloodFrenzyUntil = Math.min(cap, (player._bloodFrenzyUntil || 0) + 500);
    const remainSec = Math.max(0.1, ((player._bloodFrenzyUntil || 0) - Date.now()) / 1000);
    player.addBuff?.('Frénésie', remainSec, 'fa-fire-flame-curved');
  },

  getBloodFrenzyAttackSpeedMult(player: { _bloodFrenzyUntil?: number }) {
    return this.isBloodFrenzyActive(player) ? 1.25 : 1;
  },

  getBloodFrenzyFlatDamage(player: { maxHp?: number; _bloodFrenzyUntil?: number }) {
    if (!this.isBloodFrenzyActive(player) || !player?.maxHp) return 0;
    return player.maxHp * 0.1;
  },

  onCritApplyHemorrhage(enemy: { dead?: boolean; position?: THREE.Vector3; hemorrhageStacks?: number }, dmg: number) {
    if (!rank('hemorrhage') || !enemy || enemy.dead) return;
    enemy.hemorrhageStacks = Math.min(3, (enemy.hemorrhageStacks || 0) + 1);
    const tick = dmg * 0.2 / 3;
    const stacks = enemy.hemorrhageStacks;
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        if (!enemy.dead && enemy.takeDamage) {
          enemy.takeDamage(tick * stacks);
          createDamageText('SAIGNÉE', enemy.position, '#c0392b');
        }
      }, i * 1000);
    }
  },

  onBladeDashEnd(player: {
    isIntangible?: boolean;
    position?: THREE.Vector3;
    _dashKillWindowUntil?: number;
    _dashShadowPos?: THREE.Vector3;
  }) {
    if (!player) return;
    if (rank('dashReset')) {
      player.isIntangible = true;
      setTimeout(() => {
        if (Globals.player === player) player.isIntangible = false;
      }, 400);
      player._dashKillWindowUntil = Date.now() + 3000;
    }
  },

  onBladeKill(player: { cooldowns?: Record<string, number>; maxCooldowns?: Record<string, number> }) {
    if (!rank('dashReset') || !player?._dashKillWindowUntil) return;
    if (Date.now() > player._dashKillWindowUntil) return;
    if (!player.cooldowns || !player.maxCooldowns) return;
    player.cooldowns.shift = Math.max(0, player.maxCooldowns.shift * 0.4);
    createDamageText('PAS DU NÉANT', player.position, '#16a085');
  },

  getCycloneDurationMs(): number {
    return rank('cyclonePull') ? 500 : 400;
  },

  applyCyclonePull(player: { position: THREE.Vector3; dead?: boolean }, dt: number) {
    if (!rank('cyclonePull') || !player || player.dead) return;
    Globals.enemies?.forEach((e) => {
      if (e.dead || e.position.distanceTo(player.position) > 5) return;
      const dir = player.position.clone().sub(e.position);
      dir.y = 0;
      if (dir.lengthSq() < 0.01) return;
      dir.normalize().multiplyScalar(8 * dt);
      e.position.add(dir);
    });
  },

  getEternalThirstThreshold(): number {
    return rank('earlyThirst') ? 0.3 : 0;
  },

  getBloodShieldMaxMult(): number {
    let m = 1;
    if (rank('shieldOverflow')) m += 0.25;
    return m;
  },

  getShieldOverflowRate(): number {
    return rank('shieldOverflow') ? 0.35 : 0;
  },

  isEnemyMarked(enemy: { sanguineInstability?: boolean }): boolean {
    return !!(enemy?.sanguineInstability && rank('executioner'));
  },

  markEnemyVerdict(enemy: { sanguineInstability?: boolean; isMiniBoss?: boolean }, durationSec = 6) {
    if (!enemy || enemy.isMiniBoss) return;
    enemy.sanguineInstability = true;
    createDamageText('MARQUÉ', enemy.position, '#ff0000');
    setTimeout(() => {
      if (enemy && !enemy.dead) enemy.sanguineInstability = false;
    }, durationSec * 1000);
  },

  onPacifierFrenzyKill(player: {
    bloodPistolActive?: boolean;
    cooldowns?: Record<string, number>;
    _frenzyRefundUsed?: boolean;
  }) {
    if (!rank('frenzyAdrenaline') || !player?.bloodPistolActive) return;
    if (player._frenzyRefundUsed) return;
    if (!player.cooldowns) return;
    player.cooldowns.e = 0;
    player._frenzyRefundUsed = true;
    createDamageText('ADRÉNALINE', player.position, '#d35400');
  },

  onFrenzyStart(player: { _frenzyRefundUsed?: boolean; _frenzyShotIndex?: number }) {
    if (!player) return;
    player._frenzyRefundUsed = false;
    player._frenzyShotIndex = 0;
  },

  getFrenzyExtraBullets(): number {
    return 0;
  },

  isFrenzyGuaranteedCrit(_shotIndex: number): boolean {
    return false;
  },

  getExtraPrismLensMods(player?: { _netExtraPrismLens?: number; isLocalPlayer?: () => boolean } | null) {
    if (!passiveRankForPlayer(player, 'extraPrismLens')) {
      return { splitCount: LENS_SPLIT_COUNT_DEFAULT, splitDmgMult: 1, burnOnSplit: false };
    }
    return { splitCount: LENS_SPLIT_COUNT_EXTRA_PRISM, splitDmgMult: 0.9, burnOnSplit: true };
  },

  applyPrismLensBurn(enemy: { dead?: boolean; position?: THREE.Vector3 }, tickDmg: number) {
    if (!enemy || enemy.dead) return;
    for (let t = 1; t <= 2; t++) {
      setTimeout(() => {
        if (!enemy.dead && canApplyGameplay()) {
          dealDamageToEnemy(enemy, tickDmg * 0.35, { pos: enemy.position, noCrit: true, skillKey: 'primary' });
          createDamageText('BRÛLURE', enemy.position, '#ff6600');
        }
      }, t * 500);
    }
  },

  getSolarFlareMods() {
    if (!rank('solarFlare')) return { dotMult: 0.3, dotTicks: 1, extraBounces: 0 };
    return { dotMult: 0.42, dotTicks: 3, extraBounces: 2 };
  },

  getDevouringSunMods() {
    if (!rank('devouringSun')) {
      return { spearRangeMult: 1, burnDmgMult: 1, burnTicks: 1, burnIntervalMs: 1000, burnStartMs: 500 };
    }
    return { spearRangeMult: 1.3, burnDmgMult: 1.4, burnTicks: 3, burnIntervalMs: 1000, burnStartMs: 500 };
  },

  getLunarSpikeMods() {
    if (!rank('lunarSpike')) return { radius: 3.5, dmgMult: 1, slowFactor: 1 };
    return { radius: 4.5, dmgMult: 1.12, slowFactor: 0.7 };
  },

  getOrbitalAtkMult(): number {
    if (!rank('orbitalWeave')) return 1;
    const stacks = (passives().orbitalStacks as number) || 0;
    return 1 + stacks * 0.04;
  },

  onEclipseSkillUsed(key: string) {
    const p = passives();
    if (!rank('orbitalWeave')) return;
    const last = p._orbitalLastSkill as string | undefined;
    if (last && last !== key) {
      p.orbitalStacks = Math.min(4, ((p.orbitalStacks as number) || 0) + 1);
    } else if (!last) {
      p.orbitalStacks = Math.min(4, ((p.orbitalStacks as number) || 0) + 1);
    }
    p._orbitalLastSkill = key;
    p._orbitalDecayAt = Date.now() + 8000;
  },

  tickOrbitalWeave() {
    const p = passives();
    if (!p._orbitalDecayAt || Date.now() < (p._orbitalDecayAt as number)) return;
    p.orbitalStacks = 0;
    p._orbitalLastSkill = undefined;
  },

  applyVoidPull(center: THREE.Vector3, strength = 10) {
    if (!rank('voidPull')) return;
    Globals.enemies?.forEach((e) => {
      if (e.dead || e.position.distanceTo(center) > 12) return;
      const dir = center.clone().sub(e.position);
      dir.y = 0;
      if (dir.lengthSq() < 0.01) return;
      dir.normalize().multiplyScalar(strength * 0.05);
      e.position.add(dir);
    });
  },

  getCataclysmChargeBonus(): number {
    return rank('voidPull') ? 0.2 : 0;
  },

  getStellarOverchargeMods() {
    if (!rank('stellarOvercharge')) {
      return { enabled: false };
    }
    return { enabled: true };
  },

  onSentinelBeamFired(player: { addBuff?: (n: string, d: number, i: string) => void; speed?: number }) {
    if (!rank('beamHaste') || !player) return;
    player.addBuff?.('Hâte solaire', 2, 'fa-sun');
    const base = STATE.stats.speed;
    player.speed = base * 1.3;
    setTimeout(() => {
      if (Globals.player === player) player.speed = STATE.stats.speed;
    }, 2000);
  },

  getMartyrShieldCapMult(): number {
    return rank('overhealShield') ? 0.25 : 0;
  },

  onEnemyKilledByPlayer() {
    const player = Globals.player;
    if (!player || player.dead) return;
    if (player.className === 'blade') this.onBladeKill(player);
    if (player.className === 'pacifier') this.onPacifierFrenzyKill(player);
    if (player.className === 'mage') {
      if (!STATE.multiplayer.active) {
        ConvergenceEffects.onParadoxKill(player);
      } else if (isServerAuthority()) {
        const pid = player === Globals.player
          ? String(STATE.multiplayer.id)
          : (player.userData?.id ? String(player.userData.id) : null);
        if (pid) NetClassState.onParadoxKill(pid);
      }
    }
  },
};
