// @ts-nocheck
export class SlimeLordAnimator {
    constructor(boss) {
        this.boss = boss;
        this.time = 0;
        this.floatSpeed = 1.5;
        this.floatAmp = 0.3;
    }

    update(dt) {
        if (!this.boss.parts || !this.boss.mesh) return;
        this.time += dt;

        this.updateIdleFloat(dt);
        this.updateStaff(dt);
        this.updatePoses(dt);
    }

    updateIdleFloat(dt) {
        const parts = this.boss.parts;
        const state = this.boss.animState;
        
        // Si en transition de phase, flottement épique (monte haut)
        let baseHeight = 1.5; // Hauteur de base de lowerBody
        let amp = this.floatAmp;
        let speed = this.floatSpeed;

        if (state === 'phase_transition') {
            baseHeight = 3.5; // Monte très haut
            amp = 0.5;
            speed = 5.0; // Vibre d'énergie
        }

        const floatY = Math.sin(this.time * speed) * amp;
        
        // Lerp vers la hauteur cible pour smooth transition
        // FIX: On cible 'lowerBody' car c'est le parent principal du corps dans le nouveau modèle
        if (parts.lowerBody) {
            parts.lowerBody.position.y = THREE.MathUtils.lerp(parts.lowerBody.position.y, baseHeight + floatY, dt * 2.0);
        }

        // La queue ondule
        if (parts.tailGroup) {
            parts.tailGroup.rotation.z = Math.sin(this.time * 2.0) * 0.1;
            parts.tailGroup.children.forEach((seg, i) => {
                seg.position.x = Math.sin(this.time * 3.0 + i) * 0.1;
            });
        }

        // Les épaulettes flottent
        if (parts.shoulderL) parts.shoulderL.position.y = 0.5 + Math.cos(this.time * 2) * 0.05;
        if (parts.shoulderR) parts.shoulderR.position.y = 0.5 + Math.cos(this.time * 2 + 1) * 0.05;

        // Cercle runique
        if (parts.runeCircle) {
            parts.runeCircle.rotation.z -= dt * 0.5;
            if (state === 'phase_transition') parts.runeCircle.rotation.z -= dt * 5.0; // Tourne très vite
        }
    }

    updateStaff(dt) {
        const parts = this.boss.parts;
        const scale = 1.0 + Math.sin(this.time * 5) * 0.1;
        if (parts.staffOrb) parts.staffOrb.scale.setScalar(scale);

        if (parts.staffRings) {
            parts.staffRings.forEach(ring => {
                ring.rotation.y += dt * 2.0;
                ring.rotation.x += dt * 1.0;
            });
        }
    }

    updatePoses(dt) {
        const parts = this.boss.parts;
        const state = this.boss.animState;
        
        const lerpRot = (obj, axis, val, speed = 8) => {
            if (obj) obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], val, dt * speed);
        };
        const lerpPos = (obj, axis, val, speed = 8) => {
            if (obj) obj.position[axis] = THREE.MathUtils.lerp(obj.position[axis], val, dt * speed);
        };

        // Note: 'bodyGroup' n'existe plus, on utilise 'torsoGroup' ou 'lowerBody' selon l'effet voulu
        const torso = parts.torsoGroup; 

        if (state === 'idle') {
            lerpRot(torso, 'x', 0.1); 
            lerpRot(parts.staffGroup, 'z', 0);
            lerpPos(parts.staffGroup, 'x', 0); // Position locale main
            lerpPos(parts.staffGroup, 'y', 0);
            lerpPos(parts.staffGroup, 'z', 0);
        }
        else if (state === 'channeling') {
            lerpRot(torso, 'x', -0.2); 
            lerpPos(parts.staffGroup, 'y', 0.5, 5);
            lerpRot(parts.staffGroup, 'z', -0.5);
        }
        else if (state === 'thrust') {
            lerpRot(torso, 'x', 0.4, 15);
            lerpPos(parts.staffGroup, 'z', 0.5, 15);
            lerpRot(parts.staffGroup, 'x', -0.5, 15);
        }
        else if (state === 'spin_attack') {
            if(parts.lowerBody) parts.lowerBody.rotation.y += dt * 15.0; 
            lerpPos(parts.staffGroup, 'x', 0.5);
        }
        else if (state === 'phase_transition') {
            // POSE D'ASCENSION : Bras ouverts (staff écarté), tête en arrière
            lerpRot(torso, 'x', -0.5, 3); // Cambre en arrière
            lerpPos(parts.staffGroup, 'x', 0.5, 3); // Bâton loin sur le coté
            lerpPos(parts.staffGroup, 'y', 0.5, 3); // Bâton haut
            if(parts.headGroup) lerpRot(parts.headGroup, 'x', -0.8, 3); // Regarde le ciel
            
            // Le bâton tourne sur lui même
            if(parts.staffGroup) parts.staffGroup.rotation.y += dt * 10;
        }
    }
}