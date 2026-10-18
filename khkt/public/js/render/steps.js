// Step dispatcher: step.type → renderer. Returns { el, destroy(), exercise? }.
import { el } from '../util.js';
import { blocks, inline } from './markdown.js';
import { codeBlock } from './code.js';
import { renderDiagram } from './diagram.js';
import { renderVideo } from './video.js';
import { mountSim } from './sim-host.js';
import { createExercise } from '../exercises/_frame.js';
import { EXERCISE_TYPES } from '../progress/store.js';

export const STEP_TYPES = ['text', 'code', 'diagram', 'video', 'sim', ...EXERCISE_TYPES];

const KIND_ICON = { text: '📘', code: '💻', diagram: '🗺️', video: '🎬', sim: '🎞️' };

export function renderStep(step, ctx = {}) {
  const card = el('article.step-card', { 'data-step-type': step.type });
  const head = step.title ? el('h2.step-title', null, el('span.step-icon', { 'aria-hidden': 'true' }, KIND_ICON[step.type] || '✏️'), step.title) : null;
  if (head) card.append(head);

  if (EXERCISE_TYPES.has(step.type)) {
    const ex = createExercise(step, ctx);
    card.classList.add('is-exercise');
    card.append(ex.el);
    return { el: card, exercise: ex, destroy: () => ex.destroy() };
  }
  switch (step.type) {
    case 'text': {
      card.append(el('div.prose', { html: blocks(step.body) }));
      return { el: card, destroy() {} };
    }
    case 'code': {
      card.append(codeBlock(step));
      if (step.caption) card.append(el('p.caption', { html: inline(step.caption) }));
      return { el: card, destroy() {} };
    }
    case 'diagram': {
      const d = renderDiagram(step);
      card.append(d.el);
      return { el: card, destroy: d.destroy };
    }
    case 'video': {
      const v = renderVideo(step, ctx);
      card.append(v.el);
      return { el: card, destroy: v.destroy };
    }
    case 'sim': {
      const h = mountSim(card, { sim: step.sim, props: step.props, title: step.title, caption: step.caption, captionHtml: inline(step.caption) },
        { autoplay: !ctx.reducedMotion, speed: ctx.store?.prefs?.speed || 1 });
      return { el: card, destroy: () => h.destroy(), sim: h };
    }
    default:
      card.append(el('p.ex-error', null, `Loại bước chưa hỗ trợ: ${step.type}`));
      return { el: card, destroy() {} };
  }
}
