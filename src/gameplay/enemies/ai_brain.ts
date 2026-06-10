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

        // Comportement Sentinelle (Tank - Fonce droit)
        if (this.enemy.type === 'sentinel') {
            if (dist > 2.0) return dirToTarget;
            return new THREE.Vector3();
        } 
        // Comportement Assassin (Flank - Spirale)
        else if (this.enemy.type === 'rogue') {
            if (this.strafeTimer <= 0) {
                this.strafeDir *= -1;
                this.strafeTimer = 1.0 + Math.random() * 2.0;
            }
            if (dist > 8.0) return dirToTarget;
            else if (dist > 2.5) {
                const side = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x).multiplyScalar(this.strafeDir);
                return side.add(dirToTarget.multiplyScalar(0.5)).normalize();
            } else {
                return dirToTarget;
            }
        } 
        // Comportement Sorcier (Kiting - Distance)
        else if (this.enemy.type === 'warlock') {
            const idealRange = 12.0;
            if (dist < 6.0) return dirToTarget.negate(); // Fuite
            else if (dist > idealRange) return dirToTarget;
            else {
                // Strafe autour
                return new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x).multiplyScalar(this.strafeDir * 0.5);
            }
        }

        return dirToTarget;
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