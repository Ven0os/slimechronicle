// @ts-nocheck
import { Globals } from '../../core/globals';

export class AIBrain {
    constructor(enemy) {
        this.enemy = enemy;
        this.strafeDir = Math.random() < 0.5 ? 1 : -1;
        this.strafeTimer = 0;
    }

    update(dt, target) {
        if (window.WorldEvents && window.WorldEvents.isActive) {
             const crystalEvent = window.WorldEvents.interactables.find(obj => obj.userData && obj.userData.type === 'CrystalDefense');
             if (crystalEvent && crystalEvent.visible) {
                 target = crystalEvent;
                 this.enemy.forcedTarget = target; 
             }
        }

        if (!target) return new THREE.Vector3();

        if (this.strafeTimer > 0) this.strafeTimer -= dt;

        const dist = this.enemy.position.distanceTo(target.position);
        const dirToTarget = target.position.clone().sub(this.enemy.position).normalize();
        dirToTarget.y = 0;

        // Si la cible est le cristal (forcedTarget), on fonce droit dessus (pas de kiting/strafe)
        if (this.enemy.forcedTarget) {
            return dirToTarget;
        }

        // Comportement Sentinelle (Tank — approche lente)
        if (this.enemy.type === 'sentinel') {
            if (dist > 3.5) return dirToTarget.multiplyScalar(0.85);
            return new THREE.Vector3();
        }
        // Comportement Assassin (Flank — moins rush)
        else if (this.enemy.type === 'rogue') {
            if (this.strafeTimer <= 0) {
                this.strafeDir *= -1;
                this.strafeTimer = 1.5 + Math.random() * 2.5;
            }
            if (dist > 11.0) return dirToTarget.multiplyScalar(0.75);
            if (dist > 3.5) {
                const side = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x).multiplyScalar(this.strafeDir);
                return side.add(dirToTarget.multiplyScalar(0.35)).normalize();
            }
            if (dist > 2.2) return dirToTarget.multiplyScalar(0.6);
            return new THREE.Vector3();
        }
        // Comportement Sorcier (Kiting — garde la distance)
        else if (this.enemy.type === 'warlock') {
            const idealRange = 14.0;
            if (dist < 8.0) return dirToTarget.negate().multiplyScalar(0.7);
            if (dist > idealRange) return dirToTarget.multiplyScalar(0.65);
            return new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x).multiplyScalar(this.strafeDir * 0.35);
        }
        // Comportement Corrompu (pression modérée)
        else if (this.enemy.type === 'corrupted') {
            if (dist > 10.0) return dirToTarget.multiplyScalar(0.7);
            if (dist > 4.0) return new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x).multiplyScalar(this.strafeDir * 0.4);
            if (dist > 2.8) return dirToTarget.multiplyScalar(0.5);
            return new THREE.Vector3();
        }

        return dirToTarget.multiplyScalar(0.7);
    }

    avoidance(velocity) {
        if (!Globals.enemies) return velocity;
        const repulse = new THREE.Vector3();
        let count = 0;
        for (const other of Globals.enemies) {
            if (other === this.enemy || other.dead) continue;
            const dist = this.enemy.position.distanceTo(other.position);
            if (dist < 1.5) {
                const push = this.enemy.position.clone().sub(other.position).normalize();
                repulse.add(push);
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