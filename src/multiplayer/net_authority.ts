// @ts-nocheck
/**
 * Couche autorité serveur globale — garde-fous gameplay multijoueur.
 * Hôte = serveur. Clients = intent + rendu uniquement.
 */

import { STATE } from '@/core/config';
import { Globals } from '@/core/globals';
import { Network } from './network';
import { isServerAuthority, isVisualOnlyMode } from './net_combat';

const DEBUG = typeof window !== 'undefined' && !!(window as unknown as { __NET_AUTH_DEBUG?: boolean }).__NET_AUTH_DEBUG;

export type AuthViolation =
  | 'client_gameplay_authority'
  | 'duplicate_damage'
  | 'duplicate_kill_reward'
  | 'missing_owner'
  | 'expired_entity'
  | 'duplicate_skill_resolve'
  | 'visual_damage_attempt'
  | 'stale_event';

const processedDamageKeys = new Set<string>();
const processedSkillInstances = new Set<string>();
const MAX_TRACK = 2048;

function trimSet(set: Set<string>) {
  if (set.size <= MAX_TRACK) return;
  const arr = [...set];
  set.clear();
  for (let i = arr.length - MAX_TRACK / 2; i < arr.length; i++) set.add(arr[i]);
}

export function canApplyGameplay(): boolean {
  if (!STATE.multiplayer.active) return true;
  if (isVisualOnlyMode()) return false;
  return isServerAuthority();
}

export function canDealDamageDirectly(): boolean {
  if (!STATE.multiplayer.active) return true;
  if (isVisualOnlyMode()) return false;
  return isServerAuthority();
}

export function shouldUseDamageRequest(): boolean {
  return STATE.multiplayer.active && !STATE.multiplayer.isHost && !isVisualOnlyMode();
}

export function shouldSendSkillIntent(): boolean {
  return STATE.multiplayer.active && !isServerAuthority();
}

export function serverNowMs(): number {
  return Date.now();
}

export function logAuthViolation(kind: AuthViolation, detail: string, data?: unknown) {
  if (!DEBUG) return;
  console.warn(`[NetAuthority:${kind}] ${detail}`, data ?? '');
}

export function warnClientGameplayAuthority(context: string) {
  if (!STATE.multiplayer.active || isServerAuthority() || isVisualOnlyMode()) return;
  logAuthViolation('client_gameplay_authority', context);
}

export function registerDamageEvent(eventKey: string): boolean {
  if (!eventKey) return true;
  if (processedDamageKeys.has(eventKey)) {
    logAuthViolation('duplicate_damage', eventKey);
    return false;
  }
  processedDamageKeys.add(eventKey);
  trimSet(processedDamageKeys);
  return true;
}

export function registerSkillInstance(instanceId: string): boolean {
  if (!instanceId) return true;
  if (processedSkillInstances.has(instanceId)) {
    logAuthViolation('duplicate_skill_resolve', instanceId);
    return false;
  }
  processedSkillInstances.add(instanceId);
  trimSet(processedSkillInstances);
  return true;
}

export function makeDamageEventKey(playerId: string, enemyId: string, skillKey: string, tick: number) {
  return `${playerId}|${enemyId}|${skillKey}|${tick}`;
}

export function resetAuthorityTracking() {
  processedDamageKeys.clear();
  processedSkillInstances.clear();
}

export function sendSkillIntent(payload: {
  intent: string;
  skillKey?: string;
  seq?: number;
  dir?: THREE.Vector3;
  pos?: THREE.Vector3;
  extra?: Record<string, unknown>;
}) {
  if (!shouldSendSkillIntent()) return;
  const seq = payload.seq ?? ((NetAuthority._seq = (NetAuthority._seq || 0) + 1));
  const p = Globals.player?.position;
  Network.send({
    type: 'skill-intent',
    id: STATE.multiplayer.id,
    class: STATE.class,
    seq,
    intent: payload.intent,
    skillKey: payload.skillKey,
    dir: payload.dir ? { x: payload.dir.x, y: payload.dir.y, z: payload.dir.z } : undefined,
    pos: payload.pos
      ? { x: payload.pos.x, y: payload.pos.y, z: payload.pos.z }
      : p ? { x: p.x, y: p.y, z: p.z } : undefined,
    extra: payload.extra,
  });
}

export const NetAuthority = {
  _seq: 0,
  canApplyGameplay,
  canDealDamageDirectly,
  shouldUseDamageRequest,
  shouldSendSkillIntent,
  serverNowMs,
  logAuthViolation,
  warnClientGameplayAuthority,
  registerDamageEvent,
  registerSkillInstance,
  makeDamageEventKey,
  resetAuthorityTracking,
  sendSkillIntent,
};

export default NetAuthority;
