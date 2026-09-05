// @ts-nocheck
import { Globals } from '../../core/globals';

// La cible « défense de cristal » est identique pour tous les ennemis : la chercher dans
// la liste des interactables pour chacun d'eux et à chaque frame était du travail redondant.
const CRYSTAL_CACHE_TTL_MS = 250;
let _crystalCacheAt = -Infinity;
let _crystalCacheCount = -1;
let _crystalCacheValue = null;

function getCrystalDefenseTarget() {
    const events = window.WorldEvents;
    if (!events || !events.isActive || !events.interactables) return null;

    const now = performance.now();
    const count = events.interactables.length;
    if (_crystalCacheValue !== null && count === _crystalCacheCount && now - _crystalCacheAt < CRYSTAL_CACHE_TTL_MS) {
        return _crystalCacheValue;
    }

    let found = null;
    for (const obj of events.interactables) {
        if (obj.userData && obj.userData.type === 'CrystalDefense') { found = obj; break; }
    }
    _crystalCacheAt = now;
    _crystalCacheCount = count;
    _crystalCacheValue = found;
    return found;
}

export class AIBrain {
    constructor(enemy) {
        this.enemy = enemy;
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;
        this.strafeTimer = 0;
        // Vecteurs de travail propres à cet ennemi. Le résultat de update() est toujours
        // consommé dans la frame courante par l'appelant, jamais conservé : on peut donc
        // réutiliser les mêmes instances au lieu d'en allouer à chaque frame.
        this._dir = new THREE.Vector3();
        this._side = new THREE.Vector3();
        this._repulse = new THREE.Vector3();
        this._push = new THREE.Vector3();
    }

    update(dt, target) {
        const dir = this._dir;

        if (window.WorldEvents && window.WorldEvents.isActive) {
             const crystalEvent = getCrystalDefenseTarget();
             if (crystalEvent && crystalEvent.visible) {
                 target = crystalEvent;
                 this.enemy.forcedTarget = target; 
             }
        }

        if (!target) return dir.set(0, 0, 0);

        if (this.strafeTimer > 0) this.strafeTimer -= dt;

        const dist = this.enemy.position.distanceTo(target.position);
        // Normalisation puis mise à plat de Y, dans cet ordre : le vecteur obtenu est
        // volontairement plus court quand la cible est en hauteur (comportement d'origine).
        dir.subVectors(target.position, this.enemy.position).normalize();
        dir.y = 0;

        // Si la cible est le cristal (forcedTarget), on fonce droit dessus (pas de kiting/strafe)
        if (this.enemy.forcedTarget) {
            return dir;
        }

        // Comportement Sentinelle (Tank — approche lente)
        if (this.enemy.type === 'sentinel') {
            if (dist > 3.5) return dir.multiplyScalar(0.85);
            return dir.set(0, 0, 0);
        }
        // Comportement Assassin (Flank — moins rush)
        else if (this.enemy.type === 'rogue') {
            if (this.strafeTimer <= 0) {
                this.strafeDir *= -1;
                this.strafeTimer = 1.5 + Math.random() * 2.5;
            }
            if (dist > 11.0) return dir.multiplyScalar(0.75);
            if (dist > 3.5) {
                this._side.set(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir);
                return this._side.add(dir.multiplyScalar(0.35)).normalize();
            }
            if (dist > 2.2) return dir.multiplyScalar(0.6);
            return dir.set(0, 0, 0);
        }
        // Comportement Sorcier (Kiting — garde la distance)
        else if (this.enemy.type === 'warlock') {
            const idealRange = 14.0;
            if (dist < 8.0) return dir.negate().multiplyScalar(0.7);
            if (dist > idealRange) return dir.multiplyScalar(0.65);
            return this._side.set(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir * 0.35);
        }
        // Comportement Corrompu (pression modérée)
        else if (this.enemy.type === 'corrupted') {
            if (dist > 10.0) return dir.multiplyScalar(0.7);
            if (dist > 4.0) return this._side.set(-dir.z, 0, dir.x).multiplyScalar(this.strafeDir * 0.4);
            if (dist > 2.8) return dir.multiplyScalar(0.5);
            return dir.set(0, 0, 0);
        }

        return dir.multiplyScalar(0.7);
    }

    /** Boost de poursuite Mini-Boss (tier Prédateur). */
    applyMiniBossPursuit(moveDir) {
        if (!this.enemy.isMiniBoss || !this.enemy.miniBossStats) return moveDir;
        const extra = (this.enemy.miniBossStats.pursuitMult || 1) - 1;
        if (extra <= 0 || moveDir.lengthSq() <= 0.0001) return moveDir;
        return moveDir.multiplyScalar(1 + extra * 0.85);
    }

    avoidance(velocity) {
        if (!Globals.enemies) return velocity;
        const repulse = this._repulse.set(0, 0, 0);
        let count = 0;
        for (const other of Globals.enemies) {
            if (other === this.enemy || other.dead) continue;
            // Comparaison au carré (1.5² = 2.25) : supprime une racine carrée par paire
            // d'ennemis et par frame, sur une boucle déjà quadratique.
            if (this.enemy.position.distanceToSquared(other.position) < 2.25) {
                this._push.subVectors(this.enemy.position, other.position).normalize();
                repulse.add(this._push);
                count++;
            }
        }
        if (count > 0) {
            repulse.divideScalar(count).multiplyScalar(2.0); // Force de répulsion
            velocity.add(repulse).normalize();
        }
        return velocity;
    }
}
