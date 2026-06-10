// @ts-nocheck
export class KingSlimeAnimator {
    constructor(boss) {
        this.boss = boss;
        this.animTime = 0;
        this.walkCycle = 0;
    }

    update(dt) {
        // Sécurité si le modèle n'est pas encore prêt
        if (!this.boss.parts || !this.boss.mesh) return;

        this.updateProcedural(dt);
        this.updatePoses(dt);
    }

    // --- ANIMATIONS PASSIVES (Respiration, Marche, Cape) ---
    updateProcedural(dt) {
        this.animTime += dt;
        const parts = this.boss.parts;
        const isMoving = this.boss.speed > 0.1 && !this.boss.isAttacking;

        // 1. Respiration (Le corps entier se dilate et flotte)
        const breathe = Math.sin(this.animTime * 2) * 0.02;
        if (parts.body) {
            // Oscillation verticale légère
            parts.body.position.y = 1.6 + breathe;
            // Dilatation style "Slime" (Squash & Stretch)
            parts.body.scale.set(1 + breathe, 1 - breathe, 1 + breathe);
        }

        // 2. Pulsation du Cœur d'Énergie
        if (parts.core) {
            // Battement cardiaque rapide (x10) ou lent selon l'état pourrait être ajouté
            const pulse = 1.0 + Math.sin(this.animTime * 10) * 0.2;
            parts.core.scale.setScalar(pulse);
        }

        // 3. Cycle de Marche (Cinématique inverse simplifiée)
        if (isMoving) {
            this.walkCycle += dt * 5.0; // Vitesse de l'animation de marche
            const wSin = Math.sin(this.walkCycle);
            const wCos = Math.cos(this.walkCycle);

            // Les jambes balancent
            if (parts.legL) parts.legL.rotation.x = wSin * 0.5;
            if (parts.legR) parts.legR.rotation.x = -wSin * 0.5;

            // Le corps tangue de gauche à droite (Poids)
            this.boss.mesh.rotation.z = wCos * 0.05;
            this.boss.mesh.rotation.y += wSin * 0.02; // Légère rotation du buste

            // La cape ondule violemment en marchant
            if (parts.capeSegments) {
                parts.capeSegments.forEach((seg, i) => {
                    seg.rotation.x = 0.2 + Math.sin(this.walkCycle - i * 0.5) * 0.15 * (i + 1);
                });
            }
        } else {
            // Retour à la position neutre (Lerp doux pour transition smooth)
            const damp = 5.0 * dt;
            if (parts.legL) parts.legL.rotation.x = THREE.MathUtils.lerp(parts.legL.rotation.x, 0, damp);
            if (parts.legR) parts.legR.rotation.x = THREE.MathUtils.lerp(parts.legR.rotation.x, 0, damp);
            this.boss.mesh.rotation.z = THREE.MathUtils.lerp(this.boss.mesh.rotation.z, 0, damp);

            // La cape flotte doucement au vent (Idle)
            if (parts.capeSegments) {
                parts.capeSegments.forEach((seg, i) => {
                    const wind = Math.sin(this.animTime * 2 + i) * 0.05;
                    seg.rotation.x = THREE.MathUtils.lerp(seg.rotation.x, 0.1 + wind * i, damp);
                });
            }
        }
    }

    // --- POSES D'ATTAQUE (Rotation des articulations) ---
    updatePoses(dt) {
        const parts = this.boss.parts;
        const state = this.boss.animState;

        // Fonction utilitaire pour interpoler la rotation (Smooth transition)
        const lerpRot = (obj, axis, val, speed = 10) => {
            if (obj) obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], val, dt * speed);
        };

        if (state === 'idle') {
            // --- POSE NORMALE (Même en Phase 3) ---
            lerpRot(parts.armR, 'x', 0);
            lerpRot(parts.armR, 'z', 0.1); // Bras légèrement écarté
            lerpRot(parts.armL, 'x', 0);
            lerpRot(parts.armL, 'z', -0.1);
            lerpRot(parts.body, 'y', 0, 5); // Remet le corps droit
            lerpRot(parts.head, 'x', 0);
            lerpRot(parts.body, 'x', 0);
        } 
        else if (state === 'windup_cleave') {
            // Prépare un coup d'épée massif : Bras en arrière, torse tourné
            lerpRot(parts.armR, 'x', -Math.PI / 1.1, 8);
            lerpRot(parts.armR, 'z', 0.5, 8);
            lerpRot(parts.body, 'y', 0.5, 8); // Torsion du buste pour la force
        } 
        else if (state === 'strike_cleave') {
            // Frappe : Bras vers l'avant, torse tourne dans l'autre sens
            lerpRot(parts.armR, 'x', 0.5, 15); // Coup vers le bas
            lerpRot(parts.armR, 'z', -0.5, 15);
            lerpRot(parts.body, 'y', -0.5, 15);
        } 
        else if (state === 'windup_jump') {
            // S'accroupit pour sauter
            this.boss.mesh.position.y = THREE.MathUtils.lerp(this.boss.mesh.position.y, -1.0, dt * 5);
            lerpRot(parts.body, 'x', 0.5, 10); // Penche en avant
        } 
        else if (state === 'air_jump') {
            // En l'air : Corps étiré, bras levés pour écraser
            this.boss.mesh.scale.y = THREE.MathUtils.lerp(this.boss.mesh.scale.y, this.boss.scaleVal * 1.2, dt * 5);
            this.boss.mesh.scale.x = THREE.MathUtils.lerp(this.boss.mesh.scale.x, this.boss.scaleVal * 0.8, dt * 5);
            lerpRot(parts.armR, 'x', -Math.PI, 5);
            lerpRot(parts.armL, 'x', -Math.PI, 5);
        } 
        else if (state === 'cast_spell') {
            // Incantation : Lève le bras gauche
            lerpRot(parts.armL, 'x', -Math.PI / 1.5, 5);
            if (parts.armL) {
                // Vibration de la main qui incante
                parts.armL.position.y = 0.3 + Math.sin(this.animTime * 20) * 0.05;
            }
        }
    }
}