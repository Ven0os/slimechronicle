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
