// @ts-nocheck
import * as THREE from 'three';

const MINI_BOSS_STYLES: Record<string, { color: number; emissive: number; scale: number; label: string }> = {
  verdant_stalker: { color: 0x1e5631, emissive: 0x27ae60, scale: 1.45, label: 'Traqueur' },
  iron_warden: { color: 0x566573, emissive: 0xbdc3c7, scale: 1.5, label: 'Gardien' },
  arcane_herald: { color: 0x5b2c6f, emissive: 0x9b59b6, scale: 1.45, label: 'Héraut' },
  corrupt_warden: { color: 0x2e1065, emissive: 0xa855f7, scale: 1.55, label: 'Gardien corrompu' },
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createMiniBossLabel(label: string, accent: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 36;
  const ctx = canvas.getContext('2d');

  drawRoundedRect(ctx, 4, 4, 192, 28, 10);
  ctx.fillStyle = 'rgba(6, 8, 12, 0.88)';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = '600 13px Cinzel, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`◆  ${label}`, 100, 18);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sprite.scale.set(2.1, 0.38, 1);
  return sprite;
}

export function applyMiniBossVariant(enemy, miniId: string): void {
  const style = MINI_BOSS_STYLES[miniId] || MINI_BOSS_STYLES.corrupt_warden;
  const accent = `#${style.emissive.toString(16).padStart(6, '0')}`;

  enemy.isMiniBoss = true;
  enemy.miniBossId = miniId;
  enemy._overrideXp = Math.floor(35 * 1.25);
  enemy.hp *= 2.8;
  enemy.maxHp = enemy.hp;
  enemy.speed *= 0.82;
  enemy.scaleVal *= style.scale;
  enemy.radius = 1.35;

  if (enemy.mesh) {
    enemy.mesh.scale.setScalar(enemy.scaleVal);
    enemy.traverse((child) => {
      if (child.isMesh && child.material?.color) {
        child.material = child.material.clone();
        child.material.color.setHex(style.color);
        if (child.material.emissive) {
          child.material.emissive.setHex(style.emissive);
          child.material.emissiveIntensity = 0.35;
        }
      }
    });
  }

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.48, 4),
    new THREE.MeshBasicMaterial({
      color: style.emissive,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.06;
  enemy.add(marker);
  enemy.miniMarker = marker;

  const sprite = createMiniBossLabel(style.label, accent);
  sprite.position.y = enemy.scaleVal * 2.35;
  enemy.add(sprite);
  enemy.nameSprite = sprite;

  const origUpdate = enemy.update?.bind(enemy);
  enemy.update = function updateMini(dt) {
    if (origUpdate) origUpdate(dt);
    if (this.miniMarker) this.miniMarker.rotation.z += dt * 0.8;
    if (this.nameSprite) {
      this.nameSprite.position.y = this.scaleVal * 2.35 + Math.sin(performance.now() * 0.002) * 0.04;
    }
  };
}
