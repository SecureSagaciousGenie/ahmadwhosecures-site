// Author: Ahmad Shaukat
// Client behaviour for the whole site. Each feature looks for its own markup and returns if it
// is absent, and every page stays usable with this script blocked: content, navigation and the
// evidence trail all work without it.
import { evaluate, type Scenario } from '../lib/signin';
import { renderResult, summarise } from '../lib/signin-render';
import { mountArt } from './art';

const qs = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const qsa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Run a handler at most once per animation frame. */
const perFrame = (fn: () => void) => {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
};

function initHeader() {
  const header = qs('[data-header]');
  if (!header) return;
  const update = perFrame(() => header.toggleAttribute('data-scrolled', window.scrollY > 8));
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function initTheme() {
  const btn = qs<HTMLButtonElement>('[data-theme-toggle]');
  if (!btn) return;
  const root = document.documentElement;
  const meta = qs<HTMLMetaElement>('meta[name="theme-color"]');
  const sync = () => {
    const light = root.dataset.theme === 'light';
    btn.setAttribute('aria-pressed', String(light));
    btn.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    meta?.setAttribute('content', light ? '#f3f5f8' : '#0a0f17');
  };
  btn.hidden = false;
  sync();
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    const apply = () => {
      if (next === 'light') root.dataset.theme = 'light';
      else root.removeAttribute('data-theme');
      try {
        localStorage.setItem('aw-theme', next);
      } catch {
        /* storage blocked: the choice lasts for this page only */
      }
      sync();
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !reducedMotion()) doc.startViewTransition(apply);
    else apply();
  });
}

function initMorph() {
  const hn = qs('[data-morph]');
  if (!hn) return;
  const HOLD = 1800;
  const FLIP = 750;
  let state: 'handle' | 'name' = 'handle';
  let hovering = false;
  let visible = true;
  let timer = 0;

  const measure = () => {
    hn.setAttribute('data-measuring', '');
    const size = parseFloat(getComputedStyle(hn).fontSize) || 16;
    for (const slot of qsa('.fl', hn)) {
      const a = qs('.fl-a', slot)?.getBoundingClientRect().width ?? 0;
      const b = qs('.fl-b', slot)?.getBoundingClientRect().width ?? 0;
      slot.style.setProperty('--wa', `${(a / size).toFixed(4)}em`);
      slot.style.setProperty('--wb', `${(b / size).toFixed(4)}em`);
    }
    const who = qs('.hn-who > span', hn)?.getBoundingClientRect().width ?? 0;
    hn.style.setProperty('--who-w', `${(who / size).toFixed(4)}em`);
    hn.removeAttribute('data-measuring');
    void hn.offsetWidth;
    hn.setAttribute('data-ready', '');
  };

  const flip = () => {
    state = state === 'handle' ? 'name' : 'handle';
    hn.dataset.state = state;
  };

  const schedule = () => {
    window.clearTimeout(timer);
    if (reducedMotion()) return;
    timer = window.setTimeout(() => {
      if (!hovering && visible && !document.hidden) flip();
      schedule();
    }, HOLD + FLIP);
  };

  hn.addEventListener('click', () => {
    flip();
    schedule();
  });
  hn.addEventListener('pointerenter', () => (hovering = true));
  hn.addEventListener('pointerleave', () => (hovering = false));
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(hn);

  const start = () => {
    measure();
    schedule();
  };
  if (document.fonts?.ready) document.fonts.ready.then(start, start);
  else start();
}

function initTrail() {
  const trail = qs('[data-trail]');
  if (!trail || reducedMotion()) return;
  const radios = qsa<HTMLInputElement>('input[name="trail-req"]', trail);
  if (radios.length < 2) return;

  // A timer owns the timing; the progress bar in CSS only shows it. Both pause together
  // through data-paused, so the bar never runs ahead of the switch or behind it.
  const DWELL = 7000;
  let remaining = DWELL;
  let startedAt = 0;
  let timer = 0;
  const holds = { hover: false, focus: false, offscreen: false, hidden: document.hidden };

  const advance = () => {
    const i = radios.findIndex((r) => r.checked);
    radios[(i + 1) % radios.length].checked = true;
    remaining = DWELL;
    run();
  };
  const run = () => {
    window.clearTimeout(timer);
    startedAt = performance.now();
    timer = window.setTimeout(advance, remaining);
  };
  const sync = () => {
    if (trail.dataset.autoplay !== 'on') return;
    const paused = Object.values(holds).some(Boolean);
    const was = trail.hasAttribute('data-paused');
    trail.toggleAttribute('data-paused', paused);
    if (paused && !was) {
      window.clearTimeout(timer);
      remaining = Math.max(0, remaining - (performance.now() - startedAt));
    } else if (!paused && was) run();
  };

  trail.style.setProperty('--dwell', `${DWELL}ms`);
  trail.dataset.autoplay = 'on';
  run();
  sync();

  // A choice made by the visitor ends autoplay; programmatic changes fire no event.
  for (const r of radios) {
    r.addEventListener('change', () => {
      trail.dataset.autoplay = 'off';
      trail.removeAttribute('data-paused');
      window.clearTimeout(timer);
    });
  }
  const hold = (key: keyof typeof holds, on: boolean) => {
    holds[key] = on;
    sync();
  };
  trail.addEventListener('pointerenter', () => hold('hover', true));
  trail.addEventListener('pointerleave', () => hold('hover', false));
  trail.addEventListener('focusin', () => hold('focus', true));
  trail.addEventListener('focusout', (e) => {
    if (!trail.contains(e.relatedTarget as Node | null)) hold('focus', false);
  });
  new IntersectionObserver(([entry]) => hold('offscreen', !entry.isIntersecting)).observe(trail);
  document.addEventListener('visibilitychange', () => hold('hidden', document.hidden));
}

function initArt() {
  for (const host of qsa('[data-art]')) mountArt(host);
}

function initLab() {
  const visual = qs('[data-lab]');
  const lab = visual && qs('.lab', visual);
  const ticker = qs('.ticker');
  // Animations stop while their part of the page is off screen.
  const watch = (el: Element | null) => {
    if (!el) return;
    new IntersectionObserver(([entry]) => el.toggleAttribute('data-paused', !entry.isIntersecting)).observe(el);
  };
  watch(lab);
  watch(ticker);

  const hero = qs('.hero');
  if (!visual || !hero || reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
  let lx = 0;
  let ly = 0;
  const apply = perFrame(() => {
    visual.style.setProperty('--lx', lx.toFixed(3));
    visual.style.setProperty('--ly', ly.toFixed(3));
  });
  hero.addEventListener(
    'pointermove',
    (e) => {
      const r = hero.getBoundingClientRect();
      lx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ly = ((e.clientY - r.top) / r.height) * 2 - 1;
      apply();
    },
    { passive: true },
  );
  hero.addEventListener('pointerleave', () => {
    lx = 0;
    ly = 0;
    apply();
  });
}

function initSim() {
  const sim = qs('[data-sim]');
  const out = sim && qs('[data-sim-out]', sim);
  const live = sim && qs('[data-sim-live]', sim);
  if (!sim || !out) return;
  const value = (name: string) => qs<HTMLInputElement>(`input[name="sim-${name}"]:checked`, sim)?.value ?? '';

  sim.addEventListener('change', () => {
    const scenario = {
      person: value('person'),
      place: value('place'),
      device: value('device'),
      app: value('app'),
      risk: value('risk'),
      mode: value('mode'),
    } as Scenario;
    const keepOpen = qs<HTMLDetailsElement>('details', out)?.open ?? false;
    const result = evaluate(scenario);
    out.innerHTML = renderResult(result);
    if (keepOpen) qs<HTMLDetailsElement>('details', out)?.setAttribute('open', '');
    if (live) live.textContent = summarise(result);
  });
}

function initPalette() {
  const dialog = qs<HTMLDialogElement>('[data-palette]');
  const openBtn = qs<HTMLButtonElement>('[data-palette-open]');
  if (!dialog || !openBtn || typeof dialog.showModal !== 'function') return;
  const input = qs<HTMLInputElement>('[data-palette-input]', dialog);
  const empty = qs('[data-palette-empty]', dialog);
  const items = qsa<HTMLAnchorElement>('[data-palette-item]', dialog);
  if (!input || !empty) return;

  if (/Mac|iPhone|iPad/.test(navigator.platform)) {
    const kbd = qs('[data-palette-kbd]', openBtn);
    if (kbd) kbd.textContent = '⌘ K';
  }
  openBtn.hidden = false;

  let shown = items;
  let active = 0;

  const paint = () => {
    for (const a of items) a.removeAttribute('data-active');
    const current = shown[active];
    if (current) {
      current.setAttribute('data-active', '');
      current.setAttribute('aria-selected', 'true');
      current.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', current.id);
    } else input.removeAttribute('aria-activedescendant');
    for (const a of items) if (a !== current) a.removeAttribute('aria-selected');
  };

  const filter = () => {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    shown = [];
    for (const a of items) {
      const text = a.dataset.text ?? '';
      const match = terms.every((t) => text.includes(t));
      (a.parentElement as HTMLElement).hidden = !match;
      if (match) shown.push(a);
    }
    empty.hidden = shown.length > 0;
    active = 0;
    paint();
  };

  const open = () => {
    input.value = '';
    filter();
    dialog.showModal();
    input.focus();
  };

  const typing = (t: EventTarget | null) =>
    t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

  openBtn.addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    } else if (e.key === '/' && !dialog.open && !typing(e.target)) {
      e.preventDefault();
      open();
    }
  });
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, shown.length - 1);
      paint();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      paint();
    } else if (e.key === 'Enter' && shown[active]) {
      e.preventDefault();
      window.location.href = shown[active].href;
    }
  });
  for (const a of items) {
    a.addEventListener('pointermove', () => {
      const i = shown.indexOf(a);
      if (i >= 0 && i !== active) {
        active = i;
        paint();
      }
    });
  }
  // A click on the backdrop lands on the dialog element itself.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

function initGlow() {
  document.addEventListener(
    'pointermove',
    (e) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-glow]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    },
    { passive: true },
  );
}

function initReading() {
  const bar = qs('[data-read-progress]');
  const article = qs('.prose');
  if (bar && article) {
    const update = perFrame(() => {
      const r = article.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight * 0.55);
      const p = Math.min(1, Math.max(0, -r.top / span));
      bar.style.setProperty('--p', p.toFixed(4));
    });
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  const links = qsa<HTMLAnchorElement>('[data-toc] a');
  if (!links.length) return;
  const byHeading = new Map<HTMLElement, HTMLAnchorElement[]>();
  for (const a of links) {
    const heading = document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!heading) continue;
    byHeading.set(heading, [...(byHeading.get(heading) ?? []), a]);
  }
  const headings = [...byHeading.keys()];
  const spy = perFrame(() => {
    let current = headings[0];
    for (const h of headings) if (h.getBoundingClientRect().top < 150) current = h;
    for (const a of links) a.removeAttribute('aria-current');
    for (const a of byHeading.get(current) ?? []) a.setAttribute('aria-current', 'true');
  });
  spy();
  window.addEventListener('scroll', spy, { passive: true });
}

function initCopy() {
  for (const pre of qsa('.prose pre')) {
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode?.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy this code');
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.textContent ?? '');
        btn.textContent = 'Copied';
        btn.setAttribute('data-done', '');
      } catch {
        // Clipboard refused: select the code so Ctrl+C works.
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        btn.textContent = 'Selected';
      }
      window.setTimeout(() => {
        btn.textContent = 'Copy';
        btn.removeAttribute('data-done');
      }, 1800);
    });
    wrap.appendChild(btn);
  }
}

initHeader();
initTheme();
initMorph();
initTrail();
initArt();
initLab();
initSim();
initPalette();
initGlow();
initReading();
initCopy();
