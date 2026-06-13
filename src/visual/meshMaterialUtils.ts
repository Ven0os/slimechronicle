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
  const originalValues = new Map();

  // First pass: collect original values for all unique materials before we modify any of them
  applyToMeshMaterials(root, (mat, mesh) => {
    if (!originalValues.has(mat)) {
      const stored = mesh.userData[storageKey];
      if (stored !== undefined) {
        originalValues.set(mat, stored);
      } else {
        if (mat.emissive && typeof mat.emissive.getHex === 'function') {
          const hex = mat.emissive.getHex();
          originalValues.set(mat, { type: 'emissive', hex: hex === flashHex ? 0x000000 : hex });
        } else if (mat.color && typeof mat.color.getHex === 'function') {
          const hex = mat.color.getHex();
          originalValues.set(mat, { type: 'color', hex: hex === flashHex ? 0x000000 : hex });
        }
      }
    }
  });

  // Second pass: apply the flash and ensure every mesh's userData has the original value stored
  applyToMeshMaterials(root, (mat, mesh) => {
    const orig = originalValues.get(mat);
    if (orig && mesh.userData[storageKey] === undefined) {
      mesh.userData[storageKey] = orig;
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
    delete mesh.userData[storageKey];
  });
}

export function safeMaterialSetHex(mat, hex, { emissive = true, color = true } = {}) {
  if (!mat) return false;
  if (emissive && safeSetHex(mat.emissive, hex)) return true;
  if (color && safeSetHex(mat.color, hex)) return true;
  return false;
}
