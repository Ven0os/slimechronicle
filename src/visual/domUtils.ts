/**
 * Écrit `html` dans l'élément seulement si le contenu a changé depuis le dernier appel.
 * Évite le coût de re-parse/re-layout d'un innerHTML identique écrit à chaque frame.
 */
export function setHtmlIfChanged(el: HTMLElement, html: string): void {
  const cache = el as HTMLElement & { _lastHtml?: string };
  if (cache._lastHtml === html) return;
  cache._lastHtml = html;
  el.innerHTML = html;
}

/**
 * Même principe pour `style.display`, écrit à chaque frame par plusieurs panneaux de HUD
 * alors qu'il ne change qu'à de rares transitions.
 */
export function setDisplayIfChanged(el: HTMLElement, display: string): void {
  const cache = el as HTMLElement & { _lastDisplay?: string };
  if (cache._lastDisplay === display) return;
  cache._lastDisplay = display;
  el.style.display = display;
}

const elementCache = new Map<string, HTMLElement | null>();

/**
 * `getElementById` mis en cache pour les éléments de HUD relus à chaque frame.
 * La référence est réévaluée si l'élément a quitté le document, ce qui couvre les écrans
 * reconstruits entre deux parties.
 */
export function getCachedElement(id: string): HTMLElement | null {
  const cached = elementCache.get(id);
  if (cached && cached.isConnected) return cached;
  const el = document.getElementById(id);
  elementCache.set(id, el);
  return el;
}
