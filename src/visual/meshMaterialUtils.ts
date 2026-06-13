// @ts-nocheck
/** Helpers sûrs pour modifier couleur / emissive sur meshes Three.js. */

export function normalizeMaterials(material) {
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

export function safeSetHex(colorLike, hex) {
  if (!colorLike || typeof colorLike.setHex !== 'function') return false;
  colorLike.setHex(hex);
  return true;
}

export function applyToMeshMaterials(root, callback) {
  if (!root || typeof root.traverse !== 'function') return;
  root.traverse((obj) => {
    if (!obj?.isMesh) return;
    for (const mat of normalizeMaterials(obj.material)) {
      if (!mat) continue;
      try {
        callback(mat, obj);
      } catch (_) {
        /* matériau non modifiable — ignorer */
      }
    }
  });
}

/** Flash blanc : emissive si disponible, sinon color. */
export function flashMeshDamage(root, flashHex = 0xffffff, storageKey = 'damageFlashStored') {
  applyToMeshMaterials(root, (mat, mesh) => {
    const store = mesh.userData;
    if (store[storageKey] === undefined) {
      if (mat.emissive && typeof mat.emissive.getHex === 'function') {
        const hex = mat.emissive.getHex();
        store[storageKey] = { type: 'emissive', hex: hex === flashHex ? 0x000000 : hex };
      } else if (mat.color && typeof mat.color.getHex === 'function') {
        const hex = mat.color.getHex();
        store[storageKey] = { type: 'color', hex: hex === flashHex ? 0x000000 : hex };
      } else {
        return;
      }
    }
    if (mat.emissive && typeof mat.emissive.setHex === 'function') {
      mat.emissive.setHex(flashHex);
    } else {
      safeSetHex(mat.color, flashHex);
    }
  });
}

export function restoreMeshDamageFlash(root, storageKey = 'damageFlashStored') {
  if (!root) return;
  applyToMeshMaterials(root, (mat, mesh) => {
    const stored = mesh.userData[storageKey];
    if (!stored) return;
    if (stored.type === 'emissive') {
      safeSetHex(mat.emissive, stored.hex);
    } else if (stored.type === 'color') {
      safeSetHex(mat.color, stored.hex);
    }
  });
}

export function safeMaterialSetHex(mat, hex, { emissive = true, color = true } = {}) {
  if (!mat) return false;
  if (emissive && safeSetHex(mat.emissive, hex)) return true;
  if (color && safeSetHex(mat.color, hex)) return true;
  return false;
}
