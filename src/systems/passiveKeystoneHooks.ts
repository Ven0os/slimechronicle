// @ts-nocheck
import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { createDamageText } from '@/visual/effects';

function rank(key: string): number {
  const p = STATE.passives as Record<string, number> | undefined;
  return (p?.[key] as number) || 0;
}

function passives() {
  if (!STATE.passives) STATE.passives = {};
  return STATE.passives as Record<string, unknown>;
}

export const PassiveKeystoneHooks = {
  // ——— Mage ———
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

  // ——— Blade ———
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

  onBladeDashEnd(player: { isIntangible?: boolean }) {
    if (!rank('dashReset') || !player) return;
    player.isIntangible = true;
    setTimeout(() => {
      if (Globals.player === player) player.isIntangible = false;
    }, 400);
    player._dashKillWindowUntil = Date.now() + 3000;
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
    if (rank('eternalThirst') >= 2) return 0.5;
    if (rank('eternalThirst') >= 1 || rank('earlyThirst')) return 0.3;
    return 0.3;
  },

  // ——— Pacificateur ———
  getBloodShieldMaxMult(): number {
    let m = 1;
    if (rank('shieldOverflow')) m += 0.25;
    if (rank('bloodPact')) m += 0.4;
    return m;
  },

  getShieldOverflowRate(): number {
    return rank('shieldOverflow') ? 0.35 : 0;
  },

  isEnemyMarked(enemy: { sanguineInstability?: boolean }): boolean {
    return !!(enemy?.sanguineInstability && rank('executioner'));
  },

  markEnemyVerdict(enemy: { sanguineInstability?: boolean }, durationSec = 6) {
    if (!enemy) return;
    enemy.sanguineInstability = true;
    createDamageText('MARQUÉ', enemy.position, '#ff0000');
    setTimeout(() => {
      if (enemy && !enemy.dead) enemy.sanguineInstability = false;
    }, durationSec * 1000);
  },

  onPacifierFrenzyKill(player: { bloodPistolActive?: boolean; cooldowns?: Record<string, number>; _frenzyRefundUsed?: boolean }) {
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
    return rank('bloodPact') ? 2 : 0;
  },

  isFrenzyGuaranteedCrit(shotIndex: number): boolean {
    return rank('bloodPact') && shotIndex > 0 && (shotIndex + 1) % 3 === 0;
  },

  // ——— Éclipse ———
  getSolarFlareMods() {
    if (!rank('solarFlare')) return { dotMult: 0.3, dotTicks: 1, extraBounces: 0 };
    return { dotMult: 0.42, dotTicks: 3, extraBounces: 2 };
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

  // ——— Sentinelle (compléments) ———
  onSentinelBeamFired(player: { addBuff?: (n: string, d: number, i: string) => void; speed?: number }) {
    if (!rank('beamHaste') || !player) return;
    player.addBuff?.('Hâte solaire', 2, '☀');
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
  },
};
