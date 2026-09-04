/**
 * Interpolation exponentielle stable quel que soit le framerate.
 *
 * `lerp(a, b, dt * k)` n'est correct qu'à un framerate donné : le facteur dépasse 1
 * dès que dt > 1/k (soit ~15 FPS pour k = 15), ce qui fait dépasser la cible puis osciller.
 * `damp` applique le même rapprochement mais avec un facteur borné à [0, 1[.
 *
 * `k` garde la même signification qu'avant (vitesse de rapprochement par seconde),
 * les valeurs de réglage existantes restent donc valables.
 */
export function dampFactor(k: number, dt: number): number {
  return 1 - Math.exp(-k * dt);
}

/** Rapproche `current` de `target` à la vitesse `k` par seconde. */
export function damp(current: number, target: number, k: number, dt: number): number {
  return current + (target - current) * dampFactor(k, dt);
}

/** Variante angulaire : suit le plus court chemin sur le cercle. */
export function dampAngle(current: number, target: number, k: number, dt: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * dampFactor(k, dt);
}
