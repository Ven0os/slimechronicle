// @ts-nocheck
import * as THREE from 'three';
import { Globals } from '../../../core/globals';
import { AudioSys } from '../../../core/ressources';
import { spawnParticles } from '../../../visual/effects';

export class KingSlimeAnimator {
    constructor(boss) {
        this.boss = boss;
        this.animTime = 0;
        this.walkCycle = 0;
        this.stateTime = 0;
        this.lastState = 'idle';
        this.lastPosition = new THREE.Vector3();
    }

    update(dt) {
        if (!this.boss.parts || !this.boss.mesh) return;

        if (this.boss.animState !== this.lastState) {
            this.stateTime = 0;
            this.lastState = this.boss.animState;
        }
        this.stateTime += dt;

        this.updatePoses(dt);
        this.updateProcedural(dt);
    }

    // --- ANIMATIONS PASSIVES (Respiration, Marche lourde, Cape) ---
    updateProcedural(dt) {
        this.animTime += dt;
        const parts = this.boss.parts;

        // Calcul dynamique du déplacement pour savoir si le boss marche vraiment
        const currentPos = this.boss.position.clone();
        if (!this.lastPosition) {
            this.lastPosition = currentPos.clone();
        }
        const distMoved = currentPos.distanceTo(this.lastPosition);
        this.lastPosition.copy(currentPos);

        // Si le boss bouge de plus de 0.005 unités dans la frame, il marche vraiment
        const isMoving = distMoved > 0.005 && !this.boss.isAttacking && !this.boss.dead && !this.boss.isCinematic;

        // 1. Respiration (Le corps entier se dilate et flotte)
        const breathe = Math.sin(this.animTime * 2.2) * 0.02;

        // 2. Pulsation du Cœur d'Énergie
        if (parts.core) {
            const pulse = 1.0 + Math.sin(this.animTime * 8) * 0.15;
            parts.core.scale.setScalar(pulse);
        }

        // 3. Cycle de Marche Lourd et Smooth
        if (isMoving) {
            const prevWalkCycle = this.walkCycle;
            this.walkCycle += dt * 4.2; // Vitesse de marche majestueuse et lourde
            
            const wSin = Math.sin(this.walkCycle);
            const wCos = Math.cos(this.walkCycle);

            // Les jambes balancent de manière fluide
            if (parts.legL) {
                parts.legL.rotation.x = wSin * 0.45;
                if (parts.shinL) {
                    // Bend knee when leg is swinging forward (wSin < 0)
                    parts.shinL.rotation.x = wSin < 0 ? 0.35 * Math.abs(wSin) : 0;
                }
            }
            if (parts.legR) {
                parts.legR.rotation.x = -wSin * 0.45;
                if (parts.shinR) {
                    // Bend knee when leg is swinging forward (wSin > 0)
                    parts.shinR.rotation.x = wSin > 0 ? 0.35 * Math.abs(wSin) : 0;
                }
            }

            // Balancement organique du bras gauche en opposition
            if (parts.armL) {
                parts.armL.rotation.x = 0.1 + wCos * 0.25;
                parts.armL.rotation.z = -0.15 - Math.abs(wSin) * 0.05;
            }

            // Balancement subtil du bras droit et inclinaison du tréfonds de l'épée lourde
            if (parts.armR) {
                parts.armR.rotation.x = 0.2 + wSin * 0.08;
                parts.armR.rotation.z = 0.2 + wCos * 0.03;
            }
            if (parts.swordInfo) {
                parts.swordInfo.rotation.z = wCos * 0.05;
            }

            // Inclinaison latérale du corps et légère torsion (transfert de poids)
            this.boss.mesh.rotation.z = wCos * 0.04;
            this.boss.mesh.rotation.y = THREE.MathUtils.lerp(this.boss.mesh.rotation.y, wSin * 0.06, dt * 8);

            // Oscillation verticale (Poids de la marche : le torse s'abaisse à chaque pas)
            const bobbing = Math.abs(wSin) * 0.12;
            if (parts.body) {
                parts.body.position.y = 1.6 + breathe - bobbing;
                parts.body.scale.set(1 + breathe + bobbing * 0.05, 1 - breathe - bobbing * 0.05, 1 + breathe);
            }

            // Détection de l'impact du pas au sol (quand wSin change de signe)
            if (Math.sign(wSin) !== Math.sign(Math.sin(prevWalkCycle))) {
                // Son lourd étouffé du pas
                if (AudioSys.play) {
                    AudioSys.play('hit', 0.5, 0.6); // pitch bas pour effet de poids
                }

                // Shake caméra si le joueur est proche
                if (Globals.player) {
                    const dist = Globals.player.position.distanceTo(this.boss.position);
                    if (dist < 25 && Globals.cameraShake) {
                        const intensity = (1.0 - dist / 25) * 0.22;
                        Globals.cameraShake.x += (Math.random() - 0.5) * intensity;
                        Globals.cameraShake.y += (Math.random() - 0.5) * intensity;
                        Globals.cameraShake.z += (Math.random() - 0.5) * intensity;
                    }
                }

                // Particules de sable projetées par le pied au sol
                const footPos = this.boss.position.clone();
                const offsetSign = wSin > 0 ? 1 : -1;
                // Décalage du pied
                footPos.x += Math.cos(this.boss.rotation.y + Math.PI/2) * 0.5 * offsetSign;
                footPos.z += Math.sin(this.boss.rotation.y + Math.PI/2) * 0.5 * offsetSign;
                spawnParticles(footPos, 0xc4a47a, 15); // Particules de sable
            }

            // Ondulation de la cape dans le vent de la marche
            if (parts.capeSegments) {
                parts.capeSegments.forEach((seg, i) => {
                    const depth = i % 8;
                    seg.rotation.x = 0.25 + Math.sin(this.walkCycle - depth * 0.4) * 0.12 * (depth + 1);
                });
            }
        } else {
            // Retour à la position neutre fluide (Lerp doux)
            const damp = 4.0 * dt;
            if (parts.legL) parts.legL.rotation.x = THREE.MathUtils.lerp(parts.legL.rotation.x, 0, damp);
            if (parts.shinL) parts.shinL.rotation.x = THREE.MathUtils.lerp(parts.shinL.rotation.x, 0, damp);
            if (parts.legR) parts.legR.rotation.x = THREE.MathUtils.lerp(parts.legR.rotation.x, 0, damp);
            if (parts.shinR) parts.shinR.rotation.x = THREE.MathUtils.lerp(parts.shinR.rotation.x, 0, damp);
            this.boss.mesh.rotation.z = THREE.MathUtils.lerp(this.boss.mesh.rotation.z, 0, damp);
            this.boss.mesh.rotation.y = THREE.MathUtils.lerp(this.boss.mesh.rotation.y, 0, damp);

            if (parts.body) {
                parts.body.position.y = THREE.MathUtils.lerp(parts.body.position.y, 1.6 + breathe, damp);
                parts.body.scale.set(
                    THREE.MathUtils.lerp(parts.body.scale.x, 1 + breathe, damp),
                    THREE.MathUtils.lerp(parts.body.scale.y, 1 - breathe, damp),
                    THREE.MathUtils.lerp(parts.body.scale.z, 1 + breathe, damp)
                );
            }

            // La cape flotte doucement au vent désertique (Idle)
            if (parts.capeSegments) {
                parts.capeSegments.forEach((seg, i) => {
                    const depth = i % 8;
                    const wind = Math.sin(this.animTime * 1.8 + depth * 0.6) * 0.04;
                    seg.rotation.x = THREE.MathUtils.lerp(seg.rotation.x, 0.15 + wind * (depth + 1), damp);
                });
            }
        }
    }

    // --- POSES D'ATTAQUE DÉTAILLÉES (Micro-animations fluides & Tranchant aligné) ---
    updatePoses(dt) {
        const parts = this.boss.parts;
        const state = this.boss.animState;
        const t = this.stateTime;

        // Courbes d'amorti pour des mouvements fluides et organiques
        const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
        const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
        const easeInQuad = (x) => x * x;
        const easeOutQuad = (x) => 1 - (1 - x) * (1 - x);
        const easeInOutQuad = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

        const lerpRot = (obj, axis, val, speed = 10) => {
            if (obj) obj.rotation[axis] = THREE.MathUtils.lerp(obj.rotation[axis], val, dt * speed);
        };
        const lerpPos = (obj, axis, val, speed = 10) => {
            if (obj) obj.position[axis] = THREE.MathUtils.lerp(obj.position[axis], val, dt * speed);
        };

        // Reset positions de bras par défaut si pas en sorts/casting
        if (state !== 'cast_spell') {
            if (parts.armR) lerpPos(parts.armR, 'x', 0.95, 10);
            if (parts.armL) lerpPos(parts.armL, 'x', -0.95, 10);
        }

        if (state === 'idle') {
            lerpRot(parts.armR, 'x', 0.2);
            lerpRot(parts.armR, 'y', 0.0);
            lerpRot(parts.armR, 'z', 0.2);
            
            lerpRot(parts.armL, 'x', 0.1);
            lerpRot(parts.armL, 'y', 0.0);
            lerpRot(parts.armL, 'z', -0.15);
            
            lerpRot(parts.body, 'x', 0);
            lerpRot(parts.body, 'y', 0, 5);
            lerpRot(parts.body, 'z', 0);
            lerpRot(parts.head, 'x', 0);
            if (parts.legR) lerpRot(parts.legR, 'x', 0, 5);

            // Épée au repos : plat de la lame vers l'avant (0 degrés de torsion) - relevée diagonalement
            lerpRot(parts.swordInfo, 'x', Math.PI / 3.5);
            lerpRot(parts.swordInfo, 'y', 0);
            lerpRot(parts.swordInfo, 'z', 0);
        } 
        else if (state === 'windup_cleave') {
            // Succession de micro-animations de charge : le boss monte l'épée en arrière
            // et tourne le torse vers la droite (accumulation d'énergie)
            const progress = Math.min(1.0, t / 0.8);
            const eased = easeInOutCubic(progress);
            
            const armXTarget = THREE.MathUtils.lerp(0.2, -Math.PI / 1.1, eased);
            const armZTarget = THREE.MathUtils.lerp(0.2, 0.6, eased);
            const bodyYTarget = THREE.MathUtils.lerp(0, 0.6, eased);
            const headXTarget = THREE.MathUtils.lerp(0, 0.1, eased);
            
            // Tremblement de charge à la fin du windup
            const tremor = t > 0.4 ? Math.sin(t * 35) * 0.02 : 0;

            lerpRot(parts.armR, 'x', armXTarget + tremor, 12);
            lerpRot(parts.armR, 'y', 0.0, 12);
            lerpRot(parts.armR, 'z', armZTarget, 12);
            
            lerpRot(parts.armL, 'x', 0.2, 8);
            lerpRot(parts.armL, 'z', -0.3, 8);
            
            lerpRot(parts.body, 'y', bodyYTarget, 12);
            lerpRot(parts.body, 'x', -0.1 * eased, 8);
            lerpRot(parts.head, 'x', headXTarget, 8);

            // Torsion progressive de la lame à 90 degrés (tranchant aligné pour couper de droite à gauche)
            const swordYTarget = THREE.MathUtils.lerp(0, Math.PI / 2, eased);
            lerpRot(parts.swordInfo, 'x', Math.PI / 2.8, 12);
            lerpRot(parts.swordInfo, 'y', swordYTarget, 12);
            lerpRot(parts.swordInfo, 'z', -0.3, 12);
        } 
        else if (state === 'strike_cleave') {
            // Attaque très rapide : slash horizontal et torsion du torse vers la gauche
            // puis phase de récupération (décélération) après l'impact
            if (t < 0.15) {
                // Phase active de coupe (0.0s - 0.15s)
                lerpRot(parts.armR, 'x', 0.4, 25);
                lerpRot(parts.armR, 'z', -0.4, 25);
                lerpRot(parts.body, 'y', -0.6, 25);
                lerpRot(parts.body, 'x', 0.1, 20); // Se penche en avant

                // Tranchant maintenu à 90 degrés (coupe propre) - relevé pour éviter le sol
                lerpRot(parts.swordInfo, 'x', Math.PI / 2.8, 25);
                lerpRot(parts.swordInfo, 'y', Math.PI / 2, 25); // 90°
                lerpRot(parts.swordInfo, 'z', 0.25, 25);
            } else {
                // Phase de follow-through / récupération (0.15s - 0.5s)
                const recovery = Math.min(1.0, (t - 0.15) / 0.35);
                const easedRec = easeOutCubic(recovery);
                
                lerpRot(parts.armR, 'x', THREE.MathUtils.lerp(0.4, 0.3, easedRec), 8);
                lerpRot(parts.armR, 'z', THREE.MathUtils.lerp(-0.4, -0.2, easedRec), 8);
                lerpRot(parts.body, 'y', THREE.MathUtils.lerp(-0.6, -0.4, easedRec), 8);
                
                // La lame perd son alignement tranchant et revient vers la pose idle
                const swordYTarget = THREE.MathUtils.lerp(Math.PI / 2, 0, easedRec);
                const swordXTarget = THREE.MathUtils.lerp(Math.PI / 2.8, Math.PI / 3.5, easedRec);
                lerpRot(parts.swordInfo, 'x', swordXTarget, 8);
                lerpRot(parts.swordInfo, 'y', swordYTarget, 8);
                lerpRot(parts.swordInfo, 'z', 0.1, 8);
            }
        } 
        else if (state === 'windup_cleave_2') {
            // Transition fluide et rapide pour le 2ème slash (enchaînement)
            const progress = Math.min(1.0, t / 0.4);
            const eased = easeInOutQuad(progress);
            
            const armXTarget = THREE.MathUtils.lerp(0.3, -Math.PI / 1.2, eased);
            const armZTarget = THREE.MathUtils.lerp(-0.2, -0.4, eased);
            const bodyYTarget = THREE.MathUtils.lerp(-0.4, -0.6, eased);

            const tremor = t > 0.2 ? Math.sin(t * 40) * 0.015 : 0;

            lerpRot(parts.armR, 'x', armXTarget + tremor, 15);
            lerpRot(parts.armR, 'z', armZTarget, 15);
            
            lerpRot(parts.body, 'y', bodyYTarget, 15);

            // Twist rapide de l'épée à -90 degrés (tranchant prêt à couper dans l'autre sens)
            const swordYTarget = THREE.MathUtils.lerp(0, -Math.PI / 2, eased);
            lerpRot(parts.swordInfo, 'x', Math.PI / 2.8, 15);
            lerpRot(parts.swordInfo, 'y', swordYTarget, 15); // -90°
            lerpRot(parts.swordInfo, 'z', -0.2, 15);
        } 
        else if (state === 'strike_cleave_2') {
            // Diagonal slash de gauche à droite
            if (t < 0.15) {
                lerpRot(parts.armR, 'x', 0.5, 25);
                lerpRot(parts.armR, 'z', 0.3, 25);
                lerpRot(parts.body, 'y', 0.5, 25);

                // Tranchant maintenu à -90 degrés
                lerpRot(parts.swordInfo, 'x', Math.PI / 2.8, 25);
                lerpRot(parts.swordInfo, 'y', -Math.PI / 2, 25);
                lerpRot(parts.swordInfo, 'z', 0.15, 25);
            } else {
                const recovery = Math.min(1.0, (t - 0.15) / 0.25);
                const easedRec = easeOutCubic(recovery);
                
                lerpRot(parts.armR, 'x', THREE.MathUtils.lerp(0.5, 0.3, easedRec), 10);
                lerpRot(parts.armR, 'z', THREE.MathUtils.lerp(0.3, 0.2, easedRec), 10);
                lerpRot(parts.body, 'y', THREE.MathUtils.lerp(0.5, 0.1, easedRec), 10);

                // Retour au plat de la lame (0 degrés)
                const swordYTarget = THREE.MathUtils.lerp(-Math.PI / 2, 0, easedRec);
                const swordXTarget = THREE.MathUtils.lerp(Math.PI / 2.8, Math.PI / 3.5, easedRec);
                lerpRot(parts.swordInfo, 'x', swordXTarget, 10);
                lerpRot(parts.swordInfo, 'y', swordYTarget, 10);
                lerpRot(parts.swordInfo, 'z', 0, 10);
            }
        } 
        else if (state === 'cast_spell') {
            // Micro-animation complexe : 
            // 1. Levée d'épée triomphale vers le ciel (0.0s - 0.5s)
            // 2. Levée finale d'incantation et canalisation d'énergie dans les cieux (0.5s+) (plus de plantage dans le sol)
            if (t < 0.5) {
                const progress = t / 0.5;
                const eased = easeInOutQuad(progress);
                
                lerpRot(parts.armR, 'x', THREE.MathUtils.lerp(0.2, -Math.PI / 1.3, eased), 12);
                lerpRot(parts.armR, 'z', THREE.MathUtils.lerp(0.2, -0.2, eased), 12);
                lerpRot(parts.body, 'x', -0.2 * eased, 10); // Penche en arrière
                
                // Lame à plat orientée vers le haut
                lerpRot(parts.swordInfo, 'x', Math.PI / 2.5, 12);
                lerpRot(parts.swordInfo, 'y', 0, 12);
                lerpRot(parts.swordInfo, 'z', 0, 12);
            } 
            else if (t < 0.9) {
                const progress = (t - 0.5) / 0.4;
                const eased = easeInOutCubic(progress);
                
                // Transition douce vers une pose de canalisation élevée vers l'avant/le ciel
                lerpRot(parts.armR, 'x', THREE.MathUtils.lerp(-Math.PI / 1.3, 0.1, eased), 20);
                lerpRot(parts.armR, 'z', THREE.MathUtils.lerp(-0.2, 0.0, eased), 20);
                lerpRot(parts.body, 'x', THREE.MathUtils.lerp(-0.2, 0.1, eased), 15);

                // Garde l'épée inclinée vers le ciel
                lerpRot(parts.swordInfo, 'x', Math.PI / 3, 20);
                lerpRot(parts.swordInfo, 'y', 0, 20);
                lerpRot(parts.swordInfo, 'z', 0, 20);
            } 
            else {
                // Canalisation active : l'épée reste en l'air et vibre d'énergie
                lerpRot(parts.armR, 'x', 0.1, 10);
                lerpRot(parts.armR, 'z', 0.0, 10);
                lerpRot(parts.body, 'x', 0.1, 10);
                
                lerpRot(parts.swordInfo, 'x', Math.PI / 3, 10);
                lerpRot(parts.swordInfo, 'y', 0, 10);
                lerpRot(parts.swordInfo, 'z', 0, 10);

                // Fait trembler le bras et l'épée levée
                const slamShake = Math.sin(this.animTime * 45) * 0.025;
                if (parts.armR) parts.armR.position.x = 0.95 + slamShake;
            }
            
            // Le bras gauche balance en contrepoids
            lerpRot(parts.armL, 'x', 0.2, 8);
            lerpRot(parts.armL, 'z', -0.25, 8);
        }
        else if (state === 'dash_prep') {
            // Pose aérodynamique basse : l'épée est tenue devant comme une pique
            const progress = Math.min(1.0, t / 0.6);
            const eased = easeInOutQuad(progress);
            
            lerpRot(parts.body, 'x', 0.45 * eased, 10);
            lerpRot(parts.head, 'x', -0.25 * eased, 10);
            
            lerpRot(parts.armR, 'x', THREE.MathUtils.lerp(0.2, -Math.PI / 2.2, eased), 10);
            lerpRot(parts.armR, 'y', -0.2 * eased, 10);
            lerpRot(parts.armR, 'z', THREE.MathUtils.lerp(0.2, -0.3, eased), 10);
            
            lerpRot(parts.armL, 'x', THREE.MathUtils.lerp(0.1, -0.5, eased), 10);
            lerpRot(parts.armL, 'z', THREE.MathUtils.lerp(-0.15, -0.1, eased), 10);

            // Épée pointée vers l'avant à 90° (alignement pénétration)
            lerpRot(parts.swordInfo, 'x', Math.PI / 2, 10);
            lerpRot(parts.swordInfo, 'y', Math.PI / 2, 10); // 90°
            lerpRot(parts.swordInfo, 'z', 0.0, 10);
        }
        else if (state === 'dash_stomp') {
            // Lève la jambe droite et l'épée pour écraser violemment à l'arrivée
            if (t < 0.25) {
                // Montée du pied
                const progress = t / 0.25;
                const eased = easeInQuad(progress);
                
                if (parts.legR) lerpRot(parts.legR, 'x', THREE.MathUtils.lerp(0.0, -0.8, eased), 15);
                if (parts.shinR) lerpRot(parts.shinR, 'x', THREE.MathUtils.lerp(0.0, 1.2, eased), 15);
                
                lerpRot(parts.armR, 'x', THREE.MathUtils.lerp(0.1, -Math.PI / 1.5, eased), 15);
                lerpRot(parts.swordInfo, 'x', Math.PI / 2, 15);
                lerpRot(parts.swordInfo, 'y', 0, 15);
            } else {
                // Impact : on s'arrête juste au-dessus du sol pour que l'épée ne pénètre pas le sable
                const recovery = Math.min(1.0, (t - 0.25) / 0.4);
                const easedRec = easeOutCubic(recovery);
                
                if (parts.legR) lerpRot(parts.legR, 'x', THREE.MathUtils.lerp(-0.8, 0.2, easedRec), 20);
                if (parts.shinR) lerpRot(parts.shinR, 'x', THREE.MathUtils.lerp(1.2, 0.0, easedRec), 20);
                
                lerpRot(parts.armR, 'x', THREE.MathUtils.lerp(-Math.PI / 1.5, 0.4, easedRec), 20);
                lerpRot(parts.swordInfo, 'x', Math.PI / 3.2, 20);
                lerpRot(parts.swordInfo, 'y', 0, 20);
            }
        }
        else if (state === 'stunned') {
            lerpRot(parts.head, 'x', 0.7, 10);
            lerpRot(parts.armR, 'x', 0.5, 10);
            lerpRot(parts.armL, 'x', 0.8, 10);
            lerpRot(parts.body, 'x', 0.3, 10);

            // Épée inclinée mais restant au-dessus du sol
            lerpRot(parts.swordInfo, 'x', Math.PI / 3.0, 10);
            lerpRot(parts.swordInfo, 'y', Math.PI / 4, 10);
            lerpRot(parts.swordInfo, 'z', 0.15, 10);
        }
        else if (state === 'dying') {
            lerpRot(parts.head, 'x', 0.8, 4);
            lerpRot(parts.armR, 'x', 0.9, 4);
            lerpRot(parts.armL, 'x', 0.9, 4);
            lerpRot(parts.body, 'x', 0.4, 4);

            // Épée glisse et tombe lentement vers le sol
            lerpRot(parts.swordInfo, 'x', Math.PI / 2, 4);
            lerpRot(parts.swordInfo, 'y', Math.PI / 3, 4);
            lerpRot(parts.swordInfo, 'z', 0.25, 4);
        }
    }
}