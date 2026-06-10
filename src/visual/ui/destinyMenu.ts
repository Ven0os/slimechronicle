import type { ClassId } from '@/data/constellations';
import { formatDestinySkillDetailHtml, type AbilityKey } from '@/data/classStatsConfig';

const ABILITY_BY_KEY_LABEL: Record<string, AbilityKey> = {
  Espace: 'space',
  Shift: 'shift',
  E: 'e',
};

function getClassIdFromCard(card: Element): ClassId | null {
  const onclick = card.getAttribute('onclick') || '';
  const match = onclick.match(/selectClass\('([^']+)'/);
  return (match?.[1] as ClassId) || null;
}

function closeSkillItem(item: Element): void {
  item.classList.remove('skill-item--open');
  item.setAttribute('aria-expanded', 'false');
  const panel = item.querySelector('.skill-scaling-panel');
  if (panel) panel.remove();
}

function openSkillItem(item: Element, classId: ClassId, ability: AbilityKey): void {
  closeSkillItem(item);
  item.classList.add('skill-item--open');
  item.setAttribute('aria-expanded', 'true');

  const panel = document.createElement('div');
  panel.className = 'skill-scaling-panel';
  panel.innerHTML = formatDestinySkillDetailHtml(classId, ability);
  item.appendChild(panel);
}

export function initDestinySkillPanels(): void {
  document.querySelectorAll('.class-card-accordion').forEach((card) => {
    const classId = getClassIdFromCard(card);
    if (!classId) return;

    card.querySelectorAll('.skill-item').forEach((item) => {
      if (item.classList.contains('skill-item--bound')) return;
      item.classList.add('skill-item--bound', 'skill-item--expandable');

      const keyLabel = item.querySelector('.skill-key')?.textContent?.trim() || '';
      const ability = ABILITY_BY_KEY_LABEL[keyLabel];
      if (!ability) return;

      const toggle = (e: Event) => {
        e.stopPropagation();
        const wasOpen = item.classList.contains('skill-item--open');
        card.querySelectorAll('.skill-item--open').forEach((open) => closeSkillItem(open));
        if (!wasOpen) openSkillItem(item, classId, ability);
      };

      item.addEventListener('click', toggle);
      item.addEventListener('keydown', (e) => {
        if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          toggle(e);
        }
      });
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-expanded', 'false');
    });
  });
}
