// Diagram renderer: named diagrams or writer inline SVG (already validated by tests).
import { el, svgNode } from '../util.js';
import { NAMED_DIAGRAMS, svgProblems } from '../diagrams/index.js';
import { inline } from './markdown.js';

export function diagramSvg({ name, svg }) {
  if (name && NAMED_DIAGRAMS[name]) return svgNode(NAMED_DIAGRAMS[name].svg());
  if (svg && svgProblems(svg).length === 0) return svgNode(svg);
  return el('div.sim-fallback', null, el('p', null, 'Hình minh hoạ chưa sẵn sàng.'));
}

export function renderDiagram(step) {
  const node = diagramSvg(step);
  const alt = step.alt || (step.name && NAMED_DIAGRAMS[step.name]?.alt) || '';
  if (node.tagName && node.tagName.toLowerCase() === 'svg') {
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', alt);
    node.classList.add('diagram-svg');
  }
  const fig = el('figure.diagram', null, el('div.diagram-stage', null, node));
  if (step.caption) fig.append(el('figcaption', { html: inline(step.caption) }));
  // Hover/tap labels on hotspots for exploration (non-graded).
  const tip = el('div.diagram-tip', { 'aria-live': 'polite' });
  fig.append(tip);
  for (const h of fig.querySelectorAll('[data-hotspot]')) {
    const show = () => { tip.textContent = h.getAttribute('data-label') || ''; };
    h.addEventListener('pointerenter', show);
    h.addEventListener('click', show);
  }
  return { el: fig, destroy() {} };
}
