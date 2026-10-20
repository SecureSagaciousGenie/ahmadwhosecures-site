// Author: Ahmad Shaukat
// Background art for the hero and the inner page heads: a shield drawn as a node mesh, a
// network field around it and circuit traces leading out, with signal pulses running along the
// traces and a slow shield-shaped scan ring. Original artwork generated in the browser, so it
// costs no image download, follows the theme, and the same seed always draws the same picture.
// Purely decorative: the host element is aria-hidden and the page reads the same without it.

type Theme = 'dark' | 'light';
type Variant = 'hero' | 'page';
type Pt = { x: number; y: number };

interface Palette {
  line: string;
  node: string;
  amber: string;
  glow: string;
  blob: string;
  blobAmber: string;
  blend: GlobalCompositeOperation;
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    line: '92, 170, 255',
    node: '214, 236, 255',
    amber: '242, 179, 61',
    glow: 'rgba(70, 180, 255, 0.85)',
    blob: 'rgba(40, 120, 255, 0.17)',
    blobAmber: 'rgba(242, 179, 61, 0.07)',
    blend: 'lighter',
  },
  light: {
    line: '36, 87, 184',
    node: '28, 66, 138',
    amber: '168, 112, 15',
    glow: '',
    blob: 'rgba(36, 87, 184, 0.07)',
    blobAmber: 'rgba(226, 160, 33, 0.07)',
    blend: 'source-over',
  },
};

interface Trace {
  pts: Pt[];
  len: number;
  period: number;
  phase: number;
  amber: boolean;
}

interface Scene {
  w: number;
  h: number;
  focus: Pt;
  R: number;
  outline: Pt[];
  mesh: [Pt, Pt][];
  meshNodes: { p: Pt; amber: boolean }[];
  field: Pt[];
  fieldEdges: [Pt, Pt, number][];
  traces: Trace[];
  dust: { p: Pt; r: number; a: number; amber: boolean }[];
  locks: { p: Pt; s: number; amber: boolean }[];
  pixels: { p: Pt; s: number; a: number; amber: boolean }[];
  bokeh: { p: Pt; r: number; a: number; amber: boolean }[];
}

/** Small seeded generator, so the composition is stable between visits. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** A heater shield: shoulders, straight sides, then a curve into the point. Closed loop. */
function shieldOutline(c: Pt, R: number): Pt[] {
  const hw = R * 0.84;
  const right: Pt[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    right.push({ x: c.x + hw * t, y: c.y - R + R * 0.26 * t * t });
  }
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    right.push({ x: c.x + hw, y: c.y - R * 0.74 + R * 0.79 * t });
  }
  const a = { x: c.x + hw, y: c.y + R * 0.05 };
  const k = { x: c.x + hw, y: c.y + R * 0.62 };
  const b = { x: c.x, y: c.y + R };
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const u = 1 - t;
    right.push({ x: u * u * a.x + 2 * u * t * k.x + t * t * b.x, y: u * u * a.y + 2 * u * t * k.y + t * t * b.y });
  }
  const left = right
    .slice(1, -1)
    .reverse()
    .map((p) => ({ x: 2 * c.x - p.x, y: p.y }));
  return [...right, ...left];
}

function inside(p: Pt, poly: Pt[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

const scaleAbout = (poly: Pt[], c: Pt, s: number) => poly.map((p) => ({ x: c.x + (p.x - c.x) * s, y: c.y + (p.y - c.y) * s }));

function buildScene(variant: Variant, w: number, h: number, focus: Pt, R: number): Scene {
  const rand = seeded(variant === 'hero' ? 20261012 : 20261019);
  const outline = shieldOutline(focus, R);

  // Shield mesh: outline ring plus a jittered grid inside, each point tied to its nearest neighbours.
  const step = R / 3.1;
  const innerPts: Pt[] = [];
  const core = scaleAbout(outline, focus, 0.9);
  for (let y = focus.y - R; y <= focus.y + R; y += step) {
    for (let x = focus.x - R; x <= focus.x + R; x += step) {
      const p = { x: x + (rand() - 0.5) * step * 0.7, y: y + (rand() - 0.5) * step * 0.7 };
      if (inside(p, core)) innerPts.push(p);
    }
  }
  const ring = outline.filter((_, i) => i % 1 === 0);
  const all = [...ring, ...innerPts];
  const seen = new Set<string>();
  const mesh: [Pt, Pt][] = [];
  const link = (a: Pt, b: Pt) => {
    const key = [a.x, a.y, b.x, b.y].map((n) => n.toFixed(1)).sort().join('|');
    if (!seen.has(key)) {
      seen.add(key);
      mesh.push([a, b]);
    }
  };
  for (let i = 0; i < ring.length; i++) link(ring[i], ring[(i + 1) % ring.length]);
  for (const p of innerPts) {
    all
      .filter((q) => q !== p)
      .sort((a, b) => dist(p, a) - dist(p, b))
      .slice(0, 3)
      .forEach((q) => link(p, q));
  }
  const meshNodes = all.map((p) => ({ p, amber: rand() < 0.08 }));

  // Network field around the shield, denser near it.
  const count = variant === 'hero' ? 150 : 70;
  const reach = Math.max(w, h) * (variant === 'hero' ? 0.85 : 0.7);
  const keepOut = scaleAbout(outline, focus, 1.12);
  const field: Pt[] = [];
  for (let tries = 0; field.length < count && tries < count * 20; tries++) {
    const ang = rand() * Math.PI * 2;
    const r = R * 1.1 + Math.pow(rand(), 0.85) * reach;
    const p = { x: focus.x + Math.cos(ang) * r * 1.25, y: focus.y + Math.sin(ang) * r };
    if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40 || inside(p, keepOut)) continue;
    field.push(p);
  }
  const reachEdge = R * 0.62;
  const fieldEdges: [Pt, Pt, number][] = [];
  for (let i = 0; i < field.length; i++) {
    for (let j = i + 1; j < field.length; j++) {
      const d = dist(field[i], field[j]);
      if (d < reachEdge) fieldEdges.push([field[i], field[j], 1 - d / reachEdge]);
    }
  }

  // Circuit traces leaving the shield: straight, a 45 degree bend, straight, then a pad.
  const traces: Trace[] = [];
  const tCount = variant === 'hero' ? 18 : 9;
  for (let i = 0; i < tCount; i++) {
    const start = outline[Math.floor(((i + rand() * 0.6) / tCount) * outline.length) % outline.length];
    const v = { x: start.x - focus.x, y: start.y - focus.y };
    const horiz = Math.abs(v.x) > Math.abs(v.y) * 0.9;
    const dir = horiz ? { x: Math.sign(v.x) || 1, y: 0 } : { x: 0, y: Math.sign(v.y) || 1 };
    const perp = horiz ? { x: 0, y: rand() < 0.5 ? -1 : 1 } : { x: rand() < 0.5 ? -1 : 1, y: 0 };
    const l1 = R * (0.1 + rand() * 0.26);
    const l2 = R * (0.08 + rand() * 0.2);
    const l3 = R * (0.22 + rand() * 0.6);
    const p0 = { x: start.x + dir.x * R * 0.04, y: start.y + dir.y * R * 0.04 };
    const p1 = { x: p0.x + dir.x * l1, y: p0.y + dir.y * l1 };
    const p2 = { x: p1.x + ((dir.x + perp.x) * l2) / Math.SQRT2, y: p1.y + ((dir.y + perp.y) * l2) / Math.SQRT2 };
    const p3 = { x: p2.x + dir.x * l3, y: p2.y + dir.y * l3 };
    const pts = [p0, p1, p2, p3];
    const len = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);
    traces.push({ pts, len, period: 2.6 + rand() * 3.2, phase: rand() * 6, amber: rand() < 0.22 });
  }

  // Dust: faint points of light, mostly around the focus.
  const dustCount = variant === 'hero' ? 320 : 130;
  const dust: Scene['dust'] = [];
  for (let i = 0; i < dustCount; i++) {
    const ang = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.6) * reach * 1.1;
    const p = { x: focus.x + Math.cos(ang) * r * 1.3, y: focus.y + Math.sin(ang) * r };
    if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
    dust.push({ p, r: 0.4 + rand() * 1.3, a: 0.08 + rand() * 0.55, amber: rand() < 0.08 });
  }

  // Padlocks on a few network nodes away from the shield.
  const locks = field
    .filter((p) => dist(p, focus) > R * 1.6 && p.x > w * (variant === 'hero' ? 0.62 : 0.55))
    .sort(() => rand() - 0.5)
    .slice(0, variant === 'hero' ? 6 : 3)
    .map((p) => ({ p, s: 0.85 + rand() * 0.5, amber: rand() < 0.3 }));

  // The shield's right edge dissolving into square particles.
  const edge = outline.filter((p) => p.x > focus.x + R * 0.25);
  const pixels: Scene['pixels'] = [];
  const pixCount = variant === 'hero' ? 260 : 120;
  for (let i = 0; i < pixCount && edge.length; i++) {
    const from = edge[Math.floor(rand() * edge.length)];
    const k = Math.pow(rand(), 1.7);
    const p = { x: from.x + k * R * 1.9 + rand() * R * 0.08, y: from.y + (rand() - 0.5) * R * (0.25 + k * 0.9) };
    if (p.x > w || p.y < 0 || p.y > h) continue;
    pixels.push({ p, s: (1 - k) * 2.6 + 0.6, a: (1 - k) * 0.85 + 0.08, amber: rand() < 0.1 });
  }

  // Out-of-focus lights for depth.
  const bokeh: Scene['bokeh'] = [];
  for (let i = 0; i < (variant === 'hero' ? 12 : 6); i++) {
    const ang = rand() * Math.PI * 2;
    const r = R * (0.9 + rand() * 2.4);
    bokeh.push({
      p: { x: focus.x + Math.cos(ang) * r * 1.2, y: focus.y + Math.sin(ang) * r * 0.8 },
      r: R * (0.05 + rand() * 0.15),
      a: 0.05 + rand() * 0.11,
      amber: rand() < 0.3,
    });
  }

  return { w, h, focus, R, outline, mesh, meshNodes, field, fieldEdges, traces, dust, locks, pixels, bokeh };
}

/** A small padlock: shackle arc over a body with a keyhole. */
function drawLock(ctx: CanvasRenderingContext2D, c: Pt, scale: number, rgb: string) {
  const bw = 11 * scale;
  const bh = 8.5 * scale;
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = `rgba(${rgb}, 0.95)`;
  ctx.fillStyle = `rgba(${rgb}, 0.14)`;
  ctx.beginPath();
  ctx.arc(c.x, c.y - bh * 0.42, bw * 0.3, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(c.x - bw / 2, c.y - bh * 0.42, bw, bh);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = `rgba(${rgb}, 0.95)`;
  ctx.beginPath();
  ctx.arc(c.x, c.y + bh * 0.05, 1.3 * scale, 0, Math.PI * 2);
  ctx.fill();
}

/** A keyhole at the heart of the shield. */
function drawKeyhole(ctx: CanvasRenderingContext2D, f: Pt, R: number, rgb: string) {
  const top = f.y - R * 0.12;
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = `rgba(${rgb}, 0.95)`;
  ctx.fillStyle = `rgba(${rgb}, 0.12)`;
  ctx.beginPath();
  ctx.arc(f.x, top, R * 0.13, Math.PI * 0.72, Math.PI * 2.28);
  ctx.lineTo(f.x + R * 0.11, f.y + R * 0.26);
  ctx.lineTo(f.x - R * 0.11, f.y + R * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function pathPoly(ctx: CanvasRenderingContext2D, pts: Pt[], close = false) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}

function drawStatic(ctx: CanvasRenderingContext2D, s: Scene, pal: Palette, dpr: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { focus: f, R } = s;

  const blob = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R * 2.9);
  blob.addColorStop(0, pal.blob);
  blob.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, s.w, s.h);
  const warm = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, R * 1.15);
  warm.addColorStop(0, pal.blobAmber);
  warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, s.w, s.h);

  ctx.globalCompositeOperation = pal.blend;

  for (const b of s.bokeh) {
    const g = ctx.createRadialGradient(b.p.x, b.p.y, 0, b.p.x, b.p.y, b.r);
    const rgb = b.amber ? pal.amber : pal.line;
    g.addColorStop(0, `rgba(${rgb}, ${b.a})`);
    g.addColorStop(0.7, `rgba(${rgb}, ${(b.a * 0.6).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.p.x, b.p.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const d of s.dust) {
    ctx.fillStyle = `rgba(${d.amber ? pal.amber : pal.node}, ${d.a})`;
    ctx.beginPath();
    ctx.arc(d.p.x, d.p.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 0.6;
  for (const [a, b, k] of s.fieldEdges) {
    ctx.strokeStyle = `rgba(${pal.line}, ${(k * 0.34).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const p of s.field) {
    ctx.fillStyle = `rgba(${pal.node}, 0.55)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (pal.glow) {
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = 7;
  }
  ctx.lineWidth = 1.1;
  for (const t of s.traces) {
    ctx.strokeStyle = `rgba(${t.amber ? pal.amber : pal.line}, 0.5)`;
    pathPoly(ctx, t.pts);
    ctx.stroke();
    const end = t.pts[t.pts.length - 1];
    ctx.beginPath();
    ctx.arc(end.x, end.y, 2.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.lineWidth = 0.75;
  ctx.strokeStyle = `rgba(${pal.line}, 0.42)`;
  for (const [a, b] of s.mesh) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  if (pal.glow) ctx.shadowBlur = 18;
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = `rgba(${pal.line}, 0.95)`;
  pathPoly(ctx, s.outline, true);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${pal.line}, 0.35)`;
  pathPoly(ctx, scaleAbout(s.outline, f, 1.07), true);
  ctx.stroke();

  for (const px of s.pixels) {
    ctx.fillStyle = `rgba(${px.amber ? pal.amber : pal.node}, ${px.a.toFixed(3)})`;
    ctx.fillRect(px.p.x - px.s / 2, px.p.y - px.s / 2, px.s, px.s);
  }

  if (pal.glow) ctx.shadowBlur = 10;
  for (const l of s.locks) drawLock(ctx, l.p, l.s, l.amber ? pal.amber : pal.node);
  if (pal.glow) ctx.shadowBlur = 16;
  drawKeyhole(ctx, f, R, pal.node);

  if (pal.glow) ctx.shadowBlur = 8;
  for (const n of s.meshNodes) {
    ctx.fillStyle = `rgba(${n.amber ? pal.amber : pal.node}, 0.92)`;
    ctx.beginPath();
    ctx.arc(n.p.x, n.p.y, n.amber ? 2.2 : 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'source-over';
}

function pointAt(t: Trace, q: number): Pt {
  let left = q * t.len;
  for (let i = 0; i < t.pts.length - 1; i++) {
    const a = t.pts[i];
    const b = t.pts[i + 1];
    const d = dist(a, b);
    if (left <= d) return { x: a.x + ((b.x - a.x) * left) / d, y: a.y + ((b.y - a.y) * left) / d };
    left -= d;
  }
  return t.pts[t.pts.length - 1];
}

function drawFx(ctx: CanvasRenderingContext2D, s: Scene, pal: Palette, dpr: number, time: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = pal.blend;
  const sec = time / 1000;

  for (const t of s.traces) {
    const q = ((sec + t.phase) % t.period) / t.period;
    if (q > 0.82) continue;
    const head = pointAt(t, q / 0.82);
    const tail = pointAt(t, Math.max(0, q / 0.82 - 0.12));
    const colour = t.amber ? pal.amber : pal.node;
    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, `rgba(${colour}, 0)`);
    grad.addColorStop(1, `rgba(${colour}, 0.9)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
    if (pal.glow) {
      ctx.shadowColor = t.amber ? `rgba(${pal.amber}, 0.9)` : pal.glow;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = `rgba(${colour}, 1)`;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // A shield-shaped scan ring leaves the outline every few seconds.
  const k = (sec % 7) / 7;
  if (k < 0.62) {
    const ring = scaleAbout(s.outline, s.focus, 1.04 + k * 0.95);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(${pal.line}, ${(0.42 * (1 - k / 0.62)).toFixed(3)})`;
    pathPoly(ctx, ring, true);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Mounts the art inside a host element with data-art="hero" or data-art="page". */
export function mountArt(host: HTMLElement) {
  const variant: Variant = host.dataset.art === 'page' ? 'page' : 'hero';
  const base = document.createElement('canvas');
  const fx = document.createElement('canvas');
  host.append(base, fx);
  const bctx = base.getContext('2d');
  const fctx = fx.getContext('2d');
  if (!bctx || !fctx) return;

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const theme = (): Theme => (root.dataset.theme === 'light' ? 'light' : 'dark');
  let scene: Scene | null = null;
  let dpr = 1;
  let visible = true;
  let raf = 0;
  let last = 0;

  const build = () => {
    const box = host.getBoundingClientRect();
    const w = Math.round(box.width);
    const h = Math.round(box.height);
    if (!w || !h) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [base, fx]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    let focus: Pt = { x: w * 0.84, y: h * 0.5 };
    let R = h * 0.42;
    if (variant === 'hero') {
      const panel = document.querySelector('.trail');
      if (panel) {
        const p = panel.getBoundingClientRect();
        focus = { x: p.left - box.left + p.width / 2, y: p.top - box.top + p.height / 2 };
        R = Math.min(p.height * 0.64, h * 0.52);
      }
    }
    scene = buildScene(variant, w, h, focus, R);
    drawStatic(bctx, scene, PALETTES[theme()], dpr);
    if (reduced) drawFx(fctx, scene, PALETTES[theme()], dpr, 2400);
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!scene || !visible || document.hidden || now - last < 33) return;
    last = now;
    drawFx(fctx, scene, PALETTES[theme()], dpr, now);
  };

  let timer = 0;
  new ResizeObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(build, 120);
  }).observe(host);
  new MutationObserver(() => scene && drawStatic(bctx, scene, PALETTES[theme()], dpr)).observe(root, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(host);

  build();
  // Web fonts can move the evidence panel once they load; redraw against the final layout.
  document.fonts?.ready.then(build, () => undefined);
  host.setAttribute('data-ready', '');
  if (!reduced) raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
