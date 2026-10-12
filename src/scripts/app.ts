// Author: Ahmad Shaukat
// Client behaviour for ahmadwhosecures.is-a.dev. Loaded once; page-level parts re-run on
// every client-side navigation via astro:page-load. Everything respects reduced motion.
import { initThreatMap } from './threatmap';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const qs = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const qsa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const pageCleanups: Array<() => void> = [];
const onCleanup = (fn: () => void) => pageCleanups.push(fn);

/* ---------------------------------------------------------------- toasts */

export function toast(title: string, body = '') {
  const host = qs('[data-toasts]');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  const strong = document.createElement('strong');
  strong.textContent = title;
  el.appendChild(strong);
  if (body) {
    el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(body));
  }
  host.appendChild(el);
  setTimeout(() => {
    el.setAttribute('data-leaving', '');
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

/* ---------------------------------------------------------------- busy HUD */

const busy = {
  el: null as HTMLElement | null,
  log: null as HTMLElement | null,
  title: null as HTMLElement | null,
  shownAt: 0,
  hideTimer: 0 as number | ReturnType<typeof setTimeout>,
  init() {
    this.el = qs('[data-busy]');
    this.log = qs('[data-busy-log]');
    this.title = qs('[data-busy-title]');
  },
  start(title: string, first: string) {
    if (!this.el || !this.log || !this.title) return;
    clearTimeout(this.hideTimer as number);
    this.log.textContent = '';
    this.title.textContent = title;
    this.el.removeAttribute('data-state');
    this.el.setAttribute('data-show', '');
    this.shownAt = performance.now();
    this.line(first);
  },
  line(text: string, ok = false) {
    if (!this.log) return;
    const li = document.createElement('li');
    li.textContent = '> ' + text + ' ';
    if (ok) {
      const s = document.createElement('span');
      s.className = 'ok';
      s.textContent = '[ok]';
      li.appendChild(s);
    }
    this.log.appendChild(li);
    while (this.log.children.length > 3) this.log.firstElementChild?.remove();
  },
  async done(text: string) {
    if (!this.el || !this.title) return;
    this.line(text, true);
    this.title.textContent = 'LINK SECURE';
    this.el.setAttribute('data-state', 'ok');
    const visibleFor = performance.now() - this.shownAt;
    const hold = Math.max(500, 900 - visibleFor);
    this.hideTimer = setTimeout(() => this.el?.removeAttribute('data-show'), hold);
  },
};

/* ---------------------------------------------------------------- header */

let promptTimer = 0 as number | ReturnType<typeof setInterval>;

function typePrompt(path: string) {
  const el = qs('[data-prompt-cmd]');
  if (!el) return;
  const target = `cd ${path}`;
  clearInterval(promptTimer as number);
  if (reduced()) {
    el.textContent = target;
    return;
  }
  let i = 3;
  el.textContent = 'cd ';
  promptTimer = setInterval(() => {
    i++;
    el.textContent = target.slice(0, i);
    if (i >= target.length) clearInterval(promptTimer as number);
  }, 28);
}

function updateNav(path: string) {
  for (const a of qsa<HTMLAnchorElement>('[data-nav]')) {
    const href = a.getAttribute('href') || '';
    if (path.startsWith(href)) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function initClock() {
  const el = qs('[data-clock]');
  if (!el) return;
  const tick = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    el.textContent = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
  };
  tick();
  setInterval(tick, 1000);
}

function initMenu() {
  const header = qs('[data-header]');
  const btn = qs<HTMLButtonElement>('[data-menu-toggle]');
  if (!header || !btn) return;
  const set = (open: boolean) => {
    if (open) header.setAttribute('data-open', '');
    else header.removeAttribute('data-open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  btn.addEventListener('click', () => set(!header.hasAttribute('data-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.hasAttribute('data-open')) {
      set(false);
      btn.focus();
    }
  });
  document.addEventListener('astro:before-preparation', () => set(false));
  window.matchMedia('(min-width: 861px)').addEventListener('change', (m) => m.matches && set(false));
}

/* ---------------------------------------------------------------- ambient */

function initSpotlight() {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  const bg = qs('.backdrop');
  if (!bg) return;
  let raf = 0;
  let x = 0;
  let y = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        bg.style.setProperty('--spot-x', `${x}px`);
        bg.style.setProperty('--spot-y', `${y}px`);
      });
    },
    { passive: true },
  );
}

function initClickPulse() {
  document.addEventListener('click', (e) => {
    if (reduced()) return;
    const a = (e.target as Element | null)?.closest('a, button');
    if (!a) return;
    const dot = document.createElement('span');
    dot.className = 'click-pulse';
    dot.style.left = `${e.clientX}px`;
    dot.style.top = `${e.clientY}px`;
    document.body.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
    setTimeout(() => dot.remove(), 900);
  });
}

function initOutbound() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!a) return;
    let url: URL;
    try {
      url = new URL(a.href, location.href);
    } catch {
      return;
    }
    if (url.protocol === 'mailto:') {
      toast('Opening mail client', url.pathname);
      return;
    }
    if (url.origin === location.origin) return;
    toast(`Outbound connection: ${url.hostname}`, 'Opened in a new tab over HTTPS.');
  });
}

/* ---------------------------------------------------------------- boot */

const BOOT_LINES: Array<[string, 'ok' | 'warn' | '']> = [
  ['initialising secure session', 'ok'],
  ['loading case files', 'ok'],
  ['verifying TLS 1.3 handshake', 'ok'],
  ['policy: content-security-policy strict', 'ok'],
  ['threat surface monitor online', 'ok'],
  ['welcome, visitor', ''],
];

async function runBoot() {
  const html = document.documentElement;
  if (!html.hasAttribute('data-boot')) return;
  const overlay = qs('[data-boot-overlay]');
  const log = qs('[data-boot-log]');
  if (!overlay || !log) return;
  let skipped = false;
  const finish = () => {
    if (skipped) return;
    skipped = true;
    overlay.setAttribute('data-done', '');
    try {
      sessionStorage.setItem('aw-booted', '1');
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      html.removeAttribute('data-boot');
      overlay.removeAttribute('data-done');
    }, 550);
    window.removeEventListener('keydown', finish);
    window.removeEventListener('pointerdown', finish);
  };
  window.addEventListener('keydown', finish);
  window.addEventListener('pointerdown', finish);
  for (const [text, state] of BOOT_LINES) {
    if (skipped) return;
    const li = document.createElement('li');
    li.textContent = `[ ${(performance.now() / 1000).toFixed(3)} ] ${text} `;
    if (state) {
      const s = document.createElement('span');
      s.className = state;
      s.textContent = state === 'ok' ? '[ok]' : '[!]';
      li.appendChild(s);
    }
    log.appendChild(li);
    await sleep(170);
  }
  await sleep(260);
  finish();
}

/* ---------------------------------------------------------------- page-level */

const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEFX$%&';

function decrypt(el: HTMLElement, delay = 0) {
  const final = el.dataset.text ?? el.textContent ?? '';
  if (reduced()) {
    el.textContent = final;
    return;
  }
  const dur = Math.min(950, 350 + final.length * 22);
  setTimeout(() => {
    const start = performance.now();
    el.setAttribute('data-scrambling', '');
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const shown = Math.floor(t * final.length);
      let out = '';
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        out += i < shown || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(frame);
      else {
        el.textContent = final;
        el.removeAttribute('data-scrambling');
      }
    };
    requestAnimationFrame(frame);
  }, delay);
}

function initDecrypt() {
  const items = qsa('[data-decrypt]');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const idx = items.indexOf(e.target as HTMLElement);
        decrypt(e.target as HTMLElement, idx < 3 ? idx * 140 : 0);
      }
    },
    { threshold: 0.4 },
  );
  items.forEach((el) => io.observe(el));
  onCleanup(() => io.disconnect());
}

function initReveal() {
  const items = qsa('[data-reveal]');
  if (reduced()) {
    items.forEach((el) => el.setAttribute('data-revealed', ''));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.setAttribute('data-revealed', '');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  items.forEach((el) => io.observe(el));
  onCleanup(() => io.disconnect());
}

function initNameMorph() {
  const root = qs('[data-morph]');
  const btn = qs<HTMLButtonElement>('[data-morph-btn]');
  const who = qs('[data-morph-who]');
  const tail = qs('[data-morph-tail]');
  if (!root || !btn || !who || !tail) return;

  const NAME = 'haukat';
  const HANDLE = 'ecures';
  const WHO = 'who';
  const rm = reduced();
  let state: 'name' | 'handle' = 'name';
  let running = false;
  let alive = true;
  let visible = true;
  let timer = 0 as number | ReturnType<typeof setTimeout>;

  const scrambleTo = (el: HTMLElement, target: string, dur: number) =>
    new Promise<void>((resolve) => {
      if (rm) {
        el.textContent = target;
        el.dataset.text = target;
        return resolve();
      }
      const from = el.textContent || '';
      const len = Math.max(from.length, target.length);
      const start = performance.now();
      el.setAttribute('data-scrambling', '');
      const frame = (now: number) => {
        if (!alive) return resolve();
        const t = Math.min(1, (now - start) / dur);
        let out = '';
        for (let i = 0; i < len; i++) {
          const settle = (i + 1) / len;
          if (t >= settle) out += target[i] ?? '';
          else if (t >= settle - 0.5) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
          else out += from[i] ?? '';
        }
        el.textContent = out;
        if (t < 1) requestAnimationFrame(frame);
        else {
          el.textContent = target;
          el.dataset.text = target;
          el.removeAttribute('data-scrambling');
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });

  const typeTo = (el: HTMLElement, target: string, step: number) =>
    new Promise<void>((resolve) => {
      if (rm) {
        el.textContent = target;
        return resolve();
      }
      el.setAttribute('data-typing', '');
      let cur = el.textContent || '';
      const tick = () => {
        if (!alive) return resolve();
        if (!target.startsWith(cur)) cur = cur.slice(0, -1);
        else if (cur.length < target.length) cur = target.slice(0, cur.length + 1);
        else {
          el.removeAttribute('data-typing');
          return resolve();
        }
        el.textContent = cur;
        setTimeout(tick, step);
      };
      tick();
    });

  const go = async (to: 'name' | 'handle') => {
    if (running || to === state) return;
    running = true;
    root.setAttribute('data-state', to === 'handle' ? 'to-handle' : 'to-name');
    if (to === 'handle') {
      await Promise.all([typeTo(who, WHO, 95), scrambleTo(tail, HANDLE, 800)]);
    } else {
      await Promise.all([typeTo(who, '', 70), scrambleTo(tail, NAME, 800)]);
    }
    if (!alive) return;
    state = to;
    root.setAttribute('data-state', to);
    btn.setAttribute('aria-pressed', String(to === 'handle'));
    btn.setAttribute(
      'aria-label',
      to === 'handle' ? 'Show the name: Ahmad Shaukat' : 'Show the handle: ahmad who secures',
    );
    running = false;
  };

  const schedule = (delay?: number) => {
    clearTimeout(timer as number);
    if (rm || !alive) return;
    const wait = delay ?? (state === 'name' ? 2600 : 3400);
    timer = setTimeout(async () => {
      if (visible && !document.hidden) await go(state === 'name' ? 'handle' : 'name');
      schedule();
    }, wait);
  };

  btn.addEventListener('click', async () => {
    clearTimeout(timer as number);
    await go(state === 'name' ? 'handle' : 'name');
    schedule(3800);
  });

  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
  });
  io.observe(root);

  schedule(2600);
  onCleanup(() => {
    alive = false;
    clearTimeout(timer as number);
    io.disconnect();
  });
}

function initTyper() {
  const el = qs('[data-typer]');
  if (!el) return;
  let phrases: string[] = [];
  try {
    phrases = JSON.parse(el.dataset.typer || '[]');
  } catch {
    return;
  }
  if (!phrases.length || reduced()) return;
  let p = 0;
  let i = phrases[0].length;
  let deleting = true;
  let wait = 26;
  let timer = 0 as number | ReturnType<typeof setTimeout>;
  const step = () => {
    const word = phrases[p];
    if (deleting) {
      i--;
      el.textContent = word.slice(0, i);
      if (i <= 0) {
        deleting = false;
        p = (p + 1) % phrases.length;
        wait = 350;
      } else wait = 18;
    } else {
      i++;
      el.textContent = phrases[p].slice(0, i);
      if (i >= phrases[p].length) {
        deleting = true;
        wait = 2600;
      } else wait = 38;
    }
    timer = setTimeout(step, wait);
  };
  timer = setTimeout(step, 2600);
  onCleanup(() => clearTimeout(timer as number));
}

function initThreat() {
  const root = qs('[data-threat]');
  if (!root) return;
  const cleanup = initThreatMap(root, reduced());
  onCleanup(cleanup);
}

function initCodeBlocks() {
  for (const pre of qsa<HTMLPreElement>('.prose pre')) {
    if (pre.parentElement?.classList.contains('codeblock')) continue;
    const lang = pre.dataset.language || 'text';
    const wrap = document.createElement('div');
    wrap.className = 'codeblock';
    const bar = document.createElement('div');
    bar.className = 'codeblock-bar';
    const left = document.createElement('span');
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.innerHTML = '<i></i><i></i><i></i>';
    left.appendChild(dots);
    left.appendChild(document.createTextNode(lang));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'copy';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText);
        btn.textContent = 'copied';
        btn.setAttribute('data-state', 'done');
        toast('Copied to clipboard', `${lang} snippet`);
      } catch {
        btn.textContent = 'press ctrl+c';
      }
      setTimeout(() => {
        btn.textContent = 'copy';
        btn.removeAttribute('data-state');
      }, 1800);
    });
    bar.appendChild(left);
    bar.appendChild(btn);
    pre.replaceWith(wrap);
    wrap.appendChild(bar);
    wrap.appendChild(pre);
  }
}

function initProseLinks() {
  for (const a of qsa<HTMLAnchorElement>('.prose a[href]')) {
    try {
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin && u.protocol.startsWith('http')) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    } catch {
      /* ignore */
    }
  }
}

function initReading() {
  const bar = qs('[data-read-progress]');
  const main = qs('.doc-main');
  if (!bar || !main) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = main.getBoundingClientRect();
    const total = r.height - window.innerHeight * 0.6;
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
    bar.style.setProperty('--read', p.toFixed(4));
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onCleanup(() => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  });
}

function initToc() {
  const heads = qsa('.prose h2[id]');
  const links = qsa<HTMLAnchorElement>('[data-toc] a');
  if (!heads.length || !links.length) return;
  let current = '';
  let raf = 0;
  const update = () => {
    raf = 0;
    const line = window.innerHeight * 0.3;
    let id = '';
    for (const h of heads) {
      if (h.getBoundingClientRect().top <= line) id = h.id;
      else break;
    }
    if (id === current) return;
    current = id;
    for (const a of links) {
      if (id && a.getAttribute('href') === `#${id}`) a.setAttribute('data-active', '');
      else a.removeAttribute('data-active');
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onCleanup(() => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  });
}

/* ---------------------------------------------------------------- lifecycle */

let globalsReady = false;
let firstLoad = true;

function initGlobals() {
  if (globalsReady) return;
  globalsReady = true;
  busy.init();
  initClock();
  initMenu();
  initSpotlight();
  initClickPulse();
  initOutbound();
  runBoot();

  document.addEventListener('astro:before-preparation', (e) => {
    const to = new URL((e as Event & { to: URL }).to);
    if (to.pathname === location.pathname) return;
    qs('[data-nav-progress]')?.setAttribute('data-state', 'loading');
    busy.start('ESTABLISHING LINK', `GET ${to.pathname}`);
  });

  document.addEventListener('astro:after-preparation', () => {
    busy.line('TLS 1.3 session resumed', true);
  });

  document.addEventListener('astro:before-swap', () => {
    while (pageCleanups.length) {
      try {
        pageCleanups.pop()?.();
      } catch {
        /* ignore */
      }
    }
    const beam = qs('[data-scan-beam]');
    if (beam && !reduced()) {
      beam.removeAttribute('data-run');
      void beam.offsetWidth;
      beam.setAttribute('data-run', '');
    }
  });

  document.addEventListener('astro:after-swap', () => {
    // The router replaces <html> attributes; restore the JS marker.
    document.documentElement.setAttribute('data-js', '');
  });
}

document.addEventListener('astro:page-load', () => {
  initGlobals();
  const path = location.pathname;
  updateNav(path);
  typePrompt(path);

  initCodeBlocks();
  initProseLinks();
  initDecrypt();
  initReveal();
  initTyper();
  initNameMorph();
  initThreat();
  initReading();
  initToc();

  if (!firstLoad) {
    busy.done('200 OK, page rendered');
    const bar = qs('[data-nav-progress]');
    bar?.setAttribute('data-state', 'done');
    setTimeout(() => bar?.removeAttribute('data-state'), 700);
  }
  firstLoad = false;
});
